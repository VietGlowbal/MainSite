from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlencode

from .config import CrawlLimits
from .fetcher import FetchError, SafeFetcher
from .ipeds import (
    IpedsSyncResult,
    IpedsTarget,
    IpedsTargetConfig,
    _write_crawl_seed_config,
    _write_json,
    _write_jsonl,
    names_compatible,
)
from .models import stable_id, utc_now_iso


SCORECARD_API_URL = (
    "https://api.data.gov/ed/collegescorecard/v1/schools.json"
)
SCORECARD_DATA_URL = "https://collegescorecard.ed.gov/data/"
MAX_SCORECARD_BYTES = 30 * 1024 * 1024
SCORECARD_API_KEY_ENV = "COLLEGE_SCORECARD_API_KEY"

SCHOOL_FIELDS = (
    "id",
    "school.name",
    "school.school_url",
    "school.city",
    "school.state",
    "school.ownership",
    "school.degrees_awarded.highest",
    "latest.student.size",
    "latest.admissions.admission_rate.overall",
    "latest.admissions.sat_scores.25th_percentile.math",
    "latest.admissions.sat_scores.75th_percentile.math",
    "latest.admissions.sat_scores.25th_percentile.critical_reading",
    "latest.admissions.sat_scores.75th_percentile.critical_reading",
    "latest.admissions.act_scores.25th_percentile.cumulative",
    "latest.admissions.act_scores.75th_percentile.cumulative",
    "latest.cost.tuition.in_state",
    "latest.cost.tuition.out_of_state",
    "latest.cost.avg_net_price.overall",
)
PROGRAMME_FIELDS = (
    "id",
    "school.name",
    "latest.programs.cip_4_digit.code",
    "latest.programs.cip_4_digit.title",
    "latest.programs.cip_4_digit.credential.level",
    "latest.programs.cip_4_digit.counts.ipeds_awards1",
    (
        "latest.programs.cip_4_digit.earnings."
        "1_yr.overall_median_earnings"
    ),
    (
        "latest.programs.cip_4_digit.earnings."
        "5_yr.overall_median_earnings"
    ),
)
SCORECARD_CREDENTIAL_LEVELS = {
    3: "bachelor",
    5: "master",
    6: "doctorate",
}


class ScorecardError(RuntimeError):
    pass


def _cache_path(
    cache_dir: Path,
    *,
    kind: str,
    unitids: tuple[str, ...],
) -> Path:
    digest = hashlib.sha256(
        ",".join(sorted(unitids)).encode("ascii")
    ).hexdigest()[:16]
    return cache_dir / f"scorecard-{kind}-{digest}.json"


def _scorecard_url(
    unitids: tuple[str, ...],
    fields: tuple[str, ...],
) -> str:
    return (
        f"{SCORECARD_API_URL}?"
        + urlencode(
            {
                "id": ",".join(unitids),
                "per_page": 100,
                "fields": ",".join(fields),
            }
        )
    )


def _load_payload(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ScorecardError(f"Invalid Scorecard cache {path}: {exc}") from exc
    if not isinstance(payload, dict) or not isinstance(
        payload.get("results"), list
    ):
        raise ScorecardError(
            f"Scorecard payload does not contain a results array: {path}"
        )
    return payload


def _fetch_or_load(
    *,
    cache_dir: Path,
    kind: str,
    unitids: tuple[str, ...],
    fields: tuple[str, ...],
    download_missing: bool,
    api_key: str,
    fetcher: SafeFetcher,
) -> dict[str, Any]:
    path = _cache_path(cache_dir, kind=kind, unitids=unitids)
    if path.exists():
        return _load_payload(path)
    if not download_missing:
        raise ScorecardError(f"Scorecard cache is missing: {path}")
    try:
        result = fetcher.fetch(
            _scorecard_url(unitids, fields),
            allowed_domains=("api.data.gov",),
            max_bytes=MAX_SCORECARD_BYTES,
            accept="application/json",
            conditional_headers={"X-Api-Key": api_key},
        )
    except FetchError as exc:
        raise ScorecardError(
            f"College Scorecard request failed: {exc}"
        ) from exc
    try:
        payload = json.loads(result.body)
    except json.JSONDecodeError as exc:
        raise ScorecardError(
            "College Scorecard returned invalid JSON."
        ) from exc
    if not isinstance(payload, dict) or not isinstance(
        payload.get("results"), list
    ):
        raise ScorecardError(
            "College Scorecard response does not contain a results array."
        )
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temporary, path)
    return payload


def _number(value: Any) -> int | float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return int(number) if number.is_integer() else number


def _assertion(
    *,
    target: IpedsTarget,
    field_name: str,
    value: Any,
    retrieved_at: str,
) -> dict[str, Any]:
    return {
        "assertion_id": stable_id(
            "scorecard-assertion",
            target.institution_id,
            field_name,
            json.dumps(value, sort_keys=True, ensure_ascii=False),
        ),
        "entity_type": "institution",
        "entity_id": target.institution_id,
        "ipeds_unitid": target.unitid,
        "field_name": field_name,
        "value_json": value,
        "source_type": "College Scorecard (IPEDS-derived)",
        "source_dataset": "College Scorecard latest institution data",
        "source_url": SCORECARD_DATA_URL,
        "data_year": "latest_scorecard_release",
        "collection_year": None,
        "retrieved_at": retrieved_at,
        "scope": "institution",
        "verification_status": "RULE_VALIDATED",
        "precedence": {
            "rank": 45,
            "may_override": ["legacy_validated_csv"],
            "must_not_override": [
                "newer_official_website",
                "newer_common_data_set",
                "direct_ipeds_release_with_known_year",
            ],
        },
    }


def _school_facts(
    target: IpedsTarget,
    row: Mapping[str, Any],
    retrieved_at: str,
) -> list[dict[str, Any]]:
    acceptance = _number(
        row.get("latest.admissions.admission_rate.overall")
    )
    if acceptance is not None:
        acceptance = round(float(acceptance) * 100, 4)
    scalar_values = {
        "ipeds_unitid": target.unitid,
        "institution_name": row.get("school.name"),
        "institution_website": row.get("school.school_url"),
        "city": row.get("school.city"),
        "state": row.get("school.state"),
        "institution_control_code": _number(
            row.get("school.ownership")
        ),
        "highest_award_level": _number(
            row.get("school.degrees_awarded.highest")
        ),
        "student_size": _number(row.get("latest.student.size")),
        "institution_acceptance_rate": acceptance,
        "sat_math_25th_percentile": _number(
            row.get(
                "latest.admissions.sat_scores.25th_percentile.math"
            )
        ),
        "sat_math_75th_percentile": _number(
            row.get(
                "latest.admissions.sat_scores.75th_percentile.math"
            )
        ),
        "sat_reading_25th_percentile": _number(
            row.get(
                "latest.admissions.sat_scores.25th_percentile."
                "critical_reading"
            )
        ),
        "sat_reading_75th_percentile": _number(
            row.get(
                "latest.admissions.sat_scores.75th_percentile."
                "critical_reading"
            )
        ),
        "act_composite_25th_percentile": _number(
            row.get(
                "latest.admissions.act_scores.25th_percentile."
                "cumulative"
            )
        ),
        "act_composite_75th_percentile": _number(
            row.get(
                "latest.admissions.act_scores.75th_percentile."
                "cumulative"
            )
        ),
    }
    facts = [
        _assertion(
            target=target,
            field_name=field_name,
            value=value,
            retrieved_at=retrieved_at,
        )
        for field_name, value in scalar_values.items()
        if value is not None and value != ""
    ]
    money_values = {
        "undergraduate_in_state_tuition": _number(
            row.get("latest.cost.tuition.in_state")
        ),
        "undergraduate_out_of_state_tuition": _number(
            row.get("latest.cost.tuition.out_of_state")
        ),
        "average_net_price": _number(
            row.get("latest.cost.avg_net_price.overall")
        ),
    }
    facts.extend(
        _assertion(
            target=target,
            field_name=field_name,
            value={
                "amount": value,
                "currency": "USD",
                "scope": "institution",
            },
            retrieved_at=retrieved_at,
        )
        for field_name, value in money_values.items()
        if value is not None
    )
    return facts


def _programme_records(
    *,
    target: IpedsTarget,
    programmes: list[dict[str, Any]],
    retrieved_at: str,
    limit: int,
) -> list[dict[str, Any]]:
    aggregated: dict[str, dict[str, Any]] = {}
    for raw in programmes:
        code = str(raw.get("code") or "").strip()
        title = str(raw.get("title") or "").strip().rstrip(".")
        awards = _number((raw.get("counts") or {}).get("ipeds_awards1"))
        if not code or not title or awards is None:
            continue
        item = aggregated.setdefault(
            code,
            {
                "cip_code": code,
                "cip_title": title,
                "completions_total": 0,
                "degree_completions": {},
                "career_outcomes": {},
            },
        )
        item["completions_total"] += int(awards)
        credential_level = int(
            _number((raw.get("credential") or {}).get("level")) or 0
        )
        degree_level = SCORECARD_CREDENTIAL_LEVELS.get(credential_level)
        if degree_level:
            item["degree_completions"][degree_level] = (
                item["degree_completions"].get(degree_level, 0)
                + int(awards)
            )
            earnings = raw.get("earnings") or {}
            one_year = _number(
                (earnings.get("1_yr") or {}).get(
                    "overall_median_earnings"
                )
            )
            five_year = _number(
                (earnings.get("5_yr") or {}).get(
                    "overall_median_earnings"
                )
            )
            if one_year is not None or five_year is not None:
                item["career_outcomes"][degree_level] = {
                    "median_earnings_1_year": one_year,
                    "median_earnings_5_years": five_year,
                    "currency": "USD",
                }
    ranked = sorted(
        aggregated.values(),
        key=lambda item: (
            -int(item["completions_total"]),
            str(item["cip_title"]),
            str(item["cip_code"]),
        ),
    )[:limit]
    return [
        {
            "programme_stat_id": stable_id(
                "scorecard-programme-stat",
                target.unitid,
                str(item["cip_code"]),
                "latest",
            ),
            "institution_id": target.institution_id,
            "ipeds_unitid": target.unitid,
            "selection_rank": rank,
            "selection_basis": "scorecard_ipeds_awards_by_cip",
            "popularity_semantics": (
                "Ranked by latest IPEDS awards exposed by College "
                "Scorecard, not applications or search demand."
            ),
            **item,
            "source_type": "College Scorecard (IPEDS-derived)",
            "source_dataset": "latest.programs.cip_4_digit",
            "source_url": SCORECARD_DATA_URL,
            "data_year": "latest_scorecard_release",
            "retrieved_at": retrieved_at,
            "verification_status": "RULE_VALIDATED",
        }
        for rank, item in enumerate(ranked, start=1)
    ]


def sync_scorecard(
    *,
    targets_path: Path,
    cache_dir: Path,
    output_dir: Path,
    download_missing: bool,
    popular_programme_limit: int = 50,
    fetcher: SafeFetcher | None = None,
    environ: Mapping[str, str] | None = None,
) -> IpedsSyncResult:
    if not 1 <= popular_programme_limit <= 50:
        raise ValueError("popular_programme_limit must be between 1 and 50.")
    config = IpedsTargetConfig.load(targets_path)
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    environment = os.environ if environ is None else environ
    api_key = str(
        environment.get(SCORECARD_API_KEY_ENV) or "DEMO_KEY"
    ).strip()
    fetcher = fetcher or SafeFetcher(
        CrawlLimits(
            request_timeout_seconds=90,
            connect_timeout_seconds=20,
            max_redirects=5,
            min_request_interval_seconds=0.5,
        )
    )
    unitids = tuple(target.unitid for target in config.targets)
    school_payload = _fetch_or_load(
        cache_dir=cache_dir,
        kind="schools-v1",
        unitids=unitids,
        fields=SCHOOL_FIELDS,
        download_missing=download_missing,
        api_key=api_key,
        fetcher=fetcher,
    )
    programme_payload = _fetch_or_load(
        cache_dir=cache_dir,
        kind="programmes-v1",
        unitids=unitids,
        fields=PROGRAMME_FIELDS,
        download_missing=download_missing,
        api_key=api_key,
        fetcher=fetcher,
    )
    schools_by_id = {
        str(row.get("id")): row
        for row in school_payload["results"]
        if isinstance(row, dict) and row.get("id") is not None
    }
    programmes_by_id = {
        str(row.get("id")): row
        for row in programme_payload["results"]
        if isinstance(row, dict) and row.get("id") is not None
    }
    result = IpedsSyncResult(
        target_count=len(config.targets),
        matched_count=0,
        institution_fact_count=0,
        popular_programme_count=0,
        datasets_loaded=[
            "COLLEGE_SCORECARD_LATEST_INSTITUTION",
            "COLLEGE_SCORECARD_LATEST_CIP4",
        ],
        output_dir=str(output_dir),
    )
    if api_key == "DEMO_KEY":
        result.warnings.append(
            "Using api.data.gov DEMO_KEY; use COLLEGE_SCORECARD_API_KEY "
            "for repeat or production runs."
        )
    retrieved_at = utc_now_iso()
    institution_records: list[dict[str, Any]] = []
    institution_facts: list[dict[str, Any]] = []
    popular_programmes: list[dict[str, Any]] = []
    directory_by_id: dict[str, dict[str, str]] = {}
    for target in config.targets:
        row = schools_by_id.get(target.unitid)
        if not row:
            result.missing_targets.append(
                {
                    "institution_id": target.institution_id,
                    "unitid": target.unitid,
                    "name": target.name,
                }
            )
            continue
        result.matched_count += 1
        scorecard_name = str(row.get("school.name") or "")
        institution_records.append(
            {
                "institution_id": target.institution_id,
                "ipeds_unitid": target.unitid,
                "configured_name": target.name,
                "ipeds_name": scorecard_name or None,
                "name_match_requires_review": not names_compatible(
                    target.name,
                    scorecard_name,
                    target.aliases,
                ),
                "source_type": "College Scorecard (IPEDS-derived)",
                "source_dataset": (
                    "College Scorecard latest institution data"
                ),
                "source_url": SCORECARD_DATA_URL,
                "data_year": "latest_scorecard_release",
                "retrieved_at": retrieved_at,
            }
        )
        institution_facts.extend(
            _school_facts(target, row, retrieved_at)
        )
        directory_by_id[target.unitid] = {
            "UNITID": target.unitid,
            "INSTNM": scorecard_name,
            "WEBADDR": str(row.get("school.school_url") or ""),
            "CITY": str(row.get("school.city") or ""),
            "STABBR": str(row.get("school.state") or ""),
        }
        programme_row = programmes_by_id.get(target.unitid) or {}
        raw_programmes = programme_row.get(
            "latest.programs.cip_4_digit"
        )
        if isinstance(raw_programmes, list):
            popular_programmes.extend(
                _programme_records(
                    target=target,
                    programmes=[
                        item
                        for item in raw_programmes
                        if isinstance(item, dict)
                    ],
                    retrieved_at=retrieved_at,
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
    _write_jsonl(
        output_dir / "ipeds_institutions.jsonl",
        institution_records,
    )
    _write_jsonl(
        output_dir / "ipeds_field_assertions.jsonl",
        institution_facts,
    )
    _write_jsonl(
        output_dir / "ipeds_popular_programmes.jsonl",
        popular_programmes,
    )
    _write_json(
        output_dir / "ipeds_manifest.json",
        {
            "schema_version": "GlowBalIPEDS/v1",
            "generated_at": retrieved_at,
            "transport_source": "College Scorecard API",
            "official_data_page": SCORECARD_DATA_URL,
            "api_url": SCORECARD_API_URL,
            "api_key_in_output": False,
            "result": result.to_dict(),
            "precedence_policy": {
                "newer_official_website": 100,
                "newer_common_data_set": 80,
                "direct_ipeds_release_with_known_year": 50,
                "scorecard_ipeds_derived": 45,
                "legacy_validated_csv": 10,
                "rule": (
                    "College Scorecard institution facts never overwrite "
                    "programme-level facts or a newer dated official source."
                ),
            },
        },
    )
    return result
