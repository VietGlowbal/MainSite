"""Generic provenance resolver.

Ensures every usable assertion can trace:
  assertion -> exact evidence span / table cell -> retained source ->
  raw document -> content hash -> acquisition/run identity

If provenance exists upstream but was lost during transformation, repairs
propagation generically.  Does not manufacture provenance.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, replace
from typing import Any, Mapping

from .extraction_provider import ExtractionSource
from .models import FieldAssertion, VerificationStatus


# ---------------------------------------------------------------------------
# Provenance validation result
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ProvenanceState:
    """Validated provenance chain for an assertion."""

    is_complete: bool
    has_raw_document_id: bool = False
    has_content_hash: bool = False
    has_acquisition_run_id: bool = False
    has_source_url: bool = False
    has_source_authority: bool = False
    has_source_relationship: bool = False
    has_evidence: bool = False
    hash_matches_source: bool = False
    source_matches_binding: bool = False
    missing_fields: tuple[str, ...] = ()
    repairable_fields: tuple[str, ...] = ()
    issues: tuple[str, ...] = ()


# ---------------------------------------------------------------------------
# Required provenance chain
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS = (
    "raw_document_id",
    "source_content_hash",
    "acquisition_run_id",
    "source_url",
)

_OPTIONAL_BUT_RECOMMENDED = (
    "source_authority",
    "source_relationship",
)


def _text_match(text: str, needle: str) -> bool:
    """Case-insensitive substring check."""
    if not needle or not text:
        return False
    return needle.casefold() in text.casefold()


# ---------------------------------------------------------------------------
# Provenance validation
# ---------------------------------------------------------------------------

def validate_provenance(
    assertion: FieldAssertion,
    source: ExtractionSource | None = None,
) -> ProvenanceState:
    """Validate the provenance chain for an assertion.

    Checks required fields and, when a source binding is available,
    verifies that the assertion's provenance matches the source.
    """
    missing: list[str] = []
    repairable: list[str] = []
    issues: list[str] = []

    # Required fields
    has_raw = bool(assertion.raw_document_id)
    has_hash = bool(assertion.source_content_hash)
    has_run = bool(assertion.acquisition_run_id)
    has_url = bool(assertion.source_url)
    has_auth = bool(assertion.source_authority)
    has_rel = bool(assertion.source_relationship)
    has_evidence = bool(assertion.evidence)

    if not has_raw:
        missing.append("raw_document_id")
    if not has_hash:
        missing.append("source_content_hash")
    if not has_run:
        missing.append("acquisition_run_id")
    if not has_url:
        missing.append("source_url")
    if not has_auth:
        missing.append("source_authority")
    if not has_rel:
        missing.append("source_relationship")

    # Source binding validation
    hash_matches = False
    source_matches = False
    if source:
        # Hash match
        if has_hash and source.content_hash:
            hash_matches = source.content_hash == assertion.source_content_hash
            if not hash_matches:
                issues.append("CONTENT_HASH_MISMATCH")

        # URL match
        if has_url and source.url:
            url_match = assertion.source_url.rstrip("/") == source.url.rstrip("/")
            if not url_match:
                issues.append("SOURCE_URL_MISMATCH")

        # Full binding match
        if (has_raw and source.raw_document_id and
            has_hash and source.content_hash and
            has_run and source.acquisition_run_id and
            has_url and source.url):
            source_matches = (
                source.raw_document_id == assertion.raw_document_id
                and source.content_hash == assertion.source_content_hash
                and source.url == assertion.source_url
                and source.acquisition_run_id == assertion.acquisition_run_id
            )
            if not source_matches:
                issues.append("SOURCE_BINDING_MISMATCH")

        # Repair: if source has authority/relationship but assertion doesn't
        if source.source_authority and not has_auth:
            repairable.append("source_authority")
        if source.source_relationship and not has_rel:
            repairable.append("source_relationship")

    # Evidence validation
    if has_evidence and source:
        # Check evidence exists in source text
        if source.text and not _text_match(source.text, assertion.evidence or ""):
            # Try fuzzy match for truncated evidence
            evidence = assertion.evidence or ""
            # Check if at least the first 50 chars match
            if len(evidence) > 50:
                prefix = evidence[:50]
                if not _text_match(source.text, prefix):
                    issues.append("EVIDENCE_NOT_IN_SOURCE_TEXT")

    is_complete = (
        has_raw and has_hash and has_run and has_url
        and has_auth and has_rel and has_evidence
        and not issues
    )

    return ProvenanceState(
        is_complete=is_complete,
        has_raw_document_id=has_raw,
        has_content_hash=has_hash,
        has_acquisition_run_id=has_run,
        has_source_url=has_url,
        has_source_authority=has_auth,
        has_source_relationship=has_rel,
        has_evidence=has_evidence,
        hash_matches_source=hash_matches,
        source_matches_binding=source_matches,
        missing_fields=tuple(missing),
        repairable_fields=tuple(repairable),
        issues=tuple(issues),
    )


# ---------------------------------------------------------------------------
# Provenance repair
# ---------------------------------------------------------------------------

def repair_provenance(
    assertion: FieldAssertion,
    source: ExtractionSource,
) -> tuple[FieldAssertion, list[str]]:
    """Repair missing provenance from source binding.

    Only repairs fields that are present in the source but missing from
    the assertion.  Does not manufacture new provenance or override
    existing values.
    """
    changes: list[str] = []
    state = validate_provenance(assertion, source)

    if state.is_complete:
        return assertion, []

    updates: dict[str, Any] = {}

    # Repair missing fields from source
    for field in state.repairable_fields:
        if field == "source_authority" and source.source_authority:
            updates["source_authority"] = source.source_authority
            changes.append("REPAIRED_SOURCE_AUTHORITY")
        elif field == "source_relationship" and source.source_relationship:
            updates["source_relationship"] = source.source_relationship
            changes.append("REPAIRED_SOURCE_RELATIONSHIP")

    # Ensure evidence exists
    if not state.has_evidence and source.text:
        # Don't fabricate evidence - only flag
        changes.append("EVIDENCE_MISSING_FROM_ASSERTION")

    if updates:
        return replace(assertion, **updates), changes

    return assertion, changes


def repair_provenance_chain(
    assertion: FieldAssertion,
    source: ExtractionSource | None = None,
) -> tuple[FieldAssertion, list[str]]:
    """Validate and repair the full provenance chain.

    Returns the assertion with repaired provenance (if possible) and
    a list of changes made.
    """
    if not source:
        state = validate_provenance(assertion, None)
        if state.missing_fields:
            return assertion, [f"MISSING_PROVENANCE_{f.upper()}" for f in state.missing_fields]
        return assertion, []

    # First validate
    state = validate_provenance(assertion, source)

    if state.is_complete:
        return assertion, []

    # Attempt repair
    repaired, repair_changes = repair_provenance(assertion, source)

    # Re-validate after repair
    final_state = validate_provenance(repaired, source)

    return repaired, repair_changes


# ---------------------------------------------------------------------------
# Provenance summary for reporting
# ---------------------------------------------------------------------------

def provenance_summary(
    assertions: Sequence[FieldAssertion],
    bindings: Mapping[str, ExtractionSource],
) -> dict[str, Any]:
    """Summarize provenance state across a set of assertions."""
    total = len(assertions)
    complete = 0
    missing_raw = 0
    missing_hash = 0
    missing_run = 0
    missing_url = 0
    missing_auth = 0
    hash_mismatch = 0
    evidence_missing = 0
    repairable = 0

    for a in assertions:
        source = bindings.get(str(a.raw_document_id or ""))
        state = validate_provenance(a, source)
        if state.is_complete:
            complete += 1
        if not state.has_raw_document_id:
            missing_raw += 1
        if not state.has_content_hash:
            missing_hash += 1
        if not state.has_acquisition_run_id:
            missing_run += 1
        if not state.has_source_url:
            missing_url += 1
        if not state.has_source_authority:
            missing_auth += 1
        if "CONTENT_HASH_MISMATCH" in state.issues:
            hash_mismatch += 1
        if not state.has_evidence:
            evidence_missing += 1
        if state.repairable_fields:
            repairable += 1

    return {
        "total": total,
        "complete": complete,
        "incomplete": total - complete,
        "missing_raw_document_id": missing_raw,
        "missing_content_hash": missing_hash,
        "missing_acquisition_run_id": missing_run,
        "missing_source_url": missing_url,
        "missing_source_authority": missing_auth,
        "hash_mismatches": hash_mismatch,
        "evidence_missing": evidence_missing,
        "repairable": repairable,
    }


# Needed for type checking
from typing import Sequence
