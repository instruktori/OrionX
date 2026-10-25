# Remaining external setup

## Devnet is deployed

The program and simulated issuer are deployed. Real V1/V2 issuance, crash
recovery, private downloads and tamper rejection passed. See
`evidence/devnet-deployment.json` and `evidence/devnet-pipeline.json`.
Earlier deployment-wallet funding instructions are complete.

## Hackathon setup is configured

The Google service account has Editor access to the demo source and a renewable
credential, with protected source structure/system outputs and 62 stable record
bindings. All 18 passports and 20 finalized versions have verified writeback.
Real hosted Google sign-in and authenticated download/public tamper checks passed.

Credentials stay in ignored local files and server-only Vercel secrets. The API
receives the simulated issuer credential for on-demand processing; admin and
upgrade keys remain operator-only. The user's account remains a student.

## Manual operation

An administrator opens `/admin` and selects **Run synchronization** to import and
process changes, or **Process pending jobs** to resume saved work. Keep the page
open until the queue drains. **Stop after current step** preserves pending work.

The optional local worker is stopped and `SYNC_ENABLED=false`. Separate always-on
hosting and periodic scheduling are deferred by explicit user choice. No default
worker daemon or container build was added.

To add a synthetic verified award, insert a complete data row inside the named
`PassportRecords` range (above an existing data row), copy its native structure,
and use a unique Record ID with a known skill definition. Preserve original
identity/history and the badge formula. The worker enrolls stable metadata under
the configured structural protection, then writes system output only after proof
finalizes. Do not edit synchronized historical award inputs or system outputs.

Official university authorization, real-student deployment, mainnet and a full
5,000-transaction load test remain outside the approved hackathon scope.
