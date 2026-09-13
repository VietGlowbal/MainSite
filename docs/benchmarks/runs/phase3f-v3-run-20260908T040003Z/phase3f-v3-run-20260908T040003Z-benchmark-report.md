# Phase 3F V3 Benchmark Report — phase3f-v3-run-20260908T040003Z

Benchmark gate classification: **FAIL — SAFETY**

## Run identity and integrity

- Code revision: 38dad5b0e30f7bffff75f6eec9fc2a87c484c484; dirty worktree: None.
- Started: 2026-09-08T04:00:04+00:00; finished: 2026-09-08T04:27:50+00:00.
- Runtime: Python 3.14.3, Node v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Provider/config: deepseek / deepseek-v4-flash; raw mode local; acquisition legacy.
- Frozen input checksum validation: PASS.
- Truth SHA-256: af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc.
- Roster SHA-256: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139.
- Scorer Markdown SHA-256: 71b93dc291e33dccb065e9629db24546236df0f2fd18f57160c8651ee671070f.
- Machine contract SHA-256: 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8.
- Sealed pipeline output SHA-256: b0bacb90c6c4b315cdf9bc710bdb69ac4349b204b754d6265a6809c1a0251b62.

## Execution completeness

- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: 36; failed/partial discovery or processing: 0.
- Programme discovery: 36/36; required-source discovery: 36/36.

## Headline metrics

- Programme discovery recall: 36/36 (100.00%); institution floor: {"status": "AVAILABLE", "min_value": 1.0, "threshold": 0.8, "violating_institutions": []}.
- Required-source discovery recall: 36/36 (100.00%).
- Critical precision: 22/22 (100.00%).
- Critical resolved coverage/recall: 22/122 (18.03%).
- Safe-unresolved correctness: 86/124 (69.35%).
- PRODUCT_SAFE evidence entailment: 0/0.

## Zero-tolerance audit

- false_current_critical: 1 — GT-V2-24-programme_status
- fuzzy_only_auto_merge: 0
- critical_unresolved_conflict_promoted: 0
- critical_source_not_found_promoted: 0
- critical_stale_only_promoted: 0
- prohibited_high_volatility_inferred_critical_promoted: 0
- product_safe_without_durable_provenance: 0

## PRODUCT_SAFE audit

- PRODUCT_SAFE total: 0; deterministic entailment pass: 0; semantic review-required: 0; fail: 0.
- No PRODUCT_SAFE record was emitted by the sealed projection; no product-safe claim was awarded.

## Per-field results

| Field | Scoreable | Correct | Incorrect | Safe unresolved | Coverage loss | Operational failure | False-current | Precision | Resolved coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| programme_identity | 36 | 22 | 0 | 0 | 14 | 10 | 0 | 22/22 (100.00%) | 22/34 (64.71%) |
| credential | 36 | 0 | 0 | 3 | 33 | 9 | 0 | 0/0 | 0/30 (0.00%) |
| programme_status | 36 | 0 | 1 | 23 | 12 | 12 | 1 | 0/0 | 0/0 |
| tuition | 33 | 0 | 0 | 15 | 18 | 8 | 0 | 0/0 | 0/11 (0.00%) |
| application_deadline | 36 | 0 | 0 | 24 | 12 | 9 | 0 | 0/0 | 0/4 (0.00%) |
| english_requirement | 36 | 0 | 0 | 9 | 27 | 11 | 0 | 0/0 | 0/24 (0.00%) |
| major_admissions_requirement | 33 | 0 | 0 | 12 | 21 | 10 | 0 | 0/0 | 0/19 (0.00%) |

## Per-institution results

| Institution | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cornell | 3 | 3 | 100.00% | 21 | 3 | 6 | 0 | 12 | 3/3 (100.00%) | 0 |
| Duke | 3 | 3 | 100.00% | 19 | 3 | 7 | 0 | 9 | 3/3 (100.00%) | 0 |
| ETH Zurich | 3 | 3 | 100.00% | 21 | 3 | 9 | 0 | 9 | 3/3 (100.00%) | 0 |
| Harvard | 3 | 3 | 100.00% | 18 | 1 | 2 | 0 | 15 | 1/1 (100.00%) | 0 |
| MIT | 3 | 3 | 100.00% | 21 | 3 | 11 | 0 | 7 | 3/3 (100.00%) | 0 |
| Northwestern | 3 | 3 | 100.00% | 20 | 3 | 10 | 0 | 7 | 3/3 (100.00%) | 0 |
| Princeton | 3 | 3 | 100.00% | 21 | 0 | 3 | 0 | 18 | 0/0 | 0 |
| Sorbonne Université | 3 | 3 | 100.00% | 21 | 2 | 9 | 0 | 10 | 2/2 (100.00%) | 0 |
| UCLA | 3 | 3 | 100.00% | 21 | 1 | 11 | 0 | 9 | 1/1 (100.00%) | 0 |
| University of Michigan | 3 | 3 | 100.00% | 21 | 0 | 3 | 0 | 18 | 0/0 | 0 |
| University of Tokyo | 3 | 3 | 100.00% | 21 | 0 | 2 | 0 | 19 | 0/0 | 0 |
| Université de Montréal | 3 | 3 | 100.00% | 21 | 3 | 13 | 1 | 4 | 3/3 (100.00%) | 1 |

## Stress-category results

| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| PDF | 14 | 14 | 100.00% | 97 | 7 | 26 | 0 | 64 | {"CONFLICT": 1, "EXTRACTION": 10, "FETCH": 27, "QUALITY_POLICY": 19, "SOURCE_SELECTION": 7} |
| multilingual | 10 | 10 | 100.00% | 70 | 5 | 29 | 1 | 35 | {"CONFLICT": 1, "EXTRACTION": 11, "FETCH": 7, "PROMOTION": 1, "QUALITY_POLICY": 10, "SOURCE_SELECTION": 7} |
| related-party | 8 | 8 | 100.00% | 55 | 6 | 14 | 1 | 34 | {"EXTRACTION": 9, "PROMOTION": 1, "QUALITY_POLICY": 19, "SOURCE_SELECTION": 7} |
| historical | 33 | 33 | 100.00% | 225 | 19 | 76 | 1 | 129 | {"CONFLICT": 2, "EXTRACTION": 14, "FETCH": 48, "PROMOTION": 1, "QUALITY_POLICY": 59, "SOURCE_SELECTION": 7} |
| identity-edge | 16 | 16 | 100.00% | 111 | 9 | 37 | 1 | 64 | {"CONFLICT": 1, "EXTRACTION": 4, "FETCH": 21, "PROMOTION": 1, "QUALITY_POLICY": 32, "SOURCE_SELECTION": 7} |
| conflict-capable | 34 | 34 | 100.00% | 232 | 21 | 84 | 0 | 127 | {"CONFLICT": 2, "EXTRACTION": 13, "FETCH": 41, "QUALITY_POLICY": 64, "SOURCE_SELECTION": 7} |
| adversarial | 27 | 27 | 100.00% | 185 | 16 | 67 | 1 | 101 | {"CONFLICT": 2, "EXTRACTION": 13, "FETCH": 34, "PROMOTION": 1, "QUALITY_POLICY": 46, "SOURCE_SELECTION": 7} |
| structured/catalogue | 17 | 17 | 100.00% | 115 | 10 | 32 | 0 | 73 | {"EXTRACTION": 2, "FETCH": 41, "QUALITY_POLICY": 30} |

## Error taxonomy

{
  "CONFLICT": 2,
  "EXTRACTION": 14,
  "FETCH": 48,
  "GROUND_TRUTH_AMBIGUOUS": 6,
  "PROMOTION": 1,
  "QUALITY_POLICY": 67,
  "SOURCE_SELECTION": 7
}

## P0 candidates

- CONFLICT: GT-V2-11-tuition, GT-V2-25-credential
- QUALITY_POLICY: GT-V2-24-programme_status

## P1 candidates

- EXTRACTION: GT-V2-13-programme_status, GT-V2-18-programme_status, GT-V2-23-major_admissions_requirement, GT-V2-24-english_requirement, GT-V2-25-programme_identity, GT-V2-25-programme_status, GT-V2-32-application_deadline, GT-V2-32-credential, GT-V2-32-english_requirement, GT-V2-32-major_admissions_requirement, GT-V2-32-programme_identity, GT-V2-32-programme_status, GT-V2-32-tuition, GT-V2-34-english_requirement
- FETCH: GT-V2-04-application_deadline, GT-V2-04-credential, GT-V2-04-english_requirement, GT-V2-04-major_admissions_requirement, GT-V2-04-programme_identity, GT-V2-04-programme_status, GT-V2-04-tuition, GT-V2-06-application_deadline, GT-V2-06-credential, GT-V2-06-english_requirement, GT-V2-06-major_admissions_requirement, GT-V2-06-programme_identity, GT-V2-06-programme_status, GT-V2-08-application_deadline, GT-V2-08-credential, GT-V2-08-english_requirement, GT-V2-08-major_admissions_requirement, GT-V2-08-programme_identity, GT-V2-08-programme_status, GT-V2-08-tuition, GT-V2-09-application_deadline, GT-V2-09-credential, GT-V2-09-english_requirement, GT-V2-09-major_admissions_requirement, GT-V2-09-programme_identity, GT-V2-09-programme_status, GT-V2-09-tuition, GT-V2-26-application_deadline, GT-V2-26-credential, GT-V2-26-english_requirement, GT-V2-26-major_admissions_requirement, GT-V2-26-programme_identity, GT-V2-26-programme_status, GT-V2-26-tuition, GT-V2-35-application_deadline, GT-V2-35-credential, GT-V2-35-english_requirement, GT-V2-35-major_admissions_requirement, GT-V2-35-programme_identity, GT-V2-35-programme_status, GT-V2-35-tuition, GT-V2-36-application_deadline, GT-V2-36-credential, GT-V2-36-english_requirement, GT-V2-36-major_admissions_requirement, GT-V2-36-programme_identity, GT-V2-36-programme_status, GT-V2-36-tuition
- QUALITY_POLICY: GT-V2-01-application_deadline, GT-V2-01-credential, GT-V2-01-english_requirement, GT-V2-01-major_admissions_requirement, GT-V2-01-programme_status, GT-V2-01-tuition, GT-V2-02-application_deadline, GT-V2-02-credential, GT-V2-02-english_requirement, GT-V2-02-major_admissions_requirement, GT-V2-02-programme_status, GT-V2-02-tuition, GT-V2-03-application_deadline, GT-V2-03-credential, GT-V2-03-english_requirement, GT-V2-03-major_admissions_requirement, GT-V2-03-programme_status, GT-V2-03-tuition, GT-V2-05-application_deadline, GT-V2-05-credential, GT-V2-05-english_requirement, GT-V2-05-programme_status, GT-V2-07-application_deadline, GT-V2-07-credential, GT-V2-07-english_requirement, GT-V2-07-major_admissions_requirement, GT-V2-07-programme_identity, GT-V2-07-programme_status, GT-V2-07-tuition, GT-V2-10-application_deadline, GT-V2-10-credential, GT-V2-10-english_requirement, GT-V2-10-major_admissions_requirement, GT-V2-10-programme_status, GT-V2-10-tuition, GT-V2-11-application_deadline, GT-V2-11-credential, GT-V2-11-english_requirement, GT-V2-11-programme_status, GT-V2-12-application_deadline, GT-V2-12-credential, GT-V2-12-english_requirement, GT-V2-12-major_admissions_requirement, GT-V2-12-programme_status, GT-V2-13-application_deadline, GT-V2-13-credential, GT-V2-13-english_requirement, GT-V2-13-tuition, GT-V2-14-application_deadline, GT-V2-14-credential, GT-V2-14-english_requirement, GT-V2-14-major_admissions_requirement, GT-V2-14-programme_status, GT-V2-14-tuition, GT-V2-15-application_deadline, GT-V2-15-credential, GT-V2-15-english_requirement, GT-V2-15-major_admissions_requirement, GT-V2-15-programme_status, GT-V2-15-tuition, GT-V2-16-application_deadline, GT-V2-16-credential, GT-V2-16-english_requirement, GT-V2-16-major_admissions_requirement, GT-V2-16-programme_status, GT-V2-16-tuition, GT-V2-17-application_deadline, GT-V2-17-credential, GT-V2-17-english_requirement, GT-V2-17-major_admissions_requirement, GT-V2-17-programme_status, GT-V2-17-tuition, GT-V2-18-application_deadline, GT-V2-18-credential, GT-V2-18-english_requirement, GT-V2-18-major_admissions_requirement, GT-V2-18-tuition, GT-V2-19-application_deadline, GT-V2-19-credential, GT-V2-19-english_requirement, GT-V2-19-major_admissions_requirement, GT-V2-19-programme_identity, GT-V2-19-programme_status, GT-V2-19-tuition, GT-V2-20-application_deadline, GT-V2-20-credential, GT-V2-20-english_requirement, GT-V2-20-major_admissions_requirement, GT-V2-20-programme_status, GT-V2-20-tuition, GT-V2-21-application_deadline, GT-V2-21-credential, GT-V2-21-english_requirement, GT-V2-21-major_admissions_requirement, GT-V2-21-programme_identity, GT-V2-21-programme_status, GT-V2-21-tuition, GT-V2-22-application_deadline, GT-V2-22-credential, GT-V2-22-english_requirement, GT-V2-22-major_admissions_requirement, GT-V2-22-programme_status, GT-V2-22-tuition, GT-V2-23-application_deadline, GT-V2-23-credential, GT-V2-23-english_requirement, GT-V2-23-programme_status, GT-V2-23-tuition, GT-V2-24-application_deadline, GT-V2-24-credential, GT-V2-24-major_admissions_requirement, GT-V2-24-tuition, GT-V2-25-application_deadline, GT-V2-25-english_requirement, GT-V2-25-major_admissions_requirement, GT-V2-25-tuition, GT-V2-28-application_deadline, GT-V2-28-credential, GT-V2-28-english_requirement, GT-V2-28-major_admissions_requirement, GT-V2-28-programme_status, GT-V2-28-tuition, GT-V2-29-application_deadline, GT-V2-29-credential, GT-V2-29-english_requirement, GT-V2-29-major_admissions_requirement, GT-V2-29-programme_status, GT-V2-29-tuition, GT-V2-30-application_deadline, GT-V2-30-credential, GT-V2-30-english_requirement, GT-V2-30-major_admissions_requirement, GT-V2-30-programme_status, GT-V2-30-tuition, GT-V2-31-application_deadline, GT-V2-31-credential, GT-V2-31-english_requirement, GT-V2-31-major_admissions_requirement, GT-V2-31-programme_status, GT-V2-31-tuition, GT-V2-33-application_deadline, GT-V2-33-credential, GT-V2-33-english_requirement, GT-V2-33-major_admissions_requirement, GT-V2-33-programme_status, GT-V2-33-tuition, GT-V2-34-application_deadline, GT-V2-34-credential, GT-V2-34-major_admissions_requirement, GT-V2-34-programme_identity, GT-V2-34-programme_status, GT-V2-34-tuition
- SOURCE_SELECTION: GT-V2-27-application_deadline, GT-V2-27-credential, GT-V2-27-english_requirement, GT-V2-27-major_admissions_requirement, GT-V2-27-programme_identity, GT-V2-27-programme_status, GT-V2-27-tuition

## Ambiguous truth handling

The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: GT-V2-05-major_admissions_requirement, GT-V2-05-tuition, GT-V2-06-tuition, GT-V2-11-major_admissions_requirement, GT-V2-12-tuition, GT-V2-13-major_admissions_requirement.

## Isolation and stop state

The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.
Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.
Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).
Slice F remains NO-GO pending later gates and explicit remediation authorization.

## Artifacts

- Pipeline output: pipeline-output.json; SHA-256 b0bacb90c6c4b315cdf9bc710bdb69ac4349b204b754d6265a6809c1a0251b62.
- Score result: score-result.json; SHA-256 1f26325510afd626f2965b4c502fa1147c8095f79570dd23cff583cedc7c81fd.
- Errors: errors.jsonl; SHA-256 ab5ab2d5c6092ff4c18d506bf4a5521f397ea5885e8bb807088ba8d4ec56dfaf; rows 230.
- Run manifest: run-manifest.json; report: phase3f-v3-run-20260908T040003Z-benchmark-report.md.
