# Production external-source acquisition live audit (Eurostat rerun)

Date: 2026-09-10

This is a bounded read-only rerun after the Eurostat catalogue fix. It used the
real configured adapters, `SafeFetcher`, resolver/robots policy, the normal
acquisition planner, an isolated in-memory raw-evidence store, and staging
attempt artifacts. It made 31 HTTP requests for 11 configured providers. The
catalogue and production code were not changed during this audit. No LLM,
provider extraction, assertion, promotion, estimator, topology experiment, or
Supabase write was run.

The audit copy disabled unrelated university-web, catalogue, PDF, and
structured-API classes so a provider result could not be satisfied by a
different adapter. Bing is disabled in the checked-in catalogue because its
credential is optional; it was enabled only in memory to test the real request
path. The checked-in configuration was not changed.

## Provider results

Every provider below had a catalogue entry, a registered production adapter,
and a selectable `external_source_expansion` plan. `configured` for Bing means
the provider is described in the catalogue; its default `enabled` flag is
false, so the live check used only the stated in-memory audit override.

| Provider | Class | Adapter registered / configured / planner | Result | Retrieved | Raw persisted | Authority / relationship | Blocker |
|---|---|---|---|---:|---:|---|---|
| IPEDS | `government_dataset` | yes / yes / yes | `UPSTREAM_BLOCKED` | no | no | `GOVERNMENT / GOVERNMENT` | NCES robots request timed out |
| College Scorecard | `government_dataset` | yes / yes / yes | `CREDENTIAL_REQUIRED` | no | no | `GOVERNMENT / GOVERNMENT` | API returned HTTP 403 without `COLLEGE_SCORECARD_API_KEY` |
| Eurostat education | `government_dataset` | yes / yes / yes | `SUCCESS` | yes | yes | `GOVERNMENT / GOVERNMENT` | — |
| CRICOS Australia | `official_registry` | yes / yes / yes | `SUCCESS` | yes | yes | `GOVERNMENT / GOVERNMENT` | — |
| EQAR | `accreditation` | yes / yes / yes | `SUCCESS` | yes | yes | `ACCREDITED_PROVIDER / ACCREDITATION_BODY` | — |
| ABET | `accreditation` | yes / yes / yes | `SUCCESS` | yes | yes | `ACCREDITED_PROVIDER / ACCREDITATION_BODY` | — |
| UCAS | `official_partner` | yes / yes / yes | `UPSTREAM_BLOCKED` | no | no | `OFFICIAL_PARTNER / CONSORTIUM` | UCAS robots/upstream policy rejected the admitted URL |
| OpenAlex | `external_authoritative` | yes / yes / yes | `SUCCESS` | yes | yes | `TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER` | — |
| ROR | `external_authoritative` | yes / yes / yes | `UPSTREAM_BLOCKED` | no | no | `TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER` | API robots returned HTTP 403 |
| Internet Archive Wayback | `archive` | yes / yes / yes | `UPSTREAM_BLOCKED` | no | no | `ARCHIVE / ARCHIVE` | CDX discovery returned HTTP 429; no capture candidate was available |
| Bing Web Search | `search_discovery` | yes / audit override / yes | `CREDENTIAL_REQUIRED` | no | no | `OTHER / OTHER_RELATED` | Search endpoint returned HTTP 401 without `BING_SEARCH_API_KEY` |

The machine-readable request, candidate, staging, and raw-document ledger is
[`external-source-live-audit-rerun-20260910.json`](data/external-source-live-audit-rerun-20260910.json).

## Eurostat confirmation

The fixed provider `eurostat_education` used the bounded resource:

`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/educ_uoe_enrt01?format=JSON&geo=DE&lang=en`

It returned HTTP 200 (`application/json`, 110,098 bytes). The local raw store
persisted document `36660237-a1cb-4805-a2a5-2dc2b6b74e4f` with content hash
`81222b2deb85cdbd33a748e42288ba4f723a6f6ac0adef16d55ab3b14f350b88`. Both the
raw document and the `RAW_PERSISTED` staging attempt carry:

```text
provider_id       = eurostat_education
dataset_id        = educ_uoe_enrt01
source_class      = government_dataset
source_authority  = GOVERNMENT
source_relationship= GOVERNMENT
source_resolution = national
temporal_state    = UNKNOWN
```

The prior invalid pagination was therefore not reproduced; this audit has no
Eurostat `BAD_CONFIG` finding.

## Provenance and invariants

The five successful raw resources were persisted with provider and dataset
identity, source class, authority/relationship, HTTP content type/status, and
content hash. The successful staging records are `RAW_PERSISTED` and retain the
same lineage. Successful resolutions were national (Eurostat), programme
(CRICOS and ABET), institution (EQAR and OpenAlex), as recorded in the ledger;
an institution-level source was not promoted to programme applicability.

Search stayed discovery-only. Bing authentication failed before a result, and
the deterministic search path marks any future result as snippet-only and
requires an admitted authoritative fetch before evidence can be created. No
search snippet became an assertion or fact.

The live archive request reached the Wayback CDX endpoint but received HTTP
429, so no capture was retrieved. Archive adapter semantics remain explicitly
historical: deterministic checks require `TemporalState.HISTORICAL` on any
archive candidate, with capture URL, original URL, provider, and capture time;
historical evidence cannot imply current truth.

The recorded run reports `no_fixture_adapters_in_live_registries=true`.
Fixture adapters remain opt-in and were not used. LLM/provider extraction,
assertion generation, promotion, inference, estimator, and topology activity
were all zero/false in the run constraints.

## Result counts

| Result | Count |
|---|---:|
| `SUCCESS` | 5 |
| `CREDENTIAL_REQUIRED` | 2 |
| `UPSTREAM_BLOCKED` | 4 |
| `NO_YIELD` | 0 |
| `BAD_CONFIG` | 0 |
| `CODE_BUG` | 0 |

Focused deterministic checks were rerun with:

```text
python -m pytest services/data-ingestion/tests/test_external_acquisition.py services/data-ingestion/tests/test_source_ecosystem.py services/data-ingestion/tests/test_source_adapters.py services/data-ingestion/tests/test_acquisition.py services/data-ingestion/tests/test_raw_evidence.py services/data-ingestion/tests/test_supabase_storage.py -q
```

They passed **70/70**. These checks cover registration, external admission,
provider/dataset provenance, raw/staging mapping, search non-truth, and archive
historical semantics. The live blockers are credentials or upstream policy/
availability, not implementation defects.

## Assessment

All requested source classes were selected by the planner and reached a real
adapter path. Government (Eurostat), official registry (CRICOS),
accreditation (EQAR and ABET), and trusted external (OpenAlex) providers
demonstrated live retrieval and raw persistence outside university-controlled
domains. College Scorecard and Bing need credentials; IPEDS, UCAS, ROR, and
Wayback were limited by upstream robots/rate responses. Those dependencies
materially limit the breadth of live validation even though no code/config
defect remains.

B — IMPLEMENTATION READY; RUNTIME DEPENDENCIES REMAIN
