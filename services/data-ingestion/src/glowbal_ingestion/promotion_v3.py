"""Pure, auditable promotion-v3 boundary for Slice D.

This module plans and records a projection but does not call Supabase and does
not replace the legacy ``promote_crawl_run`` RPC.  A production adapter can
persist the returned audit/projection records through the additive migration.
"""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from .identity import IdentityDecisionRecord, ProgrammeIdentity
from .models import (
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    TemporalState,
    VerificationStatus,
    stable_id,
)
from .product_safety import ProductLifecycleState, ProductSafetyContract, SafetyEvaluation
from .quality_models import AvailabilityState, CoverageAssessment, QualityEvaluation


def _enum_value(value: object) -> str:
    return str(getattr(value, "value", value))


def _canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


@dataclass(frozen=True)
class CanonicalFieldProjection:
    field: str
    value: Any
    assertion_id: str | None
    raw_document_id: str | None
    source_id: str | None
    epistemic_state: str
    temporal_state: str
    verification_status: str
    authority: str | None
    target_cycle: str | None
    advisory: bool = False

    def to_dict(self) -> dict[str, object | None]:
        return {
            "field": self.field,
            "value": self.value,
            "assertion_id": self.assertion_id,
            "raw_document_id": self.raw_document_id,
            "source_id": self.source_id,
            "epistemic_state": self.epistemic_state,
            "temporal_state": self.temporal_state,
            "verification_status": self.verification_status,
            "authority": self.authority,
            "target_cycle": self.target_cycle,
            "advisory": self.advisory,
        }


@dataclass(frozen=True)
class PromotionEvaluation:
    promotion_id: str
    run_id: str
    entity_id: str | None
    target_cycle: str | None
    fingerprint: str
    safety: SafetyEvaluation
    proposed_projection: tuple[CanonicalFieldProjection, ...] = ()
    conflicts: tuple[dict[str, object], ...] = ()
    inference_blockers: tuple[str, ...] = ()
    dry_run: bool = True
    evaluated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )

    @property
    def eligible(self) -> bool:
        return self.safety.eligible

    @property
    def quality_state(self) -> str:
        return self.safety.state

    @property
    def blockers(self) -> tuple[str, ...]:
        return self.safety.blockers

    def to_dict(self) -> dict[str, object]:
        return {
            "promotion_id": self.promotion_id,
            "run_id": self.run_id,
            "entity_id": self.entity_id,
            "target_cycle": self.target_cycle,
            "fingerprint": self.fingerprint,
            "eligible": self.eligible,
            "quality_state": self.quality_state,
            "blockers": list(self.blockers),
            "blocking_fields": list(self.safety.blocking_fields),
            "conflicts": list(self.conflicts),
            "inference_blockers": list(self.inference_blockers),
            "proposed_projection": [item.to_dict() for item in self.proposed_projection],
            "policy_versions": dict(self.safety.policy_versions),
            "dry_run": self.dry_run,
            "evaluated_at": self.evaluated_at,
        }


@dataclass(frozen=True)
class PromotionAudit:
    attempt_id: str
    promotion_id: str
    run_id: str
    entity_id: str | None
    target_cycle: str | None
    fingerprint: str
    quality_state: str
    eligible: bool
    dry_run: bool
    result: str
    changed_fields: tuple[str, ...] = ()
    previous_values: Mapping[str, Any] = field(default_factory=dict)
    new_values: Mapping[str, Any] = field(default_factory=dict)
    blocked_reasons: tuple[str, ...] = ()
    policy_versions: Mapping[str, str] = field(default_factory=dict)
    quality_evaluation: Mapping[str, object] = field(default_factory=dict)
    idempotent_noop: bool = False
    attempted_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "attempt_id": self.attempt_id,
            "promotion_id": self.promotion_id,
            "run_id": self.run_id,
            "entity_id": self.entity_id,
            "target_cycle": self.target_cycle,
            "fingerprint": self.fingerprint,
            "quality_state": self.quality_state,
            "eligible": self.eligible,
            "dry_run": self.dry_run,
            "result": self.result,
            "changed_fields": list(self.changed_fields),
            "previous_values": dict(self.previous_values),
            "new_values": dict(self.new_values),
            "blocked_reasons": list(self.blocked_reasons),
            "policy_versions": dict(self.policy_versions),
            "quality_evaluation": dict(self.quality_evaluation),
            "idempotent_noop": self.idempotent_noop,
            "attempted_at": self.attempted_at,
        }


@dataclass(frozen=True)
class PromotionResult:
    evaluation: PromotionEvaluation
    audit: PromotionAudit
    projection: tuple[CanonicalFieldProjection, ...] = ()

    @property
    def promoted(self) -> bool:
        return self.audit.result in {"PROMOTED", "NOOP_IDEMPOTENT"}

    def to_dict(self) -> dict[str, object]:
        return {
            "evaluation": self.evaluation.to_dict(),
            "audit": self.audit.to_dict(),
            "projection": [item.to_dict() for item in self.projection],
        }


@dataclass(frozen=True)
class DifferentialReport:
    run_id: str
    entity_id: str | None
    legacy_would_promote: bool
    v3_would_promote: bool
    outcome_differs: bool
    identity_difference: str | None
    field_difference: tuple[str, ...]
    blocked_critical_fields: tuple[str, ...]
    conflicts: tuple[str, ...]
    staleness: tuple[str, ...]
    inference: tuple[str, ...]
    reasons: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "entity_id": self.entity_id,
            "legacy_would_promote": self.legacy_would_promote,
            "v3_would_promote": self.v3_would_promote,
            "outcome_differs": self.outcome_differs,
            "identity_difference": self.identity_difference,
            "field_difference": list(self.field_difference),
            "blocked_critical_fields": list(self.blocked_critical_fields),
            "conflicts": list(self.conflicts),
            "staleness": list(self.staleness),
            "inference": list(self.inference),
            "reasons": list(self.reasons),
        }


class PromotionStore:
    """Thread-safe shadow projection/audit store with forward-only history."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._projections: dict[tuple[str, str | None], dict[str, CanonicalFieldProjection]] = {}
        self._history: dict[tuple[str, str | None], list[dict[str, object]]] = {}
        self._audits: list[PromotionAudit] = []
        self._applied_fingerprints: set[str] = set()
        self._safe_evaluations: dict[tuple[str, str | None], SafetyEvaluation] = {}

    def apply(
        self,
        evaluation: PromotionEvaluation,
    ) -> tuple[str, tuple[str, ...], dict[str, Any], dict[str, Any], bool, tuple[CanonicalFieldProjection, ...]]:
        key = (evaluation.entity_id or "", evaluation.target_cycle)
        with self._lock:
            current = self._projections.setdefault(key, {})
            if evaluation.fingerprint in self._applied_fingerprints:
                return (
                    "NOOP_IDEMPOTENT",
                    (),
                    {field: value.value for field, value in current.items()},
                    {field: value.value for field, value in current.items()},
                    True,
                    tuple(current.values()),
                )
            previous = {field: value.value for field, value in current.items()}
            incoming = {item.field: item for item in evaluation.proposed_projection}
            next_values = {field: item.value for field, item in incoming.items()}
            changed = tuple(
                sorted(
                    field
                    for field in set(previous) | set(next_values)
                    if previous.get(field) != next_values.get(field)
                )
            )
            self._history.setdefault(key, []).append(
                {
                    "fingerprint": evaluation.fingerprint,
                    "at": evaluation.evaluated_at,
                    "previous_values": previous,
                    "new_values": next_values,
                    "changed_fields": list(changed),
                }
            )
            self._projections[key] = incoming
            self._applied_fingerprints.add(evaluation.fingerprint)
            self._safe_evaluations[key] = evaluation.safety
            return (
                "PROMOTED",
                changed,
                previous,
                next_values,
                False,
                tuple(incoming.values()),
            )

    def add_audit(self, audit: PromotionAudit) -> None:
        with self._lock:
            self._audits.append(audit)

    def record_safety(self, evaluation: PromotionEvaluation) -> None:
        """Retain the latest evaluated lifecycle state without projection writes."""
        if evaluation.entity_id is None:
            return
        with self._lock:
            self._safe_evaluations[(evaluation.entity_id, evaluation.target_cycle)] = evaluation.safety

    def audits(self) -> tuple[PromotionAudit, ...]:
        with self._lock:
            return tuple(self._audits)

    def history(self, entity_id: str, target_cycle: str | None = None) -> tuple[dict[str, object], ...]:
        with self._lock:
            return tuple(self._history.get((entity_id, target_cycle), ()))

    def projection(self, entity_id: str, target_cycle: str | None = None) -> tuple[CanonicalFieldProjection, ...]:
        with self._lock:
            return tuple(self._projections.get((entity_id, target_cycle), {}).values())

    def safety(self, entity_id: str, target_cycle: str | None = None) -> SafetyEvaluation | None:
        with self._lock:
            return self._safe_evaluations.get((entity_id, target_cycle))


class PromotionV3:
    """Evaluate and optionally apply a safe, versioned product projection."""

    VERSION = "promotion-v3/v1"

    def __init__(
        self,
        *,
        contract: ProductSafetyContract | None = None,
        store: PromotionStore | None = None,
    ) -> None:
        self.contract = contract or ProductSafetyContract()
        self.store = store or PromotionStore()

    def evaluate(
        self,
        *,
        run_id: str,
        identity: ProgrammeIdentity | None,
        assessments: Iterable[CoverageAssessment] = (),
        quality_evaluation: QualityEvaluation | None = None,
        assertions: Iterable[FieldAssertion] = (),
        target_cycle: str | None = None,
        audience: str | None = None,
        assertion_lineage: Mapping[str, Any] | None = None,
        conflicts: Iterable[Any] = (),
        required_review_completed: bool = True,
        policy_versions: Mapping[str, str] | None = None,
        identity_decision: IdentityDecisionRecord | None = None,
        entity_status: str | None = None,
        dry_run: bool = True,
    ) -> PromotionEvaluation:
        if quality_evaluation is not None:
            assessments = quality_evaluation.assessments
            if not conflicts:
                conflicts = quality_evaluation.conflicts
        assessments = tuple(assessments)
        assertions = tuple(assertions)
        conflicts = tuple(conflicts)
        safety = self.contract.evaluate(
            identity=identity,
            assessments=assessments,
            target_cycle=target_cycle,
            audience=audience,
            assertion_lineage=assertion_lineage,
            conflicts=conflicts,
            required_review_completed=required_review_completed,
            policy_versions=policy_versions,
            identity_decision=identity_decision,
            entity_status=entity_status,
        )
        projection = self._projection(assessments, assertions, target_cycle)
        conflict_payload = tuple(
            item.to_dict() if hasattr(item, "to_dict") else {"field": str(getattr(item, "field", "")), "state": _enum_value(getattr(item, "state", ""))}
            for item in conflicts
        )
        inference_blockers = tuple(
            assessment.field
            for assessment in assessments
            if assessment.field in self.contract.critical_fields
            and (
                assessment.inferred
                or _enum_value(assessment.epistemic_state) == EpistemicState.INFERRED.value
            )
        )
        fingerprint = self._fingerprint(
            run_id=run_id,
            identity=identity,
            assessments=assessments,
            assertions=assertions,
            target_cycle=target_cycle,
            policy_versions=safety.policy_versions,
        )
        evaluation = PromotionEvaluation(
            promotion_id=stable_id("promotion-evaluation", fingerprint),
            run_id=run_id,
            entity_id=identity.programme_entity_id if identity else None,
            target_cycle=target_cycle,
            fingerprint=fingerprint,
            safety=safety,
            proposed_projection=projection,
            conflicts=conflict_payload,
            inference_blockers=inference_blockers,
            dry_run=dry_run,
        )
        return evaluation

    def promote(
        self,
        *,
        run_id: str,
        identity: ProgrammeIdentity | None,
        assessments: Iterable[CoverageAssessment] = (),
        quality_evaluation: QualityEvaluation | None = None,
        assertions: Iterable[FieldAssertion] = (),
        target_cycle: str | None = None,
        audience: str | None = None,
        assertion_lineage: Mapping[str, Any] | None = None,
        conflicts: Iterable[Any] = (),
        required_review_completed: bool = True,
        policy_versions: Mapping[str, str] | None = None,
        identity_decision: IdentityDecisionRecord | None = None,
        entity_status: str | None = None,
        dry_run: bool = True,
    ) -> PromotionResult:
        evaluation = self.evaluate(
            run_id=run_id,
            identity=identity,
            assessments=assessments,
            quality_evaluation=quality_evaluation,
            assertions=assertions,
            target_cycle=target_cycle,
            audience=audience,
            assertion_lineage=assertion_lineage,
            conflicts=conflicts,
            required_review_completed=required_review_completed,
            policy_versions=policy_versions,
            identity_decision=identity_decision,
            entity_status=entity_status,
            dry_run=dry_run,
        )
        if not dry_run:
            self.store.record_safety(evaluation)
        changed_fields: tuple[str, ...] = ()
        previous: dict[str, Any] = {}
        new_values: dict[str, Any] = {}
        idempotent = False
        projection = evaluation.proposed_projection
        result = "DRY_RUN_ELIGIBLE" if evaluation.eligible else "BLOCKED"
        if not dry_run and evaluation.eligible:
            result, changed_fields, previous, new_values, idempotent, projection = self.store.apply(evaluation)
        attempt_number = len(self.store.audits()) + 1
        audit = PromotionAudit(
            attempt_id=stable_id("promotion-attempt", evaluation.fingerprint, str(attempt_number)),
            promotion_id=evaluation.promotion_id,
            run_id=run_id,
            entity_id=evaluation.entity_id,
            target_cycle=target_cycle,
            fingerprint=evaluation.fingerprint,
            quality_state=evaluation.quality_state,
            eligible=evaluation.eligible,
            dry_run=dry_run,
            result=result,
            changed_fields=changed_fields,
            previous_values=previous,
            new_values=new_values,
            blocked_reasons=evaluation.blockers,
            policy_versions=evaluation.safety.policy_versions,
            quality_evaluation=evaluation.safety.to_dict(),
            idempotent_noop=idempotent,
        )
        self.store.add_audit(audit)
        return PromotionResult(evaluation=evaluation, audit=audit, projection=projection)

    def differential_report(
        self,
        evaluation: PromotionEvaluation,
        *,
        legacy_would_promote: bool,
    ) -> DifferentialReport:
        blockers = evaluation.blockers
        stale = tuple(
            field
            for field in evaluation.safety.blocking_fields
            if "STALE_CRITICAL_FIELD" in blockers
        )
        return DifferentialReport(
            run_id=evaluation.run_id,
            entity_id=evaluation.entity_id,
            legacy_would_promote=legacy_would_promote,
            v3_would_promote=evaluation.eligible,
            outcome_differs=legacy_would_promote != evaluation.eligible,
            identity_difference="identity unresolved" if "IDENTITY_UNRESOLVED" in blockers else None,
            field_difference=evaluation.safety.blocking_fields,
            blocked_critical_fields=evaluation.safety.blocking_fields,
            conflicts=tuple("UNRESOLVED_CONFLICT" for item in blockers if item == "UNRESOLVED_CONFLICT"),
            staleness=stale,
            inference=tuple(evaluation.inference_blockers),
            reasons=blockers,
        )

    @staticmethod
    def _projection(
        assessments: Iterable[CoverageAssessment],
        assertions: Iterable[FieldAssertion],
        target_cycle: str | None,
    ) -> tuple[CanonicalFieldProjection, ...]:
        by_id = {item.assertion_id: item for item in assertions}
        result: list[CanonicalFieldProjection] = []
        for assessment in assessments:
            if not assessment.acceptable or assessment.state != AvailabilityState.FOUND:
                continue
            if assessment.inferred or _enum_value(assessment.epistemic_state) == EpistemicState.INFERRED.value:
                continue
            chosen = next(
                (by_id[item] for item in assessment.supporting_assertion_ids if item in by_id),
                None,
            )
            if chosen is None:
                continue
            result.append(
                CanonicalFieldProjection(
                    field=assessment.field,
                    value=chosen.value_json,
                    assertion_id=chosen.assertion_id,
                    raw_document_id=chosen.raw_document_id,
                    source_id=chosen.source_url,
                    epistemic_state=_enum_value(chosen.epistemic_state),
                    temporal_state=_enum_value(chosen.temporal_state),
                    verification_status=_enum_value(chosen.verification_status),
                    authority=_enum_value(chosen.source_authority) if chosen.source_authority else None,
                    target_cycle=target_cycle,
                )
            )
        return tuple(sorted(result, key=lambda item: item.field))

    @staticmethod
    def _fingerprint(
        *,
        run_id: str,
        identity: ProgrammeIdentity | None,
        assessments: Iterable[CoverageAssessment],
        assertions: Iterable[FieldAssertion],
        target_cycle: str | None,
        policy_versions: Mapping[str, str],
    ) -> str:
        assertion_by_id = {item.assertion_id: item for item in assertions}
        material = {
            "entity_id": identity.programme_entity_id if identity else None,
            "target_cycle": target_cycle,
            "policy_versions": dict(sorted(policy_versions.items())),
            "assessments": [
                {
                    "field": item.field,
                    "state": _enum_value(item.state),
                    "acceptable": item.acceptable,
                    "assertion_ids": list(item.supporting_assertion_ids),
                }
                for item in sorted(assessments, key=lambda value: value.field)
            ],
            "assertions": [
                {
                    "id": item.assertion_id,
                    "field": item.field_name,
                    "value": item.value_json,
                    "cycle": item.academic_cycle,
                    "audience": item.audience,
                    "epistemic": _enum_value(item.epistemic_state),
                    "temporal": _enum_value(item.temporal_state),
                    "raw_document_id": item.raw_document_id,
                }
                for item in sorted(assertion_by_id.values(), key=lambda value: value.assertion_id)
            ],
        }
        return hashlib.sha256(_canonical(material).encode("utf-8")).hexdigest()
