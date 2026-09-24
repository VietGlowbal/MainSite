# Phase 3F Human Review Correction Packet - Batch 8 / Correction 1

Status: **COMPLETE - correction re-review applied**  
Batch: 8 of 12  
Cases: 3  
Prepared: 2026-08-31  

Human re-review result: 3 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.
All three corrected proposals are now confirmed with their corrected semantics.
These three records were rejected during independent human review of the UdeM
Batch 8 packet. The original proposals, rejection reasons, and corrected
proposals are preserved below. The corrected proposals were independently
confirmed on re-review. Do not treat the original `REJECT` as confirmation of
a corrected proposal; the later `CONFIRM` is recorded separately in the
structured artifact.

## GT-V2-22-credential

- Institution: Université de Montréal
- Programme: Baccalauréat en informatique
- Frozen-roster credential: BSc
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: French + international; programme-specific unless a narrower or broader applicable scope is independently established
- Original proposed state: `FOUND`
- Original proposed value: `BSc / Baccalauréat en informatique`
- Original human decision: `REJECT`
- Correction reason: The official evidence establishes the French programme wording, first-cycle classification, and 90-credit size, but does not independently establish the normalized `BSc`, `B.Sc.`, or `Bachelor of Science` label. The frozen-roster label cannot bootstrap its own ground truth.
- Corrected proposed state: `NEEDS_REVIEW`
- Corrected proposed value: `null`
- Candidate source-native evidence: `Baccalauréat en informatique`; `1er cycle`; `90 crédits`.
- Normalized mapping: `Baccalauréat` → `BSc` remains unresolved.
- Source identity/authority: `UDEM-A-22`; Université de Montréal official Admission
- Source URL: https://admission.umontreal.ca/programmes/baccalaureat-en-informatique/
- Precise evidence locator: Programme header and programme-details sections identifying `Baccalauréat en informatique`, first-cycle classification, and `90 crédits`.
- Programme applicability: Exact UdeM first-cycle programme; retain the source-native French wording and normalized credential as separate dimensions.
- Temporal applicability: Target `2026-27`; the source is a current programme page with future intake controls, not an explicitly reviewed credential-normalization statement for the target cycle.
- Known competing evidence: The UdeM master and DESS are separate second-cycle credentials; no reviewed official English-equivalence source is being assumed here.
- Risk warning: **CREDENTIAL / MULTILINGUAL NORMALIZATION** - do not infer `Baccalauréat` → `BSc` without official equivalence evidence or a reviewed normalization policy.
- Human decision for corrected proposal:
  - [ ] CONFIRM
  - [ ] AMBIGUOUS
  - [ ] REJECT
  - [ ] NOT_APPLICABLE

## GT-V2-23-credential

- Institution: Université de Montréal
- Programme: Maîtrise en informatique
- Frozen-roster credential: MSc
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: French + international; programme-specific unless a narrower or broader applicable scope is independently established
- Original proposed state: `FOUND`
- Original proposed value: `MSc / Maîtrise en informatique`
- Original human decision: `REJECT`
- Correction reason: The official evidence establishes the French programme wording, second-cycle classification, programme code, and 45-credit structure, but does not independently establish the normalized `MSc`, `M.Sc.`, or `Master of Science` label. The frozen-roster label cannot bootstrap its own ground truth.
- Corrected proposed state: `NEEDS_REVIEW`
- Corrected proposed value: `null`
- Candidate source-native evidence: `Maîtrise en informatique`; `2e cycle`; programme code `2-175-1-0`; `45 crédits`.
- Normalized mapping: `Maîtrise` → `MSc` remains unresolved.
- Source identity/authority: `UDEM-A-23` and `UDEM-REG-23`; Université de Montréal official Admission and programme regulations
- Source URLs: https://admission.umontreal.ca/programmes/maitrise-en-informatique/admission-and-regulations/ and https://admission.umontreal.ca/programmes/maitrise-en-informatique/reglements/
- Precise evidence locator: Programme header and regulation header identifying `Maîtrise en informatique`, `2-175-1-0`, second-cycle status, and 45-credit programme structure.
- Programme applicability: Exact UdeM second-cycle programme; preserve memory/thesis, non-thesis, ML option, and Mila relationship separately from credential normalization.
- Temporal applicability: Target `2026-27`; current programme/regulation pages do not by themselves establish an English credential-equivalence label for that target cycle.
- Known competing evidence: DESS en apprentissage automatique and the ML/Mila option are separate programme/pathway semantics, not proof of an MSc normalization.
- Risk warning: **CREDENTIAL / MULTILINGUAL NORMALIZATION** - do not infer `Maîtrise` → `MSc` without official equivalence evidence or a reviewed normalization policy.
- Human decision for corrected proposal:
  - [ ] CONFIRM
  - [ ] AMBIGUOUS
  - [ ] REJECT
  - [ ] NOT_APPLICABLE

## GT-V2-24-english_requirement

- Institution: Université de Montréal
- Programme: DESS en apprentissage automatique
- Frozen-roster credential: DESS
- Field: `english_requirement`
- Target cycle: `2026-27`
- Audience/scope: French + international; programme-specific unless a narrower or broader applicable scope is independently established
- Original proposed state: `NEEDS_REVIEW`
- Original proposed value: `null`
- Original human decision: `REJECT`
- Correction reason: The original proposal was too conservative. The official DESS regulation explicitly states that the candidate must have good knowledge of French and English. The absence of a standardized English-test threshold does not erase the qualitative English-language admission requirement.
- Corrected proposed state: `FOUND`
- Corrected proposed value: `Admission to the DESS en apprentissage automatique requires good knowledge of French and English. The department may request proof of French-language proficiency. The reviewed programme regulation does not establish a standardized English-test score threshold.`
- Source identity/authority: `UDEM-REG-24`; Université de Montréal official programme regulations
- Source URL: https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/reglements/
- Precise evidence locator: `1. Conditions d’admissibilité`, language paragraph: the candidate must have a good knowledge of French and English, and the department may require an attestation of French knowledge.
- Programme applicability: Formal language semantics for the DESS; keep French proof, qualitative English knowledge, standardized testing, and Mila/partner expectations separate.
- Temporal applicability: Target `2026-27`; the regulation is current, but no standardized English-test threshold or partner-specific language rule is being asserted.
- Known competing evidence: UdeM central French admissions processes, possible Mila expectations, and any post-admission language requirements are different scopes.
- Risk warning: **LANGUAGE / APPLICABILITY** - preserve qualitative English knowledge as established, but do not invent TOEFL, IELTS, or CEFR thresholds.
- Human decision for corrected proposal:
  - [ ] CONFIRM
  - [ ] AMBIGUOUS
  - [ ] REJECT
  - [ ] NOT_APPLICABLE

## Re-review instructions

Select exactly one decision for each corrected proposal. A corrected proposal
may be confirmed with `FOUND`, confirmed with `NEEDS_REVIEW`, marked
`AMBIGUOUS`, or rejected again. The decision fields above are intentionally
blank until an independent human reviewer responds.

The original review sequence must remain auditable:

```text
original proposal
→ independent human REJECT
→ corrected proposal
→ future independent human re-review
```
