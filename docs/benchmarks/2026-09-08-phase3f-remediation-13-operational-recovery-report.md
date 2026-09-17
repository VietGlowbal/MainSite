# Phase 3F Remediation 13: operational recovery

Date: 2026-09-08  
Benchmark: `phase3f-v3` frozen  
Official Run #8: `phase3f-v3-run-20260908T134122Z`  
Run #9 status: **BLOCKED** pending a healthy-provider smoke on the final code

Remediation 13 remains local. It was not committed or pushed. Official
Benchmark #9 was not run.

## Decision and protected gates

The remediation is an operational-reliability change. It adds bounded
recovery over already-configured authoritative sources, isolates recoverable
provider/extraction failures, persists provider metrics, and makes provider
retry behavior explicit. It does not change the frozen truth, scorer, roster,
thresholds, identity equivalence rules, programme-status temporal guard, or
quality-policy acceptance rules.

The final local code preserves the protected controls in unit and full-suite
validation:

- no benchmark case ID or expected benchmark value is referenced by production
  Remediation 13 code;
- same-authority programme-scope conflicts are rejected before fallback
  evidence is used;
- `GT-V2-24-programme_status` remains guarded by Remediation 11;
- malformed provider facts are isolated only when valid sibling facts remain;
- a payment/authentication failure is non-retryable;
- retryable transport failures remain bounded by `max_llm_retries = 2`;
- source fallback is bounded by `max_source_recovery_candidates = 4`.

The readiness gate is blocked because the healthy-provider smoke that ran
before the final scope guard produced one wrong-scope concrete identity
(`GT-V2-26-programme_identity`, 3/4 concrete precision). The following smoke
encountered systemic DeepSeek HTTP 402 responses and produced no concrete
values. The final scope and 402 fixes pass deterministic tests, but they have
not had a healthy-provider end-to-end smoke.

## Run #8 and frozen-input integrity

Run #8 pipeline output was verified unchanged:

```text
SHA-256  87ec1dc88da485c746edbca5615cf00c7543cf3111a66d2949fcb6f4fd4bf74f
```

Runs #1 through #8 were independently hashed and all matched their recorded
values. The V3 preflight passed with the following frozen anchors:

```text
GT v3                 af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc
V3 freeze manifest    d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c
Scorer v2 JSON        86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8
Machine scorer        68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7
```

The no-provider preflight made zero provider calls. Run #8 and the frozen V3
artifacts were not modified.

## Exact D3 population

The authoritative Run #8 recovery-candidate artifact contains three D cases:

| Case | Field | Run #8 state | First divergent stage |
| --- | --- | --- | --- |
| `GT-V2-27-credential` | credential | `SOURCE_NOT_FOUND` | `SOURCE_SELECTION` |
| `GT-V2-27-programme_status` | programme status | `SOURCE_NOT_FOUND` | `SOURCE_SELECTION` |
| `GT-V2-27-tuition` | tuition | `SOURCE_NOT_FOUND` | `SOURCE_SELECTION` |

The configured candidate set was the ITASIA page, the University of Tokyo
Computer Science admission page/PDF, and the ITASIA root. The ITASIA primary
returned HTTP 404. The bounded recovery implementation now ranks and tries
the already-known same-authority candidate set deterministically, retains the
primary failure in telemetry, and leaves semantic applicability to later
validation. A fetched ITASIA root did not by itself prove the target field, so
the live smoke left all three cases unresolved rather than manufacturing a
concrete result.

The D3 root cause is a generic source-frontier/routing defect: the old path
stopped at one failed preferred URL instead of exhausting a bounded eligible
alternate set. The implementation does not discover new URLs or bypass access
policy.

## Exact E9 population

| Case | Field | First divergent stage | Root cause recorded |
| --- | --- | --- | --- |
| `GT-V2-13-programme_status` | programme status | `EXTRACTION` | grouped extraction/candidate drop |
| `GT-V2-17-programme_status` | programme status | `EXTRACTION` | grouped extraction/candidate drop |
| `GT-V2-23-application_deadline` | application deadline | `EXTRACTION` | grouped extraction/candidate drop |
| `GT-V2-23-programme_status` | programme status | `EXTRACTION` | grouped extraction/candidate drop |
| `GT-V2-25-programme_status` | programme status | `EXTRACTION` | malformed provider response |
| `GT-V2-32-application_deadline` | application deadline | `EXTRACTION` | context routing failure |
| `GT-V2-32-english_requirement` | English requirement | `EXTRACTION` | context routing failure |
| `GT-V2-32-programme_status` | programme status | `EXTRACTION` | context routing failure |
| `GT-V2-32-tuition` | tuition | `EXTRACTION` | context routing failure |

The source evidence was present for all nine cases. The first four had
candidate/assertion evidence in the Run #8 artifacts. `GT-V2-25` had an
assertion path but a malformed grouped provider fact. The four `GT-V2-32`
fields hit the context-limited extraction path before a candidate was created.

## C30 access audit

The artifact-level audit classified the 30 class-C fields as follows. C2 and
C4 are recovery candidates, not proof that the alternate source is semantically
applicable; they require normal field validation.

| Class | Count | Case IDs |
| --- | ---: | --- |
| C1 genuine inaccessible/no eligible alternate | 8 | `GT-V2-35-application_deadline`, `GT-V2-35-programme_status`, `GT-V2-35-tuition`, `GT-V2-36-application_deadline`, `GT-V2-36-english_requirement`, `GT-V2-36-major_admissions_requirement`, `GT-V2-36-programme_status`, `GT-V2-36-tuition` |
| C2 blocked primary with already-fetched official alternate | 13 | `GT-V2-08-application_deadline`, `GT-V2-08-programme_status`, `GT-V2-09-application_deadline`, `GT-V2-09-credential`, `GT-V2-09-english_requirement`, `GT-V2-09-major_admissions_requirement`, `GT-V2-09-programme_identity`, `GT-V2-09-programme_status`, `GT-V2-09-tuition`, `GT-V2-31-application_deadline`, `GT-V2-31-english_requirement`, `GT-V2-31-programme_status`, `GT-V2-31-tuition` |
| C3 incorrect block classification | 0 | — |
| C4 blocked primary with configured catalogue/PDF fallback | 9 | `GT-V2-04-application_deadline`, `GT-V2-04-programme_status`, `GT-V2-06-application_deadline`, `GT-V2-06-credential`, `GT-V2-06-programme_identity`, `GT-V2-06-programme_status`, `GT-V2-26-application_deadline`, `GT-V2-26-programme_status`, `GT-V2-26-tuition` |
| C5 source-intent routing defect | 0 | — |
| C6 other | 0 | — |

The C1/C2/C4 evidence and exact source lists are in
[remediation13-offline-replay.json](./remediation13/remediation13-offline-replay.json).
Robots and access policy were respected throughout.

## Run #7 to Run #8 variance

The machine-readable transition matrix is
[run7-run8-operational-variance.json](./remediation13/run7-run8-operational-variance.json).
It records 22 terminal-state transitions:

| Run #7 → Run #8 | Count |
| --- | ---: |
| `CONFLICTING_SOURCES` → `NEEDS_REVIEW` | 3 |
| `EXTRACTION_FAILED` → `NEEDS_REVIEW` | 3 |
| `NEEDS_REVIEW` → `EXTRACTION_FAILED` | 8 |
| `NEEDS_REVIEW` → `ACCESS_BLOCKED` | 6 |
| `FOUND` → `ACCESS_BLOCKED` | 1 |
| `CONFLICTING_SOURCES` → `EXTRACTION_FAILED` | 1 |

The most material stability regression was `GT-V2-31-programme_identity`,
which changed from correct `FOUND` in Run #7 to `ACCESS_BLOCKED` in Run #8
after the Sorbonne source failed. The Run #8 artifact shows no replacement
source was selected for that programme. `GT-V2-32` also changed evidence
context and ended in extraction failure. These findings point to acquisition
availability and grouped extraction context as the main variance sources.

The first healthy Remediation 13 smoke exposed an additional source-scope
problem: an official Computer Science PDF on a related University of Tokyo
host was accepted for the ICE target. This was a generic same-authority
programme-scope defect, not a case branch. The final code rejects divergent
`/course/<scope>` candidates across institutional subdomains while retaining
central pages and related-party sources for later applicability checks.

## Source-recovery changes

`source_recovery.py` now provides a stable, deduplicated ranking over the
existing configured source frontier. Ranking considers exact host, shared
path prefix, field terms, catalogue/PDF form, and specificity, with canonical
URL tie-breaking. A conservative institutional-authority scope check rejects a
same-authority source from a different explicit programme scope. The pipeline
uses the eligible set both for bounded fallback and for the normal configured
source bundle, preventing a rejected fallback from being reintroduced later.

The fallback path records primary failure, candidate rank, score, reason,
outcome, error code, error message, and source page type in
`source_recovery_events.jsonl`. It preserves the primary failure when a
fallback succeeds. The maximum fallback candidate count is four.

## Extraction-recovery changes

The provider client now:

1. keeps deterministic source-native extraction ahead of model extraction;
2. isolates malformed facts when valid sibling facts survive full schema
   validation;
3. preserves an extraction failure when all facts are malformed;
4. splits a context-limited group into bounded two-field requests, retaining
   only valid successful facts;
5. records partial-fact and group-isolation recoveries;
6. keeps exhausted operational failures as `EXTRACTION_FAILED`.

The implementation does not change the provider or model. It remains
`deepseek` at `https://api.deepseek.com`, model `deepseek-v4-flash`, reasoning
`none`.

HTTP 401 and HTTP 402 are now permanent provider/configuration failures and do
not retry. Timeouts, connection failures, 429, and transient 5xx responses
remain bounded by the existing retry limit. With the default limit of two
retries, a retryable logical request has at most three attempts. Context
isolation creates at most the bounded number of two-field chunks.

## Provider observability

`RunMetrics.provider_stats` is persisted into the pipeline execution metrics,
which are included in future sealed `pipeline-output.json` and run manifests.
The persisted fields include logical requests, request attempts, successful
calls, failures, group failures, retries, HTTP classes, token totals, partial
fact recovery, and group isolation recovery. No keys, authorization headers,
or request secrets are persisted.

Official Run #8 did not retain complete provider request/token totals in its
sealed manifest. Its local diagnostics retain 249 cache records, 254 extraction
events (248 completed and 6 failed), 53 extraction traces (52 successful and 1
failed), and one explicit provider failure. Remediation 13 closes this
observability gap for future runs without changing scoring.

The first bounded smoke recorded:

```text
logical requests       94
request attempts       108
successful calls       83
failures               25
group failures         0
retries                14
HTTP 429/401/402/5xx   0 / 0 / 21 / 0
prompt/completion      693110 / 74196
total tokens           767306
partial fact recovery  3
group isolation        1
```

The follow-up smoke made no successful calls and received HTTP 402 for all 36
attempts. It recorded 12 logical requests, 36 attempts, 36 failures, and 24
retries because it ran before the final HTTP 402 non-retry correction. The
correction is covered by a focused test; no further provider request was made
after that systemic payment failure.

## Offline replay

The read-only offline analysis used sealed Run #7/Run #8 evidence and the
authoritative Run #8 candidate artifact:

```text
provider calls = 0
refetches      = 0
new URLs       = 0
D recovery paths identified = 3
E recovery paths identified = 9
operational states reclassified = 0
new incorrect concrete = 0
identity incorrect = 0
safety counters = 0,0,0,0,0,0,0
```

This is a recovery-path replay/analysis. It does not claim that a network
fetch or provider extraction succeeded. It preserves C1, `ACCESS_BLOCKED`,
and `EXTRACTION_FAILED` as operational states.

## Bounded live smoke

Smoke population: roster rows `4,6,8,9,13,17,23,25,26,27,31,32`; 12 rows,
12 terminal, and no partial programme execution.

The first healthy-provider smoke was
`phase3f-v3-run-20260908T154805Z` and sealed output hash
`052ed850e16647eb678c15ffcb93c4cb1c55dbf3509ead8d3887803da321a47a`.
It fetched 115 sources and had 11 source-recovery attempts, 7 successes, and
4 failures. Three of four concrete scorer-comparable outputs were correct;
`GT-V2-26-programme_identity` was incorrectly promoted from the wrong-scope
Tokyo CS PDF, so concrete precision was **3/4 = 75%**. The source-scope guard
was added after this observation.

The follow-up smoke was
`phase3f-v3-run-20260908T161124Z` with output hash
`933de3e302127e58ed93c72fa9dd343a03340060814ee9c98b573b8f8721f959`.
It was terminal for all 12 rows but received systemic HTTP 402 responses and
ended with 84 `EXTRACTION_FAILED` field records and no concrete output. It is
an infrastructure diagnostic, not a precision result.

Observed recovery behavior in the first smoke:

```text
D fetch paths successful             3/3
D semantically resolved              0/3
E cases moved out of EXTRACTION_FAILED 5/9
selected C fields moved to safe review 3
GT-V2-31 identity recovered           0 (remained blocked)
```

The three D fetch successes did not establish the target programme semantics;
they correctly remained unresolved. The five E transitions were safe or
non-concrete terminal states. No final healthy-provider smoke exists after the
scope and HTTP 402 corrections, so the targeted-smoke gate is not passed.

The partial frozen-scorer diagnostic for the first smoke found zero safety
counter violations, but it found the one identity correctness failure above.
The final implementation therefore has no claim of 100% live-smoke precision.

## Protected controls

Deterministic controls and the existing full suite preserve:

```text
new incorrect concrete in offline replay = 0
identity incorrect in offline replay     = 0
GT-V2-24 programme status                 = safe / unresolved
false-current                            = 0
fuzzy-only identity merge                = 0
unresolved conflict promoted             = 0
SOURCE_NOT_FOUND promoted                = 0
STALE_ONLY promoted                      = 0
inferred high-volatility critical        = 0
PRODUCT_SAFE without provenance          = 0
```

The 22 Run #7 identity controls, Remediation 10 identity cases, Remediation 11
status guard, Remediation 4 controls, original P0 controls, tuition guards,
and major-admissions guards were covered by the existing regression suites.
The Tokyo scope regression from the first smoke is explicitly covered by the
new generic source-scope test; a healthy end-to-end recheck remains required.

## Stability and budget controls

The operational stability artifact records 22 state transitions. The source
frontier is deduplicated and canonically ordered. Source fallback is bounded
to four candidates, and provider retry behavior is bounded to three attempts
for retryable requests. Permanent 401/402 failures receive one attempt.
There is no retry storm or unrestricted source traversal in the final code.

No new correct concrete values were established by the smoke after applying
the final guard. Therefore the non-official resolved-coverage projection is
**not computed**. The non-official safe-unresolved effect is directionally
positive for E recovery, but the 12-row smoke and provider failure do not
support extrapolating a denominator-level percentage from Run #8's 82/124.

## Validation

Measured validation after the final local changes:

| Check | Result |
| --- | --- |
| Remediation 13 focused tests | 9 passed |
| Remediation 9–13 remediation test discovery | 66 passed |
| Frozen preflight + scorer tests | 19 passed |
| Combined preflight/scorer/Remediation 13 pytest | 28 passed |
| Full ingestion pytest suite | 398 passed |
| Schema/catalog tests | 5 passed |
| Compileall | PASS |
| JSON/JSONL validation | PASS for replay, variance, smoke, and report inputs |
| Secret scan | PASS; no secret values printed or persisted |
| Frozen Benchmark V3 hash validation | PASS |
| Runs #1–#8 pipeline-output hash validation | PASS |
| `git diff --check` | PASS; Git emitted only existing CRLF conversion warnings |

The authoritative no-provider V3 preflight passed with zero provider calls.
Node 22 remains the execution policy; Node 24 remains deferred/unverified by
user decision.

## Files and artifacts

Production and test changes are currently local:

```text
services/data-ingestion/src/glowbal_ingestion/source_recovery.py
services/data-ingestion/src/glowbal_ingestion/config.py
services/data-ingestion/src/glowbal_ingestion/deepseek.py
services/data-ingestion/src/glowbal_ingestion/pipeline.py
services/data-ingestion/tests/test_remediation13_operational_recovery.py
scripts/analyze_phase3f_remediation13.py
docs/benchmarks/remediation13/run7-run8-operational-variance.json
docs/benchmarks/remediation13/remediation13-offline-replay.json
docs/benchmarks/2026-09-08-phase3f-remediation-13-operational-recovery-report.md
```

The two live smoke directories and their raw diagnostics are generated local
artifacts. Run #8's sealed directory remains external/authoritative and was
not copied, rewritten, or staged. Existing unrelated application, SQL,
convergence, historical benchmark, and scratch files in the main worktree
remain untouched.

No commit or push was performed.

## Readiness and next action

```text
FULL BENCHMARK RUN #9: BLOCKED
```

Blockers:

1. the healthy-provider smoke before the final scope fix had one wrong-scope
   concrete identity, so its precision was 75%;
2. the follow-up smoke was blocked by systemic DeepSeek HTTP 402 and cannot
   validate the final code end to end;
3. a fresh healthy-provider bounded smoke is required to establish 100%
   concrete precision and zero operational regressions after the final fixes.

The exact next action is to restore valid DeepSeek billing/availability and
run one bounded 12-row smoke on the final local code, then rerun the no-provider
validation. If that smoke passes, use a separate authorized checkpoint task
to audit/selectively commit/push and create a fresh clean Run #9 checkout. Do
not run Benchmark #9 in this remediation task.

Slice F remains **NO-GO**.
