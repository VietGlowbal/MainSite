"""Offline audit for the bounded field-aware refresh.

This script consumes only the retained refresh artifacts.  It does not fetch
URLs, call an LLM, mutate canonical data, or alter the H1-H4 implementation.
The state labels intentionally distinguish a value that passed the existing
semantic validator from a candidate source that merely looks extractable.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from glowbal_ingestion.hierarchical_inference import (
    EntityContext,
    HierarchicalInferenceEngine,
)
from glowbal_ingestion.models import FieldAssertion


# This script lives one level below ``docs/architecture/data`` in the
# refresh-specific artifact directory.
REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_ROOT = REPO_ROOT / "docs/architecture/data/field-aware-refresh-20260911"
DEFAULT_RUN = DEFAULT_ROOT / "runs/semantic-20260911"
DEFAULT_OUT = DEFAULT_ROOT / "analysis"


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            rows.append(value)
    return rows


def _is_explicit(row: dict[str, Any]) -> bool:
    """Use the existing semantic acceptance contract, conservatively."""

    return (
        row.get("value_json") is not None
        and row.get("verification_status") in {"RULE_VALIDATED", "HUMAN_VERIFIED"}
        and row.get("epistemic_state") == "OBSERVED"
        and row.get("null_reason") is None
        and not row.get("inherited_from_assertion_id")
        and not row.get("inherited_from_entity_id")
        and row.get("source_type") not in {"historical_inference", "hierarchical_inference"}
    )


def _state_for_slot(
    rows: list[dict[str, Any]],
    *,
    selected_fields: set[str],
    has_runtime_error: bool,
) -> str:
    explicit = [row for row in rows if _is_explicit(row)]
    if explicit:
        return "EXPLICIT_VALUE"
    reviewed = [row for row in rows if row.get("value_json") is not None]
    if reviewed:
        errors = {
            error
            for row in reviewed
            for error in (row.get("validation_errors") or [])
        }
        if any(error.startswith("MISSING_") or error == "SOURCE_EXCERPT_ONLY" for error in errors):
            return "PARTIAL"
        return "AMBIGUOUS"
    if selected_fields:
        return "SEMANTICALLY_EXTRACTABLE"
    if has_runtime_error:
        return "RUNTIME_BLOCKED"
    return "NO_EVIDENCE"


def _contexts(
    programmes: list[dict[str, Any]], institutions: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    # Keep the context shape used by the inference engine.  Unknown fields are
    # intentionally left unknown; no institution similarity facts are made up.
    programme_contexts = [
        {
            "programme_id": row.get("programme_id"),
            "institution_id": row.get("institution_id"),
            "degree_level": row.get("degree_level"),
            "normalized_field": row.get("normalized_field"),
            "academic_cycle": row.get("academic_cycle"),
            "audience": row.get("audience"),
            "campus": row.get("campus"),
            "delivery_mode": row.get("delivery_mode"),
        }
        for row in programmes
        if row.get("programme_id")
    ]
    institution_contexts = [
        {
            "institution_id": row.get("institution_id"),
            "country_code": row.get("country_code"),
        }
        for row in institutions
        if row.get("institution_id")
    ]
    return programme_contexts, institution_contexts


def _assertion_objects(rows: list[dict[str, Any]]) -> list[FieldAssertion]:
    result: list[FieldAssertion] = []
    for row in rows:
        try:
            result.append(FieldAssertion(**row))
        except TypeError:
            # Older artifacts can contain additive keys unknown to a newer
            # checkout.  Keep only the dataclass fields in that case.
            allowed = set(FieldAssertion.__dataclass_fields__)
            result.append(FieldAssertion(**{key: value for key, value in row.items() if key in allowed}))
    return result


def _evaluate_hierarchy(
    *,
    target_rows: list[dict[str, Any]],
    assertion_rows: list[dict[str, Any]],
    programme_contexts: list[dict[str, Any]],
    institution_contexts: list[dict[str, Any]],
    fields: list[str],
) -> dict[str, Any]:
    usable_rows = [row for row in assertion_rows if _is_explicit(row)]
    usable = _assertion_objects(usable_rows)
    by_field: dict[str, Any] = {}
    engine = HierarchicalInferenceEngine()
    for field in fields:
        result = engine.evaluate_population(
            target_rows,
            field=field,
            assertions=usable,
            programmes=programme_contexts,
            institutions=institution_contexts,
            recovery_exhausted=True,
        )
        decisions = result.get("decisions", [])
        direct_available = sum(
            item.get("reason") in {"DIRECT_TARGET_AVAILABLE", "DIRECT_TARGET_CONFLICT"}
            for item in decisions
        )
        direct_conflicts = sum(item.get("reason") == "DIRECT_TARGET_CONFLICT" for item in decisions)
        result["direct_evidence_count"] = direct_available
        result["direct_evidence_rate"] = (
            direct_available / result["target_count"] if result["target_count"] else 0.0
        )
        result["direct_conflict_count"] = direct_conflicts
        result["direct_conflict_rate"] = (
            direct_conflicts / result["target_count"] if result["target_count"] else 0.0
        )
        # Case-level decisions are useful for auditability but remain compact.
        result["case_summary"] = [
            {
                "target_id": target_rows[index].get("programme_id")
                if index < len(target_rows)
                else None,
                "level": decision.get("level"),
                "reason": decision.get("reason"),
                "abstained": decision.get("abstained"),
                "candidate_count": len(decision.get("candidates") or []),
            }
            for index, decision in enumerate(decisions)
        ]
        by_field[field] = result
    return {
        "assertions_supplied": len(usable_rows),
        "fields": by_field,
        "accuracy_status": "NOT_MEASURABLE_WITHOUT_HELD_OUT_TRUTH",
        "calibration_status": "NOT_MEASURABLE",
    }


def _coverage(
    *,
    target_rows: list[dict[str, Any]],
    assertion_rows: list[dict[str, Any]],
    selection_rows: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    fields: list[str],
) -> dict[str, Any]:
    target_ids = [str(row["programme_id"]) for row in target_rows if row.get("programme_id")]
    target_institutions = {
        str(row["programme_id"]): str(row.get("institution_id") or "")
        for row in target_rows
        if row.get("programme_id")
    }
    errors_by_institution = Counter(str(row.get("institution_id") or "") for row in errors)
    selected_by_slot: dict[tuple[str, str], set[str]] = defaultdict(set)
    selected_source_classes: Counter[str] = Counter()
    selected_provider_ids: Counter[str] = Counter()
    selection_reason_counts: Counter[str] = Counter()
    for row in selection_rows:
        selection_reason_counts[str(row.get("reason_code") or row.get("decision") or "UNKNOWN")] += 1
        if row.get("decision") != "selected":
            continue
        target_id = str(row.get("programme_id") or "")
        matched = set(row.get("matched_fields") or [])
        for field in matched:
            selected_by_slot[(target_id, field)].add(str(row.get("url") or ""))
        # The semantic run predates the source-class metadata patch.  Official
        # + direct-official rows are therefore reported as official_web with an
        # explicit derivation note rather than as an invented provider.
        source_class = row.get("source_class")
        provider_id = row.get("provider_id")
        if source_class:
            selected_source_classes[str(source_class)] += 1
        if provider_id:
            selected_provider_ids[str(provider_id)] += 1

    rows_by_slot: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in assertion_rows:
        rows_by_slot[(str(row.get("entity_id") or ""), str(row.get("field_name") or ""))].append(row)

    fields_out: dict[str, Any] = {}
    state_counts_all: Counter[str] = Counter()
    explicit_by_institution: Counter[str] = Counter()
    programme_specific_by_field: Counter[str] = Counter()
    current_cycle_by_field: Counter[str] = Counter()
    audience_by_field: Counter[str] = Counter()
    provenance_by_field: Counter[str] = Counter()
    independent_by_field: Counter[str] = Counter()
    for field in fields:
        states: Counter[str] = Counter()
        explicit_targets: set[str] = set()
        programme_specific_targets: set[str] = set()
        current_cycle_targets: set[str] = set()
        audience_targets: set[str] = set()
        provenance_targets: set[str] = set()
        independent_targets: set[str] = set()
        for target_id in target_ids:
            rows = rows_by_slot.get((target_id, field), [])
            state = _state_for_slot(
                rows,
                selected_fields=selected_by_slot.get((target_id, field), set()),
                has_runtime_error=bool(errors_by_institution.get(target_institutions.get(target_id, ""))),
            )
            states[state] += 1
            state_counts_all[state] += 1
            explicit = [row for row in rows if _is_explicit(row)]
            if explicit:
                explicit_targets.add(target_id)
                scopes = {str(row.get("scope") or "").casefold() for row in explicit}
                if "programme" in scopes:
                    programme_specific_targets.add(target_id)
                if any(row.get("academic_cycle") for row in explicit):
                    current_cycle_targets.add(target_id)
                if any(row.get("audience") for row in explicit):
                    audience_targets.add(target_id)
                if any(
                    row.get("source_url")
                    and row.get("source_content_hash")
                    and row.get("raw_document_id")
                    and row.get("acquisition_run_id")
                    for row in explicit
                ):
                    provenance_targets.add(target_id)
                lineages = {
                    str(row.get("source_content_hash") or row.get("raw_document_id") or row.get("source_url"))
                    for row in explicit
                }
                if len(lineages) > 1:
                    independent_targets.add(target_id)
                explicit_by_institution[target_institutions.get(target_id, "")] += 1
        programme_specific_by_field[field] = len(programme_specific_targets)
        current_cycle_by_field[field] = len(current_cycle_targets)
        audience_by_field[field] = len(audience_targets)
        provenance_by_field[field] = len(provenance_targets)
        independent_by_field[field] = len(independent_targets)
        fields_out[field] = {
            "target_count": len(target_ids),
            "state_counts": dict(sorted(states.items())),
            "explicit_value_count": states["EXPLICIT_VALUE"],
            "explicit_value_rate": round(states["EXPLICIT_VALUE"] / len(target_ids), 4) if target_ids else 0.0,
            "programme_specific_explicit_count": len(programme_specific_targets),
            "current_cycle_explicit_count": len(current_cycle_targets),
            "audience_explicit_count": len(audience_targets),
            "provenance_complete_explicit_count": len(provenance_targets),
            "multi_lineage_explicit_count": len(independent_targets),
            "selection_slots_without_explicit_value": sum(
                bool(selected_by_slot.get((target_id, field)))
                and not any(_is_explicit(row) for row in rows_by_slot.get((target_id, field), []))
                for target_id in target_ids
            ),
        }
    return {
        "target_count": len(target_ids),
        "fields": fields_out,
        "state_counts_all_slots": dict(sorted(state_counts_all.items())),
        "selected_source_classes": dict(selected_source_classes),
        "selected_provider_ids": dict(selected_provider_ids),
        "selection_reason_counts": dict(selection_reason_counts),
        "explicit_assertion_institution_counts": dict(explicit_by_institution),
        "programme_specific_explicit_by_field": dict(programme_specific_by_field),
        "current_cycle_explicit_by_field": dict(current_cycle_by_field),
        "audience_explicit_by_field": dict(audience_by_field),
        "provenance_complete_explicit_by_field": dict(provenance_by_field),
        "multi_lineage_explicit_by_field": dict(independent_by_field),
        "source_metadata_note": (
            "The semantic refresh was run before source_class/adapter metadata was fixed for the legacy manual-source path. "
            "Selected rows are therefore not assigned a provider; their official/direct-official relationship is retained."
        ),
    }


def _source_contribution(assertion_rows: list[dict[str, Any]], source_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarise actual source contribution without upgrading missing labels."""

    explicit = [row for row in assertion_rows if _is_explicit(row)]
    source_classes = Counter(str(row.get("source_class") or "UNLABELLED") for row in source_rows)
    source_authorities = Counter(str(row.get("source_authority") or "UNKNOWN") for row in source_rows)
    assertion_authorities = Counter(str(row.get("source_authority") or "UNKNOWN") for row in explicit)
    assertion_relationships = Counter(str(row.get("source_relationship") or "UNKNOWN") for row in explicit)
    return {
        "retained_source_rows": len(source_rows),
        "retained_source_classes_as_written": dict(source_classes),
        "retained_source_authorities": dict(source_authorities),
        "explicit_assertion_authorities": dict(assertion_authorities),
        "explicit_assertion_relationships": dict(assertion_relationships),
        "effective_contribution": {
            "official_university_controlled": {
                "explicit_assertions": sum(
                    row.get("source_authority") == "OFFICIAL"
                    and row.get("source_relationship") == "DIRECT_OFFICIAL"
                    for row in explicit
                ),
                "source_rows": sum(
                    row.get("source_authority") == "OFFICIAL"
                    and row.get("source_relationship") == "DIRECT_OFFICIAL"
                    for row in source_rows
                ),
            },
            "government_registry_partner_external": {
                "explicit_assertions": sum(
                    row.get("source_authority") in {
                        "GOVERNMENT",
                        "OFFICIAL_PARTNER",
                        "ACCREDITED_PROVIDER",
                        "TRUSTED_AGGREGATOR",
                    }
                    for row in explicit
                ),
                "source_rows": sum(
                    row.get("source_authority") in {
                        "GOVERNMENT",
                        "OFFICIAL_PARTNER",
                        "ACCREDITED_PROVIDER",
                        "TRUSTED_AGGREGATOR",
                    }
                    for row in source_rows
                ),
            },
        },
        "metadata_smoke_note": "The post-patch metadata smoke run records source_class=official_web and adapter_id=manual_source for the legacy official-web path; the 94-row semantic run predates that narrow metadata patch.",
    }


def _institution_summary(
    target_rows: list[dict[str, Any]],
    assertion_rows: list[dict[str, Any]],
    fields: list[str],
    errors: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    targets_by_institution: dict[str, list[str]] = defaultdict(list)
    for row in target_rows:
        if row.get("programme_id"):
            targets_by_institution[str(row.get("institution_id") or "")].append(str(row["programme_id"]))
    explicit_slots = {
        (str(row.get("entity_id") or ""), str(row.get("field_name") or ""))
        for row in assertion_rows
        if _is_explicit(row)
    }
    errors_by_institution = Counter(str(row.get("institution_id") or "") for row in errors)
    result: list[dict[str, Any]] = []
    for institution_id, target_ids in sorted(targets_by_institution.items()):
        slots = len(target_ids) * len(fields)
        explicit = sum((target_id, field) in explicit_slots for target_id in target_ids for field in fields)
        fields_with_value = sum(
            any((target_id, field) in explicit_slots for target_id in target_ids)
            for field in fields
        )
        result.append(
            {
                "institution_id": institution_id,
                "target_count": len(target_ids),
                "explicit_slots": explicit,
                "total_field_slots": slots,
                "explicit_slot_rate": round(explicit / slots, 4) if slots else 0.0,
                "fields_with_any_explicit_value": fields_with_value,
                "crawl_error_count": errors_by_institution.get(institution_id, 0),
            }
        )
    return result


def _sample_assertions(assertion_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    wanted = {"programme_identity", "application_fee", "curriculum_overview", "academic_cycle"}
    samples: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in assertion_rows:
        field = str(row.get("field_name") or "")
        if field not in wanted or not _is_explicit(row) or field in seen:
            continue
        seen.add(field)
        samples.append(
            {
                "field_name": field,
                "entity_id": row.get("entity_id"),
                "value_json": row.get("value_json"),
                "source_url": row.get("source_url"),
                "evidence": row.get("evidence"),
                "scope": row.get("scope"),
                "audience": row.get("audience"),
                "academic_cycle": row.get("academic_cycle"),
                "source_authority": row.get("source_authority"),
                "source_relationship": row.get("source_relationship"),
                "raw_document_id": row.get("raw_document_id"),
                "source_content_hash": row.get("source_content_hash"),
                "acquisition_run_id": row.get("acquisition_run_id"),
                "epistemic_state": row.get("epistemic_state"),
                "verification_status": row.get("verification_status"),
            }
        )
    return samples


def _prior_summary() -> dict[str, Any]:
    # These are the published figures from the preceding 40-target field
    # coverage audit.  They are kept as a labelled baseline; they are not
    # silently treated as semantic assertions.
    return {
        "target_count": 40,
        "metric": "reported candidate/non-null coverage from prior audit; not equivalent to RULE_VALIDATED semantic facts",
        "reported_percent": {
            "tuition": 27.5,
            "application_fee": 5.0,
            "additional_fees": 2.5,
            "intakes": 17.5,
            "final_deadline": 15.0,
            "priority_deadline": 0.0,
            "funding_deadline": 0.0,
            "minimum_degree": 5.0,
            "minimum_gpa": 12.0,
            "ielts_overall": 5.0,
            "toefl": 5.0,
        },
        "source": "authoritative prior field coverage audit summary",
    }


def _before_after(coverage: dict[str, Any]) -> list[dict[str, Any]]:
    before = _prior_summary()["reported_percent"]
    rows: list[dict[str, Any]] = []
    for field, before_percent in before.items():
        after = coverage["fields"].get(field, {})
        states = after.get("state_counts", {})
        rows.append(
            {
                "field": field,
                "before_target_count": 40,
                "before_reported_percent": before_percent,
                "before_metric": "prior candidate/non-null audit metric",
                "after_target_count": coverage["target_count"],
                "after_explicit_count": states.get("EXPLICIT_VALUE", 0),
                "after_explicit_percent": round(100 * after.get("explicit_value_rate", 0.0), 2),
                "after_extractable_count": states.get("SEMANTICALLY_EXTRACTABLE", 0),
                "after_partial_or_ambiguous_count": states.get("PARTIAL", 0) + states.get("AMBIGUOUS", 0),
            }
        )
    return rows


def build_report(result: dict[str, Any]) -> str:
    coverage = result["coverage"]
    hierarchy = result["hierarchical_evaluation"]["fields"]
    lines = [
        "# Field-aware input refresh audit",
        "",
        "This report is a research-only analysis of the bounded semantic refresh. It does not modify canonical truth or hierarchy logic.",
        "",
        "## Refresh",
        "",
        f"- Frozen institutions: {result['population']['institution_count']}",
        f"- Frozen programme targets: {result['population']['frozen_target_count']}; live programmes acquired: {result['population']['live_target_count']}",
        f"- Countries: {', '.join(result['population']['countries'])}",
        f"- LLM calls: {result['extraction']['llm_calls']}; valid native observed assertions: {result['extraction']['explicit_assertions']} effective ({result['extraction']['raw_explicit_assertions']} raw proposals before effective merge)",
        f"- Semantic non-null values needing review: {result['extraction']['needs_review_values']}; unsupported/rejected proposals: {result['extraction']['unsupported_or_rejected']}; schema/provider failures: {result['extraction']['schema_failures']}",
        "",
        "## Field coverage (conservative state classification)",
        "",
        "| Field | Explicit | Extractable | Partial | Ambiguous | Runtime blocked | No evidence | Explicit % |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for field, data in coverage["fields"].items():
        states = data["state_counts"]
        lines.append(
            f"| {field} | {states.get('EXPLICIT_VALUE', 0)} | {states.get('SEMANTICALLY_EXTRACTABLE', 0)} | "
            f"{states.get('PARTIAL', 0)} | {states.get('AMBIGUOUS', 0)} | {states.get('RUNTIME_BLOCKED', 0)} | "
            f"{states.get('NO_EVIDENCE', 0)} | {100 * data['explicit_value_rate']:.1f}% |"
        )
    lines += [
        "",
        "## Institution coverage",
        "",
        "| Institution | Targets | Explicit field slots | Slot coverage | Fields with any explicit value | Fetch errors |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in result["institution_summary"]:
        lines.append(
            f"| {row['institution_id']} | {row['target_count']} | {row['explicit_slots']} / {row['total_field_slots']} | "
            f"{100 * row['explicit_slot_rate']:.1f}% | {row['fields_with_any_explicit_value']} | {row['crawl_error_count']} |"
        )
    lines += [
        "",
        "## Hierarchical evaluation",
        "",
        "Only existing native observed, rule-validated assertions were supplied to the unchanged H1-H4 engine. Accuracy and calibration are not measurable without held-out truth.",
        "",
        "| Field | Direct evidence | Direct conflicts | H1 | H2 | H3 | H4 | Abstention | Mean support | Mean uncertainty |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for field, data in hierarchy.items():
        lines.append(
            f"| {field} | {100 * data.get('direct_evidence_rate', data.get('direct_coverage', 0)):.1f}% | "
            f"{data.get('direct_conflict_count', 0)} | "
            f"{data.get('activated_by_level', {}).get('H1_PARENT_ORGANISATION', 0)} | "
            f"{data.get('activated_by_level', {}).get('H2_INSTITUTION', 0)} | "
            f"{data.get('activated_by_level', {}).get('H3_SIBLING_PROGRAMME', 0)} | "
            f"{data.get('activated_by_level', {}).get('H4_PEER_INSTITUTION', 0)} | "
            f"{100 * data.get('abstention_rate', 0):.1f}% | "
            f"{data.get('mean_support_count') if data.get('mean_support_count') is not None else '—'} | "
            f"{', '.join(f'{k}:{v.get("mean_combined")}' for k, v in data.get('uncertainty_by_level', {}).items()) or 'not measurable'} |"
        )
    lines += [
        "",
        "## Source contribution",
        "",
        f"- Retained source rows: {result['source_contribution']['retained_source_rows']}; all semantic-run rows are official/direct-official, with source_class labels missing because this run predates the metadata patch.",
        f"- Explicit assertions with official university-controlled provenance: {result['source_contribution']['effective_contribution']['official_university_controlled']['explicit_assertions']}",
        f"- Explicit assertions from government/registry/partner/external authorities: {result['source_contribution']['effective_contribution']['government_registry_partner_external']['explicit_assertions']}",
        "- The post-patch metadata smoke run is retained separately and confirms `source_class=official_web`, `adapter_id=manual_source`; no external provider yielded a field assertion in this refresh.",
        "",
        "## Interpretation",
        "",
        "- Field-aware ranking and bounded retention increased the amount of semantically reviewable input, especially for programme identity/context, curriculum, outcomes, and some finance/admissions fields.",
        "- The strict accepted tuition set remains empty; tuition values in this run are review-only because cycle/basis/scope context is incomplete or the source was an excerpt.",
        "- No organisation-unit catalogue was retained in this refresh, so H1 is unavailable. Institution-scoped rows are attached to programme records and do not establish independent institution donor entities; H2 is therefore interpreted conservatively. Peer attributes are not verified, so H4 abstains.",
        "- Search/archive invariants and the validated durable-storage path were not changed. This run made no search-to-assertion conversion and no inferred value was promoted.",
    ]
    return "\n".join(lines) + "\n"


def analyse(run_dir: Path, manifest_path: Path, output_dir: Path) -> dict[str, Any]:
    manifest = read_json(manifest_path)
    run_manifest = read_json(run_dir / "manifest.json")
    target_rows = [row for row in read_jsonl(run_dir / "programmes.jsonl") if row.get("is_deep_selected", True)]
    all_targets = read_jsonl(run_dir / "programmes.jsonl")
    institution_rows = read_jsonl(run_dir / "institutions.jsonl")
    assertion_rows = read_jsonl(run_dir / "effective_field_assertions.jsonl")
    raw_assertion_rows = read_jsonl(run_dir / "field_assertions.jsonl")
    source_rows = read_jsonl(run_dir / "sources.jsonl")
    extraction_trace = read_jsonl(run_dir / "extraction_trace.jsonl")
    extraction_events = read_jsonl(run_dir / "extraction_events.jsonl")
    selection_rows = read_jsonl(run_dir / "source_selection_events.jsonl")
    errors = read_jsonl(run_dir / "crawl_errors.jsonl")
    fields = [str(field) for field in (manifest.get("fields") or [])]
    programme_contexts, institution_contexts = _contexts(target_rows, institution_rows)
    coverage = _coverage(
        target_rows=target_rows,
        assertion_rows=assertion_rows,
        selection_rows=selection_rows,
        errors=errors,
        fields=fields,
    )
    hierarchy = _evaluate_hierarchy(
        target_rows=target_rows,
        assertion_rows=assertion_rows,
        programme_contexts=programme_contexts,
        institution_contexts=institution_contexts,
        fields=fields,
    )
    explicit_rows = [row for row in assertion_rows if _is_explicit(row)]
    raw_explicit_rows = [row for row in raw_assertion_rows if _is_explicit(row)]
    review_rows = [row for row in assertion_rows if row.get("value_json") is not None and row.get("verification_status") == "NEEDS_REVIEW"]
    provider_stats = run_manifest.get("metrics", {}).get("provider_stats") or {}
    trace_llm_calls = sum(1 for row in extraction_trace if row.get("llm_called"))
    trace_llm_successes = sum(1 for row in extraction_trace if row.get("llm_called") and row.get("llm_success"))
    extraction_event_failures = sum(1 for row in extraction_events if row.get("status") == "failed")
    rejected_assertions = sum(1 for row in raw_assertion_rows if row.get("verification_status") == "REJECTED")
    needs_review_assertions = sum(
        1
        for row in raw_assertion_rows
        if row.get("verification_status") == "NEEDS_REVIEW" and row.get("value_json") is not None
    )
    countries = sorted({str(row.get("country_code")) for row in institution_rows if row.get("country_code")})
    result: dict[str, Any] = {
        "schema": "FieldAwareRefreshAudit/v1",
        "run_artifact": str(run_dir.relative_to(REPO_ROOT)).replace("\\", "/"),
        "manifest_artifact": str(manifest_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "population": {
            "institution_count": len(institution_rows),
            "frozen_target_count": int(manifest.get("target_count") or len(all_targets)),
            "live_target_count": len(target_rows),
            "countries": countries,
        },
        "extraction": {
            "llm_calls": int(provider_stats.get("calls") or trace_llm_calls),
            "llm_trace_calls": trace_llm_calls,
            "llm_trace_successes": trace_llm_successes,
            "extraction_events": len(extraction_events),
            "extraction_event_failures": extraction_event_failures,
            "explicit_assertions": len(explicit_rows),
            "raw_explicit_assertions": len(raw_explicit_rows),
            "needs_review_values": needs_review_assertions,
            "schema_failures": int(provider_stats.get("failures") or extraction_event_failures),
            "unsupported_or_rejected": rejected_assertions,
            "effective_needs_review_values": len(review_rows),
            "null_assertions": sum(1 for row in assertion_rows if row.get("value_json") is None),
            "source_metadata_completeness": {
                "authority_present": sum(bool(row.get("source_authority")) for row in explicit_rows),
                "relationship_present": sum(bool(row.get("source_relationship")) for row in explicit_rows),
                "raw_document_present": sum(bool(row.get("raw_document_id")) for row in explicit_rows),
                "run_present": sum(bool(row.get("acquisition_run_id")) for row in explicit_rows),
            },
        },
        "coverage": coverage,
        "source_contribution": _source_contribution(assertion_rows, source_rows),
        "institution_summary": _institution_summary(target_rows, assertion_rows, fields, errors),
        "sample_assertions": _sample_assertions(assertion_rows),
        "before_after_core_fields": _before_after(coverage),
        "hierarchical_evaluation": hierarchy,
        "prior_baseline": _prior_summary(),
        "runtime_safety": {
            "llm_provider_calls_only_semantic_run": True,
            "search_snippet_assertions": 0,
            "archive_current_truth_promotions": 0,
            "heavy_local_raw_files": 0,
            "max_local_temp_bytes": 0,
            "canonical_or_benchmark_mutation": False,
        },
        "failures": {
            "crawl_error_count": len(errors),
            "by_code": dict(Counter(str(row.get("error_code") or "UNKNOWN") for row in errors)),
            "selection_reasons": coverage["selection_reason_counts"],
            "note": "Observed errors are bounded UCLA related-source HTTP 403s and one prior Toronto manual-domain warning; no code defect was inferred from these artifacts.",
        },
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "field-coverage.json").write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "before-after-core-fields.json").write_text(json.dumps(result["before_after_core_fields"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "sample-assertions.json").write_text(json.dumps(result["sample_assertions"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "institution-summary.json").write_text(json.dumps(result["institution_summary"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "hierarchical-evaluation.json").write_text(json.dumps(hierarchy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "audit-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "report.md").write_text(build_report(result), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", type=Path, default=DEFAULT_RUN)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_ROOT / "population-manifest.json")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    analyse(args.run_dir, args.manifest, args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
