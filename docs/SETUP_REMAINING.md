# Remaining external setup

## Current checkpoint — 29 October 2026

PR #11 (`b252dcc`) is on main and Vercel production. Supabase migrations 0005 and
0006 were applied through MCP, preserving existing records. Revocation-aware
API/UI and independent verification are deployed. The operator reported the same-ID
Devnet revocation upgrade and Vercel feature enablement complete on 29 October 2026.
No transaction signature or fresh acceptance artifact was supplied with that report;
independent live revoked-fixture validation remains pending. See
[NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for current status and
[REVOCATION_AND_ACTIVATION.md](REVOCATION_AND_ACTIVATION.md) for the activation order.
A dedicated live revoked fixture and hosted unattended Sheets acceptance are still
required; passing isolated lifecycle CI does not establish either.

## Original issuance program is deployed

The program and simulated issuer are deployed. Real V1/V2 issuance, crash
recovery, private downloads and tamper rejection passed. See
`evidence/devnet-deployment.json` and `evidence/devnet-pipeline.json`.
Earlier deployment-wallet funding instructions are complete.

## Hackathon setup is configured

The Google service account has Editor access to the demo source and a renewable
credential, with protected source structure/system outputs and 62 stable record
bindings. All 18 passports and 20 finalized versions have verified writeback.
Real hosted Google sign-in and authenticated download/public tamper checks passed.

Credentials stay in ignored local files and server-only Vercel secrets. The API
receives the simulated issuer credential for on-demand processing; admin and
upgrade keys remain operator-only. The user's account remains a student.

## Processing modes: hosted administrator controls and optional automatic worker

An administrator opens `/admin` and selects **Run synchronization** to import and
process changes, or **Process pending jobs** to resume saved work. Keep the page
open until the queue drains. **Stop after current step** preserves pending work.

The same PostgreSQL jobs and issuance processor also support **automatic unattended polling** in `apps/worker/src/worker.ts` when `SYNC_ENABLED=true`. The automatic worker is already packaged in `Dockerfile.worker` and opt-in `compose.worker.yml`, with restart behavior for persistent Docker hosting; see [WORKER.md](WORKER.md) and the [activation runbook](REVOCATION_AND_ACTIVATION.md).

**Current Vercel demo status:** administrator-triggered processing is active; the local/hosted automatic worker is not active and polling is disabled in the demo configuration. Separate always-on hosting and live unattended Sheets acceptance remain pending approval. Docker deployment configuration alone is not proof of a running worker.

To add a synthetic verified award, insert a complete data row inside the named
`PassportRecords` range (above an existing data row), copy its native structure,
and use a unique Record ID with a known skill definition. Preserve original
identity/history and the badge formula. The worker enrolls stable metadata under
the configured structural protection, then writes system output only after proof
finalizes. Do not edit synchronized historical award inputs or system outputs.

Official university authorization, real-student deployment, mainnet and a full
5,000-transaction load test remain outside the approved hackathon scope.
