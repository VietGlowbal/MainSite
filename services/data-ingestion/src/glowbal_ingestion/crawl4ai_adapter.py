from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

from .config import CrawlLimits
from .models import ParsedPage, utc_now_iso
from .url_safety import validate_url


class Crawl4AIAdapterError(RuntimeError):
    pass


@dataclass(frozen=True)
class Crawl4AIRenderResult:
    requested_url: str
    final_url: str
    status: int
    body: bytes
    content_hash: str
    retrieved_at: str


def crawl4ai_available() -> bool:
    return importlib.util.find_spec("crawl4ai") is not None


def require_crawl4ai() -> None:
    if not crawl4ai_available():
        raise Crawl4AIAdapterError(
            "Crawl4AI is not installed. Run "
            '`python -m pip install -e ".[render]"` from services/data-ingestion, '
            "then run `crawl4ai-setup`."
        )


def should_render_page(
    page: ParsedPage,
    body: bytes,
    *,
    policy: str,
    min_text_chars: int,
) -> bool:
    if policy == "always":
        return True
    if policy == "off":
        return False
    if len(page.text) < min_text_chars:
        return True
    if page.links:
        return False
    lowered = body[:512_000].lower()
    return any(
        marker in lowered
        for marker in (
            b'id="__next"',
            b'id="__nuxt"',
            b"data-reactroot",
            b"ng-app",
            b"window.__initial_state__",
        )
    )


def rendered_page_is_useful(
    native_page: ParsedPage,
    rendered_page: ParsedPage,
    *,
    policy: str,
) -> bool:
    if policy == "always":
        return bool(rendered_page.text or rendered_page.links)
    text_gain = len(rendered_page.text) - len(native_page.text)
    link_gain = len(rendered_page.links) - len(native_page.links)
    return (
        len(rendered_page.text) >= max(300, int(len(native_page.text) * 1.15))
        or text_gain >= 300
        or link_gain >= 3
    )


def _child_environment(base_directory: Path) -> dict[str, str]:
    environment = os.environ.copy()
    source_root = str(Path(__file__).resolve().parents[1])
    existing = environment.get("PYTHONPATH", "")
    environment["PYTHONPATH"] = (
        source_root if not existing else os.pathsep.join((source_root, existing))
    )
    environment["CRAWL4_AI_BASE_DIRECTORY"] = str(base_directory.resolve())
    return environment


class Crawl4AIRenderer:
    """Render sparse JavaScript pages with a bounded, isolated browser process."""

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

    def render(
        self,
        url: str,
        *,
        allowed_domains: tuple[str, ...],
    ) -> Crawl4AIRenderResult:
        require_crawl4ai()
        validated = validate_url(url, allowed_domains)
        payload = {
            "url": validated.canonical_url,
            "user_agent": self.limits.user_agent,
            "page_timeout_ms": max(
                5_000, int(self.limits.request_timeout_seconds * 1000)
            ),
            "max_html_bytes": self.limits.max_html_bytes,
        }
        timeout_seconds = max(
            45, min(180, int(self.limits.request_timeout_seconds * 4))
        )

        with self._process_slots:
            self._report(f"Crawl4AI rendering {validated.canonical_url}")
            with tempfile.TemporaryDirectory(
                prefix="glowbal-crawl4ai-"
            ) as temp:
                temp_path = Path(temp)
                input_path = temp_path / "input.json"
                output_path = temp_path / "output.json"
                input_path.write_text(
                    json.dumps(payload, ensure_ascii=False),
                    encoding="utf-8",
                )
                command = [
                    sys.executable,
                    "-m",
                    "glowbal_ingestion.crawl4ai_adapter",
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
                        env=_child_environment(temp_path),
                    )
                except subprocess.TimeoutExpired as exc:
                    raise Crawl4AIAdapterError(
                        f"Crawl4AI timed out after {timeout_seconds}s."
                    ) from exc
                if completed.returncode != 0:
                    detail = (completed.stderr or completed.stdout).strip()
                    raise Crawl4AIAdapterError(
                        "Crawl4AI rendering failed"
                        + (f": {detail[-1000:]}" if detail else ".")
                    )
                if not output_path.exists():
                    raise Crawl4AIAdapterError(
                        "Crawl4AI completed without producing output."
                    )
                output = json.loads(output_path.read_text(encoding="utf-8"))

        if not output.get("success"):
            raise Crawl4AIAdapterError(
                str(output.get("error") or "Crawl4AI returned no page.")
            )
        final_url = str(output.get("final_url") or validated.canonical_url)
        final_validated = validate_url(final_url, allowed_domains)
        body = str(output.get("html") or "").encode("utf-8")
        if not body:
            raise Crawl4AIAdapterError("Crawl4AI returned empty rendered HTML.")
        if len(body) > self.limits.max_html_bytes:
            raise Crawl4AIAdapterError(
                f"Rendered HTML exceeds {self.limits.max_html_bytes} bytes."
            )
        return Crawl4AIRenderResult(
            requested_url=validated.canonical_url,
            final_url=final_validated.canonical_url,
            status=max(100, int(output.get("status") or 200)),
            body=body,
            content_hash=hashlib.sha256(body).hexdigest(),
            retrieved_at=utc_now_iso(),
        )


async def _render_worker(payload: dict[str, object], working_dir: Path) -> dict:
    from crawl4ai import (
        AsyncWebCrawler,
        BrowserConfig,
        CacheMode,
        CrawlerRunConfig,
    )

    system_chrome = (
        shutil.which("google-chrome")
        or shutil.which("google-chrome-stable")
        or shutil.which("chrome")
    )
    if os.name == "nt" and not system_chrome:
        for candidate in (
            Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
            Path(
                "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
            ),
        ):
            if candidate.exists():
                system_chrome = str(candidate)
                break
    browser_channel = "chrome" if system_chrome else "chromium"
    browser_config = BrowserConfig(
        browser_type="chromium",
        channel=browser_channel,
        chrome_channel=browser_channel,
        headless=True,
        verbose=False,
        user_agent=str(payload["user_agent"]),
        ignore_https_errors=False,
        light_mode=True,
        text_mode=True,
        memory_saving_mode=True,
        enable_stealth=False,
    )
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=int(payload["page_timeout_ms"]),
        wait_until="domcontentloaded",
        delay_before_return_html=0.5,
        check_robots_txt=True,
        process_iframes=False,
        scan_full_page=False,
    )
    async with AsyncWebCrawler(
        config=browser_config,
        base_directory=str(working_dir),
    ) as crawler:
        result = await crawler.arun(
            url=str(payload["url"]),
            config=run_config,
        )
    if not getattr(result, "success", False):
        return {
            "success": False,
            "error": str(
                getattr(result, "error_message", "Crawl4AI crawl failed.")
            ),
        }
    html = str(
        getattr(result, "html", "")
        or getattr(result, "cleaned_html", "")
        or ""
    )
    max_bytes = int(payload["max_html_bytes"])
    encoded = html.encode("utf-8")
    if len(encoded) > max_bytes:
        return {
            "success": False,
            "error": f"Rendered HTML exceeds {max_bytes} bytes.",
        }
    return {
        "success": True,
        "final_url": str(getattr(result, "url", "") or payload["url"]),
        "status": int(getattr(result, "status_code", 200) or 200),
        "html": html,
    }


def _run_worker(input_path: Path, output_path: Path) -> int:
    import asyncio

    require_crawl4ai()
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    try:
        output = asyncio.run(_render_worker(payload, output_path.parent))
    except Exception as exc:
        output = {"success": False, "error": str(exc)}
    output_path.write_text(
        json.dumps(output, ensure_ascii=False),
        encoding="utf-8",
    )
    return 0 if output.get("success") else 1


def _worker_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--worker", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser


if __name__ == "__main__":
    worker_args = _worker_parser().parse_args()
    raise SystemExit(_run_worker(worker_args.worker, worker_args.output))
