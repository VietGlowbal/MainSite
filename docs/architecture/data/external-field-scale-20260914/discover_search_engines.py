from __future__ import annotations

import re
import urllib.parse
import urllib.request

for engine, template in (
    ("bing", "https://www.bing.com/search?q={query}"),
    ("duckduckgo", "https://html.duckduckgo.com/html/?q={query}"),
):
    for institution in ("University of Oxford", "University College London", "University of Manchester", "University of Edinburgh"):
        q = urllib.parse.quote(f'site:discoveruni.gov.uk/course-details/ "{institution}"')
        url = template.format(query=q)
        try:
            body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=30).read().decode("utf-8", "replace")
        except Exception as exc:
            print(engine, institution, "ERROR", type(exc).__name__, exc)
            continue
        links = sorted(set(re.findall(r"https?://(?:www\.)?discoveruni\.gov\.uk/course-details/[0-9A-Za-z/_-]+", body)))
        print(engine, institution, "bytes", len(body), "links", len(links))
        print("\n".join(links[:50]))
