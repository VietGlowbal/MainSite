# Phase 3F — Acceptance Remediation 7

Status: **FULL BENCHMARK RUN #4 BLOCKED**  
Slice F: **NO-GO**  
Official benchmark #4 was not run.

## 1. Scope and integrity

This remediation used the sealed official run #3 only for post-seal diagnosis:

`phase3f-v2-run-20260905T030109Z`

The frozen truth, roster, scorer, scorer contract, official runs #1–#3, and
previous remediation smoke artifacts were not edited. The pipeline did not
receive truth, expected values, review decisions, or scorer output. The
acceptance diagnostic reads truth only after the sealed runtime artifacts are
complete.

Frozen SHA-256 verification:

| Artifact | SHA-256 | Result |
|---|---|---|
| Frozen truth | `97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4` | PASS |
| Frozen roster | `7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139` | PASS |
| Scorer contract Markdown | `47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91` | PASS |
| Machine contract | `720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99` | PASS |
| Official run #3 output | `ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad92f39af1a90a8c` | PASS |

The sealed acceptance matrix is at
`docs/benchmarks/runs/phase3f-v2-run-20260905T030109Z/run3-field-evidence-audit.jsonl`.
The reusable post-seal trace tool is
`scripts/audit_phase3f_acceptance.py`.

## 2. 83-case direct-support acceptance matrix

The matrix contains 83 resolved truth cases with direct supporting evidence
already fetched. The strict direct-support population is:

| Field | Direct-support cases |
|---|---:|
| `programme_identity` | 25 |
| `credential` | 25 |
| `english_requirement` | 13 |
| `major_admissions_requirement` | 13 |
| `tuition` | 6 |
| `application_deadline` | 1 |
| `programme_status` | 0 |
| **Total** | **83** |

Source family distribution was 63 programme-specific official, 19 central or
specialist official, and 1 other official source. There were 83 direct cases,
21 fetched-but-ambiguous cases, and 18 absent/blocked cases. Thus diagnostic
field-evidence availability is 104/122 (85.25%) when ambiguous fetched
material is included; strict direct support is 83/122 (68.03%).

`DIRECT_SUPPORT_ACCEPTANCE_RATE` for sealed run #3 is **0/83 = 0%**: no
direct-support case reached runtime `FOUND` in the sealed projection.

### Stage-by-stage disposition

| Stage | Entered | Passed | Failed |
|---|---:|---:|---:|
| Direct support | 83 | 83 | 0 |
| Candidate assertion created | 83 | 28 | 55 |
| Candidate value non-null | 83 | 27 | 56 |
| Candidate selected | 83 | 27 | 56 |
| Applicability | 83 | 2 | 81 |
| Temporal | 83 | 0 | 83 |
| Conflict | 83 | 63 | 20 |
| Quality acceptance | 83 | 0 | 83 |
| Runtime FOUND | 83 | 0 | 83 |

The first blocking stages were:

| First blocker | Cases |
|---|---:|
| `ASSERTION_NOT_CREATED` | 55 |
| `CONFLICT` | 16 |
| `QUALITY_HARD_BLOCKER` | 8 |
| `TEMPORAL` | 2 |
| `FIELD_SEMANTICS_OR_APPLICABILITY` | 1 |
| `ASSERTION_VALUE_MISSING` | 1 |

The 55 assertion-creation failures are systemic: `DEEP_FIELDS` and the
extraction groups do not contain `programme_identity` or `credential`, while
manual benchmark URLs deliberately start with no credential to prevent roster
leakage. The remaining three missing-candidate cases are one English,
one deadline, and three major-admissions cases represented by source material
that never became a usable runtime assertion. This is a downstream plumbing/
coverage issue, not evidence that the direct source was absent.

The main acceptance reason occurrences were:

| Reason | Occurrences |
|---|---:|
| `TEMPORAL_SCOPE_UNPROVEN` | 69 |
| `PROGRAMME_ADMISSION_SCOPE_UNPROVEN` | 29 |
| `SOURCE_EXCERPT_ONLY` | 25 |
| `PROGRAMME_SCOPE_UNPROVEN` | 23 |
| `APPLICABILITY_EVIDENCE_FIELD_MISMATCH` | 22 |
| `TARGET_CYCLE_MISMATCH` | 12 |
| `AUDIENCE_MISMATCH` | 11 |
| `TUITION_SEMANTICS_NOT_IN_EVIDENCE` | 13 |
| `TUITION_NOT_STRUCTURED` | 2 |
| `LANGUAGE_FIELD_SEMANTICS_MISMATCH` | 1 |

Reasons can overlap within a candidate; these are not unique-case counts.

## 3. Hard, soft, and promotion-only blockers

The acceptance contract is now explicit:

| Class | Examples | Runtime result |
|---|---|---|
| `HARD_RUNTIME` | wrong programme/field/scope, wrong audience or cycle, stale-only claim, unsupported inference, material same-scope conflict | suppress value to `NEEDS_REVIEW/null` or retain the operational/conflict state |
| `SOFT_PRODUCT` | identity unresolved for product publication, review required for publication, missing durable raw lineage, insufficient authority for Product Safety | retain `FOUND/value` when the factual claim is supported; keep `PRODUCT_SAFE=false` and blocker metadata |
| `PROMOTION_ONLY` | canonical promotion blocked after factual resolution | retain `FOUND/value`; set promotion false |

`MISSING_CRITICAL_FIELD` is terminal/product metadata when attached to an
unresolved field; it is not a reason to suppress a supported candidate by
itself. A factual source-scope, temporal, semantic, or same-scope conflict
remains hard.

The key separation is:

```text
runtime factual resolution != PRODUCT_SAFE eligibility != canonical promotion
```

## 4. Twelve representative suppressed traces

These are concise projections of the full trace matrix. The full candidate,
selector, source, applicability, temporal, conflict, and final-state details
are in the JSONL artifact above.

| Case | Field | Candidate/non-null | First blocker | Main reason | Final state |
|---|---|---:|---|---|---|
| `GT-V2-01-programme_identity` | programme identity | 0/0 | `ASSERTION_NOT_CREATED` | no identity assertion group | `NEEDS_REVIEW` |
| `GT-V2-02-credential` | credential | 0/0 | `ASSERTION_NOT_CREATED` | no credential assertion group | `NEEDS_REVIEW` |
| `GT-V2-03-programme_identity` | programme identity | 0/0 | `ASSERTION_NOT_CREATED` | no identity assertion group | `NEEDS_REVIEW` |
| `GT-V2-04-english_requirement` | English | 4/2 | `QUALITY_HARD_BLOCKER` | excerpt-only, scope/temporal | `NEEDS_REVIEW` |
| `GT-V2-07-english_requirement` | English | 4/2 | `QUALITY_HARD_BLOCKER` | excerpt-only, scope/temporal | `NEEDS_REVIEW` |
| `GT-V2-10-major_admissions_requirement` | major admissions | 9/4 | `CONFLICT` | admission scope/temporal; tied candidates | `NEEDS_REVIEW` |
| `GT-V2-16-major_admissions_requirement` | major admissions | 9/6 | `CONFLICT` | admission scope/temporal; tied candidates | `NEEDS_REVIEW` |
| `GT-V2-20-major_admissions_requirement` | major admissions | 9/4 | `CONFLICT` | field applicability mismatch | `NEEDS_REVIEW` |
| `GT-V2-04-tuition` | tuition | 13/13 | `CONFLICT` | fee semantics/cycle/scope | `CONFLICTING_SOURCES` |
| `GT-V2-07-tuition` | tuition | 2/1 | `CONFLICT` | unstructured/undated tuition | `CONFLICTING_SOURCES` |
| `GT-V2-27-application_deadline` | deadline | 0/0 | `ASSERTION_NOT_CREATED` | source did not produce deadline assertion | `CONFLICTING_SOURCES` |
| `GT-V2-26-major_admissions_requirement` | major admissions | 0/0 | `ASSERTION_NOT_CREATED` | no runtime field assertion | `CONFLICTING_SOURCES` |

No `programme_status` direct-support case exists in the 122 resolved truth
population; status remains conservative and is not inferred from page
existence.

## 5. Ambiguous evidence and upstream cases

The 21 `EVIDENCE_FETCHED_BUT_AMBIGUOUS` cases were kept separate and were not
forced to `FOUND`. Their field distribution is 5 programme identity, 4
tuition, 4 English, 4 major admissions, 3 application deadline, and 1
credential. The ambiguity sources are unresolved programme relationship,
temporal scope, field semantics, or multiple candidate values.

The 18 absent/blocked cases remain upstream and were not acceptance-tuned:
14 were `DOCUMENT_NOT_DISCOVERED` and 4 were access-blocked. Across all 122
resolved cases, the completed source audit classified 28 upstream and 94
downstream cases. The diagnostic subcategories were:

| Subcategory | Cases |
|---|---:|
| Expected/related supporting source not fetched | 14 |
| Source access blocked or fetch failed | 4 |
| Fetched field context requiring downstream semantic processing | 11 |
| Fetched field-relevant but support not proven | 6 |
| Fetched candidate source insufficient for field | 4 |
| Supported evidence fetched but not resolved/projected | 83 |

## 6. Field-specific acceptance findings

All seven benchmark fields now have positive test paths. Tests cover direct
programme identity and credential projection, explicit current programme
status, structured tuition, programme/current-cycle deadline, minimum English
admission requirement, and explicit major admission prerequisites.

Negative paths remain hard: COA is not tuition, registration is not an
application deadline, taught-in-English is not a language admission minimum,
recommended scores are not minimums, curriculum/post-admission requirements
are not major admission requirements, and institution-domain coincidence does
not prove applicability.

The acceptance helper requires factual evidence and does not require
`PRODUCT_SAFE=true` or canonical promotion. For volatile claims, a model-only
cycle in `value_json` is not temporal evidence; the cycle must be present in
assertion metadata and matched by the evidence locator. This guard caught and
removed a temporary `GT-V2-02-tuition` false-current regression in an
intermediate smoke.

The audience helper supports compound labels such as `graduate
international`, while preserving domestic/international mismatch. Conflict
scope is per routed entity and field; a conflict for one programme no longer
suppresses the same field for every programme.

## 7. Code changes

- `scripts/audit_phase3f_acceptance.py`: reusable post-seal 83-case acceptance
  matrix and stage/first-blocker trace; no runtime truth access.
- `scripts/run_phase3f_v3_benchmark.py`: entity-scoped unresolved conflict
  projection and compound-audience matching.
- `services/data-ingestion/src/glowbal_ingestion/runtime_acceptance.py`:
  conservative evidence-backed temporal acceptance and compound-audience
  matching.
- `services/data-ingestion/src/glowbal_ingestion/conflicts.py`: matching
  compound audience dimensions without creating false conflicts.
- `services/data-ingestion/tests/test_remediation_smoke.py`: regression that
  an unrelated programme conflict cannot suppress a valid field.
- `services/data-ingestion/tests/test_remediation7_acceptance.py`: positive
  and negative field acceptance, soft-product separation, temporal and
  audience guards, and conflict tests.

No truth, scorer, scorer contract, threshold, or sealed official run was
changed.

## 8. Targeted smoke

The final diagnostic smoke used the same 12-row composition after the cycle
guard fix:

```text
1, 2, 3, 4, 6, 10, 11, 15, 16, 22, 26, 28
```

Run ID:
`phase3f-remediation7-acceptance-12prog-20260905T110000Z`

It sealed 12/12 programme records. The earlier 08:07 smoke is preserved; the
10:00 smoke is also preserved but is explicitly not the final verification
because it preceded the cycle-only safety guard and emitted one known
false-current case. Neither artifact was overwritten.

### Final smoke metrics

| Metric | Result |
|---|---:|
| Programmes attempted/terminal | 12/12 |
| Sources fetched | 135 |
| HTML/PDF sources | 128/7 |
| Parser non-empty | 135/135 |
| Field assertions / non-null metric | 598/265 |
| Effective assertion file / non-null | 457/264 |
| `FOUND/value` | 3 |
| `NEEDS_REVIEW/null` | 70 |
| `ACCESS_BLOCKED` | 10 |
| `CONFLICTING_SOURCES` | 1 |
| `NOT_EVALUATED` | 0 |
| `PARSE_FAILED` | 0 |
| `EXTRACTION_FAILED` | 0 |
| `PRODUCT_SAFE` | 0 |

The three FOUND records are two MIT tuition claims and one ETH Zurich major
admissions claim. Each has an official source, raw reference, assertion
reference, and deterministic evidence-entailment marker. They remain
`PRODUCT_SAFE=false` because the smoke uses local raw evidence and retains
identity/review/provenance blockers.

The direct-support acceptance target is not met by this diagnostic smoke:
FOUND is 3, across only tuition and major-admissions (2 families), below the
required 5 values across 3 families. This is why run #4 remains blocked.

### Provider and execution metrics

| Metric | Result |
|---|---:|
| Provider/model | `deepseek` / `deepseek-v4-flash` |
| Endpoint | `https://api.deepseek.com` |
| Logical requests / attempts | 100/100 |
| Successful calls | 100 |
| Terminal group failures | 1 |
| HTTP 429 / retries | 0/0 |
| Prompt/completion tokens | 824,832 / 108,977 |
| Total tokens | 933,809 |
| Cost | unavailable |

One terminal provider group failure was a structured-output validation error
(`document_type` invalid) for the generic `Admission E.Shtml` input. It did
not become `PARSE_FAILED`; no final projection was mislabeled as a parser
failure. No secret was logged.

## 9. Safety regression audit

All seven Remediation-4 cases are present in the final 12-row smoke and remain
safe:

| Case | Runtime state | Concrete value | Result |
|---|---|---:|---|
| `GT-V2-01-major_admissions_requirement` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-02-major_admissions_requirement` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-02-tuition` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-15-application_deadline` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-15-major_admissions_requirement` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-22-english_requirement` | `NEEDS_REVIEW` | no | PASS |
| `GT-V2-22-major_admissions_requirement` | `NEEDS_REVIEW` | no | PASS |

Original P0 cases present in the smoke (`GT-V2-15-credential` and
`GT-V2-22-credential`) remain `NEEDS_REVIEW/null`. The original cases for rows
9, 23, and 27 were not in this 12-row smoke; their sealed run/replay
regression coverage was not changed and no new runtime special case was
added.

The seven zero-tolerance counters for the final smoke are all zero:

```text
false-current critical                         0
fuzzy-only identity merge                      0
unresolved conflict promoted                   0
SOURCE_NOT_FOUND promoted                      0
STALE_ONLY promoted                             0
prohibited inferred high-volatility promotion  0
PRODUCT_SAFE without durable provenance        0
```

Every final FOUND record passed the deterministic evidence-link audit. No
PRODUCT_SAFE record was emitted, so Product Safety entailment is
**unavailable**, not a claimed 100% pass.

## 10. Validation

| Check | Result |
|---|---|
| Acceptance/runtime focused tests | PASS — 46 tests |
| Core ingestion suite | PASS — 344 tests |
| Benchmark scorer/preflight | PASS; scorer unchanged |
| Compileall | PASS |
| JSON/JSONL/schema parse | PASS for final artifacts |
| Frozen truth/roster/contract hashes | PASS |
| Official run #1/#2/#3 sealed output hashes | PASS |
| Secret scan | PASS; no credential-like matches |
| `git diff --check` | PASS; Git emitted only existing line-ending warnings |

The final smoke output is sealed at
`docs/benchmarks/runs/phase3f-remediation7-acceptance-12prog-20260905T110000Z/pipeline-output.json`.

SHA-256:

`6d665f66b9527f9029211798467dac9ead5e117316799b9f78537cd4c6adc836`

Manifest:
`docs/benchmarks/runs/phase3f-remediation7-acceptance-12prog-20260905T110000Z/run-manifest.json`

The aborted user-interrupted smoke
`phase3f-remediation7-acceptance-12prog-20260905T083900Z` remains marked
`ABORTED_BY_USER` and was not used. The intermediate pre-guard smoke
`phase3f-remediation7-acceptance-12prog-20260905T100000Z` remains immutable and
was not used as final verification.

## 11. Remaining blockers and readiness

The dominant problem remains **ACCEPTANCE_DOMINANT**, supported by 94
downstream versus 28 upstream resolved-case diagnoses. The smallest remaining
systemic clusters are:

1. Add a source-backed, conservative runtime lifecycle for programme identity
   and credential; current extraction groups intentionally omit both, leaving
   50 direct-support cases without assertions. This must preserve ambiguous
   native awards and the six original credential P0 safeguards.
2. Improve field-specific applicability/temporal evidence propagation for
   English, deadlines, and major-admissions assertions without accepting
   institution-wide, excerpt-only, stale, or wrong-audience claims.
3. Keep genuine same-scope conflicts unresolved while preventing duplicate or
   different-scope candidates from becoming artificial conflicts.

`FULL BENCHMARK RUN #4 READY`: **NO**. It is blocked because the final smoke
has only 3 FOUND values across 2 field families, and the direct-support
acceptance rate in sealed run #3 remains 0/83. All safety checks are clean, but
the coverage/readiness requirement is not met.

Slice F remains **NO-GO**. No official benchmark #4, later runtime gates,
failure matrix, schema/RLS gate, final regression, review, or rollout was run.
