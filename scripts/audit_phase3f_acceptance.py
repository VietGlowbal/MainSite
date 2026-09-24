"""Post-seal acceptance trace for the official Phase 3F V3 run.

The tool reads the sealed runtime artifacts first and then reads frozen truth
only for diagnosis.  It never participates in pipeline execution and does not
change the scorer, frozen truth, or sealed benchmark output.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.runtime_acceptance import projection_acceptance_reasons  # noqa: E402

from audit_phase3f_source_adequacy import (  # noqa: E402
    COMPONENT_FIELDS,
    canonical,
    has_value,
    parse_roster,
    read_json,
    read_jsonl,
    write_jsonl,
)


TRUTH_PATH = REPO_ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
ROSTER_PATH = REPO_ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
MATRIX_NAME = "run3-field-evidence-audit.jsonl"


def _text(value: Any) -> str:
    return str(value or "").strip().casefold()


def _truth_rows() -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in TRUTH_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _assertions_by_entity(pipeline_dir: Path) -> dict[str, dict[str, list[dict[str, Any]]]]:
    source = pipeline_dir / "effective_field_assertions.jsonl"
    assertions = read_jsonl(source)
    if not assertions:
        assertions = read_jsonl(pipeline_dir / "field_assertions.jsonl")
    result: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for assertion in assertions:
        entity_id = str(assertion.get("entity_id") or "")
        field = str(assertion.get("field_name") or "")
        if entity_id and field:
            result[entity_id][field].append(assertion)
    return result


def _output_index(run_dir: Path) -> dict[str, dict[str, Any]]:
    output = read_json(run_dir / "pipeline-output.json")
    return {str(record.get("case_id")): record for record in output.get("records", [])}


def _runtime_programme_index(run_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        str(record.get("programme_id")): record
        for record in read_jsonl(run_dir / "pipeline-run" / "programmes.jsonl")
        if record.get("programme_id")
    }


def _candidate_records(
    entity_assertions: dict[str, list[dict[str, Any]]],
    field: str,
) -> list[dict[str, Any]]:
    return [
        assertion
        for component in COMPONENT_FIELDS.get(field, (field,))
        for assertion in entity_assertions.get(component, [])
    ]


def _diagnostics(
    output_record: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    lifecycle = output_record.get("lifecycle") or {}
    by_id = {
        str(item.get("assertion_id")): item
        for item in lifecycle.get("candidate_diagnostics", [])
        if item.get("assertion_id")
    }
    target_cycle = output_record.get("target_cycle")
    audience = output_record.get("audience")
    degree = (output_record.get("identity") or {}).get("degree_level")
    result: list[dict[str, Any]] = []
    for assertion in candidates:
        assertion_id = str(assertion.get("assertion_id") or "")
        existing = by_id.get(assertion_id)
        if existing is not None:
            result.append(existing)
            continue
        reasons = list(
            projection_acceptance_reasons(
                assertion,
                field_name=output_record.get("field"),
                component_field=assertion.get("field_name"),
                target_cycle=target_cycle,
                audience=audience,
                target_degree=degree,
            )
        )
        result.append(
            {
                "assertion_id": assertion.get("assertion_id"),
                "component_field": assertion.get("field_name"),
                "value_present": has_value(assertion.get("value_json")),
                "accepted_for_runtime_found": bool(
                    has_value(assertion.get("value_json")) and not reasons
                ),
                "acceptance_reasons": reasons,
            }
        )
    return result


def _reason_bucket(reason: str) -> str:
    upper = reason.upper()
    # Check temporal markers before the generic ``SCOPE`` marker: reasons
    # such as TEMPORAL_SCOPE_UNPROVEN are temporal, not applicability.
    if any(marker in upper for marker in ("TEMPORAL", "CYCLE", "CURRENT", "STALE")):
        return "TEMPORAL"
    if any(
        marker in upper
        for marker in (
            "SCOPE",
            "AUDIENCE",
            "APPLICABILITY",
            "SEMANTICS",
            "ADMISSION_STAGE",
            "DEADLINE_TYPE",
            "LANGUAGE_FIELD",
            "RECOMMENDED",
            "TUITION_",
            "NOT_APPLICABLE",
        )
    ):
        return "FIELD_SEMANTICS_OR_APPLICABILITY"
    if "CONFLICT" in upper:
        return "CONFLICT"
    if upper in {"SOURCE_EXCERPT_ONLY", "EVIDENCE_MISSING", "RAW_LINEAGE_MISSING"}:
        return "QUALITY_HARD_BLOCKER"
    if upper.startswith("VALIDATION_ERROR") or upper in {
        "REJECTED_ASSERTION",
        "INFERRED_VALUE",
    }:
        return "QUALITY_HARD_BLOCKER"
    if upper in {"NO_VALUE"}:
        return "ASSERTION_VALUE_MISSING"
    return "OTHER"


def _blocker_class(blocker: str) -> str:
    upper = blocker.upper()
    if upper in {
        "UNRESOLVED_CONFLICT",
        "STALE_CRITICAL_FIELD",
        "INFERRED_HIGH_VOLATILITY_CRITICAL",
    }:
        return "HARD_RUNTIME"
    if upper in {
        "IDENTITY_UNRESOLVED",
        "REVIEW_REQUIRED",
        "RAW_LINEAGE_MISSING",
        "INSUFFICIENT_AUTHORITY",
        "MISSING_CRITICAL_FIELD",
    }:
        return "SOFT_PRODUCT"
    if upper in {"CANONICAL_PROMOTION_BLOCKED", "PROMOTION_BLOCKED"}:
        return "PROMOTION_ONLY"
    return "HARD_RUNTIME"


def _first_blocking_stage(
    *,
    output_record: dict[str, Any],
    candidates: list[dict[str, Any]],
    diagnostics: list[dict[str, Any]],
) -> tuple[str, str]:
    lifecycle = output_record.get("lifecycle") or {}
    non_null = [
        (candidate, diagnostic)
        for candidate, diagnostic in zip(candidates, diagnostics)
        if diagnostic.get("value_present")
    ]
    if not candidates:
        return "ASSERTION_NOT_CREATED", "direct evidence had no runtime field assertion"
    if not non_null:
        return "ASSERTION_VALUE_MISSING", "runtime assertions were created without a value"
    selected_ids = {str(item) for item in lifecycle.get("selected_assertion_ids", [])}
    selected = [
        (candidate, diagnostic)
        for candidate, diagnostic in non_null
        if str(candidate.get("assertion_id")) in selected_ids
    ]
    if not selected:
        return "ASSERTION_NOT_SELECTED", "non-null candidates were discarded before selection"
    state = str(output_record.get("state") or "")
    if state == "CONFLICTING_SOURCES" or "UNRESOLVED_CONFLICT" in set(output_record.get("blockers") or []):
        # This label is intentionally based on the sealed output.  The
        # entity-scoping regression test proves that a conflict for another
        # programme must not reach this branch.
        return "CONFLICT", "runtime projection retained a material unresolved conflict"
    reasons = [reason for _, diagnostic in selected for reason in diagnostic.get("acceptance_reasons", [])]
    if reasons:
        bucket_counts = Counter(_reason_bucket(reason) for reason in reasons)
        bucket = bucket_counts.most_common(1)[0][0]
        return bucket, "; ".join(sorted(set(reasons)))[:800]
    if state != "FOUND" or output_record.get("value") is None:
        blockers = output_record.get("blockers") or []
        if blockers:
            classes = Counter(_blocker_class(str(item)) for item in blockers)
            return classes.most_common(1)[0][0], "; ".join(str(item) for item in blockers)
        return "OTHER", "candidate passed deterministic acceptance but was not projected FOUND"
    return "FOUND", "candidate reached runtime FOUND"


def _stage_disposition(
    output_record: dict[str, Any],
    candidates: list[dict[str, Any]],
    diagnostics: list[dict[str, Any]],
) -> dict[str, bool]:
    lifecycle = output_record.get("lifecycle") or {}
    non_null = [item for item in diagnostics if item.get("value_present")]
    selected_ids = {str(item) for item in lifecycle.get("selected_assertion_ids", [])}
    selected = [
        item for item in non_null if str(item.get("assertion_id")) in selected_ids
    ]
    accepted = [item for item in selected if not item.get("acceptance_reasons")]
    reasons = [reason for item in selected for reason in item.get("acceptance_reasons", [])]
    applicability_reasons = {
        "FIELD_SEMANTICS_OR_APPLICABILITY",
    }
    temporal_reasons = {"TEMPORAL"}
    conflict = str(output_record.get("state")) == "CONFLICTING_SOURCES" or "UNRESOLVED_CONFLICT" in set(output_record.get("blockers") or [])
    return {
        "direct_support": True,
        "candidate_assertion_created": bool(candidates),
        "candidate_value_non_null": bool(non_null),
        "candidate_selected": bool(selected),
        "applicability_pass": bool(selected) and not any(_reason_bucket(reason) in applicability_reasons for reason in reasons),
        "temporal_pass": bool(selected) and not any(_reason_bucket(reason) in temporal_reasons for reason in reasons),
        "conflict_pass": not conflict,
        "quality_acceptance_pass": bool(accepted) and not conflict,
        "found": str(output_record.get("state")) == "FOUND" and has_value(output_record.get("value")),
    }


def build_audit(run_id: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / run_id
    pipeline_dir = run_dir / "pipeline-run"
    output_by_case = _output_index(run_dir)
    programme_index = _runtime_programme_index(run_dir)
    assertions = _assertions_by_entity(pipeline_dir)
    adequacy_rows = {
        str(row.get("case_id")): row
        for row in read_jsonl(run_dir / MATRIX_NAME)
    }
    truth = {
        str(row.get("case_id")): row
        for row in _truth_rows()
        if row.get("review_status") == "REVIEWED_CONFIRMED"
        and row.get("expected_state") in {"FOUND", "NOT_REQUIRED"}
    }
    direct = [
        row for row in adequacy_rows.values()
        if row.get("evidence_availability") == "EVIDENCE_FETCHED_DIRECT"
    ]
    if len(direct) != 83:
        raise ValueError(f"Expected 83 direct-support cases, found {len(direct)}")
    result: list[dict[str, Any]] = []
    stage_counts: dict[str, Counter[str]] = defaultdict(Counter)
    blocker_counts: Counter[str] = Counter()
    blocker_classes: Counter[str] = Counter()
    for adequacy in sorted(direct, key=lambda item: str(item.get("case_id"))):
        case_id = str(adequacy["case_id"])
        output_record = output_by_case.get(case_id, {})
        programme_id = str(output_record.get("runtime_programme_id") or adequacy.get("programme_id") or "")
        field = str(adequacy.get("field") or "")
        candidates = _candidate_records(assertions.get(programme_id, {}), field)
        diagnostics = _diagnostics(output_record, candidates)
        lifecycle = output_record.get("lifecycle") or {}
        first_stage, first_reason = _first_blocking_stage(
            output_record=output_record,
            candidates=candidates,
            diagnostics=diagnostics,
        )
        stages = _stage_disposition(output_record, candidates, diagnostics)
        for stage, passed in stages.items():
            stage_counts[stage]["entered"] += 1
            stage_counts[stage]["passed"] += int(passed)
            stage_counts[stage]["failed"] += int(not passed)
        for diagnostic in diagnostics:
            if diagnostic.get("value_present"):
                for reason in diagnostic.get("acceptance_reasons", []):
                    blocker_counts[reason] += 1
                    blocker_classes[_reason_bucket(reason)] += 1
        for blocker in output_record.get("blockers") or []:
            blocker_classes[_blocker_class(str(blocker))] += 1
        best_source = adequacy.get("best_source_ref")
        candidate_sources = adequacy.get("fetched_candidate_source_refs") or []
        best_assertion = next(
            (
                candidate for candidate in candidates
                if candidate.get("source_url") and canonical(str(candidate.get("source_url"))) == canonical(str(best_source or ""))
            ),
            candidates[0] if candidates else {},
        )
        result.append(
            {
                "case_id": case_id,
                "programme_id": programme_id,
                "programme": adequacy.get("programme"),
                "institution": adequacy.get("institution"),
                "field": field,
                "resolved_truth_case": True,
                "truth_state": truth.get(case_id, {}).get("expected_state"),
                "truth_value": truth.get(case_id, {}).get("expected_value"),
                "best_evidence_source": best_source,
                "fetched_candidate_sources": candidate_sources,
                "source_authority": adequacy.get("authority") or best_assertion.get("source_authority"),
                "source_relationship": adequacy.get("source_relationship") or best_assertion.get("source_relationship"),
                "source_family": adequacy.get("source_family"),
                "evidence_locator": adequacy.get("evidence_locator") or best_assertion.get("evidence_locator") or best_assertion.get("evidence"),
                "candidate_assertion_exists": bool(candidates),
                "candidate_assertion_count": len(candidates),
                "candidate_non_null_count": sum(int(has_value(item.get("value_json"))) for item in candidates),
                "candidate_selected": stages["candidate_selected"],
                "selected_assertion_ids": lifecycle.get("selected_assertion_ids", []),
                "candidate_diagnostics": diagnostics,
                "programme_applicability": [item.get("applicability_state") for item in candidates if item.get("applicability_state")],
                "audience_applicability": [item.get("audience") for item in candidates if item.get("audience")],
                "temporal_applicability": [item.get("temporal_state") for item in candidates if item.get("temporal_state")],
                "conflict_status": output_record.get("quality", {}).get("conflict_state") or ("UNRESOLVED" if "UNRESOLVED_CONFLICT" in set(output_record.get("blockers") or []) else "NONE"),
                "quality_blockers": output_record.get("blockers", []),
                "quality_blocker_classes": sorted({_blocker_class(str(item)) for item in output_record.get("blockers", [])}),
                "runtime_acceptance_result": "FOUND" if stages["found"] else "SUPPRESSED",
                "runtime_final_state": output_record.get("state"),
                "runtime_value_present": has_value(output_record.get("value")),
                "first_blocking_stage": first_stage,
                "first_blocking_reason": first_reason,
                "stage_disposition": stages,
            }
        )
    summary = {
        "run_id": run_id,
        "direct_support_cases": len(result),
        "stage_counts": {stage: dict(counts) for stage, counts in sorted(stage_counts.items())},
        "first_blocking_stage_counts": dict(Counter(item["first_blocking_stage"] for item in result)),
        "acceptance_reason_counts": dict(blocker_counts),
        "blocker_class_counts": dict(blocker_classes),
        "found_cases": [item["case_id"] for item in result if item["runtime_acceptance_result"] == "FOUND"],
        "ambiguous_evidence_cases": [
            row.get("case_id") for row in adequacy_rows.values()
            if row.get("evidence_availability") == "EVIDENCE_FETCHED_BUT_AMBIGUOUS"
        ],
        "upstream_cases": [
            row.get("case_id") for row in adequacy_rows.values()
            if row.get("upstream_or_downstream") == "UPSTREAM_EVIDENCE_GAP"
        ],
        "hard_soft_promotion_policy": {
            "HARD_RUNTIME": [
                "wrong scope/audience/cycle/field semantics",
                "stale-only claim",
                "material same-scope conflict",
                "unsupported inference",
            ],
            "SOFT_PRODUCT": [
                "identity unresolved for Product Safety",
                "review required for publication",
                "missing durable raw lineage",
                "insufficient authority for Product Safety",
            ],
            "PROMOTION_ONLY": [
                "canonical promotion blocked while a supported runtime value remains FOUND",
            ],
        },
        "pipeline_truth_access": False,
        "programme_records": len(programme_index),
    }
    return result, summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-name", default="run3-acceptance-diagnostic.jsonl")
    args = parser.parse_args(argv)
    rows, summary = build_audit(args.run_id)
    run_dir = REPO_ROOT / "docs" / "benchmarks" / "runs" / args.run_id
    write_jsonl(run_dir / args.output_name, rows)
    (run_dir / "run3-acceptance-stage-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "PASS", "run_id": args.run_id, **summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
