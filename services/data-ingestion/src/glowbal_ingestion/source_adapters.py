"""Field-directed source acquisition primitives for the Slice B shadow path.

The module intentionally stops at discovered/admitted sources.  It neither
extracts assertions nor changes canonical/promotion behaviour.  Existing
native discovery remains the operational implementation behind the official
catalogue adapter while this layer records why an evidence source is eligible.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any, Callable, Iterable, Mapping, Protocol, Sequence, runtime_checkable
from urllib.parse import urlsplit

from .acquisition import (
    AcquisitionAttempt,
    AcquisitionFailureCode,
    AcquisitionIntent,
    EntityRef,
    SourceCandidate,
)
from .config import ExternalSourceRule, InstitutionSeed
from .discovery import CatalogueDiscovery, ProgrammeCandidate
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


URL_LOCATOR_TYPES = frozenset({"url", "pdf", "json_api", "archive", "manual"})


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
        return AcquisitionAttempt.create(
            intent_id=intent_id,
            candidate_id=self.candidate.candidate_id,
            status="ADMITTED" if self.admitted else "REJECTED_BY_POLICY",
            run_id=run_id,
            error_code=(
                None
                if self.admitted
                else AcquisitionFailureCode.SOURCE_REJECTED_BY_POLICY
            ),
            retryable=False,
            admission_reason=self.reason,
            adapter_id=self.candidate.adapter_id,
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

    def adapters_for(
        self, intent: AcquisitionIntent, context: SourceAdapterContext
    ) -> tuple[SourceAdapter, ...]:
        return tuple(adapter for adapter in self.ordered() if adapter.supports(intent, context))

    def discover(
        self, intent: AcquisitionIntent, context: SourceAdapterContext
    ) -> tuple[list[SourceCandidate], list[AcquisitionAttempt]]:
        candidates: list[SourceCandidate] = []
        attempts: list[AcquisitionAttempt] = []
        adapters = self.adapters_for(intent, context)
        if not adapters:
            attempts.append(AcquisitionAttempt.create(
                intent_id=intent.intent_id, candidate_id=None, status="NO_SUPPORTED_ADAPTER",
                error_code=AcquisitionFailureCode.NO_SOURCE_CANDIDATES,
                discriminator="no-supported-adapter",
            ))
            return candidates, attempts
        for adapter in adapters:
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
                    discriminator="adapter-discovery",
                ))
                continue
            candidates.extend(found)
            attempts.append(AcquisitionAttempt.create(
                intent_id=intent.intent_id, candidate_id=None,
                status="DISCOVERED" if found else "NO_CANDIDATES",
                error_code=(None if found else AcquisitionFailureCode.NO_SOURCE_CANDIDATES),
                adapter_id=adapter.adapter_id,
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
        for rule in seed.external_source_rules:
            if (
                candidate.adapter_id == rule.adapter_id
                and hostname_matches(host, (rule.domain,))
                and candidate.relationship == rule.relationship
                and candidate.declared_authority == rule.authority
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
        if candidate.locator_type in URL_LOCATOR_TYPES:
            try:
                normalized = replace(candidate, canonical_locator=canonicalize_url(candidate.canonical_locator))
            except UnsafeUrlError:
                return SourceAdmissionDecision(candidate, False, "INVALID_URL", {}, 0)
        rule: ExternalSourceRule | None = None
        allowed_domains: tuple[str, ...] = ()
        if seed and candidate.locator_type in URL_LOCATOR_TYPES:
            host = urlsplit(normalized.canonical_locator).hostname or ""
            if hostname_matches(host, seed.all_allowed_domains):
                allowed_domains = seed.all_allowed_domains
            else:
                rule = self._external_rule(normalized, seed)
                if not rule:
                    return SourceAdmissionDecision(normalized, False, "EXTERNAL_DOMAIN_NOT_EXPLICITLY_ALLOWED", {}, 0)
                if not normalized.relationship_evidence:
                    return SourceAdmissionDecision(normalized, False, "RELATED_SOURCE_REQUIRES_RELATIONSHIP_EVIDENCE", {}, 0)
                if normalized.discovery_method in {"text_mention", "search_snippet"}:
                    return SourceAdmissionDecision(normalized, False, "TEXT_MENTION_IS_NOT_FETCH_ADMISSION", {}, 0)
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
            source_classes = self._FIELD_PLANS.get(field_group, ("official_web", "official_catalogue", "pdf"))
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
            academic_cycle=item.get("academic_cycle"),
        ) for item in context.configuration.get("coursedog_candidates", ())
          if isinstance(item, Mapping) and item.get("url")]


class ManualSourceAdapter:
    adapter_id = "manual_source"
    priority = 5

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool(context.seed and context.seed.manual_programme_urls)

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        assert context.seed is not None
        return [SourceCandidate.create(
            canonical_locator=url, locator_type="manual", source_class="official_web",
            adapter_id=self.adapter_id, publisher_key=context.seed.official_domain,
            relationship=SourceRelationship.DIRECT_OFFICIAL,
            relationship_evidence=("explicit institution seed",),
            declared_authority=SourceAuthority.OFFICIAL,
            expected_field_groups=intent.field_groups, discovery_method="manual_seed",
        ) for url in context.seed.manual_programme_urls]


class PdfDocumentCandidateAdapter:
    adapter_id = "pdf_document"
    priority = 30

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
                candidates.append(SourceCandidate.create(
                    canonical_locator=url, locator_type="pdf", source_class="pdf", adapter_id=self.adapter_id,
                    relationship=SourceRelationship.DIRECT_OFFICIAL,
                    relationship_evidence=("catalogue/document link",), declared_authority=SourceAuthority.OFFICIAL,
                    expected_field_groups=intent.field_groups, discovery_method="document_link",
                    adapter_metadata={"field_directed_score": score, "title": title},
                ))
        return candidates


class JsonApiSourceAdapter:
    adapter_id = "json_api"
    priority = 20

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return bool(context.configuration.get("json_api_resources"))

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return [SourceCandidate.create(
            canonical_locator=str(item["url"]), locator_type="json_api", source_class="official_api",
            adapter_id=self.adapter_id, provider_id=str(item.get("provider_id") or "official-api"),
            dataset_id=str(item.get("dataset_id") or "") or None,
            relationship=SourceRelationship.DIRECT_OFFICIAL,
            relationship_evidence=("configured API resource",), declared_authority=SourceAuthority.OFFICIAL,
            expected_field_groups=tuple(item.get("field_groups") or intent.field_groups),
            academic_cycle=item.get("academic_cycle"), discovery_method="configured_api",
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
    ) -> SourceCandidate:
        return SourceCandidate.create(
            canonical_locator=locator, locator_type="provider_resource", source_class=self.source_class,
            adapter_id=self.adapter_id, provider_id=self.provider_id, dataset_id=dataset_id,
            relationship=SourceRelationship.GOVERNMENT, relationship_evidence=("government dataset metadata",),
            declared_authority=SourceAuthority.GOVERNMENT, expected_field_groups=field_groups,
            academic_cycle=academic_cycle, retrieved_at=retrieved_at,
            discovery_method="structured_dataset",
        )


class IpedsSourceAdapter(StructuredDatasetAdapter):
    adapter_id = "ipeds"
    provider_id = "IPEDS"

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return list(context.configuration.get("ipeds_candidates", ()))

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

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        return list(context.configuration.get("scorecard_candidates", ()))

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

    def __init__(self, provider: SearchProvider) -> None:
        self.provider = provider

    def supports(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> bool:
        return "search_index" in intent.preferred_source_classes

    def discover(self, intent: AcquisitionIntent, context: SourceAdapterContext) -> list[SourceCandidate]:
        query = " ".join((context.seed.name if context.seed else context.entity.entity_id, *intent.field_groups))
        return [SourceCandidate.create(
            canonical_locator=str(item["url"]), locator_type="url", source_class="search_index",
            adapter_id=self.adapter_id, provider_id=self.provider.provider_id,
            declared_authority=SourceAuthority.OTHER, relationship=SourceRelationship.OTHER_RELATED,
            expected_field_groups=intent.field_groups, discovery_method="search_snippet",
            discovery_evidence=str(item.get("snippet") or ""),
        ) for item in self.provider.search(query) if item.get("url")]


class FixtureArchiveAdapter:
    adapter_id = "fixture_archive"
    priority = 70

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
) -> tuple[RawDocument | None, AcquisitionAttempt]:
    """Fetch admitted evidence and persist it before any parser can consume it.

    This small helper is used by the shadow-path contract tests. Existing
    pipeline fetch/parse remains the production compatibility path.
    """
    if not decision.admitted:
        return None, decision.to_attempt(intent_id=intent_id, run_id=acquisition_run_id)
    if getattr(raw_store, "durability", RawEvidenceDurability.LOCAL_ONLY) != RawEvidenceDurability.REMOTE_DURABLE:
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSIST_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
            retryable=False,
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
            admission_reason="ROBOTS_POLICY_REQUIRED",
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
        )
    try:
        result: FetchResult = fetcher.fetch(
            candidate.canonical_locator, allowed_domains=decision.allowed_domains,
        )
    except FetchError as exc:
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="FETCH_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.FETCH_FAILED,
            retryable=exc.retryable,
            adapter_id=candidate.adapter_id,
        )
    final_host = urlsplit(result.final_url).hostname or ""
    if not decision.allowed_domains or not hostname_matches(final_host, decision.allowed_domains):
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="FETCH_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.FETCH_FAILED,
            retryable=False, adapter_id=candidate.adapter_id,
            admission_reason="FINAL_URL_OUTSIDE_ADMITTED_DOMAINS",
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
        ))
    except RawEvidenceError as exc:
        return None, AcquisitionAttempt.create(
            intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSIST_FAILED",
            run_id=acquisition_run_id, error_code=AcquisitionFailureCode.RAW_PERSIST_FAILED,
            retryable=exc.retryable, adapter_id=candidate.adapter_id,
        )
    return document, AcquisitionAttempt.create(
        intent_id=intent_id, candidate_id=candidate.candidate_id, status="RAW_PERSISTED",
        run_id=acquisition_run_id, raw_document_id=document.raw_document_id,
        finished_at=utc_now_iso(), adapter_id=candidate.adapter_id,
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
    ) -> None:
        if mode not in {"legacy", "platform_shadow"}:
            raise ValueError("Acquisition backend must be legacy or platform_shadow.")
        self.mode = mode
        self.official_adapter = OfficialCatalogueAdapter(discovery)
        self.registry = registry or SourceRegistry((self.official_adapter,))
        self.planner = planner or AcquisitionPlanner()
        self.resolver = resolver or SourceResolver()
        self.fetcher = fetcher
        self.raw_evidence_store = raw_evidence_store
        self.acquisition_run_id = acquisition_run_id
        self.event_sink = event_sink
        self.artifact_sink = artifact_sink

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
        self._emit({
            "event": "source_candidates_generated",
            "intent_id": intent.intent_id,
            "adapter_id": "registry",
            "count": len(candidates),
            "at": utc_now_iso(),
        })
        for decision in decisions:
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
            )
            attempts.append(attempt)
            self._artifact("acquisition_attempts", attempt.to_dict())
            return decisions, attempts
        if (
            getattr(
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
                )
                if document:
                    fetched += 1
            attempts.append(attempt)
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
                configuration={"robots_policy": policy},
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
                    configuration={"robots_policy": policy},
                ),
                fetch_admitted=False,
            )
        return (
            self.official_adapter.last_programme_candidates,
            self.official_adapter.last_sitemaps,
            self.official_adapter.last_errors,
        )
