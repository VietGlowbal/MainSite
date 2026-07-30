from __future__ import annotations

import json
import re
from collections import deque
from dataclasses import dataclass
from typing import Callable
from urllib.parse import quote, urlencode, urlsplit

from .config import InstitutionSeed
from .fetcher import FetchError, SafeFetcher
from .parsing import parse_html, parse_sitemap
from .policy import RobotsPolicy
from .scrapy_adapter import ScrapyDiscoveryAdapter
from .url_safety import (
    UnsafeUrlError,
    canonicalize_url,
    hostname_matches,
    is_nonproduction_hostname,
)


PROGRAMME_PATH_RE = re.compile(
    r"/(?:"
    r"program(?:me)?s?|degrees?|courses|catalog(?:ue)?|"
    r"bachelors?|masters?|"
    r"(?:graduate|undergraduate)[-_]degrees?|"
    r"(?:graduate|undergraduate)[-_]program(?:me)?s?|"
    r"majors?[-_]programs?|majors?[-_]concentrations?|"
    r"departments?[-_]instruction|"
    r"graduation[-_]requirements[-_]all[-_]options|"
    r"special[-_]regulations[-_]for[-_]graduate[-_]options|"
    r"areas?[-_]of[-_]study[-_]and[-_]research"
    r")/",
    re.IGNORECASE,
)
DEGREE_TOKEN_RE = re.compile(
    r"(?:^|[-_/])(bsc|ba|bs|sb|beng|msc|ma|ms|sm|meng|mba|mph|phd|dphil|doctorate)(?:[-_/]|$)",
    re.IGNORECASE,
)
OFF_SCOPE_RE = re.compile(
    r"/(?:news|events?|articles?|people|staff|faculty-members?|blog|press|"
    r"research-news|alumni|giving|login|search|archives?|thesis|"
    r"admission-guide|minors?|scholarships?|workshops?|"
    r"professional-development|academic-policies)(?:/|$)",
    re.IGNORECASE,
)
INDEX_TEXT_RE = re.compile(
    r"(?:"
    r"academics?|academic programs?|all (?:programs|programmes|courses)|"
    r"areas? of study|degree (?:finder|options?)|"
    r"departments? (?:and|&) programs?|explore programs?|"
    r"fields? of study|graduate (?:degrees?|programs?)|"
    r"undergraduate degrees?|majors?(?: and minors?)?|"
    r"program(?:me)? finder|schools? (?:and|&) departments?|"
    r"course catalogue|course catalog|undergraduate programs?"
    r")",
    re.IGNORECASE,
)
PROGRAMME_WORD_RE = re.compile(
    r"\b(bachelor|master|doctor|phd|dphil)\b",
    re.IGNORECASE,
)
PROGRAMME_ACRONYM_RE = re.compile(
    r"\b(BSc|BA|BS|SB|BEng|MSc|MA|MS|SM|MEng|MBA|MPH|PhD|DPhil)\b"
)
GENERIC_DETAIL_RE = re.compile(
    r"^(?:19|20)\d{2}$|^(?:program(?:me)?s?|degrees?|courses?|catalog(?:ue)?|"
    r"bachelors?|masters?|undergraduate|graduate|postgraduate|"
    r"(?:undergraduate|graduate|postgraduate|masters?|doctoral)[-_]"
    r"program(?:me)?s?|postgraduate-taught)$",
    re.IGNORECASE,
)
NON_PROGRAMME_DETAIL_RE = re.compile(
    r"(?:subject[-_]?groupings?|tracks?|workshops?|index(?:\.html?)?)$",
    re.IGNORECASE,
)
CURATED_INDEX_PATH_RE = re.compile(
    r"/(?:programs?|programmes?|programs-of-study|programsofstudy|"
    r"degree-programs?|majors(?:-degrees)?|fields-study)/?$",
    re.IGNORECASE,
)
GENERIC_NAV_TEXT_RE = re.compile(
    r"^(?:about|academics?|admissions?|apply|contact|home|news|events?|"
    r"faculty|staff|students?|research|requirements?|resources?|"
    r"learn more|read more|view all|programs?|degrees?|majors?)$",
    re.IGNORECASE,
)
COURSEDOG_TENANT_RE = re.compile(
    r'<meta\s+property="og:url"\s+content="([a-z0-9_-]+)-catalog\.coursedog\.com"',
    re.IGNORECASE,
)
COURSEDOG_DEGREE_RE = re.compile(
    r"\b(?:associate|bachelor|master|doctor|ph\.?d|b\.?a\.?|b\.?s\.?|"
    r"m\.?a\.?|m\.?s\.?|m\.?b\.?a\.?)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ProgrammeCandidate:
    url: str
    name_hint: str | None
    catalogue_source: str
    score: int


def programme_url_score(url: str, anchor_text: str = "") -> int:
    parsed = urlsplit(url)
    path = parsed.path.lower()
    if OFF_SCOPE_RE.search(path):
        return -100
    score = 0
    if PROGRAMME_PATH_RE.search(f"{path}/"):
        score += 3
    if DEGREE_TOKEN_RE.search(path):
        score += 3
    if (
        PROGRAMME_WORD_RE.search(anchor_text)
        or PROGRAMME_ACRONYM_RE.search(anchor_text)
    ):
        score += 3
    if len([part for part in path.split("/") if part]) >= 2:
        score += 1
    if path.endswith((".pdf", ".doc", ".docx", ".jpg", ".png")):
        score -= 5
    return score


def looks_like_programme_detail(url: str) -> bool:
    parts = [
        part for part in urlsplit(url).path.rstrip("/").split("/") if part
    ]
    return bool(parts) and not (
        GENERIC_DETAIL_RE.fullmatch(parts[-1])
        or NON_PROGRAMME_DETAIL_RE.search(parts[-1])
    )


def looks_like_index(url: str, anchor_text: str) -> bool:
    if INDEX_TEXT_RE.search(anchor_text):
        return True
    path = urlsplit(url).path.lower().rstrip("/")
    return path.endswith(
        (
            "/programs",
            "/programmes",
            "/courses",
            "/degrees",
            "/graduate-degrees",
            "/undergraduate-degrees",
            "/academics",
            "/academic-programs",
            "/areas-of-study",
            "/catalog",
            "/catalogue",
            "/departments",
            "/fields-of-study",
            "/majors",
        )
    )


def is_direct_curated_index_candidate(
    *,
    root_source: str,
    target_url: str,
    anchor_text: str,
    depth: int,
) -> bool:
    """Allow named links directly listed by an explicit programme index."""
    text = " ".join(anchor_text.split())
    if (
        depth != 0
        or not 3 <= len(text) <= 160
        or GENERIC_NAV_TEXT_RE.fullmatch(text)
        or not CURATED_INDEX_PATH_RE.search(urlsplit(root_source).path)
    ):
        return False
    root_path = urlsplit(root_source).path.rstrip("/")
    target = urlsplit(target_url)
    if target.path.rstrip("/") == root_path:
        return False
    return programme_url_score(target_url, text) >= 1


class CatalogueDiscovery:
    def __init__(
        self,
        fetcher: SafeFetcher,
        progress: Callable[[str], None] | None = None,
        *,
        backend: str = "native",
        scrapy_adapter: ScrapyDiscoveryAdapter | None = None,
        graph_sink: Callable[[dict[str, object]], None] | None = None,
    ) -> None:
        if backend not in {"native", "scrapy", "hybrid"}:
            raise ValueError(
                "Discovery backend must be native, scrapy or hybrid."
            )
        if backend in {"scrapy", "hybrid"} and scrapy_adapter is None:
            raise ValueError(
                f"Discovery backend {backend} requires a Scrapy adapter."
            )
        self.fetcher = fetcher
        self.progress = progress
        self.backend = backend
        self.scrapy_adapter = scrapy_adapter
        self.graph_sink = graph_sink

    def _report(self, message: str) -> None:
        if self.progress:
            self.progress(message)

    def _discover_coursedog_programmes(
        self,
        *,
        page_body: bytes,
        catalogue_url: str,
        seed: InstitutionSeed,
    ) -> tuple[list[ProgrammeCandidate], list[str]]:
        """Discover server-rendered programme pages behind Coursedog indexes."""
        text = page_body.decode("utf-8", errors="replace")
        tenant_match = COURSEDOG_TENANT_RE.search(text)
        if not tenant_match:
            return [], []
        tenant = tenant_match.group(1)
        catalog_match = re.search(
            rf'"([A-Za-z0-9_-]{{16,32}})","[^"\r\n]{{1,200}}",'
            rf'"{re.escape(tenant)}","',
            text,
        )
        if not catalog_match:
            return [], [f"{catalogue_url}: COURSEDOG_CATALOG_ID_NOT_FOUND"]

        catalog_id = catalog_match.group(1)
        columns = (
            "name,longName,catalogDisplayName,catalogDescription,"
            "degreeDesignation,level,type,status,programGroupId,code,cipCode"
        )
        query = urlencode(
            {
                "catalogId": catalog_id,
                "skip": 0,
                "limit": 1000,
                "sortBy": "catalogDisplayName",
                "columns": columns,
            }
        )
        api_url = (
            f"https://app.coursedog.com/api/v1/cm/{quote(tenant, safe='')}/"
            f"programs/search/%24filters?{query}"
        )
        origin = f"{urlsplit(catalogue_url).scheme}://{urlsplit(catalogue_url).netloc}"
        try:
            result = self.fetcher.fetch(
                api_url,
                allowed_domains=("app.coursedog.com",),
                accept="application/json",
                method="POST",
                data=b"{}",
                request_headers={
                    "Content-Type": "application/json",
                    "X-Requested-With": "catalog",
                    "Origin": origin,
                    "Referer": f"{origin}/",
                },
            )
            payload = json.loads(result.body.decode("utf-8"))
        except (FetchError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            code = exc.code if isinstance(exc, FetchError) else "INVALID_JSON"
            return [], [f"{api_url}: COURSEDOG_{code}"]

        candidates: list[ProgrammeCandidate] = []
        for item in payload.get("data", []):
            if not isinstance(item, dict) or item.get("status") != "Active":
                continue
            group_id = str(item.get("programGroupId") or "").strip()
            display_name = str(
                item.get("catalogDisplayName")
                or item.get("longName")
                or item.get("name")
                or ""
            ).strip()
            degree = str(item.get("degreeDesignation") or "").strip()
            type_text = str(item.get("type") or "").strip()
            degree_text = " ".join((degree, type_text, str(item.get("catalogDescription") or "")))
            if (
                not group_id
                or not display_name
                or not COURSEDOG_DEGREE_RE.search(degree_text)
            ):
                continue
            name_hint = f"{display_name} - {degree}" if degree else display_name
            candidates.append(
                ProgrammeCandidate(
                    url=f"{origin}/programs/{quote(group_id, safe='')}",
                    name_hint=name_hint,
                    catalogue_source=catalogue_url,
                    score=7,
                )
            )
        self._report(
            f"[{seed.name}] Coursedog API discovered {len(candidates)} "
            f"degree programme candidate(s)"
        )
        return candidates, []

    def _common_sitemaps(self, seed: InstitutionSeed) -> list[str]:
        homepage = urlsplit(seed.homepage_url)
        base = f"https://{homepage.netloc}"
        return [
            f"{base}/sitemap.xml",
            f"{base}/sitemap_index.xml",
            f"{base}/sitemap-index.xml",
            f"{base}/program-sitemap.xml",
            f"{base}/programme-sitemap.xml",
            f"{base}/course-sitemap.xml",
        ]

    @staticmethod
    def _matches_seed_pattern(seed: InstitutionSeed, url: str) -> bool:
        if not seed.programme_url_patterns:
            return True
        return any(
            re.search(pattern, url, re.IGNORECASE)
            for pattern in seed.programme_url_patterns
        )

    def discover(
        self,
        seed: InstitutionSeed,
        policy: RobotsPolicy,
    ) -> tuple[list[ProgrammeCandidate], list[str], list[str]]:
        candidates: dict[str, ProgrammeCandidate] = {}
        successful_sitemaps: list[str] = []
        errors: list[str] = []

        for manual_url in seed.manual_programme_urls:
            try:
                canonical = canonicalize_url(manual_url)
            except UnsafeUrlError as exc:
                errors.append(f"{manual_url}: INVALID_MANUAL_URL ({exc})")
                continue
            if not hostname_matches(
                urlsplit(canonical).hostname or "", seed.all_allowed_domains
            ):
                errors.append(f"{canonical}: MANUAL_URL_OUTSIDE_OFFICIAL_DOMAIN")
                continue
            if not policy.allows(canonical, self.fetcher.limits.user_agent):
                errors.append(f"{canonical}: BLOCKED_BY_ROBOTS")
                continue
            candidates[canonical] = ProgrammeCandidate(
                url=canonical,
                name_hint=None,
                catalogue_source="user_supplied",
                score=100,
            )

        if seed.manual_only:
            return (
                sorted(
                    candidates.values(),
                    key=lambda item: (-item.score, item.url),
                ),
                [],
                errors,
            )

        sitemap_queue = deque(
            dict.fromkeys((*policy.check.sitemaps, *self._common_sitemaps(seed)))
        )
        visited_sitemaps: set[str] = set()
        total_sitemap_urls = 0

        while (
            sitemap_queue
            and len(visited_sitemaps)
            < self.fetcher.limits.max_sitemaps_per_institution
            and total_sitemap_urls < self.fetcher.limits.max_sitemap_urls
        ):
            sitemap_url = sitemap_queue.popleft()
            try:
                canonical = canonicalize_url(sitemap_url)
            except UnsafeUrlError:
                continue
            if canonical in visited_sitemaps:
                continue
            visited_sitemaps.add(canonical)
            if len(visited_sitemaps) == 1 or len(visited_sitemaps) % 5 == 0:
                self._report(
                    f"[{seed.name}] sitemap {len(visited_sitemaps)}/"
                    f"{self.fetcher.limits.max_sitemaps_per_institution}; "
                    f"candidates={len(candidates)}"
                )
            if not hostname_matches(
                urlsplit(canonical).hostname or "", seed.all_allowed_domains
            ):
                continue
            if not policy.allows(canonical, self.fetcher.limits.user_agent):
                errors.append(f"{canonical}: BLOCKED_BY_ROBOTS")
                continue
            try:
                result = self.fetcher.fetch(
                    canonical,
                    allowed_domains=seed.all_allowed_domains,
                    max_bytes=self.fetcher.limits.max_sitemap_bytes,
                    accept="application/xml,text/xml,text/plain,*/*;q=0.1",
                )
            except FetchError as exc:
                if exc.status not in {404, 410}:
                    errors.append(f"{canonical}: {exc.code}")
                continue
            nested, pages = parse_sitemap(result.body)
            if not nested and not pages:
                continue
            successful_sitemaps.append(result.final_url)
            sitemap_queue.extend(nested)
            total_sitemap_urls += len(pages)
            for page_url in pages:
                try:
                    page_canonical = canonicalize_url(page_url)
                except UnsafeUrlError:
                    continue
                if not hostname_matches(
                    urlsplit(page_canonical).hostname or "",
                    seed.all_allowed_domains,
                ):
                    continue
                if is_nonproduction_hostname(
                    urlsplit(page_canonical).hostname or ""
                ):
                    continue
                if not policy.allows(
                    page_canonical, self.fetcher.limits.user_agent
                ):
                    continue
                explicit_match = self._matches_seed_pattern(
                    seed, page_canonical
                )
                if not looks_like_programme_detail(page_canonical):
                    continue
                if seed.programme_url_patterns and not explicit_match:
                    continue
                if (
                    not seed.programme_url_patterns
                    and not PROGRAMME_PATH_RE.search(
                        f"{urlsplit(page_canonical).path.lower()}/"
                    )
                ):
                    continue
                score = programme_url_score(page_canonical)
                if score < 3 and not explicit_match:
                    continue
                candidate = ProgrammeCandidate(
                    url=page_canonical,
                    name_hint=None,
                    catalogue_source=result.final_url,
                    score=score,
                )
                existing = candidates.get(page_canonical)
                if not existing or candidate.score > existing.score:
                    candidates[page_canonical] = candidate

        index_entrypoints = (
            seed.catalogue_hints
            if seed.catalogue_hints
            else (seed.homepage_url,)
        )
        index_queue: deque[tuple[str, int, str]] = deque(
            (url, 0, url) for url in index_entrypoints
            if self.backend in {"native", "hybrid"}
        )
        visited_indexes: set[str] = set()
        while (
            index_queue
            and len(visited_indexes) < self.fetcher.limits.max_index_pages
        ):
            raw_url, depth, root_source = index_queue.popleft()
            try:
                canonical = canonicalize_url(raw_url)
            except UnsafeUrlError:
                continue
            if canonical in visited_indexes:
                continue
            visited_indexes.add(canonical)
            if len(visited_indexes) == 1 or len(visited_indexes) % 5 == 0:
                self._report(
                    f"[{seed.name}] catalogue pages {len(visited_indexes)}/"
                    f"{self.fetcher.limits.max_index_pages}; "
                    f"candidates={len(candidates)}"
                )
            if not policy.allows(canonical, self.fetcher.limits.user_agent):
                errors.append(f"{canonical}: BLOCKED_BY_ROBOTS")
                continue
            try:
                result = self.fetcher.fetch(
                    canonical,
                    allowed_domains=seed.all_allowed_domains,
                )
            except FetchError as exc:
                errors.append(f"{canonical}: {exc.code}")
                continue
            page = parse_html(
                result.body,
                result.final_url,
                result.headers.get("content-type"),
            )
            if urlsplit(canonical).path.rstrip("/").endswith("/programs"):
                coursedog_candidates, coursedog_errors = (
                    self._discover_coursedog_programmes(
                        page_body=result.body,
                        catalogue_url=result.final_url,
                        seed=seed,
                    )
                )
                errors.extend(coursedog_errors)
                for candidate in coursedog_candidates:
                    existing = candidates.get(candidate.url)
                    if not existing or candidate.score > existing.score:
                        candidates[candidate.url] = candidate
                    if self.graph_sink:
                        self.graph_sink(
                            {
                                "institution_id": seed.institution_id,
                                "discovered_from": result.final_url,
                                "target_url": candidate.url,
                                "relation": "coursedog_api",
                                "depth": depth + 1,
                                "anchor_text": candidate.name_hint or "",
                            }
                        )
            for link_url, link_text in page.links:
                try:
                    link_canonical = canonicalize_url(link_url)
                except UnsafeUrlError:
                    continue
                if not hostname_matches(
                    urlsplit(link_canonical).hostname or "",
                    seed.all_allowed_domains,
                ):
                    continue
                if is_nonproduction_hostname(
                    urlsplit(link_canonical).hostname or ""
                ):
                    continue
                if self.graph_sink:
                    self.graph_sink(
                        {
                            "institution_id": seed.institution_id,
                            "discovered_from": result.final_url,
                            "target_url": link_canonical,
                            "relation": "native_anchor",
                            "depth": depth + 1,
                            "anchor_text": link_text,
                        }
                    )
                score = programme_url_score(link_canonical, link_text)
                explicit_match = self._matches_seed_pattern(
                    seed, link_canonical
                )
                accepted_by_pattern = bool(
                    seed.programme_url_patterns and explicit_match
                )
                accepted_by_curated_index = is_direct_curated_index_candidate(
                    root_source=root_source,
                    target_url=link_canonical,
                    anchor_text=link_text,
                    depth=depth,
                )
                if (
                    (
                        score >= 4
                        or accepted_by_pattern
                        or accepted_by_curated_index
                    )
                    and looks_like_programme_detail(link_canonical)
                    and (
                        not seed.programme_url_patterns
                        or explicit_match
                    )
                ):
                    existing = candidates.get(link_canonical)
                    candidate = ProgrammeCandidate(
                        url=link_canonical,
                        name_hint=link_text or None,
                        catalogue_source=root_source,
                        score=score,
                    )
                    if not existing or candidate.score > existing.score:
                        candidates[link_canonical] = candidate
                elif (
                    depth < self.fetcher.limits.max_index_depth
                    and looks_like_index(link_canonical, link_text)
                    and link_canonical not in visited_indexes
                ):
                    index_queue.append((link_canonical, depth + 1, root_source))

        if self.scrapy_adapter is not None and self.backend in {
            "scrapy",
            "hybrid",
        }:
            try:
                scrapy_result = self.scrapy_adapter.discover(seed)
            except RuntimeError as exc:
                errors.append(f"SCRAPY_ADAPTER_FAILED: {exc}")
            else:
                for warning in scrapy_result.warnings:
                    errors.append(f"SCRAPY_WARNING: {warning}")
                for link in scrapy_result.links:
                    if self.graph_sink:
                        self.graph_sink(
                            {
                                "institution_id": seed.institution_id,
                                "discovered_from": link.source_url,
                                "target_url": link.url,
                                "relation": f"scrapy_{link.source_kind}",
                                "depth": link.depth,
                                "anchor_text": link.anchor_text,
                            }
                        )
                    score = programme_url_score(
                        link.url, link.anchor_text
                    )
                    explicit_match = self._matches_seed_pattern(
                        seed, link.url
                    )
                    accepted_by_pattern = bool(
                        seed.programme_url_patterns and explicit_match
                    )
                    if (
                        (score >= 4 or accepted_by_pattern)
                        and looks_like_programme_detail(link.url)
                        and (
                            not seed.programme_url_patterns
                            or explicit_match
                        )
                    ):
                        if not policy.allows(
                            link.url, self.fetcher.limits.user_agent
                        ):
                            continue
                        candidate = ProgrammeCandidate(
                            url=link.url,
                            name_hint=link.anchor_text or None,
                            catalogue_source=link.source_url,
                            score=score + 1,
                        )
                        existing = candidates.get(link.url)
                        if not existing or candidate.score > existing.score:
                            candidates[link.url] = candidate

        ordered = sorted(
            candidates.values(),
            key=lambda item: (-item.score, item.url),
        )
        return ordered, successful_sitemaps, errors
