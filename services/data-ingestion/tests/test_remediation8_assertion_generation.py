import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.run_phase3f_v3_benchmark import _project_output  # noqa: E402
from glowbal_ingestion.models import DEEP_FIELDS, EXTRACTION_FIELD_GROUPS  # noqa: E402


PROGRAMME_URL = "https://example.edu/programmes/data-science"


def _assertion(field_name: str, value: object, evidence: str) -> dict[str, object]:
    return {
        "assertion_id": f"assertion-{field_name}",
        "entity_id": "programme-1",
        "field_name": field_name,
        "value_json": value,
        "verification_status": "RULE_VALIDATED",
        "validation_errors": [],
        "evidence": evidence,
        "raw_document_id": "raw-1",
        "source_url": PROGRAMME_URL,
        "source_authority": "OFFICIAL",
        "source_relationship": "DIRECT_OFFICIAL",
        "scope": "programme",
        "audience": "international",
        "academic_cycle": "2026-2027",
        "temporal_state": "CURRENT",
        "applicability_state": "APPLICABLE",
        "confidence": 1.0,
    }


class Remediation8AssertionGenerationTests(unittest.TestCase):
    def _project(self, programme: dict[str, object], assertions: list[dict[str, object]]) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            source = {
                "url": PROGRAMME_URL,
                "canonical_url": PROGRAMME_URL,
                "raw_document_id": "raw-1",
                "text_length": 100,
            }
            files = {
                "programmes.jsonl": [programme],
                "sources.jsonl": [source],
                "effective_field_assertions.jsonl": assertions,
                "quality_coverage_assessments.jsonl": [],
                "quality_conflicts.jsonl": [],
                "crawl_errors.jsonl": [],
            }
            for filename, records in files.items():
                (pipeline_dir / filename).write_text(
                    "".join(json.dumps(record) + "\n" for record in records),
                    encoding="utf-8",
                )
            return _project_output(
                run_id="remediation8-projection-test",
                pipeline_dir=pipeline_dir,
                rows=[
                    {
                        "row": 1,
                        "url": PROGRAMME_URL,
                        "institution": "Example",
                        "target_cycle": "2026-2027 / international",
                        "source_codes": ["main"],
                    }
                ],
                source_register={"main": PROGRAMME_URL},
                raw_evidence_mode="remote",
            )

    def test_identity_and_credential_are_routed_as_factual_fields(self) -> None:
        self.assertIn("programme_identity", DEEP_FIELDS)
        self.assertIn("credential", DEEP_FIELDS)
        self.assertIn("programme_identity", EXTRACTION_FIELD_GROUPS["identity_offering"])
        self.assertIn("credential", EXTRACTION_FIELD_GROUPS["identity_offering"])
        grouped = [
            field_name
            for fields in EXTRACTION_FIELD_GROUPS.values()
            for field_name in fields
        ]
        self.assertEqual(len(grouped), len(set(grouped)))

    def test_all_critical_fields_have_an_extraction_route(self) -> None:
        critical_fields = {
            "programme_identity",
            "credential",
            "programme_status",
            "tuition",
            "application_deadline",
            "english_requirement",
            "major_admissions_requirement",
        }
        routed_fields = set().union(*EXTRACTION_FIELD_GROUPS.values())
        aggregate_components = {
            "application_deadline": {
                "priority_deadline",
                "final_deadline",
                "funding_deadline",
                "international_deadline",
            },
            "english_requirement": {
                "ielts_overall",
                "ielts_subscores",
                "toefl",
                "duolingo",
            },
            "major_admissions_requirement": {
                "minimum_degree",
                "minimum_gpa",
                "subject_prerequisites",
                "standardized_tests",
                "work_experience",
                "portfolio",
                "required_documents",
                "recommendation_letters",
                "sop_essay_requirements",
            },
        }
        for field_name in critical_fields:
            route = aggregate_components.get(field_name, {field_name})
            self.assertTrue(route <= routed_fields, field_name)
            self.assertTrue(route <= set(DEEP_FIELDS), field_name)

    def test_routing_metadata_alone_does_not_create_factual_assertions(self) -> None:
        output = self._project(
            {
                "programme_id": "programme-1",
                "programme_name": "Data Science",
                "official_url": PROGRAMME_URL,
                # This metadata is deliberately not a factual assertion.
                "credential": "MSc",
                "degree_level": "master",
            },
            [],
        )
        projected = {
            item["field"]: item
            for item in output["records"]
            if item["field"] in {"programme_identity", "credential"}
        }
        self.assertNotEqual(projected["programme_identity"]["state"], "FOUND")
        self.assertNotEqual(projected["credential"]["state"], "FOUND")
        self.assertIsNone(projected["programme_identity"]["value"])
        self.assertIsNone(projected["credential"]["value"])

    def test_source_backed_identity_and_native_credential_reach_projection(self) -> None:
        output = self._project(
            {
                "programme_id": "programme-1",
                "programme_name": "Data Science",
                "official_url": PROGRAMME_URL,
                "credential": None,
                "degree_level": "master",
            },
            [
                _assertion(
                    "programme_identity",
                    "Data Science",
                    "Data Science — Master of Science (MSc)",
                ),
                _assertion(
                    "credential",
                    "MSc",
                    "Data Science — Master of Science (MSc)",
                ),
            ],
        )
        projected = {
            item["field"]: item
            for item in output["records"]
            if item["field"] in {"programme_identity", "credential"}
        }
        self.assertEqual(projected["programme_identity"]["state"], "FOUND")
        self.assertEqual(projected["credential"]["state"], "FOUND")
        self.assertEqual(projected["programme_identity"]["value"], "Data Science")
        self.assertEqual(projected["credential"]["value"], "MSc")

    def test_undated_native_credential_is_retained_but_not_projected_found(self) -> None:
        candidate = _assertion(
            "credential",
            "Baccalaureat",
            "Baccalaureat en informatique",
        )
        candidate["temporal_state"] = "UNKNOWN"
        candidate["academic_cycle"] = None
        output = self._project(
            {
                "programme_id": "programme-1",
                "programme_name": "Computer Science",
                "official_url": PROGRAMME_URL,
                "credential": None,
                "degree_level": "bachelor",
            },
            [candidate],
        )
        projected = next(
            item for item in output["records"] if item["field"] == "credential"
        )
        self.assertEqual(projected["state"], "NEEDS_REVIEW")
        self.assertIsNone(projected["value"])
        self.assertEqual(projected["lifecycle"]["selected_candidate_count"], 1)


if __name__ == "__main__":
    unittest.main()
