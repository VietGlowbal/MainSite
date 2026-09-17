# Phase 3F Human Review Correction Packet - Batch 10 / Correction 1

Status: **CLOSED - correction re-review complete**  
Batch: 10 of 12  
Cases: 2  
Prepared: 2026-08-31  

These two Cyber Security records were rejected during the initial independent review of Batch 10 solely because the exact institutional title contained literal mojibake (`â€“`). The underlying joint ETH Zurich/EPF Lausanne programme semantics were not rejected. Original values, rejection reasons, corrected proposals, and the completed re-review are preserved below.

Initial Batch 10 result: 19 CONFIRM, 2 REJECT, 0 AMBIGUOUS, 0 NOT_APPLICABLE. Correction re-review result: 2 CONFIRM, 0 AMBIGUOUS, 0 REJECT, 0 NOT_APPLICABLE.

## GT-V2-29-programme_identity

- Institution: ETH Zurich / EPF Lausanne
- Programme: Cyber Security
- Frozen-roster credential: MSc
- Field: `programme_identity`
- Target cycle: `2026-27`
- Audience/scope: international; programme-specific joint ETH Zurich/EPF Lausanne Master programme
- Original proposed state: `FOUND`
- Original proposed value: Master of Science ETH Zurich â€“ EPF Lausanne in Computer Science Major in Cyber Security; a 120 ECTS, two-year joint ETH Zurich/EPFL programme taught in English.
- Original human decision: `REJECT`
- Correction reason: The original exact-string value contains mojibake (`â€“`) for the institutional en dash. Correct the encoding without changing programme identity or joint-programme semantics.
- Corrected proposed state: `FOUND`
- Corrected proposed value: Master of Science ETH Zurich – EPF Lausanne in Computer Science Major in Cyber Security; a 120 ECTS, two-year joint ETH Zurich/EPFL programme taught in English.
- Source identity: ETH-A-29
- Source authority: ETH Zurich and EPF Lausanne joint programme official page
- Source URL: <https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.leftnav.html>
- Precise evidence locator: `Page title and sections programme description; Language of instruction; Credits | duration; Academic title.`
- Programme applicability: Exact joint programme identity/award; preserve ETH Zurich, EPF Lausanne, Computer Science major, Cyber Security focus, 120 ECTS, two years, joint-programme relationship, and English instruction.
- Temporal applicability: Target 2026-27. The official programme page is current context but does not state a formal lifecycle or award-effective date for the benchmark cycle.
- Known competing evidence: The Cyber Security appendix and brochure use the same joint award family; the continuing-education MAS Cyber Security and generic Computer Science MSc are separate programmes.
- Risk warning: **ENCODING/IDENTITY - the original mojibake is retained only in audit history; do not shorten or merge the corrected joint title.**
- Encoding-integrity note: The structured JSONL and the original Batch 10 Markdown proposal contained the literal mojibake `â€“` in this case. The corrected structured value uses Unicode U+2013 EN DASH (`–`). No unrelated records are being changed by this correction.

Human decision for corrected proposal:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## GT-V2-29-credential

- Institution: ETH Zurich / EPF Lausanne
- Programme: Cyber Security
- Frozen-roster credential: MSc
- Field: `credential`
- Target cycle: `2026-27`
- Audience/scope: international; programme-specific joint ETH Zurich/EPF Lausanne Master programme
- Original proposed state: `FOUND`
- Original proposed value: Master of Science ETH Zurich â€“ EPF Lausanne in Computer Science Major in Cyber Security.
- Original human decision: `REJECT`
- Correction reason: The original exact-string award contains mojibake (`â€“`) for the institutional en dash. Correct the encoding without shortening the joint award or changing its meaning.
- Corrected proposed state: `FOUND`
- Corrected proposed value: Master of Science ETH Zurich – EPF Lausanne in Computer Science Major in Cyber Security
- Source identity: ETH-A-29
- Source authority: ETH Zurich and EPF Lausanne joint programme official page
- Source URL: <https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.leftnav.html>
- Precise evidence locator: `Page title and sections programme description; Language of instruction; Credits | duration; Academic title.`
- Programme applicability: Exact joint programme identity/award; preserve ETH Zurich, EPF Lausanne, Computer Science major, Cyber Security focus, 120 ECTS, two years, joint-programme relationship, and English instruction.
- Temporal applicability: Target 2026-27. The official programme page is current context but does not state a formal lifecycle or award-effective date for the benchmark cycle.
- Known competing evidence: The Cyber Security appendix and brochure use the same joint award family; the continuing-education MAS Cyber Security and generic Computer Science MSc are separate programmes.
- Risk warning: **ENCODING/IDENTITY - the original mojibake is retained only in audit history; do not shorten or merge the corrected joint title.**
- Encoding-integrity note: The structured JSONL and the original Batch 10 Markdown proposal contained the literal mojibake `â€“` in this case. The corrected structured value uses Unicode U+2013 EN DASH (`–`). No unrelated records are being changed by this correction.

Human decision for corrected proposal:

- [ ] CONFIRM
- [ ] AMBIGUOUS
- [ ] REJECT
- [ ] NOT_APPLICABLE

## Re-review instructions

Select exactly one decision per corrected case. A re-review CONFIRM accepts the corrected complete record; it does not independently alter `expected_state`.


## Correction re-review result

Both corrected Cyber Security cases received independent human CONFIRM decisions on 2026-08-31. The original REJECT decisions and mojibake values remain preserved as audit history; the corrected proposals are now REVIEWED_CONFIRMED in the structured queue.
