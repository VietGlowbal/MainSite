# Database audit — 2026-09-05

Point-in-time snapshot of the live Supabase schema. Not a status board. Every
number here was measured against the running database on 2026-09-05; re-measure
before quoting a figure as current.

**Scope:** read-only. No schema was modified, no migration written, no
destructive SQL run. Proposed changes are flagged, not applied.

## 0. How this was measured, and what could not be

The Supabase MCP connector is authorised for organisation `mtyzomsqjqtxkpxvexbu`,
whose only project is **AIMS** (`fbtbxcgadyrdfhzsvwom`) — paused, and not this
app. The live project is **`uooshbumyilwvbgmbixx`** (from `.env.local`). So
`list_tables`, `list_migrations`, `list_extensions` and `get_advisors` could not
be pointed at the real database.

`get_advisors` returned `{"lints": []}` for the paused AIMS project. **That is
an empty result from the wrong database, not a clean bill of health.** Do not
quote it.

Substitute method, against the live project:

| Tool | Gave us |
|---|---|
| PostgREST OpenAPI (`/rest/v1/`, service role) | 113 relations, columns, types, NOT NULL, PKs, in-schema FKs, 33 RPCs |
| Per-table `HEAD` + `Prefer: count=exact`, service role | true row counts |
| Same, **anon key** | what an unauthenticated visitor can read |
| Same, **JWT of the E2E student account** | what a logged-in student can read — this is what catches `USING (auth.uid() IS NOT NULL)` |
| `/storage/v1/bucket`, service role | 7 buckets and their public flag |
| Repo `supabase-*.sql` (95 files) | policy, view, index and function *intent* |

**Not measurable this way — still open:**

- Actual `pg_policies` text, `pg_indexes`, table ownership, `security_invoker`
  flags, `pg_stat_user_indexes` (unused indexes), extensions.
- Whether a student can *download* another user's file from `mentor-documents` /
  `student-documents`. The policy definitions in the repo are correctly
  owner-scoped, but I could not confirm they are live.
- Supabase's own security and performance linters.

To close these, either grant the MCP connector access to the org owning
`uooshbumyilwvbgmbixx`, or add a `DATABASE_URL` for a read-only role.

## 1. Inventory

**113 relations** — 108 tables + 5 views (`catalog_programmes`,
`course_current_field_values`, `ambassador_link_stats`,
`coordinator_referral_daily`, `user_login_counts`).

Growth since the 2026-08-03 audit (`audit-2026-08-03.md`, `TECH_SOLUTION.md` §2.3/§2.6):

| | 2026-08-03 | 2026-09-05 | Δ |
|---|---|---|---|
| relations | 85 | 113 | **+28 in 33 days** |
| `supabase-*.sql` files | 48 | 95 | +47 |
| relations with no `create table` in repo | 18 | **13** (9 hold live data) | −5 |

### Domain map

| Domain | n | Notes |
|---|---|---|
| Crawler / ingestion staging | 16 | `crawl_*`, `programme_ingestion_jobs`, `course_parse_jobs`. All 14 `crawl_*` deny anon at the GRANT level. |
| Course catalogue (product) | 11 | `courses`, `catalog_programmes`(v), `course_field_values`, `academic_units`, `university_profiles`, … |
| Universities & scholarships | 5 | `universities`, `scholarships`, `scholarship_universities`, `user_*` joins |
| Student profile & records | 10 | `student_profiles` (72 cols), achievements, activities, test scores, `uploaded_documents`, `structured_cvs` |
| Applications core | 10 | `course_applications`, stages, tasks, events, sources, requirements, 4-level plan hierarchy |
| AI strategy / reports | 17 | `application_*` analyses, versions, planner runs/ops, recommendations, snapshots |
| Personal reports | 4 | `student_personal_report*`, `personal_report_supplements`, `personal_statements` |
| SOP / CV / coach | 6 | `statement_*`, `cv_*`, `strategy_coach_*` — **all six empty** |
| Course search | 5 | sessions, results, `saved_options`, `recommendations`, `recommendation_runs` |
| Mentorship / Achievers | 6 | `achiever_*`, `mentor_availability_slots`, `bookings`, `session_reviews` |
| Payments & entitlements | 7 | `payment_transactions`, `manual_payment_reviews`, `plus_*`, `user_entitlements`, `idempotency_keys` |
| Ambassador / referral | 7 | `ambassador_*`, `coordinator_referral_daily`(v), `login_events`, `user_login_counts`(v) |
| Content / marketing | 5 | `geo_articles`, `geo_article_links`, `team_members`, `team_achievements`, `support_requests` |
| Email / newsletter | 5 | deliveries, preferences, subscriptions, `newsletter_content_sent`, `waitlist_signups` |

Every table categorised; no orphans.

## 2. RLS — measured, not assumed

Probing all 113 relations three ways (anon / authenticated student / service role):

| Posture | n | Meaning |
|---|---|---|
| Denied at GRANT level | 16 | `crawl_*`, `manual_payment_reviews`, `payment_notification_jobs`. Strongest posture. |
| Public — anon reads rows | 5 | `courses`, `catalog_programmes`, `team_members`, `team_achievements`, `geo_articles` |
| Any authenticated user reads all rows | 12 | mostly reference data; see A2 below |
| Student reads a subset | 29 | per-row policy demonstrably working |
| Student reads nothing | 29 | either correct isolation or no data for that account |
| Empty table | 22 | no rows to protect; see §3 |

(Mutually exclusive, totalling 113. Counting the authenticated probe alone,
16 relations return every row to the test student — the 12 above plus the 4
public ones — and 30 return a subset, the 29 above plus `geo_articles`.)

**No student PII leaked to anonymous callers.** `student_profiles`,
`personal_statements`, `uploaded_documents`, `applicant_analyses`,
`course_applications`, `payment_transactions` and `english_test_scores` all
return 0 rows to anon and a correct subset to the logged-in student
(`student_profiles` 1/264, `uploaded_documents` 2/53, `user_entitlements` 1/442).
That is a genuinely good result, and it holds under the authenticated probe —
the test that catches the classic `USING (auth.uid() IS NOT NULL)` bug.

Note also that `geo_articles` returns 2 of 5 rows to anon: a published-only
policy working exactly as intended.

### Findings, by risk

**A1 — `add_selected_courses_to_apply` trusts a caller-supplied `p_user_id`.
Severity if applied: HIGH. Currently: NOT LIVE — the migration was never run.**

`supabase-add-selected-courses-rpc.sql:66`. `SECURITY DEFINER` (its own comment
says "allows insert even with RLS"), `GRANT EXECUTE … TO authenticated`
(line 231), takes `p_user_id UUID` and validates only `IS NOT NULL` — it never
compares it to `auth.uid()`. It would insert `course_applications.user_id =
p_user_id` plus `application_sources` and `course_parse_jobs` rows, and mark
session results selected. Since the grant is on the function, any holder of a
user JWT could call `POST /rest/v1/rpc/add_selected_courses_to_apply` directly
with someone else's UUID — write-side cross-tenant injection, needing only a
target user id, which is not secret.

**The function does not exist in the live database.** PostgREST's OpenAPI
document, fetched as service role, lists 33 RPCs and this is not among them,
while every function that *is* live appears there with accurate argument names
(`confirm_application_candidate_snapshot` lists all four of its parameters). The
`.sql` file was written but never applied.

*Never called. Established from the schema cache and by reading the definition.*

Two consequences, and the second is the one to act on today:

1. **The hole is latent, not open.** It becomes real the moment anyone runs this
   file. Fix the file before it is ever applied: derive the user inside the
   function (`v_user_id := auth.uid()`) and drop the parameter, or
   `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION`, and check `p_session_id`
   belongs to that user. `confirm_application_candidate_snapshot`
   (`supabase-application-confirm-atomic.sql:22`) does this correctly — copy it.
2. **The code path that calls it is broken in production.**
   `src/app/api/apply-shortlist/add-courses/route.ts:440` calls the RPC with no
   fallback; a missing function sets `rpcError`, so the route returns
   `500 Failed to create applications`. Adding courses to the Apply shortlist
   from a search session cannot work through this route. Worth confirming
   against the product — `course_applications` holds 79 rows, so applications
   are reaching the table by some other path.

This also proves the drift in §5 runs **both** directions: relations live with no
file, *and* files in the repo that were never run. Neither the repo nor the
database is a complete account of the other.

**A2 — `achiever_profiles` exposes mentor identity data to every logged-in user. MEDIUM–HIGH.**

The test student reads 5 of 6 rows including `legal_name`, `date_of_birth`,
`cv_storage_key`, `transcript_storage_key`, `student_card_storage_key`,
`acceptance_letter_storage_key` and `stripe_account_id`. Verified: all four
document keys are non-null and readable for at least one mentor.

The documents themselves are probably safe — `supabase-mentorship.sql:337-382`
scopes `mentor-documents` reads to `(storage.foldername(name))[1] =
auth.uid()::text`, and the bucket is private. But that still leaves legal name,
date of birth and exact object paths readable by any student, which is more than
a mentor directory needs.

Fix: restrict the SELECT policy to a public column projection (a view, or
column-level grants). The directory needs `display_name`, `avatar_url`, `bio`,
`subject`, rating and price — not `legal_name`, `date_of_birth`, or storage keys.

**A3 — `team_members.email` is world-readable. LOW–MEDIUM.**

Anon reads all 12 rows including `email`. If those are personal rather than role
addresses, it is a scrapeable staff PII list. Fix: drop `email` from the
anon-facing policy or projection.

**A4 — three views declared without `security_invoker`. MEDIUM (fragility, not a live leak).**

`ambassador_link_stats`, `coordinator_referral_daily` and `user_login_counts` are
created without `with (security_invoker = true)`; only the two in
`supabase-catalog-v2.sql:344,389` set it. Without it a view runs as its owner and
bypasses RLS on the base tables.

Measured behaviour is currently *correct* (`user_login_counts` returns 0/344 to
the student; `ambassador_link_stats` returns 2/15, matching `ambassador_links`
2/15), so either the flag is set live or the owner is not privileged. Either way
the declaration lacks the safeguard, so a future ownership change turns it into a
silent leak — `user_login_counts` sits directly over `login_events` (1,639 rows).
This is exactly what Supabase's `security_definer_view` lint would flag.

**A5 — two `SECURITY DEFINER` functions with mutable `search_path`. LOW.**

`update_achiever_stats` and `sync_slot_status_on_booking_change`. Both are
trigger functions rather than directly callable, which limits the exposure, but
`SET search_path = ''` is the standard hardening and the other 32 definers
already have it.

**A6 — `user_entitlements` has no policy in version control. MEDIUM (process).**

442 rows, gates paid access. Live behaviour is correct (the student sees 1). But
neither its `create table` nor any `create policy` exists in the repo, so its RLS
posture cannot be reviewed, recreated, or regression-tested from source.
`TECH_SOLUTION.md` §2.6 flagged this on 2026-08-03; it is still true. 35
relations have no `create policy` in the repo at all.

### Cleared

Payment RPCs are tight: `create_manual_payment_checkout`, `claim_manual_payment`,
`fulfill_payment_transaction`, `review_manual_payment`, the notification-job
functions and `process_vnpay_ipn` are all `revoke … from public, anon,
authenticated` followed by `grant … to service_role`
(`supabase-manual-payment-founder.sql:355-364`). `consume_statement_review` is
`SECURITY INVOKER` and filters on `auth.uid()`. `confirm_application_candidate_snapshot`
derives the user internally. Storage policies for both private buckets are
owner-scoped by folder.

## 3. Schema quality

**Duplicate / superseded pairs**

| Tables | Rows | Recommendation |
|---|---|---|
| `achiever_availability` / `mentor_availability_slots` | 0 / 1 | Two availability models from the mentor→achiever rename. **Drop `achiever_availability`.** |
| `personal_report_supplements` / `application_personal_report_supplements` | 1 / 0 | Same concept at two scopes. **Merge; drop the empty one.** |
| `recommendations` + `recommendation_runs` / `application_recommendations` + `application_strategy_recommendations` | 0+0 / 78+8 | v1 superseded by the per-application v2. **Archive the two empty ones.** |
| `english_test_scores` / `standardized_test_scores` | 68 / 32 | Same shape, split by test family. **Leave** — merging costs more than it saves. |
| `crawl_*` ↔ product mirrors | `crawl_admission_requirements` 1600 ↔ `course_admission_requirements` 1600; `crawl_programme_offerings` 400 ↔ `course_offerings` 400; `crawl_organisation_units` 196 ↔ `academic_units` 196 | **Leave** — deliberate staging→product promotion via `promote_crawl_run`, and the identical counts show it working. |

**Naming drift**

- `ambassador_*` tables against a `coordinator_referral_daily` view and
  `coordinator_id` columns throughout — a half-finished rename.
  `supabase-global-station.sql` already drops `coordinator_login_daily`. Rename
  the view for consistency.
- `mentor_*` against `achiever_*` for the same domain.
- `_v2` appears in filenames (`supabase-catalog-v2.sql`, `-apply-v2`,
  `-matching-report-v2`, `-plus-promo-v2`, `-strategy-report-v2`) but never in
  table names — good; no `_v2` tables exist.

**22 empty tables.** Six of them form the entire SOP/CV/coach domain
(`statement_analyses`, `statement_strategies`, `cv_reviews`, `cv_target_profiles`,
`strategy_coach_threads`, `strategy_coach_messages`) — built, never populated.
Also `bookings` (28 columns, 0 rows) while `payment_transactions` holds 30,
suggesting the booking flow routes around it. Worth confirming intent before
either is treated as live.

**Wide tables.** `student_profiles` 72 cols / 88% nullable, `universities` 45 /
80%, `courses` 42 / 90%, `application_match_analyses` 40 / 88%,
`course_applications` 37 / 89%. `student_profiles` is the one to watch: at 72
columns it is accumulating roughly one column per feature.

**Foreign keys.** 105 `*_id` columns across 82 tables carry no in-schema FK. Most
are `user_id` (53 tables) — but the repo declares `references auth.users` 59
times, and cross-schema FKs do not appear in PostgREST's spec, so **those are
likely fine and this number overstates the problem.** The real gaps are the
non-user ones: `crawl_field_assertions.entity_id` (17,278 rows),
`course_field_values.source_assertion_id` (15,537),
`crawl_review_items.programme_id` (3,696) and `crawl_url_edges.institution_id`
(1,980) — provenance columns spanning the staging/product boundary, where orphans
are silent.

**Timestamps.** 33 relations lack `created_at`; 61 lack `updated_at`.
Concentrated in `crawl_*` and the join tables — consistent with copy-pasted
migrations.

## 4. Performance

Supabase's performance linter could not be run (§0), so this comes from declared
indexes only: 195 `create index` statements across 85 of 113 relations.
**28 relations have no declared index at all.**

Unindexed declared-FK columns, highest row counts first (views excluded — an
index on a view is meaningless):

| Table | Column | Rows |
|---|---|---|
| `course_field_values` | `source_run_id` | 15,537 |
| `course_admission_requirements` | `source_run_id` | 1,600 |
| `course_academic_units` | `academic_unit_id`, `source_run_id` | 595 |
| `crawl_programme_organisation_units` | `run_id` | 595 |
| `student_personal_report_versions` | `confirmed_snapshot_id` | 498 |
| `crawl_admission_packages` | `run_id` | 400 |
| `course_offerings` | `source_run_id` | 400 |
| `scholarship_universities` | `scholarship_id` | 374 |
| `academic_units` | `parent_id`, `source_run_id` | 196 |
| `crawl_organisation_units` | `run_id` | 196 |
| `user_scholarships` | `scholarship_id` | 116 |
| `user_universities` | `university_id` | 114 |
| `course_search_session_results` | `session_id`, `university_id` | 76 |
| `payment_notification_jobs` | `transaction_id` | 75 |

The `*_run_id` cluster is the clearest win: every crawl promotion filters by run,
and none of those columns is indexed.

**jsonb without GIN.** Only 5 GIN indexes exist (`tags`, `funding_type`, `raw`,
and two `gin_trgm_ops`). None covers the AI structured-output columns —
`course_field_values.value_json` (15,537 rows),
`programme_target_profile_versions.profile`, the report payloads. Add GIN only
where a query actually filters *inside* the JSON; if these are only ever fetched
whole by id, no GIN is needed. Check before adding.

**Composite index candidates**, from the access patterns named in the brief:
`application_tasks(application_id, status)` (1,033 rows),
`course_applications(user_id, status)`, and
`application_stages(application_id, status)` (411). Confirm against
`pg_stat_statements` rather than adding blind.

## 5. Migration hygiene

There is **no migration runner**. No `supabase/` directory, no CLI, no version
table — 95 `supabase-*.sql` files at the repo root, 652 KB, run by hand in the
SQL editor, spanning 2026-04-22 to 2026-09-04.

Patch-on-patch is visible in the filenames: 12 are named `*-repair`, `*-fix`,
`*-v2`, or `-missing-tables`. `reconcile_canonical_application_plan` is redefined
in **five** separate files; `fulfill_payment_transaction`, `review_manual_payment`,
`process_vnpay_ipn` and `redeem_plus_promo` in two each. Nothing records which
definition is live — whichever was run last wins.

13 relations have no `create table`/`create view` anywhere in the repo; 9 of them
hold live data, including `user_entitlements` (442 rows, the billing gate),
`course_parse_jobs` (18, the Smart Course Importer queue) and
`course_search_session_results` (76). A clean checkout plus `npm ci && npm run
build` cannot reproduce this database.

**The drift runs both ways.** `add_selected_courses_to_apply` (A1) is defined in
the repo but absent from the live schema cache — a file that was never run, with
an API route depending on it. Conversely, of the 33 live RPCs, `seed_glowbal_team_members`
has no definition in the repo at all (`show_limit` and `show_trgm` are `pg_trgm`
extension functions, not app code). So neither side is a complete account of the
other, and today there is no way to tell which is ahead without querying
production. That is the argument for the baseline, in one sentence.

**Recommendation: yes, baseline now.** At 113 relations and roughly 28 added per
month, this only gets more expensive. Concretely: run `supabase db pull` against
production to generate one consolidated snapshot, commit it as
`supabase/migrations/<ts>_baseline.sql`, move the 95 loose files to
`supabase/legacy/` unchanged (they are the only record of intent), and require
new changes to go through `supabase migration new`. That closes the drift, brings
the 35 unversioned RLS postures under review, and settles which of the five
`reconcile_canonical_application_plan` bodies is real. `TECH_SOLUTION.md` §2.6
already called this "phải thay"; this audit only raises the price.

## 6. Is 113 tables complexity or debt?

Mostly genuine complexity, with a clear and separable layer of debt. Roughly 70
of the 113 are doing real, distinct work: the crawler's staging→product promotion
pipeline is a legitimate two-sided design, the four-level application plan
hierarchy models a real domain, and the versioned AI report tables exist because
AI output needs lineage. That is not bloat. The debt is concentrated and small:
22 empty tables (six of them an entire unshipped SOP/CV/coach domain), three or
four true duplicate pairs left by unfinished renames, and a `student_profiles`
table at 72 columns absorbing one field per feature. **The schema itself does not
need a consolidation pass before the next feature push — but the migration story
does.** Adding 28 relations in 33 days with no migration runner, and 13 relations
untraceable to any file, is what will actually block the next push, and it is a
two-day fix now against a two-week one at 150 tables. Do the baseline first, then
A1 and A2 from §2; leave the table count alone.

## Proposed changes — none applied

1. `achiever_profiles`: restrict SELECT to public columns. **(A2 — the only
   finding that is live and exposing data today; do first)**
2. `add_selected_courses_to_apply`: fix the file before anyone applies it, and
   decide whether the Apply-shortlist route needs it at all. **(A1)**
3. Add `with (security_invoker = true)` to the three views. **(A4)**
4. Drop `team_members.email` from the anon projection. **(A3)**
5. `SET search_path = ''` on the two trigger definers. **(A5)**
6. Indexes on the `*_run_id` / FK cluster in §4.
7. Baseline migration snapshot per §5.
8. Drop `achiever_availability`; merge the two `*_report_supplements` tables.

Per `docs/known-issues.md` §0, none of these may be made by editing an existing
`supabase-*.sql` file — each needs a new follow-up file.
