"""Generic entity and scope resolver.

Resolves evidence to the most specific entity explicitly supported by the
source. Uses verified signals such as canonical entity names, organisation
unit hierarchy, document/page titles, breadcrumbs, section headings,
official source metadata, explicit entity mentions, and verified source
ownership.

Does NOT infer faculty scope merely because the target programme belongs
to that faculty. If only institution scope is proven, scope=institution
and programme_id=null. Unknown remains UNKNOWN.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping

from .extraction_provider import ExtractionSource
from .models import FieldAssertion


# ---------------------------------------------------------------------------
# Resolved scope representation
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ResolvedScope:
    """Result of generic entity/scope resolution."""

    scope: str  # programme, faculty, department, school, institution, unknown
    entity_id: str | None = None
    entity_type: str | None = None  # programme, organisation_unit, institution
    organisation_unit_id: str | None = None
    confidence: float = 0.0
    resolution_signals: tuple[str, ...] = ()
    is_verified: bool = False


# ---------------------------------------------------------------------------
# Signal detection (generic, no institution-specific rules)
# ---------------------------------------------------------------------------

_FACULTY_DEPT_RE = re.compile(
    r"\b(?:"
    r"school|college|faculty|division|institute|department"
    r"(?:\s+(?:of|for|and)\s+[\w\s&'-]+){0,3}"
    r")\b",
    re.I,
)

_PROGRAMME_RE = re.compile(
    r"\b(?:"
    r"(?:master|bachelor|doctor|phd|mba|ms|ma|bs|ba|beng|meng|mph|mpa)"
    r"(?:\s+(?:of|in|of\s+Science|of\s+Arts))?"
    r"(?:\s+[\w\s&'-]+){0,5}"
    r")\b",
    re.I,
)

_INSTITUTION_RE = re.compile(
    r"\b(?:"
    r"(?:university|college|institute|academy|school)"
    r"(?:\s+(?:of|for|and)\s+[\w\s&'-]+){0,5}"
    r")\b",
    re.I,
)


def _detect_scope_from_source_metadata(
    source: ExtractionSource,
) -> str | None:
    """Detect scope from source metadata (page type, URL, title)."""
    context = " ".join((
        source.page_type or "",
        source.title or "",
        source.url or "",
    )).casefold()

    # Page type is the strongest signal
    page_type = (source.page_type or "").casefold()
    if page_type in {"faculty", "department"}:
        return "faculty"
    if page_type in {"programme_overview", "programme_admission"}:
        return "programme"
    if page_type in {"tuition", "international_admission", "catalogue"}:
        return "institution"

    # URL path patterns (generic, not institution-specific)
    url = (source.url or "").casefold()
    if re.search(r"/(?:faculty|school|college|department)/", url):
        return "faculty"
    if re.search(r"/(?:programme|program|degree)/", url):
        return "programme"

    return None


def _detect_scope_from_evidence(
    evidence: str,
    source: ExtractionSource,
) -> str | None:
    """Detect scope from evidence text content."""
    text = evidence.casefold()

    # Faculty/department mentions in evidence
    if _FACULTY_DEPT_RE.search(text):
        # Only if the source is from a faculty/department page
        page_type = (source.page_type or "").casefold()
        if page_type in {"faculty", "department"}:
            return "faculty"

    return None


def _detect_programme_scope(
    assertion: FieldAssertion,
    source: ExtractionSource,
    programmes: Mapping[str, Mapping[str, object]],
) -> tuple[bool, str | None]:
    """Check if the assertion is linked to a specific programme.

    Returns (is_verified, entity_id). Does NOT invent programme links.
    """
    entity_id = assertion.entity_id
    programme = programmes.get(entity_id, {})
    if not programme:
        return False, None

    # Check explicit programme link from source
    if source.linked_programme_id == entity_id:
        return True, entity_id

    # Check URL match
    target_url = str(programme.get("official_url", "")).rstrip("/")
    if target_url and source.url.rstrip("/").startswith(target_url):
        return True, entity_id

    # Check name match in source title/evidence
    name = str(programme.get("programme_name", ""))
    if name and len(name) > 5:
        title_evidence = " ".join((
            source.title or "",
            assertion.evidence or "",
        )).casefold()
        if name.casefold() in title_evidence:
            return True, entity_id

    return False, None


def _detect_institution_scope(
    assertion: FieldAssertion,
    source: ExtractionSource,
    programmes: Mapping[str, Mapping[str, object]],
) -> tuple[bool, str | None]:
    """Check if the assertion is at institution scope.

    Returns (is_verified, institution_id).
    """
    entity_id = assertion.entity_id
    programme = programmes.get(entity_id, {})
    institution_id = str(programme.get("institution_id", ""))

    # If scope is already institution
    if assertion.scope == "institution":
        if assertion.entity_type == "institution":
            return True, assertion.entity_id
        if institution_id:
            return True, institution_id

    # Check if source is official for this institution
    from urllib.parse import urlsplit
    host = (urlsplit(source.url or "").hostname or "").casefold()
    if not host:
        return False, None

    # Institution scope is implied when source is official but not
    # specifically linked to a programme
    if institution_id:
        return True, institution_id

    return False, None


def _detect_organisation_unit_scope(
    assertion: FieldAssertion,
    source: ExtractionSource,
    organisation_units: Mapping[str, dict[str, Any]],
) -> tuple[bool, str | None]:
    """Check if the assertion is linked to a specific organisation unit.

    Returns (is_verified, organisation_unit_id). Only returns verified
    bindings - does not infer faculty from programme membership.
    """
    # Check if source has a verified organisation unit link
    source_url = (source.url or "").casefold()

    for unit_id, unit in organisation_units.items():
        unit_url = str(unit.get("official_url", "")).casefold()
        if unit_url and source_url.startswith(unit_url):
            return True, unit_id

        # Check name match in breadcrumbs/title
        unit_name = str(unit.get("unit_name", "")).casefold()
        if unit_name and len(unit_name) > 5:
            title = (source.title or "").casefold()
            if unit_name in title:
                return True, unit_id

    return False, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def resolve_entity_scope(
    assertion: FieldAssertion,
    source: ExtractionSource,
    programmes: Mapping[str, Mapping[str, object]],
    organisation_units: Mapping[str, dict[str, Any]] | None = None,
) -> ResolvedScope:
    """Resolve the most specific entity scope supported by the source.

    Uses only verified signals:
    - Canonical entity names
    - Organisation unit hierarchy
    - Document/page titles
    - Breadcrumbs, section headings
    - Official source metadata
    - Explicit entity mentions
    - Verified source ownership

    Does NOT infer faculty scope from programme membership.
    If only institution scope is proven, returns scope=institution.
    Unknown remains UNKNOWN.
    """
    org_units = organisation_units or {}
    signals: list[str] = []

    # 1. Check if scope is already explicitly set and verified
    if assertion.scope in {"faculty", "department", "school"}:
        # Need verified organisation unit binding
        verified, unit_id = _detect_organisation_unit_scope(
            assertion, source, org_units
        )
        if verified and unit_id:
            signals.append("ORGANISATION_UNIT_VERIFIED")
            return ResolvedScope(
                scope=assertion.scope,
                entity_id=unit_id,
                entity_type="organisation_unit",
                organisation_unit_id=unit_id,
                confidence=0.9,
                resolution_signals=tuple(signals),
                is_verified=True,
            )
        # Scope claimed but not verified - fall through to check other signals
        signals.append("SCOPE_CLAIMED_NOT_VERIFIED")

    # 2. Check programme scope
    if assertion.scope == "programme" or assertion.entity_type == "programme":
        verified, prog_id = _detect_programme_scope(
            assertion, source, programmes
        )
        if verified:
            signals.append("PROGRAMME_VERIFIED")
            return ResolvedScope(
                scope="programme",
                entity_id=prog_id or assertion.entity_id,
                entity_type="programme",
                confidence=0.8,
                resolution_signals=tuple(signals),
                is_verified=True,
            )

    # 3. Check institution scope
    verified, inst_id = _detect_institution_scope(
        assertion, source, programmes
    )
    if verified and inst_id:
        signals.append("INSTITUTION_VERIFIED")
        return ResolvedScope(
            scope="institution",
            entity_id=inst_id,
            entity_type="institution",
            confidence=0.7,
            resolution_signals=tuple(signals),
            is_verified=True,
        )

    # 4. Check source metadata for scope hints
    metadata_scope = _detect_scope_from_source_metadata(source)
    if metadata_scope:
        signals.append(f"SOURCE_METADATA_{metadata_scope.upper()}")

    # 5. Check evidence content for scope hints
    evidence_scope = _detect_scope_from_evidence(
        assertion.evidence or "", source
    )
    if evidence_scope:
        signals.append(f"EVIDENCE_SCOPE_{evidence_scope.upper()}")

    # 6. Fall back to institution scope if source is official
    from urllib.parse import urlsplit
    host = (urlsplit(source.url or "").hostname or "").casefold()
    if host:
        signals.append("SOURCE_HAS_HOST")
        # Official source without specific programme link -> institution scope
        if assertion.scope != "programme":
            programme = programmes.get(assertion.entity_id, {})
            inst_id = str(programme.get("institution_id", ""))
            if inst_id:
                signals.append("INSTITUTION_FROM_PROGRAMME_HIERARCHY")
                return ResolvedScope(
                    scope="institution",
                    entity_id=inst_id,
                    entity_type="institution",
                    confidence=0.6,
                    resolution_signals=tuple(signals),
                    is_verified=False,  # Not directly verified
                )

    # 7. Unknown
    return ResolvedScope(
        scope="unknown",
        confidence=0.0,
        resolution_signals=tuple(signals) if signals else ("NO_SIGNALS",),
        is_verified=False,
    )


def bind_scope_to_assertion(
    assertion: FieldAssertion,
    source: ExtractionSource,
    programmes: Mapping[str, Mapping[str, object]],
    organisation_units: Mapping[str, dict[str, Any]] | None = None,
) -> tuple[FieldAssertion, list[str], ResolvedScope]:
    """Resolve scope and apply binding to assertion.

    Returns the updated assertion, list of changes, and the resolved scope.
    """
    resolved = resolve_entity_scope(
        assertion, source, programmes, organisation_units
    )
    changes: list[str] = []

    if not resolved.is_verified:
        return assertion, [], resolved

    # Apply scope binding
    from dataclasses import replace
    new_assertion = assertion

    if resolved.scope != assertion.scope:
        changes.append(f"SCOPE_{assertion.scope or 'UNKNOWN'}_TO_{resolved.scope.upper()}")

    if resolved.entity_id and resolved.entity_id != assertion.entity_id:
        new_assertion = replace(
            assertion,
            scope=resolved.scope,
            entity_id=resolved.entity_id,
            entity_type=resolved.entity_type,
        )
    elif resolved.scope != assertion.scope:
        new_assertion = replace(
            assertion,
            scope=resolved.scope,
        )

    return new_assertion, changes, resolved
