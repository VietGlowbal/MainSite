from __future__ import annotations

import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, replace
from pathlib import Path
from urllib.parse import urlsplit

from .admission import build_admission_package, evaluate_package
from .approved_assertions import ApprovedAssertionRepository
from .best_assertions import merge_best_assertions, prefer_human_verified
from .config import InstitutionSeed, SmokeConfig
from .crawl4ai_adapter import (
    Crawl4AIAdapterError,
    Crawl4AIRenderer,
    rendered_page_is_useful,
    require_crawl4ai,
    should_render_page,
)
from .deepseek import DeepSeekClient, DeepSeekError, ExtractionSource
from .deterministic import (
    extract_deterministic_facts,
    extract_source_excerpt_assertions,
)
from .discovery import CatalogueDiscovery
from .fetcher import FetchError, SafeFetcher
from .inheritance import (
    cache_shared_assertions,
    fields_to_extract,
    inherited_assertions_for_programme,
    merge_current_and_inherited,
    with_review_fingerprint,
)
from .models import (
    ADMISSION_PACKAGE_FIELDS,
    DEEP_FIELDS,
    EXTRACTION_FIELD_GROUPS,
    CrawlError,
    FetchResult,
    FieldAssertion,
    NullReason,
    PageType,
    PolicyStatus,
    ProgrammeOffering,
    ProgrammeRecord,
    SCHOOL_PROFILE_FIELDS,
    SourceDocument,
    VerificationStatus,
    has_semantic_value,
    stable_id,
    utc_now_iso,
)
from .normalization import (
    apply_programme_priorities,
    candidate_to_programme,
    choose_deep_programmes,
    infer_degree_from_source_text,
    programme_is_selection_eligible,
    refine_programme_name_from_title,
)
from .parsing import classify_page, normalize_text, parse_html, parse_pdf
from .policy import RobotsPolicy, check_policy
from .scrapy_adapter import ScrapyDiscoveryAdapter, require_scrapy
from .storage import JsonlStore, RunPaths, StateStore
from .url_safety import (
    UnsafeUrlError,
    canonicalize_url,
    hostname_matches,
    is_nonproduction_hostname,
)
from .validation import (
    INACTIVE_PROGRAMME_STATUSES,
    evidence_supported,
    explicit_not_required_evidence,
    fact_to_assertion,
    normalize_programme_status,
    null_assertion,
    programme_identity_supported,
    validate_assertion_set,
)


RELATED_LINK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "programme_admission",
        re.compile(
            r"\b(?:admissions?|entry requirements?|application requirements?|"
            r"admission criteria|admission eligibility|how to apply|"
            r"required documents?|supporting documents?|application materials?|"
            r"application components?|application checklist|credentials?|"
            r"references?|referees?|recommendation "
            r"letters?|statement of purpose|personal statement|motivation "
            r"letter|degree certificate|graduation certificate|academic "
            r"transcript|official transcript)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "programme_detail",
        re.compile(
            r"\b(?:programme?|course|department|faculty)\s+website\b|"
            r"\bvisit\s+(?:the\s+)?(?:programme?|course)\s+(?:site|page)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "curriculum",
        re.compile(
            r"\b(?:curriculum|degree requirements?|programme? requirements?|"
            r"program requirements?|course requirements?|programme? sheets?|"
            r"program sheets?|degree plan|plan of study|study plan|"
            r"course sequence|academic handbook|tracks?|"
            r"speciali[sz]ations?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "english_requirement",
        re.compile(
            r"\b(?:english(?: language)? requirements?|ielts|toefl|duolingo)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "tuition",
        re.compile(
            r"\b(?:tuition|fees?|costs?|costs? of attendance|study costs?|"
            r"estimated expenses?|student budget|tuition rates?|billing)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "deadline",
        re.compile(
            r"\b(?:deadlines?|application dates?|key dates?|important dates?|"
            r"admissions? timeline|application schedule|intakes?|start dates?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "scholarship",
        re.compile(
            r"\b(?:scholarships?|financial aid|funding opportunities?|"
            r"fellowships?|assistantships?|grants and awards)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "career_outcome",
        re.compile(
            r"\b(?:careers?|career prospects?|graduate outcomes?|"
            r"employment outcomes?|career paths?|placements?|"
            r"where graduates work)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "international_admission",
        re.compile(
            r"\b(?:international admissions?|international applicants?)\b",
            re.IGNORECASE,
        ),
    ),
)

SOURCE_CATEGORY_BY_PAGE_TYPE: dict[str, str] = {
    PageType.PROGRAMME_ADMISSION.value: "programme_admission",
    PageType.INTERNATIONAL_ADMISSION.value: "programme_admission",
    PageType.ENGLISH_REQUIREMENT.value: "english_requirement",
    PageType.TUITION.value: "tuition",
    PageType.DEADLINE.value: "deadline",
    PageType.SCHOLARSHIP.value: "scholarship",
    PageType.CAREER_OUTCOME.value: "career_outcome",
}
ADMISSION_PACKAGE_LINK_RE = re.compile(
    r"\b(?:admissions?|apply|application|entry requirements?|"
    r"supporting documents?|required documents?|application checklist|"
    r"references?|referees?|recommendation letters?|statement of purpose|"
    r"personal statement|motivation letter|degree certificate|"
    r"graduation certificate|diploma|proof of degree|academic transcript|"
    r"official transcript|academic record|mark sheet)\b",
    re.IGNORECASE,
)
OFF_SCOPE_RE = re.compile(
    r"/(?:news|events?|people|staff|blog|press|alumni|login|privacy|"
    r"accessibility|contact|support|safety)(?:/|$)",
    re.IGNORECASE,
)
RELATED_LINK_PATTERN_BY_CATEGORY = dict(RELATED_LINK_PATTERNS)
COVERAGE_RETRY_FIELD_CATEGORIES: dict[str, tuple[str, ...]] = {
    "programme_focus": ("programme_detail", "curriculum"),
    "curriculum_overview": ("curriculum",),
    "learning_outcomes": ("curriculum", "career_outcome"),
    "admission_difficulty": ("programme_admission",),
    "recommendation_letters": ("programme_admission",),
    "sop_essay_requirements": ("programme_admission",),
    "graduation_certificate": ("programme_admission",),
    "academic_transcript": ("programme_admission",),
    "application_fee": ("programme_admission", "tuition"),
    "tuition": ("tuition",),
    "additional_fees": ("tuition",),
    "scholarships": ("scholarship",),
    "career_outcomes": ("career_outcome",),
    "employment_outcomes": ("career_outcome",),
}
COVERAGE_RETRY_FIELDS = tuple(COVERAGE_RETRY_FIELD_CATEGORIES)
DEEP_FIELD_RECOVERY_FIELDS: frozenset[str] = frozenset(
    {
        "programme_focus",
        "curriculum_overview",
        "learning_outcomes",
        "admission_difficulty",
        "career_outcomes",
        "employment_outcomes",
    }
)
ALWAYS_DEEP_RECOVERY_FIELDS: frozenset[str] = frozenset(
    {
        "programme_focus",
        "curriculum_overview",
        "learning_outcomes",
    }
)


def review_decision(
    *,
    programme_status: str | None,
    rejected_count: int,
    needs_review_count: int,
    accepted_non_null_count: int,
) -> str:
    normalized_status = normalize_programme_status(programme_status)
    if normalized_status in INACTIVE_PROGRAMME_STATUSES:
        return "INACTIVE_PROGRAMME"
    if rejected_count and not accepted_non_null_count:
        return "BLOCKED_BY_VALIDATION"
    if rejected_count:
        return "PARTIAL_DATA_REVIEW_REQUIRED"
    if needs_review_count:
        return "HUMAN_REVIEW_REQUIRED"
    return "RULE_VALIDATED"


def dedupe_equivalent_assertions(
    assertions: list[FieldAssertion],
) -> list[FieldAssertion]:
    """Keep one richest representation for identical field evidence."""
    selected: dict[tuple[str, str, str], FieldAssertion] = {}
    order: list[tuple[str, str, str]] = []
    for assertion in assertions:
        key = (
            assertion.field_name,
            assertion.source_url or "",
            normalize_text(assertion.evidence or "").casefold(),
        )
        previous = selected.get(key)
        if previous is None:
            selected[key] = assertion
            order.append(key)
            continue

        def richness(item: FieldAssertion) -> tuple[int, int]:
            value = item.value_json
            structured = 2 if isinstance(value, dict) else int(
                isinstance(value, list)
            )
            return (
                structured,
                len(
                    json.dumps(
                        value,
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                ),
            )

        if richness(assertion) > richness(previous):
            selected[key] = assertion
    return [selected[key] for key in order]


@dataclass
class RunMetrics:
    institutions_total: int = 0
    institutions_completed: int = 0
    institutions_blocked: int = 0
    school_profiles_attempted: int = 0
    school_profiles_extracted: int = 0
    programmes_discovered: int = 0
    deep_programmes_attempted: int = 0
    deep_programmes_extracted: int = 0
    admission_retry_programmes: int = 0
    admission_retry_sources: int = 0
    coverage_retry_programmes: int = 0
    coverage_retry_sources: int = 0
    coverage_retry_groups: int = 0
    status_preflight_attempted: int = 0
    status_preflight_inactive_candidates: int = 0
    sources_fetched: int = 0
    scrapy_links_discovered: int = 0
    render_attempts: int = 0
    render_successes: int = 0
    graph_guided_sources: int = 0
    source_excerpt_fallback_assertions: int = 0
    assertions_total: int = 0
    assertions_non_null: int = 0
    assertions_rejected: int = 0
    assertions_needs_review: int = 0
    shared_bundles_upserted: int = 0
    inherited_assertions: int = 0
    inherited_field_slots: int = 0
    selective_extraction_programmes: int = 0
    extraction_fields_skipped: int = 0
    approved_baseline_programmes: int = 0
    approved_baseline_assertions: int = 0
    errors: int = 0
    started_at: str = field(default_factory=utc_now_iso)
    completed_at: str | None = None
    elapsed_seconds: float = 0.0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def add(self, **increments: int) -> None:
        with self._lock:
            for key, value in increments.items():
                setattr(self, key, int(getattr(self, key)) + value)

    def to_dict(self) -> dict[str, object]:
        with self._lock:
            return {
                key: value
                for key, value in vars(self).items()
                if key != "_lock"
            }


class SmokePipeline:
    EXTRACTOR_VERSION = "glowbal-smoke-0.7.1"
    COMPATIBLE_ASSERTION_EXTRACTORS = frozenset(
        {
            "glowbal-smoke-0.6.1",
            "glowbal-smoke-0.7.0",
            EXTRACTOR_VERSION,
        }
    )

    def __init__(
        self,
        config: SmokeConfig,
        run_dir: Path,
        *,
        allow_unreviewed_terms: bool,
        discovery_only: bool,
        show_progress: bool = False,
        discovery_backend: str = "native",
        render_policy: str = "off",
        target_fields: tuple[str, ...] | None = None,
        skip_school_profile: bool = False,
    ) -> None:
        if discovery_backend not in {"native", "scrapy", "hybrid"}:
            raise ValueError(
                "discovery_backend must be native, scrapy or hybrid."
            )
        if render_policy not in {"off", "auto", "always"}:
            raise ValueError("render_policy must be off, auto or always.")
        if discovery_backend in {"scrapy", "hybrid"}:
            require_scrapy()
        if render_policy != "off":
            require_crawl4ai()
        if target_fields is not None:
            normalized_target_fields = tuple(
                dict.fromkeys(str(field).strip() for field in target_fields if str(field).strip())
            )
            unknown_fields = sorted(
                set(normalized_target_fields).difference(DEEP_FIELDS)
            )
            if unknown_fields:
                raise ValueError(
                    "Unknown target field(s): " + ", ".join(unknown_fields)
                )
            if not normalized_target_fields:
                raise ValueError("target_fields must contain at least one field.")
            target_fields = normalized_target_fields
        self.config = config
        self.paths = RunPaths.create(run_dir)
        self.store = JsonlStore(self.paths)
        self.state = StateStore(run_dir / "crawl_state.sqlite")
        shared_cache_dir = run_dir.parent / "_cache"
        shared_cache_dir.mkdir(parents=True, exist_ok=True)
        self.llm_state = StateStore(
            shared_cache_dir / "deepseek_cache.sqlite"
        )
        self.fetcher = SafeFetcher(config.limits)
        self.show_progress = show_progress
        self._progress_lock = threading.RLock()
        self._discovery_graph_lock = threading.RLock()
        self._discovery_graph: dict[
            str, list[dict[str, object]]
        ] = {}
        self._institutions_finished = 0
        scrapy_adapter = (
            ScrapyDiscoveryAdapter(config.limits, self._progress)
            if discovery_backend in {"scrapy", "hybrid"}
            else None
        )
        self.discovery_backend = discovery_backend
        self.render_policy = render_policy
        self.renderer = (
            Crawl4AIRenderer(config.limits, self._progress)
            if render_policy != "off"
            else None
        )
        self.discovery = CatalogueDiscovery(
            self.fetcher,
            self._progress,
            backend=discovery_backend,
            scrapy_adapter=scrapy_adapter,
            graph_sink=self._record_discovery_edge,
        )
        self.deepseek = DeepSeekClient(
            config,
            self.llm_state,
            self._progress,
        )
        self.approved_assertions = (
            ApprovedAssertionRepository.from_environment()
        )
        self.allow_unreviewed_terms = allow_unreviewed_terms
        self.discovery_only = discovery_only
        # A targeted run is a delta run: only these deep fields are extracted
        # and materialised.  Existing full snapshots must be merged field-wise
        # before import; a delta must never replace unrelated fields with nulls.
        self.target_fields = target_fields
        self.skip_school_profile = skip_school_profile
        self.metrics = RunMetrics(institutions_total=len(config.institutions))
        self._coverage_lock = threading.Lock()
        self._coverage_slots: set[tuple[str, str]] = set()
        self._non_null_slots: set[tuple[str, str]] = set()
        self._not_applicable_slots: set[tuple[str, str]] = set()
        self._start_monotonic = 0.0
        self._optional_phd_lock = threading.Lock()
        self._optional_phd_used = 0

    @staticmethod
    def _elapsed_label(seconds: float) -> str:
        total = max(0, int(seconds))
        hours, remainder = divmod(total, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def _progress(self, message: str) -> None:
        if not self.show_progress:
            return
        with self._progress_lock:
            elapsed = (
                time.monotonic() - self._start_monotonic
                if self._start_monotonic
                else 0.0
            )
            print(
                f"[{self._elapsed_label(elapsed)}] {message}",
                file=sys.stderr,
                flush=True,
            )

    def _advance_progress(self, seed: InstitutionSeed) -> None:
        if not self.show_progress:
            return
        with self._progress_lock:
            self._institutions_finished += 1
            total = len(self.config.institutions)
            width = 20
            filled = int(width * self._institutions_finished / total)
            bar = "#" * filled + "-" * (width - filled)
            self._progress(
                f"[{bar}] {self._institutions_finished}/{total} institutions; "
                f"finished={seed.name}; errors={self.metrics.errors}"
            )

    def _emit_error(
        self,
        *,
        institution_id: str | None,
        url: str | None,
        stage: str,
        code: str,
        message: str,
        retryable: bool,
    ) -> None:
        error = CrawlError(
            error_id=stable_id(
                "crawl-error",
                institution_id or "",
                url or "",
                stage,
                code,
                str(time.time_ns()),
            ),
            institution_id=institution_id,
            url=url,
            stage=stage,
            error_code=code,
            message=message[:1000],
            retryable=retryable,
        )
        self.store.append("crawl_errors", error)
        self.metrics.add(errors=1)

    def _record_discovery_edge(self, record: dict[str, object]) -> None:
        institution_id = str(record.get("institution_id") or "")
        if institution_id:
            with self._discovery_graph_lock:
                self._discovery_graph.setdefault(
                    institution_id, []
                ).append(dict(record))
        self.store.append(
            "discovery_url_graph_edges",
            {**record, "retrieved_at": utc_now_iso()},
        )
        self.metrics.add(scrapy_links_discovered=1)

    def _record_assertion(self, assertion: FieldAssertion) -> None:
        self.store.append("field_assertions", assertion)
        updates = {"assertions_total": 1}
        if assertion.verification_status != VerificationStatus.REJECTED:
            slot = (assertion.entity_id, assertion.field_name)
            with self._coverage_lock:
                self._coverage_slots.add(slot)
                if has_semantic_value(assertion.value_json):
                    self._non_null_slots.add(slot)
                if assertion.null_reason == NullReason.NOT_APPLICABLE:
                    self._not_applicable_slots.add(slot)
        if (
            has_semantic_value(assertion.value_json)
            and assertion.verification_status != VerificationStatus.REJECTED
        ):
            updates["assertions_non_null"] = 1
        if assertion.verification_status == VerificationStatus.REJECTED:
            updates["assertions_rejected"] = 1
        if assertion.verification_status == VerificationStatus.NEEDS_REVIEW:
            updates["assertions_needs_review"] = 1
        self.metrics.add(**updates)

    @staticmethod
    def _prepare_assertion(
        assertion: FieldAssertion,
        *,
        seed: InstitutionSeed,
        programme: ProgrammeRecord | None = None,
    ) -> FieldAssertion:
        return with_review_fingerprint(
            assertion,
            institution_id=seed.institution_id,
            degree_level=(
                programme.degree_level if programme is not None else None
            ),
        )

    @staticmethod
    def _missing_field_reason(
        programme: ProgrammeRecord,
        field_name: str,
        failed_groups: set[str] | None = None,
    ) -> NullReason:
        if failed_groups and any(
            field_name in EXTRACTION_FIELD_GROUPS[group_name]
            for group_name in failed_groups
            if group_name in EXTRACTION_FIELD_GROUPS
        ):
            return NullReason.PARSE_FAILED
        if programme.degree_level == "bachelor" and field_name == "minimum_degree":
            return NullReason.NOT_APPLICABLE
        return NullReason.NOT_PUBLISHED

    def _fetch_and_parse_source(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
        url: str,
    ) -> tuple[SourceDocument, ExtractionSource, list[tuple[str, str]]]:
        canonical = canonicalize_url(url)
        if not policy.allows(canonical, self.config.limits.user_agent):
            raise FetchError(
                "Path is disallowed by robots policy.",
                code="BLOCKED_BY_ROBOTS",
                url=canonical,
            )
        fetch_method = "http"
        rendered = False
        try:
            result = self.fetcher.fetch(
                canonical,
                allowed_domains=seed.all_allowed_domains,
            )
        except FetchError as http_error:
            if self.renderer is None or http_error.status != 403:
                raise
            self.metrics.add(render_attempts=1)
            try:
                rendered_result = self.renderer.render(
                    canonical,
                    allowed_domains=seed.all_allowed_domains,
                )
            except (Crawl4AIAdapterError, RuntimeError) as render_error:
                self.store.append(
                    "render_events",
                    {
                        "institution_id": seed.institution_id,
                        "url": canonical,
                        "status": "http_403_render_failed",
                        "error": str(render_error)[:1000],
                        "retrieved_at": utc_now_iso(),
                    },
                )
                raise http_error from render_error
            result = FetchResult(
                requested_url=rendered_result.requested_url,
                final_url=rendered_result.final_url,
                status=rendered_result.status,
                headers={"content-type": "text/html; charset=utf-8"},
                content_type="text/html; charset=utf-8",
                body=rendered_result.body,
                content_hash=rendered_result.content_hash,
                retrieved_at=rendered_result.retrieved_at,
            )
            fetch_method = "crawl4ai"
            rendered = True
            self.metrics.add(render_successes=1)
            self.store.append(
                "render_events",
                {
                    "institution_id": seed.institution_id,
                    "url": canonical,
                    "status": "used_after_http_403",
                    "rendered_text_bytes": len(rendered_result.body),
                    "retrieved_at": rendered_result.retrieved_at,
                },
            )
        content_type = (result.content_type or "").lower()
        if "pdf" in content_type or result.body.startswith(b"%PDF"):
            page = parse_pdf(result.body, result.final_url)
            page_type = PageType.PDF
        elif (
            "html" in content_type
            or "xml" in content_type
            or not content_type
        ):
            page = parse_html(
                result.body,
                result.final_url,
                result.headers.get("content-type"),
            )
            if (
                self.renderer is not None
                and not rendered
                and should_render_page(
                    page,
                    result.body,
                    policy=self.render_policy,
                    min_text_chars=(
                        self.config.limits.crawl4ai_min_text_chars
                    ),
                )
            ):
                self.metrics.add(render_attempts=1)
                try:
                    rendered_result = self.renderer.render(
                        result.final_url,
                        allowed_domains=seed.all_allowed_domains,
                    )
                    rendered_page = parse_html(
                        rendered_result.body,
                        rendered_result.final_url,
                        "text/html; charset=utf-8",
                    )
                except (Crawl4AIAdapterError, RuntimeError) as exc:
                    self.store.append(
                        "render_events",
                        {
                            "institution_id": seed.institution_id,
                            "url": result.final_url,
                            "status": "fallback_to_http",
                            "error": str(exc)[:1000],
                            "retrieved_at": utc_now_iso(),
                        },
                    )
                else:
                    useful = rendered_page_is_useful(
                        page,
                        rendered_page,
                        policy=self.render_policy,
                    )
                    self.store.append(
                        "render_events",
                        {
                            "institution_id": seed.institution_id,
                            "url": result.final_url,
                            "status": (
                                "used" if useful else "no_material_gain"
                            ),
                            "native_text_chars": len(page.text),
                            "rendered_text_chars": len(
                                rendered_page.text
                            ),
                            "native_link_count": len(page.links),
                            "rendered_link_count": len(
                                rendered_page.links
                            ),
                            "retrieved_at": utc_now_iso(),
                        },
                    )
                    if useful:
                        result.final_url = rendered_result.final_url
                        result.status = rendered_result.status
                        result.headers = {
                            "content-type": "text/html; charset=utf-8"
                        }
                        result.content_type = "text/html"
                        result.body = rendered_result.body
                        result.content_hash = (
                            rendered_result.content_hash
                        )
                        result.retrieved_at = rendered_result.retrieved_at
                        page = rendered_page
                        fetch_method = "crawl4ai"
                        rendered = True
                        self.metrics.add(render_successes=1)
            page_type = classify_page(result.final_url, page.title, page.text)
        else:
            raise FetchError(
                f"Unsupported content type: {result.content_type}",
                code="UNSUPPORTED_CONTENT_TYPE",
                url=result.final_url,
            )
        raw_path = self.store.save_raw(
            content=result.body,
            content_type=result.content_type,
            canonical_url=result.final_url,
        )
        source_id = stable_id(
            "source", seed.institution_id, result.final_url, result.content_hash
        )
        document = SourceDocument(
            source_id=source_id,
            institution_id=seed.institution_id,
            url=url,
            canonical_url=result.final_url,
            page_type=page_type,
            content_type=result.content_type,
            http_status=result.status,
            retrieved_at=result.retrieved_at,
            content_hash=result.content_hash,
            raw_object_path=raw_path,
            title=page.title,
            language=page.language,
            text_length=len(page.text),
            fetch_method=fetch_method,
            rendered=rendered,
        )
        self.store.append("sources", document)
        self.metrics.add(sources_fetched=1)
        extraction_source = ExtractionSource(
            url=result.final_url,
            page_type=page_type.value,
            title=page.title,
            text=page.text,
            content_hash=result.content_hash,
        )
        return document, extraction_source, page.links

    def _process_school_profile(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
    ) -> None:
        if self.discovery_only or not seed.school_profile_urls:
            return
        self.metrics.add(school_profiles_attempted=1)
        sources: list[ExtractionSource] = []
        seen: set[str] = set()
        for url in seed.school_profile_urls[
            : self.config.limits.max_sources_per_extraction_group
        ]:
            try:
                _, source, _ = self._fetch_and_parse_source(seed, policy, url)
            except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=url,
                    stage="school_profile_fetch",
                    code=getattr(exc, "code", "SCHOOL_PROFILE_SOURCE_FAILED"),
                    message=str(exc),
                    retryable=bool(getattr(exc, "retryable", False)),
                )
                continue
            if source.url not in seen:
                sources.append(source)
                seen.add(source.url)

        if not sources:
            for field_name in SCHOOL_PROFILE_FIELDS:
                self._record_assertion(
                    null_assertion(
                        entity_id=seed.institution_id,
                        entity_type="institution",
                        field_name=field_name,
                        null_reason=NullReason.FETCH_FAILED,
                        source_url=None,
                        extractor_version=self.EXTRACTOR_VERSION,
                        model_name=None,
                    )
                )
            return

        source_map = {source.url: source for source in sources}
        model_name: str | None = None
        facts: list[dict[str, object]] = []
        try:
            model_name, payload = self.deepseek.extract_school_profile(
                institution_id=seed.institution_id,
                institution_name=seed.name,
                sources=sources,
            )
            if payload.get("programme_identity_match"):
                facts = list(payload.get("facts", []))
            else:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=seed.homepage_url,
                    stage="school_profile_identity",
                    code="INSTITUTION_IDENTITY_MISMATCH",
                    message="School profile sources did not describe the target institution.",
                    retryable=False,
                )
        except DeepSeekError as exc:
            self._emit_error(
                institution_id=seed.institution_id,
                url=seed.homepage_url,
                stage="school_profile_extraction",
                code="DEEPSEEK_FAILED",
                message=str(exc),
                retryable=True,
            )

        assertions: list[FieldAssertion] = []
        found: set[str] = set()
        for fact in facts:
            field_name = str(fact.get("field_name") or "")
            source_url = str(fact.get("source_url") or "")
            evidence = str(fact.get("evidence") or "")
            source = source_map.get(source_url)
            errors: list[str] = []
            if not source:
                errors.append("SOURCE_NOT_IN_FETCH_SET")
            elif not evidence_supported(evidence, source.text):
                errors.append("EVIDENCE_NOT_FOUND_IN_SOURCE")
            assertion = FieldAssertion(
                assertion_id=stable_id(
                    "assertion",
                    seed.institution_id,
                    field_name,
                    source_url,
                    json.dumps(
                        fact.get("value"),
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                ),
                entity_type="institution",
                entity_id=seed.institution_id,
                field_name=field_name,
                value_json=fact.get("value"),
                null_reason=None,
                source_url=source_url or None,
                source_type=str(fact.get("source_type") or "institution_profile"),
                evidence=evidence or None,
                evidence_locator=None,
                scope="institution",
                audience="all",
                academic_cycle=None,
                retrieved_at=utc_now_iso(),
                confidence=float(fact.get("confidence") or 0),
                verification_status=(
                    VerificationStatus.REJECTED
                    if errors
                    else VerificationStatus.NEEDS_REVIEW
                    if field_name in {
                        "vision",
                        "student_development_goals",
                    }
                    else VerificationStatus.RULE_VALIDATED
                ),
                extractor_version=self.EXTRACTOR_VERSION,
                model_name=model_name,
                validation_errors=errors,
                extraction_group="school_profile",
                source_content_hash=(
                    source.content_hash if source else None
                ),
            )
            assertion = self._prepare_assertion(
                assertion,
                seed=seed,
            )
            assertions.append(assertion)
            if assertion.verification_status != VerificationStatus.REJECTED:
                found.add(field_name)

        for field_name in SCHOOL_PROFILE_FIELDS:
            if field_name not in found:
                assertions.append(
                    null_assertion(
                        entity_id=seed.institution_id,
                        entity_type="institution",
                        field_name=field_name,
                        null_reason=(
                            NullReason.PARSE_FAILED
                            if model_name is None
                            else NullReason.NOT_PUBLISHED
                        ),
                        source_url=sources[0].url,
                        extractor_version=self.EXTRACTOR_VERSION,
                        model_name=model_name,
                    )
                )
        for assertion in assertions:
            self._record_assertion(assertion)
        profile_value_buckets: dict[str, list[object]] = {}
        for assertion in assertions:
            if (
                not has_semantic_value(assertion.value_json)
                or assertion.verification_status == VerificationStatus.REJECTED
            ):
                continue
            profile_value_buckets.setdefault(
                assertion.field_name, []
            ).append(assertion.value_json)
        profile_fields = {
            field_name: values[0] if len(values) == 1 else values
            for field_name, values in profile_value_buckets.items()
        }
        self.store.append(
            "school_profiles",
            {
                "institution_id": seed.institution_id,
                "institution_name": seed.name,
                "fields": profile_fields,
                "source_urls": [source.url for source in sources],
                "retrieved_at": utc_now_iso(),
            },
        )
        if found:
            self.metrics.add(school_profiles_extracted=1)

    def _related_links(
        self,
        links: list[tuple[str, str]],
        seed: InstitutionSeed,
        programme_url: str,
        degree_level: str | None = None,
        covered_categories: frozenset[str] = frozenset(),
    ) -> list[str]:
        candidates: dict[str, tuple[int, frozenset[str]]] = {}
        programme_path = urlsplit(programme_url).path.rstrip("/")
        for url, text in links:
            try:
                canonical = canonicalize_url(url)
            except UnsafeUrlError:
                continue
            hostname = urlsplit(canonical).hostname or ""
            if not hostname_matches(hostname, seed.all_allowed_domains):
                continue
            if is_nonproduction_hostname(hostname):
                continue
            if canonical.startswith("http://"):
                canonical = f"https://{canonical[len('http://'):]}"
            if canonical == programme_url or OFF_SCOPE_RE.search(
                urlsplit(canonical).path
            ):
                continue
            parsed = urlsplit(canonical)
            readable_path = re.sub(r"[-_/]+", " ", parsed.path)
            haystack = f"{readable_path} {text}"
            if not SmokePipeline._graph_link_matches_degree(
                degree_level, haystack
            ):
                continue
            categories = frozenset(
                category
                for category, pattern in RELATED_LINK_PATTERNS
                if pattern.search(haystack)
            )
            if not categories:
                continue
            score = len(categories) * 10
            if text.strip():
                score += 2
            if parsed.path not in {"", "/"}:
                score += 1
            if programme_path and parsed.path.startswith(f"{programme_path}/"):
                score += 20
            previous = candidates.get(canonical)
            if not previous or score > previous[0]:
                candidates[canonical] = (score, categories)

        ranked = sorted(
            candidates.items(),
            key=lambda item: (-item[1][0], item[0]),
        )
        selected: list[str] = []
        for category, _ in RELATED_LINK_PATTERNS:
            if category in covered_categories:
                continue
            match = next(
                (
                    url
                    for url, (_, categories) in ranked
                    if category in categories and url not in selected
                ),
                None,
            )
            if match:
                selected.append(match)
        selected.extend(
            url
            for url, (_, categories) in ranked
            if url not in selected
            and not categories.issubset(covered_categories)
        )
        return selected

    @staticmethod
    def _graph_link_matches_degree(
        degree_level: str | None,
        value: str,
    ) -> bool:
        undergraduate = bool(
            re.search(
                r"\b(?:undergraduate|first[- ]year|bachelor)\b",
                value,
                re.IGNORECASE,
            )
        )
        graduate = bool(
            re.search(
                r"\b(?:graduate|postgraduate|master|doctoral|phd)\b",
                value,
                re.IGNORECASE,
            )
        )
        if degree_level == "bachelor":
            return not (graduate and not undergraduate)
        if degree_level in {"master", "phd"}:
            return not (undergraduate and not graduate)
        return True

    def _graph_related_link_pairs(
        self,
        seed: InstitutionSeed,
        programme: ProgrammeRecord,
        covered_categories: frozenset[str] = frozenset(),
    ) -> list[tuple[str, str]]:
        with self._discovery_graph_lock:
            edges = tuple(
                self._discovery_graph.get(seed.institution_id, ())
            )
        links: list[tuple[str, str]] = []
        origins: dict[str, tuple[int, str]] = {}
        programme_url = canonicalize_url(programme.official_url)
        for edge in edges:
            raw_target = str(edge.get("target_url") or "")
            raw_source = str(edge.get("discovered_from") or "")
            anchor_text = str(edge.get("anchor_text") or "")
            try:
                target = canonicalize_url(raw_target)
                source = canonicalize_url(raw_source)
            except UnsafeUrlError:
                continue
            hostname = urlsplit(target).hostname or ""
            if (
                target == programme_url
                or not hostname_matches(
                    hostname, seed.all_allowed_domains
                )
                or is_nonproduction_hostname(hostname)
            ):
                continue
            readable_path = re.sub(
                r"[-_/]+", " ", urlsplit(target).path
            )
            signal = f"{readable_path} {anchor_text}"
            if not self._graph_link_matches_degree(
                programme.degree_level, signal
            ):
                continue
            links.append((target, anchor_text))
            origin_score = 0
            if source == programme_url:
                origin_score += 100
            if urlsplit(source).hostname == urlsplit(programme_url).hostname:
                origin_score += 10
            origin_score -= max(0, int(edge.get("depth") or 0))
            previous = origins.get(target)
            if not previous or origin_score > previous[0]:
                origins[target] = (origin_score, source)

        selected = self._related_links(
            links,
            seed,
            programme_url,
            programme.degree_level,
            covered_categories,
        )
        return [
            (origins[url][1], url)
            for url in selected
            if url in origins
        ]

    def _admission_retry_links(
        self,
        links: list[tuple[str, str]],
        seed: InstitutionSeed,
        *,
        excluded_urls: set[str],
    ) -> list[str]:
        candidates: dict[str, int] = {}
        for url, text in links:
            try:
                canonical = canonicalize_url(url)
            except UnsafeUrlError:
                continue
            if canonical in excluded_urls:
                continue
            hostname = urlsplit(canonical).hostname or ""
            if not hostname_matches(hostname, seed.all_allowed_domains):
                continue
            if is_nonproduction_hostname(hostname):
                continue
            if canonical.startswith("http://"):
                canonical = f"https://{canonical[len('http://'):]}"
            path = urlsplit(canonical).path
            if OFF_SCOPE_RE.search(path):
                continue
            readable_path = re.sub(r"[-_/]+", " ", path)
            haystack = f"{readable_path} {text}"
            matches = ADMISSION_PACKAGE_LINK_RE.findall(haystack)
            if not matches:
                continue
            score = len(matches) * 10
            if re.search(
                r"\b(?:supporting documents?|required documents?|"
                r"application checklist)\b",
                haystack,
                re.IGNORECASE,
            ):
                score += 30
            if path.lower().endswith(".pdf"):
                score += 5
            candidates[canonical] = max(score, candidates.get(canonical, 0))
        return [
            url
            for url, _ in sorted(
                candidates.items(), key=lambda item: (-item[1], item[0])
            )
        ]

    def _coverage_retry_links(
        self,
        link_contexts: list[
            tuple[str, list[tuple[str, str]]]
        ],
        seed: InstitutionSeed,
        programme: ProgrammeRecord,
        *,
        missing_fields: tuple[str, ...],
        excluded_urls: set[str],
    ) -> list[tuple[str, str, tuple[str, ...]]]:
        """Rank links that explicitly match currently missing product fields."""
        candidates: dict[
            str, tuple[int, str, tuple[str, ...]]
        ] = {}
        for discovered_from, links in link_contexts:
            for url, anchor_text in links:
                try:
                    canonical = canonicalize_url(url)
                except UnsafeUrlError:
                    continue
                if canonical in excluded_urls:
                    continue
                hostname = urlsplit(canonical).hostname or ""
                if (
                    not hostname_matches(
                        hostname, seed.all_allowed_domains
                    )
                    or is_nonproduction_hostname(hostname)
                ):
                    continue
                if canonical.startswith("http://"):
                    canonical = (
                        f"https://{canonical[len('http://'):]}"
                    )
                path = urlsplit(canonical).path
                if OFF_SCOPE_RE.search(path):
                    continue
                readable_path = re.sub(r"[-_/]+", " ", path)
                signal = f"{readable_path} {anchor_text}"
                if not self._graph_link_matches_degree(
                    programme.degree_level, signal
                ):
                    continue

                matched_fields = tuple(
                    field_name
                    for field_name in missing_fields
                    if any(
                        RELATED_LINK_PATTERN_BY_CATEGORY[
                            category
                        ].search(signal)
                        for category in COVERAGE_RETRY_FIELD_CATEGORIES.get(
                            field_name, ()
                        )
                    )
                )
                if not matched_fields:
                    continue
                matched_categories = {
                    category
                    for field_name in matched_fields
                    for category in COVERAGE_RETRY_FIELD_CATEGORIES[
                        field_name
                    ]
                    if RELATED_LINK_PATTERN_BY_CATEGORY[category].search(
                        signal
                    )
                }
                score = len(matched_fields) * 20
                score += len(matched_categories) * 10
                if anchor_text.strip():
                    score += 3
                if path.lower().endswith(".pdf"):
                    score += 2
                previous = candidates.get(canonical)
                candidate = (
                    score,
                    discovered_from,
                    matched_fields,
                )
                if not previous or score > previous[0]:
                    candidates[canonical] = candidate

        return [
            (discovered_from, url, matched_fields)
            for url, (
                _,
                discovered_from,
                matched_fields,
            ) in sorted(
                candidates.items(),
                key=lambda item: (-item[1][0], item[0]),
            )
        ]

    def _record_url_edge(
        self,
        programme: ProgrammeRecord,
        *,
        discovered_from: str,
        target_url: str,
        relation: str,
    ) -> None:
        self.store.append(
            "url_graph_edges",
            {
                "programme_id": programme.programme_id,
                "institution_id": programme.institution_id,
                "discovered_from": discovered_from,
                "target_url": target_url,
                "relation": relation,
                "retrieved_at": utc_now_iso(),
            },
        )

    def _write_null_set(
        self,
        programme: ProgrammeRecord,
        reason: NullReason,
        *,
        source_url: str | None,
        model_name: str | None,
        field_names: tuple[str, ...] | None = None,
    ) -> None:
        for field_name in field_names or DEEP_FIELDS:
            self._record_assertion(
                null_assertion(
                    entity_id=programme.programme_id,
                    field_name=field_name,
                    null_reason=reason,
                    source_url=source_url,
                    extractor_version=self.EXTRACTOR_VERSION,
                    model_name=model_name,
                )
            )

    def _process_deep(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
        programme: ProgrammeRecord,
        preloaded_main: tuple[
            ExtractionSource, list[tuple[str, str]]
        ] | None = None,
    ) -> ProgrammeRecord:
        self.metrics.add(deep_programmes_attempted=1)
        inherited_assertions, inheritance_events = (
            inherited_assertions_for_programme(
                state=self.state,
                institution_id=seed.institution_id,
                degree_level=programme.degree_level,
                programme_id=programme.programme_id,
                extractor_version=self.EXTRACTOR_VERSION,
                compatible_extractor_versions=(
                    self.COMPATIBLE_ASSERTION_EXTRACTORS
                ),
            )
        )
        for event in inheritance_events:
            self.store.append(
                "inheritance_events",
                {**event, "retrieved_at": utc_now_iso()},
            )
        approved_baseline: list[FieldAssertion] = []
        if self.approved_assertions.configured:
            try:
                approved_baseline = validate_assertion_set(
                    [
                        self._prepare_assertion(
                            assertion,
                            seed=seed,
                            programme=programme,
                        )
                        for assertion in self.approved_assertions.load(
                            programme.programme_id
                        )
                    ]
                )
            except Exception as exc:
                self.store.append(
                    "extraction_events",
                    {
                        "programme_id": programme.programme_id,
                        "institution_id": seed.institution_id,
                        "programme_url": programme.official_url,
                        "retrieved_at": utc_now_iso(),
                        "extraction_group": "approved_baseline",
                        "status": "failed",
                        "error": str(exc)[:1000],
                    },
                )
                approved_baseline = []
        if approved_baseline:
            self.metrics.add(
                approved_baseline_programmes=1,
                approved_baseline_assertions=len(approved_baseline),
            )
            self.store.append(
                "extraction_events",
                {
                    "programme_id": programme.programme_id,
                    "institution_id": seed.institution_id,
                    "programme_url": programme.official_url,
                    "retrieved_at": utc_now_iso(),
                    "extraction_group": "approved_baseline",
                    "status": "completed",
                    "assertion_count": len(approved_baseline),
                    "field_names": sorted(
                        {
                            assertion.field_name
                            for assertion in approved_baseline
                        }
                    ),
                },
            )
        if self.target_fields is not None:
            target_field_set = set(self.target_fields)
            inherited_assertions = [
                assertion
                for assertion in inherited_assertions
                if assertion.field_name in target_field_set
            ]
            approved_baseline = [
                assertion
                for assertion in approved_baseline
                if assertion.field_name in target_field_set
            ]
        reusable_assertions = [
            *inherited_assertions,
            *approved_baseline,
        ]
        if self.target_fields is not None:
            target_field_set = set(self.target_fields)
            reusable_assertions = [
                assertion
                for assertion in reusable_assertions
                if assertion.field_name in target_field_set
            ]
        inherited_fields = {
            assertion.field_name for assertion in inherited_assertions
        }
        requested_fields = fields_to_extract(reusable_assertions)
        if self.target_fields is not None:
            requested_fields = tuple(
                field_name
                for field_name in requested_fields
                if field_name in self.target_fields
            )
        skipped_field_count = len(DEEP_FIELDS) - len(requested_fields)
        if inherited_assertions:
            self.metrics.add(
                inherited_assertions=len(inherited_assertions),
                inherited_field_slots=len(inherited_fields),
            )
        if skipped_field_count:
            self.metrics.add(
                selective_extraction_programmes=1,
                extraction_fields_skipped=skipped_field_count,
            )
        if inherited_assertions or approved_baseline:
            self._progress(
                f"[{seed.name}] {programme.programme_name}: inherited "
                f"{len(inherited_fields)} shared and loaded "
                f"{len(approved_baseline)} approved assertion(s); extracting "
                f"{len(requested_fields)}/{len(DEEP_FIELDS)} field(s)"
            )
        self._progress(f"[{seed.name}] fetching {programme.programme_name}")
        if preloaded_main:
            main_source, links = preloaded_main
        else:
            try:
                _, main_source, links = self._fetch_and_parse_source(
                    seed, policy, programme.official_url
                )
            except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                code = getattr(exc, "code", "SOURCE_FETCH_FAILED")
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=programme.official_url,
                    stage="deep_fetch",
                    code=code,
                    message=str(exc),
                    retryable=bool(getattr(exc, "retryable", False)),
                )
                self._write_null_set(
                    programme,
                    NullReason.FETCH_FAILED,
                    source_url=programme.official_url,
                    model_name=None,
                    field_names=self.target_fields,
                )
                return programme

        sources = [main_source]
        fetched_urls = {canonicalize_url(main_source.url)}
        retry_link_pairs: list[tuple[str, str]] = []
        related_link_contexts: list[
            tuple[str, list[tuple[str, str]]]
        ] = [(main_source.url, links)]
        programme_sources = seed.programme_source_bundles.get(
            programme.official_url, ()
        )
        shared_admission_sources = (
            seed.shared_admission_source_bundles.get(
                str(programme.degree_level or "").lower(), ()
            )
        )
        shared_support_sources = seed.shared_source_bundles.get(
            str(programme.degree_level or "").lower(), ()
        )
        configured_sources = tuple(
            dict.fromkeys(
                (
                    *programme_sources,
                    *shared_support_sources,
                    *shared_admission_sources,
                )
            )
        )
        configured_capacity = max(
            0,
            self.config.limits.max_deep_sources_per_programme - len(sources),
        )
        for url in configured_sources[:configured_capacity]:
            try:
                canonical = canonicalize_url(url)
                if canonical in fetched_urls:
                    continue
                _, source, source_links = self._fetch_and_parse_source(
                    seed, policy, canonical
                )
                sources.append(source)
                fetched_urls.add(canonicalize_url(source.url))
                related_link_contexts.append((source.url, source_links))
                self._record_url_edge(
                    programme,
                    discovered_from=main_source.url,
                    target_url=source.url,
                    relation=(
                        "configured_programme_source"
                        if url in programme_sources
                        else (
                            "configured_shared_support_source"
                            if url in shared_support_sources
                            else "configured_shared_admission_source"
                        )
                    ),
                )
                retry_link_pairs.extend(
                    (source.url, retry_url)
                    for retry_url in self._admission_retry_links(
                        source_links,
                        seed,
                        excluded_urls=fetched_urls,
                    )
                )
            except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=url,
                    stage="configured_source_fetch",
                    code=getattr(exc, "code", "CONFIGURED_SOURCE_FAILED"),
                    message=str(exc),
                    retryable=bool(getattr(exc, "retryable", False)),
                )
        programme_url = canonicalize_url(programme.official_url)
        covered_categories = frozenset(
            category
            for source in sources
            if (
                category := SOURCE_CATEGORY_BY_PAGE_TYPE.get(
                    source.page_type
                )
            )
        )
        contextual_related: list[tuple[str, str]] = []
        for discovered_from, context_links in related_link_contexts:
            contextual_related.extend(
                (discovered_from, url)
                for url in self._related_links(
                    context_links,
                    seed,
                    programme_url,
                    programme.degree_level,
                    covered_categories,
                )
            )
        graph_related = self._graph_related_link_pairs(
            seed,
            programme,
            covered_categories,
        )
        related_pairs: list[tuple[str, str, str]] = []
        seen_related: set[str] = set()
        for discovered_from, url, relation in (
            *(
                (discovered_from, url, "graph_guided_source")
                for discovered_from, url in graph_related
            ),
            *(
                (discovered_from, url, "programme_related_source")
                for discovered_from, url in contextual_related
            ),
        ):
            canonical_related = canonicalize_url(url)
            if canonical_related in seen_related:
                continue
            seen_related.add(canonical_related)
            related_pairs.append(
                (discovered_from, canonical_related, relation)
            )
        available_related_slots = max(
            0,
            self.config.limits.max_deep_sources_per_programme - len(sources),
        )
        configured_admission_count = sum(
            source.page_type
            in {
                PageType.PROGRAMME_ADMISSION.value,
                PageType.INTERNATIONAL_ADMISSION.value,
            }
            for source in sources
        )
        admission_retry_reserve = min(
            0 if configured_admission_count >= 2 else 1,
            self.config.limits.max_admission_retry_sources_per_programme,
            max(0, available_related_slots - 1),
        )
        coverage_retry_reserve = min(
            (
                0
                if self.discovery_only
                else self.config.limits
                .max_coverage_retry_sources_per_programme
            ),
            max(0, available_related_slots - 1),
        )
        retry_reserve = max(
            admission_retry_reserve,
            coverage_retry_reserve,
        )
        primary_related_limit = available_related_slots - retry_reserve
        primary_related_fetched = 0
        for discovered_from, url, relation in related_pairs:
            if primary_related_fetched >= primary_related_limit:
                break
            if canonicalize_url(url) in fetched_urls:
                continue
            try:
                _, source, source_links = self._fetch_and_parse_source(
                    seed, policy, url
                )
                sources.append(source)
                fetched_urls.add(canonicalize_url(source.url))
                primary_related_fetched += 1
                related_link_contexts.append(
                    (source.url, source_links)
                )
                self._record_url_edge(
                    programme,
                    discovered_from=discovered_from,
                    target_url=source.url,
                    relation=relation,
                )
                if relation == "graph_guided_source":
                    self.metrics.add(graph_guided_sources=1)
                retry_link_pairs.extend(
                    (source.url, retry_url)
                    for retry_url in self._admission_retry_links(
                        source_links,
                        seed,
                        excluded_urls=fetched_urls,
                    )
                )
                updated_covered_categories = frozenset(
                    category
                    for fetched_source in sources
                    if (
                        category := SOURCE_CATEGORY_BY_PAGE_TYPE.get(
                            fetched_source.page_type
                        )
                    )
                )
                for nested_url in self._related_links(
                    source_links,
                    seed,
                    programme_url,
                    programme.degree_level,
                    updated_covered_categories,
                ):
                    canonical_nested = canonicalize_url(nested_url)
                    if (
                        canonical_nested in fetched_urls
                        or canonical_nested in seen_related
                    ):
                        continue
                    seen_related.add(canonical_nested)
                    related_pairs.append(
                        (
                            source.url,
                            canonical_nested,
                            "programme_related_source_hop",
                        )
                    )
            except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=url,
                    stage="related_source_fetch",
                    code=getattr(exc, "code", "RELATED_SOURCE_FAILED"),
                    message=str(exc),
                    retryable=bool(getattr(exc, "retryable", False)),
                )
        self._progress(
            f"[{seed.name}] {programme.programme_name}: "
            f"{len(sources)} source(s) ready"
        )

        deterministic_facts = extract_deterministic_facts(sources)
        facts = list(deterministic_facts)
        model_name: str | None = None
        payload: dict[str, object] = {
            "programme_identity_match": True,
            "facts": [],
            "warnings": [],
        }
        if not self.discovery_only:
            # The client promotes only extraction groups that actually include
            # a PDF. A PDF elsewhere in the bundle must not force every group
            # onto the slower reasoning model.
            prefer_pro = False
            try:
                if not requested_fields:
                    self._progress(
                        f"[{seed.name}] {programme.programme_name}: "
                        "all requested fields already reusable; skipping LLM"
                    )
                elif skipped_field_count:
                    model_name, payload = self.deepseek.extract_fields(
                        programme,
                        sources,
                        field_names=requested_fields,
                        prefer_pro=prefer_pro,
                    )
                else:
                    model_name, payload = self.deepseek.extract(
                        programme, sources, prefer_pro=prefer_pro
                    )
                facts.extend(payload.get("facts", []))
                for diagnostic in payload.get("group_diagnostics", []):
                    self.store.append(
                        "extraction_events",
                        {
                            "programme_id": programme.programme_id,
                            "institution_id": seed.institution_id,
                            "programme_url": programme.official_url,
                            "retrieved_at": utc_now_iso(),
                            **diagnostic,
                        },
                    )
            except DeepSeekError as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=programme.official_url,
                    stage="deepseek_extraction",
                    code="DEEPSEEK_FAILED",
                    message=str(exc),
                    retryable=True,
                )
                if not facts:
                    self._write_null_set(
                        programme,
                        NullReason.PARSE_FAILED,
                        source_url=main_source.url,
                        model_name=None,
                        field_names=self.target_fields,
                    )
                    return programme

        identity_override = (
            not payload.get("programme_identity_match")
            and programme_identity_supported(
                programme.programme_name,
                main_source,
            )
        )
        if identity_override:
            self._progress(
                f"[{seed.name}] {programme.programme_name}: "
                "model identity mismatch overridden by exact source identity"
            )
        if (
            not payload.get("programme_identity_match")
            and not identity_override
        ):
            self._emit_error(
                institution_id=seed.institution_id,
                url=programme.official_url,
                stage="identity_validation",
                code="PROGRAMME_IDENTITY_MISMATCH",
                message="DeepSeek reported that sources do not match the target programme.",
                retryable=False,
            )
            if not deterministic_facts:
                self._write_null_set(
                    programme,
                    NullReason.AMBIGUOUS,
                    source_url=main_source.url,
                    model_name=model_name,
                    field_names=self.target_fields,
                )
                return programme
            facts = deterministic_facts

        found_admission_fields: set[str] = {
            assertion.field_name
            for assertion in reusable_assertions
            if (
                assertion.field_name in ADMISSION_PACKAGE_FIELDS
                and has_semantic_value(assertion.value_json)
                and assertion.verification_status
                != VerificationStatus.REJECTED
            )
        }
        initial_source_map = {source.url: source for source in sources}
        for fact in facts:
            field_name = str(fact.get("field_name"))
            value = fact.get("value")
            if value is None:
                continue
            if (
                field_name in ADMISSION_PACKAGE_FIELDS
                and isinstance(value, dict)
                and value.get("requirement_status") == "not_required"
                and not explicit_not_required_evidence(
                    field_name,
                    str(fact.get("evidence") or ""),
                )
                ):
                continue
            if field_name not in ADMISSION_PACKAGE_FIELDS:
                continue
            initial_assertion = fact_to_assertion(
                entity_id=programme.programme_id,
                fact=fact,
                source_map=initial_source_map,
                model_name=model_name or "deterministic",
                extractor_version=self.EXTRACTOR_VERSION,
                programme_degree=programme.degree_level,
                programme_name=programme.programme_name,
                programme_url=programme.official_url,
            )
            if (
                initial_assertion.verification_status
                != VerificationStatus.REJECTED
            ):
                found_admission_fields.add(field_name)
        admission_field_scope = (
            tuple(
                field_name
                for field_name in ADMISSION_PACKAGE_FIELDS
                if field_name in self.target_fields
            )
            if self.target_fields is not None
            else ADMISSION_PACKAGE_FIELDS
        )
        missing_admission_fields = tuple(
            field_name
            for field_name in admission_field_scope
            if field_name not in found_admission_fields
        )
        retry_sources: list[ExtractionSource] = []
        retry_seen: set[str] = set()
        remaining_source_capacity = max(
            0,
            self.config.limits.max_deep_sources_per_programme - len(sources),
        )
        retry_limit = min(
            remaining_source_capacity,
            self.config.limits.max_admission_retry_sources_per_programme,
        )
        if missing_admission_fields and retry_limit:
            for discovered_from, retry_url in retry_link_pairs:
                if len(retry_sources) >= retry_limit:
                    break
                canonical_retry = canonicalize_url(retry_url)
                if (
                    canonical_retry in fetched_urls
                    or canonical_retry in retry_seen
                ):
                    continue
                retry_seen.add(canonical_retry)
                try:
                    (
                        _,
                        retry_source,
                        retry_source_links,
                    ) = self._fetch_and_parse_source(
                        seed, policy, canonical_retry
                    )
                except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                    self._emit_error(
                        institution_id=seed.institution_id,
                        url=canonical_retry,
                        stage="admission_coverage_retry_fetch",
                        code=getattr(
                            exc, "code", "ADMISSION_RETRY_SOURCE_FAILED"
                        ),
                        message=str(exc),
                        retryable=bool(
                            getattr(exc, "retryable", False)
                        ),
                    )
                    continue
                retry_sources.append(retry_source)
                sources.append(retry_source)
                fetched_urls.add(canonicalize_url(retry_source.url))
                related_link_contexts.append(
                    (retry_source.url, retry_source_links)
                )
                self._record_url_edge(
                    programme,
                    discovered_from=discovered_from,
                    target_url=retry_source.url,
                    relation="admission_coverage_retry",
                )

        retry_context = [
            main_source,
            *retry_sources,
            *[
                source
                for source in sources[1:]
                if source not in retry_sources
                and source.page_type
                in {
                    PageType.PROGRAMME_ADMISSION.value,
                    PageType.INTERNATIONAL_ADMISSION.value,
                    PageType.PDF.value,
                }
            ],
        ]
        if (
            missing_admission_fields
            and len(retry_context) > 1
            and not self.discovery_only
        ):
            self.metrics.add(
                admission_retry_programmes=1,
                admission_retry_sources=len(retry_sources),
            )
            try:
                retry_model, retry_payload = (
                    self.deepseek.extract_admission_package(
                        programme,
                        retry_context,
                        missing_fields=missing_admission_fields,
                        prefer_pro=False,
                    )
                )
                model_name = model_name or retry_model
                facts.extend(retry_payload.get("facts", []))
                self.store.append(
                    "extraction_events",
                    {
                        "programme_id": programme.programme_id,
                        "institution_id": seed.institution_id,
                        "programme_url": programme.official_url,
                        "retrieved_at": utc_now_iso(),
                        "extraction_group": "admission_package_retry",
                        "status": "completed",
                        "source_count": len(retry_sources),
                        "context_source_count": len(retry_context),
                        "missing_fields_requested": list(
                            missing_admission_fields
                        ),
                        "fact_count": len(
                            retry_payload.get("facts", [])
                        ),
                        "model_name": retry_model,
                    },
                )
            except DeepSeekError as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=programme.official_url,
                    stage="admission_coverage_retry_extraction",
                    code="ADMISSION_RETRY_EXTRACTION_FAILED",
                    message=str(exc),
                    retryable=True,
                )

        source_map = {source.url: source for source in sources}
        candidate_assertions: list[FieldAssertion] = []
        seen_assertion_ids: set[str] = set()
        seen_facts: set[tuple[str, str, str, str]] = set()
        for fact in facts:
            fact_key = (
                str(fact.get("field_name")),
                str(fact.get("source_url")),
                json.dumps(
                    fact.get("value"),
                    ensure_ascii=False,
                    sort_keys=True,
                ),
                str(fact.get("evidence")),
            )
            if fact_key in seen_facts:
                continue
            seen_facts.add(fact_key)
            assertion = fact_to_assertion(
                entity_id=programme.programme_id,
                fact=fact,
                source_map=source_map,
                model_name=model_name or "deterministic",
                extractor_version=self.EXTRACTOR_VERSION,
                programme_degree=programme.degree_level,
                programme_name=programme.programme_name,
                programme_url=programme.official_url,
            )
            assertion = self._prepare_assertion(
                assertion,
                seed=seed,
                programme=programme,
            )
            if (
                self.target_fields is not None
                and assertion.field_name not in self.target_fields
            ):
                continue
            if assertion.assertion_id in seen_assertion_ids:
                continue
            seen_assertion_ids.add(assertion.assertion_id)
            candidate_assertions.append(assertion)

        candidate_assertions = merge_current_and_inherited(
            [*candidate_assertions, *approved_baseline],
            inherited_assertions,
        )
        validated_assertions = validate_assertion_set(candidate_assertions)
        accepted_fields = {
            assertion.field_name
            for assertion in validated_assertions
            if (
                has_semantic_value(assertion.value_json)
                and assertion.verification_status
                != VerificationStatus.REJECTED
            )
        }
        coverage_field_scope = (
            tuple(
                field_name
                for field_name in COVERAGE_RETRY_FIELDS
                if field_name in self.target_fields
            )
            if self.target_fields is not None
            else COVERAGE_RETRY_FIELDS
        )
        missing_coverage_fields = tuple(
            field_name
            for field_name in coverage_field_scope
            if field_name not in accepted_fields
        )
        rejected_coverage_fields = {
            assertion.field_name
            for assertion in validated_assertions
            if (
                assertion.field_name in missing_coverage_fields
                and assertion.verification_status
                == VerificationStatus.REJECTED
            )
        }
        coverage_retry_sources: list[ExtractionSource] = []
        coverage_retry_fields = set(rejected_coverage_fields)
        coverage_retry_fields.update(
            field_name
            for field_name in missing_coverage_fields
            if field_name in ALWAYS_DEEP_RECOVERY_FIELDS
        )
        remaining_source_capacity = max(
            0,
            self.config.limits.max_deep_sources_per_programme
            - len(sources),
        )
        coverage_retry_limit = min(
            remaining_source_capacity,
            self.config.limits
            .max_coverage_retry_sources_per_programme,
        )
        if missing_coverage_fields and coverage_retry_limit:
            coverage_candidates = self._coverage_retry_links(
                related_link_contexts,
                seed,
                programme,
                missing_fields=missing_coverage_fields,
                excluded_urls=fetched_urls,
            )
            for (
                discovered_from,
                retry_url,
                matched_fields,
            ) in coverage_candidates:
                if len(coverage_retry_sources) >= coverage_retry_limit:
                    break
                try:
                    (
                        _,
                        retry_source,
                        retry_source_links,
                    ) = self._fetch_and_parse_source(
                        seed, policy, retry_url
                    )
                except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                    self._emit_error(
                        institution_id=seed.institution_id,
                        url=retry_url,
                        stage="field_coverage_retry_fetch",
                        code=getattr(
                            exc, "code", "COVERAGE_RETRY_SOURCE_FAILED"
                        ),
                        message=str(exc),
                        retryable=bool(
                            getattr(exc, "retryable", False)
                        ),
                    )
                    continue
                coverage_retry_sources.append(retry_source)
                sources.append(retry_source)
                fetched_urls.add(canonicalize_url(retry_source.url))
                related_link_contexts.append(
                    (retry_source.url, retry_source_links)
                )
                coverage_retry_fields.update(matched_fields)
                self._record_url_edge(
                    programme,
                    discovered_from=discovered_from,
                    target_url=retry_source.url,
                    relation="field_coverage_retry",
                )

        ordered_retry_fields = tuple(
            field_name
            for field_name in coverage_field_scope
            if field_name in coverage_retry_fields
        )
        extract_fields = getattr(
            self.deepseek, "extract_fields", None
        )
        if (
            ordered_retry_fields
            and callable(extract_fields)
            and not self.discovery_only
        ):
            self.metrics.add(
                coverage_retry_programmes=1,
                coverage_retry_sources=len(coverage_retry_sources),
            )
            try:
                retry_model, coverage_payload = extract_fields(
                    programme,
                    sources,
                    field_names=ordered_retry_fields,
                    # Keep selective recovery concise on Flash. The client
                    # still promotes a group when that group's own evidence is
                    # a PDF; field type alone should not force slow reasoning.
                    prefer_pro=False,
                )
                retry_diagnostics = coverage_payload.get(
                    "group_diagnostics", []
                )
                completed_retry_groups = sum(
                    diagnostic.get("status") == "completed"
                    for diagnostic in retry_diagnostics
                )
                self.metrics.add(
                    coverage_retry_groups=completed_retry_groups
                )
                payload.setdefault("group_diagnostics", []).extend(
                    retry_diagnostics
                )
                model_name = model_name or retry_model
                retry_facts = coverage_payload.get("facts", [])
                facts.extend(retry_facts)
                self.store.append(
                    "extraction_events",
                    {
                        "programme_id": programme.programme_id,
                        "institution_id": seed.institution_id,
                        "programme_url": programme.official_url,
                        "retrieved_at": utc_now_iso(),
                        "extraction_group": "field_coverage_retry",
                        "status": "completed",
                        "source_count": len(coverage_retry_sources),
                        "context_source_count": len(sources),
                        "missing_fields": list(
                            missing_coverage_fields
                        ),
                        "requested_fields": list(
                            ordered_retry_fields
                        ),
                        "fact_count": len(retry_facts),
                        "model_name": retry_model,
                    },
                )
                source_map = {
                    source.url: source for source in sources
                }
                for fact in retry_facts:
                    fact_key = (
                        str(fact.get("field_name")),
                        str(fact.get("source_url")),
                        json.dumps(
                            fact.get("value"),
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                        str(fact.get("evidence")),
                    )
                    if fact_key in seen_facts:
                        continue
                    seen_facts.add(fact_key)
                    assertion = fact_to_assertion(
                        entity_id=programme.programme_id,
                        fact=fact,
                        source_map=source_map,
                        model_name=retry_model
                        or model_name
                        or "deterministic",
                        extractor_version=self.EXTRACTOR_VERSION,
                        programme_degree=programme.degree_level,
                        programme_name=programme.programme_name,
                        programme_url=programme.official_url,
                    )
                    assertion = self._prepare_assertion(
                        assertion,
                        seed=seed,
                        programme=programme,
                    )
                    if (
                        self.target_fields is not None
                        and assertion.field_name not in self.target_fields
                    ):
                        continue
                    if assertion.assertion_id in seen_assertion_ids:
                        continue
                    seen_assertion_ids.add(assertion.assertion_id)
                    candidate_assertions.append(assertion)
                validated_assertions = validate_assertion_set(
                    candidate_assertions
                )
            except DeepSeekError as exc:
                self._emit_error(
                    institution_id=seed.institution_id,
                    url=programme.official_url,
                    stage="field_coverage_retry_extraction",
                    code="COVERAGE_RETRY_EXTRACTION_FAILED",
                    message=str(exc),
                    retryable=True,
                )
        accepted_after_retry = {
            assertion.field_name
            for assertion in validated_assertions
            if (
                has_semantic_value(assertion.value_json)
                and assertion.verification_status
                != VerificationStatus.REJECTED
            )
        }
        excerpt_field_scope = self.target_fields or DEEP_FIELDS
        excerpt_assertions = extract_source_excerpt_assertions(
            entity_id=programme.programme_id,
            sources=sources,
            field_names=tuple(
                field_name
                for field_name in excerpt_field_scope
                if field_name not in accepted_after_retry
            ),
            extractor_version=self.EXTRACTOR_VERSION,
            programme_degree=programme.degree_level,
        )
        for assertion in excerpt_assertions:
            assertion = self._prepare_assertion(
                assertion,
                seed=seed,
                programme=programme,
            )
            if assertion.assertion_id in seen_assertion_ids:
                continue
            seen_assertion_ids.add(assertion.assertion_id)
            candidate_assertions.append(assertion)
        if excerpt_assertions:
            self.metrics.add(
                source_excerpt_fallback_assertions=len(
                    excerpt_assertions
                )
            )
            self.store.append(
                "extraction_events",
                {
                    "programme_id": programme.programme_id,
                    "institution_id": seed.institution_id,
                    "programme_url": programme.official_url,
                    "retrieved_at": utc_now_iso(),
                    "extraction_group": "source_excerpt_fallback",
                    "status": "completed",
                    "source_count": len(sources),
                    "fact_count": len(excerpt_assertions),
                    "fields": [
                        assertion.field_name
                        for assertion in excerpt_assertions
                    ],
                    "model_name": "deterministic-source-excerpt",
                },
            )
            validated_assertions = validate_assertion_set(
                candidate_assertions
            )
        failed_groups = {
            str(diagnostic.get("extraction_group"))
            for diagnostic in payload.get("group_diagnostics", [])
            if diagnostic.get("status") == "failed"
        }
        found_fields: set[str] = set()
        assertions_by_field: dict[str, list[FieldAssertion]] = {}
        for assertion in validated_assertions:
            self._record_assertion(assertion)
        effective_candidates = prefer_human_verified(
            validated_assertions
        )
        effective_assertions, best_decisions = merge_best_assertions(
            state=self.llm_state,
            entity_id=programme.programme_id,
            current_assertions=effective_candidates,
            extractor_version=self.EXTRACTOR_VERSION,
            compatible_extractor_versions=(
                self.COMPATIBLE_ASSERTION_EXTRACTORS
            ),
        )
        if self.target_fields is not None:
            target_field_set = set(self.target_fields)
            effective_assertions = [
                assertion
                for assertion in effective_assertions
                if assertion.field_name in target_field_set
            ]
            best_decisions = [
                decision
                for decision in best_decisions
                if decision.get("field_name") in target_field_set
            ]
        effective_assertions = validate_assertion_set(
            effective_assertions
        )
        invalid_effective_fields = {
            assertion.field_name
            for assertion in effective_assertions
            if assertion.verification_status
            == VerificationStatus.REJECTED
        }
        if invalid_effective_fields:
            for field_name in invalid_effective_fields:
                self.llm_state.delete_best_assertion_bundle(
                    programme.programme_id,
                    field_name,
                )
            for decision in best_decisions:
                if decision.get("field_name") in invalid_effective_fields:
                    decision["post_merge_validation"] = "rejected"
            effective_assertions = [
                assertion
                for assertion in effective_assertions
                if assertion.verification_status
                != VerificationStatus.REJECTED
            ]
        effective_assertions = dedupe_equivalent_assertions(
            effective_assertions
        )
        effective_assertions = [
            self._prepare_assertion(
                assertion,
                seed=seed,
                programme=programme,
            )
            for assertion in effective_assertions
        ]
        current_assertion_ids = {
            assertion.assertion_id for assertion in validated_assertions
        }
        for decision in best_decisions:
            self.store.append("best_assertion_decisions", decision)
        for assertion in effective_assertions:
            if assertion.assertion_id not in current_assertion_ids:
                self._record_assertion(assertion)
            self.store.append("effective_field_assertions", assertion)
            found_fields.add(assertion.field_name)
            assertions_by_field.setdefault(assertion.field_name, []).append(
                assertion
            )
        shared_bundle_events = cache_shared_assertions(
            state=self.state,
            institution_id=seed.institution_id,
            degree_level=programme.degree_level,
            assertions=effective_assertions,
            extractor_version=self.EXTRACTOR_VERSION,
            compatible_extractor_versions=(
                self.COMPATIBLE_ASSERTION_EXTRACTORS
            ),
        )
        if shared_bundle_events:
            self.metrics.add(
                shared_bundles_upserted=len(shared_bundle_events)
            )
            for event in shared_bundle_events:
                self.store.append(
                    "shared_fact_bundles",
                    {
                        **event,
                        "programme_id": programme.programme_id,
                        "retrieved_at": utc_now_iso(),
                    },
                )
        output_field_scope = self.target_fields or DEEP_FIELDS
        for field_name in output_field_scope:
            if field_name not in found_fields:
                missing_assertion = null_assertion(
                    entity_id=programme.programme_id,
                    field_name=field_name,
                    null_reason=self._missing_field_reason(
                        programme,
                        field_name,
                        failed_groups,
                    ),
                    source_url=main_source.url,
                    extractor_version=self.EXTRACTOR_VERSION,
                    model_name=model_name,
                )
                self._record_assertion(missing_assertion)
                self.store.append(
                    "effective_field_assertions",
                    missing_assertion,
                )

        self.store.append(
            "admission_packages",
            build_admission_package(programme, effective_assertions),
        )

        academic_cycle = next(
            (
                assertion.value_json
                for assertion in assertions_by_field.get("academic_cycle", [])
                if isinstance(assertion.value_json, str)
            ),
            None,
        )
        if academic_cycle is None:
            academic_cycle = next(
                (
                    assertion.academic_cycle
                    for field_name in (
                        "intakes",
                        "priority_deadline",
                        "final_deadline",
                        "tuition",
                    )
                    for assertion in assertions_by_field.get(
                        field_name, []
                    )
                    if assertion.academic_cycle
                ),
                None,
            )
        intake_value = next(
            (
                assertion.value_json
                for assertion in assertions_by_field.get("intakes", [])
                if isinstance(assertion.value_json, (str, list))
            ),
            None,
        )
        programme_status = next(
            (
                assertion.value_json
                for assertion in assertions_by_field.get(
                    "programme_status", []
                )
                if isinstance(assertion.value_json, str)
            ),
            programme.programme_status,
        )
        offering = ProgrammeOffering(
            programme_offering_id=stable_id(
                "offering",
                programme.programme_id,
                str(academic_cycle or ""),
                json.dumps(intake_value, ensure_ascii=False, sort_keys=True),
            ),
            programme_id=programme.programme_id,
            academic_cycle=academic_cycle,
            intake=(
                json.dumps(intake_value, ensure_ascii=False)
                if isinstance(intake_value, list)
                else intake_value
            ),
            campus=None,
            delivery_mode=programme.delivery_mode,
            audience="international",
            application_status=programme_status,
        )
        self.store.append("programme_offerings", offering)
        self.metrics.add(deep_programmes_extracted=1)
        return replace(
            programme,
            programme_status=(
                normalize_programme_status(programme_status)
                if programme_status
                else None
            ),
            verification_status=(
                VerificationStatus.NEEDS_REVIEW
                if any(
                    assertion.verification_status
                    == VerificationStatus.NEEDS_REVIEW
                    for assertion in validated_assertions
                )
                else VerificationStatus.RULE_VALIDATED
            ),
        )

    def _choose_status_aware_deep(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
        programmes: list[ProgrammeRecord],
        *,
        include_optional_phd: bool,
    ) -> tuple[
        list[ProgrammeRecord],
        dict[str, tuple[ExtractionSource, list[tuple[str, str]]]],
    ]:
        target = self.config.limits.max_deep_programmes_per_institution
        preflight_limit = min(
            len(programmes),
            max(
                target * 2,
                self.config.limits.max_status_preflight_candidates_per_institution,
            ),
        )
        pool = choose_deep_programmes(
            programmes,
            include_optional_phd=include_optional_phd,
            max_regular=preflight_limit,
        )
        pool_ids = {programme.programme_id for programme in pool}
        # Some official catalogues (notably Harvard GSAS) omit the credential
        # from their index link labels but publish it on each detail page. Probe
        # only enough unknown candidates to fill the requested coverage.
        if len(pool) < preflight_limit:
            unknown = [
                programme
                for programme in programmes
                if programme.programme_id not in pool_ids
                and programme.degree_level is None
            ]
            pool.extend(unknown[: preflight_limit - len(pool)])
        target_total = min(len(pool), target)
        selected: list[ProgrammeRecord] = []
        deferred: list[
            tuple[
                ProgrammeRecord,
                tuple[ExtractionSource, list[tuple[str, str]]] | None,
                bool,
            ]
        ] = []
        preloaded: dict[
            str, tuple[ExtractionSource, list[tuple[str, str]]]
        ] = {}

        for programme in pool:
            if len(selected) >= target_total:
                break
            if programme.catalogue_source == "user_supplied":
                selected.append(programme)
                continue
            self.metrics.add(status_preflight_attempted=1)
            try:
                _, source, links = self._fetch_and_parse_source(
                    seed, policy, programme.official_url
                )
            except (FetchError, RuntimeError, UnsafeUrlError):
                deferred.append(
                    (
                        programme,
                        None,
                        programme.degree_level in {"bachelor", "master"}
                        or programme.catalogue_source == "user_supplied",
                    )
                )
                continue
            programme = refine_programme_name_from_title(
                programme,
                source.title,
            )
            if programme.degree_level is None:
                degree, credential = infer_degree_from_source_text(source.text)
                if degree is not None:
                    programme = replace(
                        programme,
                        degree_level=degree,
                        credential=credential or programme.credential,
                    )
            if not programme_is_selection_eligible(programme):
                deferred.append((programme, (source, links), False))
                continue
            if programme.degree_level == "phd" and not include_optional_phd:
                deferred.append((programme, (source, links), False))
                continue
            status_fact = next(
                (
                    fact
                    for fact in extract_deterministic_facts([source])
                    if fact.get("field_name") == "programme_status"
                ),
                None,
            )
            if status_fact:
                status = normalize_programme_status(status_fact.get("value"))
                programme = replace(programme, programme_status=status)
                if status in INACTIVE_PROGRAMME_STATUSES:
                    self.metrics.add(
                        status_preflight_inactive_candidates=1
                    )
                    deferred.append((programme, (source, links), False))
                    continue
            selected.append(programme)
            preloaded[programme.programme_id] = (source, links)

        if len(selected) < target_total:
            for programme, bundle, fallback_ok in deferred:
                if len(selected) >= target_total:
                    break
                if not fallback_ok:
                    continue
                selected.append(programme)
                if bundle:
                    preloaded[programme.programme_id] = bundle

        return (
            [
                replace(
                    programme,
                    is_deep_selected=True,
                    selection_rank=index,
                )
                for index, programme in enumerate(selected, start=1)
            ],
            preloaded,
        )

    def _process_institution(self, seed: InstitutionSeed) -> None:
        self._progress(f"[{seed.name}] policy check started")
        self.store.append(
            "institutions",
            {
                "institution_id": seed.institution_id,
                "canonical_name": seed.name,
                "country_code": seed.country_code,
                "official_domain": seed.official_domain,
                "official_url": seed.homepage_url,
                "verification_status": "SEED",
                "last_checked_at": utc_now_iso(),
            },
        )
        policy = check_policy(
            seed,
            self.fetcher,
            allow_unreviewed_terms=self.allow_unreviewed_terms,
        )
        self.store.append("policy_checks", policy.check)
        if policy.check.policy_status not in {
            PolicyStatus.ALLOWED,
            PolicyStatus.ALLOWED_TERMS_UNREVIEWED,
        }:
            self.metrics.add(institutions_blocked=1)
            self._emit_error(
                institution_id=seed.institution_id,
                url=seed.homepage_url,
                stage="policy",
                code=policy.check.policy_status.value,
                message="Institution skipped by policy gate.",
                retryable=False,
            )
            return

        if self.skip_school_profile:
            self._progress(
                f"[{seed.name}] school profile skipped for targeted run"
            )
        else:
            self._progress(f"[{seed.name}] school profile extraction started")
            self._process_school_profile(seed, policy)
        self._progress(f"[{seed.name}] catalogue discovery started")
        candidates, sitemaps, discovery_errors = self.discovery.discover(seed, policy)
        self._progress(
            f"[{seed.name}] discovered {len(candidates)} programme candidate(s)"
        )
        for message in discovery_errors:
            self._emit_error(
                institution_id=seed.institution_id,
                url=None,
                stage="discovery",
                code="DISCOVERY_WARNING",
                message=message,
                retryable=False,
            )
        self.state.set_value(
            f"institution:{seed.institution_id}:discovery",
            {
                "candidate_count": len(candidates),
                "sitemaps": sitemaps,
                "completed_at": utc_now_iso(),
            },
        )
        programmes = []
        for candidate in candidates:
            programme = candidate_to_programme(seed.institution_id, candidate)
            metadata = seed.programme_metadata.get(programme.official_url, {})
            programmes.append(
                replace(
                    programme,
                    programme_name=metadata.get(
                        "programme_name", programme.programme_name
                    ),
                    degree_level=metadata.get(
                        "degree_level", programme.degree_level
                    ),
                    credential=metadata.get(
                        "credential", programme.credential
                    ),
                    normalized_field=metadata.get(
                        "normalized_field", programme.normalized_field
                    ),
                )
            )
        deduped: dict[str, ProgrammeRecord] = {}
        for programme in programmes:
            # Catalogue navigation often publishes both /path and /path/ for
            # the same page. Treat those as one programme before identity and
            # coverage selection, while preserving the richer record.
            key = programme.official_url.rstrip("/")
            existing = deduped.get(key)
            quality = (
                int(programme.catalogue_source == "user_supplied"),
                int(programme.credential is not None),
                int(programme.degree_level is not None),
                -len(programme.programme_name),
            )
            existing_quality = (
                (
                    int(existing.catalogue_source == "user_supplied"),
                    int(existing.credential is not None),
                    int(existing.degree_level is not None),
                    -len(existing.programme_name),
                )
                if existing is not None
                else None
            )
            if existing is None or quality > existing_quality:
                deduped[key] = programme
        programmes = sorted(
            deduped.values(), key=lambda item: (item.programme_name, item.official_url)
        )
        programmes = apply_programme_priorities(
            programmes,
            seed.programme_priorities,
        )
        priority_match_count = sum(
            programme.priority_rank is not None
            for programme in programmes
        )
        if seed.programme_priorities:
            self._progress(
                f"[{seed.name}] IPEDS priority matches "
                f"{priority_match_count}/{len(programmes)} candidates"
            )
        if not programmes:
            self._emit_error(
                institution_id=seed.institution_id,
                url=None,
                stage="discovery",
                code="NO_PROGRAMMES_DISCOVERED",
                message="No programme candidates were found from approved sources.",
                retryable=False,
            )

        with self._optional_phd_lock:
            include_phd = (
                seed.enable_optional_phd
                and self._optional_phd_used
                < self.config.limits.max_optional_phd_total
            )
        deep, preloaded_main = self._choose_status_aware_deep(
            seed,
            policy,
            programmes,
            include_optional_phd=include_phd,
        )
        with self._optional_phd_lock:
            if any(programme.degree_level == "phd" for programme in deep):
                self._optional_phd_used += 1
        deep_ids = {programme.programme_id for programme in deep}
        programmes = [
            replace(
                programme,
                is_deep_selected=programme.programme_id in deep_ids,
                selection_basis=(
                    next(
                        (
                            item.selection_basis
                            for item in deep
                            if item.programme_id == programme.programme_id
                        ),
                        None,
                    )
                ),
                selection_rank=(
                    next(
                        (
                            item.selection_rank
                            for item in deep
                            if item.programme_id == programme.programme_id
                        ),
                        None,
                    )
                ),
            )
            for programme in programmes
        ]
        self.metrics.add(programmes_discovered=len(programmes))

        enriched_by_id = self._process_selected_deep(
            seed,
            policy,
            deep,
            preloaded_main,
        )
        programmes = [
            enriched_by_id.get(programme.programme_id, programme)
            for programme in programmes
        ]
        for programme in programmes:
            self.store.append("programmes", programme)
        self.metrics.add(institutions_completed=1)

    def _process_selected_deep(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
        deep: list[ProgrammeRecord],
        preloaded_main: dict[
            str, tuple[ExtractionSource, list[tuple[str, str]]]
        ],
    ) -> dict[str, ProgrammeRecord]:
        """Seed each degree bundle, then parallelize only dependent work."""
        if not deep:
            return {}
        seeders: list[ProgrammeRecord] = []
        remaining: list[ProgrammeRecord] = []
        seeded_degrees: set[str] = set()
        for programme in deep:
            degree = str(programme.degree_level or "unknown").lower()
            if degree not in seeded_degrees:
                seeded_degrees.add(degree)
                seeders.append(programme)
            else:
                remaining.append(programme)

        positions = {
            programme.programme_id: index
            for index, programme in enumerate(deep, start=1)
        }
        enriched_by_id: dict[str, ProgrammeRecord] = {}

        def process_one(programme: ProgrammeRecord) -> ProgrammeRecord:
            index = positions[programme.programme_id]
            self._progress(
                f"[{seed.name}] deep extraction {index}/{len(deep)}: "
                f"{programme.programme_name}"
            )
            return self._process_deep(
                seed,
                policy,
                programme,
                preloaded_main.get(programme.programme_id),
            )

        for programme in seeders:
            enriched_by_id[programme.programme_id] = process_one(programme)

        worker_count = min(
            self.config.limits.programme_concurrency_per_institution,
            len(remaining),
        )
        if worker_count <= 1:
            for programme in remaining:
                enriched_by_id[programme.programme_id] = process_one(
                    programme
                )
            return enriched_by_id

        self._progress(
            f"[{seed.name}] programme concurrency enabled: "
            f"{worker_count} worker(s) after {len(seeders)} bundle seeder(s)"
        )
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = {
                executor.submit(process_one, programme): programme
                for programme in remaining
            }
            for future in as_completed(futures):
                programme = futures[future]
                enriched_by_id[programme.programme_id] = future.result()
        return enriched_by_id

    def _write_reports(self) -> None:
        self._write_review_queue()
        self._write_admission_package_report()
        self._write_programme_selection_report()
        metrics = self.metrics.to_dict()
        with self._coverage_lock:
            covered_slots = set(self._coverage_slots)
            non_null_slots = set(self._non_null_slots)
            not_applicable_slots = set(self._not_applicable_slots)
        applicable_slots = covered_slots - not_applicable_slots
        coverage = (
            len(non_null_slots & applicable_slots) / len(applicable_slots)
            if applicable_slots
            else 0.0
        )
        field_coverage = {}
        for field_name in (*DEEP_FIELDS, *SCHOOL_PROFILE_FIELDS):
            field_slots = {
                slot for slot in covered_slots if slot[1] == field_name
            }
            field_not_applicable = field_slots & not_applicable_slots
            field_applicable = field_slots - field_not_applicable
            field_non_null = field_slots & non_null_slots
            field_coverage[field_name] = {
                "applicable_slots": len(field_applicable),
                "non_null_slots": len(field_non_null & field_applicable),
                "not_applicable_slots": len(field_not_applicable),
                "coverage_ratio": round(
                    (
                        len(field_non_null & field_applicable)
                        / len(field_applicable)
                    )
                    if field_applicable
                    else 0.0,
                    4,
                ),
            }
        effective_records = self._load_jsonl(
            self.paths.jsonl_path("effective_field_assertions")
        )
        effective_non_null = [
            assertion
            for assertion in effective_records
            if (
                has_semantic_value(assertion.get("value_json"))
                and assertion.get("verification_status")
                != VerificationStatus.REJECTED.value
            )
        ]
        effective_non_null_slots = {
            (
                str(assertion.get("entity_id") or ""),
                str(assertion.get("field_name") or ""),
            )
            for assertion in effective_non_null
        }
        best_decisions = self._load_jsonl(
            self.paths.jsonl_path("best_assertion_decisions")
        )
        comparable_decisions = [
            decision
            for decision in best_decisions
            if decision.get("effective_value_stable") is not None
        ]
        stable_decisions = [
            decision
            for decision in comparable_decisions
            if decision.get("effective_value_stable") is True
        ]
        selected_current = sum(
            decision.get("selected") == "current"
            for decision in best_decisions
        )
        selected_cached = sum(
            decision.get("selected") == "cached"
            for decision in best_decisions
        )
        report = {
            "run_name": self.config.run_name,
            "generated_at": utc_now_iso(),
            "metrics": metrics,
            "deepseek": self.deepseek.stats.to_dict(),
            "crawler_runtime": {
                "discovery_backend": self.discovery_backend,
                "render_policy": self.render_policy,
                "target_fields": list(self.target_fields or ()),
                "run_mode": "delta" if self.target_fields else "full",
                "skip_school_profile": self.skip_school_profile,
                "programme_concurrency_per_institution": (
                    self.config.limits
                    .programme_concurrency_per_institution
                ),
            },
            "coverage": {
                "non_null_assertion_ratio": round(coverage, 4),
                "unique_field_slots": len(covered_slots),
                "applicable_field_slots": len(applicable_slots),
                "non_null_field_slots": len(non_null_slots & applicable_slots),
                "not_applicable_field_slots": len(not_applicable_slots),
                "field_coverage": field_coverage,
                "note": (
                    "Coverage uses unique applicable entity/field slots and excludes "
                    "rejected audit records. Coverage is not accuracy; human QA must "
                    "validate high-risk fields."
                ),
            },
            "best_result": {
                "effective_non_null_assertions": len(
                    effective_non_null
                ),
                "effective_non_null_field_slots": len(
                    effective_non_null_slots
                ),
                "selected_current_fields": selected_current,
                "selected_cached_fields": selected_cached,
                "comparable_fields": len(comparable_decisions),
                "stable_fields": len(stable_decisions),
                "stability_ratio": round(
                    len(stable_decisions) / len(comparable_decisions),
                    4,
                )
                if comparable_decisions
                else None,
                "note": (
                    "Effective assertions are the selected product-facing "
                    "bundle. Audit assertions remain in field_assertions.jsonl."
                ),
            },
        }
        self.store.write_json("coverage_report.json", report)
        self.store.write_json(
            "manifest.json",
            {
                "schema_version": "GlowBalSmokeRun/v2",
                "run_name": self.config.run_name,
                "started_at": self.metrics.started_at,
                "completed_at": self.metrics.completed_at,
                "institutions": [
                    {
                        "institution_id": seed.institution_id,
                        "name": seed.name,
                        "country_code": seed.country_code,
                        "programme_priority_count": len(
                            seed.programme_priorities
                        ),
                    }
                    for seed in self.config.institutions
                ],
                "models": {
                    "flash": self.config.deepseek_flash_model,
                    "pro": self.config.deepseek_pro_model,
                },
                "discovery_only": self.discovery_only,
                "allow_unreviewed_terms": self.allow_unreviewed_terms,
                "run_mode": "delta" if self.target_fields else "full",
                "target_fields": list(self.target_fields or ()),
                "skip_school_profile": self.skip_school_profile,
                "crawler_runtime": {
                    "discovery_backend": self.discovery_backend,
                    "render_policy": self.render_policy,
                    "programme_concurrency_per_institution": (
                        self.config.limits
                        .programme_concurrency_per_institution
                    ),
                },
                "artifacts": sorted(
                    str(path.relative_to(self.paths.root)).replace("\\", "/")
                    for path in self.paths.root.rglob("*")
                    if path.is_file() and path.name != "crawl_state.sqlite-wal"
                ),
            },
        )

    def _write_admission_package_report(self) -> None:
        source_path = self.paths.jsonl_path("admission_packages")
        packages = (
            [
                json.loads(line)
                for line in source_path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            if source_path.exists()
            else []
        )
        decision_counts: dict[str, int] = {}
        document_coverage: dict[str, dict[str, int | float]] = {}
        for package in packages:
            precheck = evaluate_package(
                package.get("requirements") or [],
                inventory=None,
            )
            package["precheck"] = precheck
            decision = str(precheck.get("decision") or "UNKNOWN")
            decision_counts[decision] = decision_counts.get(decision, 0) + 1
            for requirement in package.get("requirements") or []:
                document_type = str(
                    requirement.get("document_type") or "unknown"
                )
                counters = document_coverage.setdefault(
                    document_type,
                    {"known": 0, "total": 0, "coverage_ratio": 0.0},
                )
                counters["total"] = int(counters["total"]) + 1
                if requirement.get("requirement_status") != "unknown":
                    counters["known"] = int(counters["known"]) + 1
        for counters in document_coverage.values():
            total = int(counters["total"])
            counters["coverage_ratio"] = round(
                int(counters["known"]) / total if total else 0.0,
                4,
            )
        self.store.replace_jsonl("admission_packages", packages)
        programmes = [
            {
                "programme_id": package.get("programme_id"),
                "institution_id": package.get("institution_id"),
                "programme_name": package.get("programme_name"),
                "official_url": package.get("official_url"),
                "decision": (package.get("precheck") or {}).get("decision"),
                "missing_documents": (
                    package.get("precheck") or {}
                ).get("missing_documents", []),
                "unknown_documents": (
                    package.get("precheck") or {}
                ).get("unknown_documents", []),
                "later_stage_documents": (
                    package.get("precheck") or {}
                ).get("later_stage_documents", []),
                "requirements": package.get("requirements", []),
            }
            for package in packages
        ]
        self.store.write_json(
            "admission_package_report.json",
            {
                "generated_at": utc_now_iso(),
                "programme_count": len(packages),
                "decision_counts": decision_counts,
                "document_coverage": document_coverage,
                "programmes": programmes,
            },
        )

    @staticmethod
    def _load_jsonl(path: Path) -> list[dict[str, object]]:
        if not path.exists():
            return []
        records: list[dict[str, object]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    records.append(json.loads(line))
        return records

    def _write_programme_selection_report(self) -> None:
        programmes = self._load_jsonl(
            self.paths.jsonl_path("programmes")
        )
        selected = sorted(
            (
                programme
                for programme in programmes
                if programme.get("is_deep_selected")
            ),
            key=lambda programme: (
                str(programme.get("institution_id") or ""),
                int(programme.get("selection_rank") or 10_000),
                str(programme.get("programme_name") or ""),
            ),
        )
        basis_counts: dict[str, int] = {}
        for programme in selected:
            basis = str(
                programme.get("selection_basis") or "unspecified"
            )
            basis_counts[basis] = basis_counts.get(basis, 0) + 1
        self.store.write_json(
            "programme_selection_report.json",
            {
                "schema_version": "GlowBalProgrammeSelection/v1",
                "generated_at": utc_now_iso(),
                "candidate_count": len(programmes),
                "ipeds_matched_candidate_count": sum(
                    programme.get("priority_rank") is not None
                    for programme in programmes
                ),
                "deep_selected_count": len(selected),
                "selection_basis_counts": basis_counts,
                "interpretation": (
                    "IPEDS priority means the CIP field had more completed "
                    "awards. It does not mean the programme is easier to enter "
                    "or has more applicants."
                ),
                "programmes": [
                    {
                        "institution_id": programme.get(
                            "institution_id"
                        ),
                        "programme_id": programme.get("programme_id"),
                        "programme_name": programme.get(
                            "programme_name"
                        ),
                        "official_url": programme.get("official_url"),
                        "degree_level": programme.get("degree_level"),
                        "selection_rank": programme.get(
                            "selection_rank"
                        ),
                        "selection_basis": programme.get(
                            "selection_basis"
                        ),
                        "ipeds_priority": (
                            {
                                "source": programme.get(
                                    "priority_source"
                                ),
                                "rank": programme.get("priority_rank"),
                                "cip_title": programme.get(
                                    "priority_label"
                                ),
                                "cip_code": programme.get(
                                    "priority_taxonomy_code"
                                ),
                                "completions_total": programme.get(
                                    "priority_completions_total"
                                ),
                                "degree_completions": programme.get(
                                    "priority_degree_completions"
                                ),
                                "name_match_score": programme.get(
                                    "priority_match_score"
                                ),
                            }
                            if programme.get("priority_rank") is not None
                            else None
                        ),
                    }
                    for programme in selected
                ],
            },
        )

    def _write_review_queue(self) -> None:
        programmes = {
            str(record["programme_id"]): record
            for record in self._load_jsonl(
                self.paths.jsonl_path("programmes")
            )
            if record.get("is_deep_selected")
        }
        assertions_by_programme: dict[
            str, list[dict[str, object]]
        ] = {}
        effective_path = self.paths.jsonl_path(
            "effective_field_assertions"
        )
        assertion_path = (
            effective_path
            if effective_path.exists()
            else self.paths.jsonl_path("field_assertions")
        )
        for assertion in self._load_jsonl(assertion_path):
            entity_id = str(assertion.get("entity_id") or "")
            if entity_id in programmes:
                assertions_by_programme.setdefault(entity_id, []).append(
                    assertion
                )
        diagnostics_by_programme: dict[
            str, list[dict[str, object]]
        ] = {}
        for diagnostic in self._load_jsonl(
            self.paths.jsonl_path("extraction_events")
        ):
            programme_id = str(diagnostic.get("programme_id") or "")
            if programme_id in programmes:
                diagnostics_by_programme.setdefault(
                    programme_id, []
                ).append(diagnostic)

        review_items: list[dict[str, object]] = []
        review_groups: dict[str, dict[str, object]] = {}
        for programme_id, programme in sorted(
            programmes.items(),
            key=lambda item: (
                str(item[1].get("institution_id")),
                str(item[1].get("programme_name")),
            ),
        ):
            assertions = assertions_by_programme.get(programme_id, [])
            fields: dict[str, list[dict[str, object]]] = {
                field_name: [] for field_name in DEEP_FIELDS
            }
            status_counts: dict[str, int] = {}
            review_reasons: list[str] = []
            accepted_non_null_count = 0
            rejected_fields: set[str] = set()
            for assertion in assertions:
                field_name = str(assertion.get("field_name") or "")
                if field_name not in fields:
                    continue
                verification_status = str(
                    assertion.get("verification_status") or "UNKNOWN"
                )
                status_counts[verification_status] = (
                    status_counts.get(verification_status, 0) + 1
                )
                if (
                    has_semantic_value(assertion.get("value_json"))
                    and verification_status
                    != VerificationStatus.REJECTED.value
                ):
                    accepted_non_null_count += 1
                if verification_status == VerificationStatus.REJECTED.value:
                    rejected_fields.add(field_name)
                validation_errors = [
                    str(error)
                    for error in assertion.get("validation_errors", [])
                ]
                review_reasons.extend(validation_errors)
                review_fingerprint = str(
                    assertion.get("review_fingerprint") or ""
                )
                if (
                    review_fingerprint
                    and (
                        verification_status
                        == VerificationStatus.NEEDS_REVIEW.value
                        or validation_errors
                    )
                ):
                    group = review_groups.setdefault(
                        review_fingerprint,
                        {
                            "review_fingerprint": review_fingerprint,
                            "field_name": field_name,
                            "value": assertion.get("value_json"),
                            "source_url": assertion.get("source_url"),
                            "evidence": assertion.get("evidence"),
                            "scope": assertion.get("scope"),
                            "audience": assertion.get("audience"),
                            "academic_cycle": assertion.get(
                                "academic_cycle"
                            ),
                            "members": [],
                        },
                    )
                    members = group["members"]
                    if isinstance(members, list):
                        members.append(
                            {
                                "programme_id": programme_id,
                                "assertion_id": assertion.get(
                                    "assertion_id"
                                ),
                                "inherited_from_assertion_id": (
                                    assertion.get(
                                        "inherited_from_assertion_id"
                                    )
                                ),
                            }
                        )
                fields[field_name].append(
                    {
                        "assertion_id": assertion.get("assertion_id"),
                        "value": assertion.get("value_json"),
                        "null_reason": assertion.get("null_reason"),
                        "verification_status": verification_status,
                        "review_fingerprint": (
                            review_fingerprint or None
                        ),
                        "academic_cycle": assertion.get("academic_cycle"),
                        "audience": assertion.get("audience"),
                        "source_url": assertion.get("source_url"),
                        "evidence": assertion.get("evidence"),
                        "validation_errors": validation_errors,
                        "extraction_group": assertion.get(
                            "extraction_group"
                        ),
                        "applicability_source_url": assertion.get(
                            "applicability_source_url"
                        ),
                        "applicability_evidence": assertion.get(
                            "applicability_evidence"
                        ),
                        "source_content_hash": assertion.get(
                            "source_content_hash"
                        ),
                        "inherited_from_assertion_id": assertion.get(
                            "inherited_from_assertion_id"
                        ),
                        "inherited_from_entity_id": assertion.get(
                            "inherited_from_entity_id"
                        ),
                        "inheritance_key": assertion.get(
                            "inheritance_key"
                        ),
                    }
                )

            decision = review_decision(
                programme_status=(
                    str(programme.get("programme_status"))
                    if programme.get("programme_status")
                    else None
                ),
                rejected_count=status_counts.get(
                    VerificationStatus.REJECTED.value, 0
                ),
                needs_review_count=status_counts.get(
                    VerificationStatus.NEEDS_REVIEW.value, 0
                ),
                accepted_non_null_count=accepted_non_null_count,
            )
            review_items.append(
                {
                    "programme_id": programme_id,
                    "institution_id": programme.get("institution_id"),
                    "programme_name": programme.get("programme_name"),
                    "official_url": programme.get("official_url"),
                    "degree_level": programme.get("degree_level"),
                    "credential": programme.get("credential"),
                    "programme_status": programme.get(
                        "programme_status"
                    ),
                    "decision": decision,
                    "accepted_non_null_assertion_count": (
                        accepted_non_null_count
                    ),
                    "rejected_fields": sorted(rejected_fields),
                    "assertion_status_counts": status_counts,
                    "review_reasons": sorted(set(review_reasons)),
                    "extraction_diagnostics": (
                        diagnostics_by_programme.get(programme_id, [])
                    ),
                    "fields": fields,
                }
            )
        self.store.write_json(
            "review_queue.json",
            {
                "schema_version": "GlowBalReviewQueue/v2",
                "generated_at": utc_now_iso(),
                "programme_count": len(review_items),
                "review_group_count": len(review_groups),
                "review_groups": sorted(
                    review_groups.values(),
                    key=lambda group: (
                        str(group.get("field_name") or ""),
                        str(group.get("review_fingerprint") or ""),
                    ),
                ),
                "programmes": review_items,
            },
        )

    def run(self) -> dict[str, object]:
        if not self.discovery_only and not self.deepseek.configured:
            raise RuntimeError(
                "DEEPSEEK_API_KEY is required unless --discovery-only is used."
            )
        self._start_monotonic = time.monotonic()
        self._progress(
            f"Starting smoke run for {len(self.config.institutions)} institution(s)"
        )
        try:
            with ThreadPoolExecutor(
                max_workers=min(
                    self.config.limits.global_concurrency,
                    self.config.limits.institution_concurrency,
                    len(self.config.institutions),
                )
            ) as executor:
                futures = {
                    executor.submit(self._process_institution, seed): seed
                    for seed in self.config.institutions
                }
                for future in as_completed(futures):
                    seed = futures[future]
                    try:
                        future.result()
                    except Exception as exc:
                        self._emit_error(
                            institution_id=seed.institution_id,
                            url=seed.homepage_url,
                            stage="institution",
                            code="UNHANDLED_INSTITUTION_ERROR",
                            message=str(exc),
                            retryable=False,
                        )
                    finally:
                        self._advance_progress(seed)
        finally:
            self.metrics.completed_at = utc_now_iso()
            self.metrics.elapsed_seconds = round(
                time.monotonic() - self._start_monotonic, 3
            )
            try:
                self._write_reports()
            finally:
                self.state.close()
                self.llm_state.close()
            self._progress(
                f"Run finished in {self._elapsed_label(self.metrics.elapsed_seconds)}; "
                f"programmes={self.metrics.programmes_discovered}; "
                f"errors={self.metrics.errors}"
            )
        return self.metrics.to_dict()
