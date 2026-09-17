from __future__ import annotations

import re
import urllib.request

routes = [
    ("10007774", "G400", "Full-time"),
    ("10007774", "GG14", "Full-time"),
    ("10007788", "UG_CSTX", "Full-time"),
    ("10007788", "UG_NSTX", "Full-time"),
    ("10003270", "GG14", "Full-time"),
    ("10003270", "GG41", "Full-time"),
    ("10007154", "G400", "Full-time"),
    ("10007154", "G404", "Full-time"),
]
for prn, course, mode in routes:
    url = f"https://discoveruni.gov.uk/course-details/{prn}/{course}/{mode}/"
    body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"}), timeout=60).read().decode("utf-8", "replace")
    title = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
    clean = re.sub(r"\s+", " ", title.group(1)).strip() if title else ""
    print(prn, course, clean[:300])
