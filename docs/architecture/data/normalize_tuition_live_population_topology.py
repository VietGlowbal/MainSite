"""Consolidate live topology edges after deterministic source review.

The live runner intentionally records every selected link.  A catalogue page
can expose the same href under several navigation labels, and a PDF can be a
programme companion rather than a hierarchy donor.  This research-only pass
keeps the raw acquisition ledger intact while making the effective topology
dataset one edge per target/document and applying the frozen scope review.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[3]
INGESTION_SRC = ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.url_safety import canonicalize_url, UnsafeUrlError


RUN_DIR = Path(__file__).with_name("tuition-live-population-topology-run-20260909")
MANIFEST_PATH = Path(__file__).with_name("tuition-live-population-topology-manifest.json")


def _canonical(value: str) -> str:
    try:
        return canonicalize_url(value)
    except UnsafeUrlError:
        return value


def _load_jsonl(path: Path) -> list[dict[str, object]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    path.write_text(
        "".join(
            json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
            for row in rows
        ),
        encoding="utf-8",
    )


def _is_programme_path(url: str) -> bool:
    path = urlsplit(url).path.casefold()
    return any(
        token in path
        for token in (
            "program",
            "programme",
            "degree",
            "course",
            "major",
            "masters",
            "master-",
            "bachelor",
            "undergraduate",
            "graduate",
        )
    )


def _sanity_cycle(value: object) -> str | None:
    """Keep only adjacent academic-year pairs from deterministic text hits."""
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"(20\d{2})-(\d{2})", value)
    if not match:
        return None
    first = int(match.group(1))
    suffix = int(match.group(2))
    if suffix != (first + 1) % 100:
        return None
    return value


def _classify_edge(
    edge: dict[str, object],
    *,
    targets: dict[str, dict[str, object]],
    target_by_url: dict[str, str],
    e0_lineage_targets: dict[str, set[str]],
) -> dict[str, object]:
    result = dict(edge)
    target_id = str(result["target_id"])
    target = targets[target_id]
    level = str(result.get("topology_level") or "")
    source_url = _canonical(str(result.get("source_url") or ""))
    source_target_id = target_by_url.get(source_url)
    source_lineage = str(result.get("policy_lineage_id") or "")
    lineage_targets = e0_lineage_targets.get(source_lineage, set())

    # A source page that is the frozen programme page for another target (or a
    # redirect-equivalent unmanifested sibling page) is E3.  It is never E1 or
    # E2 merely because the same href appeared next to a school/fee label.
    sibling_id: str | None = None
    if source_target_id and source_target_id != target_id:
        source_target = targets[source_target_id]
        if source_target["institution_id"] == target["institution_id"]:
            sibling_id = source_target_id
    else:
        sibling_candidates = {
            candidate_id
            for candidate_id in lineage_targets
            if candidate_id != target_id
            and targets[candidate_id]["institution_id"] == target["institution_id"]
        }
        if sibling_candidates:
            sibling_id = sorted(sibling_candidates)[0]

    lower_url = source_url.casefold()
    # These PDFs were linked from the programme page and identify the same
    # programme, so they are E0 companion evidence.  The guide is a central
    # graduate-admissions document (E2), not a sibling programme tariff.
    companion_pdf_targets = {
        "information-systems-ms-data-science-specialization.pdf": "LPT-016",
        "msc-datascience-appendix.pdf": "LPT-021",
        "msc-rsc-appendix.pdf": "LPT-022",
        "coursecontent_msds_27jan26.pdf": "LPT-038",
    }
    companion_target = next(
        (candidate_id for suffix, candidate_id in companion_pdf_targets.items() if suffix in lower_url),
        None,
    )
    if str(result.get("source_class") or "") == "pdf" and companion_target == target_id:
        result["topology_level"] = "E0"
        result["applicability_class"] = "DIRECTLY_APPLICABLE"
        result["relationship"] = "DIRECT_OFFICIAL"
        result["topology_review"] = "programme_companion_pdf"
    elif sibling_id:
        result["topology_level"] = "E3"
        result["relationship"] = "OTHER_RELATED"
        source_degree = targets[sibling_id].get("degree_level")
        if source_degree and source_degree == target.get("degree_level"):
            result["applicability_class"] = "POTENTIALLY_COMPARABLE"
        else:
            result["applicability_class"] = "RELATED_BUT_NOT_APPLICABLE"
        result["sibling_target_id"] = sibling_id
        result["topology_review"] = "same_institution_programme_lineage"
    elif str(result.get("source_class") or "") == "pdf" and "your-ug-computing-options-at-unsw.pdf" in lower_url:
        result["topology_level"] = "E1"
        result["applicability_class"] = "AMBIGUOUS"
        result["relationship"] = "OTHER_RELATED"
        result["topology_review"] = "faculty_computing_options_brochure"
    elif str(result.get("source_class") or "") == "pdf" and "ccds-msc-tuition-fees-schedule" in lower_url:
        result["topology_level"] = "E1"
        result["applicability_class"] = "DIRECTLY_APPLICABLE"
        result["relationship"] = "OTHER_RELATED"
        result["topology_review"] = "faculty_ccds_tuition_schedule"
    elif str(result.get("source_class") or "") == "pdf" and "guidecandidat" in lower_url:
        result["topology_level"] = "E2"
        result["applicability_class"] = "AMBIGUOUS"
        result["topology_review"] = "institution_graduate_admissions_guide"
    elif level != "E0" and _is_programme_path(source_url):
        # The remaining fetched non-E0 HTML page in this run is an unmanifested
        # same-institution programme page (Duke); preserve it as E3 while its
        # exact degree applicability remains unresolved.
        result["topology_level"] = "E3"
        result["applicability_class"] = "POTENTIALLY_COMPARABLE"
        result["relationship"] = "OTHER_RELATED"
        result["topology_review"] = "programme_path_unmanifested_sibling"

    result["source_url"] = source_url
    return result


def run() -> dict[str, object]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    targets = {
        target["target_id"]: {
            **target,
            "institution_id": institution["institution_id"],
            "region": institution["region"],
            "institution_type": institution["institution_type"],
            "field_domain": target.get("field_domain", institution["field_domain"]),
        }
        for institution in manifest["institutions"]
        for target in institution["targets"]
    }
    target_by_url = {
        _canonical(str(target["programme_url"])): target_id
        for target_id, target in targets.items()
    }
    raw_json_path = RUN_DIR / "topology-edges-raw.json"
    raw_source_path = raw_json_path if raw_json_path.exists() else RUN_DIR / "topology-edges.json"
    raw_payload = json.loads(raw_source_path.read_text(encoding="utf-8"))
    raw_edges = list(raw_payload.get("edges", []))
    if not raw_json_path.exists():
        shutil.copy2(RUN_DIR / "topology-edges.json", raw_json_path)
    raw_jsonl_path = RUN_DIR / "topology-edges-raw.jsonl"
    if not raw_jsonl_path.exists():
        shutil.copy2(RUN_DIR / "topology-edges.jsonl", raw_jsonl_path)

    e0_lineage_targets: dict[str, set[str]] = defaultdict(set)
    for edge in raw_edges:
        if edge.get("topology_level") == "E0":
            e0_lineage_targets[str(edge.get("policy_lineage_id") or "")].add(str(edge["target_id"]))
    reviewed = [
        _classify_edge(
            edge,
            targets=targets,
            target_by_url=target_by_url,
            e0_lineage_targets=e0_lineage_targets,
        )
        for edge in raw_edges
    ]
    effective_by_key: dict[tuple[str, str, str], dict[str, object]] = {}
    for edge in reviewed:
        key = (
            str(edge["target_id"]),
            _canonical(str(edge.get("source_url") or "")),
            str(edge.get("policy_lineage_id") or ""),
        )
        effective_by_key.setdefault(key, edge)
    effective = list(effective_by_key.values())

    target_e0_lineages: dict[str, set[str]] = defaultdict(set)
    for edge in effective:
        if edge.get("topology_level") == "E0":
            target_e0_lineages[str(edge["target_id"])].add(
                str(edge.get("policy_lineage_id") or "")
            )
    for edge in effective:
        target_id = str(edge["target_id"])
        edge["academic_cycle"] = _sanity_cycle(edge.get("academic_cycle"))
        if edge.get("topology_level") == "E0":
            edge["independent"] = True
            edge["independence_basis"] = "programme_scope"
        else:
            independent = str(edge.get("policy_lineage_id") or "") not in target_e0_lineages[target_id]
            edge["independent"] = independent
            edge["independence_basis"] = (
                "target_relative_policy_lineage_differs_from_E0"
                if independent
                else "same_policy_lineage_as_target_E0"
            )
        edge["lineage_scope"] = "target_relative;global_reuse_reported_separately"

    effective.sort(key=lambda row: (str(row["target_id"]), str(row.get("topology_level")), str(row.get("source_url"))))
    _write_json(RUN_DIR / "topology-edges.json", {"run_id": raw_payload.get("run_id"), "edge_count": len(effective), "edges": effective})
    _write_jsonl(RUN_DIR / "topology-edges.jsonl", effective)

    summaries: list[dict[str, object]] = []
    effective_by_target: dict[str, list[dict[str, object]]] = defaultdict(list)
    raw_by_target: dict[str, list[dict[str, object]]] = defaultdict(list)
    for edge in effective:
        effective_by_target[str(edge["target_id"])].append(edge)
    for edge in raw_edges:
        raw_by_target[str(edge["target_id"])].append(edge)
    for target_id, target in targets.items():
        rows = effective_by_target[target_id]
        levels = sorted({str(row["topology_level"]) for row in rows})
        non_e0 = [row for row in rows if row.get("topology_level") != "E0"]
        summaries.append(
            {
                "target_id": target_id,
                "institution_id": target["institution_id"],
                "programme_name": target["programme_name"],
                "degree_level": target["degree_level"],
                "field_domain": target["field_domain"],
                "region": target["region"],
                "institution_type": target["institution_type"],
                "pricing_structure_stratum": target["pricing_structure_stratum"],
                "evidence_levels": levels,
                "raw_path_count": len(raw_by_target[target_id]),
                "effective_path_count": len(rows),
                "non_e0_path_count": len(non_e0),
                "non_e0_independent_path_count": sum(bool(row.get("independent")) for row in non_e0),
                "independent_policy_lineage_count": len({str(row.get("policy_lineage_id") or "") for row in non_e0}),
                "has_non_e0": bool(non_e0),
                "has_independent_non_e0": any(bool(row.get("independent")) for row in non_e0),
                "multiple_paths": len({str(row.get("policy_lineage_id") or "") for row in rows}) >= 2,
            }
        )
    _write_json(RUN_DIR / "target-topology-summary.json", {"run_id": raw_payload.get("run_id"), "normalization": "effective_deduplicated", "targets": summaries})

    summary = json.loads((RUN_DIR / "summary.json").read_text(encoding="utf-8"))
    raw_lineages = len({str(edge.get("policy_lineage_id") or "") for edge in raw_edges})
    effective_lineages = len({str(edge.get("policy_lineage_id") or "") for edge in effective})
    non_e0_lineages = len({str(edge.get("policy_lineage_id") or "") for edge in effective if edge.get("topology_level") != "E0"})
    summary.update(
        {
            "raw_topology_edges": len(raw_edges),
            "raw_policy_lineages": raw_lineages,
            "raw_targets_with_non_e0": sum(any(row.get("topology_level") != "E0" for row in rows) for rows in raw_by_target.values()),
            "topology_edges": len(effective),
            "effective_topology_edges": len(effective),
            "independent_policy_lineages": effective_lineages,
            "non_e0_policy_lineages": non_e0_lineages,
            "targets_with_any_evidence": sum(bool(effective_by_target[target_id]) for target_id in targets),
            "targets_with_non_e0": sum(any(row.get("topology_level") != "E0" for row in rows) for rows in effective_by_target.values()),
            "targets_with_independent_non_e0": sum(any(row.get("topology_level") != "E0" and row.get("independent") for row in rows) for rows in effective_by_target.values()),
            "targets_with_multiple_levels": sum(len({str(row.get("topology_level")) for row in rows}) >= 2 for rows in effective_by_target.values()),
            "source_class_stats": {
                source_class: {
                    **dict(stats),
                    "raw_linked": int(stats.get("linked", 0)),
                    "effective_linked": sum(row.get("source_class") == source_class for row in effective),
                    "useful_topology_edges": sum(
                        row.get("source_class") == source_class
                        and row.get("applicability_class") in {"DIRECTLY_APPLICABLE", "POTENTIALLY_COMPARABLE", "INDEPENDENT_EXTERNAL"}
                        for row in effective
                    ),
                }
                for source_class, stats in summary.get("source_class_stats", {}).items()
            },
            "topology_normalization": {
                "status": "APPLIED",
                "raw_edges": len(raw_edges),
                "effective_edges": len(effective),
                "duplicate_edges_removed": len(raw_edges) - len(effective),
                "rules": [
                    "one edge per target, canonical source URL and policy lineage",
                    "same-institution programme URLs and redirect-equivalent programme lineages are E3",
                    "programme companion PDFs are E0; the graduate admissions guide is E2",
                    "independence is target-relative; global policy-lineage reuse remains reported",
                    "reject non-adjacent year text matches as unresolved academic cycle",
                ],
            },
        }
    )
    _write_json(RUN_DIR / "summary.json", summary)
    normalization = {
        "run_id": raw_payload.get("run_id"),
        "raw_edge_count": len(raw_edges),
        "effective_edge_count": len(effective),
        "raw_level_counts": dict(Counter(str(edge.get("topology_level")) for edge in raw_edges)),
        "effective_level_counts": dict(Counter(str(edge.get("topology_level")) for edge in effective)),
        "effective_applicability_counts": dict(Counter(str(edge.get("applicability_class")) for edge in effective)),
        "effective_independence_counts": dict(Counter(bool(edge.get("independent")) for edge in effective)),
        "notes": "Raw acquisition edges are preserved as topology-edges-raw.json/jsonl; effective files are the deduplicated, reviewed dataset.",
    }
    _write_json(RUN_DIR / "topology-edge-normalization.json", normalization)
    return summary


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
