"""Read-model boundary that keeps verified product truth separate from advice."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from .inference import InferenceRecord
from .models import stable_id
from .promotion_v3 import CanonicalFieldProjection, PromotionStore
from .product_safety import ProductLifecycleState, SafetyEvaluation


class ReadExposure:
    VERIFIED_CURRENT = "VERIFIED_CURRENT"
    ADVISORY_INFERRED = "ADVISORY_INFERRED"
    HISTORICAL = "HISTORICAL"
    PARTIAL = "PARTIAL"
    REVIEWABLE = "REVIEWABLE"


@dataclass(frozen=True)
class ProductReadValue:
    field: str
    value: Any
    exposure: str
    epistemic_state: str
    temporal_state: str
    verification_required: bool
    assertion_id: str | None = None
    raw_document_id: str | None = None
    target_cycle: str | None = None

    def to_dict(self) -> dict[str, object | None]:
        return {
            "field": self.field,
            "value": self.value,
            "exposure": self.exposure,
            "epistemic_state": self.epistemic_state,
            "temporal_state": self.temporal_state,
            "verification_required": self.verification_required,
            "assertion_id": self.assertion_id,
            "raw_document_id": self.raw_document_id,
            "target_cycle": self.target_cycle,
        }


@dataclass(frozen=True)
class ProductReadSnapshot:
    entity_id: str
    target_cycle: str | None
    state: str
    verified_current: dict[str, ProductReadValue] = field(default_factory=dict)
    advisory_estimates: dict[str, ProductReadValue] = field(default_factory=dict)
    historical: dict[str, ProductReadValue] = field(default_factory=dict)
    blocking_reasons: tuple[str, ...] = ()

    @property
    def product_safe(self) -> bool:
        return self.state == ProductLifecycleState.PRODUCT_SAFE

    def to_dict(self) -> dict[str, object]:
        return {
            "entity_id": self.entity_id,
            "target_cycle": self.target_cycle,
            "state": self.state,
            "verified_current": {key: value.to_dict() for key, value in self.verified_current.items()},
            "advisory_estimates": {key: value.to_dict() for key, value in self.advisory_estimates.items()},
            "historical": {key: value.to_dict() for key, value in self.historical.items()},
            "blocking_reasons": list(self.blocking_reasons),
        }


class ProductSafeReadModel:
    """Expose canonical values only after the v3 safety gate.

    ``read_current`` intentionally returns no verified fields for partial or
    reviewable projections.  Callers wanting operational diagnostics can use
    ``read_snapshot`` and inspect the explicit state/blockers instead.
    """

    def __init__(self, store: PromotionStore) -> None:
        self.store = store

    def read_current(self, entity_id: str, target_cycle: str | None = None) -> dict[str, ProductReadValue]:
        snapshot = self.read_snapshot(entity_id, target_cycle)
        return dict(snapshot.verified_current)

    def read_snapshot(
        self,
        entity_id: str,
        target_cycle: str | None = None,
        *,
        inferences: Iterable[InferenceRecord] = (),
    ) -> ProductReadSnapshot:
        safety = self.store.safety(entity_id, target_cycle)
        projection = self.store.projection(entity_id, target_cycle)
        verified = {}
        historical = {}
        if safety is not None and safety.is_product_safe:
            verified = {
                item.field: self._value(item, ReadExposure.VERIFIED_CURRENT)
                for item in projection
                if item.temporal_state == "CURRENT" and not item.advisory
            }
        else:
            historical = {
                item.field: self._value(item, ReadExposure.HISTORICAL)
                for item in projection
                if item.temporal_state == "HISTORICAL"
            }
        advisory = {
            record.field: ProductReadValue(
                field=record.field,
                value=record.predicted_value,
                exposure=ReadExposure.ADVISORY_INFERRED,
                epistemic_state="INFERRED",
                temporal_state="TARGET_CYCLE_ESTIMATE",
                verification_required=True,
                assertion_id=stable_id("inferred-assertion", record.inference_id),
                raw_document_id=(record.supporting_raw_document_ids[0] if record.supporting_raw_document_ids else None),
                target_cycle=record.target_cycle,
            )
            for record in inferences
            if str(getattr(record.status, "value", record.status)) in {"ACTIVE", "CONFIRMED"}
        }
        return ProductReadSnapshot(
            entity_id=entity_id,
            target_cycle=target_cycle,
            state=safety.state if safety is not None else ProductLifecycleState.DISCOVERED,
            verified_current=verified,
            advisory_estimates=advisory,
            historical=historical,
            blocking_reasons=safety.blockers if safety is not None else (),
        )

    @staticmethod
    def _value(item: CanonicalFieldProjection, exposure: str) -> ProductReadValue:
        return ProductReadValue(
            field=item.field,
            value=item.value,
            exposure=exposure,
            epistemic_state=item.epistemic_state,
            temporal_state=item.temporal_state,
            verification_required=item.advisory,
            assertion_id=item.assertion_id,
            raw_document_id=item.raw_document_id,
            target_cycle=item.target_cycle,
        )
