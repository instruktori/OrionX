import {randomBytes} from "node:crypto";
import {prisma} from "@orionx/db";
import {Prisma} from "@prisma/client";
import {sha256, snapshot, newCode, type Snapshot, type Award} from "./index";
import {DomainError} from "./errors";
import {verifyDevnet} from "./solana";
import {signRevocation, broadcast, attemptStatus} from "./chain-issuer";
import {requireAdmin, type Identity} from "./auth";

export function revocationCommitments(reason: string, actorId: string, versionId: string, nonce = randomBytes(32).toString("hex")) {
 return {nonce, reasonDigest: sha256(Buffer.from(JSON.stringify([nonce, versionId, reason]))), actorDigest: sha256(Buffer.from(JSON.stringify([nonce, versionId, actorId])))};
}
/** One immutable request and one existing durable Job per version, serialized with source imports. */
export async function requestRevocation(user: Identity, passportId: string, number: number, reason: string, withdrawRecordIds: string[] = []) {
 requireAdmin(user);
 reason = reason.trim();
 if (!reason || reason.length > 1000 || !Number.isSafeInteger(number) || number < 1 || withdrawRecordIds.length > 100) throw new DomainError("INVALID_REQUEST", "Version and a reason of 1–1000 characters are required", 400);
 if (process.env.REVOCATION_ENABLED !== "true") throw new DomainError("REVOCATION_DISABLED", "Awaiting approved program upgrade and revocation activation", 503);
 return prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(744092101)`;
  const version = await tx.version.findFirst({where: {number, passport: {OR: [{id: passportId}, {publicId: passportId}]}}, include: {passport: true, revocation: true, awards: {include: {award: true}}}});
  if (!version?.finalizedSlot || !version.pdfSha256) throw new DomainError("NOT_ISSUED", "Only finalized versions can be revoked", 409);
  if (version.chainProgramId !== process.env.SOLANA_PROGRAM_ID || version.chainGenesisHash !== process.env.SOLANA_EXPECTED_GENESIS_HASH) throw new DomainError("PROOF_CONTEXT_CONFLICT", "Version belongs to a different chain configuration", 409);
  const selected = version.awards.filter(a => withdrawRecordIds.includes(a.award.sourceRecordId));
  if (withdrawRecordIds.length !== selected.length) throw new DomainError("INVALID_REQUEST", "Withdrawals must identify awards in this version", 400);
  if (version.revocation) {
   const prior = version.revocation;
   if (prior.reason !== reason || JSON.stringify([...prior.withdrawnRecords].sort()) !== JSON.stringify([...withdrawRecordIds].sort())) throw new DomainError("REVOCATION_CONFLICT", "An immutable revocation request already exists; use its original reason and withdrawals", 409);
   if (prior.state === "FAILED") {
    await tx.revocation.update({where: {id: prior.id}, data: {state: "PENDING", lastError: null}});
    await tx.job.update({where: {idempotencyKey: "revoke:" + version.id}, data: {state: "QUEUED", availableAt: new Date(), attempts: 0, leaseOwner: null, leaseUntil: null, lastError: null}});
    await tx.auditEvent.create({data: {actorId: user.subject, action: "REVOCATION_RETRIED", targetId: version.id, detail: {}}});
   }
   return tx.revocation.findUniqueOrThrow({where: {id: prior.id}});
  }
  if (version.passport.activeVersionId) throw new DomainError("ISSUANCE_ACTIVE", "Finish the reserved issuance before revoking a version", 409);
  const request = await tx.revocation.create({data: {versionId: version.id, reason, actorId: user.subject, withdrawnRecords: [...withdrawRecordIds].sort(), ...revocationCommitments(reason, user.subject, version.id)}});
  for (const a of selected) await tx.awardWithdrawal.upsert({where: {awardId: a.awardId}, create: {awardId: a.awardId, actorId: user.subject, reason}, update: {}});
  await tx.job.create({data: {type: "REVOKE", stage: "REVOKE", versionId: version.id, idempotencyKey: "revoke:" + version.id}});
  await tx.auditEvent.create({data: {actorId: user.subject, action: "REVOCATION_REQUESTED", targetId: version.id, detail: {reason, withdrawnRecords: withdrawRecordIds, revocationId: request.id}}});
  return request;
 });
}

/** Uses the same job lease, signed-attempt outbox and reconciliation strategy as issuance. */
export async function processRevocation(versionId: string, checkLease: () => Promise<void>, fence: (tx: Prisma.TransactionClient, pending: boolean) => Promise<void>) {
 const request = await prisma.revocation.findUniqueOrThrow({where: {versionId}, include: {version: true}});
 const proof = await verifyDevnet(request.version.code);
 if (proof.registration !== "REGISTERED" || proof.version !== request.version.number || proof.pdfSha256 !== request.version.pdfSha256 || proof.programId !== request.version.chainProgramId || proof.versionPda !== request.version.versionPda) throw new DomainError(proof.errorCode || "PROOF_CONFLICT", "Unable to reconcile the exact finalized issuance", 503, true);
 if (proof.revocation === "REVOKED" && proof.revocationEvidence) {
  // On-chain invalidation is authoritative even if another permitted authority submitted it.
  await prisma.$transaction(async tx => {
   await fence(tx, false);
   await tx.revocation.update({where: {id: request.id}, data: {state: "REVOKED", finalizedSlot: BigInt(proof.revocationEvidence!.revokedSlot), finalizedAt: new Date(Number(proof.revocationEvidence!.revokedUnix) * 1000), revocationPda: proof.revocationEvidence!.pda, lastError: null}});
   await tx.auditEvent.create({data: {actorId: request.actorId, action: proof.revocationEvidence!.reasonDigest === request.reasonDigest && proof.revocationEvidence!.actorDigest === request.actorDigest ? "REVOCATION_FINALIZED" : "REVOCATION_FINALIZED_EXTERNAL", targetId: versionId, detail: proof.revocationEvidence!}});
  });
  return;
 }
 if (proof.revocation !== "VALID") throw new DomainError("RPC_UNAVAILABLE", "Revocation status is unknown", 503, true);
 let attempt = await prisma.revocationAttempt.findFirst({where: {revocationId: request.id, state: {in: ["SIGNED", "SUBMITTED"]}}, orderBy: {createdAt: "desc"}});
 if (attempt) {
  const state = await attemptStatus(attempt);
  if (state === "OBSERVED") { await prisma.$transaction(tx => fence(tx, true)); return; }
  if (state === "FAILED" || state === "EXPIRED") {
   await checkLease();
   await prisma.revocationAttempt.update({where: {id: attempt.id}, data: {state}});
   attempt = null;
   if (state === "FAILED") throw new DomainError("CHAIN_REJECTED", "Revocation transaction failed; inspect program activation and retry", 409);
  }
 }
 if (!attempt) {
  await checkLease();
  const signed = await signRevocation({code: request.version.code, reasonDigest: request.reasonDigest, actorDigest: request.actorDigest});
  await checkLease();
  // Fence in the SAME transaction as persistence. No broadcast happens before this commit.
  await prisma.$transaction(async tx => {
   await fence(tx, true);
   attempt = await tx.revocationAttempt.create({data: {...signed, revocationId: request.id}});
  });
  // The job was released by fence; the next claim broadcasts persisted bytes.
  return;
 }
 await checkLease();
 await broadcast(attempt);
 await prisma.$transaction(async tx => {
  await fence(tx, true);
  await tx.revocationAttempt.update({where: {id: attempt!.id}, data: {state: "SUBMITTED"}});
 });
}

/** Explicit corrected issuance. Never promotes an old version and never mutates history. */
export async function requestCorrection(user: Identity, passportId: string) {
 requireAdmin(user);
 return prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(744092101)`;
  const passport = await tx.passport.findFirst({where: {OR: [{id: passportId}, {publicId: passportId}]}, include: {student: {include: {awards: {include: {withdrawal: true}}}}}});
  if (!passport) throw new DomainError("NOT_FOUND", "Passport not found", 404);
  if (passport.activeVersionId) return tx.version.findUniqueOrThrow({where: {id: passport.activeVersionId}});
  if (await tx.revocation.count({where: {version: {passportId: passport.id}, state: {not: "REVOKED"}}})) throw new DomainError("REVOCATION_PENDING", "Resolve pending or failed revocations first", 409);
  const latest = await tx.version.findUnique({where: {passportId_number: {passportId: passport.id, number: passport.latestFinalizedVersion}}, include: {revocation: true}});
  if (latest?.revocation?.state !== "REVOKED") throw new DomainError("CORRECTION_NOT_REQUIRED", "Correction requires revocation of the latest issued version", 409);
  const awards: Award[] = passport.student.awards.filter(a => !a.withdrawal).map(a => ({recordId: a.sourceRecordId, studentId: passport.student.externalId, skillId: a.skillId, name: a.name, category: a.category as Award["category"], badgeCode: a.badgeCode, description: a.description, dateEarned: a.earnedAt.toISOString().slice(0, 10)}));
  if (!awards.length) throw new DomainError("NO_VALID_AWARDS", "No eligible awards remain; keep the passport without a current credential", 409);
  const base = latest.snapshot as unknown as Snapshot;
  const code = newCode(), frozen = snapshot(base.student, awards, passport.nextVersion, code);
  // A correction is a new auditable intent even if it restores an earlier award set.
  const intentDigest = sha256(Buffer.from(JSON.stringify({corrects: latest.id, awards: frozen.awards})));
  const existing = await tx.version.findUnique({where: {passportId_intentDigest: {passportId: passport.id, intentDigest}}});
  if (existing) return existing;
  const version = await tx.version.create({data: {passportId: passport.id, number: passport.nextVersion, code, codeHash: sha256(Buffer.from(code)), intentDigest, snapshot: frozen as unknown as Prisma.InputJsonValue, stagingKey: `demo/${passport.opaqueChainRef}/v${passport.nextVersion}/${code}/artifact.pdf`, state: "QUEUED"}});
  await tx.versionAward.createMany({data: frozen.awards.map((a, displayOrder) => ({versionId: version.id, awardId: passport.student.awards.find(x => x.sourceRecordId === a.recordId)!.id, displayOrder}))});
  await tx.passport.update({where: {id: passport.id}, data: {activeVersionId: version.id, nextVersion: {increment: 1}}});
  await tx.job.create({data: {versionId: version.id, type: "ISSUE", stage: "PDF", idempotencyKey: "issue:" + version.id}});
  await tx.auditEvent.create({data: {actorId: user.subject, action: "CORRECTED_VERSION_RESERVED", targetId: version.id, detail: {corrects: latest.id, awards: awards.length}}});
  return version;
 });
}
