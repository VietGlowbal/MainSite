# Critical security patch — 2026-09-08

Scope is limited to the two critical findings from the pasted audit: the
course shortlist RPC and authenticated access to mentor PII/private documents.
Production has not been changed.

## Baseline and root causes

- Latest `origin/main`: `e86e15f7f12f561fe4908ec2dd6a850993babbb4`.
- A1 root cause: `add_selected_courses_to_apply` trusted `p_user_id` and a
  caller-supplied JSONB payload inside a `SECURITY DEFINER` function. It did
  not bind the session/results to the authenticated user or validate every row.
- A2 root cause: `achiever_profiles` had an authenticated `SELECT` policy over
  the whole row, so `select('*')` exposed legal identity, DOB, document keys,
  and Stripe account identifiers. The two document buckets had owner-scoped
  read/write policies but no explicit update policy and require private-bucket
  verification.

## Changed files

- `sql/supabase-add-selected-courses-rpc.sql`: secure canonical RPC contract.
- `sql/supabase-critical-security-hardening-2026-09-08.sql`: transactional
  deployment migration, grants, public mentor view, RLS, and storage policies.
- `src/app/api/apply-shortlist/add-courses/route.ts`: sends only session/result
  IDs and no longer returns raw RPC error text.
- `src/lib/mentors.ts`, `src/lib/achievers.ts`: explicit public projections;
  private mentor reads are owner-only through the service-role server helper.
- `src/app/dashboard/advisor/page.tsx`: uses the owner-only profile helper.
- `src/app/api/mentorship/signup/route.ts`: rejects document keys outside the
  authenticated user's first-level storage folder.
- `scripts/test-critical-security.mjs`: opt-in disposable cross-user/database
  and storage integration test; it refuses the `.env.local` project URL.
- `src/__tests__/critical-security-hardening.test.ts` and the shortlist route
  tests: contract/regression coverage.

## Secure RPC contract

`add_selected_courses_to_apply(p_session_id uuid, p_result_ids uuid[])` derives
`auth.uid()`, requires an owned complete session, requires every result to be in
that session, rejects duplicate IDs/incomplete rows/inconsistent existing
links, and reads university/course metadata from stored rows. It locks the
session/results, validates the full batch before writes, then atomically creates
the application/source/parse-job and marks the result. Existing owned URLs and
retries are idempotent. Execute is granted to `authenticated` only; `anon` and
`PUBLIC` are revoked.

## Mentor projection and admin design

`public.public_mentor_profiles` is a `security_invoker` view containing only
public profile, pricing, rating, and verification-marker fields. Direct table
`SELECT` for `anon`/`authenticated` is reduced to those public columns;
`service_role` retains full-row access. Public helpers use explicit safe
projections. The advisor dashboard uses `getOwnMentorProfile()`, which derives
the signed-in user and reads private fields with the server-side admin client.
Existing admin APIs continue to authorize an admin first and use the service
role; no private columns are added to their public response projection.

Both `mentor-documents` and `student-documents` are set private. Insert/select/
update/delete policies require the first path segment to equal `auth.uid()`;
there is no authenticated-user admin bypass. Admin document access remains a
server-side service-role operation.

## Migration order and rollback

1. On the intended Supabase project, confirm both buckets already exist and
   back up policy/grant definitions.
2. Apply the new migration transaction and run its read-only verification
   queries. Do not apply it through the wrong Supabase project connection.
3. Deploy the matching application commit, then run the disposable integration
   test against a separate Supabase project.

If the app must roll back, keep the database hardening and deploy only a
compatible secure caller. Do not restore the old `p_user_id`/JSONB function.
Bucket creation remains an operator prerequisite; the migration fails closed
if either private bucket is missing.

## Validation status

The migration is present for review and has not been applied to production.
The six-file focused Vitest route/RPC/admin suite passed 46 tests; base and
strict TypeScript passed; lint passed with four existing warnings; the
production build completed once with the existing three `geo-content.ts`
tracing warnings, but two final Turbopack reruns reached compilation/TypeScript
and then hit the host's Next page-data worker OOM (`3221226505`); the Webpack
fallback hit an existing `node:crypto` plugin error outside this patch. The
`node --check scripts/test-critical-security.mjs` check passed. Full Vitest
passed 3,701 tests with two TODOs and retained two out-of-scope unauthenticated
CV-test timeouts. The disposable integration command requires explicit
non-production `GLOWBAL_SECURITY_TEST_*` environment variables and was not run
against `.env.local`.

## Remaining critical risks

- Live policy/grant state still requires owner-run SQL verification after
  deployment; REST/OpenAPI inspection cannot prove PostgreSQL column grants.
- Cross-user storage behavior remains unmeasured until the disposable Supabase
  integration environment is supplied.
- The migration must be applied together with the route contract change; a
  mixed deployment intentionally fails closed rather than accepting the old
  payload.
