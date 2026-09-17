"""Build bounded France/US correction configs for streaming-read regressions.

The frozen scale manifest remains untouched.  These configs select only the
targets whose external evidence was lost during the original run and invoke
one repaired provider at a time so the rerun can be attributed cleanly.
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "population-config.json"


def build(country: str, provider_id: str, run_name: str, fields: list[str]) -> Path:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    selected = [
        copy.deepcopy(item)
        for item in config["institutions"]
        if str(item.get("country_code", "")).upper() == country.upper()
    ]
    if not selected:
        raise RuntimeError(f"No frozen targets for country {country!r}")
    output = copy.deepcopy(config)
    output["run_name"] = run_name
    output["source_ecosystem"]["external_provider_ids"] = [provider_id]
    output["source_ecosystem"]["field_groups"] = fields
    output["source_ecosystem"]["official_partners"] = {"enabled": False}
    output["source_ecosystem"]["government_datasets"] = {
        "enabled": True,
        "providers": [provider_id],
    }
    output["institutions"] = selected
    output["limits"]["max_deep_programmes_per_institution"] = 2
    output["limits"]["max_deep_sources_per_programme"] = 1
    path = ROOT / f"{run_name}-config.json"
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", required=True, choices=("FR", "US"))
    parser.add_argument("--provider", required=True)
    parser.add_argument("--run-name", required=True)
    parser.add_argument("--fields", nargs="+", required=True)
    args = parser.parse_args()
    path = build(args.country, args.provider, args.run_name, list(args.fields))
    print(json.dumps({"path": str(path), "country": args.country, "provider": args.provider, "institutions": len(json.loads(path.read_text(encoding="utf-8"))["institutions"])}, indent=2))


if __name__ == "__main__":
    main()
