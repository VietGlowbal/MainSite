"""Offline Remediation 12 replay against sealed Official Run #7 evidence.

The replay reprojects persisted Run #7 evidence with the current generic
conflict boundary and then scores the result with the frozen V3 scorer.  It
never invokes a provider, discovers a URL, refetches a document, or writes to
the sealed Run #7 directory.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RUN7_ID = "phase3f-v3-run-20260908T091444Z"
EXPECTED_RUN7_OUTPUT_SHA256 = (
    "e6b1018f08ce4c0a71ba28b4aa20fd76439a6326f6e9a3e008d83771d46dd3f9"
)
TRUTH_PATH = ROOT / "docs/benchmarks/2026-09-06-phase3f-ground-truth-v3-frozen.jsonl"
ROSTER_PATH = ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def load_runner() -> Any:
    path = ROOT / "scripts" / "run_phase3f_v3_benchmark.py"
    spec = importlib.util.spec_from_file_location("phase3f_v3_runner_rem12", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark runner: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _compact(value: Any, limit: int = 1000) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list, tuple)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    value = str(value)
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _truth_rows() -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (row["case_id"], row["field"]): row for row in read_jsonl(TRUTH_PATH)
    }


def _assertion_index(pipeline_dir: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in read_jsonl(pipeline_dir / "effective_field_assertions.jsonl"):
        if row.get("assertion_id"):
            result[str(row["assertion_id"])] = row
    return result


def _source_index(pipeline_dir: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in read_jsonl(pipeline_dir / "sources.jsonl"):
        for key in ("url", "canonical_url"):
            if row.get(key):
                result[str(row[key])] = row
    return result


def _crawl_errors(pipeline_dir: Path) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(pipeline_dir / "crawl_errors.jsonl"):
        if row.get("url"):
            result[str(row["url"])].append(row)
    return result


def _conflict_index(pipeline_dir: Path) -> dict[tuple[str, str], list[dict[str, Any]]]:
    result: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(pipeline_dir / "quality_conflicts.jsonl"):
        key = (str(row.get("entity_id") or ""), str(row.get("field") or ""))
        if all(key):
            result[key].append(row)
    return result


def _candidate_details(
    record: dict[str, Any],
    assertions: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    diagnostics = record.get("lifecycle", {}).get("candidate_diagnostics") or []
    rows: list[dict[str, Any]] = []
    for diagnostic in diagnostics:
        assertion = assertions.get(str(diagnostic.get("assertion_id")), {})
        rows.append(
            {
                "assertion_id": diagnostic.get("assertion_id"),
                "component_field": diagnostic.get("component_field"),
                "value_present": bool(diagnostic.get("value_present")),
                "accepted_for_runtime_found": bool(
                    diagnostic.get("accepted_for_runtime_found")
                ),
                "acceptance_reasons": list(diagnostic.get("acceptance_reasons") or []),
                "candidate_value": assertion.get("value_json"),
                "assertion_value": assertion.get("value_json"),
                "source_url": assertion.get("source_url"),
                "source_authority": assertion.get("source_authority"),
                "source_relationship": assertion.get("source_relationship"),
                "source_type": assertion.get("source_type"),
                "source_publication_date": assertion.get("published_at"),
                "academic_cycle": assertion.get("academic_cycle"),
                "intake": assertion.get("intake") or assertion.get("intake_name"),
                "audience": assertion.get("audience"),
                "scope": assertion.get("scope"),
                "applicability_state": assertion.get("applicability_state"),
                "temporal_state": assertion.get("temporal_state"),
                "evidence": _compact(assertion.get("evidence"), 1200),
                "applicability_evidence": _compact(
                    assertion.get("applicability_evidence"), 800
                ),
                "raw_document_id": assertion.get("raw_document_id"),
                "epistemic_state": assertion.get("epistemic_state"),
            }
        )
    selected = [
        row
        for row in rows
        if row["assertion_id"] in set(record.get("assertion_refs") or [])
    ]
    return rows, selected


def _material_conflict(
    conflict_rows: list[dict[str, Any]],
    assertion_index: dict[str, dict[str, Any]],
    runner: Any,
) -> bool:
    ids = [
        str(item)
        for row in conflict_rows
        for item in row.get("assertion_ids") or []
        if item
    ]
    ids = list(dict.fromkeys(ids))
    if not conflict_rows:
        return True
    if len(ids) < 2:
        return True
    items = [assertion_index.get(item) for item in ids]
    if any(item is None for item in items):
        return True
    return any(
        runner.assertions_overlap(left, right)
        for left, right in combinations(items, 2)
    )


def _classify_mismatch(
    before: dict[str, Any],
    *,
    assertion_index: dict[str, dict[str, Any]],
    conflict_rows: list[dict[str, Any]],
    runner: Any,
) -> tuple[str, str, str]:
    state = str(before.get("state") or "")
    if state == "CONFLICTING_SOURCES":
        if _material_conflict(conflict_rows, assertion_index, runner):
            return (
                "F",
                "TRUE_CONFLICT",
                "material same-dimension assertions remain unresolved",
            )
        return (
            "A",
            "CONFLICT_CLASSIFICATION",
            "tuition assertions differ by credential or billing basis; no same-fact contradiction",
        )
    if state == "ACCESS_BLOCKED":
        return (
            "C",
            "FETCH",
            "non-retryable access failure left no fetched field evidence",
        )
    if state == "EXTRACTION_FAILED":
        return (
            "E",
            "EXTRACTION",
            "source text was fetched but extraction produced no usable non-null assertion",
        )
    if state == "SOURCE_NOT_FOUND":
        return (
            "D",
            "SOURCE_SELECTION",
            "the selected URL failed while an official alternate source frontier was persisted",
        )
    if state == "NEEDS_REVIEW":
        return (
            "B",
            "ACCEPTANCE",
            "a candidate exists but the final state did not match the confirmed safe abstention",
        )
    return ("H", "OTHER", "unclassified mismatch")


def _build_matrix(
    *,
    truth: dict[tuple[str, str], dict[str, Any]],
    before_output: dict[str, Any],
    after_output: dict[str, Any],
    before_score: dict[str, Any],
    after_score: dict[str, Any],
    pipeline_dir: Path,
    runner: Any,
) -> list[dict[str, Any]]:
    before_records = {
        (row["case_id"], row["field"]): row
        for row in before_output.get("records", [])
    }
    after_records = {
        (row["case_id"], row["field"]): row
        for row in after_output.get("records", [])
    }
    before_cases = {
        row["case_id"]: row for row in before_score.get("cases", [])
    }
    after_cases = {row["case_id"]: row for row in after_score.get("cases", [])}
    assertions = _assertion_index(pipeline_dir)
    sources = _source_index(pipeline_dir)
    errors = _crawl_errors(pipeline_dir)
    conflicts = _conflict_index(pipeline_dir)
    rows: list[dict[str, Any]] = []
    confirmed = sorted(
        key
        for key, row in truth.items()
        if row.get("review_status") == "REVIEWED_CONFIRMED"
        and row.get("expected_state") == "NEEDS_REVIEW"
        and row.get("expected_value") is None
    )
    if len(confirmed) != 124:
        raise RuntimeError(f"expected 124 confirmed NEEDS_REVIEW/null rows, got {len(confirmed)}")
    for key in confirmed:
        expected = truth[key]
        before = before_records[key]
        after = after_records[key]
        before_case = before_cases[before["case_id"]]
        after_case = after_cases[after["case_id"]]
        diagnostics, selected = _candidate_details(before, assertions)
        source_refs = list(before.get("source_refs") or [])
        source_rows = [sources[url] for url in source_refs if url in sources]
        register = list(before.get("runtime_source_register") or [])
        register_rows = [sources[url] for url in register if url in sources]
        failure_rows = [error for url in source_refs for error in errors.get(url, [])]
        pipeline_errors = list((before.get("quality") or {}).get("pipeline_errors") or [])
        mismatch = before_case.get("outcome") != "SAFE_UNRESOLVED_PASS"
        if mismatch:
            root_class, stage, basis = _classify_mismatch(
                before,
                assertion_index=assertions,
                conflict_rows=conflicts.get(
                    (str(before.get("runtime_programme_id") or ""), before["field"]),
                    [],
                ),
                runner=runner,
            )
        else:
            root_class, stage, basis = None, None, "already safe-unresolved"
        rows.append(
            {
                "case_id": before["case_id"],
                "institution": expected.get("institution") or before.get("institution"),
                "programme": expected.get("programme") or before.get("programme"),
                "field": before["field"],
                "gt_expected_state": expected.get("expected_state"),
                "gt_expected_value": expected.get("expected_value"),
                "runtime_before": {
                    "state": before.get("state"),
                    "value": before.get("value"),
                    "scorer_outcome": before_case.get("outcome"),
                },
                "runtime_after": {
                    "state": after.get("state"),
                    "value": after.get("value"),
                    "scorer_outcome": after_case.get("outcome"),
                },
                "source_availability": {
                    "field_source_count": before.get("lifecycle", {}).get("source_count", 0),
                    "field_sources": [
                        {
                            "url": row.get("url"),
                            "status": row.get("http_status"),
                            "content_type": row.get("content_type"),
                            "authority": row.get("source_authority"),
                            "published_at": row.get("published_at"),
                            "text_length": row.get("text_length"),
                        }
                        for row in source_rows
                    ],
                    "configured_source_register": register,
                    "fetched_alternate_official_sources": [
                        row.get("url")
                        for row in register_rows
                        if row.get("http_status") == 200
                        and row.get("source_authority") == "OFFICIAL"
                    ],
                },
                "material_direct_evidence_status": (
                    "NON_NULL_ASSERTION"
                    if any(row["value_present"] for row in diagnostics)
                    else "FETCHED_SOURCE_ONLY"
                    if before.get("lifecycle", {}).get("source_count", 0)
                    else "NO_FETCHED_FIELD_SOURCE"
                ),
                "candidate_present": bool(diagnostics),
                "non_null_candidate_present": any(
                    row["value_present"] for row in diagnostics
                ),
                "assertion_present": bool(before.get("assertion_refs")),
                "non_null_assertion_present": bool(
                    before.get("lifecycle", {}).get("non_null_candidate_count", 0)
                ),
                "assertion_selection": {
                    "selected_assertion_ids": before.get("lifecycle", {}).get(
                        "selected_assertion_ids", []
                    ),
                    "selection_reason": before.get("lifecycle", {}).get(
                        "selection_reason"
                    ),
                    "selected_candidates": selected,
                },
                "acceptance_blockers": sorted(
                    {
                        reason
                        for row in diagnostics
                        for reason in row["acceptance_reasons"]
                    }
                ),
                "projection_blockers": list(before.get("blockers") or []),
                "crawl_fetch_errors": pipeline_errors + failure_rows,
                "extraction_errors": [
                    item
                    for item in pipeline_errors + failure_rows
                    if "EXTRACT" in str(item.get("code") or item.get("error_code"))
                    or "PROVIDER" in str(item.get("code") or item.get("error_code"))
                ],
                "conflict_state": conflicts.get(
                    (str(before.get("runtime_programme_id") or ""), before["field"]),
                    [],
                ),
                "first_divergent_stage": stage,
                "root_cause_class": root_class,
                "classification_basis": basis,
                "candidate_diagnostics": diagnostics,
            }
        )
    return rows


def run(args: argparse.Namespace) -> Path:
    runner = load_runner()
    run7_dir = args.run7_dir.resolve()
    sealed_path = run7_dir / "pipeline-output.json"
    if sha256(sealed_path) != EXPECTED_RUN7_OUTPUT_SHA256:
        raise RuntimeError("sealed Run #7 pipeline-output checksum mismatch")
    pipeline_dir = run7_dir / "pipeline-run"
    before_output = json.loads(sealed_path.read_text(encoding="utf-8"))
    rows, source_register = runner._parse_roster(ROSTER_PATH)
    after_output = runner._project_output(
        run_id="phase3f-remediation12-offline-replay",
        pipeline_dir=pipeline_dir,
        rows=rows,
        source_register=source_register,
        raw_evidence_mode="local",
    )
    after_output.update(
        {
            "benchmark_version": "phase3f-v3",
            "truth_version": "phase-3f-ground-truth-v3-frozen",
            "diagnostic_only": True,
            "sealed": True,
            "sealed_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    truth_rows = _truth_rows()
    scorer = __import__("glowbal_ingestion.benchmark_scorer", fromlist=["score_records"])
    before_score = scorer.score_records(list(truth_rows.values()), before_output)
    after_score = scorer.score_records(list(truth_rows.values()), after_output)
    replay_id = args.replay_id or (
        "phase3f-remediation12-offline-replay-"
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    output_dir = (args.output_root / replay_id).resolve()
    output_dir.mkdir(parents=True, exist_ok=False)
    replay_path = output_dir / "replay-output.json"
    replay_path.write_text(
        json.dumps(after_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    matrix = _build_matrix(
        truth=truth_rows,
        before_output=before_output,
        after_output=after_output,
        before_score=before_score,
        after_score=after_score,
        pipeline_dir=pipeline_dir,
        runner=runner,
    )
    (output_dir / "safe-unresolved-matrix.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in matrix) + "\n",
        encoding="utf-8",
    )
    mismatches = [row for row in matrix if row["root_cause_class"]]
    (output_dir / "safe-unresolved-mismatches.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in mismatches) + "\n",
        encoding="utf-8",
    )
    summary = {
        "run_id": replay_id,
        "source_run_id": RUN7_ID,
        "source_pipeline_output_sha256": EXPECTED_RUN7_OUTPUT_SHA256,
        "replay_output_sha256": sha256(replay_path),
        "provider_calls": 0,
        "refetch": 0,
        "new_urls": 0,
        "population_confirmed_needs_review_null": len(matrix),
        "before_safe_unresolved_correct": sum(
            row["runtime_before"]["scorer_outcome"] == "SAFE_UNRESOLVED_PASS"
            for row in matrix
        ),
        "after_safe_unresolved_correct": sum(
            row["runtime_after"]["scorer_outcome"] == "SAFE_UNRESOLVED_PASS"
            for row in matrix
        ),
        "before_mismatch_count": len(
            [row for row in matrix if row["runtime_before"]["scorer_outcome"] != "SAFE_UNRESOLVED_PASS"]
        ),
        "after_mismatch_count": len(
            [row for row in matrix if row["runtime_after"]["scorer_outcome"] != "SAFE_UNRESOLVED_PASS"]
        ),
        "root_cause_counts": dict(Counter(row["root_cause_class"] for row in mismatches)),
        "before_state_counts": dict(Counter(row["runtime_before"]["state"] for row in matrix)),
        "after_state_counts": dict(Counter(row["runtime_after"]["state"] for row in matrix)),
        "before_metrics": before_score.get("metrics", {}),
        "after_metrics": after_score.get("metrics", {}),
        "before_error_counts": before_score.get("error_counts", {}),
        "after_error_counts": after_score.get("error_counts", {}),
        "identity_incorrect_after": after_score.get("metrics", {}).get(
            "identity_merge_violations", 0
        ),
        "safety_counters_after": {
            "false_current_critical": after_score.get("metrics", {}).get(
                "false_current_critical_count", 0
            ),
            "fuzzy_only_identity_merge": after_score.get("metrics", {}).get(
                "identity_merge_violations", 0
            ),
            "unresolved_conflict_promoted": after_score.get("metrics", {}).get(
                "critical_unresolved_conflict_promoted_count", 0
            ),
            "SOURCE_NOT_FOUND_promoted": after_score.get("metrics", {}).get(
                "critical_source_not_found_promoted_count", 0
            ),
            "STALE_ONLY_promoted": after_score.get("metrics", {}).get(
                "critical_stale_only_promoted_count", 0
            ),
            "prohibited_inferred_critical_promoted": after_score.get(
                "metrics", {}
            ).get("prohibited_high_volatility_inferred_critical_promoted_count", 0),
            "PRODUCT_SAFE_without_provenance": after_score.get("metrics", {}).get(
                "product_safe_without_durable_provenance_count", 0
            ),
        },
    }
    (output_dir / "replay-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (output_dir / "before-score-result.json").write_text(
        json.dumps(before_score, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_dir / "after-score-result.json").write_text(
        json.dumps(after_score, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_dir / "run-manifest.json").write_text(
        json.dumps(
            {
                "run_id": replay_id,
                "diagnostic_only": True,
                "purpose": "Remediation 12 safe-unresolved and conflict-boundary replay",
                "source_run_id": RUN7_ID,
                "source_pipeline_output": str(sealed_path),
                "source_pipeline_output_sha256": EXPECTED_RUN7_OUTPUT_SHA256,
                "replay_output_sha256": summary["replay_output_sha256"],
                "provider_calls": 0,
                "refetch": 0,
                "new_urls": 0,
                "truth_loaded_after_projection": True,
                "code_revision": runner.git_value("rev-parse", "HEAD"),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"output_dir": str(output_dir), **summary}, ensure_ascii=False, indent=2))
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run7-dir", type=Path, required=True)
    parser.add_argument(
        "--output-root", type=Path, default=ROOT / "docs/benchmarks/remediation12"
    )
    parser.add_argument("--replay-id")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
