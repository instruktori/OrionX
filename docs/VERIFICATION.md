# Independent verification contract

`GET /api/v1/verify/:code` resolves a 160-bit public locator and reads a finalized Solana Devnet account. `POST /api/v1/verify/file` additionally compares exact uploaded PDF bytes with the on-chain SHA-256. Upload limit: 10 MiB.

Before a positive `REGISTERED` result, the verifier checks:
- Pinned RPC genesis hash and configured program ID, rather than trusting the browser.
- Program ownership, account length and Anchor account discriminators.
- Deterministic version, registry, config and historical issuer-epoch PDA addresses.
- Version-code match, nonzero PDF hash, coherent registry version/latest pointer and historical issuer epoch.
- A finalized RPC commitment.

`issuerTrust` remains `UNCONFIRMED` and `officialBtu` remains `false` until an independently authenticated university trust manifest and its verification policy are implemented. A cryptographic record by itself is not an official university credential.

## Recorded validation — 25 October 2026

The verifier **has been exercised against a deployed Solana Devnet program**. See the dated, independently inspectable artifacts:

- `docs/evidence/devnet-pipeline.json`: isolated real-Devnet V1/V2 issuance, finalized account verification, original-PDF acceptance, one-bit tamper rejection, superseded-version handling, worker restart recovery, and access checks. It contains transaction signatures, version account addresses, hashes, and program ID.
- `docs/evidence/live-sheets.json`: hosted verification and PDF tamper checks against records backed by real Devnet finalization and Google Sheets writeback.
- `docs/evidence/hosted-manual.json`: hosted administrator-triggered V3 issuance and finality, followed by source writeback.
- `docs/evidence/acceptance-summary.json`: dated counts for 18 demo passports, 20 finalized versions, and 62 synchronized award rows.

These files record checks made at a specific time. They do **not** establish current uptime, an actively hosted unattended worker, or an official BTU issuer. The hosted demo currently processes stages through administrator controls; automatic worker processing is implemented but not enabled as an unattended Vercel service.

## Remaining limitations

The verifier does not yet independently traverse the **entire** previous-version chain, authenticate a university-controlled BTU trust manifest, pin a program upgrade authority, or guarantee permanent proof-of-finality archives across Devnet resets. A finalized Devnet record is not a university endorsement, and historical acceptance evidence is not a substitute for checking a live response today.
