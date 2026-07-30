from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, replace
from typing import Any, Iterable

from .best_assertions import assertion_from_dict
from .models import (
    DEEP_FIELDS,
    FieldAssertion,
    VerificationStatus,
    has_semantic_value,
    stable_id,
)
from .parsing import normalize_text
from .storage import StateStore


# These fields can legitimately be governed by a central undergraduate or
# graduate admissions policy. Scope and applicability checks below still have
# to pass before any individual assertion is shared.
INHERITABLE_FIELDS: frozenset[str] = frozenset(
    {
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "rolling_admission",
        "minimum_degree",
        "minimum_gpa",
        "gpa_scale",
        "admission_difficulty",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_tests",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
        "application_fee",
        "application_url",
        "tuition",
        "additional_fees",
        "scholarships",
    }
)

# A central page alone is not enough for these high-impact fields. The
# extraction must also have retained explicit applicability evidence.
APPLICABILITY_REQUIRED_FIELDS: frozenset[str] = frozenset(
    {
        "minimum_degree",
        "minimum_gpa",
        "admission_difficulty",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_tests",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
        "application_fee",
        "application_url",
        "tuition",
        "additional_fees",
        "scholarships",
    }
)

VOLATILE_SHARED_FIELDS: frozenset[str] = frozenset(
    {
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


@dataclass(frozen=True)
class SharedBundleKey:
    institution_id: str
    degree_level: str
    audience: str
    academic_cycle: str
    field_name: str

    @property
    def serialized(self) -> str:
        return "|".join(
            (
                self.institution_id,
                self.degree_level,
                self.audience,
                self.academic_cycle,
                self.field_name,
            )
        )


def _normalized_token(value: str | None, fallback: str = "unknown") -> str:
    normalized = normalize_text(str(value or "")).casefold()
    return normalized or fallback


def _stable_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def review_fingerprint(
    assertion: FieldAssertion,
    *,
    institution_id: str,
    degree_level: str | None,
) -> str | None:
    """Identify facts that one human decision may safely resolve together."""
    if (
        not has_semantic_value(assertion.value_json)
        or assertion.null_reason is not None
    ):
        return None
    shared_scope = _normalized_token(assertion.scope)
    entity_partition = (
        ""
        if shared_scope == "institution"
        else assertion.entity_id
    )
    source_identity = (
        assertion.source_content_hash
        or _normalized_token(assertion.source_url)
    )
    evidence = normalize_text(assertion.evidence or "").casefold()
    return stable_id(
        "review-fingerprint",
        institution_id,
        _normalized_token(degree_level),
        entity_partition,
        assertion.field_name,
        source_identity,
        _stable_json(assertion.value_json),
        evidence,
        shared_scope,
        _normalized_token(assertion.audience),
        _normalized_token(assertion.academic_cycle),
    )


def with_review_fingerprint(
    assertion: FieldAssertion,
    *,
    institution_id: str,
    degree_level: str | None,
) -> FieldAssertion:
    fingerprint = review_fingerprint(
        assertion,
        institution_id=institution_id,
        degree_level=degree_level,
    )
    if assertion.review_fingerprint == fingerprint:
        return assertion
    return replace(assertion, review_fingerprint=fingerprint)


def is_shareable(assertion: FieldAssertion) -> bool:
    if assertion.field_name not in INHERITABLE_FIELDS:
        return False
    if (
        not has_semantic_value(assertion.value_json)
        or assertion.null_reason is not None
    ):
        return False
    if assertion.verification_status == VerificationStatus.REJECTED:
        return False
    if _normalized_token(assertion.scope) != "institution":
        return False
    if not assertion.source_url or not assertion.evidence:
        return False
    if assertion.validation_errors:
        return False
    if (
        assertion.field_name in APPLICABILITY_REQUIRED_FIELDS
        and (
            not assertion.applicability_source_url
            or not assertion.applicability_evidence
        )
    ):
        return False
    return True


def bundle_key(
    assertion: FieldAssertion,
    *,
    institution_id: str,
    degree_level: str | None,
) -> SharedBundleKey:
    return SharedBundleKey(
        institution_id=institution_id,
        degree_level=_normalized_token(degree_level),
        audience=_normalized_token(assertion.audience, "all"),
        academic_cycle=_normalized_token(assertion.academic_cycle),
        field_name=assertion.field_name,
    )


def _assertion_signature(assertion: FieldAssertion) -> tuple[str, ...]:
    return (
        assertion.field_name,
        assertion.source_content_hash or assertion.source_url or "",
        _stable_json(assertion.value_json),
        normalize_text(assertion.evidence or "").casefold(),
        _normalized_token(assertion.audience),
        _normalized_token(assertion.academic_cycle),
    )


def cache_shared_assertions(
    *,
    state: StateStore,
    institution_id: str,
    degree_level: str | None,
    assertions: Iterable[FieldAssertion],
    extractor_version: str,
    compatible_extractor_versions: frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    grouped: dict[SharedBundleKey, list[FieldAssertion]] = defaultdict(list)
    for assertion in assertions:
        # Never create inheritance chains. The original native assertion is
        # the only source of a shared bundle.
        if assertion.inherited_from_assertion_id or not is_shareable(assertion):
            continue
        grouped[
            bundle_key(
                assertion,
                institution_id=institution_id,
                degree_level=degree_level,
            )
        ].append(assertion)

    events: list[dict[str, Any]] = []
    for key, candidates in grouped.items():
        existing_payload = state.get_shared_assertion_bundle(
            institution_id=key.institution_id,
            degree_level=key.degree_level,
            audience=key.audience,
            academic_cycle=key.academic_cycle,
            field_name=key.field_name,
        )
        existing = [
            assertion_from_dict(payload)
            for payload in existing_payload
            if str(payload.get("extractor_version") or "")
            in (
                compatible_extractor_versions
                or frozenset({extractor_version})
            )
        ]
        merged: dict[tuple[str, ...], FieldAssertion] = {
            _assertion_signature(assertion): assertion
            for assertion in existing
        }
        for assertion in candidates:
            merged[_assertion_signature(assertion)] = assertion
        ordered = sorted(
            merged.values(),
            key=lambda item: (
                str(item.source_url or ""),
                item.assertion_id,
            ),
        )
        state.put_shared_assertion_bundle(
            institution_id=key.institution_id,
            degree_level=key.degree_level,
            audience=key.audience,
            academic_cycle=key.academic_cycle,
            field_name=key.field_name,
            assertions=[assertion.to_dict() for assertion in ordered],
        )
        events.append(
            {
                "event": "shared_bundle_upserted",
                "inheritance_key": key.serialized,
                "institution_id": key.institution_id,
                "degree_level": key.degree_level,
                "audience": key.audience,
                "academic_cycle": key.academic_cycle,
                "field_name": key.field_name,
                "assertion_count": len(ordered),
            }
        )
    return events


def _cycle_score(value: str) -> int:
    return max((int(year) for year in YEAR_RE.findall(value)), default=0)


def _latest_volatile_keys(
    records: list[tuple[SharedBundleKey, list[dict[str, Any]]]],
) -> set[SharedBundleKey]:
    latest: dict[tuple[str, str], int] = {}
    for key, _ in records:
        if key.field_name not in VOLATILE_SHARED_FIELDS:
            continue
        slot = (key.field_name, key.audience)
        latest[slot] = max(
            latest.get(slot, 0),
            _cycle_score(key.academic_cycle),
        )
    return {
        key
        for key, _ in records
        if (
            key.field_name not in VOLATILE_SHARED_FIELDS
            or _cycle_score(key.academic_cycle)
            == latest.get((key.field_name, key.audience), 0)
        )
    }


def inherited_assertions_for_programme(
    *,
    state: StateStore,
    institution_id: str,
    degree_level: str | None,
    programme_id: str,
    extractor_version: str,
    compatible_extractor_versions: frozenset[str] | None = None,
) -> tuple[list[FieldAssertion], list[dict[str, Any]]]:
    normalized_degree = _normalized_token(degree_level)
    records = [
        (
            SharedBundleKey(
                institution_id=institution_id,
                degree_level=normalized_degree,
                audience=str(record["audience"]),
                academic_cycle=str(record["academic_cycle"]),
                field_name=str(record["field_name"]),
            ),
            list(record["assertions"]),
        )
        for record in state.list_shared_assertion_bundles(
            institution_id=institution_id,
            degree_level=normalized_degree,
        )
    ]
    allowed_keys = _latest_volatile_keys(records)
    inherited: list[FieldAssertion] = []
    events: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set()
    for key, payloads in records:
        if key not in allowed_keys:
            continue
        for payload in payloads:
            if (
                str(payload.get("extractor_version") or "")
                not in (
                    compatible_extractor_versions
                    or frozenset({extractor_version})
                )
            ):
                continue
            source = assertion_from_dict(payload)
            if not is_shareable(source):
                continue
            signature = _assertion_signature(source)
            if signature in seen:
                continue
            seen.add(signature)
            clone = replace(
                source,
                assertion_id=stable_id(
                    "inherited-assertion",
                    programme_id,
                    source.assertion_id,
                    key.serialized,
                ),
                entity_type="programme",
                entity_id=programme_id,
                extraction_group=(
                    f"inherited:{source.extraction_group or 'unknown'}"
                ),
                inherited_from_assertion_id=source.assertion_id,
                inherited_from_entity_id=source.entity_id,
                inheritance_key=key.serialized,
            )
            inherited.append(clone)
            events.append(
                {
                    "event": "assertion_inherited",
                    "inheritance_key": key.serialized,
                    "institution_id": institution_id,
                    "degree_level": normalized_degree,
                    "programme_id": programme_id,
                    "field_name": source.field_name,
                    "assertion_id": clone.assertion_id,
                    "inherited_from_assertion_id": source.assertion_id,
                    "inherited_from_entity_id": source.entity_id,
                    "review_fingerprint": clone.review_fingerprint,
                }
            )
    return inherited, events


def fields_to_extract(
    inherited: Iterable[FieldAssertion],
) -> tuple[str, ...]:
    covered = {
        assertion.field_name
        for assertion in inherited
        if is_shareable(assertion)
    }
    return tuple(
        field_name for field_name in DEEP_FIELDS if field_name not in covered
    )


def merge_current_and_inherited(
    current: Iterable[FieldAssertion],
    inherited: Iterable[FieldAssertion],
) -> list[FieldAssertion]:
    current_list = list(current)
    current_programme_fields = {
        assertion.field_name
        for assertion in current_list
        if (
            has_semantic_value(assertion.value_json)
            and assertion.verification_status
            != VerificationStatus.REJECTED
            and _normalized_token(assertion.scope) == "programme"
        )
    }
    merged = list(current_list)
    seen = {
        _assertion_signature(assertion)
        for assertion in current_list
        if has_semantic_value(assertion.value_json)
    }
    for assertion in inherited:
        if assertion.field_name in current_programme_fields:
            continue
        signature = _assertion_signature(assertion)
        if signature in seen:
            continue
        seen.add(signature)
        merged.append(assertion)
    return merged
