import {describe,it,expect,vi,afterEach} from "vitest";
import {revocationCommitments,requestRevocation,requestCorrection} from "./revocation";
import type {Identity} from "./auth";
const user: Identity={subject:"test",provider:"isolated",role:"student",verification:"UNIVERSITY_VERIFIED"};
afterEach(()=>vi.unstubAllEnvs());
describe("revocation request boundaries",()=>{
 it("requires admin authorization even in direct service calls",async()=>{await expect(requestRevocation(user,"p",1,"reason")).rejects.toMatchObject({code:"FORBIDDEN"});await expect(requestCorrection(user,"p")).rejects.toMatchObject({code:"FORBIDDEN"});});
 it("rejects empty reasons before touching a database",async()=>{await expect(requestRevocation({...user,role:"admin"},"p",1,"  ")).rejects.toMatchObject({code:"INVALID_REQUEST"});});
 it("cannot activate through an API call",async()=>{vi.stubEnv("REVOCATION_ENABLED","false");await expect(requestRevocation({...user,role:"admin"},"p",1,"reason")).rejects.toMatchObject({code:"REVOCATION_DISABLED"});});
 it("salts private reason/actor commitments and binds them to the version",()=>{const a=revocationCommitments("private reason","actor","v1"),b=revocationCommitments("private reason","actor","v1");expect(a.reasonDigest).not.toBe(b.reasonDigest);expect(a.actorDigest).not.toBe(b.actorDigest);expect(revocationCommitments("private reason","actor","v2",a.nonce).reasonDigest).not.toBe(a.reasonDigest);expect(JSON.stringify(a)).not.toContain("private reason");});
});
