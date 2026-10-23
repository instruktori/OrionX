# Trust and privacy boundaries

**Do not use this build for real student issuance yet.** The verifier fails closed until a deployed Solana Devnet program has a pinned schema, issuer configuration and authenticated institutional trust root.

- A demo key is never BTU confirmation.
- A verification code is a public locator, never authorization to download student PDFs.
- Do not upload private student records or credentials to this public repository.
- PDF hashing is exact-byte SHA-256. Re-saving a PDF changes its hash.
- A Devnet reset may remove old proof; never claim archival persistence.
- Never accept user-supplied RPC endpoints or programs in the verification API.
- JWT identity and student bindings must be enforced server-side before downloads.
- On-chain accounts must be validated for owner, discriminator, registry version, issuer epoch, slot/finality, and program trust root before returning REGISTERED.
- No user-controlled PDF is rendered or executed; uploads are bounded to 10 MiB and held in memory only.
- Do not expose PostgreSQL, Redis or worker credentials publicly.
