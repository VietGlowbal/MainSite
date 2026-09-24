# Phase 3F Remediation 8 — 50-case assertion-generation revalidation

Date: 2026-09-05  
Classification: diagnostic revalidation; official benchmark #4 was not run.

## 1. Run identity and population

Authoritative revalidation run:

`phase3f-remediation8-revalidation-50-20260905T160831Z`

Code revision: `8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a`  
Worktree: dirty (pre-existing repository changes retained).  
Provider: `deepseek` / `https://api.deepseek.com` / `deepseek-v4-flash`; reasoning `none`.

The exact 50-case population was loaded from the sealed Remediation-7/8
diagnostic, with no expected values or truth states passed to runtime:

- `programme_identity` (25): `GT-V2-01`, `GT-V2-02`, `GT-V2-03`, `GT-V2-05`, `GT-V2-11`, `GT-V2-12`, `GT-V2-13`, `GT-V2-14`, `GT-V2-16`, `GT-V2-17`, `GT-V2-18`, `GT-V2-19`, `GT-V2-20`, `GT-V2-22`, `GT-V2-23`, `GT-V2-24`, `GT-V2-25`, `GT-V2-26`, `GT-V2-27`, `GT-V2-28`, `GT-V2-29`, `GT-V2-30`, `GT-V2-32`, `GT-V2-33`, `GT-V2-34`.
- `credential` (25): `GT-V2-01`, `GT-V2-02`, `GT-V2-03`, `GT-V2-04`, `GT-V2-05`, `GT-V2-10`, `GT-V2-11`, `GT-V2-12`, `GT-V2-13`, `GT-V2-14`, `GT-V2-16`, `GT-V2-17`, `GT-V2-18`, `GT-V2-19`, `GT-V2-20`, `GT-V2-21`, `GT-V2-25`, `GT-V2-26`, `GT-V2-28`, `GT-V2-29`, `GT-V2-30`, `GT-V2-31`, `GT-V2-32`, `GT-V2-33`, `GT-V2-34`.

All 50 cases were reprocessed from existing raw evidence. There were 29
unique routed programmes, 32 parser reruns, 29 extractor reruns, 0 refetches,
and 0 newly discovered URLs.

## 2. Assertion-generation result

| Field | Assertion created | Non-null assertion | FOUND | NEEDS_REVIEW | NOT_EVALUATED |
|---|---:|---:|---:|---:|---:|
| `programme_identity` | 24/25 | 24/25 | 22 | 1 | 1 |
| `credential` | 20/25 | 20/25 | 0 | 20 | 5 |
| **Total** | **44/50** | **44/50** | **22** | **22** | **6** |

`ASSERTION_GENERATION_RECOVERY_RATE = 44/50 = 88.00%`.

The repaired identity path is therefore recovered for 24/25 cases and the
credential path for 20/25 cases. This exceeds the required majority threshold
of 26/50 and the preferred 40/50 diagnostic target.

No `ACCESS_BLOCKED`, `SOURCE_NOT_FOUND`, `PARSE_FAILED`, or
`EXTRACTION_FAILED` final state was produced. `NOT_EVALUATED` is limited to
six successful extraction groups that returned no fact for the requested
field; it is not being used for provider or parser failures.

## 3. First-loss stages for remaining cases

| First-loss stage | Count | Cases |
|---|---:|---|
| `EXTRACTOR_EMPTY` | 6 | `GT-V2-04-credential`, `GT-V2-12-credential`, `GT-V2-14-credential`, `GT-V2-21-credential`, `GT-V2-26-credential`, `GT-V2-26-programme_identity` |
| `ASSERTION_REJECTED` | 2 | `GT-V2-33-credential`, `GT-V2-33-programme_identity` |
| **Total still without clean FOUND path** | **8** | — |

The two rejected assertions were retained with non-null values and provenance;
they were suppressed by `SOURCE_PROGRAMME_MISMATCH`. The six empty results
were returned by a completed identity extraction group without a fact for that
field. No candidate-to-assertion serialization loss was observed in the
revalidation.

## 4. Runtime path checks

For each case the matrix records evidence availability, router invocation,
extractor invocation, candidate creation/value presence, assertion creation,
selector visibility, final state/value presence, source reference, evidence
locator, and first-loss stage.

The generic path now works as:

`persisted raw → parser → identity field router → DeepSeek structured fact →
source-backed assertion → selector → runtime projection`.

Routing identity remained separate from factual `programme_identity`. The
revalidation programme objects deliberately carried `credential=null`; no
roster credential was supplied as an answer. Source-native credential values
were allowed to form assertions before downstream temporal/acceptance review.

## 5. Provider and reprocessing metrics

- Logical DeepSeek requests/calls: 29/29.
- Responses: 29; failures: 0; retries: 0; HTTP 429: 0; terminal rate-limit failures: 0.
- Prompt tokens: 139,509.
- Completion tokens: 12,176.
- Total tokens: 151,685.
- Cost: unavailable from authoritative provider metadata.
- Parser reruns: 32 from persisted raw files.
- Actual refetches: 0.
- New URLs: 0.

## 6. Safety and FOUND audit

The runtime matrix was sealed before the frozen truth was read. Post-seal
truth audit found:

- false-current critical: **0**; no case with frozen `NEEDS_REVIEW/null` had a concrete runtime value.
- fuzzy-only identity merge: **0**.
- unresolved conflict promoted: **0**.
- critical `SOURCE_NOT_FOUND` promoted: **0**.
- critical `STALE_ONLY` promoted: **0**.
- prohibited inferred high-volatility critical promoted: **0**.
- `PRODUCT_SAFE` without durable provenance: **0** (this revalidation does not invoke promotion).
- FOUND evidence audit failures: **0**.

All 22 FOUND rows have an official source reference, non-empty evidence
locator, and source authority. The 22 FOUND rows are all
`programme_identity`; credential assertions remain conservatively
`NEEDS_REVIEW` because the direct evidence does not establish current temporal
applicability under the locked credential guard.

The six original P0 IDs (`GT-V2-09-programme_identity`,
`GT-V2-09-credential`, `GT-V2-15-credential`, `GT-V2-22-credential`,
`GT-V2-23-credential`, `GT-V2-27-credential`) are not members of this exact
50-case direct-support population. Their existing Remediation-8 regression
coverage remains unchanged; no runtime regression was introduced here.

## 7. Artifacts and hashes

- Matrix: `docs/benchmarks/runs/phase3f-remediation8-revalidation-50-20260905T160831Z/remediation8-50case-revalidation.jsonl`
  - SHA-256: `96ccc2901e8a669ff081e901ff68ea8f3d12b3fa5308e8e61fb55a802fbb1a3f`
- Sealed runtime output: `docs/benchmarks/runs/phase3f-remediation8-revalidation-50-20260905T160831Z/revalidation-output.json`
  - SHA-256: `bd3df6a338502b8324cedb878dc745bff281716a191b1f6663b9ed46497b2572`
- Run manifest: `docs/benchmarks/runs/phase3f-remediation8-revalidation-50-20260905T160831Z/run-manifest.json`
  - SHA-256: `43a129f63188c6f7a92fe1dfcbddddd02e92a942498c44518880aa3e90946d28`
- Post-seal truth audit: `docs/benchmarks/runs/phase3f-remediation8-revalidation-50-20260905T160831Z/post-seal-truth-audit.json`
  - SHA-256: `4a8d74f010be023fba63067d0c265779c3ee975195d036235c8f68bfb5d963e7`
- Revalidation harness: `scripts/revalidate_phase3f_remediation8.py`

Frozen truth, roster, scorer contract, and official runs #1/#2/#3 retained
their authoritative SHA-256 values. Their integrity check passed.

## 8. Tests and validation

- Core ingestion/test suite: **354 passed in 11.57s**.
- Compileall: **PASS**.
- Revalidation JSON/JSONL validation: **PASS** (50 rows, 50 unique IDs, 25+25).
- Frozen and official run integrity: **PASS**.
- Secret scan on harness and generated artifacts: **PASS**.
- `git diff --check`: **PASS** (only existing LF/CRLF normalization warnings).
- Scorer semantics and scorer contract: unchanged.

## 9. Readiness and stop state

`FULL BENCHMARK RUN #4 READY` for the specific Remediation-8 assertion-
generation gate: the majority recovery criterion is met (44/50), both field
paths work generically, provider/reprocessing integrity is clean, and all
zero-tolerance counters remain zero.

This is not authorization to run benchmark #4. Official benchmark #4 was not
run, no individual case was rerun selectively after scoring, and no additional
remediation or later Slice F gate was executed.

Slice F remains **NO-GO** pending explicit authorization and remaining
production gates.
