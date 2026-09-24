# External provider scale repair report - 2026-09-14

This report covers the frozen external-only population and the targeted
streaming/read corrections.  It does not add providers, change acceptance,
hierarchy, uncertainty, or storage architecture.  The official-web paths were
not used for this measurement.

## A. Population and execution

The frozen manifest contains 23 institutions and 46 programmes in five
countries: US (5/10), CH (5/10), FR (5/10), UK (4/8), and NL (4/8), where the
pair is institutions/programmes.  It contains 25 bachelor and 21 master
programmes across computer science (22), data science (10), engineering (5),
and other disciplines (9).

The consolidated view combines the immutable scale run with only the bounded
DUO, Onisep, and Scorecard correction outputs:

| provider | targets | exact matches | raw sources persisted | source rows/materialisations | semantic proposals | accepted | review |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| College Scorecard | 5 institutions | 5 UNITIDs | 10* | 9 / 9 | 20 | 6 rows (2 institutions) | 14 |
| swissuniversities | 5 institutions | 5 | 5 | 5 / 5 | 15 | 15 | 0 |
| Onisep Idéo | 10 programmes | 10 | 30* | 15 / 15 | 8 | 8 | 0 |
| Discover Uni | 8 programmes | 6 | 6 | 6 / 6 | 61 | 56 | 5 |
| DUO RIO | 8 programmes | 8 | 8 | 8 / 8 | 16 | 16 | 0 |

\* Consolidated raw counts include the historical failed object/event retained
for audit plus the correction objects.  The corrected replays themselves
persisted five Scorecard and fifteen Onisep raw objects with no unresolved
fetch error.

## B. Streaming/read fixes

### Onisep Idéo

The exact failing stage was `ParserRegistry.parse_stream`, before CSV row
iteration.  The CSV parser implemented byte parsing but did not implement the
durable streaming entry point, so the registry raised `ParserError` and the
pipeline recorded `STREAMING_PARSE_FAILED` after the raw object had already
been persisted.  This was a parser capability defect, not missing Onisep data.

The reusable fix adds bounded streaming CSV parsing with BOM/encoding handling,
delimiter detection, quoted and multiline fields, short-read tolerance, exact
compound identifier matching, and bounded row/byte retention.  It keeps the
remote range/object stream and does not create a full local raw copy
(`max_local_temp_bytes=0`).

The correction replay (`runs/external-field-scale-20260914-onisep-correction-c`)
persisted 15 raw objects, produced 15 source rows/materialisations, and had no
crawl error.  Ten programme identifiers matched exactly.  The effective
semantic result was eight accepted OBSERVED assertions: three programme
identities, three credentials, and two explicit tuition values.  The same ten
matched records also yielded 10 duration, 10 location/campus, and 10
delivery-mode metadata rows.  Empty or context-insufficient cells were not
invented.  The `AF date de modification` value is retained as a record-update
context, not converted into an academic cycle.

### College Scorecard

The Cornell failure was at the durable bounded object read, before the exact
`UNITID=190415` row could be materialised.  It was separate from the Onisep
parser-capability defect: a transient range-read error was propagated as
`RAW_STREAM_READ_FAILED`.  Investigation also found that ZIP's shared reader
performs no-op seeks; clearing read-ahead on those seeks caused excessive
remote reads.  The reusable fix retries transient range failures with bounded
backoff and preserves prefetch on a no-op seek while still clearing it on a
real reposition.  UNITID matching and `academic_cycle=null` semantics are
unchanged.

The correction replay (`runs/external-field-scale-20260914-scorecard-correction-b`)
read and materialised all five exact UNITIDs (Cornell 190415, MIT 166683,
Harvard 166027, Stanford 243744, Berkeley 110635), with five structured-row
materialisations and no runtime error.  Cornell's row contains USD 59,282
annual in-state and USD 59,282 annual out-of-state tuition.  It remains review
only for programme fallback because the source is institution scoped and the
source snapshot has no academic cycle/fee-period proof; no academic cycle was
fabricated.  The consolidated semantic result is six accepted institution
tuition rows (two distinct accepted target institutions: MIT and Stanford) and
14 review rows, including nine programme-scope review slots.

## C. Consolidated accepted external coverage

There are 101 accepted semantic assertions (21 institution scoped and 80
programme scoped), 19 review assertions, and 62 promoted deterministic
programme metadata rows.  Accepted semantic assertions by provider/field are:

| provider | field | scope | accepted rows |
| --- | --- | --- | ---: |
| Scorecard | tuition | institution | 6 rows / 2 target institutions |
| swissuniversities | tuition | institution | 5 |
| swissuniversities | additional fees | institution | 5 |
| Onisep | programme identity | programme | 3 |
| Onisep | credential | programme | 3 |
| Onisep | tuition | programme | 2 |
| Discover Uni | identity, credential, focus, curriculum, learning, career, employment | programme | 56 |
| DUO RIO | identity, credential | programme | 16 |

Accepted target-slot coverage (46 programmes, 23 institutions) is:

| field | accepted coverage | review coverage | external source/scope |
| --- | ---: | ---: | --- |
| programme identity | 17/46 (36.96%) | 0 | FR/UK/NL programme |
| credential | 17/46 (36.96%) | 0 | FR/UK/NL programme |
| tuition | 2/46 (4.35%) programme; 7/23 (30.43%) institution | 9/46 programme | Onisep programme; Swiss/Scorecard institution |
| additional/compulsory fees | 0/46 programme; 5/23 (21.74%) institution | 0 | swissuniversities institution |
| duration | 16/46 (34.78%) | 0 | Onisep 10 + Discover Uni 6 metadata |
| location | 16/46 (34.78%) | 0 | Onisep 10 + Discover Uni 6 metadata |
| delivery mode | 23/46 (50.00%) | 0 | Onisep 10 + Discover Uni 6 + DUO 7 metadata |
| programme language | 7/46 (15.22%) | 0 | DUO RIO metadata |
| career outcomes | 3/46 (6.52%) | 0 | Discover Uni |
| employment outcomes | 2/46 (4.35%) | 1/46 review | Discover Uni |

The externally supported priority groups that remain zero in this run are
deadlines/intakes, application fees, language thresholds (IELTS/TOEFL/
Duolingo), minimum degree/GPA/prerequisites, required documents,
recommendations/SOP/portfolio/work experience, scholarships, and funding.
Programme status and academic-cycle assertions are also zero; source-native
dates/context remain preserved without unsupported remapping.

## D. Country/provider/scope and hierarchy

Accepted evidence is institution scoped 21 rows and programme scoped 80 rows.
Counting semantic plus promoted metadata evidence units, provider concentration
is Discover Uni/UK 74 (45.40%), Onisep/FR 38 (23.31%), DUO/NL 30 (18.40%),
swissuniversities/CH 15 (9.20%), and Scorecard/US 6 (3.68%).

The unchanged H1-H4 evaluator (`hierarchy/external-field-scale-20260914-consolidated-v2.json`)
reports:

| level | candidates | usable | applied |
| --- | ---: | ---: | ---: |
| Direct | 47 | 47 | 47 |
| H1 | 0 | 0 | 0 |
| H2 | 42 | 0 | 0 |
| H3 | 21 | 19 | 19 |
| H4 | 0 | 0 | 0 |

There are 395 abstentions. H2 tuition/fee transfers remain unusable because
institution assertions are not narrowed to programme scope and compatibility
gates are unchanged. H3 support count is one per applied donor and its mean
heuristic combined uncertainty is 0.3403. No hierarchy gate was weakened.

## E. Remaining exact blockers and scale decision

The streaming blockers are resolved: Onisep has no unresolved
`STREAMING_PARSE_FAILED`, and Scorecard Cornell now reads/materialises
deterministically. Remaining limitations are semantic/source-scope limitations,
not storage failures: Scorecard institution observations lack source-native
academic-cycle and fee-period evidence for programme use; many Onisep values
are empty or lack the context required by unchanged validation; and the
priority admissions, language-threshold, eligibility, documents, and funding
groups have no accepted external evidence in this population.

The corrected run remains **C - COVERAGE TOO SPARSE** for broad production
scale. This classification reflects product-field sparsity after the runtime
repair, not a failure of durable persistence.

## F. Reproducibility and tests

Correction configs:

- `external-field-scale-20260914-onisep-correction-config.json`
- `external-field-scale-20260914-scorecard-correction-config.json`

Runs and summaries:

- `runs/external-field-scale-20260914-onisep-correction-c/`
- `runs/external-field-scale-20260914-scorecard-correction-b/`
- `runs/external-field-scale-20260914-consolidated-v2/`
- `coverage-summary-consolidated-v2.json`
- `hierarchy/external-field-scale-20260914-consolidated-v2.json`

Validation executed after the fixes:

- `test_heavy_raw_streaming.py`: 15 passed (CSV boundaries, multiline/quoted
  rows, bounded reads, retry behavior, no-op seek prefetch, deterministic ZIP
  identifier retrieval).
- `test_raw_evidence.py` and `test_external_acquisition.py`: 67 passed.
- `test_external_field_evidence.py`: 17 passed.
- Full `services/data-ingestion` suite: 653 passed.
- `py_compile` passed for the changed ingestion and analysis modules.

No TLS verification was disabled, no local Mongo fallback or mock persistence
was used, and no commit or push was performed.
