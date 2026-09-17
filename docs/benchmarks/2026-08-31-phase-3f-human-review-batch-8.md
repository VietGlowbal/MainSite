# Phase 3F Human Review Packet - Batch 8

Status: **CLOSED - correction re-review applied**  
Batch: 8 of 12  
Programmes: 3 of 36  
Field cases: 21  
Target cycle: 2026-27  
Prepared: 2026-08-31  

This packet covers the next three programmes in the frozen v2 roster: rows
22-24, all at Université de Montréal. The proposals were prepared from
independent official UdeM programme/admission and regulation pages. They do
not use v3 pipeline output. The initial human review confirmed 18 records and
rejected three; all three corrected proposals were independently confirmed on
re-review. Batch 8 is closed, with the original rejections and corrections
preserved in the structured artifact.

## Recorded initial human decisions

| Programme | Confirm | Ambiguous | Reject | Pending correction |
|---|---:|---:|---:|---:|
| Baccalauréat en informatique / BSc | 6 | 0 | 1 | 1 |
| Maîtrise en informatique / MSc | 6 | 0 | 1 | 1 |
| DESS en apprentissage automatique / DESS | 6 | 0 | 1 | 1 |
| **Total** | **18** | **0** | **3** | **3** |

Rejected cases and corrected proposals are in
`2026-08-31-phase-3f-human-review-batch-8-correction-1.md`. The original
proposals and rejection decisions remain preserved in the structured queue.

`REVIEWED_CONFIRMED` and `expected_state` are separate axes. Confirmation of
an unresolved proposal may therefore preserve `NEEDS_REVIEW` and a null
value. Do not interpret confirmation as `FOUND`, `ACTIVE`, or `PRODUCT_SAFE`.

## Source register

| Code | Role | Source |
|---|---|---|
| `UDEM-A-22` | Baccalauréat en informatique programme/admission page | https://admission.umontreal.ca/programmes/baccalaureat-en-informatique/ |
| `UDEM-A-23` | Maîtrise en informatique programme/admission page | https://admission.umontreal.ca/programmes/maitrise-en-informatique/admission-and-regulations/ |
| `UDEM-REG-23` | Maîtrise en informatique programme regulations | https://admission.umontreal.ca/programmes/maitrise-en-informatique/reglements/ |
| `UDEM-A-24` | DESS en apprentissage automatique programme page | https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/ |
| `UDEM-REG-24` | DESS en apprentissage automatique programme regulations | https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/reglements/ |
| `UDEM-REG` | Tuition/registration context | https://registraire.umontreal.ca/droits-de-scolarite/ |
| `UDEM-F` | UdeM programme finance/context register | https://admission.umontreal.ca/programmes/ |
| `UDEM-PARTNER` | Mila relationship/context | https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/ |

The UdeM pages are multilingual/French-first sources. Preserve original
French wording where it carries scope or legal meaning; an English gloss below
is only an aid to review, not a substitute for the source.

## Programme 22 - Baccalauréat en informatique / BSc

Institution: **Université de Montréal**, Canada  \
Credential in frozen roster: **BSc**  \
Target cycle: **2026-27**  \
Audience/scope: **French + international; programme-specific unless a narrower or broader applicable scope is independently established**  \
Primary source: [`UDEM-A-22`](https://admission.umontreal.ca/programmes/baccalaureat-en-informatique/)  \
Difficulty/stress: **HARD; ML, SA, SF, HC, IE, CF, ADV**

### GT-V2-22-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `Université de Montréal Baccalauréat en informatique (programme 1-175-1-0), Faculté des arts et des sciences.`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The page identifies the Faculté des arts et des sciences, the title `Baccalauréat en informatique`, and the first-cycle code `1-175-1-0`.
- Precise locator: Programme header, `Baccalauréat en informatique`, `1er cycle 1-175-1-0`; programme overview and campus section.
- Programme applicability: Exact first-cycle UdeM programme; preserve faculty, degree level, programme code, campus and any later orientation as separate dimensions.
- Temporal applicability: Page displays Hiver 2027 and Automne 2027 intake controls; target benchmark cycle is 2026-27 and current listing is not formal lifecycle evidence.
- Known competing evidence: Other UdeM computer-science programmes, orientations, and second-cycle programmes are not this identity.
- Risk warning: **IDENTITY / MULTILINGUAL** - do not create another entity for an orientation or translate the title into a different programme.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `BSc / Baccalauréat en informatique`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The official page presents this as a first-cycle, 90-credit `Baccalauréat en informatique`.
- Precise locator: Programme header and `Cours et particularités` section showing `90 crédits` and first-cycle classification.
- Programme applicability: Bachelor credential for the named programme; retain the original French title alongside the normalized BSc label.
- Temporal applicability: Current programme page; exact 2026-27 credential presentation should be checked against the target-cycle convention.
- Known competing evidence: UdeM MSc and DESS pages are different second-cycle credentials.
- Risk warning: **CREDENTIAL** - do not inherit a graduate credential or collapse a programme orientation into a credential.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The current page lists the programme, campus, credits and future intake controls, but does not expose a formal lifecycle label.
- Precise locator: Programme header, intake controls, and `Offert au campus Montréal` section.
- Programme applicability: Listing and intake context only; no `ACTIVE`, `SUSPENDED`, or `DISCONTINUED` assertion is proposed.
- Temporal applicability: Current page contains 2027 intake information while benchmark target is 2026-27.
- Known competing evidence: Intake controls are operational availability evidence, not a formal lifecycle registry.
- Risk warning: **STATUS / CYCLE** - catalogue presence must not be promoted to verified `ACTIVE`.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission and registration context; `UDEM-A-22`, `UDEM-REG`, `UDEM-F`
- Short evidence: The page offers status-dependent estimates and states that a CAD 1,000 international deposit is deducted from first-term tuition; it does not establish one complete programme-wide billed amount.
- Precise locator: `Coûts et aide financière`, `Acompte pour candidatures internationales`, and cost-estimate controls; separate registration/tuition guidance in `UDEM-REG`.
- Programme applicability: Distinguish per-credit or per-term billed tuition, mandatory fees, insurance, residency/status classification, cost of attendance, deposit and scholarships.
- Temporal applicability: Displayed cost estimates are not necessarily the 2026-27 programme bill; target-cycle and student-category applicability require review.
- Known competing evidence: International, Québec/non-Québec, and French/Belgian francophone status selectors produce different estimates; the 90-credit programme duration does not establish a billed total.
- Risk warning: **TUITION / APPLICABILITY** - do not turn a deposit, estimate, or derived 90-credit total into canonical tuition.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The page displays Hiver 2027 and Automne 2027. For the displayed fall intake it gives category-dependent dates including 1 March 2027 or 1 February 2027, plus separate French-proof dates.
- Precise locator: `Dates limites` section; `Déposer la demande d'admission` and `Satisfaire à l'exigence de français` entries for Québec-college versus university/outside-Québec applicants.
- Programme applicability: French and international audiences may follow different applicant categories; application deadline and French-document deadline are separate fields.
- Temporal applicability: Target benchmark cycle is 2026-27; the page's displayed entry terms and date windows do not safely map to one target-cycle value.
- Known competing evidence: Hiver and Automne intake schedules, education-category rules, and French-proof dates differ; do not collapse them.
- Risk warning: **DEADLINE / TEMPORAL / MULTILINGUAL** - record date, entry term, entry year, applicant category and source cycle separately.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The programme page explicitly describes a French-language admission requirement, including accepted French tests/diplomas and B2 oral/reading evidence where proof is required. It does not establish a separate programme-specific English admission rule.
- Precise locator: `Exigence de français à l'admission`, accepted test/diploma and B2 sections.
- Programme applicability: Preserve conditional French rules, exemptions and applicant-language paths; absence of an English rule is not proof of `NOT_REQUIRED`.
- Temporal applicability: Page says the French requirement was revised from Winter 2026; exact target-cycle applicability and English semantics require review.
- Known competing evidence: French proof, post-admission French remediation, and any general English ability are different concepts.
- Risk warning: **LANGUAGE / APPLICABILITY** - do not infer English `NOT_REQUIRED` merely because French is the explicit language requirement.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-22-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-22`
- Short evidence: The page lists a Cote R minimum of 25.0003 and category-specific admissibility/selection conditions, including conditions for university/outside-Québec applicants.
- Precise locator: `Exigences d'admission`, `Conditions d'admissibilité`, `Catégories de candidats`, and `Critères de sélection` sections.
- Programme applicability: Requirements differ for Québec college, university, 24-credit, and outside-Québec pathways; the single international-facing benchmark scope is not yet safely represented by one value.
- Temporal applicability: Current page includes 2027 intake dates and a French requirement effective from Winter 2026; target-cycle mapping requires review.
- Known competing evidence: Cote R, academic-record selection, French proof, DEC pathways, and degree completion are distinct requirement classes.
- Risk warning: **ADMISSIONS / SCOPE** - do not apply the Cote R rule universally or confuse selection criteria and curriculum with one major-admission gate.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

## Programme 23 - Maîtrise en informatique / MSc

Institution: **Université de Montréal**, Canada  \
Credential in frozen roster: **MSc**  \
Target cycle: **2026-27**  \
Audience/scope: **French + international; programme-specific unless a narrower or broader applicable scope is independently established**  \
Primary source: [`UDEM-A-23`](https://admission.umontreal.ca/programmes/maitrise-en-informatique/admission-and-regulations/)  \
Difficulty/stress: **HARD; ML, SA, SF, HC, CF, ADV**

### GT-V2-23-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `Université de Montréal Maîtrise en informatique (programme 2-175-1-0), Faculté des arts et des sciences.`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-23`
- Short evidence: The page identifies the Faculté des arts et des sciences, `Maîtrise en informatique`, second-cycle code `2-175-1-0`, 45 credits and memory/thesis or non-thesis modalities.
- Precise locator: Programme header and modality/credit sections.
- Programme applicability: Exact second-cycle programme; specializations including artificial intelligence and machine learning at MILA remain dimensions of this programme.
- Temporal applicability: Current page shows Hiver 2027, Automne 2027 and Hiver 2028; benchmark target is 2026-27.
- Known competing evidence: DESS en apprentissage automatique and the ML/MILA option are related but not automatically separate programme identities.
- Risk warning: **IDENTITY / RELATED-PARTY** - do not merge the DESS, Mila supervision relationship, or a specialization into a second MSc identity.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `MSc / Maîtrise en informatique`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-23`
- Short evidence: The programme is a 45-credit second-cycle `Maîtrise en informatique` with memory/thesis and non-thesis modalities.
- Precise locator: Programme header, second-cycle code `2-175-1-0`, 45-credit and modality sections.
- Programme applicability: Master credential for the named programme; preserve specializations and study modalities separately.
- Temporal applicability: Current programme page; exact target-cycle credential presentation requires review.
- Known competing evidence: DESS is a separate diploma; the DESS-to-MSc route is not current MSc credential evidence for every applicant.
- Risk warning: **CREDENTIAL** - do not normalize DESS or an ML specialization into a different credential.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-23`
- Short evidence: Current intake controls and programme description are present, but no formal lifecycle status is stated.
- Precise locator: Programme header, intake controls and `Offert au campus Montréal` section.
- Programme applicability: Listing/intake context only; no formal `ACTIVE` claim is proposed.
- Temporal applicability: Displayed intakes are 2027/2028 while target is 2026-27.
- Known competing evidence: Availability of memory/thesis, non-thesis, stage and Mila options does not itself establish lifecycle.
- Risk warning: **STATUS / CYCLE** - do not promote intake availability to formal `ACTIVE`.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission and registration context; `UDEM-A-23`, `UDEM-REG`
- Short evidence: The page shows a 2,260.42 CAD estimate for one full-time 15-credit term under a selected status, separately describes the 1,000 CAD international deposit, and warns that estimates are not invoices. International and other status selectors show different estimates.
- Precise locator: `Coûts et aide financière`, cost-estimate status controls, estimate disclaimer and date-updated text; registration context in `UDEM-REG`.
- Programme applicability: A term estimate is not a complete 45-credit programme tuition schedule; distinguish tuition, mandatory fees, insurance, status, cost of attendance and deposit.
- Temporal applicability: The page states the estimate is calculated for academic year 2025-2026 and is updated 17 July 2025; target is 2026-27.
- Known competing evidence: Memory/thesis, non-thesis and international/status paths have different cost implications.
- Risk warning: **TUITION / TEMPORAL** - do not promote a 2025-26 estimate or arithmetic programme total to 2026-27 tuition.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-23`
- Short evidence: The page lists Hiver 2027, Automne 2027 and Hiver 2028, with application windows 1 February-1 September 2026, 1 August 2026-1 February 2027, and a later opening for Hiver 2028.
- Precise locator: `Dates limites` section immediately below each intake control.
- Programme applicability: Multiple entry terms and two study modalities are displayed; the benchmark does not yet define one deadline representation for this programme.
- Temporal applicability: Target cycle 2026-27 does not uniquely identify whether the benchmark means an entry term or academic-year grouping.
- Known competing evidence: The page's Hiver/Automne/Hiver sequence has different date windows; do not collapse a window into a single date or infer an older cycle.
- Risk warning: **DEADLINE / TEMPORAL** - preserve entry term, entry year, application window and target-cycle convention separately.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-23`
- Short evidence: The general regulation requires French knowledge at the University's minimum level and may require a recognized French test with B2 oral and written comprehension; the special ML option says the candidate must have good knowledge of French and English.
- Precise locator: `Conditions d'admissibilité`, language paragraphs, and `Conditions particulières pour l'option apprentissage automatique`.
- Programme applicability: The general French rule and the ML-option language rule are not one universal English testing policy for all MSc applicants.
- Temporal applicability: Current regulations are available, but exact 2026-27 applicability and any standardized English evidence requirement remain unresolved.
- Known competing evidence: French proof, ML/MILA option conditions, and post-admission or supervisor obligations have different scopes.
- Risk warning: **LANGUAGE / APPLICABILITY** - do not infer English `NOT_REQUIRED`, a universal test threshold, or an ML-option condition for every MSc path.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-23-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `Admission requires the general graduate-education conditions, an appropriate bachelor-level background or equivalent preparation, a first-cycle average of at least 3.0/4.3 or the higher home-institution standard, and at least 40 university credits in computer science and mathematics including calculus, linear algebra, probability/statistics, data structures and algorithms; preparatory or complementary courses may be imposed. The DESS-to-MSc route and supervisor timing remain separate.`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-23`
- Short evidence: The regulation states the bachelor/background, average, 40-credit and prerequisite-course conditions and separately describes the DESS-to-MSc route.
- Precise locator: `1. Conditions d'admissibilité`, especially the bullets on bachelor background, 3.0/4.3 average and 40 credits; language and DESS-transfer paragraphs are separate.
- Programme applicability: Formal admission conditions for Maîtrise en informatique; do not universalize the ML-option Mila form or treat preparatory courses as completed-degree requirements.
- Temporal applicability: Current programme regulation; target 2026-27 applicability and any pathway-specific addenda require review.
- Known competing evidence: Memory/thesis, non-thesis, ML/MILA, DESS transfer and supervisor confirmation have different scopes.
- Risk warning: **ADMISSIONS / SCOPE** - distinguish eligibility, preparation, optional pathway, supervisor timing and later degree requirements.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

## Programme 24 - DESS en apprentissage automatique / DESS

Institution: **Université de Montréal**, Canada  \
Credential in frozen roster: **DESS**  \
Target cycle: **2026-27**  \
Audience/scope: **French + international; programme-specific unless a narrower or broader applicable scope is independently established**  \
Primary source: [`UDEM-A-24`](https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/)  \
Difficulty/stress: **ADVERSARIAL; ML, SA, SF, RP, HC, IE, ADV**

### GT-V2-24-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: `Université de Montréal DESS en apprentissage automatique (programme 2-175-1-2).`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-24`
- Short evidence: The regulation identifies `DESS en apprentissage automatique`, the second-cycle code `2-175-1-2`, and the associated programme description link.
- Precise locator: Regulation header, programme title and code.
- Programme applicability: Exact postgraduate diploma; preserve its relationship to Mila and the possible MSc transfer without creating a second DESS identity.
- Temporal applicability: Current regulation; the benchmark target is 2026-27 and no formal lifecycle status is stated.
- Known competing evidence: The MSc in computer science option apprentissage automatique and Mila supervision form are related pathway/partner evidence, not the same credential.
- Risk warning: **IDENTITY / RELATED-PARTY** - do not merge the DESS with the MSc or use Mila relationship alone as identity proof.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: `DESS / Diplôme d’études supérieures spécialisées en apprentissage automatique`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-24`
- Short evidence: The regulation names the D.E.S.S. and sets its own conditions of admissibility and study structure.
- Precise locator: Regulation title and `Conditions d’admissibilité` section.
- Programme applicability: DESS credential for the named programme; the possible later MSc transfer is not the current DESS credential.
- Temporal applicability: Current regulation; exact 2026-27 presentation remains for review.
- Known competing evidence: Mila supervision and the MSc transfer provisions are separate pathway evidence.
- Risk warning: **CREDENTIAL / PATHWAY** - do not normalize DESS into MSc or treat a possible transfer as current credential truth.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-24`
- Short evidence: The current regulation identifies the programme and its rules but does not state a formal lifecycle status.
- Precise locator: Regulation header and `Conditions d’admissibilité` section.
- Programme applicability: Current listing/regulation context only; no `ACTIVE` claim is proposed.
- Temporal applicability: Regulation is current in the retrieved source, while target cycle is 2026-27.
- Known competing evidence: Minimum study duration and possible MSc transfer are programme rules, not lifecycle status.
- Risk warning: **STATUS / TEMPORAL** - do not infer `ACTIVE` from the existence of a regulation page.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal Admission/finance context; `UDEM-A-24`, `UDEM-REG`, `UDEM-F`
- Short evidence: UdeM cost estimates for the DESS context distinguish tuition from other required fees and exclude insurance, residence, transport and manuals; a 15-credit term estimate is not a complete DESS bill.
- Precise locator: Programme page `Coûts et aide financière`, status/credit estimate and disclaimer; registration/tuition context in `UDEM-REG`.
- Programme applicability: Distinguish per-term tuition, other fees, status/residency, insurance, cost of attendance and any derived total for the DESS.
- Temporal applicability: Retrieved estimates are not a verified complete 2026-27 DESS schedule; target-cycle and registration-load applicability require review.
- Known competing evidence: The MSc rate, the DESS term structure, and any Mila/partner funding are not interchangeable tuition truth.
- Risk warning: **TUITION / SCOPE / TEMPORAL** - do not promote an estimate, fees-inclusive total, or MSc amount as DESS tuition.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official Admission; `UDEM-A-24`
- Short evidence: The DESS programme page contains the admission/intake and `Dates limites` areas, but the retrieved evidence does not establish one unambiguous 2026-27 application-cycle date for the frozen benchmark.
- Precise locator: Programme page intake controls and `Dates limites` section; confirm the selected term and applicant category before scoring.
- Programme applicability: French and international applicants may have different proof and application timing; retain any Mila form deadline separately from the UdeM application deadline.
- Temporal applicability: Target 2026-27; entry term, entry year, application cycle and page-year semantics require independent review.
- Known competing evidence: The Mila supervision form has its own availability/deadline window, which is not automatically the UdeM programme deadline.
- Risk warning: **DEADLINE / PARTNER / TEMPORAL** - do not substitute a Mila deadline or infer a current date from a neighbouring MSc page.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source authority/identity: Université de Montréal official programme regulations; `UDEM-REG-24`
- Short evidence: The DESS regulation says the candidate must have good knowledge of French and English and that the department may request French-language proof; it does not state a standardized English-test threshold.
- Precise locator: `Conditions d’admissibilité`, language paragraph.
- Programme applicability: Preserve qualitative French/English knowledge, conditional French testing and any applicant exemptions as separate semantics.
- Temporal applicability: Current regulation; exact 2026-27 implementation, accepted tests and applicant-category conditions require review.
- Known competing evidence: The central UdeM French admissions process, the DESS rule, and any Mila/partner expectations are different scopes.
- Risk warning: **LANGUAGE / APPLICABILITY** - do not invent English score thresholds or convert qualitative knowledge into universal test-required truth.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

### GT-V2-24-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: `Admission requires the general graduate-education conditions, an appropriate specialized computer-science bachelor background or equivalent preparation, a first-cycle average of at least 3.0/4.3 or the higher home-institution standard, and at least 40 university credits in computer science and mathematics including calculus, linear algebra, probability/statistics, data structures and algorithms; preparatory or complementary courses may be imposed.`
- Source authority/identity: Université de Montréal official DESS regulations; `UDEM-REG-24`
- Short evidence: The regulation explicitly lists the degree/background, 3.0/4.3 average, 40 credits and prerequisite subject conditions, plus possible preparatory/complementary courses.
- Precise locator: `1. Conditions d’admissibilité`, bullets for specialized B.Sc./equivalent, average, 40 credits and prerequisite subjects.
- Programme applicability: Formal DESS admission requirements; keep Mila supervision documentation and possible transfer to MSc as separate pathway semantics.
- Temporal applicability: Current regulation; target 2026-27 applicability and any cycle-specific admissions addenda require review.
- Known competing evidence: The regulation states a minimum study structure and a possible MSc transfer; neither is the same as the initial DESS admission gate.
- Risk warning: **ADMISSIONS / PATHWAY / RELATED-PARTY** - do not turn the optional transfer or partner form into universal DESS identity or credential truth.
- Human decision: [ ] CONFIRM  [ ] AMBIGUOUS  [ ] REJECT  [ ] NOT_APPLICABLE

## Reviewer instructions

For each case select exactly one decision. Do not treat a blank as a
confirmation. A reviewer may confirm a record whose proposed state is
`NEEDS_REVIEW`, mark it `AMBIGUOUS`, reject it for correction, or mark it
`NOT_APPLICABLE` only when that applicability decision is itself established.

Pay particular attention to:

- French original-language evidence and the distinction between French and English requirements;
- target cycle `2026-27` versus displayed 2027/2028 entry terms;
- applicant category and residency/status-dependent tuition estimates;
- DESS/MSc identity and credential boundaries;
- Mila as a related pathway/partner, not an automatic substitute for UdeM evidence;
- programme listing versus formal lifecycle status;
- deadline windows versus a single application date.

Human decision fields above are intentionally blank. No Batch 8 record is
reviewed or scoreable until an independent reviewer responds.
