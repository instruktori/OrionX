# OrionX — current implementation plan

Updated 29 October 2026 after PR [#11](https://github.com/instruktori/OrionX/pull/11), merged as `b252dcc`. This replaces the 25 October admin/QR handoff; that historical plan remains available in Git history.

## Delivered and validated

| Work | Implementation / validation | Deployment state |
| --- | --- | --- |
| Administrator and verification workflows | Existing account management, paginated directory, version dossier, jobs/retries, source entry, QR/image/PDF discovery and structured verification retained | Existing hosted workflows retained |
| Revocation | Authorized admin, explicit confirmation/reason, actor/time audit, PENDING/REVOKED/FAILED, immutable signed attempts, idempotency and finalized-chain recovery | API/UI deployed; chain upgrade and feature activation pending |
| On-chain invalidation | Append-only version-specific PDA, issuer/admin authority enforcement, original issuance evidence retained | Real SBF exercised locally in CI; upgraded Devnet program not deployed |
| Corrected issuance | Append-only award withdrawals, explicit correction through existing cumulative issuance pipeline; no older-version promotion | Implemented and isolated lifecycle tested; live activation pending |
| Student/public safety | Separate integrity/revocation/currency, revoked download restrictions, private admin reason excluded from student/public responses | Revocation-aware code deployed; live revoked fixture pending |
| Independent verification | Standalone CLI reads finalized Devnet state without OrionX API, database or signing key | Authentic/historical/tampered/unknown/wrong-context/RPC failure checks exercised live |
| Durable automation | Reuses existing PostgreSQL jobs, claims, renewable leases, retries and worker; opt-in worker compose/preflight | Fixture-adapter automatic issuance tested; hosted Sheets polling not activated |
| Database | Additive migrations 0005 and 0006, backend-only RLS, immutable records, restricted trigger-function grants | Applied via Supabase MCP; existing records preserved |

Before merge, all three CI workflows passed at head `1e8456f`: 158 application/runtime tests, typecheck, schema validation and production build; real local-chain/PostgreSQL lifecycle; read-only public Devnet checks. Three Rust tests also passed. Vercel deployed merged `main`; production smoke checks passed for health, private-route protection, authentic PDF verification and tamper rejection.

These results are dated. Recheck CI for subsequent changes. Live CI currently allows the missing revoked fixture with an explicit NOT EXERCISED result; it does not establish live cases 6–7.

## Remaining activation, in order

1. With operator authorization and the existing upgrade authority, build the production Anchor program and upgrade the **same pinned Devnet program ID**. Preserve account layouts and compare existing finalized account bytes. Do not deploy the isolated test program.
2. After program verification, enable `REVOCATION_ENABLED` on the API and worker. Use only a dedicated approved synthetic version to exercise revocation, reconciliation and corrected issuance. Keep original PDFs and private audit details intact.
3. Commit that dedicated revoked PDF/proof context in `fixtures/verification/devnet.json`. Pass strict `npm run test:verification:live`, including unchanged revoked bytes reporting MATCH + REVOKED. Do not revoke the ordinary current CI fixture.
4. Provision an approved persistent host for the existing worker; use `compose.worker.yml`, server-only credentials and Sheets polling. Vercel does not host the daemon. Retain manual processing as fallback.
5. In an approved synthetic Sheet, demonstrate unattended import → PDF persistence → finalized Devnet proof → writeback → student access. Repeat polling, reorder a row and restart the worker; confirm no duplicate issuance.
6. Capture the four short demo scenarios using actual proof and labeled elapsed time. The 95-second capture plan is in the activation runbook; capture itself is not complete.

The approved database migrations and main deployment are already complete. Do not rerun migrations blindly or describe the remaining chain/worker work as deployed. The production database uses Supabase migration history, not a Prisma migration baseline.

## Reproduction and boundaries

See [REVOCATION_AND_ACTIVATION.md](REVOCATION_AND_ACTIVATION.md) for commands, migration identifiers, local integration setup and rollback constraints. Offline checks, read-only public-network checks and isolated state-changing integration checks remain separate. Public CI requires no private issuer key.

The issuer is a simulated test issuer (`officialBtu=false`), not authenticated university authority. Official BTU authorization, real-student release and mainnet remain outside this hackathon deployment. No queue, database or authentication replacement is required.
