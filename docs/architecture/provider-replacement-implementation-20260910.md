# External provider replacement implementation — 2026-09-10

This pass changes only the external-source acquisition implementation and its
provider catalogue. It does not run a live provider check, an estimator, an
LLM, a topology experiment, Benchmark V3, promotion, or canonical ingestion.

## Providers replaced

The default catalogue no longer depends on credentialed or known-blocked
providers. `college_scorecard`, `ucas`, `ror`, `internet_archive`, and
`bing_web_search` remain present as `optional: true`, `enabled: false` entries.
The former IPEDS live endpoint is retained as `ipeds_nces_live` with the same
optional/disabled status. The enabled replacement set is:

| Need | Enabled provider | Resolution / format |
| --- | --- | --- |
| US government institution data | `ipeds` | institution; ZIP containing CSV |
| US government Scorecard data | `college_scorecard_bulk` | institution; ZIP/CSV |
| US government affordability/cost | `usdoe_affordability` | institution; ZIP/CSV |
| UK public course data | `discover_uni_hesa` | programme; ZIP/CSV/XML metadata |
| external scholarly authority | `crossref` | institution/context; JSON API |
| production archive | `arquivo_pt` | historical capture; CDX/HTML/PDF/JSON |
| European catalogue discovery | `data_europa_eu` | dataset discovery; JSON |
| US catalogue discovery | `data_gov_us` | dataset discovery; JSON |

Existing Eurostat, Japan e-Stat, Singapore, UNESCO, CRICOS, EQAR, anabin,
accreditation, Common App, OpenAlex, and other configured providers remain in
the catalogue. Crossref is explicitly rate-limited and carries a public
User-Agent descriptor; it is not treated as programme tuition evidence.

## Adapters and registry

The existing generic `GovernmentDatasetAdapter`, `OfficialRegistryAdapter`,
`AccreditationRegistryAdapter`, `PartnerSourceAdapter`,
`ExternalAuthoritativeAdapter`, `ArchiveSourceAdapter`, and `HttpSearchProvider`
are reused; the existing specialized IPEDS and Scorecard adapters now consume
the configured bulk resource specifications as well. `build_source_registry()` registers enabled catalogue entries by
source family, while an explicitly supplied `external_provider_ids` list can
opt into a disabled legacy entry for a controlled fallback. Disabled entries
remain excluded when no explicit allow-list is supplied. The
`external_source_expansion` planner continues to put government, registry,
external-authoritative, accreditation, partner, archive, and discovery classes
ahead of ordinary university web sources.

Search providers retain the mandatory discovery-only flow. Search rows carry a
provider/dataset identity and a nested resource locator when configured, but
snippets never become assertions. The next stage must admit and fetch the
returned authoritative resource under its own source rule.

## Structured formats and safety

`ExternalProviderConfig` now round-trips `formats` and provider byte limits.
Generic and specialized fetch metadata passes bounded `max_bytes`, accepted
content type, rate-limit, request, dataset, and provider metadata to
`SafeFetcher`. `XmlDocumentParser` and `ZipDocumentParser` add deterministic
structured parsing for XML and ZIP members containing JSON/CSV/XML. ZIP member
count, member size, total uncompressed size, and path traversal are bounded.
The ZIP parser honors response content type or ZIP magic before using a `.zip`
locator, so an incorrectly labelled non-ZIP response is parsed by its actual
format rather than raising a false ZIP error.

## Provenance and temporal semantics

Provider ID, dataset ID, authority, relationship, source class, resolution,
academic/data cycle, supported formats, retrieval policy, and byte limits remain
on the candidate and are carried through the existing raw/staging boundary.
No new evidence store is introduced. Archive candidates are forced to
`TemporalState.HISTORICAL` and retain original URL, capture URL, timestamp,
archive provider, and capture digest metadata. Institution-level government
records remain institution-level; course identifiers from Discover Uni are
retained as source metadata and are not equated with canonical programme IDs.

## Files changed for this pass

* `services/data-ingestion/configs/external-providers.json`
* `services/data-ingestion/src/glowbal_ingestion/config.py`
* `services/data-ingestion/src/glowbal_ingestion/external_sources.py`
* `services/data-ingestion/src/glowbal_ingestion/source_adapters.py`
* `services/data-ingestion/src/glowbal_ingestion/parser_registry.py`
* `services/data-ingestion/tests/test_external_acquisition.py`
* `docs/current-status.md`

## Deterministic validation

No network calls were made. The following local checks passed:

* external acquisition/replacement tests: **34/34**;
* source-adapter tests: **11/11**;
* source-ecosystem tests: **3/3**;
* complete `test_core.py` ingestion suite: **185/185**;
* full discoverable ingestion test suite: **424/424**;
* Python compilation for the changed ingestion modules.

## Later runtime dependencies

The replacement catalogue still depends on upstream availability and robots or
rate-limit policy. Provider credentials remain external for optional Japan,
College Scorecard API, ROR, Bing, and similar entries. A future validation pass
must make bounded real requests and verify raw persistence; this implementation
pass deliberately does not do that.

**Verdict: A — PROVIDER REPLACEMENT IMPLEMENTATION COMPLETE**
