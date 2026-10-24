import {createRemoteJWKSet,jwtVerify} from "jose";
import {supabaseAuthConfig} from "./config";
export type Identity={subject:string;email:string;role:"student"|"admin";studentId?:string};
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(authorization?:string):Promise<Identity>{const token=authorization?.match(/^Bearer (\S+)$/i)?.[1];if(!token)throw Error("Missing bearer token");const {issuer,audience,jwksUrl}=supabaseAuthConfig();let jwks=keySets.get(jwksUrl);if(!jwks){jwks=createRemoteJWKSet(new URL(jwksUrl));keySets.set(jwksUrl,jwks)}const {payload}=await jwtVerify(token,jwks,{issuer,audience,algorithms:["RS256","ES256"]});if(!payload.sub||typeof payload.email!=="string")throw Error("Missing verified identity");const role=payload.app_metadata&&typeof payload.app_metadata==="object"&&(payload.app_metadata as Record<string,unknown>).orionx_role==="admin"?"admin":"student";return {subject:payload.sub,email:payload.email.toLowerCase(),role}}
export function requireAdmin(identity:Identity){if(identity.role!=="admin")throw Error("Administrator authorization required")}
export function requireStudent(identity:Identity,ownerEmail:string){if(identity.role!=="admin"&&identity.email!==ownerEmail.toLowerCase())throw Error("Not authorized for this passport")}
