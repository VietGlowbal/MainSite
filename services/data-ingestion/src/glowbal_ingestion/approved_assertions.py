from __future__ import annotations

import os
import threading
from typing import Any, Mapping

from .best_assertions import assertion_from_dict
from .models import FieldAssertion
from .supabase_import import SupabaseRestClient
from .supabase_seeds import _credentials


APPROVED_ASSERTION_COLUMNS = (
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
)


class ApprovedAssertionRepository:
    """Read-only access to prior human-approved effective assertions."""

    def __init__(
        self,
        client: SupabaseRestClient | None,
    ) -> None:
        self.client = client
        self._lock = threading.RLock()
        self._cache: dict[str, list[FieldAssertion]] = {}

    @classmethod
    def from_environment(
        cls,
        environ: Mapping[str, str] | None = None,
    ) -> "ApprovedAssertionRepository":
        values = environ or os.environ
        try:
            base_url, api_key = _credentials(values)
        except ValueError:
            return cls(None)
        return cls(SupabaseRestClient(base_url, api_key))

    @property
    def configured(self) -> bool:
        return self.client is not None

    def load(self, programme_id: str) -> list[FieldAssertion]:
        with self._lock:
            cached = self._cache.get(programme_id)
            if cached is not None:
                return list(cached)
        if self.client is None:
            return []
        rows = self.client.select(
            "crawl_field_assertions",
            (
                ("select", ",".join(APPROVED_ASSERTION_COLUMNS)),
                ("entity_type", "eq.programme"),
                ("entity_id", f"eq.{programme_id}"),
                ("verification_status", "eq.HUMAN_VERIFIED"),
                ("is_effective", "eq.true"),
                ("limit", "500"),
            ),
        )
        deduped: dict[str, FieldAssertion] = {}
        for row in rows:
            payload: dict[str, Any] = {
                column: row.get(column)
                for column in APPROVED_ASSERTION_COLUMNS
            }
            payload["validation_errors"] = (
                payload.get("validation_errors") or []
            )
            assertion = assertion_from_dict(payload)
            deduped.setdefault(assertion.assertion_id, assertion)
        assertions = sorted(
            deduped.values(),
            key=lambda item: (
                item.field_name,
                item.source_url or "",
                item.assertion_id,
            ),
        )
        with self._lock:
            self._cache[programme_id] = assertions
        return list(assertions)
