# OrionX — AI Skills Digital Passport

English-language premium interface and **Solana Devnet-only** credential architecture for the BTU AI Skills Digital Passport challenge.

## Run locally

Node.js 22 recommended. Install Docker for local PostgreSQL/Redis.

```sh
npm ci
npm run db:generate
npm run dev:services
```

Open the URL printed by `vercel dev` for the UI, and `/api/v1/health/live` on that same origin for API liveness. This runs both HTTP services with the same routing as deployment. `npm run dev` still runs the UI alone; verification also needs the API and shared Vercel router. The UI is a **synthetic preview**, not a BTU-issued passport system. Verification fails closed until a real Anchor program and independent institutional trust have been configured.

To start development databases: `docker compose up -d`.

## Implemented
- Responsive overview, student passport, administration and verification pages
- Core award validation, version-code utilities, SHA-256 hashing, demo multi-page PDF generation
- Initial Prisma schema, NestJS verification endpoints and Devnet preflight adapter
- CI configuration and security/implementation documentation

## Outstanding
See `docs/IMPLEMENTATION.md` and `docs/BACKEND_STATUS.md`. No successful live deployment is claimed.

Deployment setup and worker scope: see [Vercel deployment](docs/VERCEL.md).

Never commit API keys, Solana keypairs, student data or Supabase service keys. Configure production secrets in the Vercel project's environment variables.
