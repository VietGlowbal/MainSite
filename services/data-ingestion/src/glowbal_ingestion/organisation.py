from __future__ import annotations

import gzip
import json
import re
from dataclasses import replace
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit

from .models import (
    OrganisationUnit,
    OrganisationUnitType,
    ProgrammeOrganisationUnit,
    VerificationStatus,
    stable_id,
)
from .parsing import _decode_html, normalize_text


UNIT_TOKEN = r"school|college|faculty|division|institute|department"
LEADING_UNIT_RE = re.compile(
    rf"^(?P<type>{UNIT_TOKEN})\s+of\s+"
    r"(?P<name>[A-Z][A-Za-z0-9&,'’\-/ ]{2,90})$",
    re.IGNORECASE,
)
TRAILING_UNIT_RE = re.compile(
    r"^(?P<name>[A-Z][A-Za-z0-9&,'’\-/ ]{2,90}?)\s+"
    rf"(?P<type>{UNIT_TOKEN})$",
    re.IGNORECASE,
)
GENERIC_UNIT_RE = re.compile(
    rf"\b(?:{UNIT_TOKEN})s?\s+(?:and|&)\s+(?:programmes?|programs?|"
    rf"departments?)\b|\bdepartments?\s+of\s+instruction\b",
    re.IGNORECASE,
)
SPLIT_SIGNAL_RE = re.compile(r"\s*(?:\||•|»|›|—|–| - )\s*")
UNIT_RANK = {
    OrganisationUnitType.SCHOOL: 1,
    OrganisationUnitType.COLLEGE: 1,
    OrganisationUnitType.FACULTY: 1,
    OrganisationUnitType.DIVISION: 1,
    OrganisationUnitType.INSTITUTE: 1,
    OrganisationUnitType.DEPARTMENT: 2,
    OrganisationUnitType.OTHER: 3,
}
HOST_UNIT_HINTS = {
    "sps.columbia.edu": ("School of Professional Studies", "school"),
    "gs.columbia.edu": ("School of General Studies", "school"),
    "engineering.columbia.edu": (
        "Fu Foundation School of Engineering and Applied Science",
        "school",
    ),
    "engineering.nyu.edu": ("Tandon School of Engineering", "school"),
    "stern.nyu.edu": ("Stern School of Business", "school"),
    "med.nyu.edu": ("Grossman School of Medicine", "school"),
    "sph.umich.edu": ("School of Public Health", "school"),
    "michiganross.umich.edu": ("Ross School of Business", "school"),
    "seas.harvard.edu": (
        "John A. Paulson School of Engineering and Applied Sciences",
        "school",
    ),
    "gsas.harvard.edu": (
        "Kenneth C. Griffin Graduate School of Arts and Sciences",
        "school",
    ),
    "lti.cmu.edu": ("School of Computer Science", "school"),
    "hcii.cmu.edu": ("School of Computer Science", "school"),
    "bme.duke.edu": ("Pratt School of Engineering", "school"),
    "cee.duke.edu": ("Pratt School of Engineering", "school"),
    "ece.duke.edu": ("Pratt School of Engineering", "school"),
    "mems.duke.edu": ("Pratt School of Engineering", "school"),
    "fitzpatrick.duke.edu": ("Pratt School of Engineering", "school"),
    "divinity.duke.edu": ("Duke Divinity School", "school"),
    "www.fuqua.duke.edu": ("Fuqua School of Business", "school"),
    "harris.uchicago.edu": (
        "Harris School of Public Policy",
        "school",
    ),
    "crownschool.uchicago.edu": (
        "Crown Family School of Social Work, Policy, and Practice",
        "school",
    ),
    "divinity.uchicago.edu": ("Divinity School", "school"),
    "www.law.uchicago.edu": ("University of Chicago Law School", "school"),
    "www.cs.stanford.edu": ("School of Engineering", "school"),
    "ee.stanford.edu": ("School of Engineering", "school"),
    "gsas.yale.edu": ("Graduate School of Arts and Sciences", "school"),
}
PATH_UNIT_HINTS = {
    "/columbia-college/": ("Columbia College", "college"),
    "/general-studies/": ("School of General Studies", "school"),
}


class _OrganisationSignalParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: list[str] = []
        self.site_names: list[str] = []
        self.breadcrumbs: list[str] = []
        self.json_ld: list[str] = []
        self._in_title = False
        self._breadcrumb_depth = 0
        self._breadcrumb_stack: list[bool] = []
        self._script_type: str | None = None
        self._script_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = {key.casefold(): value or "" for key, value in attrs}
        lowered = tag.casefold()
        marker = " ".join(
            (
                attributes.get("id", ""),
                attributes.get("class", ""),
                attributes.get("aria-label", ""),
                attributes.get("role", ""),
            )
        ).casefold()
        is_breadcrumb = "breadcrumb" in marker
        self._breadcrumb_stack.append(is_breadcrumb)
        if is_breadcrumb:
            self._breadcrumb_depth += 1
        if lowered == "title":
            self._in_title = True
        if lowered == "meta":
            key = (
                attributes.get("property")
                or attributes.get("name")
            ).casefold()
            if key in {"og:site_name", "application-name"}:
                value = normalize_text(attributes.get("content", ""))
                if value:
                    self.site_names.append(value)
        if lowered == "script":
            self._script_type = attributes.get("type", "").casefold()
            self._script_parts = []

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.casefold()
        if lowered == "title":
            self._in_title = False
        if lowered == "script":
            if self._script_type == "application/ld+json":
                value = "".join(self._script_parts).strip()
                if value:
                    self.json_ld.append(value)
            self._script_type = None
            self._script_parts = []
        if self._breadcrumb_stack:
            if self._breadcrumb_stack.pop():
                self._breadcrumb_depth = max(0, self._breadcrumb_depth - 1)

    def handle_data(self, data: str) -> None:
        value = normalize_text(data)
        if not value:
            return
        if self._in_title:
            self.title.append(value)
        if self._breadcrumb_depth:
            self.breadcrumbs.append(value)
        if self._script_type == "application/ld+json":
            self._script_parts.append(data)


def _json_ld_breadcrumbs(payload: Any) -> Iterable[str]:
    if isinstance(payload, list):
        for item in payload:
            yield from _json_ld_breadcrumbs(item)
        return
    if not isinstance(payload, dict):
        return
    item_type = str(payload.get("@type") or "").casefold()
    if item_type == "breadcrumblist":
        for item in payload.get("itemListElement") or []:
            if not isinstance(item, dict):
                continue
            nested = item.get("item")
            name = item.get("name")
            if not name and isinstance(nested, dict):
                name = nested.get("name")
            if isinstance(name, str) and normalize_text(name):
                yield normalize_text(name)
    for value in payload.values():
        yield from _json_ld_breadcrumbs(value)


def _unit_type(value: str) -> OrganisationUnitType:
    try:
        return OrganisationUnitType(value.casefold())
    except ValueError:
        return OrganisationUnitType.OTHER


def _clean_unit_name(unit_type: OrganisationUnitType, value: str) -> str:
    cleaned = normalize_text(value).strip(" ,.;:-")
    prefix = unit_type.value.title()
    if re.match(rf"^{re.escape(prefix)}\s+of\b", cleaned, re.IGNORECASE):
        return cleaned
    if re.search(rf"\b{re.escape(prefix)}$", cleaned, re.IGNORECASE):
        return cleaned
    return f"{prefix} of {cleaned}"


def _mentions_from_signal(value: str) -> list[tuple[str, OrganisationUnitType, str]]:
    signal = normalize_text(value)
    if not signal or GENERIC_UNIT_RE.search(signal):
        return []
    mentions: list[tuple[str, OrganisationUnitType, str]] = []
    for part in SPLIT_SIGNAL_RE.split(signal):
        if re.search(
            r"\b(?:bachelor|master|recommended by|requirements?|catalog)\b",
            part,
            re.IGNORECASE,
        ):
            continue
        for pattern in (LEADING_UNIT_RE, TRAILING_UNIT_RE):
            for match in pattern.finditer(part):
                unit_type = _unit_type(match.group("type"))
                unit_name = _clean_unit_name(unit_type, match.group(0))
                if len(unit_name) > 110:
                    continue
                mentions.append((unit_name, unit_type, match.group(0)))
    return mentions


def _slug_unit(value: str) -> tuple[str, OrganisationUnitType] | None:
    match = re.fullmatch(
        r"(?P<type>school|college|faculty|division|institute)-of-(?P<name>.+)",
        value.casefold(),
    )
    if not match:
        return None
    unit_type = _unit_type(match.group("type"))
    name = " ".join(
        word if word in {"and", "of", "the"} else word.title()
        for word in match.group("name").split("-")
    )
    return _clean_unit_name(unit_type, name), unit_type


def _curated_mentions(
    *,
    institution_name: str,
    programme_name: str,
    normalized_field: str,
    degree_level: str,
    source_url: str,
) -> list[tuple[str, OrganisationUnitType, str]]:
    host = (urlsplit(source_url).hostname or "").casefold()
    path = urlsplit(source_url).path.casefold()
    institution = institution_name.casefold()
    programme = programme_name.casefold()
    evidence = source_url
    results: list[tuple[str, OrganisationUnitType, str]] = []

    for segment in path.split("/"):
        inferred = _slug_unit(segment)
        if inferred:
            results.append((*inferred, evidence))

    def add(name: str, unit_type: str = "school") -> None:
        results.append((name, _unit_type(unit_type), evidence))

    if "massachusetts institute of technology" in institution:
        if any(token in path for token in ("course-6", "course-10", "course-2")) or any(
            token in programme
            for token in (
                "engineering",
                "computational science",
                "computer science",
                "artifical intelligence",
            )
        ):
            add("School of Engineering")
        elif "urban" in programme:
            add("School of Architecture and Planning")
        elif "economics" in programme:
            add("School of Humanities, Arts, and Social Sciences")
        else:
            add("School of Science")
    elif "northwestern university" in institution:
        if "/sps/" in path:
            add("School of Professional Studies")
        elif "/law/" in path:
            add("Pritzker School of Law")
        elif "/arts-sciences/" in path or "liberal-arts" in path:
            add("Weinberg College of Arts and Sciences", "college")
        elif "engineering" in path:
            add("McCormick School of Engineering")
        elif "communication" in path:
            add("School of Communication")
        elif "music" in path:
            add("Bienen School of Music")
    elif "university of chicago" in institution:
        if host == "cam.uchicago.edu":
            add("Physical Sciences Division", "division")
        elif host == "cmes.uchicago.edu":
            add("Division of the Social Sciences", "division")
        elif host == "grad.uchicago.edu":
            add("Division of the Humanities", "division")
    elif "california institute of technology" in institution:
        if any(token in programme for token in ("history", "philosophy", "economics", "business", "political", "interdisciplinary")):
            add("Division of the Humanities and Social Sciences", "division")
        elif "biology" in programme:
            add("Division of Biology and Biological Engineering", "division")
        elif "chem" in programme:
            add("Division of Chemistry and Chemical Engineering", "division")
        elif any(token in programme for token in ("physics", "mathematics", "applied physics")):
            add("Division of Physics, Mathematics and Astronomy", "division")
        else:
            add("Division of Engineering and Applied Science", "division")
    elif "cornell university" in institution:
        if any(
            token in programme
            for token in (
                "mechanical engineering",
                "operations research",
                "information science, systems",
            )
        ) or ("computer science" in programme and "(ba)" not in programme):
            add("College of Engineering", "college")
        elif "computer science" in programme:
            add("College of Arts and Sciences", "college")
        elif "information science" in programme:
            add(
                "Bowers College of Computing and Information Science",
                "college",
            )
    elif "university of california-berkeley" in institution:
        if "epidemiology" in programme:
            add("School of Public Health")
        elif any(
            token in programme
            for token in (
                "ag & resource",
                "agricuture and resource",
                "environmental economics",
            )
        ):
            add("Rausser College of Natural Resources", "college")
        elif any(
            token in programme
            for token in (
                "civil",
                "electrical",
                "computer engineering",
            )
        ) or ("computer science" in programme and degree_level != "bachelor"):
            add("College of Engineering", "college")
        else:
            add("College of Letters and Science", "college")
    elif "university of california-los angeles" in institution:
        if "/physical-sciences/" in path:
            add("Division of Physical Sciences", "division")
        elif "/social-sciences/" in path:
            add("Division of Social Sciences", "division")
        elif host == "luskin.ucla.edu":
            add("Luskin School of Public Affairs")
        elif "management" in path or "mba" in path:
            add("Anderson School of Management")
    elif "university of michigan" in institution:
        if host.endswith(".engin.umich.edu") or host == "bme.umich.edu":
            add("College of Engineering", "college")
        elif host == "lsa.umich.edu":
            add("College of Literature, Science, and the Arts", "college")
        elif host == "www.si.umich.edu":
            add("School of Information")
    elif "georgia institute of technology" in institution:
        if "business" in programme:
            add("Scheller College of Business", "college")
        elif "computer science" in programme:
            add("College of Computing", "college")
        elif "geographic information" in programme:
            add("College of Design", "college")
        else:
            add("College of Engineering", "college")
    elif "carnegie mellon university" in institution:
        if "dietrich-college" in path:
            add("Dietrich College of Humanities and Social Sciences", "college")
        elif "mellon-college" in path:
            add("Mellon College of Science", "college")
    elif "university of illinois" in institution:
        segment = next(
            (
                item
                for item in path.split("/")
                if item in {"aces", "bus", "education", "engineering"}
                or item.startswith("eng_")
            ),
            "",
        )
        if segment == "aces":
            add("College of Agricultural, Consumer and Environmental Sciences", "college")
        elif segment == "bus":
            add("Gies College of Business", "college")
        elif segment == "education":
            add("College of Education", "college")
        elif segment:
            add("Grainger College of Engineering", "college")
    elif "new york university" in institution:
        if "/engineering/" in path:
            add("Tandon School of Engineering")
        elif "/arts-science/" in path:
            add(
                "Graduate School of Arts and Science"
                if degree_level in {"master", "phd"}
                else "College of Arts and Science",
                "school" if degree_level in {"master", "phd"} else "college",
            )
        elif "/abu-dhabi/" in path:
            add("NYU Abu Dhabi", "other")
        elif "/shanghai/" in path:
            add("NYU Shanghai", "other")
    elif "stanford university" in institution:
        if any(token in programme for token in ("computer", "engineering")):
            add("School of Engineering")
        else:
            add("School of Humanities and Sciences")
    elif "yale university" in institution:
        if "/ycps/" in path:
            add("Yale College", "college")
        else:
            add("Graduate School of Arts and Sciences")
    elif "princeton university" in institution:
        if "bachelor-science-engineering" in path:
            add("School of Engineering and Applied Science")
        elif "princeton-school-public" in path:
            add("Princeton School of Public and International Affairs")
        else:
            department_name = re.sub(
                r"\s*\([^)]*\)\s*$", "", programme_name
            ).strip()
            add(f"Department of {department_name}", "department")
    elif "university of pennsylvania" in institution:
        if any(token in programme for token in ("business", "operations", "behavioral economics")):
            add("Wharton School")
        elif any(token in programme for token in ("computer", "information")) and (
            degree_level == "master" or str(normalized_field).casefold() == "computer_science"
        ):
            add("School of Engineering and Applied Science")
        else:
            add("College of Arts and Sciences", "college")
    elif "johns hopkins university" in institution:
        if "/public-health/" in path:
            add("Bloomberg School of Public Health")
        elif "/arts-sciences/" in path:
            add("Krieger School of Arts and Sciences")

    return results


def extract_organisation_mentions(
    html: str,
    *,
    source_url: str,
) -> list[tuple[str, OrganisationUnitType, str]]:
    parser = _OrganisationSignalParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    signals = [
        *parser.breadcrumbs,
        *parser.site_names,
        " | ".join(parser.title),
    ]
    for match in re.finditer(
        r"<(?P<tag>[a-z0-9]+)[^>]+class=[\"'][^\"']*"
        r"(?:college-text|program-info|program-meta)[^\"']*[\"'][^>]*>"
        r"(?P<body>.*?)</(?P=tag)>",
        html,
        re.IGNORECASE | re.DOTALL,
    ):
        value = normalize_text(
            unescape(re.sub(r"<[^>]+>", " ", match.group("body")))
        )
        if value:
            signals.extend(part.strip() for part in value.split(","))
    for encoded in parser.json_ld:
        try:
            signals.extend(_json_ld_breadcrumbs(json.loads(encoded)))
        except json.JSONDecodeError:
            continue
    mentions: list[tuple[str, OrganisationUnitType, str]] = []
    hostname = (urlsplit(source_url).hostname or "").casefold()
    for host, (name, type_name) in HOST_UNIT_HINTS.items():
        if hostname == host or hostname.endswith(f".{host}"):
            mentions.append((name, _unit_type(type_name), source_url))
            break
    path = urlsplit(source_url).path.casefold()
    for marker, (name, type_name) in PATH_UNIT_HINTS.items():
        if marker in path:
            mentions.append((name, _unit_type(type_name), source_url))
            break
    for signal in signals:
        mentions.extend(_mentions_from_signal(signal))
    unique: list[tuple[str, OrganisationUnitType, str]] = []
    seen: set[tuple[str, str]] = set()
    for name, unit_type, evidence in mentions:
        key = (name.casefold(), unit_type.value)
        if key in seen:
            continue
        seen.add(key)
        unique.append((name, unit_type, evidence))
    unique.sort(key=lambda item: UNIT_RANK[item[1]])
    return unique


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _raw_html(run_dir: Path, source: dict[str, Any]) -> str | None:
    relative = source.get("raw_object_path")
    if not isinstance(relative, str) or not relative.endswith(".html.gz"):
        return None
    path = run_dir / relative
    if not path.is_file():
        return None
    try:
        with gzip.open(path, "rb") as handle:
            return _decode_html(handle.read(), source.get("content_type"))
    except OSError:
        return None


def backfill_organisation_hierarchy(run_dir: Path) -> dict[str, int | float]:
    run_dir = run_dir.resolve()
    programmes_path = run_dir / "programmes.jsonl"
    programmes = _read_jsonl(programmes_path)
    institutions = _read_jsonl(run_dir / "institutions.jsonl")
    institution_by_id = {
        str(record.get("institution_id") or ""): record
        for record in institutions
    }
    sources = _read_jsonl(run_dir / "sources.jsonl")
    offerings = _read_jsonl(run_dir / "programme_offerings.jsonl")
    offered_ids = {
        str(record.get("programme_id") or "") for record in offerings
    }
    source_by_url = {
        str(record.get("canonical_url") or record.get("url") or "")
        .rstrip("/")
        .casefold(): record
        for record in sources
    }
    units_by_id: dict[str, OrganisationUnit] = {}
    relationships: list[ProgrammeOrganisationUnit] = []
    updated_programmes: list[dict[str, Any]] = []
    classified = 0
    for programme in programmes:
        programme_id = str(programme.get("programme_id") or "")
        if programme_id not in offered_ids:
            updated_programmes.append(programme)
            continue
        source_url = str(programme.get("official_url") or "")
        source = source_by_url.get(source_url.rstrip("/").casefold())
        html = _raw_html(run_dir, source) if source else None
        mentions = extract_organisation_mentions(
            html or "",
            source_url=source_url,
        )
        institution = institution_by_id.get(
            str(programme.get("institution_id") or ""), {}
        )
        mentions.extend(
            _curated_mentions(
                institution_name=str(
                    institution.get("canonical_name")
                    or institution.get("institution_name")
                    or ""
                ),
                programme_name=str(programme.get("programme_name") or ""),
                normalized_field=str(
                    programme.get("normalized_field") or ""
                ),
                degree_level=str(programme.get("degree_level") or ""),
                source_url=source_url,
            )
        )
        deduplicated: list[
            tuple[str, OrganisationUnitType, str]
        ] = []
        seen_mentions: set[tuple[str, str]] = set()
        for mention in mentions:
            key = (mention[0].casefold(), mention[1].value)
            if key in seen_mentions:
                continue
            seen_mentions.add(key)
            deduplicated.append(mention)
        mentions = sorted(
            deduplicated,
            key=lambda item: UNIT_RANK[item[1]],
        )
        if not mentions:
            updated_programmes.append(programme)
            continue
        institution_id = str(programme.get("institution_id") or "")
        parent_id: str | None = None
        unit_ids: list[str] = []
        last_rank = 0
        for name, unit_type, evidence in mentions:
            rank = UNIT_RANK[unit_type]
            if rank <= last_rank:
                parent_id = None
            unit_id = stable_id(
                "organisation_unit",
                institution_id,
                unit_type.value,
                name.casefold(),
            )
            existing = units_by_id.get(unit_id)
            if existing is None:
                units_by_id[unit_id] = OrganisationUnit(
                    organisation_unit_id=unit_id,
                    institution_id=institution_id,
                    parent_organisation_unit_id=parent_id,
                    unit_name=name,
                    unit_type=unit_type,
                    official_url=None,
                    source_url=source_url,
                    evidence=evidence,
                    confidence=0.9,
                    verification_status=VerificationStatus.NEEDS_REVIEW,
                    retrieved_at=str(
                        (source or {}).get("retrieved_at")
                        or programme.get("retrieved_at")
                        or ""
                    ),
                )
            unit_ids.append(unit_id)
            parent_id = unit_id
            last_rank = rank
        primary_id = unit_ids[-1]
        programme = {**programme, "organisation_unit_id": primary_id}
        updated_programmes.append(programme)
        classified += 1
        for unit_id in dict.fromkeys(unit_ids):
            unit = units_by_id[unit_id]
            relationships.append(
                ProgrammeOrganisationUnit(
                    programme_id=programme_id,
                    organisation_unit_id=unit_id,
                    relationship_type=(
                        "administered_by" if unit_id == primary_id else "offered_by"
                    ),
                    is_primary=unit_id == primary_id,
                    source_url=source_url,
                    evidence=unit.evidence,
                    confidence=unit.confidence,
                    verification_status=unit.verification_status,
                )
            )
    programmes_path.write_text(
        "".join(
            json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n"
            for record in updated_programmes
        ),
        encoding="utf-8",
    )
    (run_dir / "organisation_units.jsonl").write_text(
        "".join(unit.to_json() + "\n" for unit in units_by_id.values()),
        encoding="utf-8",
    )
    (run_dir / "programme_organisation_units.jsonl").write_text(
        "".join(record.to_json() + "\n" for record in relationships),
        encoding="utf-8",
    )
    total = len(offered_ids)
    return {
        "programme_count": total,
        "classified_programmes": classified,
        "unclassified_programmes": total - classified,
        "coverage_ratio": round(classified / total, 4) if total else 0.0,
        "organisation_units": len(units_by_id),
        "programme_unit_relationships": len(relationships),
    }
