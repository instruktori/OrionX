import {prisma} from "@orionx/db";
import {sheetsClient, inputFingerprint, parseSheetRows, SHEET_HEADERS, type SourceRow} from "./sheets";
import {DomainError} from "./errors";
export type Writeback = {recordId: string; version: number; status: "SYNCED"; timestamp: string; expectedFingerprint: string; passportId: string; initialIssueDate: string};

/** Row metadata addresses values even when physical rows move. Every binding is revalidated. */
export async function writeBack(rows: SourceRow[], updates: Writeback[]) {
 if (process.env.SOURCE_MODE !== "sheets") throw Error("Sheet writes disabled in fixture mode");
 const {sheets, sheetId} = await sheetsClient();
 for (const update of updates) {
  const observation = await prisma.sourceObservation.findFirst({where: {recordId: update.recordId, fingerprint: update.expectedFingerprint}});
  if (!observation) throw new DomainError("SOURCE_CONFLICT", "Original input observation is missing");
  const original = observation.payload as unknown as SourceRow;
  const finalized = await prisma.version.findFirst({where: {number: update.version, passport: {student: {externalId: original.student.studentId}}, finalizedSlot: {not: null}, chainCluster: "devnet"}});
  if (!finalized) throw new DomainError("NOT_FINALIZED", "Real finalized Devnet evidence is required before Sheets success writeback");
  const matchesInput = (value: SourceRow) => {
   const normalized = {...value, student: {...value.student}};
   // A retry may observe G/H that this same finalized issuance already wrote.
   if (!original.student.passportId && normalized.student.passportId === update.passportId) normalized.student.passportId = "";
   if (!original.student.initialIssueDate && normalized.student.initialIssueDate === update.initialIssueDate) normalized.student.initialIssueDate = "";
   return inputFingerprint(normalized) === update.expectedFingerprint;
  };
  const row = rows.find(r => r.award.recordId === update.recordId);
  if (!row || !matchesInput(row)) throw new DomainError("SOURCE_CONFLICT", "Source changed before writeback: " + update.recordId);
  const found = await sheets.spreadsheets.developerMetadata.search({spreadsheetId: sheetId, requestBody: {dataFilters: [{developerMetadataLookup: {metadataKey: "orionx.record", metadataValue: update.recordId, visibility: "DOCUMENT"}}]}});
  let matches = found.data.matchedDeveloperMetadata || [];
  if (!matches.length) {
   // Enroll only against a freshly validated unique source row. Structural protection
   // is required during initial metadata enrollment; later writes follow metadata.
   if (process.env.GOOGLE_METADATA_ENROLLMENT_ENABLED !== "true") throw new DomainError("SOURCE_BINDING_REQUIRED", "Enable controlled metadata enrollment before the first live writeback", 503);
   const numericSheetId = Number(process.env.GOOGLE_SHEET_TAB_ID);
   if (!Number.isSafeInteger(numericSheetId) || numericSheetId < 0) throw Error("Numeric GOOGLE_SHEET_TAB_ID required");
   const created = await sheets.spreadsheets.batchUpdate({spreadsheetId: sheetId, requestBody: {requests: [{createDeveloperMetadata: {developerMetadata: {metadataKey: "orionx.record", metadataValue: update.recordId, visibility: "DOCUMENT", location: {dimensionRange: {sheetId: numericSheetId, dimension: "ROWS", startIndex: row.rowNumber - 1, endIndex: row.rowNumber}}}}}]}});
   matches = [{developerMetadata: created.data.replies?.[0]?.createDeveloperMetadata?.developerMetadata}];
  }
  if (matches.length !== 1 || !matches[0].developerMetadata?.metadataId) throw new DomainError("SOURCE_CONFLICT", "Ambiguous source metadata");
  const metadataId = matches[0].developerMetadata.metadataId;
  const filter = {developerMetadataLookup: {metadataId}};
  const read = async () => {
   const data = await sheets.spreadsheets.values.batchGetByDataFilter({spreadsheetId: sheetId, requestBody: {dataFilters: [filter], valueRenderOption: "FORMATTED_VALUE"}});
   const ranges = data.data.valueRanges || [];
   if (ranges.length !== 1 || ranges[0].valueRange?.values?.length !== 1) throw new DomainError("SOURCE_CONFLICT", "Metadata no longer resolves to one row");
   return (ranges[0].valueRange!.values![0] as string[]).map(String);
  };
  const live = await read(), parsed = parseSheetRows([[...SHEET_HEADERS], live])[0];
  if (!parsed || parsed.award.recordId !== update.recordId || !matchesInput(parsed)) throw new DomainError("SOURCE_CONFLICT", "Source binding changed");
  const priorVersion = String(live[17] || "").replace(/^V/, "");
  const ledger = await prisma.sourceSync.findUnique({where: {sourceRecordId: update.recordId}});
  if (ledger?.syncedVersion && ledger.syncedVersion !== update.version) throw new DomainError("SOURCE_CONFLICT", "Award already synchronized to a different real version");
  // Workbook SYNCED is simulated until our own ledger establishes a real sync.
  if (ledger?.syncedVersion && live[16] === "SYNCED" && priorVersion !== String(update.version)) throw new DomainError("SOURCE_CONFLICT", "Real synchronized status changed");
  const values: (string | null)[] = Array(20).fill(null);
  if (!live[6]) values[6] = update.passportId;
  if (!live[7]) values[7] = update.initialIssueDate;
  values.splice(16, 4, "SYNCED", "V" + update.version, update.timestamp, "");
  await sheets.spreadsheets.values.batchUpdateByDataFilter({spreadsheetId: sheetId, requestBody: {valueInputOption: "RAW", data: [{dataFilter: filter, majorDimension: "ROWS", values: [values]}]}});
  const after = await read();
  if (after[9] !== update.recordId || after[16] !== "SYNCED" || after[17] !== "V" + update.version || after[18] !== update.timestamp) throw new DomainError("SOURCE_CONFLICT", "Writeback readback mismatch");
  await prisma.sourceSync.update({where: {sourceRecordId: update.recordId}, data: {metadataId, status: "SYNCED", syncedVersion: update.version, syncedAt: new Date(update.timestamp)}});
 }
}
