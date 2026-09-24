# Phase 3F Remediation 12: safe-unresolved and acceptance audit

Date: 2026-09-08
Scope: diagnostic replay and bounded smoke only
Official Run #7 and Benchmark V3: unchanged
Official Benchmark #8: not run

Remediation 12 found one generic semantic classification defect in the exact
37-case safe-unresolved mismatch population. Three tuition records had been
classified as same-fact conflicts even though their assertions described
different credentials or billing bases. The generic conflict boundary now
keeps those dimensions separate. The remaining 34 mismatches are genuine
operational failures and remain operational states. No acceptance policy was
mass-relaxed, no new concrete output was introduced, and no operational
failure was relabeled as `NEEDS_REVIEW`.

The deterministic replay improved the confirmed safe-unresolved result from
87/124 to 90/124. The honest current-evidence ceiling is therefore 90/124;
the remaining 34 cases require access, source recovery, or extraction work.
The bounded smoke produced 8/8 concrete critical values correctly, with all
seven safety counters at zero.

## 1. Sealed Run #7 verification

Official Run #7:

```text
phase3f-v3-run-20260908T091444Z
```

The sealed pipeline output was verified at:

```text
docs/benchmarks/runs/phase3f-v3-run-20260908T091444Z/pipeline-output.json
SHA-256: e6b1018f08ce4c0a71ba28b4aa20fd76439a6326f6e9a3e008d83771d46dd3f9
```

The file was read only and was not rewritten. Official Run #1 through Run #7
pipeline-output hashes all passed the integrity check. Frozen Benchmark V3
anchors also passed unchanged:

| Artifact | SHA-256 |
| --- | --- |
| Ground Truth V3 | `af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc` |
| V3 freeze manifest | `d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c` |
| Scorer v2 JSON | `86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8` |
| Machine scorer | `68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7` |

## 2. Exact 124-case population and 37 mismatches

The exact population was selected from frozen Ground Truth V3 rows with
`expected_state=NEEDS_REVIEW`, `expected_value=null`, and
`review_status=REVIEWED_CONFIRMED`. It contains 124 rows. The sealed Run #7
score has 87 `SAFE_UNRESOLVED_PASS` rows and 37 mismatches.

The complete machine-readable trace is:

```text
docs/benchmarks/remediation12/phase3f-remediation12-offline-replay-20260908T120500Z/safe-unresolved-matrix.jsonl
docs/benchmarks/remediation12/phase3f-remediation12-offline-replay-20260908T120500Z/safe-unresolved-mismatches.jsonl
```

Each row records the case, institution, programme, field, expected and runtime
states, source availability and authority, evidence status, candidate and
assertion presence, selection, acceptance and projection blockers, crawl and
extraction errors, conflict state, and first divergent stage.

The 37 cases are grouped below. The lists are the exact mismatch population;
the JSONL matrix is the authoritative per-case trace.

| Class | Count | First divergent stage | Cases |
| --- | ---: | --- | --- |
| A. Semantic abstention exists but wrong state | 3 | `CONFLICT_CLASSIFICATION` | `GT-V2-11-tuition`, `GT-V2-32-tuition`, `GT-V2-33-tuition` |
| B. Assertion-present policy blocked | 0 | — | — |
| C. Valid operational failure | 26 | `FETCH` | `GT-V2-04-application_deadline`, `GT-V2-04-programme_status`, `GT-V2-06-application_deadline`, `GT-V2-06-credential`, `GT-V2-06-programme_identity`, `GT-V2-06-programme_status`, `GT-V2-08-application_deadline`, `GT-V2-08-programme_status`, `GT-V2-09-application_deadline`, `GT-V2-09-credential`, `GT-V2-09-english_requirement`, `GT-V2-09-major_admissions_requirement`, `GT-V2-09-programme_identity`, `GT-V2-09-programme_status`, `GT-V2-09-tuition`, `GT-V2-26-application_deadline`, `GT-V2-26-programme_status`, `GT-V2-26-tuition`, `GT-V2-35-application_deadline`, `GT-V2-35-programme_status`, `GT-V2-35-tuition`, `GT-V2-36-application_deadline`, `GT-V2-36-english_requirement`, `GT-V2-36-major_admissions_requirement`, `GT-V2-36-programme_status`, `GT-V2-36-tuition` |
| D. Recoverable fetch or source failure | 3 | `SOURCE_SELECTION` | `GT-V2-27-credential`, `GT-V2-27-programme_status`, `GT-V2-27-tuition` |
| E. Recoverable extraction failure | 5 | `EXTRACTION` | `GT-V2-13-programme_status`, `GT-V2-17-programme_status`, `GT-V2-22-application_deadline`, `GT-V2-22-programme_status`, `GT-V2-25-programme_status` |
| F. True conflict | 0 | — | — |
| G. Ground-truth ambiguous | 0 | — | — |
| H. Other | 0 | — | — |

The mismatch taxonomy is therefore A=3, B=0, C=26, D=3, E=5, F=0, G=0,
H=0. The six frozen `GROUND_TRUTH_AMBIGUOUS` cases are outside this confirmed
124-case population.

## 3. Root-cause traces

### Semantic tuition classification: class A

`GT-V2-11-tuition` has one official Duke source with a 2026-2027
`Master of Engineering` amount expressed both as `$35,680 per semester` and
`$107,040 total program`. Those are different billing bases. The source also
contains an AI + Materials programme qualifier, but the target applicability
was not fully established. Both assertions were correctly rejected by the
existing tuition acceptance guard, but the old conflict detector treated them
as a contradiction. The new result is `NEEDS_REVIEW/null`.

`GT-V2-32-tuition` and `GT-V2-33-tuition` use an official Sorbonne tuition
page with separate `Engineering programmes: EUR 630/year` and
`Master's degree programmes: EUR 255/year` assertions. These have different
credential dimensions and the evidence does not establish the target
programme's complete tuition semantics. They remain rejected and now project
to `NEEDS_REVIEW/null` instead of `CONFLICTING_SOURCES`.

The generic invariant is:

```text
same entity + same field + overlapping scope/audience/cycle
    does not by itself prove same-fact conflict for tuition

tuition assertions with different credential or billing-basis dimensions
    are separate facts

same credential and same billing basis with contradictory values
    remains a conflict

missing assertion evidence
    remains conservative and material
```

This change affects the `tuition` conflict boundary only. It does not promote
either candidate to `FOUND`.

### Valid operational failures: class C

The 26 class-C rows encountered non-retryable access or robots/HTTP failures
and had no fetched field evidence that could support a semantic abstention.
They remain `ACCESS_BLOCKED`. The replay did not bypass access policy, use a
new URL, or convert a blocked fetch into `NEEDS_REVIEW`.

### Source-selection failures: class D

The three `GT-V2-27` rows selected an `/admissions-soon` URL that returned
HTTP 404. The persisted official root page returned 200 and its raw HTML
contained `/admissions` and `/tuition` links, so this is a recoverable
source-selection frontier. The offline replay did not refetch or discover a
new URL; the rows remain `SOURCE_NOT_FOUND` until a separately authorized
source-selection recovery is implemented.

### Extraction failures: class E

The five class-E rows had fetched and parsed sources but no usable non-null
assertion after extraction. They remain `EXTRACTION_FAILED`. No provider
failure was hidden as semantic abstention, and no provider or model change was
made.

There were no class-B assertion-present policy-blocked cases in the exact 37,
no true same-dimension class-F conflict, and no class-G or class-H case. The
matrix records the assertion and blocker details for every row, including the
three class-A non-null assertion pairs and the five fetched-but-empty class-E
rows.

## 4. Acceptance-loss audit and policy changes

Run #7's evidence audit contained 83 direct-support cases and 104 material-
evidence cases. It reported 47 direct-support cases and 58 material-evidence
cases with a non-null assertion but a final unresolved result. Those larger
populations were audited separately from the exact 37 confirmed safe-
unresolved mismatches. The 37 mismatches contain no valid class-B acceptance
case to relax.

The only production change was a generic, field-specific conflict-boundary
change:

| Area | Old invariant | New invariant | Positive examples | Negative guard | Replay effect |
| --- | --- | --- | --- | --- | ---: |
| Tuition conflict detection and projection | Any overlapping institution-level tuition assertions for the same entity/field/cycle could remain a same-fact conflict. | Credential and billing-basis dimensions must overlap before tuition assertions are considered a same-fact conflict. | Duke per-semester versus total-program; Sorbonne engineering versus master's. | Same credential and billing basis with different amounts remains a conflict; missing assertion evidence remains material. | 3 cases reclassified to safe `NEEDS_REVIEW` |

No universal acceptance relaxation was added. There are no case IDs,
institution-specific answer branches, benchmark truth checks, or expected
status/value branches in production code.

Field-specific audit result:

- `programme_identity`: unchanged. The 22 correct Run #7 identity controls
  remain the protected baseline; no identity acceptance rule was changed.
- `credential`: unchanged. The three `GT-V2-27` rows remain source-selection
  failures. Roster metadata remains prohibited as factual evidence.
- `programme_status`: unchanged from Remediation 11. Current-cycle and open-
  window guards remain in force; `GT-V2-24-programme_status` remains safe
  `NEEDS_REVIEW/null`.
- `tuition`: only the semantic conflict boundary changed. Scope, temporal,
  term, audience, programme applicability, COA, fee, and billing guards remain
  in force.
- `application_deadline`: unchanged. Cycle, intake, audience, deadline type,
  and programme applicability remain required.
- `english_requirement`: unchanged. Minimum requirements remain distinct from
  recommendations, English-taught status, and waivers.
- `major_admissions_requirement`: unchanged. Admission prerequisites remain
  distinct from curriculum, application components, recommended preparation,
  and post-admission declaration.

The aggregate assertion-present unresolved populations therefore remain a
future acceptance/coverage audit population. Remediation 12 did not mass-
relax `QUALITY_POLICY`.

## 5. Offline replay results

Replay ID:

```text
phase3f-remediation12-offline-replay-20260908T120500Z
```

The replay used sealed Run #7 evidence only:

```text
provider calls = 0
refetches = 0
new URLs = 0
```

The replay reprojected persisted evidence with the current generic conflict
boundary and loaded frozen truth/scorer only after projection.

| Measure | Before | After |
| --- | ---: | ---: |
| Confirmed `NEEDS_REVIEW/null` population | 124 | 124 |
| Correct safe-unresolved | 87 | 90 |
| Safe-unresolved correctness | 87/124 (70.16%) | 90/124 (72.58%) |
| Mismatches | 37 | 34 |
| Incorrect concrete outputs in this population | 0 | 0 |
| Newly correct concrete outputs | — | 0 |
| Resolved truth coverage | 22/122 (18.03%) | 22/122 (18.03%) |

State counts for the exact 124 rows changed as follows:

| State | Before | After |
| --- | ---: | ---: |
| `NEEDS_REVIEW` | 87 | 90 |
| `CONFLICTING_SOURCES` | 3 | 0 |
| `ACCESS_BLOCKED` | 26 | 26 |
| `EXTRACTION_FAILED` | 5 | 5 |
| `SOURCE_NOT_FOUND` | 3 | 3 |

The remaining 34 mismatches are operational loss: 26 access blocks, 5
extraction failures, and 3 source-selection failures. None was relabeled as
`NEEDS_REVIEW`.

The replay produced no new concrete values, so the newly-resolved replay
precision has a zero denominator and no false positive. The bounded smoke
provided the non-empty concrete precision check: 8/8 = 100%.

Replay safety counters were all zero:

```text
false-current critical                                  0
fuzzy-only identity merge                               0
unresolved conflict promoted                             0
SOURCE_NOT_FOUND promoted                                0
STALE_ONLY promoted                                      0
prohibited high-volatility inferred critical promoted    0
PRODUCT_SAFE without durable provenance                  0
```

The replay taxonomy changed from Run #7's `CONFLICT=4` to `CONFLICT=1`.
Three conflicts were removed from the exact 124 population by the tuition
dimension check. The remaining conflict is
`GT-V2-25-credential`, outside the confirmed safe-unresolved population; it
remains conservative and was not relaxed by this task.

## 6. Protected correctness and safety controls

- Run #7's 22 correct identity `FOUND` controls remained correct; identity
  incorrect outputs remained 0.
- Remediation-10 targets `GT-V2-22`, `GT-V2-23`, `GT-V2-25`, `GT-V2-33`, and
  `GT-V2-34` were not changed by this field-specific tuition conflict fix.
  `GT-V2-25-programme_identity` retains its pre-existing
  `EXTRACTION_FAILED` coverage gap.
- `GT-V2-24-programme_status` remains `NEEDS_REVIEW/null`; false-current is
  0.
- Remediation-4 false-current controls and the six original P0 controls
  retain zero unsupported concrete promotions in the replay and smoke checks.
- No programme-status temporal guard, identity rule, tuition value acceptance,
  deadline rule, English rule, or major-admissions rule was weakened.

## 7. Bounded smoke

Diagnostic smoke ID:

```text
phase3f-v3-run-20260908T121500Z
```

This was a diagnostic-only 12-programme smoke, not Official Benchmark #8.
It completed 12/12 terminal rows and produced a sealed pipeline output with
SHA-256:

```text
04ea7c70bf9486ac21aa8f31a17d0a141714cf3e2beb38b7b49b10bdc93a47f2
```

The exact smoke population contained 84 truth cases and all 84 corresponding
runtime records. It had 8 concrete critical outputs, all correct:

```text
concrete precision = 8/8 = 100%
false-current = 0
all seven safety counters = 0
```

The smoke used the configured DeepSeek identity (`deepseek`,
`https://api.deepseek.com`, `deepseek-v4-flash`, reasoning `none`) but the
local persisted-evidence execution path made zero provider calls. It also
made zero refetches and discovered zero new URLs. This is recorded as the
measured result and is not treated as a live provider-health measurement.

## 8. Validation

| Check | Result |
| --- | --- |
| Remediation-12 tests plus protected Remediation-9/10/11, acceptance, projection, scorer, and V3 preflight tests | **74 passed** |
| Full ingestion suite | **389 passed** |
| Compileall | **PASS** |
| JSON/JSONL/schema validation | **PASS** |
| Secret scan | **PASS**; no secret values, credentials, or tokens found |
| Benchmark V3 hashes | **PASS**; frozen artifacts unchanged |
| Run #1-#7 integrity | **PASS**; sealed output hashes unchanged |
| `git diff --check` | **PASS**; only expected Windows line-ending warnings |

The authoritative V3 preflight checks passed for benchmark identity, frozen
truth, roster, scorer, freeze manifest, all hashes, and truth isolation with
zero provider calls. The current development worktree remains dirty because
Remediation 12 is uncommitted and contains unrelated pre-existing work; this
was not used as an integrity shortcut. No official run artifact was edited.

## 9. Remaining blocker and readiness

The largest aggregate taxonomy cluster remains `QUALITY_POLICY=70`. The
honest safe-unresolved remainder is operational: `FETCH=48` overall, with the
exact confirmed 124-case remainder split into 26 access blocks, 5 extraction
failures, and 3 source-selection failures. The next authorized work should
address deterministic source/access recovery and evidence-to-acceptance loss
as separate field-specific problems. Remediation 12 made no such broad
coverage change.

The frozen Run #7 correctness and safety controls remain closed: identity
incorrect is 0, `GT-V2-24` is safe, all seven safety counters are 0, and the
bounded smoke has 100% concrete precision. Operational failures remain
visible in their original states. Therefore:

```text
FULL BENCHMARK RUN #8 READY
```

This readiness decision does not claim artificial 124/124 safe-unresolved
correctness. A future official Run #8 is expected to measure whether the
remaining operational/source recovery work resolves those cases honestly.

Slice F remains:

```text
NO-GO
```

No Benchmark #8, coverage remediation, Benchmark V3 change, or sealed Run #7
mutation was performed.
