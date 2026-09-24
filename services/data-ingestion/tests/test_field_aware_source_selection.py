from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.extraction_provider import ExtractionResult, ExtractionSource
from glowbal_ingestion.config import CrawlLimits, InstitutionSeed, SmokeConfig
from glowbal_ingestion.discovery import ProgrammeCandidate
from glowbal_ingestion.models import DEEP_FIELDS, TemporalState
from glowbal_ingestion.normalization import candidate_to_programme
from glowbal_ingestion.pipeline import (
    COVERAGE_RETRY_FIELD_CATEGORIES,
    SmokePipeline,
)
from glowbal_ingestion.source_recovery import (
    SourceCandidateHint,
    field_families,
    rank_field_source_candidates,
    screen_source_content,
    select_sources_for_fields,
)


def _source(
    url: str,
    text: str,
    *,
    page_type: str = "unknown",
    source_class: str | None = "official_web",
    cycle: str | None = "2025-26",
    raw_id: str | None = None,
    linked_programme_id: str | None = None,
) -> ExtractionSource:
    return ExtractionSource(
        url=url,
        page_type=page_type,
        title=None,
        text=text,
        content_hash=f"hash:{raw_id or url}",
        raw_document_id=raw_id,
        source_class=source_class,
        academic_cycle=cycle,
        linked_programme_id=linked_programme_id,
    )


class FieldVocabularyTests(unittest.TestCase):
    def test_all_required_source_families_are_addressable(self) -> None:
        self.assertEqual(
            field_families(
                (
                    "tuition",
                    "intakes",
                    "minimum_gpa",
                    "ielts_overall",
                    "scholarships",
                    "programme_identity",
                )
            ),
            (
                "finance",
                "deadlines_intakes",
                "eligibility",
                "language",
                "funding",
                "identity",
            ),
        )

    def test_content_screen_understands_grouped_fields_and_stays_bounded(self) -> None:
        screen = screen_source_content(
            ("intakes", "ielts_overall", "minimum_gpa"),
            "X" * 5000
            + " September intake. English language applicants need IELTS overall 7.0. "
            + "The minimum GPA is 3.2.",
            max_chars=600,
        )
        self.assertTrue(screen.truncated)
        self.assertEqual(
            screen.matched_fields,
            ("intakes", "ielts_overall", "minimum_gpa"),
        )
        self.assertIn("minimum_gpa", screen.strong_fields)
        self.assertIn("ielts_overall", screen.strong_fields)


class FieldCandidateRankingTests(unittest.TestCase):
    def test_url_and_anchor_ranking_is_stable_and_top_k_bounded(self) -> None:
        candidates = (
            SourceCandidateHint(
                "https://example.edu/apply",
                anchor_text="Apply now",
            ),
            SourceCandidateHint(
                "https://example.edu/fees/graduate-tuition",
                anchor_text="Tuition and fees 2025-26",
                expected_fields=("tuition",),
            ),
            SourceCandidateHint(
                "https://example.edu/aid",
                anchor_text="Financial aid",
            ),
        )
        ranked = rank_field_source_candidates(
            candidates,
            target_url="https://example.edu/programmes/data-science",
            field_names=("tuition",),
            max_candidates=2,
        )
        self.assertEqual(len(ranked), 2)
        self.assertEqual(ranked[0].url, "https://example.edu/fees/graduate-tuition")
        self.assertIn("tuition", ranked[0].matched_fields)
        self.assertEqual(
            [item.url for item in ranked],
            [
                item.url
                for item in rank_field_source_candidates(
                    tuple(reversed(candidates)),
                    target_url="https://example.edu/programmes/data-science",
                    field_names=("tuition",),
                    max_candidates=2,
                )
            ],
        )


class SourceSelectionTests(unittest.TestCase):
    def test_selection_keeps_exact_target_and_rejects_unsafe_contexts(self) -> None:
        target = _source(
            "https://example.edu/programmes/data-science",
            "Master of Data Science programme overview.",
            page_type="programme_overview",
            raw_id="target",
        )
        finance = _source(
            "https://example.edu/students/tuition",
            "Tuition and fees are USD 28,000 per academic year.",
            page_type="tuition",
            raw_id="finance",
        )
        sources = (
            _source(
                "https://example.edu/programmes/physics",
                "Physics degree tuition details.",
                page_type="programme_overview",
                raw_id="sibling",
            ),
            finance,
            target,
            _source(
                "https://example.edu/search?q=tuition",
                "Tuition USD 1",
                source_class="search_discovery",
                raw_id="search",
            ),
            _source(
                "https://example.edu/archive/fees",
                "Tuition USD 12,000",
                source_class="archive",
                raw_id="archive",
            ),
            _source(
                "https://example.edu/fees/2023",
                "Tuition USD 15,000",
                cycle="2023-24",
                raw_id="old-cycle",
            ),
            _source(
                "https://example.edu/library",
                "Opening hours and borrowing services.",
                raw_id="no-field",
            ),
            _source(
                "https://example.edu/programmes/data-science/admissions",
                "Tuition and admission fee details.",
                page_type="programme_admission",
                raw_id="wrong-link",
                linked_programme_id="another-programme",
            ),
            _source(
                "https://example.edu/duplicate-fees",
                "Tuition USD 28,000",
                raw_id="finance",
            ),
        )
        result = select_sources_for_fields(
            sources,
            ("tuition",),
            target_url=target.url,
            target_cycle="2025-26",
            programme_id="data-science",
            max_sources=2,
        )
        self.assertEqual([source.url for source in result.sources], [target.url, finance.url])
        reason_codes = {item.reason_code for item in result.decisions}
        self.assertTrue(
            {
                "scope",
                "identity",
                "search",
                "historical_or_archive",
                "cycle",
                "no_field_signal",
                "lineage_duplicate",
            }.issubset(reason_codes)
        )

    def test_top_k_rejection_and_explicit_programme_link_are_diagnostic(self) -> None:
        sources = (
            _source(
                "https://example.edu/programmes/data-science",
                "Data Science degree.",
                page_type="programme_overview",
                raw_id="target",
            ),
            _source(
                "https://example.edu/programmes/data-science/admissions",
                "Entry requirement and minimum GPA.",
                page_type="programme_admission",
                raw_id="linked",
                linked_programme_id="p1",
            ),
            _source(
                "https://example.edu/admissions/requirements",
                "Eligibility requires a minimum GPA of 3.0.",
                page_type="international_admission",
                raw_id="central",
            ),
        )
        result = select_sources_for_fields(
            sources,
            ("minimum_gpa",),
            target_url=sources[0].url,
            programme_id="p1",
            max_sources=2,
        )
        self.assertEqual(len(result.sources), 2)
        self.assertTrue(any(item.reason_code == "top_k" for item in result.decisions))
        self.assertTrue(
            any(item.programme_link == "explicit_programme_id" for item in result.decisions)
        )


class ProviderRetentionIntegrationTests(unittest.TestCase):
    def test_provider_fact_keeps_source_lineage_and_semantic_dimensions(self) -> None:
        source = ExtractionSource(
            url="https://provider.example/programmes.json",
            page_type="other",
            title=None,
            text="International tuition is USD 30,000 per academic year.",
            content_hash="provider-hash",
            raw_document_id="raw-provider",
            provider_id="programme-catalogue",
            dataset_id="programmes-2026",
            academic_cycle="2025-26",
            acquisition_run_id="provider-run",
            source_resolution="programme",
            expected_field_groups=("tuition",),
            audience="international",
        )
        result = ExtractionResult(
            facts=({
                "field_name": "tuition",
                "value": {
                    "amount": 30000,
                    "currency": "USD",
                    "basis": "per academic year",
                },
                "source_url": source.url,
                "evidence": source.text,
                "confidence": 0.9,
            },),
            provider_id="deepseek",
            model_id="fixture-model",
            request_fingerprint="fixture",
            prompt_version="prompt/v1",
            schema_version="schema/v1",
        )
        fact = SmokePipeline._facts_with_extraction_provenance(result, [source])[0]
        self.assertEqual(fact["_provider_id"], "programme-catalogue")
        self.assertEqual(fact["_dataset_id"], "programmes-2026")
        self.assertEqual(fact["_acquisition_run_id"], "provider-run")
        self.assertEqual(fact["scope"], "programme")
        self.assertEqual(fact["academic_cycle"], "2025-26")
        self.assertEqual(fact["audience"], "international")
        self.assertEqual(fact["value"]["currency"], "USD")
        self.assertEqual(fact["value"]["basis"], "per academic year")

    def test_deepseek_group_retention_uses_field_content(self) -> None:
        from glowbal_ingestion.deepseek import DeepSeekClient

        client = object.__new__(DeepSeekClient)
        client.config = SimpleNamespace(
            limits=SimpleNamespace(max_sources_per_extraction_group=2)
        )
        target = _source(
            "https://example.edu/programmes/data-science",
            "Data Science degree.",
            page_type="programme_overview",
            raw_id="target",
        )
        weak = _source(
            "https://example.edu/general-costs",
            "Welcome to student services.",
            page_type="tuition",
            raw_id="weak",
        )
        strong = _source(
            "https://example.edu/tuition/graduate",
            "Graduate tuition is USD 28,000 per academic year.",
            page_type="tuition",
            raw_id="strong",
        )
        programme = SimpleNamespace(official_url=target.url)
        selected = client._sources_for_group(
            "finance", [target, weak, strong], programme
        )
        self.assertEqual([item.url for item in selected], [target.url, strong.url])

    def test_programme_provider_json_survives_group_page_type_filter(self) -> None:
        from glowbal_ingestion.deepseek import DeepSeekClient

        client = object.__new__(DeepSeekClient)
        client.config = SimpleNamespace(
            limits=SimpleNamespace(max_sources_per_extraction_group=2)
        )
        target = _source(
            "https://example.edu/programmes/data-science",
            "Data Science degree.",
            page_type="programme_overview",
            raw_id="target",
        )
        provider = ExtractionSource(
            url="https://provider.example/catalogue.json",
            page_type="other",
            title=None,
            text="Data Science tuition is USD 28,000 per academic year.",
            content_hash="provider-hash",
            provider_id="existing-provider",
            dataset_id="catalogue-2026",
            source_resolution="programme",
            expected_field_groups=("tuition",),
        )
        selected = client._sources_for_group(
            "finance", [target, provider], SimpleNamespace(official_url=target.url)
        )
        self.assertEqual([item.url for item in selected], [target.url, provider.url])

    def test_exact_institution_provider_row_is_retained_for_its_finance_group(self) -> None:
        from glowbal_ingestion.deepseek import DeepSeekClient

        client = object.__new__(DeepSeekClient)
        client.config = SimpleNamespace(
            limits=SimpleNamespace(max_sources_per_extraction_group=2)
        )
        target = _source(
            "https://example.edu/programmes/data-science",
            "Data Science degree.",
            page_type="programme_overview",
            raw_id="target",
        )
        ordinary = _source(
            "https://example.edu/general-fees",
            "General fee information.",
            page_type="tuition",
            raw_id="ordinary",
        )
        provider = ExtractionSource(
            url="https://provider.example/scorecard.zip",
            page_type="unknown",
            title="Scorecard tuition row",
            text="Annual tuition and fees: 53450 (currency=USD; basis=annual)",
            content_hash="provider-hash",
            provider_id="scorecard",
            source_resolution="institution",
            expected_field_groups=("tuition", "finance"),
            external_entity_match=True,
        )
        programme = SimpleNamespace(official_url=target.url)
        selected = client._sources_for_group("finance", [target, ordinary, provider], programme)
        self.assertEqual([item.url for item in selected], [target.url, provider.url])
        identity = client._sources_for_group("identity_offering", [target, provider], programme)
        self.assertEqual([item.url for item in identity], [target.url])


class PipelinePrefetchIntegrationTests(unittest.TestCase):
    @staticmethod
    def _seed(**kwargs: object) -> InstitutionSeed:
        return InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
            **kwargs,
        )

    def test_configured_capacity_fetches_field_ranked_candidate_first(self) -> None:
        programme_url = "https://example.edu/programmes/data-science"
        generic = "https://example.edu/admissions/general"
        finance = "https://example.edu/fees/graduate-tuition"
        seed = self._seed(
            programme_source_bundles={programme_url: (generic, finance)}
        )
        config = SmokeConfig(
            run_name="field-ranked-configured-prefetch",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=2,
                max_admission_retry_sources_per_programme=0,
                max_coverage_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(programme_url, "Data Science MSc", "fixture", 7),
        )
        main = _source(
            programme_url,
            "Data Science MSc programme.",
            page_type="programme_overview",
            raw_id="main",
        )
        fetched: list[str] = []
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
                target_fields=("tuition",),
            )

            def fake_source(_seed: object, _policy: object, url: str):
                fetched.append(url)
                return (
                    None,
                    _source(
                        url,
                        "Graduate tuition is USD 30,000 per year."
                        if url == finance
                        else "General admissions information.",
                        page_type="tuition" if url == finance else "programme_admission",
                        raw_id=url,
                    ),
                    [],
                )

            pipeline._fetch_and_parse_source = fake_source
            try:
                pipeline._process_deep(
                    seed,
                    SimpleNamespace(allows=lambda *_args, **_kwargs: True),
                    programme,
                    (main, []),
                )
                self.assertEqual(fetched, [finance])
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_provider_cache_drops_unmatched_view_and_keeps_programme_match(self) -> None:
        seed = self._seed()
        config = SmokeConfig(
            run_name="provider-cache-materialized-view",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=2,
                max_admission_retry_sources_per_programme=0,
                max_coverage_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        stale = ExtractionSource(
            url="https://provider.example/catalogue.csv",
            page_type="unknown",
            title=None,
            text="unmatched export",
            content_hash="stale",
            provider_id="provider",
            source_resolution="programme",
            expected_field_groups=("programme_taxonomy",),
            external_entity_match=False,
        )
        matched = ExtractionSource(
            url=stale.url,
            page_type="unknown",
            title="matched row",
            text="Master Informatique",
            content_hash="matched",
            raw_document_id="raw-matched",
            provider_id="provider",
            source_resolution="programme",
            linked_programme_id="programme-1",
            expected_field_groups=("programme_taxonomy",),
            external_entity_match=True,
        )
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
                target_fields=("programme_identity",),
            )
            try:
                pipeline._cache_configured_extraction_source(
                    seed.institution_id,
                    stale,
                )
                pipeline._cache_configured_extraction_source(
                    seed.institution_id,
                    matched,
                )
                retained = pipeline._programme_provider_sources(
                    seed.institution_id,
                    ("programme_identity",),
                    programme_id="programme-1",
                )
                self.assertEqual(retained, (matched,))
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_related_prefetch_uses_anchor_field_rank_before_capacity(self) -> None:
        seed = self._seed()
        target = "https://example.edu/programmes/data-science"
        selected = SmokePipeline._related_links(
            None,
            [
                ("https://example.edu/admissions/general", "Admissions"),
                (
                    "https://example.edu/fees/graduate",
                    "Graduate tuition and fees 2025-26",
                ),
            ],
            seed,
            target,
            "master",
            frozenset(),
            ("tuition",),
        )
        self.assertEqual(selected[0], "https://example.edu/fees/graduate")

    def test_deep_selection_reuses_provider_sources_at_supported_scopes(self) -> None:
        seed = self._seed()
        target = "https://example.edu/programmes/data-science"
        config = SmokeConfig(
            run_name="provider-source-retention",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=3,
                max_admission_retry_sources_per_programme=0,
                max_coverage_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(target, "Data Science MSc", "fixture", 7),
        )
        main = _source(
            target,
            "Data Science MSc programme.",
            page_type="programme_overview",
            raw_id="main",
        )
        programme_provider = ExtractionSource(
            url="https://provider.example/programmes.json",
            page_type="other",
            title=None,
            text="Data Science tuition is USD 30,000 per academic year.",
            content_hash="programme-provider",
            provider_id="programme-catalogue",
            dataset_id="programmes-2026",
            academic_cycle="2025-26",
            source_resolution="programme",
            expected_field_groups=("tuition",),
        )
        institution_provider = ExtractionSource(
            url="https://provider.example/institutions.json",
            page_type="other",
            title=None,
            text="Institution tuition averages USD 20,000 per year.",
            content_hash="institution-provider",
            provider_id="institution-dataset",
            dataset_id="institutions-2026",
            academic_cycle="2025-26",
            source_resolution="institution",
            expected_field_groups=("tuition",),
        )
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
                target_fields=("tuition",),
            )
            pipeline._configured_extraction_sources[seed.institution_id] = [
                institution_provider,
                programme_provider,
            ]
            with patch(
                "glowbal_ingestion.pipeline.select_sources_for_fields",
                wraps=select_sources_for_fields,
            ) as select_mock:
                try:
                    pipeline._process_deep(
                        seed,
                        SimpleNamespace(allows=lambda *_args, **_kwargs: True),
                        programme,
                        (main, []),
                    )
                finally:
                    pipeline.state.close()
                    pipeline.llm_state.close()
        routed_sources = select_mock.call_args.args[0]
        self.assertIn(programme_provider, routed_sources)
        self.assertIn(institution_provider, routed_sources)

    def test_configured_broader_source_does_not_inherit_target_cycle(self) -> None:
        from glowbal_ingestion.source_adapters import ManualSourceAdapter

        seed = self._seed()
        context = SimpleNamespace(
            seed=seed,
            configuration={
                "official_web_resources": ({
                    "url": "https://example.edu/fees/graduate",
                    "source_class": "official_finance",
                    "provider_id": "example-finance",
                    "dataset_id": "fees-unknown-cycle",
                    "resolution": "institution",
                    "field_groups": ("tuition",),
                },),
            },
        )
        intent = SimpleNamespace(
            preferred_source_classes=("official_finance",),
            field_groups=("tuition",),
            target_cycle="2026-2027",
        )
        candidate = ManualSourceAdapter().discover(intent, context)[-1]
        self.assertIsNone(candidate.academic_cycle)

    def test_concrete_provider_fields_match_without_family_relabeling(self) -> None:
        seed = self._seed()
        config = SmokeConfig(
            run_name="provider-field-routing",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=3,
                max_admission_retry_sources_per_programme=0,
                max_coverage_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        main = _source(
            programme.official_url,
            "Data Science MSc programme.",
            page_type="programme_overview",
            raw_id="main",
        )
        language = ExtractionSource(
            url="https://example.edu/admissions/english",
            page_type="other",
            title=None,
            text="IELTS overall 7.0; TOEFL iBT 100.",
            content_hash="language-provider",
            provider_id="example-language",
            source_resolution="institution",
            expected_field_groups=("ielts_overall", "toefl"),
        )
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
                target_fields=("ielts_overall",),
            )
            pipeline._configured_extraction_sources[seed.institution_id] = [language]
            with patch(
                "glowbal_ingestion.pipeline.select_sources_for_fields",
                wraps=select_sources_for_fields,
            ) as select_mock:
                try:
                    pipeline._process_deep(
                        seed,
                        SimpleNamespace(allows=lambda *_args, **_kwargs: True),
                        programme,
                        (main, []),
                    )
                finally:
                    pipeline.state.close()
                    pipeline.llm_state.close()
        routed_sources = select_mock.call_args.args[0]
        self.assertIn(language, routed_sources)

    def test_every_deep_field_has_a_recovery_link_strategy(self) -> None:
        self.assertEqual(
            set(DEEP_FIELDS).difference(COVERAGE_RETRY_FIELD_CATEGORIES),
            set(),
        )


if __name__ == "__main__":
    unittest.main()
