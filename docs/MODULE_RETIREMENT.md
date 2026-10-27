# Passport-only scope and database compatibility

OrionX supports BTU's AI Skills Digital Passport requirements: Google Sheets synchronization, cumulative skill and badge records, passport/PDF generation, Solana proof verification, version history, Google authentication, and private student and administrator workspaces.

The out-of-scope examination/assessment module has been removed from the application. Its student and administrator pages, navigation, dashboard requests/metrics, authoring services, API endpoints, client types, dedicated tests, and exclusive styling are gone. Former page and API URLs return 404 instead of exposing the feature behind a sign-in gate.

## Database compatibility

The unused `Assessment` and `AssessmentAttempt` models and the student back-relation have been removed from the active Prisma schema and generated client. No remaining feature reads or writes those tables.

The existing `0004_assessments` migration is intentionally retained **unchanged**. It may already be recorded in a deployed database's migration history. Editing/deleting that migration or automatically dropping its tables could break an existing installation or destroy historical records.

This cleanup adds no database migration and executes no database changes. Deployment of this PR does not drop or rewrite any table, credential, student record, or migration history. Existing retired tables remain private and unused; their original RLS and revoked browser grants remain intact. New databases replay the existing historical migrations, including these inert tables.

The physical tables are intentionally retained outside the active Prisma model. A future schema diff may propose dropping them. Do not apply such a generated drop as routine cleanup; any physical removal needs its own retention/backup review and explicit authorization. No destructive migration is required to deploy this PR. Generate the client normally with `npm run db:generate`.

## Shared functionality retained

The session provider, OAuth callback refresh, theme control, shared dialogs/forms, and their regression tests remain in use by passport and administrator pages. Their dependencies are retained. Source synchronization, credential issuance, PDF rendering, storage, chain verification, and authentication implementations are unchanged.

The confirmation dialog's metadata list has a neutral shared class name after removal of its original assessment-specific name. The dashboard retains its existing layout with three passport metrics instead of four metrics, and the existing landing-page section explains skill/badge learning formats without promoting examinations.

## Validation

Run the existing verification commands:

```sh
npm run db:generate
npm run db:validate
npm run typecheck
npm run build
npm test
```

There is no repository lint configuration or lint script. This cleanup also runs focused ESLint checks on the changed TypeScript/TSX files with temporary tooling outside the repository, without adding project dependencies or changing shared lint policy.

The HTTP regression in `apps/api/src/onboarding.test.ts` verifies all 12 retired API endpoints return 404 for anonymous and bearer-authenticated requests (36 checks), with no identity/workspace database lookups. The existing tests continue to cover onboarding/authorization, synchronization, credential processing, PDF packaging, Solana verification, session refresh, and theme switching.

After building, serve the frontend and confirm `/examinations`, nested question/attempt URLs, and `/admin/assessments` (including nested URLs) all return HTTP 404. Verify `/`, `/login`, `/dashboard`, `/passport`, `/admin`, and `/verify` still render, and search the rendered navigation/copy for removed links. These checks require no production credentials or data changes.

### Cleanup verification results

- Prisma generation and schema validation passed; the generated client contains no retired models.
- Workspace TypeScript checks, the production build, and focused linting passed.
- All 88 retained/new regression tests passed (including the 36 retired-API route checks within one test).
- Six former frontend URLs returned HTTP 404; all six retained application pages returned HTTP 200. Rendered pages contain no examination links or product copy.
- The production route manifest contains no retired pages. Browser inspection confirmed the admin URL shows the 404 page and the existing home/navigation design remains intact.
- Migration files are byte-for-byte unchanged. No database or user-data mutations were performed.
