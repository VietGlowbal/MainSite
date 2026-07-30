from __future__ import annotations

import json
import os
from dataclasses import dataclass
from itertools import chain
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Mapping, Sequence
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from uuid import UUID

from .models import ADMISSION_PACKAGE_FIELDS, HIGH_RISK_FIELDS
from .supabase_seeds import _api_headers, _credentials


MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_JSONL_LINE_BYTES = 5 * 1024 * 1024
DEFAULT_BATCH_SIZE = 100


class SupabaseImportError(RuntimeError):
    pass


@dataclass(frozen=True)
class SupabaseImportResult:
    run_key: str
    run_id: str | None
    applied: bool
    counts: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_key": self.run_key,
            "run_id": self.run_id,
            "applied": self.applied,
            "counts": dict(self.counts),
        }


@dataclass(frozen=True)
class SupabasePreflightResult:
    run_key: str
    project_host: str
    institution_count: int
    linked_university_count: int
    existing_run_status: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_key": self.run_key,
            "project_host": self.project_host,
            "institution_count": self.institution_count,
            "linked_university_count": self.linked_university_count,
            "existing_run_status": self.existing_run_status,
        }


class SupabaseRestClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        opener: Callable[..., object] = urlopen,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.opener = opener

    def _request(
        self,
        table: str,
        *,
        method: str,
        params: Sequence[tuple[str, str]] = (),
        payload: Any = None,
        prefer: str | None = None,
    ) -> Any:
        query = f"?{urlencode(params)}" if params else ""
        endpoint = f"{self.base_url}/rest/v1/{table}{query}"
        headers = _api_headers(self.api_key)
        headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        data = None
        if payload is not None:
            data = json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        request = Request(endpoint, data=data, headers=headers, method=method)
        try:
            with self.opener(request, timeout=30) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
        except HTTPError as exc:
            detail = exc.read(4096).decode("utf-8", errors="replace")
            raise SupabaseImportError(
                f"Supabase {method} {table} failed with HTTP "
                f"{exc.code}: {detail[:1000]}"
            ) from exc
        if len(raw) > MAX_RESPONSE_BYTES:
            raise SupabaseImportError(
                f"Supabase {table} response exceeded 5 MiB."
            )
        if not raw:
            return None
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SupabaseImportError(
                f"Supabase {table} returned invalid JSON."
            ) from exc

    def select(
        self,
        table: str,
        params: Sequence[tuple[str, str]],
    ) -> list[dict[str, Any]]:
        result = self._request(table, method="GET", params=params)
        if not isinstance(result, list):
            raise SupabaseImportError(
                f"Supabase select from {table} did not return a list."
            )
        return result

    def insert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        return_rows: bool = False,
        on_conflict: str | None = None,
    ) -> list[dict[str, Any]]:
        if not rows:
            return []
        params: list[tuple[str, str]] = []
        preferences = [
            "return=representation" if return_rows else "return=minimal"
        ]
        if on_conflict:
            params.append(("on_conflict", on_conflict))
            preferences.append("resolution=merge-duplicates")
        result = self._request(
            table,
            method="POST",
            params=params,
            payload=rows,
            prefer=",".join(preferences),
        )
        if not return_rows:
            return []
        if not isinstance(result, list):
            raise SupabaseImportError(
                f"Supabase insert into {table} did not return rows."
            )
        return result

    def update(
        self,
        table: str,
        values: dict[str, Any],
        params: Sequence[tuple[str, str]],
    ) -> None:
        self._request(
            table,
            method="PATCH",
            params=params,
            payload=values,
            prefer="return=minimal",
        )

    def delete(
        self,
        table: str,
        params: Sequence[tuple[str, str]],
    ) -> None:
        self._request(
            table,
            method="DELETE",
            params=params,
            prefer="return=minimal",
        )


def _load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SupabaseImportError(f"Invalid JSON file: {path}") from exc
    if not isinstance(payload, dict):
        raise SupabaseImportError(f"Expected a JSON object in {path}.")
    return payload


def _iter_jsonl(path: Path, *, required: bool = False) -> Iterator[dict[str, Any]]:
    if not path.exists():
        if required:
            raise SupabaseImportError(f"Missing required artifact: {path}")
        return
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                if len(line.encode("utf-8")) > MAX_JSONL_LINE_BYTES:
                    raise SupabaseImportError(
                        f"JSONL line exceeds 5 MiB: {path}:{line_number}"
                    )
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise SupabaseImportError(
                        f"Invalid JSONL record: {path}:{line_number}"
                    ) from exc
                if not isinstance(record, dict):
                    raise SupabaseImportError(
                        f"Expected JSON object: {path}:{line_number}"
                    )
                yield record
    except OSError as exc:
        raise SupabaseImportError(f"Could not read artifact: {path}") from exc


def _batches(
    records: Iterable[dict[str, Any]],
    batch_size: int,
) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for record in records:
        batch.append(record)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def _with_run_id(
    record: dict[str, Any],
    run_id: str,
    fields: Sequence[str],
    *,
    include_payload: bool = False,
) -> dict[str, Any]:
    transformed = {
        "run_id": run_id,
        **{field: record.get(field) for field in fields},
    }
    if include_payload:
        transformed["payload"] = dict(record)
    return transformed


def _institution_rows(
    run_dir: Path,
    run_id: str,
    university_ids: Mapping[str, int] | None = None,
) -> Iterator[dict[str, Any]]:
    fields = (
        "institution_id",
        "canonical_name",
        "country_code",
        "official_domain",
        "official_url",
        "verification_status",
        "last_checked_at",
    )
    school_profiles = {
        str(record.get("institution_id") or ""): record
        for record in _iter_jsonl(run_dir / "school_profiles.jsonl")
        if record.get("institution_id")
    }
    for record in _iter_jsonl(
        run_dir / "institutions.jsonl",
        required=True,
    ):
        row = _with_run_id(
            record,
            run_id,
            fields,
            include_payload=True,
        )
        profile = school_profiles.get(
            str(record.get("institution_id") or "")
        )
        if profile:
            row["payload"]["school_profile"] = profile
        domain = str(record.get("official_domain") or "").casefold()
        if university_ids and domain in university_ids:
            row["university_id"] = university_ids[domain]
        yield row


def _resolve_university_ids(
    client: SupabaseRestClient,
    run_dir: Path,
) -> dict[str, int]:
    institutions = list(
        _iter_jsonl(run_dir / "institutions.jsonl", required=True)
    )
    resolved: dict[str, int] = {}
    missing: list[str] = []
    duplicates: list[str] = []
    for institution in institutions:
        domain = str(
            institution.get("official_domain") or ""
        ).strip().casefold()
        if not domain:
            raise SupabaseImportError(
                "Every institution must have official_domain before remote import."
            )
        rows = client.select(
            "universities",
            (
                ("select", "id,name,primary_domain"),
                ("primary_domain", f"eq.{domain}"),
                ("limit", "2"),
            ),
        )
        if not rows:
            canonical_name = str(
                institution.get("canonical_name") or ""
            ).strip()
            if canonical_name:
                rows = client.select(
                    "universities",
                    (
                        ("select", "id,name,primary_domain"),
                        ("name", f"ilike.{canonical_name}"),
                        ("limit", "2"),
                    ),
                )
        if not rows:
            missing.append(domain)
            continue
        if len(rows) != 1:
            duplicates.append(domain)
            continue
        raw_id = rows[0].get("id")
        if not isinstance(raw_id, int) or isinstance(raw_id, bool):
            raise SupabaseImportError(
                f"universities.id must be an integer for {domain}."
            )
        resolved[domain] = raw_id
    if missing or duplicates:
        details = []
        if missing:
            details.append("missing=" + ",".join(sorted(missing)))
        if duplicates:
            details.append("duplicate=" + ",".join(sorted(duplicates)))
        raise SupabaseImportError(
            "Could not link crawl institutions to main universities by "
            "primary_domain: " + "; ".join(details)
        )
    return resolved


def preflight_supabase_run(
    run_dir: Path,
    *,
    environ: Mapping[str, str] | None = None,
    client: SupabaseRestClient | None = None,
) -> SupabasePreflightResult:
    run_dir = run_dir.resolve()
    if not run_dir.is_dir():
        raise SupabaseImportError(f"Run directory does not exist: {run_dir}")
    _load_json(run_dir / "manifest.json")
    _load_json(run_dir / "coverage_report.json")
    counts = _plan_counts(run_dir)
    if client is None:
        base_url, api_key = _credentials(environ or os.environ)
        client = SupabaseRestClient(base_url, api_key)
        project_host = urlsplit(base_url).hostname or ""
    else:
        project_host = urlsplit(client.base_url).hostname or "test-client"
    linked = _resolve_university_ids(client, run_dir)
    required_tables = (
        "crawl_runs",
        "crawl_institutions",
        "crawl_organisation_units",
        "crawl_programmes",
        "crawl_programme_organisation_units",
        "crawl_programme_offerings",
        "crawl_sources",
        "crawl_field_assertions",
        "crawl_admission_packages",
        "crawl_admission_requirements",
        "crawl_policy_checks",
        "crawl_url_edges",
        "crawl_errors",
        "crawl_review_items",
    )
    missing_tables: list[str] = []
    for table in required_tables:
        try:
            client.select(table, (("select", "*"), ("limit", "0")))
        except SupabaseImportError as exc:
            if "HTTP 404" in str(exc) or "PGRST205" in str(exc):
                missing_tables.append(table)
                continue
            raise
    if missing_tables:
        raise SupabaseImportError(
            f"Target project linked {len(linked)}/{counts['crawl_institutions']} "
            "universities by primary_domain but is missing staging tables: "
            + ", ".join(missing_tables)
            + ". Apply supabase-crawl-staging.sql before import."
        )
    run_key = run_dir.name
    existing = client.select(
        "crawl_runs",
        (
            ("select", "id,status"),
            ("run_key", f"eq.{run_key}"),
            ("limit", "1"),
        ),
    )
    existing_status = str(existing[0].get("status") or "") if existing else None
    if existing_status not in {None, "failed", "importing"}:
        raise SupabaseImportError(
            f"crawl_runs already contains run_key={run_key} with "
            f"status={existing_status}."
        )
    return SupabasePreflightResult(
        run_key=run_key,
        project_host=project_host,
        institution_count=counts["crawl_institutions"],
        linked_university_count=len(linked),
        existing_run_status=existing_status,
    )


def _programme_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "programme_id",
        "institution_id",
        "programme_name",
        "official_url",
        "degree_level",
        "credential",
        "normalized_field",
        "organisation_unit_id",
        "language",
        "campus",
        "delivery_mode",
        "duration",
        "programme_status",
        "catalogue_source",
        "retrieved_at",
        "verification_status",
        "is_deep_selected",
        "selection_basis",
        "selection_rank",
        "priority_source",
        "priority_rank",
        "priority_label",
        "priority_taxonomy_code",
        "priority_completions_total",
        "priority_degree_completions",
        "priority_match_score",
    )
    for record in _iter_jsonl(
        run_dir / "programmes.jsonl",
        required=True,
    ):
        yield _with_run_id(
            record,
            run_id,
            fields,
            include_payload=True,
        )


def _organisation_unit_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "organisation_unit_id",
        "institution_id",
        "parent_organisation_unit_id",
        "unit_name",
        "unit_type",
        "official_url",
        "source_url",
        "evidence",
        "confidence",
        "verification_status",
        "retrieved_at",
    )
    for record in _iter_jsonl(run_dir / "organisation_units.jsonl"):
        yield _with_run_id(
            record,
            run_id,
            fields,
            include_payload=True,
        )


def _programme_organisation_unit_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "programme_id",
        "organisation_unit_id",
        "relationship_type",
        "is_primary",
        "source_url",
        "evidence",
        "confidence",
        "verification_status",
    )
    for record in _iter_jsonl(
        run_dir / "programme_organisation_units.jsonl"
    ):
        yield _with_run_id(
            record,
            run_id,
            fields,
            include_payload=True,
        )


def _offering_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "programme_offering_id",
        "programme_id",
        "academic_cycle",
        "intake",
        "campus",
        "delivery_mode",
        "audience",
        "application_status",
    )
    for record in _iter_jsonl(run_dir / "programme_offerings.jsonl"):
        yield _with_run_id(
            record,
            run_id,
            fields,
            include_payload=True,
        )


def _source_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "source_id",
        "institution_id",
        "url",
        "canonical_url",
        "page_type",
        "content_type",
        "http_status",
        "retrieved_at",
        "content_hash",
        "raw_object_path",
        "title",
        "language",
        "text_length",
        "fetch_method",
        "rendered",
    )
    seen_source_ids: set[str] = set()
    for record in _iter_jsonl(run_dir / "sources.jsonl"):
        source_id = str(record.get("source_id") or "")
        if source_id in seen_source_ids:
            continue
        seen_source_ids.add(source_id)
        yield _with_run_id(record, run_id, fields)


def _assertion_rows(
    path: Path,
    run_id: str,
    *,
    is_effective: bool,
) -> Iterator[dict[str, Any]]:
    fields = (
        "assertion_id",
        "entity_type",
        "entity_id",
        "field_name",
        "value_json",
        "null_reason",
        "source_url",
        "source_type",
        "evidence",
        "evidence_locator",
        "scope",
        "audience",
        "academic_cycle",
        "retrieved_at",
        "confidence",
        "verification_status",
        "extractor_version",
        "model_name",
        "validation_errors",
        "extraction_group",
        "applicability_source_url",
        "applicability_evidence",
        "source_content_hash",
        "review_fingerprint",
        "inherited_from_assertion_id",
        "inherited_from_entity_id",
        "inheritance_key",
    )
    seen_assertion_ids: set[str] = set()
    for record in _iter_jsonl(path):
        assertion_id = str(record.get("assertion_id") or "")
        if assertion_id and assertion_id in seen_assertion_ids:
            continue
        if assertion_id:
            seen_assertion_ids.add(assertion_id)
        row = _with_run_id(record, run_id, fields)
        if row.get("value_json") is None and not row.get("null_reason"):
            # Rejected semantic-empty assertions have no usable structured
            # value, but the staging schema still requires an explicit reason
            # whenever value_json is null.
            row["null_reason"] = "AMBIGUOUS"
        row["is_effective"] = is_effective
        yield row


def _admission_package_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    for record in _iter_jsonl(run_dir / "admission_packages.jsonl"):
        yield {
            "run_id": run_id,
            "programme_id": record.get("programme_id"),
            "institution_id": record.get("institution_id"),
            "programme_name": record.get("programme_name"),
            "official_url": record.get("official_url"),
            "retrieved_at": record.get("retrieved_at"),
            "precheck": record.get("precheck") or {},
            "payload": {
                key: value
                for key, value in record.items()
                if key not in {"requirements", "precheck"}
            },
        }


def _admission_requirement_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    for package in _iter_jsonl(run_dir / "admission_packages.jsonl"):
        for requirement in package.get("requirements") or []:
            if not isinstance(requirement, dict):
                continue
            yield {
                "run_id": run_id,
                "programme_id": package.get("programme_id"),
                "document_type": requirement.get("document_type"),
                "source_field": requirement.get("source_field"),
                "requirement_status": requirement.get(
                    "requirement_status", "unknown"
                ),
                "required_count": requirement.get("required_count"),
                "count_scope": requirement.get(
                    "count_scope", "document_total"
                ),
                "application_stage": requirement.get(
                    "application_stage", "unknown"
                ),
                "accepted_alternatives": requirement.get(
                    "accepted_alternatives"
                )
                or [],
                "components": requirement.get("components") or [],
                "conflict": bool(requirement.get("conflict")),
                "conflict_reasons": requirement.get("conflict_reasons") or [],
                "evidence": requirement.get("evidence") or [],
            }


def _policy_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "institution_id",
        "domain",
        "robots_url",
        "robots_reachable",
        "robots_allowed",
        "terms_status",
        "terms_url",
        "policy_status",
        "checked_at",
        "notes",
        "sitemaps",
    )
    for record in _iter_jsonl(run_dir / "policy_checks.jsonl"):
        yield _with_run_id(record, run_id, fields)


def _url_edge_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "institution_id",
        "discovered_from",
        "target_url",
        "relation",
        "depth",
        "anchor_text",
        "retrieved_at",
    )
    for record in _iter_jsonl(run_dir / "url_graph_edges.jsonl"):
        yield _with_run_id(record, run_id, fields)


def _error_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    fields = (
        "error_id",
        "institution_id",
        "url",
        "stage",
        "error_code",
        "message",
        "retryable",
        "created_at",
    )
    for record in _iter_jsonl(run_dir / "crawl_errors.jsonl"):
        yield _with_run_id(record, run_id, fields)


def _programme_uuid(record: Mapping[str, Any]) -> str | None:
    if record.get("entity_type") != "programme":
        return None
    value = str(record.get("entity_id") or "")
    try:
        UUID(value)
    except ValueError:
        return None
    return value


def _assertion_review_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    for record in _iter_jsonl(
        run_dir / "effective_field_assertions.jsonl"
    ):
        errors = [
            str(error)
            for error in (record.get("validation_errors") or [])
            if error
        ]
        if (
            record.get("verification_status") != "NEEDS_REVIEW"
            and not errors
        ):
            continue
        field_name = str(record.get("field_name") or "")
        if field_name in ADMISSION_PACKAGE_FIELDS:
            priority = 100
        elif field_name in HIGH_RISK_FIELDS:
            priority = 90
        else:
            priority = 60
        reasons = []
        if record.get("verification_status") == "NEEDS_REVIEW":
            reasons.append("verification_status=NEEDS_REVIEW")
        reasons.extend(errors)
        yield {
            "run_id": run_id,
            "programme_id": _programme_uuid(record),
            "assertion_id": record.get("assertion_id"),
            "field_name": field_name or None,
            "review_fingerprint": record.get("review_fingerprint"),
            "reason": "; ".join(dict.fromkeys(reasons)),
            "priority": priority,
            "status": "pending",
        }


def _admission_conflict_review_rows(
    run_dir: Path,
    run_id: str,
) -> Iterator[dict[str, Any]]:
    for requirement in _admission_requirement_rows(run_dir, run_id):
        if not requirement["conflict"]:
            continue
        reasons = requirement.get("conflict_reasons") or ["CONFLICT"]
        yield {
            "run_id": run_id,
            "programme_id": requirement["programme_id"],
            "assertion_id": None,
            "field_name": requirement["source_field"],
            "review_fingerprint": None,
            "reason": "admission_conflict: " + ", ".join(reasons),
            "priority": 100,
            "status": "pending",
        }


def _count_records(records: Iterable[dict[str, Any]]) -> int:
    return sum(1 for _record in records)


def _plan_counts(run_dir: Path) -> dict[str, int]:
    placeholder = "00000000-0000-0000-0000-000000000000"
    counts = {
        "crawl_institutions": _count_records(
            _institution_rows(run_dir, placeholder)
        ),
        "crawl_organisation_units": _count_records(
            _organisation_unit_rows(run_dir, placeholder)
        ),
        "crawl_programmes": _count_records(
            _programme_rows(run_dir, placeholder)
        ),
        "crawl_programme_organisation_units": _count_records(
            _programme_organisation_unit_rows(run_dir, placeholder)
        ),
        "crawl_programme_offerings": _count_records(
            _offering_rows(run_dir, placeholder)
        ),
        "crawl_sources": _count_records(
            _source_rows(run_dir, placeholder)
        ),
        "crawl_field_assertions": _count_records(
            _assertion_rows(
                run_dir / "field_assertions.jsonl",
                placeholder,
                is_effective=False,
            )
        ),
        "crawl_effective_assertions": _count_records(
            _assertion_rows(
                run_dir / "effective_field_assertions.jsonl",
                placeholder,
                is_effective=True,
            )
        ),
        "crawl_admission_packages": _count_records(
            _admission_package_rows(run_dir, placeholder)
        ),
        "crawl_admission_requirements": _count_records(
            _admission_requirement_rows(run_dir, placeholder)
        ),
        "crawl_policy_checks": _count_records(
            _policy_rows(run_dir, placeholder)
        ),
        "crawl_url_edges": _count_records(
            _url_edge_rows(run_dir, placeholder)
        ),
        "crawl_errors": _count_records(
            _error_rows(run_dir, placeholder)
        ),
    }
    counts["crawl_review_items"] = _count_records(
        _assertion_review_rows(run_dir, placeholder)
    ) + _count_records(
        _admission_conflict_review_rows(run_dir, placeholder)
    )
    if counts["crawl_institutions"] < 1:
        raise SupabaseImportError("Run contains no institutions.")
    if counts["crawl_programmes"] < 1:
        raise SupabaseImportError("Run contains no programmes.")
    return counts


def _insert_batches(
    client: SupabaseRestClient,
    table: str,
    records: Iterable[dict[str, Any]],
    batch_size: int,
    *,
    on_conflict: str | None = None,
) -> None:
    for batch in _batches(records, batch_size):
        client.insert(
            table,
            batch,
            on_conflict=on_conflict,
        )


def import_supabase_run(
    run_dir: Path,
    *,
    apply: bool = False,
    batch_size: int = DEFAULT_BATCH_SIZE,
    environ: Mapping[str, str] | None = None,
    client: SupabaseRestClient | None = None,
) -> SupabaseImportResult:
    run_dir = run_dir.resolve()
    if not run_dir.is_dir():
        raise SupabaseImportError(f"Run directory does not exist: {run_dir}")
    if batch_size < 1 or batch_size > 500:
        raise SupabaseImportError("--batch-size must be between 1 and 500.")

    manifest = _load_json(run_dir / "manifest.json")
    coverage = _load_json(run_dir / "coverage_report.json")
    run_key = run_dir.name
    counts = _plan_counts(run_dir)
    if not apply:
        return SupabaseImportResult(
            run_key=run_key,
            run_id=None,
            applied=False,
            counts=counts,
        )

    if client is None:
        base_url, api_key = _credentials(environ or os.environ)
        client = SupabaseRestClient(base_url, api_key)

    university_ids = _resolve_university_ids(client, run_dir)

    existing = client.select(
        "crawl_runs",
        (
            ("select", "id,status"),
            ("run_key", f"eq.{run_key}"),
            ("limit", "1"),
        ),
    )
    if existing:
        existing_status = str(existing[0].get("status") or "")
        existing_run_id = str(existing[0].get("id") or "")
        if existing_status not in {"failed", "importing"} or not existing_run_id:
            raise SupabaseImportError(
                f"crawl_runs already contains run_key={run_key} with "
                f"status={existing_status}; use a new run directory instead "
                "of overwriting reviewed data."
            )
        run_id = existing_run_id
        client.update(
            "crawl_runs",
            {
                "status": "importing",
                "pipeline_version": manifest.get("schema_version"),
                "config_name": manifest.get("run_name"),
                "started_at": manifest.get("started_at"),
                "finished_at": manifest.get("completed_at"),
                "metrics": coverage.get("metrics") or {},
                "coverage_report": coverage,
                "source_manifest": manifest,
                "notes": None,
            },
            (("id", f"eq.{run_id}"),),
        )
        # These tables use generated identities rather than artifact keys.
        # Clear only rows from the failed import before recreating them.
        client.delete(
            "crawl_review_items",
            (("run_id", f"eq.{run_id}"),),
        )
        client.delete(
            "crawl_url_edges",
            (("run_id", f"eq.{run_id}"),),
        )
    else:
        run_rows = client.insert(
            "crawl_runs",
            [
                {
                "run_key": run_key,
                "pipeline_version": manifest.get("schema_version"),
                "config_name": manifest.get("run_name"),
                "status": "importing",
                "started_at": manifest.get("started_at"),
                "finished_at": manifest.get("completed_at"),
                "metrics": coverage.get("metrics") or {},
                "coverage_report": coverage,
                "source_manifest": manifest,
                }
            ],
            return_rows=True,
        )
        if len(run_rows) != 1 or not run_rows[0].get("id"):
            raise SupabaseImportError(
                "Supabase did not return the new crawl run ID."
            )
        run_id = str(run_rows[0]["id"])

    try:
        _insert_batches(
            client,
            "crawl_institutions",
            _institution_rows(run_dir, run_id, university_ids),
            batch_size,
            on_conflict="run_id,institution_id",
        )
        _insert_batches(
            client,
            "crawl_organisation_units",
            _organisation_unit_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,organisation_unit_id",
        )
        _insert_batches(
            client,
            "crawl_programmes",
            _programme_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,programme_id",
        )
        _insert_batches(
            client,
            "crawl_programme_organisation_units",
            _programme_organisation_unit_rows(run_dir, run_id),
            batch_size,
            on_conflict=(
                "run_id,programme_id,organisation_unit_id"
            ),
        )
        _insert_batches(
            client,
            "crawl_programme_offerings",
            _offering_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,programme_offering_id",
        )
        _insert_batches(
            client,
            "crawl_sources",
            _source_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,source_id",
        )
        _insert_batches(
            client,
            "crawl_field_assertions",
            _assertion_rows(
                run_dir / "field_assertions.jsonl",
                run_id,
                is_effective=False,
            ),
            batch_size,
            on_conflict="run_id,assertion_id",
        )
        _insert_batches(
            client,
            "crawl_field_assertions",
            _assertion_rows(
                run_dir / "effective_field_assertions.jsonl",
                run_id,
                is_effective=True,
            ),
            batch_size,
            on_conflict="run_id,assertion_id",
        )
        _insert_batches(
            client,
            "crawl_admission_packages",
            _admission_package_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,programme_id",
        )
        _insert_batches(
            client,
            "crawl_admission_requirements",
            _admission_requirement_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,programme_id,document_type",
        )
        _insert_batches(
            client,
            "crawl_policy_checks",
            _policy_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,institution_id,domain",
        )
        _insert_batches(
            client,
            "crawl_url_edges",
            _url_edge_rows(run_dir, run_id),
            batch_size,
        )
        _insert_batches(
            client,
            "crawl_errors",
            _error_rows(run_dir, run_id),
            batch_size,
            on_conflict="run_id,error_id",
        )
        _insert_batches(
            client,
            "crawl_review_items",
            chain(
                _assertion_review_rows(run_dir, run_id),
                _admission_conflict_review_rows(run_dir, run_id),
            ),
            batch_size,
        )
        client.update(
            "crawl_runs",
            {"status": "completed"},
            (("id", f"eq.{run_id}"),),
        )
    except Exception as exc:
        try:
            client.update(
                "crawl_runs",
                {
                    "status": "failed",
                    "notes": str(exc)[:1000],
                },
                (("id", f"eq.{run_id}"),),
            )
        except Exception:
            pass
        raise

    return SupabaseImportResult(
        run_key=run_key,
        run_id=run_id,
        applied=True,
        counts=counts,
    )
