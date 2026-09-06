from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
import tempfile
from pathlib import Path

from glowbal_ingestion.acquisition import (
    AcquisitionAttempt,
    AcquisitionFailureCode,
    EntityRef,
    SourceCandidate,
)
from glowbal_ingestion.models import SourceAuthority, SourceRelationship
from glowbal_ingestion.source_adapters import AcquisitionPlanner, SourceAdapterContext, SourceRegistry
from glowbal_ingestion.source_graph import (
    admission_row,
    candidate_row,
    discovery_evidence_row,
)
from glowbal_ingestion.supabase_import import (
    _source_admission_rows,
    _source_candidate_rows,
)


class _Adapter:
    def __init__(self, adapter_id: str, priority: int) -> None:
        self.adapter_id = adapter_id
        self.priority = priority

    def supports(self, intent, context) -> bool:
        return True

    def discover(self, intent, context):
        return [SourceCandidate.create(
            canonical_locator=f"https://example.edu/{self.adapter_id}", locator_type="url",
            source_class="official_web", adapter_id=self.adapter_id,
            relationship=SourceRelationship.DIRECT_OFFICIAL,
            relationship_evidence=("fixture",), declared_authority=SourceAuthority.OFFICIAL,
        )]


class AcquisitionContractTests(unittest.TestCase):
    def test_additive_candidate_schema_keeps_provider_source_identity_opaque(self) -> None:
        migration = (
            Path(__file__).resolve().parents[3]
            / "supabase-crawl-acquisition-v3.sql"
        ).read_text(encoding="utf-8")
        self.assertIn("source_identity text", migration)
        self.assertNotIn("source_identity uuid", migration)

    def test_deterministic_records_and_failure_serialization(self) -> None:
        entity = EntityRef("PROGRAMME", "programme-1")
        first = AcquisitionPlanner().plan(entity=entity, field_groups=("tuition",))[0]
        second = AcquisitionPlanner().plan(entity=entity, field_groups=("tuition",))[0]
        self.assertEqual(first.intent_id, second.intent_id)
        attempt = AcquisitionAttempt.create(
            intent_id=first.intent_id, candidate_id=None, status="FETCH_FAILED",
            error_code=AcquisitionFailureCode.FETCH_FAILED, retryable=True,
        )
        self.assertEqual(attempt.to_dict()["error_code"], "FETCH_FAILED")

    def test_planner_is_field_directed_not_a_recursive_crawl_wrapper(self) -> None:
        entity = EntityRef("PROGRAMME", "programme-1")
        intents = AcquisitionPlanner().plan(
            entity=entity,
            field_groups=("tuition", "language", "deadline", "funding"),
            target_cycle="2026-27", audience="international",
        )
        self.assertEqual([item.field_groups for item in intents], [("tuition",), ("language",), ("deadline",), ("funding",)])
        self.assertEqual(intents[0].preferred_source_classes[0], "official_finance")
        self.assertEqual(intents[1].preferred_source_classes[0], "international_admissions")
        self.assertEqual(intents[2].preferred_source_classes[0], "central_admissions")
        self.assertEqual(intents[3].preferred_source_classes[0], "scholarship_provider")

    def test_registry_order_and_no_supported_adapter_attempt(self) -> None:
        entity = EntityRef("UNIVERSITY", "u1")
        intent = AcquisitionPlanner().plan(entity=entity, field_groups=("tuition",))[0]
        registry = SourceRegistry((_Adapter("late", 20), _Adapter("early", 10)))
        candidates, attempts = registry.discover(intent, SourceAdapterContext(entity=entity))
        self.assertEqual([candidate.adapter_id for candidate in candidates], ["early", "late"])
        empty, failures = SourceRegistry().discover(intent, SourceAdapterContext(entity=entity))
        self.assertEqual(empty, [])
        self.assertEqual(failures[0].error_code, AcquisitionFailureCode.NO_SOURCE_CANDIDATES)

    def test_candidate_id_is_stable_source_identity_not_observation_identity(self) -> None:
        first = SourceCandidate.create(
            canonical_locator="https://example.edu/program", locator_type="url", source_class="official_web", adapter_id="fixture"
        )
        second = SourceCandidate.create(
            canonical_locator="https://example.edu/program", locator_type="url", source_class="official_web", adapter_id="fixture",
            raw_document_id="a-different-observation",
        )
        self.assertEqual(first.candidate_id, second.candidate_id)
        self.assertNotEqual(second.raw_document_id, second.candidate_id)
        row = candidate_row(second, run_id="run-1")
        evidence = discovery_evidence_row(second, run_id="run-1", discovery_evidence_id="e1")
        self.assertNotIn("adapter_metadata", row)
        self.assertNotIn("payload", str(row).lower())
        self.assertEqual(evidence["source_candidate_id"], second.candidate_id)

    def test_candidate_staging_row_retains_lineage_without_raw_payload(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://example.edu/api/programme",
            locator_type="json_api",
            source_class="official_api",
            adapter_id="fixture",
            provider_id="provider",
            dataset_id="catalog-2026",
            raw_document_id="00000000-0000-0000-0000-000000000002",
        )
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            (run_dir / "source_candidates.jsonl").write_text(
                candidate.to_json() + "\n",
                encoding="utf-8",
            )
            row = next(_source_candidate_rows(
                run_dir,
                "00000000-0000-0000-0000-000000000001",
            ))
        self.assertEqual(row["provider_id"], "provider")
        self.assertEqual(row["dataset_id"], "catalog-2026")
        self.assertEqual(row["raw_document_id"], candidate.raw_document_id)
        self.assertNotIn("adapter_metadata", row)

    def test_attempt_identity_includes_adapter_discriminator(self) -> None:
        first = AcquisitionAttempt.create(
            intent_id="intent", candidate_id="candidate", status="DISCOVERY_FAILED",
            adapter_id="first", discriminator="failure",
        )
        second = AcquisitionAttempt.create(
            intent_id="intent", candidate_id="candidate", status="DISCOVERY_FAILED",
            adapter_id="second", discriminator="failure",
        )
        self.assertNotEqual(first.attempt_id, second.attempt_id)

    def test_admitted_external_domain_survives_artifact_to_import_row(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://government.example/fees",
            locator_type="url",
            source_class="government_dataset",
            adapter_id="government_fixture",
        )
        artifact = admission_row(
            SimpleNamespace(
                candidate=candidate,
                admitted=True,
                reason="ADMITTED",
                factor_scores={
                    "authority": 48,
                    "relationship": 22,
                    "temporal": 3,
                    "relevance": 5,
                    "applicability": 5,
                },
                total_score=83,
                allowed_domains=("example.edu", "government.example"),
            ),
            run_id="run-local",
            admission_decision_id="00000000-0000-0000-0000-000000000003",
            intent_id="00000000-0000-0000-0000-000000000004",
        )
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary)
            (run_dir / "source_admission_decisions.jsonl").write_text(
                json.dumps(artifact) + "\n",
                encoding="utf-8",
            )
            imported = next(_source_admission_rows(
                run_dir,
                "00000000-0000-0000-0000-000000000001",
            ))
        self.assertEqual(imported["allowed_domain"], "government.example")


if __name__ == "__main__":
    unittest.main()
