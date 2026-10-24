import {createHash} from "node:crypto";
import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike} from "jose";
import {prisma} from "@orionx/db";
import {
  authenticate,
  bindIdentity,
  buildGoogleAuthorizeUrl,
  createPkceChallenge,
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
  it("handles first-time Google sign-up as authenticated but unbound (never granting access by email or metadata)", async () => {
    stubAuthEnvironment();
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);

    // Even if Google OAuth user has a university email and malicious metadata claiming admin:
    const token = await signTestJwt(
      {
        email: "giorgi.kapanadze@btu.edu.ge",
        hd: "btu.edu.ge",
        user_metadata: {role: "admin", studentId: "cmvmriytq001pomj5vzlpygih"},
        app_metadata: {role: "admin", provider: "google"},
      },
      {sub: "11111111-2222-4333-8444-555555555555"},
    );

    // 1. Session resolution succeeds (user is authenticated via Google, but unauthorized for records)
    const session = await resolveSession(`Bearer ${token}`);
    expect(session).toEqual({
      authenticated: true,
      authorized: false,
      subject: "11111111-2222-4333-8444-555555555555",
      provider: issuer,
      role: null,
      email: "giorgi.kapanadze@btu.edu.ge",
    });

    // 2. Protected record access fails closed with 403 IDENTITY_UNBOUND
    await expect(authenticate(`Bearer ${token}`)).rejects.toMatchObject({
      code: "IDENTITY_UNBOUND",
      status: 403,
    });
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
    expect(identity).toEqual({
      subject: studentSub,
      provider: issuer,
      role: "student",
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
