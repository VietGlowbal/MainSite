"""Versioned parser boundary for retained raw snapshots."""

from __future__ import annotations

import json
import csv
from fnmatch import fnmatchcase
import io
import hashlib
import zipfile
import xml.etree.ElementTree as ET
from pathlib import PurePosixPath
from typing import Any, Mapping, Protocol, runtime_checkable

from .models import ParsedDocument, RawDocument
from .parsing import normalize_text, parse_html, parse_pdf


class ParserError(RuntimeError):
    pass


@runtime_checkable
class DocumentParser(Protocol):
    parser_id: str
    parser_version: str

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool: ...

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument: ...


class HtmlDocumentParser:
    parser_id = "html-visible-text"
    parser_version = "1"

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        content_type = (raw_document.content_type or "").lower()
        return "html" in content_type or "xml" in content_type

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        page = parse_html(payload, raw_document.canonical_url, raw_document.content_type)
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=page.text,
            links=tuple(page.links),
            language=page.language,
            title=page.title,
        )


class PdfDocumentParser:
    parser_id = "pdf-text"
    parser_version = "1"

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        return "pdf" in (raw_document.content_type or "").lower() or payload.startswith(
            b"%PDF"
        )

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        page = parse_pdf(payload, raw_document.canonical_url)
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=page.text,
            links=tuple(page.links),
            language=page.language,
            title=page.title,
        )


class JsonDocumentParser:
    parser_id = "json-structured"
    parser_version = "1"

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        return "json" in (raw_document.content_type or "").lower()

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        try:
            structured = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ParserError("Raw JSON payload is invalid.") from exc
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(json.dumps(structured, ensure_ascii=False, sort_keys=True)),
            structured_payload=structured,
        )

    def parse_stream(
        self,
        raw_document: RawDocument,
        payload_stream: Any,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        """Parse a bounded JSON object directly from durable storage.

        CKAN/registry responses are small structured records, but production
        raw evidence is still exposed through the seekable object-store stream
        boundary.  Reading a bounded JSON response here avoids forcing the
        pipeline to fall back to a local raw copy while keeping a hard safety
        limit for malformed or unexpectedly large responses.
        """
        options = parser_options if isinstance(parser_options, Mapping) else {}
        try:
            configured = int(options.get("max_bytes") or 8 * 1024 * 1024)
        except (TypeError, ValueError):
            configured = 8 * 1024 * 1024
        max_bytes = max(1, min(configured, 8 * 1024 * 1024))
        pieces: list[bytes] = []
        total = 0
        try:
            payload_stream.seek(0)
            while True:
                chunk = payload_stream.read(min(64 * 1024, max_bytes - total + 1))
                if not chunk:
                    break
                data = bytes(chunk)
                total += len(data)
                if total > max_bytes:
                    raise ParserError("Raw JSON payload exceeds the streaming safety limit.")
                pieces.append(data)
        except (OSError, ValueError) as exc:
            raise ParserError("Could not read the streamed JSON payload.") from exc
        return self.parse(raw_document, b"".join(pieces))


class CsvDocumentParser:
    """Deterministic parser for retained CSV/TSV dataset payloads."""

    parser_id = "csv-structured"
    parser_version = "3"
    default_sample_rows = 100
    default_max_rows = 5_000
    default_max_scan_rows = 1_000_000
    default_max_scan_bytes = 512 * 1024 * 1024
    # A megabyte keeps remote range-request overhead bounded for large public
    # CSV exports while still limiting parser memory to a small fixed buffer.
    default_chunk_size = 1024 * 1024

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        content_type = (raw_document.content_type or "").lower()
        locator = raw_document.canonical_url.lower()
        return "csv" in content_type or locator.endswith((".csv", ".tsv"))

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        text = payload.decode("utf-8-sig", errors="replace")
        delimiter = self._delimiter(raw_document, text[: 128 * 1024])
        try:
            rows = list(csv.DictReader(io.StringIO(text), delimiter=delimiter))
        except csv.Error as exc:
            raise ParserError("Raw CSV payload is invalid.") from exc
        normalized_rows = [
            {str(key or "").strip(): value for key, value in row.items()}
            for row in rows
        ]
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(text),
            structured_payload=normalized_rows,
        )

    @staticmethod
    def _delimiter(raw_document: RawDocument, sample: str) -> str:
        """Choose a delimiter from a bounded decoded prefix.

        ``Onisep`` publishes a semicolon-delimited UTF-8 CSV while many other
        providers use commas.  Sniffing only the prefix keeps this decision
        bounded and, because it is handed to ``csv`` rather than split by
        hand, preserves quoted and multiline values.
        """
        delimiter = "\t" if raw_document.canonical_url.lower().split("?", 1)[0].endswith(".tsv") else ","
        if delimiter == ",":
            try:
                delimiter = csv.Sniffer().sniff(
                    sample, delimiters=",;|\t"
                ).delimiter
            except csv.Error:
                delimiter = ","
        return delimiter

    @staticmethod
    def _normalise_csv_row(row: Mapping[Any, Any]) -> dict[str, Any]:
        return {
            str(key or "").strip(): value
            for key, value in row.items()
            if str(key or "").strip()
        }

    @staticmethod
    def _bounded_int(
        value: Any,
        *,
        default: int,
        maximum: int,
    ) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = default
        return max(1, min(parsed, maximum))

    @classmethod
    def _stream_options(
        cls, parser_options: Mapping[str, Any] | None
    ) -> dict[str, Any]:
        options = parser_options if isinstance(parser_options, Mapping) else {}
        structured = options.get("structured_archive")
        structured = structured if isinstance(structured, Mapping) else {}
        evidence = options.get("field_evidence")
        evidence = evidence if isinstance(evidence, Mapping) else {}

        raw_targets = (
            structured.get("target_identifiers")
            or structured.get("targets")
            or options.get("target_identifiers")
            or {}
        )
        target_identifiers: dict[str, tuple[str, ...]] = {}
        if isinstance(raw_targets, Mapping):
            for key, value in raw_targets.items():
                values = value if isinstance(value, (list, tuple, set, frozenset)) else (value,)
                cleaned = tuple(
                    str(item).strip().casefold()
                    for item in values
                    if item is not None and str(item).strip()
                )
                if str(key).strip() and cleaned:
                    target_identifiers[str(key).strip()] = cleaned

        raw_fields = (
            structured.get("identifier_fields")
            or structured.get("identifier_columns")
            or evidence.get("identity_fields")
            or tuple(target_identifiers)
        )
        identifier_fields = tuple(
            str(item).strip()
            for item in (
                raw_fields
                if isinstance(raw_fields, (list, tuple, set, frozenset))
                else (raw_fields,)
            )
            if item is not None and str(item).strip()
        )
        configured_mode = structured.get("match_mode") or options.get("match_mode")
        # Multiple configured identity columns represent one compound source
        # identity (for example Onisep UAI + AF).  Requiring all of them avoids
        # retaining the first institution row when the programme identifier is
        # the decisive part of the match.
        match_mode = str(configured_mode or ("all" if len(target_identifiers) > 1 else "any")).casefold()
        if match_mode not in {"all", "any"}:
            match_mode = "any"
        configured_max_bytes = options.get("max_bytes") or structured.get("max_bytes")
        max_bytes = cls._bounded_int(
            configured_max_bytes,
            default=cls.default_max_scan_bytes,
            maximum=cls.default_max_scan_bytes,
        )
        configured_scan_bytes = structured.get("max_scan_bytes") or options.get("max_scan_bytes")
        max_scan_bytes = cls._bounded_int(
            configured_scan_bytes,
            default=max_bytes,
            maximum=max_bytes,
        )
        return {
            "target_identifiers": target_identifiers,
            "identifier_fields": identifier_fields,
            "match_mode": match_mode,
            "max_bytes": max_bytes,
            "max_scan_bytes": max_scan_bytes,
            "max_rows": cls._bounded_int(
                structured.get("max_rows") or options.get("max_rows"),
                default=cls.default_max_rows,
                maximum=100_000,
            ),
            "sample_rows": cls._bounded_int(
                structured.get("sample_rows") or options.get("sample_rows"),
                default=cls.default_sample_rows,
                maximum=100_000,
            ),
            "max_scan_rows": cls._bounded_int(
                structured.get("max_scan_rows") or options.get("max_scan_rows"),
                default=cls.default_max_scan_rows,
                maximum=5_000_000,
            ),
            "chunk_size": cls._bounded_int(
                structured.get("chunk_size") or options.get("chunk_size"),
                default=cls.default_chunk_size,
                maximum=4 * 1024 * 1024,
            ),
        }

    class _BoundedReader(io.RawIOBase):
        """Read-through byte bound used by the streaming CSV parser."""

        def __init__(self, wrapped: Any, *, max_bytes: int, chunk_size: int) -> None:
            self.wrapped = wrapped
            self.max_bytes = max(1, int(max_bytes))
            self.chunk_size = max(1, int(chunk_size))
            self.bytes_read = 0
            self._bytes_fetched = 0
            self._pending = b""

        def readable(self) -> bool:
            return True

        def read(self, size: int = -1) -> bytes:
            requested = self.chunk_size if size is None or size < 0 else min(int(size), self.chunk_size)
            if requested <= 0:
                return b""
            if not self._pending and self._bytes_fetched < self.max_bytes:
                remaining = self.max_bytes - self._bytes_fetched
                # ``TextIOWrapper`` commonly asks a raw stream for 8 KiB at a
                # time.  Prefetch one bounded range into this small pending
                # buffer so those short reads do not turn a 30 MiB CSV into
                # thousands of remote range requests.
                data = self.wrapped.read(min(max(requested, self.chunk_size), remaining))
                if data:
                    data = bytes(data)
                    if len(data) > remaining:
                        data = data[:remaining]
                    self._bytes_fetched += len(data)
                    self._pending = data
            if not self._pending:
                return b""
            data = self._pending[:requested]
            self._pending = self._pending[len(data):]
            self.bytes_read += len(data)
            return data

        def readinto(self, buffer: Any) -> int:
            data = self.read(min(len(buffer), self.chunk_size))
            if not data:
                return 0
            buffer[: len(data)] = data
            return len(data)

        def close(self) -> None:
            # The pipeline owns the durable stream and closes it after parser
            # dispatch.  Do not close it when TextIOWrapper is torn down.
            return None

    @staticmethod
    def _read_prefix(payload_stream: Any, limit: int) -> bytes:
        """Read a bounded prefix even when the underlying stream short-reads."""
        pieces: list[bytes] = []
        total = 0
        while total < limit:
            chunk = payload_stream.read(min(64 * 1024, limit - total))
            if not chunk:
                break
            data = bytes(chunk)
            pieces.append(data)
            total += len(data)
        return b"".join(pieces)

    def parse_stream(
        self,
        raw_document: RawDocument,
        payload_stream: Any,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        """Parse a CSV/TSV directly from a bounded durable object stream.

        The parser retains only matched rows (or a small sample when no target
        identifiers are configured).  ``csv.DictReader`` performs the actual
        record framing, so quoted delimiters and multiline fields remain
        correct even when the object-store reader splits bytes at arbitrary
        chunk boundaries.
        """
        if not getattr(payload_stream, "seekable", lambda: False)():
            raise ParserError("Streaming CSV parser requires a seekable object stream.")
        options = self._stream_options(parser_options)
        chunk_size = int(options["chunk_size"])
        try:
            payload_stream.seek(0)
            prefix = self._read_prefix(
                payload_stream,
                min(128 * 1024, int(options["max_bytes"])),
            )
            payload_stream.seek(0)
        except (OSError, ValueError) as exc:
            raise ParserError("Could not inspect the streamed CSV payload.") from exc
        try:
            sample = bytes(prefix).decode("utf-8-sig", errors="replace")
            delimiter = self._delimiter(raw_document, sample)
            bounded = self._BoundedReader(
                payload_stream,
                max_bytes=int(options["max_scan_bytes"]),
                chunk_size=chunk_size,
            )
            buffered = io.BufferedReader(bounded, buffer_size=chunk_size)
            rows: list[dict[str, Any]] = []
            targets = options["target_identifiers"]
            target_keys = {
                (str(field).casefold(), value)
                for field, values in targets.items()
                for value in values
            }
            retain_limit = int(options["max_rows"] if target_keys else options["sample_rows"])
            rows_scanned = 0
            matched_keys: set[tuple[str, str]] = set()
            bounded_reason = "end_of_stream"
            with io.TextIOWrapper(
                buffered,
                encoding="utf-8-sig",
                errors="replace",
                newline="",
            ) as text_handle:
                reader = csv.DictReader(text_handle, delimiter=delimiter)
                for raw_row in reader:
                    rows_scanned += 1
                    row = self._normalise_csv_row(raw_row)
                    row_values = {
                        key.casefold(): str(value or "").strip().casefold()
                        for key, value in row.items()
                    }
                    row_matches = {
                        (field, value)
                        for field, value in target_keys
                        if row_values.get(field) == value
                    }
                    if target_keys:
                        matched_keys.update(row_matches)
                        retain_row = (
                            target_keys.issubset(row_matches)
                            if options["match_mode"] == "all"
                            else bool(row_matches)
                        )
                    else:
                        retain_row = True
                    if retain_row and len(rows) < retain_limit:
                        rows.append(row)
                    if target_keys and matched_keys >= target_keys:
                        bounded_reason = "target_identifiers_satisfied"
                        break
                    if len(rows) >= retain_limit:
                        bounded_reason = "max_rows" if target_keys else "sample_rows"
                        break
                    if rows_scanned >= int(options["max_scan_rows"]):
                        bounded_reason = "max_scan_rows"
                        break
                    # A bounded reader may prefetch bytes belonging to several
                    # subsequent rows.  Do not stop merely because the bound
                    # has been fetched: csv still needs to yield those rows so
                    # a target at the end of the buffered chunk is retained.
            text = normalize_text(
                json.dumps(rows, ensure_ascii=False, sort_keys=True)
            )
            return ParsedDocument(
                raw_document_id=raw_document.raw_document_id,
                parser_id=self.parser_id,
                parser_version=self.parser_version,
                text=text,
                structured_payload=rows,
            )
        except csv.Error as exc:
            raise ParserError("Raw CSV payload is invalid.") from exc


def _xml_to_value(element: ET.Element) -> Any:
    """Convert a bounded XML tree into JSON-safe values.

    XML from public registries is retained as structured data only after the
    normal raw boundary.  Attributes and repeated children are represented
    explicitly so no provider-specific assertion semantics are introduced.
    """
    children = list(element)
    attributes = {
        str(key): str(value)
        for key, value in element.attrib.items()
        if str(key)
    }
    text = normalize_text(element.text or "")
    if not children:
        if attributes and text:
            return {"@attributes": attributes, "#text": text}
        if attributes:
            return {"@attributes": attributes}
        return text
    values: dict[str, Any] = {}
    for child in children:
        key = str(child.tag)
        value = _xml_to_value(child)
        if key in values:
            values[key] = values[key] if isinstance(values[key], list) else [values[key]]
            values[key].append(value)
        else:
            values[key] = value
    if attributes:
        values["@attributes"] = attributes
    if text:
        values["#text"] = text
    return values


class XmlDocumentParser:
    """Deterministic parser for XML registry and catalogue resources."""

    parser_id = "xml-structured"
    parser_version = "1"

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        content_type = (raw_document.content_type or "").lower()
        if payload.lstrip().startswith(b"<?xml") or "xml" in content_type:
            return True
        locator = raw_document.canonical_url.lower()
        if content_type and content_type not in {
            "application/octet-stream",
            "binary/octet-stream",
            "application/x-download",
        }:
            return False
        return locator.split("?", 1)[0].endswith(".xml")

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        try:
            root = ET.fromstring(payload)
        except (UnicodeDecodeError, ET.ParseError) as exc:
            raise ParserError("Raw XML payload is invalid.") from exc
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(" ".join(root.itertext())),
            structured_payload={str(root.tag): _xml_to_value(root)},
            title=str(root.tag),
        )


class ZipDocumentParser:
    """Safely inspect ZIP datasets and parse supported text members.

    The archive itself remains the retained raw evidence.  This parser only
    exposes bounded member metadata and JSON/CSV/XML values for deterministic
    reprocessing; it rejects path traversal and decompression bombs.
    """

    parser_id = "zip-structured"
    parser_version = "1"
    max_members = 100
    max_member_bytes = 64 * 1024 * 1024
    max_uncompressed_bytes = 128 * 1024 * 1024
    # Large government datasets are admitted only when the provider identifies
    # the expected structured member.  These limits are deliberately separate
    # from the ordinary member/archive limits above: a large member is streamed
    # and row-bounded, never read into memory as one payload.
    max_structured_member_bytes = 512 * 1024 * 1024
    max_structured_archive_bytes = 512 * 1024 * 1024
    default_sample_rows = 100
    default_max_rows = 5_000
    default_max_scan_rows = 1_000_000
    default_chunk_size = 64 * 1024

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        content_type = (raw_document.content_type or "").lower()
        if payload.startswith(b"PK\x03\x04") or "zip" in content_type:
            return True
        # A few servers omit the ZIP content type, so the locator is useful
        # only when the response did not explicitly identify another format.
        if content_type and content_type not in {
            "application/octet-stream",
            "binary/octet-stream",
            "application/x-download",
        }:
            return False
        return raw_document.canonical_url.lower().split("?", 1)[0].endswith(".zip")

    @staticmethod
    def _member_path_is_safe(name: str) -> bool:
        path = PurePosixPath(name.replace("\\", "/"))
        return not path.is_absolute() and ".." not in path.parts

    @staticmethod
    def _parse_member(name: str, payload: bytes) -> Any:
        suffix = PurePosixPath(name).suffix.casefold()
        if suffix == ".json":
            try:
                return json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ParserError(f"ZIP member {name} contains invalid JSON.") from exc
        if suffix in {".csv", ".tsv"}:
            delimiter = "\t" if suffix == ".tsv" else ","
            text = payload.decode("utf-8-sig", errors="replace")
            try:
                return [
                    {str(key or "").strip(): value for key, value in row.items()}
                    for row in csv.DictReader(io.StringIO(text), delimiter=delimiter)
                ]
            except csv.Error as exc:
                raise ParserError(f"ZIP member {name} contains invalid CSV.") from exc
        if suffix == ".xml":
            try:
                root = ET.fromstring(payload)
            except (UnicodeDecodeError, ET.ParseError) as exc:
                raise ParserError(f"ZIP member {name} contains invalid XML.") from exc
            return {str(root.tag): _xml_to_value(root)}
        return None

    @staticmethod
    def _as_text_values(value: Any) -> tuple[str, ...]:
        if isinstance(value, str):
            values = (value,)
        elif isinstance(value, (list, tuple, set, frozenset)):
            values = tuple(value)
        elif value is None:
            values = ()
        else:
            values = (value,)
        return tuple(
            str(item).strip()
            for item in values
            if str(item).strip()
        )

    @classmethod
    def _bounded_int(
        cls,
        value: Any,
        *,
        default: int,
        maximum: int,
    ) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = default
        return max(1, min(parsed, maximum))

    @classmethod
    def _structured_options(
        cls, parser_options: Mapping[str, Any] | None
    ) -> dict[str, Any] | None:
        if not isinstance(parser_options, Mapping):
            return None
        raw = parser_options.get("structured_archive")
        if not isinstance(raw, Mapping):
            return None
        patterns = cls._as_text_values(
            raw.get("member_patterns")
            or raw.get("member_names")
            or raw.get("expected_members")
        )
        if not patterns:
            return None
        target_identifiers_raw = raw.get("target_identifiers") or raw.get("targets") or {}
        target_identifiers: dict[str, tuple[str, ...]] = {}
        if isinstance(target_identifiers_raw, Mapping):
            target_identifiers = {
                str(key).strip(): tuple(
                    item.casefold()
                    for item in cls._as_text_values(value)
                )
                for key, value in target_identifiers_raw.items()
                if str(key).strip() and cls._as_text_values(value)
            }
        identifier_mapping = parser_options.get("identifier_mapping")
        if isinstance(identifier_mapping, Mapping) and target_identifiers:
            # A caller may identify targets using canonical names while the
            # archive header uses provider names (for example UNITID).
            mapped: dict[str, tuple[str, ...]] = dict(target_identifiers)
            for source_name, canonical_name in identifier_mapping.items():
                canonical = str(canonical_name).strip()
                if canonical in target_identifiers and str(source_name).strip():
                    mapped.setdefault(str(source_name).strip(), target_identifiers[canonical])
            target_identifiers = mapped
        identifier_fields = cls._as_text_values(
            raw.get("identifier_fields")
            or raw.get("identifier_columns")
            or tuple(target_identifiers)
        )
        if not identifier_fields and isinstance(identifier_mapping, Mapping):
            identifier_fields = cls._as_text_values(identifier_mapping.keys())
        return {
            "member_patterns": tuple(pattern.casefold() for pattern in patterns),
            "target_identifiers": target_identifiers,
            "identifier_fields": tuple(identifier_fields),
            "match_mode": str(raw.get("match_mode") or "any").casefold(),
            "max_member_bytes": cls._bounded_int(
                raw.get("max_member_bytes"),
                default=cls.max_structured_member_bytes,
                maximum=cls.max_structured_member_bytes,
            ),
            "max_archive_bytes": cls._bounded_int(
                raw.get("max_archive_bytes"),
                default=cls.max_structured_archive_bytes,
                maximum=cls.max_structured_archive_bytes,
            ),
            "max_rows": cls._bounded_int(
                raw.get("max_rows"),
                default=cls.default_max_rows,
                maximum=100_000,
            ),
            "sample_rows": cls._bounded_int(
                raw.get("sample_rows"),
                default=cls.default_sample_rows,
                maximum=100_000,
            ),
            "max_scan_rows": cls._bounded_int(
                raw.get("max_scan_rows"),
                default=cls.default_max_scan_rows,
                maximum=5_000_000,
            ),
            "max_scan_bytes": cls._bounded_int(
                raw.get("max_scan_bytes"),
                default=cls.max_structured_member_bytes,
                maximum=cls.max_structured_member_bytes,
            ),
            "chunk_size": cls._bounded_int(
                raw.get("chunk_size"),
                default=cls.default_chunk_size,
                maximum=4 * 1024 * 1024,
            ),
        }

    @staticmethod
    def _member_matches(filename: str, patterns: tuple[str, ...]) -> bool:
        value = filename.casefold()
        basename = PurePosixPath(filename).name.casefold()
        return any(
            fnmatchcase(value, pattern) or fnmatchcase(basename, pattern)
            for pattern in patterns
        )

    class _CountingReader(io.RawIOBase):
        """Bounded read-through wrapper for a ``ZipExtFile`` member."""

        def __init__(self, wrapped: Any, chunk_size: int) -> None:
            self.wrapped = wrapped
            self.chunk_size = max(1, int(chunk_size))
            self.bytes_read = 0

        def readable(self) -> bool:
            return True

        def read(self, size: int = -1) -> bytes:
            requested = self.chunk_size if size is None or size < 0 else min(size, self.chunk_size)
            data = self.wrapped.read(requested)
            if data:
                self.bytes_read += len(data)
            return data

        def readinto(self, buffer: Any) -> int:
            data = self.wrapped.read(min(len(buffer), self.chunk_size))
            if not data:
                return 0
            size = len(data)
            buffer[:size] = data
            self.bytes_read += size
            return size

        def close(self) -> None:
            # The owning ``with archive.open(...)`` block closes the ZIP member.
            # Keeping this wrapper open avoids closing it before the caller has
            # recorded the bounded byte count.
            return None

    @staticmethod
    def _normalise_csv_row(row: Mapping[Any, Any]) -> dict[str, Any]:
        return {
            str(key or "").strip(): value
            for key, value in row.items()
            if str(key or "").strip()
        }

    def _stream_csv_member(
        self,
        archive: zipfile.ZipFile,
        info: zipfile.ZipInfo,
        raw_document: RawDocument,
        options: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Read a selected CSV member incrementally and return bounded rows."""
        suffix = PurePosixPath(info.filename).suffix.casefold()
        if suffix not in {".csv", ".tsv"}:
            raise ParserError(
                f"Configured large ZIP member {info.filename} is not CSV/TSV."
            )
        delimiter = "\t" if suffix == ".tsv" else ","
        targets = options.get("target_identifiers") or {}
        target_keys = {
            (str(field).casefold(), value.casefold())
            for field, values in targets.items()
            for value in values
        }
        match_mode = str(options.get("match_mode") or "any").casefold()
        max_rows = int(options["max_rows"])
        sample_rows = int(options["sample_rows"])
        max_scan_rows = int(options["max_scan_rows"])
        max_scan_bytes = int(options["max_scan_bytes"])
        retain_limit = max_rows if target_keys else sample_rows
        rows: list[dict[str, Any]] = []
        rows_scanned = 0
        matched_keys: set[tuple[str, str]] = set()
        bounded_reason = "end_of_member"
        bytes_scanned: int | None = None
        with archive.open(info, "r") as member_handle:
            counter = self._CountingReader(member_handle, int(options["chunk_size"]))
            buffered = io.BufferedReader(counter, buffer_size=int(options["chunk_size"]))
            with io.TextIOWrapper(
                buffered,
                encoding="utf-8-sig",
                errors="replace",
                newline="",
            ) as text_handle:
                try:
                    reader = csv.DictReader(text_handle, delimiter=delimiter)
                    for raw_row in reader:
                        rows_scanned += 1
                        row = self._normalise_csv_row(raw_row)
                        row_values = {
                            key.casefold(): str(value or "").strip().casefold()
                            for key, value in row.items()
                        }
                        row_matches = {
                            (field, value)
                            for field, value in target_keys
                            if row_values.get(field) == value
                        }
                        if target_keys:
                            matched_keys.update(row_matches)
                            if match_mode == "all" and target_keys:
                                retain_row = target_keys.issubset(row_matches)
                            else:
                                retain_row = bool(row_matches)
                        else:
                            retain_row = True
                        if retain_row and len(rows) < retain_limit:
                            rows.append(row)
                        bytes_scanned = counter.bytes_read
                        if target_keys and matched_keys >= target_keys:
                            bounded_reason = "target_identifiers_satisfied"
                            break
                        if len(rows) >= retain_limit:
                            bounded_reason = (
                                "max_rows" if target_keys else "sample_rows"
                            )
                            break
                        if rows_scanned >= max_scan_rows:
                            bounded_reason = "max_scan_rows"
                            break
                        if bytes_scanned is not None and bytes_scanned >= max_scan_bytes:
                            bounded_reason = "max_scan_bytes"
                            break
                except csv.Error as exc:
                    raise ParserError(
                        f"ZIP member {info.filename} contains invalid CSV."
                    ) from exc
            bytes_scanned = counter.bytes_read
        partial = bounded_reason != "end_of_member" or bool(target_keys)
        digest_note = None
        if not partial and bytes_scanned is not None and bytes_scanned >= info.file_size:
            # The full member was consumed, but hashing the member would require
            # a second pass. The immutable ZIP hash remains the authoritative
            # content identity for this derived resource.
            digest_note = "full_member_consumed"
        lineage = {
            "raw_document_id": raw_document.raw_document_id,
            "raw_object_key": raw_document.payload_reference,
            "raw_content_hash": raw_document.content_hash,
            "provider_id": raw_document.provider_id,
            "dataset_id": raw_document.dataset_id,
            "zip_locator": raw_document.canonical_url,
            "zip_content_hash": raw_document.content_hash,
            "archive_member_name": info.filename,
            "academic_cycle": raw_document.academic_cycle,
            "acquisition_run_id": raw_document.acquisition_run_id,
        }
        return {
            "name": info.filename,
            "member_name": info.filename,
            "size": info.file_size,
            "compressed_size": info.compress_size,
            "content_hash": None,
            "structured": rows,
            "rows_scanned": rows_scanned,
            "rows_retained": len(rows),
            "partial": partial,
            "bounded_reason": bounded_reason,
            "bytes_scanned": bytes_scanned,
            "member_hash_note": digest_note,
            "lineage": lineage,
        }

    def _parse_legacy(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        try:
            archive = zipfile.ZipFile(io.BytesIO(payload))
        except (OSError, zipfile.BadZipFile) as exc:
            raise ParserError("Raw ZIP payload is invalid.") from exc
        with archive:
            infos = [info for info in archive.infolist() if not info.is_dir()]
            if len(infos) > self.max_members:
                raise ParserError("ZIP dataset contains too many members.")
            total = 0
            members: list[dict[str, Any]] = []
            text_parts: list[str] = []
            for info in infos:
                if not self._member_path_is_safe(info.filename):
                    raise ParserError("ZIP dataset contains an unsafe member path.")
                if info.file_size > self.max_member_bytes:
                    raise ParserError("ZIP member exceeds the safety limit.")
                total += info.file_size
                if total > self.max_uncompressed_bytes:
                    raise ParserError("ZIP dataset exceeds the uncompressed safety limit.")
                with archive.open(info, "r") as member_handle:
                    member_payload = member_handle.read(self.max_member_bytes + 1)
                if len(member_payload) > self.max_member_bytes:
                    raise ParserError("ZIP member exceeds the safety limit.")
                parsed = self._parse_member(info.filename, member_payload)
                row: dict[str, Any] = {
                    "name": info.filename,
                    "size": info.file_size,
                    "content_hash": hashlib.sha256(member_payload).hexdigest(),
                }
                if parsed is not None:
                    row["structured"] = parsed
                    if isinstance(parsed, (dict, list)):
                        text_parts.append(json.dumps(parsed, ensure_ascii=False, sort_keys=True))
                else:
                    try:
                        text_parts.append(member_payload.decode("utf-8", errors="replace"))
                    except Exception:
                        pass
                members.append(row)
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(" ".join([item["name"] for item in members] + text_parts)),
            structured_payload={"members": members},
        )

    def parse_with_options(
        self,
        raw_document: RawDocument,
        payload: bytes,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        options = self._structured_options(parser_options)
        if options is None:
            return self._parse_legacy(raw_document, payload)
        try:
            archive = zipfile.ZipFile(io.BytesIO(payload))
        except (OSError, zipfile.BadZipFile) as exc:
            raise ParserError("Raw ZIP payload is invalid.") from exc
        with archive:
            infos = [info for info in archive.infolist() if not info.is_dir()]
            if len(infos) > self.max_members:
                raise ParserError("ZIP dataset contains too many members.")
            selected = {
                info.filename
                for info in infos
                if self._member_matches(info.filename, options["member_patterns"])
            }
            if not selected:
                raise ParserError("Configured structured ZIP member was not found.")
            ordinary_total = 0
            structured_total = 0
            members: list[dict[str, Any]] = []
            text_parts: list[str] = []
            for info in infos:
                if not self._member_path_is_safe(info.filename):
                    raise ParserError("ZIP dataset contains an unsafe member path.")
                if info.filename in selected:
                    if info.file_size > int(options["max_member_bytes"]):
                        raise ParserError(
                            "Configured structured ZIP member exceeds its dedicated safety limit."
                        )
                    structured_total += info.file_size
                    if structured_total > int(options["max_archive_bytes"]):
                        raise ParserError(
                            "Configured structured ZIP members exceed their dedicated archive limit."
                        )
                    member = self._stream_csv_member(
                        archive,
                        info,
                        raw_document,
                        options,
                    )
                    members.append(member)
                    text_parts.append(
                        json.dumps(member["structured"], ensure_ascii=False, sort_keys=True)
                    )
                    continue
                if info.file_size > self.max_member_bytes:
                    raise ParserError("ZIP member exceeds the safety limit.")
                ordinary_total += info.file_size
                if ordinary_total > self.max_uncompressed_bytes:
                    raise ParserError("ZIP dataset exceeds the uncompressed safety limit.")
                with archive.open(info, "r") as member_handle:
                    member_payload = member_handle.read(self.max_member_bytes + 1)
                if len(member_payload) > self.max_member_bytes:
                    raise ParserError("ZIP member exceeds the safety limit.")
                parsed = self._parse_member(info.filename, member_payload)
                row: dict[str, Any] = {
                    "name": info.filename,
                    "size": info.file_size,
                    "content_hash": hashlib.sha256(member_payload).hexdigest(),
                }
                if parsed is not None:
                    row["structured"] = parsed
                    if isinstance(parsed, (dict, list)):
                        text_parts.append(json.dumps(parsed, ensure_ascii=False, sort_keys=True))
                else:
                    text_parts.append(member_payload.decode("utf-8", errors="replace"))
                members.append(row)
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(" ".join([item["name"] for item in members] + text_parts)),
            structured_payload={"members": members},
        )

    def parse_stream(
        self,
        raw_document: RawDocument,
        payload_stream: Any,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        """Parse a configured ZIP from a seekable remote/object stream.

        ``zipfile`` needs random access to the central directory.  The stream
        supplied here is a bounded range reader over durable object storage;
        it is never a local copy of the archive.
        """
        options = self._structured_options(parser_options)
        if options is None:
            raise ParserError(
                "Streaming ZIP parsing requires configured structured members."
            )
        if not getattr(payload_stream, "seekable", lambda: False)():
            raise ParserError("Streaming ZIP parser requires a seekable object stream.")
        try:
            payload_stream.seek(0)
            archive = zipfile.ZipFile(payload_stream)
        except (OSError, zipfile.BadZipFile) as exc:
            raise ParserError("Raw ZIP payload is invalid.") from exc
        with archive:
            infos = [info for info in archive.infolist() if not info.is_dir()]
            if len(infos) > self.max_members:
                raise ParserError("ZIP dataset contains too many members.")
            selected = {
                info.filename
                for info in infos
                if self._member_matches(info.filename, options["member_patterns"])
            }
            if not selected:
                raise ParserError("Configured structured ZIP member was not found.")
            structured_total = 0
            members: list[dict[str, Any]] = []
            text_parts: list[str] = []
            for info in infos:
                if not self._member_path_is_safe(info.filename):
                    raise ParserError("ZIP dataset contains an unsafe member path.")
                if info.filename in selected:
                    if info.file_size > int(options["max_member_bytes"]):
                        raise ParserError(
                            "Configured structured ZIP member exceeds its dedicated safety limit."
                        )
                    structured_total += info.file_size
                    if structured_total > int(options["max_archive_bytes"]):
                        raise ParserError(
                            "Configured structured ZIP members exceed their dedicated archive limit."
                        )
                    member = self._stream_csv_member(
                        archive,
                        info,
                        raw_document,
                        options,
                    )
                    members.append(member)
                    text_parts.append(
                        json.dumps(member["structured"], ensure_ascii=False, sort_keys=True)
                    )
                    continue
                # Heavy streaming mode intentionally does not decompress
                # unrelated members. The selected structured member is the
                # only payload needed for the bounded result; retaining
                # metadata for other entries keeps the ZIP lineage visible
                # without creating a local copy or tripping the ordinary
                # in-memory member limit on another large CSV.
                members.append({
                    "name": info.filename,
                    "member_name": info.filename,
                    "size": info.file_size,
                    "compressed_size": info.compress_size,
                    "skipped": True,
                    "skip_reason": "not_selected",
                })
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(" ".join([item["name"] for item in members] + text_parts)),
            structured_payload={"members": members},
        )

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        return self.parse_with_options(raw_document, payload, None)


class PlainTextDocumentParser:
    parser_id = "plain-text"
    parser_version = "1"

    def supports(self, raw_document: RawDocument, payload: bytes) -> bool:
        return True

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        return ParsedDocument(
            raw_document_id=raw_document.raw_document_id,
            parser_id=self.parser_id,
            parser_version=self.parser_version,
            text=normalize_text(payload.decode("utf-8", errors="replace")),
        )


class ParserRegistry:
    def __init__(self, parsers: tuple[DocumentParser, ...]) -> None:
        if not parsers:
            raise ValueError("Parser registry requires at least one parser.")
        self._parsers = parsers

    @classmethod
    def default(cls) -> "ParserRegistry":
        # PDF must precede HTML in case an incorrect response header is served.
        return cls(
            (
                PdfDocumentParser(),
                ZipDocumentParser(),
                JsonDocumentParser(),
                CsvDocumentParser(),
                XmlDocumentParser(),
                HtmlDocumentParser(),
                PlainTextDocumentParser(),
            )
        )

    def select(self, raw_document: RawDocument, payload: bytes) -> DocumentParser:
        for parser in self._parsers:
            if parser.supports(raw_document, payload):
                return parser
        raise ParserError("No parser supports the retained raw document.")

    def parse(
        self,
        raw_document: RawDocument,
        payload: bytes,
        *,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        parser = self.select(raw_document, payload)
        parse_with_options = getattr(parser, "parse_with_options", None)
        if parser_options is not None and callable(parse_with_options):
            return parse_with_options(raw_document, payload, parser_options)
        return parser.parse(raw_document, payload)

    def parse_stream(
        self,
        raw_document: RawDocument,
        payload_stream: Any,
        *,
        parser_options: Mapping[str, Any] | None = None,
    ) -> ParsedDocument:
        """Dispatch a parser without converting a heavy object to bytes."""
        if not getattr(payload_stream, "seekable", lambda: False)():
            raise ParserError("Streaming parsing requires a seekable payload stream.")
        try:
            payload_stream.seek(0)
            prefix = payload_stream.read(16)
            payload_stream.seek(0)
        except (OSError, ValueError) as exc:
            raise ParserError("Could not inspect the streamed payload.") from exc
        for parser in self._parsers:
            if not parser.supports(raw_document, bytes(prefix)):
                continue
            parse_stream = getattr(parser, "parse_stream", None)
            if not callable(parse_stream):
                raise ParserError(
                    f"Parser {parser.parser_id} does not support streaming payloads."
                )
            return parse_stream(raw_document, payload_stream, parser_options)
        raise ParserError("No streaming parser supports the retained raw document.")
