"""Run the existing H1-H4 engine over the external scale run.

Only accepted OBSERVED external semantic assertions are supplied; the frozen
hierarchy implementation is imported unchanged.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[4] / "services" / "data-ingestion" / "src"))

from glowbal_ingestion.hierarchical_inference import HierarchicalInferenceEngine
from glowbal_ingestion.models import FieldAssertion


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def accepted(row: dict) -> bool:
    return (
        row.get("value_json") not in (None, "", [], {})
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def evaluate(run: Path) -> dict:
    programmes = read_jsonl(run / "programmes.jsonl")
    institutions = read_jsonl(run / "institutions.jsonl")
    source = read_jsonl(run / "effective_field_assertions.jsonl") or read_jsonl(run / "field_assertions.jsonl")
    deduped: dict[str, dict] = {}
    for row in source:
        if row.get("provider_id") and accepted(row):
            deduped[str(row["assertion_id"])] = row
    assertions = [FieldAssertion(**row) for row in deduped.values()]
    engine = HierarchicalInferenceEngine()
    output: dict[str, object] = {}
    for field in sorted({assertion.field_name for assertion in assertions}):
        evaluated = engine.evaluate_population(
            programmes,
            field=field,
            assertions=assertions,
            programmes=programmes,
            institutions=institutions,
            recovery_exhausted=True,
        )
        decisions = evaluated["decisions"]
        reasons = Counter(decision["reason"] for decision in decisions)
        levels = Counter(decision["level"] for decision in decisions if not decision["abstained"])
        candidates = Counter()
        for decision in decisions:
            for candidate in decision.get("candidates", []):
                if candidate.get("level"):
                    candidates[candidate["level"]] += 1
            for rejected in decision.get("rejected", []):
                if rejected.get("level"):
                    candidates[rejected["level"]] += 1
        output[field] = {
            "target_count": evaluated["target_count"],
            "direct_candidates": sum(decision["reason"] == "DIRECT_TARGET_AVAILABLE" for decision in decisions),
            # Direct facts are intentionally handled by the frozen engine as
            # an abstaining hierarchy decision: the target already has a
            # direct assertion, so no inferred record is written.  Report the
            # direct facts as usable/applied coverage separately from H1-H4.
            "direct_usable": sum(decision["reason"] == "DIRECT_TARGET_AVAILABLE" for decision in decisions),
            "direct_applied": sum(decision["reason"] == "DIRECT_TARGET_AVAILABLE" for decision in decisions),
            "H1_candidates": candidates.get("H1_PARENT_ORGANISATION", 0),
            "H2_candidates": candidates.get("H2_INSTITUTION", 0),
            "H3_candidates": candidates.get("H3_SIBLING_PROGRAMME", 0),
            "H4_candidates": candidates.get("H4_PEER_EXTERNAL", 0),
            "candidate_slots": dict(candidates),
            "usable_by_level": {
                "H1": levels.get("H1_PARENT_ORGANISATION", 0),
                "H2": levels.get("H2_INSTITUTION", 0),
                "H3": levels.get("H3_SIBLING_PROGRAMME", 0),
                "H4": levels.get("H4_PEER_EXTERNAL", 0),
            },
            "applied_by_level": {
                "H1": levels.get("H1_PARENT_ORGANISATION", 0),
                "H2": levels.get("H2_INSTITUTION", 0),
                "H3": levels.get("H3_SIBLING_PROGRAMME", 0),
                "H4": levels.get("H4_PEER_EXTERNAL", 0),
            },
            "abstentions": sum(decision["abstained"] for decision in decisions),
            "support_counts": evaluated["support_counts"],
            "uncertainty_by_level": evaluated["uncertainty_by_level"],
            "reasons": dict(reasons),
        }
    summary = {
        "schema": "ExternalFieldScaleHierarchy/v1",
        "run": str(run),
        "target_count": len(programmes),
        "institution_count": len(institutions),
        "accepted_external_assertions": len(assertions),
        "accepted_by_provider": dict(Counter(row.get("provider_id") for row in deduped.values())),
        "accepted_by_field": dict(Counter(row.get("field_name") for row in deduped.values())),
        "accepted_by_scope": dict(Counter(row.get("scope") or "UNKNOWN" for row in deduped.values())),
        "fields": output,
        "notes": [
            "The existing H1-H4 engine is used unchanged.",
            "Only accepted OBSERVED external FieldAssertion rows are supplied.",
            "Institution-scoped assertions are not narrowed to programmes.",
        ],
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, default=ROOT / "runs" / "external-field-scale-20260914a")
    parser.add_argument("--out", type=Path, default=ROOT / "hierarchy" / "external-field-scale-20260914a.json")
    args = parser.parse_args()
    result = evaluate(args.run.resolve())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
