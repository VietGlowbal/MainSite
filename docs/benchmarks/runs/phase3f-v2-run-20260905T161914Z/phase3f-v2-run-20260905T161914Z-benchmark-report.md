# Phase 3F V2 Benchmark Report — phase3f-v2-run-20260905T161914Z

Benchmark gate classification: **FAIL — QUALITY**

## Run identity and integrity

- Code revision: 8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a; dirty worktree: True.
- Started: 2026-09-05T16:19:21+00:00; finished: 2026-09-05T16:50:37+00:00.
- Runtime: Python 3.14.3, Node v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Provider/config: deepseek / deepseek-v4-flash; raw mode local; acquisition legacy.
- Frozen input checksum validation: PASS.
- Truth SHA-256: 97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4.
- Roster SHA-256: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139.
- Scorer Markdown SHA-256: 47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91.
- Machine contract SHA-256: 720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99.
- Sealed pipeline output SHA-256: 8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d.

## Execution completeness

- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: 36; failed/partial discovery or processing: 0.
- Programme discovery: 36/36; required-source discovery: 36/36.

## Headline metrics

- Programme discovery recall: 36/36 (100.00%); institution floor: {"status": "AVAILABLE", "min_value": 1.0, "threshold": 0.8, "violating_institutions": []}.
- Required-source discovery recall: 36/36 (100.00%).
- Critical precision: 0/31 (0.00%).
- Critical resolved coverage/recall: 0/122 (0.00%).
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
| programme_identity | 36 | 0 | 28 | 0 | 8 | 7 | 0 | 0/28 (0.00%) | 0/34 (0.00%) |
| credential | 36 | 0 | 0 | 4 | 32 | 7 | 0 | 0/0 | 0/30 (0.00%) |
| programme_status | 36 | 0 | 0 | 25 | 11 | 11 | 0 | 0/0 | 0/0 |
| tuition | 33 | 0 | 2 | 15 | 16 | 6 | 0 | 0/2 (0.00%) | 0/11 (0.00%) |
| application_deadline | 36 | 0 | 0 | 23 | 13 | 9 | 0 | 0/0 | 0/4 (0.00%) |
| english_requirement | 36 | 0 | 0 | 10 | 26 | 8 | 0 | 0/0 | 0/24 (0.00%) |
| major_admissions_requirement | 33 | 0 | 1 | 11 | 21 | 9 | 0 | 0/1 (0.00%) | 0/19 (0.00%) |

## Per-institution results

| Institution | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cornell | 3 | 3 | 100.00% | 21 | 0 | 6 | 3 | 12 | 0/3 (0.00%) | 0 |
| Duke | 3 | 3 | 100.00% | 19 | 0 | 6 | 3 | 10 | 0/3 (0.00%) | 0 |
| ETH Zurich | 3 | 3 | 100.00% | 21 | 0 | 9 | 4 | 8 | 0/4 (0.00%) | 0 |
| Harvard | 3 | 3 | 100.00% | 18 | 0 | 2 | 1 | 15 | 0/1 (0.00%) | 0 |
| MIT | 3 | 3 | 100.00% | 21 | 0 | 10 | 5 | 6 | 0/5 (0.00%) | 0 |
| Northwestern | 3 | 3 | 100.00% | 20 | 0 | 11 | 3 | 6 | 0/3 (0.00%) | 0 |
| Princeton | 3 | 3 | 100.00% | 21 | 0 | 3 | 0 | 18 | 0/0 | 0 |
| Sorbonne Université | 3 | 3 | 100.00% | 21 | 0 | 10 | 3 | 8 | 0/3 (0.00%) | 0 |
| UCLA | 3 | 3 | 100.00% | 21 | 0 | 10 | 3 | 8 | 0/3 (0.00%) | 0 |
| University of Michigan | 3 | 3 | 100.00% | 21 | 0 | 3 | 1 | 17 | 0/1 (0.00%) | 0 |
| University of Tokyo | 3 | 3 | 100.00% | 21 | 0 | 6 | 2 | 13 | 0/2 (0.00%) | 0 |
| Université de Montréal | 3 | 3 | 100.00% | 21 | 0 | 12 | 3 | 6 | 0/3 (0.00%) | 0 |

## Stress-category results

| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| PDF | 14 | 14 | 100.00% | 97 | 0 | 32 | 12 | 53 | {"APPLICABILITY": 1, "CONFLICT": 2, "EXTRACTION": 2, "FETCH": 27, "IDENTITY": 11, "QUALITY_POLICY": 22} |
| multilingual | 10 | 10 | 100.00% | 70 | 0 | 32 | 9 | 29 | {"CONFLICT": 3, "EXTRACTION": 6, "FETCH": 7, "IDENTITY": 9, "QUALITY_POLICY": 13} |
| related-party | 8 | 8 | 100.00% | 55 | 0 | 20 | 8 | 27 | {"CONFLICT": 1, "EXTRACTION": 3, "IDENTITY": 8, "QUALITY_POLICY": 23} |
| historical | 33 | 33 | 100.00% | 225 | 0 | 79 | 27 | 119 | {"APPLICABILITY": 2, "CONFLICT": 4, "EXTRACTION": 8, "FETCH": 48, "IDENTITY": 25, "QUALITY_POLICY": 59} |
| identity-edge | 16 | 16 | 100.00% | 111 | 0 | 39 | 14 | 58 | {"APPLICABILITY": 1, "CONFLICT": 1, "EXTRACTION": 5, "FETCH": 21, "IDENTITY": 13, "QUALITY_POLICY": 31} |
| conflict-capable | 34 | 34 | 100.00% | 232 | 0 | 85 | 30 | 117 | {"APPLICABILITY": 2, "CONFLICT": 4, "EXTRACTION": 8, "FETCH": 41, "IDENTITY": 28, "QUALITY_POLICY": 64} |
| adversarial | 27 | 27 | 100.00% | 185 | 0 | 70 | 24 | 91 | {"APPLICABILITY": 2, "CONFLICT": 4, "EXTRACTION": 7, "FETCH": 34, "IDENTITY": 22, "QUALITY_POLICY": 46} |
| structured/catalogue | 17 | 17 | 100.00% | 115 | 0 | 32 | 12 | 71 | {"EXTRACTION": 2, "FETCH": 41, "IDENTITY": 12, "QUALITY_POLICY": 28} |

## Error taxonomy

{
  "APPLICABILITY": 2,
  "CONFLICT": 4,
  "EXTRACTION": 9,
  "FETCH": 48,
  "GROUND_TRUTH_AMBIGUOUS": 6,
  "IDENTITY": 29,
  "QUALITY_POLICY": 66
}

## P0 candidates

- None under the locked P0 safety definition. The four unresolved conflict
  cases are retained as coverage-loss/P1 diagnostics, not promoted facts:
  `GT-V2-11-tuition`, `GT-V2-19-tuition`, `GT-V2-25-credential`, and
  `GT-V2-32-tuition`.

## P1 candidates

- APPLICABILITY: GT-V2-28-major_admissions_requirement, GT-V2-34-programme_identity
- EXTRACTION: GT-V2-01-major_admissions_requirement, GT-V2-10-programme_status, GT-V2-17-programme_status, GT-V2-22-application_deadline, GT-V2-22-programme_status, GT-V2-23-major_admissions_requirement, GT-V2-24-english_requirement, GT-V2-32-application_deadline, GT-V2-32-programme_status
- FETCH: GT-V2-04-application_deadline, GT-V2-04-credential, GT-V2-04-english_requirement, GT-V2-04-major_admissions_requirement, GT-V2-04-programme_identity, GT-V2-04-programme_status, GT-V2-04-tuition, GT-V2-06-application_deadline, GT-V2-06-credential, GT-V2-06-english_requirement, GT-V2-06-major_admissions_requirement, GT-V2-06-programme_identity, GT-V2-06-programme_status, GT-V2-08-application_deadline, GT-V2-08-credential, GT-V2-08-english_requirement, GT-V2-08-major_admissions_requirement, GT-V2-08-programme_identity, GT-V2-08-programme_status, GT-V2-08-tuition, GT-V2-09-application_deadline, GT-V2-09-credential, GT-V2-09-english_requirement, GT-V2-09-major_admissions_requirement, GT-V2-09-programme_identity, GT-V2-09-programme_status, GT-V2-09-tuition, GT-V2-26-application_deadline, GT-V2-26-credential, GT-V2-26-english_requirement, GT-V2-26-major_admissions_requirement, GT-V2-26-programme_identity, GT-V2-26-programme_status, GT-V2-26-tuition, GT-V2-35-application_deadline, GT-V2-35-credential, GT-V2-35-english_requirement, GT-V2-35-major_admissions_requirement, GT-V2-35-programme_identity, GT-V2-35-programme_status, GT-V2-35-tuition, GT-V2-36-application_deadline, GT-V2-36-credential, GT-V2-36-english_requirement, GT-V2-36-major_admissions_requirement, GT-V2-36-programme_identity, GT-V2-36-programme_status, GT-V2-36-tuition
- IDENTITY: GT-V2-01-programme_identity, GT-V2-01-tuition, GT-V2-02-programme_identity, GT-V2-03-programme_identity, GT-V2-03-tuition, GT-V2-05-programme_identity, GT-V2-10-programme_identity, GT-V2-11-programme_identity, GT-V2-12-programme_identity, GT-V2-13-programme_identity, GT-V2-14-programme_identity, GT-V2-15-programme_identity, GT-V2-16-programme_identity, GT-V2-17-programme_identity, GT-V2-18-programme_identity, GT-V2-19-programme_identity, GT-V2-20-programme_identity, GT-V2-21-programme_identity, GT-V2-22-programme_identity, GT-V2-23-programme_identity, GT-V2-24-programme_identity, GT-V2-25-programme_identity, GT-V2-27-programme_identity, GT-V2-28-programme_identity, GT-V2-29-programme_identity, GT-V2-30-programme_identity, GT-V2-31-programme_identity, GT-V2-32-programme_identity, GT-V2-33-programme_identity
- QUALITY_POLICY: GT-V2-01-application_deadline, GT-V2-01-credential, GT-V2-01-english_requirement, GT-V2-01-programme_status, GT-V2-02-application_deadline, GT-V2-02-credential, GT-V2-02-english_requirement, GT-V2-02-major_admissions_requirement, GT-V2-02-programme_status, GT-V2-02-tuition, GT-V2-03-application_deadline, GT-V2-03-credential, GT-V2-03-english_requirement, GT-V2-03-major_admissions_requirement, GT-V2-03-programme_status, GT-V2-05-application_deadline, GT-V2-05-credential, GT-V2-05-english_requirement, GT-V2-05-programme_status, GT-V2-07-application_deadline, GT-V2-07-credential, GT-V2-07-english_requirement, GT-V2-07-major_admissions_requirement, GT-V2-07-programme_identity, GT-V2-07-programme_status, GT-V2-07-tuition, GT-V2-10-application_deadline, GT-V2-10-credential, GT-V2-10-english_requirement, GT-V2-10-major_admissions_requirement, GT-V2-10-tuition, GT-V2-11-application_deadline, GT-V2-11-credential, GT-V2-11-english_requirement, GT-V2-11-programme_status, GT-V2-12-application_deadline, GT-V2-12-credential, GT-V2-12-english_requirement, GT-V2-12-major_admissions_requirement, GT-V2-12-programme_status, GT-V2-13-application_deadline, GT-V2-13-credential, GT-V2-13-english_requirement, GT-V2-13-programme_status, GT-V2-13-tuition, GT-V2-14-application_deadline, GT-V2-14-credential, GT-V2-14-english_requirement, GT-V2-14-major_admissions_requirement, GT-V2-14-programme_status, GT-V2-14-tuition, GT-V2-15-application_deadline, GT-V2-15-credential, GT-V2-15-english_requirement, GT-V2-15-major_admissions_requirement, GT-V2-15-programme_status, GT-V2-15-tuition, GT-V2-16-application_deadline, GT-V2-16-credential, GT-V2-16-english_requirement, GT-V2-16-major_admissions_requirement, GT-V2-16-programme_status, GT-V2-16-tuition, GT-V2-17-application_deadline, GT-V2-17-credential, GT-V2-17-english_requirement, GT-V2-17-major_admissions_requirement, GT-V2-17-tuition, GT-V2-18-application_deadline, GT-V2-18-credential, GT-V2-18-english_requirement, GT-V2-18-major_admissions_requirement, GT-V2-18-programme_status, GT-V2-18-tuition, GT-V2-19-application_deadline, GT-V2-19-credential, GT-V2-19-english_requirement, GT-V2-19-major_admissions_requirement, GT-V2-19-programme_status, GT-V2-20-application_deadline, GT-V2-20-credential, GT-V2-20-english_requirement, GT-V2-20-major_admissions_requirement, GT-V2-20-programme_status, GT-V2-20-tuition, GT-V2-21-application_deadline, GT-V2-21-credential, GT-V2-21-english_requirement, GT-V2-21-major_admissions_requirement, GT-V2-21-programme_status, GT-V2-21-tuition, GT-V2-22-credential, GT-V2-22-english_requirement, GT-V2-22-major_admissions_requirement, GT-V2-22-tuition, GT-V2-23-application_deadline, GT-V2-23-credential, GT-V2-23-english_requirement, GT-V2-23-programme_status, GT-V2-23-tuition, GT-V2-24-application_deadline, GT-V2-24-credential, GT-V2-24-major_admissions_requirement, GT-V2-24-programme_status, GT-V2-24-tuition, GT-V2-25-application_deadline, GT-V2-25-english_requirement, GT-V2-25-major_admissions_requirement, GT-V2-25-programme_status, GT-V2-25-tuition, GT-V2-27-application_deadline, GT-V2-27-credential, GT-V2-27-english_requirement, GT-V2-27-major_admissions_requirement, GT-V2-27-programme_status, GT-V2-27-tuition, GT-V2-28-application_deadline, GT-V2-28-credential, GT-V2-28-english_requirement, GT-V2-28-programme_status, GT-V2-28-tuition, GT-V2-29-application_deadline, GT-V2-29-credential, GT-V2-29-english_requirement, GT-V2-29-major_admissions_requirement, GT-V2-29-programme_status, GT-V2-29-tuition, GT-V2-30-application_deadline, GT-V2-30-credential, GT-V2-30-english_requirement, GT-V2-30-major_admissions_requirement, GT-V2-30-programme_status, GT-V2-30-tuition, GT-V2-31-application_deadline, GT-V2-31-credential, GT-V2-31-english_requirement, GT-V2-31-major_admissions_requirement, GT-V2-31-programme_status, GT-V2-31-tuition, GT-V2-32-credential, GT-V2-32-english_requirement, GT-V2-32-major_admissions_requirement, GT-V2-33-application_deadline, GT-V2-33-credential, GT-V2-33-english_requirement, GT-V2-33-major_admissions_requirement, GT-V2-33-programme_status, GT-V2-33-tuition, GT-V2-34-application_deadline, GT-V2-34-credential, GT-V2-34-english_requirement, GT-V2-34-major_admissions_requirement, GT-V2-34-programme_status, GT-V2-34-tuition

## Ambiguous truth handling

The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: GT-V2-05-major_admissions_requirement, GT-V2-05-tuition, GT-V2-06-tuition, GT-V2-11-major_admissions_requirement, GT-V2-12-tuition, GT-V2-13-major_admissions_requirement.

## Isolation and stop state

The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.
Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.
Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).
Slice F remains NO-GO pending later gates and explicit remediation authorization.

## Artifacts

- Pipeline output: pipeline-output.json; SHA-256 8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d.
- Score result: score-result.json; SHA-256 8fe76240eaa191314243648516c6a9b49a92d6dea61f2cadc82349e8c76ae2d1.
- Errors: errors.jsonl; SHA-256 a5b5c9ad6df76056e8c09323cb2b3b359cc6b6d9490f159cb218acafa73ed1a1; rows 252.
- Run manifest: run-manifest.json; report: phase3f-v2-run-20260905T161914Z-benchmark-report.md.

## Run #4 execution and provider observability

- Terminal execution: 36/36 programmes; completed 36, partial 0, blocked 0,
  failed 0. Sources fetched: 362 (343 HTML, 19 PDF); HTTP 200: 362/362;
  parser input/output was non-empty for 362/362.
- Pipeline metrics: 1,756 field assertions, 861 non-null raw assertion values;
  1,276 effective assertion rows, 665 non-null effective values. The pipeline
  recorded 588 candidates and 1,756 runtime assertions (including explicit
  null/missing-field assertions). Candidate-to-assertion drops: 8
  (`DUPLICATE_FACT` 6, `DUPLICATE_ASSERTION_ID` 2).
- Critical-field runtime assertion rows: `programme_identity` 37,
  `credential` 42, `programme_status` 61, and `tuition` 85. Deadline, English,
  and major-admission values are represented through component fields in the
  persisted assertion collection (`final_deadline`, `international_deadline`,
  `ielts_overall`, `toefl`, `subject_prerequisites`, etc.).
- DeepSeek: 288 logical requests, 281 successful calls, 13 failures, 5
  terminal group failures, 288 request attempts, 0 retries, 0 HTTP 429, 0
  transport/rate-limit retries, max in-flight 1. Prompt tokens: 2,233,388;
  completion tokens: 305,714; total: 2,539,102. Authoritative cost metadata:
  unavailable.
- Effective run configuration: `deepseek`, `https://api.deepseek.com`,
  `deepseek-v4-flash`, reasoning `none`; API key loaded without logging its
  value. Node `v22.15.0`; Node 24.19.x remains deferred/unverified.

## Projection and safety-case audit

The sealed projection contains: FOUND 31, NEEDS_REVIEW 158,
ACCESS_BLOCKED 49, CONFLICTING_SOURCES 5, EXTRACTION_FAILED 9,
NOT_EVALUATED 0, PARSE_FAILED 0. `PRODUCT_SAFE` count is 0, so evidence
entailment is unavailable rather than a passing percentage.

The seven Remediation-4 safety cases were all safe: `GT-V2-01-major_admissions_requirement`
EXTRACTION_FAILED; `GT-V2-02-major_admissions_requirement` NEEDS_REVIEW;
`GT-V2-02-tuition` NEEDS_REVIEW; `GT-V2-15-application_deadline` NEEDS_REVIEW;
`GT-V2-15-major_admissions_requirement` NEEDS_REVIEW;
`GT-V2-22-english_requirement` NEEDS_REVIEW; and
`GT-V2-22-major_admissions_requirement` NEEDS_REVIEW. None emitted an
unsupported concrete value. The six original P0 credential/identity cases
also remained non-concrete/safe: `GT-V2-09-programme_identity`,
`GT-V2-09-credential` ACCESS_BLOCKED; and
`GT-V2-15-credential`, `GT-V2-22-credential`, `GT-V2-23-credential`,
`GT-V2-27-credential` NEEDS_REVIEW.

All seven zero-tolerance counters are 0. The four conflict-classified cases
(`GT-V2-11-tuition`, `GT-V2-19-tuition`, `GT-V2-25-credential`,
`GT-V2-32-tuition`) remain unresolved `CONFLICTING_SOURCES`; none was
promoted. Accordingly, fresh P0 safety candidates: none. The report's P1
clusters are identity precision (28 incorrect programme-identity outputs),
quality-policy/coverage loss (66 taxonomy rows), fetch/access (48), and
extraction (9), with applicability (2) also present.

## Per-field assertion/projection summary

| Field | Raw assertions / non-null | Effective / non-null | Projected FOUND | Projected unresolved/operational |
|---|---:|---:|---:|---:|
| programme_identity | 37 / 29 | 29 / 28 | 28 | NEEDS_REVIEW 1; ACCESS_BLOCKED 7 |
| credential | 42 / 31 | 30 / 26 | 0 | NEEDS_REVIEW 28; ACCESS_BLOCKED 7; CONFLICTING 1 |
| programme_status | 61 / 25 | 29 / 0 | 0 | NEEDS_REVIEW 25; ACCESS_BLOCKED 7; EXTRACTION_FAILED 4 |
| tuition | 85 / 73 | 37 / 32 | 2 | NEEDS_REVIEW 23; ACCESS_BLOCKED 7; CONFLICTING 4 |
| application_deadline | component fields | component fields | 0 | NEEDS_REVIEW 27; ACCESS_BLOCKED 7; EXTRACTION_FAILED 2 |
| english_requirement | component fields | component fields | 0 | NEEDS_REVIEW 28; ACCESS_BLOCKED 7; EXTRACTION_FAILED 1 |
| major_admissions_requirement | component fields | component fields | 1 | NEEDS_REVIEW 26; ACCESS_BLOCKED 7; EXTRACTION_FAILED 2 |

The 31 FOUND values are not accepted as correct by the frozen scorer: critical
precision is 0/31. This is a quality failure, not a safety promotion failure.

## Validation and integrity status

The scorer completed after output sealing with the unchanged contract. The
pipeline output remains immutable at SHA-256
`8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad0888634ea9b904b9d`.
The run manifest records `pipeline_truth_access=false`, direct DeepSeek
configuration, 36/36 terminal programmes, and the scorer's reverified output
digest. The remaining post-run checks and their measured results are recorded
in the final handoff; no pipeline, scorer, truth, threshold, or provider
change was made after the run began.
