# Phase 3F Human Review Packet - Batch 3

Status: COMPLETE - all human decisions applied  
Batch: 3 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycle: 2026-27  
Prepared: 2026-08-31

This packet presented the next three frozen-roster programmes for independent
human review. Human decisions were applied to the structured ground-truth
records on 2026-08-31. `REVIEWED_CONFIRMED` records preserve their reviewed
semantic states; they are not implicitly `FOUND`. The CBE tuition case was
initially rejected for an inconsistent locator, corrected, and then confirmed
on independent human re-review; that sequence remains in review history.

Allowed decisions, exactly one per case:

- CONFIRM -> REVIEWED_CONFIRMED
- AMBIGUOUS -> REVIEWED_AMBIGUOUS
- NOT_APPLICABLE -> NOT_APPLICABLE
- REJECT -> remains UNREVIEWED and requires a corrected proposal later

The proposed state is a proposal only. A human confirmation accepts the
complete proposed record; it does not force `expected_state=FOUND`. A confirmed
record may legitimately retain `NEEDS_REVIEW` when applicability, lifecycle,
cycle, or identity has not been established.

## Programme 7 - Princeton - Astrophysical Sciences

Frozen-roster credential: AB / A.B.  
Audience: undergraduate international  
Primary source: [Princeton Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences)  
Source identity: roster-v2-row-7-primary  
Supporting source identities: PR-A (undergraduate admissions), PR-F (undergraduate finance)

The official Undergraduate Announcement is explicitly labelled 2026-2027 and
lists Astrophysical Sciences under the A.B. degree. Its departmental
prerequisites and programme requirements should not be silently treated as
first-year admission gates.

### Case GT-V2-07-programme_identity

- Field: programme identity
- Target cycle: 2026-27
- Audience/scope: Princeton undergraduate Astrophysical Sciences major; international applicant context
- Proposed state/value: FOUND - Princeton Astrophysical Sciences A.B. undergraduate programme
- Authority/source: Princeton University Undergraduate Announcement 2026-2027; [Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences)
- Evidence/locator: Page heading “Astrophysical Sciences”; Program Offerings section, “A.B.”; opening programme description.
- Programme applicability: The page is the departmental major page under “Departmental Majors, Degree of Bachelor of Arts.”
- Temporal applicability: Source explicitly labels the Undergraduate Announcement 2026-2027; published date is not separately stated.
- Known competing evidence: None identified for the named undergraduate Astrophysical Sciences A.B. programme.
- Human decision: CONFIRM

### Case GT-V2-07-credential

- Field: credential
- Target cycle: 2026-27
- Audience/scope: Princeton Astrophysical Sciences undergraduate major
- Proposed state/value: FOUND - A.B. / Bachelor of Arts
- Authority/source: Princeton University Undergraduate Announcement; [Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences)
- Evidence/locator: Program Offerings section, “A.B.”, under the Undergraduate Announcement’s Bachelor of Arts departmental-major hierarchy.
- Programme applicability: The credential is attached to the named Astrophysical Sciences major, not to a graduate or engineering programme.
- Temporal applicability: 2026-2027 announcement context; publication date not separately stated.
- Known competing evidence: The page does not list an Astrophysical Sciences B.S.E. or graduate credential.
- Human decision: CONFIRM

### Case GT-V2-07-programme_status

- Field: programme status
- Target cycle: 2026-27
- Audience/scope: Current Princeton Astrophysical Sciences undergraduate major
- Proposed state/value: NEEDS_REVIEW - current 2026-2027 catalogue listing is an ACTIVE candidate, but no explicit lifecycle ACTIVE assertion was located
- Authority/source: Princeton University Undergraduate Announcement; [Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences)
- Evidence/locator: Undergraduate Announcement 2026-2027 header; current programme heading and programme-offering sections.
- Programme applicability: A current catalogue entry establishes listing context, not necessarily a formal ACTIVE lifecycle state.
- Temporal applicability: Source cycle is explicitly 2026-2027; effective lifecycle date is not stated.
- Known competing evidence: No discontinuation or suspension evidence was identified during preparation; absence of such evidence is not proof of ACTIVE.
- Warning: HISTORICAL/CURRENT distinction; do not upgrade catalogue presence to lifecycle truth without policy support.
- Human decision: CONFIRM

### Case GT-V2-07-tuition

- Field: tuition
- Target cycle: 2026-27
- Audience/scope: Princeton undergraduate student; institution-wide undergraduate tuition, domestic/international scope to be confirmed
- Proposed state/value: FOUND - USD 68,140 tuition for the 2026-27 academic year
- Authority/source: Princeton University Undergraduate Announcement, Admission, Financial Aid, Fees; [Admission, Financial Aid, Fees](https://ua.princeton.edu/policies-resources/admission-financial-aid-fees)
- Evidence/locator: Fees and Expenses section, “Tuition for the 2026-27 academic year: Tuition $68,140.”
- Programme applicability: Institution-wide undergraduate tuition; confirm that Astrophysical Sciences does not have a separate programme rate. This is tuition, not total cost of attendance.
- Temporal applicability: Source explicitly states 2026-27; published/effective date beyond the academic-year label is not stated.
- Known competing evidence: The same source lists separate housing, food, and other charges; those are not competing tuition values.
- Warning: HIGH RISK - keep tuition separate from fees, housing, food, and financial aid.
- Human decision: CONFIRM

### Case GT-V2-07-application_deadline

- Field: application deadline/intake
- Target cycle: 2026-27
- Audience/scope: Princeton first-year undergraduate applicant; international applicants use the same first-year application timeline subject to applicable testing/documents
- Proposed state/value: NEEDS_REVIEW - Single-Choice Early Action Nov. 1; Regular Decision Jan. 1; exact target-cycle mapping is not explicit on the current page
- Authority/source: Princeton Admission; [Application Dates & Deadlines](https://admission.princeton.edu/apply/first-year-application-dates-deadlines)
- Evidence/locator: Single-Choice Early Action and Regular Decision timeline rows; application due dates Nov. 1 and Jan. 1.
- Programme applicability: Princeton first-year applicants apply to the university; the Astrophysical Sciences page does not establish a separate departmental application deadline.
- Temporal applicability: Target cycle 2026-27; page gives recurring/current dates but does not label the reviewed excerpt with an academic entry year or publication date.
- Known competing evidence: No Astrophysical Sciences-specific deadline was located. Do not infer a departmental deadline from the general first-year dates without cycle confirmation.
- Warning: HIGH RISK - current dates must not be silently relabelled as 2026-27 truth.
- Human decision: CONFIRM

### Case GT-V2-07-english_requirement

- Field: English-language requirement
- Target cycle: 2026-27
- Audience/scope: Princeton undergraduate international applicant
- Proposed state/value: FOUND - If English is not the applicant’s native language and secondary school instruction is not in English, TOEFL, IELTS Academic, DET, or PTE Academic is required; stated exemptions apply
- Authority/source: Princeton Admission; [International Students](https://admission.princeton.edu/apply/international-students)
- Evidence/locator: English-language testing paragraph describing the conditional test requirement and exemptions after three years of English-medium secondary school.
- Programme applicability: Central first-year international admissions requirement applicable to an Astrophysical Sciences applicant; not a departmental English threshold.
- Temporal applicability: Current admissions guidance for the benchmark’s 2026-27 context; page does not separately state publication/effective date.
- Known competing evidence: Testing may be affected by the applicant’s language and school-instruction history; the rule is conditional, not a universal requirement for every applicant.
- Warning: Preserve the conditional scope and exemptions; do not flatten to universally REQUIRED or NOT_REQUIRED.
- Human decision: CONFIRM

### Case GT-V2-07-major_admissions_requirement

- Field: major admissions requirement
- Target cycle: 2026-27
- Audience/scope: Programme-specific first-year admission gate versus post-entry Astrophysical Sciences major requirements
- Proposed state/value: NEEDS_REVIEW - departmental prerequisites are listed (MAT 103/104/201/202 or equivalent; PHY 103/105, 104/106, 207; AST 204), but their status as pre-admission gates is not established
- Authority/source: Princeton Undergraduate Announcement; [Astrophysical Sciences](https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts/astrophysical-sciences); central first-year admissions page
- Evidence/locator: Astrophysical Sciences “Prerequisites” section and “Program of Study / Requirements”; central first-year application process.
- Programme applicability: The departmental page describes major preparation and completion requirements; it does not explicitly say applicants must satisfy them before university admission.
- Temporal applicability: 2026-2027 announcement context; admission-cycle applicability remains unresolved.
- Known competing evidence: The same page calls these prerequisites while central admissions is university-level; this may be a post-enrollment major requirement rather than a first-year admission gate.
- Warning: HIGH RISK - do not score departmental coursework prerequisites as direct admission requirements without scope policy confirmation.
- Human decision: CONFIRM

## Programme 8 - Princeton - Computer Science

Frozen-roster credential: MSE / M.S.E.  
Audience: graduate international  
Primary source: [Princeton Computer Science field](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)  
Source identity: roster-v2-row-8-primary  
Supporting source identities: PR-G (graduate admissions), PR-F (graduate rates/funding), PR-PDF (graduate application requirements; supporting locator retained from frozen roster)

The current official field page is explicitly labelled Academic Year 2026-2027
and offers Ph.D. and M.S.E. The earlier v1 primary locator returned HTTP 403;
that transport observation is retained as an adversarial benchmark condition,
not as human truth. The current official page is the proposed evidence source.

### Case GT-V2-08-programme_identity

- Field: programme identity
- Target cycle: 2026-27
- Audience/scope: Princeton Computer Science graduate programme, M.S.E. track
- Proposed state/value: FOUND - Princeton Computer Science M.S.E. graduate programme
- Authority/source: Princeton Graduate School; [Computer Science](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)
- Evidence/locator: Page heading “Computer Science”; Academic Year 2026-2027; Program Offerings section listing Ph.D. and M.S.E.; overview describing the department’s graduate degree programmes.
- Programme applicability: The proposed entity is the M.S.E. offering, not the separate Ph.D. or switchable M.Eng. track.
- Temporal applicability: Source explicitly states Academic Year 2026-2027; page publication date not separately stated.
- Known competing evidence: The page also describes a possible later switch to M.Eng.; that does not change the frozen M.S.E. programme identity.
- Warning: ADVERSARIAL transport history - prior v1 403 must not be treated as absence or as evidence of programme discontinuation.
- Human decision: CONFIRM

### Case GT-V2-08-credential

- Field: credential
- Target cycle: 2026-27
- Audience/scope: Princeton Computer Science graduate M.S.E. programme
- Proposed state/value: FOUND - M.S.E. / Master of Science in Engineering
- Authority/source: Princeton Graduate School; [Computer Science](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)
- Evidence/locator: Program Offerings section, “M.S.E.”; Overview stating that the department leads study toward the Master of Science in Engineering and Doctor of Philosophy.
- Programme applicability: The credential is the named M.S.E. offering; Ph.D. and later M.Eng. descriptions are separate tracks.
- Temporal applicability: Academic Year 2026-2027 context; publication date not separately stated.
- Known competing evidence: The page discusses M.Eng. as a possible switch from the M.S.E. track, but the frozen benchmark credential remains M.S.E.
- Human decision: CONFIRM

### Case GT-V2-08-programme_status

- Field: programme status
- Target cycle: 2026-27
- Audience/scope: Current Princeton Computer Science M.S.E. programme
- Proposed state/value: NEEDS_REVIEW - current Academic Year 2026-2027 field page and M.S.E. offering are an ACTIVE candidate, but no explicit lifecycle ACTIVE assertion was located
- Authority/source: Princeton Graduate School; [Computer Science](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)
- Evidence/locator: Academic Year 2026-2027 header and Program Offerings section; M.S.E. programme description.
- Programme applicability: A current field page and offering establish a current listing, not necessarily a formal lifecycle state.
- Temporal applicability: Source cycle explicitly 2026-2027; lifecycle effective date not stated.
- Known competing evidence: The page’s discussion of a possible M.Eng. switch is an offering-path detail, not evidence that the M.S.E. is inactive.
- Warning: HISTORICAL/CURRENT distinction.
- Human decision: CONFIRM

### Case GT-V2-08-tuition

- Field: tuition
- Target cycle: 2026-27
- Audience/scope: Princeton regular graduate degree-seeking student; Computer Science M.S.E. applicability to confirm separately from funding
- Proposed state/value: FOUND - USD 65,210 regular graduate tuition for 2026-27, excluding the separately listed SHP fee
- Authority/source: Princeton Graduate School; [Funding Calendar, University Rates & Costs](https://gradschool.princeton.edu/financial-support/financial-support-model/funding-calendar-university-rates-costs)
- Evidence/locator: “University Rates & Costs: 2026-27,” Tuition & Fees table, Regular/Visiting/Trailing Degree-Seeking Students, “Tuition - Regular Rate” 65,210.
- Programme applicability: Regular graduate rate is proposed for the M.S.E.; Computer Science also states full financial support through teaching assistantships, which is funding rather than a different tuition rate.
- Temporal applicability: Source explicitly labels 2026-27; source does not state a separate programme-specific tuition amount.
- Known competing evidence: [Master’s Degree Funding](https://gradschool.princeton.edu/financial-support/financial-support-model/master%E2%80%99s-degree-funding) says Computer Science M.S.E. students receive full financial support through teaching assistantships. Confirm whether benchmark tuition means billed rate, net cost, or both as separate fields.
- Warning: HIGH RISK - do not conflate tuition with funding or SHP fee.
- Human decision: CONFIRM

### Case GT-V2-08-application_deadline

- Field: application deadline/intake
- Target cycle: 2026-27
- Audience/scope: Princeton Computer Science M.S.E. graduate applicant
- Proposed state/value: NEEDS_REVIEW - December 15, 11:59 p.m. Eastern Standard Time; page states this is for enrollment beginning in fall 2026, while benchmark target cycle is 2026-27
- Authority/source: Princeton Graduate School; [Computer Science](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)
- Evidence/locator: Apply section, Application deadline, “December 15, 11:59 p.m. Eastern Standard Time”; parenthetical says applications for enrollment beginning in fall 2026.
- Programme applicability: Explicitly programme-specific for the Computer Science graduate field and M.S.E. offering.
- Temporal applicability: Source academic year 2026-2027 and fall-2026 enrollment wording do not automatically establish the benchmark’s intended 2026-27 target-cycle convention.
- Known competing evidence: Princeton’s general graduate deadline guidance directs applicants to department-specific field pages; no separate M.S.E. deadline was identified.
- Warning: HIGH RISK - preserve source-cycle wording; do not silently relabel the date as a 2026-27 deadline.
- Human decision: CONFIRM

### Case GT-V2-08-english_requirement

- Field: English-language requirement
- Target cycle: 2026-27
- Audience/scope: Princeton Computer Science M.S.E. graduate international applicant
- Proposed state/value: FOUND - if English scores are required, M.S.E. admission requires TOEFL speaking at least 28 or IELTS 8; TWE and Duolingo are not accepted; Graduate School exemptions/validity rules also apply
- Authority/source: Princeton Computer Science field page; [English Proficiency](https://gradschool.princeton.edu/admission-onboarding/prepare/english-proficiency)
- Evidence/locator: Computer Science “Additional departmental requirements,” M.S.E. applicants only, English score thresholds and excluded tests; Graduate School “Who Needs to Submit Scores” and “Exemptions from Testing.”
- Programme applicability: Computer Science M.S.E.-specific threshold is narrower than the general Graduate School policy; preserve both layers.
- Temporal applicability: Computer Science source is Academic Year 2026-2027; English-score validity rule references Fall 2026 admissions; exact benchmark cycle mapping should be confirmed.
- Known competing evidence: Graduate School says it has no universal minimum score and directs applicants to department-specific requirements; this is complementary, not a value conflict.
- Warning: Preserve conditional submission, exemptions, and programme-specific threshold; do not flatten to a single universal score.
- Human decision: CONFIRM

### Case GT-V2-08-major_admissions_requirement

- Field: major admissions requirement
- Target cycle: 2026-27
- Audience/scope: Princeton Computer Science M.S.E. programme-specific graduate admission requirements
- Proposed state/value: FOUND - M.S.E. applicants select up to two research interests, submit required supplemental essays, select 4-8 Princeton undergraduate courses they could TA, and meet the stated department requirements
- Authority/source: Princeton Graduate School; [Computer Science](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/computer-science)
- Evidence/locator: Additional departmental requirements section: research interests, M.S.E. supplemental essays, TA-course selection, and programme-specific English threshold.
- Programme applicability: Requirements are explicitly attached to the Computer Science graduate field and distinguish M.S.E. from Ph.D. applicants.
- Temporal applicability: Academic Year 2026-2027 context; publication date not separately stated.
- Known competing evidence: The page’s later M.S.E. course/thesis requirements describe progression/completion rather than application gates; do not mix them into this field unless policy says so.
- Warning: Keep application requirements separate from post-admission degree requirements.
- Human decision: CONFIRM

## Programme 9 - Princeton - Chemical and Biological Engineering

Frozen-roster credential: BSE  
Audience: domestic + international  
Primary source: [Princeton CBE field](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering)  
Source identity: roster-v2-row-9-primary  
Supporting source identities: PR-A (undergraduate admissions), PR-G (graduate admissions), PR-F (finance)

This is an intentional high-risk identity and credential case. The frozen
roster says Chemical and Biological Engineering / BSE, but the current official
Graduate School field page is for graduate study and lists Ph.D., M.S.E., and
M.Eng.; it does not list a B.S.E. The proposal therefore preserves unresolved
identity/applicability rather than normalizing the roster or borrowing graduate
truth for an undergraduate entity. The earlier v1 primary locator returned
HTTP 403; that is a transport observation, not human truth.

### Case GT-V2-09-programme_identity

- Field: programme identity
- Target cycle: 2026-27
- Audience/scope: Frozen roster Chemical and Biological Engineering / BSE; current primary evidence is a Princeton graduate field page
- Proposed state/value: NEEDS_REVIEW - official page identifies Princeton Chemical and Biological Engineering graduate programmes, but does not establish the frozen BSE identity
- Authority/source: Princeton Graduate School; [Chemical and Biological Engineering](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering)
- Evidence/locator: Page heading; Academic Year 2026-2027; Program Offerings section listing Ph.D., M.S.E., and M.Eng.; Overview describing graduate programmes.
- Programme applicability: The source is department-level graduate evidence, while the frozen roster credential is undergraduate BSE. The identity cannot be safely resolved from this page alone.
- Temporal applicability: Source explicitly states Academic Year 2026-2027; applicability to an undergraduate 2026-27 BSE remains unestablished.
- Known competing evidence: Frozen roster says BSE; Princeton undergraduate admissions and B.S.E. programme sources would be required to establish that entity.
- Warning: CRITICAL IDENTITY MISMATCH - do not normalize, merge, or create canonical BSE identity from graduate evidence.
- Human decision: CONFIRM

### Case GT-V2-09-credential

- Field: credential
- Target cycle: 2026-27
- Audience/scope: Frozen roster Chemical and Biological Engineering / BSE
- Proposed state/value: NEEDS_REVIEW - current CBE source offers Ph.D., M.S.E., and M.Eng.; no B.S.E. is shown
- Authority/source: Princeton Graduate School; [Chemical and Biological Engineering](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering)
- Evidence/locator: Program Offerings section, listing Ph.D., M.S.E., and M.Eng.; Overview calls the offerings graduate programmes.
- Programme applicability: The source does not establish an undergraduate B.S.E. credential for the frozen benchmark row.
- Temporal applicability: Academic Year 2026-2027 is explicit for the graduate page; B.S.E. cycle applicability is unknown.
- Known competing evidence: Frozen roster credential is BSE; undergraduate Princeton sources are needed before selecting B.S.E. as expected truth.
- Warning: Do not transform graduate M.S.E./M.Eng. or Ph.D. evidence into B.S.E. truth.
- Human decision: CONFIRM

### Case GT-V2-09-programme_status

- Field: programme status
- Target cycle: 2026-27
- Audience/scope: Frozen roster Chemical and Biological Engineering / BSE
- Proposed state/value: NEEDS_REVIEW - current CBE graduate field is listed for Academic Year 2026-2027, but lifecycle status for the frozen undergraduate BSE identity is unresolved
- Authority/source: Princeton Graduate School; [Chemical and Biological Engineering](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering)
- Evidence/locator: Academic Year 2026-2027 header, current page heading, and graduate Program Offerings section.
- Programme applicability: Current graduate listing cannot prove ACTIVE, SUSPENDED, or DISCONTINUED for a separate undergraduate BSE entity.
- Temporal applicability: Graduate source cycle is 2026-2027; frozen BSE applicability is not established.
- Known competing evidence: The absence of BSE from the graduate page is an identity/applicability signal, not by itself proof that a Princeton undergraduate programme is discontinued.
- Warning: Do not use a current graduate listing or omission to assign lifecycle truth to the roster’s BSE.
- Human decision: CONFIRM

### Case GT-V2-09-tuition

- Field: tuition
- Target cycle: 2026-27
- Audience/scope: Frozen roster BSE with domestic + international audience; undergraduate versus graduate applicability unresolved
- Proposed state/value: NEEDS_REVIEW - Princeton undergraduate tuition is USD 68,140 for 2026-27, while regular graduate tuition is USD 65,210; neither can be assigned to the frozen BSE without identity evidence
- Authority/source: [Undergraduate Admission, Financial Aid, Fees](https://ua.princeton.edu/policies-resources/admission-financial-aid-fees); [Graduate University Rates & Costs](https://gradschool.princeton.edu/financial-support/financial-support-model/funding-calendar-university-rates-costs)
- Evidence/locator: Undergraduate source, Tuition for 2026-27, $68,140; graduate source, University Rates & Costs 2026-27, Regular Tuition $65,210.
- Programme applicability: The two amounts belong to different educational scopes. The frozen BSE identity is not established by the current primary graduate page.
- Temporal applicability: Both source cycles are explicitly 2026-27; target programme scope remains unresolved.
- Known competing evidence: Undergraduate and graduate rates are scope-different, not automatically a material conflict. Do not select one by amount or source order.
- Warning: HIGH RISK - classify as applicability/identity review, not successful extraction of either rate.
- Human decision: CONFIRM (corrected proposal; original proposal was REJECT)

### Case GT-V2-09-application_deadline

- Field: application deadline/intake
- Target cycle: 2026-27
- Audience/scope: Frozen roster BSE; undergraduate first-year versus graduate CBE applicant scope unresolved
- Proposed state/value: NEEDS_REVIEW - CBE graduate page gives December 1, 11:59 p.m. Eastern Standard Time for enrollment beginning fall 2026, but that cannot be assigned to a BSE applicant
- Authority/source: Princeton Graduate School; [Chemical and Biological Engineering](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering)
- Evidence/locator: Apply section, Application deadline, December 1, 11:59 p.m. Eastern Standard Time; parenthetical states enrollment beginning in fall 2026.
- Programme applicability: The date is explicitly attached to the graduate CBE field, not to a demonstrated undergraduate BSE programme.
- Temporal applicability: Source says Academic Year 2026-2027 and fall-2026 enrollment; benchmark BSE applicability is not established.
- Known competing evidence: Princeton first-year undergraduate dates are Nov. 1 and Jan. 1 on the central admissions page. These are scope-different until the identity is resolved.
- Warning: CRITICAL TEMPORAL/SCOPE RISK - do not copy the graduate deadline to the frozen undergraduate row.
- Human decision: CONFIRM

### Case GT-V2-09-english_requirement

- Field: English-language requirement
- Target cycle: 2026-27
- Audience/scope: Frozen roster domestic + international; undergraduate BSE versus graduate CBE applicability unresolved
- Proposed state/value: NEEDS_REVIEW - undergraduate international applicants have conditional TOEFL/IELTS/DET/PTE rules, while the graduate page invokes Graduate School English policy; no single rule is applicable to the unresolved BSE identity
- Authority/source: [Princeton Undergraduate International Students](https://admission.princeton.edu/apply/international-students); [Princeton Graduate English Proficiency](https://gradschool.princeton.edu/admission-onboarding/prepare/english-proficiency)
- Evidence/locator: Undergraduate source, English testing paragraph and exemptions; graduate source, “Who Needs to Submit Scores,” accepted tests, exemptions, and department-specific requirements.
- Programme applicability: The two policies apply to different admissions populations. The current primary evidence is graduate, while the frozen roster is BSE.
- Temporal applicability: Both are current policy sources for the 2026-27 review context; exact programme-cycle applicability is unresolved.
- Known competing evidence: Graduate and undergraduate rules differ in accepted tests, exemptions, and departmental thresholds; this is a scope distinction, not a contradiction to collapse.
- Warning: HIGH RISK - do not inherit graduate English requirements into an undergraduate BSE or use the undergraduate rule to resolve the identity.
- Human decision: CONFIRM

### Case GT-V2-09-major_admissions_requirement

- Field: major admissions requirement
- Target cycle: 2026-27
- Audience/scope: Frozen roster Chemical and Biological Engineering BSE; programme-specific undergraduate admission gate versus graduate CBE requirements
- Proposed state/value: NEEDS_REVIEW - current source gives graduate-only requirements (Ph.D. faculty selection; M.S.E. employer/fellowship support; M.Eng. external financial support), not a BSE admission gate
- Authority/source: [Princeton CBE Graduate field](https://gradschool.princeton.edu/academics/degrees-requirements/fields-study/chemical-and-biological-engineering); Princeton undergraduate admissions entry point
- Evidence/locator: CBE Program Offerings and Additional departmental requirements sections; undergraduate first-year application process is central rather than CBE-specific.
- Programme applicability: Graduate requirements cannot establish requirements for the frozen BSE. A BSE-specific undergraduate source is needed before classifying major admission requirements.
- Temporal applicability: Graduate source is Academic Year 2026-2027; BSE target-cycle applicability remains unresolved.
- Known competing evidence: The graduate page’s support rules are not undergraduate admissions requirements. Do not mark them NOT_REQUIRED for the BSE merely because they are absent.
- Warning: CRITICAL SCOPE/IDENTITY RISK - absence from the wrong degree-level source is not NOT_REQUIRED.
- Human decision: CONFIRM

## Reviewer notes and completion

- Batch 1 remains frozen and unchanged.
- Batch 2 was completed separately; no Batch 2 decisions are requested here.
- Batch 3 human decisions were applied on 2026-08-31.
- Human tally: `CONFIRM` 21; `AMBIGUOUS` 0; `NOT_APPLICABLE` 0; `REJECT` 0 final (one original proposal rejection was corrected and re-reviewed).
- Structured result: `REVIEWED_CONFIRMED` 21; `REVIEWED_AMBIGUOUS` 0; `UNREVIEWED` 0.
- `GT-V2-09-tuition` is confirmed as `NEEDS_REVIEW` with a null expected value. Its original REJECT and corrected CONFIRM remain in [Batch 3 correction 1](2026-08-30-phase-3f-human-review-batch-3-correction-1.md).
- Confirmed records preserve their proposed semantic states. Confirmation does not imply `FOUND` or verified current truth.
- Batch 1 and Batch 2 remain frozen and unchanged.
- Scoring has not started.
