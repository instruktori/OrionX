# Trust and privacy boundaries

This build is configured for synthetic students and a simulated issuer. Real-student release requires the remaining deployed integration checks and approved identity/trust policies. Registration and file integrity are reported separately from institutional issuer trust; demo mode always returns `officialBtu=false`.

- A demo key is never BTU confirmation.
- A verification code is a public locator, never authorization to download student PDFs.
- Do not upload private student records or credentials to this public repository.
- PDF hashing is exact-byte SHA-256. Re-saving a PDF changes its hash.
- A Devnet reset may remove old proof; never claim archival persistence.
- Never accept user-supplied RPC endpoints or programs in the verification API.
- JWT identity and student bindings must be enforced server-side before downloads. Google sign-in alone yields only a private, empty self-service workspace; official records require an administrator-created binding (see [student onboarding](STUDENT_ONBOARDING.md)).
- On-chain accounts must be validated for owner, discriminator, registry version, issuer epoch, slot/finality, and program trust root before returning REGISTERED.
- No user-controlled PDF is rendered or executed; uploads are bounded to 10 MiB and held in memory only.
- Do not expose PostgreSQL, Redis or worker credentials publicly.
