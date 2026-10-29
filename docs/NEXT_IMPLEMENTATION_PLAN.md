# OrionX — current implementation plan

## Latest operator update — 29 October 2026

The operator subsequently confirmed completion of both hosted automatic worker
activation and live revoked Devnet fixture validation, in addition to the earlier
same-ID Devnet program upgrade and Vercel feature enablement. Earlier pending labels
in this document describe the prior independently evidenced checkpoint; they are
superseded by this operator-reported completion status.

No worker host identifier/logs, revoked verification code/PDF/hash, finality
signature or strict CI run reference accompanied this confirmation. These outcomes
have not been independently rerun in this documentation update. Attach the actual
artifacts and reconcile the committed fixture manifest before claiming reproducible
live CI coverage. Do not infer that the manifest or CI configuration changed solely
from this status update. Demo capture remains unconfirmed. Devnet/test-issuer scope
and preservation of historical issuance evidence remain unchanged.


Updated 29 October 2026 with operator confirmation of the Devnet upgrade and Vercel feature enablement. Transaction signature, binary hash and fresh acceptance evidence were not supplied; deployment completion below is operator-reported.

Engineering baseline: PR [#11](https://github.com/instruktori/OrionX/pull/11), merged as `b252dcc`. This replaces the 25 October admin/QR handoff; that historical plan remains available in Git history.

## Delivered and validated

| Work | Implementation / validation | Deployment state |
| --- | --- | --- |
| Administrator and verification workflows | Existing account management, paginated directory, version dossier, jobs/retries, source entry, QR/image/PDF discovery and structured verification retained | Existing hosted workflows retained |
| Revocation | Authorized admin, explicit confirmation/reason, actor/time audit, PENDING/REVOKED/FAILED, immutable signed attempts, idempotency and finalized-chain recovery | API/UI deployed; same-ID Devnet upgrade and Vercel feature enablement reported complete by operator |
| On-chain invalidation | Append-only version-specific PDA, issuer/admin authority enforcement, original issuance evidence retained | Real SBF exercised locally in CI; same-ID Devnet upgrade reported complete; live revoked proof pending |
| Corrected issuance | Append-only award withdrawals, explicit correction through existing cumulative issuance pipeline; no older-version promotion | Implemented and isolated lifecycle tested; dedicated live correction acceptance pending |
| Student/public safety | Separate integrity/revocation/currency, revoked download restrictions, private admin reason excluded from student/public responses | Revocation-aware code deployed; live revoked fixture pending |
| Independent verification | Standalone CLI reads finalized Devnet state without OrionX API, database or signing key | Authentic/historical/tampered/unknown/wrong-context/RPC failure checks exercised live |
| Durable automation | Reuses existing PostgreSQL jobs, claims, renewable leases, retries and worker; opt-in worker compose/preflight | Fixture-adapter automatic issuance tested; hosted Sheets polling not activated |
| Database | Additive migrations 0005 and 0006, backend-only RLS, immutable records, restricted trigger-function grants | Applied via Supabase MCP; existing records preserved |

Before merge, all three CI workflows passed at head `1e8456f`: 158 application/runtime tests, typecheck, schema validation and production build; real local-chain/PostgreSQL lifecycle; read-only public Devnet checks. Three Rust tests also passed. Vercel deployed merged `main`; production smoke checks passed for health, private-route protection, authentic PDF verification and tamper rejection.

These results are dated. Recheck CI for subsequent changes. Live CI currently allows the missing revoked fixture with an explicit NOT EXERCISED result; it does not establish live cases 6–7.

## Remaining activation, in order

1. **Reported complete by operator:** upgrade the same pinned Devnet program and enable `REVOCATION_ENABLED=true` in Vercel production. Attach the actual upgrade transaction, binary hash, compatibility checks and deployment evidence when available. No mainnet migration was requested or reported.
2. Independently confirm the upgraded program and existing passport compatibility. Configure the worker feature flag when that worker is activated. With authorization, use a dedicated synthetic version to exercise finalized revocation, reconciliation and corrected issuance. Keep original PDFs and private audit details intact.
3. Commit that dedicated revoked PDF/proof context in `fixtures/verification/devnet.json`. Pass strict `npm run test:verification:live`, including unchanged revoked bytes reporting MATCH + REVOKED. Do not revoke the ordinary current CI fixture.
4. Provision an approved persistent host for the existing worker; use `compose.worker.yml`, server-only credentials and Sheets polling. Vercel does not host the daemon. Retain manual processing as fallback.
5. In an approved synthetic Sheet, demonstrate unattended import → PDF persistence → finalized Devnet proof → writeback → student access. Repeat polling, reorder a row and restart the worker; confirm no duplicate issuance.
6. Capture the four short demo scenarios using actual proof and labeled elapsed time. The 95-second capture plan is in the activation runbook; capture itself is not complete.

The approved database migrations and main deployment are already complete. Do not rerun migrations blindly or describe the remaining worker or live-fixture work as deployed. The production database uses Supabase migration history, not a Prisma migration baseline.

## Reproduction and boundaries

See [REVOCATION_AND_ACTIVATION.md](REVOCATION_AND_ACTIVATION.md) for commands, migration identifiers, local integration setup and rollback constraints. Offline checks, read-only public-network checks and isolated state-changing integration checks remain separate. Public CI requires no private issuer key.

The issuer is a simulated test issuer (`officialBtu=false`), not authenticated university authority. Official BTU authorization, real-student release and mainnet remain outside this hackathon deployment. No queue, database or authentication replacement is required.
