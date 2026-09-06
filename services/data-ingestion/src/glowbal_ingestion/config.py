from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
        )


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
