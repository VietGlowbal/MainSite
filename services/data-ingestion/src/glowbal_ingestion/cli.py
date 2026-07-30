from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from .config import SmokeConfig, load_dotenv_if_present
from .consolidation import ConsolidationError, consolidate_runs
from .ipeds import (
    IpedsError,
    load_ipeds_programme_priorities,
    names_compatible,
    sync_ipeds,
)
from .pipeline import SmokePipeline
from .models import DEEP_FIELDS
from .product_export import (
    ProductExportError,
    export_product_data,
)
from .review_approval import (
    ReviewApprovalError,
    process_review_csv,
)
from .scorecard import ScorecardError, sync_scorecard
from .supabase_seeds import (
    SupabaseSeedResult,
    load_approved_supabase_seeds,
)
from .supabase_import import (
    SupabaseImportError,
    import_supabase_run,
    preflight_supabase_run,
)
from .url_safety import UnsafeUrlError, canonicalize_url, hostname_matches


SERVICE_ROOT = Path(__file__).resolve().parents[2]
MAIN_SITE_ROOT = SERVICE_ROOT.parents[1]
DEFAULT_CONFIG = SERVICE_ROOT / "configs" / "smoke-institutions.json"
DEFAULT_LIMITS = SERVICE_ROOT / "configs" / "crawl-limits.json"
DEFAULT_OUTPUT_ROOT = MAIN_SITE_ROOT / "tmp" / "data-crawling-smoke" / "runs"
DEFAULT_IPEDS_TARGETS = SERVICE_ROOT / "configs" / "ipeds-us-21.json"
DEFAULT_IPEDS_CACHE = MAIN_SITE_ROOT / "tmp" / "ipeds" / "cache"
DEFAULT_IPEDS_OUTPUT = MAIN_SITE_ROOT / "tmp" / "ipeds" / "us-21-2024"
DEFAULT_SCORECARD_CACHE = MAIN_SITE_ROOT / "tmp" / "scorecard" / "cache"
DEFAULT_SCORECARD_OUTPUT = (
    MAIN_SITE_ROOT / "tmp" / "ipeds" / "us-21-scorecard"
)


def _timestamp_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="glowbal-ingest",
        description="Run the bounded GlowBal programme-data smoke pipeline.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate-config")
    validate.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    validate.add_argument(
        "--limits",
        type=Path,
        default=None,
        help=(
            "Optional limits JSON. When omitted, a custom config's embedded "
            "limits are used; the default smoke config keeps crawl-limits.json."
        ),
    )

    run = subparsers.add_parser("run")
    run.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    run.add_argument(
        "--limits",
        type=Path,
        default=None,
        help=(
            "Optional limits JSON. When omitted, a custom config's embedded "
            "limits are used; the default smoke config keeps crawl-limits.json."
        ),
    )
    run.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    run.add_argument("--run-id", default=None)
    run.add_argument(
        "--allow-unreviewed-terms",
        action="store_true",
        help=(
            "Proceed when robots allows crawling but Terms have not been reviewed. "
            "Use only after the smoke-test owner explicitly approves it."
        ),
    )
    run.add_argument(
        "--discovery-only",
        action="store_true",
        help="Skip DeepSeek and emit null deep fields after source discovery.",
    )
    run.add_argument(
        "--env-file",
        type=Path,
        default=MAIN_SITE_ROOT / ".env.local",
    )
    run.add_argument(
        "--programme-url",
        action="append",
        default=[],
        metavar="INSTITUTION_ID=HTTPS_URL",
        help=(
            "Add a direct official programme URL when catalogue discovery misses it. "
            "Repeat the option for multiple URLs."
        ),
    )
    run.add_argument(
        "--institution",
        action="append",
        default=[],
        metavar="INSTITUTION_ID",
        help=(
            "Run only selected institution IDs. Repeat for multiple institutions."
        ),
    )
    run.add_argument(
        "--institution-batch-size",
        type=int,
        default=None,
        metavar="N",
        help="Split the resolved institution list into stable batches.",
    )
    run.add_argument(
        "--institution-batch-index",
        type=int,
        default=None,
        metavar="N",
        help="One-based institution batch to run.",
    )
    run.add_argument(
        "--fields",
        action="append",
        default=[],
        metavar="FIELD[,FIELD...]",
        help=(
            "Run only a targeted deep-field delta. Repeat the option or use "
            "comma-separated field names; omit to run the full deep schema."
        ),
    )
    run.add_argument(
        "--skip-school-profile",
        action="store_true",
        help=(
            "Skip institution vision/mission extraction. Useful for a "
            "programme-field delta run."
        ),
    )
    run.add_argument(
        "--quiet",
        action="store_true",
        help="Disable live progress output.",
    )
    run.add_argument(
        "--max-deep-programmes",
        type=int,
        default=None,
        metavar="N",
        help="Override the number of deep programmes selected per institution.",
    )
    run.add_argument(
        "--max-deep-sources",
        type=int,
        default=None,
        metavar="N",
        help="Override the maximum source pages fetched per deep programme.",
    )
    run.add_argument(
        "--programme-concurrency",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Deep programme workers per institution (1-4; default 1). "
            "The first programme of each degree level always seeds shared "
            "facts before parallel work begins."
        ),
    )
    run.add_argument(
        "--manual-only",
        action="store_true",
        help=(
            "Skip catalogue discovery and process only --programme-url values."
        ),
    )
    run.add_argument(
        "--supabase-approved-seeds",
        action="store_true",
        help=(
            "Replace the static institution list with Supabase rows whose "
            "domain is approved and crawl_seed_enabled."
        ),
    )
    run.add_argument(
        "--supabase-seed-limit",
        type=int,
        default=20,
        metavar="N",
        help="Maximum approved Supabase institutions to load (1-100; default 20).",
    )
    run.add_argument(
        "--supabase-seed-country",
        action="append",
        default=[],
        metavar="CC",
        help=(
            "Only load an ISO two-letter country code from Supabase. "
            "Repeat for multiple countries."
        ),
    )
    run.add_argument(
        "--ipeds-programmes",
        type=Path,
        default=None,
        metavar="JSONL",
        help=(
            "Use ipeds_popular_programmes.jsonl to prioritize matching "
            "official programme candidates for deep crawling."
        ),
    )
    run.add_argument(
        "--seed-overrides",
        type=Path,
        default=None,
        metavar="JSON",
        help=(
            "Merge reviewed catalogue, school-profile and shared-source "
            "entrypoints by official domain."
        ),
    )
    run.add_argument(
        "--discovery-backend",
        choices=("native", "scrapy", "hybrid"),
        default="native",
        help=(
            "URL discovery engine. 'scrapy' keeps sitemap discovery and uses "
            "Scrapy for the internal graph; 'hybrid' also keeps native index "
            "traversal (default: native)."
        ),
    )
    run.add_argument(
        "--render-policy",
        choices=("off", "auto", "always"),
        default="off",
        help=(
            "Crawl4AI rendering policy. 'auto' renders only sparse/JS-shell "
            "HTML; 'always' renders every HTML source (default: off)."
        ),
    )

    ipeds = subparsers.add_parser(
        "ipeds-sync",
        help="Sync bounded official IPEDS facts for configured US institutions.",
    )
    ipeds.add_argument(
        "--targets",
        type=Path,
        default=DEFAULT_IPEDS_TARGETS,
    )
    ipeds.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_IPEDS_CACHE,
    )
    ipeds.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_IPEDS_OUTPUT,
    )
    ipeds.add_argument(
        "--no-download",
        action="store_true",
        help="Use only existing IPEDS ZIP/CSV files in --cache-dir.",
    )
    ipeds.add_argument(
        "--popular-programme-limit",
        type=int,
        default=50,
        metavar="N",
        help="Keep at most N CIP completion groups per institution (1-50).",
    )

    scorecard = subparsers.add_parser(
        "scorecard-sync",
        help=(
            "Sync IPEDS-derived College Scorecard data when NCES downloads "
            "are unavailable."
        ),
    )
    scorecard.add_argument(
        "--targets",
        type=Path,
        default=DEFAULT_IPEDS_TARGETS,
    )
    scorecard.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_SCORECARD_CACHE,
    )
    scorecard.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_SCORECARD_OUTPUT,
    )
    scorecard.add_argument(
        "--no-download",
        action="store_true",
        help="Use only existing College Scorecard JSON cache files.",
    )
    scorecard.add_argument(
        "--popular-programme-limit",
        type=int,
        default=50,
        metavar="N",
        help="Keep at most N CIP groups per institution (1-50).",
    )
    scorecard.add_argument(
        "--env-file",
        type=Path,
        default=MAIN_SITE_ROOT / ".env.local",
        help=(
            "Optional env file containing COLLEGE_SCORECARD_API_KEY. "
            "DEMO_KEY is used when absent."
        ),
    )

    supabase_import = subparsers.add_parser(
        "supabase-import",
        help="Validate or import one completed JSONL crawl run into staging.",
    )
    supabase_import.add_argument(
        "--run-dir",
        type=Path,
        required=True,
        help="Completed crawl run directory containing manifest.json.",
    )
    supabase_import.add_argument(
        "--env-file",
        type=Path,
        default=MAIN_SITE_ROOT / ".env.local",
    )
    supabase_import.add_argument(
        "--batch-size",
        type=int,
        default=100,
        metavar="N",
        help="Rows per REST request, between 1 and 500 (default: 100).",
    )
    supabase_import.add_argument(
        "--apply",
        action="store_true",
        help="Write to Supabase. Without this flag, only validate and count.",
    )

    supabase_preflight = subparsers.add_parser(
        "supabase-preflight",
        help=(
            "Read-only validation of the target project, staging schema, "
            "run key and university-domain links."
        ),
    )
    supabase_preflight.add_argument("--run-dir", type=Path, required=True)
    supabase_preflight.add_argument("--env-file", type=Path, required=True)

    consolidate = subparsers.add_parser(
        "consolidate-runs",
        help=(
            "Select the latest completed run per institution and build one "
            "product-ready run with organisation hierarchy."
        ),
    )
    consolidate.add_argument(
        "--run-dir",
        action="append",
        type=Path,
        required=True,
        help="Source run directory. Repeat for every batch or repair run.",
    )
    consolidate.add_argument("--output-dir", type=Path, required=True)
    consolidate.add_argument(
        "--expected-institutions",
        type=int,
        default=20,
    )
    consolidate.add_argument(
        "--programmes-per-institution",
        type=int,
        default=20,
    )

    review_apply = subparsers.add_parser(
        "review-apply",
        help="Validate or apply a grouped human-review CSV.",
    )
    review_apply.add_argument("--csv", type=Path, required=True)
    review_apply.add_argument("--run-dir", type=Path, required=True)
    review_apply.add_argument(
        "--env-file",
        type=Path,
        default=MAIN_SITE_ROOT / ".env.local",
    )
    review_apply.add_argument(
        "--apply",
        action="store_true",
        help="Apply decisions to Supabase. Without this flag, only validate.",
    )

    product_export = subparsers.add_parser(
        "product-export",
        help="Export approved product-safe facts and admission requirements.",
    )
    product_export.add_argument("--run-key", required=True)
    product_export.add_argument("--output", type=Path, required=True)
    product_export.add_argument(
        "--run-dir",
        type=Path,
        default=None,
        help=(
            "Optional matching run directory used only as a school-profile "
            "fallback for runs imported before school profiles were persisted."
        ),
    )
    product_export.add_argument(
        "--env-file",
        type=Path,
        default=MAIN_SITE_ROOT / ".env.local",
    )
    return parser


def _with_manual_programme_urls(
    config: SmokeConfig,
    values: list[str],
    *,
    replace_existing: bool = False,
) -> SmokeConfig:
    if not values:
        return config
    by_id = {seed.institution_id: seed for seed in config.institutions}
    additions: dict[str, list[str]] = {}
    for value in values:
        institution_id, separator, raw_url = value.partition("=")
        institution_id = institution_id.strip()
        raw_url = raw_url.strip()
        if not separator or not institution_id or not raw_url:
            raise ValueError(
                "--programme-url must use INSTITUTION_ID=HTTPS_URL."
            )
        seed = by_id.get(institution_id)
        if not seed:
            raise ValueError(
                f"Unknown institution_id for --programme-url: {institution_id}"
            )
        try:
            canonical = canonicalize_url(raw_url)
        except UnsafeUrlError as exc:
            raise ValueError(f"Invalid programme URL: {exc}") from exc
        if urlsplit(canonical).scheme != "https":
            raise ValueError("Programme URL must use HTTPS.")
        hostname = urlsplit(canonical).hostname or ""
        if not hostname_matches(hostname, seed.all_allowed_domains):
            raise ValueError(
                f"Programme URL for {institution_id} must use an approved official domain."
            )
        additions.setdefault(institution_id, []).append(canonical)

    institutions = tuple(
        replace(
            seed,
            manual_programme_urls=tuple(
                dict.fromkeys(
                    (
                        *(
                            ()
                            if replace_existing
                            else seed.manual_programme_urls
                        ),
                        *additions.get(seed.institution_id, []),
                    )
                )
            ),
        )
        for seed in config.institutions
    )
    return replace(config, institutions=institutions)


def _with_selected_institutions(
    config: SmokeConfig, institution_ids: list[str]
) -> SmokeConfig:
    if not institution_ids:
        return config
    requested = tuple(dict.fromkeys(item.strip() for item in institution_ids))
    known = {seed.institution_id for seed in config.institutions}
    unknown = [item for item in requested if item not in known]
    if unknown:
        raise ValueError(
            f"Unknown --institution ID(s): {', '.join(unknown)}"
        )
    selected = tuple(
        seed for seed in config.institutions
        if seed.institution_id in requested
    )
    return replace(config, institutions=selected)


def _with_institution_batch(
    config: SmokeConfig,
    *,
    batch_size: int | None,
    batch_index: int | None,
) -> SmokeConfig:
    if batch_size is None and batch_index is None:
        return config
    if batch_size is None or batch_index is None:
        raise ValueError(
            "--institution-batch-size and "
            "--institution-batch-index must be used together."
        )
    if batch_size < 1 or batch_index < 1:
        raise ValueError("Institution batch size/index must be positive.")
    start = (batch_index - 1) * batch_size
    selected = config.institutions[start : start + batch_size]
    if not selected:
        batch_count = (
            len(config.institutions) + batch_size - 1
        ) // batch_size
        raise ValueError(
            f"Institution batch {batch_index} does not exist; "
            f"available batches: 1-{batch_count}."
        )
    return replace(config, institutions=selected)


def _parse_target_fields(raw_fields: list[str]) -> tuple[str, ...] | None:
    if not raw_fields:
        return None
    fields = tuple(
        dict.fromkeys(
            field.strip()
            for raw in raw_fields
            for field in raw.split(",")
            if field.strip()
        )
    )
    unknown = sorted(set(fields).difference(DEEP_FIELDS))
    if unknown:
        raise ValueError(
            "Unknown --fields value(s): "
            + ", ".join(unknown)
            + ". Use `--fields` with names from the deep schema."
        )
    if not fields:
        raise ValueError("--fields must contain at least one field.")
    return fields


def _with_run_limits(
    config: SmokeConfig,
    *,
    max_deep_programmes: int | None,
    max_deep_sources: int | None,
    programme_concurrency: int | None = None,
) -> SmokeConfig:
    updates: dict[str, int] = {}
    if max_deep_programmes is not None:
        if max_deep_programmes < 1:
            raise ValueError("--max-deep-programmes must be at least 1.")
        updates["max_deep_programmes_per_institution"] = (
            max_deep_programmes
        )
    if max_deep_sources is not None:
        if max_deep_sources < 1:
            raise ValueError("--max-deep-sources must be at least 1.")
        updates["max_deep_sources_per_programme"] = max_deep_sources
    if programme_concurrency is not None:
        if not 1 <= programme_concurrency <= 4:
            raise ValueError(
                "--programme-concurrency must be between 1 and 4."
            )
        updates["programme_concurrency_per_institution"] = (
            programme_concurrency
        )
    if not updates:
        return config
    return replace(config, limits=replace(config.limits, **updates))


def _with_manual_only(
    config: SmokeConfig,
    enabled: bool,
) -> SmokeConfig:
    if not enabled:
        return config
    missing = [
        seed.institution_id
        for seed in config.institutions
        if not seed.manual_programme_urls
    ]
    if missing:
        raise ValueError(
            "--manual-only requires at least one --programme-url for every "
            f"selected institution: {', '.join(missing)}"
        )
    return replace(
        config,
        institutions=tuple(
            replace(seed, manual_only=True)
            for seed in config.institutions
        ),
    )


def _with_supabase_seeds(
    config: SmokeConfig,
    result: SupabaseSeedResult,
) -> SmokeConfig:
    if not result.seeds:
        raise ValueError(
            "Supabase returned no approved, enabled, valid institution seeds."
        )
    curated_by_domain = {
        seed.official_domain.casefold(): seed
        for seed in config.institutions
    }
    institutions: list[InstitutionSeed] = []
    for seed in result.seeds:
        curated = curated_by_domain.get(seed.official_domain.casefold())
        if curated is None:
            institutions.append(seed)
            continue
        institutions.append(
            replace(
                curated,
                institution_id=seed.institution_id,
                name=seed.name,
                country_code=seed.country_code,
                official_domain=seed.official_domain,
                homepage_url=seed.homepage_url,
                allowed_domains=tuple(
                    dict.fromkeys(
                        (*curated.allowed_domains, *seed.allowed_domains)
                    )
                ),
                terms_status=seed.terms_status,
                terms_url=seed.terms_url or curated.terms_url,
            )
        )
    return replace(config, institutions=tuple(institutions))


def _with_seed_overrides(
    config: SmokeConfig,
    path: Path | None,
) -> SmokeConfig:
    if path is None:
        return config
    if not path.is_file():
        raise ValueError(f"Seed override file does not exist: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    domains = payload.get("domains") if isinstance(payload, dict) else None
    if not isinstance(domains, dict):
        raise ValueError("Seed override file requires a domains object.")

    def urls(
        seed: InstitutionSeed,
        values: object,
        field_name: str,
    ) -> tuple[str, ...]:
        if values is None:
            return ()
        if not isinstance(values, list):
            raise ValueError(
                f"{seed.official_domain}.{field_name} must be an array."
            )
        result: list[str] = []
        for raw_url in values:
            try:
                canonical = canonicalize_url(str(raw_url))
            except UnsafeUrlError as exc:
                raise ValueError(
                    f"Invalid {field_name} URL for "
                    f"{seed.official_domain}: {exc}"
                ) from exc
            hostname = urlsplit(canonical).hostname or ""
            if (
                urlsplit(canonical).scheme != "https"
                or not hostname_matches(
                    hostname,
                    seed.all_allowed_domains,
                )
            ):
                raise ValueError(
                    f"{field_name} URL for {seed.official_domain} "
                    "must use its approved HTTPS domain."
                )
            result.append(canonical)
        return tuple(dict.fromkeys(result))

    def bundles(
        seed: InstitutionSeed,
        values: object,
        field_name: str,
    ) -> dict[str, tuple[str, ...]]:
        if values is None:
            return {}
        if not isinstance(values, dict):
            raise ValueError(
                f"{seed.official_domain}.{field_name} must be an object."
            )
        return {
            str(degree).casefold(): urls(
                seed,
                source_urls,
                f"{field_name}.{degree}",
            )
            for degree, source_urls in values.items()
        }

    institutions: list[InstitutionSeed] = []
    for seed in config.institutions:
        raw = domains.get(seed.official_domain)
        if not isinstance(raw, dict):
            institutions.append(seed)
            continue
        admission_overrides = bundles(
            seed,
            raw.get("shared_admission_source_bundles"),
            "shared_admission_source_bundles",
        )
        source_overrides = bundles(
            seed,
            raw.get("shared_source_bundles"),
            "shared_source_bundles",
        )
        manual_overrides = urls(
            seed,
            raw.get("manual_programme_urls"),
            "manual_programme_urls",
        )
        raw_metadata = raw.get("programme_metadata")
        if raw_metadata is None:
            raw_metadata = {}
        if not isinstance(raw_metadata, dict):
            raise ValueError(
                f"{seed.official_domain}.programme_metadata must be an object."
            )
        metadata_overrides: dict[str, dict[str, str]] = {}
        for raw_url, metadata in raw_metadata.items():
            if not isinstance(metadata, dict):
                raise ValueError(
                    f"{seed.official_domain}.programme_metadata entries "
                    "must be objects."
                )
            canonical_url = urls(
                seed,
                [raw_url],
                "programme_metadata",
            )[0]
            if canonical_url not in manual_overrides:
                raise ValueError(
                    f"{seed.official_domain}.programme_metadata URL must "
                    "also appear in manual_programme_urls."
                )
            metadata_overrides[canonical_url] = {
                str(key): str(value)
                for key, value in metadata.items()
                if value is not None
            }
        institutions.append(
            replace(
                seed,
                catalogue_hints=tuple(
                    dict.fromkeys(
                        (
                            *seed.catalogue_hints,
                            *urls(
                                seed,
                                raw.get("catalogue_hints"),
                                "catalogue_hints",
                            ),
                        )
                    )
                ),
                school_profile_urls=tuple(
                    dict.fromkeys(
                        (
                            *seed.school_profile_urls,
                            *urls(
                                seed,
                                raw.get("school_profile_urls"),
                                "school_profile_urls",
                            ),
                        )
                    )
                ),
                manual_programme_urls=tuple(
                    dict.fromkeys(
                        (*seed.manual_programme_urls, *manual_overrides)
                    )
                ),
                programme_metadata={
                    **seed.programme_metadata,
                    **metadata_overrides,
                },
                shared_admission_source_bundles={
                    **seed.shared_admission_source_bundles,
                    **{
                        degree: tuple(
                            dict.fromkeys(
                                (
                                    *seed.shared_admission_source_bundles.get(
                                        degree, ()
                                    ),
                                    *source_urls,
                                )
                            )
                        )
                        for degree, source_urls in admission_overrides.items()
                    },
                },
                shared_source_bundles={
                    **seed.shared_source_bundles,
                    **{
                        degree: tuple(
                            dict.fromkeys(
                                (
                                    *seed.shared_source_bundles.get(
                                        degree, ()
                                    ),
                                    *source_urls,
                                )
                            )
                        )
                        for degree, source_urls in source_overrides.items()
                    },
                },
            )
        )
    return replace(config, institutions=tuple(institutions))


def _with_ipeds_programme_priorities(
    config: SmokeConfig,
    path: Path | None,
) -> SmokeConfig:
    if path is None:
        return config
    priorities_by_institution = load_ipeds_programme_priorities(path)
    names_by_institution: dict[str, tuple[str, str]] = {}
    institution_path = path.with_name("ipeds_institutions.jsonl")
    if institution_path.is_file():
        for line in institution_path.read_text(
            encoding="utf-8"
        ).splitlines():
            if not line.strip():
                continue
            raw = json.loads(line)
            institution_id = str(
                raw.get("institution_id") or ""
            ).strip()
            configured_name = str(
                raw.get("configured_name") or ""
            ).strip()
            ipeds_name = str(raw.get("ipeds_name") or "").strip()
            if institution_id and configured_name and ipeds_name:
                names_by_institution[institution_id] = (
                    configured_name,
                    ipeds_name,
                )

    def priority_key(seed: InstitutionSeed) -> str | None:
        if priorities_by_institution.get(seed.institution_id):
            return seed.institution_id
        matches = [
            institution_id
            for institution_id, (
                configured_name,
                ipeds_name,
            ) in names_by_institution.items()
            if priorities_by_institution.get(institution_id)
            and (
                names_compatible(seed.name, ipeds_name)
                or names_compatible(seed.name, configured_name)
            )
        ]
        return matches[0] if len(matches) == 1 else None

    priority_keys = {
        seed.institution_id: priority_key(seed)
        for seed in config.institutions
    }
    matched_ids = {
        institution_id
        for institution_id, key in priority_keys.items()
        if key is not None
    }
    if not matched_ids:
        raise ValueError(
            "IPEDS priority file did not match any configured institution_id."
        )
    institutions = tuple(
        replace(
            seed,
            programme_priorities=(
                priorities_by_institution.get(
                    priority_keys.get(seed.institution_id) or "",
                    seed.programme_priorities,
                )
            ),
        )
        for seed in config.institutions
    )
    return replace(config, institutions=institutions)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "consolidate-runs":
        try:
            result = consolidate_runs(
                args.run_dir,
                args.output_dir,
                expected_institutions=args.expected_institutions,
                expected_programmes_per_institution=(
                    args.programmes_per_institution
                ),
            )
        except (ConsolidationError, OSError, ValueError) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "output_dir": str(args.output_dir),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "ipeds-sync":
        try:
            result = sync_ipeds(
                targets_path=args.targets,
                cache_dir=args.cache_dir,
                output_dir=args.output_dir,
                download_missing=not args.no_download,
                popular_programme_limit=args.popular_programme_limit,
            )
        except (
            IpedsError,
            OSError,
            json.JSONDecodeError,
            ValueError,
        ) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "output_dir": str(args.output_dir),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "scorecard-sync":
        load_dotenv_if_present(args.env_file)
        try:
            result = sync_scorecard(
                targets_path=args.targets,
                cache_dir=args.cache_dir,
                output_dir=args.output_dir,
                download_missing=not args.no_download,
                popular_programme_limit=args.popular_programme_limit,
            )
        except (
            ScorecardError,
            OSError,
            json.JSONDecodeError,
            ValueError,
        ) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "output_dir": str(args.output_dir),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "supabase-import":
        load_dotenv_if_present(args.env_file, override=True)
        try:
            result = import_supabase_run(
                args.run_dir,
                apply=args.apply,
                batch_size=args.batch_size,
            )
        except (
            OSError,
            ValueError,
            SupabaseImportError,
        ) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "run_dir": str(args.run_dir),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "supabase-preflight":
        load_dotenv_if_present(args.env_file, override=True)
        try:
            result = preflight_supabase_run(args.run_dir)
        except (OSError, ValueError, SupabaseImportError) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "run_dir": str(args.run_dir),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "review-apply":
        load_dotenv_if_present(args.env_file)
        try:
            result = process_review_csv(
                args.csv,
                args.run_dir,
                apply=args.apply,
            )
        except (
            OSError,
            ValueError,
            ReviewApprovalError,
            SupabaseImportError,
        ) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "run_dir": str(args.run_dir),
                        "csv": str(args.csv),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.command == "product-export":
        load_dotenv_if_present(args.env_file)
        try:
            result = export_product_data(
                args.run_key,
                args.output,
                run_dir=args.run_dir,
            )
        except (
            OSError,
            ValueError,
            ProductExportError,
            SupabaseImportError,
        ) as exc:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": str(exc),
                        "run_key": args.run_key,
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
            return 1
        print(
            json.dumps(
                {"ok": True, "result": result.to_dict()},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    limits_path = args.limits
    if limits_path is None:
        try:
            is_default_config = (
                args.config.resolve() == DEFAULT_CONFIG.resolve()
            )
        except OSError:
            is_default_config = args.config == DEFAULT_CONFIG
        if is_default_config:
            limits_path = DEFAULT_LIMITS
    try:
        config = SmokeConfig.load(args.config, limits_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 2

    if args.command == "validate-config":
        print(
            json.dumps(
                {
                    "ok": True,
                    "run_name": config.run_name,
                    "institution_count": len(config.institutions),
                    "institutions": [
                        {
                            "id": seed.institution_id,
                            "name": seed.name,
                            "country": seed.country_code,
                            "domain": seed.official_domain,
                        }
                        for seed in config.institutions
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    load_dotenv_if_present(args.env_file)

    try:
        target_fields = _parse_target_fields(args.fields)
        if args.supabase_approved_seeds:
            seed_result = load_approved_supabase_seeds(
                limit=args.supabase_seed_limit,
                country_codes=tuple(args.supabase_seed_country),
            )
            config = _with_supabase_seeds(config, seed_result)
            if seed_result.skipped_rows:
                print(
                    json.dumps(
                        {
                            "warning": "invalid_or_duplicate_supabase_seeds_skipped",
                            "count": seed_result.skipped_rows,
                        }
                    ),
                    file=sys.stderr,
                )
        config = _with_seed_overrides(config, args.seed_overrides)
        config = _with_ipeds_programme_priorities(
            config,
            args.ipeds_programmes,
        )
        config = _with_manual_programme_urls(
            config,
            args.programme_url,
            replace_existing=args.manual_only,
        )
        if args.institution and (
            args.institution_batch_size is not None
            or args.institution_batch_index is not None
        ):
            raise ValueError(
                "--institution cannot be combined with institution batching."
            )
        config = _with_selected_institutions(config, args.institution)
        config = _with_institution_batch(
            config,
            batch_size=args.institution_batch_size,
            batch_index=args.institution_batch_index,
        )
        config = _with_manual_only(config, args.manual_only)
        config = _with_run_limits(
            config,
            max_deep_programmes=args.max_deep_programmes,
            max_deep_sources=args.max_deep_sources,
            programme_concurrency=args.programme_concurrency,
        )
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 2

    run_id = args.run_id or f"{config.run_name}-{_timestamp_run_id()}"
    run_dir = args.output_root / run_id
    if run_dir.exists() and any(run_dir.iterdir()):
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": (
                        f"Run directory already contains files: {run_dir}. "
                        "Use a new --run-id."
                    ),
                }
            ),
            file=sys.stderr,
        )
        return 2

    try:
        pipeline = SmokePipeline(
            config,
            run_dir,
            allow_unreviewed_terms=args.allow_unreviewed_terms,
            discovery_only=args.discovery_only,
            show_progress=not args.quiet,
            discovery_backend=args.discovery_backend,
            render_policy=args.render_policy,
            target_fields=target_fields,
            skip_school_profile=args.skip_school_profile,
        )
        metrics = pipeline.run()
    except (OSError, RuntimeError, ValueError) as exc:
        print(
            json.dumps(
                {"ok": False, "error": str(exc), "run_dir": str(run_dir)}
            ),
            file=sys.stderr,
        )
        return 1

    print(
        json.dumps(
            {"ok": True, "run_dir": str(run_dir), "metrics": metrics},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0
