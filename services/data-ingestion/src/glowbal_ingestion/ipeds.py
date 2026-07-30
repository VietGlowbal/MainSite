from __future__ import annotations

import csv
import io
import json
import os
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, TextIO
from urllib.parse import urlsplit, urlunsplit

from .config import CrawlLimits, ProgrammePriority
from .fetcher import FetchError, SafeFetcher
from .models import stable_id, utc_now_iso


IPEDS_DATA_BASE_URL = "https://nces.ed.gov/ipeds/datacenter/data"
IPEDS_DATA_CENTER_URL = "https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx"
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
MAX_ARCHIVE_MEMBER_BYTES = 600 * 1024 * 1024
MAX_ARCHIVE_MEMBERS = 30
IPEDS_MISSING_CODES = frozenset({"", ".", "-1", "-2", "-3", "-9"})
IPEDS_AGGREGATE_CIP_CODES = frozenset({"99", "99.0000"})
IPEDS_AWARD_DEGREE_LEVELS = {
    "5": "bachelor",
    "7": "master",
    "17": "doctorate",
    "18": "doctorate",
    "19": "doctorate",
}


class IpedsError(RuntimeError):
    pass


@dataclass(frozen=True)
class IpedsTarget:
    institution_id: str
    unitid: str
    name: str
    aliases: tuple[str, ...] = ()

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "IpedsTarget":
        institution_id = str(raw.get("institution_id") or "").strip()
        name = str(raw.get("name") or "").strip()
        unitid = str(raw.get("unitid") or "").strip()
        if not institution_id or not name or not re.fullmatch(r"\d{6}", unitid):
            raise ValueError(
                "Each IPEDS target requires institution_id, name and a "
                "six-digit UNITID."
            )
        return cls(
            institution_id=institution_id,
            unitid=unitid,
            name=name,
            aliases=tuple(
                str(alias).strip()
                for alias in raw.get("aliases", [])
                if str(alias).strip()
            ),
        )


@dataclass(frozen=True)
class IpedsTargetConfig:
    collection_year: int
    targets: tuple[IpedsTarget, ...]

    @classmethod
    def load(cls, path: Path) -> "IpedsTargetConfig":
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
        collection_year = int(raw.get("collection_year") or 0)
        if not 2004 <= collection_year <= 2100:
            raise ValueError("IPEDS collection_year must be between 2004 and 2100.")
        targets = tuple(
            IpedsTarget.from_dict(item) for item in raw.get("targets", [])
        )
        if not targets:
            raise ValueError("IPEDS target config must contain at least one target.")
        unitids = [target.unitid for target in targets]
        institution_ids = [target.institution_id for target in targets]
        if len(unitids) != len(set(unitids)):
            raise ValueError("IPEDS target UNITIDs must be unique.")
        if len(institution_ids) != len(set(institution_ids)):
            raise ValueError("IPEDS target institution_ids must be unique.")
        return cls(collection_year=collection_year, targets=targets)


@dataclass(frozen=True)
class IpedsDatasetSpec:
    key: str
    file_id: str
    required: bool
    data_year: str

    @property
    def source_url(self) -> str:
        return f"{IPEDS_DATA_BASE_URL}/{self.file_id}.zip"


@dataclass
class IpedsSyncResult:
    target_count: int
    matched_count: int
    institution_fact_count: int
    popular_programme_count: int
    crawl_seed_count: int = 0
    datasets_loaded: list[str] = field(default_factory=list)
    missing_targets: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    output_dir: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_count": self.target_count,
            "matched_count": self.matched_count,
            "institution_fact_count": self.institution_fact_count,
            "popular_programme_count": self.popular_programme_count,
            "crawl_seed_count": self.crawl_seed_count,
            "datasets_loaded": list(self.datasets_loaded),
            "missing_targets": [item.copy() for item in self.missing_targets],
            "warnings": list(self.warnings),
            "output_dir": self.output_dir,
        }


def default_dataset_specs(collection_year: int) -> tuple[IpedsDatasetSpec, ...]:
    year = str(collection_year)
    return (
        IpedsDatasetSpec(
            key="directory",
            file_id=f"HD{year}",
            required=True,
            data_year=f"{collection_year}-{str(collection_year + 1)[-2:]}",
        ),
        IpedsDatasetSpec(
            key="admissions",
            file_id=f"ADM{year}",
            required=False,
            data_year=f"{collection_year}-{str(collection_year + 1)[-2:]}",
        ),
        IpedsDatasetSpec(
            key="cost",
            file_id=f"COST1_{year}",
            required=False,
            data_year=f"{collection_year}-{str(collection_year + 1)[-2:]}",
        ),
        IpedsDatasetSpec(
            key="completions",
            file_id=f"C{year}_A",
            required=False,
            data_year=f"{collection_year - 1}-{str(collection_year)[-2:]}",
        ),
    )


def _normalize_row(row: dict[str, str | None]) -> dict[str, str]:
    return {
        str(key or "").strip().upper(): str(value or "").strip()
        for key, value in row.items()
        if key
    }


def _value(row: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        value = row.get(key.upper(), "").strip()
        if value not in IPEDS_MISSING_CODES:
            return value
    return None


def _number(row: dict[str, str], *keys: str) -> int | float | None:
    raw = _value(row, *keys)
    if raw is None:
        return None
    normalized = raw.replace(",", "")
    try:
        number = float(normalized)
    except ValueError:
        return None
    if number < 0:
        return None
    return int(number) if number.is_integer() else number


def _rate(numerator: int | float | None, denominator: int | float | None) -> float | None:
    if numerator is None or denominator in {None, 0}:
        return None
    return round(float(numerator) / float(denominator) * 100, 4)


def _code_label(value: str | None, labels: dict[str, str]) -> str | None:
    if value is None:
        return None
    return labels.get(value, f"IPEDS_CODE_{value}")


CONTROL_LABELS = {
    "1": "public",
    "2": "private_nonprofit",
    "3": "private_for_profit",
}
LEVEL_LABELS = {
    "1": "four_year_or_higher",
    "2": "at_least_two_but_less_than_four_year",
    "3": "less_than_two_year",
}
SECTOR_LABELS = {
    "1": "public_four_year_or_higher",
    "2": "private_nonprofit_four_year_or_higher",
    "3": "private_for_profit_four_year_or_higher",
    "4": "public_two_year",
    "5": "private_nonprofit_two_year",
    "6": "private_for_profit_two_year",
    "7": "public_less_than_two_year",
    "8": "private_nonprofit_less_than_two_year",
    "9": "private_for_profit_less_than_two_year",
    "99": "sector_unknown",
}


def _archive_csv_member(archive: zipfile.ZipFile, file_id: str) -> zipfile.ZipInfo:
    members = [
        member
        for member in archive.infolist()
        if not member.is_dir() and member.filename.casefold().endswith(".csv")
    ]
    if len(archive.infolist()) > MAX_ARCHIVE_MEMBERS:
        raise IpedsError("IPEDS archive contains too many members.")
    if not members:
        raise IpedsError("IPEDS archive does not contain a CSV file.")
    for member in members:
        stem = Path(member.filename).stem.casefold()
        if stem == file_id.casefold():
            return member
    for member in members:
        stem = Path(member.filename).stem.casefold()
        if stem == f"{file_id}_rv".casefold():
            return member
    return sorted(members, key=lambda member: member.filename.casefold())[0]


def _open_dataset(path: Path, file_id: str) -> tuple[TextIO, Any]:
    if path.suffix.casefold() == ".csv":
        handle = path.open("r", encoding="utf-8-sig", errors="replace", newline="")
        return handle, handle
    if not zipfile.is_zipfile(path):
        raise IpedsError(f"IPEDS dataset is not a valid ZIP or CSV: {path}")
    archive = zipfile.ZipFile(path)
    member = _archive_csv_member(archive, file_id)
    if member.file_size > MAX_ARCHIVE_MEMBER_BYTES:
        archive.close()
        raise IpedsError("IPEDS CSV exceeds the uncompressed safety limit.")
    binary = archive.open(member, "r")
    text = io.TextIOWrapper(
        binary,
        encoding="utf-8-sig",
        errors="replace",
        newline="",
    )

    class _DatasetContext:
        def close(self) -> None:
            text.close()
            archive.close()

    return text, _DatasetContext()


def _read_target_rows(
    path: Path,
    *,
    file_id: str,
    unitids: frozenset[str],
) -> list[dict[str, str]]:
    text, context = _open_dataset(path, file_id)
    try:
        reader = csv.DictReader(text)
        if not reader.fieldnames or "UNITID" not in {
            str(name or "").strip().upper() for name in reader.fieldnames
        }:
            raise IpedsError(f"{file_id} CSV does not contain UNITID.")
        rows: list[dict[str, str]] = []
        for raw_row in reader:
            row = _normalize_row(raw_row)
            if row.get("UNITID") in unitids:
                rows.append(row)
        return rows
    finally:
        context.close()


def _download_dataset(
    spec: IpedsDatasetSpec,
    destination: Path,
    *,
    fetcher: SafeFetcher,
) -> None:
    result = fetcher.fetch(
        spec.source_url,
        allowed_domains=("nces.ed.gov",),
        max_bytes=MAX_DOWNLOAD_BYTES,
        accept="application/zip,application/octet-stream",
    )
    if not result.body.startswith(b"PK"):
        raise IpedsError(
            f"{spec.file_id} did not return a ZIP archive "
            f"(content-type={result.content_type})."
        )
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_bytes(result.body)
    os.replace(temporary, destination)


def _locate_dataset(
    spec: IpedsDatasetSpec,
    cache_dir: Path,
    *,
    download_missing: bool,
    fetcher: SafeFetcher,
) -> Path | None:
    candidates = (
        cache_dir / f"{spec.file_id}.zip",
        cache_dir / f"{spec.file_id}.csv",
        cache_dir / f"{spec.file_id}_RV.zip",
        cache_dir / f"{spec.file_id}_RV.csv",
    )
    existing = next((path for path in candidates if path.exists()), None)
    if existing:
        return existing
    if not download_missing:
        return None
    destination = candidates[0]
    _download_dataset(spec, destination, fetcher=fetcher)
    return destination


def _institution_fact(
    *,
    target: IpedsTarget,
    field_name: str,
    value: Any,
    spec: IpedsDatasetSpec,
    retrieved_at: str,
) -> dict[str, Any]:
    return {
        "assertion_id": stable_id(
            "ipeds-assertion",
            target.institution_id,
            field_name,
            spec.file_id,
            json.dumps(value, sort_keys=True, ensure_ascii=False),
        ),
        "entity_type": "institution",
        "entity_id": target.institution_id,
        "ipeds_unitid": target.unitid,
        "field_name": field_name,
        "value_json": value,
        "source_type": "IPEDS",
        "source_dataset": spec.file_id,
        "source_url": spec.source_url,
        "data_year": spec.data_year,
        "collection_year": int(re.search(r"\d{4}", spec.file_id).group()),
        "retrieved_at": retrieved_at,
        "scope": "institution",
        "verification_status": "RULE_VALIDATED",
        "precedence": {
            "rank": 50,
            "may_override": ["legacy_validated_csv"],
            "must_not_override": [
                "newer_official_website",
                "newer_common_data_set",
            ],
        },
    }


def _directory_facts(
    target: IpedsTarget,
    row: dict[str, str],
    spec: IpedsDatasetSpec,
    retrieved_at: str,
) -> list[dict[str, Any]]:
    values = {
        "ipeds_unitid": target.unitid,
        "institution_name": _value(row, "INSTNM"),
        "institution_alias": _value(row, "IALIAS"),
        "institution_website": _value(row, "WEBADDR"),
        "admissions_url": _value(row, "ADMINURL"),
        "application_url": _value(row, "APPLURL"),
        "net_price_url": _value(row, "NPRICURL"),
        "institution_control": _code_label(
            _value(row, "CONTROL"), CONTROL_LABELS
        ),
        "institution_level": _code_label(
            _value(row, "ICLEVEL"), LEVEL_LABELS
        ),
        "institution_sector": _code_label(
            _value(row, "SECTOR"), SECTOR_LABELS
        ),
        "highest_award_level": _value(row, "HLOFFER"),
        "degree_granting": _value(row, "DEGGRANT"),
        "institution_size_code": _value(row, "INSTSIZE"),
        "city": _value(row, "CITY"),
        "state": _value(row, "STABBR"),
        "latitude": _number(row, "LATITUDE"),
        "longitude": _number(row, "LONGITUD"),
    }
    return [
        _institution_fact(
            target=target,
            field_name=field_name,
            value=value,
            spec=spec,
            retrieved_at=retrieved_at,
        )
        for field_name, value in values.items()
        if value is not None
    ]


def _admission_facts(
    target: IpedsTarget,
    row: dict[str, str],
    spec: IpedsDatasetSpec,
    retrieved_at: str,
) -> list[dict[str, Any]]:
    applicants = _number(row, "APPLCN")
    admitted = _number(row, "ADMSSN")
    enrolled = _number(row, "ENRLT")
    values = {
        "applicants_total": applicants,
        "admitted_total": admitted,
        "enrolled_total": enrolled,
        "institution_acceptance_rate": _rate(admitted, applicants),
        "institution_yield_rate": _rate(enrolled, admitted),
        "sat_math_25th_percentile": _number(row, "SATMT25"),
        "sat_math_75th_percentile": _number(row, "SATMT75"),
        "sat_reading_25th_percentile": _number(row, "SATVR25"),
        "sat_reading_75th_percentile": _number(row, "SATVR75"),
        "act_composite_25th_percentile": _number(row, "ACTCM25"),
        "act_composite_75th_percentile": _number(row, "ACTCM75"),
    }
    return [
        _institution_fact(
            target=target,
            field_name=field_name,
            value=value,
            spec=spec,
            retrieved_at=retrieved_at,
        )
        for field_name, value in values.items()
        if value is not None
    ]


def _cost_facts(
    target: IpedsTarget,
    row: dict[str, str],
    spec: IpedsDatasetSpec,
    retrieved_at: str,
) -> list[dict[str, Any]]:
    values = {
        "undergraduate_application_fee": _number(row, "APPLFEEU"),
        "graduate_application_fee": _number(row, "APPLFEEG"),
        "undergraduate_in_state_tuition": _number(
            row, "TUITION1", "TUITION2"
        ),
        "undergraduate_out_of_state_tuition": _number(row, "TUITION3"),
        "required_fees_in_state": _number(row, "FEE1", "FEE2"),
        "required_fees_out_of_state": _number(row, "FEE3"),
        "room_charge": _number(row, "RMCHG1", "ROOM"),
        "board_charge": _number(row, "RMBRD1", "BOARD"),
    }
    return [
        _institution_fact(
            target=target,
            field_name=field_name,
            value={
                "amount": value,
                "currency": "USD",
                "scope": "institution",
            },
            spec=spec,
            retrieved_at=retrieved_at,
        )
        for field_name, value in values.items()
        if value is not None
    ]


def _popular_programmes(
    target: IpedsTarget,
    rows: Iterable[dict[str, str]],
    spec: IpedsDatasetSpec,
    retrieved_at: str,
    *,
    limit: int,
) -> list[dict[str, Any]]:
    aggregated: dict[str, dict[str, Any]] = {}
    for row in rows:
        cip_code = _value(row, "CIPCODE")
        completions = _number(row, "CTOTALT")
        if (
            not cip_code
            or cip_code in IPEDS_AGGREGATE_CIP_CODES
            or completions is None
        ):
            continue
        item = aggregated.setdefault(
            cip_code,
            {
                "cip_code": cip_code,
                "cip_title": _value(row, "CIPTITLE"),
                "completions_total": 0,
                "award_levels": {},
            },
        )
        item["completions_total"] += int(completions)
        award_level = _value(row, "AWLEVEL") or "unknown"
        item["award_levels"][award_level] = (
            item["award_levels"].get(award_level, 0) + int(completions)
        )
    ranked = sorted(
        aggregated.values(),
        key=lambda item: (
            -int(item["completions_total"]),
            str(item.get("cip_title") or ""),
            str(item["cip_code"]),
        ),
    )[:limit]
    for item in ranked:
        degree_completions: dict[str, int] = {}
        for award_level, count in item["award_levels"].items():
            degree_level = IPEDS_AWARD_DEGREE_LEVELS.get(award_level)
            if degree_level:
                degree_completions[degree_level] = (
                    degree_completions.get(degree_level, 0) + int(count)
                )
        item["degree_completions"] = degree_completions
    return [
        {
            "programme_stat_id": stable_id(
                "ipeds-programme-stat",
                target.unitid,
                str(item["cip_code"]),
                spec.data_year,
            ),
            "institution_id": target.institution_id,
            "ipeds_unitid": target.unitid,
            "selection_rank": rank,
            "selection_basis": "ipeds_completions_by_cip",
            "popularity_semantics": (
                "Ranked by degrees/awards conferred, not applications, "
                "search demand, or current enrollment."
            ),
            **item,
            "source_type": "IPEDS",
            "source_dataset": spec.file_id,
            "source_url": spec.source_url,
            "data_year": spec.data_year,
            "retrieved_at": retrieved_at,
            "verification_status": "RULE_VALIDATED",
        }
        for rank, item in enumerate(ranked, start=1)
    ]


def _write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            )
            handle.write("\n")
    os.replace(temporary, path)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _ipeds_homepage(value: str | None) -> tuple[str, str] | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    first = raw.split()[0].rstrip(";,")
    if not re.match(r"^https?://", first, re.IGNORECASE):
        first = f"https://{first}"
    parsed = urlsplit(first)
    hostname = (parsed.hostname or "").casefold().rstrip(".")
    labels = hostname.split(".")
    if (
        not hostname
        or hostname == "localhost"
        or "." not in hostname
        or re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", hostname)
        or hostname.endswith(
            (".internal", ".invalid", ".local", ".localhost", ".test")
        )
        or not re.fullmatch(
            r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?",
            hostname,
        )
        or any(
            not label
            or len(label) > 63
            or not re.fullmatch(
                r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?",
                label,
            )
            for label in labels
        )
    ):
        return None
    unprefixed_hostname = (
        hostname[4:] if hostname.startswith("www.") else hostname
    )
    domain_labels = unprefixed_hostname.split(".")
    official_domain = (
        ".".join(domain_labels[-2:])
        if unprefixed_hostname.endswith(".edu")
        and len(domain_labels) >= 2
        else unprefixed_hostname
    )
    homepage_url = urlunsplit(
        (
            "https",
            hostname,
            parsed.path or "/",
            "",
            "",
        )
    )
    return official_domain, homepage_url


def _write_crawl_seed_config(
    path: Path,
    *,
    config: IpedsTargetConfig,
    directory_by_id: dict[str, dict[str, str]],
) -> int:
    institutions: list[dict[str, Any]] = []
    for target in config.targets:
        directory = directory_by_id.get(target.unitid)
        if not directory:
            continue
        homepage = _ipeds_homepage(_value(directory, "WEBADDR"))
        if not homepage:
            continue
        official_domain, homepage_url = homepage
        base = f"https://{official_domain}"
        institutions.append(
            {
                "institution_id": target.institution_id,
                "name": target.name,
                "country_code": "US",
                "official_domain": official_domain,
                "homepage_url": homepage_url,
                "catalogue_hints": [
                    f"{base}/academics/",
                    f"{base}/programs/",
                    f"{base}/programmes/",
                    f"{base}/degrees/",
                    f"{base}/catalog/",
                ],
                "school_profile_urls": [
                    f"{base}/about/",
                    f"{base}/mission/",
                    f"{base}/values/",
                ],
                "terms_status": "UNREVIEWED",
                "enable_optional_phd": True,
                "seed_provenance": {
                    "source_type": "IPEDS",
                    "source_dataset": f"HD{config.collection_year}",
                    "ipeds_unitid": target.unitid,
                },
            }
        )
    _write_json(
        path,
        {
            "run_name": f"us-ipeds-{len(institutions)}-{config.collection_year}",
            "deepseek_flash_model": "deepseek-v4-flash",
            "deepseek_pro_model": "deepseek-v4-pro",
            "limits": {
                "global_concurrency": 4,
                "institution_concurrency": 2,
                "per_domain_concurrency": 1,
                "max_index_pages": 12,
                "max_index_depth": 2,
                "max_deep_programmes_per_institution": 3,
                "max_deep_sources_per_programme": 8,
                "max_status_preflight_candidates_per_institution": 10,
                "max_optional_phd_total": 2,
                "min_request_interval_seconds": 1.0,
            },
            "institutions": institutions,
        },
    )
    return len(institutions)


def sync_ipeds(
    *,
    targets_path: Path,
    cache_dir: Path,
    output_dir: Path,
    download_missing: bool,
    popular_programme_limit: int = 50,
    fetcher: SafeFetcher | None = None,
) -> IpedsSyncResult:
    if not 1 <= popular_programme_limit <= 50:
        raise ValueError("popular_programme_limit must be between 1 and 50.")
    config = IpedsTargetConfig.load(targets_path)
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    fetcher = fetcher or SafeFetcher(
        CrawlLimits(
            request_timeout_seconds=60,
            connect_timeout_seconds=20,
            max_redirects=5,
            min_request_interval_seconds=0.5,
        )
    )
    unitids = frozenset(target.unitid for target in config.targets)
    specs = default_dataset_specs(config.collection_year)
    rows_by_dataset: dict[str, list[dict[str, str]]] = {}
    result = IpedsSyncResult(
        target_count=len(config.targets),
        matched_count=0,
        institution_fact_count=0,
        popular_programme_count=0,
        output_dir=str(output_dir),
    )

    for spec in specs:
        try:
            dataset_path = _locate_dataset(
                spec,
                cache_dir,
                download_missing=download_missing,
                fetcher=fetcher,
            )
            if dataset_path is None:
                message = f"{spec.file_id}: local file is missing."
                if spec.required:
                    raise IpedsError(message)
                result.warnings.append(message)
                continue
            rows_by_dataset[spec.key] = _read_target_rows(
                dataset_path,
                file_id=spec.file_id,
                unitids=unitids,
            )
            result.datasets_loaded.append(spec.file_id)
        except (FetchError, IpedsError, OSError, zipfile.BadZipFile) as exc:
            if spec.required:
                raise IpedsError(
                    f"Required IPEDS dataset {spec.file_id} failed: {exc}"
                ) from exc
            result.warnings.append(f"{spec.file_id}: {exc}")

    retrieved_at = utc_now_iso()
    spec_by_key = {spec.key: spec for spec in specs}
    directory_by_id = {
        row.get("UNITID", ""): row
        for row in rows_by_dataset.get("directory", [])
    }
    admission_by_id = {
        row.get("UNITID", ""): row
        for row in rows_by_dataset.get("admissions", [])
    }
    cost_by_id = {
        row.get("UNITID", ""): row
        for row in rows_by_dataset.get("cost", [])
    }
    completions_by_id: dict[str, list[dict[str, str]]] = {}
    for row in rows_by_dataset.get("completions", []):
        completions_by_id.setdefault(row.get("UNITID", ""), []).append(row)

    institution_records: list[dict[str, Any]] = []
    institution_facts: list[dict[str, Any]] = []
    popular_programmes: list[dict[str, Any]] = []
    for target in config.targets:
        directory = directory_by_id.get(target.unitid)
        if not directory:
            result.missing_targets.append(
                {
                    "institution_id": target.institution_id,
                    "unitid": target.unitid,
                    "name": target.name,
                }
            )
            continue
        result.matched_count += 1
        institution_records.append(
            {
                "institution_id": target.institution_id,
                "ipeds_unitid": target.unitid,
                "configured_name": target.name,
                "ipeds_name": _value(directory, "INSTNM"),
                "name_match_requires_review": (
                    _value(directory, "INSTNM") is None
                    or not names_compatible(
                        target.name,
                        str(_value(directory, "INSTNM") or ""),
                        target.aliases,
                    )
                ),
                "source_type": "IPEDS",
                "source_dataset": spec_by_key["directory"].file_id,
                "source_url": spec_by_key["directory"].source_url,
                "data_year": spec_by_key["directory"].data_year,
                "retrieved_at": retrieved_at,
            }
        )
        institution_facts.extend(
            _directory_facts(
                target,
                directory,
                spec_by_key["directory"],
                retrieved_at,
            )
        )
        admission = admission_by_id.get(target.unitid)
        if admission:
            institution_facts.extend(
                _admission_facts(
                    target,
                    admission,
                    spec_by_key["admissions"],
                    retrieved_at,
                )
            )
        cost = cost_by_id.get(target.unitid)
        if cost:
            institution_facts.extend(
                _cost_facts(
                    target,
                    cost,
                    spec_by_key["cost"],
                    retrieved_at,
                )
            )
        popular_programmes.extend(
            _popular_programmes(
                target,
                completions_by_id.get(target.unitid, []),
                spec_by_key["completions"],
                retrieved_at,
                limit=popular_programme_limit,
            )
        )

    result.institution_fact_count = len(institution_facts)
    result.popular_programme_count = len(popular_programmes)
    result.crawl_seed_count = _write_crawl_seed_config(
        output_dir / "ipeds_crawl_config.json",
        config=config,
        directory_by_id=directory_by_id,
    )
    _write_jsonl(output_dir / "ipeds_institutions.jsonl", institution_records)
    _write_jsonl(
        output_dir / "ipeds_field_assertions.jsonl", institution_facts
    )
    _write_jsonl(
        output_dir / "ipeds_popular_programmes.jsonl", popular_programmes
    )
    _write_json(
        output_dir / "ipeds_manifest.json",
        {
            "schema_version": "GlowBalIPEDS/v1",
            "generated_at": retrieved_at,
            "official_data_center_url": IPEDS_DATA_CENTER_URL,
            "collection_year": config.collection_year,
            "result": result.to_dict(),
            "datasets": [
                {
                    "key": spec.key,
                    "file_id": spec.file_id,
                    "required": spec.required,
                    "data_year": spec.data_year,
                    "source_url": spec.source_url,
                    "loaded": spec.file_id in result.datasets_loaded,
                }
                for spec in specs
            ],
            "precedence_policy": {
                "newer_official_website": 100,
                "newer_common_data_set": 80,
                "ipeds": 50,
                "legacy_validated_csv": 10,
                "rule": (
                    "Compare field scope and data_year before precedence. "
                    "IPEDS institution-level facts never overwrite "
                    "programme-level facts."
                ),
            },
        },
    )
    return result


def load_ipeds_programme_priorities(
    path: Path,
) -> dict[str, tuple[ProgrammePriority, ...]]:
    """Load a bounded, provenance-preserving CIP priority index."""
    if not path.exists():
        raise ValueError(f"IPEDS programme priority file does not exist: {path}")
    priorities: dict[str, list[ProgrammePriority]] = {}
    seen: set[tuple[str, str]] = set()
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"Invalid IPEDS priority JSON at line {line_number}: {exc}"
                ) from exc
            if not isinstance(raw, dict):
                raise ValueError(
                    f"IPEDS priority line {line_number} must be an object."
                )
            institution_id = str(
                raw.get("institution_id") or ""
            ).strip()
            cip_code = str(raw.get("cip_code") or "").strip()
            cip_title = str(raw.get("cip_title") or "").strip()
            rank = int(raw.get("selection_rank") or 0)
            if (
                not institution_id
                or not cip_code
                or not cip_title
                or rank < 1
            ):
                raise ValueError(
                    "IPEDS priority line "
                    f"{line_number} is missing institution_id, CIP or rank."
                )
            dedupe_key = (institution_id, cip_code)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            award_levels = raw.get("award_levels") or {}
            degree_completions = raw.get("degree_completions")
            if degree_completions is None:
                degree_completions = {}
                if isinstance(award_levels, dict):
                    for award_level, count in award_levels.items():
                        degree_level = IPEDS_AWARD_DEGREE_LEVELS.get(
                            str(award_level)
                        )
                        if degree_level:
                            degree_completions[degree_level] = (
                                int(
                                    degree_completions.get(
                                        degree_level, 0
                                    )
                                )
                                + int(count)
                            )
            source_dataset = str(
                raw.get("source_dataset") or "IPEDS_COMPLETIONS"
            )
            data_year = str(raw.get("data_year") or "unknown")
            priority = ProgrammePriority.from_dict(
                {
                    "source": f"IPEDS:{source_dataset}:{data_year}",
                    "rank": rank,
                    "label": cip_title,
                    "taxonomy_code": cip_code,
                    "completions_total": raw.get("completions_total"),
                    "degree_completions": degree_completions,
                }
            )
            priorities.setdefault(institution_id, []).append(priority)
    return {
        institution_id: tuple(
            sorted(items, key=lambda item: (item.rank, item.label))[:50]
        )
        for institution_id, items in priorities.items()
    }


def _normalized_name(value: str) -> str:
    text = value.casefold()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = text.replace("&", " and ")
    text = re.sub(r"\bthe\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def names_compatible(
    configured_name: str,
    ipeds_name: str,
    aliases: Iterable[str] = (),
) -> bool:
    expected = {
        _normalized_name(configured_name),
        *(_normalized_name(alias) for alias in aliases),
    }
    actual = _normalized_name(ipeds_name)
    return actual in expected
