# Phase 3F Human Review Packet - Batch 12

Status: **CLOSED - independent human review complete**  
Batch: 12 of 12  
Programmes: University of Michigan rows 34-36  
Field cases: 21 (7 critical fields per programme)  
Target cycle: 2026-27  
Prepared: 2026-09-01  

This packet covers the final three frozen v2 roster rows. Proposals use independent official University of Michigan programme, admissions, registrar, and finance sources only; no v3 output was used. All 21 records received independent human CONFIRM decisions. The blank checkbox controls below are retained as the original packet form; final decisions are recorded in the structured ground-truth queue.

`review_status` and `expected_state` are separate axes. Human confirmation accepts the complete proposed record; it does not force `FOUND`, `ACTIVE`, or a verified current value. A proposal with `NEEDS_REVIEW` and a null value is intentional where source applicability or cycle mapping is unresolved.

## Source register

| Code | Role | Source |
|---|---|---|
| UMSI-MADS | University of Michigan School of Information MADS programme/admissions/tuition sources | <https://mads.si.umich.edu/> |
| UM-AERO | University of Michigan Aerospace Engineering undergraduate sources | <https://aero.engin.umich.edu/undergraduate/> |
| UM-AERO-ADMISSIONS | University of Michigan Aerospace Engineering undergraduate admissions | <https://aero.engin.umich.edu/undergraduate/admissions/> |
| UM-AERO-DEGREE | University of Michigan Aerospace Engineering degree requirements | <https://aero.engin.umich.edu/undergraduate/degree-requirements/> |
| UM-UG-INTL | University of Michigan Office of Undergraduate Admissions international requirements | <https://admissions.umich.edu/apply/international-applicants/requirements-deadlines> |
| UM-REG-COE | University of Michigan Office of the Registrar College of Engineering tuition schedule | <https://ro.umich.edu/tuition-residency/tuition-fees/2026-2027/undergraduate/full-term/college-engineering-undergraduate> |
| UM-MAE | University of Michigan LSA Department of Economics MAE programme/application sources | <https://lsa.umich.edu/econ/mae.html> |
| UM-MAE-FAQ | University of Michigan LSA Department of Economics MAE FAQ | <https://lsa.umich.edu/econ/mae/mae-application-process/mae-application-faq.html> |

## Review decisions

For each case select exactly one: `CONFIRM`, `AMBIGUOUS`, `REJECT`, or `NOT_APPLICABLE`. Do not treat an omitted decision as confirmation.
## GT-V2-34-programme_identity

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `programme_identity`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: Master of Applied Data Science (MADS), a fully online graduate degree offered by the University of Michigan School of Information (UMSI).
- Source identity: UMSI-MADS-IDENTITY-34
- Source authority: University of Michigan School of Information official MADS programme source
- Source URL: <https://mads.si.umich.edu/>
- Short evidence summary: Current official MADS programme/FAQ pages retrieved 2026-09-01; no explicit 2026-27 lifecycle edition is asserted.
- Precise evidence locator: MADS programme heading and UMSI FAQ section “What is the difference between UMSI’s MADS degree and the U-M LSA MS in Data Science?”
- Programme applicability: Direct UMSI programme identity is established; the source describes MADS as a fully online School of Information degree.
- Temporal applicability: Current official MADS programme/FAQ pages retrieved 2026-09-01; no explicit 2026-27 lifecycle edition is asserted.
- Known competing evidence: The UMSI MS in Data Science is a separate on-campus LSA programme; continuing-education and other online offerings are not this roster row.
- Risk warning: IDENTITY/DELIVERY - preserve MADS, UMSI ownership, graduate level, and fully online delivery; do not merge with the separate LSA MS in Data Science.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-credential

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: Master of Applied Data Science (MADS).
- Source identity: UMSI-MADS-CREDENTIAL-34
- Source authority: University of Michigan School of Information official MADS admissions source
- Source URL: <https://si.umich.edu/admissions-aid/apply/how-do-i-apply-master-applied-data-science>
- Short evidence summary: Current official admissions page retrieved 2026-09-01; the source names the award but does not require a generic MSc normalization.
- Precise evidence locator: Page heading “How do I apply to the Master of Applied Data Science?” and opening paragraph naming the Master of Applied Data Science (MADS).
- Programme applicability: The official UMSI admissions page names the programme and award as Master of Applied Data Science (MADS).
- Temporal applicability: Current official admissions page retrieved 2026-09-01; the source names the award but does not require a generic MSc normalization.
- Known competing evidence: The separate U-M LSA MS in Data Science and other UMSI graduate awards are competing credential contexts.
- Risk warning: CREDENTIAL - keep the institutional award title primary; MADS is an abbreviation, not a generic MSc substitution.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-programme_status

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `programme_status`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UMSI-MADS-STATUS-34
- Source authority: University of Michigan School of Information official MADS programme source
- Source URL: <https://mads.si.umich.edu/>
- Short evidence summary: Current page presence is observed on 2026-09-01; no formal lifecycle statement is identified.
- Precise evidence locator: Current MADS programme page and UMSI FAQ programme listing.
- Programme applicability: The official page shows a current programme listing, but that is not an explicit ACTIVE, SUSPENDED, or DISCONTINUED assertion.
- Temporal applicability: Current page presence is observed on 2026-09-01; no formal lifecycle statement is identified.
- Known competing evidence: Admissions and tuition pages provide operational context but do not establish a formal lifecycle status.
- Risk warning: STATUS/LIFECYCLE - do not infer ACTIVE from page presence, application availability, or current curriculum visibility.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-tuition

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `tuition`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UMSI-MADS-TUITION-34
- Source authority: University of Michigan School of Information official MADS tuition source
- Source URL: <https://si.umich.edu/programs/master-applied-data-science/master-applied-data-science-tuition-and-funding>
- Short evidence summary: The source gives 2025-26 candidate amounts: $1,161 in-state or $1,548 out-of-state per credit for a 38-credit programme, plus separate semester fees. It does not establish a canonical 2026-27 amount.
- Precise evidence locator: Tuition heading “2025–26 academic year”; in-state/out-of-state per-credit tables; “Required fees” section; note that updated tuition and fees are posted annually.
- Programme applicability: Target benchmark cycle is 2026-27; direct MADS page is labelled 2025-26 and says updated rates are posted annually near the start of fall term.
- Temporal applicability: The source gives 2025-26 candidate amounts: $1,161 in-state or $1,548 out-of-state per credit for a 38-credit programme, plus separate semester fees. It does not establish a canonical 2026-27 amount.
- Known competing evidence: Candidate evidence includes per-credit rates, estimated 38-credit totals, infrastructure maintenance fee, and university fee; those are distinct billing concepts.
- Risk warning: TUITION/CYCLE - do not promote 2025-26 rates or derived 38-credit totals to 2026-27 canonical tuition; keep fees and scholarships separate.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-application_deadline

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `application_deadline`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UMSI-MADS-DEADLINE-34
- Source authority: University of Michigan School of Information official MADS admissions source
- Source URL: <https://si.umich.edu/admissions-aid/apply/how-do-i-apply-master-applied-data-science>
- Short evidence summary: The current page lists priority October 1, 2026, final November 15, 2026, and classes beginning January 13, 2027; it also lists recurring Fall July 15, Winter November 15, and Spring/Summer March 15 application dates.
- Precise evidence locator: “Apply now” deadline block and “Program start dates” section.
- Programme applicability: The current page mixes a dated 2026/2027 deadline block with recurring three-term start-date rules and does not state one benchmark academic-year mapping for the roster cycle.
- Temporal applicability: The current page lists priority October 1, 2026, final November 15, 2026, and classes beginning January 13, 2027; it also lists recurring Fall July 15, Winter November 15, and Spring/Summer March 15 application dates.
- Known competing evidence: MADS admits for Fall, Winter, and Spring/Summer; the January 13, 2027 class-start date and recurring windows may represent different intake contexts.
- Risk warning: DEADLINE/CYCLE - retain dates as candidate evidence; do not collapse three intakes or assign one 2026-27 canonical deadline without reviewed entry-cycle semantics.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-english_requirement

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `english_requirement`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: MADS requires an official TOEFL or IELTS score taken within the previous two years for applicable applicants, unless the applicant is a native English speaker, completed the entire degree at an institution where all classes are taught in English, or is a current University of Michigan student. The page lists recommended TOEFL and IELTS scores rather than a separate programme-specific minimum threshold.
- Source identity: UMSI-MADS-ENGLISH-34
- Source authority: University of Michigan School of Information official MADS admissions source
- Source URL: <https://si.umich.edu/admissions-aid/apply/how-do-i-apply-master-applied-data-science>
- Short evidence summary: Current MADS admissions policy retrieved 2026-09-01; the source states test recency and exemptions and labels the displayed scores as recommended.
- Precise evidence locator: “Admission requirements” English proficiency bullet and Step 1 “English proficiency test (if applicable)” subsection.
- Programme applicability: The MADS admissions page directly scopes the conditional language rule to MADS applicants.
- Temporal applicability: Current MADS admissions policy retrieved 2026-09-01; the source states test recency and exemptions and labels the displayed scores as recommended.
- Known competing evidence: Rackham or other U-M graduate language policies may apply to other programmes but are not silently inherited here; the listed scores are recommended, not converted into an unlisted minimum.
- Risk warning: LANGUAGE/APPLICABILITY - preserve applicant scope, prior-education exemptions, two-year validity, and recommended-versus-required distinction.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-34-major_admissions_requirement

- Institution: University of Michigan
- Programme: Master of Applied Data Science
- Frozen-roster credential: MADS
- Field: `major_admissions_requirement`
- Target cycle: `2026-27`
- Audience/scope: graduate international; online programme applicants; University of Michigan School of Information Master of Applied Data Science; online graduate programme; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: MADS admission requires a four-year undergraduate degree or international equivalent from an accredited institution and basic Python proficiency. The MADS application has no application fee, essays, or letters of recommendation; a placement test or qualifying waiver is used after admission to determine the starting point.
- Source identity: UMSI-MADS-ADMISSIONS-34
- Source authority: University of Michigan School of Information official MADS admissions source
- Source URL: <https://si.umich.edu/admissions-aid/apply/how-do-i-apply-master-applied-data-science>
- Short evidence summary: Current MADS admissions page retrieved 2026-09-01; the page distinguishes entry requirements, application contents, and post-admission placement.
- Precise evidence locator: “Admission requirements” section; Step 1 application contents; Steps 2–3 placement process.
- Programme applicability: The requirements are scoped to the online MADS programme and preserve the post-admission placement step separately from admission eligibility.
- Temporal applicability: Current MADS admissions page retrieved 2026-09-01; the page distinguishes entry requirements, application contents, and post-admission placement.
- Known competing evidence: The FAQ confirms no undergraduate GPA, prior work-experience, essay, or GRE requirement; the separate LSA MS in Data Science has different admissions semantics.
- Risk warning: ADMISSIONS/SCOPE - do not treat the placement test, recommended Python course, or scholarship consideration as a universal pre-admission gate.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-programme_identity

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `programme_identity`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `FOUND`
- Proposed expected value: University of Michigan College of Engineering undergraduate Aerospace Engineering programme, administered by the Aerospace Engineering Department; students apply to U-M and the College of Engineering and declare Aerospace Engineering after acceptance.
- Source identity: UM-AERO-IDENTITY-35
- Source authority: University of Michigan Aerospace Engineering official undergraduate admissions source
- Source URL: <https://aero.engin.umich.edu/undergraduate/admissions/>
- Short evidence summary: Current undergraduate admissions page retrieved 2026-09-01; no historical or formal lifecycle claim is made.
- Precise evidence locator: Admissions page statements that students are not admitted directly to the Department of Aerospace Engineering and may declare the major after U-M and College of Engineering acceptance.
- Programme applicability: The official department admissions page establishes the department programme and its college-level entry relationship.
- Temporal applicability: Current undergraduate admissions page retrieved 2026-09-01; no historical or formal lifecycle claim is made.
- Known competing evidence: The College of Engineering admission process, Aerospace major declaration stage, graduate Aerospace programmes, and SUGS are separate scopes.
- Risk warning: IDENTITY/STAGE - preserve department, college, undergraduate level, and post-acceptance major declaration; do not model direct department admission.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-credential

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `FOUND`
- Proposed expected value: Bachelor of Science in Engineering (B.S.E.) in Aerospace Engineering.
- Source identity: UM-AERO-CREDENTIAL-35
- Source authority: University of Michigan College of Engineering official bulletin
- Source URL: <https://bulletin.engin.umich.edu/ug-ed/degrees/>
- Short evidence summary: Current College of Engineering bulletin retrieved 2026-09-01; source-supported award is B.S.E., not a generic BA/BS substitution.
- Precise evidence locator: Degree Options table: “B.S.E. in Aerospace Engineering”; introductory statement that undergraduate engineering programmes lead to a Bachelor of Science in Engineering (B.S.E.).
- Programme applicability: The bulletin directly maps Aerospace Engineering to the B.S.E. degree under the College of Engineering.
- Temporal applicability: Current College of Engineering bulletin retrieved 2026-09-01; source-supported award is B.S.E., not a generic BA/BS substitution.
- Known competing evidence: The department also has graduate M.S.E./M.Eng./Ph.D. programmes and SUGS combinations; those are not this BS roster row.
- Risk warning: CREDENTIAL/LEVEL - preserve B.S.E. and undergraduate College of Engineering scope; do not merge with graduate Aerospace awards.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-programme_status

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `programme_status`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-AERO-STATUS-35
- Source authority: University of Michigan Aerospace Engineering official undergraduate programme source
- Source URL: <https://aero.engin.umich.edu/undergraduate/>
- Short evidence summary: Current undergraduate programme pages are present on 2026-09-01, but no explicit lifecycle status is stated.
- Precise evidence locator: Undergraduate programme overview and degree-requirements navigation.
- Programme applicability: Programme-page and curriculum presence establish a listed undergraduate programme but not formal ACTIVE, SUSPENDED, or DISCONTINUED status.
- Temporal applicability: Current undergraduate programme pages are present on 2026-09-01, but no explicit lifecycle status is stated.
- Known competing evidence: Admissions and degree-requirements pages provide operational/curriculum evidence only.
- Risk warning: STATUS/LIFECYCLE - do not infer ACTIVE from a live programme page or current course list.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-tuition

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `tuition`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-REG-COE-TUITION-35
- Source authority: University of Michigan Office of the Registrar official College of Engineering tuition schedule
- Source URL: <https://ro.umich.edu/tuition-residency/tuition-fees/2026-2027/undergraduate/full-term/college-engineering-undergraduate>
- Short evidence summary: The 2026-27 schedule lists full-time College of Engineering tuition of $33,497 nonresident/$9,854 resident for lower division and $37,612 nonresident/$12,764 resident for upper division, with separate credit-hour bands.
- Precise evidence locator: College of Engineering, Undergraduate, Full Term, 2026-2027; lower-division and upper-division 12–18 credit rows.
- Programme applicability: Target cycle is directly labelled 2026-2027, but the source is a College of Engineering schedule keyed to credit-to-program division and residency, not one Aerospace-specific programme amount.
- Temporal applicability: The 2026-27 schedule lists full-time College of Engineering tuition of $33,497 nonresident/$9,854 resident for lower division and $37,612 nonresident/$12,764 resident for upper division, with separate credit-hour bands.
- Known competing evidence: Student residency/status, lower versus upper division, credit load, mandatory fees, and cost-of-attendance components remain separate.
- Risk warning: TUITION/APPLICABILITY - do not choose one international amount or derive a four-year total from division rates; keep fees and cost of attendance separate.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-application_deadline

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `application_deadline`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-UG-INTL-DEADLINE-35
- Source authority: University of Michigan Office of Undergraduate Admissions official international requirements source
- Source URL: <https://admissions.umich.edu/apply/international-applicants/requirements-deadlines>
- Short evidence summary: The 2026-2027 international page lists candidate general dates including Early Decision/Early Action November 1 and Regular Decision February 1, while stating that deadlines vary by school, college, or programme.
- Precise evidence locator: 2026-2027 application-cycle notice; Important Application Steps; Deadlines list; note that deadlines vary by school, college, or programme.
- Programme applicability: The page explicitly names the 2026-2027 application cycle, but it does not establish one Aerospace-specific deadline; the Aerospace department directs applicants to U-M/College of Engineering admissions.
- Temporal applicability: The 2026-2027 international page lists candidate general dates including Early Decision/Early Action November 1 and Regular Decision February 1, while stating that deadlines vary by school, college, or programme.
- Known competing evidence: General U-M first-year, transfer, winter, spring, summer, and College of Engineering processes are competing scope contexts.
- Risk warning: DEADLINE/SCOPE - retain general 2026-27 candidate dates but do not promote them to a single Aerospace programme deadline without college/pathway applicability.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-english_requirement

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `english_requirement`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `FOUND`
- Proposed expected value: For the 2026-2027 international undergraduate application cycle, an applicant who is a speaker of English as a second language must submit a test score demonstrating English proficiency, such as TOEFL, IELTS, or MET, subject to U-M policy and its published score-range rules. No Aerospace-specific numeric threshold is asserted here.
- Source identity: UM-UG-INTL-ENGLISH-35
- Source authority: University of Michigan Office of Undergraduate Admissions official international requirements source
- Source URL: <https://admissions.umich.edu/apply/international-applicants/requirements-deadlines>
- Short evidence summary: The official U-M page states the conditional international-applicant rule and names accepted test pathways; the linked score ranges are kept separate from the conditional requirement.
- Precise evidence locator: 2026-2027 application-cycle Important Application Steps, item 7, and linked General English Proficiency Score Ranges.
- Programme applicability: Target cycle is explicitly 2026-2027 and the policy is central undergraduate international scope, not an Aerospace-specific override.
- Temporal applicability: The official U-M page states the conditional international-applicant rule and names accepted test pathways; the linked score ranges are kept separate from the conditional requirement.
- Known competing evidence: Country-specific transcript rules and College of Engineering admissions are separate; no graduate Rackham or post-admission language rule is inherited.
- Risk warning: LANGUAGE/CENTRAL POLICY - preserve second-language scope and central-policy authority; do not invent an Aerospace-specific score or universalize the condition.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-35-major_admissions_requirement

- Institution: University of Michigan
- Programme: Aerospace Engineering
- Frozen-roster credential: BS
- Field: `major_admissions_requirement`
- Target cycle: `2026-27`
- Audience/scope: undergraduate international; first-year applicants unless a narrower applicant route is explicitly stated; University of Michigan College of Engineering undergraduate Aerospace Engineering; department programme identity with college-level entry/admission scope unless independent review establishes otherwise.
- Proposed expected state: `FOUND`
- Proposed expected value: Students are not admitted directly to the Aerospace Engineering department. They apply to the University of Michigan and the College of Engineering; after acceptance, they may declare Aerospace Engineering as their major. This establishes the programme’s college-entry/major-declaration model, not a complete list of all U-M first-year application requirements.
- Source identity: UM-AERO-ADMISSIONS-35
- Source authority: University of Michigan Aerospace Engineering official undergraduate admissions source
- Source URL: <https://aero.engin.umich.edu/undergraduate/admissions/>
- Short evidence summary: Current department admissions source retrieved 2026-09-01; U-M central requirements and dates are separately recorded as central evidence.
- Precise evidence locator: Admissions section statements on no direct department admission, U-M/College of Engineering application, and post-acceptance major declaration.
- Programme applicability: The statement directly applies to undergraduate Aerospace Engineering and preserves the distinction between university/college admission and later major declaration.
- Temporal applicability: Current department admissions source retrieved 2026-09-01; U-M central requirements and dates are separately recorded as central evidence.
- Known competing evidence: U-M Common Application, international documents, English testing, transfer routes, and graduate/SUGS admissions are separate requirements or pathways.
- Risk warning: ADMISSIONS/STAGE - do not convert later declaration or curriculum requirements into a direct department-entry gate, and do not claim the department page is the complete U-M application checklist.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-programme_identity

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `programme_identity`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: Master of Arts in Applied Economics (MAE), a policy-oriented graduate programme in the University of Michigan LSA Department of Economics; it is distinct from the Department’s Master of Arts in Economics and Ph.D. programme.
- Source identity: UM-MAE-IDENTITY-36
- Source authority: University of Michigan LSA Department of Economics official MAE programme source
- Source URL: <https://lsa.umich.edu/econ/mae.html>
- Short evidence summary: Current MAE programme page retrieved 2026-09-01; no formal lifecycle claim is made.
- Precise evidence locator: MAE page statement that the department offers a Master of Arts degree in Applied Economics and a separate Ph.D.; description of the policy-oriented MAE and distinction from the Economics MA/Ph.D. route.
- Programme applicability: The official department page directly identifies MAE and describes its policy-oriented scope and ordinary one-and-one-half-year completion context.
- Temporal applicability: Current MAE programme page retrieved 2026-09-01; no formal lifecycle claim is made.
- Known competing evidence: The Economics Ph.D., Master of Arts in Economics, dual programmes, and other collaborations are related but separate identities.
- Risk warning: IDENTITY/CREDENTIAL - preserve MAE, LSA Economics ownership, policy-oriented scope, and distinction from the Ph.D. and other economics degrees.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-credential

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `FOUND`
- Proposed expected value: Master of Arts in Applied Economics (MAE).
- Source identity: UM-MAE-CREDENTIAL-36
- Source authority: University of Michigan LSA Department of Economics official MAE programme source
- Source URL: <https://lsa.umich.edu/econ/mae.html>
- Short evidence summary: Current official MAE page retrieved 2026-09-01; the institutional award title is directly named.
- Precise evidence locator: MAE page paragraph identifying “the Master of Arts degree in Applied Economics (MAE)”.
- Programme applicability: The source names the complete institutional degree and abbreviation MAE.
- Temporal applicability: Current official MAE page retrieved 2026-09-01; the institutional award title is directly named.
- Known competing evidence: Master of Arts in Economics, Ph.D., dual degrees, and certificates are not silently normalized into MAE.
- Risk warning: CREDENTIAL - retain the full institutional award and MAE abbreviation; do not reduce it to an unscoped generic economics master’s.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-programme_status

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `programme_status`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-MAE-STATUS-36
- Source authority: University of Michigan LSA Department of Economics official MAE programme source
- Source URL: <https://lsa.umich.edu/econ/mae.html>
- Short evidence summary: A current programme page is present on 2026-09-01, but no formal lifecycle assertion is stated.
- Precise evidence locator: Current MAE programme page and department graduate-programme description.
- Programme applicability: Listing and programme-description evidence establish current page context only, not ACTIVE, SUSPENDED, or DISCONTINUED status.
- Temporal applicability: A current programme page is present on 2026-09-01, but no formal lifecycle assertion is stated.
- Known competing evidence: The application page and FAQ show admissions activity but do not substitute for explicit lifecycle evidence.
- Risk warning: STATUS/LIFECYCLE - do not infer ACTIVE from a current page, annual admissions cycle, or visible programme description.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-tuition

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `tuition`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-MAE-TUITION-36
- Source authority: University of Michigan LSA Department of Economics official MAE admissions FAQ
- Source URL: <https://lsa.umich.edu/econ/mae/mae-application-process/mae-application-faq.html>
- Short evidence summary: The MAE FAQ directs applicants to the Registrar’s Office for tuition rates and separately directs them to financial-aid cost-of-attendance information; it does not state one MAE 2026-27 tuition amount.
- Precise evidence locator: FAQ question “What are your tuition rates?” and separate cost-of-attendance/funding answers.
- Programme applicability: Target cycle is 2026-27; the reviewed MAE source does not itself provide a programme-specific target-cycle billing amount or student-category selection.
- Temporal applicability: The MAE FAQ directs applicants to the Registrar’s Office for tuition rates and separately directs them to financial-aid cost-of-attendance information; it does not state one MAE 2026-27 tuition amount.
- Known competing evidence: Registrar tuition schedules, university fees, cost of attendance, application fees, and the department’s no-funding statement are distinct evidence scopes.
- Risk warning: TUITION/APPLICABILITY - do not manufacture MAE tuition from a generic graduate budget or substitute cost of attendance, fees, or funding information.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-application_deadline

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `application_deadline`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-MAE-DEADLINE-36
- Source authority: University of Michigan LSA Department of Economics official MAE application source
- Source URL: <https://lsa.umich.edu/econ/mae/mae-application-process.html>
- Short evidence summary: The MAE source states Fall-only admission, a January 15 submission deadline, and explicitly gives January 15, 2027 for Fall 2027 admission. The exact mapping to benchmark target 2026-27 is not established.
- Precise evidence locator: MAE application-process overview and “Fall 2027 admission” deadline block; FAQ deadline and fall-only questions.
- Programme applicability: Target cycle is 2026-27, while the current page explicitly labels the dated application as Fall 2027; do not back-project January 15, 2027 to the target cycle.
- Temporal applicability: The MAE source states Fall-only admission, a January 15 submission deadline, and explicitly gives January 15, 2027 for Fall 2027 admission. The exact mapping to benchmark target 2026-27 is not established.
- Known competing evidence: Fall-only admission, the undated recurring January 15 rule, Fall 2027 wording, and Rackham application timing are related but not interchangeable cycle records.
- Risk warning: DEADLINE/TEMPORAL - preserve January 15 and Fall-only candidate evidence while leaving target-cycle/entry-year mapping unresolved.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-english_requirement

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `english_requirement`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-MAE-ENGLISH-36
- Source authority: University of Michigan LSA Department of Economics official MAE application source
- Source URL: <https://lsa.umich.edu/econ/mae/mae-application-process.html>
- Short evidence summary: The MAE sources describe conditional Rackham English proficiency for international applicants, two-year score validity, exemptions, and FAQ candidate minimums of TOEFL iBT 84 and IELTS 6.5. The exact target-cycle policy record is not explicitly versioned as 2026-27.
- Precise evidence locator: English Language Proficiency section and linked Rackham requirements; MAE FAQ questions on international TOEFL/IELTS and score minimums.
- Programme applicability: Current MAE/Rackham policy is available, but the page’s dated application context is Fall 2027; the benchmark target is 2026-27.
- Temporal applicability: The MAE sources describe conditional Rackham English proficiency for international applicants, two-year score validity, exemptions, and FAQ candidate minimums of TOEFL iBT 84 and IELTS 6.5. The exact target-cycle policy record is not explicitly versioned as 2026-27.
- Known competing evidence: Rackham central policy, MAE-specific page wording, score thresholds, ESLPE, and teaching-assistant language rules are separate scopes.
- Risk warning: LANGUAGE/TEMPORAL - retain candidate central-policy and score evidence, but do not promote an unversioned current/Fall-2027 policy to verified 2026-27 truth.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-36-major_admissions_requirement

- Institution: University of Michigan
- Programme: Applied Economics
- Frozen-roster credential: MAE
- Field: `major_admissions_requirement`
- Target cycle: `2026-27`
- Audience/scope: graduate international; programme-specific; University of Michigan LSA Department of Economics Master of Arts in Applied Economics; programme-specific unless independent review establishes a narrower or broader applicable scope.
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UM-MAE-ADMISSIONS-36
- Source authority: University of Michigan LSA Department of Economics official MAE application source
- Source URL: <https://lsa.umich.edu/econ/mae/mae-application-process.html>
- Short evidence summary: Candidate MAE requirements include a bachelor’s-equivalent degree, statement of purpose, personal statement, two recommendations with optional third, official transcripts, resume/CV, and GRE. The source explicitly labels GRE as required for Fall 2027, so the full requirement set is not safely mapped to target 2026-27.
- Precise evidence locator: Supporting-document sections for statement of purpose, personal statement, GRE, recommendations, transcripts/academic records, plus MAE FAQ minimum-degree and preparation questions.
- Programme applicability: Target cycle is 2026-27; current dated source content includes Fall 2027-specific GRE and January 15 language. Stable and cycle-specific requirements must be separated before assigning one canonical record.
- Temporal applicability: Candidate MAE requirements include a bachelor’s-equivalent degree, statement of purpose, personal statement, two recommendations with optional third, official transcripts, resume/CV, and GRE. The source explicitly labels GRE as required for Fall 2027, so the full requirement set is not safely mapped to target 2026-27.
- Known competing evidence: Bachelor equivalency, recommended economics/math preparation, no work-experience requirement, GRE, application documents, and post-admission/dual-degree routes are distinct semantics.
- Risk warning: ADMISSIONS/CYCLE - retain stable candidate components and the Fall-2027-specific GRE branch, but do not promote the combined current record to 2026-27 without cycle evidence.

Human decision:
- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE
