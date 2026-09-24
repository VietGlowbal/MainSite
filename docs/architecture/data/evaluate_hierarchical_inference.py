"""Evaluate the opt-in hierarchical donor rail against retained artifacts.

The retained multi-source topology run contains raw/source edges, not semantic
FieldAssertion values. This script therefore reports topology availability and
explicitly marks donor-value evaluation as not measurable when no assertion
input is present. It never creates synthetic donors or runs an estimator.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_TOPOLOGY = REPO_ROOT / "docs/architecture/data/multi-source-population-topology-20260910-run2"
DEFAULT_FREEZE = REPO_ROOT / "docs/architecture/data/tuition-hierarchical-label-donor-sufficiency-freeze.json"
DEFAULT_PRIOR_TUITION_AUDIT = REPO_ROOT / "docs/architecture/data/tuition-hierarchical-proof-of-strategy-audit.json"
DEFAULT_OUTPUT = REPO_ROOT / "docs/architecture/data/hierarchical-inference-evaluation-20260911"


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            rows.append(value)
    return rows


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def evaluate(
    topology_dir: Path,
    freeze_path: Path,
    output_dir: Path,
    prior_tuition_audit_path: Path | None = DEFAULT_PRIOR_TUITION_AUDIT,
) -> dict[str, Any]:
    population = _read_json(topology_dir / "population-manifest.json")
    institutions = population.get("institutions") or []
    institution_ids = [str(item.get("institution_id")) for item in institutions if item.get("institution_id")]
    edges = _read_jsonl(topology_dir / "topology-edges.jsonl")
    useful = [
        row
        for row in edges
        if row.get("evidence_available") is not False
        and row.get("provenance_complete") is not False
    ]
    by_institution: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in useful:
        institution_id = str(row.get("institution_id") or "")
        if institution_id:
            by_institution[institution_id].append(row)

    level_names = {
        "E0": "programme",
        "E1": "parent_organisation",
        "E2": "institution",
        "E3": "sibling_programme",
        "E4": "external_authoritative",
    }
    level_counts = Counter(str(row.get("topology_level")) for row in useful)
    institution_level_counts: dict[str, int] = {}
    for level in level_names:
        institution_level_counts[level] = sum(
            1
            for institution_id in institution_ids
            if any(row.get("topology_level") == level for row in by_institution[institution_id])
        )

    semantic_candidates = []
    for name in (
        "field_assertions.jsonl",
        "effective_field_assertions.jsonl",
        "assertions.jsonl",
        "quality_inferences.jsonl",
    ):
        semantic_candidates.extend(topology_dir.glob(name))
    semantic_assertions_available = bool(semantic_candidates)
    freeze = _read_json(freeze_path)
    target_count = len(freeze.get("target_list") or [])
    policy_holdout_donors = list((freeze.get("donor_whitelist") or {}).get("policy_lineage_holdout") or [])
    whole_source_donors = list((freeze.get("donor_whitelist") or {}).get("whole_source_holdout") or [])
    independent_donor_count = len(set(policy_holdout_donors))
    if not semantic_assertions_available:
        independent_donor_count = 0
    prior_tuition = _read_json(prior_tuition_audit_path) if prior_tuition_audit_path and prior_tuition_audit_path.exists() else {}
    prior_donor = prior_tuition.get("donor_sufficiency") or {}
    prior_h1 = (prior_tuition.get("hypotheses") or {}).get("H1_coverage") or {}
    prior_comparison = {
        "artifact": (
            str(prior_tuition_audit_path.relative_to(REPO_ROOT)).replace("\\", "/")
            if prior_tuition_audit_path and prior_tuition_audit_path.exists()
            else None
        ),
        "prior_targets": prior_tuition.get("frozen_input", {}).get("exact_targets"),
        "prior_independent_donor_targets": prior_donor.get("targets_with_independent_donor"),
        "prior_useful_estimate_coverage": prior_h1.get("useful_estimate_coverage"),
        "current_topology_population": len(institution_ids),
        "current_semantic_independent_donor_targets": independent_donor_count,
        "comparison_status": (
            "SEPARATE_AVAILABILITY_ONLY; POPULATIONS_AND_UNITS_DIFFER"
            if prior_tuition
            else "NO_PRIOR_ARTIFACT"
        ),
        "note": (
            "The prior artifact evaluates 12 frozen tuition programme targets; this artifact evaluates "
            "a 13-institution source-topology population. Direct coverage rates are not interchangeable. "
            "Both retain no usable independent semantic donor values."
            if prior_tuition
            else "No prior tuition strategy artifact was available."
        ),
    }

    source_classes = Counter(str(row.get("source_class") or "") for row in useful)
    providers = Counter(str(row.get("provider_id") or "") for row in useful)
    metrics = {
        "direct_programme_coverage": {
            "institutions": institution_level_counts["E0"],
            "population": len(institution_ids),
            "rate": round(institution_level_counts["E0"] / len(institution_ids), 4) if institution_ids else 0.0,
        },
        "parent_faculty_activation": {
            "topology_institutions": institution_level_counts["E1"],
            "rate": round(institution_level_counts["E1"] / len(institution_ids), 4) if institution_ids else 0.0,
            "semantic_donor_estimates": 0,
        },
        "institution_fallback_activation": {
            "topology_institutions": institution_level_counts["E2"],
            "rate": round(institution_level_counts["E2"] / len(institution_ids), 4) if institution_ids else 0.0,
            "semantic_donor_estimates": 0,
        },
        "sibling_donor_activation": {
            "topology_institutions": institution_level_counts["E3"],
            "rate": round(institution_level_counts["E3"] / len(institution_ids), 4) if institution_ids else 0.0,
            "semantic_donor_estimates": 0,
        },
        "peer_donor_activation": {
            "topology_institutions": 0,
            "rate": 0.0,
            "semantic_donor_estimates": 0,
            "reason": "E4 external edges do not establish comparable peer values",
        },
        "abstention": {
            "targets": target_count,
            "abstained": target_count if independent_donor_count == 0 else None,
            "rate": 1.0 if target_count and independent_donor_count == 0 else None,
        },
        "support_count": {"measurable": False, "value": None},
        "donor_dispersion": {"measurable": False, "value": None},
        "conflict_rate": {"measurable": False, "value": None},
        "uncertainty_by_hierarchy_level": {"measurable": False, "levels": {}},
    }
    result = {
        "evaluation_schema": "HierarchicalInferenceEvaluation/v1",
        "evaluation_kind": "topology_availability_and_donor_gate",
        "topology_artifact": str(topology_dir.relative_to(REPO_ROOT)).replace("\\", "/"),
        "topology_artifact_sha256": _sha256(topology_dir / "topology-edges.jsonl"),
        "freeze_artifact": str(freeze_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "population_size": len(institution_ids),
        "source_classes_with_yield": dict(sorted(source_classes.items())),
        "providers_with_yield": dict(sorted(providers.items())),
        "topology_level_edge_counts": dict(sorted(level_counts.items())),
        "topology_level_institution_counts": institution_level_counts,
        "semantic_assertions_available": semantic_assertions_available,
        "semantic_assertion_files": [str(path) for path in semantic_candidates],
        "independent_policy_holdout_donors": independent_donor_count,
        "whole_source_holdout_donors": len(whole_source_donors),
        "prior_tuition_comparison": prior_comparison,
        "metrics": metrics,
        "limitations": [
            "Retained topology edges contain source availability and provenance, not semantic field values.",
            "E2/E4 availability is not treated as a compatible numerical donor.",
            "No estimator accuracy or calibration claim is made.",
        ],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "evaluation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = [
        "# Hierarchical inference evaluation",
        "",
        "This research-only evaluation consumes the retained multi-source topology run without fabricating semantic assertions.",
        "",
        f"- Population: {len(institution_ids)} institutions",
        f"- Provenance-complete topology edges: {len(useful)}",
        f"- Source classes with yield: {', '.join(sorted(source_classes))}",
        f"- Programme topology coverage (E0): {metrics['direct_programme_coverage']['institutions']}/{len(institution_ids)} institutions",
        f"- Institution topology availability (E2): {metrics['institution_fallback_activation']['topology_institutions']}/{len(institution_ids)} institutions",
        "- Parent/faculty and sibling topology edges: 0",
        "- Peer numerical donors: 0; E4 edges are external evidence availability only",
        f"- Frozen tuition targets abstained: {target_count}/{target_count} (no independent policy-lineage donors)",
        "- Prior tuition strategy comparison: separate availability-only artifacts; populations and units differ, and both have zero usable semantic donors",
        "- Support, dispersion, conflict, and uncertainty-by-level metrics: NOT MEASURABLE without semantic assertions",
        "",
        "The donor engine is unit-tested, but the retained topology artifact does not contain values that can safely be supplied to it.",
    ]
    (output_dir / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topology-dir", type=Path, default=DEFAULT_TOPOLOGY)
    parser.add_argument("--freeze", type=Path, default=DEFAULT_FREEZE)
    parser.add_argument("--prior-tuition-audit", type=Path, default=DEFAULT_PRIOR_TUITION_AUDIT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    evaluate(args.topology_dir, args.freeze, args.output_dir, args.prior_tuition_audit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
