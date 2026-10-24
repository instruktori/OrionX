import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fixtureRows} from '../packages/core/src/fixtures';
import {snapshot,newCode,sha256} from '../packages/core/src';
import {renderPassportPdf} from '../packages/core/src/templates';
import {claimJob} from '../packages/core/src/jobs';
async function main(){
 const name='orionx_load_'+randomBytes(5).toString('hex'),base=process.env.DIRECT_URL||process.env.DATABASE_URL!;
 const url=new URL(base);url.searchParams.set('schema',name);const admin=new PrismaClient({datasourceUrl:base}),a=new PrismaClient({datasourceUrl:url.toString()}),b=new PrismaClient({datasourceUrl:url.toString()});
 const migration=(await readFile('packages/db/prisma/migrations/0001_architecture/migration.sql','utf8')).replaceAll('public.','"'+name+'".');
 const sql='/tmp/'+name+'.sql';await writeFile(sql,'CREATE SCHEMA IF NOT EXISTS "'+name+'"; SET search_path TO "'+name+'";\n'+migration+'\n'+(await readFile('packages/db/prisma/migrations/0002_proof_context/migration.sql','utf8')).split('\n')[0]);
 try{
  const setup=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','execute','--schema','packages/db/prisma/schema.prisma','--file',sql],{env:{...process.env,DATABASE_URL:url.toString(),DIRECT_URL:url.toString()},encoding:'utf8'});if(setup.status!==0)throw Error('Capacity schema initialization failed');
  const seed=fixtureRows()[0],count=5000,rows=Array.from({length:count},(_,i)=>{const student={...seed.student,studentId:'LOAD-'+i,email:'load-'+i+'@example.org',passportId:'DEMO-LOAD-'+i};const award={...seed.award,studentId:student.studentId,recordId:'LOAD-REC-'+i};return {student,award,snapshot:snapshot(student,[award],1,newCode())}});
  const started=performance.now();
  await a.student.createMany({data:rows.map((r,i)=>({id:'student-'+i,externalId:r.student.studentId,email:r.student.email,firstName:r.student.firstName,lastName:r.student.lastName,program:r.student.program,educationLevel:r.student.educationLevel,status:r.student.status}))});
  await a.passport.createMany({data:rows.map((r,i)=>({id:'passport-'+i,studentId:'student-'+i,publicId:r.student.passportId,initialIssueDate:new Date(r.student.initialIssueDate),opaqueChainRef:randomBytes(32).toString('hex')}))});
  await a.award.createMany({data:rows.map((r,i)=>({id:'award-'+i,studentId:'student-'+i,sourceRecordId:r.award.recordId,skillId:r.award.skillId,name:r.award.name,category:r.award.category,badgeCode:r.award.badgeCode,description:r.award.description,earnedAt:new Date(r.award.dateEarned),sourceFingerprint:sha256(Buffer.from(JSON.stringify(r.award)))}))});
  await a.version.createMany({data:rows.map((r,i)=>({id:'version-'+i,passportId:'passport-'+i,number:1,code:r.snapshot.code,codeHash:sha256(Buffer.from(r.snapshot.code)),intentDigest:sha256(Buffer.from(JSON.stringify(r.snapshot.awards))),snapshot:JSON.parse(JSON.stringify(r.snapshot)),stagingKey:'load/'+i+'/'+r.snapshot.code+'/artifact.pdf',state:'QUEUED'}))});
  await a.versionAward.createMany({data:rows.map((_,i)=>({versionId:'version-'+i,awardId:'award-'+i,displayOrder:0}))});
  await a.job.createMany({data:rows.map((_,i)=>({versionId:'version-'+i,type:'ISSUE',stage:'PDF',idempotencyKey:'load:'+i}))});
  const persistSeconds=(performance.now()-started)/1000;assert.equal(await a.student.count(),count);assert.equal(await a.job.count(),count);
  const claimed:string[]=[];const claimStart=performance.now();
  for(let i=0;i<25;i++){const ids=await Promise.all([claimJob(a,name,'worker-a',120000),claimJob(b,name,'worker-b',120000)]);for(const id of ids){assert.ok(id);claimed.push(id!)}}
  assert.equal(new Set(claimed).size,50);const claimSeconds=(performance.now()-claimStart)/1000;
  const renderStart=performance.now();let totalBytes=0;for(const row of rows.slice(0,10))totalBytes+=(await renderPassportPdf(row.snapshot)).length;
  const renderSeconds=(performance.now()-renderStart)/1000;
  await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/capacity.json',JSON.stringify({environment:'ISOLATED_POSTGRES_SCHEMA',syntheticPassports:count,syntheticAwards:count,syntheticVersions:count,durableJobs:count,persistSeconds,claimedJobs:50,concurrentClaimers:2,duplicateClaims:0,claimSeconds,samplePdfs:10,samplePdfBytes:totalBytes,renderSeconds,fullChainLoadTest:false,devnetTransactions:0,interpretation:'Measured persistence, actual queue claim function and PDF samples. These measurements do not establish full issuance throughput or a burst SLA.',checkedAt:new Date().toISOString()},null,2)+'\n');
  console.log(JSON.stringify({passports:count,persistSeconds,uniqueConcurrentClaims:50,claimSeconds,samplePdfs:10,renderSeconds}));
 }finally{await a.$disconnect();await b.$disconnect();await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+name+'" CASCADE');await admin.$disconnect()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
