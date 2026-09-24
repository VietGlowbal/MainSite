"""Compatibility exports for the Slice C coverage boundary."""

from .coverage import CoverageEngine
from .quality_models import CoverageAssessment, CoverageState, AvailabilityState

__all__ = ["CoverageEngine", "CoverageAssessment", "CoverageState", "AvailabilityState"]
