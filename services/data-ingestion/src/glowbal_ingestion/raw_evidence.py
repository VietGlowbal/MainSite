"""Storage-neutral immutable raw-evidence contracts.

The pipeline knows only these records and protocol.  MongoDB and object-store
implementation details are intentionally isolated in adapter modules.
"""

from __future__ import annotations

import enum
import hashlib
import os
import uuid
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from .models import (
    RawDocument,
    SourceAuthority,
    SourceRelationship,
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


@runtime_checkable
class RawEvidenceStore(Protocol):
    """Durable raw evidence boundary used by orchestration code."""

    @property
    def durability(self) -> RawEvidenceDurability:
        """Whether this adapter can satisfy a remote retention claim."""
        ...

    def put_snapshot(self, snapshot: RawSnapshotInput) -> RawDocument: ...

    def get_snapshot(self, raw_document_id: str) -> RawDocument | None: ...

    def get_payload(self, raw_document_id: str) -> bytes: ...

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
        )
        self._documents[document.raw_document_id] = document
        return document

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
    if not uri or not database or not (s3_bucket or has_supabase_storage):
        raise RawEvidenceError(
            RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
            "Remote raw evidence requires MongoDB and object-storage configuration.",
            retryable=False,
        )
    from .mongo_raw_evidence import MongoRawEvidenceConfig, MongoRawEvidenceStore
    if s3_bucket:
        # Keep existing S3-compatible configuration behaviour unchanged.
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
    else:
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
    return MongoRawEvidenceStore(
        MongoRawEvidenceConfig(
            uri=uri,
            database=database,
            inline_payload_max_bytes=inline_payload_max_bytes,
        ),
        object_store=object_store,
    )
