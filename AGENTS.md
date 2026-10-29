# OrionX — Engineering and Operations Guide

## Engineering evidence map

OrionX implements a versioned AI Skills Digital Passport pipeline spanning Google Sheets, immutable PDFs, PostgreSQL job processing, and finalized Solana Devnet records. This document identifies the relevant code and dated checks. Source files demonstrate implementation; recorded acceptance artifacts describe tested executions; deployment configuration determines what is running now.

**Public demo:** https://orionx-phi.vercel.app  
**Status updated:** 2026-10-29. The evidence JSON files remain dated historical snapshots, not continuous monitoring.

## Processing architecture at a glance

**Both execution modes are implemented.** An unattended worker polls for source changes and consumes durable jobs; authorized administrators can also trigger synchronization and process those same jobs through the API. Both use `packages/core/src/processor.ts` and the PostgreSQL job queue. The difference in the hackathon demo is **which execution mode is activated**, not which one exists.

| Question | Precise answer | Inspect |
| --- | --- | --- |
| Is automatic polling implemented? | **Yes.** `SYNC_ENABLED=true` activates scheduled polling in the worker process | `apps/worker/src/worker.ts` |
| Is on-demand processing implemented? | **Yes.** Admin-only actions enqueue/process the same durable pipeline | `packages/core/src/processor.ts`, admin routes |
| Is unattended execution tested? | **Yes, in isolated fixture-adapter integration tests.** Not yet an unattended hosted Sheets end-to-end acceptance | `scripts/test-revocation-integration.ts`, worker tests |
| Is a deployable worker container provided? | **Yes.** Separate Dockerfile and opt-in Compose service with restart policy | `Dockerfile.worker`, `compose.worker.yml` |
| Is a worker continuously running in the current Vercel demo? | **No evidence of that, and it is not activated there.** The hosted demo currently uses admin-triggered processing | `docs/VERCEL.md`, `docs/SETUP_REMAINING.md` |
| Is live unattended Sheets-to-Devnet completion established? | **Not yet.** Requires an authorized always-on host and recorded end-to-end acceptance | `docs/REVOCATION_AND_ACTIVATION.md` |

A container definition proves deployability, **not** actual runtime uptime; an administrator-triggered demo proves the shared pipeline works, **not** continuous background operation. Neither limitation should be misread as absence of automatic synchronization code.

## Current engineering handoff

PR #11 was merged to `main` as `b252dcc` with operator approval. The revocation-aware API, verifier and UI were deployed to Vercel; Supabase migrations `0005_revocation` and `0006_revocation_function_privileges` were applied through MCP. Existing 18 passports, 20 versions and 62 awards were preserved.

- Implemented: append-only on-chain revocation PDA, administrator authorization and mandatory reason, durable signed attempts, finalized-state reconciliation, idempotent retries, award withdrawal and explicit corrected issuance. Revoking the latest version does not promote an older version.
- Validated before merge: 158 application/runtime tests, 3 Rust tests, typecheck, Prisma validation, production build, isolated real-SBF/PostgreSQL lifecycle CI and read-only Devnet CI. Production smoke checks confirmed health, private-route denials, authentic PDF acceptance and modified PDF rejection. These are dated results, not guarantees for later commits.
- Not activated: same-ID Devnet program upgrade, `REVOCATION_ENABLED`, and hosted always-on worker. The existing manual processing fallback remains available. Automatic polling passed isolated fixture-adapter tests; live unattended Google Sheets acceptance remains pending.
- Live revoked fixture is absent. Ordinary live CI explicitly marks revoked cases NOT EXERCISED; strict live verification fails until a dedicated approved fixture is committed. Local-chain revocation success is not deployed Devnet proof.

Use [the current plan](docs/NEXT_IMPLEMENTATION_PLAN.md) and [activation runbook](docs/REVOCATION_AND_ACTIVATION.md) for remaining steps. Do not replace the existing queue/worker, treat code as evidence of activation, or run live issuance, revocation or a program upgrade without authorization. Preserve historical PDFs and finalized hashes. Verification must distinguish integrity, revocation, currency and test-issuer trust.

### Requirement-to-evidence map

| Capability | Code to inspect | Dated evidence / tests |
| --- | --- | --- |
| Google Sheets source synchronization and writeback | `packages/core/src/sheets.ts`, `packages/core/src/sync.ts` | `docs/evidence/live-sheets.json`, `packages/core/src/writeback.test.ts` |
| Automatic polling and unattended jobs (implemented, separately deployable; not active in Vercel) | `apps/worker/src/worker.ts`, `packages/core/src/jobs.ts`, `compose.worker.yml`, `Dockerfile.worker` | `docs/WORKER.md`, `apps/worker/tests/worker.test.cjs`, isolated lifecycle CI |
| Shared admin-triggered and worker execution | `packages/core/src/processor.ts` | `docs/evidence/hosted-manual.json` |
| BTU-style PDF rendering and exact-byte storage | `packages/core/src/pdf-btu.ts`, `packages/core/src/pdf.ts` | `docs/evidence/devnet-pipeline.json`, `packages/core/src/issuance.test.ts` |
| Solana Devnet anchoring and independent verification | `packages/core/src/solana.ts`, public verification API | `docs/evidence/devnet-pipeline.json`, `docs/VERIFICATION.md` |
| Passport versioning and tamper detection | `packages/core/src/issuance.test.ts`, `apps/api/src/public-passport.test.ts` | `docs/evidence/devnet-pipeline.json` |
| Authentication and private downloads | `packages/core/src/auth.test.ts`, API ownership checks | `docs/evidence/hosted-browser.json`, `docs/evidence/live-sheets.json` |
| Automated checks and hosted readiness | `.github/workflows/ci.yml`, `package.json` | GitHub Actions runs, `docs/evidence/acceptance-summary.json` |

Each row links a concrete implementation to an independently inspectable test or dated execution record. A historical execution record is not continuous availability monitoring.

### Reliability and correctness demonstrated in recorded runs

| Property | Observed result | Evidence |
| --- | --- | --- |
| Hosted end-to-end issuance | Administrator-triggered, five-stage V3 processing: live sheet import, PDF storage, signed Devnet registration/finality, writeback, and drained queue | `docs/evidence/hosted-manual.json` |
| Immutable historical versions | Isolated real-Devnet V1/V2 issuance preserved earlier versions and marked V1 superseded; original and altered PDF checks differed as expected | `docs/evidence/devnet-pipeline.json` |
| Recovery and replay resistance | Recorded killed-worker/restart recovery, signed attempt reconciliation, idempotent replay, and access-denial cases | `docs/evidence/devnet-pipeline.json`; `packages/core/src/jobs.ts` |
| Source reordering resilience | In a 61-row live-sheet reordering check, row metadata followed moved records; fingerprints stayed stable, with **zero new versions and zero conflicts** | `docs/evidence/live-reorder.json` |
| Multi-user authorization | Browser OAuth/PKCE flow and separate anonymous, unrelated-student, and student-as-admin denials were recorded | `docs/evidence/hosted-browser.json`; `docs/evidence/live-sheets.json` |
| Scale-related engineering | Isolated database exercise persisted **5,000 synthetic passports, awards, versions, and durable jobs** in 18.01 s; 50 job claims across two claimers yielded **zero duplicate claims** | `docs/evidence/capacity.json` |

The scale exercise did **not** run 5,000 blockchain transactions or establish end-to-end throughput. All counts and outcomes are dated snapshots, not ongoing service-level guarantees.

### Reproducing checks

Use Node.js 22 and npm 10, as documented by the repository. For a review environment with dependencies and required local configuration available:

~~~sh
npm ci
npm run typecheck
npm test
npm run build
~~~

The CI workflow is `.github/workflows/ci.yml`. Inspect the current GitHub Actions result instead of assuming a historical green run applies to the latest commit.

Read-only environment readiness for **authorized, provisioned environments**:

~~~sh
npm run check:readiness -- --worker --sheets --hosted --evidence
~~~

The `npm run test:pipeline:devnet` command is **not** read-only: it can write to Solana Devnet and external test services. Do not run it without permission and appropriate isolated credentials. Never publish secrets, private PDFs, or sensitive test-account details in review artifacts.

### Evidence-backed demonstrations

- The dated hosted acceptance snapshot records **18 demo passports, 20 finalized versions, and 62 synchronized award rows**: `docs/evidence/acceptance-summary.json` and `docs/evidence/live-sheets.json`.
- Real isolated Devnet V1/V2 issuance, restart recovery, old-version supersession, tamper rejection, and access checks were recorded in `docs/evidence/devnet-pipeline.json`.
- Hosted administrator-triggered V3 issuance, finality, and writeback were recorded in `docs/evidence/hosted-manual.json`.
- The README contains a demo/evidence index with public routes and explorer references. Historical evidence does not imply that a page, chain RPC, or worker is currently available.

### Implementation and deployment states

1. **Implemented** — code path exists, with dependencies and operational prerequisites identified.
2. **Exercised** — automated tests or dated execution evidence cover the path.
3. **Enabled on the hosted deployment** — deployment configuration and live observations support current operation.

In particular, automatic source polling exists in the worker but is **not running unattended on the current Vercel hackathon deployment**. The hosted demo intentionally executes the same durable pipeline through administrator controls. The hosted manual mode and the optional unattended mode use the same durable processing architecture, but their operational availability differs.

### Negative cases and explicit limitations

Check modified-PDF rejection, historical-version reporting, idempotent imports, crash/retry safety, issuer attribution, unauthorized private downloads, and student-vs-admin access. Only record a result as validated when an automated test, recorded artifact, or authorized fresh execution supports it.

The demonstrator uses a **simulated BTU issuer on Solana Devnet**, not university-approved credentials or mainnet. It does not establish an authenticated university trust manifest or permanent Devnet archival guarantees. Capacity evidence is not proof that 5,000 on-chain issuances were completed.

## Shared job processing: unattended worker and administrator controls

**Both modes exist and use the same durable pipeline.** The worker can be run as an independent daemon; the current Vercel demo instead runs administrator-triggered processing. The always-on worker is not currently hosted in that deployment.

- `apps/worker/src/worker.ts`: optional unattended loop and periodic source polling, configured with `SYNC_ENABLED=true` and `SYNC_POLL_MS` (default 60,000 ms).
- `packages/core/src/sync.ts`: source validation, transactional import and idempotent sync dispatch.
- `packages/core/src/jobs.ts`: PostgreSQL `FOR UPDATE SKIP LOCKED` claims, expiring and renewable leases, ownership fencing, retry backoff.
- `packages/core/src/processor.ts`: shared PDF → CHAIN → WRITEBACK stages for both the worker and authenticated admin-triggered HTTP processing. Signed chain attempts are persisted for finality recovery.
- `Dockerfile.worker`, `compose.worker.yml`: opt-in Docker deployment of the implemented daemon with automatic restarts; existence does not establish a running production instance.
- `docs/WORKER.md`, `docs/ADR-QUEUE.md`, `docs/VERCEL.md`: operational design and current deployment constraints.

The Vercel deployment does not host a persistent daemon; the demo has `SYNC_ENABLED=false`. Unattended hosted operation requires separately deploying the worker and enabling polling. The five-stage hosted processing record in `docs/evidence/hosted-manual.json` establishes that the admin-triggered execution path completed a real demo issuance and writeback.

### Verification trust boundary

OrionX confirms on-chain **test issuer** registration and exact-byte document integrity, but does not represent the simulated authority as an authenticated BTU institutional issuer. Devnet accounts are not permanent archival records. Refer to `docs/VERIFICATION.md` for the exact cryptographic checks and remaining proof limitations.
