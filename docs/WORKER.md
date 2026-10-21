# Worker state

The worker accepts a previously reserved version code, renders a multi-page demo PDF, stores it create-only, verifies its SHA-256 on readback, and marks the job STORED. It polls PostgreSQL for queued work with exponential retry.

**Not ready for concurrent live issuance.** Required next steps: atomic job leases, immutable snapshot rendering rather than current student awards, signed transaction outbox and Devnet broadcast/reconciliation, real authorization, verified Sheets writeback, recovery tests and a deployed program. Keep CHAIN_MODE=offline.
