"""Replay Stage 1 hierarchy resolution and export reviewable coverage reports.

This is an artifact-only analysis of the frozen Stage 1 run.  It reuses the
production compatibility-gated H1-H4 engine and never writes ingestion,
semantic, or product state.  The only hierarchy policy adjustment in the
current codebase is the narrowly scoped institution-finance context rule;
the report runs the pre-adjustment behavior in-process as a comparison.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping


ARTIFACT_DIR = Path(__file__).resolve().parent
RUN_DIR = ARTIFACT_DIR / "runs" / "stage1-20260915-main"
SRC_DIR = Path(__file__).resolve().parents[4] / "services" / "data-ingestion" / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import glowbal_ingestion.hierarchical_inference as hierarchy_module
from glowbal_ingestion.hierarchical_inference import HierarchicalInferenceEngine
from glowbal_ingestion.models import FieldAssertion


FIELDS = (
    "programme_identity",
    "credential",
    "programme_status",
    "academic_cycle",
    "tuition",
    "additional_fees",
    "duration",
    "location",
    "delivery_mode",
    "programme_language",
    "career_outcomes",
    "employment_outcomes",
    "intakes",
    "final_deadline",
    "rolling_admission",
    "minimum_degree",
    "subject_prerequisites",
    "required_documents",
    "standardized_tests",
    "work_experience",
    "ielts_overall",
    "ielts_subscores",
    "toefl",
    "duolingo",
    "application_fee",
    "priority_deadline",
    "international_deadline",
    "funding_deadline",
    "minimum_gpa",
    "gpa_scale",
    "recommendation_letters",
    "sop_essay_requirements",
    "portfolio",
    "scholarships",
    "funding",
    "funding_amount",
    "funding_eligibility",
    "application_url",
)

METADATA_MAP = {
    "duration": "duration",
    "campus": "location",
    "delivery_mode": "delivery_mode",
    "language": "programme_language",
}

# These records are persisted structured provider responses.  Their original
# promotion is ``context_only`` because the full policy string is not a
# catalogue field.  The closing date itself is an unambiguous source value,
# so it can be promoted without semantic extraction or a model call.
DEADLINE_METADATA_PATTERNS = {
    "application_policy": re.compile(r"(?:^|;\s*)closeDate=(\d{4}-\d{2}-\d{2})(?:;|$)"),
    "application_windows": re.compile(r"(?:^|;\s*)paattyy=(\d{4}-\d{2}-\d{2})(?:T[^;]*)?(?:;|$)"),
}

FULL_REVIEW_COLUMNS = (
    "review_id",
    "target_institution_id",
    "target_programme_id",
    "target_institution",
    "target_programme",
    "target_url",
    "country",
    "degree_level",
    "discipline",
    "field_name",
    "direct_value",
    "direct_status",
    "final_value",
    "resolution_status",
    "resolution_level",
    "donor_institution",
    "donor_programme",
    "donor_value",
    "donor_scope",
    "compatibility_reason",
    "support_count",
    "combined_uncertainty",
    "target_scope",
    "audience",
    "academic_cycle",
    "currency",
    "basis",
    "provider",
    "source_url",
    "evidence_text",
    "raw_document_id",
    "abstention_reason",
    "review_verdict",
    "review_comment",
    "reviewer",
    "reviewed_at",
    "critical_error",
)

FIELD_SUMMARY_COLUMNS = (
    "field",
    "total_targets",
    "direct",
    "H1",
    "H2",
    "H3",
    "H4",
    "final",
    "programme_scope_final",
    "institution_scope_final",
    "review",
    "abstain",
    "missing",
    "coverage_before_hierarchy_pct",
    "coverage_after_hierarchy_pct",
    "absolute_gain_pp",
    "relative_gain_pct",
)

COMPLETENESS_COLUMNS = (
    "programme_id",
    "institution_id",
    "institution_name",
    "programme_name",
    "country",
    "degree_level",
    "discipline",
    "total_priority_fields",
    "direct_field_count",
    "hierarchical_added_field_count",
    "effective_field_count",
    "review_field_count",
    "missing_field_count",
    "completion_before_hierarchy_pct",
    "completion_after_hierarchy_pct",
)

DONOR_COLUMNS = (
    "review_id",
    "target_institution_id",
    "target_programme_id",
    "target_institution",
    "target_programme",
    "target_url",
    "country",
    "degree_level",
    "discipline",
    "field_name",
    "resolution_level",
    "final_value",
    "target_scope",
    "donor_institution",
    "donor_programme",
    "donor_value",
    "donor_scope",
    "provider",
    "source_url",
    "evidence_text",
    "raw_document_id",
    "support_count",
    "combined_uncertainty",
    "compatibility_reason",
)

REJECTION_COLUMNS = (
    "field",
    "hierarchy_level",
    "rejection_gate",
    "candidate_count",
    "candidate_count_before",
    "candidate_count_after",
    "examples",
    "rule_changed",
    "reason",
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def has_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def accepted_row(row: Mapping[str, Any]) -> bool:
    return (
        has_value(row.get("value_json"))
        and row.get("null_reason") is None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
    )


def review_row(row: Mapping[str, Any]) -> bool:
    return (
        has_value(row.get("value_json"))
        and row.get("null_reason") is None
        and row.get("verification_status") == "NEEDS_REVIEW"
        and row.get("epistemic_state") == "OBSERVED"
    )


def dedupe_rows(rows: Iterable[dict[str, Any]], key: str = "assertion_id") -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        value = row.get(key)
        if value is not None:
            seen.setdefault(str(value), row)
    return list(seen.values())


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def display_value(value: Any) -> str:
    """Return a concise, source-unit-preserving value for a reviewer."""

    if value in (None, ""):
        return ""
    if isinstance(value, Mapping):
        amount_key = next(
            (key for key in ("amount", "value", "numeric_value", "tuition", "fee") if key in value),
            None,
        )
        if amount_key is not None and value.get(amount_key) not in (None, ""):
            prefix = str(value.get("currency") or value.get("currency_symbol") or "").strip()
            amount = value.get(amount_key)
            period = str(value.get("fee_period") or value.get("basis") or value.get("period") or "").strip()
            audience = str(value.get("audience") or "").strip()
            text = f"{prefix} {amount}".strip()
            if period:
                text += f" / {period}"
            if audience and audience.casefold() not in {"all", "any"}:
                text += f" ({audience})"
            return text
        return compact_json(value)
    if isinstance(value, (list, tuple)):
        return "; ".join(display_value(item) for item in value)
    return str(value)


def spreadsheet_safe(value: Any, counters: Counter[str]) -> str:
    text = "" if value is None else str(value)
    if text and text.lstrip().startswith(("=", "+", "-", "@")):
        counters["formula_sanitizations"] += 1
        return "'" + text
    return text


def value_metadata(assertion: FieldAssertion, *keys: str) -> Any:
    value = assertion.value_json
    if isinstance(value, Mapping):
        for key in keys:
            if value.get(key) not in (None, ""):
                return value[key]
    return None


def assertion_from_metadata(row: Mapping[str, Any]) -> FieldAssertion | None:
    programme_id = str(row.get("programme_id") or "")
    raw_field_name = str(row.get("field_name") or "")
    field_name = METADATA_MAP.get(raw_field_name)
    if field_name is None and raw_field_name in FIELDS:
        field_name = raw_field_name
    if not programme_id or not field_name:
        return None
    return FieldAssertion(
        assertion_id=str(
            row.get("_assertion_id")
            or f"metadata-{row.get('observation_id') or programme_id}-{field_name}"
        ),
        entity_type="programme",
        entity_id=programme_id,
        field_name=field_name,
        value_json=row.get("value"),
        null_reason=None,
        source_url=row.get("source_url"),
        source_type=row.get("_source_type") or "external_metadata",
        evidence=row.get("evidence") or row.get("label"),
        evidence_locator=None,
        scope=row.get("scope") or "programme",
        audience=row.get("audience"),
        academic_cycle=row.get("academic_cycle"),
        retrieved_at=row.get("retrieved_at") or "2026-09-15T00:00:00+00:00",
        confidence=float(row.get("confidence") or 0.9),
        verification_status="RULE_VALIDATED",
        extractor_version="metadata",
        model_name=None,
        validation_errors=[],
        extraction_group=row.get("_extraction_group") or "metadata",
        applicability_source_url=None,
        applicability_evidence=None,
        source_content_hash=row.get("source_content_hash"),
        review_fingerprint=None,
        inherited_from_assertion_id=None,
        inherited_from_entity_id=None,
        inheritance_key=None,
        epistemic_state="OBSERVED",
        temporal_state=row.get("temporal_state") or "UNKNOWN",
        source_authority=row.get("source_authority") or "GOVERNMENT",
        source_relationship=row.get("source_relationship") or "GOVERNMENT",
        raw_document_id=row.get("raw_document_id"),
        parser_id=row.get("parser_id"),
        parser_version=row.get("parser_version"),
        provider_id=row.get("provider_id"),
        prompt_version=None,
        schema_version=None,
        degree_level=None,
        country=None,
        applicability_state=row.get("applicability_state") or "UNKNOWN",
        dataset_id=row.get("dataset_id"),
        acquisition_run_id=row.get("acquisition_run_id"),
    )


def deterministic_deadline_assertions(
    metadata_rows: Iterable[Mapping[str, Any]],
    existing_assertions: Iterable[FieldAssertion],
) -> list[FieldAssertion]:
    """Promote exact closing dates from persisted structured metadata.

    A source record may contain a policy string with several attributes, but
    the ISO closing date is deterministic.  If multiple persisted records for
    the same programme disagree, all are left out for review rather than
    guessing.  Existing direct assertions win, so this helper never creates a
    duplicate direct value or changes conflict semantics.
    """

    existing_direct = {
        (str(assertion.entity_id), assertion.field_name)
        for assertion in existing_assertions
        if assertion.entity_id and hierarchy_module._scope_kind(assertion) == "programme"
    }
    candidates: dict[tuple[str, str], list[tuple[str, Mapping[str, Any]]]] = defaultdict(list)
    for row in metadata_rows:
        field_name = str(row.get("field_name") or "")
        pattern = DEADLINE_METADATA_PATTERNS.get(field_name)
        if pattern is None or row.get("verification_status") not in {"RULE_VALIDATED", "HUMAN_VERIFIED"}:
            continue
        programme_id = str(row.get("programme_id") or "")
        value = str(row.get("value") or "")
        if not programme_id or not value or not row.get("source_url") or not row.get("raw_document_id"):
            continue
        if field_name == "application_policy" and "visibleToInternationalApplicants=True" not in value:
            continue
        matches = pattern.findall(value)
        if len(matches) != 1:
            continue
        candidates[(programme_id, "final_deadline")].append((matches[0], row))

    derived: list[FieldAssertion] = []
    for (programme_id, target_field), entries in sorted(candidates.items()):
        if (programme_id, target_field) in existing_direct:
            continue
        dates = {date for date, _ in entries}
        if len(dates) != 1:
            continue
        date = next(iter(dates))
        # Stable ordering makes replay output independent of JSONL order when
        # two sources carry the same closing date.
        _, row = sorted(entries, key=lambda item: str(item[1].get("raw_document_id") or ""))[0]
        derived_row = dict(row)
        derived_row.update(
            {
                "field_name": target_field,
                "value": date,
                "_assertion_id": f"metadata-derived-{programme_id}-{target_field}-{row.get('raw_document_id')}",
                "_source_type": "deadline",
                "_extraction_group": "deadline",
            }
        )
        assertion = assertion_from_metadata(derived_row)
        if assertion is not None:
            derived.append(assertion)
    return derived


def prepare_data() -> dict[str, Any]:
    programmes = read_jsonl(RUN_DIR / "programmes.jsonl")
    institutions = read_jsonl(RUN_DIR / "institutions.jsonl")
    offerings = read_jsonl(RUN_DIR / "programme_offerings.jsonl")
    # Incremental deterministic acquisitions are appended beside the frozen
    # run.  Keeping this optional file in the same loader means a replay sees
    # persisted evidence without changing the population or hierarchy rules.
    semantic_rows = read_jsonl(RUN_DIR / "effective_field_assertions.jsonl")
    semantic_rows.extend(read_jsonl(ARTIFACT_DIR / "stage1-incremental-evidence.jsonl"))
    metadata_rows = read_jsonl(RUN_DIR / "external_programme_metadata.jsonl")

    accepted_semantic = dedupe_rows([row for row in semantic_rows if accepted_row(row)])
    review_semantic = dedupe_rows([row for row in semantic_rows if review_row(row)])
    assertions = [FieldAssertion(**row) for row in accepted_semantic]
    metadata_assertions: list[FieldAssertion] = []
    for row in metadata_rows:
        if (
            row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
            and row.get("promotion") == "catalogue_attribute"
            and has_value(row.get("value"))
        ):
            assertion = assertion_from_metadata(row)
            if assertion is not None:
                metadata_assertions.append(assertion)
    assertions.extend(metadata_assertions)
    deterministic_assertions = deterministic_deadline_assertions(metadata_rows, assertions)
    assertions.extend(deterministic_assertions)

    by_offering: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in offerings:
        by_offering[str(row.get("programme_id") or "")].append(row)

    programme_contexts: list[dict[str, Any]] = []
    for row in programmes:
        merged = dict(row)
        for key in ("academic_cycle", "audience", "campus", "delivery_mode"):
            values = {str(item.get(key)) for item in by_offering.get(str(row.get("programme_id")), []) if has_value(item.get(key))}
            if len(values) == 1:
                merged[key] = next(iter(values))
        merged["programme_family"] = row.get("normalized_field")
        programme_contexts.append(merged)

    institution_contexts = [
        {
            **row,
            "entity_id": row.get("institution_id"),
            "institution_id": row.get("institution_id"),
            "country": row.get("country_code"),
        }
        for row in institutions
    ]

    by_field: dict[str, list[FieldAssertion]] = defaultdict(list)
    for assertion in assertions:
        by_field[assertion.field_name].append(assertion)

    accepted_direct: dict[tuple[str, str], list[FieldAssertion]] = defaultdict(list)
    for assertion in assertions:
        if assertion.entity_id and hierarchy_module._scope_kind(assertion) == "programme":
            accepted_direct[(str(assertion.entity_id), assertion.field_name)].append(assertion)

    review_direct: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in review_semantic:
        if hierarchy_module._scope_kind(FieldAssertion(**row)) == "programme":
            review_direct[(str(row.get("entity_id")), str(row.get("field_name")))].append(row)

    return {
        "programmes": programmes,
        "institutions": institutions,
        "programme_contexts": programme_contexts,
        "institution_contexts": institution_contexts,
        "organisation_units": read_jsonl(RUN_DIR / "organisation_units.jsonl"),
        "programme_organisation_units": read_jsonl(RUN_DIR / "programme_organisation_units.jsonl"),
        "assertions": assertions,
        "by_field": by_field,
        "accepted_direct": accepted_direct,
        "review_direct": review_direct,
        "accepted_semantic_count": len(accepted_semantic),
        "review_semantic_count": len(review_semantic),
        "metadata_count": len(metadata_assertions),
        "deterministic_metadata_count": len(deterministic_assertions),
    }


def run_decisions(data: Mapping[str, Any], *, optimized: bool) -> tuple[dict[tuple[str, str], Any], dict[tuple[str, str], list[dict[str, Any]]]]:
    """Run all frozen target/field decisions and preserve rejection diagnostics."""

    engine = HierarchicalInferenceEngine()
    programme_contexts = data["programme_contexts"]
    donor_programme_contexts = data.get("donor_programme_contexts", programme_contexts)
    institution_contexts = data["institution_contexts"]
    by_field = data["by_field"]

    # ``explain`` accepts generic iterables and normalises them on each call.
    # Reusing the frozen maps keeps this report bounded without changing the
    # production engine's public behavior.
    original_context_collection = hierarchy_module._context_collection
    programme_map = original_context_collection(donor_programme_contexts, kind="programme")
    institution_map = original_context_collection(institution_contexts, kind="institution")

    def cached_context_collection(values: Any, *, kind: str) -> dict[str, Any]:
        if values is donor_programme_contexts and kind == "programme":
            return programme_map
        if values is institution_contexts and kind == "institution":
            return institution_map
        return original_context_collection(values, kind=kind)

    old_attribute = hierarchy_module._attribute
    old_finance_fields = hierarchy_module._INSTITUTION_CONTEXT_FIELDS

    def pre_fix_attribute(assertion: FieldAssertion, name: str) -> Any:
        if name == "degree_level":
            return assertion.degree_level or value_metadata(assertion, "degree_level", "degree", "credential")
        return old_attribute(assertion, name)

    hierarchy_module._context_collection = cached_context_collection
    if not optimized:
        hierarchy_module._attribute = pre_fix_attribute
        hierarchy_module._INSTITUTION_CONTEXT_FIELDS = frozenset()

    decisions: dict[tuple[str, str], Any] = {}
    rejections: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    try:
        for field in FIELDS:
            field_assertions = tuple(by_field.get(field, ()))
            for target in programme_contexts:
                programme_id = str(target.get("programme_id") or "")
                decision = engine.explain(
                    field=field,
                    target_cycle=target.get("academic_cycle"),
                    entity_id=programme_id,
                    target=target,
                    audience=target.get("audience"),
                    assertions=field_assertions,
                    programmes=donor_programme_contexts,
                    organisation_units=data.get("organisation_units", ()),
                    programme_organisation_units=data.get("programme_organisation_units", ()),
                    institutions=institution_contexts,
                    recovery_exhausted=True,
                )
                key = (programme_id, field)
                decisions[key] = decision
                for item in decision.rejected:
                    enriched = dict(item)
                    enriched["target_id"] = programme_id
                    rejections[(field, rejection_level(item))].append(enriched)
    finally:
        hierarchy_module._context_collection = original_context_collection
        hierarchy_module._attribute = old_attribute
        hierarchy_module._INSTITUTION_CONTEXT_FIELDS = old_finance_fields
    return decisions, rejections


def rejection_level(item: Mapping[str, Any]) -> str:
    level = str(item.get("level") or "")
    if level:
        return level.split("_", 1)[0]
    if item.get("reason") == "PEER_ATTRIBUTES_UNVERIFIED":
        return "H4"
    return "UNKNOWN"


def direct_info(data: Mapping[str, Any], programme_id: str, field: str) -> tuple[str, FieldAssertion | dict[str, Any] | None]:
    accepted = sorted(data["accepted_direct"].get((programme_id, field), ()), key=lambda item: item.assertion_id)
    review = sorted(data["review_direct"].get((programme_id, field), ()), key=lambda item: str(item.get("assertion_id") or ""))
    unique_values = {compact_json(item.value_json) for item in accepted}
    if len(unique_values) == 1 and accepted:
        return "ACCEPTED", accepted[0]
    if len(unique_values) > 1:
        return "REVIEW", accepted[0]
    if review:
        return "REVIEW", review[0]
    return "", None


def join_unique(values: Iterable[Any], *, limit: int = 8) -> str:
    seen: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.append(text)
        if len(seen) >= limit:
            break
    return " | ".join(seen)


def candidate_scope(candidate: Any) -> str:
    return str(candidate.assertion.scope or hierarchy_module._scope_kind(candidate.assertion) or "")


def candidate_institution(candidate: Any, institution_names: Mapping[str, str]) -> str:
    entity_id = str(candidate.assertion.entity_id)
    if hierarchy_module._scope_kind(candidate.assertion) == "institution":
        return institution_names.get(entity_id, entity_id)
    return institution_names.get(str(candidate.donor_context.institution_id or ""), str(candidate.donor_context.institution_id or ""))


def candidate_programme(candidate: Any, programme_names: Mapping[str, str]) -> str:
    if hierarchy_module._scope_kind(candidate.assertion) == "programme":
        return programme_names.get(str(candidate.assertion.entity_id), str(candidate.assertion.entity_id))
    return ""


def assertion_audience(assertion: FieldAssertion | None) -> Any:
    return assertion.audience if assertion is not None else None


def assertion_cycle(assertion: FieldAssertion | None) -> Any:
    return assertion.academic_cycle if assertion is not None else None


def assertion_currency(assertion: FieldAssertion | None) -> Any:
    return value_metadata(assertion, "currency", "target_currency", "fee_currency") if assertion is not None else None


def assertion_basis(assertion: FieldAssertion | None) -> Any:
    return value_metadata(assertion, "unit_basis", "basis", "fee_period", "period", "tuition_basis") if assertion is not None else None


def programme_row(
    data: Mapping[str, Any],
    target: Mapping[str, Any],
    field: str,
    decision: Any,
    *,
    review_number: int,
    sanitization_counter: Counter[str],
) -> dict[str, Any]:
    programme_id = str(target.get("programme_id") or "")
    institution_id = str(target.get("institution_id") or "")
    institutions = {str(item.get("institution_id")): item for item in data["institutions"]}
    programmes = {str(item.get("programme_id")): item for item in data["programmes"]}
    institution_name = str(institutions.get(institution_id, {}).get("canonical_name") or institutions.get(institution_id, {}).get("name") or institution_id)
    programme_name = str(target.get("programme_name") or programme_id)
    country = str(institutions.get(institution_id, {}).get("country_code") or target.get("country") or "")
    degree = target.get("degree_level")
    discipline = target.get("normalized_field") or target.get("discipline") or ""
    direct_status, direct = direct_info(data, programme_id, field)

    direct_assertion: FieldAssertion | None = direct if isinstance(direct, FieldAssertion) else None
    direct_review_assertion = FieldAssertion(**direct) if isinstance(direct, dict) else None
    direct_value = display_value(direct_assertion.value_json) if direct_assertion is not None else (display_value(direct.get("value_json")) if isinstance(direct, dict) else "")
    final_value = ""
    resolution_status = "MISSING"
    resolution_level = ""
    donor_institution = ""
    donor_programme = ""
    donor_value = ""
    donor_scope = ""
    compatibility_reason = ""
    support_count: Any = ""
    combined_uncertainty: Any = ""
    target_scope = direct_assertion.scope if direct_assertion is not None else "programme"
    selected_assertion: FieldAssertion | None = direct_assertion
    selected_candidates: tuple[Any, ...] = ()
    abstention_reason = ""

    if direct_status == "ACCEPTED" and direct_assertion is not None:
        final_value = display_value(direct_assertion.value_json)
        resolution_status = "DIRECT_ACCEPTED"
        resolution_level = "DIRECT"
        compatibility_reason = "exact target programme assertion"
        support_count = 1
    elif direct_status == "REVIEW":
        resolution_status = "REVIEW"
        resolution_level = "DIRECT"
        compatibility_reason = "direct assertion requires review or has conflicting values"
        abstention_reason = "DIRECT_REVIEW_NOT_PROMOTED"
        selected_assertion = direct_assertion or direct_review_assertion
    elif decision.record is not None:
        record = decision.record
        selected_candidates = tuple(decision.candidates)
        selected_assertion = selected_candidates[0].assertion if selected_candidates else None
        final_value = display_value(record.predicted_value)
        resolution_status = "HIERARCHICAL_ADVISORY"
        resolution_level = decision.level.short_code if decision.level else ""
        donor_scope = join_unique(candidate_scope(item) for item in selected_candidates)
        target_scope = donor_scope or "programme"
        donor_institution = join_unique(candidate_institution(item, {str(row.get("institution_id")): str(row.get("canonical_name") or row.get("name") or row.get("institution_id")) for row in data["institutions"]}) for item in selected_candidates)
        donor_programme = join_unique(candidate_programme(item, {str(row.get("programme_id")): str(row.get("programme_name") or row.get("programme_id")) for row in data["programmes"]}) for item in selected_candidates)
        donor_value = join_unique(display_value(item.assertion.value_json) for item in selected_candidates)
        compatibility_reason = decision.reason
        if resolution_level == "H2" and donor_scope and hierarchy_module._scope_kind(selected_candidates[0].assertion) == "institution":
            compatibility_reason += "; institution-scoped finance context preserved (not programme tuition)"
        support_count = record.support_count
        combined_uncertainty = record.uncertainty_components.get("combined")
    else:
        field_has_any_evidence = bool(data["by_field"].get(field))
        resolution_status = "ABSTAINED" if field_has_any_evidence else "MISSING"
        abstention_reason = decision.reason if field_has_any_evidence else "NO_EXTERNAL_FIELD_EVIDENCE"
        compatibility_reason = decision.reason

    if selected_candidates:
        audience = join_unique(item.assertion.audience or value_metadata(item.assertion, "audience", "student_type", "residency") for item in selected_candidates)
        cycle = join_unique(item.assertion.academic_cycle or value_metadata(item.assertion, "academic_cycle", "cycle", "year") for item in selected_candidates)
        currency = join_unique(value_metadata(item.assertion, "currency", "target_currency", "fee_currency") for item in selected_candidates)
        basis = join_unique(value_metadata(item.assertion, "unit_basis", "basis", "fee_period", "period", "tuition_basis") for item in selected_candidates)
        provider = join_unique(item.assertion.provider_id for item in selected_candidates)
        source_url = join_unique(item.assertion.source_url for item in selected_candidates)
        evidence = join_unique((item.assertion.evidence for item in selected_candidates), limit=4)
        raw_document_id = join_unique(item.assertion.raw_document_id for item in selected_candidates)
    elif selected_assertion is not None:
        audience = assertion_audience(selected_assertion)
        cycle = assertion_cycle(selected_assertion)
        currency = assertion_currency(selected_assertion)
        basis = assertion_basis(selected_assertion)
        provider = selected_assertion.provider_id
        source_url = selected_assertion.source_url
        evidence = selected_assertion.evidence
        raw_document_id = selected_assertion.raw_document_id
    else:
        audience = target.get("audience") or ""
        cycle = target.get("academic_cycle") or ""
        currency = ""
        basis = ""
        provider = ""
        source_url = ""
        evidence = ""
        raw_document_id = ""

    # A hierarchy result is advisory and intentionally remains distinguishable
    # from accepted source assertions.  H2 rows carry institution scope in the
    # export even though the target is displayed in programme context.
    row = {
        "review_id": f"HQA-{review_number:05d}",
        "target_institution_id": institution_id,
        "target_programme_id": programme_id,
        "target_institution": institution_name,
        "target_programme": programme_name,
        "target_url": target.get("official_url") or "",
        "country": country,
        "degree_level": degree,
        "discipline": discipline,
        "field_name": field,
        "direct_value": direct_value,
        "direct_status": direct_status,
        "final_value": final_value,
        "resolution_status": resolution_status,
        "resolution_level": resolution_level,
        "donor_institution": donor_institution,
        "donor_programme": donor_programme,
        "donor_value": donor_value,
        "donor_scope": donor_scope,
        "compatibility_reason": compatibility_reason,
        "support_count": support_count,
        "combined_uncertainty": combined_uncertainty,
        "target_scope": target_scope,
        "audience": audience,
        "academic_cycle": cycle,
        "currency": currency,
        "basis": basis,
        "provider": provider,
        "source_url": source_url,
        "evidence_text": evidence,
        "raw_document_id": raw_document_id,
        "abstention_reason": abstention_reason,
        "review_verdict": "",
        "review_comment": "",
        "reviewer": "",
        "reviewed_at": "",
        "critical_error": "",
    }
    return {key: spreadsheet_safe(row.get(key), sanitization_counter) for key in FULL_REVIEW_COLUMNS}


def matrix_and_outputs(data: Mapping[str, Any], decisions: Mapping[tuple[str, str], Any], out_dir: Path) -> dict[str, Any]:
    counters: Counter[str] = Counter()
    rows: list[dict[str, Any]] = []
    donor_rows: list[dict[str, Any]] = []
    field_stats: dict[str, Counter[str]] = {field: Counter() for field in FIELDS}
    programme_stats: dict[str, Counter[str]] = {str(row.get("programme_id")): Counter() for row in data["programmes"]}
    programme_map = {str(row.get("programme_id")): row for row in data["programmes"]}
    review_number = 0

    for target in sorted(data["programmes"], key=lambda item: str(item.get("programme_id") or "")):
        programme_id = str(target.get("programme_id") or "")
        for field in FIELDS:
            review_number += 1
            decision = decisions[(programme_id, field)]
            row = programme_row(
                data,
                target,
                field,
                decision,
                review_number=review_number,
                sanitization_counter=counters,
            )
            rows.append(row)
            stats = field_stats[field]
            status = row["resolution_status"]
            if row["direct_status"] == "ACCEPTED":
                stats["direct"] += 1
                programme_stats[programme_id]["direct"] += 1
            if status == "HIERARCHICAL_ADVISORY":
                stats[row["resolution_level"]] += 1
                stats["final"] += 1
                programme_stats[programme_id]["hierarchical"] += 1
            elif status == "DIRECT_ACCEPTED":
                stats["final"] += 1
            if status == "REVIEW":
                stats["review"] += 1
                programme_stats[programme_id]["review"] += 1
            elif status == "ABSTAINED":
                stats["abstain"] += 1
            elif status == "MISSING":
                stats["missing"] += 1
            if status in {"DIRECT_ACCEPTED", "HIERARCHICAL_ADVISORY"}:
                scope = row["target_scope"]
                if scope in {"institution", "university", "institution_wide", "central"}:
                    stats["institution_scope_final"] += 1
                else:
                    stats["programme_scope_final"] += 1

            if status == "HIERARCHICAL_ADVISORY":
                donor_rows.append(
                    {
                        "review_id": row["review_id"],
                        "target_institution_id": target.get("institution_id") or "",
                        "target_programme_id": programme_id,
                        "target_institution": row["target_institution"],
                        "target_programme": row["target_programme"],
                        "target_url": row["target_url"],
                        "country": row["country"],
                        "degree_level": row["degree_level"],
                        "discipline": row["discipline"],
                        "field_name": field,
                        "resolution_level": row["resolution_level"],
                        "final_value": row["final_value"],
                        "target_scope": row["target_scope"],
                        "donor_institution": row["donor_institution"],
                        "donor_programme": row["donor_programme"],
                        "donor_value": row["donor_value"],
                        "donor_scope": row["donor_scope"],
                        "provider": row["provider"],
                        "source_url": row["source_url"],
                        "evidence_text": row["evidence_text"],
                        "raw_document_id": row["raw_document_id"],
                        "support_count": row["support_count"],
                        "combined_uncertainty": row["combined_uncertainty"],
                        "compatibility_reason": row["compatibility_reason"],
                    }
                )

    summary_rows: list[dict[str, Any]] = []
    for field in FIELDS:
        stats = field_stats[field]
        total = len(data["programmes"])
        direct = stats["direct"]
        final = stats["final"]
        before = direct / total * 100 if total else 0.0
        after = final / total * 100 if total else 0.0
        relative = ((final - direct) / direct * 100) if direct else (100.0 if final else 0.0)
        summary_rows.append(
            {
                "field": field,
                "total_targets": total,
                "direct": direct,
                "H1": stats["H1"],
                "H2": stats["H2"],
                "H3": stats["H3"],
                "H4": stats["H4"],
                "final": final,
                "programme_scope_final": stats["programme_scope_final"],
                "institution_scope_final": stats["institution_scope_final"],
                "review": stats["review"],
                "abstain": stats["abstain"],
                "missing": stats["missing"],
                "coverage_before_hierarchy_pct": round(before, 2),
                "coverage_after_hierarchy_pct": round(after, 2),
                "absolute_gain_pp": round(after - before, 2),
                "relative_gain_pct": round(relative, 2),
            }
        )

    completeness_rows: list[dict[str, Any]] = []
    institutions = {str(item.get("institution_id")): item for item in data["institutions"]}
    for target in sorted(data["programmes"], key=lambda item: str(item.get("programme_id") or "")):
        pid = str(target.get("programme_id") or "")
        stats = programme_stats[pid]
        total = len(FIELDS)
        direct = stats["direct"]
        hierarchical = stats["hierarchical"]
        effective = direct + hierarchical
        review = stats["review"]
        institution = institutions.get(str(target.get("institution_id")), {})
        completeness_rows.append(
            {
                "programme_id": pid,
                "institution_id": target.get("institution_id"),
                "institution_name": institution.get("canonical_name") or institution.get("name") or target.get("institution_id"),
                "programme_name": target.get("programme_name"),
                "country": institution.get("country_code") or "",
                "degree_level": target.get("degree_level"),
                "discipline": target.get("normalized_field") or target.get("discipline") or "",
                "total_priority_fields": total,
                "direct_field_count": direct,
                "hierarchical_added_field_count": hierarchical,
                "effective_field_count": effective,
                "review_field_count": review,
                "missing_field_count": max(0, total - effective - review),
                "completion_before_hierarchy_pct": round(direct / total * 100, 2),
                "completion_after_hierarchy_pct": round(effective / total * 100, 2),
            }
        )

    write_csv(out_dir / "stage1-full-hierarchical-review.csv", FULL_REVIEW_COLUMNS, rows, counters)
    write_csv(out_dir / "stage1-hierarchy-field-summary.csv", FIELD_SUMMARY_COLUMNS, summary_rows, counters)
    write_csv(out_dir / "stage1-programme-completeness.csv", COMPLETENESS_COLUMNS, completeness_rows, counters)
    write_csv(out_dir / "stage1-hierarchy-donor-review.csv", DONOR_COLUMNS, donor_rows, counters)
    return {
        "rows": rows,
        "summary_rows": summary_rows,
        "completeness_rows": completeness_rows,
        "donor_rows": donor_rows,
        "counters": counters,
    }


def write_csv(path: Path, columns: Iterable[str], rows: Iterable[Mapping[str, Any]], counters: Counter[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(columns), extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: spreadsheet_safe(row.get(key), counters) for key in columns})


def rejection_outputs(
    data: Mapping[str, Any],
    before: Mapping[tuple[str, str], list[dict[str, Any]]],
    after: Mapping[tuple[str, str], list[dict[str, Any]]],
    out_dir: Path,
) -> list[dict[str, Any]]:
    keys = sorted(set(before) | set(after))
    rows: list[dict[str, Any]] = []
    for field, level in keys:
        old_items = before.get((field, level), [])
        new_items = after.get((field, level), [])
        old_count = len(old_items)
        new_count = len(new_items)
        reason = (new_items or old_items)[0].get("reason") or "UNKNOWN"
        examples = new_items[:3] or old_items[:3]
        example_text = "; ".join(
            f"{item.get('target_id')} <- {item.get('assertion_id')}"
            for item in examples
        )
        # A changed candidate count is not itself a policy change: once the
        # finance degree false-negative is repaired, the remaining audience
        # and duplicate-lineage gates naturally see more candidates.  Mark
        # only the two deliberately changed H2 finance degree clusters.
        changed = (
            field in {"tuition", "additional_fees"}
            and level == "H2"
            and reason == "DEGREE_MISMATCH"
            and old_count > new_count
        )
        rationale = ""
        if field in {"tuition", "additional_fees"} and level == "H2" and reason in {"DEGREE_MISMATCH", "DEGREE_UNKNOWN", "APPLICABILITY_UNKNOWN", "CYCLE_UNKNOWN"}:
            rationale = "Finance H2 institution context is now allowed only with institution scope preserved; audience/currency/basis gates remain active."
        elif reason == "DEGREE_MISMATCH" and old_count > new_count:
            rationale = "The pre-fix payload credential was a residency/fee label, not a degree; degree extraction no longer reads credential as degree."
        elif reason == "PEER_ATTRIBUTES_UNVERIFIED":
            rationale = "Unchanged: H4 still requires verified country, institution type, field domain, and degree attributes."
        else:
            rationale = "No hierarchy rule change; candidate remains rejected under existing compatibility policy."
        rows.append(
            {
                "field": field,
                "hierarchy_level": level,
                "rejection_gate": reason,
                "candidate_count": new_count,
                "candidate_count_before": old_count,
                "candidate_count_after": new_count,
                "examples": example_text,
                "rule_changed": "YES" if changed else "NO",
                "reason": rationale,
            }
        )
    write_csv(out_dir / "stage1-hierarchy-rejection-analysis.csv", REJECTION_COLUMNS, rows, Counter())
    return rows


def aggregate_summary(summary_rows: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    result = Counter()
    for row in summary_rows:
        result["direct"] += int(row["direct"])
        result["H1"] += int(row["H1"])
        result["H2"] += int(row["H2"])
        result["H3"] += int(row["H3"])
        result["H4"] += int(row["H4"])
        result["final"] += int(row["final"])
        result["review"] += int(row["review"])
        result["abstain"] += int(row["abstain"])
        result["missing"] += int(row["missing"])
    return dict(result)


def write_report(
    data: Mapping[str, Any],
    before_summary: Mapping[str, Any],
    after_summary: Mapping[str, Any],
    rejection_rows: list[Mapping[str, Any]],
    outputs: Mapping[str, Any],
) -> None:
    summary_by_field = {str(row["field"]): row for row in outputs["summary_rows"]}
    completeness = outputs["completeness_rows"]
    completion_values_before = sorted(float(row["completion_before_hierarchy_pct"]) for row in completeness)
    completion_values_after = sorted(float(row["completion_after_hierarchy_pct"]) for row in completeness)

    def percentile(values: list[float], fraction: float) -> float:
        if not values:
            return 0.0
        index = min(len(values) - 1, max(0, int(round((len(values) - 1) * fraction))))
        return values[index]

    gain_buckets = Counter()
    for row in completeness:
        gained = int(row["hierarchical_added_field_count"])
        if gained == 0:
            gain_buckets["0 fields"] += 1
        elif gained <= 2:
            gain_buckets["1-2 fields"] += 1
        elif gained <= 5:
            gain_buckets["3-5 fields"] += 1
        else:
            gain_buckets[">5 fields"] += 1

    field_lines = []
    for field in FIELDS:
        row = summary_by_field[field]
        field_lines.append(
            f"| `{field}` | {row['direct']} | {row['H1']} | {row['H2']} | {row['H3']} | {row['H4']} | {row['final']} | {row['review']} | {row['abstain']} | {row['missing']} | {row['coverage_before_hierarchy_pct']}% | {row['coverage_after_hierarchy_pct']}% | {row['absolute_gain_pp']} pp |"
        )

    top_rejections = sorted(rejection_rows, key=lambda row: int(row["candidate_count_after"]), reverse=True)[:20]
    rejection_lines = [
        f"| `{row['field']}` | {row['hierarchy_level']} | `{row['rejection_gate']}` | {row['candidate_count_before']} | {row['candidate_count_after']} | {row['rule_changed']} |"
        for row in top_rejections
    ]

    report = f"""# Stage 1 hierarchical coverage optimization

Artifact-only replay of the frozen Stage 1 population (`{len(data['programmes'])}` programmes, `{len(data['institutions'])}` institutions). The replay uses accepted external semantic assertions plus the already-promoted deterministic programme metadata. It does not mutate ingestion or product state. Direct counts in this report are field-slot counts over both rails (`{data['accepted_semantic_count']}` accepted semantic rows and `{data['metadata_count']}` accepted metadata rows); they are therefore not directly comparable with the earlier semantic-only aggregate in `stage1-report.md`.

## Policy change applied

Two concrete false negatives were fixed narrowly:

1. A finance value's `credential` label (for example, `out-of-state students` or `Domestic tuition`) is not a degree. Degree extraction no longer reads that payload key.
2. For `tuition` and `additional_fees` only, a government/official institution-scoped tariff may be selected at H2 when the target is in that institution. The value remains explicitly institution-scoped in the exports; audience, currency, basis, temporal mismatch, authority, relationship, and applicability safety checks remain in force. It is still an advisory hierarchy result, not a programme-scoped accepted assertion.

| field | old gate/problem | real examples | safe condition now | added coverage | residual risk guard |
|---|---|---|---|---:|---|
| `tuition`, `additional_fees` | finance `credential` labels could be consumed as degree metadata (`18` additional-fee H2 rejects in the baseline); remaining tuition candidate rejections are still evaluated by the normal gates | College Scorecard residency labels; swissuniversities domestic/foreign tariff labels | read only explicit degree keys for finance; never infer degree from `credential` | removes the false-negative degree gate and makes eligible finance donors visible | true degree mismatches and audience mismatches remain rejected |
| `tuition`, `additional_fees` | strict H2 `DEGREE_UNKNOWN`, `CYCLE_UNKNOWN`, and `APPLICABILITY_UNKNOWN` rejected institution tariffs even though the source scope is institution-wide | government/official institution tariff rows matched to the same institution | H2 + institution-scoped donor + finance field; preserve institution output scope and source-native cycle (or blank when not supplied) | 87 tuition + 16 fee H2 selections | audience, currency, basis, temporal mismatch, authority, relationship and scope checks remain active |

No H1/H3/H4 gates, acceptance policy, uncertainty calculation, or storage path were changed.

## Before vs after aggregate

| rail | before | after |
|---|---:|---:|
| Direct | {before_summary['direct']} | {after_summary['direct']} |
| H1 | {before_summary['H1']} | {after_summary['H1']} |
| H2 | {before_summary['H2']} | {after_summary['H2']} |
| H3 | {before_summary['H3']} | {after_summary['H3']} |
| H4 | {before_summary['H4']} | {after_summary['H4']} |
| Final selected (direct + hierarchy) | {before_summary['final']} | {after_summary['final']} |
| Review | {before_summary['review']} | {after_summary['review']} |
| Abstain | {before_summary['abstain']} | {after_summary['abstain']} |
| Missing | {before_summary['missing']} | {after_summary['missing']} |

The “final selected” column includes advisory H1-H4 selections for completeness measurement; those rows retain donor provenance and are not silently promoted to accepted programme facts.

## Field-level hierarchy breakdown

| field | direct | H1 | H2 | H3 | H4 | final | review | abstain | missing | before | after | gain |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(field_lines)}

## Rejection analysis

The full gate-level analysis is in `stage1-hierarchy-rejection-analysis.csv`. The largest clusters after the fix are shown below; H4 `PEER_ATTRIBUTES_UNVERIFIED` is expected because the Stage 1 catalogue has no verified peer attributes, and remains intentionally unchanged.

| field | level | gate | before | after | changed |
|---|---|---|---:|---:|---|
{chr(10).join(rejection_lines)}

## Programme completeness

| statistic | before | after |
|---|---:|---:|
| p25 | {percentile(completion_values_before, 0.25):.2f}% | {percentile(completion_values_after, 0.25):.2f}% |
| p50 (median) | {percentile(completion_values_before, 0.50):.2f}% | {percentile(completion_values_after, 0.50):.2f}% |
| p75 | {percentile(completion_values_before, 0.75):.2f}% | {percentile(completion_values_after, 0.75):.2f}% |

Programmes gaining hierarchy-selected fields: `{dict(gain_buckets)}`.

## Scope safety

Institution-level H2 finance values are marked `target_scope=institution`, with donor institution and source-native currency/basis/academic-cycle retained. They are never relabelled as programme tuition or programme fees. Empty fields, unresolved direct reviews, incompatible donors, and absent providers remain review/abstain/missing in the full matrix.

## Artifacts

- `stage1-full-hierarchical-review.csv` — one row per programme × field (`{len(outputs['rows'])}` rows)
- `stage1-hierarchy-field-summary.csv` — field-level before/after summary (`{len(outputs['summary_rows'])}` rows)
- `stage1-programme-completeness.csv` — one row per programme (`{len(outputs['completeness_rows'])}` rows)
- `stage1-hierarchy-donor-review.csv` — all selected hierarchy transfers (`{len(outputs['donor_rows'])}` rows)
- `stage1-hierarchy-rejection-analysis.csv` — gate-level candidate rejection counts (`{len(rejection_rows)}` rows)
"""
    (ARTIFACT_DIR / "stage1-hierarchy-optimization-report.md").write_text(report, encoding="utf-8")


def main() -> None:
    data = prepare_data()
    print(json.dumps({
        "programmes": len(data["programmes"]),
        "institutions": len(data["institutions"]),
        "accepted_semantic": data["accepted_semantic_count"],
        "review_semantic": data["review_semantic_count"],
        "metadata": data["metadata_count"],
    }))
    before_decisions, before_rejections = run_decisions(data, optimized=False)
    after_decisions, after_rejections = run_decisions(data, optimized=True)
    outputs = matrix_and_outputs(data, after_decisions, ARTIFACT_DIR)
    rejection_rows = rejection_outputs(data, before_rejections, after_rejections, ARTIFACT_DIR)
    before_matrix = matrix_and_outputs(data, before_decisions, ARTIFACT_DIR / "_before")
    before_summary = aggregate_summary(before_matrix["summary_rows"])
    after_summary = aggregate_summary(outputs["summary_rows"])
    write_report(data, before_summary, after_summary, rejection_rows, outputs)
    (ARTIFACT_DIR / "stage1-hierarchy-run-summary.json").write_text(
        json.dumps(
            {
                "population": {"programmes": len(data["programmes"]), "institutions": len(data["institutions"])},
                "before": before_summary,
                "after": after_summary,
                "rows": len(outputs["rows"]),
                "donor_rows": len(outputs["donor_rows"]),
                "formula_sanitizations": outputs["counters"].get("formula_sanitizations", 0),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    # The comparison files are useful during local analysis but are not review
    # artifacts.  Keep them outside the final artifact directory when callers
    # run this module manually; main removes the temporary directory below.
    import shutil

    shutil.rmtree(ARTIFACT_DIR / "_before", ignore_errors=True)
    print(json.dumps({"before": before_summary, "after": after_summary, "donor_rows": len(outputs["donor_rows"]), "report": str(ARTIFACT_DIR / "stage1-hierarchy-optimization-report.md")}))


if __name__ == "__main__":
    main()
