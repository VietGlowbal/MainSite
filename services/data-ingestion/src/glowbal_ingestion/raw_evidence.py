"""Storage-neutral immutable raw-evidence contracts.

The pipeline knows only these records and protocol.  MongoDB and object-store
implementation details are intentionally isolated in adapter modules.
"""

from __future__ import annotations

import enum
import hashlib
import io
import os
import uuid
from dataclasses import dataclass, field
from typing import BinaryIO, Iterable, Protocol, runtime_checkable

from .artifact_store import (
    ArtifactConfigurationError,
    GOOGLE_DRIVE_DESKTOP_BACKEND,
    LEGACY_S3_BACKEND,
    LEGACY_SUPABASE_STORAGE_BACKEND,
    require_configured_artifact_backend,
)
from .object_store import ObjectStoreError
from .models import (
    RawDocument,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    stable_id,
    utc_now_iso,
)


class RawEvidenceErrorCode(str, enum.Enum):
    RAW_PERSIST_FAILED = "RAW_PERSIST_FAILED"
    RAW_NOT_FOUND = "RAW_NOT_FOUND"
    RAW_CORRUPT = "RAW_CORRUPT"
    RAW_CONFIGURATION_INVALID = "RAW_CONFIGURATION_INVALID"
    RAW_UNAVAILABLE = "RAW_UNAVAILABLE"


class RawEvidenceDurability(str, enum.Enum):
    LOCAL_ONLY = "LOCAL_ONLY"
    REMOTE_DURABLE = "REMOTE_DURABLE"


class RawEvidenceError(RuntimeError):
    def __init__(
        self,
        code: RawEvidenceErrorCode,
        message: str,
        *,
        retryable: bool,
        cause_code: RawEvidenceErrorCode | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.cause_code = cause_code


def content_hash(payload: bytes) -> str:
    """SHA-256 over exactly the bytes retained by the evidence store."""
    return hashlib.sha256(payload).hexdigest()


def source_identity_for_url(canonical_url: str) -> str:
    """Stable source identity; separate from mutable snapshots and body hash."""
    return stable_id("source-identity", canonical_url)


@dataclass(frozen=True)
class RawSnapshotInput:
    canonical_url: str
    payload: bytes
    content_type: str | None
    retrieved_at: str = field(default_factory=utc_now_iso)
    source_identity: str | None = None
    raw_document_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    published_at: str | None = None
    academic_cycle: str | None = None
    language: str | None = None
    http_status: int | None = None
    safe_response_headers: dict[str, str] = field(default_factory=dict)
    fetch_method: str | None = None
    rendered: bool = False
    acquisition_run_id: str | None = None
    source_authority: SourceAuthority | None = None
    source_relationship: SourceRelationship | None = None
    source_class: str | None = None
    adapter_id: str | None = None
    provider_id: str | None = None
    dataset_id: str | None = None
    temporal_state: TemporalState = TemporalState.UNKNOWN
    source_resolution: str | None = None
    original_url: str | None = None
    capture_url: str | None = None
    captured_at: str | None = None
    archive_provider: str | None = None
    expected_content_hash: str | None = None

    def __post_init__(self) -> None:
        if not self.canonical_url:
            raise ValueError("Raw snapshot requires canonical_url.")
        if self.expected_content_hash and (
            self.expected_content_hash != content_hash(self.payload)
        ):
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_CORRUPT,
                "Raw payload does not match its expected content hash.",
                retryable=False,
            )
        if self.source_identity is None:
            object.__setattr__(
                self,
                "source_identity",
                source_identity_for_url(self.canonical_url),
            )

    @property
    def payload_hash(self) -> str:
        return content_hash(self.payload)


@dataclass(frozen=True)
class RawSnapshotStreamInput:
    """Metadata plus a one-shot payload iterator for heavy raw resources."""

    canonical_url: str
    chunks: Iterable[bytes]
    content_type: str | None
    retrieved_at: str = field(default_factory=utc_now_iso)
    source_identity: str | None = None
    raw_document_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    published_at: str | None = None
    academic_cycle: str | None = None
    language: str | None = None
    http_status: int | None = None
    safe_response_headers: dict[str, str] = field(default_factory=dict)
    fetch_method: str | None = None
    rendered: bool = False
    acquisition_run_id: str | None = None
    source_authority: SourceAuthority | None = None
    source_relationship: SourceRelationship | None = None
    source_class: str | None = None
    adapter_id: str | None = None
    provider_id: str | None = None
    dataset_id: str | None = None
    temporal_state: TemporalState = TemporalState.UNKNOWN
    source_resolution: str | None = None
    original_url: str | None = None
    capture_url: str | None = None
    captured_at: str | None = None
    archive_provider: str | None = None
    expected_content_hash: str | None = None
    max_bytes: int | None = None

    def __post_init__(self) -> None:
        if not self.canonical_url:
            raise ValueError("Raw snapshot requires canonical_url.")
        if self.source_identity is None:
            object.__setattr__(
                self,
                "source_identity",
                source_identity_for_url(self.canonical_url),
            )
        if self.max_bytes is not None and self.max_bytes < 1:
            raise ValueError("Raw stream max_bytes must be positive when supplied.")


@runtime_checkable
class RawEvidenceStore(Protocol):
    """Durable raw evidence boundary used by orchestration code."""

    @property
    def durability(self) -> RawEvidenceDurability:
        """Whether this adapter can satisfy a remote retention claim."""
        ...

    def put_snapshot(self, snapshot: RawSnapshotInput) -> RawDocument: ...

    def put_snapshot_stream(self, snapshot: RawSnapshotStreamInput) -> RawDocument: ...

    def get_snapshot(self, raw_document_id: str) -> RawDocument | None: ...

    def get_payload(self, raw_document_id: str) -> bytes: ...

    def open_payload_stream(self, raw_document_id: str) -> BinaryIO: ...

    def open_payload_seekable(self, raw_document_id: str) -> BinaryIO: ...

    def find_by_content_hash(self, payload_hash: str) -> list[RawDocument]: ...

    def list_snapshots(
        self,
        source_identity: str,
        *,
        limit: int = 100,
    ) -> list[RawDocument]: ...


class InMemoryRawEvidenceStore:
    """Deterministic protocol implementation for tests and local reprocessing."""

    def __init__(self) -> None:
        self._documents: dict[str, RawDocument] = {}
        self._payloads: dict[str, bytes] = {}

    @property
    def durability(self) -> RawEvidenceDurability:
        return RawEvidenceDurability.LOCAL_ONLY

    def put_snapshot(self, snapshot: RawSnapshotInput) -> RawDocument:
        existing = self._documents.get(snapshot.raw_document_id)
        payload_hash = snapshot.payload_hash
        if existing:
            if existing.content_hash != payload_hash:
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                    "Snapshot id was reused with different content.",
                    retryable=False,
                )
            return existing
        self._payloads.setdefault(payload_hash, bytes(snapshot.payload))
        document = RawDocument(
            raw_document_id=snapshot.raw_document_id,
            source_identity=snapshot.source_identity or "",
            canonical_url=snapshot.canonical_url,
            content_hash=payload_hash,
            content_type=snapshot.content_type,
            retrieved_at=snapshot.retrieved_at,
            payload_location="memory",
            payload_reference=payload_hash,
            content_length=len(snapshot.payload),
            http_status=snapshot.http_status,
            safe_response_headers=dict(snapshot.safe_response_headers),
            published_at=snapshot.published_at,
            academic_cycle=snapshot.academic_cycle,
            language=snapshot.language,
            fetch_method=snapshot.fetch_method,
            rendered=snapshot.rendered,
            acquisition_run_id=snapshot.acquisition_run_id,
            source_authority=snapshot.source_authority,
            source_relationship=snapshot.source_relationship,
            temporal_state=snapshot.temporal_state,
            source_class=snapshot.source_class,
            adapter_id=snapshot.adapter_id,
            provider_id=snapshot.provider_id,
            dataset_id=snapshot.dataset_id,
            source_resolution=snapshot.source_resolution,
            original_url=snapshot.original_url,
            capture_url=snapshot.capture_url,
            captured_at=snapshot.captured_at,
            archive_provider=snapshot.archive_provider,
        )
        self._documents[document.raw_document_id] = document
        return document

    def put_snapshot_stream(self, snapshot: RawSnapshotStreamInput) -> RawDocument:
        # This adapter is explicitly a deterministic test/local implementation.
        # Production heavy payloads use MongoRawEvidenceStore and an object
        # store; retaining bytes here keeps the existing test contract useful.
        pieces: list[bytes] = []
        total = 0
        for chunk in snapshot.chunks:
            data = bytes(chunk)
            total += len(data)
            if snapshot.max_bytes is not None and total > snapshot.max_bytes:
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                    "Raw stream exceeds its configured byte limit.",
                    retryable=False,
                )
            pieces.append(data)
        payload = b"".join(pieces)
        if snapshot.expected_content_hash and content_hash(payload) != snapshot.expected_content_hash:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_CORRUPT,
                "Raw stream does not match its expected content hash.",
                retryable=False,
            )
        return self.put_snapshot(
            RawSnapshotInput(
                canonical_url=snapshot.canonical_url,
                payload=payload,
                content_type=snapshot.content_type,
                retrieved_at=snapshot.retrieved_at,
                source_identity=snapshot.source_identity,
                raw_document_id=snapshot.raw_document_id,
                published_at=snapshot.published_at,
                academic_cycle=snapshot.academic_cycle,
                language=snapshot.language,
                http_status=snapshot.http_status,
                safe_response_headers=dict(snapshot.safe_response_headers),
                fetch_method=snapshot.fetch_method,
                rendered=snapshot.rendered,
                acquisition_run_id=snapshot.acquisition_run_id,
                source_authority=snapshot.source_authority,
                source_relationship=snapshot.source_relationship,
                source_class=snapshot.source_class,
                adapter_id=snapshot.adapter_id,
                provider_id=snapshot.provider_id,
                dataset_id=snapshot.dataset_id,
                temporal_state=snapshot.temporal_state,
                source_resolution=snapshot.source_resolution,
                original_url=snapshot.original_url,
                capture_url=snapshot.capture_url,
                captured_at=snapshot.captured_at,
                archive_provider=snapshot.archive_provider,
                expected_content_hash=snapshot.expected_content_hash,
            )
        )

    def get_snapshot(self, raw_document_id: str) -> RawDocument | None:
        return self._documents.get(raw_document_id)

    def get_payload(self, raw_document_id: str) -> bytes:
        document = self.get_snapshot(raw_document_id)
        if not document or not document.payload_reference:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_NOT_FOUND,
                "Raw snapshot does not exist.",
                retryable=False,
            )
        payload = self._payloads.get(document.payload_reference)
        if payload is None:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_NOT_FOUND,
                "Raw payload does not exist.",
                retryable=False,
            )
        return bytes(payload)

    def open_payload_stream(self, raw_document_id: str) -> BinaryIO:
        return io.BytesIO(self.get_payload(raw_document_id))

    def open_payload_seekable(self, raw_document_id: str) -> BinaryIO:
        return io.BytesIO(self.get_payload(raw_document_id))

    def find_by_content_hash(self, payload_hash: str) -> list[RawDocument]:
        return [
            document
            for document in self._documents.values()
            if document.content_hash == payload_hash
        ]

    def list_snapshots(
        self, source_identity: str, *, limit: int = 100
    ) -> list[RawDocument]:
        return sorted(
            (
                document
                for document in self._documents.values()
                if document.source_identity == source_identity
            ),
            key=lambda document: document.retrieved_at,
            reverse=True,
        )[:limit]


def create_remote_raw_evidence_store(
    *, inline_payload_max_bytes: int
) -> RawEvidenceStore:
    """Build the production adapter lazily from environment configuration.

    The pipeline imports only this factory/protocol.  Missing configuration is
    explicit rather than allowing a run to claim durable retention locally.
    """
    uri = os.environ.get("MONGODB_URI", "").strip()
    database = os.environ.get("MONGODB_DATABASE", "").strip()
    try:
        artifact_backend = require_configured_artifact_backend(
            context="Remote raw evidence"
        )
    except ArtifactConfigurationError as exc:
        raise RawEvidenceError(
            RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
            str(exc),
            retryable=False,
        ) from exc
    s3_bucket = os.environ.get("RAW_OBJECT_STORE_BUCKET", "").strip()
    supabase_url = (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    )
    supabase_service_role_key = os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    ).strip()
    supabase_bucket = os.environ.get("RAW_OBJECT_STORAGE_BUCKET", "").strip()
    has_supabase_storage = bool(
        supabase_url and supabase_service_role_key and supabase_bucket
    )
    has_drive_archive = bool(os.environ.get("DATA_PLATFORM_ARCHIVE_ROOT", "").strip())
    if artifact_backend == GOOGLE_DRIVE_DESKTOP_BACKEND and not has_drive_archive:
        raise RawEvidenceError(
            RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
            "google_drive_desktop requires DATA_PLATFORM_ARCHIVE_ROOT.",
            retryable=False,
        )
    has_configured_artifact_backend = {
        GOOGLE_DRIVE_DESKTOP_BACKEND: has_drive_archive,
        LEGACY_SUPABASE_STORAGE_BACKEND: has_supabase_storage,
        LEGACY_S3_BACKEND: bool(s3_bucket),
    }[artifact_backend]
    if not uri or not database or not has_configured_artifact_backend:
        raise RawEvidenceError(
            RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
            "Remote raw evidence requires MongoDB and object-storage configuration.",
            retryable=False,
        )
    from .mongo_raw_evidence import MongoRawEvidenceConfig, MongoRawEvidenceStore
    if artifact_backend == GOOGLE_DRIVE_DESKTOP_BACKEND:
        from .artifact_store import GoogleDriveDesktopArtifactStore

        # Legacy Supabase objects remain readable by their old logical keys.
        # The reader is passed only to the Drive adapter's read paths; all new
        # writes, including streams, are Drive-only and fail closed.
        legacy = None
        if has_supabase_storage:
            from .supabase_storage import SupabaseStorageConfig, SupabaseStorageObjectStore

            legacy = SupabaseStorageObjectStore(
                SupabaseStorageConfig(
                    base_url=supabase_url,
                    service_role_key=supabase_service_role_key,
                    bucket=supabase_bucket,
                )
            )
        budget_value = os.environ.get("DATA_PLATFORM_ARTIFACT_RUN_BUDGET_BYTES", "").strip()
        try:
            budget = int(budget_value) if budget_value else None
        except ValueError as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
                "DATA_PLATFORM_ARTIFACT_RUN_BUDGET_BYTES must be a non-negative integer.",
                retryable=False,
            ) from exc
        try:
            object_store = GoogleDriveDesktopArtifactStore(
                os.environ["DATA_PLATFORM_ARCHIVE_ROOT"],
                max_run_bytes=budget,
                legacy=legacy,
            )
        except (ObjectStoreError, ValueError) as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
                "Google Drive desktop archive preflight failed.",
                retryable=False,
            ) from exc
    elif artifact_backend == LEGACY_S3_BACKEND:
        # Legacy object stores are available only through an explicit
        # compatibility/migration selection; they are never inferred.
        from .object_store import S3ObjectStore, S3ObjectStoreConfig

        object_store = S3ObjectStore(
            S3ObjectStoreConfig(
                endpoint=os.environ.get("RAW_OBJECT_STORE_ENDPOINT", "").strip()
                or None,
                bucket=s3_bucket,
                access_key_id=os.environ.get(
                    "RAW_OBJECT_STORE_ACCESS_KEY_ID", ""
                ).strip()
                or None,
                secret_access_key=os.environ.get(
                    "RAW_OBJECT_STORE_SECRET_ACCESS_KEY", ""
                ).strip()
                or None,
                region=os.environ.get("RAW_OBJECT_STORE_REGION", "").strip()
                or None,
            )
        )
    elif artifact_backend == LEGACY_SUPABASE_STORAGE_BACKEND:
        from .supabase_storage import (
            SupabaseStorageConfig,
            SupabaseStorageObjectStore,
        )

        object_store = SupabaseStorageObjectStore(
            SupabaseStorageConfig(
                base_url=supabase_url,
                service_role_key=supabase_service_role_key,
                bucket=supabase_bucket,
            )
        )
    else:  # Defensive: require_configured_artifact_backend owns the allow-list.
        raise RawEvidenceError(
            RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
            "No implicit raw-evidence object-storage backend is available.",
            retryable=False,
        )
    return MongoRawEvidenceStore(
        MongoRawEvidenceConfig(
            uri=uri,
            database=database,
            inline_payload_max_bytes=inline_payload_max_bytes,
        ),
        object_store=object_store,
    )
