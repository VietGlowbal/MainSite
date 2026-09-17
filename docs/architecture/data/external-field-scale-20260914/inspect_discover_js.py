from __future__ import annotations

import re
import urllib.request

for path in (
    "/static/search_app/homepage_search/app-search-only.js",
    "/static/js/course_comparison.js?11.0.8",
):
    url = "https://discoveruni.gov.uk" + path
    try:
        body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
    except Exception as exc:
        print(url, "ERROR", type(exc).__name__, exc)
        continue
    print("URL", url, "bytes", len(body))
    for token in ("search-api", "api/v2", "courses", "course-finder/results"):
        print("TOKEN", token)
        start = 0
        emitted = 0
        while emitted < 20:
            index = body.casefold().find(token.casefold(), start)
            if index < 0:
                break
            print(body[max(0, index - 500):index + 1000].encode("ascii", "backslashreplace").decode())
            start = index + len(token)
            emitted += 1
    print("fetch contexts")
    for match in re.finditer(r"fetch\(", body):
        print(body[max(0, match.start() - 600):match.start() + 1800].encode("ascii", "backslashreplace").decode())
    print("\n".join(sorted(set(re.findall(r"[^\"'`\s]*(?:api|search|course|query)[^\"'`\s]*", body, re.IGNORECASE)))[:300]))
