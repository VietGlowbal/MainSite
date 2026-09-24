"""Generate an advisory maximum-fill view from the frozen Stage 1 evidence.

This module is deliberately separate from the production replay.  It keeps
the verified 230-programme recipient population and the independent donor
pool, while allowing unknown compatibility dimensions to remain UNKNOWN.  It
never writes the strict export or changes the production hierarchy engine.
"""

from __future__ import annotations

import json
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Mapping


ARTIFACT_DIR = Path(__file__).resolve().parent
if str(ARTIFACT_DIR) not in sys.path:
    sys.path.insert(0, str(ARTIFACT_DIR))

import generate_hierarchy_reports as reports  # noqa: E402
import rebuild_verified_population as rebuild  # noqa: E402
import glowbal_ingestion.hierarchical_inference as hierarchy_module  # noqa: E402
from glowbal_ingestion.hierarchical_inference import (  # noqa: E402
    HierarchicalInferenceEngine,
    HierarchyLevel,
)
from glowbal_ingestion.models import (  # noqa: E402
    ApplicabilityState,
    FieldAssertion,
    SourceAuthority,
    TemporalState,
)


MAX_FILL_CSV = ARTIFACT_DIR / "stage1-programme-max-fill-results.csv"
MAX_FILL_AUDIT_CSV = ARTIFACT_DIR / "stage1-programme-max-fill-audit.csv"
MAX_FILL_FIELD_SUMMARY_CSV = ARTIFACT_DIR / "stage1-max-fill-field-summary.csv"
MAX_FILL_COMPLETENESS_CSV = ARTIFACT_DIR / "stage1-max-fill-completeness.csv"
MAX_FILL_SUMMARY_JSON = ARTIFACT_DIR / "stage1-max-fill-replay-summary.json"

MAX_FILL_LEVELS = frozenset(
    {
        HierarchyLevel.PARENT_ORGANISATION,
        HierarchyLevel.INSTITUTION,
        HierarchyLevel.SIBLING_PROGRAMME,
    }
)

AUDIT_COLUMNS = (
    "programme_id",
    "institution_id",
    "programme_name",
    "field_name",
    "final_value",
    "resolution_status",
    "resolution_level",
    "field_scope",
    "donor_entity_ids",
    "donor_entities",
    "donor_scope",
    "provider",
    "source_url",
    "raw_document_ids",
    "compatibility",
    "cycle_compatibility",
    "applicability_compatibility",
    "uncertainty",
    "uncertainty_category",
    "support_count",
    "donor_assertion_ids",
    "reason",
)


def _enum_value(value: Any) -> str:
    return str(getattr(value, "value", value or ""))


def _has_lineage(assertion: FieldAssertion) -> bool:
    return bool(
        assertion.source_url
        or assertion.raw_document_id
        or assertion.source_content_hash
        or assertion.evidence_locator
    )


class AggressiveInferenceEngine(HierarchicalInferenceEngine):
    """The same donor selection with UNKNOWN dimensions left unresolved."""

    @staticmethod
    def _compatible(
        *,
        field: str,
        level: HierarchyLevel,
        target: Any,
        donor: Any,
        assertion: FieldAssertion,
        target_cycle: str | None,
        audience: str | None,
    ) -> tuple[bool, str, str, str]:
        target_degree = hierarchy_module._degree_token(target.degree_level)
        donor_degree = hierarchy_module._degree_token(donor.degree_level)
        if target_degree and donor_degree and target_degree != donor_degree:
            return False, "DEGREE_MISMATCH", "MISMATCH", "UNKNOWN"

        target_audience = target.audience or audience
        if not hierarchy_module._audience_match(target_audience, donor.audience):
            return False, "AUDIENCE_MISMATCH", "UNKNOWN", "UNKNOWN"

        target_cycle_value = target_cycle or target.academic_cycle
        donor_cycle = donor.academic_cycle or hierarchy_module._attribute(
            assertion, "academic_cycle"
        )
        if not hierarchy_module._cycle_match(target_cycle_value, donor_cycle):
            return False, "CYCLE_MISMATCH", "MISMATCH", "UNKNOWN"
        cycle_status = "MATCH" if target_cycle_value and donor_cycle else "UNKNOWN"

        target_currency = hierarchy_module._token(target.currency)
        donor_currency = hierarchy_module._token(
            donor.currency or hierarchy_module._attribute(assertion, "currency")
        )
        if target_currency and donor_currency and target_currency != donor_currency:
            return False, "CURRENCY_MISMATCH", cycle_status, "UNKNOWN"

        target_basis = hierarchy_module._token(target.unit_basis)
        donor_basis = hierarchy_module._token(
            donor.unit_basis or hierarchy_module._attribute(assertion, "unit_basis")
        )
        if target_basis and donor_basis and target_basis != donor_basis:
            return False, "UNIT_BASIS_MISMATCH", cycle_status, "UNKNOWN"

        for name, left, right in (
            ("campus", target.campus, donor.campus),
            ("delivery_mode", target.delivery_mode, donor.delivery_mode),
        ):
            if left and right and hierarchy_module._token(left) != hierarchy_module._token(right):
                return False, f"{name.upper()}_MISMATCH", cycle_status, "UNKNOWN"

        temporal_state = _enum_value(assertion.temporal_state)
        if temporal_state == TemporalState.TARGET_CYCLE_ESTIMATE.value:
            return False, "DONOR_IS_INFERRED_ESTIMATE", cycle_status, "UNKNOWN"
        if (
            temporal_state == TemporalState.FUTURE.value
            and target_cycle_value
            and donor_cycle
            and hierarchy_module._years(donor_cycle)
            and hierarchy_module._years(target_cycle_value)
            and min(hierarchy_module._years(donor_cycle))
            > min(hierarchy_module._years(target_cycle_value))
        ):
            return False, "TEMPORAL_FUTURE_MISMATCH", cycle_status, "UNKNOWN"

        # UNKNOWN authority/relationship is retained as uncertainty. Explicit
        # unsafe values and broken lineage are still not usable donors.
        if not _has_lineage(assertion):
            return False, "LINEAGE_MISSING", cycle_status, "UNKNOWN"
        authority = _enum_value(assertion.source_authority)
        if authority == SourceAuthority.OTHER.value:
            return False, "SOURCE_AUTHORITY_UNSAFE", cycle_status, "UNKNOWN"
        relationship = _enum_value(assertion.source_relationship)
        if relationship and relationship not in hierarchy_module._ELIGIBLE_RELATIONSHIPS:
            return False, "SOURCE_RELATIONSHIP_UNSAFE", cycle_status, "UNKNOWN"

        applicability = _enum_value(assertion.applicability_state)
        if applicability == ApplicabilityState.NOT_APPLICABLE.value:
            return False, "NOT_APPLICABLE", cycle_status, "NOT_APPLICABLE"
        if applicability == ApplicabilityState.CONDITIONAL.value and not (
            assertion.applicability_source_url and assertion.applicability_evidence
        ):
            return False, "CONDITIONAL_APPLICABILITY_UNPROVEN", cycle_status, "CONDITIONAL"
        applicability_status = (
            "EXPLICIT"
            if applicability in {
                ApplicabilityState.APPLICABLE.value,
                ApplicabilityState.UNIVERSAL.value,
            }
            or assertion.applicability_evidence
            else "UNKNOWN"
        )
        return True, "", cycle_status, applicability_status

    def _level_candidates(self, **kwargs: Any) -> list[tuple[HierarchyLevel, list[Any]]]:
        return [
            (level, candidates)
            for level, candidates in super()._level_candidates(**kwargs)
            if level in MAX_FILL_LEVELS
        ]


def run_max_fill_decisions(
    data: Mapping[str, Any],
) -> tuple[dict[tuple[str, str], Any], dict[tuple[str, str], list[dict[str, Any]]]]:
    engine = AggressiveInferenceEngine(method_version="hierarchical-inference/max-fill-v1")
    recipients = data["programme_contexts"]
    donors = data.get("donor_programme_contexts", recipients)
    institutions = data["institution_contexts"]
    original_context_collection = hierarchy_module._context_collection
    programme_map = original_context_collection(donors, kind="programme")
    institution_map = original_context_collection(institutions, kind="institution")

    def cached_context_collection(values: Any, *, kind: str) -> dict[str, Any]:
        if values is donors and kind == "programme":
            return programme_map
        if values is institutions and kind == "institution":
            return institution_map
        return original_context_collection(values, kind=kind)

    hierarchy_module._context_collection = cached_context_collection
    decisions: dict[tuple[str, str], Any] = {}
    rejections: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    try:
        for field in reports.FIELDS:
            field_assertions = tuple(data["by_field"].get(field, ()))
            for target in recipients:
                programme_id = str(target.get("programme_id") or "")
                decision = engine.explain(
                    field=field,
                    target_cycle=target.get("academic_cycle"),
                    entity_id=programme_id,
                    target=target,
                    audience=target.get("audience"),
                    assertions=field_assertions,
                    programmes=donors,
                    organisation_units=data.get("organisation_units", ()),
                    programme_organisation_units=data.get("programme_organisation_units", ()),
                    institutions=institutions,
                    recovery_exhausted=True,
                )
                key = (programme_id, field)
                decisions[key] = decision
                for item in decision.rejected:
                    enriched = dict(item)
                    enriched["target_id"] = programme_id
                    rejections[(field, reports.rejection_level(item))].append(enriched)
    finally:
        hierarchy_module._context_collection = original_context_collection
    return decisions, rejections


def choose_decisions(
    data: Mapping[str, Any],
    strict: Mapping[tuple[str, str], Any],
    aggressive: Mapping[tuple[str, str], Any],
) -> dict[tuple[str, str], Any]:
    """Keep strict results and add aggressive results only to missing slots."""

    selected: dict[tuple[str, str], Any] = {}
    for target in data["programme_contexts"]:
        programme_id = str(target.get("programme_id") or "")
        for field in reports.FIELDS:
            key = (programme_id, field)
            strict_decision = strict[key]
            direct_status, _ = reports.direct_info(data, programme_id, field)
            if direct_status in {"ACCEPTED", "REVIEW"} or strict_decision.record is not None:
                selected[key] = strict_decision
            else:
                selected[key] = aggressive[key]
    return selected


def _join(values: Any) -> str:
    if isinstance(values, (list, tuple, set, frozenset)):
        return " | ".join(str(item) for item in values if item not in (None, ""))
    return str(values or "")


def build_audit_rows(
    data: Mapping[str, Any],
    decisions: Mapping[tuple[str, str], Any],
    rows: list[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    targets = {str(row["programme_id"]): row for row in data["programmes"]}
    by_key = {(str(row["target_programme_id"]), str(row["field_name"])): row for row in rows}
    audit: list[dict[str, Any]] = []
    for programme_id, target in sorted(targets.items()):
        for field in reports.FIELDS:
            row = by_key[(programme_id, field)]
            decision = decisions[(programme_id, field)]
            candidates = tuple(getattr(decision, "candidates", ()) or ())
            direct_status, direct = reports.direct_info(data, programme_id, field)
            if direct_status == "ACCEPTED" and isinstance(direct, FieldAssertion):
                level = "H0"
                scope = str(direct.scope or hierarchy_module._scope_kind(direct))
                donor_ids = (str(direct.entity_id),)
                donor_names = ("target programme",)
                donor_assertion_ids = (direct.assertion_id,)
                uncertainty = "0"
                category = "DIRECT"
                support_count = 1
                cycle = "MATCH"
                applicability = "EXPLICIT"
                reason = "DIRECT_TARGET_AVAILABLE"
            elif row.get("resolution_status") == "HIERARCHICAL_ADVISORY" and candidates:
                level = str(row.get("resolution_level") or "")
                scope = str(row.get("target_scope") or "programme")
                donor_ids = tuple(str(item.assertion.entity_id) for item in candidates)
                donor_names = tuple(
                    str(item.donor_context.entity_id) for item in candidates
                )
                donor_assertion_ids = tuple(item.assertion.assertion_id for item in candidates)
                record = decision.record
                uncertainty = str(record.uncertainty_components.get("combined", "")) if record else ""
                category = str(record.uncertainty_category or "") if record else ""
                support_count = record.support_count if record else ""
                cycle = _join(item.cycle_compatibility for item in candidates)
                applicability = _join(item.applicability_compatibility for item in candidates)
                reason = str(getattr(decision, "reason", ""))
            else:
                level = "REVIEW" if direct_status == "REVIEW" else ""
                scope = str(row.get("target_scope") or "")
                donor_ids = ()
                donor_names = ()
                donor_assertion_ids = ()
                uncertainty = ""
                category = ""
                support_count = ""
                cycle = ""
                applicability = ""
                reason = str(getattr(decision, "reason", ""))
            audit.append(
                {
                    "programme_id": programme_id,
                    "institution_id": target.get("institution_id") or "",
                    "programme_name": target.get("programme_name") or "",
                    "field_name": field,
                    "final_value": row.get("final_value") or "",
                    "resolution_status": row.get("resolution_status") or "",
                    "resolution_level": level,
                    "field_scope": scope,
                    "donor_entity_ids": _join(donor_ids),
                    "donor_entities": _join(donor_names),
                    "donor_scope": row.get("donor_scope") or scope,
                    "provider": row.get("provider") or "",
                    "source_url": row.get("source_url") or "",
                    "raw_document_ids": row.get("raw_document_id") or "",
                    "compatibility": row.get("compatibility_reason") or "",
                    "cycle_compatibility": cycle,
                    "applicability_compatibility": applicability,
                    "uncertainty": uncertainty,
                    "uncertainty_category": category,
                    "support_count": support_count,
                    "donor_assertion_ids": _join(donor_assertion_ids),
                    "reason": reason,
                }
            )
    return audit


def aggregate_levels(rows: list[Mapping[str, Any]]) -> Counter[str]:
    """Count the levels that actually appear in the selected output rows.

    A decision can carry a donor record while the row remains REVIEW because
    a direct assertion exists but is not promotable.  Counting decision
    records would therefore overstate applied H3/H1/H2 values.  The matrix is
    the source of truth for the strict and advisory output counts.
    """
    counts: Counter[str] = Counter()
    for row in rows:
        status = str(row.get("resolution_status") or "")
        if status == "DIRECT_ACCEPTED":
            counts["H0"] += 1
        elif status == "HIERARCHICAL_ADVISORY":
            level = str(row.get("resolution_level") or "")
            if level in {"H1", "H2", "H3"}:
                counts[level] += 1
    return counts


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower), 2)


def completeness_quantiles(rows: list[Mapping[str, Any]]) -> dict[str, float]:
    values = [float(row.get("completion_after_hierarchy_pct") or 0.0) for row in rows]
    return {
        "p25": percentile(values, 0.25),
        "median": percentile(values, 0.5),
        "p75": percentile(values, 0.75),
    }


def main() -> None:
    production, context = rebuild.build_population()
    production["verified_rows"] = context["final_rows"]
    raw = reports.prepare_data()
    data = rebuild.remap_hierarchy_data(raw, context)
    strict_decisions, _ = reports.run_decisions(data, optimized=True)
    aggressive_decisions, aggressive_rejections = run_max_fill_decisions(data)
    decisions = choose_decisions(data, strict_decisions, aggressive_decisions)

    with tempfile.TemporaryDirectory(prefix="stage1-max-fill-") as max_dir, tempfile.TemporaryDirectory(
        prefix="stage1-strict-summary-"
    ) as strict_dir:
        outputs = reports.matrix_and_outputs(data, decisions, Path(max_dir))
        strict_outputs = reports.matrix_and_outputs(data, strict_decisions, Path(strict_dir))
    lead_rows = rebuild.make_lead_export(outputs, production, data)
    rebuild.write_csv(MAX_FILL_CSV, rebuild.LEAD_COLUMNS, lead_rows)
    audit_rows = build_audit_rows(data, decisions, outputs["rows"])
    reports.write_csv(MAX_FILL_AUDIT_CSV, AUDIT_COLUMNS, audit_rows, Counter())
    rebuild.write_csv(MAX_FILL_FIELD_SUMMARY_CSV, tuple(reports.FIELD_SUMMARY_COLUMNS), outputs["summary_rows"])
    rebuild.write_csv(MAX_FILL_COMPLETENESS_CSV, tuple(reports.COMPLETENESS_COLUMNS), outputs["completeness_rows"])

    strict_levels = aggregate_levels(strict_outputs["rows"])
    max_levels = aggregate_levels(outputs["rows"])
    new_by_level: Counter[str] = Counter()
    new_by_field: Counter[str] = Counter()
    strict_rows = {
        (str(row["target_programme_id"]), str(row["field_name"])): row
        for row in strict_outputs["rows"]
    }
    max_rows = {
        (str(row["target_programme_id"]), str(row["field_name"])): row
        for row in outputs["rows"]
    }
    for key, row in max_rows.items():
        strict_row = strict_rows[key]
        if not strict_row.get("final_value") and row.get("final_value"):
            level = str(row.get("resolution_level") or "")
            new_by_level[level] += 1
            new_by_field[f"{level}:{key[1]}"] += 1

    summary = {
        "population": {
            "verified_programmes": len(data["programmes"]),
            "institutions": len({str(row.get("institution_id")) for row in data["programmes"]}),
            "synthetic_recipients_excluded": production["classifications"].get("SYNTHETIC_SEED", 0),
        },
        "strict": {
            "levels": dict(sorted(strict_levels.items())),
            "hierarchy": reports.aggregate_summary(strict_outputs["summary_rows"]),
            "field_summary": strict_outputs["summary_rows"],
            "completeness_quantiles": completeness_quantiles(strict_outputs["completeness_rows"]),
        },
        "max_fill": {
            "levels": dict(sorted(max_levels.items())),
            "hierarchy": reports.aggregate_summary(outputs["summary_rows"]),
            "field_summary": outputs["summary_rows"],
            "completeness_quantiles": completeness_quantiles(outputs["completeness_rows"]),
            "new_values_by_level": dict(sorted(new_by_level.items())),
            "new_values_by_field": dict(sorted(new_by_field.items())),
            "rejection_count": sum(len(items) for items in aggressive_rejections.values()),
        },
        "evidence": {
            "new_assertions_added": 0,
            "programme_donor_assertions_retained": sum(
                hierarchy_module._scope_kind(item) == "programme"
                for item in data["assertions"]
            ),
            "institution_donor_assertions_retained": sum(
                hierarchy_module._scope_kind(item) == "institution"
                for item in data["assertions"]
            ),
            "organisation_unit_donor_assertions_retained": sum(
                hierarchy_module._scope_kind(item) == "parent"
                for item in data["assertions"]
            ),
            "programme_donor_contexts_retained": len(data.get("donor_programme_contexts", ())),
            "institution_contexts_retained": len(data.get("institution_contexts", ())),
            "organisation_unit_contexts_retained": len(data.get("organisation_units", ())),
        },
        "rows": len(lead_rows),
        "audit_rows": len(audit_rows),
        "paid_llm_calls": 0,
        "crawl_calls": 0,
    }
    rebuild.write_json(MAX_FILL_SUMMARY_JSON, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
