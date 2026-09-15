"""Durable staging boundary for bounded structured external rows.

The crawler keeps the immutable raw object in the raw-evidence store.  This
module provides the additive Postgres staging writer used for bounded derived
rows (for example, selected College Scorecard CSV records) without coupling
the parser to Supabase's REST details.
"""

from __future__ import annotations

import os
from typing import Any, Iterable, Mapping, Protocol, runtime_checkable


class StructuredStagingError(RuntimeError):
    """The derived row could not be durably staged."""


@runtime_checkable
class StructuredStagingStore(Protocol):
    def put_archive_members(
        self,
        records: Iterable[Mapping[str, Any]],
    ) -> int: ...


class InMemoryStructuredStagingStore:
    """Deterministic sink for unit tests; production uses Supabase below."""

    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def put_archive_members(self, records: Iterable[Mapping[str, Any]]) -> int:
        batch = [dict(record) for record in records]
        self.records.extend(batch)
        return len(batch)


class SupabaseStructuredStagingStore:
    """Additive writer for ``crawl_external_structured_rows``."""

    def __init__(self, client: Any, *, table: str = "crawl_external_structured_rows", batch_size: int = 100) -> None:
        if not table:
            raise ValueError("Structured staging table is required.")
        if batch_size < 1 or batch_size > 500:
            raise ValueError("Structured staging batch size must be between 1 and 500.")
        self.client = client
        self.table = table
        self.batch_size = batch_size

    def put_archive_members(self, records: Iterable[Mapping[str, Any]]) -> int:
        total = 0
        batch: list[dict[str, Any]] = []
        for record in records:
            batch.append(self._row(record))
            if len(batch) >= self.batch_size:
                self._insert(batch)
                total += len(batch)
                batch = []
        if batch:
            self._insert(batch)
            total += len(batch)
        return total

    @staticmethod
    def _row(record: Mapping[str, Any]) -> dict[str, Any]:
        raw_object_key = record.get("raw_object_key") or record.get("object_key")
        return {
            "run_id": record.get("acquisition_run_id") or record.get("run_id"),
            "run_key": record.get("acquisition_run_id") or record.get("run_key"),
            "derived_resource_id": record.get("derived_resource_id"),
            "raw_document_id": record.get("raw_document_id"),
            "provider_id": record.get("provider_id"),
            "dataset_id": record.get("dataset_id"),
            "source_class": record.get("source_class"),
            "source_authority": record.get("source_authority"),
            "source_relationship": record.get("source_relationship"),
            "raw_object_key": raw_object_key,
            "raw_content_hash": record.get("raw_content_hash") or record.get("zip_content_hash"),
            "archive_member": record.get("archive_member") or record.get("member_name"),
            "member_content_type": record.get("member_content_type") or "text/csv",
            "institution_id": record.get("institution_id"),
            "programme_id": record.get("programme_id"),
            "academic_cycle": record.get("academic_cycle"),
            "rows": record.get("rows") or [],
            "rows_scanned": record.get("rows_scanned") or 0,
            "rows_retained": record.get("rows_retained") or 0,
            "partial": bool(record.get("partial", False)),
            "bounded_reason": record.get("bounded_reason"),
            "bytes_scanned": record.get("bytes_scanned"),
            "lineage": record.get("lineage") or {},
            "retrieved_at": record.get("retrieved_at"),
        }

    def _insert(self, rows: list[dict[str, Any]]) -> None:
        try:
            self.client.insert(
                self.table,
                rows,
                on_conflict="run_id,derived_resource_id",
            )
        except Exception as exc:
            raise StructuredStagingError(
                "Supabase structured-row staging failed."
            ) from exc


def create_structured_staging_store() -> StructuredStagingStore | None:
    """Build the production writer when Supabase is configured.

    Existing local runs remain unchanged when Supabase is absent (or when
    ``EXTERNAL_STRUCTURED_STAGING_ENABLED=0``). Remote runs automatically use
    the writer when credentials are present; tests inject a deterministic sink.
    """
    enabled = os.environ.get("EXTERNAL_STRUCTURED_STAGING_ENABLED", "auto").strip().lower()
    if enabled in {"0", "false", "no", "off"}:
        return None
    if enabled not in {"1", "true", "yes", "on", "auto", ""}:
        raise StructuredStagingError(
            "EXTERNAL_STRUCTURED_STAGING_ENABLED must be true, false, or auto."
        )
    if enabled == "auto" and not (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    ):
        return None
    try:
        from .supabase_import import SupabaseRestClient
        from .supabase_seeds import _credentials

        base_url, api_key = _credentials(os.environ)
        return SupabaseStructuredStagingStore(SupabaseRestClient(base_url, api_key))
    except Exception as exc:
        raise StructuredStagingError(
            "Structured staging was enabled but Supabase configuration is invalid."
        ) from exc
