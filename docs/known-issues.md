# Known issues

Last code-only reconciliation: **2026-08-06**, `main` at `de4a7fe`. Last
**live production schema** reconciliation: **2026-08-12** — the owner pasted
a full production schema dump, which is how §0d/§0e/§0f below got marked
confirmed-resolved. That dump shows table/column structure only, not RLS
policies, so §0b (an INSERT policy, not a column) remains unverified by it.
Never re-run a migration solely because this file says so.

Ordered by how likely the underlying trap is to waste your time. Some sections
are regression records for fixed bugs, not open work:

| Area | Current reading |
|---|---|
| §00 draft compatibility | Guarded in `features/onboarding/domain/draft.ts`; keep the migration/coercion tests when shapes change. |
| §0, §0c database migrations | ✅ Confirmed resolved 2026-08-12 via the production schema dump — `student_profiles.curriculum` is an array type, `applicant_analyses.emerging_themes` exists. |
| §0b `application_recommendations` INSERT policy | Still unverified — RLS policies don't appear in a table-structure dump. Nothing recent points at this specifically failing; check live policies before assuming either way. |
| §0d, §0e, §0f database migrations | ✅ All three confirmed resolved 2026-08-12 via the production schema dump AND (for §0e) an independent real production error trace that matched the predicted failure exactly before the fix. See each section for detail. |
| §1 and §1c | Fixed production migration records; do not reopen from stale branch notes. |
| §1b mentorship RLS | Public reads are worked around in `src/lib/mentors.ts`; the underlying policy/admin visibility design remains unresolved until live policies are rechecked. |
| §2, §2b, §3, §4, §4b | Still relevant code/design debt unless a later section explicitly records a fix. |
| §5–§5m | Fixed regression history; preserve the tests and constraints. §5g fixed the biggest one: `personal_summary_completed_at`/`achievements_completed_at` were never written by any code, so no student could ever truly complete reflections. Some non-application entry points into the reflection forms still don't carry a `return` context — see §5g's third row. §5h fixed `load-evaluation.ts` selecting five `course_applications` columns that only exist on a different, superseded schema for that table name — Personal Report and Matching Report 404'd for every application. Also merged the duplicate report-page nav bar into the one `ApplicationNav` bar, and locked nav entries are now omitted rather than shown dimmed. §5i hardened `parseContentBlock`/`parseContentBlockValue`, which only checked the JSON's `type` field and not the rest of the shape — a real latent bug, but **not** the cause of the "planner tasks don't load" report it was written in response to; see §5l for what actually was. §5j is a design-constraint record, not a bug fix: the header's kinetic-typography animation must stay low-opacity and flash only one word instance at a time, never a whole row — both were tried and both crowded the real nav text. §5k fixed a real stacking-order bug found while adding the animation's delayed reveal: the red background fill was painted after (on top of) the canvas, so once it faded in it buried the animation instead of backing it — the fill div must stay before the canvas in source order. §5l is the one to read before touching the Planner UI: every task detail page 500'd because a server component imported pure helpers from a `'use client'` module, where calling an export throws and reading one silently yields `undefined`. The mappings now live in a directive-free `planner-presentation.ts`; never move them back. §5m records that reflection never asked for the career direction the matching and strategy reports score against, and that `goals` is a SHARED column — do not add a second career-goal column beside it. |
| §5n–§5q | Fixed regression history for the per-application Candidate Information flow; preserve the tests and constraints. §5p made review/confirmation state per-application (`course_applications.personal_summary_reviewed_at`/`achievements_reviewed_at`/`candidate_confirmed_at`) instead of per-student. §5q fixed the two bugs that surfaced once that shipped: `reflection/confirm/page.tsx` redirected away unconditionally once confirmed, so the "Reflections" nav entry had nothing to link to and read-only Continue buttons had nowhere real to go — see §5q for the read-only `ReviewConfirmView` mode, the `applicationSubNav()` Overview↔Reflections swap, and `confirmedReflectionContinueHref`. |
| §5r deleting an application | Migration written (`supabase-application-cascade-repair.sql`), **NOT YET CONFIRMED RUN** — repairs `ON DELETE CASCADE` drift across per-application child tables. |
| §5s Personal Report nav/i18n/lock/CTA fixes | Fixed regression record — nav bar, English-only content, the `"|null"` extraction leak, and the Matching Report link are all fixed. The new inline-answer path uses `supabase-personal-report-supplements.sql`, **NOT YET CONFIRMED RUN**; it degrades to a 503 until then. |
| §5t Personal Report versioning + no more cooldown | Fixed regression record — the one-row-per-student model with a 24h cooldown (root cause of "isn't generating at all" across multiple applications) is replaced by an append-only `student_personal_report_versions` table with no time-based limit, plus a version-history dropdown and two new regeneration triggers. `supabase-personal-report-versions.sql`, **NOT YET CONFIRMED RUN**; degrades to the not-enabled state until then. |
| §5u three more `?return=`-dropping entry points | Fixed regression record — §5s fixed the nav band and gap-action links for whichever entry point already carried `?return=`, but three routes with `applicationId` in scope (`AnalysisWorkspace`, `confirmedReflectionContinueHref`, the legacy portrait alias) never built it. All three fixed; see this section for why the report also reads shallow on thin achievement data — expected given the design, not a separate bug. |
| §6 | Owner/designer decisions, not implementation bugs. |

For current branch, recent-work, and verification status, read
[current-status.md](current-status.md).

---

## 00. FOUR components share the `glowbal-onboarding-draft` localStorage key — and it has crashed the wizard twice

**Read this before changing any type inside the onboarding wizard's `Answers`.**

These all read and write the same key, with three different top-level shapes:

| File | Shape written |
|---|---|
| `src/app/onboarding/onboarding-wizard.tsx` | `{ answers: Answers }` — the live one |
| `src/components/onboarding/onboarding-single-page.tsx` | `{ answers: … }`, a subset (no `academic`/`tests`, has `goals`) |
| `src/components/onboarding/onboarding-globe-quiz.tsx` | `{ answers: …, stepIndex }` |
| `src/app/onboarding/profile-form.tsx` | `{ profile: StudentProfile, stepIndex }` — **no `answers` at all** |

A draft is therefore not a value the current build wrote. It is a value *some*
build wrote, on a machine that may not have loaded the app since. Two shape
changes have shipped without migrating it, and both crashed:

1. **Commit `09d3bc9`** renamed `Tests.englishScore: string` →
   `englishScores: Record<string, string>` (one score per test instead of one
   number written across all of them). Drafts already in browsers kept the old
   key, so restoring one left `englishScores` **undefined** and every read threw
   `TypeError: Cannot read properties of undefined (reading 'Cambridge English')`.
   It stayed latent until 30/07, when `isAnswered('tests')` grew a call to
   `testScoresValid` — which indexes that map on **every render**, so the wizard
   went from "silently wrong" to "error boundary".
2. **The câu 6 rework (30/07)** replaced `{ gpaScale: string[], gpa: string }`
   with per-curriculum `scales` / `grades` maps. Same hazard, caught before ship.

What let both in: `JSON.parse(raw) as { answers?: Answers }`. **An `as` on a
`JSON.parse` result is a lie** — it tells the compiler the old shape cannot
exist, which is exactly the case that does exist.

**The rule now:** the draft is parsed in ONE place,
`src/features/onboarding/domain/draft.ts`, typed `Record<string, unknown>`, and
every field is *coerced* rather than cast — `readAcademicDraft`, `readTestsDraft`,
`toCurriculumList`, `toStringMap`. It is a domain module so it has unit tests
(`draft.test.ts`), including a regression test built from the exact draft that
produced the crash above. If you change a shape inside `Answers`, add the old
shape's migration to that file and a test beside the others.

Renaming the key on a breaking change would also work and would be simpler — but
it silently discards every in-flight draft, which is worse for the student than
losing one stale field.

---

## 0. `ADD COLUMN IF NOT EXISTS` never changes a column's TYPE — and it cost the owner four re-runs

**The single most expensive mistake in this pack so far.** Read it before
editing any `supabase-*.sql` file that has already been applied.

`supabase-academic-intake.sql` originally declared:

```sql
ADD COLUMN IF NOT EXISTS curriculum TEXT
```

The owner ran it. A later review established that a student can sit two
curricula at once, so the line was edited **in place** to `TEXT[]`. The owner
re-ran the file — four times — and the column stayed `TEXT` every time, because
`IF NOT EXISTS` compares the column **name** and never looks at its type. The
statement was skipped silently on every run, and would be on the hundredth.

Worse, the session then reported "the migration hasn't been run" from a stale
note instead of querying the database. It had been run. One column was wrong.

Two rules come out of this:

1. **Never edit an applied migration in place.** Add a follow-up block that
   inspects `information_schema` and converts, guarded so it is idempotent.
   The repair now in that file is the pattern:

   ```sql
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='student_profiles'
         AND column_name='curriculum' AND data_type <> 'ARRAY'
     ) THEN
       ALTER TABLE public.student_profiles
         ALTER COLUMN curriculum TYPE TEXT[]
         USING CASE WHEN curriculum IS NULL OR btrim(curriculum)='' THEN NULL
                    ELSE ARRAY[curriculum] END;
     END IF;
   END $$;
   ```

2. **Verify schema against the database, never against the .sql file or a
   note.** PostgREST publishes the live types — this needs no SQL editor:

   ```bash
   node --env-file=.env.local -e "
   const u=process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/', k=process.env.SUPABASE_SERVICE_ROLE_KEY;
   fetch(u,{headers:{apikey:k,Authorization:'Bearer '+k}}).then(r=>r.json()).then(s=>
     console.log(s.definitions.student_profiles.properties.curriculum));
   "
   ```

   `{type:'array'}` means converted; `{type:'string',format:'text'}` means not.

⚠️ **Last known status (2026-07-30):** the owner still needed to run the
repaired file once more. **Not revalidated on 2026-08-06.**
`src/app/onboarding/onboarding-wizard.tsx` was hardened to coerce a `string` or
`string[]` into a list (`toCurriculumList`) so a half-migrated database cannot
crash câu 6 on `curriculum.join(' · ')` — delete that helper once every
environment is known to be `TEXT[]`.

⚠️ **`supabase-academic-intake.sql` grew again on 2026-07-30, so that same re-run
now covers two more things.** Câu 6 was reworked to ask for a grade per
curriculum (see `docs/redesign-status.md`), which needs:

- `student_profiles.curriculum_grades JSONB` — **new, and the save fails without
  it.** PostgREST answers `Could not find the 'curriculum_grades' column` and the
  student sees that message on the last step. Added by name, so a plain re-run
  picks it up.
- `gpa_value` widened `NUMERIC(4,2)` → `NUMERIC(6,2)`, as a **separate**
  `ALTER COLUMN` statement — per rule 1 above, the original `ADD COLUMN` line was
  not edited to do it, because that would have been skipped forever. Reason:
  `NUMERIC(4,2)` tops out at 99.99 and the "Others..." curriculum is graded as a
  percentage, where 100 is a real answer. Postgres does not round an over-range
  value, it raises `numeric field overflow` — a failed save on the last step with
  every other answer already written. The wizard also refuses to send a value the
  narrow column cannot hold (`GPA_COLUMN_MAX`), so an un-migrated project stays
  usable and merely drops the odd 100%; that guard can go once every environment
  is `NUMERIC(6,2)`.

---

## 0b. `application_recommendations` shipped with RLS enabled but no INSERT policy — every AI Strategy Dashboard recommendation write was silently rejected

**Found from a live bug report**: `/ai-strategy/[id]/strategy/dashboard` showed
"We couldn't refresh your recommendations just now" and an empty
recommendation table for a student with a completed Course Match Analysis
(60/80 match score) — i.e. exactly the "AI matching is completely
empty/broken" symptom.

`supabase-apply-v2.sql` turns RLS on for `application_recommendations` and
adds a SELECT policy and an UPDATE policy, but **never an INSERT policy**:

```sql
ALTER TABLE public.application_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view recommendations for their applications" ...
CREATE POLICY "Users can update recommendations for their applications" ...
-- no INSERT policy — Postgres RLS defaults to deny
```

`generateRecommendations` (`src/features/ai-strategy-dashboard/api/generate-recommendations.ts`)
runs on the request-scoped, RLS-respecting Supabase client
(`await createClient()`), so its `.insert(...)` for a student's *first*
recommendation has been rejected by RLS since the Dashboard shipped (#112).
Reads and status updates of already-existing rows work fine — which is why
this stayed hidden: nothing in the current codebase actually inserts into
this table except `generateRecommendations`, so no student could ever get a
first row created, and the failure looked identical to "nothing to
recommend yet" until the fix in #112/#114 started surfacing it as an
explicit error banner instead of a silent empty table.

**Repository fix**: `supabase-strategy-recommendations-insert-policy.sql` — additive,
adds only the missing INSERT policy, does not touch existing rows or the
SELECT/UPDATE policies. Its **live application status was not revalidated on
2026-08-06**. Verify before deciding whether the owner must run it:

```sql
select policyname, cmd from pg_policies
where tablename = 'application_recommendations';
```
should list `INSERT`, `SELECT`, and `UPDATE` rows.

If `supabase-strategy-recommendation-fields.sql` (adds `estimated_impact`,
`pillar`, `source_analysis_id`, `archived_at`) hasn't been run either, run
that one first — `generateRecommendations` selects those columns too and
will fail with `PGRST204` ("Could not find the '...' column") until it has.
`generateRecommendations` now logs which of the two is missing
(`logMigrationHint`) instead of just "insert failed", matching the
diagnosis pattern in §1c below.

---

## 0c. `applicant_analyses.emerging_themes` — the one column the Evaluation Engine adds

The repository contains `supabase-evaluation-engine.sql` (one
`ADD COLUMN IF NOT EXISTS`). Its **live application status was not revalidated
on 2026-08-06**; query the column before deciding whether to apply it.

Until it runs, `POST /api/applications/[id]/strategy/applicant-analysis`
fails at the insert with PostgREST `PGRST204` and the student sees "Could not
save your analysis." The route logs the file name on that specific code so it
does not have to be bisected:

```
[strategy/applicant-analysis] applicant_analyses is missing a column the
engine writes. Run supabase-evaluation-engine.sql (adds emerging_themes).
```

**Reading the page does not need the migration.** `narrativeFromRow` reads
`emerging_themes` defensively, so an analysis generated before this ran shows
five portrait sections instead of six plus a prompt to refresh — the same
handling as any other section without content. Only *writing* a new analysis
is blocked.

**Why the column names do not match the section names.** The engine's sections
are `coreIdentity` / `drivingForce` / `signaturePattern` / `personalPositioning`;
the columns are still `personality_summary` / `motivation_analysis` /
`competitive_advantages` / `suggested_positioning`. Rows written before the
engine existed hold real analyses for real students, and renaming would have
stranded them for a cosmetic gain. The two vocabularies meet in exactly one
place, `narrativeFromRow` — do not add a second.

**`student_activities` has no `evidence_key`.** `student_achievements` does.
So an activity can never reach the `verified` tier of the F3 Evidence
Hierarchy no matter what a student does. That is a real product gap, not a
rule worth defending; it is recorded as `ACTIVITY_EVIDENCE_UNSUPPORTED` in
`domain/evaluation/evidence.ts`, and activities are excluded from the "worth
attaching proof for" list so the UI never asks a student to do something the
form will not let them do. Closing it means an `evidence_key` column on
`student_activities` and an upload control on the activities form.

## 0e. `supabase-ai-strategy-reports.sql` never run — Matching Report 503s and the Planner shows zero tasks for every application

✅ **CONFIRMED RESOLVED 2026-08-12.** The owner pasted the live production
schema dump; `application_match_analyses` now has all six columns
(`input_hash`, `fit_dimensions`, `fit_eligibility`, `fit_classification`,
`fit_confidence`, `fit_limitations`) and `student_personal_reports` exists.
This was also independently confirmed the same day by a real Vercel function
trace on `POST /api/applications/[id]/match-insights`: the exact failure
mode this section predicted (`GET student_personal_reports` → 404,
`POST application_match_analyses` → 400) is what actually happened in
production before the fix — hard evidence the diagnosis below was correct,
not speculation. Rest of this section kept as the historical record; the
migration does not need running again.

**Confirmed live and broken 2026-08-06** (a real student's screenshot of
`/ai-strategy/[id]/strategy/matching`): the page shows only "Matching Report
cần được cập nhật cơ sở dữ liệu trước khi sử dụng." ("Matching Report needs
the database updated before use.") and a "Try again" button that cannot
succeed.

**Root cause**: `supabase-ai-strategy-reports.sql` (adds `input_hash`,
`fit_dimensions`, `fit_eligibility`, `fit_classification`, `fit_confidence`,
`fit_limitations` to `application_match_analyses`, plus the whole
`student_personal_reports` table) has never been run against production.
`POST /api/applications/[id]/match-insights`'s `migrationMissing()` helper
(`route.ts:42-51`) catches the resulting `42703`/`PGRST204` and returns the
Vietnamese message above with a 503 rather than a raw Postgres error — which
is correct behaviour, but it means the underlying cause reads as a UI error
rather than what it is.

**This is why an application's Planner shows 0 tasks even after the student
has done everything right.** The Dashboard page only calls
`generateRecommendations` when a `application_match_analyses` row with
`analysis_status = 'complete'` exists (`dashboard/page.tsx`'s `if
(latestMatch)` guard) — and no such row can ever be *inserted* while this
migration is missing, so `latestMatch` stays null and recommendation
generation is silently skipped, not failing loudly. The Planner's "No tasks
yet" / "Nothing left — nicely done" copy is honest about what exists in the
database, it just can't say *why* nothing exists.

**Also blocks Personal Report** — `student_personal_reports` is the same
migration's table; `/api/ai-strategy/personal-report` and
`src/features/apply/api/ai-reports-repository.ts` both depend on it.

**Fix**: run `supabase-ai-strategy-reports.sql` in the Supabase SQL editor.
It is additive and idempotent (`CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS`) — safe against a database that already has some
of these objects. Verify first:

```sql
select column_name from information_schema.columns
where table_name = 'application_match_analyses'
  and column_name in ('input_hash', 'fit_dimensions', 'fit_eligibility', 'fit_classification', 'fit_confidence', 'fit_limitations');
```
should return all six; and `select 1 from information_schema.tables where table_name = 'student_personal_reports';` should return a row.

**After that migration runs, §0d below still applies** — a student's first
Matching Report will then successfully call `generateRecommendations`, which
needs `supabase-strategy-recommendation-content-blocks.sql` to have run too
or the recommendation *inserts* themselves will fail the same way, one layer
further in.

## 0f. `supabase-strategy-recommendation-report.sql` never run — the Personalized Strategy report cannot generate or export

✅ **CONFIRMED RESOLVED 2026-08-12.** The owner's production schema dump
shows `application_strategy_recommendations` with the full expected column
set. Does not need running again. (§0e, this migration's own dependency, is
also confirmed resolved — see that section.)

Written 2026-08-08 alongside the F7 Personalized Strategy report (the
`/ai-strategy/[id]/strategy/analysis/recommendation` page — see
`docs/README.md` for what F7 is and why it is a separate page from the
Planner). **Never run against production.** Verify first:

```sql
select 1 from information_schema.tables where table_name = 'application_strategy_recommendations';
```
should return a row.

**Until it runs**: `POST /api/applications/[id]/strategy/recommendation`
(generation) fails the insert with Postgres `42P01`/PostgREST `PGRST205`
("relation does not exist"/"table not found in schema cache") — the route
logs a named hint pointing at this file, same pattern as §0d/§0c. The report
page's generation gate (`StrategyRecommendationWorkspace`) surfaces this as
its normal error state with a "Try again" button that cannot succeed until
the migration runs, the same failure shape §0e describes for the Matching
Report. `GET` on the same route degrades gracefully — no row simply reads as
`{ recommendation: null }` — but the POST path is what a student needing
their first Personalized Strategy report always hits.

**Depends on `supabase-ai-strategy-reports.sql` (§0e) already having run.**
F7 synthesises the Personal Report (`applicant_analyses`) and the Matching
Report (`application_match_analyses.fit_*`) — both are §0e's tables/columns.
If §0e has not run either, the generation route 422s with "Generate your
Personal Report and Matching Report first" before it ever reaches this
table, which is the correct diagnosis but means fixing §0f alone will not be
enough on a database where §0e is also still pending.

**Fix**: run `supabase-strategy-recommendation-report.sql` in the Supabase
SQL editor. It is additive (`CREATE TABLE IF NOT EXISTS`), so safe to run
even if parts of it somehow already exist.

## 0d. `application_recommendations` genUI columns — the detail-page content block

✅ **CONFIRMED RESOLVED 2026-08-12.** The owner's production schema dump
shows `application_recommendations` with `content_schema`, `content_value`,
`submit_checklist`, `tips`, and `suggested_questions` all present. Does not
need running again.

The repository contains `supabase-strategy-recommendation-content-blocks.sql`
(five `ADD COLUMN IF NOT EXISTS`: `content_schema`, `content_value`,
`submit_checklist`, `tips`, `suggested_questions`). Written 2026-08-06,
**never run against production** — verify before deciding whether the owner
must run it:

```sql
select column_name from information_schema.columns
where table_name = 'application_recommendations'
  and column_name in ('content_schema', 'content_value', 'submit_checklist', 'tips', 'suggested_questions');
```
should return all five.

Until it runs, `generateRecommendations` fails inserting/updating any
recommendation with PostgREST `PGRST204` (`logMigrationHint` in
`src/features/ai-strategy-dashboard/api/generate-recommendations.ts` now
names both this file and `supabase-strategy-recommendation-fields.sql` on
that code, same diagnosis pattern as §1c).

**Reading does not need the migration to have run for existing rows** — a row
written before these columns existed just has them `NULL`, and
`recommendationFromRow` (`domain/recommendation.ts`) treats a missing/malformed
`content_schema`/`content_value` the same as a genuinely absent one (`null`,
via `parseContentBlock`/`parseContentBlockValue`): the detail page renders the
brief with no content block rather than throwing. Only inserting/updating a
recommendation is blocked until the columns exist.

## 1. FIXED 2026-07-27 — `public.user_universities` migration applied

Was: PostgREST answered `Could not find the table 'public.user_universities' in
the schema cache` even for the service-role key. The owner ran
`supabase-schema.sql:151` and it is now confirmed live (empty, RLS enabled,
`application_tasks`'s FK to it resolves).

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
a.from('user_universities').select('id').limit(1).then(r => console.log(r.error?.message ?? 'OK'));
"
```

This unblocks: the heart button on `/universities`, `GET
/api/home/save-university`, `/my-universities` actually holding rows, and
`tests/e2e/signed-in.spec.ts` → *"saving a university survives a reload"*
(baseline moves from 51 pass / 1 fail to 52 pass / 0 fail).

Related tables that were already populated: `universities` (97),
`scholarships` (2877), `scholarship_universities` (374), `user_scholarships`,
`student_profiles`, `course_applications` (29), `team_members`, `geo_articles`,
`achiever_profiles` (8, 7 approved).

Re-measured 2026-07-30: `universities` 106 rows (97 with `strengths`, 97 with
`tuition_usd`), `user_universities` 4, `user_scholarships` 48, `scholarships`
2877, `scholarship_universities` 374.

⚠️ Some comments in the repo still asserted `user_universities` was missing, more
than two days after it was applied — `src/app/dev/saved-list/page.tsx` carried a
whole paragraph about every save silently no-opping. Corrected 30/07. **A "this
table does not exist" note is only true on the day it was written.**

---

## 1a. NEVER conclude a table is absent from guessed names — enumerate

**Cost the owner a correction on 2026-07-31.** The saved-list work reported that
this database has **no course catalogue**, and built a `strengths`-only fallback
around that. The evidence was three probes — `programs`, `majors`,
`university_programs` — all missing.

There are **75 tables**. The catalogue is called `catalog_programmes`, with
`academic_units` beside it, `courses`, `course_offerings`,
`course_academic_units`, and a whole `crawl_*` pipeline feeding them. Every one
was one call away:

```bash
# PostgREST's OpenAPI document lists every exposed table AND its columns
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  | jq -r '.definitions | keys[]'

# ...and the columns of one table
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  | jq -r '.definitions.catalog_programmes.properties | keys[]'
```

§0 above is about trusting a `.sql` file over the database. This is the same
mistake with a different disguise: **a miss on a name you invented is evidence
about your naming, not about the schema.** Enumerate first, then ask what is in
what you found.

What was in it, once looked at: 404 programmes across 24 of 106 universities,
`degree_level` in two spellings (`bachelor` and `Bachelor's`), `duration` null on
400 of 404, and `academic_units` denormalised onto each row as the school layer.
All of that now drives the subject picker; see
`src/features/universities/api/programme-queries.ts`.

### It is crawler output, so it needs shaping before a student sees it

⚠️ **`NEEDS_REVIEW` does not mean "we think this is wrong."** It is the default
state of anything that has not been through a rule validator — 390 of the 404
rows carry it. `REJECTED` is the flag that means the pipeline decided against a
row. Do not label `NEEDS_REVIEW` "unverified" in the UI, and do not filter on it:
all 10 `RULE_VALIDATED` rows belong to one university, so filtering leaves the
catalogue working for 1 of the 24 covered and silently drops the rest to the
`strengths` fallback.

Also true of the raw rows, and handled in
`features/universities/domain/programs.ts`:

- **names are facet soup.** Median 35 characters, p90 84, max 154 — the longest
  repeats its school twice. `tidyProgrammeName` peels the trailing facets;
  it must only ever peel the TAIL, because cutting at the first facet word
  anywhere destroys "Computer Science – Online Degree (MS)".
- **the same subject appears at several degree levels**, so anything that
  deduplicates must key on name *and* degree.
- **the catalogue itself contains duplicates** — Princeton lists "Computer
  Science" twice at master's and twice at bachelor's.

---

## 1c. FIXED 2026-07-31 — `supabase-saved-program.sql` applied

Adds `user_universities.program` and `.program_url`, which back the "Ngành …"
line on each saved row and the "Chọn lại ngành" picker at
`/my-universities/program` (Figma `375:12701`, `375:13546`).

Additive and idempotent: two nullable `text` columns, `ADD COLUMN IF NOT EXISTS`,
no RLS change needed (the existing `for all` policy on the row covers them). The
owner ran it on 2026-07-31 and the round trip is confirmed live — picking a
programme stores it and the saved card renders it.

**The tolerance built while it was outstanding stays**, and is worth keeping:

- the saved list reads with `select('*')`, so a project without these columns
  renders the list rather than failing whole. Do not switch that to an explicit
  column list when adding the next field;
- a row with no subject shows "No subject chosen yet" rather than a placeholder;
- a write that hits a missing column reports *"Saving a subject is not switched
  on in this environment yet — the user_universities.program column has not been
  added. Nothing was changed."* instead of a generic retry prompt.

That last one exists because a generic error sends someone retrying a write that
can never succeed. It matches the PostgREST **code**, verified against the live
API rather than guessed:

```
code    PGRST204
message Could not find the 'program' column of 'user_universities' in the schema cache
```

Note the word "column" comes **after** the column name. The obvious pattern
`/column .*program/i` does not match it — that was the first version, and it fell
through to the generic message in the browser.

---

## 1b. The whole mentorship schema is readable only by `authenticated`

Found while rebuilding `/mentors`: the anon role reads back **zero rows** from
`achiever_profiles`, so the request-scoped Supabase client used by the old
`getApprovedMentors` silently returned an empty directory to every signed-out
visitor. Confirmed directly:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
a.from('achiever_profiles').select('id').eq('status','approved').then(r => console.log(r.error?.message ?? 'rows: ' + r.data.length));
"
```

Worked around, not fixed, in `src/lib/mentors.ts`: `getApprovedMentors` now reads
through `createAdminClient()` and projects onto an explicit `PublicMentor` type
(name, avatar, university, subject, bio, help topics, rating, session rate —
**not** `legal_name`, `date_of_birth`, the four verification storage keys, or
`stripe_account_id`, which the old `select('*')` was serialising into every page
load regardless of the RLS bug). The durable fix is a
`status = 'approved'` public read policy on the table; this workaround should be
revisited once that migration exists.

### Wider than first recorded (2026-07-30)

It is **not just `achiever_profiles`**. Every select policy across the
mentorship schema is granted `to authenticated` — checked in
`supabase-global-station.sql` and `supabase-mentorship.sql`:

| Table | Policy | Granted to |
|---|---|---|
| `achiever_profiles` | "Anyone can read approved achiever profiles" | `authenticated` |
| `mentor_availability_slots` | "Read mentor availability for booking" | `authenticated` |
| `session_reviews` | "Authenticated users can read visible reviews" | `authenticated` |

"Anyone" in that first policy name is wrong, and it is what made the gap easy to
miss. The consequence found on 2026-07-30: **`/mentors/[id]` returned 404 to
every signed-out visitor**, because `getMentorById` used the request-scoped
client, got zero rows, and the page called `notFound()`. Every card in the
*public* directory was a dead link, and no error was logged anywhere — an RLS
filter returning nothing is a successful query.

Same workaround, applied to the detail page: `getPublicMentorById`,
`getPublicMentorSlots` and `getPublicMentorReviews` in `src/lib/mentors.ts` read
through the service role and project onto public columns. Verified with an
unauthenticated request returning 200 and containing none of `legal_name`,
`date_of_birth`, `stripe_account_id` or `storage_key`.

Prove the underlying gap is still there with the anon key:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
a.from('english_test_scores').select('id').then(r => console.log('anon sees', r.data?.length, 'rows'));
"
```

When the durable policies land, all six `getPublic*`/`getApproved*` helpers can
drop back to the request-scoped client together.

### The same gap hides pending mentors from the admin who has to approve them (found 2026-07-31)

Found while screenshotting the rebuilt `/admin`. The console contradicts itself:

| Page | Client | Shows |
|---|---|---|
| `/admin` overview | `createAdminClient()` — service role, on the eslint debt list | **"Mentor applications waiting: 1"** |
| `/admin/achievers` | `createClient()` from `@/lib/supabase/server` — request-scoped | **"Pending (0)"** |

Both are correct about what they can see. The select policy on
`achiever_profiles` is scoped to `status = 'approved'`, so the request-scoped
client cannot read a **pending** row no matter who is signed in — being an admin
is checked in application code (`isAdmin`), not in the policy. The queue an
admin exists to work is invisible on the only page that can action it, and the
overview tells them there is one waiting.

Confirmed 2026-07-31 — the service role sees five rows, one of them pending;
the anon role sees none:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
Promise.all([svc.from('achiever_profiles').select('status'), anon.from('achiever_profiles').select('status')])
  .then(([s, a]) => console.log('service:', s.data.map(r => r.status).join(), '| anon:', a.data.length));
"
```

**PRE-EXISTING, and deliberately not fixed by the 31/07 console rebuild** — that
was a UI pass, and this is a data-access boundary. The two candidate fixes are
both bigger than a restyle:

1. An admin read policy on `achiever_profiles` (the durable fix, and it also
   retires the `getPublic*` workarounds above).
2. Move the page's read behind an API route or a repository that may use the
   service role. Note it **cannot** just switch to `createAdminClient()` in
   place: eslint's `ADMIN_CLIENT_DEBT` list in `eslint.config.mjs` "may SHRINK,
   never grow", and `src/app/admin/achievers/page.tsx` is not on it.

Until one of those lands, mentor applications can only be approved by editing
the row directly.

---

## 2. Hydration mismatch on `/universities` — reduced, not eliminated

The imagery patch (`setWithImages`) lives **outside** the `<Suspense>` that wraps
`Chrome`, so its state update can land while the card subtree is still hydrating.
React then discards the server HTML and re-renders the whole tree — and the
explorer comes back with default state, which is how a signed-in card click could
end up on the login gate.

Only reproduces once `/api/university-images` is warm enough to answer in a few
milliseconds, which is why it appears after repeated runs and not on a cold visit.

Mitigated in `src/app/universities/university-list-client.tsx` with
`startTransition` plus a one-frame `requestAnimationFrame` defer. Clean in most
runs, **still reproduces occasionally**.

Proper fix (not done): move the imagery state inside the Suspense boundary, or
resolve imagery server-side and drop the client patch.

---

## 2b. `session_reviews.reviewer_name` does not exist

`MentorReviewWithReviewer` in `src/types/mentorship.ts` declares
`reviewer_name: string | null`, and `getMentorReviews` fetches with
`select('*')`. There is no such column — `session_reviews` is
`id, booking_id, reviewer_id, achiever_id, rating, comment, is_visible,
created_at` (supabase-global-station.sql). So the field has always come back
`undefined` and every review the old profile page rendered was unattributed,
with TypeScript asserting otherwise.

The rebuilt `/mentors/[id]` labels reviews "Glowbal student" rather than carry
the fiction, and `getPublicMentorReviews` selects only columns that exist. To
make authorship real, either add the column or join `student_profiles` — and
decide first whether a reviewer's name should be public at all.

---

## 3. Dead code

| File | Lines | Status |
|---|---|---|
| `src/app/onboarding/profile-form.tsx` | 599 | Orphan — nothing imports it. 14 legacy classes. |
| `src/app/onboarding/world-picker.tsx` | 701 | Imported only by `onboarding-globe-quiz.tsx`, itself an orphan. 13 legacy classes. |
| `src/components/onboarding/onboarding-globe-quiz.tsx` | 663 | Orphan. |
| `src/components/onboarding/onboarding-single-page.tsx` | 564 | Orphan — only referenced from comments in `i18n-dictionary.ts` and `selection-cache.ts`. |
| `src/components/landing/home/` — `home-landing.tsx`, `hero-globe.tsx`, `reveal.tsx`, `site-header.tsx`, `university-search.tsx` | 1,510 | **Orphaned 2026-07-28** when `/` was promoted to the Figma build. Nothing imports any of them; the only remaining reference is a source citation in a comment in `src/shared/ui/icons.tsx`. `globals.css` still carries two `.home-landing-root` rules (≈4952, ≈5316) that now match nothing. |

That is ~2,530 lines of orphaned onboarding plus the 1,510-line landing tree —
**~4,000 lines**, and most of `src/app/onboarding/`'s 43 legacy classes.
Deleting them is safe and would make the onboarding tree clean, but it was left
alone because nobody asked. `src/app/my-universities/my-universities-client.tsx`
(928 lines) was in the same state and **has** been deleted — it is in git history
if it is ever wanted back.

### What clearing this list would unlock: dropping `react-globe.gl`

Traced 2026-07-30. The library is imported in two files —
`src/app/onboarding/world-picker.tsx` (dead, above) and
`src/components/landing-globe.tsx`, the shared wrapper. `LandingGlobe` has four
consumers, and **three of them are on this dead list**:

| Consumer | Status |
|---|---|
| `src/app/onboarding/profile-form.tsx` | dead |
| `src/components/onboarding/onboarding-single-page.tsx` | dead |
| `src/components/landing/home/hero-globe.tsx` | dead (orphaned landing) |
| `src/app/my-universities/[id]/university-globe.tsx` | **live** |

So deleting this table leaves exactly one consumer, which is what CLAUDE.md
already asserts ("the only place still rendering the globe is the legacy
`/my-universities/[id]`"). Retire that page and `react-globe.gl` — and the
Three.js bundle behind it — can come out of `package.json` entirely. Until then
do **not** re-introduce a globe on a new page; the redesign dropped it from
`/universities` and the home hero is a static PNG.

---

## 4. `parseDeadline` resolves bare "Jan 15" to the year 2001

Pre-existing and **deliberately pinned by a test** in
`src/features/universities/domain/__tests__/formatting.test.ts` — V8's
`Date.parse('Jan 15')` succeeds and wins before the roll-forward fallback can run.

Do not "fix" it without updating that test, which exists so the fix is a visible
diff. `formatDeadlineLabel` guards against it: a parse landing more than a year in
the past is treated as "the string had no year", and the original prose is shown
instead. That is why `/my-universities` prints
`Deadline: UG: Jan 1 (EA: Nov 1) | PG: Dec–Jan varies by dept` rather than a
confidently wrong date.

---

## 4b. `TopNav` silently CLIPS nav links between 768 and ~1200

Found 2026-07-31 while widening the header. Not introduced by that change — it
measures the same before and after.

The desktop bar turns on at `md` (768) and its link row is `overflow-hidden`, so
when the links do not fit they are **cut off with no indication** — they do not
wrap, scroll, or collapse. Measured on `/about`, whose guest nav is the *small*
case at 6 items:

| Viewport | Links row needs | Gets | Hidden |
|---|---|---|---|
| 768 | 669px | 298px | **371px** — over half the links |
| 1024 | 669px | 554px | **115px** |
| 1280 | 669px | 768px | 0 — 99px spare |

So on a 768–1024 tablet the bar shows roughly "About us / Build your strategy"
and quietly drops the rest, including *Search universities*. There is no
hamburger to fall back to either — `MobileNav` stops at `md`, exactly where this
starts.

It gets worse signed in: `navItemsFor()` in `src/components/nav-reveal.tsx` adds
Apply and Scholarships, plus Mentor hub / Coordinator / Admin per role — up to 9
items, so an admin can lose links at 1280 too. Untested, as it needs a live
session.

This is why every loosening of the link spacing in `src/shared/ui/top-nav.tsx` is
gated at `2xl`: loosening below 1280 would bury more links, and **1280 itself has
no room to give away either**. That row of the table used to read `741px / 741px`
— the links fitting to the pixel — because the links briefly took `Button`'s `sm`
horizontal padding from `xl`, which costs 72px across six labels. It measured as
a fit on Windows and clipped "Blog" on CI, where the same text comes out a few px
wider per label. The `xl` step is now the vertical padding only (the 36px pill
height, which costs no width); the horizontal one waits for `2xl`.

A real fix for 768–1024 still needs a decision from the designer — raise the
desktop breakpoint to `lg`/`xl` so tablets get the hamburger, or give the bar an
overflow menu. Neither is drawn in Figma.

### Much smaller since 01/08, but not gone

The owner's nav rework took the marketing bar from six top-level labels to four
by folding Scholarships / Universities / Mentors behind a **Search** dropdown.
Re-measured on `/` at the same widths:

| Viewport | Hidden, 6 items | Hidden, 4 items |
|---|---|---|
| 768 | 371px | **74px** |
| 1280 | 0 (99px spare) | **0** |
| 1440 | 0 | **0** |

So the tablet case is now "the last label is clipped", not "half the bar is
gone". The paragraph above still stands: `overflow-hidden` is still the
behaviour, the `2xl` gate on horizontal padding is still load-bearing, and the
signed-in `navItemsFor()` list in `nav-reveal.tsx` is **untouched** by this — it
still builds up to 9 items and is still the worse case.

⚠️ One new constraint. `NavDropdown`'s panel is `position: fixed` precisely
*because* the row clips, and that only works while nothing above the header
establishes a containing block for fixed descendants. **Adding `transform`,
`filter` or `contain: paint` to `<body>`, the page shell, or the header itself
would silently re-clip the dropdown** — it would open, and be invisible.

---

## 5. Fixed 2026-07-26 — do not re-introduce

| What | Where |
|---|---|
| **The site named itself under three hostnames, two of which do not exist.** (Fixed 31/07.) `sitemap.xml`, `robots.txt` and every news article's `Article` / `BreadcrumbList` JSON-LD published under `https://glowbal.co`; the unsubscribe link in both newsletter emails used `https://glowbal.com`; the real domain is `https://glowbal-education.com` (owner, 31/07). So the canonical URL of every article pointed at a host that does not resolve, and the unsubscribe link in already-sent mail was a dead address. One resolver now — `NEXT_PUBLIC_SITE_URL`, real domain as fallback. ⚠️ Production must have that env var set to the real domain **or unset**: pointing it at the `*.vercel.app` host would publish canonicals under a URL `next.config.ts` immediately 308s away from. | `src/lib/site-url.ts` + `sitemap.ts`, `robots.ts`, `news/[slug]/page.tsx`, `api/newsletter/{subscribe,notify}/route.ts`, `lib/course-parser/extract-course.ts` |
| Password reached the URL. A submit landing before hydration falls through to a native GET, putting `email`/`password` in the query string, history and access logs. Both forms now carry `method="post"`. | `src/app/auth/auth-form.tsx`, `src/app/news/news-client.tsx` |
| Save failed silently — `addToShortlist` discarded the upsert error and kept the optimistic state, so the UI said "Saved" and the row vanished on reload. Now logs, rolls back, toasts. (`showToast` had to be hoisted above `addToShortlist`: a `useCallback` deps array is evaluated at the call site, so naming a `const` declared below throws on the TDZ.) | `src/features/universities/ui/explorer-context.tsx` |
| Signed-in card click never opened the detail view. One effect wrote `?u=<id>`; the other read the URL before that write landed, saw no `?u`, and reverted to `browse`. Guests never hit it because `setView` bounces them to the login gate first — which is why the guest suite stayed green and hid it. | `useUniversityUrlSync` in `src/app/universities/university-list-client.tsx` |
| Every blog guide fell back to empty frontmatter — `parseFrontmatter` anchored on `\n---\n` and the draft files are CRLF. Titles rendered as slugs, excerpts as `---`, dates as today. | `src/lib/geo-content.ts` |
| Logo rendered blurry with colour fringing. `public/glowbal-logo.png` is 1115×398 but the wordmark occupies only 929×163 of it, so `height={28}` gave a 78×28 box with ~11px lettering. Cropped to the framing Figma itself uses (node `153:18271`) → `public/brand/glowbal-wordmark.png`, 1115×227, `quality={90}`. `height={28}` now yields the design's 138×28. | `src/components/glowbal-logo.tsx` |

---

## 5b. Fixed 2026-07-27 — do not re-introduce

| What | Where |
|---|---|
| The legacy app sidebar (`NavReveal`) overlapped the new `/apply` page. Rebuilding a page onto its own `TopNav`/`MobileNav`/`Footer` chrome does nothing on its own — the route also has to be added to `OWN_CHROME_ROUTES`, or the old sidebar renders on top of it. Confirmed by screenshot before the fix. | `src/components/nav-reveal.tsx` — same list also needed `/mentors` for the same reason |
| `achiever_profiles` has no public-read RLS policy — see 1b above. | `src/lib/mentors.ts` |
| Mentor card badge overflowed into the next grid column. `Badge` bakes in `whitespace-nowrap`, and real university names run to "London School of Economics and Political Science" — the pill needs its own line and a `truncate` on the text inside, not inline with the name. | `src/app/mentors/mentors-client.tsx` |
| `setState` called synchronously inside a `useEffect` body (new lint error, baseline is 0). The "open the course-search modal from a query param" flag is a prop, so opening the modal belongs in `useState`'s initializer, not a reaction fired from an effect. The effect that's left only strips the query param, which is a real side effect. | `src/app/apply/apply-list-client.tsx` |

---

## 5c. Fixed 2026-07-29 — do not re-introduce

| What | Where |
|---|---|
| Footer wordmark rendered 352×28 — ratio 12.6 against the asset's 4.9, stretched 2.5× wide. `GlowbalLogo`'s inline `width: auto` leaves the cross size auto, so in a **column** flex container the default `align-items: stretch` applies to the `<img>` and blows it to the container width while the fixed height stays put. The footer's left column is `flex flex-col` with no `items-*`; `TopNav`'s row has `items-center` and so never showed it. Fixed at the source by emitting the derived width in px, which opts every one of the ~30 call sites out of the stretch regardless of container. | `src/components/glowbal-logo.tsx` |
| `quality={90}` was being served as **q=75**. Next 16 changed `images.qualities` from "any" to `[75]`, and an out-of-allowlist `quality` prop is *silently coerced to the nearest entry* rather than erroring — so the prop that exists to stop the wordmark's gradient artefacting did nothing. Allowlist is now `[75, 90]`. | `next.config.ts` |
| Desktop wordmark was not a link. `TopNav`'s `logo` prop was documented "Links home" but no caller wrapped it and the component didn't either; only `MobileNav`'s callers did. The `<Link href="/">` now lives inside `TopNav` so no page can forget it — **so do not pass an already-linked node to `TopNav`**, or the anchors nest. `MobileNav` keeps the opposite convention (caller wraps). | `src/shared/ui/top-nav.tsx` |
| Contact photo blurry: `sizes="…592px"` made the browser fetch the 640w candidate and upscale it 1.6×. `sizes` describes the **layout** width, but `object-cover` needs more: the source is 16:9 (1.778) into a 1.081 box, so only 61% of the width is shown and filling 576 CSS px takes 576 × 1.645 = 948 source px. Now `165vw` / `948px`, which fetches 1080w and lands at 1:1 at DPR 1. | `src/features/marketing/ui/home-contact.tsx` |

---

## 5d. Fixed 2026-07-30 — do not re-introduce

| What | Where |
|---|---|
| `/mentors/[id]` 404'd for every signed-out visitor, and leaked the mentor's PII to every signed-in one. See 1b. | `src/lib/mentors.ts`, `src/app/mentors/[id]/` |
| The booking calendar offered slots checkout will refuse. `getMentorOpenSlots` returns `open` **and** `held` starting from `now`; `POST /api/mentorship/checkout` 409s on a held slot and 400s on anything inside the next hour. The student found out at the payment step. `getPublicMentorSlots` applies both rules up front. | `src/lib/mentors.ts` |
| Hydration mismatch from `{name} literal-text` in JSX. Adjacent text children need React's `<!-- -->` separators to survive, and `DomTranslator` walks and rewrites those same nodes. Compose one string instead — which also makes the sentence dictionary-translatable rather than machine-translated. | `src/app/mentors/[id]/mentor-booking.tsx`, `mentor-detail.tsx` |
| `setState` in a `useEffect` body for a "have I hydrated yet" flag (lint error; baseline is 0 errors). `useSyncExternalStore(subscribeToNothing, () => true, () => false)` is the sanctioned way to give server and client different answers — the three callbacks must be module-level constants or the subscription re-fires every render. | `src/app/mentors/[id]/mentor-booking.tsx` |
| Home visual baselines failed after the wordmark fix in `0923f56`. Any change to shared chrome (logo, `TopNav`, `Footer`, tokens) invalidates `home-preview.spec.ts` — re-bless with `--update-snapshots` **in the same commit** as the intentional change, or the next session inherits a red suite it did not cause. | `tests/e2e/home-preview.spec.ts-snapshots/` |

---

## 5e. Fixed 2026-08-08 — do not re-introduce

**Confirmed live and broken same day**: a student's screenshot of
`/ai-strategy/[id]/strategy/analysis/recommendation` immediately after PR #156
merged, showing "Generate your Personal Report and Matching Report first —
the Personalized Strategy builds on both." with a "Try again" button that
could not succeed — reached by simply clicking into an application from
`/apply`.

| What | Where |
|---|---|
| `fetchOnboardingState`'s `aiAnalysisComplete` only checked that an `applicant_analyses` row (Personal Report) existed — it never checked whether the Matching Report (`application_match_analyses`, `analysis_status = 'complete'`) had actually been generated. `AnalysisWorkspace` generates both together on one visit to `/strategy/analysis`, but they are two separate tables written by two separate calls, and a student whose Matching Report failed (missing CV/essay/grades, or — as here — a pending database migration, see §0e) still had `aiAnalysisComplete = true` and was routed straight past `intro` into the new `strategy` step. F7's generation route unconditionally requires the Matching Report as an input, so this is exactly the failure §0f already predicted ("If §0e has not run either, the generation route 422s..."), just reached automatically via the redirect chain rather than by a student who happened to skip a step. **Fix**: `aiAnalysisComplete` now requires BOTH rows; a student in this state is now routed back to `/strategy/analysis`, which retries whichever half is missing and shows the correctly-scoped error (e.g. the §0e "Matching Report needs the database updated" message) instead of the confusing F7-page error two steps later. | `src/features/ai-strategy-dashboard/api/onboarding-status.ts` |
| Even with the gate fixed, a state/data race (or a Matching Report row deleted after the redirect check ran) could still land a student on the F7 page with `needsInputs: true` in the generation response. `StrategyRecommendationWorkspace`'s error state used to show a generic "Try again" that just re-ran the same doomed F7 call. It now detects `needsInputs` and redirects to `/strategy/analysis` instead — a page that can actually produce what's missing. | `src/features/ai-strategy-dashboard/ui/strategy-recommendation-workspace.tsx` |

**This does not, by itself, fix Matching Report generation** — if §0e's
migration genuinely has not run against production, a student will now
correctly bounce back to `/strategy/analysis` and see *that* page's error
instead, but they still cannot get a Matching Report (and therefore cannot
reach F7 or the Planner) until §0e is resolved. Verify §0e's migration state
before treating this fix as having restored the whole flow.

## 5f. Fixed 2026-08-08 — do not re-introduce

**Confirmed live and broken same day, after §0e's migration was run and §5e
shipped**: `/apply/[id]` jumped straight to
`/ai-strategy/[id]/strategy/analysis` for a real student, firing off the
`AnalysisWorkspace` AI-generation gate with zero explanation of what was
happening or why — no Overview, no chance to review or add reflections
first. Reported with a mockup of the intended flow: Apply → Overview → 
Reflections → analysis (auto-generated Personal Report + Matching Report,
free) → Personalized Strategy (paid/gated) → Planner, where "analysis" is
only ever reached by *finishing* the earlier steps, never as a default
landing page.

| What | Where |
|---|---|
| `strategy/page.tsx` only rendered `StrategyHome` (the Overview/marketing page) when `nextOnboardingStep(state) === 'personal-summary'` — i.e. only for a student with NEITHER `personalSummaryComplete` NOR `achievementsComplete` set. Both flags live on `student_profiles`, shared across every application a student has (see the note on `aiAnalysisComplete` in `domain/onboarding.ts`). So a student who had already done reflections once, for an EARLIER application, had both flags true from the moment they opened a brand new one — Overview was skipped entirely and they were redirected straight into `/strategy/analysis`, which auto-fires an AI generation call on load. **Fix**: gate on `!state.aiAnalysisComplete` instead (whether THIS application's analysis has run) — Overview now shows for every application until its own analysis exists. ⚠️ Its CTA target needed a SECOND fix the same day — see §5g, the first version here still skipped straight past reflections for a returning student. | `src/app/ai-strategy/[applicationId]/strategy/page.tsx` |
| `/apply/[applicationId]/page.tsx` independently recomputed `onboardingStepHref(nextOnboardingStep(state), id)` instead of delegating to `strategy/page.tsx`'s own (more complete) decision — the exact "two routers, one state machine" duplication that caused §5e the day before. It never had `strategy/page.tsx`'s Overview special-case at all, so fixing `strategy/page.tsx` alone would not have fixed this entry point. **Fix**: this page no longer computes anything — it authenticates, then bounces to `/ai-strategy/[id]/strategy` unconditionally, making `strategy/page.tsx` the single place that decides where a student belongs. | `src/app/apply/[applicationId]/page.tsx` |

⚠️ **Known, separate, NOT fixed here — the reflection forms ignore `return`.**
`onboardingStepHref('personal-summary', id, { returnTo })` builds a
`/ai-strategy/reflection?return=...` URL so that, after finishing
reflections, a student lands back at their application's analysis gate. But
`/ai-strategy/reflection` and `/ai-strategy/reflection/achievements` are
BOTH student-level pages reached from many unrelated places (the report
chrome's "Reflections" stage link, `ApplicantPortrait`'s "Update your
reflections" CTA, `PersonalReportView`, the marketing guide — none of which
pass a `return` param), and their submit handlers hardcode their own
next-page navigation (`reflection-about-form.tsx` → the achievements page;
`reflection-evidence-form.tsx` → `/ai-strategy/report`, a DIFFERENT, older,
student-level Personal Report page backed by `student_personal_reports`, NOT
the per-application `applicant_analyses` this whole onboarding pipeline is
built on). Neither form reads `useSearchParams()` at all — the `return`
param is dead plumbing today. **Practical effect**: a genuinely first-time
student who reaches Overview, clicks through both reflection steps, ends up
on `/ai-strategy/report` (the old per-student report) instead of back at
`/ai-strategy/[id]/strategy` where their new application's analysis would
actually run. This needs its own decision (what should the OTHER,
non-application entry points into `/ai-strategy/reflection` do instead?)
before it can be fixed — not folded into this incident's fix silently.

## 5g. Fixed 2026-08-08 — do not re-introduce

**Reported the same day, immediately after §5f shipped**: "the overview page
is not appearing correctly... it goes straight into doing the strategy
building instead of asking for reflections / confirming achievements then
generating the profile and matching reports." Two real, distinct bugs,
found while investigating.

| What | Where |
|---|---|
| §5f's fix pointed Overview's CTA (`startHref`) at `onboardingStepHref(step, id)` — "whatever the real next step is." For a returning student, `step` resolves straight to `'analysis'` (their reflections already globally complete, per §5f's own note), so the CTA fired the AI generation call the instant it was clicked, with no chance to review/update reflections for THIS application. **Fix**: the CTA now always targets `onboardingStepHref('personal-summary', id)`, unconditionally — the reflection pages already read back and pre-fill existing answers, so this is a "confirm/edit" step, not a "redo from scratch," and it is what "ask for reflections, confirm achievements, then generate" actually requires. | `src/app/ai-strategy/[applicationId]/strategy/page.tsx` |
| **The far bigger discovery**: `personal_summary_completed_at` and `achievements_completed_at` (`student_profiles`, added by `supabase-strategy-onboarding-state.sql`) were **never written by any code in this repository, anywhere** — grepped across the whole `src/` tree and confirmed: three read sites (`onboarding-status.ts`, `strategy/page.tsx`'s data, `apply/page.tsx`'s `fetchStrategyReadiness`), zero writes. `POST /api/reflection`'s `PATCH` saves the `about` payload to `student_profiles` and achievements/activities to their own tables, but never touched either completion timestamp. Practical effect: `personalSummaryComplete`/`achievementsComplete` were permanently `false` for every student who ever existed — `nextOnboardingStep` would return `'personal-summary'` forever, no matter how many times a student filled out and submitted both reflection steps. Combined with §5f/§5g's return-param fix (below), a student finishing achievements and being sent to `/strategy/analysis` would be IMMEDIATELY bounced back to reflections by that page's own guard (`step === 'personal-summary' → redirect`) — an infinite loop, the flow's actual dead end. **Fix**: `PATCH /api/reflection` now sets `personal_summary_completed_at` on the same upsert that saves `about`, and `achievements_completed_at` on a follow-up upsert whenever `achievements`/`activities` was sent (even empty — Requirement 4.3 explicitly allows a student with zero achievements to complete the step). | `src/app/api/reflection/route.ts` |
| Also wired the same day: `reflection-about-form.tsx` and `reflection-evidence-form.tsx` now read `?return=` (via `useSearchParams`) and carry it forward / navigate to it on submit, instead of hardcoding their own next-page — this is §5f's flagged-but-not-fixed gap, now closed for the application-originated case specifically. Every OTHER entry point into these forms (the report chrome's "Reflections" link, `ApplicantPortrait`'s "Update your reflections," `PersonalReportView`, the marketing guide) still passes no `return`, and keeps its old fallback behaviour (achievements page next, then `/ai-strategy/report`) unchanged. | `src/app/ai-strategy/reflection/reflection-about-form.tsx`, `src/app/ai-strategy/reflection/achievements/reflection-evidence-form.tsx` |

**Why this one was hard to catch from code review alone**: every piece in
isolation looked intentional — the columns exist, the domain layer's doc
comments describe them as "set by an explicit 'Continue' submit," the read
sites all correctly compute `Boolean(profile?.personal_summary_completed_at)`.
Nothing throws, nothing errors — a student just never advances, silently,
forever. A grep for **write** sites of a completion flag (not just read
sites) is the check that would have caught this before it shipped; add it to
manual QA for any new "…Complete" boolean on `OnboardingState`.

## 5h. Fixed 2026-08-12 — do not re-introduce

**Reported the same day, after §0d/§0e/§0f were confirmed resolved via the
production schema dump**: "we can't seem to get into the personal report or
the matching report" — `/strategy/analysis/portrait` and
`/strategy/analysis/fit` both 404'd for a real application. Not a migration
gap this time; a genuine column-name bug that the schema dump could not have
caught because it never went looking for these five names.

**Root cause**: `loadEvaluation` (`src/features/ai-strategy-dashboard/api/load-evaluation.ts`)
selected `tuition_fee, entry_requirements_summary, english_requirements_summary,
image_url, logo_url` directly off `course_applications`. Those columns do not
exist there — `course_applications` has two conflicting `CREATE TABLE IF NOT
EXISTS` definitions in this repo (`supabase-apply-system.sql`'s legacy
TEXT-id version, which *does* have all five, and `supabase-apply-v2.sql`'s
UUID-id version, which has none of them and is the one actually live in
production — confirmed by the application id in the bug report being a UUID,
not an `app_...` string). On the real table, `entry_requirements_summary` /
`english_requirements_summary` / the tuition fields live on `courses`
(joined via `course_applications.course_id`), and `logo_url` comes from
`universities` — both `src/lib/api/application-workspace.ts` and
`src/app/apply/page.tsx` already join correctly and were never affected.
`load-evaluation.ts` was the one place in the codebase selecting these five
names straight off `course_applications`, so it was also the only place that
broke — every other tab on the application (Overview, Planner, CV, Essay)
kept working, which is why the report was scoped to exactly these two pages.
Postgrest returns a column-not-found error for the whole query, and the code
only destructured `{ data }`, silently dropping the error — `application`
came back `null`, `loadEvaluation` returned `null` unconditionally, and both
report pages called `notFound()`. This affected every application, not just
the one in the bug report.

**Fix**: the initial select now only lists real `course_applications`
columns (dropped the five, added `course_id`); a second best-effort query
reads `tuition_fee_text` / `entry_requirements_summary` /
`english_requirements_summary` off `courses` by `course_id` (same pattern as
the existing `universities` join two lines below it), matching how
`application-workspace.ts` already reads the same fields. `image_url` /
`logo_url` were selected but never actually read anywhere in the function —
removed outright rather than wired up, since nothing consumed them.

**Also fixed the same session**: the report pages carried a second,
redundant navigation bar (`StageBar` in `report-chrome.tsx`, rendered inside
`ApplicantPortrait`/`ProgrammeFitReport`/`StrategyRecommendationReport`)
stacked directly under the brand-red `ApplicationNav` every page under
`/ai-strategy/[applicationId]` already gets from the layout — two bars
listing almost the same five destinations, sometimes disagreeing on what was
reachable. `StageBar` and its `STAGES` table are deleted; the report
components no longer take an `unlockedStages` prop. Separately, per explicit
product direction, `SubNav` (`src/shared/ui/sub-nav.tsx`) no longer renders a
locked entry as inert dimmed text — it omits it from the bar entirely.
`applicationSubNav()` still marks entries `locked` (so the data and the
routing agree on what's reachable), `SubNav` is just the one place that
decides whether a locked entry draws. | `src/features/ai-strategy-dashboard/api/load-evaluation.ts`, `src/features/ai-strategy-dashboard/ui/report-chrome.tsx`, `applicant-portrait.tsx`, `programme-fit-report.tsx`, `strategy-recommendation-report.tsx`, `strategy-recommendation-workspace.tsx`, `src/shared/ui/sub-nav.tsx`, `src/shared/lib/app-routes.ts` |

## 5i. Fixed 2026-08-12 — do not re-introduce

**Reported the same day, after the Matching-Report-as-start-page change made
it far more likely a student would actually reach a Planner task**: "each of
the planner tasks when we click into them don't load up" — a real recommendation
detail page (`/strategy/recommendations/[recId]`) threw instead of rendering.

**Root cause**: `recommendationFromRow`'s `parseContentBlock`/
`parseContentBlockValue` (`src/features/ai-strategy-dashboard/domain/recommendation.ts`)
only checked that the stored JSON's `type` field matched one of
`'structured_table' | 'long_text' | 'checklist'` — despite their own doc
comments claiming to be fully defensive, they let a `content_schema` like
`{ type: 'structured_table' }` (no `columns`) or `{ type: 'checklist' }` (no
`items`) straight through as a real, well-formed `ContentBlock`.
`StructuredTableInput`/`ChecklistInput` (`content-block.tsx`) then called
`.map()` on the missing array and crashed the whole detail page — server-side,
since these client components are still SSR'd on first load, so the crash
surfaced as the site's generic error page ("Something went off-orbit"), not a
404. `normalizeContentBlock` (`src/lib/ai/match-insights.ts`) has always
guaranteed a *freshly generated* block has a non-empty `columns`/`items`, so
this only bit rows written before that guarantee existed, or a `content_value`
saved against a `content_schema` that has since regenerated into a different
shape (see `updateFields`'s note in `recommendation.ts` on why a regenerate
never touches `content_value`) — exactly the "row written by a future/
different shape" case the doc comments described but the code didn't
actually check for.

**Fix**: both parsers now validate the **full** shape via zod
(`contentBlockSchema`, mirroring `normalizeContentBlock`'s own guarantees;
`contentValueSchema` already existed for `PATCH`'s request body and is now
reused for reads too), degrading to `null` on any malformed row instead of
throwing. `null` already has a real, intentional meaning on this page — "no
content block, the task is finished elsewhere" — so a malformed row now
reads the same as a `null` one rather than crashing. | `src/features/ai-strategy-dashboard/domain/recommendation.ts` |

## 5j. `ApplicationNavBackground` — a canvas animation confined to a real header has no room for full-strength text, and a flash must target one instance, not a whole row

**Not a bug fix — a design constraint worth recording**, discovered building
the header's kinetic-typography animation (`src/components/application-nav-background.tsx`)
in two passes. The reference the owner supplied was designed for a fullscreen
canvas with real empty space around the text; `ApplicationNav`'s actual
header is two tightly-packed lines with no spare height.

1. First pass drew the animation as a full-height backdrop behind the real
   breadcrumb/nav text (matching the reference layout) but flashed an
   entire tiled marquee row white at once. Confined to the real header, that
   read as the whole line turning white directly under "Overview / Personal
   Report / …" — unreadable. Shipped instead as a dedicated strip below the
   header (PR #167).
2. The owner asked for the animation to live inside the header's existing
   bounds instead, and to follow the reference's full three-phase spec
   (typing reveal + dual marquee + alignment flash), not the simplified
   strip version. Porting the reference's own alignment math found the real
   bug: it only ever highlights the ONE word instance whose position
   matches the trigger (`Math.abs(x - targetX) < 2`), not the whole row —
   the first pass's "whole row flashes" behaviour was never what the
   reference did, it was an over-simplification introduced while adapting
   it. Fixed to match per-instance, plus a low base-opacity pass
   (`BASE_ALPHA`/`FLASH_PEAK_ALPHA`) — three lines of decorative text at
   full strength directly behind two lines of real content is clutter at
   this scale even without a flash bug.

**Do not restore full-opacity multi-line text or whole-row flashes here** —
both were tried, both failed the same way: outshining or crowding the real
navigation. If this component grows a new phase or row, size it against the
header's own measured height (`ResizeObserver`, not viewport dimensions) and
keep highlights scoped to the single instance that triggered them.

## 5k. `ApplicationNav` — a delayed background-fill layer painted after the canvas buries the animation instead of backing it

Owner asked for three follow-on changes to §5j's animation: size the three
words to actually fill the header's height (rather than the deliberately
small text §5j settled on), restrict the boot line's flash to only its first
two characters ("Go", never the repeated `o`s after it), and hold the brand-
red fill plus the real breadcrumb/nav content back for ~3 seconds so a
visitor sees the animation play against the page's own background before the
chrome arrives (`gb-app-nav-reveal`, `src/styles/tokens.css`, `animation-delay:
3s`).

Implementing the delay introduced a real bug, caught only by pixel-sampling a
screenshot (a compressed PNG alone reads as "the animation vanished after the
red arrives" — the same false alarm §5j's build nearly repeated): the fill
was added as a sibling `<div>` **after** `ApplicationNavBackground` in JSX.
Plain elements with no `z-index` paint in DOM order, so once its fade-in
finished it was a fully opaque `bg-brand` layer sitting *in front of* the
canvas — not behind it. The animation kept running correctly the entire
time; it was just being painted over.

**The fill div must stay before the canvas in source order.** Correct stack,
bottom to top: delayed red fill → `ApplicationNavBackground` canvas → delayed
`Container` (breadcrumbs/nav). Before the 3s mark the fill is transparent, so
the canvas shows against the page's own background; after, the fill is
opaque red and the canvas draws on top of it, which is the point — the
marquee should read as texture on the red, not as a flash of white against
whatever the page happens to render before the header settles in.

## 5l. Every Planner task detail page 500'd — a server component was calling functions exported from a `'use client'` module

**This is the real cause of the "planner tasks don't load" report, and §5i was
not it.** §5i fixed a genuine latent bug in `parseContentBlock` (a malformed
`content_schema` crashing the genUI renderer), but that was never what students
were hitting: the page threw before it could reach any content block.

The task detail page
(`app/ai-strategy/[applicationId]/strategy/recommendations/[recommendationId]/page.tsx`)
is a server component. It imported `categoryLabel`, `categoryVariant`,
`formatDate`, `PRIORITY_LABEL` and `PRIORITY_VARIANT` from the feature's `ui`
barrel, which re-exported them from `planner-shared.tsx` — a `'use client'`
module. A client module's exports do not reach a server component as values;
they arrive as client references, and the two failure modes are asymmetric,
which is exactly why this survived a fix attempt and a round of review:

- **Calling one throws.** `categoryLabel(...)` → `Attempted to call
  categoryLabel() from the server but categoryLabel is on the client. It's not
  possible to invoke a client function from the server, it can only be
  rendered as a Component or passed to props of a Client Component.` The page
  renders `categoryVariant(rec.category)` whenever the task has a category, and
  a generated recommendation essentially always does — so **every** task detail
  page 500'd.
- **Reading one does not throw.** `PRIORITY_VARIANT[rec.priority]` silently
  evaluated to `undefined`, so the priority badge would have rendered with no
  variant and an empty label. Silent, and invisible next to the crash.

`dashboard-summary.tsx` (also a server component) had the same bug in a
narrower form: it called `formatDate(deadline)` from the client module, so the
Planner dashboard crashed for any application that had a deadline set and
worked for any that did not.

**The fix** is `planner-presentation.ts` — a plain module, no directive,
holding the pure mappings and the date formatter. A module with no directive
is usable from both graphs; `planner-shared.tsx` keeps only the React
components and imports its mappings from next door. **Never move these back,
and never add `'use client'` to `planner-presentation.ts`** — a component is
safe to import across the boundary (it renders as a Client Component), a
plain function or object is not.

Guarded by `planner-presentation.test.tsx`. A unit test cannot reproduce the
RSC boundary (vitest has one module graph), so it asserts the structural
property instead: the module stays directive-free, the barrel points at it
rather than at `planner-shared`, and `dashboard-summary.tsx` does not reach for
the client module to get `formatDate`. The directive check verifies itself
against `planner-shared.tsx` so it cannot quietly stop matching anything.

**How to check this class of bug in future:** a `next build` will not catch it
and neither will `tsc` — the types are identical either way, and the failure is
at render. A throwaway server-component route under `src/app/dev/` that calls
the suspect imports inside `try`/`catch` and prints the result reproduces it in
seconds without needing a database row, which is how this one was found and
confirmed fixed.

## 5m. Reflection was never asked the questions the reports read — and `goals` is shared, not free

**Not a crash — a silent quality problem**, found while acting on owner
feedback about the reflection pages.

`src/lib/ai/match-insights.ts` builds two of its prompt inputs from
`student_profiles` columns that reflection never wrote:

```
careerDirection  ← career_interests / goals / target_subjects
personalContext  ← the personal report's summary, else goals
```

and F7 scores every candidate direction on a `futureAlignment` dimension
defined as "fit with the target programme and **career direction**". Reflection
is the one flow every student completes, and it asked for none of it — so for
anyone who never visited the separate `/profile` pages, the model was scoring
future alignment against a blank and nothing anywhere said so. Three questions
now fill it (career goal, why-this-subject, target intake).

**⚠️ `goals` IS SHARED. DO NOT ADD A SECOND CAREER-GOAL COLUMN.** It is a base
schema column that `supabase-strategy-personal-summary.sql` already repurposed
as "Career goals" for the unified profile editor, and reflection's career-goal
question writes to that same column deliberately. A second column for the same
fact is how the reflection form and the profile editor end up showing a student
two different answers to the same question. Only `study_motivation` (the reason
for the choice, which is genuinely not the destination) and `target_intake`
were added.

**The PATCH degrades rather than failing.** `/api/reflection` retries the
upsert without the two new columns on a `42703`/`PGRST204`, following the
`migrationMissing()` pattern `match-insights/route.ts` established. This
project has a standing habit of shipping code ahead of its migrations
(§0d–§0f were all instances), and without the retry an unapplied
`supabase-reflection-questions.sql` would cost a student their nationality,
grades and budget — the whole step — over two optional answers.

## 5n. Fixed 2026-08-13 — do not re-introduce

**Reported in production**: confirming Candidate Information ("Confirm &
Generate Reports") failed for a real student with "We could not confirm
your information. Please try again." — `POST
/api/candidate-information/confirm` returned `503`. The owner had already
run `supabase-candidate-confirmation.sql` against the live Supabase project
before reporting this, ruling out the migration-not-run explanation the 503
message implied.

**Root cause, and it's two bugs, not one.** (1) `supabase-candidate-
confirmation.sql` created `confirmed_candidate_snapshots` with RLS enabled
and only a `SELECT` policy — no `INSERT` policy. The confirm route inserts
through the ordinary user-session client (`createClient()`, not
`createAdminClient()`), because confirming is an action the signed-in
student takes on their own profile, so RLS applies to that insert like any
other write in this app. With no `INSERT` policy, RLS defaults to denying
every insert, including the owner's own — Supabase returned `403`,
Postgres code `42501` (`insufficient_privilege`), message `new row violates
row-level security policy for table "confirmed_candidate_snapshots"`. (2)
The route's own `migrationMissing()` classifier made the failure mode worse:
it matched ANY error whose message contained the string
`confirmed_candidate_snapshots` (meant to catch "relation does not exist"),
and the RLS-violation message above happens to contain exactly that
substring — so a genuine permission error was misclassified as "migration
not run yet," returning the `503`/"try again shortly" that could never
actually succeed on retry, since nothing about waiting or retrying grants
the missing permission.

**Fix**: added the missing `INSERT WITH CHECK (auth.uid() = user_id)`
policy to `supabase-candidate-confirmation.sql` (idempotent — safe to
re-run on a project that already has the table). Also narrowed
`migrationMissing()` in `route.ts` to only match Postgres/PostgREST codes
that actually mean "does not exist" (`42703`, `PGRST204`, `42P01`) or a
message containing the phrase "does not exist" — no longer matches on a
table/column name appearing anywhere in an unrelated error's message, so a
future permission or constraint error surfaces as a real `500` instead of
the misleading "come back later" `503`. New test asserts a `42501` RLS
error returns `500`, not `503`.

## 5o. Fixed 2026-08-13 — do not re-introduce

**Reported live**: "the candidate information for a new application can't be
confirmed, it's always the same [profile] — you can't generate reports for
new applications." A student with one already-confirmed application could
not get a second, new application through onboarding at all.

**Root cause: a client-side navigation dead end, not a backend/gating bug.**
`student_profiles.confirmed_at` (and `confirmed_candidate_snapshots`) are, by
design, per-STUDENT, not per-application — Candidate Information is one
shared profile across every application a student has (see the file-level
comment on `OnboardingState` in `onboarding.ts`). Report generation itself
(`applicant_analyses`/`application_match_analyses`) is correctly keyed by
`application_id` and was never broken — a student who somehow reached
`/ai-strategy/<newAppId>/strategy/analysis` directly would have generated
reports for it just fine. The break was in getting there:
`/ai-strategy/[applicationId]/strategy/page.tsx`'s CTA (added by §5f, before
the Review & Confirm checkpoint existed) unconditionally linked to
`onboardingStepHref('personal-summary', id)`, i.e.
`/ai-strategy/reflection?return=...`, for every application. But once
`confirmed_at` is set (true for every application once true for any one of
them), `/ai-strategy/reflection` and `/ai-strategy/reflection/achievements`
render `ConfirmedReflectionView`/`ConfirmedAchievementsView` instead of the
editable form — a deliberately button-free "here's what you confirmed"
summary, with no Next/Continue action and no `returnTo` even threaded into
it. A student clicking "Start My Strategy" on a new application's Overview
therefore landed on a screen with nothing to click; the only way out (the
"Overview" breadcrumb) bounced them straight back to the same CTA — an
infinite loop with no error message anywhere.

**Fix, two parts:**
1. `strategy/page.tsx`'s CTA now targets `onboardingStepHref(nextOnboardingStep(state), applicationId)`
   instead of a hardcoded `'personal-summary'`. This is safe now in a way it
   was not when §5f's original comment was written: the Review & Confirm
   `'confirm'` step (added later, #174) sits between "reflections done" and
   `'analysis'` in the step order, so a not-yet-confirmed student is still
   routed through reflections → achievements → confirm, in order, exactly as
   before. Only once `candidateConfirmed` is already true does the CTA now
   correctly skip straight to `'analysis'` — there is nothing left to review,
   since a confirmed profile is by definition the one already reviewed and
   approved.
2. `ConfirmedReflectionView`/`ConfirmedAchievementsView` gained an optional
   `returnTo` prop (threaded through from each page's own `?return=` search
   param) rendering a "Continue" button to it when present, as a defensive
   escape hatch for any other way a student could land on these
   already-confirmed views (a bookmark, the browser Back button, a stale
   link) with nothing else to click.

**What was deliberately NOT done**: adding `application_id` to
`confirmed_candidate_snapshots`/`student_profiles.confirmed_at` to make
confirmation per-application. That would contradict this feature's explicit,
tested design — Candidate Information is one profile shared across every
application, confirmed once — and would be a much larger schema change for a
bug that was actually a missing link on a screen, not a data-modeling gap.

**If this is still failing after both fixes ship**: re-run
`supabase-candidate-confirmation.sql` in the Supabase SQL editor (it is
idempotent) to pick up the new policy — the code fix alone does not grant
the missing database permission; the migration must actually be re-run.
| `supabase-candidate-confirmation.sql`, `src/app/api/candidate-information/confirm/route.ts` |

## 5p. Fixed 2026-08-13 — do not re-introduce

**§5o's own fix was itself wrong, per explicit owner correction the same
day.** §5o's item 1 (`strategy/page.tsx`'s CTA now targeting
`onboardingStepHref(nextOnboardingStep(state), applicationId)`) fixed the
dead-end loop, but had a side effect: once a student had confirmed on ANY
application, `candidateConfirmed` (read from the GLOBAL
`student_profiles.confirmed_at`) was true for every future application too —
so a brand-new application's onboarding silently skipped Reflections,
Achievements, AND Review & Confirm entirely and jumped straight into report
generation. Reported live: "this is wrong. We want them to go through the
normal reflections and application UI again... but for the flow to always be
the same." §5o's own "what was deliberately NOT done" note (ruling out
per-application confirmation as too large a change) was reconsidered and
reversed here, at the owner's explicit direction.

**Fix: made the entire onboarding review/confirmation state per-application**,
not per-student. New migration `supabase-per-application-onboarding.sql`
adds `personal_summary_reviewed_at`, `achievements_reviewed_at`,
`candidate_confirmed_at` to `course_applications` (plus a nullable
`application_id` on `confirmed_candidate_snapshots`, tagging each
confirmation with the application it belongs to). `fetchOnboardingState`
(`onboarding-status.ts`) now reads these three columns instead of the global
`student_profiles` ones — the change that makes `nextOnboardingStep` correctly
resolve to `'personal-summary'` for every new application again, restoring
§5o's CTA fix to actually work as intended. `apply/page.tsx`'s
`fetchStrategyReadiness` (the "ready" vs "continue applying" label on My
Portal tracker rows) got the same per-application fix, since it had the
identical global-flag bug independently. The underlying candidate data
(`student_profiles`, `student_achievements`, `student_activities`) stays one
profile shared across every application, unchanged — only the
review/confirmation STATE is now tracked separately per application, so a
student can edit it again for a new application even after locking it for an
earlier one (`PATCH /api/reflection`'s lock and `POST
/api/candidate-information/confirm`'s idempotency both moved from
`student_profiles.confirmed_at` to `course_applications.candidate_confirmed_at`
for the application in question, verified server-side via the new
`verifiedApplicationId` — `applicationId` arrives from the client already
derived from an untrusted `?return=` URL via `applicationIdFromPath`, the
same pattern `ApplicationNavFromReturn` already used, and is never trusted
without an ownership re-check).

Per explicit owner direction: the flow order is always Reflections →
Achievements → Review & Confirm → Analysis, for every application, with a
one-click "Skip — my answers/achievements are still correct" button at the
top of the first two pages for a returning student who does not need to
retype anything — never an automatic system skip. Every entry point with no
application context (the legacy `/ai-strategy/report` generation) keeps
today's exact global-fallback behaviour, unchanged, when no `applicationId`
resolves.

| `supabase-per-application-onboarding.sql`, `onboarding-status.ts`, `src/app/api/reflection/route.ts`, `src/app/api/candidate-information/confirm/route.ts`, `candidate-snapshot-repository.ts`, `verified-application-id.ts`, the three reflection pages, `reflection-about-form.tsx`, `reflection-evidence-form.tsx`, `review-confirm-view.tsx`, `apply/page.tsx` |

## 5q. Fixed 2026-08-14 — do not re-introduce

**§5p shipped the per-application migration, but two things still broke,
reported live the day after with the migration already run in production**:
"the continue button on the read only doesn't work and the header isn't
updating correct with reflections being added as an option (the continue
should either lead to reports being generated or to the personal report
page)."

Root cause of both: `reflection/confirm/page.tsx` (Review & Confirm) redirected
away unconditionally the moment `confirmedAt` was set —
`if (confirmedAt) redirect(returnTo || '/ai-strategy/report')`. That meant
the one page the owner wanted a "Reflections" nav entry to link to, read-only,
could never actually be rendered in its confirmed state — there was nothing
for `applicationSubNav()` to point at, and no page for a `?return=`-carrying
Continue button anywhere in the flow to land on.

**Fix, three parts:**

1. `reflection/confirm/page.tsx` now renders `ReviewConfirmView` in a new
   `readOnly` mode instead of redirecting once `confirmedAt` is set — the
   acknowledgement checkbox, Confirm button, edit links and confirmation
   modal are all hidden; a confirmed banner and a "Continue" button replace
   them, matching what `ConfirmedReflectionView`/`ConfirmedAchievementsView`
   already did for the other two Candidate Information pages.
2. `applicationSubNav()` (`src/shared/lib/app-routes.ts`) gained a
   `candidateConfirmed` option and a `reflections` entry that links to
   `/ai-strategy/reflection/confirm?return=...` — it REPLACES `overview`
   once `analysisReady` is true (owner: "maybe remove the overview option
   after we've generated the reports"), rather than both showing at once.
   `activeSubNavKey()` now maps every `/ai-strategy/reflection*` path to
   `'reflections'` so the tab highlights correctly on all three Candidate
   Information pages.
3. The "Continue" button on all three read-only Candidate Information views
   (`ReviewConfirmView`, `ConfirmedReflectionView`, `ConfirmedAchievementsView`)
   used to carry a raw, static `returnTo` query param — which could point at
   the analysis gate even after this application's reports already existed,
   or nowhere at all if the page was opened without one. All three now take a
   computed `continueHref` instead, built by the new
   `confirmedReflectionContinueHref(applicationId, aiAnalysisComplete)`
   (`domain/onboarding.ts`): the report-generation gate while reports are
   still pending, the Personal Report once they exist. Each of the three
   pages computes it with one extra `fetchOnboardingState` call when
   `applicationId` resolves, falling back to the legacy raw `returnTo` when it
   does not (no-application-context entry points, unchanged).

| `src/shared/lib/app-routes.ts`, `src/components/application-nav.tsx`, `src/features/ai-strategy-dashboard/domain/onboarding.ts`, `src/app/ai-strategy/reflection/confirm/page.tsx`, `src/app/ai-strategy/reflection/confirm/review-confirm-view.tsx`, `src/app/ai-strategy/reflection/page.tsx`, `src/app/ai-strategy/reflection/confirmed-reflection-view.tsx`, `src/app/ai-strategy/reflection/achievements/page.tsx`, `src/app/ai-strategy/reflection/achievements/confirmed-achievements-view.tsx` |

## 5r. Deleting an application leaves its reports/tasks/CV+statement work behind — migration written, NOT YET CONFIRMED RUN

**Reported live 2026-08-14**: "the delete for an application isn't working as when an application is deleted, all the other elements outside the direct application (including reports) are kept."

`DELETE /api/applications/[id]` (`src/app/api/applications/[id]/route.ts`) has
always been, deliberately, a single `DELETE FROM course_applications` with
nothing else — its own doc comment says every child table is `ON DELETE
CASCADE`, and every one of this repo's `supabase-*.sql` files DOES declare
that on every table that stores per-application data (`application_stages`,
`application_tasks`, `application_requirements`, `application_sources`,
`application_match_analyses`, `application_recommendations`,
`application_events`, `applicant_analyses`,
`application_strategy_recommendations`, `application_strategies`,
`application_lor_strategies`, and the CV/statement/coach tables one level
further down via `application_strategies`/`application_recommendations`). On
paper this should already work.

**Root cause: the exact trap §0 already cost the owner four re-runs over.**
`CREATE TABLE IF NOT EXISTS` is a no-op against a table that already exists;
editing a `CREATE TABLE` statement's `ON DELETE` clause after the table has
already been created in production does nothing to the live constraint. If
any of these tables were first created before their file's `CASCADE` clause
was written — plausible across 60 migration files iterated on over many
sessions — production is still enforcing whatever delete rule (typically `NO
ACTION`) the table had on day one, regardless of what the `.sql` file says
today. Verifying this needed live `information_schema` access this session
did not have (no `SUPABASE_SERVICE_ROLE_KEY` in the sandbox, the same
recurring limitation noted throughout this file) — the fix below does not
depend on knowing in advance which tables actually drifted.

**Fix**: `supabase-application-cascade-repair.sql` — for each (child table,
FK column, parent table) triple, looks up the ACTUAL constraint by name via
`information_schema` (not a guessed name), drops it, and re-adds an
identical one with `ON DELETE CASCADE` — a genuine no-op wherever the
constraint was already correct, a real repair wherever it was not. Before
tightening each constraint it also deletes any row already orphaned by the
drift (a child row whose `application_id`/`strategy_id`/etc. no longer
points at an existing parent) — otherwise `ADD CONSTRAINT` fails outright the
moment a single past buggy delete has already left one behind, and leaving
those rows in the database is the exact "keep our databases clean" complaint
this migration exists to fix. Only touches tables that exist in the target
environment, so it is safe regardless of which optional migrations have been
applied, and safe to run repeatedly. `confirmed_candidate_snapshots` and
`personal_statements` are deliberately excluded — their `application_id` FK
is `ON DELETE SET NULL` by design (a statement or a confirmation snapshot
stays the student's own even once the application it was drafted for is
gone), not a bug.

⚠️ **Action required in production — this migration has NOT been confirmed
run.** Until it is, deleting an application will keep leaving orphaned rows
in these tables (invisible in the app, since every read filters by
`application_id`, but present in the database).

| `supabase-application-cascade-repair.sql` |

## 5s. Personal Report had no nav, was partly in Vietnamese, forced a locked-page detour, and linked to the wrong Matching Report — fixed 2026-08-14

**Reported live from a screenshot of `/ai-strategy/personal-report`**: no
header nav/breadcrumb on either the Personal Report or Reflections pages;
several report sections rendered in Vietnamese despite the product being
English-only outside the `t()` translation layer; gap-filling actions
("Explain why you are interested in these subjects") sent students to the
Reflections page even after it was locked by confirmation, a dead end; and
the bottom CTA always linked to the generic `/ai-strategy/matching` instead
of `/ai-strategy/<id>/matching-report` for the application actually being
viewed. The screenshot also showed a literal `"...|null"` suffix leaking
into rendered text (e.g. "Accepted onto the program.|null").

**Fix, four parts:**

1. **Navigation.** `/ai-strategy/personal-report/page.tsx` now accepts
   `searchParams: Promise<{ return?: string }>`, derives + re-verifies
   `applicationId` from `return` the same way
   `ApplicationNavFromReturn` (reflection pages) already does, and renders
   that nav component. `aiStrategyApplicationNav()`'s `personalReport` entry
   (`src/shared/lib/ai-strategy-route-model.ts`) now carries the same
   `?return=<app>/strategy/analysis` shape as `reflections`, so the nav
   round-trips correctly regardless of which application the student came
   from — the report itself stays user-level, only the nav context is
   per-application.
2. **English-only content.** `src/features/apply/domain/personal-report.ts`,
   `src/lib/ai/personal-report-v2.ts`, `personal-report-v2-view.tsx`,
   `candidate-context.ts`, and the two report/match-insights API routes had
   hardcoded Vietnamese strings written directly into template/boilerplate
   code (headlines, interpretations, fallback labels, API error messages,
   the untrusted-data warning sent to the model) — not a translation-system
   failure, `t()`/the i18n dictionaries were never involved for these. All
   translated to English. `candidateConfidence().limitations` in
   `ai-reports.ts` is confirmed genuinely dead code (only `.score` is read
   anywhere) and was deliberately left as-is, out of scope.
3. **The literal `"|null"` bug.** Three AI extraction prompts
   (`cmcaitf-extraction.ts`, `narrative-activity-extraction.ts`,
   `competency-extraction.ts`) used an ambiguous `"...|null"` shorthand to
   mean "this field is a string or null" in their JSON-schema hint; the
   model sometimes echoed it literally. Fixed both ends: the prompts now
   show a concrete worked example with a real mix of string/`null` fields
   instead of the shorthand, and a new
   `sanitizeExtractedField()` (`src/lib/ai/evaluation/sanitize-extracted-field.ts`)
   strips a literal trailing `|null`/lone `"null"` from every extracted
   string field as defence-in-depth.
4. **Inline report-answering, without reopening the confirmed-data lock.**
   The owner chose (explicit decision, not a default): new answers to a
   report's own follow-up questions go into a separate
   `personal_report_supplements` table (`user_id`, `field_key`, `answer`),
   read only when generating this report and merged onto a COPY of the
   candidate context in memory — the confirmed `student_profiles` snapshot
   and its lock are never touched or reopened. `IntakeAction` gained an
   optional `fieldKey` marking which gaps are inline-answerable this way vs.
   which still require the full Achievements form. Currently only
   `study_motivation` (`STUDY_MOTIVATION_SUPPLEMENT_KEY`) is wired up. New
   `POST /api/ai-strategy/personal-report/supplement` saves an answer (zod
   validates `fieldKey` against an explicit allow-list); the client then
   calls the existing generate endpoint to regenerate. The bottom CTA now
   receives `matchingReportHref` computed by the page
   (`/ai-strategy/<id>/matching-report` when an application resolves, the
   generic `/ai-strategy/matching` otherwise) instead of a hardcoded generic
   link.

⚠️ **Action required in production — `supabase-personal-report-supplements.sql`
has NOT been confirmed run.** Until it is, the supplement save route
degrades to a 503 (tolerant-select/migration-missing pattern, same as every
other optional migration in this file) rather than 500ing.

| `src/app/ai-strategy/personal-report/page.tsx`, `src/shared/lib/ai-strategy-route-model.ts`, `src/features/apply/ui/personal-report-v2-view.tsx`, `src/features/apply/domain/personal-report.ts`, `src/lib/ai/personal-report-v2.ts`, `src/features/apply/api/candidate-context.ts`, `src/features/apply/api/personal-report-v2-repository.ts`, `src/app/api/ai-strategy/personal-report/route.ts`, `src/app/api/ai-strategy/personal-report/supplement/route.ts`, `src/app/api/applications/[id]/match-insights/route.ts`, `src/lib/ai/evaluation/sanitize-extracted-field.ts`, `src/lib/ai/evaluation/cmcaitf-extraction.ts`, `src/lib/ai/evaluation/narrative-activity-extraction.ts`, `src/lib/ai/evaluation/competency-extraction.ts`, `supabase-personal-report-supplements.sql` |

## 5t. Personal Report stopped generating across multiple applications — replaced the one-row cooldown model with append-only versions — fixed 2026-08-14

**Reported live, immediately after §5s shipped**: "The personal report now
isn't generating at all. I believe this is because it's shared with multiple
applications." The owner also asked for the report to be regenerable over
time with git-style version history (a dropdown to view older versions), and
for two concrete regeneration triggers: whenever a Matching Report
generates, and after a student answers one of the report's own follow-up
questions.

**Root cause, confirmed by reading the two generation call sites together**:
`student_personal_reports` was one row per student (`user_id` PRIMARY KEY,
upserted on every regeneration) with a 24h "free tier" regeneration cooldown
— a limit built around a single manual "regenerate" button. Once
per-application onboarding (§5p) made editing achievements/reflections
possible again for every new application, a student routinely changed their
SHARED profile between applications; `AnalysisWorkspace`'s
`fetchOrGeneratePersonal` fires on every application's confirm screen, so a
student progressing through a second or third application kept hitting the
cooldown wall on a report that had nothing to do with the application in
front of them — the POST returned `429` with `stale: true`, and the confirm
screen showed the Personal Report card as failed with no way to clear it for
24 hours. This is exactly what "shared with multiple applications" was
describing.

**Fix — replaced the model, not just the limit:**

1. New append-only `student_personal_report_versions` table
   (`supabase-personal-report-versions.sql`) — every generation is its own
   row (same shape `application_match_analyses` already uses for the
   Matching Report), never upserted. A one-time idempotent backfill copies
   each student's existing latest `report_v2` row over as their first
   version, so nobody's history appears to start empty.
2. **No more time-based cooldown.** Regeneration is now gated purely on
   whether the input actually changed (`shouldRegenerate`, checked before
   any OpenAI call, so a same-day repeat trigger with no real change costs
   nothing extra) — an explicit owner decision (`AskUserQuestion`:
   "remove the time cooldown," recommended because the hash check already
   prevents wasted calls and is exactly what fixes this bug).
3. Every version stores a `trigger` (`'manual'` | `'matching_report'` |
   `'supplement_answer'`) recording why it was created, shown in the
   version-history dropdown.
4. New shared orchestration, `regeneratePersonalReport`
   (`src/features/apply/api/personal-report-generation.ts`) — the one place
   that loads context+supplements, hashes, decides regenerate-or-cached, and
   writes a new version. Used by both `POST
   /api/ai-strategy/personal-report` (`trigger: 'manual'`/`'supplement_answer'`,
   client-driven) and, new, `POST /api/applications/[id]/match-insights`
   (`trigger: 'matching_report'`, called best-effort right after a
   successful Matching Report insert — never fails the Matching Report
   response if the refresh itself fails).
5. Two new read routes, `GET /api/ai-strategy/personal-report/versions`
   (list) and `GET /api/ai-strategy/personal-report/versions/[id]` (one
   version, ownership-checked by filtering on the signed-in user's id in
   the query itself). `PersonalReportV2View` gained a version-history
   `Select` (hidden when there is only one version) — picking a past
   version fetches and displays it read-only: the Driving Force inline
   "Answer this" action falls back to a plain link instead of accepting a
   new answer, and a banner offers "Back to latest."

⚠️ **Action required in production — `supabase-personal-report-versions.sql`
has NOT been confirmed run.** Until it is, `getLatestPersonalReportV2`
degrades to `migrationMissing: true` and the report page shows its
not-enabled state — same tolerant-select/migration-missing pattern as every
other optional migration in this file.

**Also fixed while wiring the shared orchestration into a second call site**:
`buildProfileEvaluationInput` (`src/lib/ai/personal-report-v2.ts`) always
called its three extraction functions with `model` — `string | undefined`
from an optional param — which is a genuine `exactOptionalPropertyTypes`
violation invisible until a `features/apply/api` file (subject to
`tsconfig.strict.json`) imported it transitively for the first time.
Widened `extractCmcaitfFields`/`extractCompetencyClaims`/`extractRoleAndTheme`'s
`model?: string` params to `model?: string | undefined` — no behavior
change, just makes the existing call site typecheck under strict mode.

| `supabase-personal-report-versions.sql`, `src/features/apply/api/personal-report-v2-repository.ts`, `src/features/apply/api/personal-report-generation.ts`, `src/app/api/ai-strategy/personal-report/route.ts`, `src/app/api/ai-strategy/personal-report/versions/route.ts`, `src/app/api/ai-strategy/personal-report/versions/[id]/route.ts`, `src/app/api/applications/[id]/match-insights/route.ts`, `src/app/ai-strategy/personal-report/page.tsx`, `src/features/apply/ui/personal-report-v2-view.tsx`, `src/features/apply/domain/personal-report.ts`, `src/lib/ai/evaluation/cmcaitf-extraction.ts`, `src/lib/ai/evaluation/competency-extraction.ts`, `src/lib/ai/evaluation/narrative-activity-extraction.ts` |

## 5u. Personal Report still missing its nav band after §5s — three more entry points never carried `?return=` — fixed 2026-08-14

**Reported live, with a real screenshot**: opening the Personal Report still
showed the plain site header (no red `ApplicationNav` band), and the
"Add more detail to your existing activities" gap action navigated straight
to `/ai-strategy/reflection/achievements`, which read-only once any
application has ever been confirmed (`student_profiles.confirmed_at` is a
global "has ever confirmed once" flag — see §5p) — a dead end for a student
trying to enrich a thin achievement description.

**Root cause**: §5s fixed the ONE entry point that already had `?return=`
threading right (`aiStrategyApplicationNav()`'s nav tab) and made every
in-page link (gap actions, "View confirmed information") correctly carry
whatever `returnTo` the page received — but never audited every OTHER route
that navigates a student TO `/ai-strategy/personal-report` in the first
place. Three had an `applicationId` sitting right there in scope and simply
never used it, so `returnTo` was `undefined` by the time the student landed:

1. `AnalysisWorkspace`'s `personalHref` (`analysis-workspace.tsx`) — the
   "View my reports"/"Open report" links on the confirm screen, the most
   common path into the Personal Report right after generation.
2. `confirmedReflectionContinueHref` (`domain/onboarding.ts`) — the
   "Continue" button on the read-only Reflections / Achievements / Review &
   Confirm views once reports exist. This is very likely the exact path
   the reporting screenshot came from.
3. `/ai-strategy/[applicationId]/strategy/analysis/portrait` — the legacy
   compatibility redirect alias; it didn't even destructure `params`, let
   alone use `applicationId` from it.

**Fix**: all three now build
`` `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy/analysis`)}` ``,
the same shape every other entry point already used. With `returnTo`
correctly populated, `ApplicationNavFromReturn` renders the band again, and
— since `InsufficientDataCard`'s gap-action buttons already run every
`action.href` through `withReturn()` (built in §5s) — "Add more detail"
now correctly lands on THIS application's own achievements page with its
own per-application lock state, editable whenever that specific
application hasn't been confirmed yet, instead of silently consulting the
global flag.

**Not a separate bug, likely the same complaint**: the same report was also
described as looking shallow — several sections saying "more evidence
needed" despite six achievements existing. Investigated the evaluation
engine's synthesis thresholds (`synthesisReadiness`,
`src/shared/evaluation/f4-narrative-identity.ts`): activity COUNT was fine
(7 items clears the 3+ "mature" floor); what was missing was `role`/
`behaviour`/context text on each record, which only comes from a rich
`detail`/`description` field the extraction pipeline can synthesise from —
short one-line achievement entries ("accepted onto the program") genuinely
do not carry that. The report is deliberately built to say "insufficient
evidence" rather than invent depth from thin data (CLAUDE.md's own rule for
this feature). The gap-filling loop this section fixes IS the intended way
a student adds that missing depth — it was simply broken, so no student
could ever complete it. Not re-touching the evaluation engine's scoring
itself without a specific product call on what "good enough" should look
like once the loop is verified working with real added detail.

| `src/features/ai-strategy-dashboard/ui/analysis-workspace.tsx`, `src/features/ai-strategy-dashboard/domain/onboarding.ts`, `src/app/ai-strategy/[applicationId]/strategy/analysis/portrait/page.tsx` |

## 5v. Founder confirmed manual Plus, but the account stayed Free — fixed in code 2026-08-15, production migration pending

Production readback showed three manual Plus transactions with an in-time
founder confirmation, `manual_payment_reviews.state='confirmed'`, but
`payment_transactions.status='paid_unfulfilled'`; all three had no
`plus_subscriptions` row and the owning profile remained `plus_status=false`.
This was not a client cache or entitlement-reader problem.

The shared `fulfill_payment_transaction` function placed the profile update,
subscription insert, ledger fulfilment, and `student_confirmed` outbox insert
inside one exception block. Any SQL error — most plausibly the live outbox
`kind` CHECK retaining an older value set because `CREATE TABLE IF NOT EXISTS`
cannot repair an existing constraint — rolled every entitlement write back.
The handler then suppressed `SQLSTATE`/`SQLERRM`, changed only the ledger to
`paid_unfulfilled`, and returned JSON rather than a database error. Both founder
routes consequently looked successful even though access was never activated.

`supabase-manual-payment-fulfillment-repair.sql` is an append-only follow-up:
it enumerates and replaces the actual outbox kind CHECK, moves notification
enqueue into its own guarded block so email cannot roll back the product,
records bounded failure diagnostics, and adds a service-role-only idempotent
reconciliation function. Its final block repairs only manual Plus transactions
with an explicit founder-confirmed review and no completed subscription.
Per the owner's explicit decision, Plus receipt confirmation has no deadline;
mentorship still respects slot ownership/hold expiry because a late review must
not reclaim a scarce slot. The founder APIs now return HTTP 409 for a real
`paid_unfulfilled` result instead of presenting it as success.

**Action required:** run `supabase-manual-payment-fulfillment-repair.sql` in
production. It has not been run from this workspace; until it runs, the three
existing transactions remain unfulfilled.

| `supabase-manual-payment-fulfillment-repair.sql`, `src/app/api/admin/payments/manual/confirm/route.ts`, `src/app/api/admin/payments/review-action/route.ts`, `src/lib/payments/manual-payment-migration.test.ts`, `src/app/api/admin/payments/manual/review-security.test.ts` |

## 6. Open questions for the designer / owner

1. **The sitemap frame (`123:2864`, "Dg-final") no longer exists in the file.**
   Both canvases were scanned at full depth on 2026-07-27 — no `123:*` node, no
   node named like a sitemap. `nav-items.ts` cites it as the reason
   `/ai-strategy` and `/apply` stay separate destinations; that citation is now
   dead. Restore the frame, or re-confirm the split some other way.
2. **Scholarship code field** (`223:13022`) — new feature needing a backend, or drop it from the design?
3. **Mentorship public-read RLS** — see 1b above. `achiever_profiles`,
   `mentor_availability_slots` and `session_reviews` all need anon read policies
   (approved / open / visible respectively); currently worked around with the
   admin client in six places.
4. **Should `/mentors/[id]` be public at all?** It is, and so is the directory
   that links to it. But the in-page university detail on `/universities` is
   sign-in gated, so the two public surfaces now disagree about what a guest may
   see. Not a bug — a product decision nobody has made explicitly.
5. **Review authorship** — see 2b. `session_reviews` has no name column. Add one
   (or join `student_profiles`), or accept "Glowbal student". Decide first
   whether a reviewer's name should be public at all.
6. **Error ramp** — `tokens.css` ships an Untitled UI stock error ramp. No frame draws an error state, so it is unconfirmed.
7. **Ratings badge** — "Best AI Tool · 2,000+ reviews" is placeholder the owner asked to keep temporarily. It appears in the footer of every page, so it is a public claim.
8. **X (Twitter)** — drawn in the footer frame `104:7422` with no handle supplied. Currently omitted; Instagram has no art in Figma at all (hence the hand-shaped `InstagramMark`).
9. **Rose `#e11d48`** — confirmed as brand by the owner, but Figma variables still resolve to Untitled UI purple `#6941c6`. `tokens.css` is the authority; do not "correct" it against a variable dump.
10. **`public/home-contact-team.jpg` is too small for retina.** The master is
   1200×675 (145 KB), added by the owner in `a0d165b`. The Home contact card
   crops 16:9 into a 576×533 box, which uses only ~61% of the width — so a
   DPR-2 screen needs a **~1900 px wide** source and the file caps out at 1200.
   The `sizes` fix above makes DPR 1 pixel-exact; DPR 2 is still upscaled 1.58×
   and visibly soft. **Needs a higher-resolution export of the same photo** —
   drop it in at the same path, ≥1920×1080 (ideally 2400×1350), 16:9. No code
   change required. Alternatively re-crop the framing so less of the width is
   thrown away, but `home-contact.tsx` documents the 576×533 crop as
   design-intended, so ask before changing it.
