"""Production-capable external source adapters.

These adapters only discover and retrieve raw source resources.  They do not
turn snippets, registry records, or structured dataset rows into assertions.
Every candidate still passes the normal ``SourceResolver`` and the normal raw
evidence persistence boundary.
"""

from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import parse_qsl, quote, urlencode, urljoin, urlsplit, urlunsplit

from .acquisition import AcquisitionIntent, SourceCandidate
from .config import CrawlLimits, ExternalProviderConfig
from .fetcher import FetchError, SafeFetcher
from .models import FetchResult, SourceAuthority, SourceRelationship, TemporalState


def _enum(value: Any, enum_type: type, default: Any) -> Any:
    if value is None or str(value).strip() == "":
        return default
    if isinstance(value, enum_type):
        return value
    try:
        return enum_type(str(value).strip().upper())
    except ValueError:
        return default


def _values(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        value = (value,)
    if not isinstance(value, (list, tuple, set, frozenset)):
        return ()
    return tuple(dict.fromkeys(str(item).strip() for item in value if str(item).strip()))


SOURCE_CLASS_ALIASES: Mapping[str, str] = {
    "government": "government_dataset",
    "government_dataset": "government_dataset",
    "government_portal": "government_portal",
    "national_dataset": "government_dataset",
    "official_registry": "official_registry",
    "government_registry": "official_registry",
    "registry": "official_registry",
    "programme_registry": "official_registry",
    "qualification_registry": "official_registry",
    "accreditation": "accreditation",
    "accreditation_registry": "accreditation",
    "accreditation_body": "accreditation",
    "official_partner": "official_partner",
    "partner": "official_partner",
    "partner_institution": "official_partner",
    "consortium": "official_partner",
    "official_application": "official_partner",
    "official_application_system": "official_partner",
    "catalogue_provider": "official_partner",
    "external_authoritative": "external_authoritative",
    "trusted_external": "external_authoritative",
    "archive": "archive",
    "search": "search_discovery",
    "search_index": "search_discovery",
    "search_discovery": "search_discovery",
}


class SourceClassExecutionState(str, Enum):
    """Monotonic execution stages for an external source class."""

    CONFIGURED = "CONFIGURED"
    ADAPTER_READY = "ADAPTER_READY"
    DISCOVERY_ATTEMPTED = "DISCOVERY_ATTEMPTED"
    CANDIDATES_FOUND = "CANDIDATES_FOUND"
    ADMITTED = "ADMITTED"
    RETRIEVED = "RETRIEVED"
    RAW_PERSISTED = "RAW_PERSISTED"
    NO_YIELD = "NO_YIELD"
    HARD_BLOCKED = "HARD_BLOCKED"


def normalize_source_class(value: Any, default: str = "external_authoritative") -> str:
    normalized = str(value or default).strip().casefold().replace("-", "_")
    return SOURCE_CLASS_ALIASES.get(normalized, normalized)


def _safe_mapping(value: Any) -> dict[str, Any]:
    return {str(key): item for key, item in value.items()} if isinstance(value, Mapping) else {}


def _env_value(value: Any) -> str:
    text = str(value or "")
    if text.startswith("ENV:"):
        import os

        return os.environ.get(text[4:], "")
    return text


def _target_year(cycle: str | None) -> int | None:
    if not cycle:
        return None
    match = re.search(r"(?:19|20)\d{2}", str(cycle))
    return int(match.group(0)) if match else None


def _provider_dicts(context: Any) -> tuple[Mapping[str, Any], ...]:
    raw = getattr(context, "configuration", {}).get("external_providers", ())
    values: list[Mapping[str, Any]] = []
    for item in raw if isinstance(raw, (list, tuple)) else ():
        if isinstance(item, ExternalProviderConfig):
            values.append(item.to_dict())
        elif isinstance(item, Mapping):
            values.append(item)
    return tuple(values)


def provider_is_enabled(provider: Mapping[str, Any], context: Any | None = None) -> bool:
    """Return whether a provider may participate in this run.

    Catalogue entries marked ``enabled: false`` stay out of the default
    runtime.  An operator may still name one explicitly through
    ``external_provider_ids`` for a controlled fallback or migration run;
    that opt-in is carried in the adapter context and does not alter the
    catalogue default.
    """
    if bool(provider.get("enabled", True)):
        return True
    selected: Any = None
    if context is not None:
        configuration = getattr(context, "configuration", {})
        if isinstance(configuration, Mapping):
            selected = configuration.get("source_ecosystem_external_provider_ids")
    if isinstance(selected, str):
        selected = (selected,)
    selected_ids = {
        str(value).strip().casefold()
        for value in (selected or ())
        if str(value).strip()
    } if isinstance(selected, (list, tuple, set, frozenset)) else set()
    provider_id = str(provider.get("provider_id") or provider.get("id") or "").strip().casefold()
    return bool(provider_id and provider_id in selected_ids)


def _context_institution_id(context: Any) -> str | None:
    seed = getattr(context, "seed", None)
    return str(seed.institution_id) if seed is not None else None


def _context_country(context: Any) -> str | None:
    seed = getattr(context, "seed", None)
    return str(seed.country_code).upper() if seed is not None else None


def _context_region(context: Any) -> str | None:
    seed = getattr(context, "seed", None)
    return str(getattr(seed, "region", "")).upper() or None if seed is not None else None


def _scope_matches(provider: Mapping[str, Any], context: Any) -> bool:
    institution_id = _context_institution_id(context)
    country = _context_country(context)
    region = _context_region(context)
    institution_scope = _values(provider.get("institution_ids") or provider.get("institution_id"))
    if institution_scope and institution_id not in institution_scope:
        return False
    programme_scope = _values(provider.get("programme_ids") or provider.get("programme_id"))
    entity = getattr(context, "entity", None)
    entity_id = str(getattr(entity, "entity_id", "")) if entity is not None else ""
    if programme_scope and entity_id not in programme_scope:
        return False
    countries = {item.upper() for item in _values(provider.get("countries") or provider.get("country_codes") or provider.get("country"))}
    if countries and "*" not in countries and (not country or country not in countries):
        return False
    regions = {item.upper() for item in _values(provider.get("regions") or provider.get("region"))}
    if regions and "*" not in regions and (not region or region not in regions):
        return False
    return True


def _template_values(context: Any) -> dict[str, str]:
    seed = getattr(context, "seed", None)
    entity = getattr(context, "entity", None)
    values: dict[str, str] = {
        "institution_id": str(getattr(seed, "institution_id", "")),
        "institution_name": str(getattr(seed, "name", "")),
        "official_domain": str(getattr(seed, "official_domain", "")),
        "homepage_url": str(getattr(seed, "homepage_url", "")),
        "query": str(getattr(seed, "name", "")),
        "country_code": str(getattr(seed, "country_code", "")),
        "country": str(getattr(seed, "country_code", "")),
        "region": str(getattr(seed, "region", "")),
        "programme_id": str(getattr(entity, "entity_id", "")),
        "entity_id": str(getattr(entity, "entity_id", "")),
        "entity_type": str(getattr(entity, "entity_type", "")),
    }
    metadata = getattr(seed, "programme_metadata", {}) if seed is not None else {}
    if isinstance(metadata, Mapping):
        # A programme seed may provide deterministic provider identifiers such
        # as a UNITID, CRICOS code, or qualification number.  Only scalar values
        # are exposed to URL templates; nested metadata stays in provenance.
        programme_id = values.get("programme_id") or ""
        item = metadata.get(programme_id) if programme_id else None
        if isinstance(item, Mapping):
            for key, value in item.items():
                if isinstance(value, (str, int, float)) and str(value).strip():
                    values[str(key)] = str(value)
    provider_identifiers = (
        getattr(seed, "provider_identifiers", {}) if seed is not None else {}
    )
    if isinstance(provider_identifiers, Mapping):
        # Institution/provider identifiers are safe template values for a
        # configured record URL (for example a CRICOS code).  The catalogue
        # still controls the domain and the selected record must independently
        # prove the configured identifier after retrieval.
        for identifiers in provider_identifiers.values():
            if not isinstance(identifiers, Mapping):
                continue
            for key, value in identifiers.items():
                if isinstance(value, (str, int, float)) and str(value).strip():
                    values.setdefault(str(key), str(value))
    programme_identifiers = (
        getattr(seed, "provider_programme_identifiers", {})
        if seed is not None else {}
    )
    programme_id = values.get("programme_id") or ""
    if isinstance(programme_identifiers, Mapping) and programme_id:
        providers = programme_identifiers.get(programme_id)
        if isinstance(providers, Mapping):
            for identifiers in providers.values():
                if not isinstance(identifiers, Mapping):
                    continue
                for key, value in identifiers.items():
                    if isinstance(value, (str, int, float)) and str(value).strip():
                        values[str(key)] = str(value)
    return values


def _configured_programme_link(provider: Mapping[str, Any], context: Any) -> str | None:
    """Return a programme only when its provider identifier was configured."""
    entity = getattr(context, "entity", None)
    entity_id = str(getattr(entity, "entity_id", "") or "")
    entity_type = str(getattr(entity, "entity_type", "") or "").casefold()
    seed = getattr(context, "seed", None)
    mapping = getattr(seed, "provider_programme_identifiers", {}) if seed else {}
    provider_id = str(provider.get("provider_id") or provider.get("id") or "")
    if (
        entity_type not in {"programme", "program"}
        or not entity_id
        or not provider_id
        or not isinstance(mapping, Mapping)
    ):
        return None
    providers = mapping.get(entity_id)
    identifiers = providers.get(provider_id) if isinstance(providers, Mapping) else None
    return entity_id if isinstance(identifiers, Mapping) and identifiers else None


def _format_url(template: str, context: Any) -> str:
    try:
        return template.format_map(_template_values(context))
    except (KeyError, ValueError):
        return ""


def _provider_template_values(
    provider: Mapping[str, Any], context: Any
) -> dict[str, str]:
    """Add provider/resource identifiers to the context URL template values.

    Institution seeds supply identity values such as ``institution_id`` and
    ``country_code``.  Provider catalogues also commonly use ``dataset_id``,
    ``provider_id``, ``data_year`` or a configured resource identifier in a
    path.  Keeping those values in this narrow formatting helper lets one
    generic adapter serve multiple jurisdictions without embedding provider
    URLs in pipeline code.
    """
    values = _template_values(context)
    for key, value in provider.items():
        if isinstance(value, (str, int, float)) and str(value).strip():
            values.setdefault(str(key), str(value))
    provider_id = provider.get("provider_id") or provider.get("id")
    dataset_id = provider.get("dataset_id") or provider.get("dataset")
    data_year = (
        provider.get("academic_cycle")
        or provider.get("data_year")
        or provider.get("collection_year")
    )
    if provider_id:
        values.setdefault("provider_id", str(provider_id))
    if dataset_id:
        values.setdefault("dataset_id", str(dataset_id))
    if data_year:
        values.setdefault("data_year", str(data_year))
        values.setdefault("collection_year", str(data_year))
    return values


def _format_provider_url(template: str, provider: Mapping[str, Any], context: Any) -> str:
    try:
        return template.format_map(_provider_template_values(provider, context))
    except (KeyError, ValueError):
        return ""


def _append_query(url: str, values: Mapping[str, Any]) -> str:
    if not values:
        return url
    parsed = urlsplit(url)
    query = list(parse_qsl(parsed.query, keep_blank_values=True))
    query.extend(
        (str(key), str(value))
        for key, value in values.items()
        if value is not None and str(value) != ""
    )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def _nested_value(value: Any, path: str | None) -> Any:
    """Read a dotted mapping/list path from a catalogue response.

    Public data catalogues commonly expose a result URL as
    ``resources.0.url`` or ``distributions.0.access_url``.  Keeping this
    resolver in the generic provider prevents each catalogue configuration
    from requiring a bespoke adapter while still treating the response only
    as discovery metadata.
    """
    current = value
    if not path:
        return current
    for part in str(path).split("."):
        if isinstance(current, Mapping):
            current = current.get(part)
        elif isinstance(current, (list, tuple)) and part.isdigit():
            index = int(part)
            current = current[index] if index < len(current) else None
        else:
            return None
    return current


def _apply_auth_query(provider: Mapping[str, Any], url: str) -> str:
    authentication = provider.get("authentication")
    if isinstance(authentication, str):
        authentication = {"mode": authentication}
    if not isinstance(authentication, Mapping):
        authentication = {}
    mode = str(
        provider.get("authentication_mode")
        or authentication.get("mode")
        or "none"
    ).casefold()
    if mode != "api_key_query":
        return url
    env_name = str(
        authentication.get("token_env")
        or authentication.get("api_key_env")
        or authentication.get("credential_env")
        or ""
    ).strip()
    parameter = str(
        authentication.get("parameter")
        or authentication.get("query_parameter")
        or "api_key"
    ).strip()
    value = _env_value(f"ENV:{env_name}") if env_name else ""
    return _append_query(url, {parameter: value}) if value else url


def _authentication_headers(provider: Mapping[str, Any]) -> dict[str, str]:
    """Resolve optional provider credentials without storing them in metadata."""
    authentication = provider.get("authentication")
    if isinstance(authentication, str):
        authentication = {"mode": authentication}
    if not isinstance(authentication, Mapping):
        authentication = {}
    mode = str(
        provider.get("authentication_mode") or authentication.get("mode") or "none"
    ).casefold()
    env_name = str(
        authentication.get("token_env")
        or authentication.get("api_key_env")
        or authentication.get("credential_env")
        or ""
    ).strip()
    secret = _env_value(f"ENV:{env_name}") if env_name else ""
    header = str(
        authentication.get("header")
        or ("Authorization" if mode in {"bearer", "oauth2", "basic"} else "X-API-Key")
    ).strip()
    if mode == "basic":
        username = _env_value(f"ENV:{authentication.get('username_env', '')}")
        password = _env_value(f"ENV:{authentication.get('password_env', '')}")
        if username or password:
            encoded = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
            return {header: f"Basic {encoded}"}
        if secret:
            return {header: secret if secret.lower().startswith("basic ") else f"Basic {secret}"}
        return {}
    if not secret:
        return {}
    if mode in {"bearer", "oauth2"}:
        return {header: secret if secret.lower().startswith("bearer ") else f"Bearer {secret}"}
    if mode in {"api_key_header", "custom"}:
        return {header: secret}
    return {}


def _identifier_query_values(provider: Mapping[str, Any], context: Any) -> dict[str, str]:
    mapping = provider.get("identifier_mapping") or provider.get("identifier_map") or {}
    if not isinstance(mapping, Mapping):
        return {}
    values = _template_values(context)
    query: dict[str, str] = {}
    for provider_key, target in mapping.items():
        key = str(provider_key).strip()
        if not key:
            continue
        if isinstance(target, Mapping):
            target = target.get("template") or target.get("context") or target.get("value")
        value = str(target or "")
        if "{" in value:
            value = _format_provider_url(value, provider, context)
        elif value in values:
            value = values[value]
        elif value.startswith("ENV:"):
            value = _env_value(value)
        if value:
            query[key] = value
    return query


def _provider_url(provider: Mapping[str, Any], context: Any) -> str:
    template = str(
        provider.get("resource_url")
        or provider.get("url")
        or provider.get("direct_resource_url")
        or provider.get("query_endpoint")
        or provider.get("base_url")
        or ""
    ).strip()
    if not template:
        return ""
    url = _format_provider_url(template, provider, context)
    if not url or urlsplit(url).scheme not in {"http", "https"}:
        return ""
    resource_path = provider.get("resource_path") or provider.get("path")
    if resource_path and template == str(provider.get("base_url") or "").strip():
        formatted_path = _format_provider_url(str(resource_path), provider, context)
        if not formatted_path:
            return ""
        url = urljoin(
            url.rstrip("/") + "/",
            formatted_path.lstrip("/"),
        )
    query = provider.get("parameters")
    if isinstance(query, Mapping):
        values = {
            _format_provider_url(str(key), provider, context): _format_provider_url(
                str(value), provider, context
            )
            for key, value in query.items()
        }
        url = _append_query(url, values)
    url = _append_query(url, _identifier_query_values(provider, context))
    query_key = str(provider.get("query_parameter") or "").strip()
    if query_key and "{query}" not in template:
        url = _append_query(url, {query_key: _template_values(context).get("institution_name")})
    return url


def provider_request_url(provider: Mapping[str, Any], url: str) -> str:
    """Add provider query authentication only at the outbound request boundary.

    Candidate locators and persisted provenance must never contain API keys.
    Callers use this helper immediately before ``SafeFetcher.fetch`` while the
    provider metadata retains only the environment-variable reference.
    """
    return _apply_auth_query(provider, url)


def provider_public_url(provider: Mapping[str, Any], url: str) -> str:
    """Remove provider query credentials before a URL enters provenance.

    ``SafeFetcher`` needs the authenticated URL to make a request, but the
    resulting locator is persisted in raw evidence, source graphs, and staging
    rows.  Keep API keys at the request boundary and strip the configured query
    parameter from response/redirect URLs before those records are built.
    """
    authentication = provider.get("authentication")
    if isinstance(authentication, str):
        authentication = {"mode": authentication}
    if not isinstance(authentication, Mapping):
        authentication = {}
    mode = str(
        provider.get("authentication_mode")
        or authentication.get("mode")
        or "none"
    ).casefold()
    if mode != "api_key_query":
        return url
    parameter = str(
        authentication.get("parameter")
        or authentication.get("query_parameter")
        or "api_key"
    ).strip()
    if not parameter:
        return url
    parsed = urlsplit(url)
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key != parameter
    ]
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )


def sanitize_provider_fetch_result(
    provider: Mapping[str, Any], result: FetchResult
) -> FetchResult:
    """Scrub query credentials from a fetched result and redirect chain."""
    result.requested_url = provider_public_url(provider, result.requested_url)
    result.final_url = provider_public_url(provider, result.final_url)
    result.redirect_chain = [
        provider_public_url(provider, value) for value in result.redirect_chain
    ]
    return result


def _provider_resource_specs(
    provider: Mapping[str, Any], context: Any
) -> tuple[tuple[str, Mapping[str, Any]], ...]:
    """Return bounded resource URLs together with per-resource metadata."""
    values: list[tuple[str, Mapping[str, Any]]] = []
    primary = _provider_url(provider, context)
    if primary:
        values.append((primary, {}))
    raw = (
        provider.get("resource_specs")
        or provider.get("resource_urls")
        or provider.get("resources")
    )
    if isinstance(raw, (str, Mapping)):
        raw = (raw,)
    if isinstance(raw, (list, tuple, set, frozenset)):
        for item in raw:
            spec: Mapping[str, Any]
            if isinstance(item, Mapping):
                spec = dict(item)
                resource = (
                    spec.get("url")
                    or spec.get("resource_url")
                    or spec.get("query_endpoint")
                    or spec.get("endpoint")
                )
            else:
                spec = {}
                resource = item
            if not resource:
                continue
            formatted = _format_provider_url(str(resource), provider, context)
            if formatted:
                values.append((formatted, spec))
    unique: list[tuple[str, Mapping[str, Any]]] = []
    seen: set[str] = set()
    for url, spec in values:
        if url in seen:
            continue
        seen.add(url)
        unique.append((url, spec))
    return tuple(unique)


def _provider_resource_urls(provider: Mapping[str, Any], context: Any) -> tuple[str, ...]:
    """Return deterministic resource URLs, including configured collections."""
    return tuple(url for url, _ in _provider_resource_specs(provider, context))


def _pagination_urls(provider: Mapping[str, Any], base_url: str) -> tuple[tuple[str, dict[str, Any]], ...]:
    """Expand bounded static pagination into normal fetch candidates.

    Dynamic next links are retained in candidate metadata and can be followed
    by a caller through ``iter_paginated_results``; the discovery layer never
    performs an unbounded crawl.
    """
    pagination = provider.get("pagination") or {}
    if not isinstance(pagination, Mapping) or not pagination:
        return ((base_url, {"page_number": 1}),)
    strategy = str(pagination.get("strategy") or pagination.get("type") or "none").casefold()
    pages_raw = pagination.get("pages")
    if isinstance(pages_raw, (list, tuple)):
        page_values = tuple(pages_raw)
    else:
        try:
            max_pages = int(pagination.get("max_pages") or 1)
        except (TypeError, ValueError):
            max_pages = 1
        max_pages = max(1, min(max_pages, 100))
        start = pagination.get("start_page", pagination.get("start", 1))
        try:
            start_int = int(start)
        except (TypeError, ValueError):
            start_int = 1
        page_values = tuple(start_int + index for index in range(max_pages))
    page_param = str(pagination.get("page_parameter") or pagination.get("page_param") or "page")
    offset_param = str(pagination.get("offset_parameter") or pagination.get("offset_param") or "offset")
    page_size = pagination.get("page_size") or pagination.get("limit")
    cursor_values = pagination.get("cursors") or ()
    if isinstance(cursor_values, str):
        cursor_values = (cursor_values,)
    results: list[tuple[str, dict[str, Any]]] = []
    if strategy in {"cursor", "continuation"} and cursor_values:
        for index, cursor in enumerate(cursor_values):
            results.append((_append_query(base_url, {str(pagination.get("cursor_parameter") or "cursor"): cursor}), {
                "page_number": index + 1, "cursor": cursor,
            }))
    elif strategy in {"offset", "limit_offset"}:
        for index, page in enumerate(page_values):
            offset = (int(page) - int(page_values[0])) * int(page_size or 100)
            values: dict[str, Any] = {offset_param: offset}
            if page_size:
                values[str(pagination.get("page_size_parameter") or "limit")] = page_size
            results.append((_append_query(base_url, values), {"page_number": index + 1, "offset": offset}))
    elif strategy in {"page", "numbered", "page_number"}:
        for index, page in enumerate(page_values):
            values = {page_param: page}
            if page_size:
                values[str(pagination.get("page_size_parameter") or "limit")] = page_size
            results.append((_append_query(base_url, values), {"page_number": index + 1, "page": page}))
    else:
        results.append((base_url, {"page_number": 1}))
    unique: list[tuple[str, dict[str, Any]]] = []
    seen_urls: set[str] = set()
    for url, metadata in results:
        if url in seen_urls:
            continue
        seen_urls.add(url)
        unique.append((url, metadata))
    return tuple(unique)


def _fetch_request_kwargs(metadata: Mapping[str, Any]) -> dict[str, Any]:
    """Build SafeFetcher arguments without exposing provider secrets."""
    kwargs: dict[str, Any] = {}
    method = str(metadata.get("retrieval_method") or "GET").upper()
    if method in {"GET", "POST"}:
        kwargs["method"] = method
    if metadata.get("accept"):
        kwargs["accept"] = str(metadata["accept"])
    max_bytes = metadata.get("max_bytes")
    if max_bytes is not None and str(max_bytes).strip() != "":
        try:
            bounded = int(max_bytes)
        except (TypeError, ValueError):
            bounded = 0
        if bounded > 0:
            kwargs["max_bytes"] = bounded
    headers = metadata.get("request_headers")
    if isinstance(headers, Mapping):
        resolved = {str(key): _env_value(value) for key, value in headers.items() if _env_value(value)}
        if resolved:
            kwargs["request_headers"] = resolved
    authentication_headers = _authentication_headers(metadata)
    if authentication_headers:
        merged = dict(kwargs.get("request_headers") or {})
        merged.update(authentication_headers)
        kwargs["request_headers"] = merged
    body = metadata.get("request_body")
    if body is not None:
        if isinstance(body, bytes):
            kwargs["data"] = body
        elif isinstance(body, (Mapping, list, tuple)):
            kwargs["data"] = json.dumps(body).encode("utf-8")
            merged = dict(kwargs.get("request_headers") or {})
            merged.setdefault("Content-Type", "application/json")
            kwargs["request_headers"] = merged
    if isinstance(metadata.get("rate_limit_policy"), Mapping):
        kwargs["rate_limit_policy"] = dict(metadata["rate_limit_policy"])
    return kwargs


def iter_paginated_resources(
    candidate: SourceCandidate,
    *,
    fetcher: SafeFetcher,
    allowed_domains: Iterable[str],
    max_pages: int | None = None,
) -> Iterable[FetchResult]:
    """Fetch a bounded page/cursor/next-link sequence through SafeFetcher.

    The ordinary pipeline can persist each yielded ``FetchResult`` using its
    existing raw-document boundary. This helper intentionally has no parser or
    assertion behaviour and stops on repeated URLs, malformed next links, or
    the configured page limit.
    """
    metadata = candidate.adapter_metadata
    pagination = metadata.get("pagination")
    pagination = pagination if isinstance(pagination, Mapping) else {}
    try:
        limit = max(1, min(int(max_pages or pagination.get("max_pages") or 1), 100))
    except (TypeError, ValueError):
        limit = 1
    current = candidate.canonical_locator
    seen: set[str] = set()
    for _ in range(limit):
        if not current or current in seen:
            break
        seen.add(current)
        result = fetcher.fetch(
            provider_request_url(metadata, current),
            allowed_domains=tuple(allowed_domains),
            **_fetch_request_kwargs(metadata),
        )
        sanitize_provider_fetch_result(metadata, result)
        yield result
        next_url: str | None = None
        next_path = pagination.get("next_path") or pagination.get("next_url_field")
        if next_path and (result.content_type or "").lower().find("json") >= 0:
            try:
                payload = json.loads(result.body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                payload = None
            value: Any = payload
            for part in str(next_path).split("."):
                value = value.get(part) if isinstance(value, Mapping) else None
            if isinstance(value, str) and value.strip():
                next_url = value.strip()
        elif (result.content_type or "").lower().find("json") >= 0:
            try:
                payload = json.loads(result.body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                payload = None
            value = payload.get("next") if isinstance(payload, Mapping) else None
            if isinstance(value, str) and value.strip():
                next_url = value.strip()
        if next_url and not urlsplit(next_url).scheme:
            next_url = urljoin(current, next_url)
        if next_url:
            next_url = provider_public_url(metadata, next_url)
        current = next_url or ""


def _provider_source_class(provider: Mapping[str, Any]) -> str:
    return normalize_source_class(provider.get("source_class"))


def _provider_adapter_id(provider: Mapping[str, Any], fallback: str) -> str:
    return str(provider.get("adapter_id") or provider.get("adapter") or fallback).strip()


def _provider_academic_cycle(
    provider: Mapping[str, Any], intent: AcquisitionIntent
) -> str | None:
    """Resolve provider temporal metadata without inventing a cycle.

    A provider mapping that explicitly carries ``academic_cycle: null`` (as
    ``ExternalProviderConfig.to_dict`` does) is a declaration that this source
    has no configured academic cycle.  Only legacy/injected mappings that omit
    all temporal keys retain the intent-cycle fallback.  Resource-level
    ``data_year``/``collection_year`` values still take precedence when they
    are actually supplied.
    """
    for key in ("academic_cycle", "data_year", "collection_year"):
        value = provider.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    if any(key in provider for key in ("academic_cycle", "data_year", "collection_year")):
        return None
    return intent.target_cycle


def _provider_candidate(
    provider: Mapping[str, Any],
    *,
    context: Any,
    intent: AcquisitionIntent,
    adapter_id: str,
    source_class: str | None = None,
    locator_type: str = "provider_resource",
    default_authority: SourceAuthority = SourceAuthority.OTHER,
    default_relationship: SourceRelationship = SourceRelationship.OTHER_RELATED,
    default_temporal: TemporalState = TemporalState.UNKNOWN,
    discovery_method: str = "configured_external_provider",
    canonical_url_override: str | None = None,
    page_metadata: Mapping[str, Any] | None = None,
) -> SourceCandidate | None:
    url = canonical_url_override or _provider_url(provider, context)
    if not url:
        return None
    source_class = normalize_source_class(source_class or _provider_source_class(provider))
    authority = _enum(
        provider.get("authority") or provider.get("source_authority"),
        SourceAuthority,
        default_authority,
    )
    relationship = _enum(
        provider.get("relationship") or provider.get("source_relationship"),
        SourceRelationship,
        default_relationship,
    )
    temporal_state = _enum(
        provider.get("temporal_state"), TemporalState, default_temporal
    )
    if source_class == "archive":
        temporal_state = TemporalState.HISTORICAL
    expected = _values(provider.get("field_groups") or provider.get("fields"))
    configuration = getattr(context, "configuration", {}) or {}
    if configuration.get("enforce_provider_field_routing") and expected:
        requested = {
            str(value).strip().casefold()
            for value in intent.field_groups
            if str(value).strip()
        }
        expected = tuple(
            value for value in expected if value.casefold() in requested
        )
        if not expected:
            return None
    expected = expected or tuple(intent.field_groups)
    evidence = _values(provider.get("relationship_evidence"))
    evidence = evidence or (
        f"configured provider {provider.get('provider_id') or provider.get('id')}",
    )
    metadata: dict[str, Any] = {
        "configured_adapter_id": provider.get("adapter_id") or provider.get("adapter") or adapter_id,
        "provider_name": provider.get("name"),
        "provider_type": provider.get("provider_type") or provider.get("type"),
        "provider_reason": provider.get("reason"),
        "retrieval_method": str(provider.get("retrieval_method") or provider.get("method") or "GET").upper(),
        "result_path": provider.get("result_path"),
        "country_scope": list(_values(provider.get("countries") or provider.get("country_codes") or provider.get("country"))),
        "region_scope": list(_values(provider.get("regions") or provider.get("region"))),
        "field_applicability": list(expected),
        "source_resolution": str(
            provider.get("resolution")
            or provider.get("source_resolution")
            or provider.get("record_resolution")
            or "unknown"
        ).casefold(),
        "formats": list(
            _values(provider.get("formats") or provider.get("supported_formats"))
        ),
        "identifier_mapping": dict(
            provider.get("identifier_mapping") or provider.get("identifier_map") or {}
        ) if isinstance(provider.get("identifier_mapping") or provider.get("identifier_map") or {}, Mapping) else {},
        "structured_archive": dict(provider.get("structured_archive") or {})
        if isinstance(provider.get("structured_archive"), Mapping)
        else {},
        # Field materialisation is declarative provider metadata.  It travels
        # with the candidate so retained structured/text evidence can be
        # rendered into an extraction source without turning provider records
        # into facts at acquisition time.
        "field_evidence": dict(provider.get("field_evidence") or {})
        if isinstance(provider.get("field_evidence"), Mapping)
        else {},
        "retrieval_type": provider.get("retrieval_type") or provider.get("resource_type") or "http",
        "max_bytes": provider.get("max_bytes"),
        "pagination": dict(provider.get("pagination") or {}) if isinstance(provider.get("pagination") or {}, Mapping) else {},
        "rate_limit_policy": dict(provider.get("rate_limit_policy") or provider.get("rate_limit") or {}) if isinstance(provider.get("rate_limit_policy") or provider.get("rate_limit") or {}, Mapping) else {},
        "authentication_mode": provider.get("authentication_mode") or ((provider.get("authentication") or {}).get("mode") if isinstance(provider.get("authentication"), Mapping) else None) or "none",
    }
    # Carry configured source-native identifiers into the candidate metadata
    # so generic structured parsers can retain the exact row for this target.
    # These values come from the seed configuration, not from the source, and
    # are therefore routing metadata rather than factual evidence.  Keep the
    # shape provider-neutral for CSV/JSON/XML adapters alike.
    seed = getattr(context, "seed", None)
    provider_id = str(provider.get("provider_id") or provider.get("id") or "")
    target_identifiers: Mapping[str, Any] | None = None
    entity = getattr(context, "entity", None)
    entity_id = str(getattr(entity, "entity_id", "") or "")
    programme_identifiers = (
        getattr(seed, "provider_programme_identifiers", {}) if seed is not None else {}
    )
    if provider_id and entity_id and isinstance(programme_identifiers, Mapping):
        providers = programme_identifiers.get(entity_id)
        if isinstance(providers, Mapping):
            configured = providers.get(provider_id)
            if isinstance(configured, Mapping) and configured:
                target_identifiers = configured
    if target_identifiers is None and provider_id and seed is not None:
        institution_identifiers = getattr(seed, "provider_identifiers", {})
        if isinstance(institution_identifiers, Mapping):
            configured = institution_identifiers.get(provider_id)
            if isinstance(configured, Mapping) and configured:
                target_identifiers = configured
    if target_identifiers:
        cleaned = {
            str(key).strip(): str(value).strip()
            for key, value in target_identifiers.items()
            if str(key).strip()
            and value is not None
            and str(value).strip()
        }
        if cleaned:
            metadata["target_identifiers"] = cleaned
            structured = metadata.get("structured_archive")
            if isinstance(structured, Mapping):
                structured_copy = dict(structured)
                existing = structured_copy.get("target_identifiers")
                merged = dict(existing) if isinstance(existing, Mapping) else {}
                merged.update(cleaned)
                structured_copy["target_identifiers"] = merged
                metadata["structured_archive"] = structured_copy
    programme_link = _configured_programme_link(provider, context)
    if programme_link:
        metadata["programme_id"] = programme_link
    if provider.get("accept"):
        metadata["accept"] = str(provider.get("accept"))
    if provider.get("query_parameter"):
        metadata["query_parameter"] = str(provider.get("query_parameter"))
    if source_class == "archive":
        metadata.update({
            "original_url": _format_provider_url(
                str(provider.get("original_url") or provider.get("original") or ""),
                provider,
                context,
            ) or None,
            "captured_at": _format_provider_url(
                str(provider.get("captured_at") or provider.get("capture_time") or ""),
                provider,
                context,
            ) or None,
            "archive_provider": provider.get("provider_id") or provider.get("id"),
        })
    if isinstance(provider.get("request_headers"), Mapping):
        metadata["request_headers"] = dict(provider["request_headers"])
    if provider.get("request_body") is not None:
        metadata["request_body"] = provider.get("request_body")
    authentication = provider.get("authentication")
    if isinstance(authentication, str):
        authentication = {"mode": authentication}
    if isinstance(authentication, Mapping):
        # Store only non-secret authentication descriptors. Credentials are
        # resolved from the environment immediately before a fetch.
        metadata["authentication"] = {
            str(key): value
            for key, value in authentication.items()
            if str(key).casefold() not in {"token", "secret", "password", "api_key", "client_secret"}
        }
    if page_metadata:
        metadata.update(dict(page_metadata))
    source_resolution = metadata.get("source_resolution")
    original_url = metadata.get("original_url")
    capture_url = metadata.get("capture_url")
    captured_at = metadata.get("captured_at")
    archive_provider = metadata.get("archive_provider")
    return SourceCandidate.create(
        canonical_locator=url,
        locator_type=locator_type,
        source_class=source_class,
        adapter_id=adapter_id,
        publisher_key=str(provider.get("provider_id") or provider.get("id") or provider.get("domain") or "") or None,
        relationship=relationship,
        relationship_evidence=evidence,
        declared_authority=authority,
        expected_field_groups=expected,
        academic_cycle=_provider_academic_cycle(provider, intent),
        discovery_method=discovery_method,
        discovery_evidence=str(provider.get("reason") or "configured provider catalogue"),
        fetch_strategy=(
            "archive" if source_class == "archive" else metadata["retrieval_method"].lower()
        ),
        cost_class=str(provider.get("cost_class") or "external_provider"),
        adapter_version=str(provider.get("adapter_version") or "1"),
        provider_id=str(provider.get("provider_id") or provider.get("id") or "") or None,
        dataset_id=str(provider.get("dataset_id") or "") or None,
        temporal_state=temporal_state,
        source_resolution=str(source_resolution) if source_resolution else None,
        original_url=str(original_url) if original_url else None,
        capture_url=str(capture_url) if capture_url else None,
        captured_at=str(captured_at) if captured_at else None,
        archive_provider=str(archive_provider) if archive_provider else None,
        adapter_metadata=metadata,
    )


class ConfiguredExternalProviderAdapter:
    """Base adapter for provider-catalogue resources."""

    adapter_id = "external_provider"
    priority = 25
    source_classes: frozenset[str] = frozenset()

    @staticmethod
    def _matches_fields(
        provider: Mapping[str, Any],
        intent: AcquisitionIntent,
        context: Any,
    ) -> bool:
        configuration = getattr(context, "configuration", {}) or {}
        if not configuration.get("enforce_provider_field_routing"):
            return True
        provider_fields = {
            value.casefold()
            for value in _values(provider.get("field_groups") or provider.get("fields"))
        }
        requested_fields = {
            str(value).strip().casefold()
            for value in intent.field_groups
            if str(value).strip()
        }
        return not provider_fields or bool(provider_fields.intersection(requested_fields))

    def _matches(self, provider: Mapping[str, Any], context: Any) -> bool:
        if not provider_is_enabled(provider, context) or not _scope_matches(provider, context):
            return False
        configuration = getattr(context, "configuration", {}) or {}
        if configuration.get("source_ecosystem_programme_only"):
            resolution = str(
                provider.get("resolution")
                or provider.get("source_resolution")
                or "institution"
            ).casefold()
            if resolution not in {"programme", "program"}:
                return False
        source_class = _provider_source_class(provider)
        provider_adapter = _provider_adapter_id(provider, self.adapter_id)
        if self.source_classes and source_class not in self.source_classes:
            return False
        if provider_adapter == self.adapter_id:
            return True
        return source_class in self.source_classes

    def supports(self, intent: AcquisitionIntent, context: Any) -> bool:
        preferred = {normalize_source_class(value, "") for value in intent.preferred_source_classes}
        return any(
            self._matches(provider, context)
            and self._matches_fields(provider, intent, context)
            and (not preferred or _provider_source_class(provider) in preferred)
            for provider in _provider_dicts(context)
        )

    def discover(self, intent: AcquisitionIntent, context: Any) -> list[SourceCandidate]:
        candidates: list[SourceCandidate] = []
        for provider in _provider_dicts(context):
            if not self._matches(provider, context):
                continue
            if not self._matches_fields(provider, intent, context):
                continue
            if intent.preferred_source_classes and _provider_source_class(provider) not in {
                normalize_source_class(value, "") for value in intent.preferred_source_classes
            }:
                continue
            try:
                provider_limit = max(1, min(int(provider.get("max_results") or 100), 100))
            except (TypeError, ValueError):
                provider_limit = 100
            provider_count = 0
            for resource_url, resource_metadata in _provider_resource_specs(provider, context):
                effective_provider = {**dict(provider), **dict(resource_metadata)}
                for paged_url, page_metadata in _pagination_urls(effective_provider, resource_url):
                    candidate = _provider_candidate(
                        effective_provider,
                        context=context,
                        intent=intent,
                        adapter_id=self.adapter_id,
                        source_class=_provider_source_class(provider),
                        canonical_url_override=paged_url,
                        page_metadata=page_metadata,
                    )
                    if candidate is not None:
                        candidates.append(candidate)
                        provider_count += 1
                        if provider_count >= provider_limit:
                            break
                if provider_count >= provider_limit:
                    break
        return candidates


class GovernmentDatasetAdapter(ConfiguredExternalProviderAdapter):
    """Reusable bounded HTTP JSON/CSV/XML/ZIP government adapter."""

    adapter_id = "government_dataset"
    priority = 14
    source_classes = frozenset({"government_dataset", "government_portal"})

    def _matches(self, provider: Mapping[str, Any], context: Any) -> bool:
        if not super()._matches(provider, context):
            return False
        # IPEDS and Scorecard retain their existing specialized contracts.
        provider_id = str(provider.get("provider_id") or provider.get("id") or "").casefold()
        adapter_id = _provider_adapter_id(provider, self.adapter_id).casefold()
        return provider_id not in {"ipeds", "college_scorecard", "scorecard"} and adapter_id not in {
            "ipeds", "college_scorecard"
        }


class OfficialRegistryAdapter(ConfiguredExternalProviderAdapter):
    adapter_id = "official_registry"
    priority = 16
    source_classes = frozenset({"official_registry"})


class AccreditationRegistryAdapter(ConfiguredExternalProviderAdapter):
    adapter_id = "accreditation_registry"
    priority = 17
    source_classes = frozenset({"accreditation"})


class PartnerSourceAdapter(ConfiguredExternalProviderAdapter):
    adapter_id = "official_partner"
    priority = 18
    source_classes = frozenset({"official_partner"})


class ExternalAuthoritativeAdapter(ConfiguredExternalProviderAdapter):
    adapter_id = "external_authoritative"
    priority = 19
    source_classes = frozenset({"external_authoritative"})


@dataclass(frozen=True)
class ArchiveCapture:
    """A bounded archive capture selected for raw retrieval."""

    original_url: str
    capture_url: str
    captured_at: str | None = None
    provider_id: str | None = None
    digest: str | None = None
    content_type: str | None = None
    status: int | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


def _capture_timestamp(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    # CDX timestamps are compact (YYYYmmddhhmmss); retain them in an
    # ISO-looking UTC form while preserving the original value in metadata.
    if re.fullmatch(r"\d{14}", text):
        try:
            return datetime.strptime(text, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            return text
    return text


def parse_archive_captures(
    payload: bytes | str | Any,
    *,
    provider_id: str | None = None,
    capture_url_template: str | None = None,
    max_captures: int = 3,
    target_cycle: str | None = None,
) -> tuple[ArchiveCapture, ...]:
    """Parse common CDX/Memento capture responses without network access."""
    value: Any = payload
    if isinstance(payload, bytes):
        value = payload.decode("utf-8", errors="replace")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            rows: list[Any] = [line for line in value.splitlines() if line.strip()]
            value = rows
    rows: list[Mapping[str, Any]] = []
    if isinstance(value, Mapping):
        for key in ("captures", "results", "items", "data"):
            candidate = value.get(key)
            if isinstance(candidate, list):
                value = candidate
                break
        else:
            value = [value]
    if isinstance(value, list):
        header: list[str] | None = None
        for row in value:
            if isinstance(row, Mapping):
                rows.append(row)
                continue
            if isinstance(row, (list, tuple)):
                normalized_names = {
                    "urlkey", "timestamp", "original", "original_url", "mimetype",
                    "content_type", "statuscode", "status_code", "status", "digest",
                    "capture_url", "archive_url", "wayback_url",
                }
                if (
                    header is None
                    and row
                    and all(
                        isinstance(item, str)
                        and str(item).strip().casefold() in normalized_names
                        for item in row
                    )
                ):
                    header = [str(item).strip() for item in row]
                    continue
                if header:
                    rows.append({header[index]: item for index, item in enumerate(row) if index < len(header)})
                elif len(row) >= 3:
                    cells = [str(item).strip() for item in row]
                    if re.fullmatch(r"\d{14}", cells[0]):
                        # CDX responses requested with ``fl=timestamp,original,...``.
                        record: dict[str, Any] = {
                            "timestamp": cells[0],
                            "original": cells[1],
                        }
                        if len(cells) > 2:
                            record["mimetype"] = cells[2]
                        if len(cells) > 3:
                            record["statuscode"] = cells[3]
                        if len(cells) > 4:
                            record["digest"] = cells[4]
                        rows.append(record)
                    elif re.fullmatch(r"\d{14}", cells[1]):
                        # The common CDX default is urlkey,timestamp,original,...
                        record = {"timestamp": cells[1], "original": cells[2]}
                        if len(cells) > 3:
                            record["mimetype"] = cells[3]
                        if len(cells) > 4:
                            record["statuscode"] = cells[4]
                        if len(cells) > 5:
                            record["digest"] = cells[5]
                        rows.append(record)
                    else:
                        rows.append({"original": cells[0], "timestamp": cells[1], "url": cells[2]})
                continue
            if isinstance(row, str):
                # CDX lines are whitespace-delimited; the original URL and
                # timestamp are enough to construct a capture URL.
                parts = row.split()
                if len(parts) >= 3:
                    if re.fullmatch(r"\d{14}", parts[0]):
                        record = {"timestamp": parts[0], "original": parts[1]}
                        if len(parts) > 2:
                            record["mimetype"] = parts[2]
                        if len(parts) > 3:
                            record["statuscode"] = parts[3]
                        if len(parts) > 4:
                            record["digest"] = parts[4]
                        rows.append(record)
                    elif re.fullmatch(r"\d{14}", parts[1]):
                        record = {"timestamp": parts[1], "original": parts[2]}
                        if len(parts) > 3:
                            record["mimetype"] = parts[3]
                        if len(parts) > 4:
                            record["statuscode"] = parts[4]
                        if len(parts) > 5:
                            record["digest"] = parts[5]
                        rows.append(record)
    target_year = _target_year(target_cycle)
    captures: list[ArchiveCapture] = []
    seen: set[str] = set()
    for row in rows:
        original = str(
            row.get("original") or row.get("original_url") or row.get("url") or ""
        ).strip()
        timestamp_raw = row.get("timestamp") or row.get("captured_at") or row.get("capture_time")
        captured_at = _capture_timestamp(timestamp_raw)
        capture_url = str(
            row.get("capture_url") or row.get("archive_url") or row.get("wayback_url") or ""
        ).strip()
        if not capture_url and original and timestamp_raw:
            template = capture_url_template or "https://web.archive.org/web/{timestamp}id_/{original}"
            try:
                capture_url = template.format(
                    timestamp=str(timestamp_raw), original=original, original_url=original,
                )
            except (KeyError, ValueError):
                capture_url = ""
        if not original or not capture_url:
            continue
        status_raw = row.get("status") or row.get("statuscode") or row.get("status_code")
        try:
            status = int(status_raw) if status_raw is not None else None
        except (TypeError, ValueError):
            status = None
        if status is not None and status != 200:
            continue
        digest = str(row.get("digest") or "").strip() or None
        # A capture URL identifies one archived response.  CDX can repeat the
        # same capture with different digest/metadata columns, so dedupe on the
        # locator itself rather than allowing duplicate retrieval candidates.
        key = capture_url
        if key in seen:
            continue
        seen.add(key)
        captures.append(ArchiveCapture(
            original_url=original,
            capture_url=capture_url,
            captured_at=captured_at,
            provider_id=provider_id,
            digest=digest,
            content_type=(str(row.get("mimetype") or row.get("content_type") or "").strip() or None),
            status=status,
            metadata=dict(row),
        ))
    def sort_key(item: ArchiveCapture) -> tuple[int, float]:
        year_distance = 9999
        if target_year and item.captured_at:
            match = re.search(r"(?:19|20)\d{2}", item.captured_at)
            if match:
                year_distance = abs(int(match.group(0)) - target_year)
        timestamp = 0.0
        if item.captured_at:
            try:
                timestamp = datetime.fromisoformat(item.captured_at.replace("Z", "+00:00")).timestamp()
            except ValueError:
                timestamp = 0.0
        return (year_distance, -timestamp)
    captures.sort(key=sort_key)
    return tuple(captures[: max(1, min(int(max_captures or 1), 50))])


class ArchiveSourceAdapter(ConfiguredExternalProviderAdapter):
    adapter_id = "archive_http"
    priority = 70
    source_classes = frozenset({"archive"})

    def __init__(self, fetcher: SafeFetcher | None = None, *, max_captures: int = 3) -> None:
        self.fetcher = fetcher
        self.max_captures = max(1, min(int(max_captures), 50))

    def _capture_discovery_url(self, provider: Mapping[str, Any], context: Any) -> str:
        discovery = dict(provider)
        resource = (
            provider.get("capture_discovery_url")
            or provider.get("discovery_url")
            or provider.get("query_endpoint")
            or provider.get("resource_url")
        )
        discovery["resource_url"] = resource
        return _provider_url(discovery, context)

    def _capture_candidates(
        self, provider: Mapping[str, Any], *, context: Any, intent: AcquisitionIntent
    ) -> list[SourceCandidate]:
        captures_raw = provider.get("captures") or provider.get("capture_urls") or ()
        if isinstance(captures_raw, str):
            captures_raw = (captures_raw,)
        captures: list[ArchiveCapture] = []
        if isinstance(captures_raw, (list, tuple)):
            for item in captures_raw:
                if isinstance(item, Mapping):
                    original = _format_provider_url(
                        str(item.get("original_url") or provider.get("original_url") or ""),
                        provider,
                        context,
                    )
                    capture_url = _format_provider_url(
                        str(item.get("capture_url") or item.get("url") or ""),
                        provider,
                        context,
                    )
                    if capture_url:
                        captures.append(ArchiveCapture(
                            original_url=original or str(item.get("original_url") or ""),
                            capture_url=capture_url,
                            captured_at=_capture_timestamp(item.get("captured_at") or item.get("timestamp")),
                            provider_id=str(provider.get("provider_id") or provider.get("id") or "") or None,
                            digest=str(item.get("digest") or "") or None,
                            metadata=dict(item),
                        ))
                elif item:
                    captures.append(ArchiveCapture(
                        original_url=_format_provider_url(
                            str(provider.get("original_url") or ""), provider, context
                        ),
                        capture_url=_format_provider_url(str(item), provider, context),
                        provider_id=str(provider.get("provider_id") or provider.get("id") or "") or None,
                    ))
        discovery_url = self._capture_discovery_url(provider, context)
        if not captures and self.fetcher is not None and discovery_url:
            policy = getattr(context, "configuration", {}).get("robots_policy")
            host = urlsplit(discovery_url).hostname or str(provider.get("domain") or "")
            allowed_domains = (host,) if host else ()
            agent = getattr(getattr(self.fetcher, "limits", None), "user_agent", "GlowBalExternalArchive/1.0")
            if policy is not None and not policy.allows(discovery_url, agent, allowed_domains=allowed_domains):
                return []
            fetch_kwargs = _fetch_request_kwargs(provider)
            fetch_kwargs["accept"] = str(
                provider.get("accept") or "application/json,text/plain,*/*;q=0.1"
            )
            fetch_kwargs["max_bytes"] = 2 * 1024 * 1024
            result = self.fetcher.fetch(
                provider_request_url(provider, discovery_url),
                allowed_domains=allowed_domains,
                **fetch_kwargs,
            )
            captures.extend(parse_archive_captures(
                result.body,
                provider_id=str(provider.get("provider_id") or provider.get("id") or "") or None,
                capture_url_template=str(provider.get("capture_url_template") or "") or None,
                max_captures=int(provider.get("max_captures") or self.max_captures),
                target_cycle=intent.target_cycle,
            ))
        unique: list[SourceCandidate] = []
        seen: set[str] = set()
        for capture in captures[: int(provider.get("max_captures") or self.max_captures)]:
            if not capture.capture_url or capture.capture_url in seen:
                continue
            seen.add(capture.capture_url)
            candidate = _provider_candidate(
                provider,
                context=context,
                intent=intent,
                adapter_id=self.adapter_id,
                source_class="archive",
                locator_type="archive",
                default_authority=SourceAuthority.ARCHIVE,
                default_relationship=SourceRelationship.ARCHIVE,
                default_temporal=TemporalState.HISTORICAL,
                discovery_method="archive_capture_discovery" if discovery_url else "configured_archive_capture",
                canonical_url_override=capture.capture_url,
                page_metadata={
                    "original_url": capture.original_url
                    or _format_provider_url(
                        str(provider.get("original_url") or ""), provider, context
                    ),
                    "capture_url": capture.capture_url,
                    "captured_at": capture.captured_at,
                    "archive_provider": capture.provider_id or provider.get("provider_id") or provider.get("id"),
                    "capture_digest": capture.digest,
                    "capture_metadata": dict(capture.metadata),
                },
            )
            if candidate is not None:
                unique.append(candidate)
        return unique

    def discover(self, intent: AcquisitionIntent, context: Any) -> list[SourceCandidate]:
        candidates: list[SourceCandidate] = []
        for provider in _provider_dicts(context):
            if not self._matches(provider, context):
                continue
            captures = self._capture_candidates(provider, context=context, intent=intent)
            if captures:
                candidates.extend(captures)
                continue
            # With no injected fetcher, preserve a deterministic discovery
            # candidate for callers that will perform the capture query in a
            # separate bounded phase. It is explicitly marked pending and
            # remains historical metadata, never current evidence.
            if self.fetcher is None:
                candidate = _provider_candidate(
                    provider,
                    context=context,
                    intent=intent,
                    adapter_id=self.adapter_id,
                    source_class="archive",
                    locator_type="archive_discovery",
                    default_authority=SourceAuthority.ARCHIVE,
                    default_relationship=SourceRelationship.ARCHIVE,
                    default_temporal=TemporalState.HISTORICAL,
                    discovery_method="configured_archive_provider",
                    page_metadata={"capture_discovery_pending": True},
                )
                if candidate is not None:
                    candidates.append(candidate)
        return candidates

    def discover_archive(self, intent: AcquisitionIntent, context: Any) -> list[SourceCandidate]:
        return self.discover(intent, context)


ProductionArchiveAdapter = ArchiveSourceAdapter
GovernmentDatasetSourceAdapter = GovernmentDatasetAdapter
GenericRegistryAdapter = OfficialRegistryAdapter
ArchiveAdapter = ArchiveSourceAdapter
RegistryAdapter = OfficialRegistryAdapter
AccreditationAdapter = AccreditationRegistryAdapter
PartnerAdapter = PartnerSourceAdapter
GovernmentDatasetProviderAdapter = GovernmentDatasetAdapter
# Descriptive aliases keep the provider catalogue vocabulary discoverable while
# all implementations continue to share the one configured HTTP adapter.
NationalDatasetAdapter = GovernmentDatasetAdapter
OfficialProgrammeRegistryAdapter = OfficialRegistryAdapter
AccreditationBodyAdapter = AccreditationRegistryAdapter
OfficialPartnerAdapter = PartnerSourceAdapter
TrustedExternalDatasetAdapter = ExternalAuthoritativeAdapter


class HttpSearchProvider:
    """Pluggable bounded HTTP discovery provider.

    The provider returns candidate resources only.  ``SearchSourceAdapter``
    marks each result as snippet-only and the normal resolver must admit and
    fetch the resulting URL before it can become raw evidence.
    """

    def __init__(
        self,
        *,
        provider_id: str,
        endpoint: str,
        domain: str,
        fetcher: SafeFetcher | None = None,
        method: str = "GET",
        query_parameter: str = "q",
        result_path: str | None = None,
        max_results: int = 10,
        request_headers: Mapping[str, str] | None = None,
        authentication: Mapping[str, Any] | None = None,
        pagination: Mapping[str, Any] | None = None,
        rate_limit_policy: Mapping[str, Any] | None = None,
        adapter_id: str = "search_provider",
        source_class: str = "search_discovery",
        authority: SourceAuthority = SourceAuthority.OTHER,
        relationship: SourceRelationship = SourceRelationship.OTHER_RELATED,
        result_url_field: str = "url",
        result_url_template: str | None = None,
        dataset_id: str | None = None,
    ) -> None:
        if not provider_id.strip() or not endpoint.strip() or not domain.strip():
            raise ValueError("HTTP search provider requires provider_id, endpoint and domain.")
        if urlsplit(endpoint).scheme not in {"http", "https"}:
            raise ValueError("HTTP search endpoint must use HTTP(S).")
        if method.upper() not in {"GET", "POST"}:
            raise ValueError("HTTP search provider method must be GET or POST.")
        if max_results < 1:
            raise ValueError("HTTP search provider max_results must be positive.")
        self.provider_id = provider_id
        self.endpoint = endpoint
        self.domain = domain.lower()
        self.fetcher = fetcher or SafeFetcher(
            # The provider is deliberately bounded; callers may inject the
            # pipeline fetcher when they need shared throttling.
            CrawlLimits(
                request_timeout_seconds=20.0,
                connect_timeout_seconds=10.0,
                max_redirects=3,
                max_html_bytes=2 * 1024 * 1024,
                max_pdf_bytes=2 * 1024 * 1024,
                user_agent="GlowBalExternalDiscovery/1.0",
                min_request_interval_seconds=1.0,
            )
        )
        self.method = method.upper()
        self.query_parameter = query_parameter
        self.result_path = result_path
        self.max_results = min(max_results, 100)
        self.request_headers = dict(request_headers or {})
        self.authentication = dict(authentication or {})
        self.pagination = dict(pagination or {})
        self.rate_limit_policy = dict(rate_limit_policy or {})
        self.adapter_id = adapter_id.strip() or "search_provider"
        self.source_class = normalize_source_class(source_class, "search_discovery")
        self.authority = authority if isinstance(authority, SourceAuthority) else _enum(authority, SourceAuthority, SourceAuthority.OTHER)
        self.relationship = relationship if isinstance(relationship, SourceRelationship) else _enum(relationship, SourceRelationship, SourceRelationship.OTHER_RELATED)
        self.result_url_field = result_url_field or "url"
        self.result_url_template = str(result_url_template).strip() if result_url_template else None
        # Discovery providers may publish a dataset/catalogue identity. Keep
        # it on candidates so the normal raw/staging provenance path can
        # distinguish resources returned by different public catalogues.
        self.dataset_id = str(dataset_id).strip() if dataset_id else None

    def result_url_for(self, item: Mapping[str, Any]) -> str:
        """Resolve a catalogue row to its authoritative fetch locator.

        Discovery APIs sometimes return a stable dataset identifier while the
        nested access URL is a provider-specific display string (for example,
        markdown-wrapped links).  A template is explicitly configured per
        provider and is therefore limited to that provider's own URL space.
        It only creates a fetch candidate; the normal source admission rule
        still runs before retrieval and no catalogue text becomes evidence.
        """
        if self.result_url_template:
            values = {str(key): value for key, value in item.items()}
            try:
                candidate = self.result_url_template.format(
                    **{key: str(value) for key, value in values.items()}
                ).strip()
            except (KeyError, IndexError, ValueError):
                candidate = ""
            if candidate:
                return candidate
        return str(
            _nested_value(item, self.result_url_field)
            or item.get("url")
            or item.get("link")
            or ""
        ).strip()

    def _request_headers(self) -> dict[str, str]:
        request_headers = {"Accept": "application/json", **self.request_headers}
        request_headers.update(_authentication_headers({"authentication": self.authentication}))
        return request_headers

    def _request_url(
        self,
        query: str,
        page_index: int,
        page_param: str,
        *,
        max_pages: int,
        page_start: int,
    ) -> str:
        """Build one bounded search request without persisting credentials in metadata."""
        values: dict[str, Any] = {self.query_parameter: query}
        if max_pages > 1:
            strategy = str(self.pagination.get("strategy") or "page").casefold()
            if strategy in {"offset", "limit_offset"}:
                try:
                    page_size = int(
                        self.pagination.get("page_size")
                        or self.pagination.get("limit")
                        or self.max_results
                    )
                except (TypeError, ValueError):
                    page_size = self.max_results
                try:
                    offset = int(
                        self.pagination.get("start_offset")
                        or self.pagination.get("offset")
                        or 0
                    )
                except (TypeError, ValueError):
                    offset = 0
                values[
                    str(
                        self.pagination.get("offset_parameter")
                        or self.pagination.get("offset_param")
                        or "offset"
                    )
                ] = offset + page_index * page_size
                values[
                    str(
                        self.pagination.get("page_size_parameter")
                        or self.pagination.get("limit_parameter")
                        or "limit"
                    )
                ] = page_size
            else:
                values[page_param] = page_start + page_index
        url = self.endpoint if self.method == "POST" else _append_query(self.endpoint, values)
        mode = str(self.authentication.get("mode") or "none").casefold()
        if mode == "api_key_query":
            env_name = str(
                self.authentication.get("token_env")
                or self.authentication.get("api_key_env")
                or self.authentication.get("credential_env")
                or ""
            ).strip()
            parameter = str(
                self.authentication.get("parameter")
                or self.authentication.get("query_parameter")
                or "api_key"
            ).strip()
            secret = _env_value(f"ENV:{env_name}") if env_name else ""
            if secret:
                url = _append_query(url, {parameter: secret})
        return url

    def _extract(self, payload: Any) -> Sequence[Mapping[str, Any]]:
        value = _nested_value(payload, self.result_path)
        if isinstance(value, Mapping):
            value = value.get("results") or value.get("items") or value.get("data") or []
        return tuple(item for item in value if isinstance(item, Mapping)) if isinstance(value, list) else ()

    def search_with_policy(
        self,
        query: str,
        *,
        robots_policy: Any | None = None,
        user_agent: str | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        pagination = self.pagination
        try:
            max_pages = max(1, min(int(pagination.get("max_pages") or 1), 20))
        except (TypeError, ValueError):
            max_pages = 1
        page_param = str(pagination.get("page_parameter") or pagination.get("page_param") or "page")
        try:
            page_start = int(pagination.get("start_page") or pagination.get("start") or 1)
        except (TypeError, ValueError):
            page_start = 1
        allowed_domains = (self.domain,)
        agent = user_agent or getattr(
            getattr(self.fetcher, "limits", None),
            "user_agent",
            "GlowBalExternalDiscovery/1.0",
        )
        rows: list[Mapping[str, Any]] = []
        seen_urls: set[str] = set()
        next_url: str | None = None
        for page_index in range(max_pages):
            if next_url:
                url = next_url
            else:
                url = self._request_url(
                    query,
                    page_index,
                    page_param,
                    max_pages=max_pages,
                    page_start=page_start,
                )
            request_headers = self._request_headers()
            data = None
            if self.method == "POST":
                body: dict[str, Any] = {self.query_parameter: query}
                if max_pages > 1:
                    strategy = str(pagination.get("strategy") or "page").casefold()
                    if strategy in {"offset", "limit_offset"}:
                        try:
                            page_size = int(
                                pagination.get("page_size")
                                or pagination.get("limit")
                                or self.max_results
                            )
                        except (TypeError, ValueError):
                            page_size = self.max_results
                        try:
                            offset = int(
                                pagination.get("start_offset")
                                or pagination.get("offset")
                                or 0
                            )
                        except (TypeError, ValueError):
                            offset = 0
                        body[
                            str(
                                pagination.get("offset_parameter")
                                or pagination.get("offset_param")
                                or "offset"
                            )
                        ] = offset + page_index * page_size
                        body[
                            str(
                                pagination.get("page_size_parameter")
                                or pagination.get("limit_parameter")
                                or "limit"
                            )
                        ] = page_size
                    else:
                        body[page_param] = page_start + page_index
                data = json.dumps(body).encode("utf-8")
                request_headers.setdefault("Content-Type", "application/json")
            if robots_policy is not None and not robots_policy.allows(
                url, agent, allowed_domains=allowed_domains
            ):
                raise FetchError("Search endpoint is disallowed by robots policy.", code="BLOCKED_BY_ROBOTS", url=url)
            result = self.fetcher.fetch(
                url,
                allowed_domains=allowed_domains,
                accept="application/json",
                method=self.method,
                data=data,
                request_headers=request_headers,
                rate_limit_policy=(
                    dict(self.rate_limit_policy)
                    if self.rate_limit_policy
                    else (
                        dict(pagination.get("rate_limit_policy"))
                        if isinstance(pagination.get("rate_limit_policy"), Mapping)
                        else None
                    )
                ),
            )
            try:
                payload = json.loads(result.body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise FetchError("Search provider returned invalid JSON.", code="INVALID_SEARCH_RESPONSE", url=url) from exc
            page_rows = self._extract(payload)
            for item in page_rows:
                candidate_url = self.result_url_for(item)
                if candidate_url and candidate_url not in seen_urls:
                    seen_urls.add(candidate_url)
                    rows.append(item)
            next_value = payload
            next_path = pagination.get("next_path") or pagination.get("next_url_field")
            if next_path:
                next_value = _nested_value(payload, str(next_path))
            else:
                next_value = payload.get("next") if isinstance(payload, Mapping) else None
            next_url = str(next_value).strip() if isinstance(next_value, str) and next_value.strip() else None
            if next_url and not urlsplit(next_url).scheme:
                next_url = urljoin(url, next_url)
            if next_url:
                next_url = provider_public_url(
                    {"authentication": self.authentication}, next_url
                )
            if not next_url:
                # Numbered pagination is deterministic; stop when a page is
                # shorter than the provider's requested page size.
                page_size = pagination.get("page_size") or pagination.get("limit")
                if page_size and len(page_rows) < int(page_size):
                    break
        return tuple(rows[: self.max_results])

    def search(self, query: str) -> Sequence[Mapping[str, Any]]:
        return self.search_with_policy(query)


ProductionSearchProvider = HttpSearchProvider
SearchDiscoveryProvider = HttpSearchProvider


@dataclass(frozen=True)
class SourceClassCoverageResult:
    required_source_classes: tuple[str, ...]
    outcomes: Mapping[str, str]
    details: Mapping[str, Mapping[str, Any]]
    experiment_valid: bool
    ready: bool
    states: Mapping[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "required_source_classes": list(self.required_source_classes),
            "outcomes": dict(self.outcomes),
            "states": dict(self.states),
            "details": {key: dict(value) for key, value in self.details.items()},
            "experiment_valid": self.experiment_valid,
            "ready": self.ready,
        }


class SourceClassCoverageGate:
    """Readiness gate that exposes missing/failed external source classes."""

    OUTCOMES = frozenset({
        "PRESENT", "ATTEMPTED_NO_YIELD", "NOT_CONFIGURED", "UNSUPPORTED",
        "ADMISSION_REJECTED", "CANDIDATE_NOT_FOUND", "DISCOVERY_FAILED",
        "FETCH_FAILED", "RETRIEVAL_SUCCEEDED", "RAW_PERSISTED",
    })
    STATES = frozenset(item.value for item in SourceClassExecutionState)

    def __init__(self, required_source_classes: Iterable[str]) -> None:
        self.required_source_classes = tuple(dict.fromkeys(
            normalize_source_class(value, "")
            for value in required_source_classes if str(value).strip()
        ))

    @staticmethod
    def _registered_classes(registry: Any) -> set[str]:
        known: set[str] = set()
        for adapter in registry.ordered() if registry is not None else ():
            values = getattr(adapter, "source_classes", ())
            if values:
                known.update(normalize_source_class(value, "") for value in values)
            mapping = {
                "manual_source": {"official_web", "official_finance", "central_admissions"},
                "official_catalogue": {"official_catalogue"},
                "coursedog_catalogue": {"official_catalogue"},
                "pdf_document": {"pdf"},
                "json_api": {"official_api", "structured_api"},
                "ipeds": {"government_dataset"},
                "college_scorecard": {"government_dataset"},
                "search_index": {"search_discovery"},
                "search_provider": {"search_discovery"},
                "fixture_archive": {"archive"},
            }
            known.update(mapping.get(str(getattr(adapter, "adapter_id", "")), set()))
        return known

    def evaluate(
        self,
        *,
        registry: Any,
        configured_source_classes: Iterable[str] = (),
        events: Iterable[Mapping[str, Any]] = (),
    ) -> SourceClassCoverageResult:
        configured = {
            normalize_source_class(value, "")
            for value in configured_source_classes
            if str(value).strip()
        }
        counts: dict[str, dict[str, int]] = {}
        explicit_states: dict[str, set[str]] = {}
        for event in events:
            source_class = normalize_source_class(event.get("source_class"), "")
            if not source_class:
                continue
            execution_state = str(event.get("execution_state") or "").upper()
            if execution_state in self.STATES:
                explicit_states.setdefault(source_class, set()).add(execution_state)
                if execution_state == SourceClassExecutionState.CONFIGURED.value:
                    configured.add(source_class)
            item = counts.setdefault(
                source_class,
                {
                    "discovered": 0,
                    "attempted": 0,
                    "admitted": 0,
                    "rejected": 0,
                    "retrieved": 0,
                    "persisted": 0,
                    "failed": 0,
                    "no_candidates": 0,
                    "discovery_failed": 0,
                    "unsupported": 0,
                },
            )
            status = str(event.get("status") or "").upper()
            # Accept state-only telemetry from an orchestrator that records a
            # class lifecycle before it has a legacy outcome/status string.
            if not status and execution_state:
                if execution_state == SourceClassExecutionState.DISCOVERY_ATTEMPTED.value:
                    item["attempted"] += 1
                elif execution_state == SourceClassExecutionState.CANDIDATES_FOUND.value:
                    item["attempted"] += 1
                    item["discovered"] += 1
                elif execution_state == SourceClassExecutionState.ADMITTED.value:
                    item["attempted"] += 1
                    item["admitted"] += 1
                elif execution_state == SourceClassExecutionState.RETRIEVED.value:
                    item["attempted"] += 1
                    item["retrieved"] += 1
                elif execution_state == SourceClassExecutionState.RAW_PERSISTED.value:
                    item["attempted"] += 1
                    item["retrieved"] += 1
                    item["persisted"] += 1
                elif execution_state == SourceClassExecutionState.NO_YIELD.value:
                    item["no_candidates"] += 1
                elif execution_state == SourceClassExecutionState.HARD_BLOCKED.value:
                    item["failed"] += 1
            if status == "DISCOVERED":
                item["discovered"] += 1
            if status in {"CANDIDATES_FOUND", "DISCOVERY_ATTEMPTED"}:
                item["attempted"] += 1
                if status == "CANDIDATES_FOUND":
                    item["discovered"] += 1
            if event.get("admitted") is not None:
                item["admitted" if event.get("admitted") else "rejected"] += 1
            if status == "ADMITTED" and event.get("admitted") is None:
                item["admitted"] += 1
            if status in {
                "FETCH_FAILED",
                "RAW_PERSIST_FAILED",
                "SOURCE_REJECTED_BY_ROBOTS",
                "SOURCE_REJECTED_BY_POLICY",
                "RAW_RETRIEVED",
                "RAW_REUSED",
                "RETRIEVAL_SUCCEEDED",
                "RAW_PERSISTED",
            }:
                item["attempted"] += 1
            if status in {"FETCH_FAILED", "RAW_PERSIST_FAILED", "SOURCE_REJECTED_BY_ROBOTS", "HARD_BLOCKED"}:
                item["failed"] += 1
            if status in {"NO_CANDIDATES", "CANDIDATE_NOT_FOUND"}:
                item["no_candidates"] += 1
            if status == "NO_SUPPORTED_ADAPTER":
                item["unsupported"] += 1
            if status == "DISCOVERY_FAILED":
                item["discovery_failed"] += 1
            if status in {"RAW_RETRIEVED", "RAW_REUSED", "RETRIEVAL_SUCCEEDED", "RAW_PERSISTED"}:
                item["retrieved"] += 1
            if status in {"RAW_PERSISTED", "PERSISTED"}:
                item["persisted"] += 1
        registered = self._registered_classes(registry)
        for source_class, observed in explicit_states.items():
            if SourceClassExecutionState.ADAPTER_READY.value in observed:
                registered.add(source_class)
        outcomes: dict[str, str] = {}
        states: dict[str, str] = {}
        details: dict[str, Mapping[str, Any]] = {}
        for source_class in self.required_source_classes:
            item = counts.get(
                source_class,
                {
                    "discovered": 0,
                    "attempted": 0,
                    "admitted": 0,
                    "rejected": 0,
                    "retrieved": 0,
                    "persisted": 0,
                    "failed": 0,
                    "no_candidates": 0,
                    "discovery_failed": 0,
                    "unsupported": 0,
                },
            )
            if item["persisted"]:
                outcome = "PRESENT"
            elif item["retrieved"]:
                outcome = "RETRIEVAL_SUCCEEDED"
            elif item["failed"]:
                outcome = "FETCH_FAILED"
            elif item["attempted"]:
                outcome = "ATTEMPTED_NO_YIELD"
            elif item["rejected"] and not item["admitted"]:
                outcome = "ADMISSION_REJECTED"
            elif item["no_candidates"]:
                outcome = "CANDIDATE_NOT_FOUND"
            elif item["unsupported"]:
                # A registered adapter can still report no supported provider
                # for this seed (for example a country-scoped catalogue).  In
                # that case the adapter exists and the result is a candidate
                # miss; reserve UNSUPPORTED for a genuinely absent adapter.
                outcome = "UNSUPPORTED" if source_class not in registered else "CANDIDATE_NOT_FOUND"
            elif item["discovery_failed"]:
                outcome = "DISCOVERY_FAILED"
            elif source_class not in configured:
                outcome = "NOT_CONFIGURED"
            elif source_class not in registered:
                outcome = "UNSUPPORTED"
            else:
                outcome = "NOT_CONFIGURED"
            outcomes[source_class] = outcome
            details[source_class] = {
                **item,
                "configured": source_class in configured,
                "registered": source_class in registered,
            }
            # State is monotonic: the highest completed stage is retained while
            # the legacy outcome explains why a class did or did not yield raw
            # evidence. These names are consumed by later readiness reports.
            observed = explicit_states.get(source_class, set())
            if item["persisted"] or SourceClassExecutionState.RAW_PERSISTED.value in observed:
                state = "RAW_PERSISTED"
            elif item["retrieved"] or SourceClassExecutionState.RETRIEVED.value in observed:
                state = "RETRIEVED"
            elif item["admitted"] or SourceClassExecutionState.ADMITTED.value in observed:
                state = "ADMITTED"
            elif item["discovered"] or SourceClassExecutionState.CANDIDATES_FOUND.value in observed:
                state = "CANDIDATES_FOUND"
            elif SourceClassExecutionState.NO_YIELD.value in observed or item["no_candidates"]:
                state = "NO_YIELD"
            elif (
                SourceClassExecutionState.DISCOVERY_ATTEMPTED.value in observed
                or item["attempted"]
                or item["discovery_failed"]
            ):
                state = "DISCOVERY_ATTEMPTED"
            elif SourceClassExecutionState.HARD_BLOCKED.value in observed:
                state = "HARD_BLOCKED"
            elif source_class in registered:
                state = "ADAPTER_READY"
            elif source_class in configured:
                state = "CONFIGURED"
            else:
                state = "HARD_BLOCKED"
            if (
                outcome in {"UNSUPPORTED", "NOT_CONFIGURED", "ADMISSION_REJECTED", "FETCH_FAILED"}
                and not (
                    item["persisted"]
                    or item["retrieved"]
                    or item["admitted"]
                    or item["discovered"]
                )
                and not observed.intersection(self.STATES - {
                    SourceClassExecutionState.HARD_BLOCKED.value,
                })
            ):
                state = "HARD_BLOCKED"
            states[source_class] = state
            details[source_class]["state"] = state
        experiment_valid = any(
            int(details[source_class].get("attempted", 0))
            or int(details[source_class].get("retrieved", 0))
            or int(details[source_class].get("persisted", 0))
            for source_class in self.required_source_classes
        )
        ready = bool(self.required_source_classes) and all(
            outcome == "PRESENT" for outcome in outcomes.values()
        )
        return SourceClassCoverageResult(
            required_source_classes=self.required_source_classes,
            outcomes=outcomes,
            states=states,
            details=details,
            experiment_valid=experiment_valid,
            ready=ready,
        )


def evaluate_source_class_coverage(
    *,
    required_source_classes: Iterable[str],
    registry: Any,
    configured_source_classes: Iterable[str] = (),
    events: Iterable[Mapping[str, Any]] = (),
) -> SourceClassCoverageResult:
    return SourceClassCoverageGate(required_source_classes).evaluate(
        registry=registry,
        configured_source_classes=configured_source_classes,
        events=events,
    )


__all__ = [
    "AccreditationRegistryAdapter",
    "AccreditationAdapter",
    "ArchiveAdapter",
    "ArchiveCapture",
    "ArchiveSourceAdapter",
    "ConfiguredExternalProviderAdapter",
    "ExternalAuthoritativeAdapter",
    "GenericRegistryAdapter",
    "GovernmentDatasetAdapter",
    "GovernmentDatasetSourceAdapter",
    "GovernmentDatasetProviderAdapter",
    "NationalDatasetAdapter",
    "OfficialProgrammeRegistryAdapter",
    "AccreditationBodyAdapter",
    "OfficialPartnerAdapter",
    "TrustedExternalDatasetAdapter",
    "parse_archive_captures",
    "iter_paginated_resources",
    "provider_public_url",
    "provider_request_url",
    "sanitize_provider_fetch_result",
    "HttpSearchProvider",
    "OfficialRegistryAdapter",
    "PartnerSourceAdapter",
    "ProductionArchiveAdapter",
    "ProductionSearchProvider",
    "SearchDiscoveryProvider",
    "RegistryAdapter",
    "PartnerAdapter",
    "SourceClassCoverageGate",
    "SourceClassCoverageResult",
    "SourceClassExecutionState",
    "evaluate_source_class_coverage",
]
