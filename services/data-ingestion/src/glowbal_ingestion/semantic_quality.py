"""Public Slice C shadow-quality surface."""

from .conflicts import ConflictRecord, detect_conflicts, resolve_competing_assertions
from .coverage import CoverageEngine
from .field_policy import (
    DEFAULT_FIELD_POLICY_REGISTRY,
    FIELD_POLICY_REGISTRY,
    FieldPolicy,
    FieldPolicyRegistry,
    InferencePolicy,
)
from .inference import InferenceEngine, InferenceRecord, InferenceStatus
from .quality import QualityEvaluation, SliceCQuality
from .quality_models import *
from .recovery import RecoveryBudget, RecoveryDecision, RecoveryPlanner, RawEvidenceReuse

__all__ = [
    "CoverageEngine",
    "ConflictRecord",
    "detect_conflicts",
    "resolve_competing_assertions",
    "FieldPolicy",
    "FieldPolicyRegistry",
    "InferencePolicy",
    "DEFAULT_FIELD_POLICY_REGISTRY",
    "FIELD_POLICY_REGISTRY",
    "InferenceEngine",
    "InferenceRecord",
    "InferenceStatus",
    "RecoveryBudget",
    "RecoveryDecision",
    "RecoveryPlanner",
    "RawEvidenceReuse",
    "SliceCQuality",
    "QualityEvaluation",
]
