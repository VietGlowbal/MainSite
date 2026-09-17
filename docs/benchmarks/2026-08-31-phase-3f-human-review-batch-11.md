# Phase 3F Human Review Packet - Batch 11

Status: **CLOSED - correction re-review complete**  
Batch: 11 of 12  
Programmes: Sorbonne Université rows 31-33  
Cases: 21 (7 critical fields per programme)  
Target cycle: 2026-27  
Prepared: 2026-08-31  

Initial Batch 11 result: 19 CONFIRM, 2 REJECT, 0 AMBIGUOUS, 0 NOT_APPLICABLE. Correction re-review result: 2 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE. Batch 11 is CLOSED.

This packet preserves the original proposal form; final decisions are recorded in the structured ground-truth queue and Batch 11 Correction 1 packet. The original blank decision controls remain as audit history. The proposals were prepared from the frozen roster and independent official-source evidence; no v3 output was used.

## Review decisions

For each case select exactly one: `CONFIRM`, `AMBIGUOUS`, `REJECT`, or `NOT_APPLICABLE`.

## Programme 31 — Licence d’informatique, parcours monodisciplinaire

- Institution: Sorbonne Université
- Frozen-roster credential: Licence
- Target cycle: 2026-27
- Audience: French + international

### GT-V2-31-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: Licence d’informatique, parcours monodisciplinaire; Sorbonne Université Formation Continue, Informatique, L2-L3, Campus Pierre et Marie Curie.
- Source identity: SU-FC-31
- Source authority: Sorbonne Université official Formation Continue page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The page title names the licence d’informatique parcours monodisciplinaire and lists Informatique, two university years L2-L3, and the Pierre et Marie Curie campus.
- Precise evidence locator: Page title; Domaine; formation metadata; L2-L3 / location block.
- Programme applicability: Exact programme title is established, but the source is a Formation Continue page and its administrative/entry-cycle scope must be checked against the frozen initial-formation row.
- Temporal applicability: Target 2026-27; Page updated 2025-03-12; listed session runs 2023-09-01 to 2025-06-30; no explicit 2026-27 edition.
- Known competing evidence: Central Sorbonne Sciences links a separate initial-formation licence context; do not silently merge it with the Formation Continue listing.
- Risk warning: **IDENTITY/SCOPE - preserve the exact French title and distinguish Formation Continue from initial formation.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: Licence d’informatique, parcours monodisciplinaire; the source categorizes it under Diplômes nationaux: Licences.
- Source identity: SU-FC-31
- Source authority: Sorbonne Université official Formation Continue page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The page labels the offer as a national diploma in the Licences category and names the licence d’informatique parcours monodisciplinaire.
- Precise evidence locator: Domaine / Diplômes nationaux metadata; page title.
- Programme applicability: Source-native credential is Licence. No English degree normalization is proposed.
- Temporal applicability: Target 2026-27; Page updated 2025-03-12; no 2026-27 credential edition is stated.
- Known competing evidence: The page also uses Formation Continue and includes a professional-training context; do not treat that as a different credential without reviewed scope evidence.
- Risk warning: **CREDENTIAL/SCOPE - retain source-native Licence and do not infer an English equivalence.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-FC-31
- Source authority: Sorbonne Université official Formation Continue page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The page is listed and provides programme metadata, but it does not assert an explicit lifecycle state such as active, suspended, or discontinued.
- Precise evidence locator: Page title, update date, session metadata, and programme availability block.
- Programme applicability: Current page presence is evidence of a listing, not lifecycle proof for the 2026-27 frozen row.
- Temporal applicability: Target 2026-27; Page updated 2025-03-12; displayed session ends 2025-06-30.
- Known competing evidence: Central 2026-27 registration material is a different temporal and administrative source.
- Risk warning: **STATUS/TEMPORAL - do not infer ACTIVE from page presence or an expired session listing.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-FC-31 + SU-FEE-2026
- Source authority: Sorbonne Université official Formation Continue and central registration page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The Formation Continue page displays Tarif: 8000 €, while the central 2026-27 page lists national registration rights of 178 € for Licence; these are not the same billing scope.
- Precise evidence locator: Formation metadata Tarif block; central page section Montants des tarifs d’inscription, 2026-2027.
- Programme applicability: The 8000 € amount may be a Formation Continue price and 178 € is a national registration right; applicability to the frozen benchmark row is unresolved.
- Temporal applicability: Target 2026-27; FC page updated 2025-03-12; central source updated 2026-07-16 and states 2026-27 rates.
- Known competing evidence: 8000 € continuing-education tariff versus 178 € national Licence registration right; fees and tuition are separate.
- Risk warning: **FINANCE/SCOPE - do not choose or derive one canonical tuition amount from these different scopes.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-A-2026 + SU-FC-31
- Source authority: Sorbonne Université official central registration and Formation Continue pages
- Source URL: <https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes>
- Short evidence: The central page says 2026-27 candidature/inscription operations are governed by university deadlines and the relevant decree is in publication; the Formation Continue page exposes a calendar control but no date in the retrieved content.
- Precise evidence locator: Central page sections Arrêté ... 2026-2027 and candidature/inscription timing; FC page Candidater / Calendrier blocks.
- Programme applicability: No programme-specific 2026-27 deadline is established. Do not substitute a generic registration deadline for an application deadline.
- Temporal applicability: Target 2026-27; Central source updated 2026-07-16; the 2026-27 decree is explicitly described as in publication.
- Known competing evidence: Application, administrative registration, and Formation Continue calendar dates may be different processes.
- Risk warning: **DEADLINE/TEMPORAL - preserve unresolved cycle and process applicability; do not manufacture a date.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-FC-31
- Source authority: Sorbonne Université official Formation Continue page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The page lists aptitude for written or oral expression in English as a competence, but does not state an admissions English requirement or test policy.
- Precise evidence locator: Compétences visées section, English-expression bullet.
- Programme applicability: Competence/course outcome is not an admissions-language rule. No English test requirement or exemption is established.
- Temporal applicability: Target 2026-27; Page updated 2025-03-12; no target-cycle admissions language policy is stated.
- Known competing evidence: French-language admission/teaching context and English competence are distinct fields.
- Risk warning: **LANGUAGE/APPLICABILITY - do not infer REQUIRED or NOT_REQUIRED from a competence statement.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-31-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: Applicants are principally expected to have completed and validated Sorbonne Université’s first-year Sciences formelles portal; equivalent university or IUT study and preparatory classes may also be considered, with dossier-based entry into L2 or L3.
- Source identity: SU-FC-31
- Source authority: Sorbonne Université official Formation Continue page
- Source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Short evidence: The Public & Pré-requis section names the preferred first-year portal, equivalent university/IUT and preparatory-class routes, and possible L2/L3 entry.
- Precise evidence locator: PUBLIC VISÉ ET PRÉ-REQUIS section.
- Programme applicability: These are entry/prerequisite pathways for the listed licence; keep them separate from curriculum and degree completion.
- Temporal applicability: Target 2026-27; Page updated 2025-03-12; exact 2026-27 admissions cycle is not stated.
- Known competing evidence: The page describes preferred and alternative routes, not a universal Cote R-style threshold.
- Risk warning: **ADMISSIONS/SCOPE - retain conditional pathways and do not turn preferred preparation into a universal gate.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 32 — Master Informatique, MIND

- Institution: Sorbonne Université
- Frozen-roster credential: Master
- Target cycle: 2026-27
- Audience: French + international

### GT-V2-32-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: Master Informatique — parcours Machine learning, INtelligence artificielle et Données (MIND), Sorbonne Université Sciences & Ingénierie.
- Source identity: SU-MIND-32
- Source authority: Sorbonne Université official Sciences & Ingénierie programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind>
- Short evidence: The MIND page names the parcours and describes its data science and artificial-intelligence focus; the central Master Informatique page lists MIND among the mention’s parcours.
- Precise evidence locator: MIND page title and introductory paragraph; central Master Informatique parcours list.
- Programme applicability: Exact MIND parcours identity is established. Keep it distinct from the Master mention, DAC historical name, and other parcours.
- Temporal applicability: Target 2026-27; MIND page updated 2026-07-07; central Master Informatique page updated 2026-02-12.
- Known competing evidence: The page says MIND was previously named DAC; that is an alias/history relationship, not a second current identity.
- Risk warning: **IDENTITY/ALIAS - preserve MIND as the current parcours and record DAC only as historical alias context.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: Master Informatique — parcours Machine learning, INtelligence artificielle et Données (MIND).
- Source identity: SU-MIND-32
- Source authority: Sorbonne Université official Sciences & Ingénierie programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique>
- Short evidence: The official catalogue page identifies the formation as Master Informatique and lists the MIND parcours; the MIND page provides the parcours title.
- Precise evidence locator: Master Informatique page title and parcours list; MIND page title.
- Programme applicability: Source-native benchmark credential is Master; no unscoped English award normalization is asserted.
- Temporal applicability: Target 2026-27; Master page updated 2026-02-12; MIND page updated 2026-07-07.
- Known competing evidence: MIND is a parcours within the Master mention, not a separate generic Data Science credential.
- Risk warning: **CREDENTIAL/SCOPE - keep mention, parcours, and any normalized award label separate.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-MIND-32
- Source authority: Sorbonne Université official Sciences & Ingénierie programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind>
- Short evidence: The current MIND page and update date establish a current programme page, not an explicit lifecycle state.
- Precise evidence locator: Page title, update date, and programme presentation.
- Programme applicability: Listing and curriculum presence do not prove ACTIVE for the 2026-27 benchmark cycle.
- Temporal applicability: Target 2026-27; MIND page updated 2026-07-07; no formal lifecycle field is stated.
- Known competing evidence: Historical DAC naming and current MIND presentation must not be collapsed into lifecycle assertions.
- Risk warning: **STATUS - do not infer ACTIVE from a current page or curriculum.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-FEE-2026
- Source authority: Sorbonne Université official central registration page
- Source URL: <https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes>
- Short evidence: The central page lists 2026-27 national registration rights of 255 € for Cursus Master; it does not provide a complete MIND tuition/billing statement.
- Precise evidence locator: Montants des tarifs d’inscription, Droits d’inscription pour l’année 2026-2027.
- Programme applicability: 255 € is a registration right, not established programme tuition or total cost for MIND.
- Temporal applicability: Target 2026-27; Central source updated 2026-07-16; rates explicitly apply to 2026-27.
- Known competing evidence: Programme tuition, registration rights, CVEC, exemptions, and cost of attendance remain separate.
- Risk warning: **FINANCE/LINEAGE - do not promote the central Master registration right as complete MIND tuition.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-A-2026
- Source authority: Sorbonne Université official central registration page
- Source URL: <https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes>
- Short evidence: The central page says candidature and inscription deadlines are fixed by the university presidency and references the 2026-27 decree, but gives no MIND-specific application date.
- Precise evidence locator: Sections Arrêté relatif aux modalités ... 2026-2027 and candidature/inscription deadlines.
- Programme applicability: No single MIND 2026-27 deadline is established; administrative registration timing must not be substituted.
- Temporal applicability: Target 2026-27; Central source updated 2026-07-16; 2026-27 decree described as in publication.
- Known competing evidence: MIND page has no reviewed 2026-27 deadline in the available evidence; other Master parcours may have different processes.
- Risk warning: **DEADLINE/TEMPORAL - leave unresolved rather than infer a date from another parcours.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-MIND-32
- Source authority: Sorbonne Université official MIND programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind>
- Short evidence: The MIND curriculum lists an Anglais UE as mandatory, but the page does not establish an admissions English-language test, threshold, waiver, or exemption policy.
- Precise evidence locator: MIND page M1-S2 section, mandatory UE table containing Anglais.
- Programme applicability: Curriculum English coursework is not evidence of an admissions English requirement.
- Temporal applicability: Target 2026-27; MIND page updated 2026-07-07; no target-cycle admissions language policy stated.
- Known competing evidence: French programme pages, English course content, and any international admissions rules are different scopes.
- Risk warning: **LANGUAGE/APPLICABILITY - do not infer an admissions requirement or NOT_REQUIRED from the Anglais course.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-32-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `FOUND`
- Proposed expected value: M1 recruitment is primarily at L3 or equivalent in Informatique or Informatique/Mathématiques; motivated scientific applicants may be considered. Applicants must have solid computer-science knowledge in algorithmics/programming, databases, and logic, plus foundations in probability, statistics, analysis, and algebra. Some compatible external M2 applicants may also be considered.
- Source identity: SU-MIND-32
- Source authority: Sorbonne Université official MIND programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind>
- Short evidence: The Public visé et prérequis section states the M1/M2 entry levels and the required computing and mathematics preparation.
- Precise evidence locator: PUBLIC VISÉ ET PRÉREQUIS section.
- Programme applicability: These are programme entry prerequisites; keep them separate from the MIND curriculum, recommended UE, and degree completion.
- Temporal applicability: Target 2026-27; MIND page updated 2026-07-07; no separate 2026-27 admissions edition is stated.
- Known competing evidence: The page permits motivated scientific applicants and some M2 external applicants; requirements are conditional by entry level.
- Risk warning: **ADMISSIONS/SCOPE - preserve M1 versus M2 pathways and do not flatten conditional entry routes.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Programme 33 — Master Informatique, SAR

- Institution: Sorbonne Université
- Frozen-roster credential: Master
- Target cycle: 2026-27
- Audience: French + international

### GT-V2-33-programme_identity

- Field: `programme_identity`
- Proposed expected state: `FOUND`
- Proposed expected value: Master Informatique — parcours Systèmes et Applications Répartis (SAR), Sorbonne Université Sciences & Ingénierie.
- Source identity: SU-SAR-33
- Source authority: Sorbonne Université official Sciences & Ingénierie SAR page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar>
- Short evidence: The SAR page names the parcours and describes distributed systems; the central Master Informatique page lists SAR among the mention’s parcours.
- Precise evidence locator: SAR page title and presentation; central Master Informatique parcours list.
- Programme applicability: Exact SAR parcours identity is established. Keep it distinct from the Master mention, other parcours, and partner laboratory relationships.
- Temporal applicability: Target 2026-27; SAR page updated 2024-09-27; central Master Informatique page updated 2026-02-12.
- Known competing evidence: LIP6, LTCI, and IRCAM are supporting institutions/laboratories, not duplicate SAR programme identities.
- Risk warning: **IDENTITY/PARTNER - preserve SAR as one parcours and keep laboratory relationships separate.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-credential

- Field: `credential`
- Proposed expected state: `FOUND`
- Proposed expected value: Master Informatique — parcours Systèmes et Applications Répartis (SAR).
- Source identity: SU-SAR-33
- Source authority: Sorbonne Université official Sciences & Ingénierie programme pages
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/masters/master-informatique>
- Short evidence: The central page identifies Master Informatique and lists SAR; the SAR page supplies the exact parcours title.
- Precise evidence locator: Master Informatique page title and SAR list; SAR page title.
- Programme applicability: Source-native benchmark credential is Master; no additional English award normalization is asserted.
- Temporal applicability: Target 2026-27; Central page updated 2026-02-12; SAR page updated 2024-09-27.
- Known competing evidence: SAR is a parcours within the Master mention, not a separate generic systems degree.
- Risk warning: **CREDENTIAL/SCOPE - preserve mention and parcours separately from normalized award nomenclature.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-programme_status

- Field: `programme_status`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-SAR-33
- Source authority: Sorbonne Université official Sciences & Ingénierie SAR page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar>
- Short evidence: The SAR page presents the programme and curriculum but does not state an explicit lifecycle state.
- Precise evidence locator: Page title, update date, presentation, and programme sections.
- Programme applicability: Programme presentation is not formal ACTIVE evidence for 2026-27.
- Temporal applicability: Target 2026-27; SAR page updated 2024-09-27; no 2026-27 lifecycle marker is stated.
- Known competing evidence: The central Master page is newer but also does not supply a formal lifecycle assertion.
- Risk warning: **STATUS/TEMPORAL - do not infer ACTIVE from a visible curriculum or current parent page.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-tuition

- Field: `tuition`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-FEE-2026
- Source authority: Sorbonne Université official central registration page
- Source URL: <https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes>
- Short evidence: The central page lists 2026-27 national registration rights of 255 € for Cursus Master, not a complete SAR tuition schedule.
- Precise evidence locator: Montants des tarifs d’inscription, Droits d’inscription pour l’année 2026-2027.
- Programme applicability: 255 € is a registration right and cannot be promoted to complete SAR tuition or programme cost.
- Temporal applicability: Target 2026-27; Central source updated 2026-07-16; rates explicitly apply to 2026-27.
- Known competing evidence: Registration rights, CVEC, exemptions, other fees, and any programme billing remain separate.
- Risk warning: **FINANCE/LINEAGE - do not use the central Master registration right as full SAR tuition.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-application_deadline

- Field: `application_deadline`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-A-2026
- Source authority: Sorbonne Université official central registration page
- Source URL: <https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes>
- Short evidence: The central page states that candidature and inscription deadlines are fixed by the university presidency and references the 2026-27 decree, but no SAR-specific application deadline is provided.
- Precise evidence locator: Sections Arrêté relatif aux modalités ... 2026-2027 and candidature/inscription deadlines.
- Programme applicability: No single SAR 2026-27 deadline is established. Do not use a generic registration deadline or another parcours deadline.
- Temporal applicability: Target 2026-27; Central source updated 2026-07-16; 2026-27 decree described as in publication.
- Known competing evidence: Application, registration, and any partner/laboratory timing are separate processes.
- Risk warning: **DEADLINE/TEMPORAL - preserve unresolved programme and cycle applicability.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-english_requirement

- Field: `english_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-SAR-33
- Source authority: Sorbonne Université official SAR programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar>
- Short evidence: The SAR page describes a French-language programme context and curriculum but does not establish an admissions English test, threshold, exemption, or explicit NOT_REQUIRED state.
- Precise evidence locator: SAR page title, presentation, and programme sections.
- Programme applicability: No admissions English truth is established; curriculum/laboratory language cannot determine applicant requirements.
- Temporal applicability: Target 2026-27; SAR page updated 2024-09-27; no 2026-27 language-policy edition is stated.
- Known competing evidence: Any central international policy or partner requirement would require separate applicability review.
- Risk warning: **LANGUAGE/APPLICABILITY - do not infer NOT_REQUIRED from omission.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

### GT-V2-33-major_admissions_requirement

- Field: `major_admissions_requirement`
- Proposed expected state: `NEEDS_REVIEW`
- Proposed expected value: `null`
- Source identity: SU-SAR-33
- Source authority: Sorbonne Université official SAR programme page
- Source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar>
- Short evidence: The SAR page provides programme objectives, partner laboratories, and M1/M2 curriculum structure, but no complete programme-specific admissions gate set.
- Precise evidence locator: Présentation and Programme sections; M1/M2 UE structure.
- Programme applicability: Curriculum and partner context do not establish admission prerequisites, selection criteria, or application documents.
- Temporal applicability: Target 2026-27; SAR page updated 2024-09-27; exact 2026-27 admissions requirements are not stated.
- Known competing evidence: Central Master admissions and 2026 decisions/PDFs may add rules but were not collapsed into this proposal.
- Risk warning: **ADMISSIONS/CURRICULUM - do not convert course structure or partner context into entry requirements.**

Human decision:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Review boundary

A human decision confirms or rejects the complete proposed record; it does not automatically convert `NEEDS_REVIEW` to `FOUND`, and it does not establish `ACTIVE` or PRODUCT_SAFE semantics by itself. Preserve source-native French wording and keep programme, parcours, credential, fee, deadline, language, and curriculum scopes separate.
