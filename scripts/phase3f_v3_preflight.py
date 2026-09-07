"""Fail-closed, no-provider preflight for the frozen Phase 3F V3 benchmark.

This module validates packaging and immutable inputs only.  It does not load
benchmark truth values into the ingestion pipeline and never makes a network
request.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BENCHMARK_ROOT = REPO_ROOT / "docs" / "benchmarks"
V3_MANIFEST_PATH = BENCHMARK_ROOT / "2026-09-06-phase3f-benchmark-v3-freeze.json"
V3_TRUTH_PATH = BENCHMARK_ROOT / "2026-09-06-phase3f-ground-truth-v3-frozen.jsonl"
V3_CONTRACT_MARKDOWN_PATH = BENCHMARK_ROOT / "2026-09-06-phase3f-scorer-contract-v2.md"
V3_CONTRACT_PATH = BENCHMARK_ROOT / "2026-09-06-phase3f-scorer-contract-v2.json"
ROSTER_V2_PATH = BENCHMARK_ROOT / "2026-08-30-phase-3f-roster-v2.md"
RUN_ID_PREFIX = "phase3f-v3-run-"
TRUTH_VERSION = "phase-3f-ground-truth-v3-frozen"
BENCHMARK_VERSION = "phase3f-v3"
OUTPUT_SCHEMA_VERSION = "phase3f-v3-benchmark-output/v1"

# These are the already-approved V3 checkpoint digests.  Keeping the manifest
# digest outside the manifest prevents a modified manifest from defining its
# own expected bytes.
EXPECTED_V3_TRUTH_SHA256 = "af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc"
EXPECTED_V3_MANIFEST_SHA256 = "d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c"


class V3PreflightError(RuntimeError):
    """Raised when the committed V3 benchmark package cannot be trusted."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise V3PreflightError(f"Cannot read JSON artifact: {path}") from exc
    if not isinstance(value, dict):
        raise V3PreflightError(f"JSON artifact must be an object: {path}")
    return value


def _repo_relative(path: str) -> Path:
    candidate = (REPO_ROOT / path).resolve()
    try:
        candidate.relative_to(REPO_ROOT.resolve())
    except ValueError as exc:
        raise V3PreflightError(f"Frozen artifact escapes repository root: {path}") from exc
    return candidate


def _git_value(*args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    value = result.stdout.strip()
    return value or None


def dirty_worktree() -> bool | None:
    status = _git_value("status", "--porcelain")
    return None if status is None else bool(status)


def _check_hash(path: Path, expected: str, label: str) -> str:
    if not path.exists():
        raise V3PreflightError(f"Missing frozen {label}: {path}")
    actual = sha256_file(path)
    if actual != expected:
        raise V3PreflightError(
            f"Frozen {label} checksum mismatch: expected {expected}, got {actual}"
        )
    return actual


def _manifest_artifact_paths(manifest: dict[str, Any]) -> list[tuple[str, Path, str]]:
    checks: list[tuple[str, Path, str]] = []
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, dict):
        raise V3PreflightError("V3 freeze manifest has no artifacts object")
    for name, spec in artifacts.items():
        if not isinstance(spec, dict) or not isinstance(spec.get("path"), str):
            raise V3PreflightError(f"Invalid V3 artifact specification: {name}")
        expected = spec.get("sha256")
        if not isinstance(expected, str) or not expected:
            raise V3PreflightError(f"V3 artifact has no checksum: {name}")
        checks.append((f"artifacts.{name}", _repo_relative(spec["path"]), expected))

    immutable = manifest.get("immutable_v2_hashes")
    if not isinstance(immutable, dict):
        raise V3PreflightError("V3 freeze manifest has no immutable_v2_hashes object")
    for path, expected in immutable.items():
        if not isinstance(expected, str) or not expected:
            raise V3PreflightError(f"Invalid immutable V2 checksum: {path}")
        checks.append((f"immutable_v2_hashes.{path}", _repo_relative(path), expected))

    lineage = manifest.get("lineage")
    if not isinstance(lineage, dict):
        raise V3PreflightError("V3 freeze manifest has no lineage object")
    lineage_path = lineage.get("v2_manifest")
    lineage_hash = lineage.get("v2_manifest_sha256")
    if not isinstance(lineage_path, str) or not isinstance(lineage_hash, str):
        raise V3PreflightError("V3 lineage is missing the V2 manifest reference")
    checks.append(("lineage.v2_manifest", _repo_relative(lineage_path), lineage_hash))
    return checks


def _validate_contract(manifest: dict[str, Any]) -> dict[str, Any]:
    contract = _read_json(V3_CONTRACT_PATH)
    if contract.get("version") != "phase-3f-scorer-contract/v2":
        raise V3PreflightError("V3 scorer contract version is not v2")
    if contract.get("benchmark_version") != BENCHMARK_VERSION:
        raise V3PreflightError("V3 scorer contract benchmark version mismatch")
    if contract.get("truth_version") != TRUTH_VERSION:
        raise V3PreflightError("V3 scorer contract truth version mismatch")
    if contract.get("fuzzy_only_pass") is not False:
        raise V3PreflightError("V3 scorer contract permits fuzzy-only PASS")
    if contract.get("ambiguous_is_not_pass") is not True:
        raise V3PreflightError("V3 scorer contract does not preserve ambiguity")
    if manifest.get("benchmark_version") != BENCHMARK_VERSION:
        raise V3PreflightError("V3 freeze manifest benchmark version mismatch")
    return contract


def validate_v3_integrity() -> dict[str, Any]:
    """Validate every frozen path/hash referenced by the V3 manifest."""

    _check_hash(V3_MANIFEST_PATH, EXPECTED_V3_MANIFEST_SHA256, "V3 freeze manifest")
    manifest = _read_json(V3_MANIFEST_PATH)
    if manifest.get("status") != "FROZEN":
        raise V3PreflightError("V3 freeze manifest is not FROZEN")
    if manifest.get("benchmark_version") != BENCHMARK_VERSION:
        raise V3PreflightError("V3 freeze manifest benchmark_version is not phase3f-v3")

    checks = _manifest_artifact_paths(manifest)
    digests: dict[str, str] = {}
    for label, path, expected in checks:
        digests[label] = _check_hash(path, expected, label)

    if digests.get("artifacts.ground_truth_v3") != EXPECTED_V3_TRUTH_SHA256:
        raise V3PreflightError("V3 truth does not match the approved checkpoint digest")
    _validate_contract(manifest)

    truth_lines = [line for line in V3_TRUTH_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    truth_ids = [str(json.loads(line)["case_id"]) for line in truth_lines]
    if len(truth_lines) != 252 or len(set(truth_ids)) != 252:
        raise V3PreflightError("V3 truth population must contain 252 unique records")

    matrix_path = _repo_relative(
        manifest["artifacts"]["adjudication_matrix"]["path"]
    )
    matrix_lines = [line for line in matrix_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    matrix_ids = [str(json.loads(line)["case_id"]) for line in matrix_lines]
    if len(matrix_ids) != 36 or len(set(matrix_ids)) != 36:
        raise V3PreflightError("V3 identity adjudication matrix must contain 36 unique cases")

    return {
        "benchmark_version": BENCHMARK_VERSION,
        "truth_version": TRUTH_VERSION,
        "output_schema_version": OUTPUT_SCHEMA_VERSION,
        "manifest_path": str(V3_MANIFEST_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
        "manifest_sha256": EXPECTED_V3_MANIFEST_SHA256,
        "truth_path": str(V3_TRUTH_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
        "truth_sha256": EXPECTED_V3_TRUTH_SHA256,
        "roster_path": str(ROSTER_V2_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
        "roster_sha256": digests["artifacts.roster_v2"],
        "scorer_contract_v2_path": str(V3_CONTRACT_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
        "scorer_contract_v2_sha256": digests["artifacts.scorer_contract_v2_json"],
        "machine_scorer_path": manifest["artifacts"]["machine_scorer"]["path"],
        "machine_scorer_sha256": digests["artifacts.machine_scorer"],
        "artifact_digests": digests,
        "truth_records": len(truth_lines),
        "programme_identity_cases": len(matrix_ids),
    }


def run_id_is_v3(run_id: str) -> bool:
    return bool(re.fullmatch(r"phase3f-v3-run-\d{8}T\d{6}Z", run_id))


def new_run_id(now: Any = None) -> str:
    from datetime import datetime, timezone

    timestamp = now or datetime.now(timezone.utc)
    return timestamp.strftime(f"{RUN_ID_PREFIX}%Y%m%dT%H%M%SZ")


def provider_snapshot() -> dict[str, Any]:
    provider = os.environ.get("EXTRACTION_PROVIDER", "").strip().lower()
    if not provider and os.environ.get("DEEPSEEK_API_KEY", "").strip():
        provider = "deepseek"
    return {
        "provider": provider or "unconfigured",
        "endpoint": os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
        "model": (
            os.environ.get("DEEPSEEK_MODEL", "").strip()
            or os.environ.get("EXTRACTION_MODEL", "").strip()
            or "deepseek-v4-flash"
        ),
        "api_key_loaded": bool(os.environ.get("DEEPSEEK_API_KEY", "").strip()),
        "provider_calls": 0,
    }


def preflight(*, require_clean: bool = False, run_id: str | None = None) -> dict[str, Any]:
    integrity = validate_v3_integrity()
    dirty = dirty_worktree()
    if require_clean and dirty:
        raise V3PreflightError("Official V3 execution requires a clean tracked worktree")
    candidate_run_id = run_id or new_run_id()
    if not run_id_is_v3(candidate_run_id):
        raise V3PreflightError(f"Invalid V3 run ID: {candidate_run_id}")
    return {
        **integrity,
        "code_revision": _git_value("rev-parse", "HEAD"),
        "dirty_worktree": dirty,
        "run_id_prefix": RUN_ID_PREFIX,
        "run_id": candidate_run_id,
        "truth_isolation": {
            "expected_values_loaded_by_pipeline": False,
            "review_decisions_loaded_by_pipeline": False,
            "scorer_invoked_before_seal": False,
        },
        "provider": provider_snapshot(),
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-clean", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(preflight(require_clean=args.require_clean), ensure_ascii=False, indent=2))
    except (OSError, ValueError, V3PreflightError) as exc:
        print(json.dumps({"status": "FAILED", "error": str(exc)}), flush=True)
        raise SystemExit(1)
