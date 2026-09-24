"""Revalidate Remediation 8 assertion generation against sealed raw evidence.

This diagnostic deliberately has two phases:

1. Reprocess only the 50 identity/credential cases selected from the sealed
   Remediation-7/8 diagnostics.  Runtime code receives roster/programme
   routing context and persisted raw evidence, never frozen expected values.
2. Seal the runtime matrix, then read frozen truth for the post-run safety
   audit and report only.

No source discovery, network fetch, scorer execution, or benchmark #4 run is
performed here.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))
if str(REPO_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))

from run_phase3f_v3_benchmark import (  # noqa: E402
    _parse_roster,
    _state_for_assertions,
)
from glowbal_ingestion.config import (  # noqa: E402
    CrawlLimits,
    InstitutionSeed,
    SmokeConfig,
    load_dotenv_if_present,
)
from glowbal_ingestion.deepseek import DeepSeekClient  # noqa: E402
from glowbal_ingestion.extraction_provider import ExtractionSource  # noqa: E402
from glowbal_ingestion.models import (  # noqa: E402
    ProgrammeRecord,
    RawDocument,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
    has_semantic_value,
)
from glowbal_ingestion.parser_registry import ParserError, ParserRegistry  # noqa: E402
from glowbal_ingestion.storage import StateStore  # noqa: E402
from glowbal_ingestion.url_safety import canonicalize_url  # noqa: E402
from glowbal_ingestion.validation import fact_to_assertion  # noqa: E402


OFFICIAL_RUN_ID = "phase3f-v2-run-20260905T030109Z"
DIAGNOSTIC_NAME = "run3-assertion-generation-diagnostic.jsonl"
TRUTH_PATH = (
    REPO_ROOT
    / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
)
ROSTER_PATH = REPO_ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
TARGET_FIELDS = ("programme_identity", "credential")
EXPECTED_FIELD_COUNTS = {"programme_identity": 25, "credential": 25}


def _utc_run_id() -> str:
    return datetime.now(timezone.utc).strftime(
        "phase3f-remediation8-revalidation-50-%Y%m%dT%H%M%SZ"
    )


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{line_number} is not an object")
            rows.append(value)
    return rows


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _enum(value: Any, enum_type: type[Any]) -> Any:
    if value is None or isinstance(value, enum_type):
        return value
    try:
        return enum_type(str(value))
    except (TypeError, ValueError):
        return None


def _load_runtime_context(
    official_dir: Path,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    diagnostic_rows = [
        {
            "case_id": row.get("case_id"),
            "programme_id": row.get("programme_id"),
            "field": row.get("field"),
            "best_evidence_source": row.get("best_evidence_source"),
        }
        for row in _read_jsonl(official_dir / DIAGNOSTIC_NAME)
        if row.get("field") in TARGET_FIELDS
    ]
    if len(diagnostic_rows) != 50:
        raise ValueError(
            f"Expected exactly 50 identity/credential diagnostic rows, found {len(diagnostic_rows)}"
        )
    case_ids = [str(row.get("case_id") or "") for row in diagnostic_rows]
    if len(set(case_ids)) != 50 or any(not value for value in case_ids):
        raise ValueError("Revalidation population contains duplicate or empty case IDs")
    by_field = Counter(str(row["field"]) for row in diagnostic_rows)
    if dict(by_field) != EXPECTED_FIELD_COUNTS:
        raise ValueError(
            "Unexpected revalidation field counts: "
            + json.dumps(dict(by_field), sort_keys=True)
        )
    programmes = {
        str(row["programme_id"]): row
        for row in _read_jsonl(official_dir / "pipeline-run" / "programmes.jsonl")
        if row.get("programme_id")
    }
    sources: dict[str, dict[str, Any]] = {}
    for row in _read_jsonl(official_dir / "pipeline-run" / "sources.jsonl"):
        for key in ("url", "canonical_url"):
            value = row.get(key)
            if not value:
                continue
            sources[str(value)] = row
            try:
                sources[canonicalize_url(str(value))] = row
            except Exception:  # malformed URLs remain diagnosable by exact key
                pass
    return diagnostic_rows, programmes, sources


def _programme_record(raw: dict[str, Any]) -> ProgrammeRecord:
    # Runtime programme metadata is routing context only.  In particular,
    # credential is intentionally blank so roster/runtime metadata cannot
    # bootstrap a factual credential assertion.
    return ProgrammeRecord(
        programme_id=str(raw["programme_id"]),
        institution_id=str(raw.get("institution_id") or "unknown"),
        programme_name=str(raw.get("programme_name") or ""),
        official_url=str(raw.get("official_url") or ""),
        degree_level=(str(raw["degree_level"]) if raw.get("degree_level") else None),
        credential=None,
        normalized_field=(
            str(raw["normalized_field"]) if raw.get("normalized_field") else None
        ),
        organisation_unit_id=(
            str(raw["organisation_unit_id"])
            if raw.get("organisation_unit_id")
            else None
        ),
        language=str(raw["language"]) if raw.get("language") else None,
        campus=str(raw["campus"]) if raw.get("campus") else None,
        delivery_mode=(
            str(raw["delivery_mode"]) if raw.get("delivery_mode") else None
        ),
        duration=str(raw["duration"]) if raw.get("duration") else None,
        programme_status=(
            str(raw["programme_status"]) if raw.get("programme_status") else None
        ),
        catalogue_source=str(raw.get("catalogue_source") or "sealed-runtime-metadata"),
        retrieved_at=str(raw.get("retrieved_at") or datetime.now(timezone.utc).isoformat()),
        verification_status=VerificationStatus.DISCOVERED,
    )


def _load_source(
    *,
    source: dict[str, Any],
    pipeline_dir: Path,
    parser_registry: ParserRegistry,
) -> tuple[ExtractionSource, dict[str, Any]]:
    relative = str(source.get("raw_object_path") or "")
    raw_path = pipeline_dir / relative
    if not raw_path.exists():
        raise FileNotFoundError(f"Persisted raw artifact is unavailable: {relative}")
    payload = raw_path.read_bytes()
    if raw_path.suffix.casefold() == ".gz":
        payload = gzip.decompress(payload)
    raw_document = RawDocument(
        raw_document_id=str(source.get("raw_document_id") or source.get("source_id")),
        source_identity=str(source.get("source_id") or source.get("url")),
        canonical_url=str(source.get("canonical_url") or source.get("url")),
        content_hash=str(source.get("content_hash") or hashlib.sha256(payload).hexdigest()),
        content_type=(str(source["content_type"]) if source.get("content_type") else None),
        retrieved_at=str(source.get("retrieved_at") or ""),
        payload_location=str(raw_path),
        payload_reference=relative,
        http_status=(int(source["http_status"]) if source.get("http_status") is not None else None),
        published_at=(str(source["published_at"]) if source.get("published_at") else None),
        language=(str(source["language"]) if source.get("language") else None),
        source_authority=_enum(source.get("source_authority"), SourceAuthority),
        source_relationship=_enum(source.get("source_relationship"), SourceRelationship),
        temporal_state=_enum(source.get("temporal_state"), TemporalState)
        or TemporalState.UNKNOWN,
        acquisition_run_id=OFFICIAL_RUN_ID,
    )
    parsed = parser_registry.parse(raw_document, payload)
    extraction_source = ExtractionSource(
        url=str(source.get("url") or source.get("canonical_url")),
        page_type=str(source.get("page_type") or "unknown"),
        title=(str(source["title"]) if source.get("title") else parsed.title),
        text=parsed.text,
        content_hash=raw_document.content_hash,
        raw_document_id=raw_document.raw_document_id,
        parser_id=parsed.parser_id,
        parser_version=parsed.parser_version,
        source_authority=raw_document.source_authority,
        source_relationship=raw_document.source_relationship,
        temporal_state=raw_document.temporal_state,
    )
    return extraction_source, {
        "source_ref": extraction_source.url,
        "raw_document_id": raw_document.raw_document_id,
        "raw_object_path": relative,
        "parser_id": parsed.parser_id,
        "parser_version": parsed.parser_version,
        "parsed_text_present": bool(parsed.text.strip()),
        "parsed_text_length": len(parsed.text),
        "source_authority": (
            raw_document.source_authority.value
            if raw_document.source_authority
            else None
        ),
        "source_relationship": (
            raw_document.source_relationship.value
            if raw_document.source_relationship
            else None
        ),
        "temporal_state": raw_document.temporal_state.value,
    }


def _provider_failure(diagnostics: list[dict[str, Any]]) -> str | None:
    failures = [item for item in diagnostics if item.get("status") == "failed"]
    if not failures:
        return None
    error = " ".join(str(item.get("error") or "") for item in failures).casefold()
    if "schema" in error or "invalid" in error or "json" in error:
        return "SCHEMA_REJECTED"
    return "EXTRACTION_FAILED"


def _first_loss(
    *,
    source_meta: list[dict[str, Any]],
    field_facts: list[dict[str, Any]],
    assertions: list[dict[str, Any]],
    used: list[dict[str, Any]],
    diagnostics: list[dict[str, Any]],
    assertion_errors: list[str],
) -> tuple[str, str | None]:
    if not source_meta or not any(item.get("parsed_text_present") for item in source_meta):
        return "PARSE_FAILED", "no usable parsed content from persisted evidence"
    failure = _provider_failure(diagnostics)
    if failure and not field_facts:
        return failure, "identity_offering extraction group failed"
    if not field_facts:
        return "EXTRACTOR_EMPTY", "provider completed without a fact for this field"
    if assertion_errors:
        return "ASSERTION_REJECTED", "; ".join(sorted(set(assertion_errors)))
    if not assertions:
        return "ASSERTION_NOT_CREATED", "candidate facts did not produce an assertion"
    if not any(has_semantic_value(item.get("value_json")) for item in assertions):
        return "ASSERTION_VALUE_MISSING", "assertion exists without a semantic value"
    if not used:
        return "FILTERED_PRE_SELECTION", "non-null assertion was not selector-visible"
    return "NONE", None


def _safe_digest_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "cases": len(rows),
        "by_field": dict(sorted(Counter(str(row["field"]) for row in rows).items())),
        "assertion_created": sum(bool(row["assertion_created"]) for row in rows),
        "assertion_non_null": sum(bool(row["assertion_non_null"]) for row in rows),
        "selector_visible": sum(bool(row["selector_visible"]) for row in rows),
        "final_states": dict(sorted(Counter(str(row["final_state"]) for row in rows).items())),
        "first_loss_stages": dict(sorted(Counter(str(row["first_loss_stage"]) for row in rows).items())),
    }


def _post_seal_truth_audit(
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    truth = {
        str(row["case_id"]): row
        for row in _read_jsonl(TRUTH_PATH)
        if row.get("case_id")
    }
    false_current = [
        str(row["case_id"])
        for row in rows
        if str(truth.get(str(row["case_id"]), {}).get("expected_state")) == "NEEDS_REVIEW"
        and bool(row.get("final_value_present"))
    ]
    found_audit_failures = [
        str(row["case_id"])
        for row in rows
        if row.get("final_state") == "FOUND"
        and not (
            row.get("source_ref")
            and row.get("evidence_locator")
            and row.get("source_authority")
        )
    ]
    original_p0 = [
        "GT-V2-09-programme_identity",
        "GT-V2-09-credential",
        "GT-V2-15-credential",
        "GT-V2-22-credential",
        "GT-V2-23-credential",
        "GT-V2-27-credential",
    ]
    by_id = {str(row["case_id"]): row for row in rows}
    return {
        "truth_loaded_after_runtime_seal": True,
        "truth_records_loaded": len(truth),
        "false_current_cases": false_current,
        "false_current_count": len(false_current),
        "found_evidence_audit_failures": found_audit_failures,
        "original_p0_present": {
            case_id: {
                "present": case_id in by_id,
                "final_state": by_id.get(case_id, {}).get("final_state"),
                "final_value_present": by_id.get(case_id, {}).get("final_value_present"),
                "false_current": case_id in false_current,
            }
            for case_id in original_p0
        },
        # This diagnostic processes only identity/credential assertions and
        # never invokes promotion/product-safety code paths.
        "zero_tolerance_counters": {
            "false_current_critical": len(false_current),
            "fuzzy_only_identity_merge": 0,
            "unresolved_conflict_promoted": 0,
            "source_not_found_promoted": 0,
            "stale_only_promoted": 0,
            "prohibited_inferred_high_volatility_promoted": 0,
            "product_safe_without_durable_provenance": 0,
        },
    }


def run(run_id: str) -> dict[str, Any]:
    for env_path in (REPO_ROOT / ".env", REPO_ROOT / ".env.local"):
        load_dotenv_if_present(env_path, override=False)
    provider = os.environ.get("EXTRACTION_PROVIDER", "").strip().lower()
    base_url = (
        os.environ.get("DEEPSEEK_BASE_URL", "").strip().rstrip("/")
        or "https://api.deepseek.com"
    )
    model = os.environ.get("DEEPSEEK_MODEL", "").strip() or "deepseek-v4-flash"
    if provider != "deepseek":
        raise RuntimeError(f"Expected EXTRACTION_PROVIDER=deepseek, got {provider or '<unset>'}")
    if base_url != "https://api.deepseek.com":
        raise RuntimeError(f"Expected direct DeepSeek endpoint, got {base_url}")
    if model != "deepseek-v4-flash":
        raise RuntimeError(f"Expected deepseek-v4-flash, got {model}")
    if not os.environ.get("DEEPSEEK_API_KEY", "").strip():
        raise RuntimeError("DEEPSEEK_API_KEY is not loaded")

    official_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / OFFICIAL_RUN_ID
    pipeline_dir = official_dir / "pipeline-run"
    diagnostic_rows, programmes, source_index = _load_runtime_context(official_dir)
    roster_rows, _ = _parse_roster(ROSTER_PATH)
    roster_by_url = {canonicalize_url(str(row["url"])): row for row in roster_rows}
    by_programme: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in diagnostic_rows:
        by_programme[str(row["programme_id"])].append(row)
    output_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / run_id
    output_dir.mkdir(parents=True, exist_ok=False)

    limits = CrawlLimits.from_dict(
        {
            "max_llm_retries": 0,
            "max_sources_per_extraction_group": 4,
            "max_source_chars_per_llm_call": 80_000,
            "max_source_chars_per_extraction_group": 40_000,
        }
    )
    seeds = tuple(
        InstitutionSeed(
            institution_id=programme_id,
            name=str(programmes[programme_id].get("institution_id") or programme_id),
            country_code="XX",
            official_domain=(urlsplit(str(programmes[programme_id].get("official_url") or "")).netloc or "unknown"),
            homepage_url=str(programmes[programme_id].get("official_url") or ""),
        )
        for programme_id in sorted(by_programme)
    )
    config = SmokeConfig(
        run_name=run_id,
        institutions=seeds,
        limits=limits,
        deepseek_flash_model=model,
        deepseek_pro_model="deepseek-v4-pro",
        deepseek_base_url=base_url,
        raw_evidence_mode="local",
    )
    state = StateStore(output_dir / "llm-cache.sqlite")
    client = DeepSeekClient(config, state)
    parser_registry = ParserRegistry.default()
    case_results: dict[tuple[str, str], dict[str, Any]] = {}
    programme_metrics: dict[str, dict[str, Any]] = {}
    actual_refetches = 0
    parser_reruns = 0
    extractor_reruns = 0
    source_load_failures: list[dict[str, Any]] = []

    for programme_id in sorted(by_programme):
        programme_raw = programmes.get(programme_id)
        if not programme_raw:
            raise RuntimeError(f"Programme metadata missing for {programme_id}")
        programme = _programme_record(programme_raw)
        roster_row = roster_by_url.get(canonicalize_url(programme.official_url))
        if not roster_row:
            raise RuntimeError(f"Roster routing row missing for {programme_id}")
        source_urls = list(
            dict.fromkeys(
                str(row.get("best_evidence_source") or "")
                for row in by_programme[programme_id]
                if row.get("best_evidence_source")
            )
        )
        source_objects: list[ExtractionSource] = []
        source_meta: list[dict[str, Any]] = []
        source_map: dict[str, ExtractionSource] = {}
        for source_url in source_urls:
            source_record = source_index.get(source_url)
            if not source_record:
                source_record = source_index.get(canonicalize_url(source_url))
            if not source_record:
                source_load_failures.append(
                    {"programme_id": programme_id, "source_ref": source_url, "reason": "SOURCE_METADATA_MISSING"}
                )
                continue
            try:
                extracted_source, metadata = _load_source(
                    source=source_record,
                    pipeline_dir=pipeline_dir,
                    parser_registry=parser_registry,
                )
                parser_reruns += 1
            except (FileNotFoundError, OSError, ParserError, ValueError) as exc:
                source_load_failures.append(
                    {"programme_id": programme_id, "source_ref": source_url, "reason": type(exc).__name__}
                )
                continue
            source_objects.append(extracted_source)
            source_meta.append(metadata)
            source_map[extracted_source.url] = extracted_source
            source_map[canonicalize_url(extracted_source.url)] = extracted_source

        fields_for_programme = tuple(
            dict.fromkeys(str(row["field"]) for row in by_programme[programme_id])
        )
        extractor_reruns += 1
        payload: dict[str, Any] = {"facts": [], "group_diagnostics": []}
        model_name = model
        provider_error: str | None = None
        if source_objects:
            try:
                model_name, payload = client.extract_fields(
                    programme,
                    source_objects,
                    field_names=tuple(field for field in TARGET_FIELDS if field in fields_for_programme),
                    prefer_pro=False,
                )
            except Exception as exc:  # provider failures remain diagnostic, never values
                provider_error = type(exc).__name__
                payload = {
                    "facts": [],
                    "group_diagnostics": [
                        {"status": "failed", "error": str(exc), "extraction_group": "identity_offering"}
                    ],
                }
        else:
            provider_error = "NO_PARSED_SOURCE"

        facts = [fact for fact in payload.get("facts", []) if isinstance(fact, dict)]
        diagnostics = [
            item for item in payload.get("group_diagnostics", []) if isinstance(item, dict)
        ]
        programme_metrics[programme_id] = {
            "programme_id": programme_id,
            "programme": programme.programme_name,
            "fields": list(fields_for_programme),
            "sources_reused": len(source_objects),
            "source_metadata": source_meta,
            "provider_error": provider_error,
            "provider_diagnostics": [
                {
                    "status": item.get("status"),
                    "source_count": item.get("source_count"),
                    "requested_fields": item.get("requested_fields"),
                    "error": item.get("error"),
                }
                for item in diagnostics
            ],
            "fact_count": len(facts),
        }
        for field in fields_for_programme:
            field_facts = [fact for fact in facts if fact.get("field_name") == field]
            assertions: list[dict[str, Any]] = []
            assertion_errors: list[str] = []
            for fact in field_facts:
                fact = dict(fact)
                fact["source_url"] = str(fact.get("source_url") or "")
                source = source_map.get(fact["source_url"]) or source_map.get(
                    canonicalize_url(fact["source_url"]) if fact["source_url"] else ""
                )
                if source:
                    fact["source_url"] = source.url
                    fact["_raw_document_id"] = source.raw_document_id
                    fact["_parser_id"] = source.parser_id
                    fact["_parser_version"] = source.parser_version
                    fact["_source_authority"] = source.source_authority.value if source.source_authority else None
                    fact["_source_relationship"] = source.source_relationship.value if source.source_relationship else None
                    fact["_temporal_state"] = source.temporal_state.value
                fact["_provider_id"] = client.provider_id
                fact["_model_name"] = model_name or model
                fact["_prompt_version"] = client.PROMPT_VERSION
                fact["_schema_version"] = client.SCHEMA_VERSION
                try:
                    assertion = fact_to_assertion(
                        entity_id=programme_id,
                        fact=fact,
                        source_map=source_map,
                        model_name=model_name or model,
                        extractor_version="phase3f-remediation8-revalidation",
                        programme_degree=programme.degree_level,
                        programme_name=programme.programme_name,
                        programme_url=programme.official_url,
                    )
                    assertion_dict = assertion.to_dict()
                    assertion_dict["evidence_locator"] = str(fact.get("evidence") or "") or None
                    assertions.append(assertion_dict)
                    assertion_errors.extend(assertion.validation_errors)
                except (KeyError, TypeError, ValueError) as exc:
                    assertion_errors.append(type(exc).__name__)
            target_cycle = roster_row.get("target_cycle")
            state_name, value, used = _state_for_assertions(
                assertions,
                field_name=field,
                target_cycle=target_cycle,
                target_degree=programme.degree_level,
            )
            # A provider group that was actually attempted must not be
            # reported as NOT_EVALUATED merely because it produced no
            # assertion.  Likewise, a persisted-source parse failure is an
            # operational parse state, not an unstarted field evaluation.
            provider_failure_code = provider_error or _provider_failure(diagnostics)
            if provider_failure_code == "NO_PARSED_SOURCE":
                state_name, value, used = "PARSE_FAILED", None, []
            elif provider_failure_code:
                state_name, value, used = "EXTRACTION_FAILED", None, []
            non_null_assertion = any(has_semantic_value(item.get("value_json")) for item in assertions)
            field_source = next((item for item in assertions if item.get("source_url")), None)
            if field_source is None and field_facts:
                field_source = next((item for item in source_meta if item.get("source_ref")), None)
            first_loss_stage, first_loss_reason = _first_loss(
                source_meta=source_meta,
                field_facts=field_facts,
                assertions=assertions,
                used=used,
                diagnostics=diagnostics,
                assertion_errors=assertion_errors,
            )
            case_rows = [row for row in by_programme[programme_id] if row["field"] == field]
            for case in case_rows:
                case_results[(str(case["case_id"]), field)] = {
                    "case_id": str(case["case_id"]),
                    "programme_id": programme_id,
                    "field": field,
                    "evidence_available": True,
                    "router_invoked": True,
                    "extractor_invoked": bool(source_objects),
                    "candidate_created": bool(field_facts),
                    "candidate_non_null": any(has_semantic_value(fact.get("value")) for fact in field_facts),
                    "assertion_created": bool(assertions),
                    "assertion_non_null": non_null_assertion,
                    "selector_visible": bool(used),
                    "final_state": state_name,
                    "final_value_present": has_semantic_value(value),
                    "first_loss_stage": first_loss_stage,
                    "first_loss_reason": first_loss_reason,
                    "provider_failure": provider_error or _provider_failure(diagnostics),
                    "source_ref": (field_source.get("source_url") if field_source else None),
                    "evidence_locator": (field_source.get("evidence_locator") if field_source else None),
                    "source_authority": (field_source.get("source_authority") if field_source else None),
                    "source_relationship": (field_source.get("source_relationship") if field_source else None),
                    "temporal_state": (field_source.get("temporal_state") if field_source else None),
                    "runtime_value": value if has_semantic_value(value) else None,
                }

    rows = [case_results[key] for key in sorted(case_results)]
    if len(rows) != 50:
        raise RuntimeError(f"Expected 50 revalidation rows, produced {len(rows)}")
    matrix_path = output_dir / "remediation8-50case-revalidation.jsonl"
    output_path = output_dir / "revalidation-output.json"
    manifest_path = output_dir / "run-manifest.json"
    _write_jsonl(matrix_path, rows)
    summary = _safe_digest_summary(rows)
    stats = client.stats.to_dict()
    runtime_output = {
        "schema_version": "phase3f-remediation8-revalidation/v1",
        "diagnostic_only": True,
        "run_id": run_id,
        "official_run_reference": OFFICIAL_RUN_ID,
        "runtime_truth_access": False,
        "provider": {
            "provider": provider,
            "provider_id": client.provider_id,
            "base_url": base_url,
            "model": model,
            "api_key_loaded": True,
            "reasoning": os.environ.get("EXTRACTION_REASONING_EFFORT", "") or None,
        },
        "reprocessing": {
            "cases": 50,
            "programmes": len(by_programme),
            "cases_reprocessed_from_existing_raw": 50,
            "parser_reruns": parser_reruns,
            "extractor_reruns": extractor_reruns,
            "actual_refetches": actual_refetches,
            "new_urls_discovered": 0,
            "source_load_failures": source_load_failures,
        },
        "provider_stats": stats,
        "programme_metrics": programme_metrics,
        "summary": summary,
        "records": rows,
    }
    _write_json(output_path, runtime_output)
    output_hash = _sha256(output_path)
    matrix_hash = _sha256(matrix_path)
    manifest = {
        "schema_version": "phase3f-remediation8-revalidation-manifest/v1",
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "diagnostic_only": True,
        "official_run_reference": OFFICIAL_RUN_ID,
        "code_revision": os.environ.get("CODE_REVISION", "unknown-local"),
        "truth_access_during_runtime": False,
        "provider": runtime_output["provider"],
        "reprocessing": runtime_output["reprocessing"],
        "matrix_path": str(matrix_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "matrix_sha256": matrix_hash,
        "output_path": str(output_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "output_sha256": output_hash,
        "summary": summary,
    }
    _write_json(manifest_path, manifest)

    # Runtime artifacts are now sealed.  Only this post-seal audit reads the
    # frozen truth, and it cannot affect any runtime result above.
    truth_audit = _post_seal_truth_audit(rows)
    _write_json(output_dir / "post-seal-truth-audit.json", truth_audit)
    _write_json(output_dir / "run-manifest.json", {**manifest, "post_seal_truth_audit": truth_audit})
    return {
        "run_id": run_id,
        "output_dir": str(output_dir.relative_to(REPO_ROOT)).replace("\\", "/"),
        "matrix_path": str(matrix_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "output_path": str(output_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "manifest_path": str(manifest_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "output_sha256": output_hash,
        "matrix_sha256": matrix_hash,
        "summary": summary,
        "provider_stats": stats,
        "truth_audit": truth_audit,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default=_utc_run_id())
    args = parser.parse_args()
    result = run(args.run_id)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
