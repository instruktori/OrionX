# OrionX — AI Skills Digital Passport

BTU AI Skills Digital Passport implementation with authenticated student/admin portals, cumulative PDFs, durable issuance and a **Solana Devnet-only** registry.

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

**Reproduce checks locally** (Node.js 22/npm 10; required local dependencies/configuration may apply): \`npm ci\`, \`npm run typecheck\`, \`npm test\`, \`npm run build\`. In an authorized provisioned environment, \`npm run check:readiness -- --worker --sheets --hosted --evidence\` performs readiness checks. **Do not** run \`npm run test:pipeline:devnet\` without permission: it writes to the test network and may use external test services.

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

Open the URL printed by `vercel dev` for the UI, and `/api/v1/health/live` on that same origin for API liveness. This runs both HTTP services with the same routing as deployment. Administrators can run synchronization and issuance on demand from `/admin`; an optional local daemon is available with `npm run dev:worker`. The tenant uses synthetic students and a simulated issuer; demo verification never claims official BTU authorization. The Devnet program is deployed and a real V1/V2 issuance run has passed. Live Sheets writeback, hosted manual issuance and Google sign-in have passed acceptance.

The repository is linked locally to the existing Vercel project. On a new machine, link it before pulling settings. See [environment configuration](docs/ENVIRONMENT.md) for Supabase credentials, local overrides, and safe Vercel updates. To use local development databases instead, copy `.env.example` to `.env.development.local` and run `docker compose up -d`.

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
