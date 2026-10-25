import {createHash} from "node:crypto";
import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike} from "jose";
import {prisma} from "@orionx/db";
import {decodeCode} from "./index";
import {
  authenticate,
  bindIdentity,
  buildGoogleAuthorizeUrl,
  createPkceChallenge,
  ensureWorkspace,
  linkWorkspaceToStudent,
  newWorkspaceId,
  openOAuthState,
  requireAdmin,
  requireStudent,
  resolveAllowedWebOrigin,
  resolveSession,
  sanitizeRedirectPath,
  sealOAuthState,
  verifyJwt,
} from "./auth";

const COOKIE_SECRET = "sb_secret_test_orionx_oauth_signing_key_2026";

let jwksServer: Server;
let supabaseOrigin = "http://127.0.0.1:0";
let issuer = "";
let privateKey: KeyLike;
let wrongPrivateKey: KeyLike;
let publicJwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "orionx-es256-test-key";
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";

  const wrongPair = await generateKeyPair("ES256");
  wrongPrivateKey = wrongPair.privateKey;

  jwksServer = createServer((req, res) => {
    if (req.url === "/auth/v1/.well-known/jwks.json") {
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({keys: [publicJwk]}));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>(resolve => jwksServer.listen(0, "127.0.0.1", resolve));
  const port = (jwksServer.address() as AddressInfo).port;
  supabaseOrigin = `http://127.0.0.1:${port}`;
  issuer = `${supabaseOrigin}/auth/v1`;
});

afterAll(async () => {
  await new Promise<void>(resolve => jwksServer.close(() => resolve()));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function signTestJwt(
  claims: Record<string, unknown>,
  options: {
    sub?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: string | number;
    key?: KeyLike;
  } = {},
) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({alg: "ES256", kid: "orionx-es256-test-key"})
    .setIssuedAt()
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? "authenticated")
    .setExpirationTime(options.expiresIn ?? "1h");
  if (options.sub !== undefined) {
    jwt.setSubject(options.sub);
  }
  return jwt.sign(options.key ?? privateKey);
}

function stubAuthEnvironment() {
  vi.stubEnv("SUPABASE_URL", supabaseOrigin);
  vi.stubEnv("SUPABASE_SECRET_KEY", COOKIE_SECRET);
  vi.stubEnv("AUTH_JWT_ISSUER", "");
  vi.stubEnv("SUPABASE_JWKS_URL", "");
  vi.stubEnv("AUTH_JWT_AUDIENCE", "");
}

describe("Google OAuth PKCE, CSRF state, and redirect security", () => {
  it("generates RFC 7636 S256 PKCE challenges and builds Google authorize URLs", () => {
    const pkce = createPkceChallenge();
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.codeChallengeMethod).toBe("s256");
    const expectedChallenge = createHash("sha256").update(pkce.codeVerifier).digest("base64url");
    expect(pkce.codeChallenge).toBe(expectedChallenge);
    expect(pkce.state.length).toBeGreaterThanOrEqual(32);

    const authorizeUrl = buildGoogleAuthorizeUrl({
      supabaseOrigin,
      redirectUri: "https://orionx-phi.vercel.app/auth/callback",
      codeChallenge: pkce.codeChallenge,
    });
    const parsed = new URL(authorizeUrl);
    expect(parsed.origin).toBe(supabaseOrigin);
    expect(parsed.pathname).toBe("/auth/v1/authorize");
    expect(parsed.searchParams.get("provider")).toBe("google");
    expect(parsed.searchParams.get("redirect_to")).toBe("https://orionx-phi.vercel.app/auth/callback");
    expect(parsed.searchParams.get("code_challenge")).toBe(pkce.codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("s256");
    expect(parsed.searchParams.get("scopes")).toBe("openid email profile");
  });

  it("seals and verifies HMAC-signed OAuth state cookies and rejects tampering, mismatch, or expiration", () => {
    const pkce = createPkceChallenge();
    const sealed = sealOAuthState({state: pkce.state, verifier: pkce.codeVerifier, next: "/admin"}, COOKIE_SECRET);
    const opened = openOAuthState(sealed, pkce.state, COOKIE_SECRET);
    expect(opened).toEqual({
      state: pkce.state,
      verifier: pkce.codeVerifier,
      next: "/admin",
    });

    // Reject missing cookie
    expect(() => openOAuthState(undefined, pkce.state, COOKIE_SECRET)).toThrow("OAuth session missing");
    // Reject tampered signature
    expect(() => openOAuthState(sealed + "tampered", pkce.state, COOKIE_SECRET)).toThrow("Invalid OAuth state signature");
    // Reject wrong signing secret
    expect(() => openOAuthState(sealed, pkce.state, "sb_secret_wrong_signing_key_000000")).toThrow("Invalid OAuth state signature");
    // Reject mismatched CSRF state parameter
    expect(() => openOAuthState(sealed, "wrong_state_value", COOKIE_SECRET)).toThrow("OAuth state mismatch");
    // Reject expired OAuth state cookie
    const expired = sealOAuthState({state: pkce.state, verifier: pkce.codeVerifier, next: "/passport", ttlMs: -1000}, COOKIE_SECRET);
    expect(() => openOAuthState(expired, pkce.state, COOKIE_SECRET)).toThrow("OAuth session expired");
  });

  it("allows only safe relative application redirect paths and blocks open redirects", () => {
    expect(sanitizeRedirectPath(undefined)).toBe("/passport");
    expect(sanitizeRedirectPath("")).toBe("/passport");
    expect(sanitizeRedirectPath("/passport")).toBe("/passport");
    expect(sanitizeRedirectPath("/admin")).toBe("/admin");
    expect(sanitizeRedirectPath("/verify?code=D1-TEST")).toBe("/verify?code=D1-TEST");

    expect(() => sanitizeRedirectPath("https://attacker.invalid/phish")).toThrowError(
      expect.objectContaining({code: "INVALID_REDIRECT", status: 400}),
    );
    expect(() => sanitizeRedirectPath("//attacker.invalid")).toThrowError(
      expect.objectContaining({code: "INVALID_REDIRECT", status: 400}),
    );
    expect(() => sanitizeRedirectPath("/\\attacker.invalid")).toThrowError(
      expect.objectContaining({code: "INVALID_REDIRECT", status: 400}),
    );
    expect(() => sanitizeRedirectPath("javascript:alert(1)")).toThrowError(
      expect.objectContaining({code: "INVALID_REDIRECT", status: 400}),
    );
    expect(() => sanitizeRedirectPath("/api/v1/admin/sync")).toThrowError(
      expect.objectContaining({code: "INVALID_REDIRECT", status: 400}),
    );
  });

  it("enforces allowed web origins and rejects cross-origin spoofing", () => {
    expect(
      resolveAllowedWebOrigin(
        {origin: "https://orionx-phi.vercel.app"},
        {NODE_ENV: "production", VERCEL: "1", VERIFICATION_PUBLIC_ORIGIN: "https://orionx-phi.vercel.app"},
      ),
    ).toBe("https://orionx-phi.vercel.app");

    expect(() =>
      resolveAllowedWebOrigin(
        {origin: "https://evil.example.com"},
        {NODE_ENV: "production", VERCEL: "1", VERIFICATION_PUBLIC_ORIGIN: "https://orionx-phi.vercel.app"},
      ),
    ).toThrow("Request origin rejected");

    expect(
      resolveAllowedWebOrigin(
        {origin: "http://localhost:3000"},
        {NODE_ENV: "development", VERIFICATION_PUBLIC_ORIGIN: "https://orionx-phi.vercel.app"},
      ),
    ).toBe("http://localhost:3000");
  });
});

describe("JWT verification and StudentIdentity authorization separation", () => {
  it("auto-provisions a self-registered workspace and never grants access via email or metadata claims", async () => {
    stubAuthEnvironment();
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.studentWorkspace, "findUnique").mockResolvedValue(null);
    const create = vi.spyOn(prisma.studentWorkspace, "create").mockImplementation((async ({data}: {data: {workspaceId: string}}) => ({
      id: "ws-row-1",
      ...data,
      linkedStudentId: null,
      linkedBy: null,
      linkedAt: null,
      createdAt: new Date(),
    })) as never);

    // Even with a university email and malicious metadata claiming admin:
    const token = await signTestJwt(
      {
        email: "giorgi.kapanadze@btu.edu.ge",
        hd: "btu.edu.ge",
        user_metadata: {role: "admin", studentId: "cmvmriytq001pomj5vzlpygih"},
        app_metadata: {role: "admin", provider: "google"},
      },
      {sub: "11111111-2222-4333-8444-555555555555"},
    );

    const session = await resolveSession(`Bearer ${token}`);
    expect(session).toMatchObject({
      authenticated: true,
      authorized: true,
      subject: "11111111-2222-4333-8444-555555555555",
      provider: issuer,
      role: "student",
      verification: "SELF_REGISTERED",
      email: "giorgi.kapanadze@btu.edu.ge",
    });
    expect(session.studentId).toBeUndefined();
    expect(session.workspaceId).toMatch(/^WS-[A-Z2-7]{16}$/);
    // Keyed by immutable subject only; no Student/StudentIdentity row is touched.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({provider: issuer, subject: "11111111-2222-4333-8444-555555555555"});

    // The workspace identity is authenticated but holds no admin or university authority.
    const identity = await authenticate(`Bearer ${token}`);
    expect(identity.verification).toBe("SELF_REGISTERED");
    expect(() => requireAdmin(identity)).toThrowError(expect.objectContaining({code: "FORBIDDEN", status: 403}));
    // Cannot read any student's official passport, even by guessing an ID.
    expect(() => requireStudent(identity, "cmvmriytq001pomj5vzlpygih")).toThrowError(
      expect.objectContaining({code: "NOT_FOUND", status: 404}),
    );
  });

  it("reuses an existing workspace for returning logins and never writes again", async () => {
    stubAuthEnvironment();
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.studentWorkspace, "findUnique").mockResolvedValue({
      id: "ws-row-1",
      workspaceId: "WS-ABCDEFGHIJKLMNOP",
      provider: issuer,
      subject: "sub-returning",
      email: "a@gmail.com",
      linkedStudentId: null,
      linkedBy: null,
      linkedAt: null,
      createdAt: new Date(),
    });
    const create = vi.spyOn(prisma.studentWorkspace, "create");
    const token = await signTestJwt({email: "a@gmail.com"}, {sub: "sub-returning"});
    const first = await resolveSession(`Bearer ${token}`);
    const second = await resolveSession(`Bearer ${token}`);
    expect(first.workspaceId).toBe("WS-ABCDEFGHIJKLMNOP");
    expect(second.workspaceId).toBe("WS-ABCDEFGHIJKLMNOP");
    expect(create).not.toHaveBeenCalled();
  });

  it("converges concurrent first logins on a single workspace via the unique index", async () => {
    stubAuthEnvironment();
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);
    // In-memory stand-in for the (provider, subject) unique index.
    const rows = new Map<string, Record<string, unknown>>();
    let created = 0;
    vi.spyOn(prisma.studentWorkspace, "findUnique").mockImplementation((async ({where}: {where: {provider_subject: {provider: string; subject: string}}}) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return rows.get(`${where.provider_subject.provider}|${where.provider_subject.subject}`) ?? null;
    }) as never);
    vi.spyOn(prisma.studentWorkspace, "create").mockImplementation((async ({data}: {data: {provider: string; subject: string}}) => {
      const key = `${data.provider}|${data.subject}`;
      if (rows.has(key)) throw Object.assign(new Error("Unique constraint failed"), {code: "P2002"});
      const row = {id: `row-${++created}`, ...data, linkedStudentId: null, linkedBy: null, linkedAt: null, createdAt: new Date()};
      rows.set(key, row);
      return row;
    }) as never);
    const token = await signTestJwt({email: "race@gmail.com"}, {sub: "sub-race"});
    const results = await Promise.all(Array.from({length: 8}, () => resolveSession(`Bearer ${token}`)));
    expect(rows.size).toBe(1);
    expect(created).toBe(1);
    expect(new Set(results.map(r => r.workspaceId)).size).toBe(1);
  });

  it("does not link an unverified workspace to an imported record that shares its email", async () => {
    stubAuthEnvironment();
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.studentWorkspace, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.studentWorkspace, "create").mockImplementation((async ({data}: {data: Record<string, unknown>}) => ({id: "w", ...data, linkedStudentId: null, linkedBy: null, linkedAt: null, createdAt: new Date()})) as never);
    const studentLookup = vi.spyOn(prisma.student, "findUnique");
    const studentFirst = vi.spyOn(prisma.student, "findFirst");
    const token = await signTestJwt({email: "imported.student@btu.edu.ge"}, {sub: "sub-email-match"});
    const session = await resolveSession(`Bearer ${token}`);
    expect(session.verification).toBe("SELF_REGISTERED");
    expect(session.studentId).toBeUndefined();
    expect(studentLookup).not.toHaveBeenCalled();
    expect(studentFirst).not.toHaveBeenCalled();
  });

  it("preserves existing verified-student and administrator bindings without creating workspaces", async () => {
    stubAuthEnvironment();
    const wsFind = vi.spyOn(prisma.studentWorkspace, "findUnique");
    const wsCreate = vi.spyOn(prisma.studentWorkspace, "create");
    const identityFind = vi.spyOn(prisma.studentIdentity, "findUnique");
    identityFind.mockResolvedValueOnce({id: "i1", provider: issuer, subject: "sub-verified", role: "student", studentId: "stu-1", verifiedBy: "admin-1", verifiedAt: new Date()});
    const verified = await resolveSession(`Bearer ${await signTestJwt({}, {sub: "sub-verified"})}`);
    expect(verified).toMatchObject({role: "student", verification: "UNIVERSITY_VERIFIED", studentId: "stu-1"});
    identityFind.mockResolvedValueOnce({id: "i2", provider: issuer, subject: "sub-admin", role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    const adminSession = await resolveSession(`Bearer ${await signTestJwt({}, {sub: "sub-admin"})}`);
    expect(adminSession).toMatchObject({role: "admin", verification: "ADMIN"});
    expect(wsFind).not.toHaveBeenCalled();
    expect(wsCreate).not.toHaveBeenCalled();
  });

  it("workspace identifiers are never valid verification codes", () => {
    const id = newWorkspaceId();
    expect(id).toMatch(/^WS-[A-Z2-7]{16}$/);
    expect(() => decodeCode(id)).toThrow();
    expect(newWorkspaceId()).not.toBe(id);
  });

  it("authorizes returning Google student and blocks access to another student's passport or admin endpoints", async () => {
    stubAuthEnvironment();
    const studentSub = "f48c1019-ee98-4020-9568-351fa0a57e73";
    const ownStudentId = "cmvmriytq001pomj5vzlpygih";
    const otherStudentId = "cmvmrj3v9002tomj5mbgiu1sp";

    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({
      id: "id-student-1",
      provider: issuer,
      subject: studentSub,
      role: "student",
      studentId: ownStudentId,
      verifiedBy: "explicit-demo-fixture-seed",
      verifiedAt: new Date(),
    });

    const token = await signTestJwt({email: "student1@gmail.com"}, {sub: studentSub});
    const identity = await authenticate(`Bearer ${token}`);
    expect(identity).toMatchObject({
      subject: studentSub,
      provider: issuer,
      role: "student",
      verification: "UNIVERSITY_VERIFIED",
      studentId: ownStudentId,
      email: "student1@gmail.com",
    });

    // Can access own student record
    expect(() => requireStudent(identity, ownStudentId)).not.toThrow();
    // Cannot access another student's passport (404 NOT_FOUND to avoid leaking existence)
    expect(() => requireStudent(identity, otherStudentId)).toThrowError(
      expect.objectContaining({code: "NOT_FOUND", status: 404}),
    );
    // Cannot access administrator actions (403 FORBIDDEN)
    expect(() => requireAdmin(identity)).toThrowError(
      expect.objectContaining({code: "FORBIDDEN", status: 403}),
    );
  });

  it("authorizes returning Google administrator", async () => {
    stubAuthEnvironment();
    const adminSub = "f913b163-be04-4eeb-8b99-24bb6d74a649";
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({
      id: "id-admin-1",
      provider: issuer,
      subject: adminSub,
      role: "admin",
      studentId: null,
      verifiedBy: "explicit-demo-fixture-seed",
      verifiedAt: new Date(),
    });

    const token = await signTestJwt({email: "admin@gmail.com"}, {sub: adminSub});
    const identity = await authenticate(`Bearer ${token}`);
    expect(identity.role).toBe("admin");
    expect(identity.verification).toBe("ADMIN");
    expect(() => requireAdmin(identity)).not.toThrow();
  });

  it("rejects missing, expired, wrong-signature, wrong-issuer, and wrong-audience tokens", async () => {
    stubAuthEnvironment();

    await expect(verifyJwt(undefined)).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});
    await expect(verifyJwt("Bearer not-a-jwt")).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});

    const expiredToken = await signTestJwt({}, {sub: "user-1", expiresIn: "-10s"});
    await expect(verifyJwt(`Bearer ${expiredToken}`)).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});

    const wrongKeyToken = await signTestJwt({}, {sub: "user-1", key: wrongPrivateKey});
    await expect(verifyJwt(`Bearer ${wrongKeyToken}`)).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});

    const wrongIssuerToken = await signTestJwt({}, {sub: "user-1", issuer: "https://other.supabase.co/auth/v1"});
    await expect(verifyJwt(`Bearer ${wrongIssuerToken}`)).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});

    const wrongAudienceToken = await signTestJwt({}, {sub: "user-1", audience: "anon"});
    await expect(verifyJwt(`Bearer ${wrongAudienceToken}`)).rejects.toMatchObject({code: "UNAUTHENTICATED", status: 401});
  });

  it("enforces explicit subject-only identity binding and rejects email-based binding attempts", async () => {
    stubAuthEnvironment();
    await expect(
      bindIdentity({
        subject: "student@btu.edu.ge",
        role: "student",
        studentExternalId: "BTU-T-0001",
        verifiedBy: "admin-1",
      }),
    ).rejects.toMatchObject({code: "INVALID_SUBJECT", status: 400});
  });
});

describe("Administrator reconciliation of self-service workspaces", () => {
  const workspace = {id: "w1", workspaceId: "WS-ABCDEFGHIJKLMNOP", provider: "p", subject: "sub-1", email: "x@gmail.com", linkedStudentId: null as string | null, linkedBy: null, linkedAt: null, createdAt: new Date()};
  const student = {id: "stu-1", externalId: "BTU-1", email: "x@gmail.com"};

  function fakeTx(overrides: Record<string, unknown> = {}) {
    const tx = {
      studentWorkspace: {findUnique: vi.fn().mockResolvedValue({...workspace}), updateMany: vi.fn().mockResolvedValue({count: 1})},
      student: {findUnique: vi.fn().mockResolvedValue(student)},
      studentIdentity: {findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({})},
      auditEvent: {create: vi.fn().mockResolvedValue({})},
      ...overrides,
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((async (fn: (t: unknown) => unknown) => fn(tx)) as never);
    return tx;
  }

  it("links an explicit workspace to an explicit student, creating an audited verified binding", async () => {
    const tx = fakeTx();
    const result = await linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentExternalId: "BTU-1", linkedBy: "admin-1"});
    expect(result).toMatchObject({studentId: "stu-1", alreadyLinked: false});
    expect(tx.studentIdentity.create).toHaveBeenCalledWith({data: {provider: "p", subject: "sub-1", role: "student", studentId: "stu-1", verifiedBy: "admin-1"}});
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({action: "WORKSPACE_LINKED", actorId: "admin-1"})}));
    // The student lookup is by explicit external ID, not by the workspace's email.
    expect(tx.student.findUnique).toHaveBeenCalledWith({where: {externalId: "BTU-1"}});
  });

  it("is idempotent when already linked to the same student and 409s for a different one", async () => {
    fakeTx({studentWorkspace: {findUnique: vi.fn().mockResolvedValue({...workspace, linkedStudentId: "stu-1"}), updateMany: vi.fn()}});
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentId: "stu-1", linkedBy: "a"})).resolves.toMatchObject({alreadyLinked: true});
    fakeTx({
      studentWorkspace: {findUnique: vi.fn().mockResolvedValue({...workspace, linkedStudentId: "stu-other"}), updateMany: vi.fn()},
    });
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentId: "stu-1", linkedBy: "a"})).rejects.toMatchObject({code: "WORKSPACE_ALREADY_LINKED", status: 409});
  });

  it("refuses conflicts: existing binding on the account or a student already bound elsewhere", async () => {
    fakeTx({studentIdentity: {findUnique: vi.fn().mockResolvedValue({role: "admin"}), findFirst: vi.fn(), create: vi.fn()}});
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentId: "stu-1", linkedBy: "a"})).rejects.toMatchObject({code: "IDENTITY_CONFLICT", status: 409});
    const tx = fakeTx({studentIdentity: {findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue({id: "other"}), create: vi.fn()}});
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentId: "stu-1", linkedBy: "a"})).rejects.toMatchObject({code: "IDENTITY_CONFLICT", status: 409});
    expect(tx.studentIdentity.create).not.toHaveBeenCalled();
  });

  it("404s for unknown workspace or student and requires a student reference", async () => {
    fakeTx({studentWorkspace: {findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn()}});
    await expect(linkWorkspaceToStudent({workspaceId: "WS-ZZZZZZZZZZZZZZZZ", studentId: "x", linkedBy: "a"})).rejects.toMatchObject({status: 404});
    fakeTx({student: {findUnique: vi.fn().mockResolvedValue(null)}});
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, studentId: "x", linkedBy: "a"})).rejects.toMatchObject({status: 404});
    await expect(linkWorkspaceToStudent({workspaceId: workspace.workspaceId, linkedBy: "a"})).rejects.toMatchObject({status: 400});
  });

  it("ensureWorkspace surfaces non-unique database errors instead of masking them", async () => {
    vi.spyOn(prisma.studentWorkspace, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.studentWorkspace, "create").mockRejectedValue(new Error("connection lost"));
    await expect(ensureWorkspace("p", "s")).rejects.toThrow("connection lost");
  });
});
