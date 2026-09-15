"""Evidence acceptance, deliberately separate from current-truth promotion.

Only review proposals are reconsidered. Missing context is not proof of a
false observation, and acceptance does not establish target applicability.
The source bindings must come from admitted acquisition, never from the LLM.
"""
from __future__ import annotations

import re
import json
from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation
from types import SimpleNamespace
from typing import Mapping, Sequence
from urllib.parse import urlsplit

from .extraction_provider import ExtractionSource
from .models import (ApplicabilityState, EpistemicState, FieldAssertion,
                     TemporalState, VerificationStatus)
from .validation import _deadline_evidence_errors, _value_errors
from .conflicts import assertions_overlap
from .models import stable_id
from .evidence_resolution import (
    binding_for_assertion,
    resolve_entity_scope,
    resolve_evidence_alignment,
    resolve_provenance,
)


OPTIONAL_ERRORS = frozenset({
    "MISSING_ACADEMIC_CYCLE", "MISSING_TUITION_ACADEMIC_CYCLE",
    "MISSING_TUITION_AUDIENCE", "MISSING_TUITION_FEE_PERIOD",
    "PROGRAMME_APPLICABILITY_NOT_PROVEN",
})
MONEY_FIELDS = {"tuition", "additional_fees", "application_fee"}
UNKNOWN = {"", "unknown", "none", "null", "unspecified"}
ACCEPTANCE_CLASSES = frozenset({
    "ACCEPT_EXACT", "ACCEPT_BROADER_SCOPE", "ACCEPT_WITH_UNKNOWN_CONTEXT",
    "ACCEPT_HISTORICAL",
})


@dataclass(frozen=True)
class SourceBinding:
    source: ExtractionSource
    institution_id: str
    official_domain: str
    organisation_unit_id: str | None = None


@dataclass(frozen=True)
class AcceptanceDecision:
    assertion: FieldAssertion
    classification: str
    reasons: tuple[str, ...]
    changes: tuple[str, ...] = ()


@dataclass(frozen=True)
class MetadataReconciliationDecision:
    assertion: FieldAssertion
    changes: tuple[str, ...]
    reasons: tuple[str, ...] = ()


def _text(value: object) -> str:
    return " ".join(re.findall(r"\w+|[$£€%]", str(value or "").casefold()))


def _contains(value: object, evidence: str) -> bool:
    needle = _text(value)
    return bool(needle) and f" {needle} " in f" {_text(evidence)} "


def _numbers(text: str) -> set[Decimal]:
    return {Decimal(m.replace(",", "")) for m in
            # A terminal full stop after a decimal is punctuation, not part of
            # another numeric token (for example, "IELTS 7.0.").
            re.findall(r"(?<![\w.])-?\d+(?:,\d{3})*(?:\.\d+)?(?!\w|\.\d)", text)}


def _number_supported(value: object, text: str) -> bool:
    try:
        return Decimal(str(value)) in _numbers(text)
    except (InvalidOperation, ValueError):
        return False


def _numeric_values(value: object) -> tuple[object, ...]:
    """Return numeric leaves from a structured admission-test value.

    Studyinfo publishes some thresholds as a scalar (for example GMAT 530)
    and others as nested section maps/lists (for example SAT reading/math).
    Traversing the declarative value shape keeps the acceptance check
    provider-neutral without treating arbitrary prose as a score.
    """
    values: list[object] = []
    if isinstance(value, Mapping):
        for child in value.values():
            values.extend(_numeric_values(child))
    elif isinstance(value, (list, tuple)):
        for child in value:
            values.extend(_numeric_values(child))
    elif isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        values.append(value)
    return tuple(values)


def _years(value: object) -> set[int]:
    return {int(y) for y in re.findall(r"20\d{2}", str(value or ""))}


def _currency_supported(currency: object, evidence: str, binding: SourceBinding) -> bool:
    code = str(currency or "").upper()
    patterns = {
        "USD": r"\bUSD\b|US\$|US dollars?",
        "SGD": r"\bSGD\b|S\$|Singapore dollars?",
        "AUD": r"\bAUD\b|A\$|Australian dollars?",
        "CAD": r"\bCAD\b|C\$|Canadian dollars?",
        "EUR": r"\bEUR\b|€|euros?", "GBP": r"\bGBP\b|£|pounds?",
        "CHF": r"\bCHF\b|Swiss francs?", "JPY": r"\bJPY\b|yen",
    }
    if code not in patterns:
        return False
    if re.search(patterns[code], evidence, re.I):
        return True
    # Bare $ is ambiguous; a country/domain is not a currency declaration.
    return False


def _unknown_currency_symbol(evidence: str) -> str | None:
    """Return a stated monetary symbol only when no ISO currency is proven."""
    if re.search(r"(?<![A-Za-z])\$(?=\s*\d)", evidence):
        return "$"
    if re.search(r"\bdollars?\b", evidence, re.I):
        return "dollars"
    return None


_CURRENCY_CODES = frozenset({"USD", "AUD", "CAD", "SGD", "EUR", "GBP", "CHF", "JPY"})


def _context_window(source: ExtractionSource, evidence: str) -> str:
    """Return a bounded same-document context around an exact source quote."""
    aligned = resolve_evidence_alignment(
        SimpleNamespace(evidence=evidence, value_json=None, field_name=None),
        source,
    )
    if aligned.matched_evidence and aligned.nearby_context:
        return aligned.nearby_context
    if evidence and aligned.status == "UNRESOLVED":
        # Do not fall back to the first textual occurrence when the generic
        # resolver found repeated/ambiguous evidence.
        return ""
    text = source.text or ""
    index = text.casefold().find(str(evidence or "").casefold())
    if index < 0:
        numbers = re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", str(evidence or ""))
        if numbers:
            index = text.replace(",", "").find(numbers[0].replace(",", ""))
    if index < 0:
        return ""
    return text[max(0, index - 900): min(len(text), index + max(len(evidence), 300))]


def _context_currency(source: ExtractionSource, evidence: str) -> str | None:
    """Find an explicit document/table currency, never derive it from locale."""
    context = _context_window(source, evidence)
    title = " ".join((source.title or "", source.url or ""))
    candidates: set[str] = set()
    for text in (context, title):
        for match in re.finditer(
            r"(?:direct\s+costs?|education\s+expenses|tuition|fees?|amounts?|costs?)"
            r"[^\n()]{0,100}\(\s*(USD|AUD|CAD|SGD|EUR|GBP|CHF|JPY)\s*\)",
            text,
            re.I,
        ):
            candidates.add(match.group(1).upper())
        for match in re.finditer(
            r"(?:all\s+)?(?:fees?|amounts?|costs?)\s+(?:are|in|shown\s+in|listed\s+in)\s*"
            r"(USD|AUD|CAD|SGD|EUR|GBP|CHF|JPY)\b",
            text,
            re.I,
        ):
            candidates.add(match.group(1).upper())
    return next(iter(candidates)) if len(candidates) == 1 else None


def _context_cycle(source: ExtractionSource, evidence: str) -> str | None:
    context = _context_window(source, evidence)
    from .evidence_resolution import _explicit_cycle

    return _explicit_cycle(context)


def _context_basis(source: ExtractionSource, evidence: str) -> str | None:
    context = _context_window(source, evidence)
    if re.search(r"\bacademic\s+year\b", context, re.I):
        return "per year"
    if re.search(r"\bper\s+term\b", context, re.I):
        return "per term"
    if re.search(r"\bper\s+semester\b", context, re.I):
        return "per semester"
    if re.search(r"\bper\s+(?:credit|unit)\b", context, re.I):
        return "per credit"
    return None


def _reconcile_value_context(
    assertion: FieldAssertion,
    source: ExtractionSource,
) -> tuple[FieldAssertion, list[str]]:
    """Attach only context explicitly stated by the already bound source."""
    value = assertion.value_json
    if not isinstance(value, dict):
        return assertion, []
    result = dict(value)
    changes: list[str] = []
    explicit_currency = _context_currency(source, assertion.evidence or "")
    if explicit_currency:
        if result.get("currency") != explicit_currency:
            result["currency"] = explicit_currency
            result.pop("currency_symbol", None)
            changes.append("CURRENCY_FROM_SOURCE_CONTEXT")
        elif not _currency_supported(result.get("currency"), assertion.evidence or "", None):
            changes.append("CURRENCY_VERIFIED_FROM_SOURCE_CONTEXT")
    period = str(result.get("fee_period") or "").casefold()
    window = _context_window(source, assertion.evidence or "")
    if period == "academic_year" and re.search(r"\bacademic\s+year\b", window, re.I):
        result["fee_period"] = "per year"
        result["fee_period_raw"] = "academic year"
        changes.append("BASIS_FROM_SOURCE_CONTEXT")
    cycle = assertion.academic_cycle or result.get("academic_cycle")
    canonical_cycle = _context_cycle(source, assertion.evidence or "")
    if canonical_cycle and (not cycle or _years(cycle) == _years(canonical_cycle)) and cycle != canonical_cycle:
        result["academic_cycle"] = canonical_cycle
        changes.append("CYCLE_FROM_SOURCE_CONTEXT")
        return replace(assertion, value_json=result, academic_cycle=canonical_cycle), changes
    return replace(assertion, value_json=result), changes


def reconcile_assertion_metadata(
    assertions: Sequence[FieldAssertion], *,
    bindings: Mapping[str, SourceBinding],
    programmes: Mapping[str, Mapping[str, object]] | None = None,
    organisation_units: Sequence[object] = (),
) -> list[MetadataReconciliationDecision]:
    """Reconcile explicit same-source metadata before semantic acceptance.

    This is a narrow, deterministic enrichment pass.  It only uses the exact
    admitted source bound to an assertion.  Context, evidence-span alignment,
    and missing provenance are propagated from that source; no new fact or
    target applicability is created here.
    """
    decisions: list[MetadataReconciliationDecision] = []
    for original in assertions:
        if original.verification_status == VerificationStatus.REJECTED:
            decisions.append(MetadataReconciliationDecision(original, ()))
            continue
        binding = binding_for_assertion(original, bindings)
        source = binding.source if binding else None
        if not source:
            decisions.append(MetadataReconciliationDecision(original, (), ("SOURCE_BINDING_UNAVAILABLE",)))
            continue
        alignment = resolve_evidence_alignment(original, source)
        provenance = resolve_provenance(original, source, alignment=alignment)
        if provenance.status == "MISMATCH":
            decisions.append(MetadataReconciliationDecision(
                original, provenance.changes, provenance.reasons,
            ))
            continue
        assertion = provenance.assertion
        changes = list(provenance.changes)
        assertion, context_changes = _reconcile_value_context(assertion, source)
        changes.extend(context_changes)
        decisions.append(MetadataReconciliationDecision(
            assertion, tuple(dict.fromkeys(changes)), provenance.reasons,
        ))
    return decisions


def _period_supported(period: object, evidence: str) -> bool:
    p = str(period or "").casefold()
    if p in UNKNOWN:
        return True
    equivalents = {
        "per term": r"per term", "per semester": r"per semester",
        "per credit": r"per credit", "per unit": r"per unit",
        # Preserve source-native annual wording in structured non-English
        # datasets.  These are basis synonyms only; they do not create a
        # cycle or convert a total/course amount into an annual value.
        "annual": r"annual|per year|\byear\b|par an|par année|à l'année|annuel(?:le)?",
        "per year": r"annual|per year|\byear\b|par an|par année|à l'année|annuel(?:le)?",
        "year": r"annual|per year|\byear\b|par an|par année|à l'année|annuel(?:le)?",
        "total": r"total|full programme|full program", "monthly": r"monthly|per month",
        "once": r"one.time|once|one.off", "full_programme": r"total|full programme|full program",
    }
    return _contains(period, evidence) or bool(
        p in equivalents and re.search(equivalents[p], evidence, re.I))


def _supported_projection(a: FieldAssertion) -> tuple[FieldAssertion, list[str]]:
    """Preserve explicit funding details without inventing optional labels.

    Unsupported core details/amounts are never replaced. Unknown eligibility
    is not universal eligibility; applicability remains UNKNOWN.
    """
    if a.field_name in MONEY_FIELDS and isinstance(a.value_json, dict):
        v = dict(a.value_json)
        changes: list[str] = []
        currency = v.get("currency")
        if currency and not _currency_supported(currency, a.evidence or "", None):
            symbol = _unknown_currency_symbol(a.evidence or "")
            if symbol:
                v["currency"] = None
                v["currency_symbol"] = symbol
                changes.append("CURRENCY_UNKNOWN")
        period = v.get("fee_period")
        raw_only_periods = {"program", "programme", "course"}
        if period and (str(period).casefold() in raw_only_periods or not _period_supported(period, a.evidence or "")):
            if _contains(period, a.evidence or ""):
                v["fee_period"] = None
                v["fee_period_raw"] = period
                changes.append("FEE_PERIOD_UNKNOWN")
        return replace(a, value_json=v), changes
    if a.field_name != "scholarships" or not isinstance(a.value_json, dict):
        return a, []
    v = dict(a.value_json)
    changes = []
    evidence = a.evidence or ""
    for key in ("award_name", "eligibility"):
        if v.get(key) and not _contains(v[key], evidence):
            v[key] = None
            changes.append(key.upper() + "_UNKNOWN")
    if v.get("details") and not _contains(v["details"], evidence):
        v["details"] = None
        changes.append("DETAILS_UNKNOWN")
    for key in ("automatic_consideration", "separate_application_required", "repayable"):
        if v.get(key) is not None:
            v[key] = None
            changes.append(key.upper() + "_UNKNOWN")
    category = str(v.get("funding_type") or "unknown")
    patterns = {
        "loan": r"loan", "fellowship": r"fellowship", "assistantship": r"assistant",
        "grant": r"grant|rebate", "merit_scholarship": r"merit.*scholarship|scholarship.*merit",
        "external_scholarship": r"external.*(?:scholarship|fellowship)",
        "financial_aid_policy": r"financial (?:aid|support)|subsidy|financial need",
        "institutional_need_based_grant": r"need.based.*grant|grant.*need",
    }
    if category not in UNKNOWN and not re.search(patterns.get(category, r"(?!)"), evidence, re.I):
        v["funding_type"] = "unknown"
        changes.append("FUNDING_TYPE_UNKNOWN")
    return replace(a, value_json=v), changes


_EMPLOYMENT_METRIC_PATTERNS: dict[str, str] = {
    # Discover Uni publishes these labels as chart/card values.  The mapping
    # only recognises the source's explicit wording; it does not derive a
    # percentage or occupation from a generic employment sentence.
    "work_and_or_study": r"work\s+and\s*/?\s*or\s+study",
    "go_on_to_work_and_or_study": r"work\s+and\s*/?\s*or\s+study",
    "in_highly_skilled_work": r"highly\s+skilled\s+work",
    "in_other_work": r"other\s+work",
    "in_unknown_work": r"unknown\s+work",
    # Discover Uni's occupation cards use ``metric=occupation`` while the
    # asserted span contains the occupation label itself (for example
    # ``90% Information Technology Professionals``).  The surrounding
    # source section supplies the explicit ``Occupation types`` label; this
    # pattern keeps that source wording required without treating the bare
    # metric token as a factual value.
    "occupation": r"occupation(?:\s+types?)?",
}


def _employment_outcome_errors(
    value: object,
    evidence: str,
    binding: SourceBinding,
) -> str | None:
    """Validate a structured employment observation against one source span.

    Employment cards are structured dictionaries rather than literal string
    values.  Previously they fell through to ``VALUE_SUPPORT_UNRESOLVED``
    even when the percentage and labelled category were copied verbatim from
    the admitted source.  Numeric values must occur in the asserted span;
    period/population context may be established only by the bounded context
    around that exact span.
    """
    if not isinstance(value, dict):
        return "UNSUPPORTED_VALUE_FORMAT"
    percentage = value.get("percentage")
    if percentage is not None:
        if isinstance(percentage, bool) or not isinstance(percentage, (int, float)):
            return "PERCENTAGE_INVALID"
        if percentage < 0 or percentage > 100:
            return "PERCENTAGE_OUT_OF_RANGE"
        if not _number_supported(percentage, evidence):
            return "VALUE_NOT_SUPPORTED"

    metric = str(value.get("metric") or "").strip().casefold()
    occupation = value.get("occupation")
    support_text = evidence
    context = _context_window(binding.source, evidence)
    if context:
        support_text = f"{evidence} {context}"
    # The Discover Uni extractor may return the chart/card as a compact
    # outcome object (``outcome``, ``timeframe``, ``cohort`` and survey
    # provenance) instead of the lower-level metric/percentage shape.  Treat
    # the labelled outcome as the claim and require every supplied context
    # detail to occur in the same asserted span or its bounded source window.
    outcome = value.get("outcome")
    if outcome:
        if not _contains(outcome, evidence):
            return "VALUE_NOT_SUPPORTED"
        for key in ("timeframe", "cohort", "data_source", "data_from"):
            detail = value.get(key)
            if detail and not _contains(detail, support_text):
                return f"{key.upper()}_NOT_SUPPORTED"
    metric_pattern = _EMPLOYMENT_METRIC_PATTERNS.get(metric)
    if metric_pattern:
        if not re.search(metric_pattern, support_text, re.I):
            return "METRIC_NOT_SUPPORTED"
    elif metric and not _contains(metric.replace("_", " "), support_text):
        return "METRIC_NOT_SUPPORTED"

    if occupation and not _contains(occupation, evidence):
        return "VALUE_NOT_SUPPORTED"
    statement = value.get("statement")
    if statement and not _contains(statement, evidence):
        return "VALUE_NOT_SUPPORTED"
    for key in ("period", "population"):
        detail = value.get(key)
        if detail and not _contains(detail, support_text):
            return f"{key.upper()}_NOT_SUPPORTED"
    # A structured observation still needs at least a source-labelled metric
    # or an explicit numeric value; an empty object must not be accepted.
    if (
        not outcome
        and not metric
        and percentage is None
        and not occupation
        and not statement
    ):
        return "EMPLOYMENT_FACT_MISSING"
    return None


def _claim_supported(
    a: FieldAssertion,
    evidence: str,
    binding: SourceBinding,
    alignment=None,
) -> str | None:
    value, field = a.value_json, a.field_name
    if field in MONEY_FIELDS | {"minimum_degree", "minimum_gpa", "ielts_overall", "ielts_subscores", "toefl", "duolingo"}:
        if re.search(r"\bnot required\b|\bno longer\b|\bnot (?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY|\$)|\bwaived\b", evidence, re.I):
            return "NEGATED_OR_CONDITIONAL_FACT"
    if field in MONEY_FIELDS:
        if not isinstance(value, dict) or not _number_supported(value.get("amount"), evidence):
            return "VALUE_NOT_SUPPORTED"
        if value.get("currency") and not _currency_supported(value.get("currency"), evidence, binding) and _context_currency(binding.source, evidence) != value.get("currency"):
            return "CURRENCY_NOT_ESTABLISHED"
        if not value.get("currency") and not value.get("currency_symbol"):
            return "CURRENCY_NOT_ESTABLISHED"
        if not _period_supported(value.get("fee_period"), evidence) and _context_basis(binding.source, evidence) != value.get("fee_period"):
            return "BASIS_NOT_SUPPORTED"
        if field == "tuition" and not re.search(r"tuition|tuitions|frais|fees", evidence, re.I) and not _source_field_context(field, binding.source):
            return "FIELD_NOT_SUPPORTED"
        # A minimum/maximum, optional charge, deposit or price estimate cannot
        # silently become an unqualified amount.
        if re.search(r"\bminimum\b|\bmaximum\b|\bup to\b|\bestimat|\boptional\b|\bdeposit\b|deducted", evidence, re.I):
            return "QUALIFIED_AMOUNT_REQUIRES_REVIEW"
        for key in ("credential", "fee_name"):
            # A tariff row may inherit its programme/credential label from
            # the title of this exact document. This establishes context for
            # the row only; it neither invents a programme link nor binds an
            # organisation unit.
            if value.get(key) and not (
                _contains(value[key], evidence)
                or _contains(value[key], binding.source.title or "")
            ):
                return "TARIFF_LABEL_NOT_SUPPORTED"
        # Multiple tariff rows in one excerpt need explicit row alignment.
        if (
            len(re.findall(r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|CHF|EUR|GBP|JPY)\s*)\s*\d", evidence)) > 1
            and not (alignment is not None and alignment.row_aligned)
        ):
            return "MULTIPLE_AMOUNT_ROW_ALIGNMENT"
        return None
    if "deadline" in field:
        if _deadline_evidence_errors(value, evidence):
            return "VALUE_NOT_SUPPORTED"
        terms = {"priority_deadline": r"priority", "funding_deadline": r"funding|scholarship",
                 "international_deadline": r"international", "final_deadline": r"final|application deadline|applications close|application\s+closing\s+date|closing\s+date"}
        if not re.search(terms.get(field, r"deadline|closing"), evidence, re.I):
            return "DEADLINE_TYPE_NOT_SUPPORTED"
        return None
    if field == "minimum_degree":
        if not _contains(value, evidence):
            return "VALUE_NOT_SUPPORTED"
        if not re.search(r"must|required|requirement|minimum|normally have|hold|possess", evidence, re.I):
            return "REQUIREMENT_NOT_EXPLICIT"
        return None
    if field == "standardized_tests":
        if isinstance(value, str):
            if not _contains(value, evidence):
                return "TEST_NAME_NOT_SUPPORTED"
            if not re.search(
                r"minimum|required|at least|must|no less|acceptable|"
                r"selection|admission|threshold|basis",
                evidence,
                re.I,
            ):
                return "TEST_REQUIREMENT_NOT_EXPLICIT"
            return None
        if not isinstance(value, Mapping):
            return "UNSUPPORTED_VALUE_FORMAT"
        # The extraction schema has historically used ``test`` while some
        # provider prompts return the equally explicit ``test_type`` (and a
        # more specific ``test_variant``).  Accept the source-named key that
        # is actually present; do not synthesize a test name.
        test_name = str(
            value.get("test")
            or value.get("test_type")
            or value.get("test_variant")
            or ""
        ).strip()
        if not test_name or not _contains(test_name, evidence):
            return "TEST_NAME_NOT_SUPPORTED"
        numbers = _numeric_values(value)
        support_text = evidence
        if alignment is not None and alignment.row_aligned and alignment.nearby_context:
            support_text = f"{evidence} {alignment.nearby_context}"
        if not all(_number_supported(number, support_text) for number in numbers):
            return "VALUE_NOT_SUPPORTED"
        if not re.search(
            r"minimum|required|at least|must|no less|acceptable|"
            r"selection|admission|threshold|basis",
            support_text,
            re.I,
        ):
            return "TEST_REQUIREMENT_NOT_EXPLICIT"
        return None
    if field in {"ielts_subscores", "toefl"} and isinstance(value, dict):
        numbers = [number for number in value.values() if isinstance(number, (int, float)) and not isinstance(number, bool)]
        term = "ielts" if field == "ielts_subscores" else "toefl"
        if not numbers or not all(_number_supported(number, evidence) for number in numbers):
            return "VALUE_NOT_SUPPORTED"
        if not re.search(term, evidence, re.I) or not re.search(r"minimum|at least|required|must|no less|≥", evidence, re.I):
            return "THRESHOLD_NOT_EXPLICIT"
        return None
    if field in {"minimum_gpa", "gpa_scale", "ielts_overall", "ielts_subscores", "toefl", "duolingo"}:
        if field == "minimum_gpa" and re.search(r"graduat|complete.*(?:major|degree|requirements)|remain in|good standing", evidence, re.I):
            return "ADMISSION_VS_COMPLETION_UNRESOLVED"
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return "STRUCTURED_THRESHOLD_REQUIRES_REVIEW"
        if not _number_supported(value, evidence):
            return "VALUE_NOT_SUPPORTED"
        term = r"GPA|grade.point" if "gpa" in field else field.split("_")[0]
        if not re.search(term, evidence, re.I) or not re.search(r"minimum|at least|required|must|no less", evidence, re.I):
            return "THRESHOLD_NOT_EXPLICIT"
        return None
    if field == "scholarships":
        if not isinstance(value, dict):
            return "UNSUPPORTED_VALUE_FORMAT"
        if not value.get("details") and not value.get("award_name") and not value.get("eligibility"):
            return "FUNDING_FACT_MISSING"
        if not re.search(r"scholarship|fellowship|assistant|financial|funding|grant|bursar|tuition|\baid\b|\bawards?\b|\bsupport\b|loan", evidence, re.I):
            return "FIELD_NOT_SUPPORTED"
        type_patterns = {
            "loan": r"loan", "fellowship": r"fellowship", "assistantship": r"assistant",
            "grant": r"grant|rebate", "merit_scholarship": r"merit.*scholarship|scholarship.*merit",
            "external_scholarship": r"external.*(?:scholarship|fellowship)",
            "financial_aid_policy": r"financial (?:aid|support)|subsidy|financial need",
            "institutional_need_based_grant": r"need.based.*grant|grant.*need",
        }
        category = str(value.get("funding_type") or "unknown")
        if category not in UNKNOWN and not re.search(type_patterns.get(category, r"(?!)"), evidence, re.I):
            return "FUNDING_TYPE_NOT_SUPPORTED"
        for key in ("award_name", "eligibility", "details"):
            if value.get(key) and not _contains(value[key], evidence):
                return "UNSUPPORTED_FUNDING_" + key.upper()
        if value.get("amount") is not None:
            if not _number_supported(value["amount"], evidence):
                return "VALUE_NOT_SUPPORTED"
            if value.get("currency") and not _currency_supported(value.get("currency"), evidence, binding) and _context_currency(binding.source, evidence) != value.get("currency"):
                return "CURRENCY_NOT_ESTABLISHED"
            if not value.get("currency") and not value.get("currency_symbol"):
                return "CURRENCY_NOT_ESTABLISHED"
        for key in ("automatic_consideration", "separate_application_required", "repayable"):
            if value.get(key) is not None:
                return "FUNDING_BOOLEAN_REQUIRES_REVIEW"
        return None
    if field == "employment_outcomes":
        return _employment_outcome_errors(value, evidence, binding)
    # Literal text/list values only; no bag-of-words entailment or arbitrary
    # semantic completion is used to auto-accept a structured proposal.
    if isinstance(value, str) and _contains(value, evidence):
        return None
    if isinstance(value, list) and value and all(isinstance(v, str) and _contains(v, evidence) for v in value):
        return None
    return "VALUE_SUPPORT_UNRESOLVED"


def _source_field_context(field: str, source: ExtractionSource) -> bool:
    """A page's admitted type/title can supply table context, never a value."""
    context = " ".join((source.page_type or "", source.title or "", source.url or "")).casefold()
    terms = {
        "tuition": r"tuition|fees?|costs?",
        "additional_fees": r"fees?|costs?",
        "application_fee": r"application|admission|fees?",
        "scholarships": r"scholarship|financial|funding|aid|grant",
    }
    return bool(re.search(terms.get(field, r"$^"), context, re.I))


# ---------------------------------------------------------------------------
# Generic resolver integration
# ---------------------------------------------------------------------------

def resolve_review_proposals(
    assertions: Sequence[FieldAssertion], *,
    bindings: Mapping[str, SourceBinding],
    programmes: Mapping[str, Mapping[str, object]],
    organisation_units: Sequence[object] = (),
) -> list[FieldAssertion]:
    """Apply generic resolvers to NEEDS_REVIEW assertions before acceptance.

    Runs three resolvers in order:
    1. Evidence alignment - normalise table/row context
    2. Entity/scope binding - resolve to most specific proven scope
    3. Provenance repair - ensure complete provenance chain

    Returns assertions with resolver improvements applied.  Does not change
    verification status - only enriches context for the acceptance pass.
    """
    metadata = reconcile_assertion_metadata(
        assertions,
        bindings=bindings,
        programmes=programmes,
        organisation_units=organisation_units,
    )
    resolved: list[FieldAssertion] = []
    for decision in metadata:
        current = decision.assertion
        if current.verification_status != VerificationStatus.NEEDS_REVIEW:
            resolved.append(current)
            continue
        binding = binding_for_assertion(current, bindings)
        source = binding.source if binding else None
        if not source or not binding:
            resolved.append(current)
            continue
        programme = programmes.get(current.entity_id, {})
        expected_institution = str(
            programme.get("institution_id")
            or (current.entity_id if current.entity_type == "institution" else "")
        )
        scope = resolve_entity_scope(
            current,
            source,
            target_institution_id=expected_institution,
            target_programme={**programme, "programme_id": current.entity_id},
            organisation_units=organisation_units,
            supplied_organisation_unit_id=binding.organisation_unit_id,
        )
        if scope.bound:
            current = replace(
                current,
                scope=scope.scope or current.scope,
                entity_id=scope.entity_id or current.entity_id,
                entity_type=scope.entity_type or current.entity_type,
            )
        resolved.append(current)
    return resolved


def reconsider_assertions(
    assertions: Sequence[FieldAssertion], *,
    bindings: Mapping[str, SourceBinding],
    programmes: Mapping[str, Mapping[str, object]],
    organisation_units: Sequence[object] = (),
    target_cycle: str | None = None,
    material_conflict_ids: frozenset[str] = frozenset(),
) -> list[AcceptanceDecision]:
    """Classify review proposals and accept only supported observations.

    Bindings are keyed by raw_document_id, so mirrors/repeated URLs cannot
    substitute a different snapshot. Existing rejections/acceptances are not
    silently overwritten. Call after set validation/merge and before staging.
    """
    decisions: list[AcceptanceDecision] = []
    for original in assertions:
        if original.verification_status != VerificationStatus.NEEDS_REVIEW:
            decisions.append(AcceptanceDecision(original, "UNCHANGED", ()))
            continue
        a = original
        changes: list[str] = []
        classification, reasons = "REAL_INSUFFICIENT_EVIDENCE", []
        binding = binding_for_assertion(a, bindings)
        programme = programmes.get(a.entity_id, {})
        expected_institution = str(programme.get("institution_id") or (a.entity_id if a.entity_type == "institution" else ""))
        source = binding.source if binding else None
        if a.epistemic_state != EpistemicState.OBSERVED or a.inference_id or a.donor_assertion_ids or a.donor_entity_ids or a.inherited_from_assertion_id or a.inherited_from_entity_id or a.source_type in {"historical_inference", "hierarchical_inference"}:
            classification, reasons = "HARD_INVALID", ["NON_NATIVE_OBSERVATION"]
        elif not source or not all((a.raw_document_id, a.source_content_hash, a.acquisition_run_id, a.source_url)):
            reasons = ["MISSING_PROVENANCE"]
        elif not all((source.source_authority, source.source_relationship, a.source_authority, a.source_relationship)):
            reasons = ["MISSING_PROVENANCE"]
        elif (source.content_hash != a.source_content_hash or source.url != a.source_url or
              source.source_authority != a.source_authority or source.source_relationship != a.source_relationship or
              source.dataset_id != a.dataset_id or
              source.raw_document_id != a.raw_document_id or source.acquisition_run_id != a.acquisition_run_id):
            classification, reasons = "HARD_INVALID", ["PROVENANCE_MISMATCH"]
        elif not expected_institution or binding.institution_id != expected_institution:
            classification, reasons = "HARD_INVALID", ["WRONG_INSTITUTION"]
        elif a.assertion_id in material_conflict_ids or a.inference_conflict_state not in (None, "NONE", "UNKNOWN"):
            classification, reasons = "CONFLICT", ["MATERIAL_CONFLICT"]
        elif source.source_class in {"search", "search_discovery", "search_index", "search_snippet"}:
            classification, reasons = "HARD_INVALID", ["SEARCH_NOT_EVIDENCE"]
        elif a.applicability_state == ApplicabilityState.NOT_APPLICABLE:
            classification, reasons = "HARD_INVALID", ["INAPPLICABLE_ENTITY"]
        else:
            hard_errors = set(a.validation_errors) - OPTIONAL_ERRORS
            if hard_errors:
                classification = "REAL_INSUFFICIENT_EVIDENCE" if hard_errors == {"SOURCE_EXCERPT_ONLY"} else "HARD_INVALID"
                reasons = sorted(hard_errors)
            else:
                host = (urlsplit(source.url).hostname or "").casefold()
                domain = binding.official_domain.casefold()
                official = bool(domain) and (host == domain or host.endswith("." + domain))
                # External identity needs actual entity identifiers; source
                # availability on its own is not a verified institution match.
                external_entity_match = bool(source.external_entity_match)
                if not official and not external_entity_match:
                    reasons = ["EXTERNAL_ENTITY_MATCH_UNVERIFIED"]
                elif source.linked_programme_id and source.linked_programme_id != a.entity_id and a.scope == "programme":
                    classification, reasons = "HARD_INVALID", ["WRONG_PROGRAMME"]
                else:
                    alignment = resolve_evidence_alignment(a, source)
                    evidence = a.evidence or ""
                    if not evidence or not _contains(evidence, source.text):
                        if alignment.usable and alignment.matched_evidence:
                            evidence = alignment.matched_evidence
                            a = replace(a, evidence=evidence)
                            if alignment.locator and not a.evidence_locator:
                                a = replace(a, evidence_locator=alignment.locator)
                            changes.append("EVIDENCE_ALIGNMENT_REPAIRED")
                        else:
                            reasons = ["EVIDENCE_NOT_IN_SNAPSHOT"]
                    a, projection_changes = _supported_projection(a)
                    changes.extend(projection_changes)
                    problem = (
                        "EVIDENCE_NOT_IN_SNAPSHOT" if reasons
                        else _claim_supported(a, evidence, binding, alignment)
                    )
                    if problem:
                        classification = "HARD_INVALID" if problem == "VALUE_NOT_SUPPORTED" else "REAL_INSUFFICIENT_EVIDENCE"
                        reasons = [problem]
                    else:
                        value = dict(a.value_json) if isinstance(a.value_json, dict) else a.value_json
                        degree = a.degree_level
                        if degree and not _contains(degree, evidence):
                            degree = None
                            changes.append("DEGREE_LEVEL_UNKNOWN")
                        # Do not turn LLM defaults into source-stated context.
                        audience = a.audience or (value.get("audience") if isinstance(value, dict) else None)
                        if audience and not _contains(audience, evidence):
                            audience = None
                            if isinstance(value, dict): value["audience"] = None
                            changes.append("AUDIENCE_UNKNOWN")
                        cycle = a.academic_cycle or (value.get("academic_cycle") if isinstance(value, dict) else None)
                        cycle_years = _years(cycle)
                        if cycle and (
                            not cycle_years
                            or (
                                not cycle_years.issubset(_years(source.text))
                                and _context_cycle(source, evidence) != cycle
                            )
                        ):
                            cycle = None
                            if isinstance(value, dict): value["academic_cycle"] = None
                            changes.append("CYCLE_UNKNOWN")
                        temporal = TemporalState.UNKNOWN
                        if source.temporal_state == TemporalState.HISTORICAL or a.temporal_state == TemporalState.HISTORICAL or source.source_class == "archive":
                            temporal = TemporalState.HISTORICAL
                        elif _years(cycle) and _years(target_cycle) and max(_years(cycle)) < min(_years(target_cycle)):
                            temporal = TemporalState.HISTORICAL
                        elif source.temporal_state == TemporalState.FUTURE or a.temporal_state == TemporalState.FUTURE:
                            temporal = TemporalState.FUTURE
                        if temporal != a.temporal_state: changes.append("TEMPORAL_STATE_" + temporal.value)
                        scope = str(a.scope or "unknown").casefold()
                        scope_result = resolve_entity_scope(
                            a,
                            source,
                            target_institution_id=expected_institution,
                            target_programme={
                                **programme,
                                "programme_id": a.entity_id,
                            },
                            organisation_units=organisation_units,
                            supplied_organisation_unit_id=binding.organisation_unit_id,
                            # The official-domain gate above proves source
                            # ownership.  If the source cannot prove the
                            # requested programme/unit, retain the explicit
                            # fact at institution scope rather than inventing
                            # a narrower applicability binding.
                            fallback_to_institution=(official or external_entity_match),
                        )
                        if scope_result.bound:
                            resolved_scope = scope_result.scope or scope
                            entity_id = scope_result.entity_id or a.entity_id
                            entity_type = scope_result.entity_type or a.entity_type
                            if resolved_scope != scope:
                                changes.append(f"SCOPE_{scope.upper()}_TO_{resolved_scope.upper()}")
                            if resolved_scope == "institution":
                                changes.append("BOUND_TO_INSTITUTION")
                            elif entity_type == "organisation_unit":
                                changes.append("BOUND_TO_ORGANISATION_UNIT")
                            elif resolved_scope == "programme" and entity_id != a.entity_id:
                                changes.append("BOUND_TO_PROGRAMME")
                            scope = resolved_scope
                        else:
                            reasons = list(scope_result.reasons or ("SUBJECT_SCOPE_UNVERIFIED",))
                        if not reasons:
                            # Existing structural type/unit validators still run.
                            optional_structure_errors = {"TUITION_CREDENTIAL_MISSING"}
                            if "CURRENCY_UNKNOWN" in changes:
                                optional_structure_errors.update({
                                    "TUITION_CURRENCY_MISSING",
                                    "APPLICATION_FEE_CURRENCY_MISSING",
                                })
                            errors = [e for e in _value_errors(a.field_name, value, programme_degree=None)
                                      if e not in optional_structure_errors]
                            if errors:
                                reasons = list(errors)
                            else:
                                if temporal == TemporalState.HISTORICAL:
                                    classification = "ACCEPT_HISTORICAL"
                                elif scope in {"institution", "faculty", "department", "school"}:
                                    classification = "ACCEPT_BROADER_SCOPE"
                                elif set(a.validation_errors) & OPTIONAL_ERRORS or projection_changes or changes:
                                    classification = "ACCEPT_WITH_UNKNOWN_CONTEXT"
                                else:
                                    classification = "ACCEPT_EXACT"
                                a = replace(a, value_json=value, scope=scope,
                                            entity_id=entity_id, entity_type=entity_type,
                                            degree_level=degree,
                                            audience=audience, academic_cycle=cycle, temporal_state=temporal,
                                            applicability_state=ApplicabilityState.UNKNOWN,
                                            verification_status=VerificationStatus.RULE_VALIDATED,
                                            validation_errors=[])
        if reasons:
            status = VerificationStatus.REJECTED if classification == "HARD_INVALID" else VerificationStatus.NEEDS_REVIEW
            a = replace(original, verification_status=status,
                        validation_errors=list(dict.fromkeys([*original.validation_errors, *reasons])))
        decisions.append(AcceptanceDecision(a, classification, tuple(reasons), tuple(changes)))

    # Detect comparable contradictory numerical/threshold claims before any
    # new acceptance. Unknown dimensions are not used to dismiss a conflict.
    for i, decision in enumerate(decisions):
        a = decision.assertion
        if decision.classification not in ACCEPTANCE_CLASSES:
            continue
        av = a.value_json.get("amount") if isinstance(a.value_json, dict) else a.value_json
        if not isinstance(av, (int, float, str)) or isinstance(av, bool):
            continue
        for other in decisions:
            b = other.assertion
            if b.assertion_id == a.assertion_id or b.verification_status == VerificationStatus.REJECTED:
                continue
            # Legacy proposals may still use the requesting programme as ID
            # even when the asserted scope is institution-wide.
            if b.scope == "institution" and b.entity_type == "programme":
                institution = programmes.get(b.entity_id, {}).get("institution_id")
                if institution:
                    b = replace(b, entity_id=str(institution), entity_type="institution")
            if not assertions_overlap(a, b):
                continue
            va = a.value_json if isinstance(a.value_json, dict) else {}
            vb = b.value_json if isinstance(b.value_json, dict) else {}
            # Different named awards/charges are not competing observations.
            if any(va.get(k) and vb.get(k) and va[k] != vb[k]
                   for k in ("fee_name", "award_name", "currency", "fee_period")):
                continue
            bv = b.value_json.get("amount") if isinstance(b.value_json, dict) else b.value_json
            if isinstance(bv, type(av)) and av != bv:
                decisions[i] = AcceptanceDecision(replace(a, verification_status=VerificationStatus.NEEDS_REVIEW,
                    validation_errors=["MATERIAL_CONFLICT"]), "CONFLICT", ("MATERIAL_CONFLICT",), decision.changes)
                break
    # Preserve proposal identity in the decision log; accepted projection IDs
    # follow the existing entity/field/source/value identity convention.
    for i, (original, decision) in enumerate(zip(assertions, decisions)):
        a = decision.assertion
        if decision.classification in ACCEPTANCE_CLASSES:
            decisions[i] = replace(decision, assertion=replace(a, assertion_id=stable_id(
                "assertion", a.entity_id, a.field_name, a.source_url,
                json.dumps(a.value_json, ensure_ascii=False, sort_keys=True))))
    return decisions
