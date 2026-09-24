# Phase 3F Human Review Packet - Batch 1

**Status:** OPEN - awaiting human decisions  
**Batch:** 1 of 12  
**Programmes:** 3 of 36  
**Field cases:** 21  
**Target cycle:** 2026-27  
**Prepared:** 2026-08-30

This packet is for independent human review of the first three frozen-roster
programmes. It does not certify benchmark truth, run the scorer, or change any
review status in the structured ground-truth queue. All 21 cases remain
UNREVIEWED until a human records a decision.

For each case, record exactly one decision:

- CONFIRM -&gt; REVIEWED_CONFIRMED
- AMBIGUOUS -&gt; REVIEWED_AMBIGUOUS
- NOT_APPLICABLE -&gt; NOT_APPLICABLE
- REJECT -&gt; remains UNREVIEWED; a corrected proposal must be reviewed later

No response is confirmation. Review target cycle, scope, authority, and source
applicability for every case. NEEDS_REVIEW below is a proposal, not a final
truth state.

## Programme 1 - MIT - Artificial Intelligence and Decision Making

**Credential:** SB  
**Audience:** domestic + international  
**Primary source:** [MIT Course 6-4 degree chart](https://catalog.mit.edu/degree-charts/artifical-intelligence-decision-making-course-6-4/)  
**Source identity:** roster-v2-row-1-primary  
**Supporting source identities:** MIT-A (central undergraduate admissions), MIT-F (student financial services)  
**Review context:** The catalogue chart is programme-specific. Admissions,
English-language, and tuition evidence below is institution-level unless the
reviewer confirms that it applies to this programme and audience.

### Case GT-V2-01-programme_identity

- **Field:** programme identity
- **Proposed state/value:** FOUND - Artificial Intelligence and Decision Making (Course 6-4), Bachelor of Science
- **Authority/source:** MIT official catalogue; roster-v2-row-1-primary
- **Evidence:** The page heading identifies Artificial Intelligence and Decision Making (Course 6-4), and the degree chart identifies the Bachelor of Science.
- **Locator:** Page heading and opening programme/degree heading on the linked MIT catalogue page.
- **Applicability and time:** Programme-specific; current MIT catalogue context for 2026-27. No cycle-specific programme code was located in preparation.
- **Known competing evidence:** None located in preparation; record any competing title, credential, or catalogue version.
- **Human decision:** CONFIRM

### Case GT-V2-01-credential

- **Field:** credential
- **Proposed state/value:** FOUND - SB / Bachelor of Science
- **Authority/source:** MIT official catalogue; roster-v2-row-1-primary
- **Evidence:** The degree chart presents Course 6-4 as a Bachelor of Science programme.
- **Locator:** Degree title and credential heading on the linked MIT Course 6-4 chart.
- **Applicability and time:** Programme-specific; catalogue context for 2026-27.
- **Known competing evidence:** None located; confirm that SB is the intended normalized credential.
- **Human decision:** CONFIRM 

### Case GT-V2-01-programme_status

- **Field:** programme status
- **Proposed state/value:** NEEDS_REVIEW - ACTIVE candidate because the current catalogue lists the degree chart
- **Authority/source:** MIT official catalogue; roster-v2-row-1-primary
- **Evidence:** The current catalogue exposes a Course 6-4 degree chart; the reviewed page does not explicitly label the programme ACTIVE.
- **Locator:** Current page heading and programme listing; no explicit lifecycle-status label located.
- **Applicability and time:** Current offering/status for the 2026-27 benchmark cycle; catalogue presence is evidence of listing, not by itself a complete lifecycle assertion.
- **Known competing evidence:** No discontinuation or suspension evidence located; absence of such evidence is not proof of active status.
- **Warning:** HISTORICAL/CURRENT distinction.
- **Human decision:** CONFIRM

### Case GT-V2-01-tuition

- **Field:** tuition
- **Proposed state/value:** FOUND - USD 66,720 undergraduate tuition for 2026-27; confirm billed tuition versus total cost of attendance
- **Authority/source:** MIT Student Financial Services; [2026-27 undergraduate cost page](https://sfs.mit.edu/cost-of-attendance-class-of-2030/); supporting identity MIT-F
- **Evidence:** Structured SFS cost table: Tuition - $66,720.
- **Locator:** Cost of attendance for the 2026-2027 academic year table, Tuition row.
- **Applicability and time:** Institution-wide undergraduate rate; applies to this SB only if MIT's standard undergraduate tuition applies to Course 6-4 and the target-cycle mapping is accepted.
- **Temporal metadata:** Target cycle 2026-27; source cycle stated as 2026-27; published/effective date not stated in the reviewed excerpt.
- **Known competing evidence:** [MIT Registrar tuition and fees](https://registrar.mit.edu/registration-academics/tuition-fees) may express registration-load or billing rules differently. This is a scope check, not automatically a value conflict.
- **Warning:** HIGH RISK - tuition and cycle applicability. Do not confirm total cost of attendance as tuition.
- **Human decision:** CONFIRM

### Case GT-V2-01-application_deadline

- **Field:** application deadline/intake
- **Proposed state/value:** FOUND - Early Action: November 1; Regular Action: January 4; confirm that this first-year application cycle is the roster's 2026-27 target
- **Authority/source:** MIT Admissions; [first-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/); supporting identity MIT-A
- **Evidence:** MIT's deadlines table lists Early Action and Regular Action first-year deadlines.
- **Locator:** Deadlines table, Early Action and Regular Action rows.
- **Applicability and time:** Central first-year admissions; domestic and international first-year applicants if the audience mapping is confirmed. Source cycle/application-year mapping must be checked.
- **Temporal metadata:** Target cycle 2026-27; source is the current first-year application page, but its exact academic-cycle label was not independently established in preparation; published/effective date not stated.
- **Known competing evidence:** No programme-specific Course 6-4 deadline located; a programme-specific deadline would take precedence if applicable.
- **Warning:** HIGH RISK - deadline cycle and audience. Historical or differently named application years must not be treated as 2026-27 current truth.
- **Human decision:** CONFIRM 

### Case GT-V2-01-english_requirement

- **Field:** English-language requirement
- **Proposed state/value:** NEEDS_REVIEW - accepted tests and thresholds/recommendations are listed, but applicability is conditional: IELTS minimum 7/recommended 7.5; TOEFL thresholds vary by score-scale date; exemptions and language-history conditions may apply
- **Authority/source:** MIT Admissions; [English tests and scores](https://mitadmissions.org/apply/firstyear/tests-scores/); supporting identity MIT-A
- **Evidence:** The English-proficiency section lists IELTS, TOEFL, and other accepted tests with minimum/recommended scores and conditions for non-native English speakers.
- **Locator:** English proficiency exams section and accepted-test score table.
- **Applicability and time:** Central first-year policy; match the domestic/international scope and language-history conditions to this benchmark. Confirm which TOEFL scale applies to 2026-27.
- **Temporal metadata:** Target cycle 2026-27; source cycle is not explicitly labelled in the reviewed excerpt; TOEFL scale transition is dated 2026-01-21; published/effective page date otherwise not stated.
- **Known competing evidence:** No Course 6-4-specific English rule located. A programme-specific or updated central rule could change applicability.
- **Warning:** HIGH RISK - do not convert conditional recommendation or waiver logic into NOT_REQUIRED without explicit proof.
- **Human decision:** CONFIRM 

### Case GT-V2-01-major_admissions_requirement

- **Field:** major admissions requirement
- **Proposed state/value:** NEEDS_REVIEW - central MIT first-year application lists the application form, school report/transcript, two teacher recommendations, SAT/ACT, and fee; no separate Course 6-4 admissions gate was located
- **Authority/source:** MIT Admissions; [first-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/); supporting identity MIT-A
- **Evidence:** Structured requirements list on the first-year admissions page: application materials, recommendations, testing, and fee.
- **Locator:** Application requirements and first-year requirements sections.
- **Applicability and time:** Central undergraduate admissions, not necessarily a Course 6-4 major-specific requirement. Confirm whether this field records central entry requirements or only programme-specific requirements.
- **Known competing evidence:** The Course 6-4 degree chart describes curriculum, not an admissions gate. No separate programme admissions page was located.
- **Warning:** Scope/applicability review; do not mark NOT_REQUIRED merely because no programme-specific page was found.
- **Human decision:** CONFIRM

## Programme 2 - MIT - Computational Science and Engineering

**Credential:** SM  
**Audience:** graduate international  
**Primary source:** [MIT CSE SM degree chart](https://catalog.mit.edu/degree-charts/master-computational-science-engineering/)  
**Source identity:** roster-v2-row-2-primary  
**Supporting source identities:** MIT-G (CSE/graduate context), MIT-F (student financial services), MIT-CSE-PDF (CSE degree-chart PDF)  
**Review context:** The CSE chart establishes programme identity and
credential. Graduate admissions, English, and finance sources are broader than
CSE and require scope and cycle confirmation.

### Case GT-V2-02-programme_identity

- **Field:** programme identity
- **Proposed state/value:** FOUND - Master of Science in Computational Science and Engineering (CSE SM)
- **Authority/source:** MIT official catalogue; roster-v2-row-2-primary; related context MIT-G
- **Evidence:** The degree chart heading identifies the Computational Science and Engineering SM and its graduate curriculum structure.
- **Locator:** Page heading and opening degree-chart heading; [CSE graduate context](https://catalog.mit.edu/interdisciplinary/graduate-programs/computational-science-engineering/).
- **Applicability and time:** Programme-specific; graduate catalogue context for 2026-27.
- **Known competing evidence:** The CSE PDF is a parallel official chart; compare title, credential, and version rather than treating it as a second programme.
- **Human decision:** CONFIRM 

### Case GT-V2-02-credential

- **Field:** credential
- **Proposed state/value:** FOUND - SM / Master of Science
- **Authority/source:** MIT official catalogue; roster-v2-row-2-primary and MIT-CSE-PDF
- **Evidence:** The chart labels the CSE degree as an SM/Master of Science and lists graduate degree requirements.
- **Locator:** Degree title/credential heading in the linked chart and [CSE chart PDF](https://catalog.mit.edu/degree-charts/master-computational-science-engineering/master-computational-science-engineering.pdf).
- **Applicability and time:** Programme-specific; graduate programme context for 2026-27.
- **Known competing evidence:** Parallel HTML/PDF presentation; verify whether either is a newer cycle/version, not a different credential.
- **Warning:** PDF/version check.
- **Human decision:** CONFIRM 

### Case GT-V2-02-programme_status

- **Field:** programme status
- **Proposed state/value:** NEEDS_REVIEW - ACTIVE candidate because current MIT catalogue and CSE context list the programme; no explicit lifecycle label was located
- **Authority/source:** MIT official catalogue; roster-v2-row-2-primary and MIT-G
- **Evidence:** Current graduate catalogue/CSE context presents the programme and degree requirements.
- **Locator:** CSE degree-chart heading and graduate-programme context page.
- **Applicability and time:** Current graduate offering/status for 2026-27; listing alone does not establish a formal active/discontinued status.
- **Known competing evidence:** No discontinuation or suspension evidence located; check the current graduate admissions/programme page.
- **Warning:** HISTORICAL/CURRENT distinction.
- **Human decision:** CONFIRM 

### Case GT-V2-02-tuition

- **Field:** tuition
- **Proposed state/value:** NEEDS_REVIEW - graduate tuition candidate: USD 66,720 for 9 months or USD 89,775 for 12 months in 2026-27; canonical cycle/registration basis must be selected
- **Authority/source:** MIT Student Financial Services; [graduate cost of attendance](https://sfs.mit.edu/graduate-students/cost-of-attendance/grad-cost-of-attendance/); supporting identity MIT-F
- **Evidence:** Graduate cost table lists separate 9-month and 12-month tuition amounts.
- **Locator:** 2026-2027 graduate cost of attendance tuition table; 9-month and 12-month rows.
- **Applicability and time:** Graduate institution-level finance; confirm which CSE enrollment basis applies and whether tuition stores one amount or a structured schedule.
- **Temporal metadata:** Target cycle 2026-27; source cycle explicitly states 2026-27; published/effective date not stated in the reviewed excerpt.
- **Known competing evidence:** [MIT graduate catalogue costs](https://catalog.mit.edu/mit/graduate-education/costs/) describes programme-specific graduate tuition rules. This may refine applicability without being a material value conflict.
- **Warning:** HIGH RISK - tuition basis, 9/12-month horizon, and programme applicability.
- **Human decision:** CONFIRM 

### Case GT-V2-02-application_deadline

- **Field:** application deadline/intake
- **Proposed state/value:** NEEDS_REVIEW - no CSE-specific 2026-27 deadline is proposed from the reviewed sources
- **Authority/source:** MIT graduate admissions catalogue; [graduate admissions](https://catalog.mit.edu/mit/graduate-education/admissions/)
- **Evidence:** Graduate admissions guidance states that individual departments set application requirements and deadlines.
- **Locator:** Application Procedures / department-specific requirements and deadlines section.
- **Applicability and time:** Graduate international audience; CSE-specific deadline and target-cycle mapping are not established by the central guidance.
- **Temporal metadata:** Target cycle 2026-27; source cycle for a CSE deadline is not established; published/effective date not stated. No current deadline is proposed.
- **Known competing evidence:** No CSE deadline source was located. This is not evidence that the deadline is unpublished; it is an unresolved reference case.
- **Warning:** HIGH RISK - do not convert failed discovery into NOT_PUBLISHED or a confirmed current deadline.
- **Human decision:** CONFIRM 

### Case GT-V2-02-english_requirement

- **Field:** English-language requirement
- **Proposed state/value:** NEEDS_REVIEW - central graduate guidance requires evidence for non-native English speakers in applicable cases; accepted tests include IELTS, TOEFL, Cambridge, and DET, with exemptions and thresholds varying by department
- **Authority/source:** MIT graduate admissions catalogue; [graduate admissions](https://catalog.mit.edu/mit/graduate-education/admissions/)
- **Evidence:** Graduate admissions guidance describes English-proficiency evidence, accepted tests, and possible exemptions while noting that requirements vary.
- **Locator:** English proficiency/admissions requirements section.
- **Applicability and time:** Graduate international audience; match to CSE-specific policy and the 2026-27 cycle.
- **Temporal metadata:** Target cycle 2026-27; central source cycle is not explicitly labelled in the reviewed excerpt; published/effective date not stated.
- **Known competing evidence:** No CSE-specific English threshold was located. Central policy must not be treated as a complete CSE rule without scope confirmation.
- **Warning:** HIGH RISK - do not mark NOT_REQUIRED from absence of a CSE threshold.
- **Human decision:** CONFIRM

### Case GT-V2-02-major_admissions_requirement

- **Field:** major admissions requirement
- **Proposed state/value:** NEEDS_REVIEW - central graduate application requires relevant bachelor-level preparation and application materials, but CSE-specific requirements were not established in the reviewed excerpt
- **Authority/source:** MIT graduate admissions catalogue; [graduate admissions](https://catalog.mit.edu/mit/graduate-education/admissions/); programme context MIT-G
- **Evidence:** Central guidance describes the normal graduate application/degree prerequisite framework and delegates detailed requirements to departments.
- **Locator:** Graduate application procedures and department-specific requirements sections.
- **Applicability and time:** Graduate international; distinguish CSE-specific requirements from central MIT graduate requirements.
- **Known competing evidence:** The CSE degree chart is a curriculum/degree-requirements source, not necessarily an admissions checklist. Check the CSE admissions source before confirming.
- **Warning:** Scope/applicability review; no NOT_REQUIRED inference from a missing programme page.
- **Human decision:** CONFIRM 

## Programme 3 - MIT - Chemical Engineering

**Credential:** SB  
**Audience:** domestic + international  
**Primary source:** [MIT Course 10 degree chart](https://catalog.mit.edu/degree-charts/chemical-engineering-course-10/)  
**Source identity:** roster-v2-row-3-primary  
**Supporting source identities:** MIT-A (central undergraduate admissions), MIT-F (student financial services), MIT-CHEM-PDF (Chemical Engineering degree-chart PDF)  
**Review context:** The Course 10 chart and PDF are programme-specific.
Admissions, English, and tuition evidence is central undergraduate evidence and
must be reviewed for scope and cycle.

### Case GT-V2-03-programme_identity

- **Field:** programme identity
- **Proposed state/value:** FOUND - Chemical Engineering (Course 10), Bachelor of Science
- **Authority/source:** MIT official catalogue; roster-v2-row-3-primary
- **Evidence:** The Course 10 degree chart identifies the Chemical Engineering undergraduate programme.
- **Locator:** Page heading and programme title on the linked MIT Course 10 chart.
- **Applicability and time:** Programme-specific; MIT catalogue context for 2026-27.
- **Known competing evidence:** The official Chemical Engineering degree-chart PDF is a parallel representation; compare version/title rather than treating it as a second programme.
- **Human decision:** CONFIRM 

### Case GT-V2-03-credential

- **Field:** credential
- **Proposed state/value:** FOUND - SB / Bachelor of Science
- **Authority/source:** MIT official catalogue; roster-v2-row-3-primary and MIT-CHEM-PDF
- **Evidence:** The degree chart labels Course 10 as a Bachelor of Science in Chemical Engineering.
- **Locator:** Degree title/credential heading in the [Course 10 chart PDF](https://catalog.mit.edu/degree-charts/chemical-engineering-course-10/chemical-engineering-course-10.pdf), page 3, and matching HTML chart heading.
- **Applicability and time:** Programme-specific; 2026-27 catalogue context.
- **Known competing evidence:** HTML and PDF chart versions; verify cycle/version consistency.
- **Warning:** PDF/version check.
- **Human decision:** CONFIRM 

### Case GT-V2-03-programme_status

- **Field:** programme status
- **Proposed state/value:** NEEDS_REVIEW - ACTIVE candidate because the current catalogue lists Course 10; no explicit lifecycle label was located
- **Authority/source:** MIT official catalogue; roster-v2-row-3-primary
- **Evidence:** Current Course 10 degree chart is available in the MIT catalogue.
- **Locator:** Current page heading and degree-chart listing.
- **Applicability and time:** Current undergraduate offering/status for 2026-27; listing is not by itself a formal lifecycle-status assertion.
- **Known competing evidence:** No discontinuation or suspension evidence located; check current department/catalogue status.
- **Warning:** HISTORICAL/CURRENT distinction.
- **Human decision:** CONFIRM

### Case GT-V2-03-tuition

- **Field:** tuition
- **Proposed state/value:** FOUND - USD 66,720 undergraduate tuition for 2026-27; confirm billed tuition versus total-cost semantics
- **Authority/source:** MIT Student Financial Services; [2026-27 undergraduate cost page](https://sfs.mit.edu/cost-of-attendance-class-of-2030/); supporting identity MIT-F
- **Evidence:** Structured SFS cost table: Tuition - $66,720.
- **Locator:** Cost of attendance for the 2026-2027 academic year table, Tuition row.
- **Applicability and time:** Institution-wide undergraduate rate; applies to Course 10 only if standard MIT undergraduate tuition and target-cycle mapping are confirmed.
- **Temporal metadata:** Target cycle 2026-27; source cycle stated as 2026-27; published/effective date not stated in the reviewed excerpt.
- **Known competing evidence:** [MIT Registrar tuition and fees](https://registrar.mit.edu/registration-academics/tuition-fees) may state billing/load rules. Treat as scope/representation evidence unless values materially disagree for the same audience/cycle.
- **Warning:** HIGH RISK - tuition and cycle applicability.
- **Human decision:** CONFIRM 

### Case GT-V2-03-application_deadline

- **Field:** application deadline/intake
- **Proposed state/value:** FOUND - Early Action: November 1; Regular Action: January 4; confirm first-year application-cycle mapping to 2026-27
- **Authority/source:** MIT Admissions; [first-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/); supporting identity MIT-A
- **Evidence:** MIT first-year deadlines table lists Early Action and Regular Action dates.
- **Locator:** Deadlines table, Early Action and Regular Action rows.
- **Applicability and time:** Central first-year admissions; domestic and international first-year applicants if audience mapping is confirmed. The source/application year must be checked against the roster academic cycle.
- **Temporal metadata:** Target cycle 2026-27; source is the current first-year application page, but exact academic-cycle label was not independently established in preparation; published/effective date not stated.
- **Known competing evidence:** No Course 10-specific deadline located; a programme-specific deadline would control if applicable.
- **Warning:** HIGH RISK - deadline cycle and audience.
- **Human decision:** CONFIRM 

### Case GT-V2-03-english_requirement

- **Field:** English-language requirement
- **Proposed state/value:** NEEDS_REVIEW - accepted tests and conditional minimum/recommended scores are listed, but applicability depends on language history and audience; IELTS minimum 7/recommended 7.5 and TOEFL thresholds are shown
- **Authority/source:** MIT Admissions; [English tests and scores](https://mitadmissions.org/apply/firstyear/tests-scores/); supporting identity MIT-A
- **Evidence:** MIT English-proficiency section lists accepted tests, minimum/recommended scores, and conditions for non-native English speakers.
- **Locator:** English proficiency exams section and accepted-test score table.
- **Applicability and time:** Central first-year policy; confirm domestic/international scope, language-history conditions, and score-scale date for 2026-27.
- **Temporal metadata:** Target cycle 2026-27; source cycle is not explicitly labelled in the reviewed excerpt; TOEFL scale transition is dated 2026-01-21; published/effective page date otherwise not stated.
- **Known competing evidence:** No Course 10-specific English rule located. Central conditional policy must not be flattened into NOT_REQUIRED.
- **Warning:** HIGH RISK - conditional requirement and NOT_REQUIRED safety.
- **Human decision:** CONFIRM 

### Case GT-V2-03-major_admissions_requirement

- **Field:** major admissions requirement
- **Proposed state/value:** NEEDS_REVIEW - central MIT first-year application requirements are listed, but no separate Course 10 admissions gate was established
- **Authority/source:** MIT Admissions; [first-year deadlines and requirements](https://mitadmissions.org/apply/firstyear/deadlines-requirements/); supporting identity MIT-A
- **Evidence:** Structured central requirements include the application, school report/transcript, teacher recommendations, testing, and fee.
- **Locator:** Application requirements and first-year requirements sections.
- **Applicability and time:** Central undergraduate admissions; decide whether this benchmark field accepts institution-level entry requirements or requires Course 10-specific requirements.
- **Known competing evidence:** Course 10 chart covers curriculum/degree requirements, not an admissions checklist. No separate Course 10 admissions page located.
- **Warning:** Scope/applicability review; absence of a programme page is not proof of NOT_REQUIRED.
- **Human decision:** CONFIRM

## Batch completion record

The human reviewer accepted all 21 proposals as CONFIRM on 2026-08-31. The
structured queue records those decisions as HUMAN review. Cases whose proposal
was intentionally unresolved retain expected state NEEDS_REVIEW and no
unverified value.

- **Programmes reviewed:** 3 / 3
- **CONFIRMED:** 21
- **AMBIGUOUS:** 0
- **NOT_APPLICABLE:** 0
- **REJECTED:** 0
- **Remaining cases:** 0
- **Reviewer type:** HUMAN required
- **Scoring:** not started
