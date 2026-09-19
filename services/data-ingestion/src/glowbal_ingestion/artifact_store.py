"""Content-addressed artifact storage for Data Platform durable bytes.

``GoogleDriveDesktopArtifactStore`` deliberately talks only to a mounted local
folder.  Google Drive for desktop performs any cloud synchronisation outside
this process, so an archive write is never misreported as cloud-confirmed.
The logical locator is portable across drive letters and machines.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import tempfile
import threading
import time
import uuid
import weakref
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO, Iterable, Mapping, Protocol, Sequence, runtime_checkable

from .object_store import ObjectReference, ObjectStore, ObjectStoreError


_VERIFIED_DRIVE_STORES: weakref.WeakSet["GoogleDriveDesktopArtifactStore"] = weakref.WeakSet()
_HASH_LOCKS_GUARD = threading.Lock()
_HASH_LOCKS: dict[tuple[str, str], threading.RLock] = {}


class ArtifactBudgetExceeded(ObjectStoreError):
    """A run attempted to retain more new archive bytes than it was given."""

    def __init__(self, message: str = "Artifact run budget exceeded.") -> None:
        super().__init__(message, retryable=False)


@dataclass(frozen=True)
class ArtifactReference(ObjectReference):
    """An object reference with explicit, non-overclaimed archive state."""

    local_state: str = "PRESENT"
    readback_state: str = "UNVERIFIED"
    cloud_sync_state: str = "UNKNOWN"


class _ArchiveHashFileLock:
    """Cross-process lock for one archive-root/SHA pair.

    The lock file is intentionally a tiny operational marker under
    ``.artifact-locks``.  It is never used as an artifact and can remain after
    a crash because the OS releases the advisory lock; a later writer safely
    reuses the marker.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.handle: Any | None = None

    def __enter__(self) -> "_ArchiveHashFileLock":
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.handle = self.path.open("a+b")
        except OSError as exc:
            raise ObjectStoreError(
                "Google Drive artifact lock could not be opened.",
                retryable=True,
            ) from exc
        try:
            self.handle.seek(0, os.SEEK_END)
            if self.handle.tell() == 0:
                self.handle.write(b"0")
                self.handle.flush()
            self.handle.seek(0)
            if os.name == "nt":
                import msvcrt

                deadline = time.monotonic() + 60.0
                while True:
                    try:
                        self.handle.seek(0)
                        msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
                        break
                    except OSError:
                        if time.monotonic() >= deadline:
                            raise ObjectStoreError(
                                "Timed out waiting for the Drive artifact lock.",
                                retryable=True,
                            )
                        time.sleep(0.01)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX)
            return self
        except ObjectStoreError:
            self.handle.close()
            self.handle = None
            raise
        except OSError as exc:
            self.handle.close()
            self.handle = None
            raise ObjectStoreError(
                "Google Drive artifact lock could not be acquired.",
                retryable=True,
            ) from exc
        except Exception:
            self.handle.close()
            self.handle = None
            raise

    def __exit__(self, *_exc: object) -> None:
        if self.handle is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
        finally:
            self.handle.close()
            self.handle = None


@runtime_checkable
class ArtifactStore(Protocol):
    def put(self, payload: bytes, *, content_hash: str, content_type: str | None) -> ArtifactReference: ...
    def get(self, reference: ObjectReference) -> bytes: ...
    def open(self, reference: ObjectReference) -> BinaryIO: ...
    def exists(self, reference: ObjectReference) -> bool: ...
    def verify(self, reference: ObjectReference) -> ArtifactReference: ...
    def materialize(self, reference: ObjectReference, destination: Path) -> Path: ...
    def write_csv(self, fieldnames: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> ArtifactReference: ...
    def write_csv_dataset(self, fieldnames: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> ArtifactReference: ...


def _validate_hash(value: str) -> str:
    normalized = value.lower()
    if len(normalized) != 64 or any(character not in "0123456789abcdef" for character in normalized):
        raise ValueError("content_hash must be a SHA-256 hex digest.")
    return normalized


def extension_for_content_type(content_type: str | None) -> str:
    media_type = (content_type or "").split(";", 1)[0].strip().lower()
    return {
        "text/csv": "csv",
        "application/csv": "csv",
        "application/json": "json",
        "application/ld+json": "json",
        "application/pdf": "pdf",
        "text/html": "html",
        "application/xhtml+xml": "html",
        "application/xml": "xml",
        "text/xml": "xml",
        "application/zip": "zip",
        "application/gzip": "gz",
    }.get(media_type, "bin")


def artifact_locator(content_hash: str, content_type: str | None) -> str:
    digest = _validate_hash(content_hash)
    return f"raw/objects/{digest[:2]}/{digest}.{extension_for_content_type(content_type)}"


class GoogleDriveDesktopArtifactStore:
    """Filesystem-backed archive for a Google Drive for desktop mount.

    The root must already be provisioned by the operator.  This prevents an
    unset/mistyped mount from silently becoming a local archive.  ``legacy``
    is read-only and consulted only for pre-existing Supabase-style locators;
    it is never used by any write method.
    """

    backend_name = "google_drive_desktop"

    def __init__(
        self,
        archive_root: Path | str,
        *,
        max_run_bytes: int | None = None,
        legacy: ObjectStore | None = None,
        preflight: bool = True,
    ) -> None:
        self.archive_root = Path(archive_root).expanduser()
        if max_run_bytes is not None and max_run_bytes < 0:
            raise ValueError("Artifact run budget must be zero or positive.")
        self.max_run_bytes = max_run_bytes
        self.legacy = legacy
        self._used_bytes = 0
        self._lock = threading.RLock()
        if preflight:
            self.preflight()

    def preflight(self) -> None:
        """Fail closed unless the configured mounted archive is usable."""
        try:
            if not self.archive_root.exists() or not self.archive_root.is_dir():
                raise ObjectStoreError(
                    "DATA_PLATFORM_ARCHIVE_ROOT must name an existing directory.",
                    retryable=False,
                )
            probe = self.archive_root / f".artifact-preflight-{os.getpid()}-{uuid.uuid4().hex}"
            with probe.open("xb") as handle:
                handle.write(b"ok")
                handle.flush()
                os.fsync(handle.fileno())
            probe.unlink()
            _VERIFIED_DRIVE_STORES.add(self)
        except ObjectStoreError:
            raise
        except OSError as exc:
            raise ObjectStoreError(
                "Google Drive desktop archive preflight failed.", retryable=False
            ) from exc

    @property
    def used_bytes(self) -> int:
        return self._used_bytes

    @staticmethod
    def _verify_bytes(payload: bytes, content_hash: str, content_length: int | None = None) -> None:
        if content_length is not None and len(payload) != content_length:
            raise ObjectStoreError("Artifact payload length mismatch.", retryable=False)
        if hashlib.sha256(payload).hexdigest() != _validate_hash(content_hash):
            raise ObjectStoreError("Artifact payload checksum mismatch.", retryable=False)

    def _path(self, reference: ObjectReference) -> Path | None:
        """Resolve a Drive locator, reusing an existing hash under any extension.

        Content identity is the SHA-256, not MIME metadata.  A provider can
        report the same bytes as ``text/csv`` on one run and
        ``application/octet-stream`` on another.  The first stored extension
        is therefore canonical for that hash; a second extension must not
        create another physical copy.
        """
        digest = _validate_hash(reference.content_hash)
        prefix = f"raw/objects/{digest[:2]}/{digest}."
        if not reference.key.startswith(prefix) or "/" in reference.key[len(prefix) :]:
            return None
        parent = self.archive_root / "raw" / "objects" / digest[:2]
        requested_extension = reference.key[len(prefix) :]
        preferred = parent / f"{digest}.{requested_extension}"
        if preferred.is_file():
            return preferred
        candidates = sorted(parent.glob(f"{reference.content_hash}.*"))
        if len(candidates) == 1 and candidates[0].is_file():
            return candidates[0]
        if len(candidates) > 1:
            raise ObjectStoreError(
                "Multiple Drive archive files exist for one SHA-256 artifact.",
                retryable=False,
            )
        return preferred

    @staticmethod
    def _is_legacy_locator(reference: ObjectReference) -> bool:
        return reference.key.startswith("raw/sha256/")

    def _reserve(self, amount: int) -> None:
        if self.max_run_bytes is not None and self._used_bytes + amount > self.max_run_bytes:
            raise ArtifactBudgetExceeded()
        self._used_bytes += amount

    def _hash_lock(self, content_hash: str) -> threading.RLock:
        """Get a process-wide lock for one root/hash pair.

        Pipeline workers normally share one store instance, but callers may
        construct separate adapters in the same process.  The lock prevents
        those adapters from racing between extension discovery and final
        rename; the final existence check still remains authoritative.
        """
        key = (os.path.normcase(str(self.archive_root)), _validate_hash(content_hash))
        with _HASH_LOCKS_GUARD:
            return _HASH_LOCKS.setdefault(key, threading.RLock())

    def _hash_file_lock(self, content_hash: str) -> _ArchiveHashFileLock:
        digest = _validate_hash(content_hash)
        return _ArchiveHashFileLock(
            self.archive_root / ".artifact-locks" / f"{digest}.lock"
        )

    def _reference(
        self,
        *,
        content_hash: str,
        content_length: int,
        content_type: str | None,
        readback_state: str,
        locator: str | None = None,
    ) -> ArtifactReference:
        return ArtifactReference(
            key=locator or artifact_locator(content_hash, content_type),
            content_hash=_validate_hash(content_hash),
            content_length=content_length,
            content_type=content_type,
            local_state="PRESENT",
            readback_state=readback_state,
            cloud_sync_state="UNKNOWN",
        )

    def put(self, payload: bytes, *, content_hash: str, content_type: str | None) -> ArtifactReference:
        data = bytes(payload)
        digest = _validate_hash(content_hash)
        self._verify_bytes(data, digest)
        reference = self._reference(content_hash=digest, content_length=len(data), content_type=content_type, readback_state="UNVERIFIED")
        with self._lock:
            with self._hash_lock(digest):
                with self._hash_file_lock(digest):
                    # Resolve the canonical extension while holding the same
                    # lock as the existence check and final rename.  This is
                    # process-wide and OS-backed, so separate worker
                    # processes cannot choose different extensions for one
                    # SHA-256 either.
                    path = self._path(reference)
                    assert path is not None
                    if path.exists():
                        return self.verify(reference)
                    self._reserve(len(data))
                    try:
                        path.parent.mkdir(parents=True, exist_ok=True)
                        descriptor, name = tempfile.mkstemp(prefix=".artifact-", suffix=".tmp", dir=path.parent)
                        temporary = Path(name)
                        try:
                            with os.fdopen(descriptor, "wb") as handle:
                                handle.write(data)
                                handle.flush()
                                os.fsync(handle.fileno())
                            os.replace(temporary, path)
                        finally:
                            if temporary.exists():
                                temporary.unlink()
                    except ObjectStoreError:
                        raise
                    except OSError as exc:
                        self._used_bytes -= len(data)
                        raise ObjectStoreError("Google Drive desktop archive write failed.", retryable=True) from exc
        return self.verify(reference)

    def put_immutable(self, payload: bytes, *, content_hash: str, content_type: str | None) -> ObjectReference:
        return self.put(payload, content_hash=content_hash, content_type=content_type)

    def put_stream(
        self,
        chunks: Iterable[bytes],
        *,
        content_type: str | None,
        object_key: str | None = None,
        metadata: Mapping[str, str] | None = None,
        max_bytes: int | None = None,
    ) -> ObjectReference:
        # ``object_key``/metadata describe old remote stores.  Drive locators
        # are deliberately content-addressed and therefore ignore both.
        del object_key, metadata
        staging = self.archive_root / ".artifact-staging"
        total = 0
        digest = hashlib.sha256()
        temporary: Path | None = None
        # A bounded run serializes stream staging so two workers cannot both
        # observe the same remaining budget and fill temporary files before
        # one of them is rejected at finalization.  Unbounded runs retain
        # concurrent stream throughput.
        budget_lock = self._lock if self.max_run_bytes is not None else _NullLock()
        budget_lock.acquire()
        try:
            remaining_budget = (
                None
                if self.max_run_bytes is None
                else max(0, self.max_run_bytes - self._used_bytes)
            )
            effective_max_bytes = max_bytes
            if remaining_budget is not None:
                effective_max_bytes = (
                    remaining_budget
                    if effective_max_bytes is None
                    else min(effective_max_bytes, remaining_budget)
                )
            staging.mkdir(parents=True, exist_ok=True)
            descriptor, name = tempfile.mkstemp(prefix="stream-", suffix=".tmp", dir=staging)
            temporary = Path(name)
            with os.fdopen(descriptor, "wb") as handle:
                for chunk in chunks:
                    if not isinstance(chunk, (bytes, bytearray, memoryview)):
                        raise ObjectStoreError("Artifact stream yielded a non-bytes chunk.", retryable=False)
                    data = bytes(chunk)
                    if not data:
                        continue
                    total += len(data)
                    if effective_max_bytes is not None and total > effective_max_bytes:
                        raise ArtifactBudgetExceeded("Artifact stream exceeds its configured byte limit.")
                    digest.update(data)
                    handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            content_hash = digest.hexdigest()
            reference = self._reference(content_hash=content_hash, content_length=total, content_type=content_type, readback_state="UNVERIFIED")
            target = self._path(reference)
            assert target is not None
            with self._lock:
                # For unbounded streams this is the hash-level critical
                # section; bounded streams already hold the same re-entrant
                # lock while staging.
                with self._hash_lock(content_hash):
                    with self._hash_file_lock(content_hash):
                        target = self._path(reference)
                        assert target is not None
                        if target.exists():
                            return self.verify(reference)
                        self._reserve(total)
                        try:
                            target.parent.mkdir(parents=True, exist_ok=True)
                            os.replace(temporary, target)
                            temporary = None
                        except OSError as exc:
                            self._used_bytes -= total
                            raise ObjectStoreError("Google Drive desktop archive streaming write failed.", retryable=True) from exc
            return self.verify(reference)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
            budget_lock.release()

    def get(self, reference: ObjectReference) -> bytes:
        path = self._path(reference)
        if path is None:
            if self.legacy is not None and self._is_legacy_locator(reference):
                return self.legacy.get(reference)
            raise ObjectStoreError("Artifact locator is not a Drive archive locator.", retryable=False)
        try:
            payload = path.read_bytes()
        except FileNotFoundError as exc:
            raise ObjectStoreError("Artifact is missing from the Drive archive.", retryable=False) from exc
        except OSError as exc:
            raise ObjectStoreError("Google Drive desktop archive read failed.", retryable=True) from exc
        self._verify_bytes(payload, reference.content_hash, reference.content_length)
        return payload

    def open(self, reference: ObjectReference) -> BinaryIO:
        path = self._path(reference)
        if path is None:
            if self.legacy is not None and self._is_legacy_locator(reference):
                return self.legacy.open_stream(reference)
            raise ObjectStoreError("Artifact locator is not a Drive archive locator.", retryable=False)
        try:
            return path.open("rb")
        except FileNotFoundError as exc:
            raise ObjectStoreError("Artifact is missing from the Drive archive.", retryable=False) from exc
        except OSError as exc:
            raise ObjectStoreError("Google Drive desktop archive stream open failed.", retryable=True) from exc

    def open_stream(self, reference: ObjectReference) -> BinaryIO:
        return self.open(reference)

    def exists(self, reference: ObjectReference) -> bool:
        path = self._path(reference)
        if path is None:
            return bool(self.legacy and self._is_legacy_locator(reference) and self.legacy.exists(reference))
        return path.is_file()

    def verify(self, reference: ObjectReference) -> ArtifactReference:
        self.get(reference)
        if self._path(reference) is None:
            return ArtifactReference(
                key=reference.key,
                content_hash=reference.content_hash,
                content_length=reference.content_length,
                content_type=reference.content_type,
                local_state="LEGACY_REMOTE",
                readback_state="VERIFIED",
                cloud_sync_state="NOT_APPLICABLE",
            )
        path = self._path(reference)
        assert path is not None
        locator = path.relative_to(self.archive_root).as_posix()
        return self._reference(
            content_hash=reference.content_hash,
            content_length=reference.content_length,
            content_type=reference.content_type,
            readback_state="VERIFIED",
            locator=locator,
        )

    def read_range(self, reference: ObjectReference, start: int, end: int) -> bytes:
        if start < 0 or end <= start or end > reference.content_length:
            raise ValueError("Invalid object-store range.")
        path = self._path(reference)
        if path is None:
            if self.legacy is not None and self._is_legacy_locator(reference):
                reader = getattr(self.legacy, "read_range", None)
                if callable(reader):
                    return reader(reference, start, end)
                return self.legacy.get(reference)[start:end]
            raise ObjectStoreError(
                "Artifact locator is not a Drive archive locator.", retryable=False
            )
        try:
            with path.open("rb") as handle:
                handle.seek(start)
                payload = handle.read(end - start)
        except FileNotFoundError as exc:
            raise ObjectStoreError(
                "Artifact is missing from the Drive archive.", retryable=False
            ) from exc
        except OSError as exc:
            raise ObjectStoreError(
                "Google Drive desktop range read failed.", retryable=True
            ) from exc
        if len(payload) != end - start:
            raise ObjectStoreError(
                "Artifact range is shorter than retained metadata.", retryable=False
            )
        return payload

    def materialize(self, reference: ObjectReference, destination: Path) -> Path:
        payload = self.get(reference)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
        try:
            temporary.write_bytes(payload)
            os.replace(temporary, destination)
        finally:
            if temporary.exists():
                temporary.unlink()
        return destination

    @staticmethod
    def _csv_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (dict, list, tuple)):
            return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return str(value)

    def write_csv(self, fieldnames: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> ArtifactReference:
        output = io.StringIO(newline="")
        writer = csv.DictWriter(
            output,
            fieldnames=list(fieldnames),
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({field: self._csv_value(row.get(field)) for field in fieldnames})
        payload = output.getvalue().encode("utf-8")
        return self.put(payload, content_hash=hashlib.sha256(payload).hexdigest(), content_type="text/csv; charset=utf-8")

    def write_csv_dataset(
        self,
        fieldnames: Sequence[str],
        rows: Iterable[Mapping[str, Any]],
    ) -> ArtifactReference:
        """Explicit dataset-named alias for callers archiving tabular output."""
        return self.write_csv(fieldnames, rows)


class _NullLock:
    """Minimal context-free lock used when no run budget is configured."""

    def acquire(self) -> None:
        return None

    def release(self) -> None:
        return None


def is_verified_google_drive_store(value: object) -> bool:
    """Return true only for this module's preflighted Drive implementation.

    ``backend_name`` is metadata and intentionally not a security boundary:
    callers must not be able to spoof the selected backend by setting a
    string on an arbitrary legacy adapter.
    """
    return (
        type(value) is GoogleDriveDesktopArtifactStore
        and value in _VERIFIED_DRIVE_STORES
    )


def require_verified_google_drive_store(value: object, *, context: str) -> None:
    if not is_verified_google_drive_store(value):
        raise ValueError(
            f"{context} cannot use an injected non-Drive store; "
            "a preflighted GoogleDriveDesktopArtifactStore is required."
        )
