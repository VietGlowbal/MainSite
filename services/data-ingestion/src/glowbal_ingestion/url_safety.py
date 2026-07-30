from __future__ import annotations

import ipaddress
import posixpath
import socket
import threading
from dataclasses import dataclass
from typing import Callable, Iterable
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit


TRACKING_QUERY_KEYS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "source",
}
NON_PRODUCTION_HOST_LABELS = frozenset(
    {
        "dev",
        "development",
        "preview",
        "qa",
        "sandbox",
        "stage",
        "staging",
        "test",
        "uat",
    }
)


class UnsafeUrlError(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedUrl:
    original_url: str
    canonical_url: str
    hostname: str
    resolved_ips: tuple[str, ...]


def _normalize_hostname(hostname: str) -> str:
    return hostname.strip().lower().rstrip(".").encode("idna").decode("ascii")


def canonicalize_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    scheme = parsed.scheme.lower()
    if scheme not in {"https", "http"}:
        raise UnsafeUrlError("Only HTTP(S) URLs are supported.")
    if not parsed.hostname:
        raise UnsafeUrlError("URL must contain a hostname.")
    hostname = _normalize_hostname(parsed.hostname)
    if parsed.username or parsed.password:
        raise UnsafeUrlError("Credentials in URLs are not allowed.")

    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeUrlError("URL contains an invalid port.") from exc
    if (scheme == "https" and port in (None, 443)) or (
        scheme == "http" and port in (None, 80)
    ):
        netloc = hostname
    else:
        netloc = f"{hostname}:{port}"

    raw_path = parsed.path or "/"
    normalized_path = posixpath.normpath(raw_path)
    if raw_path.endswith("/") and not normalized_path.endswith("/"):
        normalized_path += "/"
    if not normalized_path.startswith("/"):
        normalized_path = f"/{normalized_path}"
    # Some university catalogues publish href paths containing literal spaces
    # or non-ASCII characters. Encode the path before urllib builds a Request;
    # keep existing percent escapes intact to avoid double encoding.
    normalized_path = quote(
        normalized_path,
        safe="/%:@-._~!$&'()*+,;=",
    )

    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_KEYS
        and not key.lower().startswith("utm_")
    ]
    return urlunsplit(
        (scheme, netloc, normalized_path, urlencode(sorted(query)), "")
    )


def hostname_matches(hostname: str, allowed_domains: Iterable[str]) -> bool:
    normalized = _normalize_hostname(hostname)
    for domain in allowed_domains:
        candidate = _normalize_hostname(domain)
        if normalized == candidate or normalized.endswith(f".{candidate}"):
            return True
    return False


def is_nonproduction_hostname(hostname: str) -> bool:
    normalized = _normalize_hostname(hostname)
    labels = normalized.split(".")
    return any(
        label in NON_PRODUCTION_HOST_LABELS
        or label.startswith(("dev-", "preview-", "staging-", "test-"))
        or label.endswith(
            ("-dev", "-preview", "-staging", "-test", "-next")
        )
        for label in labels
    )


def _default_resolver(hostname: str, port: int) -> list[str]:
    records = socket.getaddrinfo(
        hostname,
        port,
        type=socket.SOCK_STREAM,
        proto=socket.IPPROTO_TCP,
    )
    return sorted({record[4][0] for record in records})


def resolve_with_timeout(
    hostname: str,
    port: int,
    *,
    timeout_seconds: float,
    resolver: Callable[[str, int], list[str]] = _default_resolver,
) -> list[str]:
    """Bound blocking system DNS without keeping the caller waiting."""
    completed = threading.Event()
    result: list[str] = []
    errors: list[BaseException] = []

    def resolve() -> None:
        try:
            result.extend(resolver(hostname, port))
        except BaseException as exc:
            errors.append(exc)
        finally:
            completed.set()

    threading.Thread(
        target=resolve,
        name=f"dns-{hostname}",
        daemon=True,
    ).start()
    if not completed.wait(max(0.001, timeout_seconds)):
        raise TimeoutError(f"DNS resolution timed out for '{hostname}'.")
    if errors:
        error = errors[0]
        if isinstance(error, OSError):
            raise error
        raise OSError(f"DNS resolution failed for '{hostname}'.") from error
    return result


def is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def validate_url(
    url: str,
    allowed_domains: Iterable[str],
    *,
    resolver: Callable[[str, int], list[str]] = _default_resolver,
    require_https: bool = True,
) -> ValidatedUrl:
    canonical = canonicalize_url(url)
    parsed = urlsplit(canonical)
    if require_https and parsed.scheme != "https":
        raise UnsafeUrlError("Only HTTPS URLs are allowed.")
    assert parsed.hostname is not None
    hostname = _normalize_hostname(parsed.hostname)
    if not hostname_matches(hostname, allowed_domains):
        raise UnsafeUrlError(
            f"Hostname '{hostname}' is not in the approved institution domains."
        )
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = tuple(resolver(hostname, port))
    except OSError as exc:
        raise UnsafeUrlError(f"DNS resolution failed for '{hostname}'.") from exc
    if not addresses:
        raise UnsafeUrlError(f"DNS returned no addresses for '{hostname}'.")
    unsafe = [address for address in addresses if not is_public_ip(address)]
    if unsafe:
        raise UnsafeUrlError(
            f"Hostname '{hostname}' resolves to a non-public address."
        )
    return ValidatedUrl(
        original_url=url,
        canonical_url=canonical,
        hostname=hostname,
        resolved_ips=addresses,
    )
