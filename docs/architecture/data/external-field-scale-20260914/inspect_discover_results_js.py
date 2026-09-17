from __future__ import annotations

import re
import urllib.request

url = "https://discoveruni.gov.uk/static/search_app/en/app-search-en.js"
body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
print("bytes", len(body))
for token in ("api", "course", "search", "PUBUKPRN", "KISCourse", "fetch("):
    print("TOKEN", token)
    start = 0
    for _ in range(30):
        i = body.casefold().find(token.casefold(), start)
        if i < 0:
            break
        print(body[max(0, i - 500):i + 1800].encode("ascii", "backslashreplace").decode())
        start = i + len(token)
