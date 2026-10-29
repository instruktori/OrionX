import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, cp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {spawn, spawnSync, type ChildProcess} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import {randomBytes} from "node:crypto";
import {Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction} from "@solana/web3.js";
import {PrismaClient} from "@prisma/client";
import {configAddress, epochAddress, revocationAddress, discriminator} from "../packages/core/src/protocol";

async function main() {
 const configured=process.env.DATABASE_URL;
 if(process.env.ORIONX_ISOLATED_TEST!=="1" || !configured || !["localhost","127.0.0.1"].includes(new URL(configured).hostname)) throw Error("Requires ORIONX_ISOLATED_TEST=1 and a disposable loopback PostgreSQL database. Never runs on Devnet or hosted databases.");
 const temp=await mkdtemp(resolve(tmpdir(),"orionx-revocation-")),schema="revocation_"+randomBytes(6).toString("hex");
 const db=new PrismaClient({datasourceUrl:configured});
 const admin=Keypair.generate(),issuer=Keypair.generate(),attacker=Keypair.generate();
 const program=new PublicKey("9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa");
 let appDb:PrismaClient|undefined;
 let validator:ChildProcess|undefined,worker:ChildProcess|undefined,validatorLog="";
 const wait=async(test:()=>Promise<boolean>,label:string,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await test())return;await delay(250);}throw Error("Timed out: "+label+"\n"+validatorLog.slice(-3000));};
 try {
  // Compile an isolated copy with an ephemeral local bootstrap authority. Production source is untouched.
  await cp("programs",resolve(temp,"programs"),{recursive:true});await cp("Cargo.toml",resolve(temp,"Cargo.toml"));await cp("Cargo.lock",resolve(temp,"Cargo.lock"));
  const rust=resolve(temp,"programs/passport-registry/src/lib.rs");await writeFile(rust,(await readFile(rust,"utf8")).replace('pubkey!("BNcEvP3benzCX7tc1W2U6upZ5HVT4hzneZahVKMpCPiv")',`pubkey!("${admin.publicKey.toBase58()}")`));
  const build=spawnSync("cargo-build-sbf",["--tools-version","v1.57","--arch","v0","--manifest-path",resolve(temp,"programs/passport-registry/Cargo.toml"),"--sbf-out-dir",resolve(temp,"deploy")],{stdio:"inherit",env:process.env});
  if(build.status!==0)throw Error("Isolated SBF build failed");
  validator=spawn(process.env.SOLANA_TEST_VALIDATOR_BIN || "solana-test-validator",["--reset","--quiet","--ledger",resolve(temp,"ledger"),"--rpc-port","18899","--faucet-port","18999","--gossip-port","18001","--dynamic-port-range","18002-18102","--bpf-program",program.toBase58(),resolve(temp,"deploy/passport_registry.so")],{stdio:["ignore","pipe","pipe"]});
  validator.stdout?.on("data",b=>validatorLog+=b);validator.stderr?.on("data",b=>validatorLog+=b);
  const connection=new Connection("http://127.0.0.1:18899","finalized");
  await wait(async()=>{if(validator?.exitCode != null)throw Error("Validator exited: "+validatorLog);try{return !!await connection.getGenesisHash();}catch{return false;}},"local validator",60000);
  const database=new URL(configured);database.searchParams.set("schema",schema);
  Object.assign(process.env,{DATABASE_URL:database.toString(),DIRECT_URL:database.toString(),NODE_ENV:"test",APP_ENV:"test",CHAIN_MODE:"local",SOURCE_MODE:"fixture",STORAGE_MODE:"local",ARTIFACT_DIRECTORY:resolve(temp,"pdfs"),SOLANA_RPC_URL:"http://127.0.0.1:18899",SOLANA_EXPECTED_GENESIS_HASH:await connection.getGenesisHash(),SOLANA_PROGRAM_ID:program.toBase58(),SOLANA_ISSUER_KEYPAIR_JSON:JSON.stringify([...issuer.secretKey]),ISSUER_TRUST_MODE:"DEMO",REVOCATION_ENABLED:"true",WORKER_POLL_MS:"200",WORKER_LEASE_MS:"5000",SYNC_ENABLED:"true",SYNC_POLL_MS:"1000",ORIONX_RESOURCE_ROOT:temp});
  delete process.env.SOLANA_EXPECTED_ISSUER;delete process.env.VERCEL;delete process.env.WORKER_HOSTED;
  const migrations=["0001_architecture","0002_proof_context","0003_student_workspace","0004_assessments","0005_revocation"];
  const sql=await Promise.all(migrations.map(async m=>(await readFile(`packages/db/prisma/migrations/${m}/migration.sql`,"utf8")).replaceAll("public.",`"${schema}".`)));
  const roles="DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;";
  await writeFile(resolve(temp,"setup.sql"),roles+`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";\n`+sql.join("\n"));
  const setup=spawnSync(process.execPath,["node_modules/prisma/build/index.js","db","execute","--schema","packages/db/prisma/schema.prisma","--file",resolve(temp,"setup.sql")],{env:process.env,stdio:"inherit"});if(setup.status!==0)throw Error("Isolated migrations failed");
  const {prisma}=await import("../packages/db/src");appDb=prisma;
  const {fixtureRows}=await import("../packages/core/src/fixtures");
  const {artifactStore,verifyDevnet,sha256,decodeCode}=await import("../packages/core/src/index");
  const {requestRevocation,requestCorrection}=await import("../packages/core/src/revocation");
  const {createJobProcessor}=await import("../packages/core/src/processor");
  const {broadcast}=await import("../packages/core/src/chain-issuer");
  const {versionAddress}=await import("../packages/core/src/protocol");
  // A tiny copy of the canonical fixture adapter drives REAL unattended polling and issuance.
  await mkdir(resolve(temp,"fixtures"));await cp("fixtures/students.csv",resolve(temp,"fixtures/students.csv"));await cp("fixtures/skills.csv",resolve(temp,"fixtures/skills.csv"));
  const all=(await readFile("fixtures/awards.csv","utf8")).trim().split("\n"),header=all[0];
  const initial=all.slice(1).filter(l=>l.split(",")[2]==="BTU-T-0001").slice(0,2);
  await writeFile(resolve(temp,"fixtures/awards.csv"),[header,...initial].join("\n")+"\n");
  for(const who of [admin,issuer,attacker]) {const sig=await connection.requestAirdrop(who.publicKey,5e9);await connection.confirmTransaction(sig,"finalized");}
  const ro=(pubkey:PublicKey)=>({pubkey,isSigner:false,isWritable:false}),rw=(pubkey:PublicKey)=>({...ro(pubkey),isWritable:true});
  const init=new TransactionInstruction({programId:program,keys:[{pubkey:admin.publicKey,isSigner:true,isWritable:true},rw(configAddress(program)[0]),rw(epochAddress(program,configAddress(program)[0],1)[0]),ro(SystemProgram.programId)],data:Buffer.concat([discriminator("global","initialize_issuer"),issuer.publicKey.toBuffer(),Buffer.alloc(32)])});
  await sendAndConfirmTransaction(connection,new Transaction().add(init),[admin],{commitment:"finalized"});
  const startWorker=()=>{const p=spawn(process.execPath,["--import","tsx","apps/worker/src/worker.ts"],{env:process.env,stdio:["ignore","pipe","pipe"]});p.stderr?.on("data",b=>validatorLog+=b);return p;};
  worker=startWorker();
  await wait(async()=>await prisma.version.count({where:{number:1,state:"COMPLETED"}})===1,"automatic initial issuance");
  const added=initial[0].split(",");added[0]="100";added[1]="ISOLATED-NEW-AWARD";added[5]="NOT SYNCED";added[6]="";added[7]="";
  await writeFile(resolve(temp,"fixtures/awards.csv"),[header,...initial,added.join(",")].join("\n")+"\n");
  await wait(async()=>await prisma.version.count({where:{number:2,state:"COMPLETED"}})===1,"automatic source change issuance");
  worker.kill("SIGTERM");await new Promise(r=>worker!.once("exit",r));worker=undefined;
  assert.equal(await prisma.version.count(),2);
  const v1=await prisma.version.findFirstOrThrow({where:{number:1}}),v2=await prisma.version.findFirstOrThrow({where:{number:2}});
  const before=await connection.getAccountInfo(new PublicKey(v2.versionPda!),"finalized"),bytes=await artifactStore().get(v2.storageKey!);
  assert.equal((await verifyDevnet(v2.code,bytes)).integrity,"MATCH");assert.equal((await verifyDevnet(v1.code)).currency,"SUPERSEDED");
  const user={subject:"isolated-admin",provider:"test",role:"admin" as const,verification:"ADMIN" as const};
  await assert.rejects(()=>requestRevocation({...user,role:"student"},v2.passportId,2,"wrong award"));
  const unauthorized=new TransactionInstruction({programId:program,keys:[{pubkey:attacker.publicKey,isSigner:true,isWritable:true},ro(configAddress(program)[0]),ro(new PublicKey((await verifyDevnet(v2.code)).chainEvidence!.registryPda)),ro(new PublicKey(v2.versionPda!)),rw(revocationAddress(program,new PublicKey(v2.versionPda!))[0]),ro(SystemProgram.programId)],data:Buffer.concat([discriminator("global","revoke_version"),Buffer.alloc(32,1),Buffer.alloc(32,2)])});
  await assert.rejects(()=>sendAndConfirmTransaction(connection,new Transaction().add(unauthorized),[attacker],{commitment:"finalized"}));
  const requests=await Promise.all([1,2].map(()=>requestRevocation(user,v2.passportId,2,"incorrect award",["ISOLATED-NEW-AWARD"])));assert.equal(requests[0].id,requests[1].id);assert.equal(await prisma.revocation.count(),1);
  await assert.rejects(()=>requestRevocation(user,v2.passportId,2,"conflicting reason"));
  const processor=createJobProcessor();
  // Persisted intent + unavailable chain must NEVER become REVOKED.
  const rpc=process.env.SOLANA_RPC_URL;process.env.SOLANA_RPC_URL="http://127.0.0.1:1";
  await processor.processNext();assert.notEqual((await prisma.revocation.findUniqueOrThrow({where:{versionId:v2.id}})).state,"REVOKED");process.env.SOLANA_RPC_URL=rpc;
  await prisma.job.update({where:{idempotencyKey:"revoke:"+v2.id},data:{availableAt:new Date()}});
  await wait(async()=>{await processor.processNext();return await prisma.revocationAttempt.count()===1;},"durable signed revocation attempt");
  const attempt=await prisma.revocationAttempt.findFirstOrThrow();assert.equal(attempt.state,"SIGNED");
  // Simulate chain success followed by process death before the SQL completion commit.
  await broadcast(attempt);
  await wait(async()=>(await verifyDevnet(v2.code,bytes)).revocation==="REVOKED","revocation finality");
  assert.equal((await prisma.revocation.findUniqueOrThrow({where:{versionId:v2.id}})).state,"PENDING");
  const restarted=createJobProcessor();
  await wait(async()=>{await restarted.processNext();return (await prisma.revocation.findUniqueOrThrow({where:{versionId:v2.id}})).state==="REVOKED";},"post-crash reconciliation");
  assert.equal(await prisma.revocationAttempt.count(),1);assert.equal((await verifyDevnet(v2.code,bytes)).integrity,"MATCH");assert.equal((await verifyDevnet(v1.code)).revocation,"VALID");
  assert.deepEqual((await connection.getAccountInfo(new PublicKey(v2.versionPda!),"finalized"))!.data,before!.data);assert.equal(sha256(await artifactStore().get(v2.storageKey!)),v2.pdfSha256);
  assert.equal((await requestRevocation(user,v2.passportId,2,"incorrect award",["ISOLATED-NEW-AWARD"])).state,"REVOKED");
  const corrected=await requestCorrection(user,v2.passportId);
  assert.equal(corrected.number,3);assert.equal((corrected.snapshot as {awards:{recordId:string}[]}).awards.some(a=>a.recordId==="ISOLATED-NEW-AWARD"),false);
  await wait(async()=>{await restarted.processNext();return (await prisma.version.findUniqueOrThrow({where:{id:corrected.id}})).state==="COMPLETED";},"corrected finalized issuance");
  assert.equal((await verifyDevnet(corrected.code)).currency,"LATEST");assert.equal((await verifyDevnet(v2.code)).revocation,"REVOKED");
  console.log("PASS isolated local SBF + PostgreSQL: unattended fixture polling, duplicate prevention, unauthorized revocation rejection, idempotency, RPC failure, persisted signed attempt, post-chain crash recovery, immutable evidence, corrected issuance excluding withdrawn awards.");
  console.log("NOT EXERCISED: hosted worker activation, live Google Sheets, Devnet program upgrade or live revoked fixture.");
  await prisma.$disconnect();
 } finally {
  worker?.kill("SIGTERM");validator?.kill("SIGTERM");
  await appDb?.$disconnect();
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(e=>console.error("Isolated database cleanup:",e.message));await db.$disconnect();
  await rm(temp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
