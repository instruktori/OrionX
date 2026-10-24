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

No successful local test substitutes for actual Devnet, live-Sheets or hosted
acceptance evidence. Keep the deployment worker paused until its intended
source, private storage, signing credentials and public verification origin are
configured. Never migrate or reset databases during application builds.
