from __future__ import annotations

import json
import os
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from .models import has_semantic_value
from .organisation import backfill_organisation_hierarchy


class ConsolidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class ConsolidationResult:
    output_dir: Path
    institution_count: int
    programme_count: int
    source_run_count: int
    organisation_coverage: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "output_dir": str(self.output_dir),
            "institution_count": self.institution_count,
            "programme_count": self.programme_count,
            "source_run_count": self.source_run_count,
            "organisation_coverage": self.organisation_coverage,
        }


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConsolidationError(f"Invalid JSON: {path}") from exc
    if not isinstance(value, dict):
        raise ConsolidationError(f"Expected JSON object: {path}")
    return value


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    try:
        for number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(),
            start=1,
        ):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ConsolidationError(
                    f"Expected JSON object: {path}:{number}"
                )
            records.append(value)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ConsolidationError(f"Invalid JSONL: {path}") from exc
    return records


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    path.write_text(
        "".join(
            json.dumps(record, ensure_ascii=False, separators=(",", ":"))
            + "\n"
            for record in records
        ),
        encoding="utf-8",
    )


def _record_key(stream: str, record: dict[str, Any]) -> str:
    key_fields = {
        "institutions": ("institution_id",),
        "school_profiles": ("institution_id",),
        "programmes": ("programme_id",),
        "programme_offerings": ("programme_offering_id",),
        "sources": ("source_id",),
        "field_assertions": ("assertion_id",),
        "effective_field_assertions": ("assertion_id",),
        "admission_packages": ("programme_id",),
        "policy_checks": ("institution_id", "domain"),
        "crawl_errors": ("error_id",),
    }.get(stream)
    if key_fields:
        return "|".join(str(record.get(field) or "") for field in key_fields)
    return json.dumps(record, ensure_ascii=False, sort_keys=True)


def _entity_filter(
    record: dict[str, Any],
    institution_id: str,
    programme_ids: set[str],
) -> bool:
    entity_type = str(record.get("entity_type") or "")
    entity_id = str(record.get("entity_id") or "")
    return (
        entity_type == "institution" and entity_id == institution_id
    ) or (entity_type == "programme" and entity_id in programme_ids)


def _stream_filter(stream: str) -> Callable[[dict[str, Any], str, set[str]], bool]:
    if stream in {
        "institutions",
        "school_profiles",
        "sources",
        "policy_checks",
        "crawl_errors",
    }:
        return lambda record, institution_id, _programme_ids: str(
            record.get("institution_id") or ""
        ) == institution_id
    if stream in {
        "programmes",
        "programme_offerings",
        "admission_packages",
        "url_graph_edges",
        "extraction_events",
        "inheritance_events",
        "shared_fact_bundles",
    }:
        return lambda record, _institution_id, programme_ids: str(
            record.get("programme_id") or ""
        ) in programme_ids
    if stream in {
        "field_assertions",
        "effective_field_assertions",
        "best_assertion_decisions",
    }:
        return _entity_filter
    return lambda _record, _institution_id, _programme_ids: False


def consolidate_runs(
    run_dirs: Iterable[Path],
    output_dir: Path,
    *,
    expected_institutions: int = 20,
    expected_programmes_per_institution: int = 20,
) -> ConsolidationResult:
    resolved_runs = tuple(path.resolve() for path in run_dirs)
    if not resolved_runs:
        raise ConsolidationError("At least one --run-dir is required.")
    output_dir = output_dir.resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ConsolidationError(
            f"Output directory must be empty: {output_dir}"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    manifests: dict[Path, dict[str, Any]] = {}
    latest_by_institution: dict[str, tuple[datetime, Path, dict[str, Any]]] = {}
    for run_dir in resolved_runs:
        manifest = _read_json(run_dir / "manifest.json")
        coverage = _read_json(run_dir / "coverage_report.json")
        completed_raw = manifest.get("completed_at")
        if manifest.get("discovery_only") or not completed_raw:
            continue
        try:
            completed = datetime.fromisoformat(str(completed_raw))
        except ValueError as exc:
            raise ConsolidationError(
                f"Invalid completed_at in {run_dir / 'manifest.json'}"
            ) from exc
        manifests[run_dir] = {**manifest, "coverage": coverage}
        for institution in manifest.get("institutions") or []:
            institution_id = str(institution.get("institution_id") or "")
            if not institution_id:
                continue
            current = latest_by_institution.get(institution_id)
            if current is None or completed > current[0]:
                latest_by_institution[institution_id] = (
                    completed,
                    run_dir,
                    institution,
                )
    if len(latest_by_institution) != expected_institutions:
        raise ConsolidationError(
            f"Expected {expected_institutions} institutions, found "
            f"{len(latest_by_institution)}."
        )

    streams = (
        "institutions",
        "school_profiles",
        "programmes",
        "programme_offerings",
        "sources",
        "field_assertions",
        "effective_field_assertions",
        "admission_packages",
        "policy_checks",
        "url_graph_edges",
        "crawl_errors",
        "best_assertion_decisions",
        "extraction_events",
        "inheritance_events",
        "shared_fact_bundles",
    )
    output: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen: dict[str, set[str]] = defaultdict(set)
    source_runs_used: set[Path] = set()
    institution_manifest_rows: list[dict[str, Any]] = []

    for institution_id, (_completed, run_dir, manifest_row) in sorted(
        latest_by_institution.items()
    ):
        source_runs_used.add(run_dir)
        institution_manifest_rows.append(manifest_row)
        offerings = _read_jsonl(run_dir / "programme_offerings.jsonl")
        programmes = _read_jsonl(run_dir / "programmes.jsonl")
        programme_institution = {
            str(record.get("programme_id") or ""): str(
                record.get("institution_id") or ""
            )
            for record in programmes
        }
        programme_ids = {
            str(record.get("programme_id") or "")
            for record in offerings
            if programme_institution.get(
                str(record.get("programme_id") or "")
            )
            == institution_id
        }
        if len(programme_ids) != expected_programmes_per_institution:
            raise ConsolidationError(
                f"{institution_id} has {len(programme_ids)} extracted "
                f"programmes in {run_dir.name}; expected "
                f"{expected_programmes_per_institution}."
            )
        for stream in streams:
            records = _read_jsonl(run_dir / f"{stream}.jsonl")
            predicate = _stream_filter(stream)
            for record in records:
                if not predicate(record, institution_id, programme_ids):
                    continue
                key = _record_key(stream, record)
                if key in seen[stream]:
                    continue
                seen[stream].add(key)
                output[stream].append(record)

    programme_ids = {
        str(record.get("programme_id") or "")
        for record in output["programme_offerings"]
    }
    if len(programme_ids) != expected_institutions * expected_programmes_per_institution:
        raise ConsolidationError(
            f"Expected 400 programme offerings, found {len(programme_ids)}."
        )

    for stream, records in output.items():
        if records:
            _write_jsonl(output_dir / f"{stream}.jsonl", records)

    selected_sources = output.get("sources", [])
    for source in selected_sources:
        relative = source.get("raw_object_path")
        institution_id = str(source.get("institution_id") or "")
        latest = latest_by_institution.get(institution_id)
        if not isinstance(relative, str) or latest is None:
            continue
        source_path = latest[1] / relative
        if not source_path.is_file():
            continue
        destination = output_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            try:
                os.link(source_path, destination)
            except OSError:
                shutil.copy2(source_path, destination)

    organisation = backfill_organisation_hierarchy(output_dir)
    effective = output.get("effective_field_assertions", [])
    non_null = [
        record
        for record in effective
        if record.get("verification_status") != "REJECTED"
        and has_semantic_value(record.get("value_json"))
    ]
    slots = {
        (
            str(record.get("entity_id") or ""),
            str(record.get("field_name") or ""),
        )
        for record in effective
        if record.get("verification_status") != "REJECTED"
    }
    non_null_slots = {
        (
            str(record.get("entity_id") or ""),
            str(record.get("field_name") or ""),
        )
        for record in non_null
    }
    fields: dict[str, dict[str, int | float]] = {}
    by_field: dict[str, set[str]] = defaultdict(set)
    non_null_by_field: dict[str, set[str]] = defaultdict(set)
    for entity_id, field_name in slots:
        by_field[field_name].add(entity_id)
    for entity_id, field_name in non_null_slots:
        non_null_by_field[field_name].add(entity_id)
    for field_name, entity_ids in sorted(by_field.items()):
        count = len(entity_ids)
        covered = len(non_null_by_field[field_name])
        fields[field_name] = {
            "applicable_slots": count,
            "non_null_slots": covered,
            "not_applicable_slots": 0,
            "coverage_ratio": round(covered / count, 4) if count else 0.0,
        }
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    coverage_report = {
        "run_name": "us20x20-consolidated",
        "generated_at": now,
        "metrics": {
            "institutions_total": len(output["institutions"]),
            "institutions_completed": len(output["institutions"]),
            "institutions_blocked": 0,
            "programmes_discovered": len(output["programmes"]),
            "deep_programmes_attempted": len(programme_ids),
            "deep_programmes_extracted": len(programme_ids),
            "sources_fetched": len(output["sources"]),
            "assertions_total": len(output["field_assertions"]),
            "assertions_non_null": len(non_null),
            "errors": len(output["crawl_errors"]),
            "organisation_units": organisation["organisation_units"],
            "organisation_classified_programmes": organisation[
                "classified_programmes"
            ],
        },
        "coverage": {
            "non_null_assertion_ratio": round(
                len(non_null) / len(effective), 4
            )
            if effective
            else 0.0,
            "unique_field_slots": len(slots),
            "non_null_field_slots": len(non_null_slots),
            "field_coverage": fields,
            "organisation_coverage": organisation,
        },
        "source_runs": sorted(path.name for path in source_runs_used),
    }
    _write_json(output_dir / "coverage_report.json", coverage_report)

    programme_by_id = {
        str(record.get("programme_id") or ""): record
        for record in output["programmes"]
    }
    selection_rows = [
        programme_by_id[programme_id]
        for programme_id in sorted(programme_ids)
        if programme_id in programme_by_id
    ]
    _write_json(
        output_dir / "programme_selection_report.json",
        {
            "schema_version": "GlowBalProgrammeSelection/v1",
            "generated_at": now,
            "candidate_count": len(selection_rows),
            "deep_selected_count": len(selection_rows),
            "programmes": selection_rows,
        },
    )
    manifest = {
        "schema_version": "GlowBalSmokeRun/v3-consolidated",
        "run_name": "us20x20-consolidated",
        "started_at": min(
            str(manifests[path].get("started_at") or now)
            for path in source_runs_used
        ),
        "completed_at": now,
        "institutions": institution_manifest_rows,
        "discovery_only": False,
        "run_mode": "consolidated",
        "source_runs": sorted(path.name for path in source_runs_used),
        "artifacts": [],
    }
    manifest["artifacts"] = sorted(
        str(path.relative_to(output_dir)).replace("\\", "/")
        for path in output_dir.rglob("*")
        if path.is_file()
    )
    _write_json(output_dir / "manifest.json", manifest)
    return ConsolidationResult(
        output_dir=output_dir,
        institution_count=len(output["institutions"]),
        programme_count=len(programme_ids),
        source_run_count=len(source_runs_used),
        organisation_coverage=float(organisation["coverage_ratio"]),
    )
