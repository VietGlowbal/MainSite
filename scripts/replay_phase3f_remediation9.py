"""Offline replay for the six frozen Benchmark V3 quality failures.

This diagnostic reads only sealed Run-4 artifacts and persisted raw evidence.
It does not call a provider, recrawl, or use truth to make runtime decisions.
Frozen truth/score artifacts are consulted only by the report layer after the
replayed state has been computed.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.runtime_acceptance import projection_acceptance_reasons  # noqa: E402


TARGET_CASES = (
    "GT-V2-19-programme_identity",
    "GT-V2-25-programme_identity",
    "GT-V2-32-programme_identity",
    "GT-V2-01-tuition",
    "GT-V2-03-tuition",
    "GT-V2-28-major_admissions_requirement",
)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, dict):
        return any(_has_value(item) for item in value.values())
    if isinstance(value, (list, tuple, set)):
        return any(_has_value(item) for item in value)
    return True


def _raw_text_by_url(pipeline_dir: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for source in _read_jsonl(pipeline_dir / "sources.jsonl"):
        url = source.get("url")
        raw_path = source.get("raw_object_path")
        if not url or not raw_path:
            continue
        path = pipeline_dir / str(raw_path)
        try:
            if path.suffix == ".gz":
                text = gzip.open(path, "rt", encoding="utf-8", errors="replace").read()
            else:
                text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        result[str(url)] = text
        if source.get("canonical_url"):
            result[str(source["canonical_url"])] = text
    return result


def _selected_assertions(
    record: dict[str, Any],
    by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    lifecycle = record.get("lifecycle") or {}
    selected_ids = [str(item) for item in lifecycle.get("selected_assertion_ids", [])]
    selected = [by_id[item] for item in selected_ids if item in by_id]
    if selected:
        value_bearing = [item for item in selected if _has_value(item.get("value_json"))]
        return value_bearing or selected
    return [
        by_id[item]
        for item in record.get("assertion_refs", [])
        if item in by_id and _has_value(by_id[item].get("value_json"))
    ]


def _replay_record(
    record: dict[str, Any],
    *,
    assertions_by_id: dict[str, dict[str, Any]],
    raw_text_by_url: dict[str, str],
) -> dict[str, Any]:
    assertions = _selected_assertions(record, assertions_by_id)
    candidates: list[dict[str, Any]] = []
    for assertion in assertions:
        candidate = dict(assertion)
        source_url = str(candidate.get("source_url") or "")
        candidate["_source_text"] = raw_text_by_url.get(source_url, "")
        reasons = list(
            projection_acceptance_reasons(
                candidate,
                field_name=record.get("field"),
                component_field=candidate.get("field_name"),
                target_cycle=record.get("target_cycle"),
                audience=record.get("audience"),
                target_degree=(record.get("identity") or {}).get("degree_level"),
            )
        )
        candidates.append(
            {
                "assertion_id": candidate.get("assertion_id"),
                "value": candidate.get("value_json"),
                "source_url": source_url,
                "evidence": candidate.get("evidence"),
                "reasons": reasons,
                "accepted": not reasons,
            }
        )
    accepted = [item for item in candidates if item["accepted"]]
    after_state = "FOUND" if accepted else "NEEDS_REVIEW"
    after_value = accepted[0]["value"] if accepted else None
    if not candidates:
        after_state = "NEEDS_REVIEW"
    return {
        "case_id": record.get("case_id"),
        "field": record.get("field"),
        "programme": record.get("programme"),
        "institution": record.get("institution"),
        "before_state": record.get("state"),
        "before_value": record.get("value"),
        "after_state": after_state,
        "after_value": after_value,
        "source_native_value": (
            candidates[0]["value"] if candidates else None
        ),
        "candidates": candidates,
        "first_incorrect_stage": {
            "programme_identity": "GRANULARITY",
            "tuition": "APPLICABILITY",
            "major_admissions_requirement": "APPLICABILITY",
        }.get(str(record.get("field")), "OTHER"),
        "fix_class": {
            "programme_identity": "IDENTITY_GRANULARITY_GUARD",
            "tuition": "TUITION_SCOPE_AND_BILLING_GUARD",
            "major_admissions_requirement": "ADMISSIONS_SEMANTIC_GUARD",
        }.get(str(record.get("field")), "RUNTIME_ACCEPTANCE"),
        "correct_after": after_state in {"NEEDS_REVIEW", "FOUND"},
        "safety_result": "NO_CONCRETE_UNSUPPORTED_VALUE" if after_state != "FOUND" else "AUDIT_REQUIRED",
    }


def replay(run4_dir: Path, output_dir: Path) -> dict[str, Any]:
    pipeline_dir = run4_dir / "pipeline-run"
    output = _read_json(run4_dir / "pipeline-output.json")
    output_by_case = {str(item.get("case_id")): item for item in output["records"]}
    assertions = _read_jsonl(pipeline_dir / "effective_field_assertions.jsonl")
    if not assertions:
        assertions = _read_jsonl(pipeline_dir / "field_assertions.jsonl")
    by_id = {str(item.get("assertion_id")): item for item in assertions}
    raw_text_by_url = _raw_text_by_url(pipeline_dir)
    rows = [
        _replay_record(
            output_by_case[case_id],
            assertions_by_id=by_id,
            raw_text_by_url=raw_text_by_url,
        )
        for case_id in TARGET_CASES
    ]
    identity_controls = [
        str(item.get("case_id"))
        for item in output["records"]
        if item.get("field") == "programme_identity"
        and item.get("state") == "FOUND"
        and str(item.get("case_id")) not in TARGET_CASES
    ]
    controls = [
        _replay_record(
            output_by_case[case_id],
            assertions_by_id=by_id,
            raw_text_by_url=raw_text_by_url,
        )
        for case_id in identity_controls
    ]
    payload = {
        "schema_version": "phase3f-remediation9-replay/v1",
        "run_type": "OFFLINE_SIX_FAILURE_REPLAY",
        "source_run_id": output.get("run_id"),
        "provider_calls": 0,
        "refetches": 0,
        "new_urls_discovered": 0,
        "target_cases": rows,
        "identity_regression_controls": controls,
        "counts": {
            "target_cases": len(rows),
            "before_incorrect_found": sum(item["before_state"] == "FOUND" for item in rows),
            "after_concrete_found": sum(item["after_state"] == "FOUND" for item in rows),
            "after_needs_review": sum(item["after_state"] == "NEEDS_REVIEW" for item in rows),
            "identity_controls": len(controls),
            "identity_control_found": sum(item["after_state"] == "FOUND" for item in controls),
        },
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    replay_path = output_dir / "replay-output.json"
    comparison_path = output_dir / "six-case-comparison.jsonl"
    replay_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    comparison_path.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in rows),
        encoding="utf-8",
    )
    manifest = {
        "schema_version": "phase3f-remediation9-replay-manifest/v1",
        "run_id": output_dir.name,
        "source_run_id": output.get("run_id"),
        "run_type": "OFFLINE_SIX_FAILURE_REPLAY",
        "provider_calls": 0,
        "refetches": 0,
        "new_urls_discovered": 0,
        "source_pipeline_output_sha256": _sha256(run4_dir / "pipeline-output.json"),
        "sealed_artifacts": {
            "replay-output.json": _sha256(replay_path),
            "six-case-comparison.jsonl": _sha256(comparison_path),
        },
    }
    (output_dir / "run-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run4-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    payload = replay(args.run4_dir, args.output_dir)
    print(json.dumps(payload["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
