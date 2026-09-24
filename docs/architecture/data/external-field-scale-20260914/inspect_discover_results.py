from __future__ import annotations

import re
import urllib.parse
import urllib.request

url = "https://discoveruni.gov.uk/course-finder/results/?" + urllib.parse.urlencode({"query": "Computer Science"})
body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
print("bytes", len(body))
for pattern in (r"<script[^>]+src=\"([^\"]+)", r"/_next/static/[^\"']+", r"__next_f.push\((.*?)\)"):
    values = sorted(set(re.findall(pattern, body, re.S)))
    print("PATTERN", pattern, "count", len(values))
    for value in values[:100]:
        print(value[:1000].encode("ascii", "backslashreplace").decode())
print("course terms")
for token in ("Computer", "course", "PUBUKPRN", "KISCourse", "No results", "search-api"):
    i = body.casefold().find(token.casefold())
    print(token, i, body[max(0, i - 300):i + 1200].encode("ascii", "backslashreplace").decode() if i >= 0 else "")
