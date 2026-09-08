from __future__ import annotations

import unittest

from glowbal_ingestion.runtime_acceptance import (
    can_resolve_found,
    projection_acceptance_reasons,
    status_acceptance_diagnostics,
)
from glowbal_ingestion.validation import normalize_programme_status


def status_assertion(
    evidence: str,
    *,
    value: object = "accepting_applications",
    academic_cycle: str | None = "2026-2027",
    temporal_state: str = "UNKNOWN",
    applicability_state: str = "APPLICABLE",
    audience: str = "international",
    scope: str = "programme",
) -> dict[str, object]:
    return {
        "assertion_id": "status-fixture",
        "entity_id": "programme-1",
        "field_name": "programme_status",
        "value_json": value,
        "evidence": evidence,
        "raw_document_id": "raw-status-fixture",
        "source_url": "https://example.edu/programmes/data-science",
        "source_type": "programme_overview",
        "source_authority": "OFFICIAL",
        "source_relationship": "DIRECT_OFFICIAL",
        "scope": scope,
        "audience": audience,
        "academic_cycle": academic_cycle,
        "temporal_state": temporal_state,
        "applicability_state": applicability_state,
        "verification_status": "NEEDS_REVIEW",
        "validation_errors": [],
    }


class Remediation11ProgrammeStatusTests(unittest.TestCase):
    def test_status_normalization_preserves_accepting_semantics(self) -> None:
        self.assertEqual(
            normalize_programme_status("Applications are currently open"),
            "accepting_applications",
        )
        self.assertEqual(
            normalize_programme_status("The programme is active"),
            "active",
        )

    def assert_not_found(self, candidate: dict[str, object]) -> None:
        self.assertFalse(
            can_resolve_found(
                candidate,
                field_name="programme_status",
                target_cycle="2026-2027",
                audience="international",
            )
        )

    def test_live_programme_page_only_is_not_current_accepting(self) -> None:
        self.assert_not_found(
            status_assertion(
                "The Data Science programme page is live and admissions information is available."
            )
        )

    def test_old_admissions_cycle_is_not_current(self) -> None:
        self.assert_not_found(
            status_assertion(
                "Applications are currently open for the 2025-2026 cycle.",
                academic_cycle="2025-2026",
            )
        )

    def test_future_deadline_without_open_window_is_not_accepting(self) -> None:
        self.assert_not_found(
            status_assertion(
                "The application deadline for the 2026-2027 cycle is 2027-02-01."
            )
        )

    def test_generic_application_portal_is_not_programme_status(self) -> None:
        self.assert_not_found(
            status_assertion(
                "The application portal is available for applicants."
            )
        )

    def test_missing_cycle_is_not_current_accepting(self) -> None:
        self.assert_not_found(
            status_assertion(
                "Applications are currently open.",
                academic_cycle=None,
            )
        )

    def test_unknown_programme_applicability_fails_closed(self) -> None:
        self.assert_not_found(
            status_assertion(
                "Applications are currently open for the 2026-2027 cycle.",
                applicability_state="UNKNOWN",
            )
        )

    def test_current_cycle_programme_open_window_is_found(self) -> None:
        candidate = status_assertion(
            "Applications are currently open for the 2026-2027 cycle; the application window is 2026-08-01 through 2027-02-01."
        )
        self.assertTrue(
            can_resolve_found(
                candidate,
                field_name="programme_status",
                target_cycle="2026-2027",
                audience="international",
            )
        )

    def test_current_status_diagnostics_explain_rejection(self) -> None:
        candidate = status_assertion(
            "Dates limites: submit the application from 2026-08-01 to 2027-02-01."
        )
        diagnostics = status_acceptance_diagnostics(
            candidate,
            target_cycle="2026-2027",
            audience="international",
        )
        self.assertEqual(diagnostics["status_candidate"], "accepting_applications")
        self.assertFalse(
            diagnostics["temporal_evidence"]["explicit_current_open_status"]
        )
        self.assertFalse(diagnostics["current_applicability"])
        self.assertIn(
            "PROGRAMME_STATUS_OPEN_WINDOW_UNPROVEN",
            diagnostics["rejection_reason"],
        )
        self.assertIn(
            "PROGRAMME_STATUS_OPEN_WINDOW_UNPROVEN",
            projection_acceptance_reasons(
                candidate,
                field_name="programme_status",
                target_cycle="2026-2027",
                audience="international",
            ),
        )

    def test_active_candidate_with_open_evidence_uses_same_temporal_guard(self) -> None:
        self.assert_not_found(
            status_assertion(
                "The programme is listed in the catalogue for the 2026-2027 cycle.",
                value="active",
            )
        )

    def test_existing_explicit_active_status_remains_supported(self) -> None:
        candidate = status_assertion(
            "The programme is currently active.",
            value="active",
            temporal_state="CURRENT",
        )
        self.assertTrue(
            can_resolve_found(
                candidate,
                field_name="programme_status",
                target_cycle="2026-2027",
                audience="international",
            )
        )


if __name__ == "__main__":
    unittest.main()
