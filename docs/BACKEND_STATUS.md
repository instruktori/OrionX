# Backend status

See [architecture checkpoint](ARCHITECTURE_PROGRESS.md) for the current evidence
and [remaining setup](SETUP_REMAINING.md) for the two external dependencies.

Authentication, database-bound student/admin roles, protected APIs, private PDF
delivery, durable import/version reservation, PDF/chain/writeback worker stages,
and the compiled Anchor protocol are implemented. The complete flow has passed
with real PostgreSQL/Supabase Auth and a local Solana validator.

Real Devnet deployment, unattended live Google Sheets integration, and hosted
end-to-end acceptance are still pending. A simulated BTU issuer is authorized for
development; no official university issuance is claimed.
