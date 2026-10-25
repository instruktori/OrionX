import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {spawn,spawnSync,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {Connection,Keypair,PublicKey,SystemProgram,Transaction,TransactionInstruction,sendAndConfirmTransaction} from '@solana/web3.js';
import {supabaseAuthServiceConfig} from '../packages/core/src/config';

async function main(){
 const devnet=process.argv.includes('--devnet');
 if(devnet && process.env.CHAIN_MODE!=='devnet')throw Error('Devnet acceptance requires CHAIN_MODE=devnet');
 const schema='orionx_test_'+randomBytes(5).toString('hex');
 const originalUrl=process.env.DATABASE_URL!, directUrl=process.env.DIRECT_URL||originalUrl;
 if(!originalUrl)throw Error('Configured database required');
 const adminDb=new PrismaClient({datasourceUrl:directUrl});
 const runtime=new URL(originalUrl);runtime.searchParams.set('schema',schema);
 const direct=new URL(directUrl);direct.searchParams.set('schema',schema);
 const migration=(await readFile('packages/db/prisma/migrations/0001_architecture/migration.sql','utf8')).replaceAll('public.', '"'+schema+'".');
 const proofSql=(await readFile('packages/db/prisma/migrations/0002_proof_context/migration.sql','utf8')).split('\n')[0];
 const workspaceSql=await readFile('packages/db/prisma/migrations/0003_student_workspace/migration.sql','utf8');
 const sqlPath='/tmp/'+schema+'.sql';await writeFile(sqlPath,'CREATE SCHEMA IF NOT EXISTS "'+schema+'"; SET search_path TO "'+schema+'";\n'+migration+'\n'+proofSql+'\n'+workspaceSql);
 const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','execute','--schema','packages/db/prisma/schema.prisma','--file',sqlPath],{env:{...process.env,DATABASE_URL:direct.toString(),DIRECT_URL:direct.toString()},encoding:'utf8'});
 if(result.status!==0)throw Error('Unable to initialize isolated pipeline database: '+result.stderr);
 Object.assign(process.env,{DATABASE_URL:runtime.toString(),DIRECT_URL:direct.toString(),APP_ENV:'test',NODE_ENV:'test',CHAIN_MODE:devnet?'devnet':'local',SOURCE_MODE:'fixture',STORAGE_MODE:devnet?'supabase':'local',ARTIFACT_DIRECTORY:'/tmp/'+schema+'-artifacts',SOLANA_RPC_URL:devnet?process.env.SOLANA_RPC_URL!:'http://127.0.0.1:8899',SOLANA_ISSUER_KEYPAIR_PATH:process.env.SOLANA_ISSUER_KEYPAIR_PATH||process.cwd()+'/.secrets/issuer.json',ISSUER_TRUST_MODE:'DEMO',SYNC_ENABLED:'false',WORKER_POLL_MS:devnet?'1000':'300',WORKER_LEASE_MS:'5000'});
 delete process.env.VERCEL;
 const connection=new Connection(process.env.SOLANA_RPC_URL!,'confirmed');
 const genesis=await connection.getGenesisHash();
 if(devnet && genesis!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('Wrong network for Devnet acceptance');
 process.env.SOLANA_EXPECTED_GENESIS_HASH=genesis;
 const load=async(n:string)=>Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile('.secrets/'+n+'.json','utf8'))));
 const admin=devnet?null:await load('admin'),issuer=await load('issuer'),program=devnet?new PublicKey(process.env.SOLANA_PROGRAM_ID!):(await load('program')).publicKey;process.env.SOLANA_PROGRAM_ID=program.toBase58();
 const {configAddress,epochAddress,discriminator}=await import('../packages/core/src/protocol');
 const {fixtureRows}=await import('../packages/core/src/fixtures');
 const {synchronize}=await import('../packages/core/src/sync');
 const {verifyDevnet,sha256}=await import('../packages/core/src');
 const {prisma}=await import('../packages/db/src');
 let worker:ChildProcess|undefined,api:ChildProcess|undefined;let output='';
 const launch=(args:string[],extra:Record<string,string>={})=>{
  const sourceArgs=[...args],tsconfig=sourceArgs[0]==='--tsconfig'?(sourceArgs.shift(),sourceArgs.shift()):undefined;
  const child=spawn(process.execPath,['--import','tsx',...sourceArgs],{env:{...process.env,...extra,...(tsconfig?{TSX_TSCONFIG_PATH:tsconfig}:{})},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream?.on('data',b=>{output+=b;output=output.slice(-12000);void appendFile('/tmp/'+schema+'-worker.log',b).catch(()=>{})});return child;
 };
 const wait=async(test:()=>Promise<boolean>,label:string)=>{const deadline=Date.now()+180000;while(Date.now()<deadline){if(worker&&(worker.exitCode!==null||worker.signalCode!==null))throw Error('Worker exited: '+output.slice(-2000));if(await test())return;const failed=await prisma.job.findFirst({where:{state:{in:['FAILED_PERMANENT','BLOCKED_CONFLICT']}}});if(failed)throw Error(label+': '+failed.lastError);await new Promise(r=>setTimeout(r,1000))}throw Error(label+' timed out; '+output.slice(-2000))};
 try{
  if(!devnet)for(const key of [admin!,issuer]){const sig=await connection.requestAirdrop(key.publicKey,10_000_000_000);await connection.confirmTransaction(sig,'finalized')}
  const config=configAddress(program)[0];
  const existingConfig=await connection.getAccountInfo(config);
  if(devnet && !existingConfig)throw Error('Deployed issuer config required');
  const signature=existingConfig?null:await sendAndConfirmTransaction(connection,new Transaction().add(new TransactionInstruction({programId:program,keys:[{pubkey:admin!.publicKey,isSigner:true,isWritable:true},{pubkey:config,isSigner:false,isWritable:true},{pubkey:epochAddress(program,config,1)[0],isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data:Buffer.concat([discriminator('global','initialize_issuer'),issuer.publicKey.toBuffer(),Buffer.alloc(32)])})),[admin!],{commitment:'finalized'});
  const rows=fixtureRows().filter(r=>r.student.studentId==='BTU-T-0001');
  await synchronize('pipeline-v1','test',rows);
  const started=Date.now();console.log('Isolated reservation ready; starting '+(devnet?'Devnet':'local')+' issuance worker');worker=launch(['apps/worker/src/worker.ts']);
  await wait(async()=>!!(await prisma.chainAttempt.findFirst()),'durable signed attempt');
  worker.kill('SIGKILL');
  await new Promise<void>(resolve=>worker!.once('close',()=>resolve()));
  worker=launch(['apps/worker/src/worker.ts']);
  await wait(async()=>!!(await prisma.version.findFirst({where:{number:1,state:'COMPLETED'}})),'V1 issuance');
  const v1=await prisma.version.findFirstOrThrow({where:{number:1}});const {artifactStore}=await import('../packages/core/src/storage');const original=await artifactStore().get(v1.storageKey!);
  assert.equal((await verifyDevnet(v1.code,original)).integrity,'MATCH');
  const extra=structuredClone(rows[0]);extra.award.recordId='DEMO-ADDITIONAL-0001';extra.award.dateEarned='2026-09-01';extra.syncStatus='NOT SYNCED';extra.syncedAt='';extra.syncedVersion='';
  await synchronize('pipeline-v2','test',[...rows,extra]);
  await wait(async()=>!!(await prisma.version.findFirst({where:{number:2,state:'COMPLETED'}})),'V2 issuance');
  const v2=await prisma.version.findFirstOrThrow({where:{number:2}}),bytes=await artifactStore().get(v2.storageKey!);
  const latest=await verifyDevnet(v2.code,bytes),old=await verifyDevnet(v1.code,original);assert.equal(latest.integrity,'MATCH');assert.equal(latest.currency,'LATEST');assert.equal(old.integrity,'MATCH');assert.equal(old.currency,'SUPERSEDED');assert.equal(latest.officialBtu,false);assert.equal(latest.chainEvidence?.cluster,devnet?'devnet':'local-validator');
  const tampered=Uint8Array.from(bytes);tampered[tampered.length-10]^=1;assert.equal((await verifyDevnet(v2.code,tampered)).integrity,'MISMATCH');
  const student=await prisma.student.findUniqueOrThrow({where:{externalId:'BTU-T-0001'}}),credentials=JSON.parse(await readFile('.secrets/demo-logins.json','utf8'));
  const {supabaseAuthConfig}=await import('../packages/core/src/config');const provider=supabaseAuthConfig().issuer;
  await prisma.studentIdentity.create({data:{provider,subject:credentials['BTU-T-0001'].subject,studentId:student.id,role:'student',verifiedBy:'isolated-pipeline-test'}});
  const other=await prisma.student.create({data:{externalId:'SYNTHETIC-UNRELATED',email:'other@example.org',firstName:'Other',lastName:'Test',program:'Test',educationLevel:'Test',status:'Active'}});
  await prisma.studentIdentity.create({data:{provider,subject:credentials['BTU-T-0003'].subject,studentId:other.id,role:'student',verifiedBy:'isolated-pipeline-test'}});
  api=launch(['--tsconfig','apps/api/tsconfig.json','apps/api/src/server.ts'],{PORT:'4001'});
  await wait(async()=>{try{return(await fetch('http://127.0.0.1:4001/api/v1/health/live')).ok}catch{return false}},'test API');
  const login=async(name:string)=>{const c=credentials[name],auth=supabaseAuthServiceConfig();const r=await fetch(auth.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json',apikey:auth.apikey},body:JSON.stringify({email:c.email,password:c.password})});assert.equal(r.status,200);return 'orionx_access='+(await r.json()).access_token};
  const cookie=await login('BTU-T-0001'),unrelated=await login('BTU-T-0003');
  const downloaded=await fetch('http://127.0.0.1:4001/api/v1/me/passport/versions/2/download',{headers:{cookie}});assert.equal(downloaded.status,200);assert.equal(sha256(new Uint8Array(await downloaded.arrayBuffer())),v2.pdfSha256);
  assert.equal((await fetch('http://127.0.0.1:4001/api/v1/me/passport/versions/2/download',{headers:{cookie:unrelated}})).status,404);
  assert.equal((await fetch('http://127.0.0.1:4001/api/v1/me/passport/versions/2/download')).status,401);
  const codeProof=await fetch('http://127.0.0.1:4001/api/v1/verify/'+v2.code);assert.equal(codeProof.status,200);assert.equal((await codeProof.json()).currency,'LATEST');
  const form=new FormData();form.set('code',v2.code);form.set('file',new Blob([Buffer.from(tampered)],{type:'application/pdf'}),'tampered.pdf');
  assert.equal((await fetch('http://127.0.0.1:4001/api/v1/verify/file',{method:'POST',body:form})).status,422);
  await synchronize('pipeline-replay','test',[...rows,extra]);assert.equal(await prisma.version.count(),2);assert.equal(await prisma.award.count(),5);
  await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/'+(devnet?'devnet':'local')+'-pipeline.json',JSON.stringify({environment:devnet?'ISOLATED_POSTGRES_WITH_REAL_DEVNET_SUPABASE_STORAGE_AND_AUTH':'ISOLATED_LOCAL_VALIDATOR_WITH_REAL_POSTGRES_AND_SUPABASE_AUTH',devnetEvidence:devnet,liveSheetsEvidence:false,hostedBrowserEvidence:false,officialBtu:false,versions:2,awards:5,checks:['durable reservation','private exact-byte storage','signed attempt before broadcast','crash and restart recovery','real SBF registration','finalized verification','cumulative V2 and backdated discovery','V1 authentic and superseded','tamper rejection','public API verification and tamper rejection','real authenticated download','anonymous and unrelated student denied','idempotent replay'],proofs:[v1,v2].map(v=>({version:v.number,code:v.code,pdfSha256:v.pdfSha256,versionPda:v.versionPda,signature:v.txSignature,cluster:v.chainCluster,programId:v.chainProgramId})),elapsedSeconds:(Date.now()-started)/1000,setupTransaction:signature,checkedAt:new Date().toISOString()},null,2)+'\n');
  console.log('PASS full '+(devnet?'Devnet':'local')+' pipeline: reserve → render → store → sign → crash/recover → finalize → verify → cumulative V2 → tamper fail → authenticated download → replay');
 }finally{
  worker?.kill('SIGTERM');api?.kill('SIGTERM');await new Promise(r=>setTimeout(r,1000));worker?.kill('SIGKILL');api?.kill('SIGKILL');await prisma.$disconnect();
  await adminDb.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await adminDb.$disconnect();
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
