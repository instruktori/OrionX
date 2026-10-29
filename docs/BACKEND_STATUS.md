# Backend status

> Current status, 29 October 2026: PR #11 (`b252dcc`) and Supabase migrations 0005/0006
> are deployed. Revocation is implemented and tested with real local SBF/PostgreSQL;
> the operator reported the same-ID Devnet upgrade and Vercel feature enablement
> complete on 29 October 2026 (no transaction evidence supplied with that update).
> Dedicated revoked live-fixture validation and persistent worker activation remain
> pending. See [the current plan](NEXT_IMPLEMENTATION_PLAN.md)
> and [activation runbook](REVOCATION_AND_ACTIVATION.md). Older observations and
> counts below are historical and do not establish current live revocation or polling.


The Devnet program and simulated issuer are deployed. An isolated V1/V2 flow
passed with real PostgreSQL, private Supabase Storage, Supabase Auth and finalized
Devnet transactions, including crash recovery, downloads, historical verification
and one-bit tamper rejection.

Worker leases renew during long jobs, source polling uses durable jobs, operator
retries atomically respect state, and fixture-finalized writebacks can move to
live Sheets without reissuance.

Live acceptance now includes 18 demo passports, 20 finalized versions, 62 real
Sheets writebacks, a complete hosted administrator-triggered V3 issuance without
a daemon, real Google browser sign-in, row reorder/replay, private downloads and
one-bit tamper rejection. Source sync, packaged server resources, bounded manual
processing and failed-import retries have passed deployed checks.

Automatic worker hosting remains pending an approved persistent host. Use the administrator's
manual synchronization/processing buttons. The user's account retains student
permissions. No official university issuance is claimed.

See [the checkpoint](ARCHITECTURE_PROGRESS.md) and `docs/evidence/`.
