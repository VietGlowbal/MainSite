"""Freeze the 100-programme external-provider pre-production canary.

This manifest contains only source-native identifiers and target metadata.  It
does not encode provider facts and it deliberately keeps all product
promotion disabled: the runner writes into the canary artifact namespace only.
"""

from __future__ import annotations

import hashlib
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
        "reason": f"Frozen external canary target for verified {provider_id} source",
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
    source_rules: list[dict[str, str]],
    programmes: list[dict[str, object]],
    institution_identifiers: dict[str, dict[str, str]] | None = None,
) -> None:
    urls: list[str] = []
    metadata: dict[str, dict[str, object]] = {}
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
            str(provider): {
                str(key): str(value) for key, value in identifiers.items()
            }
            for provider, identifiers in provider_ids.items()
        }
        frozen_programmes.append(
            {
                "programme_id": programme_id,
                "institution_id": institution_id,
                "official_url": url,
                "programme_name": str(item["name"]),
                "degree_level": str(item["degree"]),
                "discipline": item.get("discipline"),
                "provider_programme_identifiers": provider_ids,
            }
        )
    rows.append(
        {
            "institution_id": institution_id,
            "name": name,
            "country_code": country,
            "region": "North America" if country == "US" else "Europe",
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
            "_frozen_programmes": frozen_programmes,
        }
    )


institutions: list[dict[str, object]] = []


# United States: exact College Scorecard UNITIDs; institution-scope source.
us_targets = [
    ("mit-us-canary", "Massachusetts Institute of Technology", "166683", "MIT Computer Science", "master", "computer science"),
    ("cornell-us-canary", "Cornell University", "190415", "Cornell Information Science", "master", "data science"),
    ("harvard-us-canary", "Harvard University", "166027", "Harvard Computer Science", "master", "computer science"),
    ("stanford-us-canary", "Stanford University", "243744", "Stanford Computer Science", "master", "computer science"),
    ("berkeley-us-canary", "University of California-Berkeley", "110635", "Berkeley Data Science", "master", "data science"),
    ("princeton-us-canary", "Princeton University", "186131", "Princeton Engineering", "master", "engineering"),
    ("yale-us-canary", "Yale University", "130794", "Yale Economics", "bachelor", "business"),
    ("columbia-us-canary", "Columbia University in the City of New York", "190150", "Columbia Computer Science", "master", "computer science"),
    ("michigan-us-canary", "University of Michigan-Ann Arbor", "170976", "Michigan Data Science", "master", "data science"),
    ("cmu-us-canary", "Carnegie Mellon University", "211440", "Carnegie Mellon Machine Learning", "master", "computer science"),
    ("nyu-us-canary", "New York University", "193900", "NYU Business Analytics", "master", "business"),
    ("purdue-us-canary", "Purdue University-Main Campus", "243780", "Purdue Engineering", "bachelor", "engineering"),
]
for institution_id, name, unitid, programme_name, degree, discipline in us_targets:
    host = "ed-public-download.scorecard.network"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="US",
        domain=host,
        homepage="https://ed-public-download.scorecard.network/",
        source_rules=[rule(host, "college_scorecard", "college_scorecard_bulk", "GOVERNMENT", "GOVERNMENT")],
        institution_identifiers={"college_scorecard_bulk": {"UNITID": unitid}},
        programmes=[
            {"url": SCORECARD + f"?target={institution_id}-a", "name": programme_name, "degree": degree, "discipline": discipline},
            {"url": SCORECARD + f"?target={institution_id}-b", "name": programme_name + " (alternate)", "degree": "bachelor" if degree == "master" else "master", "discipline": "engineering" if discipline != "engineering" else "computer science"},
        ],
    )


# Switzerland: exact names in the swissuniversities 2026-27 table; institution scope.
swiss_targets = [
    ("eth-zurich-ch-canary", "ETH Zurich"),
    ("epfl-ch-canary", "EPFL"),
    ("uzh-ch-canary", "University of Zurich"),
    ("geneva-ch-canary", "University of Geneva"),
    ("lausanne-ch-canary", "University of Lausanne"),
    ("basel-ch-canary", "University of Basel"),
    ("bern-ch-canary", "University of Bern"),
    ("st-gallen-ch-canary", "University of St. Gallen"),
]
for institution_id, name in swiss_targets:
    host = "www.swissuniversities.ch"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="CH",
        domain=host,
        homepage="https://www.swissuniversities.ch/",
        source_rules=[rule(host, "official_partner", "swissuniversities_tuition", "CONSORTIUM", "OFFICIAL_PARTNER")],
        institution_identifiers={"swissuniversities_tuition": {"SWISSUNIVERSITIES_NAME": name}},
        programmes=[
            {"url": SWISS + f"?target={institution_id}-a", "name": f"{name} Data Science", "degree": "master", "discipline": "data science"},
            {"url": SWISS + f"?target={institution_id}-b", "name": f"{name} Engineering", "degree": "bachelor", "discipline": "engineering"},
        ],
    )


# France: exact Onisep UAI + AF identifiers from the published CSV.
fr_targets = [
    ("sorbonne-fr-canary", "Sorbonne Universite", "0755283K", [("AF.86527", "Licence mention informatique", "bachelor"), ("AF.84654", "Master mention informatique", "master")]),
    ("uco-nantes-fr-canary", "Facultes libres de l'Ouest - UCO Nantes", "0442777E", [("AF.45876", "Licence mention information-communication", "bachelor"), ("AF.109027", "Licence mention science politique", "bachelor")]),
    ("centrale-lyon-fr-canary", "Ecole centrale de Lyon", "0690187D", [("AF.30276", "Master mention informatique", "master"), ("AF.60342", "Master mention chimie et sciences des materiaux", "master")]),
    ("ens-paris-saclay-fr-canary", "Ecole normale superieure Paris-Saclay", "0912423P", [("AF.43970", "Master mention physique fondamentale et applications", "master"), ("AF.19718", "Master mention biologie-sante", "master")]),
    ("insa-lyon-fr-canary", "Institut national des sciences appliquees de Lyon", "0690192J", [("AF.109653", "Master mention IA - intelligence artificielle", "master"), ("AF.133979", "Bachelor en sciences et ingenierie - genie energetique et environnement", "bachelor")]),
    ("ip-paris-fr-canary", "Institut polytechnique de Paris", "0912403T", [("AF.130168", "Master mention biologie-sante", "master"), ("AF.130166", "Master innovation entreprise societe", "master")]),
    ("grenoble-inp-fr-canary", "Grenoble INP - UGA", "0383399N", [("AF.101907", "Master mathematiques et applications", "master"), ("AF.98564", "Master informatique", "master")]),
    ("centrale-lille-fr-canary", "Centrale Lille Institut", "0597139P", [("AF.38086", "Master mecanique", "master"), ("AF.76413", "Master sciences des donnees", "master")]),
]
for institution_id, name, uai, programmes in fr_targets:
    host = "api.opendata.onisep.fr"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="FR",
        domain=host,
        homepage="https://api.opendata.onisep.fr/",
        source_rules=[rule(host, "government_dataset", "onisep_higher_ed", "GOVERNMENT", "GOVERNMENT")],
        programmes=[
            {
                "url": ONISEP + f"?target={uai}-{quote(af, safe='')}",
                "name": pname,
                "degree": degree,
                "discipline": "computer science" if "informat" in pname.casefold() or "IA" in pname else "other",
                "provider_programme_identifiers": {"onisep_higher_ed": {"ENS code UAI": uai, "Action de Formation (AF) identifiant Onisep": af}},
            }
            for af, pname, degree in programmes
        ],
    )


# United Kingdom: source-native Discover Uni PUBUKPRN/KISCourse/KISMODE routes.
uk_targets = [
    ("oxford-uk-canary", "Oxford University", "10007774", [("G400", "Computer Science (3 or 4 years)"), ("GG14", "Mathematics and Computer Science")]),
    ("cambridge-uk-canary", "University of Cambridge", "10007788", [("UG_CSTX", "Computer Science"), ("UG_NSTX", "Natural Sciences")]),
    ("imperial-uk-canary", "Imperial College London", "10003270", [("GG14", "Mathematics and Computer Science"), ("GG41", "Mathematics and Computer Science")]),
    ("nottingham-uk-canary", "University of Nottingham", "10007154", [("G400", "Computer Science"), ("G404", "Computer Science")]),
    ("edinburgh-uk-canary", "The University of Edinburgh", "10007790", [("UTCMPSIBENGH", "Computer Science"), ("UTCMPSIBSCH", "Computer Science")]),
    ("manchester-uk-canary", "The University of Manchester", "10007798", [("28", "Computer Science"), ("2571195", "Data Science")]),
    ("bristol-uk-canary", "University of Bristol", "10007786", [("4COSC006UU-202425", "Computer Science"), ("4COSC008UU-202425", "Data Science")]),
    ("kings-uk-canary", "King's College London", "10003645", [("UBSH3CSCS", "Computer Science"), ("UMSH4CSCS", "Computer Science")]),
]
for institution_id, name, prn, programmes in uk_targets:
    host = "discoveruni.gov.uk"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="UK",
        domain=host,
        homepage="https://discoveruni.gov.uk/",
        source_rules=[rule(host, "government_dataset", "discover_uni_hesa", "GOVERNMENT", "GOVERNMENT")],
        programmes=[
            {
                "url": f"https://discoveruni.gov.uk/course-details/{prn}/{course}/Full-time/",
                "name": pname,
                "degree": "bachelor",
                "discipline": "data science" if "data" in pname.casefold() else "computer science",
                "provider_programme_identifiers": {"discover_uni_hesa": {"PUBUKPRN": prn, "KISCourse": course, "KISMODE": "Full-time", "course_name": pname}},
            }
            for course, pname in programmes
        ],
    )


# Netherlands: exact DUO RIO institution and programme codes.
nl_targets = [
    ("tu-delft-nl-canary", "Delft University of Technology", "107B605", [("1001O8897", "Data Science and Artificial Intelligence Technology", "master"), ("1001O6612", "Computer Science", "master")]),
    ("uva-nl-canary", "Universiteit van Amsterdam", "107B473", [("1001O6172", "Informatica", "bachelor"), ("1001O5623", "Cultuurwetenschappen", "bachelor")]),
    ("tue-nl-canary", "Technische Universiteit Eindhoven", "107B450", [("1001O6777", "Sustainable Energy Technology", "master"), ("1001O6650", "Embedded Systems", "master")]),
    ("leiden-nl-canary", "Universiteit Leiden", "107B578", [("1001O7137", "Statistics and Data Science", "master"), ("1001O5903", "Geneeskunde", "bachelor")]),
    ("radboud-nl-canary", "Radboud Universiteit", "107B484", [("1001O6694", "Computing Science", "master"), ("1001O6879", "Business Administration", "master")]),
    ("wageningen-nl-canary", "Wageningen University", "107B451", [("1001O7489", "Plant Sciences", "master"), ("1001O6086", "Business and Consumer Studies", "bachelor")]),
    ("erasmus-nl-canary", "Erasmus Universiteit Rotterdam", "107B576", [("1001O5712", "Business Administration", "bachelor"), ("1001O7206", "Research Master Business Data Science", "master")]),
    ("utrecht-nl-canary", "Universiteit Utrecht", "107B449", [("1001O6171", "Computer Science", "bachelor"), ("1001O6096", "Information Science", "bachelor")]),
]
for institution_id, name, bestuur, programmes in nl_targets:
    host = "onderwijsdata.duo.nl"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="NL",
        domain=host,
        homepage="https://onderwijsdata.duo.nl/",
        source_rules=[rule(host, "government_dataset", "duo_rio_ho", "GOVERNMENT", "GOVERNMENT")],
        programmes=[
            {
                "url": duo_url(bestuur, code) + f"&target={institution_id}-{code}",
                "name": pname,
                "degree": degree,
                "discipline": "computer science" if any(token in pname.casefold() for token in ("computer", "data", "informat")) else "other",
                "provider_programme_identifiers": {"duo_rio_ho": {"ONDERWIJSBESTUURID": bestuur, "OPLEIDINGSEENHEIDCODE": code}},
            }
            for code, pname, degree in programmes
        ],
    )


# Sweden: exact Susa-navet education event/info IDs, with both views retained.
se_targets = [
    ("kth-se-canary", "KTH Royal Institute of Technology", "p.uoh.kth", [("e.uoh.kth.ad236v.11359.20262", "i.uoh.kth.ad236v.11359.20262", "Architecture and Gender: Introduction"), ("e.uoh.kth.ad237v.12708.20271", "i.uoh.kth.ad237v.12708.20271", "Architecture and Gender: Essay")]),
    ("uppsala-se-canary", "Uppsala University", "p.uoh.uu", [("e.uoh.uu.1bg024.17443.20262", "i.uoh.uu.1bg024.17443.20262", "Natural Science and Science Education"), ("e.uoh.uu.1bg025.67407.20261", "i.uoh.uu.1bg025.67407.20261", "Floristics and Faunistics L")]),
    ("lund-se-canary", "Lund University", "p.uoh.lu", [("e.uoh.lu.abma21.31300.20262", "i.uoh.lu.abma21.31300.20262", "AI and Digitization in the Archive Sector"), ("e.uoh.lu.abmm07.31350.20262", "i.uoh.lu.abmm07.31350.20262", "ALM: Work Experience")]),
]
for institution_id, name, provider, programmes in se_targets:
    host = "api.skolverket.se"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="SE",
        domain=host,
        homepage="https://api.skolverket.se/susa-navet/emil3/api-info",
        source_rules=[
            rule(host, "government_dataset", "susa_navet_event", "GOVERNMENT", "GOVERNMENT"),
            rule(host, "government_dataset", "susa_navet_info", "GOVERNMENT", "GOVERNMENT"),
        ],
        programmes=[
            {
                "url": f"https://api.skolverket.se/susa-navet/emil3/educationInfos/{info_id}",
                "name": pname,
                "degree": "master" if "AI" in pname or "Essay" in pname else "bachelor",
                "discipline": "computer science" if "AI" in pname else "other",
                "provider_programme_identifiers": {
                    # Keep the source-native identity names used by the
                    # provider field-evidence specs.  The descriptive aliases
                    # are retained for ledger readability, but matching is
                    # driven by these exact structured-row keys.
                    "susa_navet_event": {
                        "id": event_id,
                        "content.providers": provider,
                        "SUSA_EVENT_ID": event_id,
                        "SUSA_PROVIDER_ID": provider,
                    },
                    "susa_navet_info": {
                        "id": info_id,
                        "SUSA_INFO_ID": info_id,
                    },
                },
            }
            for event_id, info_id, pname in programmes
        ],
    )


# Finland: exact Studyinfo hakukohde/toteutus/valintaperuste identifiers.
fi_targets = [
    ("haaga-helia-fi-canary", "Haaga-Helia University of Applied Sciences", [("1.2.246.562.20.00000000000000091904", "1.2.246.562.17.00000000000000009871", "60a36d5e-bdd3-4509-8125-85c36f8df222", "Business Information Technology", "bachelor"), ("1.2.246.562.20.00000000000000088243", "1.2.246.562.17.00000000000000011598", "88fc8a7e-9804-478d-bf45-18af037bf8e7", "International Business", "bachelor")]),
    ("aalto-fi-canary", "Aalto University", [("1.2.246.562.20.00000000000000072536", "1.2.246.562.17.00000000000000008195", "31970760-4bba-42da-8124-103121d44ec3", "Data Science, Bachelor/MSc", "bachelor"), ("1.2.246.562.20.00000000000000070512", "1.2.246.562.17.00000000000000008123", "c9458393-c6eb-4388-b4ef-49981b4d42df", "Computer Science MSc", "master")]),
    ("uef-fi-canary", "University of Eastern Finland", [("1.2.246.562.20.00000000000000076744", "1.2.246.562.17.00000000000000033281", "2fd031ad-fa64-43d4-9b5d-5eb033245b07", "Data Engineering", "bachelor"), ("1.2.246.562.20.00000000000000076731", "1.2.246.562.17.00000000000000033279", "33012799-b01f-435e-8083-851d47fb4b6d", "Information Technology", "bachelor")]),
]
for institution_id, name, programmes in fi_targets:
    host = "opintopolku.fi"
    add_institution(
        institutions,
        institution_id=institution_id,
        name=name,
        country="FI",
        domain=host,
        homepage="https://opintopolku.fi/konfo/en/sivu/finnish-application-system",
        source_rules=[
            rule(host, "government_dataset", "studyinfo_hakukohde", "GOVERNMENT", "GOVERNMENT"),
            rule(host, "government_dataset", "studyinfo_toteutus", "GOVERNMENT", "GOVERNMENT"),
            rule(host, "government_dataset", "studyinfo_valintaperuste", "GOVERNMENT", "GOVERNMENT"),
        ],
        programmes=[
            {
                "url": f"https://opintopolku.fi/konfo-backend/hakukohde/{hakukohde}",
                "name": pname,
                "degree": degree,
                "discipline": "computer science" if any(token in pname.casefold() for token in ("computer", "data", "technology")) else "business",
                "provider_programme_identifiers": {
                    "studyinfo_hakukohde": {
                        "oid": hakukohde,
                        "STUDYINFO_HAKUKOHDE_OID": hakukohde,
                    },
                    "studyinfo_toteutus": {
                        "oid": toteutus,
                        "STUDYINFO_TOTEUTUS_OID": toteutus,
                    },
                    "studyinfo_valintaperuste": {
                        "id": valintaperuste,
                        "STUDYINFO_VALINTAPERUSTE_ID": valintaperuste,
                    },
                },
            }
            for hakukohde, toteutus, valintaperuste, pname, degree in programmes
        ],
    )


frozen_programmes = [
    programme
    for institution in institutions
    for programme in institution.pop("_frozen_programmes")
]
provider_ids = [
    "college_scorecard_bulk",
    "swissuniversities_tuition",
    "onisep_higher_ed",
    "discover_uni_hesa",
    "duo_rio_ho",
    "susa_navet_event",
    "susa_navet_info",
    "studyinfo_hakukohde",
    "studyinfo_toteutus",
    "studyinfo_valintaperuste",
]
manifest = {
    "schema_version": "GlowBalExternalCanaryPopulation/v1",
    "population_id": "external-field-canary-20260914",
    "frozen_at": "2026-09-14",
    "purpose": "Real external-only pre-production canary; durable ingestion and assertion measurement in an isolated artifact namespace; no unrestricted product promotion.",
    "providers": provider_ids,
    "institutions": institutions,
    "programmes": frozen_programmes,
    "counts": {
        "institutions": len(institutions),
        "programmes": len(frozen_programmes),
        "countries": len({str(item["country_code"]) for item in institutions}),
        "degree_levels": {
            level: sum(1 for item in frozen_programmes if item["degree_level"] == level)
            for level in sorted({str(item["degree_level"]) for item in frozen_programmes})
        },
        "programmes_by_country": {
            country: sum(1 for item in frozen_programmes if next(i for i in institutions if i["institution_id"] == item["institution_id"])["country_code"] == country)
            for country in sorted({str(i["country_code"]) for i in institutions})
        },
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
    "external_provider_ids": provider_ids,
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
    "required_source_classes": ["government_dataset", "official_partner"],
}
config = {
    "schema_version": "GlowBalExternalCanary/v1",
    "run_name": "external-field-canary-20260914",
    "acquisition_backend": "legacy",
    "raw_evidence_mode": "remote",
    "raw_evidence_inline_max_bytes": 8388608,
    "source_ecosystem": ecosystem,
    "limits": {
        "global_concurrency": 2,
        "institution_concurrency": 2,
        "programme_concurrency_per_institution": 1,
        "per_domain_concurrency": 1,
        "request_timeout_seconds": 120,
        "connect_timeout_seconds": 30,
        "max_html_bytes": 5242880,
        "large_raw_object_threshold_bytes": 8388608,
        "max_local_temp_bytes": 0,
        "max_deep_programmes_per_institution": 2,
        "max_deep_sources_per_programme": 3,
        "max_admission_retry_sources_per_programme": 0,
        "max_coverage_retry_sources_per_programme": 0,
        "max_source_recovery_candidates": 0,
        "max_llm_retries": 1,
        "max_sources_per_extraction_group": 2,
        "max_source_chars_per_extraction_group": 40000,
        "min_request_interval_seconds": 1.0,
    },
    "institutions": institutions,
}

manifest_path = OUT / "population-manifest.json"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(OUT / "population-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
manifest_digest = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
(OUT / "population-manifest.sha256").write_text(f"{manifest_digest}  population-manifest.json\n", encoding="ascii")
(OUT / "canary-manifest-ledger.json").write_text(
    json.dumps(
        {
            "population_id": manifest["population_id"],
            "manifest": "population-manifest.json",
            "manifest_sha256": manifest_digest,
            "config": "population-config.json",
            "promotion": "disabled; artifacts are isolated under this canary namespace",
            "provider_ids": provider_ids,
            "counts": manifest["counts"],
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(json.dumps(manifest["counts"], ensure_ascii=False, indent=2))
