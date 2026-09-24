"""Derive the isolated DUO correction from the frozen canary run.

The DUO URL itself is valid, but the runner canonicalises query parameters
before assigning a programme ID.  The frozen manifest used declaration-order
URLs, so the provider IDs no longer pointed at the runtime programme rows.
This mirrors the previously validated DUO correction pattern without changing
the provider adapter or the frozen 50/100-target population.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
PRIMARY_CONFIG = ROOT / "population-config.json"
PRIMARY_MANIFEST = ROOT / "population-manifest.json"
PRIMARY_RUN = ROOT / "runs" / "primary-20260914"
OUT_CONFIG = ROOT / "duo-correction-config.json"
OUT_MANIFEST = ROOT / "duo-correction-manifest.json"
OUT_SHA = ROOT / "duo-correction-manifest.sha256"
OUT_LEDGER = ROOT / "duo-correction-manifest-ledger.json"


def jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def duo_code(url: str) -> str | None:
    filters = parse_qs(urlparse(url).query).get("filters", [None])[0]
    if not filters:
        return None
    try:
        parsed = json.loads(unquote(filters))
    except (TypeError, ValueError):
        return None
    value = parsed.get("OPLEIDINGSEENHEIDCODE")
    return str(value) if value else None


def derive() -> tuple[dict, dict]:
    config = json.loads(PRIMARY_CONFIG.read_text(encoding="utf-8"))
    manifest = json.loads(PRIMARY_MANIFEST.read_text(encoding="utf-8"))
    runtime = [
        row
        for row in jsonl(PRIMARY_RUN / "programmes.jsonl")
        if str(row.get("institution_id", "")).endswith("-nl-canary")
    ]
    by_code = {(str(row["institution_id"]), duo_code(str(row["official_url"]))): row for row in runtime}
    source_institutions = [row for row in config["institutions"] if str(row.get("country_code")) == "NL"]
    corrected: list[dict] = []
    corrected_programmes: list[dict] = []
    for original in source_institutions:
        row = copy.deepcopy(original)
        metadata_by_code = {
            duo_code(str(url)): value
            for url, value in original.get("programme_metadata", {}).items()
            if duo_code(str(url))
        }
        urls: list[str] = []
        metadata: dict[str, dict] = {}
        identifiers: dict[str, dict] = {}
        original_programme_by_code = {
            duo_code(str(url)): (pid, value)
            for pid, value in original.get("provider_programme_identifiers", {}).items()
            for url in original.get("manual_programme_urls", [])
            if duo_code(str(url)) and value.get("duo_rio_ho", {}).get("OPLEIDINGSEENHEIDCODE") == duo_code(str(url))
        }
        for raw_url in original.get("manual_programme_urls", []):
            code = duo_code(str(raw_url))
            runtime_row = by_code.get((str(original["institution_id"]), code))
            if not runtime_row or not code:
                raise RuntimeError(f"No runtime programme for {original['institution_id']} code {code}")
            runtime_url = str(runtime_row["official_url"])
            runtime_id = str(runtime_row["programme_id"])
            urls.append(runtime_url)
            metadata[runtime_url] = metadata_by_code.get(code, {})
            original_pid, provider_ids = original_programme_by_code[code]
            del original_pid
            identifiers[runtime_id] = copy.deepcopy(provider_ids)
            corrected_programmes.append(
                {
                    "programme_id": runtime_id,
                    "institution_id": original["institution_id"],
                    "official_url": runtime_url,
                    "programme_name": metadata_by_code.get(code, {}).get("programme_name"),
                    "degree_level": metadata_by_code.get(code, {}).get("degree_level"),
                    "discipline": metadata_by_code.get(code, {}).get("normalized_field"),
                    "provider_programme_identifiers": copy.deepcopy(provider_ids),
                }
            )
        row["manual_programme_urls"] = urls
        row["programme_metadata"] = metadata
        row["provider_programme_identifiers"] = identifiers
        corrected.append(row)

    output = copy.deepcopy(config)
    output["run_name"] = "external-field-canary-correction-duo-20260914"
    output["source_ecosystem"]["external_provider_ids"] = ["duo_rio_ho"]
    output["source_ecosystem"]["government_datasets"]["providers"] = ["duo_rio_ho"]
    output["source_ecosystem"]["official_partners"] = {"enabled": False}
    output["source_ecosystem"]["required_source_classes"] = ["government_dataset"]
    output["source_ecosystem"]["field_groups"] = [
        "programme_identity",
        "credential",
        "programme_status",
        "academic_cycle",
        "programme_language",
    ]
    output["institutions"] = corrected
    output["canary_correction"] = {
        "derived_from_manifest": manifest["population_id"],
        "reason": "runtime URL canonicalization changed DUO programme stable IDs",
        "target_institutions": sorted(str(row["institution_id"]) for row in corrected),
    }
    derived_manifest = {
        "schema_version": manifest["schema_version"],
        "population_id": "external-field-canary-correction-duo-20260914",
        "frozen_at": "2026-09-14",
        "derived_from_population_id": manifest["population_id"],
        "purpose": "Isolated DUO URL-canonicalization correction; same 16 NL targets, no population expansion.",
        "providers": ["duo_rio_ho"],
        "institutions": corrected,
        "programmes": corrected_programmes,
        "counts": {"institutions": len(corrected), "programmes": len(corrected_programmes), "countries": 1},
    }
    return output, derived_manifest


def main() -> None:
    config, manifest = derive()
    OUT_CONFIG.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    digest = hashlib.sha256(OUT_MANIFEST.read_bytes()).hexdigest()
    OUT_SHA.write_text(digest + "\n", encoding="utf-8")
    OUT_LEDGER.write_text(
        json.dumps(
            {
                "config": OUT_CONFIG.name,
                "manifest": OUT_MANIFEST.name,
                "sha256": digest,
                "derived_from": manifest["derived_from_population_id"],
                "runtime_programmes_source": str(PRIMARY_RUN / "programmes.jsonl"),
                "reason": "query-order canonicalization / stable programme-ID mismatch",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"institutions": manifest["counts"]["institutions"], "programmes": manifest["counts"]["programmes"], "sha256": digest}))


if __name__ == "__main__":
    main()
