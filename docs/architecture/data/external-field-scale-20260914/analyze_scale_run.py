"""Measure the frozen external-provider scale run.

This is an artifact-only analysis.  It reads the durable run products and does
not change acquisition, resolution, acceptance, or hierarchy behavior.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
DEFAULT_RUN = ROOT / "runs" / "external-field-scale-20260914a"
MANIFEST = ROOT / "population-manifest.json"
CONFIG = ROOT / "population-config.json"

PROVIDERS = {
    "college_scorecard_bulk": {"country": "US", "scope": "institution"},
    "swissuniversities_tuition": {"country": "CH", "scope": "institution"},
    "onisep_higher_ed": {"country": "FR", "scope": "programme"},
    "discover_uni_hesa": {"country": "UK", "scope": "programme"},
    "duo_rio_ho": {"country": "NL", "scope": "programme"},
}

METADATA_FIELD_MAP = {
    "campus": "location",
    "location": "location",
    "delivery_mode": "delivery_mode",
    "duration": "duration",
    "programme_status": "programme_status",
    "language": "programme_language",
    "programme_language": "programme_language",
    "academic_cycle": "academic_cycle",
    "programme_start_date": "programme_start_date",
    "offering_start_date": "offering_start_date",
    "study_load": "study_load",
    "qualification_level": "qualification_level",
}


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def unique_rows(rows: Iterable[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        value = row.get(key)
        if value is not None:
            result[str(value)] = row
    return list(result.values())


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
        row.get("verification_status") == "NEEDS_REVIEW"
        or bool(row.get("validation_errors"))
    )


def load_population() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    manifest = read_json(MANIFEST, {})
    config = read_json(CONFIG, {})
    institutions = {str(row["institution_id"]): row for row in manifest.get("institutions", [])}
    programmes = {str(row["programme_id"]): row for row in manifest.get("programmes", [])}
    # The frozen manifest intentionally stores programmes as a flat list.  The
    # config's manual URL lists are the declarative parent relation; restore it
    # here for measurement without changing the manifest.
    by_url = {str(row.get("official_url")): row for row in manifest.get("programmes", [])}
    for institution in config.get("institutions", []):
        for url in institution.get("manual_programme_urls", []):
            programme = by_url.get(str(url))
            if programme:
                programmes[str(programme["programme_id"])] = {
                    **programmes[str(programme["programme_id"])],
                    "institution_id": str(institution["institution_id"]),
                }
    # Manifest programme records carry the stable target relation; config is
    # retained for the declarative provider identifier audit.
    return manifest, institutions, programmes


def entity_target(row: dict[str, Any], institutions: dict[str, Any], programmes: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return (institution_id, programme_id) for an assertion row."""
    raw_entity = row.get("entity_id")
    if raw_entity is None:
        raw_entity = row.get("programme_id") or row.get("institution_id")
    entity_id = str(raw_entity) if raw_entity is not None else None
    scope = row.get("scope")
    if scope == "institution" or row.get("entity_type") == "institution":
        if entity_id in institutions:
            return entity_id, None
        programme = programmes.get(entity_id or "")
        return (str(programme["institution_id"]) if programme else None), None
    if entity_id in programmes:
        programme = programmes[entity_id]
        return str(programme["institution_id"]), entity_id
    # Deterministic metadata rows carry an explicit institution relation even
    # when a correction replay used a canonicalized programme ID that is not
    # present in the original frozen manifest.
    institution_id = row.get("institution_id")
    if institution_id is not None and str(institution_id) in institutions:
        return str(institution_id), entity_id
    if entity_id in institutions:
        return entity_id, None
    return None, None


def target_dimensions(
    row: dict[str, Any],
    institutions: dict[str, Any],
    programmes: dict[str, Any],
) -> tuple[str | None, str | None, str | None]:
    """Return (target id, country, degree level) for a materialised row."""
    institution_id, programme_id = entity_target(row, institutions, programmes)
    institution = institutions.get(str(institution_id)) if institution_id else None
    programme = programmes.get(str(programme_id)) if programme_id else None
    target = programme_id if str(row.get("scope") or "") == "programme" else institution_id
    country = str(institution.get("country_code")) if institution and institution.get("country_code") else None
    degree = str(programme.get("degree_level")) if programme and programme.get("degree_level") else None
    return (str(target) if target else None), country, degree


def source_target_sets(run: Path, institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, dict[str, set[str]]]:
    """Collect persisted/materialised source targets without counting duplicates."""
    out: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for row in read_jsonl(run / "external_field_materializations.jsonl"):
        if not row.get("entity_match"):
            continue
        provider = row.get("provider_id")
        institution = row.get("institution_id")
        if provider and institution:
            out[str(provider)]["institution"].add(str(institution))
    for row in read_jsonl(run / "sources.jsonl"):
        provider = row.get("provider_id")
        if not provider:
            continue
        institution = row.get("institution_id")
        programme = row.get("linked_programme_id")
        if programme and programme in programmes:
            out[str(provider)]["programme"].add(str(programme))
        elif institution and institution in institutions:
            out[str(provider)]["institution"].add(str(institution))
    return out


def persisted_by_provider(run: Path) -> dict[str, int]:
    rows = [row for row in read_jsonl(run / "raw_persistence_events.jsonl") if row.get("status") == "persisted"]
    grouped: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        provider = row.get("provider_id")
        document = row.get("raw_document_id") or row.get("document_id")
        if provider and document:
            grouped[str(provider)].add(str(document))
    return {provider: len(ids) for provider, ids in sorted(grouped.items())}


def materialization_by_provider(run: Path) -> dict[str, int]:
    grouped: dict[str, set[str]] = defaultdict(set)
    for row in read_jsonl(run / "external_field_materializations.jsonl"):
        provider = row.get("provider_id")
        materialization_key = row.get("raw_document_id") or row.get("source_url")
        if provider and materialization_key:
            grouped[str(provider)].add(str(materialization_key))
    return {provider: len(ids) for provider, ids in sorted(grouped.items())}


def semantic_rows(run: Path) -> list[dict[str, Any]]:
    rows = read_jsonl(run / "effective_field_assertions.jsonl")
    if not rows:
        rows = read_jsonl(run / "field_assertions.jsonl")
    return [row for row in rows if row.get("provider_id")]


def target_counts(
    manifest: dict[str, Any],
    institutions: dict[str, Any],
    programmes: dict[str, Any],
    population_programmes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    institutions = manifest.get("institutions", [])
    manifest_institutions = institutions
    # The frozen manifest is authoritative for population composition.  The
    # run may contain canonicalized runtime programme IDs, so retain the
    # parent-linked population map captured before runtime rows replace it.
    manifest_programmes = list((population_programmes or programmes).values())
    return {
        "institutions": len(manifest_institutions),
        "programmes": len(manifest_programmes),
        "countries": len({row.get("country_code") for row in manifest_institutions}),
        "country_counts": dict(Counter(row.get("country_code") for row in manifest_institutions)),
        "degree_levels": dict(Counter(row.get("degree_level") for row in manifest_programmes)),
        "disciplines": dict(Counter(row.get("discipline") or row.get("normalized_field") for row in manifest_programmes)),
        "programmes_by_country": dict(Counter(
            str(next((i.get("country_code") for i in manifest_institutions if i.get("institution_id") == p.get("institution_id")), "UNKNOWN"))
            for p in manifest_programmes
        )),
    }


def field_slot_counts(
    run: Path,
    institutions: dict[str, Any],
    programmes: dict[str, Any],
    provider_targets: dict[str, dict[str, set[str]]],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    rows = semantic_rows(run)
    accepted_rows = unique_rows((row for row in rows if accepted(row)), "assertion_id")
    review_rows = unique_rows((row for row in rows if review(row) and not accepted(row)), "assertion_id")
    by_field_scope: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    by_provider_field_scope: dict[tuple[str, str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    by_country_field_scope: dict[tuple[str, str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    by_degree_field_scope: dict[tuple[str, str, str], dict[str, set[str]]] = defaultdict(lambda: {"accepted": set(), "review": set()})
    for row, bucket in [(row, "accepted") for row in accepted_rows] + [(row, "review") for row in review_rows]:
        field = str(row.get("field_name"))
        scope = str(row.get("scope") or "UNKNOWN")
        institution, programme = entity_target(row, institutions, programmes)
        target = programme if scope == "programme" else institution
        if target:
            by_field_scope[(field, scope)][bucket].add(target)
            _, country, degree = target_dimensions(row, institutions, programmes)
            if country:
                by_country_field_scope[(field, scope, country)][bucket].add(target)
            if degree:
                by_degree_field_scope[(field, scope, degree)][bucket].add(target)
        provider = row.get("provider_id")
        if provider and target:
            by_provider_field_scope[(str(provider), field, scope)][bucket].add(target)

    config = read_json(CONFIG, {})
    fields = list(config.get("source_ecosystem", {}).get("field_groups", []))
    # Keep measurement field names stable even when a provider's metadata
    # adapter emits a product alias (e.g. Discover's campus -> location).
    fields += ["duration", "location", "delivery_mode", "programme_language", "programme_status"]
    fields = list(dict.fromkeys(fields))
    coverage: dict[str, Any] = {}
    provider_country = {provider: details["country"] for provider, details in PROVIDERS.items()}
    country_to_institutions: dict[str, set[str]] = defaultdict(set)
    country_to_programmes: dict[str, set[str]] = defaultdict(set)
    for iid, inst in institutions.items():
        country_to_institutions[str(inst.get("country_code"))].add(iid)
    for pid, prog in programmes.items():
        inst = institutions.get(str(prog.get("institution_id")))
        country_to_programmes[str(inst.get("country_code")) if inst else "UNKNOWN"].add(pid)

    # Exact source/materialisation evidence is used only to distinguish a
    # source/matching failure from a source that simply lacks a field.
    errors = read_jsonl(run / "crawl_errors.jsonl")
    error_by_inst = defaultdict(Counter)
    for row in errors:
        error_by_inst[str(row.get("institution_id"))][str(row.get("error_code"))] += 1
    materialized = provider_targets
    for field in fields:
        scopes: dict[str, Any] = {}
        for scope, denominator, target_ids in (
            ("programme", len(programmes), set(programmes)),
            ("institution", len(institutions), set(institutions)),
        ):
            key = (field, scope)
            accepted_ids = by_field_scope[key]["accepted"]
            review_ids = by_field_scope[key]["review"]
            counts = Counter()
            for target in target_ids:
                if target in accepted_ids:
                    counts["ACCEPTED_EXTERNAL"] += 1
                elif target in review_ids:
                    counts["REVIEW_EXTERNAL"] += 1
                else:
                    # Find the applicable provider for this target.  A source
                    # was materialised for the institution/programme when the
                    # provider target set contains it; otherwise use run errors
                    # to retain a useful failure state.
                    if scope == "institution":
                        inst = institutions[target]
                        country = str(inst.get("country_code"))
                    else:
                        prog = programmes[target]
                        inst = institutions.get(str(prog.get("institution_id")), {})
                        country = str(inst.get("country_code"))
                    provider = next((p for p, c in provider_country.items() if c == country and PROVIDERS[p]["scope"] == scope), None)
                    if provider is None:
                        counts["NO_PROVIDER_FOR_COUNTRY"] += 1
                    else:
                        source_targets = materialized.get(provider, {}).get(scope, set())
                        if target in source_targets:
                            counts["SOURCE_MISSING_FIELD"] += 1
                        else:
                            # Programme sources are materialised on the
                            # institution row for some providers (Onisep/DUO
                            # failures are therefore still represented by the
                            # exact institution error); preserve that fact.
                            if scope == "programme":
                                inst_errors = error_by_inst.get(str(inst.get("institution_id")), Counter())
                            else:
                                inst_errors = error_by_inst.get(target, Counter())
                            if inst_errors:
                                counts["SOURCE_FOUND_NO_SAFE_MATCH"] += 1
                            else:
                                counts["NO_VERIFIED_SCALABLE_SOURCE"] += 1
            scopes[scope] = {
                "denominator": denominator,
                "accepted": counts.get("ACCEPTED_EXTERNAL", 0),
                "review": counts.get("REVIEW_EXTERNAL", 0),
                "missing": denominator - counts.get("ACCEPTED_EXTERNAL", 0) - counts.get("REVIEW_EXTERNAL", 0),
                "coverage_percent": round(100.0 * counts.get("ACCEPTED_EXTERNAL", 0) / denominator, 2) if denominator else 0.0,
                "state_counts": dict(counts),
                "accepted_by_country": {
                    country: len(values["accepted"])
                    for (mapped_field, mapped_scope, country), values in sorted(by_country_field_scope.items())
                    if mapped_field == field and mapped_scope == scope and values["accepted"]
                },
                "review_by_country": {
                    country: len(values["review"])
                    for (mapped_field, mapped_scope, country), values in sorted(by_country_field_scope.items())
                    if mapped_field == field and mapped_scope == scope and values["review"]
                },
                "accepted_by_degree_level": {
                    degree: len(values["accepted"])
                    for (mapped_field, mapped_scope, degree), values in sorted(by_degree_field_scope.items())
                    if mapped_field == field and mapped_scope == scope and values["accepted"]
                },
                "review_by_degree_level": {
                    degree: len(values["review"])
                    for (mapped_field, mapped_scope, degree), values in sorted(by_degree_field_scope.items())
                    if mapped_field == field and mapped_scope == scope and values["review"]
                },
            }
        coverage[field] = scopes

    # Deterministic promoted metadata is stored separately from semantic
    # assertions.  Normalize its field aliases for product reporting.
    metadata_rows = read_jsonl(run / "external_programme_metadata.jsonl")
    metadata_accepted = [
        row
        for row in metadata_rows
        if row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("promotion") == "catalogue_attribute"
        and nonempty(row.get("value"))
    ]
    metadata_context = [
        row
        for row in metadata_rows
        if row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("promotion") == "context_only"
        and nonempty(row.get("value"))
    ]
    metadata_sets: dict[str, set[str]] = defaultdict(set)
    metadata_provider_sets: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in metadata_accepted:
        field = METADATA_FIELD_MAP.get(str(row.get("field_name")), str(row.get("field_name")))
        programme_id = row.get("programme_id")
        if programme_id in programmes:
            metadata_sets[field].add(str(programme_id))
            metadata_provider_sets[(str(row.get("provider_id")), field)].add(str(programme_id))
            _, country, degree = target_dimensions(
                {**row, "scope": "programme"}, institutions, programmes
            )
            if country:
                by_country_field_scope[(field, "programme", country)]["accepted"].add(str(programme_id))
            if degree:
                by_degree_field_scope[(field, "programme", degree)]["accepted"].add(str(programme_id))
    for field, ids in metadata_sets.items():
        coverage.setdefault(field, {})["programme"] = {
            "denominator": len(programmes),
            "accepted": len(ids),
            "review": 0,
            "missing": len(programmes) - len(ids),
            "coverage_percent": round(100.0 * len(ids) / len(programmes), 2) if programmes else 0.0,
            "state_counts": {"ACCEPTED_EXTERNAL": len(ids), "SOURCE_MISSING_FIELD": len(programmes) - len(ids)},
            "accepted_by_country": {
                country: len(values["accepted"])
                for (mapped_field, mapped_scope, country), values in sorted(by_country_field_scope.items())
                if mapped_field == field and mapped_scope == "programme" and values["accepted"]
            },
            "review_by_country": {},
            "accepted_by_degree_level": {
                degree: len(values["accepted"])
                for (mapped_field, mapped_scope, degree), values in sorted(by_degree_field_scope.items())
                if mapped_field == field and mapped_scope == "programme" and values["accepted"]
            },
            "review_by_degree_level": {},
            "metadata_provider_counts": {
                provider: len(values)
                for (provider, mapped), values in metadata_provider_sets.items()
                if mapped == field
            },
        }
    return coverage, {
        "accepted_rows": len(accepted_rows),
        "accepted_unique_assertions": len(accepted_rows),
        "review_unique_assertions": len(review_rows),
        "accepted_by_provider_field_scope": {
            f"{provider}|{field}|{scope}": len(values["accepted"])
            for (provider, field, scope), values in sorted(by_provider_field_scope.items())
            if values["accepted"]
        },
        "review_by_provider_field_scope": {
            f"{provider}|{field}|{scope}": len(values["review"])
            for (provider, field, scope), values in sorted(by_provider_field_scope.items())
            if values["review"]
        },
        "accepted_by_country_field_scope": {
            f"{field}|{scope}|{country}": len(values["accepted"])
            for (field, scope, country), values in sorted(by_country_field_scope.items())
            if values["accepted"]
        },
        "review_by_country_field_scope": {
            f"{field}|{scope}|{country}": len(values["review"])
            for (field, scope, country), values in sorted(by_country_field_scope.items())
            if values["review"]
        },
        "accepted_by_degree_level_field_scope": {
            f"{field}|{scope}|{degree}": len(values["accepted"])
            for (field, scope, degree), values in sorted(by_degree_field_scope.items())
            if values["accepted"]
        },
        "metadata_accepted_by_provider_field_scope": {
            f"{provider}|{field}|programme": len(values)
            for (provider, field), values in sorted(metadata_provider_sets.items())
        },
        "accepted_evidence_by_scope": {
            "institution": sum(
                1 for row in accepted_rows if str(row.get("scope") or "UNKNOWN") == "institution"
            ),
            "programme": sum(
                1 for row in accepted_rows if str(row.get("scope") or "UNKNOWN") == "programme"
            ) + len(metadata_accepted),
        },
        "metadata_promoted_rows": len(metadata_accepted),
        "metadata_promoted_by_provider_field": {
            f"{provider}|{field}": len(values)
            for (provider, field), values in sorted(metadata_provider_sets.items())
        },
        "metadata_context_rows": len(metadata_context),
        "metadata_context_by_provider_field": dict(
            Counter(
                f"{row.get('provider_id')}|{row.get('field_name')}"
                for row in metadata_context
            )
        ),
    }, metadata_sets


def provider_execution(run: Path, institutions: dict[str, Any], programmes: dict[str, Any], provider_targets: dict[str, dict[str, set[str]]]) -> dict[str, Any]:
    candidates = read_jsonl(run / "source_candidates.jsonl")
    admissions = read_jsonl(run / "source_admission_decisions.jsonl")
    fetches = read_jsonl(run / "source_ecosystem_fetches.jsonl")
    attempts = read_jsonl(run / "acquisition_attempts.jsonl")
    errors = read_jsonl(run / "crawl_errors.jsonl")
    materializations = read_jsonl(run / "external_field_materializations.jsonl")
    sources = read_jsonl(run / "sources.jsonl")
    semantic = semantic_rows(run)
    result: dict[str, Any] = {}
    for provider, details in PROVIDERS.items():
        country, scope = details["country"], details["scope"]
        target_insts = {iid for iid, row in institutions.items() if str(row.get("country_code")) == country}
        target_programmes = {pid for pid, row in programmes.items() if str(institutions.get(str(row.get("institution_id")), {}).get("country_code")) == country}
        target_count = len(target_insts if scope == "institution" else target_programmes)
        p_candidates = [r for r in candidates if r.get("provider_id") == provider]
        p_fetches = [r for r in fetches if r.get("provider_id") == provider]
        p_attempts = [r for r in attempts if r.get("provider_id") == provider]
        p_errors = [r for r in errors if r.get("provider_id") == provider]
        # Crawl errors do not always carry provider_id; map by URL/institution
        # where the run has a single provider for that country.
        p_errors += [
            r for r in errors
            if not r.get("provider_id")
            and str(r.get("institution_id")) in (target_insts | {str(institutions.get(str(programmes.get(pid, {}).get("institution_id")), {}).get("institution_id")) for pid in target_programmes})
            and r not in p_errors
        ]
        p_semantic = [r for r in semantic if r.get("provider_id") == provider]
        p_accepted = unique_rows((r for r in p_semantic if accepted(r)), "assertion_id")
        p_review = unique_rows((r for r in p_semantic if review(r) and not accepted(r)), "assertion_id")
        source_ids = set()
        for row in sources:
            if row.get("provider_id") == provider:
                source_ids.add(str(row.get("raw_document_id") or row.get("source_id") or row.get("url")))
        mat_ids = set()
        exact_insts: set[str] = set()
        exact_programmes: set[str] = set()
        for row in materializations:
            if row.get("provider_id") != provider:
                continue
            key = str(row.get("raw_document_id") or row.get("source_url"))
            mat_ids.add(key)
            if row.get("entity_match"):
                if row.get("institution_id") in institutions:
                    exact_insts.add(str(row["institution_id"]))
        for row in sources:
            if row.get("provider_id") == provider and row.get("linked_programme_id") in programmes:
                exact_programmes.add(str(row["linked_programme_id"]))
        error_counts = Counter(str(r.get("error_code")) for r in p_errors if r.get("error_code"))
        fetch_status = Counter(str(r.get("status")) for r in p_fetches if r.get("status"))
        attempt_status = Counter(str(r.get("status")) for r in p_attempts if r.get("status"))
        field_counts = Counter(str(r.get("field_name")) for r in p_accepted)
        scope_counts = Counter(str(r.get("scope") or "UNKNOWN") for r in p_accepted)
        # A consolidated scale view may contain historical failures from the
        # original run alongside a targeted correction replay.  If every
        # applicable target now has a durable source/materialisation and
        # semantic evidence, classify the transient read/no-source records as
        # repaired while retaining their counts in ``errors`` for audit.
        correction_ready = (
            len(exact_insts if scope == "institution" else exact_programmes) == target_count
            and len(source_ids) >= target_count
            and len(mat_ids) >= target_count
            and bool(p_semantic)
        )
        correction_codes = {
            code: count
            for code, count in error_counts.items()
            if code in {
                "STREAMING_PARSE_FAILED",
                "RAW_STREAM_READ_FAILED",
                "NO_EXTERNAL_FIELD_SOURCE",
            }
        } if correction_ready else {}
        unresolved_errors = Counter(error_counts)
        for code in correction_codes:
            unresolved_errors.pop(code, None)
        result[provider] = {
            "country": country,
            "scope": scope,
            "targets_attempted": target_count,
            "target_institutions": len(target_insts),
            "target_programmes": len(target_programmes),
            "exact_institution_matches": sorted(exact_insts),
            "exact_programme_matches": sorted(exact_programmes),
            "exact_match_count": len(exact_insts if scope == "institution" else exact_programmes),
            "candidate_rows": len(p_candidates),
            "fetch_rows": len(p_fetches),
            "fetch_status": dict(fetch_status),
            "raw_sources_persisted": persisted_by_provider(run).get(provider, 0),
            "source_rows": len(source_ids),
            "materializations": len(mat_ids),
            "semantic_proposals": len(unique_rows((r for r in p_semantic if nonempty(r.get("value_json"))), "assertion_id")),
            "accepted_assertions": len(p_accepted),
            "accepted_by_field": dict(field_counts),
            "accepted_by_scope": dict(scope_counts),
            "review_assertions": len(p_review),
            "review_by_field": dict(Counter(str(r.get("field_name")) for r in p_review)),
            "attempt_status": dict(attempt_status),
            "errors": dict(error_counts),
            "unresolved_errors": dict(unresolved_errors),
            "resolved_by_correction": correction_codes,
        }
    return result


def concentration(accepted_rows: list[dict[str, Any]], metadata_rows: list[dict[str, Any]], institutions: dict[str, Any], programmes: dict[str, Any]) -> dict[str, Any]:
    rows = [("semantic", row) for row in accepted_rows] + [("metadata", row) for row in metadata_rows]
    by_provider = Counter(str(row.get("provider_id")) for _, row in rows)
    by_field = Counter(
        METADATA_FIELD_MAP.get(str(row.get("field_name")), str(row.get("field_name")))
        if kind == "metadata"
        else str(row.get("field_name"))
        for kind, row in rows
    )
    by_country = Counter()
    for _, row in rows:
        institution, programme = entity_target(row, institutions, programmes)
        target = institutions.get(institution or "")
        if not target and programme:
            target = institutions.get(str(programmes[programme].get("institution_id")))
        by_country[str(target.get("country_code")) if target else "UNKNOWN"] += 1
    total = len(rows)
    def shares(counter: Counter) -> dict[str, Any]:
        return {key: {"count": value, "share_percent": round(100.0 * value / total, 2) if total else 0.0} for key, value in counter.most_common()}
    return {"accepted_evidence_units": total, "by_provider": shares(by_provider), "by_field": shares(by_field), "by_country": shares(by_country)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, default=DEFAULT_RUN)
    parser.add_argument("--out", type=Path, default=ROOT / "coverage-summary.json")
    args = parser.parse_args()
    manifest, institutions, programmes = load_population()
    population_programmes = dict(programmes)
    run = args.run.resolve()
    # Use the completed run's programme records for target matching.  The
    # frozen manifest remains the population authority, but URL
    # canonicalization can legitimately give a runtime programme a different
    # stable ID (the DUO correction replay is the measured example).
    run_programmes = read_jsonl(run / "programmes.jsonl")
    if run_programmes:
        programmes = {str(row["programme_id"]): row for row in run_programmes if row.get("programme_id")}
    run_institutions = read_jsonl(run / "institutions.jsonl")
    if run_institutions:
        institutions = {str(row["institution_id"]): row for row in run_institutions if row.get("institution_id")}
    provider_targets = source_target_sets(run, institutions, programmes)
    coverage, assertion_summary, metadata_sets = field_slot_counts(run, institutions, programmes, provider_targets)
    semantic = semantic_rows(run)
    accepted_rows = unique_rows((row for row in semantic if accepted(row)), "assertion_id")
    metadata_rows = [
        row
        for row in read_jsonl(run / "external_programme_metadata.jsonl")
        if row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("promotion") == "catalogue_attribute"
        and nonempty(row.get("value"))
    ]
    report = {
        "schema": "ExternalFieldScaleMeasurement/v1",
        "run": str(run),
        "external_only": True,
        "population": target_counts(manifest, institutions, programmes, population_programmes),
        "provider_execution": provider_execution(run, institutions, programmes, provider_targets),
        "accepted_external": {
            **assertion_summary,
            "total_semantic_unique_assertions": len(accepted_rows),
            "total_promoted_metadata_rows": len(metadata_rows),
        },
        "field_coverage": coverage,
        "concentration": concentration(accepted_rows, metadata_rows, institutions, programmes),
        "failure_patterns": {
            "crawl_error_codes": dict(Counter(str(row.get("error_code")) for row in read_jsonl(run / "crawl_errors.jsonl") if row.get("error_code"))),
            "resolved_by_targeted_correction": {
                provider: details.get("resolved_by_correction", {})
                for provider, details in provider_execution(run, institutions, programmes, provider_targets).items()
                if details.get("resolved_by_correction")
            },
            "fetch_failure_reasons": dict(Counter(str(row.get("admission_reason")) for row in read_jsonl(run / "source_ecosystem_fetches.jsonl") if row.get("status") == "FETCH_FAILED")),
            "extraction_failures": read_json(run / "coverage_report.json", {}).get("metrics", {}).get("provider_stats", {}).get("failure_details", []),
        },
        "temporal_representations": {
            "college_scorecard_bulk": {"dataset": "Most-Recent-Cohorts-Institution.csv", "academic_cycle": None, "temporal_state": "UNKNOWN", "note": "source exposes a most-recent-cohorts snapshot; no academic cycle/reporting-year column was present in the materialised row"},
            "swissuniversities_tuition": {"academic_cycle": "2026-2027", "basis": "per semester", "currency": "CHF", "scope": "institution"},
            "discover_uni_hesa": {"academic_cycle": None, "outcome_periods": ["2021-23", "15 months after the course"], "scope": "programme"},
            "onisep_higher_ed": {
                "academic_cycle": None,
                "temporal_state": "UNKNOWN",
                "source_native_context": [
                    "AF date de modification (dataset record update date)",
                ],
                "scope": "programme",
                "note": "Onisep exposes a record modification date, not an academic cycle; no academic cycle is invented",
            },
            "duo_rio_ho": {
                "academic_cycle": None,
                "scope": "programme",
                "source_native_context": [
                    "BEGINDATUM (programme start date)",
                    "AANGEBODEN_OPLEIDING_BEGINDATUM (offering start date)",
                    "STUDIELAST (study load/ECTS-like registry value)",
                    "NIVEAU (qualification level)",
                ],
                "note": "dates, study load, and qualification level are preserved as registry context; no academic cycle is invented",
            },
        },
        "notes": [
            "Counts use effective_field_assertions and deduplicate assertion_id; null runtime slots are not evidence.",
            "Promoted deterministic metadata is reported separately because it is not a FieldAssertion.",
            "Official web/catalogue/PDF paths were disabled in the frozen external-only configuration.",
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
