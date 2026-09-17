from __future__ import annotations

import csv
import io
import urllib.request

url = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
uai_wanted = {"0755283K", "0442777E", "0690187D", "0912423P", "0690192J"}
request = urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"})
with urllib.request.urlopen(request, timeout=120) as response:
    text = io.TextIOWrapper(response, encoding="utf-8-sig", errors="replace", newline="")
    reader = csv.DictReader(text, delimiter=";")
    for row in reader:
        if row.get("ENS code UAI", "").strip() not in uai_wanted:
            continue
        print("|".join([
            row.get("ENS code UAI", "").strip(),
            row.get("ENS libellé", "").strip(),
            row.get("Action de Formation (AF) identifiant Onisep", "").strip(),
            row.get("Formation (FOR) libellé", "").strip(),
            row.get("FOR type", "").strip(),
            row.get("AF coût scolarité", "").strip(),
            row.get("AF durée cycle standard", "").strip(),
            row.get("AF modalités scolarité", "").strip(),
            row.get("ENS commune", "").strip(),
        ]))
