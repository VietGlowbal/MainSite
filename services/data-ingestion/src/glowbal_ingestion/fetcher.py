from __future__ import annotations

import gzip
import hashlib
import io
import ssl
import threading
import time
from dataclasses import dataclass
from email.message import Message
from typing import Callable, Iterable, Iterator, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPSHandler, HTTPRedirectHandler, Request, build_opener

import certifi

from .config import CrawlLimits
from .models import FetchResult, utc_now_iso
from .url_safety import (
    UnsafeUrlError,
    resolve_with_timeout,
    validate_url,
)


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class FetchError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str,
        url: str,
        status: int | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.url = url
        self.status = status
        self.retryable = retryable


@dataclass
class _DomainRateState:
    lock: threading.Lock
    last_request_at: float = 0.0


class StreamFetchResult:
    """Metadata plus a one-shot, bounded HTTP response stream."""

    def __init__(
        self,
        *,
        requested_url: str,
        final_url: str,
        status: int,
        headers: dict[str, str],
        content_type: str | None,
        response: object,
        resolved_limit: int,
        retrieved_at: str,
        redirect_chain: list[str],
        release: Callable[[], None],
    ) -> None:
        self.requested_url = requested_url
        self.final_url = final_url
        self.status = status
        self.headers = headers
        self.content_type = content_type
        self.response = response
        self.resolved_limit = resolved_limit
        self.retrieved_at = retrieved_at
        self.redirect_chain = redirect_chain
        self._release = release
        self._closed = False

    def iter_bytes(self, *, chunk_size: int = 64 * 1024) -> Iterator[bytes]:
        """Yield decoded response bytes while enforcing the response limit."""
        total = 0
        first = True
        body = self.response
        reader: object = body
        compressed: gzip.GzipFile | None = None
        if self.headers.get("content-encoding", "").lower() == "gzip":
            compressed = gzip.GzipFile(fileobj=body)  # type: ignore[arg-type]
            reader = compressed
        try:
            while True:
                chunk = reader.read(min(max(1, int(chunk_size)), self.resolved_limit + 1 - total))  # type: ignore[attr-defined]
                if not chunk:
                    break
                total += len(chunk)
                if total > self.resolved_limit:
                    raise FetchError(
                        f"Response exceeds {self.resolved_limit} bytes.",
                        code="RESPONSE_TOO_LARGE",
                        url=self.final_url,
                    )
                if first:
                    lowered = bytes(chunk[:64 * 1024]).lower()
                    if (
                        b"incapsula incident id" in lowered
                        or (
                            b"_incapsula_resource" in lowered
                            and b"request unsuccessful" in lowered
                        )
                    ):
                        raise FetchError(
                            "The origin returned a bot-protection challenge page.",
                            code="BOT_CHALLENGE",
                            url=self.final_url,
                            status=self.status,
                            retryable=False,
                        )
                    first = False
                yield bytes(chunk)
        except OSError as exc:
            raise FetchError(
                f"Network timeout/error for {self.final_url}: {exc}",
                code="NETWORK_ERROR",
                url=self.final_url,
                retryable=True,
            ) from exc
        finally:
            if compressed is not None:
                compressed.close()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            close = getattr(self.response, "close", None)
            if callable(close):
                close()
        finally:
            self._release()

    def __enter__(self) -> "StreamFetchResult":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


class SafeFetcher:
    def __init__(self, limits: CrawlLimits) -> None:
        self.limits = limits
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        self._opener = build_opener(
            _NoRedirectHandler(),
            HTTPSHandler(context=ssl_context),
        )
        self._states_lock = threading.Lock()
        self._domain_states: dict[str, _DomainRateState] = {}

    def _domain_state(self, hostname: str) -> _DomainRateState:
        with self._states_lock:
            state = self._domain_states.get(hostname)
            if state is None:
                state = _DomainRateState(lock=threading.Lock())
                self._domain_states[hostname] = state
            return state

    def _throttle(self, hostname: str, *, min_interval_seconds: float | None = None) -> None:
        state = self._domain_state(hostname)
        state.lock.acquire()
        elapsed = time.monotonic() - state.last_request_at
        interval = (
            self.limits.min_request_interval_seconds
            if min_interval_seconds is None
            else max(0.0, float(min_interval_seconds))
        )
        remaining = interval - elapsed
        if remaining > 0:
            time.sleep(remaining)

    def _release_throttle(self, hostname: str) -> None:
        state = self._domain_state(hostname)
        state.last_request_at = time.monotonic()
        state.lock.release()

    @staticmethod
    def _header_dict(headers: Message) -> dict[str, str]:
        return {key.lower(): value for key, value in headers.items()}

    def fetch(
        self,
        url: str,
        *,
        allowed_domains: Iterable[str],
        max_bytes: int | None = None,
        accept: str = "text/html,application/xhtml+xml,application/xml,text/xml,application/json,application/pdf",
        conditional_headers: dict[str, str] | None = None,
        method: str = "GET",
        data: bytes | None = None,
        request_headers: dict[str, str] | None = None,
        rate_limit_policy: Mapping[str, object] | None = None,
    ) -> FetchResult:
        resolved_method = method.upper()
        if resolved_method not in {"GET", "POST"}:
            raise ValueError("SafeFetcher only supports GET and POST.")
        current_url = url
        redirect_chain: list[str] = []

        for _ in range(self.limits.max_redirects + 1):
            try:
                validated = validate_url(
                    current_url,
                    allowed_domains,
                    resolver=lambda hostname, port: resolve_with_timeout(
                        hostname,
                        port,
                        timeout_seconds=(
                            self.limits.connect_timeout_seconds
                        ),
                    ),
                )
            except UnsafeUrlError as exc:
                raise FetchError(
                    str(exc),
                    code="UNSAFE_URL",
                    url=current_url,
                    retryable=False,
                ) from exc

            headers = {
                "User-Agent": self.limits.user_agent,
                "Accept": accept,
                "Accept-Encoding": "gzip",
            }
            if conditional_headers:
                headers.update(conditional_headers)
            if request_headers:
                headers.update(request_headers)
            request = Request(
                validated.canonical_url,
                data=data,
                headers=headers,
                method=resolved_method,
            )

            provider_interval = None
            if isinstance(rate_limit_policy, Mapping):
                raw_interval = rate_limit_policy.get("min_interval_seconds")
                if raw_interval is None and rate_limit_policy.get("requests_per_second"):
                    try:
                        provider_interval = 1.0 / float(rate_limit_policy["requests_per_second"])
                    except (TypeError, ValueError, ZeroDivisionError):
                        provider_interval = None
                elif raw_interval is not None:
                    try:
                        provider_interval = float(raw_interval)
                    except (TypeError, ValueError):
                        provider_interval = None
            self._throttle(validated.hostname, min_interval_seconds=provider_interval)
            try:
                try:
                    response = self._opener.open(
                        request,
                        timeout=self.limits.request_timeout_seconds,
                    )
                except HTTPError as exc:
                    if exc.code in {301, 302, 303, 307, 308}:
                        location = exc.headers.get("Location")
                        if not location:
                            raise FetchError(
                                "Redirect response did not contain Location.",
                                code="INVALID_REDIRECT",
                                url=current_url,
                                status=exc.code,
                            ) from exc
                        redirect_chain.append(validated.canonical_url)
                        current_url = urljoin(validated.canonical_url, location)
                        continue
                    retryable = exc.code in {408, 425, 429, 500, 502, 503, 504}
                    raise FetchError(
                        f"HTTP {exc.code} for {validated.canonical_url}",
                        code=f"HTTP_{exc.code}",
                        url=validated.canonical_url,
                        status=exc.code,
                        retryable=retryable,
                    ) from exc
                except URLError as exc:
                    raise FetchError(
                        f"Network error for {validated.canonical_url}: {exc.reason}",
                        code="NETWORK_ERROR",
                        url=validated.canonical_url,
                        retryable=True,
                    ) from exc

                with response:
                    response_headers = self._header_dict(response.headers)
                    content_type = response_headers.get("content-type", "").split(
                        ";", 1
                    )[0].strip() or None
                    resolved_limit = max_bytes
                    if resolved_limit is None:
                        resolved_limit = (
                            self.limits.max_pdf_bytes
                            if content_type == "application/pdf"
                            else self.limits.max_html_bytes
                        )
                    content_length = response_headers.get("content-length")
                    if content_length and int(content_length) > resolved_limit:
                        raise FetchError(
                            f"Response exceeds {resolved_limit} bytes.",
                            code="RESPONSE_TOO_LARGE",
                            url=validated.canonical_url,
                        )
                    large_threshold = int(
                        getattr(
                            self.limits,
                            "large_raw_object_threshold_bytes",
                            resolved_limit + 1,
                        )
                    )
                    if content_length:
                        try:
                            content_is_large = int(content_length) > large_threshold
                        except ValueError:
                            content_is_large = False
                        if content_is_large:
                            raise FetchError(
                                "Response requires durable streaming persistence.",
                                code="RESPONSE_REQUIRES_STREAMING",
                                url=validated.canonical_url,
                            )

                    chunks: list[bytes] = []
                    total = 0
                    while True:
                        chunk = response.read(min(64 * 1024, resolved_limit + 1 - total))
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > resolved_limit:
                            raise FetchError(
                                f"Response exceeds {resolved_limit} bytes.",
                                code="RESPONSE_TOO_LARGE",
                                url=validated.canonical_url,
                            )
                        if total > large_threshold:
                            raise FetchError(
                                "Response requires durable streaming persistence.",
                                code="RESPONSE_REQUIRES_STREAMING",
                                url=validated.canonical_url,
                            )
                        chunks.append(chunk)
                    body = b"".join(chunks)
                    if response_headers.get("content-encoding", "").lower() == "gzip":
                        try:
                            with gzip.GzipFile(fileobj=io.BytesIO(body)) as compressed:
                                body = compressed.read(resolved_limit + 1)
                        except OSError as exc:
                            raise FetchError(
                                "Invalid gzip response.",
                                code="INVALID_ENCODING",
                                url=validated.canonical_url,
                            ) from exc
                    if len(body) > resolved_limit:
                        raise FetchError(
                            f"Decoded response exceeds {resolved_limit} bytes.",
                            code="RESPONSE_TOO_LARGE",
                            url=validated.canonical_url,
                        )
                    lowered_body = body[:64 * 1024].lower()
                    if (
                        b"incapsula incident id" in lowered_body
                        or (
                            b"_incapsula_resource" in lowered_body
                            and b"request unsuccessful" in lowered_body
                        )
                    ):
                        raise FetchError(
                            "The origin returned a bot-protection challenge page.",
                            code="BOT_CHALLENGE",
                            url=validated.canonical_url,
                            status=getattr(response, "status", 200),
                            retryable=False,
                        )
                    return FetchResult(
                        requested_url=url,
                        final_url=validated.canonical_url,
                        status=getattr(response, "status", 200),
                        headers=response_headers,
                        content_type=content_type,
                        body=body,
                        content_hash=hashlib.sha256(body).hexdigest(),
                        retrieved_at=utc_now_iso(),
                        redirect_chain=redirect_chain,
                    )
            except (TimeoutError, OSError) as exc:
                raise FetchError(
                    f"Network timeout/error for {validated.canonical_url}: {exc}",
                    code="NETWORK_ERROR",
                    url=validated.canonical_url,
                    retryable=True,
                ) from exc
            finally:
                self._release_throttle(validated.hostname)

        raise FetchError(
            f"Redirect limit exceeded for {url}",
            code="TOO_MANY_REDIRECTS",
            url=url,
        )

    def fetch_stream(
        self,
        url: str,
        *,
        allowed_domains: Iterable[str],
        max_bytes: int | None = None,
        accept: str = "text/html,application/xhtml+xml,application/xml,text/xml,application/json,application/pdf,application/zip,text/csv",
        conditional_headers: dict[str, str] | None = None,
        method: str = "GET",
        data: bytes | None = None,
        request_headers: dict[str, str] | None = None,
        rate_limit_policy: Mapping[str, object] | None = None,
    ) -> StreamFetchResult:
        """Open a bounded HTTP response without materialising its body."""
        resolved_method = method.upper()
        if resolved_method not in {"GET", "POST"}:
            raise ValueError("SafeFetcher only supports GET and POST.")
        current_url = url
        redirect_chain: list[str] = []
        for _ in range(self.limits.max_redirects + 1):
            try:
                validated = validate_url(
                    current_url,
                    allowed_domains,
                    resolver=lambda hostname, port: resolve_with_timeout(
                        hostname,
                        port,
                        timeout_seconds=self.limits.connect_timeout_seconds,
                    ),
                )
            except UnsafeUrlError as exc:
                raise FetchError(
                    str(exc), code="UNSAFE_URL", url=current_url, retryable=False
                ) from exc
            headers = {
                "User-Agent": self.limits.user_agent,
                "Accept": accept,
                "Accept-Encoding": "gzip",
            }
            if conditional_headers:
                headers.update(conditional_headers)
            if request_headers:
                headers.update(request_headers)
            request = Request(
                validated.canonical_url,
                data=data,
                headers=headers,
                method=resolved_method,
            )
            provider_interval = None
            if isinstance(rate_limit_policy, Mapping):
                raw_interval = rate_limit_policy.get("min_interval_seconds")
                if raw_interval is None and rate_limit_policy.get("requests_per_second"):
                    try:
                        provider_interval = 1.0 / float(rate_limit_policy["requests_per_second"])
                    except (TypeError, ValueError, ZeroDivisionError):
                        provider_interval = None
                elif raw_interval is not None:
                    try:
                        provider_interval = float(raw_interval)
                    except (TypeError, ValueError):
                        provider_interval = None
            self._throttle(validated.hostname, min_interval_seconds=provider_interval)
            released = False

            def release() -> None:
                nonlocal released
                if not released:
                    released = True
                    self._release_throttle(validated.hostname)

            try:
                try:
                    response = self._opener.open(
                        request,
                        timeout=self.limits.request_timeout_seconds,
                    )
                except HTTPError as exc:
                    if exc.code in {301, 302, 303, 307, 308}:
                        location = exc.headers.get("Location")
                        exc.close()
                        release()
                        if not location:
                            raise FetchError(
                                "Redirect response did not contain Location.",
                                code="INVALID_REDIRECT",
                                url=current_url,
                                status=exc.code,
                            ) from exc
                        redirect_chain.append(validated.canonical_url)
                        current_url = urljoin(validated.canonical_url, location)
                        continue
                    retryable = exc.code in {408, 425, 429, 500, 502, 503, 504}
                    release()
                    raise FetchError(
                        f"HTTP {exc.code} for {validated.canonical_url}",
                        code=f"HTTP_{exc.code}",
                        url=validated.canonical_url,
                        status=exc.code,
                        retryable=retryable,
                    ) from exc
                except URLError as exc:
                    release()
                    raise FetchError(
                        f"Network error for {validated.canonical_url}: {exc.reason}",
                        code="NETWORK_ERROR",
                        url=validated.canonical_url,
                        retryable=True,
                    ) from exc
                response_headers = self._header_dict(response.headers)
                content_type = response_headers.get("content-type", "").split(";", 1)[0].strip() or None
                resolved_limit = max_bytes
                if resolved_limit is None:
                    resolved_limit = self.limits.max_pdf_bytes if content_type == "application/pdf" else self.limits.max_html_bytes
                content_length = response_headers.get("content-length")
                if content_length:
                    try:
                        too_large = int(content_length) > resolved_limit
                    except ValueError:
                        too_large = False
                    if too_large:
                        response.close()
                        release()
                        raise FetchError(
                            f"Response exceeds {resolved_limit} bytes.",
                            code="RESPONSE_TOO_LARGE",
                            url=validated.canonical_url,
                        )
                return StreamFetchResult(
                    requested_url=url,
                    final_url=validated.canonical_url,
                    status=getattr(response, "status", 200),
                    headers=response_headers,
                    content_type=content_type,
                    response=response,
                    resolved_limit=int(resolved_limit),
                    retrieved_at=utc_now_iso(),
                    redirect_chain=redirect_chain,
                    release=release,
                )
            except FetchError:
                raise
            except (TimeoutError, OSError) as exc:
                release()
                raise FetchError(
                    f"Network timeout/error for {validated.canonical_url}: {exc}",
                    code="NETWORK_ERROR",
                    url=validated.canonical_url,
                    retryable=True,
                ) from exc
        raise FetchError(
            f"Redirect limit exceeded for {url}",
            code="TOO_MANY_REDIRECTS",
            url=url,
        )
