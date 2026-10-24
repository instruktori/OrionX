import type {Award, Student} from "./index";
import {awardSchema, studentSchema, sha256} from "./index";
export const SHEET_HEADERS = ["Student ID", "First Name", "Last Name", "BTU Email (Test)", "Program", "Education Level", "Passport ID (Existing)", "First Issued (Existing)", "Student Status", "Record ID", "Skill ID", "Skill Name", "Skill Category", "Badge/Stamp Code", "Skill Description", "Date Earned", "Passport Sync Status", "Synced Passport Version", "Synced At (UTC)", "Sync Error / Notes"] as const;
export type SourceRow = {rowNumber: number; student: Student; award: Award; syncStatus: string; syncedVersion: string; syncedAt: string; syncError: string};
export function isoDate(input: string) {
  const value = input.trim(), parsed = new Date(value + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw Error("Invalid ISO date: " + value);
  return value;
}
export const inputFingerprint = (row: SourceRow) => sha256(Buffer.from(JSON.stringify({student: row.student, award: row.award})));
export function parseSheetRows(values: string[][], firstRow = 1): SourceRow[] {
  const headers = values.map(row => row.map(v => String(v ?? "").trim()));
  const headerIndex = headers.findIndex(row => row[0] === SHEET_HEADERS[0] && row[9] === SHEET_HEADERS[9]);
  if (headerIndex < 0) throw Error("Workbook is missing expected header row");
  for (let i = 0; i < 20; i++) if (headers[headerIndex][i] !== SHEET_HEADERS[i]) throw Error("Column " + String.fromCharCode(65 + i) + " header mismatch: expected " + SHEET_HEADERS[i]);
  const rows: SourceRow[] = [], records = new Set<string>(), students = new Map<string, string>();
  for (let i = headerIndex + 1; i < values.length; i++) {
    const v = Array.from({length: 20}, (_, j) => String(values[i]?.[j] ?? ""));
    if (v.every(x => !x.trim())) continue;
    if (!v[0].trim() || !v[9].trim()) throw Error("Partial source row " + (i + 1) + ": Student ID and Record ID required");
    const student = studentSchema.parse({studentId: v[0], firstName: v[1], lastName: v[2], email: v[3], program: v[4], educationLevel: v[5], passportId: v[6], initialIssueDate: v[7] ? isoDate(v[7]) : "", status: v[8]});
    const award = awardSchema.parse({studentId: v[0], recordId: v[9], skillId: v[10], name: v[11], category: v[12], badgeCode: v[13], description: v[14], dateEarned: isoDate(v[15])});
    const signature = JSON.stringify(student), previous = students.get(student.studentId);
    if (previous && signature !== previous) throw Error("Conflicting student identity at row " + (i + 1));
    if (records.has(award.recordId)) throw Error("Duplicate source Record ID at row " + (i + 1));
    students.set(student.studentId, signature); records.add(award.recordId);
    rows.push({rowNumber: firstRow + i, student, award, syncStatus: v[16], syncedVersion: v[17], syncedAt: v[18], syncError: v[19]});
  }
  return rows;
}
export async function sheetsClient() {
  const sheetId = process.env.GOOGLE_SHEET_ID, credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId) throw Error("Google Sheets integration is not configured");
  const {google} = await import("googleapis");
  const auth = new google.auth.GoogleAuth({credentials: credentials ? JSON.parse(credentials) : undefined, scopes: ["https://www.googleapis.com/auth/spreadsheets"]});
  return {sheets: google.sheets({version: "v4", auth}), sheetId, tab: (process.env.GOOGLE_SHEET_TAB || "Passport Skill Records").replace(/'/g, "''")};
}
export async function fetchSheetRows(): Promise<SourceRow[]> {
  const {sheets, sheetId, tab} = await sheetsClient();
  // Canonical notes start at 67. Live integrations configure an expanding named table range.
  const range = process.env.GOOGLE_DATA_RANGE || "'" + tab + "'!A1:T64";
  const response = await sheets.spreadsheets.values.get({spreadsheetId: sheetId, range, valueRenderOption: "FORMATTED_VALUE"});
  const match = response.data.range?.match(/![A-Z]+(\d+)/);
  return parseSheetRows((response.data.values || []) as string[][], match ? Number(match[1]) : 1);
}
