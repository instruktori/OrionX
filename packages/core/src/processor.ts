import {prisma} from "@orionx/db";
import {Prisma} from "@prisma/client";
import {artifactStore, sha256, verifyDevnet, type Snapshot} from "./index";
import {optionalArtifact} from "./storage";
import {renderPassportPdf} from "./templates";
import {synchronize, sourceRows, sourceId, queueSynchronization} from "./sync";
import {signVersion, broadcast, attemptStatus, registryPda, finalizedAttempt} from "./chain-issuer";
import {writeBack} from "./writeback";
import {DomainError} from "./errors";
import {PDFDocument} from "pdf-lib";
import {PublicKey} from "@solana/web3.js";
import {claimJob, renewJobLease, withJobLease, jobRetryDelay} from "./jobs";
import {randomUUID} from "node:crypto";

export function positiveInteger(name: string, fallback: number) { const value = Number(process.env[name] ?? fallback); if (!Number.isSafeInteger(value) || value < 1) throw Error(name + " must be a positive integer"); return value; }

/** Processes durable stages in either a daemon or a bounded authenticated HTTP request. */
export function createJobProcessor(options: {writebackLimit?: number} = {}) {
 const workerId = randomUUID();
 const schemaName = new URL(process.env.DATABASE_URL || "postgresql://localhost/demo").searchParams.get("schema") || "public";
 if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schemaName)) throw Error("Invalid database schema");
 const POLL_MS = positiveInteger("WORKER_POLL_MS", 3000), LEASE_MS = positiveInteger("WORKER_LEASE_MS", 120000), MAX_ATTEMPTS = positiveInteger("WORKER_MAX_ATTEMPTS", 5);
async function fenced(tx: Prisma.TransactionClient, id: string, data: Prisma.JobUpdateManyMutationInput) {
 const result = await tx.job.updateMany({where: {id, leaseOwner: workerId, state: "RENDERED", leaseUntil: {gt: new Date()}}, data: {...data, lastError: null, leaseOwner: null, leaseUntil: null}});
 if (result.count !== 1) throw Error("Lease lost before commit");
}
async function processClaim(id: string, checkLease: () => Promise<void>) {
 console.log(JSON.stringify({event: "JOB_LOADING", id, workerId}));
 const job = await prisma.job.findUniqueOrThrow({where: {id}, include: {version: {include: {passport: true}}}});
 if (job.type === "SYNC") {
  const run = await synchronize(job.idempotencyKey.slice(5));
  if (run.state === "FAILED") throw new DomainError("IMPORT_FAILED", "Source import has not completed", 503, true);
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
   await checkLease();
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
  if (!existing) { await checkLease(); await store.putOnce(key, bytes); }
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
    const additions = membership.filter(m => m.award.firstIncludedVersion === null);
    if (additions.length) {
     await tx.award.updateMany({where: {id: {in: additions.map(member => member.awardId)}, firstIncludedVersion: null}, data: {firstIncludedVersion: version.number}});
     await tx.sheetWriteback.createMany({data: additions.map(member => ({recordId: member.award.sourceRecordId, versionId: version.id, expectedFingerprint: frozen.sourceFingerprints?.[member.award.sourceRecordId] || ""}))});
     await tx.sourceSync.updateMany({where: {sourceRecordId: {in: additions.map(member => member.award.sourceRecordId)}}, data: {status: "FINALIZED"}});
    }
    if (lastAttempt) await tx.chainAttempt.update({where: {id: lastAttempt.id}, data: {state: "FINALIZED"}});
    await tx.auditEvent.create({data: {action: "CHAIN_FINALIZED", targetId: version.id, detail: proof.chainEvidence as Prisma.InputJsonValue}});
   }, {timeout: 30000, maxWait: 15000}); return;
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
   await checkLease();
   const signed = await signVersion({reference: version.passport.opaqueChainRef, version: version.number, code: version.code, hash: version.pdfSha256});
   // Signed bytes/signature are committed BEFORE any network submission.
   await prisma.$transaction(async tx => {
    const owned = await tx.job.updateMany({where: {id, leaseOwner: workerId, state: "RENDERED", leaseUntil: {gt: new Date()}}, data: {updatedAt: new Date()}});
    if (owned.count !== 1) throw Error("Lease lost before signing commit");
    attempt = await tx.chainAttempt.create({data: {...signed, versionId: version.id}});
   });
  }
  await checkLease();
  if (!attempt) throw Error("Signed attempt is missing");
  await broadcast(attempt);
  await prisma.$transaction(async tx => {
   await fenced(tx, id, {state: "QUEUED", availableAt: new Date(Date.now() + POLL_MS)});
   await tx.chainAttempt.update({where: {id: attempt!.id}, data: {state: "SUBMITTED"}});
   await tx.version.update({where: {id: version.id}, data: {state: "CHAIN_PENDING"}});
  }); return;
 }
 if (job.stage === "WRITEBACK") {
  const pending = await prisma.sheetWriteback.findMany({where: {versionId: version.id, state: "PENDING"}, take: options.writebackLimit, orderBy: {id: "asc"}});
  const rows = process.env.SOURCE_MODE === "sheets" ? await sourceRows() : [];
  for (const update of pending) {
   await checkLease();
   if (process.env.SOURCE_MODE === "sheets") await writeBack(rows, [{recordId: update.recordId, version: version.number, status: "SYNCED", timestamp: version.finalizedAt!.toISOString(), expectedFingerprint: update.expectedFingerprint, passportId: frozen.student.passportId, initialIssueDate: frozen.student.initialIssueDate}]);
   await prisma.sheetWriteback.update({where: {id: update.id}, data: {state: process.env.SOURCE_MODE === "sheets" ? "COMPLETED" : "FIXTURE_ONLY", completedAt: new Date()}});
  }
  if (await prisma.sheetWriteback.count({where: {versionId: version.id, state: "PENDING"}})) {
   await prisma.$transaction(tx => fenced(tx, id, {state: "QUEUED", attempts: 0}));
   return;
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
 await prisma.job.updateMany({where: {id, leaseOwner: workerId, state: "RENDERED", leaseUntil: {gt: new Date()}}, data: {attempts, lastError: error instanceof Error ? error.message.slice(0, 500) : "Processing failed", state: permanent ? "BLOCKED_CONFLICT" : attempts >= MAX_ATTEMPTS ? "FAILED_PERMANENT" : "RETRY_WAIT", availableAt: new Date(Date.now() + jobRetryDelay(error, attempts)), leaseOwner: null, leaseUntil: null}});
}
 return {
  workerId, pollMs: POLL_MS,
  async processNext() {
   const id = await claimJob(prisma, schemaName, workerId, LEASE_MS);
   if (!id) return {processed: false, jobId: null, errorCode: null};
   try {
    await withJobLease(() => renewJobLease(prisma, schemaName, id, workerId, LEASE_MS), LEASE_MS, check => processClaim(id, check));
    return {processed: true, jobId: id, errorCode: null};
   } catch (error) {
    console.error("Job failed", id, error instanceof Error ? error.message : "Processing failed");
    await fail(id, error);
    return {processed: true, jobId: id, errorCode: error instanceof DomainError ? error.code : "RETRY_SCHEDULED"};
   }
  },
 };
}
