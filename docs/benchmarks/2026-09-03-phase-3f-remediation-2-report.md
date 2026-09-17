# Phase 3F Remediation 2 — Projection, Quality Policy, Discovery, and Parser Audit

Date: 2026-09-03  
Scope: diagnosis and targeted repair only  
Official benchmark run #3: NOT RUN  
Slice F: NO-GO

## Decision

The projection defect is fixed in the working tree and is covered by a regression
test. The six-programme diagnostic smoke produced non-null values after
projection, while preserving conservative Product Safety and NEEDS_REVIEW/null
behavior. Official run #3 remains BLOCKED because the smoke still has material
provider throttling, incomplete field evidence, and the Harvard/Tokyo discovery
floor issue. No official benchmark was rerun and no sealed benchmark artifact
was changed.

## 1. Root cause of 262 effective non-null → 0 projected non-null

The loss occurred in the benchmark harness projection, after assertion
construction. In scripts/run_phase3f_v3_benchmark.py,
_state_for_assertions treated any selected assertion with verification state
NEEDS_REVIEW as an unresolved null result. High-risk fields can legitimately
have a non-null, evidence-backed runtime candidate while the quality policy
marks that candidate as not eligible for Product Safety. That projection rule
therefore converted all effective non-null candidates into NEEDS_REVIEW/null.

The same projection also used factual credential presence as the test for
programme identity. Remediation 1 correctly stopped using the roster credential
as evidence, but the old projection interpreted the resulting null credential
as globally unresolved programme routing and suppressed every field. Routing
identity and factual identity were conflated.

The exact lifecycle is now separated as:

    assertion candidate
      → runtime field resolution (FOUND/value or unresolved)
      → quality/Product Safety evaluation (independent blockers)
      → canonical promotion decision
      → benchmark projection

FOUND/value can therefore coexist with PRODUCT_SAFE=false and preserved
blockers. A candidate is still suppressed when its value is semantically
unsafe, unsupported, inapplicable, stale, conflicting, inferred in a
prohibited high-volatility field, or otherwise rejected by the existing
policy.

## 2. Exact changes

The targeted changes were:

- _projection_candidate, _state_for_assertions, _aggregate_state, and
  _project_output now select an evidenced, applicable, temporally compatible
  candidate without requiring Product Safety or canonical promotion.
- Product Safety blocker calculation is retained separately and reuses the
  canonical BLOCKERS and ProductLifecycleState primitives. No safety blocker
  was removed or weakened.
- Projection identity now records routing resolution separately from factual
  identity verification. No roster credential or expected truth value is
  injected.
- Source authority, relationship, and temporal metadata are propagated through
  the legacy fetch path. Assertion deserialization restores the enum values
  used by quality/promotion instead of leaving them as raw strings.
- Robots-blocked manual roster targets remain visible as terminal routing
  candidates; the robots policy is not bypassed.
- A bounded projection trace was added. It records lifecycle metadata and
  references, not raw document bodies or secrets.

Files changed for this remediation include:

    scripts/run_phase3f_v3_benchmark.py
    services/data-ingestion/src/glowbal_ingestion/pipeline.py
    services/data-ingestion/src/glowbal_ingestion/discovery.py
    services/data-ingestion/tests/test_remediation_smoke.py
    docs/current-status.md
    docs/benchmarks/2026-09-03-phase-3f-remediation-2-report.md

The working tree contains other pre-existing Slice F and user changes; they
were preserved and are not represented as remediation-2 benchmark results.
The frozen truth, scorer, thresholds, and canonical Product Safety policy were
not modified.

## 3. Quality-policy blocker distribution

Run #2 had 110 QUALITY_POLICY score errors. At the score projection level,
25 were unsafe NOT_PUBLISHED/concrete-value cases and 85 were confirmed FOUND
truth cases lost to coverage. This classification is not a reason to weaken
the policy.

The run's quality-assessment artifact contained 612 assessments:

| assessment result | count |
| --- | ---: |
| FOUND | 419 |
| NEEDS_REVIEW | 173 |
| CONFLICTING_SOURCES | 20 |
| verification VALIDATED | 419 |
| verification UNVERIFIED | 193 |

These dimensions are intentionally not mutually exclusive. All 612 assessments
had missing authority metadata and unknown temporal state in the run-2
diagnostic data; all were marked applicable. The review/authority/time
blockers explain why the quality shadow rejected candidates even though many
had values.

For the 110 affected projection cases, the current diagnostic blocker
occurrences were:

| blocker | occurrences | interpretation |
| --- | ---: | --- |
| IDENTITY_UNRESOLVED | 110 | Product Safety/canonical blocker; not a runtime-value blocker when routing is known |
| MISSING_CRITICAL_FIELD | 107 | Suppresses runtime value where no valid candidate exists |
| INSUFFICIENT_AUTHORITY | 38 | Product Safety/canonical blocker |
| REVIEW_REQUIRED | 19 | Product Safety/canonical blocker; may suppress a semantically unsafe value |
| RAW_LINEAGE_MISSING | 19 | Product Safety/canonical blocker |
| UNRESOLVED_CONFLICT | 12 | Suppresses the conflicted critical value and blocks safety |

Occurrences are non-exclusive because one field may have multiple blockers.

The locked distinction is:

- Runtime value is suppressed for semantic validation errors, unsupported
  source excerpts, missing required cycle/fee-period/audience scope, explicit
  non-applicability, stale/future evidence, unresolved critical conflict,
  prohibited inference, and other blockers that make the assertion itself
  unsafe.
- IDENTITY_UNRESOLVED, insufficient authority, missing durable raw lineage,
  review-required verification, and canonical-promotion blockers block Product
  Safety and promotion. They do not erase a separately valid runtime candidate
  solely because the product is not yet safe.

The three required outcomes are represented and tested:

    supported claim                 → FOUND/value, Product Safety as applicable
    supported but product-blocked   → FOUND/value, PRODUCT_SAFE=false, blocker retained
    semantically unsafe/ambiguous   → NEEDS_REVIEW/null or operational unresolved state

## 4. Identity routing versus factual identity

The old global suppression was caused by using factual credential presence as
the identity gate. The revised projection uses the benchmark programme and
official routing association to select documents, while keeping
factual_identity_resolved false unless source evidence supports it. This
preserves the Remediation 1 invariant:

    roster credential ≠ extraction evidence

The diagnostic smoke emitted records for all six selected rows, including
robots-blocked Harvard and Tokyo targets. No fuzzy-only merge or roster-value
leakage was observed. The smoke does not establish a discovery pass.

The six original false-current cases remain suppressed as required:

    GT-V2-09-programme_identity  NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS
    GT-V2-09-credential          NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS
    GT-V2-15-credential           NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS
    GT-V2-22-credential           NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS
    GT-V2-23-credential           NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS
    GT-V2-27-credential           NEEDS_REVIEW/null, not PRODUCT_SAFE  PASS

## 5. Programme status and application deadline

Run #2 had 17 programme-status incorrect/unsafe-unresolved cases and 19
coverage losses. Page existence, a catalogue hit, or a resolving URL is not
treated as evidence that a programme is ACTIVE. Current projection requires
an applicable, current, supported status assertion; otherwise it preserves
review or operational unresolved state.

Run #2 had 7 application-deadline incorrect/unsafe-unresolved cases, 7 safe
unresolved cases, and 22 coverage losses. The audit preserves the distinction
between application and registration, priority and final deadlines,
programme and institution scope, and cycle/intake/year. A date without the
required applicability and target-cycle metadata is not projected as a
resolved programme deadline.

## 6. Discovery decomposition and rows 4/6/26

The 93 DISCOVERY taxonomy entries in run #2 are field-level NOT_EVALUATED
cases, not 93 independent crawler failures:

| field | NOT_EVALUATED cases |
| --- | ---: |
| programme_status | 19 |
| application_deadline | 19 |
| english_requirement | 19 |
| tuition | 18 |
| major_admissions_requirement | 18 |
| total | 93 |

The three missing pipeline programme records were rows 4 and 6 (Harvard) and
row 26 (University of Tokyo). The common cause is robots-policy blocking on
the configured official targets. The discovery change preserves these as
terminal blocked candidates so they are observable; it does not bypass
robots, add answer-specific URLs, or turn a blocked fetch into a successful
source.

The institution-floor issue therefore remains open: Harvard was 1/3 and
Tokyo 2/3 in run #2. Generic catalogue/sitemap/canonical URL discovery can be
remediated later, but the legitimate external robots restriction is preserved
as operational evidence.

## 7. Residual parsing/extraction failures

The 17 PARSING entries decompose at the field level as:

| field | cases |
| --- | ---: |
| english_requirement | 9 |
| tuition | 5 |
| major_admissions_requirement | 3 |

All 287 run-2 fetched sources had non-empty parser input/output (276 HTML and
11 PDF). The remaining taxonomy entries are therefore missing/failed field
extraction groups (PARSE_FAILED at field state), not empty-parser failures.
No source-specific parser bypass or benchmark-specific repair was added.

## 8. Provider and token observations

Run #2 used the fixed provider configuration openai_compatible,
https://api.b.ai/v1, model deepseek-v4-flash, reasoning none:

| measure | run #2 |
| --- | ---: |
| logical calls | 71 |
| successful structured traces | 34 |
| provider failure traces | 11 |
| failure attempts | 258 |
| terminal group failures | 50 |
| prompt tokens | 556,059 |
| completion tokens | 71,407 |
| average prompt/completion per logical call | 7,832 / 1,006 |

Extraction failure groups were HTTP 429s: language 11, funding 10, career 9,
finance 9, and academics/admissions 5. A later direct connectivity smoke
returned HTTP 200, so the provider is reachable but throttling/retry
amplification remains a reliability issue. No provider/model switch or Pro
fallback was introduced. Per-call median/max and cost were unavailable.

## 9. Safe-unresolved audit

Run #2 improved safe-unresolved correctness to 26/124 (20.97%) from 0/124.
The remaining 98 cases decompose as:

| cause | cases |
| --- | ---: |
| operational discovery/coverage loss (NOT_EVALUATED) | 63 |
| NOT_PUBLISHED/unsafe unresolved value quality-policy cases | 25 |
| field-level parse/extraction failure | 10 |

Operational failures remain operational failures. Only semantic uncertainty
is mapped to NEEDS_REVIEW/null; the system does not fabricate a value when
the provider, fetch, or parser fails.

## 10. Six-programme diagnostic smoke

Smoke run: phase3f-remediation2-6prog-20260903T085624Z  
Rows: 1, 4, 6, 22, 26, 28  
Status: diagnostic-only, sealed; not scored and not an official benchmark.

| measure | result |
| --- | ---: |
| programmes attempted / terminal | 6 / 6 |
| pipeline programme records | 6 |
| sources fetched | 35 |
| HTML / PDF source outputs | 32 / 3 |
| parser outputs non-empty | 35 / 35 |
| pipeline assertions | 284 |
| pipeline non-null metric | 79 |
| effective assertions / non-null | 154 / 78 |
| deterministic non-null | 10 |
| provider-derived non-null | 68 |
| final projected records | 42 |
| final projected non-null / FOUND | 1 / 1 |
| final NEEDS_REVIEW | 21 |
| final NOT_EVALUATED | 15 |
| final PARSE_FAILED | 5 |
| PRODUCT_SAFE | 0 |
| provider calls / failures | 12 / 48 attempts |
| terminal provider group failures | 12 |
| robots-blocked errors | 4 |

The projected non-null value was a DeepSeek-assisted
major_admissions_requirement candidate for row 28. It survived assertion,
quality evaluation, and projection as FOUND/value, while the product state
remained reviewable with safety blockers. The smoke also demonstrated safe
suppression and preserved Harvard/Tokyo robots outcomes. It is not evidence
of benchmark-quality coverage.

## 11. Error taxonomy and remaining priorities

The unchanged taxonomy remains:

    DISCOVERY SOURCE_SELECTION FETCH PARSING EXTRACTION APPLICABILITY TEMPORAL
    CONFLICT RECOVERY IDENTITY QUALITY_POLICY PROMOTION GROUND_TRUTH_AMBIGUOUS

Run #2 counts were DISCOVERY 93, PARSING 17, QUALITY_POLICY 110, and
GROUND_TRUTH_AMBIGUOUS 6; other classes were zero in the sealed score.
The dominant remaining P1 clusters are:

- provider 429 throttling and retry amplification;
- incomplete field evidence and missing cycle/scope metadata;
- generic discovery and official-domain navigation under robots blocking;
- residual field-level extraction failures for language, tuition, and
  admissions;
- factual identity/credential evidence remaining review-required.

No P0 safety regression was found. The original six false-current cases remain
safe, and all seven zero-tolerance counters remain zero in the sealed run and
diagnostic checks:

    false-current critical                          0
    fuzzy-only identity merge                       0
    unresolved conflict promoted                    0
    SOURCE_NOT_FOUND promoted                       0
    STALE_ONLY promoted                             0
    prohibited inferred high-volatility promotion   0
    PRODUCT_SAFE without durable provenance         0

## 12. Integrity and validation

Frozen input checksums were reverified and unchanged:

    truth     97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4
    roster    7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139
    contract  47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91
    machine   720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99

Sealed official outputs remain unchanged:

    run #1 pipeline output  d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc
    run #2 pipeline output  d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df
    smoke pipeline output   80186a3c2a7ed1102a1c4af87707919a0dd4671c4cd55fe712022ab133aecbe0

Validation performed:

    Remediation/provider/convergence tests: PASS (24 tests)
    Full ingestion suite: PASS (310 tests)
    Benchmark scorer suite: PASS (13 tests)
    compileall: PASS
    JSON/JSONL/schema/load-output validation: PASS
    secret scan: PASS; no secret-pattern hits
    git diff --check: PASS

The smoke manifest records pipeline_truth_access=false and frozen-roster and
source-register-only pipeline input. The scorer was not invoked for this
diagnostic smoke. Node remains v22.15.0; Node 24.19.x is
DEFERRED / UNVERIFIED by user decision.

## 13. Run #3 readiness

FULL BENCHMARK RUN #3: BLOCKED.

The projection fix satisfies the primary technical gate: non-null assertions
now reach final projection, and supported runtime values are not forced to
PRODUCT_SAFE. However, the six-row smoke still showed provider throttling,
only one projected non-null value, unresolved field-evidence coverage, and
the unchanged Harvard/Tokyo discovery-floor condition. These are explicit
remaining remediation blockers, not a reason to rerun the official 36-row
benchmark yet.

No Remediation 2 follow-on or later Slice F gate was run. Slice F remains
NO-GO.
