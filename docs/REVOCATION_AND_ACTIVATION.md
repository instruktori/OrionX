# Revocation, automation activation and proof

## What this change does

A finalized `VersionRecord` remains immutable. A separate Anchor `RevocationRecord`
PDA (`["revocation", version_record_pubkey]`) invalidates exactly one version. Only
`IssuerConfig.current_authority` or `IssuerConfig.admin` can create it. Creation is
one-way: no close, edit, reinstate or hash rewrite instruction is provided. Existing
issuer, epoch, registry and version account sizes and addresses are unchanged.
Revocation remains available while issuance is paused. The issuer's public key is
not proof of official university approval; this deployment remains a test issuer.

Private administrative reasons and actor identifiers stay in PostgreSQL. The chain
stores salted, version-bound reason and actor commitments, signing authority, epoch,
slot and time. Public/student responses do not disclose the private reason or actor.

`Revocation` progresses PENDING -> REVOKED after finalized chain reconciliation, or
PENDING -> FAILED on terminal/exhausted processing. The existing `Job` table handles
REVOKE work with the existing claim/lease/fencing/backoff mechanisms. An immutable
signed attempt commits before broadcast. Each claim checks finalized on-chain state
before deciding to resend identical bytes or, only after expiry, sign a replacement.
An observed transaction is not finality. After chain success and a server crash,
the next claim adopts the finalized tombstone without sending a new transaction.
An administrator can retry a failed immutable request using its original reason and
withdrawal selection. Conflicting requests return 409.

The latest-issued pointer always remains the highest finalized issuance number.
Revoking it leaves **no current valid credential**. Older versions remain historical;
they are not promoted. Verification reports registration, integrity, version currency
and revocation separately. Byte-identical revoked PDFs are MATCH + REVOKED, not
"tampered". Student and public credential downloads withhold revoked versions;
authorized administrators retain archival access to the original bytes.

For an incorrectly awarded skill, select the affected Record IDs in the revoke
confirmation. An append-only `AwardWithdrawal` excludes those records from every
future cumulative snapshot while preserving original awards and historical PDFs.
Finish revocation, then explicitly choose **Issue correction** on the latest revoked
version. This reserves the next version through the existing PDF/CHAIN/WRITEBACK
pipeline. No remaining awards means no corrected credential. For a wrongly awarded
skill appearing in several records, explicitly withdraw all affected records.

## Validation commands

```sh
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm test
npm run build
cargo test --locked
```

Read-only public-chain checks (no signing credentials, database, or OrionX API):

```sh
npm run test:verification:live -- --allow-pending-revoked-fixture
npm run verify:independent -- --code D1-BA4V45SHOBSRMOBTFYDFU7M4LUFOELZR \
  --pdf fixtures/verification/current.pdf \
  --program 9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa \
  --issuer DoBPRwB5HkE6Hu3J6khzwdZhH6nSrrHmiuwx68wrdJWt
```

The committed PDFs are existing synthetic hackathon fixtures. Their SHA-256 values
are pinned in `fixtures/verification/devnet.json`; authenticity is then independently
checked against finalized Devnet accounts, issuer epochs and registry lineage.
An unavailable RPC is an explicit failure. Devnet resets, outages, or subsequent
issuance on the current fixture require investigation; do not convert them to passes.

The normal read-only CI job reports live revoked cases as **NOT EXERCISED** while
`revoked` is null in the manifest. It does not manufacture a public revocation.
After approved activation, issue/revoke a separate synthetic fixture, commit its
original PDF and exact proof context, and run `npm run test:verification:live` or the
strict workflow_dispatch run. Strict mode fails if the revoked fixture is missing.
Do not revoke the shared current fixture used by ordinary CI.

The isolated workflow uses disposable PostgreSQL 16, an ephemeral local signing key,
an isolated copy of the program with a local bootstrap key, pinned Agave v4.4.0 and
platform-tools v1.57. It uses no production/Devnet key. Reproduce on a disposable local
PostgreSQL instance, with Agave tools and Rust on PATH:

```sh
ORIONX_ISOLATED_TEST=1 \
DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test \
npm run test:revocation:integration
```

It exercises unattended polling with the canonical **fixture adapter**, real PDF
storage, real SBF issuance, unauthorized revocation, concurrent duplicate requests,
chain unavailability, durable signed attempts, a chain-success/server-crash boundary,
recovery, immutable historical evidence and correction without withdrawn awards.
It does not establish live Google Sheets or hosted worker operation.

## Approval-gated activation sequence

No migration, program upgrade, hosted worker deployment, live issuance or live
revocation is performed by ordinary CI or these code changes.

1. Obtain deployment/operator approval. Run the isolated lifecycle CI to green and
   review the additive program diff. Record the current program upgrade authority,
   program binary, issuer configuration, and representative finalized account bytes.
2. Apply `0005_revocation` through the existing Prisma migration deployment process:
   `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma` in the approved
   database environment. Test backup/restore first. The migration adds tables and
   backend-only RLS; it does not rewrite existing issuance records.
3. Build the **unmodified** production program with pinned tools:
   `cargo-build-sbf --tools-version v1.57 --manifest-path programs/passport-registry/Cargo.toml`.
   Have the existing upgrade authority upgrade the same pinned Devnet program ID.
   Do not initialize a new issuer, rotate keys, replace the program ID, close accounts,
   or redeploy the isolated test build. Compare representative account bytes afterward.
4. Deploy the revocation-aware API/verifier/UI and worker code while keeping
   `REVOCATION_ENABLED=false`. Verify existing historical/current PDFs independently.
5. After approval, enable `REVOCATION_ENABLED=true` on the API and worker. Exercise a
   dedicated synthetic revocation and correction; confirm finalized PDA state using
   the independent CLI. Populate the dedicated revoked CI fixture and pass strict CI.
6. For unattended Sheets operation, provision an approved always-on container host
   for the **existing** `Dockerfile.worker`. Place existing database/storage/signer/
   Sheets configuration in a server-only `.env.worker` (never commit it). Set
   `SOURCE_MODE=sheets`, `SYNC_ENABLED=true`, `SYNC_POLL_MS=60000`,
   `STORAGE_MODE=supabase`, `CHAIN_MODE=devnet`, pinned program/genesis and the existing
   issuer credential. Start with:
   `docker compose -f compose.worker.yml --profile automation up -d --build`.
   No new queue, database, auth provider or storage service is introduced.
7. In the approved synthetic Sheet copy, add one confirmed award. Observe automatic
   import -> durable job -> stored PDF -> finalized chain record -> Sheets readback ->
   student access. Repeat the source poll, reorder the row, and restart the worker;
   verify one version and one effective issuance. Record actual timestamps/signatures.
   This is the remaining live Sheets acceptance check, not established by fixture CI.

To stop new automation, stop the worker or disable polling; persisted jobs remain.
To stop new revocations, set `REVOCATION_ENABLED=false`. **Never roll the public
verifier back to a version that ignores revocation after the first on-chain revoke.**
A code rollback cannot reinstate a revoked credential; correction requires new issuance.
Manual administrator processing remains available through the existing fallback.

## Demo capture (four clips, 95 seconds total)

Use only the approved synthetic Sheet and test issuer. Capture real finality; trim
idle recording time with an explicit elapsed-time note rather than claiming instant
confirmation. Preflight network availability before recording.

| Clip | Time | Capture and independently check |
| --- | --- | --- |
| A: automatic issuance | 30 s | Add a confirmed synthetic skill, hands off admin controls, show worker log + finalized Explorer transaction + new student PDF + public code result. |
| B: tamper detection | 15 s | Run the independent CLI on original bytes, copy the PDF and flip one byte, rerun and show MISMATCH. |
| C: revocation | 30 s | Show valid version, select Revoke and reason, show PENDING then finalized revocation PDA, rerun independent CLI on the unchanged PDF: MATCH + REVOKED. |
| D: recovery | 20 s | Use the isolated lifecycle run's persisted signed attempt, interrupt after chain finality before SQL completion, restart and show one attempt + completed reconciliation. |

Map these clips to existing presentation sections. Do not claim C is recorded on
Devnet until the upgrade and dedicated fixture are approved and exercised. The
isolated test output is labeled local and must not be represented as hosted proof.
