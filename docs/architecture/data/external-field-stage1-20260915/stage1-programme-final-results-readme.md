# Stage 1 verified programme final results

- One row represents one verified production Stage 1 programme (230 rows).
- Blank means no defensible final value was available.
- Values are the final effective results after Direct plus the existing hierarchy.
- `*_scope` indicates whether a scoped value is programme-, institution-, or department-level.
- `effective_completion_pct` shows the programme's effective field completeness.

Synthetic institution-only seeds and unresolved targets are excluded from this
lead-facing export; all 418 original targets remain in
`stage1-programme-population-audit.csv`. Technical donor and provenance details
remain in the accompanying hierarchy review artifacts.

## Deterministic coverage acquisition replay (2026-09-16)

The frozen 230-programme recipient set was replayed using the existing
persisted source artifacts/cache. The pass appended 317 deterministic
source-backed assertions and did not change population classification or any
H1-H4 compatibility rule. Every assertion records its source URL, content hash,
raw document id, parser id/version, provider, scope, and `model_name=null`.

Sources were the existing Onisep CSV, Discover Uni links and cached official
university pages, DUO RIO JSON, Studyinfo/Opintopolku JSON, and Skolverket
Susa-navet endpoints. The source ledger records 132 source URLs, no new source
domains, and zero paid LLM calls. The incremental assertion audit is
`stage1-incremental-evidence-audit.csv`; the persisted rows are in
`stage1-incremental-evidence.jsonl`.

Coverage across the 38 hierarchy fields rose from 937 to 1,282 non-empty values
and 171 programmes gained at least one value. The field gains are:

| Field | Before | After |
|---|---:|---:|
| application_url | 0 | 153 |
| tuition | 5 | 38 |
| intakes | 7 | 31 |
| work_experience | 2 | 25 |
| scholarship | 2 | 24 |
| ielts_overall | 2 | 20 |
| programme_language | 16 | 30 |
| delivery_mode | 172 | 186 |
| subject_prerequisites | 4 | 16 |
| ielts_subscores | 0 | 10 |
| toefl | 2 | 6 |
| final_deadline | 12 | 16 |
| recommendation_letters | 0 | 4 |
| required_documents | 4 | 6 |
| sop_or_essay | 0 | 2 |
| portfolio | 0 | 2 |
| standardized_test_requirements | 1 | 3 |
| rolling_admission | 0 | 2 |

Direct/H0 is 855 to 1,172, H1 0 to 0, H2 0 to 0, H3 82 to 110, H4 0 to 0,
Final 937 to 1,282, Review 58 to 58, Abstain 3,605 to 4,640, and Missing 4,140
to 2,760. Completeness p25/median/p75 is 10.53%/13.16%/13.16% to
13.16%/15.79%/15.79%. The final CSV remains exactly 230 verified programmes;
the 188 synthetic recipients remain excluded. Institution-scoped donor scope
is preserved by the unchanged hierarchy resolver.

## Incremental structured coverage replay (2026-09-16)

The frozen run already contained six Finnish `application_windows` records with
source-native ISO closing dates. The replay promotes those exact dates to six
`final_deadline` assertions only when source lineage is present, the date is
unambiguous, and no direct deadline already exists. Conflicting records remain
unresolved. The source strings, existing assertions, recipient population, and
all hierarchy compatibility rules are unchanged. This adds six direct values:
`final_deadline` coverage rises from 6/230 to 12/230; the other prioritized
field counts do not change.

| Replay count | Before | After |
|---|---:|---:|
| Direct | 849 | 855 |
| H1 | 0 | 0 |
| H2 | 0 | 0 |
| H3 | 82 | 82 |
| H4 | 0 | 0 |
| Final | 931 | 937 |
| Review | 58 | 58 |
| Abstain | 3,611 | 3,605 |
| Missing | 4,140 | 4,140 |

Six programmes gained one effective field. Completeness p25/median/p75 remains
10.53%/13.16%/13.16%; the mean rises from 10.65% to 10.72%. The replay uses
existing artifacts only and records zero crawl and paid LLM calls.

## Advisory maximum-fill replay (superseded base, 2026-09-16)

`generate_stage1_max_fill.py` is the original hierarchy-only advisory replay.
It is retained as history; the deterministic expansion below supersedes its
identical strict/max output for this evidence snapshot.

The frozen evidence contains 1,516 programme-scoped, 146 institution-scoped,
and 9 parent-scoped donor assertions, with 418 programme donor contexts and
209 institution contexts. The aggressive compatibility pass found no extra
H1/H2/H3 value beyond the strict view, so strict and max-fill outputs are
identical for this evidence snapshot:

| Replay count | Strict | Max-fill |
|---|---:|---:|
| H0 / Direct | 855 | 855 |
| H1 | 0 | 0 |
| H2 | 0 | 0 |
| H3 | 82 | 82 |
| H4 | 0 | 0 |
| Final | 937 | 937 |
| Review | 58 | 58 |
| Abstain | 3,605 | 3,605 |
| Missing | 4,140 | 4,140 |

The base value matrix and audit are retained for comparison.

## Deterministic MAX_FILL expansion (current, 2026-09-16)

`expand_stage1_max_fill.py` starts from the strict replay and fills only blank
canonical cells using the existing persisted evidence and 105 already captured
official pages. It keeps all 230 verified recipients, leaves strict values
unchanged, and records source URL, donor, scope, level, uncertainty, and
provenance in `stage1-programme-max-fill-sources.csv` and
`stage1-max-fill-evidence.jsonl`. No network acquisition or paid LLM call is
performed.

The strict view remains 1,282 non-empty hierarchy cells. MAX_FILL adds 252
advisory values (H0 225, H1 1, H2 7, H3 19), resulting in 1,532 hierarchy cells
and 1,534 cells across all 40 canonical CSV fields; 113 programmes improve.
Hierarchy completeness p25/median/p75 is 13.16%/15.79%/15.79% in strict and
13.16%/15.79%/21.05% in MAX_FILL. The regenerated advisory matrix is
`stage1-programme-max-fill-results.csv`; summaries are
`stage1-max-fill-field-summary.csv`, `stage1-max-fill-completeness.csv`, and
`stage1-max-fill-replay-summary.json`. The strict production matrix remains
`stage1-programme-final-results.csv`.

## Donor-independent replay (2026-09-16)

`rebuild_verified_population.py::remap_hierarchy_data` restricts recipients and
remaps programme identities without filtering accepted donor assertions.
`generate_hierarchy_reports.py::run_decisions` iterates recipient contexts but
uses the separate complete donor programme context collection for lookup.
Persisted institution and optional organisation-unit contexts/relationships
remain available to the unchanged H1-H4 engine. Institution finance remains
institution-scoped and advisory; no compatibility gate changed.

| Retained evidence/context | Before | After |
|---|---:|---:|
| Programme-scoped assertions | 1,510 | 1,510 |
| Institution-scoped assertions | 0 | 146 |
| Parent/org-unit-scoped assertions | 9 | 9 |
| Institution contexts | 115 | 209 |
| Programme donor contexts | 230 | 418 |

The nine parent-scoped assertions have persisted `entity_type=programme`;
this change does not relabel them. This frozen run has zero explicit org-unit
contexts. Regression fixtures verify actual org-unit entities and relationships.

The architecture-only baseline before the incremental extension was: Direct
849, H1 0, H2 0, H3 82, H4 0, final 931,
review 58, abstain 3,611, missing 4,140. Retaining additional-fee evidence moves
230 slots from missing to abstain without applying values. The 146 institution
assertions have no same-institution verified recipient; the former 103 H2
transfers to synthetic recipients are not restored. The lead CSV still has
230 verified programmes, including corrected DUO identities, and no synthetic
US/CH recipients. Population classification is unchanged.

Validation: the focused hierarchy/loader suite passes 11/11 for this
incremental change; the full ingestion suite passes 534/534. Compile,
CSV structure/population and `git diff --check` pass. The regenerated lead and
completeness CSVs contain the six new deadline values and still contain only the
230 verified production programmes. `npm run verify:pr` passes with Node
24.19.0: both TypeScript checks, lint (zero errors, ten warnings), 3,469
application tests (two TODOs), and production build (141/141 static pages).
Browser E2E was not run for this replay-only change. Replay uses only persisted
artifacts: zero crawl and zero paid LLM calls.
