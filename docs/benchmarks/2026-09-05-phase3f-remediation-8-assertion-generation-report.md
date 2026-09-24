# Phase 3F Remediation 8 — Assertion-generation report

Date: 2026-09-05  
Scope: diagnostic only; official benchmark #4 was not run.

## 1. Result

The official run #3 post-seal diagnostic identified the first loss for all 55
direct-support/no-runtime-assertion cases:

| First loss stage | Count |
| --- | ---: |
| `FIELD_NOT_ROUTED` | 47 |
| `EXTRACTOR_NOT_INVOKED` | 8 |
| **Total** | **55** |

The field split was programme identity 25, credential 25, major admissions 3,
application deadline 1, and English requirement 1. The five non-identity
cases were all `EXTRACTOR_NOT_INVOKED` in the sealed diagnostic: three major
admissions cases, one deadline, and one English case.

The root cause was systemic: `programme_identity` and `credential` were absent
from `DEEP_FIELDS` and from the `identity_offering` extraction group. The
extraction trace therefore requested neither field, even where parsed,
official, directly associated evidence existed. The previous projection also
treated `ProgrammeRecord.credential` as the identity value; that is routing /
catalogue metadata and is intentionally `None` for user-supplied benchmark
programme records.

## 2. Stage trace and code-path findings

The sealed run #3 diagnostic records the 55 cases with parsed evidence,
source authority, evidence locator, requested fields, candidate/assertion
flags, and first-loss reason at:

`docs/benchmarks/runs/phase3f-v2-run-20260905T030109Z/run3-assertion-generation-diagnostic.jsonl`

Representative traces were checked for ten programme-identity cases, ten
credential cases, and the remaining five cases. The identity cases were
`GT-V2-01`, `02`, `03`, `05`, `11`, `12`, `13`, `14`, `16`, and `17`;
the credential cases were `GT-V2-01`, `02`, `03`, `04`, `05`, `10`, `11`,
`12`, `13`, and `14`. All were omitted from the requested field set and
consequently had no candidate or assertion. The remaining five cases were
`GT-V2-06-major_admissions_requirement`,
`GT-V2-26-major_admissions_requirement`,
`GT-V2-27-application_deadline`, `GT-V2-27-english_requirement`, and
`GT-V2-27-major_admissions_requirement`; their first-loss stage was
`EXTRACTOR_NOT_INVOKED`.

The failure chain was:

```text
parsed evidence
  -> field not in extraction group / no field route
  -> extractor did not request the field
  -> no candidate object
  -> assertion builder had no input
  -> selector could not see an assertion
```

The new smoke trace confirms the corrected chain. Its `extraction_trace.jsonl`
requests both identity fields, and the post-assertion traces contain non-null
facts and created assertions. There was no candidate-to-assertion drop in the
new smoke (`0`); no serialization or persistence loss was observed for the
new identity/credential path.

### Programme identity

`programme_identity` is now routed as a factual field. A source-backed title
can produce a candidate and assertion; routing identity remains separate from
the factual claim. The projection no longer copies the roster/programme
metadata label as factual evidence. The prompt also requires an explicit
source-backed title and rejects URL/name-only inference.

### Credential

`credential` is now routed as a source-native factual field. Native labels are
preserved in the assertion before optional normalization. Uncertain
normalization or unknown currentness remains reviewable rather than being
converted to an unsupported canonical value. A minimal post-smoke guard also
keeps an undated/unknown-current native credential at `NEEDS_REVIEW/null`;
the candidate and provenance remain retained.

### Remaining five fields

The remaining five cases were not caused by a separate acceptance rule. Their
sealed traces did not invoke the applicable extraction field path. The common
extraction/assertion path remains unchanged; the new diagnostic metrics now
make such omissions visible by field.

### Circular dependencies and qualification profile

No runtime cycle requiring a completed factual identity or qualification
profile before creating a source-backed assertion was found. Assertion
creation is now demonstrably separate from runtime acceptance, Product Safety,
and canonical promotion. Qualification/profile metadata is contextual input;
it is not required to preserve a raw identity or credential assertion.

## 3. Exact implementation changes

Files changed for Remediation 8:

- `services/data-ingestion/src/glowbal_ingestion/models.py`: added identity and
  credential to `DEEP_FIELDS` and `EXTRACTION_FIELD_GROUPS["identity_offering"]`.
- `services/data-ingestion/src/glowbal_ingestion/deepseek.py`: added identity
  group source priority and source-backed identity/credential extraction
  instructions; schema and provider remained DeepSeek Flash.
- `scripts/run_phase3f_v3_benchmark.py`: factual identity and credential now
  come only from source-backed assertions; routing metadata does not bootstrap
  benchmark facts.
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py`: added
  development counters for field candidates, runtime assertions, and
  candidate-to-assertion drops.
- `services/data-ingestion/src/glowbal_ingestion/runtime_acceptance.py`:
  unknown-current credentials are not projected as runtime `FOUND`.
- `scripts/audit_phase3f_assertion_generation.py`: added the post-seal 55-case
  first-loss diagnostic and summary.
- `services/data-ingestion/tests/test_remediation7_acceptance.py` and
  `services/data-ingestion/tests/test_remediation8_assertion_generation.py`:
  added routing, provenance, serialization/projection, native credential, and
  safety regression coverage.

No truth, roster, scorer, scorer contract, threshold, or official benchmark
artifact was changed.

## 4. Tests

Initial focused Remediation 8 / related tests: **25 passed** after the final
safety guard; the final selected run below includes the added routing test.
  
Selected benchmark, acceptance, provider, discovery, and source tests:
**110 passed**.  
Full ingestion suite: **354 passed in 7.77s**.

The final validation also includes the unchanged benchmark-scorer tests in
the full suite. Compile, JSON/JSONL validation, secret scan, checksum
validation, and `git diff --check` are reported below after the smoke.

## 5. New diagnostic smoke

Run ID:

`phase3f-remediation8-assertion-generation-12prog-20260905T152500Z`

This is a new diagnostic run and is not official benchmark #4.

| Metric | Result |
| --- | ---: |
| Programmes attempted / terminal | 12 / 12 |
| Sources fetched | 131 |
| Pipeline assertion rows | 582 |
| Pipeline non-null assertion metric | 227 |
| Effective assertion rows | 402 |
| Effective non-null values | 224 |
| Field candidates created | 219 |
| Runtime assertions created | 582 |
| Candidate-to-assertion drops | 0 |
| Deep programmes attempted / extracted | 12 / 9 |
| Pipeline errors | 19 |

Critical-field candidate and runtime-assertion counters:

| Field | Candidates (including components) | Runtime assertions (including components) |
| --- | ---: | ---: |
| `programme_identity` | 9 | 12 |
| `credential` | 9 | 12 |
| `programme_status` | 6 | 18 |
| `tuition` | 12 | 22 |
| `application_deadline` | 11 | 54 |
| `english_requirement` | 1 | 58 |
| `major_admissions_requirement` | 30 | 114 |

The identity and credential paths therefore produced non-null source-backed
candidates for nine reachable programmes each; the 12 assertion rows include
the normal runtime/inherited assertion collection.

### Projection distribution

| Runtime state | Count |
| --- | ---: |
| `FOUND` / value | 12 |
| `NEEDS_REVIEW` / null | 49 |
| `CONFLICTING_SOURCES` | 2 |
| `ACCESS_BLOCKED` | 21 |
| `NOT_EVALUATED` | 0 |
| `PARSE_FAILED` | 0 |
| `EXTRACTION_FAILED` | 0 |

The 12 `FOUND` values span three field families: programme identity (9),
tuition (2), and major admissions requirement (1). Credential assertions are
present but are conservatively suppressed by the unknown-currentness guard in
this local-raw diagnostic run. `PRODUCT_SAFE` is 0; every output record is
`REVIEWABLE`, and local raw persistence is not sufficient for Product Safety.

The one provider group failure was a structured-document validation error
(`facts[4].value.document_type is invalid`), not an HTTP/provider transport
failure. It did not produce a `PARSE_FAILED` or `NOT_EVALUATED` projection.

## 6. Provider and safety metrics

Locked configuration remained:

```text
provider = deepseek
base URL = https://api.deepseek.com
model = deepseek-v4-flash
reasoning = none
```

Provider metrics from the sealed pipeline report:

| Metric | Result |
| --- | ---: |
| Logical requests | 97 |
| Responses / calls | 97 / 97 |
| HTTP 429 | 0 |
| Retries | 0 |
| Terminal rate-limit failures | 0 |
| Prompt tokens | 787,863 |
| Completion tokens | 108,182 |
| Total reported tokens | 896,045 |
| Cost | unavailable |

Zero-tolerance audit on the new sealed diagnostic smoke:

| Counter | Result |
| --- | ---: |
| False-current critical | 0 |
| Fuzzy-only identity merge | 0 |
| Unresolved conflict promoted | 0 |
| `SOURCE_NOT_FOUND` promoted | 0 |
| `STALE_ONLY` promoted | 0 |
| Prohibited inferred high-volatility promotion | 0 |
| `PRODUCT_SAFE` without durable provenance | 0 |

## 7. Regression sets

All seven Remediation-4 false-current cases present in this composition are
safe after the final credential guard:

| Case | Runtime result | Safety result |
| --- | --- | --- |
| `GT-V2-01-major_admissions_requirement` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-02-major_admissions_requirement` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-02-tuition` | `CONFLICTING_SOURCES`, null | PASS |
| `GT-V2-15-application_deadline` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-15-major_admissions_requirement` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-22-english_requirement` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-22-major_admissions_requirement` | `NEEDS_REVIEW`, null | PASS |

The two original P0 cases present in this 12-row composition now remain safe:

| Case | Runtime result | Safety result |
| --- | --- | --- |
| `GT-V2-15-credential` | `NEEDS_REVIEW`, null | PASS |
| `GT-V2-22-credential` | `NEEDS_REVIEW`, null | PASS |

`GT-V2-09-programme_identity`, `GT-V2-09-credential`,
`GT-V2-23-credential`, and `GT-V2-27-credential` are absent from the fixed
12-row diagnostic composition; their replay/unit regression coverage was not
expanded into this smoke.

## 8. Direct-support recheck and readiness

The before state was 55 direct-support cases with no runtime assertion in
official run #3. In the new fixed 12-row composition, 19 of those diagnostic
case IDs were represented; 14 had assertion references in the sealed
projection and five remained blocked/without references. The recovered
identity/credential subset was 14 of 17 represented missing cases. This proves
the generic path works, but it does not establish recovery for a majority of
the full benchmark-wide set of 50 identity/credential cases without an
official rerun.

The fixed smoke meets the diagnostic shape target (`FOUND=12`, spanning three
field families), and the identity/credential assertion-generation path is
working. It is not sufficient to mark official benchmark #4 ready because the
required benchmark-wide majority recovery condition has not been established
and the smoke still has three blocked programme rows plus one terminal
structured extraction group failure.

**FULL BENCHMARK RUN #4: BLOCKED** — remaining blocker is full-set
assertion-generation revalidation, not a permission to run benchmark #4 in
this task. No official benchmark #4 was run.

## 9. Integrity and files

New sealed smoke artifacts:

- [run manifest](runs/phase3f-remediation8-assertion-generation-12prog-20260905T152500Z/run-manifest.json)
- [sealed pipeline output](runs/phase3f-remediation8-assertion-generation-12prog-20260905T152500Z/pipeline-output.json)
- [pipeline errors](runs/phase3f-remediation8-assertion-generation-12prog-20260905T152500Z/pipeline-run/crawl_errors.jsonl)
- [extraction trace](runs/phase3f-remediation8-assertion-generation-12prog-20260905T152500Z/pipeline-run/extraction_trace.jsonl)
- [effective assertions](runs/phase3f-remediation8-assertion-generation-12prog-20260905T152500Z/pipeline-run/effective_field_assertions.jsonl)

Pipeline output SHA-256:

`50515a089ebb174e0acc0106807194446c4244b232b68bfa32d52585d8b533b4`

The new smoke manifest records the frozen input digests. Recomputed values
remain unchanged:

```text
truth       97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4
roster      7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139
contract md 47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91
machine     720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99
```

Official run #1, run #2, run #3, and prior Remediation 7 smoke artifacts were
hash-checked and unchanged. The official run #3 output remains:

`ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad92f39af1a90a8c`

No API key or authorization material was written to source, diagnostics,
smoke output, or this report. `git diff --check` passed. Node remains
`v22.15.0`; Node 24.19.x is **DEFERRED / UNVERIFIED by user decision**.

## 10. Final status

```text
Remediation 8 assertion-generation smoke: PASS (diagnostic targets)
Safety regression audit: PASS (all seven counters = 0)
Official benchmark #4: NOT RUN
FULL BENCHMARK RUN #4: BLOCKED pending full-set revalidation
Slice F: NO-GO
```
