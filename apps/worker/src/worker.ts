import {prisma} from "@orionx/db";
import {artifactStore,sha256} from "@orionx/core";
import {renderDemoPdf} from "@orionx/core/src/pdf";
import type {Snapshot} from "@orionx/core";
import {randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {setTimeout as delay} from "node:timers/promises";

const workerId=randomUUID();
function positiveInteger(name:string,fallback:number){const value=Number(process.env[name]??fallback);if(!Number.isSafeInteger(value)||value<1)throw Error(name+" must be a positive integer");return value}
const POLL_MS=positiveInteger("WORKER_POLL_MS",3000);
const LEASE_MS=positiveInteger("WORKER_LEASE_MS",120000);
const MAX_ATTEMPTS=positiveInteger("WORKER_MAX_ATTEMPTS",5);
const shutdown=new AbortController();
for(const signal of ["SIGTERM","SIGINT"] as const)process.once(signal,()=>{console.log("Draining OrionX PDF worker",workerId);shutdown.abort()});
async function sleep(){try{await delay(POLL_MS,undefined,{signal:shutdown.signal})}catch(error){if(!shutdown.signal.aborted)throw error}}

/** PostgreSQL row locks avoid two workers claiming the same job. Expired leases are reclaimed. */
async function claim():Promise<string|undefined>{
 const rows=await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`
 WITH candidate AS (
  SELECT id FROM "Job"
  WHERE (state IN ('QUEUED','RETRY_WAIT') AND "availableAt"<=NOW())
     OR (state='RENDERED' AND "leaseUntil"<NOW())
  ORDER BY "createdAt"
  FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE "Job" AS job
 SET state='RENDERED', "leaseOwner"=${workerId},
     "leaseUntil"=NOW()+${LEASE_MS}*INTERVAL '1 millisecond', "updatedAt"=NOW()
 FROM candidate WHERE job.id=candidate.id
 RETURNING job.id
 `);
 return rows[0]?.id;
}
async function processClaim(id:string){
 const job=await prisma.job.findUnique({where:{id},include:{version:true}});
 if(!job||job.leaseOwner!==workerId||!job.version)throw Error("Lease lost or version missing");
 const v=job.version;
 if(v.state==="STORED"||v.state==="CHAIN_PENDING"||v.state==="FINALIZED"||v.state==="COMPLETED"){
  await completeJob(id);return;
 }
 const frozen=v.snapshot as unknown as Snapshot;
 if(!frozen?.student||!frozen?.awards||!frozen?.code||frozen.version!==v.number||frozen.student.passportId.length===0)throw Error("Invalid frozen version snapshot");
 const pdf=await renderDemoPdf(frozen);
 const hash=sha256(pdf);
 const key="demo/"+v.passportId+"/v"+v.number+"/"+hash+".pdf";
 const store=artifactStore();
 // Create-only write; after a crash, existing identical bytes can be safely reused.
 try{await store.putOnce(key,pdf)}catch(error){
  const existing=await store.get(key).catch(()=>null);
  if(!existing||sha256(existing)!==hash)throw error;
 }
 const stored=await store.get(key);
 if(sha256(stored)!==hash)throw Error("Storage readback digest mismatch");
 await prisma.$transaction(async tx=>{
  const updated=await tx.job.updateMany({where:{id,leaseOwner:workerId,state:"RENDERED",leaseUntil:{gt:new Date()}},data:{state:"STORED",leaseOwner:null,leaseUntil:null}});
  if(updated.count!==1)throw Error("Lease expired before commit");
  await tx.version.update({where:{id:v.id},data:{state:"STORED",storageKey:key,pdfSha256:hash}});
  await tx.auditEvent.create({data:{action:"PDF_STORED",targetId:v.id,detail:{sha256:hash,version:v.number}}});
 });
}
async function completeJob(id:string){await prisma.job.updateMany({where:{id,leaseOwner:workerId},data:{state:"STORED",leaseOwner:null,leaseUntil:null}})}
async function fail(id:string,error:unknown){
 const job=await prisma.job.findUnique({where:{id}});
 if(!job||job.leaseOwner!==workerId)return;
 const attempts=job.attempts+1;
 await prisma.job.updateMany({where:{id,leaseOwner:workerId},data:{attempts,lastError:String(error).slice(0,2000),state:attempts>=MAX_ATTEMPTS?"FAILED_PERMANENT":"RETRY_WAIT",availableAt:new Date(Date.now()+Math.min(3600000,1000*2**attempts)),leaseOwner:null,leaseUntil:null}});
}
async function run(){
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required to run the PDF worker");
 if(process.env.VERCEL_REGION&&process.env.STORAGE_MODE!=="supabase")throw Error("Vercel workers require durable storage: set STORAGE_MODE=supabase");
 console.log("OrionX PDF worker started",workerId);
 try{
  while(!shutdown.signal.aborted){
   try{const id=await claim();if(!id){await sleep();continue}try{await processClaim(id)}catch(e){console.error("Job failed",id,e);await fail(id,e)}}
   catch(e){console.error("Worker polling failed; retrying",e);await sleep()}
  }
 }finally{await prisma.$disconnect()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
