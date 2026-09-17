"""Build a narrow DUO correction config for the frozen scale population.

The scale manifest was frozen with query URLs in declaration order, while the
runtime canonicalizer sorts query parameters before deriving programme IDs.
This artifact remaps only the four NL targets to the IDs actually emitted by
the completed run; it does not alter the provider adapter or the population.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "population-config.json"
RUN = ROOT / "runs" / "external-field-scale-20260914a"
OUT = ROOT / "duo-correction-config.json"


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


def main() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    run_programmes = [row for row in jsonl(RUN / "programmes.jsonl") if str(row.get("institution_id", "")).endswith("-nl-scale")]
    by_code = {(str(row["institution_id"]), duo_code(str(row["official_url"]))): row for row in run_programmes}
    source_institutions = [row for row in config["institutions"] if str(row.get("country_code")) == "NL"]
    corrected = []
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
        for raw_url in original.get("manual_programme_urls", []):
            code = duo_code(str(raw_url))
            runtime = by_code.get((str(original["institution_id"]), code))
            if not runtime or not code:
                raise RuntimeError(f"No runtime programme for {original['institution_id']} code {code}")
            runtime_url = str(runtime["official_url"])
            runtime_id = str(runtime["programme_id"])
            urls.append(runtime_url)
            metadata[runtime_url] = metadata_by_code.get(code, {})
            provider_ids = original.get("provider_programme_identifiers", {}).get(
                next((pid for pid, value in original.get("provider_programme_identifiers", {}).items() if value.get("duo_rio_ho", {}).get("OPLEIDINGSEENHEIDCODE") == code), ""),
                {},
            )
            identifiers[runtime_id] = provider_ids
        row["manual_programme_urls"] = urls
        row["programme_metadata"] = metadata
        row["provider_programme_identifiers"] = identifiers
        corrected.append(row)

    output = copy.deepcopy(config)
    output["run_name"] = "external-field-scale-20260914-duo-correction"
    output["source_ecosystem"]["external_provider_ids"] = ["duo_rio_ho"]
    output["source_ecosystem"]["government_datasets"]["providers"] = ["duo_rio_ho"]
    output["source_ecosystem"]["official_partners"] = {"enabled": False}
    output["source_ecosystem"]["field_groups"] = ["programme_identity", "credential", "programme_status", "academic_cycle", "language"]
    output["institutions"] = corrected
    output["limits"]["max_deep_programmes_per_institution"] = 2
    output["limits"]["max_deep_sources_per_programme"] = 1
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"out": str(OUT), "institutions": len(corrected), "programmes": sum(len(r["manual_programme_urls"]) for r in corrected)}, indent=2))


if __name__ == "__main__":
    main()
