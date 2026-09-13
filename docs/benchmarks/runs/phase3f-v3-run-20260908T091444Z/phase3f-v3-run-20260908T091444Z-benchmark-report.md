# Phase 3F V3 Benchmark Report — phase3f-v3-run-20260908T091444Z

Benchmark gate classification: **FAIL — QUALITY**

## Run identity and integrity

- Code revision: 6a2511fd2ec83294a43fc1645cb2438b14f4ea3d; dirty worktree: false.
- Started: 2026-09-08T09:14:44+00:00; finished: 2026-09-08T09:44:20+00:00.
- Runtime: Python 3.14.3, Node v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Provider/config: deepseek / deepseek-v4-flash; raw mode local; acquisition legacy.
- Frozen input checksum validation: PASS.
- Truth SHA-256: af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc.
- Roster SHA-256: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139.
- Scorer Markdown SHA-256: 71b93dc291e33dccb065e9629db24546236df0f2fd18f57160c8651ee671070f.
- Machine contract SHA-256: 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8.
- Sealed pipeline output SHA-256: e6b1018f08ce4c0a71ba28b4aa20fd76439a6326f6e9a3e008d83771d46dd3f9.

## Execution completeness

- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: 36; failed/partial discovery or processing: 0.
- Programme discovery: 36/36; required-source discovery: 36/36.

## Headline metrics

- Programme discovery recall: 36/36 (100.00%); institution floor: {"status": "AVAILABLE", "min_value": 1.0, "threshold": 0.8, "violating_institutions": []}.
- Required-source discovery recall: 36/36 (100.00%).
- Critical precision: 22/22 (100.00%).
- Critical resolved coverage/recall: 22/122 (18.03%).
- Safe-unresolved correctness: 87/124 (70.16%).
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
| programme_identity | 36 | 22 | 0 | 0 | 14 | 9 | 0 | 22/22 (100.00%) | 22/34 (64.71%) |
| credential | 36 | 0 | 0 | 3 | 33 | 8 | 0 | 0/0 | 0/30 (0.00%) |
| programme_status | 36 | 0 | 0 | 24 | 12 | 12 | 0 | 0/0 | 0/0 |
| tuition | 33 | 0 | 0 | 14 | 19 | 7 | 0 | 0/0 | 0/11 (0.00%) |
| application_deadline | 36 | 0 | 0 | 24 | 12 | 9 | 0 | 0/0 | 0/4 (0.00%) |
| english_requirement | 36 | 0 | 0 | 10 | 26 | 9 | 0 | 0/0 | 0/24 (0.00%) |
| major_admissions_requirement | 33 | 0 | 0 | 12 | 21 | 9 | 0 | 0/0 | 0/19 (0.00%) |

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
| Sorbonne Université | 3 | 3 | 100.00% | 21 | 2 | 11 | 0 | 8 | 2/2 (100.00%) | 0 |
| UCLA | 3 | 3 | 100.00% | 21 | 1 | 11 | 0 | 9 | 1/1 (100.00%) | 0 |
| University of Michigan | 3 | 3 | 100.00% | 21 | 0 | 3 | 0 | 18 | 0/0 | 0 |
| University of Tokyo | 3 | 3 | 100.00% | 21 | 0 | 2 | 0 | 19 | 0/0 | 0 |
| Université de Montréal | 3 | 3 | 100.00% | 21 | 3 | 12 | 0 | 6 | 3/3 (100.00%) | 0 |

## Stress-category results

| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| PDF | 14 | 14 | 100.00% | 97 | 7 | 29 | 0 | 61 | {"CONFLICT": 3, "EXTRACTION": 2, "FETCH": 27, "QUALITY_POLICY": 22, "SOURCE_SELECTION": 7} |
| multilingual | 10 | 10 | 100.00% | 70 | 5 | 30 | 0 | 35 | {"CONFLICT": 3, "EXTRACTION": 6, "FETCH": 7, "QUALITY_POLICY": 12, "SOURCE_SELECTION": 7} |
| related-party | 8 | 8 | 100.00% | 55 | 6 | 18 | 0 | 31 | {"CONFLICT": 1, "EXTRACTION": 2, "QUALITY_POLICY": 21, "SOURCE_SELECTION": 7} |
| historical | 33 | 33 | 100.00% | 225 | 19 | 78 | 0 | 128 | {"CONFLICT": 4, "EXTRACTION": 7, "FETCH": 48, "QUALITY_POLICY": 62, "SOURCE_SELECTION": 7} |
| identity-edge | 16 | 16 | 100.00% | 111 | 9 | 35 | 0 | 67 | {"CONFLICT": 1, "EXTRACTION": 7, "FETCH": 21, "QUALITY_POLICY": 31, "SOURCE_SELECTION": 7} |
| conflict-capable | 34 | 34 | 100.00% | 232 | 21 | 84 | 0 | 127 | {"CONFLICT": 4, "EXTRACTION": 7, "FETCH": 41, "QUALITY_POLICY": 68, "SOURCE_SELECTION": 7} |
| adversarial | 27 | 27 | 100.00% | 185 | 16 | 69 | 0 | 100 | {"CONFLICT": 4, "EXTRACTION": 6, "FETCH": 34, "QUALITY_POLICY": 49, "SOURCE_SELECTION": 7} |
| structured/catalogue | 17 | 17 | 100.00% | 115 | 10 | 32 | 0 | 73 | {"EXTRACTION": 2, "FETCH": 41, "QUALITY_POLICY": 30} |

## Error taxonomy

{
  "CONFLICT": 4,
  "EXTRACTION": 8,
  "FETCH": 48,
  "GROUND_TRUTH_AMBIGUOUS": 6,
  "QUALITY_POLICY": 70,
  "SOURCE_SELECTION": 7
}

## P0 candidates

- None. All seven zero-tolerance safety counters are zero; retained unresolved conflicts are not P0 unless promoted.

## P1 candidates

- The exact 137-case safe coverage-loss population is indexed in run7-diagnostic-summary.json and the frozen scorer errors.jsonl.

## Ambiguous truth handling

The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: GT-V2-05-major_admissions_requirement, GT-V2-05-tuition, GT-V2-06-tuition, GT-V2-11-major_admissions_requirement, GT-V2-12-tuition, GT-V2-13-major_admissions_requirement.

## Isolation and stop state

The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.
Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.
Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).
Slice F remains NO-GO pending later gates and explicit remediation authorization.

## Artifacts

- Pipeline output: pipeline-output.json; SHA-256 e6b1018f08ce4c0a71ba28b4aa20fd76439a6326f6e9a3e008d83771d46dd3f9.
- Score result: score-result.json; SHA-256 b4877850ee3f38cdaf9c6d207ee1b7bf514a6529f2779663370ae55aa7e23f53.
- Errors: errors.jsonl; SHA-256 ae45df9830090bd198f553959d54dc32847adf8abd8fd46690253cdf344de1a0; rows 230.
- Run manifest: run-manifest.json; report: phase3f-v3-run-20260908T091444Z-benchmark-report.md.


## Run #7 authoritative diagnostics

- Classification: FAIL - QUALITY. Correctness + safety closure: CLOSED / PASS.
- 36 programmes, 12 institutions, 252 cases; 36/36 terminal. Output sealed before frozen scoring.
- V3 hashes and immutable V2 lineage: PASS. Truth isolation: PASS. DeepSeek precheck: HTTP 200; credentials are excluded.

### Source, provider, and assertion metrics

- Sources discovered/fetched: 367/364; HTML/PDF/structured: 345/19/0; parser attempts/non-empty/failures: 364/364/0; crawl errors 55; ACCESS_BLOCKED fetch errors 37; fetch-stage failures 45.
- Provider logical requests/calls/attempts: 277/271/277; failures/group failures/retries: 10/3/0; tokens prompt/completion/total: 2139293/271483/2410776.
- Assertions total/effective non-null/candidates/rejected/review/drops: 1702/618/582/182/324/6.

Field-level candidate/assertion details: see run7-diagnostic-summary.json.

### Programme status and GT-V2-24

- Programme status aggregate: {"ACCESS_BLOCKED": 7, "CONFLICTING_SOURCES": 0, "EXTRACTION_FAILED": 4, "FOUND": 0, "NEEDS_REVIEW": 24, "SOURCE_NOT_FOUND": 1}; false-current 0. All 36 rows are in run7-programme-status-results.json.
- GT-V2-24 Run #6: FOUND=accepting_applications. Run #7: NEEDS_REVIEW/null. Official source evidence showed an Automne 2027 tab and a deadline period, but the status candidate had no explicit current-open semantics, target-cycle evidence, intake/window metadata, or current applicability. First incorrect Run #6 stage: ACCEPTANCE; Run #7 failed closed.
- Generic invariant: programme/page existence, generic admissions pages, portals, or deadlines alone cannot promote accepting_applications; current programme, audience, relevant cycle/intake, and open-window evidence are required.

### Identity and controls
- Identity: {"ACCESS_BLOCKED": 7, "EXTRACTION_FAILED": 1, "FOUND": 22, "NEEDS_REVIEW": 5, "comparison_classes": {"AMBIGUOUS": 0, "APPLICABILITY_FAILURE": 0, "CANONICALLY_EQUIVALENT": 8, "CREDENTIAL_AWARE_EQUIVALENT": 0, "EXACT_EQUIVALENT": 13, "NOT_EQUIVALENT": 0, "OFFICIAL_ALIAS_EQUIVALENT": 1, "WRONG_GRANULARITY": 0}, "correct_FOUND": 22, "incorrect_FOUND": 0, "unresolved_no_class": 14}.
- Identity controls, Remediation-10 targets, ambiguity controls, Remediation-4 controls, and original P0 controls are in run7-identity-control-comparison.json. The 22/22 identity control count has new incorrect 0; GT-V2-25 remains EXTRACTION_FAILED as a pre-existing coverage gap.

### Evidence, errors, and remaining blocker
- Direct/material evidence audit: {"direct": {"ACCESS_BLOCKED": 8, "CONFLICTING_SOURCES": 1, "EXTRACTION_FAILED": 2, "FOUND": 19, "NEEDS_REVIEW": 49, "SOURCE_NOT_FOUND": 4, "assertion_present_unresolved": 47, "correct": 19, "total": 83}, "material": {"ACCESS_BLOCKED": 9, "CONFLICTING_SOURCES": 1, "EXTRACTION_FAILED": 3, "FOUND": 22, "NEEDS_REVIEW": 65, "SOURCE_NOT_FOUND": 4, "assertion_present_unresolved": 58, "correct": 22, "total": 104}, "population_direct": 83, "population_material": 104}.
- Error taxonomy: {"APPLICABILITY": 0, "CONFLICT": 4, "DISCOVERY": 0, "EXTRACTION": 8, "FETCH": 48, "GROUND_TRUTH_AMBIGUOUS": 6, "IDENTITY": 0, "PARSING": 0, "PROMOTION": 0, "QUALITY_POLICY": 70, "RECOVERY": 0, "SOURCE_SELECTION": 7, "TEMPORAL": 0}. Assertion-present unresolved counts: direct 47; material 58 (using the established runtime candidate/assertion audit population).
- Dominant remaining blocker: QUALITY_POLICY / ACCEPTANCE (70 taxonomy cases), then FETCH/ACCESS (48), EXTRACTION (8).

### Validation and stop state

- Full ingestion suite: 386 passed; focused Remediation/V3/scorer suite: 58 passed. Final compile/schema/secret/integrity/diff checks are recorded in the manifest after validation.
- No commit/push, Benchmark #8, or coverage remediation was started. Slice F remains NO-GO.
