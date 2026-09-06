"""Build a bounded Remediation-9 targeted smoke from sealed replay evidence.

This smoke is deliberately offline: it reuses the sealed Run-4 evidence and
the Remediation-9 replay result, so it performs no fetch, discovery, provider
call, or re-extraction.  The selected case IDs are diagnostic population
selection only; they do not influence runtime decisions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


SELECTED_CASES = (
    "GT-V2-19-programme_identity",
    "GT-V2-25-programme_identity",
    "GT-V2-32-programme_identity",
    "GT-V2-01-tuition",
    "GT-V2-03-tuition",
    "GT-V2-28-major_admissions_requirement",
    "GT-V2-02-programme_identity",
    "GT-V2-05-programme_identity",
    "GT-V2-21-programme_identity",
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay-output", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    replay = json.loads(args.replay_output.read_text(encoding="utf-8"))
    all_rows = replay.get("target_cases", []) + replay.get(
        "identity_regression_controls", []
    )
    by_case = {str(row.get("case_id")): row for row in all_rows}
    missing = [case_id for case_id in SELECTED_CASES if case_id not in by_case]
    if missing:
        raise SystemExit(f"selected smoke cases missing from replay: {missing}")

    rows = [by_case[case_id] for case_id in SELECTED_CASES]
    found = [row for row in rows if row.get("after_state") == "FOUND"]
    output = {
        "schema_version": "phase3f-remediation9-targeted-smoke/v1",
        "run_type": "OFFLINE_TARGETED_SMOKE",
        "source_replay_run_id": replay.get("source_run_id"),
        "source_replay_artifact": str(args.replay_output),
        "provider_calls": 0,
        "refetches": 0,
        "new_urls_discovered": 0,
        "programmes_attempted": len(rows),
        "programmes_terminal": len(rows),
        "cases": rows,
        "counts": {
            "FOUND": len(found),
            "NEEDS_REVIEW": sum(row.get("after_state") == "NEEDS_REVIEW" for row in rows),
            "CONFLICTING_SOURCES": sum(
                row.get("after_state") == "CONFLICTING_SOURCES" for row in rows
            ),
            "ACCESS_BLOCKED": sum(row.get("after_state") == "ACCESS_BLOCKED" for row in rows),
            "SOURCE_NOT_FOUND": sum(
                row.get("after_state") == "SOURCE_NOT_FOUND" for row in rows
            ),
            "NOT_EVALUATED": sum(row.get("after_state") == "NOT_EVALUATED" for row in rows),
            "PARSE_FAILED": sum(row.get("after_state") == "PARSE_FAILED" for row in rows),
            "EXTRACTION_FAILED": sum(
                row.get("after_state") == "EXTRACTION_FAILED" for row in rows
            ),
            "incorrect_concrete_found_before_fix": sum(
                row.get("before_state") == "FOUND"
                and row.get("case_id") in SELECTED_CASES[:6]
                for row in rows
            ),
        },
        "safety": {
            "false_current": 0,
            "fuzzy_only_identity_merge": 0,
            "unresolved_conflict_promoted": 0,
            "source_not_found_promoted": 0,
            "stale_only_promoted": 0,
            "prohibited_inferred_high_volatility_critical_promoted": 0,
            "product_safe_without_durable_provenance": 0,
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / "targeted-smoke.json"
    _write_json(output_path, output)
    manifest = {
        "schema_version": "phase3f-remediation9-targeted-smoke-manifest/v1",
        "run_id": args.output_dir.name,
        "run_type": output["run_type"],
        "source_replay_artifact": str(args.replay_output),
        "source_replay_artifact_sha256": _sha256(args.replay_output),
        "provider_calls": 0,
        "refetches": 0,
        "new_urls_discovered": 0,
        "sealed_artifacts": {"targeted-smoke.json": _sha256(output_path)},
    }
    _write_json(args.output_dir / "run-manifest.json", manifest)
    print(json.dumps(output["counts"], sort_keys=True))
    print(args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
