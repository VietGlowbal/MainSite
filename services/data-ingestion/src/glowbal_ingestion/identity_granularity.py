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


@dataclass(frozen=True)
class IdentityDimensions:
    """Deterministic, source-backed identity dimensions for projection.

    The extractor may return a source-native scalar even when the source title
    contains a credential or a parent/child label.  This record keeps the
    source-native value intact while exposing only dimensions that can be
    derived from deterministic title/URL structure.  It never consults the
    roster or benchmark truth.
    """

    canonical_programme_identity: str | None
    source_native_identity: str | None
    entity_type: str | None = None
    credential: str | None = None
    parent_programme: str | None = None
    track: str | None = None
    concentration: str | None = None
    specialization: str | None = None
    stage: str | None = None
    aliases: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "canonical_programme_identity": self.canonical_programme_identity,
            "source_native_identity": self.source_native_identity,
        }
        for key in (
            "entity_type",
            "credential",
            "parent_programme",
            "track",
            "concentration",
            "specialization",
            "stage",
        ):
            value = getattr(self, key)
            if value not in (None, ""):
                result[key] = value
        if self.aliases:
            result["official_aliases"] = list(self.aliases)
        return result


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Mapping):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    normalized = unicodedata.normalize("NFKD", str(value))
    return "".join(char for char in normalized if not unicodedata.combining(char)).casefold()


def _mapping_value(value: Any, key: str) -> str:
    return _text(value.get(key)) if isinstance(value, Mapping) else ""


def _display(value: Any) -> str:
    if isinstance(value, Mapping):
        for key in ("source_native_identity", "canonical_programme_identity", "canonical_name", "name"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                return item.strip()
        return ""
    return str(value or "").strip()


def _title_from_slug(value: str) -> str:
    value = re.sub(r"[-_]+", " ", value).strip()
    value = re.sub(r"\b(?:programme|program|degree)\b", "", value, flags=re.IGNORECASE)
    return " ".join(part.capitalize() for part in value.split())


def _parent_from_url(source_url: str) -> str | None:
    path = [part for part in urlparse(source_url).path.split("/") if part]
    if not path:
        return None
    for index, segment in enumerate(path):
        if re.match(r"^(?:parcours|track|concentration|speciali[sz]ation)(?:[-_]|$)", segment, re.IGNORECASE):
            if index:
                parent = _title_from_slug(path[index - 1])
                return parent or None
    return None


def _strip_parenthetical_alias(value: str) -> tuple[str, str | None]:
    match = re.match(r"^(?P<base>.+?)\s*\((?P<alias>[A-Za-z][A-Za-z0-9+/& -]{1,24})\)\s*$", value)
    if not match:
        return value.strip(), None
    alias = match.group("alias").strip()
    # Only an explicit acronym-like token is an alias.  Phrases such as
    # ``(Course 6-4)`` are part of the source-native identity, not aliases.
    if not re.fullmatch(r"[A-Z][A-Z0-9+/&-]{1,15}", alias):
        return value.strip(), None
    return match.group("base").strip(), alias


def _canonical_title(value: str) -> tuple[str, str | None]:
    """Return a conservative canonical title and source-native credential."""

    text = " ".join(value.split()).strip(" -|:")
    if not text:
        return "", None

    # Keep the academic subject while separating explicit award phrases.
    prefix_patterns = (
        r"^(?P<credential>master\s+of\s+(?:science|engineering|arts?|professional\s+studies?))\s+in\s+(?P<title>.+)$",
        r"^(?P<credential>bachelor(?:\s+of\s+(?:science|arts?|engineering))?)\s+in\s+(?P<title>.+)$",
        r"^(?P<credential>baccalaur(?:e|é)at)\s+en\s+(?P<title>.+)$",
        r"^(?P<credential>ma(?:î|i)trise)\s+en\s+(?P<title>.+)$",
        r"^(?P<credential>dess)\s+en\s+(?P<title>.+)$",
        r"^(?P<credential>licence)\s+d['’]?(?:en\s+)?(?P<title>.+)$",
        r"^(?P<credential>international\s+master(?:['’]s)?/doctoral\s+degree\s+program)\s*:\s*(?P<title>.+)$",
        r"^(?P<credential>master(?:['’]s)?/doctoral\s+degree\s+program)\s*:\s*(?P<title>.+)$",
    )
    for pattern in prefix_patterns:
        match = re.match(pattern, text, re.IGNORECASE)
        if match:
            credential = " ".join(match.group("credential").split())
            return match.group("title").strip(" -|:"), credential

    suffix = re.match(
        r"^(?P<title>.+?)\s*\((?P<credential>"
        r"(?:B\.?S\.?E?|B\.?S\.?|B\.?A\.?|B\.?Mus\.?|M\.?S\.?|M\.?A\.?|"
        r"M\.?Sc\.?|M\.?Eng\.?|M\.?P\.?H\.?|M\.?B\.?A\.?|M\.?P\.?S\.?|Ph\.?D\.?)"
        r")\)?$",
        text,
        re.IGNORECASE,
    )
    if suffix:
        return suffix.group("title").strip(" ,-|:"), suffix.group("credential").strip()

    specialization = re.match(
        r"^(?P<title>.+?),\s*(?P<credential>M\.?S\.?)\s+(?P<specialization>.+?)\s+"
        r"speciali[sz]ation$",
        text,
        re.IGNORECASE,
    )
    if specialization:
        return specialization.group("title").strip(), specialization.group("credential").strip()

    return text, None


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
        # states a degree/programme offering *and* the extractor has preserved
        # the target entity type.  A scalar degree title from a broad faculty
        # policy page is not enough to associate that title with the routed
        # programme; retaining it as a candidate is useful, but projecting it
        # as FOUND would collapse adjacent hierarchy levels.
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
        elif not structured_entity:
            reasons.append("IDENTITY_TARGET_APPLICABILITY_UNPROVEN")

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


def identity_dimensions(
    *,
    value: Any,
    evidence: str | None = None,
    source_text: str | None = None,
    source_url: str | None = None,
) -> IdentityDimensions:
    """Extract deterministic identity dimensions without using expected truth.

    This helper is intentionally conservative.  It handles explicit source
    title structure (credential prefixes/suffixes and named tracks) and URL
    hierarchy, but never invents aliases or uses fuzzy title similarity.
    """

    source_native = _display(value)
    if not source_native:
        return IdentityDimensions(None, None)
    if isinstance(value, Mapping):
        canonical = value.get("canonical_programme_identity") or value.get("canonical_name")
        entity_type = value.get("entity_type")
        credential = value.get("credential")
        parent = value.get("parent_programme")
        track = value.get("track")
        return IdentityDimensions(
            canonical_programme_identity=str(canonical).strip() if canonical else source_native,
            source_native_identity=source_native,
            entity_type=str(entity_type).strip() if entity_type else None,
            credential=str(credential).strip() if credential else None,
            parent_programme=str(parent).strip() if parent else None,
            track=str(track).strip() if track else None,
            concentration=str(value.get("concentration")).strip() if value.get("concentration") else None,
            specialization=str(value.get("specialization")).strip() if value.get("specialization") else None,
            stage=str(value.get("stage")).strip() if value.get("stage") else None,
            aliases=tuple(str(item).strip() for item in (value.get("official_aliases") or ()) if str(item).strip()),
        )

    base, alias = _strip_parenthetical_alias(source_native)
    track: str | None = None
    parent = _parent_from_url(source_url or "")
    track_match = re.search(
        r"\b(?:parcours|track)\s+(.+?)(?:\s*\(([^)]+)\))?$",
        source_native,
        re.IGNORECASE,
    )
    if track_match:
        track = (track_match.group(2) or track_match.group(1)).strip(" .,-")
        if parent is None:
            # An explicitly named child without a proven parent is not safe to
            # compare as a canonical programme identity.
            return IdentityDimensions(None, None)
        return IdentityDimensions(
            canonical_programme_identity=parent,
            source_native_identity=source_native,
            entity_type="TRACK",
            parent_programme=parent,
            track=track,
            aliases=(alias,) if alias else (),
        )

    if alias and re.match(r"^master\s+of\s+.+", base, re.IGNORECASE):
        canonical = re.sub(r"^master\s+of\s+", "", base, count=1, flags=re.IGNORECASE).strip()
        credential = base
    else:
        canonical, credential = _canonical_title(base)
    if not canonical:
        canonical = base
    entity_type = "DEGREE_PROGRAMME" if credential else "PROGRAMME"
    return IdentityDimensions(
        canonical_programme_identity=canonical,
        source_native_identity=source_native,
        entity_type=entity_type,
        credential=credential,
        aliases=(alias,) if alias else (),
    )
