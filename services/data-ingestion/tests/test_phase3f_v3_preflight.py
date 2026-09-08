from __future__ import annotations

import importlib
import json
import sys
import tempfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

preflight_module = importlib.import_module("scripts.phase3f_v3_preflight")
scorer_module = importlib.import_module("glowbal_ingestion.benchmark_scorer")


def test_v3_preflight_uses_frozen_versions_and_hashes() -> None:
    result = preflight_module.preflight(require_clean=False)

    assert result["benchmark_version"] == "phase3f-v3"
    assert result["truth_version"] == "phase-3f-ground-truth-v3-frozen"
    assert result["roster_path"].endswith("2026-08-30-phase-3f-roster-v2.md")
    assert result["scorer_contract_v2_path"].endswith(
        "2026-09-06-phase3f-scorer-contract-v2.json"
    )
    assert result["run_id"].startswith("phase3f-v3-run-")
    assert isinstance(result["dirty_worktree"], bool)
    assert result["truth_isolation"]["expected_values_loaded_by_pipeline"] is False
    assert result["provider"]["provider_calls"] == 0


def test_v3_run_id_format_is_strict() -> None:
    assert preflight_module.run_id_is_v3("phase3f-v3-run-20260907T120000Z")
    assert not preflight_module.run_id_is_v3("phase3f-v2-run-20260907T120000Z")
    assert not preflight_module.run_id_is_v3("phase3f-v3-run-test")


def test_preflight_can_require_clean_worktree(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(preflight_module, "dirty_worktree", lambda: True)

    with pytest.raises(preflight_module.V3PreflightError, match="clean tracked worktree"):
        preflight_module.preflight(require_clean=True)


def test_missing_manifest_artifact_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    missing = preflight_module.REPO_ROOT / "docs" / "benchmarks" / "__missing_frozen_test__.json"
    monkeypatch.setattr(
        preflight_module,
        "_manifest_artifact_paths",
        lambda _manifest: [("artifacts.missing", missing, "0" * 64)],
    )

    with pytest.raises(preflight_module.V3PreflightError, match="Missing frozen"):
        preflight_module.validate_v3_integrity()


def test_hash_mismatch_fails_closed() -> None:
    with pytest.raises(preflight_module.V3PreflightError, match="checksum mismatch"):
        preflight_module._check_hash(
            preflight_module.V3_TRUTH_PATH, "0" * 64, "test artifact"
        )


def test_v3_scorer_uses_frozen_v3_contract_without_provider_calls() -> None:
    truth = [
        json.loads(line)
        for line in preflight_module.V3_TRUTH_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    records = []
    for item in truth:
        state = item["expected_state"] if item["review_status"] == "REVIEWED_CONFIRMED" else "NEEDS_REVIEW"
        identity_v3 = item.get("programme_identity_v3") or {}
        value = item["expected_value"]
        if item["field"] == "programme_identity" and identity_v3:
            value = identity_v3["canonical_programme_identity"]
        records.append(
            {
                "case_id": item["case_id"],
                "field": item["field"],
                "state": state,
                "value": value if state == "FOUND" else None,
                "normalized_value": item.get("normalized_value") if state == "FOUND" else None,
                "identity": {
                    "resolved": True,
                    "institution": item["institution"],
                    "programme": item["programme"],
                    **(
                        {
                            "canonical_programme_identity": identity_v3[
                                "canonical_programme_identity"
                            ],
                            "source_native_identity": identity_v3.get(
                                "source_native_identity"
                            ),
                            "entity_type": identity_v3.get("entity_type"),
                            "track": identity_v3.get("track"),
                            "stage": identity_v3.get("stage"),
                        }
                        if identity_v3
                        else {}
                    ),
                },
            }
        )
    output = {
        "schema_version": preflight_module.OUTPUT_SCHEMA_VERSION,
        "run_id": "phase3f-v3-run-20260907T120000Z",
        "truth_version": preflight_module.TRUTH_VERSION,
        "discovery": {
            "programme_keys": [f"roster-v2-row-{index}" for index in range(1, 37)],
            "required_source_keys": [
                f"roster-v2-row-{index}-primary" for index in range(1, 37)
            ],
        },
        "records": records,
    }

    with tempfile.TemporaryDirectory() as directory:
        output_path = Path(directory) / "v3-output.json"
        output_path.write_text(json.dumps(output), encoding="utf-8")
        result = scorer_module.score(
            truth_path=preflight_module.V3_TRUTH_PATH,
            manifest_path=preflight_module.V3_MANIFEST_PATH,
            contract_path=preflight_module.V3_CONTRACT_PATH,
            output_path=output_path,
        )

    assert result["truth_version"] == preflight_module.TRUTH_VERSION
    assert result["metrics"]["truth_comparison_failures"] == 0
