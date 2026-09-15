"""Regression corpus classifier for NEEDS_REVIEW cases.

Classifies remaining review cases into root cause categories for use as
regression fixtures.  Categories:

- ALIGNMENT_FIXABLE: row/column alignment issues resolvable by evidence
  alignment resolver
- SCOPE_BINDING_FIXABLE: scope/entity binding issues resolvable by
  entity/scope resolver
- PROVENANCE_FIXABLE: missing/incomplete provenance resolvable by
  provenance resolver
- MULTIPLE_FIXES_REQUIRED: case needs more than one resolver
- REAL_INSUFFICIENT_EVIDENCE: genuinely insufficient evidence, needs
  targeted acquisition
- HARD_INVALID: permanently invalid (wrong institution, provenance
  mismatch, etc.)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .models import FieldAssertion, VerificationStatus


# ---------------------------------------------------------------------------
# Classification categories
# ---------------------------------------------------------------------------

ALIGNMENT_FIXABLE = "ALIGNMENT_FIXABLE"
SCOPE_BINDING_FIXABLE = "SCOPE_BINDING_FIXABLE"
PROVENANCE_FIXABLE = "PROVENANCE_FIXABLE"
MULTIPLE_FIXES_REQUIRED = "MULTIPLE_FIXES_REQUIRED"
REAL_INSUFFICIENT_EVIDENCE = "REAL_INSUFFICIENT_EVIDENCE"
HARD_INVALID = "HARD_INVALID"


# ---------------------------------------------------------------------------
# Reason-to-category mapping (generic, no institution-specific rules)
# ---------------------------------------------------------------------------

_ALIGNMENT_REASONS = frozenset({
    "MULTIPLE_AMOUNT_ROW_ALIGNMENT",
    "ROW_ALIGNMENT_MISSING",
    "TABLE_ALIGNMENT_UNCERTAIN",
})

_SCOPE_REASONS = frozenset({
    "ORGANISATION_UNIT_UNVERIFIED",
    "PROGRAMME_SCOPE_UNVERIFIED",
    "SUBJECT_SCOPE_UNVERIFIED",
})

_PROVENANCE_REASONS = frozenset({
    "MISSING_PROVENANCE",
    "CONTENT_HASH_MISMATCH",
    "SOURCE_BINDING_MISMATCH",
    "EVIDENCE_NOT_IN_SNAPSHOT",
    "EVIDENCE_NOT_IN_SOURCE_TEXT",
    "EVIDENCE_MISSING_FROM_ASSERTION",
})

_HARD_REASONS = frozenset({
    "WRONG_INSTITUTION",
    "WRONG_PROGRAMME",
    "PROVENANCE_MISMATCH",
    "NON_NATIVE_OBSERVATION",
    "SEARCH_NOT_EVIDENCE",
    "INAPPLICABLE_ENTITY",
    "EXTERNAL_ENTITY_MATCH_UNVERIFIED",
    "VALUE_NOT_SUPPORTED",
})

_CURRENCY_REASONS = frozenset({
    "CURRENCY_NOT_ESTABLISHED",
})

_BASIS_REASONS = frozenset({
    "BASIS_NOT_SUPPORTED",
})

_QUALIFIED_REASONS = frozenset({
    "QUALIFIED_AMOUNT_REQUIRES_REVIEW",
})


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CaseClassification:
    """Classification of a single NEEDS_REVIEW case."""

    assertion_id: str
    category: str
    reasons: tuple[str, ...]
    field_name: str = ""
    is_fixable: bool = False
    resolver: str | None = None  # which resolver can fix it


def classify_case(
    assertion: FieldAssertion,
) -> CaseClassification:
    """Classify a single review case by root cause."""
    reasons = tuple(assertion.validation_errors)
    assertion_id = assertion.assertion_id
    field = assertion.field_name

    # Determine which categories are active
    has_alignment = bool(set(reasons) & _ALIGNMENT_REASONS)
    has_scope = bool(set(reasons) & _SCOPE_REASONS)
    has_provenance = bool(set(reasons) & _PROVENANCE_REASONS)
    has_hard = bool(set(reasons) & _HARD_REASONS)
    has_currency = bool(set(reasons) & _CURRENCY_REASONS)
    has_basis = bool(set(reasons) & _BASIS_REASONS)
    has_qualified = bool(set(reasons) & _QUALIFIED_REASONS)

    # Hard invalid - no fix possible
    if has_hard:
        return CaseClassification(
            assertion_id=assertion_id,
            category=HARD_INVALID,
            reasons=reasons,
            field_name=field,
            is_fixable=False,
        )

    # Multiple fix categories
    fix_count = sum([has_alignment, has_scope, has_provenance])
    if has_currency or has_basis:
        # Currency/basis issues may need alignment or are insufficient evidence
        fix_count += 1

    if fix_count > 1:
        return CaseClassification(
            assertion_id=assertion_id,
            category=MULTIPLE_FIXES_REQUIRED,
            reasons=reasons,
            field_name=field,
            is_fixable=True,
            resolver="multiple",
        )

    # Single-category fixable cases
    if has_alignment:
        return CaseClassification(
            assertion_id=assertion_id,
            category=ALIGNMENT_FIXABLE,
            reasons=reasons,
            field_name=field,
            is_fixable=True,
            resolver="evidence_alignment",
        )

    if has_scope:
        return CaseClassification(
            assertion_id=assertion_id,
            category=SCOPE_BINDING_FIXABLE,
            reasons=reasons,
            field_name=field,
            is_fixable=True,
            resolver="entity_scope",
        )

    if has_provenance:
        return CaseClassification(
            assertion_id=assertion_id,
            category=PROVENANCE_FIXABLE,
            reasons=reasons,
            field_name=field,
            is_fixable=True,
            resolver="provenance",
        )

    # Currency/basis issues - may be insufficient evidence or qualified amounts
    if has_currency or has_basis:
        return CaseClassification(
            assertion_id=assertion_id,
            category=REAL_INSUFFICIENT_EVIDENCE,
            reasons=reasons,
            field_name=field,
            is_fixable=False,
        )

    if has_qualified:
        return CaseClassification(
            assertion_id=assertion_id,
            category=REAL_INSUFFICIENT_EVIDENCE,
            reasons=reasons,
            field_name=field,
            is_fixable=False,
        )

    # Default: check other validation errors
    other_errors = set(reasons) - _HARD_REASONS - _ALIGNMENT_REASONS - _SCOPE_REASONS - _PROVENANCE_REASONS - _CURRENCY_REASONS - _BASIS_REASONS - _QUALIFIED_REASONS

    if other_errors:
        # Check if any are fixable
        fixable_errors = {
            "FUNDING_FACT_MISSING",
            "FUNDING_TYPE_NOT_SUPPORTED",
            "FIELD_NOT_SUPPORTED",
            "DEADLINE_TYPE_NOT_SUPPORTED",
            "THRESHOLD_NOT_EXPLICIT",
            "REQUIREMENT_NOT_EXPLICIT",
            "ADMISSION_VS_COMPLETION_UNRESOLVED",
            "STRUCTURED_THRESHOLD_REQUIRES_REVIEW",
            "UNSUPPORTED_VALUE_FORMAT",
        }
        if other_errors & fixable_errors:
            return CaseClassification(
                assertion_id=assertion_id,
                category=REAL_INSUFFICIENT_EVIDENCE,
                reasons=reasons,
                field_name=field,
                is_fixable=False,
            )

    return CaseClassification(
        assertion_id=assertion_id,
        category=REAL_INSUFFICIENT_EVIDENCE,
        reasons=reasons,
        field_name=field,
        is_fixable=False,
    )


def classify_corpus(
    assertions: Sequence[FieldAssertion],
) -> dict[str, list[CaseClassification]]:
    """Classify all NEEDS_REVIEW assertions in a corpus."""
    result: dict[str, list[CaseClassification]] = {
        ALIGNMENT_FIXABLE: [],
        SCOPE_BINDING_FIXABLE: [],
        PROVENANCE_FIXABLE: [],
        MULTIPLE_FIXES_REQUIRED: [],
        REAL_INSUFFICIENT_EVIDENCE: [],
        HARD_INVALID: [],
    }

    for a in assertions:
        if a.verification_status != VerificationStatus.NEEDS_REVIEW:
            continue
        classification = classify_case(a)
        result[classification.category].append(classification)

    return result


def corpus_summary(
    classifications: dict[str, list[CaseClassification]],
) -> dict[str, Any]:
    """Summarize corpus classification results."""
    total = sum(len(v) for v in classifications.values())
    fixable = sum(
        len(v) for k, v in classifications.items()
        if k != HARD_INVALID and k != REAL_INSUFFICIENT_EVIDENCE
    )
    return {
        "total_review_cases": total,
        "by_category": {k: len(v) for k, v in classifications.items()},
        "total_fixable": fixable,
        "total_unfixable": total - fixable,
        "by_resolver": {
            "evidence_alignment": len(classifications[ALIGNMENT_FIXABLE]),
            "entity_scope": len(classifications[SCOPE_BINDING_FIXABLE]),
            "provenance": len(classifications[PROVENANCE_FIXABLE]),
            "multiple": len(classifications[MULTIPLE_FIXES_REQUIRED]),
        },
    }
