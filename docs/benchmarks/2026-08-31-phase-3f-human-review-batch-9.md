# Phase 3F Human Review Packet - Batch 9

Status: **CLOSED - independent human review applied**  
Batch: 9 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycles: 2026-27 (row 25); 2027 (row 26); 2026 (row 27)  
Prepared: 2026-08-31  
Human review result: 21 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.

This packet covers the next three programmes in the frozen v2 roster: University of Tokyo rows 25-27. Proposals use independent official English/Japanese admissions, finance, and ITASIA sources only; no v3 pipeline output was used. All 21 records were independently confirmed. The structured ground-truth JSONL records the decisions and expected semantic states.

`REVIEWED_CONFIRMED` and `expected_state` are separate axes. Human confirmation accepts the complete proposed record; it does not force `FOUND`, `ACTIVE`, or a verified current value. Do not treat lack of response as confirmation.

## Source register

| Code | Role | Source |
|---|---|---|
| TOK-A-EN | IST and department English admissions | <https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml>; <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml> |
| TOK-A-JA-PDF | Japanese/translated department guides | <https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2026_ja_2025-2-28.pdf>; official linked ICE 2027 guide from <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml> |
| TOK-F | University of Tokyo tuition | <https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html> |
| TOK-GRAD | Graduate School periods and TOEFL guidance | <https://i-web2.i.u-tokyo.ac.jp/edu/entra/entra_e.shtml> |
| TOK-PARTNER | ITASIA programme/partner context | <https://itasia.iii.u-tokyo.ac.jp/>; <https://itasia.iii.u-tokyo.ac.jp/admissions-soon> |

For every case, review source authority, source-native language, programme/track scope, target cycle, applicability, and locator together. The Tokyo sources distinguish academic year from the year examinations are conducted. For PDF evidence, verify the page and section locator in the linked document before confirming.

## Programme 25 - University of Tokyo - Computer Science, IIS

Institution: University of Tokyo  
Programme: Computer Science, IIS  
Frozen-roster credential: master  
Target cycle: 2026-27  
Audience/scope: Japanese + international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-25-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: University of Tokyo Graduate School of Information Science and Technology, Department of Computer Science, masters program.
- Source identity: TOK-A-EN-25 / TOK-A-JA-PDF-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml>
- Short evidence: The official English admissions page is headed Computer Science under the Graduate School of Information Science and Technology. The Japanese guide cover names 東京大学大学院情報理工学系研究科 コンピュータ科学専攻 修士課程.
- Precise evidence locator: `English page heading; Japanese admission-guide PDF p.1 cover.`
- Programme applicability: Exact graduate-school department identity; preserve Computer Science, IIS, degree level, and the Japanese source-native name separately.
- Temporal applicability: Target 2026-27. The Japanese guide is labelled 2026 admission and says examinations were conducted in 2025; the current English page advertises AY2027.
- Known competing evidence: The Graduate School guide and department guide are both required; doctoral Computer Science and the Department of Information Science are adjacent but separate.
- Risk warning: **IDENTITY/CYCLE - do not merge Computer Science with Information Science, doctoral study, or a later academic-year guide.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: Masters program in Computer Science (source-native degree label: 修士課程).
- Source identity: TOK-A-JA-PDF-25 / TOK-A-EN-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2026_ja_2025-2-28.pdf>
- Short evidence: The official Japanese guide identifies Computer Science 修士課程, and the English page presents the masters and doctoral guide family.
- Precise evidence locator: `Japanese admission-guide PDF p.1 title and p.2 Masters Program section.`
- Programme applicability: Masters-level Computer Science admission; keep the source-native degree label distinct from any unreviewed MSc normalization.
- Temporal applicability: The guide is for the 2026 admission year, with examinations held in 2025; target 2026-27 convention requires review.
- Known competing evidence: The same guide covers a doctoral programme; doctoral eligibility and examinations are separate.
- Risk warning: **CREDENTIAL - do not normalize to MSc or combine masters and doctoral credentials without reviewed equivalence.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml>
- Short evidence: The current Computer Science admissions page publishes an Academic Year 2027 application section and admission materials.
- Precise evidence locator: `Applications for Academic Year 2027 heading and guide links.`
- Programme applicability: Listing and admissions presence is not a formal ACTIVE, SUSPENDED, or DISCONTINUED lifecycle assertion.
- Temporal applicability: Current AY2027 context and the 2026 Japanese guide do not provide one lifecycle-effective date for target 2026-27.
- Known competing evidence: Past exam archives show activity but do not establish a formal lifecycle state.
- Risk warning: **STATUS - do not infer ACTIVE from a current admissions page.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-F-25
- Source authority: University of Tokyo official admissions and finance source
- Source URL: <https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html>
- Short evidence: The central tuition table lists annual tuition of 535,800 yen for Graduate (excluding School of Law) Masters/Professional students, separately from admission and examination fees.
- Precise evidence locator: `Tuition Fee table: Graduate (excluding School of Law), Masters/Professional; payment-period notes.`
- Programme applicability: Central graduate tuition candidate, not a Computer Science-specific billed statement; admission and examination fees remain separate.
- Temporal applicability: The current table does not explicitly state benchmark 2026-27 programme-cycle applicability.
- Known competing evidence: Department billing instructions, exemptions, scholarships, and student category can affect payable amounts.
- Risk warning: **TUITION/TEMPORAL - retain the amount as evidence only until cycle and applicability are reviewed.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-25 / TOK-A-JA-PDF-25 / TOK-GRAD-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/entra/entra_e.shtml>
- Short evidence: The Graduate School page gives AY2027 submission windows of 29 May-4 June 2026 and 11-17 November 2026. The 2026 Computer Science guide gives 2025 examination dates and the department page advertises AY2027.
- Precise evidence locator: `Graduate School Application Period; Computer Science guide PDF p.3 exam schedule; department AY2027 heading.`
- Programme applicability: Preserve submission window, exam dates, summer/winter route, department, and benchmark target separately; no single deadline is proposed.
- Temporal applicability: Target 2026-27 conflicts with the Japanese 2026 admission-year guide and current AY2027 materials.
- Known competing evidence: Exam dates are not application deadlines, and summer/winter availability differs by programme.
- Risk warning: **DEADLINE/TEMPORAL - do not collapse submission windows, exams, and academic-year labels into one current date.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: Computer Science applicants use TOEFL score submission in place of the English-language entrance exam under department and Graduate School guidance; internal-background exemptions and submission rules remain scoped separately.
- Source identity: TOK-A-EN-25 / TOK-A-JA-PDF-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml>
- Short evidence: The department states that TOEFL replaced the English-language entrance exam. The Japanese guide identifies TOEFL submission and specified internal-graduate exemptions.
- Precise evidence locator: `English page TOEFL Scores section; Japanese admission-guide PDF p.4 exemption notes.`
- Programme applicability: Graduate Computer Science admissions; preserve TOEFL submission, exemption, validity, and any Graduate School instructions. No score threshold is asserted.
- Temporal applicability: Evidence spans the 2026 guide and current AY2027 page; exact target-cycle submission rule needs human review.
- Known competing evidence: Graduate School mechanics and doctoral/internal-graduate exemptions are different applicant scopes.
- Risk warning: **LANGUAGE/APPLICABILITY - do not invent a TOEFL threshold or universalize exemptions.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-25-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: Masters admission uses document screening, written mathematics and specialized-subject examinations, and an oral examination; applicants identify preferred laboratories and submit a research plan as required.
- Source identity: TOK-A-JA-PDF-25
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2026_ja_2025-2-28.pdf>
- Short evidence: The Japanese guide describes document screening, mathematics and specialized-subject written examinations, oral examination, laboratory choices, and research-plan submission.
- Precise evidence locator: `Admission-guide PDF pp.2-3, Masters Program and exam-schedule sections.`
- Programme applicability: Programme-specific masters admission process; preserve documents, exams, laboratory preference, research plan, and post-admission requirements separately.
- Temporal applicability: The exam dates belong to the 2026 admission guide conducted in 2025; exact target-cycle alignment remains for review.
- Known competing evidence: Graduate School-wide and doctoral requirements are related but not interchangeable.
- Risk warning: **ADMISSIONS/SCOPE - do not turn doctoral or degree-completion requirements into masters entry gates.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 26 - University of Tokyo - Information and Communication Engineering

Institution: University of Tokyo  
Programme: Information and Communication Engineering  
Frozen-roster credential: master  
Target cycle: 2027  
Audience/scope: Japanese + international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-26-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: University of Tokyo Graduate School of Information Science and Technology, Department of Information and Communication Engineering, masters program.
- Source identity: TOK-A-EN-26 / TOK-A-JA-PDF-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml>
- Short evidence: The official department page is headed Information and Communication Engineering and identifies a School Year 2027 Application Guide.
- Precise evidence locator: `Department page heading and School Year 2027 Application Guide section; linked Japanese guide.`
- Programme applicability: Exact department-level masters programme; preserve department, degree level, campus, and laboratory/pathway dimensions separately.
- Temporal applicability: Target 2027; the guide is explicitly School Year 2027 and was updated 6 July 2026.
- Known competing evidence: Computer Science, Electronic Information, and other IST departments are separate identities.
- Risk warning: **IDENTITY - do not merge ICE with adjacent IST departments.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: Masters program in Information and Communication Engineering (source-native degree label: 修士課程).
- Source identity: TOK-A-EN-26 / TOK-A-JA-PDF-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml>
- Short evidence: The department page links a recommendation letter labelled Master and a School Year 2027 guide for the department; the Japanese guide identifies 情報通信工学専攻 修士課程.
- Precise evidence locator: `Department recommendation-letter (Master) link and linked 2027 guide.`
- Programme applicability: Masters-level ICE admission; retain source-native degree label and normalized English credential as separate dimensions until review.
- Temporal applicability: The guide is School Year 2027; exact award nomenclature and normalization should be confirmed from the linked official guide.
- Known competing evidence: Doctoral admissions and shared Graduate School documents are separate credential scopes.
- Risk warning: **CREDENTIAL - do not merge masters and doctoral routes or infer MSc from the word master.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml>
- Short evidence: The department publishes a current School Year 2027 guide section and linked application materials.
- Precise evidence locator: `Admissions Guide and School Year 2027 Application Guide sections.`
- Programme applicability: Current admissions material establishes listing context only, not a formal lifecycle state.
- Temporal applicability: Target 2027 and the page update date are visible, but no formal ACTIVE effective date is stated.
- Known competing evidence: Graduate School changes to winter-entry availability are not lifecycle labels.
- Risk warning: **STATUS - current guide presence is not formal ACTIVE evidence.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-F-26
- Source authority: University of Tokyo official admissions and finance source
- Source URL: <https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html>
- Short evidence: The central fee table lists 535,800 yen annual tuition for Graduate Masters/Professional students, with separate admission and examination fees.
- Precise evidence locator: `Tuition Fee table: Graduate (excluding School of Law), Masters/Professional.`
- Programme applicability: Central graduate fee candidate; no ICE-specific billing statement is asserted.
- Temporal applicability: The reviewed table is not explicitly tied to roster cycle 2027.
- Known competing evidence: Student category, exemptions, payment periods, and department instructions can affect payable amounts; fees are not tuition.
- Risk warning: **TUITION/TEMPORAL - retain central candidate amount as evidence only until cycle applicability is reviewed.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-26 / TOK-GRAD-26 / TOK-A-JA-PDF-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/entra/entra_e.shtml>
- Short evidence: For AY2027 examinations conducted in AY2026, the Graduate School gives summer submission 29 May-4 June 2026 and winter submission 11-17 November 2026; the ICE page points to the School Year 2027 guide.
- Precise evidence locator: `Graduate School Application Period; ICE admissions page and linked 2027 guide.`
- Programme applicability: Preserve summer/winter route, submission window, exam schedule, department scope, and target separately.
- Temporal applicability: Roster target is 2027; Japanese AY terminology distinguishes academic year from examination year. One deadline representation is not proposed.
- Known competing evidence: Application period is not an exam, briefing, recommendation-letter, or laboratory-contact date.
- Risk warning: **DEADLINE/TEMPORAL - do not collapse multiple windows into one current date.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: ICE masters applicants follow the Graduate School TOEFL-score submission rules; exact score, validity, and exemption conditions remain governed by the current Graduate School and department guides.
- Source identity: TOK-GRAD-26 / TOK-A-EN-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/entra/entra_e.shtml>
- Short evidence: Graduate School admissions materials provide a TOEFL Scores section, and the ICE page requires both the department and Graduate School guides.
- Precise evidence locator: `Graduate School TOEFL Scores section; ICE Admissions Guide instructions.`
- Programme applicability: Graduate ICE admission-language evidence; preserve submission mechanics, exemptions, and department conditions separately. No numeric threshold is proposed.
- Temporal applicability: The current guide is for AY2027; human review must confirm the exact target-cycle rule and any ICE override.
- Known competing evidence: English-taught delivery and an admission test threshold are separate semantics.
- Risk warning: **LANGUAGE/APPLICABILITY - do not invent numeric TOEFL requirements or treat shared guidance as an ICE-specific override.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-26-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: The department and Graduate School guides together define the masters application package and selection process, including recommendation/research-plan materials and applicable written, oral, and specialized examinations.
- Source identity: TOK-A-EN-26 / TOK-A-JA-PDF-26 / TOK-GRAD-26
- Source authority: University of Tokyo Graduate School of Information Science and Technology official source
- Source URL: <https://i-web2.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml>
- Short evidence: The ICE page links a 2027 guide, recommendation letter for Master, and research plan for Master/Doctoral applicants; the Graduate School guide supplies common procedures.
- Precise evidence locator: `ICE recommendation-letter and research-plan links; Graduate School application-procedure sections.`
- Programme applicability: Programme-specific masters application requirements; keep documents, exams, laboratory choice, and degree completion separate.
- Temporal applicability: The source is School Year 2027, but exact field mapping from the linked PDF requires human review.
- Known competing evidence: Common Graduate School and doctoral requirements cannot be silently added to the masters gate set.
- Risk warning: **ADMISSIONS/SCOPE - do not infer a complete programme gate set from curriculum or doctoral materials alone.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 27 - University of Tokyo - ITASIA

Institution: University of Tokyo  
Programme: ITASIA  
Frozen-roster credential: MAS-PhD  
Target cycle: 2026  
Audience/scope: international; programme-specific unless independent review establishes a narrower or broader applicable scope

### GT-V2-27-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: ITASIA - International Master/Doctoral Degree Program: Information, Technology, and Society in Asia, Graduate School of Interdisciplinary Information Studies, The University of Tokyo.
- Source identity: TOK-A-EN-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-soon>
- Short evidence: The official ITASIA admissions page names the International Master/Doctoral Degree Program and places it in the Graduate School of Interdisciplinary Information Studies.
- Precise evidence locator: `Admissions page heading and programme-affiliation lines.`
- Programme applicability: One ITASIA programme identity with separate MAS and PhD degree tracks; preserve Graduate School, international scope, English-medium context, and track dimensions.
- Temporal applicability: Target 2026; official page and guidelines concern Fall/October 2026 enrollment.
- Known competing evidence: MAS and PhD share programme context but have different eligibility, tuition, and application-document semantics.
- Risk warning: **IDENTITY/TRACK - do not collapse two degree tracks into one credential.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-credential

- Field: `credential`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-guidelines>
- Short evidence: The official 2026 guidelines distinguish Master of Arts and Sciences (Information Studies) and Doctor of Philosophy (Information Studies) as separate two-year and three-year degree programmes.
- Precise evidence locator: `Admissions Guidelines 2026, Degree Programs and Projected Numbers of Entrants.`
- Programme applicability: The frozen MAS-PhD label combines two official tracks; retain MAS and PhD as source-native credential alternatives rather than selecting one normalized credential.
- Temporal applicability: The guidelines explicitly apply to October 2026, but the combined-row representation is unresolved.
- Known competing evidence: MAS eligibility requires a Bachelor degree; PhD eligibility requires a Master degree or equivalent. These are not one shared credential.
- Risk warning: **CREDENTIAL/TRACK - do not assign one canonical credential to the combined row without reviewed policy.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-soon>
- Short evidence: The ITASIA admissions page publishes Fall 2026 application information and the home page identifies the English-language graduate programme.
- Precise evidence locator: `Admissions page Fall 2026 section; ITASIA home page programme description.`
- Programme applicability: Current admissions presence is listing/context evidence, not an explicit lifecycle ACTIVE assertion.
- Temporal applicability: Target 2026 is cycle-specific application context, not a formal lifecycle record.
- Known competing evidence: Admissions-open/soon pages and programme news establish operational activity but not lifecycle semantics.
- Risk warning: **STATUS - do not infer ACTIVE solely from current admissions availability.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: TOK-A-EN-27 / TOK-F-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-guidelines>
- Short evidence: The 2026 guidelines state annual tuition of 535,800 yen for MAS and 520,800 yen for PhD, with separate 282,000 yen admission and 10,000 yen examination fees; the tuition page also shows an older 2024 enrolment table.
- Precise evidence locator: `Admissions Guidelines 2026 Tuition and Fees; ITASIA Tuition page Tuition and Fees.`
- Programme applicability: Track-specific tuition candidates are evidence, but a combined MAS-PhD row needs a structured track schedule rather than one amount.
- Temporal applicability: The guidelines say fees are as of 2025 and subject to change while target enrollment is 2026; exact effective applicability needs review.
- Known competing evidence: Admission/examination fees, scholarships, exemptions, and track differences are separate from annual tuition.
- Risk warning: **TUITION/TEMPORAL - do not collapse MAS and PhD rates or treat subject-to-change fees as verified target truth.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-application_deadline

- Field: `application_deadline`
- Proposed expected state: `FOUND`
- Proposed expected value: For October/Fall 2026 ITASIA enrollment, the online application period starts 1 October 2025 and completed applications/supporting materials are due by 3 December 2025 at 11:59 a.m. JST; the deadline applies to the MAS and PhD application routes.
- Source identity: TOK-A-EN-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-guidelines>
- Short evidence: The official 2026 guidelines state that they are for October 2026 applicants, give the 3 December 2025 11:59 a.m. JST deadline, and state the 1 October 2025 application start.
- Precise evidence locator: `Admissions Guidelines 2026 Introduction and Application Procedure; admissions page deadline notice.`
- Programme applicability: Structured deadline for the ITASIA 2026 enrollment cycle; preserve online submission, supporting-document delivery, JST timezone, and track scope.
- Temporal applicability: Target cycle 2026 is explicitly mapped to October 2026 enrollment.
- Known competing evidence: Official admissions page and guidelines are both ITASIA sources; later-cycle notices must not replace this record.
- Risk warning: **DEADLINE - retain entry month, dates, cutoff time, timezone, and track scope; do not generalize to later cycles.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-english_requirement

- Field: `english_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: ITASIA is conducted in English; applicants must be proficient enough for graduate-level lectures and guidance. Non-native English speakers must submit official TOEFL iBT or IELTS Academic results, subject to the native-speaker exception and validity rules.
- Source identity: TOK-A-EN-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-guidelines>
- Short evidence: The 2026 guidelines state that instruction is in English, require graduate-level proficiency, and require TOEFL/IELTS reports for non-native speakers under stated conditions.
- Precise evidence locator: `Admissions Guidelines 2026 Program Overview, Introduction, Qualifications, and TOEFL/IELTS document sections.`
- Programme applicability: International ITASIA admissions; keep qualitative proficiency, test submission, native-speaker exception, validity, and post-admission language use separate.
- Temporal applicability: Evidence is explicitly for October 2026; no unlisted numeric threshold is proposed.
- Known competing evidence: MAS and PhD share English-medium context but have different academic eligibility; GRE is separate.
- Risk warning: **LANGUAGE - do not invent score thresholds or confuse English proficiency with GRE, JLPT, or post-admission language use.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-27-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: ITASIA selection uses submitted documents and, if necessary, an interview. MAS applicants need a Bachelor degree or equivalent; PhD applicants need a Master degree or equivalent plus advanced research preparation. The 2026 application includes transcripts, evaluations, research writing, GRE, and TOEFL/IELTS materials under stated exceptions.
- Source identity: TOK-A-EN-27 / TOK-PARTNER-27
- Source authority: University of Tokyo Graduate School of Interdisciplinary Information Studies / ITASIA official source
- Source URL: <https://itasia.iii.u-tokyo.ac.jp/admissions-guidelines>
- Short evidence: The guidelines describe track-specific eligibility and selection, document screening/interview, two evaluations, degree certificates/transcripts, English-test reports, GRE, and a representative research-work sample.
- Precise evidence locator: `Admissions Guidelines 2026 Qualifications, Selection, and Application Documents sections.`
- Programme applicability: Track-specific ITASIA admission requirements; preserve eligibility, documents, GRE, English tests, evaluations, research sample, scholarship, and visa rules separately.
- Temporal applicability: The guidelines explicitly target October 2026; track applicability must remain visible.
- Known competing evidence: Scholarship, visa, export-control, and post-acceptance rules are not automatically academic admission gates.
- Risk warning: **ADMISSIONS/SCOPE - do not merge MAS and PhD eligibility or turn operational conditions into one academic value.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Review instructions

Select exactly one decision for each case. A confirmed record may legitimately retain `NEEDS_REVIEW` and a null value when cycle, scope, applicability, credential normalization, or lifecycle truth is unresolved. Do not infer a value from the frozen-roster label.
