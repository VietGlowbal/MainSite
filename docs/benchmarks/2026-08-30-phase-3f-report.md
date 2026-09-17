# Phase 3F production-hardening benchmark

Date: 2026-08-30  
Decision: **CONDITIONAL / NO-GO**  
Rollout classification: **NO-GO**

## Scope and limitation

Environment visibility was restored from the separate local `main` worktree at
`D:\projects\Glowbal\MainSite\.env.local`; the file was loaded explicitly and
never copied into this checkout or logged. Explicit non-production markers in
the site/database configuration, together with the isolated raw-only test
database shape, support non-production identity. Provider hostnames were not
used as environment proof. No migration or production write was performed;
one bounded, uniquely prefixed staging durability smoke test was executed and
cleaned up completely.

## Environment source and visibility

| Variable | Status |
|---|---|
| `MONGODB_URI` | configured |
| `MONGODB_DATABASE` | configured |
| `SUPABASE_URL` | missing; repository accepts `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | configured |
| `RAW_OBJECT_STORAGE_BUCKET` | configured |
| `RAW_OBJECT_STORE_BUCKET` | missing; S3-compatible fallback not selected |

The loaded source was `D:\projects\Glowbal\MainSite\.env.local`, from the
separate `main` worktree. Next.js scripts use `--env-file=.env.local`; the
Python CLI defaults to the repository-root `.env.local` and was given the
main-worktree path explicitly. The current Orca process, current feature
worktree, parent directories, user environment, and machine environment do
not inherit these variables.

**NON-PRODUCTION ENVIRONMENT IDENTITY — PASS**  
Evidence source: explicit non-production markers in site/database
configuration plus staging-only raw database configuration. Hostnames were not
used as environment proof. The configured targets remain restricted to
read-only checks and the uniquely prefixed, cleaned-up durability smoke test.

Exact local benchmark corpus:

| Artifact | Kind | Reviewed institution/programme ground truth |
|---|---|---:|
| `services/data-ingestion/tests/fixtures/programme.html` | static programme fixture | 0 |
| `services/data-ingestion/tests/fixtures/catalogue.html` | catalogue fixture | 0 |
| `services/data-ingestion/tests/fixtures/sitemap.xml` | discovery fixture | 0 |

This local corpus is not a 30–50 programme benchmark. Recall, precision, and
institution-level outliers are consequently **unavailable**, not passed by
assumption.

## Superseded v1 roster reconnaissance

The original v1 roster was frozen deterministically from consolidated run
`da63479a...`: 36 programmes across 12 institution records, three distinct
programmes per institution. It is retained as source-reconnaissance history;
automated page signals are not independent reviewed reference truth. The
read-only live project contains 600 `crawl_programmes` rows across 30
institution records. Each frozen roster URL was fetched once with redirects
enabled:

| Measure | Result |
|---|---:|
| Frozen programmes | 36 |
| Frozen institutions | 12 |
| HTTP 200 | 34 |
| HTTP 202 with empty response body | 0 |
| HTTP 403 | 2 |
| Structured catalogue sources | 22 |
| Official programme sources | 13 |
| Admissions sources | 1 |
| PDF sources | 0 |
| Multilingual/non-English sources | 0 reviewed |
| Related-party sources | 0 reviewed |
| Adversarial cases | 0 reviewed |

Automated page keyword signals were present for identity on 36/36 pages,
tuition on 19/36, deadline on 16/36, English/IELTS/TOEFL on 3/36,
admissions/application/requirements on 34/36, and funding/scholarship/aid on
25/36. These are discovery signals, not scored values. The frozen roster is
still insufficiently stratified and is not the current benchmark population.
Its automated signals cannot establish the production targets.

## Current composition gate — roster v2

The current frozen manifest is
[`2026-08-30-phase-3f-roster-v2.md`](2026-08-30-phase-3f-roster-v2.md).
It preserves 36 programmes, 12 institutions, and three programmes per
institution while correcting the v1 diversity gap with source-backed stress
cases.

Source identities are recorded per row and in the supporting-source register.
A transport recheck of the v2 primary locators observed 31 successful 2xx
responses, four protected 403 responses, and one timeout. The protected and
timeout cases remain valid adversarial source identities and are runtime
behavior to benchmark, not reference truth. The two prior Princeton 403 cases
remain in the v2 manifest with bounded fallback expectations.

| Requirement | Target | v2 count | Result |
|---|---:|---:|---|
| Institutions | 12 | 12 | PASS |
| Programmes | 36 | 36 | PASS |
| Programmes per institution | 3 | 3 each | PASS |
| PDF-heavy | >=8 | 14 | PASS |
| Multilingual | >=8 | 10 | PASS |
| Separate admissions | >=8 | 36 | PASS |
| Separate finance | >=6 | 36 | PASS |
| Related-party | >=6 | 8 | PASS |
| Historical/cycle-change | >=6 | 25 | PASS |
| Identity edge case | >=6 | 16 | PASS |
| Conflict-capable | >=6 | 34 | PASS |
| Adversarial | >=6 | 27 | PASS |
| Structured/catalogue | >=8 | 17 | PASS |

The v2 composition gate is **PASS**. It is not field truth: all 36 rows are
still `CRITICAL_TRUTH_UNREVIEWED`, and the scored reviewed-field count is zero.
The two prior Princeton 403 cases are retained with bounded fallback and
`ACCESS_BLOCKED` expectations; failure must not be converted to
`NOT_PUBLISHED`.

The independent-review queue is now prepared at
[`2026-08-30-phase-3f-ground-truth-v2.md`](2026-08-30-phase-3f-ground-truth-v2.md)
and
[`2026-08-30-phase-3f-ground-truth-v2.jsonl`](2026-08-30-phase-3f-ground-truth-v2.jsonl).
It contains 252 cases (seven per programme) for identity, credential, status,
tuition, deadline/intake, English requirement, and major admissions
requirements. Current tally: `REVIEWED_CONFIRMED=0`,
`REVIEWED_AMBIGUOUS=0`, `NOT_APPLICABLE=0`, `UNREVIEWED=252`; no scorer has
run.

A targeted OpenCode read-only audit of the v2 manifest was attempted after the
freeze but stalled at the provider/runtime layer before returning findings. No
result was treated as independent approval; this is separate from the earlier
final review, which remains `P0: 2 BLOCKED / P1: 5 BLOCKED`.

## Independent review gate

OpenCode completed an independent, read-only review after the roster and
failure-matrix evidence was recorded. It reported **P0: 2 BLOCKED, P1: 5
BLOCKED, P2: 4, P3: 3**. The code-level safety assessment found no new
architecture defect for shadow operation, including no false-current,
provenance, fuzzy-identity, or secret-leakage path. It did not issue the
required P0/P1 PASS because the reviewed reference set and live lifecycle/RLS/
transaction/concurrency checks remain incomplete. The final gate is therefore
**BLOCKED**, not PASS.

## Required metrics

| Metric | Result | Interpretation |
|---|---:|---|
| Programme discovery recall | N/A | No real-institution reference set. |
| Required-source discovery recall | N/A | No live source frontier. |
| Critical field precision | N/A | No reviewed PRODUCT_SAFE sample. |
| PRODUCT_SAFE evidence entailment | N/A | No live product-safe benchmark rows. |
| False-current critical fields | 0 observed in fixtures | Safety fixtures preserve historical/inferred distinctions; not a production rate. |
| Fuzzy-only automatic identity merges | 0 observed | Covered by identity fixtures; no live concurrency run. |
| Critical unresolved conflicts promoted | 0 observed | Covered by promotion fixtures; no live database run. |
| Critical SOURCE_NOT_FOUND promoted | 0 observed | Covered by Slice C/D quality tests. |
| Critical STALE_ONLY promoted | 0 observed | Covered by current-cycle quality tests. |
| Prohibited inferred critical promotions | 0 observed | High-volatility inference remains advisory in fixtures. |
| PRODUCT_SAFE values without durable lineage | 0 observed | Covered by lineage tests; live storage lineage not verified. |

## Live read-only infrastructure checks

| Check | Result |
|---|---|
| Supabase REST schema endpoint | HTTP 200 |
| Supabase configured Storage bucket metadata | HTTP 200 |
| Supabase anon reads | Canonical tables readable; crawl staging denied for `crawl_programmes` and `crawl_sources` |
| MongoDB Atlas ping | PASS on recheck; an earlier attempt had transient TLS handshake errors |
| MongoDB raw database access | PASS; two raw collections present |
| Slice A staging durability smoke | PASS; inline/object payloads, checksum reads, duplicate content, two observations, missing-object failure, and cleanup |
| v3 tables/views | Absent; all five v3 migration families remain unapplied |
| Baseline crawl staging/catalog objects | Present in REST schema |
| RLS policy catalog / database functions | Not verifiable through the available REST schema endpoint |

The explicit site/database configuration markers plus the isolated test
database shape support the non-production classification. The only mutation
was the bounded, uniquely prefixed smoke test above; all test snapshots/blobs
were verified removed.

## Live schema compatibility matrix

| Migration | Required objects | Present | Missing | Safe to apply |
|---|---:|---:|---:|---|
| `supabase-crawl-staging.sql` | 14 | 14 | 0 | Existing baseline |
| `supabase-catalog-v2.sql` | 9 | 9 | 0 | Existing baseline |
| `supabase-crawl-acquisition-v3.sql` | 3 | 0 | 3 | Candidate only; not applied |
| `supabase-crawl-source-resolution-v3.sql` | 2 | 0 | 2 | Candidate only; not applied |
| `supabase-evidence-quality-v3.sql` | 5 | 0 | 5 | Candidate only; not applied |
| `supabase-identity-promotion-v3.sql` | 15 | 0 | 15 | Candidate only; not applied |
| `supabase-ingestion-convergence-v3.sql` | 7 | 0 | 7 | Candidate only; not applied |

This matrix is based on PostgREST schema visibility, not a direct database
catalog query. Constraints, indexes, functions, and RLS remain unverified.

## Local failure-injection evidence

The current frozen v2 roster is recorded in
`docs/benchmarks/2026-08-30-phase-3f-roster-v2.md`; the superseded v1 roster is
retained separately. The separate failure,
restart, and concurrency status matrix, including the exact 260-test re-run,
is recorded in
`docs/benchmarks/2026-08-30-phase-3f-failure-matrix.md`.

| Injected condition | Observed safe result |
|---|---|
| Private IP, unapproved domain | Non-retryable rejection; no crawl accepted. |
| Unsafe final redirect | `FINAL_URL_OUTSIDE_ADMITTED_DOMAINS`; no raw persistence. |
| Missing robots policy | Fetch and persistence prevented. |
| Mongo unavailable | `RAW_UNAVAILABLE`/`RAW_PERSIST_FAILED`, retryable. |
| Object/storage write failure | `RAW_PERSIST_FAILED`; no dangling snapshot. |
| Missing/corrupt object or checksum mismatch | Explicit non-retryable error. |
| Duplicate immutable object | Existing content verified; no overwrite. |
| Retry at maximum attempts | Job becomes failed rather than looping. |
| Historical recurrence inference | Remains `EXPIRED_BUT_RECURRING`, never verified `ACTIVE`. |
| Fuzzy scholarship mapping | Remains proposed/review-required, never confirmed. |
| Concurrent identity fixture | One stable identity is produced. |
| Repeated promotion fixture | Idempotent projection and retained history. |

Not executed: live DNS/HTTP fault injection, 429/500/redirect-loop against a
controlled non-production service, live Postgres/RLS failure injection,
full production-sized Atlas/Storage durability matrix, worker crash/restart against a live queue,
live concurrent promotion, independent critical-field review, real
source-diversity measurement, and storage-growth measurement.

## Executed checks

- `$env:PYTHONPATH='src'; python -m pytest`: **285 passed**.
- `$env:PYTHONPATH='src'; python -m compileall -q src`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run typecheck:strict`: passed.
- Focused Node ingestion/parser/API suite: **51 passed**.
- Full Node suite: **3467 passed, 2 todo, 2 unrelated CV-route timeout failures**.
- `npm.cmd run lint`: passed.
- `git diff --check`: passed.
- Static scan of all five v3 migrations: additive/no destructive or raw-body
  columns detected.
- `npm.cmd run check:node`: blocked because Node 22.15.0 is retained while the
  repository check requires Node 24.19.0.

## Decision and next evidence

The architecture remains safe enough for continued shadow operation, and the
environment-identity gate is now **PASS** from configuration evidence. The
blocking gates remain: complete the independent critical-field review and
representative source strata for the frozen 36-programme/12-institution
30–50-programme corpus, then run the live durability, RLS, source-recall,
roster, execute the outstanding failure/restart/concurrency matrix, and obtain
the independent OpenCode P0/P1 verdict. The measured benchmark targets are
not established by automated page inspection or fixture-only safety results.

## Final gate closure decision

Environment identity: **PASS** from configuration evidence; hostnames were not
used as proof.

Blocking gates:

- reviewed critical-field reference set for the frozen 36-programme / 12-institution roster: **BLOCKED**;
- full live failure/restart/concurrency matrix: **BLOCKED**;
- OpenCode final P0/P1 verdict: **BLOCKED** (`P0: 2`, `P1: 5`).

The correct Phase 3F status remains **CONDITIONAL / NO-GO**. Local and bounded
live smoke evidence does not close the required reviewed benchmark or live
operational gates.

US-50 READY: **NO**  
ASIA-50 READY: **NO**

The legacy parser remains **SHADOW**. Scholarship v3 remains **shadow only**.
No production rollout, migration application, or compatibility-path deletion is
authorized by this report.
