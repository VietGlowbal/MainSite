"""Archive already-generated Stage 1 replay outputs on Drive/Mongo.

Use this when the deterministic replay has completed and only the durable
archive step needs to be repeated.  It never runs acquisition, MAX_FILL or an
LLM call.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import run_stage1_drive_ultra_fill as drive_run


def main() -> int:
    drive_run.load_runtime_environment()
    from glowbal_ingestion.raw_evidence import create_remote_raw_evidence_store

    expected = (
        "stage1-population-classification-summary.json",
        "stage1-production-population.json",
        "stage1-production-population.sha256",
        "stage1-programme-population-audit.csv",
        "stage1-production-hierarchy-field-summary.csv",
        "stage1-production-programme-completeness.csv",
        "stage1-production-hierarchy-donor-review.csv",
        "stage1-programme-final-results.csv",
        "stage1-production-replay-summary.json",
        "stage1-max-fill-evidence.jsonl",
        "stage1-programme-max-fill-results.csv",
        "stage1-programme-max-fill-sources.csv",
        "stage1-max-fill-field-summary.csv",
        "stage1-max-fill-completeness.csv",
        "stage1-max-fill-replay-summary.json",
        "stage1-programme-ultra-max-fill-results.csv",
        "stage1-programme-ultra-max-fill-audit.csv",
        "stage1-programme-admission-packages.jsonl",
        "stage1-admission-packages-compat.csv",
        "stage1-admission-requirements-compat.csv",
        "stage1-course-admission-requirements-compat.csv",
    )
    paths = [drive_run.ARTIFACT_DIR / name for name in expected]
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        raise FileNotFoundError(f"replay outputs missing: {missing}")
    started_ns = min(path.stat().st_mtime_ns for path in paths) - 1
    run_id = f"stage1-package-compat-fix-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-drive"
    summary = drive_run.archive_generated_outputs(
        run_id=run_id,
        raw_store=create_remote_raw_evidence_store(inline_payload_max_bytes=8 * 1024 * 1024),
        acquisition_summary={
            "run_id": run_id,
            "mode": "offline_replay_archive_only",
            "network_calls": 0,
            "raw_persisted_count": 0,
            "llm_calls": 0,
            "supabase_write": False,
            "schema_fix": [
                "graduation_certificate",
                "academic_transcript",
                "admission_package_status",
                "legacy_package_columns",
                "legacy_requirement_columns",
                "course_requirement_projection_columns",
            ],
        },
        started_ns=started_ns,
    )
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
