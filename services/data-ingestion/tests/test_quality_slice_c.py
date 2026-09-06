from __future__ import annotations

import unittest
from datetime import datetime, timezone

from glowbal_ingestion.acquisition import AcquisitionAttempt, AcquisitionFailureCode
from glowbal_ingestion.conflicts import detect_conflicts
from glowbal_ingestion.coverage import CoverageEngine
from glowbal_ingestion.field_policy import DEFAULT_FIELD_POLICY_REGISTRY
from glowbal_ingestion.inference import InferenceEngine, InferenceStatus
from glowbal_ingestion.models import (
    EpistemicState,
    FieldAssertion,
    NullReason,
    RawDocument,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
)
from glowbal_ingestion.quality import SliceCQuality
from glowbal_ingestion.quality_models import AvailabilityState, ConflictState, Volatility
from glowbal_ingestion.recovery import RecoveryPlanner


NOW = datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def assertion(
    field: str,
    value: object,
    *,
    assertion_id: str | None = None,
    cycle: str | None = "2026-2027",
    audience: str | None = "international",
    scope: str = "programme",
    authority: SourceAuthority | None = SourceAuthority.OFFICIAL,
    relationship: SourceRelationship | None = SourceRelationship.DIRECT_OFFICIAL,
    temporal: TemporalState = TemporalState.CURRENT,
    epistemic: EpistemicState = EpistemicState.OBSERVED,
    status: VerificationStatus = VerificationStatus.RULE_VALIDATED,
    null_reason: NullReason | None = None,
    evidence: str = "Official programme evidence.",
    retrieved_at: str = NOW,
    raw_document_id: str | None = None,
) -> FieldAssertion:
    return FieldAssertion(
        assertion_id=assertion_id or f"a-{field}-{cycle}-{audience}-{scope}",
        entity_type="programme",
        entity_id="programme-1",
        field_name=field,
        value_json=value,
        null_reason=null_reason,
        source_url="https://example.edu/programme",
        source_type="official",
        evidence=evidence,
        evidence_locator=None,
        scope=scope,
        audience=audience,
        academic_cycle=cycle,
        retrieved_at=retrieved_at,
        confidence=0.8,
        verification_status=status,
        extractor_version="test",
        model_name=None,
        epistemic_state=epistemic,
        temporal_state=temporal,
        source_authority=authority,
        source_relationship=relationship,
        raw_document_id=raw_document_id,
    )


class SliceCQualityTests(unittest.TestCase):
    def test_tuition_recovery_composes_with_slice_b_intent_boundary(self) -> None:
        missing_attempt = AcquisitionAttempt.create(
            intent_id=None,
            candidate_id=None,
            status="SOURCE_NOT_FOUND",
            error_code=AcquisitionFailureCode.NO_SOURCE_CANDIDATES,
        )
        engine = CoverageEngine()
        missing = engine.evaluate(
            "programme-1",
            "tuition",
            entity_type="programme",
            entity_id="programme-1",
            target_cycle="2026-2027",
            audience="international",
            attempts=[missing_attempt],
        )
        self.assertEqual(missing.state, AvailabilityState.SOURCE_NOT_FOUND)
        decision = RecoveryPlanner().plan(missing)[0]
        self.assertEqual(decision.intents[0].preferred_source_classes, ("programme_finance",))
        self.assertEqual(decision.intents[0].entity.entity_id, "programme-1")
        found = engine.evaluate(
            "programme-1",
            "tuition",
            entity_type="programme",
            entity_id="programme-1",
            target_cycle="2026-2027",
            audience="international",
            assertions=[assertion("tuition", {"amount": 15000, "currency": "USD", "fee_period": "year"})],
        )
        self.assertEqual(found.state, AvailabilityState.FOUND)
        self.assertTrue(found.acceptable)

    def test_failure_states_are_not_absence(self) -> None:
        engine = CoverageEngine()
        cases = [
            (AcquisitionFailureCode.FETCH_FAILED, AvailabilityState.FETCH_FAILED),
            (AcquisitionFailureCode.PARSE_FAILED, AvailabilityState.PARSE_FAILED),
            (AcquisitionFailureCode.EXTRACTION_FAILED, AvailabilityState.EXTRACTION_FAILED),
        ]
        for code, expected in cases:
            with self.subTest(code=code):
                attempt = AcquisitionAttempt.create(intent_id="i", candidate_id="c", status="FAILED", error_code=code, discriminator=code.value)
                result = engine.evaluate("programme-1", "tuition", attempts=[attempt])
                self.assertEqual(result.state, expected)
                self.assertFalse(result.acceptable)

    def test_not_published_and_not_required_need_proof(self) -> None:
        engine = CoverageEngine()
        unpublished = engine.evaluate(
            "programme-1", "scholarships",
            assertions=[assertion("scholarships", None, null_reason=NullReason.NOT_PUBLISHED, evidence="The university does not publish scholarships for this programme.")],
        )
        self.assertEqual(unpublished.state, AvailabilityState.NOT_PUBLISHED)
        self.assertTrue(unpublished.terminal)
        unproven = engine.evaluate(
            "programme-1", "scholarships",
            assertions=[assertion("scholarships", None, null_reason=NullReason.NOT_PUBLISHED, evidence="No value found.")],
        )
        self.assertEqual(unproven.state, AvailabilityState.SOURCE_NOT_FOUND)
        not_required = engine.evaluate(
            "programme-1", "gre",
            assertions=[assertion("gre", None, null_reason=NullReason.NOT_APPLICABLE, evidence="GRE is not required for this programme.")],
        )
        self.assertEqual(not_required.state, AvailabilityState.NOT_REQUIRED)

    def test_stale_and_historical_values_do_not_satisfy_current_high_volatility(self) -> None:
        result = CoverageEngine().evaluate(
            "programme-1", "tuition", target_cycle="2026-2027",
            assertions=[assertion("tuition", {"amount": 14000}, cycle="2025-2026", temporal=TemporalState.HISTORICAL)],
        )
        self.assertEqual(result.state, AvailabilityState.STALE_ONLY)
        self.assertFalse(result.acceptable)

    def test_conflicts_are_applicability_aware_and_policy_resolved(self) -> None:
        domestic = assertion("tuition", {"amount": 10000}, audience="domestic", assertion_id="domestic")
        international = assertion("tuition", {"amount": 15000}, audience="international", assertion_id="international")
        self.assertEqual(detect_conflicts([domestic, international]), [])
        broad = assertion("ielts_overall", {"minimum": 6.5}, scope="university", assertion_id="broad")
        specific = assertion("ielts_overall", {"minimum": 7.0}, scope="programme", assertion_id="specific")
        resolved = detect_conflicts([broad, specific])
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].state, ConflictState.AUTO_RESOLVED)
        self.assertEqual(resolved[0].resolved_assertion_id, "specific")
        same_scope_a = assertion("tuition", {"amount": 1}, assertion_id="one")
        same_scope_b = assertion("tuition", {"amount": 2}, assertion_id="two")
        unresolved = detect_conflicts([same_scope_a, same_scope_b])
        self.assertEqual(unresolved[0].state, ConflictState.NEEDS_REVIEW)
        assessment = CoverageEngine().evaluate("programme-1", "tuition", assertions=[same_scope_a, same_scope_b])
        self.assertEqual(assessment.state, AvailabilityState.CONFLICTING_SOURCES)

    def test_policy_version_is_recorded(self) -> None:
        registry = DEFAULT_FIELD_POLICY_REGISTRY.with_version("field-policy/v2")
        result = CoverageEngine(registry).evaluate("programme-1", "tuition")
        self.assertEqual(result.policy_version, "field-policy/v2")
        self.assertNotEqual(result.policy_version, DEFAULT_FIELD_POLICY_REGISTRY.version)

    def test_historical_recurrence_is_advisory_and_observation_reconciles_it(self) -> None:
        history = [
            assertion("final_deadline", "December 15", assertion_id=f"d-{year}", cycle=f"{year}-{year + 1}", temporal=TemporalState.HISTORICAL, retrieved_at=f"{year + 1}-01-01T00:00:00+00:00")
            for year in (2023, 2024, 2025)
        ]
        engine = InferenceEngine()
        inferred = engine.infer(entity_type="programme", entity_id="programme-1", field="final_deadline", target_cycle="2026-2027", assertions=history, recovery_exhausted=True)
        self.assertIsNotNone(inferred)
        assert inferred is not None
        self.assertEqual(inferred.epistemic_state, EpistemicState.INFERRED)
        self.assertFalse(inferred.product_safe)
        self.assertTrue(inferred.verification_required)
        self.assertEqual(inferred.as_assertion().temporal_state, TemporalState.TARGET_CYCLE_ESTIMATE)
        current = assertion("final_deadline", "December 20", assertion_id="current", temporal=TemporalState.CURRENT)
        reconciled = engine.reconcile(inferred, [current])
        self.assertEqual(reconciled.status, InferenceStatus.CONTRADICTED)

    def test_contradictory_history_blocks_inference(self) -> None:
        history = [
            assertion("final_deadline", value, assertion_id=f"d-{index}", cycle=f"{year}-{year + 1}", temporal=TemporalState.HISTORICAL)
            for index, (year, value) in enumerate(((2023, "December 15"), (2024, "December 20"), (2025, "December 15")))
        ]
        self.assertIsNone(InferenceEngine().infer(entity_type="programme", entity_id="programme-1", field="final_deadline", target_cycle="2026-2027", assertions=history, recovery_exhausted=True))

    def test_raw_evidence_reuse_is_remote_metadata_only(self) -> None:
        raw = RawDocument(
            raw_document_id="raw-1", source_identity="https://example.edu/programme", canonical_url="https://example.edu/programme", content_hash="abc", content_type="text/html", retrieved_at=NOW, payload_location="remote", payload_reference="bucket/key", academic_cycle="2026-2027", temporal_state=TemporalState.CURRENT,
        )
        result = RecoveryPlanner().plan(
            CoverageEngine().evaluate("programme-1", "tuition", target_cycle="2026-2027"),
            raw_documents=[raw],
        )[0]
        self.assertEqual(result.reused_raw[0].raw_document_id, "raw-1")
        self.assertFalse(result.intents)

    def test_quality_facade_exposes_observability_and_bound_is_idempotent(self) -> None:
        quality = SliceCQuality()
        first = quality.evaluate("programme-1", ["tuition"], target_cycle="2026-2027")
        self.assertEqual(first.metrics.state_counts[AvailabilityState.NOT_EVALUATED.value], 1)
        self.assertEqual(len(first.recovery_decisions[0].intents), 1)
        second = quality.evaluate("programme-1", ["tuition"], target_cycle="2026-2027", prior_recovery=first.recovery_decisions)
        self.assertFalse(second.recovery_decisions[0].intents)
        self.assertTrue(second.recovery_decisions[0].exhausted)


if __name__ == "__main__":
    unittest.main()
