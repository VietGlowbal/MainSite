from __future__ import annotations

import hashlib
import io
import os
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from glowbal_ingestion.models import RawDocument, SourceAuthority, SourceRelationship
from glowbal_ingestion.acquisition import SourceCandidate
from glowbal_ingestion.object_store import (
    ObjectReference,
    ObjectStoreError,
    S3ObjectStore,
    S3ObjectStoreConfig,
    RangeSeekableReader,
    stream_digest,
)
from glowbal_ingestion.parser_registry import ParserRegistry
from glowbal_ingestion.raw_evidence import (
    InMemoryRawEvidenceStore,
    RawSnapshotStreamInput,
)
from glowbal_ingestion.source_adapters import SourceAdmissionDecision, persist_admitted_fetch
from glowbal_ingestion.mongo_raw_evidence import MongoRawEvidenceConfig, MongoRawEvidenceStore
from glowbal_ingestion.structured_staging import (
    InMemoryStructuredStagingStore,
    SupabaseStructuredStagingStore,
)
from glowbal_ingestion.supabase_storage import (
    StorageHttpResponse,
    SupabaseStorageConfig,
    SupabaseStorageObjectStore,
)
from glowbal_ingestion.supabase_import import _structured_archive_member_rows


class _RangeStore:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload
        self.ranges: list[tuple[int, int]] = []

    def read_range(self, reference: ObjectReference, start: int, end: int) -> bytes:
        self.ranges.append((start, end))
        return self.payload[start:end]


class _FlakyRangeStore(_RangeStore):
    def __init__(self, payload: bytes) -> None:
        super().__init__(payload)
        self.failures = 1

    def read_range(self, reference: ObjectReference, start: int, end: int) -> bytes:
        self.ranges.append((start, end))
        if self.failures:
            self.failures -= 1
            raise ObjectStoreError("transient range failure", retryable=True)
        return self.payload[start:end]


class _AllowAllRobots:
    def allows(self, *_args, **_kwargs):
        return True


class _NoNetworkFetcher:
    class Limits:
        user_agent = "fixture"
        large_raw_object_threshold_bytes = 8 * 1024 * 1024

    limits = Limits()

    def fetch(self, *_args, **_kwargs):
        raise AssertionError("heavy local candidates must be blocked before fetching")

    def fetch_stream(self, *_args, **_kwargs):
        raise AssertionError("heavy local candidates must be blocked before fetching")


class _StreamingS3:
    def __init__(self) -> None:
        self.payload = b""

    def upload_fileobj(self, reader, bucket, key, ExtraArgs):
        pieces: list[bytes] = []
        while True:
            chunk = reader.read(5)
            if not chunk:
                break
            pieces.append(chunk)
        self.payload = b"".join(pieces)


class _FakeSupabaseClient:
    def __init__(self) -> None:
        self.inserts: list[tuple[str, list[dict]]] = []

    def insert(self, table, rows, *, on_conflict=None):
        self.inserts.append((table, rows))
        return []


class _FakeMongoCollection:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}

    def create_index(self, *_args, **_kwargs):
        return None

    def update_one(self, selector, update, upsert=False):
        key = selector["_id"]
        if key not in self.rows and upsert:
            self.rows[key] = dict(update.get("$setOnInsert") or {})

    def find_one(self, selector):
        row = self.rows.get(selector.get("_id"))
        return dict(row) if row else None

    def find(self, selector):
        return [dict(row) for row in self.rows.values() if all(row.get(k) == v for k, v in selector.items())]


class _FakeMongoDb:
    def __init__(self) -> None:
        self.collections: dict[str, _FakeMongoCollection] = {}

    def __getitem__(self, name):
        return self.collections.setdefault(name, _FakeMongoCollection())


class _StreamingObjectStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put_stream(self, chunks, *, content_type, object_key=None, metadata=None, max_bytes=None):
        payload = b"".join(chunks)
        key = object_key or "raw/stream/test"
        self.objects[key] = payload
        return ObjectReference(key, hashlib.sha256(payload).hexdigest(), len(payload), content_type)

    def read_range(self, reference, start, end):
        return self.objects[reference.key][start:end]

    def open_stream(self, reference):
        return io.BytesIO(self.objects[reference.key])

    def get(self, reference):
        return self.objects[reference.key]

    def exists(self, reference):
        return reference.key in self.objects


class _SupabaseStreamTransport:
    def __init__(self) -> None:
        self.payload = b""

    def request(self, *args, **kwargs):
        return StorageHttpResponse(status=200, headers={}, body=b"")

    def request_stream(self, method, url, *, headers, chunks, timeout_seconds):
        self.payload = b"".join(chunks)
        return StorageHttpResponse(status=200, headers={}, body=b"")

    def open_stream(self, method, url, *, headers, timeout_seconds):
        return io.BytesIO(self.payload)


class HeavyRawStreamingTests(unittest.TestCase):
    def setUp(self) -> None:
        self._artifact_backend = patch.dict(
            os.environ,
            {"DATA_PLATFORM_ARTIFACT_BACKEND": "legacy_supabase_storage"},
        )
        self._artifact_backend.start()
        self.addCleanup(self._artifact_backend.stop)

    def _zip_payload(self) -> bytes:
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                "Most-Recent-Cohorts-Institution.csv",
                "UNITID,Name\n1,One\n2,Two\n3,Three\n",
            )
            archive.writestr("README.txt", "bounded test archive")
        return output.getvalue()

    def test_stream_digest_is_incremental_and_bounded(self) -> None:
        chunks = (part for part in (b"ab", b"cd", b"ef"))
        wrapped, digest = stream_digest(chunks, max_bytes=6)
        self.assertEqual(list(wrapped), [b"ab", b"cd", b"ef"])
        self.assertEqual(digest(), (hashlib.sha256(b"abcdef").hexdigest(), 6))

    def test_s3_stream_upload_consumes_bounded_chunks(self) -> None:
        client = _StreamingS3()
        store = S3ObjectStore(
            S3ObjectStoreConfig(endpoint=None, bucket="raw"),
            client_factory=lambda _config: client,
        )
        reference = store.put_stream(
            (bytes([value]) for value in range(20)),
            content_type="application/octet-stream",
            object_key="raw/streams/run-1/raw-1",
        )
        expected = bytes(range(20))
        self.assertEqual(client.payload, expected)
        self.assertEqual(reference.content_hash, hashlib.sha256(expected).hexdigest())
        self.assertEqual(reference.content_length, len(expected))

    def test_supabase_stream_upload_does_not_buffer_request_body(self) -> None:
        transport = _SupabaseStreamTransport()
        store = SupabaseStorageObjectStore(
            SupabaseStorageConfig(
                base_url="https://project.supabase.co",
                service_role_key="secret",
                bucket="raw",
            ),
            transport=transport,
        )
        expected = bytes(range(20))
        reference = store.put_stream(
            (bytes([value]) for value in range(20)),
            content_type="application/zip",
            object_key="raw/streams/run-1/raw-1",
        )
        self.assertEqual(transport.payload, expected)
        self.assertEqual(reference.content_length, len(expected))

    def test_range_reader_never_requests_the_whole_object(self) -> None:
        payload = b"0123456789" * 10
        reference = ObjectReference("key", "0" * 64, len(payload), "application/octet-stream")
        store = _RangeStore(payload)
        reader = RangeSeekableReader(store, reference, chunk_size=7)
        self.assertEqual(reader.read(-1), payload[:7])
        self.assertTrue(all(end - start <= 7 for start, end in store.ranges))
        reader.seek(0)
        self.assertEqual(reader.read(4), payload[:4])

    def test_range_reader_retries_transient_range_failures(self) -> None:
        payload = b"0123456789" * 10
        reference = ObjectReference("key", "0" * 64, len(payload), "application/octet-stream")
        store = _FlakyRangeStore(payload)
        reader = RangeSeekableReader(
            store, reference, chunk_size=7, retry_backoff_seconds=0
        )
        self.assertEqual(reader.read(4), payload[:4])
        self.assertEqual(len(store.ranges), 2)

    def test_range_reader_preserves_prefetch_on_noop_seek(self) -> None:
        payload = b"0123456789" * 10
        reference = ObjectReference("key", "0" * 64, len(payload), "application/octet-stream")
        store = _RangeStore(payload)
        reader = RangeSeekableReader(store, reference, chunk_size=7)
        self.assertEqual(reader.read(2), b"01")
        # zipfile's shared reader seeks to its current position before each
        # small read.  A no-op seek must not discard the remaining read-ahead.
        reader.seek(2)
        self.assertEqual(reader.read(3), b"234")
        self.assertEqual(len(store.ranges), 1)

    def test_streamed_snapshot_is_retrievable_and_keeps_provenance(self) -> None:
        store = InMemoryRawEvidenceStore()
        document = store.put_snapshot_stream(
            RawSnapshotStreamInput(
                canonical_url="https://example.gov/data.zip",
                chunks=(part for part in (b"PK", b"payload")),
                content_type="application/zip",
                source_authority=SourceAuthority.GOVERNMENT,
                source_relationship=SourceRelationship.GOVERNMENT,
                source_class="government_dataset",
                provider_id="scorecard_bulk",
                dataset_id="scorecard-2026",
                acquisition_run_id="run-1",
            )
        )
        self.assertEqual(store.get_payload(document.raw_document_id), b"PKpayload")
        self.assertEqual(document.provider_id, "scorecard_bulk")
        self.assertEqual(document.dataset_id, "scorecard-2026")
        self.assertEqual(document.content_length, len(b"PKpayload"))

    def test_mongo_streamed_snapshot_uses_object_store_and_seekable_ranges(self) -> None:
        database = _FakeMongoDb()
        objects = _StreamingObjectStore()
        class Client:
            def __getitem__(self, _name):
                return database
        store = MongoRawEvidenceStore(
            MongoRawEvidenceConfig(uri="mongodb://test", database="db", inline_payload_max_bytes=4),
            object_store=objects,
            client_factory=lambda _config: Client(),
        )
        document = store.put_snapshot_stream(
            RawSnapshotStreamInput(
                canonical_url="https://example.gov/large.zip",
                chunks=(b"0123", b"456789"),
                content_type="application/zip",
                provider_id="provider",
                dataset_id="dataset",
                source_class="government_dataset",
                source_authority=SourceAuthority.GOVERNMENT,
                source_relationship=SourceRelationship.GOVERNMENT,
                acquisition_run_id="run-1",
            )
        )
        self.assertEqual(document.payload_location, "object_store")
        self.assertEqual(document.content_length, 10)
        blob = database["raw_blobs"].rows[document.content_hash]
        self.assertEqual(blob["content_hash"], document.content_hash)
        self.assertEqual(blob["size_bytes"], 10)
        self.assertEqual(blob["provider_id"], "provider")
        self.assertEqual(blob["dataset_id"], "dataset")
        self.assertEqual(blob["source_authority"], "GOVERNMENT")
        self.assertEqual(blob["source_relationship"], "GOVERNMENT")
        reader = store.open_payload_seekable(document.raw_document_id)
        self.assertEqual(reader.read(3), b"012")
        reader.close()

    def test_zip_stream_parses_selected_member_through_ranges(self) -> None:
        payload = self._zip_payload()
        digest = hashlib.sha256(payload).hexdigest()
        raw = RawDocument(
            raw_document_id="raw-1",
            source_identity="source-1",
            canonical_url="https://example.gov/data.zip",
            content_hash=digest,
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00Z",
            payload_location="object_store",
            payload_reference="raw/key",
            content_length=len(payload),
            provider_id="scorecard_bulk",
            dataset_id="scorecard-2026",
            source_class="government_dataset",
            source_authority=SourceAuthority.GOVERNMENT,
            source_relationship=SourceRelationship.GOVERNMENT,
            acquisition_run_id="run-1",
        )
        store = _RangeStore(payload)
        reference = ObjectReference("raw/key", digest, len(payload), "application/zip")
        reader = RangeSeekableReader(store, reference, chunk_size=32)
        parsed = ParserRegistry.default().parse_stream(
            raw,
            reader,
            parser_options={
                "structured_archive": {
                    "member_patterns": ["Most-Recent-Cohorts-Institution.csv"],
                    "sample_rows": 2,
                    "chunk_size": 8,
                }
            },
        )
        member = parsed.structured_payload["members"][0]
        self.assertEqual(member["rows_retained"], 2)
        self.assertTrue(member["partial"])
        self.assertEqual(member["lineage"]["raw_document_id"], "raw-1")
        self.assertEqual(member["lineage"]["raw_object_key"], "raw/key")
        self.assertEqual(member["lineage"]["provider_id"], "scorecard_bulk")
        self.assertTrue(store.ranges)
        self.assertTrue(all(end - start <= 32 for start, end in store.ranges))

    def test_zip_stream_matches_exact_identifier_deterministically(self) -> None:
        payload = self._zip_payload()
        digest = hashlib.sha256(payload).hexdigest()
        raw = RawDocument(
            raw_document_id="raw-unitid",
            source_identity="source-unitid",
            canonical_url="https://example.gov/data.zip",
            content_hash=digest,
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00Z",
            payload_location="object_store",
            payload_reference="raw/unitid",
            content_length=len(payload),
            provider_id="scorecard_bulk",
            dataset_id="scorecard-2026",
            source_class="government_dataset",
            source_authority=SourceAuthority.GOVERNMENT,
            source_relationship=SourceRelationship.GOVERNMENT,
            acquisition_run_id="run-unitid",
        )
        store = _RangeStore(payload)
        reader = RangeSeekableReader(
            store,
            ObjectReference("raw/unitid", digest, len(payload), "application/zip"),
            chunk_size=32,
        )
        parsed = ParserRegistry.default().parse_stream(
            raw,
            reader,
            parser_options={
                "structured_archive": {
                    "member_patterns": ["Most-Recent-Cohorts-Institution.csv"],
                    "target_identifiers": {"UNITID": ["2"]},
                    "identifier_fields": ["UNITID"],
                    "match_mode": "all",
                    "max_rows": 1,
                    "chunk_size": 8,
                }
            },
        )
        member = parsed.structured_payload["members"][0]
        self.assertEqual(member["rows_scanned"], 2)
        self.assertEqual(member["structured"], [{"UNITID": "2", "Name": "Two"}])
        self.assertTrue(all(end - start <= 32 for start, end in store.ranges))

    def test_zip_stream_skips_unselected_members_without_decompression(self) -> None:
        payload_buffer = io.BytesIO()
        with zipfile.ZipFile(payload_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("selected.csv", "UNITID,Name\n1,One\n")
            archive.writestr("unselected.csv", "UNITID,Name\n2,Two\n")
        payload = payload_buffer.getvalue()
        digest = hashlib.sha256(payload).hexdigest()
        raw = RawDocument(
            raw_document_id="raw-skip",
            source_identity="source-skip",
            canonical_url="https://example.gov/data.zip",
            content_hash=digest,
            content_type="application/zip",
            retrieved_at="2026-09-10T00:00:00Z",
            payload_location="object_store",
            payload_reference="raw/skip",
            content_length=len(payload),
        )
        store = _RangeStore(payload)
        reader = RangeSeekableReader(
            store,
            ObjectReference("raw/skip", digest, len(payload), "application/zip"),
            chunk_size=32,
        )
        parsed = ParserRegistry.default().parse_stream(
            raw,
            reader,
            parser_options={
                "structured_archive": {
                    "member_patterns": ["selected.csv"],
                    "sample_rows": 1,
                    "chunk_size": 8,
                }
            },
        )
        skipped = next(item for item in parsed.structured_payload["members"] if item["name"] == "unselected.csv")
        self.assertTrue(skipped["skipped"])
        self.assertEqual(skipped["skip_reason"], "not_selected")

    def test_heavy_candidate_cannot_use_local_raw_store(self) -> None:
        candidate = SourceCandidate.create(
            canonical_locator="https://example.gov/data.zip",
            locator_type="provider_resource",
            source_class="government_dataset",
            adapter_id="government_dataset",
            provider_id="provider",
            dataset_id="dataset",
            declared_authority=SourceAuthority.GOVERNMENT,
            relationship=SourceRelationship.GOVERNMENT,
            adapter_metadata={
                "retrieval_type": "zip",
                "max_bytes": 16 * 1024 * 1024,
            },
        )
        decision = SourceAdmissionDecision(
            candidate=candidate,
            admitted=True,
            reason="fixture",
            factor_scores={},
            total_score=1,
            allowed_domains=("example.gov",),
        )
        _, attempt = persist_admitted_fetch(
            candidate=candidate,
            decision=decision,
            fetcher=_NoNetworkFetcher(),
            raw_store=InMemoryRawEvidenceStore(),
            acquisition_run_id="run-1",
            robots_policy=_AllowAllRobots(),
            require_remote_durability=False,
        )
        self.assertEqual(attempt.status, "RAW_PERSIST_FAILED")
        self.assertEqual(attempt.admission_reason, "HEAVY_RAW_REQUIRES_REMOTE_DURABILITY")

    def test_structured_staging_persists_lineage(self) -> None:
        sink = InMemoryStructuredStagingStore()
        record = {
            "derived_resource_id": "derived-1",
            "raw_document_id": "raw-1",
            "raw_object_key": "raw/key",
            "raw_content_hash": "a" * 64,
            "provider_id": "scorecard_bulk",
            "dataset_id": "scorecard-2026",
            "source_class": "government_dataset",
            "source_authority": "GOVERNMENT",
            "source_relationship": "GOVERNMENT",
            "archive_member": "Most-Recent-Cohorts-Institution.csv",
            "rows": [{"UNITID": "1"}],
            "acquisition_run_id": "run-1",
        }
        self.assertEqual(sink.put_archive_members([record]), 1)
        self.assertEqual(sink.records[0]["raw_object_key"], "raw/key")
        self.assertEqual(sink.records[0]["archive_member"], "Most-Recent-Cohorts-Institution.csv")

    def test_supabase_staging_maps_archive_and_raw_lineage(self) -> None:
        client = _FakeSupabaseClient()
        sink = SupabaseStructuredStagingStore(client)
        self.assertEqual(
            sink.put_archive_members(
                [
                    {
                        "derived_resource_id": "derived-1",
                        "raw_document_id": "raw-1",
                        "zip_content_hash": "b" * 64,
                        "member_name": "data.csv",
                        "rows": [{"UNITID": "1"}],
                        "provider_id": "scorecard_bulk",
                        "acquisition_run_id": "run-1",
                    }
                ]
            ),
            1,
        )
        table, rows = client.inserts[0]
        self.assertEqual(table, "crawl_external_structured_rows")
        self.assertEqual(rows[0]["raw_content_hash"], "b" * 64)
        self.assertEqual(rows[0]["archive_member"], "data.csv")

    def test_import_artifact_maps_structured_rows_to_additive_staging(self) -> None:
        with __import__("tempfile").TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "structured_archive_members.jsonl").write_text(
                '{"derived_resource_id":"d1","provider_id":"p1","zip_content_hash":"c1","member_name":"data.csv","rows":[{"UNITID":"1"}]}\n',
                encoding="utf-8",
            )
            row = next(_structured_archive_member_rows(root, "supabase-run"))
        self.assertEqual(row["run_id"], "supabase-run")
        self.assertEqual(row["raw_content_hash"], "c1")
        self.assertEqual(row["archive_member"], "data.csv")


if __name__ == "__main__":
    unittest.main()
