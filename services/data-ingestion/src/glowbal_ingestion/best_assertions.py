from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from typing import Any, Iterable

from .models import (
    ApplicabilityState,
    ADMISSION_PACKAGE_FIELDS,
    DEEP_FIELDS,
    EpistemicState,
    FieldAssertion,
    NullReason,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
    utc_now_iso,
)
from .storage import StateStore


VOLATILE_FIELDS: frozenset[str] = frozenset(
    {
        "programme_status",
        "academic_cycle",
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "rolling_admission",
        "application_fee",
        "tuition",
        "additional_fees",
        "scholarships",
    }
)
YEAR_RE = re.compile(r"\b(20\d{2})\b")
VERIFICATION_RANK: dict[VerificationStatus, int] = {
    VerificationStatus.HUMAN_VERIFIED: 4,
    VerificationStatus.RULE_VALIDATED: 3,
    VerificationStatus.NEEDS_REVIEW: 2,
    VerificationStatus.AI_EXTRACTED: 1,
}
HUMAN_CANONICAL_FIELDS: frozenset[str] = frozenset(
    {
        *ADMISSION_PACKAGE_FIELDS,
        "application_fee",
        "application_url",
        "tuition",
    }
)
RETIRED_ASSERTION_MODELS: frozenset[str] = frozenset(
    {
        "deterministic-source-excerpt",
        "deterministic-source-excerpt-v2",
        "deterministic-source-excerpt-v3",
    }
)


def assertion_from_dict(payload: dict[str, Any]) -> FieldAssertion:
    value = dict(payload)
    null_reason = value.get("null_reason")
    verification_status = value.get("verification_status")
    value["null_reason"] = (
        NullReason(str(null_reason)) if null_reason else None
    )
    value["verification_status"] = VerificationStatus(
        str(verification_status)
    )
    value["epistemic_state"] = EpistemicState(
        str(value.get("epistemic_state") or EpistemicState.OBSERVED.value)
    )
    value["temporal_state"] = TemporalState(
        str(value.get("temporal_state") or TemporalState.UNKNOWN.value)
    )
    source_authority = value.get("source_authority")
    value["source_authority"] = (
        SourceAuthority(str(source_authority)) if source_authority else None
    )
    source_relationship = value.get("source_relationship")
    value["source_relationship"] = (
        SourceRelationship(str(source_relationship))
        if source_relationship
        else None
    )
    value["applicability_state"] = ApplicabilityState(
        str(value.get("applicability_state") or ApplicabilityState.UNKNOWN.value)
    )
    value["validation_errors"] = [
        str(error) for error in value.get("validation_errors", [])
    ]
    return FieldAssertion(**value)


def _accepted_bundle(
    assertions: Iterable[FieldAssertion],
) -> list[FieldAssertion]:
    deduped: dict[str, FieldAssertion] = {}
    for assertion in assertions:
        if (
            not has_semantic_value(assertion.value_json)
            or assertion.verification_status
            == VerificationStatus.REJECTED
        ):
            continue
        deduped.setdefault(assertion.assertion_id, assertion)
    return sorted(
        deduped.values(),
        key=lambda assertion: (
            assertion.field_name,
            str(assertion.academic_cycle or ""),
            str(assertion.source_url or ""),
            assertion.assertion_id,
        ),
    )


def prefer_human_verified(
    assertions: Iterable[FieldAssertion],
) -> list[FieldAssertion]:
    """Keep approved canonical facts over same-source AI alternatives."""
    records = list(assertions)
    approved = [
        assertion
        for assertion in records
        if (
            assertion.field_name in HUMAN_CANONICAL_FIELDS
            and assertion.verification_status
            == VerificationStatus.HUMAN_VERIFIED
        )
    ]

    def cycle_key(assertion: FieldAssertion) -> tuple[str, ...]:
        return tuple(YEAR_RE.findall(assertion.academic_cycle or ""))

    def same_applicability(
        candidate: FieldAssertion,
        verified: FieldAssertion,
    ) -> bool:
        if (
            candidate.field_name != verified.field_name
            or (candidate.source_url or "") != (verified.source_url or "")
        ):
            return False
        candidate_cycle = cycle_key(candidate)
        verified_cycle = cycle_key(verified)
        if (
            candidate_cycle
            and verified_cycle
            and candidate_cycle != verified_cycle
        ):
            return False
        candidate_audience = (candidate.audience or "unknown").casefold()
        verified_audience = (verified.audience or "unknown").casefold()
        wildcard = {"all", "unknown"}
        return (
            candidate_audience == verified_audience
            or candidate_audience in wildcard
            or verified_audience in wildcard
        )

    selected: list[FieldAssertion] = []
    for assertion in records:
        matching_approved = [
            verified
            for verified in approved
            if same_applicability(assertion, verified)
        ]
        if (
            matching_approved
            and assertion.verification_status
            != VerificationStatus.HUMAN_VERIFIED
        ):
            # Once both sides carry a page hash, changed source content must
            # return to review instead of being hidden by an old approval.
            if assertion.source_content_hash and all(
                item.source_content_hash
                and item.source_content_hash
                != assertion.source_content_hash
                for item in matching_approved
            ):
                selected.append(assertion)
            continue
        selected.append(assertion)
    return selected


def _cycle_score(assertion: FieldAssertion) -> int:
    values = [str(assertion.academic_cycle or "")]
    if isinstance(assertion.value_json, dict):
        values.append(
            str(assertion.value_json.get("academic_cycle") or "")
        )
    elif assertion.field_name == "academic_cycle":
        values.append(str(assertion.value_json or ""))
    years = [
        int(year)
        for value in values
        for year in YEAR_RE.findall(value)
    ]
    return max(years, default=0)


def bundle_quality(
    assertions: Iterable[FieldAssertion],
) -> dict[str, Any]:
    bundle = _accepted_bundle(assertions)
    evidence = [
        assertion.evidence
        for assertion in bundle
        if assertion.evidence
    ]
    return {
        "cycle": max((_cycle_score(item) for item in bundle), default=0),
        "assertion_count": len(bundle),
        "evidence_count": len(evidence),
        "verification_rank": sum(
            VERIFICATION_RANK.get(assertion.verification_status, 0)
            for assertion in bundle
        ),
        "semantic_completeness": sum(
            _semantic_completeness(assertion)
            for assertion in bundle
        ),
        "value_information": min(
            20_000,
            sum(
                _value_information(assertion.value_json)
                for assertion in bundle
            ),
        ),
        "confidence_milli": round(
            sum(assertion.confidence for assertion in bundle)
            / len(bundle)
            * 1000
        )
        if bundle
        else 0,
        "evidence_chars": min(
            4000,
            sum(len(item) for item in evidence),
        ),
        "latest_retrieved_at": max(
            (assertion.retrieved_at for assertion in bundle),
            default="",
        ),
    }


def _quality_key(
    field_name: str,
    quality: dict[str, Any],
) -> tuple[Any, ...]:
    semantic_completeness = int(
        quality.get("semantic_completeness") or 0
    )
    shared = (
        int(quality.get("assertion_count") or 0),
        int(quality.get("evidence_count") or 0),
        int(quality.get("verification_rank") or 0),
        semantic_completeness,
        int(quality.get("value_information") or 0),
        int(quality.get("confidence_milli") or 0),
        int(quality.get("evidence_chars") or 0),
        str(quality.get("latest_retrieved_at") or ""),
    )
    if field_name in VOLATILE_FIELDS:
        return (int(quality.get("cycle") or 0), *shared)
    if field_name in ADMISSION_PACKAGE_FIELDS:
        return (
            semantic_completeness,
            int(quality.get("verification_rank") or 0),
            int(quality.get("assertion_count") or 0),
            int(quality.get("evidence_count") or 0),
            int(quality.get("value_information") or 0),
            int(quality.get("confidence_milli") or 0),
            int(quality.get("evidence_chars") or 0),
            str(quality.get("latest_retrieved_at") or ""),
        )
    return shared


def _semantic_completeness(assertion: FieldAssertion) -> int:
    value = assertion.value_json
    if (
        assertion.field_name not in ADMISSION_PACKAGE_FIELDS
        or not isinstance(value, dict)
    ):
        return 0
    score = 0
    if value.get("requirement_status") not in {None, "", "unknown"}:
        score += 20
    if value.get("required_count") is not None:
        score += 100
    if value.get("application_stage") not in {None, "", "unknown"}:
        score += 20
    if value.get("accepted_alternatives"):
        score += 10
    if value.get("document_type"):
        score += 20
    if isinstance(value.get("components"), list):
        score += 25 * len(value["components"])
    if value.get("details"):
        score += 5
    return score


def _value_information(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return 2
    if isinstance(value, (int, float)):
        return 4
    if isinstance(value, str):
        return min(1000, len(value.strip()))
    if isinstance(value, dict):
        return sum(
            3 + _value_information(item)
            for item in value.values()
            if item is not None and item != ""
        )
    if isinstance(value, (list, tuple, set, frozenset)):
        return sum(2 + _value_information(item) for item in value)
    return min(1000, len(str(value)))


def merge_best_assertions(
    *,
    state: StateStore,
    entity_id: str,
    current_assertions: list[FieldAssertion],
    field_names: tuple[str, ...] = DEEP_FIELDS,
    extractor_version: str | None = None,
    compatible_extractor_versions: frozenset[str] | None = None,
) -> tuple[list[FieldAssertion], list[dict[str, Any]]]:
    current_by_field: dict[str, list[FieldAssertion]] = defaultdict(list)
    for assertion in current_assertions:
        if (
            assertion.field_name in field_names
            and has_semantic_value(assertion.value_json)
            and assertion.verification_status
            != VerificationStatus.REJECTED
        ):
            current_by_field[assertion.field_name].append(assertion)

    effective: list[FieldAssertion] = []
    decisions: list[dict[str, Any]] = []
    for field_name in field_names:
        current = _accepted_bundle(current_by_field.get(field_name, []))
        cached_record = state.get_best_assertion_bundle(
            entity_id,
            field_name,
        )
        cached = (
            _accepted_bundle(
                assertion_from_dict(record)
                for record in cached_record[0]
                if (
                    str(record.get("model_name") or "")
                    not in RETIRED_ASSERTION_MODELS
                    and (
                        extractor_version is None
                        or (
                            str(record.get("extractor_version") or "")
                            in (
                                compatible_extractor_versions
                                or frozenset({extractor_version})
                            )
                        )
                    )
                )
            )
            if cached_record
            else []
        )
        original_current_count = len(current)
        original_cached_count = len(cached)
        canonical_ids = {
            assertion.assertion_id
            for assertion in prefer_human_verified([*current, *cached])
        }
        current = [
            assertion
            for assertion in current
            if assertion.assertion_id in canonical_ids
        ]
        cached = [
            assertion
            for assertion in cached
            if assertion.assertion_id in canonical_ids
        ]
        current_quality = bundle_quality(current)
        cached_quality = (
            bundle_quality(cached) if cached else {}
        )
        if not current and not cached:
            continue

        selected = "current"
        reason = "first_validated_bundle"
        chosen = current
        chosen_quality = current_quality
        if not current:
            selected = "cached"
            reason = "current_missing_or_rejected"
            chosen = cached
            chosen_quality = cached_quality
        elif cached and _quality_key(
            field_name,
            cached_quality,
        ) > _quality_key(field_name, current_quality):
            selected = "cached"
            reason = "cached_bundle_has_higher_quality"
            chosen = cached
            chosen_quality = cached_quality
        elif cached:
            reason = "current_bundle_is_newer_or_equal_quality"

        cached_was_canonicalized = len(cached) != original_cached_count
        if selected == "current" or cached_was_canonicalized:
            state.put_best_assertion_bundle(
                entity_id,
                field_name,
                [assertion.to_dict() for assertion in chosen],
                chosen_quality,
            )
        effective.extend(chosen)
        decisions.append(
            {
                "entity_id": entity_id,
                "field_name": field_name,
                "selected": selected,
                "reason": reason,
                "volatile": field_name in VOLATILE_FIELDS,
                "human_canonicalized": (
                    len(current) != original_current_count
                    or cached_was_canonicalized
                ),
                "current_quality": current_quality,
                "cached_quality": cached_quality or None,
                "selected_quality": chosen_quality,
                "selected_assertion_ids": [
                    assertion.assertion_id for assertion in chosen
                ],
                "current_values_hash": (
                    _values_hash(current) if current else None
                ),
                "cached_values_hash": (
                    _values_hash(cached) if cached else None
                ),
                "selected_values_hash": _values_hash(chosen),
                "value_stable": (
                    _values_hash(current) == _values_hash(cached)
                    if current and cached
                    else None
                ),
                "effective_value_stable": (
                    _values_hash(chosen) == _values_hash(cached)
                    if cached
                    else None
                ),
                "decided_at": utc_now_iso(),
            }
        )
    return effective, decisions


def _values_hash(assertions: list[FieldAssertion]) -> str:
    values = [
        {
            "field_name": assertion.field_name,
            "value": assertion.value_json,
            "academic_cycle": assertion.academic_cycle,
            "audience": assertion.audience,
        }
        for assertion in assertions
    ]
    encoded = json.dumps(
        values,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
