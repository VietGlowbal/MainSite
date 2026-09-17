"""Derive the final frozen-canary config after verified binding repairs.

The population manifest is immutable.  This builder only derives runtime
configuration from the frozen config and the already-validated correction
artifacts: source-native identifier aliases, DUO's canonical programme URLs,
and the current Studyinfo relationship for Aalto Computer Science.
"""

from __future__ import annotations

import copy
import hashlib
import json
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PRIMARY_CONFIG = ROOT / "population-config.json"
PRIMARY_MANIFEST = ROOT / "population-manifest.json"
SE_FI_CORRECTION = ROOT / "correction-config.json"
DUO_CORRECTION = ROOT / "duo-correction-config.json"
OUT_CONFIG = ROOT / "final-config.json"
OUT_LEDGER = ROOT / "final-config-ledger.json"

OLD_AALTO_HAKUKOHDE = "1.2.246.562.20.00000000000000070512"
CURRENT_AALTO_HAKUKOHDE = "1.2.246.562.20.00000000000000091188"
OLD_AALTO_VALINTAPERUSTE = "c9458393-c6eb-4388-b4ef-49981b4d42df"
CURRENT_AALTO_VALINTAPERUSTE = "34db13a9-3733-434c-a323-67c130ae0f1f"
CURRENT_AALTO_URL = (
    "https://opintopolku.fi/konfo-backend/hakukohde/"
    + CURRENT_AALTO_HAKUKOHDE
)
IDENTITY_NAMESPACE = uuid.UUID("8bd4a66f-8f40-4a26-b0fd-0642d998fae7")
OLD_AALTO_URL = (
    "https://opintopolku.fi/konfo-backend/hakukohde/"
    + OLD_AALTO_HAKUKOHDE
)


def _patch_source_native_aliases(row: dict[str, object]) -> None:
    programmes = row.get("provider_programme_identifiers")
    if not isinstance(programmes, dict):
        return
    for providers in programmes.values():
        if not isinstance(providers, dict):
            continue
        for provider, identifiers in providers.items():
            if not isinstance(identifiers, dict):
                continue
            if provider == "susa_navet_event":
                if identifiers.get("SUSA_EVENT_ID"):
                    identifiers.setdefault("id", identifiers["SUSA_EVENT_ID"])
                if identifiers.get("SUSA_PROVIDER_ID"):
                    identifiers.setdefault(
                        "content.providers", identifiers["SUSA_PROVIDER_ID"]
                    )
            elif provider == "susa_navet_info":
                if identifiers.get("SUSA_INFO_ID"):
                    identifiers.setdefault("id", identifiers["SUSA_INFO_ID"])
            elif provider == "studyinfo_hakukohde":
                if identifiers.get("STUDYINFO_HAKUKOHDE_OID"):
                    identifiers.setdefault("oid", identifiers["STUDYINFO_HAKUKOHDE_OID"])
            elif provider == "studyinfo_toteutus":
                if identifiers.get("STUDYINFO_TOTEUTUS_OID"):
                    identifiers.setdefault("oid", identifiers["STUDYINFO_TOTEUTUS_OID"])
            elif provider == "studyinfo_valintaperuste":
                if identifiers.get("STUDYINFO_VALINTAPERUSTE_ID"):
                    identifiers.setdefault("id", identifiers["STUDYINFO_VALINTAPERUSTE_ID"])


def _replace_values(value: object, replacements: dict[str, str]) -> object:
    if isinstance(value, str):
        return replacements.get(value, value)
    if isinstance(value, list):
        return [_replace_values(item, replacements) for item in value]
    if isinstance(value, dict):
        return {
            replacements.get(key, key): _replace_values(item, replacements)
            for key, item in value.items()
        }
    return value


def _programme_runtime_id(institution_id: str, url: str) -> str:
    """Mirror the stable programme identity used by runtime normalization."""
    key = "|".join(("programme", institution_id.strip().lower(), url.strip().lower()))
    return str(uuid.uuid5(IDENTITY_NAMESPACE, key))


def derive() -> tuple[dict[str, object], dict[str, object]]:
    primary = json.loads(PRIMARY_CONFIG.read_text(encoding="utf-8"))
    manifest = json.loads(PRIMARY_MANIFEST.read_text(encoding="utf-8"))
    correction = json.loads(SE_FI_CORRECTION.read_text(encoding="utf-8"))
    duo = json.loads(DUO_CORRECTION.read_text(encoding="utf-8"))

    correction_rows = {
        str(row["institution_id"]): row
        for row in correction.get("institutions", [])
        if isinstance(row, dict) and row.get("institution_id")
    }
    duo_rows = {
        str(row["institution_id"]): row
        for row in duo.get("institutions", [])
        if isinstance(row, dict) and row.get("institution_id")
    }
    institutions: list[dict[str, object]] = []
    for original in primary.get("institutions", []):
        institution_id = str(original.get("institution_id") or "")
        row = copy.deepcopy(
            duo_rows.get(institution_id)
            or correction_rows.get(institution_id)
            or original
        )
        _patch_source_native_aliases(row)
        institutions.append(row)

    aalto = next(
        row for row in institutions if row.get("institution_id") == "aalto-fi-canary"
    )
    aalto_replacements = {
        OLD_AALTO_HAKUKOHDE: CURRENT_AALTO_HAKUKOHDE,
        OLD_AALTO_VALINTAPERUSTE: CURRENT_AALTO_VALINTAPERUSTE,
        OLD_AALTO_URL: CURRENT_AALTO_URL,
    }
    replaced = _replace_values(aalto, aalto_replacements)
    if not isinstance(replaced, dict):
        raise RuntimeError("Aalto binding replacement did not produce an object")
    aalto.clear()
    aalto.update(replaced)
    _patch_source_native_aliases(aalto)
    # The frozen programme ID is derived from the historical route, while the
    # current Studyinfo route is the live crawl target.  Keep the frozen key
    # for manifest compatibility and expose the same provider identifiers
    # under the runtime ID derived from the current route.
    runtime_aalto_id = _programme_runtime_id(
        "aalto-fi-canary", CURRENT_AALTO_URL
    )
    programme_identifiers = aalto.get("provider_programme_identifiers")
    if isinstance(programme_identifiers, dict) and runtime_aalto_id not in programme_identifiers:
        for providers in programme_identifiers.values():
            if not isinstance(providers, dict):
                continue
            studyinfo = providers.get("studyinfo_hakukohde")
            if (
                isinstance(studyinfo, dict)
                and studyinfo.get("oid") == CURRENT_AALTO_HAKUKOHDE
            ):
                programme_identifiers[runtime_aalto_id] = copy.deepcopy(providers)
                break

    output = copy.deepcopy(primary)
    output["run_name"] = "external-field-canary-final-20260915"
    output["institutions"] = institutions
    output["canary_final"] = {
        "frozen_manifest": manifest["population_id"],
        "frozen_manifest_sha256": hashlib.sha256(
            PRIMARY_MANIFEST.read_bytes()
        ).hexdigest(),
        "derived_from": PRIMARY_CONFIG.name,
        "corrections": [
            "SE/FI source-native Susa-navet/Studyinfo aliases",
            "DUO runtime-canonical programme bindings",
            "Aalto Computer Science current Studyinfo hakukohde/valintaperuste relationship",
        ],
        "aalto_studyinfo": {
            "programme_id": "b229397b-3e7e-53c6-a7a0-ff3288e177c9",
            "old_hakukohde": OLD_AALTO_HAKUKOHDE,
            "current_hakukohde": CURRENT_AALTO_HAKUKOHDE,
            "toteutus": "1.2.246.562.17.00000000000000008123",
            "old_valintaperuste": OLD_AALTO_VALINTAPERUSTE,
            "current_valintaperuste": CURRENT_AALTO_VALINTAPERUSTE,
        },
    }
    ledger = {
        "config": OUT_CONFIG.name,
        "derived_from": PRIMARY_CONFIG.name,
        "frozen_manifest": manifest["population_id"],
        "frozen_manifest_sha256": output["canary_final"]["frozen_manifest_sha256"],
        "institution_count": len(institutions),
        "programme_target_count": len(manifest.get("programmes") or []),
        "correction_config": SE_FI_CORRECTION.name,
        "duo_correction_config": DUO_CORRECTION.name,
        "aalto_current_relationship": output["canary_final"]["aalto_studyinfo"],
    }
    return output, ledger


def main() -> None:
    config, ledger = derive()
    OUT_CONFIG.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUT_LEDGER.write_text(
        json.dumps(ledger, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(ledger, ensure_ascii=False))


if __name__ == "__main__":
    main()
