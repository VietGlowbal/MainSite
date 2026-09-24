# Phase 3F Remediation 11 - programme-status safety report

Status: **COMPLETE**. This remediation changes the generic programme-status
acceptance policy only. Benchmark V3 and sealed Official Run #6 were not
modified. Benchmark #7 was not run.

## 1. Sealed Run #6 verification

| Item | Result |
|---|---|
| Run ID | `phase3f-v3-run-20260908T040003Z` |
| Execution commit | `38dad5b0e30f7bffff75f6eec9fc2a87c484c484` |
| Sealed output SHA-256 | `b0bacb90c6c4b315cdf9bc710bdb69ac4349b204b754d6265a6809c1a0251b62` |
| Run #6 mutation check | PASS; the sealed file remains byte-identical |
| Run #1-#5 integrity | PASS; hashes are listed in section 11 |

The validated execution checkout was the clean Run #6 checkout supplied for
the benchmark. The development worktree contains pre-existing unrelated
changes and was not used as an official benchmark checkout.

## 2. GT-V2-24 source and evidence trace

| Trace point | Observed value |
|---|---|
| Case | `GT-V2-24-programme_status` |
| Institution | Universite de Montreal |
| Target programme | DESS en apprentissage automatique |
| Source | `https://admission.umontreal.ca/programmes/dess-en-apprentissage-automatique/` |
| Authority | Official UdeM Admission programme page; direct official relationship |
| Source fetch | `2026-09-08T04:19:11Z` |
| Assertion retrieval | `2026-09-08T04:22:24Z` |
| Published/valid dates | None in the source record |
| Target cycle | `2026-27`; assertion cycle `2026-2027` |
| Intake | `aout 2027`; this did not establish current status |
| Source-native evidence | `Dates limites — Déposer la demande d'admission — Du 1er août 2026 au 1er février 2027` |
| LLM candidate | `accepting_applications` |
| Structured candidate | `accepting_applications` |
| Assertion | `3a0dfc00-0e68-56a3-93ed-825fb7eeac32` |
| Scope/audience | `programme` / `all`; target audience `French + international` |
| Temporal/applicability state | `UNKNOWN` / `UNKNOWN` |
| Provenance | Raw document `7c3ab439-7816-42bd-a8c3-b7b97dc486b2`; official direct source |
| Assertion construction | `identity_offering` effective assertion |
| Assertion selection | `policy_ranked_supported_candidate` |
| Acceptance before Remediation 11 | No acceptance reasons; accepted for runtime |
| Projection before Remediation 11 | `FOUND=accepting_applications` |
| Frozen V3 truth | `NEEDS_REVIEW`, no value |

The page and deadline text are valid evidence candidates, but the persisted
evidence does not explicitly say that applications are currently open for the
target programme, audience, and cycle. The frozen truth also says that page
presence and a current listing are not formal lifecycle evidence.

## 3. First incorrect stage

The first incorrect stage was **ACCEPTANCE**. Extraction created a candidate
from deadline text. The prior acceptance rule let a matching cycle satisfy
currentness and let `scope=programme` satisfy applicability. Projection then
exposed the accepted candidate as `FOUND`.

## 4. Status invariant and guards

`accepting_applications` now requires all of the following before runtime
`FOUND`:

1. Explicit application-open evidence such as `currently accepting
   applications`, `applications are currently open`, `open for applications`,
   or `apply now`.
2. Assertion cycle metadata and matching target-cycle evidence.
3. Explicit programme applicability with `APPLICABLE` or `UNIVERSAL` state.
4. Compatible admissions-audience applicability.

Programme existence, a live page, an admissions page, a generic application
portal, a deadline, a future deadline, or a previous cycle cannot independently
produce current accepting status. Missing proof returns `NEEDS_REVIEW`.

The temporal guard runs before the generic target-cycle fallback, so a date-only
deadline cannot satisfy the status field. Historical, future, and estimated
cycle states remain blocked. Status diagnostics now persist the candidate,
temporal evidence, cycle, intake, window dates, applicability, acceptance
reason, and rejection reasons without loading benchmark truth into runtime.

The validation layer also preserves `accepting_applications` as a distinct
canonical status rather than collapsing it into `active`. No case ID,
institution name, programme name, or benchmark truth is referenced by the
production guard.

## 5. Production changes and tests

Changed production files:

- `services/data-ingestion/src/glowbal_ingestion/runtime_acceptance.py` - added
  generic status candidate extraction, current-open evidence, cycle, audience,
  programme-applicability guards, and status acceptance diagnostics.
- `services/data-ingestion/src/glowbal_ingestion/validation.py` - added explicit
  accepting-status evidence validation and distinct status normalization.
- `scripts/run_phase3f_v3_benchmark.py` - records status acceptance diagnostics
  in candidate lifecycle output.

Added diagnostics and tests:

- `services/data-ingestion/tests/test_remediation11_programme_status.py`
  contains 11 tests covering live page only, old cycle, future deadline,
  generic portal, missing cycle, unknown applicability, positive current-cycle
  open-window evidence, status diagnostics, active-status regression, and
  status normalization.
- `scripts/replay_phase3f_remediation11.py` performs the sealed-evidence
  replay and frozen post-seal scoring.
- `scripts/evaluate_phase3f_remediation11_smoke.py` scores the bounded live
  smoke population after sealing.

## 6. Offline replay

Replay artifact directory:
`docs/benchmarks/runs/phase3f-remediation11-offline-replay-20260908T082100Z/`

| Metric | Result |
|---|---:|
| Programme-status cases replayed | 36/36 |
| Provider calls | 0 |
| Refetches | 0 |
| New URLs | 0 |
| Replay output SHA-256 | `1578584c85e675ff9c42cd0c5701e5c31a25f26828fd02c05b35d6d7dae53901` |
| Status `FOUND` | 0 |
| Status `NEEDS_REVIEW` | 24 |
| Status `ACCESS_BLOCKED` | 7 |
| Status `SOURCE_NOT_FOUND` | 1 |
| Status `EXTRACTION_FAILED` | 4 |
| Status false-current | 0 |
| Critical precision | 22/22 = 100.00% |
| Resolved coverage | 22/122 = 18.03% |
| Safe-unresolved correctness | 87/124 = 70.16% |

The replay score has no truth comparison failures. Its remaining error counts
are `QUALITY_POLICY=66`, `FETCH=48`, `EXTRACTION=14`, `CONFLICT=2`,
`SOURCE_SELECTION=7`, and `GROUND_TRUTH_AMBIGUOUS=6`.

### GT-V2-24 before and after

| Run | State | Value | Scorer result |
|---|---|---|---|
| Sealed Run #6 | `FOUND` | `accepting_applications` | `UNSAFE_UNRESOLVED_VALUE` / false-current |
| Remediation 11 replay | `NEEDS_REVIEW` | none | `SAFE_UNRESOLVED_PASS` |

The new rejection reasons are `PROGRAMME_STATUS_APPLICABILITY_UNPROVEN` and
`PROGRAMME_STATUS_OPEN_WINDOW_UNPROVEN`.

### Identity regression controls

The 22 correct Run #6 `programme_identity` `FOUND` controls were replayed:

| Result | Count |
|---|---:|
| Retained correct | 22/22 |
| New unresolved | 0 |
| New incorrect | 0 |

The five Remediation-10 target cases were unchanged from the sealed Run #6
output:

| Case | Run #6 | Replay | Replay scorer |
|---|---|---|---|
| `GT-V2-22-programme_identity` | `FOUND`, Baccalaureat en informatique | same | PASS, EXACT_EQUIVALENT |
| `GT-V2-23-programme_identity` | `FOUND`, Maitrise en informatique | same | PASS, EXACT_EQUIVALENT |
| `GT-V2-25-programme_identity` | `EXTRACTION_FAILED` | same | COVERAGE_LOSS |
| `GT-V2-33-programme_identity` | `FOUND`, Parcours Systemes et Applications Repartis (SAR) | same | PASS, EXACT_EQUIVALENT |
| `GT-V2-34-programme_identity` | `NEEDS_REVIEW` | same | COVERAGE_LOSS |

`GT-V2-25` therefore has no new Remediation-11 regression, but it remains a
pre-existing Run #6 extraction/coverage gap. This safety-only remediation did
not broaden its scope into identity coverage work. The Run #6 aggregate
identity incorrect-`FOUND` count remains zero.

The Remediation-4 controls and all six original P0 controls had zero
unsupported concrete promotions in the replay. The ambiguity/granularity
controls `GT-V2-19`, `GT-V2-21`, and `GT-V2-32` retained their safe unresolved
behavior.

## 7. Targeted live smoke

The bounded smoke ran only after the offline replay passed. It covered roster
rows `1,2,9,15,22,23,24,25,27,33,34`, including GT-V2-24, the five identity
targets, Remediation-4 controls, and original P0 controls. It was diagnostic,
not Official Run #7.

| Item | Result |
|---|---|
| Smoke ID | `phase3f-v3-run-20260908T120000Z` |
| Diagnostic rows | 11 |
| Terminal programmes | 11/11 |
| Sealed pipeline output SHA-256 | `0e11ceb371b5e3558abb62f8e030c9b84b2ea1dc5390b4abd7e32ef372c9a693` |
| Provider | `deepseek` |
| Endpoint | `https://api.deepseek.com` |
| Model | `deepseek-v4-flash` |
| Reasoning | `none` |
| Critical precision | 7/7 = 100.00% |
| False-current | 0 |
| Seven safety counters | all 0 |

Smoke provider metadata recorded 86 calls, 88 logical requests, 88 request
attempts, 4 failures, 1 group failure, 0 retries, 0 HTTP 429 responses, 0
HTTP 401/402 responses, 0 HTTP 5xx responses, 781,783 prompt tokens, 91,937
completion tokens, and 873,720 total tokens. No billing cost was estimated.

## 8. Official Run #6 baseline retained for audit

Run #6 executed 36/36 terminal programmes across 12/12 institutions. It
discovered and fetched 358/358 sources: HTML 338, PDF 20, structured MIME 0.
Parser attempts/non-empty/failures were 358/358/0. ACCESS_BLOCKED fetch errors
were 40; fetch-stage failures were 46.

Provider metrics were 255 calls, 262 logical requests, 262 attempts, 13
failures, 6 group failures, 0 retries, 0 HTTP 429, 0 HTTP 401/402, 0 HTTP
5xx, 2,009,742 prompt tokens, 256,513 completion tokens, and 2,266,255 total
tokens.

Assertion totals were 1,636 total, 595 effective non-null, and 566 field
candidates. The field breakdown was:

| Field | Candidate / non-null candidate | Assertion / non-null assertion | Selected |
|---|---:|---:|---:|
| `programme_identity` | 27 / 23 | 41 / 23 | 23 |
| `credential` | 28 / 25 | 40 / 25 | 24 |
| `programme_status` | 22 / 1 | 57 / 1 | 1 |
| `tuition` | 34 / 28 | 61 / 28 | 22 |
| `application_deadline` | 29 / 32 | 157 / 32 | 31 |
| `english_requirement` | 10 / 24 | 163 / 24 | 23 |
| `major_admissions_requirement` | 95 / 108 | 350 / 108 | 97 |

Run #6 projection states were FOUND 23, NEEDS_REVIEW 155, CONFLICTING_SOURCES
4, ACCESS_BLOCKED 49, SOURCE_NOT_FOUND 7, EXTRACTION_FAILED 14,
FETCH_FAILED 0, PARSE_FAILED 0, STALE_ONLY 0, NOT_EVALUATED 0, NOT_REQUIRED 0,
and NOT_PUBLISHED 0.

Run #6 primary metrics were programme discovery 36/36, required-source
discovery 36/36, institution floor 100%, critical precision 22/22,
resolved coverage 22/122, and safe-unresolved correctness 86/124.
PRODUCT_SAFE was 0/0, so evidence entailment was unavailable rather than a
100% pass.

## 9. Safety and remaining blocker

The seven Remediation-11 replay safety counters are all zero:

| Counter | Replay count |
|---|---:|
| false-current critical | 0 |
| fuzzy-only identity merge | 0 |
| unresolved conflict promoted | 0 |
| SOURCE_NOT_FOUND promoted | 0 |
| STALE_ONLY promoted | 0 |
| prohibited high-volatility inferred critical promoted | 0 |
| PRODUCT_SAFE without durable provenance | 0 |

The dominant remaining non-safety cluster is **QUALITY_POLICY / ACCEPTANCE**
(66 replay errors), followed by FETCH (48) and EXTRACTION (14). No follow-up
remediation was started.

## 10. Validation

| Check | Result |
|---|---|
| Full data-ingestion suite | PASS - 386 tests |
| Remediation-11 programme-status tests | PASS - 11 tests |
| Remediation-10 tests | PASS - 6 tests |
| Remediation-9 tests | PASS - 9 tests |
| Acceptance/projection/runtime tests | PASS within focused 81-test run |
| V3 preflight tests | PASS - 6 tests |
| Scorer v2 tests | PASS - 13 tests |
| Focused combined remediation/scorer/preflight run | PASS - 81 tests |
| Compileall (`services/data-ingestion/src`, `scripts`) | PASS |
| JSON/schema and JSONL validation | PASS; 21 JSON files and all selected JSONL artifacts parsed; sealed outputs loaded by the scorer |
| Secret scan | PASS; no credential or private-key value in remediation source, tests, scripts, or report |
| Benchmark V3 hash validation | PASS; manifest, truth, scorer, machine scorer, and immutable V2 lineage hashes unchanged |
| Run #1-#6 integrity | PASS; exact hashes recorded below |
| `git diff --check` | PASS |

The authoritative `scripts/phase3f_v3_preflight.py` remained green. The legacy
`scripts/preflight_phase3f_benchmark.py` wrapper is documented as deferred:
its historical artifact dependency is absent from the clean V3 checkpoint and
is unrelated to this safety fix. It was not used as the authoritative V3
preflight.

## 11. Frozen and run integrity hashes

| Run/artifact | SHA-256 |
|---|---|
| Run #1 `phase3f-v2-run-20260901T120410Z` | `d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc` |
| Run #2 `phase3f-v2-run-20260903T065023Z` | `d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df` |
| Run #3 `phase3f-v2-run-20260905T030109Z` | `ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad92f39af1a90a8c` |
| Run #4 `phase3f-v2-run-20260905T161914Z` | `8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d` |
| Run #5 `phase3f-v3-run-20260907T145934Z` | `df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4` |
| Run #6 `phase3f-v3-run-20260908T040003Z` | `b0bacb90c6c4b315cdf9bc710bdb69ac4349b204b754d6265a6809c1a0251b62` |
| V3 freeze manifest | `d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c` |
| GT v3 | `af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc` |
| Scorer v2 JSON | `86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8` |
| Machine scorer | `68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7` |

## 12. Readiness and stop state

**FULL BENCHMARK RUN #7 READY** under the Remediation-11 readiness gate:

- GT-V2-24 unsafe `FOUND` eliminated;
- all replayed programme-status concrete outputs are safe;
- false-current is 0;
- all seven safety counters are 0;
- identity incorrect `FOUND` remains 0 and 22/22 correct identity controls
  remain correct;
- targeted smoke precision is 100%;
- full tests pass; and
- Benchmark V3 and sealed Run #6 are unchanged.

Node 22.15.0 was used. Node 24 remains **DEFERRED / UNVERIFIED by user
decision**. Slice F remains **NO-GO**. The next action is to stop and wait for
explicit authorization before any Benchmark #7 execution or later coverage
remediation.
