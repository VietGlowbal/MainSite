"""Deterministic programme-identity granularity checks.

The extractor supplies a source-backed title.  This module only checks whether
the supplied source also establishes the entity level represented by that
title.  It never uses roster labels, fuzzy similarity, or benchmark truth.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True)
class IdentityGranularityResult:
    """Deterministic identity interpretation and any hard blockers."""

    entity_type: str | None
    stage: str | None
    parent_programme: str | None
    track: str | None
    reasons: tuple[str, ...]


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Mapping):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    normalized = unicodedata.normalize("NFKD", str(value))
    return "".join(char for char in normalized if not unicodedata.combining(char)).casefold()


def _mapping_value(value: Any, key: str) -> str:
    return _text(value.get(key)) if isinstance(value, Mapping) else ""


def _same_parent_child_links(source: str, source_url: str) -> int:
    """Count explicit child-path links belonging to this source's entity.

    Navigation menus often contain unrelated links labelled ``track`` or
    ``concentration``.  They are not evidence that the current identity is a
    parent/child ambiguity.  A repeated child path rooted at the current
    programme slug is a materially stronger, source-local signal.
    """

    if not source or not source_url:
        return 0
    source_path = urlparse(source_url).path.rstrip("/").casefold()
    if not source_path:
        return 0
    parent_slug = source_path.rsplit("/", 1)[-1]
    if not parent_slug:
        return 0
    links = re.findall(
        r"href\s*=\s*[\"']([^\"']+)[\"']",
        source,
        re.IGNORECASE,
    )
    child_pattern = re.compile(
        rf"/{re.escape(parent_slug)}/(?:parcours|track|concentration|"
        r"speciali[sz]ation)(?:[-_/]|$)",
        re.IGNORECASE,
    )
    return len({link.casefold().split("#", 1)[0] for link in links if child_pattern.search(link)})


def resolve_identity_granularity(
    *,
    value: Any,
    evidence: str | None,
    source_text: str | None = None,
    scope: str | None = None,
    source_url: str | None = None,
) -> IdentityGranularityResult:
    """Return source-backed identity dimensions and hard semantic blockers.

    The checks intentionally fail closed only when the source exposes a
    material hierarchy or unit/programme distinction.  Ordinary programme
    titles remain eligible; an explicit department, pre-major, or parent/child
    signal without corresponding structured metadata is unresolved rather than
    guessed.
    """

    candidate = _text(value)
    evidence_text = _text(evidence)
    source = _text(source_text)
    combined = " ".join(part for part in (evidence_text, source) if part)
    scope_text = _text(scope)
    url_text = _text(source_url)
    reasons: list[str] = []

    entity_type = _mapping_value(value, "entity_type") or None
    stage = _mapping_value(value, "stage") or None
    parent = _mapping_value(value, "parent_programme") or None
    track = _mapping_value(value, "track") or None

    if scope_text in {"department", "faculty", "school"}:
        # A department/faculty page may govern a programme, but the unit name
        # is not the programme identity unless the same evidence explicitly
        # states a degree/programme offering.
        explicit_offering = bool(
            re.search(
                r"\b(?:degree|master(?:'s)?|bachelor(?:'s)?|doctoral|ph\.?d\.?|"
                r"programme|program|course)\b",
                evidence_text,
                re.IGNORECASE,
            )
        )
        structured_entity = _text(entity_type) in {
            "programme",
            "degree_programme",
            "major",
        }
        if not explicit_offering and not structured_entity:
            reasons.append("IDENTITY_UNIT_SCOPE_UNPROVEN")

    has_pre_marker = bool(
        re.search(
            r"\b(?:pre[- ]?major|pre[- ]?programme|pre[- ]?engineering|"
            r"declaration\s+stage|entry\s+stage)\b",
            combined,
            re.IGNORECASE,
        )
    )
    has_later_stage_relation = bool(
        re.search(
            r"\blater\s+(?:major|programme)\b.*\b(?:admitted|declare|enter)",
            combined,
            re.IGNORECASE,
        )
    )
    pre_major = has_pre_marker or has_later_stage_relation
    if pre_major:
        if not stage and not re.search(r"\b(?:pre[- ]?major|pathway)\b", candidate):
            reasons.append("IDENTITY_STAGE_UNRESOLVED")
        elif not stage:
            stage = "PRE_MAJOR"

    # A broad graduate-admissions page can name mutually exclusive degree
    # levels (for example, an MS or PhD programme) without identifying which
    # degree entity the routed record represents.  This differs from a
    # credential family such as BA/BMus, where the source explicitly presents
    # parallel credentials for one named joint programme.
    degree_variant_ambiguity = bool(
        re.search(
            r"\b(?:ph\.?d\.?|doctor(?:ate|al)|doctoral)\b"
            r"[^.]{0,40}\bor\b[^.]{0,40}"
            r"\b(?:m\.?s\.?|master(?:'s)?|m\.?sc\.?)\b"
            r"|\b(?:m\.?s\.?|master(?:'s)?|m\.?sc\.?)\b"
            r"[^.]{0,40}\bor\b[^.]{0,40}"
            r"\b(?:ph\.?d\.?|doctor(?:ate|al)|doctoral)\b",
            combined,
            re.IGNORECASE,
        )
        and bool(re.search(r"\b(?:programme|program|degree)\b", combined, re.IGNORECASE))
    )
    if degree_variant_ambiguity:
        reasons.append("IDENTITY_DEGREE_VARIANT_SCOPE_UNRESOLVED")

    # A parent overview containing several explicitly labelled pathways is not
    # enough to identify one child track.  Conversely, a child URL/title/value
    # that names the track is allowed and retains the hierarchy metadata.
    same_parent_child_links = _same_parent_child_links(source, source_url)
    child_source = bool(re.search(r"/(?:parcours|track|concentration|speciali[sz]ation)[^/]*", url_text))
    child_value = bool(
        re.search(r"\b(?:parcours|track|concentration|speciali[sz]ation)\b", candidate, re.IGNORECASE)
    )
    if (
        not pre_major
        and same_parent_child_links >= 2
        and not child_source
        and not child_value
        and not track
    ):
        reasons.append("IDENTITY_CHILD_SCOPE_UNRESOLVED")

    if isinstance(value, Mapping) and entity_type:
        if _text(entity_type) in {"track", "concentration", "specialization"} and not parent:
            reasons.append("IDENTITY_PARENT_RELATIONSHIP_MISSING")

    return IdentityGranularityResult(
        entity_type=entity_type,
        stage=stage,
        parent_programme=parent,
        track=track,
        reasons=tuple(dict.fromkeys(reasons)),
    )


def identity_granularity_reasons(
    *,
    value: Any,
    evidence: str | None,
    source_text: str | None = None,
    scope: str | None = None,
    source_url: str | None = None,
) -> tuple[str, ...]:
    """Convenience wrapper used by assertion construction and projection."""

    return resolve_identity_granularity(
        value=value,
        evidence=evidence,
        source_text=source_text,
        scope=scope,
        source_url=source_url,
    ).reasons
