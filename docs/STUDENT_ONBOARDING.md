# Self-service student onboarding

**Principle:** authentication grants access to your own private workspace. University authorization grants the authority to verify academic identity and issue official credentials. These are separate permissions.

## Flow

1. Student selects **Continue with Google** (existing Supabase OAuth, PKCE S256, signed state cookie, HttpOnly session cookies — unchanged).
2. The API verifies the Supabase JWT and takes the immutable `sub` (never the email).
3. `resolveSession` resolves the caller in this order:
   1. `StudentIdentity` role `admin` → **ADMIN** (unchanged).
   2. `StudentIdentity` role `student` with `studentId` → **UNIVERSITY_VERIFIED** (unchanged; original passport and history).
   3. Otherwise → **SELF_REGISTERED**: a `StudentWorkspace` is created idempotently for `(provider, subject)` and the user receives role `student` with no `studentId`.
4. The callback redirects to `/passport`; administrators still land on `/admin`.

No administrator approval is needed to register, sign in, or view an empty workspace.

## Google authentication ≠ university verification

| Level | Established by | May do |
|---|---|---|
| Self-registered | Google sign-in only | View own empty workspace, sign out |
| University-verified | Admin-created `StudentIdentity` student binding (explicit subject → explicit Student) | View own official passport, versions, download finalized PDFs |
| Administrator | Admin-created `StudentIdentity` admin binding | Admin routes: sync, identities, workspaces, audit, retries |

Self-registration never writes to `StudentIdentity`, `Student`, `Passport`, `Award`, `Version` or chain tables, so `verifiedBy`/`verifiedAt` always mean an administrator action. Email, email domain (`hd`), and `user_metadata`/`app_metadata` claims are never used for authorization.

## Data model

Migration `0003_student_workspace` is additive (one new table, RLS enabled, browser roles revoked):

- `workspaceId` — `WS-` + 16 base32 chars. A **workspace identifier, not a BTU passport ID**; it is not a valid verification code and cannot be looked up publicly.
- `(provider, subject)` unique — database-enforced idempotency; concurrent first logins converge on one row (`P2002` is caught and the existing row is returned).
- `email` — informational snapshot, not unique, not used for matching.
- `linkedStudentId/linkedBy/linkedAt` — set only by administrator reconciliation.

An unissued workspace has no `initialIssueDate`, `opaqueChainRef`, transaction, verification code, PDF or signature, and is never shown as blockchain-verified.

## Empty passport

`GET /me/passport` returns `official: false`, `status: "EMPTY_WORKSPACE"`, `passportId: null`, counts of zero, and the verification state. `GET /me/passport/versions` returns `[]`. Downloads return 404 unless a finalized version with a stored PDF exists. A university-verified student with no passport yet gets the same empty shape with `universityVerified: true`. Existing official passports keep their shape plus `official: true`.

## Trusted linking and reconciliation

Only an administrator can link, and only by explicit reference (never by email equality):

```
GET  /api/v1/admin/workspaces
POST /api/v1/admin/workspaces/:workspaceId/link   {"studentExternalId": "BTU-…"}  (or "studentId")
```

The link is one transaction: it verifies workspace and student, creates the `StudentIdentity` student binding (`verifiedBy` = acting admin), stamps the workspace, and writes a `WORKSPACE_LINKED` audit event. It is idempotent for the same pair. Conflicts return **409** and change nothing:

- `WORKSPACE_ALREADY_LINKED` — workspace linked to a different student.
- `IDENTITY_CONFLICT` — the account already has a binding, or the student is already bound to another account.

Existing passports, awards, finalized versions and chain proofs are never modified. The existing `POST /admin/identities` also stamps a matching unlinked workspace. Unresolved conflicts never block the student's empty workspace.

## Existing users

Admins and verified students have `StudentIdentity` rows and are resolved before any workspace logic runs; no workspace is created for them and nothing about their records changes.

## Rollback

1. Redeploy the previous commit (the web/API are backwards compatible with an unused table).
2. Optionally `DROP TABLE "StudentWorkspace";` — it holds no academic data. `StudentIdentity` rows created by administrator linking are real bindings; remove them only deliberately.

## Verification status

**Verified locally (automated, mocked Prisma and a local JWKS/Supabase stand-in):** workspace auto-provisioning, idempotency and concurrent convergence, no email-based claim, preserved admin/verified bindings, empty `/me/passport`, `/me/passport/versions`, 404 download, 403 on all admin routes, 401 on expired/tampered/missing tokens, callback redirect to `/passport`, logout cookie clearing and CSRF origin checks, workspace IDs rejected as verification codes, reconciliation conflicts, typecheck, production web build.

**Not verified (needs external infrastructure):** a real Google/Supabase sign-in, applying migration `0003` to the live database, rendering in a real browser against production, and live Solana verification.
