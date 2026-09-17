# Evidence resolution replay — 2026-09-12

This replay used only the hash-verified `routed-refresh-20260912` run (20
frozen targets, 19 acquired programmes). It performed no acquisition, network
access, LLM call, database write, promotion, or truth mutation. The complete
decision data is in [`result.json`](result.json) and
[`evidence-resolution-decisions.jsonl`](evidence-resolution-decisions.jsonl).

## Reusable resolution path

`evidence_resolution.py` is now the shared resolver used by semantic
acceptance and the replay script. `resolve_evidence_alignment` finds a unique
source span with token-aware Unicode/whitespace tolerance, records the nearby
row/header/section context, and leaves repeated or unresolved monetary rows
unresolved. It compares monetary cells by decimal value and requires a column
signal when a row contains more than one monetary value.

`resolve_entity_scope` accepts only source-proven bindings: a linked programme
identifier, an exact or descendant official programme URL, a programme name in
the document title, or an explicitly supplied/uniquely named organisation
unit. A faculty membership on the target programme is never used as a faculty
binding. After the existing official-domain gate, a programme/unknown scope
may be widened to institution scope; a faculty scope without a verified unit
remains unresolved.

`resolve_provenance` and `binding_for_assertion` repair missing metadata only
from the exact source binding (raw document ID first, then a unique canonical
URL). URL query parameters remain part of source identity. Existing conflicting
hashes, URLs, runs, authority, relationships, providers, or datasets are
never overwritten and remain a hard mismatch. Repaired evidence spans receive
an evidence locator and retain the original source lineage.

The production pipeline now passes the programme context into reconciliation;
the offline replay also loads an optional `organisation_units.jsonl` when a
run contains one. Existing acceptance hard gates and H1–H4 code are unchanged.

## Regression-corpus classification

The new resolver classified all 166 input review proposals. Categories are
based on the source/alignment/scope/provenance diagnostics, rather than on
institution-specific IDs or URLs.

| Root cause | Input review cases | Still review | Resolved/accepted |
| --- | ---: | ---: | ---: |
| ALIGNMENT_FIXABLE | 49 | 49 | 0 |
| SCOPE_BINDING_FIXABLE | 0 | 0 | 0 |
| PROVENANCE_FIXABLE | 66 | 57 | 9 |
| MULTIPLE_FIXES_REQUIRED | 39 | 3 | 36 |
| REAL_INSUFFICIENT_EVIDENCE | 2 | 2 | 0 |
| HARD_INVALID | 10 | 2 | 8 rejected |

The resolver aligned 106 review spans and computed 107 source/entity bindings;
105 review assertions received missing provenance from their exact bound
source. The retained run has no verified organisation-unit entity file, so the
five faculty/unit cases with no canonical unit remain review-only. The
remaining review reasons are: `BASIS_NOT_SUPPORTED` 19,
`CURRENCY_NOT_ESTABLISHED` 16, `MULTIPLE_AMOUNT_ROW_ALIGNMENT` 13,
`EVIDENCE_NOT_IN_SNAPSHOT` 8, `FUNDING_FACT_MISSING` 6,
`TARIFF_LABEL_NOT_SUPPORTED` 6, `FIELD_NOT_SUPPORTED` 6,
`DEADLINE_TYPE_NOT_SUPPORTED` 6, `SOURCE_EXCERPT_ONLY` 6,
`THRESHOLD_NOT_EXPLICIT` 6, `STRUCTURED_THRESHOLD_REQUIRES_REVIEW` 5,
`ORGANISATION_UNIT_UNVERIFIED` 5, `QUALIFIED_AMOUNT_REQUIRES_REVIEW` 4,
`REQUIREMENT_NOT_EXPLICIT` 4, `MISSING_PROVENANCE` 2, and
`ADMISSION_VS_COMPLETION_UNRESOLVED` 1.

## Acceptance replay

| Metric | Frozen input | After resolver + acceptance |
| --- | ---: | ---: |
| Accepted observed assertions | 38 | 83 |
| Newly accepted | — | 45 |
| `NEEDS_REVIEW` | 166 | 113 |
| Hard-rejected decisions | — | 8 |

The 45 newly accepted rows are 37 scholarships, 3 tuition, 2 minimum-degree,
1 additional-fees, 1 minimum-GPA, and 1 TOEFL assertion. Nine are programme
scoped and 36 are institution scoped. No new faculty assertion was accepted;
existing faculty rows retain their prior state. The after-set contains 42
programme-scoped and 41 institution-scoped accepted assertions. Context that
is not proved by the source remains unknown.

## Unchanged hierarchy replay

The existing hierarchy/uncertainty evaluator was run without code or parameter
changes over 361 target-field pairs:

| Measure | Result |
| --- | ---: |
| Direct coverage | 32 / 361 (8.86%) |
| H1 parent/faculty | 0 |
| H2 institution | 8 |
| H3 sibling | 0 |
| H4 peer/external | 0 |
| Missing-target abstentions | 321 / 329 (97.57%) |
| Usable tuition donors | 0 |

The eight H2 decisions still have one independent support, no numerical donor
dispersion, and the same heuristic uncertainty range (0.1987–0.3087). No
compatible tuition donor was created by broader scope binding. H1/H3/H4 stay
zero because the frozen evidence contains no compatible independent donors;
the hierarchy gates were not weakened.

## Safety and verification

No institution-specific resolver rule was added. Search remains discovery-only,
archive semantics remain historical, and unsupported values, identity
mismatches, unresolved row alignment, missing source lineage, and historical
mislabeling remain blocked. All useful assertions retain source URL, raw
document/hash/run, authority/relationship, and (when repaired) an exact
evidence locator.

Focused resolver and semantic acceptance tests: **52 passed**. Complete
ingestion test suite: **605 passed**. `compileall` for changed modules passed.

Generated artifacts:

- [`result.json`](result.json)
- [`evidence-resolution-decisions.jsonl`](evidence-resolution-decisions.jsonl)
- [`metadata-reconciliation-decisions.jsonl`](metadata-reconciliation-decisions.jsonl)
- [`acceptance-decisions.jsonl`](acceptance-decisions.jsonl)
- [`hierarchical-evaluation.json`](hierarchical-evaluation.json)

The remaining cases are predominantly real evidence/basis/currency or row
alignment gaps, so the next useful work is targeted field-bearing acquisition,
not further resolver relaxation.
