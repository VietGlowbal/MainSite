from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.run_phase3f_v3_benchmark import (  # noqa: E402
    _project_output,
    _state_for_assertions,
)
from glowbal_ingestion.runtime_acceptance import (  # noqa: E402
    projection_acceptance_reasons,
)


def assertion(
    *,
    field_name: str,
    value: object,
    evidence: str,
    component_field: str | None = None,
    scope: str = "programme",
    audience: str = "international",
    academic_cycle: str | None = "2026-2027",
    temporal_state: str = "CURRENT",
    applicability_state: str = "APPLICABLE",
    source_type: str = "programme_admission",
    source_authority: str = "OFFICIAL",
    source_relationship: str = "DIRECT_OFFICIAL",
) -> dict[str, object]:
    return {
        "assertion_id": f"assertion-{field_name}-{component_field or field_name}",
        "entity_id": "programme-1",
        "field_name": component_field or field_name,
        "value_json": value,
        "evidence": evidence,
        "raw_document_id": "raw-1",
        "source_url": "https://example.edu/programmes/data-science",
        "source_type": source_type,
        "source_authority": source_authority,
        "source_relationship": source_relationship,
        "scope": scope,
        "audience": audience,
        "academic_cycle": academic_cycle,
        "temporal_state": temporal_state,
        "applicability_state": applicability_state,
        "verification_status": "NEEDS_REVIEW",
        "validation_errors": [],
    }


class Remediation7AcceptanceTests(unittest.TestCase):
    def test_all_seven_critical_fields_have_positive_found_paths(self) -> None:
        cases = {
            "programme_status": assertion(
                field_name="programme_status",
                value="active",
                evidence="The programme is currently active.",
            ),
            "tuition": assertion(
                field_name="tuition",
                value={
                    "amount": 24000,
                    "currency": "USD",
                    "fee_period": "academic_year",
                    "academic_cycle": "2026-2027",
                },
                evidence="Tuition for the 2026-2027 academic year is USD 24,000.",
                source_type="tuition",
            ),
            "application_deadline": assertion(
                field_name="application_deadline",
                component_field="final_deadline",
                value="2026-12-01",
                evidence="The 2026-2027 application deadline is December 1, 2026.",
            ),
            "english_requirement": assertion(
                field_name="english_requirement",
                component_field="ielts_overall",
                value={"test": "IELTS", "minimum": 6.5},
                evidence="A minimum IELTS score of 6.5 is required for admission.",
            ),
            "major_admissions_requirement": assertion(
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                value={"requirement_status": "required", "details": "calculus"},
                evidence="Calculus is a required prerequisite for admission to the programme.",
            ),
        }
        for field_name, candidate in cases.items():
            state, value, _ = _state_for_assertions(
                [candidate],
                field_name=field_name,
                component_field=candidate["field_name"],
                target_cycle="2026-2027",
                audience="international",
                target_degree="master",
            )
            self.assertEqual(state, "FOUND", field_name)
            self.assertIsNotNone(value, field_name)

        with tempfile.TemporaryDirectory() as temporary:
            pipeline_dir = Path(temporary)
            programme = {
                "programme_id": "programme-1",
                "programme_name": "Data Science",
                "official_url": "https://example.edu/programmes/data-science",
                # Routing/catalogue metadata is not factual evidence.
                "credential": None,
                "degree_level": "master",
            }
            identity_assertion = assertion(
                field_name="programme_identity",
                value="Data Science",
                evidence="Data Science",
            )
            credential_assertion = assertion(
                field_name="credential",
                value="MSc",
                evidence="Master of Science (MSc)",
            )
            for filename, records in {
                "programmes.jsonl": [programme],
                "sources.jsonl": [
                    {
                        "url": programme["official_url"],
                        "canonical_url": programme["official_url"],
                        "raw_document_id": "raw-1",
                    }
                ],
                "effective_field_assertions.jsonl": [
                    identity_assertion,
                    credential_assertion,
                ],
                "quality_coverage_assessments.jsonl": [],
                "quality_conflicts.jsonl": [],
                "crawl_errors.jsonl": [],
            }.items():
                (pipeline_dir / filename).write_text(
                    "".join(json.dumps(record) + "\n" for record in records),
                    encoding="utf-8",
                )
            output = _project_output(
                run_id="identity-positive-path",
                pipeline_dir=pipeline_dir,
                rows=[
                    {
                        "row": 1,
                        "url": programme["official_url"],
                        "institution": "Example",
                        "target_cycle": "2026-2027 / international",
                        "source_codes": [],
                    }
                ],
                source_register={},
                raw_evidence_mode="local",
            )
            projected = {
                record["field"]: record
                for record in output["records"]
                if record["field"] in {"programme_identity", "credential"}
            }
            self.assertEqual(projected["credential"]["state"], "FOUND")
            self.assertEqual(projected["programme_identity"]["state"], "FOUND")

    def test_soft_product_blocker_preserves_runtime_found(self) -> None:
        candidate = assertion(
            field_name="programme_status",
            value="active",
            evidence="The programme is currently active.",
        )
        state, value, _ = _state_for_assertions(
            [candidate],
            field_name="programme_status",
            target_cycle="2026-2027",
            audience="international",
            target_degree="master",
        )
        self.assertEqual(state, "FOUND")
        self.assertEqual(value, "active")
        # Product Safety metadata is deliberately outside this acceptance
        # decision; the runtime fact remains visible when factual support is
        # sufficient.
        self.assertEqual(candidate["verification_status"], "NEEDS_REVIEW")

    def test_structured_cycle_metadata_can_support_temporal_acceptance(self) -> None:
        candidate = assertion(
            field_name="tuition",
            value={
                "amount": 33360,
                "currency": "USD",
                "fee_period": "per_term",
                "academic_cycle": "2026-2027",
            },
            evidence=(
                "For the 2026-2027 academic year, full regular graduate "
                "tuition per term is USD 33,360."
            ),
            source_type="tuition",
        )
        reasons = projection_acceptance_reasons(
            candidate,
            field_name="tuition",
            target_cycle="2026-27",
            audience="graduate international",
            target_degree="master",
        )
        self.assertNotIn("TEMPORAL_SCOPE_UNPROVEN", reasons)

    def test_value_only_cycle_does_not_prove_volatile_currentness(self) -> None:
        candidate = assertion(
            field_name="tuition",
            value={
                "amount": 33360,
                "currency": "USD",
                "fee_period": "per_term",
                "academic_cycle": "2026-2027",
            },
            academic_cycle=None,
            temporal_state="UNKNOWN",
            evidence="Full regular graduate tuition per term is USD 33,360.",
            source_type="tuition",
        )
        reasons = projection_acceptance_reasons(
            candidate,
            field_name="tuition",
            target_cycle="2026-2027",
            audience="graduate international",
            target_degree="master",
        )
        self.assertIn("TEMPORAL_SCOPE_UNPROVEN", reasons)

    def test_compound_audience_labels_match_their_audience_dimension(self) -> None:
        candidate = assertion(
            field_name="english_requirement",
            component_field="ielts_overall",
            value={"test": "IELTS", "minimum": 6.5},
            evidence="A minimum IELTS score of 6.5 is required for admission.",
        )
        reasons = projection_acceptance_reasons(
            candidate,
            field_name="english_requirement",
            component_field="ielts_overall",
            target_cycle="2026-2027",
            audience="graduate international",
            target_degree="master",
        )
        self.assertNotIn("AUDIENCE_MISMATCH", reasons)

    def test_hard_semantic_blockers_suppress_runtime_value(self) -> None:
        wrong_scope = assertion(
            field_name="tuition",
            value={"amount": 24000, "currency": "USD", "fee_period": "year"},
            evidence="The institution's estimated cost of attendance is USD 24,000.",
            scope="institution",
            academic_cycle=None,
            temporal_state="UNKNOWN",
            applicability_state="UNKNOWN",
            source_type="scholarship",
        )
        reasons = projection_acceptance_reasons(
            wrong_scope,
            field_name="tuition",
            target_cycle="2026-2027",
            target_degree="master",
        )
        self.assertIn("TUITION_SEMANTICS_NOT_IN_EVIDENCE", reasons)
        self.assertIn("TEMPORAL_SCOPE_UNPROVEN", reasons)
        state, value, _ = _state_for_assertions(
            [wrong_scope],
            field_name="tuition",
            target_cycle="2026-2027",
            audience="international",
            target_degree="master",
        )
        self.assertEqual(state, "NEEDS_REVIEW")
        self.assertIsNone(value)

    def test_field_specific_negative_semantics_remain_hard(self) -> None:
        negatives = (
            (
                "application_deadline",
                "final_deadline",
                "2026-12-01",
                "The registration deadline is December 1, 2026.",
            ),
            (
                "english_requirement",
                "ielts_overall",
                {"test": "IELTS", "minimum": 6.5},
                "The programme is taught in English; a score is recommended.",
            ),
            (
                "major_admissions_requirement",
                "subject_prerequisites",
                {"requirement_status": "required"},
                "Students declare the major after admission as part of the curriculum.",
            ),
        )
        for field_name, component, value, evidence in negatives:
            candidate = assertion(
                field_name=field_name,
                component_field=component,
                value=value,
                evidence=evidence,
            )
            state, projected, _ = _state_for_assertions(
                [candidate],
                field_name=field_name,
                component_field=component,
                target_cycle="2026-2027",
                audience="international",
                target_degree="master",
            )
            self.assertEqual(state, "NEEDS_REVIEW", field_name)
            self.assertIsNone(projected, field_name)

    def test_same_field_conflict_is_scoped_to_programme(self) -> None:
        # This is the acceptance-side invariant: different-scope programmes
        # must not become a synthetic conflict merely because their field name
        # is the same. The projection regression covers the full file path.
        candidate = assertion(
            field_name="tuition",
            value={
                "amount": 24000,
                "currency": "USD",
                "fee_period": "academic_year",
                "academic_cycle": "2026-2027",
            },
            evidence="Tuition for the 2026-2027 academic year is USD 24,000.",
            source_type="tuition",
        )
        state, value, _ = _state_for_assertions(
            [candidate],
            field_name="tuition",
            target_cycle="2026-2027",
            audience="international",
            target_degree="master",
        )
        self.assertEqual(state, "FOUND")
        self.assertIsNotNone(value)


if __name__ == "__main__":
    unittest.main()
