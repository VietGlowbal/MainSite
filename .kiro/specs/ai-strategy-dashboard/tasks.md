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

- [ ] 4. Strategy Home page (Requirement 2) — read node `375:18445`
- [ ] 5. Personal Summary field extensions on `reflection-about-form.tsx` (Requirement 3) — read node `375:19260`
- [ ] 6. Achievements employment category on `reflection-evidence-form.tsx` (Requirement 4) — read node `375:18839`
- [ ] 7. Onboarding-vs-Dashboard routing (`use-strategy-onboarding-state.ts`) (Requirement 1.2, 1.3, 15.4)

### Phase 3: AI Analysis (needs Phase 1, parallel with Phase 6 once Phase 4 lands)

- [ ] 8. Applicant Analysis AI call + report page (Requirement 5, 6) — read node `375:18185` ("portrait") before building the page
- [ ] 9. Course Match Analysis extension AI call + report page (Requirement 5, 7) — read node `375:18645` ("fit") before building the page

### Phase 4: Dashboard (needs Phase 3)

- [ ] 10. AI Strategy Introduction page (Requirement 8)
- [ ] 11. Dashboard top summary + category board (Requirement 9) — read node `375:19502` / `405:6526` ("strategy") before building the page
- [ ] 12. Recommendation generator + table (Requirement 10)

### Phase 5: Recommendation workspace (needs Phase 4)

- [ ] 13. Recommendation detail page (Requirement 11)
- [ ] 14. Progress Tracker control (Requirement 13)
- [ ] 15. Evidence Upload + re-analysis trigger (Requirement 14)

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
12 recommendation table ──► 13, 16

Phase 5 — Recommendation workspace   (needs 12)
13 detail ──► 14, 15
14 progress tracker ──► 20
15 evidence + re-analysis ──► 20

Phase 6 — AI Coach              (needs 12, parallel with Phase 5)
16 coach API ──► 17

Phase 7 — Completion            (needs Phases 1-6)
18 switcher ──► 20
19 sharing verification ──► 20
```

Phases 5 and 6 are independent of each other once Phase 4 lands, so they can proceed in parallel. Phase 7 needs both.

## Notes

**This session ships Phase 0 (decisions 0.3, 0.4 confirmed; 0.1, 0.2 deferred with stated defaults) and Phase 1 only** — migration, domain types, docs cross-link. No pages, no AI prompts, no route handlers ship yet; Phases 2-7 are scoped to roughly one branch each, the same size `feat/strategy-2/3/4` used.

**Migration is manual.** No `supabase/migrations/` runner exists in this repo. `supabase-strategy-dashboard.sql` goes in the repo root and is applied by hand in the Supabase SQL editor, like every other migration here. Task 1.3 exists because "wrote the file" is not "the table exists".

**No new dependency.** Unlike Feature 2 (which adds `@react-pdf/renderer`), this feature adds nothing to `package.json` in Phase 1; Phase 6's AI Coach panel and Phase 3's AI calls use libraries already in the repo (`openai`, Zod, React).

**Two tables get extended, not forked.** `application_match_analyses` and `application_recommendations` already carry most of what Requirements 7 and 10 need — this is why Phase 1's migration is short relative to the feature's scope.

**Feature 2 conflict is a product decision, not a bug.** `ai-application-strategy`'s explicit "not a dashboard" design and this feature's dashboard coexist because this spec was written after the project owner asked for the dashboard specifically — Phase 1's `docs/README.md` update (task 3.1) is what makes that visible to the next person who opens the repo.
