from __future__ import annotations

import re
import urllib.request

url = "https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/"
request = urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"})
body = urllib.request.urlopen(request, timeout=30).read().decode("utf-8", "replace")
patterns = sorted(set(re.findall(r"/course-details/[0-9A-Za-z/_-]+", body)))
absolute = sorted(set(re.findall(r"https?://[^\"' ]*discoveruni\.gov\.uk/course-details/[^\"' ]+", body)))
print(f"bytes={len(body)}")
print("relative")
print("\n".join(patterns[:200]))
print("absolute")
print("\n".join(absolute[:200]))
print("api-like")
for value in sorted(set(re.findall(r"https?://[^\"' ]+|/api/[A-Za-z0-9_/?=&${}.-]+", body))):
    if any(token in value.casefold() for token in ("api", "course", "search", "unistar", "data")):
        print(value[:500])
