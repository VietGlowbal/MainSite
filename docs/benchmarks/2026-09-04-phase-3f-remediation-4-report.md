# Phase 3F Remediation 4 — Safety acceptance and smoke report

Date: 2026-09-04  
Status: targeted remediation complete; official benchmark #3 was **not run**.

## 1. Scope and integrity

The frozen truth, roster, scorer contract, thresholds, review decisions, and
official runs were not changed.  The new policy is runtime visibility policy;
it does not decide `PRODUCT_SAFE` or canonical promotion.

Frozen input checksums reverified:

| artifact | SHA-256 | result |
|---|---|---|
| frozen truth | `97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4` | PASS |
| roster | `7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139` | PASS |
| scorer contract Markdown | `47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91` | PASS |
| machine contract | `720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99` | PASS |

Sealed historical outputs remain unchanged:

| run | pipeline-output SHA-256 |
|---|---|
| `phase3f-v2-run-20260901T120410Z` | `d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc` |
| `phase3f-v2-run-20260903T065023Z` | `d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df` |
| Remediation 3 smoke | `d614df35fe3dba9516d31b812bd53165765aff76de7f08e82bfe50877437c071` |

## 2. Seven false-current traces

The first incorrect acceptance was the benchmark projection's
`_projection_candidate`/`_aggregate_state` path.  It accepted non-null
assertions with unknown applicability/currentness and then treated any
component value as an aggregate `FOUND` value.  Product Safety correctly
remained `REVIEWABLE`, but runtime visibility was too permissive.

The new deterministic policy retains the candidate assertion and evidence but
requires field-specific scope and currentness before runtime `FOUND`:

| case | observed semantic blocker | new policy result in read-only replay |
|---|---|---|
| `GT-V2-01-major_admissions_requirement` | institution-wide generic high-school/testing/application statements; applicability and temporal scope unproven | `NEEDS_REVIEW/null` |
| `GT-V2-02-major_admissions_requirement` | institution-wide graduate requirements; applicability evidence was not field-specific and temporal scope was unknown | `NEEDS_REVIEW/null` |
| `GT-V2-02-tuition` | 2026–27 was in assertion metadata but absent from the tuition evidence span | `NEEDS_REVIEW/null` |
| `GT-V2-15-application_deadline` | institution-wide mixed first-year/transfer dates; attached applicability evidence concerned dual-degree requirements, not deadlines | `NEEDS_REVIEW/null` |
| `GT-V2-15-major_admissions_requirement` | general college application components, not target-programme/major admission gates; temporal scope unproven | `NEEDS_REVIEW/null` |
| `GT-V2-22-english_requirement` | French-language evidence was represented as a TOEFL “no requirement” assertion; currentness was also unproven | `NEEDS_REVIEW/null` |
| `GT-V2-22-major_admissions_requirement` | programme statements were not temporally established as current major-admission requirements; several were general admission/document propositions | `NEEDS_REVIEW/null` |

Root-cause grouping by case: major-admissions semantics 4, tuition temporal
scope 1, deadline applicability/type 1, English field semantics/currentness 1.
The overlapping policy reasons were `TEMPORAL_SCOPE_UNPROVEN`,
`PROGRAMME_SCOPE_UNPROVEN`, `APPLICABILITY_EVIDENCE_FIELD_MISMATCH`,
`PROGRAMME_ADMISSION_SCOPE_UNPROVEN`, and
`LANGUAGE_FIELD_SEMANTICS_MISMATCH`.

## 3. Acceptance contract implemented

`glowbal_ingestion.runtime_acceptance` now provides
`projection_acceptance_reasons()` and `can_resolve_found()`.

Common gates reject absent evidence/raw lineage, rejected/invalid/inferred
assertions, target-cycle mismatches, audience mismatches, historical/future
assertions, and explicitly non-applicable assertions.  Unknown metadata is not
silently treated as proof for strict fields.

Field-specific gates are:

- `major_admissions_requirement`: requires a programme/offering-scoped,
  admission-stage proposition; curriculum, graduation, placement,
  post-admission declaration, and generic application material do not qualify.
- `tuition`: requires structured amount/currency semantics, tuition evidence,
  current target-cycle evidence, and degree-compatible scope.  cost of
  attendance, budgets, registration/application fees, living costs, and
  funding are rejected as tuition.
- `application_deadline`: requires application/deadline semantics, programme
  scope, target-cycle evidence, and the correct priority/final type.  dates for
  registration, enrolment, documents, funding, or fees are rejected.
- `english_requirement`: requires English-admissions/test semantics and
  rejects a language-of-instruction statement, recommended-only score, or a
  different-language statement mapped to an English test component.
- `programme_status`: explicit lifecycle/current application evidence remains
  required; page existence alone is not a status claim.

An explicit `CURRENT`/`APPLICABLE` assertion can still be runtime `FOUND` while
`PRODUCT_SAFE` remains false.  Unknown status is accepted only where the
evidence itself establishes a target cycle or explicit current lifecycle
statement.  Suppressed candidates remain in assertion artifacts and are
labelled with deterministic rejection reasons in the projection lifecycle.

## 4. Product Safety and identity

Product Safety code and blocker vocabulary were not weakened or duplicated.
Runtime `FOUND` remains independent from Product Safety; raw durability,
identity, authority, conflict, stale, inference, and promotion blockers remain
separate metadata.  The existing routing-identity/factual-identity split is
preserved: routing a document to a roster programme does not establish the
factual identity or credential.

The six original Remediation 1 P0 cases were replayed through the current
projection against the sealed official run #2 pipeline artifacts; all six
remain `NEEDS_REVIEW` with null values.  No benchmark case ID or expected value
is referenced by runtime policy.

## 5. Configuration correction

The live smoke initially inherited the first of two provider assignments in
`.env.local` and used the old B.AI-compatible endpoint.  The loader now uses
the last assignment within the env file while preserving explicitly supplied
process variables.  When `EXTRACTION_PROVIDER=deepseek`, DeepSeek-specific
key, base URL, and model variables take precedence over stale compatible
variables.

Effective configuration was checked in a clean process without printing the
secret:

```text
provider = deepseek
base_url = https://api.deepseek.com
model = deepseek-v4-flash
reasoning = none
api_key_present = true
```

## 6. Tests and code changes

Changed files:

- `services/data-ingestion/src/glowbal_ingestion/runtime_acceptance.py`
- `scripts/run_phase3f_v3_benchmark.py`
- `services/data-ingestion/src/glowbal_ingestion/config.py`
- `services/data-ingestion/src/glowbal_ingestion/deepseek.py`
- `services/data-ingestion/src/glowbal_ingestion/extraction_provider.py`
- `services/data-ingestion/tests/test_runtime_acceptance.py`
- `services/data-ingestion/tests/test_extraction_provider.py`
- `docs/current-status.md`

The projection now records per-candidate acceptance/rejection reasons.  Tests
cover positive and negative admissions, tuition, deadline, and English cases;
identity routing; safe unresolved behavior; value projection; and explicit
DeepSeek precedence over stale compatible configuration.

Measured validation:

| check | result |
|---|---|
| focused provider/acceptance/projection tests | **43 passed** |
| full ingestion test suite | **334 passed** |
| compileall (`services/data-ingestion/src`, `scripts`) | **PASS** |
| frozen truth preflight and scorer tests | **PASS**; 252/246/6/0 recognized |
| JSON/schema validation | **PASS** via benchmark preflight and test suite |
| secret scan | **PASS**; only pre-existing placeholder/token-test literals matched the generic scanner |
| `git diff --check` | **PASS**; existing LF/CRLF warnings only |

## 7. Nine-programme smoke

Composition was unchanged: roster rows `1, 2, 4, 6, 15, 22, 25, 26, 28`.

The first attempted ID had a shell timestamp syntax error and was aborted before
sealing.  It is marked `ABORTED_INFRASTRUCTURE` and is not used.  The next run
used the wrong inherited B.AI-compatible configuration and is marked
`INVALID_PROVIDER_CONFIGURATION`; its sealed output is not used for
conclusions.  The valid DeepSeek smoke is:

```text
run_id: phase3f-remediation4-9prog-20260904T090000Z
pipeline-output SHA-256: f7b7b5fa90a2a56a442860ea31f5b7ca30d8aee36b1f5a31a5721b3f2abe7504
```

Execution:

| measure | result |
|---|---:|
| programmes attempted / terminal | 9 / 9 |
| pipeline programme records | 9 |
| sources fetched | 82 |
| parser output | non-empty for fetched sources; no `PARSE_FAILED` output |
| total assertions | 324 |
| effective/non-null assertions | 0 / 0 |
| projected `FOUND/value` | 0 |
| projected `NEEDS_REVIEW/null` | 18 |
| projected `NOT_EVALUATED` | 0 |
| projected `PARSE_FAILED` | 0 |
| projected `EXTRACTION_FAILED` | 45 |
| `PRODUCT_SAFE` | 0 |

The DeepSeek endpoint responded with `HTTP 402 Insufficient Balance` for the
extraction groups.  There were 8 logical provider-failure traces, 9 terminal
provider error records, 0 HTTP 429 records, 0 successful structured calls, and
0 non-null LLM-derived assertions.  Provider retry-attempt totals and token
usage were not persisted for this failed run; cost is unavailable.  The
terminal provider errors were preserved as extraction failures and did not
fabricate values.

Because the valid live smoke had no provider balance, it cannot establish the
semantic quality of the new acceptance policy by itself.  A read-only replay
of the sealed Remediation 3 pipeline artifacts through the new policy produced:

```text
FOUND/value:       1 (GT-V2-01-tuition, explicit 2026–27 undergraduate tuition evidence)
NEEDS_REVIEW/null: 46
ACCESS_BLOCKED:    10
EXTRACTION_FAILED: 6
false-current:     0 for all seven audited cases
```

That replay is diagnostic only; it did not modify the prior sealed output.
Before the policy, the same sealed smoke had `FOUND=9` and false-current `7`.

## 8. Safety audit

For the valid DeepSeek smoke, all zero-tolerance counters are numerically zero,
but the false-current result is vacuous because extraction was blocked.  The
read-only replay above independently confirms the new policy suppresses all
seven unsupported concrete values.  Product Safety count is zero, so evidence
entailment is **unavailable**, not 100%.

| counter | result |
|---|---:|
| false-current critical | 0 in live empty-output smoke; 0 in seven-case policy replay |
| fuzzy-only identity merge | 0 |
| unresolved conflict promoted | 0 |
| `SOURCE_NOT_FOUND` promoted | 0 |
| `STALE_ONLY` promoted | 0 |
| prohibited inferred critical promotion | 0 |
| `PRODUCT_SAFE` without durable provenance | 0 |

## 9. Readiness and remaining blockers

Remediation 4 meets the deterministic safety regression tests and policy replay,
but the required live 9-programme smoke did not produce a usable non-null
extraction because the official DeepSeek account returned `402 Insufficient
Balance`.  The smoke therefore fails the required useful-coverage criterion
`FOUND/value > 1` and does not prove provider-path health under the new code.

Remaining blockers:

1. Add balance/credits or otherwise restore the authorized DeepSeek account,
   then rerun the same nine-row diagnostic smoke with a new ID.
2. Reconfirm multiple supported values survive the stricter acceptance policy
   and that the seven-case safety audit remains zero on a live extraction.
3. Reassess remaining discovery/coverage work only after a provider-healthy
   smoke; no Harvard/Tokyo acquisition changes were made in this remediation.

Therefore:

```text
FULL BENCHMARK RUN #3: BLOCKED
Reason: provider HTTP 402 prevented a valid live extraction smoke and FOUND/value remained 0.
Official benchmark #3: NOT RUN
Slice F: NO-GO
```

