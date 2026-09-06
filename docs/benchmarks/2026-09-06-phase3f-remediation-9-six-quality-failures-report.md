# Phase 3F — Remediation 9: Six True Quality Failures

Date: 2026-09-06
Status: `FULL BENCHMARK RUN #5 READY` for the targeted correctness gate; no
official benchmark #5 was run. Slice F remains `NO-GO` pending later gates.

## 1. Frozen Benchmark V3 verification

Benchmark V3 remained unchanged. Verified hashes:

| Artifact | SHA-256 |
|---|---|
| GT v3 | `af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc` |
| Programme Identity Contract v2 | `634dac0462ae3ccd5825114030e14b20ce49d9fa15625ad0078bba59c584b0a0` |
| Scorer Contract v2 Markdown | `71b93dc291e33dccb065e9629db24546236df0f2fd18f57160c8651ee671070f` |
| Scorer Contract v2 JSON | `86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8` |
| V3 freeze manifest | `d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c` |
| sealed Run #4 pipeline output | `8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d` |

Official Runs #1–#4 and the V3 offline rescore were not modified.

## 2. Six-case population and root-cause matrix

| Case | Field | Before | First incorrect stage | Generic fix | After |
|---|---|---|---|---|---|
| `GT-V2-19-programme_identity` | identity | `B.A. in Public Affairs` FOUND | GRANULARITY | pre-major/stage guard | NEEDS_REVIEW |
| `GT-V2-25-programme_identity` | identity | `Computer Science` FOUND | GRANULARITY | department/unit scope guard | NEEDS_REVIEW |
| `GT-V2-32-programme_identity` | identity | `Master Informatique` FOUND | GRANULARITY | parent/child track guard | NEEDS_REVIEW |
| `GT-V2-01-tuition` | tuition | USD 33,360/term FOUND | APPLICABILITY | billing and annual-scope guard | NEEDS_REVIEW |
| `GT-V2-03-tuition` | tuition | USD 33,360/term FOUND | APPLICABILITY | billing and annual-scope guard | NEEDS_REVIEW |
| `GT-V2-28-major_admissions_requirement` | major admissions | qualifying disciplines FOUND | APPLICABILITY / FIELD SEMANTICS | explicit admission-prerequisite guard | NEEDS_REVIEW |

The fixes do not use case IDs, institutions, roster labels, frozen values, or
benchmark answers in runtime logic.

## 3. Identity granularity findings

### GT-V2-19 — pre-major versus final major

The UCLA evidence says both “Public Affairs pre-major” and that students are
later admitted to the Public Affairs major. The prior projection accepted the
title as a flat programme identity. The new deterministic identity guard treats
the stage relationship as unresolved unless structured stage/pathway metadata
is present. It preserves the source-native title and prevents a pre-major or
stage representation from becoming an unsupported final-major FOUND value.

### GT-V2-25 — department versus programme

The selected University of Tokyo evidence is a Computer Science department
admission page, with the assertion scope recorded as `department`. The
evidence does not itself establish that the department label is the target
programme entity. A department/faculty/school scope now requires an explicit
degree/programme offering or structured programme entity before identity can
be FOUND.

### GT-V2-32 — parent master versus child track

The Sorbonne parent page identifies `Master Informatique` and exposes multiple
child `parcours`, including MIND and SAR. The prior runtime value collapsed a
parent overview and a child-track target. The new guard detects repeated
child links rooted in the source entity path and keeps parent/child identity
non-equivalent unless the child is explicitly selected.

The resolver is deliberately source-local: unrelated navigation links labelled
“track”, “concentration”, or “specialization” do not trigger the guard.

An additional generic guard keeps a broad “MS or PhD programme” source
ambiguous, while allowing credential families such as BA/BMus when the source
defines them as variants of one named entity.

## 4. Tuition failures

Both MIT cases selected the same central undergraduate cost assertion:

```text
USD 33,360, per term, 2026–2027
```

The frozen V3 target requires an annual tuition representation. The previous
runtime accepted the per-term institutional amount as a concrete programme
tuition value. The new acceptance guard requires billing basis and rejects an
institution-wide term amount unless an annual amount/equivalent is explicitly
present. It does not treat cost of attendance, mandatory fees, room/board, or
the numerically closest fee as tuition.

The guard preserves dimensions for amount, currency, billing basis, academic
period/year, audience/residency, study load, degree level, fee type, and
programme scope. An insufficiently scoped amount remains a candidate for
review rather than becoming FOUND.

## 5. Major-admissions failure

The ETH Zurich candidate contained “qualifying disciplines listed
alphabetically”. It did not establish that the listed disciplines were a
programme-specific admission prerequisite. Other selected candidates were
application components or generic requirements. The new guard requires
explicit admission/eligibility/prerequisite/required semantics in applicable
programme context. Curriculum, application-component, recommendation-letter,
placement, graduation, or recommended-preparation text is not accepted as a
major admissions requirement.

## 6. Exact code changes

- Added [`identity_granularity.py`](../../services/data-ingestion/src/glowbal_ingestion/identity_granularity.py), a deterministic resolver for
  unit scope, pre-major stage, parent/child links, and mutually exclusive
  degree-level ambiguity.
- Integrated the resolver into `validation.fact_to_assertion`, so source-backed
  identity assertions retain provenance but carry a hard validation blocker
  when granularity is unresolved.
- Integrated the same resolver into runtime projection acceptance, including
  replay support for persisted raw source text.
- Tightened tuition acceptance in `runtime_acceptance.py` for billing basis and
  institution-wide term scope.
- Tightened major-admissions acceptance so a qualifying-discipline profile
  without explicit admission semantics cannot become FOUND.
- Added [`test_remediation9_quality.py`](../../services/data-ingestion/tests/test_remediation9_quality.py)
  with positive and negative tests for all three identity patterns, tuition
  scope, and admissions semantics.
- Added offline replay and targeted-smoke tooling:
  `scripts/replay_phase3f_remediation9.py` and
  `scripts/run_phase3f_remediation9_targeted_smoke.py`.

No provider, crawler, discovery, scorer, GT, or V3 methodology change was made.

## 7. Six-case offline replay

Run ID:
`phase3f-remediation9-six-failure-replay-20260906T090216Z`

The replay used sealed Run #4 assertions and persisted raw evidence only:

```text
provider calls       = 0
refetches            = 0
new URLs discovered  = 0
before incorrect FOUND = 6
after incorrect FOUND  = 0
after NEEDS_REVIEW     = 6
```

Replay artifacts:

- [`replay-output.json`](runs/phase3f-remediation9-six-failure-replay-20260906T090216Z/replay-output.json) — SHA-256 `c7f2e22038073997282878b8f4facd139ac30cf88013d0ee8ba3bbf7dc71cae3`
- [`six-case-comparison.jsonl`](runs/phase3f-remediation9-six-failure-replay-20260906T090216Z/six-case-comparison.jsonl) — SHA-256 `65daeb304e6f64bd8ba069a279f6896e93549452a2dc7a69592b925221b6842b`
- [`run-manifest.json`](runs/phase3f-remediation9-six-failure-replay-20260906T090216Z/run-manifest.json) — SHA-256 `c09e4f83f634ff61f298d6a838941e56a4bde35d7213de3ca686f006a54d5077`

An earlier replay artifact from before the source-local hierarchy refinement
is preserved and superseded; it was not used for the final result.

## 8. Previous-24 identity regression and ambiguity

The replay examined 25 non-target Run #4 identity FOUND controls:

```text
canonical-equivalent controls retained FOUND = 24/24
ambiguous identity GT-V2-21 retained concrete FOUND = 0/1
ambiguous identity GT-V2-21 became NEEDS_REVIEW = 1/1
```

Thus the three granularity guards did not regress the 24 identities already
accepted under frozen V3, and the ambiguity case did not become a concrete
PASS. The routing identity remains separate from factual programme identity.

## 9. Bounded targeted smoke

Run ID:
`phase3f-remediation9-targeted-smoke-20260906T090318Z`

This was intentionally an offline bounded smoke because all required raw and
assertion inputs were already persisted. It covered the six failure patterns,
two previously-correct identity controls, and the ambiguous identity control:

```text
programmes/cases attempted = 9
terminal                  = 9
unique persisted sources referenced = 10
new sources fetched       = 0
new URLs                  = 0
provider calls            = 0
candidate assertions      = 13
non-null candidates       = 13
accepted FOUND candidates = 2
FOUND                     = 2
NEEDS_REVIEW              = 7
CONFLICTING_SOURCES      = 0
ACCESS_BLOCKED            = 0
SOURCE_NOT_FOUND          = 0
NOT_EVALUATED            = 0
PARSE_FAILED              = 0
EXTRACTION_FAILED        = 0
```

The two concrete FOUND controls are `GT-V2-02-programme_identity` and
`GT-V2-05-programme_identity`; frozen V3 adjudication confirms both as
canonical-equivalent. Therefore targeted concrete precision is `2/2 = 100%`.
The six target failures have no concrete FOUND value, and the ambiguity case
is unresolved.

Artifacts:

- [`targeted-smoke.json`](runs/phase3f-remediation9-targeted-smoke-20260906T090318Z/targeted-smoke.json) — SHA-256 `40983b87eefad557f07490468906abc780d7b492890c9c3c015187c825b37c73`
- [`run-manifest.json`](runs/phase3f-remediation9-targeted-smoke-20260906T090318Z/run-manifest.json) — SHA-256 `65520a70a7eef3a0e70e96a95f336672f90514075089d98582e2dbe3bc967b7b`

## 10. Safety and regression results

The targeted replay/smoke produced zero concrete unsupported values. All seven
zero-tolerance counters are `0`:

```text
false-current critical                         = 0
fuzzy-only identity merge                     = 0
unresolved conflict promoted                  = 0
SOURCE_NOT_FOUND promoted                     = 0
STALE_ONLY promoted                           = 0
prohibited inferred high-volatility critical  = 0
PRODUCT_SAFE without durable provenance       = 0
```

The existing Remediation-4 seven-case and original six-P0 regression coverage
remains clean in the full ingestion suite; no safety case was reintroduced by
the new guards. `PRODUCT_SAFE` remains separate from runtime FOUND and was not
loosened.

## 11. Validation

```text
focused Remediation-9/runtime/Remediation-7 tests: 30 passed
full data-ingestion suite:                         363 passed
compileall:                                        PASS
JSON/JSONL validation and unique-case checks:       PASS
frozen V2/V3 and Run #1–#4 hashes:                 PASS
secret scan of new diagnostics/artifacts:           PASS
git diff --check:                                   PASS
```

The full suite includes the existing scorer, provider, projection, lifecycle,
identity, quality, and ingestion tests. No paid DeepSeek call was made during
this remediation.

## 12. Remaining P1 clusters

The six known incorrect FOUND values are eliminated without broad coverage
tuning. Benchmark-wide clusters reported by frozen V3 remain outside this task,
notably the existing `QUALITY_POLICY` and `FETCH` losses. They were not
relaxed or remediated here.

## 13. Readiness decision

The correctness gate is satisfied:

```text
six incorrect concrete FOUND values = 0
previous 24 identity controls = no regression
ambiguous identity = safely unresolved
targeted concrete precision = 100%
all seven safety counters = 0
provider calls/refetches/new URLs = 0
tests and integrity checks = PASS
```

Therefore:

```text
FULL BENCHMARK RUN #5 READY
```

This does not authorize or execute Benchmark #5. Slice F remains:

```text
NO-GO
```

The exact next action is to obtain explicit authorization before any later
Slice F gate; do not modify Benchmark V3 or run official benchmark #5 in this
task.
