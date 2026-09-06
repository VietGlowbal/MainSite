"""Regression tests for conservative runtime field visibility."""

from __future__ import annotations

import unittest

from glowbal_ingestion.runtime_acceptance import can_resolve_found


def assertion(
    field: str,
    value: object,
    evidence: str,
    *,
    scope: str = "programme",
    cycle: str | None = "2026-2027",
    temporal: str = "CURRENT",
    applicability: str = "APPLICABLE",
    degree: str = "master",
) -> dict[str, object]:
    return {
        "field_name": field,
        "value_json": value,
        "evidence": evidence,
        "raw_document_id": "raw-fixture",
        "source_authority": "OFFICIAL",
        "source_type": "programme_admission",
        "scope": scope,
        "audience": "international",
        "academic_cycle": cycle,
        "temporal_state": temporal,
        "applicability_state": applicability,
        "verification_status": "NEEDS_REVIEW",
        "validation_errors": [],
        "target_degree": degree,
    }


class RuntimeAcceptanceTests(unittest.TestCase):
    def test_major_curriculum_is_not_admission_requirement(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Students must complete calculus in the curriculum.",
            "The curriculum requires calculus before graduation.",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_post_admission_major_declaration_is_not_admission_gate(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Declare the major after admission.",
            "Students declare the major after admission and placement.",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_general_application_component_is_not_major_requirement(self) -> None:
        item = assertion(
            "required_documents",
            "Transcript",
            "All applicants submit a transcript as part of the application.",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="required_documents",
                target_cycle="2026-2027",
            )
        )

    def test_explicit_programme_admission_prerequisite_is_found(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Calculus I",
            "Applicants to the Data Science programme must complete Calculus I before admission.",
        )
        self.assertTrue(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_current_programme_qualification_profile_is_found_without_cycle_label(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Qualifying disciplines: Computer Science, Mathematics, and Physics.",
            "Qualifying disciplines are required admission prerequisites for the Data Science master's programme.",
            cycle=None,
            temporal="UNKNOWN",
        )
        item.update(
            source_type="programme_overview",
            source_authority="OFFICIAL",
            source_relationship="DIRECT_OFFICIAL",
            source_url="https://example.edu/programmes/data-science",
        )
        self.assertTrue(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_unproven_programme_overview_is_not_a_qualification_profile(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Students develop mathematical and computational skills.",
            "The programme develops mathematical and computational skills.",
            cycle=None,
            temporal="UNKNOWN",
        )
        item.update(
            source_type="programme_overview",
            source_authority="OFFICIAL",
            source_relationship="DIRECT_OFFICIAL",
            source_url="https://example.edu/programmes/data-science",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_post_enrolment_requirement_is_not_admission_requirement(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "Students must pass calculus during the first year of enrollment.",
            "Students must pass calculus during the first year of enrollment.",
            cycle=None,
            temporal="UNKNOWN",
        )
        item.update(
            source_type="programme_overview",
            source_authority="OFFICIAL",
            source_relationship="DIRECT_OFFICIAL",
            source_url="https://example.edu/programmes/data-science",
        )
        self.assertFalse(
            can_resolve_found(
                item,
                field_name="major_admissions_requirement",
                component_field="subject_prerequisites",
                target_cycle="2026-2027",
            )
        )

    def test_tuition_scope_and_semantics(self) -> None:
        self.assertFalse(
            can_resolve_found(
                assertion(
                    "tuition",
                    {"amount": 50000, "currency": "USD", "fee_period": "year"},
                    "Estimated cost of attendance and student budget: $50,000.",
                    scope="programme",
                ),
                field_name="tuition",
                target_cycle="2026-2027",
            )
        )
        self.assertFalse(
            can_resolve_found(
                assertion(
                    "tuition",
                    {"amount": 500, "currency": "USD", "fee_period": "once"},
                    "Registration fee: $500.",
                    scope="programme",
                ),
                field_name="tuition",
                target_cycle="2026-2027",
            )
        )
        self.assertTrue(
            can_resolve_found(
                assertion(
                    "tuition",
                    {
                        "amount": 24000,
                        "currency": "USD",
                        "fee_period": "academic year",
                        "credential": "MSc",
                    },
                    "Data Science MSc tuition for the 2026-2027 academic year is USD 24,000.",
                    scope="programme",
                ),
                field_name="tuition",
                target_cycle="2026-2027",
            )
        )

    def test_institution_tuition_requires_degree_and_cycle_evidence(self) -> None:
        item = assertion(
            "tuition",
            {
                "amount": 33360,
                "currency": "USD",
                "fee_period": "per term",
                "credential": "Full regular graduate tuition",
            },
            "Full regular graduate tuition per term is USD 33,360.",
            scope="institution",
            degree="master",
            temporal="UNKNOWN",
        )
        self.assertFalse(
            can_resolve_found(item, field_name="tuition", target_cycle="2026-2027")
        )

    def test_explicit_institution_tuition_can_be_runtime_found(self) -> None:
        item = assertion(
            "tuition",
            {
                "amount": 33360,
                "currency": "USD",
                "fee_period": "per term",
                "annual_amount": 66720,
                "credential": "Undergraduate tuition",
            },
            "Annual undergraduate tuition for the 2026-2027 academic year is USD 66,720, billed as USD 33,360 per term.",
            scope="institution",
            degree="bachelor",
        )
        self.assertTrue(
            can_resolve_found(item, field_name="tuition", target_cycle="2026-2027")
        )

    def test_deadline_type_scope_and_cycle(self) -> None:
        registration = assertion(
            "final_deadline",
            "2026-10-01",
            "Registration deadline for the 2026-2027 year is October 1, 2026.",
        )
        self.assertFalse(
            can_resolve_found(
                registration,
                field_name="application_deadline",
                component_field="final_deadline",
                target_cycle="2026-2027",
            )
        )
        wrong_cycle = assertion(
            "final_deadline",
            "2025-10-01",
            "Applications for the programme close on October 1, 2025.",
            cycle="2025-2026",
        )
        self.assertFalse(
            can_resolve_found(
                wrong_cycle,
                field_name="application_deadline",
                component_field="final_deadline",
                target_cycle="2026-2027",
            )
        )
        valid = assertion(
            "final_deadline",
            "2027-01-04",
            "Applications for the Data Science programme for Fall 2026 close on January 4, 2027.",
        )
        self.assertTrue(
            can_resolve_found(
                valid,
                field_name="application_deadline",
                component_field="final_deadline",
                target_cycle="2026-2027",
            )
        )

    def test_english_semantics(self) -> None:
        taught = assertion(
            "toefl",
            {"notes": "No TOEFL requirement found"},
            "The programme is taught in English.",
        )
        self.assertFalse(
            can_resolve_found(
                taught,
                field_name="english_requirement",
                component_field="toefl",
                target_cycle="2026-2027",
            )
        )
        recommended = assertion(
            "ielts_overall",
            7.0,
            "A recommended IELTS score of 7.0 is competitive.",
        )
        self.assertFalse(
            can_resolve_found(
                recommended,
                field_name="english_requirement",
                component_field="ielts_overall",
                target_cycle="2026-2027",
            )
        )
        valid = assertion(
            "toefl",
            {"overall_score": 100},
            "Applicants to this programme must submit a minimum TOEFL iBT score of 100 for 2026-2027.",
        )
        self.assertTrue(
            can_resolve_found(
                valid,
                field_name="english_requirement",
                component_field="toefl",
                target_cycle="2026-2027",
            )
        )

    def test_unknown_scope_or_temporal_semantics_suppresses_candidate(self) -> None:
        item = assertion(
            "subject_prerequisites",
            "A prerequisite",
            "Applicants must complete a prerequisite for admission.",
            scope="institution",
            cycle=None,
            temporal="UNKNOWN",
            applicability="UNKNOWN",
        )
        reasons = can_resolve_found(
            item,
            field_name="major_admissions_requirement",
            component_field="subject_prerequisites",
            target_cycle="2026-2027",
        )
        self.assertFalse(reasons)


if __name__ == "__main__":
    unittest.main()
