"""Replay the repaired Stage 1 package schema and archive it on Drive/Mongo.

This follow-up is deliberately offline: it reads the frozen Stage 1 evidence,
runs deterministic MAX_FILL and ultra, and then archives the changed artifacts.
It does not invoke the provider acquisition loop, an LLM, or Supabase.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import datetime, timezone


import run_stage1_drive_ultra_fill as drive_run


def main() -> int:
    started_ns = time.time_ns()
    drive_run.load_runtime_environment()
    from glowbal_ingestion.raw_evidence import create_remote_raw_evidence_store

    raw_store = create_remote_raw_evidence_store(inline_payload_max_bytes=8 * 1024 * 1024)
    run_id = f"stage1-package-schema-fix-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-drive"
    child_env = os.environ.copy()
    subprocess.run(
        [sys.executable, str(drive_run.ARTIFACT_DIR / "expand_stage1_max_fill.py")],
        cwd=str(drive_run.REPO_ROOT),
        env=child_env,
        check=True,
    )
    subprocess.run(
        [sys.executable, str(drive_run.ARTIFACT_DIR / "ultra_max_fill_stage1.py")],
        cwd=str(drive_run.REPO_ROOT),
        env=child_env,
        check=True,
    )
    summary = drive_run.archive_generated_outputs(
        run_id=run_id,
        raw_store=raw_store,
        acquisition_summary={
            "run_id": run_id,
            "mode": "offline_replay",
            "network_calls": 0,
            "raw_persisted_count": 0,
            "llm_calls": 0,
            "supabase_write": False,
            "schema_fix": [
                "graduation_certificate",
                "academic_transcript",
                "admission_package_status",
            ],
        },
        started_ns=started_ns,
    )
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
