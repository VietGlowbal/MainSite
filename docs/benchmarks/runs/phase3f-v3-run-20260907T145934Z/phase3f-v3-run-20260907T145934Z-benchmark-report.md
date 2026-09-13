# Phase 3F V3 Benchmark Report — phase3f-v3-run-20260907T145934Z

Benchmark gate classification: **FAIL — QUALITY**

## Run identity and integrity

- Code revision: fc0746260b2ba541a01448a8a43e6dc35ccae317; dirty worktree: None.
- Started: 2026-09-07T14:59:34+00:00; finished: 2026-09-07T15:26:18+00:00.
- Runtime: Python 3.14.3, Node v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Provider/config: deepseek / deepseek-v4-flash; raw mode local; acquisition legacy.
- Frozen input checksum validation: PASS.
- Truth SHA-256: af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc.
- Roster SHA-256: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139.
- Scorer Markdown SHA-256: 71b93dc291e33dccb065e9629db24546236df0f2fd18f57160c8651ee671070f.
- Machine contract SHA-256: 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8.
- Sealed pipeline output SHA-256: df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4.

## Execution completeness

- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: 36; failed/partial discovery or processing: 0.
- Programme discovery: 36/36; required-source discovery: 36/36.

## Headline metrics

- Programme discovery recall: 36/36 (100.00%); institution floor: {"status": "AVAILABLE", "min_value": 1.0, "threshold": 0.8, "violating_institutions": []}.
- Required-source discovery recall: 36/36 (100.00%).
- Critical precision: 20/25 (80.00%).
- Critical resolved coverage/recall: 20/122 (16.39%).
- Safe-unresolved correctness: 88/124 (70.97%).
- PRODUCT_SAFE evidence entailment: 0/0.

## Zero-tolerance audit

- false_current_critical: 0
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
| programme_identity | 36 | 20 | 5 | 0 | 11 | 8 | 0 | 20/25 (80.00%) | 20/34 (58.82%) |
| credential | 36 | 0 | 0 | 3 | 33 | 8 | 0 | 0/0 | 0/30 (0.00%) |
| programme_status | 36 | 0 | 0 | 25 | 11 | 11 | 0 | 0/0 | 0/0 |
| tuition | 33 | 0 | 0 | 15 | 18 | 7 | 0 | 0/0 | 0/11 (0.00%) |
| application_deadline | 36 | 0 | 0 | 24 | 12 | 8 | 0 | 0/0 | 0/4 (0.00%) |
| english_requirement | 36 | 0 | 0 | 9 | 27 | 9 | 0 | 0/0 | 0/24 (0.00%) |
| major_admissions_requirement | 33 | 0 | 0 | 12 | 21 | 8 | 0 | 0/0 | 0/19 (0.00%) |

## Per-institution results

| Institution | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cornell | 3 | 3 | 100.00% | 21 | 3 | 5 | 0 | 13 | 3/3 (100.00%) | 0 |
| Duke | 3 | 3 | 100.00% | 19 | 3 | 7 | 0 | 9 | 3/3 (100.00%) | 0 |
| ETH Zurich | 3 | 3 | 100.00% | 21 | 3 | 9 | 0 | 9 | 3/3 (100.00%) | 0 |
| Harvard | 3 | 3 | 100.00% | 18 | 1 | 2 | 0 | 15 | 1/1 (100.00%) | 0 |
| MIT | 3 | 3 | 100.00% | 21 | 3 | 10 | 0 | 8 | 3/3 (100.00%) | 0 |
| Northwestern | 3 | 3 | 100.00% | 20 | 3 | 10 | 0 | 7 | 3/3 (100.00%) | 0 |
| Princeton | 3 | 3 | 100.00% | 21 | 0 | 3 | 0 | 18 | 0/0 | 0 |
| Sorbonne Université | 3 | 3 | 100.00% | 21 | 1 | 9 | 1 | 10 | 1/2 (50.00%) | 0 |
| UCLA | 3 | 3 | 100.00% | 21 | 1 | 11 | 0 | 9 | 1/1 (100.00%) | 0 |
| University of Michigan | 3 | 3 | 100.00% | 21 | 0 | 3 | 1 | 17 | 0/1 (0.00%) | 0 |
| University of Tokyo | 3 | 3 | 100.00% | 21 | 1 | 5 | 1 | 14 | 1/2 (50.00%) | 0 |
| Université de Montréal | 3 | 3 | 100.00% | 21 | 1 | 14 | 2 | 4 | 1/3 (33.33%) | 0 |

## Stress-category results

| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| PDF | 14 | 14 | 100.00% | 97 | 7 | 29 | 2 | 59 | {"CONFLICT": 3, "EXTRACTION": 7, "FETCH": 27, "IDENTITY": 2, "QUALITY_POLICY": 22} |
| multilingual | 10 | 10 | 100.00% | 70 | 3 | 33 | 4 | 30 | {"CONFLICT": 2, "EXTRACTION": 8, "FETCH": 7, "IDENTITY": 4, "QUALITY_POLICY": 13} |
| related-party | 8 | 8 | 100.00% | 55 | 7 | 16 | 0 | 32 | {"CONFLICT": 1, "EXTRACTION": 10, "QUALITY_POLICY": 21} |
| historical | 33 | 33 | 100.00% | 225 | 17 | 79 | 5 | 124 | {"APPLICABILITY": 1, "CONFLICT": 4, "EXTRACTION": 10, "FETCH": 48, "IDENTITY": 4, "QUALITY_POLICY": 62} |
| identity-edge | 16 | 16 | 100.00% | 111 | 9 | 40 | 2 | 60 | {"CONFLICT": 2, "EXTRACTION": 3, "FETCH": 21, "IDENTITY": 2, "QUALITY_POLICY": 34} |
| conflict-capable | 34 | 34 | 100.00% | 232 | 19 | 85 | 5 | 123 | {"APPLICABILITY": 1, "CONFLICT": 4, "EXTRACTION": 10, "FETCH": 41, "IDENTITY": 4, "QUALITY_POLICY": 68} |
| adversarial | 27 | 27 | 100.00% | 185 | 14 | 72 | 5 | 94 | {"APPLICABILITY": 1, "CONFLICT": 3, "EXTRACTION": 8, "FETCH": 34, "IDENTITY": 4, "QUALITY_POLICY": 49} |
| structured/catalogue | 17 | 17 | 100.00% | 115 | 10 | 30 | 0 | 75 | {"CONFLICT": 1, "EXTRACTION": 3, "FETCH": 41, "QUALITY_POLICY": 30} |

## Error taxonomy

{
  "APPLICABILITY": 1,
  "CONFLICT": 4,
  "EXTRACTION": 11,
  "FETCH": 48,
  "GROUND_TRUTH_AMBIGUOUS": 6,
  "IDENTITY": 4,
  "QUALITY_POLICY": 70
}

## P0 candidates

- CONFLICT: GT-V2-02-tuition, GT-V2-11-tuition, GT-V2-25-credential, GT-V2-27-credential

## P1 candidates

- APPLICABILITY: GT-V2-34-programme_identity
- EXTRACTION: GT-V2-13-programme_status, GT-V2-16-programme_status, GT-V2-17-programme_status, GT-V2-24-english_requirement, GT-V2-32-application_deadline, GT-V2-32-credential, GT-V2-32-english_requirement, GT-V2-32-major_admissions_requirement, GT-V2-32-programme_identity, GT-V2-32-programme_status, GT-V2-32-tuition
- FETCH: GT-V2-04-application_deadline, GT-V2-04-credential, GT-V2-04-english_requirement, GT-V2-04-major_admissions_requirement, GT-V2-04-programme_identity, GT-V2-04-programme_status, GT-V2-04-tuition, GT-V2-06-application_deadline, GT-V2-06-credential, GT-V2-06-english_requirement, GT-V2-06-major_admissions_requirement, GT-V2-06-programme_identity, GT-V2-06-programme_status, GT-V2-08-application_deadline, GT-V2-08-credential, GT-V2-08-english_requirement, GT-V2-08-major_admissions_requirement, GT-V2-08-programme_identity, GT-V2-08-programme_status, GT-V2-08-tuition, GT-V2-09-application_deadline, GT-V2-09-credential, GT-V2-09-english_requirement, GT-V2-09-major_admissions_requirement, GT-V2-09-programme_identity, GT-V2-09-programme_status, GT-V2-09-tuition, GT-V2-26-application_deadline, GT-V2-26-credential, GT-V2-26-english_requirement, GT-V2-26-major_admissions_requirement, GT-V2-26-programme_identity, GT-V2-26-programme_status, GT-V2-26-tuition, GT-V2-35-application_deadline, GT-V2-35-credential, GT-V2-35-english_requirement, GT-V2-35-major_admissions_requirement, GT-V2-35-programme_identity, GT-V2-35-programme_status, GT-V2-35-tuition, GT-V2-36-application_deadline, GT-V2-36-credential, GT-V2-36-english_requirement, GT-V2-36-major_admissions_requirement, GT-V2-36-programme_identity, GT-V2-36-programme_status, GT-V2-36-tuition
- IDENTITY: GT-V2-22-programme_identity, GT-V2-23-programme_identity, GT-V2-25-programme_identity, GT-V2-33-programme_identity
- QUALITY_POLICY: GT-V2-01-application_deadline, GT-V2-01-credential, GT-V2-01-english_requirement, GT-V2-01-major_admissions_requirement, GT-V2-01-programme_status, GT-V2-01-tuition, GT-V2-02-application_deadline, GT-V2-02-credential, GT-V2-02-english_requirement, GT-V2-02-major_admissions_requirement, GT-V2-02-programme_status, GT-V2-03-application_deadline, GT-V2-03-credential, GT-V2-03-english_requirement, GT-V2-03-major_admissions_requirement, GT-V2-03-programme_status, GT-V2-03-tuition, GT-V2-05-application_deadline, GT-V2-05-credential, GT-V2-05-english_requirement, GT-V2-05-programme_status, GT-V2-07-application_deadline, GT-V2-07-credential, GT-V2-07-english_requirement, GT-V2-07-major_admissions_requirement, GT-V2-07-programme_identity, GT-V2-07-programme_status, GT-V2-07-tuition, GT-V2-10-application_deadline, GT-V2-10-credential, GT-V2-10-english_requirement, GT-V2-10-major_admissions_requirement, GT-V2-10-programme_status, GT-V2-10-tuition, GT-V2-11-application_deadline, GT-V2-11-credential, GT-V2-11-english_requirement, GT-V2-11-programme_status, GT-V2-12-application_deadline, GT-V2-12-credential, GT-V2-12-english_requirement, GT-V2-12-major_admissions_requirement, GT-V2-12-programme_status, GT-V2-13-application_deadline, GT-V2-13-credential, GT-V2-13-english_requirement, GT-V2-13-tuition, GT-V2-14-application_deadline, GT-V2-14-credential, GT-V2-14-english_requirement, GT-V2-14-major_admissions_requirement, GT-V2-14-programme_status, GT-V2-14-tuition, GT-V2-15-application_deadline, GT-V2-15-credential, GT-V2-15-english_requirement, GT-V2-15-major_admissions_requirement, GT-V2-15-programme_status, GT-V2-15-tuition, GT-V2-16-application_deadline, GT-V2-16-credential, GT-V2-16-english_requirement, GT-V2-16-major_admissions_requirement, GT-V2-16-tuition, GT-V2-17-application_deadline, GT-V2-17-credential, GT-V2-17-english_requirement, GT-V2-17-major_admissions_requirement, GT-V2-17-tuition, GT-V2-18-application_deadline, GT-V2-18-credential, GT-V2-18-english_requirement, GT-V2-18-major_admissions_requirement, GT-V2-18-programme_status, GT-V2-18-tuition, GT-V2-19-application_deadline, GT-V2-19-credential, GT-V2-19-english_requirement, GT-V2-19-major_admissions_requirement, GT-V2-19-programme_identity, GT-V2-19-programme_status, GT-V2-19-tuition, GT-V2-20-application_deadline, GT-V2-20-credential, GT-V2-20-english_requirement, GT-V2-20-major_admissions_requirement, GT-V2-20-programme_status, GT-V2-20-tuition, GT-V2-21-application_deadline, GT-V2-21-credential, GT-V2-21-english_requirement, GT-V2-21-major_admissions_requirement, GT-V2-21-programme_identity, GT-V2-21-programme_status, GT-V2-21-tuition, GT-V2-22-application_deadline, GT-V2-22-credential, GT-V2-22-english_requirement, GT-V2-22-major_admissions_requirement, GT-V2-22-programme_status, GT-V2-22-tuition, GT-V2-23-application_deadline, GT-V2-23-credential, GT-V2-23-english_requirement, GT-V2-23-major_admissions_requirement, GT-V2-23-programme_status, GT-V2-23-tuition, GT-V2-24-application_deadline, GT-V2-24-credential, GT-V2-24-major_admissions_requirement, GT-V2-24-programme_status, GT-V2-24-tuition, GT-V2-25-application_deadline, GT-V2-25-english_requirement, GT-V2-25-major_admissions_requirement, GT-V2-25-programme_status, GT-V2-25-tuition, GT-V2-27-application_deadline, GT-V2-27-english_requirement, GT-V2-27-major_admissions_requirement, GT-V2-27-programme_status, GT-V2-27-tuition, GT-V2-28-application_deadline, GT-V2-28-credential, GT-V2-28-english_requirement, GT-V2-28-major_admissions_requirement, GT-V2-28-programme_status, GT-V2-28-tuition, GT-V2-29-application_deadline, GT-V2-29-credential, GT-V2-29-english_requirement, GT-V2-29-major_admissions_requirement, GT-V2-29-programme_status, GT-V2-29-tuition, GT-V2-30-application_deadline, GT-V2-30-credential, GT-V2-30-english_requirement, GT-V2-30-major_admissions_requirement, GT-V2-30-programme_status, GT-V2-30-tuition, GT-V2-31-application_deadline, GT-V2-31-credential, GT-V2-31-english_requirement, GT-V2-31-major_admissions_requirement, GT-V2-31-programme_status, GT-V2-31-tuition, GT-V2-33-application_deadline, GT-V2-33-credential, GT-V2-33-english_requirement, GT-V2-33-major_admissions_requirement, GT-V2-33-programme_status, GT-V2-33-tuition, GT-V2-34-application_deadline, GT-V2-34-credential, GT-V2-34-english_requirement, GT-V2-34-major_admissions_requirement, GT-V2-34-programme_status, GT-V2-34-tuition

## Ambiguous truth handling

The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: GT-V2-05-major_admissions_requirement, GT-V2-05-tuition, GT-V2-06-tuition, GT-V2-11-major_admissions_requirement, GT-V2-12-tuition, GT-V2-13-major_admissions_requirement.

## Isolation and stop state

The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.
Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.
Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).
Slice F remains NO-GO pending later gates and explicit remediation authorization.

## Artifacts

- Pipeline output: pipeline-output.json; SHA-256 df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4.
- Score result: score-result.json; SHA-256 89422980e8250a4a874846e5d8780c55deed073d68ef848a78d84958e5d35021.
- Errors: errors.jsonl; SHA-256 422a5652b55665d8d987c230fdbfebda3c930e773325333e7bd24c254a47ecc7; rows 232.
- Run manifest: run-manifest.json; report: phase3f-v3-run-20260907T145934Z-benchmark-report.md.
