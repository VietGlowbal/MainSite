"""Supabase Storage adapter for immutable raw-evidence payloads.

The adapter implements the existing :mod:`object_store` contract using the
Storage REST API.  It deliberately has no dependency on a Supabase SDK and
does not expose credentials, URLs, or server response bodies in errors.
"""

from __future__ import annotations

import hashlib
import http.client
import json
from dataclasses import dataclass
from typing import BinaryIO, Iterable, Literal, Mapping, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from .object_store import (
    ObjectReference,
    ObjectStore,
    ObjectStoreError,
    content_addressed_key,
)


@dataclass(frozen=True)
class StorageHttpResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes = b""
    error_kind: Literal["not_found"] | None = None


class StorageHttpTransport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
        timeout_seconds: float,
    ) -> StorageHttpResponse: ...

    def request_stream(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        chunks: Iterable[bytes],
        timeout_seconds: float,
    ) -> StorageHttpResponse: ...

    def open_stream(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        timeout_seconds: float,
    ) -> BinaryIO: ...


class UrllibStorageHttpTransport:
    """Small injectable HTTP transport; network setup occurs per request."""

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
        timeout_seconds: float,
    ) -> StorageHttpResponse:
        request = Request(
            url,
            data=body,
            headers=dict(headers),
            method=method,
        )
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                return StorageHttpResponse(
                    status=int(response.status),
                    headers=dict(response.headers.items()),
                    body=response.read(),
                )
        except HTTPError as exc:
            # HTTP status and a narrowly classified generic marker are safe to
            # retain for retry/missing semantics. The body is consumed only to
            # classify it and is never returned, logged, or surfaced.
            error_kind = self._error_kind(exc.read())
            return StorageHttpResponse(
                status=int(exc.code),
                headers=dict((exc.headers or {}).items()),
                body=b"",
                error_kind=error_kind,
            )
        except (URLError, TimeoutError, OSError) as exc:
            raise ObjectStoreError(
                "Supabase Storage is unavailable.", retryable=True
            ) from exc

    def request_stream(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        chunks: Iterable[bytes],
        timeout_seconds: float,
    ) -> StorageHttpResponse:
        """Send a chunked request without buffering the request body."""
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ObjectStoreError("Invalid Storage URL.", retryable=False)
        connection_type = (
            http.client.HTTPSConnection
            if parsed.scheme == "https"
            else http.client.HTTPConnection
        )
        connection = connection_type(parsed.hostname, parsed.port, timeout=timeout_seconds)
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        request_headers = {str(key): str(value) for key, value in headers.items()}
        request_headers.pop("Content-Length", None)
        request_headers["Transfer-Encoding"] = "chunked"
        try:
            connection.putrequest(method, path)
            for key, value in request_headers.items():
                connection.putheader(key, value)
            connection.endheaders()
            for chunk in chunks:
                if not isinstance(chunk, (bytes, bytearray, memoryview)):
                    raise ObjectStoreError(
                        "Storage stream yielded a non-bytes chunk.", retryable=False
                    )
                data = bytes(chunk)
                if not data:
                    continue
                connection.send(f"{len(data):x}\r\n".encode("ascii"))
                connection.send(data)
                connection.send(b"\r\n")
            connection.send(b"0\r\n\r\n")
            response = connection.getresponse()
            body = response.read(1024 * 1024 + 1)
            if len(body) > 1024 * 1024:
                body = body[: 1024 * 1024]
            return StorageHttpResponse(
                status=int(response.status),
                headers={key.lower(): value for key, value in response.getheaders()},
                body=body,
            )
        except ObjectStoreError:
            raise
        except (OSError, TimeoutError) as exc:
            raise ObjectStoreError(
                "Supabase Storage streaming request failed.", retryable=True
            ) from exc
        finally:
            connection.close()

    def open_stream(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        timeout_seconds: float,
    ) -> BinaryIO:
        request = Request(url, headers=dict(headers), method=method)
        try:
            response = urlopen(request, timeout=timeout_seconds)
        except HTTPError as exc:
            exc.close()
            raise ObjectStoreError(
                "Supabase Storage streaming read failed.",
                retryable=self._retryable_status(exc.code),
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise ObjectStoreError(
                "Supabase Storage streaming read failed.", retryable=True
            ) from exc
        if not 200 <= int(getattr(response, "status", 200)) < 300:
            response.close()
            raise ObjectStoreError(
                "Supabase Storage streaming read failed.", retryable=False
            )
        return response

    @staticmethod
    def _retryable_status(status: int) -> bool:
        return status == 408 or status == 429 or status >= 500

    @staticmethod
    def _error_kind(body: bytes) -> Literal["not_found"] | None:
        """Classify only a generic missing-resource marker; discard all text."""
        try:
            decoded = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not isinstance(decoded, dict):
            return None
        markers = (
            decoded.get("error"),
            decoded.get("code"),
            decoded.get("message"),
        )
        if any(
            isinstance(marker, str)
            and marker.strip().casefold()
            in {"not_found", "not found", "bucket not found"}
            for marker in markers
        ):
            return "not_found"
        return None


@dataclass(frozen=True)
class SupabaseStorageConfig:
    base_url: str
    service_role_key: str
    bucket: str
    timeout_seconds: float = 30.0

    def __post_init__(self) -> None:
        parsed = urlsplit(self.base_url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("Supabase Storage requires an HTTPS base URL.")
        if not self.service_role_key:
            raise ValueError("Supabase Storage requires a service-role key.")
        if not self.bucket:
            raise ValueError("Supabase Storage requires a bucket.")
        if self.timeout_seconds <= 0:
            raise ValueError("Supabase Storage timeout must be positive.")


class _SupabaseStorageObjectNotFound(ObjectStoreError):
    """Private typed signal used by ``exists`` without message parsing."""


class SupabaseStorageObjectStore(ObjectStore):
    """Immutable content-addressed storage through Supabase Storage REST."""

    backend_name = "legacy_supabase_storage"

    def __init__(
        self,
        config: SupabaseStorageConfig,
        *,
        transport: StorageHttpTransport | None = None,
    ) -> None:
        self.config = config
        self._transport = transport or UrllibStorageHttpTransport()

    @property
    def _base_url(self) -> str:
        return self.config.base_url.rstrip("/") + "/storage/v1"

    def _path(self, prefix: str, key: str) -> str:
        return (
            f"{self._base_url}/{prefix}/"
            f"{quote(self.config.bucket, safe='')}/{quote(key, safe='/')}"
        )

    def _headers(self, *, content_type: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.config.service_role_key,
            "Authorization": f"Bearer {self.config.service_role_key}",
            "Accept": "application/json",
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
    ) -> StorageHttpResponse:
        try:
            return self._transport.request(
                method,
                url,
                headers=headers,
                body=body,
                timeout_seconds=self.config.timeout_seconds,
            )
        except ObjectStoreError:
            raise
        except Exception as exc:
            raise ObjectStoreError(
                "Supabase Storage request failed.", retryable=True
            ) from exc

    @staticmethod
    def _retryable(status: int) -> bool:
        return status == 408 or status == 429 or status >= 500

    @staticmethod
    def _verify(payload: bytes, expected_hash: str) -> None:
        if hashlib.sha256(payload).hexdigest() != expected_hash:
            raise ObjectStoreError(
                "Object payload checksum mismatch.", retryable=False
            )

    def _reference(
        self,
        *,
        content_hash: str,
        content_length: int,
        content_type: str | None,
    ) -> ObjectReference:
        return ObjectReference(
            key=content_addressed_key(content_hash),
            content_hash=content_hash,
            content_length=content_length,
            content_type=content_type,
        )

    def put_immutable(
        self,
        payload: bytes,
        *,
        content_hash: str,
        content_type: str | None,
    ) -> ObjectReference:
        self._verify(payload, content_hash)
        reference = self._reference(
            content_hash=content_hash,
            content_length=len(payload),
            content_type=content_type,
        )
        headers = self._headers(
            content_type=content_type or "application/octet-stream"
        )
        # Supabase Storage honours x-upsert=false; a concurrent immutable
        # create is verified below instead of overwritten.
        headers["x-upsert"] = "false"
        response = self._request(
            "POST",
            self._path("object", reference.key),
            headers=headers,
            body=payload,
        )
        if 200 <= response.status < 300:
            return reference
        # Supabase Storage documents duplicate create as 400; some gateways
        # surface the same no-upsert race as 409. Do not preflight metadata:
        # deployed Storage runtimes may not expose that endpoint. A duplicate
        # is accepted only after GET verifies the retained payload exactly.
        if response.status in {400, 409}:
            try:
                self.get(reference)
            except _SupabaseStorageObjectNotFound:
                pass
            else:
                return reference
        raise ObjectStoreError(
            "Supabase Storage immutable upload failed.",
            retryable=self._retryable(response.status),
        )

    def put_stream(
        self,
        chunks: Iterable[bytes],
        *,
        content_type: str | None,
        object_key: str | None = None,
        metadata: Mapping[str, str] | None = None,
        max_bytes: int | None = None,
    ) -> ObjectReference:
        """Upload an immutable object using chunked transfer encoding."""
        from .object_store import stream_digest

        wrapped, digest = stream_digest(chunks, max_bytes=max_bytes)
        key = object_key or f"raw/stream/{__import__('uuid').uuid4()}"
        headers = self._headers(
            content_type=content_type or "application/octet-stream"
        )
        headers["x-upsert"] = "false"
        for name, value in (metadata or {}).items():
            # Storage preserves custom metadata headers.  Keep the names
            # namespaced so provider/run metadata cannot collide with HTTP
            # controls.
            headers[f"x-metadata-{str(name).lower()}"] = str(value)
        request_stream = getattr(self._transport, "request_stream", None)
        if not callable(request_stream):
            raise ObjectStoreError(
                "Supabase transport lacks streaming upload support.",
                retryable=False,
            )
        try:
            response = request_stream(
                "POST",
                self._path("object", key),
                headers=headers,
                chunks=wrapped,
                timeout_seconds=self.config.timeout_seconds,
            )
        except ObjectStoreError:
            close = getattr(wrapped, "close", None)
            if callable(close):
                close()
            raise
        except Exception as exc:
            close = getattr(wrapped, "close", None)
            if callable(close):
                close()
            raise ObjectStoreError(
                "Supabase Storage streaming upload failed.", retryable=True
            ) from exc
        try:
            if not 200 <= response.status < 300:
                raise ObjectStoreError(
                    "Supabase Storage streaming upload failed.",
                    retryable=self._retryable(response.status),
                )
            digest_value, content_length = digest()
            return ObjectReference(
                key=key,
                content_hash=digest_value,
                content_length=content_length,
                content_type=content_type,
            )
        finally:
            close = getattr(wrapped, "close", None)
            if callable(close):
                close()

    def open_stream(self, reference: ObjectReference) -> BinaryIO:
        """Return a bounded response stream for callers that need it.

        The REST transport currently exposes a bounded response body.  ZIP
        parsing uses ``read_range`` below so it never requests the full object
        into memory.
        """
        opener = getattr(self._transport, "open_stream", None)
        if not callable(opener):
            raise ObjectStoreError(
                "Supabase transport lacks streaming read support.",
                retryable=False,
            )
        return opener(
            "GET",
            self._path("object", reference.key),
            headers=self._headers(),
            timeout_seconds=self.config.timeout_seconds,
        )

    def read_range(
        self,
        reference: ObjectReference,
        start: int,
        end: int,
    ) -> bytes:
        if start < 0 or end <= start or end > reference.content_length:
            raise ValueError("Invalid object-store range.")
        response = self._request(
            "GET",
            self._path("object", reference.key),
            headers={**self._headers(), "Range": f"bytes={start}-{end - 1}"},
        )
        if response.status == 404 or response.error_kind == "not_found":
            raise _SupabaseStorageObjectNotFound(
                "Object does not exist.", retryable=False
            )
        if not 200 <= response.status < 300:
            raise ObjectStoreError(
                "Supabase Storage range read failed.",
                retryable=self._retryable(response.status),
            )
        return bytes(response.body)

    def get(self, reference: ObjectReference) -> bytes:
        response = self._request(
            "GET",
            self._path("object", reference.key),
            headers=self._headers(),
        )
        if response.status == 404 or response.error_kind == "not_found":
            raise _SupabaseStorageObjectNotFound(
                "Object does not exist.", retryable=False
            )
        if not 200 <= response.status < 300:
            raise ObjectStoreError(
                "Supabase Storage download failed.",
                retryable=self._retryable(response.status),
            )
        self._verify(response.body, reference.content_hash)
        if len(response.body) != reference.content_length:
            raise ObjectStoreError(
                "Object payload length mismatch.", retryable=False
            )
        return response.body

    def exists(self, reference: ObjectReference) -> bool:
        try:
            self.get(reference)
        except _SupabaseStorageObjectNotFound:
            return False
        return True
