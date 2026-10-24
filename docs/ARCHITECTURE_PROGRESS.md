# Architecture implementation checkpoint — 24 October 2026

Estimated implementation coverage: **75–80%** of the supplied architecture.
This is an engineering estimate, not a count of passing acceptance gates or a
claim of deployed Devnet issuance. The user approved a simulated BTU issuer for
development; official university authorization is deferred to a later approved
institutional deployment. The application keeps `officialBtu=false` in demo mode.

## Implemented and checked

- Canonical 18 students, 16 skills, 60 awards and three category mappings.
  All 1,220 original workbook header/data cells matched the reconstructed fixture.
- Transactional import, immutable identity/award checks, cumulative version
  reservation, stable public codes, audit/conflict observations and replay safety.
- PostgreSQL job queue, schema-qualified atomic leases, fenced commits, immutable
  staging/final artifacts, signed-attempt ledger, finality reconciliation and
  independently retried Sheets writeback. PostgreSQL is the explicit ADR-05 fallback.
- Real Supabase email/password sign-in with HttpOnly cookies, refresh/logout,
  signature/issuer/audience verification and server-owned subject bindings.
- Database-assigned student/admin roles, protected admin endpoints, student-only
  passport queries, hash-checked private downloads and origin/rate-limit controls.
- BTU-supplied category stamps and visual reference adapter, Unicode, original
  dates, verification QR/code, continuation pages and exact-byte hashing.
- Anchor account protocol, authorization, immutable versions, pause, two-signer
  issuer rotation, history linkage, account parsing and independent hash checks.
- Connected admin/student portal screens, public code/file verification and
  same-origin development API routing.

## Observed evidence

- 31 automated tests (26 core, four worker, one environment) passed at this checkpoint.
- Rust serialization/layout tests and SBF compilation passed.
- Actual compiled program passed authorization, version ordering, duplicate code,
  pause, rotation and historical preservation checks on a **local validator**.
- Full isolated pipeline passed using real PostgreSQL, real Supabase Auth and the
  local SBF program: V1 → stored PDF → finalized account → V2 → old-version
  supersession → tamper failure → authorized download → unrelated-user denial.
- 5,000 synthetic students/passports/awards/versions/jobs persisted in an isolated
  schema. Two claimers obtained 50 unique jobs without duplication; ten PDFs were
  rendered. See `docs/evidence/capacity.json` for measured timings and limits.
- All 18 canonical PDFs have create-only private storage and readback checks.
  Unbroadcast earlier demo reservations were archived in the audit ledger when
  the supplied artwork/public verification origin became available. No signed
  or finalized document was rewritten.

Local-validator evidence is **not** Devnet evidence. The capacity run measures
persistence, queue claims and PDF samples, not 5,000 complete blockchain issuances.
The original 16 workbook SYNCED statuses remain simulated source metadata.

## Remaining acceptance gates

1. Fund and deploy the compiled program to real Solana Devnet; initialize the
   simulated issuer and record actual transaction/account evidence.
2. Give the persistent worker a renewable Google runtime identity, then verify
   real polling, metadata-based Q–T writeback, reorder and failure recovery.
3. Verify the hosted web/API/worker configuration, authenticated browser flow,
   real issue/verify/tamper smoke and final recovery/load checks in that environment.
4. Complete the remaining T01–T25 combinations against the deployed services;
   local/unit coverage does not mark all integration/Devnet gates passed.

The prepared Google Sheet is a private demo copy, with a named source range and
60 stable row metadata bindings. Its existence does not configure backend OAuth.

## Operational constraints

- Devnet-only deployment helpers refuse a different network genesis hash.
- Local-chain mode requires APP_ENV=test, NODE_ENV=test, a loopback RPC and no
  Vercel runtime; proofs record their actual cluster/program/genesis context.
- Issuer keys remain in ignored `.secrets/`, excluded from Git, Docker and Vercel
  uploads. The API/browser do not need issuer/admin/upgrade signing keys.
- BTU key replacement uses issuer rotation plus worker configuration. Historical
  epochs remain verifiable. Mainnet is not enabled by this change.
