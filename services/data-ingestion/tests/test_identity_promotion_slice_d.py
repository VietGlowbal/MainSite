from __future__ import annotations

import threading
import unittest
from pathlib import Path

from glowbal_ingestion.identity import (
    IdentityDecision,
    IdentityIdentifier,
    IdentityRegistry,
    InstitutionRole,
    InstitutionRoleAssignment,
    ProgrammeIdentityResolver,
    ProgrammeObservation,
    ProgrammeRelationEvent,
    ProgrammeRelationship,
    UniversityIdentityResolver,
    UniversityObservation,
)
from glowbal_ingestion.models import (
    ApplicabilityState,
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    TemporalState,
    VerificationStatus,
)
from glowbal_ingestion.inference import InferenceRecord, InferenceStatus
from glowbal_ingestion.product_read import ProductSafeReadModel, ReadExposure
from glowbal_ingestion.product_safety import (
    AssertionLineage,
    ProductLifecycleState,
    ProductSafetyContract,
)
from glowbal_ingestion.promotion_v3 import PromotionV3
from glowbal_ingestion.quality_models import (
    AvailabilityState,
    ConflictState,
    CoverageAssessment,
    VerificationDimension,
)


NOW = "2026-08-29T10:00:00+00:00"


def programme_observation(
    observation_id: str,
    *,
    university_id: str | None = "university-1",
    title: str = "Computer Science",
    url: str | None = None,
    credential: str | None = "Master of Science",
    code: str | None = "CS-MSC",
    cycle: str | None = "2026-2027",
    sources: tuple[str, ...] = (),
    roles: tuple[InstitutionRoleAssignment, ...] = (),
) -> ProgrammeObservation:
    return ProgrammeObservation(
        observation_id=observation_id,
        university_id=university_id,
        programme_name=title,
        official_url=url or f"https://example.edu/programmes/{observation_id}",
        degree_level="master",
        credential=credential,
        academic_unit="School of Computing",
        academic_cycle=cycle,
        official_programme_code=code,
        source_assertion_ids=sources,
        official_source_ids=sources,
        institution_roles=roles,
        retrieved_at=NOW,
    )


def assertion(
    field: str,
    value: object,
    assertion_id: str,
    *,
    cycle: str = "2026-2027",
    epistemic: EpistemicState = EpistemicState.OBSERVED,
    temporal: TemporalState = TemporalState.CURRENT,
) -> FieldAssertion:
    return FieldAssertion(
        assertion_id=assertion_id,
        entity_type="programme",
        entity_id="programme-entity-1",
        field_name=field,
        value_json=value,
        null_reason=None,
        source_url="https://example.edu/programmes/current",
        source_type="official",
        evidence="Official current programme evidence.",
        evidence_locator="#fees",
        scope="programme",
        audience="international",
        academic_cycle=cycle,
        retrieved_at=NOW,
        confidence=0.9,
        verification_status=VerificationStatus.RULE_VALIDATED,
        extractor_version="test",
        model_name=None,
        epistemic_state=epistemic,
        temporal_state=temporal,
        source_authority=SourceAuthority.OFFICIAL,
        raw_document_id=f"raw-{assertion_id}",
    )


def assessment(
    field: str,
    assertion_id: str,
    *,
    state: AvailabilityState = AvailabilityState.FOUND,
    acceptable: bool = True,
    temporal: TemporalState = TemporalState.CURRENT,
    epistemic: EpistemicState = EpistemicState.OBSERVED,
    inferred: bool = False,
    conflict_state: ConflictState = ConflictState.NONE,
    authority: SourceAuthority | None = SourceAuthority.OFFICIAL,
    applicability: ApplicabilityState = ApplicabilityState.APPLICABLE,
) -> CoverageAssessment:
    return CoverageAssessment(
        entity="programme-entity-1",
        entity_type="programme",
        entity_id="programme-entity-1",
        field=field,
        field_group="finance" if field == "tuition" else "deadline_intake",
        target_cycle="2026-2027",
        audience="international",
        state=state,
        critical=True,
        terminal=acceptable,
        acceptable=acceptable,
        supporting_assertion_ids=(assertion_id,),
        temporal_state=temporal,
        epistemic_state=epistemic,
        verification=VerificationDimension.VALIDATED,
        authority=authority,
        applicability=applicability,
        conflict_state=conflict_state,
        inferred=inferred,
        verification_required=inferred,
    )


def lineage(*ids: str) -> dict[str, AssertionLineage]:
    return {
        item: AssertionLineage(
            assertion_id=item,
            source_id=f"source-{item}",
            raw_document_id=f"raw-{item}",
        )
        for item in ids
    }


class IdentityTests(unittest.TestCase):
    def test_yearly_url_change_reuses_identity_and_adds_alias_version(self) -> None:
        resolver = ProgrammeIdentityResolver()
        first = resolver.resolve(
            programme_observation(
                "2025",
                url="https://example.edu/catalog/2025/cs",
                cycle="2025-2026",
            )
        )
        self.assertEqual(first.decision.decision, IdentityDecision.CREATED)
        self.assertIsNotNone(first.identity)
        second = resolver.resolve(
            programme_observation("2026", url="https://example.edu/catalog/2026/cs"),
            [first.identity],
        )
        self.assertEqual(second.decision.decision, IdentityDecision.RESOLVED)
        self.assertEqual(second.identity.programme_entity_id, first.identity.programme_entity_id)
        self.assertEqual(len(second.identity.aliases), 2)
        self.assertEqual(len(second.identity.versions), 2)

    def test_credential_and_institution_are_identity_bound(self) -> None:
        resolver = ProgrammeIdentityResolver()
        bachelor = resolver.resolve(
            programme_observation("bs", title="Computer Science", credential="Bachelor of Science", code="CS-BS")
        )
        master = resolver.resolve(
            programme_observation("ms", title="Computer Science", credential="Master of Science", code="CS-MS"),
            [bachelor.identity],
        )
        other_university = resolver.resolve(
            programme_observation("other", university_id="university-2", code="CS-BS"),
            [bachelor.identity, master.identity],
        )
        self.assertNotEqual(bachelor.identity.programme_entity_id, master.identity.programme_entity_id)
        self.assertEqual(other_university.decision.decision, IdentityDecision.CREATED)
        self.assertNotEqual(other_university.identity.programme_entity_id, bachelor.identity.programme_entity_id)

    def test_translation_requires_identifier_or_corroborated_official_evidence(self) -> None:
        resolver = ProgrammeIdentityResolver()
        original = resolver.resolve(programme_observation("original", code="CS-MSC"))
        translated = resolver.resolve(
            programme_observation("translated", title="Informatique", code="CS-MSC"),
            [original.identity],
        )
        ambiguous = resolver.resolve(
            programme_observation("ambiguous", title="Computer Science", code=None, sources=("one-source",)),
            [original.identity],
        )
        self.assertEqual(translated.decision.decision, IdentityDecision.RESOLVED)
        self.assertEqual(ambiguous.decision.decision, IdentityDecision.UNMATCHED)

    def test_joint_programme_has_one_entity_and_explicit_roles(self) -> None:
        roles = (
            InstitutionRoleAssignment("university-1", InstitutionRole.AWARDING, ("a1",)),
            InstitutionRoleAssignment("university-2", InstitutionRole.PARTNER, ("a2",)),
        )
        result = ProgrammeIdentityResolver().resolve(
            programme_observation("joint", roles=roles, sources=("joint-a", "joint-b"))
        )
        self.assertEqual(result.decision.decision, IdentityDecision.CREATED)
        self.assertEqual({item.role for item in result.identity.institution_roles}, {InstitutionRole.AWARDING, InstitutionRole.PARTNER})
        relationship = ProgrammeRelationship("one", "two", ProgrammeRelationEvent.SUCCESSOR_OF, ("a",))
        self.assertEqual(relationship.to_dict()["relation_event"], "SUCCESSOR_OF")

    def test_university_names_are_not_global_identity_and_domain_change_is_versioned(self) -> None:
        resolver = UniversityIdentityResolver()
        sparse_a = resolver.resolve(UniversityObservation("a", "Central University", "US"))
        sparse_b = resolver.resolve(UniversityObservation("b", "Central University", "GB"))
        self.assertIsNone(sparse_a.identity)
        self.assertIsNone(sparse_b.identity)
        original = resolver.resolve(
            UniversityObservation(
                "c",
                "Central University",
                "US",
                identifiers=(IdentityIdentifier("government", "us-123"),),
                domain="central.edu",
                domain_verified=True,
            ),
            create_if_missing=True,
        )
        renamed = resolver.resolve(
            UniversityObservation(
                "d",
                "Central University Rebranded",
                "US",
                identifiers=(IdentityIdentifier("government", "us-123"),),
                domain="central-rebranded.edu",
                domain_verified=True,
            ),
            [original.identity],
        )
        self.assertEqual(renamed.identity.university_id, original.identity.university_id)
        self.assertEqual(len(renamed.identity.domain_claims), 2)

    def test_registry_serializes_concurrent_creation_to_one_identity(self) -> None:
        registry = IdentityRegistry()
        results = []

        def resolve() -> None:
            results.append(registry.resolve_programme(programme_observation("same")))

        workers = [threading.Thread(target=resolve) for _ in range(8)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(len(registry.programmes()), 1)
        self.assertEqual({item.identity.programme_entity_id for item in results}, {registry.programmes()[0].programme_entity_id})


class ProductSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.identity = ProgrammeIdentityResolver().resolve(programme_observation("identity")).identity
        self.contract = ProductSafetyContract(critical_fields=("tuition", "final_deadline"))
        self.assertions = (
            assertion("tuition", {"amount": 15000, "currency": "USD"}, "tuition-1"),
            assertion("final_deadline", "December 15", "deadline-1"),
        )
        self.assessments = (
            assessment("tuition", "tuition-1"),
            assessment("final_deadline", "deadline-1"),
        )

    def evaluate(self, **kwargs):
        assertion_lineage = kwargs.pop("assertion_lineage", lineage("tuition-1", "deadline-1"))
        return self.contract.evaluate(
            identity=self.identity,
            assessments=self.assessments,
            assertion_lineage=assertion_lineage,
            **kwargs,
        )

    def test_good_entity_is_product_safe(self) -> None:
        result = self.evaluate(target_cycle="2026-2027", audience="international")
        self.assertEqual(result.state, ProductLifecycleState.PRODUCT_SAFE)
        self.assertTrue(result.eligible)

    def test_missing_stale_inferred_conflict_identity_and_lineage_block(self) -> None:
        missing = self.contract.evaluate(
            identity=self.identity,
            assessments=(self.assessments[0],),
            assertion_lineage=lineage("tuition-1"),
        )
        self.assertIn("MISSING_CRITICAL_FIELD", missing.blockers)
        stale = self.contract.evaluate(
            identity=self.identity,
            assessments=(assessment("tuition", "tuition-1", state=AvailabilityState.STALE_ONLY), self.assessments[1]),
            assertion_lineage=lineage("tuition-1", "deadline-1"),
        )
        self.assertIn("STALE_CRITICAL_FIELD", stale.blockers)
        inferred = self.contract.evaluate(
            identity=self.identity,
            assessments=(assessment("tuition", "tuition-1", epistemic=EpistemicState.INFERRED, inferred=True), self.assessments[1]),
            assertion_lineage=lineage("tuition-1", "deadline-1"),
        )
        self.assertIn("INFERRED_HIGH_VOLATILITY_CRITICAL", inferred.blockers)
        conflict = self.contract.evaluate(
            identity=self.identity,
            assessments=(assessment("tuition", "tuition-1", state=AvailabilityState.CONFLICTING_SOURCES, acceptable=False, conflict_state=ConflictState.NEEDS_REVIEW), self.assessments[1]),
            assertion_lineage=lineage("tuition-1", "deadline-1"),
        )
        self.assertIn("UNRESOLVED_CONFLICT", conflict.blockers)
        unresolved_identity = self.contract.evaluate(
            identity=None,
            assessments=self.assessments,
            assertion_lineage=lineage("tuition-1", "deadline-1"),
        )
        self.assertIn("IDENTITY_UNRESOLVED", unresolved_identity.blockers)
        no_lineage = self.evaluate(target_cycle="2026-2027", audience="international", assertion_lineage={})
        self.assertIn("RAW_LINEAGE_MISSING", no_lineage.blockers)

    def test_unresolved_identity_decision_blocks_even_with_candidate_object(self) -> None:
        decision = ProgrammeIdentityResolver().resolve(
            programme_observation("ambiguous", code=None, sources=("one",))
        ).decision
        result = self.evaluate(identity_decision=decision)
        self.assertIn("IDENTITY_UNRESOLVED", result.blockers)

    def test_retirement_is_separate_from_crawl_completion(self) -> None:
        result = self.evaluate(entity_status="DISCONTINUED")
        self.assertEqual(result.state, ProductLifecycleState.RETIRED)
        self.assertFalse(result.eligible)

    def test_policy_versions_are_recorded_and_change_is_visible(self) -> None:
        one = self.evaluate(policy_versions={"field_policy": "field-policy/v1", "quality_policy": "product-safety/v1", "promotion_policy": "promotion-v3/v1", "identity_resolver": "identity-resolver/v1"})
        two = self.evaluate(policy_versions={"field_policy": "field-policy/v2", "quality_policy": "product-safety/v2", "promotion_policy": "promotion-v3/v1", "identity_resolver": "identity-resolver/v1"})
        self.assertNotEqual(one.policy_versions, two.policy_versions)


class PromotionAndReadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.identity = ProgrammeIdentityResolver().resolve(programme_observation("promotion")).identity
        self.contract = ProductSafetyContract(critical_fields=("tuition",))
        self.promotion = PromotionV3(contract=self.contract)

    def data(self, value: int, assertion_id: str):
        facts = (assertion("tuition", {"amount": value, "currency": "USD"}, assertion_id),)
        assessments = (assessment("tuition", assertion_id),)
        return facts, assessments

    def test_dry_run_then_idempotent_promotion_and_newer_projection_history(self) -> None:
        facts, assessments = self.data(15000, "tuition-a")
        dry = self.promotion.promote(
            run_id="run-1",
            identity=self.identity,
            assessments=assessments,
            assertions=facts,
            target_cycle="2026-2027",
            audience="international",
            assertion_lineage=lineage("tuition-a"),
            dry_run=True,
        )
        self.assertEqual(dry.audit.result, "DRY_RUN_ELIGIBLE")
        self.assertEqual(self.promotion.store.projection(self.identity.programme_entity_id, "2026-2027"), ())
        first = self.promotion.promote(
            run_id="run-1",
            identity=self.identity,
            assessments=assessments,
            assertions=facts,
            target_cycle="2026-2027",
            audience="international",
            assertion_lineage=lineage("tuition-a"),
            dry_run=False,
        )
        second = self.promotion.promote(
            run_id="run-1",
            identity=self.identity,
            assessments=assessments,
            assertions=facts,
            target_cycle="2026-2027",
            audience="international",
            assertion_lineage=lineage("tuition-a"),
            dry_run=False,
        )
        self.assertEqual(first.audit.result, "PROMOTED")
        self.assertEqual(second.audit.result, "NOOP_IDEMPOTENT")
        self.assertEqual(len(self.promotion.store.history(self.identity.programme_entity_id, "2026-2027")), 1)
        newer_facts, newer_assessments = self.data(16000, "tuition-b")
        newer = self.promotion.promote(
            run_id="run-2",
            identity=self.identity,
            assessments=newer_assessments,
            assertions=newer_facts,
            target_cycle="2026-2027",
            audience="international",
            assertion_lineage=lineage("tuition-b"),
            dry_run=False,
        )
        self.assertEqual(newer.audit.result, "PROMOTED")
        self.assertEqual(len(self.promotion.store.history(self.identity.programme_entity_id, "2026-2027")), 2)
        read = ProductSafeReadModel(self.promotion.store)
        value = read.read_current(self.identity.programme_entity_id, "2026-2027")["tuition"]
        self.assertEqual(value.value["amount"], 16000)
        self.assertEqual(value.exposure, ReadExposure.VERIFIED_CURRENT)
        self.assertEqual(value.raw_document_id, "raw-tuition-b")

    def test_blocked_promotion_and_differential_never_read_as_verified(self) -> None:
        facts, _ = self.data(15000, "tuition-c")
        missing = self.promotion.promote(
            run_id="run-blocked",
            identity=self.identity,
            assessments=(),
            assertions=facts,
            target_cycle="2026-2027",
            assertion_lineage=lineage("tuition-c"),
            dry_run=False,
        )
        self.assertIn("MISSING_CRITICAL_FIELD", missing.audit.blocked_reasons)
        report = self.promotion.differential_report(missing.evaluation, legacy_would_promote=True)
        self.assertTrue(report.outcome_differs)
        snapshot = ProductSafeReadModel(self.promotion.store).read_snapshot(self.identity.programme_entity_id, "2026-2027")
        self.assertEqual(snapshot.verified_current, {})
        self.assertIn("MISSING_CRITICAL_FIELD", snapshot.blocking_reasons)

    def test_legacy_path_can_be_compared_without_being_replaced(self) -> None:
        facts, assessments = self.data(15000, "tuition-d")
        evaluation = self.promotion.evaluate(
            run_id="run-legacy",
            identity=self.identity,
            assessments=assessments,
            assertions=facts,
            target_cycle="2026-2027",
            assertion_lineage=lineage("tuition-d"),
        )
        report = self.promotion.differential_report(evaluation, legacy_would_promote=True)
        self.assertFalse(report.outcome_differs)
        self.assertTrue(evaluation.eligible)

    def test_advisory_inference_is_separate_from_verified_current_read(self) -> None:
        facts, _ = self.data(15000, "tuition-advisory")
        blocked = self.promotion.promote(
            run_id="run-advisory",
            identity=self.identity,
            assessments=(),
            assertions=facts,
            target_cycle="2026-2027",
            assertion_lineage=lineage("tuition-advisory"),
            dry_run=False,
        )
        inference = InferenceRecord(
            inference_id="inference-1",
            entity_type="programme",
            entity_id=self.identity.programme_entity_id,
            field="tuition",
            target_cycle="2026-2027",
            predicted_value={"amount": 15000, "currency": "USD"},
            supporting_assertion_ids=("historical-a", "historical-b"),
            supporting_raw_document_ids=("raw-historical-a",),
            status=InferenceStatus.ACTIVE,
        )
        snapshot = ProductSafeReadModel(self.promotion.store).read_snapshot(
            self.identity.programme_entity_id,
            "2026-2027",
            inferences=(inference,),
        )
        self.assertEqual(snapshot.state, ProductLifecycleState.PARTIAL)
        self.assertEqual(snapshot.verified_current, {})
        self.assertEqual(snapshot.advisory_estimates["tuition"].exposure, ReadExposure.ADVISORY_INFERRED)
        self.assertEqual(blocked.audit.result, "BLOCKED")


class MigrationContractTests(unittest.TestCase):
    def test_identity_promotion_migration_is_additive_and_keeps_legacy_rpc(self) -> None:
        migration = Path(__file__).resolve().parents[3] / "supabase-identity-promotion-v3.sql"
        sql = " ".join(migration.read_text(encoding="utf-8").lower().split())
        self.assertNotIn("drop table", sql)
        for table in (
            "programme_entities",
            "programme_identifiers",
            "programme_aliases",
            "programme_offerings_v3",
            "programme_relationships_v3",
            "university_identifiers_v3",
            "university_domain_claims_v3",
            "identity_decisions_v3",
            "programme_quality_evaluations_v3",
            "promotion_evaluations_v3",
            "promotion_audit_v3",
            "canonical_field_projection_history_v3",
        ):
            self.assertIn(f"create table if not exists public.{table}", sql)
        self.assertIn("add column if not exists programme_entity_id uuid", sql)
        self.assertIn("v_product_safe_programmes_v3", sql)
        self.assertIn("epistemic_state <> 'inferred'", sql)
        self.assertNotIn("create or replace function public.promote_crawl_run(", sql)
        self.assertNotIn("raw_body", sql)


if __name__ == "__main__":
    unittest.main()
