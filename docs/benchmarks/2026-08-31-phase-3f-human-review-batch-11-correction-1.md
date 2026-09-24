# Phase 3F Human Review Correction Packet - Batch 11 / Correction 1

Status: **CLOSED - correction re-review complete**  
Batch: 11 of 12  
Cases: 2  
Prepared: 2026-08-31

These two records were rejected during independent review because the original proposals used Formation Continue evidence without establishing applicability to the frozen initial-formation row. The original proposal, source scope, rejection, corrected proposal, and completed re-review are preserved below. Both corrected proposals received independent human CONFIRM decisions and are now REVIEWED_CONFIRMED in the structured ground-truth queue.

Initial Batch 11 result: 19 CONFIRM, 2 REJECT, 0 AMBIGUOUS, 0 NOT_APPLICABLE.

## GT-V2-31-programme_identity

- Institution: Sorbonne Université
- Programme: Licence d’informatique, parcours monodisciplinaire
- Frozen-roster credential: Licence
- Field: `programme_identity`
- Target cycle: `2026-27`
- Audience/scope: French + international; initial-formation programme scope unless independent review establishes otherwise
- Original proposed state: `FOUND`
- Original proposed value: Licence d’informatique, parcours monodisciplinaire; Sorbonne Université Formation Continue, Informatique, L2-L3, Campus Pierre et Marie Curie.
- Original source identity: SU-FC-31
- Original source authority: Sorbonne Université official Formation Continue page
- Original source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Original human decision: `REJECT`
- Correction reason: Unresolved Formation Continue versus initial-formation source/programme scope applicability.
- Corrected proposed state: `FOUND`
- Corrected proposed value: Sorbonne Université Licence d’Informatique — parcours monodisciplinaire in initial formation within Sciences & Ingénierie; the official programme page describes the monodisciplinary path as part of the Licence d’Informatique.
- Candidate Formation Continue evidence retained: Licence d’informatique, parcours monodisciplinaire; Informatique; L2-L3; Campus Pierre et Marie Curie.
- Candidate Formation Continue source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- New source identity: SU-IF-LICENCE-31
- New source authority: Sorbonne Université official Sciences & Ingénierie initial-formation programme page
- New source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4>
- New evidence: The official initial-formation page names Licence d’Informatique, lists a parcours monodisciplinaire, and describes it within the Sciences & Ingénierie licence offer.
- Precise evidence locator: Page title; Les parcours section; Parcours monodisciplinaire section; page updated 2026-04-08.
- Programme applicability: Direct initial-formation evidence for the frozen Licence d’informatique, parcours monodisciplinaire row. Formation Continue remains separate candidate evidence and is not used to establish equivalence.
- Temporal applicability: Target 2026-27; official initial-formation page was updated 2026-04-08 but does not carry an explicit academic-year label. Human re-review must confirm target-cycle applicability.
- Known competing evidence: Original Formation Continue page names the same French title but shows a Formation Continue scope and a 2023-09-01 to 2025-06-30 session. The central catalogue and initial-formation page are separate source contexts.
- Risk warning: **IDENTITY/SCOPE - direct initial-formation evidence is proposed, but the human reviewer must confirm whether the source maps to the frozen 2026-27 row; do not merge by title alone.**

Human decision for corrected proposal:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-31-major_admissions_requirement

- Institution: Sorbonne Université
- Programme: Licence d’informatique, parcours monodisciplinaire
- Frozen-roster credential: Licence
- Field: `major_admissions_requirement`
- Target cycle: `2026-27`
- Audience/scope: French + international; initial-formation programme scope unless independent review establishes otherwise
- Original proposed state: `FOUND`
- Original proposed value: Applicants are principally expected to have completed and validated Sorbonne Université’s first-year Sciences formelles portal; equivalent university or IUT study and preparatory classes may also be considered, with dossier-based entry into L2 or L3.
- Original source identity: SU-FC-31
- Original source authority: Sorbonne Université official Formation Continue page
- Original source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- Original human decision: `REJECT`
- Correction reason: Unresolved Formation Continue versus initial-formation source/programme scope applicability.
- Corrected proposed state: `FOUND`
- Corrected proposed value: For the initial-formation Licence d’Informatique, access is primarily through Sorbonne Université’s L1 Mathématiques-Informatique or électronique-Informatique portals; limited reorientation from another L1 may be possible subject to pedagogical review, and external applications may be accepted subject to capacity.
- Candidate Formation Continue evidence retained: validated first-year Sciences formelles portal, equivalent university/IUT study, preparatory classes, and possible dossier-based L2/L3 entry.
- Candidate Formation Continue source URL: <https://fc.sorbonne-universite.fr/nos-offres/licence-dinformatique-parcours-monodisciplinaire/>
- New source identity: SU-IF-LICENCE-31
- New source authority: Sorbonne Université official Sciences & Ingénierie initial-formation programme page
- New source URL: <https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4>
- New evidence: The Conditions d’accès section names the two preferred L1 portals, possible limited reorientation, and external applications subject to capacity; the same page identifies the monodisciplinary path after L1.
- Precise evidence locator: Conditions d’accès section; Les parcours / Parcours monodisciplinaire sections; page updated 2026-04-08.
- Programme applicability: Candidate admission requirements are scoped to the initial-formation Licence d’Informatique and are kept distinct from the Formation Continue L2/L3 pathways.
- Temporal applicability: Target 2026-27; page updated 2026-04-08 without an explicit 2026-27 admissions-edition label. Human re-review must confirm cycle applicability.
- Known competing evidence: The rejected Formation Continue proposal lists validated first-year portal, university/IUT, preparatory-class, and dossier-based L2/L3 routes. Those remain candidate FC evidence, not automatic initial-formation gates.
- Risk warning: **ADMISSIONS/SCOPE - preserve initial L1 access, reorientation, and external-capacity branches; do not universalize Formation Continue prerequisites or collapse L1/L2/L3 pathways.**

Human decision for corrected proposal:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Re-review boundary

A re-review CONFIRM accepts the corrected complete record; it does not erase the original rejection and does not automatically establish ACTIVE or PRODUCT_SAFE semantics. If scope equivalence remains unresolved, the reviewer may confirm the corrected proposal with `NEEDS_REVIEW` and null value or mark it ambiguous.


## Correction re-review result

- `GT-V2-31-programme_identity`: CONFIRM
- `GT-V2-31-major_admissions_requirement`: CONFIRM

Batch 11 is CLOSED. The original two REJECT decisions and corrected proposals remain preserved above and in the structured `review_history` records.
