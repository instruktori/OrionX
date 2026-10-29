import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi} from "vitest";
import {Keypair, PublicKey} from "@solana/web3.js";
import {verifyDevnet} from "./solana";
import {encodeCode, sha256} from "./index";
import {DEVNET_GENESIS, discriminator, configAddress, epochAddress, registryAddress, versionAddress, revocationAddress, parseRevocation} from "./protocol";
const program = new PublicKey("9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa");
const issuer = Keypair.fromSeed(Buffer.alloc(32, 8)).publicKey, admin = Keypair.fromSeed(Buffer.alloc(32, 9)).publicKey;
const [config, cb] = configAddress(program), [epoch, eb] = epochAddress(program, config, 1);
const [registry, rb] = registryAddress(program, config, Buffer.alloc(32, 4));
const raw1 = Buffer.alloc(20, 1), raw2 = Buffer.alloc(20, 2), code1 = encodeCode(raw1), code2 = encodeCode(raw2);
const [v1, b1] = versionAddress(program, raw1), [v2, b2] = versionAddress(program, raw2);
const [revokedAddress, vb] = revocationAddress(program, v2);
const pdf = Buffer.from("%PDF-1.7\nSYNTHETIC FIXTURE ONLY\n%%EOF");
let server: Server, origin: string, accounts = new Map<string, Buffer>(), rpcFailed = false, revocationReadFailed = false;
const account = (name: string, size: number, bump: number) => {const b = Buffer.alloc(size); discriminator("account", name).copy(b); b[8] = 1; b[size-1] = bump; return b;};
const key = (b: Buffer, offset: number, p: PublicKey) => p.toBuffer().copy(b, offset);
function revoked() {
 const b = account("RevocationRecord", 158, vb); key(b,9,v2); key(b,41,issuer); b.writeUInt32LE(1,73); Buffer.alloc(32,5).copy(b,77); Buffer.alloc(32,6).copy(b,109); b.writeBigInt64LE(40n,141); b.writeBigUInt64LE(50n,149); accounts.set(revokedAddress.toBase58(),b); return b;
}
beforeAll(async () => {
 server = createServer(async (req,res) => {
  let raw=""; for await (const chunk of req) raw+=chunk;
  const body = JSON.parse(raw);
  const address=body.params?.[0];
  if (rpcFailed || (revocationReadFailed && address===revokedAddress.toBase58())) {res.writeHead(503); res.end("RPC unavailable"); return;}
  let result: unknown;
  if (body.method === "getGenesisHash") result = DEVNET_GENESIS;
  else if (body.method === "getAccountInfo") {
   const data=accounts.get(address);
   const value=address===program.toBase58()?{data:["","base64"],executable:true,owner:PublicKey.default.toBase58(),lamports:1,rentEpoch:0}:data?{data:[data.toString("base64"),"base64"],executable:false,owner:program.toBase58(),lamports:1,rentEpoch:0}:null;
   result={context:{slot:100},value};
  } else {res.writeHead(400);res.end("Unexpected RPC method");return;}
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id:body.id,result}));
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{
 vi.stubEnv("SOLANA_PROGRAM_ID",program.toBase58());vi.stubEnv("SOLANA_EXPECTED_GENESIS_HASH",DEVNET_GENESIS);vi.stubEnv("SOLANA_RPC_URL",origin);vi.stubEnv("CHAIN_MODE","devnet");vi.stubEnv("ISSUER_TRUST_MODE","DEMO");vi.stubEnv("SOLANA_EXPECTED_ISSUER",issuer.toBase58());
 rpcFailed=false;revocationReadFailed=false;accounts=new Map();
 const c=account("IssuerConfig",79,cb);key(c,9,admin);key(c,41,issuer);c.writeUInt32LE(1,73);accounts.set(config.toBase58(),c);
 const e=account("IssuerEpoch",126,eb);key(e,9,config);e.writeUInt32LE(1,41);key(e,45,issuer);e.writeBigUInt64LE(1n,77);e.writeBigInt64LE(1n,85);accounts.set(epoch.toBase58(),e);
 const r=account("PassportRegistry",110,rb);key(r,9,config);Buffer.alloc(32,4).copy(r,41);r.writeUInt32LE(2,73);key(r,77,v2);accounts.set(registry.toBase58(),r);
 for(const [address,raw,bump,number,previous] of [[v1,raw1,b1,1,PublicKey.default],[v2,raw2,b2,2,v1]] as const){
  const v=account("VersionRecord",182,bump);key(v,9,registry);v.writeUInt32LE(number,41);raw.copy(v,45);Buffer.from(sha256(pdf),"hex").copy(v,65);key(v,97,issuer);v.writeUInt32LE(1,129);key(v,133,previous);v.writeBigInt64LE(BigInt(number*10),165);v.writeBigUInt64LE(BigInt(number*10),173);accounts.set(address.toBase58(),v);
 }
});
describe("independent finalized RPC verification (synthetic loopback, no database or OrionX API)",()=>{
 it("validates current bytes, version, issuer and network",async()=>{const p=await verifyDevnet(code2,pdf);expect(p).toMatchObject({registration:"REGISTERED",integrity:"MATCH",currency:"LATEST",revocation:"VALID",version:2,officialBtu:false,issuerTrust:"DEMO"});});
 it("rejects one-byte tampering",async()=>{const b=Buffer.from(pdf);b[8]^=1;expect(await verifyDevnet(code2,b)).toMatchObject({integrity:"MISMATCH",errorCode:"DOCUMENT_TAMPERED"});});
 it("proves historical lineage independently",async()=>expect(await verifyDevnet(code1,pdf)).toMatchObject({integrity:"MATCH",currency:"SUPERSEDED",revocation:"VALID"}));
 it("rejects unknown codes and malformed input",async()=>{expect((await verifyDevnet(encodeCode(Buffer.alloc(20,7)))).errorCode).toBe("UNKNOWN_CODE");expect((await verifyDevnet("bad")).errorCode).toBe("INVALID_CODE");});
 it("rejects wrong network and issuer",async()=>{vi.stubEnv("SOLANA_EXPECTED_GENESIS_HASH","wrong");expect((await verifyDevnet(code2)).errorCode).toBe("WRONG_CLUSTER");vi.stubEnv("SOLANA_EXPECTED_GENESIS_HASH",DEVNET_GENESIS);vi.stubEnv("SOLANA_EXPECTED_ISSUER",admin.toBase58());expect((await verifyDevnet(code2)).errorCode).toBe("WRONG_ISSUER");});
 it("revoked byte-identical documents are revoked with MATCH integrity",async()=>{revoked();expect(await verifyDevnet(code2,pdf)).toMatchObject({registration:"REGISTERED",integrity:"MATCH",revocation:"REVOKED",errorCode:"CREDENTIAL_REVOKED",officialBtu:false});expect((await verifyDevnet(code1,pdf)).revocation).toBe("VALID");});
 it("keeps tamper and revocation evidence separate",async()=>{revoked();expect(await verifyDevnet(code2,Buffer.from("modified"))).toMatchObject({integrity:"MISMATCH",revocation:"REVOKED"});});
 it("does not promote older credentials when latest is revoked",async()=>{revoked();expect((await verifyDevnet(code1,pdf)).currency).toBe("SUPERSEDED");expect((await verifyDevnet(code2,pdf)).currency).toBe("LATEST");});
 it("rejects an unauthorized revocation authority",async()=>{const r=revoked();key(r,41,Keypair.generate().publicKey);expect((await verifyDevnet(code2,pdf)).errorCode).toBe("INVALID_PROOF");});
 it("fails closed if the RPC or revocation read fails",async()=>{rpcFailed=true;expect(await verifyDevnet(code2,pdf)).toMatchObject({registration:"UNKNOWN",revocation:"UNKNOWN",errorCode:"RPC_UNAVAILABLE"});rpcFailed=false;revocationReadFailed=true;expect((await verifyDevnet(code2,pdf)).registration).toBe("UNKNOWN");});
 it("handles a malformed RPC URL safely",async()=>{vi.stubEnv("SOLANA_RPC_URL","not-a-url");expect((await verifyDevnet(code2,pdf)).errorCode).toBe("RPC_UNAVAILABLE");});
 it("rejects a wrong program and malformed revocation layout",async()=>{vi.stubEnv("SOLANA_PROGRAM_ID",admin.toBase58());expect((await verifyDevnet(code2,pdf)).registration).toBe("UNKNOWN");expect(()=>parseRevocation(Buffer.alloc(158))).toThrow();});
});
