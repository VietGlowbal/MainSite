"""Audit field-level evidence availability for a sealed Phase 3F run.

This is a post-seal diagnostic.  It deliberately reads frozen truth only
after the pipeline output is sealed and never imports truth into the runtime
pipeline.  The result is a concise per-case matrix, not a replacement scorer.
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.url_safety import canonicalize_url  # noqa: E402


FIELDS = (
    "programme_identity",
    "credential",
    "programme_status",
    "tuition",
    "application_deadline",
    "english_requirement",
    "major_admissions_requirement",
)

COMPONENT_FIELDS = {
    "programme_identity": ("programme_identity",),
    "credential": ("credential",),
    "programme_status": ("programme_status",),
    "tuition": ("tuition", "additional_fees"),
    "application_deadline": (
        "priority_deadline",
        "final_deadline",
        "funding_deadline",
        "international_deadline",
        "intakes",
        "rolling_admission",
    ),
    "english_requirement": (
        "ielts_overall",
        "ielts_subscores",
        "toefl",
        "duolingo",
    ),
    "major_admissions_requirement": (
        "minimum_degree",
        "minimum_gpa",
        "subject_prerequisites",
        "standardized_tests",
        "work_experience",
        "portfolio",
        "required_documents",
        "recommendation_letters",
        "sop_essay_requirements",
    ),
}

FIELD_MARKERS = {
    "programme_identity": ("programme", "program", "degree", "bachelor", "master", "phd"),
    "credential": ("bachelor", "master", "degree", "bsc", "msc", "m.s", "b.s", "licence"),
    "programme_status": ("active", "offered", "admission", "programme", "program", "catalogue", "catalog"),
    "tuition": ("tuition", "fee", "fees", "cost", "semester", "academic year", "per year"),
    "application_deadline": ("application", "deadline", "apply", "admission", "intake", "fall", "spring", "early action"),
    "english_requirement": ("english", "ielts", "toefl", "duolingo", "language", "proficiency", "not required"),
    "major_admissions_requirement": ("admission", "requirement", "prerequisite", "minimum", "gpa", "transcript", "recommendation", "statement"),
}

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "of", "on", "or", "the", "this", "to", "with", "year", "years",
    "current", "official", "programme", "program", "admission", "admissions", "requirement",
    "requirements", "applicants", "applicant", "students", "student", "degree", "university",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"{path}:{line_number} is not an object")
        rows.append(value)
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = text.replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip()


def canonical(value: str | None) -> str:
    if not value:
        return ""
    try:
        return canonicalize_url(value)
    except Exception:  # noqa: BLE001 - malformed diagnostic URL remains visible
        return value.strip()


def has_value(value: Any) -> bool:
    return value is not None and value != "" and value != [] and value != {}


def value_text(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value or "")


def html_text(raw: bytes) -> str:
    decoded = raw.decode("utf-8", errors="replace")
    decoded = re.sub(r"(?is)<(script|style|noscript|template)\b.*?</\1>", " ", decoded)
    decoded = re.sub(r"(?s)<[^>]+>", " ", decoded)
    return re.sub(r"\s+", " ", html.unescape(decoded)).strip()


def raw_text(run_dir: Path, source: dict[str, Any]) -> str:
    relative = str(source.get("raw_object_path") or "")
    if not relative:
        return ""
    path = run_dir / "pipeline-run" / relative
    if not path.exists():
        return ""
    try:
        raw = gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
    except (OSError, EOFError):
        return ""
    if str(source.get("content_type") or "").casefold().find("pdf") >= 0 or path.suffix == ".pdf":
        try:
            from pypdf import PdfReader
            import io

            return re.sub(r"\s+", " ", "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)).strip()
        except Exception:  # noqa: BLE001 - PDF parse failure is reported as unavailable evidence
            return ""
    return html_text(raw)


def parse_roster(path: Path) -> tuple[dict[int, dict[str, Any]], dict[str, str]]:
    def cells(line: str) -> list[str]:
        return [item.strip() for item in line.strip().strip("|").split("|")]

    rows: dict[int, dict[str, Any]] = {}
    text = path.read_text(encoding="utf-8")
    in_register = False
    register: dict[str, str] = {}
    for line in text.splitlines():
        if re.match(r"^\|\s*\d+\s*\|", line):
            parts = cells(line)
            if len(parts) >= 8:
                number = int(parts[0])
                url_match = re.search(r"\((https?://[^)]+)\)", parts[3])
                if url_match:
                    rows[number] = {
                        "institution": parts[1].split("/", 1)[0].strip(),
                        "programme": parts[2].rsplit("/", 1)[0].strip(),
                        "url": canonical(url_match.group(1)),
                        "source_codes": re.findall(r"`([^`]+)`", parts[4]),
                        "target_cycle": parts[5],
                        "stress": parts[6],
                        "tags": re.findall(r"[A-Z][A-Z0-9_-]*", parts[7]),
                    }
        if line.startswith("## Supporting-source register"):
            in_register = True
            continue
        if in_register and line.startswith("## "):
            break
        if in_register and line.startswith("| `"):
            parts = cells(line)
            if len(parts) >= 3:
                match = re.search(r"https?://\S+", parts[2])
                if match:
                    register[parts[0].strip("`")] = canonical(match.group(0).rstrip("`"))
    return rows, register


def source_family(source: dict[str, Any], *, programme_url: str, field: str) -> str:
    url = str(source.get("url") or source.get("canonical_url") or "")
    path = urlsplit(url).path.casefold()
    page_type = str(source.get("page_type") or "").casefold()
    relationship = str(source.get("source_relationship") or "").casefold()
    if canonical(url) == canonical(programme_url) or relationship in {"direct_official", "programme"} and any(
        token in path for token in ("program", "programme", "degree", "course", "major", "master", "bachelor")
    ):
        return "PROGRAMME_SPECIFIC_OFFICIAL"
    if relationship in {"department", "faculty", "school", "parent_institution"} or any(
        token in path for token in ("department", "faculty", "school", "graduate-school", "graduate_school")
    ):
        return "DEPARTMENT_FACULTY_OFFICIAL"
    if path.endswith((".pdf", ".pdf/")):
        return "OFFICIAL_PDF"
    if page_type in {"tuition", "deadline", "english_requirement", "programme_admission", "international_admission"} or any(
        token in path for token in ("admission", "bursar", "registrar", "tuition", "financial", "fees", "application")
    ):
        return "CENTRAL_OR_SPECIALIST_OFFICIAL"
    if str(source.get("source_authority") or "").casefold() in {"official_partner", "government"}:
        return "RELATED_AUTHORITATIVE"
    if str(source.get("temporal_state") or "").casefold() in {"historical", "stale"}:
        return "HISTORICAL_OFFICIAL"
    return "OFFICIAL_OTHER"


def meaningful_tokens(value: Any) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+(?:[-'][a-z0-9]+)?", norm(value))
    return [token for token in tokens if token not in STOPWORDS and len(token) >= 3]


def source_is_relevant(expected: dict[str, Any], source: dict[str, Any], *, exact_expected: bool) -> bool:
    """Keep cross-field source matches from inflating field evidence."""
    if exact_expected:
        return True
    field = str(expected.get("field") or "")
    page_type = str(source.get("page_type") or "").casefold()
    url = str(source.get("url") or source.get("canonical_url") or "").casefold()
    path = urlsplit(url).path
    if field in {"programme_identity", "credential"}:
        return page_type in {"programme_overview", "programme_admission", "pdf", "catalogue"} or any(
            token in path for token in ("program", "programme", "degree", "course", "catalog", "major", "master", "bachelor")
        )
    if field == "programme_status":
        return page_type in {"programme_overview", "programme_admission", "catalogue"} or any(
            token in path for token in ("program", "programme", "degree", "course", "catalog")
        )
    if field == "tuition":
        return page_type in {"tuition", "finance", "programme_overview"} or any(
            token in path for token in ("tuition", "fee", "cost", "financial", "bursar", "registrar", "sfs")
        )
    if field == "application_deadline":
        return page_type in {"deadline", "programme_admission", "international_admission", "pdf"} or any(
            token in path for token in ("deadline", "admission", "apply", "application", "handbook")
        )
    if field == "english_requirement":
        return page_type in {"english_requirement", "programme_admission", "international_admission", "pdf"} or any(
            token in path for token in ("english", "language", "ielts", "toefl", "admission", "international")
        )
    if field == "major_admissions_requirement":
        return page_type in {"programme_admission", "international_admission", "pdf", "programme_overview"} or any(
            token in path for token in ("admission", "requirement", "apply", "handbook", "catalog", "program", "programme")
        )
    return True


def _near_marker(body: str, markers: Iterable[str], anchors: Iterable[str]) -> bool:
    marker_positions = [body.find(marker) for marker in markers if body.find(marker) >= 0]
    anchor_positions = [body.find(anchor) for anchor in anchors if body.find(anchor) >= 0]
    return any(abs(marker - anchor) <= 800 for marker in marker_positions for anchor in anchor_positions)


def expected_support(expected: dict[str, Any], text: str, assertions: list[dict[str, Any]]) -> tuple[str, str]:
    """Return (support level, reason) using only conservative post-seal signals."""
    body = norm(text)
    expected_value = expected.get("expected_value")
    expected_tokens = meaningful_tokens(expected_value)
    numeric = [token for token in expected_tokens if re.search(r"\d", token)]
    lexical = [token for token in expected_tokens if not re.search(r"\d", token)]
    if body and expected_tokens:
        hits = sum(token in body for token in expected_tokens)
        numeric_hits = sum(token in body for token in numeric)
        field = str(expected.get("field") or "")
        markers = FIELD_MARKERS.get(field, ())
        if field in {"tuition", "application_deadline"}:
            anchors = numeric or [token for token in expected_tokens if len(token) >= 4]
            if numeric_hits >= 1 and _near_marker(body, markers, anchors) and hits >= 2:
                return "DIRECT", f"field marker and temporal/amount anchor overlap {hits}/{len(expected_tokens)}"
        elif field in {"programme_identity", "credential"}:
            distinctive = [token for token in lexical if token not in {"bachelor", "master", "science", "arts", "engineering", "degree", "college", "university"}]
            distinctive_hits = sum(token in body for token in distinctive)
            if (distinctive_hits >= min(3, len(distinctive)) and hits >= distinctive_hits + 1) or (
                field == "credential" and hits >= 2 and _near_marker(body, markers, lexical)
            ):
                return "DIRECT", f"identity/credential-specific token overlap {hits}/{len(expected_tokens)}"
        else:
            required = 2 if len(expected_tokens) <= 8 else 3
            if hits >= required and _near_marker(body, markers, lexical or expected_tokens):
                return "DIRECT", f"field-specific token overlap {hits}/{len(expected_tokens)}"
        locator_tokens = meaningful_tokens(expected.get("evidence_locator"))
        locator_hits = sum(token in body for token in locator_tokens)
        marker_hits = sum(marker in body for marker in markers)
        if locator_hits >= 2 and marker_hits >= 1:
            return "AMBIGUOUS", f"field/locator context present; expected-value overlap {hits}/{len(expected_tokens)}"
    for assertion in assertions:
        if not has_value(assertion.get("value_json")):
            continue
        assertion_value = norm(value_text(assertion.get("value_json")))
        evidence = norm(assertion.get("evidence"))
        if assertion_value and (assertion_value in body or evidence in body):
            return "AMBIGUOUS", "runtime candidate/evidence is present in fetched raw source"
    if body:
        markers = FIELD_MARKERS.get(str(expected.get("field")), ())
        if sum(marker in body for marker in markers) >= 2:
            return "AMBIGUOUS", "fetched source has field-relevant context but truth support is not deterministically established"
    return "NONE", "fetched source did not expose conservative support signal"


def best_source_for_case(
    expected: dict[str, Any],
    output: dict[str, Any],
    roster: dict[str, Any],
    fetched: dict[str, dict[str, Any]],
    assertions_by_component: dict[str, list[dict[str, Any]]],
    run_dir: Path,
) -> dict[str, Any] | None:
    candidate_urls: list[str] = []
    candidate_urls.append(str(expected.get("source_url") or ""))
    candidate_urls.extend(fetched_url for fetched_url in output.get("source_refs", []) if fetched_url)
    # Only assertions for this field's component family are eligible.  A
    # tuition assertion from the same programme must not make a credential
    # source look like credential evidence merely because the raw page also
    # contains the word "master".
    candidate_urls.extend(
        str(item.get("source_url") or "")
        for values in assertions_by_component.values()
        for item in values
    )
    candidate_urls.extend(
        roster_url
        for code in roster.get("source_codes", [])
        if (roster_url := roster.get("source_register", {}).get(code))
    )
    ordered = list(dict.fromkeys(canonical(url) for url in candidate_urls if url))
    fetched_candidate_urls: list[str] = []
    best: tuple[int, dict[str, Any]] | None = None
    for url in ordered:
        source = fetched.get(url)
        if not source:
            continue
        text = source.get("_text", "")
        source_assertions = [
            item
            for values in assertions_by_component.values()
            for item in values
            if canonical(str(item.get("source_url") or "")) == url
        ]
        exact_expected = canonical(str(expected.get("source_url") or "")) == url
        if not source_is_relevant(expected, source, exact_expected=exact_expected):
            continue
        fetched_candidate_urls.append(url)
        support, reason = expected_support(expected, text, source_assertions)
        score = (100 if support == "DIRECT" else 60 if support == "AMBIGUOUS" else 10) + (30 if exact_expected else 0) + (10 if source_assertions else 0)
        candidate = {
            "url": url,
            "source": source,
            "support": support,
            "support_reason": reason,
            "exact_expected_source": exact_expected,
            "assertions": source_assertions,
            "candidate_urls": fetched_candidate_urls,
        }
        if best is None or score > best[0]:
            best = (score, candidate)
    return best[1] if best else None


def classify_case(
    expected: dict[str, Any],
    output: dict[str, Any],
    roster: dict[str, Any],
    fetched: dict[str, dict[str, Any]],
    assertions_by_component: dict[str, list[dict[str, Any]]],
    run_dir: Path,
) -> dict[str, Any]:
    field = str(expected["field"])
    best = best_source_for_case(expected, output, roster, fetched, assertions_by_component, run_dir)
    expected_source = canonical(str(expected.get("source_url") or ""))
    field_assertions = [item for values in assertions_by_component.values() for item in values]
    direct_assertions = [item for item in field_assertions if has_value(item.get("value_json"))]
    if best and best["support"] == "DIRECT":
        evidence_class = "EVIDENCE_FETCHED_DIRECT"
        top_level = "DOWNSTREAM_PROCESSING_GAP"
        subcategory = "supported_evidence_fetched_but_not_resolved_or_projected"
    elif best and best["support"] == "AMBIGUOUS":
        evidence_class = "EVIDENCE_FETCHED_BUT_AMBIGUOUS"
        top_level = "DOWNSTREAM_PROCESSING_GAP" if direct_assertions else "UPSTREAM_EVIDENCE_GAP"
        subcategory = "fetched_field_context_requires_downstream_semantic_processing" if direct_assertions else "fetched_source_is_field_relevant_but_support_is_not_proven"
    elif expected_source and expected_source in fetched:
        evidence_class = "EVIDENCE_FETCHED_BUT_AMBIGUOUS"
        top_level = "UPSTREAM_EVIDENCE_GAP"
        subcategory = "expected_source_fetched_but_field_support_not_locatable"
    elif best:
        evidence_class = "EVIDENCE_FETCHED_BUT_AMBIGUOUS"
        top_level = "UPSTREAM_EVIDENCE_GAP"
        subcategory = "fetched_candidate_source_is_insufficient_for_field"
    else:
        evidence_class = "EVIDENCE_NOT_FETCHED_DOCUMENT_NOT_DISCOVERED"
        top_level = "UPSTREAM_EVIDENCE_GAP"
        subcategory = "expected_or_related_supporting_source_not_fetched"

    if not fetched:
        evidence_class = "EVIDENCE_NOT_FETCHED_BLOCKED"
        top_level = "UPSTREAM_EVIDENCE_GAP"
        subcategory = "no_source_material_fetched_for_routed_programme"
    if output.get("state") in {"ACCESS_BLOCKED", "FETCH_FAILED"} and not direct_assertions:
        evidence_class = "EVIDENCE_NOT_FETCHED_BLOCKED"
        top_level = "UPSTREAM_EVIDENCE_GAP"
        subcategory = "source_access_blocked_or_fetch_failed"

    source = best["source"] if best else {}
    source_ref = best["url"] if best else None
    locator = None
    for assertion in (best["assertions"] if best else []):
        if assertion.get("evidence_locator"):
            locator = assertion["evidence_locator"]
            break
        if assertion.get("evidence"):
            locator = str(assertion["evidence"])[:240]
            break
    if locator is None and best and best["support_reason"]:
        locator = best["support_reason"]
    return {
        "case_id": expected["case_id"],
        "programme_id": output.get("runtime_programme_id"),
        "programme": expected.get("programme"),
        "institution": expected.get("institution"),
        "field": field,
        "resolved_truth_case": True,
        "truth_state": expected.get("expected_state"),
        "truth_value": expected.get("expected_value"),
        "evidence_fetched": (
            "true"
            if evidence_class == "EVIDENCE_FETCHED_DIRECT"
            else "ambiguous"
            if evidence_class == "EVIDENCE_FETCHED_BUT_AMBIGUOUS"
            else "false"
        ),
        "supporting_evidence_fetched": evidence_class == "EVIDENCE_FETCHED_DIRECT",
        "fetched_candidate_source_refs": list(best.get("candidate_urls", [])) if best else [],
        "evidence_availability": evidence_class,
        "best_source_ref": source_ref,
        "source_family": source_family(source, programme_url=str(roster.get("url") or ""), field=field) if source else None,
        "authority": source.get("source_authority") if source else None,
        "source_relationship": source.get("source_relationship") if source else None,
        "evidence_locator": locator,
        "upstream_or_downstream": top_level,
        "failure_subcategory": subcategory,
        "recovery_needed": top_level == "UPSTREAM_EVIDENCE_GAP",
        "expected_source_fetched": bool(expected_source and expected_source in fetched),
        "runtime_state": output.get("state"),
        "runtime_value_present": has_value(output.get("value")),
        "fetched_candidate_source_count": len(best.get("candidate_urls", [])) if best else 0,
        "candidate_assertion_count": output.get("lifecycle", {}).get("candidate_assertion_count", 0),
        "non_null_candidate_count": output.get("lifecycle", {}).get("non_null_candidate_count", 0),
        "quality_blockers": output.get("blockers", []),
    }


def build_report(rows: list[dict[str, Any]], *, run_id: str, matrix_path: str) -> str:
    total = len(rows)
    fetched = sum(row["evidence_fetched"] == "true" for row in rows)
    ambiguous = sum(row["evidence_availability"] == "EVIDENCE_FETCHED_BUT_AMBIGUOUS" for row in rows)
    fetched_material = fetched + ambiguous
    absent = total - fetched_material
    field_counts: dict[str, Counter[str]] = defaultdict(Counter)
    institution_counts: dict[str, Counter[str]] = defaultdict(Counter)
    family_counts: Counter[str] = Counter()
    top_counts: Counter[str] = Counter()
    upstream_subcategories: Counter[str] = Counter()
    downstream_subcategories: Counter[str] = Counter()
    for row in rows:
        field_counts[row["field"]]["total"] += 1
        field_counts[row["field"]]["fetched"] += int(row["evidence_fetched"] == "true")
        field_counts[row["field"]]["fetched_material"] += int(row["evidence_fetched"] in {"true", "ambiguous"})
        field_counts[row["field"]]["ambiguous"] += int(row["evidence_availability"] == "EVIDENCE_FETCHED_BUT_AMBIGUOUS")
        field_counts[row["field"]]["upstream"] += int(row["upstream_or_downstream"] == "UPSTREAM_EVIDENCE_GAP")
        field_counts[row["field"]]["downstream"] += int(row["upstream_or_downstream"] == "DOWNSTREAM_PROCESSING_GAP")
        institution_counts[row["institution"]]["total"] += 1
        institution_counts[row["institution"]]["fetched"] += int(row["evidence_fetched"] == "true")
        institution_counts[row["institution"]]["fetched_material"] += int(row["evidence_fetched"] in {"true", "ambiguous"})
        institution_counts[row["institution"]]["upstream"] += int(row["upstream_or_downstream"] == "UPSTREAM_EVIDENCE_GAP")
        institution_counts[row["institution"]]["downstream"] += int(row["upstream_or_downstream"] == "DOWNSTREAM_PROCESSING_GAP")
        family_counts[row["source_family"] or "NONE"] += int(row["evidence_fetched"] in {"true", "ambiguous"})
        top_counts[row["upstream_or_downstream"]] += 1
        (upstream_subcategories if row["upstream_or_downstream"] == "UPSTREAM_EVIDENCE_GAP" else downstream_subcategories)[row["failure_subcategory"]] += 1

    # Keep the complete benchmark field vocabulary visible. The confirmed
    # resolved population currently has no programme_status rows, which is a
    # useful diagnostic fact rather than a missing table row.
    for field in FIELDS:
        field_counts.setdefault(field, Counter())

    def table(headers: list[str], values: Iterable[Iterable[Any]]) -> str:
        output = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
        output.extend("| " + " | ".join(str(value).replace("|", "\\|") for value in row) + " |" for row in values)
        return "\n".join(output)

    lines = [
        f"# Phase 3F source adequacy audit — {run_id}",
        "",
        "> Post-seal diagnostic only. Frozen truth was read after the sealed run artifact; it was not supplied to the pipeline, discovery, extraction, or projection stages.",
        "",
        "## Result",
        "",
        f"The audit covers **{total}** confirmed primary resolved cases: 118 `FOUND` value cases and 4 `NOT_REQUIRED` semantic cases.",
        "",
        f"- Confirmed supporting evidence fetched: **{fetched}**",
        f"- Fetched but ambiguous/insufficient support: **{ambiguous}**",
        f"- Supporting evidence absent from fetched material: **{absent}**",
        f"- Field-relevant material fetched (confirmed + ambiguous): **{fetched_material}/{total} = {fetched_material / total:.2%}**",
        f"- `FIELD_EVIDENCE_DISCOVERY_RECALL` (confirmed support): **{fetched}/{total} = {fetched / total:.2%}**",
        f"- Matrix: `{matrix_path}`",
        "",
        "The audit intentionally counts fetched-but-ambiguous material as fetched for discovery recall, while retaining it as a separate evidence quality class. A source is only marked direct when conservative expected-value/evidence signals are present; official authority alone does not qualify.",
        "",
        "## Per-field evidence availability",
        "",
        table(["Field", "Cases", "Support fetched", "Material fetched", "Ambiguous", "Upstream", "Downstream"], ((field, c["total"], c["fetched"], c["fetched_material"], c["ambiguous"], c["upstream"], c["downstream"]) for field, c in sorted(field_counts.items()))),
        "",
        "## Per-institution evidence availability",
        "",
        table(["Institution", "Cases", "Support fetched", "Material fetched", "Recall", "Upstream", "Downstream"], ((institution, c["total"], c["fetched"], c["fetched_material"], f"{c['fetched'] / c['total']:.2%}", c["upstream"], c["downstream"]) for institution, c in sorted(institution_counts.items()))),
        "",
        "## Source-family distribution",
        "",
        table(["Source family", "Cases"], family_counts.most_common()),
        "",
        "## Upstream vs downstream",
        "",
        table(["Bucket", "Cases"], top_counts.most_common()),
        "",
        "### Upstream subcategories",
        "",
        table(["Subcategory", "Cases"], upstream_subcategories.most_common() or [("None", 0)]),
        "",
        "### Downstream subcategories",
        "",
        table(["Subcategory", "Cases"], downstream_subcategories.most_common() or [("None", 0)]),
        "",
        "## Interpretation",
        "",
        "`required_source_discovery_recall = 100%` measures that the routed programme/source keys were discovered/admitted. It does not establish that a fetched document contains the field-specific fact. This audit therefore uses field-level raw/evidence support as a separate diagnostic metric and does not alter the frozen scorer contract.",
        "",
        "The matrix distinguishes a programme page that was fetched but lacks tuition/deadline/language/admissions content from a supporting source that was fetched and then lost in extraction, assertion selection, applicability/temporal validation, conflict handling, or projection. `NOT_REQUIRED` rows are audited for explicit scoped non-requirement evidence rather than a monetary/text value.",
        "",
        "## Scope and limitations",
        "",
        "This is a conservative automated triage. `DIRECT` requires a fetched raw source with a deterministic support signal or a corroborating runtime assertion; `AMBIGUOUS` means field-relevant material was fetched but semantic support is not proven. Only `DIRECT` contributes to the strict field-evidence discovery recall; ambiguous rows remain candidates for manual evidence review. No search result snippet, third-party text, or expected truth value was used as runtime evidence during pipeline execution.",
        "",
        "No official benchmark #4 was run.",
        "",
    ]
    return "\n".join(lines)


def audit(run_dir: Path, truth_path: Path, roster_path: Path, matrix_path: Path, report_path: Path) -> None:
    output = read_json(run_dir / "pipeline-output.json")
    if not output.get("sealed"):
        raise ValueError("Pipeline output is not sealed")
    truth = read_jsonl(truth_path)
    resolved = [
        row for row in truth
        if row.get("review_status") == "REVIEWED_CONFIRMED"
        and row.get("expected_state") in {"FOUND", "NOT_REQUIRED"}
    ]
    if len(resolved) != 122:
        raise ValueError(f"Expected 122 confirmed resolved cases, found {len(resolved)}")
    by_case = {str(row.get("case_id")): row for row in output.get("records", [])}
    roster_rows, register = parse_roster(roster_path)
    sources = read_jsonl(run_dir / "pipeline-run" / "sources.jsonl")
    fetched: dict[str, dict[str, Any]] = {}
    for source in sources:
        url = canonical(str(source.get("url") or source.get("canonical_url") or ""))
        if not url:
            continue
        source = dict(source)
        source["_text"] = raw_text(run_dir, source)
        if url not in fetched or len(source["_text"]) > len(fetched[url].get("_text", "")):
            fetched[url] = source
    assertions = read_jsonl(run_dir / "pipeline-run" / "field_assertions.jsonl")
    assertions_by_programme: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for assertion in assertions:
        assertions_by_programme[str(assertion.get("entity_id") or "")].append(assertion)

    matrix: list[dict[str, Any]] = []
    for expected in resolved:
        case_id = str(expected["case_id"])
        output_record = by_case.get(case_id)
        if not output_record:
            raise ValueError(f"Sealed output missing {case_id}")
        programme_id = str(output_record.get("runtime_programme_id") or "")
        assertion_list = assertions_by_programme.get(programme_id, [])
        components = set(COMPONENT_FIELDS.get(str(expected["field"]), (str(expected["field"]),)))
        relevant = [item for item in assertion_list if str(item.get("field_name") or "") in components]
        grouped = {component: [item for item in relevant if str(item.get("field_name") or "") == component] for component in components}
        row_number_match = re.search(r"^GT-V2-(\d+)-", case_id)
        row_number = int(row_number_match.group(1)) if row_number_match else 0
        roster = dict(roster_rows.get(row_number, {}))
        roster["source_register"] = register
        matrix.append(classify_case(expected, output_record, roster, fetched, grouped, run_dir))
    matrix.sort(key=lambda row: row["case_id"])
    write_jsonl(matrix_path, matrix)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(build_report(matrix, run_id=str(output.get("run_id")), matrix_path=str(matrix_path)), encoding="utf-8", newline="\n")
    print(json.dumps({
        "run_id": output.get("run_id"),
        "resolved_cases": len(matrix),
        "evidence_fetched": sum(row["evidence_fetched"] == "true" for row in matrix),
        "evidence_fetched_ambiguous": sum(row["evidence_fetched"] == "ambiguous" for row in matrix),
        "evidence_ambiguous": sum(row["evidence_availability"] == "EVIDENCE_FETCHED_BUT_AMBIGUOUS" for row in matrix),
        "upstream": sum(row["upstream_or_downstream"] == "UPSTREAM_EVIDENCE_GAP" for row in matrix),
        "downstream": sum(row["upstream_or_downstream"] == "DOWNSTREAM_PROCESSING_GAP" for row in matrix),
        "matrix": str(matrix_path),
        "report": str(report_path),
    }, ensure_ascii=False, indent=2))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default="phase3f-v2-run-20260905T030109Z")
    parser.add_argument("--matrix", type=Path, default=None)
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args(argv)
    run_dir = REPO_ROOT / "docs/benchmarks/runs" / args.run_id
    matrix = args.matrix or (run_dir / "run3-field-evidence-audit.jsonl")
    report = args.report or (REPO_ROOT / "docs/benchmarks/2026-09-05-phase-3f-source-adequacy-audit.md")
    audit(
        run_dir,
        REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl",
        REPO_ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md",
        matrix,
        report,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
