"""Deterministic resolution of retained evidence context.

This module repairs information that is already present in an admitted source.
It never creates a fact, widens a source scope, or substitutes provenance from
another document.  The semantic acceptance layer uses the results as a
precondition for accepting an observation.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import parse_qsl, urlencode, urlsplit


UNKNOWN = {"", "unknown", "none", "null", "unspecified"}
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)
_NUMBER_RE = re.compile(
    r"(?<![\w.])-?\d+(?:,\d{3})*(?:\.\d+)?(?!\w|\.\d)"
)
_MONEY_TOKEN_RE = re.compile(
    r"(?:[$£€]|\b(?:USD|AUD|CAD|SGD|EUR|GBP|CHF|JPY)\s*)"
    r"\s*\d+(?:,\d{3})*(?:\.\d+)?\b",
    re.I,
)
_CURRENCY_RE = re.compile(r"\b(USD|AUD|CAD|SGD|EUR|GBP|CHF|JPY)\b", re.I)
_CYCLE_RE = re.compile(
    r"\b(20\d{2})\s*(?:[-/\u2010-\u2015\ufffd])\s*(20)?(\d{2})\b"
)
_ACADEMIC_CYCLE_CONTEXT_RE = re.compile(
    r"\b(?:academic|school|study)\s*[- ]?\s*(?:year|cycle)\b"
    r"|\b(?:tuition|fees?|costs?)\b",
    re.I,
)
_SCOPE_RE = re.compile(
    r"\b(programme|program|course|department|faculty|school|institution|"
    r"college|university)\b",
    re.I,
)
_HEADER_TERMS = re.compile(
    r"\b(?:fee|fees|tuition|cost|costs|amount|term|semester|year|annual|"
    r"total|domestic|international|resident|nonresident|currency|charge)\b",
    re.I,
)
_GENERIC_NAME_WORDS = {
    "the", "of", "and", "in", "for", "with", "program", "programme",
    "course", "degree", "bachelor", "master", "masters", "graduate",
    "undergraduate", "postgraduate", "doctor", "doctoral", "study",
}


def _get(value: object, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _plain(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.replace("\ufffd", " ")
    return text.casefold()


def _tokens(value: object) -> tuple[str, ...]:
    return tuple(_TOKEN_RE.findall(_plain(value)))


def _canonical_url(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    parsed = urlsplit(raw)
    host = (parsed.hostname or "").casefold()
    path = parsed.path.rstrip("/") or "/"
    # Query parameters can identify a distinct dataset/resource (especially
    # for government APIs).  Keep them in the source identity while sorting
    # pairs so harmless parameter-order differences still compare equal.
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    suffix = f"?{query}" if query else ""
    return f"{parsed.scheme.casefold()}://{host}{path}{suffix}"


def _same_url(left: object, right: object) -> bool:
    return bool(_canonical_url(left)) and _canonical_url(left) == _canonical_url(right)


def _normalised_text(value: object) -> str:
    return " ".join(_tokens(value))


def _find_token_span(source_text: str, evidence: str) -> tuple[int, int] | None:
    """Find an evidence span while tolerating Unicode punctuation and breaks."""
    if not source_text or not evidence:
        return None
    source_folded = source_text.casefold()
    evidence_folded = evidence.casefold()
    raw_index = source_folded.find(evidence_folded)
    if raw_index >= 0 and source_folded.count(evidence_folded) == 1:
        return raw_index, raw_index + len(evidence)

    # Keep offsets in the original source text.  Searching a normalised copy
    # and then looking for the first/last token in the original document can
    # select a different occurrence when a page repeats a value (for example
    # the same fee in several table rows).
    source_matches = [
        (_plain(match.group(0)), match.start(), match.end())
        for match in _TOKEN_RE.finditer(source_text)
    ]
    evidence_tokens = _tokens(evidence)
    if not evidence_tokens:
        return None
    source_tokens = tuple(match[0] for match in source_matches)
    width = len(evidence_tokens)
    candidates: list[tuple[int, int]] = []
    for start in range(0, len(source_tokens) - width + 1):
        if source_tokens[start : start + width] != evidence_tokens:
            continue
        candidates.append((source_matches[start][1], source_matches[start + width - 1][2]))
    # Ambiguous token matches are not safe evidence alignment.  The caller can
    # retain the raw proposal for review instead of silently choosing a row.
    return candidates[0] if len(candidates) == 1 else None


def _line_bounds(text: str, offset: int) -> tuple[int, int, str]:
    start = text.rfind("\n", 0, max(0, offset) + 1) + 1
    end = text.find("\n", max(0, offset))
    if end < 0:
        end = len(text)
    return start, end, text[start:end].strip()


def _line_records(text: str) -> list[tuple[int, int, str]]:
    records: list[tuple[int, int, str]] = []
    cursor = 0
    for line in text.splitlines(keepends=True):
        end = cursor + len(line)
        records.append((cursor, end, line.rstrip("\r\n")))
        cursor = end
    if not records or cursor < len(text):
        records.append((cursor, len(text), text[cursor:]))
    return records


def _nearby_context(text: str, start: int, end: int, radius: int = 1800) -> str:
    return text[max(0, start - radius) : min(len(text), end + radius)]


def _explicit_currency(text: str) -> str | None:
    values = {match.group(1).upper() for match in _CURRENCY_RE.finditer(text)}
    return next(iter(values)) if len(values) == 1 else None


def _explicit_cycle(text: str) -> str | None:
    """Return one source-explicit, valid academic cycle, if present.

    A year range on its own is only treated as a cycle when it is the complete
    source value.  In prose, it needs nearby academic/tuition context.  This
    keeps release dates, retrieval timestamps, filenames, and arbitrary
    numeric ranges from becoming academic metadata during reconciliation.
    """
    cycles: set[str] = set()
    source_text = text or ""
    for match in _CYCLE_RE.finditer(source_text):
        start = int(match.group(1))
        end = int(
            f"{match.group(2)}{match.group(3)}"
            if match.group(2)
            else f"{match.group(1)[:2]}{match.group(3)}"
        )
        if end != start + 1:
            continue
        local_context = source_text[max(0, match.start() - 80) : min(len(source_text), match.end() + 80)]
        if source_text.strip() != match.group(0) and not _ACADEMIC_CYCLE_CONTEXT_RE.search(local_context):
            continue
        cycles.add(f"{start}-{end}")
    return next(iter(cycles)) if len(cycles) == 1 else None


def _header_and_section(
    text: str,
    start: int,
) -> tuple[str | None, str | None]:
    records = _line_records(text)
    index = next((i for i, (left, right, _) in enumerate(records) if left <= start < right), 0)
    header: str | None = None
    section: str | None = None
    for _, _, line in reversed(records[max(0, index - 16) : index]):
        stripped = line.strip()
        if not stripped:
            continue
        if header is None and len(_HEADER_TERMS.findall(stripped)) >= 2:
            header = stripped
        if section is None and len(stripped) <= 180 and not _NUMBER_RE.search(stripped):
            if not stripped.endswith((".", ":", ";")):
                section = stripped
        if header and section:
            break
    return header, section


def _value_amount(value: object) -> str | None:
    if isinstance(value, Mapping):
        value = value.get("amount")
    if value is None or isinstance(value, bool):
        return None
    return str(value).replace(",", "")


def _same_scalar(left: object, right: object) -> bool:
    """Compare enum/string metadata without false mismatches."""
    if left in (None, "") or right in (None, ""):
        return left in (None, "") and right in (None, "")
    return getattr(left, "value", left) == getattr(right, "value", right)


def _missing(value: object) -> bool:
    return value is None or (isinstance(value, str) and value.casefold() in UNKNOWN)


def _decimal(value: object) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        return None


def _money_amounts(text: str) -> list[Decimal]:
    amounts: list[Decimal] = []
    for match in _MONEY_TOKEN_RE.finditer(text or ""):
        number = _NUMBER_RE.search(match.group(0))
        parsed = _decimal(number.group(0)) if number else None
        if parsed is not None:
            amounts.append(parsed)
    return amounts


@dataclass(frozen=True)
class EvidenceProvenance:
    source_url: str | None
    raw_document_id: str | None
    content_hash: str | None
    acquisition_run_id: str | None
    provider_id: str | None
    dataset_id: str | None
    source_authority: object | None
    source_relationship: object | None

    @property
    def complete(self) -> bool:
        return bool(
            self.source_url
            and self.raw_document_id
            and self.content_hash
            and self.acquisition_run_id
            and self.source_authority
            and self.source_relationship
        )

    def to_dict(self) -> dict[str, object | None]:
        def value(item: object | None) -> object | None:
            return getattr(item, "value", item)

        return {
            "source_url": self.source_url,
            "raw_document_id": self.raw_document_id,
            "content_hash": self.content_hash,
            "acquisition_run_id": self.acquisition_run_id,
            "provider_id": self.provider_id,
            "dataset_id": self.dataset_id,
            "source_authority": value(self.source_authority),
            "source_relationship": value(self.source_relationship),
        }


@dataclass(frozen=True)
class EvidenceAlignment:
    status: str
    reasons: tuple[str, ...]
    field: str | None
    value: object
    unit: str | None
    currency: str | None
    row_label: str | None
    column_label: str | None
    table_header: str | None
    section_title: str | None
    document_title: str | None
    nearby_context: str
    cycle: str | None
    scope_hint: str | None
    entity_mentions: tuple[str, ...]
    source_entity: str | None
    provenance: EvidenceProvenance
    matched_evidence: str | None = None
    start_offset: int | None = None
    end_offset: int | None = None
    line_start: int | None = None
    line_end: int | None = None
    value_occurrences: int = 0
    row_aligned: bool = False

    @property
    def usable(self) -> bool:
        return self.status == "ALIGNED"

    @property
    def locator(self) -> str | None:
        if self.start_offset is None or self.end_offset is None:
            return None
        return f"char:{self.start_offset}-{self.end_offset}"

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "reasons": list(self.reasons),
            "field": self.field,
            "value": self.value,
            "unit": self.unit,
            "currency": self.currency,
            "row_label": self.row_label,
            "column_label": self.column_label,
            "table_header": self.table_header,
            "section_title": self.section_title,
            "document_title": self.document_title,
            "nearby_context": self.nearby_context,
            "cycle": self.cycle,
            "scope_hint": self.scope_hint,
            "entity_mentions": list(self.entity_mentions),
            "source_entity": self.source_entity,
            "provenance": self.provenance.to_dict(),
            "matched_evidence": self.matched_evidence,
            "locator": self.locator,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "value_occurrences": self.value_occurrences,
            "row_aligned": self.row_aligned,
        }


def resolve_evidence_alignment(
    assertion: object,
    source: object,
    *,
    field: str | None = None,
    structured_context: Mapping[str, object] | None = None,
) -> EvidenceAlignment:
    """Align an assertion quote/value to one retained source span."""
    source_text = str(_get(source, "text", "") or "")
    evidence = str(_get(assertion, "evidence", "") or "")
    span = _find_token_span(source_text, evidence)
    provenance = EvidenceProvenance(
        source_url=str(_get(source, "url", "") or "") or None,
        raw_document_id=str(_get(source, "raw_document_id", "") or "") or None,
        content_hash=str(_get(source, "content_hash", "") or "") or None,
        acquisition_run_id=str(_get(source, "acquisition_run_id", "") or "") or None,
        provider_id=str(_get(source, "provider_id", "") or "") or None,
        dataset_id=str(_get(source, "dataset_id", "") or "") or None,
        source_authority=_get(source, "source_authority"),
        source_relationship=_get(source, "source_relationship"),
    )
    if span is None:
        return EvidenceAlignment(
            status="UNRESOLVED",
            reasons=("EVIDENCE_NOT_IN_SNAPSHOT",),
            field=field or _get(assertion, "field_name"),
            value=_get(assertion, "value_json"),
            unit=None,
            currency=None,
            row_label=None,
            column_label=None,
            table_header=None,
            section_title=None,
            document_title=_get(source, "title"),
            nearby_context="",
            cycle=None,
            scope_hint=None,
            entity_mentions=(),
            source_entity=_get(source, "linked_programme_id"),
            provenance=provenance,
        )

    start, end = span
    # Token alignment intentionally ignores punctuation.  Include matching
    # trailing sentence punctuation so an otherwise exact quote does not look
    # like a repaired excerpt merely because the tokenizer stopped at a word.
    evidence_tail = evidence.rstrip()
    while end < len(source_text):
        if (
            source_text[end] not in ".,;:!?)]}"
            or not evidence_tail.endswith(source_text[end])
        ):
            break
        end += 1
    line_start_offset, line_end_offset, line = _line_bounds(source_text, start)
    header, section = _header_and_section(source_text, start)
    context = _nearby_context(source_text, start, end)
    # Structured parsers can establish alignment more reliably than flattened
    # text.  Merge only explicit metadata supplied for this exact value; the
    # source text remains the authority for the matched span and value.
    structured = dict(structured_context or {})
    structured_context_value = structured.get("nearby_context")
    if structured_context_value:
        context = str(structured_context_value)[:4000]
    structured_header = str(structured.get("table_header") or "").strip()
    structured_section = str(structured.get("section_title") or "").strip()
    structured_row = str(structured.get("row_label") or "").strip()
    structured_column = str(structured.get("column_label") or "").strip()
    if structured_header:
        header = structured_header
    if structured_section:
        section = structured_section
    if structured_row:
        line = structured_row
    amount = _value_amount(_get(assertion, "value_json"))
    money_amounts = _money_amounts(line)
    selected_amount = _decimal(amount)
    numeric_values = [
        parsed for token in _NUMBER_RE.findall(line)
        if (parsed := _decimal(token)) is not None
    ]
    candidate_amounts = money_amounts or numeric_values
    occurrences = (
        sum(1 for candidate in candidate_amounts if candidate == selected_amount)
        if selected_amount is not None
        else 0
    )
    numeric_tokens = _NUMBER_RE.findall(line)
    row_aligned = True
    reasons: list[str] = []
    field_name = str(field or _get(assertion, "field_name") or "")
    money_field = field_name in {"tuition", "additional_fees", "application_fee"}
    if amount and money_field and occurrences == 0:
        # A structured parser can provide an exact cell even when the textual
        # row representation is abbreviated.
        selected_value = structured.get("selected_value")
        selected_matches = (
            selected_value is not None
            and _decimal(selected_value) is not None
            and _decimal(selected_value) == _decimal(amount)
        )
        if not selected_matches and str(selected_value or "").replace(",", "") != amount:
            row_aligned = False
            reasons.append("VALUE_NOT_ALIGNED_TO_ROW")
    if amount and money_field and len(money_amounts) > 1 and occurrences != 1:
        row_aligned = False
        reasons.append("MULTIPLE_AMOUNT_ROW_ALIGNMENT")
    if amount and money_field and len(money_amounts) > 1 and occurrences == 1:
        has_column_signal = bool(
            header and re.search(
                r"\b(?:total|annual|year|term|semester|amount|cost|fee)\b",
                header,
                re.I,
            )
        )
        if not has_column_signal and not structured.get("column_label"):
            row_aligned = False
            reasons.append("COLUMN_ALIGNMENT_UNRESOLVED")
    scope_hint_match = _SCOPE_RE.search(" ".join((str(_get(source, "page_type", "")), str(section or ""))))
    scope_hint = scope_hint_match.group(1).casefold() if scope_hint_match else None
    currency = _explicit_currency(" ".join((context, str(_get(source, "title", "")), header or "")))
    cycle = str(structured.get("cycle") or "").strip() or _explicit_cycle(context)
    row_label = line
    if amount:
        row_label = re.sub(_NUMBER_RE, " ", row_label)
    row_label = re.sub(r"\s+", " ", row_label).strip(" |:-") or None
    column_label = structured_column or None
    structured_mentions = structured.get("entity_mentions")
    if isinstance(structured_mentions, (list, tuple, set)):
        entity_mentions = tuple(
            dict.fromkeys(
                str(item).strip() for item in structured_mentions
                if str(item).strip()
            )
        )
    else:
        entity_mentions = tuple(
            dict.fromkeys(
                item.strip()
                for item in (str(_get(source, "title", "") or ""), section or "", row_label or "")
                if item and item.strip()
            )
        )
    source_entity = (
        str(structured.get("source_entity") or "").strip()
        or str(_get(source, "linked_programme_id", "") or "")
        or str(_get(source, "linked_programme_url", "") or "")
        or None
    )
    if structured.get("row_aligned") is False:
        row_aligned = False
        if "ROW_ALIGNMENT_MISSING" not in reasons:
            reasons.append("ROW_ALIGNMENT_MISSING")
    elif structured.get("row_aligned") is True and (structured_row or structured_column):
        row_aligned = True
    document_title = str(structured.get("document_title") or "").strip() or _get(source, "title")
    scope_hint = str(structured.get("scope_hint") or "").strip() or scope_hint
    status = "ALIGNED" if row_aligned else "UNRESOLVED"
    return EvidenceAlignment(
        status=status,
        reasons=tuple(reasons),
        field=field or _get(assertion, "field_name"),
        value=_get(assertion, "value_json"),
        unit=str(structured.get("unit") or "").strip() or None,
        currency=currency,
        row_label=row_label,
        column_label=column_label,
        table_header=header,
        section_title=section,
        document_title=document_title,
        nearby_context=context,
        cycle=cycle,
        scope_hint=scope_hint,
        entity_mentions=entity_mentions,
        source_entity=source_entity,
        provenance=provenance,
        matched_evidence=source_text[start:end],
        start_offset=start,
        end_offset=end,
        line_start=line_start_offset,
        line_end=line_end_offset,
        value_occurrences=occurrences or (1 if amount and not numeric_tokens else 0),
        row_aligned=row_aligned,
    )


@dataclass(frozen=True)
class EntityScopeResolution:
    status: str
    scope: str | None
    entity_type: str | None
    entity_id: str | None
    organisation_unit_id: str | None
    signal: str | None
    evidence: str | None
    reasons: tuple[str, ...] = ()

    @property
    def bound(self) -> bool:
        return self.status == "BOUND"

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "scope": self.scope,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "organisation_unit_id": self.organisation_unit_id,
            "signal": self.signal,
            "evidence": self.evidence,
            "reasons": list(self.reasons),
        }


def _programme_url_bound(source: object, programme: Mapping[str, object]) -> bool:
    source_url = _canonical_url(_get(source, "url"))
    target_url = _canonical_url(programme.get("official_url"))
    if not source_url or not target_url:
        return False
    source_parts, target_parts = urlsplit(source_url), urlsplit(target_url)
    if source_parts.netloc != target_parts.netloc:
        return False
    return source_parts.path == target_parts.path or source_parts.path.startswith(target_parts.path.rstrip("/") + "/")


def _unit_fields(unit: object) -> tuple[str, str, str | None]:
    unit_id = str(_get(unit, "organisation_unit_id", "") or "")
    name = str(_get(unit, "unit_name", _get(unit, "name", "")) or "")
    institution_id = str(_get(unit, "institution_id", "") or "") or None
    return unit_id, name, institution_id


def resolve_entity_scope(
    assertion: object,
    source: object,
    *,
    target_institution_id: str | None = None,
    target_programme: Mapping[str, object] | None = None,
    organisation_units: Iterable[object] = (),
    supplied_organisation_unit_id: str | None = None,
    fallback_to_institution: bool = False,
) -> EntityScopeResolution:
    """Bind only an entity identity explicitly supported by source context."""
    requested_scope = str(_get(assertion, "scope", "") or "").casefold()
    title = str(_get(source, "title", "") or "")
    source_text = str(_get(source, "text", "") or "")
    linked_programme_id = str(_get(source, "linked_programme_id", "") or "")
    linked_programme_url = str(_get(source, "linked_programme_url", "") or "")
    target_id = str((target_programme or {}).get("programme_id") or _get(assertion, "entity_id", "") or "")
    if requested_scope == "programme":
        if linked_programme_id and linked_programme_id == target_id:
            return EntityScopeResolution("BOUND", "programme", "programme", target_id, None, "linked_programme_id", linked_programme_id)
        if target_programme and (
            (_same_url(linked_programme_url, target_programme.get("official_url")))
            or _programme_url_bound(source, target_programme)
        ):
            return EntityScopeResolution("BOUND", "programme", "programme", target_id, None, "programme_url", str(_get(source, "url")))
        name = str((target_programme or {}).get("programme_name") or "")
        name_tokens = tuple(token for token in _tokens(name) if token not in _GENERIC_NAME_WORDS)
        title_tokens = set(_tokens(title))
        if name_tokens and len(name_tokens) >= 2 and all(token in title_tokens for token in name_tokens):
            return EntityScopeResolution("BOUND", "programme", "programme", target_id, None, "document_title", title)
        if fallback_to_institution and target_institution_id:
            return EntityScopeResolution(
                "BOUND", "institution", "institution", target_institution_id,
                None, "verified_source_ownership", str(_get(source, "url", "")),
                ("PROGRAMME_SCOPE_UNVERIFIED", "INSTITUTION_SCOPE_FALLBACK"),
            )
        return EntityScopeResolution("UNRESOLVED", "programme", "programme", target_id, None, None, None, ("PROGRAMME_SCOPE_UNVERIFIED",))
    if requested_scope in {"faculty", "department", "school"}:
        if supplied_organisation_unit_id:
            return EntityScopeResolution(
                "BOUND", requested_scope, "organisation_unit", supplied_organisation_unit_id,
                supplied_organisation_unit_id, "verified_source_metadata", title or source_text,
            )
        searchable = " ".join((title, source_text))
        candidates: list[tuple[str, str]] = []
        unit_iterable = (
            organisation_units.values()
            if isinstance(organisation_units, Mapping)
            else organisation_units
        )
        for unit in unit_iterable:
            unit_id, name, institution_id = _unit_fields(unit)
            if not unit_id or not name or (target_institution_id and institution_id and institution_id != target_institution_id):
                continue
            name_tokens = _tokens(name)
            if name_tokens and all(token in _tokens(searchable) for token in name_tokens):
                candidates.append((unit_id, name))
        unique = list(dict.fromkeys(candidates))
        if len(unique) == 1:
            unit_id, name = unique[0]
            return EntityScopeResolution("BOUND", requested_scope, "organisation_unit", unit_id, unit_id, "explicit_unit_name", name)
        return EntityScopeResolution("UNRESOLVED", requested_scope, "organisation_unit", None, None, None, None, ("ORGANISATION_UNIT_UNVERIFIED",))
    if requested_scope == "institution" and target_institution_id:
        return EntityScopeResolution("BOUND", "institution", "institution", target_institution_id, None, "institution_binding", target_institution_id)
    if fallback_to_institution and target_institution_id:
        return EntityScopeResolution(
            "BOUND", "institution", "institution", target_institution_id,
            None, "verified_source_ownership", str(_get(source, "url", "")),
            ("SUBJECT_SCOPE_UNVERIFIED", "INSTITUTION_SCOPE_FALLBACK"),
        )
    return EntityScopeResolution("UNRESOLVED", requested_scope or None, None, None, None, None, None, ("SUBJECT_SCOPE_UNVERIFIED",))


@dataclass(frozen=True)
class ProvenanceResolution:
    assertion: object
    status: str
    changes: tuple[str, ...] = ()
    reasons: tuple[str, ...] = ()
    alignment: EvidenceAlignment | None = None

    @property
    def repaired(self) -> bool:
        return self.status == "REPAIRED"

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "changes": list(self.changes),
            "reasons": list(self.reasons),
            "alignment": self.alignment.to_dict() if self.alignment else None,
        }


def resolve_provenance(
    assertion: object,
    source: object,
    *,
    alignment: EvidenceAlignment | None = None,
    acquisition_run_id: str | None = None,
) -> ProvenanceResolution:
    """Propagate provenance from the exact bound source, never another URL."""
    source_url = str(_get(source, "url", "") or "")
    assertion_url = str(_get(assertion, "source_url", "") or "")
    if not source_url:
        return ProvenanceResolution(assertion, "UNAVAILABLE", reasons=("SOURCE_URL_UNAVAILABLE",))
    if not assertion_url:
        return ProvenanceResolution(assertion, "UNAVAILABLE", reasons=("SOURCE_URL_MISSING",))
    if not _same_url(source_url, assertion_url):
        return ProvenanceResolution(assertion, "MISMATCH", reasons=("SOURCE_URL_MISMATCH",))
    fields = (
        ("source_content_hash", "content_hash", "SOURCE_CONTENT_HASH"),
        ("raw_document_id", "raw_document_id", "RAW_DOCUMENT_ID"),
        ("acquisition_run_id", "acquisition_run_id", "ACQUISITION_RUN_ID"),
        ("source_authority", "source_authority", "SOURCE_AUTHORITY"),
        ("source_relationship", "source_relationship", "SOURCE_RELATIONSHIP"),
        ("provider_id", "provider_id", "PROVIDER_ID"),
        ("dataset_id", "dataset_id", "DATASET_ID"),
        ("parser_id", "parser_id", "PARSER_ID"),
        ("parser_version", "parser_version", "PARSER_VERSION"),
    )
    changes: list[str] = []
    reasons: list[str] = []
    values: dict[str, object] = {}
    for assertion_field, source_field, label in fields:
        old = _get(assertion, assertion_field)
        new = _get(source, source_field)
        if not _missing(old) and not _missing(new) and not _same_scalar(old, new):
            reasons.append("PROVENANCE_MISMATCH")
        elif _missing(old) and not _missing(new):
            values[assertion_field] = new
            changes.append(label + "_PROPAGATED")
    run_id = values.get("acquisition_run_id") or _get(assertion, "acquisition_run_id") or acquisition_run_id
    if _missing(_get(assertion, "acquisition_run_id")) and run_id:
        values["acquisition_run_id"] = run_id
        if "ACQUISITION_RUN_ID_PROPAGATED" not in changes:
            changes.append("ACQUISITION_RUN_ID_PROPAGATED")
    required = (
        values.get("source_content_hash") or _get(assertion, "source_content_hash"),
        values.get("raw_document_id") or _get(assertion, "raw_document_id"),
        values.get("acquisition_run_id") or _get(assertion, "acquisition_run_id") or acquisition_run_id,
        values.get("source_authority") or _get(assertion, "source_authority"),
        values.get("source_relationship") or _get(assertion, "source_relationship"),
    )
    if reasons:
        return ProvenanceResolution(assertion, "MISMATCH", tuple(changes), tuple(dict.fromkeys(reasons)), alignment)
    if not all(required):
        reasons.append("MISSING_PROVENANCE")
        return ProvenanceResolution(assertion, "UNAVAILABLE", tuple(changes), tuple(reasons), alignment)
    if alignment and alignment.usable and alignment.matched_evidence and alignment.matched_evidence != _get(assertion, "evidence"):
        values["evidence"] = alignment.matched_evidence
        changes.append("EVIDENCE_SPAN_REPAIRED")
    if alignment and alignment.usable and not _get(assertion, "evidence_locator") and alignment.locator:
        values["evidence_locator"] = alignment.locator
        changes.append("EVIDENCE_LOCATOR_PROPAGATED")
    if not values:
        return ProvenanceResolution(assertion, "UNCHANGED", alignment=alignment)
    try:
        from dataclasses import replace

        repaired = replace(assertion, **values)
    except (TypeError, ValueError):
        return ProvenanceResolution(assertion, "UNAVAILABLE", reasons=("ASSERTION_NOT_REPLACEABLE",), alignment=alignment)
    return ProvenanceResolution(repaired, "REPAIRED", tuple(dict.fromkeys(changes)), alignment=alignment)


def binding_for_assertion(
    assertion: object,
    bindings: Mapping[str, object],
) -> object | None:
    """Find a unique raw binding, falling back to a unique exact source URL."""
    raw_id = str(_get(assertion, "raw_document_id", "") or "")
    if raw_id and raw_id in bindings:
        return bindings[raw_id]
    source_url = _get(assertion, "source_url")
    candidates = [
        binding for binding in bindings.values()
        if _same_url(_get(_get(binding, "source"), "url"), source_url)
    ]
    if len(candidates) == 1:
        return candidates[0]
    content_hash = str(_get(assertion, "source_content_hash", "") or "")
    if content_hash:
        candidates = [
            binding for binding in candidates
            if str(_get(_get(binding, "source"), "content_hash", "") or "") == content_hash
        ]
    return candidates[0] if len(candidates) == 1 else None


def source_resolution_summary(
    assertion: object,
    *,
    binding: object | None,
    alignment: EvidenceAlignment | None,
    provenance: ProvenanceResolution | None,
    entity: EntityScopeResolution | None,
    acceptance_reasons: Sequence[str] = (),
) -> str:
    """Classify a review row for the reusable regression corpus."""
    reasons = set(acceptance_reasons)
    hard_reasons = {
        "PROVENANCE_MISMATCH", "WRONG_INSTITUTION", "WRONG_PROGRAMME",
        "NON_NATIVE_OBSERVATION", "SEARCH_NOT_EVIDENCE", "INAPPLICABLE_ENTITY",
        "EXTERNAL_ENTITY_MATCH_UNVERIFIED", "VALUE_NOT_SUPPORTED",
        "MATERIAL_CONFLICT",
    }
    if reasons & hard_reasons or (provenance and provenance.status == "MISMATCH"):
        return "HARD_INVALID"
    flags: list[str] = []
    if alignment and set(alignment.reasons) & {
        "MULTIPLE_AMOUNT_ROW_ALIGNMENT", "COLUMN_ALIGNMENT_UNRESOLVED",
        "VALUE_NOT_ALIGNED_TO_ROW", "ROW_ALIGNMENT_MISSING",
    }:
        flags.append("ALIGNMENT_FIXABLE")
    if alignment and alignment.usable:
        original = _normalised_text(_get(assertion, "evidence", ""))
        matched = _normalised_text(alignment.matched_evidence or "")
        if original and matched and original != matched:
            flags.append("ALIGNMENT_FIXABLE")
    scope = str(_get(assertion, "scope", "") or "").casefold()
    scope_reasons = {
        "PROGRAMME_SCOPE_UNVERIFIED", "ORGANISATION_UNIT_UNVERIFIED",
        "SUBJECT_SCOPE_UNVERIFIED",
    }
    if entity and entity.bound and (
        reasons & scope_reasons
        or (
            not reasons
            and (
                entity.scope != scope
                or entity.entity_id != _get(assertion, "entity_id")
                or entity.entity_type != _get(assertion, "entity_type")
            )
        )
    ):
        flags.append("SCOPE_BINDING_FIXABLE")
    if provenance and provenance.repaired:
        flags.append("PROVENANCE_FIXABLE")
    flags = list(dict.fromkeys(flags))
    if not flags:
        return "HARD_INVALID" if "WRONG_INSTITUTION" in reasons or "WRONG_PROGRAMME" in reasons else "REAL_INSUFFICIENT_EVIDENCE"
    return "MULTIPLE_FIXES_REQUIRED" if len(flags) > 1 else flags[0]


EvidenceContext = EvidenceAlignment
EvidenceAlignmentResolver = type(
    "EvidenceAlignmentResolver",
    (),
    {"resolve": staticmethod(resolve_evidence_alignment)},
)
EntityScopeResolver = type(
    "EntityScopeResolver",
    (),
    {"resolve": staticmethod(resolve_entity_scope)},
)
ProvenanceResolver = type(
    "ProvenanceResolver",
    (),
    {"resolve": staticmethod(resolve_provenance)},
)


__all__ = [
    "EvidenceAlignment",
    "EvidenceAlignmentResolver",
    "EvidenceContext",
    "EvidenceProvenance",
    "EntityScopeResolution",
    "EntityScopeResolver",
    "ProvenanceResolution",
    "ProvenanceResolver",
    "binding_for_assertion",
    "resolve_entity_scope",
    "resolve_evidence_alignment",
    "resolve_provenance",
    "source_resolution_summary",
]
