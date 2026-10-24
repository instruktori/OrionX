# Durable PostgreSQL queue (ADR-05 fallback)

The implementation selects the architecture's PostgreSQL queue fallback instead
of BullMQ/Redis. Jobs and reservations commit in one PostgreSQL transaction,
so the job row itself is the durable dispatch outbox. There is no separate queue
publication gap. Workers claim with FOR UPDATE SKIP LOCKED and expiring leases;
lease-fenced SQL commits reject stale workers. Side effects remain idempotent
because artifact keys and version PDAs are reserved before processing.

Every signed attempt is recorded before broadcast. Recovery queries finalized
accounts before retrying and preserves the original PDF/code/hash. A confirmed
but unfinalized signature is not issuance success. A finalized chain record and
failed writeback resume only WRITEBACK. Fixture completion never writes a real
Google Sheet and is explicitly recorded as FIXTURE_ONLY.

Long-running stages must complete inside WORKER_LEASE_MS. Increase the lease
only with measured render/RPC latency; a future heartbeat can renew ownership.
PostgreSQL polling is suitable for this demo's 5,000/year requirement; this is
not a claim that the full load acceptance gate has passed.
