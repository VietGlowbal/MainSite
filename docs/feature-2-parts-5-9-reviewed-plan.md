# Feature 2 — GlowBal Strategy: Execution-Ready Delivery Plan (Parts 5–9)

> **For Agent Execution**
>
> Implement task-by-task with strict TDD. Read the repository's canonical architecture/spec/status files before changing contracts. Where this plan and the current code disagree, **the code wins**, but any deviation from the canonical Feature 2 contracts must be documented before proceeding.

**Scope:** Parts 5–9 only: Planner mobile/reminders, Planner task UI productization, CV + Essay consolidation, Strategy Master homepage, Scholarships, and Final Check.

**Continuation contract from Parts 0–4:** This plan assumes the execution-ready Parts 0–4 plan is the upstream contract. In particular, F8 Strategy Report and Planner handoff must already have stable roadmap seed identity, idempotent reconciliation, student override preservation, and the initial GenUI block vocabulary required by Strategy output.

**Primary goal:** Complete the post-report application workflow without creating duplicate product surfaces, breaking existing persisted work, overwriting user-authored state, or inventing UI/spec behavior where the source plan explicitly says assets or decisions are still missing.

**Architecture constraints:**

- Feature-Sliced Design remains authoritative: `src/features/*`, `src/shared/*`, `src/server/*`, `src/app/*`.
- Existing application-owned persisted models must remain the source of truth; do not create a second data model merely to simplify a UI merge.
- Planner-generated state and user-owned state must remain distinguishable.
- Persisted GenUI block types are a versioned/backward-compatible contract.
- Mobile Planner work must introduce a deliberate mobile interaction model, not only smaller breakpoints.
- Reminder delivery must reuse the existing email/outbox/cron/idempotency system described by the repository; do not build a parallel notification stack.
- CV and Essay work is a consolidation/migration project, not a set of cross-links between duplicate tools.
- Strategy Master homepage work remains blocked until the newer design is available.
- Scholarships remains blocked on a product/spec contract; do not infer one from the global catalogue alone.
- Final Check must aggregate canonical state rather than duplicating report/CV/Essay evaluation logic.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, Supabase/Postgres/RLS, Vitest, Zod, existing Resend email infrastructure.

---

# 0. Pre-implementation contract and ownership audit

Do this before Part 5. Parts 7–9 contain explicit blockers in the source plan, so execution must distinguish **ready**, **conditionally ready**, and **blocked** work before code changes begin.

## 0.A Read canonical sources

Read and reconcile at minimum:

- `docs/current-status.md`
- `docs/ai-strategy-canonical-architecture.md`
- `docs/ai-strategy-route-audit.md`
- `docs/known-issues.md`
- `docs/email-system.md`
- `docs/strategy-reports-spec.md`
- current Planner route/data/task documentation
- current CV and Essay route/data documentation
- current Strategy Hub implementation and any newer supplied design/prototype/Figma assets
- current global scholarships catalogue implementation/data contract
- current Final Check proposal in the Strategy report spec

Also read the completed Parts 0–4 implementation and tests, especially:

- F8 Execution Roadmap schema
- roadmap task seed identity
- `reconcileSeeds`
- new GenUI block schemas/renderers
- student override persistence
- Planner deep-link/tool mapping

## 0.B Repository-wide symbol and route audit

Before editing, search for all producers/consumers of:

- `planner-board`
- Planner calendar views/components
- Planner task status enums
- task due dates / reminders
- `deadlineReminderEmail`
- `deadline_reminders`
- `weekly_strategy_digest`
- email outbox / cron runner / delivery log
- `reconcileSeeds`
- `content-block.tsx`
- `structured_table`
- `long_text`
- `checklist`
- `editable_priority_grid`
- `comparison_table`
- `narrative_theme_map`
- `phase_timeline`
- `/apply/[id]/cv`
- `/ai-strategy/[id]/cv/*`
- `application_strategies`
- `cv_target_profiles`
- `structured_cvs`
- `cv_reviews`
- statement/essay analysis routes and persistence
- Strategy Hub routes/components under `src/features/marketing/ui/strategy-hub/`
- scholarship catalogue routes/services/tables
- all `locked: true` navigation items
- any existing Final Check symbols/routes/tables

**Gate:** Build a route/data ownership map before moving or deleting any CV/Essay surface.

## 0.C Ownership/concurrent-development audit

The source plan explicitly gates CV and Essay work on whether Andrew is still actively working on those systems.

Before Part 7:

1. inspect current branches/PRs/commits or the team's canonical ownership signal;
2. identify active owners of both CV systems and all Essay/statement shells;
3. freeze the merge boundary or coordinate the handoff;
4. record which implementation becomes the canonical UX and which persisted model becomes canonical.

**Hard gate:** If either system is still under conflicting active development, do not start the merge/migration. Parts 5, 6 and eligible Part 9 work may continue.

## 0.D External asset/spec gates

Record each item as `READY`, `CONDITIONAL`, or `BLOCKED`:

| Area | Required input | Rule |
| --- | --- | --- |
| Planner mobile | Current Planner implementation | Ready after code audit |
| Planner reminders | `docs/email-system.md` + existing email infra | Ready after contract audit |
| Planner task UI | Real F8/Planner output from Part 4 | Ready only after the Part 4 block/seed contract is stable |
| CV + Essay | Ownership clear + route/data audit | Conditional |
| Strategy Master homepage | Newer design/prototype/Figma | Blocked until asset lands |
| Scholarships | Product/spec contract | Blocked until spec exists |
| Final Check | Approved Final Check scope | Conditional on spec sign-off |

Do not convert `BLOCKED` into guessed implementation.

## 0.E Cross-part invariants

Lock these in tests and/or implementation notes:

1. Planner task completion and user edits survive regeneration, reminder runs, and UI upgrades.
2. Reminder jobs are idempotent: the same reminder window cannot enqueue duplicate mail for the same user/task/policy slot.
3. Disabled email preferences are respected before enqueue.
4. Planner mobile and desktop operate on the same task source of truth.
5. Unknown GenUI block versions/types degrade safely instead of crashing the Planner.
6. Persisted GenUI block contracts remain readable after new renderer versions ship.
7. CV consolidation preserves existing persisted CV data, exports, review history, and staleness semantics unless an explicit migration says otherwise.
8. Essay consolidation preserves existing drafts/analysis/review state and does not fork content across two canonical stores.
9. Navigation from Planner into CV/Essay/Final Check preserves the application ID/context.
10. Strategy Hub redesign must not silently alter workflow state semantics, locked/unlocked logic, or canonical routes.
11. Scholarships must not claim personalized eligibility/ranking unless the approved product contract and data support it.
12. Final Check must read canonical outputs and completion states; it must not independently re-score F5/F8/CV/Essay unless the approved spec explicitly defines a separate framework.

---

# Part 5 — Planner: Mobile UX and Reminder Delivery

## Outcome

Planner is genuinely usable on mobile, and task deadlines produce policy-compliant, preference-aware, idempotent reminders through the existing email infrastructure.

## Task 5.1 — Characterize the current Planner domain contract

Before changing layout or reminders, write/update tests covering the Planner behaviors that must survive the work.

### Audit

Determine the canonical current definitions for:

- task identity
- application ownership
- status columns/order
- task ordering within a status
- due dates/timezone semantics
- completed/archived state
- manually edited vs generated fields
- calendar grouping rules
- task detail/edit actions
- Planner route/query state
- roadmap-generated task provenance

### Characterization tests

At minimum cover:

- moving a task between statuses
- editing title/notes/due date where supported
- marking complete
- reopening a completed task if supported
- task ordering
- calendar date placement
- roadmap-generated task rendering
- unknown/malformed optional GenUI content degrading safely

**Acceptance criteria:** Mobile or reminder work cannot accidentally redefine task semantics.

---

## Task 5.2 — Define a deliberate mobile Planner interaction model

The existing responsive grid is not sufficient. Do not solve mobile by stacking all five desktop Kanban columns vertically.

### Current problem to replace

The source plan identifies `planner-board.tsx` using a desktop-oriented grid such as:

```tsx
md:grid-cols-3 xl:grid-cols-5
```

and a calendar side panel that disappears below the large breakpoint.

### Mobile UX contract

Choose one mobile pattern based on the current product design system and test it against real task counts. Recommended contract:

- one active status column/list visible at a time;
- status switcher via tabs/segmented control/dropdown, not five full stacked columns;
- task counts remain visible per status;
- current selection survives task edit/detail navigation where practical;
- quick task actions remain reachable by touch;
- drag-and-drop must have an accessible non-drag alternative;
- horizontal overflow is intentional only if the chosen design explicitly uses swipeable columns;
- empty states remain compact;
- no action requires hover.

Do not copy this pattern blindly if a newer canonical Planner mobile design exists.

### Tests

- all statuses reachable at narrow viewport
- status counts correct
- status change persists local route/UI state as designed
- keyboard/non-pointer status change works
- task can change status without drag
- long task titles do not break layout
- empty status works
- completed task remains accessible

---

## Task 5.3 — Rework Planner board responsive rendering

### Expected file

- `planner-board.tsx` and focused child components discovered during audit

### Implement

Separate domain data from viewport rendering:

- shared task selectors/state
- desktop Kanban presentation
- mobile presentation

Avoid two independent mutation implementations. Both presentations must call the same task mutation services/hooks.

### Requirements

- no duplicate fetch solely because both desktop/mobile JSX exists
- no desktop-only drag contract required for status mutation
- preserve optimistic update/rollback behavior
- preserve generated/user-owned field distinctions established in Part 4
- preserve scroll/focus when opening and closing task details where practical

### Acceptance criteria

- Mobile Planner can complete the primary task workflow without switching to desktop mode.
- Desktop behavior does not regress.

---

## Task 5.4 — Give calendar a real mobile pattern

Audit the current calendar component before choosing the presentation.

### Mobile requirements

The desktop side panel disappearing is not an acceptable final state. Mobile must still expose:

- selected-day tasks
- task count/indicators
- next/previous date navigation
- task detail/open action
- overdue/today/upcoming distinctions supported by current domain logic

Choose one canonical mobile pattern, for example:

- calendar followed by selected-day bottom sheet/list, or
- date strip + agenda list, or
- calendar with expandable day agenda

Use the existing design system if it already defines one.

### Tests

- select day → correct tasks
- month navigation
- timezone/date-boundary behavior
- no due-date task handling
- multiple tasks on one day
- narrow viewport smoke test

---

## Task 5.5 — Freeze the reminder policy from `docs/email-system.md`

Do not invent a new cadence.

### Canonical policy to verify

The source plan says the existing email system already defines:

- weekly digest preferred over one email per task;
- deadline reminders at 30 / 7 / 1 days;
- same-day low-priority items combined;
- `deadline_reminders` preference;
- `weekly_strategy_digest` preference;
- Resend outbox, idempotency, delivery logging and cron runner are already live;
- `deadlineReminderEmail` already exists but is not wired to Planner tasks.

Read the exact current policy and encode it as tests before implementation.

### Define reminder identity

Every enqueue must have a deterministic idempotency identity derived from canonical fields such as:

- user
- task
- reminder policy slot (`30d`, `7d`, `1d`, same-day batch, weekly digest)
- due-date revision/version if required by current email contract

Use the repository's existing outbox/idempotency mechanism rather than creating a parallel key scheme if one already exists.

---

## Task 5.6 — Implement Planner reminder eligibility as pure logic

Create/reuse a server-only pure policy function before wiring cron/outbox.

### Inputs

Use canonical fields discovered in the audit, including:

- task due date
- task status/completion
- priority if policy uses it
- user timezone
- current run time
- reminder preferences
- previously enqueued/delivered reminder identities if required by the existing outbox abstraction

### Output

Return explicit decisions, e.g. conceptually:

```ts
type ReminderDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'deadline'; slot: '30d' | '7d' | '1d'; taskId: string }
  | { kind: 'same_day_batch'; taskId: string }
  | { kind: 'weekly_digest'; taskId: string }
```

Use current repository naming/contracts.

### Required tests

1. 30-day eligibility
2. 7-day eligibility
3. 1-day eligibility
4. completed task excluded
5. archived/cancelled task excluded if applicable
6. no due date excluded
7. reminder preference disabled
8. weekly digest preference disabled
9. same-day low-priority batching
10. timezone boundary near midnight
11. DST behavior if user timezone infrastructure supports DST zones
12. changed due date invalidates/updates future schedule correctly
13. duplicate cron run produces no duplicate eligibility/enqueue

---

## Task 5.7 — Wire Planner reminders into the existing outbox/cron pipeline

### Do not build

- a new mail sender
- a new delivery log
- a second cron framework
- a second preference store

### Implement

Use the existing pipeline:

Planner tasks → eligibility/policy → existing outbox enqueue → existing Resend sender → existing delivery logging.

### Requirements

- user/application ownership respected
- only actionable tasks included
- preference checked before enqueue
- deterministic idempotency key
- bounded batch size/pagination for cron runs
- retry semantics delegated to existing outbox where possible
- failures logged through structured observability from Part 0
- one bad task/user cannot abort the entire cron batch

### Tests

- enqueue expected reminder
- no enqueue when preference off
- duplicate cron invocation
- one enqueue failure does not stop remaining candidates
- delivery payload links to the canonical Planner/application route
- stale/deleted application task is skipped safely

---

## Task 5.8 — Wire `deadlineReminderEmail` and weekly digest rendering safely

### Email requirements

- use canonical email components/templates
- task title/content escaped/rendered safely
- dates formatted in the user's canonical locale/timezone
- links preserve application context
- no sensitive internal metadata
- digest does not duplicate the same task in multiple low-priority sections unless policy explicitly requires it

### Snapshot/render tests

Prefer semantic assertions over brittle full snapshots:

- deadline and date visible
- canonical CTA route present
- multiple batched tasks render
- zero-task digest is not sent
- long task title does not break template generation

---

## Task 5.9 — Planner Part 5 regression pass

Run:

- focused Planner component tests
- reminder policy tests
- outbox integration tests
- email template tests
- relevant RLS/integration tests
- typecheck/lint/i18n/build

### Manual scenarios

**Mobile board:** create/move/edit/complete tasks across all statuses.

**Mobile calendar:** select days with 0/1/many tasks and open a task.

**Reminder:** use fixture tasks at 30/7/1-day boundaries and verify exactly one expected enqueue per policy slot.

**Preference:** disable reminder/digest preferences and verify no enqueue.

---

# Part 6 — Planner Task UI: GenUI Productization and Backward-Compatible Task Workspaces

## Outcome

Planner tasks can render and interact with richer Strategy-generated work products reliably, while old persisted task content continues to work and user progress survives report/task regeneration.

## Important boundary with Part 4

Parts 0–4 already establish the **initial** block vocabulary required by F8 and the roadmap reconciliation contract. Part 6 must **not** duplicate that work.

Part 6 is responsible for productizing that contract across the Planner:

- task-level interaction patterns;
- backward compatibility/version handling;
- robust malformed-data fallback;
- edit/progress persistence;
- migration/read strategy for old rows;
- quality/accessibility on desktop and mobile;
- only adding new block types when real Planner use cases require them.

---

## Task 6.1 — Audit the persisted task-content contract

### Search

Map every table/column/schema/parser/renderer that stores or reads task UI content.

Record for each:

- discriminant field (`type`, `kind`, etc.)
- payload schema
- version field, if any
- nullability
- whether validation occurs on write, read, or both
- fallback behavior
- user-edit/progress storage
- generated seed provenance

### Build a compatibility fixture matrix

Create representative fixtures for:

- `structured_table`
- `long_text`
- `checklist`
- `editable_priority_grid`
- `comparison_table`
- `narrative_theme_map`
- `phase_timeline`
- unknown future type
- known type with malformed payload
- old payload shape/version if historical rows exist

**Gate:** No renderer refactor until these fixtures can be parsed/rendered under tests.

---

## Task 6.2 — Make the GenUI schema explicitly versioned/backward compatible

If Part 4 already introduced a version field, use it. Otherwise, introduce the smallest backward-compatible strategy supported by existing rows.

### Rules

- persisted rows without explicit version remain readable as legacy version 1 where safely inferable;
- new writes use the current version;
- parsing is discriminated by type + version where required;
- old rows are not bulk rewritten solely for cosmetic reasons;
- unknown future versions render a safe unsupported/fallback surface instead of throwing;
- malformed rows are isolated to the affected content block, not the entire Planner page.

### Tests

- each legacy fixture
- each current fixture
- unknown type
- unknown version
- malformed payload
- optional field omission

---

## Task 6.3 — Define task-level ownership of generated content vs user state

For each interactive block, explicitly classify fields as:

- generated/read-only
- user-editable override
- user-progress state
- derived display state

### Example expectations

**`editable_priority_grid`**

- generated recommendation/base row data remains source-generated;
- user overrides persist separately;
- save failures do not discard local edits.

**`checklist`**

- generated checklist item identity is stable;
- checked/completed state is user-owned;
- regeneration preserves checked state for surviving semantic items.

**`phase_timeline`**

- generated phase names/objectives may update from source;
- explicit user progress/completed milestones must not regress.

Use actual current schemas after audit.

---

## Task 6.4 — Harden `content-block.tsx` into a renderer registry

If `content-block.tsx` has grown into a large switch/monolith, refactor to a typed registry without changing persisted behavior.

### Desired properties

- one parser/validator per block type/version
- one focused renderer per block type
- one standard fallback component
- exhaustive TypeScript handling for known current block types
- no renderer reads unvalidated raw JSON directly
- common save/error/loading/accessibility primitives reused

### Acceptance criteria

Adding a new block type requires a predictable set of files/tests, not edits spread across unrelated UI branches.

---

## Task 6.5 — Productize `editable_priority_grid`

### UX requirements

- clear editable vs generated fields
- per-row/per-field save state according to current persistence API
- optimistic update only with rollback/recovery
- keyboard accessible editing
- mobile layout that does not force a desktop-width table
- preserve student overrides from F8 regeneration
- optional reset-to-generated only if supported by product contract

### Concurrency

Prevent stale saves from overwriting newer edits using the same latest-write protection pattern adopted in Part 1/4.

### Tests

- edit/save/reload
- save failure
- out-of-order response
- F8 regeneration with stable ID
- mobile/narrow viewport
- keyboard operation

---

## Task 6.6 — Productize `comparison_table`

### Requirements

- semantic headers/row labels
- horizontal overflow or stacked mobile representation chosen deliberately
- no editable affordance unless schema says it is editable
- missing cells displayed as missing, not invented
- long text wrapping
- safe handling of uneven row/column lengths through validation/fallback

### Tests

- normal table
- missing optional cell
- long content
- narrow viewport
- malformed payload fallback

---

## Task 6.7 — Productize `narrative_theme_map`

### Requirements

- theme identity stable
- experience/evidence references traceable to canonical application/profile entities where possible
- do not present unsupported AI-generated evidence as source fact
- expandable/compact mobile presentation
- links into editable source experiences only when a canonical route exists

### Tests

- theme with multiple evidence items
- theme with no evidence
- missing target entity
- long theme text
- canonical deep link with application context

---

## Task 6.8 — Productize `phase_timeline`

### Requirements

- stable phase/milestone identity
- progress derived from canonical task state when linked to Planner tasks
- do not maintain a second independent completion truth if the Planner task already owns completion
- mobile vertical layout
- accessible current/completed/upcoming labels not conveyed by color alone

### Tests

- all phases untouched
- partial progress
- completed phase
- task state updates timeline
- removed/retired seed does not corrupt progress

---

## Task 6.9 — Preserve old rows and define migration policy

Only add a data migration if an existing persisted shape cannot be safely supported on read.

### Preferred order

1. backward-compatible reader
2. write current version for new rows
3. optional lazy migration on edit/write if safe
4. bulk migration only when necessary and proven reversible

### If migration is required

- backup/rollback strategy
- row count/audit query
- dry-run against staging
- validation before and after
- RLS-safe server path
- no data loss for unknown historical shapes

---

## Task 6.10 — Verify Planner task UI against real F8 outputs

Do not rely only on hand-authored fixtures.

Create several canonical F8 Strategy Reports, sync them into Planner, and verify:

- every generated block renders
- edits persist
- task status/progress survives F8 regeneration
- duplicate sync does not duplicate content/tasks
- malformed one block does not crash neighboring blocks
- mobile Planner renders the same task content meaningfully

---

# Part 7 — CV and Essay Consolidation

## Outcome

Each capability becomes one coherent product surface using the best current UX over one canonical persisted model, with existing user work migrated/preserved and Planner deep links pointing to the canonical workspace.

## Hard blocker

Do not start this part while another owner is actively changing either CV/Essay system without an agreed merge boundary.

The source plan explicitly says both systems work and neither problem is solved by merely linking them together.

---

## Task 7.1 — Freeze ownership and write a route/data consolidation decision record

Before code, record:

- active owner(s)
- current canonical branches/PRs
- chosen canonical CV UX route
- chosen canonical CV persisted model
- chosen canonical Essay UX route/workspace
- chosen canonical Essay persisted model
- migration approach
- compatibility/deprecation window

### Source-plan starting point to verify

CV appears to have:

- `/apply/[id]/cv` — better UX
- `/ai-strategy/[id]/cv/*` — stronger persisted model, including tables/concepts such as:
  - `application_strategies`
  - `cv_target_profiles`
  - `structured_cvs`
  - `cv_reviews`
  - export
  - staleness handling

The intended direction is **one product on the Apply UX over the AI Strategy data model**, then surfaced from Planner.

Do not assume this remains true without auditing current code/status.

---

## Task 7.2 — Characterize both CV systems end-to-end

Build a capability matrix before merging.

### Compare

- route/entry points
- document/input model
- target profile selection
- generation/editing flow
- review flow
- persistence
- export
- versioning/staleness
- application ownership
- autosave
- AI generation/review contracts
- error handling
- i18n
- mobile behavior
- Planner links

### Characterization tests

Protect existing high-value capabilities before moving UI onto the canonical model.

At minimum:

- load existing CV
- edit/save
- generate/review if supported
- export
- stale source detection
- application scoping

---

## Task 7.3 — Define canonical CV application service/domain boundary

Do not let the Apply UI reach into multiple raw tables ad hoc.

Create/reuse a focused server/domain layer that exposes the canonical operations needed by the selected UX, such as:

- get current CV workspace state
- update structured CV
- update target profile
- request generation/review
- detect staleness
- export

Use actual existing services if they already provide this abstraction.

### Requirements

- application ownership checked server-side
- validated DTOs
- no duplicate data write to legacy and canonical tables unless a temporary compatibility period explicitly requires it
- source/version lineage retained

---

## Task 7.4 — Move the preferred CV UX onto the canonical data model

### Migration approach

Prefer vertical slices rather than a big-bang rewrite:

1. load/read from canonical model
2. save edits to canonical model
3. generation/review on canonical model
4. export on canonical model
5. staleness on canonical model
6. remove legacy write path

### Preserve

- existing user content
- target profile
- review history where meaningful
- export availability
- stale-source semantics
- application routing

### Tests

- legacy-existing user opens merged workspace successfully
- new user creates CV
- edit/reload
- review
- export
- source profile change triggers canonical staleness behavior
- wrong application inaccessible

---

## Task 7.5 — Migrate/backfill CV data only where required

Do not create a migration until the route/data audit proves which existing rows require translation.

### Migration requirements

- deterministic source-to-target mapping
- idempotent rerun
- no overwrite of newer canonical data
- migration provenance if repository conventions support it
- row-count reconciliation
- rollback/backup plan
- dry run in staging

### Edge cases

- user has only Apply-system CV
- user has only AI-Strategy-system CV
- user has both with conflicting recent edits
- multiple CV versions
- incomplete/partially generated CV

For conflicts, follow a documented precedence rule or present a one-time recovery choice if product requirements demand it; never silently discard newer user work.

---

## Task 7.6 — Deprecate duplicate CV routes only after compatibility is proven

### Sequence

1. canonical route fully works
2. Planner links updated
3. internal links updated
4. old routes redirect safely preserving application context where appropriate
5. zero live writes to deprecated model
6. telemetry shows no unexpected callers if telemetry exists
7. remove old code only after the agreed compatibility window

Do not delete old persisted data in the same step as route deprecation.

---

## Task 7.7 — Audit all Essay/Statement shells and persistence

The source plan says Essay has the same structural problem as CV: several shells over shared statement analysis.

Map:

- every Essay/Statement route
- draft persistence
- analysis/review persistence
- generation entry points
- feedback/comment model
- version history
- application/programme scoping
- source-document relationships
- Planner links

Build a capability matrix like CV.

---

## Task 7.8 — Define one Essay workspace with writing and feedback modes

The target from the source plan is one workspace, not two products linked together.

### Workspace contract

One canonical application-scoped workspace should expose, according to current capabilities:

- **Writing mode** — draft/edit content
- **Feedback mode** — structured analysis/review/feedback

Both modes must operate on the same canonical draft/version identity.

### Rules

- feedback references the exact draft/version it reviewed
- editing after feedback can mark feedback stale instead of pretending it still applies
- generation must not overwrite a user's newer manual draft without explicit action
- autosave failure cannot discard local writing
- route preserves application/programme context

### Tests

- write/save/reload
- generate or import draft if supported
- request feedback
- feedback tied to exact version
- edit after feedback → staleness behavior
- switch modes without losing content
- error recovery

---

## Task 7.9 — Migrate Essay data and remove duplicate shells carefully

Use the same migration principles as CV:

- read compatibility first
- idempotent data migration only if necessary
- canonical write path before deprecation
- redirect/update internal links
- retain historical versions/feedback where supported

Do not delete a legacy route until all Planner/navigation entry points and known user data paths have moved.

---

## Task 7.10 — Surface canonical CV and Essay workspaces from Planner tasks

### Deep-link contract

Planner task recommendations must target the final canonical routes only.

Links must include:

- application ID
- programme/context if required
- task/return context only when the canonical route contract supports it

### Reconciliation

If older generated Planner tasks point at deprecated routes:

- resolve via redirects, or
- update generated-only deep-link metadata during safe reconciliation

Do not overwrite user-edited task notes/title simply to update a route.

### Tests

- new task → canonical CV route
- new task → canonical Essay route
- old task link remains recoverable
- return to Planner/application context works

---

## Task 7.11 — CV + Essay consolidation regression pass

Manual matrix:

### CV

- existing legacy user
- canonical-model user
- conflicting dual-system user fixture
- generate/edit/review/export
- source changes/staleness
- Planner → CV → Planner

### Essay

- existing draft
- writing mode
- feedback mode
- stale feedback after edit
- generation/review failure
- Planner → Essay → Planner

**Gate:** No user data loss, duplicate canonical writes, or broken historic route recovery.

---

# Part 8 — Strategy Master Homepage

## Status: BLOCKED until the newer design arrives

The source plan says the current Hub was recently rebuilt from the owner's HTML prototype under:

`src/features/marketing/ui/strategy-hub/`

It was built to a prior brief. Do not guess what is wrong with it.

## Outcome once unblocked

Implement the approved newer Strategy Master homepage design while preserving canonical application state, navigation, locked/unlocked semantics, report/task progress, accessibility, and mobile behavior.

---

## Task 8.1 — Do not modify the current Hub before design intake

Allowed before design lands:

- read-only code audit
- test coverage for current route/state behavior
- screenshot/reference capture for comparison
- inventory of dynamic data dependencies

Not allowed:

- speculative visual redesign
- route restructuring based on guessed new layout
- changing workflow labels/locked states because they "seem" better

---

## Task 8.2 — Design intake gate

Require the newer approved source of truth, ideally including:

- Figma/prototype URL/node IDs or equivalent
- desktop frame
- mobile frame
- hover/focus/active states where relevant
- loading/empty/error states
- copy/content source
- asset/icon references
- locked/unlocked behavior
- dynamic progress/status mapping

### Produce a design-to-code checklist

For every visible section, map:

- design node/component
- existing implementation component
- data source
- state variants
- responsive behavior
- interaction/navigation destination

**Gate:** Do not start implementation with unresolved high-impact design states.

---

## Task 8.3 — Characterize current Hub behavior before visual changes

Tests should lock:

- application selection/context
- canonical CTA routes
- locked/unlocked rules
- report readiness/progress state
- Planner navigation
- CV/Essay navigation after Part 7
- Scholarships/Final Check locked state until those features are actually ready

This separates redesign from workflow regressions.

---

## Task 8.4 — Implement design system primitives first where reusable

Only create new shared primitives when the new design repeats a real pattern.

Avoid one-off abstractions for every card.

Preserve:

- existing design tokens where compatible
- semantic HTML
- focus states
- reduced-motion preferences
- accessible status labels

---

## Task 8.5 — Implement homepage sections against real state

### Rules

- no hard-coded completed/locked state for screenshots
- no mock percentages in production path
- no duplicate readiness calculation in presentation components
- use canonical readiness/selectors/services from Parts 0–7
- preserve application ID in all deep links

### Loading/error states

The redesigned Hub must remain usable if one downstream data source fails. Prefer section-level degradation over a blank whole page where the architecture allows it.

---

## Task 8.6 — Responsive fidelity and visual verification

Compare implementation against approved references at canonical breakpoints.

### Verify

- desktop hierarchy
- mobile hierarchy
- typography/wrapping
- spacing
- card proportions
- sticky/fixed behavior
- long localized copy
- locked/unlocked variants
- loading/error/empty variants

Use the repository's visual test/story tooling if it exists. Do not add a heavy new visual-test framework solely for this page unless already planned by the project.

---

## Task 8.7 — Strategy Hub release gate

Before release:

- all CTA routes tested
- no stale links to deprecated CV/Essay surfaces
- Part 9 items remain locked if not actually implemented
- no design-only mock state shipped
- mobile tested on narrow viewport
- i18n/accessibility/typecheck/lint/build pass

---

# Part 9 — Scholarships and Final Check

Part 9 contains two features with different readiness. Treat them as separate tracks.

- **9A Scholarships:** BLOCKED until a real product/spec contract exists.
- **9B Final Check:** CONDITIONAL — can proceed after the proposed scope in `docs/strategy-reports-spec.md` is explicitly approved and reconciled with current code.

---

# Part 9A — Scholarships

## Status: BLOCKED on specification

The source plan says Scholarships exists in navigation as `locked: true`, has no route directory, and has no Feature 2 spec beyond an existing global catalogue.

Do not turn the catalogue into a personalized Strategy feature by assumption.

## Task 9A.1 — Audit the existing global scholarship catalogue only

Before spec design, document:

- catalogue route(s)
- data source/storage
- scholarship fields
- eligibility fields actually stored
- regions/programmes/deadlines
- search/filter capabilities
- freshness/update ownership
- external links/source attribution
- authentication/access model

This is discovery only, not implementation of Feature 2 Scholarships.

---

## Task 9A.2 — Product contract required before implementation

The approved spec must answer at minimum:

1. Is Feature 2 Scholarships only catalogue discovery, or personalized matching?
2. If personalized, which profile/application fields are allowed to determine eligibility/match?
3. What is deterministic eligibility vs advisory AI synthesis?
4. Are scholarship matches application-specific or user-global?
5. How are deadline/freshness/source timestamps represented?
6. What claims are prohibited when eligibility data is incomplete?
7. Can users save/track scholarships in Planner?
8. Does scholarship tracking create reminder tasks/emails?
9. What is the canonical route and Hub placement?
10. What constitutes unlocked readiness?

**Hard gate:** No route/schema/AI scorer implementation before these are approved.

---

## Task 9A.3 — Once unblocked, define a source-grounded scholarship read model

Only after spec approval.

### Requirements

- canonical scholarship ID
- source/source URL metadata where supported
- last verified/updated timestamp if available
- deadline
- explicit eligibility criteria fields
- unknown/missing criteria remain unknown
- application/user match fields separate from raw catalogue data
- no AI-generated scholarship facts persisted as source facts

If the existing catalogue cannot support the approved contract, plan the data-source upgrade separately rather than silently fabricating fields.

---

## Task 9A.4 — If personalized matching is approved, separate deterministic eligibility from recommendations

### Deterministic layer

Only evaluate criteria represented by reliable structured data.

Examples may include citizenship, programme level, field, institution, deadline, or academic minimum **only if the catalogue and user/application model actually contain those fields**.

### Semantic/advisory layer

AI may explain fit or suggest why a scholarship is worth investigating, but must not override deterministic ineligibility or invent absent criteria.

### Required states

- eligible/likely eligible only if product language and data justify it
- not eligible when a hard criterion definitively fails
- unknown/needs verification when data is missing

Use exact approved terminology.

---

## Task 9A.5 — If Planner integration is approved, reuse existing task/reminder contracts

Do not create a scholarship-only task/reminder system.

Use:

- canonical Planner task model
- stable generated seed identity
- existing reminder policy where appropriate
- user-owned due date/progress preservation

Scholarship deadline changes must not create duplicate tasks.

---

## Task 9A.6 — Scholarship release gate

Do not unlock nav/Hub until:

- spec approved
- source freshness policy defined
- route exists
- empty/error/no-match states exist
- claims are evidence-grounded
- Planner/reminder integration, if included, is idempotent
- tests/typecheck/lint/i18n/build pass

---

# Part 9B — Final Check

## Outcome

Final Check becomes the canonical pre-submission close of the journey: one application-scoped readiness surface that consumes existing canonical reports/workspaces/completion state, identifies unresolved submission risks, and deep-links the user to the exact place to fix them.

## Hard gate

Read the proposed Final Check scope in `docs/strategy-reports-spec.md` and obtain explicit approval before freezing schema/UI behavior.

Do not implement from this plan alone if the canonical spec differs.

---

## Task 9B.1 — Define Final Check as an aggregator, not a duplicate evaluation engine

### Source-of-truth rule

Final Check should read existing canonical state produced elsewhere, for example only as confirmed by the approved spec:

- application/programme requirements
- profile/onboarding readiness
- Personal Report/ProfileEvaluation
- F5 Matching Report hard criteria/gaps
- F8 Strategy Report/roadmap
- Planner task completion/deadlines
- canonical CV workspace status/staleness
- canonical Essay workspace status/staleness/feedback
- documents/evidence state

Do **not** independently recreate F5 classification, CV review, Essay analysis, or strategy scoring inside Final Check.

---

## Task 9B.2 — Define a validated Final Check read model

Freeze a structured DTO/schema before building UI.

Conceptually it should support:

- overall readiness state
- sections/categories
- check items with stable IDs
- severity/priority
- status (`pass`, `needs_attention`, `blocked`, `unknown`, etc. using approved names)
- source artifact/entity
- reason/evidence
- fix action/deep link
- last evaluated timestamp/source version where needed

Use exact fields from the approved spec.

### Stable identity

Check IDs must derive from semantic rules, not array order or AI prose, so state can be compared between runs.

---

## Task 9B.3 — Implement deterministic check evaluators first

For checks with structured source data, use pure deterministic functions.

### Examples only if approved by spec/data

- required document present/missing
- hard eligibility criterion failed/unknown
- CV stale relative to source profile
- Essay feedback stale relative to current draft
- required Planner task incomplete
- application deadline approaching/passed
- required strategy/report artifact absent

### Rules

- unknown is not fail
- fail is not inferred from missing data unless the rule explicitly says missing itself is the failure
- user-facing wording must distinguish blocker vs recommendation
- evaluator cannot mutate source records

### Tests

Boundary and missing-data cases for every deterministic check.

---

## Task 9B.4 — Add AI synthesis only if the approved Final Check spec requires it

If a final narrative/reviewer summary is required:

- generate from the already-computed structured checks;
- do not let AI change check pass/fail status;
- validate structured output;
- version prompt;
- ground narrative in check/source IDs;
- degrade gracefully if AI is unavailable.

Final Check core readiness must remain renderable from deterministic/source state even if semantic synthesis fails.

---

## Task 9B.5 — Define freshness and invalidation

Final Check can become stale whenever source artifacts change.

Define which changes invalidate or recompute checks, including as applicable:

- programme/application requirement edits
- uploaded document changes
- Personal/F5/F8 regeneration
- Planner task updates
- CV edits/review/staleness
- Essay draft/feedback changes

Prefer on-read recomputation for cheap deterministic checks and versioned cache only where justified by current architecture.

Do not show an old "ready" state after a critical source artifact changed.

---

## Task 9B.6 — Build the Final Check page as actionable sections

### UI rules

- application-scoped route
- clear overall state
- sections follow approved spec
- every actionable issue has a canonical `Fix this`/open action where possible
- deep link preserves return/application context
- blockers visually distinguishable from recommendations without relying on color alone
- unknown/missing data shown honestly
- section-level degradation if one optional source fails

### No dead-end checks

If the product flags an issue the user can fix inside GlowBal, link directly to that exact canonical workspace/page rather than only describing the problem.

---

## Task 9B.7 — Integrate Final Check with canonical CV/Essay routes

This is why Final Check is best scheduled alongside/after Part 7.

### Requirements

- no links to deprecated duplicate CV routes
- no links to deprecated Essay shells
- CV stale issue opens canonical CV workspace
- Essay issue opens canonical Essay workspace/mode
- return path leads back to the same application Final Check where supported

---

## Task 9B.8 — Final Check route readiness and Hub unlock

Before removing `locked: true`:

- canonical route exists
- all required data sources available
- source failures handled
- issue deep links valid
- mobile layout usable
- approved spec fully represented

Do not unlock because the nav item merely has a page shell.

---

## Task 9B.9 — Final Check acceptance scenarios

### Scenario 1 — Submission-ready application

All mandatory deterministic checks pass; optional recommendations may remain without blocking overall readiness if spec says so.

### Scenario 2 — Hard F5 criterion failed

Final Check surfaces the existing hard failure and source, without recalculating a different result.

### Scenario 3 — Missing required document

Shows blocking/needs-attention state with direct fix route.

### Scenario 4 — CV stale

Shows stale CV state sourced from canonical CV logic; fix link opens merged CV workspace.

### Scenario 5 — Essay feedback stale

Shows correct draft/feedback freshness issue and opens canonical Essay workspace.

### Scenario 6 — Planner work incomplete

Shows only tasks/checks required by approved Final Check scope; completed task remains complete.

### Scenario 7 — AI synthesis unavailable

Deterministic checks and actions remain usable; only optional narrative degrades.

---

# Cross-cutting implementation rules

## A. TDD execution order per behavior-changing task

For each task:

1. characterize current behavior where preservation matters;
2. add a failing test for the new behavior;
3. implement the smallest change;
4. run focused tests;
5. run adjacent feature tests;
6. run typecheck;
7. only then move to the next task.

Avoid mixing data migration, route consolidation, and visual redesign in one commit.

---

## B. Data migrations

Any migration in Parts 5–9 requires:

- explicit source → target mapping
- idempotency
- staging dry run
- backup/rollback strategy
- RLS review
- generated Supabase type refresh if used
- post-migration row-count/invariant verification
- preservation of user-authored fields

Never delete legacy data in the same release merely because a new UI is live.

---

## C. User-owned state

Treat these as user-owned unless the current canonical contract explicitly says otherwise:

- Planner task completion/status changed manually
- manually edited task title/notes
- user due-date changes
- checklist progress
- F8 priority overrides
- CV manual edits
- Essay manual drafts

Generated refreshes must not overwrite them silently.

---

## D. Idempotency

Idempotency is mandatory for:

- reminder enqueue
- weekly digest enqueue
- roadmap/task reconciliation
- migration reruns
- generated-content reconciliation
- any Final Check cached generation if one exists

A retry must not duplicate mail, tasks, user-visible blocks, or migrated documents.

---

## E. RLS and application scoping

Every application-specific route/service must verify:

- authenticated user
- owned/accessible application
- target data belongs to that application/user
- cross-application IDs cannot be substituted in request payloads

Add route/service tests for wrong-user/wrong-application access on new write paths.

---

## F. Error model

Keep these distinguishable:

- invalid/missing input
- permission/not-found
- rate limit
- upstream AI/service failure
- persistence failure
- malformed persisted block/content
- stale source artifact
- blocked feature/spec state

One malformed GenUI block, stale review, or optional AI summary must not crash the whole application workspace when safe degradation is possible.

---

## G. Accessibility, mobile and i18n

Every new/changed interactive surface must verify:

- keyboard access
- visible focus
- status not conveyed by color alone
- touch targets on mobile
- narrow viewport behavior
- long localized text
- i18n keys for new product copy/statuses

Planner mobile and interactive task blocks require explicit narrow-screen tests, not only desktop screenshots.

---

# Execution waves and hard gates

## Wave 0 — Audit and blockers

### 0.A Canonical source audit
### 0.B Route/symbol/data audit
### 0.C Ownership audit for CV/Essay
### 0.D External asset/spec readiness matrix
### 0.E Invariant lock

**Gate:** Every Part 5–9 area is explicitly marked Ready / Conditional / Blocked. No blocked feature is implemented speculatively.

---

## Wave 1 — Part 5 Planner

### 5.1 Characterize Planner domain
### 5.2 Mobile interaction model
### 5.3 Responsive board
### 5.4 Mobile calendar
### 5.5 Reminder policy lock
### 5.6 Pure reminder eligibility
### 5.7 Existing outbox/cron integration
### 5.8 Email rendering
### 5.9 Regression pass

**Gate:** Planner primary workflows work on mobile; reminder retries cannot produce duplicate email; preferences are honored.

---

## Wave 2 — Part 6 Planner task UI

Depends on stable F8/roadmap/GenUI contracts from Part 4.

### 6.1 Persisted contract audit
### 6.2 Version/backward compatibility
### 6.3 Generated vs user-state ownership
### 6.4 Renderer registry hardening
### 6.5 Editable priority grid
### 6.6 Comparison table
### 6.7 Narrative theme map
### 6.8 Phase timeline
### 6.9 Migration/read policy
### 6.10 Real F8 integration verification

**Gate:** All legacy and current task block fixtures render safely; user edits/progress survive F8 regeneration and Planner reload.

---

## Wave 3 — Part 7 CV + Essay, only if ownership gate is clear

### 7.1 Ownership/decision record
### 7.2 CV characterization
### 7.3 CV canonical service/domain boundary
### 7.4 Move preferred CV UX onto canonical model
### 7.5 CV migration/backfill where required
### 7.6 CV route deprecation
### 7.7 Essay audit
### 7.8 Unified Essay workspace
### 7.9 Essay migration/deprecation
### 7.10 Planner deep links
### 7.11 Regression pass

**Gate:** One canonical CV product and one canonical Essay workspace exist without data loss; Planner routes to them.

If ownership is not clear, skip Wave 3 and continue only with independently ready work.

---

## Wave 4 — Part 9B Final Check, once spec is approved

Final Check may be developed alongside the latter part of Wave 3, but canonical CV/Essay deep links cannot be finalized until Part 7 route decisions are stable.

### 9B.1 Aggregator contract
### 9B.2 Read model
### 9B.3 Deterministic evaluators
### 9B.4 Optional AI synthesis
### 9B.5 Freshness/invalidation
### 9B.6 Page/action UI
### 9B.7 CV/Essay integration
### 9B.8 Unlock/readiness
### 9B.9 Acceptance scenarios

**Gate:** Final Check reflects canonical source state, deep-links to actual fix surfaces, and never shows stale readiness after critical source changes.

---

## Wave 5 — Part 8 Strategy Master homepage, only when new design lands

### 8.1 Freeze current Hub
### 8.2 Design intake
### 8.3 Characterization
### 8.4 Shared design primitives
### 8.5 Real-state implementation
### 8.6 Responsive/visual verification
### 8.7 Release gate

**Gate:** Approved design implemented without breaking canonical routing/state.

This wave can move earlier after Part 6 if the approved design arrives and does not depend on unfinished Part 7/9 routes. Locked features must stay locked until real readiness exists.

---

## Wave 6 — Part 9A Scholarships, only after spec approval

### 9A.1 Existing catalogue audit
### 9A.2 Product contract approval
### 9A.3 Read model
### 9A.4 Eligibility/recommendation split if applicable
### 9A.5 Planner integration if applicable
### 9A.6 Release gate

**Gate:** Scholarships is unlocked only when source data and approved product claims support the implemented experience.

---

# Verification plan

## Focused automated tests

Use the actual repository commands and test locations discovered during implementation. Expected coverage areas:

```bash
npx vitest run src/features/planner
npx vitest run src/features/ai-strategy-dashboard
npx vitest run src/features/apply
npx vitest run src/server
```

Also run focused tests for:

- reminder policy
- outbox enqueue
- email templates
- GenUI parsers/renderers
- CV canonical services/routes
- Essay workspace/services/routes
- Final Check evaluators/routes
- Scholarships only after it is unblocked

If these exact paths/scripts do not exist, use the repository's canonical equivalents.

---

## Static verification

Expected checks, using actual scripts from `package.json`:

```bash
npm run typecheck
npm run typecheck:strict
npm run lint
node scripts/check-i18n.mjs --all
npm run build
```

Do not add duplicate package scripts only to match this plan.

---

## Repository-wide regression searches

Before declaring Parts 5–9 complete, search for stale/duplicate contracts:

```bash
rg "deadlineReminderEmail|deadline_reminders|weekly_strategy_digest" src docs
rg "structured_table|long_text|checklist|editable_priority_grid|comparison_table|narrative_theme_map|phase_timeline" src
rg "/apply/.*/cv|/ai-strategy/.*/cv" src docs
rg "structured_cvs|cv_reviews|cv_target_profiles|application_strategies" src
rg "statement|essay" src/app src/features src/lib
rg "strategy-hub" src
rg "locked:\s*true" src
rg "scholar" src docs
rg "final.?check" src docs
```

Expected outcome:

- reminder system uses one canonical outbox/policy path;
- no unsupported GenUI type crashes read paths;
- Planner deep links use canonical CV/Essay routes;
- deprecated duplicate CV/Essay writes are gone after migration;
- Strategy Hub only unlocks real features;
- Scholarships remains locked until implemented from an approved spec;
- Final Check has one canonical route/evaluator/read model after implementation.

---

# End-to-end manual acceptance matrix

## Scenario A — Mobile Planner heavy workload

Use an application with tasks in all statuses and many calendar dates.

Verify:

- all statuses reachable without scrolling through five full boards;
- move/edit/complete works by touch and keyboard alternative;
- calendar selected-day tasks remain available on mobile;
- long task content and rich blocks remain usable.

---

## Scenario B — Reminder boundaries

Create tasks in the user's timezone at the exact policy boundaries.

Verify:

- correct 30/7/1-day enqueue;
- no duplicate on cron retry;
- completed task excluded;
- preference disabled means no enqueue;
- same-day batching follows canonical policy.

---

## Scenario C — Legacy and new GenUI tasks

Open old persisted `structured_table`/`long_text`/`checklist` tasks and new F8-generated block tasks.

Verify:

- all render;
- malformed one degrades locally;
- user edit/progress persists after reload and F8 regeneration.

---

## Scenario D — Existing CV user migration

Test user with historical CV data from each old system and a dual-system conflict fixture.

Verify:

- no content disappears;
- canonical workspace loads correct data;
- edit/review/export works;
- old route remains recoverable during transition.

---

## Scenario E — Essay version and feedback lifecycle

Create draft → feedback → edit draft.

Verify:

- feedback references correct old version;
- current draft remains intact;
- stale feedback is represented honestly;
- Planner link opens canonical workspace.

---

## Scenario F — Final Check with mixed readiness

Prepare application with:

- one hard criteria issue;
- one missing document;
- one stale CV;
- one stale Essay feedback item;
- one incomplete required Planner task.

Verify Final Check surfaces each from canonical sources and each actionable issue opens the correct fix route.

---

## Scenario G — Optional AI outage during Final Check

If Final Check includes AI synthesis, simulate failure.

Verify deterministic check state remains usable and no source status is replaced by fabricated narrative.

---

## Scenario H — Strategy Hub redesign

Once design is available, verify all major state variants against approved desktop/mobile references:

- new/incomplete application
- reports complete
- Planner active
- CV/Essay ready
- Scholarships locked unless shipped
- Final Check locked/unlocked according to real readiness

---

## Scenario I — Scholarships once unblocked

Only after approved spec/data are available.

Verify:

- raw catalogue facts remain source-grounded;
- unknown eligibility is shown as unknown;
- hard criteria are not overridden by AI explanation;
- saved/tracked scholarship tasks, if implemented, reconcile idempotently.

---

# Definition of Done — Parts 5–9

## Part 5 — Planner

- [ ] Current Planner task semantics are characterized by tests before responsive changes.
- [ ] Mobile board uses a deliberate mobile interaction model, not five vertically stacked desktop columns.
- [ ] All primary task actions work without drag-and-drop.
- [ ] Calendar retains a usable selected-day/task pattern on mobile.
- [ ] Reminder policy exactly follows the canonical email-system contract.
- [ ] Planner reminders reuse the existing outbox/cron/Resend/delivery infrastructure.
- [ ] `deadline_reminders` and `weekly_strategy_digest` preferences are honored.
- [ ] Reminder enqueue is idempotent across cron retries.
- [ ] Completed/non-actionable tasks do not send reminders.
- [ ] Reminder timezone/date-boundary behavior is tested.

## Part 6 — Planner task UI

- [ ] Persisted GenUI/task-content shapes are audited and represented in compatibility fixtures.
- [ ] Legacy `structured_table`, `long_text`, and `checklist` rows remain readable.
- [ ] F8 block types from Part 4 remain schema-validated and backward compatible.
- [ ] Unknown/malformed block content degrades locally instead of crashing Planner.
- [ ] Interactive block user state is stored separately from generated base data where required.
- [ ] `editable_priority_grid` edits survive reload and F8 regeneration.
- [ ] Checklist/timeline progress does not regress on regeneration.
- [ ] Rich task blocks have deliberate mobile layouts.
- [ ] Renderer architecture has exhaustive tests for all supported types/versions.
- [ ] Real F8 → Planner sync is tested, not only mocked fixtures.

## Part 7 — CV and Essay

- [ ] Concurrent ownership/merge boundary is resolved before implementation.
- [ ] CV duplicate systems are fully audited before migration.
- [ ] One canonical CV UX and one canonical persisted model are selected explicitly.
- [ ] Existing CV content, review/export capability, and staleness behavior are preserved.
- [ ] CV data migration, if required, is idempotent and conflict-safe.
- [ ] Duplicate CV writes stop before legacy route removal.
- [ ] All Essay/Statement shells are audited.
- [ ] One canonical Essay workspace exposes writing and feedback over the same draft/version model.
- [ ] Feedback is tied to the exact draft version and becomes stale appropriately after edits.
- [ ] Existing Essay drafts/history are preserved through migration.
- [ ] Planner links use only canonical CV/Essay workspaces.
- [ ] Deprecated routes remain safely recoverable during the agreed transition window.

## Part 8 — Strategy Master homepage

- [ ] No speculative redesign is implemented before the newer approved design arrives.
- [ ] Approved desktop/mobile references and state variants are captured before coding.
- [ ] Existing route/readiness semantics are protected by characterization tests.
- [ ] Redesign renders real canonical state, not screenshot mocks.
- [ ] Canonical application/Planner/CV/Essay routes are preserved.
- [ ] Scholarships/Final Check remain locked until actually ready.
- [ ] Loading/error/empty states are implemented.
- [ ] Desktop/mobile visual verification passes against approved references.

## Part 9A — Scholarships

- [ ] Existing global catalogue is audited before Feature 2 implementation.
- [ ] A real Scholarships product contract is approved before route/schema/AI work begins.
- [ ] Raw scholarship facts remain source-grounded and freshness is represented.
- [ ] Missing eligibility data remains unknown rather than inferred.
- [ ] Personalized matching, if approved, separates deterministic eligibility from semantic recommendation.
- [ ] Planner/reminder integration, if approved, reuses existing idempotent contracts.
- [ ] Navigation unlocks only after the actual route and approved experience are complete.

## Part 9B — Final Check

- [ ] Final Check scope is explicitly approved from the canonical spec before implementation.
- [ ] Final Check consumes canonical source state rather than duplicating F5/F8/CV/Essay logic.
- [ ] One validated Final Check read model exists with stable check IDs.
- [ ] Deterministic checks distinguish pass/fail/unknown correctly.
- [ ] Optional AI synthesis cannot override deterministic/source statuses.
- [ ] Freshness/invalidation prevents stale "ready" state after critical source changes.
- [ ] Every actionable internal issue deep-links to the canonical fix workspace.
- [ ] Canonical CV/Essay routes are used after Part 7.
- [ ] Final Check remains usable if optional AI synthesis fails.
- [ ] Hub/nav unlock occurs only after route, data sources, and actions are complete.

## Global release gate

- [ ] Focused Vitest suites pass for every changed feature.
- [ ] Relevant integration/RLS tests pass.
- [ ] Typecheck and strict typecheck pass using repository commands.
- [ ] Lint passes.
- [ ] i18n integrity check passes.
- [ ] Production build passes.
- [ ] No active duplicate write path remains for consolidated CV/Essay data.
- [ ] No reminder retry creates duplicate mail.
- [ ] No roadmap/F8 regeneration destroys user Planner/GenUI progress.
- [ ] No blocked feature is unlocked or implemented from guessed requirements.
- [ ] End-to-end acceptance scenarios A–I applicable to shipped parts pass.

