import {createHash, createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {createRemoteJWKSet, jwtVerify} from "jose";
import {prisma} from "@orionx/db";
import {supabaseAuthConfig} from "./config";
import {DomainError} from "./errors";

export type AuthenticatedSubject = {
  subject: string;
  provider: string;
  email?: string;
};

export type Identity = {
  subject: string;
  provider: string;
  role: "student" | "admin";
  studentId?: string;
  email?: string;
};

export type SessionStatus = {
  authenticated: true;
  authorized: boolean;
  subject: string;
  provider: string;
  role: "student" | "admin" | null;
  studentId?: string;
  email?: string;
};

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyJwt(authorization?: string): Promise<AuthenticatedSubject> {
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
  const {issuer, audience, jwksUrl} = supabaseAuthConfig();
  let jwks = keySets.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    keySets.set(jwksUrl, jwks);
  }
  try {
    const {payload} = await jwtVerify(token, jwks, {issuer, audience, algorithms: ["RS256", "ES256"]});
    if (typeof payload.sub !== "string" || !payload.sub.trim()) throw Error("Missing subject");
    const email = typeof payload.email === "string" && payload.email.length <= 254 ? payload.email : undefined;
    return {subject: payload.sub, provider: issuer, email};
  } catch {
    throw new DomainError("UNAUTHENTICATED", "Session expired or invalid", 401);
  }
}

export async function resolveSession(authorization?: string): Promise<SessionStatus> {
  const {subject, provider, email} = await verifyJwt(authorization);
  // Neither email, email domain nor browser/OAuth metadata grants access.
  const binding = await prisma.studentIdentity.findUnique({
    where: {provider_subject: {provider, subject}},
  });
  const isAdmin = binding?.role === "admin";
  const isStudent = binding?.role === "student" && Boolean(binding.studentId);
  if (!binding || (!isAdmin && !isStudent)) {
    return {authenticated: true, authorized: false, subject, provider, role: null, email};
  }
  return {
    authenticated: true,
    authorized: true,
    subject,
    provider,
    role: isAdmin ? "admin" : "student",
    studentId: isStudent ? binding.studentId || undefined : undefined,
    email,
  };
}

export async function authenticate(authorization?: string): Promise<Identity> {
  const session = await resolveSession(authorization);
  if (!session.authorized || !session.role) {
    throw new DomainError("IDENTITY_UNBOUND", "Account has no authorized passport binding", 403);
  }
  return {
    subject: session.subject,
    provider: session.provider,
    role: session.role,
    studentId: session.studentId,
    email: session.email,
  };
}

export function requireAdmin(identity: Identity) {
  if (identity.role !== "admin") throw new DomainError("FORBIDDEN", "Administrator authorization required", 403);
}

export function requireStudent(identity: Identity, ownerStudentId: string) {
  if (identity.role !== "admin" && identity.studentId !== ownerStudentId) {
    throw new DomainError("NOT_FOUND", "Passport not found", 404);
  }
}

export function sanitizeRedirectPath(input?: unknown, fallback = "/passport"): string {
  if (input === undefined || input === null || input === "") return fallback;
  if (typeof input !== "string" || input.length > 512) {
    throw new DomainError("INVALID_REDIRECT", "Invalid redirect target", 400);
  }
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\") || /[\r\n\0\\]/.test(input) || input.includes("://")) {
    throw new DomainError("INVALID_REDIRECT", "Redirect target must be a relative application path", 400);
  }
  let parsed: URL;
  try {
    parsed = new URL(input, "https://orionx.internal");
  } catch {
    throw new DomainError("INVALID_REDIRECT", "Invalid redirect target", 400);
  }
  if (parsed.origin !== "https://orionx.internal" || !parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//") || parsed.pathname.startsWith("/api/")) {
    throw new DomainError("INVALID_REDIRECT", "Redirect target must be an application page", 400);
  }
  return parsed.pathname + parsed.search;
}

function parseHttpOrigin(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DomainError("INVALID_ORIGIN", "Invalid origin URL", 400);
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
    throw new DomainError("INVALID_ORIGIN", "Origin must use HTTP(S)", 400);
  }
  return parsed.origin;
}

export function resolveAllowedWebOrigin(
  request: {origin?: string; protocol?: string; host?: string} = {},
  env: Record<string, string | undefined> = process.env,
): string {
  const allowed = new Set<string>();
  if (env.WEB_ORIGIN) allowed.add(parseHttpOrigin(env.WEB_ORIGIN));
  if (env.VERIFICATION_PUBLIC_ORIGIN) allowed.add(parseHttpOrigin(env.VERIFICATION_PUBLIC_ORIGIN));
  if (env.VERCEL_PROJECT_PRODUCTION_URL) allowed.add(parseHttpOrigin(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`));
  if (env.VERCEL_URL) allowed.add(parseHttpOrigin(`https://${env.VERCEL_URL}`));

  const isLocalHost = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const allowLocalDynamic = env.NODE_ENV !== "production" && env.VERCEL !== "1";
  const hostOrigin = request.host ? parseHttpOrigin(`${request.protocol || "https"}://${request.host}`) : undefined;

  const candidateRaw = request.origin || hostOrigin;
  if (candidateRaw) {
    const candidate = parseHttpOrigin(candidateRaw);
    const candidateHost = new URL(candidate).hostname;
    const sameHostOrigin = Boolean(hostOrigin && candidate === hostOrigin && !env.WEB_ORIGIN);
    if (
      allowed.has(candidate) ||
      sameHostOrigin ||
      (allowLocalDynamic && isLocalHost(candidateHost)) ||
      (allowed.size === 0 && isLocalHost(candidateHost))
    ) {
      return candidate;
    }
    if (request.origin) {
      throw new DomainError("INVALID_ORIGIN", "Request origin rejected", 403);
    }
  }

  const firstAllowed = allowed.values().next().value;
  if (firstAllowed) return firstAllowed;
  if (hostOrigin) return hostOrigin;
  if (allowLocalDynamic) return "http://localhost:3000";
  throw new DomainError("INVALID_ORIGIN", "Public web origin is not configured", 500);
}

export function createPkceChallenge() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  return {codeVerifier, codeChallenge, codeChallengeMethod: "s256" as const, state};
}

function deriveSigningKey(secret: string): Buffer {
  if (!secret || secret.length < 16) throw Error("OAuth state secret is not configured");
  return createHmac("sha256", secret).update("orionx-oauth-pkce-v1").digest();
}

export function sealOAuthState(
  params: {state: string; verifier: string; next?: string; ttlMs?: number},
  secret: string,
): string {
  const next = sanitizeRedirectPath(params.next, "/passport");
  const exp = Date.now() + (params.ttlMs ?? 10 * 60 * 1000);
  const payload = Buffer.from(
    JSON.stringify({v: 1, state: params.state, verifier: params.verifier, next, exp}),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", deriveSigningKey(secret)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function openOAuthState(
  cookieValue: string | undefined,
  expectedState: string | undefined,
  secret: string,
): {state: string; verifier: string; next: string} {
  if (!cookieValue || typeof cookieValue !== "string") {
    throw new DomainError("OAUTH_STATE_INVALID", "OAuth session missing or expired; please try signing in again", 400);
  }
  const parts = cookieValue.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new DomainError("OAUTH_STATE_INVALID", "Invalid OAuth state cookie", 400);
  }
  const [payloadB64, signatureB64] = parts;
  const expectedSig = createHmac("sha256", deriveSigningKey(secret)).update(payloadB64).digest("base64url");
  if (!safeEqualString(signatureB64, expectedSig)) {
    throw new DomainError("OAUTH_STATE_INVALID", "Invalid OAuth state signature", 400);
  }
  let parsed: {v?: number; state?: unknown; verifier?: unknown; next?: unknown; exp?: unknown};
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new DomainError("OAUTH_STATE_INVALID", "Malformed OAuth state payload", 400);
  }
  if (
    parsed.v !== 1 ||
    typeof parsed.state !== "string" ||
    !parsed.state ||
    typeof parsed.verifier !== "string" ||
    parsed.verifier.length < 43 ||
    typeof parsed.exp !== "number" ||
    parsed.exp <= Date.now()
  ) {
    throw new DomainError("OAUTH_STATE_INVALID", "OAuth session expired; please sign in again", 400);
  }
  if (expectedState !== undefined && expectedState !== "" && !safeEqualString(parsed.state, expectedState)) {
    throw new DomainError("OAUTH_STATE_INVALID", "OAuth state mismatch", 400);
  }
  return {
    state: parsed.state,
    verifier: parsed.verifier,
    next: sanitizeRedirectPath(parsed.next, "/passport"),
  };
}

export function buildGoogleAuthorizeUrl(params: {
  supabaseOrigin: string;
  redirectUri: string;
  codeChallenge: string;
}): string {
  const url = new URL("/auth/v1/authorize", params.supabaseOrigin);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", params.redirectUri);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("scopes", "openid email profile");
  return url.toString();
}

export async function bindIdentity(params: {
  subject: string;
  role: "student" | "admin";
  studentExternalId?: string;
  studentId?: string;
  verifiedBy: string;
  provider?: string;
}) {
  const subject = params.subject?.trim();
  const verifiedBy = params.verifiedBy?.trim();
  if (!subject || subject.includes("@") || subject.length > 128) {
    throw new DomainError("INVALID_SUBJECT", "Identity binding requires an immutable provider subject ID, never an email", 400);
  }
  if (!verifiedBy) {
    throw new DomainError("INVALID_REQUEST", "verifiedBy actor is required", 400);
  }
  if (!["student", "admin"].includes(params.role)) {
    throw new DomainError("INVALID_REQUEST", "Role must be student or admin", 400);
  }
  const provider = params.provider || supabaseAuthConfig().issuer;
  let resolvedStudentId: string | null = null;
  if (params.role === "student") {
    const student = params.studentId
      ? await prisma.student.findUnique({where: {id: params.studentId}})
      : params.studentExternalId
        ? await prisma.student.findUnique({where: {externalId: params.studentExternalId}})
        : null;
    if (!student) {
      throw new DomainError("NOT_FOUND", "Student record not found for identity binding", 404);
    }
    resolvedStudentId = student.id;
  }
  const [binding] = await prisma.$transaction([
    prisma.studentIdentity.upsert({
      where: {provider_subject: {provider, subject}},
      create: {provider, subject, role: params.role, studentId: resolvedStudentId, verifiedBy},
      update: {role: params.role, studentId: resolvedStudentId, verifiedBy, verifiedAt: new Date()},
    }),
    prisma.auditEvent.create({
      data: {
        actorId: verifiedBy,
        action: "IDENTITY_BOUND",
        targetId: subject,
        detail: {provider, role: params.role, studentId: resolvedStudentId, studentExternalId: params.studentExternalId || null},
      },
    }),
  ]);
  return binding;
}
