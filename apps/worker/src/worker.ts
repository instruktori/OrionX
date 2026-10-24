import {prisma} from "@orionx/db";
import {Prisma} from "@prisma/client";
import {artifactStore, sha256, verifyDevnet, type Snapshot} from "@orionx/core";
import {optionalArtifact} from "@orionx/core/src/storage";
import {renderPassportPdf} from "@orionx/core/src/templates";
import {synchronize, sourceRows} from "@orionx/core/src/sync";
import {signVersion, broadcast, attemptStatus, registryPda, finalizedAttempt} from "@orionx/core/src/chain-issuer";
import {writeBack} from "@orionx/core/src/writeback";
import {DomainError} from "@orionx/core/src/errors";
import {PDFDocument} from "pdf-lib";
import {PublicKey} from "@solana/web3.js";
import {claimJob} from "@orionx/core/src/jobs";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";

const workerId = randomUUID();
const schemaName = new URL(process.env.DATABASE_URL || "postgresql://localhost/demo").searchParams.get("schema") || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schemaName)) throw Error("Invalid database schema");
function positiveInteger(name: string, fallback: number) { const value = Number(process.env[name] ?? fallback); if (!Number.isSafeInteger(value) || value < 1) throw Error(name + " must be a positive integer"); return value; }
const POLL_MS = positiveInteger("WORKER_POLL_MS", 3000), LEASE_MS = positiveInteger("WORKER_LEASE_MS", 120000), MAX_ATTEMPTS = positiveInteger("WORKER_MAX_ATTEMPTS", 5);
const shutdown = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { console.log("Draining OrionX worker", workerId); shutdown.abort(); });
async function sleep() { try { await delay(POLL_MS, undefined, {signal: shutdown.signal}); } catch (e) { if (!shutdown.signal.aborted) throw e; } }
async function claim() { return claimJob(prisma, schemaName, workerId, LEASE_MS); }

async function fenced(tx: Prisma.TransactionClient, id: string, data: Prisma.JobUpdateManyMutationInput) {
 const result = await tx.job.updateMany({where: {id, leaseOwner: workerId, state: "RENDERED", leaseUntil: {gt: new Date()}}, data: {...data, leaseOwner: null, leaseUntil: null}});
 if (result.count !== 1) throw Error("Lease lost before commit");
}
async function processClaim(id: string) {
 console.log(JSON.stringify({event: "JOB_LOADING", id, workerId}));
 const job = await prisma.job.findUniqueOrThrow({where: {id}, include: {version: {include: {passport: true}}}});
 if (job.type === "SYNC") {
  await synchronize(job.idempotencyKey.slice(5));
  await prisma.$transaction(tx => fenced(tx, id, {state: "COMPLETED"}));
  return;
 }
 if (!job.version || job.leaseOwner !== workerId) throw Error("Missing reserved version or lease");
 console.log(JSON.stringify({event: "JOB_STAGE", id, stage: job.stage, workerId}));
 const version = job.version, frozen = version.snapshot as unknown as Snapshot;
 const store = artifactStore();
 if (job.stage === "PDF") {
  // The predetermined staging key survives the gap between object creation and
  // SQL commit. Adopt existing bytes before considering any render.
  let bytes = await optionalArtifact(store, version.stagingKey);
  if (!bytes) {
   if (await prisma.chainAttempt.count({where: {versionId: version.id}})) throw new DomainError("ARTIFACT_MISSING", "Signed version has lost its immutable artifact");
   const rendered = await renderPassportPdf(frozen);
   try { await store.putOnce(version.stagingKey, rendered); } catch (error) {
    const existing = await optionalArtifact(store, version.stagingKey);
    if (!existing || sha256(existing) !== sha256(rendered)) throw error;
   }
   bytes = await store.get(version.stagingKey);
   if (sha256(bytes) !== sha256(rendered)) throw Error("Staging digest mismatch");
  }
  const hash = sha256(bytes), key = "demo/" + version.passport.opaqueChainRef + "/v" + version.number + "/" + hash + ".pdf";
  const existing = await optionalArtifact(store, key);
  if (existing && sha256(existing) !== hash) throw new DomainError("ARTIFACT_CONFLICT", "Immutable artifact mismatch");
  if (!existing) await store.putOnce(key, bytes);
  if (sha256(await store.get(key)) !== hash) throw Error("Storage readback digest mismatch");
  const pageCount = (await PDFDocument.load(bytes)).getPageCount();
  if (pageCount < 2) throw Error("A passport must contain at least two pages");
  await prisma.$transaction(async tx => {
   await fenced(tx, id, {state: ["devnet", "local"].includes(process.env.CHAIN_MODE || "") ? "QUEUED" : "STORED", stage: "CHAIN", attempts: 0});
   await tx.version.update({where: {id: version.id}, data: {state: "STORED", storageKey: key, pdfSha256: hash, pageCount, byteLength: bytes!.length}});
   await tx.auditEvent.create({data: {action: "PDF_STORED", targetId: version.id, detail: {sha256: hash, pageCount}}});
  });
  return;
 }
 if (!version.pdfSha256 || !version.storageKey) throw new DomainError("ARTIFACT_MISSING", "Stored PDF is required before chain operations");
 if (job.stage === "CHAIN") {
  if (!["devnet", "local"].includes(process.env.CHAIN_MODE || "")) { await prisma.$transaction(tx => fenced(tx, id, {state: "STORED"})); return; }
  const bytes = await store.get(version.storageKey);
  if (sha256(bytes) !== version.pdfSha256) throw new DomainError("ARTIFACT_CONFLICT", "Stored PDF changed");
  const proof = await verifyDevnet(version.code, bytes);
  if (proof.registration === "REGISTERED") {
   const expectedRegistry = registryPda(Buffer.from(version.passport.opaqueChainRef, "hex"), new PublicKey(process.env.SOLANA_PROGRAM_ID!)).toBase58();
   if (proof.integrity !== "MATCH" || proof.version !== version.number || proof.chainEvidence?.registryPda !== expectedRegistry) throw new DomainError("PROOF_CONFLICT", "Existing chain record conflicts with reserved version");
   const lastAttempt = await finalizedAttempt(await prisma.chainAttempt.findMany({where: {versionId: version.id}, orderBy: {createdAt: "desc"}, take: 100}));
   await prisma.$transaction(async tx => {
    await fenced(tx, id, {state: "QUEUED", stage: "WRITEBACK", attempts: 0});
    const finalizedAt = new Date();
    await tx.version.update({where: {id: version.id}, data: {state: "SYNC_WRITEBACK_PENDING", versionPda: proof.versionPda, finalizedSlot: BigInt(proof.chainEvidence!.registeredSlot), chainCluster: String(proof.chainEvidence!.cluster), chainProgramId: String(proof.chainEvidence!.programId), chainGenesisHash: String(proof.chainEvidence!.genesisHash), finalizedAt, txSignature: lastAttempt?.signature}});
    await tx.passport.update({where: {id: version.passportId}, data: {latestFinalizedVersion: version.number, activeVersionId: null}});
    const membership = await tx.versionAward.findMany({where: {versionId: version.id}, include: {award: true}});
    for (const member of membership.filter(m => m.award.firstIncludedVersion === null)) {
     await tx.award.update({where: {id: member.awardId}, data: {firstIncludedVersion: version.number}});
     await tx.sheetWriteback.create({data: {recordId: member.award.sourceRecordId, versionId: version.id, expectedFingerprint: frozen.sourceFingerprints?.[member.award.sourceRecordId] || ""}});
     await tx.sourceSync.update({where: {sourceRecordId: member.award.sourceRecordId}, data: {status: "FINALIZED"}});
    }
    if (lastAttempt) await tx.chainAttempt.update({where: {id: lastAttempt.id}, data: {state: "FINALIZED"}});
    await tx.auditEvent.create({data: {action: "CHAIN_FINALIZED", targetId: version.id, detail: proof.chainEvidence as Prisma.InputJsonValue}});
   }); return;
  }
  if (proof.errorCode !== "UNKNOWN_CODE") throw new DomainError(proof.errorCode || "RPC_UNAVAILABLE", proof.message, 503, true);
  let attempt = await prisma.chainAttempt.findFirst({where: {versionId: version.id, state: {in: ["SIGNED", "SUBMITTED"]}}, orderBy: {createdAt: "desc"}});
  if (attempt) {
   const status = await attemptStatus(attempt);
   if (status === "OBSERVED") {
    await prisma.$transaction(tx => fenced(tx, id, {state: "QUEUED", availableAt: new Date(Date.now() + POLL_MS)}));
    return;
   }
   if (status === "FAILED") throw new DomainError("CHAIN_REJECTED", "Signed transaction was rejected; operator review required");
   if (status === "EXPIRED") { await prisma.chainAttempt.update({where: {id: attempt.id}, data: {state: "EXPIRED"}}); attempt = null; }
  }
  if (!attempt) {
   const signed = await signVersion({reference: version.passport.opaqueChainRef, version: version.number, code: version.code, hash: version.pdfSha256});
   // Signed bytes/signature are committed BEFORE any network submission.
   attempt = await prisma.chainAttempt.create({data: {...signed, versionId: version.id}});
  }
  await broadcast(attempt);
  await prisma.$transaction(async tx => {
   await fenced(tx, id, {state: "QUEUED", availableAt: new Date(Date.now() + POLL_MS)});
   await tx.chainAttempt.update({where: {id: attempt!.id}, data: {state: "SUBMITTED"}});
   await tx.version.update({where: {id: version.id}, data: {state: "CHAIN_PENDING"}});
  }); return;
 }
 if (job.stage === "WRITEBACK") {
  const pending = await prisma.sheetWriteback.findMany({where: {versionId: version.id, state: "PENDING"}});
  const rows = process.env.SOURCE_MODE === "sheets" ? await sourceRows() : [];
  for (const update of pending) {
   if (process.env.SOURCE_MODE === "sheets") await writeBack(rows, [{recordId: update.recordId, version: version.number, status: "SYNCED", timestamp: version.finalizedAt!.toISOString(), expectedFingerprint: update.expectedFingerprint, passportId: frozen.student.passportId, initialIssueDate: frozen.student.initialIssueDate}]);
   await prisma.sheetWriteback.update({where: {id: update.id}, data: {state: process.env.SOURCE_MODE === "sheets" ? "COMPLETED" : "FIXTURE_ONLY", completedAt: new Date()}});
  }
  await prisma.$transaction(async tx => {
   await fenced(tx, id, {state: "COMPLETED"});
   await tx.version.update({where: {id: version.id}, data: {state: "COMPLETED"}});
   await tx.auditEvent.create({data: {action: "ISSUANCE_COMPLETED", targetId: version.id, detail: {sourceMode: process.env.SOURCE_MODE || "fixture"}}});
  });
 }
}
async function fail(id: string, error: unknown) {
 const job = await prisma.job.findUnique({where: {id}});
 if (!job || job.leaseOwner !== workerId) return;
 const attempts = job.attempts + 1, permanent = error instanceof DomainError && !error.retryable;
 await prisma.job.updateMany({where: {id, leaseOwner: workerId}, data: {attempts, lastError: error instanceof Error ? error.message.slice(0, 500) : "Processing failed", state: permanent ? "BLOCKED_CONFLICT" : attempts >= MAX_ATTEMPTS ? "FAILED_PERMANENT" : "RETRY_WAIT", availableAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** attempts)), leaseOwner: null, leaseUntil: null}});
}
async function run() {
 if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required to run the PDF worker");
 if (process.env.VERCEL_REGION && process.env.STORAGE_MODE !== "supabase") throw Error("Vercel workers require durable storage: set STORAGE_MODE=supabase");
 artifactStore();
 console.log("OrionX PDF worker started", workerId);
 let lastSync = 0;
 try {
  while (!shutdown.signal.aborted) {
   try {
    if (process.env.SYNC_ENABLED === "true" && Date.now() - lastSync > 60000) { lastSync = Date.now(); await synchronize(); }
    const id = await claim(); if (!id) { await sleep(); continue; }
    try { await processClaim(id); } catch (e) { console.error("Job failed", id, e instanceof Error ? e.message : "Processing failed"); await fail(id, e); }
   } catch (e) { console.error("Worker polling failed; retrying", e instanceof Error ? e.message : "Database unavailable"); await sleep(); }
  }
 } finally { await prisma.$disconnect(); }
}
run().catch(e => { console.error(e instanceof Error ? e.message : "Worker failed"); process.exitCode = 1; });
