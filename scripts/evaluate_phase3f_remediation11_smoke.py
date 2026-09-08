"""Score the bounded Remediation 11 live smoke after its output is sealed."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "services" / "data-ingestion" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from glowbal_ingestion.benchmark_scorer import score_records  # noqa: E402

TRUTH_PATH = ROOT / "docs" / "benchmarks" / "2026-09-06-phase3f-ground-truth-v3-frozen.jsonl"
SMOKE_ROWS = {1, 2, 9, 15, 22, 23, 24, 25, 27, 33, 34}
SAFETY_METRIC_KEYS = {
    "false_current_critical": "false_current_critical_count",
    "fuzzy_only_identity_merge": "identity_merge_violations",
    "unresolved_conflict_promoted": "critical_unresolved_conflict_promoted_count",
    "source_not_found_promoted": "critical_source_not_found_promoted_count",
    "stale_only_promoted": "critical_stale_only_promoted_count",
    "prohibited_high_volatility_inferred_critical_promoted": (
        "prohibited_high_volatility_inferred_critical_promoted_count"
    ),
    "product_safe_without_durable_provenance": (
        "product_safe_without_durable_provenance_count"
    ),
}


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected JSON object: {path}")
    return value


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def row_for_case(case_id: str) -> int:
    return int(case_id.split("-")[2])


def has_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def evaluate(run_dir: Path) -> Path:
    run_dir = run_dir.resolve()
    output = read_json(run_dir / "pipeline-output.json")
    manifest = read_json(run_dir / "run-manifest.json")
    truth = [
        item
        for item in read_jsonl(TRUTH_PATH)
        if row_for_case(str(item["case_id"])) in SMOKE_ROWS
    ]
    case_ids = {str(item["case_id"]) for item in truth}
    smoke_output = dict(output)
    smoke_output["records"] = [
        item for item in output.get("records", []) if item.get("case_id") in case_ids
    ]
    score = score_records(truth, smoke_output)
    metrics = score.get("metrics", {})
    safety = {
        name: int(metrics.get(key, 0) or 0)
        for name, key in SAFETY_METRIC_KEYS.items()
    }
    output_by_id = {
        str(item["case_id"]): item for item in smoke_output["records"]
    }
    score_by_id = {str(item["case_id"]): item for item in score.get("cases", [])}
    status_rows = []
    unsafe_status = []
    for case_id in sorted(case_ids):
        if not case_id.endswith("-programme_status"):
            continue
        item = output_by_id.get(case_id, {})
        concrete = item.get("state") == "FOUND" and has_value(item.get("value"))
        candidate_diagnostics = item.get("lifecycle", {}).get(
            "candidate_diagnostics", []
        )
        accepted = any(
            diagnostic.get("accepted_for_runtime_found")
            for diagnostic in candidate_diagnostics
        )
        unsafe = concrete and not accepted
        if unsafe:
            unsafe_status.append(case_id)
        status_rows.append(
            {
                "case_id": case_id,
                "state": item.get("state"),
                "value": item.get("value"),
                "concrete": concrete,
                "accepted_with_status_policy": accepted,
                "scorer_outcome": score_by_id.get(case_id, {}).get("outcome"),
            }
        )

    provider_metrics = manifest.get("pipeline_metrics", {})
    result = {
        "run_id": manifest.get("run_id"),
        "diagnostic_only": manifest.get("diagnostic_only"),
        "programme_rows": manifest.get("programme_count"),
        "terminal_programmes": manifest.get("terminal_programme_counts", {}).get(
            "terminal"
        ),
        "pipeline_output_sha256": manifest.get("pipeline_output_sha256"),
        "provider": manifest.get("runtime", {}).get("extraction_provider"),
        "endpoint": manifest.get("preflight", {}).get("provider", {}).get("endpoint"),
        "model": manifest.get("runtime", {}).get("extraction_model_label"),
        "reasoning_mode": "none",
        "provider_metrics": provider_metrics,
        "truth_subset_records": len(truth),
        "score_metrics": metrics,
        "critical_precision": metrics.get("critical_field_precision"),
        "false_current": metrics.get("false_current_critical_count"),
        "safety_counters": safety,
        "status_rows": status_rows,
        "unsafe_status": unsafe_status,
        "identity_target_outcomes": {
            case_id: score_by_id.get(case_id, {}).get("outcome")
            for case_id in sorted(case_ids)
            if case_id.endswith("-programme_identity")
        },
        "targeted_smoke_pass": (
            metrics.get("critical_field_precision", {}).get("value") == 1.0
            and not unsafe_status
            and all(value == 0 for value in safety.values())
        ),
    }
    result_path = run_dir / "targeted-smoke-evaluation.json"
    result_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return result_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", type=Path, required=True)
    args = parser.parse_args()
    print(evaluate(args.run_dir))


if __name__ == "__main__":
    main()
