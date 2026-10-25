import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {prisma} from '../packages/db/src';
import {fetchSheetRows, inputFingerprint} from '../packages/core/src/sheets';
import {artifactStore, sha256} from '../packages/core/src';
import {supabaseAuthServiceConfig} from '../packages/core/src/config';

async function main() {
 if (process.env.SOURCE_MODE !== 'sheets' || process.env.CHAIN_MODE !== 'devnet') throw Error('Live Sheets and Devnet configuration required');
 const rows = await fetchSheetRows();
 const browserEvidence = await readFile('docs/evidence/hosted-browser.json', 'utf8').then(JSON.parse).catch(() => null);
 const manualEvidence = await readFile('docs/evidence/hosted-manual.json', 'utf8').then(JSON.parse).catch(() => null);
 const syncs = await prisma.sourceSync.findMany({where: {sourceId: process.env.GOOGLE_SHEET_ID}});
 const byRecord = new Map(syncs.map(sync => [sync.sourceRecordId, sync]));
 const versions = await prisma.version.findMany({where: {finalizedSlot: {not: null}}, include: {passport: {include: {student: true}}}});
 assert.ok(rows.length >= 60, 'Expected the complete demo source');
 for (const row of rows) {
  const sync = byRecord.get(row.award.recordId);
  assert.ok(sync?.syncedVersion, 'Source row has no real writeback: ' + row.award.recordId);
  assert.equal(sync.status, 'SYNCED');
  assert.equal(sync.fingerprint, inputFingerprint(row));
  assert.equal(row.syncStatus, 'SYNCED');
  assert.equal(row.syncedVersion, 'V' + sync.syncedVersion);
  assert.equal(row.syncedAt, sync.syncedAt?.toISOString());
  const version = versions.find(version => version.number === sync.syncedVersion && version.passport.student.externalId === row.student.studentId);
  assert.ok(version?.txSignature && version.versionPda && version.pdfSha256);
  assert.equal(version.chainCluster, 'devnet');
  assert.equal(version.chainProgramId, process.env.SOLANA_PROGRAM_ID);
 }
 const store = artifactStore();
 for (const version of versions) assert.equal(sha256(await store.get(version.storageKey!)), version.pdfSha256);
 console.log('PASS real source writeback, immutable storage and finalized proof context for ' + rows.length + ' awards');

 const origin = new URL(process.env.VERIFICATION_PUBLIC_ORIGIN!).origin;
 const latest = versions.filter(version => version.passport.student.externalId === 'BTU-T-0001').sort((a, b) => b.number - a.number)[0];
 assert.ok(latest, 'Expected the first demo student passport');
 const original = await store.get(latest.storageKey!);
 const code = await fetch(origin + '/api/v1/verify/' + latest.code);
 assert.equal(code.status, 200);
 const proof = await code.json();
 assert.equal(proof.registration, 'REGISTERED'); assert.equal(proof.currency, 'LATEST'); assert.equal(proof.officialBtu, false);
 const upload = async (bytes: Uint8Array) => {
  const form = new FormData(); form.set('code', latest.code); form.set('file', new Blob([Buffer.from(bytes)], {type: 'application/pdf'}), 'demo.pdf');
  return fetch(origin + '/api/v1/verify/file', {method: 'POST', body: form});
 };
 assert.equal((await upload(original)).status, 200);
 const tampered = Uint8Array.from(original); tampered[tampered.length - 10] ^= 1;
 assert.equal((await upload(tampered)).status, 422);
 const credentials = JSON.parse(await readFile('.secrets/demo-logins.json', 'utf8'));
 const config = supabaseAuthServiceConfig();
 const login = async (name: string) => {
  const credential = credentials[name];
  const response = await fetch(config.url + '/auth/v1/token?grant_type=password', {method: 'POST', headers: {'Content-Type': 'application/json', apikey: config.apikey}, body: JSON.stringify({email: credential.email, password: credential.password})});
  assert.equal(response.status, 200);
  return 'Bearer ' + (await response.json()).access_token;
 };
 const token = await login('BTU-T-0001'), other = await login('BTU-T-0003');
 const downloadPath = '/api/v1/me/passport/versions/' + latest.number + '/download';
 const downloaded = await fetch(origin + downloadPath, {headers: {authorization: token}});
 assert.equal(downloaded.status, 200); assert.equal(sha256(new Uint8Array(await downloaded.arrayBuffer())), latest.pdfSha256);
 assert.equal((await fetch(origin + downloadPath)).status, 401);
 const unrelated = await fetch(origin + downloadPath, {headers: {authorization: other}});
 if (unrelated.status === 200) assert.notEqual(sha256(new Uint8Array(await unrelated.arrayBuffer())), latest.pdfSha256);
 else assert.equal(unrelated.status, 404);
 assert.equal((await fetch(origin + '/api/v1/admin/passports', {headers: {authorization: token}})).status, 403);
 console.log('PASS hosted public code/file verification, one-bit tamper rejection, private download and ownership/admin denial');
 await mkdir('docs/evidence', {recursive: true});
 await writeFile('docs/evidence/live-sheets.json', JSON.stringify({checkedAt: new Date().toISOString(), source: process.env.GOOGLE_SHEET_ID, sourceAwards: rows.length, passports: new Set(versions.map(version => version.passportId)).size, finalizedVersions: versions.length, syncedRecords: syncs.filter(sync => sync.status === 'SYNCED').length, officialBtu: false, runtime: 'HOSTED_WEB_API_ACCEPTANCE_WITH_REAL_GOOGLE_SHEETS_SUPABASE_DEVNET', checks: ['renewable service-account access', 'stable row metadata', 'real finalized Devnet evidence before writeback', 'Q–T status/version/timestamp readback', 'exact private PDF hashes', 'hosted anonymous verification', 'hosted original PDF accepted', 'hosted one-bit tamper rejected', 'hosted authenticated download', 'anonymous and unrelated-document denial', 'student denied admin access'], googleOAuthBrowserEvidence: browserEvidence?.googleOAuthBrowserEvidence === true, hostedManualEvidence: manualEvidence?.processingMode === 'ADMIN_TRIGGERED_HTTP_STAGES_WITH_NO_DAEMON', persistentCloudWorker: false, unattendedPolling: false, proofs: versions.map(version => ({passportId: version.passport.publicId, version: version.number, code: version.code, pdfSha256: version.pdfSha256, versionPda: version.versionPda, signature: version.txSignature}))}, null, 2) + '\n');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Live acceptance failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
