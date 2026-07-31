# Implementation Plan: AI Application Strategy (Feature 2)

## Overview

Seven phases building the CV and Personal Statement workspace at `/ai-strategy/[applicationId]`. Each phase ends with `npm run typecheck && npm run lint && npm test` green.

**Stack**: Next.js 16.2.3 (async `params`), React 19.2.4, Tailwind 4 with `gb-*` tokens, Supabase with RLS, zod 4 for HTTP bodies, OpenAI JSON mode for model calls, Vitest (`node` + `dom` projects).

**Key decisions carried from design.md**
- Ownership goes through one new guard, `src/server/auth/application-owner.ts`, not fourteen inline copies.
- Staleness is decided by integer content/profile versions, never timestamps.
- AI text reaches the student only through `SuggestionCard`, which has no silent-apply path.
- CV import returns a draft; confirmation is what persists.
- The three CV layouts are data (section order, emphasis, columns), so "genuinely different" is structural.
- PDF export is server-rendered with `@react-pdf/renderer` and keyed on content version, making "outdated" a comparison.

## Tasks

### Phase 0: Decisions

- [ ] 0. Resolve the four open decisions in requirements.md
  - [x] 0.1 Confirm the paywall boundary
    - `AI_JOURNEY.strategy` is `paid: true` and `Stepper` renders locked steps as a wall
    - Default to confirm: read/edit/autosave free; the five AI endpoints gated on `student_profiles.plus_status`, matching `/api/applications/[id]/match-insights`
    - Decide whether a non-Plus student sees `UpgradePromptModal` or a disabled action with a reason
    - _Requirements: 1.9, 16.3_
  - [ ] 0.2 Confirm the PDF approach and add the dependency
    - Add `@react-pdf/renderer` at a pinned exact version; note it is a new runtime dependency
    - Confirm the rejection of `window.print()` (no stored artifact, no export states) and headless Chromium (not viable on the serverless target)
    - _Requirements: 7.6, 7.7_
  - [x] 0.3 Confirm the AACC pillar set
    - This spec: Academic / Activities / Character / Contribution. Existing VinUni route: Ability / Aspirations / Creativity / Commitment
    - Default to confirm: implement this spec's four in the new analyzer, leave `/api/ai/analyze-statement-aacc` untouched
    - _Requirements: 11.5, 11.9_
  - [x] 0.4 Confirm the language convention
    - `/ai-strategy/reflection/*` hardcodes Vietnamese instead of calling `t()`
    - Default to confirm: hardcode the Vietnamese labels this spec fixes; add dictionary entries only for strings that also appear in English
    - _Requirements: 3.3, 4.2, 11.1_

### Phase 1: Foundation

- [ ] 1. Database schema and RLS
  - [x] 1.1 Write `supabase-application-strategy.sql`
    - Follow `supabase-reflection.sql`: flat root-level file, `IF NOT EXISTS` throughout, `TEXT` + `CHECK` instead of enum types, explanatory header comment
    - `application_strategies`: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE`, `application_id UUID NOT NULL UNIQUE REFERENCES course_applications ON DELETE CASCADE`, `status TEXT CHECK (status IN ('not_started','in_progress','needs_attention','ready_for_audit'))`, `created_at`, `updated_at`
    - `cv_target_profiles`: `strategy_id` (unique), the seven nullable TEXT fields, `missing_information JSONB DEFAULT '[]'`, `sources_used JSONB DEFAULT '[]'`, `version INT NOT NULL DEFAULT 1`, `generated_at TIMESTAMPTZ`
    - `structured_cvs`: `strategy_id` (unique), `source_document_id UUID`, `sections JSONB DEFAULT '[]'`, `selected_layout TEXT CHECK (selected_layout IN ('academic','technical','leadership'))`, `content_version INT DEFAULT 1`, `last_reviewed_version INT`, `last_exported_version INT`
    - `cv_reviews`: `cv_id`, `target_profile_version INT`, `content_version INT`, `strengths JSONB`, `missing_signals JSONB`, `summary TEXT`, `model TEXT`, `created_at` — append-only
    - `statement_strategies`: `strategy_id` (unique), `prompt TEXT`, `word_limit INT`, `brief JSONB`, `source_urls JSONB`
    - `statement_analyses`: `statement_id`, `content_version INT`, `overview JSONB`, `ideas_and_structure JSONB`, `opening JSONB`, `aacc JSONB`, `readiness JSONB`, `model TEXT`, `created_at` — append-only
    - Denormalise `user_id` onto all six tables so each RLS policy is a single-column check with no subquery
    - _Requirements: 15.1, 15.3, 15.4, 15.5_
  - [x] 1.2 Add RLS policies and indexes
    - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all six
    - One `<table>_owner` `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` per table, each wrapped in the `DO $$ ... pg_policies ... $$` guard
    - Indexes: `application_strategies(user_id)`, `application_strategies(application_id)`, `cv_reviews(cv_id, created_at DESC)`, `statement_analyses(statement_id, created_at DESC)`
    - Register the file with `scripts/check-migrations.mjs` if that script maintains a list
    - _Requirements: 15.2_
  - [ ] 1.3 Verify the migration applies cleanly and is re-runnable
    - **BLOCKED — needs you.** The file is written but has not been run; there is no automated runner in this repo and I have no Supabase credentials. Until it is applied, every Feature 2 endpoint returns the 503 "needs a one-time database update" message that `migrationAwareError` produces. FK types were verified against `supabase-schema.sql` (`personal_statements.id` is `bigserial`) and `supabase-missing-tables.sql` (`uploaded_documents.id` is `uuid`).
    - Apply in the Supabase SQL editor, then apply a second time to prove idempotency
    - Verify with a query that a second user cannot select another user's strategy row
    - _Requirements: 15.2, 15.3_

- [x] 2. Shared ownership guard
  - [x] 2.1 Create `src/server/auth/application-owner.ts`
    - `requireApplicationOwner(applicationId): Promise<{ response: NextResponse } | { supabase, user, application }>`
    - Runs the existing idiom: `await createClient()`, `auth.getUser()` → 401, then `.from('course_applications').select('*, courses (*)').eq('id', id).eq('user_id', user.id).single()` → 404
    - Never leaks whether a non-owned application exists
    - Export from `src/server/auth/index.ts`
    - _Requirements: 1.5, 16.2_
  - [x] 2.2 Unit-test the guard
    - No session → 401; wrong owner → 404; owner → resolved application
    - _Requirements: 21.1_

- [x] 3. Types and domain foundation
  - [x] 3.1 Create `src/features/application-strategy/domain/types.ts`
    - `ApplicationStrategy`, `CvTargetProfile`, `StructuredCv`, `CvSection`, `CvEntry`, `CvReview`, `CvStrength`, `CvMissingSignal`, `StatementStrategy`, `StatementBrief`, `StatementAnalysis`, `StatementOverview`, `StatementFinding`, `AaccAssessment`, `StatementReadiness`, `StrategySource`
    - `ApplicationStrategyContext` exactly as specified, plus `notes: string[]`
    - _Requirements: 15.1, 17.1_
  - [x] 3.2 Create `domain/status.ts` with the status derivation
    - `WorkspaceStatus` union; `cvStatus`, `statementStatus`, `strategyStatus`, `nextAction`
    - Rules: nothing exists → `not_started`; critical missing signals, outdated analysis or failed readiness → `needs_attention`; review clean + layout selected + export current + readiness passed → `ready_for_audit`; else `in_progress`
    - Pure, no I/O
    - _Requirements: 2.6, 2.7, 2.8, 12.1, 12.2_
  - [x] 3.3 Create `domain/staleness.ts`
    - `isReviewOutdated(review, cv, targetProfile)`, `isExportOutdated(cv)`, `isAnalysisOutdated(analysis, statementVersion)`
    - Integer version comparison only — never timestamps
    - _Requirements: 6.7, 7.9, 9.3, 12.3_
  - [x] 3.4 Unit-test status and staleness
    - Every status transition; every outdated combination; a review that is current
    - _Requirements: 21.1_
  - [x] 3.5 Create the `domain/index.ts` barrel
    - Respect the eslint feature-boundary rules; no deep imports past the barrel from outside
    - _Requirements: 20.3_

- [x] 4. Repository and context assembler
  - [x] 4.1 Create `src/features/application-strategy/api/strategy-repository.ts`
    - `getOrCreateStrategy`, `getTargetProfile`, `upsertTargetProfile` (increments `version` on change), `getStructuredCv`, `upsertStructuredCv` (increments `content_version`), `getLatestCvReview`, `insertCvReview`, `getStatementStrategy`, `upsertStatementStrategy`, `getLatestStatementAnalysis`, `insertStatementAnalysis`
    - `getStrategyOverview(applicationId, userId)` returning one view model for the overview page
    - _Requirements: 15.5, 16.2_
  - [x] 4.2 Create `api/context.ts` — the single AI context assembler
    - `assembleStrategyContext(supabase, admin, userId, applicationId)`
    - Reads `student_profiles`, `student_achievements`, `student_activities`, `course_applications` + `courses`, `application_sources`, `uploaded_documents`, `personal_statements`
    - Extracts CV and statement text with `extractDocumentText`, caching back to `uploaded_documents.parsed_text`, exactly as the match-insights route does
    - Records "uploaded but unreadable" facts in `notes` so the model cannot claim a document is absent
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  - [x] 4.3 Unit-test the assembler with a stubbed Supabase client
    - Full profile; empty profile; CV present but unreadable; no documents at all
    - _Requirements: 17.4, 21.1_

- [x] 5. Analytics
  - [x] 5.1 Create `src/lib/analytics/track.ts`
    - `StrategyEventType` union of the twenty names from Requirement 19
    - `trackApplicationEvent({ applicationId, userId, eventType, eventLabel?, metadata? })` writing to `application_events`
    - `metadata` typed as `Record<string, string | number | boolean | null>` so document content cannot be passed
    - Never throws; failures are logged and swallowed
    - _Requirements: 19.1, 19.2, 19.3_
  - [x] 5.2 Unit-test that the event name union is exhaustive and metadata rejects objects
    - _Requirements: 19.2_

- [ ] 6. Chrome, shell and shared UI
  - [x] 6.1 Extract `StrategyChrome` from `reflection-chrome.tsx`
    - **DEVIATION:** landed at `src/app/ai-strategy/strategy-chrome.tsx`, not in the feature module. It needs `MARKETING_NAV_ITEMS` and the `FOOTER_*` constants from `@/features/marketing/ui`, and eslint's `noCrossFeature` rule forbids one feature importing another. The app layer is the composition root allowed to reach both.
    - **DEVIATION:** takes a `containerWidth: 'narrow' | 'wide' | 'full'` union rather than a free `containerClassName`, so a caller cannot invent a fourth width.
    - Rewrite `ReflectionChrome` as a thin caller so the two cannot drift
    - Verify `/ai-strategy/reflection` and `/ai-strategy/reflection/achievements` render unchanged
    - _Requirements: 1.7, 20.1, 20.2_
  - [x] 6.2 Create `src/app/ai-strategy/[applicationId]/layout.tsx`
    - Resolve session → `redirect('/auth')`; load application with the ownership predicate → `notFound()`
    - Render `StrategyChrome`, the global `Stepper` with `aiJourneySteps()` and `currentIndex={3}`, then `children`
    - Read `params` as a promise (Next.js 16)
    - _Requirements: 1.1, 1.3, 1.4, 1.7, 1.9_
  - [x] 6.3 Give `AI_JOURNEY.strategy` a real `href`
    - Point it at `/ai-strategy` in `src/features/apply/domain/ai-journey.ts`; update `stepper.test.tsx` if it asserts `href: null`
    - **ALSO REQUIRED:** `aiJourneySteps()` gained an `{ unlock }` option. `Stepper` gives `locked` priority over `current`, so `currentIndex={3}` on a `paid: true` step drew the step the student was standing on as a paywall with the connector unfilled behind them. The gate is enforced on the AI endpoints, so a student who reached the page has already passed it.
    - _Requirements: 1.9_
  - [x] 6.4 Add a route-collision test
    - Assert the static `/ai-strategy/reflection` routes still resolve alongside the new `[applicationId]` segment
    - _Requirements: 1.6_
  - [ ] 6.5 Create the shared UI primitives this feature needs
    - **PARTIAL.** `Panel`/`PanelHeader`/`PanelRow` and `StatusPill`/`StatusText` are built — the overview needed them. `AutosaveStatus`, `SuggestionCard`, `CvSteps` and `states.tsx` are deferred to the phase that first consumes them: building them now, against no caller, is how the wrong abstraction gets locked in. `SuggestionCard` must still land before task 12.5 and 22.1 both start, per the parallelisation note.
    - `ui/panel.tsx` — `Panel`, `PanelHeader`: `rounded-gb-2xl border border-line bg-surface p-gb-3xl`, no shadow
    - `ui/status-pill.tsx` — always pairs a `KitIcon` with the text label; never colour alone
    - `ui/autosave-status.tsx` — `Saving` / `Saved` / `Could not save`, small and restrained, not a toast
    - `ui/suggestion-card.tsx` — original text, suggested text, Accept / Dismiss / Edit manually; no API that applies without one of the three
    - `ui/cv-steps.tsx` — the compact four-step CV indicator, built on `ProgressBar` like `ReflectionShell`, visually subordinate to the global `Stepper`
    - `ui/states.tsx` — every state from Requirement 13, each with exactly one recovery action
    - Reuse `Button`, `Badge`, `Modal`, `Input`, `Textarea`, `FormField`, `EmptyState`, `KitIcon`; create nothing that duplicates them
    - _Requirements: 2.8, 3.12, 4.10, 13.1, 13.2, 13.3, 20.1, 20.2, 20.3_
  - [ ] 6.6 Create `hooks/use-autosave.ts`
    - Generic debounced save (1200 ms), returns `{ status, save, retry }`, last-write-wins, surfaces the server's new version
    - Used by the Target Profile page, the CV editor and the statement editor so all three behave identically
    - _Requirements: 3.12, 4.12, 9.2, 13.1_

- [x] 7. Strategy API and overview page
  - [x] 7.1 Create `GET`/`POST /api/applications/[id]/strategy/route.ts`
    - `GET` returns the overview view model; `POST` creates the strategy row if absent
    - Uses `requireApplicationOwner`; `runtime = 'nodejs'`
    - _Requirements: 16.1, 16.2, 16.5, 16.6_
  - [x] 7.2 Build the overview page `src/app/ai-strategy/[applicationId]/page.tsx`
    - **DEVIATION:** `StrategyOverview` gained an `actions: { next, cvHref, statementHref }` field and `getStrategyOverview` resolves it. The first cut had the page reconstruct `CvStatusInputs` from the summarised statuses in order to call `nextAction` — reverse-engineering inputs from their own outputs. The repository already holds the real versions and section counts, so it decides.
    - New design in Glowbal style: white canvas, thin borders, no shadow, one primary action
    - Application context block: logo when available, university, course, degree level, deadline, status; omit missing values and their punctuation
    - CV workspace card: overall status, last updated, Target Profile / content / AI review status, selected layout, PDF export status
    - Statement workspace card: overall status, word count, last saved, last analyzed, Ideas / Opening / AACC / Readiness status
    - State-dependent primary actions per Requirements 2.6 and 2.7
    - Empty state with the exact copy `Start with the document you already have, or create one from your Glowbal profile.` and exactly one visually primary action
    - No charts, no aggregate score, no admissions probability
    - Emit `strategy_opened`
    - _Requirements: 2.1–2.10, 19.1_
  - [x] 7.3 Test the overview
    - Route: 401, 404, success shape
    - Component: each status maps to the right action label; empty state; missing context values omitted cleanly
    - _Requirements: 21.1_
  - [x] 7.4 Add the two rate limiters
    - `strategyAiLimiter` and `strategyExportLimiter` in `src/lib/rate-limiter`, exported from its barrel
    - _Requirements: 16.3_

### Phase 2: Target Profile

- [ ] 8. Target Profile domain and API
  - [ ] 8.1 Create `domain/target-profile.ts`
    - Field catalogue with the seven Vietnamese labels, each tagged `university` | `profile` | `mixed` for the origin badge
    - `targetProfilePatchSchema` (zod); `filledFieldCount`; `exampleText` per field
    - _Requirements: 3.3, 3.4, 3.6_
  - [ ] 8.2 Create `GET`/`PATCH /api/applications/[id]/cv/target-profile/route.ts`
    - `PATCH` validates with zod, upserts, increments `version`, returns the new version
    - Emit `cv_target_profile_edited`
    - _Requirements: 3.10, 3.13, 16.1, 16.2, 19.1_
  - [ ] 8.3 Create `src/lib/ai/strategy/target-profile.ts`
    - Consumes `ApplicationStrategyContext`; JSON mode with an explicit schema, then manual coercion (the `extract-course.ts` pattern), not zod-parsed model output
    - Returns exactly `careerDirection`, `universityPositioning`, `educationPhilosophy`, `environment`, `programmeObjectives`, `priorityCapabilities`, `careerAlignment`, `missingInformation`, `sourcesUsed`
    - Prompt forbids inventing candidate evidence or programme claims; requires empty fields when evidence is insufficient; requires concise values
    - _Requirements: 3.8, 3.9, 18.1–18.6_
  - [ ] 8.4 Create `POST /api/applications/[id]/cv/target-profile/generate/route.ts`
    - Ownership, Plus gate per decision 0.1, `strategyAiLimiter`, `Idempotency-Key` support, `maxDuration = 60`
    - Stores sources in `sources_used` separately from field values; increments `version`
    - Hides provider errors behind `AI provider unavailable`; logs with `logError`
    - Emit `cv_target_profile_generated`
    - _Requirements: 3.7, 3.8, 3.9, 16.3, 16.5, 19.1_
  - [ ] 8.5 Create `src/lib/ai/strategy/prompts.ts`
    - The shared trust-rules block appended to every Feature 2 system prompt
    - _Requirements: 18.1–18.6_

- [ ] 9. Target Profile page
  - [ ] 9.1 Build `cv/target-profile/page.tsx` reproducing the approved design
    - Faithful reproduction of "Xác định CV cần chứng minh những điều gì": layout, hierarchy, spacing, typography, card treatment, button hierarchy
    - `CvSteps` with `Target Profile` highlighted
    - The seven labelled fields; `Định hướng nghề nghiệp` optional free text
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 9.2 Implement the initial (ungenerated) state
    - Blank fields with quiet example text; programme-derived fields visually distinguished from student-derived; examples clearly not saved student data
    - Primary action `Tạo trang target profile`
    - _Requirements: 3.4, 3.7_
  - [ ] 9.3 Implement the generated state
    - Exact same layout with editable generated content in place of the examples
    - Per card: generated value, origin badge (`From university` / `From profile` / `Mixed`), edit action, missing-information flag when relevant; no large explanation panel
    - Primary `Tiếp tục nhập nội dung`, secondary `Tạo lại target profile` — regeneration must not dominate
    - _Requirements: 3.5, 3.6, 3.10, 3.11_
  - [ ] 9.4 Wire autosave and its states
    - `use-autosave.ts` + `AutosaveStatus` near the heading or the active field; no toast-only confirmation
    - _Requirements: 3.12, 13.1_
  - [ ] 9.5 Test the Target Profile flow
    - Route: 401, 404, bad body, rate limit, generation success, provider failure
    - Component: ungenerated vs generated rendering; origin badges; editability; autosave status transitions
    - _Requirements: 21.1_

### Phase 3: CV Content and import

- [ ] 10. Structured CV domain
  - [ ] 10.1 Create `domain/cv-sections.ts`
    - `CvSectionKind` for the eleven sections plus `custom`; `CvEntryField`; `SECTION_FIELDS` mapping each kind to only its relevant fields
    - `OPTIONAL_SECTIONS`, `RENAMEABLE_SECTIONS` (`custom` only), `reorder`, `essentialGaps`
    - `structuredCvPatchSchema` (zod)
    - _Requirements: 4.4, 4.5, 4.6, 4.11_
  - [ ] 10.2 Unit-test the section domain
    - Per-section field relevance; reorder bounds; optional-vs-required removal; rename restriction; `essentialGaps`
    - _Requirements: 21.1_

- [ ] 11. CV content API
  - [ ] 11.1 Create `GET`/`PATCH /api/applications/[id]/cv/route.ts`
    - `PATCH` validates, upserts `sections`, increments `content_version`, returns the new version for the autosave hook
    - _Requirements: 4.12, 16.1, 16.2_
  - [ ] 11.2 Create `POST /api/applications/[id]/cv/import/route.ts`
    - Body `{ documentId }` or `{ pastedText }`
    - Extract with `extractDocumentText`, cache to `parsed_text`; when extraction returns `null` respond `{ ok: false, reason: 'unreadable' }`
    - Model call splits text into the section/entry shape with a per-field `certain: boolean`
    - Returns a **draft** and does not write `structured_cvs` — confirmation persists
    - Emit `cv_import_started` / `cv_import_completed` / `cv_import_failed`
    - _Requirements: 5.1, 5.4, 5.5, 5.7, 19.1_
  - [ ] 11.3 Create `POST /api/applications/[id]/cv/suggest/route.ts` for per-entry AI actions
    - Actions: clearer, concise, highlight impact, add confirmed evidence from profile, tailor to this course
    - Returns `{ original, suggested }` only — never a mutation
    - Plus gate, `strategyAiLimiter`
    - _Requirements: 4.9, 4.10, 16.3, 18.5_

- [ ] 12. CV Content editor page
  - [ ] 12.1 Build `cv/content/page.tsx`
    - New UI in the existing Glowbal style, using Target Profile / Assessment / Layout as references; reads as a document, not a dashboard
    - Chrome, `CvSteps`, heading `Nội dung CV`, short explanation, source/import controls, section editor, persistent primary action
    - _Requirements: 4.1, 4.2_
  - [ ] 12.2 Implement the three content sources
    - Import an uploaded CV, build from Glowbal profile, start manually
    - When an uploaded CV exists, surface import as the recommended first option
    - _Requirements: 4.3_
  - [ ] 12.3 Implement the section editor
    - Each section a `Panel` with heading, reorder control, add-entry, collapse/expand, and remove for optional sections
    - Add / remove / reorder sections; rename only `custom`; reorder entries
    - Move-up / move-down buttons with `aria-label`s, not drag-and-drop; touch-sized targets
    - _Requirements: 4.4, 4.5, 4.7, 14.3_
  - [ ] 12.4 Implement the entry editor
    - Only the fields relevant to the section kind; entries collapsed by default and expanded one at a time so the page cannot become excessively long
    - Full-width fields on mobile, no horizontal scrolling
    - _Requirements: 4.6, 4.8, 14.3_
  - [ ] 12.5 Wire the per-entry AI actions through `SuggestionCard`
    - Five actions; every result in Suggestion_State; no path that applies without Accept
    - _Requirements: 4.9, 4.10, 18.5_
  - [ ] 12.6 Wire autosave and continuation
    - Primary action `Review my CV`; continuing with incomplete sections allowed; small warning from `essentialGaps` when essential information is missing
    - _Requirements: 4.11, 4.12_

- [ ] 13. Import and extraction confirmation flow
  - [ ] 13.1 Build the upload/select step
    - `FileDropzone` + `useDocumentUpload({ kind: 'cv' })` + `DocumentRow`; offer an already-uploaded CV for selection
    - _Requirements: 5.1, 20.1_
  - [ ] 13.2 Implement the parsing states
    - `Uploading`, `Reading document`, `Organizing content`, `Ready to review`, `Could not read document`
    - Real states tied to real phases; no fabricated percentage
    - _Requirements: 5.2_
  - [ ] 13.3 Build the confirmation screen
    - Extracted sections in the same section-card treatment as the editor
    - Uncertain fields marked `Please check`
    - `Confirm all`, `Review individually`, `Start with this content`, `Cancel import`
    - Confirmation is what writes `structured_cvs`; require explicit confirmation before overwriting existing content
    - _Requirements: 5.3, 5.4, 5.7_
  - [ ] 13.4 Build the unreadable-document fallback
    - Copy `We saved your file, but we could not read its text.`
    - `Paste CV text` (feeds the same confirmation screen), `Enter information manually`, `Upload a text-based PDF`, `Try another file`
    - Never a generic error
    - _Requirements: 5.5, 5.6, 13.1_
  - [ ] 13.5 Test import
    - Route: unreadable PDF, DOCX, paste path, draft-not-persisted, ownership
    - Component: parsing state sequence, `Please check` marking, cancel leaves existing content untouched
    - _Requirements: 21.1_

### Phase 4: CV Assessment

- [ ] 14. CV review API
  - [ ] 14.1 Create `src/lib/ai/strategy/cv-review.ts`
    - Consumes the context plus the Target Profile and Structured CV
    - Returns `strengths[]` (`title`, `evidence`, `targetProfileArea`, `programmeRelevance`, `strength`), `missingSignals[]` (`signal`, `reason`, `action`, `targetSection`), `summary`, `sourcesUsed`
    - `targetSection` constrained to a real `CvSectionKind` so `Open relevant section` always resolves
    - Prompt requires evidence quoted from actual CV content; no invented evidence
    - _Requirements: 6.5, 6.9, 18.1–18.6_
  - [ ] 14.2 Create `POST /api/applications/[id]/cv/review/route.ts`
    - Ownership, Plus gate, `strategyAiLimiter`, idempotency, `maxDuration = 60`
    - Rejects with a `Missing CV content` response when there is nothing to assess, rather than storing an empty review
    - Inserts an append-only `cv_reviews` row recording `target_profile_version` and `content_version`; updates `last_reviewed_version`
    - Emit `cv_review_started` / `cv_review_completed` / `cv_review_failed`
    - _Requirements: 6.6, 16.3, 19.1_

- [ ] 15. CV Assessment page
  - [ ] 15.1 Build `cv/review/page.tsx` reproducing the approved design
    - Faithful reproduction of "AI ASSESSMENT": four-step progress with `Bản CV` highlighted, AI Assessment panel, three strengths, missing signals, CV preview, CV review action, layout action
    - _Requirements: 6.1_
  - [ ] 15.2 Implement the strengths list
    - Title, CV evidence, Target Profile area, programme relevance; concise when collapsed, detailed evidence on expand
    - _Requirements: 6.2_
  - [ ] 15.3 Implement the missing-signals list
    - Claim, why it matters, recommended action, relevant CV section
    - `Open relevant section` navigating or scrolling to the correct Content section
    - _Requirements: 6.3, 6.4_
  - [ ] 15.4 Implement all seven interaction states
    - `Not analyzed`, `Analyzing`, `Analysis complete`, `Analysis outdated`, `Analysis failed`, `Missing CV content`, `Critical gaps resolved`
    - Outdated copy `Your CV has changed since this review. Run the review again to refresh the feedback.` with `Re-run review` and `Continue to layout anyway`; layout selection must not be hard-blocked
    - Failure shows a clear error with `Retry` and `Continue editing`; no raw provider message
    - _Requirements: 6.6, 6.7, 6.8, 13.1_
  - [ ] 15.5 Mobile adaptation
    - Stack strengths and missing signals, CV preview below the feedback, full-width actions
    - _Requirements: 14.4_
  - [ ] 15.6 Test the assessment
    - Route: missing content, provider failure, ownership, stored versions recorded
    - Component: outdated detection, `Open relevant section` targeting, each state's single recovery action
    - _Requirements: 21.1_

### Phase 5: Layout and PDF

- [ ] 16. Layout definitions and recommendation
  - [ ] 16.1 Create `domain/cv-layouts.ts`
    - Three `CvLayoutDef` records with materially different `order`, `emphasise` and `columns`: academic (education, research, publications, academic projects, awards), technical (skills, technical projects, engineering/software work, measurable outcomes), leadership (roles, organisations, activities, community impact, management responsibility)
    - `recommendLayout(targetProfile, cv)` — deterministic, derived from `priorityCapabilities` and where the CV's evidence sits, returning `{ key, reason }` with a one-sentence reason built from real strategy information
    - _Requirements: 7.2, 7.5_
  - [ ] 16.2 Unit-test the layouts
    - Assert the three orders differ structurally, not by label; assert `recommendLayout` is deterministic and its reason names real Target Profile content
    - _Requirements: 7.2, 7.5, 21.1_

- [ ] 17. PDF rendering and export
  - [ ] 17.1 Create `src/lib/cv-pdf/`
    - One `@react-pdf/renderer` document per layout, sharing a stylesheet derived from the design tokens
    - Selectable text, ATS-readable ordering, accessible contrast, stable pagination, no overflow, no clipped text
    - _Requirements: 7.6_
  - [ ] 17.2 Create `POST /api/applications/[id]/cv/export/route.ts`
    - Ownership, `strategyExportLimiter`, `runtime = 'nodejs'`, `maxDuration`
    - Renders to a buffer, uploads to `student-documents/{userId}/cv-exports/{strategyId}-v{contentVersion}.pdf`, records `last_exported_version`
    - Version-keyed object name makes re-export idempotent and `Export outdated` a comparison
    - Emit `cv_export_started` / `cv_export_completed` / `cv_export_failed`
    - _Requirements: 7.7, 7.9, 16.3, 19.1_
  - [ ] 17.3 Build the HTML preview
    - Renders the same layout definitions with a fixed A4 page box; page navigation and a zoom control; multi-page support
    - _Requirements: 7.6, 7.7_

- [ ] 18. Layout and PDF page
  - [ ] 18.1 Build `cv/layout/page.tsx` reproducing the approved page structure
    - Faithful reproduction of "Layout - PDF"
    - _Requirements: 7.1_
  - [ ] 18.2 Implement layout card selection with all seven states
    - `Default`, `Hover`, `Keyboard focus`, `Selected`, `AI recommended`, `Selected and recommended`, `Selected but not recommended`
    - `radiogroup` of `role="radio"` cards; selection conveyed by border **and** icon/check **and** the visible text `Selected`; never colour alone
    - `AI recommended` as a `Badge`; both states render together when both apply
    - Persist to `structured_cvs.selected_layout`; emit `cv_layout_selected`
    - _Requirements: 7.3, 7.4, 7.10, 19.1_
  - [ ] 18.3 Render the recommendation explanation
    - One short sentence from `recommendLayout().reason`
    - _Requirements: 7.5_
  - [ ] 18.4 Implement the six export states and the five actions
    - `Ready to export`, `Generating PDF`, `PDF ready`, `Export failed`, `Export outdated`, `Multi-page preview`
    - `Download PDF`, `Print CV`, `Retry export`, `Return to Content`, `Re-run review`
    - _Requirements: 7.7, 7.8, 7.9, 13.1_
  - [ ] 18.5 Mobile adaptation
    - Stack the template cards, one preview at a time, unambiguous selected and recommended states
    - _Requirements: 14.6_
  - [ ] 18.6 Test layout and export
    - Route: export success, export failure, outdated detection, ownership, rate limit
    - Component: selection accessible without colour, keyboard selection, recommendation text
    - _Requirements: 21.1_

### Phase 6: Statement

- [ ] 19. Statement strategy and brief
  - [ ] 19.1 Create `domain/statement-sections.ts`
    - The five sections with their labels (`Overview`, `Ý tưởng và Cấu trúc`, `Mở bài và sức hút`, `Đánh giá AACC`, `Submit Audit / Readiness`), `?section=` keys and nav order
    - _Requirements: 11.1_
  - [ ] 19.2 Create `src/lib/ai/strategy/statement-brief.ts` and `POST /api/applications/[id]/statement/brief/route.ts`
    - Brief contains university, course, essay prompt, word limit, what the statement should demonstrate, relevant programme information, candidate evidence to consider, what the CV already covers, missing information
    - May recommend evidence or a story; must not generate personal experiences
    - Emit `statement_brief_generated`
    - _Requirements: 8.2, 8.5, 16.1, 19.1_
  - [ ] 19.3 Create `GET`/`PATCH /api/applications/[id]/statement/route.ts`
    - Reads/writes through the existing `personal_statements` storage; returns word count, last saved, last analyzed, and the content version
    - _Requirements: 9.5, 16.1_
  - [ ] 19.4 Build `StatementBriefPanel`
    - Collapsible, compact summary by default, expand to simple grouped rows, source links only where relevant, no analytics, no separate dashboard
    - `Start with this brief` as the primary action when the statement is empty
    - _Requirements: 8.1, 8.3, 8.4_

- [ ] 20. Statement editor page
  - [ ] 20.1 Build `statement/page.tsx` reproducing the approved structure
    - Faithful reproduction of "Strengthen Your Statement": journey indicator, heading, Strategy Brief, `Personal Statement` label, editor, word count, edit action, re-analyze action, AI Feedback action, section nav, detailed feedback below
    - _Requirements: 9.1, 11.1_
  - [ ] 20.2 Integrate `StatementWriter`
    - Reuse with `saveTarget: { kind: 'application', applicationId }`; do not build a competing editor
    - Autosave, preserved formatting, word count, word limit when known, warning before destructive replacement
    - _Requirements: 9.2, 9.5, 20.1, 20.2_
  - [ ] 20.3 Implement version tracking and outdated marking
    - Content version increments on change; previous analysis marked outdated
    - _Requirements: 9.3, 12.3_
  - [ ] 20.4 Implement the empty statement state
    - Strategy Brief, large editor, `Paste statement`, `Start writing`, optional upload/import; analysis action disabled until meaningful content exists
    - _Requirements: 9.4, 13.1_

- [ ] 21. Statement analysis
  - [ ] 21.1 Create `domain/quote-match.ts`
    - `matchQuote(text, item)` → `offset` | `rematched` | `unmatched`
    - Trust stored offsets when the substring still equals the quote; else search verbatim, then whitespace-normalised; else `unmatched`
    - Never a fuzzy or nearest match
    - _Requirements: 10.5_
  - [ ] 21.2 Unit-test quote matching
    - Valid offsets; shifted text; deleted quote; duplicate quote; whitespace-only change
    - _Requirements: 10.5, 21.1_
  - [ ] 21.3 Create `domain/aacc.ts`
    - Four pillars (Academic, Activities, Character, Contribution) with per-pillar score, explanation, evidence, missing evidence, recommended improvement
    - The fixed framing string `This score measures how clearly the current draft demonstrates this area. It is not an admission probability.`
    - No overall-score field in the type, so one cannot be displayed
    - _Requirements: 11.5, 11.6, 18.6_
  - [ ] 21.4 Create `src/lib/ai/strategy/statement-analysis.ts`
    - One call returning all five sections: overview, ideas and structure, opening, aacc, readiness
    - Findings carry a verbatim quote plus optional offsets so `matchQuote` can bind them
    - Leaves `/api/ai/analyze-statement-aacc` completely untouched
    - _Requirements: 11.2–11.8, 11.9_
  - [ ] 21.5 Create `POST /api/applications/[id]/statement/analyze/route.ts`
    - Ownership, Plus gate, `strategyAiLimiter`, idempotency, `maxDuration = 60`
    - Inserts an append-only `statement_analyses` row recording `content_version`
    - Emit `statement_analysis_started` / `statement_analysis_completed` / `statement_analysis_failed`
    - _Requirements: 16.3, 19.1_

- [ ] 22. Statement inline feedback and sections
  - [ ] 22.1 Build the inline feedback interaction
    - States: passage highlighted, item active, item resolved, suggestion accepted, suggestion dismissed, manual edit, suggested revision preview, no reliable text range
    - Each item shows category, explanation, relevant quote, suggested action, optional suggested revision
    - `Accept` / `Dismiss` / `Edit manually` via `SuggestionCard`; never replaces the full statement without explicit confirmation
    - Unmatched quotes render without a highlight rather than on the wrong text
    - Emit `statement_feedback_accepted` / `statement_feedback_dismissed`
    - _Requirements: 10.1–10.5, 19.1_
  - [ ] 22.2 Build the Overview section
    - What the essay communicates, strongest quality, most important issue, whether it answers the prompt — a few clear cards or rows
    - _Requirements: 11.2_
  - [ ] 22.3 Build Ideas and Structure reproducing its approved design
    - Central idea, story selection, logical progression, evidence, reflection, programme connection, prompt coverage, repetition
    - _Requirements: 11.3_
  - [ ] 22.4 Build Opening and Engagement
    - Clarity, specificity, authenticity, reader orientation, relevance, unnecessary gimmicks; same finding-list treatment as Ideas and Structure
    - _Requirements: 11.4_
  - [ ] 22.5 Build the AACC section
    - Four pillars with score, explanation, evidence, missing evidence, recommended improvement
    - Framing sentence displayed; score as small secondary text beside the pillar name, not a ring or bar; no overall score
    - _Requirements: 11.5, 11.6_
  - [ ] 22.6 Build Statement Readiness
    - Checks prompt answered, word limit, placeholder text, incomplete sentences, unsupported claims, profile contradictions, repeated sections, missing programme references, unresolved critical feedback
    - Resolves to `Needs attention` or `Ready for Submit Audit`; presented as a statement-level check, not the full Submit Audit
    - _Requirements: 11.7, 11.8_
  - [ ] 22.7 Mobile adaptation
    - Stack editor and feedback, keep active feedback near its passage where possible, horizontally scrollable or compact section nav
    - _Requirements: 14.5_
  - [ ] 22.8 Test the statement flow
    - Route: analyze success, provider failure, ownership, version recorded
    - Component: highlight binding, unmatched fallback, accept/dismiss, AACC framing present and no overall score rendered
    - _Requirements: 21.1_

### Phase 7: Completion, mobile, accessibility

- [ ] 23. Completion and Submit Audit handoff
  - [ ] 23.1 Wire real status into the overview
    - `cvStatus` / `statementStatus` / `strategyStatus` fed from live data; persist `application_strategies.status`
    - _Requirements: 2.4, 2.5, 12.1_
  - [ ] 23.2 Build the complete state
    - CV ready, PDF generated, statement ready, remaining non-blocking suggestions, last-updated dates; primary action `Continue to Submit Audit`
    - Emit `strategy_ready_for_audit`
    - _Requirements: 12.1, 19.1_
  - [ ] 23.3 Build the partial and outdated states
    - Partial: primary action targets the highest-priority unfinished item, via `nextAction`
    - Outdated: mark affected analyses outdated and name which review to refresh; never silently mark a document incomplete
    - _Requirements: 12.2, 12.3, 12.4_

- [ ] 24. Mobile, accessibility and shared states audit
  - [ ] 24.1 Audit every screen for hover independence
    - No interaction may depend on hover; every hover affordance has a focus/tap equivalent
    - _Requirements: 14.1_
  - [ ] 24.2 Complete the mobile adaptations
    - Overview: stacked cards, visible status and next action, no dense sub-status grids
    - Verify the CV editor, assessment, layout and statement adaptations from earlier phases at 375px
    - _Requirements: 14.2–14.6_
  - [ ] 24.3 Accessibility pass
    - Keyboard reachability across the CV editor's reorder controls, the layout radiogroup and the feedback list
    - Status conveyed by text plus icon everywhere; visible focus rings; accessible names on icon-only controls
    - Note that full WCAG validation needs manual assistive-technology testing and expert review
    - _Requirements: 2.8, 7.4, 14.1_
  - [ ] 24.4 Verify every shared state has exactly one recovery action
    - Walk the full Requirement 13 list against `ui/states.tsx`
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 25. End-to-end verification
  - [ ] 25.1 Add the Playwright spec
    - Overview → target profile → content → review → layout → statement
    - Extend `tests/e2e/auth-gates.spec.ts` to cover the new routes
    - _Requirements: 21.1_
  - [ ] 25.2 Confirm the scenario matrix is covered
    - Success; incomplete data; stale results; unreadable file; AI failure; export failure; ownership rejection
    - _Requirements: 21.1_
  - [ ] 25.3 Full verification
    - `npm run typecheck`, `npm run typecheck:strict`, `npm run lint`, `npm test`, `npm run build`
    - Confirm coverage thresholds in `vitest.config.ts` were not lowered
    - _Requirements: 21.2, 21.3, 21.4_
  - [ ] 25.4 Reuse audit
    - Confirm no competing primitive was created and that every item in Requirement 20.1 is used where applicable
    - _Requirements: 20.1, 20.2, 20.3_

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "name": "Decisions",
      "tasks": ["0.1", "0.2", "0.3", "0.4"],
      "dependsOn": []
    },
    {
      "wave": 2,
      "name": "Foundation — schema, guard, domain, analytics",
      "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "3.5", "5.1", "5.2"],
      "dependsOn": ["0.1"]
    },
    {
      "wave": 3,
      "name": "Foundation — repository, chrome, shared UI",
      "tasks": ["4.1", "4.2", "4.3", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6"],
      "dependsOn": ["1.1", "1.2", "2.1", "3.1", "3.2", "3.5"]
    },
    {
      "wave": 4,
      "name": "Strategy API and overview",
      "tasks": ["7.1", "7.2", "7.3", "7.4"],
      "dependsOn": ["4.1", "5.1", "6.2", "6.5"]
    },
    {
      "wave": 5,
      "name": "Target Profile",
      "tasks": ["8.1", "8.5", "8.2", "8.3", "8.4", "9.1", "9.2", "9.3", "9.4", "9.5"],
      "dependsOn": ["4.2", "6.5", "6.6", "7.4", "0.4"]
    },
    {
      "wave": 6,
      "name": "CV Content and import",
      "tasks": ["10.1", "10.2", "11.1", "11.2", "11.3", "12.1", "12.2", "12.3", "12.4", "12.5", "12.6", "13.1", "13.2", "13.3", "13.4", "13.5"],
      "dependsOn": ["8.2", "8.5", "6.5", "6.6"]
    },
    {
      "wave": 7,
      "name": "CV Assessment",
      "tasks": ["14.1", "14.2", "15.1", "15.2", "15.3", "15.4", "15.5", "15.6"],
      "dependsOn": ["10.1", "11.1", "8.2", "3.3"]
    },
    {
      "wave": 8,
      "name": "Layout and PDF",
      "tasks": ["16.1", "16.2", "17.1", "17.2", "17.3", "18.1", "18.2", "18.3", "18.4", "18.5", "18.6"],
      "dependsOn": ["0.2", "10.1", "14.2"]
    },
    {
      "wave": 9,
      "name": "Statement",
      "tasks": ["19.1", "19.2", "19.3", "19.4", "20.1", "20.2", "20.3", "20.4", "21.1", "21.2", "21.3", "21.4", "21.5", "22.1", "22.2", "22.3", "22.4", "22.5", "22.6", "22.7", "22.8"],
      "dependsOn": ["0.3", "0.4", "4.2", "6.5", "8.5", "7.4"],
      "note": "Independent of waves 6-8; may run in parallel with them once wave 5 lands."
    },
    {
      "wave": 10,
      "name": "Completion, mobile, accessibility, verification",
      "tasks": ["23.1", "23.2", "23.3", "24.1", "24.2", "24.3", "24.4", "25.1", "25.2", "25.3", "25.4"],
      "dependsOn": ["18.4", "22.6", "3.2"]
    }
  ]
}
```

```
0 (decisions)
├── 0.1 paywall ─────────► 8.4, 11.3, 14.2, 21.5   (every AI endpoint)
├── 0.2 pdf dependency ──► 17
├── 0.3 aacc pillars ────► 21.3
└── 0.4 language ────────► 9, 12, 22

Phase 1 — Foundation (no dependency outside Phase 0)
1 schema ──► 4 repository ──► 7 strategy API + overview
2 guard  ──► 7.1, and every route in Phases 2–6
3 domain ──► 4, 7.2, 23
5 analytics ──► every emit-bearing task
6 chrome/UI ──► 7.2, 9, 12, 15, 18, 20, 22
   6.1 ──► 6.2 ──► 7.2
   6.5 SuggestionCard ──► 12.5, 22.1
   6.6 use-autosave ──► 9.4, 12.6, 20.2

Phase 2 — Target Profile
8.1 ──► 8.2 ──► 9
8.5 prompts ──► 8.3, 11.2, 14.1, 19.2, 21.4
8.3 ──► 8.4 ──► 9.3

Phase 3 — CV Content            (needs 6.5, 6.6, 8 complete)
10 ──► 11 ──► 12 ──► 13
10.1 SECTION_FIELDS ──► 12.4, 14.1 (targetSection validity)

Phase 4 — Assessment            (needs 10, 11, 8.2)
14.1 ──► 14.2 ──► 15
3.3 staleness ──► 15.4

Phase 5 — Layout and PDF        (needs 0.2, 10, 14)
16 ──► 17 ──► 18
16.1 recommendLayout ──► 18.3

Phase 6 — Statement             (needs 0.3, 6.5)
19 ──► 20 ──► 21 ──► 22
21.1 quote-match ──► 22.1
21.3 aacc ──► 21.4 ──► 22.5

Phase 7 — Completion            (needs Phases 1–6)
23 ──► 24 ──► 25
```

Phases 2–5 (CV) and Phase 6 (Statement) are independent of each other once Phase 1 lands, so they can proceed in parallel. Phase 7 needs both.

## Notes

**Migration is manual.** This repository has no `supabase/migrations/` directory and no automated runner. `supabase-application-strategy.sql` goes in the repo root and is applied by hand in the Supabase SQL editor, like the other 33 migrations. Task 1.3 exists because "wrote the file" is not "the table exists".

**One new dependency.** `@react-pdf/renderer` (task 0.2). Nothing else is added. `unpdf` already handles reading PDFs; it cannot write them.

**Four missing primitives are created once, in task 6.5.** `Panel`, `StatusPill`, `AutosaveStatus`, `SuggestionCard`, `CvSteps` and the states module. Everything else comes from `@/shared/ui`. Requirement 20.2 forbids competing versions of existing primitives, and task 25.4 audits it.

**The brand accent is Rose 600, not coral.** `bg-brand` / `text-fg-brand` / `border-brand`. The source specification says "coral-red/pink"; the repository has no coral token and none should be added.

**Two things must not be disturbed.** The static `/ai-strategy/reflection` routes beside the new `[applicationId]` segment (asserted by task 6.4), and the VinUni `/api/ai/analyze-statement-aacc` endpoint, which scores a different four pillars and has its own consumers.

**Parallelisation caution.** Tasks 12 (CV editor) and 22 (statement feedback) both consume `SuggestionCard`. Land 6.5 before either starts, or the two will fork it.
