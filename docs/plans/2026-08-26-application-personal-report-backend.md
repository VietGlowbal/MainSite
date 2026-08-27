# Application-level Personal Report Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the backend from AI infrastructure through Personal Report so every application generates and versions its report from that application's immutable confirmed snapshot, while reusing the current evaluation and report pipeline.

**Architecture:** Shared student profile, experiences, achievements, and reflection answers remain reusable draft data. Confirming an application appends an application-scoped candidate snapshot; all analysis, evidence, and Personal Report versions are then derived from that snapshot rather than live profile tables. Programme Target Profiles remain reusable programme-level artifacts, while application analyses and report history are append-only and application-scoped.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Zod, Supabase/PostgreSQL with RLS, OpenAI structured output, Vitest, existing GlowBal Evaluation Engine F1-F4.

---

## Fixed product decisions

- Personal Report ownership changes from user-level to application-level.
- Experiences, achievements, academic records, and reflection answers remain shared draft data.
- Each application report reads only its latest confirmed snapshot, never live candidate tables.
- Users can reopen Candidate Information, edit, confirm a new snapshot, and regenerate.
- Every application exposes its own report version history.
- Legacy user-level Personal Report versions remain read-only archive rows and are not assigned to applications.
- Generation remains synchronous with a 60-second route budget.
- Programme crawling never happens inside a report request; Target Profile uses already-ingested catalogue data.
- Matching and Strategy algorithms are outside scope. Only their Personal Report source resolution and lineage compatibility may change.
- Deployment enables the new flow immediately; flags exist only as emergency kill switches.

## Current implementation to preserve

- `src/features/apply/api/personal-report-generation.ts` already owns caching, deterministic evaluation, narrative synthesis, fallback, logging, and append-only generation.
- `src/shared/evaluation/` already implements the deterministic F1-F4 Evaluation Engine and evidence-linked insights.
- `src/lib/ai/personal-report-v2.ts` already performs CMCAITF, competency, and narrative activity extraction followed by source grounding.
- `src/features/apply/api/candidate-context.ts` already loads the current shared candidate data.
- `confirmed_candidate_snapshots` is already append-only and already has nullable `application_id`.
- `student_personal_report_versions` is already append-only and is already referenced by Matching/Strategy lineage.
- `course_applications.candidate_confirmed_at` already provides the per-application edit lock.
- Catalogue ingestion already stores programme and provenance data in `catalog_programmes`, `course_admission_requirements`, `application_requirements`, and `crawl_sources`.
- The seven `personal_reflection_answers` are loaded into Candidate Context but are not currently consumed by `buildProfileEvaluationInput`; this is a required regression fix.

---

### Task 1: Add application-scoped persistence and lineage

**Files:**

- Create: `supabase-application-personal-report-state.sql`
- Modify: `src/features/apply/api/personal-report-v2-repository.ts`
- Test: `src/features/apply/api/personal-report-v2-repository.test.ts`

**Step 1: Write failing repository tests**

Add tests proving:

- latest/version-list/version-detail queries filter by both `user_id` and `application_id`;
- legacy rows with `application_id = NULL` are excluded from application history;
- inserts include snapshot and analysis lineage;
- a version from application B cannot be returned through application A;
- repeated requests with the same cache key resolve to the same row.

**Step 2: Run the focused tests and verify failure**

Run:

```bash
npm test -- src/features/apply/api/personal-report-v2-repository.test.ts
```

Expected: FAIL because repository methods do not accept or filter by `applicationId`.

**Step 3: Add an idempotent migration**

Extend `student_personal_report_versions` instead of creating a replacement table, preserving existing foreign keys:

```sql
ALTER TABLE public.student_personal_report_versions
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES public.course_applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS confirmed_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_analysis_version_id UUID,
  ADD COLUMN IF NOT EXISTS report_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

CREATE INDEX IF NOT EXISTS idx_personal_report_versions_application_created
  ON public.student_personal_report_versions(application_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_report_application_cache_key
  ON public.student_personal_report_versions(application_id, cache_key)
  WHERE application_id IS NOT NULL AND cache_key IS NOT NULL;
```

Create these append-only tables with owner RLS:

- `programme_target_profile_versions`;
- `application_profile_analysis_versions`;
- `application_academic_assessment_versions`;
- `student_activity_follow_up_answers`;
- `application_personal_report_supplements`.

Add to `confirmed_candidate_snapshots`:

```sql
ALTER TABLE public.confirmed_candidate_snapshots
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS supersedes_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_snapshots_application_confirmed
  ON public.confirmed_candidate_snapshots(application_id, confirmed_at DESC);
```

Do not update or assign any existing `student_personal_report_versions` rows. Existing rows remain legacy archive records with `application_id IS NULL`.

**Step 4: Update repository contracts**

Make `applicationId` mandatory for new report reads and writes:

```ts
type ApplicationReportScope = {
  userId: string;
  applicationId: string;
};
```

Add fields to `PersonalReportV2Record`:

```ts
applicationId: string;
confirmedSnapshotId: string;
sourceAnalysisVersionId: string;
reportContractVersion: string;
cacheKey: string;
```

Keep separate legacy archive readers if the existing global archive page still needs them. Never make an application reader fall back to a legacy global row.

**Step 5: Run tests**

Run:

```bash
npm test -- src/features/apply/api/personal-report-v2-repository.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add supabase-application-personal-report-state.sql src/features/apply/api/personal-report-v2-repository.ts src/features/apply/api/personal-report-v2-repository.test.ts
git commit -m "feat: add application personal report persistence"
```

---

### Task 2: Build the shared structured AI runtime

**Files:**

- Modify: `src/lib/ai/openai-client.ts`
- Create: `src/lib/ai/runtime/structured-generation.ts`
- Create: `src/lib/ai/runtime/ai-module.ts`
- Create: `src/lib/ai/runtime/prompt-registry.ts`
- Test: `src/lib/ai/runtime/structured-generation.test.ts`

**Step 1: Write failing structured-generation tests**

Cover:

- valid JSON is parsed with the supplied Zod schema;
- invalid output receives exactly one repair attempt;
- a second invalid output fails without persistence;
- timeout aborts the provider call;
- token usage, latency, retry count, model, prompt version, and schema version are returned;
- raw prompts and candidate evidence are not written to logs.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/lib/ai/runtime/structured-generation.test.ts
```

Expected: FAIL because the runtime does not exist.

**Step 3: Define the common module contract**

```ts
export interface AIModule<I, O> {
  id: string;
  schemaVersion: string;
  promptVersion: string;
  validateInput(input: I): ValidationResult;
  buildContext(input: I, state: ApplicantAIState): Promise<AIContext>;
  generate(input: I, context: AIContext): Promise<O>;
  validateOutput(output: O, context: AIContext): Promise<ValidationResult>;
}
```

Persistence stays in the orchestrator so a composite analysis is inserted only after every required module validates.

**Step 4: Implement `generateStructured<T>`**

Requirements:

- use the existing singleton OpenAI client;
- accept a Zod schema and JSON Schema response format where supported;
- allow one primary attempt and one repair attempt;
- use an internal 55-second abort budget;
- return structured metadata instead of only a string;
- classify provider, timeout, JSON, and schema-validation failures separately.

Do not introduce a second AI provider in this milestone. Keep the interface provider-neutral.

**Step 5: Move report-related prompts into the registry**

Move touched prompts for CMCAITF, competency, narrative activity, Reflection analysis, and report narrative synthesis out of business logic. Unrelated AI features are not refactored in this scope.

**Step 6: Run tests**

```bash
npm test -- src/lib/ai/runtime/structured-generation.test.ts src/server/observability/index.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/lib/ai/openai-client.ts src/lib/ai/runtime
git commit -m "feat: add structured ai module runtime"
```

---

### Task 3: Support application snapshot revisions

**Files:**

- Modify: `src/app/api/candidate-information/confirm/route.ts`
- Create: `src/app/api/applications/[id]/candidate-information/reopen/route.ts`
- Modify: `src/features/apply/api/candidate-snapshot-repository.ts`
- Test: `src/app/api/candidate-information/confirm/route.test.ts`
- Test: `src/app/api/applications/[id]/candidate-information/reopen/route.test.ts`

**Step 1: Write failing tests**

Cover:

- reopening clears only the current application's `candidate_confirmed_at`;
- reopening never deletes old snapshots or reports;
- application B cannot reopen application A;
- confirming a reopened application inserts a new snapshot instead of returning the previous snapshot;
- the new snapshot records `supersedes_snapshot_id` and `payload_hash`;
- confirming one application does not modify another application's snapshot lineage.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/app/api/candidate-information/confirm/route.test.ts src/app/api/applications/\[id\]/candidate-information/reopen/route.test.ts
```

Expected: FAIL because the confirm route currently returns early when the application is already confirmed and no reopen route exists.

**Step 3: Implement reopen**

The route must:

- authenticate the current user;
- verify application ownership server-side;
- set only `course_applications.candidate_confirmed_at` to `NULL`;
- retain review timestamps so the user can edit only the necessary section;
- leave previous confirmed snapshots and generated reports untouched.

**Step 4: Version the snapshot payload**

Snapshot schema version 2 must contain normalized copies of:

- student academic profile and test scores;
- achievements and activities;
- activity reflections and confirmed Reflection Cards;
- seven Personal Reflection answers;
- latest non-superseded Adaptive Follow-up answers;
- uploaded document references.

Hash the canonical serialized payload. Sorting rules must make array ordering deterministic where order has no product meaning.

**Step 5: Change confirm idempotency**

- A still-confirmed application returns its latest snapshot.
- A reopened application may append a new snapshot.
- The new row points to the previous snapshot for that application.
- Set `candidate_confirmed_at` only after snapshot insertion succeeds.

**Step 6: Run tests**

```bash
npm test -- src/app/api/candidate-information/confirm/route.test.ts src/app/api/applications/\[id\]/candidate-information/reopen/route.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/app/api/candidate-information/confirm src/app/api/applications/[id]/candidate-information/reopen src/features/apply/api/candidate-snapshot-repository.ts
git commit -m "feat: support application candidate snapshot revisions"
```

---

### Task 4: Add Target Profile generation from ingested catalogue data

**Files:**

- Create: `src/lib/ai/target-profile/domain.ts`
- Create: `src/lib/ai/target-profile/repository.ts`
- Create: `src/lib/ai/target-profile/generation.ts`
- Create: `src/app/api/ai/target-profiles/route.ts`
- Test: `src/lib/ai/target-profile/generation.test.ts`
- Test: `src/app/api/ai/target-profiles/route.test.ts`

**Step 1: Write failing domain and route tests**

Cover:

- stable source fingerprint independent of row ordering;
- cache hit for unchanged programme sources;
- new version when an ingested content hash changes;
- `not_ready` when required catalogue/source lineage is absent;
- `stale` when cached fingerprint differs from current ingested data;
- no request accepts or crawls an arbitrary client URL;
- every extracted requirement carries source references or explicit missing information.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/lib/ai/target-profile/generation.test.ts src/app/api/ai/target-profiles/route.test.ts
```

Expected: FAIL because the canonical module and route do not exist.

**Step 3: Define Target Profile schemas**

Represent university values, programme description/themes, academic requirements, competencies, selection criteria, scholarship criteria, application requirements, deadlines, missing information, and sources.

**Step 4: Implement catalogue context building**

Read only from existing ingested tables. Map already-structured requirements deterministically. Use structured AI extraction only for remaining unstructured source text.

`stale` means source fingerprint mismatch, not merely old retrieval time. The request must never initiate crawling.

**Step 5: Implement cache and API**

`POST /api/ai/target-profiles` accepts `programmeId` and optional `scholarshipKey`. Return `ready`, `cached`, `not_ready`, or `stale` with the canonical version ID.

**Step 6: Run tests**

```bash
npm test -- src/lib/ai/target-profile/generation.test.ts src/app/api/ai/target-profiles/route.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/lib/ai/target-profile src/app/api/ai/target-profiles
git commit -m "feat: add reusable target profile generation"
```

---

### Task 5: Build application-scoped ApplicantAIState and Academic analysis

**Files:**

- Create: `src/lib/ai/applicant-state/domain.ts`
- Create: `src/lib/ai/applicant-state/context-builder.ts`
- Create: `src/lib/ai/academic-analysis.ts`
- Create: `src/features/apply/api/application-analysis-repository.ts`
- Test: `src/lib/ai/applicant-state/context-builder.test.ts`
- Test: `src/lib/ai/academic-analysis.test.ts`

**Step 1: Write failing tests**

Cover:

- Context Builder rejects a snapshot belonging to another application/user;
- state is reconstructed from the selected snapshot rather than live profile tables;
- editing live data after snapshot A does not change state A;
- academic requirements resolve to the four allowed states;
- missing or incomparable grading systems produce `insufficient_information` rather than failure/zero;
- no output contains an admission probability.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/lib/ai/applicant-state/context-builder.test.ts src/lib/ai/academic-analysis.test.ts
```

Expected: FAIL because the state builder and Academic Analyzer do not exist.

**Step 3: Define the state contract**

```ts
interface ApplicantAIState {
  applicantId: string;
  applicationId: string;
  snapshotId: string;
  analysisVersionId?: string;
  targetProfile?: TargetProfile;
  academicProfile?: AcademicProfile;
  activities: ActivityAnalysis[];
  evidenceBank: EvidenceItem[];
  identitySignals?: IdentitySignals;
  directionSignals?: DirectionSignals;
  personalReport?: PersonalReport;
  metadata: StateMetadata;
}
```

**Step 4: Implement snapshot-only context loading**

Do not call the current live `loadCandidateContext` after an application snapshot has been selected. Add a converter from snapshot schema v2 to the existing evaluation input shapes.

**Step 5: Implement deterministic-first Academic Analyzer**

- normalize known academic/test records;
- use `meets` and `does_not_meet` only for directly comparable values;
- use `possibly_meets` for conditional/equivalence cases;
- use `insufficient_information` for missing or incomparable data;
- AI may explain semantic requirements but may not perform score arithmetic.

**Step 6: Persist application analysis lineage**

Repository rows must record application ID, snapshot ID, input hash, module versions, structured outputs, generation metadata, and creation time. Rows are append-only.

**Step 7: Run tests**

```bash
npm test -- src/lib/ai/applicant-state/context-builder.test.ts src/lib/ai/academic-analysis.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add src/lib/ai/applicant-state src/lib/ai/academic-analysis.ts src/features/apply/api/application-analysis-repository.ts
git commit -m "feat: add application applicant state and academic analysis"
```

---

### Task 6: Complete Experience, Reflection, and Adaptive Follow-up analysis

**Files:**

- Modify: `src/lib/ai/personal-report-v2.ts`
- Create: `src/lib/ai/reflection-analysis.ts`
- Create: `src/lib/ai/adaptive-follow-up.ts`
- Create: `src/app/api/applications/[id]/activities/[activityId]/follow-up/route.ts`
- Test: `src/lib/ai/personal-report-v2.test.ts`
- Test: `src/lib/ai/reflection-analysis.test.ts`
- Test: `src/lib/ai/adaptive-follow-up.test.ts`

**Step 1: Write failing regression tests for the seven Reflection answers**

Assert that changing each of Q1-Q7 changes the relevant Identity/Direction signal and changes the analysis input hash.

Map:

- Q1 to interests/motivations;
- Q2 to values/growth;
- Q3 to problem domains;
- Q4 to capabilities/ownership evidence;
- Q5 to academic direction;
- Q6 to career/future direction;
- Q7 to preferred university environment.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/lib/ai/personal-report-v2.test.ts src/lib/ai/reflection-analysis.test.ts
```

Expected: FAIL because `buildProfileEvaluationInput` currently ignores `personal_reflection_answers`.

**Step 3: Reuse and consolidate current Experience extractors**

Combine CMCAITF, competency, and role/theme outputs into `ActivityAnalysis`. Preserve current post-model grounding and reject invented numbers, roles, actions, or outcomes.

**Step 4: Implement cross-answer Reflection analysis**

A strong signal needs at least two independent evidence sources. One answer produces an isolated signal, not an established identity claim.

**Step 5: Write failing Adaptive Follow-up tests**

Cover deterministic priority:

```text
action > ownership > impact > transformation > challenge > motivation > context
```

Also cover one question per response, two attempts per dimension, six questions per activity, stale question rejection, superseding answers, and template fallback when AI phrasing fails.

**Step 6: Implement Follow-up API and persistence**

Require application ownership and an editable/reopened application. Store answers on the shared activity, append-only, then copy resolved answers into the next confirmed snapshot. A report already generated for another application remains unchanged.

**Step 7: Run tests**

```bash
npm test -- src/lib/ai/personal-report-v2.test.ts src/lib/ai/reflection-analysis.test.ts src/lib/ai/adaptive-follow-up.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add src/lib/ai/personal-report-v2.ts src/lib/ai/reflection-analysis.ts src/lib/ai/adaptive-follow-up.ts src/app/api/applications/[id]/activities/[activityId]/follow-up
git commit -m "feat: add reflection and adaptive evidence analysis"
```

---

### Task 7: Build the Evidence Bank and provenance validation

**Files:**

- Create: `src/shared/evidence/domain.ts`
- Create: `src/shared/evidence/build-evidence-bank.ts`
- Create: `src/shared/evidence/retrieval.ts`
- Test: `src/shared/evidence/build-evidence-bank.test.ts`

**Step 1: Write failing evidence tests**

Cover:

- raw source and AI interpretation remain separate;
- an AI-generated claim cannot become verified;
- document/test-backed evidence can become verified only through deterministic source rules;
- compatible duplicate claims merge provenance;
- incompatible normalized values remain separate and become conflicting;
- lookup by source, competency, and programme criterion;
- supplements receive `report_only` scope.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/shared/evidence/build-evidence-bank.test.ts
```

Expected: FAIL because the canonical Evidence Bank does not exist.

**Step 3: Define canonical schemas**

Include stable IDs, source type/id, raw evidence, interpretations, claims, confidence, verification status, missing information, and provenance. Claims need canonical category/tags for competency and criterion retrieval.

**Step 4: Implement deterministic construction and merge**

Build from snapshot academic records, achievements, activities, reflections, follow-up answers, and documents. Do not use vector search in M0-M4.

**Step 5: Integrate with application analysis persistence**

Store the completed bank in `application_profile_analysis_versions`. Never persist a partially validated bank.

**Step 6: Run tests**

```bash
npm test -- src/shared/evidence/build-evidence-bank.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/shared/evidence src/features/apply/api/application-analysis-repository.ts
git commit -m "feat: add grounded evidence bank"
```

---

### Task 8: Convert Personal Report generation to application scope

**Files:**

- Modify: `src/features/apply/api/personal-report-generation.ts`
- Modify: `src/features/apply/domain/personal-report.ts`
- Modify: `src/lib/ai/personal-report-narrative-synthesis.ts`
- Test: `src/features/apply/api/personal-report-generation.test.ts`
- Test: `src/features/apply/domain/personal-report.test.ts`

**Step 1: Write failing orchestration tests**

Cover:

- application A uses snapshot A and application B uses snapshot B;
- changing live profile data after snapshot A does not alter report A;
- application generation fails when no confirmed snapshot exists;
- non-force generation returns cache for the same snapshot/contracts;
- force generation reuses the analysis snapshot but appends a new report version;
- two requests with one idempotency key return one report version;
- narrative failure persists a valid deterministic report with limitations;
- extractor failure keeps the previous report and persists nothing partial.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/features/apply/api/personal-report-generation.test.ts src/features/apply/domain/personal-report.test.ts
```

Expected: FAIL because generation currently accepts only `userId` and loads live Candidate Context.

**Step 3: Change the orchestrator input**

```ts
regeneratePersonalReport({
  supabase,
  userId,
  applicationId,
  trigger,
  force,
  idempotencyKey,
});
```

Load the latest confirmed application snapshot, build/reuse its analysis version, and write all lineage fields.

**Step 4: Extend the report contract additively**

Keep current report fields and `canvasDetails`. Add:

- `snapshot.summary`, validated at 150-200 words;
- structured `growthAreas` with current gap, importance, and direction;
- `competitiveAdvantages`;
- fixed `keyTakeaways.whatMakesYouStandOut`;
- fixed `keyTakeaways.competitiveAdvantage`;
- fixed `keyTakeaways.growthOpportunity`;
- `evidenceCoverage.strongEvidence`;
- `evidenceCoverage.weakEvidence`;
- `evidenceCoverage.insufficientEvidence`.

Every important insight must expose kind, repeated/isolated/insufficient scope, strength, confidence, evidence IDs, and limitations.

**Step 5: Keep Personal Report separate from Matching**

Do not include programme-fit, reach/match/safety, admission probability, or strategy recommendations in the Personal Report, even though the state is application-scoped.

**Step 6: Run tests**

```bash
npm test -- src/features/apply/api/personal-report-generation.test.ts src/features/apply/domain/personal-report.test.ts src/lib/ai/personal-report-narrative-synthesis.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/features/apply/api/personal-report-generation.ts src/features/apply/domain/personal-report.ts src/lib/ai/personal-report-narrative-synthesis.ts
git commit -m "feat: generate personal reports from application snapshots"
```

---

### Task 9: Add application Personal Report APIs and history

**Files:**

- Create: `src/app/api/applications/[id]/personal-report/route.ts`
- Create: `src/app/api/applications/[id]/personal-report/versions/route.ts`
- Create: `src/app/api/applications/[id]/personal-report/versions/[versionId]/route.ts`
- Create: `src/app/api/applications/[id]/personal-report/evidence/route.ts`
- Create: `src/app/api/applications/[id]/personal-report/supplement/route.ts`
- Modify: `src/app/api/ai-strategy/personal-report/route.ts`
- Test: corresponding `route.test.ts` files

**Step 1: Write failing route tests**

Cover authentication, application ownership, latest report, stale snapshot metadata, force generation, idempotency, application-only history, version ownership, evidence retrieval, application-scoped supplements, rate limiting, and 60-second configuration.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/app/api/applications/\[id\]/personal-report
```

Expected: FAIL because the application routes do not exist.

**Step 3: Implement canonical routes**

- `GET /api/applications/[id]/personal-report` returns the latest application version and `stale: true` when a newer confirmed snapshot has no report.
- `POST /api/applications/[id]/personal-report` accepts `trigger`, `force`, and `idempotencyKey`.
- Version list/detail routes return only rows for the requested application.
- Evidence route resolves provenance from the exact report/analysis version.
- Supplement route writes only to `application_personal_report_supplements`.

**Step 4: Preserve a compatibility seam**

The old global POST route may temporarily accept an `applicationId` and delegate to the canonical route/orchestrator. Without `applicationId`, return `APPLICATION_REQUIRED`; do not create another global row. Keep legacy version readers read-only for archive access.

**Step 5: Use consistent HTTP behavior**

- 401 unauthenticated;
- 404 unknown/not-owned resource;
- 409 unconfirmed application, stale follow-up, or target not ready;
- 422 invalid request;
- 429 rate limit;
- 502 invalid provider output while preserving the previous report;
- 503 missing provider/migration;
- 504 timeout.

**Step 6: Run tests**

```bash
npm test -- src/app/api/applications/\[id\]/personal-report src/app/api/ai-strategy/personal-report/route.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/app/api/applications/[id]/personal-report src/app/api/ai-strategy/personal-report/route.ts
git commit -m "feat: expose application personal report history"
```

---

### Task 10: Preserve downstream report lineage

**Files:**

- Modify: `src/app/api/applications/[id]/match-insights/route.ts`
- Modify: `src/app/api/applications/[id]/strategy/recommendation/route.ts`
- Test: `src/app/api/applications/[id]/match-insights/route.test.ts`
- Test: `src/app/api/applications/[id]/strategy/recommendation/route.test.ts`

**Step 1: Write failing compatibility tests**

Prove that:

- Matching requests/generates the Personal Report for the same application;
- the saved `source_personal_report_version_id` belongs to that application;
- Strategy resolves the latest valid Personal Report for its application;
- existing downstream rows referencing legacy global versions still deserialize;
- no Matching/Strategy scores or output contracts change.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/app/api/applications/\[id\]/match-insights/route.test.ts src/app/api/applications/\[id\]/strategy/recommendation/route.test.ts
```

Expected: FAIL because both consumers currently resolve a user-level latest Personal Report.

**Step 3: Update only source resolution**

Pass the current application ID to the Personal Report generator/repository and retain the existing `source_personal_report_version_id` column. Do not change F5/F7 calculations or prompts.

**Step 4: Run tests**

```bash
npm test -- src/app/api/applications/\[id\]/match-insights/route.test.ts src/app/api/applications/\[id\]/strategy/recommendation/route.test.ts
```

Expected: PASS with unchanged Matching/Strategy fixtures except source version ownership.

**Step 5: Commit**

```bash
git add src/app/api/applications/[id]/match-insights/route.ts src/app/api/applications/[id]/strategy/recommendation/route.ts
git commit -m "fix: keep downstream reports on application personal lineage"
```

---

### Task 11: Integrate report generation UI callers without redesigning UI

**Files:**

- Modify: `src/features/apply/ui/analysis-workspace.tsx`
- Modify: application Personal Report page/view loaders identified by Semble during implementation
- Test: `src/features/apply/ui/analysis-workspace.test.tsx`
- Test: existing Personal Report view/history tests

**Step 1: Write failing caller tests**

Cover:

- generation always sends the current `applicationId`;
- opening application A requests A's latest report/history;
- selecting a historical version remains within application A;
- regenerate sends an idempotency key and force flag;
- a reopened/unconfirmed application displays the backend blocking state rather than generating from live data.

**Step 2: Run tests and verify failure**

```bash
npm test -- src/features/apply/ui/analysis-workspace.test.tsx
```

Expected: FAIL because the current Personal Report call is user-level.

**Step 3: Update API callers**

Do not redesign cards or report sections. Change only routing/data ownership wiring needed to call application-scoped endpoints and display the existing version selector for that application.

**Step 4: Run tests**

```bash
npm test -- src/features/apply/ui/analysis-workspace.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/apply/ui/analysis-workspace.tsx src/app/ai-strategy
git commit -m "fix: scope report ui calls to application"
```

---

### Task 12: Migration, isolation, and end-to-end verification

**Files:**

- Create: `src/features/apply/api/application-personal-report.integration.test.ts`
- Modify: `docs/current-status.md`
- Modify: `docs/verification.md` only if verification commands change

**Step 1: Add integration fixtures**

Required scenario:

```text
Application A confirms snapshot A1
→ generates report A1

Application B edits shared data
→ confirms snapshot B1
→ generates report B1

Assert report A1 remains unchanged
Assert A history excludes B1

Reopen A
→ edit
→ confirm snapshot A2
→ regenerate report A2

Assert A history is [A2, A1]
Assert B remains B1
```

Also cover legacy `application_id = NULL` rows, supplement isolation, exact evidence lineage, force idempotency, and concurrent non-force requests.

**Step 2: Run the complete report/evaluation suite**

```bash
npm test -- src/features/apply src/shared/evaluation src/shared/evidence src/lib/ai
```

Expected: PASS.

**Step 3: Run project gates**

```bash
npm run verify:pr
```

Expected: normal and strict TypeScript, lint, coverage tests, i18n checks, and production build all pass.

**Step 4: Verify migration behavior against a non-production database**

Check:

- existing Personal Report rows remain unchanged and nullable;
- new RLS rejects cross-user reads/writes;
- delete behavior matches application ownership;
- old Matching/Strategy foreign keys still resolve;
- new report rows require application/snapshot lineage at repository level;
- migration is idempotent when run twice.

**Step 5: Refresh dependency analysis**

Repair or remove the stale GitNexus WAL checkpoint state, run `npx gitnexus analyze`, then run impact/change detection for the modified report orchestrator and route handlers. Treat HIGH or CRITICAL impact as a stop condition for review.

**Step 6: Update durable documentation**

Record measured migrations, commands, test totals, rollout behavior, legacy archive treatment, and known risks in `docs/current-status.md`. Do not claim browser or production verification unless actually performed.

**Step 7: Final commit**

```bash
git add src/features/apply/api/application-personal-report.integration.test.ts docs/current-status.md docs/verification.md
git commit -m "test: verify application personal report isolation"
```

---

## Acceptance criteria

- Every new Personal Report version has application, confirmed snapshot, analysis, input hash, and contract lineage.
- Report generation never reconstructs application evidence from live profile tables after confirmation.
- Editing data for application B cannot change any stored report version for application A.
- Reconfirming A appends a snapshot and regenerating appends a report; neither operation overwrites history.
- Application history is visible but contains only that application's versions.
- Seven Personal Reflection answers materially feed Identity and Direction analysis.
- Every important report insight has evidence references, confidence/strength, limitations, and repeated/isolated status.
- Unsupported AI claims cannot become verified facts.
- Personal Report emits no admission probability and performs no Matching/Strategy analysis.
- Legacy global report versions remain readable as archive and are never falsely assigned to an application.
- Current Matching/Strategy lineage remains valid without changing their scoring behavior.
- `npm run verify:pr` passes before merge.

## Rollout notes

- Apply `supabase-application-personal-report-state.sql` before deploying application code.
- Deploy backend and updated application-scoped callers in the same release.
- Do not bulk-generate or backfill AI reports.
- Existing applications with a confirmed application snapshot generate lazily on first request.
- Existing applications without a snapshot must complete Review & Confirm.
- Keep module flags available as emergency kill switches, but enable the new pipeline by default.
