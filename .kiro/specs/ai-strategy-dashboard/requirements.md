# Requirements Document

## Introduction

The **AI Strategy Dashboard** turns the AI Strategy area from a document workspace into the student's long-term, goal-oriented university-application companion. Instead of a schedule, it continually answers: *"What is the next most valuable thing I can do to maximise my chances of getting into this specific university course?"*

It implements the remaining, unbuilt steps of the five-stage Glowbal journey already declared in `src/features/apply/domain/ai-journey.ts` (`reflection → report → university → strategy → audit`): `report` becomes the **Applicant Analysis**, `university` becomes the **Course Match Analysis**, and `strategy` becomes the **AI Strategy Dashboard** — a dynamic set of categories driving an AI-generated, continuously-updated recommendation table, with per-recommendation coaching, progress tracking and evidence upload.

The student journeys through this once per course, first-time only: Strategy Home → Personal Summary → Achievements → AI Analysis (two reports) → AI Strategy Introduction → AI Strategy Dashboard. Return visits skip straight to the Dashboard. Personal Summary and Achievements are collected once and shared across every course the student strategises for; only the analysis and recommendations are course-specific.

## Relationship to Feature 2 (`ai-application-strategy`)

Feature 2 (`.kiro/specs/ai-application-strategy/`, built on the unmerged `feat/strategy-1..4` branches) is the CV + Personal Statement document workspace. Its requirements.md explicitly excludes "candidate identity cards … a candidate persona … admission-probability prediction" and its `strategy-overview.tsx` doc comment states plainly: *"It is not a dashboard … no charts, no aggregate score."*

This specification **reverses those specific exclusions by product decision** — a dashboard, a candidate portrait, match percentages and admissions-confidence estimates are exactly what this feature builds. Nothing else about Feature 2 changes: its CV editor, target-profile generator, CV review and statement-analysis scaffolding remain valid, unmodified, and are treated here as a **future integration point** (see Requirement 9.6) rather than something this spec rebuilds or depends on. This specification is deliberately based on `main`, not on the `feat/strategy-*` branches, so it does not inherit an unmerged, still-moving dependency — see Design authority.

## Glossary

- **Strategy**: One `application_strategies` row scoping the Applicant Analysis, Course Match Analysis, and Dashboard for a single `course_applications` row. One Strategy per application; a student with multiple applications has multiple Strategies (see Requirement 15).
- **Personal_Summary**: The unified, single-page structured profile editor (Requirement 3) covering Personal Details, Education, University Preferences, Interests, Learning Style and Personal Statement Questions. Stored on `student_profiles` and shared by every Strategy the student has.
- **Achievement_Record**: One row of `student_achievements` (academic/competition/research/certification/employment/other) or `student_activities` (leadership/project/volunteering/other), shared by every Strategy.
- **Applicant_Analysis**: The AI-generated candidate portrait (`applicant_analyses`) — personality summary, learning style, academic strengths, growth areas, motivation analysis, competitive advantages, suggested positioning, overall rating. Course-agnostic in content but regenerated per Strategy because it is influenced by the target course's field.
- **Course_Match_Analysis**: The AI-generated comparison (`application_match_analyses`, extended) between the applicant and the selected course — overall match %, entry-requirement match, experience match, personal-qualities match, missing areas, admissions risk, admissions confidence.
- **Strategy_Category**: One AI-selected grouping (Academics, Tests, Visa, Portfolio, Projects, Personal Statement, Interview, English, Research, Leadership, Volunteering, Scholarships, Finance, …) shown on the Dashboard. Which categories appear is decided per Strategy by the recommendation generator, not hardcoded.
- **Recommendation**: One row of `application_recommendations` (extended) — priority, title, reason, status, estimated impact, estimated effort, deadline, evidence-required flag, category, related requirement.
- **Progress_Status**: One of exactly five values on a Recommendation — `not_started`, `in_progress`, `completed`, `needs_review`, `blocked`.
- **Evidence**: A file, link or note (`uploaded_documents`, extended with an optional `recommendation_id`) a student attaches to prove progress on a Recommendation. Uploading Evidence is what triggers re-analysis (Requirement 14).
- **AI_Coach**: A per-recommendation, threaded chat (`strategy_coach_threads` / `strategy_coach_messages`) the student can ask for help, a study plan, resources, or a review.
- **Continuous_Optimisation**: The rule that a meaningful Personal_Summary edit, a new/edited Achievement_Record, new Evidence, or a changed target course triggers re-analysis of the affected Strategy's Applicant_Analysis, Course_Match_Analysis and Recommendations.
- **Glowbal_Chrome**: `TopNav` + `MobileNav` + `Container` + `Footer` as assembled by `src/app/ai-strategy/reflection-chrome.tsx`. `/ai-strategy` ships its own chrome (see Feature 2 design.md, constraint 1) and every new page in this subtree must too.

## Design authority

**A real Figma design for this exact feature already exists and has not been read yet.** `docs/redesign-status.md`'s "Designed but not built" table lists `/ai-strategy` (canvas **Khanh Linh - Chi**, node `375:9842`) with per-screen node ids that map directly onto this spec's stages: landing `375:18445` (Requirement 2, Strategy Home), candidate info `375:19260` (Requirement 3, Personal Summary), achievements `375:18839` (Requirement 4), portrait `375:18185` (Requirement 6, Applicant Analysis), fit `375:18645` (Requirement 7, Course Match Analysis), strategy `375:19502` / `405:6526` (Requirement 9, the Dashboard). Every UI-building task in Phases 2-6 of tasks.md **must** read its node id via the Figma MCP server before writing component code — layout, spacing, typography and colour come from the frame, not from this document's prose descriptions of the V2 text spec, per CLAUDE.md's Figma rule. This document specifies *behaviour and data*, which the text spec captured accurately; it does not substitute for reading the frame for *appearance*.

Base this feature on `main`, not on `feat/strategy-1..4-*` (unmerged, and built to a design that excludes what this spec requires). Reuse what `main` already has:

- `student_profiles` + `/ai-strategy/reflection/reflection-about-form.tsx` for Personal_Summary — extend, do not replace.
- `student_achievements` / `student_activities` + `/ai-strategy/reflection/achievements/*` for Achievements — extend, do not replace.
- `src/lib/match-insights.ts` (five weighted pillars, current/max score, confidence, `ImprovementAction[]`) as the scoring engine underneath Course_Match_Analysis — extend its output shape, do not build a second scoring system.
- `application_match_analyses` and `application_recommendations` (both in `supabase-apply-v2.sql`) as the persistence layer for Course_Match_Analysis and Recommendation — extend with new columns, do not fork new tables for data that already has a home.
- `uploaded_documents` (generic, already used by course-document upload) for Evidence — add a nullable FK, do not build a parallel attachments table.
- The existing async-job/polling convention (`src/app/api/applications/[id]/parse-status`, `retry-parse`) as the pattern for the Continuous_Optimisation re-analysis trigger — do not invent a second polling mechanism.
- Visual language: Untitled UI primitives in `src/shared/ui`, design tokens in `src/styles/tokens.css`, Rose 600 brand accent (`bg-brand`/`text-fg-brand`), admission tier colours from `src/lib/admission-fit.ts` (Reach `#E11D48`/white, Recommend `#EFF6FF`/`#2563EB`, Safe `#F0FDF4`/`#15803D`) for any match-percentage styling. No coral, no glassmorphism, no dense analytics-dashboard treatment — Untitled UI card/table patterns, not a metrics wall.

## Requirements

### Requirement 1: Journey entry and Strategy identity

**User Story:** As a signed-in student, I want "Plan My Strategy" on a university/course page to take me into a strategy scoped to that course, so that my progress and recommendations are specific to the course I'm targeting.

#### Acceptance Criteria

1. WHEN the student selects "Plan My Strategy" for a course, THE feature SHALL find or create a `course_applications` row for that student+course and an `application_strategies` row for that application (one Strategy per application — see Requirement 15 for multiple Strategies).
2. WHEN the student has never completed onboarding (Requirement 3) for this Strategy, THE feature SHALL route them through Strategy Home → Personal Summary → Achievements → AI Analysis → AI Strategy Introduction, in that order, before reaching the Dashboard.
3. WHEN the student returns to a Strategy that has completed onboarding, THE feature SHALL route them directly to the AI Strategy Dashboard (Requirement 9), skipping Strategy Home through AI Strategy Introduction.
4. WHEN an unauthenticated visitor requests any route under this feature, THE feature SHALL redirect to `/auth`.
5. WHEN a signed-in student requests a Strategy route for an `applicationId` they do not own, THE feature SHALL render `notFound()`.
6. THE `AI_JOURNEY` entries for `report`, `university` and `strategy` SHALL be given real `href` values once their pages exist, so the shared `Stepper` links to them instead of rendering plain text.
7. EVERY page in this feature SHALL ship Glowbal_Chrome itself.

### Requirement 2: Strategy Home Page

**User Story:** As a first-time student, I want to understand what AI Strategy does before it asks me for information, so that I trust the process enough to complete it.

#### Acceptance Criteria

1. THE Strategy Home page SHALL render a hero section with the heading "Build your personalised roadmap into university.", supporting text, and a primary CTA "Start My Strategy".
2. THE Strategy Home page SHALL render a "How It Works" section with exactly five steps: Review your profile, Add achievements, AI analyses your application, AI compares you against your course, Receive a live improvement roadmap.
3. THE Strategy Home page SHALL render four benefit cards: Personalised, AI Powered, Continuously Updated, Course Specific.
4. THE Strategy Home page SHALL render a testimonials section with at least three student quotes.
5. THE Strategy Home page SHALL render the primary CTA a second time below the testimonials.
6. IF no demo video asset exists at build time, THEN THE Strategy Home page SHALL omit the video section rather than render a broken embed. *(See Open decision 1.)*
7. WHEN the student activates a "Start My Strategy" CTA, THE feature SHALL apply Requirement 1's routing.

### Requirement 3: Personal Summary

**User Story:** As a student, I want to enter my personal, education and preference details once in a single structured editor, so that the AI has complete information without answering the same questions repeatedly for every course.

#### Acceptance Criteria

1. THE Personal Summary page SHALL render a "Step 1 of 4" progress indicator subordinate to the global `Stepper`.
2. THE Personal Summary page SHALL render six sections in one scrollable form: Personal Details (name, country, nationality, languages, age), Education (school, current year, grades, subjects, predicted grades, qualification type), University Preferences (countries, budget, preferred subjects, study style, career goals), Interests (hobbies, sports, competitions, projects, leadership, volunteering), Learning Style (independent/group/creative/technical/research/practical, multi-select), Personal Statement Questions (motivations, goals, dream career, reasons for studying abroad).
3. THE Personal Summary page SHALL provide "Save" and "Continue" actions; "Save" SHALL persist without advancing, "Continue" SHALL persist and advance to Achievements.
4. WHEN a field already has a value from `student_profiles` (set via onboarding or a prior Strategy), THE Personal Summary page SHALL pre-fill it.
5. WHEN the student edits and saves a field that already had a value used by a completed Applicant_Analysis or Course_Match_Analysis on any of their Strategies, THE feature SHALL mark the affected analyses stale for Continuous_Optimisation (Requirement 14).
6. THE feature SHALL persist new fields introduced by this requirement (languages, age, study style, career goals, learning style, personal-statement-question answers) as additive `student_profiles` columns, alongside the existing columns the current `reflection-about-form.tsx` already writes.

### Requirement 4: Achievements

**User Story:** As a student, I want to record everything outside academic grades — leadership, projects, volunteering, employment and awards — with evidence, so that the AI has the strongest possible input for my Applicant Analysis.

#### Acceptance Criteria

1. THE Achievements page SHALL render six categories: Academic (grades, competitions, olympiads, research, publications), Leadership (founded clubs, club positions, student government, prefect, captain), Projects (personal projects, GitHub, businesses, apps, research), Volunteering (charity, community, teaching, mentoring), Employment (internships, work experience, part-time jobs), Awards (certificates, scholarships, competitions, recognition).
2. EVERY Achievement_Record SHALL support attachments, links, dates, evidence and a free-text description.
3. THE Achievements page SHALL provide a "Continue" action that persists and advances to the AI Analysis loading step.
4. THE feature SHALL extend `student_activities`'s category constraint to include `'employment'`, and SHALL reuse `student_achievements`/`student_activities` for storage rather than introducing new tables.
5. WHEN the student adds, edits or removes an Achievement_Record on any Strategy, THE feature SHALL mark every Strategy's Applicant_Analysis and Course_Match_Analysis stale for Continuous_Optimisation, because Achievement_Records are shared across Strategies.

### Requirement 5: AI Analysis — processing

**User Story:** As a student, I want clear feedback that my analysis is running, so that a 30–60 second wait doesn't feel broken.

#### Acceptance Criteria

1. WHEN Achievements is completed (first time) or Continuous_Optimisation is triggered (return visit), THE feature SHALL render a loading state cycling through at least these messages: "Analysing profile...", "Understanding achievements...", "Comparing against course...", "Building recommendations...".
2. WHEN analysis completes, THE feature SHALL navigate to the Analysis Result page (Requirements 6–7) on first-time completion, or update the Dashboard in place on a Continuous_Optimisation re-run.
3. IF analysis fails, THEN THE feature SHALL render a retry action and SHALL NOT strand the student on an indefinite spinner.

### Requirement 6: Applicant Analysis report

**User Story:** As a student, I want an honest read on who I am as an applicant, so that I understand how to present myself.

#### Acceptance Criteria

1. THE Applicant Analysis report SHALL render: Personality Summary (short prose), Learning Style, Academic Strengths (list), Growth Areas (list), Motivation Analysis, Competitive Advantages (list), Suggested Positioning (prose), and an Overall Applicant Rating shown visually (not as a bare number).
2. THE Applicant_Analysis SHALL be generated from Personal_Summary + Achievement_Records + prior Evidence, via a single structured AI call (see Requirement 16).
3. WHEN an input category (e.g. no Achievement_Records yet) is empty, THE report SHALL omit or soften the dependent section rather than fabricate content.
4. THE report SHALL cite which inputs it used (an "inputs considered" note), consistent with `match-insights`'s existing `inputsPresent` pattern.

### Requirement 7: Course Match Analysis report

**User Story:** As a student, I want to see exactly how I compare against my chosen course's requirements, so that I know what's missing before I start acting on recommendations.

#### Acceptance Criteria

1. THE Course Match Analysis report SHALL render: Overall Match (percentage), Entry Requirement Match (grades, subjects, language, tests, visa, portfolio), Experience Match (projects, competitions, research, relevant work), Personal Qualities Match (leadership, curiosity, problem solving, communication), Missing Areas (list), Admissions Risk Analysis, and Admissions Confidence.
2. THE Overall Match percentage SHALL be derived from `src/lib/match-insights.ts`'s existing weighted-pillar engine (extended with the new sub-sections above), not a second, independent scoring model.
3. THE Course Match Analysis result SHALL persist to `application_match_analyses` (extended — see Requirement 16), which already has `current_match_score`, `max_possible_match_score`, per-pillar breakdown, `strengths`, `weaknesses` and `improvement_actions` columns this report reuses.
4. THE report SHALL render a CTA "Improve My Chances with AI" that routes to the AI Strategy Introduction (first-time) or the Dashboard (return visit).

### Requirement 8: AI Strategy Introduction

**User Story:** As a student, I want to understand how the Dashboard and its recommendations work before I start using them, so that changing recommendations don't feel arbitrary.

#### Acceptance Criteria

1. THE AI Strategy Introduction page SHALL render the headline "Your AI strategist is ready." and an explainer of how recommendations are generated, how priorities work, why recommendations change, and how progress tracking works.
2. THE AI Strategy Introduction page SHALL render an FAQ answering at minimum: "Why is my strategy different?", "Will it update?", "Can I ignore tasks?", "How often does AI rerun?".
3. THE AI Strategy Introduction page SHALL provide a "Generate My Strategy" CTA that produces the initial Recommendation set and navigates to the Dashboard.

### Requirement 9: AI Strategy Dashboard

**User Story:** As a returning student, I want one workspace showing my match, my progress and what to do next, so that I always know the next most valuable action.

#### Acceptance Criteria

1. THE Dashboard SHALL render a Top Summary: University, Course, Current Match (%), Goal (%), Overall Progress / Completion %, and Next Priority.
2. THE Dashboard SHALL render Recommendations grouped into Strategy_Categories chosen by the recommendation generator for this Strategy — THE feature SHALL NOT hardcode a fixed category list as the only possible set.
3. WHEN this session ships (Phase 0/1 scope — see tasks.md), THE Dashboard's initial category set SHALL be seeded from `match-insights`' five pillars (Academics, Tests, Personal Statement/Essays, Activities, Personal), each mapped to a Strategy_Category.
4. THE Dashboard SHALL NOT render analytics-style charts or an aggregate score beyond the Current Match / Goal percentages explicitly specified above — the design authority in Feature 2 requirements.md against "dense analytics dashboards" still applies to visual treatment even though the score/percentage exclusion itself is reversed by this spec.
5. WHEN the student navigates to the Dashboard for a Strategy whose onboarding (Requirements 3–4) is complete but whose Applicant_Analysis/Course_Match_Analysis has never run, THE Dashboard SHALL trigger Requirement 5 rather than render an empty state.
6. THE "CV/Portfolio" Strategy_Category SHALL render a "Coming soon" placeholder card, not a broken link, until Feature 2's CV workspace (`feat/strategy-4-cv-review` or its eventual successor) merges and is wired in as a follow-up integration task. *(See Open decision 2.)*

### Requirement 10: AI Recommendation Table

**User Story:** As a student, I want a prioritised, specific list of what to do next, so that I don't have to guess what matters most.

#### Acceptance Criteria

1. EACH Recommendation SHALL display: Priority, Recommendation (title), Reason, Progress_Status, and a Help action.
2. EACH Recommendation SHALL carry: priority, estimated impact, estimated effort, deadline, an evidence-required flag, current Progress_Status, and a related university requirement where applicable.
3. THE table SHALL be sortable/filterable by Priority and by Strategy_Category at minimum.
4. THE feature SHALL extend the existing `application_recommendations` table (which already has `priority`, `action_label`, `action_type`, `action_target`, `confidence`, `is_dismissed`) with `status`, `estimated_effort`, `deadline`, `evidence_required`, `category` and `related_requirement` columns, rather than introducing a parallel table.

### Requirement 11: Recommendation Detail Page

**User Story:** As a student, I want to open one recommendation and see why it matters and how to act on it, so that I'm not left guessing what "Improve Mathematics Grade" actually requires.

#### Acceptance Criteria

1. THE Recommendation Detail page SHALL render: why this matters, how universities evaluate it, how much it could improve admission chances, and suggested learning resources.
2. THE Recommendation Detail page SHALL render the AI_Coach entry point (Requirement 12), the Progress Tracker control (Requirement 13), and the Evidence Upload control (Requirement 14) for this Recommendation.

### Requirement 12: AI Coach

**User Story:** As a student working on a recommendation, I want to ask an AI assistant for help, so that I'm not left alone to figure out how to act on advice.

#### Acceptance Criteria

1. FROM a Recommendation Detail page, THE student SHALL be able to open an AI_Coach thread scoped to that Recommendation.
2. THE AI_Coach SHALL support at minimum these intents: "How do I improve this?", "Create a study plan.", "Find resources.", "Review my work.".
3. THE AI_Coach SHALL persist thread history (`strategy_coach_threads`/`strategy_coach_messages`) so the student can leave and return to a conversation.
4. AI_Coach output reaching a student's own document or profile data (as opposed to conversational text) SHALL go through the same Suggestion_State pattern Feature 2 already established (`SuggestionCard`: original, suggested, Accept/Dismiss/Edit — no silent apply).

### Requirement 13: Progress Tracker

**User Story:** As a student, I want to mark my own progress on a recommendation, so that my Dashboard reflects where I actually am.

#### Acceptance Criteria

1. THE student SHALL be able to set a Recommendation's Progress_Status to exactly one of: Not Started, In Progress, Completed, Needs Review, Blocked.
2. WHEN Progress_Status changes, THE Dashboard's Overall Progress / Completion % (Requirement 9.1) SHALL recompute.
3. THE feature SHALL convey Progress_Status by text plus an icon, not colour alone, consistent with Feature 2's `Status_Vocabulary` presentation rule.

### Requirement 14: Evidence Upload and continuous re-analysis

**User Story:** As a student, I want my strategy to update automatically when I make real progress, so that I don't have to manually ask for a re-analysis every time I improve something.

#### Acceptance Criteria

1. THE student SHALL be able to attach Evidence (certificates, documents, projects, photos, videos, GitHub links, other links) to a Recommendation.
2. THE feature SHALL extend `uploaded_documents` with a nullable `recommendation_id` foreign key rather than introduce a parallel attachments table.
3. WHEN Evidence is uploaded, OR a Personal_Summary field changes (Requirement 3.5), OR an Achievement_Record changes (Requirement 4.5), OR the target course changes, THE feature SHALL trigger Continuous_Optimisation: re-evaluate, update scores, reorder priorities, and add or remove Recommendations as needed.
4. THE re-analysis trigger SHALL reuse the existing async-job/polling convention (`parse-status`/`retry-parse`) rather than a new polling mechanism, and SHALL surface a non-blocking "Updating your strategy…" indicator on the Dashboard while running.
5. Re-analysis SHALL NOT block the student from continuing to use the Dashboard while it runs.

### Requirement 15: Multiple Strategies

**User Story:** As a student applying to several universities, I want a separate strategy per course without re-entering my personal information, so that setup only happens once.

#### Acceptance Criteria

1. THE student SHALL be able to have more than one Strategy (one per `course_applications` row, per Requirement 1.1).
2. EVERY Strategy SHALL share the same Personal_Summary and Achievement_Records; only Applicant_Analysis, Course_Match_Analysis and Recommendations SHALL differ per Strategy.
3. THE feature SHALL render a Strategy switcher (e.g. "Cambridge Computer Science 88% · Imperial Computing 81% · UCL AI 84%") when the student has more than one Strategy.
4. WHEN the student starts a second Strategy, THE feature SHALL skip Strategy Home, Personal Summary and Achievements (already complete) and go straight to AI Analysis for the new course.

### Requirement 16: Data model and AI architecture

#### Acceptance Criteria

1. THE feature SHALL add `applicant_analyses` (one row per Strategy generation, append-only, RLS owner-only) for Requirement 6.
2. THE feature SHALL extend `application_match_analyses` (already exists) with the Requirement 7 sub-sections rather than create a second match table.
3. THE feature SHALL extend `application_recommendations` (already exists) per Requirement 10.4.
4. THE feature SHALL add `strategy_coach_threads` / `strategy_coach_messages` (RLS owner-only) for Requirement 12.
5. THE feature SHALL extend `uploaded_documents` per Requirement 14.2.
6. AI calls (Applicant Analysis, Course Match Analysis extension, Recommendation generation) SHALL follow `main`'s existing plain-OpenAI-JSON-mode convention (`response_format: json_object`, manual parse + normalise, as in `src/lib/ai/match-insights.ts`) — not the trust-rules-no-score wrapper from `feat/strategy-*` (incompatible: this feature requires scores/percentages) and not a new SDK/provider. *(See Open decision 3.)*
7. EVERY new/extended table SHALL use `TEXT` + `CHECK` rather than enum types, denormalised `user_id` for single-column RLS, and the `DO $$ ... pg_policies ... $$` guard, matching every existing migration in this repo.

## Open decisions

These need an answer before the phase that depends on them. Each has a stated default so implementation is not blocked.

1. **Demo video and testimonials content (Requirement 2).** No video asset or real testimonial copy exists yet. **Default:** ship Strategy Home without the video section (Requirement 2.6) and with three placeholder-but-plausible testimonial quotes clearly not attributed to real students, flagged for the project owner to replace with real copy/video before launch. — *Blocks Phase 2 (UI).*
2. **CV/Portfolio category integration (Requirement 9.6).** Feature 2's real CV workspace lives only on unmerged `feat/strategy-*` branches built to a no-dashboard design. **Default:** ship a "Coming soon" placeholder category now; wire it in as a dedicated follow-up task once `feat/strategy-4-cv-review` (or its successor) merges to `main`. — *Blocks the Dashboard's category list, not Phase 0/1.*
3. **AI provider/pattern (Requirement 16.6).** Three conventions already exist in the repo (main's plain OpenAI JSON-mode; Feature 2's trust-rules-no-score OpenAI wrapper; the competing `feature/cv-essay-ai-workflows-*` branch's DeepSeek+Zod streaming). **Default:** plain OpenAI JSON-mode, matching `match-insights.ts`, for consistency and cost, and because this feature needs numeric scores the trust-rules wrapper explicitly forbids. — *Blocks Phase 3 (AI calls).*
4. **Strategy identity (Requirement 1.1, 15.1).** V2's "Multiple Strategies" example is per course, which could mean a lighter-weight entity than a full `course_applications` row. **Default:** reuse `course_applications` as the Strategy anchor — "Plan My Strategy" finds-or-creates one — so multiple Strategies fall out of a student having multiple applications, with no schema fork. — *Blocks Phase 1 (schema).*
