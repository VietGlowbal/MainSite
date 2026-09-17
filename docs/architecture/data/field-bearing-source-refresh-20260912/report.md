# Field-bearing source research and bounded refresh

This report records a direct web-research pass followed by one bounded refresh over the frozen six-institution/12-programme population. Only sources whose pages were opened and whose field-bearing content was verified were added. The existing acquisition, evidence-resolution, semantic-acceptance, hierarchy, uncertainty, storage, promotion, and benchmark rails were not changed.

## Research result

The ledger verified **14** field-bearing resources and rejected/deferred **6**. Four previously verified resources were retained without duplication. The machine-readable record is [`source-research-ledger.json`](source-research-ledger.json).

| Institution | Verified source | Exact fields observed | Scope / identifiers |
|---|---|---|---|
| mit-us | [MIT Student Financial Services — Cost of attendance for the Class of 2030](https://sfs.mit.edu/cost-of-attendance-class-of-2030/) | `tuition`, `additional_fees` | institution; institution and class-year page context; no programme identifier |
| mit-us | [MIT Admissions — First-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/) | `priority_deadline`, `final_deadline`, `funding_deadline`, `application_fee`, `required_documents`, `standardized_tests` | institution; first-year applicant scope; no programme identifier |
| mit-us | [MIT Admissions — Tests and scores](https://mitadmissions.org/apply/firstyear/tests-scores/) | `ielts_overall`, `toefl`, `duolingo`, `standardized_tests` | institution; first-year applicant scope; no programme identifier |
| cornell-us | [Cornell SC Johnson College — MPS Applied Economics and Management tuition and financing](https://business.cornell.edu/admissions/graduate/mps-aem/tuition-financing/) | `tuition`, `additional_fees`, `scholarships` | programme; MPS AEM programme name, Dyson/SC Johnson context; target programme_id bound from frozen manifest |
| cornell-us | [Cornell SC Johnson College — MPS Applied Economics and Management admissions](https://business.cornell.edu/admissions/graduate/mps-aem/) | `intakes`, `priority_deadline`, `final_deadline`, `application_fee`, `minimum_degree`, `minimum_gpa`, `duolingo`, `required_documents`, `programme_identity`, `credential` | programme; MPS AEM title, Dyson home school, Ithaca, 30 credits, ten-month programme |
| cornell-us | [Cornell Graduate School — Stipend rates](https://gradschool.cornell.edu/financial-support/stipend-rates/) | `scholarships` | institution; Cornell Graduate School rate categories; no programme identifier |
| eth-zurich-ch | [ETH Zurich — Master Data Science application](https://ethz.ch/en/studies/master/application/master-datascience.html) | `programme_identity`, `minimum_degree`, `required_documents`, `academic_transcript` | programme; Data Science MSc title and ETH programme path |
| eth-zurich-ch | [ETH Zurich — Master Robotics, Systems and Control application](https://ethz.ch/en/studies/master/application/master-robotics.html) | `programme_identity`, `minimum_degree`, `required_documents`, `standardized_tests` | programme; Robotics, Systems and Control MSc title and ETH programme path |
| eth-zurich-ch | [ETH Zurich — Excellence Scholarship and Opportunity Programme](https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html) | `scholarships` | institution; ETH ESOP programme; no canonical degree-programme identifier |
| sorbonne-fr | [Sorbonne University — Master Informatique](https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique) | `programme_identity`, `minimum_degree`, `required_documents`, `intakes` | programme; Master Informatique title and Faculty of Science and Engineering context |
| unsw-au | [UNSW Sydney — Master of Data Science and Decisions](https://www.unsw.edu.au/study/postgraduate/master-of-data-science-and-decisions) | `programme_identity`, `credential`, `academic_cycle`, `intakes`, `tuition`, `additional_fees`, `minimum_degree`, `minimum_gpa`, `ielts_overall`, `toefl`, `duolingo` | programme; program code 8959 and CRICOS 0101866 |
| unsw-au | [UNSW Scholarships — International scholarships 2026](https://www.scholarships.unsw.edu.au/scholarships/id/1895) | `scholarships` | institution; award IDs and scholarship names; no programme identifier |
| unsw-au | [UNSW Scholarships — International Student Award](https://www.scholarships.unsw.edu.au/international-student-award) | `scholarships` | institution; award page; no programme identifier |
| ntu-sg | [NTU — Master of Science in Data Science (MSDS)](https://www.ntu.edu.sg/computing/admissions/graduate-programmes/detail/master-of-science-in-data-science-%28msds%29) | `programme_identity`, `credential`, `tuition`, `additional_fees`, `application_fee`, `minimum_degree`, `ielts_overall`, `toefl`, `required_documents`, `scholarships` | programme; MSDS title and College of Computing and Data Science; no separate programme code in page text |

Cycle, audience, currency/basis and machine-readable details for every row are in the ledger. Examples with explicit current fields include MIT's 2026–27 undergraduate cost page (tuition and student-life fee), Cornell's MPS AEM finance page (tuition and mandatory fees), ETH's ESOP page (CHF 13,500 per semester), UNSW's 2026 programme page (fees, terms and English/entry information), and NTU's MSDS page (S$ fee table, application fee, language thresholds and funding notes).

## Rejected or not added

- [MIT graduate FAQ — price to attend](https://sfs.mit.edu/help/faq/what-is-the-price-to-attend-mit-for-graduates/) — States that prices vary by programme and redirects to the Registrar; it contains no usable tuition value.
- [ETH minimum-grade requirements](https://ethz.ch/en/studies/master/application/international-bachelor/prerequisites/minimum-grade-requirements.html) — Rendered threshold rows lack unambiguous country/scale labels, so a programme GPA mapping would be unsafe.
- [ETH Data Science appendix PDF](https://ethz.ch/content/dam/ethz/special-interest/infk/department/Images%20and%20Content/Studies/Master/DS/MSc-DataScience-Appendix.pdf) — The document applies to Autumn 2020+ and is not a current-cycle tuition/admissions source; retained only as historical context, not added to current refresh.
- [Sorbonne English Master page](https://sciences.sorbonne-universite.fr/en/study/degree-seeking/masters/master-computer-science) — The page is dated 2024 and duplicates language/degree context without a current-cycle numeric threshold; current French programme page is preferred.
- [NTU research graduate fee PDF](https://www.ntu.edu.sg/media/docs/default-source/graduate-admissions/research/fees/ay2026-2027researchfees_moe.pdf?sfvrsn=262da06e_2) — This is NTU research-degree pricing and is incompatible with the frozen NTU MSc Data Science coursework target.
- [Generic Cornell graduate policies](https://gradschool.cornell.edu/admissions/application-steps/) — It describes variable programme-specific policies but does not expose a target-specific value for the frozen programmes.

Explicit no-source findings:
- `minimum_gpa` for MIT, ETH Zurich, Sorbonne University, NTU: The researched official pages either state no minimum, provide qualitative standards, or do not expose a clearly scoped numeric GPA; no safe numeric source was added.
- `mandatory/additional fees` for MIT graduate, ETH Zurich programme-specific, Sorbonne programme-specific, UNSW programme-specific: Institution/COA or fee-table context exists, but a programme-specific mandatory fee with complete scope was not verified for these targets.
- `H3 sibling-programme tuition` for MIT, Cornell, ETH Zurich, Sorbonne University, UNSW, NTU: No independent, compatible sibling tariff with explicit target-comparable basis was verified within the bounded research budget.
- `H4 programme-level external tuition` for MIT, Cornell, ETH Zurich, Sorbonne University, UNSW, NTU: Government and generic external datasets investigated earlier are institution/context-level and do not provide a safe programme-level tuition value for these targets.

## Implementation

The refresh configuration is [`population-config.json`](population-config.json). It clones the frozen population and appends the verified resources as ordinary bounded `official_web`, `official_finance`, `central_admissions`, or `international_admissions` entries. Each entry carries provider/dataset identity, field groups, resolution, cycle/audience/basis when explicit, and a programme ID only for a deterministic programme match. The existing `manual_source` adapter and normal provenance path were reused; no new adapter or provider-specific core code was required. Existing verified MIT graduate, ETH, Sorbonne, UNSW and NTU resources remain configured once. External government/registry/accreditation providers were not enabled in this field-bearing run because they were not verified as field-bearing for these 12 targets.

## Bounded refresh

The run attempted 6 institutions and 12 programmes across AU, CH, FR, SG, US. It fetched 134 sources. Nine of the 14 newly verified resources were persisted; five were either blocked by the existing robots/domain policy or admitted but not selected within the bounded per-programme source limit. The run made 73 DeepSeek extraction calls with 3 provider failures.

| Verified provider resource | Runtime status | Effective non-null fields | Accepted OBSERVED fields |
|---|---|---|---|
| `mit_undergraduate_cost_2026` | ADMITTED:1, RAW_PERSISTED:1 | none | none |
| `mit_undergraduate_deadlines_2026` | REJECTED_BY_POLICY:1 | none | none |
| `mit_undergraduate_language_2026` | REJECTED_BY_POLICY:1 | none | none |
| `cornell_aem_finance` | ADMITTED:1, RAW_PERSISTED:1 | none | none |
| `cornell_aem_admissions` | ADMITTED:1, RAW_PERSISTED:1 | academic_transcript (1), application_fee (1), minimum_degree (1), minimum_gpa (1), recommendation_letters (1), required_documents (1), sop_essay_requirements (1), standardized_tests (3) | application_fee (1), minimum_degree (1) |
| `cornell_grad_stipends_2026` | ADMITTED:1, FETCH_FAILED:1 | none | none |
| `eth_data_science_application` | ADMITTED:1, RAW_PERSISTED:1 | recommendation_letters (1), sop_essay_requirements (1) | none |
| `eth_robotics_application` | ADMITTED:1, RAW_PERSISTED:1 | programme_identity (1), recommendation_letters (1), sop_essay_requirements (1), standardized_tests (1) | programme_identity (1) |
| `eth_esop_2027` | ADMITTED:1, RAW_PERSISTED:1 | scholarships (6) | scholarships (2) |
| `sorbonne_master_information` | ADMITTED:1 | none | none |
| `unsw_master_data_science_decisions_2026` | ADMITTED:1, RAW_PERSISTED:1 | graduation_certificate (1), programme_status (1) | programme_status (1) |
| `unsw_scholarships_2026` | ADMITTED:1, RAW_PERSISTED:1 | scholarships (4) | scholarships (1) |
| `unsw_international_student_award_2026` | ADMITTED:1, RAW_PERSISTED:1 | scholarships (2) | none |
| `ntu_msds_admissions_finance` | ADMITTED:1 | none | none |

New verified resources contributed 30 non-null effective assertions and seven newly accepted native observations. The accepted additions were scholarships (3), minimum degree (1), application fee (1), programme identity (1), and programme status (1); no newly verified resource produced an accepted tuition value in this run. Most accepted values still came from the previously configured official pages. The source-to-assertion attribution above is a join on retained content hash/raw document/URL; the extractor's own provider identifier remains the LLM adapter, while source provider identity is retained on `sources.jsonl`.

### Before versus after retained field values

| Field | Before retained | After retained | Before accepted | After accepted |
|---|---:|---:|---:|---:|
| `academic_cycle` | 3 | 3 | 3 | 3 |
| `academic_transcript` | 8 | 7 | 0 | 0 |
| `additional_fees` | 15 | 16 | 1 | 1 |
| `application_fee` | 4 | 6 | 4 | 6 |
| `credential` | 10 | 10 | 10 | 10 |
| `duolingo` | 0 | 0 | 0 | 0 |
| `final_deadline` | 4 | 6 | 0 | 0 |
| `funding_deadline` | 0 | 0 | 0 | 0 |
| `gpa_scale` | 0 | 1 | 0 | 1 |
| `graduation_certificate` | 0 | 6 | 0 | 0 |
| `ielts_overall` | 7 | 0 | 0 | 0 |
| `ielts_subscores` | 1 | 0 | 0 | 0 |
| `intakes` | 4 | 4 | 4 | 4 |
| `international_deadline` | 4 | 2 | 0 | 0 |
| `minimum_degree` | 7 | 5 | 2 | 2 |
| `minimum_gpa` | 11 | 10 | 1 | 0 |
| `priority_deadline` | 1 | 1 | 0 | 0 |
| `programme_identity` | 11 | 13 | 11 | 13 |
| `programme_status` | 0 | 5 | 0 | 3 |
| `recommendation_letters` | 0 | 8 | 0 | 0 |
| `required_documents` | 10 | 8 | 3 | 1 |
| `rolling_admission` | 0 | 0 | 0 | 0 |
| `scholarships` | 39 | 66 | 23 | 39 |
| `sop_essay_requirements` | 0 | 4 | 0 | 0 |
| `standardized_tests` | 0 | 10 | 0 | 2 |
| `subject_prerequisites` | 0 | 10 | 0 | 4 |
| `toefl` | 7 | 0 | 1 | 0 |
| `tuition` | 16 | 35 | 5 | 5 |

Current accepted native observations are 94 (43 programme-scoped, 51 institution-scoped); 142 non-null rows remain `NEEDS_REVIEW`. The accepted field counts are in [`refresh-results.json`](analysis/refresh-results.json).

## H1–H4 evaluation

The existing engine was run unchanged against the accepted-only pool and, separately, against all non-rejected observations as a diagnostic. The accepted-only tuition result is **0/12 direct**, H1 **0**, H2 **0**, H3 **0**, H4 **0**, with **12/12 hierarchical abstentions**. The diagnostic all-non-rejected pool has 6/12 direct tuition rows, one H2 activation, no H1/H3/H4 activation, and five abstentions among six targets lacking direct evidence. That one H2 candidate is a review-status observation and is not a usable accepted donor. No independent tuition donor exists. Across non-tuition fields, accepted H2 activations occur for intakes (1), minimum degree (2), scholarships (5), standardized tests (3), and subject prerequisites (1); there are no parent-unit records in this run, so H1 is not measurable, and no verified peer attributes exist for H4.

For the one diagnostic tuition H2 estimate, support count is 1, dispersion is 0, and the existing heuristic combined uncertainty is 0.1567. Tuition support/dispersion/uncertainty are otherwise not measurable on the accepted pool. No accuracy or calibration claim is made because this refresh has no independent held-out truth set.

## Remaining gaps

- Tuition is accepted only at institution scope (five observations) and has no accepted programme-level value in this run; no independent H3 or H4 tuition donor was verified.
- Additional fees have one accepted institution-level observation; programme-specific mandatory fees remain sparse.
- Current accepted deadline values remain sparse (intakes are present; funding/rolling deadlines are not); MIT language pages were rejected by the existing domain policy because `mitadmissions.org` is not in the seed's approved domains, and Cornell graduate pages were blocked by robots.
- Numeric IELTS/TOEFL and GPA coverage is incomplete in this run. ETH and Sorbonne sources expose qualitative language/degree requirements, while the researched numeric sources were not all selected or accepted by the current schema/field mapping.
- Scholarship observations increased substantially, but many retain award-specific eligibility/amount context requiring review; they are not tuition donors.
- The next bounded input work should narrowly admit verified official admissions domains/resources and target the unselected NTU/Sorbonne/MIT pages, then add a source-specific table/fee mapping only where the retained evidence demonstrably contains the verified value. No generic external provider expansion is justified by this run.

## Artifacts

- [`source-research-ledger.json`](source-research-ledger.json)
- [`source-research-report.md`](source-research-report.md)
- [`population-config.json`](population-config.json)
- [`population-manifest.json`](population-manifest.json)
- [`runs/field-bearing-refresh-20260912`](runs/field-bearing-refresh-20260912)
- [`analysis/refresh-results.json`](analysis/refresh-results.json)
- [`analysis/hierarchical-evaluation.json`](analysis/hierarchical-evaluation.json)
