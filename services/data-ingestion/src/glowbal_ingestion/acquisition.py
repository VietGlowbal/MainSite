"""Acquisition records shared by discovery adapters and orchestration.

These are deliberately evidence-acquisition records, not facts. They can be
serialized into staging/audit stores before a later slice decides whether any
extracted assertion is valid or promotable.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any, Literal

from .models import (
    JsonRecord,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    stable_id,
    utc_now_iso,
)


EntityType = Literal["UNIVERSITY", "PROGRAMME", "PROGRAMME_OFFERING", "SCHOLARSHIP"]


class AcquisitionFailureCode(str, enum.Enum):
    """Failure classification before assertion/coverage semantics begin."""

    SOURCE_DISCOVERY_FAILED = "SOURCE_DISCOVERY_FAILED"
    NO_SOURCE_CANDIDATES = "NO_SOURCE_CANDIDATES"
    SOURCE_REJECTED_BY_POLICY = "SOURCE_REJECTED_BY_POLICY"
    FETCH_FAILED = "FETCH_FAILED"
    RAW_PERSIST_FAILED = "RAW_PERSIST_FAILED"
    PARSE_FAILED = "PARSE_FAILED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"


def _nonempty(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{label} must not be empty.")
    return normalized


@dataclass(frozen=True)
class EntityRef(JsonRecord):
    entity_type: EntityType
    entity_id: str

    def __post_init__(self) -> None:
        _nonempty(self.entity_id, "entity_id")


@dataclass(frozen=True)
class AcquisitionIntent(JsonRecord):
    """A field-directed request for sources; it never instructs a crawl."""

    intent_id: str
    entity: EntityRef
    field_groups: tuple[str, ...]
    reason: str
    target_cycle: str | None = None
    audience: str | None = None
    preferred_source_classes: tuple[str, ...] = ()
    minimum_authority: SourceAuthority | None = None
    freshness_requirement: str | None = None
    priority: int = 0
    budget_policy_id: str | None = None
    policy_version: str = "acquisition-intent/v1"
    created_at: str = field(default_factory=utc_now_iso)

    def __post_init__(self) -> None:
        _nonempty(self.intent_id, "intent_id")
        _nonempty(self.reason, "reason")
        groups = tuple(dict.fromkeys(_nonempty(group, "field_group") for group in self.field_groups))
        if not groups:
            raise ValueError("AcquisitionIntent requires at least one field group.")
        object.__setattr__(self, "field_groups", groups)
        object.__setattr__(self, "preferred_source_classes", tuple(dict.fromkeys(
            _nonempty(value, "preferred_source_class") for value in self.preferred_source_classes
        )))

    @classmethod
    def create(
        cls,
        *,
        entity: EntityRef,
        field_groups: tuple[str, ...],
        reason: str,
        target_cycle: str | None = None,
        audience: str | None = None,
        preferred_source_classes: tuple[str, ...] = (),
        minimum_authority: SourceAuthority | None = None,
        freshness_requirement: str | None = None,
        priority: int = 0,
        budget_policy_id: str | None = None,
    ) -> "AcquisitionIntent":
        intent_id = stable_id(
            "acquisition-intent",
            entity.entity_type,
            entity.entity_id,
            ",".join(field_groups),
            target_cycle or "",
            audience or "",
            reason,
        )
        return cls(
            intent_id=intent_id,
            entity=entity,
            field_groups=field_groups,
            reason=reason,
            target_cycle=target_cycle,
            audience=audience,
            preferred_source_classes=preferred_source_classes,
            minimum_authority=minimum_authority,
            freshness_requirement=freshness_requirement,
            priority=priority,
            budget_policy_id=budget_policy_id,
        )


@dataclass(frozen=True)
class SourceCandidate(JsonRecord):
    """A potential document/resource; discovery is not evidence acceptance."""

    candidate_id: str
    canonical_locator: str
    locator_type: str
    source_class: str
    publisher_key: str | None = None
    relationship: SourceRelationship | None = None
    relationship_evidence: tuple[str, ...] = ()
    declared_authority: SourceAuthority | None = None
    expected_field_groups: tuple[str, ...] = ()
    language: str | None = None
    academic_cycle: str | None = None
    estimated_freshness: str | None = None
    discovery_method: str | None = None
    discovery_evidence: str | None = None
    fetch_strategy: str | None = None
    cost_class: str | None = None
    adapter_id: str | None = None
    adapter_version: str | None = None
    provider_id: str | None = None
    dataset_id: str | None = None
    retrieved_at: str | None = None
    temporal_state: TemporalState = TemporalState.UNKNOWN
    source_identity: str | None = None
    raw_document_id: str | None = None
    adapter_metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _nonempty(self.candidate_id, "candidate_id")
        _nonempty(self.canonical_locator, "canonical_locator")
        _nonempty(self.locator_type, "locator_type")
        _nonempty(self.source_class, "source_class")
        object.__setattr__(self, "expected_field_groups", tuple(dict.fromkeys(
            _nonempty(value, "expected_field_group") for value in self.expected_field_groups
        )))
        object.__setattr__(self, "relationship_evidence", tuple(dict.fromkeys(
            _nonempty(value, "relationship_evidence") for value in self.relationship_evidence
        )))

    @classmethod
    def create(
        cls,
        *,
        canonical_locator: str,
        locator_type: str,
        source_class: str,
        adapter_id: str,
        publisher_key: str | None = None,
        relationship: SourceRelationship | None = None,
        relationship_evidence: tuple[str, ...] = (),
        declared_authority: SourceAuthority | None = None,
        expected_field_groups: tuple[str, ...] = (),
        language: str | None = None,
        academic_cycle: str | None = None,
        estimated_freshness: str | None = None,
        discovery_method: str | None = None,
        discovery_evidence: str | None = None,
        fetch_strategy: str | None = None,
        cost_class: str | None = None,
        adapter_version: str | None = None,
        provider_id: str | None = None,
        dataset_id: str | None = None,
        retrieved_at: str | None = None,
        temporal_state: TemporalState = TemporalState.UNKNOWN,
        source_identity: str | None = None,
        raw_document_id: str | None = None,
        adapter_metadata: dict[str, Any] | None = None,
    ) -> "SourceCandidate":
        candidate_id = stable_id(
            "source-candidate",
            adapter_id,
            provider_id or "",
            dataset_id or "",
            canonical_locator,
            academic_cycle or "",
        )
        return cls(
            candidate_id=candidate_id,
            canonical_locator=canonical_locator,
            locator_type=locator_type,
            source_class=source_class,
            publisher_key=publisher_key,
            relationship=relationship,
            relationship_evidence=relationship_evidence,
            declared_authority=declared_authority,
            expected_field_groups=expected_field_groups,
            language=language,
            academic_cycle=academic_cycle,
            estimated_freshness=estimated_freshness,
            discovery_method=discovery_method,
            discovery_evidence=discovery_evidence,
            fetch_strategy=fetch_strategy,
            cost_class=cost_class,
            adapter_id=adapter_id,
            adapter_version=adapter_version,
            provider_id=provider_id,
            dataset_id=dataset_id,
            retrieved_at=retrieved_at,
            temporal_state=temporal_state,
            source_identity=source_identity,
            raw_document_id=raw_document_id,
            adapter_metadata=dict(adapter_metadata or {}),
        )


@dataclass(frozen=True)
class AcquisitionAttempt(JsonRecord):
    attempt_id: str
    intent_id: str | None
    candidate_id: str | None
    status: str
    started_at: str = field(default_factory=utc_now_iso)
    finished_at: str | None = None
    error_code: AcquisitionFailureCode | None = None
    retryable: bool = False
    run_id: str | None = None
    raw_document_id: str | None = None
    admission_reason: str | None = None
    source_class: str | None = None

    def __post_init__(self) -> None:
        _nonempty(self.attempt_id, "attempt_id")
        _nonempty(self.status, "status")

    @classmethod
    def create(
        cls,
        *,
        intent_id: str | None,
        candidate_id: str | None,
        status: str,
        run_id: str | None = None,
        error_code: AcquisitionFailureCode | None = None,
        retryable: bool = False,
        raw_document_id: str | None = None,
        finished_at: str | None = None,
        admission_reason: str | None = None,
        source_class: str | None = None,
        adapter_id: str | None = None,
        discriminator: str | None = None,
    ) -> "AcquisitionAttempt":
        return cls(
            attempt_id=stable_id(
                "acquisition-attempt",
                intent_id or "",
                candidate_id or "",
                status,
                run_id or "",
                adapter_id or "",
                discriminator or "",
            ),
            intent_id=intent_id,
            candidate_id=candidate_id,
            status=status,
            run_id=run_id,
            error_code=error_code,
            retryable=retryable,
            raw_document_id=raw_document_id,
            finished_at=finished_at,
            admission_reason=admission_reason,
            source_class=source_class,
        )
