import {Prisma,type PrismaClient} from '@prisma/client';
import {setTimeout as delay} from 'node:timers/promises';

export class LeaseLostError extends Error {
 constructor() { super('Job lease lost; processing stopped'); }
}

export function jobRetryDelay(error: unknown, attempts: number) {
 const value = error as {code?: unknown; response?: {status?: number; headers?: {get?: (name: string) => string | null}}};
 const status = Number(value?.response?.status ?? value?.code);
 const retryAfter = value?.response?.headers?.get?.('retry-after');
 const seconds = retryAfter ? Number(retryAfter) : NaN;
 const quotaDelay = status === 429 ? 60000 : 0;
 return Math.min(3600000, Math.max(1000 * 2 ** attempts, quotaDelay, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0));
}

export async function renewJobLease(db: PrismaClient, schema: string, id: string, owner: string, leaseMs: number) {
 if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema) || !Number.isSafeInteger(leaseMs) || leaseMs < 1) throw Error('Invalid queue configuration');
 const table = Prisma.raw('"' + schema + '"."Job"');
 const count = await db.$executeRaw(Prisma.sql`
  UPDATE ${table} SET "leaseUntil"=NOW()+${leaseMs}*INTERVAL '1 millisecond', "updatedAt"=NOW()
  WHERE id=${id} AND "leaseOwner"=${owner} AND state='RENDERED' AND "leaseUntil">NOW()`);
 if (count !== 1) throw new LeaseLostError();
}

/** Renew during network/render work and fence each external side effect as well. */
export async function withJobLease<T>(renew: () => Promise<void>, leaseMs: number, work: (check: () => Promise<void>) => Promise<T>): Promise<T> {
 const stop = new AbortController();
 let lost: Error | undefined;
 let renewing: Promise<void> | undefined;
 const check = async () => {
  if (lost) throw lost;
  renewing ??= renew().catch(error => { lost = error instanceof Error ? error : new LeaseLostError(); throw lost; }).finally(() => { renewing = undefined; });
  await renewing;
 };
 const heartbeat = (async () => {
  while (!stop.signal.aborted) {
   try { await delay(Math.max(1, Math.floor(leaseMs / 3)), undefined, {signal: stop.signal}); }
   catch (error) { if (stop.signal.aborted) return; throw error; }
   if (!stop.signal.aborted) { try { await check(); } catch { return; } }
  }
 })();
 try { await check(); return await work(check); }
 finally { stop.abort(); await heartbeat; }
}
export async function claimJob(db:PrismaClient,schema:string,owner:string,leaseMs:number){
 if(!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema)||!Number.isSafeInteger(leaseMs)||leaseMs<1)throw Error('Invalid queue configuration');
 const table=Prisma.raw('"'+schema+'"."Job"');
 const rows=await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
 WITH candidate AS (
 SELECT id FROM ${table} WHERE ((state IN ('QUEUED','RETRY_WAIT') AND "availableAt"<=NOW()) OR (state='RENDERED' AND "leaseUntil"<NOW())) AND type IN ('ISSUE','SYNC','REVOKE')
 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE ${table} AS job SET state='RENDERED', "leaseOwner"=${owner}, "leaseUntil"=NOW()+${leaseMs}*INTERVAL '1 millisecond', "updatedAt"=NOW()
 FROM candidate WHERE job.id=candidate.id RETURNING job.id`);
 return rows[0]?.id;
}
