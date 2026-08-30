# AI flow audit: Personal Report and Matching Report

**Date:** 2026-08-27  
**Scope:** application-scoped Personal Report, its durable queue, Matching
Report V2, and the Analysis Workspace consumer.  
**Method:** source/lineage review, unit-test review, production schema reads
using the service role (read-only), and existing local verification evidence.

## Verdict

**Not ready for production end-to-end.** The code has good validation and
lineage protections, but the Personal-lineage portion of the Matching migration
is absent and there are four remaining execution-flow defects that cause false failure,
stale completion, or incomplete Matching output.

## P0 — production-blocking

### P0-01 — Personal Report queue migration (resolved after the audit)

**Live evidence (2026-08-27, read-only):**

```text
application_personal_report_generation_jobs.idempotency_key does not exist
PostgREST code: 42703
```

**Code path:**

- `src/app/api/applications/[id]/personal-report/route.ts` calls
  `enqueueApplicationPersonalReportGeneration`.
- `src/features/apply/api/personal-report-generation-job-queue.ts` always
  writes `idempotency_key`, including when the request did not supply one.
- The live table lacks that column. The migration exists locally in
  `supabase-application-personal-report-generation-jobs-repair.sql`.

**Resolution verified after the owner applied the migration:** a subsequent
read-only schema check returned `200` for `idempotency_key`. The latest queue
job was processed by the worker and reached `blocked` with
`INSUFFICIENT_EVIDENCE`; this confirms enqueue/claim/worker execution works.
It is not a successful report generation because that application's confirmed
data does not satisfy the evidence minimum.

**Follow-up hardening:** include `42703` and `PGRST204/PGRST205` in the queue
migration classifier so a future partial deployment fails closed with `503`.

### P0-02 — Matching Report V2 Personal-lineage migration (resolved after the audit)

**Live evidence (2026-08-27, read-only):**

```text
all nine core-V2 and Personal-lineage columns resolve successfully
PostgREST status: 200
```

The core V2 columns and all three Personal-lineage columns
(`source_personal_report_version_id`, `source_personal_report_input_hash`, and
`f5_engine_version`) resolve successfully after the migration was applied.

**Code path:**

- `src/features/apply/api/ai-reports-repository.ts` selects all three missing
  Personal-lineage fields in `MATCHING_ANALYSIS_SELECT`.
- `src/lib/ai/matching/generation.ts` performs this read before it starts the
  Personal/Matching generation chain.

**Impact before repair:** canonical Matching V2 exited as `migration_missing`
and the route returned `503`. This schema blocker is now removed.

**Resolution:** `supabase-matching-report-personal-lineage.sql` was applied
after `supabase-personal-report-versions.sql`; live read-only verification now
returns `200` for every required selected column.

## P1 — flow correctness/reliability

### P1-01 — Analysis Workspace treats an asynchronous Personal Report job as a failed report

**Evidence:**

- `src/app/api/applications/[id]/personal-report/route.ts` correctly returns
  `202` with `{ queued: true, generation }`.
- `src/features/ai-strategy-dashboard/ui/analysis-workspace.tsx` instead
  requires `canonicalBody.reportV2` immediately after that POST.

**Impact:** a valid queue response is displayed as a Personal Report failure,
and Matching generation is never started from this workspace. Current tests
mock an old synchronous `{ reportV2 }` response and do not cover `202`.

**Root fix:** accept `202` as a pending state and poll the canonical GET until
the job is complete and its `report_version_id` matches the displayed version;
only then start Matching.

### P1-02 — first and changed Matching reports reuse a stale/empty F5 result instead of computing current programme fit

**Evidence:**

- `programmeFitInputFromRecord` in `src/lib/ai/matching/generation.ts` builds
  the entire five-dimension F5 input from `latestRecord`.
- When there is no prior Matching record it uses
  `buildProgrammeFitPlaceholder()`; only eligibility is recomputed from the
  current target profile and applicant state.
- `generation.test.ts` explicitly asserts the first generation sends a
  `not_available` academic dimension.

**Impact:** a first Matching Report is always `insufficient_data` for F5 even
when current academic/evidence inputs exist. Later reports can carry old
persona/readiness/financial/career dimensions across a new Personal Report,
snapshot, or target profile. The saved academic assessment does not repair the
F5 result because it is persisted after composition.

**Root fix:** build every F5 dimension from the current applicant state,
current Evidence Bank, and current target profile before composition. Reuse
only if an explicit F5 input hash matches the same lineage.

### P1-03 — Matching criterion reasoning drops the student's intended direction

**Evidence:** `src/lib/ai/matching/generation.ts` passes
`personalContext.direction: []`, although the linked source analysis stores
`evaluationInput.intendedDirection` and the reasoner includes `direction` in
every LLM prompt/hash.

**Impact:** career-direction and programme-value reasoning lacks the most
direct confirmed goal signal; the cache also represents this incomplete context
as if it were complete.

**Root fix:** validate and read the stored `evaluationInput` from the linked
analysis version, then pass its `intendedDirection` (or a deliberate empty
state) into `personalContext.direction`. Add a generation test with a career
criterion that asserts the value reaches the reasoner.

### P1-04 — AI time budgets exceed both deployed route budgets

**Evidence:**

- Personal extraction launches three 45-second raw OpenAI calls in parallel,
  then runs a separate 45-second narrative call sequentially.
- The Personal queue worker has `maxDuration = 60` in
  `src/app/api/cron/process-personal-report-generation/route.ts`.
- Matching calls Personal synchronously, then performs criterion batches
  sequentially through a 55-second structured-generation budget plus a
  55-second summary call, while `/match-insights` has `maxDuration = 120`.

**Impact:** slow-but-valid provider calls can be terminated by the platform
before the worker records retry/complete. Matching can exceed 120 seconds on a
cold Personal Report or more than one criterion batch, surfacing a user-facing
`502` despite an otherwise recoverable provider delay.

**Root fix:** keep Matching off the request path (durable job/polling) or set a
single end-to-end budget that reserves persistence time and bounds all nested
calls. The Personal worker should process one job per 60-second invocation, or
use a runtime with a proven longer limit.

### P1-05 — stale legacy analysis is accepted as a completed Matching report

**Evidence:**

- `src/app/api/applications/[id]/strategy/course-match/route.ts` reads any
  `analysis_status = 'complete'` row and derives the old five-pillar view.
- `AnalysisWorkspace` treats any returned `analysis` as complete and skips the
  canonical `/match-insights` generation.
- The earlier live schema issue is resolved: `report_v2` and all three
  Personal-lineage columns are present.

**Impact:** users can be shown “reports ready” from a legacy row while the V2
Matching report is unavailable, stale, or for a different report lineage.

**Root fix:** make the consumer require a schema-valid V2 record whose
confirmed snapshot, Personal Report version, Target Profile version, and
engine/prompt versions are current; otherwise return pending/stale and trigger
the canonical generator after migrations are present.

## P2 — resilience/observability

### P2-01 — Personal Report bypasses the shared structured-generation safety contract

**Evidence:** CMCAITF, competency, role/theme extraction, and narrative
synthesis call `openAiJsonCompletion` directly. Matching and Target Profile
use `generateStructured`, which provides one repair attempt, common timeout
budgeting, safe failure classification, and structured usage metadata.

**Impact:** transient malformed JSON from Personal extraction goes straight to
a job retry with generic error handling; it gets neither the repair attempt nor
the same safe telemetry used by the other AI flows.

**Root fix:** migrate the four Personal AI calls to `generateStructured` (or
extend the shared primitive with an explicit raw-key adapter) and retain their
existing grounding checks after schema validation.

## Checks performed

- Live read-only schema queries confirmed that Personal report versions,
  profile-analysis versions, queue table, academic assessment table, and
  matching table exist. The queue `idempotency_key` and all required Matching
  V2/Personal-lineage columns now exist.
- Previous local verification remains green: Vitest 362 files / 3440 passed
  (2 todo), typecheck, strict typecheck, i18n, lint with no errors, and
  production build.
- Full local tests do not exercise live migration state, asynchronous `202`
  handling in Analysis Workspace, a first-generation F5 calculation, or
  end-to-end provider timeout budgets.
