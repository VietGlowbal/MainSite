"""Expand the frozen Stage 1 advisory view using deterministic local evidence.

The production CSV is intentionally not written by this module.  The module
starts from the existing hierarchy replay, then fills only missing advisory
cells from (a) official pages already captured in the Stage 1 URL inventory,
(b) persisted deterministic/review assertions, and (c) compatible sibling or
policy donors in the frozen evidence set.  No network or model call is made.
"""

from __future__ import annotations

import csv
import html
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit, urlunsplit

from bs4 import BeautifulSoup

ARTIFACT_DIR = Path(__file__).resolve().parent
RUN_DIR = ARTIFACT_DIR / "runs" / "stage1-20260915-main"
STRICT_CSV = ARTIFACT_DIR / "stage1-programme-final-results.csv"
MAX_CSV = ARTIFACT_DIR / "stage1-programme-max-fill-results.csv"
MAX_AUDIT_CSV = ARTIFACT_DIR / "stage1-programme-max-fill-sources.csv"
MAX_FIELD_SUMMARY_CSV = ARTIFACT_DIR / "stage1-max-fill-field-summary.csv"
MAX_COMPLETENESS_CSV = ARTIFACT_DIR / "stage1-max-fill-completeness.csv"
MAX_EVIDENCE_JSONL = ARTIFACT_DIR / "stage1-max-fill-evidence.jsonl"
MAX_SUMMARY_JSON = ARTIFACT_DIR / "stage1-max-fill-replay-summary.json"
URL_INVENTORY = ARTIFACT_DIR / "_existing_url_fetch_inventory.json"

if str(ARTIFACT_DIR) not in sys.path:
    sys.path.insert(0, str(ARTIFACT_DIR))

import generate_hierarchy_reports as reports  # noqa: E402
import generate_stage1_max_fill as base_max  # noqa: E402
import rebuild_verified_population as rebuild  # noqa: E402


CSV_FIELDS = tuple(
    field
    for field in rebuild.LEAD_COLUMNS[7:-7]
    if not field.endswith("_scope")
)
HIERARCHY_FIELDS = tuple(rebuild.FIELD_ALIASES.get(field, field) for field in reports.FIELDS)
CANONICAL_FIELDS = tuple(dict.fromkeys(CSV_FIELDS))
FIELD_ALIASES = {
    "standardized_tests": "standardized_test_requirements",
    "sop_essay_requirements": "sop_or_essay",
    "scholarships": "scholarship",
}
RAW_CANONICAL = frozenset(FIELD_ALIASES.get(field, field) for field in CANONICAL_FIELDS)

SOURCE_COLUMNS = (
    "programme_id",
    "programme_name",
    "institution_id",
    "field_name",
    "value_json",
    "resolution_level",
    "scope",
    "donor_entity",
    "donor_name",
    "source_url",
    "source_hash",
    "raw_document_id",
    "provider",
    "source_authority",
    "source_relationship",
    "uncertainty",
    "provenance",
    "original_status",
    "is_new",
)


def norm(value: Any) -> str:
    text = html.unescape(str(value or ""))
    text = unicodedata.normalize("NFKC", text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def folded(value: Any) -> str:
    text = unicodedata.normalize("NFKD", norm(value))
    return "".join(ch for ch in text if not unicodedata.combining(ch)).casefold()


def compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def has_value(value: Any) -> bool:
    return value not in (None, "", [], {}, ())


def valid_documents_value(value: Any) -> bool:
    """Reject serialized provider metadata masquerading as document facts."""
    rendered = norm(value)
    if not rendered or len(rendered) > 1200:
        return False
    if re.search(r"<\s*/?(?:p|div|script|style)\b|(?:metadata|koulutustyyppi|isMuokkaaja|kuvaus)\s*[:=]", rendered, re.I):
        return False
    return True


DOCUMENT_FIELDS = frozenset({"graduation_certificate", "academic_transcript"})
DOCUMENT_TYPE_ALIASES = {
    "graduation_certificate": "graduation_certificate",
    "degree_certificate": "graduation_certificate",
    "degree_certificates": "graduation_certificate",
    "certificate": "graduation_certificate",
    "certificates": "graduation_certificate",
    "diploma": "graduation_certificate",
    "diplomas": "graduation_certificate",
    "proof_of_degree": "graduation_certificate",
    "proof_of_graduation": "graduation_certificate",
    "academic_transcript": "academic_transcript",
    "transcript": "academic_transcript",
    "transcripts": "academic_transcript",
    "academic_record": "academic_transcript",
    "academic_records": "academic_transcript",
    "mark_sheet": "academic_transcript",
    "marksheet": "academic_transcript",
}


def document_field_from_text(value: Any) -> str:
    """Classify only explicit certificate/transcript language.

    This is intentionally narrower than a generic ``required_documents``
    parser.  A phrase such as ``academic qualifications`` is not enough to
    prove either component of the admission package.
    """

    rendered = norm(value)
    if not rendered:
        return ""
    if re.search(
        r"\b(?:academic\s+)?transcripts?|academic\s+records?|mark\s*[- ]?sheets?\b",
        rendered,
        re.I,
    ):
        return "academic_transcript"
    if re.search(
        r"\b(?:graduation|degree|educational|school[- ]leaving)\s+certificates?\b"
        r"|\b(?:degree|graduation)\s+diplomas?\b"
        r"|\bproof\s+of\s+(?:degree|graduation)\b"
        r"|\bdiplomas?\b",
        rendered,
        re.I,
    ):
        return "graduation_certificate"
    return ""


def document_component_values(value: Any) -> list[tuple[str, Any]]:
    """Return explicit document components nested in a requirement value."""

    components: list[tuple[str, Any]] = []
    if isinstance(value, (list, tuple)):
        for item in value:
            components.extend(document_component_values(item))
        return components
    if isinstance(value, Mapping):
        raw_type = norm(
            value.get("document_type")
            or value.get("documentType")
            or value.get("type")
            or value.get("requirement_type")
        ).casefold().replace("-", "_").replace(" ", "_")
        field = DOCUMENT_TYPE_ALIASES.get(raw_type)
        if field:
            return [(field, value)]
        for key in ("details", "label", "name", "title", "description", "text"):
            field = document_field_from_text(value.get(key))
            if field:
                return [
                    (
                        field,
                        {
                            "document_type": field,
                            "requirement_status": "required",
                            "details": norm(value.get(key)),
                        },
                    )
                ]
        return []
    field = document_field_from_text(value)
    if not field:
        return []
    return [
        (
            field,
            {
                "document_type": field,
                "requirement_status": "required",
                "details": norm(value),
            },
        )
    ]


def expanded_document_rows(row: Mapping[str, Any], field: str) -> list[tuple[str, Any, Mapping[str, Any]]]:
    """Keep the original assertion and expose explicit package components."""

    value = row.get("value_json")
    result: list[tuple[str, Any, Mapping[str, Any]]] = [(field, value, row)]
    if field != "required_documents":
        return result
    result.extend((component, component_value, row) for component, component_value in document_component_values(value))
    return result


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                try:
                    value = json.loads(line)
                except ValueError:
                    continue
                if isinstance(value, dict):
                    rows.append(value)
    return rows


def write_csv(path: Path, columns: Iterable[str], rows: Iterable[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(columns), extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: serialise_csv(row.get(column, "")) for column in columns})


def serialise_csv(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, (dict, list, tuple, bool, int, float)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return str(value)


def canonical_url(value: Any) -> str:
    raw = norm(value)
    if not raw:
        return ""
    parts = urlsplit(raw)
    return urlunsplit((parts.scheme.casefold(), parts.netloc.casefold(), parts.path.rstrip("/") or "/", parts.query, ""))


def source_excerpt(text: str, start: int, end: int, limit: int = 900) -> str:
    left = max(0, start - 140)
    right = min(len(text), max(end, start) + 280)
    return norm(text[left:right])[:limit]


def parse_number(value: Any) -> float | int | None:
    raw = norm(value)
    raw = re.sub(r"[^0-9,.]", "", raw)
    if not raw:
        return None
    if "," in raw and "." in raw:
        raw = raw.replace(",", "")
    elif raw.count(",") > 1:
        raw = raw.replace(",", "")
    elif "," in raw:
        left, right = raw.rsplit(",", 1)
        raw = left.replace(",", "") + ("." + right if len(right) <= 2 else right)
    elif raw.count(".") > 1:
        raw = raw.replace(".", "")
    try:
        number = float(raw)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


MONTHS = {
    name: index
    for index, name in enumerate(
        ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"),
        1,
    )
}


def date_value(day: str, month: str, year: str) -> str:
    number = MONTHS.get(folded(month))
    if number is None:
        return ""
    return f"{int(year):04d}-{number:02d}-{int(day):02d}"


@dataclass(frozen=True)
class Fact:
    programme_id: str
    field_name: str
    value: Any
    level: str
    scope: str
    donor_entity: str
    donor_name: str
    source_url: str
    source_hash: str
    raw_document_id: str
    provider: str
    source_authority: str
    source_relationship: str
    uncertainty: str
    provenance: str
    original_status: str


def make_fact(
    *,
    programme_id: str,
    field_name: str,
    value: Any,
    level: str,
    scope: str,
    donor_entity: str,
    donor_name: str,
    source_url: str,
    source_hash: str,
    raw_document_id: str,
    provider: str,
    source_authority: str,
    source_relationship: str,
    uncertainty: str,
    provenance: str,
    original_status: str,
) -> Fact | None:
    field = FIELD_ALIASES.get(field_name, field_name)
    if field not in CANONICAL_FIELDS or not has_value(value) or not programme_id:
        return None
    return Fact(
        programme_id=programme_id,
        field_name=field,
        value=value,
        level=level,
        scope=scope or "programme",
        donor_entity=donor_entity,
        donor_name=donor_name,
        source_url=source_url,
        source_hash=source_hash,
        raw_document_id=raw_document_id,
        provider=provider,
        source_authority=source_authority,
        source_relationship=source_relationship,
        uncertainty=uncertainty,
        provenance=provenance,
        original_status=original_status,
    )


def soup_pairs(soup: BeautifulSoup) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for label in soup.find_all("dt"):
        value = label.find_next_sibling("dd")
        if value is None:
            continue
        left, right = norm(label.get_text(" ", strip=True)), norm(value.get_text(" ", strip=True))
        if left and right and len(right) <= 1000:
            pairs.append((left, right))
    for row in soup.find_all("tr"):
        cells = [norm(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
        if len(cells) >= 2 and cells[0] and cells[1] and len(cells[1]) <= 1000:
            pairs.append((cells[0], cells[1]))
    return pairs


def pair_value(pairs: Iterable[tuple[str, str]], patterns: Iterable[str]) -> tuple[str, str] | None:
    compiled = [re.compile(pattern, re.I) for pattern in patterns]
    for label, value in pairs:
        if any(pattern.fullmatch(label) or pattern.search(label) for pattern in compiled):
            return value, f"{label}: {value}"
    return None


def page_text_and_headings(raw: str) -> tuple[str, list[str], BeautifulSoup]:
    soup = BeautifulSoup(raw or "", "html.parser")
    for node in soup(["script", "style", "noscript", "template"]):
        node.decompose()
    # Existing page captures include complete navigation and footer markup.
    # Removing those regions keeps deterministic label/section parsing tied to
    # the page content instead of menu links and cookie text.
    for node in soup.find_all(["nav", "footer"]):
        node.decompose()
    for node in soup.find_all(attrs={"role": re.compile(r"navigation", re.I)}):
        node.decompose()
    for node in soup.find_all(class_=re.compile(r"(?:^|[-_ ])(?:mega-)?(?:menu|navigation|footer|cookie)(?:[-_ ]|$)", re.I)):
        node.decompose()
    text = norm(soup.get_text(" ", strip=True))
    headings = [norm(node.get_text(" ", strip=True)) for node in soup.find_all(["h1", "h2", "h3"])]
    return text, headings, soup


def jsonld_objects(soup: BeautifulSoup) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        try:
            value = json.loads(script.string or script.get_text())
        except (TypeError, ValueError):
            continue
        values = value if isinstance(value, list) else [value]
        objects.extend(item for item in values if isinstance(item, dict))
    return objects


def currency_amounts(
    segment: str,
    *,
    minimum: float = 1,
    maximum: float = 100000,
    fallback_currency: str | None = None,
) -> list[tuple[float | int, str]]:
    pattern = re.compile(
        r"(?P<symbol>[£€$\ufffd])\s*(?P<amount>[0-9][0-9,.\s]*)|(?P<amount2>[0-9][0-9,.\s]*)\s*(?P<code>GBP|EUR|USD|CHF|SEK|NOK|DKK)\b",
        re.I,
    )
    result: list[tuple[float | int, str]] = []
    for match in pattern.finditer(segment):
        amount = parse_number(match.group("amount") or match.group("amount2"))
        if amount is None or not minimum <= float(amount) <= maximum:
            continue
        symbol = match.group("symbol") or ""
        code = (match.group("code") or "").upper()
        currency = {
            "Â£": "GBP",
            "£": "GBP",
            "â‚¬": "EUR",
            "€": "EUR",
            "$": "USD",
            "\ufffd": fallback_currency or "",
        }.get(symbol, code)
        if currency:
            result.append((amount, currency))
    return result


def fee_fact_value(amount: float | int, currency: str, context: str, *, period: str = "") -> dict[str, Any]:
    value: dict[str, Any] = {"amount": amount, "currency": currency}
    if period:
        value["fee_period"] = period
    audience = "international" if re.search(r"international|overseas|non[- ]?uk|non[- ]?eu", context, re.I) else ""
    if audience:
        value["audience"] = audience
    return value


def parse_page_facts(
    *,
    page: Mapping[str, Any],
    targets: list[Mapping[str, Any]],
) -> list[Fact]:
    raw = str(page.get("text") or "")
    text, headings, soup = page_text_and_headings(raw)
    if not text:
        return []
    pairs = soup_pairs(soup)
    url = str(page.get("url") or "")
    ctype = str(page.get("ctype") or "").casefold()
    if "pdf" in ctype or url.casefold().split("?", 1)[0].endswith(".pdf"):
        # The inventory may contain a PDF response whose bytes were decoded as
        # text.  It is not safe to run HTML/regex extraction over that payload.
        return []
    content_hash = str(page.get("hash") or "")
    generic_page = bool(re.search(r"/presentation|/masters?$|/offre-de-formation|/formations-linspe|partner-institutions|/formations$|/formation/masters", url, re.I))
    scope = "faculty" if generic_page or len(targets) > 1 else "programme"
    host = urlsplit(url).netloc.casefold()
    fallback_currency = (
        "GBP" if host.endswith(".ac.uk") or host.endswith(".uk")
        else "EUR" if host.endswith(".fr") or host.endswith(".nl") or host.endswith(".fi")
        else "SEK" if host.endswith(".se")
        else None
    )
    facts: list[Fact] = []

    def add(field: str, value: Any, evidence: str, *, uncertainty: str = "LOW", scope_override: str | None = None) -> None:
        for target in targets:
            fact = make_fact(
                programme_id=str(target.get("programme_id") or ""),
                field_name=field,
                value=value,
                level="H0",
                scope=scope_override or scope,
                donor_entity=url,
                donor_name=str(target.get("institution_name") or url),
                source_url=url,
                source_hash=content_hash,
                raw_document_id=f"stage1-page-{content_hash[:24]}",
                provider="official_existing_url",
                source_authority="OFFICIAL",
                source_relationship="DIRECT_OFFICIAL",
                uncertainty=uncertainty,
                provenance=evidence,
                original_status="PAGE_DETERMINISTIC",
            )
            if fact is not None:
                facts.append(fact)

    # JSON-LD is the most stable source for identity, award, duration and fees.
    for obj in jsonld_objects(soup):
        name = norm(obj.get("name"))
        if name and len(name) <= 240 and not re.search(r"university|college|home|menu", name, re.I):
            if any(len(set(folded(name).split()) & set(folded(str(t.get("programme_name"))).split())) >= 1 for t in targets):
                add("programme_identity", name, f"JSON-LD name: {name}")
        credential = norm(obj.get("educationalCredentialAwarded") or obj.get("credential"))
        if credential and len(credential) <= 180:
            add("credential", credential, f"JSON-LD educationalCredentialAwarded: {credential}")
        duration = norm(obj.get("timeRequired"))
        if duration and re.search(r"year|month|semester|week|ECTS|credit", duration, re.I):
            add("duration", duration, f"JSON-LD timeRequired: {duration}")
        offers = obj.get("offers")
        offer_values = offers if isinstance(offers, list) else [offers]
        for offer in offer_values:
            if not isinstance(offer, dict):
                continue
            amount = parse_number(offer.get("price"))
            currency = norm(offer.get("priceCurrency")).upper()
            if amount is not None and currency in {"GBP", "EUR", "USD", "CHF", "SEK", "DKK", "NOK"}:
                add("tuition", fee_fact_value(amount, currency, compact(offer), period="annual"), f"JSON-LD offer: {amount} {currency}")

    # Explicit metadata labels (programme pages and policy pages).
    identity = pair_value(pairs, (r"^title$", r"^programme$", r"^program$", r"^course title$", r"^award$"))
    if identity and len(identity[0]) <= 240 and not re.search(r"fee|cost|menu", identity[0], re.I):
        add("programme_identity", identity[0], identity[1])
    credential = pair_value(pairs, (r"^award$", r"^qualification$", r"^degree$", r"^diploma$"))
    if credential and len(credential[0]) <= 240 and re.search(r"\b(BA|BSc|BEng|MA|MSc|MEng|LLB|HND|Dip|Master|Bachelor|Licence|Diploma)\b", credential[0], re.I):
        add("credential", credential[0], credential[1])
    duration = pair_value(pairs, (r"^duration$", r"programme duration", r"course length", r"dur[ée]e(?: de la formation)?", r"studielast", r"course duration"))
    if duration and (
        re.search(r"\b(?:year|years|month|months|semester|semesters|week|weeks|day|days|ans?|mois|semaines?|maand|maanden|jaren)\b", duration[0], re.I)
        or not re.search(r"\b(?:EC|ECTS|credits?)\b", duration[0], re.I)
    ):
        add("duration", duration[0], duration[1])
    else:
        match = re.search(r"\b(?:programme\s+duration|course\s+length|course\s+duration|duration)\s*:?[ ]*([^|.!?]{2,100})", text, re.I)
        if match and re.search(r"\b(?:year|month|semester|week|EC|credit|ans?|semestres?)\b", match.group(1), re.I):
            add("duration", norm(match.group(1)), source_excerpt(text, match.start(), match.end()))
    location = pair_value(pairs, (r"^location$", r"campus or location", r"lieu", r"^locatie$", r"campus$", r"teaching location"))
    if location and len(location[0]) <= 260:
        add("location", location[0], location[1])
    else:
        match = re.search(r"\b(?:location|campus)\s*:?[ ]*([^|.!?]{2,100})", text, re.I)
        if match:
            value = norm(match.group(1))
            if value and not re.search(r"(?:map|address|phone|email|search|menu)", value, re.I):
                add("location", value, source_excerpt(text, match.start(), match.end()))
    mode = pair_value(pairs, (r"mode of study", r"study mode", r"^vorm$", r"^rythme$", r"modalit[eé]s?", r"delivery mode", r"study type"))
    if mode:
        add("delivery_mode", mode[0], mode[1])
    else:
        match = re.search(r"\b(?:mode\s+of\s+study|study\s+mode|delivery\s+mode)\s*:?[ ]*([^|.!?]{2,100})", text, re.I)
        if match:
            add("delivery_mode", norm(match.group(1)), source_excerpt(text, match.start(), match.end()))
    language = pair_value(pairs, (r"language of instruction", r"langues? d['’]?enseignement", r"^voertaal$", r"^taal$", r"teaching language", r"programme language"))
    if language and not re.search(r"English language requirements|foreign language", language[1], re.I):
        add("programme_language", language[0], language[1])
    elif not language:
        match = re.search(r"\b(?:language\s+of\s+instruction|teaching\s+language|voertaal|langues? d['’]?enseignement)\s*:?[ ]*([^|.!?]{2,80})", text, re.I)
        if match and not re.search(r"requirements|foreign language", match.group(1), re.I):
            add("programme_language", norm(match.group(1)), source_excerpt(text, match.start(), match.end()))

    # Text-labelled identity metadata that is common on modern UK pages.
    for label, field, pattern in (
        ("Start date", "intakes", r"start\s*date\s*:?[ ]*([^|]{1,80})"),
        ("Starts", "intakes", r"starts?\s*(?:in|:)?[ ]*([^|]{1,60})"),
    ):
        match = re.search(pattern, text, re.I)
        if match:
            value = norm(match.group(1))
            dates: list[str] = []
            for month, year in re.findall(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})", value, re.I):
                dates.append(date_value("1", month, year))
            if dates:
                add(field, {"start_dates": sorted(set(dates)), "source_label": label}, source_excerpt(text, match.start(), match.end()))
            elif re.fullmatch(r"January|February|March|April|May|June|July|August|September|October|November|December", value, re.I):
                add(field, {"start_months": [value]}, source_excerpt(text, match.start(), match.end()))
            break

    # Course fees.  Only amounts in an explicit fee/cost context are accepted.
    fee_candidates: list[tuple[float | int, str, str]] = []
    # Search around the amount as well as around the label.  Many catalogues
    # render ``£10,050 per year`` before the word ``Fees`` in a separate node.
    for match in re.finditer(r"(?:[£€$]\s*[0-9][0-9,.\s]*|[0-9][0-9,.\s]*\s*(?:GBP|EUR|USD|CHF|SEK|NOK|DKK)\b)", text, re.I):
        context = source_excerpt(text, match.start(), match.end(), 900)
        if not re.search(r"tuition|course\s+fee|fees?\s+and\s+funding|course\s+cost|cost\s+of\s+(?:the\s+)?course|co[uû]t\s+de\s+la\s+formation|annual\s+fee", context, re.I):
            continue
        if re.search(r"application fee|application charge|frais de candidature|registration fee|registration fees|administrative fee|enrolment fee|enrollment fee|inscription|salary|earnings|average annual salary", context, re.I):
            continue
        if re.search(r"accommodation|living cost|books?|travel|deposit", context, re.I) and not re.search(r"tuition|course fee", context, re.I):
            continue
        for amount, currency in currency_amounts(context, minimum=50, fallback_currency=fallback_currency):
            fee_candidates.append((amount, currency, context))
    if fee_candidates:
        # Prefer international/overseas amounts, then the newest/largest clearly
        # labelled fee.  The source text remains in the audit for review.
        chosen = max(fee_candidates, key=lambda item: (1 if re.search(r"international|overseas|non[- ]?uk|non[- ]?eu", item[2], re.I) else 0, float(item[0])))
        add("tuition", fee_fact_value(chosen[0], chosen[1], chosen[2], period="annual"), chosen[2], uncertainty="MEDIUM" if len(fee_candidates) > 1 else "LOW")

    # Additional and mandatory charges, kept separate from tuition.
    for field, patterns in (
        ("application_fee", (r"application\s+fee", r"application\s+charge", r"frais\s+de\s+candidature")),
        ("additional_fees", (r"additional\s+fees?", r"cvec", r"student\s+union\s+fee")),
        ("mandatory_fees", (r"mandatory\s+fees?", r"registration\s+fee", r"cvec")),
    ):
        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if not match:
                continue
            context = source_excerpt(text, match.start(), match.end() + 260, 800)
            amounts = currency_amounts(context, minimum=1, maximum=20000, fallback_currency=fallback_currency)
            if amounts:
                amount, currency = amounts[0]
                if field == "additional_fees" and re.search(r"optional|calculator|equipment|books?|travel|accommodation|living", context, re.I):
                    continue
                add(field, fee_fact_value(amount, currency, context), context)
                break

    # English tests.  The deterministic parsers require plausible score ranges.
    try:
        import acquire_stage1_coverage as acquire  # local artifact module

        ielts = acquire.parse_ielts(text)
        if ielts:
            score, subscores, evidence = ielts
            add("ielts_overall", score, evidence)
            if subscores:
                add("ielts_subscores", subscores, evidence)
        toefl = acquire.parse_toefl(text)
        if toefl:
            add("toefl", toefl[0], toefl[1])
        duolingo = acquire.parse_duolingo(text)
        if duolingo:
            add("duolingo", duolingo[0], duolingo[1])
    except Exception:
        pass
    tests: list[str] = []
    for match in re.finditer(r"\b(?:GRE|GMAT|SAT|PTE(?: Academic)?|Pearson Test of English|Cambridge English)\b[^.;]{0,100}", text, re.I):
        item = norm(match.group(0))
        # Lower-case ``sat`` in prose (for example, "sat your examinations")
        # is a verb, not the SAT admissions test.
        token = match.group(0).split()[0]
        if token.casefold() == "sat" and token != "SAT":
            continue
        if not re.search(r"module|course|department|examinations?\s+early", item, re.I):
            tests.append(item)
    if tests:
        add("standardized_test_requirements", sorted(set(tests))[:6], " | ".join(sorted(set(tests))), uncertainty="MEDIUM")

    # Deadlines and application windows.
    date_matches: list[tuple[str, str]] = []
    for match in re.finditer(r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b", text, re.I):
        context = source_excerpt(text, match.start() - 120, match.end() + 80, 600)
        if re.search(r"deadline|apply by|closing|application", context, re.I):
            date_matches.append((date_value(match.group(1), match.group(2), match.group(3)), context))
    for match in re.finditer(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text):
        context = source_excerpt(text, match.start() - 120, match.end() + 80, 600)
        if re.search(r"deadline|apply by|closing|application", context, re.I):
            date_matches.append((match.group(0), context))
    for value, context in sorted(set(date_matches)):
        field = "final_deadline"
        if re.search(r"priority|early", context, re.I):
            field = "priority_deadline"
        elif re.search(r"international|overseas", context, re.I):
            field = "international_deadline"
        add(field, value, context)
    if re.search(r"rolling\s+(?:admission|basis)|applications?\s+are\s+considered\s+on\s+a\s+rolling", text, re.I):
        match = re.search(r"[^.]{0,100}rolling\s+(?:admission|basis)[^.]{0,220}", text, re.I)
        add("rolling_admission", True, norm(match.group(0) if match else "Rolling admission"))

    # Entry requirements and documents.
    degree_level = folded(targets[0].get("degree_level") if targets else "")
    if degree_level in {"master", "postgraduate", "doctorate", "phd"}:
        match = re.search(r"(?:a|an)\s+(?:relevant\s+|recognised\s+|recognized\s+)?(?:bachelor(?:'s)?|undergraduate)\s+degree[^.;]{0,220}", text, re.I)
        if match:
            add("minimum_degree", norm(match.group(0)), source_excerpt(text, match.start(), match.end()))
    gpa = re.search(r"(?:minimum\s+)?GPA\s*(?:of|:)?\s*(\d(?:\.\d+)?)\s*(?:/\s*(\d(?:\.\d+)?))?", text, re.I)
    if gpa:
        add("minimum_gpa", parse_number(gpa.group(1)), source_excerpt(text, gpa.start(), gpa.end()))
        if gpa.group(2):
            add("gpa_scale", parse_number(gpa.group(2)), source_excerpt(text, gpa.start(), gpa.end()))
    try:
        subject = acquire.parse_subject_prerequisite(text)
        if subject:
            add("subject_prerequisites", subject[0], subject[1])
        portfolio = acquire.parse_portfolio_requirement(text)
        if portfolio:
            add("portfolio", portfolio[0], portfolio[1])
        recommendation = acquire.parse_recommendation_requirement(text)
        if recommendation:
            add("recommendation_letters", recommendation[0], recommendation[1])
        experience = acquire.parse_work_experience_requirement(text)
        if experience:
            add("work_experience", experience[0], experience[1])
        documents = acquire.parse_edinburgh_documents(text)
        if documents:
            add("required_documents", documents[0], documents[1])
            add("sop_or_essay", "Personal statement", documents[1])
            add("recommendation_letters", "Reference", documents[1])
        scholarship = acquire.parse_scholarship_policy(text)
        if scholarship:
            add("scholarship", scholarship[0], scholarship[1])
    except Exception:
        pass
    required_context = re.search(r"(?:required documents|what you need to apply|documents? (?:required|needed)|you will need to submit|must submit)[^.!?]{0,500}", text, re.I)
    if required_context:
        segment = norm(required_context.group(0))
        labels = [
            name
            for name, pattern in (
                ("CV", r"\bCV\b|curriculum vitae"),
                ("Transcript", r"\b(?:academic\s+)?transcripts?\b|academic records?|mark\s*[- ]?sheets?"),
                ("Graduation certificate", r"\b(?:graduation|degree|educational|school[- ]leaving)\s+certificates?\b|\b(?:degree|graduation)\s+diplomas?\b|\bproof\s+of\s+(?:degree|graduation)\b"),
                ("Personal statement", r"personal statement|statement of purpose|motivation letter|essay"),
                ("Reference", r"reference|recommendation"),
                ("English language evidence", r"English language|IELTS|TOEFL"),
                ("Portfolio", r"portfolio"),
            )
            if re.search(pattern, segment, re.I)
        ]
        if labels:
            add("required_documents", labels, segment, uncertainty="MEDIUM")
            if "Graduation certificate" in labels:
                add(
                    "graduation_certificate",
                    {
                        "document_type": "graduation_certificate",
                        "requirement_status": "required",
                        "details": segment,
                    },
                    segment,
                    uncertainty="MEDIUM",
                )
            if "Transcript" in labels:
                add(
                    "academic_transcript",
                    {
                        "document_type": "academic_transcript",
                        "requirement_status": "required",
                        "details": segment,
                    },
                    segment,
                    uncertainty="MEDIUM",
                )
            if "Personal statement" in labels:
                add("sop_or_essay", "Personal statement", segment, uncertainty="MEDIUM")
            if "Reference" in labels:
                add("recommendation_letters", "Reference", segment, uncertainty="MEDIUM")
    funding_sentences = [
        norm(item)
        for item in re.split(r"(?<=[.!?])\s+", text)
        if re.search(r"\b(?:scholarships?|bursar(?:y|ies)|grants?|financial\s+(?:aid|support)|student\s+loans?|tuition\s+waivers?|fee\s+waivers?|funding\s+(?:opportunit|available|support|for)|funded)\b", item, re.I)
        and 30 <= len(norm(item)) <= 700
        and not re.search(r"menu|navigation|cookie|footer", item, re.I)
        # Captured pages can still contain a mega-menu rendered as ordinary
        # divs.  Repeated navigation labels are not a funding assertion even
        # when one of those labels happens to say "scholarships" or "financial
        # support".
        and len(re.findall(r"how\s+to\s+apply|international\s+-\s|partner\s+institutions|apply\s+to\s+[a-z]+|open\s+days|contact\s+us", item, re.I)) < 2
        and not (re.search(r"research|fellow|auditing", item, re.I) and not re.search(r"student|applicant|tuition|scholarship", item, re.I))
        and not (re.search(r"read more|contact details|registered charity|how to apply|partner institutions", item, re.I) and not re.search(r"financial\s+(?:aid|support)|bursar|grant|award", item, re.I))
    ]
    if funding_sentences:
        # Prefer a sentence that describes an actual aid mechanism or
        # eligibility condition over a generic page heading/link fragment.
        def trim_funding_text(item: str) -> str:
            markers = (
                r"student\s+bursary\s+applications?",
                r"if\s+you(?:'|’)?re\s+planning",
                r"financial\s+support",
                r"fees?\s+and\s+funding",
                r"scholarships?\s+(?:view|available|and|for)",
                r"funding\s+information",
            )
            starts = [match.start() for pattern in markers if (match := re.search(pattern, item, re.I))]
            return norm(item[min(starts):]) if starts else item

        def funding_score(item: str) -> tuple[int, int, int]:
            strong = len(
                re.findall(
                    r"eligible|qualif(?:y|ies)|financial\s+(?:aid|support)|scholarships?|bursar(?:y|ies)|grants?|awards?|loans?|waivers?",
                    item,
                    re.I,
                )
            )
            positive = len(
                re.findall(r"available|students?|applicants?|household\s+income|dependant|disabilit|children", item, re.I)
            )
            boilerplate = len(re.findall(r"find out more|find full information|read our|living costs|funding information|more information", item, re.I))
            return (strong * 3 + positive, -boilerplate * 5, -len(item))

        sentence = trim_funding_text(max(
            funding_sentences,
            key=funding_score,
        ))
        add("funding", {"funding_type": "financial_aid_policy", "details": sentence}, sentence, uncertainty="MEDIUM")
        if re.search(r"scholarship|bursar", sentence, re.I):
            add("scholarship", {"funding_type": "scholarship_policy", "details": sentence}, sentence, uncertainty="MEDIUM")
        amounts = currency_amounts(sentence, minimum=10, maximum=200000, fallback_currency=fallback_currency)
        if amounts and re.search(r"award|scholarship|bursar|grant|financial\s+(?:aid|support)|funding\s+amount|up\s+to", sentence, re.I) and not re.search(r"income|salary|cost\s+of\s+living|(?:tuition|course)\s+cost", sentence, re.I):
            amount, currency = amounts[0]
            value = {"amount": amount, "currency": currency}
            add("scholarship_amount", value, sentence, uncertainty="MEDIUM")
            add("funding_amount", value, sentence, uncertainty="MEDIUM")
        eligibility_sentences = [
            item
            for item in funding_sentences
            if re.search(
                r"eligible|eligibility|qualif(?:y|ies)|(?:available|open)\s+to\s+(?:all\s+)?(?:home|international|uk|eu|overseas)?\s*students?|(?:for|among)\s+(?:uk|international|home|eu|overseas)\s+students?|household\s+income|low\s+incomes?|dependant|disabilit|means[- ]?tested|bursary\s+applications?",
                item,
                re.I,
            )
        ]
        if eligibility_sentences:
            eligibility = trim_funding_text(max(
                eligibility_sentences,
                key=lambda item: (
                    len(re.findall(r"eligible|eligibility|qualif(?:y|ies)|household\s+income|low\s+incomes?|dependant|disabilit|means[- ]?tested|bursary\s+applications?", item, re.I)) * 3
                    + len(re.findall(r"available|open|students?|applicants?|international|overseas|home|uk|eu", item, re.I)),
                    -len(item),
                ),
            ))
            add("funding_eligibility", eligibility, eligibility, uncertainty="MEDIUM")
        date_match = re.search(r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b", sentence, re.I)
        if date_match:
            add("funding_deadline", date_value(date_match.group(1), date_match.group(2), date_match.group(3)), sentence, uncertainty="MEDIUM")

    # A compact careers section is preferable to copying navigation or module lists.
    for heading in headings:
        if not re.search(r"^(?:career|careers|employment|after\s+graduation|future\s+career|career\s+prospects|careers?\s+and\s+your\s+future)", heading, re.I):
            continue
        node = next((item for item in soup.find_all(["h1", "h2", "h3"]) if norm(item.get_text(" ", strip=True)) == heading), None)
        if node is None:
            continue
        chunks: list[str] = []
        for sibling in node.find_all_next(["p", "li"]):
            value = norm(sibling.get_text(" ", strip=True))
            if value:
                chunks.append(value)
            if len(" ".join(chunks)) >= 650:
                break
        section = norm(" ".join(chunks))[:900]
        if section and not re.search(r"menu|navigation|cookie", section, re.I) and re.search(r"\b(?:career|employment|job|work|graduate|employability|profession|role)\b", section, re.I):
            add("career_outcomes", section, f"{heading}: {section[:700]}", uncertainty="MEDIUM")
            break

    return facts


def load_pages(rows: list[Mapping[str, Any]]) -> tuple[dict[str, dict[str, Any]], Counter[str]]:
    targets_by_url: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for row in rows:
        key = canonical_url(row.get("application_url"))
        if key:
            targets_by_url[key].append(row)
    pages: dict[str, dict[str, Any]] = {}
    status_counts: Counter[str] = Counter()
    if not URL_INVENTORY.exists():
        return pages, status_counts
    try:
        inventory = json.loads(URL_INVENTORY.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        inventory = []
    for item in inventory if isinstance(inventory, list) else []:
        key = canonical_url(item.get("url"))
        if not key or key not in targets_by_url:
            continue
        status = str(item.get("status") or "0")
        status_counts[status] += 1
        if status == "200" and str(item.get("text") or ""):
            pages[key] = {**item, "targets": targets_by_url[key]}
    return pages, status_counts


def raw_review_facts(
    *,
    target_rows: Mapping[str, Mapping[str, Any]],
    programme_rows: Mapping[str, Mapping[str, Any]],
) -> list[Fact]:
    rows = read_jsonl(RUN_DIR / "field_assertions.jsonl")
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        pid = str(row.get("entity_id") or "")
        if pid not in target_rows or row.get("verification_status") != "NEEDS_REVIEW":
            continue
        raw_field = str(row.get("field_name") or "")
        field = FIELD_ALIASES.get(raw_field, raw_field)
        for component_field, value, source_row in expanded_document_rows(row, field):
            if component_field not in RAW_CANONICAL:
                continue
            # The prior degree values are qualification labels from catalogues, not
            # explicit prerequisites.  Retain only a deterministic degree phrase.
            if component_field == "minimum_degree" and not re.search(r"bachelor|undergraduate degree", norm(value), re.I):
                continue
            if component_field == "additional_fees" and not has_value(value):
                continue
            if component_field in {"required_documents", *DOCUMENT_FIELDS} and not valid_documents_value(value):
                continue
            if component_field == "subject_prerequisites":
                rendered = norm(value)
                if re.search(r"english_language_tests|IELTS_academic|TOEFL_iBT|PTE_academic|C1_Advanced|C2_Proficiency", rendered, re.I) and not re.search(r"prerequisite|mathematics|mathematics|secondary|baccalaureate|diploma", rendered, re.I):
                    continue
            if component_field in {"programme_status", "academic_cycle"}:
                continue
            candidate = dict(source_row)
            candidate["field_name"] = component_field
            candidate["value_json"] = value
            grouped[(pid, component_field)].append(candidate)

    facts: list[Fact] = []
    for (pid, field), candidates in sorted(grouped.items()):
        values: dict[str, Any] = {}
        for row in candidates:
            value = row.get("value_json")
            if not has_value(value):
                continue
            values.setdefault(compact(value), value)
        if not values:
            continue
        chosen: Any
        if field in {"employment_outcomes", "career_outcomes", "required_documents", "standardized_test_requirements"} and len(values) > 1:
            chosen = list(values.values())
        elif field == "tuition":
            valid = [value for value in values.values() if isinstance(value, dict) and parse_number(value.get("amount")) is not None and value.get("currency")]
            if not valid:
                continue
            chosen = max(valid, key=lambda value: (1 if str(value.get("audience") or "").casefold() == "international" else 0, str(value.get("academic_cycle") or ""), float(parse_number(value.get("amount")) or 0)))
        elif field == "final_deadline":
            dates = sorted(str(value) for value in values.values() if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", str(value)))
            if not dates:
                continue
            chosen = dates[-1]
        elif len(values) == 1:
            chosen = next(iter(values.values()))
        else:
            # Conflicting review values are retained as an explicit advisory
            # list instead of pretending that one is authoritative.
            chosen = list(values.values())
        first = candidates[0]
        fact = make_fact(
            programme_id=pid,
            field_name=field,
            value=chosen,
            level="H0",
            scope=str(first.get("scope") or "programme"),
            donor_entity=pid,
            donor_name=str(target_rows[pid].get("programme_name") or pid),
            source_url=" | ".join(sorted({str(row.get("source_url") or "") for row in candidates if row.get("source_url")})),
            source_hash=str(first.get("source_content_hash") or ""),
            raw_document_id=" | ".join(sorted({str(row.get("raw_document_id") or "") for row in candidates if row.get("raw_document_id")})),
            provider=str(first.get("provider_id") or "persisted_evidence"),
            source_authority=str(first.get("source_authority") or ""),
            source_relationship=str(first.get("source_relationship") or ""),
            uncertainty="HIGH",
            provenance="Persisted NEEDS_REVIEW assertion(s), deterministically aggregated for advisory MAX_FILL.",
            original_status="NEEDS_REVIEW",
        )
        if fact is not None:
            facts.append(fact)
    return facts


def catalogue_record_facts(
    *,
    target_rows: Mapping[str, Mapping[str, Any]],
    programme_rows: Mapping[str, Mapping[str, Any]],
) -> list[Fact]:
    """Expose existing frozen catalogue attributes as advisory H0 facts.

    The verified population already carries a programme title and degree level
    for every recipient.  A missing canonical identity/credential cell should
    not remain blank simply because the hierarchy replay did not receive a
    separate assertion for that attribute.  These facts are derived only from
    the persisted target record and retain an explicit catalogue provenance.
    """
    facts: list[Fact] = []

    def credential_from_name(name: str, degree: str) -> tuple[str, str]:
        token = re.search(
            r"\b(?:MSc|M\.Sc\.?|MA|M\.A\.?|MEng|MBA|LLM|LLB|BSc|B\.Sc\.?|BA|B\.A\.?|BEng|B\.Eng\.?|BBA|HND|FDSc|FdSc|PhD|Doctor(?:ate)?|Bachelor|Master|Licence|BUT|Diploma)\b",
            name,
            re.I,
        )
        if token:
            return token.group(0), "Credential token retained from persisted programme title."
        if degree.casefold() in {"master", "postgraduate", "doctorate", "phd"}:
            return "Master's degree", "Credential level derived from the persisted verified degree-level classification."
        if degree.casefold() in {"bachelor", "undergraduate"}:
            return "Bachelor's degree", "Credential level derived from the persisted verified degree-level classification."
        return "", ""

    for pid, target in sorted(target_rows.items()):
        source = programme_rows.get(pid, {})
        name = norm(source.get("programme_name")) or norm(target.get("programme_name"))
        source_url = norm(source.get("official_url")) or norm(target.get("application_url")) or f"persisted://stage1/programme/{pid}"
        provider = "frozen_programme_catalogue"
        authority = "CATALOGUE"
        relationship = "CATALOGUE_RECORD"
        if name:
            facts.append(
                Fact(
                    programme_id=pid,
                    field_name="programme_identity",
                    value=name,
                    level="H0",
                    scope="programme",
                    donor_entity=pid,
                    donor_name=name,
                    source_url=source_url,
                    source_hash="",
                    raw_document_id=f"stage1-programme-record-{pid}",
                    provider=provider,
                    source_authority=authority,
                    source_relationship=relationship,
                    uncertainty="LOW" if source.get("programme_name") else "MEDIUM",
                    provenance="Persisted verified programme catalogue title.",
                    original_status="CATALOGUE_RECORD",
                )
            )
        degree = norm(source.get("degree_level") or target.get("degree_level"))
        credential = norm(source.get("credential"))
        provenance = "Persisted programme credential attribute."
        if not credential:
            credential, provenance = credential_from_name(name, degree)
        if credential:
            facts.append(
                Fact(
                    programme_id=pid,
                    field_name="credential",
                    value=credential,
                    level="H0",
                    scope="programme",
                    donor_entity=pid,
                    donor_name=name or pid,
                    source_url=source_url,
                    source_hash="",
                    raw_document_id=f"stage1-programme-record-{pid}",
                    provider=provider,
                    source_authority=authority,
                    source_relationship=relationship,
                    uncertainty="MEDIUM" if source.get("credential") else "HIGH",
                    provenance=provenance,
                    original_status="CATALOGUE_DERIVED" if not source.get("credential") else "CATALOGUE_RECORD",
                )
            )
        for source_field, output_field in (
            ("duration", "duration"),
            ("campus", "location"),
            ("delivery_mode", "delivery_mode"),
            ("language", "programme_language"),
        ):
            value = source.get(source_field)
            if not has_value(value):
                continue
            facts.append(
                Fact(
                    programme_id=pid,
                    field_name=output_field,
                    value=value,
                    level="H0",
                    scope="programme",
                    donor_entity=pid,
                    donor_name=name or pid,
                    source_url=source_url,
                    source_hash="",
                    raw_document_id=f"stage1-programme-record-{pid}",
                    provider=provider,
                    source_authority=authority,
                    source_relationship=relationship,
                    uncertainty="LOW",
                    provenance=f"Persisted programme catalogue {source_field} attribute.",
                    original_status="CATALOGUE_RECORD",
                )
            )
    return [fact for fact in facts if make_fact(**fact.__dict__) is not None]


def offering_and_metadata_facts(
    *,
    target_rows: Mapping[str, Mapping[str, Any]],
) -> list[Fact]:
    """Map existing structured offering/API records to canonical advisory facts."""
    facts: list[Fact] = []
    target_ids = set(target_rows)
    offerings = read_jsonl(RUN_DIR / "programme_offerings.jsonl")
    cycles: dict[str, list[str]] = defaultdict(list)
    offering_ids: dict[str, list[str]] = defaultdict(list)
    for row in offerings:
        pid = str(row.get("programme_id") or "")
        cycle = norm(row.get("academic_cycle"))
        if pid in target_ids and cycle:
            cycles[pid].append(cycle)
            if row.get("programme_offering_id"):
                offering_ids[pid].append(str(row["programme_offering_id"]))
    for pid, values in sorted(cycles.items()):
        unique = sorted(set(values))
        value: Any = unique[0] if len(unique) == 1 else unique
        donor = ",".join(sorted(set(offering_ids.get(pid, []))))
        facts.append(
            Fact(
                programme_id=pid,
                field_name="academic_cycle",
                value=value,
                level="H0",
                scope="programme",
                donor_entity=donor or pid,
                donor_name=str(target_rows[pid].get("programme_name") or pid),
                source_url=f"persisted://stage1/programme-offering/{donor or pid}",
                source_hash="",
                raw_document_id=f"stage1-programme-offerings-{pid}",
                provider="frozen_programme_offering",
                source_authority="CATALOGUE",
                source_relationship="OFFERING_RECORD",
                uncertainty="MEDIUM",
                provenance="Persisted programme offering academic-cycle record.",
                original_status="OFFERING_RECORD",
            )
        )

    for row in read_jsonl(RUN_DIR / "external_programme_metadata.jsonl"):
        pid = str(row.get("programme_id") or "")
        if pid not in target_ids:
            continue
        field = str(row.get("field_name") or "")
        value = norm(row.get("value"))
        if not value:
            continue
        output_field = ""
        output_value: Any = ""
        if field == "qualification_level":
            output_field, output_value = "credential", value
        elif field == "application_policy":
            match = re.search(r"(?:^|;\s*)closeDate=(20\d{2}-\d{2}-\d{2})(?:;|$)", value)
            if match:
                output_field, output_value = "final_deadline", match.group(1)
        elif field == "application_windows":
            match = re.search(r"(?:^|;\s*)paattyy=(20\d{2}-\d{2}-\d{2})", value)
            if match:
                output_field, output_value = "final_deadline", match.group(1)
        if not output_field:
            continue
        facts.append(
            Fact(
                programme_id=pid,
                field_name=output_field,
                value=output_value,
                level="H0",
                scope=str(row.get("scope") or "programme"),
                donor_entity=pid,
                donor_name=str(target_rows[pid].get("programme_name") or pid),
                source_url=str(row.get("source_url") or f"persisted://stage1/external-metadata/{pid}"),
                source_hash=str(row.get("source_content_hash") or ""),
                raw_document_id=str(row.get("raw_document_id") or f"stage1-external-metadata-{pid}"),
                provider=str(row.get("provider_id") or "frozen_external_metadata"),
                source_authority="OFFICIAL_API",
                source_relationship="STRUCTURED_METADATA",
                uncertainty="MEDIUM",
                provenance=str(row.get("evidence") or "Persisted structured provider metadata."),
                original_status=str(row.get("verification_status") or "METADATA_RECORD"),
            )
        )
    return facts


def curriculum_facts(*, target_rows: Mapping[str, Mapping[str, Any]]) -> list[Fact]:
    """Extract canonical identity/credential labels nested in accepted curriculum records."""
    facts: list[Fact] = []
    for row in read_jsonl(RUN_DIR / "effective_field_assertions.jsonl"):
        pid = str(row.get("entity_id") or "")
        if pid not in target_rows or row.get("field_name") != "curriculum_overview":
            continue
        if row.get("verification_status") not in {"RULE_VALIDATED", "NEEDS_REVIEW"}:
            continue
        value = row.get("value_json")
        if not isinstance(value, dict):
            continue
        for key, field in (("programme_label", "programme_identity"), ("qualification_type", "credential")):
            nested = norm(value.get(key))
            if not nested:
                continue
            facts.append(
                Fact(
                    programme_id=pid,
                    field_name=field,
                    value=nested,
                    level="H0",
                    scope=str(row.get("scope") or "programme"),
                    donor_entity=pid,
                    donor_name=str(target_rows[pid].get("programme_name") or pid),
                    source_url=str(row.get("source_url") or "persisted://stage1/curriculum-overview"),
                    source_hash=str(row.get("source_content_hash") or ""),
                    raw_document_id=str(row.get("raw_document_id") or ""),
                    provider=str(row.get("provider_id") or "persisted_evidence"),
                    source_authority=str(row.get("source_authority") or ""),
                    source_relationship=str(row.get("source_relationship") or ""),
                    uncertainty="MEDIUM" if row.get("verification_status") == "RULE_VALIDATED" else "HIGH",
                    provenance=f"Nested {key} from persisted curriculum overview assertion.",
                    original_status=str(row.get("verification_status") or "CURRICULUM_RECORD"),
                )
            )
    return facts


REUSABLE_SIBLING_FIELDS = frozenset(
    {
        "programme_language",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_test_requirements",
        "application_fee",
        "required_documents",
        "graduation_certificate",
        "academic_transcript",
        "recommendation_letters",
        "sop_or_essay",
        "scholarship",
        "scholarship_amount",
        "funding",
        "funding_amount",
        "funding_eligibility",
        "funding_deadline",
        "rolling_admission",
        "intakes",
        "final_deadline",
        "priority_deadline",
        "international_deadline",
        "additional_fees",
        "mandatory_fees",
    }
)

# Outcomes are programme-sensitive, but a same-institution sibling result is
# still useful as an explicitly uncertain advisory value when degree level is
# compatible.  Keeping this separate from policy fields preserves the stricter
# discipline checks for prerequisites, portfolio and work-experience facts.
CAUTIOUS_SIBLING_FIELDS = frozenset({"career_outcomes", "employment_outcomes"})
REVIEW_DONOR_FIELDS = frozenset(
    set(REUSABLE_SIBLING_FIELDS)
    | set(CAUTIOUS_SIBLING_FIELDS)
    | {"tuition", "subject_prerequisites", "scholarship", "standardized_test_requirements"}
)

# These fields are commonly stated as an admissions or financial-aid policy
# and can be reused for another programme at the same institution when the
# policy page does not identify a programme-specific exception.  Programme
# identity, award, duration, campus, tuition and outcomes deliberately stay
# programme-scoped.
POLICY_FANOUT_FIELDS = frozenset(
    {
        "programme_language",
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
        "standardized_test_requirements",
        "application_fee",
        "additional_fees",
        "mandatory_fees",
        "required_documents",
        "graduation_certificate",
        "academic_transcript",
        "recommendation_letters",
        "sop_or_essay",
        "scholarship",
        "scholarship_amount",
        "funding",
        "funding_amount",
        "funding_eligibility",
        "funding_deadline",
    }
)


def policy_fanout_facts(
    *,
    page_facts: list[Fact],
    target_rows: Mapping[str, Mapping[str, Any]],
) -> list[Fact]:
    """Reuse unambiguous policy facts at institution scope.

    A page can be linked from one programme while describing the university's
    general admissions or funding policy.  We only fan out a field when every
    page fact for that institution/field has the same value.  Conflicting
    course-specific values are left untouched for later review.
    """
    by_institution: dict[tuple[str, str], list[Fact]] = defaultdict(list)
    for fact in page_facts:
        if fact.field_name not in POLICY_FANOUT_FIELDS:
            continue
        source_targets = [target_rows.get(fact.programme_id)]
        institution_id = str((source_targets[0] or {}).get("institution_id") or "")
        if institution_id:
            by_institution[(institution_id, fact.field_name)].append(fact)
    result: list[Fact] = []
    for (institution_id, field), candidates in sorted(by_institution.items()):
        values: dict[str, Fact] = {}
        for fact in candidates:
            values.setdefault(compact(fact.value), fact)
        if len(values) != 1:
            continue
        donor = next(iter(values.values()))
        for target_id, target in sorted(target_rows.items()):
            if str(target.get("institution_id") or "") != institution_id or target_id == donor.programme_id:
                continue
            result.append(
                Fact(
                    programme_id=target_id,
                    field_name=field,
                    value=donor.value,
                    level="H2",
                    scope="institution",
                    donor_entity=donor.source_url,
                    donor_name=str(target.get("institution_name") or institution_id),
                    source_url=donor.source_url,
                    source_hash=donor.source_hash,
                    raw_document_id=donor.raw_document_id,
                    provider=donor.provider,
                    source_authority=donor.source_authority,
                    source_relationship=donor.source_relationship,
                    uncertainty="MEDIUM",
                    provenance="Explicit policy-labelled fact reused for the same canonical institution; advisory only.",
                    original_status="POLICY_FANOUT",
                )
            )
    return result


def persisted_donor_facts(
    *,
    target_rows: Mapping[str, Mapping[str, Any]],
    programme_rows: Mapping[str, Mapping[str, Any]],
) -> list[Fact]:
    all_rows = read_jsonl(RUN_DIR / "effective_field_assertions.jsonl") + read_jsonl(RUN_DIR / "field_assertions.jsonl")
    seen: set[str] = set()
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in all_rows:
        assertion_id = str(row.get("assertion_id") or "")
        if assertion_id and assertion_id in seen:
            continue
        if assertion_id:
            seen.add(assertion_id)
        raw_field = str(row.get("field_name") or "")
        field = FIELD_ALIASES.get(raw_field, raw_field)
        status = str(row.get("verification_status") or "")
        if status != "RULE_VALIDATED" and not (status == "NEEDS_REVIEW" and field in REVIEW_DONOR_FIELDS):
            continue
        donor_id = str(row.get("entity_id") or "")
        donor = programme_rows.get(donor_id)
        if donor is None or str(donor.get("institution_id") or "") not in {str(target.get("institution_id") or "") for target in target_rows.values()}:
            continue
        donor_institution = str(donor.get("institution_id") or "")
        for component_field, value, source_row in expanded_document_rows(row, field):
            if component_field not in RAW_CANONICAL or not has_value(value):
                continue
            if component_field in {"tuition", "additional_fees"}:
                if not isinstance(value, dict) or parse_number(value.get("amount")) is None or not norm(value.get("currency")):
                    continue
            if component_field in {"required_documents", *DOCUMENT_FIELDS} and not valid_documents_value(value):
                continue
            scope = str(source_row.get("scope") or "programme")
            if scope not in {"programme", "institution", "department", "parent"}:
                continue
            component_row = dict(source_row)
            component_row["field_name"] = component_field
            component_row["value_json"] = value
            for target_id, target in target_rows.items():
                if target_id == donor_id or donor_institution != str(target.get("institution_id") or ""):
                    continue
                target_degree = folded(target.get("degree_level"))
                donor_degree = folded(donor.get("degree_level"))
                target_field = folded(target.get("normalized_field") or target.get("discipline"))
                donor_field = folded(donor.get("normalized_field") or donor.get("discipline"))
                if component_field not in REUSABLE_SIBLING_FIELDS and target_degree and donor_degree and target_degree != donor_degree:
                    continue
                if component_field not in REUSABLE_SIBLING_FIELDS and component_field not in CAUTIOUS_SIBLING_FIELDS and target_field and donor_field and target_field != donor_field:
                    continue
                level = "H1" if scope in {"department", "parent"} else "H2" if scope == "institution" else "H3"
                grouped[(target_id, component_field, level)].append({"row": component_row, "donor": donor})

    facts: list[Fact] = []
    for (target_id, field, level), candidates in sorted(grouped.items()):
        values: dict[str, Any] = {}
        for item in candidates:
            value = item["row"].get("value_json")
            values.setdefault(compact(value), value)
        if not values:
            continue
        value: Any = next(iter(values.values())) if len(values) == 1 else list(values.values())
        first = candidates[0]["row"]
        donor = candidates[0]["donor"]
        first_status = str(first.get("verification_status") or "RULE_VALIDATED")
        fact = make_fact(
            programme_id=target_id,
            field_name=field,
            value=value,
            level=level,
            scope=str(first.get("scope") or "programme"),
            donor_entity=str(first.get("entity_id") or ""),
            donor_name=str(donor.get("programme_name") or donor.get("programme_id") or ""),
            source_url=" | ".join(sorted({str(item["row"].get("source_url") or "") for item in candidates if item["row"].get("source_url")})),
            source_hash=str(first.get("source_content_hash") or ""),
            raw_document_id=" | ".join(sorted({str(item["row"].get("raw_document_id") or "") for item in candidates if item["row"].get("raw_document_id")})),
            provider=str(first.get("provider_id") or "persisted_evidence"),
            source_authority=str(first.get("source_authority") or ""),
            source_relationship=str(first.get("source_relationship") or ""),
            uncertainty="HIGH" if first_status == "NEEDS_REVIEW" or len(values) > 1 or field not in REUSABLE_SIBLING_FIELDS else "MEDIUM",
            provenance="Persisted same-institution donor assertion; deterministically reused for advisory MAX_FILL.",
            original_status=first_status,
        )
        if fact is not None:
            facts.append(fact)
    return facts


LEVEL_RANK = {"H0": 0, "H1": 1, "H2": 2, "H3": 3, "H4": 4}


def fact_preference(fact: Fact) -> tuple[int, int, int, str]:
    official = 0 if fact.source_authority in {"OFFICIAL", "GOVERNMENT"} else 1
    uncertain = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}.get(fact.uncertainty, 3)
    return LEVEL_RANK.get(fact.level, 9), official, uncertain, fact.source_url


def base_replay() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[tuple[str, str], dict[str, Any]], dict[tuple[str, str], dict[str, Any]]]:
    production, context = rebuild.build_population()
    production["verified_rows"] = context["final_rows"]
    raw = reports.prepare_data()
    data = rebuild.remap_hierarchy_data(raw, context)
    strict_decisions, _ = reports.run_decisions(data, optimized=True)
    aggressive_decisions, _ = base_max.run_max_fill_decisions(data)
    decisions = base_max.choose_decisions(data, strict_decisions, aggressive_decisions)
    # Generate in temporary folders so the base engine never touches the
    # production or advisory CSV while this module is selecting overlays.
    import tempfile

    with tempfile.TemporaryDirectory(prefix="stage1-max-expand-base-") as base_dir, tempfile.TemporaryDirectory(prefix="stage1-max-expand-strict-") as strict_dir:
        base_outputs = reports.matrix_and_outputs(data, decisions, Path(base_dir))
        strict_outputs = reports.matrix_and_outputs(data, strict_decisions, Path(strict_dir))
    base_rows = rebuild.make_lead_export(base_outputs, production, data)
    strict_rows = rebuild.make_lead_export(strict_outputs, production, data)
    base_by_key = {(str(row["programme_id"]), field): row for row in base_rows for field in CANONICAL_FIELDS}
    strict_by_key = {(str(row["programme_id"]), field): row for row in strict_rows for field in CANONICAL_FIELDS}
    return production, context, data, base_by_key, strict_by_key


def overlay(
    *,
    base_rows: list[dict[str, Any]],
    strict_by_key: Mapping[tuple[str, str], Mapping[str, Any]],
    base_audit: Mapping[tuple[str, str], Mapping[str, Any]],
    facts: list[Fact],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], Counter[str], Counter[str]]:
    by_target = {str(row["programme_id"]): row for row in base_rows}
    candidates: dict[tuple[str, str], list[Fact]] = defaultdict(list)
    for fact in facts:
        candidates[(fact.programme_id, fact.field_name)].append(fact)
    selected: dict[tuple[str, str], Fact] = {}
    for key, values in candidates.items():
        values = sorted(values, key=fact_preference)
        selected[key] = values[0]

    new_by_level: Counter[str] = Counter()
    new_by_field: Counter[str] = Counter()
    source_rows: list[dict[str, Any]] = []
    for pid, row in by_target.items():
        for field in CANONICAL_FIELDS:
            key = (pid, field)
            strict_value = strict_by_key.get(key, {}).get(field, "")
            old_value = row.get(field, "")
            fact = selected.get(key)
            # An explicitly parsed H0 page fact is safer than a stale strict
            # export cell that was previously marked ABSTAINED.  Review-only
            # assertions still cannot overwrite an existing strict value.
            explicit_direct = bool(
                fact
                and fact.level == "H0"
                and fact.original_status in {"PAGE_DETERMINISTIC", "RULE_VALIDATED", "HUMAN_VERIFIED", "DIRECT_ACCEPTED"}
            )
            use_fact = bool(
                fact
                and (
                    not old_value
                    or explicit_direct
                    or (
                        LEVEL_RANK.get(fact.level, 9)
                        < LEVEL_RANK.get(str(base_audit.get(key, {}).get("resolution_level") or "H9"), 9)
                        and not strict_value
                    )
                )
            )
            if use_fact:
                row[field] = serialise_csv(fact.value)
                new_by_level[fact.level] += 1
                new_by_field[f"{fact.level}:{field}"] += 1
                chosen = fact
            else:
                chosen = None
            if chosen is None:
                old_audit = base_audit.get(key, {})
                chosen = Fact(
                    programme_id=pid,
                    field_name=field,
                    value=row.get(field, ""),
                    level=str(old_audit.get("resolution_level") or ("H0" if old_value else "")),
                    scope=str(old_audit.get("field_scope") or "programme"),
                    donor_entity=str(old_audit.get("donor_entity_ids") or ""),
                    donor_name=str(old_audit.get("donor_entities") or ""),
                    source_url=str(old_audit.get("source_url") or ""),
                    source_hash="",
                    raw_document_id=str(old_audit.get("raw_document_ids") or ""),
                    provider=str(old_audit.get("provider") or "existing_strict_export"),
                    source_authority="",
                    source_relationship="",
                    uncertainty=str(old_audit.get("uncertainty") or ""),
                    provenance="Existing strict or hierarchy replay value.",
                    original_status=str(old_audit.get("resolution_status") or "EXISTING"),
                )
            source_rows.append(
                {
                    "programme_id": pid,
                    "programme_name": row.get("programme_name", ""),
                    "institution_id": row.get("institution_id", ""),
                    "field_name": field,
                    "value_json": row.get(field, ""),
                    "resolution_level": chosen.level,
                    "scope": chosen.scope,
                    "donor_entity": chosen.donor_entity,
                    "donor_name": chosen.donor_name,
                    "source_url": chosen.source_url,
                    "source_hash": chosen.source_hash,
                    "raw_document_id": chosen.raw_document_id,
                    "provider": chosen.provider,
                    "source_authority": chosen.source_authority,
                    "source_relationship": chosen.source_relationship,
                    "uncertainty": chosen.uncertainty,
                    "provenance": chosen.provenance,
                    "original_status": chosen.original_status,
                    "is_new": "1" if use_fact else "0",
                }
            )
        # Keep scope columns aligned with the selected tuition/fee fact.
        for field, scope_field in (("tuition", "tuition_scope"), ("additional_fees", "additional_fees_scope")):
            fact = selected.get((pid, field))
            if fact and by_target[pid].get(field) and (not strict_by_key.get((pid, field), {}).get(field) or LEVEL_RANK.get(fact.level, 9) < LEVEL_RANK.get(str(base_audit.get((pid, field), {}).get("resolution_level") or "H9"), 9)):
                row[scope_field] = fact.scope
    # Recompute advisory metadata from the 38 hierarchy fields while retaining
    # the strict direct count in its original column.
    for row in base_rows:
        pid = str(row["programme_id"])
        filled = sum(bool(row.get(field)) for field in HIERARCHY_FIELDS)
        hierarchy_added = sum(1 for item in source_rows if item["programme_id"] == pid and item["is_new"] == "1" and item["resolution_level"] in {"H1", "H2", "H3"})
        row["effective_field_count"] = filled
        row["missing_field_count"] = max(0, len(HIERARCHY_FIELDS) - filled)
        row["effective_completion_pct"] = round(filled / len(HIERARCHY_FIELDS) * 100, 2)
        row["hierarchical_added_field_count"] = int(row.get("hierarchical_added_field_count") or 0) + hierarchy_added
        urls = {item["source_url"] for item in source_rows if item["programme_id"] == pid and item["source_url"]}
        row["final_source_count"] = len(urls)
        row["hierarchical_field_count"] = sum(1 for item in source_rows if item["programme_id"] == pid and item["resolution_level"] in {"H1", "H2", "H3"} and item["value_json"])
    return base_rows, source_rows, new_by_level, new_by_field


def completeness(rows: Iterable[Mapping[str, Any]], fields: Iterable[str]) -> dict[str, float]:
    values = sorted(sum(bool(row.get(field)) for field in fields) / len(tuple(fields)) * 100 for row in rows)
    if not values:
        return {"p25": 0.0, "median": 0.0, "p75": 0.0}
    def pct(fraction: float) -> float:
        pos = (len(values) - 1) * fraction
        lo, hi = int(pos), min(int(pos) + 1, len(values) - 1)
        return round(values[lo] + (values[hi] - values[lo]) * (pos - lo), 2)
    return {"p25": pct(0.25), "median": pct(0.5), "p75": pct(0.75)}


def write_advisory_summary_artifacts(
    *,
    expanded: list[Mapping[str, Any]],
    strict_rows: list[Mapping[str, Any]],
    source_rows: list[Mapping[str, Any]],
) -> None:
    """Write field and programme summaries for the expanded advisory view.

    These summaries deliberately use the canonical MAX_FILL cells and keep
    the strict cell count as the before baseline.  They do not rewrite the
    production hierarchy reports or their semantics.
    """
    strict_by_id = {str(row.get("programme_id")): row for row in strict_rows}
    source_by_key = {
        (str(row.get("programme_id")), str(row.get("field_name"))): row
        for row in source_rows
    }
    field_rows: list[dict[str, Any]] = []
    total = len(expanded)
    for report_field in reports.FIELDS:
        field = FIELD_ALIASES.get(report_field, report_field)
        before = sum(bool(strict_by_id.get(str(row.get("programme_id")), {}).get(field)) for row in expanded)
        selected = [
            source_by_key.get((str(row.get("programme_id")), field), {})
            for row in expanded
        ]
        selected = [row for row in selected if row.get("value_json")]
        level_counts = Counter(str(row.get("resolution_level") or "") for row in selected)
        final = len(selected)
        programme_scope = sum(str(row.get("scope") or "programme") == "programme" for row in selected)
        institution_scope = sum(str(row.get("scope") or "") == "institution" for row in selected)
        after_pct = final / total * 100 if total else 0.0
        before_pct = before / total * 100 if total else 0.0
        field_rows.append(
            {
                "field": report_field,
                "total_targets": total,
                "direct": level_counts.get("H0", 0),
                "H1": level_counts.get("H1", 0),
                "H2": level_counts.get("H2", 0),
                "H3": level_counts.get("H3", 0),
                "H4": level_counts.get("H4", 0),
                "final": final,
                "programme_scope_final": programme_scope,
                "institution_scope_final": institution_scope,
                "review": 0,
                "abstain": 0,
                "missing": max(0, total - final),
                "coverage_before_hierarchy_pct": round(before_pct, 2),
                "coverage_after_hierarchy_pct": round(after_pct, 2),
                "absolute_gain_pp": round(after_pct - before_pct, 2),
                "relative_gain_pct": round((final - before) / before * 100, 2) if before else (100.0 if final else 0.0),
            }
        )
    write_csv(MAX_FIELD_SUMMARY_CSV, reports.FIELD_SUMMARY_COLUMNS, field_rows)

    completeness_rows: list[dict[str, Any]] = []
    for row in sorted(expanded, key=lambda item: str(item.get("programme_id") or "")):
        pid = str(row.get("programme_id") or "")
        strict_row = strict_by_id.get(pid, {})
        strict_direct = int(strict_row.get("direct_field_count") or 0)
        before = int(strict_row.get("effective_field_count") or 0)
        after = sum(bool(row.get(field)) for field in HIERARCHY_FIELDS)
        hierarchical_added = max(0, after - strict_direct)
        completeness_rows.append(
            {
                "programme_id": pid,
                "institution_id": row.get("institution_id", ""),
                "institution_name": row.get("institution_name", ""),
                "programme_name": row.get("programme_name", ""),
                "country": row.get("country", ""),
                "degree_level": row.get("degree_level", ""),
                "discipline": row.get("discipline", ""),
                "total_priority_fields": len(HIERARCHY_FIELDS),
                "direct_field_count": before,
                "hierarchical_added_field_count": hierarchical_added,
                "effective_field_count": after,
                "review_field_count": 0,
                "missing_field_count": max(0, len(HIERARCHY_FIELDS) - after),
                "completion_before_hierarchy_pct": round(before / len(HIERARCHY_FIELDS) * 100, 2) if HIERARCHY_FIELDS else 0.0,
                "completion_after_hierarchy_pct": round(after / len(HIERARCHY_FIELDS) * 100, 2) if HIERARCHY_FIELDS else 0.0,
            }
        )
    write_csv(MAX_COMPLETENESS_CSV, reports.COMPLETENESS_COLUMNS, completeness_rows)


def main() -> None:
    production, context, data, base_by_key, strict_by_key = base_replay()
    base_rows = []
    # Recover the original row order and values from the current base advisory
    # export, which is generated by the same frozen replay above.
    base_by_id: dict[str, dict[str, Any]] = defaultdict(dict)
    for (pid, field), row in base_by_key.items():
        base_by_id[pid] = dict(row)
    base_rows = list(base_by_id.values())
    base_rows.sort(key=lambda row: (str(row.get("country") or ""), str(row.get("institution_name") or ""), str(row.get("programme_name") or "")))

    # The existing max-fill audit is the base source for hierarchy metadata.
    base_audit_rows = list(csv.DictReader((ARTIFACT_DIR / "stage1-programme-max-fill-audit.csv").open(encoding="utf-8-sig"))) if (ARTIFACT_DIR / "stage1-programme-max-fill-audit.csv").exists() else []
    base_audit = {(str(row.get("programme_id")), str(row.get("field_name"))): row for row in base_audit_rows}
    target_rows = {str(row.get("programme_id")): row for row in base_rows}
    programme_rows = {str(row.get("programme_id")): row for row in read_jsonl(RUN_DIR / "programmes.jsonl")}
    pages, page_status = load_pages(base_rows)
    page_facts: list[Fact] = []
    for page in pages.values():
        page_facts.extend(parse_page_facts(page=page, targets=page.get("targets", [])))
    facts: list[Fact] = list(page_facts)
    facts.extend(policy_fanout_facts(page_facts=page_facts, target_rows=target_rows))
    facts.extend(raw_review_facts(target_rows=target_rows, programme_rows=programme_rows))
    facts.extend(catalogue_record_facts(target_rows=target_rows, programme_rows=programme_rows))
    facts.extend(offering_and_metadata_facts(target_rows=target_rows))
    facts.extend(curriculum_facts(target_rows=target_rows))
    facts.extend(persisted_donor_facts(target_rows=target_rows, programme_rows=programme_rows))
    # Stable de-duplication makes the evidence artefact reproducible.
    deduped: dict[tuple[str, str, str, str, str], Fact] = {}
    for fact in facts:
        key = (fact.programme_id, fact.field_name, compact(fact.value), fact.level, fact.source_url)
        deduped.setdefault(key, fact)
    facts = list(deduped.values())
    expanded, source_rows, new_by_level, new_by_field = overlay(
        base_rows=base_rows,
        strict_by_key=strict_by_key,
        base_audit=base_audit,
        facts=facts,
    )
    # Add selected facts as a compact append-only advisory evidence ledger.
    selected_facts: dict[tuple[str, str], Fact] = {}
    for fact in sorted(facts, key=fact_preference):
        selected_facts.setdefault((fact.programme_id, fact.field_name), fact)
    MAX_EVIDENCE_JSONL.write_text(
        "".join(json.dumps({**fact.__dict__, "value_json": fact.value}, ensure_ascii=False, sort_keys=True) + "\n" for fact in sorted(selected_facts.values(), key=lambda item: (item.programme_id, item.field_name))),
        encoding="utf-8",
    )
    write_csv(MAX_CSV, rebuild.LEAD_COLUMNS, expanded)
    write_csv(MAX_AUDIT_CSV, SOURCE_COLUMNS, source_rows)

    strict_rows = list(csv.DictReader(STRICT_CSV.open(encoding="utf-8-sig")))
    write_advisory_summary_artifacts(
        expanded=expanded,
        strict_rows=strict_rows,
        source_rows=source_rows,
    )
    strict_core_total = sum(bool(row.get(field)) for row in strict_rows for field in HIERARCHY_FIELDS)
    max_core_total = sum(bool(row.get(field)) for row in expanded for field in HIERARCHY_FIELDS)
    strict_csv_total = sum(bool(row.get(field)) for row in strict_rows for field in CANONICAL_FIELDS)
    max_csv_total = sum(bool(row.get(field)) for row in expanded for field in CANONICAL_FIELDS)
    improved = sum(
        any(not strict_by_key.get((str(row["programme_id"]), field), {}).get(field) and row.get(field) for field in CANONICAL_FIELDS)
        for row in expanded
    )
    max_hierarchy = Counter(str(row.get("resolution_level") or "") for row in source_rows if row.get("value_json") and str(row.get("resolution_level") or "") in {"H1", "H2", "H3"})
    summary = {
        "population": {
            "verified_programmes": len(expanded),
            "institutions": len({str(row.get("institution_id")) for row in expanded}),
            "synthetic_recipients_excluded": production.get("classifications", {}).get("SYNTHETIC_SEED", 0),
        },
        "strict": {
            "hierarchy_field_denominator": len(HIERARCHY_FIELDS),
            "filled_cells": strict_core_total,
            "csv_core_denominator": len(CANONICAL_FIELDS),
            "filled_csv_core_cells": strict_csv_total,
            "completeness_quantiles": completeness(strict_rows, HIERARCHY_FIELDS),
        },
        "max_fill": {
            "hierarchy_field_denominator": len(HIERARCHY_FIELDS),
            "filled_cells": max_core_total,
            "csv_core_denominator": len(CANONICAL_FIELDS),
            "filled_csv_core_cells": max_csv_total,
            "completeness_quantiles": completeness(expanded, HIERARCHY_FIELDS),
            "new_values_by_level": dict(sorted(new_by_level.items())),
            "new_values_by_field": dict(sorted(new_by_field.items())),
            "applied_hierarchy_levels": dict(sorted(max_hierarchy.items())),
            "facts_considered": len(facts),
            "programmes_improved": improved,
        },
        "evidence": {
            "official_pages_processed": len(pages),
            "official_page_statuses": dict(sorted(page_status.items())),
            "persisted_evidence_facts_selected": len(selected_facts),
            "advisory_evidence_path": str(MAX_EVIDENCE_JSONL),
            "source_audit_path": str(MAX_AUDIT_CSV),
            "paid_llm_calls": 0,
            "new_crawl_calls": 0,
        },
        "rows": len(expanded),
    }
    MAX_SUMMARY_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
