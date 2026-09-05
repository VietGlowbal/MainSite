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

**Closed 2026-09-05T16:26Z by `sql/introspect.sql`,** run in the Supabase SQL
editor by the project owner and exported as CSV. That query reads catalog and
statistics views only — `pg_policy`, `pg_class`, `pg_proc`, `pg_indexes`,
`pg_stat_user_indexes`, `pg_constraint`, `information_schema.role_table_grants`,
`pg_extension` — no table data and no PII. It returned policy expressions for
all 108 tables, `security_invoker` for all 5 views, `proacl` for all 80
functions, 341 indexes with scan counts, 206 foreign keys, 2,053 grants and 15
storage policies.

Everything in §2–§4 below marked *measured* now comes from that snapshot rather
than from the repo. Where the two disagree, the catalog wins and the earlier
inference has been corrected in place — §4 in particular was substantially
wrong when derived from `.sql` files alone.

**Still open:**

- Supabase's own security and performance linters. The MCP connector still
  points at the wrong project; nothing in this audit substitutes for them.
- Whether a student can *download* another user's file from `mentor-documents` /
  `student-documents`. The live storage policies are now confirmed owner-scoped
  (§2), but the end-to-end download has not been attempted.
- Query-level hot spots. `pg_stat_statements` **is installed** (v1.11) and is the
  right tool; it was not queried by `introspect.sql`.

To close the first, grant the MCP connector access to the org owning
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

### Catalog verification (measured 2026-09-05T16:26Z)

The behavioural probing above says what *did* come back. The catalog says why.
Four structural checks, all clean:

| Check | Result |
|---|---|
| Tables with RLS disabled | **0 of 108.** `relrowsecurity` is true everywhere. |
| Views without `security_invoker` | **0 of 5.** All five set `security_invoker=true`, so none launders base-table RLS through its owner. |
| `SECURITY DEFINER` functions without a pinned `search_path` | **0 of 31.** Every one sets `search_path`. |
| Mutating definer functions executable by `anon`/`authenticated` | **0.** All 26 read `{postgres=X,service_role=X}`. |

That last row **closes `known-issues.md` §0g**, which had stood at "🔴 OPEN, most
urgent item in this file" since 2026-09-04. `sql/supabase-rpc-privilege-hardening.sql`
has been applied. The six definer functions `anon` can still execute are the five
TRIGGER functions the migration deliberately left alone — PostgREST does not
expose a function returning `trigger` — plus `confirm_application_candidate_snapshot`,
which raises `42501` when `auth.uid()` is NULL.

No policy reachable by `anon`, `authenticated` or PUBLIC uses the weak
`USING (auth.uid() IS NOT NULL)` form. Every policy over student data scopes by
`auth.uid() = user_id` or by an `EXISTS` join to `course_applications.user_id =
auth.uid()`. **This is the single most important result in the audit** and it is
now measured rather than inferred.

**A7 — `anon` holds INSERT/UPDATE/DELETE on 81 relations, 47 of them student PII
or payment data. Severity: MEDIUM, structural. Not currently exploitable.**

This is Supabase's default `GRANT ALL ... TO anon, authenticated`, not something
anyone chose. Nothing leaks today, because RLS denies every one of those writes —
that was confirmed behaviourally. But it means **RLS is the only control**: the
first table created without a policy, or with a permissive one, is immediately
anon-writable over the public API. `student_profiles`, `payment_transactions`,
`uploaded_documents`, `structured_cvs` and `user_entitlements` are all in this set.

*Proposed, not applied:* revoke INSERT/UPDATE/DELETE from `anon` across the
student and payment domains, keeping SELECT only where a public read policy
exists. No application code path uses an anon write, so this should be inert.
Verify that claim against the route handlers before running it.

**A8 — `courses` accepts inserts from any logged-in user. Severity: LOW-MEDIUM,
integrity not confidentiality.**

Policy `Authenticated users can insert courses` applies to PUBLIC with
`WITH CHECK (auth.role() = 'authenticated')` — no ownership column, no
moderation. `courses` is the shared catalogue every student reads. A logged-in
user can write arbitrary rows into it. `anon` is blocked by the `auth.role()`
test. Consider restricting inserts to `service_role` and routing catalogue
writes through `promote_crawl_run`, which is already service-role-only.

**A9 — `programme_target_profile_versions` is readable in full by any logged-in
user.** `USING (true)` for `authenticated`. Its sibling `*_versions` tables all
scope to `user_id`, so this reads as an oversight — but the content is
AI-extracted *programme* requirements, not student data, and a shared cache is a
defensible design. **Decide and document which it is**, because the next reader
will assume it is a bug.

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

**A4 — ~~three views declared without `security_invoker`~~. WITHDRAWN 2026-09-05 —
the catalog disproves it.**

All five views set `security_invoker=true` live: `reloptions` reads
`{security_invoker=true}` for `ambassador_link_stats`, `catalog_programmes`,
`coordinator_referral_daily`, `course_current_field_values` and
`user_login_counts`. The finding came from reading `create view` statements in
the repo, which omit the flag for three of them; the live objects have it
regardless — either applied by a later file or set outside version control.

The behavioural evidence recorded here at the time (`user_login_counts` 0/344 to
the student, `ambassador_link_stats` 2/15) was correct and now has its
explanation. **No action needed.** Kept rather than deleted because it is a
worked example of the trap this audit hit twice: a `.sql` file is evidence of
intent, never of live state.
**A5 — ~~two `SECURITY DEFINER` functions with mutable `search_path`~~. RESOLVED
2026-09-05.**

**0 of 31** definer functions has an unpinned `search_path`. Both named functions
now carry it: `update_achiever_stats` has `search_path=public, pg_temp` and
`sync_slot_status_on_booking_change` has `search_path=public`, applied by
`sql/supabase-rpc-privilege-hardening.sql`. No action needed.
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
`SECURITY INVOKER` and filters on `auth.uid()`. `confirm_application_candidate_snapshot` derives the user internally and raises
`42501` when `auth.uid()` is NULL — worth noting that `anon` **does** still hold
EXECUTE on it in `pg_proc.proacl`, because its `.sql` file revokes only from
PUBLIC and Supabase grants `anon` explicitly at CREATE time. The body is what
makes it safe, not the grant. Storage policies for both private buckets are
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

**Redundant indexes (measured).** 23 plain indexes are an exact column-prefix of
a wider index on the same table, so the wider one already serves every query the
narrow one does. Postgres keeps and maintains both on every write. Examples:

| Table | Redundant | Already covered by |
|---|---|---|
| `student_profiles` | `idx_student_profiles_user_id` | `student_profiles_user_id_key` UNIQUE |
| `course_applications` | `idx_course_applications_user_id` | `idx_course_applications_user_status` |
| `application_tasks` | `idx_application_tasks_application_id` | `idx_application_tasks_pillar` |
| `course_parse_jobs` | `idx_course_parse_jobs_application_id` | `unique_application_id` UNIQUE |
| `course_parse_jobs` | `idx_course_parse_jobs_status` | `idx_course_parse_jobs_status_created` |
| `uploaded_documents` | `idx_uploaded_documents_user_id` | `idx_uploaded_documents_type` |

Full list of 23 in the introspection snapshot. Dropping them is safe — scans
migrate to the wider index — but the gain is write amplification and a few
hundred kB, not read latency. **Low priority; batch it with other DDL.**

**Two "v2 added, v1 never dropped" constraint pairs.** Both are still enforced
simultaneously, so the *older, narrower* rule is the one that rejects writes:

- `payment_transactions` carries UNIQUE `(user_id, product_type, idempotency_key)`
  **and** UNIQUE `(user_id, provider, product_type, idempotency_key)`. The
  provider-aware v2 has **0 scans**; the provider-blind v1 has 459. The same
  idempotency key reused across VNPay and manual bank transfer would be rejected
  by v1 even though v2 was added to permit exactly that. **Verify against the
  payment routes before dropping v1** — this is money, and the counters say v1 is
  the one actually enforcing.
- `application_planner_feedback` carries `planner_feedback_one_per_target`
  (`… , COALESCE(target_id, …)`, **0 scans**) and `planner_feedback_one_per_target_v2`
  (`… , target_key`, 64 scans). Here v2 is the live one and v1 is dead weight.

## 4. Performance

Measured from `pg_indexes`, `pg_stat_user_indexes` and `pg_constraint`, 2026-09-05.
**341 indexes across 108 tables.** This supersedes the earlier count of 195
`create index` statements read from the repo — that number was low because 35
relations have no DDL in the repo at all (§5).

**79 of 206 foreign keys have no covering index.** A parent delete or a join on
these does a sequential scan. Corrected from the repo-derived list, which was
wrong in roughly half its rows: `course_field_values.source_run_id`,
`scholarship_universities.scholarship_id`, `payment_notification_jobs.transaction_id`
and `course_search_session_results.session_id` **are** in fact indexed, as
prefixes of composite or unique indexes. The real list is led by:

| Table | Uncovered FK column(s) | Why it matters |
|---|---|---|
| `application_match_analyses` | `source_analysis_version_id`, `source_personal_report_version_id`, `target_profile_version_id`, `confirmed_snapshot_id` | four lineage FKs, none indexed, on the table the report pipeline joins most |
| `course_applications` | `university_id`, `ingestion_job_id`, `(crawl_run_id, crawl_programme_id)` | the hub table; `university_id` is filtered on the apply flow |
| `student_activity_follow_up_answers` | `application_id`, `question_id`, `user_id`, `superseded_by_answer_id` | every FK on the table is uncovered |
| `application_profile_analysis_versions` | `user_id`, `confirmed_snapshot_id` | per-user history reads scan |
| `structured_cvs`, `cv_reviews`, `cv_target_profiles`, `statement_*` | `user_id` | the CV/SOP cluster indexes `strategy_id` but not `user_id` |
| `recommendations`, `saved_options`, `support_requests`, `work_experiences` | `user_id`, `run_id`, `recommendation_id` | small tables today; cheap to fix before they grow |

The `user_id` gap is the consistent one: several student-owned tables index the
domain FK but not the column their own RLS policy filters on. Every
`USING (auth.uid() = user_id)` check on those tables is a sequential scan.
**That is the highest-value fix in this section** — it is both a performance and
a scalability issue for the exact predicate that runs on every request.

**39 droppable never-scanned indexes** (71 of 341 have `idx_scan = 0`; 32 of those
back UNIQUE constraints and must stay). Largest:

| Index | Size | Note |
|---|---|---|
| `crawl_field_assertions.idx_crawl_assertions_review_fingerprint` | 792 kB | crawl review queue |
| `scholarships.idx_scholarships_raw` | 552 kB | GIN over a raw jsonb blob; `scholarships` is hot (137k pk scans) yet this has never been used |
| `crawl_review_items.idx_crawl_review_group` | 312 kB | crawl review queue |
| `courses.idx_courses_search_keywords` | 136 kB | GIN; keyword search appears unused |
| `email_deliveries.*_created_idx` ×3 | 48 kB | three unused sort indexes on one table |

**Read `idx_scan = 0` carefully.** These counters are cumulative since the last
statistics reset, and a zero means "not used since then", not "useless". The
crawl-review indexes sit behind an admin workflow that has barely run at all —
`idx_crawl_review_queue` has exactly 1 scan — so their zeros say nothing about
their value. **Do not drop the `crawl_*` ones.** `idx_scholarships_raw` and the
`email_deliveries` trio are the defensible drops: their tables are demonstrably
active and the indexes still went unread.

**One anomaly worth a follow-up.** `scholarship_universities_pkey` has **12.5
million scans** — seven times the next busiest index (`universities_pkey`, 1.77M)
and ninety times the scan count of `scholarships_pkey` (137k), against a table of
only 176 kB. I checked the obvious cause and ruled it out: the repository batches
correctly (`byUniversityIds` uses `.in(university_id, ids)`,
`supabase-scholarship-repository.ts:384`), so this is not an application-level
N+1. Remaining candidates are PostgREST resolving an embedded resource per parent
row, or the per-row `EXISTS` in the `scholarship_universities` RLS policy.
**Settle it with `pg_stat_statements`** — the extension is installed —
rather than guessing.

**jsonb without GIN.** 6 GIN indexes exist (`search_keywords`, `tags`,
`funding_type`, `raw`, and two `gin_trgm_ops`). None covers the AI
structured-output columns — `course_field_values.value_json` (15,537 rows),
`programme_target_profile_versions.profile`, the report payloads. Add GIN only
where a query filters *inside* the JSON; if these are fetched whole by id, none
is needed. Note that two of the six existing GIN indexes have never been scanned,
which is the argument for checking first.
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
3. Drop `team_members.email` from the anon projection. **(A3)**
4. Index the uncovered `user_id` foreign keys — every `USING (auth.uid() =
   user_id)` policy on those tables currently sequential-scans. **(§4; highest
   performance value)**
5. Revoke `anon` INSERT/UPDATE/DELETE across the student and payment domains,
   after confirming no route relies on an anon write. **(A7)**
6. Restrict `courses` INSERT to `service_role`. **(A8)**
7. Decide and document whether `programme_target_profile_versions` is
   deliberately shared-readable. **(A9)**
8. Baseline migration snapshot per §5.
9. Drop `achiever_availability`; merge the two `*_report_supplements` tables.
10. Resolve the two duplicated UNIQUE constraint pairs — `payment_transactions`
    first, and only after checking the payment routes. **(§3)**
11. Low priority: drop the 23 redundant prefix indexes and the defensible dead
    ones (`idx_scholarships_raw`, the `email_deliveries` trio). **(§4)**

~~Add `with (security_invoker = true)` to the three views (A4)~~ — withdrawn, all
five views already have it. ~~`SET search_path` on the two trigger definers
(A5)~~ — already applied.

Per `docs/known-issues.md` §0, none of these may be made by editing an existing
`supabase-*.sql` file — each needs a new follow-up file.
