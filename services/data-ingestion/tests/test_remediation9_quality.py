"""Remediation 9 correctness guards for the six Run-4 quality patterns."""

from __future__ import annotations

import unittest

from glowbal_ingestion.identity_granularity import identity_granularity_reasons
from glowbal_ingestion.runtime_acceptance import can_resolve_found


def candidate(field: str, value: object, evidence: str, **overrides: object) -> dict[str, object]:
    item: dict[str, object] = {
        "field_name": field,
        "value_json": value,
        "evidence": evidence,
        "raw_document_id": "raw-remediation9",
        "source_authority": "OFFICIAL",
        "source_relationship": "DIRECT_OFFICIAL",
        "source_type": "programme_overview",
        "source_url": "https://example.edu/programme",
        "scope": "programme",
        "audience": "international",
        "academic_cycle": "2026-2027",
        "temporal_state": "CURRENT",
        "applicability_state": "APPLICABLE",
        "verification_status": "NEEDS_REVIEW",
        "validation_errors": [],
    }
    item.update(overrides)
    return item


class Remediation9QualityTests(unittest.TestCase):
    def test_pre_major_is_not_flat_final_identity(self) -> None:
        reasons = identity_granularity_reasons(
            value="B.A. in Public Affairs",
            evidence="Overview of the B.A. in Public Affairs",
            source_text=(
                "Applicants select the Public Affairs pre-major. Students are "
                "later admitted to the Public Affairs major."
            ),
            scope="programme",
        )
        self.assertIn("IDENTITY_STAGE_UNRESOLVED", reasons)

    def test_department_name_is_not_programme_without_offering_proof(self) -> None:
        reasons = identity_granularity_reasons(
            value="Computer Science",
            evidence="Computer Science",
            source_text="Departments: Computer Science; Mathematical Informatics.",
            scope="department",
        )
        self.assertIn("IDENTITY_UNIT_SCOPE_UNPROVEN", reasons)

    def test_parent_page_without_selected_track_is_unresolved(self) -> None:
        reasons = identity_granularity_reasons(
            value="Master Informatique",
            evidence="Master Informatique",
            source_text=(
                "The Master Informatique offers "
                '<a href="/masters/master-informatique/parcours-mind">MIND</a> '
                'and <a href="/masters/master-informatique/parcours-sar">SAR</a>.'
            ),
            scope="programme",
            source_url="https://example.edu/masters/master-informatique",
        )
        self.assertIn("IDENTITY_CHILD_SCOPE_UNRESOLVED", reasons)

    def test_explicit_child_track_keeps_parent_relationship(self) -> None:
        reasons = identity_granularity_reasons(
            value="Parcours MIND",
            evidence="Parcours MIND",
            source_text="Master Informatique — parcours MIND.",
            scope="programme",
            source_url="https://example.edu/masters/parcours-mind",
        )
        self.assertEqual(reasons, ())

    def test_alternative_master_or_doctoral_programme_stays_ambiguous(self) -> None:
        reasons = identity_granularity_reasons(
            value="Computer Science PhD or MS program",
            evidence="Computer Science PhD or MS program",
            source_text="Applicants may apply to the MS or PhD program.",
            scope="programme",
        )
        self.assertIn("IDENTITY_DEGREE_VARIANT_SCOPE_UNRESOLVED", reasons)

    def test_institution_term_tuition_is_not_concrete_without_annual_scope(self) -> None:
        item = candidate(
            "tuition",
            {
                "amount": 33360,
                "currency": "USD",
                "fee_period": "per term",
                "academic_cycle": "2026-2027",
            },
            "Undergraduate tuition rates for 2026-2027 are USD 33,360 per term.",
            scope="institution",
            target_degree="bachelor",
        )
        reasons = can_resolve_found(
            item,
            field_name="tuition",
            target_cycle="2026-2027",
            target_degree="bachelor",
        )
        self.assertFalse(reasons)

    def test_explicit_annual_programme_tuition_remains_found(self) -> None:
        item = candidate(
            "tuition",
            {
                "amount": 66720,
                "currency": "USD",
                "fee_period": "academic year",
                "academic_cycle": "2026-2027",
            },
            "Programme tuition for the 2026-2027 academic year is USD 66,720.",
        )
        self.assertTrue(
            can_resolve_found(
                item,
                field_name="tuition",
                target_cycle="2026-2027",
                target_degree="bachelor",
            )
        )

    def test_qualifying_disciplines_without_admission_semantics_are_unresolved(self) -> None:
        item = candidate(
            "subject_prerequisites",
            "Computer Science, Mathematics, Physics",
            "Qualifying disciplines listed alphabetically: Computer Science Mathematics Physics.",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
                target_degree="master",
            )
        )

    def test_explicit_admission_prerequisite_remains_found(self) -> None:
        item = candidate(
            "subject_prerequisites",
            "Computer Science, Mathematics, Physics",
            "Applicants must have one of the qualifying disciplines as a prerequisite for admission to Data Science.",
        )
        self.assertTrue(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
                target_degree="master",
            )
        )


if __name__ == "__main__":
    unittest.main()
