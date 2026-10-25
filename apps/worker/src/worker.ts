import {prisma} from "@orionx/db";
import {artifactStore} from "@orionx/core";
import {queueSynchronization, sourceId} from "@orionx/core/src/sync";
import {createJobProcessor, positiveInteger} from "@orionx/core/src/processor";
import {setTimeout as delay} from "node:timers/promises";

const shutdown = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { console.log("Draining OrionX worker"); shutdown.abort(); });
async function sleep(ms: number) { try { await delay(ms, undefined, {signal: shutdown.signal}); } catch (error) { if (!shutdown.signal.aborted) throw error; } }
async function run() {
 if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required to run the PDF worker");
 if (process.env.VERCEL_REGION && process.env.STORAGE_MODE !== "supabase") throw Error("Vercel workers require durable storage: set STORAGE_MODE=supabase");
 artifactStore();
 const processor = createJobProcessor(), syncPollMs = positiveInteger("SYNC_POLL_MS", 60000);
 console.log("OrionX PDF worker started", processor.workerId);
 let lastSync = 0;
 try {
  while (!shutdown.signal.aborted) {
   try {
    if (process.env.SYNC_ENABLED === "true" && Date.now() - lastSync >= syncPollMs) {
     await queueSynchronization("poll:" + sourceId() + ":" + Math.floor(Date.now() / syncPollMs), processor.workerId);
     lastSync = Date.now();
    }
    if (!(await processor.processNext()).processed) await sleep(processor.pollMs);
   } catch (error) { console.error("Worker polling failed; retrying", error instanceof Error ? error.message : "Database unavailable"); await sleep(processor.pollMs); }
  }
 } finally { await prisma.$disconnect(); }
}
run().catch(error => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; });
