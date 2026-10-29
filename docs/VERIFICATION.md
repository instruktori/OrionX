# Independent verification contract

`GET /api/v1/verify/:code` resolves a 160-bit public locator and reads a finalized Solana Devnet account. `POST /api/v1/verify/file` additionally compares exact uploaded PDF bytes with the on-chain SHA-256. Upload limit: 10 MiB.

Before a positive `REGISTERED` result, the verifier checks:
- Pinned RPC genesis hash and configured program ID, rather than trusting the browser.
- Program ownership, account length and Anchor account discriminators.
- Deterministic version, registry, config and historical issuer-epoch PDA addresses.
- Version-code match, nonzero PDF hash, coherent registry version/latest pointer and historical issuer epoch.
- A finalized RPC commitment.

`issuerTrust` remains `UNCONFIRMED` and `officialBtu` remains `false` until an independently authenticated university trust manifest and its verification policy are implemented. A cryptographic record by itself is not an official university credential.

## Verification guarantees and evidence boundaries

A positive document-integrity result rests on multiple independent checks rather than a matching code alone:

| Check | What the implementation evaluates | Why it matters |
| --- | --- | --- |
| Exact document integrity | SHA-256 of the uploaded PDF bytes versus the finalized version account's recorded hash | A changed byte must fail, even if the original verification code is still present |
| On-chain record | Configured Devnet genesis/program ID, account ownership/discriminators, expected PDAs, nonzero recorded hash and finalized commitment | An arbitrary database entry or client-supplied wallet address is insufficient to establish an anchored record |
| Version status | Passport registry, version number and current-version pointer | An authentic prior version can be reported as superseded, not necessarily the latest |
| Recorded issuer epoch | Matching historical issuer-epoch account and registry relationships | Version proofs are interpreted in the recorded issuer context; **official BTU authority remains unconfirmed** |
| Access boundary | Public verifier accepts anonymous checks; private downloads remain session/ownership-gated | Public authenticity checks do not expose authenticated private document storage |

The integrity and status results are **separate** from institutional trust. The demonstrator can verify that a PDF corresponds to a finalized Solana Devnet test-issuer record; it does **not** claim an authenticated BTU-controlled signing identity.

### Concrete public example

A recorded hosted **V3** sample has an inspectable [verification endpoint](https://orionx-phi.vercel.app/api/v1/verify/D1-BA4V45SHOBSRMOBTFYDFU7M4LUFOELZR), [Solana Devnet transaction](https://explorer.solana.com/tx/K6HKc2iZ4MxZZgf6wTnjfy3bkBXmTERZQ4FwQjd7detGs1bSAayzTYVBxqvwYyd3MS8eGLHHsY6JBgo4XjNh5xp?cluster=devnet), and [version account](https://explorer.solana.com/address/63eb4WVt2wfD61LnYazkR6DHDQizDD5hyDzfDDT1zYcw?cluster=devnet). These values are also recorded in `docs/evidence/hosted-manual.json`.

This is a historical demonstration; live availability and Devnet state should be checked separately before claiming a present-tense response.

### Negative-case execution evidence

- **One-bit tamper rejection:** both isolated real-Devnet and hosted checks distinguish a modified PDF from its recorded original (`docs/evidence/devnet-pipeline.json`, `docs/evidence/live-sheets.json`).
- **Superseded-version reporting:** the isolated Devnet V1/V2 run reports V1 as authentic but superseded after V2 (`docs/evidence/devnet-pipeline.json`).
- **Unauthorized access denied:** recorded tests reject anonymous/unrelated-student private downloads and student requests to administrative operations (`docs/evidence/live-sheets.json`, `docs/evidence/hosted-manual.json`).
- **Crash and replay recovery:** a killed worker and restart completed a finalizable issuance, with replay/idempotency checks also recorded (`docs/evidence/devnet-pipeline.json`).

## Recorded validation — 25 October 2026

The verifier **has been exercised against a deployed Solana Devnet program**. See the dated, independently inspectable artifacts:

- `docs/evidence/devnet-pipeline.json`: isolated real-Devnet V1/V2 issuance, finalized account verification, original-PDF acceptance, one-bit tamper rejection, superseded-version handling, worker restart recovery, and access checks. It contains transaction signatures, version account addresses, hashes, and program ID.
- `docs/evidence/live-sheets.json`: hosted verification and PDF tamper checks against records backed by real Devnet finalization and Google Sheets writeback.
- `docs/evidence/hosted-manual.json`: hosted administrator-triggered V3 issuance and finality, followed by source writeback.
- `docs/evidence/acceptance-summary.json`: dated counts for 18 demo passports, 20 finalized versions, and 62 synchronized award rows.

These files record checks made at a specific time. They do **not** establish current uptime, an actively hosted unattended worker, or an official BTU issuer. The hosted demo currently processes stages through administrator controls; automatic worker processing is implemented but not enabled as an unattended Vercel service.

## Remaining limitations

The verifier does not yet independently traverse the **entire** previous-version chain, authenticate a university-controlled BTU trust manifest, pin a program upgrade authority, or guarantee permanent proof-of-finality archives across Devnet resets. A finalized Devnet record is not a university endorsement, and historical acceptance evidence is not a substitute for checking a live response today.
