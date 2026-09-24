# Acquisition expansion: source-ecosystem wiring and bounded smoke

Date: 2026-09-09  
Scope: read-only retained-evidence audit plus additive runtime wiring.  No
benchmark, exact-evidence, promotion, inference, or Remediation 13 path was
changed, and no commit or push was made.

## Result

The previous runtime distinction was real. `AcquisitionPlatformBackend` built a
registry containing only its `OfficialCatalogueAdapter` unless a caller supplied
a registry. `SmokePipeline` passed only the robots policy to that backend, so
configured provider resources could not reach an adapter. The existing IPEDS,
Scorecard, JSON API, PDF, search, and archive primitives were therefore
unconnected to a normal configured run. Legacy source rows also had no
first-class source-class, adapter, provider, or dataset fields; many were
effectively `OFFICIAL`/`DIRECT_OFFICIAL` or null.

The additive path is now:

```text
SmokeConfig.load
  -> SourceEcosystemConfig
  -> SmokePipeline
  -> AcquisitionPlatformBackend
  -> build_source_registry
  -> SourceAdapterContext.configuration
  -> SourceResolver / ExternalSourceRule
  -> existing SafeFetcher and raw-evidence boundary
```

The CLI already loads `SmokeConfig`, so a config file can enable the ecosystem.
The `process-jobs` worker still constructs its intentionally minimal
one-programme legacy config; it does not implicitly turn on expansion resources
or external domains. This preserves the product worker's existing behaviour and
is a remaining integration limitation.

## What the retained data actually contained before this change

I searched the 14 retained run `sources.jsonl` inventories in
`docs/benchmarks/runs`, their raw HTML/PDF trees, effective assertions, URL
graphs, manifests, and acquisition-related artifacts. Across those snapshots
there were 2,532 source rows, 207 unique canonical URLs, 12 institution IDs and
579 unique content hashes. The latest retained seven-institution run had 138
source rows and 95 unique URLs. Its source rows carried only `OFFICIAL` or null
authority/relationship values; `source_class`, `adapter_id`, `provider_id`, and
`dataset_id` were absent. Programme IDs were not attached to source rows, so
programme counts cannot be safely derived from that file; the accompanying
assertions cover the audited programme set separately.

The latest run's page-type inventory was:

| Audited URL/page class | Rows | Unique URLs | Institutions | Fields represented |
| --- | ---: | ---: | ---: | --- |
| Programme overview | 29 | 20 | 6 | identity, curriculum, admissions and related programme fields |
| Programme admission | 41 | 26 | 6 | admissions, deadlines, language and related fields |
| Tuition page | 10 | 9 | 3 | tuition and fee-related assertions |
| Official PDF | 8 | 6 | 3 | tuition/admissions/scholarship material |
| Other official pages (career, deadline, English, scholarship, unknown) | 57 | overlapping | 1–5 | corresponding configured field groups |

These are manually audited page types, not source-class metadata. URL classes
overlap in institutional hierarchy. The retained source graph had 128 edges,
all using internal/configured programme-source or retry relations. No retained
source row or accepted assertion identified a government dataset, accreditor,
external catalogue/API, archive capture, trusted aggregator, or official
application partner as a distinct authority.

| Source class | Present before wiring? | Unique docs/URLs | Institutions | Programmes | Main fields | Actually used for accepted assertions? |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Programme pages | Yes (page-type inference) | 46 (20 overview + 26 admission) | 6 | Not keyed on source rows; audited programme associations exist in assertions | identity, admissions, tuition and programme fields | Yes |
| Department/faculty/school pages | Yes as university URLs, class not recorded | Not separable without reclassification | Included above | Not keyed | programme context, tuition/supporting fields | Yes, as official URLs |
| Central university pages | Yes as university URLs, class not recorded | Not separable without reclassification | Included above | Not keyed | admissions, finance, deadlines | Yes, as official URLs |
| Admissions / registrar / finance / bursar | Yes as official URLs | 9 tuition URLs plus overlapping admission/finance pages | 3+ | Not keyed | tuition, fees, admissions | Yes, labelled official |
| Official catalogues | Yes as catalogue-host URLs | 19 catalogue-host URLs in latest run | 2+ | Not keyed | programme identity/overview | Yes, labelled official |
| Official PDFs | Yes | 6 unique URLs in latest run | 3 | Not keyed | tuition/admissions/scholarship | Yes, labelled official |
| Structured university APIs | No | 0 | 0 | 0 | None | No |
| Government sources | No | 0 | 0 | 0 | None | No |
| Accreditation bodies | No | 0 | 0 | 0 | None | No |
| Official application systems / partners | No distinct authority | 0 | 0 | 0 | None | No |
| Archives / historical sources | No | 0 | 0 | 0 | None | No |
| Trusted aggregators | No | 0 | 0 | 0 | None | No |
| Other external authoritative sources | No | 0 | 0 | 0 | None | No |

The effective assertions in the latest run contained the normal product fields
(including 10 tuition rows), but 208 assertions had null authority/relationship
and the remaining 201 were `OFFICIAL`/`DIRECT_OFFICIAL`. This confirms that the
previous population was effectively mostly university-controlled web content,
with no meaningful external-source coverage.

## Adapter readiness and registry behavior

`build_source_registry(config)` is the sole explicit registry construction
mechanism. It accepts either `SourceEcosystemConfig`, a decoded mapping, or a
loaded `SmokeConfig`, and registers only an enabled family with a configured
resource/provider. It reuses the existing adapter implementations and keeps
fixture-only adapters out of production defaults.

| Adapter/source class | Previously | Now | Notes |
| --- | --- | --- | --- |
| `official_catalogue` / official web | Built-in catalogue adapter only; no ecosystem resources | Registered from enabled official web/catalogue config | Existing seed/manual URLs remain supported |
| `pdf_document` / PDF | Implemented but not on default registry | Registered for configured PDF resources | Uses existing PDF parser and raw boundary |
| `json_api` / structured API | Implemented but shadow-only | Registered for configured API resources | Provider/dataset/cycle metadata is carried through |
| `ipeds` | Implemented but not on default registry | Registered from explicit candidates or reused `ipeds-us-21.json` | Wraps datasets; makes no programme-level tuition claim |
| `college_scorecard` | Implemented but not on default registry | Registered for configured Scorecard resources | Keeps government authority and dataset identity |
| `search_index` | Fixture provider only | Not registered without an injected provider | Search remains discovery-only; snippets cannot become evidence |
| `fixture_archive` | Fixture adapter only | Not registered unless explicitly allowed for fixture tests | No silent production promotion; historical semantics retained |

For external URLs, admission still requires the institution seed's
`ExternalSourceRule` matching domain, adapter ID, relationship, and authority,
plus relationship evidence. External sources are not rewritten as
`DIRECT_OFFICIAL`. Invalid or incomplete external metadata is rejected or
degraded to an explicit non-official value rather than silently promoted.

The new `SourceEcosystemConfig` separates institution seeds from the source
ecosystem. It supports the following JSON shape (the repository uses JSON
configuration):

```json
{
  "source_ecosystem": {
    "enabled": true,
    "runtime_acquisition_enabled": true,
    "official_web": {"enabled": true, "resources": []},
    "official_catalogue": {"enabled": true},
    "pdf": {"enabled": true, "resources": []},
    "structured_apis": {"enabled": true, "resources": []},
    "government_datasets": {
      "enabled": true,
      "providers": ["ipeds", "college_scorecard"],
      "ipeds_target_config": "ipeds-us-21.json",
      "scorecard_resources": []
    },
    "archives": {"enabled": false},
    "search_discovery": {"enabled": false},
    "external_authoritative": {"enabled": true, "resources": []}
  }
}
```

The bounded example is
`services/data-ingestion/configs/source-ecosystem-expansion-smoke.json`. It
contains one synthetic-domain fixture keyed to the existing `mit-us` target,
three same-institution official web resources (a
finance page, a department page, and a central admissions page), one PDF, one official-partner JSON API,
the existing IPEDS target config, and one College Scorecard resource. The
external domains are explicitly listed in the seed's rules. It is a contract
fixture, not a global catalogue or a live crawl configuration.

## Bounded smoke ledger

The smoke used one institution, a six-fetch per-institution cap, a deterministic
fixture fetcher, zero provider/LLM calls, and zero network requests. It exercised
the same resolver, SafeFetcher call shape, parser, and raw/source persistence
boundary used by a configured runtime; no real external provider was contacted.

| Request/resource | Adapter | Expected source class | Result | Authority / relationship |
| --- | --- | --- | --- | --- |
| Official finance HTML | `manual_source` | `official_finance` | discovered, admitted, persisted | `OFFICIAL` / `FINANCE_OFFICE` |
| Department HTML | `manual_source` | `official_web` | discovered, admitted, persisted | `OFFICIAL` / `DEPARTMENT` |
| Central admissions HTML | `manual_source` | `official_web` | discovered, admitted, persisted | `OFFICIAL` / `CENTRAL_ADMISSIONS` |
| Tuition handbook PDF | `pdf_document` | `pdf` | discovered, admitted, persisted | `OFFICIAL` / `DIRECT_OFFICIAL` |
| Partner tuition JSON | `json_api` | `official_api` | discovered, admitted, persisted | `OFFICIAL_PARTNER` / `PARTNER_INSTITUTION` |
| IPEDS generated `COST1_2024.zip` resource | `ipeds` | `government_dataset` | discovered, admitted, persisted | `GOVERNMENT` / `GOVERNMENT` |
| Other IPEDS generated resources | `ipeds` | `government_dataset` | discovered and admitted; beyond six-fetch pipeline cap | `GOVERNMENT` / `GOVERNMENT` |
| College Scorecard resource | `college_scorecard` | `government_dataset` | discovered, admitted, persisted in the direct raw-boundary smoke | `GOVERNMENT` / `GOVERNMENT` |

The registry produced six adapter IDs:
`manual_source`, `official_catalogue`, `pdf_document`, `json_api`, `ipeds`, and
`college_scorecard`. There were 10 configured candidates and 10 admissions. The
pipeline bridge persisted 6 resources under its cap, covering official finance,
official web, PDF, partner API, and IPEDS. A second direct persistence assertion covered the
Scorecard resource through the same `persist_admitted_fetch` boundary. Search
and archive produced no candidate because their providers are not production
ready.

The acceptance matrix for the bounded smoke is:

| Source class | Adapter registered | Configured | Discovered | Admitted | Persisted | Authority correct |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `official_finance` | Yes (`manual_source`) | 1 | 1 | 1 | 1 | Yes: `OFFICIAL` |
| `official_web` | Yes (`manual_source`) | 2 | 2 | 2 | 2 | Yes: `OFFICIAL` |
| `official_catalogue` | Yes (`official_catalogue`) | Enabled, no bounded resource | 0 | 0 | 0 | N/A |
| `pdf` | Yes (`pdf_document`) | 1 | 1 | 1 | 1 | Yes: `OFFICIAL` |
| `official_api` | Yes (`json_api`) | 1 | 1 | 1 | 1 | Yes: `OFFICIAL_PARTNER` |
| `government_dataset` / IPEDS | Yes (`ipeds`) | Target config | 4 | 4 | 1 pipeline | Yes: `GOVERNMENT` |
| `government_dataset` / Scorecard | Yes (`college_scorecard`) | 1 | 1 | 1 | 1 direct raw-boundary smoke | Yes: `GOVERNMENT` |
| `search_index` | No provider | Disabled / provider absent | 0 | 0 | 0 | N/A |
| `archive` | No production adapter | Disabled / fixture-only | 0 | 0 | 0 | N/A |

The IPEDS loader reused `ipeds-us-21.json` rather than duplicating its target
list. Its collection year is 2024, the generated resources carry the
2024–25/2023–24 data cycles from the existing dataset specs, and the fixture's
`mit-us` seed is present in the target mapping. An unmapped institution does not
receive generated IPEDS candidates. IPEDS and Scorecard remain institution
datasets; this wiring does not turn their institution-level facts into exact
programme tuition.

## Persistence and provenance checks

`SourceDocument`, `RawDocument`, `RawSnapshotInput`, Mongo raw records, and
`ExtractionSource` now retain the optional source class, adapter ID, provider ID,
dataset ID, academic cycle, and temporal state. The configured pipeline passes
candidate metadata into the existing fetch/parser path and records an explicit
`source_ecosystem_fetches` artifact/event. It does not create assertions from
the smoke resources, so no source scope is accidentally represented as a
programme-level fact. A historical archive candidate, if later enabled with a
production adapter, remains `ARCHIVE`/`HISTORICAL` and does not imply current
truth.

The source resolver still rejects an external URL without a matching explicit
rule, relationship evidence, or with a `search_snippet`/`text_mention`
discovery method. The existing test for the search-snippet non-truth invariant
continues to pass.

## Files changed for this expansion

The additive runtime and model changes are in:

```text
services/data-ingestion/src/glowbal_ingestion/config.py
services/data-ingestion/src/glowbal_ingestion/source_adapters.py
services/data-ingestion/src/glowbal_ingestion/pipeline.py
services/data-ingestion/src/glowbal_ingestion/models.py
services/data-ingestion/src/glowbal_ingestion/raw_evidence.py
services/data-ingestion/src/glowbal_ingestion/mongo_raw_evidence.py
services/data-ingestion/src/glowbal_ingestion/extraction_provider.py
```

The bounded research/config artifacts are:

```text
services/data-ingestion/configs/source-ecosystem-expansion-smoke.json
services/data-ingestion/tests/test_source_ecosystem.py
docs/architecture/acquisition-expansion-source-ecosystem-smoke.md
docs/architecture/data/acquisition-expansion-smoke-results.json
```

`docs/current-status.md` links this report. Benchmark V3, exact-evidence,
promotion, inference, tuition compatibility, and Remediation 13 files were not
changed for this task.

## Verification

The following checks passed after the final changes:

```text
python -m compileall -q services/data-ingestion/src/glowbal_ingestion
pytest -q services/data-ingestion/tests
401 passed in 11.36s
```

The new ecosystem tests specifically cover registry construction, configured
candidate discovery, external-domain admission, IPEDS target-config reuse,
Scorecard/JSON/PDF provenance, local raw persistence, the pipeline bridge, and
fixture-only search/archive exclusion. Existing source-adapter, raw-evidence,
core, worker, and acquisition tests remain green. No live crawl, paid provider,
Benchmark V3 run, promotion test, inference change, or database migration was
run.

## Remaining gaps and decision

Search discovery is still only a protocol plus fixture provider; a production
search provider must be supplied before that class can be enabled. Archive
support is explicitly fixture-only and remains disabled. The smoke proves the
runtime wiring and metadata contract with deterministic resources, but it does
not validate live provider availability, credentials, rate limits, or external
HTTP response quality. The process-jobs worker remains on its minimal legacy
config and would need a separately bounded decision before it can opt into a
source ecosystem file.

The platform is ready for a bounded source-ecosystem experiment over configured
official web, PDF, JSON/API, IPEDS, and College Scorecard resources. It is not a
complete operational implementation of the full theoretical ecosystem while
search and production archive adapters are absent.

B — PARTIALLY READY, SPECIFIC SOURCE CLASSES STILL BLOCKED
