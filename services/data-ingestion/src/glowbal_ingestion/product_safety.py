"""Versioned Product Safety Contract for the Slice D promotion boundary."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable, Mapping

from .field_policy import DEFAULT_FIELD_POLICY_REGISTRY, FieldPolicyRegistry
from .identity import IdentityDecisionRecord, ProgrammeIdentity
from .models import (
    ApplicabilityState,
    EpistemicState,
    SourceAuthority,
    TemporalState,
)
from .quality_models import (
    AvailabilityState,
    ConflictState,
    CoverageAssessment,
    Volatility,
)


class ProductLifecycleState(str, Enum):
    DISCOVERED = "DISCOVERED"
    PARTIAL = "PARTIAL"
    REVIEWABLE = "REVIEWABLE"
    PRODUCT_SAFE = "PRODUCT_SAFE"
    REJECTED = "REJECTED"
    RETIRED = "RETIRED"


BLOCKERS = frozenset(
    {
        "MISSING_CRITICAL_FIELD",
        "STALE_CRITICAL_FIELD",
        "UNRESOLVED_CONFLICT",
        "IDENTITY_UNRESOLVED",
        "INFERRED_HIGH_VOLATILITY_CRITICAL",
        "INSUFFICIENT_AUTHORITY",
        "RAW_LINEAGE_MISSING",
        "REVIEW_REQUIRED",
        "RETIRED_ENTITY",
    }
)


def _value(value: object) -> str:
    return str(getattr(value, "value", value))


@dataclass(frozen=True)
class AssertionLineage:
    assertion_id: str
    source_id: str | None
    raw_document_id: str | None
    durable: bool = True
    source_record_id: str | None = None

    def to_dict(self) -> dict[str, object | None]:
        return {
            "assertion_id": self.assertion_id,
            "source_id": self.source_id,
            "raw_document_id": self.raw_document_id,
            "source_record_id": self.source_record_id,
            "durable": self.durable,
        }


@dataclass(frozen=True)
class CriticalFieldRule:
    field: str
    requires_current: bool = True
    allow_not_required: bool = False
    allow_not_published: bool = False
    require_lineage: bool = True


@dataclass(frozen=True)
class SafetyEvaluation:
    entity_id: str | None
    target_cycle: str | None
    audience: str | None
    state: str
    eligible: bool
    blockers: tuple[str, ...] = ()
    blocking_fields: tuple[str, ...] = ()
    critical_fields: tuple[str, ...] = ()
    policy_versions: Mapping[str, str] = field(default_factory=dict)
    identity_decision: IdentityDecisionRecord | None = None
    evaluated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )

    @property
    def is_product_safe(self) -> bool:
        return self.state == ProductLifecycleState.PRODUCT_SAFE and self.eligible

    def to_dict(self) -> dict[str, object]:
        return {
            "entity_id": self.entity_id,
            "target_cycle": self.target_cycle,
            "audience": self.audience,
            "state": self.state,
            "eligible": self.eligible,
            "blockers": list(self.blockers),
            "blocking_fields": list(self.blocking_fields),
            "critical_fields": list(self.critical_fields),
            "policy_versions": dict(self.policy_versions),
            "identity_decision": self.identity_decision.to_dict() if self.identity_decision else None,
            "evaluated_at": self.evaluated_at,
        }


class ProductSafetyContract:
    """Evaluate whether current assertions may cross the product boundary.

    The contract consumes Slice C assessments.  It does not recalculate field
    truth from confidence, and it never turns an inferred value into observed
    truth.  Critical fields are explicit and can be replaced per product
    context rather than being a universal global list.
    """

    VERSION = "product-safety/v1"

    def __init__(
        self,
        *,
        critical_fields: Iterable[str] = (
            "programme_status",
            "tuition",
            "final_deadline",
        ),
        field_policy_registry: FieldPolicyRegistry | None = None,
        version: str = VERSION,
    ) -> None:
        self.critical_fields = tuple(dict.fromkeys(str(item) for item in critical_fields))
        self.registry = field_policy_registry or DEFAULT_FIELD_POLICY_REGISTRY
        self.version = version

    def evaluate(
        self,
        *,
        identity: ProgrammeIdentity | None,
        assessments: Iterable[CoverageAssessment],
        target_cycle: str | None = None,
        audience: str | None = None,
        assertion_lineage: Mapping[str, AssertionLineage | Mapping[str, object]] | None = None,
        conflicts: Iterable[Any] = (),
        required_review_completed: bool = True,
        policy_versions: Mapping[str, str] | None = None,
        identity_decision: IdentityDecisionRecord | None = None,
        rejected: bool = False,
        entity_status: str | None = None,
    ) -> SafetyEvaluation:
        assessments_by_field = {item.field: item for item in assessments}
        lineage = assertion_lineage or {}
        versions = dict(policy_versions or {})
        if "field_policy" not in versions:
            versions["field_policy"] = self.registry.version
        versions.setdefault("quality_policy", self.version)
        versions.setdefault("promotion_policy", "promotion-v3/v1")
        versions.setdefault("identity_resolver", "identity-resolver/v1")

        blockers: list[str] = []
        fields: list[str] = []
        if identity is None:
            blockers.append("IDENTITY_UNRESOLVED")
        if identity_decision is not None and str(getattr(identity_decision.decision, "value", identity_decision.decision)) not in {"RESOLVED", "CREATED"}:
            blockers.append("IDENTITY_UNRESOLVED")
        if not all(str(value).strip() for value in versions.values()):
            blockers.append("REVIEW_REQUIRED")

        for field_name in self.critical_fields:
            assessment = assessments_by_field.get(field_name)
            rule = self._rule(field_name, target_cycle, audience)
            if assessment is None:
                blockers.append("MISSING_CRITICAL_FIELD")
                fields.append(field_name)
                continue
            reason = self._assessment_blocker(assessment, rule)
            if reason:
                blockers.append(reason)
                fields.append(field_name)
                continue
            if rule.require_lineage and not self._has_lineage(assessment, lineage):
                blockers.append("RAW_LINEAGE_MISSING")
                fields.append(field_name)

        if any(_value(item.state) == AvailabilityState.CONFLICTING_SOURCES.value for item in assessments_by_field.values()):
            if any(field_name in self.critical_fields for field_name in assessments_by_field):
                blockers.append("UNRESOLVED_CONFLICT")
        for conflict in conflicts:
            state = _value(getattr(conflict, "state", ""))
            if state in {ConflictState.NEEDS_REVIEW.value, "REQUIRES_REVIEW", "UNRESOLVABLE"}:
                conflict_field = str(getattr(conflict, "field", ""))
                if not conflict_field or conflict_field in self.critical_fields:
                    blockers.append("UNRESOLVED_CONFLICT")

        if not required_review_completed:
            blockers.append("REVIEW_REQUIRED")

        blockers = list(dict.fromkeys(item for item in blockers if item in BLOCKERS))
        fields = list(dict.fromkeys(fields))
        retired = self._is_retired(assessments_by_field.get("programme_status"), entity_status)
        if rejected:
            state = ProductLifecycleState.REJECTED
        elif retired:
            state = ProductLifecycleState.RETIRED
            blockers.append("RETIRED_ENTITY")
            blockers = list(dict.fromkeys(blockers))
        elif not assessments_by_field and not blockers:
            state = ProductLifecycleState.DISCOVERED
        elif not blockers:
            state = ProductLifecycleState.PRODUCT_SAFE
        elif any(item in {"IDENTITY_UNRESOLVED", "UNRESOLVED_CONFLICT", "REVIEW_REQUIRED"} for item in blockers):
            state = ProductLifecycleState.REVIEWABLE
        else:
            state = ProductLifecycleState.PARTIAL

        return SafetyEvaluation(
            entity_id=identity.programme_entity_id if identity else None,
            target_cycle=target_cycle,
            audience=audience,
            state=state,
            eligible=state == ProductLifecycleState.PRODUCT_SAFE,
            blockers=tuple(blockers),
            blocking_fields=tuple(fields),
            critical_fields=self.critical_fields,
            policy_versions=versions,
            identity_decision=identity_decision,
        )

    def _rule(self, field_name: str, target_cycle: str | None, audience: str | None) -> CriticalFieldRule:
        policy = self.registry.get(
            field_name,
            context={"target_cycle": target_cycle, "audience": audience},
        )
        return CriticalFieldRule(
            field=field_name,
            requires_current=bool(policy.requires_current or field_name in {"tuition", "final_deadline"}),
            allow_not_required=bool(policy.allow_not_required),
            allow_not_published=bool(policy.allow_not_published),
        )

    def _assessment_blocker(self, assessment: CoverageAssessment, rule: CriticalFieldRule) -> str | None:
        state = _value(assessment.state)
        if state == AvailabilityState.STALE_ONLY.value:
            return "STALE_CRITICAL_FIELD"
        if state in {
            AvailabilityState.SOURCE_NOT_FOUND.value,
            AvailabilityState.ACCESS_BLOCKED.value,
            AvailabilityState.FETCH_FAILED.value,
            AvailabilityState.PARSE_FAILED.value,
            AvailabilityState.EXTRACTION_FAILED.value,
            AvailabilityState.NOT_EVALUATED.value,
        }:
            return "MISSING_CRITICAL_FIELD"
        if state == AvailabilityState.CONFLICTING_SOURCES.value or _value(assessment.conflict_state) in {
            ConflictState.DETECTED.value,
            ConflictState.NEEDS_REVIEW.value,
        }:
            return "UNRESOLVED_CONFLICT"
        if state == AvailabilityState.NOT_REQUIRED.value and not rule.allow_not_required:
            return "MISSING_CRITICAL_FIELD"
        if state == AvailabilityState.NOT_PUBLISHED.value and not rule.allow_not_published:
            return "MISSING_CRITICAL_FIELD"
        if not assessment.acceptable:
            return "MISSING_CRITICAL_FIELD"
        if assessment.inferred or _value(assessment.epistemic_state) == EpistemicState.INFERRED.value:
            return "INFERRED_HIGH_VOLATILITY_CRITICAL"
        if rule.requires_current and _value(assessment.temporal_state) != TemporalState.CURRENT.value:
            return "STALE_CRITICAL_FIELD"
        if assessment.verification_required or _value(assessment.verification) in {"UNVERIFIED", "NEEDS_REVIEW"}:
            return "REVIEW_REQUIRED"
        if _value(assessment.applicability) in {
            ApplicabilityState.UNKNOWN.value,
            ApplicabilityState.NOT_APPLICABLE.value,
        }:
            return "REVIEW_REQUIRED"
        policy = self.registry.get(rule.field)
        authority = assessment.authority
        if authority is None or authority not in policy.acceptable_authorities:
            return "INSUFFICIENT_AUTHORITY"
        return None

    @staticmethod
    def _has_lineage(
        assessment: CoverageAssessment,
        lineage: Mapping[str, AssertionLineage | Mapping[str, object]],
    ) -> bool:
        if not assessment.supporting_assertion_ids:
            return False
        for assertion_id in assessment.supporting_assertion_ids:
            record = lineage.get(assertion_id)
            if record is None:
                return False
            if isinstance(record, AssertionLineage):
                if not record.durable or not record.raw_document_id:
                    return False
            elif not bool(record.get("durable", False)) or not record.get("raw_document_id"):
                return False
        return True

    @staticmethod
    def _is_retired(assessment: CoverageAssessment | None, entity_status: str | None = None) -> bool:
        if entity_status:
            return str(entity_status).upper() in {"DISCONTINUED", "HISTORICAL", "RETIRED"}
        if assessment is None or not assessment.supporting_assertion_ids:
            return False
        value = getattr(assessment, "value", None)
        # Coverage assessments intentionally reference assertions rather than
        # duplicating values.  Status retirement can be supplied by callers as
        # a small context attribute without changing the quality schema.
        status = getattr(assessment, "programme_status", None) or value
        if isinstance(status, Mapping):
            status = status.get("status") or status.get("programme_status")
        return str(status or "").upper() in {"DISCONTINUED", "HISTORICAL"}
