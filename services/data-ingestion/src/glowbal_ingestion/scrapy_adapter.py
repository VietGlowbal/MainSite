from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

from .config import CrawlLimits, InstitutionSeed
from .url_safety import (
    UnsafeUrlError,
    canonicalize_url,
    hostname_matches,
    is_nonproduction_hostname,
)


FOLLOW_SIGNAL_RE = re.compile(
    r"\b(?:academics?|admissions?|apply|catalog(?:ue)?|courses?|degrees?|"
    r"departments?|facult(?:y|ies)|graduate|undergraduate|programmes?|"
    r"scholarships?|study|tuition)\b",
    re.IGNORECASE,
)


class ScrapyAdapterError(RuntimeError):
    pass


@dataclass(frozen=True)
class ScrapyDiscoveredLink:
    url: str
    source_url: str
    anchor_text: str
    depth: int
    source_kind: str = "anchor"


@dataclass(frozen=True)
class ScrapyDiscoveryResult:
    links: tuple[ScrapyDiscoveredLink, ...]
    pages_crawled: int
    warnings: tuple[str, ...] = ()


def scrapy_available() -> bool:
    return importlib.util.find_spec("scrapy") is not None


def require_scrapy() -> None:
    if not scrapy_available():
        raise ScrapyAdapterError(
            "Scrapy is not installed. Run "
            '`python -m pip install -e ".[scrapy]"` from services/data-ingestion.'
        )


def _child_environment() -> dict[str, str]:
    environment = os.environ.copy()
    source_root = str(Path(__file__).resolve().parents[1])
    existing = environment.get("PYTHONPATH", "")
    environment["PYTHONPATH"] = (
        source_root if not existing else os.pathsep.join((source_root, existing))
    )
    return environment


class ScrapyDiscoveryAdapter:
    """Run a bounded Scrapy crawl in an isolated process.

    A child process avoids Twisted reactor restart conflicts because the main
    pipeline can process several institutions concurrently. The semaphore keeps
    local memory bounded even when institution workers are concurrent.
    """

    def __init__(
        self,
        limits: CrawlLimits,
        progress: Callable[[str], None] | None = None,
        *,
        max_processes: int = 1,
    ) -> None:
        self.limits = limits
        self.progress = progress
        self._process_slots = threading.BoundedSemaphore(max(1, max_processes))

    def _report(self, message: str) -> None:
        if self.progress:
            self.progress(message)

    def discover(self, seed: InstitutionSeed) -> ScrapyDiscoveryResult:
        require_scrapy()
        start_urls = tuple(
            dict.fromkeys(
                seed.catalogue_hints
                if seed.catalogue_hints
                else (seed.homepage_url,)
            )
        )
        if not start_urls:
            return ScrapyDiscoveryResult((), 0)

        payload = {
            "start_urls": list(start_urls),
            "allowed_domains": list(seed.all_allowed_domains),
            "user_agent": self.limits.user_agent,
            "download_delay": self.limits.min_request_interval_seconds,
            "request_timeout_seconds": self.limits.request_timeout_seconds,
            "per_domain_concurrency": self.limits.per_domain_concurrency,
            "max_pages": self.limits.max_index_pages,
            "max_depth": self.limits.max_index_depth,
            "max_response_bytes": self.limits.max_html_bytes,
            "max_follow_links_per_page": 25,
        }
        timeout_seconds = max(
            90,
            min(
                900,
                int(
                    self.limits.request_timeout_seconds
                    * max(4, self.limits.max_index_pages)
                ),
            ),
        )

        with self._process_slots:
            self._report(
                f"[{seed.name}] Scrapy graph crawl started; "
                f"max_pages={self.limits.max_index_pages}"
            )
            with tempfile.TemporaryDirectory(prefix="glowbal-scrapy-") as temp:
                temp_path = Path(temp)
                input_path = temp_path / "input.json"
                output_path = temp_path / "links.jsonl"
                input_path.write_text(
                    json.dumps(payload, ensure_ascii=False),
                    encoding="utf-8",
                )
                command = [
                    sys.executable,
                    "-m",
                    "glowbal_ingestion.scrapy_adapter",
                    "--worker",
                    str(input_path),
                    "--output",
                    str(output_path),
                ]
                try:
                    completed = subprocess.run(
                        command,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=timeout_seconds,
                        check=False,
                        env=_child_environment(),
                    )
                except subprocess.TimeoutExpired as exc:
                    raise ScrapyAdapterError(
                        f"Scrapy discovery timed out after {timeout_seconds}s."
                    ) from exc
                if completed.returncode != 0:
                    detail = (completed.stderr or completed.stdout).strip()
                    raise ScrapyAdapterError(
                        "Scrapy discovery failed"
                        + (f": {detail[-1000:]}" if detail else ".")
                    )
                if not output_path.exists():
                    raise ScrapyAdapterError(
                        "Scrapy completed without producing its JSONL output."
                    )

                links: list[ScrapyDiscoveredLink] = []
                warnings: list[str] = []
                pages: set[str] = set()
                seen: set[tuple[str, str, str]] = set()
                max_link_records = max(
                    500, self.limits.max_index_pages * 500
                )
                with output_path.open("r", encoding="utf-8") as output_handle:
                    raw_lines = output_handle
                    for raw_line in raw_lines:
                        if len(links) >= max_link_records:
                            warnings.append(
                                f"SCRAPY_LINK_LIMIT_REACHED:{max_link_records}"
                            )
                            break
                        if not raw_line.strip():
                            continue
                        try:
                            item = json.loads(raw_line)
                        except json.JSONDecodeError:
                            warnings.append("INVALID_SCRAPY_JSONL_RECORD")
                            continue
                        record_type = str(item.get("record_type") or "")
                        if record_type == "page":
                            if item.get("url"):
                                pages.add(str(item["url"]))
                            continue
                        if record_type == "warning":
                            warnings.append(
                                str(item.get("message") or "SCRAPY_WARNING")
                            )
                            continue
                        if record_type != "link":
                            continue
                        try:
                            target = canonicalize_url(
                                str(item.get("url") or "")
                            )
                            source = canonicalize_url(
                                str(item.get("source_url") or "")
                            )
                        except (UnsafeUrlError, ValueError):
                            continue
                        target_host = urlsplit(target).hostname or ""
                        if not hostname_matches(
                            target_host, seed.all_allowed_domains
                        ):
                            continue
                        if is_nonproduction_hostname(target_host):
                            continue
                        anchor = str(
                            item.get("anchor_text") or ""
                        ).strip()
                        key = (source, target, anchor)
                        if key in seen:
                            continue
                        seen.add(key)
                        links.append(
                            ScrapyDiscoveredLink(
                                url=target,
                                source_url=source,
                                anchor_text=anchor,
                                depth=max(0, int(item.get("depth") or 0)),
                                source_kind=str(
                                    item.get("source_kind") or "anchor"
                                ),
                            )
                        )

        self._report(
            f"[{seed.name}] Scrapy graph crawl finished; "
            f"pages={len(pages)}; links={len(links)}"
        )
        return ScrapyDiscoveryResult(
            links=tuple(links),
            pages_crawled=len(pages),
            warnings=tuple(dict.fromkeys(warnings)),
        )


def _run_worker(input_path: Path, output_path: Path) -> int:
    require_scrapy()
    import scrapy
    from scrapy.crawler import CrawlerProcess
    from scrapy.linkextractors import LinkExtractor

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    allowed_domains = tuple(str(item) for item in payload["allowed_domains"])
    start_urls = tuple(str(item) for item in payload["start_urls"])
    max_depth = max(0, int(payload["max_depth"]))
    max_follow_links_per_page = max(
        1, int(payload["max_follow_links_per_page"])
    )

    class UniversityGraphSpider(scrapy.Spider):
        name = "glowbal_university_graph"

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.allowed_domains = list(allowed_domains)
            self.start_urls = list(start_urls)
            self._extractor = LinkExtractor(
                allow_domains=self.allowed_domains,
                deny_extensions=(
                    "7z",
                    "avi",
                    "css",
                    "dmg",
                    "exe",
                    "gif",
                    "ico",
                    "jpg",
                    "jpeg",
                    "mp3",
                    "mp4",
                    "png",
                    "rar",
                    "svg",
                    "tar",
                    "webp",
                    "wmv",
                    "zip",
                ),
                unique=True,
            )

        def parse(self, response):
            depth = max(0, int(response.meta.get("depth", 0)))
            yield {
                "record_type": "page",
                "url": response.url,
                "status": response.status,
                "depth": depth,
            }

            discovered: list[tuple[str, str, str]] = []
            for link in self._extractor.extract_links(response):
                discovered.append((link.url, link.text or "", "anchor"))

            attribute_selectors = (
                ("link[rel='canonical']::attr(href)", "canonical"),
                ("link[rel='alternate']::attr(href)", "alternate"),
                ("form::attr(action)", "form_action"),
                ("[data-href]::attr(data-href)", "data_href"),
                ("[data-url]::attr(data-url)", "data_url"),
            )
            for selector, source_kind in attribute_selectors:
                for value in response.css(selector).getall():
                    discovered.append(
                        (response.urljoin(value), "", source_kind)
                    )

            followed: set[str] = set()
            for target, anchor, source_kind in discovered:
                if not target.startswith(("http://", "https://")):
                    continue
                if is_nonproduction_hostname(urlsplit(target).hostname or ""):
                    continue
                yield {
                    "record_type": "link",
                    "url": target,
                    "source_url": response.url,
                    "anchor_text": " ".join(anchor.split()),
                    "depth": depth,
                    "source_kind": source_kind,
                }
                if (
                    depth >= max_depth
                    or target in followed
                    or len(followed) >= max_follow_links_per_page
                ):
                    continue
                signal = f"{urlsplit(target).path} {anchor}"
                if FOLLOW_SIGNAL_RE.search(signal):
                    followed.add(target)
                    yield response.follow(
                        target,
                        callback=self.parse,
                        errback=self.on_error,
                    )

        def on_error(self, failure):
            request = getattr(failure, "request", None)
            yield {
                "record_type": "warning",
                "message": (
                    f"{getattr(request, 'url', '')}: "
                    f"{failure.getErrorMessage()}"
                ),
            }

    settings = {
        "ROBOTSTXT_OBEY": True,
        "USER_AGENT": str(payload["user_agent"]),
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": float(payload["download_delay"]),
        "AUTOTHROTTLE_MAX_DELAY": max(
            10.0, float(payload["download_delay"]) * 8
        ),
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 1.0,
        "DOWNLOAD_DELAY": float(payload["download_delay"]),
        "DOWNLOAD_TIMEOUT": float(payload["request_timeout_seconds"]),
        "CONCURRENT_REQUESTS_PER_DOMAIN": max(
            1, int(payload["per_domain_concurrency"])
        ),
        "CONCURRENT_REQUESTS": max(
            1, int(payload["per_domain_concurrency"])
        ),
        "DEPTH_LIMIT": max_depth,
        "CLOSESPIDER_PAGECOUNT": max(1, int(payload["max_pages"])),
        "DOWNLOAD_MAXSIZE": max(1024, int(payload["max_response_bytes"])),
        "REDIRECT_MAX_TIMES": 5,
        "COOKIES_ENABLED": False,
        "TELNETCONSOLE_ENABLED": False,
        "LOG_ENABLED": False,
        "FEEDS": {
            output_path.resolve().as_uri(): {
                "format": "jsonlines",
                "encoding": "utf-8",
                "overwrite": True,
            }
        },
    }
    process = CrawlerProcess(settings=settings, install_root_handler=False)
    process.crawl(UniversityGraphSpider)
    process.start(install_signal_handlers=False)
    return 0


def _worker_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser


if __name__ == "__main__":
    worker_args = _worker_parser().parse_args()
    raise SystemExit(_run_worker(worker_args.worker, worker_args.output))
