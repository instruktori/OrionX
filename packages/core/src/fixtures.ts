import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parse} from "csv-parse/sync";
import {parseSheetRows, SHEET_HEADERS, type SourceRow} from "./sheets";

/** Lossless join of the supplied three canonical CSV tables. */
export function fixtureValues(): string[][] {
  const read = (name: string): Record<string, string>[] => parse(readFileSync(resolve(__dirname, "../../../fixtures", name + ".csv"), "utf8"), {columns: true, skip_empty_lines: true, bom: true});
  const students = new Map(read("students").map(s => [s.student_id, s]));
  const skills = new Map(read("skills").map(s => [s.skill_id, s]));
  const rows: string[][] = [[], [], [], [...SHEET_HEADERS]];
  for (const a of read("awards").sort((a, b) => Number(a.sheet_row) - Number(b.sheet_row))) {
    const s = students.get(a.student_id), k = skills.get(a.skill_id);
    if (!s || !k) throw Error("Broken canonical fixture join");
    rows.push([s.student_id, s.first_name, s.last_name, s.email_test, s.program, s.education_level, s.passport_id_existing, s.first_issued_existing, s.student_status, a.record_id, k.skill_id, k.skill_name, k.skill_category, k.badge_stamp_code, k.skill_description, a.date_earned, a.passport_sync_status, a.synced_passport_version, a.synced_at_utc, a.sync_error_notes]);
  }
  return rows;
}
export function fixtureRows(): SourceRow[] { return parseSheetRows(fixtureValues()); }
export function skillCatalog() { return new Map(fixtureRows().map(r => [r.award.skillId, r.award])); }
