from __future__ import annotations

import json
import urllib.parse
import urllib.request

base = "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
institutions = {
    "107B605": "TU Delft",
    "107B473": "Universiteit van Amsterdam",
    "107B450": "Technische Universiteit Eindhoven",
    "107B578": "Universiteit Leiden",
}
for institution_id, label in institutions.items():
    params = {
        "resource_id": "ffffa7ad-e6a2-4ba7-9fc2-a09df4128555",
        "limit": "100",
        "filters": json.dumps({"ONDERWIJSBESTUURID": institution_id}, separators=(",", ":")),
    }
    url = base + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"})
    payload = json.loads(urllib.request.urlopen(request, timeout=60).read())
    records = payload.get("result", {}).get("records", [])
    print("###", institution_id, label, "records", len(records))
    for row in records[:20]:
        print("|".join(str(row.get(k, "")).strip() for k in [
            "OPLEIDINGSEENHEIDCODE", "NAAM_LANG", "NIVEAU", "GRAAD", "STUDIELAST",
            "VORM", "VOERTAAL", "BEGINDATUM", "AANGEBODEN_OPLEIDING_BEGINDATUM",
        ]))
