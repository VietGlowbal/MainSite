"""Versioned parser boundary for retained raw snapshots."""

from __future__ import annotations

import json
from typing import Protocol, runtime_checkable

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
                JsonDocumentParser(),
                HtmlDocumentParser(),
                PlainTextDocumentParser(),
            )
        )

    def select(self, raw_document: RawDocument, payload: bytes) -> DocumentParser:
        for parser in self._parsers:
            if parser.supports(raw_document, payload):
                return parser
        raise ParserError("No parser supports the retained raw document.")

    def parse(self, raw_document: RawDocument, payload: bytes) -> ParsedDocument:
        return self.select(raw_document, payload).parse(raw_document, payload)
