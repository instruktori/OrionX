# Durable issuance worker

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
Longer stages need a sufficiently measured lease or a future renewal mechanism.

The cloud daemon is not declared in the default Vercel deployment, and automatic
CI does not build its Docker image. Setting a daemon to zero instances stops its
runtime but still builds and stores a container on each deployment. Keep worker
builds manual until worker hosting is explicitly enabled. A worker must receive its own signer
secret/file; do not publish operator/admin/upgrade keys or put them in frontend
configuration. See SETUP_REMAINING.md before real Devnet activation.
