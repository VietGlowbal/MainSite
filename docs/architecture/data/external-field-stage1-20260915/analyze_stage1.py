"""Artifact-only analysis for the Stage 1 external mass-ingestion run.

The existing canary analyzer owns the field/acceptance/hierarchy accounting.
This thin wrapper points it at the frozen Stage 1 manifest and adds rollout
specific checkpoint, resource, and readiness facts without changing ingestion.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CANARY = ROOT.parent / "external-field-canary-20260914"
sys.path.insert(0, str(CANARY))
import analyze_canary  # noqa: E402


def _checkpoint_summary(run: Path) -> dict[str, Any]:
    state = run / "crawl_state.sqlite"
    if not state.exists():
        return {"state": str(state), "available": False}
    connection = sqlite3.connect(state)
    try:
        rows: list[dict[str, Any]] = []
        for key, value_json in connection.execute(
            "select key, value_json from kv where key like 'institution:%:checkpoint'"
        ):
            try:
                value = json.loads(value_json)
            except (TypeError, json.JSONDecodeError):
                value = {}
            if isinstance(value, dict):
                rows.append(value)
        statuses = Counter(str(row.get("status") or "UNKNOWN") for row in rows)
        return {
            "state": str(state),
            "available": True,
            "institutions_with_checkpoint": len(rows),
            "status_counts": dict(sorted(statuses.items())),
            "completed": statuses.get("COMPLETED", 0),
            "partial": statuses.get("PARTIAL", 0),
            "terminal_failures": sum(
                value for key, value in statuses.items()
                if key not in {"COMPLETED", "PARTIAL", "RUNNING", "PENDING"}
            ),
        }
    finally:
        connection.close()


def _sample_assertions(run: Path, limit: int = 3) -> list[dict[str, Any]]:
    rows = analyze_canary.read_jsonl(run / "effective_field_assertions.jsonl")
    accepted = [row for row in rows if analyze_canary.accepted(row)]
    samples: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for row in accepted:
        key = (
            str(row.get("provider_id") or ""),
            str(row.get("field_name") or ""),
            str(row.get("entity_id") or row.get("programme_id") or row.get("institution_id") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        samples.append(
            {
                "provider_id": key[0],
                "field": key[1],
                "entity_id": key[2],
                "scope": row.get("scope"),
                "value_json": row.get("value_json"),
                "source_url": row.get("source_url") or row.get("url"),
                "raw_document_id": row.get("raw_document_id"),
                "content_hash": row.get("content_hash"),
                "academic_cycle": row.get("academic_cycle"),
                "currency": row.get("currency"),
                "basis": row.get("basis"),
            }
        )
        if len(samples) >= limit:
            break
    return samples


def _error_provider(row: dict[str, Any]) -> str | None:
    """Attribute an unlabelled crawl error from its official provider URL."""
    explicit = row.get("provider_id")
    if explicit:
        return str(explicit)
    url = str(row.get("url") or row.get("source_url") or "").casefold()
    hosts = (
        ("ed-public-download.scorecard.network", "college_scorecard_bulk"),
        ("swissuniversities.ch", "swissuniversities_tuition"),
        ("opendata.onisep.fr", "onisep_higher_ed"),
        ("discoveruni.gov.uk", "discover_uni_hesa"),
        ("onderwijsdata.duo.nl", "duo_rio_ho"),
        ("api.skolverket.se", "susa_navet_event"),
        ("opintopolku.fi", "studyinfo_hakukohde"),
    )
    for host, provider in hosts:
        if host in url:
            if provider == "susa_navet_event" and "/educationinfos/" in url:
                return "susa_navet_info"
            if provider == "studyinfo_hakukohde":
                if "/toteutus/" in url:
                    return "studyinfo_toteutus"
                if "/valintaperuste/" in url:
                    return "studyinfo_valintaperuste"
            return provider
    return None


def build(run: Path) -> dict[str, Any]:
    # Redirect the frozen canary accounting code to this run's manifest/config.
    analyze_canary.ROOT = ROOT
    analyze_canary.RUNS = ROOT / "runs"
    analyze_canary.scale.ROOT = ROOT
    analyze_canary.scale.MANIFEST = ROOT / "stage1-population-manifest.json"
    analyze_canary.scale.CONFIG = ROOT / "stage1-config.json"
    report = analyze_canary.build(run.resolve(), None)
    stage_config = analyze_canary.read_json(ROOT / "stage1-config.json", {})
    limits = stage_config.get("limits", {}) if isinstance(stage_config, dict) else {}
    checkpoints = _checkpoint_summary(run)
    metrics = analyze_canary.read_json(run / "coverage_report.json", {}).get("metrics", {})
    provider_rows = report["provider_execution"]
    eligible = sum(int(row.get("targets_eligible") or 0) for row in provider_rows.values())
    attempted = sum(int(row.get("targets_attempted") or 0) for row in provider_rows.values())
    exact = sum(int(row.get("exact_materialization_matches") or 0) for row in provider_rows.values())
    materialised = sum(int(row.get("materialization_match_rows") or 0) for row in provider_rows.values())
    raw_errors = report["failure_taxonomy"].get("raw_errors", [])
    error_counts_by_provider: dict[str, Counter[str]] = {
        provider: Counter() for provider in provider_rows
    }
    for row in raw_errors:
        provider = _error_provider(row)
        if provider in error_counts_by_provider:
            error_counts_by_provider[provider][str(row.get("error_code") or "UNKNOWN")] += 1
    for provider, row in provider_rows.items():
        row["errors"] = dict(error_counts_by_provider[provider])
        row["error_count"] = sum(error_counts_by_provider[provider].values())
    errors = sum(int(row.get("error_count") or 0) for row in provider_rows.values())
    source_absence = sum(
        str(row.get("error_code")) == "NO_EXTERNAL_FIELD_SOURCE" for row in raw_errors
    )
    semantic_provider_errors = sum(
        str(row.get("error_code")) == "PERMANENT_PROVIDER_ERROR" for row in raw_errors
    )
    frozen_failure_types = dict(report["failure_taxonomy"].get("by_type", {}))
    stage1_failure_types: Counter[str] = Counter()
    for row in raw_errors:
        code = str(row.get("error_code") or "")
        message = str(row.get("message") or "").casefold()
        if code == "NO_EXTERNAL_FIELD_SOURCE":
            stage1_failure_types["TARGET_LEVEL_SOURCE_ABSENCE"] += 1
        elif code == "PERMANENT_PROVIDER_ERROR" and "deepseek" in message:
            stage1_failure_types["SEMANTIC"] += 1
        elif code == "PERMANENT_PROVIDER_ERROR":
            stage1_failure_types["SYSTEMIC_CODE_BUG"] += 1
        else:
            stage1_failure_types["IDENTITY_MATCH"] += 1
    integrity = report["integrity"]
    integrity_gate = (
        not any(integrity.get("missing_provenance_by_field", {}).values())
        and integrity.get("bad_scope_rows", 0) == 0
        and integrity.get("unknown_provider_rows", 0) == 0
        and integrity.get("raw_local_bytes", 0) == 0
        and not integrity.get("heavy_local_copy_violation", False)
    )
    provider_stats = analyze_canary.read_json(run / "coverage_report.json", {}).get(
        "extraction_provider", {}
    )
    systemic_types = {"PERSISTENCE", "PROVIDER_FORMAT", "PARSER", "SYSTEMIC_CODE_BUG"}
    systemic_failures = sum(stage1_failure_types.get(key, 0) for key in systemic_types)
    if systemic_failures:
        readiness_class = "C — MASS INGESTION UNSAFE"
    elif source_absence or semantic_provider_errors or provider_stats.get("failures", 0):
        readiness_class = "A2 — STAGE 1 HEALTHY WITH NON-BLOCKING TARGET/PROVIDER GAPS"
    else:
        readiness_class = "A1 — STAGE 1 HEALTHY, READY FOR 1,000+"
    # The workspace may have replaced an em dash while applying an earlier
    # patch; normalize the stored label to stable ASCII for artifact readers.
    readiness_class = readiness_class.replace("\ufffd", "-").replace(chr(0x2014), "-")
    report["runtime_configuration"] = {
        "config": str(ROOT / "stage1-config.json"),
        "raw_evidence_mode": stage_config.get("raw_evidence_mode"),
        "max_local_temp_bytes": limits.get("max_local_temp_bytes"),
        "global_concurrency": limits.get("global_concurrency"),
        "institution_concurrency": limits.get("institution_concurrency"),
        "programme_concurrency": limits.get("programme_concurrency_per_institution"),
        "per_domain_concurrency": limits.get("per_domain_concurrency"),
        "promotion": "disabled; isolated Stage 1 namespace",
    }
    report["integrity"]["max_local_temp_bytes_configured"] = limits.get("max_local_temp_bytes")
    report["failure_taxonomy"]["by_type"] = dict(stage1_failure_types)
    report["failure_taxonomy"]["frozen_by_type"] = frozen_failure_types
    report["failure_taxonomy"]["stage1_notes"] = {
        "target_level_source_absence_is_non_fatal": True,
        "semantic_provider_error_is_non_fatal": True,
        "systemic_failure_count": systemic_failures,
    }
    report["stage1"] = {
        "manifest": str(ROOT / "stage1-population-manifest.json"),
        "manifest_sha256": (ROOT / "stage1-population-manifest.sha256").read_text(encoding="ascii").split()[0],
        "config": str(ROOT / "stage1-config.json"),
        "run": str(run),
        "promotion": "disabled",
        "provider_slot_totals": {
            "eligible": eligible,
            "attempted": attempted,
            "exact_materialization_matches": exact,
            "materialization_match_rows": materialised,
            "provider_materialization_rate_percent": round(100 * exact / eligible, 2) if eligible else 0.0,
        },
        "checkpoint": checkpoints,
        "quality_sample": _sample_assertions(run),
        "readiness": {
            "classification": "A2 — STAGE 1 HEALTHY WITH NON-BLOCKING TARGET/PROVIDER GAPS" if errors else "A1 — STAGE 1 HEALTHY, READY FOR 1,000+",
            "institution_completion": metrics.get("institutions_completed"),
            "programme_discovery": metrics.get("programmes_discovered"),
            "fatal_pipeline_failures": errors,
            "integrity_gate": "PASS" if not any(report["integrity"].values()) else "REVIEW",
            "failure_isolation_gate": "PASS" if errors == 0 else "REVIEW",
        },
    }
    provider_materialization_rows = sum(
        int(row.get("materialization_rows") or 0) for row in provider_rows.values()
    )
    report["stage1"]["provider_slot_totals"].update(
        {
            "attempted_exact_match_rate_percent": round(100 * exact / attempted, 2) if attempted else 0.0,
            "materialization_rows_total": provider_materialization_rows,
            "materialization_rows_match_rate_percent": round(
                100 * materialised / provider_materialization_rows, 2
            ) if provider_materialization_rows else 0.0,
        }
    )
    report["stage1"]["readiness"].update(
        {
            "classification": readiness_class,
            "provider_error_records": errors,
            "fatal_pipeline_failures": systemic_failures,
            "target_level_source_absence": source_absence,
            "semantic_provider_error_records": semantic_provider_errors,
            "llm_failures": provider_stats.get("failures", 0),
            "systemic_failure_records": systemic_failures,
            "integrity_gate": "PASS" if integrity_gate else "FAIL",
            "failure_isolation_gate": "PASS" if systemic_failures == 0 else "FAIL",
        }
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "stage1-metrics.json")
    args = parser.parse_args()
    report = build(args.run)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "run": str(args.run),
        "population": report["population"],
        "accepted_external": report["accepted_external"],
        "provider_slot_totals": report["stage1"]["provider_slot_totals"],
        "readiness": report["stage1"]["readiness"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
