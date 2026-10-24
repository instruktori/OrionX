import {createRemoteJWKSet, jwtVerify} from "jose";
import {prisma} from "@orionx/db";
import {supabaseAuthConfig} from "./config";
import {DomainError} from "./errors";
export type Identity = {subject: string; provider: string; role: "student" | "admin"; studentId?: string};
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(authorization?: string): Promise<Identity> {
 const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
 if (!token) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
 const {issuer, audience, jwksUrl} = supabaseAuthConfig();
 let jwks = keySets.get(jwksUrl);
 if (!jwks) { jwks = createRemoteJWKSet(new URL(jwksUrl)); keySets.set(jwksUrl, jwks); }
 let subject: string;
 try { const {payload} = await jwtVerify(token, jwks, {issuer, audience, algorithms: ["RS256", "ES256"]}); if (!payload.sub) throw Error(); subject = payload.sub; }
 catch { throw new DomainError("UNAUTHENTICATED", "Session expired or invalid", 401); }
 // Neither email, email domain nor browser-editable metadata grants access.
 const binding = await prisma.studentIdentity.findUnique({where: {provider_subject: {provider: issuer, subject}}});
 if (!binding || !["student", "admin"].includes(binding.role)) throw new DomainError("IDENTITY_UNBOUND", "Account has no authorized passport binding", 403);
 return {subject, provider: issuer, role: binding.role as Identity["role"], studentId: binding.studentId || undefined};
}
export function requireAdmin(identity: Identity) { if (identity.role !== "admin") throw new DomainError("FORBIDDEN", "Administrator authorization required", 403); }
export function requireStudent(identity: Identity, ownerStudentId: string) { if (identity.role !== "admin" && identity.studentId !== ownerStudentId) throw new DomainError("NOT_FOUND", "Passport not found", 404); }
