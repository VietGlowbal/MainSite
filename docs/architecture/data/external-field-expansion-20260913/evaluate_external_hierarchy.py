"""Evaluate the frozen H1-H4 engine over accepted external assertions.

This artifact-only runner combines the already validated Scorecard/Swiss
snapshots with the bounded Onisep run.  It does not alter the hierarchy
engine, acceptance policy, or stored assertions.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(
    0,
    str(
        Path(__file__).resolve().parents[4]
        / "services"
        / "data-ingestion"
        / "src"
    ),
)

from glowbal_ingestion.hierarchical_inference import HierarchicalInferenceEngine
from glowbal_ingestion.models import FieldAssertion


ROOT = Path(__file__).resolve()
SCORECARD_RUN = (
    ROOT.parents[0]
    / ".."
    / "external-field-provider-pass-20260912"
    / "runs"
    / "external-field-provider-pass-scorecard-cycle-fix-rerun-20260913"
).resolve()
SWISS_RUN = (
    ROOT.parents[0]
    / ".."
    / "external-field-provider-pass-20260912"
    / "runs"
    / "external-field-provider-pass-scorecard-swiss-final-20260913"
).resolve()
ONISEP_RUN = (ROOT.parent / "runs" / "onisep-sorbonne-bounded-20260913d").resolve()
OUT = ROOT.parent / "hierarchy"


def read_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def accepted(row: dict) -> bool:
    return (
        row.get("value_json") not in (None, "", [], {})
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def target_rows(*runs: Path) -> tuple[list[dict], list[dict]]:
    programmes: dict[str, dict] = {}
    institutions: dict[str, dict] = {}
    for run in runs:
        for row in read_jsonl(run / "programmes.jsonl"):
            programmes.setdefault(str(row["programme_id"]), row)
        for row in read_jsonl(run / "institutions.jsonl"):
            institutions.setdefault(str(row["institution_id"]), row)
    return list(programmes.values()), list(institutions.values())


def external_assertions() -> list[dict]:
    rows: dict[str, dict] = {}
    for run, providers in (
        (SCORECARD_RUN, {"college_scorecard_bulk"}),
        (SWISS_RUN, {"swissuniversities_tuition"}),
        (ONISEP_RUN, {"onisep_higher_ed"}),
    ):
        rows_path = run / "effective_field_assertions.jsonl"
        source_rows = (
            read_jsonl(rows_path)
            if rows_path.exists()
            else read_jsonl(run / "field_assertions.jsonl")
        )
        for row in source_rows:
            if accepted(row) and row.get("provider_id") in providers:
                rows[str(row["assertion_id"])] = row
    return list(rows.values())


def evaluate(programmes: list[dict], institutions: list[dict], rows: list[dict]) -> dict:
    assertions = [FieldAssertion(**row) for row in rows]
    fields = sorted({assertion.field_name for assertion in assertions})
    engine = HierarchicalInferenceEngine()
    result: dict[str, object] = {}
    for field in fields:
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
        levels = Counter(
            decision["level"]
            for decision in decisions
            if not decision["abstained"]
        )
        candidate_slots = Counter()
        for decision in decisions:
            for candidate in decision.get("candidates", []):
                candidate_slots[candidate.get("level")] += 1
            for rejected in decision.get("rejected", []):
                if rejected.get("level"):
                    candidate_slots[rejected["level"]] += 1
        applied = Counter(
            decision.get("level")
            for decision in decisions
            if decision.get("level") and not decision["abstained"]
        )
        result[field] = {
            "target_count": evaluated["target_count"],
            "direct": sum(
                decision["reason"] == "DIRECT_TARGET_AVAILABLE"
                for decision in decisions
            ),
            "H1": levels.get("H1_PARENT_ORGANISATION", 0),
            "H2": levels.get("H2_INSTITUTION", 0),
            "H3": levels.get("H3_SIBLING_PROGRAMME", 0),
            "H4": levels.get("H4_PEER_EXTERNAL", 0),
            "candidate_slots": dict(candidate_slots),
            "usable_by_level": dict(levels),
            "applied_by_level": dict(applied),
            "abstentions": sum(decision["abstained"] for decision in decisions),
            "abstentions_excluding_direct": sum(
                decision["abstained"]
                and decision["reason"] != "DIRECT_TARGET_AVAILABLE"
                for decision in decisions
            ),
            "support_counts": evaluated["support_counts"],
            "uncertainty_by_level": evaluated["uncertainty_by_level"],
            "reasons": dict(reasons),
            "decisions": decisions,
        }
    return result


def main() -> None:
    programmes, institutions = target_rows(SCORECARD_RUN, SWISS_RUN, ONISEP_RUN)
    rows = external_assertions()
    output = {
        "schema": "ExternalFieldExpansionHierarchy/v1",
        "target_count": len(programmes),
        "institution_count": len(institutions),
        "accepted_external_assertions": len(rows),
        "accepted_by_provider": dict(Counter(row.get("provider_id") for row in rows)),
        "accepted_by_field": dict(Counter(row.get("field_name") for row in rows)),
        "accepted_by_scope": dict(Counter(row.get("scope") or "UNKNOWN" for row in rows)),
        "fields": evaluate(programmes, institutions, rows),
        "notes": [
            "The existing H1-H4 engine is used unchanged.",
            "Only accepted OBSERVED external assertions are supplied.",
            "No institution-scoped value is narrowed to a programme by this runner.",
        ],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "hierarchical-evaluation.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
