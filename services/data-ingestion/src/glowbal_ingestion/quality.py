"""Shadow orchestration for Slice C quality semantics."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from .conflicts import ConflictRecord, detect_conflicts
from .coverage import CoverageEngine
from .field_policy import FieldPolicyRegistry, DEFAULT_FIELD_POLICY_REGISTRY
from .inference import InferenceEngine
from .models import FieldAssertion
from .quality_models import (
    AvailabilityState,
    ConflictState,
    CoverageAssessment,
    QualityEvaluation,
    QualityMetrics,
)
from .recovery import RecoveryDecision, RecoveryPlanner


class SliceCQuality:
    """Compose evaluate -> recover -> re-evaluate without owning acquisition."""

    def __init__(self, registry: FieldPolicyRegistry | None = None) -> None:
        self.registry = registry or DEFAULT_FIELD_POLICY_REGISTRY
        self.coverage = CoverageEngine(self.registry)
        self.recovery = RecoveryPlanner(self.registry)
        self.inference = InferenceEngine(self.registry)

    def evaluate(
        self,
        entity: object,
        fields: Iterable[str],
        *,
        assertions: Iterable[FieldAssertion] = (),
        effective_assertions: Iterable[FieldAssertion] | None = None,
        attempts: Iterable[Any] = (),
        target_cycle: str | None = None,
        audience: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        context: Mapping[str, object] | None = None,
        prior_recovery: Iterable[RecoveryDecision] = (),
        round: int = 0,
        include_inference: bool = False,
        raw_documents: Iterable[Any] = (),
    ) -> QualityEvaluation:
        all_assertions = list(effective_assertions if effective_assertions is not None else assertions)
        fields_list = list(fields)
        conflicts = detect_conflicts(all_assertions, target_cycle=target_cycle, target_audience=audience)
        assessments = tuple(
            self.coverage.evaluate(
                entity,
                field,
                assertions=all_assertions,
                attempts=attempts,
                conflicts=conflicts,
                target_cycle=target_cycle,
                audience=audience,
                entity_type=entity_type,
                entity_id=entity_id,
                context=context,
            )
            for field in fields_list
        )
        decisions = tuple(
            self.recovery.plan(
                item,
                entity=entity,
                target_cycle=target_cycle,
                audience=audience,
                attempts=attempts,
                prior_decisions=prior_recovery,
                round=round,
                raw_documents=raw_documents,
                context=context,
            )[0]
            for item in assessments
        )
        inferences = []
        if include_inference:
            for assessment, decision in zip(assessments, decisions):
                if assessment.acceptable or assessment.state == AvailabilityState.CONFLICTING_SOURCES:
                    continue
                inferred = self.inference.infer(
                    entity_type=entity_type or assessment.entity_type or "programme",
                    entity_id=entity_id or assessment.entity_id or assessment.entity or "unknown",
                    field=assessment.field,
                    target_cycle=target_cycle or assessment.target_cycle or "",
                    assertions=all_assertions,
                    current_assessment=assessment,
                    recovery_exhausted=decision.exhausted or not decision.intents,
                    context=context,
                )
                if inferred is not None:
                    inferences.append(inferred)
        metrics = self._metrics(assessments, conflicts, decisions, inferences)
        return QualityEvaluation(
            assessments=assessments,
            conflicts=tuple(conflicts),
            recovery_decisions=decisions,
            inferences=tuple(inferences),
            metrics=metrics,
            policy_version=self.registry.version,
        )

    run = evaluate

    def reevaluate_after_acquisition(self, *args: Any, **kwargs: Any) -> QualityEvaluation:
        """Explicit second pass after Slice B has supplied new assertions."""

        kwargs["round"] = int(kwargs.get("round", 0)) + 1
        return self.evaluate(*args, **kwargs)

    @staticmethod
    def _metrics(
        assessments: Iterable[CoverageAssessment],
        conflicts: Iterable[ConflictRecord],
        decisions: Iterable[RecoveryDecision],
        inferences: Iterable[Any],
    ) -> QualityMetrics:
        assessments = tuple(assessments)
        conflicts = tuple(conflicts)
        decisions = tuple(decisions)
        inferences = tuple(inferences)
        state_counts: dict[str, int] = {}
        group_state_counts: dict[str, int] = {}
        for assessment in assessments:
            state_counts[assessment.state.value] = state_counts.get(assessment.state.value, 0) + 1
            key = f"{assessment.field_group}:{assessment.state.value}"
            group_state_counts[key] = group_state_counts.get(key, 0) + 1
        return QualityMetrics(
            state_counts=state_counts,
            group_state_counts=group_state_counts,
            critical_unresolved=sum(1 for item in assessments if item.critical and not item.acceptable),
            recovery_intents=sum(len(item.intents) for item in decisions),
            recovery_successes=sum(1 for item in decisions if item.assessment.state == AvailabilityState.FOUND and item.assessment.acceptable),
            recovery_exhausted=sum(1 for item in decisions if item.exhausted),
            conflicts_detected=len(conflicts),
            conflicts_auto_resolved=sum(1 for item in conflicts if item.state == ConflictState.AUTO_RESOLVED),
            conflicts_for_review=sum(1 for item in conflicts if item.state == ConflictState.NEEDS_REVIEW),
            historical_only=sum(1 for item in assessments if item.state == AvailabilityState.STALE_ONLY),
            inferences_generated=len(inferences),
            inference_confidence=tuple(item.confidence for item in inferences),
        )


CoverageQuality = SliceCQuality
