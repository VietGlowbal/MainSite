# Broader-scope semantic acceptance replay — 2026-09-12

This replay used the frozen `routed-refresh-20260912` retained sample only:
20 selected targets, 19 acquired programmes and 19 requested fields. It made
no acquisition requests, LLM calls, database writes or promotion calls.
Input hashes are recorded in `result.json`.

## Acceptance policy

An observation is accepted only when its quote is present in a hash-verified,
admitted source with matching raw document, run, URL, authority and
relationship. The source must establish the value. Applicability to a target is
not required for a valid broader-scope observation.

- Institution facts are bound to the verified institution entity, not the
  programme that triggered extraction.
- Faculty, department and school facts can be bound to an existing verified
  organisation-unit ID. They remain in review when that entity is unavailable;
  they are never widened to an institution fact.
- Missing audience, cycle, degree, and secondary basis metadata are represented
  as `UNKNOWN`/null. A bare dollar sign becomes `currency: null` plus
  `currency_symbol: "$"`; it is not converted to USD and is not
  currency-compatible for donor selection.
- An explicitly stated noncanonical period can be retained as
  `fee_period_raw` with normalized `fee_period: null`.
- Unsupported funding labels, booleans and details are removed only when an
  explicit remaining funding fact still exists. Explicit historical facts remain
  `HISTORICAL`.
- Unsupported values, source or entity mismatch, missing provenance, corrupted
  snapshots, non-native inference, and unresolved conflicts remain blocked.

## Review classification and result

| Classification | Effective review proposals |
| --- | ---: |
| ACCEPT_EXACT | 0 |
| ACCEPT_BROADER_SCOPE | 35 |
| ACCEPT_WITH_UNKNOWN_CONTEXT | 5 |
| ACCEPT_HISTORICAL | 0 |
| REAL_INSUFFICIENT_EVIDENCE | 118 |
| HARD_INVALID | 8 |
| CONFLICT | 0 |

| Metric | Previous replay | Broader-scope replay |
| --- | ---: | ---: |
| Accepted observed assertion rows | 72 | 78 |
| Unique accepted assertion IDs | 71 | 77 |
| NEEDS_REVIEW | 124 | 118 |
| Newly hard rejected | 8 | 8 |

The baseline before either acceptance pass was 38 accepted rows and 166 review
proposals. The broader pass therefore accepts 40 additional source-supported
rows relative to the frozen input. Scope is 38 programme rows, 40 institution
rows, 0 faculty/parent rows and 0 historical rows. All accepted rows are
official-web observations.

Newly recoverable sparse-field facts relative to the prior replay are two
institution tuition tariffs, one institution additional-fee fact, two funding
facts and one programme TOEFL fact. The tuition and fee amounts use an explicit
bare dollar symbol, so their currency is unknown and no tuition donor was made
currency-compatible by this pass.

| Field | Accepted before any acceptance pass | Accepted now |
| --- | ---: | ---: |
| tuition | 0 | 2 |
| additional_fees | 0 | 1 |
| application_fee | 5 | 5 |
| minimum_degree | 0 | 2 |
| minimum_gpa | 0 | 1 |
| ielts_overall / ielts_subscores | 0 / 0 | 0 / 0 |
| toefl | 0 | 1 |
| scholarships | 0 | 33 |

The leading remaining reasons are `CURRENCY_NOT_ESTABLISHED` (24),
`BASIS_NOT_SUPPORTED` (17), `MULTIPLE_AMOUNT_ROW_ALIGNMENT` (13),
`EVIDENCE_NOT_IN_SNAPSHOT` (9), missing provenance (8), and unsupported or
insufficient field facts. Five faculty/school observations have no verified
organisation-unit ID in this retained run and therefore stay review-only.
Nine raw snapshots fail their stored content hash and were not used.

## Unchanged H1–H4 evaluation

The existing hierarchy implementation was rerun unchanged across 361
target-field pairs (19 acquired programmes × 19 fields).

| Metric | Before | After |
| --- | ---: | ---: |
| Direct unconflicted pairs | 29 (8.03%) | 32 (8.86%) |
| H1 parent/faculty activations | 0 | 0 |
| H2 institution activations | 1 | 8 |
| H3 sibling activations | 0 | 0 |
| H4 peer/external activations | 0 | 0 |
| Missing-target abstentions | 331/332 (99.70%) | 321/329 (97.57%) |

After replay, H2 emits intakes (1), minimum degree (2), and scholarships (5).
Each has support count 1. Mean heuristic uncertainty is 0.1987 for intakes,
0.2387 for minimum degree, and 0.2807 for scholarships; numerical dispersion
is not measurable. There are three direct target conflicts and three
incompatible non-numerical donor conflicts, all of which abstain. No accuracy
or calibration claim is possible.

H1 remains unavailable because the retained run has no verified organisation
unit linked to the faculty-scope facts. H3/H4 remain unavailable because no new
independent, compatible donor values were created. The newly accepted tuition
values are deliberately excluded from compatible comparison while currency is
unknown.

## Verification

- `python -m pytest services/data-ingestion/tests/test_semantic_acceptance.py services/data-ingestion/tests/test_semantic_tuition.py services/data-ingestion/tests/test_hierarchical_inference.py -q`: 65 passed.
- `python -m pytest services/data-ingestion/tests -q`: 538 passed.
- Replay: `scripts/replay_semantic_acceptance.py` against the frozen run,
  writing this directory.

No commit or push was performed.
