# Backend integration status

Implemented in this change:
- Type-safe domain contracts and exact-byte hashing
- Cryptographically random 160-bit verification codes
- Immutable award reconciliation
- Multi-page synthetic-only PDF renderer
- Initial relational Prisma model for students, awards, passport versions, job ledger and audit events
- NestJS liveness/readiness and fail-closed verification endpoints
- Strictly pinned Devnet connection preflight and account-owner checks (does **not** yet validate account layout or declare proofs verified)
- Local PostgreSQL/Redis compose file and GitHub Actions build/test configuration

**Not implemented:** the actual Anchor program and independently verified account schema, production issuer trust, job processing, Google Sheets adapter, verified student auth, durable PDF storage, live deployment, full integration/E2E tests and official BTU template. Until these exist, live issuance and positive verification must remain disabled.
