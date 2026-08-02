# Design Document: AI Strategy Dashboard

## Overview

This feature completes the three unbuilt steps of the five-stage AI journey (`report`, `university`, `strategy`) with a shared onboarding pass (Personal Summary + Achievements, extending what `/ai-strategy/reflection` already does) feeding two AI reports (Applicant Analysis, Course Match Analysis) and a persistent Dashboard (dynamic categories, a prioritised recommendation table, per-recommendation AI coaching, progress tracking and evidence-triggered re-analysis).

The design is shaped by five constraints found in the existing codebase:

1. **`main` already has more of this built than either in-flight strategy branch.** `student_profiles`, `student_achievements`/`student_activities` (with file evidence), `/ai-strategy/reflection/*`, `match-insights.ts` (weighted-pillar scoring), `application_match_analyses` and `application_recommendations` are all real, merged code. This feature extends them; it does not re-implement them.
2. **`feat/strategy-1..4-cv-review` is real but incompatible by design.** Its `.kiro/specs/ai-application-strategy/requirements.md` explicitly excludes a dashboard, a score, a persona. Rather than merge or rebase onto it, this feature branches from `main` and treats the CV/Statement workspace as a Dashboard category to integrate later (Requirement 9.6).
3. **`/ai-strategy` ships its own chrome.** Same constraint Feature 2 already documented: `nav-reveal.tsx` suppresses the app shell for this subtree, so every new page wraps itself in `reflection-chrome.tsx`'s chrome (generalised, not forked, exactly as Feature 2's design.md already planned — this feature reuses that generalisation once it exists, or generalises it itself if it lands first).
4. **AI output is JSON-mode plus manual coercion.** Same convention as `match-insights.ts`/`extract-course.ts`: an explicit JSON schema in the request, hand-written normalisation, zod reserved for HTTP request bodies.
5. **Versions and explicit triggers decide staleness, not timestamps.** `application_match_analyses.profile_version` already exists; this feature's re-analysis trigger (Requirement 14) compares the same kind of version counters rather than wall-clock time.

## Architecture

```
src/features/ai-strategy-dashboard/          ← new feature module
  domain/                                     ← pure logic, no I/O
    index.ts
    applicant-analysis.ts     ApplicantAnalysis type, section catalogue
    course-match.ts           CourseMatchAnalysis type, extends PillarBreakdown
    recommendation.ts         Recommendation type, PROGRESS_STATUS (5 values), sort/group helpers
    strategy-category.ts      StrategyCategory type, the seeded initial category set
    coach.ts                  CoachThread/CoachMessage types, the 4 seed intents
    staleness.ts              version-based re-analysis trigger predicate
    types.ts                  view-model types shared by ui/
  api/                                        ← server-only data access
    index.ts
    strategy-dashboard-repository.ts   read/write the extended + new tables
    reanalysis-trigger.ts     enqueues Continuous_Optimisation (Requirement 14.4)
  ui/                                         ← client components
    index.ts
    strategy-home.tsx         Requirement 2
    personal-summary-form.tsx Requirement 3 (extends reflection-about-form.tsx's fields)
    achievements-form.tsx     Requirement 4 (extends reflection-evidence-form.tsx's categories)
    analysis-loading.tsx      Requirement 5
    applicant-analysis-report.tsx   Requirement 6
    course-match-report.tsx   Requirement 7
    strategy-intro.tsx        Requirement 8
    dashboard-summary.tsx     Requirement 9.1 top summary
    strategy-category-board.tsx     Requirement 9.2-9.6
    recommendation-table.tsx  Requirement 10
    recommendation-detail.tsx Requirement 11
    ai-coach-panel.tsx        Requirement 12 (new chat primitive)
    progress-status-control.tsx     Requirement 13
    evidence-upload.tsx       Requirement 14 (wraps existing FileDropzone)
    strategy-switcher.tsx     Requirement 15.3
  hooks/
    use-strategy-onboarding-state.ts   which of the first-time steps remain
    use-reanalysis-status.ts           polls the re-analysis job, Requirement 14.4

src/lib/ai/strategy-dashboard/                ← model calls, plain OpenAI JSON-mode
  applicant-analysis.ts       Requirement 6.2
  course-match-extend.ts      Requirement 7.2, wraps match-insights' pillar call
  recommendation-generator.ts Requirement 9.3, 10 — turns pillars + analyses into Recommendation rows
  coach-reply.ts               Requirement 12.2
  prompts.ts                   shared context renderer (profile + achievements + course)

src/app/ai-strategy/[applicationId]/
  strategy/page.tsx            Strategy Home (Requirement 2) — only for first-time onboarding
  strategy/personal-summary/page.tsx
  strategy/achievements/page.tsx
  strategy/analysis/page.tsx           loading + report split, Requirements 5-7
  strategy/intro/page.tsx              Requirement 8
  strategy/dashboard/page.tsx          Requirement 9, the return-visit landing page
  strategy/recommendations/[recommendationId]/page.tsx   Requirement 11

src/app/api/applications/[id]/
  strategy/applicant-analysis/route.ts     GET latest / POST generate
  strategy/course-match/route.ts           GET latest / POST generate (extends existing match-insights route, does not replace it)
  strategy/recommendations/route.ts        GET list / POST generate
  strategy/recommendations/[recId]/route.ts  PATCH status
  strategy/recommendations/[recId]/coach/route.ts  GET thread / POST message
  strategy/recommendations/[recId]/evidence/route.ts  POST upload, triggers Requirement 14.3

supabase-strategy-dashboard.sql               ← flat root migration, this session's scope
```

The `src/features/*` FSD boundary rules apply: `ui` does not import `api`; `app/` routes read through `api/` and pass plain data into `ui/`. `shared/*` stays free of this feature's concepts.

## Data models (this session — Phase 0/1 scope)

`supabase-strategy-dashboard.sql`, additive only, no `DROP`/destructive `ALTER`:

```sql
-- New: the candidate-portrait report (Requirement 6, 16.1)
CREATE TABLE IF NOT EXISTS applicant_analyses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           UUID NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_version           INT NOT NULL,
  personality_summary       TEXT,
  learning_style             TEXT[],
  academic_strengths        TEXT[],
  growth_areas               TEXT[],
  motivation_analysis        TEXT,
  competitive_advantages    TEXT[],
  suggested_positioning      TEXT,
  overall_rating             INT CHECK (overall_rating BETWEEN 0 AND 100),
  inputs_present             JSONB DEFAULT '{}'::JSONB,
  model_name                 TEXT,
  prompt_version             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New: AI Coach (Requirement 12, 16.4)
CREATE TABLE IF NOT EXISTS strategy_coach_threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES application_recommendations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_coach_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES strategy_coach_threads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend: Progress Tracker + recommendation shape (Requirement 10.4, 13, 16.3)
ALTER TABLE application_recommendations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_review', 'blocked')),
  ADD COLUMN IF NOT EXISTS estimated_effort  TEXT,
  ADD COLUMN IF NOT EXISTS deadline           DATE,
  ADD COLUMN IF NOT EXISTS evidence_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category           TEXT,
  ADD COLUMN IF NOT EXISTS related_requirement TEXT;

-- Extend: Evidence Upload (Requirement 14.2)
ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS recommendation_id UUID
    REFERENCES application_recommendations(id) ON DELETE SET NULL;

-- Extend: Achievements employment category (Requirement 4.4)
-- student_activities.category CHECK is redefined to add 'employment' to the
-- existing (community_project, leadership, innovation, personal_growth, mentoring, other) set.
```

`application_match_analyses` (Requirement 7.3) already has `current_match_score`, `max_possible_match_score`, `academic_score`/`english_score`/`experience_score`/`document_score`/`fit_score`, `strengths`, `weaknesses`, `improvement_actions` — sufficient for Course Match Analysis's numeric surface without a migration. The report's new named sub-sections (Entry Requirement Match, Experience Match, Personal Qualities Match, Missing Areas, Admissions Risk, Admissions Confidence) are computed/rendered from these existing columns plus the `match-insights` pillar breakdown already returned by the AI call — Phase 3 (see tasks.md) formalises this as a typed reshaping layer in `domain/course-match.ts`, not a schema change.

RLS: every new table gets one `<table>_owner` policy (`auth.uid() = user_id`), wrapped in the repo's `DO $$ ... pg_policies ... $$` guard, and an index on `(user_id)` plus its natural FK lookup column — same pattern as `supabase-reflection.sql` and `supabase-application-strategy.sql`.

## Components and interfaces

### Onboarding vs. Dashboard split

`use-strategy-onboarding-state.ts` decides, server-side, which of Strategy Home / Personal Summary / Achievements / AI Analysis / AI Strategy Introduction remain for this Strategy (Requirement 1.2-1.3): Personal Summary and Achievements are "done" the moment `student_profiles`/`student_achievements` have the minimum required fields (shared across Strategies, per Requirement 15.2); AI Analysis and Intro are "done" once this specific Strategy has an `applicant_analyses` row. A brand-new second Strategy (Requirement 15.4) therefore always skips straight to AI Analysis.

### Progress indicators

Reuses Feature 2's planned pattern rather than inventing a third: the global `Stepper` (via `aiJourneySteps()`) stays the top-level indicator across `report`/`university`/`strategy`; a compact step indicator ("Step 1 of 4") sits beneath it during onboarding only, matching the "Progress: Step 1 of 4" callout in Requirement 3.1. The Dashboard itself uses `ProgressBar` for Overall Progress / Completion %, not a second full stepper.

### Recommendation table and detail

`recommendation-table.tsx` groups rows by `category`, sorts by `priority` within a category, and renders `status` as text + icon (Requirement 13.3). Opening a row navigates to `strategy/recommendations/[recommendationId]`, which composes `recommendation-detail.tsx` + `ai-coach-panel.tsx` + `progress-status-control.tsx` + `evidence-upload.tsx` — four independent panels, not one monolithic page component, so each can be built and tested in its own task (see tasks.md Phase 5).

### AI Coach

No chat primitive exists anywhere in `shared/ui` today. `ai-coach-panel.tsx` is a new, minimal thread view (message list + composer), scoped to one Recommendation, non-streaming for Phase 0 (single JSON-mode reply per turn, matching Open decision 3) with streaming explicitly deferred rather than adopting the competing branch's DeepSeek SSE pattern. Any AI reply that would modify the student's own data flows through the existing `SuggestionCard` pattern once Feature 2 lands it — until then, AI Coach in this feature is read-only conversation (Requirement 12.4 is a forward-compatibility rule, not a Phase 0 obligation).

### Evidence upload and re-analysis

`evidence-upload.tsx` wraps the existing `FileDropzone`/`DocumentRow` primitives (built for course-document upload) rather than introducing new upload UI. `reanalysis-trigger.ts` writes a job row using the same shape `retry-parse`/`parse-status` already use, and `use-reanalysis-status.ts` polls it the same way the course-parser progress cues already do — one polling convention for the whole app, not two.

## API design

All routes follow the existing `src/app/api/applications/[id]/*` convention: session check → ownership check (`course_applications.user_id = auth.uid()`) → zod-parsed body where applicable → JSON-mode AI call with manual normalisation → persist → return plain JSON. No new ownership-guard abstraction is introduced in Phase 0 (Feature 2's planned `application-owner.ts` guard, if it lands first, should be reused here rather than duplicated — tracked as a follow-up, not blocking).

## Build order (maps to tasks.md phases)

1. **Phase 0 — Decisions.** Resolve the four open decisions in requirements.md.
2. **Phase 1 — Foundation.** `supabase-strategy-dashboard.sql`, RLS, indexes; `domain/` types (pure, no I/O); `docs/README.md` cross-link. *(This session's deliverable.)*
3. **Phase 2 — Onboarding UI.** Strategy Home, Personal Summary field extensions, Achievements employment category, routing/skip logic.
4. **Phase 3 — AI Analysis.** Applicant Analysis AI call + report page; Course Match Analysis extension + report page.
5. **Phase 4 — Dashboard.** Top summary, category board, recommendation generator + table.
6. **Phase 5 — Recommendation workspace.** Detail page, Progress Tracker, Evidence Upload, re-analysis trigger.
7. **Phase 6 — AI Coach.** Threads, messages, panel UI.
8. **Phase 7 — Multiple Strategies + completion.** Strategy switcher, cross-Strategy sharing verification, end-to-end pass.

Phases 3–4 (analysis + dashboard) depend on Phase 2's data existing but are otherwise independent of Phase 6 (Coach), so 3–4 and 6 can proceed in parallel once Phase 2 lands, same parallelisation shape Feature 2 used for its CV/Statement split.
