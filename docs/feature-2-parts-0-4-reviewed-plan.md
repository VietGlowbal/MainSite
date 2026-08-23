# Feature 2 — GlowBal Strategy: Execution-Ready Delivery Plan (Parts 0–4)

> **For Agent Execution**
>
> Implement task-by-task with strict TDD. Read the repository's canonical architecture/spec files before changing contracts. Where this plan and the current code disagree, **the code wins**, but any deviation from the canonical Feature 2 contracts must be documented before proceeding.

**Scope:** Parts 0–4 only: foundations, reflections, report-generation migration, F5 Matching Report, and F8 Strategy Report with Planner handoff.

**Primary goal:** Deliver a reliable, evidence-grounded, idempotent GlowBal Strategy pipeline from profile/reflection inputs through Personal Report → Matching Report → Strategy Report → Planner roadmap, without admission-probability claims and without losing user edits during regeneration.

**Architecture constraints:**

- Feature-Sliced Design remains authoritative: `src/features/*`, `src/shared/*`, `src/server/*`, `src/app/*`.
- Deterministic scoring/evaluation belongs in `src/shared/evaluation/` and must not call AI.
- AI extraction/synthesis belongs in `src/lib/ai/` and must return validated structured output.
- Persisted generated artifacts must be versioned/idempotent and tied to their exact inputs.
- Missing data must remain distinguishable from observation and inference.
- User-authored overrides/progress must be stored separately from regenerated AI output whenever regeneration could otherwise overwrite them.
- Match percentages are **match scores**, never admission likelihood, acceptance chance, or probability of admission.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, Supabase/Postgres/RLS, Vitest, Zod.

---

## 0. Pre-implementation contract audit

Do this before Wave 1. The purpose is to prevent implementation against guessed filenames, stale schemas, or mismatched type names.

### 0.A Read canonical sources

Read and reconcile at minimum:

- `docs/current-status.md`
- `docs/ai-strategy-canonical-architecture.md`
- `docs/ai-strategy-route-audit.md`
- `docs/known-issues.md`
- `docs/strategy-reports-spec.md`
- the current F5 framework/spec source referenced by the repository
- the current Matching Report and Strategy Report visual references/PDFs
- current Figma nodes for the Matching and Strategy report frames if available

### 0.B Repository-wide symbol audit

Before editing, search the codebase for all producers/consumers of:

- `applicant_analyses`
- `source_analysis_id`
- `NarrativeProfile`
- `PersonalReportV2`
- `ProfileEvaluation`
- `ProgrammeFitResult`
- `ProgrammeFitEvaluation`
- `ProgrammeFitClassification`
- `fitDimensionSchema`
- `programmeFitSchema`
- `buildProgrammeFitPlaceholder`
- `/strategy/applicant-analysis`
- `/strategy/recommendation`
- `/matching-report`
- `reconcileSeeds`
- `content-block.tsx`
- `structured_table`, `long_text`, `checklist`

**Gate:** Use the actual repository type names after this audit. Do not introduce a parallel `ProgrammeFitResult`/`ProgrammeFitEvaluation` concept if one canonical type already exists.

### 0.C Database contract audit

Inspect the live migration/schema definitions for:

- the FK target and semantics of `source_analysis_id`
- report version tables and uniqueness constraints
- programme-fit persistence tables
- Planner seed/task persistence
- user-edit/override persistence
- cascade behavior from `applications`

**Critical rule:** Do **not** repoint an existing `source_analysis_id` column from `applicant_analyses.id` to `student_personal_report_versions.id` unless the database FK and semantic contract are explicitly migrated. Prefer a correctly named new FK such as `source_personal_report_version_id` / `source_programme_fit_version_id` if the current schema requires it.

### 0.D Define implementation invariants

Record these in tests and/or comments before feature work:

1. Same logical inputs + same engine/prompt version → same input hash and cache identity.
2. Missing dimensions remain `null`/unassessed and weights are renormalised only across assessed dimensions.
3. Hard eligibility criteria are separate from competitiveness scoring.
4. A hard eligibility failure overrides competitiveness classification.
5. Classification is determined only by the canonical academic-band rule after hard-gate checks.
6. `strong_match` is a competitiveness band between `match` and `safety` if confirmed by the canonical F5 spec.
7. Generated narrative must be evidence-grounded; unsupported claims must not be silently invented.
8. Regeneration never destroys student edits, task completion, due dates, or manually changed Planner state.
9. Every write path is user/application scoped and RLS-safe.
10. No generated surface calls a match score an admission probability.

---

# Part 0 — Foundations: Observability, Migration State, Cascade Delete

## Outcome

The system can tell when generation fails, why it failed, which version/input caused it, and whether production schema/migration prerequisites are actually live.

## Task 0.1 — Implement structured server observability

### Files

- `src/server/observability/index.ts`
- `src/server/observability/index.test.ts`

### Implement

Provide a small server-only observability API with:

- structured JSON logging
- operation name
- event name / lifecycle stage
- request/application/user-safe identifiers where allowed
- input hash / engine version / prompt version when applicable
- elapsed duration
- cache status
- classified error code/category
- safe metadata serialization
- non-throwing telemetry/reporting dispatch

Suggested lifecycle events:

- `started`
- `cache_hit`
- `validated`
- `generated`
- `persisted`
- `completed`
- `failed`

Supported operation names must cover current generation entry points, including:

- `personal_report_generate`
- `matching_report_generate`
- `strategy_recommendation_generate`
- legacy `applicant_analysis_generate` only while that endpoint still exists
- `roadmap_tasks_generate`

### `classifyError`

At minimum classify:

- known PostgreSQL errors used by this codebase
- PostgREST missing table/column/schema errors (`PGRST204`, `PGRST205`, etc.)
- validation errors
- rate-limit errors
- upstream AI/API errors
- timeout/network failures
- unknown failures

Never log raw secrets, auth tokens, full uploaded document content, or unbounded prompt bodies.

### Tests

Add tests for:

- valid JSON output
- stable operation/event fields
- elapsed-time measurement
- error classification
- circular/non-serializable metadata safety
- logger/telemetry failures not masking the original application error
- sensitive metadata redaction if a redaction helper is introduced

### Acceptance criteria

- Observability code itself does not throw during normal failure handling.
- Unit tests pass independently.
- No client bundle imports server-only observability code.

---

## Task 0.2 — Instrument all report-generation entry points

### Audit first

Identify the actual four generation entry points in current code rather than assuming route names.

Expected locations include:

- personal report generation service/route
- matching/match-insights generation route
- strategy recommendation generation route
- any still-live legacy applicant-analysis generation route during migration

### Instrument

For every entry point capture:

- start
- auth/application validation outcome
- prerequisite validation outcome
- cache hit/miss
- AI/extraction duration separately from deterministic evaluation duration where applicable
- persistence duration/outcome
- success/failure
- input hash + version identifiers

Replace ad-hoc `console.log/error` statements on these paths where structured logging is appropriate.

### Acceptance criteria

- A failed generation can be traced to one operation and lifecycle stage.
- A cache hit is distinguishable from a fresh generation.
- 422/429/503 outcomes are classifiable without dumping sensitive payloads.

---

## Task 0.3 — Verify production migration state

A SQL file existing in the repo is not proof it is live.

### Execute

- Run the repository's production schema inspection flow (for example `/db-schema` if that is the canonical mechanism).
- Record which Feature 2 migrations are applied.
- Compare live FK/column/index state with repository migrations.
- Do not mark Part 0 complete while required migrations are only present locally.

### Acceptance criteria

- A checked record of live migration/schema state exists.
- Any drift blocking Parts 2–4 is resolved before those writes are shipped.

---

## Task 0.4 — Verify application cascade delete end-to-end

### Target

Validate `supabase-application-cascade-repair.sql` against the **actual live schema**.

### Verify

- direct application-owned rows are deleted as designed
- secondary child rows are deleted as designed
- tables intentionally using `ON DELETE SET NULL` retain that behavior
- no orphaned reports, roadmap tasks, or CV/application-strategy artifacts remain

Do not rely only on DDL inspection; perform a disposable real delete in a safe test/staging context using a fully populated application fixture.

### Tests/evidence

- create fixture application with representative direct + secondary children
- delete application
- assert required rows are gone
- assert intentional `SET NULL` rows remain with null FK

### Acceptance criteria

- Cascade behavior is proven by execution, not inferred from a migration filename.

---

# Part 1 — Reflections, Single-Page Review, URL Threading, Error Recovery

## Outcome

Reflection is faster to review/edit, user text is not lost, navigation returns to the correct application context, and downstream generation failures do not trap the user.

## Task 1.1 — Collapse Personal Reflection to one review/edit page

### Files

- `personal-reflection-form.tsx`
- new focused question-card component if useful
- component tests

### Preserve existing contract

Before refactoring, write characterization tests for:

- initial values
- required/optional question semantics
- completion calculation
- save payload shape
- navigation/return behavior
- any analytics/onboarding events

### Implement

- render all five questions vertically
- preserve question order and guidance text from canonical UI/spec
- autogrow textareas
- debounced save (target 1000 ms unless existing UX contract differs)
- save on blur
- header-level state: `idle | saving | saved | error`
- retryable save failure without discarding unsaved local text

### Concurrency requirements

Prevent stale autosave responses from overwriting newer text:

- cancel/ignore outdated requests, or
- version requests locally and only accept latest completion

On unmount/navigation, flush the latest meaningful pending edit if the existing data layer safely supports it.

### Tests

- all five questions render simultaneously
- editing one question does not reset others
- debounce behavior
- blur save
- out-of-order save responses do not regress text
- failed save keeps local text and exposes retry state
- completion status updates correctly

---

## Task 1.2 — Collapse per-achievement/activity reflection without changing its data model

The original workstream identifies the per-achievement reflection flow inside/around `reflection-evidence-form.tsx`. Confirm the actual owning component before changing `activity-reflection-modal.tsx` or creating a new abstraction.

### Characterize first

Test current:

- seven reflection dimensions/fields
- progressive/conditional fields
- completion calculation
- save payload
- modal open/close behavior
- switching between achievements/activities

### Implement

- one scrollable review surface
- all required dimensions reachable without step navigation
- preserve any intentional progressive disclosure
- preserve completion semantics
- no text loss when switching records or closing/reopening

### Acceptance criteria

- The refactor changes interaction, not persisted meaning.

---

## Task 1.3 — Decompose `reflection-evidence-form.tsx`

Refactor before adding more UI state.

### Suggested boundaries

- `src/features/apply/hooks/use-evidence-state.ts`
- `src/features/apply/ui/evidence/evidence-header-banner.tsx`
- `src/features/apply/ui/evidence/evidence-document-section.tsx`
- `src/features/apply/ui/evidence/evidence-tabbed-grid.tsx`
- `src/features/apply/ui/evidence/evidence-modals-container.tsx`
- `src/features/apply/ui/evidence/evidence-footer-actions.tsx`

Use actual dependency boundaries found in code; do not mechanically extract components that only forward a large prop bag.

### Refactor rules

- no behavior change in the extraction commit
- keep server/client boundaries valid
- avoid moving domain state into presentational components
- preserve existing accessibility and focus behavior
- keep modal state keyed to the selected evidence item

### Tests

Run characterization tests before/after extraction with no snapshot-only coverage.

---

## Task 1.4 — Fix `?return=` threading as a system

### Files

- `src/shared/lib/app-routes.ts`
- every link/navigation into `/profile/*`
- every link/navigation into `/ai-strategy/*`
- route/page guards consuming the return target

### Implement

- make `applicationIdFromPath` robust to nested encoded `return` parameters if this is part of the current route contract
- centralise `resolveApplicationReturn`
- preserve `return` when moving through profile subpages
- preserve application context when moving through strategy pages

### Security requirement

Treat `return` as an internal navigation target only. Reject/fallback external or malformed destinations instead of creating an open redirect.

### Audit targets

At minimum inspect:

- `src/app/profile/personal/page.tsx`
- `src/app/profile/achievements/page.tsx`
- `src/app/profile/documents/page.tsx`
- `src/app/profile/goals/page.tsx`
- `src/app/profile/work/page.tsx`
- `src/app/profile/page.tsx`
- `profile-client.tsx`
- relevant `/ai-strategy/[applicationId]/*` pages

### Tests

Table-driven tests for:

- plain application URL
- URL-encoded return URL
- nested return URL
- missing return
- malformed encoding
- external URL rejection
- wrong/missing application id fallback

---

## Task 1.5 — Make onboarding guards consistent

Audit, do not blindly add a new guard only to three hard-coded pages.

### Implement

Create/reuse one canonical readiness/onboarding guard definition, then ensure the relevant AI Strategy report pages require the same prerequisite set, including `personal-reflection` if that is the canonical prerequisite.

Expected pages include:

- strategy analysis
- matching report
- strategy report

### Acceptance criteria

- A user cannot reach a report page with a prerequisite state the generator itself will reject.
- Guard behavior and API prerequisite validation agree.

---

## Task 1.6 — Split blocking input issues from downstream failures

### Files

- `review-confirm-view.tsx`
- `analysis-workspace.tsx`
- any shared report-generation error UI

### Behavior

**Blocking/pre-confirmation issues**

- remain blocking
- render per-issue actionable `Fix this` links
- preserve correct `return` context

**Downstream failures (generation/API 429/503/etc.)**

- do not erase already completed prerequisites
- render non-blocking alert/error state
- include retry where safe
- preserve portal/report navigation that is still valid
- distinguish rate limit vs service unavailable vs validation regression

### Tests

- blocking issue path
- 429 path
- 503 path
- retry success path
- retry failure path
- portal remains accessible when failure is downstream only

---

# Part 2 — Report Generation Migration off `applicant_analyses`

## Outcome

Strategy generation reads canonical structured report/evaluation data directly. The legacy blob is no longer generated solely to feed Strategy Report.

## Task 2.1 — Lock the canonical input contract before refactoring

The source workstream requires Strategy generation to consume structured `ProfileEvaluation` and programme-fit evaluation directly. The implementation plan must use the actual current repository types discovered in 0.B.

### Define one explicit input object

Example shape conceptually:

```ts
type StrategyGenerationInputs = {
  personalReportVersionId: string
  profileEvaluation: ProfileEvaluation
  programmeFitVersionId: string
  programmeFit: CanonicalProgrammeFitType
  applicationId: string
  programmeId?: string
}
```

Use actual type/field names from the repository.

### Critical scoping

- Personal report may be user-level/reusable.
- Programme fit is application/programme-specific.
- Strategy generation must combine the personal report with the programme-fit result for the **same target application/programme**.
- Never select an arbitrary "latest" programme-fit row across applications.

### Tests

- correct application/programme scoping
- missing personal report → structured `needsInputs`
- missing programme fit → structured `needsInputs`
- stale/wrong-application fit is rejected

---

## Task 2.2 — Refactor `generateStrategyRecommendation`

### File

- `src/lib/ai/strategy-recommendation.ts`

### Replace

Remove dependence on legacy `NarrativeProfile`/`applicant_analyses` as an input source.

### Build prompt context from canonical structured data

Use only fields supported by the canonical personal report/profile evaluation and F5 result, for example:

- Core Identity
- Driving Force
- Signature Pattern
- Emerging Themes
- Personal Positioning
- Grounded Evidence
- Programme Fit
- hard-criteria state
- known gaps / missing data

Do not flatten evidence into prose and then re-infer facts if the structured source already provides them.

### Output contract

- structured Zod-validated result
- no admission probability language
- explicit treatment of missing data
- evidence references/IDs where the current schema supports them
- prompt version recorded

### Tests

- prompt builder includes canonical sections
- unsupported/missing fields are omitted or explicitly represented, not hallucinated
- output validation failure is handled deterministically

---

## Task 2.3 — Migrate strategy recommendation route

### File

- `src/app/api/applications/[id]/strategy/recommendation/route.ts`

### Read path

Fetch:

1. authenticated user
2. owned target application
3. latest valid Personal Report/ProfileEvaluation version for that user
4. latest valid Programme Fit evaluation for that application/programme

### Validation

Return structured `422` with `needsInputs` when required canonical inputs are absent.

Do not use a personal-report lookup alone as proof that strategy inputs are complete.

### Idempotency/cache key

Compute `input_hash` from canonical, stable inputs including at minimum:

- personal report/profile evaluation version identity/content hash
- programme-fit version identity/content hash
- relevant application/programme target data
- engine version
- prompt version

If an identical completed version exists, return it instead of regenerating.

### Persistence

Persist explicit source lineage.

**Do not overload `source_analysis_id` across unrelated tables.** After schema audit, either:

- use existing correctly typed source FK columns, or
- add a migration with explicit source columns, then backfill if required.

Persist:

- `input_hash`
- engine version
- prompt version
- source personal-report/profile-evaluation version
- source programme-fit version
- generated payload/version
- generation timestamp/status as supported by current schema

### Tests

- ownership/RLS-safe application access
- 422 missing-input branches
- cache hit
- fresh generation
- persistence failure
- AI validation failure
- correct source lineage

---

## Task 2.4 — Update onboarding/readiness queries

### Files

- `onboarding-status.ts`
- `src/app/apply/page.tsx`
- any duplicated readiness calculation found by search

### Implement

Replace `applicant_analyses` as the signal for AI analysis completion with the canonical personal-report/profile-evaluation readiness signal.

For Strategy readiness, require both canonical Personal Report/ProfileEvaluation and the target application's valid Programme Fit result if the route itself requires both.

### Acceptance criteria

UI readiness and API readiness cannot disagree for the same application state.

---

## Task 2.5 — Remove legacy callers, then deprecate legacy endpoint

### First remove callers

Search repository-wide for calls to:

`/api/applications/[id]/strategy/applicant-analysis`

Known candidates include:

- `analysis-workspace.tsx`
- `evidence-upload.tsx`

### Then deprecate

- `src/app/api/applications/[id]/strategy/applicant-analysis/route.ts`
- `src/lib/ai/strategy-dashboard/applicant-analysis.ts`

Choose one controlled transition:

- delete if zero callers/data dependencies remain, or
- leave a clearly marked compatibility route for one release if external/unknown callers exist

Do not continue generating legacy blobs "just in case" after the dependency audit proves they are unused.

### Regression tests

- no UI flow calls the legacy endpoint
- strategy generation succeeds without any `applicant_analyses` row
- Personal Report generation still succeeds
- Matching Report generation still succeeds

---

## Task 2.6 — Preserve generation contract invariants

Add/retain tests proving:

- no admission probability
- missing dimensions remain missing
- weight renormalisation is preserved
- observation vs inference vs missing data remain distinguishable
- stored evaluations include input hash + engine version + prompt version
- regeneration with unchanged inputs is idempotent

---

# Part 3 — F5 Matching Report: Deterministic Engine, Structured Insights, UI

## Outcome

F5 is no longer a placeholder. It produces a deterministic, tested score/classification and an evidence-grounded Matching Report with the six canonical sections.

## Task 3.1 — Freeze the F5 domain contract

### Files

- `src/shared/evaluation/f5-programme-fit.ts`
- report schemas in `ai-reports.ts` or their current equivalent

### Canonical scored dimensions

- Academic — 25%
- Persona — 25%
- Career — 20%
- Financial — 15%
- Readiness — 15%

### Score range

Dimension score supports decimal values from 1.0 to 5.0 when assessed.

Update the Zod schema so `.int()` does not make intermediate percentages impossible.

### Match-score percentage

Use one helper and one formula everywhere:

```ts
matchPercent = Math.round(((score - 1) / 4) * 100)
```

Clamp/validate inputs rather than allowing values outside 1–5.

Labels must say **Match Score / Mức độ phù hợp hồ sơ** (or the canonical i18n equivalent), never acceptance/admission probability.

### Classification contract

Implement in this order:

1. Any canonical hard eligibility failure → `currently_ineligible`.
2. If academic competitiveness cannot be assessed → use the repository's canonical missing-data classification (`insufficient_data`, `not_available`, or equivalent discovered in the audit). Do not invent a second missing-data enum.
3. Otherwise classify using the **academic score only**, with `strong_match` inserted between `match` and `safety` according to the exact thresholds in the canonical F5 spec.

**Do not let Persona, Career, Financial, Readiness, or overall weighted score change the competitiveness band.** They contribute to the match score/report, not the academic competitiveness label.

### Enum propagation

When adding `strong_match`, update every exhaustive consumer found by search:

- Zod enums
- TypeScript unions
- UI badge/color/label maps
- i18n keys
- serializers/parsers
- tests/fixtures
- any DB constraints/checks if present

---

## Task 3.2 — Implement pure F5 scoring

### Implement

- pure deterministic function(s)
- weighted score across the five dimensions
- renormalise weights across assessed dimensions only
- preserve null/unassessed dimensions in output
- separate hard-criteria evaluation from weighted competitiveness scoring
- no AI/network/database access in the evaluation module

### Required test matrix

1. all five dimensions present
2. one missing non-academic dimension
3. several missing non-academic dimensions
4. only academic present
5. academic missing
6. decimal dimension scores
7. boundary scores for every academic band
8. hard gate fail with very high scores
9. hard gate unknown with otherwise valid scores
10. all dimensions missing
11. invalid score outside 1–5 rejected
12. weighted score never depends on missing dimension default values

Use exact threshold values only after reading the canonical F5 spec.

---

## Task 3.3 — Define the Matching Report read model before building UI

The six-section UI requires more than a numeric F5 score. Define one validated report DTO/schema consumed by the page.

It must contain enough structured data for:

1. Overall Match Summary
2. Fit Breakdown & Why You Match
3. Hard Criteria Assessment
4. Gap & Risk Analysis
5. Admissions Perspective
6. Final Recommendation

### Keep deterministic vs semantic fields separate

**Deterministic fields** should include:

- dimension scores/statuses
- weighted match score
- match percentage
- classification
- hard-criteria statuses
- readiness data if deterministic

**AI/semantic fields** may include, if required by canonical spec:

- fit statement
- top alignments
- evidence-grounded explanations
- critical/competitive gaps
- hidden risks
- admissions-perspective narrative
- remaining questions
- final recommendation narrative

Do not ask the AI to recalculate deterministic scores or classification.

### Evidence grounding

Semantic output must be derived from structured canonical inputs and should carry evidence references/traceable source keys where the current architecture supports them.

### Defensive validation

- validate AI output with Zod before persistence/rendering
- malformed optional narrative should degrade a section gracefully, not crash the whole report
- deterministic F5 results must remain renderable even if semantic synthesis fails

---

## Task 3.4 — Implement/complete Matching Report generation pipeline

Audit whether `match-insights` is already the canonical semantic generation route or whether another route owns report generation. Consolidate rather than creating a duplicate pipeline.

### Generation flow

1. validate auth/application ownership
2. load canonical profile evaluation + target programme/application inputs
3. compute deterministic F5
4. build stable input hash
5. return cached matching report if identical version exists
6. generate semantic report fields only if required
7. validate structured output
8. persist report with source lineage + versions
9. emit structured telemetry

### Failure behavior

- missing inputs → 422 with actionable `needsInputs`
- rate limit → 429
- upstream unavailable → 503
- deterministic result must not be replaced by fabricated AI output

### Tests

- cache hit
- score/classification not generated by AI
- missing input
- malformed AI output
- persistence failure
- ownership
- version/source lineage

---

## Task 3.5 — Build the six canonical Matching Report sections

### Files

- `matching-report-view.tsx`
- matching-report page/loader
- focused section components as needed
- rendering tests

### Section order

1. **Overall Match Summary**
   - Match Score %
   - Readiness % if canonical and supported
   - Confidence % only if explicitly defined by the canonical spec/data model
   - classification badge
   - fit statement
   - top 2–3 alignments

2. **Fit Breakdown & Why You Match**
   - five dimension rows
   - matrix: Assessment → Evidence → Why it matters → Admissions perspective

3. **Hard Criteria Assessment**
   - canonical hard gates, including Subject / Qualification / Language / Citizenship / Deadline when confirmed by current spec
   - `Met | Not Met | Unknown`

4. **Gap & Risk Analysis**
   - up to canonical maximum critical gaps
   - impact representation only if present in spec
   - competitive gaps
   - hidden risks

5. **Admissions Perspective**
   - first impression
   - strengths
   - remaining questions
   - desired additions

6. **Final Recommendation**
   - conclusion
   - biggest strength
   - biggest opportunity
   - CTA to Strategy Report

### UI rules

- render missing data honestly (`Unknown`, `Not assessed`, etc.)
- never convert missing data to zero
- do not render an admission-chance gauge
- use canonical Figma/PDF layout; do not invent a new report design when node IDs/reference frames are available
- preserve mobile/readability behavior

### Rendering tests

Cover:

- each classification including `strong_match`
- currently ineligible
- missing academic data
- missing optional semantic sections
- long evidence text
- empty gaps
- hard criteria unknown
- CTA route preserves application context

---

# Part 4 — F8 Strategy Report: Engine, Editable Strategy, GenUI, Planner Handoff

## Outcome

Strategy Report is generated from canonical Personal Report + Matching Report inputs, persists as a versioned/idempotent artifact, presents the five canonical sections, preserves applicant edits across regeneration, and seeds Planner tasks without duplicates or lost progress.

## Task 4.1 — Define the F8 Strategy Report schema/read model

Do this before UI implementation.

### Canonical sections

1. Strategic Overview
2. Strategic Priority Table
3. Profile Development Strategy
4. Narrative Strategy
5. Execution Roadmap

### Structured schema must support

**Strategic Overview**

- current position
- strategic goal
- top three priorities
- expected outcome

**Strategic Priority Table**

- stable priority ID/key
- priority title
- current situation
- why it matters
- recommended actions
- expected impact
- priority level

**Profile Development Strategy**

- academic strategy
- experience strategy
- differentiation strategy

**Narrative Strategy**

- core narrative arc
- 3–5 supporting themes when supported by evidence
- evidence links/theme-to-experience mapping where available
- consistency check

**Execution Roadmap**

- stable phase ID/key
- phase name
- objective
- deliverables/actions
- dependencies
- suggested tool/deep link where available
- task seed metadata

Use the exact fields in `docs/strategy-reports-spec.md` if they differ.

---

## Task 4.2 — Complete F8 generation, not just the UI

Part 2 migrates the input source; Part 4 must define/generate the actual five-section F8 payload.

### Inputs

Use canonical structured artifacts only:

- latest valid Personal Report/ProfileEvaluation
- latest valid Matching Report/F5 result for the same application/programme
- application/programme metadata needed by the canonical spec

### AI responsibility

AI may synthesize strategy/narrative/actions from structured inputs, but must not:

- invent missing achievements/evidence
- recalculate F5 score/classification
- claim admission probability
- silently treat inferred facts as observed facts

### Structured generation

- versioned prompt
- Zod-validated output
- explicit missing-data handling
- stable IDs/keys for priorities, themes, phases, and roadmap deliverables where they will later be reconciled

### Idempotency

Compute `input_hash` from:

- source personal-report/profile-evaluation identity/content
- source F5/matching-report identity/content
- target application/programme inputs
- F8 engine version
- F8 prompt version

Same hash returns cached generated base strategy.

### Persistence

Persist generated base content separately from applicant overrides where practical.

Required lineage:

- source Personal Report/ProfileEvaluation version
- source Matching Report/F5 version
- engine version
- prompt version
- input hash

### Tests

- correct input scoping
- missing F5 blocks F8 with `needsInputs`
- cache hit
- malformed AI output
- missing evidence stays missing
- source lineage persisted

---

## Task 4.3 — Design generated base state vs student overrides

The Strategic Priority Table is applicant-editable. Regeneration must not overwrite it.

### Storage model

Prefer a two-layer model:

- **generated base**: immutable/versioned AI output for a report version
- **student overrides**: mutable user-authored changes keyed by stable priority/block ID

At render time:

`effective value = student override ?? generated base value`

### Override requirements

- per-field or per-row granularity according to the UI contract
- `updated_at`
- user/application ownership
- stable key tied to semantic item identity, not array index

### Regeneration rules

- matching stable IDs preserve overrides
- new generated items appear with no override
- removed generated items do not silently delete historical user edits; archive/retire according to current data model
- explicit reset-to-generated is possible if the product supports it

### Tests

- edit persists after reload
- edit persists after identical regeneration
- edit persists after changed generation when stable key survives
- new rows appear without deleting old overrides
- failed autosave keeps local edit and allows retry

---

## Task 4.4 — Expand GenUI vocabulary as a versioned contract

### Files

- `recommendation.ts`
- `content-block.tsx`
- parsers/read-side validators
- tests/fixtures

### New block types

Only add types required by actual F8/Planner outputs:

- `editable_priority_grid`
- `comparison_table`
- `narrative_theme_map`
- `phase_timeline`

### Every block type requires

1. discriminated schema
2. version or backwards-compatible shape strategy
3. renderer
4. read-side validation
5. graceful fallback for malformed/unknown data
6. fixture/test coverage

### Backwards compatibility

Existing persisted types remain supported:

- `structured_table`
- `long_text`
- `checklist`

Never remove a persisted type just because new types exist.

### Editable block rule

For `editable_priority_grid`, persist user changes in override/user-state storage rather than mutating the generated seed payload in place unless the existing architecture already provides an equivalent safe layering model.

---

## Task 4.5 — Build the five canonical Strategy Report sections

### Files

- `strategy-recommendation-report.tsx`
- `strategy-report/page.tsx`
- focused section components
- tests

### Rendering

1. **Strategic Overview**
   - current position
   - strategic goal
   - top three priorities
   - expected outcome

2. **Strategic Priority Table**
   - editable rows/fields according to spec
   - save state
   - student overrides visibly take precedence

3. **Profile Development Strategy**
   - academic
   - experience
   - differentiation

4. **Narrative Strategy**
   - core arc
   - supporting themes
   - evidence/theme map
   - consistency check

5. **Execution Roadmap**
   - four canonical phases if confirmed by current spec:
     - Strengthen Foundation
     - Build Competitive Advantages
     - Craft Application
     - Finalise & Optimise
   - roadmap deliverables with Planner handoff actions

### UI rules

- use canonical report references/Figma nodes rather than designing from memory
- gracefully render partial data
- preserve application ID in all CTAs
- never block reading the entire report because one editable widget fails to save

### Tests

- all five sections
- partial/missing semantic content
- edited priority values
- autosave success/failure
- roadmap CTA/deep links
- mobile rendering smoke test where test infrastructure permits

---

## Task 4.6 — Make `reconcileSeeds` deterministic and lossless

Before modifying it, add characterization tests for current Planner reconciliation behavior.

### Stable identity

Every generated roadmap task/seed must have a deterministic semantic key, e.g. derived from:

- application
- F8 report/version family
- roadmap phase
- deliverable key

Do not key by array index or generated prose text alone.

### Reconciliation rules

On F8 regeneration:

- preserve completed state
- preserve manually changed status
- preserve user-edited title/notes when the current contract treats them as user-owned
- preserve due date if user-modified
- preserve assignee/ownership fields if applicable
- preserve task-specific GenUI edits/progress
- update generated-only fields when the seed identity matches
- add genuinely new seeds exactly once
- retire/archive removed generated seeds according to existing product behavior; never hard-delete completed/user-edited tasks by default

### Idempotency

Running reconciliation twice with the same F8 report must produce no duplicate tasks and no additional writes beyond timestamps that are intentionally updated.

### Tests

- identical regeneration
- changed recommendation text, same semantic seed
- completed task
- user-edited task
- removed task seed
- newly added task seed
- duplicate request/retry
- partial DB failure/transaction behavior

---

## Task 4.7 — Integrate Execution Roadmap with Planner tasks

### Working-tree bridge (2026-08-23)

The canonical planner now consumes the current, schema-validated F8
`report_v2` before an F7 roadmap fallback. F8 mapping is deterministic:

- `phaseKey` becomes the canonical phase identity;
- one phase deliverables step contains micro-steps keyed by
  `phaseKey` + `deliverable.key`;
- `keyActions` remain phase guidance on that step and `successCriteria` become
  its deliverable checklist.

This deliberately does not assign a prose key action to a particular
deliverable: the F8 schema does not state that relationship, and inventing one
would make reconciliation misleading. The stable deliverable keys let
`reconcilePlan` update the same canonical micro-step while preserving
student-owned progress, deadline, submitted content, and evidence. The legacy
F7 roadmap remains an explicit compatibility fallback.

Planner context adds only observed data to generated planning text: current
F5 prompt/engine data, stored application deadlines, requirement IDs/titles,
explicit profile preferences, and explicitly answered
`planner.availability` or `planner.time_capacity` inputs. No availability or
time capacity is inferred when such an answer is absent, and generated
planning never writes the execution-owned deadline column.

Those two inputs now have canonical producers: deterministic phase, step, and
micro-step IDs with declared `long_text` semantic keys. The mapper emits only
the keys still missing an explicit non-blank answer. The source loader consumes
only those exact declared values as `user_provided`; a qualifying long-text save
triggers the existing sync flow. A second reconciliation preserves an answered
input's node and `content_value` while generated payloads omit that user-owned
value, so it neither disappears nor duplicates. A canonical plan from before
this contract is upgraded only when an unanswered input node is absent.

Measured after this bridge: focused report/planner regression suite 77/77,
`npm run typecheck`, and changed-file ESLint all passed. A live F8 generation
and signed-in planner sync still need verification after the listed migrations
are applied.

### File

- `roadmap-tasks/route.ts` or current canonical route/service

### Route/service contract

- authenticated user
- owned application
- latest valid F8 report
- idempotent reconciliation
- structured response: created / updated / unchanged / retired counts if current API style allows
- structured telemetry

### Tool/deep-link mapping

Connect roadmap deliverables only to tools that actually exist and are safe to route to in the current product, such as:

- Personal Canvas
- CV Builder
- Statement Writer
- supported GenUI blocks

Do not fabricate routes for unfinished/gated products. Where CV/Essay systems are still intentionally split/gated, link only to the currently canonical route defined by the route audit.

### Tests

- no duplicate tasks on retry
- correct application scoping
- completed task preserved
- user edits preserved
- missing/invalid F8 report rejected cleanly
- deep links resolve to canonical routes

---

# Cross-cutting implementation rules

## A. TDD execution order per task

For each behavior-changing task:

1. write/extend characterization test if current behavior is important
2. add failing test for new behavior
3. implement smallest change
4. run focused test
5. run adjacent package/feature tests
6. typecheck
7. only then move to next task

Avoid combining schema migration, behavior refactor, and UI redesign in one untestable commit.

## B. Schema changes

Any DB/schema change requires:

- migration file
- backward-compatible rollout plan where needed
- RLS review
- indexes/constraints review
- generated TypeScript types update if the repo uses generated Supabase types
- read-before-write compatibility if old rows may exist
- migration verification against the target environment

## C. AI structured output

Every AI-generated report payload must have:

- prompt version
- schema validation
- bounded/retryable failure handling
- evidence-grounding constraints
- no deterministic score calculation delegated to AI

## D. Error model

Keep these distinct throughout APIs and UI:

- `needs_inputs` / 422
- `rate_limited` / 429
- upstream/service unavailable / 503
- internal persistence failure / 500
- malformed generated payload / classified generation failure

## E. Accessibility and i18n

When new labels/badges/sections are introduced:

- add/update i18n keys
- do not embed inaccessible meaning only in color
- retain keyboard/focus behavior in modals/editable grids
- provide labels for save states and interactive controls

---

# Execution waves and hard gates

## Wave 1 — Part 0

### 0.1 Observability
### 0.2 Instrument generation entry points
### 0.3 Verify live migration state
### 0.4 Verify cascade delete

**Gate to continue:** required production/staging schema state is known; observability is usable on subsequent migrations/generation work.

---

## Wave 2A — Part 1 (can run in parallel with Wave 2B)

### 1.1 Personal reflection single-page
### 1.2 Activity/achievement reflection single-page
### 1.3 `reflection-evidence-form` decomposition
### 1.4 systemic `?return=` fix
### 1.5 onboarding guard consistency
### 1.6 downstream failure recovery

**Gate:** reflection data persists correctly and navigation returns to the correct application context.

---

## Wave 2B — Part 2 (can run in parallel with Part 1 after Part 0)

### 2.1 Canonical strategy input contract
### 2.2 Strategy generator migration
### 2.3 Strategy route + cache/source lineage
### 2.4 readiness migration
### 2.5 legacy caller removal/deprecation
### 2.6 invariant regression tests

**Gate to Part 4:** Strategy generation has zero runtime dependency on `applicant_analyses`.

---

## Wave 3 — Part 3

### 3.1 F5 contract + enum propagation
### 3.2 deterministic F5 engine
### 3.3 Matching Report DTO/schema
### 3.4 generation/persistence pipeline
### 3.5 six-section UI

**Gate to Part 4:** a target application can produce and render a persisted/cached F5 Matching Report end-to-end.

---

## Wave 4 — Part 4

### 4.1 F8 report schema
### 4.2 F8 structured generation/persistence
### 4.3 student override model
### 4.4 GenUI vocabulary
### 4.5 five-section Strategy Report UI
### 4.6 deterministic/lossless `reconcileSeeds`
### 4.7 Planner roadmap integration

**Gate:** regeneration preserves user edits and Planner progress, and repeated roadmap sync creates no duplicates.

---

# Verification plan

## Focused automated tests

Run focused tests after each task, then the relevant suites:

```bash
npx vitest run src/server/observability
npx vitest run src/shared/evaluation
npx vitest run src/features/apply
npx vitest run src/features/ai-strategy-dashboard
```

Also run route/service-specific tests added during Parts 2–4.

## Static verification

Use the commands that actually exist in `package.json`; expected checks include:

```bash
npm run typecheck
npm run typecheck:strict
npm run lint
node scripts/check-i18n.mjs --all
npm run build
```

If a listed command does not exist, use the repository's canonical equivalent rather than adding a duplicate script solely for this plan.

## Repository-wide regression searches

Before declaring complete:

```bash
rg "applicant_analyses|applicant-analysis" src
rg "strong_match" src
rg "ProgrammeFitClassification|programmeFitSchema|fitDimensionSchema" src
rg "source_analysis_id" .
rg "console\.(log|error|warn)" src/server src/app/api
```

Expected outcome:

- no live Strategy dependency on `applicant_analyses`
- every `strong_match` exhaustive consumer is handled
- source FK semantics are unambiguous
- generation routes use structured observability where intended

---

# End-to-end manual acceptance matrix

Test with dedicated fixtures/accounts rather than one happy-path profile.

## Scenario A — Complete strong profile

Profile Review → Activities/Achievements reflection → Personal reflection → Review & Confirm → Personal Report → Matching Report → Strategy Report → Planner sync.

Verify:

- decimal F5 scores render correctly
- Match Score label is honest
- correct academic classification
- F8 priorities are editable
- Planner tasks created once

## Scenario B — Hard eligibility failure

Verify:

- classification is `currently_ineligible`
- high other scores do not override it
- report explains the failed criterion without presenting admission probability

## Scenario C — Missing non-academic dimensions

Verify:

- missing values show as unknown/unassessed
- weighted score renormalises
- no zero substitution

## Scenario D — Missing academic assessment

Verify:

- no false Safety/Strong Match/Match/Reach label
- canonical insufficient-data state is shown

## Scenario E — Downstream AI failure

Verify:

- prerequisite completion remains intact
- retryable 429/503 state appears
- existing portal/report access is preserved where valid

## Scenario F — Strategy regeneration after student edits

1. edit priority rows
2. complete and edit several Planner tasks
3. change source profile/matching inputs
4. regenerate F8
5. sync roadmap again

Verify:

- student priority edits remain
- completed tasks remain completed
- manually edited tasks are not overwritten
- new tasks are added once
- retired recommendations do not destroy user work

## Scenario G — Delete application

Verify:

- all intended direct/secondary application-owned data is removed
- intentional `SET NULL` records remain correctly detached
- no orphaned report/task rows remain

---

# Definition of Done — Parts 0–4

Parts 0–4 are complete only when all of the following are true:

- [ ] Structured observability is live on all canonical generation entry points.
- [ ] Live migration state is verified, not assumed from repository SQL files.
- [ ] Application cascade delete is proven with a real populated fixture.
- [ ] Personal and per-achievement reflections work as single-page review/edit flows without data loss.
- [ ] `?return=` threading works systemically and cannot be used as an external open redirect.
- [ ] Downstream generation failures are retryable/non-blocking where appropriate.
- [ ] Strategy generation no longer depends on `applicant_analyses`.
- [ ] Strategy source lineage uses semantically correct FKs/columns.
- [ ] F5 weighted scoring is deterministic, decimal-capable, and fully tested.
- [ ] Missing dimensions renormalise weights without becoming zero.
- [ ] Hard eligibility failures override competitiveness classification.
- [ ] `strong_match` is propagated through every schema/UI/i18n consumer if confirmed by the canonical spec.
- [ ] Matching Report has one validated read model and all six canonical sections.
- [ ] F5 deterministic values are never delegated to AI.
- [ ] F8 has a validated, versioned, idempotent generation pipeline — not only a UI.
- [ ] Strategy Report renders all five canonical sections.
- [ ] Student-editable priorities use persistent overrides that survive regeneration.
- [ ] New GenUI blocks have schema + renderer + read validation + backward compatibility.
- [ ] `reconcileSeeds` is idempotent and preserves completed/user-edited Planner state.
- [ ] Roadmap sync creates no duplicate tasks on retry/regeneration.
- [ ] No report labels match score as admission probability/chance.
- [ ] Focused Vitest suites pass.
- [ ] Typecheck/strict typecheck pass using repository commands.
- [ ] Lint and i18n checks pass.
- [ ] Production build passes.
- [ ] End-to-end acceptance scenarios A–G pass.
