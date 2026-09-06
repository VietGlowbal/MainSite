from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from glowbal_ingestion.mongo_raw_evidence import MongoRawEvidenceStore
from glowbal_ingestion.object_store import ObjectStoreError, content_addressed_key
from glowbal_ingestion.raw_evidence import create_remote_raw_evidence_store, content_hash
from glowbal_ingestion.supabase_storage import (
    StorageHttpResponse,
    SupabaseStorageConfig,
    SupabaseStorageObjectStore,
    UrllibStorageHttpTransport,
)


class _StorageTransport:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.calls: list[tuple[str, str, dict[str, str]]] = []
        self.conflict_after_upload = False
        self.missing_is_http_400 = False

    def request(self, method, url, *, headers, body=None, timeout_seconds):
        self.calls.append((method, url, dict(headers)))
        key = url.split("/raw/sha256/", 1)[-1]
        key = "raw/sha256/" + key if key != url else ""
        if method == "GET" and "/object/" in url:
            if key not in self.objects:
                return StorageHttpResponse(
                    status=400 if self.missing_is_http_400 else 404,
                    headers={},
                    error_kind=("not_found" if self.missing_is_http_400 else None),
                )
            return StorageHttpResponse(status=200, headers={}, body=self.objects[key])
        if method == "POST" and "/object/" in url:
            if key in self.objects:
                return StorageHttpResponse(status=400, headers={})
            if self.conflict_after_upload:
                self.objects[key] = bytes(body or b"")
                return StorageHttpResponse(status=400, headers={})
            self.objects[key] = bytes(body or b"")
            return StorageHttpResponse(status=201, headers={})
        return StorageHttpResponse(status=500, headers={})


class _UnavailableTransport:
    def request(self, *args, **kwargs):
        raise TimeoutError("unavailable")


class _BadRequestTransport:
    def request(self, *args, **kwargs):
        return StorageHttpResponse(status=400, headers={})


class SupabaseStorageObjectStoreTests(unittest.TestCase):
    def _store(self, transport):
        return SupabaseStorageObjectStore(
            SupabaseStorageConfig(
                base_url="https://project.supabase.co",
                service_role_key="test-service-role",
                bucket="raw-evidence",
            ),
            transport=transport,
        )

    def test_upload_download_and_duplicate_are_immutable_and_verified(self) -> None:
        transport = _StorageTransport()
        store = self._store(transport)
        payload = b"supabase evidence payload"
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
        upload_headers = next(
            headers
            for method, _url, headers in transport.calls
            if method == "POST"
        )
        self.assertEqual(upload_headers["x-upsert"], "false")
        self.assertEqual(transport.calls[0][0], "POST")
        self.assertFalse(
            any("/object/info/" in url for _method, url, _headers in transport.calls)
        )
        self.assertEqual(len(transport.objects), 1)

    def test_upload_conflict_verifies_concurrent_immutable_write(self) -> None:
        transport = _StorageTransport()
        transport.conflict_after_upload = True
        store = self._store(transport)
        payload = b"concurrent evidence"
        reference = store.put_immutable(
            payload,
            content_hash=content_hash(payload),
            content_type="text/html",
        )
        self.assertEqual(store.get(reference), payload)

    def test_missing_corrupt_and_unavailable_storage_are_explicit(self) -> None:
        transport = _StorageTransport()
        store = self._store(transport)
        payload = b"expected"
        digest = content_hash(payload)
        reference = store._reference(
            content_hash=digest,
            content_length=len(payload),
            content_type="text/plain",
        )
        self.assertFalse(store.exists(reference))
        with self.assertRaises(ObjectStoreError) as missing:
            store.get(reference)
        self.assertFalse(missing.exception.retryable)

        transport.missing_is_http_400 = True
        self.assertFalse(store.exists(reference))
        with self.assertRaises(ObjectStoreError) as missing_400:
            store.get(reference)
        self.assertFalse(missing_400.exception.retryable)
        with self.assertRaises(ObjectStoreError) as arbitrary_400:
            self._store(_BadRequestTransport()).exists(reference)
        self.assertFalse(arbitrary_400.exception.retryable)
        transport.missing_is_http_400 = False

        transport.objects[reference.key] = b"corrupt"
        with self.assertRaises(ObjectStoreError) as corrupt:
            store.get(reference)
        self.assertFalse(corrupt.exception.retryable)

        transport.objects[reference.key] = payload
        store.put_immutable(
            payload, content_hash=digest, content_type="text/plain"
        )
        transport.objects[reference.key] = b"corrupt"
        with self.assertRaises(ObjectStoreError) as duplicate_corrupt:
            store.put_immutable(
                payload, content_hash=digest, content_type="text/plain"
            )
        self.assertFalse(duplicate_corrupt.exception.retryable)

        unavailable = self._store(_UnavailableTransport())
        with self.assertRaises(ObjectStoreError) as failed:
            unavailable.exists(reference)
        self.assertTrue(failed.exception.retryable)
        self.assertNotIn("project.supabase.co", str(failed.exception))

        with self.assertRaises(ValueError):
            SupabaseStorageConfig(
                base_url="http://invalid.example",
                service_role_key="test-service-role",
                bucket="raw-evidence",
            )

    def test_transport_classifies_only_generic_not_found_markers(self) -> None:
        self.assertEqual(
            UrllibStorageHttpTransport._error_kind(b'{"error":"not_found"}'),
            "not_found",
        )
        self.assertEqual(
            UrllibStorageHttpTransport._error_kind(b'{"message":"Bucket not found"}'),
            "not_found",
        )
        self.assertIsNone(
            UrllibStorageHttpTransport._error_kind(b'{"error":"invalid_request"}')
        )

    def test_factory_selects_supabase_storage_without_s3_credentials(self) -> None:
        with patch.dict(
            os.environ,
            {
                "MONGODB_URI": "mongodb://test.invalid",
                "MONGODB_DATABASE": "raw_test",
                "RAW_OBJECT_STORE_BUCKET": "",
                "SUPABASE_URL": "https://project.supabase.co",
                "NEXT_PUBLIC_SUPABASE_URL": "",
                "SUPABASE_SERVICE_ROLE_KEY": "test-service-role",
                "RAW_OBJECT_STORAGE_BUCKET": "raw-evidence",
            },
            clear=False,
        ):
            store = create_remote_raw_evidence_store(inline_payload_max_bytes=1024)
        self.assertIsInstance(store, MongoRawEvidenceStore)
        self.assertIsInstance(store.object_store, SupabaseStorageObjectStore)
