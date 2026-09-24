# Phase 3F Human Review Packet - Batch 7

Status: CLOSED - correction re-review applied  
Batch: 7 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycles: 2025-26 (row 19); 2026-27 (rows 20-21)  
Prepared: 2026-08-31  

Initial human review result: 17 CONFIRM, 0 AMBIGUOUS, 4 REJECT, 0 NOT_APPLICABLE.
Correction re-review result: 4 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.
Batch 7 is now closed; the original rejections and corrected confirmations
remain auditable in the structured ground-truth artifact.

This packet covers the next three programmes in the frozen v2 roster: UCLA rows
19-21. The proposals below were prepared from independent official source
evidence and do not use v3 pipeline output. Human confirmation accepts the
complete proposed record; it does not force `expected_state` to `FOUND`.

For every case, review the source scope, audience, cycle, applicability, and
evidence locator together. A source date without an explicit target-cycle match
must remain `NEEDS_REVIEW`, not a manufactured current value. Do not treat lack
of response as confirmation.

## Recorded human decisions

The independent decisions recorded in the structured ground-truth artifact are:

| Programme | Initial confirm | Initial reject | Correction confirm | Final confirmed |
|---|---:|---:|---:|---:|
| Public Affairs / BA | 5 | 2 | 2 | 7 |
| Biostatistics / MPH | 5 | 2 | 2 | 7 |
| Computer Science / MS | 7 | 0 | 0 | 7 |
| **Total** | **17** | **4** | **4** | **21** |

The four corrected cases are now `REVIEWED_CONFIRMED` in the structured
artifact. Their correction packet is in
`docs/benchmarks/2026-08-31-phase-3f-human-review-batch-7-correction-1.md`.

## Programme 19 - UCLA - Public Affairs

Institution: UCLA  
Programme: Public Affairs  
Credential: BA  
Target cycle: 2025-26  
Audience/scope: undergraduate international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-19-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `UCLA B.A. in Public Affairs pre-major/major within the Luskin School of Public Affairs`
- Source identity: UCLA Luskin Public Affairs prospective students
- Source authority: UCLA official Luskin School of Public Affairs
- Source URL: <https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/>
- Evidence: High-school applicants select Public Affairs as a pre-major preference; the pre-major is housed in the College of Letters and Science.
- Evidence locator: `Prospective Freshman Applicants` section.
- Programme applicability: The source describes the UCLA Public Affairs first-year pre-major/major pathway; later major admission is a separate stage.
- Temporal applicability: Target `2025-26`; current official Luskin page, but its exact 2025-26 edition is not stated.
- Known competing evidence: Transfer admission rules and later Luskin major admission are distinct from freshman pre-major selection.
- Risk warning: IDENTITY/STAGE - preserve the BA/pre-major pathway and do not create a second identity for later major declaration.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `BA / Bachelor of Arts in Public Affairs`
- Source identity: UCLA Luskin B.A. in Public Affairs
- Source authority: UCLA official Luskin School of Public Affairs
- Source URL: <https://luskin.ucla.edu/academic/major-public-affairs/>
- Evidence: The page heading and programme description identify the B.A. in Public Affairs and direct prospective applicants to the BA pathway.
- Evidence locator: Page heading and programme description.
- Programme applicability: Undergraduate Public Affairs BA; do not substitute graduate public-affairs credentials or a later major-declaration state.
- Temporal applicability: Target `2025-26`; current official Luskin programme page, exact 2025-26 page edition not stated.
- Known competing evidence: UCLA College admission/pre-major status is separate from the final major declaration.
- Risk warning: CREDENTIAL SCOPE - keep the undergraduate BA separate from graduate credentials and programme-stage status.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Luskin B.A. in Public Affairs
- Source authority: UCLA official Luskin School of Public Affairs
- Source URL: <https://luskin.ucla.edu/academic/major-public-affairs/>
- Evidence: The current programme page and curriculum/policy material are present, but no explicit lifecycle `ACTIVE` assertion appears.
- Evidence locator: Current programme page and curriculum/policy material.
- Programme applicability: Listing presence is relevant to the Public Affairs BA but is not a lifecycle assertion.
- Temporal applicability: Target `2025-26`; lifecycle effective date is not stated.
- Known competing evidence: Page presence alone does not establish `ACTIVE`, `SUSPENDED`, or `DISCONTINUED`.
- Risk warning: STATUS - do not infer lifecycle from a current programme page.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA General Catalog 2025-26 - Fees and Payment
- Source authority: UCLA official Registrar's Office
- Source URL: <https://registrar.ucla.edu/media/523>
- Evidence: Regular undergraduates do not pay per-unit tuition; nonresidents pay nonresident supplemental tuition in addition to registration fees.
- Evidence locator: `2025-26 General Catalog`, `Fees and Payment` section.
- Programme applicability: The source provides university fee structure, not one programme-specific Public Affairs amount for this benchmark record.
- Temporal applicability: Target and source cycle `2025-26`.
- Known competing evidence: University fees, nonresident supplemental tuition, residence classification, and cost of attendance are separate concepts.
- Risk warning: FINANCE/APPLICABILITY - do not conflate tuition, fees, nonresident supplemental tuition, residency, or cost of attendance.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Undergraduate Admission application dates
- Source authority: UCLA official Undergraduate Admission
- Source URL: <https://admission.ucla.edu/apply>
- Evidence: UC applications open August 1, are accepted October 1-November 30, and have a November 30 submission deadline.
- Evidence locator: `Application` and `Important Dates` sections.
- Programme applicability: The central schedule may govern first-year UC submission, but Public Affairs pre-major and later major-application timing are distinct.
- Temporal applicability: Target `2025-26`; the current central schedule is not explicitly labelled as that benchmark entry cycle in the reviewed excerpt. Source entry cycle remains unresolved.
- Known competing evidence: Transfer deadlines and later Public Affairs major declaration deadlines are different stages.
- Risk warning: CYCLE/STAGE - do not assign the central date as programme truth without target-cycle applicability.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `International undergraduate applicants with fewer than three years of secondary instruction in English must demonstrate proficiency through UCLA-accepted TOEFL, IELTS, or Duolingo evidence, subject to the stated conditions and exemptions.`
- Source identity: UCLA International Applicants - Language Requirements
- Source authority: UCLA official Undergraduate Admission
- Source URL: <https://admission.ucla.edu/apply/international-applicants>
- Evidence: Fewer than three years of secondary instruction in English requires proficiency evidence; TOEFL, IELTS, or Duolingo are accepted under the stated policy scores and conditions.
- Evidence locator: `Language Requirements for International Students` section.
- Programme applicability: Conditional international undergraduate policy; preserve instruction-language, applicant, test, and exemption conditions.
- Temporal applicability: Target `2025-26`; current official policy, exact 2025-26 page edition not stated.
- Known competing evidence: Applicants completing all secondary education in English are treated as proficient; this is not a universal domestic-applicant requirement.
- Risk warning: APPLICABILITY - do not flatten a conditional policy into universal `REQUIRED` or `NOT_REQUIRED`.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-19-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Luskin Public Affairs prospective-student admissions
- Source authority: UCLA official Luskin School of Public Affairs
- Source URL: <https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/>
- Evidence: Freshmen apply to UCLA selecting Public Affairs as a pre-major preference; admitted freshmen apply to the major no later than winter quarter of the second year.
- Evidence locator: `Prospective Freshman Applicants` section.
- Programme applicability: The source establishes pre-major selection and later major declaration, not one complete first-year Public Affairs admission gate set.
- Temporal applicability: Target `2025-26`; first-year versus later-major timing is explicit, but exact target-cycle edition is not.
- Known competing evidence: Transfer preparation and GPA rules are separately scoped and cannot be silently generalized to freshmen.
- Risk warning: ADMISSIONS-STAGE - do not turn later declaration or transfer preparation into universal first-year requirements.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 20 - UCLA - Biostatistics / MPH

Institution: UCLA  
Programme: Biostatistics  
Credential: MPH  
Target cycle: 2026-27  
Audience/scope: graduate international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-20-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `UCLA Master of Public Health in Biostatistics (Biostatistics)`
- Source identity: UCLA Graduate Major in Biostatistics MPH
- Source authority: UCLA official Graduate Education / Fielding School of Public Health
- Source URL: <https://grad.ucla.edu/gasaa/deptinfo/deptinfo.asp?academicyear=20262027&code=00HW>
- Evidence: Program Name and Website sections identify Biostatistics MPH (Biostatistics), major code 00HW, in the Fielding School of Public Health.
- Evidence locator: `Program Name`, `Website`, and major-code fields.
- Programme applicability: The named Biostatistics MPH; keep Executive MPH, MPH-HP, MS, PhD, and joint-degree variants separate.
- Temporal applicability: Target and source cycle `2026-27` / UCLA 2026-2027 graduate major admissions page.
- Known competing evidence: Other public-health degrees and articulated/concurrent pathways are separate identities.
- Risk warning: IDENTITY/PATHWAY - do not merge adjacent MPH, MS, PhD, or joint-degree variants.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `MPH / Master of Public Health in Biostatistics`
- Source identity: UCLA Graduate Major in Biostatistics MPH
- Source authority: UCLA official Graduate Education / Fielding School of Public Health
- Source URL: <https://grad.ucla.edu/gasaa/deptinfo/deptinfo.asp?academicyear=20262027&code=00HW>
- Evidence: The `Leading to the degree of` section identifies M.P.H.; the programme name is Biostatistics MPH.
- Evidence locator: `Leading to the degree of` and programme-name fields.
- Programme applicability: MPH in Biostatistics; do not substitute other department degrees or articulated/concurrent credentials.
- Temporal applicability: Target and source cycle `2026-27` / UCLA 2026-2027 graduate major admissions page.
- Known competing evidence: The department also offers other degree and pathway variants.
- Risk warning: CREDENTIAL SCOPE - preserve MPH and Biostatistics concentration identity.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Graduate Major in Biostatistics MPH
- Source authority: UCLA official Graduate Education / Fielding School of Public Health
- Source URL: <https://grad.ucla.edu/gasaa/deptinfo/deptinfo.asp?academicyear=20262027&code=00HW>
- Evidence: The current 2026-2027 admissions listing is present, but no explicit lifecycle `ACTIVE` assertion appears.
- Evidence locator: Current 2026-2027 admissions listing and programme fields.
- Programme applicability: Listing is for Biostatistics MPH, but listing presence is not lifecycle proof.
- Temporal applicability: Target `2026-27`; lifecycle effective date is not stated.
- Known competing evidence: Separate Executive MPH and MPH-HP pages cannot establish this programme's lifecycle.
- Risk warning: STATUS - do not infer `ACTIVE` or `DISCONTINUED` from admissions-page presence.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Financial Aid 2026-27 Graduate Cost of Attendance
- Source authority: UCLA official Financial Aid and Scholarships
- Source URL: <https://financialaid.ucla.edu/go/coa>
- Evidence: 2026-27 graduate budgets list university fees and nonresident supplemental tuition separately from housing, food, books, transportation, personal costs, and health insurance.
- Evidence locator: `2026-27 Graduate Student Budgets`.
- Programme applicability: This is an estimate, not a Biostatistics MPH billing statement; professional-degree charges may differ.
- Temporal applicability: Target and source cycle `2026-27`; final fees may change.
- Known competing evidence: The benchmark must separate tuition, NRST, campus fees, health insurance, and cost of attendance.
- Risk warning: FINANCE/PROGRAMME-FEE - do not promote a generic graduate budget or NRST line as complete programme tuition.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-application_deadline

- Field: `application_deadline`
- Proposed expected state: `FOUND`
- Proposed expected value: `December 1, 2026 application deadline for Biostatistics MPH; late applications have reduced admission and financial-aid opportunities.`
- Source identity: UCLA 2026-2027 Biostatistics MPH admissions requirements
- Source authority: UCLA official Graduate Education / Fielding School of Public Health
- Source URL: <https://grad.ucla.edu/gasaa/deptinfo/deptinfo.asp?academicyear=20262027&code=00HW>
- Evidence: The `Deadlines to apply` section states December 1, 2026; later applications have reduced opportunities for admission and financial aid.
- Evidence locator: `Deadlines to apply` section.
- Programme applicability: Programme-specific Biostatistics MPH admissions deadline.
- Temporal applicability: Target and source cycle `2026-27`; Fall 2026 entry context is stated.
- Known competing evidence: Department priority/rolling-consideration notes do not replace the published programme deadline.
- Risk warning: DEADLINE/STATUS - preserve the published deadline and distinguish priority timing from another entry cycle.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `UCLA graduate applicants whose qualifying prior education was not conducted solely in English must demonstrate proficiency through UCLA-accepted TOEFL iBT or IELTS Academic scores, subject to the stated exemptions and programme-specific thresholds.`
- Source identity: UCLA Graduate English Requirements
- Source authority: UCLA official Graduate Education
- Source URL: <https://grad.ucla.edu/admissions/english-requirements/>
- Evidence: Qualifying prior English education may exempt an applicant; otherwise TOEFL/IELTS evidence is required, with current minimums and validity rules.
- Evidence locator: `English Language Proficiency for Admission to UCLA` section.
- Programme applicability: Graduate admission proficiency policy; department thresholds may add conditions.
- Temporal applicability: Target `2026-27`; current UCLA graduate policy, exact programme-specific 2026-27 override not stated.
- Known competing evidence: ESLPE and teaching-assistant oral proficiency are separate post-admission/assistantship semantics.
- Risk warning: APPLICABILITY - keep admission proficiency, exemptions, department overrides, ESLPE, and TA eligibility separate.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-20-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `Biostatistics MPH applicants must submit SOPHAS and UCLA Graduate Education applications, three recommendations, recent GRE evidence subject to stated waiver rules, requisite concentration coursework including at least one year of college-level calculus, and the listed university requirements; prior public-health experience is not required.`
- Source identity: UCLA 2026-2027 Biostatistics MPH admissions requirements
- Source authority: UCLA official Graduate Education / Fielding School of Public Health
- Source URL: <https://grad.ucla.edu/gasaa/deptinfo/deptinfo.asp?academicyear=20262027&code=00HW>
- Evidence: `Degree-Specific Admissions Requirements` lists SOPHAS plus UCLA applications, three recommendations, recent GRE, concentration coursework, one year of college calculus, and waiver/joint-degree rules.
- Evidence locator: `Degree-Specific Admissions Requirements` section.
- Programme applicability: Ordinary Biostatistics MPH requirements; preserve concentration preparation, waiver rules, joint degrees, and post-matriculation remedial coursework separately.
- Temporal applicability: Target and source cycle `2026-27` / UCLA 2026-2027 graduate major admissions page.
- Known competing evidence: Articulated Medicine/MPH and concurrent JD/MPH pathways have additional rules; prior public-health experience is not required.
- Risk warning: ADMISSIONS-SCOPE - do not universalize joint-degree or post-admission rules.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 21 - UCLA - Computer Science / MS

Institution: UCLA  
Programme: Computer Science  
Credential: MS  
Target cycle: 2026-27  
Audience/scope: graduate international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-21-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `UCLA Computer Science MS`
- Source identity: UCLA Computer Science graduate application requirements
- Source authority: UCLA official Computer Science Department
- Source URL: <https://www.cs.ucla.edu/graduate-requirements/>
- Evidence: The `Application Requirements` heading says applicants select Computer Science MS or Computer Science PhD as the intended programme of study.
- Evidence locator: `Application Requirements` heading.
- Programme applicability: CS MS only; keep CS PhD, ESAP, and adjacent Engineering pathways separate.
- Temporal applicability: Target `2026-27`; current CS graduate requirements page, explicit 2026-27 edition not stated.
- Known competing evidence: Computer Science PhD and other graduate pathways are separate applicant/programme variants.
- Risk warning: IDENTITY/PATHWAY - do not merge CS MS with PhD, ESAP, or adjacent Engineering programmes.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `MS / Master of Science in Computer Science`
- Source identity: UCLA Computer Science graduate application requirements
- Source authority: UCLA official Computer Science Department
- Source URL: <https://www.cs.ucla.edu/graduate-requirements/>
- Evidence: The application requirements explicitly offer Computer Science MS or Computer Science PhD as intended programmes of study.
- Evidence locator: `Application Requirements` heading and programme-selection text.
- Programme applicability: CS MS credential; do not confuse it with the PhD, applicant field preference, or prior degree.
- Temporal applicability: Target `2026-27`; current requirements page, explicit 2026-27 edition not stated.
- Known competing evidence: The PhD is a separate credential and adjacent graduate pathways are distinct.
- Risk warning: CREDENTIAL SCOPE - preserve MS, PhD, applicant preference, and prior-degree distinctions.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Computer Science Graduate Admissions
- Source authority: UCLA official Computer Science Department
- Source URL: <https://www.cs.ucla.edu/graduate-admissions/>
- Evidence: The Graduate Admissions page states that applications are accepted for Fall admission only, but provides no formal lifecycle `ACTIVE` assertion.
- Evidence locator: Graduate Admissions page, Fall-only admissions statement.
- Programme applicability: Fall-only intake is an admissions rule for CS MS/graduate admissions, not lifecycle proof.
- Temporal applicability: Target `2026-27`; lifecycle effective date is not stated.
- Known competing evidence: Current page presence and Fall-only intake do not establish `ACTIVE`, `SUSPENDED`, or `DISCONTINUED`.
- Risk warning: STATUS/INTAKE - do not infer lifecycle from a Fall-only intake rule.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Financial Aid 2026-27 Graduate Cost of Attendance
- Source authority: UCLA official Financial Aid and Scholarships
- Source URL: <https://financialaid.ucla.edu/go/coa>
- Evidence: 2026-27 graduate budgets separate university fees, nonresident supplemental tuition, and health insurance from other cost-of-attendance components.
- Evidence locator: `2026-27 Graduate Student Budgets`.
- Programme applicability: The estimate is not a CS-MS billing statement; academic-master fee components may require Registrar-specific evidence.
- Temporal applicability: Target and source cycle `2026-27`; final fees may change.
- Known competing evidence: The CS department directs applicants to the Registrar for specific charges; the budget may not identify all CS-MS components.
- Risk warning: FINANCE/LINEAGE - do not treat an estimated budget or NRST line as complete programme tuition.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: UCLA Computer Science graduate application requirements
- Source authority: UCLA official Computer Science Department
- Source URL: <https://www.cs.ucla.edu/graduate-requirements/>
- Evidence: The `Application Requirements` section states December 15 at 23:59 Pacific Time and admission once a year for Fall quarter only.
- Evidence locator: `Application Requirements` section, deadline and Fall-only admissions statements.
- Programme applicability: CS graduate application schedule; preserve Fall-only intake and exact programme scope.
- Temporal applicability: Target `2026-27`; current schedule has no explicit 2026-27 source-cycle label in the reviewed page.
- Known competing evidence: The 2025-2026 GRE note and older FAQ examples must not be reused as the 2026-27 deadline.
- Risk warning: DEADLINE/CYCLE - preserve December 15, 23:59 PT and Fall-only intake without silently assigning an unlabelled cycle.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `UCLA CS MS applicants must satisfy the UCLA graduate English-proficiency policy through qualifying prior education or accepted TOEFL iBT/IELTS Academic evidence, subject to current minimum scores, validity, exemptions, and any CS-specific override.`
- Source identity: UCLA Graduate English Requirements
- Source authority: UCLA official Graduate Education
- Source URL: <https://grad.ucla.edu/admissions/english-requirements/>
- Evidence: Qualifying prior English education may exempt an applicant; otherwise TOEFL/IELTS evidence is required with current minimums and validity rules.
- Evidence locator: `English Language Proficiency for Admission to UCLA` section.
- Programme applicability: UCLA graduate policy applied to CS MS only subject to any CS-specific override; ESLPE/TA rules are separate.
- Temporal applicability: Target `2026-27`; current graduate policy, exact CS-specific 2026-27 override not stated.
- Known competing evidence: Department-specific conditions may add requirements; post-admission oral-proficiency rules are different semantics.
- Risk warning: APPLICABILITY/TEMPORAL - preserve thresholds, score validity, exemptions, CS overrides, ESLPE, and TA eligibility separately.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-21-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `CS MS applicants submit the UCLA graduate application with at least three recommendation letters and the stated application statements/transcripts/materials; the department does not require a separate writing sample because the statements serve that role.`
- Source identity: UCLA Computer Science graduate application requirements
- Source authority: UCLA official Computer Science Department
- Source URL: <https://www.cs.ucla.edu/graduate-requirements/>
- Evidence: The application requirements and supporting sections list three recommendations, the graduate application, statements, transcripts/materials, optional writing-sample treatment, and the submission rule.
- Evidence locator: `Application Requirements` and supporting application-material sections.
- Programme applicability: CS MS application requirements; keep PhD/ESAP variants, faculty preferences, fee-waiver rules, and post-admission documents separate.
- Temporal applicability: Target `2026-27`; current CS requirements page, explicit 2026-27 edition not stated.
- Known competing evidence: Faculty preferences and field selection support advising/assignment and are not additional admission gates.
- Risk warning: ADMISSIONS-SCOPE - distinguish CS MS application requirements from PhD/ESAP, faculty, fee-waiver, and post-admission rules.

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Reviewer instructions

For each case select exactly one decision and do not infer confirmation from an
empty decision. Use `CONFIRM` only when the complete proposed state/value,
scope, audience, cycle, applicability, and evidence record is correct. A
confirmed record may remain `NEEDS_REVIEW` with a null value. Use `AMBIGUOUS`
when the evidence cannot safely establish one scored truth, `REJECT` when the
proposal or evidence is wrong and needs correction, and `NOT_APPLICABLE` only
when the field is demonstrably outside the programme context.
