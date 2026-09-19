from __future__ import annotations

import hashlib
import io
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from glowbal_ingestion.artifact_store import (
    ArtifactBudgetExceeded,
    GoogleDriveDesktopArtifactStore,
    artifact_locator,
)
from glowbal_ingestion.object_store import ObjectReference, ObjectStoreError
from glowbal_ingestion.raw_evidence import (
    RawEvidenceError,
    RawEvidenceErrorCode,
    create_remote_raw_evidence_store,
)
from glowbal_ingestion.structured_staging import SupabaseStructuredStagingStore
from glowbal_ingestion.pipeline import _validate_injected_raw_evidence_store
from glowbal_ingestion.mongo_raw_evidence import (
    MongoRawEvidenceConfig,
    MongoRawEvidenceStore,
)


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class LegacyReadOnlyStore:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload
        self.get_calls = 0
        self.write_calls = 0

    def get(self, reference: ObjectReference) -> bytes:
        self.get_calls += 1
        assert reference.content_hash == digest(self.payload)
        return self.payload

    def exists(self, reference: ObjectReference) -> bool:
        return reference.content_hash == digest(self.payload)

    def open_stream(self, reference: ObjectReference):
        return io.BytesIO(self.get(reference))

    def put_immutable(self, *args, **kwargs):  # pragma: no cover - guard rail
        self.write_calls += 1
        raise AssertionError("legacy storage must never receive a new write")


def test_drive_root_preflight_is_fail_closed(tmp_path: Path) -> None:
    missing = tmp_path / "not-mounted"
    with pytest.raises(ObjectStoreError, match="existing directory"):
        GoogleDriveDesktopArtifactStore(missing)


def test_factory_fails_closed_when_drive_root_is_missing(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MONGODB_URI", "mongodb://test.invalid")
    monkeypatch.setenv("MONGODB_DATABASE", "test")
    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    monkeypatch.setenv("DATA_PLATFORM_ARCHIVE_ROOT", str(tmp_path / "missing"))
    with pytest.raises(RawEvidenceError) as raised:
        create_remote_raw_evidence_store(inline_payload_max_bytes=1024)
    assert raised.value.code == RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID


def test_factory_selects_drive_backend(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MONGODB_URI", "mongodb://test.invalid")
    monkeypatch.setenv("MONGODB_DATABASE", "test")
    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    monkeypatch.setenv("DATA_PLATFORM_ARCHIVE_ROOT", str(tmp_path))
    store = create_remote_raw_evidence_store(inline_payload_max_bytes=1024)
    assert isinstance(store.object_store, GoogleDriveDesktopArtifactStore)


def test_drive_write_read_hash_open_and_portable_locator(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    payload = b"evidence,with,bytes\n"
    reference = store.put(payload, content_hash=digest(payload), content_type="text/csv")
    assert reference.key == artifact_locator(digest(payload), "text/csv")
    assert reference.key == f"raw/objects/{digest(payload)[:2]}/{digest(payload)}.csv"
    assert reference.readback_state == "VERIFIED"
    assert reference.cloud_sync_state == "UNKNOWN"
    assert store.exists(reference)
    assert store.get(reference) == payload
    with store.open(reference) as handle:
        assert handle.read() == payload
    assert store.verify(reference).readback_state == "VERIFIED"
    materialized = store.materialize(reference, tmp_path / "work" / "copy.csv")
    assert materialized.read_bytes() == payload


def test_drive_dedupes_same_bytes_but_retains_different_content(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    first = store.put(b"same", content_hash=digest(b"same"), content_type="text/plain")
    duplicate = store.put(b"same", content_hash=digest(b"same"), content_type="text/plain")
    second = store.put(b"different", content_hash=digest(b"different"), content_type="text/plain")
    assert first.key == duplicate.key
    assert first.key != second.key
    assert store.used_bytes == len(b"same") + len(b"different")
    assert len(list((tmp_path / "raw" / "objects").rglob("*.*"))) == 2


def test_same_sha_different_extension_metadata_reuses_one_physical_artifact(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    payload = b"same bytes, different metadata"
    first = store.put(
        payload,
        content_hash=digest(payload),
        content_type="text/csv",
    )
    second = store.put(
        payload,
        content_hash=digest(payload),
        content_type="application/octet-stream",
    )
    assert first.key == second.key
    assert store.used_bytes == len(payload)
    assert len(list((tmp_path / "raw" / "objects").rglob("*.*"))) == 1


def test_concurrent_same_sha_different_extensions_create_one_artifact(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    payload = b"concurrent same bytes"

    def write(content_type: str):
        return store.put(payload, content_hash=digest(payload), content_type=content_type)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first, second = list(
            executor.map(write, ("text/csv", "application/octet-stream"))
        )
    assert first.key == second.key
    assert store.used_bytes == len(payload)
    assert len(list((tmp_path / "raw" / "objects").rglob("*.*"))) == 1


def test_cross_process_same_sha_different_extensions_create_one_artifact(tmp_path: Path) -> None:
    payload = b"cross-process same bytes"
    content_hash = digest(payload)
    child = (
        "import hashlib,sys; "
        "from glowbal_ingestion.artifact_store import GoogleDriveDesktopArtifactStore; "
        "root,payload,content_type=sys.argv[1:]; "
        "data=payload.encode(); "
        "ref=GoogleDriveDesktopArtifactStore(root).put(data, content_hash=hashlib.sha256(data).hexdigest(), content_type=content_type); "
        "print(ref.key)"
    )
    processes = [
        subprocess.Popen(
            [sys.executable, "-c", child, str(tmp_path), payload.decode(), content_type],
            env=os.environ.copy(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        for content_type in ("text/csv", "application/octet-stream")
    ]
    outputs = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=30)
        assert process.returncode == 0, stderr
        outputs.append(stdout.strip())
    assert outputs[0] == outputs[1]
    assert outputs[0].endswith(f"{content_hash}.csv") or outputs[0].endswith(f"{content_hash}.bin")
    assert len(list((tmp_path / "raw" / "objects").rglob("*.*"))) == 1


def test_drive_missing_and_corrupt_archive_are_not_silently_recovered(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    payload = b"original"
    reference = store.put(payload, content_hash=digest(payload), content_type="application/pdf")
    path = tmp_path.joinpath(*reference.key.split("/"))
    path.write_bytes(b"corrupt")
    with pytest.raises(ObjectStoreError, match="(checksum|length)"):
        store.get(reference)
    path.unlink()
    with pytest.raises(ObjectStoreError, match="missing"):
        store.get(reference)


def test_new_drive_writes_never_fall_back_to_legacy_storage(tmp_path: Path) -> None:
    legacy = LegacyReadOnlyStore(b"legacy")
    store = GoogleDriveDesktopArtifactStore(tmp_path, legacy=legacy)
    payload = b"new-heavy-payload"
    reference = store.put(payload, content_hash=digest(payload), content_type="application/pdf")
    assert store.get(reference) == payload
    assert legacy.write_calls == 0
    assert legacy.get_calls == 0


def test_missing_new_drive_locator_never_falls_back_to_legacy(tmp_path: Path) -> None:
    payload = b"same-content"
    legacy = LegacyReadOnlyStore(payload)
    store = GoogleDriveDesktopArtifactStore(tmp_path, legacy=legacy)
    reference = store.put(payload, content_hash=digest(payload), content_type="application/pdf")
    (tmp_path.joinpath(*reference.key.split("/"))).unlink()
    with pytest.raises(ObjectStoreError, match="missing"):
        store.get(reference)
    assert legacy.get_calls == 0


def test_legacy_supabase_locator_remains_read_compatible(tmp_path: Path) -> None:
    payload = b"legacy"
    legacy = LegacyReadOnlyStore(payload)
    store = GoogleDriveDesktopArtifactStore(tmp_path, legacy=legacy)
    reference = ObjectReference(
        key=f"raw/sha256/{digest(payload)[:2]}/{digest(payload)}",
        content_hash=digest(payload),
        content_length=len(payload),
        content_type="application/pdf",
    )
    assert store.get(reference) == payload
    assert store.verify(reference).local_state == "LEGACY_REMOTE"
    assert legacy.get_calls >= 2


def test_artifact_budget_rejects_new_content_without_creating_archive_file(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path, max_run_bytes=6)
    first = store.put(b"four", content_hash=digest(b"four"), content_type="text/plain")
    assert store.put(b"four", content_hash=digest(b"four"), content_type="text/plain") == first
    with pytest.raises(ArtifactBudgetExceeded):
        store.put(b"three", content_hash=digest(b"three"), content_type="text/plain")
    assert not (tmp_path / "raw" / "objects" / digest(b"three")[:2] / f"{digest(b'three')}.bin").exists()


def test_csv_is_deterministic_and_preserves_null_unicode_quotes_newlines_and_json(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path)
    rows = [{"empty": None, "unicode": "Việt Nam", "quoted": 'a,"b"\nnext', "json": {"z": [2, 1], "a": True}}]
    first = store.write_csv(["empty", "unicode", "quoted", "json"], rows)
    second = store.write_csv(["empty", "unicode", "quoted", "json"], rows)
    expected = (
        'empty,unicode,quoted,json\n'
        ',Việt Nam,"a,""b""\nnext","{""a"":true,""z"":[2,1]}"\n'
    ).encode("utf-8")
    assert first == second
    assert store.get(first) == expected


def test_stream_budget_failure_leaves_no_object(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path, max_run_bytes=3)
    with pytest.raises(ArtifactBudgetExceeded):
        store.put_stream([b"ab", b"cd"], content_type="application/pdf")
    assert not list((tmp_path / "raw" / "objects").rglob("*")) if (tmp_path / "raw" / "objects").exists() else True


def test_stream_budget_stops_before_staging_more_than_remaining_bytes(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path, max_run_bytes=3)
    yielded: list[bytes] = []

    def chunks():
        for item in (b"ab", b"cd", b"ef"):
            yielded.append(item)
            yield item

    with pytest.raises(ArtifactBudgetExceeded):
        store.put_stream(chunks(), content_type="application/pdf")
    assert yielded == [b"ab", b"cd"]
    staging_files = list((tmp_path / ".artifact-staging").glob("*"))
    assert staging_files == []


def test_concurrent_streams_cannot_stage_beyond_run_budget(tmp_path: Path) -> None:
    store = GoogleDriveDesktopArtifactStore(tmp_path, max_run_bytes=4)

    def write(payload: bytes):
        try:
            return ("ok", store.put_stream((payload[:2], payload[2:]), content_type="application/pdf"))
        except ArtifactBudgetExceeded:
            return ("budget", None)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(write, (b"abcd", b"efgh")))
    assert [result[0] for result in results].count("ok") == 1
    assert store.used_bytes == 4
    assert list((tmp_path / ".artifact-staging").glob("*")) == []


def test_spoofed_drive_backend_name_is_rejected(monkeypatch) -> None:
    class SpoofedLegacyStore(LegacyReadOnlyStore):
        backend_name = "google_drive_desktop"

    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    with pytest.raises(ValueError, match="preflighted GoogleDriveDesktopArtifactStore"):
        _validate_injected_raw_evidence_store(
            type("InjectedRawStore", (), {"object_store": SpoofedLegacyStore(b"legacy")})()
        )


def test_direct_mongo_drive_policy_rejects_spoofed_object_store(monkeypatch) -> None:
    class SpoofedLegacyStore(LegacyReadOnlyStore):
        backend_name = "google_drive_desktop"

    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    with pytest.raises(ValueError, match="preflighted GoogleDriveDesktopArtifactStore"):
        MongoRawEvidenceStore(
            MongoRawEvidenceConfig(uri="mongodb://test", database="raw"),
            object_store=SpoofedLegacyStore(b"legacy"),
        )


def test_drive_selected_structured_staging_rejects_row_retaining_injection(monkeypatch) -> None:
    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    with pytest.raises(ValueError, match="preflighted GoogleDriveDesktopArtifactStore"):
        SupabaseStructuredStagingStore(_StructuredInsertClient())


def test_injected_legacy_raw_store_is_rejected_when_drive_is_selected(monkeypatch) -> None:
    monkeypatch.setenv("DATA_PLATFORM_ARTIFACT_BACKEND", "google_drive_desktop")
    with pytest.raises(ValueError, match="cannot use an injected non-Drive"):
        _validate_injected_raw_evidence_store(
            type("InjectedRawStore", (), {"object_store": LegacyReadOnlyStore(b"legacy")})()
        )


class _StructuredInsertClient:
    def __init__(self) -> None:
        self.inserts: list[tuple[str, list[dict]]] = []

    def insert(self, table: str, rows: list[dict], **_kwargs) -> None:
        self.inserts.append((table, rows))


def test_drive_structured_staging_externalizes_rows_to_csv(tmp_path: Path) -> None:
    client = _StructuredInsertClient()
    archive = GoogleDriveDesktopArtifactStore(tmp_path)
    staging = SupabaseStructuredStagingStore(client, artifact_store=archive)
    assert staging.put_archive_members(
        [
            {
                "run_id": "run-1",
                "derived_resource_id": "derived-1",
                "rows": [{"UNITID": "1", "Name": "École"}],
                "lineage": {"raw_content_hash": "a" * 64},
            }
        ]
    ) == 1
    row = client.inserts[0][1][0]
    assert row["rows"] == []
    artifact = row["lineage"]["structured_rows_artifact"]
    assert artifact["storage_backend"] == "google_drive_desktop"
    assert artifact["format"] == "csv"
    reference = ObjectReference(
        key=artifact["logical_locator"],
        content_hash=artifact["sha256"],
        content_length=artifact["size_bytes"],
        content_type="text/csv",
    )
    assert b"Name,UNITID\n\xc3\x89cole,1\n" == archive.get(reference)
