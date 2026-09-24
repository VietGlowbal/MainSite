"""Compatibility exports for the Slice C conflict boundary."""

from .conflicts import ConflictRecord, detect_conflicts, resolve_competing_assertions

__all__ = ["ConflictRecord", "detect_conflicts", "resolve_competing_assertions"]
