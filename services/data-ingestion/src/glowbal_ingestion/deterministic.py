from __future__ import annotations

import re
from typing import Any

from .extraction_provider import ExtractionSource
from .models import (
    FieldAssertion,
    VerificationStatus,
    stable_id,
    utc_now_iso,
)
from .parsing import normalize_text
from .source_excerpt_safety import source_excerpt_is_safe


STATUS_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "paused",
        re.compile(
            r"\b(?:(?:admissions?|applications?)"
            r"(?:\s+to\s+(?:this|the)\s+(?:course|programme|program))?\s+"
            r"(?:are|is|have\s+been)\s+"
            r"paused|(?:course|programme|program)\s+(?:is|has\s+been)\s+paused)"
            r"(?:\s+for(?:\s+the)?\s+"
            r"(?P<cycle>20\d{2}(?:[/-](?:20)?\d{2})?))?"
            r"[^.!?]*[.!?]?",
            re.IGNORECASE,
        ),
    ),
    (
        "suspended",
        re.compile(
            r"\b(?:this\s+)?(?:course|programme|program)\s+is\s+suspended"
            r"(?:\s+for\s+(?P<cycle>20\d{2})(?:[/-]\d{2,4})?\s+entry)?[^.!?]*[.!?]?",
            re.IGNORECASE,
        ),
    ),
    (
        "closed",
        re.compile(
            r"\b(?:applications?\s+(?:are|is)\s+(?:now\s+|currently\s+)?closed|"
            r"(?:course|programme|program)\s+is\s+closed)"
            r"(?:\s+for\s+(?P<cycle>20\d{2})(?:[/-]\d{2,4})?\s+entry)?"
            r"[^.!?]*[.!?]?",
            re.IGNORECASE,
        ),
    ),
    (
        "not_accepting_applications",
        re.compile(
            r"\b(?:not|no longer)\s+accepting\s+applications?"
            r"(?:\s+for\s+(?P<cycle>20\d{2})(?:[/-]\d{2,4})?)?"
            r"[^.!?]*[.!?]?",
            re.IGNORECASE,
        ),
    ),
    (
        "discontinued",
        re.compile(
            r"\b(?:this\s+)?(?:course|programme|program)\s+(?:has\s+been|is)\s+"
            r"(?:discontinued|withdrawn)[^.!?]*[.!?]?",
            re.IGNORECASE,
        ),
    ),
)
PROGRAMME_ENGLISH_LEVEL_RE = re.compile(
    r"For admission to this course, you must achieve the "
    r"(?P<level>standard|higher) university requirement in the appropriate "
    r"English language qualification\.",
    re.IGNORECASE,
)
IELTS_LEVEL_TABLE_RE = re.compile(
    r"IELTS\s*[–-]\s*Academic.{0,180}?Standard\s+Higher\s+"
    r"(?P<standard_overall>\d(?:\.\d)?)\s+overall\s+"
    r"\(minimum\s+(?P<standard_subscore>\d(?:\.\d)?)\s+in all elements\)\s+"
    r"(?P<higher_overall>\d(?:\.\d)?)\s+overall\s+"
    r"\(minimum\s+(?P<higher_subscore>\d(?:\.\d)?)\s+in all elements\)",
    re.IGNORECASE,
)
PROGRAMME_CAREER_PATH_RE = re.compile(
    r"\b(?:the|this)\s+(?:undergraduate\s+|graduate\s+)?"
    r"(?:program|programme|degree)\s+prepares\s+students\s+for\s+"
    r"careers?\s+in\s+[^.!?]{5,500}[.!?]",
    re.IGNORECASE,
)

# Discover Uni exposes the employment cards as labelled text rather than a
# machine-readable table in the static course route.  Keep the parser scoped
# to that provider and retain the source's own wording/periods; these regexes
# do not derive a programme cycle or turn an unlabeled percentage into a fact.
DISCOVER_UNI_EMPLOYMENT_CARD_RE = re.compile(
    r"(?P<percentage>\d{1,3})%\s+"
    r"go\s+on\s+to\s+work\s+and\s*/?\s*or\s+study\s+"
    r"(?P<period>\d+\s+months?\s+after\s+the\s+course)\s+for\s+"
    r"(?P<population>.+?graduates?\s+at\s+.+?)"
    r"(?=\s+(?:Graduate views|Student views|What graduates are doing|"
    r"Data for students graduating|Occupation types|$))",
    re.IGNORECASE,
)
DISCOVER_UNI_EMPLOYMENT_PERCENT_CARD_RE = re.compile(
    r"(?P<percentage>\d{1,3})%\s+of\s+the\s+students\s+"
    r"go\s+on\s+to\s+work\s+and\s*/?\s*or\s+study",
    re.IGNORECASE,
)
DISCOVER_UNI_OCCUPATION_SECTION_RE = re.compile(
    r"\bOccupation types\s+"
    r"(?P<period>\d+\s+months?\s+after\s+the\s+course)\b"
    r"(?P<section>.*?)(?=\bChart labels explained\b)",
    re.IGNORECASE | re.DOTALL,
)
DISCOVER_UNI_OCCUPATION_ROW_RE = re.compile(
    r"(?P<percentage>\d{1,3})%\s+"
    r"(?P<label>(?!of\b|those\b|data\b|source\b)"
    r"[A-Z][^%]*?)"
    r"(?=\s+\d{1,3}%|\s+Employed after finishing\b|\s*$)",
    re.IGNORECASE | re.DOTALL,
)
DISCOVER_UNI_OUTCOME_COHORT_RE = re.compile(
    r"\bData for\s+(?P<population>students graduating\s+20\d{2}-\d{2})\b"
    r"(?:\s+Source:\s+(?P<data_source>Graduate Outcomes survey))?",
    re.IGNORECASE,
)


SOURCE_EXCERPT_RULES: dict[
    str, tuple[re.Pattern[str], re.Pattern[str]]
] = {
    "recommendation_letters": (
        re.compile(
            r"\b(?:letters? of recommendation|recommendation letters?|"
            r"academic references?|professional references?|referees?)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:must|required|submit|provide|request|ask|need|"
            r"recommend(?:er|ation)|one|two|three|1|2|3)\b",
            re.IGNORECASE,
        ),
    ),
    "sop_essay_requirements": (
        re.compile(
            r"\b(?:statement of (?:purpose|objectives?)|personal statement|"
            r"motivation letter|application essays?|essay prompts?)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:must|required|submit|provide|write|describe|explain|"
            r"words?|pages?|prompt)\b",
            re.IGNORECASE,
        ),
    ),
    "graduation_certificate": (
        re.compile(
            r"\b(?:degree certificate|graduation certificate|diploma|"
            r"proof of (?:degree|graduation)|degree verification)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:must|required|submit|provide|upload|official|copy|proof)\b",
            re.IGNORECASE,
        ),
    ),
    "academic_transcript": (
        re.compile(
            r"\b(?:academic transcripts?|official transcripts?|"
            r"academic records?|mark sheets?)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:must|required|submit|provide|upload|official|unofficial|"
            r"copy|records?)\b",
            re.IGNORECASE,
        ),
    ),
    "required_documents": (
        re.compile(
            r"\b(?:required documents?|supporting documents?|"
            r"application materials?|application checklist)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:must|required)\b|\bapplicants?\s+"
            r"(?:should|must|are required to)\s+(?:submit|provide|upload)\b",
            re.IGNORECASE,
        ),
    ),
    "tuition": (
        re.compile(
            r"\b(?:tuition|cost of attendance|programme? cost|program cost|"
            r"cost per credit|tuition rate)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:[$Â£â‚¬]|\b(?:USD|GBP|EUR|CAD|AUD)\b|\bper\s+"
            r"(?:credit|year|semester|term)|\btuition\s+(?:is|for|rate|cost))",
            re.IGNORECASE,
        ),
    ),
    "final_deadline": (
        re.compile(
            r"\b(?:final deadline|application deadline|applications? "
            r"(?:are\s+)?due|deadline to apply)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b20\d{2}\b|\b(?:January|February|March|April|May|June|July|"
            r"August|September|October|November|December)\s+\d{1,2}\b|"
            r"\b\d{1,2}\s+(?:January|February|March|April|May|June|July|"
            r"August|September|October|November|December)\b|\brolling\b|"
            r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
            re.IGNORECASE,
        ),
    ),
    "ielts_overall": (
        re.compile(r"\bIELTS\b", re.IGNORECASE),
        re.compile(
            r"\b(?:minimum|required|score|band|waiver|waived|exempt|accept)\w*\b",
            re.IGNORECASE,
        ),
    ),
    "toefl": (
        re.compile(r"\bTOEFL\b", re.IGNORECASE),
        re.compile(
            r"\b(?:minimum|required|score|waiver|waived|exempt|accept)\w*\b",
            re.IGNORECASE,
        ),
    ),
    "scholarships": (
        re.compile(
            r"\b(?:scholarships?|fellowships?|financial aid|"
            r"funding opportunities?|assistantships?)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:eligible|eligibility|award|apply|available|receive|"
            r"funding|support|amount|need-based|merit-based)\b",
            re.IGNORECASE,
        ),
    ),
    "career_outcomes": (
        re.compile(
            r"\b(?:career paths?|career outcomes?|employment outcomes?|"
            r"graduates? (?:work|enter|pursue|go on)|alumni (?:work|careers?))\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:career|employment|employers?|roles?|jobs?|work|industry|"
            r"graduates?|alumni)\b",
            re.IGNORECASE,
        ),
    ),
    "admission_difficulty": (
        re.compile(
            r"\b(?:highly selective|selective admissions?|"
            r"competitive admissions?|acceptance rate|admit rate)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:selective|competitive|acceptance|admit|applicants?|admitted)\b",
            re.IGNORECASE,
        ),
    ),
}


SOURCE_EXCERPT_PAGE_PRIORITY: dict[str, tuple[str, ...]] = {
    "recommendation_letters": ("programme_admission", "pdf"),
    "sop_essay_requirements": ("programme_admission", "pdf"),
    "graduation_certificate": ("programme_admission", "pdf"),
    "academic_transcript": ("programme_admission", "pdf"),
    "required_documents": ("programme_admission", "pdf"),
    "tuition": ("tuition", "programme_admission", "pdf"),
    "final_deadline": ("deadline", "programme_admission", "pdf"),
    "ielts_overall": (
        "english_requirement",
        "international_admission",
        "programme_admission",
    ),
    "toefl": (
        "english_requirement",
        "international_admission",
        "programme_admission",
    ),
    "scholarships": ("scholarship", "programme_admission", "pdf"),
    "career_outcomes": ("career_outcome", "programme_overview"),
    "admission_difficulty": ("programme_admission", "programme_overview"),
}
def _source_excerpt(
    text: str,
    keyword: re.Pattern[str],
    supporting_signal: re.Pattern[str],
) -> str | None:
    normalized = normalize_text(text)
    for match in keyword.finditer(normalized):
        left_boundary = max(
            normalized.rfind(". ", max(0, match.start() - 320), match.start()),
            normalized.rfind("? ", max(0, match.start() - 320), match.start()),
            normalized.rfind("! ", max(0, match.start() - 320), match.start()),
        )
        start = left_boundary + 2 if left_boundary >= 0 else max(
            0, match.start() - 180
        )
        right_candidates = [
            index + 1
            for token in (". ", "? ", "! ")
            if (index := normalized.find(token, match.end(), match.end() + 420))
            >= 0
        ]
        end = min(right_candidates) if right_candidates else min(
            len(normalized), match.end() + 280
        )
        excerpt = normalize_text(normalized[start:end]).strip(" -|:")
        if "\ufffd" in excerpt:
            continue
        if len(excerpt) < 45 or len(excerpt.split()) < 7:
            continue
        if len(excerpt) > 600:
            excerpt = excerpt[:600].rsplit(" ", 1)[0].rstrip(" ,;:")
        if not supporting_signal.search(excerpt):
            continue
        if re.fullmatch(
            r"(?i)(?:click here|learn more|read more|view|visit|see)\W+.{0,80}",
            excerpt,
        ):
            continue
        return excerpt
    return None


def extract_source_excerpt_assertions(
    *,
    entity_id: str,
    sources: list[ExtractionSource],
    field_names: tuple[str, ...],
    extractor_version: str,
    programme_degree: str | None = None,
) -> list[FieldAssertion]:
    """Preserve useful official prose without treating it as structured data.

    These assertions are always NEEDS_REVIEW and carry a validation marker,
    so product export may show the exact quote and URL but can never use the
    excerpt for eligibility or automatic filtering.
    """
    assertions: list[FieldAssertion] = []
    for field_name in field_names:
        rule = SOURCE_EXCERPT_RULES.get(field_name)
        if not rule:
            continue
        page_priority = SOURCE_EXCERPT_PAGE_PRIORITY.get(field_name, ())
        ordered_sources = sorted(
            enumerate(sources),
            key=lambda item: (
                page_priority.index(item[1].page_type)
                if item[1].page_type in page_priority
                else len(page_priority),
                item[0],
            ),
        )
        for source_index, source in ordered_sources:
            if not source.url.startswith("https://"):
                continue
            # Structured external materializers append declarative mapping
            # guidance for the semantic extractor.  It is not source data and
            # must never become a review quote when the mapped field is empty.
            # Keep all other source text unchanged for the existing bounded
            # excerpt rules.
            excerpt_text = "\n".join(
                line
                for line in (source.text or "").splitlines()
                if not line.lstrip().startswith("Source mapping context:")
            )
            evidence = _source_excerpt(excerpt_text, *rule)
            if not evidence:
                continue
            if not source_excerpt_is_safe(
                field_name=field_name,
                evidence=evidence,
                source_url=source.url,
                programme_degree=programme_degree,
                source_title=source.title,
            ):
                continue
            scope = (
                "programme"
                if source_index == 0
                or source.page_type == "programme_overview"
                else "unknown"
            )
            assertions.append(
                FieldAssertion(
                    assertion_id=stable_id(
                        "assertion-source-excerpt",
                        entity_id,
                        field_name,
                        source.url,
                        evidence,
                    ),
                    entity_type="programme",
                    entity_id=entity_id,
                    field_name=field_name,
                    value_json=evidence,
                    null_reason=None,
                    source_url=source.url,
                    source_type=source.page_type,
                    evidence=evidence,
                    evidence_locator=None,
                    scope=scope,
                    audience=(
                        "international"
                        if field_name in {"ielts_overall", "toefl"}
                        else "all"
                    ),
                    academic_cycle=None,
                    retrieved_at=utc_now_iso(),
                    confidence=0.65,
                    verification_status=VerificationStatus.NEEDS_REVIEW,
                    extractor_version=extractor_version,
                    model_name="deterministic-source-excerpt-v4",
                    validation_errors=["SOURCE_EXCERPT_ONLY"],
                    extraction_group="source_excerpt_fallback",
                    applicability_source_url=None,
                    applicability_evidence=None,
                    source_content_hash=source.content_hash,
                    raw_document_id=source.raw_document_id,
                    parser_id=source.parser_id,
                    parser_version=source.parser_version,
                    review_fingerprint=None,
                    inherited_from_assertion_id=None,
                    inherited_from_entity_id=None,
                    inheritance_key=None,
                )
            )
            break
    return assertions


def _source_fact_provenance(source: ExtractionSource) -> dict[str, Any]:
    """Copy the exact raw/source lineage onto deterministic external facts."""
    provenance: dict[str, Any] = {
        "_raw_document_id": source.raw_document_id,
        "_parser_id": source.parser_id,
        "_parser_version": source.parser_version,
        "_dataset_id": source.dataset_id,
        "_acquisition_run_id": source.acquisition_run_id,
        "_source_authority": source.source_authority,
        "_source_relationship": source.source_relationship,
        "_temporal_state": source.temporal_state,
    }
    if source.provider_id:
        provenance["_provider_id"] = source.provider_id
    return provenance


def _discover_uni_outcome_context(
    text: str,
    *,
    start: int,
    end: int,
) -> tuple[str | None, str | None]:
    """Find source-labelled cohort metadata adjacent to an outcome card."""
    context = text[max(0, start - 500) : min(len(text), end + 1800)]
    matches = list(DISCOVER_UNI_OUTCOME_COHORT_RE.finditer(context))
    if not matches:
        return None, None
    # Prefer the first labelled cohort after the card.  Discover Uni repeats
    # the same card metadata elsewhere on the page, so nearest-after is more
    # precise than a document-wide search.
    relative_end = end - max(0, start - 500)
    after = [match for match in matches if match.start() >= relative_end]
    match = after[0] if after else matches[-1]
    population = normalize_text(match.group("population"))
    data_source = (
        normalize_text(match.group("data_source"))
        if match.group("data_source")
        else None
    )
    return population or None, data_source or None


def _discover_uni_outcome_period(
    text: str,
    *,
    start: int,
    end: int,
    explicit: str | None = None,
) -> str | None:
    if explicit:
        return normalize_text(explicit)
    context = text[max(0, start - 500) : min(len(text), end + 1800)]
    match = re.search(
        r"\b\d+\s+months?\s+after\s+the\s+course\b",
        context,
        re.IGNORECASE,
    )
    return normalize_text(match.group(0)) if match else None


def _discover_uni_employment_fact(
    *,
    source: ExtractionSource,
    evidence: str,
    percentage: str,
    period: str | None,
    population: str | None,
    data_source: str | None,
    metric: str,
    occupation: str | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "metric": metric,
        "percentage": int(percentage),
    }
    if period:
        value["period"] = period
    if population:
        value["population"] = population
    if data_source:
        value["data_source"] = data_source
    if occupation:
        value["occupation"] = occupation
    return {
        **_source_fact_provenance(source),
        "field_name": "employment_outcomes",
        "value": value,
        "source_url": source.url,
        "source_type": source.page_type,
        "evidence": evidence,
        "scope": "programme",
        "audience": "all",
        # Discover Uni labels survey cohorts/outcome periods, not a
        # programme academic cycle.  Leave this explicitly unknown.
        "academic_cycle": None,
        "confidence": 1.0,
        "_group": "deterministic_employment",
    }


def _extract_discover_uni_employment_facts(
    source: ExtractionSource,
) -> list[dict[str, Any]]:
    """Extract the literal employment cards from one Discover Uni snapshot."""
    if source.provider_id != "discover_uni_hesa" or source.page_type != "programme_overview":
        return []
    text = normalize_text(source.text or "")
    if not text:
        return []
    facts: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    for match in DISCOVER_UNI_EMPLOYMENT_CARD_RE.finditer(text):
        evidence = normalize_text(match.group(0))
        # The course-summary card is followed by unrelated NSS cards before
        # the Graduate Outcomes metadata appears.  Its programme-qualified
        # population is explicit in the card itself, so do not attach the
        # nearest (and potentially unrelated) cohort to it.
        cohort, data_source = None, None
        period = _discover_uni_outcome_period(
            text,
            start=match.start(),
            end=match.end(),
            explicit=match.group("period"),
        )
        population = normalize_text(match.group("population"))
        if cohort:
            # Keep the source-qualified programme population as the claim and
            # the survey cohort in a separate, source-native context key.
            value_fact = _discover_uni_employment_fact(
                source=source,
                evidence=evidence,
                percentage=match.group("percentage"),
                period=period,
                population=population,
                data_source=data_source,
                metric="work_and_or_study",
            )
            value_fact["value"]["cohort"] = cohort
        else:
            value_fact = _discover_uni_employment_fact(
                source=source,
                evidence=evidence,
                percentage=match.group("percentage"),
                period=period,
                population=population,
                data_source=data_source,
                metric="work_and_or_study",
            )
        key = (source.url, "summary", evidence)
        if key not in seen:
            seen.add(key)
            facts.append(value_fact)

    for match in DISCOVER_UNI_EMPLOYMENT_PERCENT_CARD_RE.finditer(text):
        evidence = normalize_text(match.group(0))
        cohort, data_source = _discover_uni_outcome_context(
            text,
            start=match.start(),
            end=match.end(),
        )
        period = _discover_uni_outcome_period(
            text,
            start=match.start(),
            end=match.end(),
        )
        # The card's own nearby ``Data for`` line is the only population
        # representation available when the programme-qualified sentence is
        # not repeated in that card.
        key = (source.url, "summary", evidence)
        if key in seen:
            continue
        seen.add(key)
        facts.append(
            _discover_uni_employment_fact(
                source=source,
                evidence=evidence,
                percentage=match.group("percentage"),
                period=period,
                population=cohort,
                data_source=data_source,
                metric="go_on_to_work_and_or_study",
            )
        )

    occupation_section = DISCOVER_UNI_OCCUPATION_SECTION_RE.search(text)
    if occupation_section:
        section = occupation_section.group("section")
        period = normalize_text(occupation_section.group("period"))
        cohort, data_source = _discover_uni_outcome_context(
            text,
            start=occupation_section.start(),
            end=occupation_section.end(),
        )
        for match in DISCOVER_UNI_OCCUPATION_ROW_RE.finditer(section):
            evidence = normalize_text(match.group(0))
            label = normalize_text(match.group("label")).strip(" -:;,.|")
            if not label:
                continue
            lowered = label.casefold()
            if lowered == "in highly skilled work":
                metric = "in_highly_skilled_work"
                occupation = None
            elif lowered == "in other work":
                metric = "in_other_work"
                occupation = None
            elif lowered == "in unknown work":
                metric = "in_unknown_work"
                occupation = None
            else:
                metric = "occupation"
                occupation = label
            key = (source.url, "occupation", evidence)
            if key in seen:
                continue
            seen.add(key)
            facts.append(
                _discover_uni_employment_fact(
                    source=source,
                    evidence=evidence,
                    percentage=match.group("percentage"),
                    period=period,
                    population=cohort,
                    data_source=data_source,
                    metric=metric,
                    occupation=occupation,
                )
            )
    return facts


def extract_deterministic_facts(
    sources: list[ExtractionSource],
) -> list[dict[str, Any]]:
    """Extract only high-precision facts that are safer than an LLM guess."""
    facts: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str | None]] = set()
    for index, source in enumerate(sources):
        if index != 0 and source.page_type not in {
            "programme_overview",
            "programme_admission",
            "catalogue",
            "pdf",
        }:
            continue
        for status, pattern in STATUS_PATTERNS:
            for match in pattern.finditer(source.text):
                evidence = normalize_text(match.group(0))
                cycle = match.groupdict().get("cycle")
                key = (source.url, status, cycle)
                if not evidence or key in seen:
                    continue
                seen.add(key)
                facts.append(
                    {
                        "field_name": "programme_status",
                        "value": status,
                        "source_url": source.url,
                        "source_type": source.page_type,
                        "evidence": evidence,
                        "scope": "programme",
                        "audience": "all",
                        "academic_cycle": cycle,
                        "confidence": 1.0,
                        "_group": "deterministic_status",
                    }
                )
        facts.extend(_extract_discover_uni_employment_facts(source))
        if source.page_type == "programme_overview":
            for match in PROGRAMME_CAREER_PATH_RE.finditer(source.text):
                evidence = normalize_text(match.group(0))
                key = (source.url, "career_outcomes", evidence)
                if not evidence or key in seen:
                    continue
                seen.add(key)
                facts.append(
                    {
                        "field_name": "career_outcomes",
                        "value": {"description": evidence},
                        "source_url": source.url,
                        "source_type": source.page_type,
                        "evidence": evidence,
                        "scope": "programme",
                        "audience": "all",
                        "academic_cycle": None,
                        "confidence": 1.0,
                        "_group": "deterministic_career",
                    }
                )
    if sources:
        applicability_match = PROGRAMME_ENGLISH_LEVEL_RE.search(
            sources[0].text
        )
        if applicability_match:
            level = applicability_match.group("level").casefold()
            english_source = next(
                (
                    source
                    for source in sources[1:]
                    if source.page_type == "english_requirement"
                ),
                None,
            )
            table_match = (
                IELTS_LEVEL_TABLE_RE.search(english_source.text)
                if english_source
                else None
            )
            if english_source and table_match:
                overall = float(
                    table_match.group(f"{level}_overall")
                )
                subscore = float(
                    table_match.group(f"{level}_subscore")
                )
                overall_evidence = (
                    f"{overall:.1f} overall "
                    f"(minimum {subscore:.1f} in all elements)"
                )
                subscore_evidence = (
                    f"minimum {subscore:.1f} in all elements"
                )
                applicability_evidence = normalize_text(
                    applicability_match.group(0)
                )
                for field_name, value, evidence in (
                    ("ielts_overall", overall, overall_evidence),
                    ("ielts_subscores", subscore, subscore_evidence),
                ):
                    facts.append(
                        {
                            "field_name": field_name,
                            "value": value,
                            "source_url": english_source.url,
                            "source_type": english_source.page_type,
                            "evidence": evidence,
                            "scope": "institution",
                            "audience": "all",
                            "academic_cycle": None,
                            "confidence": 1.0,
                            "applicability_source_url": sources[0].url,
                            "applicability_evidence": (
                                applicability_evidence
                            ),
                            "_group": "deterministic_language",
                        }
                    )
    return facts
