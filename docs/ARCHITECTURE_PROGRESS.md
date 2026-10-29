# Architecture implementation checkpoint — 25 October 2026

## Latest operator update — 29 October 2026

The operator subsequently confirmed completion of both hosted automatic worker
activation and live revoked Devnet fixture validation, in addition to the earlier
same-ID Devnet program upgrade and Vercel feature enablement. Earlier pending labels
in this document describe the prior independently evidenced checkpoint; they are
superseded by this operator-reported completion status.

No worker host identifier/logs, revoked verification code/PDF/hash, finality
signature or strict CI run reference accompanied this confirmation. These outcomes
have not been independently rerun in this documentation update. Attach the actual
artifacts and reconcile the committed fixture manifest before claiming reproducible
live CI coverage. Do not infer that the manifest or CI configuration changed solely
from this status update. Demo capture remains unconfirmed. Devnet/test-issuer scope
and preservation of historical issuance evidence remain unchanged.


> Current status, 29 October 2026: PR #11 (`b252dcc`) and Supabase migrations 0005/0006
> are deployed. Revocation is implemented and tested with real local SBF/PostgreSQL;
> the operator reported the same-ID Devnet upgrade and Vercel feature enablement
> complete on 29 October 2026 (no transaction evidence supplied with that update).
> Dedicated revoked live-fixture validation and persistent worker activation remain
> pending. See [the current plan](NEXT_IMPLEMENTATION_PLAN.md)
> and [activation runbook](REVOCATION_AND_ACTIVATION.md). Older observations and
> counts below are historical and do not establish current live revocation or polling.


## Processing-mode status

Both **automatic background processing** and **administrator-triggered processing** are implemented using the same durable queue and pipeline. The worker polls and consumes queued jobs without UI actions when enabled; the admin API can process the same work on demand.

| Mode / deployment evidence | Current status |
| --- | --- |
| Background worker, polling, durable jobs, lease recovery | Implemented and covered by isolated integration tests |
| Worker Docker image and opt-in service (`Dockerfile.worker`, `compose.worker.yml`) | Available for separate persistent hosting; not part of the default Vercel HTTP deployment |
| Administrator-triggered end-to-end execution | Demonstrated in the hosted Vercel deployment |
| Hosted uninterrupted worker and unattended live Sheets-to-Devnet acceptance | Not activated / not independently demonstrated |

The absence of a hosted daemon does not imply that the automatic worker is missing. Likewise, deployable Compose configuration does not prove a container is actively running.

The Devnet program and simulated issuer are deployed. A complete isolated V1/V2
pipeline passed on real Devnet, PostgreSQL, private Supabase Storage and Supabase
Auth. Demo proofs keep `officialBtu=false`; official university authorization is
outside this hackathon deployment.

## Implemented and checked

- Canonical 18 synthetic students, 16 skills and 60 awards; lossless source fixtures.
- Transactional import, immutable identities/awards/snapshots, cumulative versions,
  unique codes, replay safety and source conflict quarantine.
- PostgreSQL atomic queue claims, fenced commits and lease renewal during slow
  jobs. Lost renewals prevent further side effects; expired owners cannot commit
  job failures. Operator retries atomically respect the current job state.
- Automatic polls create durable, idempotent SYNC jobs shared across workers.
- Immutable staging/final multi-page PDFs, exact-byte readback hashing, signed
  attempts saved before broadcast, finality reconciliation and restart recovery.
- Google OAuth/PKCE, verified Supabase JWTs, private workspaces, trusted identity
  binding and ownership-checked PDF downloads.
- Supplied artwork, Unicode, original identity/dates and verification QR/code.
- Compiled Anchor authorization, sequencing, rotation/pause and historical lineage.
- Sheets writes use stable row metadata, fresh input validation, pinned Devnet
  program/genesis/finalization and post-write input/output validation.
- Fixture-finalized writebacks can transition to live Sheets without creating
  another PDF, version or blockchain transaction.

## Observed evidence

- `evidence/devnet-deployment.json`: deployed program, issuer config, network and
  actual initialization signature.
- `evidence/devnet-pipeline.json`: real V1 → killed worker/restart → finalization →
  cumulative V2 → old-version supersession → one-bit tamper rejection → public
  API verification → authenticated download → unrelated/anonymous denial → replay.
  Public transaction/account/hash evidence is recorded for both versions.
- `evidence/readiness.json`: dependency checks with explicit scope and timestamps.
  Readiness alone does not establish a live writeback or interactive browser flow.
- Earlier local program/pipeline and measured 5,000-row persistence/concurrent
  claim/PDF-sample evidence remains under `evidence/`.

## Live hackathon acceptance

- All **18 demo passports, 20 finalized versions and 62 award records** have real
  Devnet proof and verified Google Sheets writeback. The two added synthetic
  awards demonstrate cumulative V2 and V3 with the original permanent ID/date.
- `evidence/live-sheets.json`: all source ledger/output comparisons, private hashes,
  hosted verification/file tamper checks, authenticated download and ownership denial.
- `evidence/live-reorder.json`: real row movement, metadata tracking, unchanged
  fingerprints, no duplicate issuance and original-order restoration.
- `evidence/hosted-manual.json`: a full hosted V3 issuance in five HTTP stages,
  including PDF rendering, finality and writeback, with no daemon running.
  Anonymous and student processing attempts were denied.
- `evidence/hosted-browser.json`: actual Google sign-in/callback/student workspace.
  The user's account remains a student; it was not promoted or linked to a demo
  academic record. Bound demo students' private downloads were checked separately.
- 83 automated checks cover core/API/worker/environment/runtime behavior, including
  packaged ESM PDF rendering, failed-import retries, dual-role admin/student session
  resolution, embedded PDF QR/code auto-extraction and verification QR routing.
  Type checking, production build, live ledger guards and all 20 staging/final PDF
  object pairs passed. See individual evidence timestamps.

## Admin workspace, centralized auth and zero-transcription verification

- **Centralized Role-Adaptive Auth & Dual-Role Sessions**: Single unified Google OAuth
  sign-in automatically resolves `admin` vs `student` roles, preserves linked
  `studentId` on administrator accounts (allowing dual-role admins like `instruktori.ge@gmail.com`
  to inspect both `/admin` and `/passport`), and provides a top-bar `Admin ⇄ Passport`
  switcher.
- **Complete Administrator Workspace (`/admin`)**:
  - Server-side paginated and filtered passport directory (`GET /api/v1/admin/passports`),
    accurate global database counts (`GET /api/v1/admin/overview`), slide-over
    passport & version dossier (`GET /api/v1/admin/passports/:id`), and direct
    admin PDF downloads (`GET /api/v1/admin/passports/:id/versions/:version/download`).
  - Unified People, Accounts & Access control (`GET /api/v1/admin/accounts`,
    `POST /api/v1/admin/identities`, `POST /api/v1/admin/identities/unlink`)
    showing self-registered workspaces, explicit identity bindings and student records.
  - In-App Source Award Entry (`GET /api/v1/admin/catalog`, `POST /api/v1/admin/source/awards`)
    writing directly to Google Sheets (preserving `PassportRecords` named range,
    badge formulas and `orionx.record` developer metadata) or local fixtures and
    optionally queueing `SYNC`.
  - Actionable Queue Jobs, Source Conflicts & Audit Log (`GET /api/v1/admin/jobs`,
    `POST /api/v1/admin/jobs/:id/retry`, `GET /api/v1/admin/audit`).
- **Verification Without Transcription (`/verify`)**:
  - Automatic `D1-...` verification code discovery from uploaded PDFs on both client
    and server (`extractVerificationCodesFromPdf` decompresses embedded QR image
    and text streams) so users can drop a PDF with zero manual typing.
  - Built-in live camera QR scanner, screenshot/photo QR decoder, and interactive
    version-specific QR share modals across `/passport` and `/admin`.
  - Full structured proof scorecard preserved on non-200 HTTP responses (including
    HTTP 422 tampered-PDF `MISMATCH`).
- **Electric Ice & Aurora Design System**: Complete visual overhaul using crisp
  White, Electric Blue, Cyan, Pink and Reddish/Coral surfaces with a sticky glass
  Top Navigation Bar and Bento Grid layout.

The approved **Vercel demo currently activates administrator-triggered processing**, while retaining the implemented automatic polling worker as a separately deployable mode. The admin page queues source synchronization and processes one durable stage per HTTP request, shows progress and can stop after the current stage. Closing the page leaves pending work saved for the next run. The automatic worker is packaged with `Dockerfile.worker` and `compose.worker.yml`, but persistent hosting and live unattended Sheets acceptance remain pending approved activation.

The isolated Devnet test retains its own immutable artifacts and chain records
but removes its disposable SQL schema and processes. Original workbook statuses
were simulated; the demo copy's current outputs are backed by the application
ledger and finalized Devnet proof.

## Scope limits

Official BTU authorization, real-student release and mainnet are outside the
approved simulated-issuer hackathon scope. Capacity evidence measures 5,000-row
persistence, concurrent claims and PDF samples; it does not claim 5,000 complete
chain issuances or a burst SLA. Manual processing requires an administrator and
an open admin page; unattended updates require separately enabled worker hosting.
