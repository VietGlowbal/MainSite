"""Deterministic, bounded source-candidate ordering for operational recovery.

This module ranks URLs that the acquisition layer already knows about.  It does
not discover new URLs, bypass access policy, or decide whether evidence proves
a field.  The caller remains responsible for fetching, parsing, applicability,
and semantic acceptance.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Mapping, Sequence
from urllib.parse import urlsplit

from .url_safety import canonicalize_url


_PROGRAMME_SCOPE_CONTAINERS = frozenset(
    {
        "course",
        "courses",
        "program",
        "programs",
        "programme",
        "programmes",
    }
)
_GENERIC_SCOPE_PARTS = frozenset(
    {
        "admission",
        "admissions",
        "apply",
        "application",
        "applications",
        "detail",
        "details",
        "index",
        "overview",
    }
)


# These are deliberately triage signals, not semantic acceptance rules.  A
# source that matches one of these rules is worth retaining in an extraction
# context; the existing parser, applicability, cycle, currency, basis, and
# identity validators still decide whether a fact can be emitted.
_FIELD_SIGNAL_RULES: Mapping[str, tuple[re.Pattern[str], re.Pattern[str]]] = {
    "tuition": (
        re.compile(
            r"\b(?:tuition|fees?|cost(?:s)?(?: of attendance)?|"
            r"study costs?|tuition rates?|billing)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:[$€£¥]|\b(?:USD|GBP|EUR|CAD|AUD|CHF|SGD|JPY)\b|"
            r"\bper\s+(?:credit|year|semester|term)\b|"
            r"\b\d[\d,]*(?:\.\d+)?\b)",
            re.IGNORECASE,
        ),
    ),
    "application_fee": (
        re.compile(r"\b(?:application|admission)\s+fees?\b", re.IGNORECASE),
        re.compile(
            r"(?:[$€£¥]|\b(?:USD|GBP|EUR|CAD|AUD|CHF|SGD|JPY)\b|\b\d[\d,]*(?:\.\d+)?\b)",
            re.IGNORECASE,
        ),
    ),
    "additional_fees": (
        re.compile(r"\b(?:additional|student|mandatory|other)\s+fees?\b", re.IGNORECASE),
        re.compile(
            r"(?:[$€£¥]|\b(?:USD|GBP|EUR|CAD|AUD|CHF|SGD|JPY)\b|\b\d[\d,]*(?:\.\d+)?\b)",
            re.IGNORECASE,
        ),
    ),
    "application_deadline": (
        re.compile(r"\b(?:application\s+)?deadlines?\b|\bkey\s+dates?\b", re.IGNORECASE),
        re.compile(
            r"\b20\d{2}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
            r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
            r"sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|"
            r"\brolling\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
            re.IGNORECASE,
        ),
    ),
    "final_deadline": (
        re.compile(r"\b(?:application\s+)?deadlines?\b|\bkey\s+dates?\b", re.IGNORECASE),
        re.compile(
            r"\b20\d{2}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
            r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
            r"sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|"
            r"\brolling\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
            re.IGNORECASE,
        ),
    ),
    "english_requirement": (
        re.compile(r"\b(?:IELTS|TOEFL|Duolingo|English(?: language)?)\b", re.IGNORECASE),
        re.compile(r"\b(?:minimum|required|score|band|overall|waiver|accepted)\w*\b", re.IGNORECASE),
    ),
    "programme_identity": (
        re.compile(r"\b(?:programmes?|programs?|courses?|degrees?)\b", re.IGNORECASE),
        re.compile(r"\b(?:BSc|BA|BS|MSc|MA|MS|MBA|MEng|PhD|doctoral|master|bachelor)\b", re.IGNORECASE),
    ),
    "credential": (
        re.compile(r"\b(?:programmes?|programs?|courses?|degrees?)\b", re.IGNORECASE),
        re.compile(r"\b(?:BSc|BA|BS|MSc|MA|MS|MBA|MEng|PhD|doctoral|master|bachelor)\b", re.IGNORECASE),
    ),
    "programme_status": (
        re.compile(r"\b(?:programme?|program|course|admission|application)s?\b", re.IGNORECASE),
        re.compile(r"\b(?:open|active|closed|paused|suspended|discontinued|accepting)\b", re.IGNORECASE),
    ),
    "programme_focus": (
        re.compile(r"\b(?:focus|speciali[sz]ation|concentration|research areas?)\b", re.IGNORECASE),
        re.compile(r"\b(?:programme?|program|course|degree|students?)\b", re.IGNORECASE),
    ),
    "curriculum_overview": (
        re.compile(r"\b(?:curriculum|modules?|courses?|degree requirements?|plan of study)\b", re.IGNORECASE),
        re.compile(r"\b(?:credits?|semester|term|core|elective|study)\b", re.IGNORECASE),
    ),
    "learning_outcomes": (
        re.compile(r"\b(?:learning outcomes?|graduates? will|students? will)\b", re.IGNORECASE),
        re.compile(r"\b(?:learn|develop|understand|skills?|knowledge|ability)\w*\b", re.IGNORECASE),
    ),
    "major_admissions_requirement": (
        re.compile(r"\b(?:admission|entry|application)\s+requirements?\b", re.IGNORECASE),
        re.compile(r"\b(?:must|required|eligible|degree|qualifications?|prerequisite)\w*\b", re.IGNORECASE),
    ),
    "minimum_degree": (
        re.compile(r"\b(?:admission|entry|application)\s+requirements?\b", re.IGNORECASE),
        re.compile(r"\b(?:degree|bachelor|master|qualification|equivalent)\w*\b", re.IGNORECASE),
    ),
    "minimum_gpa": (
        re.compile(r"\b(?:GPA|grade point average|minimum grade)\b", re.IGNORECASE),
        re.compile(r"\b(?:minimum|required|at least|score|average)\b|\b\d(?:\.\d+)?\b", re.IGNORECASE),
    ),
    "subject_prerequisites": (
        re.compile(r"\b(?:prerequisite|pre-requisite|prior study|background)\w*\b", re.IGNORECASE),
        re.compile(r"\b(?:required|must|subject|course|degree|credit)\w*\b", re.IGNORECASE),
    ),
    "admission_difficulty": (
        re.compile(r"\b(?:selective|competitive|acceptance rate|admit rate)\b", re.IGNORECASE),
        re.compile(r"\b(?:applicants?|admitted|acceptance|competitive|selective)\w*\b", re.IGNORECASE),
    ),
    "scholarships": (
        re.compile(r"\b(?:scholarships?|financial aid|fellowships?|assistantships?|funding)\b", re.IGNORECASE),
        re.compile(r"\b(?:eligible|eligibility|award|apply|available|support|amount)\w*\b", re.IGNORECASE),
    ),
    "career_outcomes": (
        re.compile(r"\b(?:career|employment|graduate outcomes?|career paths?)\b", re.IGNORECASE),
        re.compile(r"\b(?:graduates?|alumni|employers?|roles?|industry|work|jobs?)\w*\b", re.IGNORECASE),
    ),
    "employment_outcomes": (
        re.compile(r"\b(?:career|employment|graduate outcomes?|career paths?)\b", re.IGNORECASE),
        re.compile(r"\b(?:graduates?|alumni|employers?|roles?|industry|work|jobs?)\w*\b", re.IGNORECASE),
    ),
}

_FIELD_URL_TERMS: Mapping[str, tuple[str, ...]] = {
    "tuition": ("tuition", "fee", "fees", "cost", "costs", "billing", "finance"),
    "application_fee": ("application", "admission", "fee"),
    "additional_fees": ("fee", "fees", "cost", "charges"),
    "academic_cycle": ("academic", "cycle", "year", "catalog"),
    "intakes": ("intake", "entry", "start", "commencement"),
    "priority_deadline": ("priority", "early", "deadline", "date"),
    "funding_deadline": ("funding", "scholarship", "deadline", "date"),
    "international_deadline": ("international", "overseas", "deadline", "date"),
    "application_deadline": ("deadline", "date", "intake", "admission"),
    "final_deadline": ("final", "deadline", "date", "closing"),
    "rolling_admission": ("rolling", "admission", "application"),
    "application_url": ("apply", "application", "admission"),
    "english_requirement": ("english", "language", "ielts", "toefl", "duolingo"),
    "ielts_overall": ("ielts", "overall", "english", "language"),
    "ielts_subscores": ("ielts", "subscore", "component", "band"),
    "toefl": ("toefl", "english", "language", "score"),
    "duolingo": ("duolingo", "english", "language", "score"),
    "programme_identity": ("program", "programme", "course", "degree", "catalog"),
    "credential": ("program", "programme", "course", "degree", "catalog"),
    "programme_status": ("program", "programme", "course", "admission", "application"),
    "programme_focus": ("focus", "research", "special", "program", "programme"),
    "curriculum_overview": ("curriculum", "course", "module", "handbook", "catalog"),
    "specialisations": ("specialisation", "specialization", "concentration", "track"),
    "learning_outcomes": ("outcome", "graduate", "skills", "learning"),
    "major_admissions_requirement": ("admission", "entry", "requirement", "apply"),
    "minimum_degree": ("admission", "entry", "degree", "requirement"),
    "minimum_gpa": ("gpa", "grade", "admission", "requirement"),
    "gpa_scale": ("gpa", "scale", "grade", "grading"),
    "subject_prerequisites": ("prerequisite", "requirement", "admission", "course"),
    "admission_difficulty": ("selective", "acceptance", "admission"),
    "standardized_tests": ("gre", "gmat", "sat", "act", "test"),
    "work_experience": ("work", "experience", "employment", "professional"),
    "portfolio": ("portfolio", "sample", "audition"),
    "required_documents": ("document", "documents", "materials", "checklist"),
    "recommendation_letters": ("recommendation", "reference", "referee", "letter"),
    "sop_essay_requirements": ("essay", "statement", "motivation", "sop"),
    "graduation_certificate": ("graduation", "certificate", "diploma", "degree"),
    "academic_transcript": ("transcript", "academic", "record", "marksheet"),
    "scholarships": ("scholarship", "funding", "financial", "aid"),
    "career_outcomes": ("career", "employment", "outcome", "graduate"),
    "employment_outcomes": ("career", "employment", "outcome", "graduate"),
}

# Field vocabulary is deliberately centralized here so acquisition ranking,
# content retention and provider context selection cannot drift apart.  These
# aliases remain locator/content signals only; they never satisfy a semantic
# field or weaken assertion validation.
_FIELD_FAMILY_ALIASES: Mapping[str, tuple[str, ...]] = {
    "finance": ("tuition", "application_fee", "additional_fees"),
    "deadlines_intakes": (
        "academic_cycle",
        "intakes",
        "priority_deadline",
        "funding_deadline",
        "international_deadline",
        "final_deadline",
        "application_deadline",
        "rolling_admission",
        "application_url",
    ),
    "eligibility": (
        "minimum_degree",
        "minimum_gpa",
        "gpa_scale",
        "subject_prerequisites",
        "admission_difficulty",
        "standardized_tests",
        "work_experience",
        "portfolio",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
        "major_admissions_requirement",
    ),
    "language": (
        "english_requirement",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
    ),
    "funding": ("scholarships", "funding_deadline"),
    "identity": (
        "programme_identity",
        "credential",
        "programme_status",
        "programme_focus",
        "curriculum_overview",
        "specialisations",
        "learning_outcomes",
    ),
}

_FAMILY_CONTENT_TERMS: Mapping[str, tuple[str, ...]] = {
    "finance": (
        "tuition", "fee", "fees", "cost of attendance", "student budget",
        "per credit", "per semester", "per year", "currency",
    ),
    "deadlines_intakes": (
        "deadline", "key dates", "application date", "intake", "start date",
        "academic year", "rolling admission", "apply",
    ),
    "eligibility": (
        "eligibility", "entry requirement", "admission requirement",
        "prerequisite", "minimum gpa", "qualification", "transcript",
        "recommendation", "statement of purpose", "portfolio",
    ),
    "language": (
        "english language", "ielts", "toefl", "duolingo", "language waiver",
    ),
    "funding": (
        "scholarship", "financial aid", "fellowship", "assistantship", "grant",
        "funding",
    ),
    "identity": (
        "programme", "program", "degree", "course", "curriculum",
        "specialisation", "specialization", "learning outcomes",
    ),
}

_PROGRAMME_BOUND_PAGE_TYPES = frozenset(
    {"programme_overview", "programme_admission", "catalogue"}
)
_NON_FACTUAL_SOURCE_CLASSES = frozenset({"search", "search_discovery", "search_snippet"})
_ARCHIVE_SOURCE_CLASSES = frozenset({"archive", "web_archive", "archived_web"})


@dataclass(frozen=True)
class RankedSourceCandidate:
    url: str
    rank: int
    score: tuple[int, int, int, int, int]
    reasons: tuple[str, ...]
    matched_fields: tuple[str, ...] = ()
    strong_fields: tuple[str, ...] = ()
    anchor_text: str = ""
    discovered_from: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "url": self.url,
            "rank": self.rank,
            "score": list(self.score),
            "reasons": list(self.reasons),
            "matched_fields": list(self.matched_fields),
            "strong_fields": list(self.strong_fields),
            "anchor_text": self.anchor_text,
            "discovered_from": self.discovered_from,
        }


@dataclass(frozen=True)
class SourceContentScreen:
    """Bounded content triage used only for source-context retention."""

    matched_fields: tuple[str, ...]
    strong_fields: tuple[str, ...]
    signal_count: int
    truncated: bool
    reasons: tuple[str, ...]

    @property
    def relevant(self) -> bool:
        return bool(self.matched_fields)

    def to_dict(self) -> dict[str, object]:
        return {
            "matched_fields": list(self.matched_fields),
            "strong_fields": list(self.strong_fields),
            "signal_count": self.signal_count,
            "truncated": self.truncated,
            "relevant": self.relevant,
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True)
class SourceCandidateHint:
    """Candidate metadata used to rank already-discovered links."""

    url: str
    anchor_text: str = ""
    discovered_from: str | None = None
    page_type: str | None = None
    expected_fields: tuple[str, ...] = ()


@dataclass(frozen=True)
class SourceSelectionDecision:
    """One auditable source-context selection decision."""

    url: str
    decision: str
    reason_code: str
    rank: int | None = None
    matched_fields: tuple[str, ...] = ()
    strong_fields: tuple[str, ...] = ()
    programme_link: str | None = None
    academic_cycle: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "url": self.url,
            "decision": self.decision,
            "reason_code": self.reason_code,
            "rank": self.rank,
            "matched_fields": list(self.matched_fields),
            "strong_fields": list(self.strong_fields),
            "programme_link": self.programme_link,
            "academic_cycle": self.academic_cycle,
        }


@dataclass(frozen=True)
class SourceSelectionResult:
    sources: tuple[Any, ...]
    decisions: tuple[SourceSelectionDecision, ...]

    def diagnostics(self) -> tuple[dict[str, object], ...]:
        return tuple(item.to_dict() for item in self.decisions)


def _field_rule(field_name: str) -> tuple[re.Pattern[str], re.Pattern[str]] | None:
    normalized = str(field_name or "").strip().casefold()
    if normalized in _FIELD_SIGNAL_RULES:
        return _FIELD_SIGNAL_RULES[normalized]
    if normalized.endswith("_deadline"):
        return _FIELD_SIGNAL_RULES["final_deadline"]
    if normalized.endswith("_outcomes"):
        return _FIELD_SIGNAL_RULES["career_outcomes"]
    return None


def field_families(field_names: Sequence[str]) -> tuple[str, ...]:
    """Return stable semantic source families for concrete field names."""

    requested = {
        str(value or "").strip().casefold()
        for value in field_names
        if str(value or "").strip()
    }
    return tuple(
        family
        for family, members in _FIELD_FAMILY_ALIASES.items()
        if requested.intersection(members)
    )


def _family_for_field(field_name: str) -> str | None:
    normalized = str(field_name or "").strip().casefold()
    return next(
        (
            family
            for family, members in _FIELD_FAMILY_ALIASES.items()
            if normalized in members
        ),
        None,
    )


def screen_source_content(
    field_names: Sequence[str],
    text: str,
    *,
    title: str = "",
    url: str = "",
    page_type: str = "",
    max_chars: int = 120_000,
) -> SourceContentScreen:
    """Return field signals without accepting a fact or asserting scope.

    The source text is bounded for ranking so a very large retained document
    cannot dominate memory or token selection.  The head and tail are kept to
    retain both page headings and tables commonly placed at the end of PDFs.
    This helper never decides currency, cycle, audience, applicability, or
    programme identity; those remain hard semantic gates downstream.
    """

    limit = max(1, int(max_chars))
    raw = str(text or "")
    truncated = len(raw) > limit
    if truncated:
        head = max(1, int(limit * 0.66))
        tail = max(1, limit - head)
        haystack = f"{raw[:head]}\n[...bounded content gap...]\n{raw[-tail:]}"
    else:
        haystack = raw
    haystack = f"{url} {title} {page_type} {haystack}"

    matched: list[str] = []
    strong: list[str] = []
    reasons: list[str] = []
    for field_name in dict.fromkeys(
        str(value).strip() for value in field_names if str(value).strip()
    ):
        rule = _field_rule(field_name)
        if rule is None:
            # Grouped fields such as ``ielts_overall`` and ``intakes`` use
            # their family's explicit vocabulary. Unknown fields fall back to
            # their own meaningful tokens. No signal accepts a fact.
            family = _family_for_field(field_name)
            terms = _FIELD_URL_TERMS.get(field_name.casefold())
            if terms is None:
                terms = _FAMILY_CONTENT_TERMS.get(
                    family or "",
                    tuple(
                        token
                        for token in re.split(r"[^a-z0-9]+", field_name.casefold())
                        if len(token) >= 4
                    ),
                )
            if terms and any(re.search(rf"\b{re.escape(term)}\b", haystack, re.IGNORECASE) for term in terms):
                matched.append(field_name)
                reasons.append(f"{family or 'field'} token signal: {field_name}")
                # A second independent family term is useful for retention,
                # while remaining wholly separate from factual acceptance.
                family_hits = sum(
                    bool(re.search(rf"\b{re.escape(term)}\b", haystack, re.IGNORECASE))
                    for term in terms
                )
                if family_hits >= 2:
                    strong.append(field_name)
                    reasons.append(f"{field_name}: family_terms={family_hits}")
            continue
        primary, supporting = rule
        primary_hits = len(primary.findall(haystack))
        supporting_hits = len(supporting.findall(haystack))
        if primary_hits:
            matched.append(field_name)
            reasons.append(f"{field_name}: primary={primary_hits}")
        if primary_hits and supporting_hits:
            strong.append(field_name)
            reasons.append(f"{field_name}: supporting={supporting_hits}")

    return SourceContentScreen(
        matched_fields=tuple(matched),
        strong_fields=tuple(strong),
        signal_count=len(matched) + len(strong),
        truncated=truncated,
        reasons=tuple(reasons),
    )


def _hint_value(item: SourceCandidateHint | Mapping[str, Any] | str) -> SourceCandidateHint:
    if isinstance(item, SourceCandidateHint):
        return item
    if isinstance(item, Mapping):
        expected = item.get("expected_fields") or item.get("field_names") or item.get("expected_field_groups") or ()
        if isinstance(expected, str):
            expected = (expected,)
        return SourceCandidateHint(
            url=str(item.get("url") or item.get("source_url") or ""),
            anchor_text=str(item.get("anchor_text") or item.get("text") or ""),
            discovered_from=(str(item.get("discovered_from")) if item.get("discovered_from") else None),
            page_type=(str(item.get("page_type")) if item.get("page_type") else None),
            expected_fields=tuple(str(value) for value in expected if str(value).strip()) if isinstance(expected, (list, tuple, set, frozenset)) else (),
        )
    return SourceCandidateHint(url=str(item or ""))


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").casefold().rstrip(".")


def _site_authority(url: str) -> str:
    """Return a conservative institutional authority suffix for scope checks."""

    host = _host(url)
    parts = host.split(".")
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in {
        "ac",
        "co",
        "com",
        "edu",
        "gov",
        "net",
        "org",
    }:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def _path_parts(url: str) -> tuple[str, ...]:
    return tuple(
        part.casefold()
        for part in urlsplit(url).path.split("/")
        if part
    )


def _programme_scope(url: str) -> tuple[int, str] | None:
    parts = _path_parts(url)
    for index, part in enumerate(parts[:-1]):
        if part not in _PROGRAMME_SCOPE_CONTAINERS:
            continue
        scope = parts[index + 1]
        if scope not in _GENERIC_SCOPE_PARTS:
            return index, scope
    return None


def source_scope_compatible(candidate_url: str, target_url: str) -> bool:
    """Reject a same-host source from a different explicit programme scope.

    A configured fallback such as ``/edu/course/cs/...`` must not become
    evidence for ``/edu/course/ice/...`` merely because both pages are
    official and fetchable.  Central pages and related-party hosts remain
    eligible; field applicability still decides whether their evidence can be
    accepted after parsing.
    """

    if _site_authority(candidate_url) != _site_authority(target_url):
        return True
    candidate_scope = _programme_scope(candidate_url)
    target_scope = _programme_scope(target_url)
    if candidate_scope is None or target_scope is None:
        return True
    return not (
        candidate_scope[0] == target_scope[0]
        and candidate_scope[1] != target_scope[1]
    )


def _field_terms(field_names: tuple[str, ...]) -> tuple[str, ...]:
    terms: set[str] = set()
    for field_name in field_names:
        normalized = field_name.casefold().replace("_", " ")
        terms.update(normalized.split())
        family = _family_for_field(field_name)
        if family:
            terms.update(
                token
                for phrase in _FAMILY_CONTENT_TERMS[family]
                for token in re.split(r"[^a-z0-9]+", phrase.casefold())
                if len(token) >= 3
            )
        if "deadline" in normalized:
            terms.update({"deadline", "admission", "apply", "application"})
        if "tuition" in normalized or "fee" in normalized:
            terms.update({"tuition", "fee", "fees", "cost", "costs"})
        if "english" in normalized:
            terms.update({"english", "language", "ielts", "toefl"})
        if "status" in normalized:
            terms.update({"admission", "application", "apply"})
        if "credential" in normalized or "identity" in normalized:
            terms.update({"programme", "program", "course", "degree", "catalog"})
    return tuple(sorted(terms))


def _candidate_score(
    url: str,
    *,
    target_url: str,
    terms: tuple[str, ...],
) -> tuple[tuple[int, int, int, int, int], tuple[str, ...]]:
    candidate_host = _host(url)
    target_host = _host(target_url)
    candidate_parts = _path_parts(url)
    target_parts = _path_parts(target_url)
    same_host = int(bool(candidate_host and candidate_host == target_host))
    shared_prefix = 0
    for left, right in zip(candidate_parts, target_parts):
        if left != right:
            break
        shared_prefix += 1
    path_term_hits = sum(
        any(term in part for part in candidate_parts)
        for term in terms
    )
    lower_url = url.casefold()
    document_score = int(lower_url.endswith(".pdf")) + int(
        any(token in lower_url for token in ("catalog", "catalogue", "handbook"))
    )
    specificity = min(len(candidate_parts), 20)
    reasons: list[str] = []
    if same_host:
        reasons.append("same programme host")
    if shared_prefix:
        reasons.append(f"shared path prefix {shared_prefix}")
    if path_term_hits:
        reasons.append(f"field-relevant path terms {path_term_hits}")
    if document_score:
        reasons.append("official catalogue/PDF candidate")
    return (
        (same_host, shared_prefix, path_term_hits, document_score, specificity),
        tuple(reasons),
    )


def _field_hint_score(
    hint: SourceCandidateHint,
    *,
    target_url: str,
    field_names: tuple[str, ...],
) -> tuple[tuple[int, int, int, int, int], tuple[str, ...], tuple[str, ...]]:
    """Score a link using only deterministic locator/label signals."""

    url = hint.url
    candidate_host = _host(url)
    target_host = _host(target_url)
    candidate_parts = _path_parts(url)
    target_parts = _path_parts(target_url)
    same_host = int(bool(candidate_host and candidate_host == target_host))
    shared_prefix = 0
    for left, right in zip(candidate_parts, target_parts):
        if left != right:
            break
        shared_prefix += 1

    haystack = f"{url} {hint.anchor_text} {hint.page_type or ''}".casefold()
    matched_fields: list[str] = []
    field_term_hits = 0
    for field_name in dict.fromkeys(field_names):
        family = _family_for_field(field_name)
        terms = _FIELD_URL_TERMS.get(field_name.casefold())
        if terms is None and family:
            terms = tuple(
                dict.fromkeys(
                    token
                    for phrase in _FAMILY_CONTENT_TERMS[family]
                    for token in re.split(r"[^a-z0-9]+", phrase.casefold())
                    if len(token) >= 3
                )
            )
        if terms is None:
            terms = tuple(
                token
                for token in re.split(r"[^a-z0-9]+", field_name.casefold())
                if len(token) >= 4
            )
        hits = sum(
            bool(re.search(rf"\b{re.escape(term)}\b", haystack))
            for term in terms
        )
        if hits:
            matched_fields.append(field_name)
            field_term_hits += hits

    expected_overlap = sum(
        field_name in {value.casefold() for value in hint.expected_fields}
        for field_name in (value.casefold() for value in field_names)
    )
    lower_url = url.casefold()
    document_score = int(lower_url.endswith(".pdf")) + int(
        any(token in lower_url for token in ("catalog", "catalogue", "handbook"))
    )
    specificity = min(len(candidate_parts), 20)
    reasons: list[str] = []
    if same_host:
        reasons.append("same programme host")
    if shared_prefix:
        reasons.append(f"shared path prefix {shared_prefix}")
    if field_term_hits:
        reasons.append(f"field-relevant URL/label terms {field_term_hits}")
    if expected_overlap:
        reasons.append(f"declared field overlap {expected_overlap}")
    if document_score:
        reasons.append("official catalogue/PDF candidate")
    return (
        # An explicit category/field declaration is stronger than incidental
        # words in a URL or anchor. This keeps broad labels such as "financial
        # aid" from displacing a link classified specifically for tuition.
        (same_host, expected_overlap, field_term_hits, shared_prefix, document_score + specificity),
        tuple(reasons),
        tuple(matched_fields),
    )


def rank_field_source_candidates(
    candidates: Sequence[SourceCandidateHint | Mapping[str, Any] | str],
    *,
    target_url: str,
    field_names: Sequence[str] = (),
    max_candidates: int | None = None,
) -> tuple[RankedSourceCandidate, ...]:
    """Rank discovered links for requested fields with a bounded top-k.

    The function accepts only already-discovered candidates.  It canonicalizes
    and scope-filters them, then uses URL/anchor metadata to choose a stable
    bounded frontier.  It never fetches, extracts, or marks evidence factual.
    """

    normalized_fields = tuple(
        dict.fromkeys(str(value).strip() for value in field_names if str(value).strip())
    )
    deduped: dict[str, SourceCandidateHint] = {}
    for raw in candidates:
        hint = _hint_value(raw)
        if not hint.url:
            continue
        canonical = canonicalize_url(hint.url)
        if not source_scope_compatible(canonical, target_url):
            continue
        deduped.setdefault(canonical, SourceCandidateHint(
            url=canonical,
            anchor_text=hint.anchor_text,
            discovered_from=hint.discovered_from,
            page_type=hint.page_type,
            expected_fields=hint.expected_fields,
        ))
    scored: list[tuple[tuple[int, int, int, int, int], tuple[str, ...], tuple[str, ...], SourceCandidateHint]] = []
    for hint in deduped.values():
        score, reasons, matched_fields = _field_hint_score(
            hint,
            target_url=target_url,
            field_names=normalized_fields,
        )
        scored.append((score, reasons, matched_fields, hint))
    scored.sort(
        key=lambda item: (
            -item[0][0],
            -item[0][1],
            -item[0][2],
            -item[0][3],
            -item[0][4],
            item[3].url,
        )
    )
    if max_candidates is not None:
        scored = scored[: max(0, int(max_candidates))]
    return tuple(
        RankedSourceCandidate(
            url=hint.url,
            rank=index + 1,
            score=score,
            reasons=reasons,
            matched_fields=matched_fields,
            anchor_text=hint.anchor_text,
            discovered_from=hint.discovered_from,
        )
        for index, (score, reasons, matched_fields, hint) in enumerate(scored)
    )


def _source_value(source: Any, name: str, default: Any = None) -> Any:
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _cycle_years(value: str | None) -> frozenset[int]:
    raw = str(value or "")
    years = {int(item) for item in re.findall(r"(?<!\d)(20\d{2})(?!\d)", raw)}
    for match in re.finditer(r"(?<!\d)(20\d{2})\s*[-/]\s*(\d{2})(?!\d)", raw):
        start = int(match.group(1))
        years.add(start)
        years.add((start // 100) * 100 + int(match.group(2)))
    return frozenset(years)


def _explicit_programme_link(
    source: Any,
    *,
    target_url: str,
    programme_id: str | None,
) -> str | None:
    linked_id = str(
        _source_value(source, "linked_programme_id", "")
        or _source_value(source, "programme_id", "")
        or ""
    ).strip()
    linked_url = str(
        _source_value(source, "linked_programme_url", "")
        or _source_value(source, "programme_url", "")
        or ""
    ).strip()
    discovered_from = str(_source_value(source, "discovered_from", "") or "").strip()
    if programme_id and linked_id:
        return "explicit_programme_id" if linked_id == programme_id else "identity_mismatch"
    if linked_url:
        try:
            return (
                "explicit_programme_url"
                if canonicalize_url(linked_url) == canonicalize_url(target_url)
                else "identity_mismatch"
            )
        except (TypeError, ValueError):
            return "identity_mismatch"
    if discovered_from:
        try:
            if canonicalize_url(discovered_from) == canonicalize_url(target_url):
                return "target_link"
        except (TypeError, ValueError):
            pass
    return None


def select_sources_for_fields(
    sources: Sequence[Any],
    field_names: Sequence[str],
    *,
    target_url: str,
    max_sources: int,
    target_cycle: str | None = None,
    programme_id: str | None = None,
) -> SourceSelectionResult:
    """Select a bounded, field-aware context and explain every decision.

    Exact target evidence is always the identity anchor. Other programme-bound
    pages require deterministic target lineage; central field pages may be
    retained when their content signals match. Explicit cycle, archive, search,
    scope and duplicate-lineage conflicts fail closed before ranking.
    """

    limit = max(1, int(max_sources))
    target = canonicalize_url(target_url)
    target_years = _cycle_years(target_cycle)
    exact_target_present = any(
        str(_source_value(source, "url", "") or "").rstrip("/")
        == target.rstrip("/")
        for source in sources
    )
    candidates: list[tuple[tuple[int, int, int, int, str], Any, SourceContentScreen, str]] = []
    decisions: list[SourceSelectionDecision] = []
    seen_urls: set[str] = set()
    seen_lineages: set[tuple[str, str]] = set()

    for index, source in enumerate(sources):
        raw_url = str(_source_value(source, "url", "") or "")
        try:
            url = canonicalize_url(raw_url)
        except (TypeError, ValueError):
            decisions.append(SourceSelectionDecision(raw_url, "rejected", "invalid_url"))
            continue
        if not source_scope_compatible(url, target):
            decisions.append(SourceSelectionDecision(url, "rejected", "scope"))
            continue
        raw_document_id = str(_source_value(source, "raw_document_id", "") or "")
        content_hash = str(_source_value(source, "content_hash", "") or "")
        lineage = (raw_document_id, content_hash)
        if url in seen_urls or (any(lineage) and lineage in seen_lineages):
            decisions.append(SourceSelectionDecision(url, "rejected", "lineage_duplicate"))
            continue
        seen_urls.add(url)
        if any(lineage):
            seen_lineages.add(lineage)

        source_class = str(_source_value(source, "source_class", "") or "").casefold()
        temporal_state = str(
            getattr(_source_value(source, "temporal_state", ""), "value", _source_value(source, "temporal_state", ""))
            or ""
        ).casefold()
        if source_class in _NON_FACTUAL_SOURCE_CLASSES:
            decisions.append(SourceSelectionDecision(url, "rejected", "search"))
            continue
        if source_class in _ARCHIVE_SOURCE_CLASSES or temporal_state == "historical":
            decisions.append(SourceSelectionDecision(url, "rejected", "historical_or_archive"))
            continue
        source_cycle = str(_source_value(source, "academic_cycle", "") or "") or None
        source_years = _cycle_years(source_cycle)
        if target_years and source_years and target_years.isdisjoint(source_years):
            decisions.append(
                SourceSelectionDecision(
                    url, "rejected", "cycle", academic_cycle=source_cycle
                )
            )
            continue

        exact_target = url == target
        primary_fallback = index == 0 and not exact_target_present
        programme_link = (
            "exact_target"
            if exact_target
            else "primary_fallback_anchor"
            if primary_fallback
            else _explicit_programme_link(
            source, target_url=target, programme_id=programme_id
            )
        )
        if programme_link == "identity_mismatch":
            decisions.append(
                SourceSelectionDecision(
                    url, "rejected", "identity", programme_link=programme_link,
                    academic_cycle=source_cycle,
                )
            )
            continue
        page_type = str(_source_value(source, "page_type", "") or "").casefold()
        if not (exact_target or primary_fallback) and page_type in _PROGRAMME_BOUND_PAGE_TYPES and not programme_link:
            decisions.append(
                SourceSelectionDecision(
                    url, "rejected", "identity_unlinked", academic_cycle=source_cycle
                )
            )
            continue

        screen = screen_source_content(
            field_names,
            str(_source_value(source, "text", "") or ""),
            title=str(_source_value(source, "title", "") or ""),
            url=url,
            page_type=page_type,
        )
        if not (exact_target or primary_fallback) and not screen.relevant:
            decisions.append(
                SourceSelectionDecision(
                    url, "rejected", "no_field_signal", programme_link=programme_link,
                    academic_cycle=source_cycle,
                )
            )
            continue
        score = (
            int(exact_target or primary_fallback),
            len(screen.strong_fields),
            len(screen.matched_fields),
            screen.signal_count,
            url,
        )
        candidates.append((score, source, screen, programme_link or "central_field_source"))

    candidates.sort(key=lambda item: (-item[0][0], -item[0][1], -item[0][2], -item[0][3], item[0][4]))
    selected_sources: list[Any] = []
    for rank, (_, source, screen, programme_link) in enumerate(candidates, start=1):
        url = canonicalize_url(str(_source_value(source, "url", "")))
        source_cycle = str(_source_value(source, "academic_cycle", "") or "") or None
        if rank > limit:
            decisions.append(
                SourceSelectionDecision(
                    url, "rejected", "top_k", rank=rank,
                    matched_fields=screen.matched_fields,
                    strong_fields=screen.strong_fields,
                    programme_link=programme_link,
                    academic_cycle=source_cycle,
                )
            )
            continue
        selected_sources.append(source)
        decisions.append(
            SourceSelectionDecision(
                url, "selected", "selected", rank=rank,
                matched_fields=screen.matched_fields,
                strong_fields=screen.strong_fields,
                programme_link=programme_link,
                academic_cycle=source_cycle,
            )
        )
    decisions.sort(key=lambda item: (item.url, item.decision, item.reason_code))
    return SourceSelectionResult(tuple(selected_sources), tuple(decisions))


def retain_sources_for_fields(
    sources: Sequence[Any],
    field_names: Sequence[str],
    *,
    max_sources: int,
) -> tuple[Any, ...]:
    """Retain a bounded extraction context ordered by source content signals.

    The first source is always retained as the target identity anchor.  Other
    sources are ranked by bounded content screening.  This is context
    selection only: every source has already passed fetch/admission and the
    returned objects retain their original provenance unchanged.
    """

    limit = max(1, int(max_sources))
    if not sources:
        return ()
    unique: dict[str, tuple[int, Any, SourceContentScreen]] = {}
    for index, source in enumerate(sources):
        url = str(getattr(source, "url", "") or "")
        if not url:
            continue
        screen = screen_source_content(
            field_names,
            str(getattr(source, "text", "") or ""),
            title=str(getattr(source, "title", "") or ""),
            url=url,
            page_type=str(getattr(source, "page_type", "") or ""),
        )
        canonical = canonicalize_url(url)
        unique.setdefault(canonical, (index, source, screen))
    if not unique:
        return tuple(sources[:limit])
    ranked = sorted(
        unique.values(),
        key=lambda item: (
            item[0] != 0,
            # A source-native exact record is deliberately retained ahead of
            # ordinary secondary pages. Its subsequent semantic/acceptance
            # checks are unchanged; this only prevents a proven external row
            # from disappearing in a group-specific top-k reduction.
            not bool(getattr(item[1], "external_entity_match", False)),
            -len(item[2].strong_fields),
            -len(item[2].matched_fields),
            -item[2].signal_count,
            item[0],
            str(getattr(item[1], "url", "")),
        ),
    )
    return tuple(item[1] for item in ranked[:limit])


def rank_source_candidates(
    urls: tuple[str, ...] | list[str],
    *,
    target_url: str,
    field_names: tuple[str, ...] = (),
    max_candidates: int | None = None,
) -> tuple[RankedSourceCandidate, ...]:
    """Return a stable, deduplicated ordering of already-known source URLs.

    Score ties are resolved by canonical URL, so concurrent discovery order
    cannot change which bounded fallback is attempted first.
    """
    terms = _field_terms(field_names)
    deduped: dict[str, None] = {}
    for raw_url in urls:
        if not raw_url:
            continue
        canonical = canonicalize_url(str(raw_url))
        if not source_scope_compatible(canonical, target_url):
            continue
        deduped.setdefault(canonical, None)
    scored: list[tuple[tuple[int, int, int, int, int], tuple[str, ...], str]] = []
    for url in deduped:
        score, reasons = _candidate_score(
            url,
            target_url=target_url,
            terms=terms,
        )
        scored.append((score, reasons, url))
    scored.sort(key=lambda item: (-item[0][0], -item[0][1], -item[0][2], -item[0][3], -item[0][4], item[2]))
    if max_candidates is not None:
        scored = scored[: max(0, int(max_candidates))]
    return tuple(
        RankedSourceCandidate(
            url=url,
            rank=index + 1,
            score=score,
            reasons=reasons,
        )
        for index, (score, reasons, url) in enumerate(scored)
    )


__all__ = [
    "RankedSourceCandidate",
    "SourceCandidateHint",
    "SourceContentScreen",
    "SourceSelectionDecision",
    "SourceSelectionResult",
    "field_families",
    "rank_field_source_candidates",
    "rank_source_candidates",
    "retain_sources_for_fields",
    "screen_source_content",
    "select_sources_for_fields",
    "source_scope_compatible",
]
