# Phase 3F Remediation 5 — Coverage Recovery

Date: 2026-09-04  
Scope: diagnostic 9-programme smoke only. Official benchmark #3 was not run.

## 1. Scope and integrity

The exact Remediation-4 composition was rerun:

| Item | Result |
|---|---|
| Roster rows | 1, 2, 4, 6, 15, 22, 25, 26, 28 |
| Run ID | phase3f-remediation5-9prog-20260904T162804Z |
| Code revision | 8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a |
| Dirty worktree | true |
| Truth access by pipeline | false |
| Provider/model | deepseek / deepseek-v4-flash |
| Reasoning | none |
| Endpoint | https://api.deepseek.com |

Frozen input checksums remained unchanged:

- truth: 97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4
- roster: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139
- scorer contract Markdown: 47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91
- machine contract: 720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99

Sealed artifacts:

- pipeline output: docs/benchmarks/runs/phase3f-remediation5-9prog-20260904T162804Z/pipeline-output.json
- pipeline output SHA-256: a592cbd104c74a56537d0746baf9a5f39a4c29110f0579dd6417b40b399ae4c5
- run manifest: docs/benchmarks/runs/phase3f-remediation5-9prog-20260904T162804Z/run-manifest.json
- run manifest SHA-256: ee4758f4f099a0fc6a226a02d03d74e11a51adf9da38a4711daf7442054e6040

The output was sealed before truth was read for the post-run audit and was not
mutated afterward. The run manifest records diagnostic_only=true and
scorer_invoked=false.

## 2. State-lifecycle root cause

The previous smoke had valid candidates, but runtime acceptance treated every
undated critical candidate as temporally unproven. A direct official programme
overview containing a qualifying-discipline profile was treated as generic
institutional prose. The candidate survived in assertion artifacts but not
runtime projection.

The first incorrect decision was in the strict temporal/semantic acceptance
layer, not fetch, parsing, assertion construction, or Product Safety. The
existing separation remains:

    runtime factual resolution != PRODUCT_SAFE != canonical promotion

The generic correction is intentionally narrow. It allows a current
programme-scoped admission profile without a repeated cycle label only when:

- field is major_admissions_requirement;
- component is subject_prerequisites;
- scope is programme;
- source_type is programme_overview;
- source authority is official, government, or official partner;
- source relationship is direct official or equivalent official; and
- evidence explicitly identifies qualifying disciplines, background, fields,
  degree, subjects, or a qualification profile.

It does not waive cycle validation for tuition, deadlines, or language
requirements. It does not accept institution-wide prose, source excerpts,
unsupported inference, or conflicts.

## 3. Decomposition of the 154 effective non-null assertions

The sealed Remediation-4 smoke contained 154 effective non-null assertions.

| Outcome | Count |
|---|---:|
| Candidates for the seven projected benchmark fields | 43 |
| Values for other retained fields outside that projection | 111 |
| Projected candidates accepted as runtime FOUND | 1 |
| Projected candidates rejected/suppressed | 42 |

The 42 rejected projected candidates had overlapping reasons. A mutually
exclusive primary-first-blocker grouping was:

| Primary group | Count |
|---|---:|
| Identity/applicability/scope | 33 |
| Temporal/currentness | 8 |
| Field semantics | 1 |

Reason occurrences are not additive:

- TEMPORAL_SCOPE_UNPROVEN: 41
- PROGRAMME_ADMISSION_SCOPE_UNPROVEN: 15
- PROGRAMME_SCOPE_UNPROVEN: 13
- APPLICABILITY_EVIDENCE_FIELD_MISMATCH: 12
- SOURCE_EXCERPT_ONLY: 14 direct policy occurrences
- AUDIENCE_MISMATCH: 6
- TARGET_CYCLE_MISMATCH: 3
- DEADLINE_TYPE_MISMATCH: 2
- LANGUAGE_FIELD_SEMANTICS_MISMATCH: 2

The previous accepted value was GT-V2-01-tuition. The new positive path added
GT-V2-28-major_admissions_requirement without making any of the seven
Remediation-4 safety cases concrete.

## 4. Decomposition of the previous 52 NEEDS_REVIEW records

| Runtime diagnosis | Count |
|---|---:|
| Non-null candidate exists, blocked by hard semantic/lineage acceptance | 21 |
| No non-null candidate was available after field evaluation | 31 |
| Candidate exists with only a soft Product Safety/quality blocker | 0 |

The 21 candidate-bearing records were blocked by actual runtime conditions:
wrong scope, unknown currentness, wrong audience/cycle, source-excerpt-only
evidence, or field-semantic mismatch. They were not suppressed merely because
Product Safety was unavailable.

## 5. Hard versus soft blockers

Runtime-hard blockers remain:

- wrong field semantics or admission stage;
- wrong programme, track, audience, cycle, or intake scope;
- unresolved substantive conflict;
- stale or historical-only current claim;
- unsupported inference;
- source-excerpt-only evidence;
- missing evidence or assertion raw lineage; and
- invalid value or validation error.

These keep runtime value null while retaining the candidate for audit.

Product-Safety/canonical-only blockers remain separate:

- REVIEW_REQUIRED;
- IDENTITY_UNRESOLVED when routing identity is sufficient;
- INSUFFICIENT_AUTHORITY for Product Safety;
- local-only raw persistence or durable-provenance deficiency; and
- not yet canonically promoted.

A candidate with only the second class may be runtime FOUND while remaining
ineligible for PRODUCT_SAFE or canonical product output. Both FOUND records in
the new smoke retain Product Safety blockers, and PRODUCT_SAFE remains zero.

## 6. Twelve representative suppressed traces

These are post-seal traces from the previous Remediation-4 smoke. Truth was not
used by runtime acceptance.

| Case / field | Evidence and scope | Policy decision |
|---|---|---|
| GT-V2-01 major / subject_prerequisites | MIT says no required high-school classes; institution scope, no cycle | Hard: institution applicability not programme-specific |
| GT-V2-02 major / minimum_degree | MIT regular graduate applicant must have a bachelor’s degree; institution scope, no cycle | Hard: central rule not proven for target programme |
| GT-V2-02 tuition / tuition | USD 33,360 full regular graduate tuition per term; assertion cycle 2026–27 but evidence lacks cycle | Hard: temporal scope unproven |
| GT-V2-04 deadline / priority_deadline | Harvard Restrictive Early Action, November 1; institution scope, no cycle | Hard: programme scope/cycle incomplete |
| GT-V2-04 English / ielts_overall | Visiting-student TOEFL/IELTS statement; unknown scope, international mismatch, excerpt fallback | Hard: wrong audience and source excerpt |
| GT-V2-15 deadline / priority_deadline | Bienen transfer deadline, January 4, 2027; institution scope | Hard: target programme/audience unproven |
| GT-V2-15 major / standardized_tests | SAT/ACT optional for first-year and transfer applicants; institution scope | Hard: generic rule, not a major gate |
| GT-V2-22 English / toefl | Candidate says no TOEFL; evidence is a French requirement; programme scope | Hard: language semantic mismatch |
| GT-V2-22 major / minimum_degree | French DEC eligibility statement; programme scope, no cycle | Hard: admission scope/currentness incomplete |
| GT-V2-25 English / toefl | TOEFL required for master applicants in AY2027; programme scope, target 2026–27 | Hard: target-cycle/language mismatch |
| GT-V2-28 deadline / priority_deadline | ETH international bachelor window, November 2026; institution scope, Autumn 2027 | Hard: wrong degree/cycle and priority type |
| GT-V2-28 major / subject_prerequisites | ETH Data Science qualifying disciplines; programme scope, direct official overview | Previously suppressed; now accepted by narrow profile rule |

## 7. Assertion selection and applicability findings

The selector retained non-null candidates and ranked only candidates accepted by
the field policy. It did not use confidence alone and did not merge
substantive conflicts. The ETH aggregate retains the accepted
subject_prerequisites assertion and the rejection reasons for its other
candidates.

Routing identity remains separate from factual programme identity. An
unresolved factual identity field does not globally suppress a routed field
when that field has sufficient evidence. A generic or related source without
relationship proof is not made programme-applicable.

The change did not alter programme status, deadline, tuition, or English
semantics. Page existence is not status evidence; deadlines still require
type, scope, audience/intake, and current cycle; language evidence still must
describe an applicable admission requirement.

## 8. Field-specific positive acceptance

Remediation-4 positive and negative tests for tuition, application deadlines,
English requirements, and major admissions remain passing. Remediation 5 adds:

- explicit programme qualification profile -> FOUND;
- ordinary programme overview prose -> NEEDS_REVIEW;
- post-enrolment or first-year requirement -> NEEDS_REVIEW.

The post-enrolment guard recognizes first year of enrollment,
première année d'inscription, after-offer, and post-admission structured
stages. This protects a curriculum or after-enrolment requirement from being
promoted as an admission gate.

## 9. Code and tests changed

Changed by this remediation:

- services/data-ingestion/src/glowbal_ingestion/runtime_acceptance.py
- services/data-ingestion/tests/test_runtime_acceptance.py
- docs/benchmarks/2026-09-04-phase-3f-remediation-5-report.md

Implementation changes are limited to runtime_acceptance.py:

- _has_current_programme_profile_context()
- _temporal_is_sufficient(..., component=...)
- _major_admissions_reasons()

No provider, crawler, parser, discovery, truth, scorer, contract, threshold,
or Product Safety implementation was changed. No benchmark case ID appears in
runtime code.

## 10. New 9-programme smoke

| Metric | Result |
|---|---:|
| Programmes attempted | 9 |
| Terminal | 9 |
| Partial/failed | 0 |
| Sources fetched | 96 |
| Parser output non-empty | 96/96 |
| HTML sources | 87 |
| PDF sources | 9 |
| Assertions total | 426 |
| Pipeline non-null metric | 158 |
| Effective non-null assertions | 153 |

The pipeline non-null metric counts pre-effective field slots. The effective
count is the count in the sealed effective_field_assertions.jsonl artifact.

Projection comparison:

| State | Remediation-4 live | Remediation-5 |
|---|---:|---:|
| FOUND/value | 1 | 2 |
| NEEDS_REVIEW/null | 52 | 51 |
| ACCESS_BLOCKED | 8 | 6 |
| CONFLICTING_SOURCES | 2 | 4 |
| NOT_EVALUATED | 0 | 0 |
| PARSE_FAILED | 0 | 0 |
| EXTRACTION_FAILED | 0 | 0 |

The two supported values are GT-V2-01-tuition and
GT-V2-28-major_admissions_requirement. Both retain Product Safety blockers;
neither is PRODUCT_SAFE.

Per-field projection:

| Field | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | CONFLICTING_SOURCES |
|---|---:|---:|---:|---:|
| programme_identity | 0 | 9 | 0 | 0 |
| credential | 0 | 9 | 0 | 0 |
| programme_status | 0 | 7 | 2 | 0 |
| tuition | 1 | 6 | 2 | 0 |
| application_deadline | 0 | 7 | 0 | 2 |
| english_requirement | 0 | 7 | 0 | 2 |
| major_admissions_requirement | 1 | 6 | 2 | 0 |

## 11. Provider and operational metrics

- logical DeepSeek calls: 70
- responses/attempts: 70
- successful extraction event groups: 67
- terminal structured-response group failures: 3
- HTTP 429: 0
- retries: 0
- max in flight: 1
- prompt tokens: 639,341
- completion tokens: 72,156
- total tokens: 711,497
- cost: unavailable from provider response/configuration

The three terminal provider-group failures were schema/content validation
failures, not throttling or balance failures. No provider change was made.

Pipeline errors:

- BLOCKED_BY_ROBOTS: 7
- DISCOVERY_WARNING: 3
- PROGRAMME_IDENTITY_MISMATCH: 2
- HTTP_404: 2
- RESPONSE_TOO_LARGE: 1
- ADMISSION_RETRY_EXTRACTION_FAILED: 1

## 12. Safety audit

All seven zero-tolerance counters are zero:

- false-current critical: 0
- fuzzy-only identity merge: 0
- unresolved conflict promoted: 0
- SOURCE_NOT_FOUND promoted: 0
- STALE_ONLY promoted: 0
- prohibited inferred high-volatility critical promoted: 0
- PRODUCT_SAFE without durable provenance: 0

PRODUCT_SAFE count is zero, so evidence entailment is unavailable rather than
claimed as 100%.

### Seven Remediation-4 safety cases

| Case | Runtime state | Value present | Product Safe | Result |
|---|---|---:|---:|---|
| GT-V2-01-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-02-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-02-tuition | NEEDS_REVIEW | No | No | PASS |
| GT-V2-15-application_deadline | NEEDS_REVIEW | No | No | PASS |
| GT-V2-15-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-22-english_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-22-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |

### Original six P0 cases

The exact composition contains rows 15 and 22 but not rows 9, 23, or 27:

- GT-V2-15-credential: NEEDS_REVIEW/null — PASS
- GT-V2-22-credential: NEEDS_REVIEW/null — PASS
- GT-V2-09-programme_identity: not in exact composition
- GT-V2-09-credential: not in exact composition
- GT-V2-23-credential: not in exact composition
- GT-V2-27-credential: not in exact composition

The remediation does not touch credential or identity normalization, and no
roster-value leakage was observed.

## 13. Comparison with previous smokes

| Metric | Healthy Remediation 3 | Quota-blocked Remediation 4 | Remediation-4 live | Remediation-5 |
|---|---:|---:|---:|---:|
| Sources fetched | 96 | 82 | 96 | 96 |
| Effective non-null assertions | 128 | 0 | 154 | 153 |
| FOUND/value | 9 | 0 | 1 | 2 |
| NEEDS_REVIEW | 38 | 18 | 52 | 51 |
| NOT_EVALUATED | 0 | 0 | 0 | 0 |
| PARSE_FAILED | 0 | 0 | 0 | 0 |
| EXTRACTION_FAILED | 6 | 45 | 0 | 0 |
| False-current | 7 | 0 | 0 | 0 |

Compared with the immediate Remediation-4 live baseline, runtime FOUND
increased by one, effective values varied down by one due normal extraction
variance, and all safety/state invariants remained clean. The recovered value
is a second field family and a second programme, not a blanket suppression
rollback.

## 14. Validation

- focused acceptance/provider/projection/quality/discovery tests: 88 passed
- full data-ingestion test suite: 332 passed
- compileall: PASS
- frozen preflight: PASS; 252 truth, 246 primary, 6 ambiguous, checksums verified
- benchmark scorer tests unchanged: PASS
- JSON/schema and JSONL parsing: PASS
- truth/roster/contract checksums: PASS
- official run #1 output hash unchanged:
  d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc
- official run #2 output hash unchanged:
  d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df
- healthy Remediation-3 output hash unchanged:
  d614df35fe3dba9516d31b812bd53165765aff76de7f08e82bfe50877437c071
- quota Remediation-4 output hash unchanged:
  f7b7b5fa90a2a56a442860ea31f5b7ca30d8aee36b1f5a31a5721b3f2abe7504
- previous live Remediation-4 output hash unchanged:
  55f68188d97345f8bbcdd875e1bd25f03733cdfb7a3c7b8a0105abf6e21138a5
- secret scan: PASS
- git diff --check: PASS

No scorer semantics, truth artifact, frozen run, previous smoke, provider
configuration, or threshold was changed.

## 15. Remaining blockers

This smoke is not a benchmark-quality pass. Remaining issues include:

- programme identity and credential coverage remain unresolved;
- programme status has no supported FOUND value;
- four projected conflict states remain conservative unresolved output;
- three structured extraction groups still fail validation;
- seven source/HTTP/discovery operational errors remain; and
- Product Safe count is zero because raw evidence is local-only/review-blocked.

These are follow-up quality/coverage work items. They were not converted into
benchmark-specific behavior.

## 16. Readiness and stop state

The Remediation-5 smoke satisfies the requested readiness checks:

- FOUND/value > 1: PASS (2)
- supported values, not blanket unsuppression: PASS
- false-current: PASS (0)
- all zero-tolerance counters: PASS (0)
- NOT_EVALUATED: PASS (0)
- PARSE_FAILED: PASS (0)
- EXTRACTION_FAILED: PASS (0)
- provider healthy: PASS (70 calls, 0 HTTP 429, 0 retries)
- Remediation-4 seven-case safety replay: PASS
- no roster-value leakage: PASS
- frozen/run integrity: PASS
- tests and validation: PASS

FULL BENCHMARK RUN #3: READY

This means the next official run may be authorized separately. It was not run
in this task. No later Slice F gate was run.

Slice F: NO-GO  
Node: v22.15.0  
Node 24.19.x: DEFERRED / UNVERIFIED by user decision

