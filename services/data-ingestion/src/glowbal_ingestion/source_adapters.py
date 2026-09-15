"""Field-directed source acquisition primitives for the Slice B shadow path.

The module intentionally stops at discovered/admitted sources.  It neither
extracts assertions nor changes canonical/promotion behaviour.  Existing
native discovery remains the operational implementation behind the official
catalogue adapter while this layer records why an evidence source is eligible.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Protocol, Sequence, runtime_checkable
from urllib.parse import urljoin, urlsplit

from .acquisition import (
    AcquisitionAttempt,
    AcquisitionFailureCode,
    AcquisitionIntent,
    EntityRef,
    SourceCandidate,
)
from .config import (
    ExternalProviderConfig,
    ExternalSourceRule,
    InstitutionSeed,
    SourceEcosystemConfig,
)
from .discovery import CatalogueDiscovery, ProgrammeCandidate
from .external_sources import (
    AccreditationRegistryAdapter,
    ArchiveSourceAdapter,
    ExternalAuthoritativeAdapter,
    GovernmentDatasetAdapter,
    HttpSearchProvider,
    OfficialRegistryAdapter,
    PartnerSourceAdapter,
    SourceClassCoverageGate,
    SourceClassExecutionState,
    _authentication_headers,
    _pagination_urls,
    provider_request_url,
    sanitize_provider_fetch_result,
    _provider_resource_specs,
    provider_is_enabled,
    normalize_source_class,
)
from .fetcher import FetchError, SafeFetcher
from .models import (
    FetchResult,
    RawDocument,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    stable_id,
    utc_now_iso,
)
from .raw_evidence import (
    RawEvidenceDurability,
    RawEvidenceError,
    RawEvidenceStore,
    RawSnapshotInput,
    RawSnapshotStreamInput,
    source_identity_for_url,
)
from .source_graph import (
    admission_row,
    attempt_row,
    candidate_row,
    discovery_evidence_row,
    intent_row,
)
from .url_safety import UnsafeUrlError, canonicalize_url, hostname_matches


URL_LOCATOR_TYPES = frozenset({"url", "pdf", "json_api", "archive", "archive_discovery", "manual", "provider_resource"})


def _is_url_locator(candidate: SourceCandidate) -> bool:
    if candidate.locator_type in URL_LOCATOR_TYPES:
        return True
    return candidate.locator_type == "provider_resource" and urlsplit(
        candidate.canonical_locator
    ).scheme.casefold() in {"http", "https"}


def _candidate_fetch_kwargs(candidate: SourceCandidate) -> dict[str, object]:
    """Translate provider request metadata into the SafeFetcher contract."""
    metadata = candidate.adapter_metadata
    kwargs: dict[str, object] = {}
    method = str(metadata.get("retrieval_method") or "GET").upper()
    if method in {"GET", "POST"}:
        kwargs["method"] = method
    accept = metadata.get("accept")
    if accept:
        kwargs["accept"] = str(accept)
    max_bytes = metadata.get("max_bytes")
    if max_bytes is not None and str(max_bytes).strip() != "":
        try:
            bounded = int(max_bytes)
        except (TypeError, ValueError):
            bounded = 0
        if bounded > 0:
            kwargs["max_bytes"] = bounded
    request_headers = metadata.get("request_headers")
    if isinstance(request_headers, Mapping):
        resolved: dict[str, str] = {}
        for key, value in request_headers.items():
            text_value = str(value)
            if text_value.startswith("ENV:"):
                text_value = os.environ.get(text_value[4:], "")
            if text_value:
                resolved[str(key)] = text_value
        if resolved:
            kwargs["request_headers"] = resolved
    authentication_headers = _authentication_headers(metadata)
    if authentication_headers:
        headers = dict(kwargs.get("request_headers") or {})
        headers.update(authentication_headers)
        kwargs["request_headers"] = headers
    # API-key query authentication is applied immediately before the request;
    # retain only the environment reference in candidate metadata.
    rate_limit_policy = metadata.get("rate_limit_policy")
    if isinstance(rate_limit_policy, Mapping):
        kwargs["rate_limit_policy"] = dict(rate_limit_policy)
    body = metadata.get("request_body")
    if body is not None:
        if isinstance(body, bytes):
            kwargs["data"] = body
        elif isinstance(body, (dict, list)):
            kwargs["data"] = json.dumps(body).encode("utf-8")
            headers = dict(kwargs.get("request_headers") or {})
            headers.setdefault("Content-Type", "application/json")
            kwargs["request_headers"] = headers
    return kwargs


def _candidate_requires_streaming(candidate: SourceCandidate, fetcher: SafeFetcher) -> bool:
    """Keep declared large/bulk resources out of the byte-oriented path."""
    metadata = candidate.adapter_metadata
    if bool(metadata.get("streaming_required") or metadata.get("large_object")):
        return True
    try:
        configured_max = int(metadata.get("max_bytes") or 0)
    except (TypeError, ValueError):
        configured_max = 0
    threshold = int(
        getattr(
            fetcher.limits,
            "large_raw_object_threshold_bytes",
            8 * 1024 * 1024,
        )
    )
    retrieval_type = str(
        metadata.get("retrieval_type") or metadata.get("resource_type") or ""
    ).casefold()
    suffix = urlsplit(candidate.canonical_locator).path.casefold()
    return configured_max >= threshold and (
        retrieval_type in {"zip", "bulk", "large_csv", "large_json", "large_xml"}
        or suffix.endswith((".zip", ".csv", ".tsv", ".xml", ".jsonl"))
    )


def _candidate_lineage_kwargs(candidate: SourceCandidate) -> dict[str, object]:
    """Copy non-secret source lineage onto acquisition attempts."""
    metadata = candidate.adapter_metadata
    return {
        "source_resolution": candidate.source_resolution or metadata.get("source_resolution"),
        "original_url": candidate.original_url or metadata.get("original_url"),
        "capture_url": candidate.capture_url or metadata.get("capture_url"),
        "captured_at": candidate.captured_at or metadata.get("captured_at"),
        "archive_provider": candidate.archive_provider or metadata.get("archive_provider"),
        "temporal_state": candidate.temporal_state,
    }


def _enum_value(
    value: Any,
    enum_type: type[SourceAuthority] | type[SourceRelationship],
    default: Any,
) -> Any:
    """Parse configured provenance without making invalid values look official."""
    if value is None or str(value).strip() == "":
        return default
    if isinstance(value, enum_type):
        return value
    value = getattr(value, "value", value)
    try:
        return enum_type(str(value).strip().upper())
    except ValueError:
        return None


def _relationship_evidence(item: Mapping[str, Any], default: tuple[str, ...]) -> tuple[str, ...]:
    raw = item.get("relationship_evidence")
    if isinstance(raw, str):
        return (raw,) if raw.strip() else default
    if isinstance(raw, (list, tuple, set, frozenset)):
        values = tuple(str(value).strip() for value in raw if str(value).strip())
        return values or default
    return default


def _routed_provider_fields(
    item: Mapping[str, Any],
    intent: AcquisitionIntent,
    context: "SourceAdapterContext",
) -> tuple[str, ...] | None:
    """Return the configured/requested overlap for routed provider resources."""
    configured = item.get("field_groups") or item.get("field_applicability") or ()
    if isinstance(configured, str):
        configured = (configured,)
    fields = tuple(
        str(value).strip()
        for value in configured
        if str(value).strip()
    )
    if not context.configuration.get("enforce_provider_field_routing"):
        return fields or tuple(intent.field_groups)
    requested = {
        str(value).strip().casefold()
        for value in intent.field_groups
        if str(value).strip()
    }
    overlap = tuple(value for value in fields if value.casefold() in requested)
    return overlap or None


def _nested_result_value(item: Mapping[str, Any], path: str) -> Any:
    """Read a dotted/indexed result field without interpreting its contents."""
    value: Any = item
    for part in str(path or "").split("."):
        if isinstance(value, Mapping):
            value = value.get(part)
        elif isinstance(value, (list, tuple)) and part.isdigit():
            index = int(part)
            value = value[index] if 0 <= index < len(value) else None
        else:
            return None
    return value


@dataclass(frozen=True)
class SourceAdapterContext:
    entity: EntityRef
    seed: InstitutionSeed | None = None
    target_cycle: str | None = None
    audience: str | None = None
    field_groups: tuple[str, ...] = ()
    configuration: Mapping[str, Any] = field(default_factory=dict)


@runtime_checkable
class SourceAdapter(Protocol):
    """Discover candidates only; adapters cannot submit facts or promotions."""

    adapter_id: str
    priority: int

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool: ...

    def discover(
        self, intent: AcquisitionIntent, context: SourceAdapterContext
    ) -> list[SourceCandidate]: ...


class SearchProvider(Protocol):
    provider_id: str

    def search(self, query: str) -> Sequence[Mapping[str, str]]: ...


def _preferred_source_class(
    intent: AcquisitionIntent,
    adapter_source_classes: Iterable[str],
) -> str | None:
    """Choose one stable source class for adapter-level attempt telemetry."""
    preferred = tuple(
        normalize_source_class(value, "")
        for value in intent.preferred_source_classes
        if str(value).strip()
    )
    available = tuple(
        normalize_source_class(value, "")
        for value in adapter_source_classes
        if str(value).strip()
    )
    for source_class in preferred:
        if source_class in available:
            return source_class
    return available[0] if available else (preferred[0] if preferred else None)


class ArchiveAdapter(Protocol):
    adapter_id: str

    def discover_archive(
        self, intent: AcquisitionIntent, context: SourceAdapterContext
    ) -> list[SourceCandidate]: ...


@dataclass(frozen=True)
class SourceAdmissionDecision:
    candidate: SourceCandidate
    admitted: bool
    reason: str
    factor_scores: Mapping[str, int]
    total_score: int
    allowed_domains: tuple[str, ...] = ()

    def to_attempt(
        self, *, intent_id: str | None, run_id: str | None = None
    ) -> AcquisitionAttempt:
        candidate = self.candidate
        return AcquisitionAttempt.create(
            intent_id=intent_id,
            candidate_id=candidate.candidate_id,
            status="ADMITTED" if self.admitted else "REJECTED_BY_POLICY",
            run_id=run_id,
            error_code=(
                None
                if self.admitted
                else AcquisitionFailureCode.SOURCE_REJECTED_BY_POLICY
            ),
            retryable=False,
            admission_reason=self.reason,
            adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            execution_state="ADMITTED" if self.admitted else "HARD_BLOCKED",
            source_resolution=candidate.source_resolution or candidate.adapter_metadata.get("source_resolution"),
            original_url=candidate.original_url or candidate.adapter_metadata.get("original_url"),
            capture_url=candidate.capture_url or candidate.adapter_metadata.get("capture_url"),
            captured_at=candidate.captured_at or candidate.adapter_metadata.get("captured_at"),
            archive_provider=candidate.archive_provider or candidate.adapter_metadata.get("archive_provider"),
            temporal_state=candidate.temporal_state,
        )


class SourceRegistry:
    """A deterministic registry; priority then adapter id defines execution."""

    def __init__(self, adapters: Iterable[SourceAdapter] = ()) -> None:
        self._adapters: dict[str, SourceAdapter] = {}
        for adapter in adapters:
            self.register(adapter)

    def register(self, adapter: SourceAdapter) -> None:
        if not adapter.adapter_id.strip():
            raise ValueError("Source adapter requires adapter_id.")
        if adapter.adapter_id in self._adapters:
            raise ValueError(f"Source adapter already registered: {adapter.adapter_id}")
        self._adapters[adapter.adapter_id] = adapter

    def ordered(self) -> tuple[SourceAdapter, ...]:
        return tuple(sorted(self._adapters.values(), key=lambda item: (item.priority, item.adapter_id)))

    @property
    def adapter_ids(self) -> tuple[str, ...]:
        """Stable introspection used by startup diagnostics and smoke checks."""
        return tuple(adapter.adapter_id for adapter in self.ordered())

    def adapters_for(
        self, intent: AcquisitionIntent, context: SourceAdapterContext
    ) -> tuple[SourceAdapter, ...]:
        return tuple(adapter for adapter in self.ordered() if adapter.supports(intent, context))

    def discover(
        self,
        intent: AcquisitionIntent,
        context: SourceAdapterContext,
        *,
        only_adapter_ids: Iterable[str] | None = None,
    ) -> tuple[list[SourceCandidate], list[AcquisitionAttempt]]:
        candidates: list[SourceCandidate] = []
        attempts: list[AcquisitionAttempt] = []
        adapters = self.adapters_for(intent, context)
        if only_adapter_ids is not None:
            allowed = {str(adapter_id) for adapter_id in only_adapter_ids}
            adapters = tuple(
                adapter for adapter in adapters if adapter.adapter_id in allowed
            )
        if not adapters:
            attempts.append(AcquisitionAttempt.create(
                intent_id=intent.intent_id, candidate_id=None, status="NO_SUPPORTED_ADAPTER",
                error_code=AcquisitionFailureCode.NO_SOURCE_CANDIDATES,
                source_class=_preferred_source_class(intent, ()),
                execution_state="HARD_BLOCKED",
                discriminator="no-supported-adapter",
            ))
            return candidates, attempts
        for adapter in adapters:
            adapter_source_class = _preferred_source_class(
                intent,
                getattr(adapter, "source_classes", ()),
            )
            try:
                found = adapter.discover(intent, context)
            except Exception:
                # Adapter details belong in adapter telemetry; staging receives a
                # stable, non-secret classification.
                attempts.append(AcquisitionAttempt.create(
                    intent_id=intent.intent_id, candidate_id=None,
                    status="DISCOVERY_FAILED",
                    error_code=AcquisitionFailureCode.SOURCE_DISCOVERY_FAILED,
                    retryable=True,
                    adapter_id=adapter.adapter_id,
                    source_class=adapter_source_class,
                    execution_state="HARD_BLOCKED",
                    discriminator="adapter-discovery",
                ))
                continue
            candidates.extend(found)
            attempts.append(AcquisitionAttempt.create(
                intent_id=intent.intent_id, candidate_id=None,
                status="DISCOVERED" if found else "NO_CANDIDATES",
                error_code=(None if found else AcquisitionFailureCode.NO_SOURCE_CANDIDATES),
                adapter_id=adapter.adapter_id,
                source_class=adapter_source_class,
                execution_state="CANDIDATES_FOUND" if found else "NO_YIELD",
                discriminator="adapter-discovery",
            ))
        return candidates, attempts


_AUTHORITY_SCORE = {
    SourceAuthority.OFFICIAL: 50,
    SourceAuthority.GOVERNMENT: 48,
    SourceAuthority.OFFICIAL_PARTNER: 43,
    SourceAuthority.ACCREDITED_PROVIDER: 35,
    SourceAuthority.TRUSTED_AGGREGATOR: 20,
    SourceAuthority.ARCHIVE: 12,
    SourceAuthority.OTHER: 5,
}
_RELATIONSHIP_SCORE = {
    SourceRelationship.DIRECT_OFFICIAL: 25,
    SourceRelationship.CENTRAL_ADMISSIONS: 24,
    SourceRelationship.INTERNATIONAL_ADMISSIONS: 24,
    SourceRelationship.FINANCE_OFFICE: 24,
    SourceRelationship.DEPARTMENT: 20,
    SourceRelationship.PARENT_INSTITUTION: 18,
    SourceRelationship.GOVERNMENT: 22,
    SourceRelationship.SCHOLARSHIP_PROVIDER: 20,
    SourceRelationship.PARTNER_INSTITUTION: 16,
    SourceRelationship.CONSORTIUM: 15,
    SourceRelationship.CATALOGUE_PROVIDER: 14,
    SourceRelationship.ACCREDITATION_BODY: 15,
    SourceRelationship.ARCHIVE: 0,
    SourceRelationship.AGGREGATOR: 5,
    SourceRelationship.OTHER_RELATED: 4,
}


class SourceResolver:
    """Admission and ranking policy with independent, inspectable factors."""

    def __init__(self, *, minimum_score: int = 1) -> None:
        self.minimum_score = minimum_score

    @staticmethod
    def _external_rule(
        candidate: SourceCandidate, seed: InstitutionSeed
    ) -> ExternalSourceRule | None:
        host = urlsplit(candidate.canonical_locator).hostname or ""
        # A configured provider may expose a generic adapter family (for
        # example ``search_index``) while the institution rule names the
        # provider's explicit adapter identity.  Preserve the concrete
        # candidate adapter for provenance, but allow the provider-declared
        # identity to satisfy the explicit admission rule as well.
        candidate_adapter_ids = {candidate.adapter_id}
        configured_adapter_id = candidate.adapter_metadata.get("configured_adapter_id")
        if configured_adapter_id:
            candidate_adapter_ids.add(str(configured_adapter_id).strip())
        for rule in seed.external_source_rules:
            if (
                rule.adapter_id in candidate_adapter_ids
                and hostname_matches(host, (rule.domain,))
                and candidate.relationship == rule.relationship
                and candidate.declared_authority == rule.authority
                and (
                    not rule.provider_id
                    or candidate.provider_id == rule.provider_id
                )
            ):
                return rule
        return None

    def evaluate(
        self,
        candidate: SourceCandidate,
        *,
        seed: InstitutionSeed | None,
        intent: AcquisitionIntent | None = None,
    ) -> SourceAdmissionDecision:
        normalized = candidate
        if _is_url_locator(candidate):
            try:
                normalized = replace(candidate, canonical_locator=canonicalize_url(candidate.canonical_locator))
            except UnsafeUrlError:
                return SourceAdmissionDecision(candidate, False, "INVALID_URL", {}, 0)
        rule: ExternalSourceRule | None = None
        allowed_domains: tuple[str, ...] = ()
        if seed and _is_url_locator(normalized):
            host = urlsplit(normalized.canonical_locator).hostname or ""
            if hostname_matches(host, seed.all_allowed_domains):
                allowed_domains = seed.all_allowed_domains
            else:
                rule = self._external_rule(normalized, seed)
                if not rule:
                    return SourceAdmissionDecision(normalized, False, "EXTERNAL_DOMAIN_NOT_EXPLICITLY_ALLOWED", {}, 0)
                if not normalized.relationship_evidence:
                    return SourceAdmissionDecision(normalized, False, "RELATED_SOURCE_REQUIRES_RELATIONSHIP_EVIDENCE", {}, 0)
                if normalized.discovery_method == "text_mention":
                    return SourceAdmissionDecision(normalized, False, "TEXT_MENTION_IS_NOT_FETCH_ADMISSION", {}, 0)
                if normalized.discovery_method == "search_snippet":
                    # A search hit is admissible as a fetch candidate when its
                    # URL/domain and relationship rule pass. It remains
                    # snippet-only until the authoritative URL is retrieved.
                    normalized = replace(
                        normalized,
                        adapter_metadata={
                            **normalized.adapter_metadata,
                            "requires_authoritative_fetch": True,
                            "snippet_is_not_evidence": True,
                        },
                    )
                # A rule is a narrow admission grant, not a grant for every
                # external domain that happens to share its adapter id.
                allowed_domains = tuple(
                    dict.fromkeys((*seed.all_allowed_domains, rule.domain))
                )
        candidate_authority = normalized.declared_authority or SourceAuthority.OTHER
        if intent and intent.minimum_authority:
            if _AUTHORITY_SCORE[candidate_authority] < _AUTHORITY_SCORE[intent.minimum_authority]:
                return SourceAdmissionDecision(
                    normalized,
                    False,
                    "AUTHORITY_BELOW_MINIMUM",
                    {"authority": _AUTHORITY_SCORE[candidate_authority]},
                    _AUTHORITY_SCORE[candidate_authority],
                    allowed_domains,
                )
        if normalized.temporal_state == TemporalState.HISTORICAL and normalized.declared_authority == SourceAuthority.ARCHIVE:
            # Historical evidence is admissible for audit/reprocessing, but it
            # carries no implicit current applicability.
            temporal_score = 0
        else:
            temporal_score = {TemporalState.CURRENT: 10, TemporalState.FUTURE: 6,
                              TemporalState.UNKNOWN: 3, TemporalState.HISTORICAL: 0}[normalized.temporal_state]
        expected = set(intent.field_groups if intent else ())
        relevance = min(20, 5 * len(expected.intersection(normalized.expected_field_groups)))
        authority = _AUTHORITY_SCORE.get(candidate_authority, 0)
        relationship = _RELATIONSHIP_SCORE.get(normalized.relationship or SourceRelationship.OTHER_RELATED, 0)
        applicability = 5 if (not intent or not intent.target_cycle or not normalized.academic_cycle or intent.target_cycle == normalized.academic_cycle) else -10
        factors = {"authority": authority, "relationship": relationship, "temporal": temporal_score,
                   "relevance": relevance, "applicability": applicability}
        total = sum(factors.values())
        return SourceAdmissionDecision(
            normalized, total >= self.minimum_score, "ADMITTED" if total >= self.minimum_score else "SCORE_BELOW_POLICY_MINIMUM",
            factors, total, allowed_domains,
        )

    def resolve(
        self,
        candidates: Iterable[SourceCandidate],
        *,
        seed: InstitutionSeed | None,
        intent: AcquisitionIntent | None = None,
    ) -> list[SourceAdmissionDecision]:
        decisions = [self.evaluate(candidate, seed=seed, intent=intent) for candidate in candidates]
        # A provider resource and a URL can represent one source. Dedupe only
        # candidates, never RawDocument observations/snapshots.
        selected: dict[tuple[str, str, str], SourceAdmissionDecision] = {}
        rejected: list[SourceAdmissionDecision] = []
        for decision in decisions:
            if not decision.admitted:
                rejected.append(decision)
                continue
            candidate = decision.candidate
            key = (candidate.provider_id or "", candidate.dataset_id or "", candidate.canonical_locator)
            current = selected.get(key)
            if current is None or decision.total_score > current.total_score:
                selected[key] = decision
        return sorted((*selected.values(), *rejected), key=lambda item: (not item.admitted, -item.total_score, item.candidate.candidate_id))


class AcquisitionPlanner:
    """Maps an information need to an ordered source-class plan without I/O."""

    _FIELD_PLANS: Mapping[str, tuple[str, ...]] = {
        "tuition": ("official_finance", "official_web", "government_dataset", "pdf", "archive"),
        "finance": ("official_finance", "official_web", "government_dataset", "pdf", "archive"),
        "language": ("international_admissions", "central_admissions", "official_web", "pdf"),
        "admissions": ("central_admissions", "international_admissions", "official_web", "pdf"),
        "deadline": ("central_admissions", "official_web", "pdf", "archive"),
        "deadline_intake": ("central_admissions", "official_web", "pdf", "archive"),
        "funding": ("scholarship_provider", "official_finance", "government_portal", "pdf", "partner_institution"),
        "scholarship": ("scholarship_provider", "official_finance", "government_portal", "pdf", "partner_institution"),
    }

    _EXTERNAL_FIELD_PLANS: Mapping[str, tuple[str, ...]] = {
        "tuition": (
            "government_dataset", "official_registry", "external_authoritative",
            "accreditation", "official_partner", "archive", "search_discovery",
            "official_finance", "official_web", "official_catalogue", "pdf",
        ),
        "finance": (
            "government_dataset", "official_registry", "external_authoritative",
            "official_partner", "archive", "search_discovery", "official_finance", "official_web", "pdf",
        ),
        "admissions": (
            "official_registry", "government_dataset", "external_authoritative",
            "official_partner", "archive", "search_discovery", "central_admissions", "official_web", "pdf",
        ),
        "deadline": (
            "official_registry", "government_dataset", "external_authoritative",
            "official_partner", "archive", "search_discovery", "central_admissions", "official_web", "pdf",
        ),
    }

    _PROVIDER_FIELD_GROUPS: Mapping[str, tuple[str, ...]] = {
        "tuition": ("tuition", "finance"),
        "application_fee": ("tuition", "finance", "admissions"),
        "additional_fees": ("tuition", "finance"),
        "academic_cycle": ("deadline", "admissions", "programme_taxonomy"),
        "intakes": ("deadline", "admissions"),
        "priority_deadline": ("deadline", "admissions"),
        "funding_deadline": ("deadline", "funding", "finance"),
        "international_deadline": ("deadline", "admissions"),
        "application_deadline": ("deadline", "admissions"),
        "final_deadline": ("deadline", "admissions"),
        "rolling_admission": ("deadline", "admissions"),
        "application_url": ("admissions",),
        "english_requirement": ("language", "admissions"),
        "ielts_overall": ("language", "admissions"),
        "ielts_subscores": ("language", "admissions"),
        "toefl": ("language", "admissions"),
        "duolingo": ("language", "admissions"),
        "scholarships": ("funding", "finance"),
        "programme_identity": ("programme_taxonomy",),
        "credential": ("programme_taxonomy",),
        "programme_status": ("programme_taxonomy", "admissions"),
        "programme_focus": ("programme_taxonomy",),
        "curriculum_overview": ("programme_taxonomy",),
        "specialisations": ("programme_taxonomy",),
        "learning_outcomes": ("programme_taxonomy",),
        "major_admissions_requirement": ("admissions",),
        "minimum_degree": ("admissions",),
        "minimum_gpa": ("admissions",),
        "gpa_scale": ("admissions",),
        "subject_prerequisites": ("admissions",),
        "admission_difficulty": ("admissions",),
        "standardized_tests": ("admissions",),
        "work_experience": ("admissions",),
        "portfolio": ("admissions",),
        "required_documents": ("admissions",),
        "recommendation_letters": ("admissions",),
        "sop_essay_requirements": ("admissions",),
        "graduation_certificate": ("admissions",),
        "academic_transcript": ("admissions",),
    }

    @classmethod
    def provider_field_groups(cls, field_groups: Iterable[str]) -> tuple[str, ...]:
        """Translate concrete extraction fields to existing catalogue groups."""
        routed: list[str] = []
        for value in field_groups:
            field_group = str(value or "").strip().casefold()
            if not field_group:
                continue
            routed.extend(cls._PROVIDER_FIELD_GROUPS.get(field_group, (field_group,)))
        return tuple(dict.fromkeys(routed))

    def __init__(self, *, mode: str = "default") -> None:
        normalized = str(mode or "default").strip().casefold()
        if normalized not in {"default", "external_source_expansion"}:
            raise ValueError(
                "AcquisitionPlanner mode must be default or external_source_expansion."
            )
        self.mode = normalized

    def plan(
        self,
        *,
        entity: EntityRef,
        field_groups: Iterable[str],
        target_cycle: str | None = None,
        audience: str | None = None,
        evidence: Iterable[Any] = (),
    ) -> list[AcquisitionIntent]:
        # Existing evidence is an input for later policy. Slice B deliberately
        # does not interpret it as a coverage engine.
        del evidence
        intents: list[AcquisitionIntent] = []
        for priority, field_group in enumerate(tuple(dict.fromkeys(field_groups))):
            plans = (
                self._EXTERNAL_FIELD_PLANS
                if self.mode == "external_source_expansion"
                else self._FIELD_PLANS
            )
            source_classes = plans.get(field_group, ("official_web", "official_catalogue", "pdf"))
            intents.append(AcquisitionIntent.create(
                entity=entity,
                field_groups=(field_group,),
                reason="FIELD_DIRECTED_ACQUISITION",
                target_cycle=target_cycle,
                audience=audience,
                preferred_source_classes=source_classes,
                priority=priority,
            ))
        return intents


class OfficialCatalogueAdapter:
    """Adapter around existing native/sitemap/catalogue/Coursedog discovery."""

    adapter_id = "official_catalogue"
    priority = 10
    source_classes = frozenset({"official_catalogue"})

    def __init__(self, discovery: CatalogueDiscovery) -> None:
        self.discovery_backend = discovery
        self.last_sitemaps: list[str] = []
        self.last_errors: list[str] = []
        self.last_programme_candidates: list[ProgrammeCandidate] = []

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return context.seed is not None and (
            not intent.preferred_source_classes
            or bool({"official_web", "official_catalogue"}.intersection(intent.preferred_source_classes))
        )

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        if context.seed is None:
            return []
        policy = context.configuration.get("robots_policy")
        if policy is None:
            return []
        programmes, self.last_sitemaps, self.last_errors = self.discovery_backend.discover(context.seed, policy)
        self.last_programme_candidates = programmes
        return [SourceCandidate.create(
            canonical_locator=item.url, locator_type="url", source_class="official_catalogue",
            adapter_id=self.adapter_id, publisher_key=context.seed.official_domain,
            relationship=SourceRelationship.DIRECT_OFFICIAL,
            relationship_evidence=("seed official domain",),
            declared_authority=SourceAuthority.OFFICIAL,
            expected_field_groups=intent.field_groups,
            discovery_method=item.catalogue_source,
            discovery_evidence=item.name_hint,
            adapter_metadata={"programme_score": item.score},
        ) for item in programmes]


class CoursedogSourceAdapter:
    """Represents existing Coursedog catalogue output as official evidence."""
    adapter_id = "coursedog_catalogue"
    priority = 12
    source_classes = frozenset({"official_catalogue"})

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return "official_catalogue" in intent.preferred_source_classes

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return [SourceCandidate.create(
            canonical_locator=str(item["url"]), locator_type="url", source_class="official_catalogue",
            adapter_id=self.adapter_id, provider_id="Coursedog",
            relationship=SourceRelationship.CATALOGUE_PROVIDER,
            relationship_evidence=("institution catalogue embeds Coursedog tenant",),
            declared_authority=SourceAuthority.OFFICIAL,
            expected_field_groups=intent.field_groups, discovery_method="coursedog_existing_discovery",
            academic_cycle=item.get("academic_cycle") or intent.target_cycle,
        ) for item in context.configuration.get("coursedog_candidates", ())
          if isinstance(item, Mapping) and item.get("url")]


class ManualSourceAdapter:
    adapter_id = "manual_source"
    priority = 5
    source_classes = frozenset({
        "official_web", "official_finance", "central_admissions",
        "international_admissions", "official_partner", "government_portal",
    })

    _SUPPORTED_SOURCE_CLASSES = frozenset({
        "official_web",
        "official_catalogue",
        "official_finance",
        "central_admissions",
        "international_admissions",
        "department",
        "faculty",
        "school",
        "government_portal",
        "partner_institution",
        "external_authoritative",
        "accreditation_body",
        "aggregator",
        "official_application_system",
    })

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        if intent.preferred_source_classes and not self._SUPPORTED_SOURCE_CLASSES.intersection(
            intent.preferred_source_classes
        ):
            return False
        return bool(
            context.seed
            and (
                context.seed.manual_programme_urls
                or context.configuration.get("official_web_resources")
            )
        )

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        assert context.seed is not None
        configured = context.configuration.get("official_web_resources", ())
        items: list[Mapping[str, Any]] = [
            {"url": url, "discovery_method": "manual_seed"}
            for url in context.seed.manual_programme_urls
        ]
        items.extend(item for item in configured if isinstance(item, Mapping))
        candidates: list[SourceCandidate] = []
        for item in items:
            url = str(item.get("url") or "").strip()
            if not url:
                continue
            relationship = _enum_value(
                item.get("relationship") or item.get("source_relationship"),
                SourceRelationship,
                SourceRelationship.DIRECT_OFFICIAL,
            )
            authority = _enum_value(
                item.get("authority") or item.get("source_authority"),
                SourceAuthority,
                SourceAuthority.OFFICIAL,
            )
            candidates.append(SourceCandidate.create(
                canonical_locator=url,
                locator_type=str(item.get("locator_type") or "manual"),
                source_class=str(item.get("source_class") or "official_web"),
                adapter_id=self.adapter_id,
                publisher_key=str(item.get("publisher_key") or context.seed.official_domain),
                relationship=relationship,
                relationship_evidence=_relationship_evidence(
                    item,
                    ("explicit institution seed",)
                    if item.get("discovery_method") == "manual_seed"
                    else ("configured source ecosystem resource",),
                ),
                declared_authority=authority,
                expected_field_groups=tuple(item.get("field_groups") or intent.field_groups),
                language=item.get("language"),
                # A configured central/faculty/institution resource may not
                # state the target cycle. Preserve that unknown value instead
                # of stamping the run's target cycle onto the source. Manual
                # programme seeds retain the historical target-cycle fallback
                # used by the legacy acquisition path.
                academic_cycle=(
                    item.get("academic_cycle")
                    if item.get("academic_cycle")
                    else intent.target_cycle
                    if item.get("discovery_method") == "manual_seed"
                    else None
                ),
                discovery_method=str(item.get("discovery_method") or "configured_source"),
                discovery_evidence=item.get("discovery_evidence"),
                fetch_strategy=item.get("fetch_strategy"),
                cost_class=item.get("cost_class"),
                provider_id=item.get("provider_id"),
                dataset_id=item.get("dataset_id"),
             temporal_state=_enum_value(
                 item.get("temporal_state"), TemporalState, TemporalState.UNKNOWN
             ) or TemporalState.UNKNOWN,
             source_resolution=str(item.get("resolution") or item.get("source_resolution") or "unknown").casefold(),
                adapter_metadata={
                    key: value
                    for key, value in item.items()
                    if key not in {
                        "url", "locator_type", "source_class", "publisher_key",
                        "relationship", "source_relationship", "relationship_evidence",
                        "authority", "source_authority", "field_groups", "language",
                        "academic_cycle", "discovery_method", "discovery_evidence",
                        "fetch_strategy", "cost_class", "provider_id", "dataset_id",
                        "temporal_state",
                    }
                },
            ))
        return candidates


class PdfDocumentCandidateAdapter:
    adapter_id = "pdf_document"
    priority = 30
    source_classes = frozenset({"pdf"})

    _TOKENS = {
        "finance": ("tuition", "fee", "fees", "cost", "financial"),
        "funding": ("scholarship", "funding", "award"),
        "deadline": ("deadline", "admission", "apply"),
        "admissions": ("admission", "handbook", "requirements"),
        "language": ("language", "english", "ielts", "toefl"),
    }

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return "pdf" in intent.preferred_source_classes

    @classmethod
    def score_candidate(cls, *, url: str, title: str, field_groups: Iterable[str]) -> int:
        text = f"{url} {title}".casefold()
        score = 2 if ".pdf" in url.casefold() else 0
        for group in field_groups:
            score += 4 * sum(token in text for token in cls._TOKENS.get(group, ()))
        if "catalog" in text or "handbook" in text:
            score += 3
        return score

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        raw = context.configuration.get("pdf_candidates", ())
        candidates: list[SourceCandidate] = []
        for item in raw:
            url = str(item.get("url") if isinstance(item, Mapping) else item)
            title = str(item.get("title", "") if isinstance(item, Mapping) else "")
            score = self.score_candidate(url=url, title=title, field_groups=intent.field_groups)
            if score:
                relationship = _enum_value(
                    item.get("relationship") or item.get("source_relationship")
                    if isinstance(item, Mapping)
                    else None,
                    SourceRelationship,
                    SourceRelationship.DIRECT_OFFICIAL,
                )
                authority = _enum_value(
                    item.get("authority") or item.get("source_authority")
                    if isinstance(item, Mapping)
                    else None,
                    SourceAuthority,
                    SourceAuthority.OFFICIAL,
                )
                candidates.append(SourceCandidate.create(
                    canonical_locator=url, locator_type="pdf", source_class="pdf", adapter_id=self.adapter_id,
                    relationship=relationship,
                    relationship_evidence=_relationship_evidence(
                        item if isinstance(item, Mapping) else {},
                        ("catalogue/document link",),
                    ), declared_authority=authority,
                    expected_field_groups=intent.field_groups, discovery_method="document_link",
                    provider_id=(item.get("provider_id") if isinstance(item, Mapping) else None),
                    dataset_id=(item.get("dataset_id") if isinstance(item, Mapping) else None),
                    academic_cycle=(item.get("academic_cycle") if isinstance(item, Mapping) else None) or intent.target_cycle,
                    temporal_state=(
                        _enum_value(item.get("temporal_state"), TemporalState, TemporalState.UNKNOWN)
                        if isinstance(item, Mapping)
                        else TemporalState.UNKNOWN
                    ) or TemporalState.UNKNOWN,
                    adapter_metadata={"field_directed_score": score, "title": title},
                ))
        return candidates


class JsonApiSourceAdapter:
    adapter_id = "json_api"
    priority = 20
    source_classes = frozenset({"official_api", "structured_api"})

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool(context.configuration.get("json_api_resources")) and (
            not intent.preferred_source_classes
            or bool({"official_api", "structured_api"}.intersection(
                intent.preferred_source_classes
            ))
        )

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return [SourceCandidate.create(
            canonical_locator=str(item["url"]), locator_type="json_api",
            source_class=str(item.get("source_class") or "official_api"),
            adapter_id=self.adapter_id, provider_id=str(item.get("provider_id") or "official-api"),
            dataset_id=str(item.get("dataset_id") or "") or None,
            relationship=_enum_value(
                item.get("relationship") or item.get("source_relationship"),
                SourceRelationship,
                SourceRelationship.DIRECT_OFFICIAL,
            ),
            relationship_evidence=_relationship_evidence(
                item, ("configured API resource",)
            ),
            declared_authority=_enum_value(
                item.get("authority") or item.get("source_authority"),
                SourceAuthority,
                SourceAuthority.OFFICIAL,
            ),
            expected_field_groups=tuple(item.get("field_groups") or intent.field_groups),
            academic_cycle=item.get("academic_cycle") or intent.target_cycle,
            discovery_method=str(item.get("discovery_method") or "configured_api"),
            publisher_key=item.get("publisher_key"),
            temporal_state=_enum_value(
                item.get("temporal_state"), TemporalState, TemporalState.UNKNOWN
            ) or TemporalState.UNKNOWN,
            adapter_metadata={
                key: value
                for key, value in item.items()
                if key not in {
                    "url", "source_class", "provider_id", "dataset_id",
                    "relationship", "source_relationship", "relationship_evidence",
                    "authority", "source_authority", "field_groups", "academic_cycle",
                    "discovery_method", "publisher_key", "temporal_state",
                }
            },
        ) for item in context.configuration.get("json_api_resources", ()) if isinstance(item, Mapping) and item.get("url")]


class StructuredDatasetAdapter:
    """Common metadata wrapper for IPEDS/Scorecard structured resources."""

    priority = 15
    provider_id = "structured"
    source_class = "government_dataset"

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return "government_dataset" in intent.preferred_source_classes

    def candidate(
        self, *, locator: str, dataset_id: str, academic_cycle: str | None,
        field_groups: tuple[str, ...], retrieved_at: str | None = None,
        provider_id: str | None = None, publisher_key: str | None = None,
        adapter_metadata: Mapping[str, Any] | None = None,
        temporal_state: TemporalState = TemporalState.UNKNOWN,
    ) -> SourceCandidate:
        return SourceCandidate.create(
            canonical_locator=locator, locator_type="provider_resource", source_class=self.source_class,
            adapter_id=self.adapter_id, provider_id=provider_id or self.provider_id, dataset_id=dataset_id,
            relationship=SourceRelationship.GOVERNMENT, relationship_evidence=("government dataset metadata",),
            declared_authority=SourceAuthority.GOVERNMENT, expected_field_groups=field_groups,
            academic_cycle=academic_cycle, retrieved_at=retrieved_at,
            discovery_method="structured_dataset",
            publisher_key=publisher_key,
             temporal_state=temporal_state,
             source_resolution="institution",
             adapter_metadata=dict(adapter_metadata or {}),
        )


class IpedsSourceAdapter(StructuredDatasetAdapter):
    adapter_id = "ipeds"
    provider_id = "IPEDS"
    source_classes = frozenset({"government_dataset"})

    def __init__(self, target_config_path: str | None = None) -> None:
        self.target_config_path = target_config_path

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        if context.configuration.get("source_ecosystem_programme_only"):
            return []
        configured = context.configuration.get("ipeds_candidates", ())
        candidates: list[SourceCandidate] = []
        for item in configured:
            if isinstance(item, SourceCandidate):
                candidates.append(item)
                continue
            if not isinstance(item, Mapping) or not item.get("url"):
                continue
            candidate = self.candidate(
                locator=str(item["url"]),
                dataset_id=str(item.get("dataset_id") or item.get("dataset") or "IPEDS"),
                academic_cycle=str(item.get("academic_cycle") or intent.target_cycle or "") or None,
                field_groups=tuple(item.get("field_groups") or intent.field_groups),
                retrieved_at=item.get("retrieved_at"),
            )
            candidates.append(replace(
                candidate,
                relationship=_enum_value(
                    item.get("relationship") or item.get("source_relationship"),
                    SourceRelationship,
                    candidate.relationship,
                ),
                relationship_evidence=_relationship_evidence(
                    item, candidate.relationship_evidence
                ),
                declared_authority=_enum_value(
                    item.get("authority") or item.get("source_authority"),
                    SourceAuthority,
                    candidate.declared_authority,
                ),
                source_class=str(item.get("source_class") or candidate.source_class),
                publisher_key=item.get("publisher_key"),
                temporal_state=_enum_value(
                    item.get("temporal_state"), TemporalState, candidate.temporal_state
                ) or candidate.temporal_state,
                adapter_metadata={
                    key: value for key, value in item.items()
                    if key not in {
                        "url", "dataset_id", "dataset", "academic_cycle", "field_groups",
                        "relationship", "source_relationship", "relationship_evidence",
                        "authority", "source_authority", "source_class", "publisher_key",
                        "temporal_state", "provider_id",
                    }
                },
            ))
        for item in context.configuration.get("external_providers", ()):
            if not isinstance(item, Mapping) or not provider_is_enabled(item, context):
                continue
            provider_id = str(item.get("provider_id") or item.get("id") or "").casefold()
            adapter_id = str(item.get("adapter_id") or item.get("adapter") or "").casefold()
            if provider_id not in {"ipeds"} and adapter_id != self.adapter_id:
                continue
            if not item.get("url") and not item.get("resource_url") and not item.get("base_url") and not item.get("query_endpoint") and not item.get("resource_urls") and not item.get("resource_specs"):
                continue
            for resource_url, resource_metadata in _provider_resource_specs(item, context):
                effective_item = {**dict(item), **dict(resource_metadata)}
                routed_fields = _routed_provider_fields(
                    effective_item, intent, context
                )
                if routed_fields is None:
                    continue
                for paged_url, page_metadata in _pagination_urls(effective_item, resource_url):
                    candidate = self.candidate(
                        locator=paged_url,
                        dataset_id=str(effective_item.get("dataset_id") or effective_item.get("dataset") or "IPEDS"),
                        academic_cycle=str(effective_item.get("academic_cycle") or effective_item.get("data_year") or effective_item.get("collection_year") or intent.target_cycle or "") or None,
                        field_groups=routed_fields,
                        provider_id=str(effective_item.get("provider_id") or effective_item.get("id") or self.provider_id),
                        publisher_key=effective_item.get("domain"),
                        adapter_metadata={**dict(effective_item), **page_metadata},
                    )
                    candidates.append(replace(
                        candidate,
                        relationship=_enum_value(effective_item.get("relationship") or effective_item.get("source_relationship"), SourceRelationship, candidate.relationship),
                        relationship_evidence=_relationship_evidence(effective_item, candidate.relationship_evidence),
                        declared_authority=_enum_value(effective_item.get("authority") or effective_item.get("source_authority"), SourceAuthority, candidate.declared_authority),
                        source_class=normalize_source_class(effective_item.get("source_class") or candidate.source_class),
                        source_resolution=str(effective_item.get("resolution") or effective_item.get("source_resolution") or "institution").casefold(),
                        temporal_state=_enum_value(effective_item.get("temporal_state"), TemporalState, candidate.temporal_state) or candidate.temporal_state,
                    ))
        target_config_path = context.configuration.get(
            "ipeds_target_config", self.target_config_path
        )
        if candidates or not target_config_path:
            return candidates
        # Reuse the existing IPEDS target/dataset contract.  This only wraps
        # dataset resources; it does not claim programme-level tuition.
        try:
            from pathlib import Path

            from .ipeds import IpedsTargetConfig, default_dataset_specs

            target_config = IpedsTargetConfig.load(Path(str(target_config_path)))
            if context.seed is not None:
                mapped_ids = {
                    target.institution_id for target in target_config.targets
                }
                if context.seed.institution_id not in mapped_ids:
                    # A government dataset is institution-scoped metadata, not
                    # a universal prior. Do not emit it for an unmapped seed.
                    return []
            mapping_metadata = {
                "collection_year": target_config.collection_year,
                "target_config": Path(str(target_config_path)).name,
                "mapped_institution_id": (
                    context.seed.institution_id if context.seed is not None else None
                ),
            }
            return [
                replace(
                    self.from_dataset_spec(
                        spec,
                        field_groups=tuple(intent.field_groups),
                    ),
                    adapter_metadata=mapping_metadata,
                )
                for spec in default_dataset_specs(target_config.collection_year)
            ]
        except (OSError, ValueError, TypeError):
            return []

    def from_dataset_spec(
        self, spec: Any, *, field_groups: tuple[str, ...], retrieved_at: str | None = None
    ) -> SourceCandidate:
        """Wrap an existing ``IpedsDatasetSpec`` without changing its loader."""
        return self.candidate(
            locator=str(spec.source_url), dataset_id=str(spec.key),
            academic_cycle=str(spec.data_year), field_groups=field_groups,
            retrieved_at=retrieved_at,
        )


class ScorecardSourceAdapter(StructuredDatasetAdapter):
    adapter_id = "college_scorecard"
    provider_id = "CollegeScorecard"
    source_classes = frozenset({"government_dataset"})

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        if context.configuration.get("source_ecosystem_programme_only"):
            return []
        candidates: list[SourceCandidate] = []
        for item in context.configuration.get("scorecard_candidates", ()):
            if isinstance(item, SourceCandidate):
                candidates.append(item)
                continue
            if not isinstance(item, Mapping) or not item.get("url"):
                continue
            candidate = self.from_dataset_resource(
                resource_url=str(item["url"]),
                data_year=(
                    str(item["academic_cycle"])
                    if item.get("academic_cycle")
                    else intent.target_cycle
                ),
                field_groups=tuple(item.get("field_groups") or intent.field_groups),
                retrieved_at=item.get("retrieved_at"),
            )
            candidates.append(replace(
                candidate,
                dataset_id=str(item.get("dataset_id") or candidate.dataset_id or ""),
                relationship=_enum_value(
                    item.get("relationship") or item.get("source_relationship"),
                    SourceRelationship,
                    candidate.relationship,
                ),
                relationship_evidence=_relationship_evidence(
                    item, candidate.relationship_evidence
                ),
                declared_authority=_enum_value(
                    item.get("authority") or item.get("source_authority"),
                    SourceAuthority,
                    candidate.declared_authority,
                ),
                source_class=str(item.get("source_class") or candidate.source_class),
                publisher_key=item.get("publisher_key"),
                temporal_state=_enum_value(
                    item.get("temporal_state"), TemporalState, candidate.temporal_state
                ) or candidate.temporal_state,
                adapter_metadata={
                    key: value for key, value in item.items()
                    if key not in {
                        "url", "resource_url", "dataset_id", "academic_cycle", "field_groups",
                        "relationship", "source_relationship", "relationship_evidence",
                        "authority", "source_authority", "source_class", "publisher_key",
                        "temporal_state", "provider_id",
                    }
                },
            ))
        for item in context.configuration.get("external_providers", ()):
            if not isinstance(item, Mapping) or not provider_is_enabled(item, context):
                continue
            provider_id = str(item.get("provider_id") or item.get("id") or "").casefold()
            adapter_id = str(item.get("adapter_id") or item.get("adapter") or "").casefold()
            if provider_id not in {"college_scorecard", "scorecard"} and adapter_id != self.adapter_id:
                continue
            locator = (
                item.get("resource_url")
                or item.get("url")
                or item.get("base_url")
                or item.get("query_endpoint")
            )
            if not locator and not item.get("resource_urls") and not item.get("resource_specs"):
                continue
            for resource_url, resource_metadata in _provider_resource_specs(item, context):
                effective_item = {**dict(item), **dict(resource_metadata)}
                # Institution/provider identity is configuration, not source
                # evidence.  Supplying it to the bounded ZIP parser lets the
                # shared large-object path retain only source-native rows for
                # the selected institution rather than a generic sample.
                seed_identifiers = getattr(context.seed, "provider_identifiers", {}) or {}
                target_identifiers = (
                    seed_identifiers.get(str(effective_item.get("provider_id") or ""))
                    if isinstance(seed_identifiers, Mapping)
                    else None
                )
                if isinstance(target_identifiers, Mapping) and target_identifiers:
                    structured = dict(effective_item.get("structured_archive") or {})
                    existing_targets = structured.get("target_identifiers")
                    targets = dict(existing_targets) if isinstance(existing_targets, Mapping) else {}
                    targets.update({
                        str(key): str(value)
                        for key, value in target_identifiers.items()
                        if value is not None and str(value).strip()
                    })
                    structured["target_identifiers"] = targets
                    effective_item["structured_archive"] = structured
                routed_fields = _routed_provider_fields(
                    effective_item, intent, context
                )
                if routed_fields is None:
                    continue
                for paged_url, page_metadata in _pagination_urls(effective_item, resource_url):
                    candidate = self.from_dataset_resource(
                        resource_url=paged_url,
                        # This rolling Scorecard bulk member does not publish
                        # an academic/reporting year in the matched row.  Do
                        # not stamp the target programme cycle onto it.
                        data_year=str(effective_item.get("academic_cycle") or effective_item.get("data_year") or effective_item.get("collection_year") or "") or None,
                        field_groups=routed_fields,
                        retrieved_at=effective_item.get("retrieved_at"),
                    )
                    candidates.append(replace(
                        candidate,
                        provider_id=str(effective_item.get("provider_id") or effective_item.get("id") or self.provider_id),
                        dataset_id=str(effective_item.get("dataset_id") or candidate.dataset_id or "college-scorecard"),
                        publisher_key=effective_item.get("domain"),
                        relationship=_enum_value(effective_item.get("relationship") or effective_item.get("source_relationship"), SourceRelationship, candidate.relationship),
                        relationship_evidence=_relationship_evidence(effective_item, candidate.relationship_evidence),
                        declared_authority=_enum_value(effective_item.get("authority") or effective_item.get("source_authority"), SourceAuthority, candidate.declared_authority),
                        source_class=normalize_source_class(effective_item.get("source_class") or candidate.source_class),
                        source_resolution=str(effective_item.get("resolution") or effective_item.get("source_resolution") or "institution").casefold(),
                        temporal_state=_enum_value(effective_item.get("temporal_state"), TemporalState, candidate.temporal_state) or candidate.temporal_state,
                        adapter_metadata={**dict(effective_item), **page_metadata},
                    ))
        return candidates

    def from_dataset_resource(
        self, *, resource_url: str, data_year: str | None,
        field_groups: tuple[str, ...], retrieved_at: str | None = None,
    ) -> SourceCandidate:
        """Represent the current Scorecard loader's resource, not an LLM page."""
        return self.candidate(
            locator=resource_url, dataset_id="college-scorecard", academic_cycle=data_year,
            field_groups=field_groups, retrieved_at=retrieved_at,
        )


class ScrapyLinkGraphAdapter:
    """Capability marker for the existing Scrapy link-graph backend."""
    adapter_id = "scrapy_link_graph"
    priority = 40

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool(context.configuration.get("scrapy_enabled"))

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return []


class Crawl4AIRenderAdapter:
    """Marks render strategy without coupling acquisition to Crawl4AI imports."""
    adapter_id = "crawl4ai_render"
    priority = 50

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool(context.configuration.get("render_enabled"))

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return []

    @staticmethod
    def render_candidate(candidate: SourceCandidate) -> SourceCandidate:
        return replace(candidate, fetch_strategy="render")


class FixtureSearchProvider:
    """Test-only deterministic search provider; snippets never become facts."""
    provider_id = "fixture_search"

    def __init__(self, results: Sequence[Mapping[str, str]]) -> None:
        self._results = tuple(dict(item) for item in results)

    def search(self, query: str) -> Sequence[Mapping[str, str]]:
        del query
        return self._results


class SearchSourceAdapter:
    adapter_id = "search_index"
    priority = 60
    source_classes = frozenset({"search_index", "search_discovery"})

    def __init__(self, provider: SearchProvider | Sequence[SearchProvider]) -> None:
        if isinstance(provider, (list, tuple, set, frozenset)):
            providers = tuple(provider)
        else:
            providers = (provider,)
        if not providers:
            raise ValueError("SearchSourceAdapter requires at least one provider.")
        self.providers = providers
        # Preserve the historical single-provider attribute for callers that
        # inspect the adapter directly.
        self.provider = providers[0]

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool({"search_index", "search_discovery"}.intersection(intent.preferred_source_classes))

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        candidates: list[SourceCandidate] = []
        query = " ".join((context.seed.name if context.seed else context.entity.entity_id, *intent.field_groups))
        policy_fetcher = getattr(context.configuration.get("robots_policy"), "fetcher", None)
        policy_user_agent = getattr(getattr(policy_fetcher, "limits", None), "user_agent", None)
        for provider in self.providers:
            search_with_policy = getattr(provider, "search_with_policy", None)
            if callable(search_with_policy):
                items = search_with_policy(
                    query,
                    robots_policy=context.configuration.get("robots_policy"),
                    user_agent=policy_user_agent,
                )
            else:
                items = provider.search(query)
            provider_defaults = {
                "source_class": getattr(provider, "source_class", "search_discovery"),
                "authority": getattr(provider, "authority", SourceAuthority.OTHER),
                "relationship": getattr(provider, "relationship", SourceRelationship.OTHER_RELATED),
                "domain": getattr(provider, "domain", None),
            }
            for item in items:
                if not isinstance(item, Mapping):
                    continue
                result_url_for = getattr(provider, "result_url_for", None)
                if callable(result_url_for):
                    candidate_url = result_url_for(item)
                else:
                    result_url_field = str(getattr(provider, "result_url_field", "url") or "url")
                    candidate_url = (
                        _nested_result_value(item, result_url_field)
                        or item.get("url")
                        or item.get("link")
                    )
                if not candidate_url:
                    continue
                candidate_url = str(candidate_url).strip()
                if not urlsplit(candidate_url).scheme:
                    endpoint = str(getattr(provider, "endpoint", "") or "")
                    candidate_url = urljoin(endpoint, candidate_url)
                source_class = normalize_source_class(
                    item.get("source_class") or provider_defaults["source_class"],
                    "search_discovery",
                )
                authority = _enum_value(
                    item.get("authority") or item.get("source_authority"),
                    SourceAuthority,
                    provider_defaults["authority"],
                )
                relationship = _enum_value(
                    item.get("relationship") or item.get("source_relationship"),
                    SourceRelationship,
                    provider_defaults["relationship"],
                )
                candidates.append(SourceCandidate.create(
                    canonical_locator=candidate_url, locator_type="url", source_class=source_class,
                    adapter_id=self.adapter_id, provider_id=str(item.get("provider_id") or provider.provider_id),
                    dataset_id=str(item.get("dataset_id") or getattr(provider, "dataset_id", None) or "") or None,
                    publisher_key=str(item.get("domain") or provider_defaults["domain"] or "") or None,
                    declared_authority=authority, relationship=relationship,
                    relationship_evidence=_relationship_evidence(
                        item, ("search provider returned candidate URL",)
                    ),
                    expected_field_groups=tuple(item.get("field_groups") or intent.field_groups),
                    academic_cycle=item.get("academic_cycle") or intent.target_cycle,
                    discovery_method="search_snippet",
                    discovery_evidence=str(item.get("snippet") or item.get("title") or ""),
                    adapter_metadata={
                        "configured_adapter_id": getattr(provider, "adapter_id", self.adapter_id),
                        "provider_query": query,
                        "snippet_only": True,
                        "requires_authoritative_fetch": True,
                        "snippet_is_not_evidence": True,
                        "result_metadata": {
                            key: value for key, value in item.items() if key not in {"snippet", "title"}
                        },
                    },
                ))
        return candidates


class FixtureArchiveAdapter:
    adapter_id = "fixture_archive"
    priority = 70
    source_classes = frozenset({"archive"})

    def __init__(self, results: Sequence[Mapping[str, str]]) -> None:
        self._results = tuple(dict(item) for item in results)

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return "archive" in intent.preferred_source_classes

    def discover_archive(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return self.discover(intent, context)

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return [SourceCandidate.create(
            canonical_locator=str(item["url"]), locator_type="archive", source_class="archive",
            adapter_id=self.adapter_id, provider_id=str(item.get("provider") or "fixture_archive"),
            relationship=SourceRelationship.ARCHIVE, relationship_evidence=("archive capture metadata",),
            declared_authority=SourceAuthority.ARCHIVE, expected_field_groups=intent.field_groups,
            temporal_state=TemporalState.HISTORICAL, discovery_method="archive_fixture",
            adapter_metadata={"original_url": item.get("original_url"), "captured_at": item.get("captured_at")},
        ) for item in self._results if item.get("url")]


def _ecosystem_with_catalogue(
    ecosystem: SourceEcosystemConfig,
) -> SourceEcosystemConfig:
    """Resolve an explicit provider catalogue into the runtime ecosystem.

    ``SourceEcosystemConfig.from_dict`` intentionally keeps a catalogue path
    separate from provider records.  Runtime callers need the resolved records
    both for registry construction and for configured-source discovery; doing
    this once prevents adapters from being registered while their providers
    silently disappear from the later decision phase.
    """
    if not ecosystem.external_provider_catalogue_path:
        return ecosystem
    catalogue_path = Path(ecosystem.external_provider_catalogue_path)
    if not catalogue_path.is_absolute():
        catalogue_path = Path.cwd() / catalogue_path
    if not catalogue_path.exists():
        raise ValueError(
            "Configured external provider catalogue does not exist: "
            f"{catalogue_path}"
        )
    catalogue_providers = ExternalProviderConfig.load_catalogue(catalogue_path)
    allowed_ids = set(ecosystem.external_provider_ids)
    merged: dict[tuple[str, str], ExternalProviderConfig] = {
        (provider.provider_id.casefold(), provider.adapter_id or ""): provider
        for provider in ecosystem.external_providers
    }
    for provider in catalogue_providers:
        if not allowed_ids or provider.provider_id.casefold() in allowed_ids:
            merged[(provider.provider_id.casefold(), provider.adapter_id or "")] = provider
    return replace(ecosystem, external_providers=tuple(merged.values()))


def build_source_registry(
    config: SourceEcosystemConfig | Mapping[str, Any] | None = None,
    *,
    discovery: CatalogueDiscovery | None = None,
    official_adapter: OfficialCatalogueAdapter | None = None,
    search_provider: SearchProvider | None = None,
    fetcher: SafeFetcher | None = None,
) -> SourceRegistry:
    """Construct the adapters enabled by the run's source ecosystem config.

    The builder is intentionally explicit.  A provider is registered only
    when its source family is enabled and a configured resource/provider is
    available; fixture-only search/archive implementations never become
    production defaults by accident.
    """
    # Accept a loaded SmokeConfig as a convenience for callers constructing
    # the runtime from the same object used by the pipeline.  Keep the
    # ecosystem contract authoritative rather than duplicating config parsing.
    if hasattr(config, "source_ecosystem"):
        config = getattr(config, "source_ecosystem")
    ecosystem = (
        config
        if isinstance(config, SourceEcosystemConfig)
        else SourceEcosystemConfig.from_dict(config)
    )
    # ``SmokeConfig.load`` normally resolves the catalogue path.  Keep the
    # central builder safe for callers that construct it directly from a
    # source-ecosystem mapping: an explicit catalogue must not silently vanish
    # before adapter registration.  The same resolved ecosystem is propagated
    # to the backend so configured-source decisions use the exact providers
    # whose adapters were registered.
    ecosystem = _ecosystem_with_catalogue(ecosystem)
    adapters: list[SourceAdapter] = []

    def append(adapter: SourceAdapter) -> None:
        if adapter.adapter_id not in {item.adapter_id for item in adapters}:
            adapters.append(adapter)

    allowed_provider_ids = set(ecosystem.external_provider_ids)
    # An explicit provider allow-list is an opt-in, even when an entry is
    # marked disabled/optional in the catalogue.  Registering that adapter
    # preserves legacy fixture and operator-controlled configurations while
    # the provider's own ``enabled`` gate still prevents it from discovering
    # or fetching resources by default.  With no allow-list, disabled entries
    # remain entirely absent from the runtime registry.
    explicitly_selected_provider_ids = set(allowed_provider_ids)
    provider_specs = tuple(
        item.to_dict() if hasattr(item, "to_dict") else dict(item)
        for item in ecosystem.external_providers
        if not allowed_provider_ids
        or str(
            item.provider_id if hasattr(item, "provider_id") else item.get("provider_id") or item.get("id") or ""
        ).casefold() in allowed_provider_ids
    )
    provider_classes = {
        normalize_source_class(item.get("source_class"), "").strip().casefold()
        for item in provider_specs
        if bool(item.get("enabled", True))
        or str(item.get("provider_id") or item.get("id") or "").casefold()
        in explicitly_selected_provider_ids
    }
    provider_adapters = {
        str(item.get("adapter_id") or item.get("adapter") or "").strip().casefold()
        for item in provider_specs
        if bool(item.get("enabled", True))
        or str(item.get("provider_id") or item.get("id") or "").casefold()
        in explicitly_selected_provider_ids
    }
    if ecosystem.official_catalogue_enabled and discovery is not None:
        append(official_adapter or OfficialCatalogueAdapter(discovery))
    if ecosystem.official_web_enabled or (
        ecosystem.official_web_resources
        and (
            ecosystem.official_catalogue_enabled
            or ecosystem.external_authoritative_enabled
        )
    ):
        # Manual seeds and configured bounded URLs share one safe adapter.  It
        # remains useful even when no manual URL is present because the seed
        # may supply one at discovery time.
        append(ManualSourceAdapter())
    if ecosystem.coursedog_candidates:
        append(CoursedogSourceAdapter())
    if (
        (ecosystem.pdf_enabled or ecosystem.external_authoritative_enabled)
        and ecosystem.pdf_candidates
    ):
        append(PdfDocumentCandidateAdapter())
    if (
        (ecosystem.structured_apis_enabled or ecosystem.external_authoritative_enabled)
        and ecosystem.json_api_resources
    ):
        append(JsonApiSourceAdapter())
    if ecosystem.government_datasets_enabled or provider_classes.intersection({"government_dataset", "government_portal"}) or provider_adapters.intersection({"ipeds", "college_scorecard"}):
        providers = set(ecosystem.government_dataset_providers)
        if "ipeds" in providers and (
            ecosystem.ipeds_candidates or ecosystem.ipeds_target_config
        ) or "ipeds" in provider_adapters:
            append(IpedsSourceAdapter(ecosystem.ipeds_target_config))
        if "college_scorecard" in providers and ecosystem.scorecard_candidates:
            append(ScorecardSourceAdapter())
        # Accept the common shorthand used in source ecosystem configs.
        if (
            "scorecard" in providers
            and "college_scorecard" not in providers
            and ecosystem.scorecard_candidates
        ):
            append(ScorecardSourceAdapter())
        if "college_scorecard" in provider_adapters:
            append(ScorecardSourceAdapter())
        if "government_dataset" in provider_classes or "government_portal" in provider_classes:
            append(GovernmentDatasetAdapter())

    # External providers opt themselves into their adapter family; they do not
    # depend on university-web adapters being enabled or exhausted first.
    if ecosystem.official_registries_enabled or provider_classes.intersection({
        "official_registry", "government_registry", "registry", "programme_registry", "qualification_registry",
    }):
        append(OfficialRegistryAdapter())
    if ecosystem.accreditation_enabled or provider_classes.intersection({
        "accreditation", "accreditation_registry", "accreditation_body",
    }):
        append(AccreditationRegistryAdapter())
    if ecosystem.official_partners_enabled or provider_classes.intersection({
        "official_partner", "partner", "partner_institution", "consortium", "official_application", "official_application_system", "catalogue_provider",
    }):
        append(PartnerSourceAdapter())
    if provider_classes.intersection({
        "external_authoritative", "trusted_external",
    }):
        append(ExternalAuthoritativeAdapter())

    search_provider_specs = [
        item for item in provider_specs
        if normalize_source_class(item.get("source_class"), "") == "search_discovery"
        and (
            bool(item.get("enabled", True))
            or str(item.get("provider_id") or item.get("id") or "").casefold()
            in explicitly_selected_provider_ids
        )
    ]
    if ecosystem.search_discovery_enabled or search_provider_specs:
        configured_searches: list[SearchProvider] = []
        if search_provider is not None:
            configured_searches.append(search_provider)

        def make_search_provider(search_config: Mapping[str, Any]) -> HttpSearchProvider | None:
            endpoint = str(
                search_config.get("query_endpoint")
                or search_config.get("endpoint")
                or search_config.get("resource_url")
                or search_config.get("base_url")
                or ""
            ).strip()
            domain = str(
                search_config.get("domain") or (urlsplit(endpoint).hostname or "")
            ).strip().lower()
            if not endpoint or not domain:
                return None
            try:
                max_results = int(search_config.get("max_results") or 10)
            except (TypeError, ValueError):
                max_results = 10
            return HttpSearchProvider(
                provider_id=str(search_config.get("provider_id") or "configured_search"),
                endpoint=endpoint,
                domain=domain,
                fetcher=fetcher,
                method=str(search_config.get("retrieval_method") or search_config.get("method") or "GET"),
                query_parameter=str(search_config.get("query_parameter") or "q"),
                result_path=(str(search_config["result_path"]) if search_config.get("result_path") else None),
                max_results=max_results,
                request_headers=(
                    dict(search_config.get("request_headers"))
                    if isinstance(search_config.get("request_headers"), Mapping)
                    else None
                ),
                authentication=(
                    dict(search_config.get("authentication"))
                    if isinstance(search_config.get("authentication"), Mapping)
                    else None
                ),
                pagination=(
                    dict(search_config.get("pagination"))
                    if isinstance(search_config.get("pagination"), Mapping)
                    else None
                ),
                rate_limit_policy=(
                    dict(search_config.get("rate_limit_policy"))
                    if isinstance(search_config.get("rate_limit_policy"), Mapping)
                    else None
                ),
                adapter_id=str(
                    search_config.get("adapter_id")
                    or search_config.get("adapter")
                    or "search_provider"
                ),
                source_class=str(search_config.get("source_class") or "search_discovery"),
                authority=_enum_value(search_config.get("authority"), SourceAuthority, SourceAuthority.OTHER) or SourceAuthority.OTHER,
                relationship=_enum_value(search_config.get("relationship"), SourceRelationship, SourceRelationship.OTHER_RELATED) or SourceRelationship.OTHER_RELATED,
                result_url_field=str(search_config.get("result_url_field") or "url"),
                result_url_template=(
                    str(search_config.get("result_url_template")).strip()
                    if search_config.get("result_url_template")
                    else None
                ),
                dataset_id=(
                    str(search_config.get("dataset_id") or search_config.get("dataset") or "").strip()
                    or None
                ),
            )

        if not configured_searches and ecosystem.search_provider:
            configured = make_search_provider(ecosystem.search_provider)
            if configured is not None:
                configured_searches.append(configured)
        if not configured_searches:
            configured_searches.extend(
                provider
                for spec in search_provider_specs
                if (provider := make_search_provider(spec)) is not None
            )
        if configured_searches:
            append(SearchSourceAdapter(configured_searches))
        elif ecosystem.allow_fixture_adapters and ecosystem.search_results:
            append(SearchSourceAdapter(FixtureSearchProvider(ecosystem.search_results)))

    if ecosystem.archives_enabled or "archive" in provider_classes:
        if "archive" in provider_classes:
            append(ArchiveSourceAdapter(fetcher=fetcher))
        if ecosystem.allow_fixture_adapters and ecosystem.archive_candidates:
            append(FixtureArchiveAdapter(ecosystem.archive_candidates))
    return SourceRegistry(adapters)


def multilingual_candidate_score(*, title: str, language: str | None = None) -> int:
    """Small discovery signal supplementing, never replacing, English URL hints."""
    text = title.casefold()
    tokens = ("学费", "入学", "奖学金", "授業料", "奨学金", "입학", "장학금", "học phí", "tuyển sinh", "học bổng")
    return (3 if language and language.lower() not in {"en", "eng", "english"} else 0) + 3 * sum(token in text for token in tokens)


def raw_snapshot_reusable(
    snapshots: Iterable[RawDocument], *, target_cycle: str | None,
    now: datetime | None = None, max_age_days: int = 30,
) -> RawDocument | None:
    """Conservative reuse by exact target cycle and bounded retrieval freshness."""
    now = now or datetime.now(timezone.utc)
    for document in sorted(snapshots, key=lambda item: item.retrieved_at, reverse=True):
        if target_cycle and document.academic_cycle not in {None, target_cycle}:
            continue
        try:
            retrieved = datetime.fromisoformat(document.retrieved_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if (now - retrieved).days <= max_age_days:
            return document
    return None


def persist_admitted_fetch(
    *, candidate: SourceCandidate, decision: SourceAdmissionDecision, fetcher: SafeFetcher,
    raw_store: RawEvidenceStore, acquisition_run_id: str | None = None,
    robots_policy: Any | None = None, intent_id: str | None = None,
    require_remote_durability: bool = True,
) -> tuple[RawDocument | None, AcquisitionAttempt]:
    """Fetch admitted evidence and persist it before any parser can consume it.

    This small helper is used by the shadow-path contract tests. Existing
    pipeline fetch/parse remains the production compatibility path.
    """
    if not decision.admitted:
        return None, decision.to_attempt(intent_id=intent_id, run_id=acquisition_run_id)
    if (
        require_remote_durability
        and getattr(raw_store, "durability", RawEvidenceDurability.LOCAL_ONLY)
        != RawEvidenceDurability.REMOTE_DURABLE
    ):
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSIST_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
            retryable=False,
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    if robots_policy is None:
        return None, AcquisitionAttempt.create(
            intent_id=intent_id,
            candidate_id=candidate.candidate_id,
            status="SOURCE_REJECTED_BY_POLICY",
            run_id=acquisition_run_id,
            error_code=AcquisitionFailureCode.SOURCE_REJECTED_BY_POLICY,
            retryable=False,
            adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            admission_reason="ROBOTS_POLICY_REQUIRED",
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    if not robots_policy.allows(
        candidate.canonical_locator,
        fetcher.limits.user_agent,
        allowed_domains=decision.allowed_domains,
    ):
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id,
            status="SOURCE_REJECTED_BY_ROBOTS", run_id=acquisition_run_id,
            error_code=AcquisitionFailureCode.SOURCE_REJECTED_BY_POLICY,
            retryable=False,
            adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    streaming_required = _candidate_requires_streaming(candidate, fetcher)
    # A heavy candidate must never fall through to an in-memory/local raw
    # store, even when the caller allows local durability for small shadow
    # resources.  The explicit check here protects the source-adapter bridge
    # independently of its caller's ``require_remote_durability`` setting.
    if (
        streaming_required
        and getattr(raw_store, "durability", RawEvidenceDurability.LOCAL_ONLY)
        != RawEvidenceDurability.REMOTE_DURABLE
    ):
        return None, AcquisitionAttempt.create(
            intent_id=intent_id,
            candidate_id=candidate.candidate_id,
            status="RAW_PERSIST_FAILED",
            run_id=acquisition_run_id,
            error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
            retryable=False,
            adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            admission_reason="HEAVY_RAW_REQUIRES_REMOTE_DURABILITY",
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    fetch_kwargs = _candidate_fetch_kwargs(candidate)
    if streaming_required:
        fetch_stream = getattr(fetcher, "fetch_stream", None)
        put_stream = getattr(raw_store, "put_snapshot_stream", None)
        if not callable(fetch_stream) or not callable(put_stream):
            return None, AcquisitionAttempt.create(
                intent_id=intent_id,
                candidate_id=candidate.candidate_id,
                status="RAW_PERSIST_FAILED",
                run_id=acquisition_run_id,
                error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
                retryable=False,
                adapter_id=candidate.adapter_id,
                source_class=candidate.source_class,
                provider_id=candidate.provider_id,
                dataset_id=candidate.dataset_id,
                source_authority=candidate.declared_authority,
                source_relationship=candidate.relationship,
                execution_state="HARD_BLOCKED",
                **_candidate_lineage_kwargs(candidate),
            )
        stream_result = None
        try:
            stream_result = fetch_stream(
                provider_request_url(candidate.adapter_metadata, candidate.canonical_locator),
                allowed_domains=decision.allowed_domains,
                **fetch_kwargs,
            )
            sanitize_provider_fetch_result(candidate.adapter_metadata, stream_result)  # type: ignore[arg-type]
            final_host = urlsplit(stream_result.final_url).hostname or ""
            if not decision.allowed_domains or not hostname_matches(final_host, decision.allowed_domains):
                raise FetchError(
                    "Final URL is outside the admitted source domains.",
                    code="FINAL_URL_OUTSIDE_ADMITTED_DOMAINS",
                    url=stream_result.final_url,
                    retryable=False,
                )
            document = put_stream(
                RawSnapshotStreamInput(
                    canonical_url=stream_result.final_url,
                    chunks=stream_result.iter_bytes(),
                    content_type=stream_result.content_type,
                    retrieved_at=stream_result.retrieved_at,
                    http_status=stream_result.status,
                    safe_response_headers={
                        key.lower(): value
                        for key, value in stream_result.headers.items()
                        if key.lower() in {"content-type", "etag", "last-modified", "content-language", "cache-control"}
                    },
                    fetch_method=candidate.fetch_strategy or "http-stream",
                    acquisition_run_id=acquisition_run_id,
                    source_authority=candidate.declared_authority,
                    source_relationship=candidate.relationship,
                    source_class=candidate.source_class,
                    adapter_id=candidate.adapter_id,
                    provider_id=candidate.provider_id,
                    dataset_id=candidate.dataset_id,
                    temporal_state=candidate.temporal_state,
                    academic_cycle=candidate.academic_cycle,
                    language=candidate.language,
                    source_resolution=candidate.source_resolution or candidate.adapter_metadata.get("source_resolution"),
                    original_url=candidate.original_url or candidate.adapter_metadata.get("original_url"),
                    capture_url=candidate.capture_url or candidate.adapter_metadata.get("capture_url"),
                    captured_at=candidate.captured_at or candidate.adapter_metadata.get("captured_at"),
                    archive_provider=candidate.archive_provider or candidate.adapter_metadata.get("archive_provider"),
                    max_bytes=(
                        int(fetch_kwargs["max_bytes"])
                        if fetch_kwargs.get("max_bytes") is not None
                        else None
                    ),
                )
            )
            return document, AcquisitionAttempt.create(
                intent_id=intent_id,
                candidate_id=candidate.candidate_id,
                status="RAW_PERSISTED",
                run_id=acquisition_run_id,
                raw_document_id=document.raw_document_id,
                adapter_id=candidate.adapter_id,
                source_class=candidate.source_class,
                provider_id=candidate.provider_id,
                dataset_id=candidate.dataset_id,
                source_authority=candidate.declared_authority,
                source_relationship=candidate.relationship,
                execution_state="RAW_OBJECT_PERSISTED",
                temporal_state=candidate.temporal_state,
                **_candidate_lineage_kwargs(candidate),
            )
        except (FetchError, RawEvidenceError) as exc:
            return None, AcquisitionAttempt.create(
                intent_id=intent_id,
                candidate_id=candidate.candidate_id,
                status="RAW_PERSIST_FAILED" if isinstance(exc, RawEvidenceError) else "FETCH_FAILED",
                run_id=acquisition_run_id,
                error_code=(
                    AcquisitionFailureCode.RAW_PERSIST_FAILED
                    if isinstance(exc, RawEvidenceError)
                    else AcquisitionFailureCode.FETCH_FAILED
                ),
                retryable=bool(getattr(exc, "retryable", False)),
                adapter_id=candidate.adapter_id,
                source_class=candidate.source_class,
                provider_id=candidate.provider_id,
                dataset_id=candidate.dataset_id,
                source_authority=candidate.declared_authority,
                source_relationship=candidate.relationship,
                execution_state="HARD_BLOCKED",
                **_candidate_lineage_kwargs(candidate),
            )
        finally:
            if stream_result is not None:
                stream_result.close()
    try:
        result: FetchResult = fetcher.fetch(
            provider_request_url(candidate.adapter_metadata, candidate.canonical_locator),
            allowed_domains=decision.allowed_domains,
            **_candidate_fetch_kwargs(candidate),
        )
        sanitize_provider_fetch_result(candidate.adapter_metadata, result)
    except FetchError as exc:
        if (
            exc.code == "RESPONSE_REQUIRES_STREAMING"
            and callable(getattr(fetcher, "fetch_stream", None))
            and callable(getattr(raw_store, "put_snapshot_stream", None))
        ):
            streaming_candidate = replace(
                candidate,
                adapter_metadata={
                    **candidate.adapter_metadata,
                    "streaming_required": True,
                },
            )
            return persist_admitted_fetch(
                candidate=streaming_candidate,
                decision=replace(decision, candidate=streaming_candidate),
                fetcher=fetcher,
                raw_store=raw_store,
                acquisition_run_id=acquisition_run_id,
                robots_policy=robots_policy,
                intent_id=intent_id,
                require_remote_durability=require_remote_durability,
            )
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="FETCH_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.FETCH_FAILED,
            retryable=exc.retryable,
            adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    final_host = urlsplit(result.final_url).hostname or ""
    if not decision.allowed_domains or not hostname_matches(final_host, decision.allowed_domains):
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="FETCH_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.FETCH_FAILED,
            retryable=False, adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            admission_reason="FINAL_URL_OUTSIDE_ADMITTED_DOMAINS",
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    try:
        document = raw_store.put_snapshot(RawSnapshotInput(
            canonical_url=result.final_url, payload=result.body, content_type=result.content_type,
            retrieved_at=result.retrieved_at, http_status=result.status,
            safe_response_headers={key: value for key, value in result.headers.items()
                                   if key.lower() in {"content-type", "etag", "last-modified"}},
            fetch_method=candidate.fetch_strategy or "http", acquisition_run_id=acquisition_run_id,
             source_authority=candidate.declared_authority, source_relationship=candidate.relationship,
             academic_cycle=candidate.academic_cycle, language=candidate.language,
             source_class=candidate.source_class, adapter_id=candidate.adapter_id,
             provider_id=candidate.provider_id, dataset_id=candidate.dataset_id,
             temporal_state=candidate.temporal_state,
             source_resolution=candidate.source_resolution or candidate.adapter_metadata.get("source_resolution"),
             original_url=candidate.original_url or candidate.adapter_metadata.get("original_url"),
             capture_url=candidate.capture_url or candidate.adapter_metadata.get("capture_url"),
             captured_at=candidate.captured_at or candidate.adapter_metadata.get("captured_at"),
             archive_provider=candidate.archive_provider or candidate.adapter_metadata.get("archive_provider"),
         ))
    except RawEvidenceError as exc:
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSIST_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
            retryable=exc.retryable, adapter_id=candidate.adapter_id,
            source_class=candidate.source_class,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            execution_state="HARD_BLOCKED",
            **_candidate_lineage_kwargs(candidate),
        )
    return document, AcquisitionAttempt.create(
        intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSISTED",
        run_id=acquisition_run_id, raw_document_id=document.raw_document_id,
        finished_at=utc_now_iso(), adapter_id=candidate.adapter_id,
        source_class=candidate.source_class,
        provider_id=candidate.provider_id,
        dataset_id=candidate.dataset_id,
        source_authority=candidate.declared_authority,
        source_relationship=candidate.relationship,
        execution_state="RAW_PERSISTED",
        **_candidate_lineage_kwargs(candidate),
    )


class AcquisitionPlatformBackend:
    """Compatibility wrapper with a bounded, evidence-only shadow path."""

    def __init__(
        self,
        discovery: CatalogueDiscovery,
        *,
        event_sink: Callable[[dict[str, Any]], None] | None = None,
        artifact_sink: Callable[[str, dict[str, Any]], None] | None = None,
        mode: str = "legacy",
        registry: SourceRegistry | None = None,
        planner: AcquisitionPlanner | None = None,
        resolver: SourceResolver | None = None,
        fetcher: SafeFetcher | None = None,
        raw_evidence_store: RawEvidenceStore | None = None,
        acquisition_run_id: str | None = None,
        source_ecosystem: SourceEcosystemConfig | Mapping[str, Any] | None = None,
    ) -> None:
        if mode not in {"legacy", "platform_shadow"}:
            raise ValueError("Acquisition backend must be legacy or platform_shadow.")
        self.mode = mode
        self.official_adapter = OfficialCatalogueAdapter(discovery)
        if isinstance(source_ecosystem, SourceEcosystemConfig):
            self.source_ecosystem = source_ecosystem
        elif source_ecosystem is None:
            self.source_ecosystem = SourceEcosystemConfig()
        else:
            self.source_ecosystem = SourceEcosystemConfig.from_dict(
                source_ecosystem
            )
        # Keep the provider catalogue available to both the registry and the
        # configured decision bridge.  Previously ``build_source_registry``
        # resolved it only in a local variable, which registered adapters but
        # left ``adapter_configuration`` empty at acquisition time.
        self.source_ecosystem = _ecosystem_with_catalogue(self.source_ecosystem)
        self.fetcher = fetcher
        self.raw_evidence_store = raw_evidence_store
        self.acquisition_run_id = acquisition_run_id
        self._coverage_events: list[dict[str, Any]] = []
        self.registry = registry or build_source_registry(
            self.source_ecosystem,
            discovery=discovery,
            official_adapter=self.official_adapter,
            fetcher=self.fetcher,
        )
        self.planner = planner or AcquisitionPlanner(
            mode=self.source_ecosystem.acquisition_mode
        )
        self.resolver = resolver or SourceResolver()
        self.event_sink = event_sink
        self.artifact_sink = artifact_sink

    def _context_configuration(
        self,
        *,
        seed: InstitutionSeed | None,
        policy: Any | None,
    ) -> dict[str, Any]:
        configuration = self.source_ecosystem.adapter_configuration(
            seed.institution_id if seed else None
        )
        configuration["robots_policy"] = policy
        return configuration

    def _emit(self, event: dict[str, Any]) -> None:
        if self.event_sink:
            self.event_sink(event)

    def _artifact(self, stream: str, row: dict[str, Any]) -> None:
        if self.artifact_sink:
            self.artifact_sink(stream, row)

    def _record_resolution(
        self,
        *,
        intent: AcquisitionIntent,
        candidates: list[SourceCandidate],
        attempts: list[AcquisitionAttempt],
        decisions: list[SourceAdmissionDecision],
    ) -> None:
        artifact_run_id = self.acquisition_run_id or "local-shadow"
        self._artifact(
            "acquisition_intents",
            intent_row(intent, run_id=artifact_run_id),
        )
        self._emit({
            "event": "acquisition_intent",
            "intent_id": intent.intent_id,
            "field_groups": list(intent.field_groups),
            "at": utc_now_iso(),
        })
        for candidate in candidates:
            self._coverage_events.append({
                "source_class": candidate.source_class,
                "status": "DISCOVERED",
                "execution_state": "CANDIDATES_FOUND",
                "provider_id": candidate.provider_id,
                "adapter_id": candidate.adapter_id,
            })
            self._artifact(
                "source_candidates",
                candidate_row(
                    candidate,
                    run_id=artifact_run_id,
                    intent_id=intent.intent_id,
                ),
            )
            self._artifact(
                "source_discovery_evidence",
                discovery_evidence_row(
                    candidate,
                    run_id=artifact_run_id,
                    discovery_evidence_id=stable_id(
                        "source-discovery-evidence",
                        candidate.candidate_id,
                        candidate.discovery_method or "",
                    ),
                ),
            )
        # Adapter-level discovery attempts carry the no-yield, unsupported,
        # and discovery-failure states that have no candidate row to report.
        # Successful discovery is already represented by one candidate event
        # per candidate, so avoid double-counting its legacy DISCOVERED status.
        for attempt in attempts:
            if attempt.status == "DISCOVERED":
                continue
            if not attempt.source_class:
                continue
            self._coverage_events.append({
                "source_class": attempt.source_class,
                "status": attempt.status,
                "execution_state": attempt.execution_state,
                "adapter_id": attempt.adapter_id,
                "provider_id": attempt.provider_id,
            })
        self._emit({
            "event": "source_candidates_generated",
            "intent_id": intent.intent_id,
            "adapter_id": "registry",
            "count": len(candidates),
            "at": utc_now_iso(),
        })
        for decision in decisions:
            self._coverage_events.append({
                "source_class": decision.candidate.source_class,
                "status": "ADMITTED" if decision.admitted else "ADMISSION_REJECTED",
                "execution_state": "ADMITTED" if decision.admitted else "HARD_BLOCKED",
                "admitted": decision.admitted,
                "provider_id": decision.candidate.provider_id,
                "adapter_id": decision.candidate.adapter_id,
            })
            factors = dict(decision.factor_scores)
            self._artifact(
                "source_admission_decisions",
                admission_row(
                    decision,
                    run_id=artifact_run_id,
                    admission_decision_id=stable_id(
                        "source-admission",
                        intent.intent_id,
                        decision.candidate.candidate_id,
                        decision.reason,
                    ),
                    intent_id=intent.intent_id,
                ),
            )
            attempts.append(decision.to_attempt(
                intent_id=intent.intent_id,
                run_id=self.acquisition_run_id,
            ))
            self._emit({
                "event": "source_candidate_admission",
                "intent_id": intent.intent_id,
                "candidate_id": decision.candidate.candidate_id,
                "adapter_id": decision.candidate.adapter_id,
                "source_class": decision.candidate.source_class,
                "relationship": (
                    decision.candidate.relationship.value
                    if decision.candidate.relationship else None
                ),
                "admitted": decision.admitted,
                "reason": decision.reason,
                "factor_scores": factors,
                "at": utc_now_iso(),
            })
        for attempt in attempts:
            self._artifact(
                "acquisition_attempts",
                attempt_row(attempt, run_id=artifact_run_id),
            )

    def acquire_intent(
        self,
        intent: AcquisitionIntent,
        context: SourceAdapterContext,
        *,
        fetch_admitted: bool = False,
        max_fetches: int = 1,
    ) -> tuple[list[SourceAdmissionDecision], list[AcquisitionAttempt]]:
        """Run a bounded planner/registry/resolver/persist shadow cycle."""
        candidates, attempts = self.registry.discover(intent, context)
        decisions = self.resolver.resolve(
            candidates,
            seed=context.seed,
            intent=intent,
        )
        self._record_resolution(
            intent=intent,
            candidates=candidates,
            attempts=attempts,
            decisions=decisions,
        )
        if not fetch_admitted:
            return decisions, attempts
        if not self.fetcher or not self.raw_evidence_store:
            attempt = AcquisitionAttempt.create(
                intent_id=intent.intent_id,
                candidate_id=None,
                status="RAW_PERSIST_FAILED",
                run_id=self.acquisition_run_id,
                error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
                retryable=False,
                admission_reason="SHADOW_FETCH_REQUIRES_REMOTE_STORE_AND_FETCHER",
                source_class=_preferred_source_class(intent, ()),
                execution_state="HARD_BLOCKED",
            )
            attempts.append(attempt)
            self._artifact("acquisition_attempts", attempt.to_dict())
            return decisions, attempts
        require_remote_durability = not self.source_ecosystem.runtime_acquisition_enabled
        if (
            require_remote_durability
            and getattr(
                self.raw_evidence_store,
                "durability",
                RawEvidenceDurability.LOCAL_ONLY,
            )
            != RawEvidenceDurability.REMOTE_DURABLE
        ):
            attempt = AcquisitionAttempt.create(
                intent_id=intent.intent_id,
                candidate_id=None,
                status="RAW_PERSIST_FAILED",
                run_id=self.acquisition_run_id,
                error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
                retryable=False,
                admission_reason="SHADOW_FETCH_REQUIRES_REMOTE_DURABILITY",
                source_class=_preferred_source_class(intent, ()),
                execution_state="HARD_BLOCKED",
            )
            attempts.append(attempt)
            self._artifact("acquisition_attempts", attempt.to_dict())
            return decisions, attempts

        fetched = 0
        for decision in decisions:
            if not decision.admitted or fetched >= max_fetches:
                continue
            candidate = decision.candidate
            reusable = raw_snapshot_reusable(
                self.raw_evidence_store.list_snapshots(
                    source_identity_for_url(candidate.canonical_locator)
                ),
                target_cycle=intent.target_cycle,
            )
            if reusable:
                attempt = AcquisitionAttempt.create(
                    intent_id=intent.intent_id,
                    candidate_id=candidate.candidate_id,
                    status="RAW_REUSED",
                    run_id=self.acquisition_run_id,
                    raw_document_id=reusable.raw_document_id,
                    finished_at=utc_now_iso(),
                    adapter_id=candidate.adapter_id,
                    source_class=candidate.source_class,
                    provider_id=candidate.provider_id,
                    dataset_id=candidate.dataset_id,
                    source_authority=candidate.declared_authority,
                    source_relationship=candidate.relationship,
                    execution_state="RETRIEVED",
                    **_candidate_lineage_kwargs(candidate),
                )
            else:
                document, attempt = persist_admitted_fetch(
                    candidate=candidate,
                    decision=decision,
                    fetcher=self.fetcher,
                    raw_store=self.raw_evidence_store,
                    acquisition_run_id=self.acquisition_run_id,
                    robots_policy=context.configuration.get("robots_policy"),
                    intent_id=intent.intent_id,
                    require_remote_durability=require_remote_durability,
                )
                if document:
                    fetched += 1
            attempts.append(attempt)
            self._coverage_events.append({
                "source_class": candidate.source_class,
                "status": attempt.status,
                "execution_state": attempt.execution_state,
                "admitted": decision.admitted,
                "provider_id": candidate.provider_id,
                "adapter_id": candidate.adapter_id,
            })
            self._artifact("acquisition_attempts", attempt.to_dict())
            self._emit({
                "event": (
                    "raw_reused"
                    if attempt.status == "RAW_REUSED" else "source_fetch"
                ),
                "intent_id": intent.intent_id,
                "candidate_id": candidate.candidate_id,
                "raw_document_id": attempt.raw_document_id,
                "status": attempt.status,
                "at": utc_now_iso(),
            })
        return decisions, attempts

    def configured_source_decisions(
        self,
        seed: InstitutionSeed,
        policy: Any,
        *,
        field_groups: Iterable[str] | None = None,
        entity: EntityRef | None = None,
    ) -> list[tuple[AcquisitionIntent, SourceAdmissionDecision]]:
        """Discover/admit explicitly configured ecosystem resources.

        The established pipeline owns fetching/parsing so local runs retain
        their existing raw-file behaviour.  This bridge only returns admitted
        candidates and records the same source graph as the shadow path.
        """
        if not self.source_ecosystem.runtime_acquisition_enabled:
            return []
        configuration = self._context_configuration(seed=seed, policy=policy)
        requested_fields = tuple(field_groups or self.source_ecosystem.field_groups)
        provider_field_groups = self.planner.provider_field_groups(requested_fields)
        configuration["enforce_provider_field_routing"] = True
        entity = entity or EntityRef("UNIVERSITY", seed.institution_id)
        configuration["source_ecosystem_programme_only"] = (
            str(entity.entity_type).casefold() in {"programme", "program"}
        )
        core_resource_adapters: tuple[tuple[str, str, tuple[str, ...]], ...] = (
            ("manual_source", "official_web_resources", ("official_web",)),
            ("coursedog_catalogue", "coursedog_candidates", ("official_catalogue",)),
            ("pdf_document", "pdf_candidates", ("pdf",)),
            ("json_api", "json_api_resources", ("official_api",)),
            ("ipeds", "ipeds_candidates", ("government_dataset",)),
            ("college_scorecard", "scorecard_candidates", ("government_dataset",)),
            ("fixture_archive", "archive_candidates", ("archive",)),
            ("search_index", "search_results", ("search_discovery", "search_index")),
        )
        external_resource_adapters: tuple[tuple[str, str, tuple[str, ...]], ...] = (
            # Provider-catalogue entries for these two datasets retain their
            # existing specialized contracts. They must be selected from the
            # catalogue itself; requiring a legacy inline candidate would make
            # the configured provider silently disappear.
            ("ipeds", "external_providers", ("government_dataset",)),
            ("college_scorecard", "external_providers", ("government_dataset",)),
            ("government_dataset", "external_providers", ("government_dataset", "government_portal")),
            ("official_registry", "external_providers", ("official_registry", "government_registry", "registry")),
            ("accreditation_registry", "external_providers", ("accreditation", "accreditation_registry")),
            ("official_partner", "external_providers", ("official_partner", "partner", "consortium", "official_application", "catalogue_provider")),
            ("external_authoritative", "external_providers", ("external_authoritative", "trusted_external")),
            ("archive_http", "external_providers", ("archive",)),
            ("search_index", "external_providers", ("search_discovery",)),
        )
        resource_adapters = (
            (*external_resource_adapters, *core_resource_adapters)
            if self.source_ecosystem.acquisition_mode == "external_source_expansion"
            else (*core_resource_adapters, *external_resource_adapters)
        )
        configured: list[tuple[AcquisitionIntent, SourceAdmissionDecision]] = []
        seen_adapters: set[str] = set()
        for adapter_id, resource_key, source_classes in resource_adapters:
            if adapter_id in seen_adapters or adapter_id not in self.registry.adapter_ids:
                continue
            has_resource = bool(configuration.get(resource_key))
            if adapter_id == "search_index" and configuration.get("search_provider"):
                has_resource = True
            if adapter_id == "ipeds" and configuration.get("ipeds_target_config"):
                has_resource = True
            if not has_resource:
                continue
            seen_adapters.add(adapter_id)
            intent_field_groups = (
                provider_field_groups
                if resource_key == "external_providers"
                else requested_fields
            )
            intent = AcquisitionIntent.create(
                entity=entity,
                field_groups=intent_field_groups,
                reason="CONFIGURED_SOURCE_ECOSYSTEM",
                target_cycle=self.source_ecosystem.target_cycle,
                audience=self.source_ecosystem.audience,
                preferred_source_classes=source_classes,
            )
            context = SourceAdapterContext(
                entity=entity,
                seed=seed,
                target_cycle=intent.target_cycle,
                audience=intent.audience,
                field_groups=intent.field_groups,
                configuration=configuration,
            )
            candidates, attempts = self.registry.discover(
                intent,
                context,
                only_adapter_ids=(adapter_id,),
            )
            decisions = self.resolver.resolve(
                candidates, seed=seed, intent=intent
            )
            self._record_resolution(
                intent=intent,
                candidates=candidates,
                attempts=attempts,
                decisions=decisions,
            )
            configured.extend((intent, decision) for decision in decisions)
        return configured

    def record_fetch_result(
        self,
        *,
        intent: AcquisitionIntent,
        decision: SourceAdmissionDecision,
        status: str,
        raw_document_id: str | None = None,
        error_code: AcquisitionFailureCode | None = None,
        admission_reason: str | None = None,
    ) -> AcquisitionAttempt:
        """Persist fetch outcome telemetry with the candidate's provenance."""
        candidate = decision.candidate
        self._coverage_events.append({
            "source_class": candidate.source_class,
            "status": status,
            "execution_state": "RAW_PERSISTED" if status in {"RAW_PERSISTED", "PERSISTED"} else (
                "RETRIEVED" if status in {"RAW_RETRIEVED", "RETRIEVAL_SUCCEEDED"} else "HARD_BLOCKED"
            ),
            "admitted": decision.admitted,
            "provider_id": candidate.provider_id,
            "adapter_id": candidate.adapter_id,
        })
        attempt = AcquisitionAttempt.create(
            intent_id=intent.intent_id,
            candidate_id=candidate.candidate_id,
            status=status,
            run_id=self.acquisition_run_id,
            raw_document_id=raw_document_id,
            error_code=error_code,
            retryable=False,
            finished_at=utc_now_iso(),
            admission_reason=admission_reason,
            source_class=candidate.source_class,
            adapter_id=candidate.adapter_id,
            provider_id=candidate.provider_id,
            dataset_id=candidate.dataset_id,
            source_authority=candidate.declared_authority,
            source_relationship=candidate.relationship,
            execution_state=(
                "RAW_PERSISTED"
                if status in {"RAW_PERSISTED", "PERSISTED"}
                else "RETRIEVED"
                if status in {"RAW_RETRIEVED", "RETRIEVAL_SUCCEEDED"}
                else "HARD_BLOCKED"
            ),
            source_resolution=candidate.source_resolution or candidate.adapter_metadata.get("source_resolution"),
            original_url=candidate.original_url or candidate.adapter_metadata.get("original_url"),
            capture_url=candidate.capture_url or candidate.adapter_metadata.get("capture_url"),
            captured_at=candidate.captured_at or candidate.adapter_metadata.get("captured_at"),
            archive_provider=candidate.archive_provider or candidate.adapter_metadata.get("archive_provider"),
            temporal_state=candidate.temporal_state,
        )
        artifact_run_id = self.acquisition_run_id or "local-shadow"
        self._artifact(
            "acquisition_attempts", attempt_row(attempt, run_id=artifact_run_id)
        )
        self._artifact(
            "source_ecosystem_fetches",
            {
                "run_id": artifact_run_id,
                "intent_id": intent.intent_id,
                "candidate_id": candidate.candidate_id,
                "status": status,
                "raw_document_id": raw_document_id,
                "source_class": candidate.source_class,
                "adapter_id": candidate.adapter_id,
                "provider_id": candidate.provider_id,
                "dataset_id": candidate.dataset_id,
                "source_authority": (
                    candidate.declared_authority.value
                    if candidate.declared_authority
                    else None
                ),
                "source_relationship": (
                    candidate.relationship.value if candidate.relationship else None
                ),
                "temporal_state": candidate.temporal_state.value,
                "execution_state": (
                    "RAW_PERSISTED"
                    if status in {"RAW_PERSISTED", "PERSISTED"}
                    else "RETRIEVED"
                    if status in {"RAW_RETRIEVED", "RETRIEVAL_SUCCEEDED"}
                    else "HARD_BLOCKED"
                ),
                "source_resolution": candidate.source_resolution or candidate.adapter_metadata.get("source_resolution"),
                "original_url": candidate.original_url or candidate.adapter_metadata.get("original_url"),
                "capture_url": candidate.capture_url or candidate.adapter_metadata.get("capture_url"),
                "captured_at": candidate.captured_at or candidate.adapter_metadata.get("captured_at"),
                "archive_provider": candidate.archive_provider or candidate.adapter_metadata.get("archive_provider"),
                "error_code": error_code.value if error_code else None,
                "admission_reason": admission_reason,
            },
        )
        self._emit(
            {
                "event": "source_ecosystem_fetch",
                "intent_id": intent.intent_id,
                "candidate_id": candidate.candidate_id,
                "status": status,
                "raw_document_id": raw_document_id,
                "source_class": candidate.source_class,
                "adapter_id": candidate.adapter_id,
                "provider_id": candidate.provider_id,
                "dataset_id": candidate.dataset_id,
                "at": utc_now_iso(),
            }
        )
        return attempt

    def source_class_coverage(self) -> dict[str, Any]:
        """Return the configured source-class readiness result for this run."""
        configured_classes = {
            normalize_source_class(item.source_class, "")
            for item in self.source_ecosystem.external_providers
            if getattr(item, "enabled", True)
        }
        if self.source_ecosystem.government_datasets_enabled:
            configured_classes.add("government_dataset")
        if self.source_ecosystem.official_web_enabled:
            configured_classes.add("official_web")
        if self.source_ecosystem.official_catalogue_enabled:
            configured_classes.add("official_catalogue")
        if self.source_ecosystem.structured_apis_enabled:
            configured_classes.add("structured_api")
        if self.source_ecosystem.pdf_enabled:
            configured_classes.add("pdf")
        if self.source_ecosystem.archives_enabled:
            configured_classes.add("archive")
        if self.source_ecosystem.external_authoritative_enabled:
            configured_classes.add("external_authoritative")
        if self.source_ecosystem.official_registries_enabled:
            configured_classes.add("official_registry")
        if self.source_ecosystem.accreditation_enabled:
            configured_classes.add("accreditation")
        if self.source_ecosystem.official_partners_enabled:
            configured_classes.add("official_partner")
        if self.source_ecosystem.search_discovery_enabled or self.source_ecosystem.search_provider:
            configured_classes.add("search_discovery")
        configured_classes.update(
            normalize_source_class(item.get("source_class"), "")
            for collection in (
                self.source_ecosystem.official_web_resources,
                self.source_ecosystem.pdf_candidates,
                self.source_ecosystem.json_api_resources,
                self.source_ecosystem.ipeds_candidates,
                self.source_ecosystem.scorecard_candidates,
                self.source_ecosystem.archive_candidates,
            )
            for item in collection
            if item.get("source_class")
        )
        result = SourceClassCoverageGate(
            self.source_ecosystem.required_source_classes
        ).evaluate(
            registry=self.registry,
            configured_source_classes=configured_classes,
            events=self._coverage_events,
        )
        return result.to_dict()

    def discover(
        self,
        seed: InstitutionSeed,
        policy: Any,
    ) -> tuple[list[ProgrammeCandidate], list[str], list[str]]:
        if self.mode == "legacy":
            intent = AcquisitionIntent.create(
                entity=EntityRef("UNIVERSITY", seed.institution_id),
                field_groups=("identity",),
                reason="PROGRAMME_DISCOVERY",
                preferred_source_classes=("official_catalogue",),
            )
            self.official_adapter.discover(intent, SourceAdapterContext(
                entity=intent.entity,
                seed=seed,
                field_groups=intent.field_groups,
                configuration=self._context_configuration(
                    seed=seed, policy=policy
                ),
            ))
        else:
            intent = self.planner.plan(
                entity=EntityRef("UNIVERSITY", seed.institution_id),
                field_groups=("identity",),
            )[0]
            self.acquire_intent(
                intent,
                SourceAdapterContext(
                    entity=intent.entity,
                    seed=seed,
                    field_groups=intent.field_groups,
                    configuration=self._context_configuration(
                        seed=seed, policy=policy
                    ),
                ),
                fetch_admitted=False,
            )
        return (
            self.official_adapter.last_programme_candidates,
            self.official_adapter.last_sitemaps,
            self.official_adapter.last_errors,
        )
