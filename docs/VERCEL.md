# One Vercel project, two HTTP services

Import `instruktori/OrionX` as one Vercel project with the repository root as its Root Directory. Keep dashboard build/install/framework overrides unset: root `vercel.json` owns per-service settings. Use Node.js 22. Both services use the committed lockfile and install the root npm workspace so `@orionx/core` and other workspace dependencies resolve.

| Service | Directory | Framework | Public paths |
| --- | --- | --- | --- |
| api | apps/api | NestJS | /api and /api/* |
| web | apps/web | Next.js | All remaining paths |

The API receives the original path, including `/api`. Its Nest controller already owns `/api/v1`; no prefix stripping or extra prefix is needed. `/api` and unknown API routes return the API's 404 rather than falling through to the web app. Test `/`, `/verify`, `/api/v1/health/live`, and an unknown `/api/v1/*` route.

## Calls and bindings

The verification page is a client component. It sends GET and multipart POST requests to same-origin `/api/v1/verify/...`. Leave `NEXT_PUBLIC_API_ORIGIN` empty for Vercel. For separate hosting, optionally set this public build-time origin (without `/api/v1`) and set `WEB_ORIGIN` on the API to that frontend origin. It is a public browser URL, never a binding variable. No internal service URL is bundled into browser code.

There are currently no server-side HTTP calls from web to api or from api to web, so no service bindings are declared. The worker talks directly to PostgreSQL and artifact storage, not to either HTTP service. Shared npm packages are code dependencies, not network services.

If server-side web functions later call api, add a caller-side binding on web with all four fields: `{"type":"service","service":"api","format":"url","env":"ORIONX_API_URL"}`. Read that generated URL inside request-time functions only; never set it manually or access it during builds, in middleware, or in browser code. A binding does not replace the public rewrite needed by the current browser clients.

## Environment and storage

Keep existing chain configuration in the project's runtime environment as required by `packages/core/src/solana.ts`: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, and `SOLANA_EXPECTED_GENESIS_HASH`. The health endpoint can run without these; actual verification fails closed when configuration is missing. `WEB_ORIGIN` is optional for a separate frontend; same-origin deployment does not need CORS. No fixed service hostnames or ports are required in production.

PostgreSQL, Redis, Supabase and Solana RPC are external dependencies, not Vercel HTTP services. Docker Compose remains for local databases only. Do not use localhost database URLs in a deployed environment. Do not use local filesystem artifact storage for durable cloud files.

Vercel Functions have request body limits; the current UI/API's 10 MB PDF allowance is not a guarantee that a 10 MB upload passes the platform gateway. Test within the platform limit; larger files need a separate direct-upload design.

## Optional private worker daemon

`daemons.worker` builds the root `Dockerfile.worker` using the repository as its context, preserving shared workspace packages. It has no public route, open port, or HTTP binding. It reads PostgreSQL jobs and writes PDFs directly to artifact storage.

The committed `instances: {"iad1": 0}` keeps it paused while there is no configured database. To enable it, provide `DATABASE_URL`, apply the schema with `npm run db:push` for the disposable demo database, set `STORAGE_MODE=supabase` and the `SUPABASE_*` storage credentials, then set an instance count to 1. Choose a region near your database. Counts and regions can be changed in `vercel.json` or through Vercel daemon scaling. Do not automatically migrate databases during application builds.

The worker container explicitly generates Prisma Client before checking the worker. Runtime settings are `WORKER_POLL_MS` (3000), `WORKER_LEASE_MS` (120000), and `WORKER_MAX_ATTEMPTS` (5), all positive integers. Database polling failures back off instead of crashing repeatedly. SIGTERM/SIGINT stop new claims, drain the current job, and disconnect Prisma. The daemon has a 150-second shutdown grace period. Keep each render within the lease and grace periods; longer jobs need lease renewal before scaling. Existing row locking supports multiple workers, but database recovery/concurrency testing is still required before increasing instance counts.

During Vercel's daemon beta, daemons run only in production and `vercel dev` does not run them. For local PDF processing, run `npm run dev:worker` alongside the HTTP router, with database and storage configuration exported in that shell. The daemon filesystem is ephemeral; cloud execution requires durable Supabase storage. Local development may use `STORAGE_MODE=local`.

To build locally when Docker is installed:

```sh
docker build -f Dockerfile.worker -t orionx-worker .
docker run --rm --env-file .env orionx-worker
```

The worker still stops at STORED. Blockchain submission and real credential issuance remain separate work.

## Verification

From the repository root:

```sh
npm ci
npm run db:generate
npm run typecheck
npm run build -w @orionx/web
npm test
npm run dev:services
```

Use the URL printed by Vercel for both UI and API. The HTTP service names are `api`/`web`, the public API is `/api/*`, and web handles the catch-all. There are no current server-to-server HTTP bindings; `worker` is a private daemon. For future request-time server calls, use caller-side bindings rather than deployment hostnames. Root npm scripts expose API-only, web-only, combined HTTP, worker, schema generation, schema validation, type checks, and tests independently.
