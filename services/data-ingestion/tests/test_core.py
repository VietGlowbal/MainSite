from __future__ import annotations

import contextlib
import csv
import gzip
import io
import json
import sys
import tempfile
import threading
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import unquote
from unittest import mock


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.config import (
    CrawlLimits,
    InstitutionSeed,
    ProgrammePriority,
    SmokeConfig,
)
from glowbal_ingestion.admission import build_admission_package
from glowbal_ingestion.approved_assertions import (
    ApprovedAssertionRepository,
)
from glowbal_ingestion.best_assertions import (
    merge_best_assertions,
    prefer_human_verified,
)
from glowbal_ingestion.cli import (
    _with_institution_batch,
    _with_manual_programme_urls,
    _with_manual_only,
    _with_ipeds_programme_priorities,
    _with_run_limits,
    _with_seed_overrides,
    _with_selected_institutions,
    _with_supabase_seeds,
)
from glowbal_ingestion.deepseek import (
    DeepSeekClient,
    DeepSeekError,
    ExtractionSource,
)
from glowbal_ingestion.crawl4ai_adapter import (
    rendered_page_is_useful,
    should_render_page,
)
from glowbal_ingestion.deterministic import (
    extract_deterministic_facts,
    extract_source_excerpt_assertions,
)
from glowbal_ingestion.discovery import (
    CatalogueDiscovery,
    ProgrammeCandidate,
    is_direct_curated_index_candidate,
    looks_like_index,
    looks_like_programme_detail,
    programme_url_score,
)
from glowbal_ingestion.ipeds import (
    IpedsTargetConfig,
    load_ipeds_programme_priorities,
    names_compatible,
    sync_ipeds,
)
from glowbal_ingestion.inheritance import (
    cache_shared_assertions,
    fields_to_extract,
    inherited_assertions_for_programme,
    merge_current_and_inherited,
    with_review_fingerprint,
)
from glowbal_ingestion.models import (
    DEEP_FIELDS,
    FieldAssertion,
    FetchResult,
    NullReason,
    PageType,
    PolicyCheck,
    PolicyStatus,
    ProgrammeRecord,
    SCHOOL_PROFILE_FIELDS,
    VerificationStatus,
    has_semantic_value,
    utc_now_iso,
)
from glowbal_ingestion.normalization import (
    apply_programme_priorities,
    candidate_to_programme,
    choose_deep_programmes,
    infer_credential,
    infer_degree,
    infer_degree_from_source_text,
    programme_is_selection_eligible,
    programme_priority_match_score,
    refine_programme_name_from_title,
)
from glowbal_ingestion.organisation import (
    backfill_organisation_hierarchy,
    extract_organisation_mentions,
)
from glowbal_ingestion.parsing import (
    classify_page,
    normalize_text,
    parse_html,
    parse_sitemap,
)
from glowbal_ingestion.pipeline import (
    SmokePipeline,
    dedupe_equivalent_assertions,
    review_decision,
)
from glowbal_ingestion.product_export import build_product_dataset
from glowbal_ingestion.policy import check_policy
from glowbal_ingestion.review_approval import (
    ReviewApprovalError,
    load_review_decisions,
    normalize_review_decision,
)
from glowbal_ingestion.scorecard import sync_scorecard
from glowbal_ingestion.scrapy_adapter import (
    ScrapyDiscoveredLink,
    ScrapyDiscoveryResult,
)
from glowbal_ingestion.storage import JsonlStore, RunPaths, StateStore
from glowbal_ingestion.source_excerpt_safety import (
    source_excerpt_is_safe,
)
from glowbal_ingestion.supabase_seeds import (
    SupabaseSeedResult,
    load_approved_supabase_seeds,
)
from glowbal_ingestion.supabase_import import (
    import_supabase_run,
    preflight_supabase_run,
)
from glowbal_ingestion.url_safety import (
    UnsafeUrlError,
    canonicalize_url,
    is_nonproduction_hostname,
    resolve_with_timeout,
    validate_url,
)
from glowbal_ingestion.validation import (
    fact_to_assertion,
    null_assertion,
    normalize_programme_status,
    programme_identity_supported,
    validate_assertion_set,
)
from run import _local_batch_arguments


FIXTURES = Path(__file__).resolve().parent / "fixtures"


class OrganisationHierarchyTests(unittest.TestCase):
    def test_extracts_school_and_department_from_official_breadcrumbs(
        self,
    ) -> None:
        html = """
        <html><head>
          <meta property="og:site_name" content="Columbia College">
          <title>Economics | Department of Economics | Columbia College</title>
        </head><body>
          <nav aria-label="breadcrumb">
            <a>Columbia College</a><a>Department of Economics</a>
          </nav>
        </body></html>
        """
        mentions = extract_organisation_mentions(
            html,
            source_url=(
                "https://bulletin.columbia.edu/columbia-college/"
                "departments-instruction/economics/"
            ),
        )
        self.assertIn(
            ("Columbia College", "college"),
            {(name, unit_type.value) for name, unit_type, _ in mentions},
        )
        self.assertIn(
            ("Department of Economics", "department"),
            {(name, unit_type.value) for name, unit_type, _ in mentions},
        )

    def test_backfill_writes_hierarchy_with_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            raw_dir = run_dir / "raw" / "html"
            raw_dir.mkdir(parents=True)
            html_path = raw_dir / "programme.html.gz"
            with gzip.open(html_path, "wb") as handle:
                handle.write(
                    b"<nav aria-label='breadcrumb'>"
                    b"<a>Columbia College</a>"
                    b"<a>Department of Economics</a></nav>"
                )
            url = (
                "https://bulletin.columbia.edu/columbia-college/"
                "departments-instruction/economics/"
            )
            (run_dir / "programmes.jsonl").write_text(
                json.dumps(
                    {
                        "programme_id": "programme-1",
                        "institution_id": "institution-1",
                        "programme_name": "Economics",
                        "official_url": url,
                        "organisation_unit_id": None,
                        "retrieved_at": "2026-01-01T00:00:00+00:00",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            (run_dir / "programme_offerings.jsonl").write_text(
                json.dumps({"programme_id": "programme-1"}) + "\n",
                encoding="utf-8",
            )
            (run_dir / "sources.jsonl").write_text(
                json.dumps(
                    {
                        "canonical_url": url,
                        "raw_object_path": "raw/html/programme.html.gz",
                        "content_type": "text/html; charset=utf-8",
                        "retrieved_at": "2026-01-01T00:00:00+00:00",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            result = backfill_organisation_hierarchy(run_dir)
            self.assertEqual(result["classified_programmes"], 1)
            units = [
                json.loads(line)
                for line in (run_dir / "organisation_units.jsonl")
                .read_text(encoding="utf-8")
                .splitlines()
            ]
            department = next(
                unit for unit in units if unit["unit_type"] == "department"
            )
            self.assertIsNotNone(
                department["parent_organisation_unit_id"]
            )
            programme = json.loads(
                (run_dir / "programmes.jsonl")
                .read_text(encoding="utf-8")
                .splitlines()[0]
            )
            self.assertEqual(
                programme["organisation_unit_id"],
                department["organisation_unit_id"],
            )


class ConfigTests(unittest.TestCase):
    def test_local_batch_alias_uses_core_cli_without_kaggle(self) -> None:
        arguments = _local_batch_arguments(
            ["2", "--programmes", "7", "--discovery-only"]
        )
        self.assertEqual(arguments[0], "run")
        self.assertIn("--supabase-approved-seeds", arguments)
        self.assertEqual(
            arguments[
                arguments.index("--institution-batch-index") + 1
            ],
            "2",
        )
        self.assertEqual(
            arguments[arguments.index("--max-deep-programmes") + 1],
            "7",
        )
        self.assertIn("--discovery-only", arguments)
        self.assertFalse(
            any("kaggle" in argument.lower() for argument in arguments)
        )

    def test_smoke_config_has_six_distinct_countries(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        self.assertEqual(len(config.institutions), 6)
        self.assertEqual(
            {seed.country_code for seed in config.institutions},
            {"US", "GB", "CA", "AU", "NL", "SG"},
        )
        self.assertTrue(
            all(seed.catalogue_hints for seed in config.institutions)
        )

    def test_manual_programme_url_must_match_official_domain(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        updated = _with_manual_programme_urls(
            config,
            [
                "mit-us=https://catalog.mit.edu/degree-charts/"
                "computer-science-engineering-course-6-3/"
            ],
        )
        mit = next(
            seed for seed in updated.institutions
            if seed.institution_id == "mit-us"
        )
        self.assertEqual(len(mit.manual_programme_urls), 1)
        with self.assertRaisesRegex(ValueError, "approved official domain"):
            _with_manual_programme_urls(
                config,
                ["mit-us=https://example.com/programmes/fake"],
            )

    def test_institution_subset_is_explicit_and_validated(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        selected = _with_selected_institutions(
            config, ["unsw-au", "mit-us"]
        )
        self.assertEqual(
            [seed.institution_id for seed in selected.institutions],
            ["mit-us", "unsw-au"],
        )
        with self.assertRaisesRegex(ValueError, "Unknown --institution"):
            _with_selected_institutions(config, ["unknown-school"])

    def test_institution_batch_is_stable_and_bounded(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json",
        )
        selected = _with_institution_batch(
            config,
            batch_size=2,
            batch_index=2,
        )
        self.assertEqual(
            [seed.institution_id for seed in selected.institutions],
            ["stanford-us", "yale-us"],
        )
        with self.assertRaisesRegex(ValueError, "does not exist"):
            _with_institution_batch(
                config,
                batch_size=2,
                batch_index=4,
            )

    def test_cli_can_bound_deep_work(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        updated = _with_run_limits(
            config,
            max_deep_programmes=1,
            max_deep_sources=4,
            programme_concurrency=2,
        )
        self.assertEqual(
            updated.limits.max_deep_programmes_per_institution, 1
        )
        self.assertEqual(
            updated.limits.max_deep_sources_per_programme, 4
        )
        self.assertEqual(
            updated.limits.max_optional_phd_total,
            config.limits.max_optional_phd_total,
        )
        self.assertEqual(
            updated.limits.programme_concurrency_per_institution,
            2,
        )
        with self.assertRaisesRegex(ValueError, "at least 1"):
            _with_run_limits(
                config,
                max_deep_programmes=0,
                max_deep_sources=None,
            )
        with self.assertRaisesRegex(ValueError, "between 1 and 4"):
            _with_run_limits(
                config,
                max_deep_programmes=None,
                max_deep_sources=None,
                programme_concurrency=5,
            )

    def test_manual_only_requires_and_keeps_direct_urls(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        config = _with_selected_institutions(config, ["imperial-uk"])
        with self.assertRaisesRegex(ValueError, "requires at least one"):
            _with_manual_only(config, True)
        config = _with_manual_programme_urls(
            config,
            [
                "imperial-uk=https://www.imperial.ac.uk/study/courses/"
                "postgraduate-taught/2026/applied-paediatrics/"
            ],
        )
        manual = _with_manual_only(config, True)
        self.assertTrue(manual.institutions[0].manual_only)

        fetcher = SimpleNamespace(limits=manual.limits)
        policy = SimpleNamespace(allows=lambda _url, _agent: True)
        candidates, sitemaps, errors = CatalogueDiscovery(fetcher).discover(
            manual.institutions[0], policy
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(sitemaps, [])
        self.assertEqual(errors, [])

    def test_manual_only_replaces_curated_urls_with_cli_urls(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json",
        )
        config = _with_selected_institutions(config, ["mit-us"])
        selected_url = (
            "https://catalog.mit.edu/degree-charts/"
            "computer-science-engineering-course-6-3/"
        )
        config = _with_manual_programme_urls(
            config,
            [f"mit-us={selected_url}"],
            replace_existing=True,
        )
        manual = _with_manual_only(config, True)
        self.assertEqual(
            manual.institutions[0].manual_programme_urls,
            (selected_url,),
        )

    def test_supabase_seeds_replace_static_institutions(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "smoke-institutions.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        seed = InstitutionSeed(
            institution_id="supabase-42",
            name="Example University",
            country_code="CA",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
        )
        updated = _with_supabase_seeds(
            config, SupabaseSeedResult((seed,), skipped_rows=1)
        )
        self.assertEqual(updated.institutions, (seed,))

    def test_supabase_seed_keeps_curated_discovery_metadata_by_domain(
        self,
    ) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json",
        )
        seed = InstitutionSeed(
            institution_id="supabase-42",
            name="Massachusetts Institute of Technology",
            country_code="US",
            official_domain="mit.edu",
            homepage_url="https://www.mit.edu/",
        )
        updated = _with_supabase_seeds(
            config,
            SupabaseSeedResult((seed,)),
        )
        merged = updated.institutions[0]
        self.assertEqual(merged.institution_id, "supabase-42")
        self.assertEqual(len(merged.manual_programme_urls), 5)
        self.assertTrue(merged.catalogue_hints)
        self.assertTrue(merged.programme_source_bundles)

    def test_ipeds_priorities_match_supabase_seed_by_name(self) -> None:
        seed = InstitutionSeed(
            institution_id="supabase-42",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
        )
        config = SmokeConfig(
            run_name="test",
            institutions=(seed,),
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            priorities = root / "ipeds_popular_programmes.jsonl"
            priorities.write_text(
                "\n".join(
                    json.dumps(row)
                    for row in (
                        {
                            "institution_id": "example-us",
                            "cip_code": "11.0701",
                            "cip_title": "Computer Science",
                            "selection_rank": 1,
                            "completions_total": 100,
                            "degree_completions": {"bachelor": 100},
                            "source_dataset": "test",
                            "data_year": "2025",
                        },
                        {
                            "institution_id": "other-us",
                            "cip_code": "52.0201",
                            "cip_title": "Business",
                            "selection_rank": 1,
                            "completions_total": 100,
                            "degree_completions": {"bachelor": 100},
                            "source_dataset": "test",
                            "data_year": "2025",
                        },
                    )
                )
                + "\n",
                encoding="utf-8",
            )
            (root / "ipeds_institutions.jsonl").write_text(
                "\n".join(
                    json.dumps(row)
                    for row in (
                        {
                            "institution_id": "example-us",
                            "configured_name": "Example University",
                            "ipeds_name": "Example University",
                        },
                        {
                            "institution_id": "other-us",
                            "configured_name": "Other University",
                            "ipeds_name": "Other University",
                        },
                    )
                )
                + "\n",
                encoding="utf-8",
            )
            updated = _with_ipeds_programme_priorities(
                config,
                priorities,
            )
        self.assertEqual(
            updated.institutions[0].programme_priorities[0].label,
            "Computer Science",
        )

    def test_reviewed_seed_overrides_are_domain_scoped(self) -> None:
        override_path = (
            SERVICE_ROOT / "configs" / "us-seed-overrides.json"
        )
        raw = json.loads(override_path.read_text(encoding="utf-8"))
        seeds = tuple(
            InstitutionSeed(
                institution_id=f"supabase-{index}",
                name=domain,
                country_code="US",
                official_domain=domain,
                homepage_url=f"https://www.{domain}/",
            )
            for index, domain in enumerate(
                raw["domains"],
                start=1,
            )
        )
        updated = _with_seed_overrides(
            SmokeConfig(run_name="test", institutions=seeds),
            override_path,
        )
        for seed in updated.institutions:
            self.assertTrue(seed.catalogue_hints)
            self.assertTrue(seed.school_profile_urls)
        michigan = next(
            seed
            for seed in updated.institutions
            if seed.official_domain == "umich.edu"
        )
        self.assertEqual(len(michigan.manual_programme_urls), 20)
        self.assertEqual(
            set(michigan.manual_programme_urls),
            set(michigan.programme_metadata),
        )
        princeton = next(
            seed
            for seed in updated.institutions
            if seed.official_domain == "princeton.edu"
        )
        self.assertEqual(len(princeton.manual_programme_urls), 15)
        self.assertEqual(
            set(princeton.manual_programme_urls),
            set(princeton.programme_metadata),
        )

    def test_programme_source_bundles_are_loaded(self) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json",
            SERVICE_ROOT / "configs" / "crawl-limits.json",
        )
        stanford = next(
            seed
            for seed in config.institutions
            if seed.institution_id == "stanford-us"
        )
        sources = stanford.programme_source_bundles[
            "https://www.cs.stanford.edu/admissions/masters-admissions"
        ]
        self.assertIn(
            "https://gradadmissions.stanford.edu/apply/recommendations",
            sources,
        )
        self.assertIn(
            (
                "https://studentservices.stanford.edu/tuition-rates/"
                "2026-2027-undergraduate-tuition-rates"
            ),
            stanford.shared_source_bundles["bachelor"],
        )

    def test_us_smoke_loads_school_profiles_and_five_curated_programmes(
        self,
    ) -> None:
        config = SmokeConfig.load(
            SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json"
        )
        self.assertEqual(
            config.limits.max_deep_programmes_per_institution, 5
        )
        for seed in config.institutions:
            self.assertEqual(len(seed.manual_programme_urls), 5)
            self.assertTrue(seed.school_profile_urls)
            self.assertEqual(
                set(seed.manual_programme_urls),
                set(seed.programme_metadata),
            )
        stanford = next(
            seed
            for seed in config.institutions
            if seed.institution_id == "stanford-us"
        )
        self.assertIn(
            "https://gradadmissions.stanford.edu/apply/recommendations",
            stanford.shared_admission_source_bundles["master"],
        )

    def test_supabase_seed_loader_uses_only_valid_rows(self) -> None:
        rows = [
            {
                "id": 42,
                "name": "Example University",
                "country_code": "ca",
                "primary_domain": "www.example.edu",
                "official_url": "https://www.example.edu/",
                "domain_candidates": [
                    "www.example.edu",
                    "admissions.example.edu",
                ],
            },
            {
                "id": 43,
                "name": "Duplicate Domain",
                "country_code": "CA",
                "primary_domain": "example.edu",
            },
            {
                "id": 44,
                "name": "Unsafe",
                "country_code": "US",
                "primary_domain": "127.0.0.1",
            },
        ]

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self, _limit):
                return json.dumps(rows).encode("utf-8")

        captured = {}

        def opener(request, timeout):
            captured["url"] = request.full_url
            captured["timeout"] = timeout
            self.assertEqual(request.get_header("Authorization"), "Bearer secret")
            self.assertEqual(request.get_header("Apikey"), "secret")
            return Response()

        result = load_approved_supabase_seeds(
            limit=10,
            country_codes=("ca",),
            environ={
                "NEXT_PUBLIC_SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_CRAWL_SEED_KEY": "secret",
            },
            opener=opener,
        )
        self.assertEqual(len(result.seeds), 1)
        self.assertEqual(result.skipped_rows, 2)
        self.assertEqual(result.seeds[0].institution_id, "supabase-42")
        self.assertEqual(result.seeds[0].official_domain, "example.edu")
        self.assertEqual(
            result.seeds[0].allowed_domains,
            ("admissions.example.edu",),
        )
        self.assertIn("domain_review_status=eq.approved", captured["url"])
        self.assertIn("crawl_seed_enabled=eq.true", captured["url"])
        self.assertIn("country_code=in.%28CA%29", captured["url"])
        self.assertEqual(captured["timeout"], 20)

    def test_supabase_seed_loader_does_not_send_new_key_as_bearer(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self, _limit):
                return b"[]"

        captured = {}

        def opener(request, timeout):
            captured["headers"] = {
                key.casefold(): value
                for key, value in request.header_items()
            }
            return Response()

        result = load_approved_supabase_seeds(
            limit=1,
            environ={
                "SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_CRAWL_SEED_KEY": "sb_secret_example",
            },
            opener=opener,
        )

        self.assertEqual(result.seeds, ())
        self.assertEqual(
            captured["headers"]["apikey"],
            "sb_secret_example",
        )
        self.assertNotIn("authorization", captured["headers"])


class SupabaseImportTests(unittest.TestCase):
    @staticmethod
    def _write_run(run_dir: Path) -> None:
        programme_id = "86dc18ff-92f1-53e9-9f8f-891466ccbc44"
        assertion_id = "2c101c45-4327-5798-b88f-3f204714db53"

        def write_json(name, payload):
            (run_dir / name).write_text(
                json.dumps(payload),
                encoding="utf-8",
            )

        def write_jsonl(name, records):
            (run_dir / name).write_text(
                "".join(json.dumps(record) + "\n" for record in records),
                encoding="utf-8",
            )

        write_json(
            "manifest.json",
            {
                "schema_version": "GlowBalSmokeRun/v2",
                "run_name": "test-run",
                "started_at": "2026-07-28T00:00:00+00:00",
                "completed_at": "2026-07-28T00:01:00+00:00",
            },
        )
        write_json(
            "coverage_report.json",
            {"metrics": {"programmes_discovered": 1}},
        )
        write_jsonl(
            "institutions.jsonl",
            [
                {
                    "institution_id": "mit-us",
                    "canonical_name": "MIT",
                    "country_code": "US",
                    "official_domain": "mit.edu",
                    "official_url": "https://www.mit.edu/",
                    "verification_status": "SEED",
                    "last_checked_at": "2026-07-28T00:00:00+00:00",
                }
            ],
        )
        write_jsonl(
            "school_profiles.jsonl",
            [
                {
                    "institution_id": "mit-us",
                    "institution_name": "MIT",
                    "fields": {
                        "mission": "Advance knowledge and educate students."
                    },
                    "source_urls": ["https://www.mit.edu/about/"],
                    "retrieved_at": "2026-07-28T00:00:20+00:00",
                }
            ],
        )
        write_jsonl(
            "programmes.jsonl",
            [
                {
                    "programme_id": programme_id,
                    "institution_id": "mit-us",
                    "programme_name": "Computer Science and Engineering",
                    "official_url": "https://catalog.mit.edu/example",
                    "degree_level": "bachelor",
                    "credential": "SB",
                    "catalogue_source": "https://catalog.mit.edu/",
                    "retrieved_at": "2026-07-28T00:00:30+00:00",
                    "verification_status": "RULE_VALIDATED",
                    "is_deep_selected": True,
                }
            ],
        )
        write_jsonl(
            "programme_offerings.jsonl",
            [
                {
                    "programme_offering_id": (
                        "d1d6f5c2-a872-5f43-98b1-3bf196718296"
                    ),
                    "programme_id": programme_id,
                    "academic_cycle": "2026-27",
                    "intake": "Fall 2026",
                    "audience": "international",
                }
            ],
        )
        assertion = {
            "assertion_id": assertion_id,
            "entity_type": "programme",
            "entity_id": programme_id,
            "field_name": "recommendation_letters",
            "value_json": {
                "requirement_status": "required",
                "required_count": 2,
                "application_stage": "initial_application",
            },
            "null_reason": None,
            "source_url": "https://mitadmissions.org/recommendations",
            "source_type": "programme_admission",
            "evidence": "Two recommendations are required.",
            "retrieved_at": "2026-07-28T00:00:40+00:00",
            "confidence": 0.9,
            "verification_status": "NEEDS_REVIEW",
            "extractor_version": "test",
            "model_name": "deepseek-v4-flash",
            "validation_errors": [],
            "source_content_hash": "fixture-content-hash",
            "review_fingerprint": (
                "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa"
            ),
        }
        write_jsonl("field_assertions.jsonl", [assertion])
        write_jsonl("effective_field_assertions.jsonl", [assertion])
        write_jsonl(
            "admission_packages.jsonl",
            [
                {
                    "programme_id": programme_id,
                    "institution_id": "mit-us",
                    "programme_name": "Computer Science and Engineering",
                    "official_url": "https://catalog.mit.edu/example",
                    "retrieved_at": "2026-07-28T00:00:50+00:00",
                    "requirements": [
                        {
                            "document_type": "recommendation_letter",
                            "source_field": "recommendation_letters",
                            "requirement_status": "required",
                            "required_count": 2,
                            "application_stage": "initial_application",
                            "accepted_alternatives": [],
                            "conflict": False,
                            "conflict_reasons": [],
                            "evidence": [],
                        }
                    ],
                    "precheck": {
                        "decision": "APPLICANT_DATA_REQUIRED"
                    },
                }
            ],
        )

    def test_dry_run_validates_and_counts_without_credentials(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "test-import-run"
            run_dir.mkdir()
            self._write_run(run_dir)

            result = import_supabase_run(run_dir)

        self.assertFalse(result.applied)
        self.assertIsNone(result.run_id)
        self.assertEqual(result.counts["crawl_institutions"], 1)
        self.assertEqual(result.counts["crawl_programmes"], 1)
        self.assertEqual(result.counts["crawl_programme_offerings"], 1)
        self.assertEqual(result.counts["crawl_admission_requirements"], 1)
        self.assertEqual(result.counts["crawl_review_items"], 1)

    def test_remote_preflight_links_main_university_by_domain(self) -> None:
        class Client:
            base_url = "https://main-project.supabase.co"

            def select(self, table, params):
                if table == "universities":
                    return [
                        {
                            "id": 42,
                            "name": "MIT",
                            "primary_domain": "mit.edu",
                        }
                    ]
                return []

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "test-import-run"
            run_dir.mkdir()
            self._write_run(run_dir)
            result = preflight_supabase_run(run_dir, client=Client())

        self.assertEqual(result.project_host, "main-project.supabase.co")
        self.assertEqual(result.institution_count, 1)
        self.assertEqual(result.linked_university_count, 1)

    def test_apply_streams_dependency_order_and_marks_complete(self) -> None:
        class Client:
            def __init__(self):
                self.inserts = []
                self.updates = []

            def select(self, table, params):
                if table == "universities":
                    return [
                        {
                            "id": 1,
                            "name": "MIT",
                            "primary_domain": "mit.edu",
                        }
                    ]
                return []

            def insert(
                self,
                table,
                rows,
                *,
                return_rows=False,
                on_conflict=None,
            ):
                self.inserts.append(
                    (table, list(rows), on_conflict)
                )
                if table == "crawl_runs":
                    return [
                        {
                            "id": (
                                "10000000-0000-0000-0000-000000000001"
                            )
                        }
                    ]
                return []

            def update(self, table, values, params):
                self.updates.append((table, dict(values), tuple(params)))

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "test-import-run"
            run_dir.mkdir()
            self._write_run(run_dir)
            client = Client()

            result = import_supabase_run(
                run_dir,
                apply=True,
                batch_size=2,
                client=client,
            )

        table_order = [item[0] for item in client.inserts]
        self.assertLess(
            table_order.index("crawl_institutions"),
            table_order.index("crawl_programmes"),
        )
        self.assertLess(
            table_order.index("crawl_programmes"),
            table_order.index("crawl_programme_offerings"),
        )
        review_insert = next(
            item for item in client.inserts
            if item[0] == "crawl_review_items"
        )
        institution_insert = next(
            item for item in client.inserts
            if item[0] == "crawl_institutions"
        )
        self.assertEqual(
            institution_insert[1][0]["payload"]["school_profile"][
                "fields"
            ]["mission"],
            "Advance knowledge and educate students.",
        )
        self.assertEqual(institution_insert[1][0]["university_id"], 1)
        self.assertEqual(review_insert[1][0]["priority"], 100)
        self.assertEqual(
            review_insert[1][0]["review_fingerprint"],
            "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",
        )
        self.assertTrue(result.applied)
        self.assertEqual(client.updates[-1][1]["status"], "completed")

    def test_failed_import_resumes_same_run_idempotently(self) -> None:
        run_id = "10000000-0000-0000-0000-000000000001"

        class Client:
            def __init__(self):
                self.inserts = []
                self.updates = []
                self.deletes = []

            def select(self, table, params):
                if table == "universities":
                    return [
                        {
                            "id": 1,
                            "name": "MIT",
                            "primary_domain": "mit.edu",
                        }
                    ]
                return [{"id": run_id, "status": "failed"}]

            def insert(
                self,
                table,
                rows,
                *,
                return_rows=False,
                on_conflict=None,
            ):
                self.inserts.append(
                    (table, list(rows), on_conflict)
                )
                return []

            def update(self, table, values, params):
                self.updates.append((table, dict(values), tuple(params)))

            def delete(self, table, params):
                self.deletes.append((table, tuple(params)))

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "test-import-run"
            run_dir.mkdir()
            self._write_run(run_dir)
            client = Client()

            result = import_supabase_run(
                run_dir,
                apply=True,
                batch_size=2,
                client=client,
            )

        self.assertEqual(result.run_id, run_id)
        self.assertNotIn(
            "crawl_runs",
            [item[0] for item in client.inserts],
        )
        self.assertEqual(
            [item[0] for item in client.deletes],
            ["crawl_review_items", "crawl_url_edges"],
        )
        programmes = next(
            item for item in client.inserts
            if item[0] == "crawl_programmes"
        )
        self.assertEqual(
            programmes[2],
            "run_id,programme_id",
        )
        self.assertEqual(client.updates[-1][1]["status"], "completed")


class IpedsTests(unittest.TestCase):
    def test_us_21_targets_are_unique_and_alias_compatible(self) -> None:
        config = IpedsTargetConfig.load(
            SERVICE_ROOT / "configs" / "ipeds-us-21.json"
        )
        self.assertEqual(config.collection_year, 2024)
        self.assertEqual(len(config.targets), 21)
        self.assertEqual(
            len({target.unitid for target in config.targets}), 21
        )
        berkeley = next(
            target
            for target in config.targets
            if target.institution_id == "uc-berkeley-us"
        )
        self.assertTrue(
            names_compatible(
                "University of California, Berkeley (UCB)",
                "University of California-Berkeley",
                berkeley.aliases,
            )
        )

    def test_offline_sync_filters_targets_and_ranks_cip_completions(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cache = root / "cache"
            output = root / "output"
            cache.mkdir()
            targets = root / "targets.json"
            targets.write_text(
                json.dumps(
                    {
                        "collection_year": 2024,
                        "targets": [
                            {
                                "institution_id": "alpha-us",
                                "unitid": 111111,
                                "name": "Alpha University",
                            },
                            {
                                "institution_id": "beta-us",
                                "unitid": 222222,
                                "name": "Beta University",
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            (cache / "HD2024.csv").write_text(
                "UNITID,INSTNM,WEBADDR,CONTROL,ICLEVEL,SECTOR,CITY,STABBR\n"
                "111111,Alpha University,alpha.edu,2,1,2,Alpha City,MA\n"
                "222222,Beta University,beta.edu,1,1,1,Beta City,CA\n"
                "999999,Out of Scope University,other.edu,3,1,3,Elsewhere,NY\n",
                encoding="utf-8",
            )
            (cache / "ADM2024.csv").write_text(
                "UNITID,APPLCN,ADMSSN,ENRLT,SATMT25,SATMT75\n"
                "111111,1000,100,50,700,790\n"
                "222222,500,250,125,600,720\n",
                encoding="utf-8",
            )
            (cache / "COST1_2024.csv").write_text(
                "UNITID,APPLFEEU,TUITION1,TUITION3\n"
                "111111,80,60000,60000\n"
                "222222,70,15000,42000\n",
                encoding="utf-8",
            )
            (cache / "C2024_A.csv").write_text(
                "UNITID,CIPCODE,CIPTITLE,AWLEVEL,CTOTALT\n"
                "111111,11.0701,Computer Science,5,200\n"
                "111111,14.0101,Engineering General,5,100\n"
                "111111,11.0701,Computer Science,7,25\n"
                "111111,99.0000,Grand total,5,9999\n"
                "222222,52.0201,Business Administration,5,300\n"
                "999999,11.0701,Computer Science,5,999\n",
                encoding="utf-8",
            )

            result = sync_ipeds(
                targets_path=targets,
                cache_dir=cache,
                output_dir=output,
                download_missing=False,
                popular_programme_limit=2,
            )
            self.assertEqual(result.target_count, 2)
            self.assertEqual(result.matched_count, 2)
            self.assertEqual(result.popular_programme_count, 3)
            self.assertEqual(result.crawl_seed_count, 2)
            crawl_config = SmokeConfig.load(
                output / "ipeds_crawl_config.json"
            )
            self.assertEqual(len(crawl_config.institutions), 2)
            self.assertEqual(
                crawl_config.institutions[0].official_domain,
                "alpha.edu",
            )
            self.assertEqual(
                crawl_config.institutions[0].terms_status,
                "UNREVIEWED",
            )
            self.assertEqual(
                len(crawl_config.institutions[0].catalogue_hints),
                5,
            )
            facts = [
                json.loads(line)
                for line in (
                    output / "ipeds_field_assertions.jsonl"
                ).read_text(encoding="utf-8").splitlines()
            ]
            acceptance = next(
                fact
                for fact in facts
                if fact["entity_id"] == "alpha-us"
                and fact["field_name"] == "institution_acceptance_rate"
            )
            self.assertEqual(acceptance["value_json"], 10.0)
            self.assertEqual(acceptance["source_type"], "IPEDS")
            self.assertEqual(
                acceptance["precedence"]["must_not_override"],
                [
                    "newer_official_website",
                    "newer_common_data_set",
                ],
            )
            popular = [
                json.loads(line)
                for line in (
                    output / "ipeds_popular_programmes.jsonl"
                ).read_text(encoding="utf-8").splitlines()
            ]
            alpha = [
                item
                for item in popular
                if item["institution_id"] == "alpha-us"
            ]
            self.assertEqual(alpha[0]["cip_code"], "11.0701")
            self.assertEqual(alpha[0]["completions_total"], 225)
            self.assertEqual(
                alpha[0]["degree_completions"],
                {"bachelor": 200, "master": 25},
            )
            self.assertNotIn(
                "99.0000",
                {item["cip_code"] for item in popular},
            )
            self.assertEqual(
                alpha[0]["selection_basis"],
                "ipeds_completions_by_cip",
            )
            priorities = load_ipeds_programme_priorities(
                output / "ipeds_popular_programmes.jsonl"
            )
            self.assertEqual(priorities["alpha-us"][0].rank, 1)
            self.assertEqual(
                priorities["alpha-us"][0].completions_for_degree(
                    "bachelor"
                ),
                200,
            )
            self.assertEqual(
                priorities["alpha-us"][0].completions_for_degree("phd"),
                0,
            )
            manifest = json.loads(
                (output / "ipeds_manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                manifest["precedence_policy"]["ipeds"], 50
            )
            self.assertIn(
                "COST1_2024",
                {
                    dataset["file_id"]
                    for dataset in manifest["datasets"]
                },
            )

            config = SmokeConfig.load(
                SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json"
            )
            alpha_seed = replace(
                config.institutions[0],
                institution_id="alpha-us",
            )
            updated = _with_ipeds_programme_priorities(
                replace(config, institutions=(alpha_seed,)),
                output / "ipeds_popular_programmes.jsonl",
            )
            self.assertEqual(
                updated.institutions[0].programme_priorities[0].label,
                "Computer Science",
            )


class ScorecardTests(unittest.TestCase):
    def test_scorecard_sync_uses_two_requests_and_preserves_contract(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            targets = root / "targets.json"
            cache = root / "cache"
            output = root / "output"
            targets.write_text(
                json.dumps(
                    {
                        "collection_year": 2024,
                        "targets": [
                            {
                                "institution_id": "alpha-us",
                                "unitid": 111111,
                                "name": "Alpha University",
                            },
                            {
                                "institution_id": "beta-us",
                                "unitid": 222222,
                                "name": "Beta University",
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            school_payload = {
                "metadata": {"total": 2},
                "results": [
                    {
                        "id": 111111,
                        "school.name": "Alpha University",
                        "school.school_url": "web.alpha.edu/",
                        "school.city": "Alpha City",
                        "school.state": "MA",
                        "school.ownership": 2,
                        "school.degrees_awarded.highest": 4,
                        "latest.student.size": 1000,
                        "latest.admissions.admission_rate.overall": 0.1,
                        "latest.cost.tuition.in_state": 60000,
                        "latest.cost.tuition.out_of_state": 60000,
                        "latest.cost.avg_net_price.overall": 22000,
                    },
                    {
                        "id": 222222,
                        "school.name": "Beta University",
                        "school.school_url": "beta.edu/",
                        "school.city": "Beta City",
                        "school.state": "CA",
                        "school.ownership": 1,
                        "school.degrees_awarded.highest": 4,
                        "latest.student.size": 2000,
                        "latest.admissions.admission_rate.overall": 0.5,
                        "latest.cost.tuition.in_state": 15000,
                        "latest.cost.tuition.out_of_state": 42000,
                    },
                ],
            }
            programme_payload = {
                "metadata": {"total": 2},
                "results": [
                    {
                        "id": 111111,
                        "school.name": "Alpha University",
                        "latest.programs.cip_4_digit": [
                            {
                                "code": "1107",
                                "title": "Computer Science.",
                                "credential": {"level": 3},
                                "counts": {"ipeds_awards1": 10},
                                "earnings": {
                                    "1_yr": {
                                        "overall_median_earnings": 90000
                                    },
                                    "5_yr": {
                                        "overall_median_earnings": 120000
                                    },
                                },
                            },
                            {
                                "code": "1107",
                                "title": "Computer Science.",
                                "credential": {"level": 5},
                                "counts": {"ipeds_awards1": 5},
                                "earnings": {},
                            },
                            {
                                "code": "2601",
                                "title": "Biology, General.",
                                "credential": {"level": 3},
                                "counts": {"ipeds_awards1": 20},
                                "earnings": {},
                            },
                        ],
                    },
                    {
                        "id": 222222,
                        "school.name": "Beta University",
                        "latest.programs.cip_4_digit": [
                            {
                                "code": "5202",
                                "title": "Business Administration.",
                                "credential": {"level": 3},
                                "counts": {"ipeds_awards1": 30},
                                "earnings": {},
                            }
                        ],
                    },
                ],
            }

            class FakeFetcher:
                def __init__(self) -> None:
                    self.calls = []

                def fetch(self, url, **kwargs):
                    self.calls.append((url, kwargs))
                    self.assert_key(kwargs)
                    payload = (
                        programme_payload
                        if "latest.programs" in unquote(url)
                        else school_payload
                    )
                    return SimpleNamespace(
                        body=json.dumps(payload).encode("utf-8")
                    )

                @staticmethod
                def assert_key(kwargs):
                    if kwargs.get("conditional_headers") != {
                        "X-Api-Key": "secret-key"
                    }:
                        raise AssertionError("API key header was not used")

            fetcher = FakeFetcher()
            result = sync_scorecard(
                targets_path=targets,
                cache_dir=cache,
                output_dir=output,
                download_missing=True,
                popular_programme_limit=2,
                fetcher=fetcher,
                environ={"COLLEGE_SCORECARD_API_KEY": "secret-key"},
            )
            self.assertEqual(len(fetcher.calls), 2)
            self.assertTrue(
                all(
                    "secret-key" not in url
                    for url, _kwargs in fetcher.calls
                )
            )
            self.assertEqual(result.matched_count, 2)
            self.assertEqual(result.crawl_seed_count, 2)
            self.assertEqual(result.popular_programme_count, 3)
            facts = [
                json.loads(line)
                for line in (
                    output / "ipeds_field_assertions.jsonl"
                ).read_text(encoding="utf-8").splitlines()
            ]
            acceptance = next(
                fact
                for fact in facts
                if fact["entity_id"] == "alpha-us"
                and fact["field_name"] == "institution_acceptance_rate"
            )
            self.assertEqual(acceptance["value_json"], 10.0)
            self.assertNotIn("secret-key", acceptance["source_url"])
            programmes = [
                json.loads(line)
                for line in (
                    output / "ipeds_popular_programmes.jsonl"
                ).read_text(encoding="utf-8").splitlines()
            ]
            alpha = [
                item
                for item in programmes
                if item["institution_id"] == "alpha-us"
            ]
            self.assertEqual(alpha[0]["cip_code"], "2601")
            computer_science = next(
                item for item in alpha if item["cip_code"] == "1107"
            )
            self.assertEqual(
                computer_science["degree_completions"],
                {"bachelor": 10, "master": 5},
            )
            self.assertEqual(
                computer_science["career_outcomes"]["bachelor"][
                    "median_earnings_1_year"
                ],
                90000,
            )
            priorities = load_ipeds_programme_priorities(
                output / "ipeds_popular_programmes.jsonl"
            )
            self.assertEqual(len(priorities["alpha-us"]), 2)
            manifest_text = (
                output / "ipeds_manifest.json"
            ).read_text(encoding="utf-8")
            self.assertNotIn("secret-key", manifest_text)
            self.assertIn('"api_key_in_output": false', manifest_text)

            class OfflineFetcher:
                def fetch(self, *_args, **_kwargs):
                    raise AssertionError("offline sync attempted network")

            offline_result = sync_scorecard(
                targets_path=targets,
                cache_dir=cache,
                output_dir=root / "offline-output",
                download_missing=False,
                popular_programme_limit=2,
                fetcher=OfflineFetcher(),
                environ={},
            )
            self.assertEqual(offline_result.matched_count, 2)


class UrlSafetyTests(unittest.TestCase):
    def test_canonicalization_removes_tracking_and_fragment(self) -> None:
        value = canonicalize_url(
            "HTTPS://WWW.Example.EDU/a/../program/?utm_source=x&b=2&a=1#top"
        )
        self.assertEqual(
            value, "https://www.example.edu/program/?a=1&b=2"
        )

    def test_canonicalization_encodes_spaces_in_catalogue_paths(self) -> None:
        value = canonicalize_url(
            "https://www.ucla.edu/browse/College and Schools/"
            "JohnEAndersonGraduateSchoolofManagement"
        )
        self.assertEqual(
            value,
            "https://www.ucla.edu/browse/College%20and%20Schools/"
            "JohnEAndersonGraduateSchoolofManagement",
        )

    def test_valid_official_subdomain(self) -> None:
        result = validate_url(
            "https://catalog.example.edu/programmes/",
            ["example.edu"],
            resolver=lambda _host, _port: ["93.184.216.34"],
        )
        self.assertEqual(result.hostname, "catalog.example.edu")

    def test_private_dns_target_is_rejected(self) -> None:
        with self.assertRaises(UnsafeUrlError):
            validate_url(
                "https://catalog.example.edu/programmes/",
                ["example.edu"],
                resolver=lambda _host, _port: ["127.0.0.1"],
            )

    def test_unapproved_suffix_trick_is_rejected(self) -> None:
        with self.assertRaises(UnsafeUrlError):
            validate_url(
                "https://example.edu.attacker.test/programmes/",
                ["example.edu"],
                resolver=lambda _host, _port: ["93.184.216.34"],
            )

    def test_nonproduction_subdomains_are_detected(self) -> None:
        self.assertTrue(is_nonproduction_hostname("catalog-dev.mit.edu"))
        self.assertTrue(
            is_nonproduction_hostname("bulletin-next.columbia.edu")
        )
        self.assertTrue(is_nonproduction_hostname("staging.example.edu"))
        self.assertFalse(is_nonproduction_hostname("catalog.mit.edu"))

    def test_dns_resolution_is_bounded(self) -> None:
        blocker = threading.Event()
        with self.assertRaises(TimeoutError):
            resolve_with_timeout(
                "slow.example.edu",
                443,
                timeout_seconds=0.01,
                resolver=lambda _hostname, _port: (
                    blocker.wait(1) or ["93.184.216.34"]
                ),
            )


class ParsingTests(unittest.TestCase):
    def test_admission_document_pages_beat_generic_fee_or_deadline_signals(
        self,
    ) -> None:
        self.assertEqual(
            classify_page(
                "https://admission.stanford.edu/apply/first-year/forms.html",
                "Transcript, School Report and Recommendations",
                "Application fee and deadline information",
            ),
            PageType.PROGRAMME_ADMISSION,
        )
        self.assertEqual(
            classify_page(
                "https://gradadmissions.stanford.edu/apply/recommendations",
                "Recommendations",
                "Letters are due by the application deadline.",
            ),
            PageType.PROGRAMME_ADMISSION,
        )

    def test_html_extracts_visible_text_and_links(self) -> None:
        page = parse_html(
            (FIXTURES / "catalogue.html").read_bytes(),
            "https://example.edu/catalogue/",
            "text/html; charset=utf-8",
        )
        self.assertEqual(page.language, "en")
        self.assertNotIn("Hallucination", page.text)
        self.assertIn(
            (
                "https://example.edu/programmes/computer-science-bsc",
                "Computer Science BSc",
            ),
            page.links,
        )

    def test_catalogue_table_links_include_row_programme_name(self) -> None:
        page = parse_html(
            (
                "<table><tr><td>Accountancy</td><td>BUS</td>"
                "<td><a href='/undergraduate/bus/accountancy-bs/'>BS</a></td>"
                "<td><a href='/graduate/bus/accountancy-phd/'>PhD</a>"
                "<a href='/graduate/bus/accountancy-minor/'>Minor</a></td>"
                "</tr></table>"
            ).encode(),
            "https://catalog.example.edu/degree-programs/",
            "text/html; charset=utf-8",
        )
        self.assertIn(
            (
                "https://catalog.example.edu/undergraduate/bus/accountancy-bs/",
                "Accountancy (BS)",
            ),
            page.links,
        )
        self.assertIn(
            (
                "https://catalog.example.edu/graduate/bus/accountancy-phd/",
                "Accountancy (PhD)",
            ),
            page.links,
        )
        self.assertIn(
            (
                "https://catalog.example.edu/graduate/bus/accountancy-minor/",
                "Accountancy (Minor)",
            ),
            page.links,
        )

    def test_sitemap_extracts_page_urls(self) -> None:
        nested, pages = parse_sitemap((FIXTURES / "sitemap.xml").read_bytes())
        self.assertEqual(nested, [])
        self.assertEqual(len(pages), 2)

    def test_utf8_wins_over_incorrect_latin1_header(self) -> None:
        page = parse_html(
            "<title>MSc Data Science – University</title>".encode("utf-8"),
            "https://example.edu/programmes/data-science",
            "text/html; charset=ISO-8859-1",
        )
        self.assertEqual(page.title, "MSc Data Science – University")

    def test_common_utf8_mojibake_is_repaired(self) -> None:
        self.assertEqual(
            normalize_text("Tuition â‚¬2,601 â€“ itâ€™s current."),
            "Tuition €2,601 – it’s current.",
        )
        self.assertEqual(normalize_text("Course 6-\u200b5"), "Course 6-5")
        self.assertEqual(normalize_text("\u00c2\u00adChemistry"), "Chemistry")

    def test_navigation_and_footer_are_not_extraction_content(self) -> None:
        page = parse_html(
            (
                "<html><body><header>University header</header>"
                "<div id='sidebar'><a href='/scholarships'>Scholarships</a>"
                "<div class='menu'>All programmes</div></div>"
                "<input class='search' type='search'>"
                "<main><h1>MSc Data Science</h1>"
                "<a href='/admission-requirements'>Admission requirements</a>"
                "</main><footer>Financial aid</footer></body></html>"
            ).encode(),
            "https://example.edu/programmes/data-science",
            "text/html; charset=utf-8",
        )
        self.assertNotIn("University header", page.text)
        self.assertNotIn("Scholarships", page.text)
        self.assertNotIn("All programmes", page.text)
        self.assertNotIn("Financial aid", page.text)
        self.assertIn(
            ("https://example.edu/scholarships", "Scholarships"),
            page.links,
        )
        self.assertIn(
            (
                "https://example.edu/admission-requirements",
                "Admission requirements",
            ),
            page.links,
        )

    def test_content_inside_a_semantic_page_header_is_retained(self) -> None:
        page = parse_html(
            (
                "<html><body>"
                "<header class='programme-header'>"
                "<h1>Computer Science</h1>"
                "<p>The programme develops rigorous problem-solving skills.</p>"
                "</header>"
                "</body></html>"
            ).encode(),
            "https://example.edu/programmes/computer-science",
            "text/html; charset=utf-8",
        )
        self.assertIn("Computer Science", page.text)
        self.assertIn("rigorous problem-solving skills", page.text)

    def test_generic_admissions_path_is_not_classified_from_noisy_body(
        self,
    ) -> None:
        self.assertEqual(
            classify_page(
                "https://catalog.example.edu/graduate-education/admissions/",
                "Admissions",
                "Navigation includes costs, financial aid and scholarships.",
            ),
            PageType.PROGRAMME_ADMISSION,
        )

    def test_aid_and_cost_pages_beat_generic_apply_signals(self) -> None:
        self.assertEqual(
            classify_page(
                "https://example.edu/afford/how-to-apply-for-aid/",
                "How to apply for aid",
                "Application instructions.",
            ),
            PageType.SCHOLARSHIP,
        )
        self.assertEqual(
            classify_page(
                "https://catalog.example.edu/undergraduate/costs/",
                "Costs",
                "Undergraduate education.",
            ),
            PageType.TUITION,
        )

    def test_crawl4ai_auto_policy_only_renders_sparse_or_js_shell_pages(
        self,
    ) -> None:
        sparse = parse_html(
            b"<html><body><div id='__next'></div></body></html>",
            "https://example.edu/programmes/data-science",
            "text/html",
        )
        complete = parse_html(
            (
                "<html><body><h1>Data Science MSc</h1>"
                f"<p>{'Programme curriculum and admission details. ' * 80}</p>"
                "<a href='/admissions'>Admissions</a></body></html>"
            ).encode(),
            "https://example.edu/programmes/data-science",
            "text/html",
        )
        self.assertTrue(
            should_render_page(
                sparse,
                b"<div id='__next'></div>",
                policy="auto",
                min_text_chars=800,
            )
        )
        self.assertFalse(
            should_render_page(
                complete,
                b"<html>server rendered</html>",
                policy="auto",
                min_text_chars=800,
            )
        )
        self.assertTrue(
            should_render_page(
                complete,
                b"",
                policy="always",
                min_text_chars=800,
            )
        )

    def test_rendered_page_requires_material_gain_in_auto_mode(self) -> None:
        native = parse_html(
            b"<h1>Data Science</h1>",
            "https://example.edu/programmes/data-science",
            "text/html",
        )
        rendered = parse_html(
            (
                "<h1>Data Science</h1>"
                f"<p>{'Curriculum admission tuition career outcomes. ' * 30}</p>"
                "<a href='/admissions'>Admissions</a>"
                "<a href='/tuition'>Tuition</a>"
                "<a href='/careers'>Careers</a>"
            ).encode(),
            "https://example.edu/programmes/data-science",
            "text/html",
        )
        self.assertTrue(
            rendered_page_is_useful(native, rendered, policy="auto")
        )
    def test_page_type_prefers_url_and_title_over_generic_body_links(self) -> None:
        self.assertEqual(
            classify_page(
                "https://example.edu/programmes/data-science-msc",
                "MSc Data Science",
                "Scholarships financial aid tuition fees",
            ),
            PageType.PROGRAMME_OVERVIEW,
        )
        self.assertEqual(
            classify_page(
                "https://example.edu/programmes/data-science/admission-requirements",
                "Admission Requirements",
                "IELTS links are available in the navigation.",
            ),
            PageType.PROGRAMME_ADMISSION,
        )

    def test_postgraduate_taught_url_is_programme_not_tuition(self) -> None:
        self.assertEqual(
            classify_page(
                "https://example.edu/study/courses/postgraduate-taught/2026/"
                "applied-paediatrics/",
                "Applied Paediatrics | Study",
                "This page includes tuition, scholarships and entry requirements.",
            ),
            PageType.PROGRAMME_OVERVIEW,
        )

    def test_deadline_and_scholarship_strong_signals_are_not_misclassified(
        self,
    ) -> None:
        self.assertEqual(
            classify_page(
                "https://example.edu/apply/deadlines/",
                "Application deadlines",
                "Scholarship applicants should apply early.",
            ),
            PageType.DEADLINE,
        )
        self.assertEqual(
            classify_page(
                "https://example.edu/fees-and-funding/scholarships/",
                "Engineering scholarships",
                "Awards may cover tuition fees.",
            ),
            PageType.SCHOLARSHIP,
        )

    def test_programme_specific_careers_page_is_a_career_source(self) -> None:
        self.assertEqual(
            classify_page(
                "https://example.edu/computer-science/undergraduate-program/careers",
                "Careers | School of Engineering",
                "What can you do with a degree in Computer Science?",
            ),
            PageType.CAREER_OUTCOME,
        )

    def test_financial_aid_subdomain_beats_international_body_text(
        self,
    ) -> None:
        self.assertEqual(
            classify_page(
                "https://financialaid.example.edu/undergrad/",
                "Undergraduate Basics",
                (
                    "International applicants may apply. "
                    "We provide need-based financial aid and scholarships."
                ),
            ),
            PageType.SCHOLARSHIP,
        )


class CatalogueDiscoveryTests(unittest.TestCase):
    def test_fields_of_study_index_accepts_named_degree_pages(self) -> None:
        root = "https://ua.example.edu/fields-study"
        target = (
            "https://ua.example.edu/fields-study/"
            "departmental-majors-degree-bachelor-arts/economics"
        )
        self.assertTrue(
            is_direct_curated_index_candidate(
                root_source=root,
                target_url=target,
                anchor_text="Economics",
                depth=0,
            )
        )

    def test_named_links_from_curated_programme_index_are_candidates(
        self,
    ) -> None:
        root = "https://example.edu/programs-of-study/"
        body = (
            b'<a href="https://aero.example.edu/academics/aerospace-engineering/">'
            b"Aerospace Engineering</a>"
            b'<a href="https://example.edu/about/">About</a>'
        )

        class Fetcher:
            limits = CrawlLimits(
                max_sitemaps_per_institution=0,
                max_index_pages=2,
                min_request_interval_seconds=0,
            )

            def fetch(self, url: str, **_kwargs) -> FetchResult:
                return FetchResult(
                    requested_url=url,
                    final_url=url,
                    status=200,
                    headers={"content-type": "text/html"},
                    content_type="text/html",
                    body=body,
                    content_hash="fixture",
                    retrieved_at=utc_now_iso(),
                )

        seed = InstitutionSeed(
            institution_id="example-us",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            catalogue_hints=(root,),
        )
        policy = SimpleNamespace(
            check=SimpleNamespace(sitemaps=[]),
            allows=lambda _url, _agent: True,
        )
        candidates, _, errors = CatalogueDiscovery(Fetcher()).discover(
            seed, policy
        )

        self.assertEqual(errors, [])
        self.assertEqual(
            [candidate.url for candidate in candidates],
            [
                "https://aero.example.edu/academics/"
                "aerospace-engineering/"
            ],
        )

    def test_coursedog_api_programmes_are_discovered_without_rendering(
        self,
    ) -> None:
        catalogue_url = "https://catalog.example.edu/programs"
        page_body = (
            b'<meta property="og:url" content="example_tenant-catalog.coursedog.com">'
            b'"12345678901234567890","Example Undergraduate Catalog 2026-2027",'
            b'"example_tenant","Example University"'
        )
        api_payload = {
            "listLength": 3,
            "data": [
                {
                    "programGroupId": "DATA01U",
                    "catalogDisplayName": "Data Science",
                    "degreeDesignation": "Bachelor of Science",
                    "status": "Active",
                    "type": "Major",
                },
                {
                    "programGroupId": "DATA02U",
                    "catalogDisplayName": "Data Science",
                    "degreeDesignation": "",
                    "status": "Active",
                    "type": "Minor",
                },
                {
                    "programGroupId": "OLD01U",
                    "catalogDisplayName": "Old Programme",
                    "degreeDesignation": "Bachelor of Arts",
                    "status": "Inactive",
                    "type": "Major",
                },
            ],
        }

        class Fetcher:
            limits = CrawlLimits(
                max_sitemaps_per_institution=0,
                max_index_pages=2,
                min_request_interval_seconds=0,
            )

            def __init__(self) -> None:
                self.api_kwargs: dict[str, object] = {}

            def fetch(self, url: str, **kwargs) -> FetchResult:
                if url == catalogue_url:
                    body = page_body
                    content_type = "text/html"
                else:
                    self.api_kwargs = kwargs
                    body = json.dumps(api_payload).encode("utf-8")
                    content_type = "application/json"
                return FetchResult(
                    requested_url=url,
                    final_url=url,
                    status=200,
                    headers={"content-type": content_type},
                    content_type=content_type,
                    body=body,
                    content_hash="fixture",
                    retrieved_at=utc_now_iso(),
                )

        seed = InstitutionSeed(
            institution_id="example-us",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
            catalogue_hints=(catalogue_url,),
            allowed_domains=("catalog.example.edu",),
        )
        fetcher = Fetcher()
        policy = SimpleNamespace(
            check=SimpleNamespace(sitemaps=[]),
            allows=lambda _url, _agent: True,
        )
        edges: list[dict[str, object]] = []
        candidates, _, errors = CatalogueDiscovery(
            fetcher,
            graph_sink=edges.append,
        ).discover(seed, policy)

        self.assertEqual(errors, [])
        self.assertEqual(len(candidates), 1)
        self.assertEqual(
            candidates[0].url,
            "https://catalog.example.edu/programs/DATA01U",
        )
        self.assertEqual(fetcher.api_kwargs["method"], "POST")
        self.assertEqual(fetcher.api_kwargs["data"], b"{}")
        self.assertTrue(
            any(edge["relation"] == "coursedog_api" for edge in edges)
        )

    def test_seed_without_hints_uses_homepage_graph_fallback(self) -> None:
        pages = {
            "https://www.example.edu/": (
                b'<a href="/academics/">Academics</a>'
            ),
            "https://www.example.edu/academics/": (
                b'<a href="/programs/data-science-ms/">'
                b"Data Science MS</a>"
            ),
        }

        class Fetcher:
            limits = CrawlLimits(
                max_sitemaps_per_institution=0,
                max_index_pages=5,
                min_request_interval_seconds=0,
            )

            def __init__(self) -> None:
                self.calls: list[str] = []

            def fetch(self, url: str, **_kwargs) -> FetchResult:
                self.calls.append(url)
                body = pages[url]
                return FetchResult(
                    requested_url=url,
                    final_url=url,
                    status=200,
                    headers={"content-type": "text/html"},
                    content_type="text/html",
                    body=body,
                    content_hash="fixture",
                    retrieved_at=utc_now_iso(),
                )

        seed = InstitutionSeed(
            institution_id="example-us",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
        )
        fetcher = Fetcher()
        policy = SimpleNamespace(
            check=SimpleNamespace(sitemaps=[]),
            allows=lambda _url, _agent: True,
        )
        edges: list[dict[str, object]] = []
        candidates, _, errors = CatalogueDiscovery(
            fetcher,
            graph_sink=edges.append,
        ).discover(seed, policy)

        self.assertEqual(errors, [])
        self.assertEqual(
            [candidate.url for candidate in candidates],
            ["https://www.example.edu/programs/data-science-ms/"],
        )
        self.assertEqual(
            fetcher.calls,
            [
                "https://www.example.edu/",
                "https://www.example.edu/academics/",
            ],
        )
        self.assertTrue(
            any(edge["relation"] == "native_anchor" for edge in edges)
        )


class ScrapyAdapterIntegrationTests(unittest.TestCase):
    def test_scrapy_discovered_links_are_merged_and_graph_is_recorded(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example-us",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
        )
        limits = CrawlLimits(
            max_sitemaps_per_institution=0,
            max_index_pages=5,
        )
        fetcher = SimpleNamespace(limits=limits)
        policy = SimpleNamespace(
            check=SimpleNamespace(sitemaps=[]),
            allows=lambda _url, _agent: True,
        )
        adapter = SimpleNamespace(
            discover=lambda _seed: ScrapyDiscoveryResult(
                links=(
                    ScrapyDiscoveredLink(
                        url=(
                            "https://example.edu/programmes/"
                            "data-science-msc"
                        ),
                        source_url=(
                            "https://example.edu/academics/programmes"
                        ),
                        anchor_text="Data Science MSc",
                        depth=1,
                    ),
                ),
                pages_crawled=2,
            )
        )
        edges: list[dict[str, object]] = []
        candidates, _, errors = CatalogueDiscovery(
            fetcher,
            backend="scrapy",
            scrapy_adapter=adapter,
            graph_sink=edges.append,
        ).discover(seed, policy)
        self.assertEqual(errors, [])
        self.assertEqual(len(candidates), 1)
        self.assertEqual(
            candidates[0].url,
            "https://example.edu/programmes/data-science-msc",
        )
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0]["relation"], "scrapy_anchor")


class PolicyTests(unittest.TestCase):
    class FakeFetcher:
        def __init__(self) -> None:
            self.limits = CrawlLimits(min_request_interval_seconds=0)
            self.calls: list[str] = []

        def fetch(self, url: str, **_kwargs) -> FetchResult:
            self.calls.append(url)
            if url == "https://www.example.edu/robots.txt":
                body = b"User-agent: *\nDisallow: /\n"
            elif url == "https://catalog.example.edu/robots.txt":
                body = (
                    b"User-agent: *\nDisallow: /private\n"
                    b"Sitemap: https://catalog.example.edu/sitemap.xml\n"
                )
            else:
                body = b"User-agent: *\nDisallow:\n"
            return FetchResult(
                requested_url=url,
                final_url=url,
                status=200,
                headers={"content-type": "text/plain"},
                content_type="text/plain",
                body=body,
                content_hash="fixture",
                retrieved_at=utc_now_iso(),
            )

    def test_robots_rules_are_loaded_per_hostname(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
            catalogue_hints=(
                "https://catalog.example.edu/programmes/",
            ),
            terms_status="APPROVED",
        )
        fetcher = self.FakeFetcher()
        policy = check_policy(
            seed, fetcher, allow_unreviewed_terms=False
        )
        self.assertEqual(policy.check.policy_status, PolicyStatus.ALLOWED)
        self.assertFalse(
            policy.allows(
                "https://www.example.edu/about", fetcher.limits.user_agent
            )
        )
        self.assertTrue(
            policy.allows(
                "https://catalog.example.edu/programmes/data-science",
                fetcher.limits.user_agent,
            )
        )
        self.assertFalse(
            policy.allows(
                "https://catalog.example.edu/private/data",
                fetcher.limits.user_agent,
            )
        )
        self.assertIn(
            "https://catalog.example.edu/sitemap.xml",
            policy.check.sitemaps,
        )
        self.assertEqual(len(fetcher.calls), 2)

    def test_manual_only_policy_skips_unused_catalogue_hosts(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
            catalogue_hints=(
                "https://unused.example.edu/programmes/",
            ),
            manual_programme_urls=(
                "https://www.example.edu/programmes/data-science",
            ),
            terms_status="APPROVED",
            manual_only=True,
        )
        fetcher = self.FakeFetcher()
        check_policy(
            seed,
            fetcher,
            allow_unreviewed_terms=False,
        )
        self.assertEqual(
            fetcher.calls,
            ["https://www.example.edu/robots.txt"],
        )


class NormalizationTests(unittest.TestCase):
    def test_caltech_requirement_pages_are_not_programmes(self) -> None:
        for name in (
            "Core Institute Requirements, All Options",
            "Graduation Requirements, All Options",
            "Other First-Year Courses",
            "Typical First-Year Course Schedule, All Options",
            "Master's Studies",
            "Master\u2019s Studies",
            "Checklist and Timeline",
            "Communication Resources for Master\u2019s Students",
            "Admitted Students",
            "Application Process, Tuition, and Financial Aid",
            "Curriculum, Course Sequence, & Degree Requirements",
            "FAQ",
        ):
            with self.subTest(name=name):
                programme = candidate_to_programme(
                    "caltech-us",
                    ProgrammeCandidate(
                        url=(
                            "https://catalog.caltech.edu/current/"
                            "information-for-undergraduate-students/"
                            "graduation-requirements-all-options/"
                            "computer-science-option-and-minor-cs/"
                        ),
                        name_hint=name,
                        catalogue_source="catalogue",
                        score=7,
                    ),
                )
                self.assertFalse(
                    programme_is_selection_eligible(programme)
                )

    def test_degree_is_inferred_from_explicit_degrees_offered_section(
        self,
    ) -> None:
        degree, credential = infer_degree_from_source_text(
            "Applied Mathematics. APPLICATION DEADLINE Degrees Offered "
            "Doctor of Philosophy (PhD) Deadline Dec 15. Footer offers "
            "PhD and select master's degrees."
        )
        self.assertEqual((degree, credential), ("phd", "PhD"))

        degree, credential = infer_degree_from_source_text(
            "Computational Science. Degrees Offered Master of Engineering "
            "(ME) Master of Science (SM)."
        )
        self.assertEqual(degree, "master")
        self.assertIn(credential, {"MS", "SM"})

    def test_degree_option_page_that_also_documents_minor_is_eligible(
        self,
    ) -> None:
        programme = candidate_to_programme(
            "caltech-us",
            ProgrammeCandidate(
                url=(
                    "https://catalog.caltech.edu/current/"
                    "information-for-undergraduate-students/"
                    "graduation-requirements-all-options/"
                    "computer-science-option-and-minor-cs/"
                ),
                name_hint="Computer Science Option and Minor (CS)",
                catalogue_source="catalogue",
                score=7,
            ),
        )
        self.assertTrue(programme_is_selection_eligible(programme))

    def test_scoring_and_mit_credentials(self) -> None:
        self.assertGreaterEqual(
            programme_url_score(
                "https://catalog.mit.edu/degree-charts/computer-science-engineering-course-6-3/",
                "Computer Science and Engineering (Course 6-3) SB",
            ),
            4,
        )
        self.assertEqual(infer_degree("Electrical Engineering SM", ""), "master")
        self.assertEqual(infer_credential("Electrical Engineering SM", ""), "SM")
        self.assertEqual(infer_degree("Computer Science SB", ""), "bachelor")
        self.assertEqual(infer_credential("Computer Science SB", ""), "SB")
        self.assertIsNone(infer_degree("Ms Jennie Chua", ""))
        self.assertIsNone(infer_credential("Ms Jennie Chua", ""))

    def test_non_programme_pages_do_not_pass_discovery_filter(self) -> None:
        self.assertLess(
            programme_url_score(
                "https://example.edu/course/AER1202H", "AER1202H"
            ),
            4,
        )

    def test_catalogue_specific_programme_paths_use_generic_patterns(
        self,
    ) -> None:
        examples = (
            (
                "https://catalog.caltech.edu/current/information-for-"
                "undergraduate-students/graduation-requirements-all-"
                "options/computer-science-option-and-minor-cs/",
                "Computer Science Option and Minor (CS)",
            ),
            (
                "https://www.cmu.edu/admission/majors-programs/"
                "school-of-computer-science/computer-science",
                "Computer Science",
            ),
            (
                "https://bulletin.columbia.edu/general-studies/"
                "majors-concentrations/computer-science",
                "Computer Science",
            ),
            (
                "https://bulletin.columbia.edu/columbia-college/"
                "departments-instruction/economics",
                "Economics",
            ),
        )
        for url, name in examples:
            with self.subTest(url=url):
                self.assertGreaterEqual(
                    programme_url_score(url, name),
                    4,
                )
        self.assertTrue(
            looks_like_index(
                "https://coursecatalog.web.cmu.edu/degreesoffered/"
                "graduate-degrees/",
                "Graduate Degrees",
            )
        )

    def test_major_catalogue_paths_infer_bachelor_degree(self) -> None:
        examples = (
            (
                "https://www.cmu.edu/admission/majors-programs/"
                "school-of-computer-science/computer-science",
                "Computer Science",
            ),
            (
                "https://bulletin.columbia.edu/general-studies/"
                "majors-concentrations/economics",
                "Economics",
            ),
            (
                "https://bulletin.columbia.edu/columbia-college/"
                "departments-instruction/political-science",
                "Political Science",
            ),
        )
        for url, name in examples:
            with self.subTest(url=url):
                programme = candidate_to_programme(
                    "example",
                    ProgrammeCandidate(
                        url=url,
                        name_hint=name,
                        catalogue_source="catalogue",
                        score=7,
                    ),
                )
                self.assertEqual(programme.degree_level, "bachelor")
                self.assertTrue(
                    programme_is_selection_eligible(programme)
                )

    def test_academic_unit_indexes_are_not_programmes(self) -> None:
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                url=(
                    "https://www.cmu.edu/admission/majors-programs/"
                    "college-of-engineering"
                ),
                name_hint="College of Engineering",
                catalogue_source="catalogue",
                score=7,
            ),
        )
        self.assertFalse(programme_is_selection_eligible(programme))

    def test_non_degree_programmes_are_not_deep_selection_eligible(
        self,
    ) -> None:
        false_programmes = (
            candidate_to_programme(
                "caltech-us",
                ProgrammeCandidate(
                    url=(
                        "https://sfp.caltech.edu/undergraduate-research/"
                        "programs/amgen_scholars/application_information"
                    ),
                    name_hint="Application Information",
                    catalogue_source="https://www.caltech.edu/",
                    score=8,
                ),
            ),
            candidate_to_programme(
                "cmu-us",
                ProgrammeCandidate(
                    url=(
                        "https://www.cs.cmu.edu/bs-in-artificial-intelligence/"
                        "forms/ai-additional-major-minor-request"
                    ),
                    name_hint="Apply for an Additional Major or Minor",
                    catalogue_source="https://www.cmu.edu/",
                    score=8,
                ),
            ),
        )
        self.assertTrue(
            all(
                not programme_is_selection_eligible(programme)
                for programme in false_programmes
            )
        )
        selected = choose_deep_programmes(
            list(false_programmes),
            include_optional_phd=False,
            max_regular=5,
        )
        self.assertEqual(selected, [])
        self.assertLess(
            programme_url_score(
                "https://example.edu/article/phd-researcher-interview/",
                "PhD researcher interview",
            ),
            0,
        )
        self.assertFalse(
            looks_like_programme_detail(
                "https://example.edu/study/courses/undergraduate/2026/"
            )
        )
        self.assertTrue(
            looks_like_programme_detail(
                "https://example.edu/study/courses/undergraduate/2026/"
                "aeronautical-engineering/"
            )
        )
        self.assertFalse(
            looks_like_programme_detail(
                "https://catalog.mit.edu/degree-charts/"
                "eecs-subject-groupings/"
            )
        )
        self.assertFalse(
            looks_like_programme_detail(
                "https://catalog.mit.edu/degree-charts/"
                "electrical-engineering-computer-science-tracks/"
            )
        )

    def test_batch_one_false_positives_are_not_selected(self) -> None:
        false_candidates = (
            ProgrammeCandidate(
                url=(
                    "https://gradschool.duke.edu/professional-development/"
                    "programs/masters-students-resources/past-workshops/"
                    "2017-2018-workshops/"
                ),
                name_hint="2017 2018 Workshops",
                catalogue_source="https://www.duke.edu/academics/",
                score=7,
            ),
            ProgrammeCandidate(
                url=(
                    "https://catalog.caltech.edu/current/information-for-"
                    "undergraduate-students/graduation-requirements-all-"
                    "options/structural-mechanics-minor-sm/"
                ),
                name_hint="Structural Mechanics Minor (SM)",
                catalogue_source="https://catalog.caltech.edu/",
                score=7,
            ),
            ProgrammeCandidate(
                url=(
                    "https://bulletin.columbia.edu/general-studies/"
                    "academic-policies/study-within-graduate-"
                    "professional-schools/"
                ),
                name_hint=(
                    "Columbia Master's Programs Accelerated Master's "
                    "Programs Career Planning"
                ),
                catalogue_source="https://bulletin.columbia.edu/",
                score=7,
            ),
        )
        programmes = [
            candidate_to_programme("example", candidate)
            for candidate in false_candidates
        ]
        self.assertTrue(
            all(
                not programme_is_selection_eligible(programme)
                for programme in programmes
            )
        )
        self.assertEqual(
            choose_deep_programmes(
                programmes,
                include_optional_phd=False,
                max_regular=5,
            ),
            [],
        )

    def test_generic_link_label_uses_programme_url_slug(self) -> None:
        programme = candidate_to_programme(
            "cmu-us",
            ProgrammeCandidate(
                url=(
                    "https://www.cmu.edu/cfa/music/programs/"
                    "undergraduate-programs/undergrad-music-technology.html"
                ),
                name_hint="Learn more about the major",
                catalogue_source="https://www.cmu.edu/academics/",
                score=7,
            ),
        )
        self.assertEqual(
            programme.programme_name,
            "Undergrad Music Technology",
        )
        self.assertEqual(programme.degree_level, "bachelor")
        self.assertIsNone(programme.credential)
        self.assertTrue(programme_is_selection_eligible(programme))

    def test_programme_name_removes_link_ui_noise_and_mojibake(
        self,
    ) -> None:
        programme = candidate_to_programme(
            "columbia-us",
            ProgrammeCandidate(
                url=(
                    "https://sps.columbia.edu/academics/masters/"
                    "biodiversity-data-analytics"
                ),
                name_hint=(
                    "Biodiversity Data Analytics "
                    "(opens in a new window)"
                ),
                catalogue_source=(
                    "https://sps.columbia.edu/academics/masters"
                ),
                score=7,
            ),
        )
        self.assertEqual(
            programme.programme_name,
            "Biodiversity Data Analytics",
        )
        mojibake = candidate_to_programme(
            "columbia-us",
            ProgrammeCandidate(
                url=(
                    "https://bulletin.columbia.edu/columbia-college/"
                    "departments-instruction/mathematics"
                ),
                name_hint=(
                    "Computer Science "
                    "\u00e2\u20ac\u201d Mathematics"
                ),
                catalogue_source="https://bulletin.columbia.edu/",
                score=7,
            ),
        )
        self.assertEqual(
            mojibake.programme_name,
            "Computer Science \u2014 Mathematics",
        )
        self.assertEqual(
            candidate_to_programme(
                "example",
                ProgrammeCandidate(
                    "https://example.edu/masters-studies",
                    "Master\ufffds Studies",
                    "catalogue",
                    7,
                ),
            ).programme_name,
            "Master's Studies",
        )

    def test_generic_programme_name_is_refined_from_page_title(
        self,
    ) -> None:
        programme = candidate_to_programme(
            "duke-us",
            ProgrammeCandidate(
                url=(
                    "https://sanford.duke.edu/academics/"
                    "undergraduate-program/"
                ),
                name_hint="Learn about our bachelor's program",
                catalogue_source="https://www.duke.edu/academics/",
                score=7,
            ),
        )
        self.assertEqual(
            programme.programme_name,
            "Undergraduate Program",
        )
        self.assertTrue(programme_is_selection_eligible(programme))
        refined = refine_programme_name_from_title(
            programme,
            "Undergraduate Program | Sanford School of Public Policy",
        )
        self.assertEqual(
            refined.programme_name,
            "Public Policy Undergraduate Program",
        )

    def test_phd_is_only_added_when_optional_phd_is_enabled(self) -> None:
        programmes = [
            candidate_to_programme(
                "example",
                ProgrammeCandidate(
                    f"https://example.edu/programmes/{slug}",
                    name,
                    "catalogue",
                    7,
                ),
            )
            for slug, name in (
                ("alpha-bsc", "Alpha BSc"),
                ("beta-msc", "Beta MSc"),
                ("gamma-phd", "Gamma PhD"),
            )
        ]
        selected = choose_deep_programmes(
            programmes,
            include_optional_phd=False,
            max_regular=5,
        )
        self.assertEqual(
            [programme.degree_level for programme in selected],
            ["bachelor", "master"],
        )

    def test_undergraduate_url_beats_ambiguous_ms_option_code(self) -> None:
        self.assertEqual(
            infer_degree(
                "Computer Science",
                "https://catalog.yale.edu/ycps/subjects-of-instruction/"
                "computer-science/",
            ),
            "bachelor",
        )
        programme = candidate_to_programme(
            "caltech-us",
            ProgrammeCandidate(
                url=(
                    "https://catalog.caltech.edu/current/information-for-"
                    "undergraduate-students/graduation-requirements-all-"
                    "options/materials-science-option-ms/"
                ),
                name_hint="Materials Science Option (MS)",
                catalogue_source="https://catalog.caltech.edu/",
                score=7,
            ),
        )
        self.assertEqual(programme.degree_level, "bachelor")
        self.assertIsNone(programme.credential)

    def test_mit_course_number_and_specialist_masters_are_inferred(self) -> None:
        self.assertEqual(
            infer_degree("Nursing - Post-BS to DNP", ""),
            "phd",
        )
        self.assertEqual(
            infer_credential("Nursing - Post-BS to DNP", "", "phd"),
            "DNP",
        )
        self.assertEqual(
            infer_degree(
                "Electrical Engineering with Computing (Course 6-5)",
                "https://catalog.mit.edu/degree-charts/"
                "electrical-engineering-computing-6-5/",
            ),
            "bachelor",
        )
        self.assertEqual(
            infer_degree(
                "Theater Arts (Course 21M-2)",
                "https://catalog.mit.edu/degree-charts/"
                "theater-arts-course-21m-2/",
            ),
            "bachelor",
        )
        self.assertEqual(
            infer_degree(
                "Architecture (MArch)",
                "https://catalog.mit.edu/degree-charts/master-architecture/",
            ),
            "master",
        )
        self.assertEqual(
            infer_credential("Architecture (MArch)", ""),
            "MArch",
        )

    def test_deep_selection_prefers_bachelor_master_then_phd(self) -> None:
        candidates = [
            ProgrammeCandidate(
                "https://example.edu/programmes/alpha-bsc",
                "Alpha BSc",
                "fixture",
                7,
            ),
            ProgrammeCandidate(
                "https://example.edu/programmes/beta-msc",
                "Beta MSc",
                "fixture",
                7,
            ),
            ProgrammeCandidate(
                "https://example.edu/programmes/gamma-phd",
                "Gamma PhD",
                "fixture",
                7,
            ),
        ]
        programmes = [
            candidate_to_programme("example", candidate)
            for candidate in candidates
        ]
        selected = choose_deep_programmes(
            programmes, include_optional_phd=True, max_regular=2
        )
        self.assertEqual(
            [programme.degree_level for programme in selected],
            ["bachelor", "master", "phd"],
        )
        self.assertEqual(
            [programme.selection_rank for programme in selected],
            [1, 2, 3],
        )
        self.assertTrue(
            all(
                programme.selection_basis == "official_catalogue_coverage"
                for programme in selected
            )
        )

    def test_user_supplied_programme_is_deep_priority(self) -> None:
        regular = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/alpha-bsc",
                "Alpha BSc",
                "catalogue",
                7,
            ),
        )
        manual = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/special-certificate",
                None,
                "user_supplied",
                100,
            ),
        )
        selected = choose_deep_programmes(
            [regular, manual], include_optional_phd=False, max_regular=1
        )
        self.assertEqual(selected[0].official_url, manual.official_url)

    def test_ipeds_cip_priorities_select_matching_degree_programme(
        self,
    ) -> None:
        biology = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/biology-bsc",
                "Biology BSc",
                "catalogue",
                7,
            ),
        )
        computer_science = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/computer-science-bsc",
                "Computer Science BSc",
                "catalogue",
                7,
            ),
        )
        priorities = (
            ProgrammePriority(
                source="IPEDS:C2024_A:2023-24",
                rank=1,
                label="Computer and Information Sciences, General",
                taxonomy_code="11.0101",
                completions_total=300,
                degree_completions=(("bachelor", 250), ("master", 50)),
            ),
        )
        enriched = apply_programme_priorities(
            [biology, computer_science],
            priorities,
        )
        selected = choose_deep_programmes(
            enriched,
            include_optional_phd=False,
            max_regular=1,
        )
        self.assertEqual(
            selected[0].programme_name,
            "Computer Science BSc",
        )
        self.assertEqual(
            selected[0].selection_basis,
            "ipeds_completions_priority",
        )
        self.assertEqual(selected[0].priority_taxonomy_code, "11.0101")
        self.assertEqual(selected[0].priority_degree_completions, 250)
        self.assertGreaterEqual(selected[0].priority_match_score or 0, 0.6)
        self.assertEqual(
            programme_priority_match_score(
                "Mechanical Engineering BSc",
                "Engineering, General",
            ),
            0.0,
        )
        self.assertEqual(
            programme_priority_match_score(
                "Applied Economics BA",
                "Economics",
            ),
            0.9,
        )

    def test_english_subject_name_is_not_a_language_signal(self) -> None:
        english = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/english-ba",
                "English BA",
                "catalogue",
                7,
            ),
        )
        computer_science = replace(
            candidate_to_programme(
                "example",
                ProgrammeCandidate(
                    "https://example.edu/programmes/computer-science-bs",
                    "Computer Science BS",
                    "catalogue",
                    7,
                ),
            ),
            priority_source="IPEDS",
            priority_rank=1,
            priority_degree_completions=100,
        )
        selected = choose_deep_programmes(
            [english, computer_science],
            include_optional_phd=False,
            max_regular=1,
        )
        self.assertEqual(
            selected[0].programme_name,
            "Computer Science BS",
        )

    def test_selection_deduplicates_equivalent_programme_names(self) -> None:
        duplicates = [
            candidate_to_programme(
                "example",
                ProgrammeCandidate(
                    url,
                    name,
                    "catalogue",
                    7,
                ),
            )
            for url, name in (
                (
                    "http://catalog.example.edu/majors-programs/"
                    "computer-science",
                    "Computer Science",
                ),
                (
                    "https://catalog.example.edu/majors-programs/"
                    "computer-science",
                    "Computer Science",
                ),
                (
                    "https://catalog.example.edu/majors-programs/"
                    "computer-science-mathematics",
                    "Computer Science — Mathematics",
                ),
                (
                    "https://catalog.example.edu/majors-programs/"
                    "computer-science-and-mathematics",
                    "Computer Science-Mathematics",
                ),
            )
        ]
        selected = choose_deep_programmes(
            duplicates,
            include_optional_phd=False,
            max_regular=5,
        )
        self.assertEqual(len(selected), 2)
        self.assertTrue(
            all(
                programme.official_url.startswith("https://")
                for programme in selected
            )
        )

    def test_same_name_with_different_credentials_is_not_deduplicated(
        self,
    ) -> None:
        programmes = [
            candidate_to_programme(
                "example",
                ProgrammeCandidate(
                    url,
                    "Biomedical Engineering",
                    "catalogue",
                    7,
                ),
            )
            for url in (
                "https://example.edu/programmes/biomedical-meng",
                "https://example.edu/programmes/biomedical-msc",
            )
        ]
        selected = choose_deep_programmes(
            programmes,
            include_optional_phd=False,
            max_regular=5,
        )
        self.assertEqual(
            {programme.credential for programme in selected},
            {"MEng", "MSc"},
        )


class ValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.url = "https://example.edu/programmes/data-science"
        self.source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="MSc Data Science",
            text=(FIXTURES / "programme.html").read_text(encoding="utf-8"),
            content_hash="fixture",
        )

    def _fact(self, **overrides):
        fact = {
            "field_name": "international_deadline",
            "value": "2027-01-15",
            "source_url": self.url,
            "source_type": "programme_admission",
            "evidence": "The international application deadline is 2027-01-15.",
            "scope": "programme",
            "audience": "international",
            "academic_cycle": "2027",
            "confidence": 0.95,
        }
        fact.update(overrides)
        return fact

    def test_deterministic_identity_accepts_bme_but_not_math_page(
        self,
    ) -> None:
        bme = ExtractionSource(
            url="https://bme.duke.edu/masters/ms-bme",
            page_type="unknown",
            title="Master of Science in BME | Duke Biomedical Engineering",
            text="Master of Science in Biomedical Engineering.",
            content_hash="bme",
        )
        mathematics = ExtractionSource(
            url=(
                "https://bulletin.columbia.edu/columbia-college/"
                "departments-instruction/mathematics/"
            ),
            page_type="programme_overview",
            title="Mathematics",
            text="Mathematics department.",
            content_hash="math",
        )
        self.assertTrue(
            programme_identity_supported("Biomedical Engineering", bme)
        )
        self.assertFalse(
            programme_identity_supported(
                "Computer Science - Mathematics",
                mathematics,
            )
        )

    def test_supported_high_risk_fact_requires_review(self) -> None:
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(),
            source_map={self.url: self.source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.NEEDS_REVIEW
        )
        self.assertEqual(assertion.validation_errors, [])

    def test_zero_tuition_is_rejected_even_when_evidence_contains_numbers(
        self,
    ) -> None:
        evidence = (
            "CMU provided $75.7 million in undergraduate financial aid."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Costs and aid",
            text=evidence,
            content_hash="zero-tuition",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "Undergraduate",
                    "amount": 0,
                    "currency": "USD",
                    "fee_period": "year",
                    "audience": "domestic",
                    "academic_cycle": "2026-2027",
                },
                source_type="tuition",
                evidence=evidence,
                academic_cycle="2026-2027",
                audience="domestic",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_degree="bachelor",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "TUITION_AMOUNT_NOT_POSITIVE",
            assertion.validation_errors,
        )

    def test_deadline_value_must_be_present_in_direct_evidence(self) -> None:
        evidence = "Apply Submit your application for the College of Engineering."
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="Mechanical Engineering",
            text=evidence,
            content_hash="unsupported-deadline",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="priority_deadline",
                value="Early Decision: November 1; Regular Decision: January 3",
                evidence=evidence,
                academic_cycle="2027",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "DEADLINE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_deadline_year_must_match_direct_evidence(self) -> None:
        evidence = "The final deadline is January 15, 2026."
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="Deadlines",
            text=evidence,
            content_hash="wrong-deadline-year",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="final_deadline",
                value="2027-01-15",
                evidence=evidence,
                academic_cycle="2027",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "DEADLINE_VALUE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_old_archived_scholarship_source_is_rejected(self) -> None:
        archive_url = (
            "https://example.edu/archive/2022-23/"
            "financial-aid/how-to-apply/"
        )
        evidence = (
            "For 2022-2023, applicants may apply for institutional grants."
        )
        source = ExtractionSource(
            url=archive_url,
            page_type="scholarship",
            title="Financial aid archive",
            text=evidence,
            content_hash="old-scholarship",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="scholarships",
                value={
                    "funding_type": "institutional_need_based_grant",
                    "details": evidence,
                },
                source_url=archive_url,
                source_type="scholarship",
                evidence=evidence,
                academic_cycle="2022-2023",
            ),
            source_map={archive_url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "STALE_ARCHIVED_SOURCE",
            assertion.validation_errors,
        )

    def test_phd_funding_evidence_cannot_apply_to_master(self) -> None:
        evidence = (
            "Doctoral students receive a financial support package through "
            "the sixth year."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="scholarship",
            title="Graduate financial support",
            text=evidence,
            content_hash="phd-funding",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="scholarships",
                value={
                    "funding_type": "assistantship",
                    "details": evidence,
                },
                source_type="scholarship",
                evidence=evidence,
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_degree="master",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "DEGREE_SCOPE_MISMATCH",
            assertion.validation_errors,
        )

    def test_current_student_cash_award_is_not_admission_funding(self) -> None:
        evidence = (
            "The Computer Science Scholarship Award is a cash prize awarded "
            "annually to current BA and BS degree candidates."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="scholarship",
            title="Student awards",
            text=evidence,
            content_hash="student-award",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="scholarships",
                value={
                    "funding_type": "merit_scholarship",
                    "award_name": "Computer Science Scholarship Award",
                    "details": evidence,
                },
                source_type="scholarship",
                evidence=evidence,
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_degree="bachelor",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "ENROLLED_STUDENT_AWARD_NOT_ADMISSION_FUNDING",
            assertion.validation_errors,
        )

    def test_assertion_text_is_normalized_before_storage(self) -> None:
        broken = "Students\u00e2\u20ac\u2122 outcomes \u00e2\u20ac\u201d current"
        source = ExtractionSource(
            url=self.url,
            page_type="career_outcome",
            title="Outcomes",
            text=broken,
            content_hash="mojibake-assertion",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="career_outcomes",
                value={"description": broken},
                source_type="career_outcome",
                evidence=broken,
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.value_json["description"],
            "Students\u2019 outcomes \u2014 current",
        )
        self.assertEqual(
            assertion.evidence,
            "Students\u2019 outcomes \u2014 current",
        )

    def test_semantically_empty_structured_value_is_rejected(self) -> None:
        evidence = "Computer Science and Engineering (Course 6-3)"
        source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="Computer Science and Engineering",
            text=evidence,
            content_hash="semantic-empty",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="toefl",
                value={
                    "overall_score": None,
                    "reading": None,
                    "listening": None,
                    "speaking": None,
                    "writing": None,
                },
                evidence=evidence,
                scope="programme",
                audience="all",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertFalse(has_semantic_value(assertion.value_json))
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "SEMANTICALLY_EMPTY_VALUE",
            assertion.validation_errors,
        )

    def test_placeholder_value_is_normalized_and_rejected(self) -> None:
        evidence = "The minimum score is TBD."
        source = ExtractionSource(
            url=self.url,
            page_type="english_requirement",
            title="English requirements",
            text=evidence,
            content_hash="placeholder",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="toefl",
                value="TBD",
                evidence=evidence,
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertIsNone(assertion.value_json)
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "SEMANTICALLY_EMPTY_VALUE",
            assertion.validation_errors,
        )

    def test_academic_cycle_requires_year_in_direct_evidence(self) -> None:
        evidence = "Standard Application Deadline - November 1"
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="First-year admissions",
            text=evidence,
            content_hash="cycle-without-year",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="academic_cycle",
                value="2026-2027",
                evidence=evidence,
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "ACADEMIC_CYCLE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_restricted_fee_cannot_apply_to_all_students(self) -> None:
        evidence = "Visiting Summer Intern (VSI) Fee $1,040"
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Tuition and fees",
            text=evidence,
            content_hash="restricted-fee",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="additional_fees",
                value={
                    "fee_name": "Visiting Summer Intern (VSI) Fee",
                    "amount": 1040,
                    "currency": "USD",
                    "audience": "all",
                },
                evidence=evidence,
                academic_cycle="2026-2027",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "ADDITIONAL_FEE_APPLICABILITY_UNPROVEN",
            assertion.validation_errors,
        )

    def test_different_programme_overview_is_rejected(self) -> None:
        wrong_url = "https://example.edu/programmes/mba"
        evidence = "The MBA develops general management leaders."
        source = ExtractionSource(
            url=wrong_url,
            page_type="programme_overview",
            title="MBA Programme",
            text=evidence,
            content_hash="wrong-programme",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="programme_focus",
                value="General management",
                source_url=wrong_url,
                source_type="programme_overview",
                evidence=evidence,
                academic_cycle=None,
            ),
            source_map={wrong_url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_name="Data Science",
            programme_url=self.url,
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "SOURCE_PROGRAMME_MISMATCH",
            assertion.validation_errors,
        )

    def test_evidence_not_in_source_is_rejected(self) -> None:
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(evidence="Deadline is tomorrow."),
            source_map={self.url: self.source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )
        self.assertIn(
            "EVIDENCE_NOT_FOUND_IN_SOURCE", assertion.validation_errors
        )

    def test_absence_does_not_prove_admission_document_not_required(
        self,
    ) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text="We require letters of recommendation from two teachers.",
            content_hash="fixture-no-sop",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="sop_essay_requirements",
                value={
                    "document_type": "statement_of_purpose",
                    "requirement_status": "not_required",
                    "required_count": None,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "components": [],
                    "details": "No SOP was mentioned.",
                },
                evidence="We require letters of recommendation from two teachers.",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )
        self.assertIn(
            "EXPLICIT_NOT_REQUIRED_EVIDENCE_MISSING",
            assertion.validation_errors,
        )

    def test_explicit_graduation_document_negation_is_preserved(
        self,
    ) -> None:
        evidence = (
            "We do not formally require you to have graduated or earned a GED."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text=evidence,
            content_hash="fixture-explicit-not-required",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="graduation_certificate",
                value={
                    "requirement_status": "not_required",
                    "required_count": None,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "details": evidence,
                },
                evidence=evidence,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )
        self.assertIn(
            "DOCUMENT_TYPE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_transcript_evidence_cannot_prove_graduation_certificate(
        self,
    ) -> None:
        evidence = (
            "We require an official transcript sent by a school counselor."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text=evidence,
            content_hash="fixture-transcript-not-certificate",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="graduation_certificate",
                value={
                    "requirement_status": "required",
                    "required_count": None,
                    "application_stage": "unknown",
                    "accepted_alternatives": [],
                    "details": evidence,
                },
                evidence=evidence,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )
        self.assertIn(
            "DOCUMENT_TYPE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_evidence_allows_equivalent_unicode_punctuation(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text="Applications open January 1 – deadline January 15.",
            content_hash="fixture-punctuation",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                evidence="Applications open January 1 - deadline January 15."
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertNotEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )

    def test_impossible_iso_date_is_rejected(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text="The final deadline is 2027-02-30.",
            content_hash="fixture-2",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="final_deadline",
                value="2027-02-30",
                evidence="The final deadline is 2027-02-30.",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertIn("INVALID_DATE", assertion.validation_errors)

    def test_minimum_degree_is_not_applicable_to_bachelor(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title=None,
            text="Applicants need a secondary school diploma.",
            content_hash="fixture-bachelor",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="minimum_degree",
                value="secondary school diploma",
                evidence="Applicants need a secondary school diploma.",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-pro",
            extractor_version="test",
            programme_degree="bachelor",
        )
        self.assertEqual(
            assertion.verification_status, VerificationStatus.REJECTED
        )
        self.assertIn("FIELD_NOT_APPLICABLE", assertion.validation_errors)

    def test_programme_career_path_is_extracted_deterministically(
        self,
    ) -> None:
        evidence = (
            "The program prepares students for careers in government, "
            "law, and the corporate sector and for graduate study."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="Computer Science BS",
            text=f"Program overview. {evidence}",
            content_hash="fixture-career-path",
        )
        fact = next(
            fact
            for fact in extract_deterministic_facts([source])
            if fact["field_name"] == "career_outcomes"
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=fact,
            source_map={self.url: source},
            model_name="deterministic",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.RULE_VALIDATED,
        )
        self.assertEqual(assertion.evidence, evidence)

    def test_source_excerpt_fallback_preserves_official_quote_safely(
        self,
    ) -> None:
        source = ExtractionSource(
            url="https://example.edu/programmes/data-science/admissions",
            page_type="programme_admission",
            title="Application requirements",
            text=(
                "Applicants must submit two letters of recommendation from "
                "people familiar with their academic work. For the 2026-27 "
                "academic year, tuition for the MS programme is USD 42,000."
            ),
            content_hash="fixture-source-excerpt",
        )
        assertions = extract_source_excerpt_assertions(
            entity_id="programme-1",
            sources=[source],
            field_names=("recommendation_letters", "tuition"),
            extractor_version="test",
        )
        self.assertEqual(
            {assertion.field_name for assertion in assertions},
            {"recommendation_letters", "tuition"},
        )
        for assertion in assertions:
            self.assertEqual(
                assertion.verification_status,
                VerificationStatus.NEEDS_REVIEW,
            )
            self.assertEqual(
                assertion.validation_errors,
                ["SOURCE_EXCERPT_ONLY"],
            )
            self.assertEqual(assertion.value_json, assertion.evidence)
            self.assertTrue(assertion.source_url.startswith("https://"))

    def test_source_excerpt_fallback_ignores_navigation_only_mentions(
        self,
    ) -> None:
        source = ExtractionSource(
            url="https://example.edu/programmes/data-science",
            page_type="programme_overview",
            title="Data Science",
            text="IELTS links are available in the navigation.",
            content_hash="fixture-navigation-only",
        )
        self.assertEqual(
            extract_source_excerpt_assertions(
                entity_id="programme-1",
                sources=[source],
                field_names=(
                    "ielts_overall",
                    "final_deadline",
                    "required_documents",
                ),
                extractor_version="test",
            ),
            [],
        )

    def test_source_excerpt_fallback_rejects_deadline_without_date(
        self,
    ) -> None:
        source = ExtractionSource(
            url="https://example.edu/testing",
            page_type="programme_admission",
            title="Testing",
            text=(
                "Scores completed after the application deadline may arrive "
                "in time to be reviewed. The applicant portal includes an "
                "application checklist and a contact update form. InitialView "
                "interviews are optional materials that candidates may submit "
                "with their application materials."
            ),
            content_hash="fixture-nonsubstantive-deadline",
        )
        self.assertEqual(
            extract_source_excerpt_assertions(
                entity_id="programme-1",
                sources=[source],
                field_names=("final_deadline", "required_documents"),
                extractor_version="test",
            ),
            [],
        )

    def test_source_excerpt_fallback_does_not_treat_aid_documents_as_admission(
        self,
    ) -> None:
        source = ExtractionSource(
            url="https://example.edu/applying-for-aid/required-documents",
            page_type="programme_admission",
            title="Applying for Financial Aid",
            text=(
                "Applicants must submit required documents and tax records "
                "to complete the financial aid application."
            ),
            content_hash="fixture-financial-aid-documents",
        )
        self.assertEqual(
            extract_source_excerpt_assertions(
                entity_id="programme-1",
                sources=[source],
                field_names=("required_documents", "academic_transcript"),
                extractor_version="test",
            ),
            [],
        )

    def test_source_excerpt_safety_rejects_known_cross_scope_false_positives(
        self,
    ) -> None:
        unsafe = [
            {
                "field_name": "final_deadline",
                "evidence": "The application deadline is September 11, 2026.",
                "source_url": (
                    "https://precollege.example.edu/admissions/deadlines"
                ),
                "programme_degree": "bachelor",
            },
            {
                "field_name": "academic_transcript",
                "evidence": (
                    "Official high school transcripts are required."
                ),
                "source_url": "https://example.edu/admissions",
                "programme_degree": "master",
            },
            {
                "field_name": "career_outcomes",
                "evidence": (
                    "Graduate students complete advanced graduate work."
                ),
                "source_url": "https://example.edu/catalogue",
                "programme_degree": "master",
            },
            {
                "field_name": "scholarships",
                "evidence": (
                    "Apply Visit Degree Programs Financial Aid Graduate "
                    "Admissions."
                ),
                "source_url": "https://example.edu/admissions-aid",
                "programme_degree": "master",
            },
            {
                "field_name": "scholarships",
                "evidence": (
                    "The department offers interdisciplinary scholarship "
                    "and research opportunities."
                ),
                "source_url": "https://example.edu/graduate-programmes",
                "programme_degree": "master",
            },
            {
                "field_name": "scholarships",
                "evidence": (
                    "Applicants may use personal savings or outside "
                    "scholarships to demonstrate financial support."
                ),
                "source_url": "https://example.edu/admissions",
                "programme_degree": "master",
            },
            {
                "field_name": "admission_difficulty",
                "evidence": (
                    "Transfer admission is highly selective at 5 percent."
                ),
                "source_url": "https://example.edu/apply",
                "programme_degree": "bachelor",
            },
        ]
        for case in unsafe:
            with self.subTest(field_name=case["field_name"]):
                self.assertFalse(source_excerpt_is_safe(**case))

        self.assertTrue(
            source_excerpt_is_safe(
                field_name="final_deadline",
                evidence=(
                    "Completed applications are due by December 15, 2026."
                ),
                source_url="https://example.edu/graduate-admissions",
                programme_degree="master",
            )
        )

    def test_additional_fee_that_duplicates_tuition_is_rejected(
        self,
    ) -> None:
        evidence = "Full-time enrollment $22,577 per quarter."
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Undergraduate tuition",
            text=evidence,
            content_hash="fixture-duplicate-fee",
        )
        value = {
            "credential": "Full-time enrollment",
            "amount": 22577,
            "currency": "USD",
            "fee_period": "quarter",
            "audience": "all",
            "academic_cycle": "2026-2027",
        }
        tuition = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value=value,
                evidence=evidence,
                academic_cycle="2026-2027",
                source_type="tuition",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        additional_fee = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="additional_fees",
                value=value,
                evidence=evidence,
                academic_cycle="2026-2027",
                source_type="tuition",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        tuition, additional_fee = validate_assertion_set(
            [tuition, additional_fee]
        )
        self.assertNotEqual(
            tuition.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertEqual(
            additional_fee.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "DUPLICATES_TUITION",
            additional_fee.validation_errors,
        )

    def test_equivalent_assertions_keep_structured_value(self) -> None:
        evidence = (
            "The program prepares students for careers in government."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="Careers",
            text=evidence,
            content_hash="fixture-equivalent",
        )
        assertions = [
            fact_to_assertion(
                entity_id="programme-1",
                fact=self._fact(
                    field_name="career_outcomes",
                    value=evidence,
                    evidence=evidence,
                ),
                source_map={self.url: source},
                model_name="deepseek-v4-flash",
                extractor_version="test",
            ),
            fact_to_assertion(
                entity_id="programme-1",
                fact=self._fact(
                    field_name="career_outcomes",
                    value={"description": evidence},
                    evidence=evidence,
                ),
                source_map={self.url: source},
                model_name="deterministic",
                extractor_version="test",
            ),
        ]
        deduped = dedupe_equivalent_assertions(assertions)
        self.assertEqual(len(deduped), 1)
        self.assertEqual(
            deduped[0].value_json,
            {"description": evidence},
        )

    def test_statement_of_objectives_is_valid_sop_alias(self) -> None:
        evidence = (
            "Statement of Objectives should be limited to approximately "
            "one page."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="Application materials",
            text=evidence,
            content_hash="fixture-statement-objectives",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="sop_essay_requirements",
                value={
                    "requirement_status": "required",
                    "required_count": None,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "details": "Statement of Objectives, about one page.",
                },
                evidence=evidence,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertNotEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertNotIn(
            "DOCUMENT_TYPE_NOT_IN_EVIDENCE",
            assertion.validation_errors,
        )

    def test_suspended_programme_rejects_same_cycle_deadline(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="MSc Applied Paediatrics",
            text=(
                "This course is suspended for 2026 entry. "
                "The final deadline is 2026-06-30."
            ),
            content_hash="fixture-suspended",
        )
        facts = extract_deterministic_facts([source])
        self.assertEqual(facts[0]["value"], "suspended")
        self.assertEqual(facts[0]["academic_cycle"], "2026")
        status_assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=facts[0],
            source_map={self.url: source},
            model_name="deterministic",
            extractor_version="test",
        )
        deadline_assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="final_deadline",
                value="2026-06-30",
                evidence="The final deadline is 2026-06-30.",
                academic_cycle="2026",
                source_type="programme_overview",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        status_assertion, deadline_assertion = validate_assertion_set(
            [status_assertion, deadline_assertion]
        )
        self.assertEqual(
            status_assertion.verification_status,
            VerificationStatus.RULE_VALIDATED,
        )
        self.assertEqual(
            deadline_assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "INACTIVE_PROGRAMME_CONFLICT",
            deadline_assertion.validation_errors,
        )

    def test_paused_status_is_canonical_and_blocks_overlapping_cycle(
        self,
    ) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="MBA",
            text=(
                "Admissions have been paused for the 2025-2026 academic year. "
                "The Fall 2026 final deadline is May 13, 2026."
            ),
            content_hash="fixture-paused",
        )
        status_fact = extract_deterministic_facts([source])[0]
        self.assertEqual(status_fact["value"], "paused")
        self.assertEqual(status_fact["academic_cycle"], "2025-2026")
        status_assertion = fact_to_assertion(
            entity_id="programme-paused",
            fact=status_fact,
            source_map={self.url: source},
            model_name="deterministic",
            extractor_version="test",
        )
        deadline_assertion = fact_to_assertion(
            entity_id="programme-paused",
            fact=self._fact(
                field_name="final_deadline",
                value="2026-05-13",
                evidence="The Fall 2026 final deadline is May 13, 2026.",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        status_assertion, deadline_assertion = validate_assertion_set(
            [status_assertion, deadline_assertion]
        )
        self.assertEqual(
            normalize_programme_status("Paused for 2025-2026"),
            "paused",
        )
        self.assertEqual(deadline_assertion.academic_cycle, "2026")
        self.assertEqual(
            deadline_assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "INACTIVE_PROGRAMME_CONFLICT",
            deadline_assertion.validation_errors,
        )

    def test_status_detection_handles_common_adverb_and_program_wording(
        self,
    ) -> None:
        closed_source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="MSc",
            text="Applications are now closed for 2026 entry.",
            content_hash="fixture-closed-now",
        )
        paused_source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="MBA",
            text=(
                "Admissions to the program are paused for the 2025-26 "
                "academic year."
            ),
            content_hash="fixture-paused-program",
        )
        self.assertEqual(
            extract_deterministic_facts([closed_source])[0]["value"],
            "closed",
        )
        paused = extract_deterministic_facts([paused_source])[0]
        self.assertEqual(paused["value"], "paused")
        self.assertEqual(paused["academic_cycle"], "2025-26")

    def test_programme_status_requires_explicit_matching_variant(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="Extended Full-Time MBA",
            text=(
                "Undertake advanced study. Admissions for the Morning MBA "
                "have been paused for the 2025-2026 academic year."
            ),
            content_hash="fixture-status-applicability",
        )
        inferred_active = fact_to_assertion(
            entity_id="programme-status",
            fact=self._fact(
                field_name="programme_status",
                value="active",
                evidence="Undertake advanced study.",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_name="Business Administration Extended Full-Time MBA",
        )
        wrong_variant = fact_to_assertion(
            entity_id="programme-status",
            fact=self._fact(
                field_name="programme_status",
                value="paused for 2025-2026",
                evidence=(
                    "Admissions for the Morning MBA have been paused for the "
                    "2025-2026 academic year."
                ),
                academic_cycle="2025-2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_name="Business Administration Extended Full-Time MBA",
        )
        self.assertIn(
            "PROGRAMME_STATUS_NOT_EXPLICIT",
            inferred_active.validation_errors,
        )
        self.assertIn(
            "PROGRAMME_STATUS_APPLICABILITY_MISMATCH",
            wrong_variant.validation_errors,
        )
        self.assertEqual(
            inferred_active.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertEqual(
            wrong_variant.verification_status,
            VerificationStatus.REJECTED,
        )

    def test_deadline_cycle_is_recovered_from_explicit_context(self) -> None:
        evidence = (
            "Application deadlines for Fall 2026 are Round 1 "
            "September 10, 2025 and Round 2 November 19, 2025."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="deadline",
            title="Deadlines",
            text=evidence,
            content_hash="fixture-deadline-cycle",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="final_deadline",
                value=[
                    {"round": "Round 1", "date": "2025-09-10"},
                    {"round": "Round 2", "date": "2025-11-19"},
                ],
                evidence=evidence,
                academic_cycle=None,
                source_type="deadline",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        assertion = validate_assertion_set([assertion])[0]
        self.assertEqual(assertion.academic_cycle, "2026")
        self.assertNotIn(
            "MISSING_ACADEMIC_CYCLE", assertion.validation_errors
        )

    def test_ellipsis_evidence_is_reanchored_to_one_source_span(self) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="scholarship",
            title="Scholarships",
            text=(
                "Kenneth Au-Yeung Memorial Scholarship is awarded to a "
                "Computer Engineering student based on financial need."
            ),
            content_hash="fixture-ellipsis",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="scholarships",
                value="Kenneth Au-Yeung Memorial Scholarship",
                evidence=(
                    "Kenneth Au-Yeung Memorial Scholarship ... awarded to a "
                    "Computer Engineering student"
                ),
                source_type="scholarship",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertNotIn("...", assertion.evidence)
        self.assertEqual(assertion.validation_errors, [])
        self.assertEqual(
            assertion.value_json["funding_type"],
            "unknown",
        )

    def test_financial_need_policy_is_not_mislabeled_as_scholarship(
        self,
    ) -> None:
        evidence = "MIT meets the full financial need of every undergraduate."
        source = ExtractionSource(
            url=self.url,
            page_type="scholarship",
            title="Financial aid",
            text=evidence,
            content_hash="fixture-financial-aid-policy",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="scholarships",
                value=evidence,
                evidence=evidence,
                source_type="scholarship",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.value_json["funding_type"],
            "financial_aid_policy",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )

    def test_tuition_older_than_application_cycle_is_rejected(self) -> None:
        application_url = f"{self.url}/apply"
        tuition_url = f"{self.url}/tuition"
        application_source = ExtractionSource(
            url=application_url,
            page_type="programme_admission",
            title="Apply",
            text="For the 2026-2027 application.",
            content_hash="fixture-application-cycle",
        )
        tuition_source = ExtractionSource(
            url=tuition_url,
            page_type="tuition",
            title="Tuition",
            text=(
                "Undergraduate tuition for 2025-2026. "
                "Full regular tuition $32,155 USD per term."
            ),
            content_hash="fixture-old-tuition",
        )
        cycle = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="academic_cycle",
                value="2026-2027",
                source_url=application_url,
                evidence="For the 2026-2027 application.",
                academic_cycle="2026-2027",
            ),
            source_map={
                application_url: application_source,
                tuition_url: tuition_source,
            },
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        tuition = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "Full regular tuition",
                    "amount": 32155,
                    "currency": "USD",
                    "fee_period": "term",
                    "audience": "all",
                    "academic_cycle": "2025-2026",
                },
                source_url=tuition_url,
                source_type="tuition",
                evidence="Full regular tuition $32,155 USD per term.",
                academic_cycle="2025-2026",
                audience="all",
            ),
            source_map={
                application_url: application_source,
                tuition_url: tuition_source,
            },
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        validated = validate_assertion_set([cycle, tuition])
        validated_tuition = next(
            item for item in validated if item.field_name == "tuition"
        )
        self.assertEqual(
            validated_tuition.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "OUTDATED_TUITION_CYCLE",
            validated_tuition.validation_errors,
        )

    def test_combined_tuition_array_is_rejected(self) -> None:
        evidence = (
            "MSc £16,300 total fee PG Dip £13,040 total fee "
            "PG Cert £8,150 total fee"
        )
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Fees",
            text=evidence,
            content_hash="fixture-tuition",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value=[
                    {
                        "credential": "MSc",
                        "amount": 16300,
                        "currency": "GBP",
                        "fee_period": "total",
                        "audience": "all",
                        "academic_cycle": "2026",
                    },
                    {
                        "credential": "PGDip",
                        "amount": 13040,
                        "currency": "GBP",
                        "fee_period": "total",
                        "audience": "all",
                        "academic_cycle": "2026",
                    },
                    {
                        "credential": "PGCert",
                        "amount": 8150,
                        "currency": "GBP",
                        "fee_period": "total",
                        "audience": "all",
                        "academic_cycle": "2026",
                    },
                ],
                evidence=evidence,
                source_type="tuition",
                academic_cycle="2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "TUITION_NOT_ATOMIC_OBJECT",
            assertion.validation_errors,
        )

    def test_atomic_tuition_has_value_specific_evidence(self) -> None:
        evidence = "MSc GBP 16,300 total fee"
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Fees",
            text=evidence,
            content_hash="fixture-tuition-atomic",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "MSc",
                    "amount": 16300,
                    "currency": "GBP",
                    "fee_period": "total",
                    "audience": "all",
                    "academic_cycle": "2026",
                },
                evidence=evidence,
                source_type="tuition",
                academic_cycle="2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertEqual(assertion.validation_errors, [])
        unsupported = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "MSc",
                    "amount": 26900,
                    "currency": "GBP",
                    "fee_period": "total",
                    "audience": "international",
                    "academic_cycle": "2026",
                },
                evidence=evidence,
                source_type="tuition",
                academic_cycle="2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            unsupported.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "TUITION_AMOUNT_NOT_IN_EVIDENCE",
            unsupported.validation_errors,
        )

    def test_scalar_application_fee_is_normalized_to_atomic_object(
        self,
    ) -> None:
        evidence = "$90 fee (or request a fee waiver)"
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="Application requirements",
            text=evidence,
            content_hash="fixture-application-fee",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="application_fee",
                value=90,
                evidence=evidence,
                source_type="programme_admission",
                academic_cycle=None,
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.value_json,
            {
                "credential": "Application fee",
                "amount": 90,
                "currency": "USD",
                "fee_period": "once",
                "audience": "international",
            },
        )
        self.assertEqual(assertion.validation_errors, [])

    def test_central_undergraduate_tuition_uses_programme_applicability(
        self,
    ) -> None:
        tuition_url = "https://example.edu/financial-aid/costs"
        programme_source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="Computer Science",
            text="All undergraduate students apply to the Bachelor programme.",
            content_hash="fixture-programme-tuition-applicability",
        )
        tuition_source = ExtractionSource(
            url=tuition_url,
            page_type="tuition",
            title="Undergraduate cost of attendance",
            text="Undergraduate cost of attendance. Tuition $62,226",
            content_hash="fixture-central-tuition",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "Undergraduate",
                    "amount": 62226,
                    "currency": "USD",
                    "fee_period": "year",
                    "audience": "all",
                    "academic_cycle": "2026-2027",
                },
                source_url=tuition_url,
                source_type="tuition",
                evidence="Tuition $62,226",
                scope="institution",
                academic_cycle="2026-2027",
                applicability_source_url=self.url,
                applicability_evidence=(
                    "All undergraduate students apply to the Bachelor programme."
                ),
            ),
            source_map={
                self.url: programme_source,
                tuition_url: tuition_source,
            },
            model_name="deepseek-v4-flash",
            extractor_version="test",
            programme_degree="bachelor",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertEqual(assertion.validation_errors, [])

    def test_unstructured_tuition_is_rejected(self) -> None:
        evidence = "MSc £16,300 total fee"
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Fees",
            text=evidence,
            content_hash="fixture-tuition-string",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value="£16,300",
                evidence=evidence,
                source_type="tuition",
                academic_cycle="2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "TUITION_NOT_ATOMIC_OBJECT",
            assertion.validation_errors,
        )

    def test_tuition_evidence_is_reanchored_to_exact_source_window(
        self,
    ) -> None:
        source = ExtractionSource(
            url=self.url,
            page_type="tuition",
            title="Fees",
            text=(
                "Qualification PG Cert Duration 1 year "
                "Fees GBP 8,150 Home GBP 13,450 Overseas"
            ),
            content_hash="fixture-tuition-reanchor",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="tuition",
                value={
                    "credential": "PG Cert",
                    "amount": 8150,
                    "currency": "GBP",
                    "fee_period": "total",
                    "audience": "domestic",
                    "academic_cycle": "2026",
                },
                evidence="GBP 8,150 Home",
                source_type="tuition",
                academic_cycle="2026",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertTrue(
            assertion.evidence.startswith("Qualification PG Cert")
        )
        self.assertEqual(assertion.validation_errors, [])

    def test_standard_english_level_is_joined_deterministically(self) -> None:
        programme_source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="MSc Applied Paediatrics",
            text=(
                "For admission to this course, you must achieve the standard "
                "university requirement in the appropriate English language "
                "qualification."
            ),
            content_hash="fixture-programme-english-level",
        )
        english_url = "https://example.edu/english-language"
        english_source = ExtractionSource(
            url=english_url,
            page_type="english_requirement",
            title="English language requirements",
            text=(
                "IELTS – Academic (Test-Centre/UKVI SELT/Online) "
                "Standard Higher 6.5 overall (minimum 6.0 in all elements) "
                "7.0 overall (minimum 6.5 in all elements)"
            ),
            content_hash="fixture-english-table",
        )
        facts = extract_deterministic_facts(
            [programme_source, english_source]
        )
        language_facts = {
            fact["field_name"]: fact
            for fact in facts
            if fact["field_name"].startswith("ielts")
        }
        self.assertEqual(language_facts["ielts_overall"]["value"], 6.5)
        self.assertEqual(language_facts["ielts_subscores"]["value"], 6.0)
        self.assertEqual(
            language_facts["ielts_overall"][
                "applicability_source_url"
            ],
            self.url,
        )

    def test_institution_ielts_requires_programme_applicability_evidence(
        self,
    ) -> None:
        english_url = "https://example.edu/english-language"
        programme_source = ExtractionSource(
            url=self.url,
            page_type="programme_overview",
            title="MSc Data Science",
            text="This course requires the Higher English language level.",
            content_hash="fixture-programme-level",
        )
        english_source = ExtractionSource(
            url=english_url,
            page_type="english_requirement",
            title="English language requirements",
            text="Higher level: IELTS overall 7.0 with 6.5 in each element.",
            content_hash="fixture-english-levels",
        )
        base_fact = self._fact(
            field_name="ielts_overall",
            value=7.0,
            source_url=english_url,
            source_type="english_requirement",
            evidence="Higher level: IELTS overall 7.0",
            scope="institution",
            academic_cycle="2026",
        )
        rejected = fact_to_assertion(
            entity_id="programme-1",
            fact=base_fact,
            source_map={
                self.url: programme_source,
                english_url: english_source,
            },
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            rejected.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "PROGRAMME_APPLICABILITY_NOT_PROVEN",
            rejected.validation_errors,
        )

        supported = fact_to_assertion(
            entity_id="programme-1",
            fact={
                **base_fact,
                "applicability_source_url": self.url,
                "applicability_evidence": (
                    "This course requires the Higher English language level."
                ),
            },
            source_map={
                self.url: programme_source,
                english_url: english_source,
            },
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            supported.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertEqual(supported.validation_errors, [])

    def test_recommendation_count_must_be_explicit_in_evidence(self) -> None:
        evidence = (
            "We require letters of recommendation from two teachers. "
            "School counselor materials may include a letter when available."
        )
        source = ExtractionSource(
            url=self.url,
            page_type="programme_admission",
            title="Recommendations",
            text=evidence,
            content_hash="fixture-recommendation-count",
        )
        base_value = {
            "requirement_status": "required",
            "required_count": 3,
            "application_stage": "initial_application",
            "accepted_alternatives": [],
            "details": evidence,
        }
        rejected = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="recommendation_letters",
                value=base_value,
                evidence=evidence,
                source_type="programme_admission",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        supported = fact_to_assertion(
            entity_id="programme-1",
            fact=self._fact(
                field_name="recommendation_letters",
                value={**base_value, "required_count": 2},
                evidence=evidence,
                source_type="programme_admission",
            ),
            source_map={self.url: source},
            model_name="deepseek-v4-flash",
            extractor_version="test",
        )
        self.assertEqual(
            rejected.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertIsNone(rejected.value_json["required_count"])
        self.assertEqual(rejected.validation_errors, [])
        self.assertEqual(
            supported.verification_status,
            VerificationStatus.NEEDS_REVIEW,
        )
        self.assertEqual(supported.validation_errors, [])


class SharedAssertionInheritanceTests(unittest.TestCase):
    @staticmethod
    def _assertion(
        *,
        entity_id: str,
        scope: str = "institution",
        cycle: str | None = "2026-2027",
        amount: int = 33360,
    ) -> FieldAssertion:
        return FieldAssertion(
            assertion_id=f"assertion-{entity_id}-{scope}-{cycle}-{amount}",
            entity_type="programme",
            entity_id=entity_id,
            field_name="tuition",
            value_json={
                "credential": "Undergraduate",
                "amount": amount,
                "currency": "USD",
                "fee_period": "term",
                "audience": "all",
                "academic_cycle": cycle,
            },
            null_reason=None,
            source_url="https://example.edu/undergraduate-tuition",
            source_type="tuition",
            evidence=f"Undergraduate tuition is ${amount:,} per term.",
            evidence_locator=None,
            scope=scope,
            audience="all",
            academic_cycle=cycle,
            retrieved_at="2026-07-28T00:00:00+00:00",
            confidence=1.0,
            verification_status=VerificationStatus.NEEDS_REVIEW,
            extractor_version="inheritance-test",
            model_name="deepseek-v4-flash",
            validation_errors=[],
            extraction_group="finance",
            applicability_source_url="https://example.edu/programmes/source",
            applicability_evidence="Bachelor of Science programme",
            source_content_hash=f"content-{cycle}-{amount}",
        )

    def test_central_fact_is_inherited_only_within_same_degree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                source = with_review_fingerprint(
                    self._assertion(entity_id="programme-source"),
                    institution_id="example-us",
                    degree_level="bachelor",
                )
                events = cache_shared_assertions(
                    state=state,
                    institution_id="example-us",
                    degree_level="bachelor",
                    assertions=[source],
                    extractor_version="inheritance-test",
                )
                inherited, inheritance_events = (
                    inherited_assertions_for_programme(
                        state=state,
                        institution_id="example-us",
                        degree_level="bachelor",
                        programme_id="programme-target",
                        extractor_version="inheritance-test",
                    )
                )
                graduate, _ = inherited_assertions_for_programme(
                    state=state,
                    institution_id="example-us",
                    degree_level="master",
                    programme_id="programme-graduate",
                    extractor_version="inheritance-test",
                )
            finally:
                state.close()

        self.assertEqual(len(events), 1)
        self.assertEqual(len(inherited), 1)
        self.assertEqual(len(inheritance_events), 1)
        self.assertEqual(graduate, [])
        clone = inherited[0]
        self.assertEqual(clone.entity_id, "programme-target")
        self.assertEqual(
            clone.inherited_from_assertion_id,
            source.assertion_id,
        )
        self.assertEqual(
            clone.inherited_from_entity_id,
            "programme-source",
        )
        self.assertEqual(
            clone.review_fingerprint,
            source.review_fingerprint,
        )
        self.assertNotIn("tuition", fields_to_extract(inherited))
        self.assertIn("curriculum_overview", fields_to_extract(inherited))

    def test_programme_specific_fact_overrides_inherited_fact(self) -> None:
        inherited = with_review_fingerprint(
            self._assertion(entity_id="programme-source"),
            institution_id="example-us",
            degree_level="bachelor",
        )
        current = replace(
            self._assertion(
                entity_id="programme-target",
                scope="programme",
                amount=42000,
            ),
            source_url="https://example.edu/programmes/target/fees",
            source_content_hash="programme-specific-content",
            applicability_source_url=None,
            applicability_evidence=None,
        )
        merged = merge_current_and_inherited([current], [inherited])
        self.assertEqual(merged, [current])

    def test_fingerprint_groups_central_but_not_programme_facts(self) -> None:
        first = with_review_fingerprint(
            self._assertion(entity_id="programme-one"),
            institution_id="example-us",
            degree_level="bachelor",
        )
        second = with_review_fingerprint(
            replace(
                first,
                assertion_id="second-assertion",
                entity_id="programme-two",
                review_fingerprint=None,
            ),
            institution_id="example-us",
            degree_level="bachelor",
        )
        programme_first = with_review_fingerprint(
            replace(
                first,
                assertion_id="programme-first",
                scope="programme",
                review_fingerprint=None,
            ),
            institution_id="example-us",
            degree_level="bachelor",
        )
        programme_second = with_review_fingerprint(
            replace(
                programme_first,
                assertion_id="programme-second",
                entity_id="programme-two",
                review_fingerprint=None,
            ),
            institution_id="example-us",
            degree_level="bachelor",
        )
        self.assertEqual(
            first.review_fingerprint,
            second.review_fingerprint,
        )
        self.assertNotEqual(
            programme_first.review_fingerprint,
            programme_second.review_fingerprint,
        )

    def test_newest_volatile_cycle_is_inherited(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                older = with_review_fingerprint(
                    self._assertion(
                        entity_id="programme-source",
                        cycle="2025-2026",
                        amount=32000,
                    ),
                    institution_id="example-us",
                    degree_level="bachelor",
                )
                newer = with_review_fingerprint(
                    self._assertion(
                        entity_id="programme-source",
                        cycle="2026-2027",
                        amount=33360,
                    ),
                    institution_id="example-us",
                    degree_level="bachelor",
                )
                cache_shared_assertions(
                    state=state,
                    institution_id="example-us",
                    degree_level="bachelor",
                    assertions=[older, newer],
                    extractor_version="inheritance-test",
                )
                inherited, _ = inherited_assertions_for_programme(
                    state=state,
                    institution_id="example-us",
                    degree_level="bachelor",
                    programme_id="programme-target",
                    extractor_version="inheritance-test",
                )
            finally:
                state.close()

        self.assertEqual(len(inherited), 1)
        self.assertEqual(inherited[0].academic_cycle, "2026-2027")
        self.assertEqual(inherited[0].value_json["amount"], 33360)


class ApprovedAssertionRepositoryTests(unittest.TestCase):
    def test_loads_deduplicates_and_caches_human_verified_rows(self) -> None:
        row = {
            "assertion_id": "approved-assertion",
            "entity_type": "programme",
            "entity_id": "programme-approved",
            "field_name": "tuition",
            "value_json": {
                "credential": "Undergraduate",
                "amount": 33360,
                "currency": "USD",
                "fee_period": "term",
                "audience": "all",
                "academic_cycle": "2026-2027",
            },
            "null_reason": None,
            "source_url": "https://example.edu/tuition",
            "source_type": "tuition",
            "evidence": "Undergraduate tuition is $33,360 per term.",
            "evidence_locator": None,
            "scope": "institution",
            "audience": "all",
            "academic_cycle": "2026-2027",
            "retrieved_at": "2026-07-28T00:00:00+00:00",
            "confidence": 1.0,
            "verification_status": "HUMAN_VERIFIED",
            "extractor_version": "glowbal-smoke-0.6.1",
            "model_name": "deepseek-v4-flash",
            "validation_errors": [],
            "extraction_group": "finance",
            "applicability_source_url": (
                "https://example.edu/programmes/computer-science"
            ),
            "applicability_evidence": "Bachelor of Science",
        }

        class Client:
            def __init__(self) -> None:
                self.calls = 0

            def select(self, table, params):
                self.calls += 1
                self.table = table
                self.params = params
                return [dict(row), dict(row)]

        client = Client()
        repository = ApprovedAssertionRepository(client)
        first = repository.load("programme-approved")
        second = repository.load("programme-approved")

        self.assertEqual(client.calls, 1)
        self.assertEqual(client.table, "crawl_field_assertions")
        self.assertEqual(len(first), 1)
        self.assertEqual(first, second)
        self.assertEqual(
            first[0].verification_status,
            VerificationStatus.HUMAN_VERIFIED,
        )

    def test_human_verified_same_source_fact_is_canonical(self) -> None:
        base = SharedAssertionInheritanceTests._assertion(
            entity_id="programme-approved"
        )
        approved = replace(
            base,
            assertion_id="approved-tuition",
            verification_status=VerificationStatus.HUMAN_VERIFIED,
            source_content_hash=None,
        )
        proposed = replace(
            base,
            assertion_id="proposed-tuition",
            value_json={**base.value_json, "amount": 34000},
        )
        selected = prefer_human_verified([proposed, approved])
        self.assertEqual(selected, [approved])

    def test_changed_hashed_source_returns_to_review(self) -> None:
        base = SharedAssertionInheritanceTests._assertion(
            entity_id="programme-approved"
        )
        approved = replace(
            base,
            assertion_id="approved-tuition",
            verification_status=VerificationStatus.HUMAN_VERIFIED,
            source_content_hash="old-content",
        )
        proposed = replace(
            base,
            assertion_id="proposed-tuition",
            value_json={**base.value_json, "amount": 34000},
            source_content_hash="new-content",
        )
        selected = prefer_human_verified([proposed, approved])
        self.assertEqual(selected, [proposed, approved])

    def test_human_precedence_normalizes_cycle_and_all_audience(
        self,
    ) -> None:
        base = SharedAssertionInheritanceTests._assertion(
            entity_id="programme-approved"
        )
        approved = replace(
            base,
            assertion_id="approved-application",
            field_name="sop_essay_requirements",
            value_json={
                "document_type": "application_essay_set",
                "requirement_status": "required",
                "required_count": None,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
            },
            verification_status=VerificationStatus.HUMAN_VERIFIED,
            audience="domestic",
            academic_cycle="2026\u20132027",
            source_content_hash=None,
        )
        proposed = replace(
            approved,
            assertion_id="proposed-application",
            verification_status=VerificationStatus.NEEDS_REVIEW,
            audience="all",
            academic_cycle="2026-2027",
            source_content_hash="current-content",
        )
        selected = prefer_human_verified([proposed, approved])
        self.assertEqual(selected, [approved])


class BestAssertionTests(unittest.TestCase):
    entity_id = "programme-best-result"

    @staticmethod
    def _tuition(
        assertion_id: str,
        *,
        amount: int,
        cycle: str,
        retrieved_at: str,
    ) -> FieldAssertion:
        return FieldAssertion(
            assertion_id=assertion_id,
            entity_type="programme",
            entity_id=BestAssertionTests.entity_id,
            field_name="tuition",
            value_json={
                "credential": "Undergraduate",
                "amount": amount,
                "currency": "USD",
                "fee_period": "year",
                "audience": "all",
                "academic_cycle": cycle,
            },
            null_reason=None,
            source_url="https://example.edu/tuition",
            source_type="tuition",
            evidence=f"Undergraduate tuition ${amount:,}",
            evidence_locator=None,
            scope="institution",
            audience="all",
            academic_cycle=cycle,
            retrieved_at=retrieved_at,
            confidence=0.95,
            verification_status=VerificationStatus.NEEDS_REVIEW,
            extractor_version="test",
            model_name="deepseek-v4-flash",
            validation_errors=[],
            extraction_group="finance",
        )

    def test_missing_current_bundle_keeps_cached_validated_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                first = self._tuition(
                    "tuition-2026",
                    amount=62226,
                    cycle="2026-2027",
                    retrieved_at="2026-07-28T00:00:00+00:00",
                )
                effective, _ = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[first],
                    field_names=("tuition",),
                )
                self.assertEqual(effective, [first])

                carried, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[],
                    field_names=("tuition",),
                )
                self.assertEqual(
                    carried[0].value_json["amount"],
                    62226,
                )
                self.assertEqual(decisions[0]["selected"], "cached")
                self.assertEqual(
                    decisions[0]["reason"],
                    "current_missing_or_rejected",
                )
            finally:
                state.close()

    def test_human_verified_current_fact_cleans_higher_coverage_cache(
        self,
    ) -> None:
        approved = replace(
            self._tuition(
                "approved-tuition",
                amount=33360,
                cycle="2026-2027",
                retrieved_at="2026-07-28T00:00:00+00:00",
            ),
            verification_status=VerificationStatus.HUMAN_VERIFIED,
            source_content_hash=None,
        )
        duplicate = replace(
            approved,
            assertion_id="duplicate-ai-tuition",
            value_json={**approved.value_json, "amount": 34000},
            verification_status=VerificationStatus.NEEDS_REVIEW,
            source_content_hash="current-page",
        )
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                state.put_best_assertion_bundle(
                    self.entity_id,
                    "tuition",
                    [
                        approved.to_dict(),
                        duplicate.to_dict(),
                    ],
                    {},
                )
                effective, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[approved],
                    field_names=("tuition",),
                )
                cached, _ = state.get_best_assertion_bundle(
                    self.entity_id,
                    "tuition",
                )
            finally:
                state.close()

        self.assertEqual(effective, [approved])
        self.assertEqual(
            [record["assertion_id"] for record in cached],
            ["approved-tuition"],
        )
        self.assertTrue(decisions[0]["human_canonicalized"])

    def test_extractor_version_change_does_not_reuse_old_cache(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                old = self._tuition(
                    "tuition-old-extractor",
                    amount=62226,
                    cycle="2025-2026",
                    retrieved_at="2026-07-27T00:00:00+00:00",
                )
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[old],
                    field_names=("tuition",),
                    extractor_version="test",
                )
                carried, _ = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[],
                    field_names=("tuition",),
                    extractor_version="new-contract",
                )
                self.assertEqual(carried, [])
            finally:
                state.close()

    def test_retired_source_excerpt_model_is_not_reused(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                retired = replace(
                    self._tuition(
                        "retired-source-excerpt",
                        amount=62226,
                        cycle="2026-2027",
                        retrieved_at="2026-07-28T00:00:00+00:00",
                    ),
                    model_name="deterministic-source-excerpt",
                )
                state.put_best_assertion_bundle(
                    self.entity_id,
                    "tuition",
                    [retired.to_dict()],
                    {},
                )
                carried, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[],
                    field_names=("tuition",),
                    extractor_version="test",
                    compatible_extractor_versions=frozenset({"test"}),
                )
                self.assertEqual(carried, [])
                self.assertEqual(decisions, [])
            finally:
                state.close()

    def test_explicitly_compatible_extractor_reuses_revalidated_cache(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                old = self._tuition(
                    "tuition-compatible-extractor",
                    amount=62226,
                    cycle="2026-2027",
                    retrieved_at="2026-07-28T00:00:00+00:00",
                )
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[old],
                    field_names=("tuition",),
                    extractor_version="test",
                )
                carried, _ = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[],
                    field_names=("tuition",),
                    extractor_version="new-contract",
                    compatible_extractor_versions=frozenset(
                        {"test", "new-contract"}
                    ),
                )
            finally:
                state.close()

        self.assertEqual(len(carried), 1)
        self.assertEqual(carried[0].value_json["amount"], 62226)

    def test_explicit_document_count_beats_longer_generic_description(
        self,
    ) -> None:
        generic = FieldAssertion(
            assertion_id="generic-recommendation",
            entity_type="programme",
            entity_id=self.entity_id,
            field_name="recommendation_letters",
            value_json={
                "requirement_status": "required",
                "required_count": None,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "details": (
                    "A long generic description of evaluation letters "
                    "and applicant capabilities."
                ),
            },
            null_reason=None,
            source_url="https://example.edu/graduate-admissions",
            source_type="programme_admission",
            evidence=(
                "Applicants are evaluated using detailed letters from "
                "individuals familiar with their academic capabilities."
            ),
            evidence_locator=None,
            scope="institution",
            audience="all",
            academic_cycle=None,
            retrieved_at="2026-07-28T00:00:00+00:00",
            confidence=1.0,
            verification_status=VerificationStatus.NEEDS_REVIEW,
            extractor_version="test",
            model_name="deepseek-v4-flash",
            validation_errors=[],
            extraction_group="academics_admissions",
        )
        specific = replace(
            generic,
            assertion_id="specific-recommendation",
            value_json={
                "requirement_status": "required",
                "required_count": 3,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "details": "Three letters are required.",
            },
            source_url="https://example.edu/apply",
            evidence="Three letters of recommendation are required.",
            retrieved_at="2026-07-29T00:00:00+00:00",
        )
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[generic],
                    field_names=("recommendation_letters",),
                )
                effective, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[specific],
                    field_names=("recommendation_letters",),
                )
                self.assertEqual(
                    effective[0].value_json["required_count"], 3
                )
                self.assertEqual(decisions[0]["selected"], "current")
            finally:
                state.close()

    def test_lower_coverage_same_cycle_does_not_replace_cached_bundle(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                cached = [
                    self._tuition(
                        "tuition-main",
                        amount=62226,
                        cycle="2026-2027",
                        retrieved_at="2026-07-28T00:00:00+00:00",
                    ),
                    self._tuition(
                        "tuition-fee",
                        amount=6216,
                        cycle="2026-2027",
                        retrieved_at="2026-07-28T00:00:00+00:00",
                    ),
                ]
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=cached,
                    field_names=("tuition",),
                )
                lower_coverage = self._tuition(
                    "tuition-only",
                    amount=62226,
                    cycle="2026-2027",
                    retrieved_at="2026-07-29T00:00:00+00:00",
                )
                effective, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[lower_coverage],
                    field_names=("tuition",),
                )
                self.assertEqual(len(effective), 2)
                self.assertEqual(decisions[0]["selected"], "cached")
            finally:
                state.close()

    def test_newer_cycle_replaces_older_volatile_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                old = self._tuition(
                    "tuition-old",
                    amount=60000,
                    cycle="2025-2026",
                    retrieved_at="2026-01-01T00:00:00+00:00",
                )
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[old],
                    field_names=("tuition",),
                )
                new = self._tuition(
                    "tuition-new",
                    amount=62226,
                    cycle="2026-2027",
                    retrieved_at="2026-07-28T00:00:00+00:00",
                )
                effective, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[new],
                    field_names=("tuition",),
                )
                self.assertEqual(effective, [new])
                self.assertEqual(decisions[0]["selected"], "current")
            finally:
                state.close()

    def test_more_informative_stable_value_survives_brief_rerun(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                base = self._tuition(
                    "curriculum-detailed",
                    amount=1,
                    cycle="2026-2027",
                    retrieved_at="2026-07-28T00:00:00+00:00",
                )
                detailed = replace(
                    base,
                    field_name="curriculum_overview",
                    value_json=(
                        "The curriculum requires fourteen courses covering "
                        "mathematics, theory, software and electives."
                    ),
                    academic_cycle=None,
                    evidence=(
                        "fourteen courses covering mathematics, theory, "
                        "software and electives"
                    ),
                    verification_status=VerificationStatus.RULE_VALIDATED,
                )
                merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[detailed],
                    field_names=("curriculum_overview",),
                )
                brief = replace(
                    detailed,
                    assertion_id="curriculum-brief",
                    value_json="Fourteen courses are required.",
                    retrieved_at="2026-07-29T00:00:00+00:00",
                )
                effective, decisions = merge_best_assertions(
                    state=state,
                    entity_id=self.entity_id,
                    current_assertions=[brief],
                    field_names=("curriculum_overview",),
                )
                self.assertEqual(effective, [detailed])
                self.assertEqual(decisions[0]["selected"], "cached")
            finally:
                state.close()


class StorageAndContractTests(unittest.TestCase):
    def test_target_overview_excludes_sibling_programme_overview(
        self,
    ) -> None:
        config = SmokeConfig(
            run_name="target-source-filter",
            institutions=(
                InstitutionSeed(
                    institution_id="duke",
                    name="Duke University",
                    country_code="US",
                    official_domain="duke.edu",
                    homepage_url="https://duke.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        target_url = "https://bme.duke.edu/masters/ms-bme"
        programme = ProgrammeRecord(
            programme_id="duke-ms-bme",
            institution_id="duke",
            programme_name="Biomedical Engineering",
            official_url=target_url,
            degree_level="master",
            credential="MS",
            normalized_field="engineering",
            organisation_unit_id=None,
            language="en",
            campus=None,
            delivery_mode=None,
            duration=None,
            programme_status=None,
            catalogue_source="https://duke.edu/academics/",
            retrieved_at=utc_now_iso(),
        )
        sources = [
            ExtractionSource(
                url=target_url,
                page_type="programme_overview",
                title="Master of Science in BME",
                text="Master of Science in Biomedical Engineering.",
                content_hash="ms",
            ),
            ExtractionSource(
                url="https://bme.duke.edu/academics/masters/meng-bme/",
                page_type="programme_overview",
                title="Master of Engineering in BME",
                text="Master of Engineering in Biomedical Engineering.",
                content_hash="meng",
            ),
            ExtractionSource(
                url="https://gradschool.duke.edu/admissions/",
                page_type="programme_admission",
                title="Graduate admissions",
                text="Graduate admissions requirements.",
                content_hash="admissions",
            ),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                selected = DeepSeekClient(
                    config,
                    state,
                )._sources_for_group(
                    "identity_offering",
                    sources,
                    programme,
                )
                self.assertEqual(
                    [source.url for source in selected],
                    [
                        target_url,
                        "https://gradschool.duke.edu/admissions/",
                    ],
                )
            finally:
                state.close()

    def test_academics_group_prioritizes_document_rich_apply_page(
        self,
    ) -> None:
        config = SmokeConfig(
            run_name="academic-source-priority",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        sources = [
            ExtractionSource(
                url="https://example.edu/programme",
                page_type="programme_overview",
                title="Programme",
                text="Doctoral programme.",
                content_hash="main",
            ),
            ExtractionSource(
                url="https://example.edu/admissions",
                page_type="programme_admission",
                title="Admissions",
                text="Review the graduate application.",
                content_hash="generic-admission",
            ),
            ExtractionSource(
                url="https://example.edu/apply/materials",
                page_type="programme_admission",
                title="Application materials",
                text=(
                    "Submit transcripts, three recommendations, a statement "
                    "of purpose, diploma, and proof of degree."
                ),
                content_hash="application-materials",
            ),
            ExtractionSource(
                url="https://example.edu/curriculum",
                page_type="programme_overview",
                title="Curriculum",
                text="Programme curriculum.",
                content_hash="curriculum",
            ),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                selected = DeepSeekClient(
                    config, state
                )._sources_for_group(
                    "academics_admissions", sources
                )
                self.assertEqual(
                    [source.url for source in selected],
                    [
                        "https://example.edu/programme",
                        "https://example.edu/apply/materials",
                        "https://example.edu/admissions",
                        "https://example.edu/curriculum",
                    ],
                )
            finally:
                state.close()

    def test_finance_group_prioritizes_fee_sources_before_admissions(
        self,
    ) -> None:
        config = SmokeConfig(
            run_name="source-priority",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        sources = [
            ExtractionSource(
                url="https://example.edu/programme",
                page_type="programme_overview",
                title="Programme",
                text="Bachelor programme.",
                content_hash="main",
            ),
            ExtractionSource(
                url="https://example.edu/admissions",
                page_type="programme_admission",
                title="Admissions",
                text="Admission requirements.",
                content_hash="admission",
            ),
            ExtractionSource(
                url="https://example.edu/financial-aid",
                page_type="scholarship",
                title="Financial aid",
                text="Need-based aid.",
                content_hash="aid",
            ),
            ExtractionSource(
                url="https://example.edu/tuition",
                page_type="tuition",
                title="Tuition",
                text="Undergraduate tuition $50,000.",
                content_hash="tuition",
            ),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                selected = client._sources_for_group(
                    "finance",
                    sources,
                )
                self.assertEqual(
                    [source.page_type for source in selected],
                    [
                        "programme_overview",
                        "tuition",
                        "scholarship",
                        "programme_admission",
                    ],
                )
            finally:
                state.close()

    def test_jsonl_and_sqlite_cache_are_disk_backed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = RunPaths.create(root / "run")
            store = JsonlStore(paths)
            store.append("items", {"id": 1, "name": "test"})
            payload = json.loads(
                paths.jsonl_path("items").read_text(encoding="utf-8")
            )
            self.assertEqual(payload["id"], 1)

            state = StateStore(paths.root / "state.sqlite")
            try:
                state.put_llm("key", "model", {"ok": True})
                self.assertEqual(
                    state.get_llm("key"), ("model", {"ok": True})
                )
                state.put_best_assertion_bundle(
                    "programme-1",
                    "tuition",
                    [{"field_name": "tuition"}],
                    {"cycle": "2026-2027"},
                )
                state.delete_best_assertion_bundle(
                    "programme-1", "tuition"
                )
                self.assertIsNone(
                    state.get_best_assertion_bundle(
                        "programme-1", "tuition"
                    )
                )
            finally:
                state.close()

    def test_deepseek_contract_rejects_unknown_field(self) -> None:
        with self.assertRaisesRegex(Exception, "outside the contract"):
            DeepSeekClient._validate_payload(
                {
                    "schema_version": DeepSeekClient.SCHEMA_VERSION,
                    "programme_identity_match": True,
                    "facts": [
                        {
                            "field_name": "invented_field",
                            "source_url": "https://example.edu/",
                            "evidence": "evidence",
                            "confidence": 0.5,
                        }
                    ],
                    "warnings": [],
                }
            )

    def test_deepseek_contract_requires_structured_admission_value(self) -> None:
        with self.assertRaisesRegex(
            Exception, "admission requirement object"
        ):
            DeepSeekClient._validate_payload(
                {
                    "schema_version": DeepSeekClient.SCHEMA_VERSION,
                    "programme_identity_match": True,
                    "facts": [
                        {
                            "field_name": "recommendation_letters",
                            "value": "two references",
                            "source_url": "https://example.edu/apply",
                            "evidence": "two references",
                            "confidence": 0.9,
                        }
                    ],
                    "warnings": [],
                }
            )

    def test_deepseek_contract_requires_structured_funding_value(self) -> None:
        with self.assertRaisesRegex(Exception, "funding object"):
            DeepSeekClient._validate_payload(
                {
                    "schema_version": DeepSeekClient.SCHEMA_VERSION,
                    "programme_identity_match": True,
                    "facts": [
                        {
                            "field_name": "scholarships",
                            "value": "Full demonstrated need is met.",
                            "source_url": "https://example.edu/aid",
                            "evidence": "Full demonstrated need is met.",
                            "confidence": 0.9,
                        }
                    ],
                    "warnings": [],
                }
            )

    def test_deepseek_contract_rejects_editorial_admission_difficulty(
        self,
    ) -> None:
        with self.assertRaisesRegex(Exception, "admission difficulty object"):
            DeepSeekClient._validate_payload(
                {
                    "schema_version": DeepSeekClient.SCHEMA_VERSION,
                    "programme_identity_match": True,
                    "facts": [
                        {
                            "field_name": "admission_difficulty",
                            "value": "very hard",
                            "source_url": "https://example.edu/admissions",
                            "evidence": "Admissions are competitive.",
                            "confidence": 0.8,
                        }
                    ],
                    "warnings": [],
                }
            )

    def test_school_profile_contract_and_institution_null_assertion(
        self,
    ) -> None:
        payload = DeepSeekClient._validate_payload(
            {
                "schema_version": DeepSeekClient.SCHEMA_VERSION,
                "programme_identity_match": True,
                "facts": [
                    {
                        "field_name": "mission",
                        "value": "Advance knowledge.",
                        "source_url": "https://example.edu/about",
                        "evidence": "Our mission is to advance knowledge.",
                        "confidence": 0.9,
                    }
                ],
                "warnings": [],
            },
            SCHOOL_PROFILE_FIELDS,
        )
        self.assertEqual(payload["facts"][0]["field_name"], "mission")
        assertion = null_assertion(
            entity_id="example",
            entity_type="institution",
            field_name="vision",
            null_reason=NullReason.NOT_PUBLISHED,
            source_url="https://example.edu/about",
            extractor_version="test",
            model_name=None,
        )
        self.assertEqual(assertion.entity_type, "institution")

    def test_extraction_is_staged_without_low_yield_escalation(self) -> None:
        config = SmokeConfig(
            run_name="model-routing",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    catalogue_hints=("https://example.edu/programmes/",),
                    terms_status="APPROVED",
                ),
            ),
            limits=CrawlLimits(max_llm_retries=0),
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title="Data Science MSc",
            text="Data Science MSc programme.",
            content_hash="fixture",
        )

        def payload(field_name):
            value = (
                {
                    "funding_type": "financial_aid_policy",
                    "award_name": None,
                    "details": "Data Science MSc programme.",
                }
                if field_name == "scholarships"
                else field_name
            )
            return {
                "schema_version": DeepSeekClient.SCHEMA_VERSION,
                "programme_identity_match": True,
                "facts": [{
                    "field_name": field_name,
                    "value": value,
                    "source_url": source.url,
                    "source_type": "programme_overview",
                    "evidence": "Data Science MSc programme.",
                    "scope": "programme",
                    "audience": "all",
                    "academic_cycle": None,
                    "confidence": 0.9,
                }],
                "warnings": [],
            }

        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                requested_models = []
                requested_groups = []

                def fake_request(*, model_name, prompt, thinking):
                    del thinking
                    requested_models.append(model_name)
                    group_fields = {
                        "identity_offering": "programme_status",
                        "academics_admissions": "programme_focus",
                        "language": "ielts_overall",
                        "finance": "tuition",
                        "funding": "scholarships",
                        "career_outcomes": "career_outcomes",
                    }
                    group = next(
                        group
                        for group in group_fields
                        if f"extraction group: {group}" in prompt
                    )
                    requested_groups.append(group)
                    return payload(group_fields[group])

                client._request = fake_request
                model, result = client.extract(programme, [source])
                self.assertEqual(model, config.deepseek_flash_model)
                self.assertEqual(len(result["facts"]), 6)
                self.assertEqual(
                    requested_models,
                    [config.deepseek_flash_model] * 6,
                )
                self.assertEqual(
                    requested_groups,
                    [
                        "identity_offering",
                        "academics_admissions",
                        "language",
                        "finance",
                        "funding",
                        "career_outcomes",
                    ],
                )
            finally:
                state.close()

    def test_selective_field_retry_calls_only_owning_groups(self) -> None:
        config = SmokeConfig(
            run_name="selective-groups",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/computer-science",
                "Computer Science",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science curriculum.",
            content_hash="selective",
        )
        empty_payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [],
            "warnings": [],
        }
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                requested: list[tuple[str, tuple[str, ...]]] = []

                def fake_group(
                    _programme,
                    _sources,
                    extraction_group,
                    field_names,
                    **_kwargs,
                ):
                    requested.append((extraction_group, field_names))
                    return config.deepseek_flash_model, empty_payload

                client._extract_group = fake_group
                _, result = client.extract_fields(
                    programme,
                    [source],
                    field_names=(
                        "curriculum_overview",
                        "tuition",
                        "career_outcomes",
                    ),
                )
                self.assertEqual(
                    requested,
                    [
                        (
                            "academics_admissions",
                            ("curriculum_overview",),
                        ),
                        ("finance", ("tuition",)),
                        ("career_outcomes", ("career_outcomes",)),
                    ],
                )
                self.assertEqual(len(result["group_diagnostics"]), 3)
            finally:
                state.close()

    def test_selective_identity_failure_is_not_hidden(self) -> None:
        config = SmokeConfig(
            run_name="selective-identity",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/computer-science",
                "Computer Science",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science curriculum.",
            content_hash="selective-identity",
        )
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)

                def failing_group(*_args, **_kwargs):
                    raise DeepSeekError("identity extraction failed")

                client._extract_group = failing_group
                _, result = client.extract_fields(
                    programme,
                    [source],
                    field_names=("programme_status",),
                )
            finally:
                state.close()

        self.assertFalse(result["programme_identity_match"])
        self.assertEqual(
            result["group_diagnostics"][0]["status"],
            "failed",
        )

    def test_group_failure_details_are_returned_and_counted(self) -> None:
        config = SmokeConfig(
            run_name="group-diagnostics",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
            limits=CrawlLimits(max_llm_retries=0),
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Data Science MSc.",
            content_hash="diagnostic",
        )
        empty_payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [],
            "warnings": [],
        }
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)

                def fake_group(
                    _programme,
                    _sources,
                    extraction_group,
                    _field_names,
                    *,
                    prefer_pro=False,
                ):
                    del prefer_pro
                    if extraction_group == "language":
                        raise DeepSeekError("invalid language payload")
                    return config.deepseek_flash_model, empty_payload

                client._extract_group = fake_group
                _, result = client.extract(programme, [source])
                failure = next(
                    item
                    for item in result["group_diagnostics"]
                    if item["status"] == "failed"
                )
                self.assertEqual(failure["extraction_group"], "language")
                self.assertIn("invalid language payload", failure["error"])
                self.assertEqual(client.stats.group_failures, 1)
                self.assertEqual(
                    client.stats.failure_details[0]["programme_id"],
                    programme.programme_id,
                )
            finally:
                state.close()

    def test_admission_retry_filters_valid_extra_package_fields(self) -> None:
        config = SmokeConfig(
            run_name="admission-filter",
            institutions=(
                InstitutionSeed(
                    institution_id="example",
                    name="Example University",
                    country_code="US",
                    official_domain="example.edu",
                    homepage_url="https://example.edu/",
                    terms_status="APPROVED",
                ),
            ),
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_admission",
            title=programme.programme_name,
            text="Admission requirements.",
            content_hash="admission-filter",
        )
        payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [
                {
                    "field_name": "recommendation_letters",
                    "value": {
                        "document_type": "recommendation_letter",
                        "requirement_status": "required",
                        "required_count": 2,
                        "application_stage": "initial_application",
                        "accepted_alternatives": [],
                        "components": [],
                        "details": "Two letters are required.",
                    },
                    "source_url": source.url,
                    "evidence": "Two letters are required.",
                    "confidence": 0.9,
                },
                {
                    "field_name": "graduation_certificate",
                    "value": {
                        "document_type": "graduation_certificate",
                        "requirement_status": "required",
                        "required_count": 1,
                        "application_stage": "initial_application",
                        "accepted_alternatives": [],
                        "components": [],
                        "details": "A certificate is required.",
                    },
                    "source_url": source.url,
                    "evidence": "A certificate is required.",
                    "confidence": 0.9,
                },
                {
                    "field_name": "resume",
                    "value": "Resume required.",
                    "source_url": source.url,
                    "evidence": "Resume required.",
                    "confidence": 0.9,
                },
            ],
            "warnings": [],
        }
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                full_key = client._cache_key(
                    programme,
                    [source],
                    "flash",
                    "academics_admissions",
                    ("programme_focus", "recommendation_letters"),
                )
                retry_key = client._cache_key(
                    programme,
                    [source],
                    "flash",
                    "academics_admissions",
                    ("recommendation_letters",),
                )
                self.assertNotEqual(full_key, retry_key)
                client.api_key = "test-key"
                client._request = mock.Mock(
                    return_value=payload
                )
                _, filtered = client.extract_admission_package(
                    programme,
                    [source],
                    missing_fields=("recommendation_letters",),
                )
                self.assertEqual(
                    [
                        fact["field_name"]
                        for fact in filtered["facts"]
                    ],
                    ["recommendation_letters"],
                )
            finally:
                state.close()


class AdmissionPackageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        self.source = ExtractionSource(
            url="https://example.edu/programmes/data-science-msc/apply",
            page_type="programme_admission",
            title="How to apply",
            text=(
                "With your application, submit three recommendation letters. "
                "Upload one statement of purpose. The degree certificate is "
                "required after an offer. Academic transcripts are optional. "
                "We require letters from two teachers and one school counselor "
                "report. The application consists of several short response "
                "questions and essays."
            ),
            content_hash="admission-fixture",
        )

    def _assertion(
        self,
        field_name: str,
        value: dict,
        evidence: str,
    ):
        return fact_to_assertion(
            entity_id=self.programme.programme_id,
            fact={
                "field_name": field_name,
                "value": value,
                "source_url": self.source.url,
                "source_type": self.source.page_type,
                "evidence": evidence,
                "scope": "programme",
                "audience": "all",
                "academic_cycle": "2026",
                "confidence": 0.95,
            },
            source_map={self.source.url: self.source},
            model_name="fixture",
            extractor_version="test",
            programme_degree="master",
            programme_name=self.programme.programme_name,
        )

    def test_two_lor_baseline_reports_one_missing_against_three_required(self) -> None:
        assertions = [
            self._assertion(
                "recommendation_letters",
                {
                    "requirement_status": "required",
                    "required_count": 3,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "details": "Three letters are required.",
                },
                "With your application, submit three recommendation letters.",
            ),
            self._assertion(
                "sop_essay_requirements",
                {
                    "requirement_status": "required",
                    "required_count": 1,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "details": "One SOP is required.",
                },
                "Upload one statement of purpose.",
            ),
            self._assertion(
                "graduation_certificate",
                {
                    "requirement_status": "required",
                    "required_count": 1,
                    "application_stage": "after_offer",
                    "accepted_alternatives": [],
                    "details": "Required after offer.",
                },
                "The degree certificate is required after an offer.",
            ),
            self._assertion(
                "academic_transcript",
                {
                    "requirement_status": "optional",
                    "required_count": 0,
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "details": "Optional.",
                },
                "Academic transcripts are optional.",
            ),
        ]
        package = build_admission_package(
            self.programme,
            assertions,
            {
                "recommendation_letter": 2,
                "statement_of_purpose": 1,
                "graduation_certificate": 1,
                "academic_transcript": 0,
            },
        )
        self.assertEqual(
            package["precheck"]["decision"], "MISSING_DOCUMENTS"
        )
        self.assertEqual(
            package["precheck"]["missing_documents"],
            [
                {
                    "document_type": "recommendation_letter",
                    "required_count": 3,
                    "available_count": 2,
                    "missing_count": 1,
                }
            ],
        )

    def test_unknown_requirement_never_becomes_missing(self) -> None:
        package = build_admission_package(self.programme, [])
        self.assertEqual(
            package["precheck"]["decision"], "APPLICANT_DATA_REQUIRED"
        )
        self.assertEqual(package["precheck"]["missing_documents"], [])
        self.assertEqual(
            set(package["precheck"]["unknown_requirements"]),
            {
                "recommendation_letter",
                "statement_of_purpose",
                "graduation_certificate",
                "academic_transcript",
            },
        )

    def test_requirement_count_does_not_imply_applicant_inventory(self) -> None:
        assertion = self._assertion(
            "recommendation_letters",
            {
                "requirement_status": "required",
                "required_count": 3,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "details": "Three letters are required.",
            },
            "With your application, submit three recommendation letters.",
        )
        package = build_admission_package(
            self.programme,
            [assertion],
        )
        self.assertEqual(
            package["precheck"]["decision"], "APPLICANT_DATA_REQUIRED"
        )
        self.assertEqual(package["precheck"]["missing_documents"], [])
        self.assertIsNone(package["precheck"]["applicant_inventory"])

    def test_explicit_unknown_essay_count_stays_unknown(self) -> None:
        assertion = self._assertion(
            "sop_essay_requirements",
            {
                "requirement_status": "required",
                "required_count": None,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "details": "Several short responses are required.",
            },
            "Upload one statement of purpose.",
        )
        package = build_admission_package(
            self.programme,
            [assertion],
        )
        essay = next(
            requirement
            for requirement in package["requirements"]
            if requirement["source_field"] == "sop_essay_requirements"
        )
        self.assertIsNone(essay["required_count"])

    def test_recommendation_components_are_preserved_separately(self) -> None:
        assertion = self._assertion(
            "recommendation_letters",
            {
                "document_type": "recommendation_letter",
                "requirement_status": "required",
                "required_count": 2,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "components": [
                    {
                        "component_type": "teacher_recommendation",
                        "requirement_status": "required",
                        "required_count": 2,
                        "application_stage": "initial_application",
                        "details": "Two teacher recommendations.",
                    },
                    {
                        "component_type": "counselor_materials",
                        "requirement_status": "required",
                        "required_count": 1,
                        "application_stage": "initial_application",
                        "details": "One school counselor report.",
                    },
                ],
                "details": "Teacher recommendations and counselor report.",
            },
            "We require letters from two teachers and one school counselor report.",
        )
        package = build_admission_package(self.programme, [assertion])
        recommendation = next(
            requirement
            for requirement in package["requirements"]
            if requirement["source_field"] == "recommendation_letters"
        )
        self.assertEqual(recommendation["required_count"], 2)
        self.assertEqual(
            recommendation["count_scope"],
            "primary_component",
        )
        self.assertEqual(
            {
                component["component_type"]
                for component in recommendation["components"]
            },
            {"teacher_recommendation", "counselor_materials"},
        )

    def test_application_essay_set_is_not_labeled_as_sop(self) -> None:
        assertion = self._assertion(
            "sop_essay_requirements",
            {
                "document_type": "application_essay_set",
                "requirement_status": "required",
                "required_count": None,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "components": [],
                "details": "Several short response questions and essays.",
            },
            "The application consists of several short response questions and essays.",
        )
        package = build_admission_package(self.programme, [assertion])
        essay = next(
            requirement
            for requirement in package["requirements"]
            if requirement["source_field"] == "sop_essay_requirements"
        )
        self.assertEqual(
            essay["document_type"],
            "application_essay_set",
        )
        self.assertIsNone(essay["required_count"])

    def test_document_mentioned_beside_recommendation_is_not_an_alternative(
        self,
    ) -> None:
        assertion = self._assertion(
            "recommendation_letters",
            {
                "document_type": "recommendation_letter",
                "requirement_status": "required",
                "required_count": 2,
                "application_stage": "initial_application",
                "accepted_alternatives": [],
                "components": [],
                "details": "Two teacher recommendations and counselor materials.",
            },
            "We require letters from two teachers and one school counselor report.",
        )
        package = build_admission_package(self.programme, [assertion])
        recommendation = next(
            requirement
            for requirement in package["requirements"]
            if requirement["source_field"] == "recommendation_letters"
        )
        self.assertEqual(recommendation["accepted_alternatives"], [])


class ApplicationUrlValidationTests(unittest.TestCase):
    def _assertion(self, value: str, evidence: str) -> FieldAssertion:
        source = ExtractionSource(
            url=value,
            page_type="programme_admission",
            title="Admissions",
            text=evidence,
            content_hash="application-url-fixture",
        )
        return fact_to_assertion(
            entity_id="programme-1",
            fact={
                "field_name": "application_url",
                "value": value,
                "source_url": value,
                "source_type": source.page_type,
                "evidence": evidence,
                "scope": "institution",
                "audience": "all",
                "academic_cycle": "2026-2027",
                "confidence": 0.95,
            },
            source_map={value: source},
            model_name="fixture",
            extractor_version="test",
            programme_degree="bachelor",
            programme_name="Computer Science",
        )

    def test_essay_information_page_is_rejected_as_application_url(
        self,
    ) -> None:
        assertion = self._assertion(
            "https://example.edu/apply/firstyear/essays-activities-academics/",
            "First-year applicants: Essays, activities and academics",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.REJECTED,
        )
        self.assertIn(
            "APPLICATION_URL_IS_INFORMATION_PAGE",
            assertion.validation_errors,
        )

    def test_application_portal_url_is_accepted(self) -> None:
        assertion = self._assertion(
            "https://apply.example.edu/portal/start",
            "Start your application in our application portal.",
        )
        self.assertEqual(
            assertion.verification_status,
            VerificationStatus.RULE_VALIDATED,
        )


class PipelineIntegrationTests(unittest.TestCase):
    def test_programme_concurrency_waits_for_each_degree_seeder(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="programme-concurrency",
            institutions=(seed,),
            limits=CrawlLimits(
                programme_concurrency_per_institution=2,
            ),
        )

        def programme(slug: str, name: str, degree: str):
            return replace(
                candidate_to_programme(
                    seed.institution_id,
                    ProgrammeCandidate(
                        f"https://example.edu/programmes/{slug}",
                        name,
                        "fixture",
                        7,
                    ),
                ),
                degree_level=degree,
            )

        bachelor_seed = programme("alpha-bs", "Alpha", "bachelor")
        bachelor_two = programme("beta-bs", "Beta", "bachelor")
        master_seed = programme("alpha-ms", "Alpha MS", "master")
        master_two = programme("beta-ms", "Beta MS", "master")
        deep = [
            bachelor_seed,
            bachelor_two,
            master_seed,
            master_two,
        ]
        pipeline = object.__new__(SmokePipeline)
        pipeline.config = config
        pipeline._progress = lambda _message: None
        started: list[str] = []
        started_lock = threading.Lock()

        def fake_process(
            _seed,
            _policy,
            selected,
            _preloaded,
        ):
            with started_lock:
                started.append(selected.programme_id)
            return selected

        pipeline._process_deep = fake_process
        result = pipeline._process_selected_deep(
            seed,
            SimpleNamespace(),
            deep,
            {},
        )

        self.assertEqual(
            started[:2],
            [
                bachelor_seed.programme_id,
                master_seed.programme_id,
            ],
        )
        self.assertEqual(set(result), {item.programme_id for item in deep})

    def test_effective_assertions_carry_best_bundle_across_runs(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="best-result-integration",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=1,
                max_admission_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                "https://example.edu/programmes/computer-science",
                "Computer Science BSc",
                "fixture",
                7,
            ),
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text=(
                "Computer Science graduates work in software engineering "
                "and research."
            ),
            content_hash="career-source",
        )
        career_fact = {
            "field_name": "career_outcomes",
            "value": [
                "software engineering",
                "research",
            ],
            "source_url": programme.official_url,
            "source_type": "programme_overview",
            "evidence": (
                "Computer Science graduates work in software engineering "
                "and research."
            ),
            "scope": "programme",
            "audience": "all",
            "academic_cycle": None,
            "confidence": 0.95,
            "_group": "career_outcomes",
        }
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = SmokePipeline(
                config,
                root / "run-1",
                allow_unreviewed_terms=False,
                discovery_only=False,
            )
            first.deepseek.extract = lambda *_args, **_kwargs: (
                "deepseek-v4-flash",
                {
                    "programme_identity_match": True,
                    "facts": [career_fact],
                    "warnings": [],
                    "group_diagnostics": [],
                },
            )
            try:
                first._process_deep(
                    seed,
                    policy,
                    programme,
                    (source, []),
                )
            finally:
                first.state.close()
                first.llm_state.close()

            second = SmokePipeline(
                config,
                root / "run-2",
                allow_unreviewed_terms=False,
                discovery_only=False,
            )
            second.deepseek.extract = lambda *_args, **_kwargs: (
                "deepseek-v4-flash",
                {
                    "programme_identity_match": True,
                    "facts": [],
                    "warnings": [],
                    "group_diagnostics": [],
                },
            )
            try:
                second._process_deep(
                    seed,
                    policy,
                    programme,
                    (source, []),
                )
                effective = [
                    json.loads(line)
                    for line in (
                        root
                        / "run-2"
                        / "effective_field_assertions.jsonl"
                    ).read_text(encoding="utf-8").splitlines()
                ]
                career = next(
                    assertion
                    for assertion in effective
                    if assertion["field_name"] == "career_outcomes"
                )
                self.assertEqual(
                    career["value_json"],
                    ["software engineering", "research"],
                )
                decisions = [
                    json.loads(line)
                    for line in (
                        root
                        / "run-2"
                        / "best_assertion_decisions.jsonl"
                    ).read_text(encoding="utf-8").splitlines()
                ]
                career_decision = next(
                    decision
                    for decision in decisions
                    if decision["field_name"] == "career_outcomes"
                )
                self.assertEqual(
                    career_decision["selected"],
                    "cached",
                )
            finally:
                second.state.close()
                second.llm_state.close()

    def test_discovery_graph_guides_degree_matched_deep_sources(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="graph-guided",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=3,
                max_admission_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                "https://example.edu/programmes/computer-science-bsc",
                "Computer Science BSc",
                "fixture",
                7,
            ),
        )
        main_source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science BSc curriculum.",
            content_hash="main",
        )
        undergraduate_admission = (
            "https://example.edu/undergraduate/admissions/"
        )
        graduate_admission = "https://example.edu/graduate/admissions/"
        financial_aid = (
            "https://example.edu/undergraduate/financial-aid/"
        )
        page_only_career = "https://example.edu/careers/outcomes/"
        fetched: list[str] = []
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "run"
            pipeline = SmokePipeline(
                config,
                run_dir,
                allow_unreviewed_terms=False,
                discovery_only=True,
            )
            for target, anchor in (
                (undergraduate_admission, "Undergraduate admissions"),
                (graduate_admission, "Graduate admissions"),
                (financial_aid, "Undergraduate financial aid"),
                (
                    "https://catalog-dev.example.edu/admissions/",
                    "Admissions preview",
                ),
            ):
                pipeline._record_discovery_edge(
                    {
                        "institution_id": seed.institution_id,
                        "discovered_from": (
                            "https://example.edu/programmes/"
                        ),
                        "target_url": target,
                        "relation": "scrapy_anchor",
                        "depth": 1,
                        "anchor_text": anchor,
                    }
                )

            def fake_source(_seed, _policy, url):
                fetched.append(url)
                source = ExtractionSource(
                    url=url,
                    page_type=(
                        "programme_admission"
                        if "admissions" in url
                        else "scholarship"
                    ),
                    title="Source",
                    text="Official application information.",
                    content_hash=url,
                )
                return None, source, []

            pipeline._fetch_and_parse_source = fake_source
            try:
                pipeline._process_deep(
                    seed,
                    policy,
                    programme,
                    (
                        main_source,
                        [
                            (
                                undergraduate_admission,
                                "Undergraduate admissions",
                            ),
                            (page_only_career, "Career outcomes"),
                        ],
                    ),
                )
                self.assertEqual(
                    fetched,
                    [undergraduate_admission, financial_aid],
                )
                self.assertNotIn(graduate_admission, fetched)
                self.assertNotIn(page_only_career, fetched)
                self.assertEqual(
                    pipeline.metrics.graph_guided_sources, 2
                )
                edges = [
                    json.loads(line)
                    for line in (
                        run_dir / "url_graph_edges.jsonl"
                    ).read_text(encoding="utf-8").splitlines()
                ]
                self.assertEqual(
                    {edge["relation"] for edge in edges},
                    {"graph_guided_source"},
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_existing_admission_bundle_leaves_slots_for_missing_categories(
        self,
    ) -> None:
        programme_url = (
            "https://example.edu/programmes/computer-science-bsc"
        )
        admission_one = "https://example.edu/apply/first-year/"
        admission_two = (
            "https://example.edu/apply/first-year/requirements/"
        )
        tuition = "https://example.edu/undergraduate/costs/"
        scholarship = "https://example.edu/financial-aid/"
        career = "https://example.edu/careers/outcomes/"
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            programme_source_bundles={
                programme_url: (admission_one, admission_two),
            },
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="coverage-driven",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=6,
                max_admission_retry_sources_per_programme=3,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                programme_url,
                "Computer Science BSc",
                "fixture",
                7,
            ),
        )
        main_source = ExtractionSource(
            url=programme_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science BSc curriculum.",
            content_hash="main",
        )
        page_types = {
            admission_one: "programme_admission",
            admission_two: "programme_admission",
            tuition: "tuition",
            scholarship: "scholarship",
            career: "career_outcome",
        }
        fetched: list[str] = []
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
            )

            def fake_source(_seed, _policy, url):
                fetched.append(url)
                return (
                    None,
                    ExtractionSource(
                        url=url,
                        page_type=page_types[url],
                        title="Official source",
                        text="Official programme information.",
                        content_hash=url,
                    ),
                    [],
                )

            pipeline._fetch_and_parse_source = fake_source
            try:
                pipeline._process_deep(
                    seed,
                    policy,
                    programme,
                    (
                        main_source,
                        [
                            (admission_one, "Admissions"),
                            (tuition, "Costs"),
                            (scholarship, "Financial aid"),
                            (career, "Career outcomes"),
                        ],
                    ),
                )
                self.assertEqual(
                    fetched,
                    [
                        admission_one,
                        admission_two,
                        tuition,
                        scholarship,
                        career,
                    ],
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_configured_source_links_expand_missing_coverage(self) -> None:
        programme_url = (
            "https://example.edu/programmes/computer-science-bsc"
        )
        admission = "https://example.edu/apply/first-year/"
        tuition = "https://example.edu/undergraduate/costs/"
        scholarship = "https://example.edu/financial-aid/"
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            programme_source_bundles={programme_url: (admission,)},
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="configured-link-expansion",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=4,
                max_admission_retry_sources_per_programme=0,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                programme_url,
                "Computer Science BSc",
                "fixture",
                7,
            ),
        )
        main_source = ExtractionSource(
            url=programme_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science BSc.",
            content_hash="main",
        )
        page_types = {
            admission: "programme_admission",
            tuition: "tuition",
            scholarship: "scholarship",
        }
        fetched: list[str] = []
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
            )

            def fake_source(_seed, _policy, url):
                fetched.append(url)
                source_links = (
                    [
                        (tuition, "Tuition"),
                        (scholarship, "Financial aid"),
                    ]
                    if url == admission
                    else []
                )
                return (
                    None,
                    ExtractionSource(
                        url=url,
                        page_type=page_types[url],
                        title="Official source",
                        text="Official information.",
                        content_hash=url,
                    ),
                    source_links,
                )

            pipeline._fetch_and_parse_source = fake_source
            try:
                pipeline._process_deep(
                    seed,
                    policy,
                    programme,
                    (main_source, []),
                )
                self.assertEqual(
                    fetched,
                    [admission, tuition, scholarship],
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_missing_finance_field_uses_reserved_targeted_retry_slot(
        self,
    ) -> None:
        programme_url = (
            "https://example.edu/programmes/computer-science-bsc"
        )
        curriculum_url = f"{programme_url}/curriculum"
        tuition_url = "https://example.edu/undergraduate/tuition/"
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="targeted-coverage-retry",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=3,
                max_coverage_retry_sources_per_programme=1,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                programme_url,
                "Computer Science BSc",
                "fixture",
                7,
            ),
        )
        main_source = ExtractionSource(
            url=programme_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Computer Science BSc.",
            content_hash="main",
        )
        curriculum_evidence = (
            "The programme includes algorithms and software engineering."
        )
        tuition_evidence = (
            "Undergraduate tuition is USD 50,000 per year for 2026-2027."
        )
        sources = {
            curriculum_url: ExtractionSource(
                url=curriculum_url,
                page_type="programme_overview",
                title="Curriculum",
                text=curriculum_evidence,
                content_hash="curriculum",
            ),
            tuition_url: ExtractionSource(
                url=tuition_url,
                page_type="tuition",
                title="Tuition",
                text=tuition_evidence,
                content_hash="tuition",
            ),
        }
        initial_payload = {
            "programme_identity_match": True,
            "facts": [
                {
                    "field_name": "curriculum_overview",
                    "value": curriculum_evidence,
                    "source_url": curriculum_url,
                    "source_type": "programme_overview",
                    "evidence": curriculum_evidence,
                    "scope": "programme",
                    "audience": "all",
                    "academic_cycle": None,
                    "confidence": 0.95,
                }
            ],
            "warnings": [],
            "group_diagnostics": [],
        }
        retry_payload = {
            "programme_identity_match": True,
            "facts": [
                {
                    "field_name": "tuition",
                    "value": {
                        "credential": "Undergraduate",
                        "amount": 50000,
                        "currency": "USD",
                        "fee_period": "year",
                        "audience": "all",
                        "academic_cycle": "2026-2027",
                    },
                    "source_url": tuition_url,
                    "source_type": "tuition",
                    "evidence": tuition_evidence,
                    "scope": "programme",
                    "audience": "all",
                    "academic_cycle": "2026-2027",
                    "confidence": 0.95,
                }
            ],
            "warnings": [],
            "group_diagnostics": [
                {
                    "extraction_group": "finance",
                    "status": "completed",
                }
            ],
        }
        fetched: list[str] = []
        requested_fields: list[tuple[str, ...]] = []
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "run"
            pipeline = SmokePipeline(
                config,
                run_dir,
                allow_unreviewed_terms=False,
                discovery_only=False,
            )

            def fake_source(_seed, _policy, url):
                fetched.append(url)
                return None, sources[url], []

            def fake_extract_fields(*_args, **kwargs):
                requested_fields.append(kwargs["field_names"])
                return "flash", retry_payload

            pipeline._fetch_and_parse_source = fake_source
            pipeline.deepseek = SimpleNamespace(
                extract=lambda *_args, **_kwargs: (
                    "flash",
                    initial_payload,
                ),
                extract_fields=fake_extract_fields,
            )
            try:
                pipeline._process_deep(
                    seed,
                    policy,
                    programme,
                    (
                        main_source,
                        [
                            (curriculum_url, "Curriculum"),
                            (tuition_url, "Tuition and fees"),
                        ],
                    ),
                )
                self.assertEqual(
                    fetched, [curriculum_url, tuition_url]
                )
                self.assertTrue(
                    any("tuition" in fields for fields in requested_fields)
                )
                self.assertEqual(
                    pipeline.metrics.coverage_retry_sources, 1
                )
                effective = [
                    json.loads(line)
                    for line in (
                        run_dir / "effective_field_assertions.jsonl"
                    ).read_text(encoding="utf-8").splitlines()
                ]
                tuition = next(
                    item
                    for item in effective
                    if item["field_name"] == "tuition"
                    and item["value_json"] is not None
                )
                self.assertEqual(tuition["value_json"]["amount"], 50000)
                edges = [
                    json.loads(line)
                    for line in (
                        run_dir / "url_graph_edges.jsonl"
                    ).read_text(encoding="utf-8").splitlines()
                ]
                self.assertIn(
                    "field_coverage_retry",
                    {edge["relation"] for edge in edges},
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_missing_admission_fields_trigger_second_hop_retry(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="admission-retry",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_sources_per_programme=4,
                max_admission_retry_sources_per_programme=2,
                min_request_interval_seconds=0,
            ),
        )
        programme = candidate_to_programme(
            seed.institution_id,
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                "Data Science MSc",
                "fixture",
                7,
            ),
        )
        main_source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title=programme.programme_name,
            text="Data Science MSc programme.",
            content_hash="main",
        )
        apply_url = f"{programme.official_url}/how-to-apply"
        documents_url = "https://example.edu/admissions/supporting-documents"
        source_map = {
            apply_url: (
                ExtractionSource(
                    url=apply_url,
                    page_type="programme_admission",
                    title="How to apply",
                    text="Read the supporting documents checklist.",
                    content_hash="apply",
                ),
                [(documents_url, "Supporting documents checklist")],
            ),
            documents_url: (
                ExtractionSource(
                    url=documents_url,
                    page_type="programme_admission",
                    title="Supporting documents",
                    text=(
                        "With your application, submit two recommendation "
                        "letters."
                    ),
                    content_hash="documents",
                ),
                [],
            ),
        }
        initial_payload = {
            "programme_identity_match": True,
            "facts": [],
            "warnings": [],
            "group_diagnostics": [],
        }
        retry_payload = {
            "programme_identity_match": True,
            "facts": [
                {
                    "field_name": "recommendation_letters",
                    "value": {
                        "requirement_status": "required",
                        "required_count": 2,
                        "application_stage": "initial_application",
                        "accepted_alternatives": [],
                        "details": "Two letters.",
                    },
                    "source_url": documents_url,
                    "source_type": "programme_admission",
                    "evidence": (
                        "With your application, submit two recommendation "
                        "letters."
                    ),
                    "scope": "programme",
                    "audience": "all",
                    "academic_cycle": "2026",
                    "confidence": 0.95,
                }
            ],
            "warnings": [],
        }
        policy = SimpleNamespace(allows=lambda _url, _agent: True)

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "run"
            pipeline = SmokePipeline(
                config,
                run_dir,
                allow_unreviewed_terms=False,
                discovery_only=False,
            )

            def fake_source(_seed, _policy, url):
                source, links = source_map[url]
                return None, source, links

            retry_calls = []
            pipeline._fetch_and_parse_source = fake_source
            pipeline.deepseek = SimpleNamespace(
                extract=lambda *_args, **_kwargs: (
                    "flash",
                    initial_payload,
                ),
                extract_admission_package=lambda *_args, **kwargs: (
                    retry_calls.append(kwargs["missing_fields"]) or "flash",
                    retry_payload,
                ),
            )
            try:
                pipeline._process_deep(
                    seed,
                    policy,
                    programme,
                    (
                        main_source,
                        [(apply_url, "How to apply")],
                    ),
                )
                self.assertEqual(len(retry_calls), 1)
                self.assertIn("recommendation_letters", retry_calls[0])
                self.assertEqual(pipeline.metrics.admission_retry_programmes, 1)
                package = json.loads(
                    (
                        run_dir / "admission_packages.jsonl"
                    ).read_text(encoding="utf-8")
                )
                lor = next(
                    item
                    for item in package["requirements"]
                    if item["document_type"] == "recommendation_letter"
                )
                self.assertEqual(lor["requirement_status"], "required")
                self.assertEqual(lor["required_count"], 2)
                edges = (
                    run_dir / "url_graph_edges.jsonl"
                ).read_text(encoding="utf-8").splitlines()
                self.assertEqual(len(edges), 2)
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_status_preflight_prefers_active_candidates(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="status-preflight",
            institutions=(seed,),
            limits=CrawlLimits(
                max_deep_programmes_per_institution=2,
                max_status_preflight_candidates_per_institution=4,
                min_request_interval_seconds=0,
            ),
        )
        candidates = [
            ProgrammeCandidate(
                "https://example.edu/programmes/alpha-bsc",
                "Alpha BSc",
                "catalogue",
                7,
            ),
            ProgrammeCandidate(
                "https://example.edu/programmes/beta-bsc",
                "Beta BSc",
                "catalogue",
                7,
            ),
            ProgrammeCandidate(
                "https://example.edu/programmes/gamma-msc",
                "Gamma MSc",
                "catalogue",
                7,
            ),
        ]
        programmes = [
            candidate_to_programme(seed.institution_id, candidate)
            for candidate in candidates
        ]
        policy = SimpleNamespace(allows=lambda _url, _agent: True)
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
            )

            def fake_source(_seed, _policy, url):
                text = (
                    "This course is suspended for 2026 entry."
                    if "alpha-bsc" in url
                    else "Applications are open."
                )
                source = ExtractionSource(
                    url=url,
                    page_type="programme_overview",
                    title="Programme",
                    text=text,
                    content_hash=url,
                )
                return None, source, []

            pipeline._fetch_and_parse_source = fake_source
            try:
                selected, preloaded = pipeline._choose_status_aware_deep(
                    seed,
                    policy,
                    programmes,
                    include_optional_phd=False,
                )
                selected_urls = {
                    programme.official_url for programme in selected
                }
                self.assertNotIn(candidates[0].url, selected_urls)
                self.assertEqual(len(selected), 2)
                self.assertEqual(len(preloaded), 2)
                self.assertEqual(
                    pipeline.metrics.status_preflight_inactive_candidates,
                    1,
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()

    def test_review_decision_blocks_only_when_no_usable_data(self) -> None:
        self.assertEqual(
            review_decision(
                programme_status=None,
                rejected_count=2,
                needs_review_count=1,
                accepted_non_null_count=5,
            ),
            "PARTIAL_DATA_REVIEW_REQUIRED",
        )
        self.assertEqual(
            review_decision(
                programme_status=None,
                rejected_count=2,
                needs_review_count=0,
                accepted_non_null_count=0,
            ),
            "BLOCKED_BY_VALIDATION",
        )
        self.assertEqual(
            review_decision(
                programme_status="paused for 2025-2026",
                rejected_count=0,
                needs_review_count=0,
                accepted_non_null_count=5,
            ),
            "INACTIVE_PROGRAMME",
        )

    def test_related_link_selection_is_diverse_and_excludes_support_pages(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            catalogue_hints=("https://example.edu/programmes/",),
            terms_status="APPROVED",
        )
        links = [
            ("https://example.edu/safety/support", "Safety and support"),
            (
                "https://example.edu/admissions/requirements",
                "Admission requirements",
            ),
            (
                "https://example.edu/admissions/english-language",
                "English language requirements",
            ),
            ("https://example.edu/fees/tuition", "Tuition fees"),
            ("https://example.edu/funding/scholarships", "Scholarships"),
            ("https://example.edu/careers/outcomes", "Career outcomes"),
            (
                "https://example.edu/graduate/admissions/",
                "Graduate admissions",
            ),
        ]
        selected = SmokePipeline._related_links(
            None,
            links,
            seed,
            "https://example.edu/programmes/data-science",
            "bachelor",
        )
        self.assertNotIn("https://example.edu/safety/support", selected)
        self.assertEqual(len(selected), 5)
        self.assertIn(
            "https://example.edu/admissions/english-language", selected
        )
        self.assertIn("https://example.edu/fees/tuition", selected)
        self.assertNotIn(
            "https://example.edu/graduate/admissions/", selected
        )

    def test_related_link_selection_prioritizes_uncovered_categories(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        selected = SmokePipeline._related_links(
            None,
            [
                (
                    "https://example.edu/undergraduate/admissions/",
                    "Admissions",
                ),
                (
                    "https://example.edu/undergraduate/costs/",
                    "Costs",
                ),
                (
                    "https://example.edu/financial-aid/",
                    "Financial aid",
                ),
                (
                    "https://example.edu/careers/outcomes/",
                    "Career outcomes",
                ),
            ],
            seed,
            "https://example.edu/programmes/computer-science",
            "bachelor",
            frozenset({"programme_admission"}),
        )
        self.assertEqual(
            selected,
            [
                "https://example.edu/undergraduate/costs/",
                "https://example.edu/financial-aid/",
                "https://example.edu/careers/outcomes/",
            ],
        )

    def test_related_link_selection_includes_inline_curriculum_pages(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        selected = SmokePipeline._related_links(
            None,
            [
                (
                    "https://example.edu/bs-degree-requirements",
                    "BS Degree Requirements",
                ),
                (
                    "https://example.edu/bachelors-compsci-tracks-overview",
                    "About BS tracks",
                ),
            ],
            seed,
            "https://example.edu/academics/bachelors-program",
            "bachelor",
        )
        self.assertEqual(
            selected[0],
            "https://example.edu/bachelors-compsci-tracks-overview",
        )
        self.assertIn(
            "https://example.edu/bs-degree-requirements",
            selected,
        )

    def test_related_link_selection_recognizes_product_field_synonyms(
        self,
    ) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        selected = SmokePipeline._related_links(
            None,
            [
                (
                    "https://example.edu/application-materials/",
                    "Application materials and credentials",
                ),
                (
                    "https://example.edu/estimated-expenses/",
                    "Estimated expenses and student budget",
                ),
                (
                    "https://example.edu/key-dates/",
                    "Admissions timeline and key dates",
                ),
                (
                    "https://example.edu/assistantships/",
                    "Fellowships and assistantships",
                ),
                (
                    "https://example.edu/plan-of-study/",
                    "Plan of study and course sequence",
                ),
            ],
            seed,
            "https://example.edu/programmes/data-science",
            "master",
        )
        self.assertEqual(len(selected), 5)
        self.assertIn(
            "https://example.edu/application-materials/", selected
        )
        self.assertIn(
            "https://example.edu/estimated-expenses/", selected
        )
        self.assertIn("https://example.edu/key-dates/", selected)
        self.assertIn("https://example.edu/assistantships/", selected)
        self.assertIn("https://example.edu/plan-of-study/", selected)

    def test_discovery_only_run_writes_bounded_artifacts(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
            catalogue_hints=("https://example.edu/programmes/",),
            programme_priorities=(
                ProgrammePriority(
                    source="IPEDS:C2024_A:2023-24",
                    rank=1,
                    label="Alpha",
                    taxonomy_code="11.0101",
                    completions_total=20,
                    degree_completions=(("bachelor", 20),),
                ),
            ),
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="offline-integration",
            institutions=(seed,),
            limits=CrawlLimits(
                institution_concurrency=1,
                min_request_interval_seconds=0,
                max_deep_programmes_per_institution=2,
            ),
        )
        candidates = [
            ProgrammeCandidate(
                "https://example.edu/programmes/alpha-bsc",
                "Alpha BSc",
                "fixture",
                7,
            ),
            ProgrammeCandidate(
                "https://example.edu/programmes/beta-msc",
                "Beta MSc",
                "fixture",
                7,
            ),
        ]
        policy_check = PolicyCheck(
            institution_id=seed.institution_id,
            domain=seed.official_domain,
            robots_url="https://www.example.edu/robots.txt",
            robots_reachable=True,
            robots_allowed=True,
            terms_status="APPROVED",
            terms_url=None,
            policy_status=PolicyStatus.ALLOWED,
        )
        fake_policy = SimpleNamespace(
            check=policy_check,
            allows=lambda _url, _agent: True,
        )

        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "run"
            pipeline = SmokePipeline(
                config,
                run_dir,
                allow_unreviewed_terms=False,
                discovery_only=True,
                show_progress=True,
            )
            pipeline.discovery.discover = mock.Mock(
                return_value=(candidates, [], [])
            )

            def fake_source(_seed, _policy, url):
                canonical = canonicalize_url(url)
                return (
                    None,
                    ExtractionSource(
                        url=canonical,
                        page_type="programme_overview",
                        title="Fixture programme",
                        text="Fixture programme data.",
                        content_hash=canonical,
                    ),
                    [],
                )

            pipeline._fetch_and_parse_source = fake_source
            progress_output = io.StringIO()
            with contextlib.redirect_stderr(progress_output):
                with mock.patch(
                    "glowbal_ingestion.pipeline.check_policy",
                    return_value=fake_policy,
                ):
                    metrics = pipeline.run()

            self.assertEqual(metrics["institutions_completed"], 1)
            self.assertEqual(metrics["programmes_discovered"], 2)
            assertions = (
                run_dir / "field_assertions.jsonl"
            ).read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(assertions), len(DEEP_FIELDS) * 2)
            self.assertTrue((run_dir / "manifest.json").exists())
            self.assertTrue((run_dir / "coverage_report.json").exists())
            admission_report = json.loads(
                (
                    run_dir / "admission_package_report.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(admission_report["programme_count"], 2)
            self.assertEqual(
                admission_report["decision_counts"],
                {"APPLICANT_DATA_REQUIRED": 2},
            )
            selection_report = json.loads(
                (
                    run_dir / "programme_selection_report.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(selection_report["candidate_count"], 2)
            self.assertEqual(
                selection_report["ipeds_matched_candidate_count"],
                1,
            )
            alpha_selection = next(
                item
                for item in selection_report["programmes"]
                if item["programme_name"] == "Alpha BSc"
            )
            self.assertEqual(
                alpha_selection["selection_basis"],
                "ipeds_completions_priority",
            )
            self.assertEqual(
                alpha_selection["ipeds_priority"]["degree_completions"],
                20,
            )
            self.assertTrue(
                (run_dir.parent / "_cache" / "deepseek_cache.sqlite").exists()
            )
            review_queue = json.loads(
                (run_dir / "review_queue.json").read_text(encoding="utf-8")
            )
            self.assertEqual(review_queue["programme_count"], 2)
            self.assertEqual(
                set(review_queue["programmes"][0]["fields"]),
                set(DEEP_FIELDS),
            )
            report = json.loads(
                (run_dir / "coverage_report.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                report["coverage"]["unique_field_slots"],
                len(DEEP_FIELDS) * 2,
            )
            self.assertEqual(
                report["coverage"]["non_null_field_slots"],
                0,
            )
            self.assertIn("1/1 institutions", progress_output.getvalue())
            self.assertIn("Run finished", progress_output.getvalue())


class ReviewApprovalTests(unittest.TestCase):
    def _write_review_artifacts(
        self,
        root: Path,
        *,
        value: object,
        decision: str,
    ) -> tuple[Path, Path]:
        run_dir = root / "review-run"
        run_dir.mkdir()
        fingerprint = "5766bdfd-8cd4-53e6-b2be-b7f16d3b888f"
        assertion_id = "98f8b1eb-d2e9-5a1e-b789-5e0748adcd53"
        queue = {
            "schema_version": "GlowBalReviewQueue/v2",
            "review_groups": [
                {
                    "review_fingerprint": fingerprint,
                    "field_name": "toefl",
                    "value": value,
                    "source_url": "https://example.edu/admissions",
                    "evidence": "Official admission requirement.",
                    "members": [{"assertion_id": assertion_id}],
                }
            ],
        }
        queue_path = run_dir / "review_queue.json"
        queue_path.write_text(json.dumps(queue), encoding="utf-8")
        csv_path = root / "review.csv"
        with csv_path.open(
            "w", encoding="utf-8-sig", newline=""
        ) as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=[
                    "run_key",
                    "review_fingerprint",
                    "field_name",
                    "assertion_ids",
                    "value_json",
                    "evidence",
                    "source_url",
                    "decision",
                    "reviewer_notes",
                ],
            )
            writer.writeheader()
            writer.writerow(
                {
                    "run_key": "review-run",
                    "review_fingerprint": fingerprint,
                    "field_name": "toefl",
                    "assertion_ids": assertion_id,
                    "value_json": json.dumps(value),
                    "evidence": "Official admission requirement.",
                    "source_url": "https://example.edu/admissions",
                    "decision": decision,
                    "reviewer_notes": "",
                }
            )
        return csv_path, queue_path

    def test_review_decision_aliases_are_normalized(self) -> None:
        self.assertEqual(
            normalize_review_decision("Duyệt"),
            ("approved", "structured"),
        )
        self.assertEqual(
            normalize_review_decision("Trích dẫn"),
            ("approved", "source_excerpt"),
        )
        self.assertEqual(
            normalize_review_decision("Ẩn"),
            ("approved", "hidden"),
        )

    def test_review_csv_must_exactly_match_queue(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            csv_path, queue_path = self._write_review_artifacts(
                Path(temporary),
                value={"minimum": 100},
                decision="Duyệt",
            )
            run_key, decisions = load_review_decisions(
                csv_path, queue_path
            )
        self.assertEqual(run_key, "review-run")
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0].display_mode, "structured")

    def test_semantically_empty_review_cannot_be_structured(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            csv_path, queue_path = self._write_review_artifacts(
                Path(temporary),
                value={"minimum": None, "subscores": []},
                decision="Duyệt",
            )
            with self.assertRaisesRegex(
                ReviewApprovalError, "semantically empty"
            ):
                load_review_decisions(csv_path, queue_path)

            with csv_path.open(
                "r", encoding="utf-8-sig", newline=""
            ) as handle:
                rows = list(csv.DictReader(handle))
                fieldnames = list(rows[0])
            rows[0]["decision"] = "Ẩn"
            with csv_path.open(
                "w", encoding="utf-8-sig", newline=""
            ) as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            _, decisions = load_review_decisions(csv_path, queue_path)
        self.assertEqual(decisions[0].display_mode, "hidden")


class ProductExportTests(unittest.TestCase):
    def test_product_contract_filters_review_modes_and_eligibility(
        self,
    ) -> None:
        programme_id = "6b82ad55-7d0f-5d30-aea5-331a881403ff"
        common = {
            "entity_type": "programme",
            "entity_id": programme_id,
            "source_url": "https://example.edu/admissions",
            "scope": "programme",
            "audience": "international",
            "academic_cycle": "2026-2027",
            "retrieved_at": "2026-07-29T00:00:00+00:00",
            "is_effective": True,
        }
        assertions = [
            {
                **common,
                "assertion_id": "structured",
                "field_name": "recommendation_letters",
                "value_json": {
                    "requirement_status": "required",
                    "required_count": 2,
                },
                "evidence": "Two recommendations are required.",
                "verification_status": "HUMAN_VERIFIED",
            },
            {
                **common,
                "assertion_id": "excerpt",
                "field_name": "admission_difficulty",
                "value_json": {"acceptance_rate": None},
                "evidence": "Admission is highly selective.",
                "verification_status": "NEEDS_REVIEW",
            },
            {
                **common,
                "assertion_id": "hidden",
                "field_name": "graduation_certificate",
                "value_json": {"requirement_status": "unknown"},
                "evidence": "Bachelor degree programme.",
                "verification_status": "NEEDS_REVIEW",
            },
            {
                **common,
                "assertion_id": "unreviewed_source",
                "field_name": "tuition",
                "value_json": {"amount": "varies by programme"},
                "evidence": "Tuition varies by programme and academic year.",
                "verification_status": "NEEDS_REVIEW",
            },
            {
                **common,
                "assertion_id": "verified_tuition",
                "field_name": "tuition",
                "value_json": {
                    "amount": 50000,
                    "currency": "USD",
                    "fee_period": "year",
                },
                "evidence": "Annual tuition is USD 50,000.",
                "verification_status": "HUMAN_VERIFIED",
            },
            {
                **common,
                "assertion_id": "restricted_fee",
                "field_name": "additional_fees",
                "value_json": {
                    "fee_name": "Visiting Summer Intern (VSI) Fee",
                    "amount": 1040,
                    "currency": "USD",
                    "audience": "all",
                },
                "evidence": "Visiting Summer Intern (VSI) Fee $1,040",
                "verification_status": "HUMAN_VERIFIED",
            },
            {
                **common,
                "assertion_id": "unsupported_cycle",
                "field_name": "academic_cycle",
                "value_json": "2026-2027",
                "evidence": "Standard Application Deadline - November 1",
                "verification_status": "RULE_VALIDATED",
            },
            {
                **common,
                "assertion_id": "wrong_programme_source",
                "field_name": "programme_focus",
                "value_json": "General management",
                "source_url": "https://example.edu/mba",
                "evidence": "The MBA develops general management leaders.",
                "verification_status": "RULE_VALIDATED",
            },
            {
                **common,
                "assertion_id": "not_published",
                "field_name": "scholarships",
                "value_json": None,
                "null_reason": "NOT_PUBLISHED",
                "evidence": None,
                "source_url": "https://example.edu/cs",
                "verification_status": "RULE_VALIDATED",
            },
            {
                **common,
                "assertion_id": "empty",
                "field_name": "toefl",
                "value_json": {"minimum": None},
                "evidence": "",
                "verification_status": "HUMAN_VERIFIED",
            },
            {
                **common,
                "assertion_id": "unsafe_precollege_deadline",
                "field_name": "final_deadline",
                "value_json": "September 11, 2026",
                "source_url": (
                    "https://precollege.example.edu/admissions/deadlines"
                ),
                "evidence": (
                    "The application deadline is September 11, 2026."
                ),
                "verification_status": "NEEDS_REVIEW",
            },
        ]
        reviews = [
            {
                "assertion_id": "excerpt",
                "status": "approved",
                "resolution": {
                    "decision": "approved",
                    "display_mode": "source_excerpt",
                    "use_for_eligibility": False,
                },
            },
            {
                "assertion_id": "hidden",
                "status": "approved",
                "resolution": {
                    "decision": "approved",
                    "display_mode": "hidden",
                    "use_for_eligibility": False,
                },
            },
        ]
        dataset = build_product_dataset(
            run={
                "id": "run-id",
                "run_key": "run-key",
                "status": "approved",
            },
            institutions=[
                {
                    "institution_id": "example-us",
                    "canonical_name": "Example University",
                    "country_code": "US",
                    "official_url": "https://example.edu/",
                    "payload": {},
                }
            ],
            programmes=[
                {
                    "programme_id": programme_id,
                    "institution_id": "example-us",
                    "programme_name": "Computer Science",
                    "official_url": "https://example.edu/cs",
                    "degree_level": "bachelor",
                    "credential": "BS",
                    "normalized_field": "computer_science",
                },
                {
                    "programme_id": "mba-programme",
                    "institution_id": "example-us",
                    "programme_name": "MBA",
                    "official_url": "https://example.edu/mba",
                    "degree_level": "master",
                    "credential": "MBA",
                    "normalized_field": "business",
                },
            ],
            assertions=assertions,
            review_items=reviews,
            admission_requirements=[
                {
                    "programme_id": programme_id,
                    "document_type": "recommendation_letter",
                    "source_field": "recommendation_letters",
                    "requirement_status": "required",
                    "required_count": 2,
                    "count_scope": "document_total",
                    "application_stage": "initial_application",
                    "accepted_alternatives": [],
                    "components": [],
                },
                {
                    "programme_id": programme_id,
                    "document_type": "graduation_certificate",
                    "source_field": "graduation_certificate",
                    "requirement_status": "unknown",
                    "required_count": None,
                    "count_scope": "document_total",
                    "application_stage": "unknown",
                    "accepted_alternatives": [],
                    "components": [],
                },
            ],
            local_profiles={
                "example-us": {
                    "fields": {"mission": "Educate for public service."},
                    "source_urls": ["https://example.edu/about"],
                    "retrieved_at": "2026-07-29T00:00:00+00:00",
                }
            },
        )
        institution = dataset["institutions"][0]
        self.assertEqual(
            institution["fields"]["mission"][0]["display_mode"],
            "source_excerpt",
        )
        programme = institution["programmes"][0]
        self.assertIn("recommendation_letters", programme["fields"])
        excerpt = programme["fields"]["admission_difficulty"][0]
        self.assertEqual(excerpt["display_mode"], "source_excerpt")
        self.assertNotIn("value", excerpt)
        tuition_facts = programme["fields"]["tuition"]
        unreviewed = next(
            fact
            for fact in tuition_facts
            if fact["display_mode"] == "source_excerpt"
        )
        self.assertEqual(unreviewed["display_mode"], "source_excerpt")
        self.assertEqual(unreviewed["verification_status"], "NEEDS_REVIEW")
        self.assertFalse(unreviewed["use_for_eligibility"])
        verified_tuition = next(
            fact
            for fact in tuition_facts
            if fact["display_mode"] == "structured"
        )
        self.assertFalse(verified_tuition["use_for_eligibility"])
        self.assertNotIn("additional_fees", programme["fields"])
        self.assertNotIn("academic_cycle", programme["fields"])
        self.assertNotIn("programme_focus", programme["fields"])
        not_published = programme["fields"]["scholarships"][0]
        self.assertEqual(not_published["value"], None)
        self.assertEqual(
            not_published["extraction_status"],
            "NOT_PUBLISHED",
        )
        self.assertEqual(
            not_published["display_mode"],
            "not_published",
        )
        self.assertFalse(not_published["use_for_eligibility"])
        self.assertNotIn("graduation_certificate", programme["fields"])
        self.assertNotIn("toefl", programme["fields"])
        self.assertNotIn("final_deadline", programme["fields"])
        requirements = programme["admission_package"]["requirements"]
        self.assertEqual(len(requirements), 1)
        self.assertEqual(
            requirements[0]["document_type"],
            "recommendation_letter",
        )


if __name__ == "__main__":
    unittest.main()
