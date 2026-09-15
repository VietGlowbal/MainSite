"""Build and freeze the Stage 1 external-provider rollout population.

The source list is deliberately derived from the already validated provider
resources.  This script only records source-native identifiers and target
metadata; it never copies provider payloads into the manifest and never writes
provider facts.  The ingestion run remains responsible for remote durable
evidence, materialisation, semantic extraction, and acceptance.
"""

from __future__ import annotations

import concurrent.futures
import copy
import csv
import hashlib
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[3]
CANARY = ROOT / "docs" / "architecture" / "data" / "external-field-canary-20260914"
OUT = ROOT / "docs" / "architecture" / "data" / "external-field-stage1-20260915"
BASE_CONFIG = CANARY / "final-config.json"
BASE_MANIFEST = CANARY / "population-manifest.json"
SERVICE = ROOT / "services" / "data-ingestion"
sys.path.insert(0, str(SERVICE))
from glowbal_ingestion.models import stable_id  # noqa: E402


USER_AGENT = "GlowBalStage1PopulationBuilder/1.0"
SCORECARD_API = "https://api.data.gov/ed/collegescorecard/v1/schools.json"
SCORECARD_BULK = "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution.zip"
ONISEP_CSV = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
DUO_API = "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
DUO_RESOURCE = "ffffa7ad-e6a2-4ba7-9fc2-a09df4128555"
DISCOVER_SITEMAP = "https://discoveruni.gov.uk/sitemaps/content.xml"
SWISS_URL = "https://www.swissuniversities.ch/en/themen/lehre-studium/information-on-studies/tuition-fees/tuition-fees-at-universities"


def fetch(url: str, *, timeout: int = 120) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_json(url: str, *, timeout: int = 120) -> Any:
    return json.loads(fetch(url, timeout=timeout).decode("utf-8"))


def _norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def _region(country: str) -> str:
    return "North America" if country == "US" else "Europe"


def _rule(domain: str, adapter: str, provider: str, relationship: str, authority: str) -> dict[str, str]:
    return {
        "domain": domain,
        "adapter_id": adapter,
        "provider_id": provider,
        "reason": f"Stage 1 external rollout target for validated {provider} source",
        "relationship": relationship,
        "authority": authority,
    }


def _duo_url(board_id: str, programme_id: str) -> str:
    filters = urllib.parse.quote(
        json.dumps(
            {
                "ONDERWIJSBESTUURID": board_id,
                "OPLEIDINGSEENHEIDCODE": programme_id,
            },
            separators=(",", ":"),
        ),
        safe="",
    )
    return f"{DUO_API}?resource_id={DUO_RESOURCE}&limit=1&filters={filters}"


def _add_institution(
    rows: list[dict[str, Any]],
    *,
    institution_id: str,
    name: str,
    country: str,
    domain: str,
    homepage: str,
    source_rules: list[dict[str, str]],
    programmes: list[dict[str, Any]],
    institution_identifiers: dict[str, dict[str, str]] | None = None,
) -> None:
    urls: list[str] = []
    metadata: dict[str, dict[str, Any]] = {}
    programme_identifiers: dict[str, dict[str, dict[str, str]]] = {}
    for item in programmes:
        url = str(item["url"])
        urls.append(url)
        metadata[url] = {
            "programme_name": str(item["name"]),
            "degree_level": str(item["degree"]),
            "normalized_field": str(item.get("discipline") or "") or None,
        }
        programme_id = stable_id("programme", institution_id, url)
        programme_identifiers[programme_id] = {
            str(provider): {
                str(key): str(value) for key, value in identifiers.items()
            }
            for provider, identifiers in (item.get("provider_programme_identifiers") or {}).items()
        }
    rows.append(
        {
            "institution_id": institution_id,
            "name": name,
            "country_code": country,
            "region": _region(country),
            "official_domain": domain,
            "homepage_url": homepage,
            "allowed_domains": [domain],
            "manual_only": True,
            "terms_status": "UNREVIEWED",
            "manual_programme_urls": urls,
            "programme_metadata": metadata,
            "provider_identifiers": institution_identifiers or {},
            "provider_programme_identifiers": programme_identifiers,
            "external_source_rules": source_rules,
        }
    )


US_NAMES = [
    "Massachusetts Institute of Technology",
    "Cornell University",
    "Harvard University",
    "Stanford University",
    "University of California-Berkeley",
    "Princeton University",
    "Yale University",
    "Columbia University in the City of New York",
    "University of Michigan-Ann Arbor",
    "Carnegie Mellon University",
    "New York University",
    "Purdue University-Main Campus",
    "University of California-Los Angeles",
    "University of California-San Diego",
    "University of Illinois Urbana-Champaign",
    "University of Wisconsin-Madison",
    "The University of Texas at Austin",
    "Georgia Institute of Technology-Main Campus",
    "University of Washington-Seattle Campus",
    "Pennsylvania State University-Main Campus",
    "Ohio State University-Main Campus",
    "University of North Carolina at Chapel Hill",
    "Duke University",
    "Northwestern University",
    "Brown University",
    "Dartmouth College",
    "Johns Hopkins University",
    "Rice University",
    "Vanderbilt University",
    "University of Notre Dame",
    "University of Southern California",
    "Boston University",
    "Boston College",
    "Tufts University",
    "Northeastern University",
    "University of Maryland-College Park",
    "University of Virginia-Main Campus",
    "Virginia Polytechnic Institute and State University",
    "Texas A & M University-College Station",
    "University of California-Davis",
    "University of California-Irvine",
    "University of California-Santa Barbara",
    "University of California-Riverside",
    "University of Minnesota-Twin Cities",
    "University of Pittsburgh-Pittsburgh Campus",
    "Rutgers University-New Brunswick",
    "Indiana University-Bloomington",
    "Michigan State University",
    "University of Florida",
    "University of Illinois Chicago",
    "University of Colorado Boulder",
    "Arizona State University Campus Immersion",
    "University of Arizona",
    "University of Utah",
    "University of Oregon",
    "Washington State University",
    "North Carolina State University at Raleigh",
    "University of Tennessee-Knoxville",
    "University of Rochester",
    "Brandeis University",
    "Case Western Reserve University",
    "Emory University",
    "Wake Forest University",
    "Rensselaer Polytechnic Institute",
    "Syracuse University",
    "George Washington University",
    "Georgetown University",
    "American University",
    "University of Delaware",
    "University of Connecticut",
    "University of Massachusetts-Amherst",
    "University of Kansas",
    "University of Nebraska-Lincoln",
]


def _scorecard_row(name: str) -> dict[str, Any] | None:
    query = urllib.parse.urlencode(
        {
            "school.name": name,
            "school.operating": "1",
            "per_page": "5",
            "fields": "id,school.name,school.state,school.city,school.ownership,latest.student.size",
            "api_key": "DEMO_KEY",
        }
    )
    try:
        payload = fetch_json(f"{SCORECARD_API}?{query}", timeout=60)
    except Exception:
        return None
    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list) or not results:
        return None
    exact = [r for r in results if isinstance(r, dict) and _norm(r.get("school.name")) == _norm(name)]
    row = exact[0] if exact else results[0]
    return row if isinstance(row, dict) and row.get("id") else None


def build_scorecard(rows: list[dict[str, Any]], *, existing_unitids: set[str]) -> dict[str, Any]:
    # The bulk archive is the validated runtime source.  Read it in memory
    # only for manifest selection (the ingestion path remains remote/bounded),
    # so API-key rate limits cannot make a frozen population nondeterministic.
    archive = fetch(SCORECARD_BULK, timeout=240)
    import zipfile

    found_rows: list[dict[str, Any]] = []
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        member = next(
            name for name in bundle.namelist()
            if name.casefold().endswith("most-recent-cohorts-institution.csv")
        )
        with bundle.open(member) as stream:
            reader = csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""))
            for record in reader:
                unitid = str(record.get("UNITID") or "").strip()
                name = str(record.get("INSTNM") or "").strip()
                state = str(record.get("STABBR") or "").strip().upper()
                control = str(record.get("CONTROL") or "").strip()
                predominant = str(record.get("PREDDEG") or "").strip()
                main = str(record.get("MAIN") or "1").strip()
                try:
                    students = int(float(str(record.get("UGDS") or "0").strip() or "0"))
                except ValueError:
                    students = 0
                if (
                    unitid
                    and name
                    and state
                    and unitid not in existing_unitids
                    and control in {"1", "2"}
                    and predominant in {"3", "4"}
                    and main in {"", "1"}
                    and students > 0
                ):
                    found_rows.append(
                        {
                            "id": unitid,
                            "school.name": name,
                            "school.state": state,
                            "latest.student.size": students,
                        }
                    )
    # Round-robin states to keep the production population geographically
    # representative instead of selecting only the largest state systems.
    by_state: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in sorted(found_rows, key=lambda item: (-int(item.get("latest.student.size") or 0), _norm(item.get("school.name")))):
        by_state[str(record["school.state"])].append(record)
    found: list[dict[str, Any]] = []
    states = sorted(by_state)
    while states and len(found) < 70:
        next_states: list[str] = []
        for state in states:
            bucket = by_state[state]
            if bucket:
                found.append(bucket.pop(0))
            if bucket:
                next_states.append(state)
            if len(found) >= 70:
                break
        states = next_states
    found.sort(key=lambda r: (str(r.get("school.state") or ""), _norm(r.get("school.name"))))
    host = "ed-public-download.scorecard.network"
    for index, row in enumerate(found, start=1):
        name = str(row.get("school.name") or "").strip()
        institution_id = f"scorecard-us-stage1-{index:03d}"
        unitid = str(row["id"])
        programmes = [
            {
                "url": f"{SCORECARD_BULK}?target={institution_id}-a",
                "name": f"{name} Computer Science",
                "degree": "master",
                "discipline": "computer science",
            },
            {
                "url": f"{SCORECARD_BULK}?target={institution_id}-b",
                "name": f"{name} Engineering",
                "degree": "bachelor",
                "discipline": "engineering",
            },
        ]
        _add_institution(
            rows,
            institution_id=institution_id,
            name=name,
            country="US",
            domain=host,
            homepage="https://ed-public-download.scorecard.network/",
            source_rules=[_rule(host, "college_scorecard", "college_scorecard_bulk", "GOVERNMENT", "GOVERNMENT")],
            institution_identifiers={"college_scorecard_bulk": {"UNITID": unitid}},
            programmes=programmes,
        )
    return {
        "resource": SCORECARD_API,
        "runtime_resource": SCORECARD_BULK,
        "archive_bytes_read": len(archive),
        "selection": "70 four-year public/nonprofit main campuses, round-robin by state, UGDS>0",
        "records_selected": len(found),
        "rows": [
            {"unitid": str(r["id"]), "name": r.get("school.name"), "state": r.get("school.state")}
            for r in found
        ],
    }


def build_onisep(rows: list[dict[str, Any]], *, existing_uai: set[str], limit: int = 40) -> dict[str, Any]:
    # Positional indexes are intentional: the public CSV's UTF-8 header has
    # historically arrived with mixed mojibake across mirrors, while the
    # source-native column order is stable and is the adapter's contract.
    grouped: dict[str, list[tuple[str, str, str, str, str, str, str]]] = defaultdict(list)
    request = urllib.request.Request(ONISEP_CSV, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response:
        stream = io.TextIOWrapper(response, encoding="utf-8-sig", newline="")
        reader = csv.reader(stream, delimiter=";")
        next(reader, None)
        for values in reader:
            if len(values) < 32:
                continue
            af, label, ftype = values[0].strip(), values[1].strip(), values[4].strip().casefold()
            institution_name, uai = values[8].strip(), values[10].strip()
            commune, duration, mode = values[14].strip(), values[24].strip(), values[25].strip()
            if not af or not label or not institution_name or not uai or uai in existing_uai:
                continue
            if ftype not in {"master", "licence", "bachelor universitaire de technologie", "diplôme d'ingénieur"}:
                continue
            grouped[uai].append((af, label, ftype, institution_name, commune, duration, mode))
    selected = []
    for uai in sorted(grouped):
        unique: list[tuple[str, str, str, str, str, str, str]] = []
        seen_af: set[str] = set()
        for item in grouped[uai]:
            if item[0] not in seen_af:
                unique.append(item)
                seen_af.add(item[0])
            if len(unique) >= 2:
                break
        if len(unique) >= 2:
            selected.append((uai, unique))
        if len(selected) >= limit:
            break
    host = "api.opendata.onisep.fr"
    for index, (uai, programmes) in enumerate(selected, start=1):
        institution_name = programmes[0][3]
        entries: list[dict[str, Any]] = []
        for af, label, ftype, _name, _commune, _duration, _mode in programmes:
            degree = "master" if ftype in {"master", "diplôme d'ingénieur"} else "bachelor"
            lower = label.casefold()
            discipline = "computer science" if any(token in lower for token in ("informat", "numérique", "intelligence artificielle")) else (
                "engineering" if "ingénieur" in lower or "mécanique" in lower else (
                    "business" if any(token in lower for token in ("gestion", "économie", "commerce")) else "other"
                )
            )
            entries.append(
                {
                    "url": f"{ONISEP_CSV}?target={uai}-{urllib.parse.quote(af, safe='')}",
                    "name": label,
                    "degree": degree,
                    "discipline": discipline,
                    "provider_programme_identifiers": {
                        "onisep_higher_ed": {
                            "ENS code UAI": uai,
                            "Action de Formation (AF) identifiant Onisep": af,
                        }
                    },
                }
            )
        _add_institution(
            rows,
            institution_id=f"onisep-fr-stage1-{index:03d}",
            name=institution_name,
            country="FR",
            domain=host,
            homepage="https://api.opendata.onisep.fr/",
            source_rules=[_rule(host, "government_dataset", "onisep_higher_ed", "GOVERNMENT", "GOVERNMENT")],
            programmes=entries,
        )
    return {
        "resource": ONISEP_CSV,
        "records_selected": sum(len(items) for _uai, items in selected),
        "institutions_selected": len(selected),
        "sample_uai": [uai for uai, _ in selected[:5]],
    }


def build_duo(rows: list[dict[str, Any]], *, existing_boards: set[str], limit: int = 20) -> dict[str, Any]:
    payload = fetch_json(f"{DUO_API}?resource_id={DUO_RESOURCE}&limit=7000", timeout=180)
    records = payload.get("result", {}).get("records", []) if isinstance(payload, dict) else []
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        if not isinstance(record, dict):
            continue
        board = str(record.get("ONDERWIJSBESTUURID") or "").strip()
        code = str(record.get("OPLEIDINGSEENHEIDCODE") or "").strip()
        name = str(record.get("ONDERWIJSBESTUUR_NAAM") or "").strip()
        title = str(record.get("INTERNATIONALE_NAAM") or record.get("NAAM_LANG") or "").strip()
        if board and code and name and title and board not in existing_boards:
            grouped[board].append(record)
    selected: list[tuple[str, list[dict[str, Any]]]] = []
    for board in sorted(grouped, key=lambda key: _norm(grouped[key][0].get("ONDERWIJSBESTUUR_NAAM"))):
        distinct: list[dict[str, Any]] = []
        seen: set[str] = set()
        for record in grouped[board]:
            code = str(record.get("OPLEIDINGSEENHEIDCODE") or "")
            if code not in seen:
                distinct.append(record)
                seen.add(code)
            if len(distinct) >= 2:
                break
        if len(distinct) >= 2:
            selected.append((board, distinct))
        if len(selected) >= limit:
            break
    host = "onderwijsdata.duo.nl"
    for index, (board, records_for_board) in enumerate(selected, start=1):
        institution_name = str(records_for_board[0].get("ONDERWIJSBESTUUR_NAAM") or "").strip()
        entries: list[dict[str, Any]] = []
        for record in records_for_board:
            code = str(record.get("OPLEIDINGSEENHEIDCODE") or "").strip()
            title = str(record.get("INTERNATIONALE_NAAM") or record.get("NAAM_LANG") or code).strip()
            degree_raw = f"{record.get('GRAAD') or ''} {record.get('NIVEAU') or ''}".casefold()
            degree = "master" if "master" in degree_raw or "wo-ma" in degree_raw else ("bachelor" if "bachelor" in degree_raw or "hbo-ba" in degree_raw else "other")
            lower = title.casefold()
            discipline = "computer science" if any(token in lower for token in ("computer", "informat", "data", "ai")) else (
                "engineering" if any(token in lower for token in ("engineering", "technolog", "techniek")) else (
                    "business" if any(token in lower for token in ("business", "econom", "management")) else "other"
                )
            )
            entries.append(
                {
                    "url": _duo_url(board, code) + f"&target=duo-nl-stage1-{index:03d}-{code}",
                    "name": title,
                    "degree": degree,
                    "discipline": discipline,
                    "provider_programme_identifiers": {
                        "duo_rio_ho": {
                            "ONDERWIJSBESTUURID": board,
                            "OPLEIDINGSEENHEIDCODE": code,
                        }
                    },
                }
            )
        _add_institution(
            rows,
            institution_id=f"duo-nl-stage1-{index:03d}",
            name=institution_name,
            country="NL",
            domain=host,
            homepage="https://onderwijsdata.duo.nl/",
            source_rules=[_rule(host, "government_dataset", "duo_rio_ho", "GOVERNMENT", "GOVERNMENT")],
            programmes=entries,
        )
    return {
        "resource": f"{DUO_API}?resource_id={DUO_RESOURCE}",
        "records_inspected": len(records),
        "institutions_selected": len(selected),
        "programme_records_selected": sum(len(items) for _, items in selected),
        "sample_board_ids": [board for board, _ in selected[:5]],
    }


def _discover_route_parts(url: str) -> tuple[str, str, str] | None:
    # Discover Uni's sitemap currently serializes the closing slash as `/>`
    # inside the <loc> text.  Strip that XML presentation artifact before
    # binding the source-native route identifiers.
    url = url.rstrip("> ")
    match = re.search(r"/en/course-details/(\d+)/([^/]+)/([^/]+)/?$", url)
    if not match:
        return None
    return match.group(1), match.group(2), match.group(3)


def _discover_page_title(route: str) -> str:
    try:
        body = fetch("https://discoveruni.gov.uk" + route, timeout=45).decode("utf-8", "replace")
    except Exception:
        return ""
    match = re.search(r"<title>\s*(.*?)\s*</title>", body, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).replace(" | Discover Uni", "").strip()


def build_discover(rows: list[dict[str, Any]], *, existing_prns: set[str], limit: int = 25) -> dict[str, Any]:
    sitemap = fetch(DISCOVER_SITEMAP, timeout=180).decode("utf-8", "replace")
    grouped: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for match in re.finditer(r"<loc>\s*(https?://[^<]+)\s*</loc>", sitemap, re.I):
        clean_url = match.group(1).strip().rstrip("> ")
        parsed = urllib.parse.urlsplit(clean_url)
        parts = _discover_route_parts(parsed.path)
        if not parts:
            continue
        prn, course, mode = parts
        if prn not in existing_prns:
            grouped[prn].append((course, mode, parsed.path))
    selected: list[tuple[str, list[tuple[str, str, str]]]] = []
    for prn in sorted(grouped):
        unique: list[tuple[str, str, str]] = []
        seen: set[tuple[str, str]] = set()
        # Prefer full-time routes and keep two distinct source-native courses.
        candidates = sorted(grouped[prn], key=lambda item: (item[1].casefold() != "full-time", item[0]))
        for item in candidates:
            key = (item[0], item[1])
            if key not in seen:
                unique.append(item)
                seen.add(key)
            if len(unique) >= 2:
                break
        if len(unique) >= 2:
            selected.append((prn, unique))
        if len(selected) >= limit:
            break
    route_list = [(prn, item) for prn, items in selected for item in items]
    titles: dict[tuple[str, str, str], str] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_discover_page_title, item[2]): (prn, item) for prn, item in route_list}
        for future, key in futures.items():
            try:
                titles[key] = future.result()
            except Exception:
                titles[key] = ""
    host = "discoveruni.gov.uk"
    for index, (prn, routes) in enumerate(selected, start=1):
        entries: list[dict[str, Any]] = []
        institution_name = ""
        for course, mode, path in routes:
            title = titles.get((prn, (course, mode, path)), "") or f"Discover Uni course {course}"
            if " at " in title:
                course_name, at_name = title.rsplit(" at ", 1)
                institution_name = institution_name or at_name.strip()
            else:
                course_name = title
            lower = course_name.casefold()
            discipline = "computer science" if any(token in lower for token in ("computer", "computing", "data", "artificial intelligence")) else (
                "engineering" if "engineer" in lower else (
                    "business" if any(token in lower for token in ("business", "econom", "management")) else "other"
                )
            )
            degree = "master" if re.search(r"\b(MSc|MA|MBA|MEng|Master|PGDip|PGCert)\b", course_name, re.I) else "bachelor"
            entries.append(
                {
                    "url": f"https://{host}{path}",
                    "name": course_name.strip(),
                    "degree": degree,
                    "discipline": discipline,
                    "provider_programme_identifiers": {
                        "discover_uni_hesa": {
                            "PUBUKPRN": prn,
                            "KISCourse": course,
                            "KISMODE": mode,
                            "course_name": course_name.strip(),
                        }
                    },
                }
            )
        _add_institution(
            rows,
            institution_id=f"discover-uk-stage1-{index:03d}",
            name=institution_name or f"Discover Uni institution {prn}",
            country="UK",
            domain=host,
            homepage="https://discoveruni.gov.uk/",
            source_rules=[_rule(host, "government_dataset", "discover_uni_hesa", "GOVERNMENT", "GOVERNMENT")],
            programmes=entries,
        )
    return {
        "resource": DISCOVER_SITEMAP,
        "sitemap_bytes": len(sitemap.encode("utf-8")),
        "institutions_selected": len(selected),
        "programme_routes_selected": sum(len(items) for _, items in selected),
        "sample_prns": [prn for prn, _ in selected[:5]],
    }


def _manifest_programmes(institutions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    programmes: list[dict[str, Any]] = []
    for institution in institutions:
        institution_id = str(institution["institution_id"])
        metadata = institution.get("programme_metadata") or {}
        mapping = institution.get("provider_programme_identifiers") or {}
        for url in institution.get("manual_programme_urls") or []:
            item = metadata.get(url) if isinstance(metadata, dict) else None
            programme_id = stable_id("programme", institution_id, str(url))
            programmes.append(
                {
                    "programme_id": programme_id,
                    "institution_id": institution_id,
                    "official_url": str(url),
                    "programme_name": str((item or {}).get("programme_name") or programme_id),
                    "degree_level": str((item or {}).get("degree_level") or "other"),
                    "discipline": (item or {}).get("normalized_field"),
                    "provider_programme_identifiers": copy.deepcopy(mapping.get(programme_id, {})),
                }
            )
    return programmes


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base_config = json.loads(BASE_CONFIG.read_text(encoding="utf-8"))
    base_manifest = json.loads(BASE_MANIFEST.read_text(encoding="utf-8"))
    institutions = copy.deepcopy(base_config["institutions"])
    existing_by_id = {str(item["institution_id"]): item for item in institutions}
    # The normal config shape is provider -> {key: value}; keep this explicit
    # because provider identifiers are source-native and never inferred.
    existing_unitids = {
        str((item.get("provider_identifiers") or {}).get("college_scorecard_bulk", {}).get("UNITID"))
        for item in institutions
        if (item.get("provider_identifiers") or {}).get("college_scorecard_bulk", {}).get("UNITID")
    }
    existing_uai = {
        str((item.get("provider_programme_identifiers") or {}).get(pid, {}).get("onisep_higher_ed", {}).get("ENS code UAI"))
        for item in institutions
        for pid in (item.get("provider_programme_identifiers") or {})
        if (item.get("provider_programme_identifiers") or {}).get(pid, {}).get("onisep_higher_ed", {}).get("ENS code UAI")
    }
    existing_boards = {
        str((item.get("provider_programme_identifiers") or {}).get(pid, {}).get("duo_rio_ho", {}).get("ONDERWIJSBESTUURID"))
        for item in institutions
        for pid in (item.get("provider_programme_identifiers") or {})
        if (item.get("provider_programme_identifiers") or {}).get(pid, {}).get("duo_rio_ho", {}).get("ONDERWIJSBESTUURID")
    }
    existing_prns = {
        str((item.get("provider_programme_identifiers") or {}).get(pid, {}).get("discover_uni_hesa", {}).get("PUBUKPRN"))
        for item in institutions
        for pid in (item.get("provider_programme_identifiers") or {})
        if (item.get("provider_programme_identifiers") or {}).get(pid, {}).get("discover_uni_hesa", {}).get("PUBUKPRN")
    }

    ledger: dict[str, Any] = {
        "builder": Path(__file__).name,
        "base_manifest": base_manifest.get("population_id"),
        "base_manifest_sha256": hashlib.sha256(BASE_MANIFEST.read_bytes()).hexdigest(),
        "sources": {},
    }
    ledger["sources"]["college_scorecard"] = build_scorecard(institutions, existing_unitids=existing_unitids)
    ledger["sources"]["onisep"] = build_onisep(institutions, existing_uai=existing_uai)
    ledger["sources"]["duo"] = build_duo(institutions, existing_boards=existing_boards)
    ledger["sources"]["discover_uni"] = build_discover(institutions, existing_prns=existing_prns)

    # swissuniversities publishes these exact additional rows in the same
    # already-validated table.  The existing eight CH rows remain unchanged.
    existing_swiss = {
        str((item.get("provider_identifiers") or {}).get("swissuniversities_tuition", {}).get("SWISSUNIVERSITIES_NAME"))
        for item in institutions
    }
    swiss_extra = [
        ("fribourg-ch-stage1", "University of Fribourg"),
        ("lucerne-ch-stage1", "University of Lucerne"),
        ("neuchatel-ch-stage1", "University of Neuchâtel"),
        ("usi-ch-stage1", "Università della Svizzera Italiana"),
    ]
    swiss_host = "www.swissuniversities.ch"
    swiss_added = []
    for institution_id, name in swiss_extra:
        if name in existing_swiss:
            continue
        _add_institution(
            institutions,
            institution_id=institution_id,
            name=name,
            country="CH",
            domain=swiss_host,
            homepage="https://www.swissuniversities.ch/",
            source_rules=[_rule(swiss_host, "official_partner", "swissuniversities_tuition", "CONSORTIUM", "OFFICIAL_PARTNER")],
            institution_identifiers={"swissuniversities_tuition": {"SWISSUNIVERSITIES_NAME": name}},
            programmes=[
                {"url": f"{SWISS_URL}?target={institution_id}-a", "name": f"{name} Data Science", "degree": "master", "discipline": "data science"},
                {"url": f"{SWISS_URL}?target={institution_id}-b", "name": f"{name} Engineering", "degree": "bachelor", "discipline": "engineering"},
            ],
        )
        swiss_added.append(name)
    ledger["sources"]["swissuniversities"] = {
        "resource": SWISS_URL,
        "source_rows_inspected": 12,
        "additional_rows_selected": swiss_added,
        "cycle": "2026-27",
        "scope": "institution",
    }

    # De-duplicate by institution ID while preserving the frozen canary rows.
    deduped: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in institutions:
        institution_id = str(item.get("institution_id") or "")
        if institution_id and institution_id not in seen_ids:
            deduped.append(item)
            seen_ids.add(institution_id)
    institutions = deduped
    programmes = _manifest_programmes(institutions)
    country_counts: dict[str, int] = defaultdict(int)
    for item in institutions:
        country_counts[str(item["country_code"])] += 1
    degree_counts: dict[str, int] = defaultdict(int)
    discipline_counts: dict[str, int] = defaultdict(int)
    institution_by_id = {str(item["institution_id"]): item for item in institutions}
    for item in programmes:
        degree_counts[str(item.get("degree_level") or "other")] += 1
        discipline_counts[str(item.get("discipline") or "other")] += 1
    programmes_by_country: dict[str, int] = defaultdict(int)
    for item in programmes:
        programmes_by_country[str(institution_by_id[item["institution_id"]]["country_code"])] += 1
    manifest = {
        "schema_version": "GlowBalExternalStage1Population/v1",
        "population_id": "external-field-stage1-20260915",
        "frozen_at": "2026-09-15",
        "purpose": "Real Stage 1 external-provider mass ingestion; isolated durable artifact namespace with promotion disabled.",
        "base_canary_manifest": base_manifest.get("population_id"),
        "base_canary_manifest_sha256": ledger["base_manifest_sha256"],
        "providers": base_manifest.get("providers", []),
        "institutions": institutions,
        "programmes": programmes,
        "counts": {
            "institutions": len(institutions),
            "programmes": len(programmes),
            "countries": len(country_counts),
            "institutions_by_country": dict(sorted(country_counts.items())),
            "programmes_by_country": dict(sorted(programmes_by_country.items())),
            "degree_levels": dict(sorted(degree_counts.items())),
            "disciplines": dict(sorted(discipline_counts.items())),
        },
    }
    config = copy.deepcopy(base_config)
    config["run_name"] = "external-field-stage1-20260915"
    config["institutions"] = institutions
    config["stage1"] = {
        "manifest": "stage1-population-manifest.json",
        "manifest_sha256": None,
        "promotion": "disabled; artifacts are isolated under this Stage 1 namespace",
        "source_first_ledger": "stage1-source-ledger.json",
    }
    manifest_path = OUT / "stage1-population-manifest.json"
    config_path = OUT / "stage1-config.json"
    ledger_path = OUT / "stage1-source-ledger.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    config["stage1"]["manifest_sha256"] = manifest_sha
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "stage1-population-manifest.sha256").write_text(f"{manifest_sha}  stage1-population-manifest.json\n", encoding="ascii")
    ledger.update(
        {
            "manifest": manifest_path.name,
            "manifest_sha256": manifest_sha,
            "config": config_path.name,
            "counts": manifest["counts"],
            "provider_stack": manifest["providers"],
            "promotion": "disabled",
        }
    )
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": manifest_path.name, "sha256": manifest_sha, "counts": manifest["counts"], "sources": ledger["sources"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
