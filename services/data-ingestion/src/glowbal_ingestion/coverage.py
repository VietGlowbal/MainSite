"""Policy-driven staging coverage evaluation."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from .conflicts import ConflictRecord, detect_conflicts, unresolved_conflict_for_field
from .field_policy import FieldPolicy, FieldPolicyRegistry, DEFAULT_FIELD_POLICY_REGISTRY
from .models import (
    EpistemicState,
    FieldAssertion,
    NullReason,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
)
from .quality_models import (
    ApplicabilityState,
    AvailabilityState,
    ConflictState,
    CoverageAssessment,
    VerificationDimension,
    verification_dimension,
)


_FAILURE_STATE = {
    "SOURCE_DISCOVERY_FAILED": AvailabilityState.SOURCE_NOT_FOUND,
    "NO_SOURCE_CANDIDATES": AvailabilityState.SOURCE_NOT_FOUND,
    "SOURCE_NOT_FOUND": AvailabilityState.SOURCE_NOT_FOUND,
    "SOURCE_REJECTED_BY_POLICY": AvailabilityState.ACCESS_BLOCKED,
    "ACCESS_BLOCKED": AvailabilityState.ACCESS_BLOCKED,
    "BLOCKED_BY_ROBOTS": AvailabilityState.ACCESS_BLOCKED,
    "FETCH_FAILED": AvailabilityState.FETCH_FAILED,
    "RAW_PERSIST_FAILED": AvailabilityState.FETCH_FAILED,
    "PARSE_FAILED": AvailabilityState.PARSE_FAILED,
    "EXTRACTION_FAILED": AvailabilityState.EXTRACTION_FAILED,
    "EXTRACT_FAILED": AvailabilityState.EXTRACTION_FAILED,
}


def _cycle_years(value: str | None) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", str(value or ""))}


def _cycle_matches(assertion_cycle: str | None, target_cycle: str | None) -> bool:
    if not target_cycle or not assertion_cycle:
        return True
    left, right = _cycle_years(assertion_cycle), _cycle_years(target_cycle)
    return not left or not right or bool(left & right)


def _target_cycle_matches(assertion_cycle: str | None, target_cycle: str | None) -> bool:
    """Require an explicit matching cycle for policies that require one."""
    if not target_cycle:
        return True
    assertion_years = sorted(_cycle_years(assertion_cycle))
    target_years = sorted(_cycle_years(target_cycle))
    return bool(assertion_years and target_years and assertion_years[0] == target_years[0])


def _audience_matches(value: str | None, target: str | None) -> bool:
    if not target or not value:
        return True
    left, right = value.casefold(), target.casefold()
    if left in {"all", "any", "unknown"} or right in {"all", "any", "unknown"}:
        return True
    domestic = {"domestic", "home", "local"}
    international = {"international", "overseas", "foreign"}
    if (left in domestic and right in international) or (right in domestic and left in international):
        return False
    return left == right


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _is_fresh(assertion: FieldAssertion, policy: FieldPolicy) -> bool:
    if policy.freshness_days is None:
        return True
    retrieved = _parse_time(assertion.retrieved_at)
    if retrieved is None:
        return False
    age = (datetime.now(timezone.utc) - retrieved).total_seconds() / 86400
    return age <= policy.freshness_days


def _attempt_state(attempt: Any) -> AvailabilityState | None:
    code = getattr(attempt, "error_code", None)
    code = getattr(code, "value", code)
    status = str(getattr(attempt, "status", "")).upper()
    if code:
        return _FAILURE_STATE.get(str(code).upper(), AvailabilityState.NEEDS_REVIEW)
    for marker, state in _FAILURE_STATE.items():
        if marker in status:
            return state
    if status in {"NO_CANDIDATES", "DISCOVERY_EXHAUSTED"}:
        return AvailabilityState.SOURCE_NOT_FOUND
    return None


def _explicit_not_published(assertion: FieldAssertion) -> bool:
    text = f"{assertion.evidence or ''} {' '.join(assertion.validation_errors)}".casefold()
    return bool(re.search(r"\b(?:not published|does not publish|not available|not provided|not disclosed|does not disclose)\b", text)) or "NOT_PUBLISHED_PROVEN" in text or "EXHAUSTIVE_SEARCH_PROVEN" in text


def _explicit_not_required(assertion: FieldAssertion) -> bool:
    text = f"{assertion.evidence or ''} {' '.join(assertion.validation_errors)}".casefold()
    return bool(re.search(r"\b(?:not required|not applicable|does not require|no .* required)\b", text)) or "NOT_REQUIRED_PROVEN" in text or "APPLICABILITY_PROVEN" in text


def _proof_applicability(assertion: FieldAssertion) -> bool:
    return bool(assertion.applicability_evidence or "APPLICABILITY_PROVEN" in " ".join(assertion.validation_errors))


def _enum_matches(value: object, allowed: Iterable[object]) -> bool:
    value_name = getattr(value, "value", value)
    return any(getattr(item, "value", item) == value_name for item in allowed)


def _entity_values(entity: object, entity_type: str | None, entity_id: str | None) -> tuple[str, str]:
    if isinstance(entity, Mapping):
        entity_id = entity_id or str(entity.get("entity_id") or entity.get("id") or "")
        entity_type = entity_type or str(entity.get("entity_type") or entity.get("type") or "programme")
    elif hasattr(entity, "entity_id"):
        entity_id = entity_id or str(getattr(entity, "entity_id"))
        entity_type = entity_type or str(getattr(entity, "entity_type", "programme"))
    else:
        entity_id = entity_id or str(entity)
    return entity_type or "programme", entity_id or "unknown"


class CoverageEngine:
    """Evaluate field quality without mutating assertions or promotion."""

    def __init__(self, registry: FieldPolicyRegistry | None = None) -> None:
        self.registry = registry or DEFAULT_FIELD_POLICY_REGISTRY

    def evaluate(
        self,
        entity: object,
        field: str,
        *,
        target_cycle: str | None = None,
        audience: str | None = None,
        target_audience: str | None = None,
        assertions: Iterable[FieldAssertion] = (),
        effective_assertions: Iterable[FieldAssertion] | None = None,
        acquisition_attempts: Iterable[Any] = (),
        attempts: Iterable[Any] | None = None,
        conflicts: Iterable[ConflictRecord] | None = None,
        context: Mapping[str, object] | None = None,
        policy: FieldPolicy | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
    ) -> CoverageAssessment:
        entity_type, entity_id = _entity_values(entity, entity_type, entity_id)
        audience = audience or target_audience
        context = {**(context or {}), "entity_type": entity_type, "target_cycle": target_cycle, "audience": audience}
        policy = policy or self.registry.get(field, context=context)
        all_assertions = list(effective_assertions if effective_assertions is not None else assertions)
        applicable = [item for item in all_assertions if self._applicable(item, entity_type, entity_id, target_cycle, audience)]
        if conflicts is None:
            conflicts = detect_conflicts(applicable, target_cycle=target_cycle, target_audience=audience, policy=policy)
        conflict_list = list(conflicts)
        conflict_is_unresolved = unresolved_conflict_for_field(conflict_list, field)
        critical = policy.is_critical(context)
        base = dict(
            entity=entity_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            field_group=policy.field_group,
            target_cycle=target_cycle,
            audience=audience,
            critical=critical,
            policy_version=policy.policy_version,
        )

        if conflict_is_unresolved:
            ids = tuple(sorted({identifier for item in conflict_list if item.field == field for identifier in item.assertion_ids}))
            return CoverageAssessment(
                **base,
                state=AvailabilityState.CONFLICTING_SOURCES,
                terminal=False,
                acceptable=False,
                supporting_assertion_ids=ids,
                blocking_reason="material applicable assertions conflict and deterministic precedence is insufficient",
                next_action="REVIEW_CONFLICT",
                applicability=ApplicabilityState.APPLICABLE,
                conflict_state=ConflictState.NEEDS_REVIEW,
            )

        rejected = [item for item in applicable if item.verification_status == VerificationStatus.REJECTED]
        usable = [item for item in applicable if item.verification_status != VerificationStatus.REJECTED]
        valued = [item for item in usable if has_semantic_value(item.value_json)]
        auto_resolved_ids = {
            item.resolved_assertion_id
            for item in conflict_list
            if item.field == field
            and item.resolved_assertion_id
            and item.state == ConflictState.AUTO_RESOLVED
        }
        auto_competing_ids = {
            assertion_id
            for item in conflict_list
            if item.field == field and item.state == ConflictState.AUTO_RESOLVED
            for assertion_id in item.assertion_ids
        }
        if auto_resolved_ids:
            valued = [
                item
                for item in valued
                if item.assertion_id in auto_resolved_ids
                or item.assertion_id not in auto_competing_ids
            ]
        if valued:
            current: list[FieldAssertion] = []
            stale: list[FieldAssertion] = []
            review: list[FieldAssertion] = []
            for item in valued:
                if item.epistemic_state == EpistemicState.INFERRED:
                    review.append(item)
                elif policy.requires_target_cycle and target_cycle and not _target_cycle_matches(item.academic_cycle, target_cycle):
                    (stale if item.academic_cycle else review).append(item)
                elif policy.requires_current and item.temporal_state != TemporalState.CURRENT:
                    (stale if item.temporal_state == TemporalState.HISTORICAL else review).append(item)
                elif not _is_fresh(item, policy) and policy.volatility_name.upper() == "HIGH":
                    stale.append(item)
                elif item.verification_status == VerificationStatus.NEEDS_REVIEW:
                    review.append(item)
                else:
                    current.append(item)
            if current:
                selected = current[0]
                inferred = selected.epistemic_state == EpistemicState.INFERRED
                verification_required = inferred or policy.volatility_name.upper() == "HIGH" and selected.temporal_state != TemporalState.CURRENT
                authority_ok = selected.source_authority is not None and _enum_matches(selected.source_authority, policy.acceptable_authorities)
                verification_ok = _enum_matches(verification_dimension(selected.verification_status), policy.acceptable_verifications)
                acceptable = not inferred and not verification_required and authority_ok and verification_ok
                return CoverageAssessment(
                    **base,
                    state=AvailabilityState.FOUND,
                    terminal=acceptable,
                    acceptable=acceptable,
                    supporting_assertion_ids=tuple(item.assertion_id for item in current),
                    blocking_reason=None if acceptable else "value exists but does not satisfy authority, verification, or currentness policy",
                    next_action=None if acceptable else "REVIEW_VALUE",
                    temporal_state=selected.temporal_state,
                    epistemic_state=selected.epistemic_state,
                    verification=verification_dimension(selected.verification_status),
                    authority=selected.source_authority,
                    relationship=selected.source_relationship,
                    applicability=ApplicabilityState.APPLICABLE,
                    verification_required=verification_required,
                    inferred=inferred,
                )
            if review:
                return CoverageAssessment(
                    **base,
                    state=AvailabilityState.NEEDS_REVIEW,
                    terminal=False,
                    acceptable=False,
                    supporting_assertion_ids=tuple(item.assertion_id for item in review),
                    blocking_reason="value is present but assertion verification or inference status requires review",
                    next_action="REVIEW_VALUE",
                    applicability=ApplicabilityState.APPLICABLE,
                    verification_required=True,
                    inferred=any(item.epistemic_state == EpistemicState.INFERRED for item in review),
                )
            if stale:
                return CoverageAssessment(
                    **base,
                    state=AvailabilityState.STALE_ONLY,
                    terminal=False,
                    acceptable=False,
                    supporting_assertion_ids=tuple(item.assertion_id for item in stale),
                    blocking_reason="only historical, expired, or wrong-cycle evidence is available",
                    next_action="RECOVER_CURRENT",
                    temporal_state=TemporalState.HISTORICAL,
                    applicability=ApplicabilityState.APPLICABLE,
                )

        null_assertions = [item for item in usable if not has_semantic_value(item.value_json)]
        for item in null_assertions:
            reason = item.null_reason
            reason_value = reason.value if isinstance(reason, NullReason) else str(reason or "")
            proof_authority_ok = item.source_authority is not None and _enum_matches(item.source_authority, policy.acceptable_authorities)
            proof_verification_ok = _enum_matches(verification_dimension(item.verification_status), policy.acceptable_verifications)
            if reason_value == NullReason.NOT_PUBLISHED.value and policy.allow_not_published and proof_authority_ok and proof_verification_ok and (_explicit_not_published(item) or not policy.not_published_requires_exhaustive_search):
                return CoverageAssessment(
                    **base,
                    state=AvailabilityState.NOT_PUBLISHED,
                    terminal=True,
                    acceptable=True,
                    supporting_assertion_ids=(item.assertion_id,),
                    blocking_reason=None,
                    next_action=None,
                    applicability=ApplicabilityState.APPLICABLE,
                )
            if reason_value in {NullReason.NOT_APPLICABLE.value, "NOT_REQUIRED"} and policy.allow_not_required and proof_authority_ok and proof_verification_ok and (_explicit_not_required(item) or (not policy.not_required_requires_proof and _proof_applicability(item))):
                return CoverageAssessment(
                    **base,
                    state=AvailabilityState.NOT_REQUIRED,
                    terminal=True,
                    acceptable=True,
                    supporting_assertion_ids=(item.assertion_id,),
                    applicability=ApplicabilityState.NOT_APPLICABLE,
                )
            failed_state = _FAILURE_STATE.get(reason_value)
            if failed_state:
                return self._assessment_for_state(base, policy, failed_state, item.assertion_id)
            if reason_value in {NullReason.NOT_PUBLISHED.value, NullReason.NOT_APPLICABLE.value}:
                return self._assessment_for_state(
                    base,
                    policy,
                    AvailabilityState.SOURCE_NOT_FOUND,
                    item.assertion_id,
                    "absence was asserted without the evidence or policy proof required for this terminal state",
                )
            if reason_value == NullReason.OUTDATED_ONLY.value:
                return self._assessment_for_state(base, policy, AvailabilityState.STALE_ONLY, item.assertion_id)
            if reason_value == NullReason.BLOCKED_BY_POLICY.value:
                return self._assessment_for_state(base, policy, AvailabilityState.ACCESS_BLOCKED, item.assertion_id)
            if reason_value in {NullReason.AMBIGUOUS.value, NullReason.CONFLICTED.value}:
                return self._assessment_for_state(base, policy, AvailabilityState.NEEDS_REVIEW, item.assertion_id)

        attempt_list = list(attempts if attempts is not None else acquisition_attempts)
        attempt_states = [state for state in (_attempt_state(item) for item in attempt_list) if state]
        if attempt_states:
            # The last recorded failure is the best explanation of the current
            # frontier; do not collapse it into absence.
            return self._assessment_for_state(base, policy, attempt_states[-1], None)
        if rejected:
            return self._assessment_for_state(base, policy, AvailabilityState.EXTRACTION_FAILED, rejected[0].assertion_id, "all applicable assertions were rejected by validation")
        return CoverageAssessment(
            **base,
            state=AvailabilityState.NOT_EVALUATED,
            terminal=False,
            acceptable=False,
            blocking_reason="no applicable assertion or acquisition attempt has been evaluated",
            next_action="EVALUATE_SOURCE",
            applicability=ApplicabilityState.UNKNOWN,
        )

    def _assessment_for_state(self, base: dict[str, object], policy: FieldPolicy, state: AvailabilityState, assertion_id: str | None, reason: str | None = None) -> CoverageAssessment:
        return CoverageAssessment(
            **base,
            state=state,
            terminal=state in policy.acceptable_terminal_states and state not in {AvailabilityState.FOUND},
            acceptable=state in policy.acceptable_terminal_states and state != AvailabilityState.FOUND,
            supporting_assertion_ids=(assertion_id,) if assertion_id else (),
            blocking_reason=reason or state.value,
            next_action=None if state in policy.acceptable_terminal_states else "RECOVER",
            applicability=ApplicabilityState.UNKNOWN,
        )

    @staticmethod
    def _applicable(assertion: FieldAssertion, entity_type: str, entity_id: str, target_cycle: str | None, audience: str | None) -> bool:
        if assertion.entity_type != entity_type or assertion.entity_id != entity_id:
            return False
        if not _cycle_matches(assertion.academic_cycle, target_cycle) or not _audience_matches(assertion.audience, audience):
            return False
        return True

    def evaluate_fields(
        self,
        entity: object,
        fields: Iterable[str],
        **kwargs: Any,
    ) -> tuple[CoverageAssessment, ...]:
        return tuple(self.evaluate(entity, field, **kwargs) for field in fields)

    def evaluate_entity(
        self,
        entity: object,
        fields: Iterable[str],
        **kwargs: Any,
    ) -> tuple[tuple[CoverageAssessment, ...], dict[str, int]]:
        assessments = self.evaluate_fields(entity, fields, **kwargs)
        counts: dict[str, int] = {}
        for item in assessments:
            counts[item.state.value] = counts.get(item.state.value, 0) + 1
        return assessments, counts
