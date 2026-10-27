# Assessment workflow and redesign validation

## Scope

Assessments were absent from the original repository. The new workflow is additive and does not change the existing Google PKCE, identity binding, passport issuance, PDF storage, or Solana verification contracts.

Two question types are implemented end to end: `SINGLE_CHOICE` and `MULTIPLE_CHOICE`. All questions have equal weight; multiple-answer questions require an exact set match, with no partial credit. Passing uses the exact ratio, while the displayed score is rounded to the nearest whole percent. The UI explains these rules before the student begins.

Assessment results are private learning records. They do not create `Award`, `Passport`, `Version`, or issuance jobs. University staff continue to use the existing authorized credential process.

## Deployment prerequisite

The additive Prisma migration is `packages/db/prisma/migrations/0004_assessments/migration.sql`. It creates `Assessment` and `AssessmentAttempt`, indexes attempt ownership/history, adds foreign keys and consistency checks, enables RLS, and denies direct access to PUBLIC, anon, and authenticated roles. Only the trusted backend reads private content and answer keys.

Generate the Prisma client and deploy the migration through the repository's normal database release process before deploying the new assessment API:

```sh
npm run db:generate
node scripts/with-env.mjs prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

The implementation session applied all migrations only to a disposable local PostgreSQL database. No production migration, credential, user record, or deployment was changed. No assessments are seeded into the application or production database. An authorized administrator creates and publishes actual assessments in the studio.

## API contracts

All paths below are relative to `/api/v1`. Student responses are explicitly projected and exclude answer keys and private snapshots. Private GET responses use `Cache-Control: private, no-store`.

| Endpoint | Authority / behavior |
| --- | --- |
| `GET /assessments` | Authenticated discovery and caller-owned attempt history; includes eligibility and completed count. |
| `GET /assessments/:id` | Published, active overview and caller-owned attempt availability. |
| `POST /assessments/:id/attempts` | University-linked student record required; starts or resumes an attempt. |
| `GET /assessment-attempts/:id` | Caller must own the attempt, including administrators. |
| `POST /assessment-attempts/:id/save` | Validated answers/flags plus expected revision; stale revisions return 409. |
| `POST /assessment-attempts/:id/submit` | Atomically grades and finalizes; repeated submissions return the fixed result. |
| `GET /admin/assessments` | Server-authorized admin metadata list, without answer keys. |
| `GET /admin/assessments/:id` | Server-authorized admin editor content; contains private answer keys. |
| `POST /admin/assessments` | Validates and creates a private draft; audited. |
| `POST /admin/assessments/:id/update` | Only active drafts can change; audited. |
| `POST /admin/assessments/:id/publish` | Validates and publishes immutable content; audited. |
| `POST /admin/assessments/:id/archive` | Hides discovery and blocks new attempts, preserving existing records; audited. |

Start uses a serializable transaction and a unique assessment/student/attempt-number constraint. Content is frozen into each attempt. The server determines start/deadline, maximum attempts, ownership, scoring, and finality. Client timers and disabled controls are presentation only. An expired attempt is graded from its last persisted answers when read, saved, or submitted; the client retrieves the result at expiry. No browser polling is needed after a page is closed.

Saves use optimistic concurrency and are serialized in the client. Autosaves are throttled to preserve the existing API rate limits. Save failures keep local answers visible and offer retry or an explicit reload of the persisted attempt. The focused header and bottom exit action both save before navigation. Unsaved browser unloads receive a native warning. The UI does not claim an offline or failed save succeeded.

## Verification

```sh
npm run typecheck
npm run build
npm test
```

`apps/web/tests/session-theme.test.cjs` exercises the shared session provider, stale-request protection after callback refresh, failed/successful sign-out, and persistent theme switching without browser debugging permissions.

`apps/api/src/assessments.test.ts` covers schema validation, key leakage, exact-set grading, score rounding, invalid selections, flags, and linked-student requirements.

`apps/api/src/assessments.integration.test.ts` runs against a real local PostgreSQL database when `ORIONX_TEST_DATABASE_URL` is provided. It refuses non-local hosts or a database name other than `orionx_test`. It uses a local signed JWKS service and real server authorization. It covers creation/editing/publishing, private drafts, concurrent starts, persistence, stale revisions, cross-student access, immutable submissions, attempt limits, server expiry, absence of credential issuance, table privileges/RLS, and archive preservation. Test-created rows are isolated by a unique prefix and removed after the suite.

```sh
ORIONX_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/orionx_test \
  npm run test -w @orionx/api -- --run src/assessments.integration.test.ts
```

A fresh non-Supabase test database needs local roles `anon`/`authenticated` and a compatibility definition for the existing `public.rls_auto_enable()` function referenced by migration 0002. The implementation session provided that stub only in its empty local test database; the original migration was preserved.

Browser inspection covered 1440px desktop, 768px tablet, and 390px phone viewports. The question screen rendered persisted server answers, flags, and a server deadline, with no page overflow. Dashboard, passport, discovery, introduction, verification, login, and admin layouts were inspected. Screenshots and logs are in ignored `output/redesign/`.

Interactive browser checks were limited by the in-app browser's inspection overlay intercepting input and a declined raw debugging permission. Server/API tests exercised actual persistence, grading, and permissions. Live external Google OAuth, live camera permissions, live blockchain proofs, and production deployment were not exercised by the isolated assessment tests.

## Validation outcome

The final full suite passed **100 tests** with the real PostgreSQL integration suite enabled: configuration (1), runtime/packaged rendering (4), API/auth/assessment (30), frontend session/theme (4), worker (4), and core/credential logic (57). The production build and workspace TypeScript checks passed. Prisma validation passed, the model-to-test-database diff was empty, and the final migration chain was applied successfully to a second clean local database.

The frontend tests add only a development test renderer; production dependencies are unchanged. That renderer emits React's deprecation notice during tests. This does not affect the application bundle or test results.
