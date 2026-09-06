"""Conservative runtime visibility policy for extracted field candidates.

This module answers one question only: whether an evidenced assertion is
supported enough to be visible as a runtime ``FOUND`` value.  It deliberately
does not decide Product Safety or canonical promotion.  The benchmark harness
uses this policy after extraction and validation, so candidates rejected here
remain available in the assertion artifacts for audit/review.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Mapping
from typing import Any

from .identity_granularity import identity_granularity_reasons


STRICT_FIELDS = frozenset(
    {
        # Source-native credentials are retained as evidence candidates, but
        # an undated/unknown-current credential must not become a runtime
        # fact.  This preserves the distinction between assertion creation
        # and safe factual acceptance.
        "credential",
        "programme_status",
        "tuition",
        "application_deadline",
        "english_requirement",
        "major_admissions_requirement",
    }
)

PROGRAMME_SCOPES = frozenset({"programme", "program", "offering"})
ADMISSION_COMPONENTS = frozenset(
    {
        "minimum_degree",
        "minimum_gpa",
        "subject_prerequisites",
        "standardized_tests",
        "work_experience",
        "portfolio",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
    }
)
LANGUAGE_COMPONENTS = frozenset(
    {"ielts_overall", "ielts_subscores", "toefl", "duolingo"}
)
DEADLINE_COMPONENTS = frozenset(
    {"priority_deadline", "final_deadline", "funding_deadline", "international_deadline"}
)

# A programme overview can be the authoritative requirement profile for that
# programme.  This is intentionally narrow: it is not a general exemption
# from temporal validation and it does not make an institution-wide statement
# programme-applicable.  The source must be an official, directly related
# programme page and the evidence must identify an actual qualifying profile.
PROGRAMME_PROFILE_QUALIFICATION_RE = re.compile(
    r"\bqualifying\s+(?:disciplin(?:e|es)|background|field(?:s)?|degree|"
    r"subject(?:s)?|profile)\b",
    re.IGNORECASE,
)
POST_ADMISSION_RE = re.compile(
    r"\b(?:after\s+(?:an?\s+)?offer|after\s+admission|post[-\s]?admission|"
    r"upon\s+(?:admission|enrol(?:l)?ment)|after\s+enrol(?:l)?ment|"
    r"first\s+year\s+of\s+enrol(?:l)?ment|during\s+the\s+first\s+year|"
    r"premi(?:e|è)re\s+ann(?:e|é)e\s+d['’]inscription)\b",
    re.IGNORECASE,
)


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        value = value
    else:
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    normalized = unicodedata.normalize("NFKD", str(value))
    return "".join(char for char in normalized if not unicodedata.combining(char)).casefold()


def _years(value: Any) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", _text(value))}


def _scope(assertion: Mapping[str, Any]) -> str:
    return _text(assertion.get("scope"))


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, Mapping):
        return any(_has_value(item) for item in value.values())
    if isinstance(value, (list, tuple, set, frozenset)):
        return any(_has_value(item) for item in value)
    return True


def _has_target_cycle_evidence(
    assertion: Mapping[str, Any],
    *,
    target_cycle: Any,
    evidence: str,
) -> bool:
    target_years = _years(target_cycle)
    # A model-produced value_json field is not temporal evidence by itself.
    # In particular, an LLM can populate ``academic_cycle`` while the quoted
    # source span contains only an amount.  Require the assertion's cycle
    # metadata and a matching year in the evidence locator; otherwise a
    # volatile claim must remain unresolved.
    assertion_cycle = assertion.get("academic_cycle")
    assertion_years = _years(assertion_cycle)
    evidence_years = _years(evidence)
    if not target_years or not assertion_years or not evidence_years:
        return False
    return bool(target_years & assertion_years & evidence_years)


def _audience_kinds(value: Any) -> set[str]:
    text = _text(value)
    if not text or text in {"all", "any", "unknown", "both"}:
        return set()
    kinds: set[str] = set()
    if re.search(r"\b(?:international|overseas|foreign)\b", text):
        kinds.add("international")
    if re.search(r"\b(?:domestic|home|local)\b", text):
        kinds.add("domestic")
    return kinds


def _audience_matches(value: Any, target: Any) -> bool:
    left, right = _text(value), _text(target)
    if not left or left in {"all", "any", "unknown", "both"} or not right:
        return True
    if right in {"all", "any", "unknown", "both"}:
        return True
    left_kinds, right_kinds = _audience_kinds(value), _audience_kinds(target)
    if left_kinds or right_kinds:
        # Compound target labels such as "graduate international" carry a
        # degree qualifier plus an audience qualifier.  Compare the audience
        # dimensions, not the incidental degree words.
        return not left_kinds or not right_kinds or bool(left_kinds & right_kinds)
    return left == right


def _degree_is_supported(
    assertion: Mapping[str, Any],
    *,
    target_degree: str | None,
    evidence: str,
) -> bool:
    degree = _text(target_degree)
    if not degree:
        return False
    markers = {
        "bachelor": r"\b(?:undergraduate|bachelor(?:s)?|b\.?\s*[as]\.?|a\.b\.?|s\.b\.?)\b",
        "master": r"\b(?:graduate|postgraduate|master(?:s)?|m\.?\s*(?:a|sc|s|eng)\.?)\b",
        "phd": r"\b(?:doctoral|doctorate|ph\.?\s*d\.?)\b",
    }
    pattern = markers.get(degree)
    if not pattern:
        return False
    searchable = " ".join(
        (
            evidence,
            _text(assertion.get("value_json")),
            _text(assertion.get("degree_level")),
        )
    )
    return bool(re.search(pattern, searchable, re.IGNORECASE))


def _has_current_programme_profile_context(
    assertion: Mapping[str, Any],
    *,
    field: str,
    component: str | None,
    evidence: str,
) -> bool:
    """Recognize a narrowly proven current programme requirement profile.

    ``retrieved_at`` alone is not currentness evidence.  This exception is
    limited to a directly official programme overview whose own evidence says
    that it lists qualifying disciplines/background.  It exists so a current
    programme profile is not rejected merely because the page omits a cycle
    label; it must not be generalized to institution-wide admission prose.
    """

    if field != "major_admissions_requirement" or component != "subject_prerequisites":
        return False
    if _scope(assertion) not in PROGRAMME_SCOPES:
        return False
    if _text(assertion.get("source_type")) != "programme_overview":
        return False
    if _text(assertion.get("source_authority")).upper() not in {
        "OFFICIAL",
        "GOVERNMENT",
        "OFFICIAL_PARTNER",
    }:
        return False
    if _text(assertion.get("source_relationship")).upper() not in {
        "DIRECT_OFFICIAL",
        "OFFICIAL",
    }:
        return False
    source_url = _text(assertion.get("source_url"))
    if re.search(r"/(?:archive|archives|historical|old)(?:/|$)", source_url):
        return False
    return bool(PROGRAMME_PROFILE_QUALIFICATION_RE.search(evidence))


def _applicability_is_sufficient(
    assertion: Mapping[str, Any],
    *,
    field: str,
    evidence: str,
    target_degree: str | None,
) -> tuple[bool, str | None]:
    state = _text(assertion.get("applicability_state")).upper()
    if state in {"APPLICABLE", "UNIVERSAL"}:
        return True, None
    if state == "CONDITIONAL":
        return True, None
    if state == "NOT_APPLICABLE":
        return False, "NOT_APPLICABLE"

    scope = _scope(assertion)
    applicability_evidence = _text(assertion.get("applicability_evidence"))
    if assertion.get("applicability_source_url") and applicability_evidence:
        field_terms = {
            "programme_status": r"programme|program|admission|application|open|active",
            "tuition": r"tuition|fee|undergraduate|bachelor|graduate|master|doctoral|program",
            "application_deadline": r"application|admission|deadline|due|intake|entry|term",
            "english_requirement": r"english|language|ielts|toefl|duolingo|cambridge|proficiency",
            "major_admissions_requirement": r"admission|applicant|eligible|prerequisite|major|program|programme",
        }
        if re.search(field_terms.get(field, r"."), applicability_evidence, re.IGNORECASE):
            return True, None
        return False, "APPLICABILITY_EVIDENCE_FIELD_MISMATCH"

    if scope in PROGRAMME_SCOPES:
        return True, None

    # Institution-wide tuition is visible only when the source itself proves
    # the degree band.  This preserves source-native institutional rates while
    # refusing an unscoped graduate/undergraduate amount.
    if field == "tuition" and scope == "institution":
        if _degree_is_supported(assertion, target_degree=target_degree, evidence=evidence):
            return True, None
        return False, "TUITION_DEGREE_SCOPE_UNPROVEN"

    return False, "PROGRAMME_SCOPE_UNPROVEN"


def _temporal_is_sufficient(
    assertion: Mapping[str, Any],
    *,
    field: str,
    component: str | None = None,
    target_cycle: Any,
    evidence: str,
) -> tuple[bool, str | None]:
    state = _text(assertion.get("temporal_state")).upper()
    if state == "CURRENT":
        return True, None
    if state in {"HISTORICAL", "FUTURE", "TARGET_CYCLE_ESTIMATE"}:
        return False, f"TEMPORAL_{state}"
    if field == "programme_status" and re.search(
        r"\b(?:currently|current|applications?\s+(?:are\s+)?open|accepting\s+applications?|apply\s+now)\b",
        evidence,
        re.IGNORECASE,
    ):
        return True, None
    if _has_current_programme_profile_context(
        assertion,
        field=field,
        component=component,
        evidence=evidence,
    ):
        return True, None
    if _has_target_cycle_evidence(assertion, target_cycle=target_cycle, evidence=evidence):
        return True, None
    return False, "TEMPORAL_SCOPE_UNPROVEN"


def _tuition_reasons(assertion: Mapping[str, Any], *, evidence: str) -> list[str]:
    value = assertion.get("value_json")
    if not isinstance(value, Mapping):
        return ["TUITION_NOT_STRUCTURED"]
    reasons: list[str] = []
    if value.get("amount") in (None, "") or not value.get("currency"):
        reasons.append("TUITION_AMOUNT_OR_CURRENCY_MISSING")
    forbidden = re.compile(
        r"\b(?:cost\s+of\s+attendance|estimated\s+(?:student\s+)?budget|"
        r"room\s+and\s+board|living\s+expenses?|registration\s+fee|"
        r"application\s+fee|financial\s+aid|scholarship)\b",
        re.IGNORECASE,
    )
    if forbidden.search(evidence):
        reasons.append("TUITION_FEE_SCOPE_MISMATCH")
    if not re.search(r"\b(?:tuition|fees?)\b", evidence, re.IGNORECASE):
        reasons.append("TUITION_SEMANTICS_NOT_IN_EVIDENCE")
    billing_basis = _text(
        value.get("billing_basis")
        or value.get("fee_period")
        or value.get("period")
    )
    if not billing_basis:
        reasons.append("TUITION_BILLING_BASIS_MISSING")
    fee_type = _text(value.get("fee_type") or value.get("tuition_type"))
    if fee_type and fee_type not in {
        "tuition",
        "programme_tuition",
        "annual_tuition",
        "semester_tuition",
        "per_term_tuition",
        "per_credit_tuition",
    }:
        reasons.append("TUITION_FEE_TYPE_MISMATCH")
    # A degree-matched institutional rate is not enough to select a concrete
    # benchmark tuition fact when the evidence gives only a term amount.  The
    # annual/term relationship and programme-facing fee scope must be explicit;
    # otherwise preserve the candidate for review instead of emitting a value
    # that can be compared under the wrong billing basis.
    if _scope(assertion) == "institution" and re.search(
        r"\b(?:per\s+term|per\s+semester|semester(?:ly)?)\b",
        billing_basis + " " + evidence,
        re.IGNORECASE,
    ) and not any(
        value.get(key) not in (None, "")
        for key in ("annual_amount", "annual_equivalent", "academic_year_amount")
    ):
        reasons.append("TUITION_INSTITUTION_TERM_SCOPE_UNRESOLVED")
    return reasons


def _deadline_reasons(
    assertion: Mapping[str, Any],
    *,
    component: str | None,
    evidence: str,
) -> list[str]:
    del assertion
    reasons: list[str] = []
    non_application = re.compile(
        r"\b(?:registration|enrol(?:l)?ment|document submission|financial aid|"
        r"fee payment|orientation)\s+(?:deadline|date|due)\b",
        re.IGNORECASE,
    )
    if non_application.search(evidence):
        reasons.append("DEADLINE_TYPE_MISMATCH")
    if component == "priority_deadline" and not re.search(
        r"\b(?:priority|early decision|priority deadline)\b", evidence, re.IGNORECASE
    ):
        reasons.append("PRIORITY_DEADLINE_TYPE_UNPROVEN")
    if component == "final_deadline" and not re.search(
        r"\b(?:final|regular decision|application due|application deadline|"
        r"applications?\b.{0,100}\b(?:close|end|are\s+due))\b",
        evidence,
        re.IGNORECASE,
    ):
        reasons.append("FINAL_DEADLINE_TYPE_UNPROVEN")
    return reasons


def _english_reasons(
    assertion: Mapping[str, Any],
    *,
    component: str | None,
    evidence: str,
) -> list[str]:
    value_text = _text(assertion.get("value_json"))
    language_terms = re.compile(
        r"\b(?:english|ielts|toefl|duolingo|cambridge|language\s+proficiency|"
        r"english\s+test|test\s+of\s+english)\b",
        re.IGNORECASE,
    )
    if not language_terms.search(evidence):
        return ["LANGUAGE_FIELD_SEMANTICS_MISMATCH"]
    if re.search(r"\b(?:recommended|suggested|competitive)\b", evidence, re.IGNORECASE):
        if not re.search(r"\b(?:required|must|minimum|requirement)\b", evidence, re.IGNORECASE):
            return ["RECOMMENDED_NOT_MINIMUM"]
    if "no toefl requirement" in value_text and component == "toefl":
        if not re.search(
            r"\btoefl\b|\benglish\s+(?:requirement|test|score|proficiency)\b",
            evidence,
            re.IGNORECASE,
        ):
            return ["LANGUAGE_FIELD_SEMANTICS_MISMATCH"]
    return []


def _major_admissions_reasons(
    assertion: Mapping[str, Any],
    *,
    component: str | None,
    evidence: str,
) -> list[str]:
    if component not in ADMISSION_COMPONENTS:
        return ["ADMISSIONS_COMPONENT_UNSUPPORTED"]
    value = assertion.get("value_json")
    value_text = _text(value)
    if POST_ADMISSION_RE.search(f"{evidence} {value_text}") or re.search(
        r"\b(?:curriculum|graduation|declare\s+(?:the\s+)?major|placement|"
        r"later\s+track)\b",
        evidence,
        re.IGNORECASE,
    ):
        return ["ADMISSION_STAGE_MISMATCH"]
    if isinstance(value, Mapping) and _text(value.get("application_stage")) in {
        "after_offer",
        "post_admission",
        "enrollment",
        "after_enrollment",
    }:
        return ["ADMISSION_STAGE_MISMATCH"]
    admission_language = bool(re.search(
        r"\b(?:admission|admitted|applicant|apply|eligible|eligibility|prerequisite|"
        r"must\s+(?:have|hold|complete|submit)|required\s+for)\b",
        evidence,
        re.IGNORECASE,
    ))
    if not admission_language and not (
        component == "subject_prerequisites"
        and _has_current_programme_profile_context(
            assertion,
            field="major_admissions_requirement",
            component=component,
            evidence=evidence,
        )
    ):
        return ["PROGRAMME_ADMISSION_SCOPE_UNPROVEN"]
    if component == "subject_prerequisites" and not admission_language:
        # "Qualifying disciplines" is descriptive profile material until the
        # source also establishes that it is an admission prerequisite.  A
        # programme overview alone must not turn background preparation into a
        # concrete admission gate.
        return ["PROGRAMME_ADMISSION_SCOPE_UNPROVEN"]
    return []


def projection_acceptance_reasons(
    assertion: Mapping[str, Any],
    *,
    field_name: str | None = None,
    component_field: str | None = None,
    target_cycle: Any = None,
    audience: Any = None,
    target_degree: str | None = None,
) -> tuple[str, ...]:
    """Return deterministic reasons a candidate is not runtime-visible.

    An empty tuple means the candidate may be represented as ``FOUND``.  The
    output field is used for aggregate fields such as ``tuition`` and
    ``major_admissions_requirement``; the component is retained for semantic
    validation and diagnostics.
    """

    reasons: list[str] = []
    value = assertion.get("value_json")
    effective_field = field_name or component_field
    if not _has_value(value):
        reasons.append("NO_VALUE")
        return tuple(reasons)
    if _text(assertion.get("verification_status")).upper() == "REJECTED":
        reasons.append("REJECTED_ASSERTION")
    errors = {str(item) for item in (assertion.get("validation_errors") or [])}
    if errors:
        reasons.append("VALIDATION_ERROR:" + ",".join(sorted(errors)))
    if _text(assertion.get("extraction_group")) == "source_excerpt_fallback":
        reasons.append("SOURCE_EXCERPT_ONLY")
    if _text(assertion.get("model_name")).startswith("deterministic-source-excerpt"):
        reasons.append("SOURCE_EXCERPT_ONLY")
    if _text(assertion.get("epistemic_state")).upper() == "INFERRED":
        reasons.append("INFERRED_VALUE")
    if not assertion.get("evidence"):
        reasons.append("EVIDENCE_MISSING")
    if not assertion.get("raw_document_id"):
        reasons.append("RAW_LINEAGE_MISSING")
    if not _has_target_cycle_evidence(assertion, target_cycle=target_cycle, evidence=_text(assertion.get("evidence"))):
        # This is evaluated below only for fields whose semantics are volatile;
        # the generic candidate path remains permissive for informational data.
        pass
    assertion_years = _years(assertion.get("academic_cycle"))
    target_years = _years(target_cycle)
    if assertion_years and target_years and min(assertion_years) != min(target_years):
        reasons.append("TARGET_CYCLE_MISMATCH")
    if not _audience_matches(assertion.get("audience"), audience):
        reasons.append("AUDIENCE_MISMATCH")
    if _text(assertion.get("applicability_state")).upper() == "NOT_APPLICABLE":
        reasons.append("NOT_APPLICABLE")
    if _text(assertion.get("temporal_state")).upper() in {"HISTORICAL", "FUTURE"}:
        reasons.append("NON_CURRENT_ASSERTION")

    if effective_field == "programme_identity":
        reasons.extend(
            identity_granularity_reasons(
                value=value,
                evidence=assertion.get("evidence"),
                source_text=(
                    assertion.get("_source_text")
                    or assertion.get("source_text")
                ),
                scope=assertion.get("scope"),
                source_url=assertion.get("source_url"),
            )
        )

    if effective_field in STRICT_FIELDS:
        evidence = _text(assertion.get("evidence"))
        applicable, applicability_reason = _applicability_is_sufficient(
            assertion,
            field=effective_field,
            evidence=evidence,
            target_degree=target_degree,
        )
        if not applicable and applicability_reason:
            reasons.append(applicability_reason)
        temporal, temporal_reason = _temporal_is_sufficient(
            assertion,
            field=effective_field,
            component=component_field,
            target_cycle=target_cycle,
            evidence=evidence,
        )
        if not temporal and temporal_reason:
            reasons.append(temporal_reason)
        if effective_field == "tuition":
            reasons.extend(_tuition_reasons(assertion, evidence=evidence))
        elif effective_field == "application_deadline":
            reasons.extend(
                _deadline_reasons(assertion, component=component_field, evidence=evidence)
            )
        elif effective_field == "english_requirement":
            reasons.extend(
                _english_reasons(
                    assertion,
                    component=component_field,
                    evidence=evidence,
                )
            )
        elif effective_field == "major_admissions_requirement":
            reasons.extend(
                _major_admissions_reasons(
                    assertion,
                    component=component_field,
                    evidence=evidence,
                )
            )

    return tuple(dict.fromkeys(reasons))


def can_resolve_found(
    assertion: Mapping[str, Any],
    **kwargs: Any,
) -> bool:
    """Return whether ``assertion`` may be projected as runtime ``FOUND``."""

    return not projection_acceptance_reasons(assertion, **kwargs)
