"""Run the existing H1-H4 engine against the frozen refresh assertions.

This script is research-only. It does not alter the inference engine or
promotion rail and writes deterministic summaries under the refresh artifact.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "services" / "data-ingestion" / "src"))

from glowbal_ingestion.hierarchical_inference import HierarchicalInferenceEngine
from glowbal_ingestion.models import FieldAssertion


ROOT = Path(__file__).resolve().parent
RUN = ROOT / "runs" / "field-bearing-refresh-20260912"
OUT = ROOT / "analysis"


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def present(row: dict) -> bool:
    return row.get("value_json") not in (None, "", [], {}) and row.get("null_reason") is None


def targets() -> tuple[list[dict], list[dict]]:
    programmes = read_jsonl(RUN / "programmes.jsonl")
    offerings = read_jsonl(RUN / "programme_offerings.jsonl")
    by_programme = {}
    for offering in offerings:
        by_programme.setdefault(offering.get("programme_id"), offering)
    merged = []
    for programme in programmes:
        row = dict(programme)
        offer = by_programme.get(programme.get("programme_id"), {})
        for key in ("academic_cycle", "audience", "campus", "delivery_mode"):
            if offer.get(key) not in (None, ""):
                row[key] = offer[key]
        merged.append(row)
    return merged, read_jsonl(RUN / "institutions.jsonl")


def evaluate(label: str, assertion_rows: list[dict], programmes: list[dict], institutions: list[dict]) -> dict:
    engine = HierarchicalInferenceEngine()
    assertions = [FieldAssertion(**row) for row in assertion_rows if present(row)]
    fields = sorted({row.field_name for row in assertions})
    by_field = {}
    for field in fields:
        result = engine.evaluate_population(
            programmes,
            field=field,
            assertions=assertions,
            programmes=programmes,
            institutions=institutions,
            recovery_exhausted=True,
        )
        decisions = result["decisions"]
        levels = Counter(decision["level"] for decision in decisions if not decision["abstained"])
        reasons = Counter(decision["reason"] for decision in decisions)
        non_direct = [decision for decision in decisions if decision["reason"] != "DIRECT_TARGET_AVAILABLE"]
        by_field[field] = {
            "target_count": result["target_count"],
            "direct_count": sum(decision["reason"] == "DIRECT_TARGET_AVAILABLE" for decision in decisions),
            "direct_coverage": result["direct_coverage"],
            "activated_by_level": dict(levels),
            "abstention_count": result["abstention_count"],
            "abstention_rate": result["abstention_rate"],
            "missing_target_activated": sum(
                not decision["abstained"] for decision in non_direct
            ),
            "missing_target_abstentions": sum(
                decision["abstained"] for decision in non_direct
            ),
            "support_counts": result["support_counts"],
            "mean_support_count": result["mean_support_count"],
            "donor_dispersion": result["donor_dispersion"],
            "uncertainty_by_level": result["uncertainty_by_level"],
            "conflict_rate": result["conflict_rate"],
            "reasons": dict(reasons),
            "decisions": decisions,
        }
    return {
        "assertion_count": len(assertions),
        "field_count": len(fields),
        "fields": by_field,
    }


def main() -> None:
    programmes, institutions = targets()
    all_rows = read_jsonl(RUN / "effective_field_assertions.jsonl")
    accepted_rows = [
        row
        for row in all_rows
        if present(row)
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    ]
    result = {
        "schema": "FieldBearingRefreshHierarchicalEvaluation/v1",
        "run_id": "field-bearing-refresh-20260912",
        "target_count": len(programmes),
        "institution_count": len(institutions),
        "accepted_only": evaluate("accepted_only", accepted_rows, programmes, institutions),
        "all_non_rejected": evaluate(
            "all_non_rejected",
            [row for row in all_rows if present(row) and row.get("verification_status") != "REJECTED"],
            programmes,
            institutions,
        ),
        "notes": [
            "The accepted-only view is the conservative semantic input; all_non_rejected is an observability comparison and includes NEEDS_REVIEW rows.",
            "No organisation_units.jsonl was retained in this run, so H1 requires verified parent-unit records and is expected to abstain.",
            "No peer verified attributes were supplied by the run, so H4 remains gated by the existing engine.",
            "No accuracy/calibration claim is made because this run does not contain an independent held-out truth set.",
        ],
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "hierarchical-evaluation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
