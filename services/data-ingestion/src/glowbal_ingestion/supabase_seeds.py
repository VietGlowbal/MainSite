from __future__ import annotations

import ipaddress
import json
import os
import re
from dataclasses import dataclass
from typing import Callable, Mapping
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from .config import InstitutionSeed


MAX_SEEDS = 100
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
_HOST_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")


@dataclass(frozen=True)
class SupabaseSeedResult:
    seeds: tuple[InstitutionSeed, ...]
    skipped_rows: int = 0


def _normalize_domain(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    parsed = urlsplit(
        raw if "://" in raw else f"https://{raw}"
    )
    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.username or parsed.password or parsed.port:
        return None
    try:
        hostname = (
            (parsed.hostname or "")
            .strip()
            .lower()
            .rstrip(".")
            .encode("idna")
            .decode("ascii")
        )
    except UnicodeError:
        return None
    if hostname.startswith("www."):
        hostname = hostname[4:]
    if hostname.endswith(
        (".internal", ".invalid", ".local", ".localhost", ".onion", ".test")
    ):
        return None
    try:
        ipaddress.ip_address(hostname)
        return None
    except ValueError:
        pass
    labels = hostname.split(".")
    if (
        len(labels) < 2
        or hostname == "localhost"
        or len(hostname) > 253
        or any(
            not label
            or len(label) > 63
            or not _HOST_LABEL.fullmatch(label)
            for label in labels
        )
    ):
        return None
    return hostname


def _official_url(value: object, primary_domain: str) -> str:
    if isinstance(value, str) and value.strip():
        parsed = urlsplit(value.strip())
        hostname = _normalize_domain(parsed.hostname or "")
        if (
            parsed.scheme == "https"
            and hostname
            and (
                hostname == primary_domain
                or hostname.endswith(f".{primary_domain}")
                or primary_domain.endswith(f".{hostname}")
            )
        ):
            return value.strip()
    return f"https://{primary_domain}/"


def _seed_from_row(row: object) -> InstitutionSeed | None:
    if not isinstance(row, dict):
        return None
    raw_id = row.get("id")
    raw_name = row.get("name")
    raw_country_code = row.get("country_code")
    row_id = str(raw_id).strip() if raw_id is not None else ""
    name = raw_name.strip() if isinstance(raw_name, str) else ""
    country_code = (
        raw_country_code.strip().upper()
        if isinstance(raw_country_code, str)
        else ""
    )
    primary_domain = _normalize_domain(row.get("primary_domain"))
    if not row_id or not name or not re.fullmatch(r"[A-Z]{2}", country_code):
        return None
    if not primary_domain:
        return None

    raw_domains = row.get("domain_candidates")
    candidates = raw_domains if isinstance(raw_domains, list) else []
    allowed_domains = tuple(
        dict.fromkeys(
            domain
            for domain in (_normalize_domain(item) for item in candidates)
            if domain and domain != primary_domain
        )
    )
    return InstitutionSeed(
        institution_id=f"supabase-{row_id}",
        name=name,
        country_code=country_code,
        official_domain=primary_domain,
        homepage_url=_official_url(row.get("official_url"), primary_domain),
        allowed_domains=allowed_domains,
        terms_status="UNREVIEWED",
    )


def _credentials(environ: Mapping[str, str]) -> tuple[str, str]:
    base_url = (
        environ.get("SUPABASE_URL")
        or environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip().rstrip("/")
    api_key = (
        environ.get("SUPABASE_CRAWL_SEED_KEY")
        or environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()
    parsed = urlsplit(base_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(
            "Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL to an HTTPS URL."
        )
    if not api_key:
        raise ValueError(
            "Set SUPABASE_CRAWL_SEED_KEY or SUPABASE_SERVICE_ROLE_KEY."
        )
    return base_url, api_key


def _api_headers(api_key: str) -> dict[str, str]:
    headers = {
        "apikey": api_key,
        "Accept": "application/json",
        "User-Agent": "GlowBalEducationDataSmoke/0.1",
    }
    # Supabase publishable/secret keys are opaque API keys, not JWTs.
    # Legacy anon/service_role values remain valid Bearer credentials.
    if not api_key.startswith(("sb_publishable_", "sb_secret_")):
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def load_approved_supabase_seeds(
    *,
    limit: int = 20,
    country_codes: tuple[str, ...] = (),
    environ: Mapping[str, str] | None = None,
    opener: Callable[..., object] = urlopen,
) -> SupabaseSeedResult:
    if limit < 1 or limit > MAX_SEEDS:
        raise ValueError(
            f"--supabase-seed-limit must be between 1 and {MAX_SEEDS}."
        )
    countries = tuple(
        dict.fromkeys(code.strip().upper() for code in country_codes)
    )
    invalid = [code for code in countries if not re.fullmatch(r"[A-Z]{2}", code)]
    if invalid:
        raise ValueError(
            "--supabase-seed-country requires ISO two-letter country codes: "
            + ", ".join(invalid)
        )

    base_url, api_key = _credentials(environ or os.environ)
    query: list[tuple[str, str]] = [
        (
            "select",
            "id,name,country_code,primary_domain,official_url,domain_candidates",
        ),
        ("domain_review_status", "eq.approved"),
        ("crawl_seed_enabled", "eq.true"),
        ("primary_domain", "not.is.null"),
        ("order", "name.asc"),
        ("limit", str(limit)),
    ]
    if countries:
        query.append(("country_code", f"in.({','.join(countries)})"))
    endpoint = f"{base_url}/rest/v1/universities?{urlencode(query)}"
    request = Request(
        endpoint,
        headers=_api_headers(api_key),
    )

    with opener(request, timeout=20) as response:
        payload = response.read(MAX_RESPONSE_BYTES + 1)
    if len(payload) > MAX_RESPONSE_BYTES:
        raise ValueError("Supabase seed response exceeded the 2 MiB safety limit.")
    try:
        rows = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Supabase returned an invalid JSON seed response.") from exc
    if not isinstance(rows, list):
        raise ValueError("Supabase seed response must be a JSON array.")

    seeds: list[InstitutionSeed] = []
    seen_domains: set[str] = set()
    skipped = 0
    for row in rows:
        seed = _seed_from_row(row)
        if not seed or seed.official_domain in seen_domains:
            skipped += 1
            continue
        seen_domains.add(seed.official_domain)
        seeds.append(seed)
    return SupabaseSeedResult(tuple(seeds), skipped)
