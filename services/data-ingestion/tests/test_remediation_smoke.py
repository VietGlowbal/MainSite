from __future__ import annotations

import sys
import tempfile
import unittest
import json
from types import SimpleNamespace
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from glowbal_ingestion.config import InstitutionSeed, SmokeConfig  # noqa: E402
from glowbal_ingestion.deepseek import DeepSeekClient  # noqa: E402
from glowbal_ingestion.discovery import CatalogueDiscovery, ProgrammeCandidate  # noqa: E402
from glowbal_ingestion.extraction_provider import ExtractionSource  # noqa: E402
from glowbal_ingestion.models import PageType  # noqa: E402
from glowbal_ingestion.normalization import candidate_to_programme  # noqa: E402
from glowbal_ingestion.pipeline import SmokePipeline, fields_requiring_llm  # noqa: E402
from glowbal_ingestion.fetcher import FetchError  # noqa: E402
from glowbal_ingestion.parser_registry import ParserError  # noqa: E402
from glowbal_ingestion.storage import StateStore  # noqa: E402
from glowbal_ingestion.validation import fact_to_assertion  # noqa: E402
from scripts.run_phase3f_v3_benchmark import (  # noqa: E402
    CONTRACT_MARKDOWN_PATH,
    ROSTER_PATH,
    _parse_roster,
    _project_output,
    _runtime_state_from_errors,
    _state_for_assertions,
    build_execution_config,
)


class RemediationSmokeTests(unittest.TestCase):
    def test_deterministic_first_fallback_only_requests_unresolved_fields(self) -> None:
        requested = fields_requiring_llm(
            ("programme_status", "tuition"),
            [
                {
                    "field_name": "programme_status",
                    "value": "active",
                }
            ],
        )
        self.assertEqual(requested, ("tuition",))
        self.assertEqual(
            fields_requiring_llm(
                ("programme_status",),
                [],
            ),
            ("programme_status",),
        )

    def test_manual_roster_target_does_not_bootstrap_credential_metadata(self) -> None:
        rows, source_register = _parse_roster(ROSTER_PATH)
        config = build_execution_config(rows[:1], source_register)
        self.assertTrue(config.institutions)
        self.assertTrue(
            all(
                not metadata
                for seed in config.institutions
                for metadata in seed.programme_metadata.values()
            )
        )
        programme = candidate_to_programme(
            "example",
            ProgrammeCandidate(
                "https://example.edu/programmes/data-science-msc",
                None,
                "user_supplied",
                100,
            ),
        )
        self.assertIsNone(programme.credential)

    def test_robots_blocked_manual_target_remains_terminal_routing_candidate(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://www.example.edu/",
            manual_programme_urls=(
                "https://www.example.edu/programmes/data-science",
            ),
            manual_only=True,
        )
        fetcher = SimpleNamespace(limits=SimpleNamespace(user_agent="test"))
        policy = SimpleNamespace(allows=lambda _url, _agent: False)
        candidates, sitemaps, errors = CatalogueDiscovery(fetcher).discover(seed, policy)
        self.assertEqual([candidate.url for candidate in candidates], [seed.manual_programme_urls[0]])
        self.assertEqual(sitemaps, [])
        self.assertEqual(errors, [f"{seed.manual_programme_urls[0]}: BLOCKED_BY_ROBOTS"])

    def test_value_survives_fact_assertion_serialization_and_projection(self) -> None:
        source = ExtractionSource(
            url="https://example.edu/programmes/data-science",
            page_type=PageType.PROGRAMME_OVERVIEW.value,
            title="Data Science",
            text="Data Science curriculum includes statistics.",
            content_hash="a" * 64,
            raw_document_id="raw-1",
            parser_id="html",
            parser_version="1",
        )
        assertion = fact_to_assertion(
            entity_id="programme-1",
            fact={
                "field_name": "programme_focus",
                "value": {"description": "Data Science curriculum"},
                "source_url": source.url,
                "source_type": PageType.PROGRAMME_OVERVIEW.value,
                "evidence": "Data Science curriculum includes statistics.",
                "scope": "programme",
                "audience": "all",
                "confidence": 0.9,
                "_provider_id": "openai_compatible",
                "_model_name": "deepseek/deepseek-v4-flash",
            },
            source_map={source.url: source},
            model_name="deepseek/deepseek-v4-flash",
            extractor_version="test",
            programme_degree="master",
            programme_name="Data Science",
            programme_url=source.url,
        )
        serialized = assertion.to_dict()
        self.assertEqual(
            serialized["value_json"],
            {"description": "Data Science curriculum"},
        )
        state, value, _ = _state_for_assertions([serialized])
        self.assertEqual(state, "FOUND")
        self.assertEqual(value, {"description": "Data Science curriculum"})

    def test_semantically_unsafe_candidate_is_not_projected_as_runtime_value(self) -> None:
        state, value, _ = _state_for_assertions(
            [
                {
                    "verification_status": "NEEDS_REVIEW",
                    "value_json": {"amount": 1000, "currency": "USD"},
                    "evidence": "a source excerpt without complete scope",
                    "raw_document_id": "raw-1",
                    "validation_errors": ["SOURCE_EXCERPT_ONLY"],
                }
            ]
        )
        self.assertEqual(state, "NEEDS_REVIEW")
        self.assertIsNone(value)

        state, value, _ = _state_for_assertions(
            [
                {
                    "verification_status": "NEEDS_REVIEW",
                    "value_json": None,
                    "null_reason": "AMBIGUOUS",
                }
            ]
        )
        self.assertEqual(state, "NEEDS_REVIEW")
        self.assertIsNone(value)

    def test_supported_review_candidate_is_runtime_found_but_not_product_safe(self) -> None:
        state, value, selected = _state_for_assertions(
            [
                {
                    "assertion_id": "assertion-1",
                    "verification_status": "NEEDS_REVIEW",
                    "value_json": {"status": "active"},
                    "evidence": "The programme is currently active.",
                    "raw_document_id": "raw-1",
                    "source_authority": "OFFICIAL",
                    "academic_cycle": "2026-2027",
                    "audience": "international",
                    "temporal_state": "CURRENT",
                    "applicability_state": "APPLICABLE",
                    "validation_errors": [],
                }
            ],
            target_cycle="2026-2027",
            audience="international",
        )
        self.assertEqual(state, "FOUND")
        self.assertEqual(value, {"status": "active"})
        self.assertEqual(selected[0]["assertion_id"], "assertion-1")

    def test_provider_failure_is_extraction_failure_not_parser_failure(self) -> None:
        programme = SimpleNamespace(degree_level="master")
        self.assertEqual(
            SmokePipeline._missing_field_reason(
                programme,
                "tuition",
                {"finance"},
            ).value,
            "EXTRACTION_FAILED",
        )

    def test_only_genuine_parser_failure_maps_to_parse_failed(self) -> None:
        pipeline = object.__new__(SmokePipeline)

        class BrokenParser:
            @staticmethod
            def parse(_raw, _payload):
                raise ParserError("fixture parser failure")

        pipeline.parser_registry = BrokenParser()
        with self.assertRaises(FetchError) as raised:
            pipeline._parse_document(
                SimpleNamespace(canonical_url="https://example.edu/source"),
                b"bad",
            )
        self.assertEqual(raised.exception.code, "PARSE_FAILED")
        self.assertFalse(raised.exception.retryable)

    def test_runtime_failure_is_not_evaluated_only_when_no_failure_exists(self) -> None:
        self.assertEqual(
            _runtime_state_from_errors(
                [{"error_code": "BLOCKED_BY_ROBOTS", "stage": "deep_fetch"}]
            ),
            "ACCESS_BLOCKED",
        )
        self.assertEqual(
            _runtime_state_from_errors(
                [{"error_code": "EXTRACTION_FAILED", "stage": "extraction_provider"}]
            ),
            "EXTRACTION_FAILED",
        )
        self.assertEqual(
            _runtime_state_from_errors(
                [{"error_code": "RATE_LIMITED", "stage": "extraction_provider"}]
            ),
            "EXTRACTION_FAILED",
        )
        self.assertIsNone(_runtime_state_from_errors([]))

    def test_blocked_routed_programme_does_not_fall_back_to_not_evaluated(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            blocked_url = "https://example.edu/programmes/blocked"
            (pipeline_dir / "programmes.jsonl").write_text("", encoding="utf-8")
            (pipeline_dir / "sources.jsonl").write_text("", encoding="utf-8")
            (pipeline_dir / "effective_field_assertions.jsonl").write_text("", encoding="utf-8")
            (pipeline_dir / "quality_coverage_assessments.jsonl").write_text("", encoding="utf-8")
            (pipeline_dir / "quality_conflicts.jsonl").write_text("", encoding="utf-8")
            (pipeline_dir / "crawl_errors.jsonl").write_text(
                json.dumps(
                    {
                        "url": blocked_url,
                        "stage": "deep_fetch",
                        "error_code": "BLOCKED_BY_ROBOTS",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            output = _project_output(
                run_id="blocked-projection-test",
                pipeline_dir=pipeline_dir,
                rows=[
                    {
                        "row": 1,
                        "url": blocked_url,
                        "institution": "Example",
                        "target_cycle": "2026-2027 / international",
                        "source_codes": ["main"],
                    }
                ],
                source_register={"main": blocked_url},
                raw_evidence_mode="local",
            )
            states = {
                item["state"]
                for item in output["records"]
                if item["field"] not in {"programme_identity", "credential"}
            }
            self.assertEqual(states, {"ACCESS_BLOCKED"})

    def test_parsed_source_without_value_leaves_not_evaluated(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            programme_url = "https://example.edu/programmes/data-science"
            files = {
                "programmes.jsonl": [
                    {
                        "programme_id": "programme-1",
                        "programme_name": "Data Science",
                        "official_url": programme_url,
                        "credential": None,
                    }
                ],
                "sources.jsonl": [
                    {
                        "url": programme_url,
                        "canonical_url": programme_url,
                        "text_length": 640,
                        "parser_id": "html-visible-text",
                        "parser_version": "1",
                        "raw_document_id": "raw-1",
                    }
                ],
                "effective_field_assertions.jsonl": [],
                "quality_coverage_assessments.jsonl": [],
                "quality_conflicts.jsonl": [],
                "crawl_errors.jsonl": [],
            }
            for filename, records in files.items():
                (pipeline_dir / filename).write_text(
                    "".join(json.dumps(record) + "\n" for record in records),
                    encoding="utf-8",
                )
            output = _project_output(
                run_id="parsed-frontier-test",
                pipeline_dir=pipeline_dir,
                rows=[
                    {
                        "row": 1,
                        "url": programme_url,
                        "institution": "Example",
                        "target_cycle": "2026-2027 / international",
                        "source_codes": ["main"],
                    }
                ],
                source_register={"main": programme_url},
                raw_evidence_mode="local",
            )
            status = next(
                item
                for item in output["records"]
                if item["field"] == "programme_status"
            )
            self.assertEqual(status["state"], "NEEDS_REVIEW")
            self.assertEqual(status["lifecycle"]["field_evaluation_attempted"], True)
            self.assertEqual(status["lifecycle"]["parser_status"], "PARSED_NON_EMPTY")

    def test_projection_retains_supported_value_when_product_safety_is_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            programme = {
                "programme_id": "programme-1",
                "programme_name": "Data Science",
                "official_url": "https://example.edu/programmes/data-science",
                "credential": None,
            }
            source = {
                "url": programme["official_url"],
                "canonical_url": programme["official_url"],
                "raw_document_id": "raw-1",
            }
            assertion = {
                "assertion_id": "assertion-1",
                "entity_id": "programme-1",
                "field_name": "programme_status",
                "value_json": {"status": "active"},
                "verification_status": "NEEDS_REVIEW",
                "validation_errors": [],
                "evidence": "The programme is currently active.",
                "raw_document_id": "raw-1",
                "source_url": programme["official_url"],
                "source_authority": "OFFICIAL",
                "academic_cycle": "2026-2027",
                "audience": "international",
                "temporal_state": "CURRENT",
                "applicability_state": "APPLICABLE",
                "confidence": 0.9,
            }

            for filename, records in {
                "programmes.jsonl": [programme],
                "sources.jsonl": [source],
                "effective_field_assertions.jsonl": [assertion],
                "quality_coverage_assessments.jsonl": [],
                "quality_conflicts.jsonl": [],
                "crawl_errors.jsonl": [],
            }.items():
                (pipeline_dir / filename).write_text(
                    "".join(json.dumps(record) + "\n" for record in records),
                    encoding="utf-8",
                )
            rows = [
                {
                    "row": 1,
                    "url": programme["official_url"],
                    "institution": "Example",
                    "target_cycle": "2026-2027 / international",
                    "source_codes": ["main"],
                }
            ]
            output = _project_output(
                run_id="projection-test",
                pipeline_dir=pipeline_dir,
                rows=rows,
                source_register={"main": programme["official_url"]},
                raw_evidence_mode="local",
            )
            record = next(
                item for item in output["records"] if item["field"] == "programme_status"
            )
            self.assertEqual(record["state"], "FOUND")
            self.assertEqual(record["value"], {"status": "active"})
            self.assertNotEqual(record["product_state"], "PRODUCT_SAFE")
            self.assertIn("IDENTITY_UNRESOLVED", record["blockers"])
            self.assertIn("REVIEW_REQUIRED", record["blockers"])
            self.assertEqual(record["quality"]["canonical_promotion"], False)

    def test_projection_scopes_unresolved_conflicts_to_their_entity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            programmes = [
                {
                    "programme_id": "programme-1",
                    "programme_name": "Conflicted Programme",
                    "official_url": "https://one.example.edu/programmes/a",
                    "credential": None,
                    "degree_level": "master",
                },
                {
                    "programme_id": "programme-2",
                    "programme_name": "Supported Programme",
                    "official_url": "https://two.example.edu/programmes/b",
                    "credential": None,
                    "degree_level": "master",
                },
            ]
            supported_url = programmes[1]["official_url"]
            supported_assertion = {
                "assertion_id": "assertion-supported",
                "entity_id": "programme-2",
                "field_name": "tuition",
                "value_json": {
                    "amount": 24000,
                    "currency": "USD",
                    "fee_period": "academic year",
                },
                "verification_status": "NEEDS_REVIEW",
                "validation_errors": [],
                "evidence": "Supported Programme tuition for the 2026-2027 academic year is USD 24,000.",
                "raw_document_id": "raw-supported",
                "source_url": supported_url,
                "source_authority": "OFFICIAL",
                "scope": "programme",
                "audience": "international",
                "academic_cycle": "2026-2027",
                "temporal_state": "CURRENT",
                "applicability_state": "APPLICABLE",
                "confidence": 0.9,
            }
            conflicts = [
                {
                    "conflict_id": "conflict-only-programme-1",
                    "entity_id": "programme-1",
                    "field": "tuition",
                    "state": "NEEDS_REVIEW",
                }
            ]
            files = {
                "programmes.jsonl": programmes,
                "sources.jsonl": [
                    {
                        "url": supported_url,
                        "canonical_url": supported_url,
                        "raw_document_id": "raw-supported",
                        "text_length": 100,
                    }
                ],
                "effective_field_assertions.jsonl": [supported_assertion],
                "quality_coverage_assessments.jsonl": [],
                "quality_conflicts.jsonl": conflicts,
                "crawl_errors.jsonl": [],
            }
            for filename, records in files.items():
                (pipeline_dir / filename).write_text(
                    "".join(json.dumps(record) + "\n" for record in records),
                    encoding="utf-8",
                )
            output = _project_output(
                run_id="entity-scoped-conflict-test",
                pipeline_dir=pipeline_dir,
                rows=[
                    {
                        "row": 1,
                        "url": supported_url,
                        "institution": "Example",
                        "target_cycle": "2026-2027 / international",
                        "source_codes": ["main"],
                    }
                ],
                source_register={"main": supported_url},
                raw_evidence_mode="remote",
            )
            record = next(
                item for item in output["records"] if item["field"] == "tuition"
            )
            self.assertEqual(record["state"], "FOUND")
            self.assertEqual(record["value"]["amount"], 24000)
            self.assertNotIn("UNRESOLVED_CONFLICT", record["blockers"])

    def test_pdf_does_not_auto_escalate_from_flash_to_pro(self) -> None:
        config = SmokeConfig(run_name="flash-only", institutions=())
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
            page_type=PageType.PDF.value,
            title="Data Science MSc",
            text="Data Science MSc programme.",
            content_hash="b" * 64,
        )
        payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [],
            "warnings": [],
        }
        with tempfile.TemporaryDirectory() as temporary:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                seen: list[str] = []

                def fake_request(*, model_name, prompt, thinking):
                    del prompt, thinking
                    seen.append(model_name)
                    return payload

                client._request = fake_request
                client._extract_group(
                    programme,
                    [source],
                    "identity_offering",
                    ("programme_status",),
                    prefer_pro=False,
                )
            finally:
                state.close()
        self.assertEqual(seen, [config.deepseek_flash_model])

    def test_contract_artifact_is_not_used_by_pipeline_config(self) -> None:
        self.assertTrue(CONTRACT_MARKDOWN_PATH.exists())


if __name__ == "__main__":
    unittest.main()
