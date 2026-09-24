"""Conservative, provenance-preserving hierarchical donor inference.

This is an opt-in second rail. It never rewrites an observed assertion and it
never makes an estimate product-safe. The ladder is deliberately explicit:
parent organisation, institution, sibling programme, then peer institution.
Only native observed assertions are eligible donors; inherited and inferred
assertions are excluded to prevent circular estimates and lineage leakage.
"""

from __future__ import annotations

import copy
import enum
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from statistics import median
from typing import Any, Iterable, Mapping

from .field_policy import DEFAULT_FIELD_POLICY_REGISTRY, FieldPolicyRegistry
from .inference import InferenceRecord
from .models import (
    ApplicabilityState,
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
    stable_id,
)


class HierarchyLevel(str, enum.Enum):
    PARENT_ORGANISATION = "H1_PARENT_ORGANISATION"
    INSTITUTION = "H2_INSTITUTION"
    SIBLING_PROGRAMME = "H3_SIBLING_PROGRAMME"
    PEER_INSTITUTION = "H4_PEER_INSTITUTION"

    @property
    def short_code(self) -> str:
        return self.value.split("_", 1)[0]


@dataclass(frozen=True)
class EntityContext:
    """Structured identity attributes used by compatibility checks."""

    entity_id: str
    institution_id: str | None = None
    degree_level: str | None = None
    audience: str | None = None
    academic_cycle: str | None = None
    programme_family: str | None = None
    field_domain: str | None = None
    organisation_unit_id: str | None = None
    organisation_unit_ids: tuple[str, ...] = ()
    parent_organisation_unit_id: str | None = None
    country: str | None = None
    institution_type: str | None = None
    campus: str | None = None
    delivery_mode: str | None = None
    currency: str | None = None
    unit_basis: str | None = None
    verified_attributes: frozenset[str] = frozenset()

    def with_defaults(self, **values: Any) -> "EntityContext":
        data = {name: getattr(self, name) for name in self.__dataclass_fields__}
        for key, value in values.items():
            if value not in (None, "", (), frozenset()):
                data[key] = value
        return EntityContext(**data)


@dataclass(frozen=True)
class DonorCandidate:
    assertion: FieldAssertion
    level: HierarchyLevel
    hierarchy_distance: int
    donor_context: EntityContext
    policy_lineage_id: str
    similarity_signals: dict[str, float] = field(default_factory=dict)
    cycle_compatibility: str = "UNKNOWN"
    applicability_compatibility: str = "UNKNOWN"

    @property
    def authority_score(self) -> float:
        return _authority_score(self.assertion) / 5.0

    @property
    def weight(self) -> float:
        similarity = (
            sum(self.similarity_signals.values()) / len(self.similarity_signals)
            if self.similarity_signals
            else 0.0
        )
        return max(0.05, 0.5 + 0.3 * similarity + 0.2 * self.authority_score)

    def to_dict(self) -> dict[str, Any]:
        return {
            "assertion_id": self.assertion.assertion_id,
            "entity_id": self.assertion.entity_id,
            "entity_type": self.assertion.entity_type,
            "level": self.level.value,
            "hierarchy_distance": self.hierarchy_distance,
            "policy_lineage_id": self.policy_lineage_id,
            "similarity_signals": dict(self.similarity_signals),
            "cycle_compatibility": self.cycle_compatibility,
            "applicability_compatibility": self.applicability_compatibility,
            "weight": round(self.weight, 6),
        }


@dataclass(frozen=True)
class UncertaintyComponents:
    source_uncertainty: float
    temporal_uncertainty: float
    scope_applicability_uncertainty: float
    hierarchy_distance_uncertainty: float
    donor_similarity_uncertainty: float
    donor_dispersion_uncertainty: float
    support_count_uncertainty: float
    cross_source_conflict_uncertainty: float
    combined: float
    category: str
    reasons: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_uncertainty": self.source_uncertainty,
            "temporal_uncertainty": self.temporal_uncertainty,
            "scope_applicability_uncertainty": self.scope_applicability_uncertainty,
            "hierarchy_distance_uncertainty": self.hierarchy_distance_uncertainty,
            "donor_similarity_uncertainty": self.donor_similarity_uncertainty,
            "donor_dispersion_uncertainty": self.donor_dispersion_uncertainty,
            "support_count_uncertainty": self.support_count_uncertainty,
            "cross_source_conflict_uncertainty": self.cross_source_conflict_uncertainty,
            "combined": self.combined,
            "category": self.category,
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True)
class HierarchicalInferenceDecision:
    record: InferenceRecord | None
    level: HierarchyLevel | None
    reason: str
    candidates: tuple[DonorCandidate, ...] = ()
    rejected: tuple[dict[str, Any], ...] = ()

    @property
    def abstained(self) -> bool:
        return self.record is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "record": self.record.to_dict() if self.record else None,
            "level": self.level.value if self.level else None,
            "reason": self.reason,
            "candidates": [item.to_dict() for item in self.candidates],
            "rejected": list(self.rejected),
            "abstained": self.abstained,
        }


_PARENT_SCOPES = frozenset(
    {
        "department",
        "faculty",
        "school",
        "college",
        "division",
        "institute",
        "organisation_unit",
        "organization_unit",
    }
)
_INSTITUTION_SCOPES = frozenset(
    {"institution", "university", "central", "graduate_school", "institution_wide"}
)
_PROGRAMME_SCOPES = frozenset({"programme", "program", "offering"})
_PROGRAMME_TYPES = frozenset({"programme", "program", "offering"})
_INSTITUTION_TYPES = frozenset(
    {"institution", "university", "organisation", "organization"}
)
_PARENT_TYPES = _PARENT_SCOPES
_STRICT_FIELDS = frozenset(
    {
        "tuition",
        "additional_fees",
        "application_fee",
        "funding_amount",
        "scholarship_amount",
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "rolling_admission",
    }
)
# Institution-level finance sources (for example government tuition tables)
# describe an institution tariff, not a programme degree.  They can therefore
# be carried as institution-scoped context when the source itself supplies the
# audience/currency/basis dimensions.  This is deliberately narrower than the
# general strict-field policy and does not turn institution facts into
# programme facts.
_INSTITUTION_CONTEXT_FIELDS = frozenset({"tuition", "additional_fees"})
_AUTHORITY_SCORES = {
    SourceAuthority.OFFICIAL: 5,
    SourceAuthority.GOVERNMENT: 5,
    SourceAuthority.OFFICIAL_PARTNER: 4,
    SourceAuthority.ACCREDITED_PROVIDER: 3,
    SourceAuthority.TRUSTED_AGGREGATOR: 2,
    SourceAuthority.ARCHIVE: 1,
}
_ELIGIBLE_RELATIONSHIPS = frozenset(
    {
        SourceRelationship.DIRECT_OFFICIAL.value,
        SourceRelationship.PARENT_INSTITUTION.value,
        SourceRelationship.DEPARTMENT.value,
        SourceRelationship.CENTRAL_ADMISSIONS.value,
        SourceRelationship.INTERNATIONAL_ADMISSIONS.value,
        SourceRelationship.FINANCE_OFFICE.value,
        SourceRelationship.GOVERNMENT.value,
        SourceRelationship.PARTNER_INSTITUTION.value,
        SourceRelationship.CONSORTIUM.value,
        SourceRelationship.CATALOGUE_PROVIDER.value,
        SourceRelationship.ACCREDITATION_BODY.value,
        SourceRelationship.ARCHIVE.value,
    }
)
_DISTANCE_BY_LEVEL = {
    HierarchyLevel.PARENT_ORGANISATION: 1,
    HierarchyLevel.INSTITUTION: 2,
    HierarchyLevel.SIBLING_PROGRAMME: 3,
    HierarchyLevel.PEER_INSTITUTION: 4,
}
_UNCERTAINTY_WEIGHTS = {
    "source": 0.12,
    "temporal": 0.12,
    "scope": 0.14,
    "distance": 0.18,
    "similarity": 0.16,
    "dispersion": 0.10,
    "support": 0.10,
    "conflict": 0.08,
}
_YEAR_RE = re.compile(r"20\d{2}")
_DEGREE_ALIASES = {
    "undergraduate": "bachelor",
    "undergrad": "bachelor",
    "bachelor's": "bachelor",
    "bachelors": "bachelor",
    "graduate": "master",
    "masters": "master",
    "master's": "master",
    "postgraduate": "master",
    "doctoral": "phd",
    "doctorate": "phd",
}


def _token(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def _degree_token(value: Any) -> str:
    token = _token(value)
    return _DEGREE_ALIASES.get(token, token)


def _get(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _years(value: str | None) -> set[int]:
    return {int(item) for item in _YEAR_RE.findall(str(value or ""))}


def _cycle_match(left: str | None, right: str | None) -> bool:
    a, b = _years(left), _years(right)
    # Academic cycles are identified by their start year.  Treating
    # ``2025-2026`` and ``2026-2027`` as overlapping merely because they share
    # a calendar year would admit a one-cycle mismatch.
    return not a or not b or min(a) == min(b)


def _cycle_distance(left: str | None, right: str | None) -> int | None:
    a, b = sorted(_years(left)), sorted(_years(right))
    if not a or not b:
        return None
    return abs(a[0] - b[0])


def _audience_match(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return True
    a, b = _token(left), _token(right)
    if a in {"all", "any", "unknown"} or b in {"all", "any", "unknown"}:
        return True
    domestic = {"domestic", "home", "local"}
    international = {"international", "overseas", "foreign"}
    if (a in domestic and b in international) or (
        a in international and b in domestic
    ):
        return False
    return a == b


def _value_metadata(assertion: FieldAssertion, *keys: str) -> Any:
    value = assertion.value_json
    if isinstance(value, Mapping):
        for key in keys:
            if value.get(key) not in (None, ""):
                return value[key]
    return None


def _attribute(assertion: FieldAssertion, name: str) -> Any:
    if name == "degree_level":
        degree_keys = ["degree_level", "degree"]
        # Finance payloads often use ``credential`` for a residency/fee label
        # (for example, "out-of-state students"), not for an academic degree.
        # Keep the legacy credential fallback for every other field so this
        # repair cannot reduce degree evidence outside the proven finance case.
        if assertion.field_name not in _INSTITUTION_CONTEXT_FIELDS:
            degree_keys.append("credential")
        return assertion.degree_level or _value_metadata(assertion, *degree_keys)
    if name == "audience":
        return assertion.audience or _value_metadata(
            assertion, "audience", "student_type", "residency"
        )
    if name == "academic_cycle":
        return assertion.academic_cycle or _value_metadata(
            assertion, "academic_cycle", "cycle", "year"
        )
    if name == "currency":
        return _value_metadata(assertion, "currency", "target_currency", "fee_currency")
    if name == "unit_basis":
        return _value_metadata(
            assertion, "unit_basis", "basis", "fee_period", "period", "tuition_basis"
        )
    if name == "campus":
        return _value_metadata(assertion, "campus")
    if name == "delivery_mode":
        return _value_metadata(assertion, "delivery_mode", "mode")
    return getattr(assertion, name, None)


def _authority_score(assertion: FieldAssertion) -> int:
    authority = getattr(assertion.source_authority, "value", assertion.source_authority)
    return next(
        (score for item, score in _AUTHORITY_SCORES.items() if item.value == authority),
        0,
    )


def _enum_value(value: Any) -> str:
    return str(getattr(value, "value", value or ""))


def _scope_kind(assertion: FieldAssertion) -> str:
    scope = _token(assertion.scope)
    entity_type = _token(assertion.entity_type)
    if scope in _PARENT_SCOPES or entity_type in _PARENT_TYPES:
        return "parent"
    if scope in _INSTITUTION_SCOPES or entity_type in _INSTITUTION_TYPES:
        return "institution"
    if scope in _PROGRAMME_SCOPES or entity_type in _PROGRAMME_TYPES:
        return "programme"
    return scope


def _lineage_id(assertion: FieldAssertion, explicit: Mapping[str, str] | None) -> str:
    if explicit and assertion.assertion_id in explicit:
        return str(explicit[assertion.assertion_id])
    return str(
        assertion.source_content_hash
        or assertion.evidence_locator
        or assertion.source_url
        or assertion.raw_document_id
        or assertion.assertion_id
    )


def _normalise_context(value: Any, *, fallback_id: str | None = None) -> EntityContext:
    entity_id = str(
        _get(
            value,
            "entity_id",
            _get(
                value,
                "programme_id",
                _get(
                    value,
                    "organisation_unit_id",
                    _get(value, "institution_id", fallback_id or ""),
                ),
            ),
        )
        or ""
    )
    verified = _get(value, "verified_attributes", ())
    if isinstance(verified, str):
        verified = (verified,)
    if not verified and _get(value, "verified", False) is True:
        verified = (
            "country",
            "institution_type",
            "field_domain",
            "degree_level",
            "programme_family",
            "audience",
            "academic_cycle",
        )
    units = _get(value, "organisation_unit_ids", ()) or ()
    if isinstance(units, str):
        units = (units,)
    primary = _get(value, "organisation_unit_id")
    if primary and primary not in units:
        units = (primary, *units)
    return EntityContext(
        entity_id=entity_id,
        institution_id=str(_get(value, "institution_id") or "") or None,
        degree_level=_get(value, "degree_level"),
        audience=_get(value, "audience") or _get(value, "student_type"),
        academic_cycle=_get(value, "academic_cycle") or _get(value, "cycle"),
        programme_family=_get(value, "programme_family")
        or _get(value, "normalized_field")
        or _get(value, "field_domain"),
        field_domain=_get(value, "field_domain"),
        organisation_unit_id=primary,
        organisation_unit_ids=tuple(str(item) for item in units if item),
        parent_organisation_unit_id=_get(
            value, "parent_organisation_unit_id"
        ),
        country=_get(value, "country") or _get(value, "country_code"),
        institution_type=_get(value, "institution_type"),
        campus=_get(value, "campus"),
        delivery_mode=_get(value, "delivery_mode"),
        currency=_get(value, "currency"),
        unit_basis=_get(value, "unit_basis") or _get(value, "basis"),
        verified_attributes=frozenset(_token(item) for item in verified if item),
    )


def _context_collection(
    values: Iterable[Any] | Mapping[str, Any], *, kind: str
) -> dict[str, EntityContext]:
    result: dict[str, EntityContext] = {}
    if isinstance(values, Mapping):
        iterable = ((key, value) for key, value in values.items())
    else:
        iterable = ((None, value) for value in values)
    for key, value in iterable:
        fallback = str(key) if key is not None else None
        context = _normalise_context(value, fallback_id=fallback)
        if not context.entity_id:
            continue
        if kind == "institution" and not context.institution_id:
            context = context.with_defaults(institution_id=context.entity_id)
        result[context.entity_id] = context
    return result


def _native_observed(assertion: FieldAssertion) -> bool:
    return (
        _enum_value(assertion.epistemic_state) == EpistemicState.OBSERVED.value
        and assertion.inherited_from_assertion_id is None
        and assertion.inherited_from_entity_id is None
        and assertion.source_type not in {"historical_inference", "hierarchical_inference"}
        and _enum_value(assertion.verification_status) != VerificationStatus.REJECTED.value
        and assertion.null_reason is None
        and has_semantic_value(assertion.value_json)
    )


def _numeric_value(value: Any) -> tuple[float, str | None] | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value), None
    if isinstance(value, Mapping):
        for key in ("amount", "value", "numeric_value", "tuition", "fee"):
            candidate = value.get(key)
            if isinstance(candidate, bool):
                continue
            if isinstance(candidate, (int, float)) and math.isfinite(float(candidate)):
                return float(candidate), key
    return None


def _value_key(value: Any) -> str:
    if isinstance(value, Mapping):
        return repr(sorted((str(key), repr(item)) for key, item in value.items()))
    return repr(value)


def _similarity(
    level: HierarchyLevel,
    target: EntityContext,
    donor: EntityContext,
    *,
    audience: str | None,
    cycle: str | None,
) -> dict[str, float]:
    def same(left: Any, right: Any) -> float:
        if left in (None, "") or right in (None, ""):
            return 0.0
        return 1.0 if _token(left) == _token(right) else 0.0

    signals: dict[str, float] = {
        "same_degree": 1.0
        if _degree_token(target.degree_level) == _degree_token(donor.degree_level)
        and target.degree_level
        and donor.degree_level
        else 0.0,
        "same_audience": 1.0
        if _audience_match(target.audience or audience, donor.audience)
        else 0.0,
        "same_cycle": 1.0
        if _cycle_match(target.academic_cycle or cycle, donor.academic_cycle)
        else 0.0,
    }
    if level == HierarchyLevel.PARENT_ORGANISATION:
        signals["same_institution"] = same(target.institution_id, donor.institution_id)
        signals["same_organisation_chain"] = (
            1.0
            if donor.organisation_unit_id in target.organisation_unit_ids
            else 0.0
        )
    elif level == HierarchyLevel.INSTITUTION:
        signals["same_institution"] = same(target.institution_id, donor.institution_id)
    elif level == HierarchyLevel.SIBLING_PROGRAMME:
        signals.update(
            {
                "same_institution": same(target.institution_id, donor.institution_id),
                "same_programme_family": same(
                    target.programme_family, donor.programme_family
                ),
                "same_organisation_unit": (
                    1.0
                    if donor.organisation_unit_id
                    and donor.organisation_unit_id in target.organisation_unit_ids
                    else 0.0
                ),
            }
        )
    else:
        signals.update(
            {
                "same_country": same(target.country, donor.country),
                "same_institution_type": same(
                    target.institution_type, donor.institution_type
                ),
                "same_field_domain": same(
                    target.field_domain or target.programme_family,
                    donor.field_domain or donor.programme_family,
                ),
            }
        )
    return signals


class HierarchicalInferenceEngine:
    """Compatibility-gated H1-H4 donor engine."""

    def __init__(
        self,
        registry: FieldPolicyRegistry | None = None,
        *,
        method_version: str = "hierarchical-inference/v1",
    ) -> None:
        self.registry = registry or DEFAULT_FIELD_POLICY_REGISTRY
        self.method_version = method_version

    def infer(
        self,
        *,
        field: str,
        target_cycle: str | None,
        assertions: Iterable[FieldAssertion],
        entity_type: str = "programme",
        entity_id: str | None = None,
        target: Any | None = None,
        audience: str | None = None,
        programmes: Iterable[Any] | Mapping[str, Any] = (),
        organisation_units: Iterable[Any] | Mapping[str, Any] = (),
        programme_organisation_units: Iterable[Any] = (),
        institutions: Iterable[Any] | Mapping[str, Any] = (),
        context: Mapping[str, Any] | None = None,
        policy_lineage_ids: Mapping[str, str] | None = None,
        current_assessment: Any | None = None,
        recovery_exhausted: bool = False,
    ) -> InferenceRecord | None:
        return self.explain(
            field=field,
            target_cycle=target_cycle,
            assertions=assertions,
            entity_type=entity_type,
            entity_id=entity_id,
            target=target,
            audience=audience,
            programmes=programmes,
            organisation_units=organisation_units,
            programme_organisation_units=programme_organisation_units,
            institutions=institutions,
            context=context,
            policy_lineage_ids=policy_lineage_ids,
            current_assessment=current_assessment,
            recovery_exhausted=recovery_exhausted,
        ).record

    def explain(
        self,
        *,
        field: str,
        target_cycle: str | None,
        assertions: Iterable[FieldAssertion],
        entity_type: str = "programme",
        entity_id: str | None = None,
        target: Any | None = None,
        audience: str | None = None,
        programmes: Iterable[Any] | Mapping[str, Any] = (),
        organisation_units: Iterable[Any] | Mapping[str, Any] = (),
        programme_organisation_units: Iterable[Any] = (),
        institutions: Iterable[Any] | Mapping[str, Any] = (),
        context: Mapping[str, Any] | None = None,
        policy_lineage_ids: Mapping[str, str] | None = None,
        current_assessment: Any | None = None,
        recovery_exhausted: bool = False,
    ) -> HierarchicalInferenceDecision:
        target_id = str(
            entity_id
            or _get(target, "programme_id", _get(target, "entity_id", _get(target, "id", "")))
            or ""
        )
        if not target_id or _token(entity_type) not in _PROGRAMME_TYPES:
            return HierarchicalInferenceDecision(None, None, "TARGET_MUST_BE_PROGRAMME")
        if not recovery_exhausted:
            return HierarchicalInferenceDecision(None, None, "RECOVERY_NOT_EXHAUSTED")
        all_assertions = tuple(assertions)
        programme_map = _context_collection(programmes, kind="programme")
        unit_map = _context_collection(organisation_units, kind="unit")
        institution_map = _context_collection(institutions, kind="institution")
        base = _normalise_context(target, fallback_id=target_id)
        overrides = dict(context or {})
        base = base.with_defaults(
            institution_id=overrides.get("institution_id"),
            degree_level=overrides.get("degree_level"),
            audience=audience or overrides.get("audience"),
            academic_cycle=target_cycle or overrides.get("academic_cycle"),
            programme_family=overrides.get("programme_family")
            or overrides.get("normalized_field"),
            field_domain=overrides.get("field_domain"),
            organisation_unit_id=overrides.get("organisation_unit_id"),
            country=overrides.get("country") or overrides.get("country_code"),
            institution_type=overrides.get("institution_type"),
            currency=overrides.get("currency"),
            unit_basis=overrides.get("unit_basis") or overrides.get("basis"),
        )
        if target_id in programme_map:
            source = programme_map[target_id]
            # Explicit call-site values take precedence over the catalogue
            # context, while catalogue values fill missing dimensions.
            base = EntityContext(
                entity_id=target_id,
                institution_id=base.institution_id or source.institution_id,
                degree_level=base.degree_level or source.degree_level,
                audience=base.audience or source.audience,
                academic_cycle=base.academic_cycle or source.academic_cycle,
                programme_family=base.programme_family or source.programme_family,
                field_domain=base.field_domain or source.field_domain,
                organisation_unit_id=base.organisation_unit_id or source.organisation_unit_id,
                organisation_unit_ids=base.organisation_unit_ids or source.organisation_unit_ids,
                parent_organisation_unit_id=base.parent_organisation_unit_id or source.parent_organisation_unit_id,
                country=base.country or source.country,
                institution_type=base.institution_type or source.institution_type,
                campus=base.campus or source.campus,
                delivery_mode=base.delivery_mode or source.delivery_mode,
                currency=base.currency or source.currency,
                unit_basis=base.unit_basis or source.unit_basis,
                verified_attributes=base.verified_attributes | source.verified_attributes,
            )
        if base.institution_id and base.institution_id in institution_map:
            institution = institution_map[base.institution_id]
            base = base.with_defaults(
                country=base.country or institution.country,
                institution_type=base.institution_type or institution.institution_type,
                verified_attributes=base.verified_attributes | institution.verified_attributes,
            )
        relation_units: dict[str, list[str]] = defaultdict(list)
        for relation in programme_organisation_units:
            programme = str(_get(relation, "programme_id", ""))
            unit = str(_get(relation, "organisation_unit_id", ""))
            if programme and unit:
                relation_units[programme].append(unit)
        unit_ids = list(
            dict.fromkeys(
                (*base.organisation_unit_ids, *relation_units.get(target_id, []))
            )
        )
        if base.organisation_unit_id and base.organisation_unit_id not in unit_ids:
            unit_ids.insert(0, base.organisation_unit_id)
        base = base.with_defaults(
            organisation_unit_ids=tuple(dict.fromkeys(unit_ids)),
            organisation_unit_id=unit_ids[0] if unit_ids else None,
        )

        # A current native target assertion wins. Inherited assertions are not
        # treated as direct evidence by this donor rail.
        direct = [
            item
            for item in all_assertions
            if _native_observed(item)
            and item.field_name == field
            and item.entity_id == target_id
            and _scope_kind(item) == "programme"
            and _cycle_match(_attribute(item, "academic_cycle"), target_cycle)
            and _audience_match(_attribute(item, "audience"), base.audience or audience)
        ]
        if direct:
            if len({_value_key(item.value_json) for item in direct}) > 1:
                return HierarchicalInferenceDecision(None, None, "DIRECT_TARGET_CONFLICT")
            return HierarchicalInferenceDecision(None, None, "DIRECT_TARGET_AVAILABLE")
        if current_assessment is not None:
            state = getattr(current_assessment, "state", "")
            state = str(getattr(state, "value", state))
            if bool(getattr(current_assessment, "acceptable", False)) or state == "CONFLICTING_SOURCES":
                return HierarchicalInferenceDecision(None, None, "CURRENT_ASSESSMENT_BLOCKS_INFERENCE")

        # Keep every native target-scope lineage in the exclusion set, even
        # when it is historical or cycle-mismatched. A donor recovered from
        # that same source must not look independent simply because the direct
        # target value was unavailable for the requested cycle.
        target_lineages = {
            _lineage_id(item, policy_lineage_ids)
            for item in all_assertions
            if _native_observed(item)
            and item.field_name == field
            and item.entity_id == target_id
            and _scope_kind(item) == "programme"
        }
        rejected: list[dict[str, Any]] = []
        levels = self._level_candidates(
            field=field,
            target=base,
            target_id=target_id,
            assertions=all_assertions,
            programme_map=programme_map,
            unit_map=unit_map,
            institution_map=institution_map,
            relation_units=relation_units,
            target_cycle=target_cycle,
            audience=audience,
            policy_lineage_ids=policy_lineage_ids,
            target_lineages=target_lineages,
            rejected=rejected,
        )
        for level, candidates in levels:
            if not candidates:
                continue
            decision = self._build_record(
                field=field,
                target_id=target_id,
                target_cycle=target_cycle or base.academic_cycle or "",
                candidates=candidates,
                output_scope=(
                    "institution"
                    if field in _INSTITUTION_CONTEXT_FIELDS
                    and all(_scope_kind(item.assertion) == "institution" for item in candidates)
                    else None
                ),
                output_scope_entity_id=(
                    base.institution_id
                    if field in _INSTITUTION_CONTEXT_FIELDS
                    and all(_scope_kind(item.assertion) == "institution" for item in candidates)
                    else None
                ),
                output_academic_cycle=(
                    self._institution_output_cycle(candidates)
                    if field in _INSTITUTION_CONTEXT_FIELDS
                    and all(_scope_kind(item.assertion) == "institution" for item in candidates)
                    else None
                ),
            )
            if decision.record is not None:
                return HierarchicalInferenceDecision(
                    decision.record,
                    level,
                    decision.reason,
                    tuple(candidates),
                    tuple(rejected),
                )
            # A same-level conflict is unsafe; do not silently fall through to
            # a weaker donor that could conceal it.
            return HierarchicalInferenceDecision(
                None, level, decision.reason, tuple(candidates), tuple(rejected)
            )
        return HierarchicalInferenceDecision(
            None, None, "NO_COMPATIBLE_DONOR", rejected=tuple(rejected)
        )

    def _level_candidates(
        self,
        *,
        field: str,
        target: EntityContext,
        target_id: str,
        assertions: tuple[FieldAssertion, ...],
        programme_map: dict[str, EntityContext],
        unit_map: dict[str, EntityContext],
        institution_map: dict[str, EntityContext],
        relation_units: Mapping[str, list[str]],
        target_cycle: str | None,
        audience: str | None,
        policy_lineage_ids: Mapping[str, str] | None,
        target_lineages: set[str],
        rejected: list[dict[str, Any]],
    ) -> list[tuple[HierarchyLevel, list[DonorCandidate]]]:
        del relation_units  # relation units are folded into target.organisation_unit_ids
        parent_ids: dict[str, int] = {}
        queue = [(unit_id, 1) for unit_id in target.organisation_unit_ids]
        while queue:
            unit_id, distance = queue.pop(0)
            if unit_id in parent_ids and parent_ids[unit_id] <= distance:
                continue
            parent_ids[unit_id] = distance
            parent = unit_map.get(unit_id)
            if parent and parent.parent_organisation_unit_id:
                queue.append((str(parent.parent_organisation_unit_id), distance + 1))

        levels: list[tuple[HierarchyLevel, list[DonorCandidate]]] = []
        for level in HierarchyLevel:
            candidates: list[DonorCandidate] = []
            seen_lineages: set[str] = set()
            for assertion in assertions:
                if assertion.field_name != field or not _native_observed(assertion):
                    continue
                scope = _scope_kind(assertion)
                donor_context = self._donor_context(
                    assertion, programme_map, unit_map, institution_map
                )
                if level == HierarchyLevel.PARENT_ORGANISATION:
                    if scope != "parent" or assertion.entity_id not in parent_ids:
                        continue
                    distance = parent_ids[assertion.entity_id]
                    if target.institution_id and donor_context.institution_id != target.institution_id:
                        rejected.append(
                            {
                                "assertion_id": assertion.assertion_id,
                                "reason": "PARENT_INSTITUTION_MISMATCH",
                            }
                        )
                        continue
                elif level == HierarchyLevel.INSTITUTION:
                    if (
                        scope != "institution"
                        or not target.institution_id
                        or donor_context.institution_id != target.institution_id
                    ):
                        continue
                    distance = _DISTANCE_BY_LEVEL[level]
                elif level == HierarchyLevel.SIBLING_PROGRAMME:
                    if (
                        scope != "programme"
                        or assertion.entity_id == target_id
                        or donor_context.institution_id != target.institution_id
                    ):
                        continue
                    distance = _DISTANCE_BY_LEVEL[level]
                else:
                    if (
                        scope not in {"institution", "programme"}
                        or not target.institution_id
                        or not donor_context.institution_id
                        or donor_context.institution_id == target.institution_id
                    ):
                        continue
                    distance = _DISTANCE_BY_LEVEL[level]
                    if not self._peer_attributes_verified(target, donor_context):
                        rejected.append(
                            {
                                "assertion_id": assertion.assertion_id,
                                "reason": "PEER_ATTRIBUTES_UNVERIFIED",
                            }
                        )
                        continue
                compatible, reason, cycle_status, applicability_status = self._compatible(
                    field=field,
                    level=level,
                    target=target,
                    donor=donor_context,
                    assertion=assertion,
                    target_cycle=target_cycle,
                    audience=audience,
                )
                if not compatible:
                    rejected.append(
                        {
                            "assertion_id": assertion.assertion_id,
                            "reason": reason,
                            "level": level.value,
                        }
                    )
                    continue
                lineage = _lineage_id(assertion, policy_lineage_ids)
                if lineage in target_lineages:
                    rejected.append(
                        {
                            "assertion_id": assertion.assertion_id,
                            "reason": "TARGET_DONOR_LINEAGE_DEPENDENT",
                        }
                    )
                    continue
                if lineage in seen_lineages:
                    rejected.append(
                        {
                            "assertion_id": assertion.assertion_id,
                            "reason": "DUPLICATE_POLICY_LINEAGE",
                        }
                    )
                    continue
                seen_lineages.add(lineage)
                candidates.append(
                    DonorCandidate(
                        assertion=assertion,
                        level=level,
                        hierarchy_distance=distance,
                        donor_context=donor_context,
                        policy_lineage_id=lineage,
                        similarity_signals=_similarity(
                            level,
                            target,
                            donor_context,
                            audience=audience,
                            cycle=target_cycle,
                        ),
                        cycle_compatibility=cycle_status,
                        applicability_compatibility=applicability_status,
                    )
                )
            candidates.sort(key=lambda item: (-item.weight, item.assertion.assertion_id))
            levels.append((level, candidates))
        return levels

    @staticmethod
    def _donor_context(
        assertion: FieldAssertion,
        programme_map: Mapping[str, EntityContext],
        unit_map: Mapping[str, EntityContext],
        institution_map: Mapping[str, EntityContext],
    ) -> EntityContext:
        if assertion.entity_id in programme_map:
            base = programme_map[assertion.entity_id]
        elif assertion.entity_id in unit_map:
            base = unit_map[assertion.entity_id]
        elif assertion.entity_id in institution_map:
            base = institution_map[assertion.entity_id]
        else:
            base = EntityContext(entity_id=assertion.entity_id)
        return base.with_defaults(
            degree_level=_attribute(assertion, "degree_level"),
            audience=_attribute(assertion, "audience"),
            academic_cycle=_attribute(assertion, "academic_cycle"),
            currency=_attribute(assertion, "currency"),
            unit_basis=_attribute(assertion, "unit_basis"),
            campus=_attribute(assertion, "campus"),
            delivery_mode=_attribute(assertion, "delivery_mode"),
        )

    @staticmethod
    def _peer_attributes_verified(target: EntityContext, donor: EntityContext) -> bool:
        required = {"country", "institution_type", "field_domain", "degree_level"}
        return required.issubset(target.verified_attributes) and required.issubset(
            donor.verified_attributes
        )

    @staticmethod
    def _compatible(
        *,
        field: str,
        level: HierarchyLevel,
        target: EntityContext,
        donor: EntityContext,
        assertion: FieldAssertion,
        target_cycle: str | None,
        audience: str | None,
    ) -> tuple[bool, str, str, str]:
        strict = field in _STRICT_FIELDS
        institution_context = (
            level == HierarchyLevel.INSTITUTION
            and field in _INSTITUTION_CONTEXT_FIELDS
            and _scope_kind(assertion) == "institution"
        )
        target_degree, donor_degree = _degree_token(target.degree_level), _degree_token(donor.degree_level)
        if target_degree and donor_degree and target_degree != donor_degree:
            return False, "DEGREE_MISMATCH", "MISMATCH", "UNKNOWN"
        if strict and target_degree and not donor_degree and not institution_context:
            return False, "DEGREE_UNKNOWN", "UNKNOWN", "UNKNOWN"
        target_audience, donor_audience = target.audience or audience, donor.audience
        if not _audience_match(target_audience, donor_audience):
            return False, "AUDIENCE_MISMATCH", "MISMATCH", "UNKNOWN"
        if strict and target_audience and not donor_audience:
            return False, "AUDIENCE_UNKNOWN", "UNKNOWN", "UNKNOWN"
        target_cycle_value = target_cycle or target.academic_cycle
        donor_cycle = donor.academic_cycle or _attribute(assertion, "academic_cycle")
        if not _cycle_match(target_cycle_value, donor_cycle):
            return False, "CYCLE_MISMATCH", "MISMATCH", "UNKNOWN"
        if strict and target_cycle_value and not donor_cycle and not institution_context:
            return False, "CYCLE_UNKNOWN", "UNKNOWN", "UNKNOWN"
        cycle_status = "MATCH" if target_cycle_value and donor_cycle else "UNKNOWN"
        target_currency = _token(target.currency)
        donor_currency = _token(donor.currency or _attribute(assertion, "currency"))
        if target_currency and donor_currency and target_currency != donor_currency:
            return False, "CURRENCY_MISMATCH", cycle_status, "UNKNOWN"
        if strict and target_currency and not donor_currency:
            return False, "CURRENCY_UNKNOWN", cycle_status, "UNKNOWN"
        target_basis, donor_basis = _token(target.unit_basis), _token(
            donor.unit_basis or _attribute(assertion, "unit_basis")
        )
        if target_basis and donor_basis and target_basis != donor_basis:
            return False, "UNIT_BASIS_MISMATCH", cycle_status, "UNKNOWN"
        if strict and target_basis and not donor_basis:
            return False, "UNIT_BASIS_UNKNOWN", cycle_status, "UNKNOWN"
        for name, left, right in (
            ("campus", target.campus, donor.campus),
            ("delivery_mode", target.delivery_mode, donor.delivery_mode),
        ):
            if left and right and _token(left) != _token(right):
                return False, f"{name.upper()}_MISMATCH", cycle_status, "UNKNOWN"
        temporal_state = _enum_value(assertion.temporal_state)
        if temporal_state == TemporalState.TARGET_CYCLE_ESTIMATE.value:
            return False, "DONOR_IS_INFERRED_ESTIMATE", cycle_status, "UNKNOWN"
        if (
            temporal_state == TemporalState.FUTURE.value
            and target_cycle_value
            and donor_cycle
            and _years(donor_cycle)
            and _years(target_cycle_value)
            and min(_years(donor_cycle)) > min(_years(target_cycle_value))
        ):
            return False, "TEMPORAL_FUTURE_MISMATCH", cycle_status, "UNKNOWN"
        authority = _enum_value(assertion.source_authority)
        if not authority or authority == SourceAuthority.OTHER.value:
            return False, "SOURCE_AUTHORITY_UNKNOWN", cycle_status, "UNKNOWN"
        relationship = _enum_value(assertion.source_relationship)
        if relationship not in _ELIGIBLE_RELATIONSHIPS:
            return False, "SOURCE_RELATIONSHIP_UNSAFE", cycle_status, "UNKNOWN"
        applicability = _enum_value(assertion.applicability_state)
        if applicability == ApplicabilityState.NOT_APPLICABLE.value:
            return False, "NOT_APPLICABLE", cycle_status, "NOT_APPLICABLE"
        if applicability == ApplicabilityState.CONDITIONAL.value and not (
            assertion.applicability_source_url and assertion.applicability_evidence
        ):
            return False, "CONDITIONAL_APPLICABILITY_UNPROVEN", cycle_status, "CONDITIONAL"
        if (
            strict
            and level in {HierarchyLevel.PARENT_ORGANISATION, HierarchyLevel.INSTITUTION}
            and applicability == ApplicabilityState.UNKNOWN.value
            and not institution_context
            and not (assertion.applicability_source_url and assertion.applicability_evidence)
        ):
            return False, "APPLICABILITY_UNKNOWN", cycle_status, "UNKNOWN"
        applicability_status = (
            "EXPLICIT"
            if applicability in {ApplicabilityState.APPLICABLE.value, ApplicabilityState.UNIVERSAL.value}
            or assertion.applicability_evidence
            else "UNKNOWN"
        )
        return True, "", cycle_status, applicability_status

    def _build_record(
        self,
        *,
        field: str,
        target_id: str,
        target_cycle: str,
        candidates: list[DonorCandidate],
        output_scope: str | None = None,
        output_scope_entity_id: str | None = None,
        output_academic_cycle: str | None = None,
    ) -> HierarchicalInferenceDecision:
        numeric = [_numeric_value(item.assertion.value_json) for item in candidates]
        all_numeric = all(value is not None for value in numeric)
        unique_values = {_value_key(item.assertion.value_json) for item in candidates}
        conflict = len(unique_values) > 1
        if conflict and not all_numeric:
            return HierarchicalInferenceDecision(
                None,
                candidates[0].level,
                "INCOMPATIBLE_NON_NUMERIC_DONOR_CONFLICT",
                tuple(candidates),
            )
        values = [value[0] for value in numeric if value is not None]
        weights = [item.weight for item in candidates]
        dispersion = 0.0
        if all_numeric and values:
            centre = float(median(values))
            deviations = [abs(value - centre) for value in values]
            dispersion = min(
                1.0,
                (float(median(deviations)) / max(abs(centre), 1.0))
                if centre
                else (1.0 if any(deviations) else 0.0),
            )
            predicted = self._weighted_median_value(candidates, values, weights)
        else:
            predicted = candidates[0].assertion.value_json
        similarity: dict[str, float] = {}
        for key in {key for item in candidates for key in item.similarity_signals}:
            similarity[key] = round(
                sum(item.similarity_signals.get(key, 0.0) * item.weight for item in candidates)
                / sum(weights),
                4,
            )
        cycle_distance = [
            _cycle_distance(target_cycle, item.donor_context.academic_cycle)
            for item in candidates
        ]
        cycle_unknown = any(item is None for item in cycle_distance)
        source_uncertainty = min(
            1.0,
            sum((1.0 - item.authority_score) * item.weight for item in candidates)
            / sum(weights),
        )
        temporal_uncertainty = min(
            1.0,
            0.35
            if cycle_unknown
            else (
                0.2
                if any(
                    _enum_value(item.assertion.temporal_state)
                    == TemporalState.HISTORICAL.value
                    for item in candidates
                )
                else 0.2 * max(cycle_distance or [0])
            ),
        )
        scope_uncertainty = min(
            1.0,
            sum(
                (0.0 if item.applicability_compatibility == "EXPLICIT" else 0.5)
                * item.weight
                for item in candidates
            )
            / sum(weights),
        )
        distance = candidates[0].hierarchy_distance
        distance_uncertainty = min(1.0, distance / 4.0)
        similarity_uncertainty = min(
            1.0, 1.0 - (sum(similarity.values()) / len(similarity) if similarity else 0.0)
        )
        support_uncertainty = max(0.0, 1.0 - min(1.0, len(candidates) / 3.0))
        conflict_uncertainty = 1.0 if conflict else 0.0
        components = UncertaintyComponents(
            source_uncertainty=round(source_uncertainty, 4),
            temporal_uncertainty=round(temporal_uncertainty, 4),
            scope_applicability_uncertainty=round(scope_uncertainty, 4),
            hierarchy_distance_uncertainty=round(distance_uncertainty, 4),
            donor_similarity_uncertainty=round(similarity_uncertainty, 4),
            donor_dispersion_uncertainty=round(
                dispersion if all_numeric else (1.0 if conflict else 0.0), 4
            ),
            support_count_uncertainty=round(support_uncertainty, 4),
            cross_source_conflict_uncertainty=round(conflict_uncertainty, 4),
            combined=0.0,
            category="INSUFFICIENT",
        )
        combined = sum(
            (
                components.source_uncertainty * _UNCERTAINTY_WEIGHTS["source"],
                components.temporal_uncertainty * _UNCERTAINTY_WEIGHTS["temporal"],
                components.scope_applicability_uncertainty * _UNCERTAINTY_WEIGHTS["scope"],
                components.hierarchy_distance_uncertainty * _UNCERTAINTY_WEIGHTS["distance"],
                components.donor_similarity_uncertainty * _UNCERTAINTY_WEIGHTS["similarity"],
                components.donor_dispersion_uncertainty * _UNCERTAINTY_WEIGHTS["dispersion"],
                components.support_count_uncertainty * _UNCERTAINTY_WEIGHTS["support"],
                components.cross_source_conflict_uncertainty * _UNCERTAINTY_WEIGHTS["conflict"],
            )
        )
        category = (
            "LOW"
            if combined <= 0.25
            else "MEDIUM"
            if combined <= 0.5
            else "HIGH"
            if combined <= 0.75
            else "INSUFFICIENT"
        )
        reasons = []
        for name, value in (
            ("source", source_uncertainty),
            ("temporal", temporal_uncertainty),
            ("scope/applicability", scope_uncertainty),
            ("hierarchy distance", distance_uncertainty),
            ("donor similarity", similarity_uncertainty),
            ("donor dispersion", dispersion),
            ("support count", support_uncertainty),
            ("cross-source conflict", conflict_uncertainty),
        ):
            if value >= 0.5:
                reasons.append(name)
        components = UncertaintyComponents(
            **{
                **components.__dict__,
                "combined": round(min(1.0, combined), 4),
                "category": category,
                "reasons": tuple(reasons),
            }
        )
        level = candidates[0].level
        record = InferenceRecord(
            inference_id=stable_id(
                "hierarchical-inference",
                target_id,
                field,
                target_cycle,
                level.value,
                self.method_version,
            ),
            entity_type="programme",
            entity_id=target_id,
            field=field,
            target_cycle=target_cycle,
            predicted_value=predicted,
            supporting_assertion_ids=tuple(item.assertion.assertion_id for item in candidates),
            supporting_raw_document_ids=tuple(
                item.assertion.raw_document_id
                for item in candidates
                if item.assertion.raw_document_id
            ),
            method="hierarchical_donor",
            method_version=self.method_version,
            confidence=round(max(0.0, min(0.99, 1.0 - components.combined)), 4),
            volatility=self.registry.get(field).volatility,
            horizon=max(
                (_cycle_distance(target_cycle, item.donor_context.academic_cycle) or 0)
                for item in candidates
            ),
            allowed_exposure="ADVISORY",
            inference_level=level.value,
            donor_assertion_ids=tuple(item.assertion.assertion_id for item in candidates),
            donor_entity_ids=tuple(item.assertion.entity_id for item in candidates),
            donor_policy_lineage_ids=tuple(item.policy_lineage_id for item in candidates),
            donor_source_urls=tuple(
                item.assertion.source_url
                for item in candidates
                if item.assertion.source_url
            ),
            hierarchy_distance=distance,
            donor_similarity_signals=similarity,
            support_count=len(candidates),
            donor_dispersion=round(dispersion, 6) if all_numeric else None,
            uncertainty_components=components.to_dict(),
            uncertainty_category=category,
            uncertainty_reasons=tuple(reasons),
            cycle_compatibility="MATCH" if not cycle_unknown else "UNKNOWN",
            applicability_compatibility=(
                "EXPLICIT"
                if all(item.applicability_compatibility == "EXPLICIT" for item in candidates)
                else "UNKNOWN"
            ),
            conflict_state="CONFLICTING_DONORS" if conflict else "NO_CONFLICT",
            output_scope=output_scope,
            output_scope_entity_id=output_scope_entity_id,
            output_academic_cycle=output_academic_cycle,
        )
        return HierarchicalInferenceDecision(
            record, level, "HIERARCHICAL_DONOR_SELECTED", tuple(candidates)
        )

    @staticmethod
    def _institution_output_cycle(candidates: list[DonorCandidate]) -> str:
        """Preserve a shared source-native cycle, or explicitly keep it unknown."""

        cycles = [
            item.donor_context.academic_cycle or _attribute(item.assertion, "academic_cycle") or ""
            for item in candidates
        ]
        if cycles and len(set(cycles)) == 1:
            return str(cycles[0])
        return ""

    def evaluate_population(
        self,
        targets: Iterable[Any],
        *,
        field: str,
        assertions_by_target: Mapping[str, Iterable[FieldAssertion]] | None = None,
        assertions: Iterable[FieldAssertion] = (),
        programmes: Iterable[Any] | Mapping[str, Any] = (),
        organisation_units: Iterable[Any] | Mapping[str, Any] = (),
        programme_organisation_units: Iterable[Any] = (),
        institutions: Iterable[Any] | Mapping[str, Any] = (),
        recovery_exhausted: bool = True,
        context: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Evaluate a frozen target population without tuning on truth.

        This is an offline observability helper. It reports activation and
        abstention by ladder level; callers must supply held-out truth
        separately before calculating accuracy or calibration metrics.
        """

        shared = tuple(assertions)
        programme_catalogue = (
            programmes if isinstance(programmes, Mapping) else tuple(programmes)
        )
        unit_catalogue = (
            organisation_units
            if isinstance(organisation_units, Mapping)
            else tuple(organisation_units)
        )
        institution_catalogue = (
            institutions if isinstance(institutions, Mapping) else tuple(institutions)
        )
        relations = tuple(programme_organisation_units)
        decisions: list[HierarchicalInferenceDecision] = []
        for target in targets:
            target_id = str(
                _get(target, "programme_id", _get(target, "entity_id", _get(target, "id", "")))
                or ""
            )
            target_specific = (
                tuple(assertions_by_target.get(target_id, ()))
                if assertions_by_target is not None
                else ()
            )
            # ``assertions`` is the shared donor pool.  A target-specific map
            # may add direct/target-scope rows, but must never hide donors from
            # the other entities in the frozen population.
            by_id: dict[str, FieldAssertion] = {}
            for item in (*shared, *target_specific):
                by_id.setdefault(item.assertion_id, item)
            target_assertions = tuple(by_id.values())
            target_context = dict(context or {})
            target_cycle = _get(target, "academic_cycle") or target_context.get("academic_cycle")
            target_audience = _get(target, "audience") or target_context.get("audience")
            decisions.append(
                self.explain(
                    field=field,
                    target_cycle=target_cycle,
                    target=target,
                    entity_id=target_id,
                    audience=target_audience,
                    assertions=target_assertions,
                    programmes=programme_catalogue,
                    organisation_units=unit_catalogue,
                    programme_organisation_units=relations,
                    institutions=institution_catalogue,
                    context=target_context,
                    recovery_exhausted=recovery_exhausted,
                )
            )
        level_counts: dict[str, int] = defaultdict(int)
        support_counts: list[int] = []
        uncertainty_by_level: dict[str, list[float]] = defaultdict(list)
        dispersions: list[float] = []
        conflicts = 0
        for decision in decisions:
            if decision.record is None:
                continue
            level_counts[decision.record.inference_level] += 1
            support_counts.append(decision.record.support_count)
            combined = decision.record.uncertainty_components.get("combined")
            if isinstance(combined, (int, float)):
                uncertainty_by_level[decision.record.inference_level].append(float(combined))
            if decision.record.donor_dispersion is not None:
                dispersions.append(float(decision.record.donor_dispersion))
            if decision.record.conflict_state != "NO_CONFLICT":
                conflicts += 1
        target_count = len(decisions)
        direct_count = sum(item.reason == "DIRECT_TARGET_AVAILABLE" for item in decisions)
        abstained = sum(item.record is None for item in decisions)
        estimate_count = target_count - abstained
        return {
            "target_count": target_count,
            "direct_coverage": direct_count / target_count if target_count else 0.0,
            "activated_by_level": dict(level_counts),
            "abstention_count": abstained,
            "abstention_rate": abstained / target_count if target_count else 0.0,
            "support_counts": support_counts,
            "mean_support_count": sum(support_counts) / len(support_counts) if support_counts else None,
            "uncertainty_by_level": {
                level: {
                    "count": len(values),
                    "mean_combined": sum(values) / len(values) if values else None,
                }
                for level, values in sorted(uncertainty_by_level.items())
            },
            "donor_dispersion": {
                "count": len(dispersions),
                "mean": sum(dispersions) / len(dispersions) if dispersions else None,
                "maximum": max(dispersions) if dispersions else None,
            },
            "conflict_rate": conflicts / estimate_count if estimate_count else 0.0,
            "decisions": [item.to_dict() for item in decisions],
            "accuracy_status": "NOT_MEASURABLE_UNLESS_HELD_OUT_TRUTH_IS_SUPPLIED",
            "calibration_status": "NOT_MEASURABLE",
        }

    @staticmethod
    def _weighted_median_value(
        candidates: list[DonorCandidate], values: list[float], weights: list[float]
    ) -> Any:
        ordered = sorted(
            zip(candidates, values, weights),
            key=lambda item: (item[1], item[0].assertion.assertion_id),
        )
        threshold = sum(weights) / 2.0
        running = 0.0
        selected = ordered[-1][0]
        selected_value = ordered[-1][1]
        for candidate, value, weight in ordered:
            running += weight
            if running >= threshold:
                selected, selected_value = candidate, value
                break
        raw = selected.assertion.value_json
        if isinstance(raw, Mapping):
            clone = copy.deepcopy(dict(raw))
            for key in ("amount", "value", "numeric_value", "tuition", "fee"):
                if key in clone and isinstance(clone[key], (int, float)):
                    clone[key] = (
                        int(selected_value)
                        if float(selected_value).is_integer()
                        else round(selected_value, 6)
                    )
                    return clone
        return (
            int(selected_value)
            if float(selected_value).is_integer()
            else round(selected_value, 6)
        )


__all__ = [
    "DonorCandidate",
    "EntityContext",
    "HierarchyLevel",
    "HierarchicalInferenceDecision",
    "HierarchicalInferenceEngine",
    "UncertaintyComponents",
]
