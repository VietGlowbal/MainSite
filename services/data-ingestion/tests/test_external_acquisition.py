import hashlib
import io
import json
import os
import sys
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from glowbal_ingestion.acquisition import AcquisitionIntent, EntityRef, SourceCandidate
from glowbal_ingestion.config import (
    ExternalProviderConfig,
    ExternalSourceRule,
    InstitutionSeed,
    SmokeConfig,
    SourceEcosystemConfig,
)
from glowbal_ingestion.external_sources import (
    ArchiveSourceAdapter,
    HttpSearchProvider,
    SourceClassExecutionState,
    SourceClassCoverageGate,
    parse_archive_captures,
)
from glowbal_ingestion.fetcher import FetchError
from glowbal_ingestion.models import (
    FetchResult,
    RawDocument,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
)
from glowbal_ingestion.raw_evidence import InMemoryRawEvidenceStore
from glowbal_ingestion.parser_registry import ParserError, ParserRegistry
from glowbal_ingestion.source_adapters import (
    AcquisitionPlatformBackend,
    GovernmentDatasetAdapter,
    SearchSourceAdapter,
    SourceAdapterContext,
    SourceAdmissionDecision,
    SourceResolver,
    build_source_registry,
    persist_admitted_fetch,
)
from glowbal_ingestion.supabase_import import _source_rows
from glowbal_ingestion.supabase_import import _source_candidate_rows, _acquisition_attempt_rows


class _Robots:
    def allows(self, url, user_agent, *, allowed_domains=()):
        del url, user_agent
        return bool(allowed_domains)


class _Fetch:
    limits = type("Limits", (), {"user_agent": "external-acquisition-test"})()

    def __init__(self, payload=b'{"ok":true}', content_type="application/json"):
        self.payload = payload
        self.content_type = content_type
        self.calls = []

    def fetch(self, url, *, allowed_domains, **kwargs):
        if not allowed_domains:
            raise FetchError("missing admitted domain", code="NO_DOMAIN", url=url)
        self.calls.append((url, dict(kwargs)))
        return FetchResult(
            requested_url=url,
            final_url=url,
            status=200,
            headers={"content-type": self.content_type},
            content_type=self.content_type,
            body=self.payload,
            content_hash=hashlib.sha256(self.payload).hexdigest(),
            retrieved_at="2026-09-09T00:00:00+00:00",
        )


def _provider(**overrides):
    data = {
        "provider_id": "openalex",
        "source_class": "external_authoritative",
        "authority": "TRUSTED_AGGREGATOR",
        "relationship": "CATALOGUE_PROVIDER",
        "countries": ["*"],
        "base_url": "https://api.openalex.org/institutions",
        "query_parameter": "search",
        "dataset_id": "openalex-institutions",
        "field_groups": ["institution_metadata"],
        "adapter_id": "external_authoritative",
    }
    data.update(overrides)
    return ExternalProviderConfig.from_dict(data)


def _seed(rules=()):
    return InstitutionSeed(
        institution_id="mit-us",
        name="Massachusetts Institute of Technology",
        country_code="US",
        official_domain="mit.edu",
        homepage_url="https://www.mit.edu/",
        external_source_rules=tuple(rules),
    )


def _intent(source_classes=("external_authoritative",)):
    return AcquisitionIntent.create(
        entity=EntityRef("UNIVERSITY", "mit-us"),
        field_groups=("tuition",),
        reason="external-provider-test",
        target_cycle="2024-25",
        preferred_source_classes=tuple(source_classes),
    )


def _large_csv_zip(
    *,
    member_name="Most-Recent-Cohorts-Institution.csv",
    target_unitid="100654",
    filler_rows=5_300_000,
):
    """Build a compact compressed ZIP whose CSV member exceeds 64 MiB."""
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
        with handle.open(member_name, "w") as member:
            member.write(b"UNITID,tuition\n")
            member.write(f"{target_unitid},10000\n".encode("ascii"))
            block = b"999999,12000\n" * 100_000
            for _ in range(max(1, filler_rows // 100_000)):
                member.write(block)
    return archive.getvalue()


class ExternalProviderConfigTests(unittest.TestCase):
    def test_catalogue_round_trips_request_metadata(self):
        provider = _provider(
            query_parameter="q",
            request_headers={"X-Test": "ENV:EXTERNAL_TEST_TOKEN"},
            request_body={"rows": 1},
            accept="application/json",
        )
        encoded = provider.to_dict()
        self.assertEqual(encoded["query_parameter"], "q")
        self.assertEqual(encoded["request_headers"]["X-Test"], "ENV:EXTERNAL_TEST_TOKEN")
        self.assertEqual(encoded["request_body"], {"rows": 1})
        self.assertEqual(ExternalProviderConfig.from_dict(encoded), provider)

    def test_catalogue_round_trips_provider_execution_contract(self):
        provider = _provider(
            provider_type="trusted_external_dataset",
            retrieval_type="csv",
            resolution="institution",
            identifier_mapping={"unitid": "institution_id"},
            pagination={"strategy": "offset", "offset_parameter": "offset", "max_pages": 2},
            rate_limit_policy={"min_interval_seconds": 0.25},
            authentication_mode="optional",
            authentication={"mode": "optional", "token_env": "OPTIONAL_TOKEN"},
            resource_urls=["https://api.openalex.org/institutions", {"query_endpoint": "https://api.openalex.org/works"}],
            max_results=25,
        )
        encoded = provider.to_dict()
        restored = ExternalProviderConfig.from_dict(encoded)
        self.assertEqual(restored.provider_type, "trusted_external_dataset")
        self.assertEqual(restored.retrieval_type, "csv")
        self.assertEqual(restored.resolution, "institution")
        self.assertEqual(restored.identifier_mapping["unitid"], "institution_id")
        self.assertEqual(restored.pagination["max_pages"], 2)
        self.assertEqual(restored.resource_urls[1], "https://api.openalex.org/works")

    def test_multi_region_provider_catalogue_is_config_parseable(self):
        catalogue = ExternalProviderConfig.load_catalogue(
            Path(__file__).parents[1] / "configs" / "external-providers.json"
        )
        self.assertGreaterEqual(len(catalogue), 10)
        self.assertTrue({"US", "JP", "AU", "DE"}.issubset({country for item in catalogue for country in item.countries}))
        self.assertTrue({"government_dataset", "official_registry", "accreditation", "official_partner", "external_authoritative", "archive", "search_discovery"}.issubset({item.source_class for item in catalogue}))

    def test_registry_registers_configured_external_provider_classes(self):
        config = SourceEcosystemConfig(
            enabled=True,
            runtime_acquisition_enabled=True,
            official_web_enabled=False,
            official_catalogue_enabled=False,
            government_datasets_enabled=True,
            external_authoritative_enabled=True,
            archives_enabled=True,
            external_providers=(
                ExternalProviderConfig.from_dict({
                    "provider_id": "gov-json",
                    "source_class": "government_dataset",
                    "authority": "GOVERNMENT",
                    "relationship": "GOVERNMENT",
                    "base_url": "https://data.gov/resource.json",
                    "adapter_id": "government_dataset",
                }),
                _provider(),
                ExternalProviderConfig.from_dict({
                    "provider_id": "registry",
                    "source_class": "official_registry",
                    "authority": "ACCREDITED_PROVIDER",
                    "relationship": "ACCREDITATION_BODY",
                    "base_url": "https://registry.example/search",
                    "adapter_id": "official_registry",
                }),
                ExternalProviderConfig.from_dict({
                    "provider_id": "archive",
                    "source_class": "archive",
                    "authority": "ARCHIVE",
                    "relationship": "ARCHIVE",
                    "resource_url": "https://web.archive.org/cdx?url=https://{official_domain}/",
                    "adapter_id": "archive_http",
                }),
            ),
        )
        registry = build_source_registry(config)
        self.assertEqual(
            set(registry.adapter_ids),
            {"government_dataset", "external_authoritative", "official_registry", "archive_http"},
        )

    def test_registry_registers_all_catalogue_source_families_without_io(self):
        providers = ExternalProviderConfig.load_catalogue(
            Path(__file__).parents[1] / "configs" / "external-providers.json"
        )
        config = SourceEcosystemConfig(
            enabled=True,
            official_web_enabled=False,
            official_catalogue_enabled=False,
            external_providers=providers,
        )
        registry = build_source_registry(config)
        self.assertTrue({"government_dataset", "official_registry", "accreditation_registry", "official_partner", "external_authoritative", "archive_http"}.issubset(set(registry.adapter_ids)))

    def test_external_first_planner_keeps_external_classes_before_university_web(self):
        from glowbal_ingestion.source_adapters import AcquisitionPlanner

        intent = AcquisitionPlanner(mode="external_source_expansion").plan(
            entity=EntityRef("UNIVERSITY", "mit-us"), field_groups=("tuition",)
        )[0]
        self.assertEqual(intent.preferred_source_classes[0], "government_dataset")
        self.assertLess(
            intent.preferred_source_classes.index("government_dataset"),
            intent.preferred_source_classes.index("official_web"),
        )

    def test_catalogue_routes_tuition_only_to_matching_existing_providers(self):
        config = SmokeConfig.load(
            Path(__file__).parents[1] / "configs" / "external-source-expansion-validation.json"
        )
        discovery = type("Discovery", (), {"discover": lambda self, seed, policy: ([], [], [])})()
        backend = AcquisitionPlatformBackend(
            discovery,
            mode="platform_shadow",
            source_ecosystem=config.source_ecosystem,
        )
        decisions = backend.configured_source_decisions(config.institutions[0], _Robots())
        self.assertEqual(
            {decision.candidate.adapter_id for _, decision in decisions},
            {"ipeds", "archive_http"},
        )
        self.assertNotIn(
            "openalex",
            {decision.candidate.provider_id for _, decision in decisions},
        )
        ipeds_datasets = {
            decision.candidate.dataset_id
            for _, decision in decisions
            if decision.candidate.provider_id == "ipeds"
        }
        self.assertEqual(ipeds_datasets, {"IPEDS-COST1_2024"})
        self.assertTrue(
            all(
                set(decision.candidate.expected_field_groups)
                == {"tuition", "finance"}
                for _, decision in decisions
                if decision.candidate.provider_id == "ipeds"
            )
        )

    def test_provider_resource_path_expands_dataset_and_collection_identifiers(self):
        provider = ExternalProviderConfig.from_dict({
            "provider_id": "eurostat",
            "source_class": "government_dataset",
            "authority": "GOVERNMENT",
            "relationship": "GOVERNMENT",
            "base_url": "https://data.example.gov/data",
            "resource_path": "{dataset_id}",
            "dataset_id": "education-v1",
            "collection_year": "2023",
            "field_applicability": ["institution_metadata"],
        })
        self.assertEqual(provider.academic_cycle, "2023")
        self.assertEqual(provider.field_applicability, ("institution_metadata",))
        context = SourceAdapterContext(
            entity=EntityRef("UNIVERSITY", "demo"),
            seed=_seed(),
            field_groups=("institution_metadata",),
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates, _ = build_source_registry(
            SourceEcosystemConfig(enabled=True, external_providers=(provider,))
        ).discover(
            _intent(("government_dataset",)),
            context,
            only_adapter_ids=("government_dataset",),
        )
        self.assertEqual(candidates[0].canonical_locator, "https://data.example.gov/data/education-v1")

    def test_eurostat_catalogue_uses_valid_country_filter_without_offset_pagination(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "eurostat_education"
        )
        seed = InstitutionSeed(
            institution_id="tum-de",
            name="Technical University of Munich",
            country_code="DE",
            official_domain="tum.de",
            homepage_url="https://www.tum.de/",
        )
        intent = _intent(("government_dataset",))
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=seed,
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates, _ = build_source_registry(
            SourceEcosystemConfig(
                enabled=True,
                government_datasets_enabled=True,
                external_providers=(provider,),
            )
        ).discover(intent, context, only_adapter_ids=("government_dataset",))
        self.assertEqual(len(candidates), 1)
        query = parse_qs(urlsplit(candidates[0].canonical_locator).query)
        self.assertEqual(query["geo"], ["DE"])
        self.assertEqual(query["format"], ["JSON"])
        self.assertEqual(query["lang"], ["en"])
        self.assertNotIn("startPeriod", query)
        self.assertNotIn("limit", query)

    def test_resource_urls_only_provider_is_valid(self):
        provider = ExternalProviderConfig.from_dict({
            "provider_id": "resource-list",
            "source_class": "external_authoritative",
            "authority": "TRUSTED_AGGREGATOR",
            "relationship": "CATALOGUE_PROVIDER",
            "resource_urls": [{"url": "https://api.example/items/{dataset_id}"}],
            "dataset_id": "items",
        })
        self.assertEqual(provider.resource_urls, ("https://api.example/items/{dataset_id}",))

    def test_repaired_unesco_request_has_required_dimensions(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "unesco_uis"
        )
        context = SourceAdapterContext(
            entity=EntityRef("UNIVERSITY", "mit-us"),
            seed=_seed(),
            field_groups=("institution_metadata",),
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates, _ = build_source_registry(
            SourceEcosystemConfig(enabled=True, external_providers=(provider,))
        ).discover(
            _intent(("government_dataset",)),
            context,
            only_adapter_ids=("government_dataset",),
        )
        self.assertEqual(len(candidates), 1)
        query = parse_qs(urlsplit(candidates[0].canonical_locator).query)
        self.assertEqual(query["geoUnit"], ["USA"])
        self.assertEqual(query["indicator"], ["CR.1"])
        self.assertNotIn("page", query)

    def test_repaired_crossref_uses_offset_pagination(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "crossref"
        )
        self.assertEqual(provider.pagination["strategy"], "offset")
        self.assertEqual(provider.pagination["offset_parameter"], "offset")
        context = SourceAdapterContext(
            entity=EntityRef("UNIVERSITY", "mit-us"),
            seed=_seed(),
            field_groups=("institution_metadata",),
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates, _ = build_source_registry(
            SourceEcosystemConfig(enabled=True, external_providers=(provider,))
        ).discover(
            _intent(("external_authoritative",)),
            context,
            only_adapter_ids=("external_authoritative",),
        )
        self.assertEqual(len(candidates), 2)
        self.assertEqual(
            [parse_qs(urlsplit(item.canonical_locator).query)["offset"] for item in candidates],
            [["0"], ["20"]],
        )
        self.assertTrue(all("page" not in parse_qs(urlsplit(item.canonical_locator).query) for item in candidates))

    def test_repaired_bulk_and_affordability_resources_are_distinct_and_current(self):
        catalogue = {
            item.provider_id: item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
        }
        scorecard = catalogue["college_scorecard_bulk"]
        affordability = catalogue["usdoe_affordability"]
        scorecard_url = scorecard.resource_specs[0]["url"]
        affordability_url = affordability.resource_specs[0]["url"]
        self.assertIn("ed-public-download.scorecard.network", scorecard.domain)
        self.assertIn("Most-Recent-Cohorts-Institution.zip", scorecard_url)
        self.assertNotIn("CollegeScorecard_Raw_Data.zip", scorecard_url)
        self.assertEqual(affordability.domain, "collegecost.ed.gov")
        self.assertIn("CATClists2024.xlsx", affordability_url)
        self.assertNotEqual(scorecard_url, affordability_url)
        self.assertEqual(affordability.resolution, "institution")

    def test_repaired_discover_uni_uses_admitted_official_domain(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "discover_uni_hesa"
        )
        self.assertEqual(provider.domain, "discoveruni.gov.uk")
        self.assertEqual(
            provider.resource_specs[0]["url"],
            "https://discoveruni.gov.uk/course-details/{PUBUKPRN}/{KISCourse}/{KISMODE}/",
        )
        self.assertNotIn("data.unistats.ac.uk", provider.resource_specs[0]["url"])

    def test_duo_rio_uses_filtered_ckan_datastore_route(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "duo_rio_ho"
        )
        resource = provider.resource_specs[0]
        self.assertIn("/api/3/action/datastore_search", resource["url"])
        self.assertIn("{ONDERWIJSBESTUURID}", resource["url"])
        self.assertIn("{OPLEIDINGSEENHEIDCODE}", resource["url"])
        self.assertEqual(resource["retrieval_type"], "json")
        self.assertEqual(provider.field_evidence["record_path"], "result.records")
        self.assertEqual(provider.field_evidence["identity_fields"], [
            "ONDERWIJSBESTUURID",
            "OPLEIDINGSEENHEIDCODE",
        ])

    def test_repaired_catalogue_discovery_contracts(self):
        catalogue = {
            item.provider_id: item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
        }
        data_eu = catalogue["data_europa_eu"]
        self.assertEqual(
            data_eu.query_endpoint,
            "https://data.europa.eu/api/hub/search/ckan/package_search",
        )
        self.assertEqual(data_eu.pagination["strategy"], "offset")
        self.assertEqual(data_eu.pagination["offset_parameter"], "start")
        self.assertEqual(data_eu.pagination["page_size_parameter"], "rows")
        self.assertEqual(data_eu.result_url_field, "id")
        self.assertEqual(
            data_eu.result_url_template,
            "https://data.europa.eu/api/hub/search/ckan/package_show?id={id}",
        )

        data_gov = catalogue["data_gov_us"]
        self.assertEqual(
            data_gov.query_endpoint,
            "https://api.gsa.gov/technology/datagov/v4/search",
        )
        self.assertEqual(data_gov.domain, "api.gsa.gov")
        self.assertEqual(data_gov.result_path, "results")
        self.assertEqual(data_gov.result_url_field, "harvest_record_raw")
        self.assertEqual(data_gov.authentication_mode, "api_key_query")
        self.assertEqual(data_gov.authentication["token_env"], "DATAGOV_API_KEY")
        self.assertEqual(data_gov.pagination["max_pages"], 1)

    def test_catalogue_result_url_template_resolves_identifier_without_assertion(self):
        class CatalogueFetch(_Fetch):
            def __init__(self):
                super().__init__(
                    json.dumps({
                        "result": {
                            "results": [{"id": "dataset-123", "title": "public dataset"}]
                        }
                    }).encode()
                )

        provider = HttpSearchProvider(
            provider_id="data-europa-eu",
            endpoint="https://data.europa.eu/api/hub/search/ckan/package_search",
            domain="data.europa.eu",
            fetcher=CatalogueFetch(),
            result_path="result.results",
            result_url_field="id",
            result_url_template="https://data.europa.eu/api/hub/search/ckan/package_show?id={id}",
            dataset_id="data-europa-datasets",
            source_class="search_discovery",
            authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
        )
        candidates = SearchSourceAdapter(provider).discover(
            _intent(("search_discovery",)),
            SourceAdapterContext(entity=EntityRef("UNIVERSITY", "mit-us"), seed=_seed()),
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(
            candidates[0].canonical_locator,
            "https://data.europa.eu/api/hub/search/ckan/package_show?id=dataset-123",
        )
        self.assertTrue(candidates[0].adapter_metadata["snippet_is_not_evidence"])

    def test_admitted_search_json_resource_uses_normal_raw_parser_boundary(self):
        candidate = SourceCandidate.create(
            canonical_locator="https://data.europa.eu/api/hub/search/ckan/package_show?id=dataset-123",
            locator_type="url",
            source_class="search_discovery",
            adapter_id="search_index",
            provider_id="data_europa_eu",
            dataset_id="data-europa-datasets",
            declared_authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            relationship_evidence=("configured catalogue result",),
            expected_field_groups=("discovery",),
            adapter_metadata={"snippet_only": True, "requires_authoritative_fetch": True},
        )
        config = SmokeConfig(
            run_name="search-json-boundary",
            institutions=(_seed(),),
            source_ecosystem=SourceEcosystemConfig(),
        )
        with TemporaryDirectory() as temporary:
            pipeline = __import__("glowbal_ingestion.pipeline", fromlist=["SmokePipeline"]).SmokePipeline(
                config,
                Path(temporary),
                allow_unreviewed_terms=True,
                discovery_only=False,
                skip_school_profile=True,
            )
            fetcher = _Fetch(json.dumps({"success": True}).encode())
            pipeline.fetcher = fetcher
            try:
                document, parsed, _ = pipeline._fetch_and_parse_source(
                    _seed(),
                    _Robots(),
                    candidate.canonical_locator,
                    source_candidate=candidate,
                    source_allowed_domains=("data.europa.eu",),
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()
        self.assertEqual(document.source_class, "search_discovery")
        self.assertEqual(document.provider_id, "data_europa_eu")
        self.assertEqual(parsed.parser_id, "json-structured")


class ExternalAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self._artifact_backend = patch.dict(
            os.environ,
            {"DATA_PLATFORM_ARTIFACT_BACKEND": "legacy_supabase_storage"},
        )
        self._artifact_backend.start()
        self.addCleanup(self._artifact_backend.stop)

    def test_external_candidate_is_admitted_only_by_matching_rule(self):
        provider = _provider()
        rule = ExternalSourceRule.from_dict({
            "domain": "api.openalex.org",
            "adapter_id": "external_authoritative",
            "provider_id": "openalex",
            "reason": "configured provider",
            "authority": "TRUSTED_AGGREGATOR",
            "relationship": "CATALOGUE_PROVIDER",
        })
        seed = _seed((rule,))
        intent = _intent()
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=seed,
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        registry = build_source_registry(
            SourceEcosystemConfig(
                enabled=True,
                external_authoritative_enabled=True,
                external_providers=(provider,),
            )
        )
        candidates, _ = registry.discover(intent, context, only_adapter_ids=("external_authoritative",))
        self.assertEqual(len(candidates), 1)
        self.assertIn("search=Massachusetts", candidates[0].canonical_locator)
        decision = SourceResolver().evaluate(candidates[0], seed=seed, intent=intent)
        self.assertTrue(decision.admitted)
        self.assertEqual(decision.allowed_domains[-1], "api.openalex.org")

    def test_generic_provider_expands_bounded_pages_and_identifier_mapping(self):
        provider = _provider(
            provider_id="registry-api",
            base_url="https://registry.example/api/resources",
            adapter_id="external_authoritative",
            identifier_mapping={"institution": "institution_id"},
            pagination={
                "strategy": "page",
                "page_parameter": "page",
                "page_size": 10,
                "max_pages": 2,
            },
            max_results=5,
        )
        intent = _intent()
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=_seed(),
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates = build_source_registry(
            SourceEcosystemConfig(
                enabled=True,
                external_providers=(provider,),
            )
        ).discover(intent, context, only_adapter_ids=("external_authoritative",))[0]
        self.assertEqual(len(candidates), 2)
        self.assertTrue(all("institution=mit-us" in item.canonical_locator for item in candidates))
        self.assertIn("page=1", candidates[0].canonical_locator)
        self.assertIn("page=2", candidates[1].canonical_locator)

    def test_archive_candidate_is_historical_and_preserves_original(self):
        provider = ExternalProviderConfig.from_dict({
            "provider_id": "internet_archive",
            "source_class": "archive",
            "authority": "ARCHIVE",
            "relationship": "ARCHIVE",
            "resource_url": "https://web.archive.org/cdx?url=https://{official_domain}/*&output=json",
            "original_url": "https://{official_domain}/",
            "adapter_id": "archive_http",
        })
        intent = _intent(("archive",))
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=_seed(),
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates = ArchiveSourceAdapter().discover(intent, context)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].temporal_state, TemporalState.HISTORICAL)
        self.assertEqual(candidates[0].adapter_metadata["original_url"], "https://mit.edu/")

    def test_archive_parser_handles_headerless_cdx_rows_and_target_year(self):
        payload = json.dumps([
            ["20220101000000", "https://mit.edu/old", "text/html", "200", "sha-old"],
            ["20240101000000", "https://mit.edu/current", "text/html", "200", "sha-current"],
            ["20240101000000", "https://mit.edu/current", "text/html", "200", "sha-current"],
        ]).encode()
        captures = parse_archive_captures(
            payload,
            provider_id="internet_archive",
            target_cycle="2024-25",
            max_captures=2,
        )
        self.assertEqual(len(captures), 2)
        self.assertEqual(captures[0].original_url, "https://mit.edu/current")
        self.assertIn("20240101000000", captures[0].capture_url)
        self.assertEqual(captures[0].digest, "sha-current")

    def test_search_provider_returns_candidates_without_assertions(self):
        class SearchFetch(_Fetch):
            def __init__(self):
                super().__init__(b'{"results":[{"url":"https://registry.example/result","snippet":"tuition 100"}]}')

        fetcher = SearchFetch()
        provider = HttpSearchProvider(
            provider_id="bounded-search",
            endpoint="https://search.example/api",
            domain="search.example",
            fetcher=fetcher,
            result_path="results",
        )
        intent = _intent(("search_index",))
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=_seed(),
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={},
        )
        candidates = SearchSourceAdapter(provider).discover(intent, context)
        self.assertEqual(len(candidates), 1)
        self.assertTrue(candidates[0].adapter_metadata["snippet_only"])
        self.assertEqual(candidates[0].discovery_method, "search_snippet")
        self.assertNotIn("assertion", candidates[0].adapter_metadata)
        self.assertEqual(fetcher.calls[0][1]["accept"], "application/json")

    def test_search_provider_supports_optional_query_auth_without_assertions(self):
        class SearchFetch(_Fetch):
            def __init__(self):
                super().__init__(b'{"results":[]}', content_type="application/json")

        import os

        os.environ["SEARCH_TEST_TOKEN"] = "secret-token"
        try:
            fetcher = SearchFetch()
            provider = HttpSearchProvider(
                provider_id="query-auth-search",
                endpoint="https://search.example/api",
                domain="search.example",
                fetcher=fetcher,
                authentication={
                    "mode": "api_key_query",
                    "parameter": "key",
                    "token_env": "SEARCH_TEST_TOKEN",
                },
            )
            provider.search("tuition")
            self.assertIn("key=secret-token", fetcher.calls[0][0])
        finally:
            os.environ.pop("SEARCH_TEST_TOKEN", None)

    def test_search_provider_supports_offset_pagination_for_ckan_catalogues(self):
        provider = HttpSearchProvider(
            provider_id="data-gov-us",
            endpoint="https://catalog.example/api/3/action/package_search",
            domain="catalog.example",
            pagination={
                "strategy": "offset",
                "offset_parameter": "start",
                "page_size_parameter": "rows",
                "page_size": 20,
                "max_pages": 2,
            },
        )
        first = parse_qs(
            urlsplit(
                provider._request_url("tuition", 0, "page", max_pages=2, page_start=1)
            ).query
        )
        second = parse_qs(
            urlsplit(
                provider._request_url("tuition", 1, "page", max_pages=2, page_start=1)
            ).query
        )
        self.assertEqual(first["start"], ["0"])
        self.assertEqual(first["rows"], ["20"])
        self.assertEqual(second["start"], ["20"])

    def test_search_adapter_can_use_multiple_configured_providers(self):
        class SearchFetch(_Fetch):
            def __init__(self, url):
                super().__init__(json.dumps({"results": [{"url": url}]}).encode())

        first = HttpSearchProvider(
            provider_id="search-a",
            endpoint="https://search-a.example/api",
            domain="search-a.example",
            fetcher=SearchFetch("https://registry-a.example/result"),
        )
        second = HttpSearchProvider(
            provider_id="search-b",
            endpoint="https://search-b.example/api",
            domain="search-b.example",
            fetcher=SearchFetch("https://registry-b.example/result"),
        )
        candidates = SearchSourceAdapter((first, second)).discover(
            _intent(("search_index",)),
            SourceAdapterContext(entity=EntityRef("UNIVERSITY", "mit-us"), seed=_seed()),
        )
        self.assertEqual({item.provider_id for item in candidates}, {"search-a", "search-b"})

    def test_provider_request_metadata_reaches_safe_fetcher_and_raw_store(self):
        candidate = SourceCandidate.create(
            canonical_locator="https://api.example/resource",
            locator_type="provider_resource",
            source_class="external_authoritative",
            adapter_id="external_authoritative",
            provider_id="provider",
            dataset_id="dataset",
            declared_authority=SourceAuthority.TRUSTED_AGGREGATOR,
            relationship=SourceRelationship.CATALOGUE_PROVIDER,
            relationship_evidence=("configured provider",),
            expected_field_groups=("tuition",),
            academic_cycle="2024-25",
            adapter_metadata={
                "retrieval_method": "POST",
                "accept": "application/json",
                "request_headers": {"X-Test": "value"},
                "request_body": {"rows": 1},
            },
        )
        decision = SourceAdmissionDecision(candidate, True, "ADMITTED", {}, 1, ("api.example",))
        fetcher = _Fetch()
        document, attempt = persist_admitted_fetch(
            candidate=candidate,
            decision=decision,
            fetcher=fetcher,
            raw_store=InMemoryRawEvidenceStore(),
            acquisition_run_id="external-test",
            robots_policy=_Robots(),
            intent_id="intent",
            require_remote_durability=False,
        )
        self.assertEqual(attempt.status, "RAW_PERSISTED")
        self.assertIsNotNone(document)
        self.assertEqual(fetcher.calls[0][1]["method"], "POST")
        self.assertEqual(fetcher.calls[0][1]["accept"], "application/json")
        self.assertEqual(fetcher.calls[0][1]["data"], b'{"rows": 1}')
        assert document is not None
        self.assertEqual(document.provider_id, "provider")
        self.assertEqual(document.dataset_id, "dataset")
        self.assertEqual(document.academic_cycle, "2024-25")

    def test_backend_shadow_fetch_records_coverage_after_persistence(self):
        provider = _provider()
        rule = ExternalSourceRule.from_dict({
            "domain": "api.openalex.org",
            "adapter_id": "external_authoritative",
            "provider_id": "openalex",
            "reason": "configured provider",
            "authority": "TRUSTED_AGGREGATOR",
            "relationship": "CATALOGUE_PROVIDER",
        })
        ecosystem = SourceEcosystemConfig(
            enabled=True,
            runtime_acquisition_enabled=True,
            official_web_enabled=False,
            official_catalogue_enabled=False,
            external_authoritative_enabled=True,
            external_providers=(provider,),
            required_source_classes=("external_authoritative",),
        )
        fetcher = _Fetch()
        backend = AcquisitionPlatformBackend(
            type("Discovery", (), {"discover": lambda self, seed, policy: ([], [], [])})(),
            mode="platform_shadow",
            source_ecosystem=ecosystem,
            fetcher=fetcher,
            raw_evidence_store=InMemoryRawEvidenceStore(),
            acquisition_run_id="coverage-test",
        )
        intent = _intent()
        decisions, attempts = backend.acquire_intent(
            intent,
            SourceAdapterContext(
                entity=intent.entity,
                seed=_seed((rule,)),
                target_cycle=intent.target_cycle,
                field_groups=intent.field_groups,
                configuration=backend._context_configuration(
                    seed=_seed((rule,)), policy=_Robots()
                ),
            ),
            fetch_admitted=True,
            max_fetches=1,
        )
        self.assertTrue(any(item.admitted for item in decisions))
        self.assertIn("RAW_PERSISTED", {item.status for item in attempts})
        coverage = backend.source_class_coverage()
        self.assertEqual(coverage["outcomes"]["external_authoritative"], "PRESENT")

    def test_csv_dataset_resource_uses_structured_parser(self):
        raw = RawDocument(
            raw_document_id="raw-csv",
            source_identity="source-csv",
            canonical_url="https://data.example.gov/tuition.csv",
            content_hash="hash",
            content_type="text/csv",
            retrieved_at="2026-09-09T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
        )
        parsed = ParserRegistry.default().parse(
            raw,
            b"unitid,tuition\n123,100\n",
        )
        self.assertEqual(parsed.parser_id, "csv-structured")
        self.assertEqual(parsed.structured_payload, [{"unitid": "123", "tuition": "100"}])

    def test_semicolon_csv_dataset_uses_structured_parser(self):
        raw = RawDocument(
            raw_document_id="raw-csv-semicolon",
            source_identity="source-csv-semicolon",
            canonical_url="https://api.opendata.onisep.fr/export.csv",
            content_hash="hash-semicolon",
            content_type="text/csv; charset=utf-8",
            retrieved_at="2026-09-13T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
        )
        parsed = ParserRegistry.default().parse(
            raw,
            "ENS code UAI;Formation (FOR) libellé;AF durée cycle standard\n0755283K;Master Informatique;2 ans\n".encode("utf-8"),
        )
        self.assertEqual(parsed.parser_id, "csv-structured")
        self.assertEqual(parsed.structured_payload[0]["ENS code UAI"], "0755283K")
        self.assertEqual(parsed.structured_payload[0]["AF durée cycle standard"], "2 ans")

    def test_configured_csv_candidate_carries_source_native_target_identifiers(self):
        programme_id = "programme-1"
        provider = ExternalProviderConfig.from_dict({
            "provider_id": "catalogue",
            "source_class": "government_dataset",
            "authority": "GOVERNMENT",
            "relationship": "GOVERNMENT",
            "countries": ["FR"],
            "resource_url": "https://data.example.gov/catalogue.csv",
            "retrieval_type": "csv",
            "resolution": "programme",
            "adapter_id": "government_dataset",
            "field_groups": ["programme_taxonomy"],
            "field_evidence": {
                "identity_fields": ["UAI", "AF"],
            },
        })
        seed = InstitutionSeed(
            institution_id="fr-example",
            name="Example",
            country_code="FR",
            official_domain="example.fr",
            homepage_url="https://example.fr/",
            provider_programme_identifiers={
                programme_id: {
                    "catalogue": {"UAI": "0755283K", "AF": "AF.target"},
                }
            },
        )
        intent = AcquisitionIntent.create(
            entity=EntityRef("programme", programme_id),
            field_groups=("programme_taxonomy",),
            reason="identifier-routing-test",
            target_cycle=None,
            preferred_source_classes=("government_dataset",),
        )
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=seed,
            target_cycle=None,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates = GovernmentDatasetAdapter().discover(intent, context)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(
            candidates[0].adapter_metadata["target_identifiers"],
            {"UAI": "0755283K", "AF": "AF.target"},
        )

    def test_replacement_catalogue_disables_blocked_defaults(self):
        providers = ExternalProviderConfig.load_catalogue(
            Path(__file__).parents[1] / "configs" / "external-providers.json"
        )
        by_id = {item.provider_id: item for item in providers}
        for provider_id in (
            "college_scorecard",
            "ucas",
            "ror",
            "internet_archive",
            "bing_web_search",
        ):
            self.assertFalse(by_id[provider_id].enabled)
            self.assertTrue(by_id[provider_id].optional)
        for provider_id in (
            "ipeds",
            "college_scorecard_bulk",
            "usdoe_affordability",
            "discover_uni_hesa",
            "crossref",
            "arquivo_pt",
            "data_europa_eu",
            "data_gov_us",
        ):
            self.assertTrue(by_id[provider_id].enabled)
        self.assertEqual(by_id["ipeds"].adapter_id, "ipeds")
        self.assertIn("zip", by_id["college_scorecard_bulk"].formats)
        self.assertIn("html", by_id["discover_uni_hesa"].formats)

    def test_default_replacement_registry_contains_external_families(self):
        providers = ExternalProviderConfig.load_catalogue(
            Path(__file__).parents[1] / "configs" / "external-providers.json"
        )
        registry = build_source_registry(
            SourceEcosystemConfig(
                enabled=True,
                acquisition_mode="external_source_expansion",
                external_providers=providers,
            )
        )
        self.assertTrue(
            {
                "government_dataset",
                "official_registry",
                "accreditation_registry",
                "official_partner",
                "external_authoritative",
                "archive_http",
                "search_index",
            }.issubset(set(registry.adapter_ids))
        )

    def test_bulk_provider_metadata_reaches_candidate(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "college_scorecard_bulk"
        )
        intent = _intent(("government_dataset",))
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=_seed(),
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates, _ = build_source_registry(
            SourceEcosystemConfig(enabled=True, external_providers=(provider,))
        ).discover(intent, context, only_adapter_ids=("college_scorecard",))
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].provider_id, "college_scorecard_bulk")
        self.assertEqual(candidates[0].dataset_id, "college-scorecard-bulk")
        self.assertEqual(candidates[0].adapter_metadata["max_bytes"], 536870912)
        self.assertIn("zip", candidates[0].adapter_metadata["formats"])
        self.assertEqual(
            candidates[0].adapter_metadata["structured_archive"]["member_patterns"],
            ["Most-Recent-Cohorts-Institution.csv"],
        )

    def test_search_catalogue_nested_url_preserves_dataset_id_without_assertion(self):
        class CatalogueFetch(_Fetch):
            def __init__(self):
                super().__init__(
                    json.dumps(
                        {
                            "result": {
                                "results": [
                                    {
                                        "name": "public dataset",
                                        "resources": [{"url": "https://data.example/resource.csv"}],
                                        "snippet": "tuition 100",
                                    }
                                ]
                            }
                        }
                    ).encode()
                )

        provider = HttpSearchProvider(
            provider_id="data-gov-us",
            endpoint="https://catalog.example/api/search",
            domain="catalog.example",
            fetcher=CatalogueFetch(),
            result_path="result.results",
            result_url_field="resources.0.url",
            dataset_id="data-gov-packages",
            source_class="search_discovery",
            authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
        )
        candidates = SearchSourceAdapter(provider).discover(
            _intent(("search_discovery",)),
            SourceAdapterContext(entity=EntityRef("UNIVERSITY", "mit-us"), seed=_seed()),
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].canonical_locator, "https://data.example/resource.csv")
        self.assertEqual(candidates[0].dataset_id, "data-gov-packages")
        self.assertTrue(candidates[0].adapter_metadata["snippet_is_not_evidence"])

    def test_xml_and_zip_structured_parsers(self):
        xml_raw = RawDocument(
            raw_document_id="raw-xml",
            source_identity="source-xml",
            canonical_url="https://registry.example/programmes.xml",
            content_hash="hash-xml",
            content_type="application/xml",
            retrieved_at="2026-09-09T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
        )
        xml_parsed = ParserRegistry.default().parse(
            xml_raw,
            b"<?xml version='1.0'?><catalog><course id='c1'>Tuition</course></catalog>",
        )
        self.assertEqual(xml_parsed.parser_id, "xml-structured")
        self.assertEqual(xml_parsed.structured_payload["catalog"]["course"]["@attributes"]["id"], "c1")

        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
            handle.writestr("data.csv", "unitid,tuition\n123,100\n")
            handle.writestr("programmes.xml", "<programmes><programme>P1</programme></programmes>")
        zip_raw = RawDocument(
            raw_document_id="raw-zip",
            source_identity="source-zip",
            canonical_url="https://data.example/dataset.zip",
            content_hash="hash-zip",
            content_type="application/zip",
            retrieved_at="2026-09-09T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
        )
        zip_parsed = ParserRegistry.default().parse(zip_raw, archive.getvalue())
        self.assertEqual(zip_parsed.parser_id, "zip-structured")
        self.assertEqual(
            {item["name"] for item in zip_parsed.structured_payload["members"]},
            {"data.csv", "programmes.xml"},
        )

    def test_large_zip_csv_member_streams_and_filters_by_unitid(self):
        payload = _large_csv_zip()
        raw = RawDocument(
            raw_document_id="raw-scorecard-large",
            source_identity="source-scorecard-large",
            canonical_url="https://ed-public-download.scorecard.network/dataset.zip",
            content_hash="zip-hash",
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
            acquisition_run_id="scorecard-large-run",
            provider_id="college_scorecard_bulk",
            dataset_id="college-scorecard-bulk",
            academic_cycle="latest",
        )
        parsed = ParserRegistry.default().parse(
            raw,
            payload,
            parser_options={
                "identifier_mapping": {"UNITID": "institution_id"},
                "structured_archive": {
                    "member_patterns": ["Most-Recent-Cohorts-Institution.csv"],
                    "identifier_fields": ["UNITID"],
                    "target_identifiers": {"UNITID": ["100654"]},
                    "max_rows": 5,
                    "max_scan_rows": 1000,
                    "max_member_bytes": 512 * 1024 * 1024,
                    "max_archive_bytes": 512 * 1024 * 1024,
                    "chunk_size": 4096,
                },
            },
        )
        member = parsed.structured_payload["members"][0]
        self.assertGreater(member["size"], 64 * 1024 * 1024)
        self.assertEqual(member["rows_retained"], 1)
        self.assertEqual(member["structured"][0]["UNITID"], "100654")
        self.assertEqual(member["bounded_reason"], "target_identifiers_satisfied")
        self.assertTrue(member["partial"])
        self.assertLess(member["bytes_scanned"], member["size"])
        self.assertEqual(member["lineage"]["provider_id"], "college_scorecard_bulk")
        self.assertEqual(member["lineage"]["dataset_id"], "college-scorecard-bulk")
        self.assertEqual(member["lineage"]["zip_locator"], raw.canonical_url)
        self.assertEqual(member["lineage"]["zip_content_hash"], raw.content_hash)
        self.assertEqual(member["lineage"]["archive_member_name"], member["member_name"])
        self.assertEqual(member["lineage"]["academic_cycle"], "latest")
        self.assertEqual(member["lineage"]["acquisition_run_id"], "scorecard-large-run")

    def test_large_zip_csv_without_target_uses_bounded_sample(self):
        payload = _large_csv_zip(target_unitid="100655")
        raw = RawDocument(
            raw_document_id="raw-scorecard-sample",
            source_identity="source-scorecard-sample",
            canonical_url="https://ed-public-download.scorecard.network/dataset.zip",
            content_hash="zip-hash-sample",
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
            provider_id="college_scorecard_bulk",
            dataset_id="college-scorecard-bulk",
        )
        parsed = ParserRegistry.default().parse(
            raw,
            payload,
            parser_options={
                "structured_archive": {
                    "member_patterns": ["Most-Recent-Cohorts-Institution.csv"],
                    "sample_rows": 3,
                    "max_rows": 3,
                    "max_scan_rows": 100,
                    "max_member_bytes": 512 * 1024 * 1024,
                    "max_archive_bytes": 512 * 1024 * 1024,
                    "chunk_size": 4096,
                },
            },
        )
        member = parsed.structured_payload["members"][0]
        self.assertEqual(member["rows_retained"], 3)
        self.assertEqual(member["rows_scanned"], 3)
        self.assertEqual(member["bounded_reason"], "sample_rows")
        self.assertTrue(member["partial"])
        self.assertLess(member["bytes_scanned"], member["size"])

    def test_unconfigured_large_zip_member_keeps_legacy_safety_limit(self):
        payload = _large_csv_zip()
        raw = RawDocument(
            raw_document_id="raw-scorecard-legacy-limit",
            source_identity="source-scorecard-legacy-limit",
            canonical_url="https://data.example/dataset.zip",
            content_hash="zip-hash-legacy-limit",
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00+00:00",
            payload_location="local",
            payload_reference=None,
        )
        with self.assertRaises(ParserError):
            ParserRegistry.default().parse(raw, payload)

    def test_streamed_archive_rows_are_persisted_with_lineage(self):
        payload = _large_csv_zip()
        seed = _seed()
        candidate = SourceCandidate.create(
            canonical_locator="https://ed-public-download.scorecard.network/dataset.zip",
            locator_type="provider_resource",
            source_class="government_dataset",
            adapter_id="college_scorecard",
            provider_id="college_scorecard_bulk",
            dataset_id="college-scorecard-bulk",
            declared_authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            relationship_evidence=("configured provider",),
            expected_field_groups=("tuition",),
            academic_cycle="latest",
            adapter_metadata={
                "retrieval_method": "GET",
                "structured_archive": {
                    "member_patterns": ["Most-Recent-Cohorts-Institution.csv"],
                    "sample_rows": 2,
                    "max_rows": 2,
                    "max_member_bytes": 512 * 1024 * 1024,
                    "max_archive_bytes": 512 * 1024 * 1024,
                    "chunk_size": 4096,
                },
            },
        )
        config = SmokeConfig(
            run_name="scorecard-large",
            institutions=(seed,),
            source_ecosystem=SourceEcosystemConfig(),
        )
        with TemporaryDirectory() as temporary:
            pipeline = __import__("glowbal_ingestion.pipeline", fromlist=["SmokePipeline"]).SmokePipeline(
                config,
                Path(temporary),
                allow_unreviewed_terms=True,
                discovery_only=False,
                skip_school_profile=True,
            )
            pipeline.fetcher = _Fetch(payload=payload, content_type="application/zip")
            try:
                document, _, _ = pipeline._fetch_and_parse_source(
                    seed,
                    _Robots(),
                    candidate.canonical_locator,
                    source_candidate=candidate,
                    source_allowed_domains=("ed-public-download.scorecard.network",),
                )
                members_path = Path(temporary) / "structured_archive_members.jsonl"
                self.assertTrue(members_path.exists())
                member = json.loads(members_path.read_text(encoding="utf-8").splitlines()[0])
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()
        self.assertEqual(document.provider_id, "college_scorecard_bulk")
        self.assertEqual(member["provider_id"], "college_scorecard_bulk")
        self.assertEqual(member["dataset_id"], "college-scorecard-bulk")
        self.assertIsNone(member["programme_id"])
        self.assertEqual(member["zip_content_hash"], document.content_hash)
        self.assertEqual(member["member_name"], "Most-Recent-Cohorts-Institution.csv")
        self.assertTrue(member["partial"])
        self.assertEqual(member["lineage"]["raw_document_id"], document.raw_document_id)
        self.assertEqual(member["lineage"]["acquisition_run_id"], Path(temporary).name)

    def test_arquivo_provider_candidate_is_historical(self):
        provider = next(
            item
            for item in ExternalProviderConfig.load_catalogue(
                Path(__file__).parents[1] / "configs" / "external-providers.json"
            )
            if item.provider_id == "arquivo_pt"
        )
        intent = _intent(("archive",))
        context = SourceAdapterContext(
            entity=intent.entity,
            seed=_seed(),
            target_cycle=intent.target_cycle,
            field_groups=intent.field_groups,
            configuration={"external_providers": (provider.to_dict(),)},
        )
        candidates = ArchiveSourceAdapter().discover(intent, context)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].provider_id, "arquivo_pt")
        self.assertEqual(candidates[0].dataset_id, "arquivo-pt-cdx")
        self.assertEqual(candidates[0].temporal_state, TemporalState.HISTORICAL)


class CoverageAndStagingTests(unittest.TestCase):
    def test_coverage_gate_marks_zero_external_attempts_invalid(self):
        result = SourceClassCoverageGate(("government_dataset", "official_registry")).evaluate(
            registry=build_source_registry(SourceEcosystemConfig()),
            configured_source_classes=(),
            events=(),
        )
        self.assertFalse(result.experiment_valid)
        self.assertEqual(result.outcomes["government_dataset"], "NOT_CONFIGURED")
        self.assertEqual(result.outcomes["official_registry"], "NOT_CONFIGURED")

    def test_coverage_gate_distinguishes_persisted_and_failed_classes(self):
        result = SourceClassCoverageGate(("government_dataset", "official_registry")).evaluate(
            registry=build_source_registry(SourceEcosystemConfig()),
            configured_source_classes=("government_dataset", "official_registry"),
            events=(
                {"source_class": "government_dataset", "status": "RAW_PERSISTED"},
                {"source_class": "official_registry", "status": "FETCH_FAILED"},
            ),
        )
        self.assertTrue(result.experiment_valid)
        self.assertEqual(result.outcomes["government_dataset"], "PRESENT")
        self.assertEqual(result.outcomes["official_registry"], "FETCH_FAILED")
        self.assertEqual(result.details["government_dataset"]["attempted"], 1)

    def test_coverage_gate_exposes_empty_discovery(self):
        result = SourceClassCoverageGate(("official_registry",)).evaluate(
            registry=build_source_registry(SourceEcosystemConfig()),
            configured_source_classes=("official_registry",),
            events=({"source_class": "official_registry", "status": "NO_CANDIDATES"},),
        )
        self.assertEqual(result.outcomes["official_registry"], "CANDIDATE_NOT_FOUND")

    def test_coverage_gate_accepts_state_only_lifecycle_events(self):
        result = SourceClassCoverageGate(("official_registry",)).evaluate(
            registry=build_source_registry(SourceEcosystemConfig()),
            configured_source_classes=("official_registry",),
            events=(
                {"source_class": "official_registry", "execution_state": SourceClassExecutionState.ADAPTER_READY.value},
                {"source_class": "official_registry", "execution_state": SourceClassExecutionState.NO_YIELD.value},
            ),
        )
        self.assertEqual(result.states["official_registry"], "NO_YIELD")
        self.assertEqual(result.outcomes["official_registry"], "CANDIDATE_NOT_FOUND")

    def test_coverage_gate_distinguishes_missing_adapter(self):
        result = SourceClassCoverageGate(("official_registry",)).evaluate(
            registry=build_source_registry(SourceEcosystemConfig()),
            configured_source_classes=("official_registry",),
            events=({
                "source_class": "official_registry",
                "status": "NO_SUPPORTED_ADAPTER",
                "execution_state": SourceClassExecutionState.HARD_BLOCKED.value,
            },),
        )
        self.assertEqual(result.outcomes["official_registry"], "UNSUPPORTED")

    def test_source_rows_keep_external_provenance_for_staging(self):
        with TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            row = {
                "source_id": "source-1",
                "institution_id": "mit-us",
                "url": "https://api.openalex.org/institutions/1",
                "canonical_url": "https://api.openalex.org/institutions/1",
                "page_type": "OTHER",
                "content_type": "application/json",
                "http_status": 200,
                "retrieved_at": "2026-09-09T00:00:00+00:00",
                "content_hash": "hash",
                "source_class": "external_authoritative",
                "adapter_id": "external_authoritative",
                "provider_id": "openalex",
                "dataset_id": "openalex-institutions",
                "academic_cycle": "2024-25",
                "source_authority": "TRUSTED_AGGREGATOR",
                "source_relationship": "CATALOGUE_PROVIDER",
                "temporal_state": "UNKNOWN",
            }
            (run_dir / "sources.jsonl").write_text(json.dumps(row) + "\n", encoding="utf-8")
            imported = next(_source_rows(run_dir, "run-1"))
            self.assertEqual(imported["provider_id"], "openalex")
            self.assertEqual(imported["dataset_id"], "openalex-institutions")
            self.assertEqual(imported["source_class"], "external_authoritative")
            self.assertEqual(imported["academic_cycle"], "2024-25")

    def test_candidate_and_attempt_rows_keep_archive_lineage_for_staging(self):
        with TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            candidate = {
                "candidate_id": "candidate-1",
                "canonical_locator": "https://web.archive.org/web/20240101000000id_/https://mit.edu/",
                "locator_type": "archive",
                "source_class": "archive",
                "provider_id": "internet_archive",
                "dataset_id": "wayback-cdx",
                "source_resolution": "programme",
                "original_url": "https://mit.edu/",
                "capture_url": "https://web.archive.org/web/20240101000000id_/https://mit.edu/",
                "captured_at": "2024-01-01T00:00:00+00:00",
                "archive_provider": "internet_archive",
                "temporal_state": "HISTORICAL",
            }
            attempt = {
                "attempt_id": "attempt-1",
                "candidate_id": "candidate-1",
                "status": "RAW_PERSISTED",
                "source_class": "archive",
                "provider_id": "internet_archive",
                "dataset_id": "wayback-cdx",
                "execution_state": "RAW_PERSISTED",
                "source_resolution": "programme",
                "original_url": "https://mit.edu/",
                "capture_url": candidate["capture_url"],
                "captured_at": candidate["captured_at"],
                "archive_provider": "internet_archive",
                "temporal_state": "HISTORICAL",
            }
            (run_dir / "source_candidates.jsonl").write_text(json.dumps(candidate) + "\n", encoding="utf-8")
            (run_dir / "acquisition_attempts.jsonl").write_text(json.dumps(attempt) + "\n", encoding="utf-8")
            imported_candidate = next(_source_candidate_rows(run_dir, "run-1"))
            imported_attempt = next(_acquisition_attempt_rows(run_dir, "run-1"))
            self.assertEqual(imported_candidate["archive_provider"], "internet_archive")
            self.assertEqual(imported_candidate["temporal_state"], "HISTORICAL")
            self.assertEqual(imported_attempt["execution_state"], "RAW_PERSISTED")
            self.assertEqual(imported_attempt["source_resolution"], "programme")


if __name__ == "__main__":
    unittest.main()
