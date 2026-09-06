"""Create the versioned Phase 3F truth copy and freeze manifest once."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parents[1]
WORKING_TRUTH = ROOT / "docs/benchmarks/2026-08-30-phase-3f-ground-truth-v2.jsonl"
FROZEN_TRUTH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
ROSTER = ROOT / "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md"
CONTRACT_MD = ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md"
CONTRACT_JSON = ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json"
MANIFEST = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json"
REVIEW_COMPLETION = ROOT / "docs/benchmarks/2026-09-01-phase-3f-human-review-complete.md"

AMBIGUOUS_IDS = {
    "GT-V2-05-tuition",
    "GT-V2-05-major_admissions_requirement",
    "GT-V2-06-tuition",
    "GT-V2-11-major_admissions_requirement",
    "GT-V2-12-tuition",
    "GT-V2-13-major_admissions_requirement",
}
CRITICAL_FIELDS = {
    "programme_identity",
    "credential",
    "programme_status",
    "tuition",
    "application_deadline",
    "english_requirement",
    "major_admissions_requirement",
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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_value(*args: str) -> str | None:
    try:
        value = subprocess.check_output(
            ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    return value or None


def _keys(value: object):
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key)
            yield from _keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _keys(child)


def validate_reviewed_truth() -> tuple[list[dict], Counter[str], Counter[str]]:
    rows = [
        json.loads(line)
        for line in WORKING_TRUTH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if any(not isinstance(row, dict) for row in rows):
        raise SystemExit("Refusing freeze: every reviewed truth line must be an object.")
    ids = [str(row.get("case_id")) for row in rows]
    statuses = Counter(str(row.get("review_status")) for row in rows)
    states = Counter(str(row.get("expected_state")) for row in rows)
    fields = Counter(str(row.get("field")) for row in rows)
    batches = Counter(str(row.get("review_batch")) for row in rows)
    actual_ambiguous = {
        str(row["case_id"])
        for row in rows
        if row.get("review_status") == "REVIEWED_AMBIGUOUS"
    }
    if len(rows) != 252 or len(set(ids)) != 252:
        raise SystemExit("Refusing freeze: reviewed truth is not 252 unique records.")
    if statuses != Counter({"REVIEWED_CONFIRMED": 246, "REVIEWED_AMBIGUOUS": 6}):
        raise SystemExit(f"Refusing freeze: status counts are {dict(statuses)}.")
    if actual_ambiguous != AMBIGUOUS_IDS:
        raise SystemExit("Refusing freeze: ambiguous case IDs differ from approved set.")
    if set(fields) != CRITICAL_FIELDS or any(count != 36 for count in fields.values()):
        raise SystemExit(f"Refusing freeze: field allocation is {dict(fields)}.")
    if batches != Counter({f"batch-{index}": 21 for index in range(1, 13)}):
        raise SystemExit(f"Refusing freeze: batch closure allocation is {dict(batches)}.")
    if not REVIEW_COMPLETION.exists() or "All batches 1-12 are CLOSED" not in REVIEW_COMPLETION.read_text(encoding="utf-8"):
        raise SystemExit("Refusing freeze: human-review completion does not close all 12 batches.")
    if any(key in FORBIDDEN_OUTPUT_KEYS for row in rows for key in _keys(row)):
        raise SystemExit("Refusing freeze: reviewed truth contains v3/output fields.")
    if any(
        row.get("review_status") == "REVIEWED_CONFIRMED"
        and row.get("expected_state") == "NEEDS_REVIEW"
        and row.get("expected_value") is not None
        for row in rows
    ):
        raise SystemExit("Refusing freeze: confirmed NEEDS_REVIEW has a non-null value.")
    correction_rejects = sum(
        sum(1 for event in row.get("review_history", []) if event.get("decision") == "REJECT")
        for row in rows
    )
    if correction_rejects != 13:
        raise SystemExit(f"Refusing freeze: correction-chain count is {correction_rejects}, expected 13.")
    return rows, statuses, states


def build_contract(
    truth_hash: str,
    *,
    scoreable_records: int,
    confirmed_needs_review_null: int,
) -> dict:
    return {
        "version": "phase-3f-scorer-contract/v1",
        "benchmark_version": "phase3f-v2",
        "truth_version": "phase-3f-ground-truth-v2-frozen",
        "truth_sha256": truth_hash,
        "contract_markdown": "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md",
        "output_schema_version": "phase3f-v3-benchmark-output/v1",
         "scoreability": {
            "all_reviewed_cases": 252,
            "primary_scoreable_status": "REVIEWED_CONFIRMED",
            "primary_scoreable_cases": scoreable_records,
            "ambiguous_cases": 6,
            "ambiguous_case_ids": sorted(AMBIGUOUS_IDS),
            "ambiguous_primary_denominator": False,
        },
        "truth_state_policy": {
            "FOUND": "runtime FOUND with exact conservative field-aware value match",
            "NEEDS_REVIEW": "runtime NEEDS_REVIEW with null value and no PRODUCT_SAFE promotion",
            "NEEDS_REVIEW_concrete_value": "never accepted; count as false-current/promotion when emitted outside runtime NEEDS_REVIEW",
            "NOT_REQUIRED": "runtime NOT_REQUIRED with null value",
            "NOT_PUBLISHED": "runtime NOT_PUBLISHED with null value",
            "runtime_failures": "coverage or operational loss, never an automatic truth pass",
        },
        "runtime_states": [
            "NOT_EVALUATED",
            "FOUND",
            "NOT_PUBLISHED",
            "NOT_REQUIRED",
            "SOURCE_NOT_FOUND",
            "ACCESS_BLOCKED",
            "FETCH_FAILED",
            "PARSE_FAILED",
            "EXTRACTION_FAILED",
            "STALE_ONLY",
            "CONFLICTING_SOURCES",
            "NEEDS_REVIEW",
        ],
        "critical_fields": [
            "programme_identity",
            "credential",
            "programme_status",
            "tuition",
            "application_deadline",
            "english_requirement",
            "major_admissions_requirement",
        ],
         "denominators": {
            "programme_discovery_recall": "36 frozen roster programme rows",
            "required_source_discovery_recall": "36 frozen roster primary-source rows",
            "critical_field_precision": "resolved output records in FOUND/NOT_REQUIRED/NOT_PUBLISHED states",
            "critical_field_recall_resolved_coverage": "primary truth records with resolved FOUND/NOT_REQUIRED/NOT_PUBLISHED states",
            "safe_unresolved_correctness": f"all {confirmed_needs_review_null} confirmed NEEDS_REVIEW/null records",
            "product_safe_evidence_entailment": "primary output records marked PRODUCT_SAFE",
        },
        "thresholds": {
            "programme_discovery_recall": 0.90,
            "programme_discovery_recall_per_institution": 0.80,
            "required_source_discovery_recall": 0.90,
            "critical_field_precision": 0.98,
            "reviewed_product_safe_evidence_entailment": 1.0,
            "false_current_critical": 0,
            "fuzzy_only_auto_merge": 0,
            "critical_unresolved_conflict_promoted": 0,
            "critical_source_not_found_promoted": 0,
            "critical_stale_only_promoted": 0,
            "prohibited_high_volatility_inferred_critical_promoted": 0,
            "product_safe_without_durable_provenance": 0,
        },
        "error_taxonomy": [
            "DISCOVERY",
            "SOURCE_SELECTION",
            "FETCH",
            "PARSING",
            "EXTRACTION",
            "APPLICABILITY",
            "TEMPORAL",
            "CONFLICT",
            "RECOVERY",
            "IDENTITY",
            "QUALITY_POLICY",
            "PROMOTION",
            "GROUND_TRUTH_AMBIGUOUS",
        ],
        "product_safety": {
            "canonical_module": "glowbal_ingestion.product_safety",
            "lifecycle_product_safe": "PRODUCT_SAFE",
            "required_blockers": [
                "MISSING_CRITICAL_FIELD",
                "STALE_CRITICAL_FIELD",
                "UNRESOLVED_CONFLICT",
                "IDENTITY_UNRESOLVED",
                "INFERRED_HIGH_VOLATILITY_CRITICAL",
                "INSUFFICIENT_AUTHORITY",
                "RAW_LINEAGE_MISSING",
                "REVIEW_REQUIRED",
                "RETIRED_ENTITY",
            ],
            "required_identity": "resolved=true or resolution_state RESOLVED/CREATED",
            "raw_persistence_failure_maps_to": "RAW_LINEAGE_MISSING",
            "evidence_entailment": "durable lineage, assertion linkage, authority, applicability, temporal state, and blocker checks are deterministic; unresolved semantic entailment is REVIEW_REQUIRED",
        },
         "integrity": {
             "verify_truth_roster_and_contract_checksums_before_scoring": True,
             "fail_closed_on_mismatch": True,
         },
         "isolation": {
            "pipeline_access_to_truth": False,
            "scorer_invokes_pipeline": False,
            "scorer_writes_truth_or_product": False,
            "future_run_id_format": "phase3f-v2-run-<timestamp-or-id>",
        },
    }


def state_counts(rows: list[dict]) -> dict[str, int]:
    return dict(
        Counter(
            "null" if row.get("expected_state") is None else str(row.get("expected_state"))
            for row in rows
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="not supported; versioned freeze is write-once")
    args = parser.parse_args()
    if args.force:
        raise SystemExit("--force is intentionally unsupported; create a new version instead.")
    for path in (WORKING_TRUTH, ROSTER, CONTRACT_MD):
        if not path.exists():
            raise SystemExit(f"Refusing freeze: missing {path}.")
    if any(path.exists() for path in (FROZEN_TRUTH, CONTRACT_JSON, MANIFEST)):
        raise SystemExit("Refusing freeze: one or more versioned freeze artifacts already exist.")

    rows, statuses, states = validate_reviewed_truth()
    copyfile(WORKING_TRUTH, FROZEN_TRUTH)
    truth_hash = sha256(FROZEN_TRUTH)
    roster_hash = sha256(ROSTER)
    contract_hash = sha256(CONTRACT_MD)

    scoreable_records = statuses["REVIEWED_CONFIRMED"]
    confirmed_needs_review_null = sum(
        row.get("review_status") == "REVIEWED_CONFIRMED"
        and row.get("expected_state") == "NEEDS_REVIEW"
        and row.get("expected_value") is None
        for row in rows
    )
    contract = build_contract(
        truth_hash,
        scoreable_records=scoreable_records,
        confirmed_needs_review_null=confirmed_needs_review_null,
    )
    CONTRACT_JSON.write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    contract_json_hash = sha256(CONTRACT_JSON)
    dirty = bool(git_value("status", "--porcelain"))
    manifest = {
        "benchmark_version": "phase3f-v2",
        "truth_version": "phase-3f-ground-truth-v2-frozen",
        "roster_version": "phase-3f-roster-v2",
        "schema_version": "phase3f-ground-truth/v2",
        "scorer_contract_version": "phase-3f-scorer-contract/v1",
        "freeze_timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "freeze_commit_sha": git_value("rev-parse", "HEAD"),
        "dirty_worktree": dirty,
        "total_records": len(rows),
         "scoreable_records": scoreable_records,
        "reviewed_confirmed": statuses["REVIEWED_CONFIRMED"],
        "reviewed_ambiguous": statuses["REVIEWED_AMBIGUOUS"],
        "unreviewed": statuses["UNREVIEWED"],
        "ambiguous_case_ids": sorted(AMBIGUOUS_IDS),
        "field_counts": dict(Counter(str(row.get("field")) for row in rows)),
        "expected_state_counts": state_counts(rows),
        "primary_expected_state_counts": dict(
            Counter(
                "null" if row.get("expected_state") is None else str(row.get("expected_state"))
                for row in rows
                if row.get("review_status") == "REVIEWED_CONFIRMED"
            )
        ),
         "confirmed_needs_review_null": confirmed_needs_review_null,
         "correction_chain_count": sum(
             sum(1 for event in row.get("review_history", []) if event.get("decision") == "REJECT")
             for row in rows
         ),
        "review_completion_artifact": "docs/benchmarks/2026-09-01-phase-3f-human-review-complete.md",
        "truth_file": "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl",
        "reviewed_working_truth_file": "docs/benchmarks/2026-08-30-phase-3f-ground-truth-v2.jsonl",
        "roster_file": "docs/benchmarks/2026-08-30-phase-3f-roster-v2.md",
        "scorer_contract_file": "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md",
        "scorer_contract_machine_file": "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json",
        "truth_sha256": truth_hash,
        "reviewed_working_truth_sha256": sha256(WORKING_TRUTH),
        "roster_sha256": roster_hash,
        "scorer_contract_sha256": contract_hash,
        "scorer_contract_machine_sha256": contract_json_hash,
        "checksums": {
            "truth": truth_hash,
            "roster": roster_hash,
            "scorer_contract": contract_hash,
            "scorer_contract_machine": contract_json_hash,
        },
        "immutability": {
            "mode": "versioned-copy-write-once",
            "mutate_in_place": False,
            "changed_truth_requires_new_version": True,
        },
        "node_runtime_policy": {
            "selected_version": "22.15.0",
            "nominal_requirement": "24.19.x",
            "node_24_verification": "DEFERRED / UNVERIFIED",
        },
    }
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "PASS", "manifest": str(MANIFEST)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
