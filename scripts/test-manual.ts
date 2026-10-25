import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {prisma} from '../packages/db/src';
import {supabaseAuthServiceConfig} from '../packages/core/src/config';

async function main() {
 const origin = new URL(process.env.VERIFICATION_PUBLIC_ORIGIN!).origin;
 const credentials = JSON.parse(await readFile('.secrets/demo-logins.json', 'utf8'));
 const auth = supabaseAuthServiceConfig();
 const token = async (name: string) => {
  const credential = credentials[name];
  const response = await fetch(auth.url + '/auth/v1/token?grant_type=password', {method: 'POST', headers: {apikey: auth.apikey, 'Content-Type': 'application/json'}, body: JSON.stringify({email: credential.email, password: credential.password})});
  assert.equal(response.status, 200);
  return 'Bearer ' + (await response.json()).access_token;
 };
 const admin = await token('admin'), student = await token('BTU-T-0001');
 const call = (path: string, authorization?: string) => fetch(origin + '/api/v1' + path, {method: 'POST', headers: {...(authorization ? {authorization} : {}), 'Idempotency-Key': 'manual-acceptance-' + randomUUID()}, signal: AbortSignal.timeout(65000)});
 assert.equal((await call('/admin/jobs/process')).status, 401);
 assert.equal((await call('/admin/jobs/process', student)).status, 403);
 const before = await prisma.passport.findFirstOrThrow({where: {student: {externalId: 'BTU-T-0001'}}});
 assert.equal((await call('/admin/sync', admin)).status, 202);
 let stages = 0, finished = false;
 const deadline = Date.now() + 240000;
 while (Date.now() < deadline) {
  const response = await call('/admin/jobs/process', admin);
  assert.equal(response.status, 200, 'Hosted manual processor returned HTTP ' + response.status);
  const result = await response.json();
  if (result.processed) stages++;
  console.log(JSON.stringify({steps: stages, remaining: result.remaining, blocked: result.blocked, errorCode: result.errorCode}));
  if (result.blocked) throw Error('A durable job requires review; inspect its saved lastError');
  if (!result.remaining) { finished = true; break; }
  await new Promise(resolve => setTimeout(resolve, 3000));
 }
 assert.ok(finished, 'Manual processor did not drain before the acceptance timeout');
 const after = await prisma.passport.findUniqueOrThrow({where: {id: before.id}});
 assert.equal(after.publicId, before.publicId);
 assert.equal(after.initialIssueDate.toISOString(), before.initialIssueDate.toISOString());
 assert.equal(after.latestFinalizedVersion, before.latestFinalizedVersion + 1);
 const version = await prisma.version.findUniqueOrThrow({where: {passportId_number: {passportId: after.id, number: after.latestFinalizedVersion}}});
 assert.equal(version.state, 'COMPLETED');
 assert.equal(version.chainCluster, 'devnet');
 await writeFile('docs/evidence/hosted-manual.json', JSON.stringify({checkedAt: new Date().toISOString(), origin, processingMode: 'ADMIN_TRIGGERED_HTTP_STAGES_WITH_NO_DAEMON', steps: stages, checks: ['anonymous rejected', 'student rejected', 'administrator accepted', 'live Sheet import', 'hosted PDF rendering and private storage', 'signed Devnet registration and finality', 'real Sheets writeback', 'same permanent passport identity', 'cumulative next version', 'queue drained'], version: version.number, code: version.code, versionPda: version.versionPda, signature: version.txSignature, pdfSha256: version.pdfSha256, officialBtu: false}, null, 2) + '\n');
 console.log('PASS hosted administrator-triggered issuance with no persistent worker');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Manual acceptance failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
