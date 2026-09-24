"""Offline Remediation 10 replay against sealed Official Run #5 evidence.

This tool never invokes the provider, discovers URLs, refetches documents, or
modifies the sealed Run #5 directory.  It reprojects the persisted pipeline
run with the current deterministic identity guards and writes separate,
diagnostic-only artifacts.
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
EXPECTED_RUN5_OUTPUT_SHA256 = (
    "df7814255d43e195fafe3c0e3271f0aee84d711b1fed10620500b864fb4f31d4"
)
DIRECT_EVIDENCE_AUDIT = (
    ROOT
    / "docs"
    / "benchmarks"
    / "runs"
    / "phase3f-v2-run-20260905T030109Z"
    / "run3-field-evidence-audit.jsonl"
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
    spec = importlib.util.spec_from_file_location("phase3f_v3_runner_rem10", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load runner: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def compact(value: Any, limit: int = 1200) -> Any:
    if isinstance(value, (dict, list, tuple)):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    else:
        text = "" if value is None else str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def first_failure_from_reasons(reasons: list[str]) -> tuple[str, str, bool, str]:
    if not reasons:
        return (
            "PROJECTION_SUPPRESSION",
            "PROJECTION_SUPPRESSION",
            False,
            "No candidate-level acceptance reason was persisted.",
        )
    if any(
        reason.startswith("VALIDATION_ERROR")
        or reason
        in {
            "SOURCE_EXCERPT_ONLY",
            "REJECTED_ASSERTION",
            "EVIDENCE_MISSING",
            "RAW_LINEAGE_MISSING",
            "INFERRED_VALUE",
            "TARGET_CYCLE_MISMATCH",
            "AUDIENCE_MISMATCH",
            "NOT_APPLICABLE",
            "NON_CURRENT_ASSERTION",
            "TUITION_NOT_STRUCTURED",
            "TUITION_SEMANTICS_NOT_IN_EVIDENCE",
            "TUITION_FEE_SCOPE_MISMATCH",
            "TUITION_FEE_TYPE_MISMATCH",
            "ADMISSION_STAGE_MISMATCH",
            "ADMISSIONS_COMPONENT_UNSUPPORTED",
            "LANGUAGE_FIELD_SEMANTICS_MISMATCH",
            "RECOMMENDED_NOT_MINIMUM",
        }
        for reason in reasons
    ):
        return (
            "VALID_SAFETY_BLOCK",
            "VALID_SAFETY_BLOCK",
            True,
            "The persisted candidate lacks a required semantic, lineage, cycle, "
            "audience, or field-type guarantee.",
        )
    if any(
        reason
        in {
            "PROGRAMME_SCOPE_UNPROVEN",
            "PROGRAMME_ADMISSION_SCOPE_UNPROVEN",
            "TUITION_DEGREE_SCOPE_UNPROVEN",
        }
        for reason in reasons
    ):
        return (
            "MISSING_APPLICABILITY_PROOF",
            "MISSING_APPLICABILITY_PROOF",
            True,
            "The assertion scope does not establish applicability to the target "
            "programme or admission context.",
        )
    if "APPLICABILITY_EVIDENCE_FIELD_MISMATCH" in reasons:
        return (
            "VALID_SAFETY_BLOCK",
            "VALID_SAFETY_BLOCK",
            True,
            "Applicability evidence is for a different field or semantic scope.",
        )
    if any(
        reason in {"TEMPORAL_SCOPE_UNPROVEN", "TEMPORAL_HISTORICAL", "TEMPORAL_FUTURE"}
        for reason in reasons
    ):
        return (
            "MISSING_TEMPORAL_PROOF",
            "MISSING_TEMPORAL_PROOF",
            True,
            "The assertion has no sufficient current/target-cycle proof.",
        )
    if any(reason.startswith("CONFLICT") for reason in reasons):
        return (
            "FALSE_CONFLICT",
            "FALSE_CONFLICT",
            False,
            "Conflict requires a scope-aware review; no automatic relaxation is made.",
        )
    if any("SELECTION" in reason for reason in reasons):
        return (
            "ASSERTION_SELECTION",
            "ASSERTION_SELECTION",
            False,
            "The candidate was not visible after assertion selection.",
        )
    return (
        "OTHER_QUALITY_POLICY",
        "OTHER_QUALITY_POLICY",
        True,
        "The candidate remains blocked by the current deterministic policy.",
    )


def acceptance_matrix(
    *,
    sealed_output: dict[str, Any],
    assertions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    audit_rows = read_jsonl(DIRECT_EVIDENCE_AUDIT)
    direct_keys = {
        (row["case_id"], row["field"])
        for row in audit_rows
        if row.get("evidence_availability") == "EVIDENCE_FETCHED_DIRECT"
    }
    records = {
        (record["case_id"], record["field"]): record
        for record in sealed_output.get("records", [])
    }
    assertion_by_id = {
        str(assertion["assertion_id"]): assertion
        for assertion in assertions
        if assertion.get("assertion_id")
    }
    matrix: list[dict[str, Any]] = []
    for key in sorted(direct_keys):
        record = records.get(key)
        if not record or record.get("state") != "NEEDS_REVIEW":
            continue
        diagnostics = [
            item
            for item in record.get("lifecycle", {}).get("candidate_diagnostics", [])
            if item.get("value_present")
        ]
        if not diagnostics:
            continue
        for diagnostic in diagnostics:
            assertion = assertion_by_id.get(str(diagnostic.get("assertion_id")), {})
            reasons = [str(item) for item in diagnostic.get("acceptance_reasons", [])]
            first_reason, blocker_class, justified, basis = first_failure_from_reasons(reasons)
            matrix.append(
                {
                    "case_id": record["case_id"],
                    "field": record["field"],
                    "source": assertion.get("source_url") or record.get("source_refs", [None])[0],
                    "authority": assertion.get("source_authority"),
                    "evidence_text": compact(assertion.get("evidence"), 500),
                    "candidate_value": compact(assertion.get("value_json"), 600),
                    "assertion_type": diagnostic.get("component_field")
                    or assertion.get("extraction_group"),
                    "temporal_applicability": {
                        "state": assertion.get("temporal_state"),
                        "academic_cycle": assertion.get("academic_cycle"),
                        "target_cycle": record.get("target_cycle"),
                    },
                    "programme_applicability": {
                        "scope": assertion.get("scope"),
                        "state": assertion.get("applicability_state"),
                        "evidence": compact(assertion.get("applicability_evidence"), 300),
                    },
                    "authority_status": {
                        "source_authority": assertion.get("source_authority"),
                        "source_relationship": assertion.get("source_relationship"),
                        "source_type": assertion.get("source_type"),
                    },
                    "acceptance_blockers": reasons,
                    "projection_blockers": record.get("blockers")
                    or record.get("lifecycle", {}).get("quality_blockers", []),
                    "final_state": record.get("state"),
                    "first_blocking_reason": first_reason,
                    "blocker_class": blocker_class,
                    "blocker_justified": justified,
                    "justification_basis": basis,
                }
            )
    return matrix


def run(args: argparse.Namespace) -> Path:
    runner = load_runner()
    run5_dir = args.run5_dir.resolve()
    sealed_path = run5_dir / "pipeline-output.json"
    pipeline_dir = run5_dir / "pipeline-run"
    if sha256(sealed_path) != EXPECTED_RUN5_OUTPUT_SHA256:
        raise RuntimeError("sealed Run #5 pipeline output checksum mismatch")
    sealed_output = json.loads(sealed_path.read_text(encoding="utf-8"))
    rows, source_register = runner._parse_roster(ROSTER_PATH)
    replay_output = runner._project_output(
        run_id="phase3f-remediation10-offline-replay",
        pipeline_dir=pipeline_dir,
        rows=rows,
        source_register=source_register,
        raw_evidence_mode="local",
    )
    replay_output["benchmark_version"] = "phase3f-v3"
    replay_output["truth_version"] = "phase-3f-ground-truth-v3-frozen"
    replay_output["diagnostic_only"] = True
    replay_output["sealed"] = True
    replay_output["sealed_at"] = datetime.now(timezone.utc).isoformat()

    truth = read_jsonl(TRUTH_PATH)
    score_module = __import__("glowbal_ingestion.benchmark_scorer", fromlist=["score_records"])
    score = score_module.score_records(truth, replay_output)
    replay_id = args.replay_id or (
        "phase3f-remediation10-offline-replay-"
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    output_dir = (args.output_root / replay_id).resolve()
    output_dir.mkdir(parents=True, exist_ok=False)
    replay_path = output_dir / "replay-output.json"
    replay_path.write_text(
        json.dumps(replay_output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    replay_digest = sha256(replay_path)
    (output_dir / "score-result.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    sealed_records = {
        (record["case_id"], record["field"]): record
        for record in sealed_output.get("records", [])
    }
    replay_records = {
        (record["case_id"], record["field"]): record
        for record in replay_output.get("records", [])
    }
    score_cases = {item["case_id"]: item for item in score.get("cases", [])}
    identity_rows: list[dict[str, Any]] = []
    for case_id in sorted(TARGET_IDENTITY_CASES):
        key = (case_id, "programme_identity")
        before = sealed_records[key]
        after = replay_records[key]
        scored = score_cases.get(case_id, {})
        identity_rows.append(
            {
                "case_id": case_id,
                "field": "programme_identity",
                "before_state": before.get("state"),
                "before_value": before.get("value"),
                "after_state": after.get("state"),
                "after_value": after.get("value"),
                "after_identity": after.get("identity"),
                "scorer_outcome_after": scored.get("outcome"),
                "scorer_comparison_class_after": scored.get("comparison_class"),
                "correct_after": scored.get("outcome") == "PASS",
                "first_incorrect_stage": {
                    "GT-V2-22-programme_identity": "STRUCTURED_IDENTITY_PARSE",
                    "GT-V2-23-programme_identity": "STRUCTURED_IDENTITY_PARSE",
                    "GT-V2-25-programme_identity": "ENTITY_TYPE",
                    "GT-V2-33-programme_identity": "PARENT_CHILD_RELATION",
                    "GT-V2-34-programme_identity": "APPLICABILITY",
                }[case_id],
                "fix_class": "GENERIC_IDENTITY_GRANULARITY_AND_APPLICABILITY",
            }
        )

    controls = [
        record
        for key, record in sealed_records.items()
        if key[1] == "programme_identity"
        and record.get("state") == "FOUND"
        and key[0] not in TARGET_IDENTITY_CASES
    ]
    control_rows = []
    for before in sorted(controls, key=lambda item: item["case_id"]):
        after = replay_records[(before["case_id"], "programme_identity")]
        scored = score_cases.get(before["case_id"], {})
        control_rows.append(
            {
                "case_id": before["case_id"],
                "before_state": before.get("state"),
                "after_state": after.get("state"),
                "before_value": before.get("value"),
                "after_value": after.get("value"),
                "scorer_outcome_after": scored.get("outcome"),
                "no_regression": scored.get("outcome") == "PASS",
            }
        )

    safety_ids = sorted(REMEDIATION_4_CASES | ORIGINAL_P0_CASES)
    safety_rows = []
    for case_id in safety_ids:
        for field in (
            "programme_identity",
            "credential",
            "tuition",
            "application_deadline",
            "english_requirement",
            "major_admissions_requirement",
        ):
            record = replay_records.get((case_id, field))
            if record:
                safety_rows.append(
                    {
                        "case_id": case_id,
                        "field": field,
                        "state": record.get("state"),
                        "value": record.get("value"),
                        "concrete_emission": record.get("state") == "FOUND"
                        and record.get("value") not in (None, ""),
                    }
                )

    assertion_path = pipeline_dir / "effective_field_assertions.jsonl"
    assertions = read_jsonl(assertion_path)
    matrix = acceptance_matrix(sealed_output=sealed_output, assertions=assertions)
    (output_dir / "rem10-acceptance-loss-matrix.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in matrix) + "\n",
        encoding="utf-8",
    )
    (output_dir / "identity-five-case-comparison.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in identity_rows) + "\n",
        encoding="utf-8",
    )
    (output_dir / "identity-control-comparison.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in control_rows) + "\n",
        encoding="utf-8",
    )
    (output_dir / "safety-control-audit.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in safety_rows) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "run_id": replay_id,
        "diagnostic_only": True,
        "purpose": "Remediation 10 offline replay; no provider or refetch",
        "source_run": "phase3f-v3-run-20260907T145934Z",
        "source_pipeline_output": str(sealed_path),
        "source_pipeline_output_sha256": EXPECTED_RUN5_OUTPUT_SHA256,
        "replay_output_sha256": replay_digest,
        "code_revision": runner.git_value("rev-parse", "HEAD"),
        "provider_calls": 0,
        "refetch": 0,
        "new_urls": 0,
        "direct_acceptance_matrix_rows": len(matrix),
        "identity_target_cases": len(identity_rows),
        "identity_control_cases": len(control_rows),
        "identity_control_no_regression": all(
            row["no_regression"] for row in control_rows
        ),
        "remediation4_and_original_p0_control_rows": len(safety_rows),
        "score_metrics": score.get("metrics", {}),
        "score_errors": score.get("error_counts", {}),
        "identity_target_results": identity_rows,
        "acceptance_blocker_counts": dict(
            Counter(row["blocker_class"] for row in matrix)
        ),
    }
    (output_dir / "run-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run5-dir", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=ROOT / "docs" / "benchmarks" / "runs")
    parser.add_argument("--replay-id")
    args = parser.parse_args()
    print(run(args))


if __name__ == "__main__":
    main()
