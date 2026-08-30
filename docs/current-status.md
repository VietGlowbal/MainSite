# Current project status

Working tree 2026-08-30 (Strategy Report model-reference containment): a live
read of the failing application's snapshot, Personal Report, Matching Report,
and source analysis confirmed that the rejected `experience:*` UUID exists in
none of them; the model mutated an opaque ID. Strategy now strips only unknown
generated references at every profile, activity, and synthesis boundary,
emits count-only telemetry, and downgrades activity claims that lose required
support. Strict validation remains as the final guard. Added regressions for
the reported UUID across profile, activity, and synthesis output. Measured:
Strategy V3 plus route suites 22/22, engine suite 9/9, base typecheck, scoped
ESLint, and `git diff --check` pass.

Working tree 2026-08-30 (Strategy Report experience provenance fallback):
Strategy V3 now derives canonical `experience:<id>` evidence aliases directly
from snapshot achievements and activities, including already-prefixed IDs, so
an incomplete snapshot Evidence Bank cannot reject valid activity references.
Validation remains fail-closed for genuinely unknown references. Added a
regression test for the production UUID failure. Measured: context/engine
suite 12/12, route suite 8/8, base typecheck, and `git diff --check` pass.

Working tree 2026-08-30 (Strategy Report evidence provenance fix): Strategy V3
now carries the current Personal Report's evidence references into its own
allowlist as report-only inputs after snapshot, Matching, and source-analysis
evidence. This closes the camelCase snapshot vs canonical report-ID gap that
rejected valid refs such as `profile:study_motivation`. Added a regression
test. Measured: Strategy V3 and route suite 12/12, base typecheck, scoped
ESLint, and `git diff --check` pass.

Working tree 2026-08-30 (Matching → Strategy handoff): V2 and V3 Matching
Reports now end with a clear Strategy Report CTA pointing to the canonical
application strategy route. The analysis loading screen already auto-generates
Personal, Matching, then Strategy in order. Measured: focused Matching and
Analysis workspace suites 27/27, scoped ESLint, strict typecheck, and CI
production build pass; existing Vite, Edge-runtime, and filesystem tracing
warnings remain.

Working tree 2026-08-30 (Strategy Report generation wiring): the analysis gate
now starts Strategy Report generation immediately after the current Personal
Report and Matching Report complete. It shows Strategy as the third report,
checks the existing Strategy cache first, retries failed generation immediately,
and exposes Strategy-specific status/retry/open-report actions. Measured:
focused Analysis/Strategy suite 21/21, base typecheck, and scoped ESLint pass.
The full i18n audit still reports 71 pre-existing missing Matching UI keys; no
new Strategy key is missing.

Working tree 2026-08-30 (Matching Report output quality): V3 evidence labels now
use the canonical raw-source titles instead of generic claim categories. Programme
gap text is bounded at a sentence boundary, strategic interpretation is rebuilt
as coherent target-aware prose, and metric/summary prompts receive the canonical
target programme so an applicant subject cannot rename the target. The report
footer now labels its coverage as overall, and empty strategic interpretation
renders as not assessed. Measured: focused Matching/UI suite 20/20, base
TypeScript, i18n, full lint (0 errors, 4 existing warnings), and production build
pass; existing Edge-runtime and dynamic filesystem tracing warnings remain.

Working tree 2026-08-30 (Personal Report narrative fail-safe): narrative
synthesis is now optional presentation prose. Invalid or oversized narrative
output rejects only its batch; valid sibling batches are retained, and when all
narrative batches fail both application and legacy generation persist the
deterministic report instead of returning an AI generation error. Removed the
broad evidence-id union from the model payload, relaxed mandatory section
coverage, added explicit fallback telemetry, and bumped the narrative prompt
version to `report-synthesis-v14-optional-batches`. Measured: narrative suite
44/44, generation suite 14/14, base typecheck, scoped ESLint, and production
build pass; build retains the existing Edge-runtime and dynamic filesystem
tracing warnings. Repository-wide `git diff --check` still reports a
pre-existing blank line at EOF in `src/features/apply/ui/personal-report/identity-evidence-profile.tsx`.

Working tree 2026-08-30 (Strategy Report V3 flow alignment): implemented the
snapshot-only Strategy V3 pipeline with exact Personal Report/Matching/Target
lineage, fail-closed persistence, exact-hash caching, deterministic Top 3
priorities, four canonical roadmap phases, V3-first reading/Planner handoff,
and the four-section dashboard with accessible activity filters and overrides.
Measured: Strategy-focused suite 16/16, base and strict typecheck, i18n check,
`build:ci`, and full lint (0 errors) pass. Full repository suite: 3,531 passed,
4 existing timeout/idempotency failures in three unrelated route test files;
full lint retains 4 existing warnings.

Working tree 2026-08-30 (Matching V3 source and programme-gap validation):
metric target facts now retain only refs allowed for each metric, scholarship
refs are excluded from the summary and overall source allowlists, and
`programmeFit.potentialGap` is capped at 1,000 characters before report parse.
Added a mixed programme/scholarship source regression test. Measured: matching
suite 102/102, base typecheck, and scoped ESLint pass; production build also
passes with the existing Edge-runtime and dynamic filesystem tracing warnings.

Working tree 2026-08-30 (Matching V3 source guard and bounded programme gap):
metric facts and summary allowlists now exclude scholarship refs, mixed-source
facts are reduced to only the refs allowed for that metric, and programme
potential gaps are capped at the schema's 1,000 characters. Added a regression
test for mixed scholarship/programme sources.

Working tree 2026-08-30 (Matching V3 summary structured output): the final
Matching summary now uses strict `json_schema` output and explicitly requires
all four canonical takeaways plus `metricIds` on every takeaway. The summary
prompt/schema versions are `matching-summary-v3.2.0-structured-output` and
`matching-report-v3.2.0`, preventing the production failure caused by omitted
metric ID arrays. Measured: matching suite 101/101, base typecheck, scoped
ESLint, and production build pass; existing build warnings remain unchanged.

Working tree 2026-08-30 (Matching V3 metric batching and structured output):
Matching metric reasoning now sends one metric/four-submetric batch per
parallel provider call, mirroring Personal Report's independent batches.
The metric prompt and repair path use a strict `json_schema` contract with all
required fields (`reasoning`, `applicantEvidenceIds`, `missingEvidence`, and
`limitations` included), preventing legacy `rationale` output from reaching
validation. Prompt/schema versions are `matching-metric-v3.2.0` and
`matching-metric-v3.2.0-structured-batches`, invalidating stale metric reuse.
Measured: matching V3/reasoner 21/21, base typecheck, scoped ESLint, and
production build pass; build retains the existing Edge-runtime and dynamic
filesystem tracing warnings.

Working tree 2026-08-30 (Personal Canvas Report modal UI & readability fix):
Personal Canvas detail modal has been upgraded to `w-[95vw] max-w-6xl` with `max-h-[90vh]`.
`SnapshotCapabilityProfileView` converted to a spacious 12-column responsive layout,
preventing narrow capability card wrapping (>340px width per card), styling Why it matters
as a clear highlighted callout, improving Star badge pills, and upgrading typography/spacing
across Core Identity, Driving Forces, Positioning, Growth Matrix, and Proof of Me.
Measured: personal canvas suite 14/14, ESLint passes with 0 errors.

Working tree 2026-08-30 (Target Profile catalogue fallback): Target Profile
generation now reads the full `courses` row and its linked `universities` row,
projects public requirements and programme/university facts with catalogue
provenance refs, and rejects empty source-less cached profiles. Matching can
therefore use the existing VinUniversity catalogue data without crawling on
demand. Measured: target-profile and matching suites 109/109, base typecheck,
scoped ESLint (0 errors), production build, and `git diff --check` pass. The
build retains the existing Edge-runtime and dynamic filesystem tracing warnings.

Working tree 2026-08-30 (Matching Report persistence compatibility): production
Matching Report generation was returning `503` after successful AI output because
the writer used the nonexistent `confidence_score` column and omitted the
legacy table's required `profile_version`/`current_match_score` fields. The
writer now uses the deployed `confidence` column, supplies explicit unassessed
V3 compatibility values, persists `model_name`, and logs safe database error
metadata. Measured: matching repository/generation suites 28/28, base
typecheck, scoped ESLint, and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report retry and word-band guard): the
confirmed-information progress page now immediately requeues transient
Personal Report `retry`/`failed` states while polling, with status-transition
deduplication. Narrative prompts now target safe middle word bands and perform
a whitespace-count self-check, preventing boundary failures such as a 149-word
Snapshot against the 150-word minimum; narrative prompt version bumped to
`report-synthesis-v13-safe-word-bands`. Measured: focused Personal Report,
generation, and progress-page suites 69/69, typecheck, scoped ESLint, and
`git diff --check` pass.

Working tree 2026-08-29 (Personal Report Structured Outputs): both primary
narrative batches and their one repair attempt now send per-batch strict
`json_schema` response formats. The schema is derived from the Zod contract,
requires every nested field, makes only unavailable sections nullable, and
leaves word-count, grounding, and evidence-scope checks in the application
validator. Existing JSON-mode callers keep their default behavior. Measured:
focused narrative and generation suites 58/58, base typecheck, scoped ESLint,
and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report required-field repair): narrative
remains mandatory. Each invalid model response receives one repair request that
reuses the full synthesis contract and explicitly requires every nested field,
including capability evidence metadata and prose. The prompt version is now
`report-synthesis-v12-required-fields-repair`; contract version
`personal-report-v6-required-narrative-repair` still invalidates stale report
cache entries. Word-length diagnostics retain actual and required counts, and
failed repairs still cause the job to retry without persisting a report.
Measured: focused narrative and generation suites 58/58, base typecheck,
scoped ESLint, and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report validator tolerance): narrative
numeric checks now accept values grounded elsewhere in the same deterministic
input, while unsupported capability/metric labels are dropped and deterministic
experience counts are restored instead of failing the whole batch. Evidence
IDs and prose safety guards remain strict. Measured: narrative synthesis
43/43, base typecheck, scoped ESLint, and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report schema retry fix): deterministic
`high`/`medium`/`low` evidence confidence is now translated to the narrative
schema's `strong`/`moderate`/`limited` vocabulary only in the model payload;
materialization keeps the canonical confidence mapping. This fixes production
`schema_response` retries where `medium` reached the strict response enum.
Measured: narrative synthesis 41/41, base typecheck, scoped ESLint, and
`git diff --check` pass.

Working tree 2026-08-29 (Personal Report focused cleanup): report-mechanics
validation now rejects only explicit mechanics phrases, F4 recurring behaviour
is separate from observed activity behaviour, and Profile Positioning counts
only canonical supporting experiences. Key Takeaways now receive structured
fact bundles rather than deterministic takeaway prose; Growth may explicitly
use a `missing_information` basis with no fabricated evidence ID. The V4
`narrativeDetails` contract, additive application, Evidence Bank, two-batch
writer, and Matching isolation remain intact. Measured: focused suites 75/75,
base typecheck, lint, production build, and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report post-review fix plan): completed the
V4 `narrativeDetails`-only writer contract, additive report application,
canonical activity-dimension grounding, full activity Evidence Bank lineage,
reflection isolation/Q1-Q7 routing, recursive finding sanitisation, exact
Social Proof provenance, independent takeaway evidence scopes, section-level
numeric and voice/mechanics guards, two-batch generation, cache-version
identity, and structured takeaway rendering with legacy fallback. Matching
context remains canonical-only. Narrative schema failures now retain the
affected batch and sanitized Zod issue paths/codes/messages in console and
generation-job error logs. Measured: focused Personal Report/evaluation/
domain/API/matching/UI suites 104/104, UI follow-up 8/8, narrative follow-up
36/36, base and strict typecheck, lint (0 errors; 5 existing warnings), i18n
checker (0 missing keys), CI production build, and `git diff --check` pass.
One full Vitest run measured 3,510 passed, 6 failed, and 2 todo; it was before
the final i18n-label follow-up and included that now-fixed checker failure plus
five unrelated API timing/parallel-test failures. The
Personal Report route suite passes 7/7 in isolation.

Working tree 2026-08-29 (saved-program URL handoff): a pasted course URL now
automatically supplies the saved programme label—using the catalogue match when
available, otherwise its final URL path—so application planning no longer
rejects a link-only selection as missing a subject. Measured: focused programme
domain tests 36/36, production build, scoped ESLint, and `git diff --check` pass.

Working tree 2026-08-29 (Personal Report prompt/spec architecture): the
Personal Report writer now uses structured Q1–Q7 reflection findings,
additive narrative activity evidence, exact two-batch section routing,
section-scoped evidence IDs, numeric/voice/hypothesis guards, and deterministic
materialization of traits, capabilities, motivation, proof, positioning, and
takeaways. Narrative detail fields are hydrated by the UI, and extraction plus
narrative cache identities include their prompt and contract versions. Measured
locally: focused Personal Report/evaluation/domain/API tests 265/265, UI tests
29/29, i18n integration 2/2, base and strict typecheck, lint (0 errors; 5
pre-existing warnings), CI production build (3 pre-existing geo-content
tracing warnings), and `git diff --check` pass. Full Vitest: 3,496 passed, 6
failed, 2 todo; failures are existing CV-builder/API timing or stale-job test
expectations outside this change.

Working tree 2026-08-29 (Personal Report + Matching Report V3 contract repair):
Target Profile cache identity now includes schema and extraction-prompt
versions, and the extractor carries source-backed typed university/programme
facts. Matching V3 now uses the canonical metric/submetric names and weights,
discrete academic rubric scores, four canonical key takeaways, explicit gap
types, separate university/programme fit scores, and no fabricated legacy F5
mapping. Personal Report cache validation is prompt-aware, stored reports are
schema-validated, and reflection normalization no longer creates generic prose
when AI extraction fails. The additive `supabase-target-profile-cache-contract.sql`
migration is required before deploying the target-profile cache changes.
Measured locally: full Vitest 370 files / 3,496 passed, 6 failed (2 todo),
typecheck, lint (0 errors; 5 pre-existing warnings), i18n audit, CI production
build (3 pre-existing geo-content tracing warnings), and `git diff --check`
passed. GitNexus change detection for the current working tree reported low
risk across 25 changed tracked files, with no graph-mapped symbols or affected
execution paths.

Working tree 2026-08-29 (Personal Report narrative batch contract): the prose
prompt, parser, and optional-section semantics now agree: a batch returns only
the sections it was asked to write, while omitted or null optional summaries
(including `snapshot`) are valid. Requested available canonical sections still
require valid structure, grounded evidence IDs, supported numbers, and
third-person voice. This fixes the production `schema_response` retry caused
by an optional `snapshot: null`. Prompt/extraction versions were bumped to
invalidate stale cached narratives. Measured: narrative synthesis 26/26,
generation orchestration 13/13, base and strict typecheck, scoped ESLint, and
`git diff --check` pass.

Working tree 2026-08-28 (Personal Report sample-output UI): the existing report
contract is now surfaced more completely in the UI. Applicant Snapshot prefers
the canonical 150–200 word snapshot and shows the overall impression; Core
Identity shows evidence-backed recurring characteristics; Driving Force exposes
primary/repeated motivation signals and strategic interpretation; capability
profiles show an overview and combination note; Social Proof shows activity
metadata and a grounded numeric conclusion; Positioning labels its profile
narrative and experience connection; Key Takeaways now renders stored
structured evidence, confidence, importance, gaps, and directions. Social Proof
now also surfaces explicit team-member, community-reach, and commitment-year
figures from the same grounded Proof of Me cards; missing figures are omitted,
never shown as zero. Measured: focused domain/UI tests (23/23), typecheck,
ESLint (0 errors, 6 pre-existing warnings), and static i18n audit (0 missing
keys) pass.

Working tree 2026-08-28 (Personal Report narrative batching): the constrained
LLM prose layer now generates canonical sections in two parallel batches
(`3000` completion tokens each) and optional summaries in a separate `1800`
token batch, then merges them through the existing section-scoped evidence
validator. This avoids truncating the full report response while preserving
the deterministic findings, scores, availability, and evidence boundaries.
Measured: narrative/generation/UI tests (42/42), typecheck, scoped ESLint,
and CI build pass. The full Vitest run had two unrelated CV-route timeout
flakes; both pass when run in isolation.

Working tree 2026-08-28 (CI strict typecheck repair): `buildPersonalReport`
now omits the optional `reflectionAnswerSignals` property when it is undefined,
which satisfies `exactOptionalPropertyTypes` without changing report output.
Measured: `npm run typecheck:strict`, the Personal Report domain suite (16/16),
and `npm run test:ci` pass. This fixes CI #540's TS2379 failure.

Working tree 2026-08-28 (Personal Report architecture alignment): confirmed
snapshot reconstruction now preserves activity/achievement metadata,
reflection/reflectionCard, and canonical direction aliases; Q1-Q7 route to
their specified insight sections; reflection signals require independent
activity corroboration before becoming repeated; Q4-only capability claims are
self-reported and capped until corroborated; Social Proof, Positioning,
Key Takeaways, and later Matching consume the grounded inputs; narrative
synthesis receives structured findings only and rejects unsupported numeric
facts. Personal Report strings added to the locale catalog. Measured: requested
Personal Report/evaluation/API/UI suites pass (153 tests), full Vitest 3,480
passed with 2 todo, typecheck, i18n integration, CI build, and diff check pass;
lint has 0 errors and 6 pre-existing source warnings. CI placeholder builds now
skip mentor/university Supabase reads instead of logging DNS failures; the 3
existing geo-content filesystem-tracing warnings remain.

Working tree 2026-08-28 (report rendering/localisation): Personal, Matching,
and Strategy report roots now explicitly opt into AI-backed DOM translation when
Vietnamese is selected; the Personal Canvas body-level modal is covered too.
Private-page content outside those roots remains dictionary-only and is not sent
to `/api/translate`. Empty growth-matrix quadrants now show an explicit
translated empty state instead of looking broken. Measured: report/translation
Vitest 24/24, `npm run typecheck`, targeted ESLint, `node scripts/check-i18n.mjs
--all`, `npm run build`, and `git diff --check` pass. Build retains three
pre-existing dynamic-filesystem tracing warnings in `src/lib/geo-content.ts`.

Working tree 2026-08-28: production retry reached `gpt-5.6-luna`, but the
Personal Report provider rejected the legacy `max_tokens` parameter and then
the custom `temperature` parameter (`max_completion_tokens` is required and
Luna only supports its default temperature). `openAiJsonCompletion` now sends
the compatible token parameter and omits temperature for GPT-5 models, with
regression tests. The same compatibility helper now covers the Matching
structured-generation path and every remaining direct Chat Completions call;
no production source occurrence of `max_tokens` remains. Forced retries also
run immediately from Create Report. Focused Vitest 88/88, base TypeScript,
scoped ESLint, and `git diff --check` pass. Production must redeploy this
latest fix before the next report retry.

Working tree 2026-08-28: the analysis gate now treats a current Personal
Report as complete even when an old active queue row is still pending. This
prevents the page from staying at `0 / 2` forever and allows Matching Report
generation to start after a report was completed by another generation path.
The application Personal Report POST also returns the current report instead
of re-waiting on that stale queue row. Focused route/UI tests, TypeScript,
ESLint, and `git diff --check` pass.

Working tree 2026-08-27: canonical Planner micro-steps now carry persisted,
planning-owned student guidance, shown immediately in the hierarchical List
and in the task detail’s “What to do” panel. New and refreshed deterministic,
roadmap, and optional enrichment tasks supply specific guidance; legacy rows
without the new field safely show a deterministic fallback until they next
reconcile. `supabase-planner-micro-step-guidance.sql` is a forward-only
terminal migration after the hardened multi-microstep repair. It adds nullable
`guidance` without changing execution state and installs the final hardened
reconciler: application lock, content compatibility/reset, archiving,
service-role grant, and `v_micro_id` handling remain intact. The code also
retries only the PostgREST missing-`guidance` projection errors, so a deploy
that reaches Vercel before the dashboard migration does not take the Planner
down. Measured locally: focused Planner Vitest 57/57, base and strict
TypeScript, lint, the CI-placeholder production build, and `git diff --check`
passed. The i18n audit reports 0 missing static keys; the new Planner string
is catalog-backed. PR #220's Planner Tests and real PostgreSQL Planner DB
integration passed. Its initial static/aggregate CI failure came from nine
`response is possibly undefined` test-only errors in
`src/app/api/ai-strategy/personal-report/route.test.ts`; a scoped follow-up
now makes each test fail explicitly if the handler does not return an HTTP
response, while leaving route behavior unchanged. Measured: that route suite
10/10, base and strict TypeScript, and `git diff --check` pass. PostgreSQL
integration was not run locally because `psql` is unavailable.

Working tree 2026-08-27: fixed advisor applications being invisible and
unactionable at `/admin/achievers`. Submission was already succeeding — a
read-only production check found 6 reviewable `achiever_profiles` rows, 2 of
them pending — but the page queried with the signed-in request client, whose
RLS policy exposes only approved profiles and the caller's own row. Approve and
Reject used that same browser client, so they could update zero rows without an
error while the UI still moved the card to Processed. The review queue now
loads through an admin-authorized mentorship repository using the trusted
server client and an explicit minimal projection; decisions go through a new
admin-authorized PATCH route, update pending rows only, and change client state
only after the database confirms the write. No migration is required. The
optional `quick_signup` badge was removed from the DTO after the live exact-
projection check proved that column is not deployed. Measured locally: focused
Vitest 3 files / 9 tests passing, base and strict TypeScript, scoped ESLint, and
the static i18n audit (0 missing keys), and the Next.js 16.3.1 production build
pass. The build retains the 3 pre-existing Turbopack filesystem-tracing warnings
in `src/lib/geo-content.ts`.

Working tree 2026-08-27: fixed role-gated top-navigation links disappearing
outside `/profile`. The advisor, coordinator, and admin checks now live in one
root navigation-role provider shared by both the legacy app header and the
`SiteNavigation` header used by Home and other rebuilt routes; desktop and
mobile menus receive the same role destinations. Role reads remain best-effort
UI affordances and do not replace the existing server-side route guards.
Measured locally: focused navigation Vitest **4 files / 22 tests passing**,
base and strict TypeScript, scoped ESLint, `git diff --check`, and the Next.js
16.3.1 production build pass. The build retains three pre-existing Turbopack
filesystem-tracing warnings in `src/lib/geo-content.ts`. Signed-in browser
verification remains unrun.
Working tree 2026-08-27: candidate-information step 2 (`Activities &
Achievements`) is now the approval point for AI-extracted evidence. Its
Continue action persists displayed extracted rows as `reviewed`; Review &
Confirm is summary-only and no longer forces an additional per-item review
queue. Existing rows with the old `needs_review` status also no longer block
confirmation. The Experiences summary now reports saved achievements and
activities as `Experiences confirmed`, instead of showing `0 confirmed` when
no separate Reflection Cards exist. Focused Vitest (30 tests), typecheck and
targeted ESLint passed. The confirm route now safe-parses the snapshot payload
and returns an actionable 422 when legacy experience data cannot be frozen,
instead of surfacing an opaque 500.

Audit 2026-08-27: after the queue repair was applied, the live Personal Report
queue schema exposes `idempotency_key` and its worker processed a job. That job
was correctly blocked as `INSUFFICIENT_EVIDENCE`, so queue execution is proven
but a new successful generation still needs adequate confirmed evidence. The
all required Matching V2 and Personal-lineage columns now resolve (`200` via
PostgREST) after `supabase-matching-report-personal-lineage.sql` was applied.
The migration blocker is closed; the separate execution-flow findings in the
audit still need remediation before calling Matching end-to-end reliable.
See `docs/plans/2026-08-27-personal-matching-ai-flow-audit.md`; local green
test/build gates are not production migration verification.

Working tree 2026-08-26: kept the Personal Canvas artwork as the desktop background and changed its four upper/middle hover effects to SVG cutouts. Each highlight now follows its panel and excludes the shared Core Identity hub; rectangular hover shadows were removed. Hotspots 1/4/5 were then lifted to match their artwork, the hover/active highlight was strengthened, and hotspots 2/3 were shortened to stop at their own lower divider (with further 0.75% and 1% trims). The centre hotspot and all cutout ellipses now derive from the actual 1024×731 artwork circle coordinates, rather than estimated per-card percentages. Parts 4/5 now start at their actual divider and extend to their existing bottom edge. Selecting a section now opens the existing accessible centered modal rather than shrinking the canvas into a side panel and drawing a connector; the modal owns Escape, backdrop close, scroll lock, and focus return. Part 6 uses a stronger brand overlay and shadow on hover/selection. Last focused Personal Canvas measurement before the final 1% adjustment: Vitest 13/13 passing and `git diff --check` passing; no test rerun by owner request. ESLint still reports 26 pre-existing raw-colour errors in the same uncommitted canvas overhaul; browser visual verification remains unrun.

Working tree 2026-08-27: fixed the terminal hardened canonical Planner
reconciler so micro-step inserts collect their IDs in `v_micro_id` and never
overwrite the parent `v_step_id`. Added
`supabase-planner-production-hardening-multi-microstep-fix.sql` as the
forward-only repair for databases where hardening was already applied; it keeps
hardening's application lock, content-value compatibility/reset rules,
archiving, and service-role grant. The real PostgreSQL harness now reconciles
three sibling micro-steps and checks their common parent, stable IDs,
execution-state preservation, schema-reset behavior, archiving, and atomic
rollback. The required hardened sequence is Core 3 hierarchy → canonical
production → Planner Ops → production hardening → the terminal hardening
multi-microstep repair; the earlier canonical repair is pre-hardening only.
Measured locally: Planner Vitest 48 files / 476 tests, migration Vitest 3/3,
base and strict TypeScript, ESLint, `git diff --check`, and production build
all passed. The build used placeholder Supabase configuration and logged its
expected unreachable-placeholder fetches while exiting 0. PostgreSQL
integration remains for CI because `psql` is unavailable locally.

Working tree 2026-08-27 (Personal Report backend review fixes): application
scoping, atomic confirmation, exact document evidence, reflection signal
propagation, academic assessment persistence, issued follow-up questions,
durable queue idempotency/force handling, safe generation DTOs, and fresh UI
polling are implemented. Added the required Supabase migration scripts and
regression coverage. Measured: full Vitest 362 files / 3440 passed (2 todo),
`npm.cmd run typecheck`, `npm.cmd run typecheck:strict`, `npm.cmd run lint`
(0 errors, 591 warnings), `node scripts/check-i18n.mjs --all`,
`npm.cmd run build:ci`, and `git diff --check` pass. Live Supabase schema/RLS
and signed-in browser verification remain unrun. `npm.cmd run verify:pr` is
blocked locally because the repository requires Node 24.19.0 and this shell
has Node 24.13.0.
Owner telemetry then exposed a live `42702` failure in the new confirmation
RPC (`confirmed_at` was ambiguous in its `RETURNING` clause); the SQL migration
was corrected and pushed as `636d8a4`. Re-run
`supabase-application-confirm-atomic.sql` in Supabase before retrying confirm.
Follow-up telemetry showed the analysis workspace treated the queue endpoint's
valid `202 queued` response as a failed report and consequently marked Matching
failed too. `AnalysisWorkspace` now polls the Personal Report job and starts
Matching only after Personal completes; focused UI coverage is 9/9.

Working tree 2026-08-26: added Vietnamese dictionary coverage for all seven Personal Reflection labels, questions, guidance prompts, and sample answers. The sample-answer disclosure now also uses the translator; the form opts out of DOM-level translation so toggling back to English cannot be overwritten. Measured: focused Personal Reflection Vitest 7/7 passing, `npm.cmd run typecheck`, and `git diff --check` pass.

Working tree 2026-08-26: replaced Personal Reflection's previous five prompts with the supplied seven-question “About Yourself” and “About Your Direction” set. Each prompt now includes its guidance and sample answer; completion and progress correctly use seven answers. Measured: focused Vitest 11/11 passing, `npm.cmd run typecheck`, and `git diff --check` pass.

Working tree 2026-08-25 (reflection evidence UI continuation): the achievements reflection form now follows the supplied SVG layout more closely: normalized achievement cards, compact activity detail row, corrected searchable picker focus behavior, compact add controls, and the sample upload row. The uncommitted shared reflection shell change was restored to HEAD after review; the unrelated latest SEO commit was not rolled back. Measured after this pass: npm.cmd run typecheck and npm.cmd run lint pass. npm.cmd run build also passes.

Last reconciled: **2026-08-27 (Asia/Saigon)**

Working tree 2026-08-25: Comprehensive SEO improvement plan (`docs/plans/2026-08-25-seo-improvement-implementation-plan.md`) implemented end-to-end.
- **GEO Quality Gate & CMS read boundary:** `src/lib/geo-cms-validation.ts` enforces zero placeholder markers (`TODO_SOURCE_REQUIRED`, generator draft copy) and source verification on tuition/entry claims across the admin publish API and reader path.
- **Route Indexability Contract:** Pure classifier `src/lib/seo/indexability.ts` and explicit `robots: { index: false, follow: false }` metadata in layouts for `/auth`, `/apply`, `/profile`, `/dashboard`, `/admin`, `/onboarding`, `/ai-strategy`, `/coordinator`, `/payment`, `/plus/success`. Private redirect responses carry `X-Robots-Tag: noindex, nofollow` in `src/proxy.ts`.
- **Server-rendered Vietnamese Routes & Reciprocal `hreflang` (Part 7):** Created `src/lib/seo/alternates.ts` for clean reciprocal alternates generation (`canonical`, `en`, `vi`, `x-default`). Created Vietnamese server routes under `src/app/vi/**` (`/vi`, `/vi/about`, `/vi/how-it-works`, `/vi/news`, `/vi/news/[slug]`, `/vi/universities`, `/vi/universities/[id]`, `/vi/advisors`, `/vi/advisors/[id]`, `/vi/scholarships`) with `LanguageProvider defaultLang="vi"` in `src/app/vi/layout.tsx`.
- **Truthful & Stable Sitemap with Alternates:** `src/app/sitemap.ts` emits canonical public URLs (both English base routes and `/vi` routes) with full `alternates.languages` mappings (`en`, `vi`), removes `/apply`, and binds honest publish/update dates (`guide.updatedAt || guide.publishedAt`) instead of `new Date()`.
- **Canonical & Entity Structured Data:** `src/lib/seo/json-ld.ts` provides XSS-safe serialization and standard schema builders (`Article`, `BreadcrumbList`, `CollegeOrUniversity`, `Person`, `Organization`, `WebSite`). Embedded on `/news/[slug]`, `/universities/[id]`, `/advisors/[id]`, and `/`.
- **Crawlable `/scholarships` Preview:** Signed-out visitors and crawlers receive an indexable, search-filtered scholarship directory with rendered `<h1>` without auth redirection.
- **Automated Regression Gate:** Added `scripts/check-seo.mjs` and npm command `npm run seo:check`.
- **Strategy & Entity Docs:** Authored `docs/seo-content-strategy.md`, `docs/seo-entity-checklist.md`, and `docs/seo-baseline-2026-08-25.md`.
- **Measured Gates:** Full test suite (329 test files, 3,165/3,165 tests passing), `npm run typecheck` (0 errors), `npm run typecheck:strict` (0 errors), `npm run lint` (0 errors, 0 warnings), `node scripts/check-i18n.mjs --all` (0 missing static keys, 0 placeholder mismatches), `npm run seo:check` (100% pass), `npm run build` (all 145+ static & dynamic routes compiled successfully).

Working tree 2026-08-23: the report pipeline now enforces Personal Report
completion before Matching Report generation, records Personal Report lineage
on Matching Report rows, and filters Strategy/Planner consumption to the
current Matching prompt and F5 engine. The canonical planner selects the
current schema-validated F8 `report_v2` before its F7 fallback and reconciles
F8 phase/deliverable keys into `application_plans` → phases → steps →
micro-steps. Regeneration keeps the same deliverable node identity and never
writes student-owned `status`, `deadline`, submitted content, or evidence.
Planner context carries stored deadlines, application-requirement IDs, explicit
profile preferences, and only explicit `planner.availability` /
`planner.time_capacity` answers; it does not infer availability. Measured:
focused report + planner regression suite **77/77 passing**, `npm run
typecheck` passing, and ESLint passing on the changed planner files. Live
schema application and signed-in browser verification remain unrun.

The availability/time-capacity contract now has a canonical producer: declared
`long_text` inputs with stable semantic keys. The deterministic mapper emits
only missing inputs, the existing generic content-value flow marks a declared
answer for re-sync, and reconciliation retains answered nodes without copying
student-owned `content_value` or creating duplicates. Existing canonical plans
that lack an unanswered declared input receive the same one-time upgrade. This
addition measured **64/64** focused planner tests passing, `npm run typecheck`,
and ESLint on all changed contract files; browser/database verification remains
unrun.

Full UI Polish across all Planner views (List, Calendar, Board/Kanban) complete 2026-08-23.
- `HierarchicalApplicationPlanner`, `PlannerCalendar`, `PlannerBoard`, `PlannerShared`: refined with GlowBal design tokens (`brand` #E11D48, `surface-muted`, `line`, `rounded-gb-2xl`), responsive month headers, clean 6-week day cells, today badge, in-cell task cards, unscheduled sidebar trays, 5-column Kanban board with status indicator accent dots, count pills, and quick status select dropdowns.
- Strict typecheck (`tsc -p tsconfig.strict.json`), i18n check (`check-i18n.mjs --all` with 0 missing keys), test suites (39 files, 437/437 passing), and Next.js production build (`npm run build`, 135/135 pages compiled) all verified passing 100%.

Wave 2 of `docs/plans/2026-08-23-feature-2-parts-5-9-execution-v2.md`
(Part 6 GenUI) complete 2026-08-23 (commits `d7fccee`, `f5f0112`).
`contentBlockSchema` variants now accept an optional `v` literal — only
absent (legacy v1) or `1` parses; anything else degrades to `null` on
read-back with no migration and no generator change, and student
`content_value` stays unversioned. The degradation tests became a full
fixture matrix (29 block + 13 value rows), and three ownership-proof
tests pin reconcile: unchanged `domain_node_id` ⇒ same-row update,
micro-step writes carry generated keys only (exact key-set assertion),
checklist user progress survives regeneration. UI side:
`ui/content-blocks/registry.ts` is an exhaustive block-input map behind a
thin dispatcher — adding a variant without an input is a compile error;
null/unknown blocks land on an honest FallbackBlock. structured_table
renders card-per-row below 768px with the desktop table untouched,
long_text wires its hint via aria-describedby, the checklist is
regeneration-safe, single_select still saves by value with semanticKey
never in the DOM. Measured gates: feature suite 39 files / **434 tests**
(+50 vs Wave 1), typecheck + typecheck:strict clean, eslint clean on all
changed files, `check-i18n --all` green. Still open in Part 6: §6.10
verify against a real F8 generation (generate → Add-to-Planner → sync ×2
no duplication → one broken block does not sink the page → mobile
complete), which needs a dev server.

Wave 1 of `docs/plans/2026-08-23-feature-2-parts-5-9-execution-v2.md`
complete 2026-08-23 (commits `def840f`, `9d9f6d9`, `afa726f`, `947c7aa`,
`ec9a5f6`). Part 5.2–5.4: board and calendar are now dispatcher components —
desktop trees byte-identical, narrow viewports get `BoardMobile` (ARIA tablist
with per-status counts, one mounted tabpanel, per-card `<select>` through the
same `onStatusChange`) and a compact calendar grid with a tap-selected day
agenda plus an unscheduled tray whose drop handlers survive behind a
disclosure. New `ui/use-media-query.ts` uses `useSyncExternalStore` with a
desktop server snapshot so hydration never mismatches; the shared matchMedia
test stub resolves width queries against jsdom's real 1024×768 viewport and
exposes per-query overrides. Part 5.5–5.8: pure reminder policy in
`src/lib/email/planner-reminders.ts` (user-local Intl calendar math anchored
at UTC midnight, authority gate before parsing, ISO-8601 week keys, throwing
event-key builders), wired into `/api/cron/lifecycle-emails` as two batched ≤200
processors with per-item try/catch — deadline reminders (30/7/1-day +
same-day, terminal application statuses excluded) and the weekly strategy
digest over canonical micro-steps only (completed excluded, empty weeks never
mail). `weeklyStrategyDigestEmail` added to lifecycle templates;
`deadlineReminderEmail` says Deadline-today for daysRemaining 0. 11 new VI
entries in `PLANNER_TRANSLATIONS`. Measured gates: feature suite 39 files /
384 tests, email + cron suites 42 tests, repo-wide typecheck and
typecheck:strict clean, eslint clean on all changed files, `check-i18n --all`
green (0 missing / 0 mismatch / 0 dynamic gaps). Still open in this wave:
Task 5.9 full regression including `npm run build`; hierarchical planner
mobile pattern deferred to a second pass.

Pushed 2026-08-23: `def840f..dda242e main -> origin/main` after the full
suite measured 320 files / 3063 passed / 0 fail and `npm run build` exited 0.
Consolidated pending-migration list agreed with the owner same day (each file
idempotent; verify against a live schema dump before treating any as applied —
this sandbox has no service key):
**A. now required by the email cron** — `supabase-email-system.sql` (dev +
production; without it the cron still sends but has no durable event_key
dedup); **B. canonical planner** — `supabase-core3-plan-hierarchy.sql` then
`supabase-canonical-planner-production.sql`; **C. Parts 0–4 strategy reports**
— `supabase-matching-report-personal-lineage.sql`,
`supabase-strategy-recommendation-lineage.sql`,
`supabase-strategy-report-v2.sql`, `supabase-report-overrides.sql`,
`supabase-recommendation-source-key.sql` (`supabase-match-report-narrative.sql`
dropped from the list: zero `match_report_narrative` references remain after
the PR #216 merge removed the narrative layer); **D. Final Check** —
`supabase-final-check.sql`; **E. repairs still NOT CONFIRMED RUN per
known-issues §5r/s/t** — `supabase-application-cascade-repair.sql`,
`supabase-personal-report-supplements.sql`,
`supabase-personal-report-versions.sql`; **F. payments, when used** —
`supabase-plus-promo-redemption.sql` then `supabase-plus-promo-v2.sql`
(in that order), `supabase-manual-payment-subscription-conflict-repair.sql`
(the first repair is confirmed applied), `supabase-vnpay-payments.sql`.

Merge 2026-08-23 (latest): merged `origin/main` (4 incoming commits) into local
`main`, which had diverged 3/4. The big incoming commit is PR #216 — an
independent implementation of the same Feature-2 surface our Parts 0–4 work
covered: real F5 engine (`assessProgrammeFit`, AcademicBand-based
classification, `strong_match`, fractional scores), Matching Report rebuilt as
six sections on the canonical route, Strategy Report restructured into five
sections, Final Check built end to end (route + API + repository +
`supabase-final-check.sql`, nav unlocked), plus three planner deadline-input
fixes. Resolution rule: where the two implementations overlapped, PR #216's
design wins (it is what their presentation layer, docs, and tests pin); where
our work was independent and still true, it was preserved. Concretely: our
`evaluateProgrammeFit`/`compositeScore` engine, the AI `matchingReportNarrative`
layer (schema + prompt + persistence + retry paths), and its dictionary/tests
were removed in favour of theirs — including reverting
`ai-reports-repository.ts` to base; our lang-aware dates in
`strategy-recommendation-report.tsx` (`formatUiDate(iso, lang)`) and the
`withReturn('/profile', …)` thread on the rebuilt Matching Report were ported
onto their versions; the recovered `i18n-dictionary.ts` block survived intact
and their two workspace-status entries were appended (union, 0 duplicate keys).
Semantic breakage the textual merge hid and this pass fixed:
`match-insights/route.ts` still referenced `.narrative`/`.deterministicEvaluation`,
and domain/index.ts still re-exported the deleted schema. Measured after the
merge: typecheck ✅, typecheck:strict ✅, lint 0 errors (4 pre-existing
warnings), `check-i18n --all` green (0 missing / 0 mismatch / 0 dynamic gaps),
dictionary scan 4523 keys / 0 dups, full `npm test` 2944 passed with 2
timeout-flaky failures that both pass in isolation (resource contention under
parallel load, not merge damage). NOTE: vitest now runs inside the sandbox
(file policy changed to danger-full-access), so future passes can measure
tests directly. Backup branch before the merge: `backup/pre-merge-f67b35f`.
Still unrun: `supabase-final-check.sql` must be applied before Final Check
generation works in production (per PR #216).

Working tree 2026-08-23 (later): bug-fix pass over the Parts 0–4 three-agent
review (every finding re-verified against the working tree before fixing).
Fixed: `matching-report-view.tsx` "Check profile data" threads `?return=` via
the shared `withReturn` helper (the exact 5s/5u regression class); report-family
dates go through new `shared/lib/ui-date.ts` (`formatUiDate`/`formatUiDateTime`,
locale follows UI language) replacing hardcoded `en-US`/`en-GB`/`vi-VN`
literals in matching-report-view, version-history, personal-report-v2-view,
review-confirm-view, analysis-workspace, strategy-recommendation-report; three
retired radius values in `personal-canvas.tsx` mapped to `rounded-gb-xl/2xl`;
strategy export route answers **501** ("renderer not built for F8") for
F8-only rows instead of the misleading 409; the F8 Strategy Report view gained
an Add-to-Planner card reusing `generateRoadmapTasks` (which already reads
`report_v2`); ~50 missing VI dictionary entries added — matching-report band/
status labels (dynamic `t()` calls invisible to the static audit) plus F8
chrome strings. INCIDENT, recovered: an accidental full-file overwrite
destroyed the uncommitted tail of `i18n-dictionary.ts`; rebuilt by combining
HEAD with string-literal pairs extracted from the Turbopack dev cache
(`.next/**/src_lib_*` chunks keep source-format literals), a verbatim pre-loss
read of lines 4208–4257, and freshly written translations only where no copy
existed (F8 chrome, band labels); duplicates against HEAD deduped (11 lines,
double-quoted HEAD tail the extractor initially missed). Verification this
pass: typecheck clean on every touched file (repo-wide still blocked by the
pre-existing untracked `glowbal-resend-v2/` missing deps), eslint 0 errors on
changed files, `check-i18n --all` green (0 missing / 0 mismatch / 0 dynamic
gaps). NOT run here: targeted vitest — the sandbox denies the child-process
spawn vitest's config loader needs (`spawn EPERM`); run `npm test` outside
before committing.

Working tree 2026-08-23: Feature 2 Parts 3–4 implemented on top of the
reviewed Parts 0–2. Part 3: F5 deterministic engine hardened (out-of-range
rejection, complete missingInputs) with a 29-test matrix + drift-detector vs
`enforceFitClassification` (33 boundary/gate cases); wired into match-insights
(classification re-derived server-side, renormalisation disclosed in
limitations, composite computed render-side via `fitScoreToPercent`);
optional AI narrative (`match_report_narrative`) persisted/read with graceful
degradation; Matching Report UI rebuilt around the six canonical sections.
Part 4: five-section F8 payload (`strategyReportV2Schema`, prompt
`strategy-report-f8-v3`) persisted in `report_v2` JSONB with legacy-shape
fallback when migrations lag; student overrides table
(`application_report_overrides`) + editable Strategic Priority Table layered
override-first; Strategy Report UI dual-shape (v2 rows → new view, old rows →
F7 layout untouched); Planner seeds from F8 deliverables keyed by deterministic
`source_key` (migration adds column) so regeneration updates in place and never
duplicates. Verification: 108 suites / 1053 tests pass, typecheck + strict
clean, eslint clean on changed files, i18n 0 missing. PENDING: run 5 new SQL
migrations live (`supabase-strategy-recommendation-lineage.sql`,
`supabase-match-report-narrative.sql`, `supabase-strategy-report-v2.sql`,
`supabase-report-overrides.sql`, `supabase-recommendation-source-key.sql`);
untracked `glowbal-resend-v2/` folder breaks local `npm run typecheck`
(missing deps, unrelated to this work); PDF export still renders legacy rows
only.

Working tree 2026-08-23 (F5 route wiring): the live
`applications/[id]/match-insights` route now adapts the validated model F5
dimensions/eligibility into the shared deterministic engine. Weighted score,
missing-dimension renormalisation, hard eligibility gates, confidence and
classification are canonical server output; model classification/confidence
are ignored. The input hash includes `F5_ENGINE_VERSION` so pre-change rows do
not cache-hit. Measured: route regression 4/4, combined F5/AI/route suites
46/46, matching presentation suites 31/31, base TypeScript clean, and ESLint
clean on changed files. Strict TypeScript remains blocked only by the
pre-existing `hierarchical-application-planner.test.tsx` optional-id error.

Working tree 2026-08-22: Feature 2 Parts 0–2 implementation review + bug-fix
pass. Fixed in `strategy/recommendation/route.ts`: the route wrote a
`student_personal_report_versions.id` into `source_analysis_id`, whose FK still
references `applicant_analyses(id)` — every fresh insert failed 23503 and the
silent fallback nulled lineage AND made the flawed cache check stale-hit forever
(`|| !latestStrategy.source_analysis_id`). New guarded migration
`supabase-strategy-recommendation-lineage.sql` adds `input_hash` +
`source_personal_report_version_id` (correctly typed FK); the route now persists
both, never writes `source_analysis_id`, caches on content-hash primary /
exact-lineage fallback, and degrades to the pre-lineage insert shape when the
migration has not run. Also fixed: activity-reflection "Finish reflection"
missing `.catch` (unhandled rejection); personal-reflection-form now flushes a
pending debounced edit on unmount; `fitScoreToPercent`/`F5_DIMENSION_WEIGHTS`
deduped into `src/shared/evaluation/f5-programme-fit.ts` (re-exported from
ai-reports). Verification: 9 focused suites / 109 tests pass, typecheck +
strict typecheck + eslint clean, check-i18n 0 missing keys.

Code snapshot: branch `claude/university-application-flow-0khm6v`, restarted
from `main` after the branch's previous content (the application setup flow
redesign + its UX/navigation correction pass, described in the two
`claude/university-application-flow-0khm6v` rows further down) merged as
PR #202. This branch's current, unmerged work: rebuilt `/ai-strategy` as an
animated "Strategy Hub" landing page (from an owner-supplied HTML/CSS/JS
prototype) and added the GlowBal Plus paywall on the per-application AI
Strategy workspace it had been missing since 01/08. See "Last completed work"
below.

Working tree 2026-08-21: the canonical Application Planner is now a usable
application-navigation destination for Plus and admin users, rather than a
hidden URL behind the legacy recommendation onboarding gate. `ApplicationNav`
unlocks its Planner item for canonical entitlement and the Planner route accepts
that entry directly; free users retain the existing legacy onboarding gate.
Focused navigation tests pass 14/14 and TypeScript passes. The production
Supabase migration and deployment remain required before the canonical route
can initialize a real plan.

Working tree 2026-08-23: both Strategy Report variants now hand off directly
to `/ai-strategy/[applicationId]/planner`; they no longer POST to the legacy
`roadmap-tasks` route, which rejects canonical Planner applications. A separate
production defect was found in `reconcile_canonical_application_plan`: the RPC
overwrote the parent step UUID with the first inserted micro-step UUID, so any
step with multiple micro-steps failed its second insert. For a database that
has only the canonical production reconciler, apply
`supabase-canonical-planner-multi-microstep-fix.sql`. Do not apply that older
repair after `supabase-planner-production-hardening.sql`: it predates and
would replace hardening's lock and content-value compatibility logic. A
hardened database instead requires the terminal,
`supabase-planner-production-hardening-multi-microstep-fix.sql` repair.
The AI Strategy/Planner suite passes 451/451, TypeScript passes, and changed-file
ESLint passes; E2E was intentionally not run.

Working tree 2026-08-21: Core 3 Plan now has a server-only, deterministic-first
AI enrichment boundary using the existing OpenAI JSON-mode client. Pure
Assess/Decide/Plan compilers remain unchanged. The model receives only
whitelisted blocker or explicitly selected attention scopes and a narrow
grounded context; strict Zod validation rejects forbidden execution fields,
deadlines, unknown decision IDs, unknown schemas, duplicate client keys, and
oversized output before a pure merge creates stable canonical node IDs. AI
failure falls back to the deterministic scaffold. AI planning provenance is
persisted in the existing source-provenance JSONB field alongside factual
provenance, so no new migration is needed. Focused enrichment/Core 3/persistence
tests pass 26/26 and strict TypeScript passes.

Working tree 2026-08-21: canonical Planner page entry now compares the
deterministic Planner Ops source fingerprint with the persisted plan source fingerprint. Equal
fingerprints do not invoke AI; changed factual/planning context triggers a
safe canonical reconcile and optional enrichment. Core 4 status/deadline
execution writes are excluded from the fingerprint and do not invoke AI.

Working tree 2026-08-23: Planner Ops is now implemented as a cross-cutting
layer, not a fifth core. `plannerSourceFingerprint()` excludes execution-only
state, `refreshApplicationPlan()` records bounded generation runs with a
database uniqueness lock, preserves the previous plan on failure, and exposes
manual retry. `PlannerHealth` is a single server read model; the Planner shows
current/stale/refreshing/failed/complete states, and `/admin/planner` exposes
server-filtered lifecycle/AI signals. Plan and micro-step feedback is validated
server-side, upserted per user/target, and cannot mutate planning facts. New
migration: `supabase-planner-ops.sql`, after the two canonical hierarchy
migrations. The Planner feature suite passes 332/332 tests;
strict and base TypeScript pass; full lint has 0 errors and one pre-existing
manual-payment warning.

Working tree 2026-08-23: canonical Planner production hardening now closes the
remaining access, crash-recovery, persistence, and canonical/legacy isolation
gaps. Canonical reads and execution/refresh/feedback boundaries require both
Plus/admin entitlement and application ownership; admin sync uses a trusted
server-only feature entry point; generation leases are claimable/reclaimable
through a forward-only hardening migration; content schema changes validate
and reset incompatible execution values; and DashboardSummary derives progress
from the canonical hierarchy. Regression coverage is 351 focused Planner/API/UI
tests, with base and strict TypeScript plus targeted ESLint clean. A real local
Postgres run is scripted but not runnable in this checkout because neither
`psql`/Supabase CLI nor a running Docker daemon is available; no production
migration or deployment was performed.

Working tree 2026-08-20: Core 1 Assess is now callable end to end through
`getApplicationAssessments(supabase, applicationId, userId)`: the source
adapter fetches validated application facts and F5/F7 metadata,
`compilePlanningContext()` produces a deterministic pure context snapshot, and
`compileAssessments()` produces current-state findings. The context compiler
uses explicit deadline-source precedence, retains conflicting equal-precedence
candidates, separates requirements from evidence absence, preserves F5/F7
provenance, and never performs I/O or calls AI. Focused source-adapter,
context-compiler, and Assess tests pass 43/43; strict TypeScript passes; ESLint
has 0 errors and one unrelated manual-payment test warning. The normal
TypeScript command still reports only the stale generated `.next` validator
for the removed `/ai-strategy/report` page.

Working tree 2026-08-20: Core 2 Decide is now deterministic end to end through
`getApplicationDecisions(supabase, applicationId, userId)`, which composes the
existing Core 1 runtime exactly once and passes its unchanged assessments to
`compileDecisions(AssessmentResult[]) -> DecisionResult[]`. It
uses Core 1's explicit decision semantics rather than severity or prose to
distinguish confirmed hard blockers, unresolved critical information, soft
signals, and stored user constraints. It can mark the current application as
blocked, needing information, or available-with-no-known-hard-blocker; it
retains multiple soft attention directions as `needs_user_choice`, never
auto-selecting one. F5 reasons retain AI provenance. This is pure/read-only
and does not add AI, Planner writes, UI, or Core 3 Phase -> Step -> Micro-step
generation. Focused Core 1/Core 2 runtime tests pass 58/58. Core 2 AI/hybrid
enrichment or UI exposure remain optional future work; Core 4's existing
Planner execution foundation remains separate.

Working tree 2026-08-20: Core 3 Plan is deterministic end to end through
`getApplicationPlan(supabase, applicationId, userId)`, which composes the
single Core 1 source-fetch chain through Core 2 then returns an unchanged,
traceable Phase -> Step -> Micro-step scaffold. The Core 3 -> Core 4 bridge is
now implemented as a separate canonical hierarchy, not a flattening into the
shared legacy `application_recommendations` table: `application_plans` ->
`application_plan_phases` -> `application_plan_steps` ->
`application_plan_micro_steps`. `reconcilePlan()` is pure and matches only
stable deterministic node IDs, inserting/updating/restoring/archive-marking
nodes in deterministic order. It preserves Core 4 micro-step execution state
(`status`, `deadline`, `content_value`, `execution_evidence`) while refreshing
planning-owned title/objective/readiness/order/provenance fields. The scoped
`syncApplicationPlan()` runtime verifies application ownership, compiles once,
and applies only hierarchy-table writes; it never writes legacy recommendations
or invokes AI. Apply `supabase-core3-plan-hierarchy.sql` before using the
runtime. Core 4 now has a read-only canonical boundary:
`getApplicationPlanner()` loads only the hierarchy in bounded set queries and
`buildPlannerReadModel()` returns active Phase -> Step -> Micro-step data,
derived Phase/Step progress, and Calendar/Kanban micro-step projections. It
excludes archived ancestors/descendants, preserves date-only deadlines and
student execution values, and reports non-fatal orphan/duplicate/invalid-status
diagnostics. It never queries or merges `application_recommendations`.
Temporary compatibility is Strategy A: applications without a persisted Core 3
plan receive an empty canonical model while the unchanged current Planner
continues using legacy recommendations. Focused Core 1/Core 2/Core 3/bridge/
read-model tests passed 101/101 before execution integration. Core 4 Execute
is now complete for canonical plans: the Planner route chooses canonical
hierarchy versus legacy recommendations explicitly; List renders responsive
Phase -> Step -> Micro-step groups with collapse, search/filter context, and
derived progress; Calendar and Kanban operate only on Micro-steps. Shared
optimistic state writes status, date-only deadline, and interactive
`content_value` through the canonical Micro-step PATCH endpoint, rolling back
only the changed fields on failure. Canonical task detail is
`/ai-strategy/[applicationId]/planner/tasks/[microStepId]`. Evidence upload
remains legacy-only because its existing relation is recommendation-specific;
stored execution evidence remains visible as a count. No AI, reminder, or
legacy-data write/delete was added. The hierarchy migration must be applied
before canonical Planner reads/writes work against a real database; no live
migration was run. Remaining work is email reminders, optional AI/hybrid
enrichment, and deliberate legacy backfill/retirement. For local demo, a
legacy-only Planner now presents a development-only **Generate canonical plan**
button; it calls a same-origin, authenticated, UUID-validated dev route that is
404 in production, then refreshes into the canonical hierarchy. The focused
Core 1–4 canonical/legacy Planner, content, and execution suite previously
passed 163/163; the new dev bootstrap route passes 3/3 and strict TypeScript
passes. Local auth origin tests pass 2/2: non-production now preserves the
request origin even when `.env.local` contains the production public URL.
Supabase Auth must still allow `http://localhost:3000/auth/callback` as a
Redirect URL for local OAuth or email-confirmation testing. The canonical
Planner's diagnostic and UI literals are now covered by a dedicated static
i18n catalog; `node scripts/check-i18n.mjs --all` reports zero missing keys and
the integration checker passes.

Code snapshot: branch `claude/university-application-flow-0khm6v`, merged
with `main`. Two passes on this branch: the application setup flow redesign
(Review Profile → Activities & Achievements with per-activity reflection and
AI Reflection Cards → Personal Reflection → Review & Confirm) against the
owner's implementation spec, then a follow-up UX/navigation correction pass
(application-return navigation, a dynamic reflection breadcrumb + a separate
"Application setup" stepper, the approved four-category taxonomy, and a
three-level low-effort reflection UX) against the owner's second spec. See
"Last completed work" below for both.

Working tree 2026-08-20 (branch `claude/feature-2-strategy-review-ahahsw`,
PR #216): the four Strategy reports. Detail and the decisions behind them are in
[strategy-reports-spec.md](strategy-reports-spec.md) and
[feature-2-plan.md](feature-2-plan.md).

- **F5 Programme Fit is implemented.** `src/shared/evaluation/f5-programme-fit.ts`
  was interfaces-only (`buildProgrammeFitPlaceholder` returned `not_available`
  for every dimension) and was the one framework with no test file. It now
  scores against the documented weights (academic 25, persona 25, career 20,
  financial 15, readiness 15) via `weightedScore`, so a missing dimension is
  renormalised and disclosed rather than scored zero. Hard eligibility gates run
  before any arithmetic and can only produce `currently_ineligible`; only an
  explicit `not_met` fails, since `unknown` means unchecked. The band is decided
  by the academic dimension alone, tested in both directions.
- **`strong_match` added** between match and safety, thresholds shared through
  `academicBandClassification()`. An academic score of 4 now classifies as
  `strong_match` where it previously fell into `match`.
- **`fitDimensionSchema.score` no longer requires an integer.** Five integers
  could only render as multiples of 20, so the report layout's 75/88/92% were
  unreachable. Percentages convert as `(score - 1) / 4 * 100`.
- **The Matching Report route was pointing at the wrong component.**
  `/ai-strategy/[applicationId]/matching-report` rendered `ProgrammeFitReport`
  (a six-tab view of catalogue facts, no F5 in it), while `MatchingReportView` —
  built on the F5 contract — was exported and rendered by nothing. The route now
  renders the latter, rebuilt as six sections. `ProgrammeFitReport` is retained;
  the older `/strategy/analysis/*` surfaces still reach it.
- **The Strategy Report is five sections**, not six engine-named tabs. Direction
  scores are derived into a key strength and biggest challenge, and the ranking
  now carries the margin to the leader. Academic and experience development
  strategies are named as not generated rather than padded — they need new
  prompt fields.
- **Final Application Check is built** at `/ai-strategy/[applicationId]/final-check`
  and unlocked in the nav. Readiness is computed deterministically from
  component coverage minus outstanding critical findings; the generation schema
  has no field for a score, so a model cannot author one. `not_required` is
  distinguished from `missing`, and a recommender strategy never counts as a
  reviewed letter.
  ⚠️ **`supabase-final-check.sql` has NOT been run.** Until it is, generation
  returns 503 with a named hint and the page renders the live inventory only.
- **Four Personal Canvas bugs fixed.** Modifier chords were treated as canvas
  shortcuts, so Cmd/Ctrl+F toggled focus mode and called `preventDefault()` —
  find-in-page was broken across the whole report. The detail panel moved no
  focus, stranding keyboard and screen-reader users behind a full-screen mobile
  overlay. The keydown effect had no dependency array. `contentEditable` hosts
  were not guarded.
- **No admission probability anywhere.** Both the match score and the readiness
  figure measure alignment/completeness, with disclaimers pinned by tests that
  assert no user-facing string uses chance, odds, likelihood or probability
  wording in either language.

Verification for that work: typecheck, typecheck:strict, lint (one pre-existing
unrelated manual-payment warning), `check-i18n` at 0 missing static keys and 0
missing dynamic catalog entries, full Vitest 2735 passing across 292 files, and
a production build that emits every new route. Local builds need Supabase env
vars present; CI supplies them.

Working tree 2026-08-18: `/universities/matches` now uses deterministic
`university-rec-v1` preference recommendations. The route loads profile inputs,
batch-loads `catalog_programmes`, keeps candidate data availability in
`evidenceCoverage`, separates reasons from warnings, and no longer renders
admission-style tiers or percentages. The audit pass fixed the old global
programme bucket in the comparator, added explicit positive/negative evidence
and confidence-aware `rankingScoreInternal`, keeps
flexible scholarship-dependent budgets outside the numeric budget dimension with
a separate funding preference, and reports unknown source freshness instead of
applying an unverified 365-day threshold. The final surgical pass confirmed that
the live catalogue has no completeness metadata: an absent subject programme is
unknown (never a verified mismatch), study-level evidence is bound to
subject-relevant programmes when a subject is active; a catalogue row at a
different level is unknown rather than proof that the requested programme level
is absent. Subject matching uses phrase boundaries, and affordability uses the
student's maximum annual budget (including cheaper tuition). Each related
programme now carries its own verification label. The 2026-08-19 CI repair
makes `exactOptionalPropertyTypes` explicit in the recommendation loader,
domain output, and fixtures: strict TypeScript passes and focused
recommendation/domain/API/UI tests pass 36/36 after `npm ci`. The aggregate
`verify:pr` gate was not run locally because this checkout has Node 22.15.0
while CI requires Node 24.19.x; CI is the pending confirmation. Full lint,
full Vitest, and production build were not rerun in this pass.

Working tree 2026-08-19: `/universities/matches` presentation V2 now returns
only meaningful, globally ranked recommendations with absolute `top_pick`,
`good_fit`, or `worth_exploring` bands, plus independent admission-selectivity
context. The client starts unfiltered, combines band/selectivity chips with
AND semantics, preserves global rank after filtering, resets a 12-result
window on filter changes, and loads 12 more at a time. A read-only live audit
found 108 universities and 97 populated `accept_rate`/`admission_difficulty`
texts, but many rates are programme-qualified prose and neither field has
per-field provenance or freshness. V2 consequently derives `highly_selective`
(general acceptance rate <=10%), `selective` (>10% and <=35%), and
`lower_selectivity` (>35%) only from a standalone or explicit overall
acceptance rate; missing, ambiguous, programme-specific, conflicting, or
unparseable values remain `not_assessed`. University rankings/prestige and
difficulty prose are not used. The UI labels these as overall university
selectivity and explains that programme competitiveness may differ. A
representative eight-candidate audit across five profiles produced 6-8
meaningful results per profile, with 0-5 top picks, 0-4 good fits, and 0-1
worth-exploring results; thresholds were unchanged. Focused
recommendation/domain/API/UI plus i18n tests pass 50/50; strict TypeScript,
i18n checker, and lint pass (the latter has one unrelated manual-payment
warning). The follow-up breadth guard now uses normalized profile active
dimensions: three are required for `top_pick`, two for `good_fit`, and one for
`worth_exploring`; this changes presentation bands only, not evidence, score,
sort order, or rank. Re-running the same eight-candidate fixture audit with a
country-plus-budget profile added produced rich-profile counts of 4/3/1,
incomplete-catalogue counts of 3/4/1, destination-only 0/0/7,
country-plus-budget 0/6/2, budget-only 0/0/6, and sparse-subject-only 0/0/6
for top/good/worth. Focused recommendation/domain/API/UI plus i18n tests now
pass 55/55. No aggregate gate, full Vitest, or production build was run.

Working tree 2026-08-29: the saved-university subject picker restores VinUni's
typed `vinuni-content.ts` catalogue (4 colleges, 10 programmes). The live
`catalog_programmes` view currently contains only VinUni's BBA row, so using it
as the picker source hid the other programmes; other universities continue to
fall back to `universities.strengths`. The picker presentation also restores the
2026-07-30 navigation and compact subject/paste-link UI while retaining the
current same-origin return path and saved programme URL behavior.

Founder-confirmed manual bank transfer is implemented in the working tree for
mentorship and GlowBal Plus, alongside the existing VNPay Sandbox path and
disabled Stripe choice. The vertical slice includes controlled provider UI,
atomic checkout/claim/status/review routes, owner-scoped status reads,
allowlisted admin + versioned HMAC review capabilities, same-origin claim/
confirm/reject POSTs, a guarded follow-up migration, shared fulfilment, and a
durable Resend outbox with CID QR instructions and bilingual EN/VI templates.
The outbound sender display name is normalized to `GlowBal` even when the
configured address is the bare Resend local-test sender.
The status route reads the student's own review row through ordinary-client
RLS, and claim/idempotency/mentorship pricing paths fail closed. The first
remote manual-migration attempt failed before completion; no real email was
sent.

The first manual-payment SQL Editor run exposed PostgreSQL error `42883` in
the outbox retry function: `make_interval` accepts the named argument `mins`,
not `minutes`. The migration now uses `mins` and has a regression contract test;
the guarded manual-payment migration can be run again from the beginning.
Live local-email testing then exposed a second migration defect: the outbox
lease function declared JSON expressions as `record`, so Postgres wrapped both
payloads under `"?column?"` and every notification failed before reaching
Resend. The migration now leases into `jsonb`; runtime also unwraps the legacy
shape so already-created jobs remain deliverable before the migration is rerun.

Founder notification is now one actionable email per transaction, enqueued only
after the student reports the transfer. Checkout sends instructions only to the
student; unsent legacy `founder_review` jobs are retired. The founder template
now includes name, email, supplied phone, user ID, product, amount, reference,
checkout/claim/review-deadline timestamps, and the authenticated review button.
Local testing found that claim dispatch originally leased only one arbitrary due
job. A failing student instruction could consume that slot and leave the new
founder email untouched at `attempts = 0`. Claim now dispatches a batch of ten,
and the SQL lease orders `founder_claimed` first. The newest affected founder
job was retried once and verified `sent` with a provider message ID.
The manual-payment status surface now has all 24 new EN→VI dictionary entries;
the production i18n checker reports zero missing static keys and zero placeholder
mismatches instead of failing CI on that route.
Transactional payment-email links now use the server-only
`MANUAL_PAYMENT_EMAIL_SITE_URL` and fall back to the canonical production origin
`https://glowbal-education.com`; localhost, non-HTTPS, credential-bearing, and
malformed overrides cannot leak into founder or student emails.

VNPay Sandbox checkout is implemented in the working tree for mentorship and
GlowBal Plus. Stripe remains visible but disabled as a demo/"Coming soon"
choice, and its existing backend is unchanged. VNPay uses server-derived VND
amounts, HMAC-SHA512 signing, a read-only Return page, and an IPN-driven,
idempotent fulfilment function. The database function also protects exact
mentor-slot ownership, handles checkout expiry and late successful callbacks,
enforces Plus expiry, and revokes security-definer RPC access from browser
roles.

CV Builder F7 integration work is in progress in the working tree: the builder
now consumes an owner-scoped, versioned Personalized Strategy snapshot, binds
Target Profile and generation requests to its recommendation id, and preserves
form/template drafts while clearing stale AI output.

This is the primary status file after the routing index in `docs/README.md`. It
records the present state of the repository, the last completed work, its
impact, the verification state, and the next risks. Detailed design history
remains in the other files in this directory. If this file conflicts with the
code, the code wins.

## Repository state

- Stack: Next.js `16.3.1`, React `19.2.4`, TypeScript 5, Supabase/Postgres,
  OpenAI and DeepSeek-backed AI paths, Vitest, and Playwright.
- Local development and CI now use Node `24.19.0` LTS. This aligns the runtime
  with the existing `--use-system-ca` development/startup scripts, which Node
  20.20.2 could not parse.
- **My Portal university-logo identity is repaired in production.** On
  2026-08-14 all 37 active `course_applications` were verified linked through
  `university_id`, and all 37 links resolve to a university with a `logo_url`.
  The eight legacy NULL links were reconciled: six matched existing directory
  rows and two identity rows were created (University of Birmingham `108`,
  Harvard Business School `109`). Their logos are persisted in the existing
  `university-images` Supabase Storage bucket. Directory-wide logo coverage is
  107/108; University of Alberta (`36`) is the only remaining missing logo and
  no active application depends on it. The daily imagery cron now limits the
  resolver to 20 seconds, downloads at most four logos concurrently with a
  six-second per-host cap, stops starting work after 45 seconds, and leaves ten
  seconds of its 60-second function duration for in-flight completion. Failed
  attempts are timestamped and retried oldest-first so one bad host cannot
  permanently starve later universities.
- Two pre-existing untracked documents must be preserved: `TECH_SOLUTION.md`
  and `docs/audit-2026-08-03.md`. They are owner/session work, not generated
  build output.
- **The long-running migration question is closed.** The owner pasted the
  full live production schema on 2026-08-12; `application_match_analyses`,
  `student_personal_reports`, `application_strategy_recommendations`, and
  `application_recommendations`'s genUI columns are all confirmed present.
  §0d/§0e/§0f in `docs/known-issues.md` are marked resolved. This was also
  independently confirmed by a real production error trace on
  `POST /api/applications/[id]/match-insights` that matched §0e's predicted
  failure mode exactly, before the fix.
- All twelve Candidate Information questions are rebuilt and merged (PR #172,
  specs 1–3): 1–4 (education/nationality/scores), 5–8 (subjects, countries,
  study level, intake), and 9–12 (aspirations, per-subject motivation,
  funding, tuition budget). Step 2 (achievements/activities) is now also
  rebuilt as an upload-first card grid, and a **Review & Confirm checkpoint**
  now sits after it, locking candidate information before report generation —
  see the latest row below. **Five migrations are still outstanding** and
  every PATCH/read path degrades gracefully without them:
  `supabase-reflection-questions.sql` (from #171 — `study_motivation`,
  `target_intake`), `supabase-reflection-subject-motivations.sql` (from spec
  3 — `subject_motivations`, a JSONB map keyed by subject id),
  `supabase-reflection-review-status.sql` (from the achievements rebuild —
  `review_status`/`source_type`/`sources` on `student_achievements` and
  `student_activities`), `supabase-candidate-confirmation.sql`
  (`confirmed_candidate_snapshots` plus `student_profiles.confirmed_at`), and
  **`supabase-per-application-onboarding.sql`** (new this pass —
  `personal_summary_reviewed_at`/`achievements_reviewed_at`/
  `candidate_confirmed_at` on `course_applications`, plus `application_id` on
  `confirmed_candidate_snapshots`). Until the fourth one runs, the confirm
  route saves the snapshot but cannot lock the profile (logged, not fatal —
  see the migration's own comments), and the PATCH lock check fails open
  (reads as "not locked"). **The owner HAS run
  `supabase-candidate-confirmation.sql` in production**, but the original
  version of that file was missing an `INSERT` RLS policy on
  `confirmed_candidate_snapshots` — confirming failed for a real student
  with a `503` that misleadingly suggested the migration itself hadn't run.
  Fixed in an earlier pass (§5n in `known-issues.md`); **re-run the updated
  `supabase-candidate-confirmation.sql` in production** — it's idempotent —
  to pick up the new policy, or run just the `CREATE POLICY
  confirmed_candidate_snapshots_insert_own` block from it directly.
  **`supabase-per-application-onboarding.sql` has been confirmed run in
  production by the owner (2026-08-14)** — the three new
  `course_applications` columns exist and are being written; do not re-flag
  this migration as outstanding.
  **Action required in production, new this pass:
  `supabase-application-cascade-repair.sql`** — deleting an application
  currently leaves its reports/tasks/recommendations/CV+statement work
  orphaned in the database (reported live 2026-08-14). Every
  `supabase-*.sql` file already declares `ON DELETE CASCADE` on these
  tables, but production may still be enforcing whatever delete rule a table
  had on the day it was first created (`CREATE TABLE IF NOT EXISTS` does not
  retroactively fix a live constraint — the same trap as §0 in
  `known-issues.md`). This migration finds each table's actual FK constraint
  and repairs it to `CASCADE`, and deletes any row already orphaned by the
  drift, before the constraint is re-added. Safe to run repeatedly; not yet
  confirmed run. See `known-issues.md` §5r.
  **Action required in production, new this pass:
  `supabase-personal-report-supplements.sql`** — a new, deliberately separate
  table (`personal_report_supplements`) letting a student answer a Personal
  Report follow-up question inline without touching or reopening the locked
  `student_profiles` confirmation snapshot. Until it runs, the new
  `POST /api/ai-strategy/personal-report/supplement` route degrades to a
  `503` (tolerant-select/migration-missing pattern, same as every other
  optional migration here) rather than 500ing; report generation itself is
  unaffected either way. See `known-issues.md` §5s.
  **Action required in production, new this pass:
  `supabase-personal-report-versions.sql`** — replaces the one-row-per-
  student `student_personal_reports` model with an append-only
  `student_personal_report_versions` table (every generation is its own
  row, never upserted) plus an idempotent backfill of each student's
  existing latest report as their first version. Until it runs,
  `getLatestPersonalReportV2` degrades to `migrationMissing: true` and the
  report page shows its not-enabled state. `student_personal_reports`
  itself is no longer written to by any code path — safe to leave in place,
  not yet dropped. See `known-issues.md` §5t.
  **Action required in production, new this pass:
  `supabase-application-experience-flow.sql`** — adds `reflection`/
  `reflection_card`/`reflection_card_status`/`reflection_updated_at`/
  `reflection_card_generated_at` to both `student_achievements` and
  `student_activities`, `personal_reflection_answers`/
  `personal_reflection_completed_at` to `student_profiles`, and
  `personal_reflection_reviewed_at` to `course_applications`. Every reader
  degrades gracefully until it runs (tolerant-select-without-the-new-
  columns retry, same pattern as every migration above) — activities and
  reports simply render without reflection content, nothing 500s. See the
  "Last completed work" row above for the full feature this unlocks.

## Last completed work

| Commit | Completed work | User and system impact |
|---|---|---|
| `working tree` (Planner deadline entry) | **Fixed the Planner deadline field making the year impossible to type.** Reported by the owner with a row saved as `03/03/0002`. A native `<input type="date">` publishes a value the instant all three segments hold something, so hand-typing the year walked it through `0002-…` → `0020-…` → `0202-…` → `2026-…`, firing a change event each step. `DeadlineControl` treated every one as a committed edit — and the resulting save set `disabled` on the input, which **removes focus**, so the remaining three digits went nowhere and year 2 was what got PATCHed. The old `^d{4}-d{2}-d{2}$` regex on both `recommendationPatchSchema` and `plannerMicroStepExecutionPatchSchema` accepted it. Now: a shared `isPlannerDeadline` (real calendar day, `DEADLINE_MIN` 2000-01-01 … `DEADLINE_MAX` 2100-12-31) gates both the control and both schemas; the control never disables itself (save ordering is kept by chaining onto any save still open instead) and holds an editing draft so a re-render cannot reset the segment being typed; `min`/`max` mirror the window into the native picker; an inline "Enter a four-digit year to save this deadline." hint means a half-typed year no longer fails silently. Both planner surfaces share the control, so the list, the calendar tray and the micro-step detail page are all covered. **Save ordering moved to `usePlannerRecommendations`** (Codex review): the control briefly queued saves itself, which deferred the *optimistic update* along with the request and left the queued callback resolving its rollback against a stale render snapshot — a failure could then roll the row back past a value the server had already accepted. The hook now reads the array from a `latest` ref updated synchronously by `applyLocally` (correct rollback base), serializes only the PATCH behind any request still open (correct Postgres ordering, immediate optimism), and drops a rollback whose edit has since been superseded (`editSeq`, keyed per `id:field` so a status edit cannot cancel a deadline edit). 334/334 ai-strategy-dashboard tests, both TypeScript checks, ESLint (0 errors), the static i18n audit (0 missing keys) and the production build pass. Pre-existing unrelated failures: `src/lib/payments/vnpay-migration.test.ts` (fails on a clean tree too) and three 5s-timeout flakes under full-suite load (`cv/review`, `cv/target-profile`, `StatementWriter`) that pass in isolation. | A student can type a deadline by hand again. Deadlines outside 2000–2100 can no longer be written by any path. **Rows already saved with a bogus year are not cleaned up by this change** — the Supabase project was paused, so no audit query was run; `application_recommendations.deadline` outside the window needs a one-off sweep once it is live. |
| `working tree` (scholarship drawer on the tracker) | **Made the chosen scholarships visible on the application they were chosen for.** Reported by the owner 18/08: an application row means "I saved this university, picked its scholarships and pressed Plan my application", but the row named none of them — the only place the choice showed was the saved list further down, i.e. the step before. New `src/app/apply/application-scholarships.tsx`: a rose drawer under each row, open by default when something is chosen, each award a coupon-style ticket (value on a dashed stub, scope, name trimmed of the university by `scholarshipLabel`, deadline, official-page link, Remove), with a header carrying the count and the best stated coverage percentage, and a multi-select picker dialog. Modelled on the gift/voucher block an e-commerce cart nests under a line item, per the owner's reference. Writes go straight to `user_scholarships` with the student's own session (RLS is `auth.uid() = user_id` for all verbs), the same way the saved list's existing attach/remove already work, followed by `router.refresh()` so the saved list's badges and net-tuition figures are re-read rather than guessed. Server side, `fetchApplicationScholarships` in `apply/page.tsx` adds two reads for the whole list — the `user_scholarships → scholarships` join, and `byUniversityIds` for what the picker offers. ⚠️ **Keyed by university, not application**: `user_scholarships` has no `application_id` and none was invented, so two applications at one university show the same awards and a change here also changes the saved list; the picker says so. ⚠️ **The two sets overlap but neither contains the other** — measured live 18/08, 39 of 84 saved awards point at a scholarship that is not linked to the university it was saved under, so `chosen` cannot be derived by filtering the directory's options and the drawer unions them instead. `/dev/saved-list` now renders one preview application so the drawer is reviewable without an account. **Two review findings fixed on top:** (1) `SavedListSection` seeded its local `rows` from props ONCE and never reconciled — a pre-existing bug the drawer made reachable a new way, since `router.refresh()` preserves client state, so the saved list below kept showing the old badges and net tuition after any change (including its own "Apply scholarship"); it now re-seeds when the prop identity changes, guarded by a regression test that was confirmed to fail without the fix. (2) A tick and an untick in one Save are two statements with no transaction available from the browser: the delete no longer runs if the upsert failed (a failed swap used to take the old award away and put nothing in its place), and the drawer is set to what actually landed rather than rolled back wholesale, with the dialog staying open and showing the error so the student can retry from their own ticks. | A student sees, on the application itself, which funding they are applying with — and can add or drop an award without scrolling to the saved list and re-ticking a university. No migration: `user_scholarships` already carries `university_id` (`supabase-saved-scholarships.sql`). 13 new EN→VI dictionary entries, required because `/apply` is a PII route with machine translation switched off. Measured: base TypeScript clean apart from one pre-existing stale `.next/types/validator.ts` reference to a deleted route, ESLint 0 findings on the changed files, 4 new component tests passing, and the drawer/picker/mobile reflow verified in a browser against live directory data. |
| `working tree` (contact-details gate) | **Made name / phone / date of birth mandatory on every sign-up path.** Measured cause first: of 409 accounts, 333 came through Google and **none** of them had a phone or a date of birth, because Google's consent screen returns only name/email/picture and no OAuth provider will render our fields. The email path was fine (62/73) — its 13 gaps all predate 2026-06-20, when the fields were added to the form. New: `src/features/auth/domain/contact-details.ts` (pure predicate + validation, 12 unit tests) and `/auth/complete-profile`, a three-field screen with **no skip control** (owner's call, hard gate). `src/proxy.ts` holds any signed-in student missing phone or DOB there before the onboarding gate, sharing one profile read with it; `/auth/callback` sends them there at sign-in. `/universities` and `/advisors` stay ungated so browsing never hits the wall. Also closed the email hole: `/api/auth/signup` had `full_name`/`phone`/`date_of_birth` as Zod `.optional()` defaulting to `''`, so HTML `required` was the only enforcement and a direct POST created blank-field accounts. Phone is now normalised to E.164 (VN `0…` → `+84…`) and written straight to `student_profiles` rather than via the lossy auth-metadata copy in the callback — the path that turned 63 metadata phones into 16 profile ones. ⚠️ **`''` is the missing value here, not NULL**: 19 rows are NOT NULL, 16 hold a number. ⚠️ The E2E account (`E2E_EMAIL`) now needs phone + DOB or `signed-in.spec.ts` fails on its first assertion. **Four review findings fixed on top:** (1) `PROTECTED_ROUTES` is not the set of authenticated routes — `/ai-strategy/*`, `/scholarships` and `/universities/matches` each call `getUser()` inside their own server component, so a gate built from that list alone left them reachable by URL; they are now named explicitly in `CONTACT_GATED`, while payment returns (`/plus/success`, `/payment/*`) are deliberately excluded so a paid-for confirmation is never bounced into a form. (2) The form now carries `method="post"` — a submit that beats hydration fell back to a native GET, putting name/phone/DOB in the URL, history and access logs. (3) `?next=` accepted `//attacker.example`, which begins with `/` but is protocol-relative and leaves the origin — `safeInternalPath` now requires a real same-origin path. (4) `Date.parse` normalises impossible dates (`2002-02-30` → 2 March) rather than rejecting them, so a direct API POST reached Postgres and 500'd; `isRealCalendarDate` round-trips the components instead. |
| `working tree` (branch `claude/university-application-flow-0khm6v`, Strategy Hub + Plus paywall) | **Rebuilt `/ai-strategy` as the "Strategy Hub"** — the animated landing page every "Strategy Master" nav click (`STRATEGY_ACTION` in `nav-items.tsx`, unchanged href) and every "Go to My Portal" CTA now lands on, replacing the old Stage-3 explainer. Built from an owner-supplied combined HTML/CSS/JS prototype (`GlowBal Strategy Hub — Combined Demo`) under `src/features/marketing/ui/strategy-hub/`: a hero reusing the homepage's existing `HeroGlobe` canvas animation (not the prototype's static globe image) with a single real CTA into `/apply` (the prototype's two-path "choose existing / start new" chooser modal collapsed to one, since `/apply` is already the unified entry point — see its own `page.tsx` comment), a click-to-play animated tour section (explicitly framed as an illustrative animation, not a real recording — no fabricated product-tour claims), and a 3-card interactive Reports Hub (Personal → the real `/ai-strategy/personal-report`, Matching/Strategy → `/apply`, since both are application-scoped) plus a 4th "Evaluation Report" card shown disabled/"Coming soon" since that feature does not exist yet. Deliberately ships no fabricated testimonials (the prototype's are explicitly placeholder-labelled) per the project's standing rule against them. Sound: real synthesized Web Audio effects (`use-strategy-hub-sound.ts`, oscillator+gain envelopes, no audio files, ported from the prototype's design), defaulting **on** per explicit owner instruction. Animations (`@keyframes` block in `strategy-hub.tsx`, same one-off pattern as `match-badge.tsx`) all pair `motion-safe:animate-[...]` with a `motion-reduce:` fallback. **Landed the GlowBal Plus paywall the previous `/ai-strategy/page.tsx` comment had been describing as not-yet-built since 01/08**: `/ai-strategy/[applicationId]/layout.tsx` now reads `plus_status`/`plus_expires_at`/`is_admin` alongside its existing ownership check and redirects a non-entitled student to `/plus?application=<id>` (a return-aware redirect target the `/plus` page already supported but nothing called) — this gates the whole per-application AI Strategy workspace (matching-report, planner, strategy-report, statement, cv/*) in one place, while the user-level Personal Report and reflections stay free, matching the owner's "paywall goes on the Strategy, after the application stage" instruction. Per explicit owner direction, this is a hard gate on ALL non-admin users (no grandfathering) — every student without an active Plus entitlement is redirected the first time they try to continue an application. Added an admin-side manual override alongside it: `/admin/users` (`admin-users-client.tsx` + `api/admin/users/route.ts`) gained a "Grant Plus"/"Revoke Plus" toggle mirroring the existing is_admin pattern (12-month grant, `plus_plan: 'admin-grant'`, best-effort audit row in `plus_subscriptions`), additive to — not a replacement for — the existing VNPay/manual-bank-transfer checkout paths and the existing `/admin/bookings` manual-payment-claim approval flow. New `src/lib/i18n-strategy-hub.ts` catalog (~65 EN/VI pairs), merged into `i18n-catalog.ts`. Full 282-file/2534-test suite, both TypeScript checks, ESLint (0 errors), the static i18n audit (0 missing keys), and the Next.js production build all pass. Browser verification not done this pass — no connected browser instance. | A student who clicks "Strategy Master" now sees a real animated hub instead of a static explainer, with working links into My Portal and the real Personal Report. A student without GlowBal Plus can still browse My Portal and open an application, but hits `/plus` the moment they try to continue into that application's actual AI Strategy workspace — no free access to Matching/Strategy reports or the planner for a specific course anymore. An admin can grant or revoke that access directly from a user search, independent of the payment flow. **No new migration required**: `plus_status`/`plus_expires_at`/`plus_plan` already existed on `student_profiles` (`supabase-plus.sql`). |
| Working tree 2026-08-15 (CI i18n follow-up) | Added the missing Vietnamese dictionary entry for the Plus-gated strategy narrative copy reported by CI. | The targeted `check-i18n.integration.test.ts` passes. The full `verify:pr` gate was not runnable in this checkout because it has Node 22.15.0 while CI requires Node 24.19.0; GitHub Actions run #396 identified this missing key as the only failing test. |
| Working tree 2026-08-15 (branch CI repair, reconciled with `main`) | Fixed the Vercel build failure on `fix/feedback-log`: the earlier `main` merge (`63304e1`) resolved the import conflict in `src/app/profile/preferences/preferences-form.tsx` by keeping BOTH sides’ lines, so `SaveBar`/`SelectOptions`/`TagInput` were each declared twice and Turbopack failed with a parse error — collapsed to one import carrying `IntakeFields` from this branch and `returnAfterSave` from `main`. This branch had independently made the same legal-page repair `main` shipped as `b37e206` (typographic quotes on `/terms`, a route-scoped Vietnamese-source exemption in `scripts/check-i18n.mjs`); on merging, `main`’s implementation was taken verbatim and this branch’s duplicate dropped, so the script is byte-identical to `main`. What was kept from this branch is the regression test in `check-i18n.integration.test.ts` asserting `authoritativeVietnameseRoutes` is exactly `/privacy` and `/terms`. | The deploy unblocks, and the two independent legal-page fixes are reconciled to one implementation rather than left as near-duplicates. The kept test matters because `actionable VI-only source: 0` is satisfiable either by writing English source or by exempting the route — widening the exemption to a product screen would silence the check for all of it, so that now fails a test rather than passing quietly. ⚠️ For Windows contributors: `src/lib/payments/vnpay-migration.test.ts` fails LOCALLY on a CRLF checkout and only there — it asserts source-text ordering with an `\n`-joined needle, git stores the route file with LF (`core.autocrlf=true` converts it on checkout), and it passes on CI. Do not "fix" the payments route to satisfy it. Measured on the merged tree, Node 24.19.x: both TypeScript checks clean, ESLint 0 findings, 276 test files (2,508 passed / 2 todo — the CRLF artefact above is the only local red), `node scripts/check-i18n.mjs --all` at 0 missing keys and 0 actionable Vietnamese-only source, and the Next.js 16.3.1 production build generating 129/129 static pages. |
| Working tree 2026-08-15 (legal-page deploy repair) | Replaced raw JSX quote characters on `/terms` with typographic Vietnamese quotes and taught the production i18n audit that `/privacy` and `/terms` are intentionally maintained as authoritative Vietnamese legal documents. The exemption is route-specific; their copy remains visible as protected Vietnamese source in the audit report, while every other public route retains the existing bidirectional enforcement. | The complete Node 24.19.0 `npm run verify:pr` gate passes: base and strict TypeScript, ESLint, 274 test files with 2,470 passing tests / 2 todo, coverage, and the Next.js 16.3.1 production build. The three existing `geo-content.ts` Turbopack filesystem-tracing warnings and placeholder-Supabase fetch logs remain non-fatal. |
| Working tree 2026-08-15 (Plus promo redemption) | Added a promo-code field to the existing Plus payment dialog and a same-origin, authenticated `POST /api/plus/redeem` path. The active `gogogogoglowbal` v2 campaign is checked only on the server, then a service-role-only `redeem_plus_promo` RPC atomically records one redemption per user/campaign, extends the selected Plus plan, grants that plan's canonical AI credits, and writes the subscription audit row. The v2 rotation gives every account a fresh one-use campaign without deleting v1 audit rows or real payment transactions. | A signed-in user can select Monthly, Yearly, or Premium and redeem the campaign without entering the payment flow. Promo subscriptions are labelled `100% off` and have no `payment_transactions` row, so they contribute 0₫ to the admin revenue total. Replays and concurrent duplicate requests cannot add duration or credits twice. Focused UI/API/migration tests pass 11/11. **Action required: apply `supabase-plus-promo-redemption.sql`, then `supabase-plus-promo-v2.sql`, in production before v2 can grant Plus.** |
| Working tree 2026-08-15 (target intake month picker) | Replaced the free-text `Target intake` box on /profile/goals and /profile/preferences with a month/year calendar popover (`src/shared/ui/month-picker.tsx`, no Figma source — the redesign draws no date control) and turned `Application cycle year` into a generated year list. Both editors now share one `IntakeFields` block in `src/app/profile/_form-parts.tsx`. `student_profiles.target_intake` gains a third written shape, the canonical `YYYY-MM` token from `src/shared/lib/month-value.ts`; `parseIntake` reads it by rounding to the nearest season, and the new `intakeDisplayLabel` is what /profile and the reflection review print instead of the raw column. | Students pick an intake instead of typing one, and cannot store a month that has already passed. A stored answer the picker cannot draw (`undecided`, a season token) is shown on the control and preserved until a month is picked, so saving no longer risks erasing it. Fixes /profile and /ai-strategy/reflection printing raw tokens ("autumn-2027") as a student’s target intake. Measured on Node 24.19.x: both TypeScript checks clean, ESLint 0 findings, `npm test` 269/270 files passing (2,455 passed, 2 todo) with the one failure — `src/lib/payments/vnpay-migration.test.ts` — since traced to a Windows CRLF checkout and not a real failure (see the row above), `node scripts/check-i18n.mjs --all` reporting 0 missing keys, and `npm run build` succeeding. |
| Working tree 2026-08-15 (manual Plus fulfilment repair) | Root-caused founder-confirmed manual Plus payments that landed in `paid_unfulfilled`: the database function wrapped entitlement/subscription writes and the `student_confirmed` outbox insert in one exception block, then suppressed the SQL error while the review still became `confirmed`. Added `supabase-manual-payment-fulfillment-repair.sql`, which isolates notification failure, records bounded diagnostics, makes failed activation visible as HTTP 409, and idempotently reconciles founder-confirmed Plus payments. The owner applied it; production readback then identified the remaining exact error as PostgreSQL `42P10`: the explicit subscription `ON CONFLICT` target could not infer a partial unique index. Added the append-only `supabase-manual-payment-subscription-conflict-repair.sql` follow-up to replace that index with a full unique index and retry guarded reconciliation. Per owner decision, Plus confirmation has no review deadline; mentorship retains slot/hold safety. | Founder confirmation grants Plus even when reviewed late, and an email-job failure cannot roll back product activation. The follow-up migration preserves idempotency while making the existing explicit conflict target valid. Production remains unfulfilled until that second migration is applied. **Action required: apply `supabase-manual-payment-subscription-conflict-repair.sql` in production; the first repair migration is confirmed applied.** |
| Working tree 2026-08-15 (Vercel ESLint and Plus gating repair) | Cleared all 38 ESLint findings from the failed deployment (9 errors and 29 warnings), moved the admin bookings service-role reads behind a server-only boundary, exposed the Plus hook through its feature API, removed the synchronous effect state update, replaced raw strategy-report colour literals with design tokens, and retained client-side navigation semantics. The static i18n dictionary now covers the three newly detected Plus strings. | The Vercel CI gate is clean and the Plus blur/upgrade state used by Saved, Scholarships, and Strategy remains derived consistently from the supplied entitlement or fetched status. `npm run verify:pr` passes on Node 24.19.0: both TypeScript checks, full ESLint with 0 findings, 268 test files with 2,426 passing tests / 2 todo, coverage, and the Next.js 16.3.1 production build. Build output still contains three pre-existing Turbopack filesystem-tracing warnings in `geo-content.ts`; they do not fail the build. |
| Working tree 2026-08-15 (Home roster redesign) | Rebuilt Home's "The team behind your journey." section (`src/features/marketing/ui/home-team.tsx`) from the flat Figma 903:10609 grid into a staggered card deck, and corrected the roster against the owner's member sheet. Five display names now match the sheet: `Khánh Linh`→`Nguyễn Khánh Linh`, `Hoàng Linh`→`Nguyễn Hoàng Linh`, `Lil Chi`→`Phạm Quỳnh Chi`, `Huấn Rose`→`Nguyễn Huấn`, `Hương`→`Hương Phùng`, `James`→`James Lapslie`. Each card gained two sheet-sourced facts the Figma grid had no slot for: the university's own crest (new `university-crests.ts` + `public/universities/`, four files) and the programme line, plus — for the three members whose sheet row records one — a brand-coloured scholarship strip. The five members with an empty scholarship column get no strip rather than a substitute. Layout: 4:5 portraits, `items-start` so cards hug their content, columns 2 and 4 offset 64px via `mt` (not `translate`, which would overhang the section's padding), and hover/focus enrichment (lift, desaturation release, portrait zoom, rule draw) done entirely in CSS — the section ships no JavaScript and hides nothing behind hover. An initial pass also added a counted `3/8 of us study on a scholarship` badge above the grid and an editorial `01`–`08` counter on each portrait; both were dropped on the owner's follow-up request as filler once the crest/programme/scholarship facts were already doing the section's work. Crest provenance and the nominative-use warning are recorded in `university-crests.ts`. | Home now shows evidence for the claim its own intro paragraph makes: per-member scholarships, programmes and university crests, without a redundant summary stat or card numbering. Verified in the running app at 390/768/1440px on `/` with real Supabase portraits and on `/dev/home` with the initials fallback; all four crests resolve (3× VinUniversity, 3× HUST, 1× Foreign Trade University, 1× University of Birmingham) and hover was captured working, both before and after the badge/counter removal. Strict TypeScript, targeted ESLint, the static i18n audit (0 missing keys), and 41 focused Vitest tests across 7 files pass. E2E `home-preview.spec.ts` team assertions were updated to the new names and now also assert crest counts, but were not rerun. Base typecheck and the production build remain blocked outside this change by the absent `@mdxeditor/editor` dependency, as recorded in the rows below. |
| Working tree 2026-08-15 (approved US programme CSV import) | Added and ran the default-dry-run importer for the owner-supplied `us_uni_program.csv` (200 rows, 10 universities, 73 columns) after explicit approval of run key `manual-us-programs-afd656d40bb5ce85`. It resolves aliases onto the same lowest-id university identities the product uses, validates programme domains, maps degree levels, preserves every raw field in staging provenance, groups choices by school/college, and prevents an existing `(university, programme, degree)` identity from being promoted twice. Shared source URLs receive deterministic fragments rather than collapsing distinct programmes. The write path still requires both `--apply` and the exact dry-run `--confirm-run-key`. | **Production import completed.** Run `60aa495f-a95b-4045-b5b7-5c2a94affbde` is `completed`: staging contains 10 institutions, 108 units, 200 programmes (189 `NEEDS_REVIEW`, 11 duplicate `REJECTED`) and 189 programme-unit relations. Promotion inserted 189 programmes plus 108 academic units and 189 relations, with 0 existing-course updates/re-homes, 0 field values, and 0 university-profile writes. Independent readback found 189 unique catalogue IDs and 189 unique effective URLs on the expected ten product university IDs; each staging payload retains all 73 source columns. Admissions/cost/outcomes text remains staging-only because the CSV lacks per-field source/cycle provenance. Focused Vitest passed 10/10, syntax check and targeted ESLint passed. Base typecheck remains blocked outside this work because the declared `@mdxeditor/editor` dependency is absent from current `node_modules` (plus its downstream implicit-`any` error). |
| `working tree` (branch `claude/university-application-flow-0khm6v`) | **Redesigned the application setup flow per the owner's spec** so it stops re-asking factual profile questions onboarding already collected and adds real activity-level and cross-cutting reflection. `/ai-strategy/reflection` (step 1) no longer renders the twelve-question `ReflectionAboutForm` — it renders a new read-only `ProfileReviewView` (`profile-review-view.tsx`) built from a new `loadProfileReview` reader (`features/apply/api/profile-review.ts`, canonical `student_profiles` + `english_test_scores` + `standardized_test_scores`), with per-section Edit links out to the existing `/profile/academic`, `/profile/english`, `/profile/preferences` editors (never a second copy of the same form) and one "Yes, this information is correct" CTA. Fixed the exact `study_level` vocabulary bug the spec names by example (onboarding writes `undergraduate`/`postgraduate`/`phd`, the old reflection form wrote `INTENDED_LEVELS` display strings into the same column, and a student who only did onboarding read back `intendedLevel: undefined` — blocking Review & Confirm on an already-answered question) via a new canonical `study-level.ts` module both flows now read through. Achievements/activities (`reflection/achievements`) gained "Reflect on this experience": a new `ActivityReflectionModal` walks Context→Motivation→Challenge→Action→Impact→Transformation→Future one dimension at a time, with category-adapted question wording (`activity-reflection.ts`'s `experienceCategoryFor`/`reflectionQuestion`, mapping the existing achievement/activity category enums onto the spec's seven experience categories) and a hidden-by-default "Need inspiration?" scaffold. Finishing a reflection persists the raw answers first, then calls new stateless `POST /api/reflection/reflection-card` (`src/lib/ai/reflection-card-generation.ts`, grounded system prompt: no invented numbers/roles/outcomes/skills, 3-5 evidence-linked skills) to build a Story/My Contribution/Evidence/Demonstrated Skills/Key Takeaway/Future Connection card (`ReflectionCardView`, with loading/error/edit/regenerate/confirm states); the raw reflection and the generated card are separate fields (`reflection`/`reflectionCard` on both `student_achievements` and `student_activities`, extended via `supabase-application-experience-flow.sql`) and the card never overwrites the raw answers. New Step 3 `/ai-strategy/reflection/personal` (`PersonalReflectionForm`) asks the five fixed cross-cutting questions from the spec, one per screen, saved via new `PATCH /api/reflection/personal` into `student_profiles.personal_reflection_answers` (global, reusable across applications, mirroring how activities already work) — deliberately kept a separate, simpler flow from activity reflection. `OnboardingState`/`OnboardingStep` (`features/ai-strategy-dashboard/domain/onboarding.ts`) gained a `personal-reflection` step between achievements and confirm, backed by a new per-application `course_applications.personal_reflection_reviewed_at` column, with the same tolerant-select fallback pattern every other per-application flag already uses. Review & Confirm gained Experiences (activity + confirmed-Reflection-Card counts) and Personal Reflection (questions-completed) sections. **No new snapshot table**: `confirmed_candidate_snapshots.payload` (existing JSONB) automatically carries the new reflection/reflectionCard/personalReflection fields the moment they were added to `ReflectionValues` in `reflection.ts` — reused, not replaced, per the spec's own instruction. `candidate-context.ts` (used by both Personal Report and Matching Report generation) now reads the new columns with the same tolerant-select pattern, and `personal-report-v2.ts`'s CMCAITF/competency extraction pipeline now folds a student's own structured reflection answers (and, once confirmed, their Reflection Card's story/key-takeaway/future-connection) into the free text it already runs extraction over — richer, still-groundable signal instead of the AI guessing the same seven dimensions from a single unstructured paragraph. **Action required in production: run `supabase-application-experience-flow.sql`** — tolerant-select degrades every reader gracefully until it has (new activities/personal reflection simply don't appear; nothing 500s). New/updated tests: `study-level.test.ts` (9), `activity-reflection.test.ts` (13), `personal-reflection.test.ts` (9), `reflection.test.ts` (+5, including the `study_level` vocabulary regression), `reflection/route.test.ts` (+2, the new `profileReviewed` flag), `reflection-card/route.test.ts` (5), `reflection/personal/route.test.ts` (6), `candidate-snapshot-repository.test.ts` (2, new file — reflection-column tolerant fallback), `onboarding.test.ts` and `onboarding-status.test.ts` (updated for the new step), `strategy/page.test.tsx` (+1). Full 2310-test suite, both typechecks, full ESLint (0 errors), and the static i18n audit (0 missing keys after ~90 new EN/VI pairs in new `i18n-application-flow.ts`) all pass. Browser verification not done this pass — no in-app browser instance connected in this session; see the verification snapshot below. | Starting an application no longer launches the old factual questionnaire — a student sees "GlowBal already knows this about me" and reviews/edits it in one page, then builds real per-activity reflections that produce a grounded, editable AI summary, then answers five identity/motivation questions once, then reviews everything (including the new sections) before generating reports. A returning student on a second application still sees their existing profile, activities, and Reflection Cards rather than recreating them. **Follow-up not done this pass** (documented limitation, not silently dropped): application-specific per-application activity *selection/relevance* (the spec's optional "choose which activities apply to this application") was not built — every reviewed activity is included in every application by default; the Personal Report's deterministic evaluation engine (`buildPersonalReport`/`runProfileEvaluation`) was not restructured to explicitly cluster themes from Reflection Cards/personal reflection as first-class inputs beyond the free-text enrichment described above; AI follow-up questions on vague activity answers (spec's "1-2 follow-ups per dimension, skippable") were not implemented. |
| `working tree` 2026-08-15 (branch `claude/university-application-flow-0khm6v`, UX/navigation correction pass) | **Fixed the four issues the owner reported after using the redesigned flow above**: application context lost on every profile edit, a breadcrumb that did not exist, categories that did not match the approved four-bucket framework, and reflection that "looked like homework." Root cause of the navigation loss: `/profile/academic`, `/profile/english`, `/profile/preferences` always linked back to `/profile`, so a student editing a missing field mid-application landed on the generic profile page with no way back to where they were. Fixed with a new `isAllowedInternalReturnPath` guard (`shared/lib/return-path.ts`, rejects protocol-relative/scheme-prefixed values — the existing `?return=` convention had no open-redirect check before this) and `resolveApplicationReturn` (`app/profile/_application-return.ts`), which the three editors now call to render "← {Application}" context, a "Save & return to application" CTA, and a `?updated=` toast on return — normal (non-application) profile editing is unchanged. Root cause of the missing breadcrumb: none had ever been built for the reflection flow, because the existing pathname-based registry (`shared/ui/breadcrumbs.tsx`) can only key off `usePathname()`, and the reflection UI is a modal with internal dimension state, not a route. Fixed with a purpose-built `ReflectionBreadcrumb` (`features/apply/ui/reflection-breadcrumb.tsx`) that reads state lifted out of `ActivityReflectionModal` (`dimensionIndex`/`onDimensionIndexChange` are now parent-controlled) instead of extending the route registry — deep reflection navigation (Application → Experiences → Activity → Dimension, or → Reflection Card) updates live as that state changes, every earlier crumb stays clickable without losing answers, and mobile renders a compact "← {Activity} / {Dimension} X of Y" pattern below `sm`. This coexists with (does not replace) a new, separate "Application setup" stepper — `candidateInformationStepperSteps` (`ai-strategy-dashboard/domain/`) drives a `<Stepper>` on all four reflection pages showing the same ✓/●/○ macro progress the spec asked for. Replaced the seven ad hoc experience categories with the approved four — `community_impact` / `leadership_initiative` / `innovation_projects` / `academic_personal_growth` — in a rewritten `activity-reflection.ts`: `EXPERIENCE_CATEGORY_META` (labels/icons for the 4 cards), `EXPERIENCE_SUBTYPES` (the optional second-step picker, mapping every subtype onto an *existing* achievement/activity table category — no new table, no new column), and `CATEGORY_QUESTIONS` holding the verbatim approved question bank (main question + guidance + optional framework per category × dimension, including the source's intentionally repeated wording — Leadership's and Innovation & Projects' Challenge share one sentence, Community Impact's Motivation repeats Context's guidance — preserved rather than "fixed"). Legacy stored values are unchanged and re-mapped, not migrated: `research` now resolves to Innovation & Projects and `competition` to Academic & Personal Growth via `experienceCategoryFor`. Reduced reflection's perceived effort with three explicit disclosure levels in `ActivityReflectionModal` — always-visible question, guidance behind "💡 Help me think", optional framework nested behind "Need inspiration?" — plus a new `useAutoGrowTextarea` hook (compact initial height, grows with content), a conversational placeholder, first-question-only reassurance copy, a debounced (800ms) autosave indicator, and a "Skip for now" control; `PersonalReflectionForm` got the same autogrow/placeholder treatment. Reopening an in-progress activity now resumes at its exact unfinished dimension via `firstUnansweredDimension`, not always Context, with the breadcrumb restoring correctly. `reflection-evidence-form.tsx`'s achievement/activity grids are now grouped under the four category headings (`groupByExperienceCategory`) instead of one flat list per tab, and card status labels now cover the full spec vocabulary — not started / in progress · N/7 / complete / generating / "Review Reflection Card" / Confirmed — with an already-generated card opened read-only (`viewCard`) instead of back into the dimension editor. Caught one real regression only `npm run build:ci` surfaces (typecheck/lint/test all passed despite it): the new `use-autogrow-textarea.ts` used `useRef`/`useLayoutEffect` without a `'use client'` directive, which compiles and tests fine under Vitest's jsdom but fails a real Next.js Server Component build the moment anything imports it transitively — fixed by adding the directive; worth remembering that `npm run build:ci`, not just typecheck/lint/test, is part of `verify:pr` and CI for exactly this class of bug. Added ~60 new EN/VI dictionary entries to `i18n-application-flow.ts` for this pass's new copy (breadcrumb/stepper labels, status vocabulary, category cards, the full question bank's main questions) — `node scripts/check-i18n.mjs --all` is back to 0 missing keys. New tests: `return-path.test.ts`, `_application-return.test.tsx`, `candidate-information-steps.test.ts`, `reflection-breadcrumb.test.tsx`, and a full rewrite of `activity-reflection.test.ts` for the four-category shape (was still asserting the old seven-category API and a since-removed `reflectionInspiration` export, so `npm run typecheck` failed before this pass touched it). Known limitation: the collapsed Level 2/3 microcopy (guidance bullets, answer-framework sentences) is not yet in the VI dictionary — the static i18n checker does not require it (only `heading`/`label`/`description`-shaped properties are scanned, not `guidance`/`framework`), but full bilingual coverage of that content is follow-up work, not done in this pass. |
| Working tree 2026-08-15 (VNPay Sandbox) | Added a provider-neutral payment ledger/migration, server-only VNPay 2.1.0 signing and verification, authenticated checkout for mentorship and Plus, public checksum-protected IPN processing, a read-only Return page, bilingual payment-method UI, fixed Sandbox FX disclosure for non-VND mentor pricing, slot/booking expiry recovery, late-payment reconciliation, Plus duration enforcement, and focused regression tests. Existing Stripe routes were not modified; Stripe is a disabled demo choice. | Both products can enter VNPay Sandbox checkout without trusting client prices or browser returns. Fulfilment is idempotent and database-atomic; browser roles cannot invoke security-definer payment RPCs. Focused payment Vitest passed 23/23, both TypeScript checks and the production build passed, and full ESLint reported 0 errors. Deployment still requires applying `supabase-vnpay-payments.sql`, private environment configuration, public HTTPS IPN registration, and manual Sandbox SIT. |
| Working tree 2026-08-15 (CI lockfile) | Corrected the lockfile repair after commit `348e26a` still failed CI. Root cause: that lockfile was generated locally with npm 11.6.2, whose optional-dependency layout passed its own `npm ci` check but was rejected by CI's npm 11.17.0 as missing nested `@emnapi/core@1.10.0` / `@emnapi/runtime@1.10.0`. Regenerated `package-lock.json` using npm 11.17.0; `package.json` and runtime dependencies are unchanged. | The exact CI command now passes under npm 11.17.0: `npm ci --dry-run --ignore-scripts --no-audit --no-fund`. CI dependency installation no longer relies on the local npm resolver version. |
| Working tree 2026-08-15 (VinUni Essay Review) | Fixed the production `Cannot read properties of undefined (reading 'filter')` failure in VinUni Essay Review. The application-specific V2 grounded NDJSON pipeline is now selected by code whenever an `applicationId` is present, and the grounded streaming response no longer depends on `VINUNI_GROUNDED_PIPELINE_ENABLED` or `VINUNI_ESSAY_PIPELINE_VERSION` being configured in production. `StatementWriter` also treats a missing `sections` array on an error event as an empty list and preserves the server message instead of masking it with a client-side TypeError. | Production can use the VinUni streaming review with only the existing OpenAI configuration; no new Vercel environment variables are required. Regression coverage includes an env-free V2 response and a malformed stream-error event. Focused Vitest passed 34/34; base and strict TypeScript, targeted ESLint, and the Next.js 16.3.1 production build passed before updating to the latest `main`; the post-update build also passed. Production smoke test is pending deployment. |
| `working tree` | **Redesigned the Personal Report against a formal implementation spec ("GlowBal Personal Report Claude Implementation Spec") the owner supplied with three reference screenshots — chart-rich, "profile at a glance" synopsis, evidence-summary donuts — on top of the existing canonical report, not a parallel one.** Four layers, all additive to `PersonalReportV2` via new OPTIONAL fields (`analytics`, `overview`, `overallSummary`) so a stored report version predating this change still renders, just without the extra charts/synopsis. (1) **Deterministic analytics** (`src/features/apply/domain/personal-report-analytics.ts`) — one pure pass over the same `ProfileEvaluation`/`NarrativeActivity[]` the six sections already read, never a second model call: a 6-axis Competency & Evidence Profile (F2 hard/soft/meta + F3 tangible/intangible/traceability/evidence), F4's 5 base metrics as "Narrative identity signals" (`growthArc`/`evidenceDensity` stay `null` — the underlying engine never scores them, so the chart says "N/A" rather than a fabricated number), Signature Pattern step support counts, Theme maturity (a declared categorical→display encoding, spec-mandated over invented decimals), F4.5 Positioning dimensions (strong=100/limited=25/not_available=null, same reasoning), and an Evidence Summary (verification tier counts, strength counts, competency-claim counts) — all traceable to a real engine value, several unit tests assert exact derivation. (2) **Constrained narrative synthesis** (`src/lib/ai/personal-report-narrative-synthesis.ts`) — the one place an LLM is allowed to touch report prose: given only the already-decided structured findings (never raw free text) plus a closed list of valid evidence IDs, it may rewrite headlines/paragraphs, but any response citing an evidence ID outside that list fails the WHOLE synthesis (no partial acceptance), and any exception falls back to the existing deterministic template copy — wired into `regeneratePersonalReport()` right after `buildPersonalReport()`; `PERSONAL_REPORT_EXTRACTION_VERSION` bumped so every existing cached report regenerates once. (3) **Four SVG chart primitives** (`src/shared/ui/charts/`: `RadarChart`, `HorizontalBarChart`, `DonutChart`, `MetricBar`) — no charting dependency, so print/a11y/determinism stay simple; every chart pairs a decorative (`aria-hidden`) SVG with a visible legend list that IS the accessible copy, and a `null` score never plots as a fabricated zero (a dashed/"N/A" state instead). (4) **View broken into `src/features/apply/ui/personal-report/*` section files** (was one 762-line file) — a new "Profile at a glance" section (synopsis + the two report-wide charts) now sits above Core Identity; Signature Pattern, Emerging Themes, and Personal Positioning each gained their matching chart; Proof of Me gained the three evidence-summary donuts plus the new "What this report suggests overall" paragraph; every chart-augmented section degrades to no-chart (not a crash) when `analytics` is absent on an old version. Also added a lightweight print pass (`print:hidden` on interactive-only chrome, `print:break-inside-avoid` on every section Panel). Full 40-section spec was treated as the complete directive — no follow-up question was needed. New/updated tests: `personal-report-analytics.test.ts` (16), `personal-report-narrative-synthesis.test.ts` (13), 4 new chart-primitive test files (10), `personal-report-generation.test.ts` (extended to mock the new synthesis call), `personal-report-v2-view.test.tsx` (2 new analytics-wiring tests). Full 2264-test suite, both typechecks, full ESLint, and the static i18n audit (0 missing keys after ~40 new EN/VI pairs, including axis labels no prior pass had registered) all pass. Browser verification not done this pass — see the verification snapshot below. | The Personal Report now shows the same "profile at a glance" chart summary, per-section charts, and evidence-summary donuts as the owner-approved redesign screenshots, with report-writing prose optionally polished by a tightly evidence-checked model call — while every number on every chart still traces back to a real F1-F4 engine value (never an invented one), and a student who opens an older version from the history dropdown still sees it render cleanly without the new charts. |
| `working tree` | **Fixed three more entry points into the Personal Report that never carried `?return=`, reported live with a real screenshot right after the previous pass shipped.** §5s fixed the ONE entry point that already had `returnTo` (the nav tab) and made every in-page link correctly forward whatever `returnTo` the page received, but never audited every route that navigates a student TO the page in the first place. Three had `applicationId` sitting right there in scope and never used it: `AnalysisWorkspace`'s `personalHref` (the "View my reports"/"Open report" links right after generation — the most common path in), `confirmedReflectionContinueHref` (the "Continue" button on the read-only Reflections/Achievements/Review & Confirm views once reports exist — very likely the exact path in the reported screenshot), and the legacy `/ai-strategy/[applicationId]/strategy/analysis/portrait` compatibility redirect (it didn't even destructure `params`). All three now build the same `?return=<app>/strategy/analysis` shape every other entry point already used. With `returnTo` populated, the nav band renders again, and — since gap-action buttons already run every href through `withReturn()` — "Add more detail to your existing activities" now correctly lands on the SAME application's own achievements page with its own per-application lock state, instead of silently falling back to the global "has ever confirmed any application" flag and dead-ending on a read-only view. Also investigated the accompanying "report looks shallow" complaint: the evaluation engine's activity-count threshold was satisfied (7 items clears the 3+ floor); what was missing was `role`/`behaviour` text the extraction pipeline can only synthesise from a rich `detail`/`description` field, and short one-line achievement entries genuinely don't carry that — the report is deliberately built to say "insufficient evidence" rather than invent depth, and the now-fixed gap-filling loop is the intended way a student adds it. Not a separate bug; not touched further without a specific product call once the loop is verified working with real added detail. Full incident writeup: `known-issues.md §5u`. New/updated tests: `onboarding.test.ts` (2 new, `confirmedReflectionContinueHref`), `analysis-workspace.test.tsx` (3 assertions updated), new `portrait/page.test.tsx` (1). Full 2223-test suite, both typechecks, targeted ESLint, and i18n check (0 missing keys, no new strings needed) all pass. Browser verification not done this pass — see the verification snapshot below. | A student landing on the Personal Report via the confirm screen's "View my reports," the read-only Reflections/Achievements "Continue" button, or an old bookmarked portrait link now sees the same header nav/breadcrumb as everywhere else in the flow, and "Add more detail" opens an actually-editable achievements page instead of a locked read-only one. |
| Working tree 2026-08-14 (PR #192 review follow-up) | Addressed all three unresolved Codex review threads on the Home scholarship spotlight. `/scholarships` now serializes the valid directory query into `/auth?redirect=...` before redirecting a signed-out visitor, so password login, signup confirmation, and Google OAuth return to the selected scholarship/filter state. The horizontal rail derives `activeIndex` from the native scroll position using the same snap-start coordinate as the arrow controls. Funding enums now use the shared scholarship label map as separately translatable text nodes; funding, deadline, and country fallbacks are no longer inside `data-no-auto-translate`, and the legacy `full_tuition` label has an explicit Vietnamese dictionary entry. | Signed-out Home visitors no longer lose the scholarship they selected, touch/trackpad scrolling keeps the active border, `aria-current`, live announcement, and next/previous actions synchronized, and Vietnamese cards no longer leave generated funding or fallback metadata in English. Two focused Vitest files pass 12/12; targeted ESLint, strict TypeScript, the static i18n audit (0 missing keys / 0 placeholder mismatches), and `git diff --check` pass. Base TypeScript and the production build remain blocked outside this change because the declared `@mdxeditor/editor` dependency is absent from the current `node_modules`; the build reaches the admin news editor before failing module resolution. |
| Working tree 2026-08-14 (Home scholarship spotlight) | Connected `HomeScholarships` immediately after `HomeMetrics` and redesigned it as a white editorial break before the black “Have you ever?” band. The headline runs horizontally at desktop widths, the live published count is now a bordered brand-subtle stat panel, and “Scholarship spotlight” is a solid brand badge. Six information-rich cards form a three-up horizontal rail with native swipe/scroll and previous/next controls. Automatic movement and its pause control were removed together; logo captions, swipe instructions, and card sequence numbers were also removed. Cards expose coverage/value, funding type, destination, deadline, ranking, and a full-card action. The official-brand registry uses verified Rhodes, Gates Cambridge, and Knight-Hennessy programme marks. The Yenching Academy site’s referenced JPEG was measured as a valid but visually blank image, so Yenching intentionally falls back to its linked Peking University crest. Failed programme images now retry the university crest before showing the generic mark. | Home separates the scholarship story from the next inverse section, keeps the requested horizontal hierarchy, and guarantees a visible identity without fabricating logos. Live Supabase inspection confirmed that featured Knight-Hennessy row 139 has no provider, country, or university link, so the verified KHS registry supplies Stanford identity metadata; Yenching row 153 is linked to Peking University and its working stored crest. The cached query still obtains the exact count and at most 36 candidates instead of loading the full 2,877-row directory. Local `/dev/home` returned 200 with the Knight-Hennessy wordmark, Peking fallback, enhanced count treatment, directional controls, and none of the removed copy or sequence numbers. Base and strict TypeScript, targeted ESLint, seven focused Vitest tests, the static i18n audit, `git diff --check`, and the Next.js 16.2.3 production build passed (123/123 static pages generated). The in-app browser had no connected instance, so a new visual screenshot and E2E were not run. |
| `49ed6ea` + working-tree review follow-up (scholarship → My Portal handoff) | Replaced `/scholarships`'s `universityIds[0]` fallback with an explicit destination flow. A scholarship with exactly one structured university link saves that university automatically; one with several links opens a university picker limited to those linked schools; an award with no structured link opens a searchable university-directory picker and tells the student to verify the official eligibility rules. Saved scholarship state now carries its destination university, repairs legacy NULL-destination rows through an updating upsert, and only counts a scholarship as “Saved to My Universities” when the matching `user_universities` row exists. The PR review follow-up gives each async option load a generation id so a closed/superseded picker cannot overwrite the next one's choices, replaces the scholarship detail modal before opening the picker so only one Escape/scroll-lock owner exists, and loads persisted saves in `saved_at, id` order before using the last destination. | “Continue to Apply” now focuses the university actually chosen for the most recent scholarship instead of an inferred first/focused school. Country, provider, consortium, and multi-university awards can all enter My Portal without silently attaching to the wrong university or disappearing under a NULL destination. Slow/stale directory reads cannot attach a scholarship to a previous picker's university, detail → picker has one active dialog, and reload ordering is deterministic. The two writes remain retry-safe and a failed scholarship write cannot create an orphaned scholarship; an already-saved university is never removed. Focused Vitest passed 13/13, base and strict TypeScript passed, targeted ESLint passed, the static i18n audit reported 0 missing keys / 0 placeholder mismatches, and the Next.js 16.2.3 production build passed (122/122 static pages generated). No browser instance was connected, so the signed-in visual click-through was not run. |
| `working tree` | **Fixed 4 reported problems on `/ai-strategy/personal-report`: no nav bar, partly-Vietnamese content, a dead-end back into the locked Reflections page, and a Matching Report link that ignored which application the student came from.** Reported live from a screenshot showing all four at once, including a literal `"...|null"` string leaking into rendered text. (1) **Navigation**: the Personal Report page now accepts `?return=`, derives+re-verifies `applicationId` the same way the reflection pages already do, and renders `ApplicationNavFromReturn`; `aiStrategyApplicationNav()`'s `personalReport` entry now carries the same `?return=` shape as `reflections`. (2) **English-only content**: hardcoded Vietnamese strings written directly into template/boilerplate code across the report domain builder, the AI orchestration layer, the view, `candidate-context.ts`, and two API routes' error messages were all translated — this was never a translation-system bug, `t()` was not involved for any of these. Also fixed the root cause of the `"|null"` leak: three AI extraction prompts used an ambiguous `"...|null"` shorthand the model sometimes echoed literally; rewrote the prompts with concrete worked examples and added `sanitizeExtractedField()` as defence-in-depth. (3) **Inline report-answering without reopening the confirmed-data lock**: per an explicit owner decision (`AskUserQuestion` — "store answers separately from confirmed data"), new answers to a report's own follow-up questions now go into a new `personal_report_supplements` table (`user_id`, `field_key`, `answer`), read only at report-generation time and merged onto a copy of the candidate context — the confirmed `student_profiles` snapshot and its lock are never touched. New `POST /api/ai-strategy/personal-report/supplement` (zod-validated against an explicit field-key allow-list); the Driving Force section's gap action now expands into an inline textarea instead of linking out, saves, then triggers the existing regenerate call. (4) **Matching Report link**: the bottom CTA now receives a `matchingReportHref` computed by the page (`/ai-strategy/<id>/matching-report` when an application resolves, the generic `/ai-strategy/matching` otherwise) instead of a hardcoded generic link. Full incident writeup: `known-issues.md §5s`. New/updated tests: `personal-report-v2-repository.test.ts` (5), `supplement/route.test.ts` (5), `sanitize-extracted-field.test.ts` (7), `personal-report-v2-view.test.tsx` (2, including a regression test asserting the inline-answerable action never renders as a link to the reflections page), plus updated assertions in `personal-report.test.ts` and `ai-strategy-route-model.test.ts`. Full 2178-test suite and i18n check (0 missing keys after 2 new EN/VI pairs) both pass. Browser verification not done this pass — see the verification snapshot below. | A student opening the Personal Report or Reflections pages now sees the same header nav/breadcrumb as the rest of the application flow; the report reads entirely in English; a gap the report flags (currently the study-motivation question) can be answered right there and the report regenerated, without being sent back to a Reflections page that may already be locked; and "Continue to Matching Report" opens the exact report for the application being viewed instead of a generic matching page. |
| `working tree` | **Replaced the Personal Report's one-row-per-student model with an append-only version history, removed the regeneration cooldown that was silently blocking it, and added two automatic regeneration triggers.** Reported live immediately after the previous pass shipped: "The personal report now isn't generating at all. I believe this is because it's shared with multiple applications." Root cause: `student_personal_reports` was one row per student with a 24h free-tier regeneration cooldown built around a manual "regenerate" button; once per-application onboarding (§5p) made editing achievements/reflections possible again for every new application, a student routinely changed their shared profile between applications and `AnalysisWorkspace`'s `fetchOrGeneratePersonal` (fired on every application's confirm screen) kept hitting the cooldown wall on a report that had nothing to do with the application in front of them — the exact "shared with multiple applications" symptom reported. Fix, five parts: (1) new append-only `student_personal_report_versions` table (`supabase-personal-report-versions.sql`, same insert-per-generation shape `application_match_analyses` already uses for the Matching Report), with an idempotent backfill of each student's existing latest report as version one. (2) **No more time-based cooldown** — regeneration is now gated purely on whether the input actually changed (checked before any OpenAI call, so a no-op trigger costs nothing), an explicit owner decision via `AskUserQuestion` ("remove the time cooldown," the option that directly fixes this bug). (3) Every version records a `trigger` (`manual` / `matching_report` / `supplement_answer`) for the new version-history dropdown. (4) New shared `regeneratePersonalReport` (`src/features/apply/api/personal-report-generation.ts`) used by both the existing `POST /api/ai-strategy/personal-report` and, new, `POST /api/applications/[id]/match-insights` — a Matching Report generating now also refreshes the Personal Report, best-effort, never failing the Matching Report response if the refresh itself fails. (5) Two new read routes (`GET .../versions`, `GET .../versions/[id]`) and a version-history `Select` on the report page — picking a past version shows it read-only (the Driving Force inline-answer action falls back to a plain link, since answering only ever updates the latest version) with a "Back to latest" banner. Also fixed a genuine pre-existing `exactOptionalPropertyTypes` violation in `buildProfileEvaluationInput`'s three extraction calls, invisible until the new `features/apply/api` orchestration file pulled that module into `tsconfig.strict.json`'s graph for the first time — widened the three extraction functions' `model?: string` params to `model?: string | undefined`, no behavior change. Full incident writeup: `known-issues.md §5t`. New/updated tests: `personal-report-v2-repository.test.ts` (rewritten for the versioned functions), `personal-report-generation.test.ts` (5, the orchestration function's cached/regenerated/migration-missing/not-configured/error paths), `personal-report/route.test.ts` (7), `versions/route.test.ts` (3), `versions/[id]/route.test.ts` (4), `match-insights/route.test.ts` (2, the new trigger and its failure-tolerance), `personal-report-v2-view.test.tsx` (updated + 2 new version-history tests). Full 2213-test suite and i18n check (0 missing keys after ~10 new EN/VI pairs) both pass. Browser verification not done this pass — see the verification snapshot below. | A student working through a second, third, or later application no longer finds the Personal Report stuck "failed" for 24 hours after a routine edit to their shared profile — it simply regenerates when the data actually changed. Every past version stays viewable via a dropdown at the top of the report. Generating a Matching Report now keeps the Personal Report in step automatically, without the student needing to visit it and click anything. |
| Working tree (previous pass) | **Fixed 4 reported problems on `/ai-strategy/personal-report`: no nav bar, partly-Vietnamese content, a dead-end back into the locked Reflections page, and a Matching Report link that ignored which application the student came from.** Reported live from a screenshot showing all four at once, including a literal `"...|null"` string leaking into rendered text. (1) **Navigation**: the Personal Report page now accepts `?return=`, derives+re-verifies `applicationId` the same way the reflection pages already do, and renders `ApplicationNavFromReturn`; `aiStrategyApplicationNav()`'s `personalReport` entry now carries the same `?return=` shape as `reflections`. (2) **English-only content**: hardcoded Vietnamese strings written directly into template/boilerplate code across the report domain builder, the AI orchestration layer, the view, `candidate-context.ts`, and two API routes' error messages were all translated — this was never a translation-system bug, `t()` was not involved for any of these. Also fixed the root cause of the `"|null"` leak: three AI extraction prompts used an ambiguous `"...|null"` shorthand the model sometimes echoed literally; rewrote the prompts with concrete worked examples and added `sanitizeExtractedField()` as defence-in-depth. (3) **Inline report-answering without reopening the confirmed-data lock**: per an explicit owner decision (`AskUserQuestion` — "store answers separately from confirmed data"), new answers to a report's own follow-up questions now go into a new `personal_report_supplements` table (`user_id`, `field_key`, `answer`), read only at report-generation time and merged onto a copy of the candidate context — the confirmed `student_profiles` snapshot and its lock are never touched. New `POST /api/ai-strategy/personal-report/supplement` (zod-validated against an explicit field-key allow-list); the Driving Force section's gap action now expands into an inline textarea instead of linking out, saves, then triggers the existing regenerate call. (4) **Matching Report link**: the bottom CTA now receives a `matchingReportHref` computed by the page (`/ai-strategy/<id>/matching-report` when an application resolves, the generic `/ai-strategy/matching` otherwise) instead of a hardcoded generic link. Full incident writeup: `known-issues.md §5s`. New/updated tests: `personal-report-v2-repository.test.ts` (5), `supplement/route.test.ts` (5), `sanitize-extracted-field.test.ts` (7), `personal-report-v2-view.test.tsx` (2, including a regression test asserting the inline-answerable action never renders as a link to the reflections page), plus updated assertions in `personal-report.test.ts` and `ai-strategy-route-model.test.ts`. Full 2178-test suite and i18n check (0 missing keys after 2 new EN/VI pairs) both pass. Browser verification not done this pass — see the verification snapshot below. | A student opening the Personal Report or Reflections pages now sees the same header nav/breadcrumb as the rest of the application flow; the report reads entirely in English; a gap the report flags (currently the study-motivation question) can be answered right there and the report regenerated, without being sent back to a Reflections page that may already be locked; and "Continue to Matching Report" opens the exact report for the application being viewed instead of a generic matching page. |
| `working tree` | **Wrote a repair migration for orphaned per-application data left behind by `DELETE /api/applications/[id]`, reported live 2026-08-14: "when an application is deleted, all the other elements outside the direct application (including reports) are kept."** `DELETE /api/applications/[id]` has always been a single `DELETE FROM course_applications`, relying entirely on `ON DELETE CASCADE` — and every `supabase-*.sql` file in this repo already declares that on every table storing per-application data (stages, tasks, requirements, sources, Matching Report, Personal Report v1, Personalized Strategy, events, and the CV/statement/coach tables one level further down via `application_strategies`/`application_recommendations`). No code was wrong. Root-caused to the exact trap `known-issues.md` §0 already cost the owner four re-runs over: `CREATE TABLE IF NOT EXISTS` is a no-op against a table that already exists, so if any of these tables were first created in production before their file's `ON DELETE CASCADE` clause was written, the live constraint never picked up the change — production may still be enforcing whatever rule (typically `NO ACTION`) the table had on day one, no matter what the `.sql` file says today. Could not verify which tables actually drifted from this sandbox (no `SUPABASE_SERVICE_ROLE_KEY`, the same recurring limitation noted throughout this file), so the fix does not depend on knowing in advance: new `supabase-application-cascade-repair.sql` looks up each table's ACTUAL FK constraint by inspecting `information_schema` (never a guessed name), drops it, and re-adds an identical one with `ON DELETE CASCADE` — a no-op wherever it was already correct, a real repair wherever it was not — and deletes any row already orphaned by the drift first, since `ADD CONSTRAINT` would otherwise fail on the first pre-existing violation and leaving those rows behind is the exact "keep our databases clean" complaint this exists to fix. `confirmed_candidate_snapshots` and `personal_statements` are deliberately excluded (their `application_id` FK is `ON DELETE SET NULL` by design). Only touches tables that exist in the target environment; safe to run repeatedly. Full incident writeup: `known-issues.md` §5r. No application code changed — this is a database-only fix, matching the existing `DELETE` route's own doc comment about how deletion is supposed to work. | Once run in production, deleting an application will actually take every piece of data scoped to it along, instead of silently leaving reports/tasks/recommendations/CV+statement work behind in the database. **Action required: run `supabase-application-cascade-repair.sql` in production** — not yet confirmed run. |
| Working tree (previous pass) | **Fixed the two bugs reported live the day after the per-application migration (PR #181) shipped and was confirmed run in production: the read-only "Continue" button didn't work, and the nav header wasn't showing a "Reflections" option.** Root cause of both: `reflection/confirm/page.tsx` (Review & Confirm) redirected away unconditionally the instant `confirmedAt` was set — `if (confirmedAt) redirect(returnTo \|\| '/ai-strategy/report')` — so the exact page the owner wanted a "Reflections" nav entry to link to, read-only, could never actually render in its confirmed state. Fix, three parts: (1) `reflection/confirm/page.tsx` now renders `ReviewConfirmView` in a new `readOnly` mode instead of redirecting — checkbox, Confirm button, edit links and the confirmation modal are hidden; a confirmed banner and "Continue" button take their place, matching the pattern the other two read-only Candidate Information views already used. (2) `applicationSubNav()` (`src/shared/lib/app-routes.ts`) gained a `candidateConfirmed` option and a `reflections` entry linking to `/ai-strategy/reflection/confirm?return=...`, which REPLACES `overview` once `analysisReady` is true (owner: "maybe remove the overview option after we've generated the reports") rather than showing both; `activeSubNavKey()` now maps every `/ai-strategy/reflection*` path to `'reflections'`. (3) The "Continue" button on all three read-only Candidate Information views (`ReviewConfirmView`, `ConfirmedReflectionView`, `ConfirmedAchievementsView`) used to carry a raw, static `returnTo` that could point at the analysis gate even after this application's reports already existed. All three now take a computed `continueHref` built by the new `confirmedReflectionContinueHref(applicationId, aiAnalysisComplete)` (`domain/onboarding.ts`) — the report-generation gate while pending, the Personal Report once reports exist — each page computing it with one extra `fetchOnboardingState` call when `applicationId` resolves, falling back to the legacy raw `returnTo` when it does not. Full incident writeup: `known-issues.md` §5q. New/updated tests: `app-routes.test.ts` (Overview↔Reflections swap, locked-until-confirmed edge case, `activeSubNavKey` coverage for all three reflection routes), a new `review-confirm-view.test.tsx` (read-only banner/Continue/hidden-panel assertions), and the two existing confirmed-view tests updated for the `continueHref` prop rename. Full 2008-test suite and i18n check (0 missing keys after 2 new EN/VI pairs) both pass. Browser verification not done this pass — see the verification snapshot below. | A student who has confirmed Candidate Information for an application can now actually open "Reflections" from the nav bar and see their locked answers read-only, with a working "Continue" that goes to report generation or straight to the Personal Report depending on whether reports exist yet — instead of the page bouncing them away and the nav never offering the option at all. |
| Working tree (previous pass) | **Made Candidate Information review/confirmation per-APPLICATION instead of per-student — reversing PR #179's own "deliberately not done" call, at explicit owner correction the same day.** PR #179 fixed a dead-end navigation loop by making the Overview CTA route through `nextOnboardingStep(state)`; but `state` was still computed from the GLOBAL `student_profiles.confirmed_at`, so once a student confirmed on ANY application, every future application's onboarding silently skipped Reflections, Achievements, and Review & Confirm entirely and jumped straight into report generation. Reported live: "this is wrong. We want them to go through the normal reflections and application UI again... but for the flow to always be the same." New migration `supabase-per-application-onboarding.sql` adds `personal_summary_reviewed_at`/`achievements_reviewed_at`/`candidate_confirmed_at` to `course_applications` (plus a nullable `application_id` on `confirmed_candidate_snapshots`, tagging each confirmation with the application it belongs to). `fetchOnboardingState` now reads these three columns instead of the global ones — the change that makes `nextOnboardingStep` correctly resolve to `'personal-summary'` for every new application again. `apply/page.tsx`'s `fetchStrategyReadiness` (the My Portal tracker's "ready"/"continue applying" label) had the identical global-flag bug independently and got the same fix, restructured to keep its one still-independent read (`applicant_analyses`, filtered by `user_id` not application id) starting in parallel with `course_applications` rather than serialized behind it. The underlying candidate data (`student_profiles`, `student_achievements`, `student_activities`) stays one profile shared across every application, unchanged — only the review/confirmation STATE is now tracked per application, so editing is unlocked again for a new application even after being locked for an earlier one: `PATCH /api/reflection`'s lock and `POST /api/candidate-information/confirm`'s idempotency both moved from `student_profiles.confirmed_at` to `course_applications.candidate_confirmed_at` for the application in question, verified server-side by a new shared `verifiedApplicationId` helper (`features/apply/api/verified-application-id.ts`) — `applicationId` arrives from the client already derived from an untrusted `?return=` URL via the existing `applicationIdFromPath`, the same pattern `ApplicationNavFromReturn` already used, and every route independently re-checks ownership rather than trusting it. Per explicit owner direction, confirmed via `AskUserQuestion`: the flow order is always Reflections → Achievements → Review & Confirm → Analysis, for every application, never silently skipped by the system — but each of the first two pages gained a one-click "Skip — my answers/achievements are still correct" button at the top for a returning student who doesn't need to retype anything (calls the exact same validate-and-continue path the Next/Finish buttons already used). Every entry point with no application context (the legacy `/ai-strategy/report` generation, `personal-report-view.tsx`, marketing help pages) falls back to today's exact global behaviour, unchanged, when no `applicationId` resolves — deliberately out of scope, per the existing "two generations, not interchangeable" note. Full incident writeup: `known-issues.md` §5p. New/updated tests: `onboarding-status.test.ts` (including a regression test asserting one application's review state never leaks onto a different, brand-new application), `reflection/route.test.ts` and `confirm/route.test.ts` (per-application lock/idempotency/stamping, plus the existing global-fallback paths staying green), `verified-application-id.test.ts`, `apply-page-logo-performance.test.ts` (updated to check the new `applicant_analyses`-starts-in-parallel property instead of the removed `student_profiles` one). Browser verification not done this pass — see the verification snapshot below. | A student can now open a second, third, or later application and genuinely go through Reflections, Achievements, and Review & Confirm for it — seeing their existing answers prefilled with a one-click way to accept them unchanged — instead of the system silently deciding for them that nothing needs reviewing. Confirming a new application no longer locks editing for applications after it. |
| Working tree 2026-08-14 (homepage testimonials) | Rebuilt `HomeTestimonials` as a pure-black editorial band with a larger red “Testimonials” label, responsive image-led cards, boxed anonymous attribution, and overlapping white quote panels. Added three original AI-generated portraits of Vietnamese university students as local WebP assets; each card explicitly labels the portrait as illustrative and keeps the supplied testimonial anonymous instead of fabricating a student identity. Added static Vietnamese translations for the new labels and a focused component test. | The homepage now follows the supplied black/red testimonial reference on desktop and mobile without making the generated portraits look like the real authors of anonymous quotes. Local `/` returned 200 with the new copy and all three assets returned 200. Targeted ESLint, base and strict TypeScript, two focused Vitest tests (2/2 across the component and i18n audit files), and the Next.js 16.2.3 production build pass. The in-app browser was unavailable, so no new visual screenshot was captured and E2E was not rerun. |
| Working tree 2026-08-14 (runtime) | Upgraded the pinned runtime from Node 20.20.2 to Node 24.19.0 across `.node-version`, `.nvmrc`, package engines, the lockfile, and setup documentation. The local NVM installation is switched to 24.19.0. | `npm run dev` can use the repository's existing `--use-system-ca` flag instead of exiting with `node: bad option`. Full `npm run verify:pr` passed on Node 24.19.0 in 248 seconds: both typechecks, lint (0 errors / 23 warnings), 195 test files with 1,983 passing tests / 2 todo and coverage, and the Next.js 16.2.3 production build. E2E was not rerun. |
| Working tree 2026-08-14 | Fixed missing university logos in My Portal at the identity layer. `resolveUniversity` now has a genuinely non-mutating match-only mode; `/api/cron/link-applications?dryRun=1` and `?create=0` pass that policy into the resolver before any insert can occur, and report `would-match`/`would-create` outcomes. Bare legacy domains such as `www.birmingham.ac.uk` now participate in domain matching. The reconciliation route is scheduled daily at 02:30 UTC, before the 03:00 imagery job. Newly resolved logos are downloaded, normalised to WebP, uploaded to deterministic paths in Supabase Storage, and only then written to `universities.logo_url`; a failed upload leaves the field empty for retry. The imagery cron now uses a 20-second resolver phase, four concurrent logo workers, six-second host timeouts, a shared 50-second work deadline, and oldest-attempt-first rotation. Shared `Avatar` now falls back to initials if a non-empty URL fails in the browser. Production repair was executed after a zero-write preview: 8/8 rows linked, 0 failures; Birmingham's two applications both join Storage-backed logo ID 108. | Existing initials-only Birmingham and other legacy cards receive their real crests without adding a query or external fetch to `/apply`. New/imported applications link during parsing, the scheduled reconciler repairs any future transient miss, and broken remote images degrade cleanly instead of showing a broken-image glyph. Slow or unavailable sources no longer make as many as 40 sequential 20-second downloads consume the 60-second invocation or repeatedly starve later rows. The cron follow-up passes 10/10 focused tests; base and strict typechecks, targeted lint, and the production build pass on the resulting tree. The earlier full Vitest run reached 1,982 pass / 2 todo with only `check-i18n.integration.test.ts` exceeding its 5s timeout under parallel load (5.74s); that test passed alone in 2.26s. E2E not run. |
| PR #180 CI repair | Fixed the failure after the static-i18n merge: the university performance source-contract test now accepts the intentionally localized `t(saved ? ...)` accessibility label while still requiring `data-no-auto-translate`, `aria-pressed`, and `aria-label` on the same save button. The course-search POST re-fetch no longer relies on `.order()` support in every Supabase test chain; it checks the fetch error and sorts the small stored-result set by rank in memory, with an out-of-order response test. | The full CI suite can preserve both the translator-safe save control and Vietnamese accessibility labels. Course-search tests no longer log repeated false runtime errors, and API results remain deterministically rank-ordered. Full `npm run verify:pr` passes on Node 20.20.2: both typechecks, lint (0 errors, 23 existing warnings), 192 test files / 1972 tests passed / 2 todo with coverage, and the production build. E2E was not rerun. |
| `53beab0` | Rebuilt the advisor registration process and related UI, including validation, private verification documents, pricing, availability, review, success-state copy, and static English/Vietnamese coverage. | Advisor applicants get a complete, localized registration journey with clearer validation and privacy handling. |
| `66b7224` | Removed the repository-installed pre-push hook and its `prepare` installer. The complete `npm run verify:pr` gate remains in GitHub Actions and is available as an explicit local command. | A normal push no longer waits several minutes for typechecks, coverage tests, and a production build; pull requests still receive the full CI gate. |
| `937feaf` (#179) | Fixed later applications getting stuck before confirmation/report generation by routing the overview CTA through the actual onboarding state and adding Continue links to confirmed read-only reflection views. | A student can reach confirmation or analysis for a second or later application instead of entering a dead-end loop. |
| `b6592c9` (#177) | **Redesigned the post-confirm Report Generation screen** (`AnalysisWorkspace`, `/ai-strategy/[applicationId]/strategy/analysis`) to the look and feel of an owner-supplied 50-section "Report Generation Page" spec, deliberately scoped down from it. The spec described a persisted `ReportGenerationRun`/`GeneratedReport` backend, polling/realtime status updates, per-report retry infrastructure, and four independently-tracked report types (Personal, Matching, Strategy, Evaluation) plus CV Suggestions — none of which exist in this codebase: the actual post-confirm step generates exactly two reports (Personal + Matching) synchronously in one page visit, Strategy Report is a separate later onboarding step (F7), and "Evaluation Report"/"CV Suggestions" do not exist anywhere in the product. Rather than build the spec's backend or silently ship a token visual tweak, used `AskUserQuestion` to get an explicit scope decision from the owner: **"Redesign the existing 2-report flow"** — rebuild the visual/informational design to match the spec around the two reports that actually generate here, keep everything synchronous (no generation-run table, no polling API, no per-report retry infra), and never claim a status the code cannot back up. What shipped: a confirmation hero (checkmark, "Your information is confirmed" → "Your reports are ready" on completion, an optional "Confirmed {date}" line read from the new `student_profiles.confirmed_at` via a tolerant `loadConfirmedAt` select so a pre-migration deployment degrades to no date rather than a 500), a shrunk loading video/GIF next to an overall progress bar (shown only pre-completion), a `<ul>` of two independently-tracked report rows (Personal, Matching — each its own status: generating/complete/failed, its own "Open report" link once done, its own "Try again" retry that re-fires only that report's fetch, not both) with an `aria-live="polite"` status region, a failure-reassurance panel when any report fails ("your confirmed information is safe"), and an honest "you can leave this page — we'll keep working in the background" note (genuinely true here: no `AbortController`, a client-side nav away doesn't cancel either in-flight fetch). The two reports are generated via module-level pure async functions (`fetchOrGeneratePersonal`/`fetchOrGenerateMatching` — GET-then-POST-if-missing against the existing `applicant-analysis`/`course-match`+`match-insights` routes, unchanged), kept setState-free so they're independently unit-testable and so mounting them via a nested `function run() {}` declaration inside each `useEffect` (not a `useCallback` referenced by name) avoids a real `react-hooks/set-state-in-effect` false positive — confirmed by reading the rule's own HIR-based analysis in `node_modules/eslint-plugin-react-hooks`, which flags any setState reachable from an effect regardless of whether it happens before or after an `await`; the same nested-declaration workaround is already established elsewhere in this codebase (`strategy-recommendation-workspace.tsx`). 4 new tests (`analysis-workspace.test.tsx`): both reports completing, one report finishing while the other is still mid-flight and openable independently, one report failing with its own retry while the other succeeds, and the confirmed-date/course-subtitle rendering. Caught and fixed during this pass: several of the ~21 newly-added i18n dictionary entries were typed with curly apostrophes (`'`) by habit — matching the convention used by many *other* entries elsewhere in this large dictionary — while the component's actual source strings use straight apostrophes (`'`) throughout; since the dictionary is keyed by exact string match, the mismatched entries would have silently failed to resolve translations for real strings. Browser verification not done this pass — see the verification snapshot below. | The screen shown right after "Confirm & Generate Reports" now looks and reads like the approved design — a clear confirmation state, per-report status a student can actually trust (not a faked progress bar), and an explicit "you can leave" message that is true rather than aspirational — while the actual generation behavior (two reports, synchronous, existing routes) is unchanged. A report that fails can be retried on its own without re-running the one that already succeeded. The four-report/polling/persisted-run vision from the full spec remains a known future scope, not attempted here. |
| `48a1b10` (#176) | **Fixed a production incident: confirming Candidate Information failed for every student with a misleading `503`.** Owner-reported with a real Vercel function trace showing `POST confirmed_candidate_snapshots` → `403`. Two bugs, not one: (1) `supabase-candidate-confirmation.sql`'s RLS setup had a `SELECT` policy but no `INSERT` policy on `confirmed_candidate_snapshots` — the confirm route inserts through the ordinary user-session client (not `createAdminClient`), so RLS applies, and with no `INSERT` policy it defaults to denying everyone, including the row's own owner. Fixed by adding `confirmed_candidate_snapshots_insert_own` (`WITH CHECK (auth.uid() = user_id)`), idempotently, to the same migration file. (2) The route's own `migrationMissing()` classifier made the failure invisible: it matched any error whose *message* contained the string `confirmed_candidate_snapshots`, and Postgres's RLS-violation message ("new row violates row-level security policy for table ...") happens to contain exactly that — so a real permission error (`42501`) was misclassified as "migration not run yet," returning a `503` telling the student to retry a request that could never succeed. Narrowed the check to match only on the Postgres/PostgREST codes that actually mean "does not exist" (`42703`/`PGRST204`/`42P01`) or the phrase "does not exist" in the message; an RLS or other permission error now correctly falls through to a plain `500`. New test asserts a `42501` error returns `500`, not `503`. Full writeup: `known-issues.md` §5n. **Action required in production**: re-run `supabase-candidate-confirmation.sql` (idempotent) to pick up the new policy — the code fix alone does not grant the missing database permission. | Confirming Candidate Information ("Confirm & Generate Reports") will work once the updated migration is re-run in production, instead of failing for every student with a message that told them to do the one thing (wait, retry) that could never fix it. Any future permission/constraint error on this route will now surface as a genuine error instead of the same misleading "try again shortly." |
| `4c95861` (#175) | **Rebuilt the Edit Achievement / Edit Activity modal as a large two-column editor, and fixed a latent focus-theft bug in the shared `Modal` component along the way.** Owner-supplied approved design (2 screenshots: current cramped popup vs. the approved large editor). (1) `EditEvidenceModal` (`features/apply/ui/edit-evidence-modal.tsx`) is now a `min(1120px, 100vw−64px)` two-column workspace (near-full-height single column on mobile) instead of the old `max-w-sm` six-field popup: header with a category icon in a pastel square, title, subtitle, and a labelled `Close editor` button; a real `Level` dropdown (`LEVEL_SUGGESTIONS` plus `Not applicable`/`Other`, the latter revealing a free-text field — `level` stays free text in the schema, per its own existing "not a boundary" rationale, so a custom value already on a record is never coerced into one of the suggestions) instead of a text input; a generated `Award year` dropdown instead of a bare number spinner; a `Description` textarea with a live `1500`-character counter; sticky footer. (2) Inline validation (title, description, and — achievement-only — award year) replaces the old `disabled`-until-valid button, with real per-field error text and `aria-invalid`/`aria-describedby` wiring — and deliberately does NOT use the native HTML `required` attribute on those fields, only `aria-required`, because `required` on a field inside a `<form>` makes the browser's own constraint-validation tooltip intercept a submit-button click before this component's `onSubmit` ever runs, silently replacing the custom inline message with a native one (which is itself the kind of "browser alert" the spec says to avoid) — caught by a same-day test failure where clicking Save with an empty required field never showed the inline error at all. (3) Unsaved-change protection: closing via X, Cancel, Escape, or a backdrop click while the form is dirty shows a "Discard changes?" confirmation instead of closing silently, implemented as a single in-panel overlay (not a second stacked `Modal`) specifically to avoid two independent Escape-key listeners firing for one keypress. (4) Fields that came back from AI extraction reading literally `N/A` (a real, observed extraction artifact, not something this codebase's own code ever writes) are normalised to blank on open — showing "N/A" as if it were the student's own answer was an explicit thing the spec asked to fix. (5) **Root-caused and fixed a real bug in the shared `Modal` component**, not specific to this editor: its focus-management effect keyed on `[open, onClose]`, and `onClose` is a fresh function reference on every render for nearly every caller in this app (an inline arrow, or — as in this new editor — a function whose identity depends on render-local dirty-tracking state). Every one of those re-renders re-ran the effect and yanked focus back to the panel's first focusable control, which is what made typing into "Achievement name" reliably lose keystrokes to the achievement-type dropdown the moment the field went from empty to non-empty (a real, user-visible mid-typing focus jump in any browser, not merely a test artifact — a Vitest+Testing-Library reproduction is what surfaced it). Fixed by reading `onClose` through a ref updated every render instead of closing over the prop directly, so the effect depends only on `[open]`; every other `Modal` caller in the app benefits from the same fix without any of them needing to memoize their own `onClose`. **No backend or schema changes**: there is no per-item `PATCH /api/candidate/achievements/:id` in this codebase — "Save changes" still commits to the parent page's in-memory achievements/activities list (`reflection-evidence-form.tsx`), which is what already makes the card update with no reload, and the whole list is persisted together via the existing `PATCH /api/reflection` (already `423`s once the profile is confirmed) when the student reaches Review & Confirm; achievement/activity category enums, `period` staying one free-text field (not split into start/end), and the description's stored 2000-char schema cap (vs. this editor's 1500-char UI limit, enforced client-side only) were all left as-is — none of the two supplied screenshots show a reason to change them, and widening the achievement-type enum in particular would be a real data-model change outside "improve the editor" scope. 8 new tests (`edit-evidence-modal.test.tsx`: N/A normalisation, save, blocked-save inline errors, dirty-aware close/discard, activity-specific fields, add-mode labelling); the full 1940-test suite (including every other existing `Modal`-based dialog) and i18n check (0 missing keys after ~40 new EN/VI pairs) both pass. Browser verification not done this pass — see the verification snapshot below. | Opening Edit on an achievement or activity now opens a spacious, easy-to-scan editing workspace instead of a cramped popup, with a working "Level" dropdown, a real year picker, a description counter, and genuine inline validation messages a student can actually see (previously invisible behind the browser's own tooltip). Closing with unsaved changes now asks first instead of silently discarding them. Separately, every OTHER modal in the app (remove-confirmation, rename, add-type chooser, duplicate-merge prompt, etc.) is now free of a focus-stealing bug that existed before this change touched any of them. |
| `5375782` (#174) | **Added a Review & Confirm checkpoint between finishing Candidate Information and report generation, with an immutable snapshot and a profile lock.** Owner-supplied 74-section spec plus 6 mockups. Scoped down from the spec's own §52 ("all reports must read from the snapshot, not live tables") by explicit owner choice — that would mean rewiring the already-shipped Personal/Matching/Strategy report generation across three features; existing reports keep reading the live tables, which are frozen anyway once the profile is locked. What shipped: (1) A new `/ai-strategy/reflection/confirm` page — readiness summary (four required-question checks plus any achievement/activity still `needs_review`, both reusing the exact rule `reflection-about-form.tsx`'s own Next-button gate already enforced, now extracted into `reflectionBlockingIssues`/`candidateReadiness` and shared with the server), per-section review cards with Edit links back into the two step forms, a checkbox acknowledgement, and a confirmation modal. Deep-linking Edit to the one wrong question (spec §11) was descoped by owner decision — Edit always reopens the step form, and the analysis-gate route guards (see below) mean an edit always funnels back through this checkpoint before reports can run. (2) `POST /api/candidate-information/confirm` — idempotent (a second call returns the existing snapshot rather than creating one), re-validates readiness server-side rather than trusting the client, inserts one `confirmed_candidate_snapshots` row (a single JSONB `{reflection, documents}` blob — the exact shape already read/written everywhere else in this feature, not a six-plus-table normalized schema) and sets `student_profiles.confirmed_at`. (3) `PATCH /api/reflection` now checks the lock first and returns `423 PROFILE_LOCKED` once confirmed; a missing `confirmed_at` column (migration not yet run) fails open, matching every other tolerant-read in this route. (4) The two reflection pages (`/ai-strategy/reflection`, `/ai-strategy/reflection/achievements`) branch on `confirmedAt` into dedicated read-only views (`ConfirmedReflectionView`, `ConfirmedAchievementsView` — new components, not the editable cards/forms with their actions hidden, per the spec's own "not a disabled copy" principle) instead of the editable form. (5) `nextOnboardingStep` gained a `confirm` step between `achievements` and `analysis`; the `analysis`/`analysis/fit`/`analysis/portrait`/`analysis/recommendation` route guards, which previously only checked `personal-summary`/`achievements`, now also redirect a not-yet-confirmed student back to `/confirm` — without this, a student could reach report generation without ever passing through the checkpoint. (6) The achievements page's "Finish" CTA now always routes to `/ai-strategy/reflection/confirm?return=<original destination>` instead of pushing straight to the analysis gate or the standalone report page; both are carried through as the confirm page's own `return` param, so confirming lands exactly where the old CTA used to. New `confirmed_candidate_snapshots` table + `student_profiles.confirmed_at` column (`supabase-candidate-confirmation.sql`, append-only, SELECT-only RLS). One consolidated server-side loader, `loadCandidateReflection` (`features/apply/api/candidate-snapshot-repository.ts`), replaces what would otherwise have been a third near-duplicate of the two pages' existing tolerant-select loaders — used by the confirm route and both read-only views. 39 new/changed tests (readiness domain logic, onboarding step-machine, the confirm route's idempotency/readiness/migration-degradation paths, the PATCH lock); the full 1932-test suite and i18n check (0 missing keys after ~50 new EN/VI pairs, including ~8 backfilled for the previous session's read-only views, which had shipped without dictionary entries) both pass. Browser verification not done this pass — see the verification snapshot below. | A student can no longer submit an edit that quietly changes what a report was generated from: once they press "Confirm & Generate Reports," their candidate information, achievements, activities, and documents are locked exactly as reviewed, shown back to them as read-only from that point on, and a direct or bookmarked link into report generation bounces them back to this checkpoint first if they have not been through it yet. |
| `a57f0f1` | **Rebuilt the Achievements & Activities page (Candidate Information step 2) as an upload-first card grid — owner-supplied 60-section spec plus a mockup screenshot.** Replaces the giant `RepeatableFieldset` form, where every achievement/activity (extracted from a PDF or typed by hand) rendered as the same six-field inline block, with the flow the spec describes: **upload → AI extracts → cards appear → review/edit → finish.** (1) Extracted items now become cards immediately — tagged "Extracted from {file}" and `needs_review` (new `review_status`/`source_type`/`sources` columns, `supabase-reflection-review-status.sql`) — instead of sitting in a separate checkbox-approval panel before anything is added to the profile; a **"Review achievements" drawer** steps through the unreviewed ones one at a time (Keep/Edit/Remove), closing with "All extracted achievements reviewed". `NULL` on a pre-existing row reads as already-reviewed/manual, so nothing already saved is retroactively flagged. (2) A same-title extraction is now flagged **"Possible duplicate"** (Merge / Keep both) rather than silently dropped, which was the previous behaviour and indistinguishable from the extraction having missed it; Merge unions the source list and fills only the fields the existing record was missing, keeping its id so an edit made before the merge survives. (3) **Edit is a small modal**, not the old inline form — one component handling both kinds via a `kind` discriminant, since achievement and activity share five of six fields — and a manual achievement/activity (added via a "What would you like to add?" type chooser) looks identical to an extracted one once saved, no visual penalty. (4) The document panel lists **every uploaded document**, not just the current session's (new `uploaded_documents` read in `page.tsx`, `useEvidenceDocuments` hook), each with **Preview/Rename/Reprocess/Remove**; Preview opens the **browser's own PDF viewer** in a right-side drawer via a signed URL (`#page=N` for page-jump) rather than a hand-built page/zoom control set — nothing in this codebase renders a PDF today, and every major browser already ships a full viewer. Removing a document does not touch achievements already extracted from it (they are separate rows the moment they exist). (5) Card icons use **one consistent brand tint**, not the five-to-six soft category colours the spec's mockup draws: `tokens.css` defines exactly three soft fills, and CLAUDE.md rules out inventing kit variants — every sibling control in this redesign (`SelectionCard`, `OptionCards`) already answers "tell options apart" with icon shape on one tint, not colour. **Three scope simplifications, stated rather than hidden:** extraction stays the existing synchronous request/response route (not a new background-job/polling/realtime architecture — the inline "Finding achievements…" status covers the same UX ground); duplicate detection stays title-based (extending the comparison `applyEvidenceCandidates` already made) rather than a general fuzzy/AI merge across documents; `activitySchema.period` stays one free-text field rather than being split into start/end dates, per its own existing design rationale. Verified in a browser: upload → extract → an unreviewed card with its source badge → the one-at-a-time review drawer (Keep confirms, card badge flips to "✓ Reviewed", the Review button disappears once the queue is empty) → edit modal (type-dependent fields) → type chooser → remove confirmation, on both the academic and extracurricular tabs; mobile at 390px (tab bar scrolls independently within its own row, zero page-level horizontal overflow). 15 new/changed tests (duplicate flagging, merge field-filling, review-status defaulting on read); the full 1914-test suite and i18n check (0 missing keys after ~65 new EN/VI pairs) both pass. Branch restarted from `main` after PR #172 merged mid-session; see the "Code snapshot" line above. | A student uploads a CV once and sees achievement/activity cards appear from it, tagged with exactly where each fact came from, instead of retyping an entire academic history into a giant form or wading through a checkbox list before anything lands on their profile; a same-title duplicate is caught and offered a merge instead of silently vanishing or duplicating; and every document they have ever uploaded — not just this session's — stays visible, previewable, and removable without deleting what was already learned from it. |
| `3b1f831` (PR #172, spec 2) | **Questions 5–8 rebuilt to spec 2: subject and destination grids, study-level cards, and a generated intake picker.** (1) Q5/Q6 share one `SearchableMultiSelectGrid` — the spec asks for that, and the reason is the reason everything else here is shared: two grids that merely look alike drift. Each tile is a `<label>` around a real checkbox, so Space toggles, Tab moves and the selected state is never carried by colour alone. (2) Subjects come from a new config-driven catalogue of 45 across nine groups (the previous list was `subjectFamilies`, a computing-dominated discovery taxonomy — a student wanting Nursing or Politics had nothing to click), with stable slugs, icons and aliases so `CS`/`AI`/`IT`/`maths` resolve. Searching for something absent offers **Add as Other**, which stores the typed words separately rather than as a slug matching cannot resolve. (3) Destinations cover every country, built as a view over the ISO nationality catalogue rather than a second list. Popular destinations lead; the rest are behind **Show all countries** (200 tiles inline made a page nobody scrolls), and searching bypasses the cap. **`🌍 I'm open to other countries` is a flag, not 197 selections** — selecting everything is the absence of a preference, so there is deliberately no Select all here. (4) Q7 is full-width `SelectionCard`s with contextual guidance when the chosen level outruns the stated qualification — guidance, never a block, per the spec. (5) Q8's intake is **generated from today's date** and stored as `{type, season, year}`; the old list was seven hardcoded strings that would have kept offering 2026 in 2029, and a display string has to be parsed before anything can match on it. Four questions now block Next with an inline message. **A real gap found while verifying:** deriving destinations from nationalities silently dropped Hong Kong — a territory, not a UN member, and a destination the spec names — visible only because the popular block came back one tile short; `EXTRA_DESTINATION_ISO` adds it and Macau, with a test. Both storage readers accept the display strings the previous form wrote, so nobody loses their destinations or intake. | A student picks subjects from a list that includes their subject, finds a country by typing `UK`, says they are open to suggestions instead of ticking 197 boxes, and chooses an intake that will still be correct in 2029. Verified in a browser end to end: 44 subject tiles, alias search, the empty state and Add-as-Other, all four inline validation messages, the 20→200 country expansion with Hong Kong present, and the intake listbox under keyboard control. 46 new tests. |
| `ac1117d` (PR #172, spec 3) | **Rebuilt Questions 9–12 of the Candidate Information questionnaire: AI-assisted written answers, per-subject motivation, funding as cards, and a multi-currency tuition budget.** Owner-supplied spec plus 4 mock-ups, built on top of specs 1–2 in the same PR. (1) Q9 ("What do you want to do after you graduate?") gets a 1500-character textarea with a live counter, three prompts, a reassurance line, and **Generate ideas with AI** — new `POST /api/reflection/ideas` (`generateAspirationIdeas`) returns 2–4 short first-person sentences built only from what the student already told the form (their chosen subjects, their own draft), never a name, grade or nationality. A suggestion is **appended, never applied**: it lands in the textarea only on click and is ordinary editable text from that instant — the route has no write path at all, which is the only way to actually enforce "assist, not replace". (2) Q10 ("Why this subject?") is now asked **per subject**, driven by the subjects chosen in Q5 — one box was unanswerable for a student who picked three. Only one subject needs an answer; the rest are optional tabs with a tick once answered. The map lives in a new `subject_motivations` JSONB column with a `__primary` key naming which subject mirrors into the pre-existing `study_motivation` string column, so `match-insights.ts`'s `personalContext` and the portrait's "driving force" section keep reading the one column they always read — nothing downstream needed to learn about the map. A student who answered the old one-box version keeps seeing their text above the new boxes; which subject they meant is not guessed at. (3) Q11 (funding) becomes full-width `SelectionCard`s with a sentence of explanation per option, and now stores a stable id (`personal_savings_or_parents`, etc., new `funding-catalog.ts`) instead of the option's display string — the last reflection field that was still doing that. `fundingSourceFromStored` still reads the old prose values, so nobody's existing answer disappears. (4) Q12 (tuition budget) is now a real range in the student's **own currency** — GBP/USD/EUR/CNY as pills plus nine more behind "Other" — replacing the VND slider + 5-band USD enum pair, which forced every non-Vietnamese budget through a đồng conversion to answer at all. Changing currency **re-expresses** the amount (`reBase`) rather than resetting the handles; the top of each scale is the open-ended "and above" band (`max: null`); the other-currency conversions shown under the slider are explicitly labelled approximate and are never stored — only `{currency, min, max}` is. The legacy `tuition_budget_usd` band is derived from the structured budget on write, so `candidate-context.ts` and the matching prompt keep the input they already read. Verified end-to-end in a browser by walking `/dev/reflection` through all twelve questions (seeded past the required-intake gate that had been silently blocking Q9–12 in the dev preview), including switching Q10 between two subjects and Q12 between currencies; a double-labelled Q9 textarea (heading printed the same string as the field's own `<label>`) was caught and fixed the same way. 15 new tests (funding catalogue + the new reflection read/write paths); the pre-existing 211-test `features/apply` suite and the 1911-test full suite both still pass; i18n clean (0 missing keys after adding ~55 new EN/VI pairs). | A student can answer "what do you want to do after graduating?" with an AI-suggested starting sentence they can freely edit, give a different reason for each subject they're considering, pick how they'll fund their study from cards that explain what each option means, and set their tuition budget in whichever currency they actually think in — with a live approximate conversion to the others, never silently converted and stored. |
| `#172` (specs 1–2) | **Redesigned the Candidate Information questionnaire: two display modes, rich per-question controls, real score scales, and AI grade conversion.** Owner-supplied spec plus mock-ups. (1) A **One question at a time / Show all questions** toggle. Both modes render the *same* `AboutQuestion` component — one calls it once, the other twelve times — so switching cannot lose an answer or downgrade a control to a plain input, and there is no second implementation to drift. (2) Every question now draws through one `QuestionCard` (icon, heading, one-line explanation), which is what makes twelve questions read as one designed thing rather than a pile of form controls; the icon comes from `ABOUT_QUESTIONS` so copy and visual are decided together. (3) Education is large selectable option cards with an **Other → describe it** field; the free text is stored on `current_qualification` in place of the literal word "Other", so the portrait reads the real qualification. (4) Nationality is a compact flag trigger opening a searchable grid over all 197 nationalities — new `src/lib/nationality-catalog.ts`, keyed by ISO code so flags derive from the code and country names come from `Intl.DisplayNames` (the Vietnamese half is translated by the platform, not by 197 dictionary rows). Aliases mean "UK", "United Kingdom", "England" and "British" all find the same row; matching is accent-insensitive. (5) **Scores now know their own scales.** The form previously took GPA and IELTS as unvalidated free text — its own IELTS placeholder read "7 / 10", a band IELTS does not issue. New `academic-scores.ts` states GPA 0–4.0, IELTS 0–9.0 in half bands, TOEFL 120, PTE 90, Duolingo 160, Cambridge 230, and (unused but ready, per the spec's insistence) SAT 400–1600, ACT, IB, AP. Out-of-range values show an inline error naming the scale. (6) **Three kinds of conversion, only one using a model.** A published English test → IELTS is a documented concordance done in code (instant, free, cannot hallucinate); a free-text description of grades → GPA, and an unlisted English qualification → IELTS, go to `POST /api/reflection/convert-score`. The model may answer "I am not sure" — that is a 200 with a null value and a reason, and the UI shows the reason instead of a number. Server-side clamping holds any estimate to the scale and snaps IELTS to half bands. Nothing is ever written without the student pressing "Use this"; the original description and the conversion method are stored alongside the value in `grades_summary`, so a converted 4.0 is never mistaken for one the student was awarded — **and none of it needs a migration.** (7) Debounced autosave with a subtle "✓ Saved", and Save & Exit. Verified in a browser: all twelve questions, both modes, mode-switch data retention, GPA 4.5 and IELTS 9.5/6.25 inline errors, TOEFL 95 → IELTS 7.0, the AI result card, mobile at 390px (zero horizontal overflow, tracker collapses to a bar, nationality grid to two columns), Escape-to-close and keyboard reachability. | A student picks their education from cards, finds their nationality by flag or by typing "UK", and — whatever school system they come from — can describe their grades in their own words and get a defensible estimate they confirm before it is used. Scores can no longer be stored off their own scale. 54 new tests cover the catalogue/stored-list sync in both directions, every concordance table for monotonicity and range, the validators, and the conversion clamping. |
| `#171` | **Rebuilt reflection step 1 as a one-question-at-a-time flow, gave the reflection pages the application nav band, replaced three free-text fields with pickers, synced the two budget controls, and added the three questions the reports were already asking for.** Owner-reported, five items. (1) Step 1's twelve questions are now one per screen with Back/Next, and the progress bar fills a notch per answer instead of sitting at 50% from arrival — the order lives in `ABOUT_QUESTIONS` (`domain/reflection-steps.ts`) so the sequence and the progress maths cannot disagree. Step 2 keeps its list layout (owner decision: repeatable lists are not single questions). (2) The reflection pages sit at `/ai-strategy/reflection`, outside the `[applicationId]` layout that mounts the red band everywhere else, which is why they were the one place in the flow with no breadcrumbs — `ApplicationNavFromReturn` derives the id from the `?return=` param the onboarding router already builds, and **re-checks ownership against `course_applications`** because a query parameter is untrusted. (3) Nationality is a 197-entry `Select`; majors and countries are searchable `MultiSelect`s over `subjectFamilies`/`regions`, replacing comma-separated text. Both gained a visible question label — `MultiSelect` renders its `label` as `aria-label` only, which left a bare search box on a one-question screen. (4) The VND slider and the USD band were two independent controls for what the owner confirmed is one quantity; both are relabelled **annual tuition** and now update each other through `vndRangeFromUsdBand`/`usdBandFromVndRange`, with the exchange rate printed in the UI rather than applied silently. Syncing the previous labels (total cost vs annual tuition) would have needed an invented course length and living-cost estimate. (5) Added career goal → the existing `goals` column, why-this-subject → new `study_motivation`, and target intake → new `target_intake`; `match-insights.ts` builds `careerDirection`/`personalContext` from those columns and F7 scores a `futureAlignment` dimension against them, and nothing in reflection had ever written any of them. The PATCH retries without the two new columns on a missing-column error, so an unapplied migration costs the two new answers rather than the whole step. Run `supabase-reflection-questions.sql`. | A student answers one question at a time with honest progress, can get back to their application from inside reflections, picks subjects and countries from real lists instead of typing comma-separated text, sees the two budget controls agree, and is asked the three things the Personal, Matching and Strategy reports were previously scoring against a blank. 25 new domain tests cover the budget conversions (including the round-trip that keeps the two controls from rewriting each other) and the per-question progress. |
| `#170` | **Fixed every Planner task detail page returning an error page, and the Planner dashboard crashing for any application with a deadline.** Reported by the owner with a live URL after §5i had supposedly fixed the same symptom — §5i was aimed at the wrong cause. The task detail page is a server component that imported `categoryLabel`/`categoryVariant`/`formatDate`/`PRIORITY_LABEL`/`PRIORITY_VARIANT` from the feature's `ui` barrel, which re-exported them from `planner-shared.tsx` — a `'use client'` module. A client module's exports reach a server component as client references, not values, and the two failure modes are asymmetric: **calling** one throws (`Attempted to call categoryLabel() from the server…`), which is what 500'd every task page, since a generated recommendation essentially always has a category; **reading** one (`PRIORITY_VARIANT[priority]`) silently yields `undefined`, so the priority badge would have rendered blank. `dashboard-summary.tsx` had the same bug in a narrower form — it called `formatDate(deadline)`, so the Planner dashboard crashed only when the application had a deadline set. Fixed by extracting the pure mappings and the formatter into a new directive-free `planner-presentation.ts`, usable from both module graphs; `planner-shared.tsx` keeps only the React components. Diagnosed and confirmed with a throwaway server-component probe route under `src/app/dev/` (neither `tsc` nor `next build` catches this — the types are identical and the failure is at render), then re-verified by rendering the detail page's exact body against a synthetic row with every branch populated. Also swept the whole repo with a one-off scanner for other server modules importing non-component values from `'use client'` modules; the only remaining hits are `T` (a component, safe) and `useT` in three components that are already only rendered inside client trees. See `docs/known-issues.md §5l`. | Clicking any task in the Planner opens its detail page again instead of an error page, and the Planner dashboard no longer crashes for an application with a deadline. New `planner-presentation.test.tsx` (8 tests) guards the structural property that prevents a recurrence, since a unit test cannot reproduce the RSC boundary itself. |
| `e61545e` (#169) | **Three owner-requested follow-ons to the header animation.** (1) The three background words now size against the header's own height (`mainFontSize`/`subFontSize` as fractions of it, `textBaseline: 'middle'`) instead of the deliberately small text #168 shipped — the header itself does not grow, so the rows overlap rather than stack. (2) The boot line's alignment flash now overlays only `bootText.slice(0, 2)` ("Go") instead of the full typed "Gooooo…" string — the repeated `o`s never turn white. (3) The brand-red fill and the real breadcrumb/nav content now hold back ~3 seconds after mount (`gb-app-nav-reveal`, `src/styles/tokens.css`, `animation-delay: 3s`) so a visitor sees the animation play against the page's own background before the chrome arrives; the canvas itself is unaffected by the delay. Building (3) surfaced a real bug, caught only by pixel-sampling a screenshot (not visible in a compressed PNG — the same false alarm #168 nearly repeated): the delayed fill `<div>` was placed *after* `ApplicationNavBackground` in JSX, so once its fade-in finished it painted on top of the canvas and silently buried the animation instead of becoming its backdrop. Fixed by moving the fill before the canvas in source order. See `docs/known-issues.md §5k`. Verified visually via a throwaway `/dev/nav-preview` route, Playwright screenshots across the full cycle (mount, mid-boot, pre-reveal, post-reveal, settled), and pixel/opacity sampling to confirm both the reveal timing and the stacking fix, before removing the scaffold. | The animation now visibly fills the header without adding height, only ever flashes "Go" white (never the repeated `o`s), and plays on its own for ~3 seconds before the red chrome and real navigation settle in around it — with the animation still visible as texture on the red afterward, not buried under it. |
| `5a78a1f` (#168) | **Rebuilt the header animation to fit inside the existing header and follow the full reference spec.** Owner feedback on PR #167: the animation had to live inside the header's own bounds, not add a strip below it, and had to follow the supplied spec's full three-phase choreography (an easing-curve "Go"→"Gooooo…" typing reveal, two marquee rows decelerating via the exact integrated-velocity physics formula, and a sine-fade alignment flash with a 1-second anticipatory lead on the second row) rather than the simplified single-row version shipped in #167. Ported the algorithm faithfully, scaled to the header's real (unchanged) height instead of the reference's viewport-width sizing. Caught and fixed a real bug in the port along the way: the flash was lighting up an entire tiled row at once instead of only the one word instance the reference's own alignment math targets — confined to a header with no spare space, a whole-row flash competed with the real nav text the same way the dedicated-strip version was built specifically to avoid. Fixed to flash only the matching instance, and added a low base-opacity pass (`BASE_ALPHA`/`FLASH_PEAK_ALPHA`) since three lines of decorative text at full strength directly behind two lines of real content reads as clutter at this scale, not texture. | The header animation now lives entirely within the header's existing footprint — no added height — and matches the supplied spec's actual choreography and physics, while never outshining the real breadcrumb/nav text on top of it. |
| `642abe7` (#167) | **Added a kinetic-typography accent strip under the brand-red application header** — superseded by the entry above; see it for why the strip approach was replaced. | — |
| `8fb9f2f` | **Fixed Log 3 User Profile option selection.** `/profile/preferences` now gives countries and target subjects an accessible local combobox: deterministic, case-insensitive search ranks prefix matches first; mouse and Arrow/Enter/Escape selection work; selected values are excluded; case-insensitive duplicates are prevented. Countries use onboarding `regions` plus the existing `Open to ideas` sentinel; subjects are flattened from `subjectFamilies`; cities remain flexible free-text tags. The sentinel is exclusive. Added 13 focused `TagInput` tests. | Students can type a country or subject fragment, see valid matching choices, and select one without changing the existing authenticated `student_profiles` upsert or the flexible city workflow. |
| `9b769ee` (#166) | **Made the Matching Report the application's permanent home, and added "generate Planner tasks from this strategy report."** `/ai-strategy/[applicationId]/strategy` no longer computes `nextOnboardingStep`/redirects onward through intro → strategy → dashboard once the analysis exists — it now always lands on `/strategy/analysis/fit`, for every application, regardless of how far the student has since progressed; Personalized Strategy and the Planner are reached only through the nav bar now. Also: `strategy-recommendation-report.tsx`'s Roadmap tab gained an "Add to Planner" button (`POST /api/applications/[id]/strategy/roadmap-tasks` → `generateRoadmapTasks`) that turns the F7 report's `roadmap.prioritize`/`.avoid` into `application_recommendations` rows under a new `strategy-roadmap` category — no new AI call, reconciled by (category, title) via a generalised `reconcileSeeds` (extracted from `reconcileRecommendations`, which is now a thin wrapper over it), so re-clicking after the report regenerates updates the same tasks instead of duplicating them. Same PR also fixed a recommendation detail page crash on a malformed genUI `content_schema` — `parseContentBlock`/`parseContentBlockValue` now validate the full shape via zod instead of only the `type` field. See `docs/known-issues.md §5i`. | The Matching Report is now a stable "home" for an application instead of a moving target. A student reading the Personalized Strategy report can turn its roadmap directly into trackable Planner tasks with one click. A malformed task no longer crashes the detail page. |
| `06efde1` (#165) | **Fixed `/strategy/analysis/portrait` and `/strategy/analysis/fit` 404ing for every application, and merged the duplicate navigation bar.** Reported same-day, right after §0d/§0e/§0f were confirmed closed: both report pages 404'd. Root cause was not a migration gap — `load-evaluation.ts` selected `tuition_fee`/`entry_requirements_summary`/`english_requirements_summary`/`image_url`/`logo_url` directly off `course_applications`, but the live table (`supabase-apply-v2.sql`'s UUID-id schema) never had those columns; they exist on `courses` (via `course_id`, following the same join `application-workspace.ts` already uses) and `universities`. A stale, superseded `CREATE TABLE IF NOT EXISTS course_applications` in `supabase-apply-system.sql` (a TEXT-id schema) does have all five, which is how the mismatch went unnoticed by the schema-dump reconciliation. See `docs/known-issues.md §5h`. Also removed the redundant black `StageBar` the three report pages rendered under the layout's red `ApplicationNav` bar (same five-ish destinations, occasionally disagreeing on what was unlocked), and changed `SubNav` so a locked entry is omitted rather than shown dimmed, per explicit product direction. | Both reports load again for every application. One navigation bar instead of two stacked bars; a student only ever sees destinations they can actually open. |
| `19a5d7c` (#163) | **Added application deletion and multi-course-per-university support.** `DELETE /api/applications/[id]` is new (auth + owner-scoped; every child row — stages, tasks, the Personal/Matching/Personalized Strategy reports, CV/statement strategy work — is `ON DELETE CASCADE` off `course_applications.id` except `personal_statements.application_id`, which is `SET NULL`, so one delete is enough). `my-application-section.tsx`'s `ApplicationRow` gained a "Delete" action (confirmation modal, names what's removed, irreversible) and an "Add another course" action (shown when `app.universityId` is known) that reuses the existing `/api/applications/from-course-url` endpoint — its duplicate check is already `(user_id, course_url)`, not university, and `user_universities` (the saved-list model "Plan my application" reads from) has `UNIQUE(user_id, university_id)` with one `program` column, so this was already the only path to a genuinely independent second application at the same university without a schema change. | Students can remove an application they no longer want tracked, and can track a second course at a university they've already applied to elsewhere on the site, without going through the saved-list's one-subject-per-university model. New `src/app/api/applications/[id]/route.test.ts` covers the DELETE handler's three outcomes (deleted / not found or not owned / db error). |
| `59c334e` (#159) | Fixed a same-day production incident (the fourth on the checklist/F7 feature that day, and the root cause of the whole day's trouble): `personal_summary_completed_at`/`achievements_completed_at` (`student_profiles`) were **never written by any code in this repository** — confirmed by a full-repo grep, three read sites and zero writes. Every student's reflections were permanently "incomplete" no matter how many times they submitted both steps, which is what made §5e/§5f's symptoms possible in the first place and would have made a student finishing achievements bounce straight back to reflections in an infinite loop even after those fixes. Also fixed: Overview's CTA (§5f's fix) pointed at "whatever the real next step is," which for a returning student resolved straight to the analysis-trigger gate, skipping reflections anyway — reported the same day as "it goes straight into doing the strategy building." And wired `?return=` through the reflection forms' submit handlers (§5f's flagged-but-unfixed gap), for the application-originated case specifically. See `docs/known-issues.md §5g`. | `POST /api/reflection` now sets both completion timestamps on submit. `strategy/page.tsx`'s Overview CTA always targets the reflection flow's start, unconditionally. `reflection-about-form.tsx`/`reflection-evidence-form.tsx` now read and carry forward `?return=`, landing a student back at their application's analysis gate after reflections instead of an old per-student report page — every other (non-application) entry point into those forms is unchanged. |
| `b610087` (#158) | Fixed a same-day production incident: Overview was only shown to a student with neither reflection step done, so a returning student (reflections globally already marked complete) skipped it entirely. See `docs/known-issues.md §5f`. | `strategy/page.tsx` gated Overview on `!state.aiAnalysisComplete` (per-application) instead of the shared reflection flags; `/apply/[applicationId]/page.tsx` simplified to bounce to `/ai-strategy/[id]/strategy` rather than duplicating the decision. |
| `dac93c0` (#157) | Fixed a same-day production incident: `fetchOnboardingState`'s `aiAnalysisComplete` only checked the Personal Report, not the Matching Report, letting an incomplete analysis reach the F7 page. See `docs/known-issues.md §5e`. | `aiAnalysisComplete` now requires both reports; the F7 workspace redirects to the analysis gate on a `needsInputs` response instead of retrying the same doomed call. |
| `573db50` (#156) | Retired the free `/apply/[applicationId]` checklist/match-insights UI (now a pure onboarding redirect) and built F7 "Personalized Strategy" — a new, separate, read-only, downloadable-PDF report page, deliberately distinct from the task-tracking Planner. | Clicking into an application lands wherever the student actually is in the gated pipeline (Reflection → Personal Report → Matching Report → Personalized Strategy → Planner). New `application_strategy_recommendations` table; one new OpenAI call synthesising the Personal Report and Matching Report into six sections, written in English by product decision. |
| `f845ddb` | Added genUI content blocks to AI-generated recommendations. | Every recommendation's detail page body now comes from one of three AI-chosen shapes (`structured_table`/`long_text`/`checklist`) declared at generation time, or none when the task routes to a tool. Its migration (§0d) is now confirmed run in production as of 2026-08-12. |
| `de4a7fe` | Made Planner List/Calendar/Board view switching client-side. | Switching `?view=` no longer refetches the dynamic server page; the URL remains bookmarkable while the UI changes immediately. |
| `169ca25` | Centralized optimistic Planner state and added deadline editing to the list. | Status and deadline edits appear in all three planner views without a reload; failed writes roll back per edit. |
| `8d3da8f` | Put the brand-red application context bar on the six primary per-application surfaces. | Overview, Personal Report, Matching Report, Planner, CV builder, and Statement now expose a consistent way back to the rest of the application. Route groups changed file placement only; public URLs did not change. LOR intentionally remains outside this six-item bar. |
| `2acd09e` | Moved the CV Builder target-profile, generation, and review calls to OpenAI and made English the source UI language. | `OPENAI_API_KEY` now powers those CV paths; Vietnamese remains available through the static i18n dictionary. Other AI routes still use a mix of OpenAI and DeepSeek. |
| `01397eb` + `7cd8261` | Split product help from Strategy. | `/how-it-works` explains the whole product; `/ai-strategy` explains stage 3. The global nav points to the help page, while application surfaces link into Strategy. |

## What is built now

### Student journey

- Discovery: `/universities`, numeric university details, `/scholarships`,
  `/mentors`, mentor profiles, `/news`, and the public marketing pages.
- Scholarship handoff: saving an award with one linked university adds both
  records immediately. Multi-university awards require choosing one of their
  structured links; unlinked country/provider/consortium awards require choosing
  a directory university and explicitly warn that official eligibility still
  needs checking. Only scholarship rows with a real saved-university destination
  count toward the sticky saved total and the `/apply?focus=` handoff.
- Onboarding and profile: the onboarding flow plus the profile subpages remain
  the source of student context.
- My Portal: `/apply` is the post-login landing and combines saved universities
  with application progress. The bare `/my-universities` permanently redirects
  to `/apply`; its subject picker and legacy task children still exist. Each
  application row now has **Delete** (real, cascading, confirmed in a modal —
  not the `status='archived'` soft-delete the schema has a column for but no
  code ever wrote) and, when the row has a `university_id`, **Add another
  course** (pastes a second course URL through the existing
  `from-course-url` endpoint, independent of the saved-list's
  one-subject-per-university model). Each row also carries a **scholarship
  drawer** (`src/app/apply/application-scholarships.tsx`, 18/08): the awards
  chosen for that row's university, shown as coupon-style tickets under the
  row, with a multi-select picker that writes straight to `user_scholarships`.
  It is keyed by **university**, not by application — `user_scholarships` has
  no `application_id` and none was invented — so two applications at one
  university show the same awards, and a change here also changes the saved
  list below. A row with no `university_id` gets no drawer.
- Per-application work: `/apply/[applicationId]` is now a pure redirect (no
  checklist UI of its own) — it sends the student to wherever they are in the
  onboarding pipeline via `fetchOnboardingState`/`nextOnboardingStep`, unless
  the analysis already exists, in which case it goes straight to the Matching
  Report (see below). The pipeline now has a **Review & Confirm** checkpoint
  (`/ai-strategy/reflection/confirm`) between finishing Achievements and
  running analysis: candidate information is locked on confirmation, the two
  reflection pages switch to read-only views once locked, and every analysis
  route guard redirects a not-yet-confirmed student back to this checkpoint. The shared application navigation exposes Personal
  Report, Matching Report, **Personalized Strategy**, Planner, CV builder, and
  Statement — a locked entry is omitted from the bar rather than shown dimmed.
  The analysis and planner pages live below `/ai-strategy/[applicationId]/strategy/*`.
  The band itself carries a low-key looping canvas animation behind the
  breadcrumb/nav text (`ApplicationNavBackground`,
  `src/components/application-nav-background.tsx`) — a "Go" → "Gooooo…"
  typing reveal settling into two "Glow"/"GlowBal" marquee rows crawling in
  opposite directions, with an occasional per-instance flash — sized to the
  header's own height (no added space) and kept at low opacity so it reads
  as texture, never competing with the real white nav text on top. Purely
  decorative, `aria-hidden`, gone under `prefers-reduced-motion`.
- **The Matching Report is the application's home once it exists**, not a
  step in a funnel. `/ai-strategy/[applicationId]/strategy` (what "Overview"
  and `/apply/[id]` both bounce through) used to keep auto-advancing a
  returning student through intro → strategy → dashboard every visit; now,
  once `aiAnalysisComplete`, it always lands on `/strategy/analysis/fit`,
  for every application, regardless of how far the student has gone since.
  Personalized Strategy and the Planner are reached deliberately through the
  nav bar now, which is also the only thing gating them.
- Strategy: applicant portrait, programme-fit report, the **Personalized
  Strategy report (F7)** — a separate, read-only, downloadable-PDF report,
  not part of the Planner — recommendation board, recommendation
  detail/coach/evidence flows, and List/Calendar/Board planner views are
  implemented. F7's Roadmap tab has an **"Add to Planner" button**
  (`generateRoadmapTasks`) that turns `roadmap.prioritize`/`.avoid` into
  Planner tasks under a new `strategy-roadmap` category — reconciled by
  (category, title) the same way the existing Match-Analysis-driven
  generator is, so re-clicking after a regenerate updates in place rather
  than duplicating. A recommendation's `content_schema`/`content_value`
  (the detail page's genUI body) are now fully shape-validated on read
  (`contentBlockSchema`/`contentValueSchema` in `recommendation.ts`) — a
  malformed row degrades to no content block instead of crashing the page.
- Documents: CV hub/import/content/layout/review/target-profile flows, the
  OpenAI-backed CV Builder compatibility routes, Statement feedback, LOR
  recommender strategy, and the nine-dimension LOR quality review are present.
- Earlier report routes (`/ai-strategy/report` and
  `/ai-strategy/matching[/applicationId]`) remain implemented alongside the
  newer application-specific portrait and fit routes. Do not assume the two
  generations are interchangeable when changing navigation or persistence.

### Platform and operations

- Supabase SQL is stored as standalone `supabase-*.sql` files; this repository
  still has no ordered migration runner. Repository presence does not prove a
  migration is live.
- CI runs base typecheck, strict typecheck, lint, coverage-gated Vitest, and a
  production build. Playwright E2E runs on pull requests and uploads its report
  on failure; it deliberately does not gate the daily GEO push to `main`.
- GEO content generation and publication remain a separate scheduled pipeline.
- The pre-launch site lock is controlled by `SITE_LOCK_ENABLED`; API routes,
  cron routes, and webhooks bypass it and therefore need their own auth.

## Architecture facts and current gaps

- The intended shape is `app` → feature API/domain/UI/hook slices → shared/server
  leaves, with legacy `src/components` and `src/lib` still load-bearing.
- The current feature directories are `ai-strategy-dashboard`,
  `application-strategy`, `apply`, `auth`, `marketing`, `mentorship`,
  `onboarding`, `scholarships`, and `universities`.
- `eslint.config.mjs` enforces Feature-Sliced boundaries for all of those except
  **`ai-strategy-dashboard`**, which is absent from its `FEATURES` registry.
  That feature currently imports `@/features/apply/hooks`, so adding it to the
  registry is not a mechanical one-line change; decide where the shared upload
  behavior belongs first.
- Two pages remain in the admin-client debt allowlist:
  `src/app/admin/page.tsx` and `src/app/plus/success/page.tsx`.
- AI provider use is mixed, not a fallback ladder. CV Builder and several
  strategy paths use OpenAI; LOR, Personal Report, Match Insights, and other
  legacy paths still use DeepSeek. A failure of one provider does not
  automatically fail over to the other.
- `.env.example` documents `OPENAI_API_KEY` but not `DEEPSEEK_API_KEY`, even
  though live routes require the latter. Treat environment setup documentation
  as incomplete until that is reconciled.

## Verification snapshot

Latest task-specific measurement, on 2026-08-15 after the UX/navigation
correction pass (application-return navigation, reflection breadcrumb +
stepper, four-category taxonomy, low-effort reflection UX — see the top row
of "Last completed work"):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Pass**, 0 errors. |
| `npx tsc -p tsconfig.strict.json --noEmit` | **Pass**, 0 errors. |
| `npx eslint .` | **Pass: 0 errors, 24 warnings, all pre-existing and unrelated to this session's changes.** One real error caught and fixed mid-pass: `activity-reflection-modal.tsx` was calling `setState` synchronously inside a `useEffect` (`react-hooks/set-state-in-effect`); rewritten to the "adjust state during render" pattern instead. |
| `npx vitest run` | **Pass: 2337 passed, 2 todo, 250 files passed, 0 failed** (was 2317/246 before this pass's new test files: `return-path.test.ts`, `_application-return.test.tsx`, `candidate-information-steps.test.ts`, `reflection-breadcrumb.test.tsx`, plus a full rewrite of `activity-reflection.test.ts` for the new four-category domain shape). |
| `node scripts/check-i18n.mjs --all` | **Pass: 0 missing keys**, 0 placeholder mismatches, after adding ~60 EN/VI entries to `i18n-application-flow.ts` for this pass's new copy. |
| `npm run build:ci` | **Pass**, all routes compile — but only after a real fix: `shared/ui/use-autogrow-textarea.ts` used `useRef`/`useLayoutEffect` without a `'use client'` directive. `tsc`, `eslint`, and `vitest` (jsdom) all passed with that bug present; only the actual Next.js Turbopack build caught it, because a Server Component transitively importing the hook is invalid regardless of what the hook does at runtime. Worth remembering `build:ci` is part of `verify:pr`/CI for exactly this class of bug — the three faster checks are not a substitute for it. |
| `npm run test:e2e` | Not rerun in this pass. |
| Manual browser check | **Not run this pass** — same sandbox limitation as prior entries (no connected browser instance). Next manual step: from an application's Activities & Achievements page, open a category card, answer a couple of dimensions, navigate away via the breadcrumb, and confirm both the breadcrumb and the modal resume at the same unfinished dimension; separately, open `/profile/academic` from inside an application's Review Profile page, save, and confirm it returns to that application (not `/profile`) with the "✓ updated" banner visible. |

Prior snapshot, on 2026-08-14 after fixing the three
remaining `?return=`-dropping entry points into the Personal Report (see the
top row of "Last completed work" and `known-issues.md §5u`):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Pass**, 0 errors. |
| `npx tsc -p tsconfig.strict.json --noEmit` | **Pass**, 0 errors. |
| `npx eslint .` | **Pass:** 0 errors, 24 warnings, all pre-existing and unrelated to this session's changes. |
| `npx vitest run` | **Pass: 2223 passed, 2 todo, 234 files passed, 0 failed.** |
| `node scripts/check-i18n.mjs --all` | **Pass: 0 missing keys**, 0 placeholder mismatches (no new user-facing strings this pass). |
| `npm run build` / browser check | **Not run this pass** — same sandbox limitation noted in prior entries (no `SUPABASE_SERVICE_ROLE_KEY`, no connected browser instance). Manual next step: from a confirmed application with existing reports, click "Continue" on the read-only Reflections view and confirm the Personal Report now shows its nav band; click "Add more detail to your existing activities" and confirm it opens the (editable, if this application isn't itself confirmed) achievements page instead of a read-only one. |
| `npm run test:e2e` | Not rerun in this pass. |

Prior snapshot, measured 2026-08-14 after the PR #192 review
follow-up: two focused files passed 12/12 Vitest tests; targeted ESLint and
strict TypeScript passed; `node scripts/check-i18n.mjs` reported 0 missing keys
and 0 placeholder mismatches; and `git diff --check` passed. Base TypeScript
reaches only the unrelated admin-news errors caused by the declared
`@mdxeditor/editor` package being absent from the current `node_modules` (plus
the resulting implicit-any callback). `npm run build` is blocked by the same
missing package after starting the Next.js 16.2.3 production build. No browser
or E2E run was needed for this state/auth/i18n regression follow-up.
Latest task-specific measurement, on 2026-08-14 after the Personal Report
nav/i18n/inline-answer/matching-report-link fixes (see the top row of "Last
completed work" and `known-issues.md §5s`):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Pass**, 0 errors. |
| `npx tsc -p tsconfig.strict.json --noEmit` | **Pass**, 0 errors (including the pre-existing `exactOptionalPropertyTypes` fix described above). |
| `npx eslint .` | **Pass:** 0 errors, 24 warnings, all pre-existing and unrelated to this session's changes. |
| `npx vitest run` | **Pass: 2213 passed, 2 todo, 232 files passed, 0 failed.** |
| `node scripts/check-i18n.mjs --all` | **Pass: 0 missing keys**, 0 placeholder mismatches (~10 new EN/VI pairs added, including 3 version-history trigger labels caught by the dynamic-catalog scan). |
| `npm run build` / browser check | **Not run this pass** — same sandbox limitation noted in prior entries (no `SUPABASE_SERVICE_ROLE_KEY`, no connected browser instance). Manual next step: open a real application's confirm screen, verify the Personal Report no longer shows "failed" after a routine profile edit on a second application; generate a Matching Report and confirm the Personal Report picks up a new version; open the version-history dropdown and confirm an older version renders read-only. |
| `npm run test:e2e` | Not rerun in this pass. |

Prior snapshot, measured on 2026-08-14 after the Personal Report
nav/i18n/inline-answer/matching-report-link fixes (`known-issues.md §5s`):
base and strict TypeScript passed; targeted ESLint passed; 2178 Vitest tests
passed across 227 files; i18n check passed with 0 missing keys. Browser
verification was not done that pass either.

The prior broad snapshot below was measured on 2026-08-14 after the
scholarship → My Portal handoff repair and PR review follow-up: base and
strict TypeScript passed; targeted ESLint passed; four focused files passed
13/13 Vitest tests; `node scripts/check-i18n.mjs` reported 0 missing keys and
0 placeholder mismatches; and `npm run build` passed on Next.js 16.2.3
(122/122 static pages generated). The in-app browser had no connected
browser instance, so the signed-in visual flow and E2E were not run.

The earlier broad snapshot below was measured on 2026-08-13 against its
then-current uncommitted working tree (`npx` invocations, equivalent to the
`npm run` scripts):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Pass**, 0 errors. |
| `npx tsc -p tsconfig.strict.json` | **Pass**, 0 errors. |
| `npx eslint .` | **Pass:** 0 errors, 23 warnings, all pre-existing and unrelated to this session's changes. |
| `npx vitest run` | **Pass: 2008 passed, 2 todo, 199 files passed, 0 failed.** New/updated: `app-routes.test.ts` (the Overview↔Reflections swap in `applicationSubNav`, the locked-until-confirmed edge case, `activeSubNavKey` for all three reflection routes), new `review-confirm-view.test.tsx` (read-only banner, Continue link, hidden confirm panel/edit links), `confirmed-reflection-view.test.tsx` and `confirmed-achievements-view.test.tsx` (updated for the `returnTo` → `continueHref` prop rename). |
| `node scripts/check-i18n.mjs` | **Pass: 0 missing keys** (2 new keys added — the read-only Review & Confirm banner copy). |
| `npm run build` / browser check | **Not run this pass** — same sandbox limitation noted in prior entries (no `SUPABASE_SERVICE_ROLE_KEY`). This pass touches the Candidate Information confirm route guard and the application nav bar — a real browser click-through (confirm an application → click "Reflections" in the nav → verify the read-only summary renders instead of bouncing away, and "Continue" lands on report generation or the Personal Report as appropriate) is the priority next verification step. |
| `npm run test:e2e` | Not rerun in this pass. |

**Previously-open thread, now resolved**: the user reported "report creation
still isn't working" after four same-day fixes (§5e-§5g) had already
shipped, with no specific error at first. They then supplied a real Vercel
function trace (`POST /api/applications/[id]/match-insights` → 503) showing
`GET student_personal_reports` → 404 and `POST application_match_analyses`
→ 400 — the exact failure §0e predicted. They then ran the migration and
pasted the resulting production schema, confirming §0d/§0e/§0f are now all
applied. This is real, hard evidence — not the usual "should be fixed now"
— so treat the migration side of this incident as closed. A manual
click-through of the full flow (Overview → reflections → achievements →
analysis → intro → Personalized Strategy → Planner) on a genuinely fresh
student account has still not been done by anyone and remains the one
verification step nobody has done yet, though the migration gap that would
have blocked it is gone.

**Immediately after that**, the owner reported the Personal Report and
Matching Report both 404ing on a real application, plus two stacked
navigation bars on the strategy pages (screenshot attached). Neither was a
migration issue — see `docs/known-issues.md §5h` for the column-mismatch
root cause and the nav-bar merge. Both fixed this pass; the manual
click-through above still has not happened and remains the best next
verification step, now with one fewer known-broken page in the path.

## Open risks that still deserve priority

### AI Planner production bootstrap (working tree)

The canonical Planner hierarchy can now be generated in production only by an
authenticated admin, and only for that admin's own application. The route
enforces same-origin POSTs, UUID validation, the existing admin guard, and
the existing application ownership check. Non-admins see the established
legacy Planner until their canonical hierarchy has been created through the
normal product flow.

The planning source adapter accepts legacy `course_applications` schemas where
optional metadata (such as `application_method`) has not been deployed; the
application is read as a row and absent optional fields are treated as absent.

### AI Planner productionization (working tree)

The production canonical path now uses one Plus/admin entitlement boundary and
automatically ensures a canonical plan on the application Planner route. It
does not show legacy task-category execution UI for canonical users. The first
real deterministic input is an attention-focus `single_select` with a declared
semantic key: only a valid selected value may complete that task, and saving it
runs the existing deterministic pipeline again. Status/deadline changes do not
recompute the plan. The read model now exposes a lifecycle and an explicit
complete state rather than an empty task list.

`supabase-canonical-planner-production.sql` must be applied after
`supabase-core3-plan-hierarchy.sql` before deploying this code. It is a new
follow-up migration (not a rewrite of the earlier file): it revokes client-side
canonical writes and installs the service-role-only transactional reconciliation
RPC required by production `syncApplicationPlan()`.

For the complete Planner Ops/hardening deployment, apply migrations in this
order: `supabase-core3-plan-hierarchy.sql`,
`supabase-canonical-planner-production.sql`, `supabase-planner-ops.sql`,
`supabase-planner-production-hardening.sql`, then the forward-only terminal
repair `supabase-planner-production-hardening-multi-microstep-fix.sql`. The
terminal repair uses a dedicated micro-step UUID variable while retaining
hardening's application lock and content-value compatibility/reset logic. The
older `supabase-canonical-planner-multi-microstep-fix.sql` is only the repair
for an installation that has not applied hardening; it must not follow
hardening.

The dated audit remains the detailed evidence record. A code-only recheck on
2026-08-06 found no commit that obviously closes its highest-priority items:

- `/api/translate` is still an unauthenticated OpenAI-backed translation path.
- `/api/newsletter/notify` still needs a fail-closed secret check to be treated
  as safe independently of deployment configuration.
- the Next.js course-import path still needs the same SSRF protections as the
  Python ingestion service;
- `src/server/observability/index.ts` is still a placeholder, so there is no
  centralized alerting or structured error pipeline;
- Plus fulfilment still depends on the success page rather than a Stripe
  webhook/reconciliation path;
- live migration and stranded-job claims were not re-queried during this docs
  pass. Revalidate production before repeating the audit's counts as current.

See [audit-2026-08-03.md](audit-2026-08-03.md) for the point-in-time audit and
[known-issues.md](known-issues.md) for historical traps and regression notes.

3c0a5b6 (2026-08-26): completed Personal Report Task 8 wiring: application-scoped generation reads one confirmed snapshot, persists analysis/evidence/report lineage, validates the 150-200-word snapshot contract, handles cache/force/idempotency and deterministic fallback, and passes applicationId through report-generation callers. Measured: focused 71/71 tests, `npm.cmd run typecheck`, scoped ESLint, and `npm.cmd run build` pass. Strict typecheck remains blocked by pre-existing errors in matching/canvas UI and an evidence-bank test.

2026-08-26 application Personal Report Tasks 9–12: Task 9 history reads and version routes committed as `c952d69`; Task 10 downstream report lineage committed as `2114eb7`; Task 11 application-scoped Personal Report UI/evidence wiring committed as `1749ca8` with the regeneration/read-only hardening follow-up in `a10c294`; Task 12 isolation/concurrency integration coverage is committed with the task log. Measured: report/evaluation/evidence/AI suite 80 files/822 tests passed, focused application/report suite 11 files/70 tests passed, integration fixture 3/3 passed, `npm.cmd run typecheck` passed, scoped ESLint passed, and `npm.cmd run build` passed with existing Turbopack filesystem-tracing warnings. A clean worktree then passed the complete Node 24.19.0 `npm.cmd run verify:pr` gate: 345 test files, 3276 passing tests/2 todo, both typechecks, ESLint 0 errors/7 warnings, coverage, and production build. Owner applied `supabase-application-personal-report-state.sql`; read-only schema verification confirmed all 7 new tables, required lineage columns/types, and 24 legacy rows retaining `application_id = NULL`, without production writes. GitNexus was refreshed at `dac508e`; impact review reports critical graph fan-out for the shared orchestrator and canonical route, with focused tests and the full gate passing. Authenticated cross-user RLS behavior remains unverified because no non-production/local database is configured; do not treat the live read-only schema check as proof of that behavior.

2026-08-28 Personal Canvas overflow fix (working tree): navigation previews now compact verbose model output and apply line clamping/overflow clipping to every canvas card, while full findings remain in the existing portal modal. Added a regression test for long Core Identity output. Measured: `personal-canvas.test.tsx` 14/14 passed and scoped ESLint passed; repository typecheck remains blocked by four existing matching errors (`reasoner.ts`, `v3-scoring.ts`).

2026-08-29 Personal Report narrative/latency guard: raw Q1–Q7 answers now go only to a dedicated AI normalization extractor, which returns short findings and rejects near-verbatim copies. The report and prose writer receive normalized findings plus scoped evidence IDs, never raw reflection text; activity-level motivation is likewise represented as a finding, not quoted. Narrative synthesis was reduced from three duplicated-payload calls (7,800 max completion tokens) to two scoped concurrent calls (3,600), and a request-time leased worker starts immediately after enqueue while Vercel Cron remains the durable fallback. Versions are `report-synthesis-v7-scoped-fast-narrative` and `personal-report-extraction-v8-normalized-reflections`, forcing a fresh report. Measured: focused report/queue/route regressions 83/83 passed, full Vitest passed 370 files / 3492 tests with 2 todo, base and strict typecheck passed, lint passed with 0 errors and 5 pre-existing warnings, and build:ci passed with 3 existing `geo-content.ts` tracing warnings.

2026-08-29 Matching Report V3 (working tree): implemented the additive V3 contract, structured Applicant Context, expanded target profiles, deterministic hard-requirement checks, provenance/reference validation, current-input-only scoring, metric reuse, one-call summary/takeaways, V3-first persistence/read paths, Strategy downstream consumption, and V3 UI with V2/legacy fallback. The existing `application_match_analyses.report_v2` JSONB column remains the versioned storage envelope; no database migration or external state change is required. Scholarship alignment remains explicitly unassessed when no canonical selected scholarship exists. See [matching_report_v3_agent_prompt.md](plans/matching_report_v3_agent_prompt.md) for the task contract.

Measured: `npm.cmd test` passed 370 files / 3492 tests with 2 todo; focused V3/matching/target/UI/Strategy suites passed; base and strict typecheck passed; `npm.cmd run lint` passed with 0 errors and 5 existing warnings; `node scripts/check-i18n.mjs --all` reported 0 missing keys, 0 placeholder mismatches, and 0 dynamic catalog misses; `npm.cmd run build:ci` passed 141 static pages with 3 existing `geo-content.ts` tracing warnings; `git diff --check` passed. Personal Report and Matching Report V3 changes are committed together because both are part of this application-report flow.

2026-08-29 course catalogue link fix (working tree): applications created from a saved university or a pasted course URL now resolve an existing `courses.id` by canonical programme URL, then exact programme name, before insertion. This closes the legacy-parser gap where `course_id` stayed null even after parsing, and lets known catalogue data remain usable when the source page is temporarily blocked. The affected VinUniversity application was repaired to catalogue course `c0a00000-0000-4000-a000-000000000004`; its separate page-fetch failure remains honestly marked `parse_status = failed`. Measured: resolver tests 2/2, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-29 Matching Report retry fix (working tree): the confirmation workspace now retries the full Matching Report read/create cycle once immediately after an HTTP, response, or network failure, instead of exposing a failed state after one attempt. Manual retry remains available after both attempts fail. Measured: `analysis-workspace.test.tsx` 12/12, scoped ESLint, and base typecheck pass.

2026-08-29 Matching Report sparse-target fix (working tree): V3 now marks each metric `not_available` without calling the model when its target profile has no source-backed facts. This prevents confident model output with no target grounding from being rejected by the provenance validator, while preserving explicit missing-data state. Measured: matching suite 98/98, V3 regression 4/4, scoped ESLint, and base typecheck pass.

2026-08-29 Matching Report lineage fix (working tree): the application-scoped V3 composer call now receives `targetProfileSchemaVersion` and `personalReportInputHash` at the top level required by its contract; previously they existed only inside `lineage`, causing every production composition to fail before AI generation. Measured: matching generation/V3 suites 24/24, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-29 Matching Report summary reference fix (working tree): the summary model now receives explicit `evidenceIds`, `targetSourceRefs`, and `metricIds` allowlists, while the same cross-reference checks run inside the Zod schema so the shared one-attempt repair can correct unknown IDs. Previously the prompt omitted those lists and post-generation validation failed with `V3 summary returned an unknown evidence id.` Measured: V3 suite 5/5, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-29 Matching Report validation-log fix (working tree): observability now preserves `StructuredGenerationError.issues` string summaries instead of treating them as Zod issue objects and logging every failure as `root: Invalid`. Added regression coverage for the real cross-reference issue format. Measured: observability suite 27/27, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-29 Matching Report evidence-ref mapping fix (working tree): Applicant Matching Context now canonicalizes legacy `achievement:<id>` references from Personal Report output to the matching Evidence Bank claim ID (for example `experience:<id>`), using the claim's source refs; refs with no canonical claim are omitted. This prevents deterministic competitive-advantage candidates from feeding source IDs into V3 summary provenance validation. Measured: matching context/V3 suites 7/7, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-29 Matching Report missing-evidence wording fix (working tree): V3 summary validation now blocks only explicit claims that the applicant/candidate/student is unable or incapable, while allowing neutral data-limit wording such as “unable to establish from the available evidence.” The summary prompt states the preferred wording and the V3 prompt/bundle versions are bumped to `3.1.1`. Measured: reasoner/V3 suites 20/20, scoped ESLint, base typecheck, and `git diff --check` pass.

2026-08-30 Matching Report V3 UI detail fix (working tree): the canonical V3 page now renders the four canonical Programme Fit metrics without duplicating University Academic Readiness, uses report-generated summaries/alignment instead of hardcoded copy, exposes metric status/coverage/confidence and expandable submetrics with reasoning, shows strengths/gaps/positioning opportunities, scholarship alignment, evidence/source records, and hard-requirement applicant/required values plus deadline status. V2 and legacy callers retain the existing optional-prop behavior. Measured: Matching UI/AI suites 11 files / 116 tests passed, base and strict typecheck passed, scoped ESLint passed, and `npm.cmd run build:ci` passed with the existing 3 `geo-content.ts` tracing warnings. The i18n audit currently reports 79 static missing Matching keys (dynamic catalog misses: 0); the newly added V3 keys are cataloged.

2026-08-30 Matching Report UI density pass (`4f231c71`): redesigned the V3 fit cards into compact score/metric layouts with insights below, removed equal-height column stretching that created large blank areas, and collapsed long report summaries, evidence records, and insight descriptions behind accessible disclosures while keeping full content available. Measured: Matching UI/AI suites 11 files / 116 tests passed, strict typecheck passed, scoped ESLint passed, and `npm.cmd run build:ci` passed with the existing 3 `geo-content.ts` tracing warnings. No data or report-generation behavior changed.

## Handoff protocol

After material work, update this file in the same change:

1. move the code snapshot to the new commit or say `working tree` if uncommitted;
2. add the completed work and its user/system impact;
3. record migrations, environment changes, and any externally applied state;
4. record exact verification results and blockers;
5. remove or rewrite risks that the change actually closed;
6. link a detailed design, plan, or incident note instead of turning this file
   into a chronological diary.
## 2026-08-30 — Strategy V3 accepts canonical target requirement references

- Root cause: target-profile requirements use canonical IDs such as `adm:academic_entry_requirement`, while Matching V3 exposes transformed criterion IDs in `matching.hardRequirements`; Strategy V3 validated only the latter even though the model receives the former in `target.requirements`.
- Fix: profile and final Strategy report validation now use a strict union of target requirement IDs and Matching hard-requirement IDs. Arbitrary model-generated IDs remain rejected.
- Regression coverage: `src/lib/ai/strategy-v3/engine.test.ts` verifies the reported target requirement ID passes profile provenance validation.
- Measured checks: `npx vitest run src/lib/ai/strategy-v3 src/app/api/applications/[id]/strategy/recommendation/route.test.ts` (3 files, 13 tests passed); `npx eslint src/lib/ai/strategy-v3/engine.ts src/lib/ai/strategy-v3/engine.test.ts src/lib/ai/strategy-v3/context.ts src/lib/ai/strategy-v3/context.test.ts` passed; `npx tsc --noEmit` passed; `git diff --check` passed with only existing LF/CRLF warnings.

## 2026-08-30 — Strategy V3 restores canonical Evidence Bank claims

- Root cause: Strategy treated the stored Evidence Bank object as an array, so its canonical `experience:*`, `academic:*`, `follow_up:*`, `supplement:*`, and `competency:*` claims were omitted when the persisted Matching evidence index was incomplete; snapshot activity IDs also lacked the canonical `experience:*` alias.
- Fix: Strategy context now reads stored Evidence Bank `claims` and derives canonical experience aliases from the confirmed snapshot. The existing strict reference validation remains in place.
- Regression coverage: `src/lib/ai/strategy-v3/context.test.ts` verifies both stored claims and snapshot experience aliases.
- Measured checks: `npx vitest run src/lib/ai/strategy-v3 src/app/api/applications/[id]/strategy/recommendation/route.test.ts` (3 files, 14 tests passed); `npx eslint src/lib/ai/strategy-v3/context.ts src/lib/ai/strategy-v3/context.test.ts src/lib/ai/strategy-v3/engine.ts src/lib/ai/strategy-v3/engine.test.ts` passed; `npx tsc --noEmit` passed; `git diff --check` passed with only existing LF/CRLF warnings.

## 2026-08-30 — Strategy V3 scopes activity analysis per batch

- Root cause: each activity request contained all canonical activities inside `context.activities` plus the current batch in a second field, leaving the model with two competing scopes and causing missing or duplicate analyses.
- Fix: each activity request now sends only its batch in both context and activity fields, includes an explicit `requiredActivityIds` checklist, and updates the activity prompt version.
- Regression coverage: `src/lib/ai/strategy-v3/engine.test.ts` verifies multi-batch generation and that both activity scopes match the required IDs.
- Measured checks: `npx vitest run src/lib/ai/strategy-v3 src/app/api/applications/[id]/strategy/recommendation/route.test.ts` (3 files, 15 tests passed); `npx eslint src/lib/ai/strategy-v3/engine.ts src/lib/ai/strategy-v3/engine.test.ts src/lib/ai/runtime/prompt-registry.ts` passed; `npx tsc --noEmit` passed; `git diff --check` passed with only existing LF/CRLF warnings.

## 2026-08-30 — Strategy V3 lineage, Planner, grounding, and runtime hardening (working tree)

- Strategy UI now ensures the current POST/hash lineage before rendering; the API fails closed with `strategy_v3_stale_inputs` when Matching declares an unavailable target-profile version, and cache hits require the complete current lineage plus engine/contract/formula/prompt/model inputs.
- Strategy V3 is now a first-class Core 3 Planner source. Its semantic deliverable IDs flow through the existing reconciliation layer, which preserves student execution fields, avoids duplicate syncs, updates same-key wording, and archives removed nodes; F8/F7 remain fallback sources.
- Evidence status follows the canonical Evidence Bank distinction (document-backed/test-backed vs applicant-stated/report-only). Deterministic priorities now use structured references, consolidate overlapping candidates, validate structured durations, and emit stable non-positional deliverable keys. Sparse core narratives may have empty evidence IDs when no causal evidence exists.
- Override PUT failures now rollback optimistic edits and show an explicit error; `Editable` synchronizes incoming values in an effect; internal `rawPriority` is hidden from the applicant UI.
- Measured checks: Strategy/Planner/UI scope 13 files / 90 tests passed; `npm.cmd run typecheck` passed; `npm.cmd run build:ci` passed (141 static pages, existing Edge/dynamic-filesystem warnings); `git diff --check` passed with only LF/CRLF warnings. Full `npm.cmd test` returned 3542 passed, 2 todo, 8 failures outside this change's files (including existing UI/i18n/auth test timeout/assertion failures). Full `npm.cmd run lint` returned 15 existing raw-hex errors in `src/features/apply/ui/matching-report/key-takeaways-grid.tsx` plus 5 warnings; touched Strategy files pass targeted ESLint.

## 2026-08-30 — Strategy V3 limits activity-stage token bursts (working tree)

- Root cause: activity batches were sent concurrently and each repeated the full Strategy context, so concurrent GPT-5.6 Luna requests exhausted the organization TPM limit and returned 429.
- Fix: activity batches now run sequentially, send a compact batch-only model context, and use a 6,000-token completion budget; strict one-result-per-canonical-activity and reference validation remain unchanged.
- Regression coverage: the multi-batch engine test now verifies batch scoping, compact context, and the activity token budget.
- Measured checks: `npx vitest run src/lib/ai/strategy-v3 src/app/api/applications/[id]/strategy/recommendation/route.test.ts` (3 files, 15 tests passed); `npx eslint src/lib/ai/strategy-v3/engine.ts src/lib/ai/strategy-v3/engine.test.ts src/lib/ai/runtime/prompt-registry.ts` passed; `npx tsc --noEmit` passed; `git diff --check` passed with only existing LF/CRLF warnings.
