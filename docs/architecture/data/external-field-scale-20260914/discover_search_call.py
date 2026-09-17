from __future__ import annotations

import re
import urllib.request

url = "https://discoveruni.gov.uk/static/search_app/en/app-search-en.js"
body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
for token in ("Sent to the backend", "api/v2/search`,", "search/sort-by-subjects", "groupByType"):
    print("TOKEN", token)
    start = 0
    for _ in range(10):
        i = body.find(token, start)
        if i < 0:
            break
        print(body[max(0, i - 3000):i + 4000].encode("ascii", "backslashreplace").decode())
        start = i + len(token)
