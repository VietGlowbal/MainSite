"""Bounded, field-directed recovery planning.

This module only plans Slice B acquisition intents.  It has no fetcher and no
network access; execution remains owned by the acquisition platform.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from .acquisition import AcquisitionAttempt, AcquisitionIntent, EntityRef
from .field_policy import FieldPolicy, FieldPolicyRegistry, DEFAULT_FIELD_POLICY_REGISTRY
from .models import RawDocument, TemporalState, utc_now_iso
from .quality_models import AvailabilityState, CoverageAssessment


def _years(value: str | None) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", str(value or ""))}


def _same_cycle(left: str | None, right: str | None) -> bool:
    a, b = _years(left), _years(right)
    return not a or not b or min(a) == min(b)


def _time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


@dataclass(frozen=True)
class RecoveryBudget:
    budget_policy_id: str = "recovery-budget/v1"
    max_rounds: int = 3
    max_attempts: int = 12
    max_source_class_diversity: int = 6
    max_requests: int = 12
    max_render_cost: int = 3
    max_llm_cost: int = 3
    max_elapsed_seconds: int = 900


@dataclass(frozen=True)
class RawEvidenceReuse:
    raw_document_id: str
    source_identity: str
    target_cycle: str | None
    temporal_state: TemporalState
    reused: bool = True
    reason: str = "fresh retained raw evidence is reusable without network acquisition"

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_document_id": self.raw_document_id,
            "source_identity": self.source_identity,
            "target_cycle": self.target_cycle,
            "temporal_state": self.temporal_state.value,
            "reused": self.reused,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class RecoveryDecision:
    assessment: CoverageAssessment
    intents: tuple[AcquisitionIntent, ...] = ()
    reused_raw: tuple[RawEvidenceReuse, ...] = ()
    round: int = 0
    exhausted: bool = False
    stop_reason: str | None = None
    fingerprint: str = ""
    source_frontier_fingerprint: str = ""
    policy_version: str = "field-policy/v1"
    decided_at: str = field(default_factory=utc_now_iso)

    @property
    def should_recover(self) -> bool:
        return bool(self.intents)

    def to_dict(self) -> dict[str, Any]:
        return {
            "assessment": self.assessment.to_dict(),
            "intents": [item.to_dict() for item in self.intents],
            "reused_raw": [item.to_dict() for item in self.reused_raw],
            "round": self.round,
            "exhausted": self.exhausted,
            "stop_reason": self.stop_reason,
            "fingerprint": self.fingerprint,
            "source_frontier_fingerprint": self.source_frontier_fingerprint,
            "policy_version": self.policy_version,
            "decided_at": self.decided_at,
        }


class RecoveryPlanner:
    """Plan at most one new source-class intent per field and round."""

    def __init__(
        self,
        registry: FieldPolicyRegistry | None = None,
        *,
        budget: RecoveryBudget | None = None,
    ) -> None:
        self.registry = registry or DEFAULT_FIELD_POLICY_REGISTRY
        self.budget = budget or RecoveryBudget()

    def plan(
        self,
        assessments: CoverageAssessment | Iterable[CoverageAssessment],
        *,
        entity: object | None = None,
        target_cycle: str | None = None,
        audience: str | None = None,
        attempts: Iterable[AcquisitionAttempt] = (),
        prior_decisions: Iterable[RecoveryDecision] = (),
        round: int = 0,
        raw_documents: Iterable[RawDocument] = (),
        context: Mapping[str, object] | None = None,
    ) -> tuple[RecoveryDecision, ...]:
        items = [assessments] if isinstance(assessments, CoverageAssessment) else list(assessments)
        attempt_list = list(attempts)
        previous = list(prior_decisions)
        return tuple(
            self.plan_field(
                assessment,
                entity=entity,
                target_cycle=target_cycle or assessment.target_cycle,
                audience=audience or assessment.audience,
                attempts=attempt_list,
                prior_decisions=previous,
                round=round,
                raw_documents=raw_documents,
                context=context,
            )
            for assessment in items
        )

    def plan_field(
        self,
        assessment: CoverageAssessment,
        *,
        entity: object | None = None,
        target_cycle: str | None = None,
        audience: str | None = None,
        attempts: Iterable[AcquisitionAttempt] = (),
        prior_decisions: Iterable[RecoveryDecision] = (),
        round: int = 0,
        raw_documents: Iterable[RawDocument] = (),
        context: Mapping[str, object] | None = None,
    ) -> RecoveryDecision:
        target_cycle = target_cycle or assessment.target_cycle
        audience = audience or assessment.audience
        policy = self.registry.get(assessment.field, context=context)
        attempt_list = list(attempts)
        previous = list(prior_decisions)
        reused = self.reusable_raw(raw_documents, policy=policy, target_cycle=target_cycle)
        fingerprint = self.decision_fingerprint(assessment, attempt_list, round)
        frontier = self.frontier_fingerprint(assessment, attempt_list, previous)
        terminal = assessment.acceptable and assessment.state in {
            AvailabilityState.FOUND,
            AvailabilityState.NOT_PUBLISHED,
            AvailabilityState.NOT_REQUIRED,
        }
        if terminal:
            return RecoveryDecision(
                assessment=assessment,
                reused_raw=tuple(reused),
                round=round,
                stop_reason="acceptable terminal state reached",
                fingerprint=fingerprint,
                source_frontier_fingerprint=frontier,
                policy_version=policy.policy_version,
            )
        if reused:
            return RecoveryDecision(
                assessment=assessment,
                reused_raw=tuple(reused),
                round=round,
                stop_reason="fresh retained evidence should be reprocessed before new acquisition",
                fingerprint=fingerprint,
                source_frontier_fingerprint=frontier,
                policy_version=policy.policy_version,
            )
        if round >= self.budget.max_rounds:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "recovery round budget exhausted")
        if len(attempt_list) >= self.budget.max_attempts:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "recovery attempt budget exhausted")
        if len(attempt_list) >= self.budget.max_requests:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "recovery request budget exhausted")
        if any(item.fingerprint == fingerprint for item in previous) or any(item.source_frontier_fingerprint == frontier for item in previous):
            return self._stopped(assessment, round, fingerprint, frontier, policy, "no new evidence frontier; repeat intent suppressed")
        attempted_classes = {
            str(getattr(item, "source_class", "")).casefold()
            for item in attempt_list
            if getattr(item, "source_class", None)
        }
        attempted_intents = {item.intent_id for item in attempt_list if item.intent_id}
        attempted_intents.update(
            intent.intent_id
            for decision in previous
            for intent in decision.intents
        )
        attempted_classes.update(
            source_class.casefold()
            for decision in previous
            for intent in decision.intents
            for source_class in intent.preferred_source_classes
        )
        if len(attempted_classes) >= self.budget.max_source_class_diversity:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "recovery source-class diversity budget exhausted")
        source_class = next(
            (candidate for candidate in policy.recovery_strategy if candidate.casefold() not in attempted_classes),
            None,
        )
        if source_class is None:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "source frontier exhausted")
        entity_type, entity_id = self._entity(entity, assessment)
        intent = AcquisitionIntent.create(
            entity=EntityRef(entity_type=entity_type, entity_id=entity_id),
            field_groups=(policy.field_group,),
            reason=f"recover {assessment.field} from {assessment.state.value}",
            target_cycle=target_cycle,
            audience=audience,
            preferred_source_classes=(source_class,),
            freshness_requirement=f"<= {policy.freshness_days} days" if policy.freshness_days is not None else "policy-defined",
            priority=100 if assessment.critical else 50,
            budget_policy_id=self.budget.budget_policy_id,
        )
        if intent.intent_id in attempted_intents:
            return self._stopped(assessment, round, fingerprint, frontier, policy, "stable intent already attempted")
        return RecoveryDecision(
            assessment=assessment,
            intents=(intent,),
            round=round,
            fingerprint=fingerprint,
            source_frontier_fingerprint=frontier,
            policy_version=policy.policy_version,
        )

    @staticmethod
    def _entity(entity: object | None, assessment: CoverageAssessment) -> tuple[str, str]:
        if entity is not None:
            if isinstance(entity, Mapping):
                return str(entity.get("entity_type") or assessment.entity_type or "programme"), str(entity.get("entity_id") or entity.get("id") or assessment.entity_id or "unknown")
            if hasattr(entity, "entity_id"):
                return str(getattr(entity, "entity_type", assessment.entity_type or "programme")), str(getattr(entity, "entity_id"))
            return assessment.entity_type or "programme", str(entity)
        return assessment.entity_type or "programme", assessment.entity_id or assessment.entity or "unknown"

    @staticmethod
    def decision_fingerprint(assessment: CoverageAssessment, attempts: Iterable[AcquisitionAttempt], round: int) -> str:
        attempt_ids = sorted(str(item.attempt_id) for item in attempts)
        return "|".join((assessment.entity_type or "", assessment.entity_id or assessment.entity or "", assessment.field, assessment.state.value, assessment.target_cycle or "", assessment.audience or "", str(round), ",".join(attempt_ids)))

    @staticmethod
    def frontier_fingerprint(assessment: CoverageAssessment, attempts: Iterable[AcquisitionAttempt], prior: Iterable[RecoveryDecision]) -> str:
        intent_ids = sorted(str(item.intent_id) for item in attempts if item.intent_id)
        prior_ids = sorted(intent.intent_id for decision in prior for intent in decision.intents)
        return "|".join((assessment.field, ",".join(intent_ids), ",".join(prior_ids)))

    @staticmethod
    def reusable_raw(
        documents: Iterable[RawDocument],
        *,
        policy: FieldPolicy,
        target_cycle: str | None,
        now: datetime | None = None,
    ) -> list[RawEvidenceReuse]:
        now = now or datetime.now(timezone.utc)
        reusable: list[RawEvidenceReuse] = []
        for document in documents:
            retrieved = _time(document.retrieved_at)
            if retrieved is None:
                continue
            if policy.freshness_days is not None and (now - retrieved).total_seconds() > policy.freshness_days * 86400:
                continue
            if policy.requires_target_cycle and target_cycle and not _same_cycle(document.academic_cycle, target_cycle):
                continue
            reusable.append(
                RawEvidenceReuse(
                    raw_document_id=document.raw_document_id,
                    source_identity=document.source_identity,
                    target_cycle=target_cycle,
                    temporal_state=document.temporal_state,
                )
            )
        return reusable

    @staticmethod
    def _stopped(assessment: CoverageAssessment, round: int, fingerprint: str, frontier: str, policy: FieldPolicy, reason: str) -> RecoveryDecision:
        return RecoveryDecision(
            assessment=assessment,
            round=round,
            exhausted=True,
            stop_reason=reason,
            fingerprint=fingerprint,
            source_frontier_fingerprint=frontier,
            policy_version=policy.policy_version,
        )
