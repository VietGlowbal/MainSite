# Stage 1 hierarchical coverage optimization

Artifact-only replay of the frozen Stage 1 population (`418` programmes, `209` institutions). The replay uses accepted external semantic assertions plus the already-promoted deterministic programme metadata. It does not mutate ingestion or product state. Direct counts in this report are field-slot counts over both rails (`1187` accepted semantic rows and `478` accepted metadata rows); they are therefore not directly comparable with the earlier semantic-only aggregate in `stage1-report.md`.

## Policy change applied

Two concrete false negatives were fixed narrowly:

1. A finance value's `credential` label (for example, `out-of-state students` or `Domestic tuition`) is not a degree. Degree extraction no longer reads that payload key.
2. For `tuition` and `additional_fees` only, a government/official institution-scoped tariff may be selected at H2 when the target is in that institution. The value remains explicitly institution-scoped in the exports; audience, currency, basis, temporal mismatch, authority, relationship, and applicability safety checks remain in force. It is still an advisory hierarchy result, not a programme-scoped accepted assertion.

| field | old gate/problem | real examples | safe condition now | added coverage | residual risk guard |
|---|---|---|---|---:|---|
| `tuition`, `additional_fees` | finance `credential` labels could be consumed as degree metadata (`18` additional-fee H2 rejects in the baseline); remaining tuition candidate rejections are still evaluated by the normal gates | College Scorecard residency labels; swissuniversities domestic/foreign tariff labels | read only explicit degree keys for finance; never infer degree from `credential` | removes the false-negative degree gate and makes eligible finance donors visible | true degree mismatches and audience mismatches remain rejected |
| `tuition`, `additional_fees` | strict H2 `DEGREE_UNKNOWN`, `CYCLE_UNKNOWN`, and `APPLICABILITY_UNKNOWN` rejected institution tariffs even though the source scope is institution-wide | government/official institution tariff rows matched to the same institution | H2 + institution-scoped donor + finance field; preserve institution output scope and source-native cycle (or blank when not supplied) | 87 tuition + 16 fee H2 selections | audience, currency, basis, temporal mismatch, authority, relationship and scope checks remain active |

No H1/H3/H4 gates, acceptance policy, uncertainty calculation, or storage path were changed.

## Before vs after aggregate

| rail | before | after |
|---|---:|---:|
| Direct | 849 | 849 |
| H1 | 0 | 0 |
| H2 | 0 | 103 |
| H3 | 82 | 82 |
| H4 | 0 | 0 |
| Final selected (direct + hierarchy) | 931 | 1034 |
| Review | 151 | 151 |
| Abstain | 7278 | 7175 |
| Missing | 7524 | 7524 |

The “final selected” column includes advisory H1-H4 selections for completeness measurement; those rows retain donor provenance and are not silently promoted to accepted programme facts.

## Field-level hierarchy breakdown

| field | direct | H1 | H2 | H3 | H4 | final | review | abstain | missing | before | after | gain |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `programme_identity` | 167 | 0 | 0 | 12 | 0 | 179 | 0 | 239 | 0 | 39.95% | 42.82% | 2.87 pp |
| `credential` | 158 | 0 | 0 | 14 | 0 | 172 | 0 | 246 | 0 | 37.8% | 41.15% | 3.35 pp |
| `programme_status` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `academic_cycle` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `tuition` | 5 | 0 | 87 | 0 | 0 | 92 | 98 | 228 | 0 | 1.2% | 22.01% | 20.81 pp |
| `additional_fees` | 0 | 0 | 16 | 0 | 0 | 16 | 0 | 402 | 0 | 0.0% | 3.83% | 3.83 pp |
| `duration` | 152 | 0 | 0 | 10 | 0 | 162 | 0 | 256 | 0 | 36.36% | 38.76% | 2.39 pp |
| `location` | 150 | 0 | 0 | 12 | 0 | 162 | 0 | 256 | 0 | 35.89% | 38.76% | 2.87 pp |
| `delivery_mode` | 161 | 0 | 0 | 11 | 0 | 172 | 0 | 246 | 0 | 38.52% | 41.15% | 2.63 pp |
| `programme_language` | 15 | 0 | 0 | 1 | 0 | 16 | 0 | 402 | 0 | 3.59% | 3.83% | 0.24 pp |
| `career_outcomes` | 4 | 0 | 0 | 13 | 0 | 17 | 23 | 378 | 0 | 0.96% | 4.07% | 3.11 pp |
| `employment_outcomes` | 7 | 0 | 0 | 8 | 0 | 15 | 22 | 381 | 0 | 1.67% | 3.59% | 1.91 pp |
| `intakes` | 7 | 0 | 0 | 0 | 0 | 7 | 0 | 411 | 0 | 1.67% | 1.67% | 0.0 pp |
| `final_deadline` | 6 | 0 | 0 | 0 | 0 | 6 | 0 | 412 | 0 | 1.44% | 1.44% | 0.0 pp |
| `rolling_admission` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `minimum_degree` | 1 | 0 | 0 | 0 | 0 | 1 | 3 | 414 | 0 | 0.24% | 0.24% | 0.0 pp |
| `subject_prerequisites` | 4 | 0 | 0 | 0 | 0 | 4 | 2 | 412 | 0 | 0.96% | 0.96% | 0.0 pp |
| `required_documents` | 3 | 0 | 0 | 1 | 0 | 4 | 0 | 414 | 0 | 0.72% | 0.96% | 0.24 pp |
| `standardized_tests` | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 416 | 0 | 0.24% | 0.24% | 0.0 pp |
| `work_experience` | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 416 | 0 | 0.48% | 0.48% | 0.0 pp |
| `ielts_overall` | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 416 | 0 | 0.48% | 0.48% | 0.0 pp |
| `ielts_subscores` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `toefl` | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 416 | 0 | 0.48% | 0.48% | 0.0 pp |
| `duolingo` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `application_fee` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `priority_deadline` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `international_deadline` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `funding_deadline` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `minimum_gpa` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `gpa_scale` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `recommendation_letters` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `sop_essay_requirements` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `portfolio` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `scholarships` | 2 | 0 | 0 | 0 | 0 | 2 | 2 | 414 | 0 | 0.48% | 0.48% | 0.0 pp |
| `funding` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `funding_amount` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `funding_eligibility` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |
| `application_url` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 418 | 0.0% | 0.0% | 0.0 pp |

## Rejection analysis

The full gate-level analysis is in `stage1-hierarchy-rejection-analysis.csv`. The largest clusters after the fix are shown below; H4 `PEER_ATTRIBUTES_UNVERIFIED` is expected because the Stage 1 catalogue has no verified peer attributes, and remains intentionally unchanged.

| field | level | gate | before | after | changed |
|---|---|---|---:|---:|---|
| `tuition` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 58371 | 58371 | NO |
| `employment_outcomes` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 50757 | 50757 | NO |
| `career_outcomes` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 43262 | 43262 | NO |
| `programme_identity` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 41904 | 41904 | NO |
| `delivery_mode` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 41364 | 41364 | NO |
| `credential` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 41064 | 41064 | NO |
| `duration` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 40422 | 40422 | NO |
| `location` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 40188 | 40188 | NO |
| `programme_language` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 6042 | 6042 | NO |
| `additional_fees` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 3744 | 3744 | NO |
| `intakes` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 2876 | 2876 | NO |
| `final_deadline` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 2472 | 2472 | NO |
| `standardized_tests` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 1664 | 1664 | NO |
| `subject_prerequisites` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 1656 | 1656 | NO |
| `required_documents` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 1244 | 1244 | NO |
| `ielts_overall` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 832 | 832 | NO |
| `scholarships` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 832 | 832 | NO |
| `toefl` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 832 | 832 | NO |
| `work_experience` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 832 | 832 | NO |
| `minimum_degree` | H4 | `PEER_ATTRIBUTES_UNVERIFIED` | 416 | 416 | NO |

## Programme completeness

| statistic | before | after |
|---|---:|---:|
| p25 | 0.00% | 0.00% |
| p50 (median) | 0.00% | 2.63% |
| p75 | 13.16% | 13.16% |

Programmes gaining hierarchy-selected fields: `{'1-2 fields': 103, '0 fields': 304, '>5 fields': 4, '3-5 fields': 7}`.

## Scope safety

Institution-level H2 finance values are marked `target_scope=institution`, with donor institution and source-native currency/basis/academic-cycle retained. They are never relabelled as programme tuition or programme fees. Empty fields, unresolved direct reviews, incompatible donors, and absent providers remain review/abstain/missing in the full matrix.

## Artifacts

- `stage1-full-hierarchical-review.csv` — one row per programme × field (`15884` rows)
- `stage1-hierarchy-field-summary.csv` — field-level before/after summary (`38` rows)
- `stage1-programme-completeness.csv` — one row per programme (`418` rows)
- `stage1-hierarchy-donor-review.csv` — all selected hierarchy transfers (`185` rows)
- `stage1-hierarchy-rejection-analysis.csv` — gate-level candidate rejection counts (`35` rows)
