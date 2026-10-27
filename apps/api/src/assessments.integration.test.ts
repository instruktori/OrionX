import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";

const testUrl = process.env.ORIONX_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
let db: typeof import("@orionx/db").prisma;
let api: Server,
  jwks: Server,
  origin: string,
  issuer: string,
  privateKey: KeyLike;
let adminToken: string,
  studentToken: string,
  otherToken: string,
  unlinkedToken: string;
let examId: string, attemptId: string;
let revision = 0;
const prefix = `assessment-it-${Date.now()}`;
const content = {
  title: "Responsible AI foundations",
  description: "Evaluate safe and effective AI use in university work.",
  objectives: ["Check sources and protect private information"],
  skills: ["AI literacy"],
  difficulty: "Foundational",
  durationMinutes: 20,
  passingPercent: 70,
  maxAttempts: 1,
  questions: [
    {
      id: "q1",
      type: "SINGLE_CHOICE",
      prompt: "How should you handle an AI-generated citation?",
      options: [
        { id: "a", text: "Verify it independently" },
        { id: "b", text: "Trust it automatically" },
      ],
      correctOptionIds: ["a"],
    },
    {
      id: "q2",
      type: "MULTIPLE_CHOICE",
      prompt: "Which information should you protect from public AI tools?",
      options: [
        { id: "a", text: "Private records" },
        { id: "b", text: "Passwords" },
        { id: "c", text: "Public documentation" },
      ],
      correctOptionIds: ["a", "b"],
    },
  ],
};
async function call(path: string, token?: string, body?: unknown) {
  const response = await fetch(origin + "/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
suite("assessments over HTTP with real PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.endsWith("orionx_test")
    )
      throw Error("Tests require a dedicated local orionx_test database");
    process.env.DATABASE_URL = testUrl!;
    process.env.DIRECT_URL = testUrl!;
    process.env.ORIONX_SKIP_LISTEN = "1";
    process.env.NODE_ENV = "test";
    const pair = await generateKeyPair("ES256");
    privateKey = pair.privateKey;
    const publicKey = {
      ...(await exportJWK(pair.publicKey)),
      kid: "assessment-test",
      alg: "ES256",
      use: "sig",
    };
    jwks = createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ keys: [publicKey] }));
    });
    await new Promise<void>((r) => jwks.listen(0, "127.0.0.1", r));
    process.env.SUPABASE_URL = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}`;
    issuer = process.env.SUPABASE_URL + "/auth/v1";
    for (const name of ["AUTH_JWT_ISSUER", "SUPABASE_JWKS_URL", "WEB_ORIGIN"])
      delete process.env[name];
    ({ prisma: db } = await import("@orionx/db"));
    for (const id of ["student", "other"])
      await db.student.create({
        data: {
          id: `${prefix}-${id}`,
          externalId: `${prefix}-${id}`,
          email: `${prefix}-${id}@example.test`,
          firstName: "QA",
          lastName: id,
          program: "Assessment QA",
          educationLevel: "Test",
          status: "Active",
        },
      });
    for (const [sub, role, student] of [
      ["admin", "admin", null],
      ["student", "student", `${prefix}-student`],
      ["other", "student", `${prefix}-other`],
    ] as const)
      await db.studentIdentity.create({
        data: {
          provider: issuer,
          subject: `${prefix}-${sub}`,
          role,
          studentId: student,
          verifiedBy: "integration-test",
        },
      });
    async function token(sub: string) {
      return new SignJWT({ email: `${prefix}-${sub}@example.test` })
        .setProtectedHeader({ alg: "ES256", kid: "assessment-test" })
        .setIssuer(issuer)
        .setAudience("authenticated")
        .setSubject(`${prefix}-${sub}`)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
    }
    [adminToken, studentToken, otherToken, unlinkedToken] = await Promise.all(
      ["admin", "student", "other", "unlinked"].map(token),
    );
    const { createApp } = await import("./server");
    const app = await createApp();
    await app.listen(0, "127.0.0.1");
    api = app.getHttpServer();
    origin = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    if (db) {
      await db.assessmentAttempt.deleteMany({
        where: { studentId: { startsWith: prefix } },
      });
      await db.assessment.deleteMany({
        where: { createdBy: { startsWith: prefix } },
      });
      await db.auditEvent.deleteMany({
        where: { actorId: { startsWith: prefix } },
      });
      await db.studentIdentity.deleteMany({
        where: { subject: { startsWith: prefix } },
      });
      await db.studentWorkspace.deleteMany({
        where: { subject: { startsWith: prefix } },
      });
      await db.student.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.$disconnect();
    }
    if (api) await new Promise<void>((r) => api.close(() => r()));
    if (jwks) await new Promise<void>((r) => jwks.close(() => r()));
  });
  it("denies anonymous discovery and all student administration mutations", async () => {
    expect((await call("/assessments")).status).toBe(401);
    for (const path of [
      "/admin/assessments",
      "/admin/assessments/unknown/publish",
      "/admin/assessments/unknown/archive",
      "/admin/assessments/unknown/update",
    ])
      expect((await call(path, studentToken, {})).status).toBe(403);
    expect((await call("/admin/assessments", studentToken)).status).toBe(403);
    expect(
      (await call("/admin/assessments/unknown", studentToken)).status,
    ).toBe(403);
  });
  it("creates a private draft, validates it, and publishes through an audited administrator action", async () => {
    const invalid = await call("/admin/assessments", adminToken, {
      ...content,
      questions: [{ ...content.questions[0], correctOptionIds: ["unknown"] }],
    });
    expect(invalid.status).toBe(400);
    const created = await call("/admin/assessments", adminToken, content);
    expect(created.status).toBe(200);
    examId = created.body.id;
    expect(JSON.stringify(created.body)).not.toContain("correctOptionIds");
    expect((await call(`/assessments/${examId}`, studentToken)).status).toBe(
      404,
    );
    const draft = await call(`/admin/assessments/${examId}`, adminToken);
    expect(draft.body.questions[0].correctOptionIds).toEqual(["a"]);
    expect(
      (await call(`/admin/assessments/${examId}/update`, adminToken, content))
        .status,
    ).toBe(200);
    expect(
      (await call(`/admin/assessments/${examId}/publish`, adminToken, {}))
        .status,
    ).toBe(200);
    expect(
      (await call(`/admin/assessments/${examId}/update`, adminToken, content))
        .status,
    ).toBe(409);
    const detail = await call(`/assessments/${examId}`, studentToken);
    expect(detail.status).toBe(200);
    expect(detail.headers.get("cache-control")).toContain("no-store");
    expect(JSON.stringify(detail.body)).not.toContain("correctOptionIds");
    expect(
      await db.auditEvent.count({
        where: { targetId: examId, action: "ASSESSMENT_PUBLISHED" },
      }),
    ).toBe(1);
  });
  it("enforces student linkage and converges simultaneous starts on one persisted attempt", async () => {
    expect(
      (await call(`/assessments/${examId}/attempts`, unlinkedToken, {})).status,
    ).toBe(403);
    const starts = await Promise.all([
      call(`/assessments/${examId}/attempts`, studentToken, {}),
      call(`/assessments/${examId}/attempts`, studentToken, {}),
    ]);
    expect(starts.map((s) => s.status)).toEqual([200, 200]);
    expect(starts[0].body.id).toBe(starts[1].body.id);
    attemptId = starts[0].body.id;
    expect(JSON.stringify(starts[0].body)).not.toMatch(
      /correctOptionIds|createdBy/,
    );
    expect(
      await db.assessmentAttempt.count({
        where: { assessmentId: examId, studentId: `${prefix}-student` },
      }),
    ).toBe(1);
  });
  it("protects ownership, rejects malformed answers, saves progress, and detects stale tabs", async () => {
    expect(
      (await call(`/assessment-attempts/${attemptId}`, otherToken)).status,
    ).toBe(404);
    expect(
      (
        await call(`/assessment-attempts/${attemptId}/submit`, otherToken, {
          revision: 0,
          answers: {},
          flagged: [],
        })
      ).status,
    ).toBe(404);
    const invalid = await call(
      `/assessment-attempts/${attemptId}/save`,
      studentToken,
      { revision, answers: { q1: ["unknown"] }, flagged: [] },
    );
    expect(invalid.status).toBe(400);
    const saved = await call(
      `/assessment-attempts/${attemptId}/save`,
      studentToken,
      { revision, answers: { q1: ["a"] }, flagged: ["q2"] },
    );
    expect(saved.status).toBe(200);
    revision = saved.body.revision;
    const resumed = await call(
      `/assessment-attempts/${attemptId}`,
      studentToken,
    );
    expect(resumed.body.answers).toEqual({ q1: ["a"] });
    expect(resumed.body.flagged).toEqual(["q2"]);
    expect(
      (
        await call(`/assessment-attempts/${attemptId}/save`, studentToken, {
          revision: 0,
          answers: {},
          flagged: [],
        })
      ).status,
    ).toBe(409);
  });
  it("submits and grades once, enforces attempt limits, and never issues a credential", async () => {
    const credentialsBefore = await db.version.count();
    const body = {
      revision,
      answers: { q1: ["a"], q2: ["b", "a"] },
      flagged: [],
    };
    const submitted = await Promise.all([
      call(`/assessment-attempts/${attemptId}/submit`, studentToken, body),
      call(`/assessment-attempts/${attemptId}/submit`, studentToken, body),
    ]);
    expect(submitted.map((s) => s.status)).toEqual([200, 200]);
    for (const s of submitted)
      expect(s.body).toMatchObject({ scorePercent: 100, passed: true });
    const tamper = await call(
      `/assessment-attempts/${attemptId}/submit`,
      studentToken,
      { revision: 0, answers: {}, flagged: [] },
    );
    expect(tamper.body.scorePercent).toBe(100);
    expect(
      (await call(`/assessments/${examId}/attempts`, studentToken, {})).status,
    ).toBe(409);
    expect(await db.version.count()).toBe(credentialsBefore);
  });
  it("grades expired attempts from saved answers and rejects late selections", async () => {
    const start = await call(`/assessments/${examId}/attempts`, otherToken, {});
    const id = start.body.id;
    await db.assessmentAttempt.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000), answers: { q1: ["a"] } },
    });
    const expired = await call(
      `/assessment-attempts/${id}/submit`,
      otherToken,
      { revision: 0, answers: { q1: ["a"], q2: ["a", "b"] }, flagged: [] },
    );
    expect(expired.status).toBe(200);
    expect(expired.body).toMatchObject({ scorePercent: 50, passed: false });
    expect(expired.body.answers).toEqual({ q1: ["a"] });
  });
  it("blocks direct Data API roles and preserves records when archived", async () => {
    const privileges = await db.$queryRaw<
      { anon: boolean; authenticated: boolean; rls: boolean }[]
    >`SELECT has_table_privilege('anon', '"Assessment"', 'SELECT') AS anon, has_table_privilege('authenticated', '"AssessmentAttempt"', 'SELECT') AS authenticated, relrowsecurity AS rls FROM pg_class WHERE relname = 'Assessment'`;
    expect(privileges[0]).toEqual({
      anon: false,
      authenticated: false,
      rls: true,
    });
    await expect(
      db.assessmentAttempt.update({where: {id: attemptId}, data: {scorePercent: null}}),
    ).rejects.toThrow();
    expect(
      (await call(`/admin/assessments/${examId}/archive`, adminToken, {}))
        .status,
    ).toBe(200);
    expect((await call(`/assessments/${examId}`, studentToken)).status).toBe(
      404,
    );
    expect(
      (await call(`/assessment-attempts/${attemptId}`, studentToken)).body
        .scorePercent,
    ).toBe(100);
    expect(
      await db.assessmentAttempt.count({ where: { assessmentId: examId } }),
    ).toBe(2);
  });
});
