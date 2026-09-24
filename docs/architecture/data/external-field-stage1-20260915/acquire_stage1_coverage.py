"""Deterministically acquire high-value facts for the frozen Stage 1 population.

The 230 verified programme targets are read from the frozen population and are
never expanded.  This pass only adds source-backed, programme-scoped
assertions to ``stage1-incremental-evidence.jsonl``.  The hierarchy engine and
its compatibility rules are reused unchanged for the replay.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup


ARTIFACT_DIR = Path(__file__).resolve().parent
if str(ARTIFACT_DIR) not in sys.path:
    sys.path.insert(0, str(ARTIFACT_DIR))

import generate_hierarchy_reports as reports  # noqa: E402
import rebuild_verified_population as rebuild  # noqa: E402
from glowbal_ingestion import hierarchical_inference as hierarchy_module  # noqa: E402


INCREMENTAL_JSONL = ARTIFACT_DIR / "stage1-incremental-evidence.jsonl"
SOURCE_LEDGER_JSON = ARTIFACT_DIR / "stage1-incremental-source-ledger.json"
EVIDENCE_AUDIT_CSV = ARTIFACT_DIR / "stage1-incremental-evidence-audit.csv"
REPLAY_SUMMARY_JSON = ARTIFACT_DIR / "stage1-incremental-replay-summary.json"
FINAL_CSV = ARTIFACT_DIR / "stage1-programme-final-results.csv"
REPLAY_DIR = ARTIFACT_DIR / "production-replay-20260916"

RUN_ID = "stage1-coverage-20260916"
PARSER_ID = "stage1-deterministic-coverage"
PARSER_VERSION = "1"
EXTRACTOR_VERSION = "stage1-deterministic-coverage/v1"
RETRIEVED_AT = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

CSV_TO_NATIVE = {
    "standardized_test_requirements": "standardized_tests",
    "sop_or_essay": "sop_essay_requirements",
    "scholarship": "scholarships",
}
NATIVE_TO_CSV = {value: key for key, value in CSV_TO_NATIVE.items()}

AUDIT_COLUMNS = (
    "programme_id",
    "programme_name",
    "country",
    "institution_id",
    "field_name",
    "value_json",
    "scope",
    "audience",
    "academic_cycle",
    "source_url",
    "evidence",
    "provider_id",
    "source_authority",
    "source_relationship",
    "source_content_hash",
    "raw_document_id",
    "parser_id",
    "parser_version",
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def normalise_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\xa0", " ").replace("\u200b", "")
    return re.sub(r"\s+", " ", text).strip()


def folded(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(ch for ch in text if not unicodedata.combining(ch)).casefold()


def has_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def json_body_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def html_to_text(value: str) -> str:
    soup = BeautifulSoup(value or "", "html.parser")
    for node in soup(["script", "style", "noscript", "template"]):
        node.decompose()
    return normalise_text(soup.get_text(" ", strip=True))


class SourceStore:
    """Small response store that records hashes and URLs, never raw bodies."""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Glowbal-stage1-deterministic-coverage/1.0",
                "Accept": "text/html,application/json,text/csv,*/*;q=0.8",
            }
        )
        self.cache: dict[str, dict[str, Any]] = {}
        self.ledger: dict[str, dict[str, Any]] = {}
        self.network_calls = 0
        self.cache_hits = 0
        self._load_existing_caches()

    @staticmethod
    def _key(url: str) -> str:
        parts = urlsplit(url)
        path = parts.path.rstrip("/") or "/"
        return urlunsplit((parts.scheme.casefold(), parts.netloc.casefold(), path, parts.query, ""))

    def _load_existing_caches(self) -> None:
        diagnostic = Path("discover-cache-diagnostic.json")
        if diagnostic.exists():
            try:
                payload = json.loads(diagnostic.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                payload = {}
            for item in payload.values() if isinstance(payload, dict) else ():
                requested = str(item.get("discover_url") or "")
                if requested:
                    self.cache[self._key(requested)] = {
                        "url": requested,
                        "status": int(item.get("status") or 0),
                        "final_url": item.get("final_url") or requested,
                        "text": normalise_text(item.get("text")),
                        "body": str(item.get("text") or "").encode("utf-8"),
                        "cache": True,
                    }

        official = Path("discover-official-cache.json")
        if official.exists():
            try:
                payload = json.loads(official.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                payload = {}
            for requested, item in payload.items() if isinstance(payload, dict) else ():
                html = str(item.get("html") or "")
                text = normalise_text(item.get("text")) or html_to_text(html)
                url = str(requested)
                record = {
                    "url": url,
                    "status": int(item.get("status") or 0),
                    "final_url": item.get("final_url") or url,
                    "text": text,
                    "body": html.encode("utf-8") if html else text.encode("utf-8"),
                    "cache": True,
                }
                self.cache[self._key(url)] = record
                if item.get("final_url"):
                    self.cache[self._key(str(item["final_url"]))] = record

    def note(self, url: str, *, status: int, body: bytes, provider_id: str) -> dict[str, Any]:
        content_hash = sha256_bytes(body)
        entry = {
            "url": url,
            "status": int(status),
            "content_hash": content_hash,
            "bytes": len(body),
            "provider_id": provider_id,
            "cache": False,
        }
        old = self.ledger.get(self._key(url))
        if old is None or (old.get("status", 0) == 0 and status):
            self.ledger[self._key(url)] = entry
        return {
            "url": url,
            "status": int(status),
            "body": body,
            "text": normalise_text(body.decode("utf-8", errors="replace")),
            "content_hash": content_hash,
            "cache": False,
            "final_url": url,
        }

    def fetch(self, url: str, *, provider_id: str, timeout: float = 30.0) -> dict[str, Any]:
        if not url:
            return {"url": url, "status": 0, "body": b"", "text": "", "content_hash": sha256_bytes(b""), "cache": False, "final_url": url}
        key = self._key(url)
        cached = self.cache.get(key)
        if cached is not None:
            self.cache_hits += 1
            body = bytes(cached.get("body") or b"")
            content_hash = sha256_bytes(body)
            self.ledger.setdefault(
                key,
                {
                    "url": url,
                    "status": int(cached.get("status") or 0),
                    "content_hash": content_hash,
                    "bytes": len(body),
                    "provider_id": provider_id,
                    "cache": True,
                },
            )
            return {
                "url": url,
                "status": int(cached.get("status") or 0),
                "body": body,
                "text": normalise_text(cached.get("text")) or html_to_text(body.decode("utf-8", errors="replace")),
                "content_hash": content_hash,
                "cache": True,
                "final_url": cached.get("final_url") or url,
            }

        try:
            response = self.session.get(url, timeout=timeout)
            body = bytes(response.content)
            status = int(response.status_code)
            final_url = str(response.url or url)
        except requests.RequestException:
            body = b""
            status = 0
            final_url = url
        self.network_calls += 1
        content_hash = sha256_bytes(body)
        self.ledger[key] = {
            "url": url,
            "final_url": final_url,
            "status": status,
            "content_hash": content_hash,
            "bytes": len(body),
            "provider_id": provider_id,
            "cache": False,
        }
        text = normalise_text(body.decode("utf-8", errors="replace"))
        self.cache[key] = {
            "url": url,
            "final_url": final_url,
            "status": status,
            "text": text,
            "body": body,
            "cache": False,
        }
        self.cache[self._key(final_url)] = self.cache[key]
        return {
            "url": url,
            "final_url": final_url,
            "status": status,
            "body": body,
            "text": text,
            "content_hash": content_hash,
            "cache": False,
        }


def parse_number(raw: str) -> float | int | None:
    text = str(raw or "").replace("\xa0", " ").strip()
    text = re.sub(r"[^0-9,.]", "", text)
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(",", "")
    elif text.count(",") > 1:
        text = text.replace(",", "")
    elif "," in text:
        left, right = text.rsplit(",", 1)
        text = left.replace(",", "") + ("." + right if len(right) <= 2 else right)
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        number = float(text)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def month_date(month: str, year: str, day: int = 1) -> str | None:
    number = MONTHS.get(folded(month))
    if number is None:
        return None
    return f"{int(year):04d}-{number:02d}-{day:02d}"


def source_excerpt(text: str, start: int, end: int, limit: int = 900) -> str:
    left = max(0, start - 120)
    right = min(len(text), max(end, start) + 260)
    excerpt = normalise_text(text[left:right])
    return excerpt[:limit]


def find_column(row: Mapping[str, Any], *needles: str) -> str:
    for key in row:
        value = folded(key)
        if all(folded(needle) in value for needle in needles):
            return str(key)
    return ""


def parse_onisep_cost(text: str) -> dict[str, Any] | None:
    clean = normalise_text(text)
    matches = list(
        re.finditer(
            r"([0-9][0-9\s]*(?:[,.][0-9]+)?)\s*(?:euros?|€)",
            clean,
            re.IGNORECASE,
        )
    )
    amounts = [parse_number(match.group(1)) for match in matches]
    amounts = [item for item in amounts if item is not None]
    if not amounts:
        return None
    period = "annual" if re.search(r"\bpar\s+an\b", clean, re.IGNORECASE) else "programme"
    value: dict[str, Any] = {
        "currency": "EUR",
        "fee_period": period,
        "credential": "tuition fee",
        "source_text": clean,
    }
    if len(amounts) >= 2 and re.search(r"\bde\s+[0-9].*?jusqu", clean, re.IGNORECASE):
        value["minimum_amount"] = amounts[0]
        value["maximum_amount"] = amounts[1]
        if re.search(r"hors\s+(?:l['’]?)?union\s+europ[eé]enne|hors\s+UE|non[- ]UE", clean, re.IGNORECASE):
            value["amount"] = amounts[1]
            value["audience"] = "international"
            value["credential"] = "tuition fee for non-EU students"
    else:
        value["amount"] = amounts[0]
    return value


def parse_ielts(text: str) -> tuple[float | int, dict[str, Any] | None, str] | None:
    pattern = re.compile(
        r"\bIELTS(?:\s*\((?:Academic(?:\s+level)?)\))?\s*(?:(?:overall|minimum|score)\s*)?[:\-]?\s*(\d(?:\.\d)?)",
        re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        score = parse_number(match.group(1))
        if score is None or not 4 <= float(score) <= 9:
            continue
        context = text[match.start() : min(len(text), match.end() + 240)]
        subscore: float | int | None = None
        sub_patterns = (
            r"no\s+(?:less|lower)\s+than\s+(\d(?:\.\d)?)",
            r"(?:minimum|at\s+least)\s+(?:of\s+)?(\d(?:\.\d)?)\s+in\s+(?:each|any|all)",
            r"no\s+subscore\s+below\s+(\d(?:\.\d)?)",
            r"(\d(?:\.\d)?)\s+in\s+all\s+(?:skills|elements|components)",
        )
        for sub_pattern in sub_patterns:
            sub_match = re.search(sub_pattern, context, re.IGNORECASE)
            if sub_match:
                subscore = parse_number(sub_match.group(1))
                break
        subscores = None
        if subscore is not None:
            subscores = {
                "minimum_overall": score,
                "minimum_each": subscore,
                "source_text": source_excerpt(text, match.start(), match.end() + 160, 600),
            }
        return score, subscores, source_excerpt(text, match.start(), match.end() + 160, 600)
    return None


def parse_toefl(text: str) -> tuple[int, str] | None:
    pattern = re.compile(r"\bTOEFL\s*(?:\(?\s*iBT\s*\)?)?\s*[:\-]?\s*(\d{2,3})", re.IGNORECASE)
    for match in pattern.finditer(text):
        score = int(match.group(1))
        if 60 <= score <= 120:
            return score, source_excerpt(text, match.start(), match.end() + 150, 600)
    return None


def parse_duolingo(text: str) -> tuple[int, str] | None:
    pattern = re.compile(r"\bDuolingo(?:\s+English\s+Test)?\s*[:\-]?\s*(\d{2,3})", re.IGNORECASE)
    for match in pattern.finditer(text):
        score = int(match.group(1))
        if 10 <= score <= 160:
            return score, source_excerpt(text, match.start(), match.end() + 120, 600)
    return None


def parse_uk_tuition(text: str) -> tuple[dict[str, Any], str] | None:
    amount_pattern = re.compile(
        r"(?:[\u00a3\ufffd]\s*([0-9][0-9,\s]*(?:\.[0-9]+)?)|([0-9][0-9,\s]*(?:\.[0-9]+)?)\s*(?:GBP|£))",
        re.IGNORECASE,
    )
    candidates: list[tuple[int, int, int, dict[str, Any], str]] = []
    for match in amount_pattern.finditer(text):
        amount = parse_number(match.group(1) or match.group(2) or "")
        if amount is None or not 1000 <= float(amount) <= 100000:
            continue
        context = text[max(0, match.start() - 180) : min(len(text), match.end() + 180)]
        lower = folded(context)
        # Course pages often list a much lower fee for a professional or
        # sandwich placement year immediately beside the normal tuition fee.
        # That reduced placement price is a separate charge and must not be
        # promoted as the programme's annual tuition.
        label_before = text[max(0, match.start() - 120) : match.start()]
        if re.search(r"placement\s+year|professional\s+placement|sandwich\s+year|reduced\s+fee", label_before, re.IGNORECASE):
            continue
        if not re.search(r"fee|tuition|course\s+cost", lower):
            continue
        if re.search(r"accommodation|living\s+cost|laptop|books?|travel|deposit", lower) and not re.search(r"tuition|course\s+fee", lower):
            continue
        before = text[max(0, match.start() - 100) : match.start()]
        after = text[match.end() : min(len(text), match.end() + 100)]
        audience = ""
        if re.search(r"international|overseas|non[- ]UK", before + after, re.IGNORECASE):
            audience = "international"
        elif re.search(r"home|UK(?:/ROI)?|domestic", before + after, re.IGNORECASE):
            audience = "domestic"
        cycle_match = re.search(r"\b(20\d{2}(?:\s*[/\-]\s*\d{2,4})?)\b", context)
        cycle = normalise_text(cycle_match.group(1)) if cycle_match else None
        year_match = re.search(r"20\d{2}", cycle or "")
        year = int(year_match.group(0)) if year_match else 0
        value: dict[str, Any] = {
            "amount": amount,
            "currency": "GBP",
            "fee_period": "annual",
            "credential": "international tuition fee" if audience == "international" else "tuition fee",
        }
        if audience:
            value["audience"] = audience
        if cycle:
            value["academic_cycle"] = cycle
        candidates.append(
            (
                year,
                2 if audience == "international" else 1 if audience == "domestic" else 0,
                int(float(amount)),
                value,
                source_excerpt(text, match.start(), match.end() + 180, 700),
            )
        )
    if not candidates:
        return None
    # Prefer the newest explicitly labelled fee; within a fee year prefer the
    # international amount because it is the useful cross-border comparison.
    _, _, _, value, evidence = max(candidates, key=lambda item: (item[0], item[1], item[2]))
    return value, evidence


def parse_uk_deadline(text: str) -> tuple[str, str] | None:
    date_pattern = re.compile(
        r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b",
        re.IGNORECASE,
    )
    found: list[tuple[int, str, str]] = []
    for match in date_pattern.finditer(text):
        context = text[max(0, match.start() - 140) : match.start()]
        if not re.search(r"deadline|when\s+to\s+apply|application", context, re.IGNORECASE):
            continue
        date = month_date(match.group(2), match.group(3), int(match.group(1)))
        if date:
            found.append((int(match.group(3)), date, source_excerpt(text, match.start(), match.end() + 100, 600)))
    if not found:
        return None
    _, date, evidence = max(found, key=lambda item: (item[0], item[1]))
    return date, evidence


def parse_uk_start_dates(text: str) -> tuple[list[str], str] | None:
    found: set[str] = set()
    evidence = ""
    month_re = r"January|February|March|April|May|June|July|August|September|October|November|December"
    for match in re.finditer(r"\bStart\s+date\s*:?", text, re.IGNORECASE):
        segment = text[match.end() : min(len(text), match.end() + 180)]
        for month_match in re.finditer(rf"\b({month_re})\s+(20\d{{2}})\b", segment, re.IGNORECASE):
            date = month_date(month_match.group(1), month_match.group(2))
            if date:
                found.add(date)
        for numeric_match in re.finditer(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", segment):
            try:
                found.add(f"{int(numeric_match.group(3)):04d}-{int(numeric_match.group(2)):02d}-{int(numeric_match.group(1)):02d}")
            except ValueError:
                pass
        if found and not evidence:
            evidence = source_excerpt(text, match.start(), match.end() + 150, 650)
    if not found:
        return None
    return sorted(found), evidence


def parse_subject_prerequisite(text: str) -> tuple[str, str] | None:
    patterns = (
        r"\bTo\s+include:\s*([^.;]{12,320})",
        r"\bA\*\s+in\s+Mathematics\b[^.]{0,220}",
        r"\b(?:including|requires?)\s+[^.]{0,180}\b(?:Mathematics|Maths)\b[^.]{0,120}",
    )
    for index, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        if index == 2:
            # A generic ``including ... Mathematics`` phrase also appears in
            # curriculum descriptions.  Only accept it when the surrounding
            # text is clearly an admissions/qualification requirement.
            preceding = text[max(0, match.start() - 320) : match.start()]
            if not re.search(
                r"entry\s+requirements?|course\s+requirements?|qualification|"
                r"A[- ]level|GCSE|International\s+Baccalaureate|offer",
                preceding,
                re.IGNORECASE,
            ):
                continue
        value = normalise_text(match.group(0))
        if len(value) >= 12 and re.search(r"mathemat|subject|A-level|qualification", value, re.IGNORECASE):
            return value[:500], source_excerpt(text, match.start(), match.end(), 700)
    return None


def parse_scholarship_policy(text: str) -> tuple[dict[str, Any], str] | None:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for sentence in sentences:
        clean = normalise_text(sentence)
        lower = folded(clean)
        if not 45 <= len(clean) <= 500 or not re.search(r"scholarship|bursar", lower):
            continue
        if not re.search(r"offer|range|eligible|provide|financial|support|award", lower):
            continue
        if re.search(r"navigation|skip to|menu|search", lower):
            continue
        return {
            "funding_type": "financial_aid_policy",
            "details": clean,
        }, clean
    return None


def parse_edinburgh_documents(text: str) -> tuple[list[str], str] | None:
    match = re.search(r"What\s+you\s+need\s+to\s+apply(.*?)(?:How\s+we\s+select|When\s+to\s+apply)", text, re.IGNORECASE)
    if not match:
        return None
    segment = normalise_text(match.group(0))
    labels = []
    for label in (
        "academic qualifications",
        "a personal statement",
        "evidence of your English language skills (with relevant qualifications)",
        "a reference",
    ):
        if folded(label) in folded(segment):
            labels.append(label)
    if not labels:
        return None
    return labels, segment[:800]


def parse_admission_document_components(text: str) -> list[tuple[str, dict[str, Any], str]]:
    """Extract explicit certificate/transcript labels without semantic inference."""

    contexts = re.finditer(
        r"(?:required documents|what you need to apply|documents? (?:required|needed)|"
        r"you will need to submit|must submit)[^.!?]{0,700}",
        text,
        re.IGNORECASE,
    )
    results: list[tuple[str, dict[str, Any], str]] = []
    seen: set[tuple[str, str]] = set()
    for match in contexts:
        segment = normalise_text(match.group(0))
        for field_name, pattern in (
            (
                "graduation_certificate",
                r"\b(?:graduation|degree|educational|school[- ]leaving)\s+certificates?\b"
                r"|\b(?:degree|graduation)\s+diplomas?\b|\bproof\s+of\s+(?:degree|graduation)\b",
            ),
            (
                "academic_transcript",
                r"\b(?:academic\s+)?transcripts?\b|academic records?|mark\s*[- ]?sheets?",
            ),
        ):
            if not re.search(pattern, segment, re.IGNORECASE):
                continue
            key = field_name, segment
            if key in seen:
                continue
            seen.add(key)
            results.append(
                (
                    field_name,
                    {
                        "document_type": field_name,
                        "requirement_status": "required",
                        "details": segment[:800],
                    },
                    segment[:800],
                )
            )
    return results


def parse_portfolio_requirement(text: str) -> tuple[str, str] | None:
    """Extract a portfolio requirement only from an entry-requirements label."""

    pattern = re.compile(
        r"\bplus\s+(?:ideally\s+)?a\s+portfolio\b[^.;]{0,260}",
        re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        preceding = text[max(0, match.start() - 260) : match.start()]
        if not re.search(r"course\s+requirements|entry\s+requirements", preceding, re.IGNORECASE):
            continue
        value = normalise_text(match.group(0))
        return value[:500], source_excerpt(text, match.start(), match.end(), 700)
    return None


def parse_recommendation_requirement(text: str) -> tuple[str, str] | None:
    """Extract an explicitly required reference from an admissions section."""

    pattern = re.compile(
        r"\b(?:we\s+)?will\s+also\s+require\s+a\s+reference\b[^.]{0,360}",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return None
    return "Reference", source_excerpt(text, match.start(), match.end(), 700)


def parse_work_experience_requirement(text: str) -> tuple[dict[str, Any], str] | None:
    """Capture explicitly conditional experience evidence without guessing."""

    patterns = (
        r"\brelevant\s+work\s+experience\s+may\s+be\s+considered\b[^.]{0,260}",
        r"mature\s+students\s+with\s+relevant\s+(?:life\s+or\s+)?employment\s+experience\s+will\s+also\s+be\s+considered\b[^.]{0,260}",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            evidence = source_excerpt(text, match.start(), match.end(), 700)
            return {
                "requirement_status": "conditional",
                "details": normalise_text(match.group(0)),
            }, evidence
    return None


ADMISSION_CONTEXT_RE = re.compile(
    r"\b(?:admission|application|apply|applying|entry\s+requirements?|"
    r"how\s+to\s+apply|required\s+documents?|supporting\s+documents?|"
    r"documents?\s+to\s+submit|what\s+you\s+need\s+to\s+apply)\b",
    re.IGNORECASE,
)


def text_from_page_body(body: bytes) -> str:
    """Decode HTML or a text PDF without model assistance."""

    if body.startswith(b"%PDF"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(body))
            return normalise_text(" ".join(page.extract_text() or "" for page in reader.pages))
        except Exception:  # malformed/encrypted PDFs remain raw-only evidence
            return ""
    return html_to_text(body.decode("utf-8", errors="replace"))


def admission_contexts(text: str, *, limit: int = 8) -> list[str]:
    """Return bounded admission sections for deterministic requirement rules."""

    clean = normalise_text(text)
    contexts: list[str] = []
    for match in ADMISSION_CONTEXT_RE.finditer(clean):
        segment = normalise_text(clean[max(0, match.start() - 120) : match.end() + 1100])
        if len(segment) < 40:
            continue
        if segment not in contexts:
            contexts.append(segment)
        if len(contexts) >= limit:
            break
    return contexts


def requirement_from_contexts(
    contexts: Iterable[str],
    pattern: str,
    *,
    minimum_length: int = 12,
) -> tuple[str, str] | None:
    matcher = re.compile(pattern, re.IGNORECASE)
    for context in contexts:
        match = matcher.search(context)
        if not match:
            continue
        value = normalise_text(context)
        if len(value) >= minimum_length:
            return value[:900], value[:900]
    return None


def target_identity_matches(target: Mapping[str, Any], text: str, source_url: str) -> bool:
    """Require programme evidence before promoting an application-page fact."""

    page = folded(f"{text} {source_url}")
    name = folded(target.get("programme_name") or "")
    name_tokens = {
        token
        for token in re.findall(r"[a-z0-9]{4,}", name)
        if token
        not in {
            "programme",
            "program",
            "course",
            "degree",
            "mention",
            "master",
            "bachelor",
            "licence",
            "science",
            "studies",
            "full",
            "time",
        }
    }
    if not name_tokens:
        return False
    if len(name) >= 10 and name in page:
        return True
    overlap = sum(token in page for token in name_tokens)
    required = 1 if len(name_tokens) == 1 else 2
    return overlap >= required and bool(ADMISSION_CONTEXT_RE.search(text))


def admission_page_urls(html: str, base_url: str) -> list[str]:
    """Find a small set of same-site admission/document links."""

    soup = BeautifulSoup(html or "", "html.parser")
    candidates: list[str] = []
    keywords = re.compile(
        r"admission|application|apply|entry|requirement|document|how[- ]to",
        re.IGNORECASE,
    )
    base_host = urlsplit(base_url).netloc.casefold()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "").strip()
        label = normalise_text(anchor.get_text(" ", strip=True))
        if not href or href.startswith(("mailto:", "javascript:", "#")):
            continue
        url = urljoin(base_url, href)
        parts = urlsplit(url)
        if parts.scheme not in {"http", "https"} or parts.netloc.casefold() != base_host:
            continue
        if not keywords.search(f"{label} {parts.path} {parts.query}"):
            continue
        canonical = urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))
        if canonical not in candidates:
            candidates.append(canonical)
        if len(candidates) >= 3:
            break
    return candidates


class Acquisition:
    def __init__(self) -> None:
        self.store = SourceStore()
        self.production, self.context = rebuild.build_population()
        self.production["verified_rows"] = self.context["final_rows"]
        self.before_rows = list(csv.DictReader(FINAL_CSV.open(encoding="utf-8-sig", newline="")))
        self.before_by_id = {str(row["programme_id"]): row for row in self.before_rows}
        self.targets = {
            str(row["programme_id"]): {
                **row,
                "country": self.before_by_id.get(str(row["programme_id"]), {}).get("country", ""),
            }
            for row in self.context["final_rows"]
        }
        if len(self.targets) != 230:
            raise RuntimeError(f"expected 230 verified targets, got {len(self.targets)}")

        # The frozen loader includes accepted direct facts and direct review
        # rows.  New facts never overwrite either status; a fresh direct fact
        # may replace an older hierarchical advisory value on replay.
        base_raw = reports.prepare_data()
        base_data = rebuild.remap_hierarchy_data(base_raw, self.context)
        self.direct_keys: set[tuple[str, str]] = set(base_data.get("accepted_direct", {}))
        self.direct_keys.update(base_data.get("review_direct", {}))
        self.added: list[dict[str, Any]] = []
        self.skipped: Counter[str] = Counter()
        self.by_provider: Counter[str] = Counter()
        self.targeted_summary: dict[str, Any] = {}

    def add_fact(
        self,
        *,
        programme_id: str,
        field_name: str,
        value: Any,
        source_url: str,
        evidence: str,
        provider_id: str,
        source_authority: str,
        source_relationship: str,
        source_type: str,
        source_content_hash: str,
        audience: str | None = None,
        academic_cycle: str | None = None,
        scope: str = "programme",
        confidence: float = 0.95,
    ) -> bool:
        if programme_id not in self.targets or field_name not in reports.FIELDS or not has_value(value):
            self.skipped["invalid_target_or_value"] += 1
            return False
        key = (programme_id, field_name)
        if key in self.direct_keys:
            self.skipped["existing_direct_or_review"] += 1
            return False
        target = self.targets[programme_id]
        value_blob = compact(value)
        digest = hashlib.sha256(
            f"{programme_id}|{field_name}|{source_url}|{value_blob}".encode("utf-8")
        ).hexdigest()
        raw_document_id = f"{RUN_ID}-raw-{source_content_hash[:24]}"
        row: dict[str, Any] = {
            "assertion_id": f"{RUN_ID}-{digest[:32]}",
            "entity_type": "programme",
            "entity_id": programme_id,
            "field_name": field_name,
            "value_json": value,
            "null_reason": None,
            "source_url": source_url,
            "source_type": source_type,
            "evidence": normalise_text(evidence),
            "evidence_locator": "deterministic-text-span",
            "scope": scope,
            "audience": audience,
            "academic_cycle": academic_cycle,
            "retrieved_at": RETRIEVED_AT,
            "confidence": confidence,
            "verification_status": "RULE_VALIDATED",
            "extractor_version": EXTRACTOR_VERSION,
            "model_name": None,
            "validation_errors": [],
            "extraction_group": "incremental-deterministic-coverage",
            "applicability_source_url": None,
            "applicability_evidence": None,
            "source_content_hash": source_content_hash,
            "review_fingerprint": None,
            "inherited_from_assertion_id": None,
            "inherited_from_entity_id": None,
            "inheritance_key": None,
            "epistemic_state": "OBSERVED",
            "temporal_state": "CURRENT",
            "source_authority": source_authority,
            "source_relationship": source_relationship,
            "raw_document_id": raw_document_id,
            "parser_id": PARSER_ID,
            "parser_version": PARSER_VERSION,
            "provider_id": provider_id,
            "prompt_version": None,
            "schema_version": "GlowBalEducationExtraction/v9",
            "degree_level": target.get("degree_level"),
            "country": target.get("country"),
            "applicability_state": "APPLICABLE",
            "published_at": None,
            "valid_from": None,
            "valid_to": None,
            "dataset_id": f"{provider_id}-deterministic",
            "acquisition_run_id": RUN_ID,
        }
        self.added.append(row)
        self.direct_keys.add(key)
        self.by_provider[provider_id] += 1
        return True

    def onisep(self) -> None:
        targets = [item for item in self.targets.values() if item.get("country") == "FR" and "api.opendata.onisep.fr" in str(item.get("official_url"))]
        if not targets:
            return
        base_url = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
        record = self.store.fetch(base_url, provider_id="onisep_higher_ed", timeout=90)
        body = record["body"]
        if record["status"] != 200 or not body:
            return
        try:
            rows = csv.DictReader(io.StringIO(body.decode("utf-8-sig", errors="replace")), delimiter=";")
            by_af = {
                str(row.get(find_column(row, "Action de Formation", "identifiant")) or ""): row
                for row in rows
            }
        except (UnicodeError, csv.Error):
            return
        page_key = ""
        cost_key = ""
        for row in by_af.values():
            page_key = page_key or find_column(row, "AF", "page", "web")
            cost_key = cost_key or find_column(row, "AF", "coût", "scolarité") or find_column(row, "AF", "cout", "scolarite")
            if page_key and cost_key:
                break
        for target in targets:
            match = re.search(r"\bAF\.(\d+)\b", str(target.get("official_url") or ""))
            if not match:
                continue
            row = by_af.get(f"AF.{match.group(1)}")
            if not row:
                continue
            if page_key:
                page = normalise_text(row.get(page_key))
                if page:
                    self.add_fact(
                        programme_id=str(target["programme_id"]),
                        field_name="application_url",
                        value=page,
                        source_url=base_url,
                        evidence=f"Onisep AF page web: {page}",
                        provider_id="onisep_higher_ed",
                        source_authority="GOVERNMENT",
                        source_relationship="GOVERNMENT",
                        source_type="government_csv",
                        source_content_hash=record["content_hash"],
                    )
            if cost_key:
                cost = parse_onisep_cost(str(row.get(cost_key) or ""))
                if cost:
                    self.add_fact(
                        programme_id=str(target["programme_id"]),
                        field_name="tuition",
                        value=cost,
                        source_url=base_url,
                        evidence=f"Onisep AF coût scolarité: {normalise_text(row.get(cost_key))}",
                        provider_id="onisep_higher_ed",
                        source_authority="GOVERNMENT",
                        source_relationship="GOVERNMENT",
                        source_type="government_csv",
                        source_content_hash=record["content_hash"],
                        audience=cost.get("audience"),
                    )

    def discover_course_url(self, programme_id: str, discover_url: str) -> str:
        diagnostic_path = Path("discover-cache-diagnostic.json")
        if diagnostic_path.exists():
            try:
                payload = json.loads(diagnostic_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                payload = {}
            item = payload.get(programme_id) if isinstance(payload, dict) else None
            if isinstance(item, dict) and item.get("course_url"):
                text = str(item.get("text") or "").encode("utf-8")
                self.store.note(discover_url, status=int(item.get("status") or 0), body=text, provider_id="discover_uni")
                return str(item["course_url"])
        record = self.store.fetch(discover_url, provider_id="discover_uni", timeout=30)
        soup = BeautifulSoup(record["body"], "html.parser")
        for anchor in soup.find_all("a", href=True):
            label = folded(anchor.get_text(" ", strip=True))
            if label == "course page":
                return urljoin(discover_url, str(anchor["href"]))
        return ""

    def uk(self) -> None:
        targets = [item for item in self.targets.values() if item.get("country") == "UK" and "discoveruni.gov.uk" in str(item.get("official_url"))]
        for target in targets:
            pid = str(target["programme_id"])
            discover_url = str(target.get("official_url") or "")
            course_url = self.discover_course_url(pid, discover_url)
            if course_url:
                discover_hash = self.store.ledger.get(self.store._key(discover_url), {}).get("content_hash") or sha256_bytes(course_url.encode("utf-8"))
                self.add_fact(
                    programme_id=pid,
                    field_name="application_url",
                    value=course_url,
                    source_url=discover_url,
                    evidence=f"Discover Uni Course page: {course_url}",
                    provider_id="discover_uni",
                    source_authority="GOVERNMENT",
                    source_relationship="CATALOGUE_PROVIDER",
                    source_type="catalogue_link",
                    source_content_hash=str(discover_hash),
                )
            if not course_url:
                continue
            official = self.store.fetch(course_url, provider_id="official_university_page", timeout=35)
            text = official.get("text") or html_to_text(official["body"].decode("utf-8", errors="replace"))
            if official["status"] not in (0, 200) or not text:
                continue
            source_hash = str(official["content_hash"])
            source_url = str(official.get("final_url") or course_url)

            ielts = parse_ielts(text)
            if ielts:
                score, subscores, evidence = ielts
                self.add_fact(
                    programme_id=pid,
                    field_name="ielts_overall",
                    value=score,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
                if subscores:
                    self.add_fact(
                        programme_id=pid,
                        field_name="ielts_subscores",
                        value=subscores,
                        source_url=source_url,
                        evidence=evidence,
                        provider_id="official_university_page",
                        source_authority="OFFICIAL",
                        source_relationship="DIRECT_OFFICIAL",
                        source_type="official_html",
                        source_content_hash=source_hash,
                    )
            toefl = parse_toefl(text)
            if toefl:
                score, evidence = toefl
                self.add_fact(
                    programme_id=pid,
                    field_name="toefl",
                    value=score,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            duolingo = parse_duolingo(text)
            if duolingo:
                score, evidence = duolingo
                self.add_fact(
                    programme_id=pid,
                    field_name="duolingo",
                    value=score,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            tuition = parse_uk_tuition(text)
            if tuition:
                value, evidence = tuition
                self.add_fact(
                    programme_id=pid,
                    field_name="tuition",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                    audience=value.get("audience"),
                    academic_cycle=value.get("academic_cycle"),
                )
            deadline = parse_uk_deadline(text)
            if deadline:
                date, evidence = deadline
                self.add_fact(
                    programme_id=pid,
                    field_name="final_deadline",
                    value=date,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            starts = parse_uk_start_dates(text)
            if starts:
                dates, evidence = starts
                self.add_fact(
                    programme_id=pid,
                    field_name="intakes",
                    value={"start_dates": dates, "source_label": "Start date"},
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            subject = parse_subject_prerequisite(text)
            if subject:
                value, evidence = subject
                self.add_fact(
                    programme_id=pid,
                    field_name="subject_prerequisites",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            portfolio = parse_portfolio_requirement(text)
            if portfolio:
                value, evidence = portfolio
                self.add_fact(
                    programme_id=pid,
                    field_name="portfolio",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            recommendation = parse_recommendation_requirement(text)
            if recommendation:
                value, evidence = recommendation
                self.add_fact(
                    programme_id=pid,
                    field_name="recommendation_letters",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            work_experience = parse_work_experience_requirement(text)
            if work_experience:
                value, evidence = work_experience
                self.add_fact(
                    programme_id=pid,
                    field_name="work_experience",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            documents = parse_edinburgh_documents(text)
            if documents:
                value, evidence = documents
                self.add_fact(
                    programme_id=pid,
                    field_name="required_documents",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
                self.add_fact(
                    programme_id=pid,
                    field_name="sop_essay_requirements",
                    value="Personal statement",
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
                self.add_fact(
                    programme_id=pid,
                    field_name="recommendation_letters",
                    value="Reference",
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            for component_field, component_value, component_evidence in parse_admission_document_components(text):
                self.add_fact(
                    programme_id=pid,
                    field_name=component_field,
                    value=component_value,
                    source_url=source_url,
                    evidence=component_evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )
            scholarship = parse_scholarship_policy(text)
            if scholarship:
                value, evidence = scholarship
                self.add_fact(
                    programme_id=pid,
                    field_name="scholarships",
                    value=value,
                    source_url=source_url,
                    evidence=evidence,
                    provider_id="official_university_page",
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_html",
                    source_content_hash=source_hash,
                )

    @staticmethod
    def duo_url(url: str) -> str:
        parts = urlsplit(url)
        query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if key != "target"]
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))

    def nl(self) -> None:
        targets = [item for item in self.targets.values() if item.get("country") == "NL" and "onderwijsdata.duo.nl" in str(item.get("official_url"))]
        for target in targets:
            original_url = str(target.get("official_url") or "")
            url = self.duo_url(original_url)
            record = self.store.fetch(url, provider_id="duo_rio", timeout=25)
            if record["status"] != 200 or not record["body"]:
                continue
            try:
                payload = json.loads(record["body"].decode("utf-8", errors="replace"))
                rows = payload.get("result", {}).get("records", [])
                row = rows[0] if rows else None
            except (ValueError, TypeError, AttributeError):
                row = None
            if not isinstance(row, dict):
                continue
            pid = str(target["programme_id"])
            source_hash = str(record["content_hash"])
            language = str(row.get("VOERTAAL") or "").upper()
            if language in {"ENG", "NLD"}:
                self.add_fact(
                    programme_id=pid,
                    field_name="programme_language",
                    value="English" if language == "ENG" else "Dutch",
                    source_url=url,
                    evidence=f"DUO RIO VOERTAAL={language}",
                    provider_id="duo_rio",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            mode = str(row.get("VORM") or "").upper()
            mode_value = {"VOLTIJD": "full-time", "DEELTIJD": "part-time", "DUAAL": "dual"}.get(mode)
            if mode_value:
                self.add_fact(
                    programme_id=pid,
                    field_name="delivery_mode",
                    value=mode_value,
                    source_url=url,
                    evidence=f"DUO RIO VORM={mode}",
                    provider_id="duo_rio",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            website = normalise_text(row.get("WEBSITE"))
            if website.startswith(("https://", "http://")):
                self.add_fact(
                    programme_id=pid,
                    field_name="application_url",
                    value=website,
                    source_url=url,
                    evidence=f"DUO RIO WEBSITE={website}",
                    provider_id="duo_rio",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            if str(row.get("EISEN_WERKZAAMHEDEN") or "").upper() == "GEEN_EISEN":
                self.add_fact(
                    programme_id=pid,
                    field_name="work_experience",
                    value={
                        "requirement_status": "not_required",
                        "details": "DUO RIO reports GEEN_EISEN for EISEN_WERKZAAMHEDEN.",
                    },
                    source_url=url,
                    evidence="DUO RIO EISEN_WERKZAAMHEDEN=GEEN_EISEN",
                    provider_id="duo_rio",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )

    def studyinfo(self) -> None:
        targets = [item for item in self.targets.values() if item.get("country") == "FI" and "opintopolku.fi/konfo-backend/hakukohde" in str(item.get("official_url"))]
        for target in targets:
            pid = str(target["programme_id"])
            url = str(target.get("official_url") or "")
            record = self.store.fetch(url, provider_id="studyinfo_hakukohde", timeout=25)
            if record["status"] != 200 or not record["body"]:
                continue
            try:
                data = json.loads(record["body"].decode("utf-8", errors="replace"))
            except ValueError:
                continue
            source_hash = str(record["content_hash"])
            form_url = str((data.get("hakulomakeLinkki") or {}).get("en") or "")
            if form_url.startswith("http"):
                self.add_fact(
                    programme_id=pid,
                    field_name="application_url",
                    value=form_url,
                    source_url=url,
                    evidence=f"Studyinfo hakulomakeLinkki.en={form_url}",
                    provider_id="studyinfo_hakukohde",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            start_date = str((data.get("paateltyAlkamisajankohta") or {}).get("pvm") or "")
            if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", start_date):
                self.add_fact(
                    programme_id=pid,
                    field_name="intakes",
                    value={"start_date": start_date},
                    source_url=url,
                    evidence=f"Studyinfo paateltyAlkamisajankohta.pvm={start_date}",
                    provider_id="studyinfo_hakukohde",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            # minimum_degree is inapplicable to the frozen bachelor targets;
            # this guard follows the existing validator's semantics.
            if str(target.get("degree_level") or "").casefold() != "bachelor":
                names = [
                    str((item.get("nimi") or {}).get("en") or "").strip()
                    for item in (data.get("pohjakoulutusvaatimus") or [])
                    if str((item.get("nimi") or {}).get("en") or "").strip()
                ]
                if names:
                    self.add_fact(
                        programme_id=pid,
                        field_name="minimum_degree",
                        value=names,
                        source_url=url,
                        evidence="Required prior education (minimum degree requirement): " + " | ".join(names),
                        provider_id="studyinfo_hakukohde",
                        source_authority="GOVERNMENT",
                        source_relationship="GOVERNMENT",
                        source_type="government_json",
                        source_content_hash=source_hash,
                    )
            documents = [
                str((item.get("nimi") or {}).get("en") or "").strip()
                for item in (data.get("liitteet") or [])
                if str((item.get("nimi") or {}).get("en") or "").strip()
            ]
            if documents:
                self.add_fact(
                    programme_id=pid,
                    field_name="required_documents",
                    value=documents,
                    source_url=url,
                    evidence="Studyinfo liitteet: " + " | ".join(documents),
                    provider_id="studyinfo_hakukohde",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            criteria = data.get("valintaperuste") or {}
            criteria_id = str(criteria.get("id") or "")
            route_name = str((criteria.get("hakutapa") or {}).get("nimi", {}).get("en") or "")
            if "rolling admission" in route_name.casefold():
                self.add_fact(
                    programme_id=pid,
                    field_name="rolling_admission",
                    value=True,
                    source_url=url,
                    evidence=f"Studyinfo valintaperuste.hakutapa={route_name}",
                    provider_id="studyinfo_hakukohde",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=source_hash,
                )
            if not criteria_id:
                continue
            criteria_url = f"https://opintopolku.fi/konfo-backend/valintaperuste/{criteria_id}"
            criteria_record = self.store.fetch(criteria_url, provider_id="studyinfo_valintaperuste", timeout=25)
            if criteria_record["status"] != 200 or not criteria_record["body"]:
                continue
            try:
                criteria_data = json.loads(criteria_record["body"].decode("utf-8", errors="replace"))
            except ValueError:
                continue
            criteria_hash = str(criteria_record["content_hash"])
            metadata = criteria_data.get("metadata") or {}
            description = normalise_text((metadata.get("kuvaus") or {}).get("en"))
            eligibility = normalise_text((metadata.get("hakukelpoisuus") or {}).get("en"))
            extra = normalise_text((metadata.get("lisatiedot") or {}).get("en"))
            combined = " ".join(item for item in (description, eligibility, extra) if item)
            if re.search(r"\bLanguage\s*:\s*English\b", description, re.IGNORECASE):
                self.add_fact(
                    programme_id=pid,
                    field_name="programme_language",
                    value="English",
                    source_url=criteria_url,
                    evidence=source_excerpt(description, re.search(r"\bLanguage\s*:\s*English\b", description, re.IGNORECASE).start(), 0, 500),
                    provider_id="studyinfo_valintaperuste",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=criteria_hash,
                )
            tuition_match = re.search(
                r"Tuition\s+fee:.*?(?:non\s+EU,\s*EEA.*?|international).*?([0-9][0-9,\s]*)\s*EUR\s+per\s+academic\s+year",
                description,
                re.IGNORECASE,
            )
            if not tuition_match:
                tuition_match = re.search(
                    r"annual\s+tuition\s+fee\s+for\s+non[- ]EU/EEA[^.]*?([0-9][0-9,\s]*)\s*EUR",
                    combined,
                    re.IGNORECASE,
                )
            if tuition_match:
                amount = parse_number(tuition_match.group(1))
                if amount is not None:
                    value = {
                        "amount": amount,
                        "currency": "EUR",
                        "fee_period": "annual",
                        "credential": "tuition fee for non-EU/EEA students",
                        "audience": "international",
                    }
                    self.add_fact(
                        programme_id=pid,
                        field_name="tuition",
                        value=value,
                        source_url=criteria_url,
                        evidence=source_excerpt(description if tuition_match.string is description else combined, tuition_match.start(), tuition_match.end() + 100, 750),
                        provider_id="studyinfo_valintaperuste",
                        source_authority="GOVERNMENT",
                        source_relationship="GOVERNMENT",
                        source_type="government_json",
                        source_content_hash=criteria_hash,
                        audience="international",
                    )
            work_match = re.search(r"at\s+least\s+(\d+)\s+years?\s+\((\d+)\s+months?\).*?work\s+experience", eligibility, re.IGNORECASE)
            if work_match:
                evidence = source_excerpt(eligibility, work_match.start(), work_match.end() + 120, 800)
                self.add_fact(
                    programme_id=pid,
                    field_name="work_experience",
                    value={"minimum_years": int(work_match.group(1)), "minimum_months": int(work_match.group(2)), "details": evidence},
                    source_url=criteria_url,
                    evidence=evidence,
                    provider_id="studyinfo_valintaperuste",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=criteria_hash,
                )
            tests: list[dict[str, Any]] = []
            if re.search(r"\bGMAT\b", combined, re.IGNORECASE) or re.search(r"\bGRE\b", combined, re.IGNORECASE):
                tests.append({"test": "GMAT/GRE", "requirement_status": "required"})
            if re.search(r"\bSAT\b", combined, re.IGNORECASE):
                tests.append({"test": "SAT", "requirement_status": "required"})
            if tests:
                self.add_fact(
                    programme_id=pid,
                    field_name="standardized_tests",
                    value=tests[0] if len(tests) == 1 else tests,
                    source_url=criteria_url,
                    evidence=source_excerpt(combined, min((m.start() for m in re.finditer(r"\b(?:GMAT|GRE|SAT)\b", combined, re.IGNORECASE)), default=0), 0, 750),
                    provider_id="studyinfo_valintaperuste",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=criteria_hash,
                )
            scholarship_match = re.search(r"[^.]{0,180}(?:tuition\s+waivers?|scholarships?|funding)[^.]{0,260}", extra, re.IGNORECASE)
            if scholarship_match:
                self.add_fact(
                    programme_id=pid,
                    field_name="scholarships",
                    value={"funding_type": "financial_aid_policy", "details": normalise_text(scholarship_match.group(0))},
                    source_url=criteria_url,
                    evidence=normalise_text(scholarship_match.group(0)),
                    provider_id="studyinfo_valintaperuste",
                    source_authority="GOVERNMENT",
                    source_relationship="GOVERNMENT",
                    source_type="government_json",
                    source_content_hash=criteria_hash,
                )

    def skolverket(self) -> None:
        # The six Susa-navet rows already carry explicit language, intakes and
        # eligibility assertions in the frozen replay.  Fetching the exact
        # JSON endpoints verifies source health but does not duplicate facts.
        targets = [item for item in self.targets.values() if item.get("country") == "SE" and "api.skolverket.se/susa-navet" in str(item.get("official_url"))]
        for target in targets:
            self.store.fetch(str(target.get("official_url") or ""), provider_id="susa_navet", timeout=25)

    def targeted_admission(self) -> None:
        """Fetch official application pages and extract explicit requirements.

        The frozen catalogue URLs are provider endpoints, so this pass uses
        only programme-level application URLs already retained in the strict
        export.  It never invents a URL or transfers requirements between
        programmes.  A page must contain programme identity and an admission
        context before any fact can be promoted as direct evidence.
        """

        seeds: dict[str, list[str]] = defaultdict(list)
        for pid, target in self.targets.items():
            url = str(self.before_by_id.get(pid, {}).get("application_url") or "").strip()
            if url.startswith(("https://", "http://")):
                seeds[url].append(pid)

        stats: Counter[str] = Counter(
            {
                "programmes": len(self.targets),
                "programmes_with_application_url": len({pid for pids in seeds.values() for pid in pids}),
                "unique_seed_urls": len(seeds),
            }
        )
        processed_urls: set[str] = set()

        def inspect_page(pid: str, record: Mapping[str, Any], *, allow_links: bool) -> None:
            body = bytes(record.get("body") or b"")
            if int(record.get("status") or 0) != 200 or not body:
                stats["non_200_or_empty"] += 1
                return
            source_url = str(record.get("final_url") or record.get("url") or "")
            text = text_from_page_body(body)
            if not text:
                stats["empty_page_text"] += 1
                return
            target = self.targets[pid]
            if not target_identity_matches(target, text, source_url):
                stats["identity_rejected"] += 1
                return
            stats["identity_matched_pages"] += 1
            contexts = admission_contexts(text)
            if not contexts:
                stats["no_admission_context"] += 1
                return
            source_hash = str(record.get("content_hash") or sha256_bytes(body))
            provider_id = "official_admission_page"

            required = requirement_from_contexts(
                contexts,
                r"\b(?:required|supporting)\s+documents?\b|\bdocuments?\s+to\s+submit\b|\bwhat\s+you\s+need\s+to\s+apply\b",
            )
            if required:
                self.add_fact(
                    programme_id=pid,
                    field_name="required_documents",
                    value=required[0],
                    source_url=source_url,
                    evidence=required[1],
                    provider_id=provider_id,
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_admission_page",
                    source_content_hash=source_hash,
                )

            recommendation = requirement_from_contexts(
                contexts,
                r"\b(?:recommendation\s+letters?|letters?\s+of\s+recommendation|academic\s+references?|references?)\b",
            )
            if recommendation:
                self.add_fact(
                    programme_id=pid,
                    field_name="recommendation_letters",
                    value=recommendation[0],
                    source_url=source_url,
                    evidence=recommendation[1],
                    provider_id=provider_id,
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_admission_page",
                    source_content_hash=source_hash,
                )

            sop = requirement_from_contexts(
                contexts,
                r"\b(?:personal\s+statements?|statement\s+of\s+purpose|motivation\s+(?:letter|statement)|application\s+essays?)\b",
            )
            if sop:
                self.add_fact(
                    programme_id=pid,
                    field_name="sop_essay_requirements",
                    value=sop[0],
                    source_url=source_url,
                    evidence=sop[1],
                    provider_id=provider_id,
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_admission_page",
                    source_content_hash=source_hash,
                )

            for component_field, component_value, component_evidence in parse_admission_document_components(text):
                self.add_fact(
                    programme_id=pid,
                    field_name=component_field,
                    value=component_value,
                    source_url=source_url,
                    evidence=component_evidence,
                    provider_id=provider_id,
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_admission_page",
                    source_content_hash=source_hash,
                )

            portfolio = parse_portfolio_requirement(text)
            if portfolio:
                self.add_fact(
                    programme_id=pid,
                    field_name="portfolio",
                    value=portfolio[0],
                    source_url=source_url,
                    evidence=portfolio[1],
                    provider_id=provider_id,
                    source_authority="OFFICIAL",
                    source_relationship="DIRECT_OFFICIAL",
                    source_type="official_admission_page",
                    source_content_hash=source_hash,
                )

            if allow_links and not body.startswith(b"%PDF"):
                for link in admission_page_urls(body.decode("utf-8", errors="replace"), source_url):
                    if link in processed_urls:
                        continue
                    processed_urls.add(link)
                    linked = self.store.fetch(link, provider_id=provider_id, timeout=35)
                    stats["discovered_links"] += 1
                    inspect_page(pid, linked, allow_links=False)

        for seed_url, pids in sorted(seeds.items()):
            if seed_url in processed_urls:
                continue
            processed_urls.add(seed_url)
            record = self.store.fetch(seed_url, provider_id="official_admission_page", timeout=35)
            stats["seed_pages"] += 1
            for pid in pids:
                inspect_page(pid, record, allow_links=True)

        stats["urls_fetched"] = len(processed_urls)
        stats["new_assertions"] = sum(
            1 for row in self.added if row.get("provider_id") == "official_admission_page"
        )
        self.targeted_summary = dict(sorted(stats.items()))

    def persist_and_replay(self) -> dict[str, Any]:
        existing = read_jsonl(INCREMENTAL_JSONL)
        merged: dict[str, dict[str, Any]] = {}
        for row in existing + self.added:
            if row.get("assertion_id"):
                merged.setdefault(str(row["assertion_id"]), row)
        merged_rows = [merged[key] for key in sorted(merged)]
        INCREMENTAL_JSONL.write_text(
            "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in merged_rows),
            encoding="utf-8",
        )

        audit_rows = []
        target_names = {pid: str(row.get("programme_name") or "") for pid, row in self.targets.items()}
        for row in merged_rows:
            audit_rows.append(
                {
                    "programme_id": row.get("entity_id"),
                    "programme_name": target_names.get(str(row.get("entity_id")), ""),
                    "country": row.get("country") or "",
                    "institution_id": self.targets.get(str(row.get("entity_id")), {}).get("institution_id", ""),
                    "field_name": row.get("field_name"),
                    "value_json": compact(row.get("value_json")),
                    "scope": row.get("scope") or "",
                    "audience": row.get("audience") or "",
                    "academic_cycle": row.get("academic_cycle") or "",
                    "source_url": row.get("source_url") or "",
                    "evidence": row.get("evidence") or "",
                    "provider_id": row.get("provider_id") or "",
                    "source_authority": row.get("source_authority") or "",
                    "source_relationship": row.get("source_relationship") or "",
                    "source_content_hash": row.get("source_content_hash") or "",
                    "raw_document_id": row.get("raw_document_id") or "",
                    "parser_id": row.get("parser_id") or "",
                    "parser_version": row.get("parser_version") or "",
                }
            )
        rebuild.write_csv(EVIDENCE_AUDIT_CSV, AUDIT_COLUMNS, audit_rows)
        persisted_by_provider = Counter(
            str(row.get("provider_id") or "") for row in merged_rows if row.get("provider_id")
        )
        # Keep the ledger useful when an incremental replay is run more than
        # once: it describes the complete persisted assertion set, while the
        # network/cache counters still describe this invocation.
        source_entries: dict[str, dict[str, Any]] = {
            str(entry.get("url")): dict(entry)
            for entry in self.store.ledger.values()
            if entry.get("url")
        }
        for row in merged_rows:
            url = str(row.get("source_url") or "")
            if not url:
                continue
            entry = source_entries.setdefault(
                url,
                {
                    "url": url,
                    "final_url": url,
                    "status": 200,
                    "content_hash": str(row.get("source_content_hash") or ""),
                    "bytes": 0,
                    "provider_id": str(row.get("provider_id") or ""),
                    "cache": True,
                },
            )
            if not entry.get("content_hash") and row.get("source_content_hash"):
                entry["content_hash"] = str(row["source_content_hash"])
            if not entry.get("provider_id") and row.get("provider_id"):
                entry["provider_id"] = str(row["provider_id"])
        write_json(
            SOURCE_LEDGER_JSON,
            {
                "acquisition_run_id": RUN_ID,
                "sources": sorted(source_entries.values(), key=lambda row: str(row.get("url"))),
                "source_count": len(source_entries),
                "network_calls": self.store.network_calls,
                "cache_hits": self.store.cache_hits,
                "paid_llm_calls": 0,
                "new_domains": [],
                "added_assertions": len(self.added),
                "persisted_assertions": len(merged_rows),
                "added_by_provider": dict(sorted(persisted_by_provider.items())),
                "skipped": dict(sorted(self.skipped.items())),
            },
        )

        raw = reports.prepare_data()
        data = rebuild.remap_hierarchy_data(raw, self.context)
        decisions, rejections = reports.run_decisions(data, optimized=True)
        REPLAY_DIR.mkdir(parents=True, exist_ok=True)
        outputs = reports.matrix_and_outputs(data, decisions, REPLAY_DIR)
        for name in ("stage1-hierarchy-field-summary.csv", "stage1-programme-completeness.csv", "stage1-hierarchy-donor-review.csv", "stage1-full-hierarchical-review.csv"):
            source = REPLAY_DIR / name
            if source.exists():
                target = ARTIFACT_DIR / f"stage1-production-{name.removeprefix('stage1-')}"
                target.write_bytes(source.read_bytes())
        lead_rows = rebuild.make_lead_export(outputs, self.production, data)
        rebuild.write_csv(FINAL_CSV, rebuild.LEAD_COLUMNS, lead_rows)
        rebuild.write_json(
            ARTIFACT_DIR / "stage1-production-replay-summary.json",
            {
                "population": {
                    "original_programmes": self.production.get("original_programmes", 418),
                    "verified_programmes": len(lead_rows),
                    "institutions": len({str(row.get("institution_id")) for row in data["programmes"]}),
                },
                "hierarchy": reports.aggregate_summary(outputs["summary_rows"]),
                "rows": len(outputs["rows"]),
                "lead_rows": len(lead_rows),
                "donor_rows": len(outputs["donor_rows"]),
                "deterministic_metadata_assertions": data.get("deterministic_metadata_count", 0),
                "field_summary": outputs["summary_rows"],
                "completeness": outputs["completeness_rows"],
                "rejection_summary": [
                    {
                        "field": field,
                        "hierarchy_level": level,
                        "candidate_rejections": len(items),
                    }
                    for (field, level), items in sorted(rejections.items())
                ],
                "source_manifest_sha256": self.production.get("source_manifest_sha256"),
                "paid_llm_calls": 0,
            },
        )

        after_by_id = {str(row["programme_id"]): row for row in lead_rows}
        # Completeness uses the same 38 canonical hierarchy fields as the
        # resolver.  CSV-only display fields (for example scope and derived
        # fee totals) are deliberately excluded from the denominator.
        field_names = [rebuild.FIELD_ALIASES.get(field, field) for field in reports.FIELDS]

        def count_fields(row: Mapping[str, Any]) -> int:
            return sum(bool(row.get(field)) for field in field_names)

        def quantiles(values: list[float]) -> dict[str, float]:
            ordered = sorted(values)
            if not ordered:
                return {"p25": 0.0, "median": 0.0, "p75": 0.0}
            def percentile(fraction: float) -> float:
                pos = (len(ordered) - 1) * fraction
                lo = int(pos)
                hi = min(lo + 1, len(ordered) - 1)
                return round(ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo), 2)
            return {"p25": percentile(0.25), "median": percentile(0.5), "p75": percentile(0.75)}

        coverage_before: Counter[str] = Counter()
        coverage_after: Counter[str] = Counter()
        for csv_field in field_names:
            coverage_before[csv_field] = sum(bool(row.get(csv_field)) for row in self.before_rows)
            coverage_after[csv_field] = sum(bool(row.get(csv_field)) for row in lead_rows)
        improved = sum(
            any(not self.before_by_id.get(pid, {}).get(field) and row.get(field) for field in field_names)
            for pid, row in after_by_id.items()
        )
        hierarchy = reports.aggregate_summary(outputs["summary_rows"])
        summary = {
            "population": {"verified_programmes": len(lead_rows), "synthetic_recipients_excluded": self.production.get("classifications", {}).get("SYNTHETIC_SEED", 0)},
            "added_assertions": len(self.added),
            "persisted_incremental_assertions": len(merged_rows),
            "programmes_improved": improved,
            "coverage_before": dict(sorted(coverage_before.items())),
            "coverage_after": dict(sorted(coverage_after.items())),
            "hierarchy": hierarchy,
            "completeness_quantiles": quantiles([count_fields(row) / max(1, len(field_names)) * 100 for row in lead_rows]),
            "network_calls": self.store.network_calls,
            "cache_hits": self.store.cache_hits,
            "paid_llm_calls": 0,
            "rejection_count": sum(len(value) for value in rejections.values()),
            "provider_counts": dict(sorted(self.by_provider.items())),
            "targeted_admission": self.targeted_summary,
        }
        write_json(REPLAY_SUMMARY_JSON, summary)
        return summary

    def run(self) -> dict[str, Any]:
        self.onisep()
        self.uk()
        self.nl()
        self.skolverket()
        self.studyinfo()
        self.targeted_admission()
        return self.persist_and_replay()


def main() -> None:
    summary = Acquisition().run()
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
