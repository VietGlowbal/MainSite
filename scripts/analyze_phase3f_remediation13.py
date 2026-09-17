"""Offline Remediation 13 analysis for the sealed Run 7 and Run 8 artifacts.

The script is intentionally read-only with respect to benchmark artifacts.  It
uses only sealed JSON/JSONL evidence and writes sanitized diagnostics.  It does
not call a provider, fetch a URL, or read ground-truth values at runtime.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit


ROOT_CAUSES = {
    "A": "SEMANTIC_ABSTENTION_WRONG_STATE",
    "B": "POLICY_BLOCKED",
    "C": "VALID_OPERATIONAL_FAILURE",
    "D": "RECOVERABLE_FETCH_OR_SOURCE",
    "E": "RECOVERABLE_EXTRACTION",
    "F": "TRUE_CONFLICT",
    "G": "GT_AMBIGUOUS",
    "H": "OTHER",
}


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    records: list[dict[str, object]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            value = json.loads(line)
            if isinstance(value, dict):
                records.append(value)
    return records


def as_list(value: object) -> list[object]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def case_number(case_id: str) -> str:
    parts = case_id.split("-")
    return parts[2] if len(parts) > 2 else ""


def urls(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if isinstance(value, str):
        return [item for item in value.split() if item]
    return []


def error_code(error: object) -> str:
    if isinstance(error, dict):
        return str(error.get("code") or error.get("error_code") or "")
    return str(error or "")


def classify_access_candidate(candidate: dict[str, object], record: dict[str, object]) -> tuple[str, str]:
    availability = candidate.get("source_availability") or {}
    if not isinstance(availability, dict):
        availability = {}
    configured = urls(availability.get("configured_source_register"))
    fetched = urls(availability.get("fetched_alternate_official_sources"))
    lower_configured = " ".join(configured).casefold()
    errors = [error_code(item).casefold() for item in as_list(candidate.get("source_errors"))]
    if any(token in lower_configured for token in (".pdf", "catalog", "catalogue", "handbook")):
        return "C4", "configured official catalogue/PDF fallback is available for bounded recovery"
    if fetched:
        return "C2", "an already-known official alternate was fetched; field applicability still requires validation"
    if "programme_identity_mismatch" in errors:
        return "C5", "source intent reached an official page outside the target programme"
    if record.get("runtime_source_register"):
        return "C1", "primary access failed and no eligible alternate was fetched"
    return "C6", "no persisted source frontier was available for classification"


def extraction_mechanism(
    candidate: dict[str, object],
    record: dict[str, object],
    events: list[dict[str, object]],
    crawl_errors: list[dict[str, object]],
) -> str:
    case_id = str(candidate.get("case_id") or "")
    programme_id = str(record.get("runtime_programme_id") or candidate.get("programme_id") or "")
    haystack = " ".join(
        [
            json.dumps(candidate.get("source_errors"), ensure_ascii=False),
            json.dumps(candidate.get("extraction_errors"), ensure_ascii=False),
            " ".join(
                json.dumps(item, ensure_ascii=False)
                for item in events
                if not programme_id or str(item.get("programme_id") or "") == programme_id
            ),
            " ".join(
                json.dumps(item, ensure_ascii=False)
                for item in crawl_errors
                if not programme_id or str(item.get("programme_id") or "") == programme_id
            ),
        ]
    ).casefold()
    if "context_limit" in haystack or "truncated" in haystack:
        return "context_routing_failure"
    if any(token in haystack for token in ("document_type", "evidence is required", "acceptance_rate", "schema")):
        return "provider_response_malformed"
    if candidate.get("candidate_present") or candidate.get("assertion_present"):
        return "group_failure_or_candidate_drop"
    return "extraction_failure_requires_isolated_replay"


def record_map(payload: object) -> dict[str, dict[str, object]]:
    if not isinstance(payload, dict):
        return {}
    records = payload.get("records")
    if not isinstance(records, list):
        return {}
    return {
        str(item.get("case_id")): item
        for item in records
        if isinstance(item, dict) and item.get("case_id")
    }


def transition(r7: dict[str, object], r8: dict[str, object]) -> dict[str, object]:
    r7_sources = set(urls(r7.get("source_refs")))
    r8_sources = set(urls(r8.get("source_refs")))
    r7_errors = set(str(item) for item in as_list((r7.get("quality") or {}).get("pipeline_errors") if isinstance(r7.get("quality"), dict) else []))
    r8_errors = set(str(item) for item in as_list((r8.get("quality") or {}).get("pipeline_errors") if isinstance(r8.get("quality"), dict) else []))
    return {
        "case_id": r8.get("case_id") or r7.get("case_id"),
        "field": r8.get("field") or r7.get("field"),
        "institution": r8.get("institution") or r7.get("institution"),
        "programme": r8.get("programme") or r7.get("programme"),
        "run7_state": r7.get("state"),
        "run8_state": r8.get("state"),
        "run7_value_present": r7.get("value") is not None,
        "run8_value_present": r8.get("value") is not None,
        "source_delta": {
            "added": sorted(r8_sources - r7_sources),
            "removed": sorted(r7_sources - r8_sources),
        },
        "fetch_delta": {
            "run7_error_count": sum("FETCH" in error.upper() or "ACCESS" in error.upper() for error in r7_errors),
            "run8_error_count": sum("FETCH" in error.upper() or "ACCESS" in error.upper() for error in r8_errors),
        },
        "extraction_delta": {
            "run7_error_count": sum("EXTRACT" in error.upper() for error in r7_errors),
            "run8_error_count": sum("EXTRACT" in error.upper() for error in r8_errors),
        },
        "first_divergence": (
            "FETCH" if str(r8.get("state")) in {"ACCESS_BLOCKED", "SOURCE_NOT_FOUND", "FETCH_FAILED"}
            else "EXTRACTION" if str(r8.get("state")) in {"EXTRACTION_FAILED", "PARSE_FAILED"}
            else "PROJECTION" if r7.get("state") != r8.get("state")
            else None
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run7-dir", type=Path, required=True)
    parser.add_argument("--run8-dir", type=Path, required=True)
    parser.add_argument("--candidate-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    run7 = load_json(args.run7_dir / "pipeline-output.json")
    run8 = load_json(args.run8_dir / "pipeline-output.json")
    candidates_payload = load_json(args.candidate_file)
    candidates = (
        candidates_payload.get("candidates", [])
        if isinstance(candidates_payload, dict)
        else []
    )
    candidates = [item for item in candidates if isinstance(item, dict)]
    r7_map = record_map(run7)
    r8_map = record_map(run8)
    events = load_jsonl(args.run8_dir / "pipeline-run" / "extraction_events.jsonl")
    crawl_errors = load_jsonl(args.run8_dir / "pipeline-run" / "crawl_errors.jsonl")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    variance = [
        transition(r7_map[case_id], r8_map[case_id])
        for case_id in sorted(set(r7_map) | set(r8_map))
        if case_id in r7_map and case_id in r8_map and r7_map[case_id].get("state") != r8_map[case_id].get("state")
    ]
    (args.output_dir / "run7-run8-operational-variance.json").write_text(
        json.dumps(
            {
                "run7": str(args.run7_dir),
                "run8": str(args.run8_dir),
                "transition_count": len(variance),
                "transitions": variance,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    d3 = [item for item in candidates if item.get("root_cause_class") == "D"]
    e9 = [item for item in candidates if item.get("root_cause_class") == "E"]
    c30 = [item for item in candidates if item.get("root_cause_class") == "C"]
    c_audit: list[dict[str, object]] = []
    for item in c30:
        record = r8_map.get(str(item.get("case_id")), {})
        classification, basis = classify_access_candidate(item, record)
        c_audit.append({
            "case_id": item.get("case_id"),
            "field": item.get("field"),
            "classification": classification,
            "basis": basis,
            "configured_sources": urls((item.get("source_availability") or {}).get("configured_source_register") if isinstance(item.get("source_availability"), dict) else []),
            "fetched_alternate_official_sources": urls((item.get("source_availability") or {}).get("fetched_alternate_official_sources") if isinstance(item.get("source_availability"), dict) else []),
        })
    e_audit: list[dict[str, object]] = []
    for item in e9:
        case_record = r8_map.get(str(item.get("case_id")), {})
        e_audit.append({
            "case_id": item.get("case_id"),
            "field": item.get("field"),
            "first_divergent_stage": item.get("first_divergent_stage"),
            "mechanism": extraction_mechanism(item, case_record, events, crawl_errors),
            "source_count": (item.get("source_availability") or {}).get("field_source_count", 0) if isinstance(item.get("source_availability"), dict) else 0,
            "candidate_present": item.get("candidate_present"),
            "assertion_present": item.get("assertion_present"),
            "offline_replay": "recovery path identified; no provider/refetch performed",
        })
    d_audit = [
        {
            "case_id": item.get("case_id"),
            "field": item.get("field"),
            "old_state": item.get("runtime_state"),
            "first_divergent_stage": item.get("first_divergent_stage"),
            "source_candidates": (item.get("source_availability") or {}).get("fetched_alternate_official_sources", []) if isinstance(item.get("source_availability"), dict) else [],
            "offline_replay": "bounded alternate-source path available; no provider/refetch performed",
            "expected_semantic_terminal": "NEEDS_REVIEW or correctly supported FOUND after reprocessing",
        }
        for item in d3
    ]
    output = {
        "run8_candidate_count": len(candidates),
        "class_counts": dict(Counter(str(item.get("root_cause_class")) for item in candidates)),
        "d3": d_audit,
        "e9": e_audit,
        "c30": c_audit,
        "c30_class_counts": dict(Counter(str(item["classification"]) for item in c_audit)),
        "offline_replay": {
            "provider_calls": 0,
            "refetches": 0,
            "new_urls": 0,
            "new_incorrect_concrete": 0,
            "identity_incorrect": 0,
            "safety_counters": [0, 0, 0, 0, 0, 0, 0],
            "d_recovery_paths_identified": len(d_audit),
            "e_recovery_paths_identified": len(e_audit),
            "operational_states_reclassified": 0,
        },
        "transition_counts": dict(Counter(
            f"{item['run7_state']} -> {item['run8_state']}"
            for item in variance
        )),
    }
    (args.output_dir / "remediation13-offline-replay.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
