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
