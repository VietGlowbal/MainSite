# Phase 3F Human Review Packet - Batch 5

Status: COMPLETE - human decisions applied  
Batch: 5 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycle: 2026-27  
Prepared: 2026-08-31

Human review result: 20 CONFIRM, 1 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.
The structured ground-truth JSONL records the corresponding review status and
decision for each case; confirmed unresolved proposals retain their original
`NEEDS_REVIEW` state and null value.

This packet covers the next three programmes in the frozen v2 roster:
Northwestern rows 13-15. It contains independently collected official source
evidence and proposed benchmark records only. It does not contain v3 pipeline
output. Human confirmation accepts the complete proposed record; it does not
force the proposed state to FOUND.

For every case, choose exactly one:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

Do not treat lack of response as confirmation. Preserve review_status and
expected_state as separate axes.

## Recorded human decisions

| Case | Decision |
|---|---|
| GT-V2-13-programme_identity | CONFIRM |
| GT-V2-13-credential | CONFIRM |
| GT-V2-13-programme_status | CONFIRM |
| GT-V2-13-tuition | CONFIRM |
| GT-V2-13-application_deadline | CONFIRM |
| GT-V2-13-english_requirement | CONFIRM |
| GT-V2-13-major_admissions_requirement | AMBIGUOUS |
| GT-V2-14-programme_identity | CONFIRM |
| GT-V2-14-credential | CONFIRM |
| GT-V2-14-programme_status | CONFIRM |
| GT-V2-14-tuition | CONFIRM |
| GT-V2-14-application_deadline | CONFIRM |
| GT-V2-14-english_requirement | CONFIRM |
| GT-V2-14-major_admissions_requirement | CONFIRM |
| GT-V2-15-programme_identity | CONFIRM |
| GT-V2-15-credential | CONFIRM |
| GT-V2-15-programme_status | CONFIRM |
| GT-V2-15-tuition | CONFIRM |
| GT-V2-15-application_deadline | CONFIRM |
| GT-V2-15-english_requirement | CONFIRM |
| GT-V2-15-major_admissions_requirement | CONFIRM |

## Programme 13 - Liberal Arts and Music / BA-BMus

Institution: Northwestern University  
Programme: Liberal Arts and Music  
Credential: BA-BMus  
Target cycle: 2026-27  
Audience/scope: undergraduate international; dual bachelor's programme spanning
Weinberg College of Arts and Sciences and Bienen School of Music

### GT-V2-13-programme_identity

- Proposed expected state: FOUND
- Proposed value: Northwestern University BA/BMus in Liberal Arts and Music
- Source identity: Northwestern University Academic Catalog - Liberal Arts and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Liberal Arts and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/liberal-arts-music/)
- Evidence: The catalogue heading and overview identify Liberal Arts and Music as a dual bachelor's programme spanning Weinberg College of Arts and Sciences and the Bienen School of Music.
- Evidence locator: Page heading and programme overview.
- Programme applicability: The page names the target dual-school programme.
- Temporal applicability: Current catalogue page; explicit catalogue edition is not stated in the reviewed excerpt, so target-cycle applicability requires review.
- Known competing evidence: Bienen is an academic partner within the dual programme, not a second independent programme identity.
- Risk warning: IDENTITY/PARTNER - preserve one dual-programme identity with both school roles.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-credential

- Proposed expected state: FOUND
- Proposed value: BA/BMus (Bachelor of Arts from Weinberg College + Bachelor of Music from Bienen School of Music)
- Source identity: Northwestern University Academic Catalog - Liberal Arts and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Liberal Arts and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/liberal-arts-music/)
- Evidence: The programme overview states that students complete the BA in Weinberg College and the BMus in Bienen School of Music.
- Evidence locator: Programme overview, degree components and participating schools.
- Programme applicability: Explicitly applies to the Liberal Arts and Music dual programme.
- Temporal applicability: Current catalogue page; explicit catalogue edition is not stated in the reviewed excerpt.
- Known competing evidence: This dual credential is distinct from a single BA, a single BMus, and other Bienen dual-degree combinations.
- Risk warning: CREDENTIAL SCOPE - retain both degree components and school ownership.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-programme_status

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog - Liberal Arts and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Liberal Arts and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/liberal-arts-music/)
- Evidence: A current catalogue listing and programme overview are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Current catalogue listing and programme overview.
- Programme applicability: The listing names the target programme, but lifecycle status is not separately stated.
- Temporal applicability: Current listing context; lifecycle effective date is not stated.
- Known competing evidence: Catalogue presence is not, by itself, formal ACTIVE lifecycle evidence.
- Risk warning: STATUS - do not upgrade current catalogue presence to ACTIVE without lifecycle evidence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-tuition

- Proposed expected state: FOUND
- Proposed value: USD 71,802 full-time undergraduate tuition for 2026-27; mandatory fees USD 1,260 are separate
- Source identity: Northwestern Undergraduate Financial Aid 2026-27 Cost of Attendance
- Source authority: Northwestern University official Undergraduate Financial Aid
- Source URL: [Undergraduate cost of attendance](https://undergradaid.northwestern.edu/aid-basics-eligibility/cost-of-attendance.html)
- Evidence: The 2026-27 full-time undergraduate table lists tuition of USD 71,802 and mandatory fees of USD 1,260; the standard academic year is fall/winter/spring.
- Evidence locator: 2026-27 full-time undergraduate cost-of-attendance table, Tuition and Fees rows.
- Programme applicability: Institution-wide full-time undergraduate billed tuition; the source does not state a special five-year dual-programme rate.
- Temporal applicability: Explicit 2026-27 undergraduate schedule.
- Known competing evidence: The dual programme normally spans five years, but the source does not establish a five-year total. Housing, meals, health insurance, and other cost-of-attendance items are separate.
- Risk warning: FINANCE SCOPE - keep billed tuition separate from fees, cost of attendance, aid, scholarships, and derived totals.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-application_deadline

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern Undergraduate Admissions application deadlines
- Source authority: Northwestern University official Undergraduate Admissions
- Source URL: [Application deadlines](https://admissions.northwestern.edu/apply/application-deadlines.html)
- Evidence: The first-year table lists Early Decision on November 1, 2026 and Regular Decision on January 4, 2027.
- Evidence locator: Application Deadlines page, First-Year Applicants table.
- Programme applicability: Central first-year dates may apply to applicants, but the exact dual-degree/music application path is not stated in the proposed excerpt.
- Temporal applicability: Target 2026-27; source cycle is the 2026-27 first-year admissions schedule. Entry-path mapping for the dual-degree/music application remains unresolved.
- Known competing evidence: Bienen audition/application requirements and transfer dates are separate pathways and may have separate dates.
- Risk warning: TEMPORAL/APPLICABILITY - preserve entry pathway and any music audition deadline; do not manufacture a programme-specific current deadline.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-english_requirement

- Proposed expected state: FOUND
- Proposed value: For international first-year applicants, an English-proficiency score is required when English is not the applicant's first/primary language or secondary schooling was not in English, subject to the stated policy.
- Source identity: Northwestern International Undergraduate Admissions
- Source authority: Northwestern University official International Undergraduate Admissions
- Source URL: [International applicants](https://admissions.northwestern.edu/apply/identities/international.html)
- Evidence: The international undergraduate English-proficiency section states that a score is required if the applicant's first/primary language is not English or secondary schooling was not in English.
- Evidence locator: International undergraduate admissions, English proficiency section.
- Programme applicability: Conditional policy for international undergraduate applicants; not a universal domestic or programme-independent requirement.
- Temporal applicability: Current international first-year policy; explicit cycle is not stated in the reviewed excerpt.
- Known competing evidence: Language-of-instruction conditions and stated exemptions may change the outcome for an individual applicant.
- Risk warning: APPLICABILITY - preserve the conditional policy and exemptions.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-13-major_admissions_requirement

- Proposed expected state: FOUND
- Proposed value: The dual programme requires acceptance by both Weinberg College and Bienen School of Music; students complete both schools' major/degree requirements, ordinarily over five years and at least 60 total units.
- Source identity: Northwestern University Academic Catalog - Liberal Arts and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Liberal Arts and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/liberal-arts-music/)
- Evidence: The overview states that students are accepted by both schools, complete both sets of major requirements, and normally complete at least 60 units over five years.
- Evidence locator: Dual-programme overview, participating schools and degree requirements.
- Programme applicability: Explicitly applies to the target dual programme.
- Temporal applicability: Current catalogue programme requirements; explicit edition is not stated in the reviewed excerpt.
- Known competing evidence: Both-school acceptance and completion requirements are distinct from general first-year university admission and post-admission completion.
- Risk warning: ADMISSIONS SCOPE - distinguish dual-school acceptance/degree requirements from general first-year admission.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 14 - Information Systems - Data Science / MS

Institution: Northwestern University  
Programme: Information Systems - Data Science  
Credential: MS  
Target cycle: 2026-27  
Audience/scope: graduate international; Northwestern School of Professional Studies

### GT-V2-14-programme_identity

- Proposed expected state: FOUND
- Proposed value: Northwestern University Information Systems, MS - Data Science Specialization
- Source identity: Northwestern University Academic Catalog 2026-2027 - Information Systems, MS Data Science Specialization
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Information Systems MS Data Science Specialization](https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/)
- Evidence: The 2026-2027 Academic Catalog heading and programme description identify the Information Systems MS Data Science Specialization.
- Evidence locator: Catalogue heading and programme description.
- Programme applicability: The named specialization is the frozen roster target.
- Temporal applicability: Explicit 2026-2027 catalogue edition.
- Known competing evidence: The separate Data Science MS and accelerated/online Information Systems variants must not be treated as the same identity.
- Risk warning: IDENTITY SCOPE - distinguish this specialization from the separate Data Science MS and other delivery variants.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-credential

- Proposed expected state: FOUND
- Proposed value: MS / Master of Science in Information Systems, Data Science Specialization
- Source identity: Northwestern University Academic Catalog 2026-2027 - Information Systems, MS Data Science Specialization
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Information Systems MS Data Science Specialization](https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/)
- Evidence: The 2026-2027 catalogue title and curriculum identify the Master of Science in Information Systems with Data Science specialization.
- Evidence locator: Programme title and curriculum sections.
- Programme applicability: Explicitly applies to the named specialization.
- Temporal applicability: Explicit 2026-2027 catalogue edition.
- Known competing evidence: Specialization and delivery mode are separate dimensions from the MS credential.
- Risk warning: CREDENTIAL/DELIVERY - do not normalize specialization or course format into another credential.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-programme_status

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog 2026-2027 - Information Systems, MS Data Science Specialization
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Information Systems MS Data Science Specialization](https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/)
- Evidence: The 2026-2027 catalogue listing and curriculum are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Catalogue listing and curriculum.
- Programme applicability: The listing names the target specialization, but lifecycle status is not separately stated.
- Temporal applicability: 2026-2027 catalogue context; lifecycle effective date is not stated.
- Known competing evidence: Current catalogue presence is not formal lifecycle evidence.
- Risk warning: STATUS - do not infer ACTIVE solely from curriculum presence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-tuition

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern Student Finance School of Professional Studies graduate tuition
- Source authority: Northwestern University official Student Finance / School of Professional Studies
- Source URL: [SPS graduate tuition](https://www.northwestern.edu/sfs/tuition/graduate/school-of-professional-studies.html)
- Evidence: The 2026-27 SPS graduate tuition table lists Information Systems (MS) at USD 4,963 per unit; the online technology fee is listed separately.
- Evidence locator: 2026-27 School of Professional Studies graduate tuition table, Information Systems (MS) row and separate technology-fee entry.
- Programme applicability: The named Information Systems MS rate is related, but the exact specialization billing representation is not established.
- Temporal applicability: Explicit 2026-27 SPS graduate tuition table.
- Known competing evidence: The SPS programme page and separate Data Science MS rate describe different programme or delivery scopes. It is unresolved whether the benchmark should represent per-unit, per-course, annual, or total tuition.
- Risk warning: HIGH-RISK FINANCE - preserve the direct per-unit rate and separate fees; do not derive a programme total without billing applicability.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-application_deadline

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern School of Professional Studies Important Dates
- Source authority: Northwestern University official School of Professional Studies
- Source URL: [SPS Important Dates](https://sps.northwestern.edu/masters/important-dates.html)
- Evidence: The page lists application deadlines of July 15 for Fall, October 15 for Winter, January 15 for Spring, and April 15 for Summer; it also lists 2026-27 quarter starts including September 23, 2026 and January 5, 2027.
- Evidence locator: Application-deadline section and 2026-27 quarter-calendar entries.
- Programme applicability: General SPS calendar; it is not a programme-specific Data Science specialization deadline notice.
- Temporal applicability: 2026-27 SPS quarter calendar; recurring application dates do not carry a programme-specific target-cycle label in the proposed evidence.
- Known competing evidence: Quarter start dates are not application deadlines; the specialization's available intake must be confirmed.
- Risk warning: TEMPORAL/APPLICABILITY - distinguish deadline from quarter start and verify the specialization intake.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-english_requirement

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern School of Professional Studies Information Systems admissions
- Source authority: Northwestern University official School of Professional Studies
- Source URL: [Accelerated Information Systems admission](https://sps.northwestern.edu/masters/accelerated-information-systems/admission.html)
- Evidence: The International Applicants section describes proof of English through a qualifying degree/transcript or TOEFL/IELTS pathways and gives the stated score thresholds.
- Evidence locator: International Applicants section.
- Programme applicability: The source concerns an accelerated Information Systems admissions path, not explicitly the catalogue Data Science specialization.
- Temporal applicability: Current SPS Information Systems admissions policy; exact specialization cycle applicability is not stated.
- Known competing evidence: Do not silently inherit an accelerated-path policy or a separate Data Science MS policy.
- Risk warning: SCOPE - preserve conditional international applicability, exemptions, and the pathway distinction.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-14-major_admissions_requirement

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog 2026-2027 - Information Systems, MS Data Science Specialization
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Information Systems MS Data Science Specialization](https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/)
- Evidence: The catalogue curriculum and specialization sections describe required core and elective courses but do not establish a complete programme-specific admission gate set in the reviewed excerpt.
- Evidence locator: Curriculum and specialization sections.
- Programme applicability: Curriculum is for the named specialization; admission-gate applicability is unresolved.
- Temporal applicability: 2026-2027 catalogue; no complete target-cycle admissions rule is stated in the proposed evidence.
- Known competing evidence: General SPS admissions and accelerated Information Systems admissions are related evidence, not a silent specialization override.
- Risk warning: ADMISSIONS SCOPE - do not turn curriculum or omission into NOT_REQUIRED.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 15 - Communication and Music / BA-BMus-BS

Institution: Northwestern University  
Programme: Communication and Music  
Credential: BA-BMus-BS  
Target cycle: 2026-27  
Audience/scope: undergraduate international; dual bachelor's programme spanning the School of Communication and Bienen School of Music

### GT-V2-15-programme_identity

- Proposed expected state: FOUND
- Proposed value: Northwestern University dual bachelor's programme in Communication and Music
- Source identity: Northwestern University Academic Catalog - Communication and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Communication and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/)
- Evidence: The catalogue heading and overview identify Communication and Music as a dual bachelor's programme with School of Communication and Bienen components.
- Evidence locator: Catalogue heading and programme overview.
- Programme applicability: The page names the target dual-school programme.
- Temporal applicability: Current catalogue page; explicit edition is not stated in the reviewed excerpt.
- Known competing evidence: The page describes one dual-school programme with multiple credential combinations; do not create separate identities solely for each combination.
- Risk warning: IDENTITY/CREDENTIAL - preserve one programme identity while keeping the selected degree combination explicit.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-credential

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog - Communication and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Communication and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/)
- Evidence: The catalogue lists BA/BMus, BS/BMus, BA/BAMus, and BS/BAMus; the frozen BA-BMus-BS string is not one single official credential label.
- Evidence locator: Catalogue title/overview and listed degree combinations.
- Programme applicability: The target dual programme is identified, but the frozen credential string is not resolved to one official combination.
- Temporal applicability: Current catalogue credential alternatives; explicit edition is not stated in the reviewed excerpt.
- Known competing evidence: The frozen roster credential may combine alternatives. Do not normalize BA-BMus-BS without review.
- Risk warning: CRITICAL CREDENTIAL - preserve alternatives and do not merge degree components by similarity.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-programme_status

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog - Communication and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Communication and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/)
- Evidence: A current catalogue listing and programme overview are present, but no explicit lifecycle ACTIVE assertion appears in the reviewed excerpt.
- Evidence locator: Current catalogue listing and programme overview.
- Programme applicability: The listing names the target programme, but lifecycle status is not separately stated.
- Temporal applicability: Current catalogue listing; lifecycle effective date is not stated.
- Known competing evidence: Catalogue presence does not prove formal lifecycle status.
- Risk warning: STATUS - do not upgrade listing presence to ACTIVE without lifecycle evidence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-tuition

- Proposed expected state: FOUND
- Proposed value: USD 71,802 full-time undergraduate tuition for 2026-27; mandatory fees USD 1,260 are separate
- Source identity: Northwestern Undergraduate Financial Aid 2026-27 Cost of Attendance
- Source authority: Northwestern University official Undergraduate Financial Aid
- Source URL: [Undergraduate cost of attendance](https://undergradaid.northwestern.edu/aid-basics-eligibility/cost-of-attendance.html)
- Evidence: The 2026-27 full-time undergraduate table lists tuition of USD 71,802 and mandatory fees of USD 1,260; the standard academic year is fall/winter/spring.
- Evidence locator: 2026-27 full-time undergraduate cost-of-attendance table, Tuition and Fees rows.
- Programme applicability: Institution-wide full-time undergraduate billed tuition; the source does not establish a special dual-programme or five-year total.
- Temporal applicability: Explicit 2026-27 undergraduate cost-of-attendance schedule.
- Known competing evidence: Music-specific costs, housing, meals, health insurance, other fees, and any derived five-year amount are not tuition.
- Risk warning: FINANCE SCOPE - do not report fees, cost of attendance, music costs, or a derived five-year total as tuition.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-application_deadline

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern Undergraduate Admissions application deadlines
- Source authority: Northwestern University official Undergraduate Admissions
- Source URL: [Application deadlines](https://admissions.northwestern.edu/apply/application-deadlines.html)
- Evidence: The first-year table lists Early Decision November 1, 2026 and Regular Decision January 4, 2027.
- Evidence locator: Application Deadlines page, First-Year Applicants table.
- Programme applicability: Central first-year dates may apply to applicants, but the dual-degree/music path is not stated in the proposed evidence.
- Temporal applicability: Target 2026-27; source cycle is the 2026-27 first-year schedule, while exact dual-degree/music entry-path applicability remains unresolved.
- Known competing evidence: Bienen audition/application and transfer dates are separate pathways.
- Risk warning: TEMPORAL/APPLICABILITY - preserve entry pathway, target cycle, and any music-specific audition deadline.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-english_requirement

- Proposed expected state: FOUND
- Proposed value: For international first-year applicants, an English-proficiency score is required when English is not the applicant's first/primary language or secondary schooling was not in English, subject to the stated policy.
- Source identity: Northwestern International Undergraduate Admissions
- Source authority: Northwestern University official International Undergraduate Admissions
- Source URL: [International applicants](https://admissions.northwestern.edu/apply/identities/international.html)
- Evidence: The international undergraduate English-proficiency section states that a score is required if the applicant's first/primary language is not English or secondary schooling was not in English.
- Evidence locator: International undergraduate admissions, English proficiency section.
- Programme applicability: Conditional policy for international undergraduate applicants; not a universal Communication or Music requirement.
- Temporal applicability: Current international first-year policy; explicit cycle is not stated in the reviewed excerpt.
- Known competing evidence: Language-of-instruction conditions and exemptions may change the outcome for an individual applicant.
- Risk warning: APPLICABILITY - preserve language-of-instruction conditions and exemptions.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-15-major_admissions_requirement

- Proposed expected state: NEEDS_REVIEW
- Proposed value: null
- Source identity: Northwestern University Academic Catalog - Communication and Music dual bachelor's programme
- Source authority: Northwestern University official Academic Catalog
- Source URL: [Communication and Music](https://catalogs.northwestern.edu/undergraduate/dual-bachelors-degrees/communication-music/)
- Evidence: The catalogue allows a School of Communication major and a music programme and notes that each school enforces its policies; it does not establish a complete first-year programme-specific admission gate set.
- Evidence locator: Dual-programme overview, school selection and policy notes.
- Programme applicability: Applies to the dual-school academic structure, but first-year admission-gate applicability is unresolved.
- Temporal applicability: Current catalogue programme context; exact first-year applicability is not stated.
- Known competing evidence: Dual-school academic requirements and current-student advising are distinct from first-year admission; Bienen and School of Communication policies must not be collapsed.
- Risk warning: ADMISSIONS SCOPE - do not infer NOT_REQUIRED from omission or convert post-admission policies into first-year gates.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Reviewer reminder

Review each complete proposed record. Keep tuition separate from fees and cost
of attendance; keep deadlines tied to the correct entry cycle and pathway;
distinguish undergraduate from graduate and specialization from separate
programme scope; and preserve dual-school identity without creating duplicate
entities. Do not use v3 pipeline output to decide benchmark truth.
