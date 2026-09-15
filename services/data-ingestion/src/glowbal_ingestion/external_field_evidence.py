"""Materialise bounded, field-bearing context from external resources.

External acquisition deliberately persists source-native raw objects before
any semantic work.  Public datasets often contain thousands of records, so
passing the whole retained object to semantic extraction loses both target
identity and table alignment.  This module selects *already parsed*, bounded
records using configured identifiers and renders their literal labels and
values as extraction context.

It does not create facts or assertions.  The normal semantic schema,
validation, acceptance and inference paths remain responsible for that work.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from .extraction_provider import ExtractionSource
from .models import ParsedDocument


@dataclass(frozen=True)
class FieldEvidenceMaterialization:
    """Bounded source-native context and proof of deterministic entity match."""

    text: str
    title: str | None
    entity_match: bool
    matching_signals: tuple[str, ...] = ()
    record_count: int = 0
    reason: str = "not_configured"
    # Source-native catalogue attributes extracted deterministically from the
    # already matched record/page.  They are provenance-bearing metadata, not
    # semantic assertions.
    metadata: tuple[Mapping[str, Any], ...] = ()


def _values(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        value = (value,)
    if not isinstance(value, (list, tuple, set, frozenset)):
        return ()
    return tuple(str(item).strip() for item in value if str(item).strip())


def _row_value(row: Mapping[str, Any], column: str) -> Any:
    """Read a declarative column, including dotted JSON object paths.

    Structured government APIs frequently return an envelope such as
    ``{"id": ..., "content": {"application": {"last": ...}}}`` rather
    than flattening every leaf into a CSV-like row.  Exact-key lookup remains
    first so existing columns containing dots keep their source meaning; the
    dotted fallback is only a transport-shape traversal and never derives a
    value.
    """
    if not column:
        return None
    if column in row:
        return row[column]
    # Preserve the case-insensitive top-level matching behaviour used by the
    # CSV/flat-row materialiser before dotted JSON paths were introduced.
    # Exact source keys still win above; this fallback only compensates for
    # providers that vary header casing (for example ``UNITID`` vs ``unitid``).
    column_casefold = str(column).casefold()
    for key, value in row.items():
        if str(key).casefold() == column_casefold:
            return value
    current: Any = row
    for part in str(column).split("."):
        if isinstance(current, Mapping):
            current = current.get(part)
        elif isinstance(current, (list, tuple)) and part.isdigit():
            index = int(part)
            current = current[index] if 0 <= index < len(current) else None
        else:
            return None
    return current


def _literal(value: Any) -> str:
    """Render a source value without losing structured list/object members."""
    if isinstance(value, Mapping):
        return "; ".join(
            f"{key}={_literal(item)}"
            for key, item in value.items()
            if str(key).strip() and _present(item)
        )
    if isinstance(value, (list, tuple, set, frozenset)):
        return " | ".join(
            _literal(item) for item in value if _present(item)
        )
    return str(value).strip()


def _provider_identifiers(
    seed: Any,
    provider_id: str | None,
    programme_id: str | None = None,
) -> dict[str, str]:
    raw = getattr(seed, "provider_identifiers", {}) or {}
    if not isinstance(raw, Mapping) or not provider_id:
        return {}
    item = raw.get(provider_id) or raw.get(str(provider_id).casefold()) or {}
    if not isinstance(item, Mapping):
        item = {}
    identifiers = {
        str(key): str(value).strip()
        for key, value in item.items()
        if value is not None and str(value).strip()
    }
    # Programme-resolution providers may expose a second identifier (for
    # example an Onisep AF code) that is only meaningful for the current
    # programme.  The candidate carries that configured link after discovery;
    # merge its provider-specific identifiers without changing institution
    # scope or accepting an unconfigured row.
    if programme_id:
        programme_map = getattr(seed, "provider_programme_identifiers", {}) or {}
        if isinstance(programme_map, Mapping):
            providers = programme_map.get(programme_id)
            programme_item = (
                providers.get(provider_id)
                if isinstance(providers, Mapping) and provider_id
                else None
            )
            if isinstance(programme_item, Mapping):
                identifiers.update({
                    str(key): str(value).strip()
                    for key, value in programme_item.items()
                    if value is not None and str(value).strip()
                })
    return identifiers


def _format_identity_pattern(
    pattern: str,
    *,
    seed: Any,
    provider_id: str | None,
    programme_id: str | None = None,
) -> str:
    values: dict[str, str] = {
        "institution_name": str(getattr(seed, "name", "") or ""),
    }
    # Use the source linked to this extraction request.  The previous
    # formatter merged every programme's identifiers, so the last configured
    # Manchester KISCourse (and similar multi-target rows) could overwrite the
    # current route's identity pattern.  Institution-level identifiers remain
    # available, while programme identifiers are selected only for the linked
    # programme.  The fallback preserves legacy callers that do not carry a
    # deterministic programme link.
    values.update(_provider_identifiers(seed, provider_id, programme_id))
    if not programme_id:
        programme_map = getattr(seed, "provider_programme_identifiers", {}) or {}
        if isinstance(programme_map, Mapping) and provider_id:
            for providers in programme_map.values():
                if not isinstance(providers, Mapping):
                    continue
                identifiers = providers.get(provider_id)
                if isinstance(identifiers, Mapping):
                    values.update({
                        str(key): str(value)
                        for key, value in identifiers.items()
                        if value is not None and str(value).strip()
                    })
    try:
        return pattern.format_map(values)
    except (KeyError, ValueError):
        return ""


def _field_evidence(metadata: Mapping[str, Any] | None) -> Mapping[str, Any]:
    if not isinstance(metadata, Mapping):
        return {}
    value = metadata.get("field_evidence")
    return value if isinstance(value, Mapping) else {}


def _structured_rows(
    payload: Any,
    *,
    record_path: Any = None,
) -> Iterable[tuple[str | None, Mapping[str, Any]]]:
    """Yield source rows from archive envelopes and direct JSON/CSV payloads.

    ZIP parsing already wraps bounded members in ``{"members": ...}``, while
    the ordinary JSON and CSV parsers intentionally retain their native
    top-level list/record shape.  Supporting both shapes here keeps the
    materialiser provider-neutral and avoids requiring every machine-readable
    provider to add an artificial archive envelope.
    """
    # Some official data APIs (including CKAN's datastore action) wrap the
    # actual records below a provider-native result path, for example
    # ``result.records``.  The path is declarative source metadata; resolving
    # it here does not alter row values or create assertions.
    if record_path:
        if isinstance(record_path, str):
            parts = tuple(part for part in record_path.split(".") if part)
        elif isinstance(record_path, (list, tuple)):
            parts = tuple(str(part) for part in record_path if str(part))
        else:
            parts = ()
        current = payload
        for part in parts:
            if isinstance(current, Mapping):
                current = current.get(part)
            elif isinstance(current, (list, tuple)) and part.isdigit():
                index = int(part)
                current = current[index] if index < len(current) else None
            else:
                current = None
                break
        if current is not payload:
            return _structured_rows(current)

    if isinstance(payload, (list, tuple)):
        return tuple((None, row) for row in payload if isinstance(row, Mapping))
    if not isinstance(payload, Mapping):
        return ()

    members = payload.get("members")
    if isinstance(members, (list, tuple)):
        result: list[tuple[str | None, Mapping[str, Any]]] = []
        for member in members:
            if not isinstance(member, Mapping):
                continue
            name = str(member.get("member_name") or member.get("name") or "") or None
            rows = member.get("structured")
            if isinstance(rows, Mapping):
                rows = (rows,)
            if not isinstance(rows, (list, tuple)):
                continue
            result.extend((name, row) for row in rows if isinstance(row, Mapping))
        return tuple(result)

    # Common JSON APIs use one of these wrapper keys.  Keep the wrapper name
    # out of the rendered context: it is transport structure, not a source
    # field or archive member.
    for key in (
        "rows",
        "data",
        "results",
        "items",
        "records",
        # Susa-navet's OpenAPI envelope uses resource-specific collection
        # names.  Keep these transport keys provider-neutral so the same
        # materializer can select exact event/info records.
        "educationEvents",
        "educationInfos",
        "educationProviders",
    ):
        rows = payload.get(key)
        if isinstance(rows, Mapping):
            return ((None, rows),)
        if isinstance(rows, (list, tuple)):
            return tuple((None, row) for row in rows if isinstance(row, Mapping))

    # A single JSON object can itself be the source record.  Only expose it
    # when it has at least one scalar leaf; nested API envelopes remain
    # unmaterialised rather than being mistaken for a row.
    if any(not isinstance(value, (Mapping, list, tuple, set, frozenset)) for value in payload.values()):
        return ((None, payload),)
    return ()


def _matches_row(
    row: Mapping[str, Any],
    identifiers: Mapping[str, str],
    fields: tuple[str, ...],
) -> tuple[bool, tuple[str, ...]]:
    if not identifiers:
        return False, ()
    signals: list[str] = []
    for field in fields:
        expected = identifiers.get(field)
        actual_value = _row_value(row, field)
        if not expected or actual_value is None:
            return False, ()
        if isinstance(actual_value, (list, tuple, set, frozenset)):
            actual_values = _values(actual_value)
            if expected.casefold() not in {
                value.casefold() for value in actual_values
            }:
                return False, ()
            signals.append(f"{field}={expected}")
            continue
        actual = str(actual_value or "").strip()
        if not actual or actual.casefold() != expected.casefold():
            return False, ()
        signals.append(f"{field}={actual}")
    return True, tuple(signals)


def _present(value: Any) -> bool:
    # ``False`` is intentionally absent for optional catalogue attributes;
    # this preserves the prior behaviour for boolean flags while true and
    # structured values remain renderable.
    if value is False:
        return False
    text = _literal(value)
    return bool(text) and text.casefold() not in {"null", "none", "nan", "privacy suppressed", "suppressed"}


def _metadata_item(
    *,
    field: str,
    value: Any,
    label: str,
    evidence: str,
    source: ExtractionSource,
    column: str | None = None,
    scope: str | None = None,
) -> dict[str, Any]:
    """Build one literal, provenance-bearing catalogue metadata observation."""
    return {
        "field_name": field,
        "value": _literal(value),
        "label": label,
        "evidence": evidence,
        "source_column": column,
        "scope": scope or "programme",
        "source_url": source.url,
        "source_content_hash": source.content_hash,
        "raw_document_id": source.raw_document_id,
        "provider_id": source.provider_id,
        "dataset_id": source.dataset_id,
        "acquisition_run_id": source.acquisition_run_id,
        "parser_id": source.parser_id,
        "parser_version": source.parser_version,
    }


def _metadata_mappings(spec: Mapping[str, Any]) -> tuple[Mapping[str, Any], ...]:
    raw = spec.get("metadata_mappings")
    if not isinstance(raw, (list, tuple)):
        return ()
    return tuple(item for item in raw if isinstance(item, Mapping))


def _extract_text_metadata(
    *,
    spec: Mapping[str, Any],
    text: str,
    source: ExtractionSource,
) -> tuple[dict[str, Any], ...]:
    """Extract values from declarative source-labelled regexes.

    A provider supplies the regex and named ``value`` group.  The parser only
    returns text that is present in the matched source snapshot; it does not
    infer status, cycle, or any other optional context.
    """
    observations: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for mapping in _metadata_mappings(spec):
        field = str(mapping.get("field") or "").strip()
        pattern = str(mapping.get("pattern") or "").strip()
        if not field or not pattern:
            continue
        try:
            match = re.search(pattern, text, re.IGNORECASE)
        except re.error:
            continue
        if not match:
            continue
        group_name = str(mapping.get("value_group") or "value")
        try:
            value = match.group(group_name)
        except (IndexError, KeyError):
            try:
                value = match.group(1)
            except IndexError:
                continue
        value = str(value or "").strip(" \t\r\n:;-|.,")
        if not _present(value):
            continue
        key = (field, value.casefold())
        if key in seen:
            continue
        seen.add(key)
        label = str(mapping.get("label") or field).strip()
        observations.append(
            _metadata_item(
                field=field,
                value=value,
                label=label,
                evidence=match.group(0).strip(),
                source=source,
                scope=str(mapping.get("scope") or spec.get("scope") or "programme"),
            )
        )
    return tuple(observations)


def _render_structured(
    *,
    spec: Mapping[str, Any],
    parsed: ParsedDocument,
    source: ExtractionSource,
    seed: Any,
    provider_id: str | None,
) -> FieldEvidenceMaterialization:
    identifiers = _provider_identifiers(
        seed,
        provider_id,
        getattr(source, "linked_programme_id", None),
    )
    identity_fields = _values(spec.get("identity_fields"))
    if not identity_fields:
        identity_fields = tuple(identifiers)
    matching: list[tuple[str | None, Mapping[str, Any], tuple[str, ...]]] = []
    for member_name, row in _structured_rows(
        parsed.structured_payload,
        record_path=spec.get("record_path"),
    ):
        matched, signals = _matches_row(row, identifiers, identity_fields)
        if matched:
            matching.append((member_name, row, signals))
    if not matching:
        return FieldEvidenceMaterialization(
            text=parsed.text,
            title=parsed.title,
            entity_match=False,
            reason="no_matching_structured_record",
        )

    mappings = spec.get("field_mappings")
    if not isinstance(mappings, (list, tuple)):
        mappings = ()
    lines = [
        "External structured record; values below are literal source columns.",
        f"Verified source scope: {str(spec.get('scope') or 'institution')}",
    ]
    temporal_context = str(spec.get("source_temporal_context") or "").strip()
    if temporal_context:
        lines.append(f"Source-native temporal context: {temporal_context}")
        if source.retrieved_at:
            lines.append(f"Raw snapshot retrieved at: {source.retrieved_at}")
    schema_context = str(spec.get("schema_context") or "").strip()
    rendered = 0
    signals: list[str] = []
    metadata: list[dict[str, Any]] = []
    seen_metadata: set[tuple[str, str]] = set()
    # JSON selection-criteria records often carry the programme title in a
    # source-native field while the JSON parser has no document title.  Keep
    # that verified identity in the bounded ExtractionSource title so the
    # existing programme-source validation can distinguish a matching
    # programme record from an unrelated overview.  The path is declarative;
    # no title is inferred when a provider does not supply one.
    title_column = str(spec.get("title_column") or "").strip()
    materialized_title = str(
        spec.get("title") or parsed.title or "External structured record"
    )
    metadata_maps = _metadata_mappings(spec)
    for member_name, row, row_signals in matching:
        if member_name:
            lines.append(f"Archive member: {member_name}")
        signals.extend(row_signals)
        if title_column and materialized_title == str(
            spec.get("title") or parsed.title or "External structured record"
        ):
            title_value = _row_value(row, title_column)
            if _present(title_value):
                literal_title = _literal(title_value)[:500]
                if literal_title:
                    materialized_title = f"{materialized_title}: {literal_title}"
        for field_map in mappings:
            if not isinstance(field_map, Mapping):
                continue
            column = str(field_map.get("column") or "").strip()
            row_value = _row_value(row, column)
            if not column or not _present(row_value):
                continue
            label = str(field_map.get("label") or field_map.get("field") or column)
            context: list[str] = []
            for key in ("currency", "basis", "audience", "cycle"):
                value = field_map.get(key)
                if _present(value):
                    context.append(f"{key}={value}")
            credential_column = str(
                field_map.get("credential_column") or ""
            ).strip()
            credential_context = ""
            credential_value = _row_value(row, credential_column)
            if credential_column and _present(credential_value):
                credential_label = str(
                    field_map.get("credential_label")
                    or credential_column
                ).strip()
                credential_context = (
                    f"{credential_label}={_literal(credential_value)} "
                    f"[source column {credential_column}]"
                )
            # Put a source-derived fee credential before the amount.  The
            # validator can then recover one exact bounded line even when a
            # model returns a truncated evidence fragment; no credential is
            # inferred and all values still come from the same matched row.
            label_prefix = (
                f"{label} ({credential_context})"
                if credential_context
                else label
            )
            raw_value = _literal(row_value)
            render_pattern = str(field_map.get("render_pattern") or "").strip()
            rendered_value = raw_value
            if render_pattern:
                try:
                    value_match = re.search(render_pattern, raw_value, re.IGNORECASE)
                except re.error:
                    value_match = None
                if value_match:
                    rendered_value = str(
                        value_match.groupdict().get("value")
                        or value_match.group(0)
                    ).strip()
            lines.append(f"{label_prefix}: {rendered_value} [source column {column}]"
                         + (f" ({'; '.join(context)})" if context else ""))
            rendered += 1
        for metadata_map in metadata_maps:
            field = str(metadata_map.get("field") or "").strip()
            column = str(metadata_map.get("column") or "").strip()
            row_value = _row_value(row, column)
            if not field or not column or not _present(row_value):
                continue
            label = str(metadata_map.get("label") or field).strip()
            value = _literal(row_value)
            key = (field, value.casefold())
            if key in seen_metadata:
                continue
            seen_metadata.add(key)
            evidence = f"{label}: {value} [source column {column}]"
            lines.append(evidence)
            metadata.append(
                _metadata_item(
                    field=field,
                    value=value,
                    label=label,
                    evidence=evidence,
                    source=source,
                    column=column,
                    scope=str(metadata_map.get("scope") or spec.get("scope") or "programme"),
                )
            )
    if schema_context:
        # Keep provider-declared mapping guidance beside the literal row, but
        # append it after mapped values.  The guidance constrains semantic
        # extraction; it is not source evidence.  Placing it after the row
        # also prevents the deterministic source-excerpt fallback from
        # mistaking a field name mentioned in guidance for a published fact.
        lines.append(f"Source mapping context: {schema_context}")
    # A matched structured record can intentionally expose only metadata (for
    # example an application-window snapshot where the boolean is false and
    # therefore is not rendered as an optional field).  Keep the bounded
    # materialized context in that case; falling back to the unbounded parser
    # text would re-introduce unrelated raw columns and can let semantic
    # extraction claim fields that the declarative provider mapping excluded.
    if not rendered and not metadata:
        return FieldEvidenceMaterialization(
            text=parsed.text,
            title=parsed.title,
            entity_match=True,
            matching_signals=tuple(dict.fromkeys(signals)),
            record_count=len(matching),
            reason="matched_record_without_mapped_values",
            metadata=tuple(metadata),
        )
    return FieldEvidenceMaterialization(
        text="\n".join(lines),
        title=materialized_title,
        entity_match=True,
        matching_signals=tuple(dict.fromkeys(signals)),
        record_count=len(matching),
        reason="structured_record_materialized",
        metadata=tuple(metadata),
    )


def _render_text_window(
    *,
    spec: Mapping[str, Any],
    parsed: ParsedDocument,
    source: ExtractionSource,
    seed: Any,
    provider_id: str | None,
) -> FieldEvidenceMaterialization:
    patterns = _values(spec.get("identity_patterns"))
    if not patterns:
        patterns = (str(getattr(seed, "name", "")).strip(),)
    patterns = tuple(
        formatted
        for pattern in patterns
        if (
            formatted := _format_identity_pattern(
                pattern,
                seed=seed,
                provider_id=provider_id,
                programme_id=getattr(source, "linked_programme_id", None),
            )
        )
    )
    patterns = tuple(pattern for pattern in patterns if pattern)
    if not patterns:
        return FieldEvidenceMaterialization(parsed.text, parsed.title, False, reason="missing_identity_pattern")
    text = parsed.text or ""
    match: re.Match[str] | None = None
    pattern_used = ""
    for pattern in patterns:
        literal = re.escape(pattern)
        match = re.search(literal, text, re.IGNORECASE)
        if match:
            pattern_used = pattern
            break
    if not match:
        return FieldEvidenceMaterialization(text, parsed.title, False, reason="identity_not_found_in_document")
    before = max(0, int(spec.get("context_before", 900) or 900))
    after = max(100, int(spec.get("context_after", 1200) or 1200))
    prefix = str(spec.get("schema_context") or "").strip()
    window = text[max(0, match.start() - before): min(len(text), match.end() + after)]
    lines = [
        "External source table row selected by exact institution-name match.",
        f"Verified source scope: {str(spec.get('scope') or 'institution')}",
    ]
    # Some HTML tables are flattened by the visible-text parser: the header is
    # far from an exact matched row, even though the values retain their source
    # order.  A provider may therefore declare its literal table columns and
    # positions.  This only labels source-native values; it neither creates a
    # value nor changes the source's configured scope.
    row_mappings = spec.get("row_value_mappings")
    if isinstance(row_mappings, (list, tuple)):
        row_text = text[match.start() : min(len(text), match.end() + after)]
        values = re.findall(r"\b\d[\d,.'’]*(?:\.\d+)?\b", row_text)
        for mapping in row_mappings:
            if not isinstance(mapping, Mapping):
                continue
            try:
                value_index = int(mapping.get("value_index"))
            except (TypeError, ValueError):
                continue
            if value_index < 0 or value_index >= len(values):
                continue
            label = str(mapping.get("label") or mapping.get("field") or "value").strip()
            if not label:
                continue
            context: list[str] = []
            for key in ("credential", "currency", "basis", "audience", "cycle"):
                value = mapping.get(key)
                if key == "cycle" and not _present(value):
                    value = source.academic_cycle
                if _present(value):
                    context.append(f"{key}={value}")
            lines.append(
                f"{label}: {values[value_index]} [literal matched-row value]"
                + (f" ({'; '.join(context)})" if context else "")
            )
    if prefix:
        lines.append(prefix)
    lines.append(window)
    metadata = _extract_text_metadata(spec=spec, text=text, source=source)
    for item in metadata:
        lines.insert(
            2,
            f"{item['label']}: {item['value']} [source metadata]",
        )
    return FieldEvidenceMaterialization(
        text="\n".join(lines),
        title=str(spec.get("title") or parsed.title or "External table row"),
        entity_match=True,
        matching_signals=(f"institution_name={pattern_used}",),
        record_count=1,
        reason="text_window_materialized",
        metadata=metadata,
    )


def materialize_external_field_evidence(
    *,
    parsed: ParsedDocument,
    source: ExtractionSource,
    candidate_metadata: Mapping[str, Any] | None,
    seed: Any,
) -> tuple[ExtractionSource, FieldEvidenceMaterialization]:
    """Return a source with bounded field-bearing context when configured.

    The original source locator, content hash, raw document identifier and all
    provider provenance remain unchanged.  ``external_entity_match`` means a
    configured, source-native identifier/name match occurred; it never turns
    an institution-scoped record into programme-scoped evidence.
    """
    spec = _field_evidence(candidate_metadata)
    kind = str(spec.get("kind") or "").casefold()
    if not kind:
        return source, FieldEvidenceMaterialization(source.text, source.title, False)
    if kind == "structured_rows":
        materialization = _render_structured(
            spec=spec,
            parsed=parsed,
            source=source,
            seed=seed,
            provider_id=source.provider_id,
        )
    elif kind == "text_window":
        materialization = _render_text_window(
            spec=spec,
            parsed=parsed,
            source=source,
            seed=seed,
            provider_id=source.provider_id,
        )
    else:
        return source, FieldEvidenceMaterialization(source.text, source.title, False, reason="unsupported_materializer")
    return ExtractionSource(
        **{
            **source.__dict__,
            "text": materialization.text,
            "title": materialization.title,
            "external_entity_match": materialization.entity_match,
            "external_entity_match_signals": materialization.matching_signals,
            "source_temporal_context": (
                str(spec.get("source_temporal_context") or "").strip() or None
            ),
            "external_metadata": materialization.metadata,
        }
    ), materialization


def external_metadata_for_programme(
    sources: Iterable[ExtractionSource],
) -> tuple[dict[str, Any], ...]:
    """Return deterministic metadata observations from matched sources.

    The first source-native value for a field is retained in source order;
    conflicting values are kept as separate observations so downstream code
    cannot silently pick a winner.  Callers may only project fields whose
    product semantics are explicit.
    """
    observations: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for source in sources:
        for item in getattr(source, "external_metadata", ()) or ():
            if not isinstance(item, Mapping):
                continue
            field = str(item.get("field_name") or "").strip()
            value = str(item.get("value") or "").strip()
            url = str(item.get("source_url") or source.url)
            if not field or not value:
                continue
            key = (field, value.casefold(), url)
            if key in seen:
                continue
            seen.add(key)
            observations.append(dict(item))
    return tuple(observations)


__all__ = [
    "FieldEvidenceMaterialization",
    "external_metadata_for_programme",
    "materialize_external_field_evidence",
]
