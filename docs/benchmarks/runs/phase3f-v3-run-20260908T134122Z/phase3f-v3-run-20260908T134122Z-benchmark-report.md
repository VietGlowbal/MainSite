# Phase 3F V3 Official Benchmark Run #8 Report

Run ID: phase3f-v3-run-20260908T134122Z
Execution commit: 5b37ccd07d5cf912272099b07488f5af56e22aca
Benchmark: phase3f-v3 frozen
Classification: FAIL - QUALITY
Correctness + safety: CLOSED / PASS
Remediation 12 generalization: REGRESSION on the fresh run (82/124, below Run #7 87/124 and offline replay 90/124).

## 1. Execution and integrity

Clean execution worktree: C:\Users\ADMIN\orca\workspaces\MainSite\data-platform-benchmark8-preflight-20260908T123218Z
Runtime: Python 3.14.3; Node v22.15.0; Node 24 deferred/unverified by user decision.
Provider: deepseek; endpoint https://api.deepseek.com; model deepseek-v4-flash; reasoning none.
V3 preflight passed before the provider request: clean worktree, frozen truth/roster/scorer/freeze, all hashes, truth isolation, and run-ID prefix.
Connectivity precheck: HTTP 200. Runtime received only frozen roster/source inputs. Pipeline output was sealed before truth/scorer loading.
Pipeline output SHA-256: 87ec1dc88da485c746edbca5615cf00c7543cf3111a66d2949fcb6f4fd4bf74f
Run #7 SHA-256 remained e6b1018f08ce4c0a71ba28b4aa20fd76439a6326f6e9a3e008d83771d46dd3f9. Runs #1-#7 and frozen V3 hashes passed.
The legacy offline-rescore wrapper still references an obsolete historical artifact; the fresh official run used scripts/score_phase3f_v3_benchmark.py and the frozen machine-scorer hash remained unchanged.

## 2. Population and gates

| metric | Run #8 |
| --- | --- |
| programmes attempted / terminal / failed / partial | 36 / 36 / 0 / 0 |
| programme discovery | 36/36 = 100.00% |
| required-source discovery | 36/36 = 100.00% |
| institution discovery floor | 100.00% |
| critical precision | 21/21 = 100.00% |
| resolved coverage | 21/122 = 17.21% |
| safe-unresolved correctness | 82/124 = 66.13% |
| PRODUCT_SAFE | 0/0; entailment unavailable |
Discovery, institution, precision, correctness, and safety controls pass. The frozen safe-unresolved quality gate requires 124/124 and fails.

## 3. Sources, parser, provider, and assertions

| metric | value |
| --- | --- |
| sources discovered | NOT PERSISTED AS SEPARATE COUNTER |
| sources fetched / persisted source records | 356 |
| HTML / PDF / structured MIME | 336 / 20 / 0 |
| parser attempts / non-empty / failures | 356 / 356 / 0 |
| crawl errors | 60 |
| ACCESS_BLOCKED fetch errors | 38 |
| fetch-stage failures | 47 |
| crawl error codes | {'DISCOVERY_WARNING': 4, 'BLOCKED_BY_ROBOTS': 14, 'HTTP_403': 24, 'PROGRAMME_IDENTITY_MISMATCH': 7, 'RESPONSE_TOO_LARGE': 1, 'UNSAFE_URL': 1, 'HTTP_404': 7, 'ADMISSION_RETRY_EXTRACTION_FAILED': 1, 'CONTEXT_LIMIT': 1} |
A separate source-discovery counter was not persisted; 356 is the authoritative fetched source-record count. The run contains 330 URL-graph edges. All persisted source records had HTTP 200; crawl errors are recorded separately.
Full-run provider logical requests, parsed-call count, attempts, retries, HTTP response counters, and tokens were not persisted in the sealed artifact and are reported as unavailable rather than estimated.
Persisted runtime evidence: 249 cache response records; 254 extraction events (248 completed, 6 failed); 53 trace rows (52 successful, 1 failed); one explicit provider failure. Connectivity precheck: one HTTP 200 request, 62 prompt tokens, 6 completion tokens.

| assertion metric | value |
| --- | --- |
| total assertions | 1645 |
| effective non-null assertions | 576 |
| field candidates | 543 |
| rejected assertions | 158 |
| review-required assertions | 318 |
| candidate-to-assertion drops | 3 |
Per-field assertion columns aggregate the listed component fields. Candidate-created, effective-candidate, raw assertion, non-null assertion, and selected assertion counts are kept as separate measured quantities.
| field | candidates created | effective candidates | effective non-null candidates | assertions | non-null assertions | selected assertions |
| --- | --- | --- | --- | --- | --- | --- |
| programme_identity | 26 | 26 | 22 | 41 | 27 | 22 |
| credential | 28 | 27 | 25 | 40 | 28 | 24 |
| programme_status | 21 | 26 | 0 | 56 | 20 | 0 |
| tuition | 34 | 34 | 29 | 70 | 55 | 21 |
| application_deadline | 32 | 131 | 34 | 195 | 48 | 30 |
| english_requirement | 19 | 130 | 36 | 200 | 40 | 23 |
| major_admissions_requirement | 48 | 187 | 55 | 262 | 60 | 91 |

## 4. Projection, correctness, and safety

| state | count |
| --- | --- |
| FOUND | 21 |
| NEEDS_REVIEW | 153 |
| CONFLICTING_SOURCES | 1 |
| ACCESS_BLOCKED | 56 |
| SOURCE_NOT_FOUND | 7 |
| FETCH_FAILED | 0 |
| PARSE_FAILED | 0 |
| EXTRACTION_FAILED | 14 |
| STALE_ONLY | 0 |
| NOT_EVALUATED | 0 |
| NOT_REQUIRED | 0 |
| NOT_PUBLISHED | 0 |
NOT_EVALUATED count is 0. The four NOT_REQUIRED cases and all other states are included above.

| zero-tolerance counter | count |
| --- | --- |
| false-current critical | 0 |
| fuzzy-only identity merge | 0 |
| unresolved conflict promoted | 0 |
| SOURCE_NOT_FOUND promoted | 0 |
| STALE_ONLY promoted | 0 |
| prohibited high-volatility inferred critical promoted | 0 |
| PRODUCT_SAFE without durable provenance | 0 |
PRODUCT_SAFE emitted 0 records, so entailment is unavailable rather than 100%. Critical precision is 21/21 with 0 incorrect concrete outputs. Correctness + safety is CLOSED / PASS.

## 5. Programme status and GT-V2-24

| state | count |
| --- | --- |
| FOUND | 0 |
| NEEDS_REVIEW | 22 |
| ACCESS_BLOCKED | 8 |
| EXTRACTION_FAILED | 5 |
| SOURCE_NOT_FOUND | 1 |
| CONFLICTING_SOURCES | 0 |
All 36 programme-status rows and acceptance diagnostics are in run8-programme-status-results.json.
GT-V2-24: Run #6 FOUND=accepting_applications (unsafe); Run #7 NEEDS_REVIEW/null; Run #8 NEEDS_REVIEW/null and SAFE_UNRESOLVED_PASS. No concrete accepting_applications value was emitted.
| case | state | outcome | candidate | current/open | cycle evidence | intake | window | current applicability | programme proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GT-V2-01-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-02-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-03-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-04-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-05-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-06-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-07-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-08-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-09-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-10-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-11-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-12-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-13-programme_status | EXTRACTION_FAILED | COVERAGE_LOSS |  | False |  | null | - | False | True |
| GT-V2-14-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-15-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-16-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-17-programme_status | EXTRACTION_FAILED | COVERAGE_LOSS |  | False |  | null | - | False | True |
| GT-V2-18-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-19-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-20-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-21-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-22-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-23-programme_status | EXTRACTION_FAILED | COVERAGE_LOSS |  | False |  | null | - | False | True |
| GT-V2-24-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-25-programme_status | EXTRACTION_FAILED | COVERAGE_LOSS |  | False |  | null | - | False | True |
| GT-V2-26-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-27-programme_status | SOURCE_NOT_FOUND | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-28-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-29-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-30-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-31-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-32-programme_status | EXTRACTION_FAILED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-33-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-34-programme_status | NEEDS_REVIEW | SAFE_UNRESOLVED_PASS |  | False |  | null | - | False | True |
| GT-V2-35-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |
| GT-V2-36-programme_status | ACCESS_BLOCKED | COVERAGE_LOSS |  | null |  | null | - | null | null |

## 6. Identity and protected controls

| identity result | count |
| --- | --- |
| FOUND | 21 |
| correct FOUND | 21 |
| incorrect FOUND | 0 |
| NEEDS_REVIEW | 4 |
| ACCESS_BLOCKED | 8 |
| EXTRACTION_FAILED | 2 |
| SOURCE_NOT_FOUND | 1 |
| unresolved without class | 15 |
Identity comparison classes: {'EXACT_EQUIVALENT': 13, 'CANONICALLY_EQUIVALENT': 7, 'OFFICIAL_ALIAS_EQUIVALENT': 1, 'CREDENTIAL_AWARE_EQUIVALENT': 0, 'WRONG_GRANULARITY': 0, 'NOT_EQUIVALENT': 0, 'APPLICABILITY_FAILURE': 0, 'AMBIGUOUS': 0}. The 22 Run #7 correct controls yielded 21 retained correct, 1 new unresolved, and 0 new incorrect. The one unresolved control is GT-V2-31-programme_identity, an ACCESS_BLOCKED coverage loss.
| case | Run7 | Run8 | outcome | class |
| --- | --- | --- | --- | --- |
| GT-V2-01-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-02-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-03-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-05-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-10-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-11-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-12-programme_identity | FOUND | FOUND | PASS | OFFICIAL_ALIAS_EQUIVALENT |
| GT-V2-13-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-14-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-15-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-16-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-17-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-18-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-20-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-22-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-23-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-24-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
| GT-V2-28-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-29-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-30-programme_identity | FOUND | FOUND | PASS | CANONICALLY_EQUIVALENT |
| GT-V2-31-programme_identity | FOUND | ACCESS_BLOCKED | COVERAGE_LOSS |  |
| GT-V2-33-programme_identity | FOUND | FOUND | PASS | EXACT_EQUIVALENT |
Remediation-10 targets:
| case | Run7 state | Run8 state | Run8 outcome | classification |
| --- | --- | --- | --- | --- |
| GT-V2-22-programme_identity | FOUND | FOUND | PASS | correct |
| GT-V2-23-programme_identity | FOUND | FOUND | PASS | correct |
| GT-V2-25-programme_identity | EXTRACTION_FAILED | EXTRACTION_FAILED | COVERAGE_LOSS | operational loss |
| GT-V2-33-programme_identity | FOUND | FOUND | PASS | correct |
| GT-V2-34-programme_identity | NEEDS_REVIEW | NEEDS_REVIEW | COVERAGE_LOSS | safe unresolved |
Ambiguity controls remained conservative. Remediation-4 controls and original P0 controls had no unsafe promotion. GT-V2-25 identity remains the pre-existing EXTRACTION_FAILED gap. Tuition and major-admissions semantic guards remained intact.

## 7. Remediation 12 generalization and exact mismatch population

Run #7: 87/124. Remediation 12 offline replay: 90/124, A=3/B=0/C=26/D=3/E=5/F=0/G=0/H=0. Run #8: 82/124, 66.13%, 42 mismatches. Under the requested diagnostic rule this is REGRESSION.
| class | meaning | count |
| --- | --- | --- |
| A | semantic abstention wrong state | 0 |
| B | assertion-present policy blocked | 0 |
| C | valid operational failure | 30 |
| D | recoverable fetch/source | 3 |
| E | recoverable extraction | 9 |
| F | true conflict | 0 |
| G | ground-truth ambiguous | 0 |
| H | other | 0 |
All 42 mismatches are operational: C=30 ACCESS_BLOCKED, D=3 SOURCE_NOT_FOUND, E=9 EXTRACTION_FAILED. There are no A/B/F/G/H mismatches. Operational states were preserved.
Class C case IDs: GT-V2-04-application_deadline, GT-V2-04-programme_status, GT-V2-06-application_deadline, GT-V2-06-credential, GT-V2-06-programme_identity, GT-V2-06-programme_status, GT-V2-08-application_deadline, GT-V2-08-programme_status, GT-V2-09-application_deadline, GT-V2-09-credential, GT-V2-09-english_requirement, GT-V2-09-major_admissions_requirement, GT-V2-09-programme_identity, GT-V2-09-programme_status, GT-V2-09-tuition, GT-V2-26-application_deadline, GT-V2-26-programme_status, GT-V2-26-tuition, GT-V2-31-application_deadline, GT-V2-31-english_requirement, GT-V2-31-programme_status, GT-V2-31-tuition, GT-V2-35-application_deadline, GT-V2-35-programme_status, GT-V2-35-tuition, GT-V2-36-application_deadline, GT-V2-36-english_requirement, GT-V2-36-major_admissions_requirement, GT-V2-36-programme_status, GT-V2-36-tuition
Class D case IDs: GT-V2-27-credential, GT-V2-27-programme_status, GT-V2-27-tuition
Class E case IDs: GT-V2-13-programme_status, GT-V2-17-programme_status, GT-V2-23-application_deadline, GT-V2-23-programme_status, GT-V2-25-programme_status, GT-V2-32-application_deadline, GT-V2-32-english_requirement, GT-V2-32-programme_status, GT-V2-32-tuition
Remediation-12 class-A cases were GT-V2-11-tuition, GT-V2-32-tuition, and GT-V2-33-tuition. Their Run #7/offline/Run #8 comparison is in run8-diagnostic-summary.json; no new class-A mismatch appeared.

Direct/material evidence diagnostics:
| population | total | FOUND | correct | NEEDS_REVIEW | ACCESS_BLOCKED | SOURCE_NOT_FOUND | EXTRACTION_FAILED | CONFLICTING_SOURCES | assertion-present unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| direct support | 83 | 19 | 19 | 46 | 9 | 4 | 4 | 1 | 44 |
| material evidence | 104 | 21 | 21 | 61 | 12 | 4 | 5 | 1 | 54 |
QUALITY_POLICY=66 is an aggregate coverage-loss label, not the first divergent cause of the exact 42 safe-unresolved mismatches. Their first divergence is FETCH=30, EXTRACTION=9, SOURCE_SELECTION=3; policy-blocked B=0.

## 8. Error taxonomy, P0/P1, and next population

| taxonomy | count |
| --- | --- |
| DISCOVERY | 0 |
| SOURCE_SELECTION | 7 |
| FETCH | 55 |
| PARSING | 0 |
| EXTRACTION | 14 |
| APPLICABILITY | 0 |
| TEMPORAL | 0 |
| CONFLICT | 1 |
| RECOVERY | 0 |
| IDENTITY | 0 |
| QUALITY_POLICY | 66 |
| PROMOTION | 0 |
| GROUND_TRUTH_AMBIGUOUS | 6 |
First-divergence root cause for the exact mismatch set: {'FETCH': 30, 'EXTRACTION': 9, 'SOURCE_SELECTION': 3}.
P0: none. Safety counters are zero, precision is 100%, and no unsafe concrete output occurred.
P1: operational recovery population of 42 cases: D=3 source-selection, E=9 extraction, C=30 genuine access/blocked. The broader scorer has 143 coverage-loss rows.
Recommended next separately authorized remediation: deterministic source-selection recovery for D, extraction recovery for E, then evidence-based review of C. Do not start it here.

## 9. Per-field results

| field | FOUND | correct FOUND | incorrect FOUND | precision | safe unresolved | coverage loss | operational loss | resolved coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| programme_identity | 21 |  |  | 21/21 (100.00%) |  |  |  |  |
| credential | 0 |  |  | unavailable |  |  |  |  |
| programme_status | 0 |  |  | unavailable |  |  |  |  |
| tuition | 0 |  |  | unavailable |  |  |  |  |
| application_deadline | 0 |  |  | unavailable |  |  |  |  |
| english_requirement | 0 |  |  | unavailable |  |  |  |  |
| major_admissions_requirement | 0 |  |  | unavailable |  |  |  |  |
Credential remained at 0 correct concrete values; roster-derived credential evidence was not accepted. Tuition, deadline, English, major-admissions, and programme-status semantic guards remained active.

## 10. Per-institution results

| institution | discovery | correct resolved | incorrect | safe unresolved | coverage loss | operational loss |
| --- | --- | --- | --- | --- | --- | --- |
| Cornell | 3/3 (100.00%) |  | 0 |  |  |  |
| Duke | 3/3 (100.00%) |  | 0 |  |  |  |
| ETH Zurich | 3/3 (100.00%) |  | 0 |  |  |  |
| Harvard | 3/3 (100.00%) |  | 0 |  |  |  |
| MIT | 3/3 (100.00%) |  | 0 |  |  |  |
| Northwestern | 3/3 (100.00%) |  | 0 |  |  |  |
| Princeton | 3/3 (100.00%) |  | 0 |  |  |  |
| Sorbonne Université | 3/3 (100.00%) |  | 0 |  |  |  |
| UCLA | 3/3 (100.00%) |  | 0 |  |  |  |
| University of Michigan | 3/3 (100.00%) |  | 0 |  |  |  |
| University of Tokyo | 3/3 (100.00%) |  | 0 |  |  |  |
| Université de Montréal | 3/3 (100.00%) |  | 0 |  |  |  |

## 11. Stress slices

| slice | programmes | discovery | critical cases | correct | safe unresolved | incorrect concrete | coverage loss | major failure classes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDF | 14 | 14/14 |  | 7 |  |  |  |  |
| multilingual | 10 | 10/10 |  | 4 |  |  |  |  |
| related-party | 8 | 8/8 |  | 6 |  |  |  |  |
| historical | 33 | 33/33 |  | 18 |  |  |  |  |
| identity-edge | 16 | 16/16 |  | 8 |  |  |  |  |
| conflict-capable | 34 | 34/34 |  | 20 |  |  |  |  |
| adversarial | 27 | 27/27 |  | 15 |  |  |  |  |
| structured/catalogue | 17 | 17/17 |  | 10 |  |  |  |  |
Frozen slice tags were used without retagging.

## 12. Run comparisons

| run | methodology | sources_fetched | provider_calls | tokens | assertions | effective_non_null | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | SOURCE_NOT_FOUND | EXTRACTION_FAILED | CONFLICTING_SOURCES | incorrect_FOUND | identity_incorrect | critical_precision | resolved_coverage | safe_unresolved | safety |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | official V3 | 360 | 271 | 2419983 | 1697 | 618 | 25 | 161 | 49 | 0 | 11 | 6 | 5 | 5 | 20/25 = 80.00% | 20/122 = 16.39% | 88/124 = 70.97% | 0,0,0,0,0,0,0 |
| 6 | official V3 | 358 | 255 | 2266255 | 1636 | 595 | 23 | 155 | 49 | 7 | 14 | 4 | 1 | 0 | 22/22 = 100.00% | 22/122 = 18.03% | 86/124 = 69.35% | 1,0,0,0,0,0,0 |
| 7 | official V3 | 364 | 271 | 2410776 | 1702 | 618 | 22 | 161 | 49 | 7 | 8 | 5 | 0 | 0 | 22/22 = 100.00% | 22/122 = 18.03% | 87/124 = 70.16% | 0,0,0,0,0,0,0 |
| 8 | official V3 | 356 | NOT PERSISTED; precheck=1 | NOT PERSISTED | 1645 | 576 | 21 | 153 | 56 | 7 | 14 | 1 | 0 | 0 | 21/21 = 100.00% | 21/122 = 17.21% | 82/124 = 66.13% | 0,0,0,0,0,0,0 |

| run | methodology | run ID | pipeline output SHA-256 |
| --- | --- | --- | --- |
| 1 | historical V2 |  |  |
| 2 | historical V2 |  |  |
| 3 | historical V2 |  |  |
| 4 | V3 offline rescore |  |  |
| 5 | official V3 |  |  |
| 6 | official V3 |  |  |
| 7 | official V3 |  |  |
| 8 | official V3 |  |  |
Runs #1-#3 are historical V2, Run #4 is a V3 offline rescore, and Runs #5-#8 are official V3. Historical V2 precision is not directly comparable to official V3 precision.

## 13. Validation and artifacts

Validation results:
- json_jsonl_schema: PASS (14 JSON files; 6997 JSONL records parsed; output/score population 252/252)
- benchmark_v3_integrity: PASS
- v3_hashes: {'artifacts.ground_truth_v3': 'af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc', 'artifacts.roster_v2': '7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139', 'artifacts.identity_contract_v2': '634dac0462ae3ccd5825114030e14b20ce49d9fa15625ad0078bba59c584b0a0', 'artifacts.scorer_contract_v2_markdown': '71b93dc291e33dccb065e9629db24546236df0f2fd18f57160c8651ee671070f', 'artifacts.scorer_contract_v2_json': '86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8', 'artifacts.machine_scorer': '68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7', 'artifacts.adjudication_matrix': '985268067e143e20e0888eee5fc5f7a925fc6e1a0dc456dc27e65d1c6c2ca948', 'artifacts.human_review_log': '4c687cfaff97728b42bd1caebe97838b78000dcb17c40a4d009e4c6103d869de', 'immutable_v2_hashes.docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl': '97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4', 'immutable_v2_hashes.docs/benchmarks/2026-08-30-phase-3f-roster-v2.md': '7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139', 'immutable_v2_hashes.docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md': '47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91', 'immutable_v2_hashes.docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json': '720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99', 'lineage.v2_manifest': 'b63aac2da88e0eb5068cf2f37cb44427107c8b5f1f7c399f1ff695400d849ddd'}
- runs_1_7_integrity: PASS
- run8_artifact_integrity: PASS
- secret_scan: PASS (0 credential values or token-like literals in Run #8 artifacts; pre-existing documentation/test literals were excluded as non-secret fixtures)
- git_diff_check: PASS
- full_ingestion_suite: PASS (389 passed in 13.15s)
- focused_remediation_suites: PASS (87 passed in 0.89s)
- compileall: PASS
- pre_run_clean_v3_preflight: PASS (provider calls 0; clean worktree)
- post_run_frozen_hash_validation: PASS
- scorer_v2: PASS (frozen score-result hash verified)
- provider_calls_after_connectivity: 0
- node22: PASS (v22.15.0)
- node24: DEFERRED / UNVERIFIED by user decision
- pipeline_output_sha256: 87ec1dc88da485c746edbca5615cf00c7543cf3111a66d2949fcb6f4fd4bf74f
Artifacts: run-manifest.json; pipeline-output.json; score-result.json; errors.jsonl; this benchmark report; run7-vs-run8-comparison.md; run6-vs-run7-vs-run8-comparison.md; run5-vs-run6-vs-run7-vs-run8-comparison.md; run1-vs-run2-vs-run3-vs-run4-vs-run5-vs-run6-vs-run7-vs-run8-comparison.md; run8-safe-unresolved-analysis.json; run8-operational-recovery-candidates.json.

## Final state

BENCHMARK CLASSIFICATION: FAIL - QUALITY
CORRECTNESS + SAFETY: CLOSED / PASS
SAFE-UNRESOLVED QUALITY GATE: FAIL (82/124 = 66.13%; 42 mismatches)
REMEDIATION 12 GENERALIZATION: REGRESSION on this fresh run
OFFICIAL BENCHMARK RUN #9: NOT RUN
Slice F: NO-GO
