"""Versioned, declarative field quality policy.

Policies are ordinary Python data so changing a rule is an explicit policy
version change, not a schema change.  The registry is intentionally separate
from the robots/acquisition policy in :mod:`policy`.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Iterable, Mapping

from .models import SourceAuthority
from .quality_models import (
    AvailabilityState,
    Criticality,
    VerificationDimension,
    Volatility,
)


@dataclass(frozen=True)
class InferencePolicy:
    inferable: bool = False
    max_horizon_cycles: int = 0
    minimum_history: int = 0
    minimum_authority: SourceAuthority | None = None
    require_pattern_consistency: bool = True
    review_required: bool = True
    allowed_exposure: str = "ADVISORY"
    confidence_floor: float = 0.0
    allow_after_recovery: bool = False
    version: str = "inference-policy/v1"


@dataclass(frozen=True)
class FieldPolicy:
    field: str
    field_group: str
    entity_types: tuple[str, ...] = ("programme", "university", "scholarship")
    degree_levels: tuple[str, ...] = ()
    countries: tuple[str, ...] = ()
    audiences: tuple[str, ...] = ()
    academic_cycles: tuple[str, ...] = ()
    criticality: Criticality | str = Criticality.CONTEXTUAL
    volatility: Volatility | str = Volatility.MEDIUM
    freshness_days: int | None = 365
    requires_current: bool = False
    requires_target_cycle: bool = False
    acceptable_authorities: tuple[SourceAuthority, ...] = (
        SourceAuthority.OFFICIAL,
        SourceAuthority.GOVERNMENT,
        SourceAuthority.OFFICIAL_PARTNER,
        SourceAuthority.ACCREDITED_PROVIDER,
        SourceAuthority.TRUSTED_AGGREGATOR,
    )
    acceptable_verifications: tuple[VerificationDimension, ...] = (
        VerificationDimension.VALIDATED,
        VerificationDimension.HUMAN_VERIFIED,
    )
    acceptable_terminal_states: tuple[AvailabilityState, ...] = (
        AvailabilityState.FOUND,
        AvailabilityState.NOT_REQUIRED,
        AvailabilityState.NOT_PUBLISHED,
    )
    allow_not_published: bool = False
    not_published_requires_exhaustive_search: bool = True
    allow_not_required: bool = False
    not_required_requires_proof: bool = True
    recovery_strategy: tuple[str, ...] = ()
    inference: InferencePolicy = InferencePolicy()
    policy_version: str = "field-policy/v1"

    def __post_init__(self) -> None:
        if not self.field.strip() or not self.field_group.strip():
            raise ValueError("FieldPolicy requires field and field_group.")
        if self.freshness_days is not None and self.freshness_days < 0:
            raise ValueError("freshness_days must be non-negative or None.")
        if not 0 <= self.inference.confidence_floor <= 1:
            raise ValueError("inference confidence_floor must be between 0 and 1.")

    @property
    def volatility_name(self) -> str:
        return self.volatility.value if isinstance(self.volatility, Volatility) else str(self.volatility)

    @property
    def criticality_name(self) -> str:
        return self.criticality.value if isinstance(self.criticality, Criticality) else str(self.criticality)

    def matches(self, context: Mapping[str, object] | None = None) -> bool:
        context = context or {}

        def matches_values(key: str, allowed: tuple[str, ...]) -> bool:
            if not allowed:
                return True
            value = context.get(key)
            return value is not None and str(value).casefold() in {item.casefold() for item in allowed}

        return (
            matches_values("entity_type", self.entity_types)
            and matches_values("degree_level", self.degree_levels)
            and matches_values("country", self.countries)
            and matches_values("audience", self.audiences)
            and matches_values("target_cycle", self.academic_cycles)
        )

    def is_critical(self, context: Mapping[str, object] | None = None) -> bool:
        name = self.criticality_name.casefold()
        if name == Criticality.REQUIRED.value.casefold():
            return True
        if name == Criticality.OPTIONAL.value.casefold():
            return False
        context = context or {}
        required_fields = context.get("required_fields")
        return bool(
            isinstance(required_fields, (list, tuple, set, frozenset))
            and self.field in required_fields
        )

    def for_version(self, version: str) -> "FieldPolicy":
        return replace(self, policy_version=version)


class FieldPolicyRegistry:
    def __init__(
        self,
        policies: Iterable[FieldPolicy] = (),
        *,
        version: str = "field-policy/v1",
    ) -> None:
        self.version = version
        self._policies: dict[str, list[FieldPolicy]] = {}
        for policy in policies:
            self.register(policy)

    def register(self, policy: FieldPolicy, *, replace_existing: bool = True) -> None:
        if not isinstance(policy, FieldPolicy):
            raise TypeError("register expects a FieldPolicy.")
        normalized = replace(policy, policy_version=policy.policy_version or self.version)
        entries = self._policies.setdefault(normalized.field, [])
        if replace_existing:
            entries[:] = [
                existing
                for existing in entries
                if not (
                    existing.field_group == normalized.field_group
                    and existing.entity_types == normalized.entity_types
                    and existing.degree_levels == normalized.degree_levels
                    and existing.countries == normalized.countries
                    and existing.audiences == normalized.audiences
                    and existing.academic_cycles == normalized.academic_cycles
                )
            ]
        entries.append(normalized)

    def get(
        self,
        field: str,
        *,
        context: Mapping[str, object] | None = None,
    ) -> FieldPolicy:
        entries = self._policies.get(field)
        if not entries:
            return _fallback_policy(field, version=self.version)
        context = context or {}
        applicable = [policy for policy in entries if policy.matches(context)]
        candidates = applicable or entries
        return max(candidates, key=lambda policy: _specificity(policy, context))

    def get_policy(self, field: str, *, context: Mapping[str, object] | None = None) -> FieldPolicy:
        return self.get(field, context=context)

    def all(self) -> tuple[FieldPolicy, ...]:
        return tuple(policy for entries in self._policies.values() for policy in entries)

    def with_version(self, version: str) -> "FieldPolicyRegistry":
        return FieldPolicyRegistry(
            (policy.for_version(version) for policy in self.all()),
            version=version,
        )


def _specificity(policy: FieldPolicy, context: Mapping[str, object]) -> int:
    score = sum(
        bool(values)
        for values in (
            policy.entity_types,
            policy.degree_levels,
            policy.countries,
            policy.audiences,
            policy.academic_cycles,
        )
    )
    return score + (1 if policy.matches(context) else 0)


_GROUP_BY_FIELD: dict[str, str] = {
    "programme_status": "status",
    "academic_cycle": "identity",
    "programme_focus": "academics",
    "curriculum_overview": "academics",
    "specialisations": "academics",
    "learning_outcomes": "outcomes",
    "intakes": "deadline_intake",
    "priority_deadline": "deadline_intake",
    "funding_deadline": "deadline_intake",
    "international_deadline": "deadline_intake",
    "final_deadline": "deadline_intake",
    "rolling_admission": "deadline_intake",
    "application_url": "admissions",
    "minimum_degree": "admissions",
    "minimum_gpa": "admissions",
    "gpa_scale": "admissions",
    "subject_prerequisites": "admissions",
    "admission_difficulty": "admissions",
    "standardized_tests": "admissions",
    "work_experience": "admissions",
    "portfolio": "admissions",
    "required_documents": "admissions",
    "recommendation_letters": "admissions",
    "sop_essay_requirements": "admissions",
    "graduation_certificate": "admissions",
    "academic_transcript": "admissions",
    "ielts_overall": "language",
    "ielts_subscores": "language",
    "toefl": "language",
    "duolingo": "language",
    "application_fee": "finance",
    "tuition": "finance",
    "additional_fees": "finance",
    "scholarships": "funding",
    "funding": "funding",
    "funding_amount": "funding",
    "scholarship_amount": "funding",
    "career_outcomes": "outcomes",
    "employment_outcomes": "outcomes",
}


def _fallback_policy(field: str, *, version: str) -> FieldPolicy:
    group = _GROUP_BY_FIELD.get(field, "identity")
    high = field in {
        "tuition",
        "additional_fees",
        "application_fee",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "intakes",
        "funding",
        "funding_amount",
        "scholarship_amount",
        "scholarships",
        "application_status",
    }
    low = field in {"programme_focus", "curriculum_overview", "learning_outcomes", "career_outcomes"}
    volatility = Volatility.HIGH if high else Volatility.LOW if low else Volatility.MEDIUM
    required = field in {
        "programme_status",
        "minimum_degree",
        "academic_transcript",
        "graduation_certificate",
    }
    requires_cycle = high
    return FieldPolicy(
        field=field,
        field_group=group,
        criticality=Criticality.REQUIRED if required else Criticality.CONTEXTUAL,
        volatility=volatility,
        freshness_days=30 if high else 730 if low else 365,
        requires_current=high,
        requires_target_cycle=requires_cycle,
        allow_not_published=field in {"scholarships", "funding", "funding_amount", "scholarship_amount"},
        allow_not_required=field in {"toefl", "duolingo", "gre", "gmat", "work_experience", "portfolio"},
        recovery_strategy=_recovery_for(field),
        inference=InferencePolicy(
            inferable=field in {"final_deadline", "priority_deadline", "funding_amount", "scholarship_amount", "intakes"},
            max_horizon_cycles=1 if high else 2,
            minimum_history=3 if high else 2,
            minimum_authority=SourceAuthority.OFFICIAL,
            allow_after_recovery=field in {"final_deadline", "priority_deadline", "funding_amount", "scholarship_amount", "intakes"},
        ),
        policy_version=version,
    )


def _recovery_for(field: str) -> tuple[str, ...]:
    if field in {"tuition", "additional_fees", "application_fee"}:
        return ("programme_finance", "central_finance", "fee_schedule_pdf", "government", "trusted_related")
    if field in {"ielts_overall", "ielts_subscores", "toefl", "duolingo", "standardized_tests"}:
        return ("programme_admissions", "graduate_admissions", "international_admissions", "english_language_policy")
    if "deadline" in field or field in {"intakes", "rolling_admission"}:
        return ("cycle_admissions", "central_admissions", "handbook_pdf", "historical")
    if field in {"funding", "funding_amount", "scholarship_amount", "scholarships"}:
        return ("programme_funding", "official_related", "government", "scholarship_provider")
    return ("programme_official", "central_official", "trusted_related")


def build_default_registry(*, version: str = "field-policy/v1") -> FieldPolicyRegistry:
    fields = tuple(dict.fromkeys((*_GROUP_BY_FIELD, "gre", "gmat", "application_status")))
    return FieldPolicyRegistry(
        (_fallback_policy(field, version=version) for field in fields),
        version=version,
    )


DEFAULT_FIELD_POLICY_REGISTRY = build_default_registry()
FIELD_POLICY_REGISTRY = DEFAULT_FIELD_POLICY_REGISTRY


def policy_for(field: str, *, context: Mapping[str, object] | None = None, registry: FieldPolicyRegistry | None = None) -> FieldPolicy:
    return (registry or DEFAULT_FIELD_POLICY_REGISTRY).get(field, context=context)
