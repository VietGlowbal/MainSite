from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from glowbal_ingestion.config import CrawlLimits, InstitutionSeed, SmokeConfig
from glowbal_ingestion.fetcher import FetchError
from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import FetchResult, RawDocument
from glowbal_ingestion.mongo_raw_evidence import (
    MongoRawEvidenceConfig,
    MongoRawEvidenceStore,
)
from glowbal_ingestion.object_store import (
    ObjectReference,
    ObjectStore,
    ObjectStoreError,
    S3ObjectStore,
    S3ObjectStoreConfig,
    content_addressed_key,
)
from glowbal_ingestion.parser_registry import ParserRegistry
from glowbal_ingestion.raw_evidence import (
    InMemoryRawEvidenceStore,
    RawEvidenceDurability,
    RawEvidenceError,
    RawEvidenceErrorCode,
    RawSnapshotInput,
    content_hash,
)
from glowbal_ingestion.pipeline import SmokePipeline
from glowbal_ingestion.storage import JsonlStore, RunPaths
from glowbal_ingestion.supabase_storage import (
    SupabaseStorageConfig,
    SupabaseStorageObjectStore,
)
from glowbal_ingestion.validation import fact_to_assertion


class _Cursor(list):
    def sort(self, field: str, direction: int):
        return _Cursor(
            sorted(self, key=lambda item: item.get(field) or "", reverse=direction < 0)
        )

    def limit(self, value: int):
        return _Cursor(self[:value])


class _Collection:
    def __init__(self) -> None:
        self.documents: dict[str, dict] = {}
        self.indexes: list[tuple] = []

    def create_index(self, keys, **kwargs):
        self.indexes.append((tuple(keys), kwargs.get("name")))

    def update_one(self, selector, update, upsert=False):
        key = selector["_id"]
        if key not in self.documents and upsert:
            self.documents[key] = dict(update.get("$setOnInsert") or {})

    def find_one(self, selector):
        if "_id" in selector:
            value = self.documents.get(selector["_id"])
            return dict(value) if value else None
        for value in self.documents.values():
            if all(value.get(key) == expected for key, expected in selector.items()):
                return dict(value)
        return None

    def find(self, selector):
        return _Cursor(
            [
                dict(value)
                for value in self.documents.values()
                if all(value.get(key) == expected for key, expected in selector.items())
            ]
        )


class _Database:
    def __init__(self) -> None:
        self.collections: dict[str, _Collection] = {}

    def __getitem__(self, name: str) -> _Collection:
        return self.collections.setdefault(name, _Collection())


class _MongoClient:
    def __init__(self) -> None:
        self.database = _Database()

    def __getitem__(self, _name: str) -> _Database:
        return self.database


class _UnavailableMongoClient:
    def __getitem__(self, _name: str) -> _Database:
        raise TimeoutError("simulated mongo timeout")


class _MemoryObjectStore(ObjectStore):
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put_immutable(self, payload, *, content_hash, content_type):
        if content_hash != __import__("hashlib").sha256(payload).hexdigest():
            raise ObjectStoreError("bad checksum", retryable=False)
        reference = ObjectReference(
            key=content_addressed_key(content_hash),
            content_hash=content_hash,
            content_length=len(payload),
            content_type=content_type,
        )
        self.objects.setdefault(reference.key, bytes(payload))
        return reference

    def get(self, reference):
        return self.objects[reference.key]

    def exists(self, reference):
        return reference.key in self.objects


class _FailingObjectStore(_MemoryObjectStore):
    def put_immutable(self, *args, **kwargs):
        raise ObjectStoreError("offline", retryable=True)


class _NotFound(Exception):
    response = {"Error": {"Code": "404"}}


class _FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, dict]] = {}

    def head_object(self, *, Bucket, Key):
        if Key not in self.objects:
            raise _NotFound()
        payload, metadata = self.objects[Key]
        return {"ContentLength": len(payload), "Metadata": metadata}

    def put_object(self, *, Bucket, Key, Body, ContentType, Metadata):
        self.objects[Key] = (bytes(Body), dict(Metadata))

    def get_object(self, *, Bucket, Key):
        payload, _metadata = self.objects[Key]
        return {"Body": io.BytesIO(payload)}


class _UnavailableSupabaseTransport:
    def request(self, *args, **kwargs):
        raise TimeoutError("simulated storage timeout")


class RawEvidenceContractTests(unittest.TestCase):
    def test_same_content_has_distinct_snapshot_history(self) -> None:
        store = InMemoryRawEvidenceStore()
        self.assertEqual(store.durability, RawEvidenceDurability.LOCAL_ONLY)
        first = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/program",
                payload=b"same body",
                content_type="text/html",
                retrieved_at="2026-08-01T00:00:00+00:00",
            )
        )
        second = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/program",
                payload=b"same body",
                content_type="text/html",
                retrieved_at="2026-08-02T00:00:00+00:00",
            )
        )
        self.assertNotEqual(first.raw_document_id, second.raw_document_id)
        self.assertEqual(first.content_hash, second.content_hash)
        self.assertEqual(
            [item.raw_document_id for item in store.list_snapshots(first.source_identity)],
            [second.raw_document_id, first.raw_document_id],
        )
        self.assertEqual(store.get_payload(first.raw_document_id), b"same body")

    def test_expected_hash_failure_is_explicit_and_non_retryable(self) -> None:
        with self.assertRaises(RawEvidenceError) as raised:
            RawSnapshotInput(
                canonical_url="https://example.edu/program",
                payload=b"body",
                content_type="text/html",
                expected_content_hash="0" * 64,
            )
        self.assertEqual(raised.exception.code, RawEvidenceErrorCode.RAW_CORRUPT)
        self.assertFalse(raised.exception.retryable)

    def test_reprocesses_retained_snapshot_without_local_files(self) -> None:
        store = InMemoryRawEvidenceStore()
        document = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/program",
                payload=b"<html><title>Programme</title><body>Tuition</body></html>",
                content_type="text/html; charset=utf-8",
            )
        )
        with tempfile.TemporaryDirectory() as temporary:
            local_file = Path(temporary) / "old-run.html"
            local_file.write_bytes(b"obsolete")
            local_file.unlink()
            parsed = ParserRegistry.default().parse(
                document, store.get_payload(document.raw_document_id)
            )
        self.assertEqual(parsed.raw_document_id, document.raw_document_id)
        self.assertEqual(parsed.parser_id, "html-visible-text")
        self.assertEqual(parsed.parser_version, "1")
        self.assertIn("Tuition", parsed.text)

    def test_json_parser_retains_structured_payload(self) -> None:
        document = RawDocument(
            raw_document_id="00000000-0000-0000-0000-000000000001",
            source_identity="source",
            canonical_url="https://example.edu/api",
            content_hash=content_hash(b'{"fee": 123}'),
            content_type="application/json",
            retrieved_at="2026-08-01T00:00:00+00:00",
            payload_location="memory",
            payload_reference="hash",
        )
        parsed = ParserRegistry.default().parse(document, b'{"fee": 123}')
        self.assertEqual(parsed.parser_id, "json-structured")
        self.assertEqual(parsed.structured_payload, {"fee": 123})

    def test_same_content_snapshots_keep_exact_assertion_provenance(self) -> None:
        first = ExtractionSource(
            url="https://example.edu/program?cycle=2025",
            page_type="programme_overview",
            title="Programme",
            text="The programme lasts 2 years.",
            content_hash="a" * 64,
            raw_document_id="00000000-0000-0000-0000-000000000001",
            parser_id="html-visible-text",
            parser_version="parser/html-v1",
        )
        second = ExtractionSource(
            url="https://example.edu/program?cycle=2026",
            page_type="programme_overview",
            title="Programme",
            text="The programme lasts 2 years.",
            content_hash="a" * 64,
            raw_document_id="00000000-0000-0000-0000-000000000002",
            parser_id="html-visible-text",
            parser_version="parser/html-v1",
        )
        base_fact = {
            "field_name": "duration",
            "value": "2 years",
            "evidence": "The programme lasts 2 years.",
            "_provider_id": "deepseek",
            "_prompt_version": "prompt/v1",
            "_schema_version": "schema/v1",
        }
        first_assertion = fact_to_assertion(
            entity_id="programme-1",
            fact={**base_fact, "source_url": first.url},
            source_map={first.url: first},
            model_name="test-model",
            extractor_version="test",
        )
        second_assertion = fact_to_assertion(
            entity_id="programme-1",
            fact={**base_fact, "source_url": second.url},
            source_map={second.url: second},
            model_name="test-model",
            extractor_version="test",
        )
        self.assertEqual(first_assertion.raw_document_id, first.raw_document_id)
        self.assertEqual(second_assertion.raw_document_id, second.raw_document_id)
        self.assertNotEqual(
            first_assertion.raw_document_id, second_assertion.raw_document_id
        )
        self.assertEqual(first_assertion.parser_version, "parser/html-v1")
        self.assertEqual(first_assertion.provider_id, "deepseek")
        self.assertEqual(first_assertion.prompt_version, "prompt/v1")
        self.assertEqual(first_assertion.schema_version, "schema/v1")

    def test_dual_mode_local_mirror_uses_snapshot_not_url_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            store = JsonlStore(RunPaths.create(Path(temporary)))
            first = store.save_raw_snapshot(
                content=b"same url, first observation",
                content_type="text/html",
                raw_document_id="00000000-0000-0000-0000-000000000001",
            )
            second = store.save_raw_snapshot(
                content=b"same url, second observation",
                content_type="text/html",
                raw_document_id="00000000-0000-0000-0000-000000000002",
            )
            self.assertNotEqual(first, second)
            self.assertTrue((Path(temporary) / first).exists())
            self.assertTrue((Path(temporary) / second).exists())

    def test_remote_persistence_failure_is_structured_and_stops_accepted_parse(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="raw-failure",
            institutions=(seed,),
            limits=CrawlLimits(min_request_interval_seconds=0),
            raw_evidence_mode="remote",
        )
        with tempfile.TemporaryDirectory() as temporary:
            pipeline = SmokePipeline(
                config,
                Path(temporary) / "run",
                allow_unreviewed_terms=False,
                discovery_only=True,
                raw_evidence_store=MongoRawEvidenceStore(
                    MongoRawEvidenceConfig(
                        uri="mongodb://test.invalid",
                        database="raw_test",
                        inline_payload_max_bytes=1024,
                    ),
                    client_factory=lambda _config: _UnavailableMongoClient(),
                ),
            )
            pipeline.fetcher = SimpleNamespace(
                fetch=lambda *_args, **_kwargs: FetchResult(
                    requested_url="https://example.edu/program",
                    final_url="https://example.edu/program",
                    status=200,
                    headers={"content-type": "text/html"},
                    content_type="text/html",
                    body=b"<html><body>Programme</body></html>",
                    content_hash=content_hash(b"<html><body>Programme</body></html>"),
                    retrieved_at="2026-08-01T00:00:00+00:00",
                )
            )
            try:
                with self.assertRaises(FetchError) as raised:
                    pipeline._fetch_and_parse_source(
                        seed,
                        SimpleNamespace(allows=lambda *_args: True),
                        "https://example.edu/program",
                    )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()
            self.assertEqual(
                raised.exception.code, RawEvidenceErrorCode.RAW_PERSIST_FAILED.value
            )
            events = (Path(temporary) / "run" / "raw_persistence_events.jsonl").read_text(
                encoding="utf-8"
            )
            self.assertIn("RAW_PERSIST_FAILED", events)
            self.assertIn("RAW_UNAVAILABLE", events)
            self.assertFalse((Path(temporary) / "run" / "sources.jsonl").exists())

    def test_remote_mode_rejects_local_only_store_before_fetch(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        config = SmokeConfig(
            run_name="remote-rejects-memory",
            institutions=(seed,),
            limits=CrawlLimits(min_request_interval_seconds=0),
            raw_evidence_mode="remote",
        )
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError) as raised:
                SmokePipeline(
                    config,
                    Path(temporary) / "run",
                    allow_unreviewed_terms=False,
                    discovery_only=True,
                    raw_evidence_store=InMemoryRawEvidenceStore(),
                )
        self.assertIn("REMOTE_DURABLE", str(raised.exception))

    def test_remote_mode_parses_from_persisted_snapshot_without_local_raw_file(self) -> None:
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu/",
            terms_status="APPROVED",
        )
        remote_client = _MongoClient()
        retained = MongoRawEvidenceStore(
            MongoRawEvidenceConfig(
                uri="mongodb://test.invalid",
                database="raw_test",
                inline_payload_max_bytes=1024,
            ),
            client_factory=lambda _config: remote_client,
        )
        config = SmokeConfig(
            run_name="remote-success",
            institutions=(seed,),
            limits=CrawlLimits(min_request_interval_seconds=0),
            raw_evidence_mode="remote",
        )
        body = b"<html><title>Programme</title><body>Tuition</body></html>"
        with tempfile.TemporaryDirectory() as temporary:
            run_dir = Path(temporary) / "run"
            pipeline = SmokePipeline(
                config,
                run_dir,
                allow_unreviewed_terms=False,
                discovery_only=True,
                raw_evidence_store=retained,
            )
            pipeline.fetcher = SimpleNamespace(
                fetch=lambda *_args, **_kwargs: FetchResult(
                    requested_url="https://example.edu/program",
                    final_url="https://example.edu/program",
                    status=200,
                    headers={"content-type": "text/html"},
                    content_type="text/html",
                    body=body,
                    content_hash=content_hash(body),
                    retrieved_at="2026-08-01T00:00:00+00:00",
                )
            )
            try:
                document, source, _links = pipeline._fetch_and_parse_source(
                    seed,
                    SimpleNamespace(allows=lambda *_args: True),
                    "https://example.edu/program",
                )
                repeated_document, _repeated_source, _links = (
                    pipeline._fetch_and_parse_source(
                        seed,
                        SimpleNamespace(allows=lambda *_args: True),
                        "https://example.edu/program",
                    )
                )
            finally:
                pipeline.state.close()
                pipeline.llm_state.close()
            self.assertIsNotNone(document.raw_document_id)
            self.assertTrue(source.raw_document_id)
            self.assertEqual(document.source_id, repeated_document.source_id)
            self.assertNotEqual(
                document.raw_document_id, repeated_document.raw_document_id
            )
            self.assertFalse(any((run_dir / "raw").rglob("*.*")))
            raw = retained.get_snapshot(document.raw_document_id or "")
            self.assertIsNotNone(raw)
            reparsed = ParserRegistry.default().parse(
                raw, retained.get_payload(raw.raw_document_id)  # type: ignore[union-attr]
            )
            self.assertEqual(reparsed.parser_version, document.parser_version)
            self.assertIn("Tuition", reparsed.text)


class MongoRawEvidenceTests(unittest.TestCase):
    def _store(self, object_store=None):
        self.client = _MongoClient()
        return MongoRawEvidenceStore(
            MongoRawEvidenceConfig(
                uri="mongodb://test.invalid",
                database="raw_test",
                inline_payload_max_bytes=8,
            ),
            object_store=object_store,
            client_factory=lambda _config: self.client,
        )

    def test_dedupes_blob_but_keeps_two_snapshots_and_indexes(self) -> None:
        store = self._store()
        first = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/p",
                payload=b"small",
                content_type="text/html",
                retrieved_at="2026-08-01T00:00:00+00:00",
            )
        )
        second = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/p",
                payload=b"small",
                content_type="text/html",
                retrieved_at="2026-08-02T00:00:00+00:00",
            )
        )
        blobs = self.client.database["raw_blobs"].documents
        snapshots = self.client.database["source_snapshots"].documents
        self.assertEqual(len(blobs), 1)
        self.assertEqual(len(snapshots), 2)
        self.assertNotEqual(first.raw_document_id, second.raw_document_id)
        self.assertEqual(store.get_payload(second.raw_document_id), b"small")
        self.assertGreaterEqual(
            len(self.client.database["source_snapshots"].indexes), 3
        )

    def test_uses_object_storage_beyond_conservative_inline_threshold(self) -> None:
        objects = _MemoryObjectStore()
        store = self._store(objects)
        document = store.put_snapshot(
            RawSnapshotInput(
                canonical_url="https://example.edu/handbook.pdf",
                payload=b"0123456789",
                content_type="application/pdf",
            )
        )
        self.assertEqual(document.payload_location, "object_store")
        self.assertEqual(store.get_payload(document.raw_document_id), b"0123456789")

    def test_object_storage_failure_never_reports_persisted_snapshot(self) -> None:
        store = self._store(_FailingObjectStore())
        with self.assertRaises(RawEvidenceError) as raised:
            store.put_snapshot(
                RawSnapshotInput(
                    canonical_url="https://example.edu/large.pdf",
                    payload=b"0123456789",
                    content_type="application/pdf",
                )
            )
        self.assertEqual(
            raised.exception.code, RawEvidenceErrorCode.RAW_PERSIST_FAILED
        )
        self.assertFalse(self.client.database["source_snapshots"].documents)

    def test_supabase_storage_oversize_failure_has_no_dangling_snapshot(self) -> None:
        object_store = SupabaseStorageObjectStore(
            SupabaseStorageConfig(
                base_url="https://project.supabase.co",
                service_role_key="test-service-role",
                bucket="raw-evidence",
            ),
            transport=_UnavailableSupabaseTransport(),
        )
        store = self._store(object_store)
        with self.assertRaises(RawEvidenceError) as raised:
            store.put_snapshot(
                RawSnapshotInput(
                    canonical_url="https://example.edu/large.pdf",
                    payload=b"0123456789",
                    content_type="application/pdf",
                )
            )
        self.assertEqual(
            raised.exception.code, RawEvidenceErrorCode.RAW_PERSIST_FAILED
        )
        self.assertFalse(self.client.database["source_snapshots"].documents)

    def test_mongo_unavailable_maps_to_generic_retryable_error(self) -> None:
        store = MongoRawEvidenceStore(
            MongoRawEvidenceConfig(
                uri="mongodb://test.invalid",
                database="raw_test",
                inline_payload_max_bytes=8,
            ),
            client_factory=lambda _config: _UnavailableMongoClient(),
        )
        with self.assertRaises(RawEvidenceError) as raised:
            store.put_snapshot(
                RawSnapshotInput(
                    canonical_url="https://example.edu/p",
                    payload=b"small",
                    content_type="text/html",
                )
            )
        self.assertEqual(
            raised.exception.code, RawEvidenceErrorCode.RAW_PERSIST_FAILED
        )
        self.assertEqual(
            raised.exception.cause_code, RawEvidenceErrorCode.RAW_UNAVAILABLE
        )
        self.assertTrue(raised.exception.retryable)


class ObjectStoreTests(unittest.TestCase):
    def test_s3_compatible_store_uses_immutable_content_addressed_key(self) -> None:
        client = _FakeS3()
        store = S3ObjectStore(
            S3ObjectStoreConfig(endpoint="http://test", bucket="raw"),
            client_factory=lambda _config: client,
        )
        payload = b"binary payload"
        digest = content_hash(payload)
        first = store.put_immutable(
            payload, content_hash=digest, content_type="application/pdf"
        )
        second = store.put_immutable(
            payload, content_hash=digest, content_type="application/pdf"
        )
        self.assertEqual(first, second)
        self.assertEqual(first.key, content_addressed_key(digest))
        self.assertEqual(store.get(first), payload)


class AcquisitionMigrationTests(unittest.TestCase):
    def test_slice_a_migration_is_additive_and_excludes_raw_payload_columns(self) -> None:
        migration = (
            Path(__file__).resolve().parents[3] / "supabase-crawl-acquisition-v3.sql"
        ).read_text(encoding="utf-8").lower()
        self.assertIn("create table if not exists public.crawl_acquisition_intents", migration)
        self.assertIn("add column if not exists raw_document_id", migration)
        self.assertNotIn("drop table", migration)
        self.assertNotIn("drop column", migration)
        self.assertNotIn("raw_body", migration)
        self.assertNotIn("inline_payload", migration)
        self.assertNotIn("payload jsonb", migration)
        self.assertNotIn("on delete set null", migration)
