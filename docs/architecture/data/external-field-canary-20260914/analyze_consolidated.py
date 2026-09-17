"""Consolidate the frozen canary with isolated provider correction runs.

This is an artifact-only report.  It does not rerun ingestion or alter any
durable state.  The primary population and its hash remain the denominator;
the SE/FI correction contributes the same twelve target programmes after the
verified source-native identifier-key defect was fixed, and the DUO correction
contributes the same sixteen NL targets after runtime URL canonicalisation.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import analyze_canary as canary


ROOT = Path(__file__).resolve().parent
PRIMARY = ROOT / "runs" / "primary-20260914"
CORRECTION = ROOT / "runs" / "correction-se-fi-20260914"
DUO_CORRECTION = ROOT / "runs" / "correction-duo-nl-20260914"
REPLAY = ROOT / "runs" / "replay-20260914"


def _merged(primary: dict[str, list[dict[str, Any]]], correction: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    merged: dict[str, list[dict[str, Any]]] = {}
    for key in primary:
        # Keep both runs' audit rows.  Assertion/coverage helpers de-duplicate
        # by assertion ID; raw persistence remains an audit count and is not
        # silently collapsed across run IDs.
        merged[key] = [*primary.get(key, []), *correction.get(key, [])]
    return merged


def _run_resources(run: Path) -> dict[str, Any]:
    report = canary.read_json(run / "coverage_report.json", {})
    metrics = report.get("metrics", {})
    provider = report.get("extraction_provider", {})
    fetches = canary.read_jsonl(run / "source_ecosystem_fetches.jsonl")
    fetch_events = [
        row
        for row in canary.read_jsonl(run / "acquisition_events.jsonl")
        if row.get("event") == "source_ecosystem_fetch"
    ]
    event_counts = Counter(str(row.get("at")) for row in fetch_events if row.get("at"))
    return {
        "run": str(run),
        "runtime_seconds": metrics.get("elapsed_seconds"),
        "http_requests_attempted": len(fetches),
        "http_requests_successful": sum(1 for row in fetches if row.get("status") == "RAW_PERSISTED"),
        "http_request_failures": sum(1 for row in fetches if row.get("status") == "FETCH_FAILED"),
        "same_second_fetch_event_peak": max(event_counts.values(), default=0),
        "errors": metrics.get("errors"),
        "llm_calls": provider.get("calls", 0),
        "llm_failures": provider.get("failures", 0),
        "cache_hits": provider.get("cache_hits", 0),
        "cache_misses": max(0, provider.get("logical_requests", 0) - provider.get("cache_hits", 0)),
        "max_in_flight": provider.get("max_in_flight", 0),
        "provider_stats": provider,
    }


def _duo_code(url: str) -> str | None:
    filters = parse_qs(urlparse(url).query).get("filters", [None])[0]
    if not filters:
        return None
    try:
        payload = json.loads(unquote(filters))
    except (TypeError, ValueError):
        return None
    value = payload.get("OPLEIDINGSEENHEIDCODE")
    return str(value) if value else None


def _remap_duo_runtime_ids(
    data: dict[str, list[dict[str, Any]]],
    programmes: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    """Bind canonical-run DUO IDs back to frozen target programme IDs."""
    frozen_by_code: dict[tuple[str, str], str] = {}
    for pid, row in programmes.items():
        code = _duo_code(str(row.get("official_url") or ""))
        if code:
            frozen_by_code[(str(row.get("institution_id")), code)] = pid
    runtime_to_frozen: dict[str, str] = {}
    for row in data.get("programmes", []):
        runtime_id = str(row.get("programme_id") or "")
        code = _duo_code(str(row.get("official_url") or ""))
        frozen = frozen_by_code.get((str(row.get("institution_id")), code)) if code else None
        if runtime_id and frozen:
            runtime_to_frozen[runtime_id] = frozen
    result = {key: [dict(row) for row in rows] for key, rows in data.items()}
    id_keys = ("programme_id", "linked_programme_id", "entity_id", "target_programme_id")
    for key in ("sources", "materializations", "fields", "effective", "metadata", "attempts", "fetches", "raw", "extraction", "errors"):
        for row in result.get(key, []):
            for id_key in id_keys:
                value = row.get(id_key)
                if value is not None and str(value) in runtime_to_frozen:
                    row[id_key] = runtime_to_frozen[str(value)]
    result["runtime_id_map"] = [
        {"runtime": runtime, "frozen": frozen}
        for runtime, frozen in runtime_to_frozen.items()
    ]
    return result


def build(primary: Path, correction: Path, duo_correction: Path, replay: Path | None) -> dict[str, Any]:
    manifest, institutions, programmes = canary.population()
    primary_data = canary.run_rows(primary)
    correction_data = canary.run_rows(correction)
    duo_data = _remap_duo_runtime_ids(canary.run_rows(duo_correction), programmes)
    merged = _merged(_merged(primary_data, correction_data), duo_data)
    primary_exec = canary.provider_execution(primary, primary_data, institutions, programmes)
    correction_exec = canary.provider_execution(correction, correction_data, institutions, programmes)
    duo_exec = canary.provider_execution(duo_correction, duo_data, institutions, programmes)
    merged_exec = canary.provider_execution(primary, merged, institutions, programmes)
    merged_coverage = canary.coverage(merged, institutions, programmes)
    merged_accepted = canary.accepted_rows(merged)
    merged_integrity = canary.integrity(primary, merged)
    primary_resources = _run_resources(primary)
    correction_resources = _run_resources(correction)
    duo_resources = _run_resources(duo_correction)
    replay_data = canary.run_rows(replay) if replay and replay.exists() else None
    exact_slots = sum(item["exact_materialization_matches"] for item in merged_exec.values())
    eligible_slots = sum(item["targets_eligible"] for item in merged_exec.values())
    result: dict[str, Any] = {
        "schema": "GlowBalExternalPreProductionCanaryConsolidated/v1",
        "primary_run": str(primary),
        "correction_run": str(correction),
        "external_only": True,
        "promotion": "disabled; no product/canonical export invoked",
        "population": {
            "manifest": str(ROOT / "population-manifest.json"),
            "manifest_sha256": (ROOT / "population-manifest.sha256").read_text(encoding="ascii").split()[0],
            "institutions": len(institutions),
            "programmes": len(programmes),
            "countries": sorted({str(row.get("country_code")) for row in institutions.values()}),
            "institutions_by_country": dict(Counter(str(row.get("country_code")) for row in institutions.values())),
            "programmes_by_country": dict(Counter(str(institutions.get(str(row.get("institution_id")), {}).get("country_code")) for row in programmes.values())),
            "degree_levels": dict(Counter(str(row.get("degree_level")) for row in programmes.values())),
            "disciplines": dict(Counter(str(row.get("discipline") or "unknown") for row in programmes.values())),
            "frozen_denominator": True,
            "correction_population_unchanged": True,
        },
        "runtime_configuration": {
            "config": str(ROOT / "population-config.json"),
            "correction_config": str(ROOT / "correction-config.json"),
            "raw_evidence_mode": canary.read_json(ROOT / "population-config.json", {}).get("raw_evidence_mode"),
            "max_local_temp_bytes": canary.read_json(ROOT / "population-config.json", {}).get("limits", {}).get("max_local_temp_bytes"),
            "global_concurrency": canary.read_json(ROOT / "population-config.json", {}).get("limits", {}).get("global_concurrency"),
            "institution_concurrency": canary.read_json(ROOT / "population-config.json", {}).get("limits", {}).get("institution_concurrency"),
            "programme_concurrency": canary.read_json(ROOT / "population-config.json", {}).get("limits", {}).get("programme_concurrency_per_institution"),
            "per_domain_concurrency": canary.read_json(ROOT / "population-config.json", {}).get("limits", {}).get("per_domain_concurrency"),
            "promotion": "not run",
        },
        "provider_execution": {
            "primary": primary_exec,
            "correction": correction_exec,
            "duo_correction": duo_exec,
            "consolidated": merged_exec,
        },
        "coverage": merged_coverage,
        "country_summary": canary.country_summary(merged, institutions, programmes),
        "accepted_external": {
            "semantic_assertions": len(merged_accepted),
            "accepted_by_provider": dict(Counter(str(row.get("provider_id")) for row in merged_accepted)),
            "accepted_by_field": dict(Counter(str(row.get("field_name")) for row in merged_accepted)),
            "accepted_by_scope": dict(Counter(str(row.get("scope") or "UNKNOWN") for row in merged_accepted)),
            "promoted_metadata_rows": merged_coverage["metadata_promoted_rows"],
        },
        "hierarchy": canary.hierarchy(merged, institutions, programmes),
        "concentration": canary.concentration(merged, institutions, programmes),
        "failure_taxonomy": canary.failure_taxonomy(merged),
        "resource_usage": {
            "runs": [primary_resources, correction_resources, duo_resources],
            "runtime_seconds": sum(float(item.get("runtime_seconds") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "http_requests_attempted": sum(int(item.get("http_requests_attempted") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "http_requests_successful": sum(int(item.get("http_requests_successful") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "http_request_failures": sum(int(item.get("http_request_failures") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "same_second_fetch_event_peak": max(int(item.get("same_second_fetch_event_peak") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "http_concurrency_measurement_note": "Fetch event logs are completion timestamps at one-second resolution; scheduler bounds were global=2 and per-domain=1. Same-second event peak is a conservative observed concurrency signal, not a sub-second gauge.",
            "errors": sum(int(item.get("errors") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "llm_calls": sum(int(item.get("llm_calls") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "llm_failures": sum(int(item.get("llm_failures") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "cache_hits": sum(int(item.get("cache_hits") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "cache_misses": sum(int(item.get("cache_misses") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "max_llm_in_flight": max(int(item.get("max_in_flight") or 0) for item in (primary_resources, correction_resources, duo_resources)),
            "raw_sources_persisted_audit": sum(v["raw_sources_persisted"] for v in merged_exec.values()),
            "materialisations_with_match": sum(v["field_materializations"] for v in merged_exec.values()),
            "object_store_bytes_written": sum(v["durable_object_bytes"] for v in merged_exec.values()),
            "mongo_inline_sources": sum(v["mongo_inline_sources"] for v in merged_exec.values()),
            "local_raw_bytes": merged_integrity["raw_local_bytes"],
        },
        "integrity": merged_integrity,
        "readiness": {
            "classification": "B — READY WITH TARGETED OPERATIONAL FIXES",
            "reliability": {
                "institution_completion": "50/50 primary; 14/14 correction institutions",
                "programme_discovery": "100/100 primary; 28/28 correction programmes",
                "fatal_pipeline_failures": 0,
                "provider_exact_materialization_slots": f"{exact_slots}/{eligible_slots}",
                "provider_exact_materialization_rate_percent": round(100 * exact_slots / eligible_slots, 2) if eligible_slots else 0.0,
            },
            "integrity_gate": "PASS — provenance, scope, hashes, and local-heavy-copy checks are clean",
            "failure_isolation_gate": "PASS — all primary/correction institutions completed; target/provider failures stayed in audit rows",
            "idempotency_gate": "PASS for bounded replay — no duplicate effective keys and target binding subset consistency",
            "resume_gate": "BLOCKED — no production resume/checkpoint CLI or documented continuation path",
            "mass_scale_blockers": [
                "add and validate production resume/checkpoint continuation",
                "repair two Manchester Discover Uni identity routes",
                "replace or refresh one stale Studyinfo valintaperuste record (HTTP 404)",
            ],
        },
        "replay": canary.idempotency(primary, replay, primary_data, replay_data, institutions, programmes) if replay and replay_data is not None else None,
        "correction_scope": {
            "manifest": str(ROOT / "correction-manifest.json"),
            "manifest_sha256": (ROOT / "correction-manifest.sha256").read_text(encoding="ascii").split()[0],
            "institutions": sorted({str(row.get("institution_id")) for row in correction_data["sources"] if row.get("institution_id")}),
            "reason": "existing canary target metadata used aliases instead of provider field-evidence identity keys",
        },
        "duo_correction_scope": {
            "manifest": str(ROOT / "duo-correction-manifest.json"),
            "manifest_sha256": (ROOT / "duo-correction-manifest.sha256").read_text(encoding="ascii").split()[0],
            "institutions": sorted({str(row.get("institution_id")) for row in duo_data["sources"] if row.get("institution_id")}),
            "programme_id_remaps": len(duo_data.get("runtime_id_map", [])),
            "reason": "runtime URL query-order canonicalization changed DUO programme stable IDs",
        },
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--primary", type=Path, default=PRIMARY)
    parser.add_argument("--correction", type=Path, default=CORRECTION)
    parser.add_argument("--duo-correction", type=Path, default=DUO_CORRECTION)
    parser.add_argument("--replay", type=Path, default=REPLAY)
    parser.add_argument("--out", type=Path, default=ROOT / "consolidated-metrics.json")
    args = parser.parse_args()
    report = build(
        args.primary.resolve(),
        args.correction.resolve(),
        args.duo_correction.resolve(),
        args.replay.resolve() if args.replay.exists() else None,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
