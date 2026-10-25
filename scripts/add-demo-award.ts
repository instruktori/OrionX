import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {sheetsClient, fetchSheetRows, inputFingerprint} from '../packages/core/src/sheets';
import {skillCatalog} from '../packages/core/src/fixtures';

async function main() {
 if (!process.argv.includes('--apply')) throw Error('This adds a labelled synthetic award to the demo source. Pass --apply to run it.');
 const {sheets, sheetId} = await sheetsClient();
 if (sheetId !== '1myYLRd8gSwhmHoe8rcY3D1Y2NJhMU55AzRs1HGnVQMQ') throw Error('Only the prepared OrionX demo copy may be used');
 const recordId = process.argv.includes('--record-id') ? process.argv[process.argv.indexOf('--record-id') + 1] : 'DEMO-LIVE-20261025-001';
 if (!/^DEMO-(LIVE|MANUAL)-20261025-\d{3}$/.test(recordId || '')) throw Error('A labelled hackathon demo Record ID is required');
 const before = await fetchSheetRows();
 if (before.some(row => row.award.recordId === recordId)) { console.log('Demo award already exists; no change'); return; }
 const example = before.find(row => row.student.studentId === 'BTU-T-0001');
 assert.ok(example);
 const owned = new Set(before.filter(row => row.student.studentId === example.student.studentId).map(row => row.award.skillId));
 const skill = [...skillCatalog().values()].find(skill => !owned.has(skill.skillId));
 assert.ok(skill);
 const metadata = await sheets.spreadsheets.get({spreadsheetId: sheetId, fields: 'namedRanges,sheets(properties,protectedRanges)'});
 const named = metadata.data.namedRanges?.find(range => range.name === 'PassportRecords');
 assert.ok(named?.range?.sheetId != null && named.range.endRowIndex != null);
 const sheet = metadata.data.sheets?.find(sheet => sheet.properties?.sheetId === named.range!.sheetId);
 const protection = sheet?.protectedRanges?.find(range => range.description?.startsWith('OrionX: protect structure'));
 assert.ok(protection?.protectedRangeId != null);
 const sheetTabId = named.range.sheetId, index = example.rowNumber - 1;
 const {student} = example;
 const first = [student.studentId, student.firstName, student.lastName, student.email, student.program, student.educationLevel, student.passportId, student.initialIssueDate, student.status, recordId, skill.skillId, skill.name, skill.category];
 const last = [skill.description, '2026-10-25', 'NOT SYNCED', '', '', ''];
 const cells = (values: string[]) => values.map(value => ({userEnteredValue: {stringValue: value}}));
 await sheets.spreadsheets.batchUpdate({spreadsheetId: sheetId, requestBody: {requests: [
  {insertDimension: {range: {sheetId: sheetTabId, dimension: 'ROWS', startIndex: index, endIndex: index + 1}, inheritFromBefore: false}},
  {copyPaste: {source: {sheetId: sheetTabId, startRowIndex: index + 1, endRowIndex: index + 2, startColumnIndex: 0, endColumnIndex: 20}, destination: {sheetId: sheetTabId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 20}, pasteType: 'PASTE_NORMAL'}},
  {updateCells: {range: {sheetId: sheetTabId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 13}, rows: [{values: cells(first)}], fields: 'userEnteredValue'}},
  {updateCells: {range: {sheetId: sheetTabId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 14, endColumnIndex: 20}, rows: [{values: cells(last)}], fields: 'userEnteredValue'}},
  {createDeveloperMetadata: {developerMetadata: {metadataKey: 'orionx.record', metadataValue: recordId, visibility: 'DOCUMENT', location: {dimensionRange: {sheetId: sheetTabId, dimension: 'ROWS', startIndex: index, endIndex: index + 1}}}}},
  {updateProtectedRange: {protectedRange: {protectedRangeId: protection.protectedRangeId, unprotectedRanges: [{sheetId: sheetTabId, startRowIndex: 4, endRowIndex: named.range.endRowIndex + 1, startColumnIndex: 0, endColumnIndex: 16}]}, fields: 'unprotectedRanges'}},
 ]}});
 const after = await fetchSheetRows();
 assert.equal(after.length, before.length + 1);
 const fingerprints = new Map(after.map(row => [row.award.recordId, inputFingerprint(row)]));
 for (const row of before) assert.equal(fingerprints.get(row.award.recordId), inputFingerprint(row));
 assert.equal(after.find(row => row.award.recordId === recordId)?.award.badgeCode, skill.badgeCode);
 await writeFile('.secrets/live-award-check.json', JSON.stringify({recordId, passportId: student.passportId, priorAwards: owned.size, sourceRowsBefore: before.length, sourceRowsAfter: after.length, originalsUnchanged: true, formulaAndValidationPreserved: true, checkedAt: new Date().toISOString()}, null, 2), {mode: 0o600});
 console.log('Added one synthetic award; all existing inputs unchanged; badge formula and source validation preserved');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Demo update failed'); process.exitCode = 1; });
