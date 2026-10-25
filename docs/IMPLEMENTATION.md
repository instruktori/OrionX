# Implementation and acceptance

The current implementation/evidence is tracked in
[ARCHITECTURE_PROGRESS.md](ARCHITECTURE_PROGRESS.md). External setup steps are in
[SETUP_REMAINING.md](SETUP_REMAINING.md).

Run `npm ci`, `npm run db:generate`, `npm run typecheck`, `npm test`, and
`npm run build` for local source checks. `npm run test:ledger`, `test:api`,
`test:capacity`, and `test:pipeline` require explicitly configured services and
synthetic demo identities. The pipeline/capacity scripts create and remove their
own isolated database schemas; they do not issue canonical passports on Devnet.

`cargo test --lib` checks Rust layouts; `cargo build-sbf --manifest-path
programs/passport-registry/Cargo.toml` builds the deployable program. Program
integration tests require a local validator loaded with that binary and the
matching ignored demo keys. `npm run deploy:devnet` requires free test-network
funding and refuses other clusters.

Actual Devnet, live Sheets, hosted verification/download and Google browser
sign-in evidence is recorded in `docs/evidence/`. `test:pipeline:devnet` uses a
disposable SQL schema and real test-network issuance; `test:live` checks existing
live source/proof/download evidence. `test:manual` expects a deliberately added
synthetic award and validates hosted administrator-triggered issuance without a
daemon. These tests retain immutable PDFs and chain accounts.

Automatic polling hosting is deferred by user choice. Use the admin page's
manual controls for the hackathon. Never migrate or reset databases during builds.
