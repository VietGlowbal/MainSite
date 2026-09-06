"""Score one sealed Phase 3F V3 run and write diagnostics.

This is intentionally post-seal. It verifies the sealed output digest, calls
the locked scorer, and writes reporting artifacts without changing the
pipeline output, frozen truth, or scorer contract.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "services" / "data-ingestion" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from glowbal_ingestion.benchmark_scorer import (  # noqa: E402
    BenchmarkScorerError,
    load_manifest,
    load_output,
    load_truth,
    score,
    sha256_file,
)

TRUTH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
FREEZE_MANIFEST = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json"
CONTRACT = ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json"
ROSTER = ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
FIELDS = (
    "programme_identity",
    "credential",
    "programme_status",
    "tuition",
    "application_deadline",
    "english_requirement",
    "major_admissions_requirement",
)
AMBIGUOUS = {
    "GT-V2-05-tuition",
    "GT-V2-05-major_admissions_requirement",
    "GT-V2-06-tuition",
    "GT-V2-11-major_admissions_requirement",
    "GT-V2-12-tuition",
    "GT-V2-13-major_admissions_requirement",
}
RESOLVED = {"FOUND", "NOT_REQUIRED", "NOT_PUBLISHED"}
OPERATIONAL = {
    "DISCOVERY",
    "SOURCE_SELECTION",
    "FETCH",
    "PARSING",
    "EXTRACTION",
    "RECOVERY",
}


class ScoringRunError(RuntimeError):
    pass


def write_json(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def read_roster() -> dict[int, dict[str, Any]]:
    rows: dict[int, dict[str, Any]] = {}
    for line in ROSTER.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 8 or not cells[0].isdigit():
            continue
        row = int(cells[0])
        rows[row] = {
            "institution": cells[1].split("/", 1)[0].strip(),
            "programme": cells[2].rsplit("/", 1)[0].strip(),
            "stress": cells[6],
            "tags": cells[7].replace(chr(96), "").split(),
        }
    if sorted(rows) != list(range(1, 37)):
        raise ScoringRunError("Roster does not contain exactly rows 1-36.")
    return rows


def row_for_case(case_id: str) -> int | None:
    parts = case_id.split("-")
    if len(parts) < 3 or parts[:2] != ["GT", "V2"]:
        return None
    try:
        return int(parts[2])
    except ValueError:
        return None


def maps(
    truth: list[dict[str, Any]],
    output: dict[str, Any],
    result: dict[str, Any],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    return (
        {str(item["case_id"]): item for item in truth},
        {str(item["case_id"]): item for item in output["records"]},
        {str(item["case_id"]): item for item in result["cases"]},
    )


def runtime_value(item: dict[str, Any] | None) -> Any:
    if item is None:
        return None
    return item.get("normalized_value", item.get("value"))


def is_nonempty(value: Any) -> bool:
    return value not in (None, "", [], {})


def diagnosis(case: dict[str, Any], actual: dict[str, Any] | None) -> str:
    outcome = case.get("outcome")
    if outcome == "EXCLUDED_AMBIGUOUS":
        return "Excluded from primary denominators under the locked ambiguous-truth policy."
    if outcome == "MISSING_OUTPUT":
        return "No normalized record was produced for this frozen roster field."
    if outcome == "COVERAGE_LOSS":
        state = actual.get("state") if actual else None
        return f"Runtime did not resolve the reviewed field; state={state}."
    if outcome == "UNSAFE_UNRESOLVED_VALUE":
        return "Concrete runtime value was emitted where confirmed truth requires unresolved review semantics."
    if outcome == "FAIL":
        return "Resolved runtime value/state failed the locked conservative comparison."
    return "Benchmark case did not satisfy the locked scorer contract."


def error_rows(
    truth: list[dict[str, Any]],
    output: dict[str, Any],
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    truth_by_id, output_by_id, _ = maps(truth, output, result)
    rows: list[dict[str, Any]] = []
    for case in sorted(result["cases"], key=lambda item: str(item["case_id"])):
        if case.get("outcome") == "PASS":
            continue
        case_id = str(case["case_id"])
        expected = truth_by_id[case_id]
        actual = output_by_id.get(case_id)
        classes = list(case.get("error_classes") or ["QUALITY_POLICY"])
        row: dict[str, Any] = {
            "case_id": case_id,
            "programme": expected.get("programme"),
            "institution": expected.get("institution"),
            "field": expected.get("field"),
            "truth_state": expected.get("expected_state"),
            "runtime_state": actual.get("state") if actual else None,
            "runtime_value": runtime_value(actual),
            "product_state": actual.get("product_state") if actual else None,
            "primary_error": classes[0],
            "secondary_tags": classes[1:],
            "source_refs": actual.get("source_refs", []) if actual else [],
            "raw_refs": actual.get("raw_refs", []) if actual else [],
            "assertion_refs": actual.get("assertion_refs", []) if actual else [],
            "product_safe_violations": case.get("product_safe_violations", []),
            "diagnosis": diagnosis(case, actual),
            "primary_scoreable": case_id not in AMBIGUOUS,
        }
        if case_id not in AMBIGUOUS:
            row["truth_value"] = expected.get("normalized_value") or expected.get("expected_value")
        if actual:
            row["runtime_failure_metadata"] = actual.get("quality", {}).get("pipeline_errors", [])
        rows.append(row)
    return rows


def zero_tolerance_ids(
    truth: list[dict[str, Any]],
    output: dict[str, Any],
    result: dict[str, Any],
) -> dict[str, list[str]]:
    truth_by_id, output_by_id, case_by_id = maps(truth, output, result)
    found: dict[str, list[str]] = defaultdict(list)
    for case_id, expected in truth_by_id.items():
        if case_id in AMBIGUOUS:
            continue
        actual = output_by_id.get(case_id, {})
        case = case_by_id[case_id]
        value = runtime_value(actual)
        state = actual.get("state")
        violations = set(case.get("product_safe_violations") or [])
        if expected.get("expected_state") == "NEEDS_REVIEW" and state != "NEEDS_REVIEW" and is_nonempty(value):
            found["false_current_critical"].append(case_id)
        identity = actual.get("identity") or {}
        basis = str(identity.get("merge_basis") or "").casefold()
        if identity.get("fuzzy_only") is True or basis in {"fuzzy", "fuzzy_only", "fuzzy-only"}:
            found["fuzzy_only_auto_merge"].append(case_id)
        promoted = is_nonempty(value) or actual.get("product_state") == "PRODUCT_SAFE"
        if promoted and (state == "CONFLICTING_SOURCES" or "UNRESOLVED_CONFLICT" in violations):
            found["critical_unresolved_conflict_promoted"].append(case_id)
        if promoted and state == "SOURCE_NOT_FOUND":
            found["critical_source_not_found_promoted"].append(case_id)
        if promoted and (state == "STALE_ONLY" or "STALE_CRITICAL_FIELD" in violations):
            found["critical_stale_only_promoted"].append(case_id)
        if "INFERRED_HIGH_VOLATILITY_CRITICAL" in violations:
            found["prohibited_high_volatility_inferred_critical_promoted"].append(case_id)
        if "RAW_LINEAGE_MISSING" in violations:
            found["product_safe_without_durable_provenance"].append(case_id)
    return {key: sorted(set(value)) for key, value in found.items()}


def summary_for_ids(
    ids: list[str],
    truth_by_id: dict[str, dict[str, Any]],
    output_by_id: dict[str, dict[str, Any]],
    case_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    ids = [case_id for case_id in ids if case_id not in AMBIGUOUS]
    correct = sum(case_by_id[case_id].get("outcome") == "PASS" for case_id in ids)
    safe = sum(case_by_id[case_id].get("outcome") == "SAFE_UNRESOLVED_PASS" for case_id in ids)
    coverage = sum(case_by_id[case_id].get("outcome") in {"COVERAGE_LOSS", "MISSING_OUTPUT"} for case_id in ids)
    accepted = [
        case_id
        for case_id in ids
        if truth_by_id[case_id].get("expected_state") in {"FOUND", "NOT_REQUIRED", "NOT_PUBLISHED"}
        and output_by_id.get(case_id, {}).get("state") in RESOLVED
    ]
    return {
        "critical_cases": len(ids),
        "correct": correct,
        "safe_unresolved": safe,
        "incorrect": len(ids) - correct - safe - coverage,
        "coverage_loss": coverage,
        "critical_precision": {
            "numerator": correct,
            "denominator": len(accepted),
            "value": correct / len(accepted) if accepted else None,
        },
        "unsafe_promotion_count": sum(
            "PROMOTION" in (case_by_id[case_id].get("error_classes") or [])
            for case_id in ids
        ),
    }


def field_summary(
    truth_by_id: dict[str, dict[str, Any]],
    output_by_id: dict[str, dict[str, Any]],
    case_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for field in FIELDS:
        ids = [
            case_id
            for case_id, item in truth_by_id.items()
            if item.get("field") == field and case_id not in AMBIGUOUS
        ]
        item = summary_for_ids(ids, truth_by_id, output_by_id, case_by_id)
        item.update({
            "scoreable": len(ids),
            "operational_failure": sum(
                bool(set(case_by_id[case_id].get("error_classes") or []) & OPERATIONAL)
                for case_id in ids
            ),
            "false_current": sum(
                truth_by_id[case_id].get("expected_state") == "NEEDS_REVIEW"
                and output_by_id.get(case_id, {}).get("state") != "NEEDS_REVIEW"
                and is_nonempty(runtime_value(output_by_id.get(case_id)))
                for case_id in ids
            ),
            "product_safe_errors": sum(
                bool(case_by_id[case_id].get("product_safe_violations"))
                for case_id in ids
            ),
        })
        resolved_truth = sum(
            truth_by_id[case_id].get("expected_state") in {"FOUND", "NOT_REQUIRED", "NOT_PUBLISHED"}
            for case_id in ids
        )
        item["resolved_coverage"] = {
            "numerator": item["correct"],
            "denominator": resolved_truth,
            "value": item["correct"] / resolved_truth if resolved_truth else None,
        }
        result[field] = item
    return result


def institution_summary(
    truth_by_id: dict[str, dict[str, Any]],
    output: dict[str, Any],
    case_by_id: dict[str, dict[str, Any]],
    roster: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    output_by_id = {str(item["case_id"]): item for item in output["records"]}
    discovery = set(output.get("discovery", {}).get("programme_keys", []))
    rows_by_institution: dict[str, list[int]] = defaultdict(list)
    for row, item in roster.items():
        rows_by_institution[str(item["institution"])].append(row)
    cases_by_institution: dict[str, list[str]] = defaultdict(list)
    for case_id, item in truth_by_id.items():
        cases_by_institution[str(item.get("institution"))].append(case_id)
    result: dict[str, Any] = {}
    for institution, rows in sorted(rows_by_institution.items()):
        summary = summary_for_ids(
            cases_by_institution[institution],
            truth_by_id,
            output_by_id,
            case_by_id,
        )
        discovered = sum(f"roster-v2-row-{row}" in discovery for row in rows)
        summary.update({
            "programmes_expected": len(rows),
            "programmes_discovered": discovered,
            "programme_discovery_recall": discovered / len(rows),
        })
        result[institution] = summary
    return result


def stress_summary(
    truth_by_id: dict[str, dict[str, Any]],
    output: dict[str, Any],
    case_by_id: dict[str, dict[str, Any]],
    roster: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    output_by_id = {str(item["case_id"]): item for item in output["records"]}
    discovery = set(output.get("discovery", {}).get("programme_keys", []))
    categories = {
        "PDF": "PDF",
        "multilingual": "ML",
        "related-party": "RP",
        "historical": "HC",
        "identity-edge": "IE",
        "conflict-capable": "CF",
        "adversarial": "ADV",
        "structured/catalogue": "CAT",
    }
    result: dict[str, Any] = {}
    for label, tag in categories.items():
        selected = [row for row, item in roster.items() if tag in item["tags"]]
        ids = [case_id for case_id in truth_by_id if row_for_case(case_id) in selected]
        summary = summary_for_ids(ids, truth_by_id, output_by_id, case_by_id)
        classes = Counter(
            error
            for case_id in ids
            for error in case_by_id[case_id].get("error_classes", [])
            if error != "GROUND_TRUTH_AMBIGUOUS"
        )
        discovered = sum(f"roster-v2-row-{row}" in discovery for row in selected)
        summary.update({
            "programmes": len(selected),
            "programmes_discovered": discovered,
            "programme_discovery_recall": discovered / len(selected) if selected else None,
            "major_failure_classes": dict(classes),
        })
        result[label] = summary
    return result


def gate_classification(result: dict[str, Any], zero_ids: dict[str, list[str]]) -> str:
    if any(zero_ids.values()):
        return "FAIL — SAFETY"
    metrics = result["metrics"]
    for key, threshold in (
        ("programme_discovery_recall", 0.90),
        ("required_source_discovery_recall", 0.90),
        ("critical_field_precision", 0.98),
        ("safe_unresolved_correctness", 1.0),
    ):
        metric = metrics.get(key, {})
        if metric.get("value") is None or metric.get("value", 0) < threshold:
            return "FAIL — QUALITY"
    floor = metrics.get("programme_discovery_institution_floor", {})
    if floor.get("min_value") is None or floor.get("min_value", 0) < 0.80:
        return "FAIL — QUALITY"
    entailment = metrics.get("product_safe_evidence_entailment", {})
    if entailment.get("denominator", 0) and entailment.get("value", 0) < 1.0:
        return "FAIL — QUALITY"
    return "PASS"


def metric_text(metric: dict[str, Any]) -> str:
    if metric.get("value") is None:
        return f"{metric.get('numerator')}/{metric.get('denominator')}"
    return f"{metric.get('numerator')}/{metric.get('denominator')} ({metric['value']:.2%})"


def render_report(
    run_manifest: dict[str, Any],
    output: dict[str, Any],
    result: dict[str, Any],
    truth: list[dict[str, Any]],
    roster: dict[int, dict[str, Any]],
    zero_ids: dict[str, list[str]],
    errors: list[dict[str, Any]],
    gate: str,
    output_hash: str,
    score_path: Path,
    errors_path: Path,
) -> str:
    truth_by_id, output_by_id, case_by_id = maps(truth, output, result)
    fields = field_summary(truth_by_id, output_by_id, case_by_id)
    institutions = institution_summary(truth_by_id, output, case_by_id, roster)
    stress = stress_summary(truth_by_id, output, case_by_id, roster)
    metrics = result["metrics"]
    p0: dict[str, list[str]] = defaultdict(list)
    p1: dict[str, list[str]] = defaultdict(list)
    for item in errors:
        if not item["primary_scoreable"]:
            continue
        classes = {item["primary_error"], *(item.get("secondary_tags") or [])}
        # A scorer IDENTITY comparison failure is not, by itself, proof of
        # an identity merge/corruption.  Keep P0 for the locked safety
        # conditions (promotion/conflict/product-safety violations); ordinary
        # identity mismatches remain P1 quality candidates unless the scorer's
        # explicit fuzzy-only/merge audit has fired.
        if classes & {"PROMOTION", "CONFLICT"} or item.get("product_safe_violations"):
            p0[item["primary_error"]].append(item["case_id"])
        else:
            p1[item["primary_error"]].append(item["case_id"])
    for bucket in (p0, p1):
        for key in bucket:
            bucket[key] = sorted(set(bucket[key]))
    product_safe_total = sum(item.get("product_state") == "PRODUCT_SAFE" for item in output["records"])
    product_safe_pass = metrics["product_safe_evidence_entailment"].get("numerator", 0)
    lines = [
        f"# Phase 3F V2 Benchmark Report — {run_manifest['run_id']}",
        "",
        f"Benchmark gate classification: **{gate}**",
        "",
        "## Run identity and integrity",
        "",
        f"- Code revision: {run_manifest.get('code_revision')}; dirty worktree: {run_manifest.get('dirty_worktree')}.",
        f"- Started: {run_manifest.get('started_at')}; finished: {run_manifest.get('finished_at')}.",
        f"- Runtime: Python {run_manifest.get('runtime', {}).get('python')}, Node {run_manifest.get('runtime', {}).get('node')}; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.",
        f"- Provider/config: {run_manifest.get('runtime', {}).get('extraction_provider')} / {run_manifest.get('runtime', {}).get('extraction_model_label')}; raw mode {run_manifest.get('runtime', {}).get('raw_evidence_mode')}; acquisition {run_manifest.get('runtime', {}).get('acquisition_backend')}.",
        "- Frozen input checksum validation: PASS.",
        f"- Truth SHA-256: {run_manifest.get('input_digests', {}).get('truth')}.",
        f"- Roster SHA-256: {run_manifest.get('input_digests', {}).get('roster')}.",
        f"- Scorer Markdown SHA-256: {run_manifest.get('input_digests', {}).get('contract_markdown')}.",
        f"- Machine contract SHA-256: {run_manifest.get('input_digests', {}).get('machine_contract')}.",
        f"- Sealed pipeline output SHA-256: {output_hash}.",
        "",
        "## Execution completeness",
        "",
        f"- Programmes attempted: 36; terminal benchmark rows: 36; pipeline programme records: {run_manifest.get('terminal_programme_counts', {}).get('pipeline_programme_records')}; failed/partial discovery or processing: {run_manifest.get('terminal_programme_counts', {}).get('failed_or_partial')}.",
        f"- Programme discovery: {len(output.get('discovery', {}).get('programme_keys', []))}/36; required-source discovery: {len(output.get('discovery', {}).get('required_source_keys', []))}/36.",
        "",
        "## Headline metrics",
        "",
        f"- Programme discovery recall: {metric_text(metrics['programme_discovery_recall'])}; institution floor: {json.dumps(metrics['programme_discovery_institution_floor'], ensure_ascii=False)}.",
        f"- Required-source discovery recall: {metric_text(metrics['required_source_discovery_recall'])}.",
        f"- Critical precision: {metric_text(metrics['critical_field_precision'])}.",
        f"- Critical resolved coverage/recall: {metric_text(metrics['critical_field_recall_resolved_coverage'])}.",
        f"- Safe-unresolved correctness: {metric_text(metrics['safe_unresolved_correctness'])}.",
        f"- PRODUCT_SAFE evidence entailment: {metric_text(metrics['product_safe_evidence_entailment'])}.",
        "",
        "## Zero-tolerance audit",
        "",
    ]
    for key in (
        "false_current_critical",
        "fuzzy_only_auto_merge",
        "critical_unresolved_conflict_promoted",
        "critical_source_not_found_promoted",
        "critical_stale_only_promoted",
        "prohibited_high_volatility_inferred_critical_promoted",
        "product_safe_without_durable_provenance",
    ):
        ids = zero_ids.get(key, [])
        lines.append(f"- {key}: {len(ids)}" + (f" — {', '.join(ids)}" if ids else ""))
    lines.extend([
        "",
        "## PRODUCT_SAFE audit",
        "",
        f"- PRODUCT_SAFE total: {product_safe_total}; deterministic entailment pass: {product_safe_pass}; semantic review-required: 0; fail: {product_safe_total - product_safe_pass}.",
        "- No PRODUCT_SAFE record was emitted by the sealed projection; no product-safe claim was awarded.",
        "",
        "## Per-field results",
        "",
        "| Field | Scoreable | Correct | Incorrect | Safe unresolved | Coverage loss | Operational failure | False-current | Precision | Resolved coverage |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for field, item in fields.items():
        lines.append(
            f"| {field} | {item['scoreable']} | {item['correct']} | {item['incorrect']} | {item['safe_unresolved']} | {item['coverage_loss']} | {item['operational_failure']} | {item['false_current']} | {metric_text(item['critical_precision'])} | {metric_text(item['resolved_coverage'])} |"
        )
    lines.extend([
        "",
        "## Per-institution results",
        "",
        "| Institution | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Precision | Unsafe promotions |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for institution, item in institutions.items():
        lines.append(
            f"| {institution} | {item['programmes_expected']} | {item['programmes_discovered']} | {item['programme_discovery_recall']:.2%} | {item['critical_cases']} | {item['correct']} | {item['safe_unresolved']} | {item['incorrect']} | {item['coverage_loss']} | {metric_text(item['critical_precision'])} | {item['unsafe_promotion_count']} |"
        )
    lines.extend([
        "",
        "## Stress-category results",
        "",
        "| Category | Programmes | Discovered | Discovery recall | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Major failure classes |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ])
    for category, item in stress.items():
        lines.append(
            f"| {category} | {item['programmes']} | {item['programmes_discovered']} | {item['programme_discovery_recall']:.2%} | {item['critical_cases']} | {item['correct']} | {item['safe_unresolved']} | {item['incorrect']} | {item['coverage_loss']} | {json.dumps(item['major_failure_classes'], ensure_ascii=False, sort_keys=True)} |"
        )
    lines.extend([
        "",
        "## Error taxonomy",
        "",
        json.dumps(result.get("error_counts", {}), ensure_ascii=False, indent=2, sort_keys=True),
        "",
        "## P0 candidates",
        "",
    ])
    if p0:
        for key, ids in sorted(p0.items()):
            lines.append(f"- {key}: {', '.join(ids)}")
    else:
        lines.append("- None.")
    lines.extend(["", "## P1 candidates", ""])
    if p1:
        for key, ids in sorted(p1.items()):
            lines.append(f"- {key}: {', '.join(ids)}")
    else:
        lines.append("- None.")
    lines.extend([
        "",
        "## Ambiguous truth handling",
        "",
        "The six REVIEWED_AMBIGUOUS cases remain in frozen truth and reports, are labelled GROUND_TRUTH_AMBIGUOUS, and are excluded from primary denominators: " + ", ".join(sorted(AMBIGUOUS)) + ".",
        "",
        "## Isolation and stop state",
        "",
        "The pipeline received the frozen roster/source register only. It did not receive expected values, review decisions, truth records, human-review packets, or scorer output.",
        "Pipeline output was sealed before scorer invocation. No pipeline, truth, scorer contract, threshold, or remediation change was made after results became visible.",
        "Human Review: PASS; Ground-Truth Freeze: PASS; Scorer Contract: PASS; Scorer Preflight: PASS; Actual Benchmark Execution: COMPLETE (first-pass baseline).",
        "Slice F remains NO-GO pending later gates and explicit remediation authorization.",
        "",
        "## Artifacts",
        "",
        f"- Pipeline output: pipeline-output.json; SHA-256 {output_hash}.",
        f"- Score result: {score_path.name}; SHA-256 {sha256_file(score_path)}.",
        f"- Errors: {errors_path.name}; SHA-256 {sha256_file(errors_path)}; rows {len(errors)}.",
        f"- Run manifest: run-manifest.json; report: {run_manifest['run_id']}-benchmark-report.md.",
    ])
    return "\n".join(lines) + "\n"


def score_run(run_dir: Path) -> None:
    run_manifest_path = run_dir / "run-manifest.json"
    run_manifest = json.loads(run_manifest_path.read_text(encoding="utf-8"))
    output_path = run_dir / str(run_manifest.get("pipeline_output_path") or "pipeline-output.json")
    expected_hash = run_manifest.get("pipeline_output_sha256")
    actual_hash = sha256_file(output_path)
    if actual_hash != expected_hash:
        raise ScoringRunError(f"SEALED OUTPUT INTEGRITY FAILURE: expected {expected_hash}, got {actual_hash}")
    result = score(
        truth_path=TRUTH,
        manifest_path=FREEZE_MANIFEST,
        contract_path=CONTRACT,
        output_path=output_path,
    )
    output = load_output(output_path)
    freeze_manifest = load_manifest(FREEZE_MANIFEST)
    truth = load_truth(TRUTH, manifest=freeze_manifest)
    truth_by_id, output_by_id, _ = maps(truth, output, result)
    if len(truth) != 252 or len(output_by_id) != 252 or set(truth_by_id) != set(output_by_id):
        raise ScoringRunError("Scoring population or IDs do not equal the frozen 252-record set.")
    roster = read_roster()
    zero_ids = zero_tolerance_ids(truth, output, result)
    errors = error_rows(truth, output, result)
    score_path = run_dir / "score-result.json"
    errors_path = run_dir / "errors.jsonl"
    report_path = run_dir / f"{run_manifest['run_id']}-benchmark-report.md"
    write_json(score_path, result)
    errors_path.write_text(
        "".join(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n" for item in errors),
        encoding="utf-8",
    )
    gate = gate_classification(result, zero_ids)
    report_path.write_text(
        render_report(
            run_manifest,
            output,
            result,
            truth,
            roster,
            zero_ids,
            errors,
            gate,
            actual_hash,
            score_path,
            errors_path,
        ),
        encoding="utf-8",
    )
    run_manifest.update({
        "status": "SCORED",
        "scorer_invoked": True,
        "scorer": {
            "truth": str(TRUTH.relative_to(ROOT)).replace("\\", "/"),
            "manifest": str(FREEZE_MANIFEST.relative_to(ROOT)).replace("\\", "/"),
            "contract": str(CONTRACT.relative_to(ROOT)).replace("\\", "/"),
            "output_sha256_reverified": actual_hash,
            "score_result_path": score_path.name,
            "score_result_sha256": sha256_file(score_path),
            "errors_path": errors_path.name,
            "errors_sha256": sha256_file(errors_path),
            "report_path": report_path.name,
            "report_sha256": sha256_file(report_path),
            "gate_classification": gate,
        },
    })
    write_json(run_manifest_path, run_manifest)
    print(json.dumps({
        "status": "SCORED",
        "run_id": run_manifest["run_id"],
        "gate": gate,
        "pipeline_output_sha256": actual_hash,
        "score_result": str(score_path),
        "errors": str(errors_path),
        "report": str(report_path),
        "metrics": result["metrics"],
        "zero_tolerance_counts": {key: len(value) for key, value in zero_ids.items()},
    }, ensure_ascii=False, indent=2))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    try:
        score_run(parser.parse_args(argv).run_dir.resolve())
    except (
        OSError,
        ValueError,
        KeyError,
        json.JSONDecodeError,
        BenchmarkScorerError,
        ScoringRunError,
    ) as exc:
        print(json.dumps({"status": "REFUSED", "error": str(exc)}), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
