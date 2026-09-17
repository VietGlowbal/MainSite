from __future__ import annotations

import re
import urllib.request

for url in (
    "https://discoveruni.gov.uk/course-comparison/",
    "https://discoveruni.gov.uk/",
):
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"})
        body = urllib.request.urlopen(request, timeout=30).read().decode("utf-8", "replace")
    except Exception as exc:
        print(url, "ERROR", type(exc).__name__, exc)
        continue
    print("URL", url, "bytes", len(body))
    for value in sorted(set(re.findall(r"(?:https?:)?//[^\"' ]+|/[^\"' ]+", body))):
        if any(token in value.casefold() for token in ("api", "search", "course", "compare", "graphql")):
            print(value[:500])
