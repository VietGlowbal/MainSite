from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


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
    max_index_pages: int = 40
    max_index_depth: int = 2
    max_deep_sources_per_programme: int = 12
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

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "CrawlLimits":
        known = {field.name for field in cls.__dataclass_fields__.values()}
        return cls(**{key: value for key, value in raw.items() if key in known})


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
class InstitutionSeed:
    institution_id: str
    name: str
    country_code: str
    official_domain: str
    homepage_url: str
    allowed_domains: tuple[str, ...] = ()
    catalogue_hints: tuple[str, ...] = ()
    school_profile_urls: tuple[str, ...] = ()
    manual_programme_urls: tuple[str, ...] = ()
    programme_metadata: dict[str, dict[str, str]] = field(default_factory=dict)
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
            allowed_domains=tuple(
                str(item).lower() for item in raw.get("allowed_domains", [])
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


@dataclass(frozen=True)
class SmokeConfig:
    run_name: str
    institutions: tuple[InstitutionSeed, ...]
    limits: CrawlLimits = field(default_factory=CrawlLimits)
    deepseek_flash_model: str = "deepseek-v4-flash"
    deepseek_pro_model: str = "deepseek-v4-pro"
    deepseek_base_url: str = "https://api.deepseek.com"

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

        institutions = tuple(
            InstitutionSeed.from_dict(item) for item in raw.get("institutions", [])
        )
        if not institutions:
            raise ValueError("Smoke config must contain at least one institution.")

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
        )


def load_dotenv_if_present(path: Path, *, override: bool = False) -> None:
    """Load a small .env-style file without logging or overwriting real env vars."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            if override:
                os.environ[key] = value
            else:
                os.environ.setdefault(key, value)
