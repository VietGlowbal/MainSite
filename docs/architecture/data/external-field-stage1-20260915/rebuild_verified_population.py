"""Rebuild the Stage 1 production denominator from verified programme bindings.

This is an artifact-only replay.  It does not fetch providers, call a semantic
model, or mutate Mongo/object storage.  The frozen Stage 1 run remains the
source of accepted assertions; this module only repairs the target identity
map, excludes institution-only/synthetic seeds, replays the existing H1-H4
engine, and writes reviewable production artifacts.
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from dataclasses import replace
from pathlib import Path
from typing import Any, Mapping


ARTIFACT_DIR = Path(__file__).resolve().parent
RUN_DIR = ARTIFACT_DIR / "runs" / "stage1-20260915-main"
MANIFEST_PATH = ARTIFACT_DIR / "stage1-population-manifest.json"
REPLAY_DIR = ARTIFACT_DIR / "production-replay-20260916"
SRC_DIR = Path(__file__).resolve().parents[4] / "services" / "data-ingestion" / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from glowbal_ingestion.models import (  # noqa: E402
    ProgrammePopulationClassification,
    ProgrammeRecord,
)
from glowbal_ingestion.url_safety import canonicalize_url  # noqa: E402
from glowbal_ingestion.validation import classify_programme_population  # noqa: E402

import generate_hierarchy_reports as hierarchy_reports  # noqa: E402


LEAD_COLUMNS = (
    "institution_name",
    "programme_name",
    "country",
    "degree_level",
    "discipline",
    "institution_id",
    "programme_id",
    "programme_identity",
    "credential",
    "duration",
    "location",
    "delivery_mode",
    "programme_language",
    "programme_status",
    "academic_cycle",
    "tuition",
    "tuition_scope",
    "additional_fees",
    "additional_fees_scope",
    "mandatory_fees",
    "application_fee",
    "scholarship",
    "scholarship_amount",
    "funding",
    "funding_amount",
    "funding_eligibility",
    "funding_deadline",
    "ielts_overall",
    "ielts_subscores",
    "toefl",
    "duolingo",
    "standardized_test_requirements",
    "intakes",
    "final_deadline",
    "priority_deadline",
    "international_deadline",
    "rolling_admission",
    "application_url",
    "minimum_degree",
    "minimum_gpa",
    "gpa_scale",
    "subject_prerequisites",
    "required_documents",
    "recommendation_letters",
    "sop_or_essay",
    "portfolio",
    "work_experience",
    "career_outcomes",
    "employment_outcomes",
    "direct_field_count",
    "hierarchical_added_field_count",
    "effective_field_count",
    "missing_field_count",
    "effective_completion_pct",
    "final_source_count",
    "hierarchical_field_count",
)

AUDIT_COLUMNS = (
    "institution_name",
    "original_programme_name",
    "institution_id",
    "programme_id",
    "country",
    "provider",
    "classification",
    "verified_programme_name",
    "provider_native_programme_id",
    "reason",
    "binding_evidence",
    "action",
)

PROVIDER_BY_DOMAIN = {
    "ed-public-download.scorecard.network": "College Scorecard",
    "www.swissuniversities.ch": "swissuniversities",
    "api.opendata.onisep.fr": "Onisep Idéo",
    "discoveruni.gov.uk": "Discover Uni",
    "onderwijsdata.duo.nl": "DUO RIO",
    "susa-navet.skolverket.se": "Susa-navet",
    "api.skolverket.se": "Susa-navet",
    "opintopolku.fi": "Studyinfo / Opintopolku",
}

FIELD_ALIASES = {
    "standardized_tests": "standardized_test_requirements",
    "sop_essay_requirements": "sop_or_essay",
    "scholarships": "scholarship",
}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_csv(path: Path, columns: tuple[str, ...], rows: list[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(columns),
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows({column: row.get(column, "") for column in columns} for row in rows)


def provider_for_url(url: str) -> str:
    try:
        host = (canonicalize_url(url).split("//", 1)[1].split("/", 1)[0]).split(":", 1)[0]
    except (ValueError, IndexError):
        host = ""
    return PROVIDER_BY_DOMAIN.get(host, host or "unknown")


def stable_programme_record(row: Mapping[str, Any], *, programme_id: str | None = None) -> ProgrammeRecord:
    """Build the typed record needed by the deterministic population gate."""
    return ProgrammeRecord(
        programme_id=programme_id or str(row.get("programme_id") or ""),
        institution_id=str(row.get("institution_id") or ""),
        programme_name=str(row.get("programme_name") or ""),
        official_url=str(row.get("official_url") or ""),
        degree_level=row.get("degree_level"),
        credential=row.get("credential"),
        normalized_field=row.get("normalized_field") or row.get("discipline"),
        organisation_unit_id=row.get("organisation_unit_id"),
        language=row.get("language"),
        campus=row.get("campus"),
        delivery_mode=row.get("delivery_mode"),
        duration=row.get("duration"),
        programme_status=row.get("programme_status"),
        catalogue_source=str(row.get("catalogue_source") or "user_supplied"),
        retrieved_at=str(row.get("retrieved_at") or "2026-09-15T00:00:00+00:00"),
    )


def provider_native_ids(item: Mapping[str, Any]) -> dict[str, Any]:
    identifiers = item.get("provider_programme_identifiers") or {}
    result: dict[str, Any] = {}
    for provider, values in identifiers.items():
        if not isinstance(values, Mapping):
            continue
        for key, value in values.items():
            if value not in (None, ""):
                result[f"{provider}.{key}"] = value
    return result


def classify_manifest_row(
    manifest_row: Mapping[str, Any],
    *,
    original_row: Mapping[str, Any] | None,
) -> tuple[ProgrammePopulationClassification, str, str]:
    """Classify a frozen row without using field completeness as a criterion."""
    ids = manifest_row.get("provider_programme_identifiers") or {}
    name = str(manifest_row.get("programme_name") or "").strip()
    original_name = str((original_row or {}).get("programme_name") or "").strip()
    institution_only = not ids and provider_for_url(str(manifest_row.get("official_url") or "")) in {
        "College Scorecard",
        "swissuniversities",
    }
    classification = classify_programme_population(
        stable_programme_record(manifest_row),
        provider_programme_identifiers=ids,
        verified_programme_identity=bool(name),
        deterministic_binding=bool(ids),
        institution_only_source=institution_only,
    )
    if classification == ProgrammePopulationClassification.SYNTHETIC_SEED:
        return classification, "institution-scoped provider has no programme-native identifier", "KEEP_CANARY_ONLY"
    if classification == ProgrammePopulationClassification.INVALID_PROVIDER_MAPPING:
        return classification, "transport/search label is not a programme identity", "KEEP_UNRESOLVED"
    if original_name.casefold() == "datastore search" and name and name.casefold() != original_name.casefold():
        return (
            ProgrammePopulationClassification.VERIFIED_PROGRAMME,
            "frozen RIO source-native title restored after query-order binding defect",
            "FIXED_MAPPING",
        )
    if classification == ProgrammePopulationClassification.VERIFIED_PROGRAMME:
        return classification, "source-native programme identifier and deterministic identity binding", "KEEP_PRODUCTION"
    return classification, "no exact or strong deterministic programme binding", "KEEP_UNRESOLVED"


def classify_original_row(
    manifest_row: Mapping[str, Any],
    original_row: Mapping[str, Any] | None,
) -> ProgrammePopulationClassification:
    """Classify the persisted pre-fix run row for the audit baseline."""
    original_name = str((original_row or {}).get("programme_name") or "").strip()
    if original_name.casefold() == "datastore search":
        return ProgrammePopulationClassification.INVALID_PROVIDER_MAPPING
    ids = manifest_row.get("provider_programme_identifiers") or {}
    provider = provider_for_url(str(manifest_row.get("official_url") or ""))
    if not ids and provider in {"College Scorecard", "swissuniversities"}:
        return ProgrammePopulationClassification.SYNTHETIC_SEED
    if ids and original_row and str(original_row.get("programme_id") or "") == str(manifest_row.get("programme_id") or "") and original_name:
        return ProgrammePopulationClassification.VERIFIED_PROGRAMME
    if ids and original_name:
        return ProgrammePopulationClassification.UNRESOLVED_CANDIDATE
    return ProgrammePopulationClassification.UNRESOLVED_CANDIDATE


def build_population() -> tuple[dict[str, Any], dict[str, Any]]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    run_programmes = read_jsonl(RUN_DIR / "programmes.jsonl")
    run_by_url = {
        canonicalize_url(str(row.get("official_url") or "")): row
        for row in run_programmes
        if row.get("official_url")
    }
    manifest_rows = manifest.get("programmes") or []
    audit_rows: list[dict[str, Any]] = []
    final_rows: list[dict[str, Any]] = []
    classifications: Counter[str] = Counter()
    original_classifications: Counter[str] = Counter()
    provider_counts: dict[str, Counter[str]] = defaultdict(Counter)
    original_provider_counts: dict[str, Counter[str]] = defaultdict(Counter)
    old_id_to_new: dict[str, str] = {}

    for item in manifest_rows:
        url = str(item.get("official_url") or "")
        original = run_by_url.get(canonicalize_url(url))
        classification, reason, action = classify_manifest_row(item, original_row=original)
        classifications[classification.value] += 1
        provider = provider_for_url(url)
        provider_counts[provider][classification.value] += 1
        original_classification = classify_original_row(item, original)
        original_classifications[original_classification.value] += 1
        original_provider_counts[provider][original_classification.value] += 1
        old_id = str((original or {}).get("programme_id") or item.get("programme_id") or "")
        new_id = str(item.get("programme_id") or old_id)
        if old_id:
            old_id_to_new[old_id] = new_id
        native = provider_native_ids(item)
        audit_rows.append(
            {
                "institution_name": str(item.get("institution_id") or ""),
                "original_programme_name": str((original or {}).get("programme_name") or item.get("programme_name") or ""),
                "institution_id": item.get("institution_id") or "",
                "programme_id": new_id,
                "country": "",
                "provider": provider,
                # The audit represents the original persisted 418-target
                # population.  A corrected binding is shown in the verified
                # name/action columns while the pre-fix INVALID mapping stays
                # visible for engineering accountability.
                "classification": original_classification.value,
                "verified_programme_name": item.get("programme_name") if classification == ProgrammePopulationClassification.VERIFIED_PROGRAMME else "",
                "provider_native_programme_id": json.dumps(native, ensure_ascii=False, sort_keys=True) if native else "",
                "reason": reason,
                "binding_evidence": (
                    "; ".join(f"{key}={value}" for key, value in native.items())
                    if native
                    else "institution identity only; no programme-native identifier"
                ),
                "action": action,
            }
        )
        if classification == ProgrammePopulationClassification.VERIFIED_PROGRAMME:
            merged = dict(original or {})
            merged.update(
                {
                    "programme_id": new_id,
                    "institution_id": item.get("institution_id"),
                    "official_url": url,
                    "programme_name": item.get("programme_name"),
                    "degree_level": item.get("degree_level"),
                    "normalized_field": item.get("discipline"),
                }
            )
            final_rows.append(merged)

    # Add country names to the audit without relying on any generated title.
    institutions = {str(row.get("institution_id")): row for row in read_jsonl(RUN_DIR / "institutions.jsonl")}
    for row in audit_rows:
        row["institution_name"] = str(
            institutions.get(str(row["institution_id"]), {}).get("canonical_name")
            or row["institution_id"]
        )
        row["country"] = institutions.get(str(row["institution_id"]), {}).get("country_code") or ""

    production = {
        "schema_version": "GlowBalExternalStage1VerifiedPopulation/v1",
        "population_id": manifest.get("population_id"),
        # Keep the review artifact portable; the hash below identifies the
        # exact frozen manifest without leaking a workstation path.
        "source_manifest": MANIFEST_PATH.name,
        "source_manifest_sha256": hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest(),
        "original_programmes": len(manifest_rows),
        "verified_programmes": len(final_rows),
        "classifications": dict(sorted(classifications.items())),
        "original_classifications": dict(sorted(original_classifications.items())),
        "provider_classifications": {
            provider: dict(sorted(counts.items()))
            for provider, counts in sorted(provider_counts.items())
        },
        "original_provider_classifications": {
            provider: dict(sorted(counts.items()))
            for provider, counts in sorted(original_provider_counts.items())
        },
        "programme_ids": [str(row.get("programme_id")) for row in final_rows],
        "generated_at": "2026-09-16",
    }
    return production, {
        "manifest": manifest,
        "run_programmes": run_programmes,
        "run_by_url": run_by_url,
        "manifest_rows": manifest_rows,
        "final_rows": final_rows,
        "audit_rows": audit_rows,
        "old_id_to_new": old_id_to_new,
        "institutions": institutions,
    }


def remap_hierarchy_data(raw: Mapping[str, Any], context: Mapping[str, Any]) -> dict[str, Any]:
    """Restrict recipients, while retaining the independent accepted donor pool."""
    verified_ids = {str(row["programme_id"]) for row in context["final_rows"]}
    old_to_new = context["old_id_to_new"]

    programme_contexts: list[dict[str, Any]] = []
    offerings_by_new: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for offering in read_jsonl(RUN_DIR / "programme_offerings.jsonl"):
        old_id = str(offering.get("programme_id") or "")
        new_id = old_to_new.get(old_id, old_id)
        if new_id not in verified_ids:
            continue
        mapped = dict(offering)
        mapped["programme_id"] = new_id
        offerings_by_new[new_id].append(mapped)
    for row in context["final_rows"]:
        merged = dict(row)
        # Apply each offering attribute independently; the source run already
        # used this conservative single-value rule.
        for key in ("academic_cycle", "audience", "campus", "delivery_mode"):
            candidates = {
                str(item.get(key))
                for item in offerings_by_new.get(str(row["programme_id"]), [])
                if item.get(key) not in (None, "")
            }
            if len(candidates) == 1:
                merged[key] = next(iter(candidates))
        merged["programme_family"] = merged.get("normalized_field")
        programme_contexts.append(merged)

    assertions = []
    for assertion in raw["assertions"]:
        entity_id = str(assertion.entity_id)
        if assertion.entity_type == "programme":
            mapped_id = old_to_new.get(entity_id, entity_id)
            if mapped_id != entity_id:
                assertion = replace(assertion, entity_id=mapped_id)
        assertions.append(assertion)

    # Donor context lookup must include entities that are not export recipients.
    # Corrected recipient identities override their old persisted contexts.
    donor_programmes = {}
    for row in raw["programme_contexts"]:
        old_id = str(row["programme_id"])
        new_id = old_to_new.get(old_id, old_id)
        donor_programmes[new_id] = {**row, "programme_id": new_id}
    donor_programmes.update({str(row["programme_id"]): row for row in programme_contexts})
    relations = [
        {**row, "programme_id": old_to_new.get(str(row["programme_id"]), str(row["programme_id"]))}
        for row in raw.get("programme_organisation_units", [])
    ]

    review_direct: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for key, rows in raw["review_direct"].items():
        old_id, field = key
        new_id = old_to_new.get(str(old_id), str(old_id))
        if new_id not in verified_ids:
            continue
        for row in rows:
            mapped = dict(row)
            mapped["entity_id"] = new_id
            review_direct[(new_id, str(field))].append(mapped)

    by_field: dict[str, list[Any]] = defaultdict(list)
    accepted_direct: dict[tuple[str, str], list[Any]] = defaultdict(list)
    for assertion in assertions:
        by_field[assertion.field_name].append(assertion)
        if assertion.entity_id and hierarchy_reports.hierarchy_module._scope_kind(assertion) == "programme":
            accepted_direct[(str(assertion.entity_id), assertion.field_name)].append(assertion)

    institutions = raw["institutions"]
    institution_contexts = [
        {
            **row,
            "entity_id": row.get("institution_id"),
            "institution_id": row.get("institution_id"),
            "country": row.get("country_code"),
        }
        for row in institutions
    ]
    return {
        **raw,
        "programmes": context["final_rows"],
        "institutions": institutions,
        "programme_contexts": programme_contexts,
        "donor_programme_contexts": list(donor_programmes.values()),
        "programme_organisation_units": relations,
        "institution_contexts": institution_contexts,
        "assertions": assertions,
        "by_field": by_field,
        "accepted_direct": accepted_direct,
        "review_direct": review_direct,
        "accepted_semantic_count": sum(
            1
            for assertion in assertions
            if assertion.extraction_group != "metadata"
        ),
        "metadata_count": sum(
            1
            for assertion in assertions
            if assertion.extraction_group == "metadata"
        ),
        "review_semantic_count": sum(len(rows) for rows in review_direct.values()),
    }


def make_lead_export(
    outputs: Mapping[str, Any],
    production: Mapping[str, Any],
    data: Mapping[str, Any],
) -> list[dict[str, Any]]:
    full_rows = outputs["rows"]
    completeness = {
        str(row["programme_id"]): row for row in outputs["completeness_rows"]
    }
    by_programme: dict[str, dict[str, str]] = defaultdict(dict)
    source_urls: dict[str, set[str]] = defaultdict(set)
    hierarchy_counts: Counter[str] = Counter()
    for row in full_rows:
        pid = str(row["target_programme_id"])
        field = FIELD_ALIASES.get(str(row["field_name"]), str(row["field_name"]))
        status = str(row.get("resolution_status") or "")
        if status not in {"DIRECT_ACCEPTED", "HIERARCHICAL_ADVISORY"}:
            continue
        value = str(row.get("final_value") or "")
        if not value:
            continue
        if by_programme[pid].get(field) and by_programme[pid][field] != value:
            by_programme[pid][field] += f" | {value}"
        else:
            by_programme[pid][field] = value
        if row.get("source_url"):
            source_urls[pid].update(
                item.strip() for item in str(row["source_url"]).split(" | ") if item.strip()
            )
        if status == "HIERARCHICAL_ADVISORY":
            hierarchy_counts[pid] += 1

    institution_names = {
        str(row.get("institution_id")): str(row.get("canonical_name") or row.get("name") or row.get("institution_id") or "")
        for row in data["institutions"]
    }
    lead_rows: list[dict[str, Any]] = []
    for target in sorted(
        production["verified_rows"],
        key=lambda row: (
            str(row.get("country") or ""),
            institution_names.get(str(row.get("institution_id")), str(row.get("institution_id") or "")),
            str(row.get("programme_name") or ""),
        ),
    ):
        pid = str(target["programme_id"])
        values = by_programme.get(pid, {})
        c = completeness.get(pid, {})
        row = {
            "institution_name": institution_names.get(str(target.get("institution_id")), str(target.get("institution_id") or "")),
            "programme_name": target.get("programme_name") or "",
            "country": next((str(item.get("country") or "") for item in outputs["completeness_rows"] if str(item.get("programme_id")) == pid), ""),
            "degree_level": target.get("degree_level") or "",
            "discipline": target.get("normalized_field") or target.get("discipline") or "",
            "institution_id": target.get("institution_id") or "",
            "programme_id": pid,
        }
        for field in LEAD_COLUMNS[7:-7]:
            row[field] = values.get(field, "")
        row.update(
            {
                "direct_field_count": c.get("direct_field_count", 0),
                "hierarchical_added_field_count": c.get("hierarchical_added_field_count", 0),
                "effective_field_count": c.get("effective_field_count", 0),
                "missing_field_count": c.get("missing_field_count", 0),
                "effective_completion_pct": c.get("completion_after_hierarchy_pct", 0),
                "final_source_count": len(source_urls.get(pid, set())),
                "hierarchical_field_count": hierarchy_counts.get(pid, 0),
            }
        )
        # Preserve institution scope for advisory finance values.  A blank
        # value always has a blank scope, so no scope is accidentally presented
        # as a programme fact.
        for field, scope_field in (("tuition", "tuition_scope"), ("additional_fees", "additional_fees_scope")):
            if values.get(field):
                matching = [
                    item for item in full_rows
                    if str(item.get("target_programme_id")) == pid
                    and str(FIELD_ALIASES.get(str(item.get("field_name")), item.get("field_name"))) == field
                    and str(item.get("resolution_status")) in {"DIRECT_ACCEPTED", "HIERARCHICAL_ADVISORY"}
                ]
                row[scope_field] = next((str(item.get("target_scope") or "") for item in matching if item.get("target_scope")), "")
            else:
                row[scope_field] = ""
        lead_rows.append(row)
    return lead_rows


def main() -> None:
    production, context = build_population()
    production["verified_rows"] = context["final_rows"]
    write_csv(ARTIFACT_DIR / "stage1-programme-population-audit.csv", AUDIT_COLUMNS, context["audit_rows"])
    production_artifact = {
        key: value for key, value in production.items() if key != "verified_rows"
    }
    verified_ids = {str(row["programme_id"]) for row in context["final_rows"]}
    production_artifact["verified_programme_manifest"] = [
        row
        for row in context["manifest_rows"]
        if str(row.get("programme_id") or "") in verified_ids
    ]
    write_json(
        ARTIFACT_DIR / "stage1-production-population.json",
        production_artifact,
    )
    write_json(
        ARTIFACT_DIR / "stage1-population-classification-summary.json",
        {
            "original_programmes": production["original_programmes"],
            "original_classifications": production["original_classifications"],
            "classifications": production["classifications"],
            "original_provider_classifications": production["original_provider_classifications"],
            "provider_classifications": production["provider_classifications"],
            "verified_programme_count": production["verified_programmes"],
        },
    )
    manifest_hash = str(production["source_manifest_sha256"])
    (ARTIFACT_DIR / "stage1-production-population.sha256").write_text(manifest_hash + "\n", encoding="utf-8")

    # Reuse the frozen accepted-evidence loader, then apply only the population
    # filter/remap before invoking the unchanged hierarchy evaluator.
    raw = hierarchy_reports.prepare_data()
    data = remap_hierarchy_data(raw, context)
    decisions, rejections = hierarchy_reports.run_decisions(data, optimized=True)
    REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    outputs = hierarchy_reports.matrix_and_outputs(data, decisions, REPLAY_DIR)

    for name in (
        "stage1-hierarchy-field-summary.csv",
        "stage1-programme-completeness.csv",
        "stage1-hierarchy-donor-review.csv",
    ):
        source = REPLAY_DIR / name
        if source.exists():
            target = ARTIFACT_DIR / f"stage1-production-{name.removeprefix('stage1-')}"
            target.write_bytes(source.read_bytes())

    lead_rows = make_lead_export(outputs, production, data)
    write_csv(ARTIFACT_DIR / "stage1-programme-final-results.csv", LEAD_COLUMNS, lead_rows)
    write_json(
        ARTIFACT_DIR / "stage1-production-replay-summary.json",
        {
            "population": {
                "original_programmes": production["original_programmes"],
                "verified_programmes": production["verified_programmes"],
                "institutions": len({row["institution_id"] for row in data["programmes"]}),
            },
            "hierarchy": hierarchy_reports.aggregate_summary(outputs["summary_rows"]),
            "rows": len(outputs["rows"]),
            "lead_rows": len(lead_rows),
            "donor_rows": len(outputs["donor_rows"]),
            "field_summary": outputs["summary_rows"],
            "completeness": outputs["completeness_rows"],
            "rejection_summary": [
                {
                    "field": field,
                    "hierarchy_level": level,
                    "candidate_rejections": len(items),
                }
                for (field, level), items in sorted(rejections.items())
            ],
            "source_manifest_sha256": manifest_hash,
            "paid_llm_calls": 0,
        },
    )
    print(
        json.dumps(
            {
                "population": production["classifications"],
                "verified": production["verified_programmes"],
                "hierarchy": hierarchy_reports.aggregate_summary(outputs["summary_rows"]),
                "lead_rows": len(lead_rows),
                "audit_rows": len(context["audit_rows"]),
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
