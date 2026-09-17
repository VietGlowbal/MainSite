# Production external-source acquisition

This change wires the source ecosystem into the existing evidence-only
acquisition path. It does not extract assertions, promote truth, run an
estimator, change Benchmark V3, or call an LLM.

## Implementation completion (2026-09-10; runtime validation intentionally not run)

The production acquisition pathways are now implemented for the complete
configured source ecosystem: government/national datasets, official education
registries, accreditation registries, official partners and consortiums,
trusted external structured datasets, bounded archive capture retrieval, and a
pluggable HTTP search/discovery provider. The implementation is configuration
driven and uses the existing SafeFetcher, raw-evidence stores, staging streams,
and admission rules. No live provider request, smoke acquisition, integration
run, LLM/provider call, estimator, Benchmark V3 run, promotion, inference, or
topology experiment was run for this completion pass.

The provider catalogue contains 20 entries (19 enabled) covering the US,
Europe, Asia, Australia, the UK, and global providers. It includes IPEDS and
College Scorecard, Eurostat, Japan e-Stat, Singapore data.gov.sg, UNESCO UIS,
CRICOS, anabin, EQAR, CHEA, ABET, JABEE, UCAS, Common App, OpenAlex, ROR,
Crossref, Internet Archive, and an optional disabled Bing search provider.

The remaining runtime dependencies are upstream availability, optional API
credentials, archive/search access policy, and any partner agreements. Those
dependencies are intentionally deferred to the separately authorized runtime
validation task.

## Audit before editing

The prior runtime audit found that AcquisitionPlatformBackend could be
constructed with a registry containing only the official catalogue adapter.
IPEDS and College Scorecard had specialized loaders and candidate wrappers but
no provider-catalogue path in the default runtime. JsonApiSourceAdapter was
usable only for inline configured resources. Search and archive were
fixture-backed (FixtureSearchProvider and FixtureArchiveAdapter). There was no
reusable government dataset, registry/accreditation, partner, or trusted
external provider abstraction, and Supabase source serialization omitted the
new provider/source metadata.

| Capability | Previous state | Current state |
| --- | --- | --- |
| IPEDS | PARTIALLY_IMPLEMENTED: specialized loader and fixture/config candidates | PRODUCTION_READY for configured HTTP resource acquisition; institution-level metadata only |
| College Scorecard | PARTIALLY_IMPLEMENTED: specialized candidate wrapper | PRODUCTION_READY for configured HTTP resource acquisition; not a programme-level tuition source by itself |
| JsonApiSourceAdapter | CONFIG_ONLY for inline resources | PRODUCTION_READY when configured; GET/POST, headers/body, content-type and dataset metadata reach the normal fetch path |
| Search | FIXTURE_ONLY | PRODUCTION_READY for a bounded configured HTTP JSON discovery provider; optional credentials remain external and snippets stay discovery-only |
| Archive | FIXTURE_ONLY | PRODUCTION_READY for bounded configured CDX/capture discovery and retrieval with historical semantics; no recursive crawler is claimed |
| Government beyond IPEDS/Scorecard | MISSING | PRODUCTION_READY generic JSON/CSV/structured-resource candidate adapter |
| Official registry | MISSING | PRODUCTION_READY generic configured registry adapter |
| Accreditation | MISSING | PRODUCTION_READY generic configured accreditation adapter |
| Partner/consortium | MISSING | PRODUCTION_READY generic admission-aware adapter; concrete provider resources and per-institution rules remain configuration work |
| Official catalogue providers | PRODUCTION_READY for existing official/Coursedog discovery | Existing path retained; external catalogue providers can use the partner adapter |
| Trusted external authoritative sources | MISSING | PRODUCTION_READY generic adapter; OpenAlex is a configured representative provider |

The root runtime failure was configuration and registry construction, rather
than a missing assertion model. The previous default did not operationalize
configured provider classes, and the staging serializer dropped source class,
adapter, provider, dataset, and academic-cycle fields.

## Provider catalogue and registry

The independent catalogue is
[external-providers.json](../../services/data-ingestion/configs/external-providers.json).
It currently describes 20 providers across government datasets, official
registries, accreditation, partners, trusted external datasets, archives, and
search discovery. The bounded validation configuration is
[external-source-expansion-validation.json](../../services/data-ingestion/configs/external-source-expansion-validation.json).
That configuration reuses the existing ipeds-us-21.json target mapping; it
does not duplicate the target population.

The schema is JSON (the project's existing configuration convention) and has
this shape:

~~~json
{
  "source_ecosystem": {
    "acquisition_mode": "external_source_expansion",
    "required_source_classes": ["government_dataset", "official_registry"],
    "external_provider_catalogue": "external-providers.json",
    "government_datasets": {"enabled": true, "providers": ["ipeds"]},
    "external_authoritative": {"enabled": true},
    "archives": {"enabled": true},
    "search_discovery": {"enabled": false}
  },
  "external_providers": [
    {
      "provider_id": "provider",
      "source_class": "government_dataset",
      "authority": "GOVERNMENT",
      "relationship": "GOVERNMENT",
      "base_url": "https://data.example.gov/resource.json",
      "dataset_id": "dataset-v1",
      "retrieval_method": "GET",
      "field_groups": ["institution_metadata"],
      "academic_cycle": "2024-25",
      "enabled": true
    }
  ]
}
~~~

ExternalProviderConfig validates HTTP(S) resources, authority, relationship,
retrieval method, scope, dataset identity, cycle, field groups, query
parameters, request headers/body, and archive metadata. ExternalSourceRule
still grants admission per institution and carries the explicit domain,
adapter, provider, authority, relationship, and reason. An external URL with
no matching rule is rejected. Optional query credentials are resolved only at
the SafeFetcher request boundary and removed from response/redirect locators
before provenance is persisted.

Runtime construction is:

~~~text
SmokeConfig.load
  -> SourceEcosystemConfig + provider catalogue
  -> SmokePipeline
  -> AcquisitionPlatformBackend
  -> build_source_registry(config)
  -> configured_source_decisions()
  -> SourceResolver / ExternalSourceRule
  -> SafeFetcher
  -> _fetch_and_parse_source
  -> RawSnapshotInput / existing raw evidence store
~~~

build_source_registry() registers only enabled/configured adapters. It now
supports the existing official web/catalogue/PDF/API/IPEDS/Scorecard adapters,
the generic government, registry, accreditation, partner, external-authority,
production archive, and configured HTTP search adapters. Fixture search/archive
adapters remain opt-in through allow_fixture_adapters.

external_source_expansion is an explicit planner mode. For tuition it orders
government datasets, registries, external authoritative sources, accreditation,
partners, archive, and then official sources. Default mode keeps the previous
ordering.

## Acquisition and coverage gates

GovernmentDatasetAdapter is the reusable raw-resource abstraction for HTTP
JSON, downloadable JSON, CSV, and other structured resources. CSV is parsed by
the deterministic CsvDocumentParser; no row is turned into a programme fact by
this layer. IPEDS and Scorecard retain their existing specialized institution
mapping and are not represented as programme-level exact tuition unless their
own data explicitly has that resolution.

OfficialRegistryAdapter, AccreditationRegistryAdapter, and PartnerSourceAdapter
share the configured-provider contract. EQAR is the representative registry
provider in the catalogue. ExternalAuthoritativeAdapter is used by OpenAlex.
ArchiveSourceAdapter records original_url, provider, capture metadata, and
always sets TemporalState.HISTORICAL; archive evidence cannot silently become
current truth.

HttpSearchProvider retrieves JSON search results only to create candidate URLs.
SearchSourceAdapter marks every candidate snippet_only and search_snippet; the
normal resolver must admit and fetch the candidate before it can enter raw
evidence. There is no configured paid search dependency, so search enabled
without an endpoint is explicitly NOT_CONFIGURED.

SourceClassCoverageGate reports PRESENT, RETRIEVAL_SUCCEEDED, FETCH_FAILED,
ATTEMPTED_NO_YIELD, CANDIDATE_NOT_FOUND, ADMISSION_REJECTED,
DISCOVERY_FAILED, NOT_CONFIGURED, and UNSUPPORTED. The accompanying monotonic
execution state is CONFIGURED, ADAPTER_READY, DISCOVERY_ATTEMPTED,
CANDIDATES_FOUND, ADMITTED, RETRIEVED, RAW_PERSISTED, NO_YIELD, or
HARD_BLOCKED. It marks an expansion experiment invalid when none of its
required classes has an actual fetch attempt, preventing a university-only run
from looking like a successful external-source experiment.

## Retained prior live validation (2026-09-09; not rerun in this task)

The previous task's bounded validation used
[validate_external_source_live.py](../../services/data-ingestion/scripts/validate_external_source_live.py)
with the one-seed configuration and one OpenAlex provider resource. It did not
run the programme crawler or extraction provider. The retained run is isolated
under [external-source-live-smoke-20260909c](data/external-source-live-smoke-20260909c/).

| Provider | Source class | Attempted | Retrieved | Persisted | Authority | Relationship | Failure |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| OpenAlex institutions | external_authoritative | 1 | 1 | 1 | TRUSTED_AGGREGATOR | CATALOGUE_PROVIDER | none |

The run made three HTTP requests: MIT robots.txt, OpenAlex robots.txt, and
the OpenAlex institutions JSON endpoint. The external resource returned HTTP
200 and was persisted through the normal local raw-evidence path as
application/json (76,426 response bytes; compressed retained object 8,030
bytes). The source row carries:

~~~text
source_class=external_authoritative
adapter_id=external_authoritative
provider_id=openalex
dataset_id=openalex-institutions
source_authority=TRUSTED_AGGREGATOR
source_relationship=CATALOGUE_PROVIDER
temporal_state=UNKNOWN
academic_cycle=2024-25
parser_id=json-structured
~~~

That retained run's coverage gate was PRESENT, experiment_valid=true, and ready=true for
the required external_authoritative class. LLM calls, DeepSeek calls, provider
extraction calls, assertion creation, and promotion were all zero.

IPEDS, Scorecard, EQAR, and the Internet Archive provider were configured and
registered but were not fetched in that one-resource validation. This historical
record is retained for provenance; it is not evidence of runtime validation for
the 2026-09-10 implementation pass.

## Persistence and staging

External resources use the existing RawSnapshotInput, local/remote/dual raw
store, parser, sources.jsonl, acquisition-attempt, source-candidate, and
source-ecosystem-fetch streams. RawDocument, SourceDocument, candidate rows, and
attempt rows retain authority, relationship, source class, adapter, provider,
dataset, temporal state, cycle, content type, hash, retrieval time, and run
identity. Search snippets never enter those rows as assertions.

[supabase-external-source-provenance.sql](../../supabase-external-source-provenance.sql)
is an additive staging migration. It adds provider/source fields and indexes to
crawl_sources, crawl_source_candidates, and crawl_acquisition_attempts; it does
not change canonical promotion. The migration was not applied in this
workspace. The existing Supabase importer now emits the same fields, so a future
run can be isolated by run_id, source_class, provider_id, dataset_id, authority,
relationship, and temporal_state after the migration is applied.

## Deterministic checks and runtime dependencies

The focused external-acquisition suite passes 26/26 tests. The source,
ecosystem, raw-evidence, acquisition, and Supabase regression set passes
43/43, and the complete data-ingestion unit suite passes 427/427. Python
compile checks and `git diff --check` pass. These checks use fixtures and
in-memory stores only; no external network or provider request was made in the
implementation pass.

All target source classes now have code-level pathways. Later runtime work still
requires upstream availability and, where selected, optional credentials for
College Scorecard, Japan e-Stat, Bing search, or other protected resources.
Partner systems may require explicit agreements or domain rules. Archive
captures remain historical, search remains discovery-only, and IPEDS/Scorecard
remain institution-resolution context unless a provider resource explicitly
declares a finer resolution. None of these runtime conditions changes the
implementation status of the adapters.

**B — IMPLEMENTATION COMPLETE; EXTERNAL RUNTIME DEPENDENCIES REQUIRED**
