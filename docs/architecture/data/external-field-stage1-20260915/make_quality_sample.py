"""Build a bounded, deterministic evidence-quality sample from Stage 1 artifacts."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUN = ROOT / "runs" / "stage1-20260915-main"


def rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def accepted(row: dict[str, Any]) -> bool:
    return (
        row.get("value_json") not in (None, "", [], {})
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def main() -> None:
    manifest = json.loads((ROOT / "stage1-population-manifest.json").read_text(encoding="utf-8"))
    institutions = {str(item["institution_id"]): item for item in manifest["institutions"]}
    programmes = {str(item["programme_id"]): item for item in manifest["programmes"]}

    def context(row: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
        scope = str(row.get("scope") or "programme")
        entity_id = str(row.get("entity_id") or row.get("programme_id") or row.get("institution_id") or "")
        if scope == "institution":
            institution_id = entity_id
            programme_id = None
        else:
            programme_id = entity_id
            institution_id = str(programmes.get(programme_id, {}).get("institution_id") or "")
        country = institutions.get(institution_id, {}).get("country_code")
        return institution_id or None, programme_id, str(country) if country else None

    families = {
        "identity": {"programme_identity", "credential"},
        "finance": {"tuition", "additional_fees"},
        "attributes": {"programme_status", "academic_cycle", "duration", "location", "delivery_mode", "programme_language"},
        "outcomes": {"career_outcomes", "employment_outcomes"},
        "admissions": {"intakes", "final_deadline", "rolling_admission", "minimum_degree", "subject_prerequisites", "required_documents", "standardized_tests", "ielts_overall", "ielts_subscores", "toefl", "duolingo", "application_fee", "priority_deadline", "international_deadline"},
        "work_funding": {"work_experience", "scholarships", "funding", "funding_amount", "funding_eligibility", "funding_deadline"},
    }
    field_family = {field: family for family, fields in families.items() for field in fields}

    accepted_rows = [row for row in rows(RUN / "effective_field_assertions.jsonl") if accepted(row)]
    samples: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for row in accepted_rows:
        provider = str(row.get("provider_id") or "")
        field = str(row.get("field_name") or "")
        institution_id, programme_id, country = context(row)
        family = field_family.get(field, "other")
        key = (provider, str(country or "UNKNOWN"), family, field)
        if not provider or key in seen:
            continue
        seen.add(key)
        samples.append(
            {
                "sample_kind": "accepted_assertion",
                "provider_id": provider,
                "country": country,
                "field_family": family,
                "field": field,
                "entity_type": row.get("entity_type"),
                "entity_id": row.get("entity_id"),
                "institution_id": institution_id,
                "programme_id": programme_id,
                "scope": row.get("scope"),
                "value_json": row.get("value_json"),
                "audience": row.get("audience"),
                "academic_cycle": row.get("academic_cycle"),
                "temporal_state": row.get("temporal_state"),
                "currency": row.get("currency"),
                "basis": row.get("basis"),
                "source_url": row.get("source_url") or row.get("url"),
                "raw_document_id": row.get("raw_document_id"),
                "source_content_hash": row.get("source_content_hash"),
                "source_authority": row.get("source_authority"),
                "source_relationship": row.get("source_relationship"),
                "dataset_id": row.get("dataset_id"),
                "acquisition_run_id": row.get("acquisition_run_id"),
                "evidence": row.get("evidence"),
                "evidence_locator": row.get("evidence_locator"),
            }
        )

    # Include one durable materialisation for providers with no accepted
    # assertion, so provider coverage checks do not silently omit a route.
    materialization_samples: list[dict[str, Any]] = []
    accepted_providers = {str(item["provider_id"]) for item in samples}
    for row in rows(RUN / "external_field_materializations.jsonl"):
        provider = str(row.get("provider_id") or "")
        if not provider or provider in accepted_providers:
            continue
        materialization_samples.append(
            {
                "sample_kind": "materialization_only",
                "provider_id": provider,
                "institution_id": row.get("institution_id"),
                "scope": "programme" if row.get("linked_programme_id") else "institution",
                "source_url": row.get("source_url"),
                "raw_document_id": row.get("raw_document_id"),
                "source_authority": row.get("source_authority"),
                "source_relationship": row.get("source_relationship"),
                "entity_match": row.get("entity_match"),
                "matching_signals": row.get("matching_signals"),
                "reason": row.get("reason"),
            }
        )
        accepted_providers.add(provider)

    countries = sorted({str(item.get("country_code")) for item in institutions.values()})
    output = {
        "schema": "GlowBalStage1QualitySample/v1",
        "run": str(RUN),
        "manifest_sha256": (ROOT / "stage1-population-manifest.sha256").read_text(encoding="ascii").split()[0],
        "selection": "first stable accepted row per provider/country/field-family; one materialisation-only row for providers without accepted assertions",
        "countries_in_manifest": countries,
        "accepted_assertion_sample_count": len(samples),
        "materialization_only_sample_count": len(materialization_samples),
        "accepted_assertions": samples,
        "materialization_only": materialization_samples,
    }
    (ROOT / "stage1-quality-sample.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "accepted_assertions": len(samples),
        "materialization_only": len(materialization_samples),
        "providers_sampled": sorted(accepted_providers),
        "countries": countries,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
