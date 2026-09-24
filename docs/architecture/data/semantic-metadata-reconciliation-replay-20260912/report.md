# Retained semantic metadata reconciliation — 2026-09-12

This deterministic replay used the frozen `routed-refresh-20260912` sample: 20 selected targets, 19 acquired programmes and 19 requested fields. It made **0** acquisition requests, LLM calls, database writes and promotion calls. Input hashes and row-level decisions are in [`result.json`](result.json) and [`metadata-reconciliation-decisions.jsonl`](metadata-reconciliation-decisions.jsonl).

## Reconciliation boundary

The pass uses only the hash-verified source already named by an assertion: exact passage, nearby document context, heading/title and retained source metadata. It does not use institution country to infer currency, target programme membership to infer faculty, a different URL, or a new source. An unavailable source binding or hash mismatch leaves the assertion unchanged.

| Metadata | Recovered | Rule |
| --- | ---: | --- |
| Cycle | 24 | Explicit same-source year range normalised, such as `2026-27` to `2026-2027` |
| Currency | 8 | Explicit same-source `Total Direct Costs (USD)` context verified USD |
| Basis | 6 | Explicit same-source `Academic Year` context mapped to `per year`, preserving `fee_period_raw` |
| Audience | 0 | No additional explicit audience context in affected rows |
| Organisation unit | 0 | No retained source-to-existing organisation-unit identity binding |
| Scope/applicability | 0 | Existing scope retained; no programme/faculty applicability invented |

There were 98 verified source bindings. Nine raw snapshots failed their retained content-hash check and 287 proposal rows had no usable same-source binding; neither group was reconciled.

The Duke Fuqua fee table demonstrates the boundary: its same-source table context establishes the programme context, USD and academic-year context. Six annual rows retain `fee_period: "per year"` plus `fee_period_raw: "academic year"`; two one-off rows retain `once` because the source establishes no different basis. Bare-dollar MIT tariffs remain currency-unknown: no locale-based currency was introduced.

## Acceptance result

| Metric | Before reconciliation replay | After reconciliation replay |
| --- | ---: | ---: |
| Accepted observed assertions | 78 | 78 |
| NEEDS_REVIEW | 118 | 118 |
| New hard rejections | 8 | 8 |
| Accepted tuition assertions | 2 | 2 |
| Accepted faculty/parent assertions | 0 | 0 |

The new metadata is retained even where a row remains review-only. No row crossed `NEEDS_REVIEW → RULE_VALIDATED` in this frozen replay because its remaining blocker was factual-row alignment or scope evidence, not recovered metadata. Five faculty/school cases remain `ORGANISATION_UNIT_UNVERIFIED`; the frozen run has no verified source-to-existing-unit binding. The principal unresolved reasons are `CURRENCY_NOT_ESTABLISHED` (16), `BASIS_NOT_SUPPORTED` (19), `MULTIPLE_AMOUNT_ROW_ALIGNMENT` (13), `EVIDENCE_NOT_IN_SNAPSHOT` (9), and `MISSING_PROVENANCE` (8). They require targeted acquisition or identity materialisation, not metadata guessing.

## Unchanged H1–H4 replay

The existing hierarchy and uncertainty implementation ran unchanged over 361 target-field pairs.

| Metric | Result |
| --- | ---: |
| Direct target coverage | 32 / 361 (8.86%) |
| H1 parent/faculty | 0 |
| H2 institution | 8 |
| H3 sibling | 0 |
| H4 peer/external | 0 |
| Missing-target abstentions | 321 / 329 (97.57%) |
| Usable tuition donors | 0 |

All eight H2 results have one independent support and no numeric donor dispersion: intakes (1), minimum degree (2), scholarships (5). Their heuristic uncertainty is 0.1987–0.3087 (five `LOW`, three `MEDIUM`), driven by hierarchy distance and one-support evidence; medium cases also have unknown applicability. Three direct conflicts and three incompatible non-numeric donor conflicts abstain. The reconciled tuition rows do not become compatible tuition donors because no accepted current tuition tariff with a compatible explicit currency/basis resulted.

## Verification

- Focused semantic, tuition and hierarchy tests: **69 passed**.
- Complete ingestion suite with the test-harness import path: **542 passed**.
- `python -m compileall -q` for changed semantic/replay modules: passed.
- `git diff --check`: passed.

No acquisition, LLM extraction, storage change, canonical-truth mutation, promotion, Benchmark V3 run, commit or push occurred.
