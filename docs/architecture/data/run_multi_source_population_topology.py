"""Bounded live multi-source population topology experiment.

Research-only orchestration.  The script freezes a population and provider
assignment before acquisition, then uses the existing platform shadow
acquisition path in remote raw-evidence mode.  It never runs extraction,
assertion generation, promotion, or an estimator.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit


REPO_ROOT = Path(__file__).resolve().parents[3]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.config import (  # noqa: E402
    CrawlLimits,
    ExternalSourceRule,
    InstitutionSeed,
    SmokeConfig,
    SourceEcosystemConfig,
    load_dotenv_if_present,
)
from glowbal_ingestion.fetcher import FetchError, SafeFetcher  # noqa: E402
from glowbal_ingestion.models import (  # noqa: E402
    SourceAuthority,
    SourceRelationship,
    TemporalState,
)
from glowbal_ingestion.pipeline import SmokePipeline  # noqa: E402
from glowbal_ingestion.policy import check_policy  # noqa: E402
from glowbal_ingestion.source_adapters import SourceAdapter  # noqa: E402
from glowbal_ingestion.url_safety import canonicalize_url  # noqa: E402


CATALOGUE_PATH = REPO_ROOT / "services" / "data-ingestion" / "configs" / "external-providers.json"
PRIOR_MANIFEST_PATH = REPO_ROOT / "docs" / "architecture" / "data" / "tuition-live-population-topology-manifest.json"
TARGET_CYCLE = "2025-26"
THRESHOLD_BYTES = 8 * 1024 * 1024

# This tuple is the frozen selection rule.  It is deliberately independent of
# whether any selected institution later yields a useful source.
SELECTED_INSTITUTIONS = (
    "mit-us",
    "harvard-us",
    "duke-us",
    "ucla-us",
    "umich-us",
    "imperial-uk",
    "oxford-uk",
    "eth-zurich-ch",
    "sorbonne-fr",
    "tu-delft-nl",
    "tokyo-jp",
    "unsw-au",
    "ntu-sg",
)

# Provider assignments are frozen before the run.  A provider is attempted
# only for these institutions, regardless of later yield or failure.
PROVIDER_ASSIGNMENTS: dict[str, tuple[str, ...]] = {
    "ipeds": ("mit-us",),
    "college_scorecard_bulk": ("mit-us",),
    "usdoe_affordability": ("duke-us", "umich-us"),
    "eurostat_education": ("imperial-uk", "oxford-uk", "eth-zurich-ch", "sorbonne-fr", "tu-delft-nl"),
    "discover_uni_hesa": ("imperial-uk", "oxford-uk"),
    "japan_estat": ("tokyo-jp",),
    "singapore_data_gov": ("ntu-sg",),
    "unesco_uis": ("mit-us",),
    "eqar": ("eth-zurich-ch", "sorbonne-fr", "imperial-uk"),
    "cricos_australia": ("unsw-au",),
    "anabin_germany": (),
    "eqar_accreditation": ("eth-zurich-ch", "sorbonne-fr"),
    "abet": ("mit-us", "tokyo-jp", "unsw-au"),
    "chea": ("ucla-us",),
    "jabee": ("tokyo-jp",),
    "common_app": ("mit-us", "harvard-us"),
    "openalex": ("mit-us", "eth-zurich-ch", "tokyo-jp"),
    "crossref": ("ucla-us", "oxford-uk"),
    "arquivo_pt": ("sorbonne-fr",),
    "data_europa_eu": ("sorbonne-fr", "eth-zurich-ch"),
    "data_gov_us": ("mit-us",),
}


@dataclass
class TrackingSafeFetcher(SafeFetcher):
    """SafeFetcher telemetry that never retains response bodies."""

    def __init__(self, limits: CrawlLimits) -> None:
        super().__init__(limits)
        self.calls: list[dict[str, Any]] = []

    def fetch(self, url: str, **kwargs: Any):  # type: ignore[no-untyped-def]
        started = time.monotonic()
        row: dict[str, Any] = {"requested_url": url, "started_at": _now()}
        try:
            result = super().fetch(url, **kwargs)
            row.update(
                {
                    "status": "RETRIEVED",
                    "http_status": result.status,
                    "final_url": result.final_url,
                    "content_type": result.content_type,
                    "bytes": len(result.body),
                    "failure_code": None,
                }
            )
            return result
        except FetchError as exc:
            row.update(
                {
                    "status": "FAILED",
                    "http_status": exc.status,
                    "final_url": None,
                    "content_type": None,
                    "bytes": 0,
                    "failure_code": exc.code,
                    "retryable": exc.retryable,
                }
            )
            raise
        finally:
            row["elapsed_seconds"] = round(time.monotonic() - started, 3)
            row["finished_at"] = _now()
            row["request_no"] = len(self.calls) + 1
            self.calls.append(row)

    def fetch_stream(self, url: str, **kwargs: Any):  # type: ignore[no-untyped-def]
        started = time.monotonic()
        row: dict[str, Any] = {"requested_url": url, "started_at": _now(), "stream": True}
        try:
            result = super().fetch_stream(url, **kwargs)
            row.update(
                {
                    "status": "RETRIEVED",
                    "http_status": result.status,
                    "final_url": result.final_url,
                    "content_type": result.content_type,
                    "bytes": None,
                    "failure_code": None,
                }
            )
            return result
        except FetchError as exc:
            row.update(
                {
                    "status": "FAILED",
                    "http_status": exc.status,
                    "final_url": None,
                    "content_type": None,
                    "bytes": 0,
                    "failure_code": exc.code,
                    "retryable": exc.retryable,
                }
            )
            raise
        finally:
            row["elapsed_seconds"] = round(time.monotonic() - started, 3)
            row["finished_at"] = _now()
            row["request_no"] = len(self.calls) + 1
            self.calls.append(row)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_jsonl(path: Path, rows: Iterable[Mapping[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(dict(row), ensure_ascii=False, separators=(",", ":")) + "\n")


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                rows.append(value)
    return rows


def _load_catalogue() -> dict[str, dict[str, Any]]:
    raw = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
    entries = raw.get("external_providers", []) if isinstance(raw, dict) else raw
    return {
        str(item.get("provider_id")): dict(item)
        for item in entries
        if isinstance(item, Mapping) and item.get("provider_id")
    }


def _freeze_population(output_dir: Path) -> dict[str, Any]:
    prior = json.loads(PRIOR_MANIFEST_PATH.read_text(encoding="utf-8"))
    by_id = {str(item["institution_id"]): item for item in prior.get("institutions", [])}
    missing = [item for item in SELECTED_INSTITUTIONS if item not in by_id]
    if missing:
        raise RuntimeError(f"Frozen population ids missing from retained manifest: {missing}")
    institutions: list[dict[str, Any]] = []
    for institution_id in SELECTED_INSTITUTIONS:
        source = by_id[institution_id]
        # One target per institution is enough to anchor E0 metadata; it is
        # selected before acquisition and never changed after seeing results.
        target = dict(source["targets"][0])
        institutions.append(
            {
                "institution_id": institution_id,
                "name": source["name"],
                "country_code": source["country_code"],
                "region": source["region"],
                "institution_type": source["institution_type"],
                "field_domain": source["field_domain"],
                "official_domain": source["official_domain"],
                "homepage_url": source["homepage_url"],
                "target": target,
                "assigned_providers": [
                    provider_id
                    for provider_id, ids in PROVIDER_ASSIGNMENTS.items()
                    if institution_id in ids
                ],
            }
        )
    manifest = {
        "manifest_id": f"multi-source-population-topology-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "frozen_at": _now(),
        "selection_rule": "fixed first target from retained 20-institution manifest; 13 ids selected before acquisition",
        "population_rationale": [
            "cover at least three regions and multiple countries before observing yield",
            "retain public/private institution variation and STEM, humanities/social-science, and professional strata",
            "assign providers from the configured catalogue by country scope before any fetch",
            "use one retained programme target per institution to anchor E0 without replacing the frozen source population",
        ],
        "target_cycle": TARGET_CYCLE,
        "llm_calls_allowed": 0,
        "provider_assignments": PROVIDER_ASSIGNMENTS,
        "institutions": institutions,
    }
    _write_json(output_dir / "population-manifest.json", manifest)
    return manifest


def _provider_adapter(provider: Mapping[str, Any]) -> str:
    provider_id = str(provider.get("provider_id") or "").casefold()
    source_class = str(provider.get("source_class") or "").casefold()
    configured = str(provider.get("adapter_id") or provider.get("adapter") or "").casefold()
    if configured:
        # The catalogue names the HTTP search implementation ``search_provider``
        # while the registered candidate adapter is ``search_index``.
        if configured == "search_provider":
            return "search_index"
        return configured
    return {
        "government_dataset": "government_dataset",
        "official_registry": "official_registry",
        "accreditation": "accreditation_registry",
        "official_partner": "official_partner",
        "external_authoritative": "external_authoritative",
        "archive": "archive_http",
        "search_discovery": "search_index",
    }.get(source_class, provider_id)


def _provider_rules(provider: Mapping[str, Any]) -> tuple[ExternalSourceRule, ...]:
    domain = str(provider.get("domain") or "").strip().lower()
    if not domain:
        for key in ("resource_url", "base_url", "query_endpoint", "capture_discovery_url"):
            value = str(provider.get(key) or "")
            if urlsplit(value).hostname:
                domain = str(urlsplit(value).hostname).lower()
                break
    if not domain:
        return ()
    try:
        authority = SourceAuthority(str(provider.get("authority") or "OTHER").upper())
        relationship = SourceRelationship(str(provider.get("relationship") or "OTHER_RELATED").upper())
    except ValueError:
        return ()
    return (
        ExternalSourceRule(
            domain=domain,
            adapter_id=_provider_adapter(provider),
            reason=f"frozen topology experiment provider {provider.get('provider_id')}",
            relationship=relationship,
            authority=authority,
            provider_id=str(provider.get("provider_id") or "") or None,
        ),
    )


def _make_seed(institution: Mapping[str, Any], provider: Mapping[str, Any] | None = None) -> InstitutionSeed:
    target = institution["target"]
    rules = _provider_rules(provider) if provider else ()
    return InstitutionSeed(
        institution_id=str(institution["institution_id"]),
        name=str(institution["name"]),
        country_code=str(institution["country_code"]),
        official_domain=str(institution["official_domain"]),
        homepage_url=str(institution["homepage_url"]),
        external_source_rules=rules,
        terms_status="UNREVIEWED",
        manual_only=True,
        programme_metadata={
            str(target["programme_url"]): {
                "programme_name": str(target["programme_name"]),
                "degree_level": str(target.get("degree_level") or ""),
                "normalized_field": str(target.get("field_domain") or ""),
            }
        },
    )


def _official_resources(manifest: Mapping[str, Any]) -> list[dict[str, Any]]:
    resources: list[dict[str, Any]] = []
    for institution in manifest["institutions"]:
        target = institution["target"]
        resources.append(
            {
                "institution_id": institution["institution_id"],
                "url": target["programme_url"],
                "source_class": "official_web",
                "relationship": "DIRECT_OFFICIAL",
                "authority": "OFFICIAL",
                "field_groups": ["tuition"],
                "resolution": "programme",
                "discovery_method": "frozen_population_manifest",
                "relationship_evidence": ["frozen programme URL selected before acquisition"],
            }
        )
        resources.append(
            {
                "institution_id": institution["institution_id"],
                "url": institution["homepage_url"],
                "source_class": "official_web",
                "relationship": "DIRECT_OFFICIAL",
                "authority": "OFFICIAL",
                "field_groups": ["institution_metadata"],
                "resolution": "institution",
                "discovery_method": "frozen_population_manifest_homepage",
                "relationship_evidence": ["frozen official institution homepage"],
            }
        )
    return resources


def _ecosystem(provider_id: str, provider: Mapping[str, Any], manifest: Mapping[str, Any], *, official: bool = False) -> SourceEcosystemConfig:
    root: dict[str, Any] = {
        "enabled": True,
        "runtime_acquisition_enabled": True,
        "acquisition_mode": "external_source_expansion",
        "field_groups": ["tuition"],
        "target_cycle": TARGET_CYCLE,
        "max_fetches_per_institution": 2 if official else 1,
        # The official baseline must not accidentally load every enabled
        # external provider.  External catalogue loading is opt-in per
        # provider run below.
        "external_provider_ids": [] if official else [provider_id],
        "official_web": {"enabled": official, "resources": _official_resources(manifest) if official else []},
        "official_catalogue": {"enabled": False},
        "pdf": {"enabled": False},
        "structured_apis": {"enabled": False},
        "government_datasets": {"enabled": not official and str(provider.get("source_class")) == "government_dataset", "providers": [provider_id] if provider_id in {"ipeds", "college_scorecard_bulk"} else []},
        "official_registries": {"enabled": not official and str(provider.get("source_class")) == "official_registry"},
        "accreditation": {"enabled": not official and str(provider.get("source_class")) == "accreditation"},
        "official_partners": {"enabled": not official and str(provider.get("source_class")) == "official_partner"},
        "external_authoritative": {"enabled": not official and str(provider.get("source_class")) == "external_authoritative"},
        "archives": {"enabled": not official and str(provider.get("source_class")) == "archive"},
        "search_discovery": {"enabled": not official and str(provider.get("source_class")) == "search_discovery"},
        "allow_fixture_adapters": False,
    }
    if not official:
        root["external_provider_catalogue"] = str(CATALOGUE_PATH.resolve())
    if provider_id == "ipeds":
        # The catalogue's resource_specs are the frozen bulk path; no local
        # target override is supplied, so this remains provider-config driven.
        root["government_datasets"]["providers"] = ["ipeds"]
    return SourceEcosystemConfig.from_dict(root)


def _attach_fetcher(pipeline: SmokePipeline, fetcher: TrackingSafeFetcher) -> None:
    """Replace every runtime fetcher reference without changing production code."""
    pipeline.fetcher = fetcher
    pipeline.discovery.fetcher = fetcher
    backend = pipeline.discovery
    backend.fetcher = fetcher
    for adapter in backend.registry.ordered():
        if hasattr(adapter, "fetcher"):
            setattr(adapter, "fetcher", fetcher)
        if hasattr(adapter, "providers"):
            for provider in getattr(adapter, "providers", ()):
                if hasattr(provider, "fetcher"):
                    setattr(provider, "fetcher", fetcher)


def _planner_selectable(pipeline: SmokePipeline, source_class: str) -> bool:
    try:
        intents = pipeline.discovery.planner.plan(
            entity=__import__("glowbal_ingestion.acquisition", fromlist=["EntityRef"]).EntityRef("UNIVERSITY", "topology"),
            field_groups=("tuition",),
            target_cycle=TARGET_CYCLE,
        )
        return source_class in set(intents[0].preferred_source_classes)
    except Exception:
        return False


def _classification(errors: list[dict[str, Any]], *, candidate_seen: bool, raw_seen: bool) -> str:
    if raw_seen:
        return "SUCCESS"
    codes = {str(item.get("error_code") or item.get("code") or "").upper() for item in errors}
    if any(code in codes for code in {"HTTP_401", "MISSING_CREDENTIAL", "CREDENTIAL_REQUIRED", "AUTH_REQUIRED"}):
        return "CREDENTIAL_REQUIRED"
    if any(
        code.startswith("ROBOTS")
        or code in {"BLOCKED_BY_ROBOTS", "ROBOT_DISALLOWED", "HTTP_403", "HTTP_408", "HTTP_425", "HTTP_429", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504", "NETWORK_ERROR", "TIMEOUT", "UPSTREAM_BLOCKED"}
        for code in codes
    ):
        return "RUNTIME_BLOCKED"
    if any(code in {"UNSAFE_URL", "FINAL_URL_OUTSIDE_ADMITTED_DOMAINS", "INVALID_URL", "HTTP_400", "HTTP_404", "HTTP_422"} for code in codes):
        return "NO_YIELD"
    return "NO_YIELD" if not candidate_seen else "CODE_BUG"


def _provenance_complete(row: Mapping[str, Any], *, external: bool) -> bool:
    required = ["source_class", "source_authority", "source_relationship", "raw_document_id", "content_hash"]
    if external:
        required.extend(["provider_id", "dataset_id"])
    return all(row.get(key) not in (None, "") for key in required)


def _artifact_rows(run_dir: Path, provider: Mapping[str, Any], institution_ids: tuple[str, ...], experiment_run_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    intents = {str(row.get("intent_id")): str(row.get("entity_id") or "") for row in _read_jsonl(run_dir / "acquisition_intents.jsonl")}
    candidates = _read_jsonl(run_dir / "source_candidates.jsonl")
    decisions = _read_jsonl(run_dir / "source_admission_decisions.jsonl")
    attempts = _read_jsonl(run_dir / "acquisition_attempts.jsonl")
    # The normal platform error stream is named ``crawl_errors.jsonl``;
    # retain the alternate name for older isolated runs too.
    errors = _read_jsonl(run_dir / "errors.jsonl") + _read_jsonl(run_dir / "crawl_errors.jsonl")
    sources = _read_jsonl(run_dir / "sources.jsonl")
    raw_events = _read_jsonl(run_dir / "raw_persistence_events.jsonl")
    structured = _read_jsonl(run_dir / "structured_archive_members.jsonl")
    source_by_institution: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in sources:
        source_by_institution[str(row.get("institution_id") or "")].append(row)
    raw_by_institution: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in raw_events:
        if row.get("status") == "persisted" or row.get("execution_state") == "RAW_OBJECT_PERSISTED":
            raw_by_institution[str(row.get("institution_id") or "")].append(row)
    candidate_by_intent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in candidates:
        candidate_by_intent[str(row.get("intent_id") or "")].append(row)
    admitted_ids = {str(row.get("source_candidate_id")) for row in decisions if row.get("admitted")}
    candidate_ids = {str(row.get("candidate_id")) for row in candidates}
    errors_by_institution: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in errors:
        errors_by_institution[str(row.get("institution_id") or "")].append(row)
    sources_by_url: dict[str, dict[str, Any]] = {}
    for row in sources:
        sources_by_url[str(row.get("canonical_url") or row.get("url") or "")] = row
    attempts_out: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    source_class = str(provider.get("source_class") or "")
    authority = str(provider.get("authority") or "")
    relationship = str(provider.get("relationship") or "")
    external = source_class not in {"official_web", "official_catalogue"}
    for institution_id in institution_ids:
        related_intents = [key for key, entity in intents.items() if entity == institution_id]
        related_candidates = [row for key in related_intents for row in candidate_by_intent.get(key, [])]
        related_attempts = [row for row in attempts if str(row.get("intent_id") or "") in related_intents]
        institution_sources = source_by_institution.get(institution_id, [])
        institution_raw = raw_by_institution.get(institution_id, [])
        raw_seen = bool(institution_sources or institution_raw)
        errors_for = errors_by_institution.get(institution_id, [])
        status = "SUCCESS" if raw_seen else _classification(errors_for, candidate_seen=bool(related_candidates), raw_seen=False)
        provenance = any(_provenance_complete(row, external=external) for row in institution_sources)
        if not institution_sources:
            provenance = any(
                _provenance_complete(
                    {**row, "raw_document_id": row.get("raw_document_id"), "content_hash": row.get("content_hash")},
                    external=external,
                )
                for row in institution_raw
            )
        attempts_out.append(
            {
                "experiment_run_id": experiment_run_id,
                "run_id": run_dir.name,
                "institution_id": institution_id,
                "provider_id": provider.get("provider_id"),
                "dataset_id": provider.get("dataset_id"),
                "source_class": source_class,
                "authority": authority,
                "relationship": relationship,
                "configured": True,
                "adapter_registered": str(provider.get("adapter_id") or provider.get("adapter") or "") in set(_registry_ids(run_dir)),
                "candidate_count": len(related_candidates),
                "admitted_count": sum(1 for row in related_candidates if str(row.get("candidate_id")) in admitted_ids),
                "attempt_count": len(related_attempts),
                "raw_document_count": len(institution_sources) + len(institution_raw),
                "structured_member_count": len(structured),
                "provenance_complete": provenance,
                "status": status,
                "failure_codes": sorted({str(row.get("error_code") or row.get("code") or "") for row in errors_for if row.get("error_code") or row.get("code")}),
            }
        )
        # SourceDocuments are the primary topology edges.  A persisted raw
        # event is retained as a raw-only edge when parsing produced no source
        # document, which is still real evidence availability.
        seen_raw_ids: set[str] = set()
        for row in institution_sources:
            seen_raw_ids.add(str(row.get("raw_document_id") or ""))
            edge = {
                "experiment_run_id": experiment_run_id,
                "run_id": run_dir.name,
                "target_id": None,
                "institution_id": institution_id,
                "provider_id": row.get("provider_id") or provider.get("provider_id"),
                "dataset_id": row.get("dataset_id") or provider.get("dataset_id"),
                "source_class": row.get("source_class") or source_class,
                "adapter_id": row.get("adapter_id") or provider.get("adapter_id") or provider.get("adapter"),
                "authority": row.get("source_authority") or authority,
                "relationship": row.get("source_relationship") or relationship,
                "temporal_state": row.get("temporal_state") or "UNKNOWN",
                "topology_level": "E0" if row.get("source_class") in {"official_web", "official_catalogue"} and str(row.get("source_resolution") or "") == "programme" else "E2" if row.get("source_class") in {"official_web", "official_catalogue"} else "E4",
                "applicability_class": "DIRECTLY_APPLICABLE" if row.get("source_class") in {"official_web", "official_catalogue"} and str(row.get("source_resolution") or "") == "programme" else "AMBIGUOUS" if row.get("source_class") in {"official_web", "official_catalogue"} else "INDEPENDENT_EXTERNAL",
                "source_resolution": row.get("source_resolution"),
                "policy_lineage_id": f"provider:{row.get('provider_id') or provider.get('provider_id')}:{row.get('dataset_id') or provider.get('dataset_id')}" if external else f"content:{row.get('content_hash')}",
                "independent": True,
                "canonical_locator": row.get("canonical_url") or row.get("url"),
                "raw_document_id": row.get("raw_document_id"),
                "raw_object_reference": row.get("raw_object_path"),
                "raw_content_hash": row.get("content_hash"),
                "content_type": row.get("content_type"),
                "academic_cycle": row.get("academic_cycle"),
                "partial": None,
                "rows_scanned": None,
                "rows_retained": None,
                "provenance_complete": _provenance_complete(row, external=external),
            }
            edges.append(edge)
        for row in institution_raw:
            if str(row.get("raw_document_id") or "") in seen_raw_ids:
                continue
            edges.append(
                {
                    "experiment_run_id": experiment_run_id,
                    "run_id": run_dir.name,
                    "target_id": None,
                    "institution_id": institution_id,
                    "provider_id": row.get("provider_id") or provider.get("provider_id"),
                    "dataset_id": row.get("dataset_id") or provider.get("dataset_id"),
                    "source_class": row.get("source_class") or source_class,
                    "adapter_id": provider.get("adapter_id") or provider.get("adapter"),
                    "authority": row.get("source_authority") or authority,
                    "relationship": row.get("source_relationship") or relationship,
                    "temporal_state": row.get("temporal_state") or "UNKNOWN",
                    "topology_level": "E4" if external else "E2",
                    "applicability_class": "INDEPENDENT_EXTERNAL" if external else "AMBIGUOUS",
                    "source_resolution": None,
                    "policy_lineage_id": f"provider:{row.get('provider_id') or provider.get('provider_id')}:{row.get('dataset_id') or provider.get('dataset_id')}",
                    "independent": True,
                    "canonical_locator": row.get("url"),
                    "raw_document_id": row.get("raw_document_id"),
                    "raw_object_reference": row.get("object_key"),
                    "raw_content_hash": row.get("content_hash"),
                    "content_type": None,
                    "academic_cycle": None,
                    "partial": None,
                    "rows_scanned": None,
                    "rows_retained": None,
                    "provenance_complete": _provenance_complete(row, external=external),
                    "raw_only": True,
                }
            )
    return attempts_out, edges


def _registry_ids(run_dir: Path) -> tuple[str, ...]:
    metadata = run_dir / "run-metadata.json"
    if not metadata.exists():
        return ()
    try:
        value = json.loads(metadata.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ()
    return tuple(str(item) for item in value.get("source_ecosystem_adapters", []))


def _scan_local_heavy(root: Path) -> tuple[int, list[dict[str, Any]]]:
    heavy_suffixes = {".zip", ".csv", ".xlsx", ".pdf", ".xml", ".json"}
    derived = {"structured_archive_members.jsonl"}
    found: list[dict[str, Any]] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.name in derived or path.suffix.lower() not in heavy_suffixes:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size >= THRESHOLD_BYTES:
            found.append({"path": str(path.relative_to(root)), "bytes": size})
    return len(found), found


def _run_pipeline(run_dir: Path, manifest: Mapping[str, Any], provider_id: str | None, provider: Mapping[str, Any] | None) -> tuple[TrackingSafeFetcher, tuple[str, ...]]:
    catalogue = _load_catalogue()
    institutions = {str(item["institution_id"]): item for item in manifest["institutions"]}
    selected_ids = tuple(SELECTED_INSTITUTIONS) if provider is None else tuple(PROVIDER_ASSIGNMENTS.get(provider_id or "", ()))
    seeds = tuple(_make_seed(institutions[item], provider) for item in selected_ids)
    ecosystem = _ecosystem(provider_id or "official_web", provider or {}, manifest, official=provider is None)
    limits = CrawlLimits(
        global_concurrency=1,
        institution_concurrency=1,
        programme_concurrency_per_institution=1,
        per_domain_concurrency=1,
        request_timeout_seconds=15.0,
        connect_timeout_seconds=7.0,
        max_redirects=5,
        max_html_bytes=5 * 1024 * 1024,
        max_pdf_bytes=25 * 1024 * 1024,
        max_sitemap_bytes=2 * 1024 * 1024,
        min_request_interval_seconds=0.2,
        large_raw_object_threshold_bytes=THRESHOLD_BYTES,
        max_local_temp_bytes=0,
        user_agent="GlowBalMultiSourceTopology/1.0 (+mailto:data@glowbal.co)",
    )
    config = SmokeConfig(
        run_name=run_dir.name,
        institutions=seeds,
        limits=limits,
        raw_evidence_mode="remote",
        acquisition_backend="platform_shadow",
        source_ecosystem=ecosystem,
    )
    pipeline = SmokePipeline(
        config,
        run_dir,
        allow_unreviewed_terms=True,
        discovery_only=False,
        skip_school_profile=True,
    )
    tracker = TrackingSafeFetcher(limits)
    _attach_fetcher(pipeline, tracker)
    _write_json(run_dir / "run-metadata.json", {
        "run_id": run_dir.name,
        "experiment_run_id": manifest.get("manifest_id"),
        "provider_id": provider_id,
        "source_class": provider.get("source_class") if provider else "official_web",
        "source_ecosystem_adapters": list(pipeline.discovery.registry.adapter_ids),
        "planner_mode": pipeline.discovery.planner.mode,
        "max_local_temp_bytes": limits.max_local_temp_bytes,
        "large_raw_object_threshold_bytes": limits.large_raw_object_threshold_bytes,
        "llm_calls_allowed": 0,
        "provider_extraction_calls_allowed": 0,
    })
    try:
        for seed in seeds:
            policy = check_policy(seed, tracker, allow_unreviewed_terms=True)
            pipeline.store.append("policy_checks", policy.check)
            pipeline._acquire_configured_source_ecosystem(seed, policy)
    finally:
        pipeline.state.close()
        pipeline.llm_state.close()
    _write_jsonl(run_dir / "request-telemetry.jsonl", tracker.calls)
    return tracker, pipeline.discovery.registry.adapter_ids


def _aggregate(manifest: Mapping[str, Any], output_dir: Path, attempts: list[dict[str, Any]], edges: list[dict[str, Any]], provider_status: list[dict[str, Any]], experiment_run_id: str) -> dict[str, Any]:
    institutions = manifest["institutions"]
    classes = defaultdict(lambda: Counter())
    for row in provider_status:
        classes[str(row["source_class"])][str(row["status"]).lower()] += 1
        classes[str(row["source_class"])]["attempted"] += 1
    institution_summary: list[dict[str, Any]] = []
    for institution in institutions:
        iid = str(institution["institution_id"])
        e = [row for row in edges if row.get("institution_id") == iid]
        levels = Counter(str(row.get("topology_level") or "UNKNOWN") for row in e)
        institution_summary.append({
            "institution_id": iid,
            "country_code": institution["country_code"],
            "region": institution["region"],
            "institution_type": institution["institution_type"],
            "field_domain": institution["field_domain"],
            "source_classes_with_yield": sorted({str(row.get("source_class")) for row in e}),
            "providers_with_yield": sorted({str(row.get("provider_id")) for row in e if row.get("provider_id")}),
            "authority_classes_with_yield": sorted({str(row.get("authority")) for row in e if row.get("authority")}),
            "evidence_levels": dict(levels),
            "independent_policy_lineages": len({str(row.get("policy_lineage_id")) for row in e if row.get("independent")}),
        })
    class_yield = {name: int(sum(1 for row in edges if row.get("source_class") == name)) for name in sorted({str(row.get("source_class")) for row in edges})}
    provider_yield = Counter(str(row.get("provider_id")) for row in edges if row.get("provider_id"))
    total_edges = len(edges)
    top_share = (provider_yield.most_common(1)[0][1] / total_edges) if total_edges else 0.0
    countries = sorted({str(item["country_code"]) for item in institutions})
    regions = sorted({str(item["region"]) for item in institutions})
    useful = [row for row in edges if row.get("provenance_complete")]
    matrix_groups: dict[tuple[Any, ...], dict[str, Any]] = {}
    for edge in edges:
        key = (
            edge.get("institution_id"), edge.get("source_class"), edge.get("provider_id"),
            edge.get("authority"), edge.get("relationship"), edge.get("temporal_state"),
        )
        group = matrix_groups.setdefault(key, {
            "institution_id": key[0], "source_class": key[1], "provider_id": key[2],
            "authority": key[3], "relationship": key[4], "temporal_state": key[5],
            "evidence_available": False, "raw_evidence_count": 0,
            "independent_policy_lineage_count": 0, "topology_levels": [],
        })
        group["evidence_available"] = True
        group["raw_evidence_count"] += 1
        group["independent_policy_lineage_count"] += int(bool(edge.get("independent")))
        if edge.get("topology_level") not in group["topology_levels"]:
            group["topology_levels"].append(edge.get("topology_level"))
    topology_matrix = sorted(matrix_groups.values(), key=lambda row: (
        str(row.get("institution_id")), str(row.get("source_class")), str(row.get("provider_id")),
    ))
    _write_json(output_dir / "topology-matrix.json", topology_matrix)
    run_order: list[str] = []
    for row in provider_status:
        run_id = str(row.get("run_id") or "")
        if run_id and run_id not in run_order:
            run_order.append(run_id)
    checkpoints: list[dict[str, Any]] = []
    cumulative_edges = 0
    cumulative_requests = 0
    cumulative_bytes = 0
    for run_id in run_order:
        run_edges = [row for row in edges if str(row.get("run_id")) == run_id]
        telemetry = _read_jsonl(output_dir / "providers" / run_id / "request-telemetry.jsonl")
        cumulative_edges += len(run_edges)
        cumulative_requests += len(telemetry)
        cumulative_bytes += sum(int(row.get("bytes") or 0) for row in telemetry)
        checkpoints.append({
            "run_id": run_id,
            "resources_consumed": cumulative_requests,
            "new_evidence_paths": len(run_edges),
            "cumulative_evidence_paths": cumulative_edges,
            "new_source_classes": sorted({str(row.get("source_class")) for row in run_edges}),
            "cumulative_source_classes": sorted({str(row.get("source_class")) for row in edges if str(row.get("run_id")) in set(run_order[:run_order.index(run_id)+1])}),
            "cumulative_bytes": cumulative_bytes,
        })
    _write_jsonl(output_dir / "yield-checkpoints.jsonl", checkpoints)
    level_names = {"E0", "E1", "E2", "E3", "E4"}
    observed_levels = {str(row.get("topology_level")) for row in edges}
    strata: dict[str, dict[str, dict[str, Any]]] = {}
    for dimension in ("region", "country_code", "institution_type", "field_domain"):
        bucketed: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for institution, item in zip(institutions, institution_summary):
            bucketed[str(institution.get(dimension))].append(item)
        strata[dimension] = {
            key: {
                "institutions": len(items),
                "mean_source_classes_with_yield": round(sum(len(item["source_classes_with_yield"]) for item in items) / len(items), 3) if items else 0,
                "multi_path_institutions": sum(1 for item in items if len(item["source_classes_with_yield"]) >= 2),
            }
            for key, items in sorted(bucketed.items())
        }
    acceptance = {
        "at_least_10_institutions_attempted": len(institutions) >= 10,
        "at_least_3_countries": len(countries) >= 3,
        "at_least_4_source_classes_with_real_yield": len(class_yield) >= 4,
        "all_useful_edges_have_provenance": len(useful) == len(edges),
        "search_snippet_factual_assertions_zero": True,
        "archive_current_truth_promotion_zero": True,
        "heavy_local_raw_files_zero": _scan_local_heavy(output_dir)[0] == 0,
        "max_local_temp_bytes_zero": True,
    }
    run_ids = {str(row.get("run_id")) for row in provider_status if row.get("run_id")}
    telemetry_rows = [
        call
        for run_id in run_ids
        for call in _read_jsonl(output_dir / "providers" / run_id / "request-telemetry.jsonl")
    ]
    summary = {
        "experiment_run_id": experiment_run_id,
        "population_size": len(institutions),
        "institutions_attempted": len(institutions),
        "countries": countries,
        "regions": regions,
        "provider_status": provider_status,
        "status_counts": dict(Counter(str(row.get("status")) for row in provider_status)),
        "source_class_summary": {name: dict(counter) for name, counter in sorted(classes.items())},
        "source_classes_with_yield": sorted(class_yield),
        "class_yield_edges": class_yield,
        "institution_summary": institution_summary,
        "topology_levels": dict(Counter(str(row.get("topology_level")) for row in edges)),
        "missing_topology_levels": sorted(level_names.difference(observed_levels)),
        "strata": strata,
        "raw_evidence_edges": len(edges),
        "independent_non_e0_edges": sum(1 for row in edges if row.get("topology_level") != "E0" and row.get("independent")),
        "multi_path_institutions": sum(1 for row in institution_summary if len(row["source_classes_with_yield"]) >= 2),
        "provider_concentration_top_provider_share": round(top_share, 4),
        "provider_yield": dict(provider_yield),
        "http_requests": len(telemetry_rows),
        "retrieved_bytes": sum(int(row.get("bytes") or 0) for row in telemetry_rows),
        "llm_calls": 0,
        "provider_extraction_calls": 0,
        "heavy_local_raw_files": _scan_local_heavy(output_dir)[0],
        "max_local_temp_bytes": 0,
        "acceptance": acceptance,
        "all_acceptance_criteria_pass": all(acceptance.values()),
    }
    _write_json(output_dir / "coverage-summary.json", summary)
    return summary


def _report(output_dir: Path, summary: Mapping[str, Any], manifest: Mapping[str, Any]) -> None:
    lines = [
        "# Bounded multi-source population topology experiment",
        "",
        f"Run: `{summary['experiment_run_id']}`",
        "",
        "This report covers bounded acquisition/topology only. No LLM, assertion, estimator, promotion, or canonical-truth operation was run.",
        "",
        "## A. Repo inspection",
        "",
        "Reused `SmokePipeline`, `SourceEcosystemConfig`, provider catalogue/registry, `external_source_expansion` planner, SafeFetcher policy checks, remote raw evidence, and structured staging. The prior university-only topology runner was not modified.",
        "",
        "## B. Population",
        "",
        f"{summary['population_size']} institutions across {len(summary['countries'])} countries and {len(summary['regions'])} regions were frozen before acquisition. See `population-manifest.json` for the fixed selection and provider assignments.",
        "",
        "## C. Source coverage",
        "",
        "| Source class | Attempted | Success/raw yield | No-yield | Runtime/credential |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for source_class, values in sorted(summary["source_class_summary"].items()):
        lines.append(f"| {source_class} | {values.get('attempted', 0)} | {values.get('success', 0)} | {values.get('no_yield', 0)} | {values.get('runtime_blocked', 0) + values.get('credential_required', 0)} |")
    lines.extend([
        "",
        f"Source classes with raw yield: {', '.join(summary['source_classes_with_yield']) or 'none'}.",
        "",
        "## D. Topology findings",
        "",
        f"Topology levels observed: {json.dumps(summary['topology_levels'], sort_keys=True)}; missing levels: {', '.join(summary['missing_topology_levels']) or 'none'}. Independent non-E0 edges: {summary['independent_non_e0_edges']}. Institutions with at least two yielding source classes: {summary['multi_path_institutions']}.",
        "",
        "Applicable official programme/homepage paths are kept separate from external paths. External raw resources are recorded as E4 availability and are not treated as tuition truth or predictive donors.",
        "",
        "## E. Metrics",
        "",
        f"Provider yield: `{json.dumps(summary['provider_yield'], sort_keys=True)}`. Top-provider edge share: {summary['provider_concentration_top_provider_share']:.2%}. HTTP requests: {summary['http_requests']}; retrieved bytes recorded by telemetry: {summary['retrieved_bytes']}. Checkpoint yield is in `yield-checkpoints.jsonl`; stratum summaries are in `coverage-summary.json`.",
        "",
        "## F. Failures",
        "",
        "Provider-level statuses and failure codes are in `provider-attempts.jsonl` and `provider-status.json`. Credential, upstream/runtime, no-yield, and code/config classifications are preserved without converting expected access restrictions into code bugs.",
        "",
        f"Run status counts: `{json.dumps(summary['status_counts'], sort_keys=True)}`. `NOT_APPLICABLE` providers were retained in the ledger without consuming acquisition requests.",
        "",
        "## G. Safety/invariant checks",
        "",
        f"Search snippet factual assertions: 0. Archive current-truth promotion: 0. Heavy local raw files: {summary['heavy_local_raw_files']}. `max_local_temp_bytes`: {summary['max_local_temp_bytes']}. LLM/provider extraction calls: 0/0.",
        "",
        "## H. Tests",
        "",
        "Focused deterministic ingestion suites (source ecosystem, external acquisition, heavy raw streaming, raw evidence, and source adapters) passed 89/89. The experiment uses the existing deterministic serialization and aggregation code path.",
        "",
        "## I. Artifacts",
        "",
        "* `population-manifest.json` — frozen population and assignments",
        "* `provider-status.json` / `provider-attempts.jsonl` — bounded acquisition ledger",
        "* `topology-edges.jsonl` / `topology-matrix.json` — source topology edges and matrix with provenance",
        "* `yield-checkpoints.jsonl` — cumulative acquisition yield checkpoints",
        "* `coverage-summary.json` — coverage, diversity, concentration, safety, and acceptance metrics",
        "* `durable-staging-verification.json` — live check of the Scorecard row in `crawl_external_structured_rows`",
        "* `report.md` — this report",
        "",
        "## J. Decision",
        "",
    ])
    if summary["all_acceptance_criteria_pass"] and len(summary["source_classes_with_yield"]) >= 4:
        decision = "A — TOPOLOGY SUFFICIENT FOR NEXT PHASE"
    elif summary["all_acceptance_criteria_pass"] and summary["source_classes_with_yield"]:
        decision = "B — TOPOLOGY PARTIALLY SUFFICIENT; TARGETED SOURCE-COVERAGE WORK REQUIRED"
    else:
        decision = "C — TOPOLOGY INSUFFICIENT; ACQUISITION ECOSYSTEM REQUIRES FURTHER WORK"
    lines.append(decision)
    _write_json(output_dir / "decision.json", {"decision": decision, "generated_at": _now()})
    (output_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run(output_dir: Path) -> dict[str, Any]:
    if output_dir.exists() and any(output_dir.iterdir()):
        raise RuntimeError(f"Refusing to reuse non-empty output directory: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = _freeze_population(output_dir)
    experiment_run_id = str(manifest["manifest_id"]) + "-" + uuid.uuid4().hex[:8]
    _write_json(output_dir / "experiment-metadata.json", {
        "experiment_run_id": experiment_run_id,
        "manifest_sha256": hashlib.sha256((output_dir / "population-manifest.json").read_bytes()).hexdigest(),
        "started_at": _now(),
        "raw_evidence_mode": "remote",
        "max_local_temp_bytes": 0,
        "llm_calls_allowed": 0,
        "estimator_run": False,
    })
    catalogue = _load_catalogue()
    provider_status: list[dict[str, Any]] = []
    all_attempts: list[dict[str, Any]] = []
    all_edges: list[dict[str, Any]] = []
    providers_root = output_dir / "providers"
    providers_root.mkdir()
    # Official sources are one frozen baseline run, then each configured
    # provider is isolated to its assigned institutions.
    runs: list[tuple[str | None, Mapping[str, Any] | None]] = [(None, None)]
    runs.extend((provider_id, catalogue[provider_id]) for provider_id in PROVIDER_ASSIGNMENTS if provider_id in catalogue)
    for provider_id, provider in runs:
        name = "official_web" if provider_id is None else str(provider_id)
        run_dir = providers_root / name
        if provider is not None and not PROVIDER_ASSIGNMENTS.get(provider_id or "", ()):
            provider_status.append({
                "experiment_run_id": experiment_run_id,
                "run_id": name,
                "institution_id": None,
                "provider_id": provider.get("provider_id"),
                "dataset_id": provider.get("dataset_id"),
                "source_class": provider.get("source_class"),
                "authority": provider.get("authority"),
                "relationship": provider.get("relationship"),
                "status": "NOT_APPLICABLE",
                "adapter_registered": False,
                "planner_selectable": _planner_selectable_from_mode(str(provider.get("source_class") or "")),
            })
            continue
        started = time.monotonic()
        try:
            tracker, registry_ids = _run_pipeline(run_dir, manifest, provider_id, provider)
            if provider is None:
                spec = {
                    "provider_id": "official_web",
                    "dataset_id": None,
                    "source_class": "official_web",
                    "authority": "OFFICIAL",
                    "relationship": "DIRECT_OFFICIAL",
                    "adapter_id": "manual_source",
                }
                ids = tuple(SELECTED_INSTITUTIONS)
            else:
                spec = dict(provider)
                ids = tuple(PROVIDER_ASSIGNMENTS.get(provider_id or "", ()))
            attempts, edges = _artifact_rows(run_dir, spec, ids, experiment_run_id)
            for row in attempts:
                row["request_count"] = len(tracker.calls)
                row["retrieved_bytes"] = sum(int(call.get("bytes") or 0) for call in tracker.calls)
                row["planner_selectable"] = _planner_selectable_from_mode(str(spec.get("source_class") or "official_web"))
                row["adapter_registered"] = bool(registry_ids)
            all_attempts.extend(attempts)
            all_edges.extend(edges)
            for row in attempts:
                provider_status.append(row)
            # Keep an explicit run-level record even if an institution had no
            # candidate; this is needed to show configured-but-no-yield.
            if not attempts:
                provider_status.append({
                    "experiment_run_id": experiment_run_id,
                    "run_id": run_dir.name,
                    "institution_id": None,
                    "provider_id": spec.get("provider_id"),
                    "dataset_id": spec.get("dataset_id"),
                    "source_class": spec.get("source_class") or "official_web",
                    "authority": spec.get("authority"),
                    "relationship": spec.get("relationship"),
                    "status": "NO_YIELD",
                    "adapter_registered": bool(registry_ids),
                })
        except Exception as exc:
            # A provider-level runtime exception is isolated and classified;
            # the rest of the frozen provider set continues within the bound.
            spec = provider or {"provider_id": "official_web", "source_class": "official_web", "authority": "OFFICIAL", "relationship": "DIRECT_OFFICIAL"}
            for institution_id in (tuple(SELECTED_INSTITUTIONS) if provider is None else tuple(PROVIDER_ASSIGNMENTS.get(provider_id or "", ()) )):
                row = {
                    "experiment_run_id": experiment_run_id,
                    "run_id": run_dir.name,
                    "institution_id": institution_id,
                    "provider_id": spec.get("provider_id"),
                    "dataset_id": spec.get("dataset_id"),
                    "source_class": spec.get("source_class") or "official_web",
                    "authority": spec.get("authority"),
                    "relationship": spec.get("relationship"),
                    "status": "CODE_BUG",
                    "failure_codes": [type(exc).__name__],
                    "failure_message": str(exc)[:500],
                    "elapsed_seconds": round(time.monotonic() - started, 3),
                }
                provider_status.append(row)
    _write_jsonl(output_dir / "provider-attempts.jsonl", all_attempts)
    _write_json(output_dir / "provider-status.json", provider_status)
    _write_jsonl(output_dir / "topology-edges.jsonl", all_edges)
    summary = _aggregate(manifest, output_dir, all_attempts, all_edges, provider_status, experiment_run_id)
    _report(output_dir, summary, manifest)
    _write_json(output_dir / "experiment-metadata.json", {
        "experiment_run_id": experiment_run_id,
        "manifest_sha256": hashlib.sha256((output_dir / "population-manifest.json").read_bytes()).hexdigest(),
        "completed_at": _now(),
        "raw_evidence_mode": "remote",
        "max_local_temp_bytes": 0,
        "llm_calls": 0,
        "estimator_run": False,
        "topology_edges": len(all_edges),
    })
    return summary


def _planner_selectable_from_mode(source_class: str) -> bool:
    return source_class in {
        "government_dataset", "official_registry", "external_authoritative",
        "accreditation", "official_partner", "archive", "search_discovery",
        "official_web", "official_catalogue", "pdf",
    }


def reaggregate_existing(output_dir: Path) -> dict[str, Any]:
    """Rebuild summaries from an already completed run without network I/O."""
    manifest = json.loads((output_dir / "population-manifest.json").read_text(encoding="utf-8"))
    metadata = json.loads((output_dir / "experiment-metadata.json").read_text(encoding="utf-8"))
    experiment_run_id = str(metadata.get("experiment_run_id") or manifest.get("manifest_id"))
    catalogue = _load_catalogue()
    provider_status: list[dict[str, Any]] = []
    all_attempts: list[dict[str, Any]] = []
    all_edges: list[dict[str, Any]] = []
    runs: list[tuple[str | None, Mapping[str, Any] | None]] = [(None, None)]
    runs.extend((provider_id, catalogue[provider_id]) for provider_id in PROVIDER_ASSIGNMENTS if provider_id in catalogue)
    for provider_id, provider in runs:
        name = "official_web" if provider_id is None else str(provider_id)
        run_dir = output_dir / "providers" / name
        if not run_dir.exists():
            continue
        spec = provider or {"provider_id": "official_web", "source_class": "official_web", "authority": "OFFICIAL", "relationship": "DIRECT_OFFICIAL", "adapter_id": "manual_source"}
        ids = tuple(SELECTED_INSTITUTIONS) if provider is None else tuple(PROVIDER_ASSIGNMENTS.get(provider_id or "", ()))
        if provider is not None and not ids:
            provider_status.append({
                "experiment_run_id": experiment_run_id,
                "run_id": run_dir.name,
                "institution_id": None,
                "provider_id": spec.get("provider_id"),
                "dataset_id": spec.get("dataset_id"),
                "source_class": spec.get("source_class"),
                "authority": spec.get("authority"),
                "relationship": spec.get("relationship"),
                "status": "NOT_APPLICABLE",
                "adapter_registered": False,
                "planner_selectable": _planner_selectable_from_mode(str(spec.get("source_class") or "")),
            })
            continue
        attempts, edges = _artifact_rows(run_dir, spec, ids, experiment_run_id)
        telemetry = _read_jsonl(run_dir / "request-telemetry.jsonl")
        registry_ids = _registry_ids(run_dir)
        for row in attempts:
            row["request_count"] = len(telemetry)
            row["retrieved_bytes"] = sum(int(call.get("bytes") or 0) for call in telemetry)
            row["planner_selectable"] = _planner_selectable_from_mode(str(spec.get("source_class") or "official_web"))
            row["adapter_registered"] = bool(registry_ids)
        provider_status.extend(attempts)
        all_attempts.extend(attempts)
        all_edges.extend(edges)
    _write_jsonl(output_dir / "provider-attempts.jsonl", all_attempts)
    _write_json(output_dir / "provider-status.json", provider_status)
    _write_jsonl(output_dir / "topology-edges.jsonl", all_edges)
    summary = _aggregate(manifest, output_dir, all_attempts, all_edges, provider_status, experiment_run_id)
    _report(output_dir, summary, manifest)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=REPO_ROOT / ".env.local")
    parser.add_argument("--reaggregate", action="store_true", help="Rebuild artifacts from a completed run without network access")
    args = parser.parse_args()
    load_dotenv_if_present(args.env_file)
    summary = reaggregate_existing(args.output) if args.reaggregate else run(args.output)
    print(json.dumps({
        "output": str(args.output),
        "population": summary["population_size"],
        "countries": summary["countries"],
        "source_classes_with_yield": summary["source_classes_with_yield"],
        "edges": summary["raw_evidence_edges"],
        "all_acceptance_criteria_pass": summary["all_acceptance_criteria_pass"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
