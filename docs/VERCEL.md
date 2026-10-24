# One Vercel project, two HTTP services

Import `instruktori/OrionX` as one Vercel project with the repository root as its Root Directory. Keep dashboard build/install/framework overrides unset: root `vercel.json` owns per-service settings. Use Node.js 22. Both services install the root npm workspace so `@orionx/core` and other workspace dependencies resolve.

| Service | Directory | Framework | Public paths |
| --- | --- | --- | --- |
| api | apps/api | NestJS | /api and /api/* |
| web | apps/web | Next.js | All remaining paths |

The API receives the original path, including `/api`. Its Nest controller already owns `/api/v1`; no prefix stripping or extra prefix is needed. `/api` and unknown API routes return the API's 404 rather than falling through to the web app. Test `/`, `/verify`, `/api/v1/health/live`, and an unknown `/api/v1/*` route.

## Calls and bindings

The verification page is a client component. It sends GET and multipart POST requests to same-origin `/api/v1/verify/...`. `NEXT_PUBLIC_API_ORIGIN` is no longer used and should be removed from existing Vercel project settings. No internal service URL is bundled into browser code.

There are currently no server-side HTTP calls from web to api or from api to web, so no service bindings are declared. The worker talks directly to PostgreSQL and artifact storage, not to either HTTP service. Shared npm packages are code dependencies, not network services.

If server-side web functions later call api, add a caller-side binding on web with all four fields: `{"type":"service","service":"api","format":"url","env":"ORIONX_API_URL"}`. Read that generated URL inside request-time functions only; never set it manually or access it during builds, in middleware, or in browser code. A binding does not replace the public rewrite needed by the current browser clients.

## Environment and storage

Keep existing chain configuration in the project's runtime environment as required by `packages/core/src/solana.ts`: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, and `SOLANA_EXPECTED_GENESIS_HASH`. The health endpoint can run without these; actual verification fails closed when configuration is missing. `WEB_ORIGIN` is optional for a separate frontend; same-origin deployment does not need CORS. No fixed service hostnames or ports are required in production.

PostgreSQL, Redis, Supabase and Solana RPC are external dependencies, not Vercel HTTP services. Docker Compose remains for local databases only. Do not use localhost database URLs in a deployed environment. Do not use local filesystem artifact storage for durable cloud files.

Vercel Functions have request body limits; the current UI/API's 10 MB PDF allowance is not a guarantee that a 10 MB upload passes the platform gateway. Test within the platform limit; larger files need a separate direct-upload design.

## Worker scope requiring confirmation

`apps/worker/src/worker.ts` is an infinite PostgreSQL polling loop, not an HTTP server. It is deliberately absent from `services`; deploying it as a function would not reliably process jobs. This configuration deploys the UI and verification API only. To include PDF processing on Vercel, configure a supported daemon, or separately adapt it to a bounded queue/cron handler with durable storage. No worker deployment, database migration, or production credential issuance is claimed by this change.

## Verification

From the repository root:

```sh
npm install
npm run typecheck -w @orionx/web
npm run typecheck -w @orionx/api
npm run build -w @orionx/web
npm run test -w @orionx/core
npx vercel@latest dev --local
```

Use the URL printed by Vercel for both UI and API. The confirmation checklist is: service names `api`/`web`; public API `/api/*` and web catch-all; no current server-to-server bindings; continuous worker excluded pending a deployment decision.
