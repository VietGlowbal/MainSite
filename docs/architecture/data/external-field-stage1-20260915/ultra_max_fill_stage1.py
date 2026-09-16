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
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


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
        "is_new": "1",
    }


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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--audit", type=Path)
    args = parser.parse_args()

    base = Path(__file__).resolve().parent
    input_path = args.input or base / "stage1-programme-max-fill-results.csv"
    sources_path = args.sources or base / "stage1-programme-max-fill-sources.csv"
    output_path = args.output or base / "stage1-programme-ultra-max-fill-results.csv"
    audit_path = args.audit or base / "stage1-programme-ultra-max-fill-audit.csv"

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

    for row in rows:
        pid = clean(row.get("programme_id"))
        for field in CANONICAL_FIELDS:
            before = original_values[(pid, field)]
            value = before
            if before:
                metadata = source_for_existing(row, field, sources.get((pid, field), {}))
            else:
                donor_result = choose_donor(field, row, indexes)
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
                    "is_new": metadata["is_new"],
                    "overwrote_nonempty": "0",
                }
            )

    # Add ultra-specific counters without changing the existing MAX_FILL
    # metrics, whose denominator reflects production hierarchy semantics.
    for row in rows:
        filled = sum(bool(clean(row.get(field))) for field in CANONICAL_FIELDS)
        row["ultra_filled_field_count"] = str(filled)
        row["ultra_missing_field_count"] = str(len(CANONICAL_FIELDS) - filled)
        row["ultra_completion_pct"] = f"{filled / len(CANONICAL_FIELDS) * 100:.2f}"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=original_columns + [
            "ultra_filled_field_count",
            "ultra_missing_field_count",
            "ultra_completion_pct",
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
        "is_new",
        "overwrote_nonempty",
    ]
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    with audit_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=audit_columns)
        writer.writeheader()
        writer.writerows(audit_rows)

    print(f"rows={len(rows)}")
    print(f"canonical_fields={len(CANONICAL_FIELDS)}")
    print(f"input_filled={sum(bool(value) for value in original_values.values())}")
    print(f"output_filled={sum(bool(clean(row.get(field))) for row in rows for field in CANONICAL_FIELDS)}")
    print(f"new_counts={dict(sorted(new_counts.items()))}")
    print(f"total_method_counts={dict(sorted(total_counts.items()))}")
    print(f"output={output_path}")
    print(f"audit={audit_path}")


if __name__ == "__main__":
    main()
