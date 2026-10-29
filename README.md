# OrionX — AI Skills Digital Passport

BTU AI Skills Digital Passport with a complete, evidence-backed issuance flow: verified skill records → durable job queue → immutable multi-page PDF → finalized Solana Devnet proof → Google Sheets writeback. Student, administrator, and public-verifier workflows are implemented with separate authorization boundaries.

The project emphasizes **document integrity, safe retries, cumulative version history, and reproducible proof**, not just a passport preview.

## Processing modes: automatic and administrator-triggered

OrionX **implements both unattended background processing and administrator-triggered processing**. These are two execution modes of the same durable PostgreSQL queue and issuance pipeline, not separate implementations.

| Mode or capability | Implementation | Evidence / current deployment |
| --- | --- | --- |
| Automatic Google Sheets polling and queued processing | `apps/worker/src/worker.ts` polls when `SYNC_ENABLED=true`, using `SYNC_POLL_MS` (default 60 seconds); `packages/core/src/jobs.ts` handles durable claims, leases and retries | Automatic fixture-adapter polling and issuance were tested in isolated integration runs; live unattended Sheets acceptance remains pending |
| Administrator-triggered sync and issuance | Authenticated `/admin` actions use the same `packages/core/src/processor.ts` pipeline | Demonstrated on the hosted Vercel demo with PDF, finalized Devnet proof and Sheets writeback |
| Independently deployable worker container | `Dockerfile.worker` and **`compose.worker.yml`** define an opt-in worker service with a restart policy; root `docker-compose.yml` provisions local PostgreSQL/Redis | Deployment packaging exists; an always-on production worker has **not** been activated or independently demonstrated |
| Current hackathon hosting | Vercel deploys the API and web app; on-demand admin actions execute pending jobs | Manual-triggered processing is active; automatic background processing is supported but not currently enabled on the hosted deployment |

**Implementation is not the same as activation.** The current demo's manual controls do not imply that automatic synchronization is missing. Conversely, Docker configuration and isolated tests do not prove that an unattended worker is live. See [worker architecture](docs/WORKER.md), [Vercel deployment](docs/VERCEL.md) and [activation runbook](docs/REVOCATION_AND_ACTIVATION.md).

## Engineering results at a glance

These are **recorded results**, not estimates or claims of current uptime.

| Demonstration | Measured or recorded outcome | Evidence |
| --- | --- | --- |
| Complete hosted acceptance (Oct 25) | **18 passports, 20 finalized versions, 62 synchronized awards** with Devnet-backed records and Google Sheets writeback | [Acceptance snapshot](docs/evidence/acceptance-summary.json), [live-sheet checks](docs/evidence/live-sheets.json) |
| Hosted cumulative issuance | Real, administrator-triggered **V3** completed PDF rendering, Solana finality, and source writeback in five persisted stages | [Hosted V3 trace](docs/evidence/hosted-manual.json) |
| Document and version integrity | Real Devnet V1/V2 acceptance, superseded-version detection, original-PDF acceptance and one-bit modification rejection | [Devnet pipeline record](docs/evidence/devnet-pipeline.json) |
| Row-position safety | **61-row** reordering test preserved input fingerprints and metadata associations with **0 unintended versions** and **0 conflicts** | [Row-reorder check](docs/evidence/live-reorder.json) |
| Queue and persistence scale | **5,000 synthetic** passports/awards/versions/jobs persisted in ~18.01 s; **50 claims, 2 concurrent claimers, 0 duplicates** | [Isolated capacity exercise](docs/evidence/capacity.json) |

The capacity exercise measured database persistence, queue claiming, and PDF samples — **not** 5,000 end-to-end on-chain issuances or production throughput.

### What makes the implementation robust

- **Recoverable issuance.** Atomic job claims, renewable leases, signed-attempt persistence and finalized-account reconciliation support retry and crash recovery without intentionally duplicating completed issuance.
- **Integrity tied to immutable bytes.** An issued PDF is stored privately; its exact SHA-256 is checked against finalized Devnet registration. A modified document receives a mismatch rather than a positive authenticity result.
- **Cumulative identity and versions.** Skills accumulate under the same permanent passport identity, while old versions remain distinguishable from the latest issuance.
- **Permission-separated experiences.** Supabase Google OAuth/PKCE, server-side role and student bindings, private downloads, public verification without login, and denial of unrelated-student/admin access are covered by dated evidence.
- **Source-of-truth protections.** Record ID-based imports, Google Sheets developer metadata, fresh input validation, and post-write readback protect data mapping even when sheet rows move.
- **Low-friction checking.** The verification interface implements QR scanning and extraction of a verification code from the uploaded PDF, reducing manual transcription.

[Implementation map and reproducibility](AGENTS.md) · [Verification trust model](docs/VERIFICATION.md) · [Worker architecture](docs/WORKER.md)

## Demo and verification evidence

**Recorded acceptance snapshot: 25 October 2026.** The URLs below are for inspecting public routes and published proof; they are not guarantees of current service availability. The evidence artifacts refer to synthetic students and a simulated issuer, **not officially authorized BTU credentials**.

| Review scenario | Demo / where to inspect | Recorded result |
| --- | --- | --- |
| Public code verification | [Verify UI](https://orionx-phi.vercel.app/verify) and [hosted V3 example](https://orionx-phi.vercel.app/api/v1/verify/D1-BA4V45SHOBSRMOBTFYDFU7M4LUFOELZR) | [Hosted V3 issuance and finality](docs/evidence/hosted-manual.json) |
| Public on-chain proof for that V3 sample | [Solana Devnet transaction](https://explorer.solana.com/tx/K6HKc2iZ4MxZZgf6wTnjfy3bkBXmTERZQ4FwQjd7detGs1bSAayzTYVBxqvwYyd3MS8eGLHHsY6JBgo4XjNh5xp?cluster=devnet) and [version account](https://explorer.solana.com/address/63eb4WVt2wfD61LnYazkR6DHDQizDD5hyDzfDDT1zYcw?cluster=devnet) | [Hosted manual processing evidence](docs/evidence/hosted-manual.json) |
| Original versus modified PDF | Upload an authorized issued PDF at [Verify](https://orionx-phi.vercel.app/verify), then test an altered copy | [Recorded one-bit tamper rejection](docs/evidence/devnet-pipeline.json), [hosted checks](docs/evidence/live-sheets.json) |
| Cumulative V1/V2 and superseded history | [Isolated real-Devnet V1/V2 evidence](docs/evidence/devnet-pipeline.json) | Same permanent ID, new version and immutable proof; the isolated test database is not a live demo account |
| Google Sheets sync and durable processing | [Admin workspace](https://orionx-phi.vercel.app/admin) (requires authorized admin role) | [Live source/writeback checks](docs/evidence/live-sheets.json), [hosted V3 pipeline](docs/evidence/hosted-manual.json) |
| Authentication and private document access | [Student workspace](https://orionx-phi.vercel.app/passport) (requires account/record binding) | [Browser OAuth evidence](docs/evidence/hosted-browser.json), [access isolation checks](docs/evidence/live-sheets.json) |
| Automated verification | [GitHub Actions](https://github.com/instruktori/OrionX/actions) | Review the latest run and commit, not only the historical [acceptance summary](docs/evidence/acceptance-summary.json) |

**Reproduce checks locally** (Node.js 22/npm 10; required local dependencies/configuration may apply): `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. In an authorized provisioned environment, `npm run check:readiness -- --worker --sheets --hosted --evidence` performs readiness checks. **Do not** run `npm run test:pipeline:devnet` without permission: it writes to the test network and may use external test services.

See [AGENTS.md](AGENTS.md) for the implementation/evidence/deployment distinction and [independent verification](docs/VERIFICATION.md) for the verifier's remaining limitations. Unattended worker polling is implemented but **not active** in this Vercel deployment; the admin-triggered hosted pipeline is what has been accepted.

## Run locally

For authorized collaborators with access to the linked Vercel project, use Node.js 22 and its bundled npm 10 to match CI/Vercel (`nvm use` reads `.nvmrc`). Install Docker for local PostgreSQL/Redis. Regenerate the lockfile with this toolchain in a clean workspace when changing dependencies.

```sh
npm ci
npm run env:pull
npm run env:check
npm run db:generate
npm run dev:services
```

Open the URL printed by `vercel dev` for the UI, and `/api/v1/health/live` on that same origin for API liveness. This runs both HTTP services with the same routing as deployment. Administrators can run synchronization and issuance on demand from `/admin`; to exercise the implemented automatic polling mode locally, launch `npm run dev:worker` separately with the required database, source and storage configuration (`SYNC_ENABLED=true` and `SOURCE_MODE=sheets` for live Sheets polling). The tenant uses synthetic students and a simulated issuer; demo verification never claims official BTU authorization. The Devnet program is deployed and a real V1/V2 issuance run has passed. Live Sheets writeback, hosted manual issuance and Google sign-in have passed acceptance.

The repository is linked locally to the existing Vercel project. On a new machine, link it before pulling settings. See [environment configuration](docs/ENVIRONMENT.md) for Supabase credentials, local overrides, and safe Vercel updates. To use local development databases instead, copy `.env.example` to `.env.development.local` and run `docker compose up -d`. Separately, an authorized always-on container host can run the existing background worker with `docker compose -f compose.worker.yml --profile automation up -d --build` after securely provisioning `.env.worker`; this is **not** part of the default Vercel deployment.

## Implemented
- Google OAuth through Supabase, refresh/logout, self-service empty student workspaces, server-owned student/admin bindings and private ownership-checked downloads ([onboarding](docs/STUDENT_ONBOARDING.md))
- Exact source fixtures, transactional import, immutable cumulative snapshots and PostgreSQL job leases
- BTU reference artwork, Unicode multi-page PDFs, private create-only artifacts and exact SHA-256 checks
- Compiled Anchor registry, issuer rotation/pause, signed-attempt recovery and independent verification
- Local-validator end-to-end evidence, replay/security tests and a measured 5,000-passport persistence run

- Real Devnet V1/V2 issuance, worker crash recovery, private storage, authenticated downloads, public API verification and one-bit tamper rejection ([evidence](docs/evidence/devnet-pipeline.json))
- Automatic lease renewal, durable source polling, atomic operator retries and fixture-to-live writeback without reissuing finalized versions

## Acceptance and scope
See [implementation checkpoint](docs/ARCHITECTURE_PROGRESS.md) and [remaining setup](docs/SETUP_REMAINING.md). The agreed manual-triggered hackathon flow is deployed and verified: 18 demo passports, 20 finalized versions and 62 synchronized award rows. Automatic worker hosting is deferred by user choice; official BTU authorization and mainnet remain outside this simulated-issuer scope.

Deployment setup and worker scope: see [Vercel deployment](docs/VERCEL.md).

Never commit API keys, Solana keypairs, student data or Supabase service keys. Configure production secrets in the Vercel project's environment variables.

Read-only readiness: `npm run check:readiness -- --worker --sheets --hosted --evidence`. Real isolated Devnet acceptance: `npm run test:pipeline:devnet` (uses test-network rent/fees and retains immutable test artifacts and chain records).
