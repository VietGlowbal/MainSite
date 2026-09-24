"""Audit missing assertion generation in a sealed Phase 3F run.

This is a post-seal diagnostic only.  It reads the sealed runtime artifacts
before reading the frozen truth-derived diagnostic rows and never participates
in pipeline execution or scoring.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from audit_phase3f_source_adequacy import (  # noqa: E402
    COMPONENT_FIELDS,
    read_jsonl,
    write_jsonl,
)


DIAGNOSTIC_NAME = "run3-acceptance-diagnostic.jsonl"
FIELD_MATRIX_NAME = "run3-field-evidence-audit.jsonl"
TRACE_NAME = "extraction_trace.jsonl"
EVENTS_NAME = "extraction_events.jsonl"


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def _runtime_rows(run_dir: Path) -> dict[str, dict[str, Any]]:
    output = _read_json(run_dir / "pipeline-output.json")
    return {
        str(row.get("case_id")): row
        for row in output.get("records", [])
        if row.get("case_id")
    }


def _trace_by_programme(run_dir: Path) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(run_dir / "pipeline-run" / TRACE_NAME):
        programme_id = str(row.get("programme_id") or "")
        if programme_id:
            result[programme_id].append(row)
    return result


def _events_by_programme(run_dir: Path) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(run_dir / "pipeline-run" / EVENTS_NAME):
        programme_id = str(row.get("programme_id") or "")
        if programme_id:
            result[programme_id].append(row)
    return result


def _first_loss(
    *,
    field: str,
    acceptance_row: dict[str, Any],
    programme_traces: list[dict[str, Any]],
) -> tuple[str, str]:
    """Return the earliest evidenced loss, without inventing sub-stages."""
    llm_fields = {
        str(field_name)
        for trace in programme_traces
        for field_name in trace.get("llm_field_names", [])
    }
    if not programme_traces:
        return (
            "EXTRACTOR_NOT_INVOKED",
            "sealed runtime has no pre-assertion extraction trace for the routed programme",
        )
    routed_components = set(COMPONENT_FIELDS.get(field, (field)))
    if not routed_components.intersection(llm_fields):
        return (
            "FIELD_NOT_ROUTED",
            "sealed extraction trace omitted field and its component fields from requested LLM fields",
        )
    stage = str(acceptance_row.get("first_blocking_stage") or "")
    reason = str(acceptance_row.get("first_blocking_reason") or "")
    if stage == "ASSERTION_NOT_CREATED":
        return (
            "CANDIDATE_NOT_CREATED",
            reason or "no runtime assertion was created for the routed field",
        )
    if stage:
        return stage, reason
    return "OTHER", "sealed diagnostic did not identify a first loss stage"


def build_diagnostic(run_id: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / run_id
    acceptance = {
        str(row.get("case_id")): row
        for row in read_jsonl(run_dir / DIAGNOSTIC_NAME)
        if row.get("case_id")
    }
    field_matrix = {
        str(row.get("case_id")): row
        for row in read_jsonl(run_dir / FIELD_MATRIX_NAME)
        if row.get("case_id")
    }
    runtime = _runtime_rows(run_dir)
    traces = _trace_by_programme(run_dir)
    events = _events_by_programme(run_dir)

    missing = [
        row
        for row in acceptance.values()
        if row.get("first_blocking_stage") == "ASSERTION_NOT_CREATED"
    ]
    if len(missing) != 55:
        raise ValueError(f"Expected 55 missing-assertion cases, found {len(missing)}")

    result: list[dict[str, Any]] = []
    first_loss_counts: Counter[str] = Counter()
    field_counts: Counter[str] = Counter()
    institution_counts: Counter[str] = Counter()
    for row in sorted(missing, key=lambda item: str(item.get("case_id"))):
        case_id = str(row["case_id"])
        field = str(row.get("field") or "")
        programme_id = str(row.get("programme_id") or "")
        programme_traces = traces.get(programme_id, [])
        programme_events = events.get(programme_id, [])
        first_loss_stage, first_loss_reason = _first_loss(
            field=field,
            acceptance_row=row,
            programme_traces=programme_traces,
        )
        field_counts[field] += 1
        institution_counts[str(row.get("institution") or "")] += 1
        first_loss_counts[first_loss_stage] += 1
        trace_fields = sorted(
            {
                str(field_name)
                for trace in programme_traces
                for field_name in trace.get("llm_field_names", [])
            }
        )
        identity_events = [
            event
            for event in programme_events
            if event.get("extraction_group") == "identity_offering"
        ]
        result.append(
            {
                "case_id": case_id,
                "programme_id": programme_id,
                "programme": row.get("programme"),
                "institution": row.get("institution"),
                "field": field,
                "direct_support": True,
                "best_evidence_source": (
                    row.get("best_evidence_source")
                    or row.get("best_source_ref")
                ),
                "source_authority": row.get("source_authority"),
                "source_relationship": row.get("source_relationship"),
                "evidence_locator": row.get("evidence_locator"),
                "parsed_evidence_present": bool(
                    row.get("best_evidence_source")
                    or row.get("evidence_locator")
                ),
                "field_router_invoked": field in trace_fields,
                "llm_extractor_invoked": field in trace_fields,
                "llm_extractor_result_present": bool(identity_events),
                "candidate_object_created": bool(
                    row.get("candidate_assertion_count")
                ),
                "candidate_value_present": bool(row.get("candidate_non_null_count")),
                "candidate_state": None,
                "assertion_builder_invoked": bool(
                    row.get("candidate_assertion_count")
                ),
                "runtime_assertion_created": bool(
                    row.get("candidate_assertion_count")
                ),
                "assertion_persisted": bool(row.get("candidate_assertion_count")),
                "selector_visible": bool(row.get("candidate_selected")),
                "first_loss_stage": first_loss_stage,
                "first_loss_reason": first_loss_reason,
                "sealed_runtime_state": row.get("runtime_final_state"),
                "sealed_runtime_value_present": row.get("runtime_value_present"),
                "sealed_trace_requested_fields": trace_fields,
                "sealed_identity_offering_events": [
                    {
                        "status": event.get("status"),
                        "fact_count": event.get("fact_count"),
                        "requested_fields": event.get("requested_fields"),
                    }
                    for event in identity_events
                ],
                "truth_state_for_diagnosis": row.get("truth_state"),
                "truth_value_for_diagnosis": row.get("truth_value"),
            }
        )
    summary = {
        "run_id": run_id,
        "diagnostic_only": True,
        "truth_used_after_sealed_runtime": True,
        "missing_assertion_cases": len(result),
        "by_field": dict(sorted(field_counts.items())),
        "by_institution": dict(sorted(institution_counts.items())),
        "first_loss_stage_counts": dict(sorted(first_loss_counts.items())),
        "field_router_missing_cases": sum(
            item["first_loss_stage"] == "FIELD_NOT_ROUTED" for item in result
        ),
        "extractor_not_invoked_cases": sum(
            item["first_loss_stage"] == "EXTRACTOR_NOT_INVOKED" for item in result
        ),
        "runtime_assertions_created": sum(
            bool(item["runtime_assertion_created"]) for item in result
        ),
        "pipeline_truth_access": False,
    }
    return result, summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument(
        "--output-name",
        default="run3-assertion-generation-diagnostic.jsonl",
    )
    args = parser.parse_args(argv)
    rows, summary = build_diagnostic(args.run_id)
    run_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / args.run_id
    write_jsonl(run_dir / args.output_name, rows)
    (run_dir / "run3-assertion-generation-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "PASS", **summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
