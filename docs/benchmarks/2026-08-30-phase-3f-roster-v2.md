# Phase 3F benchmark roster v2 — composition freeze

Status: **FROZEN FOR COMPOSITION / CRITICAL TRUTH NOT YET REVIEWED**  
Frozen: 2026-08-30  
Population: **36 programmes / 12 institutions / 3 programmes per institution**  
Purpose: replace the compositionally weak v1 roster before independent
critical-field review and scoring.

This is a benchmark manifest, not a benchmark result. `SOURCE_IDENTITY_VERIFIED`
means the programme locator and the listed supporting source classes resolve to
an official or explicitly related source identity. It does not mean that the
field-level value has been reviewed. Every row remains
`CRITICAL_TRUTH_UNREVIEWED` until the independent reference set records a
reviewed source, locator, cycle, audience, expected state/value, and reviewer.

## Frozen manifest

Tag abbreviations:

| Tag | Meaning |
|---|---|
| `PDF` | a critical source is a PDF or a PDF is materially required for the review |
| `ML` | authoritative non-English or multilingual source hierarchy is material |
| `SA` | separate admissions source is required |
| `SF` | separate finance/fees source is required |
| `RP` | explicit partner, related-party, or multi-institution source relationship |
| `HC` | historical or academic-cycle change is material |
| `IE` | identity edge case (credential, rename, joint, translated, or same-title comparison) |
| `CF` | materially competing scope, cycle, authority, or version is available for conflict testing |
| `ADV` | adversarial behavior is expected (403, JS, fragmentation, stale/current ambiguity, PDF, or similar) |
| `CAT` | structured catalogue/provider source is part of the evidence set |

| # | Institution / country | Programme / credential | Official primary source | Required secondary sources | Cycle / audience | Difficulty | Stress tags | Source status | Review status |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | MIT / US | Artificial Intelligence and Decision Making / SB | [MIT Course 6-4 chart](https://catalog.mit.edu/degree-charts/artifical-intelligence-decision-making-course-6-4/) | `MIT-A`, `MIT-F` | 2026-27 / domestic + international | EASY | `CAT SA SF HC IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 2 | MIT / US | Computational Science and Engineering / SM | [MIT CSE SM chart](https://catalog.mit.edu/degree-charts/master-computational-science-engineering/) | `MIT-G`, `MIT-F`, `MIT-CSE-PDF` | 2026-27 / graduate international | MODERATE | `CAT PDF SA SF HC CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 3 | MIT / US | Chemical Engineering / SB | [MIT Course 10 chart](https://catalog.mit.edu/degree-charts/chemical-engineering-course-10/) | `MIT-A`, `MIT-F`, `MIT-CHEM-PDF` | 2026-27 / domestic + international | MODERATE | `CAT PDF SA SF ADV CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 4 | Harvard / US | Computer Science / AB | [Harvard College CS concentration](https://handbook.college.harvard.edu/programs/computer-science) | `HAR-A`, `HAR-F`, `HAR-PDF` | 2026-27 / undergraduate international | MODERATE | `CAT PDF SA SF HC IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 5 | Harvard / US | Data Science / SM | [Harvard GSAS Data Science](https://gsas.harvard.edu/program/data-science) | `HAR-G`, `HAR-F`, `HAR-PDF` | 2026-27 / graduate international | HARD | `CAT SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 6 | Harvard / US | Electrical Engineering / AB | [Harvard Fields of Concentration PDF](https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf) | `HAR-A`, `HAR-F`, `HAR-PDF` | 2026-27 / undergraduate international | HARD | `CAT PDF SA SF HC ADV CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 7 | Princeton / US | Astrophysical Sciences / AB | [Princeton Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences) | `PR-A`, `PR-F` | 2026-27 / undergraduate international | MODERATE | `CAT SA SF HC IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 8 | Princeton / US | Computer Science / MSE | [Princeton Computer Science field](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science) | `PR-G`, `PR-F`, `PR-PDF` | 2026-27 / graduate international | ADVERSARIAL | `CAT PDF SA SF HC IE ADV` | `SOURCE_IDENTITY_VERIFIED; prior v1 primary locator returned 403` | `CRITICAL_TRUTH_UNREVIEWED` |
| 9 | Princeton / US | Chemical and Biological Engineering / BSE | [Princeton CBE field](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering) | `PR-A`, `PR-G`, `PR-F` | 2026-27 / domestic + international | HARD | `CAT SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED; prior v1 primary locator returned 403` | `CRITICAL_TRUTH_UNREVIEWED` |
| 10 | Duke / US | Accelerated Daytime MBA / MBA | [Duke Fuqua Accelerated Daytime MBA](https://www.fuqua.duke.edu/programs/accelerated-daytime-mba) | `DUKE-G`, `DUKE-F` | 2026-27 / graduate international | HARD | `SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 11 | Duke / US | AI + Materials / MEng | [Duke AI + Materials MEng](https://mems.duke.edu/academics/masters/meng-ai-materials/) | `DUKE-G`, `DUKE-F` | 2026-27 / graduate international | HARD | `SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 12 | Duke / US | Biomedical Engineering / MEng | [Duke BME MEng](https://bme.duke.edu/academics/masters/meng-bme/) | `DUKE-G`, `DUKE-F` | 2026-27 / graduate international | MODERATE | `SA SF HC CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 13 | Northwestern / US | Liberal Arts and Music / BA-BMus | [Northwestern dual bachelor's](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/liberal-arts-music/) | `NW-A`, `NW-F`, `NW-MUSIC` | 2026-27 / undergraduate international | HARD | `CAT SA SF RP HC IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 14 | Northwestern / US | Information Systems — Data Science / MS | [Northwestern SPS MS Data Science](https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/) | `NW-A`, `NW-F` | 2026-27 / graduate international | ADVERSARIAL | `CAT SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 15 | Northwestern / US | Communication and Music / BA-BMus-BS | [Northwestern Communication and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/) | `NW-A`, `NW-F`, `NW-MUSIC` | 2026-27 / undergraduate international | HARD | `CAT SA SF RP IE ADV CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 16 | Cornell / US | Applied Economics and Management / MPS | [Cornell AEM MPS](https://catalog.cornell.edu/programs/applied-economics-management-mps/) | `CORN-G`, `CORN-F`, `CORN-PARTNER` | 2026-27 / graduate international | MODERATE | `CAT SA SF HC RP CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 17 | Cornell / US | Computer Science / BS | [Cornell Computer Science BS](https://catalog.cornell.edu/programs/computer-science-bs/) | `CORN-A`, `CORN-F` | 2026-27 / undergraduate international | MODERATE | `CAT SA SF IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 18 | Cornell / US | Information Science / BS | [Cornell Information Science BS](https://catalog.cornell.edu/programs/information-science-bs/) | `CORN-A`, `CORN-F`, `CORN-PDF` | 2026-27 / undergraduate international | HARD | `CAT PDF SA SF HC ADV CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 19 | UCLA / US | Public Affairs / BA | [UCLA Public Affairs](https://luskin.ucla.edu/undergraduate-program/academic-programs/public-affairs-major-curriculum/) | `UCLA-A`, `UCLA-F-ES`, `UCLA-F` | 2025-26 / undergraduate international | ADVERSARIAL | `SA SF ML HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 20 | UCLA / US | Biostatistics / MPH | [UCLA Biostatistics MPH](https://grad.ucla.edu/programs/school-of-public-health/biostatistics-department/biostatistics-mph/) | `UCLA-G`, `UCLA-F` | 2026-27 / graduate international | HARD | `SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 21 | UCLA / US | Computer Science / MS | [UCLA Computer Science graduate admissions](https://www.cs.ucla.edu/graduate-admissions/) | `UCLA-G`, `UCLA-F` | 2026-27 / graduate international | HARD | `SA SF HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 22 | Université de Montréal / Canada | Baccalauréat en informatique / BSc | [UdeM informatique bachelor](https://admission.umontreal.ca/programmes/baccalaureat-en-informatique/) | `UDEM-A`, `UDEM-REG`, `UDEM-F` | 2026-27 / French + international | HARD | `ML SA SF HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 23 | Université de Montréal / Canada | Maîtrise en informatique / MSc | [UdeM informatique master](https://admission.umontreal.ca/programmes/maitrise-en-informatique/admission-and-regulations/) | `UDEM-A`, `UDEM-REG`, `UDEM-F` | 2026-27 / French + international | HARD | `ML SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 24 | Université de Montréal / Canada | DESS en apprentissage automatique / DESS | [UdeM machine learning DESS](https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/) | `UDEM-A`, `UDEM-REG`, `UDEM-F`, `UDEM-PARTNER` | 2026-27 / French + international | ADVERSARIAL | `ML SA SF RP HC IE ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 25 | University of Tokyo / Japan | Computer Science, IIS / master | [Tokyo IIS CS admissions](https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml) | `TOK-A-EN`, `TOK-A-JA-PDF`, `TOK-F` | 2026-27 / Japanese + international | ADVERSARIAL | `ML PDF SA SF HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 26 | University of Tokyo / Japan | Information and Communication Engineering / master | [Tokyo ICE admissions](https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml) | `TOK-A-EN`, `TOK-A-JA-PDF`, `TOK-F` | 2027 / Japanese + international | ADVERSARIAL | `ML PDF SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 27 | University of Tokyo / Japan | ITASIA / MAS-PhD | [Tokyo ITASIA admissions](https://itasia.iii.u-tokyo.ac.jp/admissions-soon) | `TOK-A-EN`, `TOK-A-JA-PDF`, `TOK-F`, `TOK-PARTNER` | 2026 / international | ADVERSARIAL | `ML PDF SA SF RP HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 28 | ETH Zurich / Switzerland | Data Science / MSc | [ETH Data Science](https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/data-science.html) | `ETH-A`, `ETH-F`, `ETH-REG-PDF` | 2026-27 / international | HARD | `PDF SA SF HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 29 | ETH Zurich / Switzerland | Cyber Security / MSc | [ETH Cyber Security](https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.html) | `ETH-A`, `ETH-F`, `ETH-REG-PDF`, `ETH-EPFL` | 2026-27 / international | ADVERSARIAL | `PDF SA SF RP HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 30 | ETH Zurich / Switzerland | Robotics, Systems and Control / MSc | [ETH Robotics, Systems and Control](https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/robotics-systems-and-control.html) | `ETH-A`, `ETH-F`, `ETH-REG-PDF`, `ETH-PARTNER` | 2026-27 / international | HARD | `PDF SA SF RP HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 31 | Sorbonne Université / France | Licence d’informatique, parcours monodisciplinaire / Licence | [Sorbonne informatique licence](https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/) | `SU-A`, `SU-F`, `SU-COST` | 2026-27 / French + international | ADVERSARIAL | `ML SA SF HC IE CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 32 | Sorbonne Université / France | Master Informatique, MIND / Master | [Sorbonne Master Informatique](https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique) | `SU-A`, `SU-F`, `SU-COST`, `SU-ARRETE-PDF`, `SU-PARTNER` | 2026-27 / French + international | HARD | `ML PDF SA SF RP HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 33 | Sorbonne Université / France | Master Informatique, SAR / Master | [Sorbonne SAR pathway](https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar) | `SU-A`, `SU-F`, `SU-COST`, `SU-ARRETE-PDF` | 2026-27 / French + international | HARD | `ML PDF SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 34 | University of Michigan / US | Master of Applied Data Science / MADS | [Michigan MADS](https://mads.si.umich.edu/) | `UM-G`, `UM-F` | 2026-27 / graduate international | HARD | `SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 35 | University of Michigan / US | Aerospace Engineering / BS | [Michigan Aerospace](https://aero.engin.umich.edu/) | `UM-A`, `UM-F` | 2026-27 / undergraduate international | MODERATE | `CAT SA SF HC IE CF` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |
| 36 | University of Michigan / US | Applied Economics / MAE | [Michigan Applied Economics](https://lsa.umich.edu/econ/mae.html) | `UM-G`, `UM-F` | 2026-27 / graduate international | HARD | `CAT SA SF HC CF ADV` | `SOURCE_IDENTITY_VERIFIED` | `CRITICAL_TRUTH_UNREVIEWED` |

## Supporting-source register

The source codes above are part of the frozen manifest. They identify the
source role and the official/related locator to be independently reviewed;
they are not assertions of the expected field value.

| Code | Source role | Locator |
|---|---|---|
| `MIT-A` | central undergraduate admissions | https://admissions.mit.edu/ |
| `MIT-G` | CSE/graduate programme context | https://catalog.mit.edu/interdisciplinary/graduate-programs/computational-science-engineering/ |
| `MIT-F` | central student financial services | https://sfs.mit.edu/ |
| `MIT-CSE-PDF` | CSE degree chart PDF | https://catalog.mit.edu/degree-charts/master-computational-science-engineering/master-computational-science-engineering.pdf |
| `MIT-CHEM-PDF` | Chemical Engineering degree chart PDF | https://catalog.mit.edu/degree-charts/chemical-engineering-course-10/chemical-engineering-course-10.pdf |
| `HAR-A` | Harvard College admissions | https://college.harvard.edu/admissions |
| `HAR-G` | Harvard Griffin GSAS admissions | https://gsas.harvard.edu/admissions |
| `HAR-F` | Harvard financial aid | https://college.harvard.edu/financial-aid |
| `HAR-PDF` | annual fields/concentration evidence | https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf |
| `PR-A` | Princeton undergraduate admissions | https://admission.princeton.edu/ |
| `PR-G` | Princeton graduate admissions | https://gradschool.princeton.edu/admissions |
| `PR-F` | Princeton financial aid | https://finaid.princeton.edu/ |
| `PR-PDF` | Princeton graduate application requirements | https://gradschool.princeton.edu/admissions/applying-princeton |
| `DUKE-G` | Duke graduate admissions | https://gradschool.duke.edu/admissions/ |
| `DUKE-F` | Duke financial aid / programme cost | https://financialaid.duke.edu/ |
| `NW-A` | Northwestern admissions | https://admissions.northwestern.edu/ |
| `NW-F` | Northwestern student financial services | https://www.northwestern.edu/sfs/ |
| `NW-MUSIC` | Bienen admissions | https://www.bienen.northwestern.edu/admissions/ |
| `CORN-A` | Cornell admissions | https://admissions.cornell.edu/ |
| `CORN-G` | Cornell graduate admissions | https://gradschool.cornell.edu/admissions/ |
| `CORN-F` | Cornell financial aid | https://finaid.cornell.edu/ |
| `CORN-PDF` | Cornell admissions/requirements PDF family | https://catalog.cornell.edu/general-information/admissions/admissions.pdf |
| `CORN-PARTNER` | Cornell AEM/CEMS exchange relationship | https://catalog.cornell.edu/programs/applied-economics-management-mps/ |
| `UCLA-A` | UCLA undergraduate admissions | https://admission.ucla.edu/ |
| `UCLA-G` | UCLA graduate admissions | https://grad.ucla.edu/admissions/ |
| `UCLA-F` | UCLA fees | https://www.registrar.ucla.edu/Registration-Classes/Fees-Residence/Fees |
| `UCLA-F-ES` | Spanish financial aid source | https://admission.ucla.edu/es/tuition-aid/financial-aid-and-scholarships |
| `UDEM-A` | UdeM admissions | https://admission.umontreal.ca/ |
| `UDEM-REG` | UdeM tuition/registration | https://registraire.umontreal.ca/droits-de-scolarite/ |
| `UDEM-F` | UdeM programme finance/context | https://admission.umontreal.ca/programmes/ |
| `UDEM-PARTNER` | UdeM/MILA relationship evidence | https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/ |
| `TOK-A-EN` | Tokyo English admissions | https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml |
| `TOK-A-JA-PDF` | Tokyo Japanese/translated admission guide | https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2026_ja_2025-2-28.pdf |
| `TOK-F` | University of Tokyo tuition | https://www.u-tokyo.ac.jp/en/current-students/tuition.html |
| `TOK-PARTNER` | ITASIA programme/partner context | https://itasia.iii.u-tokyo.ac.jp/ |
| `ETH-A` | ETH master admissions | https://ethz.ch/en/studies/master/application.html |
| `ETH-F` | ETH fees/financial information | https://ethz.ch/en/studies/financial.html |
| `ETH-REG-PDF` | ETH requirement/regulation PDF family | https://ethz.ch/en/studies/master/application/profile-requirements.html |
| `ETH-EPFL` | ETH/EPFL Cyber Security relationship | https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.html |
| `ETH-PARTNER` | Robotics interdisciplinary/partner context | https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/robotics-systems-and-control.html |
| `SU-A` | Sorbonne admissions | https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes |
| `SU-F` | Sorbonne costs/fees | https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes |
| `SU-COST` | Sorbonne annual cost evidence | https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes |
| `SU-ARRETE-PDF` | Sorbonne 2026 admission decisions/PDFs | https://sciences.sorbonne-universite.fr/formation-sciences/candidatures-et-inscriptions/arretes |
| `SU-PARTNER` | Sorbonne partner/international programme context | https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique |
| `UM-A` | Michigan undergraduate admissions | https://admissions.umich.edu/ |
| `UM-G` | Michigan Rackham/graduate admissions | https://rackham.umich.edu/admissions/ |
| `UM-F` | Michigan financial aid/fees | https://finaid.umich.edu/ |

## Evidence-backed tag rationale

The following rationale is the minimum evidence required to retain a tag. The
benchmark reviewer must record the concrete source locator/evidence excerpt
when the critical truth set is built; a source role alone is not enough to
declare a field correct.

| Tag | Rows | Concrete reason retained in v2 |
|---|---|---|
| `PDF` | 2,3,4,6,8,18,25-30,32-33 | MIT, Harvard, Cornell, Tokyo, ETH, and Sorbonne rows have identified official PDF charts/guides/regulations that carry requirements, cycle, or admissions evidence. |
| `ML` | 19,22-27,31-33 | UCLA row 19 has an identified Spanish financial-aid source; UdeM and Sorbonne programme/admissions pages are French; Tokyo has Japanese and English guides/pages. |
| `SA` | 1-36 | Each row has a distinct central, graduate-school, faculty, or programme admissions locator in the source register; the review must verify applicability rather than infer it from the programme URL. |
| `SF` | 1-36 | Each row has a distinct fees/financial-aid locator, with separate undergraduate/graduate/registrar sources where applicable. |
| `RP` | 13,15,16,24,27,29,30,32 | Northwestern dual-school programmes, Cornell AEM/CEMS, UdeM/MILA, Tokyo ITASIA, ETH/EPFL or interdisciplinary partners, and Sorbonne partner institutions provide explicit relationship evidence outside a single programme page. |
| `HC` | 1,2,4,5,7,8,10,13,14,19,22-36 | Current programme pages are paired with annual catalogues, 2025/26 or 2026/27 fee/admission materials, Japanese 2026/27 guides, or 2026 Sorbonne decisions; prior-cycle material must remain historical during review. |
| `IE` | 1,4,7,8,13,15,17,21-25,27-29,31,35 | Same-title/different-credential comparisons, URL/version changes, translated titles, dual/joint programmes, and cross-institution computer-science identities are intentionally represented. |
| `CF` | 1,3-5,7,9-10,11-18,19-23,25,27-29,31-33,35-36 | Each retained row has at least two materially different scope, authority, cycle, audience, or version candidates worth checking; the review must establish whether a real conflict exists. |
| `ADV` | 3,5,6,8-11,14-15,18-27,28-34,36 | The set includes prior 403 Princeton locators, JS/catalogue pages, PDF/translated guides, fragmented admissions/finance, partner sources, cycle ambiguity, and separate-domain recovery. |
| `CAT` | 1-9,13-18,35-36 | MIT, Harvard, Princeton, Northwestern, Cornell, and Michigan catalogue/handbook records are structured sources, not merely guessed URL slugs. |

## Composition gate result

| Requirement | Target | v2 count | Result |
|---|---:|---:|---|
| Institutions | 12 | 12 | PASS |
| Programmes | 36 | 36 | PASS |
| Programmes per institution | 3 | 3 each | PASS |
| PDF-heavy | >=8 | 14 | PASS |
| Multilingual | >=8 | 10 | PASS |
| Separate admissions | >=8 | 36 | PASS |
| Separate finance | >=6 | 36 | PASS |
| Related-party | >=6 | 8 | PASS |
| Historical/cycle-change | >=6 | 25 | PASS |
| Identity edge case | >=6 | 16 | PASS |
| Conflict-capable | >=6 | 34 | PASS |
| Adversarial | >=6 | 27 | PASS |
| Structured/catalogue | >=8 | 17 | PASS |

## Primary-locator transport observations

These are fetch controls, not field truth and not source-identity criteria.
The 2026-08-30 redirected GET recheck, using a bounded benchmark user agent,
returned:

| Observation | Rows |
|---|---|
| 2xx response | 1-3, 5, 9-25, 27-36 (31 rows) |
| HTTP 403 / protected | 4, 6-8 (4 rows) |
| Timeout | 26 (1 row) |

Rows 4, 6-8 and 26 remain valid benchmark inputs because protected or
transiently unavailable sources exercise explicit acquisition/recovery
semantics. They must not be scored as `NOT_PUBLISHED` merely because the
transport failed.

The composition gate is closed for v2. Source identity verification is
complete from the official source register and source discovery; a transport
recheck of the primary locators observed 31 successful 2xx responses, four
protected 403 responses, and one timeout. The protected/timeout cases remain
valid adversarial source identities and are runtime behavior to benchmark, not
reference truth. The critical-field review gate is still open: **0 scored
reviewed critical-field cases**. The two prior v1 Princeton 403 observations
are retained as adversarial cases; expected behavior is primary-source
`ACCESS_BLOCKED` or bounded fallback through the listed graduate/admissions,
PDF, finance, or related source class, never `NOT_PUBLISHED` by failure alone.

## Review protocol after composition freeze

Build a separate field-level reference set. For each applicable row review
programme identity, credential, status, tuition, deadline/intake,
English-language requirement, major admissions requirements, and funding where
applicable. Record expected semantic state/value, scope, audience, academic
cycle, source identity, locator, authority, review note, and one of
`UNREVIEWED`, `REVIEWED_CONFIRMED`, `REVIEWED_AMBIGUOUS`, or
`NOT_APPLICABLE`. Only `REVIEWED_CONFIRMED` and `NOT_APPLICABLE` are scoreable.

No v3 scorer, precision/recall claim, PRODUCT_SAFE benchmark claim, or final
OpenCode gate may use this manifest as ground truth before that reference set
is independently frozen.
