from __future__ import annotations

import re
import threading
import urllib.robotparser
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from .config import InstitutionSeed
from .fetcher import FetchError, SafeFetcher
from .models import PolicyCheck, PolicyStatus
from .url_safety import canonicalize_url


SITEMAP_RE = re.compile(
    r"^\s*Sitemap:\s*(\S+)\s*$", re.IGNORECASE | re.MULTILINE
)


def _robots_url(url: str) -> str:
    canonical = canonicalize_url(url)
    hostname = urlsplit(canonical).hostname
    if not hostname:
        raise ValueError("Robots target has no hostname.")
    return f"https://{hostname}/robots.txt"


def _load_robots(
    fetcher: SafeFetcher,
    url: str,
    allowed_domains: tuple[str, ...],
) -> tuple[
    urllib.robotparser.RobotFileParser | None,
    str,
    list[str],
    list[str],
]:
    robots_url = _robots_url(url)
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)
    notes: list[str] = []
    sitemaps: list[str] = []
    try:
        result = fetcher.fetch(
            robots_url,
            allowed_domains=allowed_domains,
            max_bytes=512 * 1024,
            accept="text/plain,*/*;q=0.1",
        )
    except FetchError as exc:
        if exc.status in {404, 410}:
            parser.parse([])
            notes.append(f"{robots_url}: ROBOTS_NOT_PRESENT_{exc.status}")
            return parser, robots_url, notes, sitemaps
        notes.append(f"{robots_url}: {exc.code}: {exc}")
        return None, robots_url, notes, sitemaps

    text = result.body.decode("utf-8", errors="replace")
    parser.parse(text.splitlines())
    sitemaps = list(dict.fromkeys(SITEMAP_RE.findall(text)))
    return parser, robots_url, notes, sitemaps


@dataclass
class RobotsPolicy:
    check: PolicyCheck
    fetcher: SafeFetcher
    allowed_domains: tuple[str, ...]
    parsers: dict[str, urllib.robotparser.RobotFileParser | None]
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def allows(self, url: str, user_agent: str) -> bool:
        canonical = canonicalize_url(url)
        hostname = urlsplit(canonical).hostname
        if not hostname:
            return False
        with self._lock:
            if hostname not in self.parsers:
                parser, _, notes, sitemaps = _load_robots(
                    self.fetcher, canonical, self.allowed_domains
                )
                self.parsers[hostname] = parser
                self.check.notes.extend(notes)
                self.check.sitemaps = list(
                    dict.fromkeys((*self.check.sitemaps, *sitemaps))
                )
            parser = self.parsers[hostname]
        return bool(parser and parser.can_fetch(user_agent, canonical))


def check_policy(
    seed: InstitutionSeed,
    fetcher: SafeFetcher,
    *,
    allow_unreviewed_terms: bool,
) -> RobotsPolicy:
    target_urls = tuple(
        dict.fromkeys(
            (
                seed.homepage_url,
                *(() if seed.manual_only else seed.catalogue_hints),
                *seed.manual_programme_urls,
            )
        )
    )
    parsers: dict[str, urllib.robotparser.RobotFileParser | None] = {}
    notes: list[str] = []
    sitemaps: list[str] = []
    allowed_targets = 0

    for target_url in target_urls:
        canonical = canonicalize_url(target_url)
        hostname = urlsplit(canonical).hostname
        if not hostname:
            continue
        parser = parsers.get(hostname)
        if hostname not in parsers:
            parser, _, host_notes, host_sitemaps = _load_robots(
                fetcher, canonical, seed.all_allowed_domains
            )
            parsers[hostname] = parser
            notes.extend(host_notes)
            sitemaps.extend(host_sitemaps)
        if parser and parser.can_fetch(fetcher.limits.user_agent, canonical):
            allowed_targets += 1

    robots_reachable = any(parser is not None for parser in parsers.values())
    robots_allowed = allowed_targets > 0
    primary_robots_url = _robots_url(seed.homepage_url)

    if seed.terms_status == "PROHIBITED":
        status = PolicyStatus.PROHIBITED
    elif not robots_reachable:
        status = PolicyStatus.UNREACHABLE
    elif not robots_allowed:
        status = PolicyStatus.BLOCKED_BY_ROBOTS
    elif seed.terms_status == "APPROVED":
        status = PolicyStatus.ALLOWED
    elif allow_unreviewed_terms:
        status = PolicyStatus.ALLOWED_TERMS_UNREVIEWED
        notes.append("Terms are not reviewed; run explicitly allowed for smoke.")
    else:
        status = PolicyStatus.PROHIBITED
        notes.append(
            "Terms are unreviewed. Use --allow-unreviewed-terms only after approval."
        )

    check = PolicyCheck(
        institution_id=seed.institution_id,
        domain=seed.official_domain,
        robots_url=primary_robots_url,
        robots_reachable=robots_reachable,
        robots_allowed=robots_allowed,
        terms_status=seed.terms_status,
        terms_url=seed.terms_url,
        policy_status=status,
        notes=notes,
        sitemaps=list(dict.fromkeys(sitemaps)),
    )
    return RobotsPolicy(
        check=check,
        fetcher=fetcher,
        allowed_domains=seed.all_allowed_domains,
        parsers=parsers,
    )
