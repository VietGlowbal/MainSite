"""Bounded, no-LLM live topology acquisition for the frozen tuition roster.

This is research-only orchestration.  It uses the ingestion SafeFetcher,
robots policy, source resolver, parser, and local raw-evidence boundary, but it
never calls an extraction provider or produces assertions.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import time
from collections import Counter, defaultdict
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import quote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[3]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.acquisition import AcquisitionIntent, EntityRef, SourceCandidate
from glowbal_ingestion.config import (
    CrawlLimits,
    ExternalSourceRule,
    InstitutionSeed,
    SmokeConfig,
    SourceEcosystemConfig,
)
from glowbal_ingestion.fetcher import FetchError, SafeFetcher
from glowbal_ingestion.models import (
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    utc_now_iso,
)
from glowbal_ingestion.pipeline import SmokePipeline
from glowbal_ingestion.policy import RobotsPolicy, check_policy
from glowbal_ingestion.raw_evidence import RawEvidenceDurability
from glowbal_ingestion.source_adapters import (
    ManualSourceAdapter,
    PdfDocumentCandidateAdapter,
    SourceAdapterContext,
)
from glowbal_ingestion.url_safety import UnsafeUrlError, canonicalize_url, hostname_matches


RUN_ID = "tuition-live-topology-20260909"
TARGET_CYCLE = "2025-26"
MAX_SOURCE_RESOURCES = 220
MAX_HIERARCHY_PER_TARGET = 3
MAX_EXTERNAL_DISCOVERY_PER_TARGET = 1
CHECKPOINT_EVERY_RESOURCES = 10
IPEDS_CONFIG = REPO_ROOT / "services" / "data-ingestion" / "configs" / "ipeds-us-21.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _append_jsonl(path: Path, row: Mapping[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(row), ensure_ascii=False, separators=(",", ":")) + "\n")


def _normal_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip()


def _tokens(value: str) -> tuple[str, ...]:
    return tuple(token for token in re.findall(r"[a-z0-9]{3,}", _normal_text(value)) if token not in {"and", "the", "for", "msc", "bsc"})


def _infer_cycle(text: str) -> str | None:
    match = re.search(r"\b(20\d{2})\s*[-–/]\s*(20\d{2})\b", text)
    if match:
        return f"{match.group(1)}-{match.group(2)[-2:]}"
    return None


def _infer_audience(text: str) -> str | None:
    lowered = _normal_text(text)
    if "international student" in lowered or "international students" in lowered or "overseas student" in lowered:
        return "international"
    if "domestic student" in lowered or "home student" in lowered or "uk student" in lowered:
        return "domestic"
    return None


def _content_bytes(run_dir: Path, raw_object_path: str | None) -> int | None:
    if not raw_object_path:
        return None
    path = run_dir / raw_object_path
    try:
        if path.suffix == ".gz":
            with gzip.open(path, "rb") as handle:
                return len(handle.read())
        return path.stat().st_size
    except (OSError, EOFError):
        return None


class TrackingSafeFetcher(SafeFetcher):
    """SafeFetcher telemetry without retaining response bodies."""

    def __init__(self, limits: CrawlLimits) -> None:
        super().__init__(limits)
        self.calls: list[dict[str, Any]] = []

    def fetch(self, url: str, **kwargs: Any):  # type: ignore[no-untyped-def]
        started = time.monotonic()
        call: dict[str, Any] = {
            "request_no": len(self.calls) + 1,
            "requested_url": url,
            "started_at": _now(),
        }
        try:
            result = super().fetch(url, **kwargs)
        except FetchError as exc:
            call.update(
                {
                    "status": "FAILED",
                    "http_status": exc.status,
                    "content_type": None,
                    "bytes": 0,
                    "final_url": None,
                    "failure_code": exc.code,
                    "retryable": exc.retryable,
                }
            )
            raise
        else:
            call.update(
                {
                    "status": "RETRIEVED",
                    "http_status": result.status,
                    "content_type": result.content_type,
                    "bytes": len(result.body),
                    "final_url": result.final_url,
                    "failure_code": None,
                    "retryable": False,
                }
            )
            return result
        finally:
            call["elapsed_seconds"] = round(time.monotonic() - started, 3)
            call["finished_at"] = _now()
            self.calls.append(call)


def _load_manifest(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def _build_rules() -> tuple[ExternalSourceRule, ...]:
    return (
        ExternalSourceRule(
            domain="nces.ed.gov",
            adapter_id="ipeds",
            reason="IPEDS directory dataset for institution-level external validation",
            relationship=SourceRelationship.GOVERNMENT,
            authority=SourceAuthority.GOVERNMENT,
        ),
        ExternalSourceRule(
            domain="api.data.gov",
            adapter_id="college_scorecard",
            reason="College Scorecard institution endpoint for external validation",
            relationship=SourceRelationship.GOVERNMENT,
            authority=SourceAuthority.GOVERNMENT,
        ),
        ExternalSourceRule(
            domain="collegescorecard.ed.gov",
            adapter_id="college_scorecard",
            reason="College Scorecard public dataset resource",
            relationship=SourceRelationship.GOVERNMENT,
            authority=SourceAuthority.GOVERNMENT,
        ),
    )


def _build_seeds(manifest: Mapping[str, Any]) -> tuple[tuple[InstitutionSeed, ...], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    seeds: list[InstitutionSeed] = []
    targets_by_id: dict[str, dict[str, Any]] = {}
    targets_by_url: dict[str, dict[str, Any]] = {}
    for institution in manifest["institutions"]:
        targets = tuple(institution["targets"])
        for target in targets:
            row = {
                **target,
                "institution_id": institution["institution_id"],
                "institution_name": institution["name"],
                "country_code": institution["country_code"],
                "region": institution["region"],
                "institution_type": institution["institution_type"],
                "institution_field_domain": institution["field_domain"],
                "official_domain": institution["official_domain"],
            }
            targets_by_id[target["target_id"]] = row
            targets_by_url[canonicalize_url(target["programme_url"])] = row
        seeds.append(
            InstitutionSeed(
                institution_id=institution["institution_id"],
                name=institution["name"],
                country_code=institution["country_code"],
                official_domain=institution["official_domain"],
                homepage_url=institution["homepage_url"],
                external_source_rules=_build_rules(),
                manual_programme_urls=tuple(target["programme_url"] for target in targets),
                terms_status="UNREVIEWED",
                manual_only=True,
            )
        )
    return tuple(seeds), targets_by_id, targets_by_url


def _scorecard_url(institution_name: str) -> str:
    # DEMO_KEY is the public data.gov demonstration key, not a project secret.
    return (
        "https://api.data.gov/ed/collegescorecard/v1/schools.json?"
        f"school.name={quote(institution_name)}&api_key=DEMO_KEY"
    )


def _build_source_ecosystem(manifest: Mapping[str, Any]) -> SourceEcosystemConfig:
    official_resources: list[dict[str, Any]] = []
    scorecard_resources: list[dict[str, Any]] = []
    for institution in manifest["institutions"]:
        for target in institution["targets"]:
            url_text = target["programme_url"].casefold()
            source_class = "official_catalogue" if any(token in url_text for token in ("catalog", "bulletin", "guide", "handbook")) else "official_web"
            official_resources.append(
                {
                    "institution_id": institution["institution_id"],
                    "url": target["programme_url"],
                    "source_class": source_class,
                    "relationship": "DIRECT_OFFICIAL",
                    "authority": "OFFICIAL",
                    "field_groups": ["tuition"],
                    "discovery_method": "frozen_population_manifest",
                    "relationship_evidence": ["frozen target URL selected before live acquisition"],
                }
            )
        if institution["country_code"] == "US":
            scorecard_resources.append(
                {
                    "institution_id": institution["institution_id"],
                    "url": _scorecard_url(institution["name"]),
                    "dataset_id": "college-scorecard-2024-school-search",
                    "academic_cycle": "2024",
                    "source_class": "government_dataset",
                    "relationship": "GOVERNMENT",
                    "authority": "GOVERNMENT",
                    "field_groups": ["institution_metadata"],
                    "discovery_method": "configured_government_resource",
                    "relationship_evidence": ["data.gov College Scorecard endpoint"],
                }
            )
    return SourceEcosystemConfig.from_dict(
        {
            "enabled": True,
            "runtime_acquisition_enabled": True,
            "field_groups": ["tuition"],
            "target_cycle": TARGET_CYCLE,
            "max_fetches_per_institution": 8,
            "official_web": {"enabled": True, "resources": official_resources},
            "official_catalogue": {"enabled": True},
            "pdf": {"enabled": True},
            "structured_apis": {"enabled": False},
            "government_datasets": {
                "enabled": True,
                "providers": ["ipeds", "college_scorecard"],
                "ipeds_target_config": str(IPEDS_CONFIG.resolve()),
                "scorecard_resources": scorecard_resources,
            },
            "external_authoritative": {"enabled": True},
            "archives": {"enabled": False},
            "search_discovery": {"enabled": False},
        }
    )


def _intent(target: Mapping[str, Any], *, source_classes: tuple[str, ...]) -> AcquisitionIntent:
    return AcquisitionIntent.create(
        entity=EntityRef("PROGRAMME", str(target["target_id"])),
        field_groups=("tuition",),
        reason="LIVE_TOPOLOGY_EXPERIMENT",
        target_cycle=TARGET_CYCLE,
        preferred_source_classes=source_classes,
    )


def _classify_link(href: str, label: str) -> tuple[str, str, str, int] | None:
    lowered = _normal_text(f"{href} {label}")
    path = _normal_text(urlsplit(href).path)
    if not href.startswith(("http://", "https://")):
        return None
    if any(token in lowered for token in ("mailto:", "javascript:", "privacy", "cookie", "login", "facebook", "twitter", "linkedin")):
        return None
    pdf = ".pdf" in path
    e1_score = sum(token in lowered for token in ("department", "faculty", "school", "college", "institute", "academic unit"))
    finance_score = sum(token in lowered for token in ("tuition", "fee", "fees", "finance", "registrar", "bursar", "cost", "funding"))
    admissions_score = sum(token in lowered for token in ("admission", "admissions", "apply", "international"))
    sibling_score = sum(token in lowered for token in ("program", "programme", "degree", "major", "course", "catalog", "bulletin", "study", "subject"))
    if pdf:
        level = "E1" if e1_score else "E2" if finance_score or admissions_score else "E3"
        relationship = "DEPARTMENT" if e1_score else "FINANCE_OFFICE" if finance_score else "CENTRAL_ADMISSIONS" if admissions_score else "OTHER_RELATED"
        return level, "pdf", relationship, 20 + e1_score * 4 + finance_score * 4 + admissions_score * 3
    if e1_score:
        return "E1", "official_web", "DEPARTMENT", 16 + e1_score * 4
    if finance_score:
        return "E2", "official_finance", "FINANCE_OFFICE", 18 + finance_score * 5
    if admissions_score:
        return "E2", "official_web", "CENTRAL_ADMISSIONS", 17 + admissions_score * 4
    if sibling_score:
        return "E3", "official_catalogue", "OTHER_RELATED", 10 + sibling_score * 3
    return None


def _candidate_from_link(
    *, seed: InstitutionSeed, target: Mapping[str, Any], href: str, label: str, level: str, source_class: str, relationship: str
) -> SourceCandidate | None:
    relationship_enum = SourceRelationship(relationship)
    intent_classes = ("pdf",) if source_class == "pdf" else ("official_web",)
    intent = _intent(target, source_classes=intent_classes)
    context = SourceAdapterContext(
        entity=intent.entity,
        seed=seed,
        target_cycle=TARGET_CYCLE,
        field_groups=("tuition",),
        configuration={},
    )
    if source_class == "pdf":
        adapter = PdfDocumentCandidateAdapter()
        found = adapter.discover(
            intent,
            replace(context, configuration={"pdf_candidates": [{"url": href, "title": label}]}),
        )
    else:
        adapter = ManualSourceAdapter()
        found = adapter.discover(
            intent,
            replace(
                context,
                configuration={
                    "official_web_resources": [
                        {
                            "url": href,
                            "source_class": source_class,
                            "relationship": relationship,
                            "authority": "OFFICIAL",
                            "relationship_evidence": [f"link discovered on frozen programme page: {label[:180]}"],
                            "discovery_method": "programme_link",
                        }
                    ]
                },
            ),
        )
    if not found:
        return None
    return replace(
        found[0],
        academic_cycle=None,
        expected_field_groups=("tuition",),
        adapter_metadata={**found[0].adapter_metadata, "topology_level": level, "link_label": label[:300]},
    )


def _classify_applicability(target: Mapping[str, Any], level: str, text: str) -> str:
    lowered = _normal_text(text)
    if level == "E0":
        return "DIRECTLY_APPLICABLE"
    target_phrase = _normal_text(str(target["programme_name"]))
    degree = str(target["degree_level"]).casefold()
    opposite = (
        (degree == "bachelor" and any(token in lowered for token in ("graduate only", "master's", "postgraduate", "phd")))
        or (degree in {"master", "professional"} and any(token in lowered for token in ("undergraduate only", "bachelor's degree", "first-year undergraduate")))
    )
    if opposite:
        return "RELATED_BUT_NOT_APPLICABLE"
    has_target = bool(target_phrase) and target_phrase in lowered
    has_tuition = any(token in lowered for token in ("tuition", "fee", "fees", "cost", "financial"))
    if has_target and has_tuition:
        return "DIRECTLY_APPLICABLE"
    if level == "E4":
        return "INDEPENDENT_EXTERNAL"
    if level == "E3":
        return "POTENTIALLY_COMPARABLE"
    return "AMBIGUOUS"


def _lineage_id(candidate: SourceCandidate, source_hash: str | None) -> str:
    if candidate.provider_id or candidate.dataset_id:
        return f"provider:{candidate.provider_id or ''}:{candidate.dataset_id or ''}"
    if source_hash:
        return f"content:{source_hash}"
    return f"url:{canonicalize_url(candidate.canonical_locator)}"


def _edge_row(
    *, target: Mapping[str, Any], document: Any, candidate: SourceCandidate, level: str, independent: bool, run_dir: Path, source_hash: str | None = None, matched_external: bool = False
) -> dict[str, Any]:
    text = str(getattr(document, "title", "") or "")
    applicability = _classify_applicability(target, level, text)
    # The parser text is added by the caller when available; title-only edges
    # remain conservative and are marked ambiguous unless the level is E0/E4.
    return {
        "run_id": RUN_ID,
        "target_id": target["target_id"],
        "institution_id": target["institution_id"],
        "source_id": document.source_id,
        "source_url": document.canonical_url,
        "source_class": candidate.source_class,
        "adapter_id": candidate.adapter_id,
        "provider_id": candidate.provider_id,
        "dataset_id": candidate.dataset_id,
        "authority": candidate.declared_authority.value if candidate.declared_authority else None,
        "relationship": candidate.relationship.value if candidate.relationship else None,
        "topology_level": level,
        "applicability_class": "INDEPENDENT_EXTERNAL" if level == "E4" and matched_external else applicability,
        "policy_lineage_id": _lineage_id(candidate, source_hash),
        "independent": independent,
        "academic_cycle": _infer_cycle(text),
        "audience": _infer_audience(text),
        "field_domain": target["field_domain"],
        "degree_level": target["degree_level"],
        "content_type": document.content_type,
        "retrieved_at": document.retrieved_at,
        "raw_document_id": document.raw_document_id,
        "raw_object_path": document.raw_object_path,
    }


def _edge_with_text(edge: dict[str, Any], text: str, target: Mapping[str, Any], level: str, matched_external: bool = False) -> dict[str, Any]:
    edge = dict(edge)
    edge["applicability_class"] = "INDEPENDENT_EXTERNAL" if level == "E4" and matched_external else _classify_applicability(target, level, text)
    edge["academic_cycle"] = _infer_cycle(text)
    edge["audience"] = _infer_audience(text)
    return edge


def _make_government_edges(
    *, target: Mapping[str, Any], document: Any, candidate: SourceCandidate, lineage_seen: set[str], run_dir: Path, text: str
) -> dict[str, Any]:
    lineage = _lineage_id(candidate, getattr(document, "content_hash", None))
    independent = lineage not in lineage_seen
    lineage_seen.add(lineage)
    edge = _edge_row(
        target=target,
        document=document,
        candidate=candidate,
        level="E4",
        independent=independent,
        run_dir=run_dir,
        source_hash=getattr(document, "content_hash", None),
        matched_external=True,
    )
    return _edge_with_text(edge, text, target, "E4", matched_external=True)


def _safe_fetch_metadata(fetcher: TrackingSafeFetcher, url: str) -> dict[str, Any] | None:
    canonical = canonicalize_url(url)
    for call in reversed(fetcher.calls):
        if call.get("final_url") == canonical or call.get("requested_url") == url:
            return call
    return None


def _checkpoint(
    path: Path,
    *,
    source_attempts: int,
    targets_with_edges: set[str],
    edges: list[dict[str, Any]],
    source_classes: set[str],
    fetcher: TrackingSafeFetcher,
) -> None:
    _append_jsonl(
        path,
        {
            "run_id": RUN_ID,
            "checkpoint_resource_attempts": source_attempts,
            "actual_http_requests": len(fetcher.calls),
            "targets_with_any_evidence": len(targets_with_edges),
            "raw_evidence_paths": len(edges),
            "independent_policy_lineages": len({edge["policy_lineage_id"] for edge in edges if edge["independent"]}),
            "source_classes_represented": sorted(source_classes),
            "recorded_at": _now(),
        },
    )


def run(manifest_path: Path, output_dir: Path) -> dict[str, Any]:
    manifest, manifest_sha256 = _load_manifest(manifest_path)
    seeds, targets_by_id, targets_by_url = _build_seeds(manifest)
    ecosystem = _build_source_ecosystem(manifest)
    if output_dir.exists() and any(output_dir.iterdir()):
        raise RuntimeError(f"Refusing to reuse non-empty experiment directory: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = output_dir / "acquisition-ledger.jsonl"
    requests_path = output_dir / "request-telemetry.jsonl"
    edges_path = output_dir / "topology-edges.jsonl"
    checkpoints_path = output_dir / "yield-checkpoints.jsonl"
    started_at = _now()

    limits = CrawlLimits(
        global_concurrency=1,
        institution_concurrency=1,
        programme_concurrency_per_institution=1,
        per_domain_concurrency=1,
        request_timeout_seconds=20.0,
        connect_timeout_seconds=10.0,
        max_redirects=5,
        max_html_bytes=12 * 1024 * 1024,
        max_pdf_bytes=25 * 1024 * 1024,
        max_sitemap_bytes=2 * 1024 * 1024,
        min_request_interval_seconds=0.25,
        user_agent="GlowBalTuitionTopologyExperiment/1.0 (+mailto:data@glowbal.co)",
    )
    config = SmokeConfig(
        run_name=RUN_ID,
        institutions=seeds,
        limits=limits,
        raw_evidence_mode="local",
        acquisition_backend="platform_shadow",
        source_ecosystem=ecosystem,
    )
    pipeline = SmokePipeline(
        config,
        output_dir,
        allow_unreviewed_terms=True,
        discovery_only=True,
        skip_school_profile=True,
    )
    tracker = TrackingSafeFetcher(limits)
    pipeline.fetcher = tracker
    # The pipeline constructor creates an unavailable provider when no key is
    # configured; this guard documents the no-LLM invariant and avoids relying
    # on provider environment state later in the loop.
    extraction_calls = 0
    source_attempts = 0
    source_classes: set[str] = set()
    targets_with_edges: set[str] = set()
    edges: list[dict[str, Any]] = []
    lineage_seen: set[str] = set()
    source_cache: dict[str, tuple[Any, Any, SourceCandidate, str, list[tuple[str, str]]]] = {}
    source_class_stats: dict[str, Counter[str]] = defaultdict(Counter)
    policy_statuses: Counter[str] = Counter()
    target_status: dict[str, dict[str, Any]] = {
        target_id: {
            "target_id": target_id,
            "institution_id": target["institution_id"],
            "programme_name": target["programme_name"],
            "degree_level": target["degree_level"],
            "field_domain": target["field_domain"],
            "region": target["region"],
            "institution_type": target["institution_type"],
            "pricing_structure_stratum": target["pricing_structure_stratum"],
            "evidence_levels": [],
            "non_e0_independent_paths": 0,
        }
        for target_id, target in targets_by_id.items()
    }

    _write_json(
        output_dir / "run-metadata.json",
        {
            "run_id": RUN_ID,
            "started_at": started_at,
            "manifest_path": str(manifest_path),
            "manifest_sha256": manifest_sha256,
            "target_cycle": TARGET_CYCLE,
            "target_count": len(targets_by_id),
            "institution_count": len(seeds),
            "llm_calls_allowed": 0,
            "provider_extraction_calls_allowed": 0,
            "raw_evidence_mode": "local",
            "max_source_resources": MAX_SOURCE_RESOURCES,
            "max_hierarchy_per_target": MAX_HIERARCHY_PER_TARGET,
            "source_ecosystem_adapters": list(pipeline.discovery.registry.adapter_ids),
        },
    )

    try:
        for seed in seeds:
            policy = check_policy(seed, tracker, allow_unreviewed_terms=True)
            pipeline.store.append("policy_checks", policy.check)
            policy_statuses[policy.check.policy_status.value] += 1
            policy_allowed = policy.check.policy_status.value in {"ALLOWED", "ALLOWED_TERMS_UNREVIEWED"}
            configured_decisions = pipeline.discovery.configured_source_decisions(seed, policy)
            decisions_by_url: dict[str, tuple[AcquisitionIntent, Any]] = {}
            government_decisions: list[tuple[AcquisitionIntent, Any]] = []
            for intent, decision in configured_decisions:
                candidate = decision.candidate
                try:
                    canonical = canonicalize_url(candidate.canonical_locator)
                except UnsafeUrlError:
                    canonical = candidate.canonical_locator
                if candidate.adapter_id in {"ipeds", "college_scorecard"}:
                    government_decisions.append((intent, decision))
                elif canonical in targets_by_url:
                    decisions_by_url[canonical] = (intent, decision)

            # Programme-specific E0 sources are frozen, so they are attempted
            # before any link-derived hierarchy source is considered.
            for target in (item for item in targets_by_id.values() if item["institution_id"] == seed.institution_id):
                target_id = target["target_id"]
                canonical_target = canonicalize_url(target["programme_url"])
                pair = decisions_by_url.get(canonical_target)
                if pair is None:
                    _append_jsonl(
                        ledger_path,
                        {
                            "run_id": RUN_ID,
                            "request_no": None,
                            "resource_kind": "programme",
                            "target_id": target_id,
                            "institution_id": seed.institution_id,
                            "url": target["programme_url"],
                            "adapter": "manual_source",
                            "source_class": "official_web",
                            "authority": "OFFICIAL",
                            "relationship": "DIRECT_OFFICIAL",
                            "topology_level": "E0",
                            "discovered": False,
                            "admitted": False,
                            "persisted": False,
                            "failure_reason": "CONFIGURED_TARGET_NOT_RETURNED",
                        },
                    )
                    continue
                intent, decision = pair
                candidate = decision.candidate
                source_classes.add(candidate.source_class)
                source_class_stats[candidate.source_class]["configured"] += 1
                source_class_stats[candidate.source_class]["discovered"] += 1
                source_class_stats[candidate.source_class]["admitted" if decision.admitted else "rejected"] += 1
                if source_attempts >= MAX_SOURCE_RESOURCES:
                    break
                source_attempts += 1
                if not policy_allowed:
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None, "resource_kind": "programme", "target_id": target_id, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E0", "discovered": True, "admitted": decision.admitted, "persisted": False, "failure_reason": f"POLICY_{policy.check.policy_status.value}"})
                    continue
                if not decision.admitted:
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None, "resource_kind": "programme", "target_id": target_id, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E0", "discovered": True, "admitted": False, "persisted": False, "failure_reason": decision.reason})
                    continue
                if canonical_target in source_cache:
                    document, extraction_source, cached_candidate, text, _links = source_cache[canonical_target]
                    edge = _edge_row(target=target, document=document, candidate=cached_candidate, level="E0", independent=(_lineage_id(cached_candidate, document.content_hash) not in lineage_seen), run_dir=output_dir, source_hash=document.content_hash)
                    lineage_seen.add(edge["policy_lineage_id"])
                    edges.append(_edge_with_text(edge, text, target, "E0"))
                    _append_jsonl(edges_path, edges[-1])
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None, "resource_kind": "programme", "target_id": target_id, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": cached_candidate.adapter_id, "source_class": cached_candidate.source_class, "authority": cached_candidate.declared_authority.value if cached_candidate.declared_authority else None, "relationship": cached_candidate.relationship.value if cached_candidate.relationship else None, "topology_level": "E0", "discovered": True, "admitted": True, "persisted": True, "reused": True, "failure_reason": None})
                else:
                    try:
                        document, extraction_source, links = pipeline._fetch_and_parse_source(seed, policy, candidate.canonical_locator, source_candidate=candidate, source_allowed_domains=decision.allowed_domains)
                    except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                        metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                        _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": metadata.get("request_no"), "resource_kind": "programme", "target_id": target_id, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E0", "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": False, "failure_reason": getattr(exc, "code", str(exc))})
                        source_class_stats[candidate.source_class]["failed"] += 1
                        continue
                    text = extraction_source.text
                    source_cache[canonical_target] = (document, extraction_source, candidate, text, links)
                    source_class_stats[candidate.source_class]["fetched"] += 1
                    source_class_stats[candidate.source_class]["persisted"] += 1
                    source_class_stats[candidate.source_class]["linked"] += 1
                    edge = _edge_row(target=target, document=document, candidate=candidate, level="E0", independent=(_lineage_id(candidate, document.content_hash) not in lineage_seen), run_dir=output_dir, source_hash=document.content_hash)
                    lineage_seen.add(edge["policy_lineage_id"])
                    edges.append(_edge_with_text(edge, text, target, "E0"))
                    _append_jsonl(edges_path, edges[-1])
                    metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": metadata.get("request_no"), "resource_kind": "programme", "target_id": target_id, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E0", "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": True, "failure_reason": None})
                targets_with_edges.add(target_id)
                target_status[target_id]["evidence_levels"] = sorted(set(target_status[target_id]["evidence_levels"] + ["E0"]))
                if source_attempts % CHECKPOINT_EVERY_RESOURCES == 0:
                    _checkpoint(checkpoints_path, source_attempts=source_attempts, targets_with_edges=targets_with_edges, edges=edges, source_classes=source_classes, fetcher=tracker)

            # Government resources are institution-level evidence.  The same
            # IPEDS dataset is intentionally fetched once and then linked to
            # every mapped target; Scorecard endpoints are institution-specific.
            for intent, decision in government_decisions:
                candidate = decision.candidate
                source_classes.add(candidate.source_class)
                source_class_stats[candidate.source_class]["configured"] += 1
                source_class_stats[candidate.source_class]["discovered"] += 1
                source_class_stats[candidate.source_class]["admitted" if decision.admitted else "rejected"] += 1
                try:
                    canonical = canonicalize_url(candidate.canonical_locator)
                except UnsafeUrlError:
                    canonical = candidate.canonical_locator
                if not decision.admitted or not policy_allowed:
                    continue
                if source_attempts >= MAX_SOURCE_RESOURCES:
                    break
                if canonical in source_cache:
                    document, extraction_source, cached_candidate, text, _links = source_cache[canonical]
                else:
                    source_attempts += 1
                    try:
                        document, extraction_source, links = pipeline._fetch_and_parse_source(seed, policy, candidate.canonical_locator, source_candidate=candidate, source_allowed_domains=decision.allowed_domains)
                    except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                        metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                        source_class_stats[candidate.source_class]["failed"] += 1
                        _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": metadata.get("request_no"), "resource_kind": "government", "target_id": None, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E4", "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": False, "failure_reason": getattr(exc, "code", str(exc))})
                        continue
                    cached_candidate = candidate
                    text = extraction_source.text
                    source_cache[canonical] = (document, extraction_source, cached_candidate, text, links)
                    source_class_stats[candidate.source_class]["fetched"] += 1
                    source_class_stats[candidate.source_class]["persisted"] += 1
                    metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": metadata.get("request_no"), "resource_kind": "government", "target_id": None, "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": "E4", "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": True, "failure_reason": None})
                for target in (item for item in targets_by_id.values() if item["institution_id"] == seed.institution_id):
                    edge = _make_government_edges(target=target, document=document, candidate=cached_candidate, lineage_seen=lineage_seen, run_dir=output_dir, text=text)
                    edges.append(edge)
                    _append_jsonl(edges_path, edge)
                    targets_with_edges.add(target["target_id"])
                    target_status[target["target_id"]]["evidence_levels"] = sorted(set(target_status[target["target_id"]]["evidence_levels"] + ["E4"]))
                    if edge["independent"]:
                        target_status[target["target_id"]]["non_e0_independent_paths"] += 1
                    source_class_stats[candidate.source_class]["linked"] += 1

            # Fetch at most one E1, one E2, and one E3 candidate per target.
            for target in (item for item in targets_by_id.values() if item["institution_id"] == seed.institution_id):
                canonical_target = canonicalize_url(target["programme_url"])
                if canonical_target not in source_cache or source_attempts >= MAX_SOURCE_RESOURCES:
                    continue
                _, extraction_source, _, _, links = source_cache[canonical_target]
                grouped: dict[str, list[tuple[str, str, str, int]]] = defaultdict(list)
                external_links: list[tuple[str, str]] = []
                for href, label in links:
                    try:
                        href_canonical = canonicalize_url(href)
                    except UnsafeUrlError:
                        continue
                    if href_canonical == canonical_target:
                        continue
                    host = urlsplit(href_canonical).hostname or ""
                    if not hostname_matches(host, seed.all_allowed_domains):
                        if len(external_links) < MAX_EXTERNAL_DISCOVERY_PER_TARGET:
                            external_links.append((href_canonical, label))
                        continue
                    classified = _classify_link(href_canonical, label)
                    if classified is None:
                        continue
                    level, source_class, relationship, score = classified
                    grouped[level].append((href_canonical, label, source_class + "|" + relationship, score))
                selected_links: list[tuple[str, str, str, str, str]] = []
                for level in ("E1", "E2", "E3"):
                    options = sorted(grouped[level], key=lambda item: (-item[3], len(item[0]), item[0]))
                    if options:
                        href, label, combined, _ = options[0]
                        source_class, relationship = combined.split("|", 1)
                        selected_links.append((level, href, label, source_class, relationship))
                for level, href, label, source_class, relationship in selected_links:
                    if source_attempts >= MAX_SOURCE_RESOURCES:
                        break
                    candidate = _candidate_from_link(seed=seed, target=target, href=href, label=label, level=level, source_class=source_class, relationship=relationship)
                    if candidate is None:
                        continue
                    source_classes.add(candidate.source_class)
                    source_class_stats[candidate.source_class]["discovered"] += 1
                    link_intent = _intent(target, source_classes=("pdf",) if candidate.source_class == "pdf" else ("official_web",))
                    decision = pipeline.discovery.resolver.evaluate(candidate, seed=seed, intent=link_intent)
                    source_class_stats[candidate.source_class]["admitted" if decision.admitted else "rejected"] += 1
                    source_attempts += 1
                    if not decision.admitted or not policy_allowed:
                        _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None, "resource_kind": "hierarchy", "target_id": target["target_id"], "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": level, "discovered": True, "admitted": decision.admitted, "persisted": False, "failure_reason": decision.reason if not decision.admitted else f"POLICY_{policy.check.policy_status.value}"})
                        continue
                    try:
                        canonical = canonicalize_url(candidate.canonical_locator)
                    except UnsafeUrlError:
                        canonical = candidate.canonical_locator
                    if canonical in source_cache:
                        document, extraction_source_2, cached_candidate, text, _links = source_cache[canonical]
                        reused = True
                    else:
                        reused = False
                        try:
                            document, extraction_source_2, links = pipeline._fetch_and_parse_source(seed, policy, candidate.canonical_locator, source_candidate=candidate, source_allowed_domains=decision.allowed_domains)
                        except (FetchError, RuntimeError, UnsafeUrlError) as exc:
                            metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                            source_class_stats[candidate.source_class]["failed"] += 1
                            _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": metadata.get("request_no"), "resource_kind": "hierarchy", "target_id": target["target_id"], "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": level, "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": False, "failure_reason": getattr(exc, "code", str(exc))})
                            continue
                        text = extraction_source_2.text
                        cached_candidate = candidate
                        source_cache[canonical] = (document, extraction_source_2, cached_candidate, text, links)
                        source_class_stats[candidate.source_class]["fetched"] += 1
                        source_class_stats[candidate.source_class]["persisted"] += 1
                    # A link may use an HTTP/HTTPS variant (or another URL
                    # that redirects) of the frozen programme page.  It is
                    # still the E0 document and must not be relabelled as an
                    # E1/E2/E3 hierarchy edge.
                    metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                    target_document = source_cache[canonical_target][0]
                    try:
                        same_target_document = (
                            canonicalize_url(document.canonical_url)
                            == canonicalize_url(target_document.canonical_url)
                        )
                    except UnsafeUrlError:
                        same_target_document = document.canonical_url == target_document.canonical_url
                    if same_target_document:
                        _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None if reused else metadata.get("request_no"), "resource_kind": "hierarchy", "target_id": target["target_id"], "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value if candidate.declared_authority else None, "relationship": candidate.relationship.value if candidate.relationship else None, "topology_level": level, "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": True, "reused": reused, "failure_reason": "SAME_TARGET_DOCUMENT_AFTER_REDIRECT"})
                        continue
                    lineage = _lineage_id(cached_candidate, document.content_hash)
                    independent = lineage not in lineage_seen
                    lineage_seen.add(lineage)
                    edge = _edge_row(target=target, document=document, candidate=cached_candidate, level=level, independent=independent, run_dir=output_dir, source_hash=document.content_hash)
                    edges.append(_edge_with_text(edge, text, target, level))
                    _append_jsonl(edges_path, edges[-1])
                    targets_with_edges.add(target["target_id"])
                    target_status[target["target_id"]]["evidence_levels"] = sorted(set(target_status[target["target_id"]]["evidence_levels"] + [level]))
                    if independent and level != "E0":
                        target_status[target["target_id"]]["non_e0_independent_paths"] += 1
                    source_class_stats[candidate.source_class]["linked"] += 1
                    metadata = _safe_fetch_metadata(tracker, candidate.canonical_locator) or {}
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None if reused else metadata.get("request_no"), "resource_kind": "hierarchy", "target_id": target["target_id"], "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": cached_candidate.adapter_id, "source_class": cached_candidate.source_class, "authority": cached_candidate.declared_authority.value if cached_candidate.declared_authority else None, "relationship": cached_candidate.relationship.value if cached_candidate.relationship else None, "topology_level": level, "discovered": True, "admitted": True, "http_status": metadata.get("http_status"), "content_type": metadata.get("content_type"), "bytes": metadata.get("bytes", 0), "fetch_method": "http", "persisted": True, "reused": reused, "failure_reason": None})
                    if source_attempts % CHECKPOINT_EVERY_RESOURCES == 0:
                        _checkpoint(checkpoints_path, source_attempts=source_attempts, targets_with_edges=targets_with_edges, edges=edges, source_classes=source_classes, fetcher=tracker)
                for href, label in external_links:
                    candidate = SourceCandidate.create(canonical_locator=href, locator_type="url", source_class="external_authoritative", adapter_id="manual_source", relationship=SourceRelationship.OTHER_RELATED, relationship_evidence=(f"external link discovered on programme page: {label[:180]}",), declared_authority=SourceAuthority.OTHER, expected_field_groups=("tuition",), discovery_method="programme_link")
                    source_class_stats["external_authoritative"]["discovered"] += 1
                    decision = pipeline.discovery.resolver.evaluate(candidate, seed=seed, intent=_intent(target, source_classes=("official_web",)))
                    source_class_stats["external_authoritative"]["admitted" if decision.admitted else "rejected"] += 1
                    _append_jsonl(ledger_path, {"run_id": RUN_ID, "request_no": None, "resource_kind": "external_discovery", "target_id": target["target_id"], "institution_id": seed.institution_id, "url": candidate.canonical_locator, "adapter": candidate.adapter_id, "source_class": candidate.source_class, "authority": candidate.declared_authority.value, "relationship": candidate.relationship.value, "topology_level": "E4", "discovered": True, "admitted": decision.admitted, "persisted": False, "failure_reason": decision.reason if not decision.admitted else "EXTERNAL_DISCOVERY_ONLY"})

        # Write request telemetry after every institution so a partial run is
        # still auditable if a process is interrupted.
        if tracker.calls:
            requests_path.write_text("".join(json.dumps(call, ensure_ascii=False, separators=(",", ":")) + "\n" for call in tracker.calls), encoding="utf-8")
    finally:
        extraction_calls = 0
        pipeline.state.close()
        pipeline.llm_state.close()

    for target_id, row in target_status.items():
        row["evidence_levels"] = sorted(set(row["evidence_levels"]))
        row["has_non_e0"] = any(level != "E0" for level in row["evidence_levels"])
        row["has_independent_non_e0"] = row["non_e0_independent_paths"] > 0
        row["multiple_paths"] = len(row["evidence_levels"]) >= 2
    _write_json(output_dir / "target-topology-summary.json", {"run_id": RUN_ID, "targets": list(target_status.values())})
    _write_json(output_dir / "topology-edges.json", {"run_id": RUN_ID, "edge_count": len(edges), "edges": edges})
    finished_at = _now()
    source_stats_json = {key: dict(value) for key, value in sorted(source_class_stats.items())}
    summary = {
        "run_id": RUN_ID,
        "manifest_path": str(manifest_path),
        "manifest_sha256": manifest_sha256,
        "started_at": started_at,
        "finished_at": finished_at,
        "target_count": len(targets_by_id),
        "institution_count": len(seeds),
        "http_requests": len(tracker.calls),
        "retrieved_requests": sum(call.get("status") == "RETRIEVED" for call in tracker.calls),
        "failed_requests": sum(call.get("status") == "FAILED" for call in tracker.calls),
        "bytes_retrieved": sum(int(call.get("bytes") or 0) for call in tracker.calls),
        "source_resource_attempts": source_attempts,
        "max_source_resources": MAX_SOURCE_RESOURCES,
        "llm_calls": 0,
        "deepseek_calls": 0,
        "provider_extraction_calls": extraction_calls,
        "policy_statuses": dict(policy_statuses),
        "raw_evidence_mode": "local",
        "raw_evidence_remote_configured": False,
        "persisted_sources": len(source_cache),
        "topology_edges": len(edges),
        "independent_policy_lineages": len({edge["policy_lineage_id"] for edge in edges}),
        "targets_with_any_evidence": sum(bool(row["evidence_levels"]) for row in target_status.values()),
        "targets_with_non_e0": sum(row["has_non_e0"] for row in target_status.values()),
        "targets_with_independent_non_e0": sum(row["has_independent_non_e0"] for row in target_status.values()),
        "targets_with_multiple_levels": sum(row["multiple_paths"] for row in target_status.values()),
        "source_class_stats": source_stats_json,
        "adapters_registered": list(pipeline.discovery.registry.adapter_ids),
        "search_attempted": False,
        "archive_attempted": False,
    }
    _write_json(output_dir / "summary.json", summary)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("tuition-live-population-topology-manifest.json"))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("tuition-live-population-topology-run-20260909"))
    args = parser.parse_args()
    summary = run(args.manifest.resolve(), args.output.resolve())
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
