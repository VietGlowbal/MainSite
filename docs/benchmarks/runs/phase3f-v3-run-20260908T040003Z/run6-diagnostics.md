# Official Benchmark V3 Run #6 diagnostics

Run ID: phase3f-v3-run-20260908T040003Z; classification: FAIL — SAFETY. Execution commit: 38dad5b0e30f7bffff75f6eec9fc2a87c484c484; source branch: feature/data-platform; clean at execution start: True. Python 3.14.3; Node v22.15.0; Node 24 DEFERRED / UNVERIFIED by user decision. Provider deepseek; endpoint https://api.deepseek.com; model deepseek-v4-flash; reasoning none.

## Integrity and isolation

V3 preflight PASS. V3 manifest SHA d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c; GT v3 SHA af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc; scorer v2 JSON SHA 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8; machine scorer SHA 68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7; immutable V2 lineage hashes PASS. Run #5 integrity PASS with SHA df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4; Runs #1–#4 integrity PASS. Truth isolation: expected values false; review decisions false; scorer before seal false.

## Execution and provider

| Metric | Value |
|---|---|
| attempted | 36 |
| terminal | 36/36 |
| failed/partial | 0 |
| institutions | 12/12 |
| sources discovered/fetched | 358/358 |
| HTML/PDF/structured MIME | 338/20/0 |
| parser attempts/non-empty/failures | 358/358/0 |
| crawl errors | 57 |
| ACCESS_BLOCKED fetch errors | 40 |
| fetch-stage failures | 46 |
| logical requests | 262 |
| parsed/successful calls | 255 |
| request attempts | 262 |
| failures | 13 |
| group failures | 6 |
| retries | 0 |
| HTTP 429 | 0 |
| HTTP 401/402 | 0 |
| HTTP 5xx | 0 |
| prompt tokens | 2009742 |
| completion tokens | 256513 |
| total tokens | 2266255 |

No authoritative billing metadata; cost not estimated.

## Assertion metrics and projection

Totals: assertions 1636; effective non-null 595; field candidates 566; runtime assertions 1636; rejected 148; needs review 341; candidate-to-assertion drops 1.

| Field | Components | Candidates | Non-null candidates | Assertions | Non-null assertions | Selected |
|---|---|---|---|---|---|---|
| programme_identity | programme_identity | 27 | 23 | 41 | 23 | 23 |
| credential | credential | 28 | 25 | 40 | 25 | 24 |
| programme_status | programme_status | 22 | 1 | 57 | 1 | 1 |
| tuition | tuition | 34 | 28 | 61 | 28 | 22 |
| application_deadline | priority_deadline,final_deadline,funding_deadline,international_deadline | 29 | 32 | 157 | 32 | 31 |
| english_requirement | ielts_overall,ielts_subscores,toefl,duolingo | 10 | 24 | 163 | 24 | 23 |
| major_admissions_requirement | minimum_degree,minimum_gpa,subject_prerequisites,standardized_tests,work_experience,portfolio,required_documents,recommendation_letters,sop_essay_requirements | 95 | 108 | 350 | 108 | 97 |

| Projection state | Count |
|---|---|
| FOUND | 23 |
| NEEDS_REVIEW | 155 |
| CONFLICTING_SOURCES | 4 |
| ACCESS_BLOCKED | 49 |
| SOURCE_NOT_FOUND | 7 |
| FETCH_FAILED | 0 |
| PARSE_FAILED | 0 |
| EXTRACTION_FAILED | 14 |
| STALE_ONLY | 0 |
| NOT_EVALUATED | 0 |
| NOT_REQUIRED | 0 |
| NOT_PUBLISHED | 0 |

NOT_EVALUATED: 0; no cases require explanation.

## Gates, safety, identity

| Metric | Result | Gate |
|---|---|---|
| programme discovery | 36/36 (100.00%) | >=90% |
| required-source discovery | 36/36 (100.00%) | >=90% |
| institution floor | 100.00% | >=80% |
| critical precision | 22/22 (100.00%) | >=98% |
| resolved coverage | 22/122 (18.03%) | diagnostic |
| safe-unresolved | 86/124 (69.35%) | diagnostic |
| PRODUCT_SAFE | 0/0; NOT_AVAILABLE | denominator zero |

| Safety counter | Count |
|---|---|
| false_current_critical_count | 1 |
| identity_merge_violations | 0 |
| critical_unresolved_conflict_promoted_count | 0 |
| critical_source_not_found_promoted_count | 0 |
| critical_stale_only_promoted_count | 0 |
| prohibited_high_volatility_inferred_critical_promoted_count | 0 |
| product_safe_without_durable_provenance_count | 0 |

PRODUCT_SAFE count 0; entailed 0; failed entailment 0; missing provenance 0. One false current critical promotion makes FAIL — SAFETY; the other six safety counters are zero.

| Identity metric | Count |
|---|---|
| FOUND | 22 |
| correct_FOUND | 22 |
| incorrect_FOUND | 0 |
| NEEDS_REVIEW | 4 |
| ACCESS_BLOCKED | 7 |
| EXTRACTION_FAILED | 2 |

Comparison classes: {"CANONICALLY_EQUIVALENT": 8, "EXACT_EQUIVALENT": 13, "null": 14, "OFFICIAL_ALIAS_EQUIVALENT": 1}.

| Case | Run #5 | Run #6 |
|---|---|---|
| GT-V2-22-programme_identity | FOUND / Baccalauréat en informatique / FAIL / NOT_EQUIVALENT | FOUND / Baccalauréat en informatique / PASS / EXACT_EQUIVALENT |
| GT-V2-23-programme_identity | FOUND / Maîtrise en informatique / FAIL / NOT_EQUIVALENT | FOUND / Maîtrise en informatique / PASS / EXACT_EQUIVALENT |
| GT-V2-25-programme_identity | FOUND / Master of Information Science and Technology / FAIL / NOT_EQUIVALENT | EXTRACTION_FAILED / None / COVERAGE_LOSS / None |
| GT-V2-33-programme_identity | FOUND / Parcours Systèmes et Applications Répartis (SAR) / FAIL / WRONG_GRANULARITY | FOUND / Parcours Systèmes et Applications Répartis (SAR) / PASS / EXACT_EQUIVALENT |
| GT-V2-34-programme_identity | FOUND / Master of Applied Data Science (MADS) / FAIL / None | NEEDS_REVIEW / None / COVERAGE_LOSS / None |

GT-V2-25 is EXTRACTION_FAILED in Run #6; correct FOUND or NEEDS_REVIEW was required. Identity controls retained correct 19/20; new unresolved 1; new incorrect 0. New unresolved control: GT-V2-27-programme_identity.

Ambiguity/granularity controls:
| Case | Run #5 | Run #6 |
|---|---|---|
| GT-V2-19-programme_identity | NEEDS_REVIEW / COVERAGE_LOSS | NEEDS_REVIEW / COVERAGE_LOSS |
| GT-V2-21-programme_identity | NEEDS_REVIEW / COVERAGE_LOSS | NEEDS_REVIEW / COVERAGE_LOSS |
| GT-V2-32-programme_identity | EXTRACTION_FAILED / COVERAGE_LOSS | EXTRACTION_FAILED / COVERAGE_LOSS |

## Evidence, errors, P0/P1

| Population | Cases | FOUND | Correct FOUND | Incorrect FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | EXTRACTION_FAILED | CONFLICTING_SOURCES | Assertion-present unresolved |
|---|---|---|---|---|---|---|---|---|---|
| direct-support | 83 | 19 | 19 | 0 | 47 | 8 | 4 | 1 | 44 |
| material-evidence | 104 | 22 | 22 | 0 | 62 | 9 | 6 | 1 | 54 |

Direct-support is 83 cases; material evidence is 104 cases. Assertion-present unresolved is 44 unique direct-support cases (86 candidate diagnostics) and 54 unique material-evidence cases (99 candidate diagnostics). Run #5 lower-bound comparison: 46 direct-support cases.

| Error class | Count |
|---|---|
| DISCOVERY | 0 |
| SOURCE_SELECTION | 7 |
| FETCH | 48 |
| PARSING | 0 |
| EXTRACTION | 14 |
| APPLICABILITY | 0 |
| TEMPORAL | 0 |
| CONFLICT | 2 |
| RECOVERY | 0 |
| IDENTITY | 0 |
| QUALITY_POLICY | 67 |
| PROMOTION | 1 |
| GROUND_TRUTH_AMBIGUOUS | 6 |

P0: CONFLICT GT-V2-11-tuition, GT-V2-25-credential; QUALITY_POLICY GT-V2-24-programme_status. P1 exact IDs are in p0-p1-case-index.jsonl; grouped counts: {"EXTRACTION": 14, "FETCH": 48, "QUALITY_POLICY": 66, "SOURCE_SELECTION": 7}.

Safety offender: GT-V2-24-programme_status; runtime FOUND=accepting_applications; expected NEEDS_REVIEW=None; source https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/; first incorrect stage PROMOTION / acceptance policy.

Remediation-4 and original P0 unsupported concrete promotions: 0.

## Per-field, per-institution, stress

| Field | FOUND | Correct FOUND | Incorrect FOUND | NEEDS_REVIEW | CONFLICTING_SOURCES | ACCESS_BLOCKED | EXTRACTION_FAILED | Coverage loss | Operational loss |
|---|---|---|---|---|---|---|---|---|---|
| programme_identity | 22 | 22 | 0 | 4 | 0 | 7 | 2 | 14 | 10 |
| credential | 0 | 0 | 0 | 26 | 1 | 7 | 1 | 33 | 9 |
| programme_status | 1 | 0 | 1 | 23 | 0 | 7 | 4 | 12 | 12 |
| tuition | 0 | 0 | 0 | 24 | 3 | 7 | 1 | 18 | 8 |
| application_deadline | 0 | 0 | 0 | 27 | 0 | 7 | 1 | 12 | 9 |
| english_requirement | 0 | 0 | 0 | 25 | 0 | 7 | 3 | 27 | 11 |
| major_admissions_requirement | 0 | 0 | 0 | 26 | 0 | 7 | 2 | 21 | 10 |

| Institution | Programmes | Discovered | Discovery | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions | Operational loss |
|---|---|---|---|---|---|---|---|---|---|---|
| Cornell | 3 | 3 | 100.00% | 3 | 6 | 0 | 12 | 3/3 (100.00%) | 0 | 1 |
| Duke | 3 | 3 | 100.00% | 3 | 7 | 0 | 9 | 3/3 (100.00%) | 0 | 0 |
| ETH Zurich | 3 | 3 | 100.00% | 3 | 9 | 0 | 9 | 3/3 (100.00%) | 0 | 0 |
| Harvard | 3 | 3 | 100.00% | 1 | 2 | 0 | 15 | 1/1 (100.00%) | 0 | 13 |
| MIT | 3 | 3 | 100.00% | 3 | 11 | 0 | 7 | 3/3 (100.00%) | 0 | 0 |
| Northwestern | 3 | 3 | 100.00% | 3 | 10 | 0 | 7 | 3/3 (100.00%) | 0 | 1 |
| Princeton | 3 | 3 | 100.00% | 0 | 3 | 0 | 18 | 0/0 (n/a) | 0 | 14 |
| Sorbonne Université | 3 | 3 | 100.00% | 2 | 9 | 0 | 10 | 2/2 (100.00%) | 0 | 7 |
| UCLA | 3 | 3 | 100.00% | 1 | 11 | 0 | 9 | 1/1 (100.00%) | 0 | 0 |
| University of Michigan | 3 | 3 | 100.00% | 0 | 3 | 0 | 18 | 0/0 (n/a) | 0 | 15 |
| University of Tokyo | 3 | 3 | 100.00% | 0 | 2 | 0 | 19 | 0/0 (n/a) | 0 | 16 |
| Université de Montréal | 3 | 3 | 100.00% | 3 | 13 | 1 | 4 | 3/3 (100.00%) | 1 | 2 |

| Slice | Programmes | Discovered | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Error classes |
|---|---|---|---|---|---|---|---|---|
| PDF | 14 | 14 | 97 | 7 | 26 | 0 | 64 | {'CONFLICT': 1, 'EXTRACTION': 10, 'FETCH': 27, 'GROUND_TRUTH_AMBIGUOUS': 1, 'QUALITY_POLICY': 19, 'SOURCE_SELECTION': 7} |
| multilingual | 10 | 10 | 70 | 5 | 29 | 1 | 35 | {'CONFLICT': 1, 'EXTRACTION': 11, 'FETCH': 7, 'PROMOTION': 1, 'QUALITY_POLICY': 10, 'SOURCE_SELECTION': 7} |
| related-party | 8 | 8 | 55 | 6 | 14 | 1 | 34 | {'EXTRACTION': 9, 'GROUND_TRUTH_AMBIGUOUS': 1, 'PROMOTION': 1, 'QUALITY_POLICY': 19, 'SOURCE_SELECTION': 7} |
| historical | 33 | 33 | 225 | 19 | 76 | 1 | 129 | {'CONFLICT': 2, 'EXTRACTION': 14, 'FETCH': 48, 'GROUND_TRUTH_AMBIGUOUS': 6, 'PROMOTION': 1, 'QUALITY_POLICY': 59, 'SOURCE_SELECTION': 7} |
| identity-edge | 16 | 16 | 111 | 9 | 37 | 1 | 64 | {'CONFLICT': 1, 'EXTRACTION': 4, 'FETCH': 21, 'GROUND_TRUTH_AMBIGUOUS': 1, 'PROMOTION': 1, 'QUALITY_POLICY': 32, 'SOURCE_SELECTION': 7} |
| conflict-capable | 34 | 34 | 232 | 21 | 84 | 0 | 127 | {'CONFLICT': 2, 'EXTRACTION': 13, 'FETCH': 41, 'GROUND_TRUTH_AMBIGUOUS': 6, 'QUALITY_POLICY': 64, 'SOURCE_SELECTION': 7} |
| adversarial | 27 | 27 | 185 | 16 | 67 | 1 | 101 | {'CONFLICT': 2, 'EXTRACTION': 13, 'FETCH': 34, 'GROUND_TRUTH_AMBIGUOUS': 4, 'PROMOTION': 1, 'QUALITY_POLICY': 46, 'SOURCE_SELECTION': 7} |
| structured/catalogue | 17 | 17 | 115 | 10 | 32 | 0 | 73 | {'EXTRACTION': 2, 'FETCH': 41, 'GROUND_TRUTH_AMBIGUOUS': 4, 'QUALITY_POLICY': 30} |

Tuition incorrect FOUND 0; tuition blocker reason occurrences: scope/applicability 18, temporal 37, term 14, audience 3, COA confusion 0, fee-period validation 4. Major-admissions incorrect FOUND 0; credential correct FOUND 0; programme status new FOUND ['GT-V2-24-programme_status']; deadline new FOUND []; English new FOUND [].

Dominant remaining cluster: QUALITY_POLICY / ACCEPTANCE (67), followed by FETCH (48) and EXTRACTION (14). Next action: preserve the sealed run and await explicit authorization for safety/correctness diagnosis of GT-V2-24-programme_status. Do not start Remediation 11. Slice F remains NO-GO.
