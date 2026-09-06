"""Supabase Storage adapter for immutable raw-evidence payloads.

The adapter implements the existing :mod:`object_store` contract using the
Storage REST API.  It deliberately has no dependency on a Supabase SDK and
does not expose credentials, URLs, or server response bodies in errors.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Literal, Mapping, Protocol
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
