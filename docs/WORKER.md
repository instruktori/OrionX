# PostgreSQL job leasing and immutable PDF rendering

The PDF worker claims jobs using a single PostgreSQL `FOR UPDATE SKIP LOCKED` statement, with a 120-second lease and crash recovery. It renders from the **reserved immutable version snapshot**, never from current mutable student awards. It stores create-only artifacts, reads back the exact bytes, validates SHA-256 and commits version/job status and audit evidence together. On a storage conflict, it accepts only identical bytes.

Run a single worker for demo workloads; longer renders need lease heartbeat/renewal. The worker intentionally **stops at STORED**. Chain signing, transaction outbox, finalized registration, sheet writeback, authorization, and real issuer approval remain required. No on-chain success is claimed.

Apply the updated Prisma schema before starting the worker. No production data should be imported until migrations and recovery tests pass.

## Vercel and runtime settings

The root `Dockerfile.worker` builds this worker as `daemons.worker`, paused by default with zero instances. See [Vercel setup](VERCEL.md) to configure the database, durable storage, region and instance count. Poll interval, lease duration and retry limit are environment driven. Shutdown drains work and disconnects Prisma; database polling errors retry after the configured interval. Local worker execution remains available with `npm run dev:worker`.
