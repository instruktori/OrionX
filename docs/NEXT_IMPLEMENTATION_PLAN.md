# OrionX: admin management and QR verification handoff

Prepared 25 October 2026. Baseline commit: `0888b1b` on `main`.

## Intended result

Evolve the working hackathon application into a complete administrator workspace
and a verification experience that is easy to use from a phone, a printed
passport, a screenshot or an uploaded PDF.

This is an outcome-oriented handoff, not a prescribed implementation. The next
agent owns the solution design: revise the decomposition, order, architecture,
data model, libraries and interaction design wherever a better approach emerges.
The suggested workstreams below are starting points, not mandatory phases.

## What exists today

- Live application: https://orionx-phi.vercel.app
- Repository: https://github.com/instruktori/OrionX
- Next.js/React web, NestJS API, shared TypeScript core, Prisma/PostgreSQL,
  Supabase Auth/private storage and a deployed Solana Devnet registry.
- Google OAuth, self-service student workspaces and server-owned account roles.
- Google Sheets import, cumulative PDF generation, durable issuance jobs,
  immutable artifacts, transaction recovery and verified Sheets writeback.
- Public code verification, uploaded-file hashing, private student downloads and
  issued version history.
- QR codes already embedded in both PDF templates. They open
  `/verify?code=<version-code>` for a particular issued version.
- Admin dashboard statistics, student search, Run synchronization, Process pending
  jobs, progress reporting and Stop after current step.
- A shared job processor supports both the optional daemon and bounded admin HTTP
  requests. Manual processing has passed a complete hosted issuance test with no
  daemon running.

The recorded baseline has **18 passports, 20 finalized versions and 62 live award
rows**. The original fixtures contain 60 awards; two labelled synthetic awards
were added to the live demo copy to demonstrate cumulative V2/V3. The recorded
validation includes **81 automated checks**, type checking, production build,
real Devnet issuance, Google Sheets writeback, row movement, recovery, private
downloads, tamper rejection and Google browser sign-in. GitHub CI passed for the
baseline commit.

These are timestamped observations, not a guarantee that external state has stayed
unchanged. `docs/evidence/` contains the supporting records. Earlier status/design
documents include historical statements that are now stale; reconcile them with
the code and newer evidence during the work.

## Account and browser handoff

- The user identified `instruktori.ge@gmail.com` as the intended administrator.
  A live database inspection found it explicitly bound as a student to synthetic
  record `BTU-T-0001`. After explicit user confirmation, that binding's role was
  corrected to `admin` and an `IDENTITY_ROLE_CORRECTED` audit event was recorded.
  Its existing student-record link was preserved.
- `luka.gotsadze.1@btu.edu.ge` remains a self-registered student account.
- Google sign-in succeeded in Chrome's **instruktori / Instruktori (Luka)** profile.
  The admin dashboard and its buttons still need browser confirmation after the
  role correction. Native Chrome control was interrupted during that refresh;
  the role update itself was verified in the database.
- A linked administrator currently resolves to an admin session without a
  `studentId`, even when the database retains its student link. Consider the
  desired admin-versus-personal-workspace experience as part of product design.

Local environment files and `.secrets/` already contain configured runtime
credentials. Vercel has the server-only credentials used by hosted manual
processing. No credential values are included in this handoff.

## Workstream: a complete administrator workspace

### People, accounts and access

Give administrators a practical way to find student records and self-registered
workspaces, inspect the current account binding, associate an account with the
intended student and manage the intended application role. The experience should
make it clear which account, student record and permission are being changed and
show the resulting state.

Useful cases include an unlinked Google account, an already linked student, an
account intended to administer the application, conflicting links, and an admin
who also has a personal student record. The recent instruktori role mismatch is a
real example of the confusion this UI should resolve.

Existing capabilities include:

| Capability | Current API, relative to `/api/v1` | Current UI coverage |
| --- | --- | --- |
| List student workspaces | `GET /admin/workspaces` | Missing |
| Link workspace to a student | `POST /admin/workspaces/:workspaceId/link` | Missing |
| Create/update identity binding and role | `POST /admin/identities` | Missing |
| List passports | `GET /admin/passports` | Basic table/search |
| Inspect a passport's versions | `GET /admin/passports/:id/versions` | Missing detail view |

There is no complete account-management read API today. Extend the backend as the
chosen UI and account model require.

### Passport and version details

Make a student/passport row useful as an entry point to its complete record:
identity, cumulative awards, source records, issuance state, version timeline,
verification links, chain evidence and document access appropriate to the caller.
Help an operator understand why a version is pending, finalized or superseded.

Administrator document access is a product/backend gap to inspect: the present
download route is the student's `/me/passport/.../download` route, rather than a
general admin document-download route.

### Jobs, failures and source conflicts

Turn queue progress into actionable operations. Surface individual jobs, stage,
last error, attempts, waiting/retry state and related passport/source record.
Connect eligible retries to the existing retry operation and make conflicts
understandable enough to resolve through the appropriate source workflow.

Existing operations include:

| Capability | Current API, relative to `/api/v1` | Current UI coverage |
| --- | --- | --- |
| Queue synchronization | `POST /admin/sync` | Present |
| Inspect a sync run and its conflicts | `GET /admin/sync-runs/:id` | Summary only |
| Process a durable stage | `POST /admin/jobs/process` | Present |
| Retry an eligible individual job | `POST /admin/jobs/:id/retry` | Missing |
| Inspect audit events | `GET /admin/audit` | Missing |

There is no complete job-list/detail or conflict-resolution interface yet. Shape
the additional APIs and operator workflow around the actual failure states.

### Source entry and awards

Student/skill/award entry currently happens in Google Sheets. Decide how the admin
workspace should improve this: a guided source workflow, in-app entry backed by
the Sheet, richer catalog management, or another coherent approach.

The important product outcome is that an operator understands where a change is
recorded, sees validation feedback, and can follow it into a new cumulative
passport version. Existing source identities, Record IDs, badge formulas, row
metadata and historical issuance records provide the reconciliation context.

### Scale and information architecture

Several list endpoints use `take: 100`; the current passport search and dashboard
totals operate on that returned subset. A management interface for thousands of
students needs complete discoverability, accurate counts and a usable navigation
model. Choose appropriate search, filtering, pagination and query strategies for
passports, workspaces, versions, jobs and audit records.

## Workstream: verification without transcription

### Uploaded PDFs

Let a user select an issued PDF and reach its exact-byte verification result with
minimal manual input. Discover the relevant verification code from the document
when possible, using its existing QR and/or printed code; offer a clear recovery
path when discovery is ambiguous or unsuccessful.

Consider documents with multiple QR symbols, codes on later pages, low-resolution
scans, screenshots, unrelated QR content, a manually entered code that disagrees
with the file, and an authentic historical version that is now superseded.
The next agent can choose the recognition strategy and where the work runs.

The current verification page loses structured proof fields on non-success HTTP
responses: a tampered document returns HTTP 422 with useful proof information,
but the UI currently retains only the message. Present those outcomes as clearly
as successful matches.

### Camera and image scanning

Add an intuitive scanning path where it improves the workflow: live camera,
uploaded QR image, or both. Ordinary phone cameras can already open the QR link
printed on a passport; an in-app scanner is an additional convenience rather than
the first QR implementation.

A usable result includes camera permission/availability feedback, a way to stop
scanning, handling of repeated detections, and an alternative when the camera is
unavailable. Evaluate the actual phone and desktop experience rather than just a
desktop emulator.

### Share and verification presentation

Explore a visible QR, copyable verification link and version-specific sharing
from the student and admin record views. Printed and on-screen codes should lead
to the correct version, including older authentic versions.

Keep the meaning of each result legible to a nontechnical verifier:

- **Registered** concerns the finalized chain record.
- **Match / mismatch** concerns the uploaded PDF's exact bytes.
- **Latest / superseded** concerns its place in the passport's version history.
- **Demo / confirmed issuer** concerns institutional trust.

The current deployment uses a simulated issuer and reports `officialBtu=false`.
The existing result “REGISTERED / NOT_CHECKED / LATEST / DEMO” is expected after
a code-only lookup. Easier scanning should make that distinction easier to
understand, while file comparison establishes document integrity.

## A useful delivery order

One reasonable sequence is:

1. Confirm the real admin session and exercise the existing manual controls.
2. Design the administrator navigation and resolve the main account/record/job
   workflows, including the backend gaps and complete listing behavior.
3. Deliver usable admin management views and recovery actions.
4. Simplify uploaded-PDF verification and result presentation.
5. Add camera/image scanning and sharing where they improve the experience.
6. Exercise the combined workflows on deployed services and update the handoff.

Feel free to reorganize or combine this work. The priority is a coherent product
that an administrator and an outside verifier can operate without developer help.

## Outcomes to demonstrate

- The intended Google admin account opens the dashboard; the BTU student account
  continues to receive student permissions.
- An administrator can find records beyond the first 100, inspect history,
  understand account bindings, manage the selected workflows and recover an
  eligible failed job from the UI.
- Source changes become cumulative versions of the same passport, with clear
  progress, actionable failures and visible completion.
- A QR or shared link opens the intended version's public verification page.
- An uploaded original PDF produces a match with minimal transcription; altered
  bytes produce a visible mismatch. Historical versions remain understandable.
- Camera/image scanning handles ordinary success, permission denial, unavailable
  hardware and unrecognized input gracefully.
- Access decisions, role/link changes, issued-document history and audit evidence
  remain consistent with the product's trust model.
- The deployed application, tests and documentation describe the same delivered
  behavior. Report what was actually observed and what remains uncertain.

## Starting points in the repository

| Area | Main files |
| --- | --- |
| Admin UI | `apps/web/src/app/admin/page.tsx` |
| Student workspace and versions | `apps/web/src/app/passport/page.tsx` |
| Public verification | `apps/web/src/app/verify/page.tsx` |
| Sign-in/session and navigation | `apps/web/src/lib/session.ts`, `apps/web/src/components/shell.tsx`, `apps/web/src/lib/oauth-redirect.ts` |
| HTTP API | `apps/api/src/server.ts` |
| Account bindings and roles | `packages/core/src/auth.ts` |
| Source import/writeback | `packages/core/src/sheets.ts`, `sync.ts`, `writeback.ts` |
| Durable processing | `packages/core/src/processor.ts`, `jobs.ts` |
| PDF templates and QR generation | `packages/core/src/pdf.ts`, `pdf-btu.ts`, `templates.ts` |
| Chain verification and issuer trust | `packages/core/src/solana.ts`, `trust.ts`, `protocol.ts` |
| Database model | `packages/db/prisma/schema.prisma` and migrations |
| Design context | `apps/web/DESIGN.md`, `apps/web/src/app/globals.css` |
| Deployment/resources | `vercel.json`, `scripts/prepare-api-resources.mjs`, `packages/core/src/resources.ts` |
| Existing evidence | `docs/evidence/`, `docs/ARCHITECTURE_PROGRESS.md` |

The repository targets Node 22. Existing validation entry points include
`npm run typecheck`, `npm test`, `npm run build`, `npm run check:readiness`,
`npm run test:api`, `npm run test:ledger`, `npm run test:live`,
`npm run test:manual`, `npm run test:pipeline:devnet` and `npm run test:capacity`.
Some live scripts deliberately change synthetic source data or issue real Devnet
test records; their implementation and recorded evidence explain their scope.
Use and extend whichever checks best establish the new behavior.

## User preferences carried forward

The user chose manual job processing for this hackathon and deferred separate
always-on worker hosting. They approved a simulated issuer for development.
They explicitly asked for an implementation plan that leaves the next agent
free to make better technical and product decisions. This handoff records those
choices and the current state, rather than imposing a fixed solution.
