# Phase 3F source adequacy audit — phase3f-v2-run-20260905T030109Z

> Post-seal diagnostic only. Frozen truth was read after the sealed run artifact; it was not supplied to the pipeline, discovery, extraction, or projection stages.

## Result

The audit covers **122** confirmed primary resolved cases: 118 `FOUND` value cases and 4 `NOT_REQUIRED` semantic cases.

- Confirmed supporting evidence fetched: **83**
- Fetched but ambiguous/insufficient support: **21**
- Supporting evidence absent from fetched material: **18**
- Field-relevant material fetched (confirmed + ambiguous): **104/122 = 85.25%**
- `FIELD_EVIDENCE_DISCOVERY_RECALL` (confirmed support): **83/122 = 68.03%**
- Matrix: `C:\Users\ADMIN\orca\workspaces\MainSite\data-platform\docs\benchmarks\runs\phase3f-v2-run-20260905T030109Z\run3-field-evidence-audit.jsonl`

The audit intentionally counts fetched-but-ambiguous material as fetched for discovery recall, while retaining it as a separate evidence quality class. A source is only marked direct when conservative expected-value/evidence signals are present; official authority alone does not qualify.

## Per-field evidence availability

| Field | Cases | Support fetched | Material fetched | Ambiguous | Upstream | Downstream |
| --- | --- | --- | --- | --- | --- | --- |
| application_deadline | 4 | 1 | 4 | 3 | 0 | 4 |
| credential | 30 | 25 | 26 | 1 | 5 | 25 |
| english_requirement | 24 | 13 | 17 | 4 | 11 | 13 |
| major_admissions_requirement | 19 | 13 | 17 | 4 | 2 | 17 |
| programme_identity | 34 | 25 | 30 | 5 | 9 | 25 |
| programme_status | 0 | 0 | 0 | 0 | 0 | 0 |
| tuition | 11 | 6 | 10 | 4 | 1 | 10 |

## Per-institution evidence availability

| Institution | Cases | Support fetched | Material fetched | Recall | Upstream | Downstream |
| --- | --- | --- | --- | --- | --- | --- |
| Cornell | 14 | 10 | 12 | 71.43% | 3 | 11 |
| Duke | 11 | 7 | 11 | 63.64% | 4 | 7 |
| ETH Zurich | 12 | 12 | 12 | 100.00% | 0 | 12 |
| Harvard | 10 | 8 | 9 | 80.00% | 2 | 8 |
| MIT | 10 | 6 | 10 | 60.00% | 0 | 10 |
| Northwestern | 9 | 6 | 9 | 66.67% | 1 | 8 |
| Princeton | 9 | 2 | 2 | 22.22% | 7 | 2 |
| Sorbonne Université | 8 | 5 | 8 | 62.50% | 1 | 7 |
| UCLA | 10 | 9 | 10 | 90.00% | 1 | 9 |
| University of Michigan | 10 | 2 | 3 | 20.00% | 7 | 3 |
| University of Tokyo | 12 | 11 | 11 | 91.67% | 1 | 11 |
| Université de Montréal | 7 | 5 | 7 | 71.43% | 1 | 6 |

## Source-family distribution

| Source family | Cases |
| --- | --- |
| PROGRAMME_SPECIFIC_OFFICIAL | 71 |
| CENTRAL_OR_SPECIALIST_OFFICIAL | 28 |
| OFFICIAL_OTHER | 4 |
| OFFICIAL_PDF | 1 |
| NONE | 0 |

## Upstream vs downstream

| Bucket | Cases |
| --- | --- |
| DOWNSTREAM_PROCESSING_GAP | 94 |
| UPSTREAM_EVIDENCE_GAP | 28 |

### Upstream subcategories

| Subcategory | Cases |
| --- | --- |
| expected_or_related_supporting_source_not_fetched | 14 |
| fetched_source_is_field_relevant_but_support_is_not_proven | 6 |
| source_access_blocked_or_fetch_failed | 4 |
| fetched_candidate_source_is_insufficient_for_field | 4 |

### Downstream subcategories

| Subcategory | Cases |
| --- | --- |
| supported_evidence_fetched_but_not_resolved_or_projected | 83 |
| fetched_field_context_requires_downstream_semantic_processing | 11 |

## Interpretation

`required_source_discovery_recall = 100%` measures that the routed programme/source keys were discovered/admitted. It does not establish that a fetched document contains the field-specific fact. This audit therefore uses field-level raw/evidence support as a separate diagnostic metric and does not alter the frozen scorer contract.

The matrix distinguishes a programme page that was fetched but lacks tuition/deadline/language/admissions content from a supporting source that was fetched and then lost in extraction, assertion selection, applicability/temporal validation, conflict handling, or projection. `NOT_REQUIRED` rows are audited for explicit scoped non-requirement evidence rather than a monetary/text value.

## Scope and limitations

This is a conservative automated triage. `DIRECT` requires a fetched raw source with a deterministic support signal or a corroborating runtime assertion; `AMBIGUOUS` means field-relevant material was fetched but semantic support is not proven. Only `DIRECT` contributes to the strict field-evidence discovery recall; ambiguous rows remain candidates for manual evidence review. No search result snippet, third-party text, or expected truth value was used as runtime evidence during pipeline execution.

No official benchmark #4 was run.
