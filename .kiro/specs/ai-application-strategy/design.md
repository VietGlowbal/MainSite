# Design Document: AI Application Strategy (Feature 2)

## Overview

Feature 2 adds a document workspace under `/ai-strategy/[applicationId]` with two workflows — CV (four steps) and Personal Statement (five analysis sections) — plus an overview that reports the state of both and hands off to Submit Audit.

The design is shaped by four constraints found in the existing codebase:

1. **`/ai-strategy` ships its own chrome.** `src/components/nav-reveal.tsx` lists `/ai-strategy` in both `OWN_CHROME_ROUTES` and `OWN_CHROME_PREFIXES`, so no app header is rendered for any descendant. Every new page must wrap itself. `reflection-chrome.tsx` already does exactly this and is generalised rather than copied.
2. **Ownership is inline, per route.** There is no `requireUser()` or `assertOwnsApplication()` helper; every API route repeats `.eq('id', id).eq('user_id', user.id)`. Feature 2 adds ~14 endpoints, so one shared guard is introduced instead of fourteen copies.
3. **AI output is JSON-mode plus manual coercion, not zod-parsed.** `src/lib/course-parser/extract-course.ts` is the reference: an explicit JSON schema in the request, then hand-written normalisation. zod is reserved for HTTP bodies. Feature 2 follows this.
4. **Versions, not timestamps, decide staleness.** An analysis stores the content version it ran against. Comparing integers is deterministic; comparing timestamps is not, because an autosave that changes nothing would invalidate a good review.

## Architecture

```
src/features/application-strategy/          ← new feature module
  domain/                                    ← pure logic, no I/O (node test project)
    index.ts
    status.ts                 workspace status derivation, Status_Vocabulary
    cv-sections.ts            section catalogue, per-section field relevance, reorder
    cv-layouts.ts             the three layout definitions + recommendation rule
    staleness.ts              version comparison → outdated flags
    target-profile.ts         field catalogue, origin labels, zod schemas
    statement-sections.ts     analysis section catalogue + nav
    aacc.ts                   four pillars, score framing copy
    quote-match.ts            offset → verbatim-quote re-matching
    types.ts                  all entity + view-model types
  api/                                       ← server-only data access
    index.ts
    strategy-repository.ts    read/write the six tables
    context.ts                ApplicationStrategyContext assembler
  ui/                                        ← client components
    index.ts
    strategy-chrome.tsx       Glowbal_Chrome for the whole subtree
    cv-steps.tsx              four-step CV progress indicator
    autosave-status.tsx       Saving / Saved / Could not save
    suggestion-card.tsx       Suggestion_State (original / suggested / accept…)
    ...one file per screen section
  hooks/
    use-autosave.ts
    use-cv-draft.ts

src/lib/ai/strategy/                         ← model calls, one per operation
  target-profile.ts
  cv-review.ts
  cv-entry-suggestion.ts
  statement-brief.ts
  statement-analysis.ts
  prompts.ts                                 shared trust rules + source-citation block

src/lib/cv-pdf/                              ← layout renders + export
  academic.tsx  technical.tsx  leadership.tsx  render.ts  paginate.ts

src/server/auth/application-owner.ts         ← the shared ownership guard
src/lib/analytics/track.ts                   ← application_events writer

src/app/ai-strategy/[applicationId]/
  layout.tsx                page shell + chrome + ownership, once
  page.tsx                  Requirement 2 overview
  cv/target-profile/page.tsx
  cv/content/page.tsx
  cv/review/page.tsx
  cv/layout/page.tsx
  statement/page.tsx        sections driven by ?section=

src/app/api/applications/[id]/
  strategy/route.ts
  cv/route.ts  cv/import/route.ts  cv/review/route.ts  cv/export/route.ts
  cv/target-profile/route.ts  cv/target-profile/generate/route.ts
  statement/route.ts  statement/brief/route.ts  statement/analyze/route.ts

supabase-application-strategy.sql            ← flat root migration, repo convention
```

The `src/features/*` boundary rules in `eslint.config.mjs` apply: `ui` may not import `api`, and deep imports past a barrel are errors. Server components read through `api/`, pass plain data into `ui/` components.

## Route collision

`/ai-strategy/[applicationId]` sits beside the existing static `/ai-strategy/reflection`. Next.js resolves static segments before dynamic ones, so `reflection` and `reflection/achievements` keep working. This is load-bearing and easy to break, so it is asserted by a test rather than left to convention.

## Components and Interfaces

### Chrome and shell

`reflection-chrome.tsx` hardcodes the reflection flow's nav labels. Rather than fork it, its body is extracted into `src/features/application-strategy/ui/strategy-chrome.tsx` with a `containerClassName` prop (the CV Content and Layout screens need wider than `max-w-4xl`), and `ReflectionChrome` becomes a thin caller. This keeps one chrome definition for the whole `/ai-strategy` subtree.

`src/app/ai-strategy/[applicationId]/layout.tsx` does the work every page in the subtree needs exactly once: resolve the session, load the application with the ownership predicate, `redirect('/auth')` or `notFound()`, then render chrome around `children`. Per-page server components then re-read only their own slice.

### Progress indicators

Two levels, and the subordination in Requirement 1.9 is achieved by size and placement, not by two competing steppers:

- **Global** — `Stepper` with `aiJourneySteps()` and `currentIndex={3}`, rendered by the layout at the top of every page. `AI_JOURNEY.strategy.href` becomes `/ai-strategy` (the journey entry), not a per-application URL, because the journey definition is application-agnostic.
- **CV steps** — `CvSteps`, a new compact four-item indicator in `ui/cv-steps.tsx` driven by `CV_STEPS` in `domain/cv-sections.ts`. It uses `ProgressBar` plus a small step badge, matching `ReflectionShell`, rather than a second full `Stepper`.
- **Statement sections** — the existing horizontal treatment, rendered as a scrollable tab row of links to `?section=`.

### Status derivation

`domain/status.ts` is the single owner of the Status_Vocabulary. It is pure, so it is unit-tested directly and the overview, the workspace cards and the handoff cannot disagree.

```ts
export type WorkspaceStatus = 'not_started' | 'in_progress' | 'needs_attention' | 'ready_for_audit';

export type CvStatusInputs = {
  targetProfile: { generatedAt: string | null; filledFieldCount: number; version: number } | null;
  cv: { sectionCount: number; entryCount: number; contentVersion: number;
        selectedLayout: CvLayoutKey | null; lastExportedVersion: number | null } | null;
  review: { contentVersion: number; targetProfileVersion: number;
            missingSignalCount: number; criticalCount: number } | null;
};

export function cvStatus(i: CvStatusInputs): WorkspaceStatus;
export function statementStatus(i: StatementStatusInputs): WorkspaceStatus;
export function strategyStatus(cv: WorkspaceStatus, st: WorkspaceStatus): WorkspaceStatus;
/** The single next action for the overview, so the two cards cannot both claim primacy. */
export function nextAction(cv: WorkspaceStatus, st: WorkspaceStatus): { href: string; label: string };
```

Rules: `not_started` when nothing exists; `needs_attention` when a review reports critical missing signals, or a stored analysis is outdated, or readiness fails; `ready_for_audit` when the CV has a review with no critical gaps, a selected layout and a current export, and the statement's readiness check passes; `in_progress` otherwise.

Status is rendered by a small `StatusPill` that always pairs a `KitIcon` with the text label — never colour alone (Requirement 2.8).

### Cards

`src/shared/ui` has no `Card`, and `src/components/ui/card.tsx` is from the older generation. The new screens use the treatment the approved frames actually show — `rounded-gb-2xl border border-line bg-surface p-gb-3xl`, no shadow — expressed once as `ui/panel.tsx` (`Panel`, `PanelHeader`) so the ~15 places that need it cannot drift. `ReflectionSection`'s `bg-surface-muted` variant is kept for form groupings inside the Target Profile page, matching its approved design.

### Suggestion_State

`ui/suggestion-card.tsx` is the only path by which AI text reaches a student. It renders original text, suggested text and Accept / Dismiss / Edit manually, and it has no API that applies a suggestion without one of those three being pressed. Both the CV entry suggestions (Requirement 4.10) and the statement revisions (Requirement 10.3) go through it, which is what makes "never silently replace" a structural property rather than a discipline.

### CV content editor

Section and entry shape live in `domain/cv-sections.ts`:

```ts
export type CvSectionKind =
  | 'contact' | 'education' | 'experience' | 'activities' | 'projects' | 'research'
  | 'awards' | 'skills' | 'certifications' | 'publications' | 'interests' | 'custom';

export type CvEntryField =
  | 'organization' | 'role' | 'location' | 'startDate' | 'endDate' | 'current'
  | 'bullets' | 'evidence' | 'linkedProfileItem';

/** Requirement 4.6 — only relevant fields per section type. */
export const SECTION_FIELDS: Record<CvSectionKind, readonly CvEntryField[]>;
export const OPTIONAL_SECTIONS: readonly CvSectionKind[];
export const RENAMEABLE_SECTIONS: readonly CvSectionKind[];  // 'custom' only
export function reorder<T>(items: T[], from: number, to: number): T[];
export function essentialGaps(sections: CvSection[]): string[];  // Requirement 4.11 warning
```

Reordering uses move-up / move-down buttons with `aria-label`s, not drag-and-drop: the design authority forbids complex drag-and-drop, and buttons are the only option that satisfies both keyboard access and Requirement 14.3's touch target. Entries are collapsed by default and expand one at a time.

The editor is a client component holding the whole `StructuredCv` in state, autosaving via `use-autosave.ts` (debounced `PATCH /api/applications/[id]/cv`, 1200 ms, last-write-wins with the server returning the new `content_version`). `use-autosave.ts` is generic and is also used by the Target Profile page and the statement editor, so `Saving` / `Saved` / `Could not save` behaves identically in all three.

### CV import

Upload reuses `useDocumentUpload()` with `kind: 'cv'` and `FileDropzone`; text extraction reuses `extractDocumentText`. The new work is the confirmation step.

`POST /api/applications/[id]/cv/import` takes `{ documentId }`, extracts text (caching to `uploaded_documents.parsed_text`), asks the model to split it into the section/entry shape with a per-field `certain: boolean`, and returns a **draft** — it does not write `structured_cvs`. The student confirms on screen, and confirmation is what persists. That ordering is what makes Requirement 5.7 (no silent overwrite) true by construction.

Uncertain fields carry `Please check`. When extraction returns `null` — DOCX, scanned PDF, image-only — the response is `{ ok: false, reason: 'unreadable' }` and the UI shows the four fallbacks including a paste-text path that feeds the same confirmation screen.

Parsing states are real, not simulated: `Uploading` while the storage call is in flight, `Reading document` while extraction runs, `Organizing content` while the model call runs, `Ready to review` on response. No percentage is shown, for the reason already documented in `use-document-upload.ts`.

### CV layouts and PDF

`domain/cv-layouts.ts` defines the three layouts as data — section order, which sections are promoted, which are suppressed, and the density — so "genuinely different" is enforced by the definition rather than by three similar templates:

```ts
export type CvLayoutKey = 'academic' | 'technical' | 'leadership';
export type CvLayoutDef = {
  key: CvLayoutKey;
  label: string;
  blurb: string;
  /** Full section order. Differs materially between layouts. */
  order: readonly CvSectionKind[];
  /** Rendered with expanded detail. */
  emphasise: readonly CvSectionKind[];
  columns: 1 | 2;
};
export function recommendLayout(tp: CvTargetProfile, cv: StructuredCv): { key: CvLayoutKey; reason: string };
```

`recommendLayout` is deterministic and derived from the Target Profile's `priorityCapabilities` and where the CV's evidence actually sits. It returns the one-sentence reason, so Requirement 7.5's explanation is real strategy information rather than model prose.

`src/lib/cv-pdf/` holds one `@react-pdf/renderer` document per layout, sharing a stylesheet built from the design tokens. `POST /api/applications/[id]/cv/export` renders to a buffer, uploads to `student-documents/{userId}/cv-exports/{strategyId}-v{contentVersion}.pdf`, and records `last_exported_version`. Keying the object name on the version makes "export outdated" a comparison rather than a guess, and makes re-export idempotent.

The on-screen preview renders the same layout definitions as HTML with a fixed A4 aspect page box, so preview and PDF share section order and emphasis. It does not attempt to be pixel-identical to the PDF; it is a fidelity-honest preview with page navigation and a zoom control.

Layout card selection is a `radiogroup` of `role="radio"` cards. Selected state = `border-brand` + a check `KitIcon` + the visible text `Selected`; recommended state = a `Badge` reading `AI recommended`. Both together render both, satisfying Requirement 7.4 without colour dependence.

### Statement

The editor is `StatementWriter`, reused with `saveTarget: { kind: 'application', applicationId }` — the prop already exists. Feature 2 adds around it:

- `StatementBriefPanel` — collapsible, compact by default (Requirement 8).
- `StatementSectionNav` — links to `?section=`.
- `StatementFeedbackList` + `InlineHighlight` — the inline feedback interaction.

Statement text stays in `personal_statements` (its existing home). `statement_analyses` is new and holds the five-section analysis. `statement_strategies` holds the prompt, word limit and brief.

**Quote re-matching.** `domain/quote-match.ts` resolves a Feedback_Item to a range:

```ts
export type QuoteMatch =
  | { kind: 'offset'; start: number; end: number }
  | { kind: 'rematched'; start: number; end: number }
  | { kind: 'unmatched' };

export function matchQuote(
  text: string,
  item: { quote: string; start?: number | null; end?: number | null },
): QuoteMatch;
```

Order: trust the stored offsets when the substring at that range still equals the quote; otherwise search for the verbatim quote (first occurrence, then whitespace-normalised); otherwise return `unmatched` and the UI shows the feedback with no highlight. It never falls back to a fuzzy or nearest match, because attaching feedback to the wrong sentence is worse than attaching it to nothing (Requirement 10.5).

**AACC.** `domain/aacc.ts` defines Academic / Activities / Character / Contribution, the per-pillar shape (score, explanation, evidence, missing evidence, recommended improvement) and the fixed framing string. The score renders as small text beside the pillar name — not a `ScoreRing`, not a bar — so it stays visually secondary to the explanation (Requirement 11.6). There is no overall score field in the type at all, which is the cheapest way to guarantee one is never displayed.

The existing `/api/ai/analyze-statement-aacc` route is untouched. The new prompt lives in `src/lib/ai/strategy/statement-analysis.ts`.

## Data Models

One migration, `supabase-application-strategy.sql`, idempotent, following `supabase-reflection.sql`'s style: `IF NOT EXISTS` everywhere, `TEXT` + `CHECK` instead of enum types, one `<table>_owner` `FOR ALL` policy per table guarded by a `pg_policies` lookup.

| Table | Key columns | Notes |
|---|---|---|
| `application_strategies` | `id`, `user_id`, `application_id UNIQUE`, `status`, timestamps | One per application (Requirement 15.4). |
| `cv_target_profiles` | `strategy_id`, the seven nullable text fields, `missing_information JSONB`, `sources_used JSONB`, `version INT`, `generated_at` | `version` increments on every field change. |
| `structured_cvs` | `strategy_id`, `source_document_id`, `sections JSONB`, `selected_layout`, `content_version INT`, `last_reviewed_version INT`, `last_exported_version INT` | Sections as JSONB: they are always read and written whole, and per-entry rows would buy nothing but joins. |
| `cv_reviews` | `cv_id`, `target_profile_version`, `content_version`, `strengths JSONB`, `missing_signals JSONB`, `summary`, `model`, `created_at` | Append-only; latest row wins. |
| `statement_strategies` | `strategy_id`, `prompt`, `word_limit`, `brief JSONB`, `source_urls JSONB` | |
| `statement_analyses` | `statement_id`, `content_version`, `overview JSONB`, `ideas_and_structure JSONB`, `opening JSONB`, `aacc JSONB`, `readiness JSONB`, `model`, `created_at` | Append-only. |

`user_id` is denormalised onto every table so the RLS policy is a single-column check with no subquery, matching the existing tables.

Reviews and analyses are append-only rather than updated in place. It costs a few rows and it means "your CV changed since this review" can name what the review was actually run against.

## Shared AI context

`src/features/application-strategy/api/context.ts`:

```ts
export async function assembleStrategyContext(
  supabase: SupabaseClient, admin: SupabaseClient, userId: string, applicationId: string,
): Promise<ApplicationStrategyContext>;
```

It reads `student_profiles`, `student_achievements`, `student_activities`, `course_applications` + `courses`, `application_sources`, `uploaded_documents` and `personal_statements`; extracts and caches CV/statement text through `extractDocumentText`; and returns the exact shape from the source specification plus a `notes: string[]` carrying "uploaded but unreadable" facts (Requirement 17.4), copying the approach already proven in the match-insights route.

Every operation in `src/lib/ai/strategy/*` takes this context. None of them touch Supabase. That makes each one a pure function of context plus prompt, so they are testable with a fixture and a stubbed model client.

`src/lib/ai/strategy/prompts.ts` holds the trust-rules block appended to every system prompt (Requirement 18): use only confirmed information, cite programme sources, separate fact from interpretation, leave fields empty rather than invent, never state or imply admission likelihood.

## API design

All routes follow one shape:

```ts
export const runtime = 'nodejs';
export const maxDuration = 60;            // AI routes only

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await requireApplicationOwner(id);        // 401 | 404 | { supabase, user, application }
  if ('response' in owner) return owner.response;

  const limited = applyRateLimit(strategyAiLimiter, owner.user.id, 'CV review');
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  // ...
}
```

`src/server/auth/application-owner.ts` is the one new auth helper. It runs the same query the existing routes run — `.from('course_applications').select('*, courses (*)').eq('id', id).eq('user_id', user.id).single()` — and returns either a ready `NextResponse` or the resolved client, user and application. Fourteen new routes is the point at which repeating that block stops being a convention and starts being a place for one of them to be wrong.

Two limiters are added to `src/lib/rate-limiter`: `strategyAiLimiter` for generation and analysis, and `strategyExportLimiter` for PDF export.

Idempotency: generation endpoints accept an `Idempotency-Key` header and reuse the `idempotency_keys` table already created for the course-selector feature. A repeated key returns the stored response instead of paying for another model call.

Provider errors are logged with `logError` and returned as one of three student-readable messages: `AI provider unavailable`, `Analysis failed. Please try again.`, `Export failed.` The raw provider body never leaves the server.

## Analytics

`src/lib/analytics/track.ts` exposes `trackApplicationEvent({ applicationId, userId, eventType, eventLabel?, metadata? })`, writing to `application_events` — a table whose type already exists in `src/lib/apply-types.ts` but which nothing currently writes. `metadata` is typed as a record of primitives, and the twenty event names from Requirement 19 are a union type, so an event cannot be emitted with document content in it or with a misspelled name.

## Error Handling

Every state in Requirement 13 maps to one component with one recovery action. They are grouped in `ui/states.tsx` so the copy is in one file:

| State | Recovery |
|---|---|
| Could not save | `Try again` (re-runs the pending autosave) |
| No parsed programme data | `Open course details` |
| No CV uploaded | `Upload a CV` |
| Unsupported / unreadable CV | `Paste CV text` |
| CV analysis outdated | `Re-run review` (+ `Continue to layout anyway`) |
| CV / statement analysis failed | `Retry` (+ `Continue editing`) |
| AI provider unavailable | `Try again shortly` |
| Export failed | `Retry export` |
| Application not found | `Back to your applications` |

## Correctness Properties

These are the invariants the design is built to make structurally true rather than merely intended. Each is the subject of a test.

### Property 1: Ownership is total

**Validates: Requirements 1.4, 1.5, 15.2**

No Feature 2 page or endpoint returns data for an application whose `course_applications.user_id` is not the caller's. Enforced twice: `requireApplicationOwner` in every route, and an owner RLS policy on all six tables. A page returns `notFound()` and an endpoint returns 404, so neither discloses that a non-owned application exists.

### Property 2: AI never overwrites student text

**Validates: Requirements 4.10, 10.3, 10.4, 18.5**

Every AI-produced string reaches the student through `SuggestionCard`, which exposes no apply path other than Accept. There is no code path from a model response to a persisted content field.

### Property 3: Staleness is decidable

**Validates: Requirements 6.7, 7.9, 9.3, 12.3, 15.5**

For any stored review or analysis, comparing its recorded integer version against the current content and Target Profile versions determines outdated-ness exactly. No timestamp comparison participates, so an autosave that changes nothing cannot invalidate a good review.

### Property 4: Feedback never points at the wrong text

**Validates: Requirements 10.5**

`matchQuote` returns a range only when the verbatim quote is present at that range. Failure yields `unmatched` and the UI drops the highlight — never a nearest or fuzzy match.

### Property 5: Import cannot silently destroy content

**Validates: Requirements 5.1, 5.7**

`POST .../cv/import` returns a draft and performs no write to `structured_cvs`. Only an explicit confirmation persists, and overwriting non-empty content requires a second confirmation.

### Property 6: No admission probability exists to display

**Validates: Requirements 11.6, 18.6**

`AaccAssessment` has no overall-score field and `CvReview` has no score field, so no aggregate can be rendered by accident.

### Property 7: Status has one owner

**Validates: Requirements 2.6, 2.7, 2.8, 12.1, 12.2**

The overview cards, the `application_strategies.status` column and the Submit Audit handoff all read from `domain/status.ts`. They cannot disagree about whether a document is ready.

### Property 8: Layouts differ structurally

**Validates: Requirements 7.2**

The three `CvLayoutDef.order` arrays are asserted to be pairwise different, so a label-only implementation fails the test suite.

### Property 9: Export outdated-ness is a comparison

**Validates: Requirements 7.9**

The exported object name embeds `contentVersion`, so `last_exported_version !== content_version` is exactly "the PDF is stale", and re-exporting the same version is idempotent.

### Property 10: Analytics carries no content

**Validates: Requirements 19.1, 19.2**

`metadata` is typed as a record of primitives and the event name is a closed union, so document text cannot be emitted and an event cannot be misnamed.

### Property 11: The existing routes are unaffected

**Validates: Requirements 1.6, 11.9**

`/ai-strategy/reflection` and `/ai-strategy/reflection/achievements` resolve unchanged beside the new dynamic segment, and `/api/ai/analyze-statement-aacc` is untouched.

## Testing Strategy

Placed to match the existing Vitest include globs.

**`node` project.** `domain/*.test.ts` for status derivation, staleness, section-field relevance, reorder, layout recommendation, quote re-matching and AACC framing — these carry most of the feature's logic and none of its I/O. `src/app/api/applications/[id]/**/__tests__/*.test.ts` for each route: 401 without a session, 404 for a non-owned application, 400 on a bad body, 429 when rate-limited, and the success shape.

**`dom` project.** `features/application-strategy/ui/*.test.tsx` for the overview cards' state-to-action mapping, the suggestion card's accept/dismiss/edit behaviour and its refusal to apply silently, layout selection without colour, keyboard reorder, and the collapsed-entry default.

**Scenario coverage (Requirement 21.1).** Success; a student with no profile and no CV; an analysis whose stored version is behind; a scanned PDF; a model call that throws; an export that fails mid-render; a request for another student's application.

**E2E.** One Playwright spec walking overview → target profile → content → review → layout → statement, plus the existing `auth-gates.spec.ts` extended to cover the new routes.

## Build order

Phases match the source specification. Each ends in a state that typechecks, lints and passes tests.

1. **Foundation** — migration, RLS, ownership guard, context assembler, analytics, chrome extraction, status derivation, overview.
2. **Target Profile** — existing design, generation, editing, autosave, generated and incomplete states.
3. **CV Content and import** — the editor, the structured model, upload, extraction, confirmation, manual fallback, per-entry suggestions.
4. **CV Assessment** — the existing design, the review call, evidence links, missing-signal actions, loading/stale/failure states.
5. **Layout and PDF** — three layouts, selection states, recommendation, preview, export, version and failure states.
6. **Statement** — brief, editor integration, inline feedback, Overview, Ideas and Structure, Opening, AACC, Readiness.
7. **Completion** — status integration, partial and complete states, Submit Audit handoff, mobile, accessibility, end-to-end.
