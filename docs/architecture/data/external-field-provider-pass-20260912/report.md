# External field-bearing provider pass — 2026-09-12

## Verified sources and implementation

| Country | Provider | Source type | Verified field-bearing record | Verified fields and native scope | Matching method | Implementation |
| --- | --- | --- | --- | --- | --- | --- |
| US | College Scorecard bulk | US Department of Education government dataset | `Most-Recent-Cohorts-Institution.zip`, `Most-Recent-Cohorts-Institution.csv` | `TUITIONFEE_IN`, `TUITIONFEE_OUT`: annual institution tuition and fees, USD; institution scope | Configured exact `UNITID` (`MIT=166683`, `Cornell=190415`) | Existing streaming ZIP adapter extended with declarative, identifier-filtered field materialisation. |
| US | Common App requirements grid | Official application consortium | `https://content.commonapp.org/Files/ReqGrid.pdf` | First-year deadlines, US/international application fees, fee waiver/test/English-proficiency requirement flags; institution scope, 2026–27 | Configured exact grid name (`Cornell University`) | Existing official-partner adapter now retains a bounded exact-name row context. |
| AU | CRICOS course register | Australian Government official registry | Course `0101866`, UNSW Master of Data Science and Decisions | Course name/code, Masters coursework credential, tuition `AU$126,000`, non-tuition fee `AU$2,000`, total course cost, duration/location; programme scope | Configured exact CRICOS course code | Existing registry adapter now uses configured direct course resource and bounded exact-code context. |
| CH | swissuniversities tuition table | Member-university consortium | `https://www.swissuniversities.ch/en/themen/lehre-studium/information-on-studies/tuition-fees/tuition-fees-at-universities` | ETH Zurich: CHF 730 domestic tuition/semester, CHF 2,190 foreign tuition/semester, CHF 74 compulsory fee/semester, current 2026–27; institution scope | Configured exact table name (`ETH Zurich`) | Existing official-partner adapter now retains a bounded exact-name row context. |

The structured provider output remains raw evidence until the unchanged semantic
schema, validation and acceptance rail independently produces an `OBSERVED`
assertion.  The materialiser neither writes facts nor changes assertion policy.

## Sources examined but not implemented

| Source | Result |
| --- | --- |
| IPEDS / USDOE affordability | Existing sources were not extended: their available data are institution-level aggregates or duplicate Scorecard financial data, with no verified programme, deadline, language or eligibility values for this sample. |
| Mon Master, France | Verified 2026 national Master calendar, but it does not identify a Sorbonne programme/institution record. It cannot be bound safely under the frozen entity/scope rules. |
| Singapore MOE bursary | Verified national bursary material for autonomous-university undergraduates, but no compatible programme-level NTU tuition/admission record for the frozen target. It is deferred rather than mis-scoped. |
| OpenAlex, Crossref, accreditation registries, generic government metadata | Rejected for this pass: they supply entity/status/context metadata, not the priority financial/admission/language/eligibility facts. |

No verified external source in this bounded pass supplies numeric IELTS/TOEFL,
minimum degree/GPA, programme-specific deadlines/intakes, or scholarship
amount/eligibility for the selected graduate targets.  Those remain targeted
field-bearing acquisition gaps rather than candidates for synthetic inference.

## Runtime result

The remote bounded execution was intentionally stopped as invalid after every
early source fetch failed durable persistence.  A direct Mongo ping using the
configured runtime environment failed with `ServerSelectionTimeoutError` and
Atlas shard TLS handshake errors.  This is a runtime storage blocker, not a
provider/configuration result.  The pass therefore produced **no new raw
documents, semantic assertions, or H1–H4 evaluation**.  It did not fall back
to local-only raw storage, so the validated durable-storage invariant remains
intact.

## Follow-up Mongo runtime diagnosis

The existing ingestion dotenv path (`data-platform/.env.local`, loaded by
`glowbal_ingestion.cli` for `run`) currently supplies `MONGODB_URI` and
`MONGODB_DATABASE`, but the URI resolves to an `atlas-sql-…query.mongodb.net`
host. This is an Atlas SQL-interface endpoint, not the standard Atlas database
deployment endpoint required by the PyMongo raw-evidence adapter.

Measured from the ingestion Python runtime: SRV/A DNS resolution succeeded;
TCP port 27017 succeeded; and a certificate-verifying stdlib SSL connection
completed TLS 1.3 both with the system trust store and certifi. In contrast,
the same URI passed to PyMongo (`4.17.0`, Python `3.14.3`, OpenSSL `3.0.18`)
consistently timed out during server selection; when forced through the stdlib
TLS branch, the server closed the connection after the driver began its
MongoDB protocol handshake. Increasing all connection/selection/socket limits
to 10 and 30 seconds and explicitly supplying certifi's CA bundle did not
change this. This verifies an endpoint/protocol mismatch rather than a DNS,
firewall, CA, or certificate-verification problem.

The application factory was also exercised with the same dotenv loader. It
correctly rejected the current environment before a Mongo operation because
neither an S3 raw-object bucket nor the required Supabase Storage configuration
is present. No configuration was invented and no local-only fallback was used.

Required environment repair before a valid rerun: replace `MONGODB_URI` with
the Atlas **database deployment** application-driver URI for the intended
non-production database (with a database user permitted to write the raw
collections and the execution egress IP allowed), and restore the already
designed durable object-store variables. Keep TLS verification enabled. After
that is supplied, repeat the connect/write/read/delete smoke through
`create_remote_raw_evidence_store()` and rerun this unchanged provider pass.

## Main-environment rerun

The first diagnosis used the feature worktree's local environment. The ignored
`.env.local` in the `main` worktree instead supplies a standard
`mongodb+srv://cluster0…mongodb.net` database URI and the existing Supabase
Storage variables. Using that file explicitly with the same
`create_remote_raw_evidence_store()` factory passed connect, write, read, and
delete of a unique smoke document; the document was removed.

The unchanged experiment then completed under run ID
`external-field-provider-pass-main-env-rerun-allowed-20260912`, with the same
provider set and the original explicit `--allow-unreviewed-terms` condition:

| Metric | Result |
| --- | ---: |
| Institutions completed | 6 / 6 |
| Sources fetched | 116 |
| External raw sources persisted | 3 |
| External field materialisations | 3 |
| External semantic proposals | 11 |
| External accepted assertions | 0 |

College Scorecard persisted two remote ZIP objects plus bounded structured
rows, with exact `UNITID` matches for MIT (`TUITIONFEE_IN/OUT` 53,450 USD) and
Cornell (59,282 USD). Both materialisations were retained, but neither reached
a semantic proposal; this is now a concrete materialisation-to-semantic trace
gap rather than a Mongo failure. swissuniversities persisted ETH Zurich's
exact-name table window and reached 11 raw proposals: seven tuition proposals
were rejected and two tuition plus two compulsory-fee proposals remained
`NEEDS_REVIEW` (unsupported basis or missing source-excerpt cycle/basis).

Common App and CRICOS did not fetch because each configured path was blocked by
its published robots policy. Therefore their configured deadline/fee/flag and
programme-cost fields did not reach durable raw evidence. No external value
was accepted, so direct, H1, H2, H3, and H4 external activation are all zero;
there are no usable external tuition, fee, admissions, language/test, or
funding donors. No acceptance, hierarchy, uncertainty, or provider set was
changed.

## Deterministic validation

`python -m pytest tests/test_external_field_evidence.py tests/test_external_acquisition.py tests/test_source_ecosystem.py tests/test_source_adapters.py -q` — 65 passed.

`python -m glowbal_ingestion validate-config --config ../../docs/architecture/data/external-field-provider-pass-20260912/population-config.json` — passed.

`python -m compileall -q src/glowbal_ingestion` — passed.

## Final Scorecard + swissuniversities replay (2026-09-13)

Run `external-field-provider-pass-scorecard-swiss-final-20260913` was limited
to MIT, Cornell, and ETH Zurich, with the provider allow-list restricted to
College Scorecard bulk and swissuniversities. It used the validated main
worktree durable environment, completed in 887 seconds, and made three live
finance calls with zero semantic-cache hits.

| Provider | Raw sources | Exact materialisations | Semantic proposals | Accepted observations |
| --- | ---: | ---: | ---: | ---: |
| College Scorecard bulk | 2 | 2 | 4 | 0 |
| swissuniversities | 1 | 1 | 3 | 3 |

Scorecard's exact MIT and Cornell rows materialised `TUITIONFEE_IN` and
`TUITIONFEE_OUT` as annual USD institution observations. The source contains
no row-level reporting year or academic cycle; the rolling
`Most-Recent-Cohorts-Institution.csv` designation and raw retrieval time are
now carried separately and every proposal has `academic_cycle=null`. The four
proposals reached semantic extraction. They did not enter the effective bundle
because the pre-existing cross-run best-assertion cache selected earlier cached
bundles that lack usable current raw bindings; no acceptance or resolver policy
was changed to bypass that condition.

The external identity fix was verified for swissuniversities. The source-native
ETH row now produced `RULE_VALIDATED`, institution-scoped observations for CHF
730 domestic tuition/semester, CHF 2,190 international tuition/semester, and
CHF 74 compulsory fees/semester, cycle 2026-27. This is direct external
institution evidence. No H1--H4 inheritance record was created in the bounded
run, so it supplies two usable institution tuition donors and one fee donor for
future compatible H2 use, but no H2 transfer was counted here.

The final rerun artifact directory is
`runs/external-field-provider-pass-scorecard-swiss-final-20260913/`. The
earlier `...-rerun-20260913` directory is diagnostic only: its cached response
spans predated the corrected materialised window and is not used for metrics.

## Scorecard cache-provenance follow-up (2026-09-13)

`merge_best_assertions()` previously compared cached and current bundle quality
before the pipeline built the current run's `SourceBinding` map. A cached
observed bundle with a higher quality score could therefore win despite its raw
document being unavailable to metadata reconciliation and semantic acceptance.
The merge now receives the set of raw document IDs bound in the current run;
an observed cached bundle must have a complete provenance chain and every raw
document must be present in that set before it is eligible for quality
comparison. Existing quality ordering remains unchanged for a fully bindable
older bundle, and differing current facts remain separate for the conflict
rail.

Focused tests passed: 12 best-assertion tests and 41 semantic-acceptance
tests. The bounded Scorecard-only replay
`external-field-provider-pass-scorecard-cache-fix-rerun-20260913` verified the
new selection decision for MIT: `selected=current`,
`reason=cached_bundle_missing_usable_provenance`; its Scorecard raw archive was
durably persisted with content hash
`5bafa13a2bfa5b159f75e56ef88b9fbdfaa9bd7ba1ef112baac9ee75c8bf604d`.

The replay is intentionally incomplete and must not be used for acceptance or
hierarchy metrics. Before reconciliation, the two MIT Scorecard proposals had
`academic_cycle=null`, as does the source-native structured record. Generic
metadata reconciliation then emitted `CYCLE_FROM_SOURCE_CONTEXT` and changed
both to `2026-2009`. That is not source-native temporal metadata. The run was
stopped before Cornell completed and before hierarchy evaluation; no generic
resolver, acceptance, hierarchy, uncertainty, storage, promotion, canonical
truth, or Benchmark V3 behavior was changed to work around it.

## Scorecard provenance + source-native cycle follow-up (2026-09-13)

The earlier diagnostic run is superseded for acceptance and hierarchy metrics
by `runs/external-field-provider-pass-scorecard-cycle-fix-rerun-20260913/`.
This rerun was limited to MIT and Cornell with the existing external-only
configuration. It persisted two College Scorecard raw snapshots and made no
university-web, Common App, or CRICOS fetch.

### Cache/provenance root cause and fix

`merge_best_assertions()` compared a cached bundle's quality before the
pipeline had made the current run's raw `SourceBinding` set available. A
higher-scored cached OBSERVED bundle could therefore suppress an equivalent
current bundle even though its required raw document was no longer bindable;
later semantic acceptance then returned `MISSING_PROVENANCE`.

The merge now receives the current bound raw-document IDs. A cached OBSERVED
bundle is eligible for the existing quality/conflict comparison only when each
assertion has the complete provenance chain and its raw ID is currently bound.
The choice is not based on recency: a fully usable older bundle still wins when
the existing quality rules prefer it, and conflicting values remain distinct.
The four live decisions selected `current` with
`cached_bundle_missing_usable_provenance` and
`cached_provenance_usable=false`.

### Source-native cycle fix

The generic `_explicit_cycle()` parser previously normalized any loose
`20xx-yy` or `20xx-20yy` range. Metadata reconciliation calls it on a bounded
same-source window, so a malformed `2026-2009` range was incorrectly written
as an academic cycle even when the proposal's source-native cycle was null.

It now accepts only a consecutive range (`2026-27` or `2026-2027` becomes
`2026-2027`). A bare range is accepted only when it is itself the complete
source value; prose additionally needs local academic/tuition context.
Reversed ranges, retrieval timestamps, filenames, release/cohort labels, and
unrelated years leave the cycle unknown. No provider-specific branch was
added. Source-native temporal fields remain separate.

Regression coverage includes valid short/full ranges, reversed ranges,
unrelated years, retrieval timestamps, `Most Recent Cohorts`, null native
cycles, stale cache provenance loss, valid older cache selection, conflicts,
and mandatory OBSERVED raw bindings. Validation passed:

`python -m pytest tests/test_evidence_resolution.py tests/test_semantic_acceptance.py tests/test_core.py -q` — 251 passed.

`python -m compileall -q src/glowbal_ingestion` — passed.

### Scorecard accepted external evidence

The earlier final replay had 4 Scorecard semantic proposals and 0 accepted
assertions. The superseding run produced 8 target-level semantic proposals
across four selected programme targets, coalescing to 4 unique accepted
institution assertions (8 accepted target decisions). All have
`academic_cycle=null`, `temporal_state=UNKNOWN`, `scope=institution`, and
unchanged source values.

| Provider | Field | Institution | Scope | Value and native temporal context | Raw provenance |
| --- | --- | --- | --- | --- | --- |
| College Scorecard bulk | tuition | MIT | institution | USD 53,450 annual; domestic; `academic_cycle=null`; rolling `Most-Recent-Cohorts` snapshot | `e6c5ba4c-0ad2-4717-a8aa-52923a4fcde4`; hash `5bafa13a2bfa5b159f75e56ef88b9fbdfaa9bd7ba1ef112baac9ee75c8bf604d`; run `external-field-provider-pass-scorecard-cycle-fix-rerun-20260913` |
| College Scorecard bulk | tuition | MIT | institution | USD 53,450 annual; international; `academic_cycle=null`; rolling `Most-Recent-Cohorts` snapshot | same raw/hash/run |
| College Scorecard bulk | tuition | Cornell | institution | USD 59,282 annual; domestic; `academic_cycle=null`; rolling `Most-Recent-Cohorts` snapshot | `a89dc36a-902a-43fb-a08b-735fcb13da7f`; same hash; same run |
| College Scorecard bulk | tuition | Cornell | institution | USD 59,282 annual; international; `academic_cycle=null`; rolling `Most-Recent-Cohorts` snapshot | same raw/hash/run |

The raw source for every row is
`https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution.zip`.
No `2026-2009`, `CYCLE_FROM_SOURCE_CONTEXT`, or `MISSING_PROVENANCE` appears
in the completed run artifact.

Combined accepted external evidence is therefore seven unique institution-level
OBSERVED assertions: the four Scorecard tuition observations above, plus
swissuniversities ETH domestic tuition (CHF 730/semester), foreign tuition
(CHF 2,190/semester), and compulsory fees (CHF 74/semester), all source-native
cycle `2026-2027`. The Swiss raw provenance remains raw
`f83cb0db-518e-46cb-a228-19af62c24397`, hash
`885cf12439333cfcc1b0267f8fab2051f718e4f1cd376df1dd518bfa87588176`, run
`external-field-provider-pass-scorecard-swiss-final-20260913`.

### Unchanged hierarchy evaluation

The existing H1--H4 engine was run without modification over the four unique
accepted Scorecard assertions above plus the three accepted
swissuniversities ETH observations. The target set was the four selected MIT /
Cornell programmes and the source-matched ETH Data Science programme; an old
provider-null assertion from the Swiss run was excluded.

| Field | Direct | H1 | H2 candidates / usable / applied | H3 | H4 | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| tuition | 0 | 0 | 10 / 0 / 0 | 0 | 0 | 5 / 5 |
| additional fees | 0 | 0 | 1 / 0 / 0 | 0 | 0 | 5 / 5 |

All support counts and donor-dispersion/uncertainty outputs are empty or not
measurable because no donor was applied. The four Scorecard tuition assertions
and the three ETH assertions were considered as H2 context, but none became a
usable H2 donor: the existing compatibility engine rejected their institution
matches with `DEGREE_MISMATCH`; cross-institution H4 candidates were rejected
with `PEER_ATTRIBUTES_UNVERIFIED`. No H1 parent or H3 sibling scope donor
existed. This is a safe abstention, not a missing-data workaround.

The external field-bearing layer is operational: College Scorecard and
swissuniversities both reach durable raw evidence, materialisation, semantic
proposal, and accepted OBSERVED assertion. The remaining limitation is only
that the unchanged hierarchy compatibility gates yield zero transferable H2
donors for this small accepted set; no provider-layer blocker remains.
