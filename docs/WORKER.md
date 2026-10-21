# Durable issuance worker and integration boundaries

The initial PostgreSQL-backed worker polls for queued jobs, attempts PDF generation, writes create-only storage and validates the readback digest. A failed attempt is retried with bounded exponential backoff. **This worker is not production-ready**.

**Critical blockers before enabling issuance:**
- Reserved version codes must be passed unchanged to the renderer; the current preparation function generates a new code and the worker rejects mismatches, deliberately failing closed.
- Claim jobs with an atomic lease or `FOR UPDATE SKIP LOCKED` so two workers cannot process one job.
- Store an immutable frozen award snapshot rather than querying mutable current student awards.
- Commit durable signed transaction attempts before broadcasting; reconcile transaction signatures after restarts.
- Add Devnet Anchor RPC registration and finalized-account confirmation.
- Reconcile Sheets Q–T with source row revalidation and concurrency control.
- Complete authenticated admin-only issuance endpoints, student-owned PDF download and audit logs.

Do not turn on real issuance while these gates are open. Demo UI remains read-only.
