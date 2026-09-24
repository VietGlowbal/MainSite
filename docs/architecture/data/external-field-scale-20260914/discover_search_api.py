from __future__ import annotations

import json
import urllib.request

base = "https://search-api-v2-prod-hxhpghhdg3dqdhft.uksouth-01.azurewebsites.net/api/v2/search/"
bodies = [
    {"query": "Computer Science"},
    {"query": "Computer Science", "selectedInstitutions": [], "modeFullTime": False, "modePartTime": False, "locOnCampus": False, "locDistanceLearning": False, "regionScotland": False, "regionWales": False, "regionNorthernIreland": False, "regionEngland": False, "postcodeQuery": None, "postcodeDistance": None, "cityQuery": None, "cityDistance": None},
    {"query": "Computer Science", "page": 1},
]
for body in bodies:
    request = urllib.request.Request(base, data=json.dumps(body).encode(), method="POST", headers={"User-Agent": "GlowBal-scale-audit/1.0", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        response = urllib.request.urlopen(request, timeout=60)
        payload = response.read().decode("utf-8", "replace")
        print("BODY", json.dumps(body), "STATUS", response.status, "BYTES", len(payload))
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            print(payload[:2000].encode("ascii", "backslashreplace").decode())
            continue

        def walk(value, path="root"):
            if isinstance(value, dict):
                for key, child in value.items():
                    key_text = str(key).lower()
                    if key_text in {"id", "courseid", "kiscode", "kiscourse", "pubukprn", "institutionid", "coursename", "name", "title", "url", "link"}:
                        if isinstance(child, (str, int, float, bool)):
                            print(f"  {path}.{key}={child!r}")
                    yield from walk(child, f"{path}.{key}")
            elif isinstance(value, list):
                for index, child in enumerate(value[:5]):
                    yield from walk(child, f"{path}[{index}]")
            elif isinstance(value, str) and "course-details" in value:
                print(f"  {path}={value!r}")

        if isinstance(parsed, dict):
            print("  top_keys", list(parsed)[:40])
        elif isinstance(parsed, list):
            print("  top_list_length", len(parsed))
            if parsed and isinstance(parsed[0], dict):
                print("  first_keys", list(parsed[0]))
                print("  first_record", json.dumps(parsed[0], ensure_ascii=True)[:4000])
                institutions = {}
                for item in parsed:
                    if not isinstance(item, dict):
                        continue
                    cid = str(item.get("courseId", ""))
                    parts = cid.split("/")
                    if len(parts) >= 3:
                        institutions.setdefault(parts[0], []).append(item)
                print("  institution_count", len(institutions))
                for inst, items in list(institutions.items())[:15]:
                    print("  institution", inst, "courses", len(items), "sample", [x.get("courseId") for x in items[:3]])
        list(walk(parsed))
    except Exception as exc:
        print("BODY", json.dumps(body), "ERROR", type(exc).__name__, exc)
