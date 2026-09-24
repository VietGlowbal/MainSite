# Field-bearing source research — 2026-09-12

This bounded source pass used the frozen six-institution/12-programme population.
Only pages opened and inspected directly were eligible for the refresh
configuration. The existing `ManualSourceAdapter` and normal source-resolution
path are sufficient for these HTML resources; no new provider type or parser was
needed.

## Verified field-bearing sources

| Institution | Source | Verified fields | Scope and matching |
|---|---|---|---|
| MIT | [undergraduate cost of attendance](https://sfs.mit.edu/cost-of-attendance-class-of-2030/) | `tuition`, `additional_fees` | Institution/undergraduate, 2026–27, annual; no programme ID |
| MIT | [first-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/) | `priority_deadline`, `final_deadline`, `funding_deadline`, `application_fee`, `required_documents`, `standardized_tests` | Institution/first-year undergraduate; no programme ID |
| MIT | [tests and scores](https://mitadmissions.org/apply/firstyear/tests-scores/) | `ielts_overall`, `toefl`, `duolingo`, `standardized_tests` | Institution/first-year undergraduate; no programme ID |
| Cornell | [MPS AEM tuition and financing](https://business.cornell.edu/admissions/graduate/mps-aem/tuition-financing/) | `tuition`, `additional_fees`, `scholarships` | Programme; exact frozen AEM programme ID; academic-year wording, dollar symbol |
| Cornell | [MPS AEM admissions](https://business.cornell.edu/admissions/graduate/mps-aem/) | `programme_identity`, `credential`, `intakes`, `priority_deadline`, `final_deadline`, `application_fee`, `minimum_degree`, `minimum_gpa` (no minimum policy), `duolingo`, `required_documents` | Programme; exact frozen AEM programme ID |
| Cornell | [graduate stipend rates](https://gradschool.cornell.edu/financial-support/stipend-rates/) | `scholarships` | Institution/graduate, 2026–27, 9/12-month rates |
| ETH Zurich | [Data Science application](https://ethz.ch/en/studies/master/application/master-datascience.html) | `programme_identity`, `minimum_degree`, `required_documents`, `academic_transcript` | Programme; exact frozen Data Science ID |
| ETH Zurich | [Robotics, Systems and Control application](https://ethz.ch/en/studies/master/application/master-robotics.html) | `programme_identity`, `minimum_degree`, `required_documents`, `standardized_tests` (GRE condition) | Programme; exact frozen Robotics ID |
| ETH Zurich | [Excellence Scholarship](https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html) | `scholarships` | Institution/master, HS27/2027–28, CHF 13,500 per semester plus tuition waiver |
| Sorbonne | [Master Informatique](https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique) | `programme_identity`, `minimum_degree`, `required_documents`, `intakes` | Programme; exact frozen Master Informatique ID; page updated 2026 |
| UNSW | [Master of Data Science and Decisions](https://www.unsw.edu.au/study/postgraduate/master-of-data-science-and-decisions) | `programme_identity`, `credential`, `academic_cycle`, `intakes`, `tuition`, `additional_fees`, `minimum_degree`, `minimum_gpa`, `ielts_overall`, `toefl`, `duolingo` | Programme candidate; program code 8959/CRICOS 0101866; target mapping retained as a deterministic check |
| UNSW | [international scholarships 2026](https://www.scholarships.unsw.edu.au/scholarships/id/1895) | `scholarships` | Institution/award, 2026, international eligibility |
| UNSW | [International Student Award](https://www.scholarships.unsw.edu.au/international-student-award) | `scholarships` | Institution/award, 2026/27, 20% tuition contribution |
| NTU | [Master of Science in Data Science](https://www.ntu.edu.sg/computing/admissions/graduate-programmes/detail/master-of-science-in-data-science-%28msds%29) | `programme_identity`, `credential`, `tuition`, `additional_fees`, `application_fee`, `minimum_degree`, `ielts_overall`, `toefl`, `required_documents`, `scholarships` | Programme; exact frozen MSDS ID; S$ explicitly stated; AY2027/28 fee table and AY2025/26 funding notes |

## Existing sources retained without duplication

MIT graduate cost, ETH tuition, Sorbonne registration fees, UNSW international
fees, and NTU undergraduate tuition were already verified and configured in the
prior frozen refresh. They remain in the copied configuration; their URLs were
not duplicated.

## Rejected or deferred

* MIT graduate price FAQ: explains that programme prices vary and contains no
  tuition value.
* ETH minimum-grade table: the rendered values cannot be mapped safely to a
  country/scale row.
* ETH Data Science appendix PDF: applies to an older Autumn 2020+ document and
  is not a current-cycle fee source.
* Sorbonne English page: dated 2024 and duplicates context without a current
  numeric threshold.
* NTU research-fee PDF: research-degree tariff, incompatible with the frozen
  coursework MSDS target.
* Generic Cornell graduate policy pages: no target-specific values.

## Explicit gaps

No verified current programme-level numeric GPA source was found for MIT, ETH
Zurich, Sorbonne or NTU. No independent compatible sibling-programme tuition or
programme-level H4 tuition source was verified for any of the six institutions.
Programme-specific mandatory fees remain unavailable for most targets; broader
institution/COA fee context is retained at its stated scope.

The machine-readable ledger and copied refresh configuration are in this
directory. New resources are ordinary bounded official-web/finance/admissions
entries with explicit resolution and frozen programme IDs only where the source
identity supports the match.
