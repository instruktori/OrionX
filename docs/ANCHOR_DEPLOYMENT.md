# Solana Devnet registry — predeployment blockers

The Anchor source is a first implementation of immutable passport/version accounts, issuer rotation and pause control. **It is not deployed, audited or verified.**

1. Generate a new program keypair using the Solana/Anchor CLI; replace both placeholder program IDs and recompile.
2. Replace BOOTSTRAP_ADMIN with an explicitly approved public key, not a zero/default key.
3. Obtain explicit institutional approval for the issuer wallet before any BTU_CONFIRMED claim.
4. Add Anchor tests for unauthorized initialize, issuer rotation, pause, duplicate code, non-issuer registration, version chain and old-record persistence.
5. Implement a strict independent account parser (Anchor discriminators, expected data lengths, PDA seeds, owner, issuer epoch, registry latest and official trust manifest).
6. Pin the Devnet genesis hash in the verifier configuration; do not infer it from an arbitrary RPC.
7. Deploy only to Solana Devnet and document program ID, deployment signature and upgrade authority custody.
8. Use a test-funded wallet and never commit any private key.

**Do not execute** `anchor deploy` with these placeholder keys. The zero bootstrap key is deliberately unusable so that the contract cannot accidentally establish an unapproved issuer.

On-chain references are opaque random bytes; never put names, emails or award details on-chain.
