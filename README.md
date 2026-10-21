# OrionX — AI Skills Digital Passport

Premium English-language UI and Solana Devnet-first architecture for BTU's AI Skills Digital Passport hackathon.

## Run the frontend

Node.js 20+ required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The initial frontend is a **synthetic preview**, not a BTU-issued passport system. Verification is intentionally fail-closed until a real backend and pinned Devnet deployment are configured.

## Pages

- `/` — overview
- `/passport` — student passport preview
- `/admin` — administration preview
- `/verify` — code and PDF verification interface

## Security

Never commit API keys, Solana keypairs, student data or Supabase service keys. Configure secrets through environment variables and Azure Key Vault. See `docs/IMPLEMENTATION.md` for the complete unfinished acceptance gates.
