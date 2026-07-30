from __future__ import annotations

import io
import re
import unicodedata
import xml.etree.ElementTree as ET
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from .models import PageType, ParsedPage


WHITESPACE_RE = re.compile(r"\s+")
MOJIBAKE_MARKERS = ("â€", "â€™", "â€“", "â€”", "â‚¬", "Ã", "Â")
META_CHARSET_RE = re.compile(
    br"""<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9._-]+)""",
    re.IGNORECASE,
)
ROBUST_MOJIBAKE_MARKERS = (
    "\u00c3",
    "\u00c2",
    "\u00e2\u20ac",
    "\u00e2\u201a",
    "\ufffd",
)
MOJIBAKE_REPLACEMENTS = {
    "\u00e2\u20ac\u2122": "\u2019",
    "\u00e2\u20ac\u02dc": "\u2018",
    "\u00e2\u20ac\u0153": "\u201c",
    "\u00e2\u20ac\ufffd": "\u201d",
    "\u00e2\u20ac\u201c": "\u2013",
    "\u00e2\u20ac\u201d": "\u2014",
    "\u00e2\u20ac\u00a6": "\u2026",
    "\u00e2\u201a\u00ac": "\u20ac",
    "\u00c2\u00a3": "\u00a3",
    "\u00c2\u00a0": " ",
}
HARD_SKIPPED_HTML_TAGS = {
    "script",
    "style",
    "noscript",
    "svg",
    "template",
}
NOISE_HTML_TAGS = {
    "nav",
    "footer",
    "aside",
}
VOID_HTML_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
NOISE_ATTRIBUTE_TOKENS = {
    "breadcrumb",
    "breadcrumbs",
    "footer",
    "header",
    "global-header",
    "masthead",
    "menu",
    "nav",
    "navbar",
    "navigation",
    "search",
    "sidebar",
    "site-header",
    "utility-header",
}
TABLE_CREDENTIAL_LINK_RE = re.compile(
    r"^(?:"
    r"AAS|AB|BA|BALAS|BAS|BBA|BFA|BLA|BMUS|BS|BSE|BSLAS|"
    r"CAS|DNP|EdD|JD|LLM|MA|MAS|MBA|MDes|MEng|MFA|MPhil|"
    r"MPA|MPH|MS|MSA|MSE|MSEd|PhD|"
    r"CONC(?:\s*\([^)]*\))?|Minor|Certificate|GCRT|NONE"
    r")$",
    re.IGNORECASE,
)


class _VisibleHtmlParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.language: str | None = None
        self._skip_depth = 0
        self._noise_depth = 0
        self._open_elements: list[tuple[str, bool]] = []
        self._in_title = False
        self._active_href: str | None = None
        self._active_link_text: list[str] = []
        self._in_table_row = False
        self._in_table_cell = False
        self._current_cell_text: list[str] = []
        self._row_label: str | None = None
        self._row_links: list[tuple[str, str]] = []

    @staticmethod
    def _is_noise_element(
        tag: str,
        attributes: dict[str, str | None],
    ) -> bool:
        if tag in NOISE_HTML_TAGS:
            return True
        if tag == "header" and not (
            attributes.get("id") or attributes.get("class")
        ):
            return True
        if (attributes.get("role") or "").casefold() in {
            "navigation",
            "search",
        }:
            return True
        attribute_tokens = {
            token.casefold()
            for value in (
                attributes.get("id") or "",
                attributes.get("class") or "",
            )
            for token in value.split()
        }
        return bool(attribute_tokens & NOISE_ATTRIBUTE_TOKENS)

    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = {key.lower(): value for key, value in attrs}
        lowered = tag.lower()
        if lowered == "html" and attributes.get("lang"):
            self.language = attributes["lang"]
        if lowered in HARD_SKIPPED_HTML_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        is_noise = self._is_noise_element(lowered, attributes)
        if lowered not in VOID_HTML_TAGS:
            self._open_elements.append((lowered, is_noise))
        if is_noise:
            if lowered not in VOID_HTML_TAGS:
                self._noise_depth += 1
            return
        if lowered == "title":
            self._in_title = True
        if lowered == "tr" and not self._in_table_row:
            self._in_table_row = True
            self._row_label = None
            self._row_links = []
        if lowered in {"td", "th"} and self._in_table_row:
            self._in_table_cell = True
            self._current_cell_text = []
        if lowered == "a" and attributes.get("href"):
            self._active_href = urljoin(self.base_url, attributes["href"])
            self._active_link_text = []

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in HARD_SKIPPED_HTML_TAGS:
            if self._skip_depth:
                self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if lowered == "title":
            self._in_title = False
        if lowered == "a" and self._active_href:
            text = normalize_text(" ".join(self._active_link_text))
            if self._in_table_row:
                self._row_links.append((self._active_href, text))
            else:
                self.links.append((self._active_href, text))
            self._active_href = None
            self._active_link_text = []
        if lowered in {"td", "th"} and self._in_table_cell:
            cell_text = normalize_text(" ".join(self._current_cell_text))
            if self._row_label is None and cell_text:
                self._row_label = cell_text
            self._in_table_cell = False
            self._current_cell_text = []
        if lowered == "tr" and self._in_table_row:
            for href, link_text in self._row_links:
                enriched = link_text
                if (
                    self._row_label
                    and TABLE_CREDENTIAL_LINK_RE.fullmatch(link_text)
                    and self._row_label.casefold() != link_text.casefold()
                ):
                    enriched = f"{self._row_label} ({link_text})"
                self.links.append((href, enriched))
            self._in_table_row = False
            self._in_table_cell = False
            self._current_cell_text = []
            self._row_label = None
            self._row_links = []
        matching_index = next(
            (
                index
                for index in range(len(self._open_elements) - 1, -1, -1)
                if self._open_elements[index][0] == lowered
            ),
            None,
        )
        if matching_index is not None:
            closed = self._open_elements[matching_index:]
            self._open_elements = self._open_elements[:matching_index]
            self._noise_depth = max(
                0,
                self._noise_depth
                - sum(1 for _, is_noise in closed if is_noise),
            )

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        cleaned = normalize_text(data)
        if not cleaned:
            return
        if self._active_href:
            self._active_link_text.append(cleaned)
        if self._in_table_cell:
            self._current_cell_text.append(cleaned)
        if self._noise_depth:
            return
        self.text_parts.append(cleaned)
        if self._in_title:
            self.title_parts.append(cleaned)


def normalize_text(value: str) -> str:
    decoded = unescape(value)
    # Repair one or two full Windows-1252/UTF-8 decoding mistakes. A second
    # pass handles strings that were accidentally encoded twice.
    for _ in range(2):
        if not any(marker in decoded for marker in ROBUST_MOJIBAKE_MARKERS):
            break
        try:
            repaired = decoded.encode("windows-1252").decode("utf-8")
            before = sum(
                decoded.count(marker)
                for marker in ROBUST_MOJIBAKE_MARKERS
            )
            after = sum(
                repaired.count(marker)
                for marker in ROBUST_MOJIBAKE_MARKERS
            )
            if repaired != decoded and after < before:
                decoded = repaired
                continue
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        break
    # Mixed pages can contain valid Unicode and isolated mojibake, making a
    # full-string round trip impossible. Repair the common fragments directly.
    for broken, repaired in MOJIBAKE_REPLACEMENTS.items():
        decoded = decoded.replace(broken, repaired)
    if any(marker in decoded for marker in MOJIBAKE_MARKERS):
        try:
            repaired = decoded.encode("windows-1252").decode("utf-8")
            if repaired.count("�") <= decoded.count("�"):
                decoded = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    normalized = unicodedata.normalize("NFKC", decoded)
    normalized = (
        normalized.replace("\u00c2\u00ad", "")
        .replace("\u00ad", "")
        .replace("\u200b", "")
        .replace("\ufeff", "")
    )
    return WHITESPACE_RE.sub(" ", normalized).strip()


def _decode_html(body: bytes, content_type: str | None = None) -> str:
    declared_charset: str | None = None
    if content_type:
        charset_match = re.search(
            r"charset\s*=\s*[\"']?([^;\"'\s]+)",
            content_type,
            re.IGNORECASE,
        )
        if charset_match:
            declared_charset = charset_match.group(1)
    meta_match = META_CHARSET_RE.search(body[:8192])
    meta_charset = (
        meta_match.group(1).decode("ascii", errors="ignore")
        if meta_match
        else None
    )

    candidates: list[str] = []
    if body.startswith(b"\xef\xbb\xbf"):
        candidates.append("utf-8-sig")
    if meta_charset:
        candidates.append(meta_charset)

    # Several university sites declare ISO-8859-1/Windows-1252 while serving
    # UTF-8. Prefer a strict UTF-8 decode when it is valid to avoid mojibake
    # such as "â€“".
    if declared_charset and declared_charset.casefold() in {
        "iso-8859-1",
        "latin-1",
        "latin1",
        "windows-1252",
        "cp1252",
    }:
        candidates.extend(("utf-8", declared_charset))
    elif declared_charset:
        candidates.extend((declared_charset, "utf-8"))
    else:
        candidates.append("utf-8")
    candidates.extend(("windows-1252", "latin-1"))

    for charset in dict.fromkeys(candidates):
        try:
            return body.decode(charset, errors="strict")
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def parse_html(
    body: bytes, base_url: str, content_type_header: str | None = None
) -> ParsedPage:
    parser = _VisibleHtmlParser(base_url)
    parser.feed(_decode_html(body, content_type_header))
    parser.close()
    title = normalize_text(" ".join(parser.title_parts)) or None
    text = normalize_text(" ".join(parser.text_parts))
    deduped_links = list(dict.fromkeys(parser.links))
    return ParsedPage(
        url=base_url,
        title=title,
        text=text,
        links=deduped_links,
        language=parser.language,
    )


def parse_pdf(body: bytes, url: str) -> ParsedPage:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError(
            "PDF parsing requires the optional 'pypdf' dependency."
        ) from exc
    reader = PdfReader(io.BytesIO(body))
    parts: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        if extracted:
            parts.append(extracted)
    return ParsedPage(
        url=url,
        title=None,
        text=normalize_text("\n".join(parts)),
        links=[],
        language=None,
    )


def parse_sitemap(body: bytes) -> tuple[list[str], list[str]]:
    """Return (nested sitemaps, page URLs)."""
    nested: list[str] = []
    pages: list[str] = []
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return nested, pages
    root_name = root.tag.rsplit("}", 1)[-1].lower()
    locations = [
        normalize_text(element.text or "")
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1].lower() == "loc"
    ]
    locations = [location for location in locations if location]
    if root_name == "sitemapindex":
        nested.extend(locations)
    elif root_name == "urlset":
        pages.extend(locations)
    return nested, pages


def classify_page(url: str, title: str | None, text: str) -> PageType:
    if url.lower().endswith(".pdf"):
        return PageType.PDF

    parsed_url = urlsplit(url)
    hostname = (parsed_url.hostname or "").lower()
    normalized_path = parsed_url.path.lower()
    if (
        hostname.startswith("financialaid.")
        or re.search(
            r"/(?:financial-aid|financialaid)(?:/|$)",
            normalized_path,
        )
    ):
        return PageType.SCHOLARSHIP

    strong_signal = f"{url} {title or ''}".lower()
    body_signal = text[:1600].lower()
    patterns: list[tuple[PageType, tuple[str, ...]]] = [
        (
            PageType.ENGLISH_REQUIREMENT,
            (
                "english-language",
                "english language",
                "ielts",
                "toefl",
                "duolingo",
            ),
        ),
        (
            PageType.INTERNATIONAL_ADMISSION,
            (
                "international-admission",
                "international admission",
                "international applicants",
            ),
        ),
        (
            PageType.SCHOLARSHIP,
            (
                "scholarship",
                "financial-aid",
                "financial aid",
                "apply-for-aid",
                "apply for aid",
                "/afford/",
                "funding opportunity",
            ),
        ),
        (
            PageType.TUITION,
            (
                "tuition",
                "fees-and-funding",
                "fees and funding",
                "fees-and-expenses",
                "fees and expenses",
                "cost of attendance",
                "/costs/",
                "study costs",
            ),
        ),
        (
            PageType.PROGRAMME_ADMISSION,
            (
                "admission-and-application",
                "admission requirement",
                "entry requirement",
                "how-to-apply",
                "how to apply",
                "application requirement",
                "application overview",
                "application and essays",
                "first-year applicants",
                "/apply/first-year/",
                "letters of recommendation",
                "/recommendations",
                "transcript, school report",
                "/transcripts",
                "statement of purpose",
                "/statements",
            ),
        ),
        (
            PageType.DEADLINE,
            (
                "/deadlines",
                "application-deadline",
                "application deadline",
                "admission deadline",
                "important dates",
            ),
        ),
        (
            PageType.CAREER_OUTCOME,
            (
                "career and professional",
                "/career/",
                "/careers",
                "careers |",
                "career-prospect",
                "career prospect",
                "career outcome",
                "graduate outcome",
                "employment rate",
                "occupations post graduation",
                "what can you do with",
            ),
        ),
        (
            PageType.CATALOGUE,
            (
                "course catalogue",
                "program finder",
                "programme finder",
                "all programs",
                "all programmes",
            ),
        ),
    ]
    for page_type, keywords in patterns:
        if any(keyword in strong_signal for keyword in keywords):
            return page_type

    path = url.lower()
    if re.search(
        r"/(?:admissions?|apply|application)(?:/|$)",
        urlsplit(url).path,
        re.IGNORECASE,
    ):
        return PageType.PROGRAMME_ADMISSION
    if (
        re.search(
            r"/(?:programmes?|programs?|degree-charts|undergraduate-program|"
            r"study/(?:courses/)?(?:undergraduate|"
            r"postgraduate(?:-(?:taught|research|doctoral))?)|"
            r"opleidingen/(?:bachelors|masters))"
            r"(?:/|[-_])",
            path,
        )
        or re.search(
            r"\b(?:bachelor|master|msc|bsc|phd|programme|program)\b",
            (title or "").lower(),
        )
    ):
        return PageType.PROGRAMME_OVERVIEW

    for page_type, keywords in patterns:
        if any(keyword in body_signal for keyword in keywords):
            return page_type
    if re.search(
        r"\b(?:bachelor|master|msc|bsc|phd|programme|program)\b",
        body_signal,
    ):
        return PageType.PROGRAMME_OVERVIEW
    return PageType.UNKNOWN
