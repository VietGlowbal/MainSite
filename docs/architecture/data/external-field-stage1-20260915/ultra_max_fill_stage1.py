#!/usr/bin/env python3
"""Build a deliberately aggressive, local-only Stage 1 advisory CSV.

This pass never calls a provider, network service, or model.  It starts from
the committed MAX_FILL CSV, reuses values already present in that file, and
then applies deterministic derived/default values to the remaining cells.
Every cell is recorded in the companion audit CSV with a fill method and
confidence so that this synthetic view cannot be confused with STRICT data.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


ADMISSION_PACKAGE_FIELDS = (
    "recommendation_letters",
    "sop_or_essay",
    "graduation_certificate",
    "academic_transcript",
)
DOCUMENT_FIELDS = frozenset({"graduation_certificate", "academic_transcript"})
PACKAGE_JSONL = "stage1-programme-admission-packages.jsonl"
PACKAGE_COMPAT_CSV = "stage1-admission-packages-compat.csv"
REQUIREMENT_COMPAT_CSV = "stage1-admission-requirements-compat.csv"
COURSE_REQUIREMENT_COMPAT_CSV = "stage1-course-admission-requirements-compat.csv"

LEGACY_PACKAGE_COLUMNS = (
    "run_id",
    "programme_id",
    "institution_id",
    "programme_name",
    "official_url",
    "retrieved_at",
    "precheck",
    "payload",
)

LEGACY_REQUIREMENT_COLUMNS = (
    "run_id",
    "programme_id",
    "document_type",
    "source_field",
    "requirement_status",
    "required_count",
    "count_scope",
    "application_stage",
    "accepted_alternatives",
    "components",
    "conflict",
    "conflict_reasons",
    "evidence",
)

COURSE_REQUIREMENT_COLUMNS = (
    "course_id",
    "document_type",
    "source_field",
    "requirement_status",
    "required_count",
    "count_scope",
    "application_stage",
    "accepted_alternatives",
    "components",
    "conflict",
    "conflict_reasons",
    "evidence",
    "display_mode",
    "use_for_eligibility",
    "source_run_id",
    "source_programme_id",
    "source_retrieved_at",
    "updated_at",
)


CANONICAL_FIELDS = [
    "programme_identity",
    "credential",
    "duration",
    "location",
    "delivery_mode",
    "programme_language",
    "programme_status",
    "academic_cycle",
    "tuition",
    "additional_fees",
    "mandatory_fees",
    "application_fee",
    "scholarship",
    "scholarship_amount",
    "funding",
    "funding_amount",
    "funding_eligibility",
    "funding_deadline",
    "ielts_overall",
    "ielts_subscores",
    "toefl",
    "duolingo",
    "standardized_test_requirements",
    "intakes",
    "final_deadline",
    "priority_deadline",
    "international_deadline",
    "rolling_admission",
    "application_url",
    "minimum_degree",
    "minimum_gpa",
    "gpa_scale",
    "subject_prerequisites",
    "required_documents",
    "graduation_certificate",
    "academic_transcript",
    "recommendation_letters",
    "sop_or_essay",
    "portfolio",
    "work_experience",
    "career_outcomes",
    "employment_outcomes",
]

LEVEL_TO_METHOD = {"H0": "DIRECT", "H1": "H1", "H2": "H2", "H3": "H3"}
SCOPE_TO_METHOD = {
    "faculty": "H1",
    "department": "H1",
    "org_unit": "H1",
    "school": "H1",
    "institution": "H2",
    "programme": "H3",
    "program": "H3",
}

# Defaults that describe a policy at institution level.  The values remain
# advisory and are explicitly marked HEURISTIC in the audit.
INSTITUTION_POLICY_FIELDS = {
    "tuition",
    "additional_fees",
    "mandatory_fees",
    "application_fee",
    "scholarship",
    "scholarship_amount",
    "funding",
    "funding_amount",
    "funding_eligibility",
    "funding_deadline",
    "ielts_overall",
    "ielts_subscores",
    "toefl",
    "duolingo",
    "standardized_test_requirements",
    "intakes",
    "final_deadline",
    "priority_deadline",
    "international_deadline",
    "rolling_admission",
    "required_documents",
    "recommendation_letters",
    "sop_or_essay",
    "portfolio",
}


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def normalise(value: Any) -> str:
    return re.sub(r"\s+", " ", clean(value)).casefold()


def parse_year(value: Any) -> int | None:
    years = [int(match) for match in re.findall(r"(?:19|20)\d{2}", clean(value))]
    return max(years) if years else None


def degree_key(row: dict[str, str]) -> str:
    return normalise(row.get("degree_level")) or normalise(row.get("credential"))


def field_scope(field: str, method: str, donor_scope: str = "") -> str:
    if donor_scope:
        return donor_scope
    if method == "H1":
        return "faculty"
    if method == "H2":
        return "institution"
    if method == "H3":
        return "programme"
    if field in INSTITUTION_POLICY_FIELDS:
        return "institution"
    return "programme"


def confidence_for(method: str, source_uncertainty: str = "") -> str:
    uncertainty = normalise(source_uncertainty)
    if method == "DIRECT":
        return {"high": "HIGH", "medium": "MEDIUM", "low": "LOW"}.get(
            uncertainty, "HIGH"
        )
    if method in {"H1", "H2", "H3", "SAME_INSTITUTION"}:
        return "HIGH" if uncertainty == "high" else "MEDIUM"
    if method in {"SAME_DEGREE", "COUNTRY_DEFAULT"}:
        return "MEDIUM"
    if method == "DERIVED":
        return "HIGH"
    return "LOW"


def slug(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "-", clean(value).casefold()).strip("-")
    return result or "institution"


def language_default(country: str) -> str:
    return {
        "FR": "French",
        "BE": "French / Dutch",
        "NL": "Dutch",
        "DE": "German",
        "AT": "German",
        "CH": "English / French / German",
        "IT": "Italian",
        "ES": "Spanish",
        "SE": "Swedish",
        "FI": "Finnish / English",
        "NO": "Norwegian / English",
        "DK": "Danish / English",
        "PT": "Portuguese",
    }.get(clean(country).upper(), "English")


def degree_default(row: dict[str, str], kind: str) -> str:
    degree = degree_key(row)
    if kind == "duration":
        if "doctor" in degree or "phd" in degree:
            return "3 years"
        if "master" in degree or "msc" in degree or "mba" in degree:
            return "2 years"
        if "bachelor" in degree or "licence" in degree or "undergraduate" in degree:
            return "3 years"
        return "2 years"
    if kind == "minimum_degree":
        if "doctor" in degree or "phd" in degree:
            return "Master's degree"
        if "master" in degree or "msc" in degree or "mba" in degree:
            return "Bachelor's degree"
        if "bachelor" in degree or "licence" in degree or "undergraduate" in degree:
            return "Secondary school diploma"
        return "Relevant prior degree"
    return ""


def default_value(field: str, row: dict[str, str]) -> tuple[str, str, str, str]:
    """Return value, method, confidence, and provenance for a no-donor cell."""

    degree = degree_key(row)
    discipline = clean(row.get("discipline")) or "the relevant field"
    country = clean(row.get("country"))
    institution = clean(row.get("institution_name")) or "the institution"

    if field == "programme_identity":
        value = clean(row.get("programme_name")) or f"{institution} programme"
        return value, "DERIVED", "HIGH", "Derived from the verified programme row."
    if field == "credential":
        return (
            degree_default(row, "minimum_degree")
            if "master" not in degree
            else "Master's degree",
            "DERIVED",
            "HIGH",
            "Derived from the persisted degree level.",
        )
    if field == "duration":
        return degree_default(row, "duration"), "HEURISTIC", "LOW", "Degree-level advisory default."
    if field == "location":
        return f"Main campus ({country or 'country unavailable'})", "HEURISTIC", "LOW", "Deterministic location placeholder."
    if field == "delivery_mode":
        return "Full time", "HEURISTIC", "LOW", "Deterministic delivery-mode default."
    if field == "programme_language":
        return language_default(country), "HEURISTIC", "LOW", "Country-level advisory language default."
    if field == "programme_status":
        return "Active", "HEURISTIC", "LOW", "Advisory status default for the verified population."
    if field == "academic_cycle":
        year = parse_year(row.get("final_deadline")) or parse_year(row.get("international_deadline")) or 2026
        return f"{year}-{year + 1}", "DERIVED", "MEDIUM", "Derived from the nearest local deadline or current cycle."
    if field == "tuition":
        return "Tuition varies by programme and residency", "HEURISTIC", "LOW", "No local tuition donor; advisory placeholder."
    if field == "additional_fees":
        return "Additional fees may apply; see the institution fee schedule", "HEURISTIC", "LOW", "No local additional-fee donor; advisory placeholder."
    if field == "mandatory_fees":
        return "Mandatory fees vary by institution and enrolment", "HEURISTIC", "LOW", "No local mandatory-fee donor; advisory placeholder."
    if field == "application_fee":
        return "Application fee not specified in local artifacts", "HEURISTIC", "LOW", "No local application-fee donor."
    if field == "scholarship":
        return "Scholarships and bursaries may be available", "HEURISTIC", "LOW", "Institution-policy advisory default."
    if field == "scholarship_amount":
        return "Varies", "HEURISTIC", "LOW", "No local scholarship amount donor."
    if field == "funding":
        return "Funding options may be available", "HEURISTIC", "LOW", "Institution-policy advisory default."
    if field == "funding_amount":
        return "Varies", "HEURISTIC", "LOW", "No local funding amount donor."
    if field == "funding_eligibility":
        return "Eligibility varies by citizenship, merit, and financial need", "HEURISTIC", "LOW", "Institution-policy advisory default."
    if field == "funding_deadline":
        return "See funding provider deadlines", "HEURISTIC", "LOW", "No local funding deadline donor."
    if field == "ielts_overall":
        return ("7.0" if "doctor" in degree or "phd" in degree else "6.5" if "master" in degree else "6.0"), "HEURISTIC", "LOW", "Degree-level English-test advisory default."
    if field == "ielts_subscores":
        return "6.0 each", "HEURISTIC", "LOW", "English-test advisory subscore default."
    if field == "toefl":
        return ("100" if "doctor" in degree or "phd" in degree else "90" if "master" in degree else "80"), "HEURISTIC", "LOW", "Degree-level English-test advisory default."
    if field == "duolingo":
        return ("125" if "doctor" in degree or "phd" in degree else "120" if "master" in degree else "105"), "HEURISTIC", "LOW", "Degree-level English-test advisory default."
    if field == "standardized_test_requirements":
        return "English proficiency test requirement varies", "HEURISTIC", "LOW", "Advisory standardized-test default."
    if field == "intakes":
        return "Autumn / Fall", "HEURISTIC", "LOW", "Common-cycle advisory default."
    if field in {"final_deadline", "international_deadline"}:
        year = parse_year(row.get("academic_cycle")) or 2027
        return f"{year}-01-15", "HEURISTIC", "LOW", "Common-cycle advisory deadline default."
    if field == "priority_deadline":
        year = parse_year(row.get("academic_cycle")) or 2027
        return f"{year - 1}-12-01", "HEURISTIC", "LOW", "Common-cycle advisory deadline default."
    if field == "rolling_admission":
        return "Not specified", "HEURISTIC", "LOW", "No local rolling-admission donor."
    if field == "application_url":
        return f"https://local.invalid/{slug(institution)}/application", "HEURISTIC", "LOW", "Synthetic URL placeholder; no local URL donor."
    if field == "minimum_degree":
        return degree_default(row, "minimum_degree"), "DERIVED", "MEDIUM", "Derived from the persisted degree level."
    if field == "minimum_gpa":
        return ("3.0" if "master" in degree or "doctor" in degree or "phd" in degree else "2.5"), "HEURISTIC", "LOW", "Degree-level GPA advisory default."
    if field == "gpa_scale":
        return "4.0", "HEURISTIC", "LOW", "Common GPA-scale advisory default."
    if field == "subject_prerequisites":
        return f"Prior study in {discipline}", "DERIVED", "MEDIUM", "Derived from the persisted discipline."
    if field == "required_documents":
        return "Application form; CV or resume; transcripts; degree certificate; language proof; passport", "HEURISTIC", "LOW", "Common admissions-document advisory default."
    if field in DOCUMENT_FIELDS:
        return "", "UNKNOWN", "LOW", "No direct certificate or transcript evidence in local artifacts."
    if field == "recommendation_letters":
        return "2 recommendation letters", "HEURISTIC", "LOW", "Common graduate-admissions advisory default."
    if field == "sop_or_essay":
        return "Statement of purpose or motivation letter", "HEURISTIC", "LOW", "Common admissions-essay advisory default."
    if field == "portfolio":
        return "Portfolio requirement depends on the programme", "HEURISTIC", "LOW", "Programme-specific portfolio status unavailable locally."
    if field == "work_experience":
        return "Relevant work experience may be considered", "HEURISTIC", "LOW", "Programme-specific work-experience status unavailable locally."
    if field in {"career_outcomes", "employment_outcomes"}:
        return f"Career opportunities related to {discipline}", "DERIVED", "LOW", "Derived from the persisted discipline."
    return "Not specified", "HEURISTIC", "LOW", "Deterministic advisory default."


def donor_indexes(rows: list[dict[str, str]], sources: dict[tuple[str, str], dict[str, str]]):
    indexes: dict[str, dict[str, dict[tuple[str, ...], list[dict[str, Any]]]]] = {}
    for field in CANONICAL_FIELDS:
        indexes[field] = defaultdict(list)
        for index, row in enumerate(rows):
            value = clean(row.get(field))
            if not value:
                continue
            pid = clean(row.get("programme_id"))
            metadata = sources.get((pid, field), {})
            candidate = {"index": index, "row": row, "value": value, "metadata": metadata}
            inst = normalise(row.get("institution_id")) or normalise(row.get("institution_name"))
            country = normalise(row.get("country"))
            degree = degree_key(row)
            discipline = normalise(row.get("discipline")) or "_"
            indexes[field]["inst_disc", inst, discipline].append(candidate)
            indexes[field]["inst", inst].append(candidate)
            indexes[field]["country_degree_disc", country, degree, discipline].append(candidate)
            indexes[field]["country_degree", country, degree].append(candidate)
            indexes[field]["degree_disc", degree, discipline].append(candidate)
            indexes[field]["degree", degree].append(candidate)
            indexes[field]["country", country].append(candidate)
            indexes[field]["all"].append(candidate)
    return indexes


def choose_donor(field: str, row: dict[str, str], indexes) -> tuple[str, dict[str, Any]] | None:
    inst = normalise(row.get("institution_id")) or normalise(row.get("institution_name"))
    country = normalise(row.get("country"))
    degree = degree_key(row)
    discipline = normalise(row.get("discipline")) or "_"
    keys = [
        ("inst_disc", ("inst_disc", inst, discipline)),
        ("inst", ("inst", inst)),
        ("country_degree_disc", ("country_degree_disc", country, degree, discipline)),
        ("country_degree", ("country_degree", country, degree)),
        ("degree_disc", ("degree_disc", degree, discipline)),
        ("degree", ("degree", degree)),
        ("country", ("country", country)),
        ("all", ("all",)),
    ]
    for relation, key in keys:
        candidates = indexes[field].get(key, [])
        if not candidates:
            continue
        # Prefer the mode at the narrowest available relation.  Ties retain
        # the earliest persisted row, keeping this batch reproducible.
        counts = Counter(candidate["value"] for candidate in candidates)
        best_value = min(
            counts,
            key=lambda value: (-counts[value], next(c["index"] for c in candidates if c["value"] == value)),
        )
        donor = next(candidate for candidate in candidates if candidate["value"] == best_value)
        return relation, donor
    return None


def method_from_donor(relation: str, metadata: dict[str, str]) -> str:
    if relation in {"inst_disc", "inst"}:
        scope_method = SCOPE_TO_METHOD.get(normalise(metadata.get("scope")))
        if scope_method:
            return scope_method
        return "SAME_INSTITUTION"
    if relation in {"country_degree_disc", "country_degree", "country"}:
        return "COUNTRY_DEFAULT"
    if relation in {"degree_disc", "degree"}:
        return "SAME_DEGREE"
    return "HEURISTIC"


def source_for_existing(row: dict[str, str], field: str, metadata: dict[str, str]) -> dict[str, str]:
    level = clean(metadata.get("resolution_level"))
    method = LEVEL_TO_METHOD.get(level, "DIRECT")
    return {
        "fill_method": method,
        "confidence": confidence_for(method, metadata.get("uncertainty", "")),
        "scope": field_scope(field, method, clean(metadata.get("scope"))),
        "donor_entity": clean(metadata.get("donor_entity")) or clean(row.get("programme_id")),
        "donor_name": clean(metadata.get("donor_name")) or clean(row.get("programme_name")),
        "donor_programme_id": clean(metadata.get("donor_entity")) if clean(metadata.get("scope")) == "programme" else "",
        "source_url": clean(metadata.get("source_url")) or "local://stage1-programme-max-fill-results.csv",
        "provider": clean(metadata.get("provider")) or "local_max_fill",
        "provenance": clean(metadata.get("provenance")) or "Existing MAX_FILL value retained.",
        "resolution_level": level or "H0",
        "original_status": clean(metadata.get("original_status")),
        "is_new": "0",
    }


def source_for_donor(field: str, relation: str, donor: dict[str, Any]) -> dict[str, str]:
    metadata = donor["metadata"]
    method = method_from_donor(relation, metadata)
    donor_row = donor["row"]
    donor_scope = clean(metadata.get("scope"))
    if not donor_scope:
        donor_scope = "institution" if method in {"H1", "H2", "SAME_INSTITUTION", "COUNTRY_DEFAULT"} else "programme"
    return {
        "fill_method": method,
        "confidence": confidence_for(method, metadata.get("uncertainty", "")),
        "scope": field_scope(field, method, donor_scope),
        "donor_entity": clean(metadata.get("donor_entity")) or clean(donor_row.get("programme_id")),
        "donor_name": clean(metadata.get("donor_name")) or clean(donor_row.get("programme_name")),
        "donor_programme_id": clean(donor_row.get("programme_id")),
        "source_url": clean(metadata.get("source_url")) or "local://stage1-programme-max-fill-results.csv",
        "provider": clean(metadata.get("provider")) or "local_max_fill",
        "provenance": f"Reused existing local MAX_FILL donor via {relation.replace('_', ' ')} relation.",
        "resolution_level": method if method in {"H1", "H2", "H3"} else "ADVISORY",
        "original_status": clean(metadata.get("original_status")),
        "is_new": "1",
    }


def source_for_default(field: str, row: dict[str, str], method: str, confidence: str, provenance: str) -> dict[str, str]:
    return {
        "fill_method": method,
        "confidence": confidence,
        "scope": field_scope(field, method),
        "donor_entity": clean(row.get("institution_id")) or clean(row.get("institution_name")),
        "donor_name": clean(row.get("institution_name")) or "local advisory derivation",
        "donor_programme_id": "",
        "source_url": "local://ultra-max-fill-heuristic",
        "provider": "local_ultra_max_fill",
        "provenance": provenance,
        "resolution_level": "ADVISORY",
        "original_status": "ADVISORY",
        "is_new": "1",
    }


def direct_package_evidence(field: str, metadata: dict[str, str], method: str, value: Any) -> bool:
    """Return whether a package cell is direct evidence rather than advice."""

    if field not in ADMISSION_PACKAGE_FIELDS or method != "DIRECT" or not clean(value):
        return False
    status = clean(metadata.get("original_status")).upper()
    if status in {"NEEDS_REVIEW", "ABSTAINED", "REVIEW", "MISSING", "EXISTING"}:
        return False
    provider = clean(metadata.get("provider")).casefold()
    provenance = clean(metadata.get("provenance")).casefold()
    if provider in {"existing_strict_export", "local_max_fill"} and "page_deterministic" not in provenance:
        return False
    return status in {
        "DIRECT_ACCEPTED",
        "PAGE_DETERMINISTIC",
        "RULE_VALIDATED",
        "HUMAN_VERIFIED",
        "OBSERVED",
        "DIRECT",
        "",
    }


def package_evidence_status(field: str, metadata: dict[str, str], method: str, value: Any) -> str:
    if direct_package_evidence(field, metadata, method, value):
        return "DIRECT"
    if not clean(value):
        return "UNKNOWN"
    if clean(metadata.get("original_status")).upper() in {"NEEDS_REVIEW", "ABSTAINED", "REVIEW"}:
        return "REVIEW"
    return "ADVISORY"


def load_sources(path: Path) -> dict[tuple[str, str], dict[str, str]]:
    if not path.exists():
        return {}
    result: dict[tuple[str, str], dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (clean(row.get("programme_id")), clean(row.get("field_name")))
            # Keep a non-empty source row if duplicate keys ever occur.
            if key not in result or clean(row.get("value_json")):
                result[key] = row
    return result


def json_cell(value: Any) -> Any:
    text = clean(value)
    if not text:
        return None
    if text[:1] in "[{":
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    return text


def package_document_type(field: str, value: Any) -> str:
    rendered = clean(value).casefold()
    if field == "recommendation_letters":
        return "recommendation_letter"
    if field == "sop_or_essay":
        if "personal statement" in rendered:
            return "personal_statement"
        if "motivation letter" in rendered:
            return "motivation_letter"
        if "essay" in rendered:
            return "application_essay"
        return "statement_of_purpose"
    if field in DOCUMENT_FIELDS:
        return field
    return field


def package_requirement_status(value: Any) -> str:
    if isinstance(value, dict):
        explicit = clean(value.get("requirement_status") or value.get("status")).casefold()
        if explicit in {"required", "optional", "conditional", "not_required"}:
            return explicit
    rendered = clean(value)
    if not rendered:
        return "unknown"
    if re.search(r"\b(?:optional|not required|need not)\b", rendered, re.I):
        return "optional"
    if re.search(r"\b(?:conditional|after (?:an? )?offer|upon admission|if applicable|may be required)\b", rendered, re.I):
        return "conditional"
    if re.search(r"\b(?:required|must|need(?:ed)?|submit|provide|upload|reference|recommendation|statement of purpose|personal statement|motivation letter|degree certificate|graduation certificate|academic transcript|official transcript)\b", rendered, re.I):
        return "required"
    return "unknown"


def package_application_stage(value: Any) -> str:
    explicit = clean(value.get("application_stage") or value.get("stage")).casefold() if isinstance(value, dict) else ""
    if explicit in {"application", "initial", "initial_application"}:
        return "initial_application"
    if explicit in {"after_offer", "post_offer"}:
        return "after_offer"
    if explicit in {"enrolment", "enrollment"}:
        return "enrollment"
    rendered = clean(value)
    if re.search(r"\bafter (?:an? )?offer\b|\bupon admission\b|\bconditional offer\b", rendered, re.I):
        return "after_offer"
    if re.search(r"\b(?:to apply|with (?:the |your )?application|when applying|upload)\b", rendered, re.I):
        return "initial_application"
    return "unknown"


def package_required_count(field: str, value: Any) -> int | None:
    if isinstance(value, dict):
        explicit = value.get("required_count", value.get("count"))
        if isinstance(explicit, int) and not isinstance(explicit, bool) and explicit >= 0:
            return explicit
        if isinstance(explicit, str) and explicit.isdigit():
            return int(explicit)
    if field != "recommendation_letters":
        return None
    match = re.search(r"\b(1|2|3|4|5|one|two|three|four|five)\b(?=.{0,35}\b(?:letters?|references?|recommendations?)\b)", clean(value), re.I)
    if not match:
        return None
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    token = match.group(1).casefold()
    return int(token) if token.isdigit() else words[token]


def legacy_source_field(field: str) -> str:
    """Map the wide-export spelling to the legacy admission schema."""

    return "sop_essay_requirements" if field == "sop_or_essay" else field


def source_run_timestamp(run_id: str) -> str:
    match = re.search(r"(\d{8}T\d{6}Z)", clean(run_id))
    if not match:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    parsed = datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ")
    return parsed.replace(tzinfo=timezone.utc).isoformat()


def compatibility_metadata(base: Path) -> dict[str, Any]:
    """Load stable provenance needed by the old package/web projections."""

    run_id = clean(os.environ.get("DATA_PLATFORM_SOURCE_RUN_ID"))
    if not run_id:
        candidates = sorted(
            base.glob("stage1-drive-raw-persistence-*.json"),
            key=lambda path: path.stat().st_mtime_ns,
            reverse=True,
        )
        for candidate in candidates:
            try:
                payload = json.loads(candidate.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            run_id = clean(payload.get("summary", {}).get("run_id"))
            if run_id:
                break
    run_id = run_id or "stage1-offline-replay"
    retrieved_at = clean(os.environ.get("DATA_PLATFORM_SOURCE_RETRIEVED_AT")) or source_run_timestamp(run_id)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    official_urls: dict[str, str] = {}
    population_path = base / "stage1-production-population.json"
    if population_path.exists():
        try:
            population = json.loads(population_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            population = {}
        for item in population.get("verified_programme_manifest", []):
            if isinstance(item, dict) and item.get("programme_id"):
                official_urls[str(item["programme_id"])] = clean(item.get("official_url"))

    return {
        "run_id": run_id,
        "retrieved_at": retrieved_at,
        "generated_at": generated_at,
        "official_urls": official_urls,
    }


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def legacy_verification_status(requirement: Mapping[str, Any]) -> str:
    status = clean(requirement.get("evidence_status")).upper()
    return {
        "DIRECT": "RULE_VALIDATED",
        "REVIEW": "NEEDS_REVIEW",
        "ADVISORY": "NEEDS_REVIEW",
        "UNKNOWN": "NEEDS_REVIEW",
    }.get(status, "NEEDS_REVIEW")


def legacy_evidence(requirement: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Convert package provenance labels to the legacy verification enum."""

    evidence = requirement.get("evidence")
    if not isinstance(evidence, list):
        evidence = []
    result: list[dict[str, Any]] = []
    for item in evidence:
        if not isinstance(item, dict):
            continue
        converted = dict(item)
        converted["verification_status"] = legacy_verification_status(requirement)
        result.append(converted)
    return result


def requirement_display_mode(requirement: Mapping[str, Any]) -> str:
    if (
        clean(requirement.get("evidence_status")).upper() == "DIRECT"
        and clean(requirement.get("requirement_status")).casefold() != "unknown"
        and not bool(requirement.get("conflict"))
    ):
        return "structured"
    if legacy_evidence(requirement):
        return "source_excerpt"
    return "unavailable"


def package_precheck(requirements: list[dict[str, Any]], package_status: str) -> dict[str, Any]:
    unknown = [
        item for item in requirements
        if clean(item.get("evidence_status")).upper() == "UNKNOWN"
    ]
    later_stage = [
        item.get("document_type")
        for item in requirements
        if clean(item.get("application_stage")) in {"after_offer", "enrollment"}
    ]
    return {
        "applicant_inventory": None,
        "decision": "READY_FOR_INITIAL_APPLICATION" if package_status == "COMPLETE" else "APPLICANT_DATA_REQUIRED",
        "later_stage_documents": sorted({clean(value) for value in later_stage if clean(value)}),
        "missing_documents": [],
        "ready_for_initial_application": True if package_status == "COMPLETE" else None,
        "unknown_applicant_documents": [],
        "unknown_documents": sorted({clean(item.get("document_type")) for item in unknown if clean(item.get("document_type"))}),
        "unknown_requirements": sorted({legacy_source_field(clean(item.get("source_field"))) for item in unknown if clean(item.get("source_field"))}),
    }


def normalized_package_requirement(field: str, value: Any, audit: Mapping[str, Any]) -> dict[str, Any]:
    details = value.get("details") if isinstance(value, dict) else clean(value)
    components = value.get("components") if isinstance(value, dict) and isinstance(value.get("components"), list) else []
    alternatives = value.get("accepted_alternatives") if isinstance(value, dict) and isinstance(value.get("accepted_alternatives"), list) else []
    status = package_requirement_status(value)
    stage = package_application_stage(value)
    return {
        "document_type": package_document_type(field, value),
        "source_field": field,
        "legacy_source_field": legacy_source_field(field),
        "requirement_status": status,
        "required_count": package_required_count(field, value),
        "count_scope": "component_breakdown" if components else "document_total",
        "application_stage": stage,
        "accepted_alternatives": [clean(item).casefold().replace(" ", "_") for item in alternatives if clean(item)],
        "components": components,
        "conflict": False,
        "conflict_reasons": [],
        "details": clean(details) if details is not None else None,
        "value": value,
        "evidence_status": clean(audit.get("package_evidence_status")) or ("ADVISORY" if value is not None else "UNKNOWN"),
        "fill_method": clean(audit.get("fill_method")),
        "confidence": clean(audit.get("confidence")),
        "source_url": clean(audit.get("source_url")),
        "provider": clean(audit.get("provider")),
        "provenance": clean(audit.get("provenance")),
        "evidence": [
            {
                "source_url": clean(audit.get("source_url")),
                "source_type": clean(audit.get("provider")),
                "evidence": clean(audit.get("provenance")),
                "confidence": clean(audit.get("confidence")),
                "verification_status": clean(audit.get("package_evidence_status")) or "UNKNOWN",
            }
        ] if value is not None else [],
    }


def build_package_records(
    rows: list[dict[str, str]],
    audit_rows: list[dict[str, str]],
    metadata: Mapping[str, Any],
) -> list[dict[str, Any]]:
    audit_by_key = {
        (clean(item.get("programme_id")), clean(item.get("field_name"))): item
        for item in audit_rows
    }
    records: list[dict[str, Any]] = []
    for row in rows:
        programme_id = clean(row.get("programme_id"))
        requirements: list[dict[str, Any]] = []
        for field in ADMISSION_PACKAGE_FIELDS:
            audit = audit_by_key.get((programme_id, field), {})
            value = json_cell(row.get(field))
            requirements.append(normalized_package_requirement(field, value, audit))
        package_status = clean(row.get("admission_package_status")) or "UNKNOWN"
        official_url = clean(metadata.get("official_urls", {}).get(programme_id))
        precheck = package_precheck(requirements, package_status)
        payload = {
            "institution_id": clean(row.get("institution_id")),
            "official_url": official_url,
            "programme_id": programme_id,
            "programme_name": clean(row.get("programme_name")),
            "retrieved_at": clean(metadata.get("retrieved_at")),
            "package_status": package_status,
            "requirements": requirements,
        }
        records.append(
            {
                "schema_version": "stage1-admission-package/v2",
                "run_id": clean(metadata.get("run_id")),
                "programme_id": programme_id,
                "programme_name": clean(row.get("programme_name")),
                "institution_id": clean(row.get("institution_id")),
                "institution_name": clean(row.get("institution_name")),
                "official_url": official_url,
                "retrieved_at": clean(metadata.get("retrieved_at")),
                "package_status": package_status,
                "direct_field_count": int(clean(row.get("admission_package_direct_field_count")) or 0),
                "populated_field_count": int(clean(row.get("admission_package_populated_field_count")) or 0),
                "precheck": precheck,
                "payload": payload,
                "requirements": requirements,
            }
        )
    return records


def write_package_artifact(
    path: Path,
    rows: list[dict[str, str]],
    audit_rows: list[dict[str, str]],
    metadata: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """Write the web-shaped package view with legacy provenance metadata."""

    records = build_package_records(rows, audit_rows, metadata)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    return records


def write_compatibility_artifacts(
    base: Path,
    records: list[dict[str, Any]],
    metadata: Mapping[str, Any],
) -> None:
    """Emit exact legacy package/requirement columns and web projection columns."""

    package_rows: list[dict[str, Any]] = []
    requirement_rows: list[dict[str, Any]] = []
    course_requirement_rows: list[dict[str, Any]] = []
    generated_at = clean(metadata.get("generated_at"))
    for record in records:
        precheck = record.get("precheck") or {}
        payload = record.get("payload") or {}
        package_rows.append(
            {
                "run_id": record.get("run_id"),
                "programme_id": record.get("programme_id"),
                "institution_id": record.get("institution_id"),
                "programme_name": record.get("programme_name"),
                "official_url": record.get("official_url"),
                "retrieved_at": record.get("retrieved_at"),
                "precheck": json_text(precheck),
                "payload": json_text(payload),
            }
        )
        for requirement in record.get("requirements", []):
            evidence = legacy_evidence(requirement)
            source_field = legacy_source_field(clean(requirement.get("source_field")))
            shared = {
                "document_type": requirement.get("document_type"),
                "source_field": source_field,
                "requirement_status": requirement.get("requirement_status"),
                "required_count": requirement.get("required_count"),
                "count_scope": requirement.get("count_scope"),
                "application_stage": requirement.get("application_stage"),
                "accepted_alternatives": json_text(requirement.get("accepted_alternatives") or []),
                "components": json_text(requirement.get("components") or []),
                "conflict": bool(requirement.get("conflict")),
                "conflict_reasons": json_text(requirement.get("conflict_reasons") or []),
                "evidence": json_text(evidence),
            }
            requirement_rows.append(
                {
                    "run_id": record.get("run_id"),
                    "programme_id": record.get("programme_id"),
                    **shared,
                }
            )
            display_mode = requirement_display_mode(requirement)
            course_requirement_rows.append(
                {
                    "course_id": "",
                    **shared,
                    "display_mode": display_mode,
                    "use_for_eligibility": display_mode == "structured",
                    "source_run_id": record.get("run_id"),
                    "source_programme_id": record.get("programme_id"),
                    "source_retrieved_at": record.get("retrieved_at"),
                    "updated_at": generated_at,
                }
            )

    for filename, columns, rows in (
        (PACKAGE_COMPAT_CSV, LEGACY_PACKAGE_COLUMNS, package_rows),
        (REQUIREMENT_COMPAT_CSV, LEGACY_REQUIREMENT_COLUMNS, requirement_rows),
        (COURSE_REQUIREMENT_COMPAT_CSV, COURSE_REQUIREMENT_COLUMNS, course_requirement_rows),
    ):
        path = base / filename
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(columns), extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--package-output", type=Path)
    parser.add_argument("--package-compat-output", type=Path)
    parser.add_argument("--requirement-compat-output", type=Path)
    parser.add_argument("--course-requirement-compat-output", type=Path)
    args = parser.parse_args()

    base = Path(__file__).resolve().parent
    input_path = args.input or base / "stage1-programme-max-fill-results.csv"
    sources_path = args.sources or base / "stage1-programme-max-fill-sources.csv"
    output_path = args.output or base / "stage1-programme-ultra-max-fill-results.csv"
    audit_path = args.audit or base / "stage1-programme-ultra-max-fill-audit.csv"
    package_path = args.package_output or base / PACKAGE_JSONL
    package_compat_path = args.package_compat_output or base / PACKAGE_COMPAT_CSV
    requirement_compat_path = args.requirement_compat_output or base / REQUIREMENT_COMPAT_CSV
    course_requirement_compat_path = args.course_requirement_compat_output or base / COURSE_REQUIREMENT_COMPAT_CSV
    compatibility = compatibility_metadata(base)

    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
        original_columns = list(rows[0].keys()) if rows else []
    if len(rows) != 230:
        raise ValueError(f"expected 230 verified rows, found {len(rows)}")
    missing_columns = [field for field in CANONICAL_FIELDS if field not in original_columns]
    if missing_columns:
        raise ValueError(f"input is missing canonical columns: {missing_columns}")

    sources = load_sources(sources_path)
    indexes = donor_indexes(rows, sources)
    original_values = {(row["programme_id"], field): clean(row.get(field)) for row in rows for field in CANONICAL_FIELDS}
    audit_rows: list[dict[str, str]] = []
    new_counts: Counter[str] = Counter()
    total_counts: Counter[str] = Counter()
    package_direct_fields: dict[str, set[str]] = defaultdict(set)
    package_populated_fields: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        pid = clean(row.get("programme_id"))
        for field in CANONICAL_FIELDS:
            before = original_values[(pid, field)]
            value = before
            if before:
                metadata = source_for_existing(row, field, sources.get((pid, field), {}))
            else:
                # Certificate and transcript requirements are programme-facing
                # package components.  Do not spread one programme's document
                # assertion to another programme through a generic donor.
                donor_result = None if field in DOCUMENT_FIELDS else choose_donor(field, row, indexes)
                if donor_result:
                    relation, donor = donor_result
                    value = donor["value"]
                    metadata = source_for_donor(field, relation, donor)
                else:
                    value, method, confidence, provenance = default_value(field, row)
                    metadata = source_for_default(field, row, method, confidence, provenance)
                row[field] = value
                new_counts[metadata["fill_method"]] += 1

            total_counts[metadata["fill_method"]] += 1
            if clean(value) and field in ADMISSION_PACKAGE_FIELDS:
                package_populated_fields[pid].add(field)
            if direct_package_evidence(field, metadata, metadata["fill_method"], value):
                package_direct_fields[pid].add(field)
            # Preserve explicit tuition/additional-fee scope semantics while
            # filling only an empty companion scope column.
            if field == "tuition" and not clean(row.get("tuition_scope")):
                row["tuition_scope"] = metadata["scope"]
            if field == "additional_fees" and not clean(row.get("additional_fees_scope")):
                row["additional_fees_scope"] = metadata["scope"]

            audit_rows.append(
                {
                    "programme_id": pid,
                    "programme_name": clean(row.get("programme_name")),
                    "institution_id": clean(row.get("institution_id")),
                    "institution_name": clean(row.get("institution_name")),
                    "field_name": field,
                    "original_value": before,
                    "value": value,
                    "fill_method": metadata["fill_method"],
                    "confidence": metadata["confidence"],
                    "scope": metadata["scope"],
                    "donor_entity": metadata["donor_entity"],
                    "donor_name": metadata["donor_name"],
                    "donor_programme_id": metadata["donor_programme_id"],
                    "source_url": metadata["source_url"],
                    "provider": metadata["provider"],
                    "provenance": metadata["provenance"],
                    "resolution_level": metadata["resolution_level"],
                    "original_status": metadata.get("original_status", ""),
                    "is_new": metadata["is_new"],
                    "overwrote_nonempty": "0",
                    "package_evidence_status": package_evidence_status(field, metadata, metadata["fill_method"], value),
                }
            )

    # Add ultra-specific counters without changing the existing MAX_FILL
    # metrics, whose denominator reflects production hierarchy semantics.
    for row in rows:
        pid = clean(row.get("programme_id"))
        filled = sum(bool(clean(row.get(field))) for field in CANONICAL_FIELDS)
        row["ultra_filled_field_count"] = str(filled)
        row["ultra_missing_field_count"] = str(len(CANONICAL_FIELDS) - filled)
        row["ultra_completion_pct"] = f"{filled / len(CANONICAL_FIELDS) * 100:.2f}"
        direct_fields = package_direct_fields.get(pid, set())
        populated_fields = package_populated_fields.get(pid, set())
        row["admission_package_direct_field_count"] = str(len(direct_fields))
        row["admission_package_populated_field_count"] = str(len(populated_fields))
        row["admission_package_missing_fields"] = ";".join(field for field in ADMISSION_PACKAGE_FIELDS if field not in direct_fields)
        row["admission_package_direct_completion_pct"] = f"{len(direct_fields) / len(ADMISSION_PACKAGE_FIELDS) * 100:.2f}"
        row["admission_package_status"] = (
            "COMPLETE" if len(direct_fields) == len(ADMISSION_PACKAGE_FIELDS)
            else "PARTIAL" if direct_fields
            else "UNKNOWN"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=original_columns + [
            "ultra_filled_field_count",
            "ultra_missing_field_count",
            "ultra_completion_pct",
            "admission_package_direct_field_count",
            "admission_package_populated_field_count",
            "admission_package_missing_fields",
            "admission_package_direct_completion_pct",
            "admission_package_status",
        ], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    audit_columns = [
        "programme_id",
        "programme_name",
        "institution_id",
        "institution_name",
        "field_name",
        "original_value",
        "value",
        "fill_method",
        "confidence",
        "scope",
        "donor_entity",
        "donor_name",
        "donor_programme_id",
        "source_url",
        "provider",
        "provenance",
        "resolution_level",
        "original_status",
        "is_new",
        "overwrote_nonempty",
        "package_evidence_status",
    ]
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    with audit_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=audit_columns)
        writer.writeheader()
        writer.writerows(audit_rows)

    package_path.parent.mkdir(parents=True, exist_ok=True)
    package_records = write_package_artifact(package_path, rows, audit_rows, compatibility)
    write_compatibility_artifacts(base, package_records, compatibility)
    # Keep explicit paths useful for callers that place outputs elsewhere.
    for generated, requested in (
        (base / PACKAGE_COMPAT_CSV, package_compat_path),
        (base / REQUIREMENT_COMPAT_CSV, requirement_compat_path),
        (base / COURSE_REQUIREMENT_COMPAT_CSV, course_requirement_compat_path),
    ):
        if generated != requested:
            requested.parent.mkdir(parents=True, exist_ok=True)
            requested.write_bytes(generated.read_bytes())

    print(f"rows={len(rows)}")
    print(f"canonical_fields={len(CANONICAL_FIELDS)}")
    print(f"input_filled={sum(bool(value) for value in original_values.values())}")
    print(f"output_filled={sum(bool(clean(row.get(field))) for row in rows for field in CANONICAL_FIELDS)}")
    print(f"new_counts={dict(sorted(new_counts.items()))}")
    print(f"total_method_counts={dict(sorted(total_counts.items()))}")
    print(f"output={output_path}")
    print(f"audit={audit_path}")
    print(f"package={package_path}")
    print(f"package_compat={package_compat_path}")
    print(f"requirement_compat={requirement_compat_path}")
    print(f"course_requirement_compat={course_requirement_compat_path}")
    print(f"compatibility_run_id={compatibility['run_id']}")
    print(
        "package_status_counts="
        + str(dict(sorted(Counter(clean(row.get("admission_package_status")) for row in rows).items())))
    )


if __name__ == "__main__":
    main()
