"""Preflight the frozen Phase 3F benchmark without running v3."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

from glowbal_ingestion.benchmark_scorer import (
    OUTPUT_SCHEMA_VERSION,
    load_contract,
    load_output,
    load_truth,
    sha256_file,
)

ROOT = Path(__file__).resolve().parents[1]
TRUTH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
ROSTER = ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
MANIFEST = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json"
CONTRACT_MD = ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md"
CONTRACT_JSON = ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json"
COMPLETION = ROOT / "docs/benchmarks/2026-09-01-phase-3f-human-review-complete.md"

AMBIGUOUS_IDS = {
    "GT-V2-05-tuition",
    "GT-V2-05-major_admissions_requirement",
    "GT-V2-06-tuition",
    "GT-V2-11-major_admissions_requirement",
    "GT-V2-12-tuition",
    "GT-V2-13-major_admissions_requirement",
}
RAW_KEYS = {
    "raw_html",
    "raw_body",
    "document_body",
    "page_body",
    "html_body",
    "raw_document_body",
}
FORBIDDEN_OUTPUT_KEYS = {
    "product_state",
    "provenance",
    "quality",
    "pipeline_output",
    "benchmark_output",
    "output_state",
    "actual_value",
}


def _walk(value: object, key: str = ""):
    yield key, value
    if isinstance(value, dict):
        for child_key, child_value in value.items():
            yield from _walk(child_value, str(child_key))
    elif isinstance(value, list):
        for child_value in value:
            yield from _walk(child_value, key)


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def run() -> dict[str, object]:
    for path in (TRUTH, ROSTER, MANIFEST, CONTRACT_MD, CONTRACT_JSON, COMPLETION):
        _assert(path.exists(), f"missing required preflight artifact: {path}")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    contract = load_contract(CONTRACT_JSON)
    truth = load_truth(TRUTH, manifest=manifest)
    _assert(len(truth) == 252, "truth record count is not 252")
    _assert(len({item["case_id"] for item in truth}) == 252, "truth IDs are not unique")
    status_counts = Counter(str(item.get("review_status")) for item in truth)
    _assert(status_counts == Counter({"REVIEWED_CONFIRMED": 246, "REVIEWED_AMBIGUOUS": 6}), f"unexpected statuses: {dict(status_counts)}")
    _assert(not any(item.get("review_status") == "UNREVIEWED" for item in truth), "UNREVIEWED truth exists")
    actual_ambiguous = {str(item["case_id"]) for item in truth if item.get("review_status") == "REVIEWED_AMBIGUOUS"}
    _assert(actual_ambiguous == AMBIGUOUS_IDS, "ambiguous IDs differ from approved set")
    field_counts = Counter(str(item.get("field")) for item in truth)
    _assert(all(field_counts[field] == 36 for field in {
        "programme_identity", "credential", "programme_status", "tuition",
        "application_deadline", "english_requirement", "major_admissions_requirement",
    }), f"unexpected field counts: {dict(field_counts)}")
    expected_state_counts = Counter(
        "null" if item.get("expected_state") is None else str(item.get("expected_state"))
        for item in truth
    )
    _assert(expected_state_counts == Counter({"FOUND": 118, "NEEDS_REVIEW": 127, "NOT_REQUIRED": 4, "null": 3}), f"unexpected truth states: {dict(expected_state_counts)}")
    confirmed_needs_review_null = sum(
        item.get("review_status") == "REVIEWED_CONFIRMED"
        and item.get("expected_state") == "NEEDS_REVIEW"
        and item.get("expected_value") is None
        for item in truth
    )
    _assert(confirmed_needs_review_null == 124, "confirmed NEEDS_REVIEW/null count is not 124")
    _assert(manifest.get("scoreable_records") == 246, "manifest scoreable count is not 246")
    _assert(manifest.get("reviewed_confirmed") == 246, "manifest confirmed count is not 246")
    _assert(manifest.get("reviewed_ambiguous") == 6, "manifest ambiguous count is not 6")
    _assert(manifest.get("unreviewed") == 0, "manifest unreviewed count is not 0")
    batch_counts = Counter(str(item.get("review_batch")) for item in truth)
    _assert(
        batch_counts == Counter({f"batch-{index}": 21 for index in range(1, 13)}),
        f"batch record counts are not 12 x 21: {dict(batch_counts)}",
    )
    correction_rejects = sum(
        sum(1 for event in item.get("review_history", []) if event.get("decision") == "REJECT")
        for item in truth
    )
    _assert(correction_rejects == manifest.get("correction_chain_count") == 13, "correction-chain count mismatch")
    _assert(contract.get("truth_sha256") == manifest.get("truth_sha256"), "contract/manifest truth checksum differs")
    _assert(sha256_file(TRUTH) == manifest.get("truth_sha256"), "frozen truth checksum mismatch")
    _assert(sha256_file(ROSTER) == manifest.get("roster_sha256"), "frozen roster checksum mismatch")
    _assert(sha256_file(CONTRACT_MD) == manifest.get("scorer_contract_sha256"), "Markdown contract checksum mismatch")
    _assert(sha256_file(CONTRACT_JSON) == manifest.get("scorer_contract_machine_sha256"), "machine contract checksum mismatch")
    _assert(contract.get("output_schema_version") == OUTPUT_SCHEMA_VERSION, "output schema version is not locked")
    _assert("All batches 1-12 are CLOSED" in COMPLETION.read_text(encoding="utf-8"), "completion artifact does not record all batches closed")

    for item in truth:
        if item.get("review_status") == "REVIEWED_CONFIRMED" and item.get("expected_state") == "NEEDS_REVIEW":
            _assert(item.get("expected_value") is None, f"confirmed unresolved case has a value: {item['case_id']}")
    raw_hits = [key for item in truth for key, _ in _walk(item) if key.casefold() in RAW_KEYS]
    _assert(not raw_hits, f"raw document body keys found in frozen truth: {raw_hits[:3]}")
    output_hits = [key for item in truth for key, _ in _walk(item) if key in FORBIDDEN_OUTPUT_KEYS]
    _assert(not output_hits, f"v3/output keys found in frozen truth: {output_hits[:3]}")
    canonical_mojibake = []
    audit_keys = {"review_history", "correction_note", "review_note"}
    for item in truth:
        for key, value in _walk({k: v for k, v in item.items() if k not in audit_keys}):
            if isinstance(value, str) and ("\ufffd" in value or "\u00e2\u20ac\u201c" in value or "\u00e2\u20ac\u201d" in value):
                canonical_mojibake.append((item["case_id"], key))
    _assert(not canonical_mojibake, f"canonical frozen value contains mojibake: {canonical_mojibake[:3]}")

    synthetic = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "run_id": "phase3f-v2-run-preflight-schema",
        "truth_version": manifest["truth_version"],
        "records": [
            {
                "case_id": "GT-V2-01-programme_status",
                "state": "NEEDS_REVIEW",
                "value": None,
                "product_state": "REVIEWABLE",
            }
        ],
    }
    with tempfile.TemporaryDirectory(prefix="phase3f-v2-preflight-", dir=ROOT / "docs/benchmarks") as directory:
        output_path = Path(directory) / "normalized-output.json"
        output_path.write_text(json.dumps(synthetic), encoding="utf-8")
        load_output(output_path)
        future_run = Path(directory) / "phase3f-v2-run-future-placeholder"
        future_run.mkdir()
        _assert(future_run.is_dir(), "future run directory could not be created")

    env = os.environ.copy()
    source_path = str(ROOT / "services/data-ingestion/src")
    env["PYTHONPATH"] = source_path + os.pathsep + env.get("PYTHONPATH", "")
    test = subprocess.run(
        [sys.executable, "-m", "pytest", "services/data-ingestion/tests/test_benchmark_scorer.py", "-q"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    _assert(test.returncode == 0, f"scorer tests failed:\n{test.stdout}\n{test.stderr}")
    return {
        "status": "PASS",
        "truth_records": len(truth),
        "primary_scoreable_records": sum(
            item.get("review_status") == "REVIEWED_CONFIRMED" for item in truth
        ),
        "ambiguous_records": len(actual_ambiguous),
        "batch_counts": dict(sorted(batch_counts.items())),
        "correction_chains": correction_rejects,
        "output_schema": OUTPUT_SCHEMA_VERSION,
        "checksums_verified": True,
        "scorer_tests": "PASS",
        "future_run_directory": "CREATABLE_AND_REMOVED",
        "actual_benchmark_execution": "NOT_RUN",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(), indent=2))
    except Exception as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, indent=2))
        raise SystemExit(1)
