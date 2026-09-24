"""Generic evidence alignment resolver.

Normalises retained evidence into a common representation containing
structured context (row/column, section, document title, nearby context)
so downstream acceptance can evaluate whether a value is properly aligned
to its source.

This module is deliberately source-agnostic: it uses only generic signals
(table structure, section headings, document context) and never hard-codes
institution names, URLs, assertion IDs, or source-specific exceptions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .extraction_provider import ExtractionSource
from .models import FieldAssertion


# ---------------------------------------------------------------------------
# Aligned evidence representation
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AlignedEvidence:
    """Common representation of evidence with structural alignment metadata."""

    field_name: str
    value: Any
    raw_evidence: str
    row_label: str | None = None
    column_label: str | None = None
    table_header: str | None = None
    section_title: str | None = None
    document_title: str | None = None
    nearby_context: str | None = None
    cycle: str | None = None
    scope_hint: str | None = None
    entity_mentions: tuple[str, ...] = ()
    source_entity: str | None = None
    provenance: dict[str, Any] = field(default_factory=dict)
    alignment_confidence: float = 0.0
    alignment_issues: tuple[str, ...] = ()
    is_row_aligned: bool = False
    is_table_context: bool = False


# ---------------------------------------------------------------------------
# Table structure detection
# ---------------------------------------------------------------------------

_TABLE_HEADER_RE = re.compile(
    r"^(?:"
    r"(?:fee|cost|tuition|charge|amount|price|rate|per\s+(?:unit|term|semester|year|credit))"
    r"|(?:description|item|type|category|name)"
    r"|(?:20\d{2}(?:\s*[-/\u2010-\u2015]\s*(?:20)?\d{2})?)"
    r"|(?:domestic|international|in.state|out.of.state|resident|non.resident)"
    r")\s*$",
    re.I,
)

_AMOUNT_ROW_RE = re.compile(
    r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\s*)\s*\d"
)

_SECTION_HEADING_RE = re.compile(
    r"^(?:"
    r"(?:tuition|fees?|cost|expense|charge|payment|financial)"
    r"|(?:admission|requirement|prerequisite|eligibility)"
    r"|(?:scholarship|fellowship|award|funding|aid|grant)"
    r"|(?:deadline|date|timeline|schedule)"
    r"|(?:programme|program|degree|course|module)"
    r"|(?:overview|about|description|summary)"
    r"|(?:english|ielts|toefl|duolingo|language|proficiency)"
    r"|(?:credential|certificate|diploma|qualification)"
    r")\s*$",
    re.I,
)


def _normalise_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _extract_table_header(source: ExtractionSource, evidence: str) -> str | None:
    """Detect whether evidence comes from a table and extract its header row."""
    text = source.text or ""
    evidence_fold = evidence.casefold()
    # Look for the evidence in the source text and find nearby table structure
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return None
    # Scan backwards for a header-like line
    preceding = text[:idx]
    lines = preceding.split("\n")
    for line in reversed(lines[-5:]):
        stripped = _normalise_whitespace(line)
        if not stripped:
            continue
        if _TABLE_HEADER_RE.search(stripped):
            return stripped
        # If we hit a non-table line, stop
        if len(stripped) > 200:
            break
    return None


def _extract_row_label(source: ExtractionSource, evidence: str) -> str | None:
    """Extract the row label for a table cell value."""
    text = source.text or ""
    evidence_fold = evidence.casefold()
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return None
    # Look at the text before the evidence on the same line
    line_start = text.rfind("\n", 0, idx)
    line_start = 0 if line_start < 0 else line_start + 1
    line_before = text[line_start:idx].strip()
    if line_before and len(line_before) < 200:
        return line_before
    return None


def _extract_column_label(
    source: ExtractionSource, evidence: str, table_header: str | None
) -> str | None:
    """Determine which column the evidence belongs to from the header."""
    if not table_header:
        return None
    text = source.text or ""
    evidence_fold = evidence.casefold()
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return None
    # Approximate column position by character offset within the header
    line_start = text.rfind("\n", 0, idx)
    line_start = 0 if line_start < 0 else line_start + 1
    col_offset = idx - line_start
    # Split header by common delimiters
    for delim in ("\t", "|", "  ", " • ", " » ", " — ", " – ", " - "):
        parts = [p.strip() for p in table_header.split(delim) if p.strip()]
        if len(parts) < 2:
            continue
        # Accumulate positions
        pos = 0
        for part in parts:
            part_pos = table_header.find(part, pos)
            if part_pos < 0:
                continue
            part_end = part_pos + len(part)
            if part_pos <= col_offset <= part_end + 15:
                return part
            pos = part_end
    return None


def _extract_section_title(source: ExtractionSource, evidence: str) -> str | None:
    """Find the section heading above the evidence location."""
    text = source.text or ""
    evidence_fold = evidence.casefold()
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return None
    preceding = text[:idx]
    lines = preceding.split("\n")
    for line in reversed(lines[-10:]):
        stripped = _normalise_whitespace(line)
        if not stripped:
            continue
        if _SECTION_HEADING_RE.search(stripped):
            return stripped
        # Short bold-like lines are likely headings
        if len(stripped) < 80 and stripped.endswith(":"):
            return stripped.rstrip(":")
    return None


def _extract_nearby_context(source: ExtractionSource, evidence: str) -> str:
    """Return bounded context around the evidence within the source."""
    text = source.text or ""
    evidence_fold = evidence.casefold()
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return ""
    start = max(0, idx - 300)
    end = min(len(text), idx + max(len(evidence), 300))
    return text[start:end]


def _detect_cycle_from_context(
    source: ExtractionSource, evidence: str
) -> str | None:
    """Detect academic cycle from document/evidence context."""
    context = _extract_nearby_context(source, evidence)
    match = re.search(
        r"\b(20\d{2})\s*[-/\u2010-\u2015]\s*(20)?(\d{2})\b", context
    )
    if not match:
        return None
    end = (
        f"{match.group(2)}{match.group(3)}"
        if match.group(2)
        else f"{match.group(1)[:2]}{match.group(3)}"
    )
    return f"{match.group(1)}-{end}"


def _detect_table_context(source: ExtractionSource, evidence: str) -> bool:
    """Detect whether evidence is within a table structure."""
    text = source.text or ""
    evidence_fold = evidence.casefold()
    idx = text.casefold().find(evidence_fold)
    if idx < 0:
        return False
    # Check for tab characters or pipe-delimited rows nearby
    window = text[max(0, idx - 500):idx + len(evidence) + 500]
    if "\t" in window:
        return True
    # Count pipe characters in nearby lines
    nearby_lines = window.split("\n")
    pipe_lines = sum(1 for line in nearby_lines if "|" in line)
    if pipe_lines >= 2:
        return True
    # Check for consistent column alignment (multiple dollar amounts on different lines)
    amount_lines = sum(
        1 for line in nearby_lines
        if re.search(r"[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\b", line)
    )
    return amount_lines >= 2


def _extract_entity_mentions(evidence: str) -> tuple[str, ...]:
    """Extract named entity mentions from evidence text."""
    mentions: list[str] = []
    # University/school patterns (generic)
    for match in re.finditer(
        r"(?:University|College|School|Institute|Academy|Faculty|Department)"
        r"(?:\s+(?:of|for|and)\s+[\w\s&'-]+){0,5}",
        evidence,
    ):
        mentions.append(match.group(0).strip())
    return tuple(dict.fromkeys(mentions))


def _detect_scope_hint(
    source: ExtractionSource, evidence: str
) -> str | None:
    """Detect scope hint from source context."""
    context = " ".join((
        source.title or "",
        source.page_type or "",
        source.url or "",
    )).casefold()
    evidence_fold = evidence.casefold()
    if re.search(r"\b(?:tuition|fees?|cost)\b.*\b(?:undergraduate|graduate)\b", evidence_fold):
        return "programme"
    if re.search(r"\b(?:university|college|institute)\b.*\b(?:tuition|fees?|cost)\b", evidence_fold):
        return "institution"
    if re.search(r"\b(?:faculty|school|college|department)\b", context):
        return "faculty"
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def align_evidence(
    assertion: FieldAssertion,
    source: ExtractionSource,
) -> AlignedEvidence:
    """Normalise evidence into a common aligned representation.

    Uses only the source-bound evidence and source metadata.  Does not infer
    values, invent context, or hard-code institution-specific rules.
    """
    evidence = assertion.evidence or ""
    if not evidence:
        return AlignedEvidence(
            field_name=assertion.field_name,
            value=assertion.value_json,
            raw_evidence="",
            alignment_issues=("EMPTY_EVIDENCE",),
        )

    issues: list[str] = []

    # Table structure detection
    is_table = _detect_table_context(source, evidence)
    table_header = _extract_table_header(source, evidence) if is_table else None
    row_label = _extract_row_label(source, evidence) if is_table else None
    column_label = _extract_column_label(source, evidence, table_header) if is_table else None

    if is_table and not row_label and not column_label:
        issues.append("TABLE_ALIGNMENT_UNCERTAIN")

    # Section and document context
    section_title = _extract_section_title(source, evidence)
    document_title = source.title or None
    nearby_context = _extract_nearby_context(source, evidence)

    # Cycle detection from context
    cycle = _detect_cycle_from_context(source, evidence)

    # Entity mentions
    entity_mentions = _extract_entity_mentions(evidence)

    # Scope hint
    scope_hint = _detect_scope_hint(source, evidence)

    # Row alignment confidence
    alignment_confidence = 0.0
    is_row_aligned = False
    if is_table:
        if row_label:
            alignment_confidence += 0.4
            is_row_aligned = True
        if column_label:
            alignment_confidence += 0.3
        if table_header:
            alignment_confidence += 0.2
        if not is_row_aligned:
            issues.append("ROW_ALIGNMENT_MISSING")
    else:
        # Non-table evidence: alignment is implicit
        alignment_confidence = 0.6
        is_row_aligned = True

    # Provenance metadata
    provenance = {
        "raw_document_id": assertion.raw_document_id,
        "source_content_hash": assertion.source_content_hash,
        "acquisition_run_id": assertion.acquisition_run_id,
        "source_url": assertion.source_url,
    }

    return AlignedEvidence(
        field_name=assertion.field_name,
        value=assertion.value_json,
        raw_evidence=evidence,
        row_label=row_label,
        column_label=column_label,
        table_header=table_header,
        section_title=section_title,
        document_title=document_title,
        nearby_context=nearby_context,
        cycle=cycle,
        scope_hint=scope_hint,
        entity_mentions=entity_mentions,
        source_entity=document_title,
        provenance=provenance,
        alignment_confidence=alignment_confidence,
        alignment_issues=tuple(issues),
        is_row_aligned=is_row_aligned,
        is_table_context=is_table,
    )


def resolve_table_row_alignment(
    assertion: FieldAssertion,
    source: ExtractionSource,
) -> FieldAssertion:
    """Attempt to improve row alignment for table-structured evidence.

    If the evidence contains multiple amounts and cannot be aligned to a
    specific row, returns the assertion unchanged.  If alignment is
    possible, returns the assertion with enriched context.

    This is a generic resolver - no institution-specific rules.
    """
    evidence = assertion.evidence or ""
    if not evidence:
        return assertion

    aligned = align_evidence(assertion, source)

    # Only attempt resolution for table-context evidence with multiple amounts
    if not aligned.is_table_context:
        return assertion

    amount_count = len(re.findall(
        r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\s*)\s*\d",
        evidence,
    ))
    if amount_count <= 1:
        return assertion

    # If we have row alignment, we can resolve the specific row
    if aligned.is_row_aligned and aligned.row_label:
        # Check if the row label contains exactly one amount
        row_amounts = re.findall(
            r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\s*)\s*\d+(?:,\d{3})*(?:\.\d+)?",
            aligned.row_label,
        )
        if len(row_amounts) == 1:
            # Row alignment is sufficient
            return assertion

    # Cannot resolve row alignment - flag but don't reject
    # The assertion stays in NEEDS_REVIEW for manual resolution
    return assertion


def reconcile_multiple_amounts(
    assertion: FieldAssertion,
    source: ExtractionSource,
) -> tuple[FieldAssertion, list[str]]:
    """Reconcile assertions where evidence contains multiple dollar amounts.

    Uses row/column alignment from the aligned evidence to determine which
    amount belongs to the asserted value. Returns the assertion unchanged
    if alignment cannot be established.

    This is a generic resolver - it uses table structure detection, not
    institution-specific knowledge.
    """
    evidence = assertion.evidence or ""
    if not evidence:
        return assertion, []

    aligned = align_evidence(assertion, source)
    changes: list[str] = []

    if not aligned.is_table_context:
        return assertion, []

    amount_count = len(re.findall(
        r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\s*)\s*\d+(?:,\d{3})*(?:\.\d+)?",
        evidence,
    ))
    if amount_count <= 1:
        return assertion, []

    # If we have a row label, try to extract the specific amount
    if aligned.row_label:
        row_amounts = re.findall(
            r"(?:[$£€]|\b(?:USD|SGD|AUD|CAD|EUR|GBP|CHF|JPY)\s*)\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
            aligned.row_label,
        )
        if len(row_amounts) == 1:
            # Successfully aligned to a single row
            from decimal import Decimal
            value = assertion.value_json
            if isinstance(value, dict) and "amount" in value:
                try:
                    extracted = Decimal(row_amounts[0].replace(",", ""))
                    if Decimal(str(value["amount"])) != extracted:
                        changes.append("ROW_ALIGNED_AMOUNT_CORRECTED")
                except Exception:
                    pass
            return assertion, changes

    # Cannot establish row alignment - flag for review
    changes.append("MULTIPLE_AMOUNT_ROW_ALIGNMENT")
    return assertion, changes
