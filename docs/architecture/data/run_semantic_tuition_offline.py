"""Run the bounded retained-evidence tuition semantic experiment offline.

This runner deliberately disables model calls.  It exercises sample selection,
source material reconstruction, request construction, and the result ledger
against the retained topology evidence.  A later explicitly authorised run
can inject a configured :class:`ExtractionProvider`; this script never turns
missing credentials into a network call.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping


REPO_ROOT = Path(__file__).resolve().parents[3]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.extraction_provider import (  # noqa: E402
    ExtractionSource,
    UnavailableExtractionProvider,
)
from glowbal_ingestion.models import (  # noqa: E402
    SourceAuthority,
    SourceRelationship,
    TemporalState,
)
from glowbal_ingestion.semantic_tuition import (  # noqa: E402
    SemanticTuitionExtractor,
    TuitionExtractionStatus,
)
from glowbal_ingestion.source_recovery import select_sources_for_fields  # noqa: E402


RETAINED_RUN = (
    REPO_ROOT
    / "docs"
    / "architecture"
    / "data"
    / "tuition-live-population-topology-run-20260909"
)
POPULATION_MANIFEST = (
    REPO_ROOT
    / "docs"
    / "architecture"
    / "data"
    / "tuition-live-population-topology-manifest.json"
)
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "docs"
    / "architecture"
    / "data"
    / "semantic-tuition-experiment-20260911"
)

# Frozen before running the offline semantic pass.  Every selected institution
# has two retained programme targets in the original manifest and spans four
# countries (US, Switzerland, France, Canada).  We do not replace missing
# retained sources with easier targets.
SELECTED_INSTITUTION_IDS = (
    "mit-us",
    "stanford-us",
    "yale-us",
    "cornell-us",
    "duke-us",
    "northwestern-us",
    "ucla-us",
    "eth-zurich-ch",
    "sorbonne-fr",
    "udem-ca",
)
MAX_SOURCE_BYTES = 2 * 1024 * 1024


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dump(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _jsonl_dump(path: Path, rows: Iterable[Mapping[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(
                json.dumps(
                    dict(row),
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                + "\n"
            )


def _jsonl_load(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    result: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            result.append(value)
    return result


def _enum_or_default(value: Any, enum_type: type[Any], default: Any) -> Any:
    try:
        return enum_type(str(value)) if value is not None else default
    except (TypeError, ValueError):
        return default


def _safe_retained_path(root: Path, relative: str) -> Path | None:
    if not relative:
        return None
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def _retained_text(root: Path, relative: str | None) -> tuple[str, str | None]:
    """Read only bounded retained HTML/text; never fetch or write a source."""
    path = _safe_retained_path(root, str(relative or ""))
    if path is None or path.suffix.casefold() not in {".gz", ".html", ".txt", ".json", ".xml"}:
        return "", "UNAVAILABLE_NON_TEXT_RETAINED_OBJECT"
    try:
        if path.suffix.casefold() == ".gz":
            with gzip.open(path, "rb") as handle:
                payload = handle.read(MAX_SOURCE_BYTES + 1)
        else:
            payload = path.read_bytes()[: MAX_SOURCE_BYTES + 1]
    except OSError as exc:
        return "", f"RETAINED_READ_ERROR:{type(exc).__name__}"
    if len(payload) > MAX_SOURCE_BYTES:
        return "", "RETAINED_SOURCE_BOUND_EXCEEDED"
    return payload.decode("utf-8", errors="replace"), None


def _source_from_row(row: Mapping[str, Any], retained_root: Path, run_id: str) -> tuple[ExtractionSource, dict[str, Any]]:
    text, read_reason = _retained_text(retained_root, row.get("raw_object_path"))
    source = ExtractionSource(
        url=str(row.get("canonical_url") or row.get("url") or ""),
        page_type=str(row.get("page_type") or "unknown"),
        title=str(row.get("title") or "") or None,
        text=text,
        content_hash=str(row.get("content_hash") or ""),
        raw_document_id=str(row.get("raw_document_id") or "") or None,
        parser_id=str(row.get("parser_id") or "") or None,
        parser_version=str(row.get("parser_version") or "") or None,
        source_authority=_enum_or_default(
            row.get("source_authority"), SourceAuthority, None
        ),
        source_relationship=_enum_or_default(
            row.get("source_relationship"), SourceRelationship, None
        ),
        temporal_state=_enum_or_default(
            row.get("temporal_state"), TemporalState, TemporalState.UNKNOWN
        ),
        source_class=str(row.get("source_class") or "") or None,
        adapter_id=str(row.get("adapter_id") or "") or None,
        provider_id=str(row.get("provider_id") or "") or None,
        dataset_id=str(row.get("dataset_id") or "") or None,
        academic_cycle=str(row.get("academic_cycle") or "") or None,
        acquisition_run_id=run_id,
        linked_programme_id=str(row.get("linked_programme_id") or "") or None,
        linked_programme_url=str(row.get("linked_programme_url") or "") or None,
        discovered_from=str(row.get("discovered_from") or "") or None,
        anchor_text=str(row.get("anchor_text") or "") or None,
    )
    metadata = {
        "source_id": row.get("source_id"),
        "url": source.url,
        "raw_object_path": row.get("raw_object_path"),
        "content_hash": source.content_hash,
        "content_available": bool(text),
        "content_bytes": len(text.encode("utf-8")),
        "read_reason": read_reason,
    }
    return source, metadata


def select_sample(manifest: Mapping[str, Any], source_rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Select frozen targets with retained source rows, independent of model yield."""
    source_urls = {
        (str(row.get("institution_id") or ""), str(row.get("url") or row.get("canonical_url") or ""))
        for row in source_rows
    }
    institutions_by_id = {
        str(item.get("institution_id")): item
        for item in manifest.get("institutions", [])
        if isinstance(item, Mapping)
    }
    selected: list[dict[str, Any]] = []
    for institution_id in SELECTED_INSTITUTION_IDS:
        institution = institutions_by_id.get(institution_id)
        if institution is None:
            continue
        targets = institution.get("targets") or []
        for target in targets:
            if not isinstance(target, Mapping):
                continue
            url = str(target.get("programme_url") or "")
            selected.append(
                {
                    "target_id": target.get("target_id"),
                    "institution_id": institution_id,
                    "institution_name": institution.get("name"),
                    "country_code": institution.get("country_code"),
                    "region": institution.get("region"),
                    "institution_type": institution.get("institution_type"),
                    "field_domain": target.get("field_domain") or institution.get("field_domain"),
                    "programme_name": target.get("programme_name"),
                    "degree_level": target.get("degree_level"),
                    "programme_url": url,
                    "pricing_structure_stratum": target.get("pricing_structure_stratum"),
                    "retained_source_available": (institution_id, url) in source_urls,
                }
            )
    return selected


def run_experiment(
    *,
    retained_root: Path = RETAINED_RUN,
    manifest_path: Path = POPULATION_MANIFEST,
    output_dir: Path = DEFAULT_OUTPUT,
) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_rows = _jsonl_load(retained_root / "sources.jsonl")
    source_rows_by_institution: dict[str, list[dict[str, Any]]] = {}
    for row in source_rows:
        source_rows_by_institution.setdefault(
            str(row.get("institution_id") or ""), []
        ).append(row)
    sample = select_sample(manifest, source_rows)
    experiment_run_id = f"semantic-tuition-offline-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    extraction = SemanticTuitionExtractor(UnavailableExtractionProvider())
    attempts: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    source_inventory: list[dict[str, Any]] = []
    source_selection_rows: list[dict[str, Any]] = []
    for target in sample:
        institution_rows = source_rows_by_institution.get(
            str(target["institution_id"]), []
        )
        sources: list[ExtractionSource] = []
        target_source_ids: list[str] = []
        for row in institution_rows:
            source, metadata = _source_from_row(
                row, retained_root, retained_root.name
            )
            if source.url:
                sources.append(source)
            if source.url == target["programme_url"]:
                target_source_ids.append(str(row.get("source_id") or ""))
            source_inventory.append(
                {
                    "target_id": target["target_id"],
                    "institution_id": target["institution_id"],
                    **metadata,
                }
            )
        programme = {
            "programme_id": target["target_id"],
            "institution_id": target["institution_id"],
            "programme_name": target["programme_name"],
            "degree_level": target["degree_level"],
            "official_url": target["programme_url"],
        }
        preselection_source_count = len(sources)
        selection = select_sources_for_fields(
            sources,
            ("tuition",),
            target_url=str(target["programme_url"]),
            target_cycle=str(manifest.get("target_cycle") or "") or None,
            programme_id=str(target["target_id"]),
            max_sources=4,
        )
        sources = list(selection.sources)
        target_decisions = selection.diagnostics()
        for decision in target_decisions:
            source_selection_rows.append(
                {
                    "experiment_run_id": experiment_run_id,
                    "target_id": target["target_id"],
                    "institution_id": target["institution_id"],
                    **decision,
                }
            )
        rejection_counts = Counter(
            str(item["reason_code"])
            for item in target_decisions
            if item["decision"] == "rejected"
        )
        outcome = extraction.extract(
            entity_id=str(target["target_id"]),
            programme=programme,
            sources=tuple(sources),
            target_cycle=str(manifest.get("target_cycle") or "") or None,
            acquisition_run_id=retained_root.name,
            context={
                "experiment_run_id": experiment_run_id,
                "institution_id": target["institution_id"],
                "field_domain": target["field_domain"],
            },
        )
        attempts.append(
            {
                "experiment_run_id": experiment_run_id,
                "target_id": target["target_id"],
                "institution_id": target["institution_id"],
                "country_code": target["country_code"],
                "programme_name": target["programme_name"],
                "programme_url": target["programme_url"],
                "source_count": len(sources),
                "preselection_source_count": preselection_source_count,
                "source_rejection_counts": dict(sorted(rejection_counts.items())),
                "content_source_count": sum(bool(source.text) for source in sources),
                "direct_target_source_count": len(target_source_ids),
                "provider_mode": "disabled_offline",
                "llm_calls": 0,
                "status": outcome.status.value,
                "valid_assertion_count": outcome.valid_assertion_count,
                "abstention_count": len(outcome.abstentions),
                "schema_failure_count": len(outcome.schema_failures),
            }
        )
        results.append(
            {
                "experiment_run_id": experiment_run_id,
                "target_id": target["target_id"],
                "status": outcome.status.value,
                "outcome": outcome.to_dict(),
            }
        )

    status_counts = Counter(row["status"] for row in attempts)
    selection_rejection_counts = Counter(
        str(row["reason_code"])
        for row in source_selection_rows
        if row["decision"] == "rejected"
    )
    direct_targets = sum(
        row["direct_target_source_count"] > 0 for row in attempts
    )
    content_targets = sum(row["content_source_count"] > 0 for row in attempts)
    evaluation = {
        "experiment_run_id": experiment_run_id,
        "evaluation_status": "NOT_RUN_NO_CONFIGURED_LLM_ASSERTIONS",
        "accuracy_status": "NOT_MEASURABLE_NO_HELD_OUT_TRUTH",
        "semantic_items_attempted": len(attempts),
        "valid_assertions": 0,
        "abstentions": sum(status_counts.get(status, 0) for status in (
            TuitionExtractionStatus.ABSTAINED.value,
            TuitionExtractionStatus.PROVIDER_UNAVAILABLE.value,
        )),
        "schema_validation_failures": status_counts.get(
            TuitionExtractionStatus.SCHEMA_INVALID.value, 0
        ),
        "provider_unavailable": status_counts.get(
            TuitionExtractionStatus.PROVIDER_UNAVAILABLE.value, 0
        ),
        "retained_target_source_coverage": (
            direct_targets / len(attempts) if attempts else 0.0
        ),
        "retained_content_target_coverage": (
            content_targets / len(attempts) if attempts else 0.0
        ),
        "hierarchy_activation": {
            "direct": {"count": 0, "status": "NOT_RUN"},
            "H1_PARENT_ORGANISATION": {"count": 0, "status": "NOT_RUN"},
            "H2_INSTITUTION": {"count": 0, "status": "NOT_RUN"},
            "H3_SIBLING_PROGRAMME": {"count": 0, "status": "NOT_RUN"},
            "H4_PEER_INSTITUTION": {"count": 0, "status": "NOT_RUN"},
        },
        "hierarchical_abstention_rate": None,
        "support_counts": [],
        "dispersion": [],
        "uncertainty_by_level": {},
        "conflict_cases": 0,
        "llm_calls": 0,
        "provider_id": "unconfigured",
        "source_selection": {
            "selected": sum(row["decision"] == "selected" for row in source_selection_rows),
            "rejected": sum(row["decision"] == "rejected" for row in source_selection_rows),
            "rejected_by_reason": dict(sorted(selection_rejection_counts.items())),
            "max_sources_per_target": 4,
        },
    }
    frozen_manifest = {
        "experiment_run_id": experiment_run_id,
        "frozen_at": _now(),
        "source_manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "source_manifest_sha256": hashlib.sha256(
            manifest_path.read_bytes()
        ).hexdigest(),
        "retained_run": str(retained_root.relative_to(REPO_ROOT)),
        "selected_institution_ids": list(SELECTED_INSTITUTION_IDS),
        "target_count": len(sample),
        "institution_count": len({row["institution_id"] for row in sample}),
        "country_codes": sorted({str(row["country_code"]) for row in sample}),
        "selection_rule": (
            "fixed ten-institution subset selected before semantic execution; "
            "all retained targets are included and no targets are added for yield"
        ),
        "target_cycle": manifest.get("target_cycle"),
        "llm_calls_allowed": 0,
        "provider_mode": "disabled_offline",
        "targets": sample,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    _json_dump(output_dir / "manifest.json", frozen_manifest)
    _jsonl_dump(output_dir / "attempts.jsonl", attempts)
    _jsonl_dump(output_dir / "results.jsonl", results)
    _jsonl_dump(output_dir / "source-inventory.jsonl", source_inventory)
    _jsonl_dump(output_dir / "source-selection.jsonl", source_selection_rows)
    _json_dump(output_dir / "evaluation.json", evaluation)
    report = _render_report(frozen_manifest, attempts, evaluation)
    (output_dir / "report.md").write_text(report, encoding="utf-8")
    return {
        "output_dir": str(output_dir),
        "manifest": frozen_manifest,
        "attempts": attempts,
        "evaluation": evaluation,
    }


def _render_report(
    manifest: Mapping[str, Any],
    attempts: list[Mapping[str, Any]],
    evaluation: Mapping[str, Any],
) -> str:
    counts = Counter(str(row.get("status")) for row in attempts)
    lines = [
        "# Offline semantic tuition extraction experiment",
        "",
        f"Experiment run: `{manifest['experiment_run_id']}`",
        "",
        "This bounded run used retained topology evidence only. The extraction "
        "provider was deliberately disabled, so no LLM/provider call was made "
        "and no assertion was generated.",
        "",
        f"- Institutions: **{manifest['institution_count']}**",
        f"- Targets: **{manifest['target_count']}**",
        f"- Countries: **{', '.join(manifest['country_codes'])}**",
        f"- Semantic items attempted: **{evaluation['semantic_items_attempted']}**",
        f"- Valid native OBSERVED assertions: **{evaluation['valid_assertions']}**",
        f"- LLM calls: **{evaluation['llm_calls']}**",
        "",
        "## Outcome",
        "",
        f"- Provider-unavailable outcomes: **{counts.get('PROVIDER_UNAVAILABLE', 0)}**",
        f"- Schema failures: **{counts.get('SCHEMA_INVALID', 0)}**",
        f"- Retained target-source coverage: **{evaluation['retained_target_source_coverage']:.1%}**",
        f"- Retained content-source coverage: **{evaluation['retained_content_target_coverage']:.1%}**",
        f"- Field-selected sources: **{evaluation['source_selection']['selected']}**",
        f"- Rejected context sources: **{evaluation['source_selection']['rejected']}** "
        f"({evaluation['source_selection']['rejected_by_reason']})",
        "- Hierarchical activation: **not run** because no semantic assertions were available.",
        "- Accuracy/calibration: **not measurable**; no model output or held-out evaluation was used.",
        "",
        "## Safety",
        "",
        "- Search snippets were not used as evidence.",
        "- Programme pages were linked only by exact target URL or explicit retained metadata.",
        "- No archive/current-truth promotion occurred.",
        "- No canonical/product truth or promotion data was changed.",
        "- No network, LLM, estimator, or topology acquisition call was made.",
        "",
        "Artifacts: `manifest.json`, `attempts.jsonl`, `results.jsonl`, "
        "`source-inventory.jsonl`, `source-selection.jsonl`, `evaluation.json`.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--retained-run", type=Path, default=RETAINED_RUN)
    parser.add_argument("--manifest", type=Path, default=POPULATION_MANIFEST)
    args = parser.parse_args()
    result = run_experiment(
        retained_root=args.retained_run,
        manifest_path=args.manifest,
        output_dir=args.output_dir,
    )
    print(json.dumps({"output_dir": result["output_dir"], "targets": len(result["attempts"])}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
