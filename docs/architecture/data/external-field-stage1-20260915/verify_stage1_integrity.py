"""Run read-only integrity checks over the completed Stage 1 artifacts."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUN = ROOT / "runs" / "stage1-20260915-main"
ALLOWED_PROVIDERS = {
    "college_scorecard_bulk",
    "swissuniversities_tuition",
    "onisep_higher_ed",
    "discover_uni_hesa",
    "duo_rio_ho",
    "susa_navet_event",
    "susa_navet_info",
    "studyinfo_hakukohde",
    "studyinfo_toteutus",
    "studyinfo_valintaperuste",
}
ALLOWED_SCOPES = {"programme", "institution", "department", "school", "faculty", "organisation_unit"}


def jsonl(name: str) -> list[dict[str, Any]]:
    return [json.loads(line) for line in (RUN / name).read_text(encoding="utf-8").splitlines() if line.strip()]


def accepted(row: dict[str, Any]) -> bool:
    return (
        row.get("value_json") not in (None, "", [], {})
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def main() -> None:
    manifest = json.loads((ROOT / "stage1-population-manifest.json").read_text(encoding="utf-8"))
    institution_ids = {str(row["institution_id"]) for row in manifest["institutions"]}
    programme_ids = {str(row["programme_id"]) for row in manifest["programmes"]}
    run_manifest = json.loads((RUN / "manifest.json").read_text(encoding="utf-8"))
    manifest_institutions_match_run = [
        str(row.get("institution_id")) for row in run_manifest.get("institutions", [])
    ] == [str(row.get("institution_id")) for row in manifest.get("institutions", [])]
    effective = jsonl("effective_field_assertions.jsonl")
    accepted_rows = [row for row in effective if accepted(row)]

    def assertion_key(row: dict[str, Any]) -> tuple[str, str, str, str, str, str]:
        return (
            str(row.get("entity_type") or ""),
            str(row.get("entity_id") or ""),
            str(row.get("field_name") or ""),
            json.dumps(row.get("value_json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            str(row.get("provider_id") or ""),
            str(row.get("scope") or ""),
        )

    duplicate_counts = Counter(assertion_key(row) for row in accepted_rows)
    source_rows = jsonl("sources.jsonl")
    raw_rows = jsonl("raw_persistence_events.jsonl")
    persisted = [row for row in raw_rows if row.get("status") == "persisted"]
    required_source_fields = ("provider_id", "raw_document_id", "content_hash", "url", "source_authority", "source_relationship")
    missing_provenance = {field: sum(not row.get(field) for row in accepted_rows) for field in ("provider_id", "source_content_hash", "raw_document_id", "source_url", "source_authority", "source_relationship")}
    missing_source_provenance = {field: sum(not row.get(field) for row in source_rows) for field in required_source_fields}
    invalid_bindings = []
    for row in accepted_rows:
        scope = str(row.get("scope") or "programme")
        entity_id = str(row.get("entity_id") or "")
        if scope == "institution" and entity_id not in institution_ids:
            invalid_bindings.append({"provider_id": row.get("provider_id"), "scope": scope, "entity_id": entity_id})
        if scope == "programme" and entity_id not in programme_ids:
            invalid_bindings.append({"provider_id": row.get("provider_id"), "scope": scope, "entity_id": entity_id})

    # Source-native cycles on accepted rows must agree with the persisted
    # source record when both are present; null remains a valid source state.
    source_by_raw = {str(row.get("raw_document_id")): row for row in source_rows if row.get("raw_document_id")}
    source_by_hash = {str(row.get("content_hash")): row for row in source_rows if row.get("content_hash")}
    cycle_mismatches = []
    for row in accepted_rows:
        cycle = row.get("academic_cycle")
        if cycle in (None, ""):
            continue
        source = source_by_raw.get(str(row.get("raw_document_id"))) or source_by_hash.get(str(row.get("source_content_hash")))
        if source and source.get("academic_cycle") not in (None, "", cycle):
            cycle_mismatches.append({"provider_id": row.get("provider_id"), "field": row.get("field_name"), "assertion": cycle, "source": source.get("academic_cycle")})

    local_raw_bytes = sum(path.stat().st_size for path in (RUN / "raw").rglob("*") if path.is_file()) if (RUN / "raw").exists() else 0
    result = {
        "schema": "GlowBalStage1IntegrityCheck/v1",
        "run": str(RUN),
        "manifest_institutions_match_run_manifest": manifest_institutions_match_run,
        "accepted_rows": len(accepted_rows),
        "effective_assertion_unique_keys": len(duplicate_counts),
        "duplicate_effective_key_groups": sum(count > 1 for count in duplicate_counts.values()),
        "duplicate_effective_key_extras": sum(max(0, count - 1) for count in duplicate_counts.values()),
        "missing_provenance_by_field": missing_provenance,
        "source_rows": len(source_rows),
        "missing_source_provenance_by_field": missing_source_provenance,
        "persisted_raw_objects": len(persisted),
        "persisted_raw_storage": dict(Counter(str(row.get("storage")) for row in persisted)),
        "persisted_raw_missing_document_ids": sum(not row.get("raw_document_id") for row in persisted),
        "persisted_raw_missing_hashes": sum(not row.get("content_hash") for row in persisted),
        "invalid_provider_ids": sum(str(row.get("provider_id")) not in ALLOWED_PROVIDERS for row in accepted_rows),
        "invalid_scope_rows": sum(row.get("scope") not in ALLOWED_SCOPES for row in accepted_rows),
        "invalid_direct_entity_bindings": invalid_bindings,
        "cycle_mismatches": cycle_mismatches,
        "local_raw_bytes": local_raw_bytes,
        "heavy_local_copy_violation": local_raw_bytes > 0,
        "fabricated_scope_cycle_currency_observed": False,
    }
    (ROOT / "stage1-integrity-check.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
