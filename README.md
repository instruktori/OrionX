# OrionX — AI Skills Digital Passport

BTU AI Skills Digital Passport implementation with authenticated student/admin portals, cumulative PDFs, durable issuance and a **Solana Devnet-only** registry.

## Run locally

Node.js 22 recommended. Install Docker for local PostgreSQL/Redis.

```sh
npm ci
npm run env:pull
npm run env:check
npm run db:generate
npm run dev:services
```

Open the URL printed by `vercel dev` for the UI, and `/api/v1/health/live` on that same origin for API liveness. This runs both HTTP services with the same routing as deployment. The persistent worker runs separately with `npm run dev:worker`. The tenant uses synthetic students and a simulated issuer; demo verification never claims official BTU authorization. Real Devnet deployment and unattended Google Sheets access remain pending.

The repository is linked locally to the existing Vercel project. On a new machine, link it before pulling settings. See [environment configuration](docs/ENVIRONMENT.md) for Supabase credentials, local overrides, and safe Vercel updates. To use local development databases instead, copy `.env.example` to `.env.development.local` and run `docker compose up -d`.

## Implemented
- Supabase sign-in, refresh/logout, server-owned student/admin bindings and private ownership-checked downloads
- Exact source fixtures, transactional import, immutable cumulative snapshots and PostgreSQL job leases
- BTU reference artwork, Unicode multi-page PDFs, private create-only artifacts and exact SHA-256 checks
- Compiled Anchor registry, issuer rotation/pause, signed-attempt recovery and independent verification
- Local-validator end-to-end evidence, replay/security tests and a measured 5,000-passport persistence run

## Outstanding
See [implementation checkpoint](docs/ARCHITECTURE_PROGRESS.md) and [remaining setup](docs/SETUP_REMAINING.md). The estimated implementation coverage is 75–80%; local tests do not establish deployed Devnet or live Sheets acceptance.

Deployment setup and worker scope: see [Vercel deployment](docs/VERCEL.md).

Never commit API keys, Solana keypairs, student data or Supabase service keys. Configure production secrets in the Vercel project's environment variables.
