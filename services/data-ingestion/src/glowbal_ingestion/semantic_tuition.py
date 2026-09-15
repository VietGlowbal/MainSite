"""Evidence-bound semantic tuition extraction.

This module is an opt-in bridge between the provider-neutral extraction API and
the existing assertion/quality rails. It deliberately does not perform
inference: a model may only produce an OBSERVED assertion when a complete
tuition fact and its exact source evidence pass the local contract.

The normal pipeline keeps its historical extraction behaviour. Callers that
want the stricter tuition-only contract use SemanticTuitionExtractor
explicitly and can then pass the returned native assertions to the existing
hierarchical inference engine.
"""

from __future__ import annotations

import enum
import json
import math
import re
from dataclasses import dataclass, replace
from typing import Any, Mapping, Sequence

from .extraction_provider import (
    ExtractionProvider,
    ExtractionProviderError,
    ExtractionRequest,
    ExtractionResult,
    ExtractionSource,
)
from .models import (
    ApplicabilityState,
    EpistemicState,
    FieldAssertion,
    TemporalState,
    VerificationStatus,
    stable_id,
)
from .validation import evidence_supported, fact_to_assertion, validate_assertion_set


TUITION_SCHEMA_VERSION = "GlowBalTuitionSemanticExtraction/v1"
TUITION_PROMPT_VERSION = "tuition-semantic/v1"
TUITION_FIELD = "tuition"

_FACT_REQUIRED_KEYS = frozenset(
    {
        "field_name",
        "value",
        "source_url",
        "source_type",
        "evidence",
        "scope",
        "audience",
        "academic_cycle",
        "confidence",
    }
)
_FACT_ALLOWED_KEYS = _FACT_REQUIRED_KEYS | frozenset(
    {
        "degree_level",
        "residency",
        "campus",
        "delivery_mode",
        "applicability_state",
        "temporal_state",
        "applicability_source_url",
        "applicability_evidence",
        "programme_id",
        "institution_id",
        "organisation_unit_id",
        "department_id",
        "faculty_id",
        "school_id",
        # DeepSeek adds this internal grouping marker. It is not accepted as
        # evidence and is removed from the public assertion path.
        "_group",
    }
)
_VALUE_REQUIRED_KEYS = frozenset(
    {
        "credential",
        "amount",
        "currency",
        "fee_period",
        "audience",
        "academic_cycle",
    }
)
_VALUE_ALLOWED_KEYS = _VALUE_REQUIRED_KEYS | frozenset(
    {
        "basis",
        "unit_basis",
        "period",
        "residency",
        "campus",
        "delivery_mode",
        "degree_level",
        "programme_id",
        "institution_id",
        "organisation_unit_id",
        "department_id",
        "faculty_id",
        "school_id",
    }
)
_SCOPES = frozenset(
    {"programme", "department", "faculty", "school", "institution"}
)
_AUDIENCES = frozenset({"domestic", "international", "all"})
_FEE_PERIODS = frozenset(
    {
        "per_credit",
        "per_term",
        "per_semester",
        "per_year",
        "annual",
        "full_programme",
        "one_time",
        "once",
    }
)
_YEAR_RE = re.compile(r"\b20\d{2}\b")
_ESTIMATE_RE = re.compile(
    r"\b(?:estimate(?:d)?|approximately|approx\.?|roughly|projected|"
    r"indicative|typical(?:ly)?|around)\b",
    re.IGNORECASE,
)
_PERIOD_TERMS = {
    "per_credit": re.compile(r"\b(?:per\s+)?credit(?:s)?\b", re.I),
    "per_term": re.compile(r"\b(?:per\s+)?term\b", re.I),
    "per_semester": re.compile(r"\b(?:per\s+)?semester\b", re.I),
    "per_year": re.compile(r"\b(?:per\s+)?(?:academic\s+)?year\b", re.I),
    "annual": re.compile(r"\bannual(?:ly)?\b", re.I),
    "full_programme": re.compile(
        r"\b(?:full|entire|whole)\s+(?:program|programme|course)\b", re.I
    ),
    "one_time": re.compile(
        r"\b(?:one[-\s]?time|single)\s+(?:tuition|fee|payment)\b", re.I
    ),
    "once": re.compile(r"\bonce\b", re.I),
}
_DEGREE_TERMS = {
    "bachelor": re.compile(
        r"\b(?:undergraduate|bachelor(?:'s)?|b\.?\s?(?:a|s|sc|eng)\.?)\b",
        re.I,
    ),
    "master": re.compile(
        r"\b(?:graduate|postgraduate|master(?:'s)?|m\.?\s?(?:a|s|sc|eng)\.?)\b",
        re.I,
    ),
    "phd": re.compile(
        r"\b(?:doctoral|doctorate|ph\.?\s?d\.?)\b",
        re.I,
    ),
    # Professional programmes use their published credential (for example
    # MBA, JD, MD, or MEng) rather than an inferred academic degree title.
    "professional": re.compile(
        r"\b(?:professional|mba|m\.?\s?b\.?\s?a\.?|jd|j\.?d\.?|"
        r"md|m\.?d\.?|dpt|mph|meng|m\.?eng\.?)\b",
        re.I,
    ),
}
_AUDIENCE_TERMS = {
    "international": re.compile(
        r"\b(?:international|overseas|foreign|non[-\s]?resident)\b",
        re.I,
    ),
    "domestic": re.compile(
        r"\b(?:domestic|home|local|resident|in[-\s]?state|out[-\s]?of[-\s]?state)\b",
        re.I,
    ),
    "all": re.compile(
        r"\b(?:all\s+(?:students?|applicants?|learners?)|everyone|regardless\s+of)\b",
        re.I,
    ),
}


class TuitionExtractionStatus(str, enum.Enum):
    """Outcome states for the bounded semantic bridge."""

    SUCCESS = "SUCCESS"
    ABSTAINED = "ABSTAINED"
    SCHEMA_INVALID = "SCHEMA_INVALID"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    PROVIDER_ERROR = "PROVIDER_ERROR"


class TuitionSchemaError(ValueError):
    """A provider payload cannot be interpreted under the strict contract."""

    def __init__(self, *reasons: str) -> None:
        self.reasons = tuple(
            dict.fromkeys(str(reason) for reason in reasons if reason)
        )
        super().__init__("; ".join(self.reasons) or "invalid tuition schema")


class TuitionAbstention(ValueError):
    """The response is shaped correctly but the source cannot support a fact."""

    def __init__(self, *reasons: str) -> None:
        self.reasons = tuple(
            dict.fromkeys(str(reason) for reason in reasons if reason)
        )
        super().__init__("; ".join(self.reasons) or "tuition fact abstained")


@dataclass(frozen=True)
class TuitionExtractionOutcome:
    status: TuitionExtractionStatus
    assertions: tuple[FieldAssertion, ...] = ()
    abstentions: tuple[dict[str, Any], ...] = ()
    schema_failures: tuple[dict[str, Any], ...] = ()
    provider_id: str | None = None
    model_id: str | None = None
    request_fingerprint: str | None = None
    prompt_version: str | None = None
    schema_version: str | None = None
    warnings: tuple[str, ...] = ()
    attempted_facts: int = 0

    @property
    def valid_assertion_count(self) -> int:
        return len(self.assertions)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "assertions": [assertion.to_dict() for assertion in self.assertions],
            "abstentions": [dict(item) for item in self.abstentions],
            "schema_failures": [dict(item) for item in self.schema_failures],
            "provider_id": self.provider_id,
            "model_id": self.model_id,
            "request_fingerprint": self.request_fingerprint,
            "prompt_version": self.prompt_version,
            "schema_version": self.schema_version,
            "warnings": list(self.warnings),
            "attempted_facts": self.attempted_facts,
            "valid_assertion_count": self.valid_assertion_count,
        }


def _get(value: object, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _enum_value(value: Any, enum_type: type[Any], default: Any = None) -> Any:
    if value is None or isinstance(value, enum_type):
        return value if value is not None else default
    try:
        return enum_type(str(value))
    except (TypeError, ValueError):
        return default


def _years(value: Any) -> tuple[str, ...]:
    return tuple(dict.fromkeys(_YEAR_RE.findall(_text(value))))


def _cycle_start(value: Any) -> str | None:
    years = _years(value)
    return years[0] if years else None


def _source_for_url(
    source_map: Mapping[str, ExtractionSource],
    url: str,
) -> ExtractionSource | None:
    source = source_map.get(url)
    if source is not None:
        return source
    # Providers are instructed to copy the exact URL. A trailing slash is a
    # harmless serialization difference, but a different host/path is not.
    stripped = url.rstrip("/")
    matches = [
        candidate
        for key, candidate in source_map.items()
        if key.rstrip("/") == stripped
    ]
    return matches[0] if len(matches) == 1 else None


def _period_is_explicit(period: str, evidence: str) -> bool:
    pattern = _PERIOD_TERMS.get(period)
    return bool(pattern and pattern.search(evidence))


def _degree_is_explicit(
    degree: str | None,
    credential: str,
    evidence: str,
) -> bool:
    if not degree:
        return False
    pattern = _DEGREE_TERMS.get(degree.casefold())
    return bool(pattern and (pattern.search(credential) or pattern.search(evidence)))


def _audience_is_explicit(audience: str, evidence: str) -> bool:
    pattern = _AUDIENCE_TERMS.get(audience)
    return bool(pattern and pattern.search(evidence))


def _unsupported_inference(
    fact: Mapping[str, Any],
    value: Mapping[str, Any],
    evidence: str,
    *,
    source_text: str = "",
) -> bool:
    for key in (
        "inferred",
        "is_inferred",
        "derived",
        "is_derived",
        "estimated",
        "is_estimate",
        "calculated",
        "comparison",
        "donor",
    ):
        if fact.get(key) or value.get(key):
            return True
    if _ESTIMATE_RE.search(evidence):
        return True
    if not source_text:
        return False

    # A model can quote a contiguous substring beginning after an estimate
    # qualifier (``Approximately, MSc ...`` -> ``MSc ...``).  Inspect only a
    # bounded window around the quoted span or fee amount so an unrelated
    # estimate elsewhere on a long page cannot invalidate an explicit fee.
    source_folded = re.sub(r"\s+", " ", source_text).casefold()
    evidence_folded = re.sub(r"\s+", " ", evidence).casefold()
    starts: list[int] = []
    cursor = source_folded.find(evidence_folded)
    while cursor >= 0:
        starts.append(cursor)
        cursor = source_folded.find(evidence_folded, cursor + 1)
    if not starts:
        amount = value.get("amount")
        amount_token = re.sub(r"[^0-9]", "", _text(amount))
        if amount_token:
            amount_patterns = {amount_token}
            if amount_token.isdigit():
                amount_patterns.add(f"{int(amount_token):,}")
            starts = [
                match.start()
                for pattern in amount_patterns
                for match in re.finditer(re.escape(pattern), source_folded)
            ]
    for start in starts:
        window = source_folded[max(0, start - 180) : start + len(evidence_folded) + 180]
        if _ESTIMATE_RE.search(window):
            return True
    return False


def build_tuition_extraction_request(
    *,
    entity_id: str,
    programme: object,
    sources: Sequence[ExtractionSource],
    prompt_version: str = TUITION_PROMPT_VERSION,
    schema_version: str = TUITION_SCHEMA_VERSION,
    context: Mapping[str, Any] | None = None,
) -> ExtractionRequest:
    """Build a provider-neutral, tuition-only request carrying source content."""

    request_context: dict[str, Any] = {
        "programme": programme,
        "programme_id": _get(programme, "programme_id", entity_id),
        "programme_name": _get(programme, "programme_name"),
        "degree_level": _get(programme, "degree_level"),
        "official_url": _get(programme, "official_url"),
    }
    if context:
        request_context.update(dict(context))
    return ExtractionRequest(
        entity_id=entity_id,
        field_names=(TUITION_FIELD,),
        sources=tuple(sources),
        prompt_version=prompt_version,
        schema_version=schema_version,
        operation="fields",
        context=request_context,
        capabilities={
            "tuition_only": True,
            "strict_schema": True,
            "semantic_schema_version": schema_version,
        },
    )


def _normalise_fact(
    fact: Mapping[str, Any],
    *,
    source_map: Mapping[str, ExtractionSource],
    programme: object,
    programme_degree: str | None,
    target_cycle: str | None,
    target_audience: str | None,
    acquisition_run_id: str | None,
) -> tuple[dict[str, Any], ExtractionSource]:
    if not isinstance(fact, Mapping):
        raise TuitionSchemaError("FACT_NOT_OBJECT")
    unknown = set(fact).difference(_FACT_ALLOWED_KEYS)
    if unknown:
        raise TuitionSchemaError(
            f"UNKNOWN_FACT_KEYS:{','.join(sorted(unknown))}"
        )
    missing = _FACT_REQUIRED_KEYS.difference(fact)
    if missing:
        raise TuitionSchemaError(
            f"MISSING_FACT_KEYS:{','.join(sorted(missing))}"
        )
    if fact.get("field_name") != TUITION_FIELD:
        raise TuitionSchemaError("FIELD_OUTSIDE_TUITION_CONTRACT")
    source_url = _text(fact.get("source_url"))
    source_type = _text(fact.get("source_type"))
    evidence = _text(fact.get("evidence"))
    if not source_url:
        raise TuitionSchemaError("SOURCE_URL_MISSING")
    if not source_type:
        raise TuitionSchemaError("SOURCE_TYPE_MISSING")
    if not evidence:
        raise TuitionAbstention("EVIDENCE_MISSING")
    source = _source_for_url(source_map, source_url)
    if source is None:
        raise TuitionAbstention("SOURCE_NOT_IN_FETCH_SET")
    if not _text(source.content_hash):
        raise TuitionAbstention("SOURCE_CONTENT_HASH_MISSING")
    effective_run_id = source.acquisition_run_id or acquisition_run_id
    if not effective_run_id:
        raise TuitionAbstention("ACQUISITION_RUN_ID_MISSING")
    if not _text(source.raw_document_id):
        raise TuitionAbstention("RAW_DOCUMENT_ID_MISSING")
    if source.source_authority is None:
        raise TuitionAbstention("SOURCE_AUTHORITY_MISSING")
    if source.source_relationship is None:
        raise TuitionAbstention("SOURCE_RELATIONSHIP_MISSING")
    source_class = _text(source.source_class).casefold()
    if not source_class:
        raise TuitionAbstention("SOURCE_CLASS_MISSING")
    # External resources must identify their configured provider.  Dataset
    # identity is optional because some authoritative pages are provider
    # resources without a separately named dataset; the provider and raw
    # document still make the lineage reconstructable.
    if source_class not in {"official_web", "official_catalogue", "pdf"} and not _text(
        source.provider_id
    ):
        raise TuitionAbstention("EXTERNAL_PROVIDER_ID_MISSING")
    if (
        source.page_type in {"search", "search_result", "search_snippet"}
        or source.source_class == "search_discovery"
    ):
        raise TuitionAbstention("SEARCH_DISCOVERY_IS_NOT_FACTUAL_EVIDENCE")
    if not evidence_supported(evidence, source.text):
        raise TuitionAbstention("EVIDENCE_NOT_FOUND_IN_SOURCE")
    value = fact.get("value")
    if not isinstance(value, Mapping):
        raise TuitionAbstention("TUITION_VALUE_MISSING")
    if _unsupported_inference(
        fact,
        value,
        evidence,
        source_text=source.text,
    ):
        raise TuitionAbstention("UNSUPPORTED_INFERENCE_OR_ESTIMATE")

    confidence = fact.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        raise TuitionSchemaError("CONFIDENCE_INVALID")
    if not math.isfinite(float(confidence)) or not 0 <= float(confidence) <= 1:
        raise TuitionSchemaError("CONFIDENCE_OUT_OF_RANGE")
    scope = _text(fact.get("scope")).casefold()
    if scope not in _SCOPES:
        raise TuitionAbstention("SCOPE_UNKNOWN_OR_UNSUPPORTED")
    audience = _text(fact.get("audience")).casefold()
    if audience not in _AUDIENCES:
        raise TuitionAbstention("AUDIENCE_UNKNOWN")
    if (
        target_audience
        and audience != target_audience.casefold()
        and audience != "all"
    ):
        raise TuitionAbstention("TARGET_AUDIENCE_MISMATCH")
    if not _audience_is_explicit(audience, evidence):
        raise TuitionAbstention("AUDIENCE_NOT_IN_EVIDENCE")
    cycle = _text(fact.get("academic_cycle"))
    value_unknown = set(value).difference(_VALUE_ALLOWED_KEYS)
    if value_unknown:
        raise TuitionSchemaError(
            f"UNKNOWN_VALUE_KEYS:{','.join(sorted(value_unknown))}"
        )
    value_missing = _VALUE_REQUIRED_KEYS.difference(value)
    if value_missing:
        raise TuitionAbstention(
            f"TUITION_DIMENSIONS_MISSING:{','.join(sorted(value_missing))}"
        )
    credential = _text(value.get("credential"))
    currency = _text(value.get("currency")).upper()
    fee_period = _text(
        value.get("fee_period")
        or value.get("basis")
        or value.get("unit_basis")
    ).casefold()
    value_audience = _text(value.get("audience")).casefold()
    value_cycle = _text(value.get("academic_cycle"))
    amount = value.get("amount")
    if not credential:
        raise TuitionAbstention("TUITION_CREDENTIAL_MISSING")
    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        raise TuitionAbstention("TUITION_AMOUNT_INVALID")
    if not math.isfinite(float(amount)) or amount <= 0:
        raise TuitionAbstention("TUITION_AMOUNT_NOT_POSITIVE")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise TuitionAbstention("TUITION_CURRENCY_INVALID")
    if fee_period not in _FEE_PERIODS:
        raise TuitionAbstention("TUITION_FEE_PERIOD_UNKNOWN")
    if audience != value_audience:
        raise TuitionAbstention("AUDIENCE_FIELDS_DISAGREE")
    if not cycle or cycle != value_cycle:
        raise TuitionAbstention("ACADEMIC_CYCLE_FIELDS_DISAGREE")
    cycle_years = _years(cycle)
    if not cycle_years:
        raise TuitionAbstention("ACADEMIC_CYCLE_NOT_EXPLICIT")
    if (
        target_cycle
        and _cycle_start(target_cycle)
        and _cycle_start(cycle)
        and _cycle_start(target_cycle) != _cycle_start(cycle)
    ):
        raise TuitionAbstention("TARGET_CYCLE_MISMATCH")
    if not set(cycle_years).issubset(set(_years(evidence))):
        raise TuitionAbstention("ACADEMIC_CYCLE_NOT_IN_EVIDENCE")
    if not _period_is_explicit(fee_period, evidence):
        raise TuitionAbstention("TUITION_BASIS_NOT_IN_EVIDENCE")

    degree = _text(
        fact.get("degree_level")
        or value.get("degree_level")
        or programme_degree
    ).casefold()
    if (
        programme_degree
        and degree
        and degree != programme_degree.casefold()
    ):
        raise TuitionAbstention("DEGREE_LEVEL_MISMATCH")
    if not _degree_is_explicit(
        degree or programme_degree,
        credential,
        evidence,
    ):
        raise TuitionAbstention("DEGREE_LEVEL_NOT_IN_EVIDENCE")

    applicability_url = _text(fact.get("applicability_source_url"))
    applicability_evidence = _text(fact.get("applicability_evidence"))
    if scope != "programme":
        if not applicability_url or not applicability_evidence:
            raise TuitionAbstention("PROGRAMME_APPLICABILITY_NOT_PROVEN")
        applicability_source = _source_for_url(source_map, applicability_url)
        if applicability_source is None or not evidence_supported(
            applicability_evidence,
            applicability_source.text,
        ):
            raise TuitionAbstention("APPLICABILITY_EVIDENCE_NOT_FOUND")

    source_temporal = _enum_value(
        source.temporal_state,
        TemporalState,
        TemporalState.UNKNOWN,
    )
    if (
        source.source_class == "archive"
        and source_temporal != TemporalState.HISTORICAL
    ):
        raise TuitionAbstention("ARCHIVE_MUST_BE_HISTORICAL")
    temporal = source_temporal
    raw_temporal = fact.get("temporal_state")
    if raw_temporal is not None:
        temporal = _enum_value(raw_temporal, TemporalState)
        if temporal is None:
            raise TuitionSchemaError("TEMPORAL_STATE_INVALID")
        if source_temporal not in {TemporalState.UNKNOWN, temporal}:
            raise TuitionAbstention("TEMPORAL_STATE_DISAGREES_WITH_SOURCE")
    if temporal == TemporalState.TARGET_CYCLE_ESTIMATE:
        raise TuitionAbstention("TARGET_CYCLE_ESTIMATE_IS_NOT_OBSERVED")
    raw_applicability = fact.get("applicability_state")
    applicability = _enum_value(raw_applicability, ApplicabilityState)
    if raw_applicability is not None and applicability is None:
        raise TuitionSchemaError("APPLICABILITY_STATE_INVALID")
    if applicability is None:
        applicability = (
            ApplicabilityState.APPLICABLE
            if scope == "programme"
            else ApplicabilityState.CONDITIONAL
        )

    normalized_value = dict(value)
    normalized_value.update(
        {
            "amount": amount,
            "currency": currency,
            "credential": credential,
            "fee_period": fee_period,
            "audience": audience,
            "academic_cycle": cycle,
        }
    )
    normalized_fact: dict[str, Any] = {
        "field_name": TUITION_FIELD,
        "value": normalized_value,
        "source_url": source.url,
        "source_type": source_type,
        "evidence": evidence,
        "scope": scope,
        "audience": audience,
        "academic_cycle": cycle,
        "confidence": float(confidence),
        "degree_level": degree or programme_degree,
        "programme_id": _text(fact.get("programme_id") or value.get("programme_id")) or None,
        "institution_id": _text(fact.get("institution_id") or value.get("institution_id")) or None,
        "organisation_unit_id": _text(
            fact.get("organisation_unit_id") or value.get("organisation_unit_id")
        ) or None,
        "department_id": _text(fact.get("department_id") or value.get("department_id")) or None,
        "faculty_id": _text(fact.get("faculty_id") or value.get("faculty_id")) or None,
        "school_id": _text(fact.get("school_id") or value.get("school_id")) or None,
        "applicability_source_url": applicability_url or None,
        "applicability_evidence": applicability_evidence or None,
        "_provider_id": source.provider_id,
        "_dataset_id": source.dataset_id,
        "_acquisition_run_id": effective_run_id,
        "_source_authority": source.source_authority,
        "_source_relationship": source.source_relationship,
        "_temporal_state": temporal,
        "_applicability_state": applicability,
    }
    return normalized_fact, source


def _assertion_from_fact(
    fact: Mapping[str, Any],
    source: ExtractionSource,
    *,
    entity_id: str,
    programme: object,
    model_name: str,
    extractor_version: str,
    acquisition_run_id: str | None,
) -> FieldAssertion:
    scope = _text(fact.get("scope")).casefold()
    if scope == "programme":
        fact_programme_id = _text(fact.get("programme_id"))
        if fact_programme_id and fact_programme_id != entity_id:
            raise TuitionAbstention("PROGRAMME_DONOR_ID_MISSING_OR_MISMATCH")
        assertion_entity_id = entity_id
        assertion_entity_type = "programme"
    elif scope == "institution":
        programme_institution_id = _text(_get(programme, "institution_id"))
        fact_institution_id = _text(fact.get("institution_id"))
        assertion_entity_id = fact_institution_id or programme_institution_id
        if (
            not assertion_entity_id
            or (fact_institution_id and programme_institution_id and fact_institution_id != programme_institution_id)
        ):
            raise TuitionAbstention("INSTITUTION_DONOR_ID_MISSING_OR_MISMATCH")
        assertion_entity_type = "institution"
    elif scope in {"department", "faculty", "school"}:
        fact_unit_id = _text(
            fact.get("organisation_unit_id")
            or fact.get(f"{scope}_id")
        )
        programme_unit_id = _text(
            _get(programme, "organisation_unit_id")
            or _get(programme, f"{scope}_id")
        )
        assertion_entity_id = fact_unit_id or programme_unit_id
        if (
            not assertion_entity_id
            or (fact_unit_id and programme_unit_id and fact_unit_id != programme_unit_id)
        ):
            raise TuitionAbstention("ORGANISATION_DONOR_ID_MISSING_OR_MISMATCH")
        assertion_entity_type = "organisation_unit"
    else:
        raise TuitionAbstention("DONOR_SCOPE_UNSUPPORTED")
    programme_degree = _text(_get(programme, "degree_level")) or None
    assertion = fact_to_assertion(
        entity_id=assertion_entity_id,
        fact=dict(fact),
        source_map={source.url: source},
        model_name=model_name,
        extractor_version=extractor_version,
        programme_degree=programme_degree,
        programme_name=_get(programme, "programme_name"),
        programme_url=_get(programme, "official_url"),
    )
    assertion = validate_assertion_set([assertion])[0]
    if assertion.verification_status == VerificationStatus.REJECTED:
        raise TuitionAbstention(
            *(
                assertion.validation_errors
                or ("ASSERTION_VALIDATION_REJECTED",)
            )
        )
    return replace(
        assertion,
        assertion_id=stable_id(
            "semantic-tuition-assertion",
            assertion_entity_type,
            assertion_entity_id,
            source.url,
            str(fact.get("academic_cycle") or ""),
            json.dumps(fact.get("value") or {}, sort_keys=True, default=str),
        ),
        entity_type=assertion_entity_type,
        entity_id=assertion_entity_id,
        epistemic_state=EpistemicState.OBSERVED,
        dataset_id=source.dataset_id,
        acquisition_run_id=source.acquisition_run_id or acquisition_run_id,
        source_authority=source.source_authority,
        source_relationship=source.source_relationship,
        temporal_state=(
            _enum_value(
                fact.get("_temporal_state"),
                TemporalState,
                source.temporal_state,
            )
            or TemporalState.UNKNOWN
        ),
        applicability_state=(
            _enum_value(
                fact.get("_applicability_state"),
                ApplicabilityState,
                ApplicabilityState.UNKNOWN,
            )
            or ApplicabilityState.UNKNOWN
        ),
        degree_level=_text(fact.get("degree_level")) or programme_degree,
    )


class SemanticTuitionExtractor:
    """Run strict, tuition-only extraction against retained source content."""

    def __init__(
        self,
        provider: ExtractionProvider,
        *,
        extractor_version: str = "semantic-tuition/v1",
        prompt_version: str = TUITION_PROMPT_VERSION,
        schema_version: str = TUITION_SCHEMA_VERSION,
    ) -> None:
        self.provider = provider
        self.extractor_version = extractor_version
        self.prompt_version = prompt_version
        self.schema_version = schema_version

    def extract(
        self,
        *,
        entity_id: str,
        programme: object,
        sources: Sequence[ExtractionSource],
        target_cycle: str | None = None,
        target_audience: str | None = None,
        acquisition_run_id: str | None = None,
        context: Mapping[str, Any] | None = None,
    ) -> TuitionExtractionOutcome:
        source_list = tuple(sources)
        if not source_list:
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.ABSTAINED,
                abstentions=(
                    {"index": None, "reasons": ["NO_SOURCES"]},
                ),
            )
        if not bool(getattr(self.provider, "configured", True)):
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.PROVIDER_UNAVAILABLE,
                provider_id=str(
                    getattr(self.provider, "provider_id", "unconfigured")
                ),
                abstentions=(
                    {
                        "index": None,
                        "reasons": ["PROVIDER_UNAVAILABLE"],
                    },
                ),
            )
        request = build_tuition_extraction_request(
            entity_id=entity_id,
            programme=programme,
            sources=source_list,
            prompt_version=self.prompt_version,
            schema_version=self.schema_version,
            context={
                **(dict(context) if context else {}),
                "target_cycle": target_cycle,
                "target_audience": target_audience,
            },
        )
        try:
            result = self.provider.extract(request)
        except ExtractionProviderError as exc:
            return TuitionExtractionOutcome(
                status=(
                    TuitionExtractionStatus.PROVIDER_UNAVAILABLE
                    if exc.code.value == "PROVIDER_UNAVAILABLE"
                    else TuitionExtractionStatus.PROVIDER_ERROR
                ),
                provider_id=str(
                    getattr(self.provider, "provider_id", "unknown")
                ),
                warnings=(str(exc),),
            )
        except Exception as exc:
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.PROVIDER_ERROR,
                provider_id=str(
                    getattr(self.provider, "provider_id", "unknown")
                ),
                warnings=(f"PROVIDER_EXCEPTION:{type(exc).__name__}",),
            )
        if not isinstance(result, ExtractionResult):
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.SCHEMA_INVALID,
                schema_failures=(
                    {
                        "index": None,
                        "reasons": ["RESULT_NOT_EXTRACTION_RESULT"],
                    },
                ),
            )
        if result.identity_match is False:
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.ABSTAINED,
                provider_id=result.provider_id,
                model_id=result.model_id,
                request_fingerprint=result.request_fingerprint,
                prompt_version=result.prompt_version,
                schema_version=result.schema_version,
                abstentions=(
                    {
                        "index": None,
                        "reasons": ["PROGRAMME_IDENTITY_MISMATCH"],
                    },
                ),
                warnings=result.warnings,
            )
        source_map = {source.url: source for source in source_list}
        normalized: list[
            tuple[int, dict[str, Any], ExtractionSource]
        ] = []
        abstentions: list[dict[str, Any]] = []
        schema_failures: list[dict[str, Any]] = []
        for index, raw_fact in enumerate(result.facts):
            try:
                fact, source = _normalise_fact(
                    raw_fact,
                    source_map=source_map,
                    programme=programme,
                    programme_degree=(
                        _text(_get(programme, "degree_level")) or None
                    ),
                    target_cycle=target_cycle,
                    target_audience=target_audience,
                    acquisition_run_id=acquisition_run_id,
                )
                normalized.append((index, fact, source))
            except TuitionAbstention as exc:
                abstentions.append(
                    {"index": index, "reasons": list(exc.reasons)}
                )
            except TuitionSchemaError as exc:
                schema_failures.append(
                    {"index": index, "reasons": list(exc.reasons)}
                )
        # A malformed member invalidates the provider response as a whole. A
        # semantically unsupported member only abstains while valid siblings
        # remain usable; this mirrors the distinction between schema failure
        # and evidence insufficiency.
        if schema_failures:
            return TuitionExtractionOutcome(
                status=TuitionExtractionStatus.SCHEMA_INVALID,
                schema_failures=tuple(schema_failures),
                abstentions=tuple(abstentions),
                provider_id=result.provider_id,
                model_id=result.model_id,
                request_fingerprint=result.request_fingerprint,
                prompt_version=result.prompt_version,
                schema_version=result.schema_version,
                warnings=result.warnings,
                attempted_facts=len(result.facts),
            )
        assertions: list[FieldAssertion] = []
        for index, fact, source in normalized:
            try:
                assertions.append(
                    _assertion_from_fact(
                        fact,
                        source,
                        entity_id=entity_id,
                        programme=programme,
                        model_name=result.model_id,
                        extractor_version=self.extractor_version,
                        acquisition_run_id=acquisition_run_id,
                    )
                )
            except TuitionAbstention as exc:
                abstentions.append(
                    {"index": index, "reasons": list(exc.reasons)}
                )
        return TuitionExtractionOutcome(
            status=(
                TuitionExtractionStatus.SUCCESS
                if assertions
                else TuitionExtractionStatus.ABSTAINED
            ),
            assertions=tuple(assertions),
            abstentions=tuple(abstentions),
            provider_id=result.provider_id,
            model_id=result.model_id,
            request_fingerprint=result.request_fingerprint,
            prompt_version=result.prompt_version,
            schema_version=result.schema_version,
            warnings=result.warnings,
            attempted_facts=len(result.facts),
        )


def extract_tuition_assertions(
    *,
    provider: ExtractionProvider,
    entity_id: str,
    programme: object,
    sources: Sequence[ExtractionSource],
    **kwargs: Any,
) -> TuitionExtractionOutcome:
    """Convenience entry point for callers that do not need an engine object."""

    return SemanticTuitionExtractor(provider).extract(
        entity_id=entity_id,
        programme=programme,
        sources=sources,
        **kwargs,
    )


TuitionSemanticExtractor = SemanticTuitionExtractor


__all__ = [
    "TUITION_FIELD",
    "TUITION_PROMPT_VERSION",
    "TUITION_SCHEMA_VERSION",
    "SemanticTuitionExtractor",
    "TuitionAbstention",
    "TuitionExtractionOutcome",
    "TuitionExtractionStatus",
    "TuitionSchemaError",
    "TuitionSemanticExtractor",
    "build_tuition_extraction_request",
    "extract_tuition_assertions",
]
