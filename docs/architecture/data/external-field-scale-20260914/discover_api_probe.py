from __future__ import annotations

import json
import urllib.parse
import urllib.request

base = "https://search-api-v2-prod-hxhpghhdg3dqdhft.uksouth-01.azurewebsites.net/api/v2"
for path in ("institutions", "cities"):
    for query in ("", "Nottingham", "Oxford", "Manchester"):
        url = base + "/" + path
        if query:
            url += "?" + urllib.parse.urlencode({"query": query})
        try:
            body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0", "Accept": "application/json"}), timeout=30).read().decode("utf-8", "replace")
        except Exception as exc:
            print(url, "ERROR", type(exc).__name__, exc)
            continue
        print("URL", url, "bytes", len(body))
        try:
            value = json.loads(body)
        except Exception:
            value = body[:500]
        print(json.dumps(value, ensure_ascii=False)[:5000].encode("ascii", "backslashreplace").decode())
