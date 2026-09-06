from __future__ import annotations

import re
from dataclasses import replace
from urllib.parse import unquote, urlsplit

from .config import ProgrammePriority
from .discovery import ProgrammeCandidate
from .models import ProgrammeRecord, VerificationStatus, stable_id, utc_now_iso


DEGREE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "phd",
        re.compile(
            r"\b(phd|dphil|dnp|edd|dba|doctor(?:al|ate)?|research degree)\b",
            re.I,
        ),
    ),
    (
        "master",
        re.compile(
            r"\b(master'?s?|msc|m\.?s\.?|sm|ma|march|masc|mfin|mcp|"
            r"meng|mba|mph|llm|postgraduate taught)\b",
            re.I,
        ),
    ),
    (
        "bachelor",
        re.compile(
            r"\b(bachelor'?s?|bsc|b\.?s\.?|sb|ba|beng|undergraduate|major)\b",
            re.I,
        ),
    ),
)


FIELD_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("computer_science", re.compile(r"\b(computer science|computing)\b", re.I)),
    ("artificial_intelligence", re.compile(r"\b(artificial intelligence|ai)\b", re.I)),
    ("data_science", re.compile(r"\b(data science|analytics)\b", re.I)),
    ("engineering", re.compile(r"\b(engineering|meng|beng)\b", re.I)),
    ("business", re.compile(r"\b(business|management|mba)\b", re.I)),
    ("finance_economics", re.compile(r"\b(finance|economics|accounting)\b", re.I)),
    ("health", re.compile(r"\b(medicine|health|biotechnology|biomedical)\b", re.I)),
    ("public_policy", re.compile(r"\b(public policy|government|politics)\b", re.I)),
    ("sustainability", re.compile(r"\b(sustainability|environmental)\b", re.I)),
    ("education", re.compile(r"\b(education|teaching)\b", re.I)),
)
PRIORITY_STOPWORDS = frozenset(
    {
        "and",
        "general",
        "other",
        "program",
        "programme",
        "programs",
        "programmes",
        "the",
    }
)
GENERIC_SINGLE_PRIORITY_TOKENS = frozenset(
    {
        "business",
        "education",
        "engineering",
        "health",
        "science",
        "studies",
    }
)
NON_DEGREE_PROGRAMME_NAME_RE = re.compile(
    r"(?:"
    r"\bworkshops?\b|"
    r"(?<!and )\bminor\b|"
    r"\badditional (?:major|minor)\b|"
    r"\bapplication (?:form|information|instructions?)\b|"
    r"\bapply for\b|"
    r"\bdouble major\b|"
    r"\b(?:academic[- ]year|research|summer) opportunities\b|"
    r"\b(?:fellowship|internship|pre[- ]college|summer school)\b|"
    r"\bscholars? program\b|"
    r"\bvisiting students?\b|"
    r"\b(?:core institute|graduation) requirements?\b|"
    r"\bother first[- ]year courses?\b|"
    r"\btypical first[- ]year course schedule\b|"
    r"^master(?:['\u2019])?s studies$|"
    r"\bchecklist and timeline\b|"
    r"\b(?:communication )?resources for .+ students\b|"
    r"^admitted students$|"
    r"^application process(?:,|$)|"
    r"^curriculum,? course sequence,? (?:&|and) degree requirements$|"
    r"^faqs?$|"
    r"^education:\s*(?:master'?s?|doctoral|undergraduate)\b"
    r")",
    re.IGNORECASE,
)
NON_DEGREE_PROGRAMME_PATH_RE = re.compile(
    r"/(?:"
    r"application(?:-information)?|apply|forms?|"
    r"degree-requirements|additional-major|additional-minor|"
    r"undergraduate-research|pre-college|summer-programs?|"
    r"internships?|fellowships?|opportunities|"
    r"academic-policies|professional-development|past-workshops"
    r")(?:/|$)",
    re.IGNORECASE,
)
NON_DEGREE_PATH_TOKEN_RE = re.compile(
    r"(?:^|[-_/])(?:minor|workshop)s?(?:[-_/]|$)",
    re.IGNORECASE,
)
COMBINED_DEGREE_MINOR_PATH_RE = re.compile(
    r"(?:option|major)[-_]and[-_]minor",
    re.IGNORECASE,
)
PROGRAMME_INDEX_PATH_RE = re.compile(
    r"/(?:undergraduate|graduate|postgraduate|masters?|doctoral)"
    r"[-_]program(?:me)?s/?$",
    re.IGNORECASE,
)
GENERIC_LINK_NAME_RE = re.compile(
    r"^(?:"
    r"learn|read|view|find out|discover|explore"
    r")\s+(?:more\s+)?(?:about\s+)?(?:the\s+|our\s+)?"
    r"(?:major|degree|course|program(?:me)?|"
    r"bachelor'?s? program(?:me)?|master'?s? program(?:me)?)s?$",
    re.IGNORECASE,
)
GENERIC_PROGRAMME_NAME_RE = re.compile(
    r"^(?:index|prospective students?|"
    r"(?:undergraduate|graduate|postgraduate|master'?s?|doctoral)"
    r"\s+program(?:me)?s)$",
    re.IGNORECASE,
)
REFINABLE_PROGRAMME_NAME_RE = re.compile(
    r"^(?:undergraduate|graduate|postgraduate|master'?s?|doctoral)"
    r"\s+program(?:me)?$",
    re.IGNORECASE,
)
AGGREGATE_PROGRAMMES_NAME_RE = re.compile(
    r"\bprogram(?:me)?s\b",
    re.IGNORECASE,
)
AGGREGATE_ACADEMIC_UNIT_NAME_RE = re.compile(
    r"^(?:"
    r"(?:college|faculty|school|department|division)\s+of\b|"
    r".+\s+(?:college|faculty|school)$"
    r")",
    re.IGNORECASE,
)


def slug_to_name(url: str) -> str:
    path = unquote(urlsplit(url).path).strip("/")
    slug = path.rsplit("/", 1)[-1] if path else urlsplit(url).hostname or "Programme"
    slug = re.sub(r"\.(?:html?|aspx?)$", "", slug, flags=re.I)
    slug = re.sub(r"[-_]+", " ", slug)
    slug = re.sub(
        r"\b(?:bsc|msc|phd|ba|bs|sb|ms|sm|ma)\b$", "", slug, flags=re.I
    )
    slug = re.sub(r"\s+", " ", slug).strip()
    return slug.title() if slug else "Programme"


def clean_programme_name(name_hint: str | None, url: str) -> str:
    candidate = re.sub(r"\s+", " ", name_hint or "").strip(" \t\r\n-|")
    candidate = (
        candidate
        .replace("\u00e2\u20ac\u201d", "\u2014")
        .replace("\u00e2\u20ac\u201c", "\u2013")
        .replace("\u00e2\u20ac\u2122", "\u2019")
    )
    candidate = re.sub(
        r"\b(Master|Bachelor)\ufffds\b",
        lambda match: f"{match.group(1)}'s",
        candidate,
        flags=re.IGNORECASE,
    )
    candidate = re.sub(
        r"\s*\(\s*opens?\s+in\s+(?:a\s+)?new\s+window\s*\)\s*$",
        "",
        candidate,
        flags=re.IGNORECASE,
    ).strip()
    generic_names = {
        "admissions",
        "home",
        "learn more",
        "read more",
        "view course",
        "view program",
        "view programme",
        "view program details",
        "view programme details",
    }
    if (
        len(candidate) < 3
        or len(candidate) > 180
        or candidate.casefold() in generic_names
        or GENERIC_LINK_NAME_RE.fullmatch(candidate)
    ):
        candidate = slug_to_name(url)
    candidate = re.sub(
        r"\s*[|–—-]\s*(MIT|Stanford|Oxford|University.*)$",
        "",
        candidate,
        flags=re.I,
    ).strip()
    return candidate or slug_to_name(url)


def infer_degree(name: str, url: str) -> str | None:
    path = unquote(urlsplit(url).path)
    if re.search(
        r"(?:"
        r"(?:^|[-_/])undergraduate(?:[-_/]|$)|"
        r"/majors?[-_](?:programs?|concentrations?)(?:/|$)|"
        r"/general-studies/majors?[-_]concentrations?(?:/|$)|"
        r"/columbia-college/departments?[-_]instruction(?:/|$)|"
        r"/ycps/subjects-of-instruction/"
        r")",
        path,
        re.IGNORECASE,
    ):
        return "bachelor"
    safe_name = re.sub(r"\bMs\.?\s+(?=[A-Z])", "", name)
    for degree, pattern in DEGREE_PATTERNS:
        if pattern.search(safe_name):
            return degree
    normalized_url = url.lower().replace("-", " ").replace("_", " ")
    url_patterns = (
        ("phd", re.compile(r"\b(phd|dphil|doctoral|doctorate)\b")),
        (
            "master",
            re.compile(
                r"\b(master|masters|msc|meng|mba|mph|llm|postgraduate)\b"
            ),
        ),
        (
            "bachelor",
            re.compile(r"\b(bachelor|bachelors|bsc|beng|undergraduate)\b"),
        ),
    )
    for degree, pattern in url_patterns:
        if pattern.search(normalized_url):
            return degree
    if (
        re.search(r"\bcourse\s+\d+[a-z]?(?:\s+\d+[a-z]?)?\b", safe_name, re.I)
        or re.search(
            r"/degree-charts/[^/]*(?:^|-)course-\d",
            urlsplit(url).path,
            re.I,
        )
    ):
        return "bachelor"
    return None


def infer_credential(
    name: str,
    url: str,
    degree_level: str | None = None,
) -> str | None:
    tokens = (
        "DPhil",
        "PhD",
        "DNP",
        "EdD",
        "DBA",
        "MBA",
        "MEng",
        "MArch",
        "MASc",
        "MFin",
        "MCP",
        "MSc",
        "MA",
        "MS",
        "SM",
        "MPH",
        "LLM",
        "BEng",
        "BSc",
        "BA",
        "BS",
        "SB",
    )
    credential_degrees = {
        "DPhil": "phd",
        "PhD": "phd",
        "DNP": "phd",
        "EdD": "phd",
        "DBA": "phd",
        "MBA": "master",
        "MEng": "master",
        "MArch": "master",
        "MASc": "master",
        "MFin": "master",
        "MCP": "master",
        "MSc": "master",
        "MA": "master",
        "MS": "master",
        "SM": "master",
        "MPH": "master",
        "LLM": "master",
        "BEng": "bachelor",
        "BSc": "bachelor",
        "BA": "bachelor",
        "BS": "bachelor",
        "SB": "bachelor",
    }
    for token in tokens:
        if (
            degree_level is not None
            and credential_degrees[token] != degree_level
        ):
            continue
        if re.search(rf"\b{re.escape(token)}\b", name):
            return token
        normalized_url = url.lower().replace("-", " ").replace("_", " ")
        unambiguous_url_tokens = {
            "DPhil",
            "PhD",
            "DNP",
            "EdD",
            "DBA",
            "MBA",
            "MEng",
            "MSc",
            "MPH",
            "LLM",
            "BEng",
            "BSc",
        }
        if (
            token in unambiguous_url_tokens
            and re.search(rf"\b{re.escape(token.lower())}\b", normalized_url)
        ):
            return token
    return None


def infer_degree_from_source_text(
    text: str,
) -> tuple[str | None, str | None]:
    """Infer a programme degree only from explicit page-level evidence.

    This is intentionally narrower than ``infer_degree``.  It is used for
    catalogue cards whose link label omits the credential, so generic school
    footer copy must not turn every programme into a master's degree.
    """
    normalized = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        return None, None

    offered = re.search(r"\bdegrees? offered\b", normalized, re.I)
    if offered:
        evidence = normalized[offered.end() : offered.end() + 700]
    else:
        evidence = normalized[:2500]

    signals: tuple[tuple[str, str, re.Pattern[str]], ...] = (
        (
            "bachelor",
            "BS",
            re.compile(
                r"\b(?:bachelor of|bachelor'?s (?:degree|program)|"
                r"undergraduate degree|B\.?S\.?|B\.?A\.?|S\.?B\.?)\b",
                re.I,
            ),
        ),
        (
            "master",
            "MS",
            re.compile(
                r"\b(?:master of|master'?s (?:degree|program)|"
                r"M\.?S\.?|S\.?M\.?|M\.?E\.?|MEng|MBA|MPH|LLM)\b",
                re.I,
            ),
        ),
        (
            "phd",
            "PhD",
            re.compile(
                r"\b(?:doctor of philosophy|doctoral (?:degree|program)|"
                r"Ph\.?D\.?)\b",
                re.I,
            ),
        ),
    )
    matches = [
        (match.start(), degree, credential)
        for degree, credential, pattern in signals
        if (match := pattern.search(evidence)) is not None
    ]
    if not matches:
        return None, None
    _, degree, fallback_credential = min(matches, key=lambda item: item[0])
    credential = infer_credential(evidence, "", degree_level=degree)
    return degree, credential or fallback_credential


def infer_field(name: str) -> str | None:
    for field_name, pattern in FIELD_PATTERNS:
        if pattern.search(name):
            return field_name
    return None


def candidate_to_programme(
    institution_id: str, candidate: ProgrammeCandidate
) -> ProgrammeRecord:
    name = clean_programme_name(candidate.name_hint, candidate.url)
    degree = infer_degree(name, candidate.url)
    # A manually supplied URL is a crawl target, not evidence of its award.
    # Keep degree inference for bounded deep-selection eligibility, but do not
    # turn URL/name hints into a canonical credential without page evidence.
    credential = (
        None
        if candidate.catalogue_source == "user_supplied"
        else infer_credential(name, candidate.url, degree_level=degree)
    )
    return ProgrammeRecord(
        programme_id=stable_id("programme", institution_id, candidate.url),
        institution_id=institution_id,
        programme_name=name,
        official_url=candidate.url,
        degree_level=degree,
        credential=credential,
        normalized_field=infer_field(name),
        organisation_unit_id=None,
        language=None,
        campus=None,
        delivery_mode=None,
        duration=None,
        programme_status=None,
        catalogue_source=candidate.catalogue_source,
        retrieved_at=utc_now_iso(),
        verification_status=VerificationStatus.DISCOVERED,
    )


def refine_programme_name_from_title(
    programme: ProgrammeRecord,
    title: str | None,
) -> ProgrammeRecord:
    if (
        not title
        or not REFINABLE_PROGRAMME_NAME_RE.fullmatch(
            programme.programme_name.strip()
        )
    ):
        return programme
    cleaned_title = clean_programme_name(
        title,
        programme.official_url,
    )
    title_parts = [
        part.strip()
        for part in cleaned_title.split("|")
        if part.strip()
    ]
    for part in title_parts:
        if REFINABLE_PROGRAMME_NAME_RE.fullmatch(part):
            continue
        unit_match = re.search(
            r"\b(?:school|college|faculty|department)\s+of\s+(.+)$",
            part,
            re.IGNORECASE,
        )
        if unit_match:
            return replace(
                programme,
                programme_name=(
                    f"{unit_match.group(1).strip()} "
                    f"{programme.programme_name}"
                ),
            )
    if (
        cleaned_title
        and not REFINABLE_PROGRAMME_NAME_RE.fullmatch(cleaned_title)
    ):
        return replace(programme, programme_name=cleaned_title)
    return programme


def programme_is_selection_eligible(
    programme: ProgrammeRecord,
) -> bool:
    if programme.catalogue_source == "user_supplied":
        return True
    if programme.degree_level not in {"bachelor", "master", "phd"}:
        return False
    if NON_DEGREE_PROGRAMME_NAME_RE.search(
        programme.programme_name
    ):
        return False
    if NON_DEGREE_PROGRAMME_PATH_RE.search(
        urlsplit(programme.official_url).path
    ):
        return False
    programme_path = urlsplit(programme.official_url).path
    if (
        NON_DEGREE_PATH_TOKEN_RE.search(programme_path)
        and not COMBINED_DEGREE_MINOR_PATH_RE.search(programme_path)
    ):
        return False
    if PROGRAMME_INDEX_PATH_RE.search(
        urlsplit(programme.official_url).path
    ):
        return False
    if GENERIC_PROGRAMME_NAME_RE.fullmatch(
        programme.programme_name.strip()
    ):
        return False
    if (
        programme.credential is None
        and AGGREGATE_PROGRAMMES_NAME_RE.search(
            programme.programme_name
        )
    ):
        return False
    if AGGREGATE_ACADEMIC_UNIT_NAME_RE.search(
        programme.programme_name.strip()
    ):
        return False
    return True


def _priority_tokens(value: str) -> tuple[str, ...]:
    normalized = re.sub(r"[^a-z0-9]+", " ", value.casefold())
    tokens: list[str] = []
    for raw_token in normalized.split():
        if raw_token in PRIORITY_STOPWORDS:
            continue
        token = (
            raw_token[:-1]
            if raw_token.endswith("s") and len(raw_token) > 4
            else raw_token
        )
        if token not in PRIORITY_STOPWORDS:
            tokens.append(token)
    return tuple(dict.fromkeys(tokens))


def programme_priority_match_score(
    programme_name: str,
    priority_label: str,
) -> float:
    programme_tokens = set(_priority_tokens(programme_name))
    priority_tokens = set(_priority_tokens(priority_label))
    if not programme_tokens or not priority_tokens:
        return 0.0
    if programme_tokens == priority_tokens:
        return 1.0
    if len(priority_tokens) == 1:
        token = next(iter(priority_tokens))
        if token in GENERIC_SINGLE_PRIORITY_TOKENS:
            return 0.0
        return 0.9 if token in programme_tokens else 0.0
    overlap = len(programme_tokens & priority_tokens)
    overlap_coefficient = overlap / min(
        len(programme_tokens), len(priority_tokens)
    )
    if overlap < 2 or overlap_coefficient < 0.6:
        return 0.0
    return round(overlap_coefficient, 4)


def programme_selection_identity(
    programme: ProgrammeRecord,
) -> tuple[str, str, str]:
    normalized_name = re.sub(
        r"[^a-z0-9]+",
        " ",
        programme.programme_name.casefold(),
    )
    return (
        programme.degree_level or "unknown",
        " ".join(normalized_name.split()),
        (programme.credential or "").casefold(),
    )


def apply_programme_priorities(
    programmes: list[ProgrammeRecord],
    priorities: tuple[ProgrammePriority, ...],
) -> list[ProgrammeRecord]:
    if not priorities:
        return programmes
    enriched: list[ProgrammeRecord] = []
    for programme in programmes:
        matches: list[tuple[ProgrammePriority, float, int]] = []
        for priority in priorities:
            score = programme_priority_match_score(
                programme.programme_name,
                priority.label,
            )
            if score <= 0:
                continue
            matches.append(
                (
                    priority,
                    score,
                    priority.completions_for_degree(
                        programme.degree_level
                    ),
                )
            )
        if not matches:
            enriched.append(programme)
            continue
        priority, score, degree_completions = min(
            matches,
            key=lambda item: (
                0 if item[2] > 0 else 1,
                item[0].rank,
                -item[1],
                item[0].label.casefold(),
            ),
        )
        enriched.append(
            replace(
                programme,
                priority_source=priority.source,
                priority_rank=priority.rank,
                priority_label=priority.label,
                priority_taxonomy_code=priority.taxonomy_code,
                priority_completions_total=priority.completions_total,
                priority_degree_completions=degree_completions,
                priority_match_score=score,
            )
        )
    return enriched


def choose_deep_programmes(
    programmes: list[ProgrammeRecord],
    *,
    include_optional_phd: bool,
    max_regular: int = 2,
) -> list[ProgrammeRecord]:
    selected: list[ProgrammeRecord] = []
    selected_ids: set[str] = set()
    selected_identities: set[tuple[str, str, str]] = set()
    eligible_programmes = [
        programme
        for programme in programmes
        if programme_is_selection_eligible(programme)
    ]
    regular_programmes = [
        programme
        for programme in eligible_programmes
        if programme.catalogue_source == "user_supplied"
        or programme.degree_level in {"bachelor", "master"}
    ]

    for programme in regular_programmes:
        if len(selected) >= max_regular:
            break
        identity = programme_selection_identity(programme)
        if (
            programme.catalogue_source == "user_supplied"
            and identity not in selected_identities
        ):
            selected.append(programme)
            selected_ids.add(programme.programme_id)
            selected_identities.add(identity)

    source_keywords = {
        "bachelor": ("undergraduate", "bachelor"),
        "master": ("graduate", "postgraduate", "master", "sgs"),
        "phd": ("graduate", "postgraduate", "doctor", "phd"),
    }

    def selection_rank(
        programme: ProgrammeRecord, target_degree: str
    ) -> tuple[int, int, int, int, int, int, int, str, str]:
        source = programme.catalogue_source.lower()
        language = (programme.language or "").casefold()
        language_rank = (
            0
            if language == "english"
            else 2 if language and language != "english" else 1
        )
        source_match = any(
            keyword in source for keyword in source_keywords[target_degree]
        )
        priority_group = (
            0
            if (programme.priority_degree_completions or 0) > 0
            else 1 if programme.priority_rank is not None else 2
        )
        return (
            0 if urlsplit(programme.official_url).scheme == "https" else 1,
            language_rank,
            priority_group,
            programme.priority_rank or 10_000,
            -(programme.priority_degree_completions or 0),
            0 if source_match else 1,
            0 if programme.credential else 1,
            programme.programme_name.casefold(),
            programme.official_url,
        )

    for target_degree in ("bachelor", "master"):
        if len(selected) >= max_regular:
            break
        if any(
            programme.degree_level == target_degree for programme in selected
        ):
            continue
        eligible = [
            programme
            for programme in regular_programmes
            if programme.degree_level == target_degree
            and programme.programme_id not in selected_ids
            and programme_selection_identity(programme)
            not in selected_identities
        ]
        match = (
            min(
                eligible,
                key=lambda programme: selection_rank(
                    programme, target_degree
                ),
            )
            if eligible
            else None
        )
        if match:
            selected.append(match)
            selected_ids.add(match.programme_id)
            selected_identities.add(
                programme_selection_identity(match)
            )
    while len(selected) < max_regular:
        remaining = [
            candidate
            for candidate in regular_programmes
            if candidate.programme_id not in selected_ids
            and programme_selection_identity(candidate)
            not in selected_identities
        ]
        if not remaining:
            break
        match = min(
            remaining,
            key=lambda candidate: selection_rank(
                candidate,
                candidate.degree_level or "master",
            ),
        )
        selected.append(match)
        selected_ids.add(match.programme_id)
        selected_identities.add(programme_selection_identity(match))
    if include_optional_phd:
        eligible_phds = [
            programme
            for programme in eligible_programmes
            if programme.degree_level == "phd"
            and programme.programme_id not in selected_ids
            and programme_selection_identity(programme)
            not in selected_identities
        ]
        phd = (
            min(
                eligible_phds,
                key=lambda programme: selection_rank(programme, "phd"),
            )
            if eligible_phds
            else None
        )
        if phd:
            selected.append(phd)
    return [
        replace(
            programme,
            is_deep_selected=True,
            selection_basis=(
                "curated_smoke_seed"
                if programme.catalogue_source == "user_supplied"
                else (
                    "ipeds_completions_priority"
                    if programme.priority_rank is not None
                    else "official_catalogue_coverage"
                )
            ),
            selection_rank=index,
        )
        for index, programme in enumerate(selected, start=1)
    ]
