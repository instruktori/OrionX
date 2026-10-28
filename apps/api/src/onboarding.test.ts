import {createServer, request as httpRequest, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike} from "jose";

process.env.ORIONX_SKIP_LISTEN = "1";

const COOKIE_SECRET = "sb_secret_test_orionx_api_signing_key_2026";
const NEW_SUB = "aaaaaaaa-1111-4222-8333-444444444444";
const WORKSPACE = {id: "row1", workspaceId: "WS-ABCDEFGHIJKLMNOP", provider: "", subject: NEW_SUB, email: "new.student@btu.edu.ge", linkedStudentId: null, linkedBy: null, linkedAt: null, createdAt: new Date()};

let supabase: Server;
let api: Server;
let apiOrigin = "";
let issuer = "";
let privateKey: KeyLike;
let prisma: typeof import("@orionx/db").prisma;

async function token(sub: string, claims: Record<string, unknown> = {}, expiresIn: string | number = "1h") {
  return new SignJWT(claims)
    .setProtectedHeader({alg: "ES256", kid: "k1"})
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(sub)
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwk: JWK = {...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256", use: "sig"};
  supabase = createServer(async (req, res) => {
    if (req.url === "/auth/v1/.well-known/jwks.json") {
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({keys: [jwk]}));
    } else if (req.url?.startsWith("/auth/v1/token")) {
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({access_token: await token(NEW_SUB, {email: WORKSPACE.email}), refresh_token: "refresh-1", expires_in: 3600}));
    } else if (req.url === "/auth/v1/logout") {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>(resolve => supabase.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(supabase.address() as AddressInfo).port}`;
  issuer = `${origin}/auth/v1`;
  WORKSPACE.provider = issuer;
  process.env.SUPABASE_URL = origin;
  process.env.SUPABASE_SECRET_KEY = COOKIE_SECRET;
  for (const key of ["AUTH_JWT_ISSUER", "SUPABASE_JWKS_URL", "AUTH_JWT_AUDIENCE", "WEB_ORIGIN", "AUTH_COOKIE_SECRET"]) delete process.env[key];
  process.env.NODE_ENV = "test";

  ({prisma} = await import("@orionx/db"));
  const {createApp} = await import("./server");
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  api = app.getHttpServer();
  apiOrigin = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => supabase.close(() => resolve()));
  await new Promise<void>(resolve => api.close(() => resolve()));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function mockUnboundUser() {
  vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue(null);
  vi.spyOn(prisma.studentWorkspace, "findUnique").mockResolvedValue(WORKSPACE);
}

async function call(path: string, bearer?: string, init: RequestInit = {}) {
  const response = await fetch(apiOrigin + "/api/v1" + path, {
    redirect: "manual",
    ...init,
    headers: {...(bearer ? {Authorization: `Bearer ${bearer}`} : {}), "Content-Type": "application/json", ...init.headers},
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // non-JSON body
  }
  return {status: response.status, body: body as any, headers: response.headers};
}

describe("self-service student onboarding over HTTP", () => {
  it("lets a brand-new Google user into their own workspace with no admin approval", async () => {
    mockUnboundUser();
    const session = await call("/auth/session", await token(NEW_SUB, {email: WORKSPACE.email}));
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({authenticated: true, authorized: true, role: "student", verification: "SELF_REGISTERED", workspaceId: WORKSPACE.workspaceId});
    expect(session.body.studentId).toBeUndefined();
  });

  it("returns a valid empty passport that is not presented as issued or verified", async () => {
    mockUnboundUser();
    const t = await token(NEW_SUB, {email: WORKSPACE.email});
    const passport = await call("/me/passport", t);
    expect(passport.status).toBe(200);
    expect(passport.body).toMatchObject({
      official: false,
      status: "EMPTY_WORKSPACE",
      passportId: null,
      workspaceId: WORKSPACE.workspaceId,
      universityVerified: false,
      originalIssueDate: null,
      student: null,
      latest: null,
      counts: {skills: 0, badges: 0, versions: 0},
    });
    expect(JSON.stringify(passport.body)).not.toMatch(/opaqueChainRef|txSignature|verificationCode/);
    const versions = await call("/me/passport/versions", t);
    expect(versions.status).toBe(200);
    expect(versions.body).toEqual([]);
  });

  it("issues no document for an empty workspace", async () => {
    mockUnboundUser();
    const download = await call("/me/passport/versions/1/download", await token(NEW_SUB));
    expect(download.status).toBe(404);
  });

  it("denies every administrator and issuer endpoint with 403", async () => {
    mockUnboundUser();
    const t = await token(NEW_SUB, {email: WORKSPACE.email, app_metadata: {role: "admin"}, user_metadata: {role: "admin"}});
    for (const [method, path] of [
      ["GET", "/admin/overview"],
      ["GET", "/admin/passports"],
      ["GET", "/admin/audit"],
      ["GET", "/admin/workspaces"],
      ["GET", "/admin/passports/ORX-1/versions"],
      ["POST", "/admin/sync"],
      ["POST", "/admin/identities"],
      ["POST", `/admin/workspaces/${WORKSPACE.workspaceId}/link`],
      ["POST", "/admin/jobs/x/retry"],
      ["POST", "/admin/jobs/process"],
    ] as const) {
      const response = await call(path, t, {method, body: method === "POST" ? JSON.stringify({subject: NEW_SUB, role: "admin", studentExternalId: "BTU-1"}) : undefined});
      expect({path, status: response.status}).toEqual({path, status: 403});
    }
  });

  it("does not let a student self-link to a university record", async () => {
    mockUnboundUser();
    const bind = vi.spyOn(prisma.studentIdentity, "upsert");
    const link = vi.spyOn(prisma.studentWorkspace, "updateMany");
    const response = await call(`/admin/workspaces/${WORKSPACE.workspaceId}/link`, await token(NEW_SUB), {method: "POST", body: JSON.stringify({studentExternalId: "BTU-T-0001"})});
    expect(response.status).toBe(403);
    expect(bind).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
  });

  it("rejects expired, tampered and missing sessions", async () => {
    mockUnboundUser();
    expect((await call("/me/passport")).status).toBe(401);
    expect((await call("/auth/session", await token(NEW_SUB, {}, "-10s"))).status).toBe(401);
    const good = await token(NEW_SUB);
    expect((await call("/auth/session", good.slice(0, -4) + "AAAA")).status).toBe(401);
  });

  it("does not recognize an empty workspace as an issued/registered passport publicly", async () => {
    const lookup = vi.spyOn(prisma.studentWorkspace, "findUnique");
    const response = await call(`/verify/${WORKSPACE.workspaceId}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CODE");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("preserves an existing verified student's official passport", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "student", studentId: "stu-1", verifiedBy: "admin-1", verifiedAt: new Date()});
    const ensure = vi.spyOn(prisma.studentWorkspace, "create");
    const awards = [{recordId: "R1", studentId: "BTU-1", skillId: "S", name: "Prompting", category: "AI Skill", badgeCode: "B1", description: "d", dateEarned: "2026-01-01"}];
    const version = {number: 1, state: "FINALIZED", code: "D1-ABC", pageCount: 2, createdAt: new Date(), finalizedAt: new Date(), snapshot: {student: {initialIssueDate: "2026-01-02"}, awards}, chainCluster: "devnet", finalizedSlot: BigInt(5)};
    vi.spyOn(prisma.passport, "findUnique").mockResolvedValue({id: "p1", publicId: "ORX-0001", studentId: "stu-1", latestFinalizedVersion: 1, activeVersionId: null, initialIssueDate: new Date("2026-01-02"), student: {firstName: "Ana", lastName: "K", program: "AI", educationLevel: "BSc"}} as never);
    vi.spyOn(prisma.version, "findUnique").mockResolvedValue(version as never);
    vi.spyOn(prisma.version, "count").mockResolvedValue(1);
    vi.spyOn(prisma.version, "findMany").mockResolvedValue([version] as never);
    const t = await token(NEW_SUB);
    const passport = await call("/me/passport", t);
    expect(passport.body).toMatchObject({official: true, passportId: "ORX-0001", originalIssueDate: "2026-01-02", universityVerified: true, verification: "UNIVERSITY_VERIFIED", counts: {skills: 1, badges: 1, versions: 1}});
    const versions = await call("/me/passport/versions", t);
    expect(versions.body).toHaveLength(1);
    expect(ensure).not.toHaveBeenCalled();
  });

  it("shows a verified-but-unissued student an empty passport marked university verified", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "student", studentId: "stu-1", verifiedBy: "admin-1", verifiedAt: new Date()});
    vi.spyOn(prisma.passport, "findUnique").mockResolvedValue(null);
    const passport = await call("/me/passport", await token(NEW_SUB));
    expect(passport.body).toMatchObject({official: false, universityVerified: true, passportId: null, counts: {skills: 0, badges: 0, versions: 0}});
  });

  it("hides a reserved passport ID until a real PDF version is finalized", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({
      id: "identity-reserved", provider: issuer, subject: NEW_SUB, role: "student",
      studentId: "student-reserved", verifiedBy: "admin", verifiedAt: new Date(),
    });
    vi.spyOn(prisma.passport, "findUnique").mockResolvedValue({
      id: "passport-reserved", publicId: "BTU-AI-RESERVED", studentId: "student-reserved",
      latestFinalizedVersion: 0, activeVersionId: "draft-v1",
      initialIssueDate: new Date("2026-10-28"),
      student: {firstName: "Not", lastName: "Issued"},
    } as never);
    const versionLookup = vi.spyOn(prisma.version, "findUnique");
    const t = await token(NEW_SUB);
    const response = await call("/me/passport", t);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      official: false, status: "ISSUANCE_PENDING", passportId: null,
      originalIssueDate: null, latest: null, student: null, pending: true,
      counts: {skills: 0, badges: 0, versions: 0},
    });
    expect(JSON.stringify(response.body)).not.toContain("BTU-AI-RESERVED");
    expect(versionLookup).not.toHaveBeenCalled();
    expect((await call("/me/passport/versions/1/download", t)).status).toBe(404);
  });

  it("withholds a reserved ID when a version row lacks finalized PDF storage", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({
      id: "identity-without-pdf", provider: issuer, subject: NEW_SUB, role: "student",
      studentId: "student-without-pdf", verifiedBy: "admin", verifiedAt: new Date(),
    });
    vi.spyOn(prisma.passport, "findUnique").mockResolvedValue({
      id: "passport-without-pdf", publicId: "BTU-AI-HIDDEN", studentId: "student-without-pdf",
      latestFinalizedVersion: 1, activeVersionId: null,
      initialIssueDate: new Date("2026-10-28"),
      student: {firstName: "Not", lastName: "Finalized"},
    } as never);
    vi.spyOn(prisma.version, "findUnique").mockResolvedValue({
      number: 1, finalizedSlot: null, storageKey: "pending-file.pdf", pdfSha256: null,
    } as never);
    const t = await token(NEW_SUB);
    const result = await call("/me/passport", t);
    expect(result.body).toMatchObject({official: false, passportId: null, latest: null, status: "NOT_ISSUED"});
    expect(JSON.stringify(result.body)).not.toContain("BTU-AI-HIDDEN");
    expect((await call("/me/passport/versions/1/download", t)).status).toBe(404);
  });

  it("keeps administrator privileges and gives admins no student passport", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    const ensure = vi.spyOn(prisma.studentWorkspace, "create");
    vi.spyOn(prisma.passport, "findMany").mockResolvedValue([]);
    const t = await token(NEW_SUB);
    expect((await call("/auth/session", t)).body).toMatchObject({role: "admin", verification: "ADMIN"});
    expect((await call("/admin/passports", t)).status).toBe(200);
    expect((await call("/me/passport", t)).status).toBe(404);
    expect(ensure).not.toHaveBeenCalled();
  });

  it.each([
    {mode: "sheets", sheetId: "test-workbook_123", expected: "https://docs.google.com/spreadsheets/d/test-workbook_123/edit"},
    {mode: "sheets", sheetId: "", expected: null},
    {mode: "fixture", sheetId: "test-workbook_123", expected: null},
  ])("returns the configured source spreadsheet link only in sheets mode ($mode, $sheetId)", async ({mode, sheetId, expected}) => {
    vi.stubEnv("SOURCE_MODE", mode);
    vi.stubEnv("GOOGLE_SHEET_ID", sheetId);
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    vi.spyOn(prisma.passport, "count").mockResolvedValue(0);
    vi.spyOn(prisma.student, "count").mockResolvedValue(0);
    vi.spyOn(prisma.version, "count").mockResolvedValue(0);
    vi.spyOn(prisma.award, "count").mockResolvedValue(0);
    vi.spyOn(prisma.job, "groupBy").mockResolvedValue([]);
    vi.spyOn(prisma.studentWorkspace, "count").mockResolvedValue(0);
    vi.spyOn(prisma.studentIdentity, "count").mockResolvedValue(0);
    vi.spyOn(prisma.importRun, "findFirst").mockResolvedValue(null);
    const response = await call("/admin/overview", await token(NEW_SUB));
    expect(response.status).toBe(200);
    expect(response.body.sourceSpreadsheetUrl).toBe(expected);
  });

  it("allows a dual-role administrator (bound to a studentId) to access both admin routes and their own student passport", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i-dual", provider: issuer, subject: NEW_SUB, role: "admin", studentId: "stu-dual", verifiedBy: "seed", verifiedAt: new Date()});
    vi.spyOn(prisma.passport, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.passport, "count").mockResolvedValue(120);
    vi.spyOn(prisma.passport, "findUnique").mockResolvedValue({id: "p-dual", publicId: "BTU-AI-000125", studentId: "stu-dual", latestFinalizedVersion: 2, activeVersionId: null, initialIssueDate: new Date("2026-01-02"), student: {firstName: "Luka", lastName: "G", program: "AI", educationLevel: "BSc"}} as never);
    vi.spyOn(prisma.version, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.version, "count").mockResolvedValue(2);
    const t = await token(NEW_SUB);
    const sess = await call("/auth/session", t);
    expect(sess.body).toMatchObject({role: "admin", verification: "ADMIN", studentId: "stu-dual"});
    const paged = await call("/admin/passports?envelope=1&skip=100&take=25", t);
    expect(paged.status).toBe(200);
    expect(paged.body).toMatchObject({total: 120, skip: 100, take: 25});
    const myPass = await call("/me/passport", t);
    expect(myPass.status).toBe(200);
    expect(myPass.body).toMatchObject({official: false, status: "NOT_ISSUED", passportId: null, latest: null});
  });

  it.each([0, 1])("atomically retries only an eligible job (matched rows: %i)", async count => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    const tx = {job: {updateMany: vi.fn().mockResolvedValue({count}), findUniqueOrThrow: vi.fn().mockResolvedValue({stage: "CHAIN"})}, auditEvent: {create: vi.fn()}};
    vi.spyOn(prisma, "$transaction").mockImplementation(async (work: any) => work(tx));
    const response = await call("/admin/jobs/job-1/retry", await token(NEW_SUB), {method: "POST"});
    expect(response.status).toBe(count ? 201 : 409);
    expect(tx.job.updateMany.mock.calls[0][0].where).toEqual({id: "job-1", state: {in: ["FAILED_PERMANENT", "RETRY_WAIT", "STORED"]}});
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(count);
  });

  it("keeps on-demand processing disabled until server credentials are configured", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    vi.stubEnv("MANUAL_WORKER_ENABLED", "false");
    const response = await call("/admin/jobs/process", await token(NEW_SUB), {method: "POST"});
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("PROCESSOR_DISABLED");
  });

  it("processes one durable step for an administrator and returns only queue progress", async () => {
    vi.spyOn(prisma.studentIdentity, "findUnique").mockResolvedValue({id: "i", provider: issuer, subject: NEW_SUB, role: "admin", studentId: null, verifiedBy: "seed", verifiedAt: new Date()});
    for (const [key, value] of Object.entries({MANUAL_WORKER_ENABLED: "true", SOURCE_MODE: "sheets", CHAIN_MODE: "devnet", STORAGE_MODE: "supabase", SOLANA_ISSUER_KEYPAIR_JSON: "server-only-test-value"})) vi.stubEnv(key, value);
    const processor = await import("@orionx/core/src/processor");
    const processNext = vi.fn().mockResolvedValue({processed: true, jobId: "job-1", errorCode: null});
    vi.spyOn(processor, "createJobProcessor").mockReturnValue({workerId: "00000000-0000-4000-8000-000000000001", pollMs: 3000, processNext});
    vi.spyOn(prisma.job, "count").mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    vi.spyOn(prisma.job, "findFirst").mockResolvedValue(null);
    const response = await call("/admin/jobs/process", await token(NEW_SUB), {method: "POST"});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({processed: true, jobId: "job-1", errorCode: null, remaining: 2, blocked: 0, nextAvailableAt: null});
    expect(processor.createJobProcessor).toHaveBeenCalledWith({writebackLimit: 1});
    expect(JSON.stringify(response.body)).not.toContain("server-only-test-value");
  });

  it("redirects a first-time Google callback to /passport (not an admin-linking screen)", async () => {
    mockUnboundUser();
    const {sealOAuthState, createPkceChallenge} = await import("@orionx/core");
    const pkce = createPkceChallenge();
    const sealed = sealOAuthState({state: pkce.state, verifier: pkce.codeVerifier, next: "/passport"}, COOKIE_SECRET);
    const response = await call(`/auth/callback?code=abc&state=${pkce.state}`, undefined, {headers: {Cookie: `orionx_oauth=${sealed}`}});
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/passport");
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/orionx_access=.*HttpOnly/);
    expect(cookies).toMatch(/orionx_refresh=.*HttpOnly/);
  });

  it("logout clears session cookies (and enforces same-origin for cookie-authenticated POSTs)", async () => {
    // fetch() treats Origin as a forbidden header, so use raw HTTP to send one.
    const post = (headers: Record<string, string>) =>
      new Promise<{status: number; cookies: string}>((resolve, reject) => {
        const request = httpRequest(apiOrigin + "/api/v1/auth/logout", {method: "POST", headers: {"Content-Type": "application/json", Cookie: "orionx_access=abc", ...headers}}, response => {
          response.resume();
          response.on("end", () => resolve({status: response.statusCode as number, cookies: (response.headers["set-cookie"] || []).join("\n")}));
        });
        request.on("error", reject);
        request.end("{}");
      });
    expect((await post({})).status).toBe(403);
    expect((await post({Origin: "https://evil.example"})).status).toBe(403);
    const ok = await post({Origin: apiOrigin});
    expect(ok.status).toBe(200);
    expect(ok.cookies).toMatch(/orionx_access=;.*Max-Age=0/);
    expect(ok.cookies).toMatch(/orionx_refresh=;.*Max-Age=0/);
  });
});

describe("retired module routes", () => {
  it("returns 404 for every former student/admin endpoint before authentication or database access", async () => {
    mockUnboundUser();
    const identityLookup = vi.spyOn(prisma.studentIdentity, "findUnique");
    const workspaceLookup = vi.spyOn(prisma.studentWorkspace, "findUnique");
    const {createApp} = await import("./server");
    // A separate app keeps the route matrix independent of the shared rate-limit bucket.
    const app = await createApp();
    await app.listen(0, "127.0.0.1");
    const origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const endpoints = [
      ["GET", "/assessments"],
      ["GET", "/assessments/former-id"],
      ["POST", "/assessments/former-id/attempts"],
      ["GET", "/assessment-attempts/former-id"],
      ["POST", "/assessment-attempts/former-id/save"],
      ["POST", "/assessment-attempts/former-id/submit"],
      ["GET", "/admin/assessments"],
      ["POST", "/admin/assessments"],
      ["GET", "/admin/assessments/former-id"],
      ["POST", "/admin/assessments/former-id/update"],
      ["POST", "/admin/assessments/former-id/publish"],
      ["POST", "/admin/assessments/former-id/archive"],
    ] as const;
    try {
      for (const bearer of [undefined, await token(NEW_SUB), await token(NEW_SUB, {app_metadata: {role: "admin"}})]) {
        for (const [method, path] of endpoints) {
          const response = await fetch(origin + "/api/v1" + path, {
            method,
            headers: {"Content-Type": "application/json", ...(bearer ? {Authorization: `Bearer ${bearer}`} : {})},
            ...(method === "POST" ? {body: "{}"} : {}),
          });
          expect({method, path, status: response.status}).toEqual({method, path, status: 404});
          expect((await response.json()).error.code).toBe("NOT_FOUND");
        }
      }
      expect(identityLookup).not.toHaveBeenCalled();
      expect(workspaceLookup).not.toHaveBeenCalled();
      expect((await fetch(origin + "/api/v1/health/live")).status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
