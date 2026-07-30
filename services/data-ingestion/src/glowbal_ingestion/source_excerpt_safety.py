from __future__ import annotations

import re
from urllib.parse import urlsplit


ADMISSION_DOCUMENT_FIELDS: frozenset[str] = frozenset(
    {
        "recommendation_letters",
        "sop_essay_requirements",
        "graduation_certificate",
        "academic_transcript",
        "required_documents",
    }
)
OFF_SCOPE_SOURCE_RE = re.compile(
    r"(?:precollege|pre-college|high-school|summer-program|"
    r"continuing-education|executive-education|extension)",
    re.IGNORECASE,
)
AID_SOURCE_RE = re.compile(
    r"(?:financial[- ]aid|applying[- ]for[- ]aid|student[- ]aid|"
    r"scholarships?|funding)",
    re.IGNORECASE,
)
UNDERGRADUATE_ONLY_RE = re.compile(
    r"\b(?:high school|secondary school|first-year applicants?|"
    r"freshm[ae]n|transfer admission|transfer students?)\b",
    re.IGNORECASE,
)
GRADUATE_ONLY_RE = re.compile(
    r"\b(?:graduate admissions?|graduate applicants?|doctoral|Ph\.?D\.?)\b",
    re.IGNORECASE,
)
EXPLICIT_DATE_RE = re.compile(
    r"\b20\d{2}\b|\b(?:January|February|March|April|May|June|July|"
    r"August|September|October|November|December)\s+\d{1,2}\b|"
    r"\b\d{1,2}\s+(?:January|February|March|April|May|June|July|"
    r"August|September|October|November|December)\b|\brolling\b|"
    r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
    re.IGNORECASE,
)
REQUIRED_DOCUMENT_SIGNAL_RE = re.compile(
    r"\b(?:must|required)\b|\bapplicants?\s+"
    r"(?:should|must|are required to)\s+(?:submit|provide|upload)\b",
    re.IGNORECASE,
)
SCHOLARSHIP_SUBSTANCE_RE = re.compile(
    r"\b(?:eligible|eligibility|receive|award(?:ed)?|grants?|loans?|"
    r"assistantships?|fellowships?|covers?|tuition-free|"
    r"financial aid that|funding (?:is|available))\b",
    re.IGNORECASE,
)
CAREER_FALSE_PHRASE_RE = re.compile(
    r"\bgraduate work\b|\bgraduate students?.{0,80}\bwork\b",
    re.IGNORECASE,
)


def source_excerpt_is_safe(
    *,
    field_name: str,
    evidence: str,
    source_url: str,
    programme_degree: str | None = None,
    source_title: str | None = None,
) -> bool:
    """Check whether a quote is safe for citation-only product display."""
    evidence = evidence.strip()
    if (
        not source_url.startswith("https://")
        or len(evidence) < 20
        or "\ufffd" in evidence
    ):
        return False

    parsed = urlsplit(source_url)
    source_identity = f"{parsed.netloc}{parsed.path} {source_title or ''}"
    if OFF_SCOPE_SOURCE_RE.search(source_identity):
        return False
    if (
        field_name in ADMISSION_DOCUMENT_FIELDS
        and AID_SOURCE_RE.search(source_identity)
    ):
        return False
    if (
        programme_degree in {"master", "phd"}
        and UNDERGRADUATE_ONLY_RE.search(evidence)
    ):
        return False
    if (
        programme_degree == "bachelor"
        and GRADUATE_ONLY_RE.search(evidence)
    ):
        return False
    if field_name == "final_deadline" and not EXPLICIT_DATE_RE.search(
        evidence
    ):
        return False
    if (
        field_name == "required_documents"
        and not REQUIRED_DOCUMENT_SIGNAL_RE.search(evidence)
    ):
        return False
    if (
        field_name == "scholarships"
        and not SCHOLARSHIP_SUBSTANCE_RE.search(evidence)
    ):
        return False
    if (
        field_name == "career_outcomes"
        and CAREER_FALSE_PHRASE_RE.search(evidence)
    ):
        return False
    if (
        field_name == "admission_difficulty"
        and re.search(r"\btransfer\b", evidence, re.IGNORECASE)
    ):
        return False
    return True
