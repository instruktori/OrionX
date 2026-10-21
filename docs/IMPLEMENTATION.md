# OrionX implementation gates

## Current stage

The UI is a responsive **synthetic-data preview**. The repository also includes a NestJS API scaffold, domain utilities, a Sheets schema parser, a demo PDF preparation function, a Prisma schema and an undeployed Anchor registry. None of these constitutes a complete deployed issuer.

## Mandatory unfinished acceptance gates

1. Import and validate the original 18-student/60-award workbook (current examples are synthetic).
2. Implement transactional Prisma reservation, durable worker/outbox, immutable private storage and crash-safe transaction retries.
3. Compile and test the Anchor contract; configure explicit bootstrap administrator; deploy **Solana Devnet only**.
4. Complete independent on-chain account/issuer epoch/registry verification; ensure matching PDF hashes can be reported only after validation.
5. Implement Google Sheets Q–T writeback with concurrency checks and conflict handling.
6. Implement verified student identity bindings, admin RBAC, private artifact delivery and complete audit logs.
7. Obtain the official BTU visual template/stamps and independently authenticated BTU issuer approval.
8. Add Azure container deployment, end-to-end and security tests, and measured load testing.

## Delivery order

Foundation/UI → domain contracts/database → local end-to-end issuance → Devnet proof → live Sheets/auth/storage → security hardening → acceptance evidence.

Never place production API keys in the repository. Use Azure Key Vault.
