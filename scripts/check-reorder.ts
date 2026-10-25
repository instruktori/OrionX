import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {prisma} from '../packages/db/src';
import {fetchSheetRows, inputFingerprint, sheetsClient} from '../packages/core/src/sheets';
import {synchronize} from '../packages/core/src/sync';

async function main() {
 if (process.env.SOURCE_MODE !== 'sheets') throw Error('Live source required');
 const {sheets, sheetId} = await sheetsClient();
 if (sheetId !== '1myYLRd8gSwhmHoe8rcY3D1Y2NJhMU55AzRs1HGnVQMQ') throw Error('Only the prepared demo copy may be tested');
 const before = await fetchSheetRows(), first = before[0];
 const sheetTabId = Number(process.env.GOOGLE_SHEET_TAB_ID);
 const index = first.rowNumber - 1, versionCount = await prisma.version.count();
 let moved = false, observedIndex: number | undefined;
 try {
  await sheets.spreadsheets.batchUpdate({spreadsheetId: sheetId, requestBody: {requests: [{moveDimension: {source: {sheetId: sheetTabId, dimension: 'ROWS', startIndex: index, endIndex: index + 1}, destinationIndex: index + 3}}]}});
  moved = true;
  const after = await fetchSheetRows(), lookup = new Map(after.map(row => [row.award.recordId, row]));
  for (const row of before) assert.equal(inputFingerprint(lookup.get(row.award.recordId)!), inputFingerprint(row));
  const metadata = await sheets.spreadsheets.developerMetadata.search({spreadsheetId: sheetId, requestBody: {dataFilters: [{developerMetadataLookup: {metadataKey: 'orionx.record', metadataValue: first.award.recordId, visibility: 'DOCUMENT'}}]}});
  assert.equal(metadata.data.matchedDeveloperMetadata?.length, 1);
  observedIndex = metadata.data.matchedDeveloperMetadata![0].developerMetadata?.location?.dimensionRange?.startIndex ?? undefined;
  assert.equal(observedIndex, lookup.get(first.award.recordId)!.rowNumber - 1);
  assert.notEqual(observedIndex, index);
  const run = await synchronize('live-reorder-' + randomUUID(), 'live-acceptance');
  assert.equal((run.totals as {queued: number}).queued, 0);
  assert.equal((run.totals as {conflicts: number}).conflicts, 0);
  assert.equal(await prisma.version.count(), versionCount);
 } finally {
  if (moved) {
   const current = (await fetchSheetRows()).find(row => row.award.recordId === first.award.recordId);
   assert.ok(current);
   await sheets.spreadsheets.batchUpdate({spreadsheetId: sheetId, requestBody: {requests: [{moveDimension: {source: {sheetId: sheetTabId, dimension: 'ROWS', startIndex: current.rowNumber - 1, endIndex: current.rowNumber}, destinationIndex: index}}]}});
  }
 }
 assert.deepEqual((await fetchSheetRows()).map(row => row.award.recordId), before.map(row => row.award.recordId));
 await writeFile('docs/evidence/live-reorder.json', JSON.stringify({checkedAt: new Date().toISOString(), source: sheetId, rows: before.length, metadataFollowedMovedRow: true, inputFingerprintsPreserved: true, newVersions: 0, conflicts: 0, originalOrderRestored: true}, null, 2) + '\n');
 console.log('PASS live row move, metadata following, input preservation, no duplicate issuance and original-order restoration');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Reorder test failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
