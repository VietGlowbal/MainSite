# Replacement external-source ecosystem live audit

Date: 2026-09-10

This bounded read-only audit exercised every enabled provider in external-providers.json (21 providers, 51 bounded HTTP requests: 39 normal acquisition calls and 12 endpoint checks) through the production registry, external_source_expansion planner, resolver, robots policy, SafeFetcher, and local raw/staging paths. No code or provider configuration was changed. No LLM, estimator, topology experiment, assertion generation, promotion, Benchmark V3, Supabase write, commit, or push was run.

The audit used one configured resource/capture per provider (with the configured bounded pagination where the adapter emitted it). Disabled legacy providers were not audited.

## Provider results

| Provider | Class | Registered / planner | Result | Retrieved | Raw persisted | Authority / relationship | Content type | Blocker |
|---|---|---|---|---:|---:|---|---|---|
| ipeds | government_dataset | yes / yes | UPSTREAM_BLOCKED | no | no | GOVERNMENT / GOVERNMENT | - | NETWORK_ERROR |
| eurostat_education | government_dataset | yes / yes | SUCCESS | yes | yes | GOVERNMENT / GOVERNMENT | application/json | - |
| japan_estat | government_dataset | yes / yes | CREDENTIAL_REQUIRED | yes* | yes* | GOVERNMENT / GOVERNMENT | application/json | HTTP 200 response is an authentication error; ESTAT_APP_ID is not configured. The error response was retained as raw JSON but no usable dataset was returned. |
| singapore_data_gov | government_dataset | yes / yes | UPSTREAM_BLOCKED | no | no | GOVERNMENT / GOVERNMENT | - | HTTP access denied by upstream |
| unesco_uis | government_dataset | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | UNESCO endpoint returned HTTP 400: at least one geoUnit or indicator query parameter is required; the configured resource omits both. |
| eqar | official_registry | yes / yes | SUCCESS | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | text/html | - |
| cricos_australia | official_registry | yes / yes | SUCCESS | yes | yes | GOVERNMENT / GOVERNMENT | text/html | - |
| anabin_germany | official_registry | yes / yes | SUCCESS | yes | yes | GOVERNMENT / GOVERNMENT | text/html | - |
| eqar_accreditation | accreditation | yes / yes | SUCCESS | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | text/html | - |
| abet | accreditation | yes / yes | SUCCESS | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | text/html | - |
| chea | accreditation | yes / yes | UPSTREAM_BLOCKED | no | no | ACCREDITED_PROVIDER / ACCREDITATION_BODY | - | HTTP access denied by upstream |
| jabee | accreditation | yes / yes | SUCCESS | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | text/html | - |
| common_app | official_partner | yes / yes | SUCCESS | yes | yes | OFFICIAL_PARTNER / CONSORTIUM | text/html | - |
| openalex | external_authoritative | yes / yes | SUCCESS | yes | yes | TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER | application/json | - |
| crossref | external_authoritative | yes / yes | BAD_CONFIG | no | no | TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER | - | Configured Crossref pagination sent unsupported page=1/2; the same public API returned HTTP 200 in a bounded check when page was omitted. |
| college_scorecard_bulk | government_dataset | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | Configured College Scorecard bulk URL returned HTTP 404. The public data landing page returned HTTP 200, so the configured download locator is stale/incorrect. |
| usdoe_affordability | government_dataset | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | Configured US Department of Education bulk URL returned HTTP 404; it shares the stale College Scorecard download locator. |
| discover_uni_hesa | government_dataset | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | Configured data.unistats.ac.uk resource redirected to discoveruni.gov.uk, outside the admitted domain set; SafeFetcher rejected the redirect before retrieval. |
| arquivo_pt | archive | yes / yes | UPSTREAM_BLOCKED | no | no | ARCHIVE / ARCHIVE | - | HTTP access denied by upstream |
| data_europa_eu | search_discovery | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | Configured data.europa.eu search endpoint returned HTTP 400 for a valid bounded query and produced no candidate. |
| data_gov_us | search_discovery | yes / yes | BAD_CONFIG | no | no | GOVERNMENT / GOVERNMENT | - | Configured catalog.data.gov CKAN package_search endpoint returned HTTP 404 and produced no candidate. |

*Japan e-Stat returned HTTP 200 but the body states authentication failure; its JSON error response was retained with provenance, while no usable dataset was retrieved.*

## Counts

- SUCCESS: 9
- CREDENTIAL_REQUIRED: 1
- UPSTREAM_BLOCKED: 4
- NO_YIELD: 0
- BAD_CONFIG: 7
- CODE_BUG: 0

Real persisted usable resources came from: eurostat_education, eqar, cricos_australia, anabin_germany, eqar_accreditation, abet, jabee, common_app, openalex.
These cover Eurostat government data; EQAR, CRICOS, and anabin registries; EQAR, ABET, and JABEE accreditation; Common App partner data; and OpenAlex external-authoritative data. Japan e-Stat persisted only an authentication-error response and is listed separately above.

## Runtime checks and provenance

- Every enabled provider was configured, registered through a production adapter family, and selectable by the external-source planner. The search provider family is registered as search_index; its configured adapter identity is search_provider.
- Successful source rows carry provider ID, dataset ID where configured, source class, authority, relationship, HTTP status/content type, content hash, run ID, and raw object path. Matching staging attempts carry the same provider/dataset/source metadata.
- Persisted JSON resources used raw/json/*.json.gz; persisted HTML resources used raw/html/*.html.gz. IPEDS/Scorecard bulk resources did not reach the raw path in this run (IPEDS robots timeout; Scorecard URL 404), so ZIP metadata could not be live-confirmed.
- Search endpoints failed before returning candidates, so no snippet was available to become a fact. The deterministic search contract was also checked: candidates are marked snippet-only, require an authoritative fetch, and never create assertions.
- Arquivo.pt capture discovery was blocked by HTTP 403 at robots; no historical capture was fetched. The archive adapter and deterministic tests retain TemporalState.HISTORICAL; no archive evidence was promoted to current truth.
- No fixture adapter ID appeared in any live registry. No assertion files or promotion output were created, and LLM/provider extraction calls were zero.

## Configuration findings

The following are genuine configuration defects observed at their real endpoints: UNESCO lacks the required geoUnit or indicator query parameter; Crossref emits the unsupported page parameter; both Scorecard bulk entries use a 404 download locator; Discover Uni redirects to a domain not admitted by its configuration; and the data.europa.eu and Data.gov catalogue endpoints returned 400/404 before discovery. These are BAD_CONFIG, distinct from upstream blocks and missing credentials.

## Deterministic checks

The relevant local tests passed: test_external_acquisition.py 34/34, test_source_ecosystem.py 3/3, test_source_adapters.py 11/11, test_raw_evidence.py 16/16, and test_supabase_storage.py 5/5. The three initial test-loader attempts from the wrong working directory were import-path setup errors; reruns with the test package path passed.

## Verdict

Because seven enabled replacement entries still produce genuine BAD_CONFIG results, the requested zero-defect condition is not met. The live successes demonstrate working government, registry, accreditation, partner, and external-authoritative paths, but the default ecosystem is not ready as a whole until the listed endpoints/configuration are corrected.

C — IMPLEMENTATION/CONFIG DEFECTS REMAIN
