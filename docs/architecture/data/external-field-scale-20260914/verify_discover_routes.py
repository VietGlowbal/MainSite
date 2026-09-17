from __future__ import annotations

import urllib.error
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
    req = urllib.request.Request(url, headers={"User-Agent": "GlowBal-scale-audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            body = response.read(512_000)
            print(prn, course, response.status, len(body), response.geturl())
    except urllib.error.HTTPError as exc:
        print(prn, course, "HTTP", exc.code)
    except Exception as exc:
        print(prn, course, type(exc).__name__, exc)
