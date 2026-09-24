# Phase 3F Benchmark V3 Scorer Contract v2

Status: **FROZEN BEFORE Benchmark V3 OFFLINE RESCORE**
Contract version: `phase-3f-scorer-contract/v2`
Benchmark version: `phase3f-v3`
Truth version: `phase-3f-ground-truth-v3-frozen`

This contract is fixed before any real v3 benchmark output is inspected. The
scorer compares a frozen reference artifact with a separately produced,
normalized output artifact. It does not crawl, fetch, parse, extract, call the
v3 pipeline, modify truth, write the product catalogue, or promote data.

## Inputs and isolation

The frozen inputs are:

- truth: `docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl`
- roster: `docs/benchmarks/2026-08-30-phase-3f-roster-v2.md`
- freeze manifest: `docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json`
- machine contract: `docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json`

The scorer accepts only the normalized output schema
`phase3f-v3-benchmark-output/v1`. A future run must be finalized before its
output is passed to the scorer. Benchmark execution must not pass truth,
review decisions, expected values, the manifest, or this contract to
`AcquisitionPlanner`, `SourceResolver`, fetchers, parsers,
`ExtractionProvider`, coverage, recovery, inference, promotion, or product
read paths. The scorer receives output only after those paths have completed.
Each normalized record identifies its `case_id` and runtime `state`; when a
semantic `normalized_value` is available it is compared against the frozen
truth normalization, otherwise only exact conservative comparison with the
reviewed value is allowed. A product-safe record must also carry an explicit
resolved identity object and durable evidence metadata.

Future run identifiers use `phase3f-v2-run-<timestamp-or-id>`. A run manifest
records the code revision, truth version/manifest, pipeline and provider
configuration, runtime environment, timestamp, and programme count. It must
not contain API keys or other secrets.

## Frozen truth and scoreability

The complete truth artifact contains 252 records and is immutable by version:

- 246 `REVIEWED_CONFIRMED` records are the primary scoreable set.
- 6 `REVIEWED_AMBIGUOUS` records remain in the artifact and in reports but are
  excluded from primary precision, recall, and value-accuracy denominators.
- 0 `UNREVIEWED` records are permitted.

The ambiguous IDs are:

```text
GT-V2-05-tuition
GT-V2-05-major_admissions_requirement
GT-V2-06-tuition
GT-V2-11-major_admissions_requirement
GT-V2-12-tuition
GT-V2-13-major_admissions_requirement
```

Ambiguous cases are reported with `GROUND_TRUTH_AMBIGUOUS`; they are not
silently treated as passes, failures, absent truth, or `NEEDS_REVIEW` truth.

Among the 246 primary cases, 118 have truth state `FOUND`, 124 have
`REVIEWED_CONFIRMED + NEEDS_REVIEW + null`, and 4 have `NOT_REQUIRED`.
`NOT_REQUIRED`/`NOT_PUBLISHED` state assertions are compared as non-value
runtime states; explanatory text retained in a truth row's `expected_value`
does not become a runtime value requirement.
Confirmed `NEEDS_REVIEW/null` is a deliberate, scoreable safe-unresolved
truth state, not missing data.

Only runtime `NEEDS_REVIEW` with a null/empty value is compatible with that
truth state. A concrete value in any other runtime state is a promotion and is
counted as a false-current critical event, even if the record is not marked
`PRODUCT_SAFE`.

## State comparison

Truth and runtime state are independent dimensions. The normalized runtime
state vocabulary is:

```text
NOT_EVALUATED, FOUND, NOT_PUBLISHED, NOT_REQUIRED, SOURCE_NOT_FOUND,
ACCESS_BLOCKED, FETCH_FAILED, PARSE_FAILED, EXTRACTION_FAILED, STALE_ONLY,
CONFLICTING_SOURCES, NEEDS_REVIEW
```

| Truth state | Required safe comparison | Coverage / error treatment |
|---|---|---|
| `FOUND` | Runtime `FOUND` and conservative field-aware value match | Any other runtime state is a coverage loss, classified by its failure state; a wrong resolved value is a truth failure. |
| `NEEDS_REVIEW` with null | Runtime `NEEDS_REVIEW`, no value, and no product-safe promotion | Passes safe-unresolved correctness. Fetch, parse, extraction, source, stale, conflict, or not-evaluated states are coverage/operational losses, not fabricated facts. |
| `NEEDS_REVIEW` with concrete value | No concrete value may be promoted as resolved truth | Fails quality/promotion safety; `PRODUCT_SAFE` is also a false-current failure. |
| `NOT_REQUIRED` | Runtime `NOT_REQUIRED` with no value | Other resolved states are value/state errors; abstention is coverage loss. |
| `NOT_PUBLISHED` | Runtime `NOT_PUBLISHED` with no value | Other resolved states are value/state errors; abstention is coverage loss. |
| `REVIEWED_AMBIGUOUS` | No primary comparison | Excluded and reported separately. |

`FETCH_FAILED`, `SOURCE_NOT_FOUND`, `PARSE_FAILED`, `EXTRACTION_FAILED`,
`STALE_ONLY`, and `CONFLICTING_SOURCES` are never automatically accepted as
truth merely because they avoid fabrication. Safe abstention, truth
correctness, coverage, operational reliability, and product safety are
reported separately.

## Value comparison

Comparison is deterministic and conservative. Unicode NFKC normalization,
case-folding, and whitespace folding are allowed; fuzzy similarity,
translation inference, substring overlap, and post-hoc thresholds are not.
An output cannot claim a comparison pass in its own metadata.

The seven critical fields are compared with these rules:

- `programme_identity`: exact normalized value plus identity guards. Wrong
  programme, track, stage, delivery mode, partner/joint programme, or merge is
  an identity failure. Similar titles do not pass.
- `credential`: exact institutional/source-native or explicitly reviewed
  normalized value. `B.S.E.`, `BS`, `MSc`, `Master`, `Licence`, and `Maîtrise`
  are not interchangeable by translation alone.
- `programme_status`: exact state/value semantics; page presence does not
  imply `ACTIVE`.
- `tuition`: amount, currency, period, fee type, student category, residency,
  programme scope, and cycle are distinct when structured. Registration,
  admission, examination, insurance, fees, cost of attendance, and deposits
  cannot satisfy tuition.
- `application_deadline`: date, deadline type, entry term/year, cycle,
  applicant category, programme scope, and timezone are distinct. Exam,
  registration, document, language-proof, and partner deadlines cannot satisfy
  an application deadline.
- `english_requirement`: required/conditional semantics, applicant scope,
  tests, thresholds, validity, exemptions, central policy, and programme
  overrides remain separate. Generic test submission does not create a
  numeric threshold.
- `major_admissions_requirement`: structured propositions are compared only
  when represented as structured truth; otherwise exact normalized text is
  used. Eligibility, prerequisites, selection, application documents,
  interviews, research plans, later declaration, curriculum, and completion
  requirements are not collapsed.

Long prose is not scored by similarity. If a future adapter cannot provide an
unambiguous structured proposition, it must emit a review-required result or
an exact source-supported value rather than relying on permissive text
matching.

For tuition and deadlines, optional output metadata such as fee/deadline type,
cycle, audience, residency, category, and programme scope is checked when
present; an explicit incompatible type is a failure. For English and
admissions requirements, required/conditional semantics, tests/thresholds,
waivers, applicant scope, prerequisites, documents, selection, and completion
propositions remain distinct. A field or identity mismatch takes precedence
over any text similarity; fuzzy-only matching is never a passing path.

## Confirmed unresolved truth

For `REVIEWED_CONFIRMED + NEEDS_REVIEW + null`, a prediction passes only when
it explicitly remains unresolved (`NEEDS_REVIEW`) with no value and is not
marked `PRODUCT_SAFE`. This includes the 124 confirmed unresolved cases.
`NOT_EVALUATED` and transport/parser failures are not safe-unresolved passes:
they are separately counted coverage or operational losses. A candidate
value that is not product-safe is still a quality-policy failure; a concrete
current/product-safe value is a false-current and promotion failure.

## Product-safety contract

The scorer reuses the canonical product-safety vocabulary from
`glowbal_ingestion.product_safety` (`ProductLifecycleState` and `BLOCKERS`).
For a record marked `PRODUCT_SAFE`, all of the following are required:

- resolved state (`FOUND`, `NOT_REQUIRED`, or `NOT_PUBLISHED`);
- an explicit identity object with `resolved=true` (or a `RESOLVED`/`CREATED`
  resolution state);
- durable provenance with non-empty assertion and raw-document IDs;
- provenance explicitly supports the promoted claim;
- an acceptable official/government/official-partner authority;
- no inferred value, required review, unresolved conflict, stale critical
  evidence, unknown applicability, source failure, or retired state;
- `CURRENT` temporal state for high-volatility benchmark fields;
- truth does not require review for the promoted value.

Violations are reported with the canonical blocker vocabulary and contribute
to the corresponding product-safety metrics. Evidence entailment is
deterministically checked for durable lineage, assertion linkage, authority,
applicability, temporal state, and blockers. Semantic entailment that cannot
be established mechanically is marked review-required; it is not awarded by
weak string similarity. An acquisition-layer `RAW_PERSIST_FAILED` code maps to
canonical `RAW_LINEAGE_MISSING`; it never creates a benchmark-only Product
Safety blocker vocabulary.

## Denominators and metrics

Denominators are fixed before benchmark execution:

- all reviewed cases: 252;
- primary scoreable cases: 246;
- ambiguous cases: 6, excluded from primary value/state denominators;
- truth `FOUND`: 118 primary cases;
- confirmed truth `NEEDS_REVIEW/null`: 124 primary cases;
- truth `NOT_REQUIRED`: 4 primary cases;
- resolved prediction denominator: primary output records in a resolved state;
- safe-unresolved denominator: all 124 confirmed `NEEDS_REVIEW/null` cases;
- product-safe entailment denominator: primary output records marked
  `PRODUCT_SAFE`.

Safe abstention is not a false factual assertion. It can pass safe-unresolved
correctness for unresolved truth while lowering resolved coverage when a
resolved `FOUND` truth case is not resolved. Incorrect accepted values count
against precision; missing or safely abstained outputs count against coverage
or recall as defined above.
`false-current critical` counts any non-empty value emitted for a confirmed
`NEEDS_REVIEW/null` case outside runtime `NEEDS_REVIEW`, plus product-safe
promotion of that truth. It is independent of the precision denominator.

The locked target thresholds are:

| Metric | Threshold |
|---|---:|
| Programme discovery recall | >= 90% |
| Programme discovery recall, each institution | >= 80% |
| Required-source discovery recall | >= 90% |
| Critical-field precision | >= 98% |
| Reviewed `PRODUCT_SAFE` evidence entailment | 100% |
| False-current critical count | 0 |
| Fuzzy-only auto-merge count | 0 |
| Critical unresolved-conflict promotion count | 0 |
| Critical `SOURCE_NOT_FOUND` promotion count | 0 |
| Critical `STALE_ONLY` promotion count | 0 |
| Prohibited high-volatility inferred-critical promotion count | 0 |
| `PRODUCT_SAFE` without durable provenance | 0 |

The scorer reports discovery metrics as `NOT_AVAILABLE` until the normalized
output contains the run-level `discovery.programme_keys` and
`discovery.required_source_keys` sets. Their fixed denominator is 36 roster
rows, represented as `roster-v2-row-1` through `roster-v2-row-36`.

## Error taxonomy

Each failure receives a primary class where possible. The locked taxonomy is:

```text
DISCOVERY
SOURCE_SELECTION
FETCH
PARSING
EXTRACTION
APPLICABILITY
TEMPORAL
CONFLICT
RECOVERY
IDENTITY
QUALITY_POLICY
PROMOTION
GROUND_TRUTH_AMBIGUOUS
```

Secondary tags may be reported, but taxonomy or threshold changes require a
new explicitly approved contract version.

## Checksums and fail-closed behavior

The freeze manifest records SHA-256 digests for the exact frozen truth JSONL,
the frozen roster, and this Markdown contract (and also records the machine
contract digest). At score time all four digests are checked against the
manifest, including the exact machine contract path supplied to the scorer.
Any mismatch, parse error, duplicate ID, status mismatch, or unreviewed record
fails closed and refuses scoring.

The frozen truth is a new immutable version with lineage to the reviewed
working JSONL. The working reviewed artifact is not rewritten as part of
scoring. A changed truth requires a new version, new manifest, and new
contract approval; it cannot be edited in place after this gate.

## Benchmark gate status

This contract locks methodology before real output exists. Unit tests and a
synthetic preflight may use truth-derived fixtures inside scorer tests only.
No such fixture is passed to the v3 pipeline. The actual v3 benchmark is
`NOT RUN` under this gate. Node 22.15.0 remains the user-selected runtime;
Node 24.19.x verification is `DEFERRED / UNVERIFIED`.


## Programme identity Contract v2

This version supersedes the V1 flat-string `programme_identity` comparison while
leaving every non-identity field rule and every quality threshold unchanged.
The compared identity is structured as institution, canonical programme entity,
entity type, credential, degree level, parent/child relationship, stage, joint
or dual semantics, and officially evidenced aliases. Source-native identity is
retained separately from the canonical comparison form.

The only passing identity classes are `EXACT_EQUIVALENT`,
`CANONICALLY_EQUIVALENT`, `OFFICIAL_ALIAS_EQUIVALENT`, and
`CREDENTIAL_AWARE_EQUIVALENT`. Credential separation is allowed only when the
same underlying academic entity is established. Parent/child, programme/track,
programme/major at different target granularity, pre-major/final-major,
joint/component, and dual/single distinctions do not pass automatically.

Official alias or official translation provenance is mandatory. Unicode/case,
whitespace, punctuation, and proven credential separation are deterministic
normalizations. Fuzzy similarity, substring overlap, model-generated
translation, and common-name intuition can never produce a pass.

`AMBIGUOUS` is a generic comparison result when official evidence does not
select one defensible canonical identity. It is excluded from concrete identity
precision denominator and numerator, reported separately, and counted as
unresolved for resolved-coverage reporting. It is not silently converted into
PASS or FAIL, and it does not alter the six frozen `REVIEWED_AMBIGUOUS` truth
records used by the overall benchmark denominator.

## Freeze boundary

This contract was finalized, schema-validated, and hashed before the sealed
Run #4 V3 offline rescore. It must not be revised in response to that rescore;
any later methodology change requires a new Benchmark V4.
