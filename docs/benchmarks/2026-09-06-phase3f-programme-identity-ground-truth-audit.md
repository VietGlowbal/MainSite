# Phase 3F Programme-Identity Ground-Truth Adjudication Audit

Date: 2026-09-06
Scope: exactly the 28 Run #4 `programme_identity` cases with runtime `FOUND` and scorer `incorrect`.
Official run audited: `phase3f-v2-run-20260905T161914Z` (sealed; unchanged).

## Decision summary

**Decision gate: `GT_V2_IDENTITY_CONTRACT_INCONSISTENT`.**

The audit found no independently supported GT-wrong or runtime-wrong case in this bounded population. The frozen GT is factually supported in 27 cases with sufficient evidence; one case is genuinely ambiguous because the official source supports both the MS and PhD variants. However, 27/28 cases expose a representation contract problem: the GT frequently embeds credentials, institution/faculty context, ECTS/duration, stage pathways, or parent/track hierarchy while runtime emits the source-native programme title. The locked scorer compares these representations as unequal.

This is an audit finding only. No GT, scorer, pipeline, or official run was modified. Benchmark #5 and Remediation 9 were not run.

## 1. Methodology and blind protocol

Pass 1 used only routing context, official Run #4 source references/metadata, parsed evidence locators, and temporal metadata. GT values, runtime values, and scorer verdicts were excluded from the Pass-1 rows. The sealed Pass-1 artifact was created before Pass 2:

- `[2026-09-06-phase3f-programme-identity-blind-pass1.jsonl](./audits/2026-09-06-phase3f-programme-identity-blind-pass1.jsonl)` — 28 rows, 28 unique IDs.
- SHA-256: `{PASS1_HASH}`.
- Manifest: `[blind Pass-1 manifest](./audits/2026-09-06-phase3f-programme-identity-blind-pass1-manifest.json)`.

Pass 2 then revealed frozen GT, Run #4 runtime values, and scorer outcomes. A second evidence/contract review was performed for every nontrivial verdict. Reviewer 1 and Reviewer 2 agreed on all 28 cases; third-pass adjudication was therefore required for 0 cases.

Existing Run #4 evidence was used for all cases. Fresh official evidence was added after Pass 1 only for cases 19, 21, 25, 29, 31, 32, and 33; provenance is recorded per row in the matrix.

Case IDs: `GT-V2-01`, `02`, `03`, `05`, `10`, `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20`, `21`, `22`, `23`, `24`, `25`, `27`, `28`, `29`, `30`, `31`, `32`, `33`, and `34` (`programme_identity` for each).

## 2. Population and evidence distribution

- Exact population: **28**; duplicate IDs: **0**.
- Existing Run #4 evidence only: **21**.
- Fresh official evidence required: **7**.
- Unofficial/aggregator evidence used as truth: **0**.
- Search snippets/LLM summaries used as truth: **0**.

The detailed Pass-2 matrix is `[2026-09-06-phase3f-programme-identity-adjudication.jsonl](./audits/2026-09-06-phase3f-programme-identity-adjudication.jsonl)`.

## 3. Verdict counts

| Primary verdict | Count |
|---|---:|
| CANONICALIZATION_MISMATCH | 20 |
| SCORER_CONTRACT_MISMATCH | 1 |
| IDENTITY_GRANULARITY_MISMATCH | 6 |
| GENUINELY_AMBIGUOUS | 1 |
| SEMANTICALLY_EQUIVALENT | 0 (covered by the scorer-contract/representation labels) |
| GT_CONFIRMED as exact primary label | 0 |
| GT_CONFIRMED semantically supported | 27 |
| GT_WRONG | 0 |
| GT_STALE | 0 |
| RUNTIME_WRONG | 0 |
| RUNTIME_CONFIRMED_GT_WRONG | 0 |
| RUNTIME_STALE | 0 |
| BOTH_GT_AND_RUNTIME_WRONG | 0 |
| INSUFFICIENT_EVIDENCE | 0 |

`GT_CONFIRMED` is reported two ways because the required primary-verdict vocabulary separates exact representation mismatches from factual support. On the evidence question, GT is supported in 27/28; among the 27 cases with sufficient evidence for a single adjudication, the GT confirmation rate is **27/27 = 100%**. The remaining case (GT-V2-21) is genuinely ambiguous, not GT-confirmed or GT-wrong.

Representation disagreement is **27/28 = 96.43%**: 20 canonicalization mismatches, 1 scorer-contract mismatch, and 6 granularity mismatches. This is systemic, not a small number of isolated typos.

## 4. Audit-only reconstruction of Run #4 identity quality

| Diagnostic bucket | Count |
|---|---:|
| Runtime directly contradicted by authoritative evidence | 0 |
| Runtime source-supported / not contradicted | 28 |
| Frozen GT factually supported | 27 |
| Semantically equivalent or representation mismatch | 27 |
| Genuine ambiguity | 1 |
| Independent evidence insufficient | 0 |

The official scorer result remains **0/28 identity precision**. The table above is an audit-only diagnostic and is not an alternative benchmark score.

## 5. Representation-policy findings

The current identity contract is internally inconsistent in the observed GT:

- **Credential suffixes:** GT sometimes puts `Bachelor of Science`, `BS`, `MPS`, `MPH`, or `MEng` inside `programme_identity`, even though `credential` is a separate field. Runtime generally preserved the source-native title.
- **Degree level:** GT sometimes requires degree level and sometimes accepts the programme title without it.
- **Master of Science in X:** GT alternates between source-native title, institution-prefixed title, abbreviated credential, and a full descriptive sentence with ECTS/duration.
- **Major vs programme:** UCLA Public Affairs is represented as a stage-specific pre-major-to-major pathway, while other programme identities do not encode comparable lifecycle detail.
- **Programme vs track:** Sorbonne MIND/SAR and the Licence monodisciplinary path require a parent/track hierarchy; a flat string cannot consistently represent both levels.
- **Native/English titles:** Montréal and Sorbonne use official French titles, while GT adds institution, faculty, codes, or English contextualization inconsistently. Native-language identity should not be treated as a runtime error by itself.
- **Official aliases:** CSE SM, MADS, BME, and joint-degree forms are expanded inconsistently; the field needs an explicit alias/credential policy.

Fresh official evidence confirms the hierarchy rather than contradicting the runtime. UCLA explicitly describes the Public Affairs pre-major and later major admission through Luskin ([official UCLA page](https://luskin.ucla.edu/undergraduate-program/public-affairs-major-admissions/prospective-students/)); UCLA CS explicitly allows MS or PhD applications ([official UCLA CS requirements](https://www.cs.ucla.edu/graduate-requirements/)); ETH labels Cyber Security as an ETH Zürich–EPFL MSc major ([official ETH page](https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.leftnav.html)); and Sorbonne separately identifies the Licence/monodisciplinary path, MIND, and SAR pages ([Licence](https://sciences.sorbonne-universite.fr/formation-sciences/offre-de-formation/licences/les-l2-l3-nos-huit-disciplines-de-licence/licence-4), [MIND](https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind), [SAR](https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar)).

## 6. Case-pattern findings

### Credential contamination / canonical enrichment

Cases 01, 02, 03, 05, 10, 11, 12, 13, 16, 17, 18, 20, 22, 23, 24, 27, 28, 29, 30, and 34 are supported by the same official programme identity as runtime, but GT adds credential, institution, faculty, programme code, joint-degree, delivery, or descriptive context. These are `CANONICALIZATION_MISMATCH`, not runtime factual failures.

Examples from the matrix:

| Case | Source-native identity | Frozen GT representation | Runtime finding |
|---|---|---|---|
| GT-V2-01 | Artificial Intelligence and Decision Making (Course 6-4) | Adds `Bachelor of Science` | Source-native title is directly supported; credential belongs to the separate credential field. |
| GT-V2-22 | Baccalauréat en informatique | Adds Montréal, programme code, and faculty | Native French title is official; added context is a canonical representation choice. |
| GT-V2-29 | Master Cyber Security | Adds ETH–EPFL joint-degree, major, ECTS, duration, and language | ETH evidence supports the richer description, but the runtime title is not contradicted. |
| GT-V2-34 | Master of Applied Data Science | Adds MADS, UMSI, online delivery, and institution | Same official degree identity with added context. |

### Programme / track / stage

Cases 15, 19, 25, 31, 32, and 33 are `IDENTITY_GRANULARITY_MISMATCH`: GT and runtime operate at different levels in a dual-degree family, a pre-major/major pathway, a department/degree scope, or a parent/track hierarchy. These require an explicit ontology, not string tuning.

Examples of hierarchy differences include runtime `B.A. in Public Affairs` versus the GT's pre-major-to-major pathway (case 19), runtime `Master Informatique` versus the MIND track (case 32), and runtime `Parcours SAR` versus the parent-plus-track representation (case 33). These are identity-model questions, not evidence-free runtime hallucinations.

### Ambiguity

Case 21 is `GENUINELY_AMBIGUOUS`: the Run #4 official source says Computer Science PhD or MS, while frozen GT selects MS. Fresh UCLA requirements confirm both variants are supported. The evidence does not establish one unique canonical identity for this audit row.

### Temporal identity

No case met the evidence threshold for `GT_STALE` or `RUNTIME_STALE`. Temporal metadata was recorded; case 25 remains medium-confidence because official admissions material spans master’s and doctoral tracks and the target period must be made explicit in any future GT review.

## 7. Reviewer disagreement and human queue

- Reviewer 1 / Reviewer 2 disagreements: **0**.
- Third-pass adjudications: **0**.
- Human-review queue: 8 cases — 14, 15, 19, 21, 25, 31, 32, and 33.

The machine-readable queue is `[2026-09-06-phase3f-programme-identity-human-review-queue.jsonl](./audits/2026-09-06-phase3f-programme-identity-human-review-queue.jsonl)`. It includes all low-confidence, ambiguous, granularity, and scorer-contract cases. Clear high-confidence canonicalization cases remain documented in the full matrix but are not required for manual escalation.

## 8. GT v3 proposals

Proposed GT changes: **0**. No case was adjudicated `RUNTIME_CONFIRMED_GT_WRONG`, `GT_STALE`, or `BOTH_GT_AND_RUNTIME_WRONG`. The empty proposal artifact is `[2026-09-06-phase3f-ground-truth-v3-change-proposals.jsonl](./audits/2026-09-06-phase3f-ground-truth-v3-change-proposals.jsonl)`.

This does not authorize freezing GT v3. Because representation disagreement is systemic, identity semantics should be made explicit and the affected GT rows re-adjudicated before any new freeze.

## 9. Decision gate and recommended next action

**`GT_V2_IDENTITY_CONTRACT_INCONSISTENT`**.

Recommended next action: stop pipeline tuning for `programme_identity`; define and approve a representation contract covering credential separation, institution/faculty context, parent/track/stage hierarchy, official aliases, and native-language titles. Then produce a GT v3 candidate and re-freeze only after human approval. Do not modify GT v2, scorer, Run #4, or run another benchmark in this task.

## 10. Integrity and validation

- GT v2: unchanged; frozen hash validation required by the audit command.
- Official Run #4: unchanged; sealed pipeline hash remains `8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d`.
- Pass-1 artifact: sealed before Pass 2; hash recorded above.
- Exact population and duplicate-ID checks: PASS.
- Evidence references: existing Run #4 refs and the seven recorded official fresh refs.
- Secret scan: PASS for generated audit artefacts.
- `git diff --check`: required and reported after generation.

## 11. Stop condition

This audit stops here. No pipeline, scorer, frozen truth, official run, benchmark #5, or Remediation 9 was run or modified. Slice F remains **NO-GO**.
