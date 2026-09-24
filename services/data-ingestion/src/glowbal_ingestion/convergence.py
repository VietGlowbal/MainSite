"""Phase 3E wire contract for every ingestion adapter.

The Node compatibility adapters and this Python module intentionally emit the
same conceptual envelope: source metadata, raw evidence references, staged
assertions, identity hints, and a mandatory Slice C/promotion-v3 handoff. The
module is pure and never performs network or canonical writes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from .models import FieldAssertion, stable_id, utc_now_iso


CONVERGENCE_VERSION = "ingestion-convergence/v1"
PYTHON_ADAPTER_VERSION = "python-acquisition/v1"


@dataclass(frozen=True)
class ConvergenceSource:
    source_id: str
    adapter: str
    adapter_version: str
    source_path: str
    source_url: str | None
    source_owner: str | None
    parser_version: str | None
    file_id: str | None
    file_hash: str | None
    row_locator: str | None
    observed_at: str
    lifecycle: str = "SHADOWED"


@dataclass(frozen=True)
class ConvergenceRawEvidence:
    kind: str
    source_id: str
    raw_document_id: str | None
    locator: str | None
    content_hash: str | None
    retained: bool
    limitation: str | None


@dataclass(frozen=True)
class ConvergenceAssertion:
    assertion_id: str
    entity_type: str
    entity_key: str
    field: str
    value: Any
    source: ConvergenceSource
    raw_evidence: ConvergenceRawEvidence
    original_value: Any
    epistemic: str = "OBSERVED"
    temporal: str = "UNKNOWN"
    verification: str = "UNVALIDATED"
    authority: str | None = None
    audience: str | None = None
    academic_cycle: str | None = None
    validated: bool = False
    trusted_for_canonical_promotion: bool = False
    provenance_limitations: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "assertion_id": self.assertion_id,
            "entity_type": self.entity_type,
            "entity_key": self.entity_key,
            "field": self.field,
            "value": self.value,
            "source": self.source.__dict__,
            "raw_evidence": self.raw_evidence.__dict__,
            "original_value": self.original_value,
            "epistemic": self.epistemic,
            "temporal": self.temporal,
            "verification": self.verification,
            "authority": self.authority,
            "audience": self.audience,
            "academic_cycle": self.academic_cycle,
            "validated": self.validated,
            "trusted_for_canonical_promotion": self.trusted_for_canonical_promotion,
            "provenance_limitations": list(self.provenance_limitations),
        }


@dataclass(frozen=True)
class ConvergenceEnvelope:
    ingestion_id: str
    source: ConvergenceSource
    raw_evidence: ConvergenceRawEvidence
    assertions: tuple[ConvergenceAssertion, ...]
    identity_hint: Mapping[str, Any]
    acquisition_intent: Mapping[str, Any] | None = None
    provenance_limitations: tuple[str, ...] = ()
    contract_version: str = CONVERGENCE_VERSION

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract_version": self.contract_version,
            "ingestion_id": self.ingestion_id,
            "source": self.source.__dict__,
            "raw_evidence": self.raw_evidence.__dict__,
            "assertions": [item.to_dict() for item in self.assertions],
            "identity_hint": dict(self.identity_hint),
            "acquisition_intent": dict(self.acquisition_intent) if self.acquisition_intent else None,
            "provenance_limitations": list(self.provenance_limitations),
            "quality_handoff": {
                "required": True,
                "policy_input": "slice_c",
                "promotion_mode": "shadow",
            },
            "canonical_write": {
                "allowed": False,
                "reason": "requires_product_safety_contract_and_promotion_v3",
            },
        }


class ProgrammeAcquisitionAdapter:
    """Adapt existing Python FieldAssertions without changing their meaning."""

    VERSION = PYTHON_ADAPTER_VERSION

    @classmethod
    def from_field_assertions(
        cls,
        assertions: Iterable[FieldAssertion],
        *,
        source_path: str = "services/data-ingestion/src/glowbal_ingestion/pipeline.py",
        source_url: str | None = None,
        source_owner: str | None = None,
        file_id: str | None = None,
        file_hash: str | None = None,
        row_locator: str | None = None,
        raw_document_id: str | None = None,
        raw_retained: bool = False,
        observed_at: str | None = None,
    ) -> ConvergenceEnvelope:
        items = tuple(assertions)
        if not items:
            raise ValueError("convergence adapter requires at least one assertion")
        first = items[0] if items else None
        source_id = stable_id(
            "convergence-source",
            "python_acquisition",
            source_url or "",
            file_id or "",
            file_hash or "",
            row_locator or "",
        )
        source = ConvergenceSource(
            source_id=source_id,
            adapter="python_acquisition",
            adapter_version=cls.VERSION,
            source_path=source_path,
            source_url=source_url,
            source_owner=source_owner,
            parser_version=first.parser_version if first else None,
            file_id=file_id,
            file_hash=file_hash,
            row_locator=row_locator,
            observed_at=observed_at or utc_now_iso(),
        )
        evidence = ConvergenceRawEvidence(
            kind="remote_raw" if raw_retained else "none",
            source_id=source_id,
            raw_document_id=raw_document_id,
            locator=source_url,
            content_hash=first.source_content_hash if first else None,
            retained=raw_retained,
            limitation=None if raw_retained else "RAW_EVIDENCE_NOT_RETAINED",
        )
        entity_key = first.entity_id if first else stable_id("empty-convergence", source_id)
        adapted = tuple(
            ConvergenceAssertion(
                assertion_id=stable_id("convergence-assertion", item.assertion_id),
                entity_type=item.entity_type,
                entity_key=item.entity_id,
                field=item.field_name,
                value=item.value_json,
                source=source,
                raw_evidence=evidence,
                original_value=item.value_json,
                epistemic=item.epistemic_state.value,
                temporal=item.temporal_state.value,
                verification=item.verification_status.value,
                authority=item.source_authority.value if item.source_authority else None,
                audience=item.audience,
                academic_cycle=item.academic_cycle,
                validated=not item.validation_errors,
                trusted_for_canonical_promotion=False,
                provenance_limitations=(
                    ("RAW_EVIDENCE_NOT_RETAINED",)
                    if not raw_retained
                    else ()
                ),
            )
            for item in items
        )
        return ConvergenceEnvelope(
            ingestion_id=stable_id("python-convergence", source_id, entity_key),
            source=source,
            raw_evidence=evidence,
            assertions=adapted,
            identity_hint={
                "entity_type": "programme",
                "institution_id": first.entity_id if first else None,
                "programme_code": None,
                "name": None,
                "degree_level": None,
            },
            provenance_limitations=(
                ("RAW_EVIDENCE_NOT_RETAINED",)
                if not raw_retained
                else ()
            ),
        )


def assert_converged_canonical_write(
    *,
    source_path: str,
    quality_passed: bool,
    promotion_v3: bool,
    privileged: bool = False,
) -> None:
    """Guard the normal ingestion boundary; repairs/migrations stay explicit."""
    if privileged:
        return
    if not quality_passed or not promotion_v3:
        raise RuntimeError(
            "DIRECT_CANONICAL_WRITE_BLOCKED: normal ingestion must pass "
            f"Product Safety and promotion-v3 ({source_path})"
        )


__all__ = [
    "CONVERGENCE_VERSION",
    "ConvergenceAssertion",
    "ConvergenceEnvelope",
    "ConvergenceRawEvidence",
    "ConvergenceSource",
    "ProgrammeAcquisitionAdapter",
    "assert_converged_canonical_write",
]
