from __future__ import annotations

import gzip
import hashlib
import io
import ssl
import threading
import time
from dataclasses import dataclass
from email.message import Message
from typing import Iterable
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

    def _throttle(self, hostname: str) -> None:
        state = self._domain_state(hostname)
        state.lock.acquire()
        elapsed = time.monotonic() - state.last_request_at
        remaining = self.limits.min_request_interval_seconds - elapsed
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

            self._throttle(validated.hostname)
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
