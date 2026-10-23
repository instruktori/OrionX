# BTU Google Sheets source mapping

Source tab: `Passport Skill Records`; row 4 contains the headers, rows 5–64 contain the 60 source award records. Column A–T names are validated exactly by the adapter.

| Columns | Purpose |
|---|---|
| A–I | Student identity, program, existing passport ID, original issuance date and status |
| J–P | Immutable source Record ID, skill metadata, badge and award date |
| Q–T | Sync status, version, timestamp and error/notes writeback |

The adapter identifies awards by **Record ID (J)**, never row position, and detects conflicting repeated student or award identifiers. It ignores non-record notes rows. The parser accepts ISO dates; actual Google Sheets formatted dates and time zones must be validated against the authorized workbook before production synchronization.

The challenge workbook is described as 18 students, 16 catalog skills, 60 awards and 16 historical `SYNCED` statuses. These counts are *expected from the source requirements*, not verified by this code against the workbook. The old statuses do **not** prove Devnet issuance. Bootstrap a new explicitly labeled V1 per student; issue subsequent versions only after reconciled changes.

**Not yet connected:** Sheets writeback Q–T, durable row concurrency checks, approved service account, and exact fixture import.
