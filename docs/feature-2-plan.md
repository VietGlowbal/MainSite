# Feature 2 — GlowBal Strategy: delivery plan

Written 2026-08-20 against branch `claude/feature-2-strategy-review-ahahsw`.

This is a sequenced plan, not a status board. `docs/current-status.md` remains
the status file. Where this plan and the code disagree, the code wins.

Source material used: `docs/ai-strategy-canonical-architecture.md`,
`docs/ai-strategy-route-audit.md`, `docs/email-system.md`,
`docs/known-issues.md`, and the owner's framework document
(`1vTyTMpr7p7UdlajVgh7pQXQrocSDYVcqCxkUgSYG1F0`), which contains the F5
scoring spec, the Matching Report layout, the Strategy Report layout and a
complete Final Check spec.

## Decisions made (2026-08-20)

All six are answered. Detail and consequences live in
[strategy-reports-spec.md](strategy-reports-spec.md); this is the summary.

1. **Five scored dimensions.** No schema change needed, `programmeFitSchema`
   already has the five F5 keys.
2. **Percentages stay**, headline match score included. Two conditions attach:
   it is labelled and described as a match score and never as a chance of
   admission, and `fitDimensionSchema.score` drops `.int()` so percentages
   other than multiples of 20 are actually reachable.
3. **`strong_match` added** as a fourth band, slotted between match and safety
   on the academic band.
4. **F7 stays with the LOR framework; the Strategy Report engine becomes F8.**
   Read from a reply of "same reply" as accepting the recommendation. Worth an
   explicit confirmation before the rename lands.
5. **Execution Roadmap and Planner task contract get designed in one pass.**
6. **Final Check gets a proposed scope**, drafted in the spec document.

## Assets still needed

The two report PDFs have landed and are recorded in
[strategy-reports-spec.md](strategy-reports-spec.md). Still outstanding:

- The newer Strategy Master homepage design (item 8). Until it arrives, item 8
  is on hold and nobody should touch the current Hub.
- Figma node-ids on canvas `375:9842` for the Matching and Strategy report
  frames. Frames need reading directly, not from memory.
- Reproduction steps for the Personal Report bugs. "Buggy" is not actionable;
  three real reproductions would be.
- Confirmation of which `supabase-*.sql` files are live in production, or
  credentials so `/db-schema` can be run. See workstream 0.
- Whether Andrew is still actively working on CV and Essay. Merging two systems
  underneath someone still committing to them is how both get broken.

## Workstreams

Ordered by dependency, not by item number.

### 0. Foundations (do first, small, unblocks the rest)

Nothing here is user-facing and all of it makes everything after it cheaper.

- **Observability.** `src/server/observability/index.ts` is currently one line
  (`export {}`). Report generation can fail for a student and nobody finds out.
  Give it structured logging plus error reporting, then instrument the four
  generation entry points. This is a prerequisite for saying anything truthful
  about reliability in items 3, 4 and 5.
- **Migration state.** Run `/db-schema` against production and record which
  files are live. Three of this feature's worst outages were unrun migrations
  (known-issues 0c, 0e, 0f). Presence of a `.sql` file has never meant it is
  applied.
- **Cascade delete.** known-issues 5r: deleting an application still leaves
  reports, tasks and CV work behind. The migration is written but not confirmed
  run. Confirm, run, verify with a real delete.

### 1. Reflections (item 1, independent, ship early)

Four steps, three fixes, no dependencies on anything else.

- Collapse both reflection wizards to single pages. Personal reflection steps
  five questions through an `index` in `personal-reflection-form.tsx`;
  per-achievement reflection does the same thing dimension by dimension inside
  `reflection-evidence-form.tsx`. Same fix, two places, do them together.
- Fix `?return=` threading as a class, not per page. Audit every link into
  `/profile/*` and `/ai-strategy/*` for the parameter. This has been fixed
  twice for individual routes already (known-issues 5s and 5u) and come back
  both times because the audit was never done.
- Split confirm-screen error handling. Missing input is already handled well
  (`readiness.blockingIssues` renders with a per-issue Fix this button). The
  gap is downstream failure: generation erroring, a report route 503ing. That
  path currently gives the student nothing useful.

Alongside this, `reflection-evidence-form.tsx` is 1,068 lines with roughly 22
pieces of state in one client component. Splitting it is a precondition for
doing the UI work rather than a separate task.

### 2. Report generation (item 2, blocks item 5)

The pipeline is documented and mostly working: F6 gate, then F1/F2/F3 into F4,
producing one reusable `ProfileEvaluation` that the Personal Report renders.
Engine code is in `src/shared/evaluation/`.

The one real piece of debt: the Strategy engine still reads
`applicant_analyses`, a legacy blob we keep generating purely to feed it. The
architecture doc says to drop it once the engine reads structured
`ProfileEvaluation` and `ProgrammeFitEvaluation` directly. Do that migration
here. It is the whole of item 2 and it blocks item 5.

Contract rules to preserve, all four already enforced: no admission
probability, missing dimensions stay null with weights renormalised,
observation and inference and missing data stay distinct, every stored
evaluation records input hash plus engine version plus prompt version.

### 3. Matching Report (item 4, blocks item 5)

`src/shared/evaluation/f5-programme-fit.ts` is interfaces only. Its own comment
says so, it is 108 lines against F4's 685, and it is the one framework with no
test file. `buildProgrammeFitPlaceholder()` returns `not_available` for every
dimension. So this is not underdeveloped by accident, it is a stub with a
stable typed contract waiting to be filled.

That is good news for cost. The work is:

- Implement F5 scoring to the weights in the framework doc, against the
  existing types, using the five dimensions confirmed in decision 1. Section
  layouts and the percentage handling are in
  [strategy-reports-spec.md](strategy-reports-spec.md).
- Implement the classification rule exactly as specified: any hard eligibility
  failure gives Currently Ineligible and overrides everything, otherwise the
  academic band alone decides Safety / Match / Reach. Persona, financial and
  career dimensions report alongside the label and never move it. This is
  already what both the framework doc and the architecture doc require, and it
  is what "separate minimum entry requirements from competitiveness" means in
  practice.
- Build the six report sections: overall match summary, fit breakdown and why
  you match, hard criteria assessment, gap and risk analysis, admissions
  perspective, final recommendation.
- Write the tests F5 never got.

The canonical URL `/ai-strategy/[applicationId]/matching-report` does not
change.

### 4. Strategy Report (item 5, depends on 2 and 3)

Five sections in the spec: strategic overview, strategic priority table,
profile development strategy, narrative strategy, execution roadmap.

Build all five. Per decision 5 the Execution Roadmap and the Planner task
contract are designed together in one pass rather than built twice.

Two things worth noticing. The strategic priority table is specified as
editable by the applicant, which makes it the first real customer for the work
in item 7 rather than a static table. And the report is meant to end by handing
off to the Planner, so the roadmap section and the Planner task contract should
be designed in one pass, not two.

### 5. Planner (item 6, mostly independent)

- **Mobile.** `planner-board.tsx:50` is `md:grid-cols-3 xl:grid-cols-5`, so
  five Kanban columns become one stacked scroll on a phone. The calendar loses
  its side panel below `xl`. Both need a real mobile pattern, not a narrower
  grid.
- **Reminders.** This is smaller than it looks. `docs/email-system.md` already
  specifies the policy (weekly digest preferred over one email per task,
  deadlines at 30/7/1 days, same-day low-priority items combined), and the
  Resend outbox, idempotency, delivery logging, cron runner and the
  `deadline_reminders` / `weekly_strategy_digest` preferences are all live.
  `deadlineReminderEmail` exists and is referenced by nothing except the dev
  preview page. The job is wiring planner tasks into the outbox that is already
  there and honouring the preference. Not designing a notification system.

### 6. Planner task UI (item 7, the differentiator)

There is generative UI today, but it is a fixed vocabulary of three:
`structured_table`, `long_text`, `checklist`. The model picks one when the task
is generated and `content-block.tsx` renders it.

So this is extension work, not greenfield, which is the reason to take it
seriously rather than defer it. Approach:

- Derive the new block types from real Strategy Report output rather than
  inventing them. The spec already implies several: a comparison table, an
  editable priority grid, a narrative theme map, a phase timeline.
- Each new type needs a schema, a renderer, and read-side validation. These
  columns have already caused one production incident (known-issues 0d) and
  shapes are now validated on read, so a malformed row degrades instead of
  crashing the page. Keep that property.
- Treat the vocabulary as a versioned contract. Once tasks are stored with a
  block type, removing that type breaks old rows.

### 7. CV and Essay (items 9 and 10, gated on the Andrew question)

Both work. Neither is a linking job.

There are two CV systems, frozen deliberately (`docs/ai-strategy-route-audit.md`
has the reasoning). `/apply/[id]/cv` has the better UX,
`/ai-strategy/[id]/cv/*` has the better persisted model (`application_strategies`,
`cv_target_profiles`, `structured_cvs`, `cv_reviews`, plus export and staleness
handling). Target is one product on the Apply UX over the AI Strategy data
model, then surfaced from the relevant Planner task. Essay is the same shape:
several shells over shared statement analysis, target is one workspace with
writing and feedback as modes.

This is a merge with a data migration behind it. It should not start while
someone else is actively committing to either system.

### 8. Strategy Master homepage (item 8, on hold)

The current Hub was rebuilt recently from the owner's own HTML prototype into
`src/features/marketing/ui/strategy-hub/`. It was built to a brief, so nobody
should guess at what is wrong with it. Blocked on the newer design arriving.

### 9. Scholarships and Final Check (items 11 and 12)

Both appear in the nav as `locked: true` and neither has a route directory.
Scholarships has no spec yet beyond the existing global catalogue. Final Check
now has a proposed scope in
[strategy-reports-spec.md](strategy-reports-spec.md), drafted per decision 6.

Final Check is the natural close of the journey and gives the CV and Essay
merge somewhere to point. Worth scheduling right after item 7 rather than last.

## Suggested order

1. Workstream 0. Small, unblocks honest reporting on everything else.
2. Item 1 in parallel with the item 2 migration off `applicant_analyses`.
3. Item 4 (F5 and the Matching Report). Unblocked.
4. Item 5, then item 6's mobile and reminder work in parallel.
5. Item 7, seeded by what items 4 and 5 actually produce.
6. Items 9, 10 and 12 together, since Final Check is what makes the merged CV
   and Essay work worth having.
7. Item 8 whenever the design lands. Item 11 last.

This ordering follows the stated priorities (strengthen the report system,
mobile Planner, build out Matching and Strategy, invest in interactive tasks)
with one change: the foundations in workstream 0 come first because without
observability we cannot tell whether any of the reliability work in item 3
actually worked.
