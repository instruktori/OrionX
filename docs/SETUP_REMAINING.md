# Two external setup steps

## 1. Free Solana Devnet funding

The demo keys have been generated and the program compiled. Automated faucet
requests were rate-limited; the deployment wallet has no Devnet funds.

1. Open https://faucet.solana.com and leave the network on **devnet**.
2. Enter deployment wallet `BNcEvP3benzCX7tc1W2U6upZ5HVT4hzneZahVKMpCPiv`.
3. Request a total of **4 Devnet SOL** (for example two requests of 2 SOL, subject
   to the faucet's current limits). Sign in through the faucet if it requires it.
4. Tell the implementation operator when funded. Do not buy or send mainnet SOL.

The current helper estimates 2.481 Devnet SOL for the initial deployment budget,
plus issuer funding. This is test-network currency, not a real payment.

Then run `npm run deploy:devnet`. It checks the actual network, uses separate
program/admin/issuer/upgrade keys, initializes the issuer, updates ignored local
configuration and writes public deployment evidence only after success. Private
CLI recovery diagnostics stay in `.secrets/deployment.log`.

Official faucet guidance: https://solana.com/developers/cookbook/development/airdrops-and-faucets

## 2. Worker identity for Google Sheets

The chat connector can operate Sheets interactively. It does not provide the
application worker with a renewable runtime credential or Google Cloud project
administration access.

1. Select/create a project in https://console.cloud.google.com.
2. Under APIs & Services → Library, enable **Google Sheets API**.
3. Under IAM & Admin → Service Accounts, create `orionx-passport-sync`.
   No broad Google Cloud project role or domain-wide delegation is needed for
   access to this one shared spreadsheet; skip optional project-role grants.
4. On that account, open Keys → Add key → Create new key → JSON.
5. Save the JSON locally as
   `/Users/luka/Desktop/OrionX/.secrets/google-service-account.json`.
   Keep it out of chat and source control.
6. Copy its `client_email` and share only the demo source Sheet with that email
   as an Editor:
   https://docs.google.com/spreadsheets/d/1myYLRd8gSwhmHoe8rcY3D1Y2NJhMU55AzRs1HGnVQMQ/edit
7. Tell the operator the file is ready. They can configure the worker's
   GOOGLE_APPLICATION_CREDENTIALS (or its server-only JSON secret), verify access,
   protect Q–T for the service identity, and switch SOURCE_MODE from fixture to sheets.

The Sheet ID, numeric tab ID, `PassportRecords` named range and 60 row metadata
bindings are already prepared. The original shared workbook is unchanged.

Google credential documentation:
https://developers.google.com/workspace/guides/create-credentials

## After these steps

The operator handles deployment, worker activation, real Sheets → PDF → Devnet
issuance, student download, public verification, one-bit tamper rejection, V2
history and failure-recovery evidence. No institutional approval is required for
the explicitly labeled simulated issuer. A later official university deployment
requires approved key/trust material and a separate network/deployment review.
