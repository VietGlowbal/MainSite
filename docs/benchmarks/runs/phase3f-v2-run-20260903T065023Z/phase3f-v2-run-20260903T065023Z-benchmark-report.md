# Phase 3F V2 Benchmark Report — phase3f-v2-run-20260903T065023Z

Benchmark gate classification: **FAIL — QUALITY**

## Run identity and integrity

- Code revision: 8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a; dirty worktree: True.
- Started: 2026-09-03T06:50:23+00:00; finished: 2026-09-03T07:03:14+00:00.
- Runtime: Python 3.14.3, Node v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Provider/config: openai_compatible / deepseek-v4-flash; raw mode local; acquisition legacy.
- Frozen input checksum validation: PASS.
- Truth SHA-256: 97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4.
- Roster SHA-256: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139.
- Scorer Markdown SHA-256: 47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91.
- Machine contract SHA-256: 720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99.
- Sealed pipeline output SHA-256: d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df.

## Execution completeness

- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: 33; failed/partial discovery or processing: 3.
- Programme discovery: 33/36; required-source discovery: 33/36.

## Headline metrics

- Programme discovery recall: 33/36 (91.67%); institution floor: {"status": "AVAILABLE", "min_value": 0.3333333333333333, "threshold": 0.8, "violating_institutions": ["Harvard", "University of Tokyo"]}.
- Required-source discovery recall: 33/36 (91.67%).
- Critical precision: 0/0.
- Critical resolved coverage/recall: 0/122 (0.00%).
- Safe-unresolved correctness: 26/124 (20.97%).
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
| programme_identity | 36 | 0 | 0 | 2 | 34 | 0 | 0 | 0/0 | 0/34 (0.00%) |
| credential | 36 | 0 | 0 | 6 | 30 | 0 | 0 | 0/0 | 0/30 (0.00%) |
| programme_status | 36 | 0 | 17 | 0 | 19 | 19 | 0 | 0/0 | 0/0 |
| tuition | 33 | 0 | 0 | 4 | 29 | 23 | 0 | 0/0 | 0/11 (0.00%) |
| application_deadline | 36 | 0 | 7 | 7 | 22 | 19 | 0 | 0/0 | 0/4 (0.00%) |
| english_requirement | 36 | 0 | 1 | 1 | 34 | 28 | 0 | 0/2 (0.00%) | 0/24 (0.00%) |
| major_admissions_requirement | 33 | 0 | 0 | 6 | 27 | 21 | 0 | 0/0 | 0/19 (0.00%) |

## Per-institution results

| Institution | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cornell | 3 | 3 | 100.00% | 21 | 0 | 4 | 3 | 14 | 0/1 (0.00%) | 0 |
| Duke | 3 | 3 | 100.00% | 19 | 0 | 5 | 3 | 11 | 0/1 (0.00%) | 0 |
| ETH Zurich | 3 | 3 | 100.00% | 21 | 0 | 0 | 0 | 21 | 0/0 | 0 |
| Harvard | 3 | 1 | 33.33% | 18 | 0 | 3 | 1 | 14 | 0/0 | 0 |
| MIT | 3 | 3 | 100.00% | 21 | 0 | 5 | 5 | 11 | 0/0 | 0 |
| Northwestern | 3 | 3 | 100.00% | 20 | 0 | 1 | 0 | 19 | 0/0 | 0 |
| Princeton | 3 | 3 | 100.00% | 21 | 0 | 2 | 0 | 19 | 0/0 | 0 |
| Sorbonne Université | 3 | 3 | 100.00% | 21 | 0 | 0 | 4 | 17 | 0/0 | 0 |
| UCLA | 3 | 3 | 100.00% | 21 | 0 | 2 | 4 | 15 | 0/0 | 0 |
| University of Michigan | 3 | 3 | 100.00% | 21 | 0 | 0 | 2 | 19 | 0/0 | 0 |
| University of Tokyo | 3 | 2 | 66.67% | 21 | 0 | 2 | 1 | 18 | 0/0 | 0 |
| Université de Montréal | 3 | 3 | 100.00% | 21 | 0 | 2 | 2 | 17 | 0/0 | 0 |

## Stress-category results

| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| PDF | 14 | 11 | 78.57% | 97 | 0 | 10 | 8 | 79 | {"DISCOVERY": 44, "PARSING": 4, "QUALITY_POLICY": 39} |
| multilingual | 10 | 9 | 90.00% | 70 | 0 | 5 | 9 | 56 | {"DISCOVERY": 25, "PARSING": 10, "QUALITY_POLICY": 30} |
| related-party | 8 | 8 | 100.00% | 55 | 0 | 2 | 5 | 48 | {"DISCOVERY": 24, "PARSING": 5, "QUALITY_POLICY": 24} |
| historical | 33 | 30 | 90.91% | 225 | 0 | 22 | 22 | 181 | {"DISCOVERY": 88, "PARSING": 17, "QUALITY_POLICY": 98} |
| identity-edge | 16 | 15 | 93.75% | 111 | 0 | 7 | 7 | 97 | {"DISCOVERY": 54, "PARSING": 7, "QUALITY_POLICY": 43} |
| conflict-capable | 34 | 31 | 91.18% | 232 | 0 | 26 | 23 | 183 | {"DISCOVERY": 88, "PARSING": 14, "QUALITY_POLICY": 104} |
| adversarial | 27 | 25 | 92.59% | 185 | 0 | 18 | 19 | 148 | {"DISCOVERY": 74, "PARSING": 15, "QUALITY_POLICY": 78} |
| structured/catalogue | 17 | 15 | 88.24% | 115 | 0 | 15 | 9 | 91 | {"DISCOVERY": 48, "PARSING": 2, "QUALITY_POLICY": 50} |

## Error taxonomy

{
  "DISCOVERY": 93,
  "GROUND_TRUTH_AMBIGUOUS": 6,
  "PARSING": 17,
  "QUALITY_POLICY": 110
}

## P0 candidates

- None.

## P1 candidates

- DISCOVERY: GT-V2-04-application_deadline, GT-V2-04-english_requirement, GT-V2-04-major_admissions_requirement, GT-V2-04-programme_status, GT-V2-04-tuition, GT-V2-06-application_deadline, GT-V2-06-english_requirement, GT-V2-06-major_admissions_requirement, GT-V2-06-programme_status, GT-V2-07-application_deadline, GT-V2-07-english_requirement, GT-V2-07-major_admissions_requirement, GT-V2-07-programme_status, GT-V2-07-tuition, GT-V2-08-application_deadline, GT-V2-08-english_requirement, GT-V2-08-major_admissions_requirement, GT-V2-08-programme_status, GT-V2-08-tuition, GT-V2-09-application_deadline, GT-V2-09-english_requirement, GT-V2-09-major_admissions_requirement, GT-V2-09-programme_status, GT-V2-09-tuition, GT-V2-13-application_deadline, GT-V2-13-english_requirement, GT-V2-13-programme_status, GT-V2-13-tuition, GT-V2-14-application_deadline, GT-V2-14-english_requirement, GT-V2-14-major_admissions_requirement, GT-V2-14-programme_status, GT-V2-14-tuition, GT-V2-15-application_deadline, GT-V2-15-english_requirement, GT-V2-15-major_admissions_requirement, GT-V2-15-programme_status, GT-V2-15-tuition, GT-V2-21-application_deadline, GT-V2-21-english_requirement, GT-V2-21-major_admissions_requirement, GT-V2-21-programme_status, GT-V2-21-tuition, GT-V2-22-application_deadline, GT-V2-22-english_requirement, GT-V2-22-major_admissions_requirement, GT-V2-22-programme_status, GT-V2-22-tuition, GT-V2-23-application_deadline, GT-V2-23-english_requirement, GT-V2-23-major_admissions_requirement, GT-V2-23-programme_status, GT-V2-23-tuition, GT-V2-26-application_deadline, GT-V2-26-english_requirement, GT-V2-26-major_admissions_requirement, GT-V2-26-programme_status, GT-V2-26-tuition, GT-V2-27-application_deadline, GT-V2-27-english_requirement, GT-V2-27-major_admissions_requirement, GT-V2-27-programme_status, GT-V2-27-tuition, GT-V2-28-application_deadline, GT-V2-28-english_requirement, GT-V2-28-major_admissions_requirement, GT-V2-28-programme_status, GT-V2-28-tuition, GT-V2-29-application_deadline, GT-V2-29-english_requirement, GT-V2-29-major_admissions_requirement, GT-V2-29-programme_status, GT-V2-29-tuition, GT-V2-30-application_deadline, GT-V2-30-english_requirement, GT-V2-30-major_admissions_requirement, GT-V2-30-programme_status, GT-V2-30-tuition, GT-V2-33-application_deadline, GT-V2-33-english_requirement, GT-V2-33-major_admissions_requirement, GT-V2-33-programme_status, GT-V2-33-tuition, GT-V2-35-application_deadline, GT-V2-35-english_requirement, GT-V2-35-major_admissions_requirement, GT-V2-35-programme_status, GT-V2-35-tuition, GT-V2-36-application_deadline, GT-V2-36-english_requirement, GT-V2-36-major_admissions_requirement, GT-V2-36-programme_status, GT-V2-36-tuition
- PARSING: GT-V2-01-english_requirement, GT-V2-10-english_requirement, GT-V2-12-english_requirement, GT-V2-18-english_requirement, GT-V2-19-english_requirement, GT-V2-19-major_admissions_requirement, GT-V2-20-major_admissions_requirement, GT-V2-24-english_requirement, GT-V2-24-major_admissions_requirement, GT-V2-24-tuition, GT-V2-25-tuition, GT-V2-31-english_requirement, GT-V2-31-tuition, GT-V2-32-english_requirement, GT-V2-32-tuition, GT-V2-34-english_requirement, GT-V2-34-tuition
- QUALITY_POLICY: GT-V2-01-application_deadline, GT-V2-01-credential, GT-V2-01-major_admissions_requirement, GT-V2-01-programme_identity, GT-V2-01-programme_status, GT-V2-01-tuition, GT-V2-02-application_deadline, GT-V2-02-credential, GT-V2-02-english_requirement, GT-V2-02-major_admissions_requirement, GT-V2-02-programme_identity, GT-V2-02-programme_status, GT-V2-02-tuition, GT-V2-03-application_deadline, GT-V2-03-credential, GT-V2-03-english_requirement, GT-V2-03-major_admissions_requirement, GT-V2-03-programme_identity, GT-V2-03-programme_status, GT-V2-03-tuition, GT-V2-04-credential, GT-V2-04-programme_identity, GT-V2-05-application_deadline, GT-V2-05-credential, GT-V2-05-english_requirement, GT-V2-05-programme_identity, GT-V2-05-programme_status, GT-V2-06-credential, GT-V2-06-programme_identity, GT-V2-07-credential, GT-V2-07-programme_identity, GT-V2-08-credential, GT-V2-08-programme_identity, GT-V2-09-credential, GT-V2-09-programme_identity, GT-V2-10-application_deadline, GT-V2-10-credential, GT-V2-10-major_admissions_requirement, GT-V2-10-programme_identity, GT-V2-10-programme_status, GT-V2-10-tuition, GT-V2-11-application_deadline, GT-V2-11-credential, GT-V2-11-english_requirement, GT-V2-11-programme_identity, GT-V2-11-programme_status, GT-V2-11-tuition, GT-V2-12-application_deadline, GT-V2-12-credential, GT-V2-12-major_admissions_requirement, GT-V2-12-programme_identity, GT-V2-12-programme_status, GT-V2-13-credential, GT-V2-13-programme_identity, GT-V2-14-credential, GT-V2-14-programme_identity, GT-V2-15-credential, GT-V2-15-programme_identity, GT-V2-16-application_deadline, GT-V2-16-credential, GT-V2-16-english_requirement, GT-V2-16-major_admissions_requirement, GT-V2-16-programme_identity, GT-V2-16-programme_status, GT-V2-16-tuition, GT-V2-17-application_deadline, GT-V2-17-credential, GT-V2-17-english_requirement, GT-V2-17-major_admissions_requirement, GT-V2-17-programme_identity, GT-V2-17-programme_status, GT-V2-17-tuition, GT-V2-18-application_deadline, GT-V2-18-credential, GT-V2-18-major_admissions_requirement, GT-V2-18-programme_identity, GT-V2-18-programme_status, GT-V2-18-tuition, GT-V2-19-application_deadline, GT-V2-19-credential, GT-V2-19-programme_identity, GT-V2-19-programme_status, GT-V2-19-tuition, GT-V2-20-application_deadline, GT-V2-20-credential, GT-V2-20-english_requirement, GT-V2-20-programme_identity, GT-V2-20-programme_status, GT-V2-20-tuition, GT-V2-21-credential, GT-V2-21-programme_identity, GT-V2-22-credential, GT-V2-22-programme_identity, GT-V2-23-credential, GT-V2-23-programme_identity, GT-V2-24-application_deadline, GT-V2-24-credential, GT-V2-24-programme_identity, GT-V2-24-programme_status, GT-V2-25-application_deadline, GT-V2-25-credential, GT-V2-25-english_requirement, GT-V2-25-major_admissions_requirement, GT-V2-25-programme_identity, GT-V2-25-programme_status, GT-V2-26-credential, GT-V2-26-programme_identity, GT-V2-27-credential, GT-V2-27-programme_identity, GT-V2-28-credential, GT-V2-28-programme_identity, GT-V2-29-credential, GT-V2-29-programme_identity, GT-V2-30-credential, GT-V2-30-programme_identity, GT-V2-31-application_deadline, GT-V2-31-credential, GT-V2-31-major_admissions_requirement, GT-V2-31-programme_identity, GT-V2-31-programme_status, GT-V2-32-application_deadline, GT-V2-32-credential, GT-V2-32-major_admissions_requirement, GT-V2-32-programme_identity, GT-V2-32-programme_status, GT-V2-33-credential, GT-V2-33-programme_identity, GT-V2-34-application_deadline, GT-V2-34-credential, GT-V2-34-major_admissions_requirement, GT-V2-34-programme_identity, GT-V2-34-programme_status, GT-V2-35-credential, GT-V2-35-programme_identity, GT-V2-36-credential, GT-V2-36-programme_identity

## Ambiguous truth handling

The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: GT-V2-05-major_admissions_requirement, GT-V2-05-tuition, GT-V2-06-tuition, GT-V2-11-major_admissions_requirement, GT-V2-12-tuition, GT-V2-13-major_admissions_requirement.

## Isolation and stop state

The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.
Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.
Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).
Slice F remains NO-GO pending later gates and explicit remediation authorization.

## Artifacts

- Pipeline output: pipeline-output.json; SHA-256 d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df.
- Score result: score-result.json; SHA-256 6b8f6850135c3271143b9c0bd902b0a3538f01a5664cecaac06c289b65fe9134.
- Errors: errors.jsonl; SHA-256 4d8f0e0cdeba5dba6456498f87c0d45114a8c3bcc72d2d1c7a8c990aa6fad536; rows 252.
- Run manifest: run-manifest.json; report: phase3f-v2-run-20260903T065023Z-benchmark-report.md.
