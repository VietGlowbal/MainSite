# Phase 3F Quality Remediation 3

Date: 2026-09-03  
Scope: state lifecycle, safe-unresolved semantics, acquisition fallback, and
provider throttling  
Official benchmark #3: NOT RUN  
Slice F: NO-GO

## Decision

The working tree now contains the targeted lifecycle and provider-orchestration
repairs. Unit and ingestion tests pass, frozen artifacts remain byte-identical,
and a nine-roster-row diagnostic smoke sealed successfully. The smoke could not
exercise DeepSeek because the B.AI account returned HTTP 400
`insufficient_user_quota` with balance zero. A deterministic-only smoke was run
instead to validate acquisition, parsing, terminal-state projection, and
isolation without spending credits.

`FULL BENCHMARK RUN #3 BLOCKED`: a post-change live structured-extraction smoke
and live post-throttling 429 measurement are unavailable until provider credit
is restored. No official benchmark or later Slice F gate was run.

## 1. State-lifecycle root causes

There were three separate causes rather than one universal extraction defect:

1. The benchmark projection left fields as `NOT_EVALUATED` when a routed
   programme had no field assertion, even when a valid parsed source existed.
   Missing programme records also defaulted to `NOT_EVALUATED` after a terminal
   fetch error.
2. `_missing_field_reason` used `PARSE_FAILED` for fields belonging to a failed
   extraction group. The parser had already returned usable text; the failure
   was provider/extraction failure.
3. The pipeline had no generic primary-source fallback after a robots-blocked
   manual target. The configured official source bundle was therefore not used
   to preserve a routed programme record.

The 78 effective non-null assertion result from Remediation 2 was also
interpreted too broadly. The 78 values included many non-critical fields which
are not one of the seven benchmark projection slots. Only three eligible
non-null assertions belonged to the projected composite critical slots; they
produced one `FOUND` field slot. The remaining assertion-level decomposition is
recorded below.

## 2. `NOT_EVALUATED` decomposition

In official run #2, the scorer taxonomy contained 93 `DISCOVERY` cases that
were field-level consequences of missing programme/source coverage, not 93
independent crawler failures:

| projected field | cases |
| --- | ---: |
| `programme_status` | 19 |
| `application_deadline` | 19 |
| `english_requirement` | 19 |
| `tuition` | 18 |
| `major_admissions_requirement` | 18 |
| Total | 93 |

In the six-programme Remediation 2 smoke, the 15 projected
`NOT_EVALUATED` records were three each for those five fields. They were
caused by missing field assertions after blocked/missing programme frontiers,
not by an intentional semantic abstention.

The new projection behavior is:

- a terminal runtime error with no field assertion maps to its operational
  state (`ACCESS_BLOCKED`, `SOURCE_NOT_FOUND`, `FETCH_FAILED`,
  `PARSE_FAILED`, or `EXTRACTION_FAILED`);
- a valid parsed source with no value/assertion leaves `NOT_EVALUATED` and is
  represented as `NEEDS_REVIEW` because field evaluation has reached a semantic
  unresolved frontier;
- a field with neither an assertion, an admitted parsed source, nor a runtime
  failure remains `NOT_EVALUATED`.

The nine-row deterministic smoke produced zero `NOT_EVALUATED` records: 45
fields were `EXTRACTION_FAILED` because the provider was intentionally disabled,
and 18 identity/credential fields were `NEEDS_REVIEW`.

## 3. `PARSE_FAILED` decomposition

The five Remediation 2 smoke records previously labelled `PARSE_FAILED` were:

| case | finding |
| --- | --- |
| `GT-V2-01-english_requirement` | MIT sources had non-empty parsed output; language/academic extraction groups failed at HTTP 429. |
| `GT-V2-01-major_admissions_requirement` | MIT sources had non-empty parsed output; academic extraction group failed at HTTP 429. |
| `GT-V2-22-english_requirement` | Universite de Montreal sources had non-empty parsed output; language extraction failed and another response was empty. |
| `GT-V2-22-major_admissions_requirement` | Universite de Montreal sources had non-empty parsed output; academic extraction failed at HTTP 429. |
| `GT-V2-28-tuition` | ETH Zurich sources had non-empty parsed output; finance extraction failed at HTTP 429. |

The 17 official run #2 `PARSING` taxonomy cases were similarly distributed as
English 9, tuition 5, and admissions 3. All 287 fetched run #2 source records
had non-empty parser output. This was incorrect state propagation, not an
empty-parser result.

The parser boundary now converts only a genuine `ParserError` into
`PARSE_FAILED`. Failed extraction groups produce `EXTRACTION_FAILED` null
assertions. Empty or invalid provider responses remain provider/extraction
failures and are not relabelled as parser failures.

## 4. Remediation 2 assertion-to-final-state decomposition

The 78 non-null effective assertions were classified against the unchanged
projection rules and the sealed Remediation 2 artifacts:

| assertion-level outcome | count | explanation |
| --- | ---: | --- |
| eligible and selected into projected critical slots | 3 | These three admissions assertions form one composite `FOUND` benchmark slot. |
| eligible but outside the seven benchmark projection slots | 58 | Curriculum, career, programme-focus, learning-outcome, and other supported fields remain auditable in pipeline artifacts. |
| source-excerpt fallback suppressed | 10 | `SOURCE_EXCERPT_ONLY` or the retired excerpt model; not a field-safe assertion. |
| target-cycle mismatch | 5 | The assertion years did not match the roster target cycle. |
| audience mismatch | 2 | The assertion audience did not match the target audience. |
| Total | 78 | |

The 10 selected non-null references visible in the old projection included the
three eligible admissions assertions plus seven audit candidates that were
correctly retained for diagnosis but blocked from runtime value projection by
excerpt or cycle policy. This is why the old smoke showed one projected
`FOUND/value` slot rather than ten.

## 5. Remaining 98 safe-unresolved cases

The 124 confirmed `NEEDS_REVIEW/null` cases in run #2 had 26 correct and 98
remaining. The sealed runtime behavior decomposes those 98 as:

| runtime cause | cases | policy |
| --- | ---: | --- |
| operational discovery/coverage loss represented as `NOT_EVALUATED` | 63 | Preserve operational/coverage diagnosis; do not turn it into a semantic pass. |
| `NOT_PUBLISHED`/unsafe value quality-policy outcome | 25 | Use `NEEDS_REVIEW/null` only when semantic uncertainty is established; retain the quality blocker. |
| field-level parser/extraction failure | 10 | Preserve `PARSE_FAILED` only for genuine parser failure and use `EXTRACTION_FAILED` for provider/group failure. |

The implementation does not map all 98 to `NEEDS_REVIEW`; transport, access,
and parser failures remain operational states.

## 6. Lifecycle transition changes

Changed paths:

- `scripts/run_phase3f_v3_benchmark.py::_runtime_state_from_errors` now maps
  terminal runtime error codes, including provider/rate-limit/schema failures,
  to explicit operational states when no assertion exists.
- `scripts/run_phase3f_v3_benchmark.py::_project_output` records lifecycle
  diagnostics and converts a valid parsed-source frontier with no value from
  `NOT_EVALUATED` to `NEEDS_REVIEW`.
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py::_parse_document`
  is the single parser-failure boundary.
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py::_missing_field_reason`
  distinguishes failed extraction groups from parser failure.
- `lifecycle` and `projection_trace` retain source count, parser status,
  candidate counts, evaluation attempt, skip reason, coverage state, blocker
  list, selection reason, and projected value presence without raw bodies.

## 7. Assertion-selection findings

Selection remains deterministic and policy-ordered. It uses value presence,
validation status, evidence/raw lineage, cycle, audience, applicability,
temporal state, scope, source authority, verification status, and field-aware
quality ranking. It does not use a simple highest-confidence rule.

The Remediation 2 artifact showed 78 effective values, 10 non-null selected
references in the old projection, and only three selected values eligible for
the seven critical output slots. No assertion was discarded due to factual
programme identity being unresolved when routing identity was known.

## 8. Identity routing regression

Routing identity remains distinct from the factual `programme_identity` claim.
The runtime may route documents to a roster programme by the configured target
URL while leaving factual credential/identity unresolved. The roster credential
is not copied into programme metadata and is not used as extraction evidence.

The regression tests cover empty roster metadata, routing with a robots-blocked
target, supported non-null projection with factual identity unresolved, and
the rule that other fields may evaluate independently.

## 9. Programme-status findings

Run #2's 17 incorrect/unsafe-unresolved status cases and 19 coverage losses
remain a quality cluster. The runtime does not infer `ACTIVE` from page
existence, catalogue presence, or a resolving URL. A concrete status requires
source-backed lifecycle language. Otherwise the field remains unresolved or
operationally failed according to the actual frontier.

The lifecycle tests include a supported status candidate that projects
`FOUND/value` while Product Safety remains blocked, and an unresolved parsed
frontier that projects `NEEDS_REVIEW/null`.

## 10. Deadline-applicability findings

Run #2 had seven incorrect/unsafe-unresolved deadline cases, seven safe
unresolved cases, and 22 coverage losses. The projection continues to require
application-deadline semantics rather than registration, priority, exam, or
generic institution dates. Cycle/intake, audience, deadline type, and
programme applicability remain explicit comparison dimensions. A date without
those semantics cannot become a current resolved deadline.

## 11. Harvard acquisition findings

The nine-row diagnostic included Harvard rows 4 and 6. Both configured
`handbook.college.harvard.edu` targets were rejected by robots policy. The
pipeline did not bypass robots. It used the generic configured official source
bundle as a fallback and fetched six source records per routed programme,
representing five canonical allowed `college.harvard.edu` URLs after redirect
normalization. The sources included admissions, financial aid, international
applicant, and official FAQ pages.

The fallback is implemented for any routed programme and configured official
source bundle; it is not keyed to Harvard, row numbers, case IDs, or expected
truth values. The two targets reached terminal routed programme records in the
diagnostic smoke. The original primary-target rejection remains visible as
`BLOCKED_BY_ROBOTS`.

## 12. Tokyo acquisition findings

The diagnostic included Tokyo rows 25 and 26. The row-26 `i-web2.i.u-tokyo.ac.jp`
target was blocked by robots policy. The generic configured official bundle
used the allowed `www.i.u-tokyo.ac.jp` source family, including English pages
and PDF admission guides. Ten source records per routed Tokyo programme were
fetched in the smoke; the primary block remained in `crawl_errors.jsonl`.

The source graph records `configured_primary_fallback`, configured source, and
programme-related relationships. No benchmark-specific URL branch was added.

## 13. Robots limitations

Robots policy remains fail-closed. The diagnostic smoke recorded seven robots
errors: three primary/deep target blocks and four configured-source blocks.
Alternate allowed official sources were used only when admitted by the same
robots and domain policy. No unapproved bypass, manual fetch, or stronger
renderer was used.

## 14. Provider 429 root cause

Run #2 recorded 71 logical calls, 258 provider failure attempts, 11 provider
failure traces, and 50 terminal group failures. The dominant extraction-group
failures were HTTP 429 responses. Retrying each logical field-group request
without a shared bounded transport gate amplified rate limiting.

The current provider adapter remains:

```text
provider: openai_compatible
endpoint class: https://api.b.ai/v1
model: deepseek-v4-flash
```

The adapter now has a bounded semaphore (default concurrency 1), a bounded
retry budget, `Retry-After` parsing for seconds and HTTP dates, exponential
backoff with jitter when no header is supplied, and separate rate-limit,
transport, and response retry counters. Permanent errors such as HTTP 400
`insufficient_user_quota` are not retried. Pipeline error records preserve the
actual retryability flag.

The post-change live attempt was stopped because B.AI returned
`insufficient_user_quota` with account balance zero. Therefore live post-change
429 recovery is not claimed as measured; mocked 429 tests demonstrate bounded
retry and `Retry-After` behavior.

## 15. Retry/concurrency changes

Configurable environment variables are:

```text
OPENAI_COMPATIBLE_MAX_CONCURRENCY
OPENAI_COMPATIBLE_MAX_RETRIES
OPENAI_COMPATIBLE_BACKOFF_BASE
OPENAI_COMPATIBLE_BACKOFF_MAX
OPENAI_COMPATIBLE_BACKOFF_JITTER
```

The provider does not retry schema-invalid responses as transport failures,
does not retry permanent quota/auth/configuration failures, and stops after the
configured retry budget. Tests cover 429 with and without `Retry-After`, 429
recovery, repeated 429 exhaustion, 5xx/timeout retryability, and no retry for
quota 400.

## 16. Files changed

Remediation 3 changes in this working tree are concentrated in:

```text
scripts/run_phase3f_v3_benchmark.py
services/data-ingestion/src/glowbal_ingestion/models.py
services/data-ingestion/src/glowbal_ingestion/pipeline.py
services/data-ingestion/src/glowbal_ingestion/deepseek.py
services/data-ingestion/src/glowbal_ingestion/extraction_provider.py
services/data-ingestion/tests/test_remediation_smoke.py
services/data-ingestion/tests/test_extraction_provider.py
docs/current-status.md
docs/benchmarks/2026-09-03-phase-3f-remediation-3-report.md
```

Other pre-existing dirty-worktree files were preserved. Frozen truth, roster,
freeze manifest, scorer contract, scorer, official run #1, and official run #2
were not modified.

## 17. Tests added

Focused regression coverage now includes:

- parsed source plus no value leaves `NOT_EVALUATED` only when evaluation truly
  did not run, and otherwise projects safe semantic unresolved;
- provider/group failure is `EXTRACTION_FAILED`, not `PARSE_FAILED`;
- terminal robots failure is `ACCESS_BLOCKED` rather than `NOT_EVALUATED`;
- provider rate-limit retry honors `Retry-After` and stops at budget;
- permanent quota 400 is not retried;
- provider error retryability is preserved in pipeline diagnostics;
- runtime rate-limit errors map to extraction failure when no assertion exists;
- supported values can remain runtime `FOUND` while Product Safety is blocked.

## 18. Test results

Measured results:

| check | result |
| --- | --- |
| Remediation provider + lifecycle tests | **32 passed** |
| Full data-ingestion test suite | **323 passed** |
| Frozen benchmark preflight | **PASS**; truth 252, scoreable 246, ambiguous 6, unreviewed 0 |
| Scorer tests from preflight | **PASS** |
| `compileall` | **PASS** |
| JSON/schema load of run #1, run #2, and diagnostic output | **PASS** |
| checksum verification | **PASS** |
| secret-pattern scan | **PASS** after report creation |
| `git diff --check` | **PASS**; only existing CRLF conversion warnings |

## 19. Nine-programme smoke composition

Diagnostic-only rows:

```text
1, 2, 4, 6, 15, 22, 25, 26, 28
```

This covers ordinary HTML, PDF, multilingual, identity-sensitive, Harvard
robots/fallback, Tokyo robots/fallback, and complex official-source bundles.
It spans six institutions and is not an official benchmark or replacement for
run #2.

The first live attempt for these rows was unsealed and aborted after the B.AI
quota error. A second deterministic-only run was sealed:

```text
phase3f-v2-run-20260903T095720Z
```

## 20. Sources discovered and fetched

The sealed deterministic-only smoke reported:

| measure | count |
| --- | ---: |
| roster programme candidates/routed rows | 9 |
| fetched/admitted source records | 78 |
| unique canonical source URLs | 60 |
| HTTP 200 source records | 78 |
| HTML source records | 71 |
| PDF source records | 7 |
| parser outputs with non-empty text | 78 |

The legacy acquisition backend reports source records rather than the newer
candidate-admission counters; its explicit generated/admitted counters were
zero while the source records and URL graph prove the accepted fetch path.

## 21. Effective non-null assertions

The deterministic-only nine-row smoke had 324 field assertions, all null, and
therefore zero effective non-null assertions. This is expected for a smoke run
with the provider deliberately disabled after the live quota blocker; it is not
a claim that the provider path is functionally validated after the final patch.

The prior Remediation 2 DeepSeek smoke remains the last successful live
extraction artifact: 78 effective non-null assertions across six rows.

## 22. Projected `FOUND/value`

The nine-row deterministic-only output projected:

```text
FOUND/value: 0
```

This fails the Remediation 3 smoke success criterion `FOUND/value > 1`, because
the provider was unavailable and the selected sources did not yield
deterministic facts for these target fields.

## 23. Projected `NEEDS_REVIEW`

```text
NEEDS_REVIEW/null: 18
```

These were the programme identity and credential slots for nine routed
programmes whose factual identity was not bootstrapped from roster metadata.

## 24. Projected `NOT_EVALUATED`

```text
NOT_EVALUATED: 0
```

Terminal provider failures were mapped to `EXTRACTION_FAILED`; routed semantic
identity uncertainty was `NEEDS_REVIEW`.

## 25. Projected `PARSE_FAILED`

```text
PARSE_FAILED: 0
```

All 78 smoke sources had a non-empty parsed output. No parser failure was
observed in this smoke.

## 26. Projected `EXTRACTION_FAILED`

```text
EXTRACTION_FAILED/null: 45
```

There were nine extraction-provider attempts against an intentionally
unconfigured provider and no HTTP calls. The state is operational extraction
failure, not parser failure or semantic success.

## 27. Provider calls, retries, and 429s

For the deterministic-only smoke:

```text
logical pipeline extraction attempts: 9
actual provider HTTP calls: 0
successful calls: 0
429 responses: 0
retries: 0
terminal provider-unavailable errors: 9
```

The live attempt before fallback to deterministic-only was blocked by B.AI
HTTP 400 `insufficient_user_quota` and was not sealed. Run #2's measured
pre-remediation provider counters remain 71 logical calls, 258 failure
attempts, 11 provider failure traces, and 50 terminal group failures. Mocked
post-change tests pass; live post-change 429 recovery remains unverified until
credit is available.

## 28. Product Safe count

```text
PRODUCT_SAFE: 0
deterministic entailment passes: 0
semantic review required: 0
failed entailment: 0
```

No Product Safe candidate existed in the deterministic-only smoke. The zero
entailment result is unavailable rather than a 100% claim.

## 29. Zero-tolerance counters

All counters were zero in the diagnostic output:

```text
false-current critical: 0
fuzzy-only identity merge: 0
unresolved conflict promoted: 0
SOURCE_NOT_FOUND promoted: 0
STALE_ONLY promoted: 0
prohibited high-volatility inferred critical promotion: 0
PRODUCT_SAFE without durable provenance: 0
```

No runtime value was produced, so this is a safety-preservation result, not a
positive factual-quality result.

## 30. Secret scan

The provider key is read only from the local environment. No key, bearer token,
or credential-shaped literal was found in the remediation code/tests/report
scan. Provider error diagnostics retain only status/code and bounded messages;
they do not print authorization headers.

## 31. Frozen and run integrity

Frozen input checksums remain:

```text
truth:           97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4
roster:          7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139
contract MD:     47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91
machine contract:720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99
```

Sealed official output hashes remain:

```text
run #1: d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc
run #2: d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df
```

Diagnostic smoke output:

```text
docs/benchmarks/remediation-smokes/phase3f-v2-run-20260903T095720Z/pipeline-output.json
sha256: c04d63475568e6fd570e1daf9f5603859ff61c35958237e94e8bd83c309da760
```

The diagnostic run manifest records `pipeline_truth_access: false`,
`scorer_invoked: false`, the frozen input digests, Node 22.15.0, and a dirty
worktree. The aborted live diagnostic directory
`phase3f-v2-run-20260903T095226Z` has no sealed pipeline output and was not
scored.

## 32. `git diff --check`

**PASS.** Git emitted only pre-existing working-tree line-ending conversion
warnings; no whitespace errors were reported.

## 33. Remaining P1 systemic clusters

- Provider credit availability and live post-change 429 behavior remain
  unverified.
- Multiple supported DeepSeek values must be observed surviving to projected
  `FOUND/value` after the final lifecycle changes.
- The official 36-programme discovery floor still needs a future benchmark
  measurement; robots restrictions remain legitimate external blockers even
  though generic alternate-source fallback now reaches routed records.
- Programme status, deadline applicability, and long-tail field coverage need
  a provider-enabled smoke before their quality impact can be measured again.
- Source records in the legacy acquisition backend do not emit the newer
  candidate-admission counters; this is an observability gap, not a source
  answer repair.

## 34. Full benchmark run #3 readiness

```text
FULL BENCHMARK RUN #3: BLOCKED
```

Exact blockers:

1. B.AI returned HTTP 400 `insufficient_user_quota` with balance zero, so a
   live structured-extraction smoke after the final changes could not run.
2. The available nine-row smoke produced zero non-null assertions and zero
   projected `FOUND/value` fields because the provider was disabled.
3. Live post-change 429 reduction and recovery are therefore not measured,
   although bounded mocked tests pass.

Lifecycle and robots-fallback tests pass, and all frozen/run integrity checks
pass. Restore provider credit and run a new diagnostic smoke first; do not
reuse the unsealed quota-aborted directory and do not run official benchmark
#3 until the live readiness criteria are rechecked.

## 35. Slice F status

```text
Human Review: PASS
Ground-Truth Freeze: PASS
Scorer Contract: PASS
Scorer Preflight: PASS
Official benchmark #1: FAIL - SAFETY (sealed)
Official benchmark #2: FAIL - QUALITY (sealed)
Remediation 3: COMPLETE (targeted code/tests; live provider smoke blocked)
Official benchmark #3: BLOCKED
Slice F: NO-GO
```

No Remediation 4, official benchmark #3, runtime failure matrix, schema/RLS
gate, final regression, OpenCode review, or rollout was run.
