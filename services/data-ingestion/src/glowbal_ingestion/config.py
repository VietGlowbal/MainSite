from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlsplit

from .models import SourceAuthority, SourceRelationship


@dataclass(frozen=True)
class CrawlLimits:
    global_concurrency: int = 6
    institution_concurrency: int = 3
    programme_concurrency_per_institution: int = 1
    per_domain_concurrency: int = 1
    request_timeout_seconds: float = 20.0
    connect_timeout_seconds: float = 10.0
    max_redirects: int = 5
    max_html_bytes: int = 5 * 1024 * 1024
    max_pdf_bytes: int = 25 * 1024 * 1024
    max_sitemap_bytes: int = 12 * 1024 * 1024
    max_sitemaps_per_institution: int = 20
    max_sitemap_urls: int = 50_000
    # Responses at or above this threshold must use durable streaming raw
    # persistence.  They are never copied into a local run artifact.
    large_raw_object_threshold_bytes: int = 8 * 1024 * 1024
    # Local spooling is reserved for parsers that cannot operate remotely.  A
    # zero value disables such a fallback; the streaming path fails explicitly
    # rather than silently creating a heavy local copy.
    max_local_temp_bytes: int = 0
    max_index_pages: int = 40
    max_index_depth: int = 2
    max_deep_sources_per_programme: int = 12
    # Operational fallback is deliberately bounded.  This limits only the
    # alternate candidates attempted after the configured programme URL fails;
    # it does not widen discovery or bypass robots/access policy.
    max_source_recovery_candidates: int = 4
    max_admission_retry_sources_per_programme: int = 3
    max_coverage_retry_sources_per_programme: int = 2
    max_deep_programmes_per_institution: int = 2
    max_status_preflight_candidates_per_institution: int = 12
    max_optional_phd_total: int = 3
    max_llm_retries: int = 2
    max_source_chars_per_llm_call: int = 80_000
    max_sources_per_extraction_group: int = 4
    max_source_chars_per_extraction_group: int = 40_000
    crawl4ai_min_text_chars: int = 800
    min_request_interval_seconds: float = 1.0
    user_agent: str = (
        "Mozilla/5.0 (compatible; GlowBalEducationDataSmoke/0.1; "
        "+mailto:data@glowbal.co)"
    )

    def __post_init__(self) -> None:
        if self.large_raw_object_threshold_bytes < 1:
            raise ValueError("large_raw_object_threshold_bytes must be positive.")
        if self.max_local_temp_bytes < 0:
            raise ValueError("max_local_temp_bytes must be non-negative.")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CrawlLimits":
        known = {field.name for field in cls.__dataclass_fields__.values()}
        parsed = cls(**{key: value for key, value in raw.items() if key in known})
        if parsed.large_raw_object_threshold_bytes < 1:
            raise ValueError("large_raw_object_threshold_bytes must be positive.")
        if parsed.max_local_temp_bytes < 0:
            raise ValueError("max_local_temp_bytes must be non-negative.")
        return parsed


@dataclass(frozen=True)
class ProgrammePriority:
    source: str
    rank: int
    label: str
    taxonomy_code: str | None = None
    completions_total: int | None = None
    degree_completions: tuple[tuple[str, int], ...] = ()

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ProgrammePriority":
        source = str(raw.get("source") or "").strip()
        label = str(raw.get("label") or "").strip()
        rank = int(raw.get("rank") or 0)
        if not source or not label or rank < 1:
            raise ValueError(
                "Programme priority requires source, label and positive rank."
            )
        degree_counts = raw.get("degree_completions") or {}
        if not isinstance(degree_counts, dict):
            raise ValueError("degree_completions must be an object.")
        normalized_counts: list[tuple[str, int]] = []
        for degree_level, count in degree_counts.items():
            normalized_degree = str(degree_level).strip().lower()
            normalized_count = int(count)
            if normalized_degree not in {"bachelor", "master", "doctorate"}:
                continue
            if normalized_count > 0:
                normalized_counts.append(
                    (normalized_degree, normalized_count)
                )
        completions_total_raw = raw.get("completions_total")
        completions_total = (
            int(completions_total_raw)
            if completions_total_raw is not None
            else None
        )
        return cls(
            source=source,
            rank=rank,
            label=label,
            taxonomy_code=(
                str(raw["taxonomy_code"]).strip()
                if raw.get("taxonomy_code")
                else None
            ),
            completions_total=(
                completions_total
                if completions_total is None or completions_total >= 0
                else None
            ),
            degree_completions=tuple(sorted(normalized_counts)),
        )

    def completions_for_degree(self, degree_level: str | None) -> int:
        if not degree_level:
            return 0
        normalized = (
            "doctorate" if degree_level.lower() == "phd" else degree_level.lower()
        )
        return dict(self.degree_completions).get(normalized, 0)


@dataclass(frozen=True)
class ExternalSourceRule:
    """Explicit admission rule for a related-party source domain.

    This is intentionally narrower than ``allowed_domains``: a candidate still
    needs relationship evidence and an adapter must name the rule it uses.
    """

    domain: str
    adapter_id: str
    reason: str
    relationship: SourceRelationship
    authority: SourceAuthority
    provider_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "adapter_id": self.adapter_id,
            "reason": self.reason,
            "relationship": self.relationship.value,
            "authority": self.authority.value,
            "provider_id": self.provider_id,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ExternalSourceRule":
        domain = str(raw.get("domain") or "").strip().lower()
        adapter_id = str(raw.get("adapter_id") or "").strip()
        reason = str(raw.get("reason") or "").strip()
        if not domain or not adapter_id or not reason:
            raise ValueError(
                "External source rule requires domain, adapter_id and reason."
            )
        try:
            relationship = SourceRelationship(
                str(raw.get("relationship") or "").upper()
            )
            authority = SourceAuthority(
                str(raw.get("authority") or "").upper()
            )
        except ValueError as exc:
            raise ValueError("External source rule has invalid authority or relationship.") from exc
        return cls(
            domain=domain,
            adapter_id=adapter_id,
            reason=reason,
            relationship=relationship,
            authority=authority,
            provider_id=(
                str(raw["provider_id"]).strip()
                if raw.get("provider_id")
                else None
            ),
        )


@dataclass(frozen=True)
class ExternalProviderConfig:
    """Provider-catalogue entry independent of institution seeds.

    A provider entry describes how a source can be located and what its
    authority means.  It does not grant admission for any institution; the
    institution's ``ExternalSourceRule`` remains the required admission rule.
    """

    provider_id: str
    source_class: str
    authority: SourceAuthority
    relationship: SourceRelationship
    countries: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()
    domain: str | None = None
    base_url: str | None = None
    resource_url: str | None = None
    query_endpoint: str | None = None
    dataset_id: str | None = None
    retrieval_method: str = "GET"
    field_groups: tuple[str, ...] = ("tuition",)
    academic_cycle: str | None = None
    enabled: bool = True
    adapter_id: str | None = None
    institution_ids: tuple[str, ...] = ()
    programme_ids: tuple[str, ...] = ()
    reason: str = "configured external provider"
    result_path: str | None = None
    original_url: str | None = None
    captured_at: str | None = None
    query_parameter: str | None = None
    request_headers: Mapping[str, str] = field(default_factory=dict)
    request_body: Any = None
    accept: str | None = None
    parameters: Mapping[str, Any] = field(default_factory=dict)
    # Provider metadata is deliberately separate from institution seeds.  The
    # fields below describe how a provider can be retrieved and what resolution
    # its records have; they never grant source admission by themselves.
    name: str | None = None
    provider_type: str | None = None
    retrieval_type: str = "http"
    formats: tuple[str, ...] = ()
    resolution: str = "unknown"
    identifier_mapping: Mapping[str, Any] = field(default_factory=dict)
    pagination: Mapping[str, Any] = field(default_factory=dict)
    rate_limit_policy: Mapping[str, Any] = field(default_factory=dict)
    authentication_mode: str = "none"
    authentication: Mapping[str, Any] = field(default_factory=dict)
    resource_urls: tuple[str, ...] = ()
    resource_path: str | None = None
    capture_discovery_url: str | None = None
    capture_url_template: str | None = None
    captures: tuple[Mapping[str, Any], ...] = ()
    max_captures: int = 3
    max_results: int = 10
    result_url_field: str = "url"
    # Some public catalogues expose a stable identifier instead of a usable
    # resource URL.  A configured template lets the generic discovery adapter
    # resolve that identifier to the provider's authoritative metadata route
    # without treating catalogue snippets as evidence.
    result_url_template: str | None = None
    collection_year: str | None = None
    resource_specs: tuple[Mapping[str, Any], ...] = ()
    # Bulk resources (ZIP/CSV/XML) commonly exceed the HTML safety limit. A
    # provider may raise this explicitly while remaining bounded by the global
    # upper limit enforced during catalogue parsing.
    max_bytes: int | None = None
    # Optional bounded parsing hints for structured archive members.  These
    # remain provider metadata; they do not alter the global parser limits.
    structured_archive: Mapping[str, Any] = field(default_factory=dict)
    # A provider may describe how an already-retained structured record or
    # bounded document row becomes field-bearing extraction context.  This is
    # declarative provider metadata, not a claim that every resource contains
    # every configured field.
    field_evidence: Mapping[str, Any] = field(default_factory=dict)
    # Disabled providers remain in the catalogue as optional fallbacks. The
    # flag is descriptive metadata; runtime selection still follows ``enabled``.
    optional: bool = False

    @staticmethod
    def _values(raw: Any, *, upper: bool = False) -> tuple[str, ...]:
        if isinstance(raw, str):
            raw = (raw,)
        if not isinstance(raw, (list, tuple, set, frozenset)):
            return ()
        values = tuple(
            (str(value).strip().upper() if upper else str(value).strip())
            for value in raw
            if str(value).strip()
        )
        return tuple(dict.fromkeys(values))

    @staticmethod
    def _default_adapter_id(source_class: str, relationship: SourceRelationship) -> str:
        normalized = source_class.casefold()
        if normalized in {"government_dataset", "government", "government_portal", "national_dataset"}:
            return "government_dataset"
        if normalized in {"official_registry", "government_registry", "registry"}:
            return "official_registry"
        if normalized in {"accreditation", "accreditation_registry"}:
            return "accreditation_registry"
        if normalized in {
            "official_partner", "partner", "consortium", "official_application",
            "catalogue_provider",
        }:
            return "official_partner"
        if normalized == "archive" or relationship == SourceRelationship.ARCHIVE:
            return "archive_http"
        if normalized in {"search", "search_discovery", "search_index"}:
            return "search_provider"
        if normalized in {"official_api", "structured_api"}:
            return "json_api"
        return "external_authoritative"

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> "ExternalProviderConfig":
        if not isinstance(raw, Mapping):
            raise ValueError("External provider entries must be objects.")
        provider_id = str(raw.get("provider_id") or raw.get("id") or "").strip()
        source_class = str(raw.get("source_class") or "").strip().casefold()
        if not provider_id or not source_class:
            raise ValueError("External provider requires provider_id and source_class.")
        authority_raw = str(
            raw.get("authority") or raw.get("source_authority") or ""
        ).strip()
        relationship_raw = str(
            raw.get("relationship") or raw.get("source_relationship") or ""
        ).strip()
        if not authority_raw or not relationship_raw:
            raise ValueError(
                f"External provider {provider_id} requires explicit authority and relationship."
            )
        try:
            authority = SourceAuthority(
                authority_raw.upper()
            )
            relationship = SourceRelationship(
                relationship_raw.upper()
            )
        except ValueError as exc:
            raise ValueError("External provider has invalid authority or relationship.") from exc
        direct_url = (
            str(
                raw.get("resource_url")
                or raw.get("url")
                or raw.get("direct_resource_url")
                or ""
            ).strip()
            or None
        )
        base_url = str(raw.get("base_url") or "").strip() or None
        query_endpoint = str(
            raw.get("query_endpoint")
            or raw.get("endpoint")
            or raw.get("capture_discovery_url")
            or raw.get("discovery_url")
            or ""
        ).strip() or None
        for label, value in (("resource_url", direct_url), ("base_url", base_url), ("query_endpoint", query_endpoint)):
            if value and urlsplit(value).scheme not in {"http", "https"}:
                raise ValueError(f"External provider {label} must use HTTP(S).")
        domain = str(raw.get("domain") or "").strip().lower() or None
        if not domain:
            for value in (direct_url, query_endpoint, base_url):
                if value and urlsplit(value).hostname:
                    domain = str(urlsplit(value).hostname).lower()
                    break
        raw_resources = (
            raw.get("resource_urls")
            or raw.get("resources")
            or raw.get("resource_specs")
            or ()
        )
        if isinstance(raw_resources, Mapping):
            raw_resources = (raw_resources,)
        if not domain and isinstance(raw_resources, (str, list, tuple, set, frozenset)):
            for resource_item in raw_resources:
                resource_value = (
                    resource_item.get("url")
                    or resource_item.get("resource_url")
                    or resource_item.get("query_endpoint")
                    or resource_item.get("endpoint")
                    if isinstance(resource_item, Mapping)
                    else resource_item
                )
                resource_text = str(resource_value or "").strip()
                if resource_text and urlsplit(resource_text).hostname:
                    domain = str(urlsplit(resource_text).hostname).lower()
                    break
        has_resource_urls = bool(
            raw_resources
            if isinstance(raw_resources, (str, list, tuple, set, frozenset))
            else False
        )
        if not direct_url and not base_url and not query_endpoint and not has_resource_urls:
            raise ValueError(
                f"External provider {provider_id} requires resource_url, base_url, "
                "query_endpoint or resource_urls."
            )
        retrieval_method = str(raw.get("retrieval_method") or raw.get("method") or "GET").strip().upper()
        if retrieval_method not in {"GET", "POST"}:
            raise ValueError("External provider retrieval_method must be GET or POST.")
        fields = cls._values(
            raw.get("field_groups")
            or raw.get("field_applicability")
            or raw.get("fields")
            or ("tuition",)
        )
        retrieval_type = str(
            raw.get("retrieval_type")
            or raw.get("resource_type")
            or raw.get("content_type")
            or "http"
        ).strip().casefold()
        if not retrieval_type:
            retrieval_type = "http"
        formats = cls._values(
            raw.get("formats")
            or raw.get("supported_formats")
            or raw.get("content_formats")
        )
        resolution = str(
            raw.get("resolution")
            or raw.get("source_resolution")
            or raw.get("record_resolution")
            or "unknown"
        ).strip().casefold()
        if not resolution:
            resolution = "unknown"
        identifier_mapping = raw.get("identifier_mapping") or raw.get("identifier_map") or {}
        if not isinstance(identifier_mapping, Mapping):
            raise ValueError("External provider identifier_mapping must be an object.")
        pagination = raw.get("pagination") or {}
        if not isinstance(pagination, Mapping):
            raise ValueError("External provider pagination must be an object.")
        rate_limit_policy = raw.get("rate_limit_policy") or raw.get("rate_limit") or {}
        if not isinstance(rate_limit_policy, Mapping):
            raise ValueError("External provider rate_limit_policy must be an object.")
        authentication_raw = raw.get("authentication") or {}
        if isinstance(authentication_raw, str):
            authentication_raw = {"mode": authentication_raw}
        if not isinstance(authentication_raw, Mapping):
            raise ValueError("External provider authentication must be an object or mode string.")
        authentication_mode = str(
            raw.get("authentication_mode")
            or authentication_raw.get("mode")
            or "none"
        ).strip().casefold()
        if authentication_mode not in {
            "none", "optional", "api_key_header", "api_key_query", "bearer",
            "basic", "oauth2", "custom",
        }:
            raise ValueError(
                "External provider authentication_mode must be none, optional, "
                "api_key_header, api_key_query, bearer, basic, oauth2 or custom."
            )
        resource_urls_raw = raw.get("resource_urls") or raw.get("resources") or ()
        if isinstance(resource_urls_raw, Mapping):
            resource_urls_raw = (resource_urls_raw,)
        elif isinstance(resource_urls_raw, str):
            resource_urls_raw = (resource_urls_raw,)
        resource_urls: tuple[str, ...] = ()
        resource_specs: tuple[Mapping[str, Any], ...] = ()
        if isinstance(resource_urls_raw, (list, tuple, set, frozenset)):
            specs: list[Mapping[str, Any]] = []
            urls: list[str] = []
            for value in resource_urls_raw:
                if isinstance(value, Mapping):
                    spec = dict(value)
                    resource = str(
                        spec.get("url")
                        or spec.get("resource_url")
                        or spec.get("query_endpoint")
                        or spec.get("endpoint")
                        or ""
                    ).strip()
                    if resource:
                        spec.setdefault("url", resource)
                        specs.append(spec)
                        urls.append(resource)
                elif str(value).strip():
                    resource = str(value).strip()
                    specs.append({"url": resource})
                    urls.append(resource)
            resource_specs = tuple(specs)
            resource_urls = tuple(
                urls
            )
        raw_specs = raw.get("resource_specs")
        if isinstance(raw_specs, Mapping):
            raw_specs = (raw_specs,)
        if isinstance(raw_specs, (list, tuple, set, frozenset)):
            explicit_specs = tuple(
                dict(item)
                for item in raw_specs
                if isinstance(item, Mapping)
            )
            if explicit_specs:
                resource_specs = explicit_specs
                resource_urls = tuple(
                    str(
                        item.get("url")
                        or item.get("resource_url")
                        or item.get("query_endpoint")
                        or item.get("endpoint")
                        or ""
                    ).strip()
                    for item in explicit_specs
                    if item.get("url")
                    or item.get("resource_url")
                    or item.get("query_endpoint")
                    or item.get("endpoint")
                )
        captures_raw = raw.get("captures") or raw.get("capture_urls") or ()
        if isinstance(captures_raw, str):
            captures_raw = (captures_raw,)
        captures: tuple[Mapping[str, Any], ...] = ()
        if isinstance(captures_raw, (list, tuple, set, frozenset)):
            captures = tuple(
                ({"capture_url": str(value).strip()} if not isinstance(value, Mapping) else dict(value))
                for value in captures_raw
                if (value if isinstance(value, Mapping) else str(value).strip())
            )
        try:
            max_captures = max(1, min(int(raw.get("max_captures") or 3), 50))
            max_results = max(1, min(int(raw.get("max_results") or 10), 100))
        except (TypeError, ValueError) as exc:
            raise ValueError("External provider max_captures/max_results must be integers.") from exc
        max_bytes_raw = raw.get("max_bytes")
        max_bytes: int | None = None
        if max_bytes_raw is not None and str(max_bytes_raw).strip() != "":
            try:
                max_bytes = int(max_bytes_raw)
            except (TypeError, ValueError) as exc:
                raise ValueError("External provider max_bytes must be an integer.") from exc
            if max_bytes < 1 or max_bytes > 512 * 1024 * 1024:
                raise ValueError("External provider max_bytes must be between 1 byte and 512 MiB.")
        structured_archive_raw = raw.get("structured_archive") or {}
        if not isinstance(structured_archive_raw, Mapping):
            raise ValueError("External provider structured_archive must be an object.")
        field_evidence_raw = raw.get("field_evidence") or {}
        if not isinstance(field_evidence_raw, Mapping):
            raise ValueError("External provider field_evidence must be an object.")
        # Keep pagination/rate-limit/auth metadata JSON-safe and avoid copying
        # mutable caller mappings into a frozen config object.
        pagination_dict = dict(pagination)
        rate_limit_dict = dict(rate_limit_policy)
        authentication_dict = {str(key): value for key, value in authentication_raw.items()}
        identifier_dict = {str(key): value for key, value in identifier_mapping.items()}
        max_pages_raw = pagination_dict.get("max_pages") or pagination_dict.get("pages")
        if isinstance(max_pages_raw, (int, float, str)) and not isinstance(max_pages_raw, bool):
            try:
                if int(max_pages_raw) < 1:
                    raise ValueError("External provider pagination max_pages must be positive.")
            except (TypeError, ValueError) as exc:
                if isinstance(exc, ValueError) and "positive" in str(exc):
                    raise
                raise ValueError("External provider pagination max_pages must be an integer.") from exc
        for key in ("min_interval_seconds", "requests_per_second", "max_requests"):
            value = rate_limit_dict.get(key)
            if value is None:
                continue
            try:
                numeric = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"External provider rate_limit_policy {key} must be numeric.") from exc
            if (
                numeric < 0
                or (key == "max_requests" and numeric < 1)
                or (key == "requests_per_second" and numeric <= 0)
            ):
                raise ValueError(f"External provider rate_limit_policy {key} is invalid.")
        return cls(
            provider_id=provider_id,
            source_class=source_class,
            authority=authority,
            relationship=relationship,
            countries=cls._values(raw.get("countries") or raw.get("country_codes") or raw.get("country"), upper=True),
            regions=cls._values(raw.get("regions") or raw.get("region"), upper=True),
            domain=domain,
            base_url=base_url,
            resource_url=direct_url,
            query_endpoint=query_endpoint,
            dataset_id=(str(raw["dataset_id"]).strip() if raw.get("dataset_id") else None),
            retrieval_method=retrieval_method,
            field_groups=fields or ("tuition",),
            academic_cycle=(
                str(
                    raw.get("academic_cycle")
                    or raw.get("data_year")
                    or raw.get("collection_year")
                ).strip()
                if raw.get("academic_cycle")
                or raw.get("data_year")
                or raw.get("collection_year")
                else None
            ),
            enabled=bool(raw.get("enabled", True)),
            adapter_id=(
                str(raw.get("adapter_id") or raw.get("adapter")).strip()
                if raw.get("adapter_id") or raw.get("adapter")
                else cls._default_adapter_id(source_class, relationship)
            ),
            institution_ids=cls._values(raw.get("institution_ids") or raw.get("institution_id")),
            programme_ids=cls._values(raw.get("programme_ids") or raw.get("programme_id")),
            reason=str(raw.get("reason") or "configured external provider").strip(),
            result_path=(str(raw["result_path"]).strip() if raw.get("result_path") else None),
            original_url=(str(raw["original_url"]).strip() if raw.get("original_url") else None),
            captured_at=(str(raw["captured_at"]).strip() if raw.get("captured_at") else None),
            query_parameter=(
                str(raw["query_parameter"]).strip()
                if raw.get("query_parameter")
                else None
            ),
            request_headers=(
                {str(key): str(value) for key, value in raw["request_headers"].items()}
                if isinstance(raw.get("request_headers"), Mapping)
                else {}
            ),
            request_body=raw.get("request_body"),
            accept=(str(raw["accept"]).strip() if raw.get("accept") else None),
            parameters=dict(raw.get("parameters") or {}) if isinstance(raw.get("parameters") or {}, Mapping) else {},
            name=(str(raw["name"]).strip() if raw.get("name") else None),
            provider_type=(
                str(raw.get("provider_type") or raw.get("type")).strip()
                if raw.get("provider_type") or raw.get("type")
                else None
            ),
            retrieval_type=retrieval_type,
            formats=formats,
            resolution=resolution,
            identifier_mapping=identifier_dict,
            pagination=pagination_dict,
            rate_limit_policy=rate_limit_dict,
            authentication_mode=authentication_mode,
            authentication=authentication_dict,
            resource_urls=resource_urls,
            resource_path=(str(raw["resource_path"]).strip() if raw.get("resource_path") else None),
            capture_discovery_url=(
                str(raw.get("capture_discovery_url") or raw.get("discovery_url")).strip()
                if raw.get("capture_discovery_url") or raw.get("discovery_url")
                else None
            ),
            capture_url_template=(str(raw["capture_url_template"]).strip() if raw.get("capture_url_template") else None),
            captures=captures,
            max_captures=max_captures,
            max_results=max_results,
            result_url_field=str(raw.get("result_url_field") or "url").strip() or "url",
            result_url_template=(
                str(raw["result_url_template"]).strip()
                if raw.get("result_url_template")
                else None
            ),
            collection_year=(
                str(
                    raw.get("collection_year")
                    or raw.get("data_year")
                    or raw.get("academic_cycle")
                ).strip()
                if raw.get("collection_year")
                or raw.get("data_year")
                or raw.get("academic_cycle")
                else None
            ),
            resource_specs=resource_specs,
            max_bytes=max_bytes,
            structured_archive={str(key): value for key, value in structured_archive_raw.items()},
            field_evidence={str(key): value for key, value in field_evidence_raw.items()},
            optional=bool(raw.get("optional", False)),
        )

    @classmethod
    def load_catalogue(cls, path: Path) -> tuple["ExternalProviderConfig", ...]:
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
        entries = raw.get("external_providers", raw.get("providers", raw)) if isinstance(raw, Mapping) else raw
        if not isinstance(entries, list):
            raise ValueError("External provider catalogue must contain a list.")
        return tuple(cls.from_dict(item) for item in entries if isinstance(item, Mapping))

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "source_class": self.source_class,
            "authority": self.authority.value,
            "relationship": self.relationship.value,
            "countries": list(self.countries),
            "regions": list(self.regions),
            "domain": self.domain,
            "base_url": self.base_url,
            "resource_url": self.resource_url,
            "query_endpoint": self.query_endpoint,
            "dataset_id": self.dataset_id,
            "retrieval_method": self.retrieval_method,
            "field_groups": list(self.field_groups),
            "field_applicability": list(self.field_groups),
            "academic_cycle": self.academic_cycle,
            "enabled": self.enabled,
            "adapter_id": self.adapter_id,
            "institution_ids": list(self.institution_ids),
            "programme_ids": list(self.programme_ids),
            "reason": self.reason,
            "result_path": self.result_path,
            "original_url": self.original_url,
            "captured_at": self.captured_at,
            "query_parameter": self.query_parameter,
            "request_headers": dict(self.request_headers),
            "request_body": self.request_body,
            "accept": self.accept,
            "parameters": dict(self.parameters),
            "name": self.name,
            "provider_type": self.provider_type,
            "retrieval_type": self.retrieval_type,
            "formats": list(self.formats),
            "resolution": self.resolution,
            "identifier_mapping": dict(self.identifier_mapping),
            "pagination": dict(self.pagination),
            "rate_limit_policy": dict(self.rate_limit_policy),
            "authentication_mode": self.authentication_mode,
            "authentication": dict(self.authentication),
            "resource_urls": list(self.resource_urls),
            "resource_path": self.resource_path,
            "capture_discovery_url": self.capture_discovery_url,
            "capture_url_template": self.capture_url_template,
            "captures": [dict(value) for value in self.captures],
            "max_captures": self.max_captures,
            "max_results": self.max_results,
            "result_url_field": self.result_url_field,
            "result_url_template": self.result_url_template,
            "collection_year": self.collection_year,
            "resource_specs": [dict(item) for item in self.resource_specs],
            "max_bytes": self.max_bytes,
            "structured_archive": dict(self.structured_archive),
            "field_evidence": dict(self.field_evidence),
            "optional": self.optional,
        }

    @property
    def field_applicability(self) -> tuple[str, ...]:
        """Alias used by provider catalogues that call fields applicability."""
        return self.field_groups


@dataclass(frozen=True)
class InstitutionSeed:
    institution_id: str
    name: str
    country_code: str
    official_domain: str
    homepage_url: str
    allowed_domains: tuple[str, ...] = ()
    external_source_rules: tuple[ExternalSourceRule, ...] = ()
    catalogue_hints: tuple[str, ...] = ()
    school_profile_urls: tuple[str, ...] = ()
    manual_programme_urls: tuple[str, ...] = ()
    programme_metadata: dict[str, dict[str, str]] = field(default_factory=dict)
    # Provider identifiers are entity identity data, such as a US UNITID or a
    # CRICOS code.  They are deliberately separate from programme metadata so
    # adapters can select a record without treating a source as programme
    # evidence.  Values are never facts and are not emitted as assertions.
    provider_identifiers: dict[str, dict[str, str]] = field(default_factory=dict)
    # Per-programme provider identifiers support source-native programme
    # record lookups without encoding programme-specific URLs in adapters.
    provider_programme_identifiers: dict[str, dict[str, dict[str, str]]] = field(
        default_factory=dict
    )
    programme_source_bundles: dict[str, tuple[str, ...]] = field(
        default_factory=dict
    )
    shared_admission_source_bundles: dict[str, tuple[str, ...]] = field(
        default_factory=dict
    )
    shared_source_bundles: dict[str, tuple[str, ...]] = field(
        default_factory=dict
    )
    programme_url_patterns: tuple[str, ...] = ()
    programme_priorities: tuple[ProgrammePriority, ...] = ()
    terms_status: str = "UNREVIEWED"
    terms_url: str | None = None
    enable_optional_phd: bool = False
    manual_only: bool = False
    region: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "InstitutionSeed":
        required = (
            "institution_id",
            "name",
            "country_code",
            "official_domain",
            "homepage_url",
        )
        missing = [key for key in required if not raw.get(key)]
        if missing:
            raise ValueError(
                f"Institution seed missing required fields: {', '.join(missing)}"
            )
        return cls(
            institution_id=str(raw["institution_id"]),
            name=str(raw["name"]),
            country_code=str(raw["country_code"]).upper(),
            official_domain=str(raw["official_domain"]).lower(),
            homepage_url=str(raw["homepage_url"]),
            region=(
                str(raw["region"]).strip().upper()
                if raw.get("region")
                else None
            ),
            allowed_domains=tuple(
                str(item).lower() for item in raw.get("allowed_domains", [])
            ),
            external_source_rules=tuple(
                ExternalSourceRule.from_dict(item)
                for item in raw.get("external_source_rules", [])
                if isinstance(item, dict)
            ),
            catalogue_hints=tuple(str(item) for item in raw.get("catalogue_hints", [])),
            school_profile_urls=tuple(
                str(item) for item in raw.get("school_profile_urls", [])
            ),
            manual_programme_urls=tuple(
                str(item) for item in raw.get("manual_programme_urls", [])
            ),
            programme_metadata={
                str(programme_url): {
                    str(key): str(value)
                    for key, value in metadata.items()
                    if value is not None
                }
                for programme_url, metadata in raw.get(
                    "programme_metadata", {}
                ).items()
                if isinstance(metadata, dict)
            },
            provider_identifiers={
                str(provider_id): {
                    str(key): str(value)
                    for key, value in identifiers.items()
                    if value is not None and str(value).strip()
                }
                for provider_id, identifiers in raw.get(
                    "provider_identifiers", {}
                ).items()
                if isinstance(identifiers, dict)
            },
            provider_programme_identifiers={
                str(programme_id): {
                    str(provider_id): {
                        str(key): str(value)
                        for key, value in identifiers.items()
                        if value is not None and str(value).strip()
                    }
                    for provider_id, identifiers in providers.items()
                    if isinstance(identifiers, dict)
                }
                for programme_id, providers in raw.get(
                    "provider_programme_identifiers", {}
                ).items()
                if isinstance(providers, dict)
            },
            programme_source_bundles={
                str(programme_url): tuple(str(item) for item in source_urls)
                for programme_url, source_urls in raw.get(
                    "programme_source_bundles", {}
                ).items()
                if isinstance(source_urls, list)
            },
            shared_admission_source_bundles={
                str(degree_level).lower(): tuple(
                    str(item) for item in source_urls
                )
                for degree_level, source_urls in raw.get(
                    "shared_admission_source_bundles", {}
                ).items()
                if isinstance(source_urls, list)
            },
            shared_source_bundles={
                str(degree_level).lower(): tuple(
                    str(item) for item in source_urls
                )
                for degree_level, source_urls in raw.get(
                    "shared_source_bundles", {}
                ).items()
                if isinstance(source_urls, list)
            },
            programme_url_patterns=tuple(
                str(item) for item in raw.get("programme_url_patterns", [])
            ),
            programme_priorities=tuple(
                ProgrammePriority.from_dict(item)
                for item in raw.get("programme_priorities", [])
                if isinstance(item, dict)
            ),
            terms_status=str(raw.get("terms_status", "UNREVIEWED")).upper(),
            terms_url=raw.get("terms_url"),
            enable_optional_phd=bool(raw.get("enable_optional_phd", False)),
            manual_only=bool(raw.get("manual_only", False)),
        )

    @property
    def all_allowed_domains(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys((self.official_domain, *self.allowed_domains)))

    def allowed_domains_for_adapter(self, adapter_id: str | None) -> tuple[str, ...]:
        """Return official domains plus explicitly approved related domains."""
        related = (
            rule.domain
            for rule in self.external_source_rules
            if adapter_id and rule.adapter_id == adapter_id
        )
        return tuple(dict.fromkeys((*self.all_allowed_domains, *related)))


@dataclass(frozen=True)
class SourceEcosystemConfig:
    """Runtime switches and bounded resources for the source ecosystem.

    Institution seeds remain the authority for institution identity and
    external-domain admission rules.  This object only controls which adapter
    families may participate in a run and which explicitly configured
    resources they may discover.  Resource entries are deliberately kept as
    plain mappings so provider-specific metadata can pass through unchanged.
    """

    enabled: bool = False
    runtime_acquisition_enabled: bool = False
    official_web_enabled: bool = True
    official_catalogue_enabled: bool = True
    pdf_enabled: bool = False
    structured_apis_enabled: bool = False
    government_datasets_enabled: bool = False
    government_dataset_providers: tuple[str, ...] = ()
    official_registries_enabled: bool = False
    accreditation_enabled: bool = False
    official_partners_enabled: bool = False
    archives_enabled: bool = False
    search_discovery_enabled: bool = False
    external_authoritative_enabled: bool = False
    # A bounded provider experiment may use manually supplied programme URLs
    # solely as target identifiers while prohibiting their acquisition. This
    # keeps the run on external field-bearing sources without changing normal
    # source selection for production/default runs.
    external_only: bool = False
    # Production population runs may retain every candidate in an audit
    # stream while admitting only targets with a verified programme identity
    # and exact/strong source-native binding.
    production_programmes_only: bool = False
    allow_fixture_adapters: bool = False
    acquisition_mode: str = "default"
    required_source_classes: tuple[str, ...] = ()
    field_groups: tuple[str, ...] = ("tuition",)
    target_cycle: str | None = None
    audience: str | None = None
    max_fetches_per_institution: int = 4
    official_web_resources: tuple[dict[str, Any], ...] = ()
    coursedog_candidates: tuple[dict[str, Any], ...] = ()
    pdf_candidates: tuple[dict[str, Any], ...] = ()
    json_api_resources: tuple[dict[str, Any], ...] = ()
    ipeds_candidates: tuple[dict[str, Any], ...] = ()
    scorecard_candidates: tuple[dict[str, Any], ...] = ()
    ipeds_target_config: str | None = None
    archive_candidates: tuple[dict[str, Any], ...] = ()
    search_results: tuple[dict[str, Any], ...] = ()
    search_provider: dict[str, Any] | None = None
    external_provider_catalogue_path: str | None = None
    external_provider_ids: tuple[str, ...] = ()
    external_providers: tuple[ExternalProviderConfig, ...] = ()

    @staticmethod
    def _section(raw: Mapping[str, Any], name: str) -> Mapping[str, Any]:
        value = raw.get(name, {})
        return value if isinstance(value, Mapping) else {}

    @staticmethod
    def _resources(
        section: Mapping[str, Any], *keys: str
    ) -> tuple[dict[str, Any], ...]:
        values: Any = None
        for key in keys:
            if key in section:
                values = section.get(key)
                break
        if values is None:
            return ()
        if isinstance(values, Mapping):
            values = (values,)
        if not isinstance(values, (list, tuple)):
            return ()
        return tuple(dict(item) for item in values if isinstance(item, Mapping))

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any] | None) -> "SourceEcosystemConfig":
        root = raw if isinstance(raw, Mapping) else {}
        nested = root.get("source_ecosystem")
        if isinstance(nested, Mapping):
            root = nested
        official_web = cls._section(root, "official_web")
        official_catalogue = cls._section(root, "official_catalogue")
        pdf = cls._section(root, "pdf")
        structured = cls._section(root, "structured_apis")
        government = cls._section(root, "government_datasets")
        registries = (
            cls._section(root, "official_registries")
            or cls._section(root, "registries")
            or cls._section(root, "official_registry")
        )
        accreditation = (
            cls._section(root, "accreditation")
            or cls._section(root, "accreditation_registries")
        )
        partners = (
            cls._section(root, "official_partners")
            or cls._section(root, "partners")
            or cls._section(root, "consortiums")
        )
        archives = cls._section(root, "archives")
        search = cls._section(root, "search_discovery")
        external = cls._section(root, "external_authoritative")
        provider_entries: list[Mapping[str, Any]] = []
        raw_provider_entries = root.get("external_providers", ())
        if isinstance(raw_provider_entries, Mapping):
            raw_provider_entries = (raw_provider_entries,)
        if isinstance(raw_provider_entries, (list, tuple)):
            provider_entries.extend(
                item for item in raw_provider_entries if isinstance(item, Mapping)
            )
        nested_provider_entries = external.get("providers", ())
        if isinstance(nested_provider_entries, Mapping):
            nested_provider_entries = (nested_provider_entries,)
        if isinstance(nested_provider_entries, (list, tuple)):
            provider_entries.extend(
                item for item in nested_provider_entries if isinstance(item, Mapping)
            )
        government_provider_entries = government.get("providers", ())
        if isinstance(government_provider_entries, Mapping):
            government_provider_entries = (government_provider_entries,)
        if isinstance(government_provider_entries, (list, tuple)):
            for item in government_provider_entries:
                if not isinstance(item, Mapping):
                    continue
                normalized_item = dict(item)
                normalized_item.setdefault("source_class", "government_dataset")
                normalized_item.setdefault("authority", "GOVERNMENT")
                normalized_item.setdefault("relationship", "GOVERNMENT")
                provider_entries.append(normalized_item)
        # Sections may carry inline provider resources for callers that do not
        # maintain a separate catalogue file. Normalize them into the same
        # provider contract without hard-coding URLs in pipeline code.
        inline_sections = (
            (registries, "official_registry", "GOVERNMENT", "GOVERNMENT"),
            (accreditation, "accreditation", "ACCREDITED_PROVIDER", "ACCREDITATION_BODY"),
            (partners, "official_partner", "OFFICIAL_PARTNER", "PARTNER_INSTITUTION"),
            (external, "external_authoritative", "TRUSTED_AGGREGATOR", "CATALOGUE_PROVIDER"),
            (archives, "archive", "ARCHIVE", "ARCHIVE"),
        )
        for section, default_class, default_authority, default_relationship in inline_sections:
            for item in cls._resources(section, "resources", "providers", "candidates"):
                normalized_item = dict(item)
                normalized_item.setdefault("source_class", default_class)
                normalized_item.setdefault("authority", default_authority)
                normalized_item.setdefault("relationship", default_relationship)
                provider_entries.append(normalized_item)
        provider_by_key: dict[tuple[str, str], ExternalProviderConfig] = {}
        for item in provider_entries:
            provider = ExternalProviderConfig.from_dict(item)
            provider_by_key[(provider.provider_id.casefold(), provider.adapter_id or "")] = provider
        external_providers = tuple(provider_by_key.values())
        providers = government.get("providers", ())
        if isinstance(providers, str):
            providers = (providers,)
        elif isinstance(providers, Mapping):
            providers = (providers,)
        provider_aliases = {
            "scorecard": "college_scorecard",
            "college-scorecard": "college_scorecard",
            "college scorecard": "college_scorecard",
        }
        normalized_providers = tuple(
            dict.fromkeys(
                provider_aliases.get(
                    str(provider).strip().casefold(),
                    str(provider).strip().casefold(),
                )
                for provider in providers
                if not isinstance(provider, Mapping) and str(provider).strip()
            )
        ) if isinstance(providers, (list, tuple, set, frozenset)) else ()
        field_groups = root.get("field_groups", ("tuition",))
        if isinstance(field_groups, str):
            field_groups = (field_groups,)
        normalized_fields = tuple(
            dict.fromkeys(
                str(field).strip()
                for field in field_groups
                if str(field).strip()
            )
        ) if isinstance(field_groups, (list, tuple, set, frozenset)) else ("tuition",)
        max_fetches = int(root.get("max_fetches_per_institution", 4) or 4)
        if max_fetches < 1:
            raise ValueError("source_ecosystem max_fetches_per_institution must be positive.")
        acquisition_mode = str(
            root.get("acquisition_mode") or root.get("mode") or "default"
        ).strip().casefold()
        if acquisition_mode not in {"default", "external_source_expansion"}:
            raise ValueError(
                "source_ecosystem acquisition_mode must be default or external_source_expansion."
            )
        required_classes = root.get("required_source_classes", ())
        if isinstance(required_classes, str):
            required_classes = (required_classes,)
        normalized_required_classes = tuple(
            dict.fromkeys(
                str(value).strip().casefold()
                for value in required_classes
                if str(value).strip()
            )
        ) if isinstance(required_classes, (list, tuple, set, frozenset)) else ()
        provider_ids = root.get("external_provider_ids") or root.get("provider_ids") or ()
        if isinstance(provider_ids, str):
            provider_ids = (provider_ids,)
        normalized_provider_ids = tuple(
            dict.fromkeys(
                str(value).strip().casefold()
                for value in provider_ids
                if str(value).strip()
            )
        ) if isinstance(provider_ids, (list, tuple, set, frozenset)) else ()

        # External-authoritative resources use the same safe adapter contracts
        # as configured API/PDF resources.  They remain subject to the
        # institution seed's ExternalSourceRule at admission time.
        external_resources = cls._resources(external, "resources")
        web_resources = list(cls._resources(official_web, "resources", "candidates"))
        coursedog_resources = list(
            cls._resources(official_catalogue, "coursedog_candidates")
        )
        for item in cls._resources(official_catalogue, "resources"):
            adapter = str(item.get("adapter_id") or item.get("adapter") or "").casefold()
            provider = str(item.get("provider_id") or item.get("provider") or "").casefold()
            if adapter in {"coursedog", "coursedog_catalogue"} or provider == "coursedog":
                coursedog_resources.append(item)
            else:
                generic_catalogue = dict(item)
                generic_catalogue.setdefault("source_class", "official_catalogue")
                web_resources.append(generic_catalogue)
        json_resources = list(
            cls._resources(structured, "resources", "json_api_resources")
        )
        pdf_resources = list(cls._resources(pdf, "resources", "candidates"))
        for item in external_resources:
            adapter = str(item.get("adapter_id") or item.get("adapter") or "").casefold()
            if adapter in {"json_api", "official_api"}:
                json_resources.append(item)
            elif adapter in {"pdf", "pdf_document"}:
                pdf_resources.append(item)
            elif adapter in {
                "manual_source",
                "official_web",
                "official_finance",
                "government_portal",
                "partner_institution",
            }:
                # These resources use the same URL-safe manual adapter while
                # retaining their configured source class and relationship.
                web_resources.append(item)

        return cls(
            enabled=bool(root.get("enabled", False)),
            runtime_acquisition_enabled=bool(
                root.get("runtime_acquisition_enabled", root.get("enabled", False))
            ),
            official_web_enabled=bool(official_web.get("enabled", True)),
            official_catalogue_enabled=bool(
                official_catalogue.get("enabled", official_web.get("enabled", True))
            ),
            pdf_enabled=bool(pdf.get("enabled", False)),
            structured_apis_enabled=bool(structured.get("enabled", False)),
            government_datasets_enabled=bool(government.get("enabled", False)),
            government_dataset_providers=normalized_providers,
            official_registries_enabled=bool(registries.get("enabled", False)),
            accreditation_enabled=bool(accreditation.get("enabled", False)),
            official_partners_enabled=bool(partners.get("enabled", False)),
            archives_enabled=bool(archives.get("enabled", False)),
            search_discovery_enabled=bool(search.get("enabled", False)),
            external_authoritative_enabled=bool(external.get("enabled", False)),
            external_only=bool(root.get("external_only", False)),
            production_programmes_only=bool(
                root.get("production_programmes_only", False)
            ),
            allow_fixture_adapters=bool(root.get("allow_fixture_adapters", False)),
            acquisition_mode=acquisition_mode,
            required_source_classes=normalized_required_classes,
            field_groups=normalized_fields or ("tuition",),
            target_cycle=(
                str(root["target_cycle"]).strip()
                if root.get("target_cycle")
                else None
            ),
            audience=(
                str(root["audience"]).strip()
                if root.get("audience")
                else None
            ),
            max_fetches_per_institution=max_fetches,
            official_web_resources=tuple(web_resources),
            coursedog_candidates=tuple(coursedog_resources),
            pdf_candidates=tuple(pdf_resources),
            json_api_resources=tuple(json_resources),
            ipeds_candidates=cls._resources(
                government, "ipeds_candidates", "ipeds_resources"
            ),
            scorecard_candidates=cls._resources(
                government, "scorecard_candidates", "scorecard_resources"
            ),
            ipeds_target_config=(
                str(government["ipeds_target_config"]).strip()
                if government.get("ipeds_target_config")
                else None
            ),
            archive_candidates=cls._resources(archives, "resources", "candidates"),
            search_results=cls._resources(search, "results", "resources"),
            search_provider=(
                dict(search.get("provider"))
                if isinstance(search.get("provider"), Mapping)
                else None
            ),
            external_provider_catalogue_path=(
                str(
                    root.get("external_provider_catalogue")
                    or root.get("external_providers_file")
                ).strip()
                if root.get("external_provider_catalogue") or root.get("external_providers_file")
                else None
            ),
            external_provider_ids=normalized_provider_ids,
            external_providers=external_providers,
        )

    @staticmethod
    def _for_institution(
        resources: tuple[dict[str, Any], ...], institution_id: str | None
    ) -> tuple[dict[str, Any], ...]:
        if not institution_id:
            return resources
        selected: list[dict[str, Any]] = []
        for item in resources:
            scope = item.get("institution_id", item.get("institution_ids"))
            if scope is None:
                selected.append(dict(item))
            elif isinstance(scope, (list, tuple, set, frozenset)):
                if institution_id in {str(value) for value in scope}:
                    selected.append(dict(item))
            elif str(scope) == institution_id:
                selected.append(dict(item))
        return tuple(selected)

    def adapter_configuration(self, institution_id: str | None = None) -> dict[str, Any]:
        """Return adapter inputs for one institution without mutating config."""
        return {
            "source_ecosystem_enabled": self.enabled,
            "source_ecosystem_runtime_acquisition": self.runtime_acquisition_enabled,
            "source_ecosystem_field_groups": self.field_groups,
            "source_ecosystem_target_cycle": self.target_cycle,
            "source_ecosystem_audience": self.audience,
            "source_ecosystem_acquisition_mode": self.acquisition_mode,
            "source_ecosystem_required_source_classes": self.required_source_classes,
            "source_ecosystem_external_provider_ids": self.external_provider_ids,
            "source_ecosystem_official_registries_enabled": self.official_registries_enabled,
            "source_ecosystem_accreditation_enabled": self.accreditation_enabled,
            "source_ecosystem_official_partners_enabled": self.official_partners_enabled,
            "official_web_resources": self._for_institution(
                self.official_web_resources, institution_id
            ),
            "coursedog_candidates": self._for_institution(
                self.coursedog_candidates, institution_id
            ),
            "pdf_candidates": self._for_institution(
                self.pdf_candidates, institution_id
            ),
            "json_api_resources": self._for_institution(
                self.json_api_resources, institution_id
            ),
            "ipeds_candidates": self._for_institution(
                self.ipeds_candidates, institution_id
            ),
            "scorecard_candidates": self._for_institution(
                self.scorecard_candidates, institution_id
            ),
            "ipeds_target_config": self.ipeds_target_config,
            "archive_candidates": self._for_institution(
                self.archive_candidates, institution_id
            ),
            "search_results": self._for_institution(
                self.search_results, institution_id
            ),
            "search_provider": dict(self.search_provider) if self.search_provider else None,
            "external_providers": tuple(
                provider.to_dict()
                for provider in self.external_providers
                if not institution_id
                or not provider.institution_ids
                or institution_id in provider.institution_ids
            )
            if not self.external_provider_ids
            else tuple(
                provider.to_dict()
                for provider in self.external_providers
                if provider.provider_id.casefold() in set(self.external_provider_ids)
                and (
                    not institution_id
                    or not provider.institution_ids
                    or institution_id in provider.institution_ids
                )
            ),
        }


@dataclass(frozen=True)
class SmokeConfig:
    run_name: str
    institutions: tuple[InstitutionSeed, ...]
    limits: CrawlLimits = field(default_factory=CrawlLimits)
    deepseek_flash_model: str = "deepseek-v4-flash"
    deepseek_pro_model: str = "deepseek-v4-pro"
    deepseek_base_url: str = "https://api.deepseek.com"
    raw_evidence_mode: str = "local"
    raw_evidence_inline_max_bytes: int = 8 * 1024 * 1024
    acquisition_backend: str = "legacy"
    source_ecosystem: SourceEcosystemConfig = field(
        default_factory=SourceEcosystemConfig
    )

    def __post_init__(self) -> None:
        if self.raw_evidence_mode not in {"local", "remote", "dual"}:
            raise ValueError(
                "raw_evidence_mode must be local, remote or dual."
            )
        if not 0 < self.raw_evidence_inline_max_bytes <= 12 * 1024 * 1024:
            raise ValueError(
                "raw_evidence_inline_max_bytes must be between 1 byte and 12 MiB."
            )
        if self.acquisition_backend not in {"legacy", "platform_shadow"}:
            raise ValueError(
                "acquisition_backend must be legacy or platform_shadow."
            )

    @classmethod
    def load(
        cls,
        institutions_path: Path,
        limits_path: Path | None = None,
    ) -> "SmokeConfig":
        with institutions_path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)

        limit_raw: dict[str, Any] = {}
        if limits_path:
            with limits_path.open("r", encoding="utf-8") as handle:
                limit_raw = json.load(handle)
        elif isinstance(raw.get("limits"), dict):
            limit_raw = raw["limits"]
        for env_name, field_name in (
            ("LARGE_RAW_OBJECT_THRESHOLD_BYTES", "large_raw_object_threshold_bytes"),
            ("MAX_LOCAL_TEMP_BYTES", "max_local_temp_bytes"),
        ):
            if os.environ.get(env_name, "").strip():
                try:
                    limit_raw[field_name] = int(os.environ[env_name])
                except ValueError as exc:
                    raise ValueError(f"{env_name} must be an integer.") from exc

        institutions = tuple(
            InstitutionSeed.from_dict(item) for item in raw.get("institutions", [])
        )
        if not institutions:
            raise ValueError("Smoke config must contain at least one institution.")

        raw_evidence_mode = os.environ.get(
            "RAW_EVIDENCE_MODE", raw.get("raw_evidence_mode", "local")
        ).strip().lower()
        inline_limit_raw = os.environ.get(
            "RAW_EVIDENCE_INLINE_MAX_BYTES",
            raw.get("raw_evidence_inline_max_bytes", 8 * 1024 * 1024),
        )
        source_ecosystem = SourceEcosystemConfig.from_dict(
            raw.get("source_ecosystem")
        )
        catalogue_path = source_ecosystem.external_provider_catalogue_path
        if catalogue_path:
            provider_path = Path(catalogue_path)
            if not provider_path.is_absolute():
                provider_path = institutions_path.parent / provider_path
            catalogue_providers = ExternalProviderConfig.load_catalogue(
                provider_path.resolve()
            )
            if source_ecosystem.external_provider_ids:
                allowed_provider_ids = set(source_ecosystem.external_provider_ids)
                catalogue_providers = tuple(
                    provider
                    for provider in catalogue_providers
                    if provider.provider_id.casefold() in allowed_provider_ids
                )
            source_ecosystem = replace(
                source_ecosystem,
                external_providers=tuple(
                    {
                        (provider.provider_id, provider.adapter_id): provider
                        for provider in (
                            *source_ecosystem.external_providers,
                            *catalogue_providers,
                        )
                        }.values()
                ),
                external_provider_catalogue_path=str(provider_path.resolve()),
            )
        if source_ecosystem.external_provider_ids:
            allowed_provider_ids = set(source_ecosystem.external_provider_ids)
            source_ecosystem = replace(
                source_ecosystem,
                external_providers=tuple(
                    provider
                    for provider in source_ecosystem.external_providers
                    if provider.provider_id.casefold() in allowed_provider_ids
                ),
            )
        if source_ecosystem.ipeds_target_config:
            target_config = Path(source_ecosystem.ipeds_target_config)
            if not target_config.is_absolute():
                source_ecosystem = replace(
                    source_ecosystem,
                    ipeds_target_config=str(
                        (institutions_path.parent / target_config).resolve()
                    ),
                )
        return cls(
            run_name=str(raw.get("run_name", "local-smoke")),
            institutions=institutions,
            limits=CrawlLimits.from_dict(limit_raw),
            deepseek_flash_model=str(
                raw.get("deepseek_flash_model", "deepseek-v4-flash")
            ),
            deepseek_pro_model=str(
                raw.get("deepseek_pro_model", "deepseek-v4-pro")
            ),
            deepseek_base_url=str(
                raw.get("deepseek_base_url", "https://api.deepseek.com")
            ).rstrip("/"),
            raw_evidence_mode=raw_evidence_mode,
            raw_evidence_inline_max_bytes=int(inline_limit_raw),
            acquisition_backend=os.environ.get(
                "ACQUISITION_BACKEND", raw.get("acquisition_backend", "legacy")
            ).strip().lower(),
            source_ecosystem=source_ecosystem,
        )


def load_dotenv_if_present(path: Path, *, override: bool = False) -> None:
    """Load a small .env-style file without logging or overwriting real env vars."""
    if not path.exists():
        return
    file_values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            # Last assignment in the file wins, while an explicitly supplied
            # process environment still wins unless override=True.
            file_values[key] = value
    for key, value in file_values.items():
        if override or key not in os.environ:
            os.environ[key] = value
