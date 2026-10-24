import {Prisma,type PrismaClient} from '@prisma/client';
export async function claimJob(db:PrismaClient,schema:string,owner:string,leaseMs:number){
 if(!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema)||!Number.isSafeInteger(leaseMs)||leaseMs<1)throw Error('Invalid queue configuration');
 const table=Prisma.raw('"'+schema+'"."Job"');
 const rows=await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
 WITH candidate AS (
 SELECT id FROM ${table} WHERE ((state IN ('QUEUED','RETRY_WAIT') AND "availableAt"<=NOW()) OR (state='RENDERED' AND "leaseUntil"<NOW())) AND type IN ('ISSUE','SYNC')
 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE ${table} AS job SET state='RENDERED', "leaseOwner"=${owner}, "leaseUntil"=NOW()+${leaseMs}*INTERVAL '1 millisecond', "updatedAt"=NOW()
 FROM candidate WHERE job.id=candidate.id RETURNING job.id`);
 return rows[0]?.id;
}
