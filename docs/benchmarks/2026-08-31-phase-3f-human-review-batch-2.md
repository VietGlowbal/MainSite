# Phase 3F Human Review Packet - Batch 2

Status: COMPLETE - human decisions applied  
Batch: 2 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycle: 2026-27  
Prepared: 2026-08-31

This packet presented the next three frozen-roster programmes for independent
human review. Decisions were applied to the structured ground-truth records on
2026-08-31. `REVIEWED_CONFIRMED` records preserve their independently reviewed
semantic state; they are not implicitly `FOUND`.

Allowed decisions, exactly one per case:

- CONFIRM -> REVIEWED_CONFIRMED
- AMBIGUOUS -> REVIEWED_AMBIGUOUS
- NOT_APPLICABLE -> NOT_APPLICABLE
- REJECT -> remains UNREVIEWED and requires a corrected proposal later

The proposed state is a proposal only. A confirmed record may retain
NEEDS_REVIEW when the reviewed evidence establishes that a safe value or
applicability has not been established.

## Programme 4 - Harvard - Computer Science

Credential in frozen roster: AB  
Audience: undergraduate international  
Primary source: [Harvard College Computer Science concentration](https://handbook.college.harvard.edu/programs/computer-science)  
Source identity: roster-v2-row-4-primary  
Supporting source identities: HAR-A (Harvard College admissions), HAR-F (Harvard financial aid/cost), HAR-PDF (2026-27 Fields of Concentration PDF)

Review context: Harvard College applicants apply to Harvard College and later
declare a concentration. The CS concentration evidence is therefore distinct
from first-year admission evidence. The PDF is the 2026-27 Fields of
Concentration record; the HTML primary locator should be checked against it.

### Case GT-V2-04-programme_identity

- Field: programme identity
- Proposed state/value: FOUND - Harvard College Computer Science concentration
- Authority/source: Harvard College Student Handbook / Fields of Concentration; roster-v2-row-4-primary and HAR-PDF
- Evidence: The official 2026-27 PDF has a Computer Science section and describes the concentration.
- Locator: Fields of Concentration PDF, pages 64-69, heading Computer Science; [PDF](https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf).
- Applicability and time: Harvard College undergraduate concentration; 2026-27 handbook context.
- Known competing evidence: [Harvard CS advising](https://csadvising.seas.harvard.edu/concentration/degrees/) is a parallel official programme description. It should corroborate, not create a second identity.
- Human decision: CONFIRM

### Case GT-V2-04-credential

- Field: credential
- Proposed state/value: FOUND - AB / Bachelor of Arts
- Authority/source: Harvard CS Undergraduate Advising; [degree programs](https://csadvising.seas.harvard.edu/concentration/degrees/)
- Evidence: The degree page states that Harvard CS undergraduates are candidates for the Bachelor of Arts and lists the Basic A.B. programme.
- Locator: Degree programs page, opening statement and Basic A.B. Program section.
- Applicability and time: Harvard College CS concentration; 2026-27 undergraduate context.
- Known competing evidence: The handbook PDF describes the concentration requirements but the CS advising page is the clearer credential source. The concurrent AB-SM option is not the benchmark credential.
- Human decision: CONFIRM

### Case GT-V2-04-programme_status

- Field: programme status
- Proposed state/value: NEEDS_REVIEW - ACTIVE candidate because the 2026-27 handbook lists the concentration; no explicit ACTIVE lifecycle label was located
- Authority/source: Harvard College Fields of Concentration PDF; HAR-PDF
- Evidence: The handbook contains the Computer Science requirements and enrollment statistics through AY 2025-2026.
- Locator: PDF pages 64-69, Computer Science requirements/advising/enrollment-statistics sections.
- Applicability and time: Current undergraduate concentration status for the 2026-27 benchmark cycle; catalogue presence is not by itself a formal lifecycle assertion.
- Temporal metadata: Target cycle 2026-27; source context is the 2026-27 handbook; exact publication date is not stated beyond the 2026-03 PDF path.
- Known competing evidence: No discontinuation or suspension evidence located in preparation; absence of that evidence is not proof of ACTIVE.
- Warning: HISTORICAL/CURRENT distinction.
- Human decision: CONFIRM

### Case GT-V2-04-tuition

- Field: tuition
- Proposed state/value: FOUND - USD 62,226 tuition for the 2026-27 Harvard College undergraduate academic year
- Authority/source: Harvard College Griffin Financial Aid Office; [How Aid Works](https://college.harvard.edu/financial-aid/how-aid-works); supporting identity HAR-F
- Evidence: 2026-2027 Cost of Attendance table lists Tuition as $62,226 and separately lists fees, housing, and food.
- Locator: Cost of Attendance, Tuition and Estimated Expenses, 2026-2027 table, Tuition row.
- Applicability and time: Institution-wide Harvard College undergraduate tuition; applies to CS only if concentration does not have a separate rate. This value is tuition, not billed-cost subtotal or total cost of attendance.
- Temporal metadata: Target cycle 2026-27; source cycle explicitly 2026-27; published/effective date not stated in the reviewed page.
- Known competing evidence: Harvard’s cost table separately lists fees and other costs; those are not competing tuition values. Financial-aid eligibility is not a tuition amount.
- Warning: HIGH RISK - keep tuition separate from fees, housing, and aid.
- Human decision: CONFIRM

### Case GT-V2-04-application_deadline

- Field: application deadline/intake
- Proposed state/value: NEEDS_REVIEW - current Harvard first-year deadlines shown as Restrictive Early Action November 1 and Regular Decision January 1; exact mapping to the roster's 2026-27 academic cycle is not explicit
- Authority/source: Harvard College Admissions; [First-Year Applicants](https://college.harvard.edu/admissions/apply/first-year-applicants); supporting identity HAR-A
- Evidence: The first-year timeline lists REA November 1 and Regular Decision January 1.
- Locator: Application Timeline and First-year Timeline sections, REA and Regular Decision deadline entries.
- Applicability and time: Central Harvard College first-year admission; applies to intended CS concentrators only if concentration timing and applicant cycle are correctly mapped. Harvard does not admit directly to CS concentration.
- Temporal metadata: Target cycle 2026-27; source is the current first-year page but does not explicitly label the academic entry year in the reviewed excerpt; published/effective date not stated.
- Known competing evidence: [Harvard Apply page](https://college.harvard.edu/admissions/apply) repeats November 1 and January 1. No CS-specific admission deadline was located.
- Warning: HIGH RISK - do not map a current application date to 2026-27 without confirming the source/application cycle.
- Human decision: CONFIRM

### Case GT-V2-04-english_requirement

- Field: English-language requirement
- Proposed state/value: NOT_REQUIRED candidate - Harvard says TOEFL is not required for first-year and transfer applicants; SAT/ACT remains the standardized testing requirement
- Authority/source: Harvard College Admissions; [TOEFL FAQ](https://college.harvard.edu/resources/faq/i-am-another-country-i-speak-english-proficiently-do-i-still-need-take-toefl) and [Application Requirements](https://college.harvard.edu/admissions/apply/application-requirements); supporting identity HAR-A
- Evidence: Harvard’s FAQ states that TOEFL is not required for first-year or transfer applicants. The application requirements page says requirements are the same for domestic and international applicants and requires SAT or ACT, subject to stated exceptions.
- Locator: TOEFL FAQ answer; Application Requirements, Overview and Standardized Test Scores sections.
- Applicability and time: Harvard College first-year undergraduate international audience; confirm that this benchmark field means English-language testing, not general English ability or the SAT/ACT requirement.
- Temporal metadata: Target cycle 2026-27; source pages are current but do not explicitly label the academic entry year in the reviewed excerpt; published/effective date not stated.
- Known competing evidence: Harvard’s Visiting Undergraduate Student page requires TOEFL/IELTS for VUS, but VUS is a different programme and should not be inherited into first-year CS.
- Warning: HIGH RISK - NOT_REQUIRED requires explicit first-year applicability; do not generalize from visiting-student rules.
- Human decision: CONFIRM

### Case GT-V2-04-major_admissions_requirement

- Field: major admissions requirement
- Proposed state/value: NOT_REQUIRED candidate - no direct CS concentration admission gate; applicants apply to Harvard College and declare a concentration later
- Authority/source: Harvard SEAS Computer Science; [Bachelor's Degree in Computer Science](https://seas.harvard.edu/computer-science/bachelors-degree-computer-science); Harvard College Admissions; [First-Year Applicants](https://college.harvard.edu/admissions/apply/first-year-applicants)
- Evidence: The CS degree page says prospective undergraduates apply directly to Harvard College and declare a concentration during sophomore spring.
- Locator: CS bachelor's page, “At Harvard College” and “Bachelor of Arts (A.B.)” sections; Harvard first-year application requirements.
- Applicability and time: Programme-specific admission gate for the CS concentration; central Harvard College requirements remain applicable to the applicant. Confirm the benchmark field’s intended scope.
- Temporal metadata: Target cycle 2026-27; source programme page has no explicit cycle label in the reviewed excerpt; published/effective date not stated.
- Known competing evidence: CS concentration requirements on the handbook pages are academic completion requirements, not first-year admission requirements. No separate CS admission deadline or selection gate was located.
- Warning: HIGH RISK - do not mark NOT_REQUIRED merely because a programme page was absent; here the source explicitly describes later concentration declaration.
- Human decision: CONFIRM

## Programme 5 - Harvard - Data Science

Credential in frozen roster: SM  
Audience: graduate international  
Primary source: [Harvard GSAS Data Science](https://gsas.harvard.edu/program/data-science)  
Source identity: roster-v2-row-5-primary  
Supporting source identities: HAR-G (Harvard Griffin GSAS admissions), HAR-F (Harvard graduate cost), HAR-PDF (annual handbook/PDF family)

Review context: Data Science is a terminal SM programme in SEAS administered
through Harvard Griffin GSAS. Do not substitute the general GSAS tuition
schedule for the named SEAS Data Science schedule.

### Case GT-V2-05-programme_identity

- Field: programme identity
- Proposed state/value: FOUND - Harvard Data Science master's programme in SEAS/Harvard Griffin GSAS
- Authority/source: Harvard Griffin GSAS; [Data Science programme page](https://gsas.harvard.edu/program/data-science); source identity roster-v2-row-5-primary
- Evidence: The page names Data Science, places it within SEAS, and describes application through Harvard Griffin GSAS.
- Locator: Page heading and programme description, especially the application-routing paragraph.
- Applicability and time: Graduate international Data Science SM; current programme page context for the 2026-27 benchmark.
- Known competing evidence: [SEAS Master's in Data Science](https://seas.harvard.edu/masters-data-science) is a parallel official programme page; it should corroborate the same identity.
- Human decision: CONFIRM

### Case GT-V2-05-credential

- Field: credential
- Proposed state/value: FOUND - SM / Master of Science
- Authority/source: Harvard Griffin GSAS; [Data Science programme page](https://gsas.harvard.edu/program/data-science)
- Evidence: The programme page lists “Master of Science (SM)” under Degrees Offered.
- Locator: Data Science programme page, Degrees Offered section.
- Applicability and time: Programme-specific; graduate international; 2026-27 benchmark context.
- Known competing evidence: The SEAS overview calls this a Data Science master’s programme; no conflicting credential was located. Do not confuse the secondary field in data science with the SM.
- Human decision: CONFIRM

### Case GT-V2-05-programme_status

- Field: programme status
- Proposed state/value: NEEDS_REVIEW - ACTIVE candidate because the current GSAS and SEAS pages list the SM; no explicit lifecycle label was located
- Authority/source: Harvard Griffin GSAS and SEAS; roster-v2-row-5-primary
- Evidence: The current Data Science page gives the degree, programme description, contact, and application route.
- Locator: Programme page heading, degree/deadline/contact sections; [SEAS overview](https://seas.harvard.edu/masters-data-science).
- Applicability and time: Current graduate programme status for 2026-27; current listing is not a formal ACTIVE lifecycle assertion.
- Temporal metadata: Target cycle 2026-27; source page current date/last-updated field is not stated in the reviewed excerpt.
- Known competing evidence: No discontinuation or suspension evidence located; a future programme-page status notice would control.
- Warning: HISTORICAL/CURRENT distinction.
- Human decision: CONFIRM

### Case GT-V2-05-tuition

- Field: tuition
- Proposed state/value: FOUND - USD 67,504 full year for the Data Science SM first year; USD 33,752 for the second year’s one term
- Authority/source: Harvard Griffin GSAS; [Cost of Attendance 2026-2027](https://gsas.harvard.edu/apply/cost-attendance-2026-2027); supporting identity HAR-F
- Evidence: The named SEAS Data Science master’s row lists $67,504 for the first year and $33,752 for the second year, one term only.
- Locator: Tuition section, “SEAS Computational Science and Engineering (CSE) and Data Science Master’s Programs” table, Data Science master of science row.
- Applicability and time: Explicitly names Data Science SM; graduate international audience. Confirm whether the benchmark tuition field stores the first-year amount, a full programme schedule, or both.
- Temporal metadata: Target cycle 2026-27; source cycle explicitly 2026-27; published/effective date not stated.
- Known competing evidence: The same page lists general GSAS full tuition of $59,048 and CSE/ME schedules. Those rows are not the Data Science SM and must not replace the named Data Science schedule.
- Warning: HIGH RISK - do not collapse the multi-year/one-term schedule into an unrelated general GSAS amount.
- Human decision: AMBIGUOUS

### Case GT-V2-05-application_deadline

- Field: application deadline/intake
- Proposed state/value: NEEDS_REVIEW - December 1, 2026 at 5:00 p.m. is shown on the Data Science programme page; the source’s academic entry-cycle label must be confirmed
- Authority/source: Harvard Griffin GSAS; [Data Science programme page](https://gsas.harvard.edu/program/data-science); source identity roster-v2-row-5-primary
- Evidence: The page’s application section lists Degrees Offered: Master of Science (SM) and Deadline: Dec 01, 2026 | 05:00 pm.
- Locator: APPLICATION DEADLINE section, Degrees Offered and Deadline entries.
- Applicability and time: Programme-specific Data Science SM; graduate international; confirm whether this deadline is for entry in the 2027-28 academic year or the roster’s 2026-27 cycle.
- Temporal metadata: Target cycle 2026-27; source date is December 1, 2026 at 5:00 p.m.; source academic entry cycle is not explicitly stated. The general GSAS page says 2027-28 applications open in early fall 2026, which may indicate a cycle mismatch.
- Known competing evidence: [GSAS Apply](https://gsas.harvard.edu/apply) says deadlines vary by programme and are on the relevant programme page. No second Data Science deadline was located.
- Warning: HIGH RISK - deadline cycle. Do not silently relabel a 2027-28 entry deadline as 2026-27.
- Human decision: CONFIRM

### Case GT-V2-05-english_requirement

- Field: English-language requirement
- Proposed state/value: FOUND candidate - for non-native English speakers: TOEFL minimum 5 with speaking 4.5 (or pre-2026-01-21 scores 95 and 23), or IELTS Academic minimum 7 with speaking 6.5; English-medium undergraduate degree may establish proficiency; some programmes may require higher scores
- Authority/source: Harvard Griffin GSAS; [English Proficiency](https://gsas.harvard.edu/apply/applying-degree-programs/english-proficiency); source identity HAR-G
- Evidence: GSAS lists three routes: English-primary undergraduate degree, TOEFL threshold, or IELTS threshold, and states that some degree programmes may require higher scores.
- Locator: English Proficiency Requirement section and score bullets.
- Applicability and time: Graduate international Data Science SM; confirm that Data Science does not add a higher programme-specific threshold. Score-report validity and official-report rules also apply.
- Temporal metadata: Target cycle 2026-27; TOEFL scale transition is dated January 21, 2026; source page does not otherwise state an academic-cycle publication date.
- Known competing evidence: The Data Science programme page lists GRE tests as optional but does not provide a separate English threshold. Treat that omission as no programme-specific override found, not as proof of NOT_REQUIRED.
- Warning: HIGH RISK - language policy, score scale, waiver route, and programme-specific override.
- Human decision: CONFIRM

### Case GT-V2-05-major_admissions_requirement

- Field: major admissions requirement
- Proposed state/value: FOUND candidate - no formal prerequisites are stated, but successful applicants should have working knowledge of calculus, linear algebra/differential equations, probability/statistical inference, programming, and basic computer science; application routes through GSAS
- Authority/source: Harvard SEAS; [Master's in Data Science](https://seas.harvard.edu/masters-data-science); related programme source roster-v2-row-5-primary
- Evidence: SEAS explicitly distinguishes no formal prerequisites from recommended preparation for successful applicants.
- Locator: Requirements and How to Apply sections of the SEAS Data Science master’s page.
- Applicability and time: Programme-specific graduate Data Science SM; graduate international; confirm whether “major admissions requirement” stores formal prerequisites only or also recommended preparation.
- Temporal metadata: Target cycle 2026-27; source page’s academic-cycle label/publication date is not stated in the reviewed excerpt.
- Known competing evidence: [Degree Requirements](https://seas.harvard.edu/masters-data-science/degree-requirements) describes requirements after admission, not admissions prerequisites. Do not conflate the two.
- Warning: Scope review - “no formal prerequisites” is not equivalent to “no preparation expected.”
- Human decision: AMBIGUOUS

## Programme 6 - Harvard - Electrical Engineering

Credential in frozen roster: AB  
Audience: undergraduate international  
Primary source: [Harvard Fields of Concentration PDF](https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf)  
Source identity: roster-v2-row-6-primary  
Supporting source identities: HAR-A (Harvard College admissions), HAR-F (Harvard financial aid/cost), HAR-PDF (annual fields/concentration PDF)

Review context: This is an identity/credential edge case. The frozen roster
labels Electrical Engineering as AB, while official Harvard SEAS material
distinguishes Electrical Engineering S.B. from Engineering Sciences A.B.
(Electrical and Computer Engineering Track). Do not silently resolve the
roster label.

### Case GT-V2-06-programme_identity

- Field: programme identity
- Proposed state/value: NEEDS_REVIEW - Harvard official sources identify an Electrical Engineering concentration/S.B., while the frozen roster labels the case Electrical Engineering / AB
- Authority/source: Harvard College Fields of Concentration; [PDF](https://handbook.college.harvard.edu/sites/g/files/omnuum5551/files/2026-03/Fields%20of%20Concentration_0.pdf); roster-v2-row-6-primary
- Evidence: The 2026-27 handbook has an Electrical Engineering section; SEAS separately lists Electrical Engineering S.B. and Engineering Sciences A.B. - Electrical and Computer Engineering Track.
- Locator: Fields of Concentration PDF, pages 86-89, Electrical Engineering heading and requirements; [SEAS concentration requirements](https://seas.harvard.edu/electrical-engineering/bachelors-degree-electrical-engineering/concentration-information-0), Electrical Engineering (S.B.) and Engineering Sciences (A.B.) sections.
- Applicability and time: Harvard College undergraduate engineering identity; target cycle 2026-27. The benchmark entity must be resolved before scoring the credential as AB.
- Temporal metadata: Target cycle 2026-27; source PDF path includes 2026-03; exact publication/effective date not stated.
- Known competing evidence: The two official choices are materially different credentials/tracks: Electrical Engineering S.B. versus Engineering Sciences A.B. - Electrical and Computer Engineering Track. This is a real identity/credential ambiguity, not a URL variant.
- Warning: HIGH RISK - identity/credential mismatch. Prefer AMBIGUOUS over unsafe correction.
- Human decision: CONFIRM

### Case GT-V2-06-credential

- Field: credential
- Proposed state/value: NEEDS_REVIEW - evidence points to Electrical Engineering S.B.; an A.B. would correspond to the separate Engineering Sciences A.B. Electrical and Computer Engineering Track
- Authority/source: Harvard SEAS; [Concentration Requirements](https://seas.harvard.edu/electrical-engineering/bachelors-degree-electrical-engineering/concentration-information-0); supporting HAR-PDF
- Evidence: SEAS lists Electrical Engineering (S.B.) as one programme and separately describes Engineering Sciences (A.B.) - Electrical and Computer Engineering Track.
- Locator: Concentration Requirements page, headings “Engineering Sciences (A.B.) - Electrical and Computer Engineering Track” and “Electrical Engineering (S.B.)”; handbook PDF pages 86-89.
- Applicability and time: Undergraduate engineering credential for the 2026-27 benchmark; the roster’s AB label must be validated or corrected by the reviewer.
- Temporal metadata: Target cycle 2026-27; source page is current but exact publication/effective date not stated.
- Known competing evidence: [Electrical Engineering, SB](https://seas.harvard.edu/about-us/school-overview/accreditation-abet/electrical-engineering-sb) explicitly describes the Electrical Engineering Bachelor of Science. This competes with the roster label, not with the official programme evidence.
- Warning: HIGH RISK - do not normalize S.B. to A.B. because both are bachelor credentials.
- Human decision: CONFIRM

### Case GT-V2-06-programme_status

- Field: programme status
- Proposed state/value: NEEDS_REVIEW - current handbook lists Electrical Engineering requirements and recent enrollment statistics; no explicit ACTIVE lifecycle label was located
- Authority/source: Harvard College Fields of Concentration PDF; HAR-PDF
- Evidence: Electrical Engineering appears as a current handbook section with requirements and enrollment statistics through AY 2025-2026.
- Locator: PDF pages 86-89, Electrical Engineering requirements/advising/enrollment-statistics sections.
- Applicability and time: Current undergraduate engineering offering/status for 2026-27; handbook listing is not by itself a formal lifecycle assertion.
- Temporal metadata: Target cycle 2026-27; source context is the 2026-27 handbook; exact publication date is not stated beyond the 2026-03 PDF path.
- Known competing evidence: No discontinuation or suspension evidence located; the credential/track ambiguity remains a separate identity issue.
- Warning: HISTORICAL/CURRENT distinction.
- Human decision: CONFIRM

### Case GT-V2-06-tuition

- Field: tuition
- Proposed state/value: FOUND candidate - USD 62,226 tuition for the 2026-27 Harvard College undergraduate academic year, subject to resolving whether the case is Electrical Engineering S.B. or Engineering Sciences A.B.
- Authority/source: Harvard College Griffin Financial Aid Office; [How Aid Works](https://college.harvard.edu/financial-aid/how-aid-works); supporting identity HAR-F
- Evidence: 2026-2027 Cost of Attendance table lists Tuition as $62,226 and separates fees and other costs.
- Locator: Cost of Attendance, Tuition and Estimated Expenses, 2026-2027 table, Tuition row.
- Applicability and time: Institution-wide Harvard College undergraduate tuition; likely applies to either undergraduate track, but programme identity/credential must be confirmed first.
- Temporal metadata: Target cycle 2026-27; source cycle explicitly 2026-27; published/effective date not stated.
- Known competing evidence: No separate Harvard engineering tuition rate was located. Fees and financial-aid amounts are not competing tuition values.
- Warning: HIGH RISK - tuition may be usable only after the programme identity/credential ambiguity is resolved.
- Human decision: AMBIGUOUS

### Case GT-V2-06-application_deadline

- Field: application deadline/intake
- Proposed state/value: NEEDS_REVIEW - Harvard first-year central deadlines are REA November 1 and Regular Decision January 1; exact mapping to the 2026-27 target cycle is not explicit
- Authority/source: Harvard College Admissions; [First-Year Applicants](https://college.harvard.edu/admissions/apply/first-year-applicants); supporting identity HAR-A
- Evidence: Harvard’s first-year timeline lists November 1 for Restrictive Early Action and January 1 for Regular Decision.
- Locator: Application Timeline and First-year Timeline deadline entries.
- Applicability and time: Central Harvard College first-year admission; Electrical Engineering is not a direct first-year admission programme. Confirm whether the benchmark field should be central entry or engineering-track declaration timing.
- Temporal metadata: Target cycle 2026-27; source current page does not explicitly label the academic entry year; published/effective date not stated.
- Known competing evidence: SEAS “How to Declare” describes post-enrollment concentration declaration steps, not a first-year application deadline. No Electrical Engineering-specific first-year deadline located.
- Warning: HIGH RISK - deadline cycle and direct-admission scope.
- Human decision: CONFIRM

### Case GT-V2-06-english_requirement

- Field: English-language requirement
- Proposed state/value: NOT_REQUIRED candidate - Harvard states TOEFL is not required for first-year and transfer applicants; standardized testing requirements remain separate
- Authority/source: Harvard College Admissions; [TOEFL FAQ](https://college.harvard.edu/resources/faq/i-am-another-country-i-speak-english-proficiently-do-i-still-need-take-toefl) and [Application Requirements](https://college.harvard.edu/admissions/apply/application-requirements); supporting identity HAR-A
- Evidence: Harvard’s FAQ explicitly excludes first-year and transfer applicants from the TOEFL requirement; the application requirements page applies requirements to international and domestic applicants.
- Locator: TOEFL FAQ answer; Application Requirements, Overview and Standardized Test Scores sections.
- Applicability and time: Harvard College first-year international audience; confirm whether the intended field is English testing and whether an engineering-track declaration changes it.
- Temporal metadata: Target cycle 2026-27; source pages current but exact academic-year label/publication date not stated.
- Known competing evidence: Visiting Undergraduate Students has a separate TOEFL/IELTS rule, but that is not Harvard College first-year admission.
- Warning: HIGH RISK - NOT_REQUIRED must remain bounded to first-year applicants.
- Human decision: CONFIRM

### Case GT-V2-06-major_admissions_requirement

- Field: major admissions requirement
- Proposed state/value: NOT_REQUIRED candidate - no direct Electrical Engineering concentration admission gate for first-year applicants; Harvard College admission precedes concentration declaration
- Authority/source: Harvard College Admissions; [First-Year Applicants](https://college.harvard.edu/admissions/apply/first-year-applicants); Harvard SEAS; [How to Declare](https://seas.harvard.edu/electrical-engineering/bachelors-degree-electrical-engineering/concentration-information/how)
- Evidence: First-year applicants apply to Harvard College; the SEAS declaration page describes current-student concentration declaration and plan-of-study steps.
- Locator: First-Year Applicants eligibility/application sections; How to Declare, steps to review requirements, submit declaration, and meet the DUS.
- Applicability and time: Programme-specific first-year admission gate; central Harvard College entry requirements still apply. Confirm whether the field should include post-enrollment declaration requirements.
- Temporal metadata: Target cycle 2026-27; source pages do not explicitly state an academic entry-year label; published/effective date not stated.
- Known competing evidence: Electrical Engineering S.B. plan-of-study requirements are degree/completion requirements, not evidence of a separate first-year admissions gate.
- Warning: Scope review and roster credential ambiguity; do not treat later declaration requirements as first-year admission requirements without an explicit policy decision.
- Human decision: CONFIRM

## Reviewer notes and completion

- Batch 1 remains frozen and unchanged.
- Batch 2 human decisions were applied on 2026-08-31.
- Human tally: `CONFIRM` 18; `AMBIGUOUS` 3; `NOT_APPLICABLE` 0; `REJECT` 0.
- Structured result: `REVIEWED_CONFIRMED` 18; `REVIEWED_AMBIGUOUS` 3; remaining 0.
- Ambiguous cases: `GT-V2-05-tuition`, `GT-V2-05-major_admissions_requirement`, and `GT-V2-06-tuition`.
- Confirmed records whose reviewed truth remains unresolved preserve `expected_state=NEEDS_REVIEW` and `expected_value=null` where applicable.
- Batch 1 remains frozen and unchanged.
- Scoring has not started.
