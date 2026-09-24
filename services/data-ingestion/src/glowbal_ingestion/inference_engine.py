"""Compatibility exports for the Slice C inference boundary."""

from .hierarchical_inference import (
    DonorCandidate,
    EntityContext,
    HierarchyLevel,
    HierarchicalInferenceDecision,
    HierarchicalInferenceEngine,
    UncertaintyComponents,
)
from .inference import InferenceEngine, InferenceRecord, InferenceStatus

__all__ = [
    "DonorCandidate",
    "EntityContext",
    "HierarchyLevel",
    "HierarchicalInferenceDecision",
    "HierarchicalInferenceEngine",
    "InferenceEngine",
    "InferenceRecord",
    "InferenceStatus",
    "UncertaintyComponents",
]
