# OrionX — AI Skills Digital Passport

English-language premium interface and **Solana Devnet-only** credential architecture for the BTU AI Skills Digital Passport challenge.

## Run locally

Node.js 22 recommended. Install Docker for local PostgreSQL/Redis.

```sh
npm install
npm run dev
# in a separate terminal
npm run dev -w @orionx/api
```

Open http://localhost:3000 for the UI, http://localhost:4000/api/v1/health/live for API liveness. The UI is a **synthetic preview**, not a BTU-issued passport system. Verification fails closed until a real Anchor program and independent institutional trust have been configured.

To start development databases: `docker compose up -d`.

## Implemented
- Responsive overview, student passport, administration and verification pages
- Core award validation, version-code utilities, SHA-256 hashing, demo multi-page PDF generation
- Initial Prisma schema, NestJS verification endpoints and Devnet preflight adapter
- CI configuration and security/implementation documentation

## Outstanding
See `docs/IMPLEMENTATION.md` and `docs/BACKEND_STATUS.md`. No successful live deployment or test execution is claimed.

Never commit API keys, Solana keypairs, student data or Supabase service keys. Use Azure Key Vault for production secrets.
