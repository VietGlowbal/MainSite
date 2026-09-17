# Phase 3F Human Review Packet - Batch 6

Status: COMPLETE - human decisions applied  
Batch: 6 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycle: 2026-27  
Prepared: 2026-08-31  

Human review result: 21 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.
The structured ground-truth JSONL records the corresponding review status and
decision for each case; confirmed unresolved proposals retain their original
`NEEDS_REVIEW` state and null value.

This packet covers the next three programmes in the frozen v2 roster: Cornell rows 16-18. It contains independently collected official source evidence and proposed benchmark records only. It does not contain v3 pipeline output. Human confirmation accepts the complete proposed record; it does not force the proposed state to FOUND.

For every case, choose exactly one:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

Do not treat lack of response as confirmation. Preserve `review_status` and `expected_state` as separate axes. The 21 Batch 6 decisions are recorded below; confirmed unresolved proposals retain their original `NEEDS_REVIEW` state and null value.

## Recorded human decisions

All 21 Batch 6 cases were independently confirmed:

| Programme | Cases | Decision |
|---|---:|---|
| Applied Economics and Management / MPS | 7 | CONFIRM |
| Computer Science / BS | 7 | CONFIRM |
| Information Science / BS | 7 | CONFIRM |

## Programme 16 - Applied Economics and Management / MPS

Institution: Cornell University  
Programme: Applied Economics and Management  
Credential: MPS  
Target cycle: 2026-27  
Audience/scope: graduate international; programme-specific unless independent review establishes a narrower/broader applicable scope

### GT-V2-16-programme_identity

- Field: programme_identity
- Proposed expected state: FOUND
- Proposed value: Cornell University Master of Professional Studies in Applied Economics and Management
- Source identity: Cornell University Academic Catalog - Applied Economics and Management (MPS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/applied-economics-management-mps/)
- Evidence summary: The proposed source-backed record states: Cornell University Master of Professional Studies in Applied Economics and Management.
- Evidence locator: Catalogue heading and programme description identify the Master of Professional Studies in Applied Economics and Management and its applied-economics/management curriculum.
- Programme applicability: The source explicitly names the target programme and credential/pathway; competing college, degree, or related-programme variants are listed below.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027; programme page includes Fall 2026 calendar.; published at not stated.
- Known competing evidence: The CEMS Master in International Management is an additional relationship/pathway, not a second AEM MPS identity.
- Risk warning: IDENTITY/RELATIONSHIP RISK - keep AEM MPS separate from the optional CEMS MIM pathway.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-credential

- Field: credential
- Proposed expected state: FOUND
- Proposed value: MPS / Master of Professional Studies in Applied Economics and Management
- Source identity: Cornell University Academic Catalog - Applied Economics and Management (MPS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/applied-economics-management-mps/)
- Evidence summary: The proposed source-backed record states: MPS / Master of Professional Studies in Applied Economics and Management.
- Evidence locator: Catalogue heading identifies Applied Economics and Management (MPS); programme description states 30 credit hours and a capstone project.
- Programme applicability: The source scope is the named credential; adjacent degree or pathway alternatives are not silently substituted.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027; programme page includes Fall 2026 calendar.; published at not stated.
- Known competing evidence: CEMS MIM is an additional qualification/pathway and must not replace the MPS credential.
- Risk warning: CREDENTIAL RISK - do not collapse MPS and CEMS MIM into one credential.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-programme_status

- Field: programme_status
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell University Academic Catalog - Applied Economics and Management (MPS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/applied-economics-management-mps/)
- Evidence summary: Current catalogue listing and programme description are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Current catalogue listing and programme description are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Programme applicability: The current catalogue or programme listing is evidence of a listing context, not formal lifecycle ACTIVE evidence.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027; programme page includes Fall 2026 calendar. Lifecycle effective date not stated.; published at not stated.
- Known competing evidence: Catalogue presence supports current listing context but is not formal ACTIVE lifecycle evidence.
- Risk warning: STATUS RISK - do not infer ACTIVE solely from catalogue presence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-tuition

- Field: tuition
- Proposed expected state: FOUND
- Proposed value: USD 36,973 per semester / USD 73,946 per year for MPS in Applied Economics and Management, 2026-27; fees are separate
- Source identity: Cornell University Bursar 2026-27 Tuition Rates and Fees
- Source authority: Cornell University official Office of the Bursar
- Source URL: [official source](https://bursar.cornell.edu/students-parents/tuition-rates-and-fees)
- Evidence summary: The proposed source-backed record states: USD 36,973 per semester / USD 73,946 per year for MPS in Applied Economics and Management, 2026-27; fees are separate.
- Evidence locator: Professional and Select Master's Degrees table, Tier 1 row: MPS (AEM) is listed at USD 36,973 per semester and USD 73,946 per year.
- Programme applicability: The cited Bursar schedule is matched to the target degree/college scope and represents billed tuition only; fees, insurance, living costs, funding, and scholarships remain separate.
- Temporal applicability: target cycle 2026-27; source cycle/context 2026-27 Cornell tuition-rate schedule.; published at not stated.
- Known competing evidence: Application fees, student activity fees, health insurance, living costs, and CEMS-specific expenses are separate from billed tuition.
- Risk warning: FINANCE SCOPE RISK - keep the MPS rate separate from fees, cost of attendance, funding, and CEMS costs.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-application_deadline

- Field: application_deadline
- Proposed expected state: FOUND
- Proposed value: Fall MPS-AEM application rounds: December 1, January 18, March 1, and April 15; no spring admissions
- Source identity: Cornell University Academic Catalog - Applied Economics and Management (MPS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/applied-economics-management-mps/)
- Evidence summary: The proposed source-backed record states: Fall MPS-AEM application rounds: December 1, January 18, March 1, and April 15; no spring admissions.
- Evidence locator: Admissions > Application Requirements and Deadlines: Fall - MPS-AEM lists four rounds and Spring states no spring admissions.
- Programme applicability: The cited admissions schedule is relevant to the target applicant pathway; dates and entry-cycle applicability are preserved exactly where the source makes them explicit.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027; programme page includes Fall 2026 calendar.; published at not stated.
- Known competing evidence: The same page lists separate CEMS MPS rounds (December 1, January 18, February 1); CEMS is a related pathway and not silently substituted for the ordinary AEM schedule.
- Risk warning: CYCLE/PATHWAY RISK - preserve ordinary MPS-AEM versus CEMS deadlines and the no-spring-admissions rule.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-english_requirement

- Field: english_requirement
- Proposed expected state: FOUND
- Proposed value: Cornell Graduate School English-language policy for professional master's applicants: IELTS Academic overall band at least 7.0 or the stated TOEFL section thresholds, subject to standing or special exemptions.
- Source identity: Cornell Graduate School English Language Proficiency Requirement
- Source authority: Cornell University official Graduate School
- Source URL: [official source](https://gradschool.cornell.edu/admissions/application-steps/required-tests/english-language-proficiency-requirement-2/)
- Evidence summary: The proposed source-backed record states: Cornell Graduate School English-language policy for professional master's applicants: IELTS Academic overall band at least 7.0 or the stated TOEFL section thresholds, subject to standing or special exemptions..
- Evidence locator: English Language Proficiency Requirement > Test Score Guidelines for Summer and Fall 2026 Admission > Professional Master's Degree Applicants, plus Standing Exemptions.
- Programme applicability: The cited policy applies to the stated applicant audience and preserves conditional tests, thresholds, exemptions, and programme/college scope.
- Temporal applicability: target cycle 2026-27; source cycle/context Target 2026-27; source explicitly states Summer/Fall 2026 thresholds and exemptions.; published at not stated.
- Known competing evidence: The AEM MPS is a professional master's programme; field-specific requirements or a later cycle change must not be assumed absent review.
- Risk warning: APPLICABILITY/TEMPORAL RISK - preserve test, threshold, exemption, and target-cycle context.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-16-major_admissions_requirement

- Field: major_admissions_requirement
- Proposed expected state: FOUND
- Proposed value: MPS-AEM application requires all Graduate School requirements including English proficiency, two recommendations, academic and personal statements, video interview, resume/CV, and GMAT/GRE score report or waiver; CEMS applicants have additional business-prerequisite criteria.
- Source identity: Cornell University Academic Catalog - Applied Economics and Management (MPS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/applied-economics-management-mps/)
- Evidence summary: The proposed source-backed record states: MPS-AEM application requires all Graduate School requirements including English proficiency, two recommendations, academic and personal statements, video interview, resume/CV, and GMAT/GRE score report or waiver; CEMS applicants have additional business-prerequisite criteria..
- Evidence locator: Admissions > Requirements Summary lists the MPS-AEM application components; CEMS MIM subsection lists additional business coursework criteria.
- Programme applicability: The cited admissions, affiliation, or programme material is kept within its stated scope; first-year gates, post-matriculation affiliation, preparation, and completion requirements are not collapsed.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027; programme page includes Fall 2026 calendar.; published at not stated.
- Known competing evidence: CEMS criteria apply only to the CEMS pathway. Recommended preparation and concentration coursework are not silently converted into mandatory admission gates for every AEM MPS applicant.
- Risk warning: ADMISSIONS SCOPE RISK - distinguish ordinary MPS-AEM requirements from CEMS-specific criteria and preparation.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 17 - Computer Science / BS

Institution: Cornell University  
Programme: Computer Science  
Credential: BS  
Target cycle: 2026-27  
Audience/scope: undergraduate international; programme-specific unless independent review establishes a narrower/broader applicable scope

### GT-V2-17-programme_identity

- Field: programme_identity
- Proposed expected state: FOUND
- Proposed value: Cornell University Computer Science BS through the Duffield College of Engineering
- Source identity: Cornell University Academic Catalog - Computer Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/computer-science-bs/)
- Evidence summary: The proposed source-backed record states: Cornell University Computer Science BS through the Duffield College of Engineering.
- Evidence locator: Catalogue heading identifies Computer Science (BS), Duffield College of Engineering; programme description identifies the Bowers/Engineering affiliation.
- Programme applicability: The source explicitly names the target programme and credential/pathway; competing college, degree, or related-programme variants are listed below.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027 programme context; explicit edition not stated in the reviewed excerpt.; published at not stated.
- Known competing evidence: The BA in Computer Science through Arts and Sciences is a separate degree-level/college identity.
- Risk warning: IDENTITY/COLLEGE RISK - keep the Engineering BS separate from the Arts and Sciences BA.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-credential

- Field: credential
- Proposed expected state: FOUND
- Proposed value: BS / Bachelor of Science in Computer Science
- Source identity: Cornell University Academic Catalog - Computer Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/computer-science-bs/)
- Evidence summary: The proposed source-backed record states: BS / Bachelor of Science in Computer Science.
- Evidence locator: Catalogue heading and programme information identify Computer Science (BS) with a minimum of 123 credits in the Duffield College of Engineering.
- Programme applicability: The source scope is the named credential; adjacent degree or pathway alternatives are not silently substituted.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027 programme context; explicit edition not stated in the reviewed excerpt.; published at not stated.
- Known competing evidence: The BA Computer Science path is a separate credential and college scope.
- Risk warning: CREDENTIAL SCOPE RISK - preserve BS, college, and degree-level identity.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-programme_status

- Field: programme_status
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell University Academic Catalog - Computer Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/computer-science-bs/)
- Evidence summary: Current catalogue programme page and programme requirements are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Current catalogue programme page and programme requirements are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Programme applicability: The current catalogue or programme listing is evidence of a listing context, not formal lifecycle ACTIVE evidence.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell catalogue programme context; lifecycle effective date not stated.; published at not stated.
- Known competing evidence: Catalogue curriculum/status context is not formal lifecycle evidence; any unrelated course availability note must not be treated as programme discontinuation.
- Risk warning: STATUS RISK - do not infer ACTIVE or DISCONTINUED from a curriculum page alone.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-tuition

- Field: tuition
- Proposed expected state: FOUND
- Proposed value: USD 73,946 per academic year for endowed Ithaca undergraduate tuition, 2026-27; fees and other costs are separate
- Source identity: Cornell University Bursar 2026-27 Undergraduate Tuition - Endowed Ithaca
- Source authority: Cornell University official Office of the Bursar
- Source URL: [official source](https://bursar.cornell.edu/students-parents/tuition-rates-and-fees)
- Evidence summary: The proposed source-backed record states: USD 73,946 per academic year for endowed Ithaca undergraduate tuition, 2026-27; fees and other costs are separate.
- Evidence locator: Undergraduate Tuition table, Endowed Ithaca row: Architecture, Arts and Sciences, Engineering, and Hotel Administration are listed at USD 73,946 per year.
- Programme applicability: The cited Bursar schedule is matched to the target degree/college scope and represents billed tuition only; fees, insurance, living costs, funding, and scholarships remain separate.
- Temporal applicability: target cycle 2026-27; source cycle/context 2026-27 Cornell undergraduate tuition schedule.; published at not stated.
- Known competing evidence: Student activity fees, health insurance, housing, meals, books, and other costs are not tuition.
- Risk warning: FINANCE SCOPE RISK - keep billed Engineering tuition separate from fees and cost of attendance.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-application_deadline

- Field: application_deadline
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell Undergraduate Admissions first-year application deadlines
- Source authority: Cornell University official Undergraduate Admissions
- Source URL: [official source](https://admissions.cornell.edu/how-to-apply/first-year-applicants)
- Evidence summary: First-Year Applicants > Choose Your Application Plan: Early Decision November 1 and Regular Decision January 2 are listed.
- Evidence locator: First-Year Applicants > Choose Your Application Plan: Early Decision November 1 and Regular Decision January 2 are listed.
- Programme applicability: The cited admissions schedule is relevant to the target applicant pathway; dates and entry-cycle applicability are preserved exactly where the source makes them explicit.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell first-year admissions schedule; exact date-year mapping to benchmark 2026-27 is not explicit in the reviewed excerpt.; published at not stated.
- Known competing evidence: Central first-year deadlines may apply, but the source excerpt does not independently establish the exact target-year convention for the benchmark or any college-specific supplement timing.
- Risk warning: TEMPORAL/APPLICABILITY RISK - preserve plan, year, college requirements, and exact target-cycle mapping.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-english_requirement

- Field: english_requirement
- Proposed expected state: FOUND
- Proposed value: International first-year applicants must demonstrate English-language proficiency and may be required to submit an approved English-proficiency exam score, subject to Cornell policy.
- Source identity: Cornell Undergraduate Admissions first-year applicants
- Source authority: Cornell University official Undergraduate Admissions
- Source URL: [official source](https://admissions.cornell.edu/how-to-apply/first-year-applicants)
- Evidence summary: The proposed source-backed record states: International first-year applicants must demonstrate English-language proficiency and may be required to submit an approved English-proficiency exam score, subject to Cornell policy..
- Evidence locator: First-Year Applicants > Required Application Materials > Standardized Test Scores: international applicants must demonstrate English language proficiency and may need approved exam scores.
- Programme applicability: The cited policy applies to the stated applicant audience and preserves conditional tests, thresholds, exemptions, and programme/college scope.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell first-year admissions schedule; exact date-year mapping to benchmark 2026-27 is not explicit in the reviewed excerpt.; published at not stated.
- Known competing evidence: This is a conditional university-level undergraduate policy; it is not a programme-specific score threshold and must not be applied to domestic applicants.
- Risk warning: APPLICABILITY RISK - preserve conditional international scope and any exemption/test-policy details.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-17-major_admissions_requirement

- Field: major_admissions_requirement
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell University Academic Catalog - Computer Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/computer-science-bs/)
- Evidence summary: Academic Standards > Major Declaration Information and the Computer Science BS affiliation packet describe post-matriculation major-affiliation criteria and engineering forms.
- Evidence locator: Academic Standards > Major Declaration Information and the Computer Science BS affiliation packet describe post-matriculation major-affiliation criteria and engineering forms.
- Programme applicability: The cited admissions, affiliation, or programme material is kept within its stated scope; first-year gates, post-matriculation affiliation, preparation, and completion requirements are not collapsed.
- Temporal applicability: target cycle 2026-27; source cycle/context Current catalogue/affiliation materials; exact target-cycle admission applicability unresolved.; published at not stated.
- Known competing evidence: Engineering college admission, later CS major affiliation, and degree completion requirements are different scopes; the affiliation criteria are not automatically first-year admission gates.
- Risk warning: ADMISSIONS SCOPE RISK - do not convert later affiliation requirements into first-year admission truth.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 18 - Information Science / BS

Institution: Cornell University  
Programme: Information Science  
Credential: BS  
Target cycle: 2026-27  
Audience/scope: undergraduate international; programme-specific unless independent review establishes a narrower/broader applicable scope

### GT-V2-18-programme_identity

- Field: programme_identity
- Proposed expected state: FOUND
- Proposed value: Cornell University Information Science BS through the College of Agriculture and Life Sciences (CALS)
- Source identity: Cornell University Academic Catalog - Information Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/information-science-bs/)
- Evidence summary: The proposed source-backed record states: Cornell University Information Science BS through the College of Agriculture and Life Sciences (CALS).
- Evidence locator: Catalogue heading identifies Information Science (BS), College of Agriculture and Life Sciences; eligibility section distinguishes CALS BS from the A&S BA.
- Programme applicability: The source explicitly names the target programme and credential/pathway; competing college, degree, or related-programme variants are listed below.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027 programme context; explicit edition not stated in the reviewed excerpt.; published at not stated.
- Known competing evidence: The A&S Information Science BA and Engineering ISST BS are separate college/credential identities.
- Risk warning: IDENTITY/COLLEGE RISK - preserve CALS BS separately from A&S BA and Engineering ISST.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-credential

- Field: credential
- Proposed expected state: FOUND
- Proposed value: BS / Bachelor of Science in Information Science through Cornell CALS
- Source identity: Cornell University Academic Catalog - Information Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/information-science-bs/)
- Evidence summary: The proposed source-backed record states: BS / Bachelor of Science in Information Science through Cornell CALS.
- Evidence locator: Who Is Eligible to Major in Information Science section states that Cornell CALS students earn a Bachelor of Science (BS).
- Programme applicability: The source scope is the named credential; adjacent degree or pathway alternatives are not silently substituted.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027 programme context; explicit edition not stated in the reviewed excerpt.; published at not stated.
- Known competing evidence: A&S students earn a BA in Information Science; that is not the frozen CALS BS credential.
- Risk warning: CREDENTIAL SCOPE RISK - preserve the CALS college and BS credential.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-programme_status

- Field: programme_status
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell University Academic Catalog - Information Science (BS)
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/information-science-bs/)
- Evidence summary: Current catalogue listing, programme description, and CALS requirements are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Current catalogue listing, programme description, and CALS requirements are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Programme applicability: The current catalogue or programme listing is evidence of a listing context, not formal lifecycle ACTIVE evidence.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell catalogue programme context; lifecycle effective date not stated.; published at not stated.
- Known competing evidence: Catalogue presence is not formal lifecycle evidence.
- Risk warning: STATUS RISK - do not infer ACTIVE solely from catalogue presence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-tuition

- Field: tuition
- Proposed expected state: FOUND
- Proposed value: USD 73,946 per academic year for nonresident CALS undergraduate tuition, 2026-27; fees and other costs are separate
- Source identity: Cornell University Bursar 2026-27 Undergraduate Tuition - Contract Nonresident CALS
- Source authority: Cornell University official Office of the Bursar
- Source URL: [official source](https://bursar.cornell.edu/students-parents/tuition-rates-and-fees)
- Evidence summary: The proposed source-backed record states: USD 73,946 per academic year for nonresident CALS undergraduate tuition, 2026-27; fees and other costs are separate.
- Evidence locator: Undergraduate Tuition table, Contract Nonresident row: CALS and related listed colleges are charged USD 73,946 per year in 2026-27.
- Programme applicability: The cited Bursar schedule is matched to the target degree/college scope and represents billed tuition only; fees, insurance, living costs, funding, and scholarships remain separate.
- Temporal applicability: target cycle 2026-27; source cycle/context 2026-27 Cornell undergraduate tuition schedule.; published at not stated.
- Known competing evidence: International status is not itself the tuition category; residency/college classification and student fees must remain explicit.
- Risk warning: FINANCE/APPLICABILITY RISK - distinguish CALS nonresident billed tuition from fees, residency rules, and cost of attendance.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-application_deadline

- Field: application_deadline
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell Undergraduate Admissions first-year application deadlines
- Source authority: Cornell University official Undergraduate Admissions
- Source URL: [official source](https://admissions.cornell.edu/how-to-apply/first-year-applicants)
- Evidence summary: First-Year Applicants > Choose Your Application Plan lists Early Decision November 1 and Regular Decision January 2.
- Evidence locator: First-Year Applicants > Choose Your Application Plan lists Early Decision November 1 and Regular Decision January 2.
- Programme applicability: The cited admissions schedule is relevant to the target applicant pathway; dates and entry-cycle applicability are preserved exactly where the source makes them explicit.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell first-year admissions schedule; exact date-year mapping to benchmark 2026-27 is not explicit in the reviewed excerpt.; published at not stated.
- Known competing evidence: Central dates may govern CALS applicants, but exact target-year mapping and any Information Science/CALS-specific supplement timing are not independently established in the proposed evidence.
- Risk warning: TEMPORAL/APPLICABILITY RISK - preserve plan, college, year, and programme pathway.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-english_requirement

- Field: english_requirement
- Proposed expected state: FOUND
- Proposed value: International first-year applicants must demonstrate English-language proficiency and may be required to submit an approved English-proficiency exam score, subject to Cornell policy.
- Source identity: Cornell Undergraduate Admissions first-year applicants
- Source authority: Cornell University official Undergraduate Admissions
- Source URL: [official source](https://admissions.cornell.edu/how-to-apply/first-year-applicants)
- Evidence summary: The proposed source-backed record states: International first-year applicants must demonstrate English-language proficiency and may be required to submit an approved English-proficiency exam score, subject to Cornell policy..
- Evidence locator: First-Year Applicants > Required Application Materials > Standardized Test Scores: international applicants must demonstrate English language proficiency and may need approved exam scores.
- Programme applicability: The cited policy applies to the stated applicant audience and preserves conditional tests, thresholds, exemptions, and programme/college scope.
- Temporal applicability: target cycle 2026-27; source cycle/context Current Cornell first-year admissions schedule; exact date-year mapping to benchmark 2026-27 is not explicit in the reviewed excerpt.; published at not stated.
- Known competing evidence: Conditional university-level undergraduate policy; not a universal requirement and not a programme-specific score threshold.
- Risk warning: APPLICABILITY RISK - preserve international scope and conditional policy.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-18-major_admissions_requirement

- Field: major_admissions_requirement
- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Cornell Information Science BS Academic Catalog / PDF
- Source authority: Cornell University official Academic Catalog
- Source URL: [official source](https://catalog.cornell.edu/programs/information-science-bs/information-science-bs.pdf)
- Evidence summary: Academic Standards > Affiliation states that current CALS students changing to IS or adding IS must meet affiliation criteria and apply after required coursework; this does not establish first-year admission gates.
- Evidence locator: Academic Standards > Affiliation states that current CALS students changing to IS or adding IS must meet affiliation criteria and apply after required coursework; this does not establish first-year admission gates.
- Programme applicability: The cited admissions, affiliation, or programme material is kept within its stated scope; first-year gates, post-matriculation affiliation, preparation, and completion requirements are not collapsed.
- Temporal applicability: target cycle 2026-27; source cycle/context Cornell Academic Catalog 2026-2027 context; later-affiliation applicability to first-year benchmark admission unresolved.; published at not stated.
- Known competing evidence: CALS college admission, later Information Science affiliation, and major graduation requirements are distinct. A&S BA and Engineering ISST pathways are separate.
- Risk warning: ADMISSIONS SCOPE RISK - do not infer NOT_REQUIRED or treat affiliation criteria as first-year admission.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE
