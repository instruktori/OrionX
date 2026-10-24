# Solana Devnet registry deployment

The program is compiled and tested on a local validator. It is not yet deployed
to Devnet and has not received an independent security audit.

- Program: `9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa`
- Bootstrap admin: `BNcEvP3benzCX7tc1W2U6upZ5HVT4hzneZahVKMpCPiv`
- Simulated issuer: `DoBPRwB5HkE6Hu3J6khzwdZhH6nSrrHmiuwx68wrdJWt`

The generated private keypairs remain in ignored `.secrets/`. The user authorized
this simulated issuer for development. Demo mode always reports
`officialBtu=false`; future official issuer trust requires authenticated university
authorization and the configured trust material.

Follow [remaining setup](SETUP_REMAINING.md) to fund the deployment wallet, then
run `npm run deploy:devnet`. The helper verifies the expected Devnet genesis hash,
matching program/bootstrap keys and balance, deploys with a separate upgrade
authority, initializes the issuer and records actual public evidence after success.
Never commit keypairs or upload operator keys to the web/API runtime.

Local evidence and its limits are in [the checkpoint](ARCHITECTURE_PROGRESS.md)
and `evidence/local-chain.json`. Tests cover unauthorized initialization/issuance,
ordering, duplicate codes, pause, two-signer rotation and historical preservation.
These results do not replace real Devnet smoke tests.

`npm run issuer:admin` supports deliberate pause/resume and issuer rotation.
Historical issuer epochs remain immutable and independently verifiable. A later
approved university key can replace the demo issuer through rotation/configuration.
Mainnet is disabled. On-chain references contain no names, emails or award details.
