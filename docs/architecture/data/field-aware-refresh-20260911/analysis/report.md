# Field-aware input refresh audit

This report is a research-only analysis of the bounded semantic refresh. It does not modify canonical truth or hierarchy logic.

## Refresh

- Frozen institutions: 10
- Frozen programme targets: 20; live programmes acquired: 19
- Countries: AU, CA, CH, FR, SG, US
- LLM calls: 38; valid native observed assertions: 231 effective (232 raw proposals before effective merge)
- Semantic non-null values needing review: 230; unsupported/rejected proposals: 55; schema/provider failures: 1

## Field coverage (conservative state classification)

| Field | Explicit | Extractable | Partial | Ambiguous | Runtime blocked | No evidence | Explicit % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| programme_identity | 18 | 1 | 0 | 0 | 0 | 0 | 94.7% |
| credential | 17 | 2 | 0 | 0 | 0 | 0 | 89.5% |
| programme_status | 2 | 17 | 0 | 0 | 0 | 0 | 10.5% |
| programme_focus | 18 | 1 | 0 | 0 | 0 | 0 | 94.7% |
| curriculum_overview | 17 | 2 | 0 | 0 | 0 | 0 | 89.5% |
| specialisations | 5 | 10 | 0 | 0 | 0 | 4 | 26.3% |
| learning_outcomes | 16 | 2 | 0 | 0 | 1 | 0 | 84.2% |
| academic_cycle | 3 | 14 | 0 | 0 | 0 | 2 | 15.8% |
| tuition | 0 | 6 | 7 | 3 | 0 | 3 | 0.0% |
| application_fee | 6 | 2 | 0 | 0 | 2 | 9 | 31.6% |
| additional_fees | 0 | 3 | 0 | 5 | 2 | 9 | 0.0% |
| intakes | 3 | 12 | 0 | 0 | 0 | 4 | 15.8% |
| priority_deadline | 0 | 11 | 0 | 1 | 1 | 6 | 0.0% |
| funding_deadline | 0 | 12 | 0 | 0 | 1 | 6 | 0.0% |
| international_deadline | 0 | 12 | 0 | 0 | 1 | 6 | 0.0% |
| final_deadline | 0 | 8 | 2 | 2 | 1 | 6 | 0.0% |
| application_deadline | 0 | 0 | 0 | 0 | 3 | 16 | 0.0% |
| rolling_admission | 0 | 15 | 0 | 0 | 0 | 4 | 0.0% |
| application_url | 6 | 10 | 0 | 0 | 0 | 3 | 31.6% |
| minimum_degree | 0 | 5 | 0 | 7 | 0 | 7 | 0.0% |
| minimum_gpa | 0 | 2 | 0 | 4 | 2 | 11 | 0.0% |
| gpa_scale | 2 | 8 | 0 | 0 | 1 | 8 | 10.5% |
| subject_prerequisites | 0 | 3 | 0 | 16 | 0 | 0 | 0.0% |
| standardized_tests | 0 | 7 | 0 | 6 | 1 | 5 | 0.0% |
| work_experience | 2 | 14 | 0 | 0 | 0 | 3 | 10.5% |
| portfolio | 1 | 6 | 0 | 0 | 1 | 11 | 5.3% |
| required_documents | 0 | 4 | 4 | 5 | 1 | 5 | 0.0% |
| recommendation_letters | 0 | 6 | 3 | 4 | 0 | 6 | 0.0% |
| sop_essay_requirements | 0 | 6 | 1 | 3 | 1 | 8 | 0.0% |
| graduation_certificate | 0 | 10 | 4 | 3 | 0 | 2 | 0.0% |
| academic_transcript | 0 | 6 | 3 | 9 | 0 | 1 | 0.0% |
| major_admissions_requirement | 0 | 0 | 0 | 0 | 3 | 16 | 0.0% |
| english_requirement | 0 | 0 | 0 | 0 | 3 | 16 | 0.0% |
| ielts_overall | 0 | 14 | 1 | 1 | 0 | 3 | 0.0% |
| ielts_subscores | 0 | 6 | 0 | 0 | 1 | 12 | 0.0% |
| toefl | 0 | 14 | 1 | 1 | 0 | 3 | 0.0% |
| duolingo | 0 | 15 | 0 | 0 | 0 | 4 | 0.0% |
| scholarships | 0 | 6 | 2 | 6 | 0 | 5 | 0.0% |
| career_outcomes | 12 | 4 | 1 | 0 | 0 | 2 | 63.2% |
| employment_outcomes | 0 | 12 | 0 | 2 | 0 | 5 | 0.0% |

## Institution coverage

| Institution | Targets | Explicit field slots | Slot coverage | Fields with any explicit value | Fetch errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| cornell-us | 2 | 16 / 80 | 20.0% | 12 | 0 |
| duke-us | 2 | 12 / 80 | 15.0% | 6 | 0 |
| eth-zurich-ch | 2 | 13 / 80 | 16.2% | 7 | 0 |
| mit-us | 2 | 13 / 80 | 16.2% | 7 | 0 |
| ntu-sg | 2 | 14 / 80 | 17.5% | 9 | 0 |
| sorbonne-fr | 2 | 14 / 80 | 17.5% | 9 | 0 |
| stanford-us | 2 | 15 / 80 | 18.8% | 9 | 0 |
| toronto-ca | 1 | 6 / 40 | 15.0% | 6 | 1 |
| ucla-us | 2 | 9 / 80 | 11.2% | 6 | 9 |
| unsw-au | 2 | 16 / 80 | 20.0% | 11 | 0 |

## Hierarchical evaluation

Only existing native observed, rule-validated assertions were supplied to the unchanged H1-H4 engine. Accuracy and calibration are not measurable without held-out truth.

| Field | Direct evidence | Direct conflicts | H1 | H2 | H3 | H4 | Abstention | Mean support | Mean uncertainty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| programme_identity | 94.7% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| credential | 89.5% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| programme_status | 10.5% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| programme_focus | 94.7% | 2 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| curriculum_overview | 89.5% | 17 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| specialisations | 26.3% | 1 | 0 | 0 | 1 | 0 | 94.7% | 1.0 | H3_SIBLING_PROGRAMME:0.367 |
| learning_outcomes | 84.2% | 6 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| academic_cycle | 15.8% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| tuition | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_fee | 5.3% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| additional_fees | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| intakes | 15.8% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| priority_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| funding_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| international_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| final_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_deadline | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| rolling_admission | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| application_url | 21.1% | 0 | 0 | 1 | 0 | 0 | 94.7% | 1.0 | H2_INSTITUTION:0.1987 |
| minimum_degree | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| minimum_gpa | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| gpa_scale | 10.5% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| subject_prerequisites | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| standardized_tests | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| work_experience | 10.5% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| portfolio | 5.3% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
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
| career_outcomes | 63.2% | 8 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |
| employment_outcomes | 0.0% | 0 | 0 | 0 | 0 | 0 | 100.0% | — | not measurable |

## Source contribution

- Retained source rows: 94; all semantic-run rows are official/direct-official, with source_class labels missing because this run predates the metadata patch.
- Explicit assertions with official university-controlled provenance: 231
- Explicit assertions from government/registry/partner/external authorities: 0
- The post-patch metadata smoke run is retained separately and confirms `source_class=official_web`, `adapter_id=manual_source`; no external provider yielded a field assertion in this refresh.

## Interpretation

- Field-aware ranking and bounded retention increased the amount of semantically reviewable input, especially for programme identity/context, curriculum, outcomes, and some finance/admissions fields.
- The strict accepted tuition set remains empty; tuition values in this run are review-only because cycle/basis/scope context is incomplete or the source was an excerpt.
- No organisation-unit catalogue was retained in this refresh, so H1 is unavailable. Institution-scoped rows are attached to programme records and do not establish independent institution donor entities; H2 is therefore interpreted conservatively. Peer attributes are not verified, so H4 abstains.
- Search/archive invariants and the validated durable-storage path were not changed. This run made no search-to-assertion conversion and no inferred value was promoted.
