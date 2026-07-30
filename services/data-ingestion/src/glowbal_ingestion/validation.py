from __future__ import annotations

import json
import re
from dataclasses import replace
from datetime import date
from typing import Any
from urllib.parse import urlparse

from .deepseek import ExtractionSource
from .models import (
    FUNDING_TYPES,
    HIGH_RISK_FIELDS,
    FieldAssertion,
    NullReason,
    PageType,
    VerificationStatus,
    has_semantic_value,
    normalize_placeholder_values,
    stable_id,
    utc_now_iso,
)
from .parsing import normalize_text


DATE_FIELD_RE = re.compile(r"deadline", re.I)
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
YEAR_RE = re.compile(r"\b(20\d{2})\b")
YEAR_RANGE_RE = re.compile(
    r"\b(20\d{2})\s*[-/\u2010-\u2015]\s*(20)?(\d{2})\b"
)
MONTH_NAMES = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sept": 9,
    "sep": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}
MONTH_PATTERN = "|".join(MONTH_NAMES)
ISO_DATE_TOKEN_RE = re.compile(
    r"(?<!\d)(?P<year>20\d{2})-(?P<month>0?[1-9]|1[0-2])-"
    r"(?P<day>0?[1-9]|[12]\d|3[01])(?!\d)"
)
MONTH_FIRST_DATE_RE = re.compile(
    rf"\b(?P<month>{MONTH_PATTERN})\s+"
    r"(?P<day>\d{1,2})(?:st|nd|rd|th)?"
    r"(?:,\s*|\s+)?(?P<year>20\d{2})?\b",
    re.IGNORECASE,
)
DAY_FIRST_DATE_RE = re.compile(
    rf"\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+"
    rf"(?P<month>{MONTH_PATTERN})"
    r"(?:,\s*|\s+)?(?P<year>20\d{2})?\b",
    re.IGNORECASE,
)
NUMERIC_DATE_RE = re.compile(
    r"(?<![\d-])(?P<month>0?[1-9]|1[0-2])[/.-]"
    r"(?P<day>0?[1-9]|[12]\d|3[01])"
    r"(?:[/.-](?P<year>20\d{2}))?(?!\d)"
)
ARCHIVE_PATH_RE = re.compile(
    r"(?:^|[/_-])archives?(?:[/_-]|$)|"
    r"(?:^|[/_-])20\d{2}[-_/](?:20)?\d{2}(?:[/_-]|$)",
    re.IGNORECASE,
)
VOLATILE_FIELDS = frozenset(
    {
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "tuition",
        "application_fee",
        "additional_fees",
        "scholarships",
    }
)
ENROLLED_STUDENT_RE = re.compile(
    r"\b(?:current(?:ly)?\s+(?:enrolled\s+)?students?|"
    r"degree\s+candidates?|underclassmen|sophomores?|juniors?|seniors?)\b",
    re.IGNORECASE,
)
PRIZE_OR_AWARD_RE = re.compile(
    r"\b(?:cash\s+prizes?|prizes?|awards?|awarded)\b",
    re.IGNORECASE,
)
DEGREE_SCOPE_TERMS: dict[str, re.Pattern[str]] = {
    "bachelor": re.compile(
        r"\b(?:undergraduate|bachelors?|b\.?\s?[as]\.?)\b",
        re.IGNORECASE,
    ),
    "master": re.compile(
        r"\b(?:masters?|m\.?\s?(?:s|a|eng|sc)\.?|graduate\s+student)\b",
        re.IGNORECASE,
    ),
    "phd": re.compile(
        r"\b(?:ph\.?\s?d\.?|doctoral|doctorate|sixth[-\s]year)\b",
        re.IGNORECASE,
    ),
}
EXPLICIT_CYCLE_PATTERNS = (
    re.compile(
        r"\b(?:fall|autumn|spring|summer|winter|entry|intake|"
        r"academic(?:\s+(?:year|cycle))?)\s*(?:for\s+)?"
        r"(?P<cycle>20\d{2}(?:\s*[-/]\s*(?:20)?\d{2})?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<cycle>20\d{2}(?:\s*[-/]\s*(?:20)?\d{2})?)\s+"
        r"(?:entry|intake|admissions?|academic\s+(?:year|cycle))\b",
        re.IGNORECASE,
    ),
)
INACTIVE_PROGRAMME_STATUSES = frozenset(
    {
        "paused",
        "suspended",
        "closed",
        "discontinued",
        "withdrawn",
        "not_accepting_applications",
    }
)
ACTIVE_APPLICATION_FIELDS = frozenset(
    {
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "rolling_admission",
    }
)
LANGUAGE_REQUIREMENT_FIELDS = frozenset(
    {"ielts_overall", "ielts_subscores", "toefl", "duolingo"}
)
APPLICATION_CONTENT_PATH_RE = re.compile(
    r"(?:^|[-_/])(?:"
    r"essays?|activities|academics|letters?|recommendations?|"
    r"transcripts?|testing|deadlines?|requirements?|faq"
    r")(?:[-_/]|$)",
    re.IGNORECASE,
)
EVIDENCE_PUNCTUATION_TRANSLATION = str.maketrans(
    {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2015": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
        "\u200b": "",
    }
)
STATUS_VARIANT_PATTERNS: dict[str, re.Pattern[str]] = {
    "morning": re.compile(r"\bmorning\b", re.IGNORECASE),
    "extended": re.compile(r"\bextended\b", re.IGNORECASE),
    "full_time": re.compile(r"\bfull[-\s]?time\b", re.IGNORECASE),
    "part_time": re.compile(r"\bpart[-\s]?time\b", re.IGNORECASE),
    "executive": re.compile(r"\bexecutive\b", re.IGNORECASE),
    "online": re.compile(r"\bonline\b", re.IGNORECASE),
    "weekend": re.compile(r"\bweekend\b", re.IGNORECASE),
    "evening": re.compile(r"\bevening\b", re.IGNORECASE),
}
NOT_REQUIRED_TERMS: dict[str, re.Pattern[str]] = {
    "recommendation_letters": re.compile(
        r"\b(?:recommendations?|references?|referees?|letters?)\b", re.I
    ),
    "sop_essay_requirements": re.compile(
        r"\b(?:essays?|statements? of (?:purpose|objectives?)|"
        r"personal statements?|"
        r"motivation letters?|responses?|questions?)\b",
        re.I,
    ),
    "graduation_certificate": re.compile(
        r"\b(?:(?:degree|graduation)\s+certificates?|diplomas?|"
        r"proofs?\s+of\s+(?:degree|graduation))\b",
        re.I,
    ),
    "academic_transcript": re.compile(
        r"\b(?:transcripts?|academic records?|mark sheets?)\b", re.I
    ),
}
EXPLICIT_NEGATION_RE = re.compile(
    r"\b(?:not|do(?:es)?\s+not|"
    r"need\s+not|no\s+\w+\s+(?:is|are)\s+required)\b",
    re.I,
)
COUNT_WORDS: dict[int, str] = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
}
COUNT_FIELD_TERMS: dict[str, re.Pattern[str]] = {
    "recommendation_letters": re.compile(
        r"\b(?:letters?|recommendations?|references?|referees?|teachers?)\b",
        re.I,
    ),
    "sop_essay_requirements": re.compile(
        r"\b(?:essays?|statements?|responses?|questions?)\b",
        re.I,
    ),
    "graduation_certificate": re.compile(
        r"\b(?:certificates?|diplomas?|proofs?\s+of\s+degree)\b",
        re.I,
    ),
    "academic_transcript": re.compile(
        r"\b(?:transcripts?|academic\s+records?|mark\s+sheets?)\b",
        re.I,
    ),
}
RESTRICTED_FEE_RE = re.compile(
    r"\b(?:"
    r"visiting\s+summer\s+intern|vsi|visiting\s+(?:student|intern)|"
    r"summer\s+intern|late\s+(?:fee|charge)|optional\s+(?:fee|charge)"
    r")\b",
    re.IGNORECASE,
)
PROGRAMME_IDENTITY_STOP_WORDS = frozenset(
    {
        "and",
        "the",
        "of",
        "in",
        "with",
        "programme",
        "program",
        "degree",
        "bachelor",
        "master",
        "doctoral",
        "phd",
    }
)


def programme_identity_supported(
    programme_name: str,
    source: ExtractionSource,
) -> bool:
    """Confirm a target programme when the model returns a false mismatch."""
    if source.page_type not in {
        PageType.PROGRAMME_OVERVIEW.value,
        PageType.UNKNOWN.value,
    }:
        return False
    target_tokens = {
        token
        for token in re.findall(
            r"[a-z0-9]+",
            normalize_text(programme_name).casefold(),
        )
        if len(token) >= 3 and token not in PROGRAMME_IDENTITY_STOP_WORDS
    }
    if not target_tokens:
        return False
    source_identity = normalize_text(
        f"{source.title or ''} {urlparse(source.url).path}"
    ).casefold()
    source_tokens = set(re.findall(r"[a-z0-9]+", source_identity))
    overlap = len(target_tokens & source_tokens) / len(target_tokens)
    return overlap >= 0.7


def evidence_supported(evidence: str, source_text: str) -> bool:
    normalized_evidence = re.sub(
        r"([\(\[])\s+",
        r"\1",
        re.sub(
            r"\s+([\)\]])",
            r"\1",
            re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        (
        normalize_text(evidence)
        .translate(EVIDENCE_PUNCTUATION_TRANSLATION)
        .casefold()
        ),
            ),
        ),
    )
    normalized_source = re.sub(
        r"([\(\[])\s+",
        r"\1",
        re.sub(
            r"\s+([\)\]])",
            r"\1",
            re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        (
        normalize_text(source_text)
        .translate(EVIDENCE_PUNCTUATION_TRANSLATION)
        .casefold()
        ),
            ),
        ),
    )
    return bool(normalized_evidence) and normalized_evidence in normalized_source


def explicit_not_required_evidence(
    field_name: str,
    evidence: str | None,
) -> bool:
    """Absence from a checklist is never proof that a document is not required."""
    text = normalize_text(str(evidence or ""))
    field_terms = NOT_REQUIRED_TERMS.get(field_name)
    return bool(
        field_terms
        and field_terms.search(text)
        and EXPLICIT_NEGATION_RE.search(text)
    )


def _required_count_evidence_errors(
    field_name: str,
    value: Any,
    evidence: str,
) -> list[str]:
    """Reject document counts that are not stated near the document type."""
    if field_name not in COUNT_FIELD_TERMS or not isinstance(value, dict):
        return []
    count = value.get("required_count")
    if count is None:
        return []
    if (
        count == 0
        and value.get("requirement_status") == "not_required"
        and explicit_not_required_evidence(field_name, evidence)
    ):
        return []

    normalized = normalize_text(evidence)
    count_tokens = [re.escape(str(count))]
    count_word = COUNT_WORDS.get(count)
    if count_word:
        count_tokens.append(count_word)
    count_re = re.compile(
        rf"\b(?:{'|'.join(count_tokens)})\b",
        re.I,
    )
    term_re = COUNT_FIELD_TERMS[field_name]
    for count_match in count_re.finditer(normalized):
        window = normalized[
            max(0, count_match.start() - 80) :
            min(len(normalized), count_match.end() + 80)
        ]
        if term_re.search(window):
            return []

    if count == 1:
        singular_window_re = re.compile(
            rf"\b(?:an?|one)\s+(?:official\s+)?"
            rf"(?:{term_re.pattern.removeprefix(r'\b(?:').removesuffix(r')\b')})",
            re.I,
        )
        if singular_window_re.search(normalized):
            return []
    return ["REQUIRED_COUNT_NOT_IN_EVIDENCE"]


def normalize_programme_status(value: Any) -> str:
    """Map free-form status text to a small canonical vocabulary."""
    normalized = normalize_text(str(value or "")).casefold()
    if re.search(r"\b(?:pause|paused)\b", normalized):
        return "paused"
    if re.search(r"\bsuspend(?:ed|sion)?\b", normalized):
        return "suspended"
    if re.search(
        r"\b(?:applications?\s+(?:are|is)\s+"
        r"(?:now\s+|currently\s+)?closed|closed)\b",
        normalized,
    ):
        return "closed"
    if re.search(r"\b(?:not|no\s+longer)\s+accepting\b", normalized):
        return "not_accepting_applications"
    if re.search(r"\bdiscontinu(?:ed|ation)\b", normalized):
        return "discontinued"
    if re.search(r"\bwithdrawn\b", normalized):
        return "withdrawn"
    if re.search(r"\b(?:open|active|accepting\s+applications?)\b", normalized):
        return "active"
    return normalized.replace(" ", "_")


def _explicit_academic_cycle(evidence: str | None) -> str | None:
    if not evidence:
        return None
    normalized = normalize_text(evidence)
    for pattern in EXPLICIT_CYCLE_PATTERNS:
        match = pattern.search(normalized)
        if match:
            return re.sub(r"\s+", "", match.group("cycle"))
    return None


def _status_cycle(evidence: str | None) -> str | None:
    explicit = _explicit_academic_cycle(evidence)
    if explicit:
        return explicit
    if not evidence:
        return None
    range_match = YEAR_RANGE_RE.search(evidence)
    if range_match:
        end_year = (
            f"{range_match.group(2)}{range_match.group(3)}"
            if range_match.group(2)
            else f"{range_match.group(1)[:2]}{range_match.group(3)}"
        )
        return f"{range_match.group(1)}-{end_year}"
    years = YEAR_RE.findall(evidence)
    return years[0] if len(set(years)) == 1 else None


def _locate_fragmented_evidence(
    evidence: str,
    source_text: str,
) -> str | None:
    """Anchor LLM evidence containing an ellipsis to one bounded source span."""
    if "..." not in evidence and "…" not in evidence:
        return None
    fragments = [
        normalize_text(fragment)
        .translate(EVIDENCE_PUNCTUATION_TRANSLATION)
        .casefold()
        for fragment in re.split(r"(?:\.{3}|…)", evidence)
    ]
    fragments = [fragment for fragment in fragments if len(fragment) >= 8]
    if len(fragments) < 2:
        return None
    normalized_source = (
        normalize_text(source_text)
        .translate(EVIDENCE_PUNCTUATION_TRANSLATION)
    )
    normalized_source = re.sub(
        r"([\(\[])\s+",
        r"\1",
        re.sub(r"\s+([\)\]])", r"\1", normalized_source),
    )
    fragments = [
        re.sub(
            r"([\(\[])\s+",
            r"\1",
            re.sub(r"\s+([\)\]])", r"\1", fragment),
        )
        for fragment in fragments
    ]
    searchable_source = normalized_source.casefold()
    first = searchable_source.find(fragments[0])
    if first < 0:
        return None
    cursor = first + len(fragments[0])
    end = cursor
    for fragment in fragments[1:]:
        index = searchable_source.find(fragment, cursor)
        if index < 0 or index - first > 1400:
            return None
        cursor = index + len(fragment)
        end = cursor
    return normalize_text(normalized_source[first:end])


def _value_errors(
    field_name: str,
    value: Any,
    *,
    programme_degree: str | None = None,
) -> list[str]:
    errors: list[str] = []
    if programme_degree == "bachelor" and field_name == "minimum_degree":
        errors.append("FIELD_NOT_APPLICABLE")
    if DATE_FIELD_RE.search(field_name) and isinstance(value, str):
        if ISO_DATE_RE.fullmatch(value):
            try:
                date.fromisoformat(value)
            except ValueError:
                errors.append("INVALID_DATE")
    if field_name == "ielts_overall" and isinstance(value, (int, float)):
        if value < 0 or value > 9:
            errors.append("IELTS_OUT_OF_RANGE")
    if field_name == "tuition":
        if not isinstance(value, dict):
            errors.append("TUITION_NOT_ATOMIC_OBJECT")
        else:
            amount = value.get("amount")
            if amount is None or amount == "":
                errors.append("TUITION_AMOUNT_MISSING")
            elif isinstance(amount, bool) or not isinstance(
                amount, (int, float)
            ):
                errors.append("TUITION_AMOUNT_INVALID")
            elif amount <= 0:
                errors.append("TUITION_AMOUNT_NOT_POSITIVE")
            if not value.get("currency"):
                errors.append("TUITION_CURRENCY_MISSING")
            if not value.get("credential"):
                errors.append("TUITION_CREDENTIAL_MISSING")
    if field_name == "application_fee":
        if not isinstance(value, dict):
            errors.append("APPLICATION_FEE_NOT_OBJECT")
        else:
            if value.get("amount") is None or value.get("amount") == "":
                errors.append("APPLICATION_FEE_AMOUNT_MISSING")
            if not value.get("currency"):
                errors.append("APPLICATION_FEE_CURRENCY_MISSING")
    if field_name == "additional_fees" and isinstance(value, dict):
        if value.get("amount") is None or value.get("amount") == "":
            errors.append("ADDITIONAL_FEE_AMOUNT_MISSING")
    if field_name == "scholarships":
        if not isinstance(value, dict):
            errors.append("FUNDING_NOT_OBJECT")
        elif value.get("funding_type") not in FUNDING_TYPES:
            errors.append("FUNDING_TYPE_INVALID")
    if field_name == "confidence" and not isinstance(value, (int, float)):
        errors.append("INVALID_CONFIDENCE")
    return errors


def academic_cycle_evidence_errors(
    value: Any,
    evidence: str,
) -> list[str]:
    value_years = _cycle_years(str(value or ""))
    if not value_years:
        return ["ACADEMIC_CYCLE_NOT_YEAR_BASED"]
    evidence_years = _cycle_years(evidence)
    if not value_years.issubset(evidence_years):
        return ["ACADEMIC_CYCLE_NOT_IN_EVIDENCE"]
    return []


def additional_fee_applicability_errors(
    value: Any,
    evidence: str,
) -> list[str]:
    if not isinstance(value, dict):
        return []
    fee_label = " ".join(
        (
            str(value.get("fee_name") or ""),
            str(value.get("credential") or ""),
            evidence,
        )
    )
    if not RESTRICTED_FEE_RE.search(fee_label):
        return []
    audience = normalize_text(
        str(value.get("audience") or "")
    ).casefold()
    if not audience or audience in {"all", "unknown", "students"}:
        return ["ADDITIONAL_FEE_APPLICABILITY_UNPROVEN"]
    if not RESTRICTED_FEE_RE.search(audience):
        return ["ADDITIONAL_FEE_AUDIENCE_MISMATCH"]
    return []


def _programme_source_errors(
    *,
    fact: dict[str, Any],
    source: ExtractionSource | None,
    programme_name: str | None,
    programme_url: str | None,
) -> list[str]:
    """Reject a different programme overview used as target evidence."""
    if (
        source is None
        or source.page_type != "programme_overview"
        or not programme_name
        or not programme_url
        or str(fact.get("scope") or "") != "programme"
    ):
        return []
    source_url = str(fact.get("source_url") or "").rstrip("/")
    if source_url == str(programme_url).rstrip("/"):
        return []
    target_tokens = {
        token
        for token in re.findall(
            r"[a-z0-9]+",
            normalize_text(programme_name).casefold(),
        )
        if len(token) >= 3 and token not in PROGRAMME_IDENTITY_STOP_WORDS
    }
    if not target_tokens:
        return []
    source_identity = normalize_text(
        f"{source.title or ''} {urlparse(source.url).path}"
    ).casefold()
    source_tokens = set(re.findall(r"[a-z0-9]+", source_identity))
    overlap = len(target_tokens & source_tokens) / len(target_tokens)
    return [] if overlap >= 0.6 else ["SOURCE_PROGRAMME_MISMATCH"]


def _application_url_errors(value: Any) -> list[str]:
    """Reject admissions content pages masquerading as an application URL."""
    if not isinstance(value, str):
        return ["APPLICATION_URL_NOT_STRING"]
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ["APPLICATION_URL_INVALID"]
    if APPLICATION_CONTENT_PATH_RE.search(parsed.path):
        return ["APPLICATION_URL_IS_INFORMATION_PAGE"]
    return []


def _normalize_application_fee(
    value: Any,
    evidence: str,
    audience: str | None,
) -> Any:
    if isinstance(value, dict):
        normalized = dict(value)
        normalized.setdefault("fee_period", "once")
        normalized.setdefault("audience", audience or "all")
        normalized.setdefault("credential", "Application fee")
        return normalized
    if isinstance(value, bool):
        return value
    amount: int | float | None = None
    if isinstance(value, (int, float)):
        amount = value
    elif isinstance(value, str):
        matches = re.findall(
            r"\d+(?:,\d{3})*(?:\.\d+)?",
            value,
        )
        if len(matches) == 1:
            numeric = matches[0].replace(",", "")
            amount = float(numeric) if "." in numeric else int(numeric)
    if amount is None:
        return value
    normalized_evidence = normalize_text(evidence)
    currency = next(
        (
            code
            for code, pattern in (
                ("USD", r"(?:\$|\bUSD\b)"),
                ("GBP", r"(?:Â£|\bGBP\b)"),
                ("EUR", r"(?:â‚¬|\bEUR\b)"),
                ("AUD", r"(?:A\$|\bAUD\b)"),
                ("CAD", r"(?:C\$|\bCAD\b)"),
                ("SGD", r"(?:S\$|\bSGD\b)"),
            )
            if re.search(pattern, normalized_evidence, re.I)
        ),
        None,
    )
    return {
        "credential": "Application fee",
        "amount": amount,
        "currency": currency,
        "fee_period": "once",
        "audience": audience or "all",
    }


def _normalize_scholarship(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        normalized = dict(value)
        normalized.setdefault("funding_type", "unknown")
        normalized.setdefault("award_name", None)
        normalized.setdefault("eligibility", None)
        normalized.setdefault("amount", None)
        normalized.setdefault("currency", None)
        normalized.setdefault("academic_cycle", None)
        normalized.setdefault("automatic_consideration", None)
        normalized.setdefault("separate_application_required", None)
        normalized.setdefault("repayable", None)
        normalized.setdefault("details", None)
        return normalized
    text = normalize_text(str(value or ""))
    folded = text.casefold()
    funding_type = "unknown"
    if re.search(
        r"\bmeet(?:s|ing)?\s+(?:100%\s+of\s+)?(?:the\s+)?"
        r"(?:full\s+)?(?:demonstrated\s+|financial\s+)?need\b",
        folded,
    ):
        funding_type = "financial_aid_policy"
    elif "scholarship" in folded and "need" in folded:
        funding_type = "institutional_need_based_grant"
    return {
        "funding_type": funding_type,
        "award_name": None,
        "eligibility": None,
        "amount": None,
        "currency": None,
        "academic_cycle": None,
        "automatic_consideration": None,
        "separate_application_required": None,
        "repayable": None,
        "details": text or None,
    }


def _status_evidence_errors(
    status: str,
    evidence: str,
    programme_name: str | None,
) -> list[str]:
    normalized_evidence = normalize_text(evidence).casefold()
    explicit_patterns = {
        "paused": r"\bpaus(?:e|ed)\b",
        "suspended": r"\bsuspend(?:ed|sion)?\b",
        "closed": r"\bclosed\b",
        "not_accepting_applications": (
            r"\b(?:not|no\s+longer)\s+accepting\s+applications?\b"
        ),
        "discontinued": r"\bdiscontinu(?:ed|ation)\b",
        "withdrawn": r"\bwithdrawn\b",
        "active": (
            r"\b(?:applications?\s+(?:are\s+)?open|"
            r"accepting\s+applications?|apply\s+now)\b"
        ),
    }
    expected = explicit_patterns.get(status)
    errors: list[str] = []
    if expected and not re.search(expected, normalized_evidence, re.IGNORECASE):
        errors.append("PROGRAMME_STATUS_NOT_EXPLICIT")

    if programme_name:
        target_variants = {
            name
            for name, pattern in STATUS_VARIANT_PATTERNS.items()
            if pattern.search(programme_name)
        }
        evidence_variants = {
            name
            for name, pattern in STATUS_VARIANT_PATTERNS.items()
            if pattern.search(evidence)
        }
        if (
            target_variants
            and evidence_variants
            and not target_variants.intersection(evidence_variants)
        ):
            errors.append("PROGRAMME_STATUS_APPLICABILITY_MISMATCH")
    return errors


def _tuition_evidence_errors(
    value: Any,
    evidence: str,
) -> list[str]:
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    normalized_evidence = normalize_text(evidence).casefold()
    evidence_compact = re.sub(r"[^a-z0-9]", "", normalized_evidence)
    amount = value.get("amount")
    if amount is not None:
        amount_compact = re.sub(r"[^\d.]", "", str(amount))
        evidence_numeric = re.sub(r"[^\d.]", "", normalized_evidence)
        if amount_compact and amount_compact not in evidence_numeric:
            errors.append("TUITION_AMOUNT_NOT_IN_EVIDENCE")
    credential = value.get("credential")
    if credential:
        credential_compact = re.sub(
            r"[^a-z0-9]", "", str(credential).casefold()
        )
        if credential_compact not in evidence_compact:
            errors.append("TUITION_CREDENTIAL_NOT_IN_EVIDENCE")
    currency = str(value.get("currency") or "").upper()
    currency_tokens = {
        "GBP": ("gbp", "£"),
        "USD": ("usd", "$"),
        "EUR": ("eur", "€"),
        "AUD": ("aud", "a$"),
        "CAD": ("cad", "c$"),
        "SGD": ("sgd", "s$"),
    }
    if currency and not any(
        token.casefold() in normalized_evidence
        for token in currency_tokens.get(currency, (currency,))
    ):
        errors.append("TUITION_CURRENCY_NOT_IN_EVIDENCE")
    return errors


def _normalize_extracted_value(value: Any) -> Any:
    """Normalize all model-produced strings before validation and storage."""
    if isinstance(value, str):
        return normalize_text(value)
    if isinstance(value, dict):
        return {
            key: _normalize_extracted_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_normalize_extracted_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_normalize_extracted_value(item) for item in value)
    return value


def _date_signatures(text: str) -> set[tuple[int | None, int, int]]:
    normalized = normalize_text(text)
    signatures: set[tuple[int | None, int, int]] = set()
    for match in ISO_DATE_TOKEN_RE.finditer(normalized):
        signatures.add(
            (
                int(match.group("year")),
                int(match.group("month")),
                int(match.group("day")),
            )
        )
    for pattern in (MONTH_FIRST_DATE_RE, DAY_FIRST_DATE_RE):
        for match in pattern.finditer(normalized):
            signatures.add(
                (
                    int(match.group("year"))
                    if match.group("year")
                    else None,
                    MONTH_NAMES[match.group("month").casefold()],
                    int(match.group("day")),
                )
            )
    for match in NUMERIC_DATE_RE.finditer(normalized):
        signatures.add(
            (
                int(match.group("year"))
                if match.group("year")
                else None,
                int(match.group("month")),
                int(match.group("day")),
            )
        )
    return signatures


def _deadline_evidence_errors(value: Any, evidence: str) -> list[str]:
    value_text = (
        json.dumps(value, ensure_ascii=False, sort_keys=True)
        if not isinstance(value, str)
        else value
    )
    value_dates = _date_signatures(value_text)
    evidence_dates = _date_signatures(evidence)
    if not value_dates:
        return ["DEADLINE_VALUE_NOT_DATE_BASED"]
    if not evidence_dates:
        return ["DEADLINE_NOT_IN_EVIDENCE"]
    for value_year, value_month, value_day in value_dates:
        if not any(
            value_month == evidence_month
            and value_day == evidence_day
            and (
                value_year is None
                or evidence_year is None
                or value_year == evidence_year
            )
            for evidence_year, evidence_month, evidence_day in evidence_dates
        ):
            return ["DEADLINE_VALUE_NOT_IN_EVIDENCE"]
    return []


def _volatile_recency_errors(
    field_name: str,
    value: Any,
    evidence: str,
    source_url: str,
) -> list[str]:
    if field_name not in VOLATILE_FIELDS:
        return []
    current_year = date.today().year
    combined = " ".join(
        (
            source_url,
            evidence,
            json.dumps(value, ensure_ascii=False)
            if not isinstance(value, str)
            else value,
        )
    )
    years = {int(year) for year in _cycle_years(combined)}
    if (
        ARCHIVE_PATH_RE.search(urlparse(source_url).path)
        and years
        and max(years) < current_year
    ):
        return ["STALE_ARCHIVED_SOURCE"]
    if "deadline" in field_name and years and max(years) < current_year:
        return ["OUTDATED_DEADLINE"]
    return []


def _degree_scope_errors(
    field_name: str,
    evidence: str,
    programme_degree: str | None,
) -> list[str]:
    if (
        field_name not in {"tuition", "scholarships"}
        or programme_degree not in DEGREE_SCOPE_TERMS
    ):
        return []
    mentioned = {
        degree
        for degree, pattern in DEGREE_SCOPE_TERMS.items()
        if pattern.search(evidence)
    }
    if mentioned and programme_degree not in mentioned:
        return ["DEGREE_SCOPE_MISMATCH"]
    return []


def _scholarship_applicability_errors(evidence: str) -> list[str]:
    if (
        ENROLLED_STUDENT_RE.search(evidence)
        and PRIZE_OR_AWARD_RE.search(evidence)
        and not re.search(
            r"\b(?:prospective|incoming|newly admitted|applicants?)\b",
            evidence,
            re.IGNORECASE,
        )
    ):
        return ["ENROLLED_STUDENT_AWARD_NOT_ADMISSION_FUNDING"]
    return []


def _institution_tuition_credential_is_proven(
    *,
    fact: dict[str, Any],
    value: Any,
    programme_degree: str | None,
    source_map: dict[str, ExtractionSource],
) -> bool:
    if (
        str(fact.get("scope") or "") != "institution"
        or not isinstance(value, dict)
        or programme_degree not in {"bachelor", "master", "phd"}
    ):
        return False
    applicability_url = str(fact.get("applicability_source_url") or "")
    applicability_evidence = str(
        fact.get("applicability_evidence") or ""
    )
    applicability_source = source_map.get(applicability_url)
    tuition_source = source_map.get(str(fact.get("source_url") or ""))
    if (
        not applicability_source
        or not tuition_source
        or applicability_source.page_type != "programme_overview"
        or not evidence_supported(
            applicability_evidence,
            applicability_source.text,
        )
    ):
        return False
    degree_patterns = {
        "bachelor": re.compile(
            r"\b(?:undergraduate|bachelor|bsc|bs|ab|sb)\b",
            re.I,
        ),
        "master": re.compile(
            r"\b(?:graduate|postgraduate|master|msc|ms|sm)\b",
            re.I,
        ),
        "phd": re.compile(
            r"\b(?:graduate|doctoral|doctorate|phd)\b",
            re.I,
        ),
    }
    pattern = degree_patterns[programme_degree]
    return bool(
        pattern.search(str(value.get("credential") or ""))
        and pattern.search(applicability_evidence)
        and pattern.search(tuition_source.text)
    )


def _locate_tuition_evidence(
    value: Any,
    source_text: str,
) -> str | None:
    """Recover an exact source window only when amount and credential co-occur."""
    if not isinstance(value, dict):
        return None
    amount = value.get("amount")
    credential = value.get("credential")
    if amount is None or not credential:
        return None
    raw_amount = re.sub(r"[^\d]", "", str(amount))
    if not raw_amount:
        return None
    amount_patterns = {
        raw_amount,
        f"{int(raw_amount):,}" if raw_amount.isdigit() else raw_amount,
    }
    credential_compact = re.sub(
        r"[^a-z0-9]", "", str(credential).casefold()
    )
    for amount_pattern in amount_patterns:
        search_start = 0
        while True:
            amount_index = source_text.find(amount_pattern, search_start)
            if amount_index < 0:
                break
            window_start = max(0, amount_index - 220)
            window_end = min(
                len(source_text),
                amount_index + len(amount_pattern) + 120,
            )
            window = source_text[window_start:window_end]
            window_compact = re.sub(
                r"[^a-z0-9]", "", window.casefold()
            )
            if credential_compact in window_compact:
                qualification_index = window.casefold().rfind(
                    "qualification", 0, amount_index - window_start
                )
                if qualification_index >= 0:
                    window = window[qualification_index:]
                return normalize_text(window)
            search_start = amount_index + len(amount_pattern)
    return None


def fact_to_assertion(
    *,
    entity_id: str,
    fact: dict[str, Any],
    source_map: dict[str, ExtractionSource],
    model_name: str,
    extractor_version: str,
    programme_degree: str | None = None,
    programme_name: str | None = None,
    programme_url: str | None = None,
) -> FieldAssertion:
    field_name = str(fact["field_name"])
    source_url = str(fact["source_url"])
    evidence = normalize_text(str(fact["evidence"]))
    value = normalize_placeholder_values(
        _normalize_extracted_value(fact.get("value"))
    )
    if field_name == "application_fee":
        value = _normalize_application_fee(
            value,
            evidence,
            str(fact.get("audience") or "all"),
        )
    elif field_name == "scholarships":
        value = _normalize_scholarship(value)
    if _required_count_evidence_errors(field_name, value, evidence):
        value = dict(value)
        value["required_count"] = None
    academic_cycle = fact.get("academic_cycle")
    if field_name == "programme_status":
        value = normalize_programme_status(value)
        academic_cycle = academic_cycle or _status_cycle(evidence)
    elif "deadline" in field_name:
        academic_cycle = academic_cycle or _explicit_academic_cycle(evidence)
    errors: list[str] = []
    if not has_semantic_value(value):
        errors.append("SEMANTICALLY_EMPTY_VALUE")
    source = source_map.get(source_url)
    if not source:
        errors.append("SOURCE_NOT_IN_FETCH_SET")
    elif not evidence_supported(evidence, source.text):
        if field_name == "tuition":
            located = _locate_tuition_evidence(
                fact.get("value"),
                source.text,
            )
            if located:
                evidence = located
            else:
                errors.append("EVIDENCE_NOT_FOUND_IN_SOURCE")
        else:
            located = _locate_fragmented_evidence(evidence, source.text)
            if located:
                evidence = located
            else:
                errors.append("EVIDENCE_NOT_FOUND_IN_SOURCE")
    errors.extend(
        _value_errors(
            field_name,
            value,
            programme_degree=programme_degree,
        )
    )
    if field_name == "academic_cycle":
        errors.extend(
            academic_cycle_evidence_errors(value, evidence)
        )
    if field_name == "additional_fees":
        errors.extend(
            additional_fee_applicability_errors(value, evidence)
        )
    errors.extend(
        _programme_source_errors(
            fact=fact,
            source=source,
            programme_name=programme_name,
            programme_url=programme_url,
        )
    )
    if field_name == "application_url":
        errors.extend(_application_url_errors(value))
    if "deadline" in field_name:
        errors.extend(_deadline_evidence_errors(value, evidence))
    if field_name == "programme_status":
        errors.extend(
            _status_evidence_errors(
                str(value),
                evidence,
                programme_name,
            )
        )
    if field_name == "tuition":
        tuition_evidence_errors = _tuition_evidence_errors(
            value,
            evidence,
        )
        if tuition_evidence_errors and source:
            located = _locate_tuition_evidence(
                fact.get("value"),
                source.text,
            )
            located_errors = (
                _tuition_evidence_errors(value, located)
                if located
                else tuition_evidence_errors
            )
            if located and not located_errors:
                evidence = located
                tuition_evidence_errors = []
        if (
            tuition_evidence_errors
            == ["TUITION_CREDENTIAL_NOT_IN_EVIDENCE"]
            and _institution_tuition_credential_is_proven(
                fact=fact,
                value=value,
                programme_degree=programme_degree,
                source_map=source_map,
            )
        ):
            tuition_evidence_errors = []
        errors.extend(tuition_evidence_errors)
    errors.extend(
        _volatile_recency_errors(
            field_name,
            value,
            evidence,
            source_url,
        )
    )
    errors.extend(
        _degree_scope_errors(
            field_name,
            evidence,
            programme_degree,
        )
    )
    if field_name == "scholarships":
        errors.extend(_scholarship_applicability_errors(evidence))
    if (
        field_name in NOT_REQUIRED_TERMS
        and isinstance(value, dict)
        and value.get("requirement_status")
        in {"required", "optional", "conditional", "not_required"}
        and not NOT_REQUIRED_TERMS[field_name].search(evidence)
    ):
        errors.append("DOCUMENT_TYPE_NOT_IN_EVIDENCE")
    if (
        field_name in NOT_REQUIRED_TERMS
        and isinstance(value, dict)
        and value.get("requirement_status") == "not_required"
        and not explicit_not_required_evidence(field_name, evidence)
    ):
        errors.append("EXPLICIT_NOT_REQUIRED_EVIDENCE_MISSING")
    applicability_source_url = fact.get("applicability_source_url")
    applicability_evidence = fact.get("applicability_evidence")
    if applicability_evidence:
        applicability_evidence = normalize_text(
            str(applicability_evidence)
        )
    if (
        field_name in LANGUAGE_REQUIREMENT_FIELDS
        and str(fact.get("scope") or "unknown") != "programme"
    ):
        applicability_source = source_map.get(
            str(applicability_source_url or "")
        )
        if not applicability_source_url or not applicability_evidence:
            errors.append("PROGRAMME_APPLICABILITY_NOT_PROVEN")
        elif not applicability_source:
            errors.append("APPLICABILITY_SOURCE_NOT_IN_FETCH_SET")
        elif not evidence_supported(
            str(applicability_evidence),
            applicability_source.text,
        ):
            errors.append("APPLICABILITY_EVIDENCE_NOT_FOUND")

    if errors:
        status = VerificationStatus.REJECTED
    elif fact.get("_group") == "deterministic_status":
        status = VerificationStatus.RULE_VALIDATED
    elif field_name in HIGH_RISK_FIELDS:
        status = VerificationStatus.NEEDS_REVIEW
    else:
        status = VerificationStatus.RULE_VALIDATED

    return FieldAssertion(
        assertion_id=stable_id(
            "assertion",
            entity_id,
            field_name,
            source_url,
            json.dumps(value, ensure_ascii=False, sort_keys=True),
        ),
        entity_type="programme",
        entity_id=entity_id,
        field_name=field_name,
        value_json=value,
        null_reason=None,
        source_url=source_url,
        source_type=fact.get("source_type"),
        evidence=evidence,
        evidence_locator=None,
        scope=fact.get("scope"),
        audience=fact.get("audience"),
        academic_cycle=academic_cycle,
        retrieved_at=utc_now_iso(),
        confidence=float(fact.get("confidence", 0)),
        verification_status=status,
        extractor_version=extractor_version,
        model_name=model_name,
        validation_errors=errors,
        extraction_group=fact.get("_group"),
        applicability_source_url=(
            str(applicability_source_url)
            if applicability_source_url
            else None
        ),
        applicability_evidence=(
            str(applicability_evidence)
            if applicability_evidence
            else None
        ),
        source_content_hash=source.content_hash if source else None,
    )


def _cycle_years(value: str | None) -> frozenset[str]:
    if not value:
        return frozenset()
    text = str(value)
    years = set(YEAR_RE.findall(text))
    for match in YEAR_RANGE_RE.finditer(text):
        end_year = (
            f"{match.group(2)}{match.group(3)}"
            if match.group(2)
            else f"{match.group(1)[:2]}{match.group(3)}"
        )
        years.add(end_year)
    return frozenset(years)


def _cycle_start_year(value: str | None) -> int | None:
    if not value:
        return None
    match = YEAR_RE.search(str(value))
    return int(match.group(1)) if match else None


def _status_applies(
    status_assertion: FieldAssertion,
    candidate: FieldAssertion,
) -> bool:
    status_cycle = _cycle_years(status_assertion.academic_cycle)
    candidate_cycle = _cycle_years(candidate.academic_cycle)
    if not status_cycle:
        return True
    if not candidate_cycle:
        return True
    return bool(status_cycle & candidate_cycle)


def validate_assertion_set(
    assertions: list[FieldAssertion],
) -> list[FieldAssertion]:
    """Apply rules that require facts from more than one field/source."""
    tuition_signatures = {
        (
            assertion.source_url,
            normalize_text(assertion.evidence or "").casefold(),
            (
                assertion.value_json.get("amount")
                if isinstance(assertion.value_json, dict)
                else None
            ),
            (
                str(assertion.value_json.get("currency") or "").upper()
                if isinstance(assertion.value_json, dict)
                else ""
            ),
        )
        for assertion in assertions
        if (
            assertion.field_name == "tuition"
            and has_semantic_value(assertion.value_json)
            and assertion.verification_status
            != VerificationStatus.REJECTED
        )
    }
    explicit_cycles = {
        str(assertion.value_json)
        for assertion in assertions
        if assertion.field_name == "academic_cycle"
        and assertion.value_json
        and assertion.verification_status != VerificationStatus.REJECTED
    }
    fallback_cycle = next(iter(explicit_cycles)) if len(explicit_cycles) == 1 else None
    target_cycle_start = _cycle_start_year(fallback_cycle)
    inactive_statuses = [
        assertion
        for assertion in assertions
        if assertion.field_name == "programme_status"
        and assertion.verification_status != VerificationStatus.REJECTED
        and normalize_programme_status(assertion.value_json)
        in INACTIVE_PROGRAMME_STATUSES
    ]
    validated: list[FieldAssertion] = []
    for assertion in assertions:
        errors = list(assertion.validation_errors)
        status = assertion.verification_status
        academic_cycle = assertion.academic_cycle
        if (
            "deadline" in assertion.field_name
            and has_semantic_value(assertion.value_json)
            and not academic_cycle
        ):
            academic_cycle = (
                _explicit_academic_cycle(assertion.evidence)
                or fallback_cycle
            )
        if (
            assertion.field_name in ACTIVE_APPLICATION_FIELDS
            and has_semantic_value(assertion.value_json)
            and any(
                _status_applies(status_assertion, assertion)
                for status_assertion in inactive_statuses
            )
        ):
            errors.append("INACTIVE_PROGRAMME_CONFLICT")
            status = VerificationStatus.REJECTED
        elif (
            "deadline" in assertion.field_name
            and has_semantic_value(assertion.value_json)
            and not academic_cycle
            and status != VerificationStatus.REJECTED
        ):
            errors.append("MISSING_ACADEMIC_CYCLE")
            status = VerificationStatus.NEEDS_REVIEW
        elif (
            assertion.field_name == "tuition"
            and has_semantic_value(assertion.value_json)
            and status != VerificationStatus.REJECTED
        ):
            item = (
                assertion.value_json
                if isinstance(assertion.value_json, dict)
                else {}
            )
            tuition_cycle_start = _cycle_start_year(
                assertion.academic_cycle
                or str(item.get("academic_cycle") or "")
            )
            if (
                target_cycle_start is not None
                and tuition_cycle_start is not None
                and tuition_cycle_start < target_cycle_start
            ):
                errors.append("OUTDATED_TUITION_CYCLE")
                status = VerificationStatus.REJECTED
            if (
                not assertion.academic_cycle
                and not item.get("academic_cycle")
            ):
                errors.append("MISSING_TUITION_ACADEMIC_CYCLE")
                status = VerificationStatus.NEEDS_REVIEW
            if not item.get("fee_period"):
                errors.append("MISSING_TUITION_FEE_PERIOD")
                status = VerificationStatus.NEEDS_REVIEW
            if (
                str(assertion.audience or "unknown") == "unknown"
                and not item.get("audience")
            ):
                errors.append("MISSING_TUITION_AUDIENCE")
                status = VerificationStatus.NEEDS_REVIEW
        elif (
            assertion.field_name == "additional_fees"
            and has_semantic_value(assertion.value_json)
            and status != VerificationStatus.REJECTED
            and (
                assertion.source_url,
                normalize_text(assertion.evidence or "").casefold(),
                (
                    assertion.value_json.get("amount")
                    if isinstance(assertion.value_json, dict)
                    else None
                ),
                (
                    str(
                        assertion.value_json.get("currency") or ""
                    ).upper()
                    if isinstance(assertion.value_json, dict)
                    else ""
                ),
            )
            in tuition_signatures
        ):
            errors.append("DUPLICATES_TUITION")
            status = VerificationStatus.REJECTED

        validated.append(
            replace(
                assertion,
                academic_cycle=academic_cycle,
                verification_status=status,
                validation_errors=list(dict.fromkeys(errors)),
            )
        )
    return validated


def null_assertion(
    *,
    entity_id: str,
    field_name: str,
    null_reason: NullReason,
    source_url: str | None,
    extractor_version: str,
    model_name: str | None,
    entity_type: str = "programme",
) -> FieldAssertion:
    return FieldAssertion(
        assertion_id=stable_id(
            "assertion-null", entity_id, field_name, null_reason.value
        ),
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field_name,
        value_json=None,
        null_reason=null_reason,
        source_url=source_url,
        source_type=None,
        evidence=None,
        evidence_locator=None,
        scope=None,
        audience=None,
        academic_cycle=None,
        retrieved_at=utc_now_iso(),
        confidence=0.0,
        verification_status=VerificationStatus.RULE_VALIDATED,
        extractor_version=extractor_version,
        model_name=model_name,
        validation_errors=[],
        extraction_group=None,
        applicability_source_url=None,
        applicability_evidence=None,
    )
