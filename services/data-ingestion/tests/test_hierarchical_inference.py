from __future__ import annotations

import unittest

from glowbal_ingestion.hierarchical_inference import (
    HierarchyLevel,
    HierarchicalInferenceEngine,
)
from glowbal_ingestion.inference import InferenceEngine
from glowbal_ingestion.models import (
    ApplicabilityState,
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
)


TARGET = {
    "programme_id": "target-programme",
    "institution_id": "institution-a",
    "degree_level": "master",
    "audience": "international",
    "academic_cycle": "2026-2027",
    "programme_family": "computer_science",
    "field_domain": "STEM",
    "organisation_unit_id": "department-a",
    "currency": "USD",
    "unit_basis": "annual",
    "verified_attributes": (
        "country",
        "institution_type",
        "field_domain",
        "degree_level",
    ),
    "country": "US",
    "institution_type": "public",
}


def assertion(
    assertion_id: str,
    entity_id: str,
    value: object = 100,
    *,
    entity_type: str = "programme",
    scope: str = "programme",
    degree_level: str | None = "master",
    audience: str | None = "international",
    cycle: str | None = "2026-2027",
    authority: SourceAuthority = SourceAuthority.OFFICIAL,
    relationship: SourceRelationship = SourceRelationship.DIRECT_OFFICIAL,
    epistemic: EpistemicState = EpistemicState.OBSERVED,
    temporal: TemporalState = TemporalState.CURRENT,
    applicability: ApplicabilityState = ApplicabilityState.APPLICABLE,
    source_hash: str | None = None,
    inherited_from: str | None = None,
) -> FieldAssertion:
    if isinstance(value, (int, float)):
        value = {"amount": value, "currency": "USD", "basis": "annual"}
    return FieldAssertion(
        assertion_id=assertion_id,
        entity_type=entity_type,
        entity_id=entity_id,
        field_name="tuition",
        value_json=value,
        null_reason=None,
        source_url=f"https://{assertion_id}.example.edu/tuition",
        source_type="official",
        evidence="Applicable tuition evidence.",
        evidence_locator=None,
        scope=scope,
        audience=audience,
        academic_cycle=cycle,
        retrieved_at="2026-01-01T00:00:00+00:00",
        confidence=0.9,
        verification_status=VerificationStatus.RULE_VALIDATED,
        extractor_version="test",
        model_name=None,
        applicability_source_url="https://target.example.edu/applicability",
        applicability_evidence="The stated tariff applies to the target degree.",
        source_content_hash=source_hash or assertion_id,
        inherited_from_assertion_id=inherited_from,
        epistemic_state=epistemic,
        temporal_state=temporal,
        source_authority=authority,
        source_relationship=relationship,
        degree_level=degree_level,
        applicability_state=applicability,
    )


def run_engine(assertions, **kwargs):
    options = {
        "programmes": [TARGET],
        "organisation_units": [
            {
                "organisation_unit_id": "department-a",
                "institution_id": "institution-a",
                "parent_organisation_unit_id": "faculty-a",
            },
            {
                "organisation_unit_id": "faculty-a",
                "institution_id": "institution-a",
                "parent_organisation_unit_id": None,
            },
        ],
        "recovery_exhausted": True,
    }
    options.update(kwargs)
    return HierarchicalInferenceEngine().explain(
        field="tuition",
        target_cycle="2026-2027",
        entity_id="target-programme",
        target=TARGET,
        assertions=assertions,
        **options,
    )


class HierarchicalInferenceTests(unittest.TestCase):
    def test_direct_evidence_wins(self) -> None:
        result = run_engine(
            [
                assertion("direct", "target-programme"),
                assertion("parent", "department-a", scope="department", entity_type="organisation_unit", relationship=SourceRelationship.DEPARTMENT),
            ]
        )
        self.assertTrue(result.abstained)
        self.assertEqual(result.reason, "DIRECT_TARGET_AVAILABLE")

    def test_parent_faculty_fallback(self) -> None:
        result = run_engine(
            [
                assertion("parent", "department-a", scope="department", entity_type="organisation_unit", relationship=SourceRelationship.DEPARTMENT),
            ]
        )
        self.assertFalse(result.abstained)
        self.assertEqual(result.level, HierarchyLevel.PARENT_ORGANISATION)
        self.assertEqual(result.record.inference_level, HierarchyLevel.PARENT_ORGANISATION.value)

    def test_institution_fallback(self) -> None:
        result = run_engine(
            [
                assertion("institution", "institution-a", scope="institution", entity_type="institution", relationship=SourceRelationship.FINANCE_OFFICE),
            ],
            institutions=[{"institution_id": "institution-a", "country": "US", "institution_type": "public"}],
        )
        self.assertEqual(result.level, HierarchyLevel.INSTITUTION)
        self.assertEqual(result.record.donor_entity_ids, ("institution-a",))

    def test_institution_finance_payload_keeps_credential_out_of_degree_and_allows_context_scope(self) -> None:
        donor = assertion(
            "institution-finance",
            "institution-a",
            value={
                "credential": "out-of-state students",
                "amount": 54002,
                "currency": "USD",
                "fee_period": "annual",
                "audience": "international",
            },
            entity_type="institution",
            scope="institution",
            degree_level=None,
            cycle=None,
            authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            applicability=ApplicabilityState.UNKNOWN,
        )
        result = run_engine(
            [donor],
            institutions=[{"institution_id": "institution-a", "country": "US", "institution_type": "public"}],
        )
        self.assertFalse(result.abstained)
        self.assertEqual(result.level, HierarchyLevel.INSTITUTION)
        self.assertIsNone(result.candidates[0].donor_context.degree_level)
        self.assertEqual(result.candidates[0].donor_context.unit_basis, "annual")
        inferred = result.record.as_assertion()
        self.assertEqual(inferred.entity_type, "institution")
        self.assertEqual(inferred.entity_id, "institution-a")
        self.assertEqual(inferred.scope, "institution")
        self.assertEqual(inferred.academic_cycle, "")

    def test_institution_finance_context_does_not_bypass_audience_gate(self) -> None:
        donor = assertion(
            "institution-domestic-finance",
            "institution-a",
            value={
                "credential": "in-state students",
                "amount": 50000,
                "currency": "USD",
                "fee_period": "annual",
                "audience": "domestic",
            },
            entity_type="institution",
            scope="institution",
            degree_level=None,
            audience="domestic",
            cycle=None,
            authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            applicability=ApplicabilityState.UNKNOWN,
        )
        result = run_engine(
            [donor],
            institutions=[{"institution_id": "institution-a", "country": "US", "institution_type": "public"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn("AUDIENCE_MISMATCH", {item["reason"] for item in result.rejected})

    def test_institution_finance_context_preserves_shared_source_cycle(self) -> None:
        donor = assertion(
            "institution-cycle-finance",
            "institution-a",
            value={
                "amount": 54002,
                "currency": "USD",
                "fee_period": "annual",
                "audience": "international",
            },
            entity_type="institution",
            scope="institution",
            degree_level=None,
            cycle="2026-2027",
            authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            applicability=ApplicabilityState.UNKNOWN,
        )
        result = run_engine(
            [donor],
            institutions=[{"institution_id": "institution-a", "country": "US", "institution_type": "public"}],
        )
        self.assertFalse(result.abstained)
        self.assertEqual(result.record.as_assertion().academic_cycle, "2026-2027")

    def test_sibling_donor_selection(self) -> None:
        sibling = {
            "programme_id": "sibling-programme",
            "institution_id": "institution-a",
            "degree_level": "master",
            "audience": "international",
            "academic_cycle": "2026-2027",
            "programme_family": "computer_science",
            "organisation_unit_id": "department-a",
        }
        result = run_engine(
            [assertion("sibling", "sibling-programme")],
            programmes=[TARGET, sibling],
        )
        self.assertEqual(result.level, HierarchyLevel.SIBLING_PROGRAMME)
        self.assertEqual(result.record.donor_entity_ids, ("sibling-programme",))

    def test_peer_donor_selection_requires_verified_attributes(self) -> None:
        peer = {
            "institution_id": "institution-b",
            "country": "US",
            "institution_type": "public",
            "field_domain": "STEM",
            "degree_level": "master",
            "verified_attributes": ("country", "institution_type", "field_domain", "degree_level"),
        }
        result = run_engine(
            [assertion("peer", "institution-b", scope="institution", entity_type="institution")],
            institutions={"institution-b": peer},
        )
        self.assertEqual(result.level, HierarchyLevel.PEER_INSTITUTION)

    def test_incompatible_donors_are_rejected(self) -> None:
        result = run_engine(
            [assertion("wrong-degree", "sibling-programme", degree_level="bachelor")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme", "degree_level": "bachelor"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn("DEGREE_MISMATCH", {item["reason"] for item in result.rejected})

    def test_cycle_mismatch_is_rejected(self) -> None:
        result = run_engine(
            [assertion("old", "sibling-programme", cycle="2025-2026")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn("CYCLE_MISMATCH", {item["reason"] for item in result.rejected})

    def test_audience_mismatch_is_rejected(self) -> None:
        result = run_engine(
            [assertion("domestic", "sibling-programme", audience="domestic")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn("AUDIENCE_MISMATCH", {item["reason"] for item in result.rejected})

    def test_unknown_source_relationship_is_rejected(self) -> None:
        result = run_engine(
            [assertion("related", "sibling-programme", relationship=SourceRelationship.OTHER_RELATED)],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn("SOURCE_RELATIONSHIP_UNSAFE", {item["reason"] for item in result.rejected})

    def test_policy_lineage_duplicates_count_once(self) -> None:
        rows = [
            assertion("same-one", "sibling-one", source_hash="shared-policy"),
            assertion("same-two", "sibling-two", source_hash="shared-policy"),
        ]
        programmes = [TARGET, {**TARGET, "programme_id": "sibling-one"}, {**TARGET, "programme_id": "sibling-two"}]
        result = run_engine(rows, programmes=programmes)
        self.assertEqual(result.level, HierarchyLevel.SIBLING_PROGRAMME)
        self.assertEqual(result.record.support_count, 1)
        self.assertEqual(result.record.donor_policy_lineage_ids, ("shared-policy",))

    def test_target_and_donor_same_lineage_are_not_independent(self) -> None:
        target_row = assertion(
            "target-row",
            "target-programme",
            cycle="2025-2026",
            source_hash="tariff-policy",
        )
        result = run_engine(
            [target_row, assertion("dependent", "sibling-programme", source_hash="tariff-policy")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme"}],
        )
        self.assertTrue(result.abstained)
        self.assertIn(
            "TARGET_DONOR_LINEAGE_DEPENDENT",
            {item["reason"] for item in result.rejected},
        )

    def test_inference_from_inference_is_blocked(self) -> None:
        result = run_engine(
            [assertion("inferred", "sibling-programme", epistemic=EpistemicState.INFERRED), assertion("inherited", "department-a", scope="department", entity_type="organisation_unit", inherited_from="native")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-programme"}],
        )
        self.assertTrue(result.abstained)

    def test_abstains_without_compatible_donor(self) -> None:
        result = run_engine([])
        self.assertTrue(result.abstained)
        self.assertEqual(result.reason, "NO_COMPATIBLE_DONOR")

    def test_uncertainty_increases_with_hierarchy_distance(self) -> None:
        parent = run_engine([assertion("parent", "department-a", scope="department", entity_type="organisation_unit", relationship=SourceRelationship.DEPARTMENT)])
        peer = run_engine(
            [assertion("peer", "institution-b", scope="institution", entity_type="institution")],
            institutions={"institution-b": {"institution_id": "institution-b", "country": "US", "institution_type": "public", "field_domain": "STEM", "degree_level": "master", "verified_attributes": ("country", "institution_type", "field_domain", "degree_level")}},
        )
        self.assertLess(
            parent.record.uncertainty_components["hierarchy_distance_uncertainty"],
            peer.record.uncertainty_components["hierarchy_distance_uncertainty"],
        )

    def test_dispersion_increases_uncertainty(self) -> None:
        one = run_engine(
            [assertion("one", "sibling-one")],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-one"}],
        )
        two = run_engine(
            [assertion("one", "sibling-one", value=100), assertion("two", "sibling-two", value=200)],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-one"}, {**TARGET, "programme_id": "sibling-two"}],
        )
        self.assertEqual(one.record.donor_dispersion, 0.0)
        self.assertGreater(two.record.donor_dispersion, one.record.donor_dispersion)
        self.assertGreater(two.record.uncertainty_components["donor_dispersion_uncertainty"], 0.0)

    def test_conflict_increases_uncertainty_and_is_marked(self) -> None:
        result = run_engine(
            [assertion("one", "sibling-one", value=100), assertion("two", "sibling-two", value=200)],
            programmes=[TARGET, {**TARGET, "programme_id": "sibling-one"}, {**TARGET, "programme_id": "sibling-two"}],
        )
        self.assertEqual(result.record.conflict_state, "CONFLICTING_DONORS")
        self.assertEqual(result.record.uncertainty_components["cross_source_conflict_uncertainty"], 1.0)

    def test_inferred_assertion_remains_advisory(self) -> None:
        result = run_engine(
            [assertion("parent", "department-a", scope="department", entity_type="organisation_unit", relationship=SourceRelationship.DEPARTMENT)]
        )
        inferred = result.record.as_assertion()
        self.assertEqual(inferred.epistemic_state, EpistemicState.INFERRED)
        self.assertEqual(inferred.inference_level, HierarchyLevel.PARENT_ORGANISATION.value)
        self.assertTrue(inferred.verification_status == VerificationStatus.NEEDS_REVIEW)
        self.assertFalse(result.record.product_safe)
        self.assertIn("HIERARCHICAL_ESTIMATE_ADVISORY", inferred.validation_errors)
        self.assertEqual(inferred.donor_policy_lineage_ids, ("parent",))
        self.assertEqual(inferred.donor_source_urls, ("https://parent.example.edu/tuition",))
        self.assertEqual(inferred.cycle_compatibility, "MATCH")
        self.assertEqual(inferred.applicability_compatibility, "EXPLICIT")

    def test_existing_inference_engine_exposes_opt_in_hierarchy(self) -> None:
        result = InferenceEngine().infer_hierarchical(
            field="tuition",
            target_cycle="2026-2027",
            entity_id="target-programme",
            target=TARGET,
            programmes=[TARGET],
            organisation_units=[
                {
                    "organisation_unit_id": "department-a",
                    "institution_id": "institution-a",
                    "parent_organisation_unit_id": None,
                }
            ],
            assertions=[
                assertion(
                    "parent",
                    "department-a",
                    scope="department",
                    entity_type="organisation_unit",
                    relationship=SourceRelationship.DEPARTMENT,
                )
            ],
            recovery_exhausted=True,
        )
        self.assertIsNotNone(result)

    def test_population_evaluation_reports_activation_without_claiming_accuracy(self) -> None:
        parent = assertion(
            "parent",
            "department-a",
            scope="department",
            entity_type="organisation_unit",
            relationship=SourceRelationship.DEPARTMENT,
        )
        result = HierarchicalInferenceEngine().evaluate_population(
            [TARGET],
            field="tuition",
            assertions=[parent],
            assertions_by_target={"target-programme": ()},
            programmes=[TARGET],
            organisation_units=[
                {
                    "organisation_unit_id": "department-a",
                    "institution_id": "institution-a",
                    "parent_organisation_unit_id": None,
                }
            ],
            recovery_exhausted=True,
        )
        self.assertEqual(result["target_count"], 1)
        self.assertEqual(result["activated_by_level"], {"H1_PARENT_ORGANISATION": 1})
        self.assertEqual(result["abstention_rate"], 0.0)
        self.assertEqual(
            result["accuracy_status"],
            "NOT_MEASURABLE_UNLESS_HELD_OUT_TRUTH_IS_SUPPLIED",
        )


if __name__ == "__main__":
    unittest.main()
