"""Narrow Supabase-staging serializers for acquisition/source audit records.

They intentionally reject payload-like fields: raw body bytes stay in the
RawEvidenceStore and Supabase receives only IDs and source-resolution metadata.
"""

from __future__ import annotations

from typing import Any

from .acquisition import AcquisitionAttempt, AcquisitionIntent, SourceCandidate


def intent_row(intent: AcquisitionIntent, *, run_id: str) -> dict[str, Any]:
    row = intent.to_dict()
    row.update({"run_id": run_id, "entity_type": intent.entity.entity_type, "entity_id": intent.entity.entity_id})
    row.pop("entity", None)
    return row


def candidate_row(
    candidate: SourceCandidate, *, run_id: str, intent_id: str | None = None
) -> dict[str, Any]:
    return {
        "run_id": run_id, "candidate_id": candidate.candidate_id, "intent_id": intent_id,
        "canonical_locator": candidate.canonical_locator, "locator_type": candidate.locator_type,
        "source_class": candidate.source_class, "publisher_key": candidate.publisher_key,
        "source_authority": candidate.declared_authority.value if candidate.declared_authority else None,
        "source_relationship": candidate.relationship.value if candidate.relationship else None,
        "relationship_evidence": list(candidate.relationship_evidence),
        "expected_field_groups": list(candidate.expected_field_groups), "language": candidate.language,
        "academic_cycle": candidate.academic_cycle, "estimated_freshness": candidate.estimated_freshness,
        "discovery_method": candidate.discovery_method, "discovery_evidence": candidate.discovery_evidence,
        "fetch_strategy": candidate.fetch_strategy, "cost_class": candidate.cost_class,
        "adapter_id": candidate.adapter_id, "adapter_version": candidate.adapter_version,
        "provider_id": candidate.provider_id, "dataset_id": candidate.dataset_id,
        "retrieved_at": candidate.retrieved_at,
        "temporal_state": candidate.temporal_state.value,
        "source_identity": candidate.source_identity,
        "raw_document_id": candidate.raw_document_id,
    }


def admission_row(
    decision: Any, *, run_id: str, admission_decision_id: str,
    intent_id: str | None = None,
) -> dict[str, Any]:
    factors = decision.factor_scores
    return {
        "run_id": run_id, "admission_decision_id": admission_decision_id,
        "acquisition_intent_id": intent_id, "source_candidate_id": decision.candidate.candidate_id,
        "admitted": decision.admitted, "reason": decision.reason,
        "authority_score": factors.get("authority", 0), "relationship_score": factors.get("relationship", 0),
        "temporal_score": factors.get("temporal", 0), "relevance_score": factors.get("relevance", 0),
        "applicability_score": factors.get("applicability", 0), "total_score": decision.total_score,
        "allowed_domain": decision.allowed_domains[-1] if decision.allowed_domains else None,
    }


def attempt_row(attempt: AcquisitionAttempt, *, run_id: str) -> dict[str, Any]:
    return {
        "run_id": run_id, "attempt_id": attempt.attempt_id, "intent_id": attempt.intent_id,
        "candidate_id": attempt.candidate_id, "raw_document_id": attempt.raw_document_id,
        "status": attempt.status, "error_code": attempt.error_code.value if attempt.error_code else None,
        "retryable": attempt.retryable, "started_at": attempt.started_at, "finished_at": attempt.finished_at,
    }


def discovery_evidence_row(
    candidate: SourceCandidate, *, run_id: str, discovery_evidence_id: str
) -> dict[str, Any]:
    return {
        "run_id": run_id, "discovery_evidence_id": discovery_evidence_id,
        "source_candidate_id": candidate.candidate_id,
        "discovery_method": candidate.discovery_method or "unknown",
        "evidence_summary": candidate.discovery_evidence,
        "source_locator": candidate.canonical_locator,
    }
