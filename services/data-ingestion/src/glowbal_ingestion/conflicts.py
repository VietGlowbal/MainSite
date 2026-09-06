"""Applicability-first assertion conflict detection and resolution."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Iterable

from .field_policy import FieldPolicy, policy_for
from .models import (
    FieldAssertion,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
    stable_id,
    utc_now_iso,
)
from .quality_models import ConflictState


@dataclass(frozen=True)
class ConflictRecord:
    conflict_id: str
    entity_type: str
    entity_id: str
    field: str
    scope: str | None
    audience: str | None
    academic_cycle: str | None
    assertion_ids: tuple[str, ...]
    policy_version: str
    state: ConflictState = ConflictState.NEEDS_REVIEW
    resolved_assertion_id: str | None = None
    resolution_reason: str | None = None
    detected_at: str = field(default_factory=utc_now_iso)

    @property
    def needs_review(self) -> bool:
        return self.state == ConflictState.NEEDS_REVIEW

    def to_dict(self) -> dict[str, object]:
        return {
            "conflict_id": self.conflict_id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "field": self.field,
            "scope": self.scope,
            "audience": self.audience,
            "academic_cycle": self.academic_cycle,
            "assertion_ids": list(self.assertion_ids),
            "policy_version": self.policy_version,
            "state": self.state.value,
            "resolved_assertion_id": self.resolved_assertion_id,
            "resolution_reason": self.resolution_reason,
            "detected_at": self.detected_at,
        }


def _value_key(value: object) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    except TypeError:
        return repr(value)


def _token(value: object) -> str:
    return str(value or "").strip().casefold().replace("-", "_")


def _audience_overlap(left: str | None, right: str | None) -> bool:
    a, b = _token(left), _token(right)
    if not a or not b or a in {"unknown", "all", "any", "both"} or b in {"unknown", "all", "any", "both"}:
        return True
    domestic = {"domestic", "home", "local"}
    international = {"international", "overseas", "foreign"}
    left_kinds = {
        "domestic" if token in domestic else "international"
        for token in domestic | international
        if re.search(rf"\b{re.escape(token)}\b", a)
    }
    right_kinds = {
        "domestic" if token in domestic else "international"
        for token in domestic | international
        if re.search(rf"\b{re.escape(token)}\b", b)
    }
    if left_kinds or right_kinds:
        return not left_kinds or not right_kinds or bool(left_kinds & right_kinds)
    return a == b


def _years(cycle: str | None) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", str(cycle or ""))}


def _cycle_overlap(left: str | None, right: str | None) -> bool:
    a, b = _years(left), _years(right)
    return not a or not b or bool(a & b)


def _scope_rank(scope: str | None) -> int:
    return {
        "programme": 5,
        "program": 5,
        "offering": 5,
        "department": 4,
        "faculty": 3,
        "graduate_school": 2,
        "international_admissions": 2,
        "university": 1,
        "institution": 1,
        "central": 1,
        "": 0,
        "unknown": 0,
    }.get(_token(scope), 0)


def _scope_overlap(left: FieldAssertion, right: FieldAssertion) -> bool:
    a, b = _token(left.scope), _token(right.scope)
    if a == b or not a or not b or a in {"unknown", "all"} or b in {"unknown", "all"}:
        return True
    # A broader inherited assertion and a programme assertion both apply to
    # the programme; specificity is resolved later rather than creating a
    # false conflict.
    return {_scope_rank(a), _scope_rank(b)} != {0}


def assertions_overlap(
    left: FieldAssertion,
    right: FieldAssertion,
    *,
    target_cycle: str | None = None,
    target_audience: str | None = None,
) -> bool:
    """Return whether two assertions can describe the same fact."""

    if left.entity_type != right.entity_type or left.entity_id != right.entity_id:
        return False
    if left.field_name != right.field_name or not _scope_overlap(left, right):
        return False
    if not _audience_overlap(left.audience, right.audience):
        return False
    if not _cycle_overlap(left.academic_cycle, right.academic_cycle):
        return False
    if target_audience and not _audience_overlap(left.audience, target_audience):
        return False
    if target_audience and not _audience_overlap(right.audience, target_audience):
        return False
    if target_cycle:
        target_years = _years(target_cycle)
        for assertion in (left, right):
            years = _years(assertion.academic_cycle)
            if years and not (years & target_years):
                return False
    return True


def _authority_rank(assertion: FieldAssertion, policy: FieldPolicy) -> int:
    authority = assertion.source_authority
    if authority is None:
        return -1
    try:
        # Policy order is field-specific; this intentionally does not encode
        # a global official-over-government rule.
        return len(policy.acceptable_authorities) - policy.acceptable_authorities.index(authority)
    except ValueError:
        return 0


def _temporal_rank(assertion: FieldAssertion) -> int:
    return {
        TemporalState.CURRENT: 4,
        TemporalState.FUTURE: 3,
        TemporalState.UNKNOWN: 2,
        TemporalState.HISTORICAL: 1,
    }.get(assertion.temporal_state, 0)


def _verification_rank(assertion: FieldAssertion) -> int:
    return {
        VerificationStatus.HUMAN_VERIFIED: 4,
        VerificationStatus.RULE_VALIDATED: 3,
        VerificationStatus.AI_EXTRACTED: 2,
        VerificationStatus.FETCHED: 1,
    }.get(assertion.verification_status, 0)


def _relationship_rank(assertion: FieldAssertion) -> int:
    return {
        SourceRelationship.DIRECT_OFFICIAL: 5,
        SourceRelationship.DEPARTMENT: 4,
        SourceRelationship.CENTRAL_ADMISSIONS: 3,
        SourceRelationship.INTERNATIONAL_ADMISSIONS: 3,
        SourceRelationship.FINANCE_OFFICE: 3,
        SourceRelationship.GOVERNMENT: 3,
        SourceRelationship.PARENT_INSTITUTION: 2,
        SourceRelationship.SCHOLARSHIP_PROVIDER: 2,
        SourceRelationship.ARCHIVE: 0,
    }.get(assertion.source_relationship, 1)


def _resolution_key(assertion: FieldAssertion, policy: FieldPolicy, target_cycle: str | None) -> tuple[int, ...]:
    years = _years(assertion.academic_cycle)
    target_years = _years(target_cycle)
    return (
        _scope_rank(assertion.scope),
        2 if target_years and years and years & target_years else 0,
        1 if assertion.audience and _token(assertion.audience) not in {"all", "unknown"} else 0,
        _temporal_rank(assertion),
        _authority_rank(assertion, policy),
        _relationship_rank(assertion),
        _verification_rank(assertion),
    )


def resolve_competing_assertions(
    assertions: Iterable[FieldAssertion],
    *,
    policy: FieldPolicy | None = None,
    target_cycle: str | None = None,
) -> tuple[FieldAssertion | None, str | None]:
    candidates = list(assertions)
    if not candidates:
        return None, None
    policy = policy or policy_for(candidates[0].field_name)
    ranked = [(tuple(_resolution_key(item, policy, target_cycle)), item) for item in candidates]
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    if len(ranked) == 1 or ranked[0][0] > ranked[1][0]:
        return ranked[0][1], "applicability, specificity, temporal, authority, relationship, and verification precedence"
    return None, "material assertions remain tied after policy-aware precedence"


def detect_conflicts(
    assertions: Iterable[FieldAssertion],
    *,
    target_cycle: str | None = None,
    target_audience: str | None = None,
    policy: FieldPolicy | None = None,
) -> list[ConflictRecord]:
    usable = [
        assertion
        for assertion in assertions
        if has_semantic_value(assertion.value_json)
        and assertion.verification_status != VerificationStatus.REJECTED
    ]
    records: list[ConflictRecord] = []
    seen: set[tuple[str, ...]] = set()
    for index, left in enumerate(usable):
        for right in usable[index + 1 :]:
            if _value_key(left.value_json) == _value_key(right.value_json):
                continue
            if not assertions_overlap(left, right, target_cycle=target_cycle, target_audience=target_audience):
                continue
            ids = tuple(sorted((left.assertion_id, right.assertion_id)))
            if ids in seen:
                continue
            seen.add(ids)
            selected, reason = resolve_competing_assertions(
                (left, right), policy=policy, target_cycle=target_cycle
            )
            chosen_state = ConflictState.AUTO_RESOLVED if selected else ConflictState.NEEDS_REVIEW
            applied_policy = policy or policy_for(left.field_name)
            records.append(
                ConflictRecord(
                    conflict_id=stable_id(
                        "assertion-conflict",
                        left.entity_type,
                        left.entity_id,
                        left.field_name,
                        left.scope or "",
                        left.audience or "",
                        left.academic_cycle or target_cycle or "",
                        *ids,
                        applied_policy.policy_version,
                    ),
                    entity_type=left.entity_type,
                    entity_id=left.entity_id,
                    field=left.field_name,
                    scope=left.scope,
                    audience=left.audience or target_audience,
                    academic_cycle=left.academic_cycle or target_cycle,
                    assertion_ids=ids,
                    policy_version=applied_policy.policy_version,
                    state=chosen_state,
                    resolved_assertion_id=selected.assertion_id if selected else None,
                    resolution_reason=reason,
                )
            )
    return records


def unresolved_conflict_for_field(conflicts: Iterable[ConflictRecord], field: str) -> bool:
    return any(
        item.field == field and item.state in {ConflictState.DETECTED, ConflictState.NEEDS_REVIEW}
        for item in conflicts
    )
