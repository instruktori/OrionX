import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {Connection, Keypair, PublicKey} from '@solana/web3.js';
import {prisma} from '../packages/db/src';
import {supabaseStorageConfig} from '../packages/core/src/config';
import {clusterPolicy} from '../packages/core/src/cluster';
import {configAddress, parseConfig} from '../packages/core/src/protocol';
import {fetchSheetRows, sheetsClient} from '../packages/core/src/sheets';
import {newCode} from '../packages/core/src';

type Result = {name: string; passed: boolean; detail: string};
const results: Result[] = [];
async function check(name: string, run: () => Promise<string>) {
 try { results.push({name, passed: true, detail: await run()}); }
 catch (error) { results.push({name, passed: false, detail: error instanceof Error ? error.message : 'Check failed'}); }
 const result = results.at(-1)!;
 console.log(`${result.passed ? 'PASS' : 'FAIL'} ${name}: ${result.detail}`);
}

async function main() {
 await check('Database schema', async () => {
  await prisma.$queryRaw`SELECT 1 FROM "StudentWorkspace" LIMIT 1`;
  await prisma.version.count({where: {chainGenesisHash: {not: null}}});
  return 'Workspace and chain-proof schema accessible';
 });
 await check('Private durable storage', async () => {
  if (process.env.STORAGE_MODE !== 'supabase') throw Error('STORAGE_MODE must be supabase for hosted issuance');
  const config = supabaseStorageConfig();
  const response = await fetch(`${config.url}/storage/v1/bucket/${config.bucket}`, {headers: config.headers, signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Bucket lookup failed (HTTP ' + response.status + ')');
  const bucket = await response.json();
  if (bucket.public !== false) throw Error('PDF bucket must be private');
  return 'Configured bucket exists and is private';
 });
 await check('Devnet program and issuer', async () => {
  if (process.env.CHAIN_MODE !== 'devnet') throw Error('CHAIN_MODE must be devnet');
  const policy = clusterPolicy();
  const connection = new Connection(policy.rpc, {commitment: 'finalized', disableRetryOnRateLimit: true, fetch: (url, init) => fetch(url, {...init, signal: AbortSignal.timeout(15000)})});
  if (await connection.getGenesisHash() !== policy.genesisHash) throw Error('RPC genesis hash does not match pinned Devnet');
  const program = new PublicKey(process.env.SOLANA_PROGRAM_ID!);
  if (!(await connection.getAccountInfo(program))?.executable) throw Error('Program is not deployed');
  const account = await connection.getAccountInfo(configAddress(program)[0]);
  if (!account?.owner.equals(program)) throw Error('Issuer config owner is invalid');
  const config = parseConfig(account.data);
  if (config.paused) throw Error('Issuer is paused');
  if (process.argv.includes('--worker')) {
   const path = process.env.SOLANA_ISSUER_KEYPAIR_PATH;
   if (!path) throw Error('Worker issuer keypair path is missing');
   const signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, 'utf8'))));
   if (!signer.publicKey.equals(config.issuer)) throw Error('Worker signer does not match active issuer');
   if (await connection.getBalance(config.issuer) < 10000000) throw Error('Issuer has less than 0.01 Devnet SOL for rent and fees');
  }
  return 'Pinned Devnet program deployed; issuer active' + (process.argv.includes('--worker') ? '; funded worker signer matches' : '');
 });
 if (process.argv.includes('--sheets') || process.env.SOURCE_MODE === 'sheets') {
  await check('Live Google Sheets', async () => {
   if (!process.env.GOOGLE_DATA_RANGE) throw Error('Configure an expanding GOOGLE_DATA_RANGE (for example PassportRecords)');
   const {sheets, sheetId} = await sheetsClient();
   const rows = await fetchSheetRows();
   const response = await sheets.spreadsheets.developerMetadata.search({spreadsheetId: sheetId, requestBody: {dataFilters: [{developerMetadataLookup: {metadataKey: 'orionx.record', visibility: 'DOCUMENT'}}]}});
   const bindings = new Map<string, number>();
   for (const match of response.data.matchedDeveloperMetadata || []) {
    const record = match.developerMetadata?.metadataValue;
    if (record) bindings.set(record, (bindings.get(record) || 0) + 1);
   }
   if (rows.some(row => bindings.get(row.award.recordId) !== 1)) throw Error('Each source record needs one stable row metadata binding');
   return `${rows.length} valid source rows; unique metadata bindings present (read-only check)`;
  });
 }
 if (process.argv.includes('--hosted')) {
  await check('Hosted web and public verification', async () => {
   const origin = new URL(process.env.VERIFICATION_PUBLIC_ORIGIN!).origin;
   if (!origin.startsWith('https://')) throw Error('Hosted verification origin must use HTTPS');
   for (const [path, expected] of [['/verify', 200], ['/api/v1/health/live', 200], ['/api/v1/health/ready', 200], ['/api/v1/verify/' + newCode(), 404]] as const) {
    const response = await fetch(origin + path, {redirect: 'manual', signal: AbortSignal.timeout(20000)});
    if (response.status !== expected) throw Error(path.split('/verify/')[0] + ': expected HTTP ' + expected + ', received ' + response.status);
   }
   return 'Web, API readiness and anonymous Devnet code lookup reachable over HTTPS';
  });
 }
 if (process.argv.includes('--evidence')) {
  await mkdir('docs/evidence', {recursive: true});
  await writeFile('docs/evidence/readiness.json', JSON.stringify({checkedAt: new Date().toISOString(), checks: results, complete: results.every(result => result.passed), scope: {worker: process.argv.includes('--worker'), sheets: process.argv.includes('--sheets') || process.env.SOURCE_MODE === 'sheets', hosted: process.argv.includes('--hosted')}, note: 'Read-only readiness checks. These do not establish live writeback, a persistent hosted worker, or authenticated browser acceptance.'}, null, 2) + '\n');
 }
 if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(() => { console.error('Readiness check could not complete'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
