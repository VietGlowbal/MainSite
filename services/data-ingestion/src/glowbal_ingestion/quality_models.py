"""Staging quality contracts used between evidence and future promotion.

The quality layer deliberately keeps availability, epistemic status, temporal
validity, verification, authority, applicability, and conflict independent.
These records contain references to evidence; they never contain raw bodies.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field as dataclass_field
from typing import Any

from .models import (
    ApplicabilityState,
    EpistemicState,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    JsonRecord,
    utc_now_iso,
)


class AvailabilityState(str, enum.Enum):
    NOT_EVALUATED = "NOT_EVALUATED"
    FOUND = "FOUND"
    NOT_PUBLISHED = "NOT_PUBLISHED"
    NOT_REQUIRED = "NOT_REQUIRED"
    SOURCE_NOT_FOUND = "SOURCE_NOT_FOUND"
    ACCESS_BLOCKED = "ACCESS_BLOCKED"
    FETCH_FAILED = "FETCH_FAILED"
    PARSE_FAILED = "PARSE_FAILED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    STALE_ONLY = "STALE_ONLY"
    CONFLICTING_SOURCES = "CONFLICTING_SOURCES"
    NEEDS_REVIEW = "NEEDS_REVIEW"


# Friendly aliases for callers that use the language from the product spec.
FieldAvailability = AvailabilityState
CoverageState = AvailabilityState
SemanticFieldState = AvailabilityState


class ConflictState(str, enum.Enum):
    NONE = "NONE"
    DETECTED = "DETECTED"
    AUTO_RESOLVED = "AUTO_RESOLVED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class VerificationDimension(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    VALIDATED = "VALIDATED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    HUMAN_VERIFIED = "HUMAN_VERIFIED"


class Criticality(str, enum.Enum):
    OPTIONAL = "OPTIONAL"
    CONTEXTUAL = "CONTEXTUAL"
    REQUIRED = "REQUIRED"


class Volatility(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ProgrammeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DISCONTINUED = "DISCONTINUED"
    HISTORICAL = "HISTORICAL"
    UNKNOWN = "UNKNOWN"


class ScholarshipStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    UPCOMING = "UPCOMING"
    EXPIRED_BUT_RECURRING = "EXPIRED_BUT_RECURRING"
    EXPIRED_HISTORICAL = "EXPIRED_HISTORICAL"
    DISCONTINUED = "DISCONTINUED"
    UNKNOWN = "UNKNOWN"


def verification_dimension(status: VerificationStatus | str) -> VerificationDimension:
    """Map the existing assertion status without replacing it."""

    value = status.value if isinstance(status, VerificationStatus) else str(status)
    if value == VerificationStatus.HUMAN_VERIFIED.value:
        return VerificationDimension.HUMAN_VERIFIED
    if value in {
        VerificationStatus.RULE_VALIDATED.value,
        VerificationStatus.FETCHED.value,
    }:
        return VerificationDimension.VALIDATED
    if value == VerificationStatus.NEEDS_REVIEW.value:
        return VerificationDimension.NEEDS_REVIEW
    return VerificationDimension.UNVERIFIED


@dataclass(frozen=True)
class CoverageAssessment(JsonRecord):
    """One field's quality result for one entity/context."""

    entity: str | None = None
    field: str = ""
    field_group: str = ""
    target_cycle: str | None = None
    audience: str | None = None
    state: AvailabilityState = AvailabilityState.NOT_EVALUATED
    critical: bool = False
    terminal: bool = False
    acceptable: bool = False
    supporting_assertion_ids: tuple[str, ...] = ()
    blocking_reason: str | None = None
    next_action: str | None = None
    policy_version: str = "field-policy/v1"
    evaluated_at: str = dataclass_field(default_factory=utc_now_iso)
    entity_type: str | None = None
    entity_id: str | None = None
    temporal_state: TemporalState = TemporalState.UNKNOWN
    epistemic_state: EpistemicState | None = None
    verification: VerificationDimension = VerificationDimension.UNVERIFIED
    authority: SourceAuthority | None = None
    relationship: SourceRelationship | None = None
    applicability: ApplicabilityState = ApplicabilityState.UNKNOWN
    conflict_state: ConflictState = ConflictState.NONE
    verification_required: bool = False
    inferred: bool = False

    def __post_init__(self) -> None:
        ids = tuple(dict.fromkeys(str(value) for value in self.supporting_assertion_ids if value))
        object.__setattr__(self, "supporting_assertion_ids", ids)
        if self.entity_id is None and self.entity is not None:
            entity = self.entity
            if isinstance(entity, dict):
                candidate = entity.get("entity_id") or entity.get("id")
                if candidate:
                    object.__setattr__(self, "entity_id", str(candidate))
            elif hasattr(entity, "entity_id"):
                object.__setattr__(self, "entity_id", str(entity.entity_id))

    @property
    def is_product_safe(self) -> bool:
        """Slice C's conservative gate; Slice D may impose stricter rules."""

        return (
            self.acceptable
            and self.state in {AvailabilityState.FOUND, AvailabilityState.NOT_REQUIRED, AvailabilityState.NOT_PUBLISHED}
            and not self.inferred
            and not self.verification_required
            and self.conflict_state not in {ConflictState.DETECTED, ConflictState.NEEDS_REVIEW}
        )


@dataclass(frozen=True)
class QualityMetrics(JsonRecord):
    """Observability counters that do not pretend to be a truth score."""

    state_counts: dict[str, int] = dataclass_field(default_factory=dict)
    group_state_counts: dict[str, int] = dataclass_field(default_factory=dict)
    critical_unresolved: int = 0
    recovery_intents: int = 0
    recovery_successes: int = 0
    recovery_exhausted: int = 0
    conflicts_detected: int = 0
    conflicts_auto_resolved: int = 0
    conflicts_for_review: int = 0
    historical_only: int = 0
    inferences_generated: int = 0
    inferences_blocked: int = 0
    inference_confidence: tuple[float, ...] = ()


@dataclass(frozen=True)
class QualityEvaluation(JsonRecord):
    """Shadow result combining evaluation outputs without changing promotion."""

    assessments: tuple[CoverageAssessment, ...] = ()
    conflicts: tuple[Any, ...] = ()
    recovery_decisions: tuple[Any, ...] = ()
    inferences: tuple[Any, ...] = ()
    metrics: QualityMetrics = dataclass_field(default_factory=QualityMetrics)
    policy_version: str = "field-policy/v1"
    evaluated_at: str = dataclass_field(default_factory=utc_now_iso)
