"""Explicit, provenance-preserving historical inference."""

from __future__ import annotations

import json
import enum
import re
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from .field_policy import FieldPolicy, FieldPolicyRegistry, DEFAULT_FIELD_POLICY_REGISTRY
from .models import (
    ApplicabilityState,
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
    stable_id,
    utc_now_iso,
)
from .quality_models import AvailabilityState, CoverageAssessment, Volatility


class InferenceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CONFIRMED = "CONFIRMED"
    SUPERSEDED = "SUPERSEDED"
    CONTRADICTED = "CONTRADICTED"
    INVALIDATED = "INVALIDATED"


def _years(value: str | None) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", str(value or ""))}


def _cycle_start(value: str | None) -> int | None:
    years = sorted(_years(value))
    return years[0] if years else None


def _value_key(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _authority_score(assertion: FieldAssertion) -> int:
    return {
        SourceAuthority.OFFICIAL: 5,
        SourceAuthority.GOVERNMENT: 5,
        SourceAuthority.OFFICIAL_PARTNER: 4,
        SourceAuthority.ACCREDITED_PROVIDER: 3,
        SourceAuthority.TRUSTED_AGGREGATOR: 2,
        SourceAuthority.ARCHIVE: 1,
    }.get(assertion.source_authority, 1)


@dataclass(frozen=True)
class InferenceRecord:
    inference_id: str
    entity_type: str
    entity_id: str
    field: str
    target_cycle: str
    predicted_value: Any
    predicted_state: str | None = None
    supporting_assertion_ids: tuple[str, ...] = ()
    supporting_raw_document_ids: tuple[str, ...] = ()
    method: str = "historical_recurrence"
    method_version: str = "inference/v1"
    confidence: float = 0.0
    generated_at: str = field(default_factory=utc_now_iso)
    volatility: Volatility | str = Volatility.MEDIUM
    horizon: int = 0
    verification_required: bool = True
    allowed_exposure: str = "ADVISORY"
    product_safe: bool = False
    status: str = InferenceStatus.ACTIVE
    supersedes_inference_id: str | None = None
    invalidation_reason: str | None = None
    # Hierarchical records use these additive fields to preserve donor and
    # heuristic uncertainty lineage. Historical recurrence keeps defaults.
    inference_level: str = "HISTORICAL_RECURRENCE"
    donor_assertion_ids: tuple[str, ...] = ()
    donor_entity_ids: tuple[str, ...] = ()
    donor_policy_lineage_ids: tuple[str, ...] = ()
    donor_source_urls: tuple[str, ...] = ()
    hierarchy_distance: int = 0
    donor_similarity_signals: dict[str, float] = field(default_factory=dict)
    support_count: int = 0
    donor_dispersion: float | None = None
    uncertainty_components: dict[str, float] = field(default_factory=dict)
    uncertainty_category: str = "INSUFFICIENT"
    uncertainty_reasons: tuple[str, ...] = ()
    cycle_compatibility: str = "UNKNOWN"
    applicability_compatibility: str = "UNKNOWN"
    conflict_state: str = "NO_CONFLICT"
    # Optional output binding for hierarchy results whose donor scope is
    # broader than the programme target.  Historical inference and normal
    # programme-scoped hierarchy records keep these unset.
    output_scope: str | None = None
    output_scope_entity_id: str | None = None
    output_academic_cycle: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "supporting_assertion_ids", tuple(dict.fromkeys(self.supporting_assertion_ids)))
        object.__setattr__(self, "supporting_raw_document_ids", tuple(dict.fromkeys(self.supporting_raw_document_ids)))
        object.__setattr__(self, "donor_assertion_ids", tuple(dict.fromkeys(self.donor_assertion_ids)))
        object.__setattr__(self, "donor_entity_ids", tuple(dict.fromkeys(self.donor_entity_ids)))
        object.__setattr__(self, "donor_policy_lineage_ids", tuple(dict.fromkeys(self.donor_policy_lineage_ids)))
        object.__setattr__(self, "donor_source_urls", tuple(dict.fromkeys(self.donor_source_urls)))
        object.__setattr__(self, "product_safe", False)
        object.__setattr__(self, "verification_required", True)

    @property
    def epistemic_state(self) -> EpistemicState:
        return EpistemicState.INFERRED

    def to_dict(self) -> dict[str, Any]:
        result = dict(self.__dict__)
        result["volatility"] = self.volatility.value if isinstance(self.volatility, Volatility) else self.volatility
        result["epistemic_state"] = EpistemicState.INFERRED.value
        return result

    def as_assertion(self) -> FieldAssertion:
        hierarchical = self.method == "hierarchical_donor" or self.inference_level != "HISTORICAL_RECURRENCE"
        output_scope = self.output_scope or ("programme" if self.entity_type == "programme" else self.entity_type)
        output_entity_type = (
            "institution"
            if output_scope in {"institution", "university", "central", "institution_wide", "graduate_school"}
            else self.entity_type
        )
        output_entity_id = self.output_scope_entity_id or self.entity_id
        output_cycle = self.output_academic_cycle if self.output_academic_cycle is not None else self.target_cycle
        evidence = (
            f"Inferred from {len(self.donor_assertion_ids or self.supporting_assertion_ids)} "
            f"independent donor assertion(s) at {self.inference_level}."
            if hierarchical
            else f"Inferred from {len(self.supporting_assertion_ids)} historical assertion(s)."
        )
        validation_errors = ["INFERENCE_REQUIRES_CURRENT_VERIFICATION"]
        if hierarchical:
            validation_errors.append("HIERARCHICAL_ESTIMATE_ADVISORY")
        return FieldAssertion(
            assertion_id=stable_id("inferred-assertion", self.inference_id),
            entity_type=output_entity_type,
            entity_id=output_entity_id,
            field_name=self.field,
            value_json=self.predicted_value,
            null_reason=None,
            source_url=None,
            source_type="hierarchical_inference" if hierarchical else "historical_inference",
            evidence=evidence,
            evidence_locator=(f"inference:{self.inference_id}" if hierarchical else None),
            scope=output_scope,
            audience=None,
            academic_cycle=output_cycle,
            retrieved_at=self.generated_at,
            confidence=self.confidence,
            verification_status=VerificationStatus.NEEDS_REVIEW,
            extractor_version=self.method_version,
            model_name=None,
            epistemic_state=EpistemicState.INFERRED,
            temporal_state=TemporalState.TARGET_CYCLE_ESTIMATE,
            raw_document_id=self.supporting_raw_document_ids[0] if self.supporting_raw_document_ids else None,
            validation_errors=validation_errors,
            inference_id=self.inference_id if hierarchical else None,
            inference_level=self.inference_level if hierarchical else None,
            donor_assertion_ids=self.donor_assertion_ids if hierarchical else (),
            donor_entity_ids=self.donor_entity_ids if hierarchical else (),
            hierarchy_distance=self.hierarchy_distance if hierarchical else None,
            donor_similarity_signals=self.donor_similarity_signals if hierarchical else {},
            support_count=self.support_count if hierarchical else 0,
            donor_dispersion=self.donor_dispersion if hierarchical else None,
            uncertainty_components=self.uncertainty_components if hierarchical else {},
            uncertainty_category=self.uncertainty_category if hierarchical else None,
            inference_conflict_state=self.conflict_state if hierarchical else None,
            donor_policy_lineage_ids=self.donor_policy_lineage_ids if hierarchical else (),
            donor_source_urls=self.donor_source_urls if hierarchical else (),
            cycle_compatibility=self.cycle_compatibility if hierarchical else "UNKNOWN",
            applicability_compatibility=(
                self.applicability_compatibility if hierarchical else "UNKNOWN"
            ),
            applicability_state=ApplicabilityState.CONDITIONAL if hierarchical else ApplicabilityState.UNKNOWN,
        )


class InferenceEngine:
    def __init__(self, registry: FieldPolicyRegistry | None = None, *, method_version: str = "inference/v1") -> None:
        self.registry = registry or DEFAULT_FIELD_POLICY_REGISTRY
        self.method_version = method_version

    def infer(
        self,
        *,
        entity_type: str,
        entity_id: str,
        field: str,
        target_cycle: str,
        assertions: Iterable[FieldAssertion],
        current_assessment: CoverageAssessment | None = None,
        recovery_exhausted: bool = False,
        context: Mapping[str, object] | None = None,
    ) -> InferenceRecord | None:
        policy = self.registry.get(field, context={**(context or {}), "entity_type": entity_type, "target_cycle": target_cycle})
        inference_policy = policy.inference
        if not inference_policy.inferable:
            return None
        if current_assessment and (
            current_assessment.state == AvailabilityState.CONFLICTING_SOURCES
            or current_assessment.acceptable
            or current_assessment.state == AvailabilityState.FOUND and not current_assessment.inferred
        ):
            return None
        if not recovery_exhausted and not inference_policy.allow_after_recovery:
            return None
        observations = [
            item
            for item in assertions
            if item.entity_type == entity_type
            and item.entity_id == entity_id
            and item.field_name == field
            and item.epistemic_state == EpistemicState.OBSERVED
            and item.verification_status != VerificationStatus.REJECTED
            and has_semantic_value(item.value_json)
        ]
        target_years = _years(target_cycle)
        target_start = _cycle_start(target_cycle)
        current_observed = [
            item
            for item in observations
            if target_start is not None
            and _cycle_start(item.academic_cycle) == target_start
        ]
        if current_observed:
            return None
        if len(observations) < inference_policy.minimum_history:
            return None
        if inference_policy.minimum_authority is not None:
            authoritative = [item for item in observations if item.source_authority is not None]
            if authoritative and max(_authority_score(item) for item in authoritative) < 3:
                return None
        values = {_value_key(item.value_json) for item in observations}
        if inference_policy.require_pattern_consistency and len(values) != 1:
            return None
        ordered = sorted(observations, key=lambda item: min(_years(item.academic_cycle) or {0}))
        source_years = sorted({year for item in ordered for year in _years(item.academic_cycle)})
        target_start = min(target_years) if target_years else None
        source_last = max(source_years) if source_years else None
        horizon = target_start - source_last if target_start is not None and source_last else 0
        if horizon < 0 or horizon > inference_policy.max_horizon_cycles:
            return None
        confidence = self.confidence_decay(
            history_consistency=1.0 if len(values) == 1 else 0.5,
            evidence_age_cycles=max(0, horizon),
            prediction_horizon=max(0, horizon),
            volatility=policy.volatility,
            source_quality=max((_authority_score(item) for item in observations), default=1) / 5,
        )
        if confidence < inference_policy.confidence_floor:
            return None
        representative = ordered[-1]
        raw_ids = tuple(item.raw_document_id for item in ordered if item.raw_document_id)
        volatility = policy.volatility if isinstance(policy.volatility, Volatility) else Volatility(str(policy.volatility))
        return InferenceRecord(
            inference_id=stable_id("inference", entity_type, entity_id, field, target_cycle, self.method_version),
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            target_cycle=target_cycle,
            predicted_value=representative.value_json,
            predicted_state=None,
            supporting_assertion_ids=tuple(item.assertion_id for item in ordered),
            supporting_raw_document_ids=raw_ids,
            method="historical_recurrence",
            method_version=self.method_version,
            confidence=confidence,
            volatility=volatility,
            horizon=horizon,
            allowed_exposure=inference_policy.allowed_exposure,
        )

    generate = infer

    def infer_hierarchical(self, **kwargs: Any) -> InferenceRecord | None:
        """Run the opt-in compatibility-gated donor ladder."""

        from .hierarchical_inference import HierarchicalInferenceEngine

        return HierarchicalInferenceEngine(
            self.registry,
            method_version=(
                self.method_version
                if self.method_version.startswith("hierarchical-")
                else f"hierarchical-{self.method_version}"
            ),
        ).infer(**kwargs)

    def explain_hierarchical(self, **kwargs: Any) -> Any:
        """Return the donor decision, including abstention reasons."""

        from .hierarchical_inference import HierarchicalInferenceEngine

        return HierarchicalInferenceEngine(
            self.registry,
            method_version=(
                self.method_version
                if self.method_version.startswith("hierarchical-")
                else f"hierarchical-{self.method_version}"
            ),
        ).explain(**kwargs)

    generate_hierarchical = infer_hierarchical

    @staticmethod
    def confidence_decay(
        *,
        history_consistency: float,
        evidence_age_cycles: int,
        prediction_horizon: int,
        volatility: Volatility | str,
        source_quality: float,
    ) -> float:
        volatility_name = volatility.value if isinstance(volatility, Volatility) else str(volatility)
        volatility_penalty = {"LOW": 0.02, "MEDIUM": 0.08, "HIGH": 0.16}.get(volatility_name.upper(), 0.1)
        confidence = 0.45 + 0.25 * max(0.0, min(1.0, history_consistency)) + 0.2 * max(0.0, min(1.0, source_quality))
        confidence -= volatility_penalty * max(1, prediction_horizon)
        confidence -= 0.04 * max(0, evidence_age_cycles)
        return round(max(0.0, min(0.99, confidence)), 4)

    @staticmethod
    def reconcile(
        inference: InferenceRecord,
        observed_assertions: Iterable[FieldAssertion],
    ) -> InferenceRecord:
        target_years = _years(inference.target_cycle)
        applicable = [
            item
            for item in observed_assertions
            if item.entity_type == inference.entity_type
            and item.entity_id == inference.entity_id
            and item.field_name == inference.field
            and item.epistemic_state == EpistemicState.OBSERVED
            and item.verification_status != VerificationStatus.REJECTED
            and (not target_years or not _years(item.academic_cycle) or _years(item.academic_cycle) & target_years)
        ]
        if not applicable:
            return inference
        same = any(_value_key(item.value_json) == _value_key(inference.predicted_value) for item in applicable)
        return replace(
            inference,
            status=InferenceStatus.CONFIRMED if same else InferenceStatus.CONTRADICTED,
            invalidation_reason="current observed evidence supersedes historical estimate",
        )

    @staticmethod
    def supersede(inference: InferenceRecord, *, reason: str = "new observed evidence") -> InferenceRecord:
        return replace(inference, status=InferenceStatus.SUPERSEDED, invalidation_reason=reason)

    @staticmethod
    def invalidate(inference: InferenceRecord, *, reason: str) -> InferenceRecord:
        return replace(inference, status=InferenceStatus.INVALIDATED, invalidation_reason=reason)
