"""Read-only discovery helpers for the frozen external canary manifest.

The helper streams already-validated provider distributions to select
source-native identifiers. It never writes provider payloads to disk.
"""

from __future__ import annotations

import csv
import io
import json
import sys
from typing import Any

import requests


def discover_onisep(keywords: list[str]) -> None:
    url = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()
    response.raw.decode_content = True
    text_stream = io.TextIOWrapper(response.raw, encoding="utf-8-sig", newline="")
    reader = csv.DictReader(text_stream, delimiter=";")
    wanted = [item.casefold() for item in keywords]
    found: dict[str, list[dict[str, str]]] = {item: [] for item in keywords}

    def value_with_prefix(row: dict[str, Any], prefix: str) -> str:
        for key, value in row.items():
            if str(key).casefold().startswith(prefix.casefold()):
                return str(value or "")
        return ""

    try:
        try:
            for row in reader:
                label = value_with_prefix(row, "Lieu d'enseignement (ENS) libell")
                haystack = label.casefold()
                for index, needle in enumerate(wanted):
                    if needle not in haystack or len(found[keywords[index]]) >= 4:
                        continue
                    found[keywords[index]].append(
                        {
                            "institution_label": label,
                            "uai": value_with_prefix(row, "ENS code UAI"),
                            "af": value_with_prefix(row, "Action de Formation (AF) identifiant Onisep"),
                            "programme": value_with_prefix(row, "Formation (FOR) libell"),
                            "credential": value_with_prefix(row, "FOR type"),
                            "duration": value_with_prefix(row, "AF dur"),
                            "mode": value_with_prefix(row, "AF modal"),
                            "city": value_with_prefix(row, "ENS commune"),
                        }
                    )
        except ValueError as exc:
            # urllib3 closes the response immediately after the final bytes;
            # Python's CSV iterator can make one final read against that
            # closed wrapper after all complete rows were delivered.
            if "closed file" not in str(exc).casefold():
                raise
    finally:
        if not text_stream.closed:
            text_stream.detach()
        response.close()
    print(json.dumps(found, ensure_ascii=False, indent=2))


def discover_onisep_uai(uais: list[str]) -> None:
    url = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()
    response.raw.decode_content = True
    text_stream = io.TextIOWrapper(response.raw, encoding="utf-8-sig", newline="")
    reader = csv.DictReader(text_stream, delimiter=";")
    wanted = [item.casefold() for item in uais]
    found: dict[str, list[dict[str, str]]] = {item: [] for item in uais}
    try:
        try:
            for row in reader:
                uai = str(row.get("ENS code UAI") or "")
                if uai.casefold() not in wanted:
                    continue
                if len(found[uai]) >= 5:
                    continue
                found[uai].append(
                    {
                        "institution_label": str(row.get("Lieu d'enseignement (ENS) libellé") or ""),
                        "uai": uai,
                        "af": str(row.get("Action de Formation (AF) identifiant Onisep") or ""),
                        "programme": str(row.get("Formation (FOR) libellé") or ""),
                        "credential": str(row.get("FOR type") or ""),
                    }
                )
        except ValueError as exc:
            if "closed file" not in str(exc).casefold():
                raise
    finally:
        if not text_stream.closed:
            text_stream.detach()
        response.close()
    print(json.dumps(found, ensure_ascii=False, indent=2))


def discover_scorecard(names: list[str]) -> None:
    import zipfile

    url = "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution.zip"
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        member = next(name for name in archive.namelist() if name.endswith("Most-Recent-Cohorts-Institution.csv"))
        reader = csv.DictReader(io.TextIOWrapper(archive.open(member), encoding="utf-8-sig", newline=""))
        wanted = {item.casefold() for item in names}
        rows = []
        for row in reader:
            if str(row.get("INSTNM") or "").casefold() in wanted:
                rows.append(
                    {
                        "UNITID": str(row.get("UNITID") or ""),
                        "INSTNM": str(row.get("INSTNM") or ""),
                        "CITY": str(row.get("CITY") or ""),
                        "STABBR": str(row.get("STABBR") or ""),
                    }
                )
    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    values = sys.argv[2:]
    if mode == "onisep":
        discover_onisep(values)
    elif mode == "onisep_uai":
        discover_onisep_uai(values)
    elif mode == "scorecard":
        discover_scorecard(values)
    else:
        raise SystemExit("usage: discover_records.py onisep KEYWORD... | scorecard NAME...")
