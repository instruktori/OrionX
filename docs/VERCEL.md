# One Vercel project, two HTTP services

Import `instruktori/OrionX` as one Vercel project with the repository root as its Root Directory. Keep dashboard build/install/framework overrides unset: root `vercel.json` owns per-service settings. Use Node.js 22. Both services use the committed lockfile and install the root npm workspace so `@orionx/core` and other workspace dependencies resolve.

Both HTTP service build commands regenerate Prisma Client after their install step. Each service's root `npm ci` replaces shared `node_modules`; the later web install removes the client generated during the API build. Regenerating it in the web build preserves the API's traced Prisma files through final deployment packaging. A manually built worker image generates its own client independently. These commands generate code only and do not apply database migrations.

The Solana client's `rpc-websockets` dependency uses CommonJS `require('uuid')`. Its UUID dependency is scoped to version 11.1.0 through a root override because newer UUID releases are ESM-only and fail in Vercel's CommonJS runtime. `npm run test:runtime` exercises the Solana import with Node's experimental require(ESM) support disabled, matching the observed hosted failure.

The API package declares `type: module` and preserves ES module imports during compilation because NestJS 12 is ESM-only. The runtime regression suite bundles and starts the API with require(ESM) disabled, then checks its HTTP liveness endpoint; it does not require database credentials or connect to a database.

Only in Vercel (`VERCEL=1`), Express trusts the immediate proxy hop so forwarded HTTPS and client IPs are interpreted correctly. The bundled runtime test checks same-origin HTTPS login validation and cross-origin denial behind that proxy. Standalone hosting retains Express's default proxy policy unless configured separately.

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

See [environment configuration](ENVIRONMENT.md) for the connected Supabase project, `DATABASE_URL`/`DIRECT_URL`, secret types, local env loading, and the `env:pull`, `env:check`, and `env:sync` commands.

Keep existing chain configuration in the project's runtime environment as required by `packages/core/src/solana.ts`: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, and `SOLANA_EXPECTED_GENESIS_HASH`. The health endpoint can run without these; actual verification fails closed when configuration is missing. `WEB_ORIGIN` is optional for a separate frontend; same-origin deployment does not need CORS. No fixed service hostnames or ports are required in production.

PostgreSQL, Redis, Supabase and Solana RPC are external dependencies, not Vercel HTTP services. Docker Compose remains for local databases only. Do not use localhost database URLs in a deployed environment. Do not use local filesystem artifact storage for durable cloud files.

Vercel Functions have request body limits; the current UI/API's 10 MB PDF allowance is not a guarantee that a 10 MB upload passes the platform gateway. Test within the platform limit; larger files need a separate direct-upload design.

## Administrator-triggered processing

The default `vercel.json` does not declare a worker daemon, and automatic GitHub CI does not build its Docker image. This keeps frontend/API pushes from rebuilding and storing an approximately 951 MB worker container every time. A daemon with zero instances still builds and stores its image; zero instances alone does not prevent registry storage growth.

The deployed admin page has **Run synchronization** and **Process pending jobs** controls. They call the authenticated `POST /api/v1/admin/jobs/process` endpoint, processing one durable stage per HTTP request (one source row per writeback stage). The browser continues until the queue drains or the administrator stops after the current stage. Closing the page stops further requests; work and signed attempts remain durable for the next run. Automatic polling/always-on hosting is deferred by user choice.

The API needs `MANUAL_WORKER_ENABLED=true`, the server-only `SOLANA_ISSUER_KEYPAIR_JSON` (issuer only), and `GOOGLE_SERVICE_ACCOUNT_JSON`, plus the existing private storage/database and pinned Devnet/source configuration. These secrets are not public frontend variables. Admin and upgrade keys remain operator-only. Student and anonymous callers cannot process jobs.

API builds prepare `apps/api/runtime-resources` with the canonical catalog, fonts and artwork, included explicitly in the function package. `maxDuration=60` bounds each request. The isolated ESM rendering regression test checks the same resource layout. Builds never migrate or reset databases.

The worker source, `Dockerfile.worker`, and local `npm run dev:worker` remain optional for future unattended polling. No daemon or automatic worker image build is added.

To build locally when Docker is installed:

```sh
docker build -f Dockerfile.worker -t orionx-worker .
docker run --rm --env-file .env orionx-worker
```

For local PDF processing, run `npm run dev:worker` alongside the HTTP router, with database and storage configuration exported in that shell. Local development may use `STORAGE_MODE=local`; future cloud worker hosting requires durable artifact storage. Existing stored container images must be cleaned up separately when removing the daemon configuration.

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

Use the URL printed by Vercel for both UI and API. The HTTP service names are `api`/`web`, the public API is `/api/*`, and web handles the catch-all. There are no current server-to-server HTTP bindings; the worker runs manually outside the default deployment. For future request-time server calls, use caller-side bindings rather than deployment hostnames. Root npm scripts expose API-only, web-only, combined HTTP, worker, schema generation, schema validation, type checks, and tests independently.
