# Independent verification contract

`GET /api/v1/verify/:code` resolves a 160-bit public locator and reads a finalized Solana Devnet account. `POST /api/v1/verify/file` additionally compares exact uploaded PDF bytes with the on-chain SHA-256. Upload limit: 10 MiB.

Before a positive `REGISTERED` result, the verifier checks:
- Pinned RPC genesis hash and configured program ID, rather than trusting the browser.
- Program ownership, account length and Anchor account discriminators.
- Deterministic version, registry, config and historical issuer-epoch PDA addresses.
- Version-code match, nonzero PDF hash, coherent registry version/latest pointer and historical issuer epoch.
- A finalized RPC commitment.

`issuerTrust` remains `UNCONFIRMED` and `officialBtu` remains `false` until an independently authenticated university trust manifest and its verification policy are implemented. A cryptographic record by itself is not an official university credential.

**Important limitations:** the verifier has not been tested against a deployed program. It does not yet traverse and verify the entire previous-version chain, authenticate a BTU trust manifest, pin a program upgrade authority, or provide a proof-of-finality archival guarantee across Devnet resets.
