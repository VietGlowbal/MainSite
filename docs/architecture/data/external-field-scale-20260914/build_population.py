"""Freeze the bounded external-provider scale population and run config.

The values in this file are source-native identifiers/target metadata only.
Evidence values are fetched from the existing provider catalogue at run time;
no factual tuition or admissions value is encoded here.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "services" / "data-ingestion"))
from glowbal_ingestion.models import stable_id  # noqa: E402


SCORECARD = "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution.zip"
SWISS = "https://www.swissuniversities.ch/en/themen/lehre-studium/information-on-studies/tuition-fees/tuition-fees-at-universities"
ONISEP = "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv"
DUO_BASE = "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
DUO_RESOURCE = "ffffa7ad-e6a2-4ba7-9fc2-a09df4128555"


FIELDS = [
    "academic_cycle",
    "academic_transcript",
    "additional_fees",
    "admission_difficulty",
    "application_fee",
    "application_url",
    "career_outcomes",
    "credential",
    "curriculum_overview",
    "duolingo",
    "employment_outcomes",
    "final_deadline",
    "funding_deadline",
    "gpa_scale",
    "graduation_certificate",
    "ielts_overall",
    "ielts_subscores",
    "intakes",
    "international_deadline",
    "learning_outcomes",
    "minimum_degree",
    "minimum_gpa",
    "portfolio",
    "priority_deadline",
    "programme_focus",
    "programme_identity",
    "programme_status",
    "recommendation_letters",
    "required_documents",
    "rolling_admission",
    "scholarships",
    "sop_essay_requirements",
    "specialisations",
    "standardized_tests",
    "subject_prerequisites",
    "toefl",
    "tuition",
    "work_experience",
]


def rule(domain: str, adapter_id: str, provider_id: str, relationship: str, authority: str) -> dict[str, str]:
    return {
        "domain": domain,
        "adapter_id": adapter_id,
        "provider_id": provider_id,
        "reason": f"Frozen scale target for verified {provider_id} source",
        "relationship": relationship,
        "authority": authority,
    }


def duo_url(institution_id: str, programme_id: str) -> str:
    filters = quote(
        json.dumps(
            {
                "ONDERWIJSBESTUURID": institution_id,
                "OPLEIDINGSEENHEIDCODE": programme_id,
            },
            separators=(",", ":"),
        ),
        safe="",
    )
    return f"{DUO_BASE}?resource_id={DUO_RESOURCE}&limit=1&filters={filters}"


def add_institution(
    rows: list[dict[str, object]],
    *,
    institution_id: str,
    name: str,
    country: str,
    domain: str,
    homepage: str,
    source_rule: dict[str, str],
    programmes: list[dict[str, object]],
    institution_identifiers: dict[str, dict[str, str]] | None = None,
) -> None:
    urls: list[str] = []
    metadata: dict[str, dict[str, str]] = {}
    programme_identifiers: dict[str, dict[str, dict[str, str]]] = {}
    frozen_programmes: list[dict[str, object]] = []
    for item in programmes:
        url = str(item["url"])
        urls.append(url)
        metadata[url] = {
            "programme_name": str(item["name"]),
            "degree_level": str(item["degree"]),
            "normalized_field": str(item.get("discipline") or "") or None,
        }
        programme_id = stable_id("programme", institution_id, url)
        provider_ids = item.get("provider_programme_identifiers") or {}
        programme_identifiers[programme_id] = {
            str(provider): {str(key): str(value) for key, value in identifiers.items()}
            for provider, identifiers in provider_ids.items()
        }
        frozen_programmes.append(
            {
                "programme_id": programme_id,
                "official_url": url,
                "programme_name": str(item["name"]),
                "degree_level": str(item["degree"]),
                "discipline": item.get("discipline"),
                "provider_programme_identifiers": provider_ids,
            }
        )
    row = {
        "institution_id": institution_id,
        "name": name,
        "country_code": country,
        "region": "Europe" if country != "US" else "North America",
        "official_domain": domain,
        "homepage_url": homepage,
        "allowed_domains": [domain],
        "manual_only": True,
        "terms_status": "UNREVIEWED",
        "manual_programme_urls": urls,
        "programme_metadata": metadata,
        "provider_identifiers": institution_identifiers or {},
        "provider_programme_identifiers": programme_identifiers,
        "external_source_rules": [source_rule],
    }
    rows.append({**row, "_frozen_programmes": frozen_programmes})


institutions: list[dict[str, object]] = []

# United States: source-native College Scorecard UNITID; institution scope.
us_targets = [
    ("mit-us-scale", "Massachusetts Institute of Technology", "166683", "MIT Computer Science", "master"),
    ("cornell-us-scale", "Cornell University", "190415", "Cornell Information Science", "master"),
    ("harvard-us-scale", "Harvard University", "166027", "Harvard Computer Science", "master"),
    ("stanford-us-scale", "Stanford University", "243744", "Stanford Computer Science", "master"),
    ("berkeley-us-scale", "University of California-Berkeley", "110635", "Berkeley Data Science", "master"),
]
for institution_id, name, unitid, p1, degree in us_targets:
    host = "ed-public-download.scorecard.network"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="US",
        domain=host,
        homepage="https://ed-public-download.scorecard.network/",
        source_rule=rule(host, "college_scorecard", "college_scorecard_bulk", "GOVERNMENT", "GOVERNMENT"),
        institution_identifiers={"college_scorecard_bulk": {"UNITID": unitid}},
        programmes=[
            {"url": SCORECARD + f"?target={institution_id}-a", "name": p1, "degree": degree, "discipline": "computer science"},
            {"url": SCORECARD + f"?target={institution_id}-b", "name": p1 + " (alternate)", "degree": "bachelor", "discipline": "data science"},
        ],
    )

# Switzerland: exact names from the current swissuniversities table; institution scope.
for institution_id, name in [
    ("eth-zurich-ch-scale", "ETH Zurich"),
    ("epfl-ch-scale", "EPFL"),
    ("uzh-ch-scale", "University of Zurich"),
    ("geneva-ch-scale", "University of Geneva"),
    ("lausanne-ch-scale", "University of Lausanne"),
]:
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="CH",
        domain="www.swissuniversities.ch",
        homepage="https://www.swissuniversities.ch/",
        source_rule=rule("www.swissuniversities.ch", "official_partner", "swissuniversities_tuition", "CONSORTIUM", "OFFICIAL_PARTNER"),
        institution_identifiers={"swissuniversities_tuition": {"SWISSUNIVERSITIES_NAME": name}},
        programmes=[
            {"url": SWISS + f"?target={institution_id}-a", "name": f"{name} Data Science", "degree": "master", "discipline": "data science"},
            {"url": SWISS + f"?target={institution_id}-b", "name": f"{name} Engineering", "degree": "bachelor", "discipline": "engineering"},
        ],
    )

# France: exact Onisep UAI + AF identifiers from the published CSV.
fr_targets = [
    ("sorbonne-fr-scale", "Sorbonne Université", "0755283K", [("AF.86527", "Licence mention informatique", "bachelor"), ("AF.84654", "Master mention informatique", "master")]),
    ("uco-nantes-fr-scale", "Facultés libres de l'Ouest - UCO Nantes", "0442777E", [("AF.45876", "Licence mention information-communication", "bachelor"), ("AF.109027", "Licence mention science politique", "bachelor")]),
    ("centrale-lyon-fr-scale", "École centrale de Lyon", "0690187D", [("AF.30276", "Master mention informatique", "master"), ("AF.60342", "Master mention chimie et sciences des matériaux", "master")]),
    ("ens-paris-saclay-fr-scale", "École normale supérieure Paris-Saclay", "0912423P", [("AF.43970", "Master mention physique fondamentale et applications", "master"), ("AF.19718", "Master mention biologie-santé", "master")]),
    ("insa-lyon-fr-scale", "Institut national des sciences appliquées de Lyon", "0690192J", [("AF.109653", "Master mention IA - intelligence artificielle", "master"), ("AF.133979", "Bachelor en sciences et ingénierie - génie énergétique et environnement", "bachelor")]),
]
for institution_id, name, uai, programmes in fr_targets:
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="FR",
        domain="api.opendata.onisep.fr",
        homepage="https://api.opendata.onisep.fr/",
        source_rule=rule("api.opendata.onisep.fr", "government_dataset", "onisep_higher_ed", "GOVERNMENT", "GOVERNMENT"),
        programmes=[
            {
                "url": ONISEP + f"?target={uai}-{quote(af, safe='')}",
                "name": pname,
                "degree": degree,
                "discipline": "computer science" if "informat" in pname.lower() or "IA" in pname else "other",
                "provider_programme_identifiers": {"onisep_higher_ed": {"ENS code UAI": uai, "Action de Formation (AF) identifiant Onisep": af}},
            }
            for af, pname, degree in programmes
        ],
    )

# United Kingdom: source-native Discover Uni route identifiers from the official search API.
uk_targets = [
    ("oxford-uk-scale", "Oxford University", "10007774", [("G400", "Computer Science (3 or 4 years)"), ("GG14", "Mathematics and Computer Science")]),
    ("cambridge-uk-scale", "University of Cambridge", "10007788", [("UG_CSTX", "Computer Science"), ("UG_NSTX", "Natural Sciences")]),
    ("imperial-uk-scale", "Imperial College London", "10003270", [("GG14", "Mathematics and Computer Science"), ("GG41", "Mathematics and Computer Science")]),
    ("nottingham-uk-scale", "University of Nottingham", "10007154", [("G400", "Computer Science"), ("G404", "Computer Science")]),
]
for institution_id, name, prn, programmes in uk_targets:
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="UK",
        domain="discoveruni.gov.uk",
        homepage="https://discoveruni.gov.uk/",
        source_rule=rule("discoveruni.gov.uk", "government_dataset", "discover_uni_hesa", "GOVERNMENT", "GOVERNMENT"),
        programmes=[
            {
                "url": f"https://discoveruni.gov.uk/course-details/{prn}/{course}/Full-time/",
                "name": pname,
                "degree": "bachelor",
                "discipline": "computer science",
                "provider_programme_identifiers": {"discover_uni_hesa": {"PUBUKPRN": prn, "KISCourse": course, "KISMODE": "Full-time", "course_name": pname}},
            }
            for course, pname in programmes
        ],
    )

# Netherlands: exact DUO RIO institution/programme IDs and server-filtered rows.
nl_targets = [
    ("tu-delft-nl-scale", "Delft University of Technology", "107B605", [("1001O8897", "Data Science and Artificial Intelligence Technology", "master"), ("1001O6612", "Computer Science", "master")]),
    ("uva-nl-scale", "Universiteit van Amsterdam", "107B473", [("1001O6172", "Informatica", "bachelor"), ("1001O5623", "Cultuurwetenschappen", "bachelor")]),
    ("tue-nl-scale", "Technische Universiteit Eindhoven", "107B450", [("1001O6777", "Sustainable Energy Technology", "master"), ("1001O6650", "Embedded Systems", "master")]),
    ("leiden-nl-scale", "Universiteit Leiden", "107B578", [("1001O7137", "Statistics and Data Science", "master"), ("1001O5903", "Geneeskunde", "bachelor")]),
]
for institution_id, name, bestuur, programmes in nl_targets:
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="NL",
        domain="onderwijsdata.duo.nl",
        homepage="https://onderwijsdata.duo.nl/",
        source_rule=rule("onderwijsdata.duo.nl", "government_dataset", "duo_rio_ho", "GOVERNMENT", "GOVERNMENT"),
        programmes=[
            {
                "url": duo_url(bestuur, code) + f"&target={institution_id}-{code}",
                "name": pname,
                "degree": degree,
                "discipline": "computer science" if "computer" in pname.lower() or "data" in pname.lower() or "informat" in pname.lower() else "other",
                "provider_programme_identifiers": {"duo_rio_ho": {"ONDERWIJSBESTUURID": bestuur, "OPLEIDINGSEENHEIDCODE": code}},
            }
            for code, pname, degree in programmes
        ],
    )


frozen_programmes = [p for institution in institutions for p in institution.pop("_frozen_programmes")]
manifest = {
    "schema_version": "GlowBalExternalScalePopulation/v1",
    "population_id": "external-field-scale-20260914",
    "frozen_at": "2026-09-14",
    "purpose": "Representative external-only coverage measurement; target URLs are identifiers, not official-web evidence.",
    "providers": ["college_scorecard_bulk", "swissuniversities_tuition", "onisep_higher_ed", "discover_uni_hesa", "duo_rio_ho"],
    "institutions": institutions,
    "programmes": frozen_programmes,
    "counts": {
        "institutions": len(institutions),
        "programmes": len(frozen_programmes),
        "countries": len({str(i["country_code"]) for i in institutions}),
    },
}

ecosystem = {
    "enabled": True,
    "runtime_acquisition_enabled": True,
    "acquisition_mode": "external_source_expansion",
    "external_only": True,
    "field_groups": FIELDS,
    "max_fetches_per_institution": 4,
    "external_provider_catalogue": "../../../../services/data-ingestion/configs/external-providers.json",
    "external_provider_ids": manifest["providers"],
    "official_web": {"enabled": False},
    "official_catalogue": {"enabled": False},
    "pdf": {"enabled": False},
    "structured_apis": {"enabled": False},
    "government_datasets": {"enabled": True, "providers": ["college_scorecard", "government_dataset"]},
    "official_registries": {"enabled": False},
    "accreditation": {"enabled": False},
    "official_partners": {"enabled": True},
    "archives": {"enabled": False},
    "search_discovery": {"enabled": False},
    "external_authoritative": {"enabled": False},
    "required_source_classes": ["government_dataset"],
}
config = {
    "schema_version": "GlowBalExternalFieldScale/v1",
    "run_name": "external-field-scale-20260914",
    "acquisition_backend": "legacy",
    "raw_evidence_mode": "remote",
    "raw_evidence_inline_max_bytes": 8388608,
    "source_ecosystem": ecosystem,
    "limits": {
        "global_concurrency": 2,
        "institution_concurrency": 2,
        "programme_concurrency_per_institution": 1,
        "per_domain_concurrency": 1,
        "request_timeout_seconds": 90,
        "connect_timeout_seconds": 20,
        "max_html_bytes": 5242880,
        "large_raw_object_threshold_bytes": 8388608,
        "max_local_temp_bytes": 0,
        "max_deep_programmes_per_institution": 2,
        "max_deep_sources_per_programme": 1,
        "max_admission_retry_sources_per_programme": 0,
        "max_coverage_retry_sources_per_programme": 0,
        "max_source_recovery_candidates": 0,
        "max_llm_retries": 1,
        "max_sources_per_extraction_group": 1,
        "max_source_chars_per_extraction_group": 40000,
        "min_request_interval_seconds": 1.0,
    },
    "institutions": institutions,
}

(OUT / "population-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(OUT / "population-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest["counts"], indent=2))
