# Phase 3F Remediation 4 — Live DeepSeek Verification

Date: 2026-09-04  
Scope: diagnostic 9-programme smoke only; official benchmark #3 was not run.

## 1. Effective provider configuration

The effective live configuration was verified in a clean Python process and again
for the smoke:

```text
provider = deepseek
base_url = https://api.deepseek.com
model = deepseek-v4-flash
reasoning = none
DEEPSEEK_API_KEY loaded = true
```

The direct DeepSeek branch was selected. The B.AI/OpenAI-compatible endpoint and
compatible credentials did not contribute to this run. The key value was never
printed or written to an artifact.

## 2. Connectivity smoke

PASS. One live request returned HTTP 200 and non-empty JSON.

```text
latency: 578.4 ms
prompt tokens: 62
completion tokens: 6
retries: 0
429 responses: 0
```

## 3. Structured extraction smoke

PASS. One controlled request through the production DeepSeek extraction client
returned valid `GlowBalEducationExtraction/v9` JSON. The candidate had a
non-null value, became a non-null `FieldAssertion`, retained evidence and raw
lineage, and reached runtime projection as `FOUND`.

```text
HTTP: 200
calls: 1
prompt tokens: 2,259
completion tokens: 154
schema: PASS
assertion value: present
projection: FOUND/value
retries: 0
```

## 4. Smoke identity and integrity

```text
run_id: phase3f-remediation4-9prog-20260904T151031Z
code revision: 8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a
dirty worktree: true
started: 2026-09-04T15:10:31+00:00
finished: 2026-09-04T15:17:11+00:00
composition: roster rows 1, 2, 4, 6, 15, 22, 25, 26, 28
programmes attempted: 9
terminal: 9
partial/failed: 0
truth access by pipeline: false
```

Frozen input checksums matched the freeze manifest:

```text
truth: 97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4
roster: 7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139
contract Markdown: 47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91
machine contract: 720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99
```

The sealed pipeline output is:

```text
docs/benchmarks/remediation-smokes/phase3f-remediation4-9prog-20260904T151031Z/pipeline-output.json
sha256: 55f68188d97345f8bbcdd875e1bd25f03733cdfb7a3c7b8a0105abf6e21138a5
```

The run manifest is at:

```text
docs/benchmarks/remediation-smokes/phase3f-remediation4-9prog-20260904T151031Z/run-manifest.json
sha256: 2e0bee94abe1bdc661c0b8592e3ed8d382e93ce9a97b1d709cda79939cd28b79
```

The output was sealed before truth was read for audit. It was not mutated after
sealing.

## 5. Execution and parser metrics

```text
programme discovery: 9/9
required-source discovery: 9/9
sources fetched: 96
parser output non-empty: 96/96
HTML parser sources: 87
PDF parser sources: 9
```

Pipeline metrics recorded 427 assertions, of which 154 were effective non-null
assertions. The run produced 16 operational errors:

```text
BLOCKED_BY_ROBOTS: 7
DISCOVERY_WARNING: 3
PROGRAMME_IDENTITY_MISMATCH: 2
HTTP_404: 2
RESPONSE_TOO_LARGE: 1
ADMISSION_RETRY_EXTRACTION_FAILED: 1
```

## 6. Projection metrics

There were 63 projected records (7 benchmark fields × 9 rows):

| State | Count |
|---|---:|
| FOUND/value | 1 |
| NEEDS_REVIEW/null | 52 |
| ACCESS_BLOCKED | 8 |
| CONFLICTING_SOURCES | 2 |
| NOT_EVALUATED | 0 |
| PARSE_FAILED | 0 |
| EXTRACTION_FAILED | 0 |

The one runtime `FOUND` value was `GT-V2-01-tuition`. It remained separate from
Product Safety: `PRODUCT_SAFE = 0`, with review/provenance blockers retained.

Per field:

| Field | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | CONFLICTING_SOURCES |
|---|---:|---:|---:|---:|
| programme_identity | 0 | 9 | 0 | 0 |
| credential | 0 | 9 | 0 | 0 |
| programme_status | 0 | 7 | 2 | 0 |
| tuition | 1 | 6 | 2 | 0 |
| application_deadline | 0 | 7 | 2 | 0 |
| english_requirement | 0 | 7 | 2 | 0 |
| major_admissions_requirement | 0 | 7 | 0 | 2 |

## 7. Provider and extraction metrics

The smoke used DeepSeek Flash only. No B.AI, Cline, OpenRouter, or alternate
model was used.

```text
logical DeepSeek requests: 70
HTTP request attempts: 70
successful provider responses counted by client: 69
cache hits: 1
extraction event groups completed: 68
terminal extraction-group failures: 3
client failure counter: 5
429 responses: 0
retries: 0
terminal rate-limit failures: 0
max in-flight: 1
prompt tokens: 629,705
completion tokens: 66,153
total tokens: 695,858
cost: unavailable from provider response/configuration
```

The three terminal extraction-group failures were structured-response
validation failures, not balance, authentication, transport, or rate-limit
failures. They were preserved in pipeline diagnostics.

## 8. Remediation 4 false-current audit

All seven audit cases were present in the exact 9-row composition. None emitted
an unsupported concrete runtime value:

| Case | Runtime state | Value present | Product Safe | Result |
|---|---|---:|---:|---|
| GT-V2-01-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-02-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-02-tuition | NEEDS_REVIEW | No | No | PASS |
| GT-V2-15-application_deadline | NEEDS_REVIEW | No | No | PASS |
| GT-V2-15-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-22-english_requirement | NEEDS_REVIEW | No | No | PASS |
| GT-V2-22-major_admissions_requirement | NEEDS_REVIEW | No | No | PASS |

Suppression reasons were field-semantic/applicability/temporal blockers such as
`PROGRAMME_ADMISSION_SCOPE_UNPROVEN`, `TEMPORAL_SCOPE_UNPROVEN`,
`DEADLINE_TYPE_MISMATCH`, `LANGUAGE_FIELD_SEMANTICS_MISMATCH`, and
`APPLICABILITY_EVIDENCE_FIELD_MISMATCH`. Candidate assertions and evidence
references remain in the sealed pipeline artifacts.

## 9. Original six P0 audit

Rows 15 and 22 were in this smoke and remained safely unresolved:

```text
GT-V2-15-credential: NEEDS_REVIEW/null — PASS
GT-V2-22-credential: NEEDS_REVIEW/null — PASS
```

Rows 9, 23, and 27 were not part of the mandated exact 9-row composition, so
their current live behavior was not re-executed in this smoke:

```text
GT-V2-09-programme_identity: not in composition
GT-V2-09-credential: not in composition
GT-V2-23-credential: not in composition
GT-V2-27-credential: not in composition
```

No historical artifact was modified and no absent row was selectively retried.

## 10. Zero-tolerance safety audit

```text
false-current critical: 0
fuzzy-only identity merge: 0
unresolved conflict promoted: 0
SOURCE_NOT_FOUND promoted: 0
STALE_ONLY promoted: 0
prohibited inferred high-volatility critical promoted: 0
PRODUCT_SAFE without durable provenance: 0
```

`PRODUCT_SAFE` total was 0, so Product-Safe evidence entailment is
`UNAVAILABLE`, not a claimed 100% result. There were no Product-Safe records
without provenance.

## 11. Comparison with previous smokes

| Metric | Healthy Remediation 3 | Quota-blocked Remediation 4 | Current live Remediation 4 |
|---|---:|---:|---:|
| Sources fetched | 96 | 82 | 96 |
| Effective non-null assertions | 128 | 0 | 154 |
| FOUND/value | 9 | 0 | 1 |
| NEEDS_REVIEW | 38 | 18 | 52 |
| NOT_EVALUATED | 0 | 0 | 0 |
| PARSE_FAILED | 0 | 0 | 0 |
| EXTRACTION_FAILED | 6 | 45 | 0 |
| False-current | 7 | 0 | 0 |

Relative to the healthy provider smoke, current effective non-null assertions
increased by 26, but `FOUND/value` fell by 8 as Remediation 4 correctly
suppressed unsupported scope/currentness. Relative to the quota-blocked smoke,
DeepSeek produced 154 more effective non-null assertions and the projected
extraction-failure state fell from 45 to 0. The live run therefore verifies the
provider/balance path and safety suppression, but not sufficient useful coverage.

## 12. Validation

```text
focused provider/extraction/remediation tests: 43 passed
full data-ingestion test suite: 334 passed
compileall: PASS
frozen preflight and scorer tests: PASS
current output JSON/schema and JSONL parsing: PASS
frozen truth/roster/contract checksums: PASS
official run #1 output hash: unchanged and matched manifest
official run #2 output hash: unchanged and matched manifest
previous Remediation-4 smoke hashes: unchanged
secret scan: PASS; no secret value in report or changed verification outputs
git diff --check: PASS
```

The first root-level pytest invocations without the repository Python path had
import-collection errors; the required repository invocation with
`PYTHONPATH=services/data-ingestion/src;services/data-ingestion` passed all 334
tests. No source code was changed after the live structured smoke began.

## 13. Readiness and stop state

```text
DeepSeek connectivity: PASS
structured extraction: PASS
balance/authentication: PASS
effective non-null assertions > 0: PASS
EXTRACTION_FAILED materially below 45: PASS
NOT_EVALUATED = 0: PASS
PARSE_FAILED = 0: PASS
Remediation-4 seven-case safety audit: PASS
zero-tolerance safety: PASS
```

The mandatory quality criterion `FOUND/value > 1` was not met (`1`). The
original six P0 cases were also only partially replayed because the mandated
composition contains rows 15 and 22 but not rows 9, 23, or 27.

```text
FULL BENCHMARK RUN #3: BLOCKED
Reason: insufficient useful FOUND coverage (1; required > 1), with partial
live coverage of the original-six audit set.
```

No official benchmark #3, scorer run, selective retry, provider switch, code
remediation, or later Slice F gate was performed.

```text
Slice F: NO-GO
Node: v22.15.0
Node 24.19.x: DEFERRED / UNVERIFIED by user decision
```
