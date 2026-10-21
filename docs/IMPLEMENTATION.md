# OrionX implementation gates

## Current stage

The web UI is a functional, responsive **synthetic-data preview**. It is not a deployed or verified credential issuer. UI forms must never claim a proof when the API is missing or not configured.

## Remaining mandatory work

1. Import and independently validate the original 18-student / 60-award workbook against its twenty-column schema; the current UI examples are deliberately different synthetic records.
2. Implement NestJS API, Prisma/PostgreSQL migrations, durable outbox and Redis worker, Sheets reconciliation and Q–T writeback with conflict detection.
3. Implement and test Anchor config/epoch/registry/version accounts, deterministic code PDA and issuer authorization; deploy to **Solana Devnet only**.
4. Render frozen two-or-more-page PDFs, hash exact stored bytes and register the digest on Devnet; reconcile uncertain broadcasts and retain immutable versions.
5. Build independently verifiable finalized account reads, version currency and separately authenticated issuer trust. File upload verification must be bounded and non-persistent.
6. Implement verified student identity bindings, admin RBAC, private artifact delivery and complete audit logs.
7. Obtain official BTU template/stamps and issuer approval. Never imply that developer keys are official BTU keys.
8. Add Azure Docker deployments, CI, E2E, security and crash-recovery tests; measure performance.

## Delivery order

Foundation/UI → domain contracts/database → local end-to-end issuance → Devnet proof → live Sheets/auth/storage → security hardening → production-ready acceptance evidence.

No live API keys should be committed. Use Azure Key Vault for production secrets.
