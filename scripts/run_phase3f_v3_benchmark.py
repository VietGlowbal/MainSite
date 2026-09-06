"""Execute and seal the first real Phase 3F V3 benchmark run.

This harness intentionally has two phases:

1. Build an execution-only ``SmokeConfig`` from the frozen roster and run the
   real pipeline.  No truth artifact is loaded or passed to the pipeline.
2. Read the completed pipeline run artifacts and project them into the locked
   scorer output schema.  The projection is sealed before a scorer is invoked.

The frozen truth is used only for its integrity digest in run metadata.  This
module never reads truth records, expected states, expected values, or review
decisions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.config import (  # noqa: E402
    CrawlLimits,
    InstitutionSeed,
    SmokeConfig,
    load_dotenv_if_present,
)
from glowbal_ingestion.models import utc_now_iso  # noqa: E402
from glowbal_ingestion.pipeline import SmokePipeline  # noqa: E402
from glowbal_ingestion.product_safety import BLOCKERS, ProductLifecycleState  # noqa: E402
from glowbal_ingestion.runtime_acceptance import (  # noqa: E402
    projection_acceptance_reasons,
)
from glowbal_ingestion.url_safety import canonicalize_url  # noqa: E402


TRUTH_PATH = REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
ROSTER_PATH = REPO_ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
FREEZE_MANIFEST_PATH = REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json"
CONTRACT_PATH = REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json"
CONTRACT_MARKDOWN_PATH = REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md"
LIMITS_PATH = REPO_ROOT / "services/data-ingestion/configs/crawl-limits.json"

OUTPUT_SCHEMA_VERSION = "phase3f-v3-benchmark-output/v1"
TRUTH_VERSION = "phase-3f-ground-truth-v2-frozen"
BENCHMARK_VERSION = "phase3f-v2"
FIELDS = (
    "programme_identity",
    "credential",
    "programme_status",
    "tuition",
    "application_deadline",
    "english_requirement",
    "major_admissions_requirement",
)
RUNTIME_FAILURE_STATES = {
    "FETCH_FAILED",
    "PARSE_FAILED",
    "EXTRACTION_FAILED",
    "SOURCE_NOT_FOUND",
    "ACCESS_BLOCKED",
    "STALE_ONLY",
    "CONFLICTING_SOURCES",
}
NULL_REASON_TO_STATE = {
    "FETCH_FAILED": "FETCH_FAILED",
    "PARSE_FAILED": "PARSE_FAILED",
    "EXTRACTION_FAILED": "EXTRACTION_FAILED",
    "NOT_PUBLISHED": "NOT_PUBLISHED",
    "NOT_APPLICABLE": "NOT_REQUIRED",
    "OUTDATED_ONLY": "STALE_ONLY",
    "CONFLICTED": "CONFLICTING_SOURCES",
    "BLOCKED_BY_POLICY": "ACCESS_BLOCKED",
    "AMBIGUOUS": "NEEDS_REVIEW",
}
RUNTIME_ERROR_CODE_TO_STATE = {
    "BLOCKED_BY_ROBOTS": "ACCESS_BLOCKED",
    "ACCESS_BLOCKED": "ACCESS_BLOCKED",
    "HTTP_403": "ACCESS_BLOCKED",
    "SOURCE_NOT_FOUND": "SOURCE_NOT_FOUND",
    "NO_SOURCE_CANDIDATES": "SOURCE_NOT_FOUND",
    "HTTP_404": "SOURCE_NOT_FOUND",
    "PARSE_FAILED": "PARSE_FAILED",
    "EXTRACTION_FAILED": "EXTRACTION_FAILED",
    "EXTRACT_FAILED": "EXTRACTION_FAILED",
    "PROVIDER_UNAVAILABLE": "EXTRACTION_FAILED",
    "PERMANENT_PROVIDER_ERROR": "EXTRACTION_FAILED",
    "TRANSIENT_PROVIDER_ERROR": "EXTRACTION_FAILED",
    "RATE_LIMITED": "EXTRACTION_FAILED",
    "INVALID_PROVIDER_RESPONSE": "EXTRACTION_FAILED",
    "CONTEXT_LIMIT": "EXTRACTION_FAILED",
}
PROJECTION_CRITICAL_FIELDS = frozenset(
    {"programme_status", "tuition", "final_deadline"}
)
PROJECTION_SUPPRESS_ERRORS = frozenset(
    {
        "SOURCE_EXCERPT_ONLY",
        "MISSING_ACADEMIC_CYCLE",
        "MISSING_TUITION_ACADEMIC_CYCLE",
        "MISSING_TUITION_FEE_PERIOD",
        "MISSING_TUITION_AUDIENCE",
        "OUTDATED_TUITION_CYCLE",
        "INACTIVE_PROGRAMME_CONFLICT",
        "PROGRAMME_APPLICABILITY_NOT_PROVEN",
        "APPLICABILITY_SOURCE_NOT_IN_FETCH_SET",
        "APPLICABILITY_EVIDENCE_NOT_FOUND",
    }
)

INSTITUTION_CONFIG = {
    "MIT": ("mit-us", "US", "mit.edu", "https://www.mit.edu/"),
    "Harvard": ("harvard-us", "US", "harvard.edu", "https://www.harvard.edu/"),
    "Princeton": ("princeton-us", "US", "princeton.edu", "https://www.princeton.edu/"),
    "Duke": ("duke-us", "US", "duke.edu", "https://www.duke.edu/"),
    "Northwestern": ("northwestern-us", "US", "northwestern.edu", "https://www.northwestern.edu/"),
    "Cornell": ("cornell-us", "US", "cornell.edu", "https://www.cornell.edu/"),
    "UCLA": ("ucla-us", "US", "ucla.edu", "https://www.ucla.edu/"),
    "Université de Montréal": ("udem-ca", "CA", "umontreal.ca", "https://www.umontreal.ca/"),
    "University of Tokyo": ("tokyo-jp", "JP", "u-tokyo.ac.jp", "https://www.u-tokyo.ac.jp/en/"),
    "ETH Zurich": ("eth-zurich-ch", "CH", "ethz.ch", "https://ethz.ch/en.html"),
    "Sorbonne Université": ("sorbonne-fr", "FR", "sorbonne-universite.fr", "https://www.sorbonne-universite.fr/"),
    "University of Michigan": ("michigan-us", "US", "umich.edu", "https://umich.edu/"),
}


class BenchmarkHarnessError(RuntimeError):
    """Raised when execution-only benchmark preparation or sealing is invalid."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def utc_run_id() -> str:
    return datetime.now(timezone.utc).strftime("phase3f-v2-run-%Y%m%dT%H%M%SZ")


def git_value(*args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    value = result.stdout.strip()
    return value or None


def dirty_worktree() -> bool | None:
    status = git_value("status", "--porcelain")
    return None if status is None else bool(status)


def node_version() -> str | None:
    node = shutil.which("node")
    if not node:
        return None
    try:
        result = subprocess.run(
            [node, "--version"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip() or None


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _parse_roster(roster_path: Path) -> tuple[list[dict[str, Any]], dict[str, str]]:
    text = roster_path.read_text(encoding="utf-8")
    rows: list[dict[str, Any]] = []
    for line in text.splitlines():
        if not re.match(r"^\|\s*\d+\s*\|", line):
            continue
        cells = _cells(line)
        if len(cells) < 10:
            raise BenchmarkHarnessError(f"Malformed roster row: {line}")
        row_match = re.fullmatch(r"\d+", cells[0])
        url_match = re.search(r"\((https?://[^)]+)\)", cells[3])
        if not row_match or not url_match:
            raise BenchmarkHarnessError(f"Malformed roster row: {line}")
        institution, separator, country = cells[1].partition("/")
        programme, separator, credential = cells[2].rpartition("/")
        if not separator:
            raise BenchmarkHarnessError(f"Roster row has no credential: {line}")
        source_codes = re.findall(r"`([^`]+)`", cells[4])
        if not source_codes:
            raise BenchmarkHarnessError(f"Roster row has no source codes: {line}")
        rows.append(
            {
                "row": int(row_match.group(0)),
                "institution": institution.strip(),
                "country": country.strip(),
                "programme": programme.strip(),
                "credential": credential.strip(),
                "url": canonicalize_url(url_match.group(1)),
                "source_codes": source_codes,
                "target_cycle": cells[5],
                "stress": cells[6],
                "tags": re.findall(r"[A-Z][A-Z0-9_-]*", cells[7]),
            }
        )

    rows.sort(key=lambda item: int(item["row"]))
    if [int(item["row"]) for item in rows] != list(range(1, 37)):
        raise BenchmarkHarnessError("Frozen roster did not contain exactly rows 1-36.")

    source_register: dict[str, str] = {}
    in_source_register = False
    for line in text.splitlines():
        if line.startswith("## Supporting-source register"):
            in_source_register = True
            continue
        if in_source_register and line.startswith("## "):
            break
        if not in_source_register or not line.startswith("| `"):
            continue
        cells = _cells(line)
        if len(cells) < 3:
            continue
        code = cells[0].strip("`")
        locator_match = re.search(r"https?://\S+", cells[2])
        if code and locator_match:
            source_register[code] = locator_match.group(0).rstrip("` ")

    missing = sorted(
        {
            code
            for row in rows
            for code in row["source_codes"]
            if code not in source_register
        }
    )
    if missing:
        raise BenchmarkHarnessError(
            "Roster source register is missing codes: " + ", ".join(missing)
        )
    return rows, source_register


def _degree_level(credential: str) -> str:
    value = credential.casefold()
    if any(token in value for token in ("phd", "doctor", "dphil")):
        return "phd"
    if any(
        token in value
        for token in (
            "master",
            "msc",
            "mps",
            "meng",
            "mba",
            "mph",
            "sm",
            "mae",
            "dess",
            "ma",
        )
    ):
        return "master"
    return "bachelor"


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").casefold()


def build_execution_config(
    rows: list[dict[str, Any]],
    source_register: dict[str, str],
    *,
    field_directed_recovery: bool = False,
) -> SmokeConfig:
    by_institution: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_institution[str(row["institution"])].append(row)

    raw_limits = json.loads(LIMITS_PATH.read_text(encoding="utf-8"))
    limits = CrawlLimits.from_dict(raw_limits)
    limits = replace(
        limits,
        max_deep_programmes_per_institution=3,
        max_optional_phd_total=max(limits.max_optional_phd_total, 3),
    )

    seeds: list[InstitutionSeed] = []
    for institution_name, seed_rows in by_institution.items():
        if institution_name not in INSTITUTION_CONFIG:
            raise BenchmarkHarnessError(
                f"No execution configuration for roster institution: {institution_name}"
            )
        institution_id, country_code, official_domain, homepage_url = INSTITUTION_CONFIG[
            institution_name
        ]
        manual_urls = tuple(str(row["url"]) for row in seed_rows)
        metadata: dict[str, dict[str, str]] = {}
        programme_source_bundles: dict[str, tuple[str, ...]] = {}
        allowed_domains = {_host(homepage_url), official_domain}
        for row in seed_rows:
            url = str(row["url"])
            # The frozen roster supplies crawl targets and source bundles only.
            # Its programme title/credential/stress labels are benchmark
            # expectations, not runtime evidence or metadata overrides.
            metadata[url] = {}
            source_urls = tuple(source_register[code] for code in row["source_codes"])
            programme_source_bundles[url] = source_urls
            allowed_domains.update({_host(url), *(_host(item) for item in source_urls)})

        seeds.append(
            InstitutionSeed(
                institution_id=institution_id,
                name=institution_name,
                country_code=country_code,
                official_domain=official_domain,
                homepage_url=homepage_url,
                allowed_domains=tuple(sorted(domain for domain in allowed_domains if domain)),
                manual_programme_urls=manual_urls,
                programme_metadata=metadata,
                programme_source_bundles=programme_source_bundles,
                # This is the benchmark's execution-only roster projection. It
                # still uses the production policy check and explicit opt-in for
                # the roster's currently unreviewed terms metadata.
                terms_status="UNREVIEWED",
                enable_optional_phd=True,
                # Keep diagnostic smokes roster-bound. Field-directed recovery
                # expands the bounded link categories below; native catalogue
                # traversal would replace the selected smoke programmes with
                # unrelated candidates and is therefore not enabled here.
                manual_only=True,
            )
        )

    configured_provider = os.environ.get("EXTRACTION_PROVIDER", "").strip().lower()
    deepseek_config = configured_provider == "deepseek"
    if deepseek_config:
        model = (
            os.environ.get("EXTRACTION_MODEL", "").strip()
            or os.environ.get("DEEPSEEK_MODEL", "").strip()
            or "deepseek-v4-flash"
        )
        base_url = (
            os.environ.get("DEEPSEEK_BASE_URL", "").strip()
            or os.environ.get("EXTRACTION_ENDPOINT", "").strip()
            or "https://api.deepseek.com"
        )
    else:
        model = (
            os.environ.get("EXTRACTION_MODEL", "").strip()
            or os.environ.get("OPENAI_COMPATIBLE_MODEL", "").strip()
            or "deepseek-v4-flash"
        )
        base_url = (
            os.environ.get("EXTRACTION_ENDPOINT", "").strip()
            or os.environ.get("OPENAI_COMPATIBLE_BASE_URL", "").strip()
            or os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        )
    return SmokeConfig(
        run_name="phase3f-v2-first-real",
        institutions=tuple(seeds),
        limits=limits,
        deepseek_flash_model=model,
        deepseek_pro_model=model if model != "deepseek-v4-flash" else "deepseek-v4-pro",
        deepseek_base_url=base_url,
        raw_evidence_mode=os.environ.get("RAW_EVIDENCE_MODE", "local").strip().lower(),
        raw_evidence_inline_max_bytes=int(
            os.environ.get("RAW_EVIDENCE_INLINE_MAX_BYTES", str(8 * 1024 * 1024))
        ),
        acquisition_backend=os.environ.get("ACQUISITION_BACKEND", "legacy").strip().lower(),
    )


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise BenchmarkHarnessError(f"{path}:{line_number} is not an object.")
            records.append(value)
    return records


def _json_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _has_value(value: Any) -> bool:
    return value is not None and value != "" and value != [] and value != {}


def _runtime_state_from_errors(errors: Iterable[dict[str, Any]]) -> str | None:
    """Map an actual runtime failure to a terminal field state.

    This is only used when no programme/field assertion exists. It prevents a
    blocked or failed target from being mislabeled NOT_EVALUATED while
    preserving the distinction between transport and extraction failures.
    """

    states: list[str] = []
    for error in errors:
        code = str(error.get("error_code") or error.get("code") or "").upper()
        stage = str(error.get("stage") or "").casefold()
        mapped = RUNTIME_ERROR_CODE_TO_STATE.get(code)
        if mapped:
            states.append(mapped)
        elif "extraction" in stage:
            states.append("EXTRACTION_FAILED")
        elif "parse" in stage:
            states.append("PARSE_FAILED")
        elif "fetch" in stage or "source" in stage:
            states.append("FETCH_FAILED")
    for preferred in (
        "ACCESS_BLOCKED",
        "SOURCE_NOT_FOUND",
        "EXTRACTION_FAILED",
        "PARSE_FAILED",
        "FETCH_FAILED",
    ):
        if preferred in states:
            return preferred
    return None


def _assertion_value(assertion: dict[str, Any]) -> Any:
    return assertion.get("value_json")


def _years(value: Any) -> set[int]:
    return {int(item) for item in re.findall(r"20\d{2}", str(value or ""))}


def _audience_matches(value: Any, target: Any) -> bool:
    left, right = str(value or "").casefold(), str(target or "").casefold()
    if not left or left in {"all", "any", "unknown"} or not right:
        return True
    if right in {"all", "any", "unknown"}:
        return True
    left_kinds = {
        kind
        for kind, pattern in {
            "domestic": r"\b(?:domestic|home|local)\b",
            "international": r"\b(?:international|overseas|foreign)\b",
        }.items()
        if re.search(pattern, left)
    }
    right_kinds = {
        kind
        for kind, pattern in {
            "domestic": r"\b(?:domestic|home|local)\b",
            "international": r"\b(?:international|overseas|foreign)\b",
        }.items()
        if re.search(pattern, right)
    }
    if left_kinds or right_kinds:
        return not left_kinds or not right_kinds or bool(left_kinds & right_kinds)
    return left == right


def _cycle_matches(value: Any, target: Any) -> bool:
    left, right = _years(value), _years(target)
    return not left or not right or bool(left & right)


def _projection_candidate(
    assertion: dict[str, Any],
    *,
    field_name: str | None = None,
    component_field: str | None = None,
    target_cycle: Any = None,
    audience: Any = None,
    target_degree: str | None = None,
) -> bool:
    """Return whether an evidenced assertion may be runtime-visible.

    Runtime visibility is deliberately separate from Product Safety and
    canonical promotion.  The field-aware policy is stricter only where the
    value's semantics require scope/currentness proof; it does not require a
    product-safe assertion merely to expose a supported runtime fact.
    """

    return not projection_acceptance_reasons(
        assertion,
        field_name=field_name,
        component_field=component_field,
        target_cycle=target_cycle,
        audience=audience,
        target_degree=target_degree,
    )


def _assertion_rank(assertion: dict[str, Any], *, target_cycle: Any = None) -> tuple[int, ...]:
    status_rank = {
        "HUMAN_VERIFIED": 4,
        "RULE_VALIDATED": 3,
        "AI_EXTRACTED": 2,
        "FETCHED": 1,
        "NEEDS_REVIEW": 1,
    }.get(str(assertion.get("verification_status") or ""), 0)
    authority_rank = {
        "OFFICIAL": 5,
        "GOVERNMENT": 5,
        "OFFICIAL_PARTNER": 4,
        "ACCREDITED_PROVIDER": 3,
        "TRUSTED_AGGREGATOR": 2,
    }.get(str(assertion.get("source_authority") or ""), 0)
    years = _years(assertion.get("academic_cycle"))
    target_years = _years(target_cycle)
    return (
        1 if target_years and years and target_years & years else 0,
        1 if str(assertion.get("scope") or "").casefold() in {"programme", "program", "offering"} else 0,
        1 if _audience_matches(assertion.get("audience"), "international") else 0,
        authority_rank,
        status_rank,
        int(round(float(assertion.get("confidence") or 0) * 1000)),
    )


def _state_for_assertions(
    assertions: list[dict[str, Any]],
    *,
    field_name: str | None = None,
    component_field: str | None = None,
    target_cycle: Any = None,
    audience: Any = None,
    target_degree: str | None = None,
    unresolved_conflict: bool = False,
) -> tuple[str, Any, list[dict[str, Any]]]:
    if unresolved_conflict:
        return "CONFLICTING_SOURCES", None, assertions[:1]
    candidates = [
        item
        for item in assertions
        if _projection_candidate(
            item,
            field_name=field_name,
            component_field=component_field,
            target_cycle=target_cycle,
            audience=audience,
            target_degree=target_degree,
        )
    ]
    if candidates:
        selected = max(
            enumerate(candidates),
            key=lambda item: (_assertion_rank(item[1], target_cycle=target_cycle), -item[0]),
        )[1]
        return "FOUND", _assertion_value(selected), [selected]

    # A value that failed semantic validation is intentionally retained as an
    # audit candidate but cannot be represented as a runtime fact.
    blocked_values = [
        item for item in assertions if _has_value(_assertion_value(item))
    ]
    if blocked_values:
        return "NEEDS_REVIEW", None, blocked_values[:1]

    for item in assertions:
        reason = str(item.get("null_reason") or "")
        state = NULL_REASON_TO_STATE.get(reason)
        if state:
            if state == "NOT_PUBLISHED" and not item.get("evidence"):
                return "NEEDS_REVIEW", None, [item]
            return state, None, [item]
    return "NOT_EVALUATED", None, []


def _aggregate_state(
    assertions_by_field: dict[str, list[dict[str, Any]]],
    field_names: Iterable[str],
    *,
    aggregate_field: str | None = None,
    target_degree: str | None = None,
    target_cycle: Any = None,
    audience: Any = None,
    unresolved_conflict_fields: set[str] | None = None,
) -> tuple[str, Any, list[dict[str, Any]]]:
    selected: list[dict[str, Any]] = []
    values: dict[str, Any] = {}
    states: list[str] = []
    for field_name in field_names:
        state, value, used = _state_for_assertions(
            assertions_by_field.get(field_name, []),
            field_name=aggregate_field,
            component_field=field_name,
            target_cycle=target_cycle,
            audience=audience,
            target_degree=target_degree,
            unresolved_conflict=field_name in (unresolved_conflict_fields or set()),
        )
        if used:
            selected.extend(used)
        if _has_value(value):
            values[field_name] = value
        states.append(state)
    if values:
        return "FOUND", values, selected
    for preferred in (
        "NEEDS_REVIEW",
        "CONFLICTING_SOURCES",
        "STALE_ONLY",
        "SOURCE_NOT_FOUND",
        "ACCESS_BLOCKED",
        "FETCH_FAILED",
        "PARSE_FAILED",
        "EXTRACTION_FAILED",
        "NOT_REQUIRED",
        "NOT_PUBLISHED",
    ):
        if preferred in states:
            return preferred, None, selected
    return "NOT_EVALUATED", None, selected


def _quality_blockers(
    *,
    field: str,
    field_names: Iterable[str],
    programme_id: str,
    selected_assertions: list[dict[str, Any]],
    quality_assessments: dict[tuple[str, str], list[dict[str, Any]]],
    unresolved_conflict_fields: set[str],
    state: str,
    raw_evidence_mode: str,
    factual_identity_resolved: bool,
) -> list[str]:
    """Project product-safety blockers without suppressing valid runtime facts."""

    blockers: list[str] = []
    component_fields = {field, *field_names}

    def add(blocker: str) -> None:
        if blocker in BLOCKERS and blocker not in blockers:
            blockers.append(blocker)

    if not factual_identity_resolved:
        add("IDENTITY_UNRESOLVED")
    if component_fields.intersection(unresolved_conflict_fields):
        add("UNRESOLVED_CONFLICT")
    if state == "CONFLICTING_SOURCES":
        add("UNRESOLVED_CONFLICT")
    elif state == "STALE_ONLY":
        add("STALE_CRITICAL_FIELD")
    elif state in RUNTIME_FAILURE_STATES or state in {"NOT_EVALUATED", "NEEDS_REVIEW"}:
        add("MISSING_CRITICAL_FIELD")

    for assertion in selected_assertions:
        if not assertion.get("raw_document_id"):
            add("RAW_LINEAGE_MISSING")
        if str(assertion.get("epistemic_state") or "").upper() == "INFERRED":
            add("INFERRED_HIGH_VOLATILITY_CRITICAL")
        if str(assertion.get("verification_status") or "") == "NEEDS_REVIEW":
            add("REVIEW_REQUIRED")
        temporal = str(assertion.get("temporal_state") or "UNKNOWN").upper()
        if field in PROJECTION_CRITICAL_FIELDS or component_fields.intersection(PROJECTION_CRITICAL_FIELDS):
            if temporal in {"HISTORICAL", "FUTURE", "TARGET_CYCLE_ESTIMATE"}:
                add("STALE_CRITICAL_FIELD")
            elif temporal != "CURRENT":
                add("REVIEW_REQUIRED")
        applicability = str(assertion.get("applicability_state") or "UNKNOWN").upper()
        if applicability in {"UNKNOWN", "NOT_APPLICABLE"}:
            add("REVIEW_REQUIRED")
        if not assertion.get("source_authority"):
            add("INSUFFICIENT_AUTHORITY")

    # Local retention can support diagnosis but never a PRODUCT_SAFE claim.
    if selected_assertions and raw_evidence_mode not in {"remote", "dual"}:
        add("RAW_LINEAGE_MISSING")

    for component in component_fields:
        for assessment in quality_assessments.get((programme_id, component), ()):
            assessment_state = str(assessment.get("state") or "")
            conflict_state = str(assessment.get("conflict_state") or "")
            if assessment_state == "CONFLICTING_SOURCES" or conflict_state in {
                "DETECTED",
                "NEEDS_REVIEW",
            }:
                add("UNRESOLVED_CONFLICT")
            elif assessment_state == "STALE_ONLY":
                add("STALE_CRITICAL_FIELD")
            elif assessment_state in {
                "NEEDS_REVIEW",
                "NOT_EVALUATED",
                "SOURCE_NOT_FOUND",
                "ACCESS_BLOCKED",
                "FETCH_FAILED",
                "PARSE_FAILED",
                "EXTRACTION_FAILED",
            }:
                add("MISSING_CRITICAL_FIELD")
            if assessment_state == "FOUND":
                if assessment.get("authority") in (None, ""):
                    add("INSUFFICIENT_AUTHORITY")
                if str(assessment.get("applicability") or "UNKNOWN") in {
                    "UNKNOWN",
                    "NOT_APPLICABLE",
                }:
                    add("REVIEW_REQUIRED")
                if assessment.get("verification_required") is True or str(
                    assessment.get("verification") or ""
                ) in {"UNVERIFIED", "NEEDS_REVIEW"}:
                    add("REVIEW_REQUIRED")

    return blockers


def _source_record_index(pipeline_dir: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for record in _read_jsonl(pipeline_dir / "sources.jsonl"):
        for key in ("url", "canonical_url"):
            value = record.get(key)
            if value:
                result[str(value)] = record
                try:
                    result[canonicalize_url(str(value))] = record
                except Exception:  # noqa: BLE001 - a malformed runtime URL stays auditable
                    pass
    return result


def _project_output(
    *,
    run_id: str,
    pipeline_dir: Path,
    rows: list[dict[str, Any]],
    source_register: dict[str, str],
    raw_evidence_mode: str,
) -> dict[str, Any]:
    programme_records = _read_jsonl(pipeline_dir / "programmes.jsonl")
    programme_by_url = {
        str(record.get("official_url")): record
        for record in programme_records
        if record.get("official_url")
    }
    assertions = _read_jsonl(pipeline_dir / "effective_field_assertions.jsonl")
    if not assertions:
        assertions = _read_jsonl(pipeline_dir / "field_assertions.jsonl")
    assertions_by_programme: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for assertion in assertions:
        entity_id = str(assertion.get("entity_id") or "")
        field_name = str(assertion.get("field_name") or "")
        if entity_id and field_name:
            assertions_by_programme[entity_id][field_name].append(assertion)

    source_index = _source_record_index(pipeline_dir)
    quality_assessments: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for assessment in _read_jsonl(pipeline_dir / "quality_coverage_assessments.jsonl"):
        entity_id = str(assessment.get("entity_id") or assessment.get("entity") or "")
        field_name = str(assessment.get("field") or "")
        if entity_id and field_name:
            quality_assessments[(entity_id, field_name)].append(assessment)
    # Conflicts are scoped to one routed programme entity and one field.  A
    # field name by itself is not enough: a tuition disagreement for one
    # programme must never suppress an otherwise independent tuition claim for
    # every other programme in the projection.
    unresolved_conflicts_by_entity: dict[str, set[str]] = defaultdict(set)
    for conflict in _read_jsonl(pipeline_dir / "quality_conflicts.jsonl"):
        if str(conflict.get("state") or "") in {
            "NEEDS_REVIEW",
            "REQUIRES_REVIEW",
            "UNRESOLVABLE",
        }:
            entity_id = str(conflict.get("entity_id") or conflict.get("entity") or "")
            field_name = str(conflict.get("field") or "")
            if entity_id and field_name:
                unresolved_conflicts_by_entity[entity_id].add(field_name)
    crawl_errors = _read_jsonl(pipeline_dir / "crawl_errors.jsonl")
    errors_by_url: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for error in crawl_errors:
        if error.get("url"):
            errors_by_url[str(error["url"])].append(error)

    pipeline_manifest: dict[str, Any] = {}
    manifest_path = pipeline_dir / "manifest.json"
    if manifest_path.exists():
        value = json.loads(manifest_path.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            pipeline_manifest = value
    pipeline_metrics: dict[str, Any] = {}
    coverage_path = pipeline_dir / "coverage_report.json"
    if coverage_path.exists():
        value = json.loads(coverage_path.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            pipeline_metrics = value.get("metrics", {})

    records: list[dict[str, Any]] = []
    programme_keys: list[str] = []
    required_source_keys: list[str] = []
    discovered_rows: list[dict[str, Any]] = []
    for row in rows:
        row_number = int(row["row"])
        url = str(row["url"])
        programme = programme_by_url.get(url)
        programme_id = str(programme.get("programme_id")) if programme else ""
        if programme:
            programme_keys.append(f"roster-v2-row-{row_number}")
            required_source_keys.append(f"roster-v2-row-{row_number}")
            discovered_rows.append(row)
        field_assertions = assertions_by_programme.get(programme_id, {})
        # Routing association answers "which runtime record belongs to this
        # roster URL".  It is intentionally distinct from factual identity,
        # which still requires source-backed credential/identity evidence.
        routing_resolved = bool(programme)
        unresolved_conflict_fields = set(
            unresolved_conflicts_by_entity.get(programme_id, ())
        )
        target_cycle = str(row["target_cycle"]).split(" / ", 1)[0]
        audience = (
            str(row["target_cycle"]).split(" / ", 1)[1]
            if " / " in str(row["target_cycle"])
            else None
        )
        target_degree = str(programme.get("degree_level") or "") if programme else None
        identity_state, identity_value, identity_used_assertions = (
            _state_for_assertions(
                field_assertions.get("programme_identity", []),
                field_name="programme_identity",
                target_cycle=target_cycle,
                audience=audience,
                target_degree=target_degree,
                unresolved_conflict=(
                    "programme_identity" in unresolved_conflict_fields
                ),
            )
        )
        credential_state, credential_value, credential_used_assertions = (
            _state_for_assertions(
                field_assertions.get("credential", []),
                field_name="credential",
                target_cycle=target_cycle,
                audience=audience,
                target_degree=target_degree,
                unresolved_conflict="credential" in unresolved_conflict_fields,
            )
        )
        # Factual identity is source-backed only.  ProgrammeRecord.credential
        # is routing/catalogue metadata and must never bootstrap benchmark
        # facts, especially for user-supplied roster URLs.
        factual_identity_resolved = (
            identity_state == "FOUND" and credential_state == "FOUND"
        )
        identity = {
            "resolved": routing_resolved,
            "resolution_state": "ROUTING_RESOLVED" if routing_resolved else "UNRESOLVED",
            "programme_id": programme_id or None,
            "programme": (
                programme.get("programme_name")
                if routing_resolved and programme
                else None
            ),
            "institution": row["institution"],
            "merge_basis": "runtime_routing_official_url" if routing_resolved else None,
            "fuzzy_only": False,
            "routing_resolved": routing_resolved,
            "factual_identity_resolved": factual_identity_resolved,
            "factual_resolution_state": (
                "RESOLVED" if factual_identity_resolved else "UNRESOLVED"
            ),
        }

        runtime_errors = list(errors_by_url.get(url, ()))
        if not runtime_errors:
            try:
                runtime_errors = list(
                    errors_by_url.get(canonicalize_url(url), ())
                )
            except Exception:  # noqa: BLE001 - malformed roster URLs are validated earlier
                runtime_errors = []

        for field in FIELDS:
            used_assertions: list[dict[str, Any]] = []
            field_names: tuple[str, ...] = (field,)
            if field == "programme_identity":
                state, value, used_assertions = (
                    identity_state,
                    identity_value,
                    identity_used_assertions,
                )
            elif field == "credential":
                state, value, used_assertions = (
                    credential_state,
                    credential_value,
                    credential_used_assertions,
                )
            elif field == "application_deadline":
                field_names = (
                    "priority_deadline",
                    "final_deadline",
                    "funding_deadline",
                    "international_deadline",
                )
                state, value, used_assertions = _aggregate_state(
                    field_assertions,
                    field_names,
                    aggregate_field=field,
                    target_degree=target_degree,
                    target_cycle=target_cycle,
                    audience=audience,
                    unresolved_conflict_fields=unresolved_conflict_fields,
                )
            elif field == "english_requirement":
                field_names = ("ielts_overall", "ielts_subscores", "toefl", "duolingo")
                state, value, used_assertions = _aggregate_state(
                    field_assertions,
                    field_names,
                    aggregate_field=field,
                    target_degree=target_degree,
                    target_cycle=target_cycle,
                    audience=audience,
                    unresolved_conflict_fields=unresolved_conflict_fields,
                )
            elif field == "major_admissions_requirement":
                field_names = (
                    "minimum_degree",
                    "minimum_gpa",
                    "subject_prerequisites",
                    "standardized_tests",
                    "work_experience",
                    "portfolio",
                    "required_documents",
                    "recommendation_letters",
                    "sop_essay_requirements",
                )
                state, value, used_assertions = _aggregate_state(
                    field_assertions,
                    field_names,
                    aggregate_field=field,
                    target_degree=target_degree,
                    target_cycle=target_cycle,
                    audience=audience,
                    unresolved_conflict_fields=unresolved_conflict_fields,
                )
            else:
                state, value, used_assertions = _state_for_assertions(
                    field_assertions.get(field, []),
                    field_name=field,
                    target_cycle=target_cycle,
                    audience=audience,
                    target_degree=target_degree,
                    unresolved_conflict=field in unresolved_conflict_fields,
                )

            # A routed target with no field assertion may still have a real
            # terminal fetch/extraction outcome. Preserve that outcome rather
            # than treating it as if evaluation never happened.
            if state == "NOT_EVALUATED" and not any(
                field_assertions.get(component) for component in field_names
            ):
                operational_state = _runtime_state_from_errors(runtime_errors)
                if operational_state:
                    state = operational_state

            source_refs = []
            raw_refs = []
            assertion_refs = []
            temporal_states = []
            applicability_states = []
            verification_states = []
            inferred = False
            claim_assertions = [
                assertion
                for assertion in used_assertions
                if _has_value(_assertion_value(assertion))
            ]
            claim_assertion_refs = [
                str(assertion.get("assertion_id"))
                for assertion in claim_assertions
                if assertion.get("assertion_id")
            ]
            for assertion in used_assertions:
                assertion_id = assertion.get("assertion_id")
                if assertion_id:
                    assertion_refs.append(str(assertion_id))
                source_url = assertion.get("source_url")
                if source_url:
                    source_refs.append(str(source_url))
                    source = source_index.get(str(source_url))
                    if source is None:
                        try:
                            source = source_index.get(canonicalize_url(str(source_url)))
                        except Exception:  # noqa: BLE001
                            source = None
                    if source:
                        if source.get("raw_document_id"):
                            raw_refs.append(str(source["raw_document_id"]))
                    elif assertion.get("raw_document_id"):
                        raw_refs.append(str(assertion["raw_document_id"]))
                elif assertion.get("raw_document_id"):
                    raw_refs.append(str(assertion["raw_document_id"]))
                if not _has_value(_assertion_value(assertion)):
                    continue
                if assertion.get("temporal_state"):
                    temporal_states.append(str(assertion["temporal_state"]))
                if assertion.get("applicability_state"):
                    applicability_states.append(str(assertion["applicability_state"]))
                if assertion.get("verification_status"):
                    verification_states.append(str(assertion["verification_status"]))
                inferred = inferred or str(assertion.get("epistemic_state") or "").upper() == "INFERRED"

            if not source_refs and programme:
                source_refs.append(url)
            if not raw_refs:
                raw_refs = [str(item.get("raw_document_id")) for item in used_assertions if item.get("raw_document_id")]
            raw_refs = list(dict.fromkeys(item for item in raw_refs if item))
            source_refs = list(dict.fromkeys(item for item in source_refs if item))
            assertion_refs = list(dict.fromkeys(item for item in assertion_refs if item))
            assessment_rows = [
                assessment
                for component in {field, *field_names}
                for assessment in quality_assessments.get((programme_id, component), ())
            ]
            blockers = _quality_blockers(
                field=field,
                field_names=field_names,
                programme_id=programme_id,
                selected_assertions=claim_assertions,
                quality_assessments=quality_assessments,
                unresolved_conflict_fields=unresolved_conflict_fields,
                state=state,
                raw_evidence_mode=raw_evidence_mode,
                factual_identity_resolved=factual_identity_resolved,
            )
            quality = {
                "blockers": blockers,
                "assessment_state": (
                    str(assessment_rows[0].get("state"))
                    if assessment_rows
                    else None
                ),
                "temporal_state": temporal_states[0] if temporal_states else None,
                "applicability_state": applicability_states[0] if applicability_states else None,
                "verification": verification_states[0] if verification_states else None,
                "inferred": inferred,
                "conflict_state": "NEEDS_REVIEW" if state == "CONFLICTING_SOURCES" else None,
                "runtime_resolution": state,
                "canonical_promotion": False,
                "raw_persistence": {
                    "status": "REMOTE_DURABLE" if raw_evidence_mode in {"remote", "dual"} else "LOCAL_ONLY",
                    "durable": raw_evidence_mode in {"remote", "dual"},
                },
                "pipeline_errors": [
                    {
                        "stage": item.get("stage"),
                        "code": item.get("error_code"),
                        "retryable": item.get("retryable"),
                    }
                    for item in runtime_errors
                ],
            }
            first_assertion = claim_assertions[0] if claim_assertions else {}
            provenance = {
                "durable": raw_evidence_mode in {"remote", "dual"} and bool(raw_refs),
                "raw_document_id": raw_refs[0] if raw_refs else None,
                "assertion_id": claim_assertion_refs[0] if claim_assertion_refs else None,
                "supports_claim": bool(raw_refs and assertion_refs and first_assertion.get("evidence")),
                "evidence_entailment": "DETERMINISTIC_PASS" if raw_refs and assertion_refs and first_assertion.get("evidence") else "REVIEW_REQUIRED",
                "source_authority": first_assertion.get("source_authority"),
                "source_url": source_refs[0] if source_refs else None,
            }
            product_state = (
                "REVIEWABLE"
                if any(
                    blocker in {"IDENTITY_UNRESOLVED", "UNRESOLVED_CONFLICT", "REVIEW_REQUIRED"}
                    for blocker in blockers
                )
                else "PARTIAL"
            )
            candidate_assertions = [
                assertion
                for component in field_names
                for assertion in field_assertions.get(component, [])
            ]
            candidate_non_null = [
                assertion
                for assertion in candidate_assertions
                if _has_value(_assertion_value(assertion))
            ]
            candidate_diagnostics = [
                {
                    "assertion_id": assertion.get("assertion_id"),
                    "component_field": component,
                    "value_present": _has_value(_assertion_value(assertion)),
                    "accepted_for_runtime_found": not bool(
                        projection_acceptance_reasons(
                            assertion,
                            field_name=field,
                            component_field=component,
                            target_cycle=target_cycle,
                            audience=audience,
                            target_degree=target_degree,
                        )
                    ),
                    "acceptance_reasons": list(
                        projection_acceptance_reasons(
                            assertion,
                            field_name=field,
                            component_field=component,
                            target_cycle=target_cycle,
                            audience=audience,
                            target_degree=target_degree,
                        )
                    ),
                }
                for component in field_names
                for assertion in field_assertions.get(component, [])
            ]
            candidate_sources = {
                str(assertion.get("source_url"))
                for assertion in candidate_assertions
                if assertion.get("source_url")
            }
            # A routed programme can have a valid primary source even when no
            # assertion was emitted for this field. Keep that source in the
            # lifecycle trace so the absence of a candidate is not mistaken
            # for absence of parsed evidence.
            if not candidate_sources and url:
                candidate_sources.add(str(url))
            parsed_source_records = [
                source_index.get(source_url)
                or source_index.get(
                    canonicalize_url(source_url)
                )
                for source_url in candidate_sources
            ]
            parsed_source_records = [
                source for source in parsed_source_records if source
            ]
            field_evaluation_attempted = bool(candidate_assertions)
            if not field_evaluation_attempted and parsed_source_records:
                field_evaluation_attempted = True
            if (
                state == "NOT_EVALUATED"
                and field_evaluation_attempted
                and not runtime_errors
            ):
                # A valid parsed source is an evaluated field frontier even
                # when extraction produced no safe value. Keep the field
                # auditable as semantic uncertainty; NOT_EVALUATED is reserved
                # for fields for which evaluation truly never ran.
                state = "NEEDS_REVIEW"
            if state == "NOT_EVALUATED" and runtime_errors:
                evaluation_skip_reason = "terminal_runtime_failure"
            elif not field_evaluation_attempted:
                evaluation_skip_reason = "no_field_assertion_or_admitted_source"
            elif not candidate_non_null:
                evaluation_skip_reason = "evaluated_without_non_null_candidate"
            elif value is None:
                evaluation_skip_reason = "candidate_rejected_by_semantic_policy"
            else:
                evaluation_skip_reason = None
            lifecycle = {
                "source_count": len(parsed_source_records),
                "parser_status": (
                    "PARSED_NON_EMPTY"
                    if any(
                        int(source.get("text_length") or 0) > 0
                        for source in parsed_source_records
                    )
                    else "NOT_AVAILABLE"
                ),
                "parsed_text_present": any(
                    int(source.get("text_length") or 0) > 0
                    for source in parsed_source_records
                ),
                "candidate_assertion_count": len(candidate_assertions),
                "non_null_candidate_count": len(candidate_non_null),
                "field_evaluation_attempted": field_evaluation_attempted,
                "evaluation_skip_reason": evaluation_skip_reason,
                "coverage_state_before_evaluation": sorted(
                    {
                        str(assessment.get("state"))
                        for assessment in assessment_rows
                        if assessment.get("state")
                    }
                ),
                "coverage_state_after_evaluation": state,
                "quality_blockers": blockers,
                "product_safe": product_state == "PRODUCT_SAFE",
                "selection_reason": (
                    "policy_ranked_supported_candidate"
                    if value is not None
                    else (
                        "candidate_rejected_or_semantically_blocked"
                        if candidate_non_null
                        else "no_non_null_candidate"
                    )
                ),
                "selected_assertion_ids": claim_assertion_refs,
                "selected_candidate_count": len(claim_assertions),
                "candidate_diagnostics": candidate_diagnostics,
            }
            record = {
                "case_id": f"GT-V2-{row_number:02d}-{field}",
                "field": field,
                "state": state,
                "value": value,
                "identity": identity,
                "source_refs": source_refs,
                "raw_refs": raw_refs,
                "assertion_refs": assertion_refs,
                "quality": quality,
                "provenance": provenance,
                "product_state": product_state,
                "blockers": blockers,
                "programme": programme.get("programme_name") if programme else None,
                "institution": row["institution"],
                "target_cycle": target_cycle,
                "audience": audience,
                "runtime_programme_id": programme_id or None,
                "runtime_programme_url": url,
                "runtime_source_register": [source_register[code] for code in row["source_codes"]],
                "lifecycle": lifecycle,
            }
            # Credential has a source-native scalar in the runtime model. It is
            # safe to expose that semantic normalization; other fields retain
            # structured runtime values without inventing benchmark normalizers.
            if field == "credential" and value is not None:
                record["normalized_value"] = str(value)
            records.append(record)

    records.sort(key=lambda item: item["case_id"])
    expected_records = len(rows) * len(FIELDS)
    if len(records) != expected_records:
        raise BenchmarkHarnessError(
            f"Projected {len(records)} records, expected {expected_records}."
        )
    pipeline_metrics = pipeline_metrics or {}
    return {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "benchmark_version": BENCHMARK_VERSION,
        "truth_version": TRUTH_VERSION,
        "run_id": run_id,
        "sealed": True,
        "sealed_at": utc_now_iso(),
        "records": records,
        "discovery": {
            "programme_keys": sorted(set(programme_keys)),
            "required_source_keys": sorted(set(required_source_keys)),
            "programme_discovered_count": len(set(programme_keys)),
            "required_source_discovered_count": len(set(required_source_keys)),
            "roster_rows": len(rows),
            "discovery_basis": "manual_frozen_roster_candidates; fetch outcomes remain in runtime states and pipeline artifacts",
        },
        "execution": {
            "pipeline_run_dir": "pipeline-run",
            "pipeline_manifest": pipeline_manifest,
            "pipeline_metrics": pipeline_metrics,
            "programme_rows_discovered": [int(row["row"]) for row in discovered_rows],
            "source_register_codes_used": sorted({code for row in rows for code in row["source_codes"]}),
        },
        "isolation": {
            "truth_records_loaded_by_pipeline": False,
            "review_decisions_loaded_by_pipeline": False,
            "expected_values_loaded_by_pipeline": False,
            "scorer_invoked_before_seal": False,
        },
        "projection_trace": [
            {
                "case_id": record["case_id"],
                "programme_id": record.get("runtime_programme_id"),
                "field": record["field"],
                "assertion_id": (record.get("assertion_refs") or [None])[0],
                "assertion_state": (record.get("quality") or {}).get("verification"),
                "assertion_value_present": bool(record.get("value") is not None),
                "raw_ref": (record.get("raw_refs") or [None])[0],
                "coverage_state": record.get("state"),
                "quality_policy_decision": (
                    "BLOCK_PRODUCT_ONLY" if record.get("value") is not None else "UNRESOLVED"
                ),
                "blockers": record.get("blockers", []),
                "promotion_candidate": (record.get("quality") or {}).get("canonical_promotion"),
                "projection_state": record.get("state"),
                "projection_value_present": record.get("value") is not None,
                **(record.get("lifecycle") or {}),
            }
            for record in records
        ],
    }


def _input_digests() -> dict[str, str]:
    paths = {
        "truth": TRUTH_PATH,
        "roster": ROSTER_PATH,
        "contract_markdown": CONTRACT_MARKDOWN_PATH,
        "machine_contract": CONTRACT_PATH,
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise BenchmarkHarnessError("Missing frozen input(s): " + ", ".join(missing))
    return {name: sha256_file(path) for name, path in paths.items()}


def _select_diagnostic_rows(
    rows: list[dict[str, Any]],
    row_numbers: str | None,
) -> list[dict[str, Any]]:
    """Select at most twelve roster rows for a non-official remediation smoke."""

    if not row_numbers:
        return rows
    try:
        requested = [int(item.strip()) for item in row_numbers.split(",") if item.strip()]
    except ValueError as exc:
        raise BenchmarkHarnessError("--rows must be comma-separated roster row numbers.") from exc
    if not requested or len(requested) > 12 or len(set(requested)) != len(requested):
        raise BenchmarkHarnessError("Diagnostic --rows requires 1-12 unique roster rows.")
    by_number = {int(row["row"]): row for row in rows}
    missing = [number for number in requested if number not in by_number]
    if missing:
        raise BenchmarkHarnessError(
            "Diagnostic --rows contains unknown roster row(s): "
            + ", ".join(str(item) for item in missing)
        )
    return [by_number[number] for number in requested]


def _verify_manifest_digests(digests: dict[str, str]) -> None:
    manifest = json.loads(FREEZE_MANIFEST_PATH.read_text(encoding="utf-8"))
    checksums = manifest.get("checksums") if isinstance(manifest, dict) else {}
    checksums = checksums if isinstance(checksums, dict) else {}
    expected = {
        "truth": manifest.get("truth_sha256") or checksums.get("truth"),
        "roster": manifest.get("roster_sha256") or checksums.get("roster"),
        "contract_markdown": manifest.get("scorer_contract_sha256") or checksums.get("scorer_contract"),
        "machine_contract": manifest.get("scorer_contract_machine_sha256") or checksums.get("scorer_contract_machine"),
    }
    mismatches = [
        f"{name}: expected {expected[name]}, got {digests[name]}"
        for name in digests
        if expected.get(name) != digests[name]
    ]
    if mismatches:
        raise BenchmarkHarnessError("BENCHMARK INTEGRITY FAILURE: " + "; ".join(mismatches))


def _runtime_metadata(config: SmokeConfig) -> dict[str, Any]:
    provider = os.environ.get("EXTRACTION_PROVIDER", "").strip().lower()
    if not provider and os.environ.get("DEEPSEEK_API_KEY", "").strip():
        provider = "deepseek"
    if not provider:
        provider = "unconfigured"
    return {
        "python": sys.version.split()[0],
        "node": node_version(),
        "node_24_verification": "DEFERRED / UNVERIFIED by user decision",
        "extraction_provider": provider,
        "extraction_model_label": os.environ.get("EXTRACTION_MODEL") or config.deepseek_flash_model,
        "acquisition_backend": config.acquisition_backend,
        "raw_evidence_mode": config.raw_evidence_mode,
        "discovery_backend": "native",
        "render_policy": "off",
        "programme_concurrency_per_institution": config.limits.programme_concurrency_per_institution,
        "max_deep_programmes_per_institution": config.limits.max_deep_programmes_per_institution,
        "max_deep_sources_per_programme": config.limits.max_deep_sources_per_programme,
        "allow_unreviewed_terms": True,
        "discovery_only": False,
        "skip_school_profile": False,
    }


def execute(args: argparse.Namespace) -> Path:
    # Use the repository's existing local-only secret loader.  It never logs
    # values and does not overwrite explicitly supplied process variables.
    load_dotenv_if_present(REPO_ROOT / ".env.local")
    rows, source_register = _parse_roster(ROSTER_PATH)
    selected_rows = getattr(args, "rows", None)
    diagnostic_rows = bool(selected_rows)
    if args.field_directed_recovery and not diagnostic_rows:
        raise BenchmarkHarnessError(
            "--field-directed-recovery is diagnostic-only and requires --rows."
        )
    rows = _select_diagnostic_rows(rows, selected_rows)
    digests = _input_digests()
    _verify_manifest_digests(digests)
    config = build_execution_config(
        rows,
        source_register,
        field_directed_recovery=args.field_directed_recovery,
    )
    run_id = args.run_id or utc_run_id()
    run_root = (args.output_root / run_id).resolve()
    if run_root.exists() and any(run_root.iterdir()):
        raise BenchmarkHarnessError(f"Run directory already contains files: {run_root}")
    run_root.mkdir(parents=True, exist_ok=True)
    pipeline_dir = run_root / "pipeline-run"
    started_at = utc_now_iso()
    run_metadata = {
        "run_id": run_id,
        "benchmark_version": BENCHMARK_VERSION,
        "truth_version": TRUTH_VERSION,
        "started_at": started_at,
        "finished_at": None,
        "status": "RUNNING",
        "code_revision": git_value("rev-parse", "HEAD"),
        "dirty_worktree": dirty_worktree(),
        "runtime": _runtime_metadata(config),
        "roster_version": "phase-3f-roster-v2",
        "programme_count": len(rows),
        "diagnostic_only": diagnostic_rows,
        "input_digests": digests,
        "pipeline_truth_access": False,
        "pipeline_input": (
            "frozen roster and source register only; generic catalogue/link "
            "recovery enabled"
            if args.field_directed_recovery
            else "frozen roster and source register only"
        ),
        "pipeline_output_path": "pipeline-output.json",
        "scorer_invoked": False,
    }
    _json_write(run_root / "run-manifest.json", run_metadata)

    # This is the only pipeline invocation.  No truth path, truth records,
    # review packet, scorer contract, or expected value is supplied here.
    pipeline = SmokePipeline(
        config,
        pipeline_dir,
        allow_unreviewed_terms=True,
        discovery_only=False,
        show_progress=not args.quiet,
        discovery_backend="native",
        render_policy="off",
        target_fields=None,
        skip_school_profile=False,
    )
    try:
        metrics = pipeline.run()
    except Exception as exc:  # noqa: BLE001 - preserve invalid-run diagnostics
        run_metadata.update(
            {
                "finished_at": utc_now_iso(),
                "status": "BLOCKED_INFRASTRUCTURE",
                "error": str(exc)[:2000],
            }
        )
        _json_write(run_root / "run-manifest.json", run_metadata)
        raise

    output = _project_output(
        run_id=run_id,
        pipeline_dir=pipeline_dir,
        rows=rows,
        source_register=source_register,
        raw_evidence_mode=config.raw_evidence_mode,
    )
    output_path = run_root / "pipeline-output.json"
    _json_write(output_path, output)
    output_digest = sha256_file(output_path)
    finished_at = utc_now_iso()
    terminal_programmes = len(
        {
            str(record.get("runtime_programme_id"))
            for record in output["records"]
            if record.get("runtime_programme_id")
        }
    )
    run_metadata.update(
        {
            "finished_at": finished_at,
            "status": "SEALED",
            "pipeline_metrics": metrics,
            "pipeline_output_sha256": output_digest,
            "terminal_programme_counts": {
                "attempted": len(rows),
                "terminal": len(rows),
                "pipeline_programme_records": terminal_programmes,
                "failed_or_partial": len(rows) - terminal_programmes,
            },
            "sealed_artifacts": {
                "pipeline_output": {
                    "path": "pipeline-output.json",
                    "sha256": output_digest,
                }
            },
            "scorer_invoked": False,
        }
    )
    _json_write(run_root / "run-manifest.json", run_metadata)
    print(
        json.dumps(
            {
                "status": "SEALED",
                "run_id": run_id,
                "run_dir": str(run_root),
                "pipeline_output": str(output_path),
                "pipeline_output_sha256": output_digest,
                "programme_rows": len(rows),
                "programme_records": terminal_programmes,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return run_root


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default=None)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=REPO_ROOT / "docs/benchmarks/runs",
    )
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--rows",
        default=None,
        help="Diagnostic-only comma-separated roster rows (maximum 12); never an official run.",
    )
    parser.add_argument(
        "--field-directed-recovery",
        action="store_true",
        help="Diagnostic-only generic catalogue/link recovery; requires --rows.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    try:
        execute(_parser().parse_args(argv))
    except (BenchmarkHarnessError, OSError, ValueError, RuntimeError) as exc:
        print(json.dumps({"status": "FAILED", "error": str(exc)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
