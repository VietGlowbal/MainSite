"""Merge the main scale run with a targeted provider correction replay.

The completed main run remains immutable.  This creates a read-only analysis
view containing the main run plus the DUO canonical-ID correction, so provider
coverage can be reported over the frozen 23/46 population without rerunning
unchanged providers.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


FILES = (
    "programmes.jsonl",
    "institutions.jsonl",
    "effective_field_assertions.jsonl",
    "field_assertions.jsonl",
    "external_programme_metadata.jsonl",
    "external_field_materializations.jsonl",
    "sources.jsonl",
    "source_candidates.jsonl",
    "source_admission_decisions.jsonl",
    "source_ecosystem_fetches.jsonl",
    "raw_persistence_events.jsonl",
    "acquisition_attempts.jsonl",
    "crawl_errors.jsonl",
)


def rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def merge_jsonl(base: Path, extras: list[Path], name: str) -> list[dict[str, Any]]:
    source = rows(base / name)
    for extra in extras:
        source.extend(rows(extra / name))
    if name in {"programmes.jsonl", "institutions.jsonl"}:
        key = "programme_id" if name.startswith("programme") else "institution_id"
        unique: dict[str, dict[str, Any]] = {}
        for row in source:
            if row.get(key) is not None:
                unique[str(row[key])] = row
        return list(unique.values())
    if name in {"field_assertions.jsonl", "effective_field_assertions.jsonl"}:
        unique = {}
        for row in source:
            if row.get("assertion_id") is not None:
                unique[str(row["assertion_id"])] = row
        return list(unique.values())
    if name in {"external_programme_metadata.jsonl", "external_field_materializations.jsonl", "sources.jsonl"}:
        key = "programme_id" if name == "external_programme_metadata.jsonl" else "raw_document_id"
        unique = {}
        for row in source:
            value = row.get(key) or row.get("source_id") or row.get("source_url")
            if value is not None:
                # Metadata contains several fields per programme, so retain
                # the field in its identity; materializations/sources are one
                # record per durable document.
                if name == "external_programme_metadata.jsonl":
                    value = f"{value}|{row.get('field_name')}|{row.get('provider_id')}"
                unique[str(value)] = row
        return list(unique.values())
    return source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--extra", type=Path, action="append", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists() and any(args.out.iterdir()):
        raise SystemExit(f"Refusing to overwrite non-empty output: {args.out}")
    args.out.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        merged = merge_jsonl(args.base, args.extra, name)
        (args.out / name).write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in merged),
            encoding="utf-8",
        )
    reports = []
    for path in [args.base, *args.extra]:
        report = path / "coverage_report.json"
        if report.exists():
            reports.append(json.loads(report.read_text(encoding="utf-8")))
    (args.out / "coverage_report.json").write_text(
        json.dumps(
            {
                "run_name": "external-field-scale-20260914-consolidated",
                "base_run": str(args.base),
                "extra_runs": [str(path) for path in args.extra],
                "metrics_reports": reports,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"out": str(args.out), "files": {name: len(merge_jsonl(args.base, args.extra, name)) for name in FILES}}, indent=2))


if __name__ == "__main__":
    main()
