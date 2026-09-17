"""Build an isolated correction manifest for the SE/FI canary targets.

The frozen primary manifest intentionally remains untouched.  The first canary
run exposed a target-binding defect: the manifest used descriptive identifier
aliases while the provider field-evidence specs match source-native keys
(``id``, ``content.providers``, ``oid``).  This script derives a six-institution
correction run by adding the source-native keys, preserving the original IDs,
URLs, and target population.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PRIMARY_MANIFEST = ROOT / "population-manifest.json"
PRIMARY_CONFIG = ROOT / "population-config.json"
OUT_MANIFEST = ROOT / "correction-manifest.json"
OUT_CONFIG = ROOT / "correction-config.json"
OUT_SHA = ROOT / "correction-manifest.sha256"
OUT_LEDGER = ROOT / "correction-manifest-ledger.json"

TARGET_INSTITUTIONS = {
    "kth-se-canary",
    "uppsala-se-canary",
    "lund-se-canary",
    "haaga-helia-fi-canary",
    "aalto-fi-canary",
    "uef-fi-canary",
}


def _patch_provider_ids(ids: dict[str, object]) -> None:
    # Institution/config rows store programme IDs one level above provider
    # IDs; frozen-programme rows store providers directly.  Handle both
    # shapes without changing any source-native value.
    if not any(
        key in {"susa_navet_event", "susa_navet_info", "studyinfo_hakukohde", "studyinfo_toteutus", "studyinfo_valintaperuste"}
        for key in ids
    ):
        for nested in ids.values():
            if isinstance(nested, dict):
                _patch_provider_ids(nested)
        return
    for provider, values in ids.items():
        if not isinstance(values, dict):
            continue
        if provider == "susa_navet_event":
            if "SUSA_EVENT_ID" in values:
                values.setdefault("id", values["SUSA_EVENT_ID"])
            if "SUSA_PROVIDER_ID" in values:
                values.setdefault("content.providers", values["SUSA_PROVIDER_ID"])
        elif provider == "susa_navet_info":
            if "SUSA_INFO_ID" in values:
                values.setdefault("id", values["SUSA_INFO_ID"])
        elif provider == "studyinfo_hakukohde":
            if "STUDYINFO_HAKUKOHDE_OID" in values:
                values.setdefault("oid", values["STUDYINFO_HAKUKOHDE_OID"])
        elif provider == "studyinfo_toteutus":
            if "STUDYINFO_TOTEUTUS_OID" in values:
                values.setdefault("oid", values["STUDYINFO_TOTEUTUS_OID"])
        elif provider == "studyinfo_valintaperuste":
            if "STUDYINFO_VALINTAPERUSTE_ID" in values:
                values.setdefault("id", values["STUDYINFO_VALINTAPERUSTE_ID"])


def _derive_institution(institution: dict[str, object]) -> dict[str, object]:
    result = copy.deepcopy(institution)
    _patch_provider_ids(result.get("provider_programme_identifiers") or {})
    return result


def _manifest_programmes(manifest: dict[str, object]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for programme in manifest.get("programmes", []):
        if str(programme.get("institution_id")) in TARGET_INSTITUTIONS:
            row = copy.deepcopy(programme)
            _patch_provider_ids(row.get("provider_programme_identifiers") or {})
            rows.append(row)
    return rows


def main() -> None:
    primary_manifest = json.loads(PRIMARY_MANIFEST.read_text(encoding="utf-8"))
    primary_config = json.loads(PRIMARY_CONFIG.read_text(encoding="utf-8"))
    institutions = [
        _derive_institution(item)
        for item in primary_manifest["institutions"]
        if str(item.get("institution_id")) in TARGET_INSTITUTIONS
    ]
    if {str(item["institution_id"]) for item in institutions} != TARGET_INSTITUTIONS:
        raise SystemExit("correction target set does not match the frozen manifest")

    programmes = _manifest_programmes(primary_manifest)
    manifest = {
        "schema_version": primary_manifest["schema_version"],
        "population_id": "external-field-canary-correction-se-fi-20260914",
        "frozen_at": "2026-09-14",
        "derived_from_population_id": primary_manifest["population_id"],
        "purpose": (
            "Isolated canary correction run. The frozen primary population is "
            "unchanged; only source-native provider identifier aliases are added "
            "after a verified target-binding defect."
        ),
        "providers": primary_manifest["providers"],
        "institutions": institutions,
        "programmes": programmes,
        "counts": {
            "institutions": len(institutions),
            "programmes": len(programmes),
            "countries": len({str(item["country_code"]) for item in institutions}),
        },
    }
    config = copy.deepcopy(primary_config)
    config["run_name"] = "external-field-canary-correction-se-fi-20260914"
    config["institutions"] = institutions
    config["canary_correction"] = {
        "derived_from_manifest": primary_manifest["population_id"],
        "reason": "source-native identifier aliases required by existing provider field-evidence specs",
        "target_institutions": sorted(TARGET_INSTITUTIONS),
    }

    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    OUT_CONFIG.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    digest = hashlib.sha256(OUT_MANIFEST.read_bytes()).hexdigest()
    OUT_SHA.write_text(digest + "\n", encoding="utf-8")
    OUT_LEDGER.write_text(
        json.dumps(
            {
                "manifest": OUT_MANIFEST.name,
                "config": OUT_CONFIG.name,
                "sha256": digest,
                "derived_from": primary_manifest["population_id"],
                "target_institutions": sorted(TARGET_INSTITUTIONS),
                "identifier_aliases_added": {
                    "susa_navet_event": ["id", "content.providers"],
                    "susa_navet_info": ["id"],
                    "studyinfo_hakukohde": ["oid"],
                    "studyinfo_toteutus": ["oid"],
                    "studyinfo_valintaperuste": ["id"],
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"institutions": len(institutions), "programmes": len(programmes), "sha256": digest}))


if __name__ == "__main__":
    main()
