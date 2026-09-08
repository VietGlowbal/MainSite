"""Offline Remediation 11 replay for programme-status safety.

The replay reads only the persisted Run #6 pipeline evidence.  It reprojects
all 36 programme-status cases with the current deterministic acceptance policy,
seals the diagnostic replay output, and only then loads the frozen V3 truth and
scorer.  It never invokes a provider, discovers a URL, or writes to Run #6.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "services" / "data-ingestion" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

EXPECTED_RUN6_ID = "phase3f-v3-run-20260908T040003Z"
EXPECTED_RUN6_OUTPUT_SHA256 = (
    "b0bacb90c6c4b315cdf9bc710bdb69ac4349b204b754d6265a6809c1a0251b62"
)
TRUTH_PATH = ROOT / "docs" / "benchmarks" / "2026-09-06-phase3f-ground-truth-v3-frozen.jsonl"
ROSTER_PATH = ROOT / "docs" / "benchmarks" / "2026-08-30-phase-3f-roster-v2.md"

TARGET_IDENTITY_CASES = {
    "GT-V2-22-programme_identity",
    "GT-V2-23-programme_identity",
    "GT-V2-25-programme_identity",
    "GT-V2-33-programme_identity",
    "GT-V2-34-programme_identity",
}
REMEDIATION_4_CASES = {
    "GT-V2-01-major_admissions_requirement",
    "GT-V2-02-major_admissions_requirement",
    "GT-V2-02-tuition",
    "GT-V2-15-application_deadline",
    "GT-V2-15-major_admissions_requirement",
    "GT-V2-22-english_requirement",
    "GT-V2-22-major_admissions_requirement",
}
ORIGINAL_P0_CASES = {
    "GT-V2-09-programme_identity",
    "GT-V2-09-credential",
    "GT-V2-15-credential",
    "GT-V2-22-credential",
    "GT-V2-23-credential",
    "GT-V2-27-credential",
}
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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def load_runner() -> Any:
    path = ROOT / "scripts" / "run_phase3f_v3_benchmark.py"
    spec = importlib.util.spec_from_file_location("phase3f_v3_runner_rem11", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark runner: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_preflight() -> Any:
    path = ROOT / "scripts" / "phase3f_v3_preflight.py"
    spec = importlib.util.spec_from_file_location("phase3f_v3_preflight_rem11", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load V3 preflight: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def has_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def case_maps(
    sealed_output: dict[str, Any],
    replay_output: dict[str, Any],
    sealed_score: dict[str, Any],
    replay_score: dict[str, Any],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    return (
        {str(item["case_id"]): item for item in sealed_output.get("records", [])},
        {str(item["case_id"]): item for item in replay_output.get("records", [])},
        {str(item["case_id"]): item for item in sealed_score.get("cases", [])},
        {str(item["case_id"]): item for item in replay_score.get("cases", [])},
    )


def status_replay_rows(
    *,
    sealed_output: dict[str, Any],
    replay_output: dict[str, Any],
    replay_score: dict[str, Any],
    assertions: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    before_by_id = {
        str(item["case_id"]): item for item in sealed_output.get("records", [])
    }
    after_by_id = {
        str(item["case_id"]): item for item in replay_output.get("records", [])
    }
    score_by_id = {str(item["case_id"]): item for item in replay_score.get("cases", [])}
    rows: list[dict[str, Any]] = []
    for row_number in range(1, 37):
        case_id = f"GT-V2-{row_number:02d}-programme_status"
        before = before_by_id.get(case_id, {})
        after = after_by_id.get(case_id, {})
        candidate_rows: list[dict[str, Any]] = []
        for diagnostic in after.get("lifecycle", {}).get("candidate_diagnostics", []):
            assertion = assertions.get(str(diagnostic.get("assertion_id")), {})
            status_diagnostic = diagnostic.get("status_acceptance") or {}
            candidate_rows.append(
                {
                    "assertion_id": diagnostic.get("assertion_id"),
                    "component_field": diagnostic.get("component_field"),
                    "candidate_value": assertion.get("value_json"),
                    "evidence": assertion.get("evidence"),
                    "source_url": assertion.get("source_url"),
                    "accepted_for_runtime_found": diagnostic.get(
                        "accepted_for_runtime_found"
                    ),
                    "acceptance_reasons": diagnostic.get("acceptance_reasons", []),
                    "status_acceptance": status_diagnostic,
                }
            )
        concrete = after.get("state") == "FOUND" and has_value(after.get("value"))
        unsafe = concrete and not any(
            item.get("accepted_for_runtime_found") for item in candidate_rows
        )
        rows.append(
            {
                "case_id": case_id,
                "before_state": before.get("state"),
                "before_value": before.get("value"),
                "after_state": after.get("state"),
                "after_value": after.get("value"),
                "concrete_after": concrete,
                "safe_concrete_after": concrete and not unsafe,
                "unsafe_concrete_after": unsafe,
                "scorer_outcome_after": score_by_id.get(case_id, {}).get("outcome"),
                "candidate_trace": candidate_rows,
            }
        )
    return rows


def compare_identity_controls(
    *,
    sealed_output: dict[str, Any],
    replay_output: dict[str, Any],
    replay_score: dict[str, Any],
    sealed_score: dict[str, Any],
) -> dict[str, Any]:
    before_by_id, after_by_id, _, after_score_by_id = case_maps(
        sealed_output, replay_output, sealed_score, replay_score
    )
    before_score_by_id = {
        str(item["case_id"]): item for item in sealed_score.get("cases", [])
    }
    controls = [
        case_id
        for case_id, record in before_by_id.items()
        if record.get("field") == "programme_identity"
        and record.get("state") == "FOUND"
        and before_score_by_id.get(case_id, {}).get("outcome") == "PASS"
    ]
    rows: list[dict[str, Any]] = []
    for case_id in sorted(controls):
        before = before_by_id[case_id]
        after = after_by_id.get(case_id, {})
        scored = after_score_by_id.get(case_id, {})
        after_found = after.get("state") == "FOUND" and has_value(after.get("value"))
        after_correct = scored.get("outcome") == "PASS"
        rows.append(
            {
                "case_id": case_id,
                "before_state": before.get("state"),
                "after_state": after.get("state"),
                "before_value": before.get("value"),
                "after_value": after.get("value"),
                "after_scorer_outcome": scored.get("outcome"),
                "retained_correct": after_correct,
                "new_unresolved": not after_found,
                "new_incorrect": after_found and not after_correct,
            }
        )
    return {
        "before_correct_control_count": len(controls),
        "retained_correct": sum(row["retained_correct"] for row in rows),
        "new_unresolved": sum(row["new_unresolved"] for row in rows),
        "new_incorrect": sum(row["new_incorrect"] for row in rows),
        "rows": rows,
    }


def control_audit(
    case_ids: set[str],
    *,
    replay_output: dict[str, Any],
    replay_score: dict[str, Any],
) -> list[dict[str, Any]]:
    output_by_id = {
        str(item["case_id"]): item for item in replay_output.get("records", [])
    }
    score_by_id = {str(item["case_id"]): item for item in replay_score.get("cases", [])}
    rows: list[dict[str, Any]] = []
    for case_id in sorted(case_ids):
        output = output_by_id.get(case_id, {})
        rows.append(
            {
                "case_id": case_id,
                "state": output.get("state"),
                "value": output.get("value"),
                "concrete_emission": output.get("state") == "FOUND"
                and has_value(output.get("value")),
                "scorer_outcome": score_by_id.get(case_id, {}).get("outcome"),
                "scorer_error_classes": score_by_id.get(case_id, {}).get(
                    "error_classes", []
                ),
            }
        )
    return rows


def run(args: argparse.Namespace) -> Path:
    run6_dir = args.run6_dir.resolve()
    sealed_path = run6_dir / "pipeline-output.json"
    if not sealed_path.exists():
        raise RuntimeError(f"Missing sealed Run #6 output: {sealed_path}")
    if sha256(sealed_path) != EXPECTED_RUN6_OUTPUT_SHA256:
        raise RuntimeError("Sealed Run #6 pipeline output checksum mismatch")
    sealed_output = read_json(sealed_path)
    if sealed_output.get("run_id") != EXPECTED_RUN6_ID:
        raise RuntimeError("Sealed output run ID does not match Official Run #6")
    sealed_score = read_json(run6_dir / "score-result.json")

    runner = load_runner()
    rows, source_register = runner._parse_roster(ROSTER_PATH)
    pipeline_dir = run6_dir / "pipeline-run"
    replay_output = runner._project_output(
        run_id="phase3f-remediation11-offline-replay",
        pipeline_dir=pipeline_dir,
        rows=rows,
        source_register=source_register,
        raw_evidence_mode="local",
    )
    replay_output.update(
        {
            "benchmark_version": "phase3f-v3",
            "truth_version": "phase-3f-ground-truth-v3-frozen",
            "diagnostic_only": True,
            "sealed": True,
            "sealed_at": datetime.now(timezone.utc).isoformat(),
            "source_run_id": EXPECTED_RUN6_ID,
            "provider_calls": 0,
            "refetch_count": 0,
            "new_urls": 0,
        }
    )

    replay_id = args.replay_id or (
        "phase3f-remediation11-offline-replay-"
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    output_dir = (args.output_root / replay_id).resolve()
    output_dir.mkdir(parents=True, exist_ok=False)
    replay_path = output_dir / "replay-output.json"
    write_json(replay_path, replay_output)
    replay_digest = sha256(replay_path)

    # Truth and scorer are loaded only after the replay output has been written
    # and hashed, preserving the execution -> seal -> evaluate boundary.
    preflight = load_preflight()
    v3_integrity = preflight.validate_v3_integrity()
    truth = read_jsonl(TRUTH_PATH)
    scorer = __import__("glowbal_ingestion.benchmark_scorer", fromlist=["score_records"])
    replay_score = scorer.score_records(truth, replay_output)
    write_json(output_dir / "score-result.json", replay_score)

    assertion_rows = read_jsonl(pipeline_dir / "effective_field_assertions.jsonl")
    assertions = {
        str(item["assertion_id"]): item
        for item in assertion_rows
        if item.get("assertion_id")
    }
    status_rows = status_replay_rows(
        sealed_output=sealed_output,
        replay_output=replay_output,
        replay_score=replay_score,
        assertions=assertions,
    )
    identity_controls = compare_identity_controls(
        sealed_output=sealed_output,
        replay_output=replay_output,
        replay_score=replay_score,
        sealed_score=sealed_score,
    )
    target_identity_rows = [
        row
        for row in identity_controls["rows"]
        if row["case_id"] in TARGET_IDENTITY_CASES
    ]
    sealed_by_id, replay_by_id, _, replay_score_by_id = case_maps(
        sealed_output, replay_output, sealed_score, replay_score
    )
    target_identity_rows = []
    for case_id in sorted(TARGET_IDENTITY_CASES):
        before = sealed_by_id.get(case_id, {})
        after = replay_by_id.get(case_id, {})
        scored = replay_score_by_id.get(case_id, {})
        target_identity_rows.append(
            {
                "case_id": case_id,
                "run6_state": before.get("state"),
                "run6_value": before.get("value"),
                "replay_state": after.get("state"),
                "replay_value": after.get("value"),
                "replay_scorer_outcome": scored.get("outcome"),
                "replay_comparison_class": scored.get("comparison_class"),
            }
        )

    safety_metrics = {
        name: int(replay_score.get("metrics", {}).get(key, 0) or 0)
        for name, key in SAFETY_METRIC_KEYS.items()
    }
    status_counts = dict(Counter(row["after_state"] for row in status_rows))
    unsafe_status = [
        row["case_id"] for row in status_rows if row["unsafe_concrete_after"]
    ]
    status_incorrect_found = [
        row["case_id"]
        for row in status_rows
        if row["after_state"] == "FOUND"
        and row["scorer_outcome_after"] == "UNSAFE_UNRESOLVED_VALUE"
    ]
    status_summary = {
        "population": 36,
        "state_counts": status_counts,
        "concrete_found": sum(row["concrete_after"] for row in status_rows),
        "unsafe_concrete_found": unsafe_status,
        "incorrect_found": status_incorrect_found,
        "false_current": len(status_incorrect_found),
        "all_concrete_outputs_have_acceptance_proof": not unsafe_status,
    }

    rem4_rows = control_audit(
        REMEDIATION_4_CASES,
        replay_output=replay_output,
        replay_score=replay_score,
    )
    p0_rows = control_audit(
        ORIGINAL_P0_CASES,
        replay_output=replay_output,
        replay_score=replay_score,
    )

    write_jsonl(output_dir / "programme-status-replay.jsonl", status_rows)
    write_jsonl(output_dir / "identity-control-replay.jsonl", identity_controls["rows"])
    write_jsonl(output_dir / "identity-five-case-comparison.jsonl", target_identity_rows)
    write_jsonl(output_dir / "remediation4-controls.jsonl", rem4_rows)
    write_jsonl(output_dir / "original-p0-controls.jsonl", p0_rows)
    summary = {
        "run_id": replay_id,
        "source_run_id": EXPECTED_RUN6_ID,
        "source_pipeline_output_sha256": EXPECTED_RUN6_OUTPUT_SHA256,
        "replay_output_sha256": replay_digest,
        "provider_calls": 0,
        "refetch_count": 0,
        "new_urls": 0,
        "truth_loaded_after_replay_seal": True,
        "v3_integrity": v3_integrity,
        "programme_status": status_summary,
        "identity_controls": {
            key: value
            for key, value in identity_controls.items()
            if key != "rows"
        },
        "identity_target_cases": target_identity_rows,
        "remediation4_unsupported_concrete_promotions": [
            row["case_id"] for row in rem4_rows if row["concrete_emission"]
        ],
        "original_p0_unsupported_concrete_promotions": [
            row["case_id"] for row in p0_rows if row["concrete_emission"]
        ],
        "safety_metrics": safety_metrics,
        "score_metrics": replay_score.get("metrics", {}),
        "error_counts": replay_score.get("error_counts", {}),
    }
    write_json(output_dir / "replay-summary.json", summary)
    manifest = {
        "run_id": replay_id,
        "diagnostic_only": True,
        "purpose": "Remediation 11 programme-status safety offline replay",
        "source_run_id": EXPECTED_RUN6_ID,
        "source_pipeline_output": str(sealed_path),
        "source_pipeline_output_sha256": EXPECTED_RUN6_OUTPUT_SHA256,
        "replay_output": str(replay_path),
        "replay_output_sha256": replay_digest,
        "code_revision": runner.git_value("rev-parse", "HEAD"),
        "working_tree_changes_present": bool(runner.git_value("status", "--porcelain")),
        "provider_calls": 0,
        "refetch_count": 0,
        "new_urls": 0,
        "programme_status_case_count": 36,
        "identity_correct_control_count": identity_controls[
            "before_correct_control_count"
        ],
        "safety_metrics": safety_metrics,
        "offline_replay_pass": (
            not unsafe_status
            and not status_incorrect_found
            and all(value == 0 for value in safety_metrics.values())
            and identity_controls["new_incorrect"] == 0
        ),
    }
    write_json(output_dir / "run-manifest.json", manifest)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run6-dir", type=Path, required=True)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=ROOT / "docs" / "benchmarks" / "runs",
    )
    parser.add_argument("--replay-id")
    args = parser.parse_args()
    print(run(args))


if __name__ == "__main__":
    main()
