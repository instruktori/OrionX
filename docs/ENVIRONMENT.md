# Supabase and Vercel configuration

The existing Vercel project is `lukas-projects-909506d4/orionx` (GitHub: `instruktori/OrionX`). Its root is the repository root, with `services` as its framework and Node.js 22. The Supabase project is `BTU-AI-DIGITAL`, reference `pjddlhkgnjvsgqqedoye`, in `eu-west-1`.

## Local setup

```sh
npm ci
npx vercel login
npx vercel link --project orionx --scope lukas-projects-909506d4 --yes
npm run env:pull
npm run env:check -- --cloud
npm run db:generate
```

`env:pull` downloads Development settings into ignored `.env.local`. It replaces that file. Keep machine-specific settings in ignored `.env.development.local`; these take precedence over pulled values. Never paste secret values into source files or command arguments.

API, web, worker, and Prisma workspace commands load the repository's environment files even when run from their own workspace directories. Shell/platform settings win first, followed by `.env.<mode>.local`, `.env.local`, `.env.<mode>`, and `.env`. Tests skip `.env.local`. `dev` uses development files; `build` and `start` use production files. Production and Preview secrets are not returned by `vercel env pull`.

## Settings used by the application

| Variable | Purpose | Vercel type |
| --- | --- | --- |
| `DATABASE_URL` | Prisma runtime: Supabase transaction pooler, port 6543, `pgbouncer=true`, `connection_limit=3`, `sslmode=require` | Secret in Production/Preview |
| `DIRECT_URL` | Prisma schema commands: session pooler, port 5432, `sslmode=require` | Secret in Production/Preview |
| `SUPABASE_URL` | Project API origin | Config |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_...` API key for PDF storage | Secret in Production/Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional legacy fallback, unnecessary when the modern secret is set | Secret in Production/Preview |
| `SUPABASE_STORAGE_BUCKET` | Private bucket, `passport-pdfs` | Config |
| `STORAGE_MODE` | `supabase` in the cloud | Config |
| `SUPABASE_JWKS_URL` | Defaults to `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` | Config |
| `AUTH_JWT_ISSUER` | Defaults to `<SUPABASE_URL>/auth/v1` | Config |
| `AUTH_JWT_AUDIENCE` | Defaults to `authenticated` | Config |

Development secrets use Vercel Config so authorized developers can pull them. Never prefix server credentials with `NEXT_PUBLIC_`. Google OAuth is mediated by the API through Supabase, so the browser does not need a Supabase API key. JWT verification requires the project's asymmetric signing keys; this project's ES256 JWKS endpoint has been checked.

Same-origin Vercel routing does not need `NEXT_PUBLIC_API_ORIGIN` or `WEB_ORIGIN`. Keep them unset unless hosting the frontend separately.

## Read and write Vercel settings

```sh
npx vercel project inspect --non-interactive
npx vercel env ls

# Review names/types, with no values printed. The source file must be ignored.
npm run env:sync -- --environment production --file .env.production.local

# Save that plan. Existing values are preserved unless --replace is also supplied.
npm run env:sync -- --environment production --file .env.production.local --write
```

The sync command verifies the linked project, publishes only known application settings, passes values through stdin, and stores private Production/Preview values as Secrets. It refuses localhost database URLs for cloud deployments. It does not upload OIDC tokens, local filesystem paths, or unrelated shell credentials. Prepare a separate source file with the correct credentials for each environment. Configure an isolated Supabase branch/project before giving Preview deployments write access; no Preview database credentials have been installed.

Environment changes apply to subsequent deployments. The sync command does not deploy code or restart the worker.

## Database and private storage

The seven Prisma tables have been created in the connected Supabase project. RLS is enabled on all seven; there are no browser access policies. The trusted Prisma backend connects directly to PostgreSQL.

The `passport-pdfs` bucket is private, accepts only `application/pdf`, and limits files to 10 MiB. [Bucket configuration](../infra/supabase/storage.sql) records the setup. The backend performs create-only uploads and authenticated reads; public access is not required. Modern secret keys use the `apikey` header, while the legacy service-role JWT also supplies an Authorization header.

To initialize another disposable demo database, verify `DATABASE_URL` and `DIRECT_URL`, then run `npm run db:push`. Ensure RLS is enabled on every application table before exposing the project to clients; this project's automatic RLS trigger already enabled it. Schema commands are never part of application builds.

The API storage/auth key is configured server-side. Devnet deployment, live Sheets access, private issuance and Google browser sign-in have since been verified; see [the checkpoint](ARCHITECTURE_PROGRESS.md) for timestamped evidence.

Manual processing additionally uses `MANUAL_WORKER_ENABLED=true`, `SOLANA_ISSUER_KEYPAIR_JSON` and `GOOGLE_SERVICE_ACCOUNT_JSON` as server-only secrets. `SOURCE_MODE=sheets`, the demo Sheet ID/named range, `CHAIN_MODE=devnet` and pinned program/genesis configure the source and chain. `SYNC_ENABLED=false` keeps automatic polling off. The user's Google account retains student permissions; only database-bound administrators may trigger processing.

For a local optional worker, use ignored key files instead of inline JSON. Never upload admin/upgrade keys or expose credentials with NEXT_PUBLIC_. `env:sync` handles secret values through stdin and prints names/types only.
