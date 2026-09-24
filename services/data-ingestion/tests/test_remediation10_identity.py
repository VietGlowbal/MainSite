"""Remediation 10 identity parsing and applicability guards."""

from __future__ import annotations

import unittest

from glowbal_ingestion.identity_granularity import (
    identity_dimensions,
    identity_granularity_reasons,
)
from glowbal_ingestion.runtime_acceptance import can_resolve_found


class Remediation10IdentityTests(unittest.TestCase):
    def test_explicit_credential_prefix_produces_canonical_subject(self) -> None:
        dimensions = identity_dimensions(value="Baccalauréat en informatique")
        self.assertEqual(dimensions.canonical_programme_identity, "informatique")
        self.assertEqual(dimensions.credential, "Baccalauréat")
        self.assertEqual(dimensions.source_native_identity, "Baccalauréat en informatique")

    def test_child_track_keeps_parent_and_track_dimensions(self) -> None:
        dimensions = identity_dimensions(
            value="Parcours Systèmes et Applications Répartis (SAR)",
            source_url=(
                "https://example.edu/masters/master-informatique/"
                "parcours-sar"
            ),
        )
        self.assertEqual(dimensions.entity_type, "TRACK")
        self.assertEqual(dimensions.parent_programme, "Master Informatique")
        self.assertEqual(dimensions.canonical_programme_identity, "Master Informatique")
        self.assertEqual(dimensions.track, "SAR")

    def test_unit_scoped_scalar_identity_requires_target_proof(self) -> None:
        reasons = identity_granularity_reasons(
            value="Master of Information Science and Technology",
            evidence=(
                "The Graduate School confers Master of Information Science "
                "and Technology."
            ),
            scope="faculty",
        )
        self.assertIn("IDENTITY_TARGET_APPLICABILITY_UNPROVEN", reasons)

    def test_structured_unit_scoped_degree_can_remain_a_candidate(self) -> None:
        reasons = identity_granularity_reasons(
            value={
                "canonical_programme_identity": "Computer Science",
                "entity_type": "DEGREE_PROGRAMME",
            },
            evidence="The department offers the Computer Science degree programme.",
            scope="department",
        )
        self.assertNotIn("IDENTITY_TARGET_APPLICABILITY_UNPROVEN", reasons)

    def test_parent_page_without_child_selection_stays_unresolved(self) -> None:
        candidate = {
            "field_name": "programme_identity",
            "value_json": "Master Informatique",
            "evidence": "Master Informatique",
            "_source_text": (
                '<a href="/masters/master-informatique/parcours-mind">MIND</a> '
                '<a href="/masters/master-informatique/parcours-sar">SAR</a>'
            ),
            "source_url": "https://example.edu/masters/master-informatique",
            "scope": "programme",
            "raw_document_id": "raw-remediation10",
            "source_authority": "OFFICIAL",
            "source_relationship": "DIRECT_OFFICIAL",
            "verification_status": "RULE_VALIDATED",
        }
        self.assertFalse(can_resolve_found(candidate, field_name="programme_identity"))

    def test_delivery_specific_identity_requires_delivery_applicability(self) -> None:
        candidate = {
            "field_name": "programme_identity",
            "value_json": "Master of Applied Data Science (MADS)",
            "evidence": "The Master of Applied Data Science (MADS).",
            "_source_text": "This is a fully online master's programme.",
            "source_url": "https://example.edu/mads",
            "scope": "programme",
            "raw_document_id": "raw-remediation10",
            "source_authority": "OFFICIAL",
            "source_relationship": "DIRECT_OFFICIAL",
            "verification_status": "RULE_VALIDATED",
        }
        self.assertFalse(
            can_resolve_found(
                candidate,
                field_name="programme_identity",
                audience="graduate international",
            )
        )

if __name__ == "__main__":
    unittest.main()
