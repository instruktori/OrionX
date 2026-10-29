import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve, dirname} from "node:path";
import {createServer} from "node:http";
import {PublicKey} from "@solana/web3.js";
import {verifyDevnet} from "../packages/core/src/solana";
import {sha256, encodeCode} from "../packages/core/src/index";
import {DEVNET_GENESIS} from "../packages/core/src/protocol";
type Fixture = {code: string; pdf: string; sha256: string; version: number};
async function main() {
 const path = resolve(process.env.LIVE_VERIFICATION_MANIFEST || "fixtures/verification/devnet.json");
 const manifest = JSON.parse(await readFile(path,"utf8")) as {programId:string;issuer:string;current:Fixture;historical:Fixture;revoked:Fixture|null;revokedFixtureBlocker:string};
 Object.assign(process.env,{CHAIN_MODE:"devnet",SOLANA_PROGRAM_ID:manifest.programId,SOLANA_EXPECTED_ISSUER:manifest.issuer,SOLANA_EXPECTED_GENESIS_HASH:DEVNET_GENESIS,ISSUER_TRUST_MODE:"DEMO"});
 const bytes = async (f: Fixture) => {const b=await readFile(resolve(dirname(path),f.pdf));assert.equal(sha256(b),f.sha256,"Fixture bytes changed");return b;};
 const current=await bytes(manifest.current),historical=await bytes(manifest.historical);
 let p=await verifyDevnet(manifest.current.code,current);
 assert.equal(p.registration,"REGISTERED",JSON.stringify(p));assert.equal(p.integrity,"MATCH");assert.equal(p.revocation,"VALID");assert.equal(p.currency,"LATEST");assert.equal(p.version,manifest.current.version);assert.equal(p.officialBtu,false);
 const modified=Buffer.from(current);modified[modified.length-10]^=1;
 p=await verifyDevnet(manifest.current.code,modified);assert.equal(p.integrity,"MISMATCH");
 p=await verifyDevnet(manifest.historical.code,historical);assert.equal(p.integrity,"MATCH");assert.equal(p.currency,"SUPERSEDED");assert.equal(p.revocation,"VALID");
 assert.equal((await verifyDevnet(encodeCode(Buffer.alloc(20,255)))).errorCode,"UNKNOWN_CODE");
 process.env.SOLANA_EXPECTED_GENESIS_HASH="incorrect-network";assert.equal((await verifyDevnet(manifest.current.code)).errorCode,"WRONG_CLUSTER");process.env.SOLANA_EXPECTED_GENESIS_HASH=DEVNET_GENESIS;
 process.env.SOLANA_EXPECTED_ISSUER=PublicKey.default.toBase58();assert.equal((await verifyDevnet(manifest.current.code)).errorCode,"WRONG_ISSUER");process.env.SOLANA_EXPECTED_ISSUER=manifest.issuer;
 process.env.SOLANA_PROGRAM_ID=PublicKey.default.toBase58();assert.equal((await verifyDevnet(manifest.current.code)).registration,"UNKNOWN");process.env.SOLANA_PROGRAM_ID=manifest.programId;
 if (manifest.revoked) {
  const b=await bytes(manifest.revoked);p=await verifyDevnet(manifest.revoked.code,b);assert.equal(p.revocation,"REVOKED");assert.equal(p.integrity,"MATCH");assert.equal(p.errorCode,"CREDENTIAL_REVOKED");
  console.log("PASS live cases 6–7: revoked; byte-identical revoked PDF remains MATCH");
 } else if (process.argv.includes("--allow-pending-revoked-fixture")) {
  console.log("::warning::Live cases 6–7 NOT EXERCISED: " + manifest.revokedFixtureBlocker);
 } else throw Error("Live cases 6–7 blocked: " + manifest.revokedFixtureBlocker);
 // Deterministic unavailable endpoint; no secret or external fault injection required.
 const unavailable=createServer((_req,res)=>{res.writeHead(503);res.end("Synthetic RPC outage");});
 await new Promise<void>(r=>unavailable.listen(0,"127.0.0.1",r));
 const originalRpc=process.env.SOLANA_RPC_URL;
 try {process.env.SOLANA_RPC_URL=`http://127.0.0.1:${(unavailable.address() as {port:number}).port}`;assert.equal((await verifyDevnet(manifest.current.code,current)).errorCode,"RPC_UNAVAILABLE");}
 finally {process.env.SOLANA_RPC_URL=originalRpc;await new Promise<void>(r=>unavailable.close(()=>r()));}
 console.log("PASS read-only live Devnet cases 1–5 and explicit unavailable-RPC case 8. No signing keys used.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
