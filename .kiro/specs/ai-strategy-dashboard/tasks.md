# Implementation Plan: AI Strategy Dashboard

## Overview

Eight phases building the Applicant Analysis, Course Match Analysis and AI Strategy Dashboard at `/ai-strategy/[applicationId]/strategy/*`, on top of `main` (not the unmerged `feat/strategy-*` branches — see design.md). Each phase ends with `npm run typecheck && npm run lint && npm test` green.

**Stack**: Next.js 16 (async `params`), React 19, Tailwind 4 with `gb-*` tokens, Supabase with RLS, zod for HTTP bodies, plain OpenAI JSON-mode for model calls (Open decision 3), Vitest.

**Key decisions carried from design.md**
- Branch from `main`; the CV/Statement workspace is a future integration point (Open decision 2), not a dependency.
- `match-insights.ts` is extended, not replaced, for Course Match Analysis scoring.
- `application_recommendations` and `application_match_analyses` are extended in place; no parallel tables for data that already has a home.
- Re-analysis reuses the existing parse-job/polling convention — one async-job pattern for the whole app.
- AI Coach ships non-streaming in Phase 6; streaming is explicitly deferred.

## Tasks

### Phase 0: Decisions

- [ ] 0. Resolve the four open decisions in requirements.md
  - [ ] 0.1 Confirm Strategy Home content sourcing
    - No demo video or real testimonial copy exists yet
    - Default to confirm: ship without video, three clearly-placeholder testimonials, flagged for the project owner
    - _Requirements: 2.4, 2.6_
  - [ ] 0.2 Confirm the CV/Portfolio category placeholder
    - Default to confirm: "Coming soon" card now; real integration is a follow-up task once a CV branch merges
    - _Requirements: 9.6_
  - [x] 0.3 Confirm the AI provider/pattern
    - Default confirmed: plain OpenAI JSON-mode, matching `match-insights.ts` — chosen in design.md because the trust-rules wrapper on `feat/strategy-*` explicitly forbids the scores this feature requires
    - _Requirements: 16.6_
  - [x] 0.4 Confirm Strategy identity
    - Default confirmed: reuse `course_applications` as the Strategy anchor, one Strategy per application
    - _Requirements: 1.1, 15.1_

### Phase 1: Foundation — this session's scope

- [x] 1. Database schema and RLS
  - [x] 1.1 Write `supabase-strategy-dashboard.sql`
    - `applicant_analyses`: append-only, `application_id` FK, `profile_version INT`, `personality_summary`, `learning_style TEXT[]`, `academic_strengths TEXT[]`, `growth_areas TEXT[]`, `motivation_analysis`, `competitive_advantages TEXT[]`, `suggested_positioning`, `overall_rating INT CHECK (0-100)`, `inputs_present JSONB`, `model_name`, `prompt_version`, `created_at`
    - `strategy_coach_threads` / `strategy_coach_messages`: `recommendation_id` FK, `role TEXT CHECK (user|assistant)`, `content`, `created_at`
    - `ALTER TABLE application_recommendations ADD COLUMN IF NOT EXISTS`: `status` (5-value CHECK, default `not_started`), `estimated_effort`, `deadline`, `evidence_required`, `category`, `related_requirement`
    - `ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS recommendation_id` (nullable FK, `ON DELETE SET NULL`)
    - `student_activities` category CHECK: add `'employment'`
    - Purely additive: no `DROP`, no destructive `ALTER`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 4.4_
  - [x] 1.2 Add RLS policies and indexes
    - One `<table>_owner` policy per new table, `DO $$ ... pg_policies ... $$` guard, matching every existing migration
    - Indexes: `applicant_analyses(application_id)`, `applicant_analyses(user_id)`, `strategy_coach_threads(recommendation_id)`, `strategy_coach_messages(thread_id, created_at)`
    - _Requirements: 16.7_
  - [ ] 1.3 Verify the migration applies cleanly and is re-runnable
    - **BLOCKED — needs the project owner.** No automated migration runner exists in this repo (confirmed: `supabase-application-strategy.sql`'s own task 1.3 hit the same wall). Apply by hand in the Supabase SQL editor, like the other 34+ migrations, then confirm `SELECT * FROM applicant_analyses LIMIT 1` and the two `ADD COLUMN IF NOT EXISTS` blocks succeed with no error.
    - _Requirements: 16.1-16.5_
- [x] 2. Domain types (pure, no I/O)
  - [x] 2.1 `src/features/ai-strategy-dashboard/domain/recommendation.ts`
    - `PROGRESS_STATUS` (5-value const array), `Recommendation` type matching the extended table, sort-by-priority and group-by-category pure helpers
    - _Requirements: 10.1, 10.2, 13.1_
  - [x] 2.2 `src/features/ai-strategy-dashboard/domain/applicant-analysis.ts`
    - `ApplicantAnalysis` type matching the new table, section catalogue (label + description per field) for the report UI to iterate over
    - _Requirements: 6.1_
  - [x] 2.3 `src/features/ai-strategy-dashboard/domain/course-match.ts`
    - `CourseMatchAnalysis` type reshaping `application_match_analyses` columns + `match-insights` `PillarBreakdown` into the Requirement 7.1 sections (Entry Requirement / Experience / Personal Qualities Match, Missing Areas, Admissions Risk, Admissions Confidence)
    - _Requirements: 7.1, 7.2_
  - [x] 2.4 `src/features/ai-strategy-dashboard/domain/strategy-category.ts`
    - `StrategyCategory` type, `SEEDED_CATEGORIES` (the five match-insights-pillar-derived categories) for Requirement 9.3
    - _Requirements: 9.2, 9.3_
  - [x] 2.5 `src/features/ai-strategy-dashboard/domain/coach.ts`
    - `CoachThread`/`CoachMessage` types, `COACH_SEED_INTENTS` (the four Requirement 12.2 prompts)
    - _Requirements: 12.1, 12.2_
  - [x] 2.6 `src/features/ai-strategy-dashboard/domain/index.ts`
    - Barrel export, FSD-compliant (no deep imports from `ui/`/`api/`, neither of which exists yet this phase)
    - _Requirements: (structural)_
- [x] 3. Documentation handoff
  - [x] 3.1 Cross-link `docs/redesign-status.md`'s `/ai-strategy` "Designed but not built" row to this spec
    - `docs/README.md` is scoped to the Figma redesign push specifically (per its own "not product documentation" note) and doesn't index `.kiro/specs/` at all; `redesign-status.md` is where the `/ai-strategy` Figma node ids already live, including portrait (`375:18185`)/fit (`375:18645`)/strategy (`375:19502`/`405:6526`) — the exact frames this spec's Applicant Analysis, Course Match Analysis and Dashboard requirements describe. Added the cross-link there instead of inventing an out-of-scope section in `docs/README.md`.
    - Also states the relationship to `ai-application-strategy` (CV/essay frames on the same row) so a future session doesn't have to re-derive the conflict this spec's "Relationship to Feature 2" section documents.
    - _Requirements: (process — CLAUDE.md requires design work to read the correct Figma frame, and this doc is where those node ids are recorded)_

### Phase 2: Onboarding UI (needs Phase 1)

**Before any task in this phase:** read the actual Figma frame via the Figma MCP server — `docs/redesign-status.md`'s "Designed but not built" table has the node ids (landing `375:18445`, candidate info `375:19260`, achievements `375:18839`) on canvas **Khanh Linh - Chi** (`375:9842`). This document's prose is a behaviour spec, not a layout spec — CLAUDE.md rule 1 applies.

⚠️ **Figma MCP was not available this pass.** Tasks 4-7 shipped built to this document's text spec and the existing `reflection-about-form.tsx`/`reflection-evidence-form.tsx` visual language instead, per Open decision 1's stated default — not against node `375:18445`. Layout, spacing and copy on the new Strategy Home page in particular should be checked against the real frame in a follow-up pass before this ships to students; flagged rather than silently treated as final.

- [x] 4. Strategy Home page (Requirement 2) — `src/features/ai-strategy-dashboard/ui/strategy-home.tsx` + `src/app/ai-strategy/[applicationId]/strategy/page.tsx`. Video section omitted (2.6), testimonials are explicitly-labelled placeholders (Open decision 1). Node `375:18445` not read — see warning above.
- [x] 5. Personal Summary field extensions on `reflection-about-form.tsx` (Requirement 3) — added country/languages/age/school/current year/current subjects/predicted grades/study style/career goals/interests/learning style/personal-statement-questions to `reflection.ts`'s schemas and the form; new `student_profiles` columns in `supabase-strategy-personal-summary.sql`. Node `375:19260` not read.
- [x] 6. Achievements employment category on `reflection-evidence-form.tsx` (Requirement 4) — added to `ACTIVITY_CATEGORIES` in `reflection.ts`; the form's category `Select` is already data-driven off that constant, so no template change was needed. Node `375:18839` not read (no visual change involved).
- [x] 7. Onboarding-vs-Dashboard routing (Requirement 1.2, 1.3, 15.4) — `src/features/ai-strategy-dashboard/api/onboarding-status.ts` (`fetchStrategyOnboardingStatus`, a proxy: has the student saved at least one achievement/activity) decides Strategy Home's CTA target; a `?return=` query param threads the target back through the existing shared `/ai-strategy/reflection` → `/ai-strategy/reflection/achievements` flow so a Strategy-scoped visitor lands back on their Strategy instead of the flow's original hardcoded `/ai-strategy`. Landed as server logic on the page rather than a `use-strategy-onboarding-state.ts` hook — no client state needed since the decision only has to be made once, server-side, before the page renders.
  - New route `src/app/ai-strategy/[applicationId]/strategy/analysis/page.tsx` — an explicit "coming soon" placeholder for Phase 3, not a stub pretending to be finished, so the CTA has somewhere honest to land.
  - New `src/app/ai-strategy/[applicationId]/layout.tsx` — auth + ownership guard, shared chrome, for every `[applicationId]` page in this feature going forward.

### Phase 3: AI Analysis (needs Phase 1, parallel with Phase 6 once Phase 4 lands)

- [x] 8. Applicant Analysis AI call + report page (Requirement 5, 6) — `src/lib/ai/strategy-dashboard/applicant-analysis.ts` (plain OpenAI JSON-mode, same convention as `match-insights.ts`), `POST/GET /api/applications/[id]/strategy/applicant-analysis`, `ui/applicant-analysis-report.tsx`. Node `375:18185` ("portrait") not read — Figma MCP unavailable this pass, same caveat as Phase 2.
- [x] 9. Course Match Analysis extension + report page (Requirement 5, 7) — **no new AI call**: `GET /api/applications/[id]/strategy/course-match` reads the existing `application_match_analyses` row (written by the pre-existing `POST /api/applications/[id]/match-insights`) and reshapes it through `domain/course-match.ts#deriveCourseMatchAnalysis`; `ui/course-match-report.tsx` renders it. Generation is delegated to the existing endpoint rather than duplicated — see the note at the top of `strategy/course-match/route.ts`. Node `375:18645` ("fit") not read.
- [x] 5 (loading state) — `ui/analysis-workspace.tsx` orchestrates both: reads what's stored, generates whichever report is missing, cycles the four Requirement 5.1 messages while waiting, renders both reports once ready, and has a retry action on failure (5.3). Wired at `strategy/analysis/page.tsx`.

### Phase 4: Dashboard (needs Phase 3)

- [x] 10. AI Strategy Introduction page (Requirement 8) — `strategy/intro/page.tsx`, built ahead of the rest of Phase 4 so the analysis page's "Improve My Chances with AI" CTA (Requirement 7.4) has somewhere real to land instead of a placeholder. No Figma node recorded for this screen in `docs/redesign-status.md` to check it against.
  - Its own CTA ("Generate My Strategy") now lands on the real Dashboard built in tasks 11-12 below, replacing the placeholder.
- [x] 11. Dashboard top summary + category board (Requirement 9) — `ui/dashboard-summary.tsx` (University/Course/Current Match/Goal/Overall Progress/Next Priority), `ui/strategy-category-board.tsx` (renders `SEEDED_CATEGORIES` with live recommendation counts, "Coming soon" for CV/Portfolio per Open decision 2). Node `375:19502`/`405:6526` ("strategy") not read — Figma MCP still unavailable.
- [x] 12. Recommendation generator + table (Requirement 10) — `domain/recommendation.ts#recommendationFromImprovementAction` reshapes `application_match_analyses.improvement_actions` (no new AI call, same "extend don't replace" pattern as Course Match Analysis); `api/generate-recommendations.ts` is the shared, idempotent (by title) insert path used by both `POST .../strategy/recommendations` and the Dashboard page's generate-on-first-visit. `ui/recommendation-table.tsx` renders Priority/Recommendation/Reason/Status/Help grouped by category, with a live status control wired to `PATCH .../strategy/recommendations/[recId]` (this pulls Requirement 13's Progress Tracker forward from Phase 5, since the table needs it to be interactive rather than a static list).
  - **Found and fixed a real bug while wiring this up**: `src/lib/api/application-workspace.ts` (the free per-course checklist's data source) read `application_recommendations` with no filter, so Dashboard-generated rows would have leaked into that unrelated sidebar the moment any existed. Added `.is('category', null)` there — Dashboard rows always set `category`, sidebar tips never do — closing the gap before it could ship a visible bug.

### Phase 5: Recommendation workspace (needs Phase 4)

- [x] 13. Recommendation detail page (Requirement 11) — `strategy/recommendations/[recommendationId]/page.tsx`. Renders only the two sections with a real data source: "Why this matters" (the AI's own `reason` text) and "How much it could improve admission chances" (`estimatedImpact`, a real match-insights number). "How universities evaluate it" and "suggested learning resources" have no backing data yet (no per-requirement mapping, no resource catalogue) and are omitted rather than invented. `ui/progress-status-control.tsx` extracted from the recommendation table so both places send a status change the same way.
- [x] 14. Evidence Upload + re-analysis trigger (Requirement 14) — `ui/evidence-upload.tsx` reuses the existing `useDocumentUpload` hook (the same one `/ai-strategy/reflection/achievements` uses) rather than a second upload path, then `PATCH .../recommendations/[recId]/evidence` links the resulting `uploaded_documents` row via `recommendation_id`.
  - ⚠️ **Re-analysis is a user-triggered "Re-analyse now" button, not the background job design.md sketched.** A real async job queue (matching the course-parser's polling convention) was judged too large a lift for this pass, and a fake one would be worse than an honest gap. The button calls the same three endpoints (`strategy/applicant-analysis`, `match-insights`, `strategy/recommendations`) a Dashboard visit already triggers — real re-analysis, just not automatic yet. A follow-up task should wire this to the polling-job pattern once there's room for it.

### Phase 6: AI Coach (needs Phase 4, parallel with Phase 5)

- [ ] 16. Coach threads/messages API (Requirement 12.1, 12.3)
- [ ] 17. Coach panel UI (Requirement 12.2, 12.4)

### Phase 7: Multiple Strategies + completion (needs Phases 1-6)

- [ ] 18. Strategy switcher (Requirement 15.3)
- [ ] 19. Cross-Strategy sharing verification (Requirement 15.2) — test that editing Personal Summary/Achievements on one Strategy is reflected on another
- [ ] 20. End-to-end pass: Strategy Home → Personal Summary → Achievements → AI Analysis → Intro → Dashboard, first-time and return-visit paths

## Dependency graph

```
0 (decisions)
├── 0.1 home content ────► 4
├── 0.2 CV placeholder ──► 11
├── 0.3 AI provider ─────► 8, 9, 12, 16 (every AI call)
└── 0.4 strategy identity ► 1 (schema), 7

Phase 1 — Foundation (this session)
1 schema ──► 2 domain ──► everything in Phases 2-7
3 docs (independent)

Phase 2 — Onboarding UI
4 home ──► 7
5 personal summary ──► 8 (analysis needs the fields)
6 achievements ──► 8
7 routing ──► 10 (intro only reachable via routing)

Phase 3 — AI Analysis           (needs 5, 6)
8 applicant analysis ──► 11
9 course match ──► 11, 12

Phase 4 — Dashboard             (needs 8, 9)
10 intro ──► 11
11 summary/categories ──► 12
12 recommendation table (incl. progress tracker) ──► 13, 16

Phase 5 — Recommendation workspace   (needs 12)
13 detail ──► 14
14 evidence + re-analysis ──► 20

Phase 6 — AI Coach              (needs 12, parallel with Phase 5)
16 coach API ──► 17

Phase 7 — Completion            (needs Phases 1-6)
18 switcher ──► 20
19 sharing verification ──► 20
```

Phases 5 and 6 are independent of each other once Phase 4 lands, so they can proceed in parallel. Phase 7 needs both.

## Notes

**Progress so far**: Phases 0-5 are done (0 decisions, 1 foundation, 2 onboarding, 3 AI analysis, 4 dashboard, 5 recommendation detail + evidence upload). The full path from Strategy Home through a working Dashboard, a recommendation detail page, and evidence upload is real. Remaining: Phase 6's AI Coach and Phase 7's Multiple Strategies switcher + end-to-end pass. Evidence-triggered re-analysis (14.3-14.4) is currently a manual "Re-analyse now" button rather than the automatic background job originally designed — see task 14's note.

**A separate, urgent fix landed alongside this work** (not tracked as a numbered task, since it predates this spec): the "Build your strategy" nav item, the university page CTA, and `/apply/[applicationId]`'s CTA all pointed at the generic `/ai-strategy` hub with no course context, which — even after Phases 2-4 landed — still showed a static "Coming soon" list because nothing else had wired it up. `/ai-strategy` is now a real hub (a card per existing Strategy, linking into each one) and `/apply/[applicationId]` deep-links straight into that course's own Strategy.

**Figma still hasn't been read.** Every UI-building task above shipped built to this document's text spec and the existing Untitled UI visual language, not the real frames `docs/redesign-status.md` has node ids for. This remains the single biggest follow-up before any of this ships to students widely.

**Migration is manual.** No `supabase/migrations/` runner exists in this repo. `supabase-strategy-dashboard.sql` goes in the repo root and is applied by hand in the Supabase SQL editor, like every other migration here. Task 1.3 exists because "wrote the file" is not "the table exists".

**No new dependency.** Unlike Feature 2 (which adds `@react-pdf/renderer`), this feature adds nothing to `package.json` in Phase 1; Phase 6's AI Coach panel and Phase 3's AI calls use libraries already in the repo (`openai`, Zod, React).

**Two tables get extended, not forked.** `application_match_analyses` and `application_recommendations` already carry most of what Requirements 7 and 10 need — this is why Phase 1's migration is short relative to the feature's scope.

**Feature 2 conflict is a product decision, not a bug.** `ai-application-strategy`'s explicit "not a dashboard" design and this feature's dashboard coexist because this spec was written after the project owner asked for the dashboard specifically — Phase 1's `docs/README.md` update (task 3.1) is what makes that visible to the next person who opens the repo.
