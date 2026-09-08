# Phase 3F Remediation 10 Report

Date: 2026-09-07/08

Scope: repair the five remaining concrete `programme_identity` errors from
Official Run #5, restore the missing clean-checkpoint SQL fixtures, and audit
downstream acceptance loss from evidence already present. Official Run #5,
Benchmark V3, GT v3, and the V3 scorer were not modified. Benchmark #6 was
not run.

## 1. Sealed Run #5 verification

The authoritative output is:

`data-platform-benchmark5-preflight-20260907h/docs/benchmarks/runs/phase3f-v3-run-20260907T145934Z/pipeline-output.json`

Its SHA-256 is `df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4`,
matching the supplied value. The file remains unchanged. The Run #5 baseline
was 25 concrete `FOUND`, 20 correct resolved cases, 5 incorrect identity
`FOUND`, 48 `FETCH` taxonomy errors, 70 `QUALITY_POLICY` errors, and zero in
all seven safety counters.

## 2. Five-case forensic trace

The machine-readable trace is
`docs/benchmarks/runs/phase3f-remediation10-offline-replay-20260907T170000Z/identity-five-case-trace.jsonl`.
The sealed comparison is in
`identity-five-case-comparison.jsonl`.

| Case | Run #5 source/evidence | First incorrect stage | Remediation result |
| --- | --- | --- | --- |
| `GT-V2-22-programme_identity` | Official Universite de Montreal programme page; `Baccalaureat en informatique` | `STRUCTURED_IDENTITY_PARSE` | `FOUND`; canonical subject `informatique`, credential `Baccalaureat`; V3 `PASS` |
| `GT-V2-23-programme_identity` | Official Universite de Montreal admission/regulations page; `Maitrise en informatique` | `STRUCTURED_IDENTITY_PARSE` | `FOUND`; canonical subject `informatique`, credential `Maitrise`; V3 `PASS` |
| `GT-V2-25-programme_identity` | University of Tokyo graduate-school/department policy page covering multiple degree routes | `ENTITY_TYPE` | `NEEDS_REVIEW`; no department-to-degree collapse |
| `GT-V2-33-programme_identity` | Official Sorbonne `parcours-sar` child page | `PARENT_CHILD_RELATION` | `FOUND`; `TRACK`, parent `Master Informatique`, track `SAR`; V3 `PASS` |
| `GT-V2-34-programme_identity` | Official Michigan MADS delivery-specific page | `APPLICABILITY` | `NEEDS_REVIEW`; online-delivery applicability is not assumed |

No case-specific branch or benchmark answer was added.

## 3. Individual root causes

### GT-V2-22

The source title was factual and source-native, but the runtime identity had
no deterministic decomposition of the credential-bearing title. The new
identity dimensions preserve the source title and expose the subject and
credential separately.

### GT-V2-23

The same missing structured decomposition affected the graduate title. The
fix is the shared credential-prefix parser, not a Montreal-specific rule.

### GT-V2-25

The selected source is broad graduate-school/department evidence. A scalar
`Master of Information Science and Technology` value was promoted as though
it were the routed degree programme. Remediation 9's intended unit-scope guard
was not reached in the full projection because persisted source text was not
available to the acceptance path. The repaired path requires an explicit
structured target entity for a department/faculty/school scalar identity;
otherwise it remains reviewable.

### GT-V2-33

The source is a child track page. The runtime retained the child title but did
not expose the explicit parent/track relationship. The deterministic hierarchy
resolver now derives the parent from the URL/title structure and preserves the
child track as metadata.

### GT-V2-34

The source is an official online programme page, but the routed target does not
prove that online delivery is the applicable identity variant. The new
source-text delivery guard keeps the assertion unresolved rather than treating
an adjacent delivery variant as the target.

## 4. Generic implementation changes

Changes are limited to generic pipeline/harness behavior:

- `identity_granularity.py` now provides source-backed `IdentityDimensions`,
  conservative credential separation, explicit track/parent dimensions, and a
  stricter department/faculty/school target-applicability guard.
- `runtime_acceptance.py` consistently passes source text into identity
  acceptance and rejects an explicitly online identity when delivery
  applicability is not established.
- `run_phase3f_v3_benchmark.py` rehydrates persisted raw source text by URL
  during projection and attaches deterministic identity dimensions. It does
  not call the provider or read benchmark truth during runtime.
- `test_remediation10_identity.py` adds six positive/negative tests for
  credential-bearing titles, track hierarchy, unit scope, and delivery scope.
- `replay_phase3f_remediation10.py` provides an offline, no-refetch replay and
  machine-readable acceptance-loss diagnostics.

No change was made to GT v3, Contract v2, Scorer v2, thresholds, prompts,
provider selection, tuition semantics, or major-admissions semantics.

## 5. Identity replay

Replay run:
`phase3f-remediation10-offline-replay-20260907T170000Z`

Replay output SHA-256:
`e941bceadc0ee5099a98074850e4c789cced906e7e3234bb355bcdb89d713168`

The five-case transition was:

- before: 5 incorrect concrete `FOUND`;
- after: 3 correct concrete `FOUND`, 2 `NEEDS_REVIEW`;
- after: 0 incorrect concrete `FOUND`.

The two unresolved cases are GT-V2-25 and GT-V2-34. This is the required
precision-first fallback, not a forced coverage result.

The 20 previous Run #5 identity controls remained equivalent under V3 with no
regression (`20/20`). GT-V2-19 and GT-V2-21 remained unresolved; GT-V2-32
remained operationally unresolved in the replay. No unsafe ambiguity or
parent/child promotion occurred.

## 6. SQL fixture and checkpoint completeness

The three clean-checkpoint failures were caused by two absent root-level SQL
fixtures referenced by the tests:

- `supabase-crawl-acquisition-v3.sql` (used by `test_acquisition.py` and
  `test_raw_evidence.py`), SHA-256
  `fcc74558489325a6f4403ab4d68fba71180b19a1bdcce790c25de50f60e0ad74`;
- `supabase-identity-promotion-v3.sql` (used by
  `test_identity_promotion_slice_d.py`), SHA-256
  `f1bfdff9f8c3ff85e6808b4cfa149ac4f71fa4ea8cf1b9ac29a1c3dd0cf53d50`.

The exact trusted local copies are restored in the working tree. No SQL
schema semantics were changed. They remain uncommitted because this task did
not authorize a checkpoint commit; a subsequent checkpoint must include them
for a genuinely fresh checkout to contain the fixtures.

## 7. Acceptance-loss audit

The replay evaluated 46 unique direct-support cases with non-null diagnostic
assertions, represented by 89 field rows. This is the high-value population
derived from existing persisted evidence; no discovery or refetch was used.

| First blocker class | Rows |
| --- | ---: |
| `VALID_SAFETY_BLOCK` | 35 |
| `MISSING_TEMPORAL_PROOF` | 31 |
| `MISSING_APPLICABILITY_PROOF` | 23 |
| **Total** | **89** |

All 89 rows were marked justified by the replay audit. No high-confidence
generic downstream relaxation was supported. The field distribution was:

| Field | Rows | Cases |
| --- | ---: | ---: |
| `credential` | 19 | 19 |
| `programme_status` | 0 in this selected matrix | 0 |
| `tuition` | 5 | 5 |
| `application_deadline` | 1 | 1 |
| `english_requirement` | 22 | 11 |
| `major_admissions_requirement` | 42 | 10 |
| `programme_identity` | 0 after the five-case identity repair population was separated | 0 |

### Credential

All 19 selected direct candidates were blocked by missing temporal proof. A
trial temporal waiver was not retained: it would have exposed 17 incorrect V3
credential values. Source-native credential evidence remains preserved for
future temporal remediation.

### Programme status

Run #5 had zero `FOUND` status values and 25 safe-unresolved status fields,
with 11 resolved-truth coverage losses. The audit found no generic proof that
page existence alone establishes an active lifecycle state. No status guard
was weakened.

### Tuition

The five rows were blocked by valid semantic/scope safeguards. The replay did
not promote amounts without adequate tuition-vs-fee/COA semantics, period,
audience, residency, and programme applicability. Remediation 9 tuition
guards remain unchanged.

### Application deadline

The single row lacked sufficient cycle/scope/temporal proof. Deadline type,
intake, audience, and programme scope were not collapsed.

### English requirement

The 22 rows were valid safety blocks: minimum-language semantics, programme
scope, authority, or currentness was not sufficiently established. No
recommendation, waiver, or English-taught inference was promoted.

### Major admissions

The 42 rows were blocked by applicability, temporal, or semantic safety
requirements. Curriculum, application-component, recommended-preparation, and
post-admission text was not converted into an admissions prerequisite.

### Fetch/access

The sealed Run #5 taxonomy contained 48 `FETCH` errors and 49
`ACCESS_BLOCKED` projections. This remediation did not bypass access controls
or add source recovery. The 46-case matrix was selected specifically to avoid
confusing absent evidence with acceptance loss.

## 8. Offline coverage result

The full offline projection/scoring replay changed correct resolved coverage
from the Run #5 baseline `20/122` to `23/122` (`18.85%`). The delta was:

- newly correct concrete `FOUND`: 3;
- newly incorrect concrete `FOUND`: 0;
- five target errors remaining as concrete `FOUND`: 0;
- target cases conservatively unresolved: 2.

Replay states were `FOUND=23`, `NEEDS_REVIEW=163`,
`CONFLICTING_SOURCES=6`, `ACCESS_BLOCKED=49`, and `EXTRACTION_FAILED=11`.
`PRODUCT_SAFE` remained 0, so product entailment was not available as a
nonzero-denominator metric.
Because every audited acceptance blocker was justified, no broad
`QUALITY_POLICY` relaxation was selected. The dominant remaining problem is
therefore **QUALITY_POLICY / evidence-applicability and temporal coverage**,
with **FETCH/ACCESS** as a separate operational cluster.

For reference, the sealed Run #5 taxonomy was
`QUALITY_POLICY=70`, `FETCH=48`, `EXTRACTION=11`, `CONFLICT=4`, `IDENTITY=4`,
`APPLICABILITY=1`, and `GROUND_TRUTH_AMBIGUOUS=6`.

## 9. Targeted live smoke

Diagnostic smoke ID:
`phase3f-v3-run-20260907T180100Z`

It evaluated 12 programmes (84 field records), reached 12/12 terminal
programme states, fetched 130 sources, and used the locked DeepSeek
configuration (`deepseek`, `https://api.deepseek.com`,
`deepseek-v4-flash`). The smoke output SHA-256 is
`6b29922ad29f766be17971759f188ba4a3736e8b0e69c1a91cefa8bd3d434873`.

The diagnostic score over the selected 84 records had 7 concrete critical
`FOUND` values, all 7 correct: **100% concrete precision**, with zero
incorrect concrete values. It produced `FOUND=7`, `NEEDS_REVIEW=64`,
`CONFLICTING_SOURCES=2`, and `EXTRACTION_FAILED=11`. GT-V2-25 remained
unresolved in the smoke; GT-V2-19/21 remained unresolved; the track and
credential-bearing positive paths remained safe.

The compact machine-readable smoke score is
`docs/benchmarks/runs/phase3f-v3-run-20260907T180100Z/targeted-smoke-score-result.json`.

Provider telemetry from `pipeline-run/coverage_report.json` was:

```text
calls=96, logical_requests=99, request_attempts=99, cache_hits=1
failures=6, group_failures=4, retries=0, HTTP 429=0
prompt_tokens=855597, completion_tokens=109107, total_tokens=964704
```

No refetch or new source discovery was used for the offline replay. The live
smoke used its bounded normal acquisition run and did not modify Run #5.

## 10. Safety controls

All seven zero-tolerance counters are zero:

```text
false-current critical                              0
fuzzy-only identity merge                           0
unresolved conflict promoted                        0
SOURCE_NOT_FOUND promoted                           0
STALE_ONLY promoted                                 0
prohibited inferred critical promoted              0
PRODUCT_SAFE without durable provenance             0
```

The seven Remediation-4 controls remained non-concrete/unresolved or
conflicting as appropriate. The six original P0 controls likewise produced no
unsupported concrete promotion. The complete machine-readable control audit
is `safety-control-audit.jsonl`.

## 11. Validation

Measured results:

```text
full ingestion suite                         375 passed
V3 scorer + preflight + Remediation-10 tests 25 passed
compileall                                   PASS
V3 preflight/hash validation                  PASS
V3 truth population                           252/252 unique
Run #1-#4 sealed output hashes                PASS
Run #5 sealed output hash                      PASS
JSON/JSONL artifact validation                PASS
git diff --check                              PASS
```

Frozen V3 anchors remained unchanged:

```text
GT v3:          af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc
V3 manifest:    d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c
Scorer v2 JSON: 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8
Machine scorer: 68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7
Run #5 output:  df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4
```

The official Run #1-#4 outputs were hash-verified unchanged. The full
high-confidence secret scan found no credential in tracked or intended
Remediation-10 files. The two bearer matches are redacted test/setup
placeholders; the ignored local `.env.local` remains outside the artifact
scope and was not staged. No provider key was printed or persisted in the
report/replay artifacts.

## 12. Run #6 gate

The correctness and safety conditions for the remediation gate are met in
offline replay and targeted smoke: five incorrect concrete identity values
are reduced to zero, 20 identity controls do not regress, concrete smoke
precision is 100%, and all safety counters remain zero.

`FULL BENCHMARK RUN #6: BLOCKED`

The remaining blocker is packaging: the two restored SQL fixtures are present
as uncommitted working-tree files, so a newly created committed clean checkout
has not yet been revalidated with them. The next authorized checkpoint must
include the exact fixture bytes and rerun the clean-checkout full suite before
Run #6 can be marked READY. No Benchmark #6 was run here.

## 13. Slice F

`Slice F: NO-GO`.

No benchmark rerun, coverage-wide remediation, provider change, GT/scorer
change, or later Slice F gate was performed.
