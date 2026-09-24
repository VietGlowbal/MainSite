"""Read-only Studyinfo identifier discovery for canary manifest freezing."""

from __future__ import annotations

import json
import sys

import requests


BASE = "https://opintopolku.fi/konfo-backend"


def find_targets(koulutus_oids: list[str]) -> None:
    session = requests.Session()
    output = []
    for oid in koulutus_oids:
        response = session.get(f"{BASE}/koulutus/{oid}", timeout=60)
        if response.status_code != 200:
            print(f"SKIP_KOULUTUS {oid} {response.status_code}", file=sys.stderr)
            continue
        koulutus = response.json()
        target_oids = {str(item.get("oid")) for item in koulutus.get("toteutukset") or []}
        target_oids.discard("None")
        hits = []
        for haku_oid in koulutus.get("haut") or []:
            haku_response = session.get(f"{BASE}/haku/{haku_oid}", timeout=60)
            if haku_response.status_code != 200:
                continue
            try:
                haku = haku_response.json()
            except ValueError:
                continue
            for target in haku.get("hakukohteet") or []:
                if str(target.get("toteutusOid")) not in target_oids:
                    continue
                hits.append(
                    {
                        "koulutus_oid": oid,
                        "toteutus_oid": target.get("toteutusOid"),
                        "hakukohde_oid": target.get("oid"),
                        "valintaperuste_id": target.get("valintaperusteId"),
                        "name": (target.get("nimi") or {}).get("en") or (target.get("nimi") or {}).get("fi"),
                        "haku_oid": haku_oid,
                        "organisation": ((target.get("organisaatio") or {}).get("nimi") or {}).get("en"),
                    }
                )
            if len(hits) >= 4:
                break
        output.extend(hits[:4])
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: discover_studyinfo.py KOULUTUS_OID ...")
    find_targets(sys.argv[1:])
