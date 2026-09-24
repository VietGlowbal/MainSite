"""Run the deterministic Stage 1 acquisition and advisory fills on Drive/Mongo.

This is an operator runner for the frozen 230-programme Stage 1 population.
The legacy acquisition module is intentionally kept as the field/provider
logic; this wrapper adds the durable raw-evidence boundary and archives every
derived result.  It never imports or writes Supabase and it removes model
credentials from the child process before running the offline fill steps.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVICE_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
ARTIFACT_DIR = (
    REPO_ROOT / "docs" / "architecture" / "data" / "external-field-stage1-20260915"
)
DEFAULT_ENV_FILES = (
    Path("D:/projects/Glowbal/MainSite/.env.local"),
    REPO_ROOT / ".env.local",
)
ARCHIVE_ROOT = Path(r"G:\My Drive\DataPlatform")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def select_environment_file() -> Path:
    """Choose the configured MongoDB driver environment, not Atlas SQL."""

    explicit = os.environ.get("DATA_PLATFORM_ENV_FILE", "").strip()
    candidates = [Path(explicit)] if explicit else list(DEFAULT_ENV_FILES)
    candidates = [path for path in candidates if path.exists()]
    if not candidates:
        raise FileNotFoundError("No Data Platform dotenv file was found.")

    for path in candidates:
        text = path.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r"^MONGODB_URI=(.*)$", text, re.MULTILINE)
        uri = (match.group(1).strip().strip('"') if match else "")
        host = re.sub(r"^.*?://", "", uri).split("/", 1)[0].split("@")[-1].split("?", 1)[0]
        if host and "atlas-sql" not in host.casefold() and uri.startswith(("mongodb+srv://", "mongodb://")):
            return path
    return candidates[0]


def load_runtime_environment() -> None:
    if str(SERVICE_SRC) not in sys.path:
        sys.path.insert(0, str(SERVICE_SRC))
    from glowbal_ingestion.config import load_dotenv_if_present

    selected_env_file = select_environment_file()
    os.environ.pop("MONGODB_URI", None)
    os.environ.pop("MONGODB_DATABASE", None)
    load_dotenv_if_present(selected_env_file, override=True)
    os.environ["DATA_PLATFORM_SELECTED_ENV_FILE"] = str(selected_env_file)
    # The run is deliberately model-free and Drive-only.  Clearing these
    # values also prevents a child module from accidentally constructing a
    # Supabase compatibility client from the developer .env file.
    for key in list(os.environ):
        upper = key.upper()
        if (
            upper.startswith("SUPABASE")
            or upper.startswith("NEXT_PUBLIC_SUPABASE")
            or "DEEPSEEK" in upper
            or "OPENAI" in upper
            or "ANTHROPIC" in upper
            or "EXTRACTION_API" in upper
        ):
            os.environ.pop(key, None)
    os.environ["DATA_PLATFORM_ARTIFACT_BACKEND"] = "google_drive_desktop"
    os.environ["DATA_PLATFORM_ARCHIVE_ROOT"] = str(ARCHIVE_ROOT)
    os.environ["RAW_EVIDENCE_MODE"] = "remote"
    os.environ["EXTERNAL_STRUCTURED_STAGING_ENABLED"] = "auto"


def content_type_for(url: str, provider_id: str, body: bytes) -> str:
    lower_url = url.casefold()
    lower_provider = provider_id.casefold()
    if body.startswith(b"%PDF"):
        return "application/pdf"
    if ".csv" in lower_url or "onisep" in lower_provider:
        return "text/csv"
    if ".json" in lower_url or "studyinfo" in lower_provider or "duo" in lower_provider:
        return "application/json"
    guessed, _ = mimetypes.guess_type(urlsplit(url).path)
    if guessed:
        return guessed
    return "text/html"


def archive_generated_outputs(
    *,
    run_id: str,
    raw_store: Any,
    acquisition_summary: Mapping[str, Any],
    started_ns: int,
) -> dict[str, Any]:
    """Archive files touched by this invocation and index them in Mongo."""

    from glowbal_ingestion.artifact_store import GoogleDriveDesktopArtifactStore

    store = GoogleDriveDesktopArtifactStore(ARCHIVE_ROOT)
    touched: list[Path] = []
    for path in ARTIFACT_DIR.rglob("*"):
        if not path.is_file():
            continue
        try:
            stat = path.stat()
        except OSError:
            continue
        if stat.st_mtime_ns >= started_ns:
            touched.append(path)
    touched.sort()

    artifacts: list[dict[str, Any]] = []
    for path in touched:
        payload = path.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        suffix = path.suffix.casefold()
        content_type = {
            ".csv": "text/csv",
            ".json": "application/json",
            ".jsonl": "application/json",
            ".md": "text/markdown",
            ".sha256": "text/plain",
        }.get(suffix, "application/octet-stream")
        reference = store.put(
            payload,
            content_hash=digest,
            content_type=content_type,
        )
        artifacts.append(
            {
                "relative_path": path.relative_to(ARTIFACT_DIR).as_posix(),
                "content_hash": reference.content_hash,
                "content_length": reference.content_length,
                "content_type": reference.content_type,
                "locator": reference.key,
                "local_state": reference.local_state,
                "readback_state": reference.readback_state,
                "cloud_sync_state": reference.cloud_sync_state,
            }
        )

    manifest = {
        "schema_version": "stage1-drive-run/v1",
        "run_id": run_id,
        "population_id": "external-field-stage1-20260915",
        "created_at": utc_now(),
        "backend": "google_drive_desktop",
        "archive_root": "DataPlatform",
        "supabase_write": False,
        "llm_calls": 0,
        "acquisition": dict(acquisition_summary),
        "artifacts": artifacts,
    }
    manifest_payload = (
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    manifest_hash = hashlib.sha256(manifest_payload).hexdigest()
    manifest_reference = store.put(
        manifest_payload,
        content_hash=manifest_hash,
        content_type="application/json",
    )
    manifest_record = {
        "relative_path": "run-manifest.json",
        "content_hash": manifest_reference.content_hash,
        "content_length": manifest_reference.content_length,
        "content_type": manifest_reference.content_type,
        "locator": manifest_reference.key,
        "local_state": manifest_reference.local_state,
        "readback_state": manifest_reference.readback_state,
        "cloud_sync_state": manifest_reference.cloud_sync_state,
    }
    manifest["manifest"] = manifest_record

    # Mongo stores bounded lineage and the Drive locator; the complete
    # manifest remains an immutable Drive object.
    database = raw_store._db()  # MongoRawEvidenceStore's durable DB handle.
    collection = database["stage1_derived_artifacts"]
    collection.create_index(
        [("run_id", 1), ("relative_path", 1)],
        name="stage1_run_relative_path",
        unique=True,
    )
    for artifact in (*artifacts, manifest_record):
        collection.replace_one(
            {"run_id": run_id, "relative_path": artifact["relative_path"]},
            {
                "run_id": run_id,
                "population_id": manifest["population_id"],
                "relative_path": artifact["relative_path"],
                "content_hash": artifact["content_hash"],
                "content_length": artifact["content_length"],
                "content_type": artifact["content_type"],
                "locator": artifact["locator"],
                "local_state": artifact["local_state"],
                "readback_state": artifact["readback_state"],
                "cloud_sync_state": artifact["cloud_sync_state"],
                "created_at": manifest["created_at"],
                "schema_version": "stage1-derived-artifact/v1",
            },
            upsert=True,
        )

    # Write a small local pointer for operators; it contains no credentials.
    pointer = ARTIFACT_DIR / f"stage1-drive-run-{run_id}-manifest.json"
    pointer.write_text(
        json.dumps(
            {
                "run_id": run_id,
                "manifest": manifest_record,
                "artifact_count": len(artifacts),
                "raw_persisted_count": acquisition_summary.get("raw_persisted_count", 0),
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return {
        "run_id": run_id,
        "artifact_count": len(artifacts),
        "raw_persisted_count": acquisition_summary.get("raw_persisted_count", 0),
        "manifest": manifest_record,
        "mongo_collection": "stage1_derived_artifacts",
    }


def main() -> int:
    started_ns = time.time_ns()
    load_runtime_environment()
    from glowbal_ingestion.raw_evidence import (
        RawSnapshotInput,
        create_remote_raw_evidence_store,
        source_identity_for_url,
    )

    raw_store = create_remote_raw_evidence_store(inline_payload_max_bytes=8 * 1024 * 1024)

    # Import the legacy deterministic provider logic only after the durable
    # boundary and environment are fixed.
    if str(ARTIFACT_DIR) not in sys.path:
        sys.path.insert(0, str(ARTIFACT_DIR))
    import acquire_stage1_coverage as stage1

    run_id = f"stage1-coverage-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-drive"
    stage1.RUN_ID = run_id
    run_retrieved_at = utc_now()
    stage1.RETRIEVED_AT = run_retrieved_at
    stage1.REPLAY_DIR = ARTIFACT_DIR / f"production-replay-{run_id}"

    raw_persisted: dict[str, dict[str, Any]] = {}

    def persist_response(record: Mapping[str, Any], provider_id: str, *, cached: bool) -> None:
        body = bytes(record.get("body") or b"")
        if not body:
            return
        url = str(record.get("final_url") or record.get("url") or "")
        if not url:
            return
        digest = hashlib.sha256(body).hexdigest()
        raw_document_id = f"{stage1.RUN_ID}-raw-{digest[:24]}"
        if raw_document_id in raw_persisted:
            return
        snapshot = RawSnapshotInput(
            canonical_url=url,
            payload=body,
            content_type=content_type_for(url, provider_id, body),
            retrieved_at=utc_now(),
            source_identity=source_identity_for_url(url),
            raw_document_id=raw_document_id,
            http_status=int(record.get("status") or 0),
            fetch_method="local-cache" if cached else "requests",
            acquisition_run_id=stage1.RUN_ID,
            source_class="stage1-provider-source",
            adapter_id="stage1-deterministic-coverage/v1",
            provider_id=provider_id,
            dataset_id=f"{provider_id}-deterministic",
            source_resolution="local-cache" if cached else "network",
            original_url=str(record.get("url") or url),
        )
        raw_document = raw_store.put_snapshot(snapshot)
        raw_persisted[raw_document_id] = {
            "raw_document_id": raw_document.raw_document_id,
            "url": url,
            "provider_id": provider_id,
            "status": int(record.get("status") or 0),
            "content_hash": digest,
            "bytes": len(body),
            "cached": cached,
            "payload_location": raw_document.payload_location,
            "payload_reference": raw_document.payload_reference,
        }

    original_init = stage1.SourceStore.__init__
    original_fetch = stage1.SourceStore.fetch
    original_note = stage1.SourceStore.note

    def wrapped_init(self: Any) -> None:
        original_init(self)

    def wrapped_fetch(self: Any, url: str, *, provider_id: str, timeout: float = 30.0) -> dict[str, Any]:
        record = original_fetch(self, url, provider_id=provider_id, timeout=timeout)
        persist_response(record, provider_id, cached=bool(record.get("cache")))
        return record

    def wrapped_note(self: Any, url: str, *, status: int, body: bytes, provider_id: str) -> dict[str, Any]:
        record = original_note(self, url, status=status, body=body, provider_id=provider_id)
        persist_response(record, provider_id, cached=True)
        return record

    stage1.SourceStore.__init__ = wrapped_init
    stage1.SourceStore.fetch = wrapped_fetch
    stage1.SourceStore.note = wrapped_note

    print(json.dumps({"event": "stage1_acquisition_start", "run_id": run_id}, ensure_ascii=False), flush=True)
    acquisition_summary = stage1.Acquisition().run()
    acquisition_summary = {
        **dict(acquisition_summary),
        "run_id": run_id,
        "retrieved_at": run_retrieved_at,
        "raw_persisted_count": len(raw_persisted),
        "raw_persisted_bytes": sum(item["bytes"] for item in raw_persisted.values()),
        "raw_persisted_by_provider": {
            provider: sum(1 for item in raw_persisted.values() if item["provider_id"] == provider)
            for provider in sorted({item["provider_id"] for item in raw_persisted.values()})
        },
    }
    (ARTIFACT_DIR / f"stage1-drive-raw-persistence-{run_id}.json").write_text(
        json.dumps(
            {"summary": acquisition_summary, "documents": sorted(raw_persisted.values(), key=lambda item: item["raw_document_id"])},
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"event": "stage1_acquisition_done", **acquisition_summary}, ensure_ascii=False), flush=True)

    child_env = os.environ.copy()
    child_env["DATA_PLATFORM_SOURCE_RUN_ID"] = run_id
    child_env["DATA_PLATFORM_SOURCE_RETRIEVED_AT"] = run_retrieved_at
    print(json.dumps({"event": "stage1_expand_start"}, ensure_ascii=False), flush=True)
    subprocess.run(
        [sys.executable, str(ARTIFACT_DIR / "expand_stage1_max_fill.py")],
        cwd=str(REPO_ROOT),
        env=child_env,
        check=True,
    )
    print(json.dumps({"event": "stage1_ultra_start"}, ensure_ascii=False), flush=True)
    subprocess.run(
        [sys.executable, str(ARTIFACT_DIR / "ultra_max_fill_stage1.py")],
        cwd=str(REPO_ROOT),
        env=child_env,
        check=True,
    )

    archive_summary = archive_generated_outputs(
        run_id=run_id,
        raw_store=raw_store,
        acquisition_summary=acquisition_summary,
        started_ns=started_ns,
    )
    print(json.dumps({"event": "stage1_drive_archive_done", **archive_summary}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
