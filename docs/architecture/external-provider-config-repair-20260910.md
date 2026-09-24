# External provider configuration repair

Date: 2026-09-10

This repair addressed only the seven `BAD_CONFIG` findings from the preceding replacement-provider audit. The deterministic checks and the final live recheck used the production registry, `external_source_expansion` planner, resolver, SafeFetcher, and local raw/staging paths. No LLM, estimator, topology experiment, assertion generation, promotion, Benchmark V3, commit, or push was run.

## Root causes and repairs

| Provider | Root cause | Smallest repair |
|---|---|---|
| `unesco_uis` | The indicators endpoint requires at least one `geoUnit` or `indicator`; the catalogue sent neither and added an unsupported page request. | Added explicit configured `geoUnit=USA`, documented indicator `CR.1`, bounded years, and removed numbered pagination. The UIS API contract documents these dimensions in its [API training material](https://tcg.uis.unesco.org/wp-content/uploads/sites/4/2024/09/API-Training-1.pdf). |
| `crossref` | Crossref rejects the generic `page` parameter. | Changed the catalogue to bounded `offset` plus `rows` pagination; generated requests use `offset=0`/`rows=20` (and a second bounded offset when selected). |
| `college_scorecard_bulk` | The old `collegescorecard.ed.gov/assets/CollegeScorecard_Raw_Data.zip` locator returned 404. | Switched to the current official stable bulk download host and institution release alias `ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution.zip`, retaining institution-level resolution. The official [College Scorecard data page](https://collegescorecard.ed.gov/data/) remains the catalogue landing point. |
| `usdoe_affordability` | It reused the same stale Scorecard ZIP under a different provider identity. | Pointed it to the distinct College Affordability and Transparency Center workbook `collegecost.ed.gov/wwwroot/documents/CATClists2024.xlsx`, with institution-level resolution and XLSX metadata. |
| `discover_uni_hesa` | The configured `data.unistats.ac.uk` URL redirects to `discoveruni.gov.uk`, which was outside the provider's admitted domain. | Narrowed the provider to the verified official final host and direct URL `https://discoveruni.gov.uk/`; no global redirect allowance was added. The HESA [Unistats/Discover Uni distribution page](https://www.hesa.ac.uk/support/tools-and-downloads/unistats) describes the official dataset path. |
| `data_europa_eu` | The retired `/api/hub/search/datasets` route returned 400; result rows expose identifiers and markdown-wrapped access URLs rather than a reliable same-host fetch URL. | Changed to the documented CKAN `/api/hub/search/ckan/package_search` route with `start`/`rows` offsets. Added an explicit provider URL template from each result `id` to same-host `/ckan/package_show?id={id}`. This remains discovery-only until the package metadata URL is admitted and fetched; the current route is documented by the [data.europa.eu hub-search OpenAPI](https://data.europa.eu/api/hub/search/). |
| `data_gov_us` | The retired `catalog.data.gov/api/3/action/package_search` route returned 404. | Switched to the current Data.gov API route `https://api.gsa.gov/technology/datagov/v4/search`, retained discovery-only result handling, and declared the optional `DATAGOV_API_KEY` query credential. The public [Data.gov catalogue API documentation](https://resources.data.gov/catalog-api/) describes this route and credential model. |

## Files changed

- `services/data-ingestion/configs/external-providers.json`
- `services/data-ingestion/src/glowbal_ingestion/config.py`
- `services/data-ingestion/src/glowbal_ingestion/external_sources.py`
- `services/data-ingestion/src/glowbal_ingestion/source_adapters.py`
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py`
- `services/data-ingestion/tests/test_external_acquisition.py`
- `docs/current-status.md`

The generic code change is deliberately limited to the data.europa.eu contract: `ExternalProviderConfig` now carries an optional `result_url_template`; `HttpSearchProvider` and `SearchSourceAdapter` resolve that configured template; and an admitted search-discovery candidate may parse an authoritative JSON response through the existing raw boundary. Search rows remain `snippet_only` and never produce assertions.

## Deterministic checks

- `python -m unittest tests.test_external_acquisition`: **41/41 passed**
- `python -c ... tests.test_source_ecosystem, tests.test_source_adapters, tests.test_raw_evidence`: **30/30 passed**
- `python -m compileall -q services/data-ingestion/src/glowbal_ingestion services/data-ingestion/tests`: **passed**
- `external-providers.json`: parsed successfully

## Bounded live recheck

The recheck used one clean run directory per provider, one configured provider at a time, at most one persisted candidate fetch per run, and no extraction. The two data.europa.eu search pages plus one same-host `package_show` fetch account for its three requests; the other providers used one request each. The complete raw/staging artifacts are in [audit-result.json](data/external-provider-repair-live-recheck-20260910/audit-result.json).

| Provider | Previous defect | Repair | Live result | Retrieved | Raw persisted |
|---|---|---|---|---:|---:|
| `unesco_uis` | Missing `geoUnit`/`indicator` | Explicit `geoUnit=USA`, `indicator=CR.1`; no page parameter | **SUCCESS** | yes (200) | yes |
| `crossref` | Unsupported `page` pagination | Offset/`rows` pagination | **SUCCESS** | yes (200) | yes |
| `college_scorecard_bulk` | Stale ZIP URL (404) | Current official institution ZIP alias | **NO_YIELD** | yes (200) | yes* |
| `usdoe_affordability` | Reused stale Scorecard ZIP | CATC affordability workbook | **SUCCESS** | yes (200) | yes |
| `discover_uni_hesa` | Redirect target not admitted | Direct `discoveruni.gov.uk` URL/domain | **SUCCESS** | yes (200) | yes |
| `data_europa_eu` | Search route 400; unusable result URL field | CKAN route plus `package_show` URL template | **SUCCESS** | yes (200) | yes |
| `data_gov_us` | CKAN route 404 | Data.gov v4 API route | **CREDENTIAL_REQUIRED** | no (403 without `DATAGOV_API_KEY`) | no |

`*` Scorecard's 22.9 MB ZIP was retrieved and its local raw payload was written before the existing bounded parser rejected the single 221 MB CSV member. No `SourceDocument` row was emitted for that resource, so it is recorded as `NO_YIELD`, rather than as a configuration or code defect. Its candidate and fetch-attempt staging rows retain `GOVERNMENT` / `GOVERNMENT`, provider ID, dataset ID, URL, and run ID.

The persisted successful source rows retain `source_class`, authority, relationship, provider ID, dataset ID, HTTP status, content type, cycle, content hash, raw-document ID, and acquisition run ID. The data.europa.eu candidate rows retain `discovery_method=search_snippet`, and its persisted package response is the first authoritative fetch; no snippet was treated as a fact. No fixture adapter appeared in the live registry, no archive provider was involved in this seven-provider run, and the LLM call count was zero.

## Counts and remaining runtime blockers

- SUCCESS: **5**
- CREDENTIAL_REQUIRED: **1** (`data_gov_us`, missing `DATAGOV_API_KEY`)
- UPSTREAM_BLOCKED: **0**
- NO_YIELD: **1** (`college_scorecard_bulk`, parser safety limit after raw retention)
- BAD_CONFIG: **0**
- CODE_BUG: **0**

The configuration defects are all repaired. A later runtime pass may provide a Data.gov key; a separate bounded parser/storage decision is needed if the Scorecard bulk ZIP must produce a parsed source row rather than only retained raw evidence. Neither issue is a remaining configuration defect.

## Verdict

**B — CONFIG DEFECTS REPAIRED; UPSTREAM BLOCKERS REMAIN**
