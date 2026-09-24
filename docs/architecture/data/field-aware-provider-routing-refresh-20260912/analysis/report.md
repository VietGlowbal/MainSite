# Field-aware input refresh audit

This report is a research-only analysis of the bounded semantic refresh. It does not modify canonical truth or hierarchy logic.

## Refresh

- Frozen institutions: 10
- Frozen programme targets: 20; live programmes acquired: 19
- Countries: AU, CA, CH, FR, SG, US
- LLM calls: 38; valid native observed assertions: 38 effective (39 raw proposals before effective merge)
- Semantic non-null values needing review: 169; unsupported/rejected proposals: 57; schema/provider failures: 0

## Field coverage (conservative state classification)

| Field | Explicit | Extractable | Partial | Ambiguous | Runtime blocked | No evidence | Explicit % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| programme_identity | 18 | 1 | 0 | 0 | 0 | 0 | 94.7% |
| credential | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| programme_status | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| programme_focus | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| curriculum_overview | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| specialisations | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| learning_outcomes | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| academic_cycle | 3 | 15 | 0 | 0 | 0 | 1 | 15.8% |
| tuition | 0 | 4 | 5 | 5 | 1 | 4 | 0.0% |
| application_fee | 5 | 2 | 0 | 0 | 4 | 8 | 26.3% |
| additional_fees | 0 | 4 | 0 | 6 | 2 | 7 | 0.0% |
| intakes | 6 | 10 | 0 | 0 | 1 | 2 | 31.6% |
| priority_deadline | 0 | 11 | 0 | 1 | 3 | 4 | 0.0% |
| funding_deadline | 0 | 12 | 0 | 0 | 3 | 4 | 0.0% |
| international_deadline | 0 | 12 | 0 | 0 | 3 | 4 | 0.0% |
| final_deadline | 0 | 8 | 1 | 3 | 3 | 4 | 0.0% |
| application_deadline | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| rolling_admission | 1 | 14 | 0 | 0 | 0 | 4 | 5.3% |
| application_url | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| minimum_degree | 0 | 7 | 0 | 7 | 1 | 4 | 0.0% |
| minimum_gpa | 0 | 3 | 0 | 5 | 2 | 9 | 0.0% |
| gpa_scale | 3 | 8 | 0 | 0 | 2 | 6 | 15.8% |
| subject_prerequisites | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| standardized_tests | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| work_experience | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| portfolio | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| required_documents | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| recommendation_letters | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| sop_essay_requirements | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| graduation_certificate | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| academic_transcript | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| major_admissions_requirement | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| english_requirement | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| ielts_overall | 0 | 13 | 1 | 2 | 1 | 2 | 0.0% |
| ielts_subscores | 0 | 7 | 0 | 1 | 2 | 9 | 0.0% |
| toefl | 0 | 13 | 1 | 2 | 1 | 2 | 0.0% |
| duolingo | 0 | 15 | 0 | 0 | 1 | 3 | 0.0% |
| scholarships | 0 | 3 | 2 | 9 | 0 | 5 | 0.0% |
| career_outcomes | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |
| employment_outcomes | 0 | 0 | 0 | 0 | 5 | 14 | 0.0% |

## Institution coverage

| Institution | Targets | Explicit field slots | Slot coverage | Fields with any explicit value | Fetch errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| cornell-us | 2 | 7 / 80 | 8.8% | 5 | 0 |
| duke-us | 2 | 3 / 80 | 3.8% | 2 | 0 |
| eth-zurich-ch | 2 | 2 / 80 | 2.5% | 1 | 0 |
| mit-us | 2 | 5 / 80 | 6.2% | 3 | 0 |
| ntu-sg | 2 | 3 / 80 | 3.8% | 2 | 2 |
| sorbonne-fr | 2 | 4 / 80 | 5.0% | 2 | 0 |
| stanford-us | 2 | 3 / 80 | 3.8% | 2 | 0 |
| toronto-ca | 1 | 1 / 40 | 2.5% | 1 | 1 |
| ucla-us | 2 | 3 / 80 | 3.8% | 3 | 10 |
| unsw-au | 2 | 5 / 80 | 6.2% | 3 | 0 |

## Hierarchical evaluation

Only existing native observed, rule-validated assertions were supplied to the unchanged H1-H4 engine. Accuracy and calibration are not measurable without held-out truth.

| Field | Direct evidence | Direct conflicts | H1 | H2 | H3 | H4 | Abstention | Mean support | Mean uncertainty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| programme_identity | 94.7% | 2 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| credential | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| programme_status | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| programme_focus | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| curriculum_overview | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| specialisations | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| learning_outcomes | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| academic_cycle | 15.8% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| tuition | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_fee | 5.3% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| additional_fees | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| intakes | 26.3% | 0 | 0 | 1 | 0 | 0 | 94.7% | 1.0 | H2_INSTITUTION:0.1987 |
| priority_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| funding_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| international_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| final_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| rolling_admission | 5.3% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_url | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| minimum_degree | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| minimum_gpa | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| gpa_scale | 15.8% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| subject_prerequisites | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| standardized_tests | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| work_experience | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| portfolio | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| required_documents | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| recommendation_letters | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| sop_essay_requirements | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| graduation_certificate | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| academic_transcript | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| major_admissions_requirement | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| english_requirement | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| ielts_overall | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| ielts_subscores | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| toefl | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| duolingo | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| scholarships | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| career_outcomes | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| employment_outcomes | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |

## Source contribution

- Retained source rows: 107; all semantic-run rows are official/direct-official, with source_class labels missing because this run predates the metadata patch.
- Explicit assertions with official university-controlled provenance: 38
- Explicit assertions from government/registry/partner/external authorities: 0
- The post-patch metadata smoke run is retained separately and confirms `source_class=official_web`, `adapter_id=manual_source`; no external provider yielded a field assertion in this refresh.

## Interpretation

- Field-aware ranking and bounded retention increased the amount of semantically reviewable input, especially for programme identity/context, curriculum, outcomes, and some finance/admissions fields.
- The strict accepted tuition set remains empty; tuition values in this run are review-only because cycle/basis/scope context is incomplete or the source was an excerpt.
- No organisation-unit catalogue was retained in this refresh, so H1 is unavailable. Institution-scoped rows are attached to programme records and do not establish independent institution donor entities; H2 is therefore interpreted conservatively. Peer attributes are not verified, so H4 abstains.
- Search/archive invariants and the validated durable-storage path were not changed. This run made no search-to-assertion conversion and no inferred value was promoted.
