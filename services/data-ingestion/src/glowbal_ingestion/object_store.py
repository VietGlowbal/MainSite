"""S3-compatible object storage boundary for large immutable raw payloads."""

from __future__ import annotations

import hashlib
import io
import time
import uuid
from dataclasses import dataclass
from typing import Any, BinaryIO, Callable, Iterable, Mapping, Protocol, runtime_checkable


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

    def put_stream(
        self,
        chunks: Iterable[bytes],
        *,
        content_type: str | None,
        object_key: str | None = None,
        metadata: Mapping[str, str] | None = None,
        max_bytes: int | None = None,
    ) -> ObjectReference: ...

    def open_stream(self, reference: ObjectReference) -> BinaryIO: ...

    def read_range(
        self,
        reference: ObjectReference,
        start: int,
        end: int,
    ) -> bytes: ...


def content_addressed_key(content_hash: str) -> str:
    if len(content_hash) != 64 or any(
        character not in "0123456789abcdef" for character in content_hash.lower()
    ):
        raise ValueError("content_hash must be a SHA-256 hex digest.")
    return f"raw/sha256/{content_hash[:2]}/{content_hash}"


def stream_digest(
    chunks: Iterable[bytes],
    *,
    max_bytes: int | None = None,
) -> tuple[Iterable[bytes], Callable[[], tuple[str, int]]]:
    """Wrap chunks with incremental SHA-256/length accounting.

    The returned iterator is single-use.  The digest callback is valid after
    the consumer has exhausted the iterator (or after it raises).
    """

    digest = hashlib.sha256()
    total = 0
    limit = int(max_bytes) if max_bytes is not None else None

    def _iter() -> Iterable[bytes]:
        nonlocal total
        for chunk in chunks:
            if not isinstance(chunk, (bytes, bytearray, memoryview)):
                raise ObjectStoreError(
                    "Object stream yielded a non-bytes chunk.", retryable=False
                )
            data = bytes(chunk)
            if not data:
                continue
            total += len(data)
            if limit is not None and total > limit:
                raise ObjectStoreError(
                    "Object stream exceeds the configured byte limit.",
                    retryable=False,
                )
            digest.update(data)
            yield data

    return _iter(), lambda: (digest.hexdigest(), total)


class RangeSeekableReader(io.RawIOBase):
    """Seekable, bounded reader backed by object-store range requests."""

    def __init__(
        self,
        store: ObjectStore,
        reference: ObjectReference,
        *,
        chunk_size: int = 1024 * 1024,
        max_retries: int = 2,
        retry_backoff_seconds: float = 0.05,
    ) -> None:
        self.store = store
        self.reference = reference
        self.chunk_size = max(1, int(chunk_size))
        self.max_retries = max(0, int(max_retries))
        self.retry_backoff_seconds = max(0.0, float(retry_backoff_seconds))
        self._position = 0
        self._pending = b""
        self._closed = False

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self._position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self._position + offset
        elif whence == io.SEEK_END:
            position = self.reference.content_length + offset
        else:
            raise ValueError("Unsupported seek mode.")
        if position < 0:
            raise ValueError("Negative seek position.")
        # ``zipfile`` seeks to the shared file's current position before most
        # reads.  That is a no-op and must retain the bounded read-ahead
        # buffer; otherwise every small read discards a prefetched chunk and
        # turns one archive scan into thousands of remote range requests.
        # Any actual repositioning invalidates the pending bytes so stale data
        # can never cross a central-directory/member jump.
        position = min(position, self.reference.content_length)
        if position != self._position:
            self._pending = b""
        self._position = position
        return self._position

    def read(self, size: int = -1) -> bytes:
        if self._closed or self._position >= self.reference.content_length:
            return b""
        if size is None or size < 0:
            size = self.chunk_size
        size = min(int(size), self.reference.content_length - self._position)
        if size <= 0:
            return b""
        requested = size
        pieces: list[bytes] = []
        while requested > 0:
            if not self._pending:
                start = self._position
                end = start + min(
                    self.chunk_size,
                    self.reference.content_length - start,
                )
                data: bytes | None = None
                for attempt in range(self.max_retries + 1):
                    try:
                        data = self.store.read_range(self.reference, start, end)
                        break
                    except ObjectStoreError as exc:
                        if not exc.retryable or attempt >= self.max_retries:
                            raise
                        if self.retry_backoff_seconds:
                            time.sleep(self.retry_backoff_seconds * (attempt + 1))
                if data is None:
                    break
                if not data:
                    break
                self._pending = bytes(data[: end - start])
            take = min(requested, len(self._pending))
            pieces.append(self._pending[:take])
            self._pending = self._pending[take:]
            self._position += take
            requested -= take
        return b"".join(pieces)

    def readinto(self, buffer: Any) -> int:
        data = self.read(len(buffer))
        buffer[: len(data)] = data
        return len(data)

    def close(self) -> None:
        self._closed = True
        super().close()


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

    backend_name = "legacy_s3"

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

    def open_stream(self, reference: ObjectReference) -> BinaryIO:
        try:
            response = self._get_client().get_object(
                Bucket=self.config.bucket, Key=reference.key
            )
            body = response["Body"]
            if not hasattr(body, "read"):
                raise ObjectStoreError(
                    "Object storage returned a non-streaming body.",
                    retryable=False,
                )
            return body
        except ObjectStoreError:
            raise
        except Exception as exc:
            raise ObjectStoreError(
                "Object storage streaming read failed.", retryable=True
            ) from exc

    def read_range(
        self,
        reference: ObjectReference,
        start: int,
        end: int,
    ) -> bytes:
        if start < 0 or end <= start or end > reference.content_length:
            raise ValueError("Invalid object-store range.")
        try:
            response = self._get_client().get_object(
                Bucket=self.config.bucket,
                Key=reference.key,
                Range=f"bytes={start}-{end - 1}",
            )
            return bytes(response["Body"].read())
        except Exception as exc:
            raise ObjectStoreError(
                "Object storage range read failed.", retryable=True
            ) from exc

    def put_stream(
        self,
        chunks: Iterable[bytes],
        *,
        content_type: str | None,
        object_key: str | None = None,
        metadata: Mapping[str, str] | None = None,
        max_bytes: int | None = None,
    ) -> ObjectReference:
        wrapped, digest = stream_digest(chunks, max_bytes=max_bytes)
        key = object_key or f"raw/stream/{uuid.uuid4()}"
        reader = _IterableReader(wrapped)
        client = self._get_client()
        try:
            if hasattr(client, "upload_fileobj"):
                extra: dict[str, Any] = {
                    "ContentType": content_type or "application/octet-stream",
                    "Metadata": {
                        **{str(k): str(v) for k, v in (metadata or {}).items()},
                    },
                }
                client.upload_fileobj(reader, self.config.bucket, key, ExtraArgs=extra)
            else:
                raise ObjectStoreError(
                    "S3 client lacks streaming upload support.", retryable=False
                )
            content_hash, content_length = digest()
            return ObjectReference(
                key=key,
                content_hash=content_hash,
                content_length=content_length,
                content_type=content_type,
            )
        except ObjectStoreError:
            raise
        except Exception as exc:
            raise ObjectStoreError(
                "Object storage streaming write failed.", retryable=True
            ) from exc
        finally:
            close = getattr(wrapped, "close", None)
            if callable(close):
                close()

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


class _IterableReader:
    """File-like adapter used by SDKs that support multipart upload_fileobj."""

    def __init__(self, chunks: Iterable[bytes]) -> None:
        self._iterator = iter(chunks)
        self._buffer = b""
        self._done = False

    def read(self, size: int = -1) -> bytes:
        if self._done:
            return b""
        if size is None or size < 0:
            # SDK uploaders occasionally call ``read(-1)``.  Returning one
            # bounded chunk preserves streaming instead of materialising the
            # complete iterator in memory.
            size = 64 * 1024
        target = max(1, int(size))
        while len(self._buffer) < target:
            try:
                self._buffer += bytes(next(self._iterator))
            except StopIteration:
                self._done = True
                break
        data, self._buffer = self._buffer[:target], self._buffer[target:]
        return data
