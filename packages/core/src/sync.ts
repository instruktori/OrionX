import {randomBytes, randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {prisma} from "@orionx/db";
import {newCode, snapshot, sha256, type Award, type Student} from "./index";
import {fetchSheetRows, inputFingerprint, type SourceRow} from "./sheets";
import {fixtureRows, skillCatalog} from "./fixtures";
import {DomainError} from "./errors";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const awardFingerprint = (award: Award) => sha256(Buffer.from(JSON.stringify(award)));
export async function sourceRows() {
  const mode = process.env.SOURCE_MODE || "fixture";
  if (mode === "fixture") return fixtureRows();
  if (mode === "sheets") return fetchSheetRows();
  throw new DomainError("INVALID_SOURCE", "Unsupported source mode", 503);
}
export function sourceId() {
 const mode = process.env.SOURCE_MODE || "fixture";
 if (mode === "fixture") return "fixture";
 if (mode !== "sheets") throw new DomainError("INVALID_SOURCE", "Unsupported source mode", 503);
 if (!process.env.GOOGLE_SHEET_ID) throw new DomainError("SOURCE_UNCONFIGURED", "GOOGLE_SHEET_ID is required for live synchronization", 503);
 return process.env.GOOGLE_SHEET_ID;
}

/** Connect already finalized demo versions to the live source without reissuing them. */
export async function queueLiveWritebacks(tx: Prisma.TransactionClient, rows: SourceRow[]) {
 if (process.env.SOURCE_MODE !== "sheets") return 0;
 const byRecord = new Map(rows.map(row => [row.award.recordId, row]));
 const deferred = await tx.sheetWriteback.findMany({where: {recordId: {in: [...byRecord.keys()]}, state: "FIXTURE_ONLY", version: {chainCluster: "devnet", chainProgramId: process.env.SOLANA_PROGRAM_ID, finalizedSlot: {not: null}}}});
 const versions = new Set<string>();
 for (const update of deferred) {
  await tx.sheetWriteback.update({where: {id: update.id}, data: {state: "PENDING", completedAt: null, expectedFingerprint: inputFingerprint(byRecord.get(update.recordId)!)}});
  versions.add(update.versionId);
 }
 for (const versionId of versions) {
  await tx.job.upsert({where: {idempotencyKey: "live-writeback:" + versionId + ":" + sourceId()}, create: {type: "ISSUE", stage: "WRITEBACK", versionId, idempotencyKey: "live-writeback:" + versionId + ":" + sourceId()}, update: {}});
  await tx.version.update({where: {id: versionId}, data: {state: "SYNC_WRITEBACK_PENDING"}});
  await tx.auditEvent.create({data: {action: "LIVE_WRITEBACK_QUEUED", targetId: versionId, detail: {sourceId: sourceId()}}});
 }
 return versions.size;
}
export async function queueSynchronization(key: string, actorId: string) {
  if (!key || key.length > 200) throw new DomainError("INVALID_REQUEST", "Invalid idempotency key", 400);
  return prisma.$transaction(async tx => {
    const run = await tx.importRun.upsert({where: {idempotencyKey: key}, create: {sourceId: sourceId(), idempotencyKey: key, state: "QUEUED", totals: {}}, update: {}});
    await tx.job.upsert({where: {idempotencyKey: "sync:" + key}, create: {type: "SYNC", stage: "SYNC", idempotencyKey: "sync:" + key}, update: {}});
    await tx.auditEvent.create({data: {actorId, action: "SYNC_REQUESTED", targetId: run.id, detail: {sourceId: sourceId()}}});
    return run;
  });
}
export async function synchronize(key: string = randomUUID(), actorId = "worker", suppliedRows?: SourceRow[]) {
  if (!key || key.length > 200) throw new DomainError("INVALID_REQUEST", "Invalid idempotency key", 400);
  const previous = await prisma.importRun.findUnique({where: {idempotencyKey: key}});
  if (previous && !["QUEUED", "RUNNING", "FAILED"].includes(previous.state)) return previous;
  if (previous?.state === "FAILED") await prisma.importRun.updateMany({where: {id: previous.id, state: "FAILED"}, data: {state: "RUNNING", error: null, completedAt: null}});
  const run = await prisma.importRun.upsert({where: {idempotencyKey: key}, create: {sourceId: sourceId(), idempotencyKey: key, totals: {}}, update: {}});
  if (!["QUEUED", "RUNNING"].includes(run.state)) return run;
  try {
    const rows = suppliedRows || await sourceRows();
    const catalog = skillCatalog();
    return await prisma.$transaction(async tx => {
      // PostgreSQL queue is the explicit infrastructure-reducing ADR-05 fallback.
      // This short transaction serializes import/reservation; no rendering/RPC occurs here.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(744092101)`;
      const current = await tx.importRun.findUniqueOrThrow({where: {id: run.id}});
      if (!["QUEUED", "RUNNING"].includes(current.state)) return current;
      const totals = {students: 0, awards: rows.length, newAwards: 0, queued: 0, writebacksQueued: 0, conflicts: 0, pendingSource: rows.filter(r => r.syncStatus === "NOT SYNCED").length, simulatedSource: rows.filter(r => r.syncStatus === "SYNCED").length};
      const savedStudents = await tx.student.findMany({where: {externalId: {in: rows.map(r => r.student.studentId)}}, include: {passport: true, awards: true}});
      const studentMap = new Map(savedStudents.map(s => [s.externalId, s]));
      const awardOwners = new Map((await tx.award.findMany({where: {sourceRecordId: {in: rows.map(r => r.award.recordId)}}, select: {sourceRecordId: true, studentId: true}})).map(a => [a.sourceRecordId, a.studentId]));
      const savedSyncs = new Map((await tx.sourceSync.findMany({where: {sourceRecordId: {in: rows.map(r => r.award.recordId)}}})).map(r => [r.sourceRecordId, r]));
      const groups = new Map<string, SourceRow[]>();
      for (const row of rows) groups.set(row.student.studentId, [...(groups.get(row.student.studentId) || []), row]);
      const changedRows = rows.filter(row => savedSyncs.get(row.award.recordId)?.fingerprint !== inputFingerprint(row) || savedSyncs.get(row.award.recordId)?.sourceId !== sourceId());
      if (changedRows.length) await tx.sourceObservation.createMany({data: changedRows.map(row => ({runId: run.id, recordId: row.award.recordId, fingerprint: inputFingerprint(row), payload: json(row)}))});
      for (const [externalId, group] of groups) {
        const input = group[0].student;
        const existing = studentMap.get(externalId);
        const conflict = async (reason: string, recordId?: string) => {
          totals.conflicts++;
          await tx.importConflict.create({data: {runId: run.id, studentId: externalId, recordId, reason, payload: json(group)}});
        };
        let problem = "";
        for (const row of group) {
          const known = catalog.get(row.award.skillId);
          if (!known || ["name", "category", "badgeCode", "description"].some(k => row.award[k as keyof Award] !== known[k as keyof Award])) problem = "Unknown or changed catalog definition: " + row.award.skillId;
          if (JSON.stringify(row.student) !== JSON.stringify(input)) problem = "Inconsistent student identity";
        }
        if (existing) {
          if (existing.firstName !== input.firstName || existing.lastName !== input.lastName || (input.passportId && existing.passport?.publicId !== input.passportId) || (input.initialIssueDate && existing.passport?.initialIssueDate.toISOString().slice(0, 10) !== input.initialIssueDate)) problem = "Immutable passport identity changed";
          for (const prior of existing.awards) {
            const row = group.find(r => r.award.recordId === prior.sourceRecordId);
            if (!row) problem = "Historical award removed: " + prior.sourceRecordId;
            else if (awardFingerprint(row.award) !== prior.sourceFingerprint) problem = "Historical award changed: " + prior.sourceRecordId;
          }
        }
        if (group.some(row => awardOwners.has(row.award.recordId) && awardOwners.get(row.award.recordId) !== existing?.id)) problem = "Record ID already belongs to another student";
        for (const row of group) {
          const synced = savedSyncs.get(row.award.recordId);
          if (synced?.syncedVersion && (row.syncStatus !== "SYNCED" || row.syncedVersion !== "V" + synced.syncedVersion || row.syncedAt !== synced.syncedAt?.toISOString())) problem = "System-managed synchronized output changed: " + row.award.recordId;
        }
        if (problem) { await conflict(problem); continue; }
        totals.writebacksQueued += await queueLiveWritebacks(tx, group);
        const unchanged = existing?.passport && existing.awards.length === group.length && group.every(row => savedSyncs.get(row.award.recordId)?.fingerprint === inputFingerprint(row) && savedSyncs.get(row.award.recordId)?.sourceId === sourceId());
        if (unchanged && (existing.passport!.activeVersionId || existing.awards.every(a => a.firstIncludedVersion !== null))) { totals.students++; continue; }
        const student = existing || await tx.student.create({data: {externalId, email: input.email, firstName: input.firstName, lastName: input.lastName, program: input.program, educationLevel: input.educationLevel, status: input.status}});
        const passport = existing?.passport || await tx.passport.create({data: {studentId: student.id, publicId: input.passportId || "BTU-AI-" + randomUUID(), initialIssueDate: new Date((input.initialIssueDate || new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Tbilisi"}).format(new Date())) + "T00:00:00Z"), opaqueChainRef: randomBytes(32).toString("hex")}});
        const awardIds = new Map((existing?.awards || []).map(a => [a.sourceRecordId, a.id]));
        const additions = group.filter(r => !awardIds.has(r.award.recordId)).map(row => {
          const a = row.award, id = randomUUID(); awardIds.set(a.recordId, id);
          return {id, sourceRecordId: a.recordId, studentId: student.id, skillId: a.skillId, name: a.name, category: a.category, badgeCode: a.badgeCode, description: a.description, earnedAt: new Date(a.dateEarned + "T00:00:00Z"), sourceFingerprint: awardFingerprint(a)};
        });
        if (additions.length) { await tx.award.createMany({data: additions}); totals.newAwards += additions.length; }
        const unobserved = group.filter(row => !savedSyncs.has(row.award.recordId));
        if (unobserved.length) await tx.sourceSync.createMany({data: unobserved.map(row => ({sourceRecordId: row.award.recordId, sourceId: sourceId(), sourceStudentId: externalId, fingerprint: inputFingerprint(row), status: "UNANCHORED", originalState: json({status: row.syncStatus, version: row.syncedVersion, at: row.syncedAt, notes: row.syncError})}))});
        for (const row of group) {
          const saved = savedSyncs.get(row.award.recordId);
          if (saved && (saved.sourceId !== sourceId() || saved.fingerprint !== inputFingerprint(row))) await tx.sourceSync.update({where: {id: saved.id}, data: {sourceId: sourceId(), fingerprint: inputFingerprint(row)}});
        }
        totals.students++;
        if (passport.activeVersionId) continue;
        const identity: Student = {...input, passportId: passport.publicId, initialIssueDate: passport.initialIssueDate.toISOString().slice(0, 10)};
        const code = newCode(), frozen = snapshot(identity, group.map(r => r.award), passport.nextVersion, code);
        frozen.sourceFingerprints = Object.fromEntries(group.map(row => [row.award.recordId, inputFingerprint(row)]));
        const intentDigest = sha256(Buffer.from(JSON.stringify(frozen.awards)));
        if (await tx.version.findUnique({where: {passportId_intentDigest: {passportId: passport.id, intentDigest}}})) continue;
        const version = await tx.version.create({data: {passportId: passport.id, number: passport.nextVersion, code, codeHash: sha256(Buffer.from(code)), intentDigest, snapshot: json(frozen), stagingKey: "demo/" + passport.opaqueChainRef + "/v" + passport.nextVersion + "/" + code + "/artifact.pdf", state: "QUEUED"}});
        await tx.versionAward.createMany({data: frozen.awards.map((a, displayOrder) => ({versionId: version.id, awardId: awardIds.get(a.recordId)!, displayOrder}))});
        await tx.passport.update({where: {id: passport.id}, data: {activeVersionId: version.id, nextVersion: {increment: 1}}});
        await tx.job.create({data: {versionId: version.id, type: "ISSUE", stage: "PDF", idempotencyKey: "issue:" + version.id}});
        await tx.auditEvent.create({data: {actorId, action: "VERSION_RESERVED", targetId: version.id, detail: {number: version.number, awards: frozen.awards.length, mode: "DEMO"}}});
        totals.queued++;
      }
      return tx.importRun.update({where: {id: run.id}, data: {state: totals.conflicts ? "COMPLETED_WITH_CONFLICTS" : "COMPLETED", totals, completedAt: new Date()}});
    }, {timeout: 60000, maxWait: 15000});
  } catch (error) {
    await prisma.importRun.update({where: {id: run.id}, data: {state: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Import failed", completedAt: new Date()}});
    throw error;
  }
}
