"""Analyze the real external canary and bounded replay.

The analyzer is deliberately artifact-only.  It reads the completed runner
outputs, runs the existing H1-H4 engine over accepted external rows, and never
changes ingestion, acceptance, promotion, or canonical state.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
RUNS = ROOT / "runs"
BASE_ANALYZER = ROOT.parent / "external-field-scale-20260914" / "analyze_scale_run.py"
sys_path = str(BASE_ANALYZER.parent)
import sys
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)
spec = importlib.util.spec_from_file_location("scale_analyzer", BASE_ANALYZER)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load analyzer: {BASE_ANALYZER}")
scale = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scale)

scale.ROOT = ROOT
scale.MANIFEST = ROOT / "population-manifest.json"
scale.CONFIG = ROOT / "population-config.json"
scale.PROVIDERS = {
    "college_scorecard_bulk": {"country": "US", "scope": "institution"},
    "swissuniversities_tuition": {"country": "CH", "scope": "institution"},
    "onisep_higher_ed": {"country": "FR", "scope": "programme"},
    "discover_uni_hesa": {"country": "UK", "scope": "programme"},
    "duo_rio_ho": {"country": "NL", "scope": "programme"},
    "susa_navet_event": {"country": "SE", "scope": "programme"},
    "susa_navet_info": {"country": "SE", "scope": "programme"},
    "studyinfo_hakukohde": {"country": "FI", "scope": "programme"},
    "studyinfo_toteutus": {"country": "FI", "scope": "programme"},
    "studyinfo_valintaperuste": {"country": "FI", "scope": "programme"},
}

PROVIDERS = tuple(scale.PROVIDERS)
FIELD_SET = (
    "programme_identity", "credential", "programme_status", "academic_cycle",
    "tuition", "additional_fees", "duration", "location", "delivery_mode",
    "programme_language", "career_outcomes", "employment_outcomes", "intakes",
    "final_deadline", "rolling_admission", "minimum_degree", "subject_prerequisites",
    "required_documents", "standardized_tests", "work_experience", "ielts_overall",
    "ielts_subscores", "toefl", "duolingo", "application_fee", "priority_deadline",
    "international_deadline", "funding_deadline", "minimum_gpa", "gpa_scale",
    "recommendation_letters", "sop_essay_requirements", "portfolio", "scholarships",
    "funding", "funding_amount", "funding_eligibility", "application_url",
)
METADATA_ALIASES = {
    "campus": "location",
    "location": "location",
    "delivery_mode": "delivery_mode",
    "duration": "duration",
    "language": "programme_language",
    "programme_language": "programme_language",
    "programme_status": "programme_status",
    "academic_cycle": "academic_cycle",
}


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def unique_rows(rows: Iterable[dict[str, Any]], key: str = "assertion_id") -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        value = row.get(key)
        if value is not None:
            seen.setdefault(str(value), row)
    return list(seen.values())


def nonempty(value: Any) -> bool:
    return value not in (None, "", [], {})


def accepted(row: dict[str, Any]) -> bool:
    return (
        nonempty(row.get("value_json"))
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def review(row: dict[str, Any]) -> bool:
    return nonempty(row.get("value_json")) and (
        row.get("verification_status") == "NEEDS_REVIEW" or bool(row.get("validation_errors"))
    )


def run_rows(run: Path) -> dict[str, list[dict[str, Any]]]:
    return {
        "institutions": read_jsonl(run / "institutions.jsonl"),
        "programmes": read_jsonl(run / "programmes.jsonl"),
        "sources": read_jsonl(run / "sources.jsonl"),
        "materializations": read_jsonl(run / "external_field_materializations.jsonl"),
        "metadata": read_jsonl(run / "external_programme_metadata.jsonl"),
        "fields": read_jsonl(run / "field_assertions.jsonl"),
        "effective": read_jsonl(run / "effective_field_assertions.jsonl"),
        "errors": read_jsonl(run / "crawl_errors.jsonl"),
        "attempts": read_jsonl(run / "acquisition_attempts.jsonl"),
        "fetches": read_jsonl(run / "source_ecosystem_fetches.jsonl"),
        "raw": read_jsonl(run / "raw_persistence_events.jsonl"),
        "extraction": read_jsonl(run / "extraction_events.jsonl"),
    }


def population() -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    manifest, _, _ = scale.load_population()
    institutions = {str(row["institution_id"]): row for row in manifest.get("institutions", [])}
    programmes = {str(row["programme_id"]): row for row in manifest.get("programmes", [])}
    return manifest, institutions, programmes


def target_for(row: dict[str, Any], institutions: dict[str, Any], programmes: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    institution, programme = scale.entity_target(row, institutions, programmes)
    scope = str(row.get("scope") or "programme")
    target = programme if scope == "programme" else institution
    inst = institutions.get(str(institution)) if institution else None
    prog = programmes.get(str(programme)) if programme else None
    country = str(inst.get("country_code")) if inst and inst.get("country_code") else None
    degree = str(prog.get("degree_level")) if prog and prog.get("degree_level") else None
    return target, country, degree


def source_keys(rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
    return {
        (str(row.get("provider_id") or ""), str(row.get("url") or row.get("source_url") or ""), str(row.get("content_hash") or ""))
        for row in rows
        if row.get("provider_id")
    }


def error_belongs_to_provider(row: dict[str, Any], provider: str) -> bool:
    """Attribute target-level errors without duplicating them to every rule."""
    explicit = row.get("provider_id")
    if explicit:
        return str(explicit) == provider
    url = str(row.get("url") or row.get("source_url") or "").casefold()
    if "ed-public-download.scorecard.network" in url:
        return provider == "college_scorecard_bulk"
    if "swissuniversities.ch" in url:
        return provider == "swissuniversities_tuition"
    if "discoveruni.gov.uk" in url:
        return provider == "discover_uni_hesa"
    if "onderwijsdata.duo.nl" in url:
        return provider == "duo_rio_ho"
    if "api.skolverket.se" in url:
        if "/educationevents/" in url:
            return provider == "susa_navet_event"
        if "/educationinfos/" in url:
            return provider == "susa_navet_info"
        return provider in {"susa_navet_event", "susa_navet_info"}
    if "opintopolku.fi" in url:
        if "/hakukohde/" in url:
            return provider == "studyinfo_hakukohde"
        if "/toteutus/" in url:
            return provider == "studyinfo_toteutus"
        if "/valintaperuste/" in url:
            return provider == "studyinfo_valintaperuste"
    return False


def provider_execution(run: Path, data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    fields = data["effective"] or data["fields"]
    output: dict[str, Any] = {}
    for provider, details in scale.PROVIDERS.items():
        country, expected_scope = details["country"], details["scope"]
        target_institutions = {iid for iid, row in institutions.items() if str(row.get("country_code")) == country}
        target_programmes = {pid for pid, row in programmes.items() if str(institutions.get(str(row.get("institution_id")), {}).get("country_code")) == country}
        target_ids = target_institutions if expected_scope == "institution" else target_programmes
        p_sources = [row for row in data["sources"] if row.get("provider_id") == provider]
        p_materializations = [row for row in data["materializations"] if row.get("provider_id") == provider]
        p_fields = [row for row in fields if row.get("provider_id") == provider]
        p_nonnull = unique_rows((row for row in p_fields if nonempty(row.get("value_json"))))
        p_accepted = unique_rows((row for row in p_fields if accepted(row)))
        p_review = unique_rows((row for row in p_fields if review(row) and not accepted(row)))
        matched_materializations = [row for row in p_materializations if row.get("entity_match")]
        matched_inst = {str(row.get("institution_id")) for row in matched_materializations if row.get("institution_id") in institutions}
        matched_prog = {str(row.get("linked_programme_id")) for row in p_sources if row.get("linked_programme_id") in programmes}
        accepted_targets = {target_for(row, institutions, programmes)[0] for row in p_accepted}
        accepted_targets.discard(None)
        review_targets = {target_for(row, institutions, programmes)[0] for row in p_review}
        review_targets.discard(None)
        p_fetches = [row for row in data["fetches"] if row.get("provider_id") == provider]
        p_attempts = [row for row in data["attempts"] if row.get("provider_id") == provider]
        provider_insts = target_institutions
        p_errors = [
            row
            for row in data["errors"]
            if str(row.get("institution_id")) in provider_insts and error_belongs_to_provider(row, provider)
        ]
        persisted = [row for row in data["raw"] if row.get("provider_id") == provider and row.get("status") == "persisted"]
        persisted_docs = {str(row.get("raw_document_id")) for row in persisted if row.get("raw_document_id")}
        object_rows = [row for row in persisted if row.get("storage") == "object_store"]
        object_bytes = sum(int(row.get("content_length") or 0) for row in object_rows)
        raw_hashes = {str(row.get("content_hash")) for row in persisted if row.get("content_hash")}
        inline_count = sum(1 for row in persisted if row.get("storage") == "mongo_inline")
        if expected_scope == "institution":
            attempted_targets = {
                str(row.get("institution_id"))
                for row in p_sources
                if row.get("institution_id") in target_institutions
            }
            if not attempted_targets:
                attempted_targets = {
                    str(row.get("institution_id"))
                    for row in p_fetches
                    if row.get("institution_id") in target_institutions
                }
        else:
            attempted_targets = {
                str(row.get("linked_programme_id"))
                for row in p_sources
                if row.get("linked_programme_id") in target_programmes
            }
            if not attempted_targets:
                attempted_targets = {
                    str(row.get("linked_programme_id"))
                    for row in p_fetches
                    if row.get("linked_programme_id") in target_programmes
                }
        output[provider] = {
            "country": country,
            "scope": expected_scope,
            "targets_eligible": len(target_ids),
            "targets_attempted": len(attempted_targets),
            "source_rows": len({str(row.get("raw_document_id") or row.get("source_id") or row.get("url")) for row in p_sources}),
            "exact_materialization_matches": len(matched_inst if expected_scope == "institution" else {item for item in matched_prog if item in target_programmes}),
            "exact_materialization_institutions": sorted(matched_inst),
            "exact_source_programmes": sorted(matched_prog),
            "raw_sources_persisted": len(persisted_docs),
            "field_materializations": len({str(row.get("raw_document_id") or row.get("source_url")) for row in matched_materializations}),
            "materialization_rows": len(p_materializations),
            "materialization_match_rows": len(matched_materializations),
            "materialization_reasons": dict(Counter(str(row.get("reason")) for row in p_materializations)),
            "semantic_proposals": len(p_nonnull),
            "accepted_assertions": len(p_accepted),
            "review_assertions": len(p_review),
            "accepted_targets": len(accepted_targets),
            "review_targets": len(review_targets),
            "accepted_by_field": dict(Counter(str(row.get("field_name")) for row in p_accepted)),
            "accepted_by_field_scope": dict(Counter(f"{row.get('field_name')}|{row.get('scope') or 'UNKNOWN'}" for row in p_accepted)),
            "review_by_field": dict(Counter(str(row.get("field_name")) for row in p_review)),
            "fetch_status": dict(Counter(str(row.get("status")) for row in p_fetches)),
            "attempt_status": dict(Counter(str(row.get("status")) for row in p_attempts)),
            "error_count": len(p_errors),
            "errors": dict(Counter(str(row.get("error_code")) for row in p_errors if row.get("error_code"))),
            "http_requests_successful": len(persisted_docs),
            "http_request_failures": sum(1 for row in p_fetches if row.get("status") == "FETCH_FAILED"),
            "downloaded_bytes_recorded": object_bytes,
            "durable_object_bytes": object_bytes,
            "mongo_inline_sources": inline_count,
            "content_hashes": sorted(raw_hashes),
        }
    return output


def accepted_rows(data: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return unique_rows((row for row in (data["effective"] or data["fields"]) if accepted(row)))


def coverage(data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    rows = data["effective"] or data["fields"]
    accepted_rows_ = unique_rows((row for row in rows if accepted(row)))
    review_rows = unique_rows((row for row in rows if review(row) and not accepted(row)))
    slots: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    by_country: dict[tuple[str, str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    for row, bucket in [(item, "accepted") for item in accepted_rows_] + [(item, "review") for item in review_rows]:
        field = str(row.get("field_name"))
        scope = str(row.get("scope") or "programme")
        target, country, _ = target_for(row, institutions, programmes)
        if target:
            slots[(field, scope)][bucket].add(target)
            if country:
                by_country[(field, scope, country)][bucket].add(target)
    metadata_slots: dict[str, set[str]] = defaultdict(set)
    metadata_by_provider: Counter[str] = Counter()
    for row in data["metadata"]:
        if row.get("verification_status") not in {"RULE_VALIDATED", "HUMAN_VERIFIED"} or row.get("promotion") != "catalogue_attribute" or not nonempty(row.get("value")):
            continue
        field = METADATA_ALIASES.get(str(row.get("field_name")), str(row.get("field_name")))
        pid = str(row.get("programme_id") or "")
        if pid in programmes:
            metadata_slots[field].add(pid)
            metadata_by_provider[f"{row.get('provider_id')}|{field}"] += 1
            slots[(field, "programme")]["accepted"].add(pid)
    result: dict[str, Any] = {}
    for field in FIELD_SET:
        scopes: dict[str, Any] = {}
        for scope, target_set in (("programme", set(programmes)), ("institution", set(institutions))):
            a = slots[(field, scope)]["accepted"] & target_set
            r = slots[(field, scope)]["review"] & target_set
            scopes[scope] = {
                "denominator": len(target_set),
                "accepted": len(a),
                "review": len(r - a),
                "missing": len(target_set - a - r),
                "coverage_percent": round(100 * len(a) / len(target_set), 2) if target_set else 0.0,
                "accepted_by_country": {
                    country: len(values["accepted"] & target_set)
                    for (mapped, mapped_scope, country), values in by_country.items()
                    if mapped == field and mapped_scope == scope and values["accepted"] & target_set
                },
                "review_by_country": {
                    country: len(values["review"] & target_set)
                    for (mapped, mapped_scope, country), values in by_country.items()
                    if mapped == field and mapped_scope == scope and values["review"] & target_set
                },
            }
        result[field] = scopes
    return {"fields": result, "accepted_unique_assertions": len(accepted_rows_), "review_unique_assertions": len(review_rows), "metadata_promoted_rows": sum(len(v) for v in metadata_slots.values()), "metadata_by_provider_field": dict(metadata_by_provider)}


def country_summary(data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    rows = data["effective"] or data["fields"]
    accepted_rows_ = unique_rows((row for row in rows if accepted(row)))
    review_rows = unique_rows((row for row in rows if review(row) and not accepted(row)))
    out: dict[str, Any] = {}
    for country in sorted({str(item.get("country_code")) for item in institutions.values()}):
        insts = {iid for iid, item in institutions.items() if str(item.get("country_code")) == country}
        progs = {pid for pid, item in programmes.items() if str(institutions.get(str(item.get("institution_id")), {}).get("country_code")) == country}
        def target_count(rows_: list[dict[str, Any]], scope: str) -> int:
            values = set()
            for row in rows_:
                if str(row.get("scope") or "programme") != scope:
                    continue
                target, row_country, _ = target_for(row, institutions, programmes)
                if row_country != country:
                    continue
                if target:
                    values.add(target)
            return len(values)

        def missing_for_field(field: str, scope: str, target_set: set[str]) -> int:
            accepted_targets: set[str] = set()
            review_targets: set[str] = set()
            for row in accepted_rows_:
                if str(row.get("field_name")) != field or str(row.get("scope") or "programme") != scope:
                    continue
                target, row_country, _ = target_for(row, institutions, programmes)
                if row_country == country and target in target_set:
                    accepted_targets.add(target)
            for row in review_rows:
                if str(row.get("field_name")) != field or str(row.get("scope") or "programme") != scope:
                    continue
                target, row_country, _ = target_for(row, institutions, programmes)
                if row_country == country and target in target_set:
                    review_targets.add(target)
            return len(target_set - accepted_targets - review_targets)

        country_missing = {
            field: missing_for_field(field, "programme", progs) + missing_for_field(field, "institution", insts)
            for field in FIELD_SET
        }
        out[country] = {
            "institutions": len(insts),
            "programmes": len(progs),
            "accepted_programme_target_count": target_count(accepted_rows_, "programme"),
            "review_programme_target_count": target_count(review_rows, "programme"),
            "accepted_institution_target_count": target_count(accepted_rows_, "institution"),
            "review_institution_target_count": target_count(review_rows, "institution"),
            "top_missing_fields": [
                field for field, _ in sorted(country_missing.items(), key=lambda item: (-item[1], item[0]))[:8]
            ],
        }
    return out


def hierarchy(data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    # Import the frozen engine, not an alternate evaluator.
    sys.path.insert(0, str(ROOT.parents[3] / "services" / "data-ingestion" / "src"))
    from glowbal_ingestion.hierarchical_inference import HierarchicalInferenceEngine
    from glowbal_ingestion.models import FieldAssertion
    rows = accepted_rows(data)
    assertions = [FieldAssertion(**row) for row in rows]
    programme_rows = list(programmes.values())
    institution_rows = list(institutions.values())
    engine = HierarchicalInferenceEngine()
    result: dict[str, Any] = {"accepted_external_assertions": len(rows), "fields": {}, "aggregate": Counter()}
    aggregate = Counter()
    for field in sorted({row.field_name for row in assertions}):
        evaluated = engine.evaluate_population(programme_rows, field=field, assertions=assertions, programmes=programme_rows, institutions=institution_rows, recovery_exhausted=True)
        decisions = evaluated["decisions"]
        levels = Counter(decision.get("level") for decision in decisions if decision.get("level") and not decision.get("abstained"))
        candidates = Counter()
        for decision in decisions:
            for candidate in [*decision.get("candidates", []), *decision.get("rejected", [])]:
                if candidate.get("level"):
                    candidates[candidate["level"]] += 1
        direct = sum(decision.get("reason") == "DIRECT_TARGET_AVAILABLE" for decision in decisions)
        item = {
            "target_count": evaluated["target_count"],
            "direct": direct,
            "H1": levels.get("H1_PARENT_ORGANISATION", 0),
            "H2": levels.get("H2_INSTITUTION", 0),
            "H3": levels.get("H3_SIBLING_PROGRAMME", 0),
            "H4": levels.get("H4_PEER_EXTERNAL", 0),
            "candidate_slots": dict(candidates),
            "usable_by_level": dict(levels),
            "applied_by_level": dict(Counter(decision.get("level") for decision in decisions if decision.get("level") and not decision.get("abstained"))),
            "abstentions": sum(bool(decision.get("abstained")) for decision in decisions),
            "abstentions_excluding_direct": sum(bool(decision.get("abstained")) and decision.get("reason") != "DIRECT_TARGET_AVAILABLE" for decision in decisions),
            "support_counts": evaluated.get("support_counts", {}),
            "uncertainty_by_level": evaluated.get("uncertainty_by_level", {}),
            "reasons": dict(Counter(decision.get("reason") for decision in decisions)),
        }
        result["fields"][field] = item
        aggregate.update({"direct": direct, "H1": item["H1"], "H2": item["H2"], "H3": item["H3"], "H4": item["H4"], "abstentions": item["abstentions"]})
    result["aggregate"] = dict(aggregate)
    return result


def concentration(data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = accepted_rows(data)
    for row in data["metadata"]:
        if row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"} and row.get("promotion") == "catalogue_attribute" and nonempty(row.get("value")):
            rows.append({**row, "field_name": METADATA_ALIASES.get(str(row.get("field_name")), str(row.get("field_name"))), "scope": "programme", "value_json": row.get("value")})
    total = len(rows)
    by_provider = Counter(str(row.get("provider_id")) for row in rows)
    by_field = Counter(str(row.get("field_name")) for row in rows)
    by_country = Counter()
    for row in rows:
        _, country, _ = target_for(row, institutions, programmes)
        by_country[country or "UNKNOWN"] += 1
    def shares(counter: Counter) -> dict[str, dict[str, Any]]:
        return {key: {"count": value, "share_percent": round(100 * value / total, 2) if total else 0.0} for key, value in counter.most_common()}
    return {"accepted_evidence_units": total, "by_provider": shares(by_provider), "by_field": shares(by_field), "by_country": shares(by_country)}


def failure_taxonomy(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    errors = data["errors"]
    def classify(code: str, stage: str, message: str = "") -> str:
        text = f"{code} {stage} {message}".casefold()
        if any(token in text for token in ("robots", "403", "access_blocked", "blocked_by_robots")):
            return "ACCESS_BLOCKED"
        if any(token in text for token in ("429", "rate_limit", "throttle")):
            return "RATE_LIMIT"
        if any(token in text for token in ("timeout", "connection", "dns", "502", "503", "504", "5xx")):
            return "NETWORK_TRANSIENT"
        # A documented provider endpoint returning 404 means the exact
        # source-native record is unavailable/stale, not an ingestion code
        # crash.  Keep it in the identity/provider-availability bucket.
        if "404" in text:
            return "IDENTITY_MATCH"
        if any(token in text for token in ("parse", "csv", "json", "format", "unsupported")):
            return "PROVIDER_FORMAT"
        if any(token in text for token in ("identity", "no_external_field_source", "no_matching", "not_found")):
            return "IDENTITY_MATCH"
        if any(token in text for token in ("persist", "mongo", "storage", "object_store")):
            return "PERSISTENCE"
        if any(token in text for token in ("semantic", "extraction")):
            return "SEMANTIC"
        if any(token in text for token in ("validation", "needs_review", "provenance")):
            return "VALIDATION"
        return "CODE_BUG"
    by_type = Counter(classify(str(row.get("error_code")), str(row.get("stage")), str(row.get("message"))) for row in errors)
    by_code = Counter(str(row.get("error_code")) for row in errors if row.get("error_code"))
    return {"by_type": dict(by_type), "by_code": dict(by_code), "raw_errors": errors}


def integrity(run: Path, data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    rows = accepted_rows(data)
    required = ("provider_id", "source_content_hash", "raw_document_id", "source_url", "source_authority", "source_relationship")
    missing = {field: sum(not nonempty(row.get(field)) for row in rows) for field in required}
    raw_local_bytes = sum(path.stat().st_size for path in (run / "raw").rglob("*") if path.is_file()) if (run / "raw").exists() else 0
    bad_scope = sum(1 for row in rows if row.get("scope") not in {"programme", "institution", "department", "school", "faculty", "organisation_unit"})
    invalid_provider = sum(1 for row in rows if row.get("provider_id") not in PROVIDERS)
    return {
        "accepted_rows_checked": len(rows),
        "missing_provenance_by_field": missing,
        "bad_scope_rows": bad_scope,
        "unknown_provider_rows": invalid_provider,
        "raw_local_bytes": raw_local_bytes,
        "max_local_temp_bytes_configured": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("max_local_temp_bytes"),
        "heavy_local_copy_violation": raw_local_bytes > 0,
        "accepted_temporal_by_provider": {
            provider: (
                sorted({str(row.get("academic_cycle")) for row in rows if row.get("provider_id") == provider and row.get("academic_cycle") not in (None, "")})
                + ([None] if any(row.get("provider_id") == provider and row.get("academic_cycle") in (None, "") for row in rows) else [])
            )
            for provider in PROVIDERS
        },
    }


def idempotency(primary: Path, replay: Path, primary_data: dict[str, list[dict[str, Any]]], replay_data: dict[str, list[dict[str, Any]]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    p_raw = {tuple((str(row.get("provider_id") or ""), str(row.get("url") or ""), str(row.get("content_hash") or ""))) for row in primary_data["sources"]}
    r_raw = {tuple((str(row.get("provider_id") or ""), str(row.get("url") or ""), str(row.get("content_hash") or ""))) for row in replay_data["sources"]}
    p_acc = accepted_rows(primary_data)
    r_acc = accepted_rows(replay_data)
    def assertion_key(row: dict[str, Any]) -> tuple[str, str, str, str, str, str]:
        value = json.dumps(row.get("value_json"), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return (str(row.get("entity_type")), str(row.get("entity_id")), str(row.get("field_name")), value, str(row.get("provider_id") or ""), str(row.get("scope") or ""))
    p_keys = Counter(assertion_key(row) for row in p_acc)
    r_keys = Counter(assertion_key(row) for row in r_acc)
    duplicate_effective = {"primary": sum(max(0, count - 1) for count in p_keys.values()), "replay": sum(max(0, count - 1) for count in r_keys.values())}
    def binding_map(rows: list[dict[str, Any]]) -> defaultdict[tuple[str, str, str], set[tuple[str, str]]]:
        bindings: defaultdict[tuple[str, str, str], set[tuple[str, str]]] = defaultdict(set)
        for row in rows:
            key = (str(row.get("provider_id") or ""), str(row.get("url") or ""), str(row.get("content_hash") or ""))
            bindings[key].add((str(row.get("institution_id") or ""), str(row.get("linked_programme_id") or "")))
        return bindings
    p_bindings = binding_map(primary_data["sources"])
    r_bindings = binding_map(replay_data["sources"])
    binding_overlap = set(p_bindings) & set(r_bindings)
    inconsistent_bindings = {
        key: {"primary": sorted(p_bindings[key]), "replay": sorted(r_bindings[key])}
        for key in binding_overlap
        if not r_bindings[key].issubset(p_bindings[key])
    }
    resume_report = read_json(primary / "resume-report.json", {})
    resume_available = bool(
        isinstance(resume_report, dict)
        and resume_report.get("schema_version") == "GlowBalResumeReport/v1"
    )
    if resume_available:
        skipped = len(resume_report.get("skipped_completed_institutions") or [])
        continued = len(resume_report.get("continued_institutions") or [])
        resume_observation = (
            "Production --resume checkpoint path was exercised; "
            f"{skipped} completed institutions were skipped and "
            f"{continued} incomplete institutions continued."
        )
    else:
        resume_observation = (
            "No production resume report exists for this run; replay was "
            "used for safe cross-run idempotency instead of interruption."
        )
    return {
        "primary_run": str(primary),
        "replay_run": str(replay),
        "raw_content_key_overlap": len(p_raw & r_raw),
        "primary_raw_content_keys": len(p_raw),
        "replay_raw_content_keys": len(r_raw),
        "raw_retrieval_replay_is_audit_snapshot": True,
        "effective_assertion_key_overlap": len(set(p_keys) & set(r_keys)),
        "effective_duplicate_keys": duplicate_effective,
        "canonical_product_duplicates": 0,
        "canonical_promotion_performed": False,
        "primary_cache": read_json(primary / "coverage_report.json", {}).get("extraction_provider", {}).get("cache_hits", 0),
        "replay_cache": read_json(replay / "coverage_report.json", {}).get("extraction_provider", {}).get("cache_hits", 0),
        "replay_target_bindings_consistent": not inconsistent_bindings,
        "replay_target_binding_key_overlap": len(binding_overlap),
        "replay_target_binding_inconsistencies": inconsistent_bindings,
        "resume_checkpoint_cli_available": resume_available,
        "resume_checkpoint_observation": resume_observation,
    }


def build(run: Path, replay: Path | None) -> dict[str, Any]:
    manifest, institutions, programmes = population()
    data = run_rows(run)
    metrics = read_json(run / "coverage_report.json", {}).get("metrics", {})
    exec_summary = provider_execution(run, data, institutions, programmes)
    cov = coverage(data, institutions, programmes)
    result: dict[str, Any] = {
        "schema": "GlowBalExternalPreProductionCanary/v1",
        "run": str(run),
        "external_only": True,
        "promotion": "disabled; no product/canonical export invoked",
        "population": {
            "manifest": str(ROOT / "population-manifest.json"),
            "manifest_sha256": (ROOT / "population-manifest.sha256").read_text(encoding="ascii").split()[0],
            "institutions": len(institutions),
            "programmes": len(programmes),
            "countries": sorted({str(row.get("country_code")) for row in institutions.values()}),
            "institutions_by_country": dict(Counter(str(row.get("country_code")) for row in institutions.values())),
            "programmes_by_country": dict(Counter(str(institutions.get(str(row.get("institution_id")), {}).get("country_code")) for row in programmes.values())),
            "degree_levels": dict(Counter(str(row.get("degree_level")) for row in programmes.values())),
            "disciplines": dict(Counter(str(row.get("discipline") or "unknown") for row in programmes.values())),
        },
        "runtime_configuration": {
            "config": str(ROOT / "population-config.json"),
            "raw_evidence_mode": read_json(ROOT / "population-config.json", {}).get("raw_evidence_mode"),
            "max_local_temp_bytes": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("max_local_temp_bytes"),
            "global_concurrency": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("global_concurrency"),
            "institution_concurrency": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("institution_concurrency"),
            "programme_concurrency": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("programme_concurrency_per_institution"),
            "per_domain_concurrency": read_json(ROOT / "population-config.json", {}).get("limits", {}).get("per_domain_concurrency"),
            "promotion": "not run",
        },
        "provider_execution": exec_summary,
        "coverage": cov,
        "country_summary": country_summary(data, institutions, programmes),
        "accepted_external": {
            "semantic_assertions": cov["accepted_unique_assertions"],
            "accepted_by_provider": dict(Counter(str(row.get("provider_id")) for row in accepted_rows(data))),
            "accepted_by_field": dict(Counter(str(row.get("field_name")) for row in accepted_rows(data))),
            "accepted_by_scope": dict(Counter(str(row.get("scope") or "UNKNOWN") for row in accepted_rows(data))),
            "promoted_metadata_rows": cov["metadata_promoted_rows"],
        },
        "hierarchy": hierarchy(data, institutions, programmes),
        "concentration": concentration(data, institutions, programmes),
        "failure_taxonomy": failure_taxonomy(data),
        "resource_usage": {
            "runtime_seconds": metrics.get("elapsed_seconds"),
            "http_requests_successful": sum(item["http_requests_successful"] for item in exec_summary.values()),
            "http_request_failures": sum(item["http_request_failures"] for item in exec_summary.values()),
            "downloaded_bytes_recorded": sum(item["downloaded_bytes_recorded"] for item in exec_summary.values()),
            "durable_object_bytes": sum(item["durable_object_bytes"] for item in exec_summary.values()),
            "mongo_inline_sources": sum(item["mongo_inline_sources"] for item in exec_summary.values()),
            "llm_calls": read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("calls", 0),
            "llm_failures": read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("failures", 0),
            "llm_max_in_flight": read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("max_in_flight", 0),
            "cache_hits": read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("cache_hits", 0),
            "cache_misses": max(0, read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("logical_requests", 0) - read_json(run / "coverage_report.json", {}).get("extraction_provider", {}).get("cache_hits", 0)),
            "object_store_bytes_written": sum(item["durable_object_bytes"] for item in exec_summary.values()),
            "raw_sources_persisted": sum(item["raw_sources_persisted"] for item in exec_summary.values()),
            "materialisations": sum(item["field_materializations"] for item in exec_summary.values()),
            "local_raw_bytes": integrity(run, data)["raw_local_bytes"],
            "provider_stats": read_json(run / "coverage_report.json", {}).get("extraction_provider", {}),
        },
        "integrity": integrity(run, data),
    }
    if replay is not None:
        replay_data = run_rows(replay)
        result["replay"] = {
            "run": str(replay),
            "metrics": read_json(replay / "coverage_report.json", {}).get("metrics", {}),
            "provider_execution": provider_execution(replay, replay_data, institutions, programmes),
            "accepted_external": {
                "semantic_assertions": len(accepted_rows(replay_data)),
                "accepted_by_provider": dict(Counter(str(row.get("provider_id")) for row in accepted_rows(replay_data))),
                "accepted_by_field": dict(Counter(str(row.get("field_name")) for row in accepted_rows(replay_data))),
            },
            "integrity": integrity(replay, replay_data),
        }
        result["idempotency_cache"] = idempotency(run, replay, data, replay_data, institutions, programmes)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, default=RUNS / "primary-20260914")
    parser.add_argument("--replay", type=Path, default=RUNS / "replay-20260914")
    parser.add_argument("--out", type=Path, default=ROOT / "canary-metrics.json")
    args = parser.parse_args()
    report = build(args.run.resolve(), args.replay.resolve() if args.replay.exists() else None)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
