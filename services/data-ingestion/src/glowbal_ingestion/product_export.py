from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from .models import (
    ELIGIBILITY_FIELDS,
    SCHOOL_PROFILE_FIELDS,
    has_semantic_value,
    normalize_placeholder_values,
)
from .supabase_import import SupabaseRestClient
from .supabase_seeds import _credentials
from .source_excerpt_safety import source_excerpt_is_safe
from .validation import (
    academic_cycle_evidence_errors,
    additional_fee_applicability_errors,
)


class ProductExportError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProductExportResult:
    run_key: str
    run_id: str
    output_path: Path
    institution_count: int
    programme_count: int
    fact_count: int
    admission_requirement_count: int
    display_modes: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_key": self.run_key,
            "run_id": self.run_id,
            "output_path": str(self.output_path),
            "institution_count": self.institution_count,
            "programme_count": self.programme_count,
            "fact_count": self.fact_count,
            "admission_requirement_count": (
                self.admission_requirement_count
            ),
            "display_modes": dict(self.display_modes),
        }


def _select_all(
    client: SupabaseRestClient,
    table: str,
    params: Sequence[tuple[str, str]],
    *,
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = client.select(
            table,
            (
                *params,
                ("limit", str(page_size)),
                ("offset", str(offset)),
            ),
        )
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def _resolution_by_assertion(
    review_items: Sequence[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    resolutions: dict[str, dict[str, Any]] = {}
    for item in review_items:
        assertion_id = str(item.get("assertion_id") or "")
        if not assertion_id:
            continue
        resolution = item.get("resolution")
        if not isinstance(resolution, dict):
            resolution = {}
        resolutions[assertion_id] = {
            "status": str(item.get("status") or ""),
            **resolution,
        }
    return resolutions


def _product_fact(
    assertion: Mapping[str, Any],
    resolution: Mapping[str, Any] | None,
    *,
    programme_degree: str | None = None,
) -> dict[str, Any] | None:
    value = normalize_placeholder_values(assertion.get("value_json"))
    field_name = str(assertion.get("field_name") or "")
    null_reason = str(assertion.get("null_reason") or "")
    verification_status = str(
        assertion.get("verification_status") or ""
    )
    evidence = str(assertion.get("evidence") or "").strip()
    source_url = str(assertion.get("source_url") or "").strip()
    if (
        not has_semantic_value(value)
        and not resolution
        and null_reason == "NOT_PUBLISHED"
    ):
        return {
            "assertion_id": assertion.get("assertion_id"),
            "display_mode": "not_published",
            "value": None,
            "quote": None,
            "source_url": source_url or None,
            "academic_cycle": assertion.get("academic_cycle"),
            "audience": assertion.get("audience"),
            "scope": assertion.get("scope"),
            "verification_status": verification_status,
            "extraction_status": "NOT_PUBLISHED",
            "use_for_eligibility": False,
            "retrieved_at": assertion.get("retrieved_at"),
        }
    if (
        field_name == "academic_cycle"
        and academic_cycle_evidence_errors(value, evidence)
    ):
        return None
    if (
        field_name == "additional_fees"
        and additional_fee_applicability_errors(value, evidence)
    ):
        return None
    eligibility_safe = (
        field_name in ELIGIBILITY_FIELDS
        and (
            verification_status == "HUMAN_VERIFIED"
            or (
                field_name == "programme_status"
                and verification_status == "RULE_VALIDATED"
            )
        )
    )

    if resolution:
        decision = str(resolution.get("decision") or "")
        display_mode = str(resolution.get("display_mode") or "")
        if (
            decision == "rejected"
            or display_mode == "hidden"
            or str(resolution.get("status") or "") == "rejected"
        ):
            return None
        if display_mode == "source_excerpt":
            if not evidence or not source_url.startswith("https://"):
                return None
            use_for_eligibility = False
        elif display_mode == "structured" and decision == "approved":
            if not has_semantic_value(value):
                return None
            use_for_eligibility = bool(
                resolution.get("use_for_eligibility", True)
            ) and eligibility_safe
        else:
            return None
    else:
        if verification_status in {
            "RULE_VALIDATED",
            "HUMAN_VERIFIED",
        }:
            if not has_semantic_value(value):
                return None
            display_mode = "structured"
            use_for_eligibility = eligibility_safe
        elif (
            verification_status == "NEEDS_REVIEW"
            and evidence
            and source_url.startswith("https://")
        ):
            # A sourced but unapproved fact is safe to show as a citation.
            # It must not participate in eligibility decisions until a human
            # approves it through the review workflow.
            display_mode = "source_excerpt"
            use_for_eligibility = False
        else:
            return None

    if not evidence or not source_url.startswith("https://"):
        return None
    if (
        display_mode == "source_excerpt"
        and not source_excerpt_is_safe(
            field_name=field_name,
            evidence=evidence,
            source_url=source_url,
            programme_degree=programme_degree,
        )
    ):
        return None

    fact: dict[str, Any] = {
        "assertion_id": assertion.get("assertion_id"),
        "display_mode": display_mode,
        "quote": evidence or None,
        "source_url": source_url or None,
        "academic_cycle": assertion.get("academic_cycle"),
        "audience": assertion.get("audience"),
        "scope": assertion.get("scope"),
        "verification_status": verification_status,
        "extraction_status": "EXTRACTED",
        "use_for_eligibility": (
            display_mode == "structured" and use_for_eligibility
        ),
        "retrieved_at": assertion.get("retrieved_at"),
    }
    if display_mode == "structured":
        fact["value"] = value
    return fact


def _profile_fact(
    value: Any,
    source_url: str | None,
    retrieved_at: Any,
) -> dict[str, Any] | None:
    if not has_semantic_value(value):
        return None
    if isinstance(value, str):
        quote = value
    else:
        quote = json.dumps(value, ensure_ascii=False)
    return {
        "assertion_id": None,
        "display_mode": "source_excerpt",
        "quote": quote,
        "source_url": source_url,
        "academic_cycle": None,
        "audience": "all",
        "scope": "institution",
        "verification_status": "AI_EXTRACTED",
        "extraction_status": "EXTRACTED",
        "use_for_eligibility": False,
        "retrieved_at": retrieved_at,
    }


def _local_profiles(run_dir: Path | None) -> dict[str, dict[str, Any]]:
    if run_dir is None:
        return {}
    path = run_dir / "school_profiles.jsonl"
    if not path.exists():
        return {}
    profiles: dict[str, dict[str, Any]] = {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                record = json.loads(line)
                institution_id = str(
                    record.get("institution_id") or ""
                )
                if institution_id:
                    profiles[institution_id] = record
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProductExportError(
            f"Invalid school_profiles.jsonl in {run_dir}."
        ) from exc
    return profiles


def build_product_dataset(
    *,
    run: Mapping[str, Any],
    institutions: Sequence[dict[str, Any]],
    programmes: Sequence[dict[str, Any]],
    assertions: Sequence[dict[str, Any]],
    review_items: Sequence[dict[str, Any]],
    admission_requirements: Sequence[dict[str, Any]],
    local_profiles: Mapping[str, dict[str, Any]] | None = None,
    organisation_units: Sequence[dict[str, Any]] = (),
    programme_organisation_units: Sequence[dict[str, Any]] = (),
) -> dict[str, Any]:
    resolution_by_id = _resolution_by_assertion(review_items)
    programme_url_owners: dict[str, set[str]] = defaultdict(set)
    programme_names: dict[str, str] = {}
    programme_degrees: dict[str, str | None] = {}
    for programme in programmes:
        programme_id = str(programme.get("programme_id") or "")
        official_url = str(programme.get("official_url") or "")
        programme_names[programme_id] = " ".join(
            str(programme.get("programme_name") or "")
            .casefold()
            .split()
        )
        programme_degrees[programme_id] = (
            str(programme.get("degree_level"))
            if programme.get("degree_level")
            else None
        )
        if programme_id and official_url:
            programme_url_owners[
                official_url.rstrip("/").casefold()
            ].add(programme_id)
    facts_by_entity: dict[
        tuple[str, str], dict[str, list[dict[str, Any]]]
    ] = defaultdict(lambda: defaultdict(list))
    for assertion in assertions:
        if not assertion.get("is_effective"):
            continue
        if str(assertion.get("entity_type") or "") == "programme":
            entity_id = str(assertion.get("entity_id") or "")
            source_key = str(
                assertion.get("source_url") or ""
            ).rstrip("/").casefold()
            source_owners = programme_url_owners.get(source_key, set())
            target_name = programme_names.get(entity_id, "")
            owner_names = {
                programme_names.get(owner_id, "")
                for owner_id in source_owners
            }
            if (
                source_owners
                and entity_id not in source_owners
                and target_name not in owner_names
            ):
                # Never attach one programme's canonical page to another
                # programme, even when the extracted sentence is plausible.
                continue
        assertion_id = str(assertion.get("assertion_id") or "")
        fact = _product_fact(
            assertion,
            resolution_by_id.get(assertion_id),
            programme_degree=(
                programme_degrees.get(
                    str(assertion.get("entity_id") or "")
                )
                if str(assertion.get("entity_type") or "")
                == "programme"
                else None
            ),
        )
        if fact is None:
            continue
        key = (
            str(assertion.get("entity_type") or ""),
            str(assertion.get("entity_id") or ""),
        )
        field_name = str(assertion.get("field_name") or "")
        if key[0] and key[1] and field_name:
            facts_by_entity[key][field_name].append(fact)

    requirements_by_programme: dict[
        str, list[dict[str, Any]]
    ] = defaultdict(list)
    for requirement in admission_requirements:
        programme_id = str(requirement.get("programme_id") or "")
        source_field = str(requirement.get("source_field") or "")
        eligible_facts = facts_by_entity.get(
            ("programme", programme_id), {}
        ).get(source_field, [])
        citations = [
            {
                "quote": fact.get("quote"),
                "source_url": fact.get("source_url"),
            }
            for fact in eligible_facts
            if fact.get("use_for_eligibility")
        ]
        if not citations:
            continue
        requirements_by_programme[programme_id].append(
            {
                "document_type": requirement.get("document_type"),
                "source_field": source_field,
                "requirement_status": requirement.get(
                    "requirement_status"
                ),
                "required_count": requirement.get("required_count"),
                "count_scope": requirement.get("count_scope"),
                "application_stage": requirement.get(
                    "application_stage"
                ),
                "accepted_alternatives": requirement.get(
                    "accepted_alternatives"
                )
                or [],
                "components": requirement.get("components") or [],
                "citations": citations,
            }
        )

    programmes_by_institution: dict[
        str, list[dict[str, Any]]
    ] = defaultdict(list)
    units_by_id = {
        str(unit.get("organisation_unit_id") or ""): unit
        for unit in organisation_units
        if unit.get("organisation_unit_id")
    }
    unit_links_by_programme: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for link in programme_organisation_units:
        programme_id = str(link.get("programme_id") or "")
        unit_id = str(link.get("organisation_unit_id") or "")
        unit = units_by_id.get(unit_id)
        if not programme_id or not unit:
            continue
        unit_links_by_programme[programme_id].append(
            {
                "organisation_unit_id": unit_id,
                "name": unit.get("unit_name"),
                "type": unit.get("unit_type"),
                "parent_organisation_unit_id": unit.get(
                    "parent_organisation_unit_id"
                ),
                "relationship_type": link.get("relationship_type"),
                "is_primary": bool(link.get("is_primary")),
                "source_url": link.get("source_url"),
                "evidence": link.get("evidence"),
                "verification_status": link.get("verification_status"),
            }
        )
    for programme in programmes:
        programme_id = str(programme.get("programme_id") or "")
        programme_facts = dict(
            facts_by_entity.get(("programme", programme_id), {})
        )
        programmes_by_institution[
            str(programme.get("institution_id") or "")
        ].append(
            {
                "programme_id": programme_id,
                "name": programme.get("programme_name"),
                "url": programme.get("official_url"),
                "degree_level": programme.get("degree_level"),
                "credential": programme.get("credential"),
                "normalized_field": programme.get("normalized_field"),
                "primary_organisation_unit_id": programme.get(
                    "organisation_unit_id"
                ),
                "organisation_units": unit_links_by_programme.get(
                    programme_id, []
                ),
                "fields": programme_facts,
                "admission_package": {
                    "requirements": requirements_by_programme.get(
                        programme_id, []
                    )
                },
            }
        )

    profiles = dict(local_profiles or {})
    product_institutions: list[dict[str, Any]] = []
    for institution in institutions:
        institution_id = str(institution.get("institution_id") or "")
        payload = institution.get("payload")
        if not isinstance(payload, dict):
            payload = {}
        profile = payload.get("school_profile")
        if not isinstance(profile, dict):
            profile = profiles.get(institution_id, {})
        school_fields = dict(
            facts_by_entity.get(("institution", institution_id), {})
        )
        profile_fields = profile.get("fields")
        source_urls = profile.get("source_urls")
        if isinstance(profile_fields, dict):
            source_url = (
                str(source_urls[0])
                if isinstance(source_urls, list) and source_urls
                else None
            )
            for field_name in SCHOOL_PROFILE_FIELDS:
                if school_fields.get(field_name):
                    continue
                fact = _profile_fact(
                    profile_fields.get(field_name),
                    source_url,
                    profile.get("retrieved_at"),
                )
                if fact:
                    school_fields[field_name] = [fact]

        institution_programmes = programmes_by_institution.get(
            institution_id, []
        )
        institution_programmes.sort(
            key=lambda item: (
                str(item.get("degree_level") or ""),
                str(item.get("name") or ""),
            )
        )
        product_institutions.append(
            {
                "institution_id": institution_id,
                "name": institution.get("canonical_name"),
                "country_code": institution.get("country_code"),
                "official_url": institution.get("official_url"),
                "fields": school_fields,
                "organisation_units": [
                    {
                        "organisation_unit_id": unit.get(
                            "organisation_unit_id"
                        ),
                        "parent_organisation_unit_id": unit.get(
                            "parent_organisation_unit_id"
                        ),
                        "name": unit.get("unit_name"),
                        "type": unit.get("unit_type"),
                        "source_url": unit.get("source_url"),
                        "evidence": unit.get("evidence"),
                        "verification_status": unit.get(
                            "verification_status"
                        ),
                    }
                    for unit in organisation_units
                    if str(unit.get("institution_id") or "")
                    == institution_id
                ],
                "programmes": institution_programmes,
            }
        )
    product_institutions.sort(key=lambda item: str(item.get("name") or ""))
    return {
        "schema_version": "GlowBalProductData/v1",
        "generated_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "run": {
            "id": run.get("id"),
            "key": run.get("run_key"),
            "status": run.get("status"),
        },
        "institutions": product_institutions,
    }


def export_product_data(
    run_key: str,
    output_path: Path,
    *,
    run_dir: Path | None = None,
    environ: Mapping[str, str] | None = None,
    client: SupabaseRestClient | None = None,
) -> ProductExportResult:
    if client is None:
        base_url, api_key = _credentials(environ or os.environ)
        client = SupabaseRestClient(base_url, api_key)
    runs = client.select(
        "crawl_runs",
        (
            ("select", "id,run_key,status"),
            ("run_key", f"eq.{run_key}"),
            ("limit", "1"),
        ),
    )
    if len(runs) != 1:
        raise ProductExportError(
            f"Expected exactly one Supabase run for {run_key}."
        )
    run = runs[0]
    if run.get("status") not in {"approved", "completed"}:
        raise ProductExportError(
            "Product export requires an approved or completed run."
        )
    run_id = str(run.get("id") or "")
    if not run_id:
        raise ProductExportError("Supabase run has no ID.")

    institutions = _select_all(
        client,
        "crawl_institutions",
        (
            (
                "select",
                "institution_id,canonical_name,country_code,official_url,"
                "payload",
            ),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    programmes = _select_all(
        client,
        "crawl_programmes",
        (
            (
                "select",
                "programme_id,institution_id,programme_name,official_url,"
                "degree_level,credential,normalized_field,"
                "organisation_unit_id",
            ),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    organisation_units = _select_all(
        client,
        "crawl_organisation_units",
        (
            (
                "select",
                "organisation_unit_id,institution_id,"
                "parent_organisation_unit_id,unit_name,unit_type,"
                "source_url,evidence,verification_status",
            ),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    programme_organisation_units = _select_all(
        client,
        "crawl_programme_organisation_units",
        (
            (
                "select",
                "programme_id,organisation_unit_id,relationship_type,"
                "is_primary,source_url,evidence,verification_status",
            ),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    assertions = _select_all(
        client,
        "crawl_field_assertions",
        (
            (
                "select",
                "assertion_id,entity_type,entity_id,field_name,value_json,"
                "null_reason,"
                "source_url,evidence,scope,audience,academic_cycle,"
                "retrieved_at,verification_status,is_effective",
            ),
            ("run_id", f"eq.{run_id}"),
            ("is_effective", "eq.true"),
        ),
    )
    review_items = _select_all(
        client,
        "crawl_review_items",
        (
            ("select", "assertion_id,status,resolution"),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    admission_requirements = _select_all(
        client,
        "crawl_admission_requirements",
        (
            (
                "select",
                "programme_id,document_type,source_field,"
                "requirement_status,required_count,count_scope,"
                "application_stage,accepted_alternatives,components",
            ),
            ("run_id", f"eq.{run_id}"),
        ),
    )
    dataset = build_product_dataset(
        run=run,
        institutions=institutions,
        programmes=programmes,
        assertions=assertions,
        review_items=review_items,
        admission_requirements=admission_requirements,
        local_profiles=_local_profiles(
            run_dir.resolve() if run_dir is not None else None
        ),
        organisation_units=organisation_units,
        programme_organisation_units=programme_organisation_units,
    )
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    display_modes: Counter[str] = Counter()
    fact_count = 0
    requirement_count = 0
    for institution in dataset["institutions"]:
        for facts in institution["fields"].values():
            for fact in facts:
                display_modes[fact["display_mode"]] += 1
                fact_count += 1
        for programme in institution["programmes"]:
            for facts in programme["fields"].values():
                for fact in facts:
                    display_modes[fact["display_mode"]] += 1
                    fact_count += 1
            requirement_count += len(
                programme["admission_package"]["requirements"]
            )
    return ProductExportResult(
        run_key=run_key,
        run_id=run_id,
        output_path=output_path,
        institution_count=len(dataset["institutions"]),
        programme_count=sum(
            len(item["programmes"]) for item in dataset["institutions"]
        ),
        fact_count=fact_count,
        admission_requirement_count=requirement_count,
        display_modes=dict(display_modes),
    )
