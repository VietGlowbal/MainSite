# Cron and Report Timeout Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the confirmed 60-second Vercel runtime timeout and make ambiguous Supabase Gateway Timeout responses recoverable without reducing report throughput.

**Architecture:** Keep the existing durable queues, atomic claims, retry backoff, and current batch sizes. Apply the existing database resilience migration first, then raise both AI cron route ceilings from 60 to 300 seconds while retaining their shorter per-network-call timeouts. Verify success from queue state and Vercel runtime logs rather than assuming a successful deployment fixed production.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase/PostgreSQL, Vercel Cron/Functions, OpenAI SDK.

---

## Confirmed production evidence

- The 24-hour Vercel sample contained 41 timeout-related logs, all on an older production deployment between 2026-09-14 17:37 and 20:40 ICT.
- One request to `/api/cron/process-parse-jobs` was terminated by Vercel at exactly 60 seconds with HTTP 504.
- Thirty-six parse-queue logs were ambiguous `Gateway Timeout` responses while reading or claiming queue work; one Personal Report cron returned the same upstream signature with HTTP 500.
- `extract-course.ts` can spend up to 12 seconds fetching the page and then up to 60 seconds waiting for OpenAI, before database writes. A route ceiling of 60 seconds therefore cannot contain its own timeout and cleanup path.
- Both cron routes currently export `maxDuration = 60`.
- The retry/recovery code is already deployed, but `sql/supabase-job-claim-resilience.sql` is recorded as not yet applied to production. Until it is applied, parse jobs cannot be recovered by `locked_by`, and abandoned parse leases are not reclaimed after ten minutes.

## Non-goals

- Do not reduce `DEFAULT_BATCH` from 5 for course parsing or from 2 for Personal Reports in this fix; that would reduce throughput without making an individual slow job faster.
- Do not replace the durable queues or add a new worker platform unless production still regularly exceeds 300 seconds after this fix.
- Do not increase the individual external-call timeouts. The existing 12-second page-fetch, 60-second course-AI, and 45-second shared OpenAI timeouts remain the failure boundaries that allow the queue to retry safely.

### Task 1: Apply and verify the existing queue resilience migration

**Files:**
- Use unchanged: `sql/supabase-job-claim-resilience.sql`
- Reference: `sql/introspect.sql`
- Reference: `docs/known-issues.md`

**Step 1: Capture a read-only production baseline**

In Supabase SQL Editor, run:

```sql
select status, count(*)
from public.course_parse_jobs
group by status
order by status;

select status, count(*)
from public.application_personal_report_generation_jobs
group by status
order by status;

select count(*) as stale_parse_jobs
from public.course_parse_jobs
where status = 'processing'
  and started_at < now() - interval '10 minutes';

select count(*) as stale_personal_report_jobs
from public.application_personal_report_generation_jobs
where status = 'processing'
  and locked_at < now() - interval '10 minutes';
```

Record the four results. Do not manually update queue rows.

**Step 2: Verify the live function signatures before mutation**

```sql
select
  p.oid::regprocedure::text as signature,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_course_parse_jobs',
    'claim_application_personal_report_generation_jobs'
  )
order by signature;
```

Expected: both two-argument functions are present. Keep the output as rollback evidence. Do not edit an older migration to match production.

**Step 3: Apply the existing migration as one SQL Editor run**

Run the complete contents of `sql/supabase-job-claim-resilience.sql`. Its explicit
`DROP FUNCTION IF EXISTS public.claim_course_parse_jobs(TEXT, INT)` is required because PostgreSQL cannot change the historical return type with `CREATE OR REPLACE FUNCTION`; do not remove that line or add `CASCADE`.

Expected: the script completes without `42P13`, creates the three partial indexes, restricts RPC execution to `service_role`, makes claims idempotent per worker ID, and reclaims processing leases older than ten minutes.

**Step 4: Verify schema and grants after migration**

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_course_parse_jobs_claimable',
    'idx_course_parse_jobs_stale_lease',
    'idx_application_personal_report_generation_jobs_stale_lease'
  )
order by indexname;

select
  p.oid::regprocedure::text as signature,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_course_parse_jobs',
    'claim_application_personal_report_generation_jobs'
  )
order by signature;
```

Expected: all three indexes exist; the two RPCs grant execution to `service_role` and not to `anon` or `authenticated`.

### Task 2: Lock the Vercel duration contract with failing tests

**Files:**
- Create: `src/app/api/cron/process-parse-jobs/route.test.ts`
- Modify: `src/app/api/cron/process-personal-report-generation/route.test.ts`

**Step 1: Add a failing parse-route duration test**

Mock `@/lib/cron-auth`, `@/lib/course-parser/job-queue`, and `@/lib/course-parser/job-processor` before importing the route, then assert:

```ts
it('leaves enough function time for the bounded fetch and AI calls to settle', async () => {
  const { maxDuration } = await import('./route');
  expect(maxDuration).toBe(300);
});
```

Also retain one small route-behavior assertion that an authenticated empty queue returns `{ claimed: 0, processed: 0, results: [] }`; this catches import/mocking mistakes and proves the test exercises the real route module.

**Step 2: Add the same deployment-contract assertion to the Personal Report cron test**

```ts
it('allows a queued report to finish its bounded AI stages', async () => {
  const { maxDuration } = await import('./route');
  expect(maxDuration).toBe(300);
});
```

**Step 3: Run the focused tests and confirm the intended failure**

```powershell
npm.cmd exec vitest run -- "src/app/api/cron/process-parse-jobs/route.test.ts" "src/app/api/cron/process-personal-report-generation/route.test.ts"
```

Expected: the new duration assertions fail with `expected 60 to be 300`; existing auth and batch assertions continue to pass.

**Step 4: Commit the red tests**

```powershell
git add -- "src/app/api/cron/process-parse-jobs/route.test.ts" "src/app/api/cron/process-personal-report-generation/route.test.ts"
git commit -m "test: lock AI cron duration budget"
```

### Task 3: Raise only the two durable-worker route ceilings

**Files:**
- Modify: `src/app/api/cron/process-parse-jobs/route.ts:25`
- Modify: `src/app/api/cron/process-personal-report-generation/route.ts:11`

**Step 1: Run GitNexus API impact checks**

Refresh the repository index if stale, then inspect both handlers:

```powershell
npx gitnexus analyze
```

Run API-impact checks for `/api/cron/process-parse-jobs` and `/api/cron/process-personal-report-generation`. Stop and report before editing only if either result is HIGH or CRITICAL for reasons beyond the two cron callers already known.

**Step 2: Make the minimal implementation**

In both route modules, change only:

```ts
export const maxDuration = 300;
```

Do not change batch sizes, cron frequency, retry counts, or individual network timeouts in this task.

**Step 3: Run focused tests**

```powershell
npm.cmd exec vitest run -- "src/app/api/cron/process-parse-jobs/route.test.ts" "src/app/api/cron/process-personal-report-generation/route.test.ts" "src/lib/course-parser/extract-course.test.ts" "src/lib/course-parser/job-queue.test.ts" "src/lib/supabase/recover-gateway-timeout.test.ts" "src/features/apply/api/personal-report-generation-job-queue.test.ts"
```

Expected: all focused tests pass.

**Step 4: Run static and production-build gates**

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:strict
npm.cmd run lint
npm.cmd run build:ci
git diff --check
```

Expected: both typechecks, lint, build, and whitespace check pass. Existing documented `geo-content.ts` filesystem-tracing warnings are non-fatal; any new error is a blocker.

**Step 5: Inspect affected scope before commit**

Run GitNexus change detection for all unstaged changes. Confirm the diff is limited to the two cron routes and their focused tests; do not stage unrelated dirty-worktree files.

**Step 6: Commit the implementation**

```powershell
git add -- "src/app/api/cron/process-parse-jobs/route.ts" "src/app/api/cron/process-personal-report-generation/route.ts"
git commit -m "fix: extend AI cron execution budget"
```

### Task 4: Deploy and prove the fix in production

**Files:**
- Modify after measurement: `docs/current-status.md`

**Step 1: Push the two commits and wait for a Ready production deployment**

```powershell
git push origin main
vercel ls glowbal --scope glowbal-education
```

Expected: the deployment for the pushed commit reaches `Ready` in `Production`. Do not treat a Preview deployment as completion.

**Step 2: Confirm the built route duration**

Inspect the production deployment/build output and confirm both route functions carry the 300-second duration. If Vercel clamps either route back to 60 seconds, stop: the project/runtime setting must be corrected before traffic verification.

**Step 3: Observe at least fifteen cron invocations**

Use Vercel runtime logs for the active production deployment:

```powershell
vercel logs https://glowbal-education.com --project glowbal --scope glowbal-education --since 30m --query timeout --limit 1000 --json
vercel logs https://glowbal-education.com --project glowbal --scope glowbal-education --since 30m --status-code 5xx --limit 1000 --json
```

Expected:

- no `Vercel Runtime Timeout Error: Task timed out after 60 seconds`;
- no repeated claim-related `Gateway Timeout` storm;
- cron requests return a normal queue summary rather than 504;
- an occasional ambiguous Supabase claim response, if it occurs, is recovered without processing the same job twice.

**Step 4: Verify queues are draining without abandoned leases**

Run the Task 1 baseline queries again after the observation window.

Expected: zero parse and Personal Report jobs remain `processing` beyond ten minutes. Pending/retry rows are acceptable when their `next_attempt_at` is in the future; they are evidence of controlled retry, not a stuck worker.

**Step 5: Record measured production results**

Update `docs/current-status.md` with the deployment URL/commit, observation window, actual Vercel log counts, and the two stale-lease counts. Do not write “fixed” if the post-deploy checks were not run.

**Step 6: Commit the measured status**

```powershell
git add -- docs/current-status.md
git commit -m "docs: record AI cron timeout verification"
git push origin main
```

## Rollback and escalation

- Code rollback: restore both route exports to 60 seconds only if the 300-second setting causes measured provider/DB saturation; do not roll back the queue migration, because idempotent claims and stale-lease recovery remain valid independently.
- If functions regularly approach 300 seconds, move course parsing and report generation to a long-running background worker. That is the trigger for architecture work; a larger Vercel number is not the next fix.
- If Gateway Timeout errors continue across unrelated DB reads after the migration, investigate Supabase/PostgREST health and query latency separately. That signature is upstream and cannot be repaired by raising Vercel `maxDuration`.
