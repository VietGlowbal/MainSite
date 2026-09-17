from __future__ import annotations

import json
import urllib.parse
import urllib.request

base = "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
targets = [
    ("107B605", "1001O8897"),
    ("107B473", "1001O6172"),
    ("107B450", "1001O6777"),
    ("107B450", "1001O6650"),
    ("107B578", "1001O7137"),
    ("107B578", "1001O5903"),
]
for institution_id, programme_id in targets:
    params = {
        "resource_id": "ffffa7ad-e6a2-4ba7-9fc2-a09df4128555",
        "limit": "10",
        "filters": json.dumps({"ONDERWIJSBESTUURID": institution_id, "OPLEIDINGSEENHEIDCODE": programme_id}, separators=(",", ":")),
    }
    url = base + "?" + urllib.parse.urlencode(params)
    payload = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=60).read())
    records = payload.get("result", {}).get("records", [])
    print("###", institution_id, programme_id, "records", len(records))
    for row in records:
        print(json.dumps({k: row.get(k) for k in [
            "ONDERWIJSBESTUURID", "OPLEIDINGSEENHEIDCODE", "NAAM_LANG", "NIVEAU", "GRAAD", "STUDIELAST", "VORM", "VOERTAAL", "BEGINDATUM", "AANGEBODEN_OPLEIDING_BEGINDATUM",
        ]}, ensure_ascii=False))
