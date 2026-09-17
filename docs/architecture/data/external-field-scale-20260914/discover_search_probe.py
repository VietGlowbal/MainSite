from __future__ import annotations

import re
import urllib.parse
import urllib.request

queries = ("Computer Science", "Data Science", "University of Oxford", "University of Manchester")
for query in queries:
    url = "https://discoveruni.gov.uk/course-finder/results/?" + urllib.parse.urlencode({"query": query})
    try:
        body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
    except Exception as exc:
        print(query, "ERROR", type(exc).__name__, exc)
        continue
    links = sorted(set(re.findall(r"/course-details/[0-9A-Za-z/_-]+", body)))
    print("QUERY", query, "bytes", len(body), "links", len(links))
    print("\n".join(links[:100]))
