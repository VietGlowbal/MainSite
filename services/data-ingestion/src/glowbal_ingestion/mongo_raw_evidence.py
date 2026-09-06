"""MongoDB adapter for immutable raw evidence.

Only this module understands MongoDB collection documents.  Core ingestion code
uses :mod:`raw_evidence` interfaces and core dataclasses exclusively.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .models import RawDocument, SourceAuthority, SourceRelationship
from .object_store import ObjectReference, ObjectStore, ObjectStoreError
from .raw_evidence import (
    RawEvidenceDurability,
    RawEvidenceError,
    RawEvidenceErrorCode,
    RawEvidenceStore,
    RawSnapshotInput,
)


@dataclass(frozen=True)
class MongoRawEvidenceConfig:
    uri: str
    database: str
    inline_payload_max_bytes: int = 8 * 1024 * 1024
    connect_timeout_ms: int = 5_000
    server_selection_timeout_ms: int = 5_000
    socket_timeout_ms: int = 30_000

    def __post_init__(self) -> None:
        if not self.uri or not self.database:
            raise ValueError("Mongo URI and database are required.")
        if not 0 < self.inline_payload_max_bytes <= 12 * 1024 * 1024:
            raise ValueError(
                "Mongo inline payload threshold must be between 1 byte and 12 MiB."
            )


class MongoRawEvidenceStore(RawEvidenceStore):
    BLOBS_COLLECTION = "raw_blobs"
    SNAPSHOTS_COLLECTION = "source_snapshots"

    def __init__(
        self,
        config: MongoRawEvidenceConfig,
        *,
        object_store: ObjectStore | None = None,
        client_factory: Callable[[MongoRawEvidenceConfig], Any] | None = None,
    ) -> None:
        self.config = config
        self.object_store = object_store
        self._client_factory = client_factory
        self._client: Any | None = None
        self._database: Any | None = None
        self._indexes_ready = False

    @property
    def durability(self) -> RawEvidenceDurability:
        """This adapter is only used after a remote Mongo write succeeds."""
        return RawEvidenceDurability.REMOTE_DURABLE

    def _db(self) -> Any:
        if self._database is not None:
            return self._database
        if self._client_factory is not None:
            self._client = self._client_factory(self.config)
            self._database = self._client[self.config.database]
            return self._database
        try:
            from pymongo import MongoClient
            from pymongo.read_concern import ReadConcern
            from pymongo.write_concern import WriteConcern
        except ImportError as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
                "Mongo raw evidence requires the durable-evidence dependency extra.",
                retryable=False,
            ) from exc
        self._client = MongoClient(
            self.config.uri,
            retryWrites=True,
            connectTimeoutMS=self.config.connect_timeout_ms,
            serverSelectionTimeoutMS=self.config.server_selection_timeout_ms,
            socketTimeoutMS=self.config.socket_timeout_ms,
            appname="glowbal-data-ingestion-raw-evidence",
        )
        self._database = self._client.get_database(
            self.config.database,
            write_concern=WriteConcern(w="majority", j=True),
            read_concern=ReadConcern("majority"),
        )
        return self._database

    def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        try:
            database = self._db()
            database[self.BLOBS_COLLECTION].create_index(
                [("created_at", 1)], name="raw_blobs_created_at"
            )
            snapshots = database[self.SNAPSHOTS_COLLECTION]
            snapshots.create_index(
                [("source_identity", 1), ("retrieved_at", -1)],
                name="source_identity_retrieved_at",
            )
            snapshots.create_index(
                [("content_hash", 1), ("retrieved_at", -1)],
                name="content_hash_retrieved_at",
            )
            snapshots.create_index(
                [("acquisition_run_id", 1), ("retrieved_at", -1)],
                name="acquisition_run_retrieved_at",
            )
            self._indexes_ready = True
        except RawEvidenceError:
            raise
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Mongo raw evidence index setup failed.",
                retryable=True,
            ) from exc

    @staticmethod
    def _raw_document(record: dict[str, Any]) -> RawDocument:
        return RawDocument(
            raw_document_id=str(record["_id"]),
            source_identity=str(record["source_identity"]),
            canonical_url=str(record["canonical_url"]),
            content_hash=str(record["content_hash"]),
            content_type=record.get("content_type"),
            retrieved_at=str(record["retrieved_at"]),
            payload_location=str(record["payload_location"]),
            payload_reference=record.get("payload_reference"),
            http_status=record.get("http_status"),
            safe_response_headers=dict(record.get("safe_response_headers") or {}),
            published_at=record.get("published_at"),
            academic_cycle=record.get("academic_cycle"),
            language=record.get("language"),
            fetch_method=record.get("fetch_method"),
            rendered=bool(record.get("rendered", False)),
            acquisition_run_id=record.get("acquisition_run_id"),
            source_authority=(
                SourceAuthority(record["source_authority"])
                if record.get("source_authority")
                else None
            ),
            source_relationship=(
                SourceRelationship(record["source_relationship"])
                if record.get("source_relationship")
                else None
            ),
            schema_version=str(record.get("schema_version") or "raw-document/v1"),
        )

    def _store_blob(self, snapshot: RawSnapshotInput) -> tuple[str, str]:
        payload_hash = snapshot.payload_hash
        if len(snapshot.payload) <= self.config.inline_payload_max_bytes:
            blob = {
                "_id": payload_hash,
                "payload_location": "mongo_inline",
                "payload": bytes(snapshot.payload),
                "content_length": len(snapshot.payload),
                "content_type": snapshot.content_type,
                "created_at": snapshot.retrieved_at,
            }
            self._db()[self.BLOBS_COLLECTION].update_one(
                {"_id": payload_hash}, {"$setOnInsert": blob}, upsert=True
            )
            return "mongo_inline", payload_hash
        if self.object_store is None:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                "Oversize raw payload requires configured object storage.",
                retryable=False,
            )
        try:
            reference = self.object_store.put_immutable(
                snapshot.payload,
                content_hash=payload_hash,
                content_type=snapshot.content_type,
            )
        except ObjectStoreError as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                "Object-store persistence failed for raw evidence.",
                retryable=exc.retryable,
            ) from exc
        self._db()[self.BLOBS_COLLECTION].update_one(
            {"_id": payload_hash},
            {
                "$setOnInsert": {
                    "_id": payload_hash,
                    "payload_location": "object_store",
                    "object_key": reference.key,
                    "content_length": reference.content_length,
                    "content_type": reference.content_type,
                    "created_at": snapshot.retrieved_at,
                }
            },
            upsert=True,
        )
        return "object_store", reference.key

    def put_snapshot(self, snapshot: RawSnapshotInput) -> RawDocument:
        try:
            self.ensure_indexes()
            snapshots = self._db()[self.SNAPSHOTS_COLLECTION]
            existing = snapshots.find_one({"_id": snapshot.raw_document_id})
            if existing is not None:
                document = self._raw_document(existing)
                if document.content_hash != snapshot.payload_hash:
                    raise RawEvidenceError(
                        RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                        "Snapshot id was reused with different content.",
                        retryable=False,
                    )
                return document
            payload_location, payload_reference = self._store_blob(snapshot)
            record = {
                "_id": snapshot.raw_document_id,
                "source_identity": snapshot.source_identity,
                "canonical_url": snapshot.canonical_url,
                "content_hash": snapshot.payload_hash,
                "content_type": snapshot.content_type,
                "retrieved_at": snapshot.retrieved_at,
                "payload_location": payload_location,
                "payload_reference": payload_reference,
                "http_status": snapshot.http_status,
                "safe_response_headers": dict(snapshot.safe_response_headers),
                "published_at": snapshot.published_at,
                "academic_cycle": snapshot.academic_cycle,
                "language": snapshot.language,
                "fetch_method": snapshot.fetch_method,
                "rendered": snapshot.rendered,
                "acquisition_run_id": snapshot.acquisition_run_id,
                "source_authority": (
                    snapshot.source_authority.value
                    if snapshot.source_authority
                    else None
                ),
                "source_relationship": (
                    snapshot.source_relationship.value
                    if snapshot.source_relationship
                    else None
                ),
                "schema_version": "raw-document/v1",
            }
            snapshots.update_one(
                {"_id": snapshot.raw_document_id},
                {"$setOnInsert": record},
                upsert=True,
            )
            persisted = snapshots.find_one({"_id": snapshot.raw_document_id})
            if persisted is None:
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                    "Mongo did not return the persisted raw snapshot.",
                    retryable=True,
                )
            return self._raw_document(persisted)
        except RawEvidenceError as exc:
            # Do not leak an availability/setup diagnosis through the write
            # boundary: callers deciding whether extraction may proceed need
            # one explicit durable-persistence failure state.
            if exc.code == RawEvidenceErrorCode.RAW_PERSIST_FAILED:
                raise
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                "Mongo raw evidence persistence failed.",
                retryable=exc.retryable,
                cause_code=exc.code,
            ) from exc
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_PERSIST_FAILED,
                "Mongo raw evidence persistence failed.",
                retryable=True,
            ) from exc

    def get_snapshot(self, raw_document_id: str) -> RawDocument | None:
        try:
            record = self._db()[self.SNAPSHOTS_COLLECTION].find_one(
                {"_id": raw_document_id}
            )
            return self._raw_document(record) if record else None
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Mongo raw evidence lookup failed.",
                retryable=True,
            ) from exc

    def get_payload(self, raw_document_id: str) -> bytes:
        document = self.get_snapshot(raw_document_id)
        if document is None:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_NOT_FOUND,
                "Raw snapshot does not exist.",
                retryable=False,
            )
        try:
            blob = self._db()[self.BLOBS_COLLECTION].find_one(
                {"_id": document.content_hash}
            )
            if blob is None:
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_NOT_FOUND,
                    "Raw payload metadata does not exist.",
                    retryable=False,
                )
            if blob.get("payload_location") == "mongo_inline":
                payload = bytes(blob.get("payload") or b"")
            else:
                if self.object_store is None:
                    raise RawEvidenceError(
                        RawEvidenceErrorCode.RAW_CONFIGURATION_INVALID,
                        "Object storage is required to read this raw payload.",
                        retryable=False,
                    )
                payload = self.object_store.get(
                    ObjectReference(
                        key=str(blob["object_key"]),
                        content_hash=document.content_hash,
                        content_length=int(blob["content_length"]),
                        content_type=blob.get("content_type"),
                    )
                )
            if len(payload) != int(blob.get("content_length") or -1):
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_CORRUPT,
                    "Raw payload length does not match retained metadata.",
                    retryable=False,
                )
            from .raw_evidence import content_hash

            if content_hash(payload) != document.content_hash:
                raise RawEvidenceError(
                    RawEvidenceErrorCode.RAW_CORRUPT,
                    "Raw payload checksum does not match retained metadata.",
                    retryable=False,
                )
            return payload
        except RawEvidenceError:
            raise
        except ObjectStoreError as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Object-store raw evidence read failed.",
                retryable=exc.retryable,
            ) from exc
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Mongo raw evidence payload lookup failed.",
                retryable=True,
            ) from exc

    def find_by_content_hash(self, payload_hash: str) -> list[RawDocument]:
        try:
            records = self._db()[self.SNAPSHOTS_COLLECTION].find(
                {"content_hash": payload_hash}
            ).sort("retrieved_at", -1)
            return [self._raw_document(record) for record in records]
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Mongo raw evidence content lookup failed.",
                retryable=True,
            ) from exc

    def list_snapshots(
        self, source_identity: str, *, limit: int = 100
    ) -> list[RawDocument]:
        try:
            records = (
                self._db()[self.SNAPSHOTS_COLLECTION]
                .find({"source_identity": source_identity})
                .sort("retrieved_at", -1)
                .limit(limit)
            )
            return [self._raw_document(record) for record in records]
        except Exception as exc:
            raise RawEvidenceError(
                RawEvidenceErrorCode.RAW_UNAVAILABLE,
                "Mongo raw evidence history lookup failed.",
                retryable=True,
            ) from exc
