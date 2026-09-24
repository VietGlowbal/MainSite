# Production external-source acquisition live audit

Date: 2026-09-10

This was a bounded read/check only. It made no production-code, benchmark,
promotion, inference, canonical-truth, or Remediation 13 change. It made zero
LLM/provider-extraction calls, ran no estimator, and did not run the population
topology experiment.

The provider catalogue contains 20 real-domain entries (19 enabled): six
government datasets, three official registries, four accreditation providers,
two official partners, three trusted external datasets, one archive provider,
and one optional search provider. A catalogue scan found no placeholder URLs.
With `allow_fixture_adapters=false`, every enabled provider selected its
production adapter in `build_source_registry()`. The external-source-expansion
planner includes all seven tested source classes for a tuition intent. The
disabled Bing entry was enabled only in an in-memory audit copy to test its real
request path; the catalogue remains disabled until its credential is supplied.

## Provider results

The provider checks used a synthetic seed appropriate to the provider's country,
the real configured URL/resource, `SafeFetcher`, the normal resolver and
robots-policy gate, and the existing `InMemoryRawEvidenceStore` raw boundary.
HTTP-call counts include the seed robots request, provider robots request, and
resource/discovery requests. They are not a crawl.

The provider pass consumed 31 observed HTTP calls. The separate normal-pipeline
OpenAlex check consumed 3, and three small Eurostat endpoint probes were used to
separate an invalid pagination configuration from an upstream outage. No other
providers or population resources were crawled.

| Provider | Source class | Adapter registered | Config/planner | HTTP calls | Candidate/admitted | Retrieved | Raw persisted | Authority / relationship | Result |
|---|---|---|---|---:|---|---|---|---|---|
| IPEDS | government_dataset | `ipeds` + generic government | yes | 2 | yes / yes | no | no | GOVERNMENT / GOVERNMENT | **UPSTREAM_BLOCKED** — `nces.ed.gov/robots.txt` timed out |
| College Scorecard | government_dataset | `college_scorecard` + generic government | yes | 4 | yes / yes | no | no | GOVERNMENT / GOVERNMENT | **CREDENTIAL_REQUIRED** — API pages returned 403 without the configured key |
| Eurostat education | government_dataset | generic government | yes | 3 | yes / yes | no | no | GOVERNMENT / GOVERNMENT | **BAD_CONFIG** — configured `limit=100&startPeriod=0` produced 400; the same endpoint with `geo=DE` returned 200 in a bounded probe |
| CRICOS Australia | official_registry | `official_registry` | yes | 3 | yes / yes | yes | yes | GOVERNMENT / GOVERNMENT | **SUCCESS** |
| EQAR accreditation | accreditation | `accreditation_registry` | yes | 3 | yes / yes | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | **SUCCESS** |
| ABET | accreditation | `accreditation_registry` | yes | 3 | yes / yes | yes | yes | ACCREDITED_PROVIDER / ACCREDITATION_BODY | **SUCCESS** |
| UCAS | official_partner | `official_partner` | yes | 2 | yes / yes | no | no | OFFICIAL_PARTNER / CONSORTIUM | **UPSTREAM_BLOCKED** — admitted URL rejected by UCAS robots |
| OpenAlex | external_authoritative | `external_authoritative` | yes | 3 | yes / yes | yes | yes | TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER | **SUCCESS** |
| ROR | external_authoritative | `external_authoritative` | yes | 2 | yes / yes | no | no | TRUSTED_AGGREGATOR / CATALOGUE_PROVIDER | **UPSTREAM_BLOCKED** — API robots returned 403 |
| Internet Archive Wayback | archive | `archive_http` | yes | 3 | no / no | no | no | ARCHIVE / ARCHIVE | **UPSTREAM_BLOCKED** — CDX discovery returned 429 |
| Bing Web Search (optional) | search_discovery | `search_index` when enabled | catalogue entry exists but disabled; audit copy enabled | 3 | no / no | no | no | OTHER / OTHER_RELATED | **CREDENTIAL_REQUIRED** — endpoint returned 401 |

The complete machine-readable ledger is
[`external-source-live-audit-20260910.json`](data/external-source-live-audit-20260910.json).

## What the live results establish

The registry/planner path does not silently drop configured external classes.
CRICOS, EQAR, ABET, and OpenAlex made real requests and persisted raw
resources. Their raw documents carried the configured provider ID, dataset ID,
source class, authority, relationship, cycle/resolution, content type, status,
and content hash. The direct checks used the existing local raw store; no
Supabase write was attempted.

The normal pipeline path was also checked once with OpenAlex. Run
`glowbal-external-pipeline-hz4jegia` produced one `sources.jsonl` row and one
raw JSON object. The row had `external_authoritative`, `external_authoritative`,
`openalex`, `openalex-institutions`, `TRUSTED_AGGREGATOR`, and
`CATALOGUE_PROVIDER`; the acquisition-attempt staging rows carried the same
lineage and `RAW_PERSISTED` state. This verifies staging serialization and
provenance propagation without writing to Supabase.

Search remains discovery-only. The live Bing request returned no result, so no
snippet candidate was emitted. Deterministic tests also assert that search
results are marked `search_snippet`/snippet-only and cannot become factual
evidence without an admitted authoritative fetch. Archive discovery produced no
capture in this run; deterministic adapter tests assert that any archive
candidate is `ARCHIVE` and `TemporalState.HISTORICAL`, never current by default.

No fixture adapter was present in any live registry. Fixture search/archive
implementations remain opt-in behind `allow_fixture_adapters`; they were not
used here.

## Deterministic checks

The targeted source, resolver, raw-evidence, acquisition, ecosystem, and
Supabase-storage tests passed **69/69**. This covers external-domain admission,
provider/dataset provenance, search snippet non-truth, archive historical
semantics, raw persistence, and staging field mapping. It does not turn an
upstream outage or missing credential into a code failure.

The main implementation/configuration defect found is the Eurostat provider's
pagination configuration. The endpoint itself responded 200 when queried with
a valid filter, so this is a catalogue/configuration issue rather than a
government endpoint outage. The remaining non-success cases are runtime
robots, rate-limit, or credential blockers.

## Final assessment

Production acquisition pathways are present and exercised for every requested
source class, with successful raw persistence outside university-controlled
domains. The platform is not ready to claim clean multi-source runtime
coverage until the Eurostat request configuration is corrected and optional
credentials/upstream policies are handled. No fixes were applied in this audit.

C — IMPLEMENTATION/CONFIG DEFECTS FOUND
