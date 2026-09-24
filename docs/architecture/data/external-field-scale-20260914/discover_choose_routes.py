from __future__ import annotations

import json
import urllib.request

url = "https://search-api-v2-prod-hxhpghhdg3dqdhft.uksouth-01.azurewebsites.net/api/v2/search/"
body = {
    "query": "Computer Science",
    "selectedInstitutions": [],
    "modeFullTime": False,
    "modePartTime": False,
    "locOnCampus": False,
    "locDistanceLearning": False,
    "regionScotland": False,
    "regionWales": False,
    "regionNorthernIreland": False,
    "regionEngland": False,
    "postcodeQuery": None,
    "postcodeDistance": None,
    "cityQuery": None,
    "cityDistance": None,
}
request = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    method="POST",
    headers={
        "User-Agent": "GlowBal-scale-audit/1.0",
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
)
rows = json.loads(urllib.request.urlopen(request, timeout=60).read())
wanted = [
    "Oxford", "Cambridge", "Imperial", "Edinburgh", "Manchester", "Warwick",
    "Bristol", "Nottingham", "King's", "Leeds", "Glasgow", "Southampton",
    "Durham", "Birmingham", "Sheffield", "Exeter", "Lancaster", "Loughborough",
    "Newcastle", "York",
]
groups: dict[tuple[str, str], list[str]] = {}
for row in rows:
    course_id = str(row.get("courseId", ""))
    parts = course_id.split("/")
    if len(parts) >= 3:
        groups.setdefault((parts[0], str(row.get("institution", ""))), []).append(course_id)
for (institution_id, institution), courses in groups.items():
    if any(term.lower() in institution.lower() for term in wanted):
        print(institution_id, institution, len(courses), courses[:6])
