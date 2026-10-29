# Durable issuance worker

## Two supported execution modes

OrionX implements **automatic background processing** and **administrator-triggered processing** on one PostgreSQL queue and shared issuance pipeline (`packages/core/src/processor.ts`). Neither mode is a simulated shortcut.

| Mode | Trigger | Current evidence / status |
| --- | --- | --- |
| Automatic worker | `apps/worker/src/worker.ts` polls when `SYNC_ENABLED=true` and processes pending durable jobs | Implemented; isolated fixture-adapter polling/integration tests exercised; opt-in Docker deployment exists; hosted unattended Sheets acceptance still pending |
| Administrator-triggered API | Authenticated admin synchronizes sources and processes pending jobs, one durable stage per request | Deployed on Vercel; hosted end-to-end issuance and writeback recorded in `docs/evidence/hosted-manual.json` |

**The current Vercel demo uses the administrator-triggered mode; automatic mode is not activated there.** This is a deployment choice, not a missing automatic synchronization implementation.

A PostgreSQL job row commits with each reserved version and serves as the
transactional dispatch outbox (see ADR-QUEUE.md). Workers use schema-qualified
FOR UPDATE SKIP LOCKED claims, expiring leases, fenced commits and bounded retry.

Stages:

- PDF: adopt the predetermined staging object before rendering; create immutable
  final storage; read back and compare SHA-256 and page count.
- CHAIN: save signed bytes before broadcast; reconcile finalized accounts before
  retrying; wait for observed transactions without counting them as failures.
- WRITEBACK: resolve source Record IDs through row metadata, validate original
  inputs and final Devnet evidence, write Q–T, and read back the result.

Offline mode stops at STORED. Fixture completion records FIXTURE_ONLY and never
writes a Google Sheet. Network/cluster/program proof context is persisted with
finalized versions. Public/private artifacts and signing authority remain separate.

`SYNC_ENABLED=true` enables source polling; admin sync requests create durable
SYNC jobs. SIGTERM stops new claims, drains current work and disconnects Prisma.
Leases renew every third of WORKER_LEASE_MS using database time. Failed renewals stop subsequent side effects; completion/failure updates require the current unexpired owner. Renewal continues while shutdown drains the current job. Automatic source polls enqueue one durable SYNC job per source/time bucket (SYNC_POLL_MS, default 60000). Fixture-finalized writebacks transition to live Sheets without another version or transaction.

The independently deployable daemon is defined in `Dockerfile.worker` and the opt-in
`compose.worker.yml`, but is not declared in the default Vercel deployment. Automatic
CI does not build its Docker image. Setting a daemon to zero instances stops its
runtime but still builds and stores a container on each deployment. Keep worker
builds manual until worker hosting is explicitly enabled. A worker must receive its own signer
secret/file; do not publish operator/admin/upgrade keys or put them in frontend
configuration. See VERCEL.md for on-demand processing configuration.

## Opt-in automatic worker deployment

`compose.worker.yml` defines the worker with `restart: unless-stopped`, a read-only filesystem, temporary `/tmp` storage and graceful shutdown. It connects to the **existing** PostgreSQL and durable artifact storage rather than creating a separate database. Root `docker-compose.yml` is for local PostgreSQL and Redis, not the worker.

On an authorized persistent Docker host, supply a **server-only, uncommitted** `.env.worker` with the existing database/storage/issuer/Sheets configuration, including `SOURCE_MODE=sheets`, `SYNC_ENABLED=true`, `STORAGE_MODE=supabase` and `CHAIN_MODE=devnet`. Then use:

```sh
docker compose -f compose.worker.yml --profile automation up -d --build
docker compose -f compose.worker.yml --profile automation ps
docker compose -f compose.worker.yml --profile automation logs --tail=100 worker
```

Container startup/logs do not by themselves prove unattended Sheets-to-chain completion. The [activation runbook](REVOCATION_AND_ACTIVATION.md) specifies a synthetic Sheet update, finalized Devnet proof, source readback and restart/idempotency check to establish that evidence. **These hosted acceptance steps have not yet been completed.**

## Administrator-triggered processing on Vercel

`packages/core/src/processor.ts` is shared by the optional daemon and the API's
admin-only on-demand endpoint. Each HTTP request claims and processes one stage
with a fresh owner and renewed lease; writeback is limited to one row. The admin
page shows progress and supports stopping after the current stage. Saved jobs
resume on the next manual run. Continuous worker hosting is deferred for the current Vercel demo; the containerized automatic mode remains available for separate activation.

Configure server-only issuer JSON and Google JSON credentials for manual mode;
never give the API the admin/upgrade keys. `SYNC_ENABLED=false` keeps automatic
polling disabled. Serverless runtime resources are prepared during the API build.
