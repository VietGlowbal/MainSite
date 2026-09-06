"""S3-compatible object storage boundary for large immutable raw payloads."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Callable, Protocol, runtime_checkable


class ObjectStoreError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class ObjectReference:
    key: str
    content_hash: str
    content_length: int
    content_type: str | None


@runtime_checkable
class ObjectStore(Protocol):
    def put_immutable(
        self,
        payload: bytes,
        *,
        content_hash: str,
        content_type: str | None,
    ) -> ObjectReference: ...

    def get(self, reference: ObjectReference) -> bytes: ...

    def exists(self, reference: ObjectReference) -> bool: ...


def content_addressed_key(content_hash: str) -> str:
    if len(content_hash) != 64 or any(
        character not in "0123456789abcdef" for character in content_hash.lower()
    ):
        raise ValueError("content_hash must be a SHA-256 hex digest.")
    return f"raw/sha256/{content_hash[:2]}/{content_hash}"


@dataclass(frozen=True)
class S3ObjectStoreConfig:
    endpoint: str | None
    bucket: str
    access_key_id: str | None = None
    secret_access_key: str | None = None
    region: str | None = None
    connect_timeout_seconds: float = 5.0
    read_timeout_seconds: float = 30.0


class S3ObjectStore:
    """Lazy S3-compatible client; no SDK connection occurs at import time."""

    def __init__(
        self,
        config: S3ObjectStoreConfig,
        *,
        client_factory: Callable[..., Any] | None = None,
    ) -> None:
        if not config.bucket:
            raise ValueError("Object storage bucket is required.")
        self.config = config
        self._client_factory = client_factory
        self._client: Any | None = None

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        if self._client_factory is not None:
            self._client = self._client_factory(self.config)
            return self._client
        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:
            raise ObjectStoreError(
                "S3 object storage requires the durable-evidence dependency extra.",
                retryable=False,
            ) from exc
        self._client = boto3.client(
            "s3",
            endpoint_url=self.config.endpoint,
            aws_access_key_id=self.config.access_key_id,
            aws_secret_access_key=self.config.secret_access_key,
            region_name=self.config.region,
            config=Config(
                connect_timeout=self.config.connect_timeout_seconds,
                read_timeout=self.config.read_timeout_seconds,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )
        return self._client

    @staticmethod
    def _verify(payload: bytes, expected_hash: str) -> None:
        actual = hashlib.sha256(payload).hexdigest()
        if actual != expected_hash:
            raise ObjectStoreError(
                "Object payload checksum mismatch.", retryable=False
            )

    def put_immutable(
        self,
        payload: bytes,
        *,
        content_hash: str,
        content_type: str | None,
    ) -> ObjectReference:
        self._verify(payload, content_hash)
        reference = ObjectReference(
            key=content_addressed_key(content_hash),
            content_hash=content_hash,
            content_length=len(payload),
            content_type=content_type,
        )
        client = self._get_client()
        try:
            try:
                head = client.head_object(Bucket=self.config.bucket, Key=reference.key)
            except Exception as exc:
                response = getattr(exc, "response", {}) or {}
                code = str((response.get("Error") or {}).get("Code") or "")
                if code not in {"404", "NoSuchKey", "NotFound"}:
                    raise
                head = None
            if head is not None:
                metadata = head.get("Metadata") or {}
                if (
                    int(head.get("ContentLength") or -1) != len(payload)
                    or metadata.get("content-sha256") != content_hash
                ):
                    raise ObjectStoreError(
                        "Existing content-addressed object failed integrity checks.",
                        retryable=False,
                    )
                return reference
            client.put_object(
                Bucket=self.config.bucket,
                Key=reference.key,
                Body=payload,
                ContentType=content_type or "application/octet-stream",
                Metadata={"content-sha256": content_hash},
            )
            return reference
        except ObjectStoreError:
            raise
        except Exception as exc:
            raise ObjectStoreError(
                "Object storage write failed.", retryable=True
            ) from exc

    def get(self, reference: ObjectReference) -> bytes:
        try:
            response = self._get_client().get_object(
                Bucket=self.config.bucket, Key=reference.key
            )
            payload = response["Body"].read()
        except Exception as exc:
            raise ObjectStoreError(
                "Object storage read failed.", retryable=True
            ) from exc
        self._verify(payload, reference.content_hash)
        return payload

    def exists(self, reference: ObjectReference) -> bool:
        try:
            self._get_client().head_object(
                Bucket=self.config.bucket, Key=reference.key
            )
            return True
        except Exception as exc:
            response = getattr(exc, "response", {}) or {}
            code = str((response.get("Error") or {}).get("Code") or "")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise ObjectStoreError(
                "Object storage availability check failed.", retryable=True
            ) from exc
