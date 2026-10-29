# Solana Devnet registry deployment

## Latest operator update — 29 October 2026

The operator subsequently confirmed completion of both hosted automatic worker
activation and live revoked Devnet fixture validation, in addition to the earlier
same-ID Devnet program upgrade and Vercel feature enablement. Earlier pending labels
in this document describe the prior independently evidenced checkpoint; they are
superseded by this operator-reported completion status.

No worker host identifier/logs, revoked verification code/PDF/hash, finality
signature or strict CI run reference accompanied this confirmation. These outcomes
have not been independently rerun in this documentation update. Attach the actual
artifacts and reconcile the committed fixture manifest before claiming reproducible
live CI coverage. Do not infer that the manifest or CI configuration changed solely
from this status update. Demo capture remains unconfirmed. Devnet/test-issuer scope
and preservation of historical issuance evidence remain unchanged.


## Revocation upgrade checkpoint — 29 October 2026

The operator reported completion of the revocation upgrade on the existing Devnet
program ID and Vercel production feature enablement. This is not a mainnet move.
The report did not include the upgrade signature, deployed binary hash or fresh
compatibility evidence; attach those actual artifacts when available. Do not
fabricate them or treat this statement as a live revocation acceptance test.
A dedicated synthetic revoked fixture, independent MATCH + REVOKED verification
and strict live CI remain outstanding. Worker hosting is a separate activation.
See [the activation runbook](REVOCATION_AND_ACTIVATION.md).

## Original issuance deployment

The program is deployed to Devnet and has passed real V1/V2 issuance and recovery checks. It has not received an independent security audit. See `evidence/devnet-deployment.json` and `evidence/devnet-pipeline.json`.

- Program: `9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa`
- Bootstrap admin: `BNcEvP3benzCX7tc1W2U6upZ5HVT4hzneZahVKMpCPiv`
- Simulated issuer: `DoBPRwB5HkE6Hu3J6khzwdZhH6nSrrHmiuwx68wrdJWt`

The generated private keypairs remain in ignored `.secrets/`. The user authorized
this simulated issuer for development. Demo mode always reports
`officialBtu=false`; future official issuer trust requires authenticated university
authorization and the configured trust material.

The initial deployment and funding are complete. For a new approved Devnet deployment, use `npm run deploy:devnet`. The helper verifies the expected Devnet genesis hash,
matching program/bootstrap keys and balance, deploys with a separate upgrade
authority, initializes the issuer and records actual public evidence after success.
Never commit keypairs or upload admin/upgrade keys to the API. Manual processing receives only the server-side demo issuer key; the browser receives no signing credential.

Local evidence and its limits are in [the checkpoint](ARCHITECTURE_PROGRESS.md)
and `evidence/local-chain.json`. Tests cover unauthorized initialization/issuance,
ordering, duplicate codes, pause, two-signer rotation and historical preservation.
These results do not replace real Devnet smoke tests.

`npm run issuer:admin` supports deliberate pause/resume and issuer rotation.
Historical issuer epochs remain immutable and independently verifiable. A later
approved university key can replace the demo issuer through rotation/configuration.
Mainnet is disabled. On-chain references contain no names, emails or award details.
