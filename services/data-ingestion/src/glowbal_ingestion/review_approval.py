from __future__ import annotations

import csv
import json
import os
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

from .models import ELIGIBILITY_FIELDS, has_semantic_value
from .supabase_import import SupabaseRestClient
from .supabase_seeds import _credentials


class ReviewApprovalError(RuntimeError):
    pass


@dataclass(frozen=True)
class ReviewDecision:
    fingerprint: str
    assertion_ids: tuple[str, ...]
    field_name: str
    decision: str
    display_mode: str
    notes: str


@dataclass(frozen=True)
class ReviewApprovalResult:
    run_key: str
    run_id: str | None
    applied: bool
    group_count: int
    assertion_count: int
    decisions: dict[str, int]
    display_modes: dict[str, int]
    run_status: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_key": self.run_key,
            "run_id": self.run_id,
            "applied": self.applied,
            "group_count": self.group_count,
            "assertion_count": self.assertion_count,
            "decisions": dict(self.decisions),
            "display_modes": dict(self.display_modes),
            "run_status": self.run_status,
        }


_DECISION_ALIASES = {
    "duyệt": ("approved", "structured"),
    "duyet": ("approved", "structured"),
    "approved": ("approved", "structured"),
    "approve": ("approved", "structured"),
    "trích dẫn": ("approved", "source_excerpt"),
    "trich dan": ("approved", "source_excerpt"),
    "source_excerpt": ("approved", "source_excerpt"),
    "source excerpt": ("approved", "source_excerpt"),
    "ẩn": ("approved", "hidden"),
    "an": ("approved", "hidden"),
    "hidden": ("approved", "hidden"),
    "từ chối": ("rejected", "hidden"),
    "tu choi": ("rejected", "hidden"),
    "rejected": ("rejected", "hidden"),
    "reject": ("rejected", "hidden"),
    "cần bổ sung": ("needs_more", "source_excerpt"),
    "can bo sung": ("needs_more", "source_excerpt"),
    "needs_more": ("needs_more", "source_excerpt"),
    "needs more": ("needs_more", "source_excerpt"),
}


def normalize_review_decision(value: str) -> tuple[str, str]:
    normalized = " ".join(value.strip().casefold().split())
    result = _DECISION_ALIASES.get(normalized)
    if result is None:
        raise ReviewApprovalError(
            "Unsupported review decision. Use Duyệt, Trích dẫn, Ẩn, "
            "Từ chối, or Cần bổ sung."
        )
    return result


def _split_ids(value: str) -> tuple[str, ...]:
    return tuple(
        sorted(item.strip() for item in value.split("|") if item.strip())
    )


def _load_queue(path: Path) -> tuple[str, dict[str, dict[str, Any]]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReviewApprovalError(f"Invalid review queue: {path}") from exc
    groups = payload.get("review_groups")
    if not isinstance(groups, list):
        raise ReviewApprovalError("review_queue.json has no review_groups.")
    by_fingerprint: dict[str, dict[str, Any]] = {}
    for group in groups:
        if not isinstance(group, dict):
            raise ReviewApprovalError("Invalid review group in queue.")
        fingerprint = str(group.get("review_fingerprint") or "")
        if not fingerprint or fingerprint in by_fingerprint:
            raise ReviewApprovalError(
                "Review queue contains a missing or duplicate fingerprint."
            )
        by_fingerprint[fingerprint] = group
    return path.parent.name, by_fingerprint


def load_review_decisions(
    csv_path: Path,
    queue_path: Path,
) -> tuple[str, list[ReviewDecision]]:
    run_key, queue_groups = _load_queue(queue_path)
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            columns = set(reader.fieldnames or ())
    except (OSError, UnicodeDecodeError, csv.Error) as exc:
        raise ReviewApprovalError(f"Invalid review CSV: {csv_path}") from exc

    required = {
        "run_key",
        "review_fingerprint",
        "field_name",
        "assertion_ids",
        "value_json",
        "evidence",
        "source_url",
        "decision",
        "reviewer_notes",
    }
    missing = sorted(required - columns)
    if missing:
        raise ReviewApprovalError(
            "Review CSV missing columns: " + ", ".join(missing)
        )
    if not rows:
        raise ReviewApprovalError("Review CSV contains no decisions.")

    csv_fingerprints = [
        str(row.get("review_fingerprint") or "").strip() for row in rows
    ]
    if len(set(csv_fingerprints)) != len(csv_fingerprints):
        raise ReviewApprovalError(
            "Review CSV contains duplicate review fingerprints."
        )
    if set(csv_fingerprints) != set(queue_groups):
        raise ReviewApprovalError(
            "Review CSV fingerprints do not exactly match review_queue.json."
        )

    decisions: list[ReviewDecision] = []
    for row_number, row in enumerate(rows, start=2):
        if str(row.get("run_key") or "").strip() != run_key:
            raise ReviewApprovalError(
                f"Unexpected run_key at CSV row {row_number}."
            )
        fingerprint = str(row["review_fingerprint"]).strip()
        group = queue_groups[fingerprint]
        field_name = str(row["field_name"]).strip()
        if field_name != str(group.get("field_name") or ""):
            raise ReviewApprovalError(
                f"Field changed for {fingerprint}."
            )
        assertion_ids = _split_ids(str(row["assertion_ids"]))
        queue_ids = tuple(
            sorted(
                str(member.get("assertion_id") or "")
                for member in (group.get("members") or [])
                if isinstance(member, dict)
            )
        )
        if not assertion_ids or assertion_ids != queue_ids:
            raise ReviewApprovalError(
                f"Assertion IDs changed for {fingerprint}."
            )
        source_url = str(row["source_url"]).strip()
        if source_url != str(group.get("source_url") or ""):
            raise ReviewApprovalError(
                f"Source URL changed for {fingerprint}."
            )
        if not source_url.startswith("https://"):
            raise ReviewApprovalError(
                f"Source URL must use HTTPS at CSV row {row_number}."
            )
        if not str(row["evidence"]).strip():
            raise ReviewApprovalError(
                f"Evidence is empty at CSV row {row_number}."
            )
        try:
            value = json.loads(str(row["value_json"]))
        except json.JSONDecodeError as exc:
            raise ReviewApprovalError(
                f"Invalid value_json at CSV row {row_number}."
            ) from exc
        if value != group.get("value"):
            raise ReviewApprovalError(
                f"Structured value changed for {fingerprint}."
            )
        decision, display_mode = normalize_review_decision(
            str(row["decision"])
        )
        if (
            decision == "approved"
            and display_mode == "structured"
            and not has_semantic_value(value)
        ):
            raise ReviewApprovalError(
                f"{fingerprint} is semantically empty and cannot be "
                "approved as structured data; use Trích dẫn or Ẩn."
            )
        decisions.append(
            ReviewDecision(
                fingerprint=fingerprint,
                assertion_ids=assertion_ids,
                field_name=field_name,
                decision=decision,
                display_mode=display_mode,
                notes=str(row["reviewer_notes"]).strip(),
            )
        )
    return run_key, decisions


def _chunks(
    values: Iterable[str],
    size: int = 12,
) -> Iterable[tuple[str, ...]]:
    batch: list[str] = []
    for value in values:
        batch.append(value)
        if len(batch) == size:
            yield tuple(batch)
            batch = []
    if batch:
        yield tuple(batch)


def _in_filter(values: Iterable[str]) -> str:
    return "in.(" + ",".join(values) + ")"


def _select_run(
    client: SupabaseRestClient,
    run_key: str,
) -> dict[str, Any]:
    rows = client.select(
        "crawl_runs",
        (
            ("select", "id,run_key,status"),
            ("run_key", f"eq.{run_key}"),
            ("limit", "1"),
        ),
    )
    if len(rows) != 1 or not rows[0].get("id"):
        raise ReviewApprovalError(
            f"Expected exactly one Supabase run for {run_key}."
        )
    return rows[0]


def _validate_remote_state(
    client: SupabaseRestClient,
    run_id: str,
    decisions: list[ReviewDecision],
) -> None:
    review_items = client.select(
        "crawl_review_items",
        (
            (
                "select",
                "id,assertion_id,review_fingerprint,status,resolution",
            ),
            ("run_id", f"eq.{run_id}"),
            ("limit", "5000"),
        ),
    )
    assertions = client.select(
        "crawl_field_assertions",
        (
            ("select", "assertion_id,review_fingerprint,is_effective"),
            ("run_id", f"eq.{run_id}"),
            ("is_effective", "eq.true"),
            ("limit", "5000"),
        ),
    )
    expected_fingerprints = {
        decision.fingerprint for decision in decisions
    }
    stored_fingerprints = {
        str(item.get("review_fingerprint") or "")
        for item in review_items
        if item.get("review_fingerprint")
    }
    if stored_fingerprints != expected_fingerprints:
        raise ReviewApprovalError(
            "Supabase review fingerprints do not match the reviewed CSV."
        )
    expected_ids = {
        assertion_id
        for decision in decisions
        for assertion_id in decision.assertion_ids
    }
    review_ids = {
        str(item.get("assertion_id") or "")
        for item in review_items
        if item.get("assertion_id")
    }
    effective_ids = {
        str(item.get("assertion_id") or "") for item in assertions
    }
    if review_ids != expected_ids or not expected_ids.issubset(effective_ids):
        raise ReviewApprovalError(
            "Supabase assertion IDs do not match the reviewed CSV."
        )


def _apply_decisions(
    client: SupabaseRestClient,
    run_id: str,
    csv_path: Path,
    decisions: list[ReviewDecision],
) -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    grouped: dict[tuple[str, str, bool], list[ReviewDecision]] = {}
    for decision in decisions:
        use_for_eligibility = (
            decision.decision == "approved"
            and decision.display_mode == "structured"
            and decision.field_name in ELIGIBILITY_FIELDS
        )
        grouped.setdefault(
            (
                decision.decision,
                decision.display_mode,
                use_for_eligibility,
            ),
            [],
        ).append(decision)

    for (
        decision_name,
        display_mode,
        use_for_eligibility,
    ), group in grouped.items():
        review_status = {
            "approved": "approved",
            "rejected": "rejected",
            "needs_more": "pending",
        }[decision_name]
        for chunk in _chunks(
            sorted(item.fingerprint for item in group)
        ):
            client.update(
                "crawl_review_items",
                {
                    "status": review_status,
                    "reviewed_at": (
                        None if decision_name == "needs_more" else now
                    ),
                    "resolution": {
                        "decision": decision_name,
                        "display_mode": display_mode,
                        "show_source": display_mode != "hidden",
                        "use_for_eligibility": (
                            use_for_eligibility
                        ),
                        "source_file": csv_path.name,
                        "applied_at": now,
                    },
                },
                (
                    ("run_id", f"eq.{run_id}"),
                    ("review_fingerprint", _in_filter(chunk)),
                ),
            )

    for item in decisions:
        if not item.notes:
            continue
        client.update(
            "crawl_review_items",
            {"reviewer_notes": item.notes},
            (
                ("run_id", f"eq.{run_id}"),
                ("review_fingerprint", f"eq.{item.fingerprint}"),
            ),
        )

    structured = [
        item.fingerprint
        for item in decisions
        if item.decision == "approved"
        and item.display_mode == "structured"
    ]
    rejected = [
        item.fingerprint
        for item in decisions
        if item.decision == "rejected"
    ]
    for chunk in _chunks(sorted(structured)):
        client.update(
            "crawl_field_assertions",
            {"verification_status": "HUMAN_VERIFIED"},
            (
                ("run_id", f"eq.{run_id}"),
                ("review_fingerprint", _in_filter(chunk)),
                ("is_effective", "eq.true"),
            ),
        )
    for chunk in _chunks(sorted(rejected)):
        client.update(
            "crawl_field_assertions",
            {"verification_status": "REJECTED"},
            (
                ("run_id", f"eq.{run_id}"),
                ("review_fingerprint", _in_filter(chunk)),
                ("is_effective", "eq.true"),
            ),
        )

    status = (
        "completed"
        if any(item.decision == "needs_more" for item in decisions)
        else "approved"
    )
    client.update(
        "crawl_runs",
        {
            "status": status,
            "notes": (
                "Grouped review applied. Product eligibility is limited to "
                "structured approved facts; excerpts retain source citations."
            ),
        },
        (("id", f"eq.{run_id}"),),
    )
    return status


def process_review_csv(
    csv_path: Path,
    run_dir: Path,
    *,
    apply: bool = False,
    environ: Mapping[str, str] | None = None,
    client: SupabaseRestClient | None = None,
) -> ReviewApprovalResult:
    run_dir = run_dir.resolve()
    queue_path = run_dir / "review_queue.json"
    run_key, decisions = load_review_decisions(csv_path, queue_path)
    decision_counts = Counter(item.decision for item in decisions)
    mode_counts = Counter(item.display_mode for item in decisions)
    assertion_count = sum(len(item.assertion_ids) for item in decisions)
    if not apply:
        return ReviewApprovalResult(
            run_key=run_key,
            run_id=None,
            applied=False,
            group_count=len(decisions),
            assertion_count=assertion_count,
            decisions=dict(decision_counts),
            display_modes=dict(mode_counts),
            run_status=None,
        )

    if client is None:
        base_url, api_key = _credentials(environ or os.environ)
        client = SupabaseRestClient(base_url, api_key)
    run = _select_run(client, run_key)
    run_id = str(run["id"])
    _validate_remote_state(client, run_id, decisions)
    run_status = _apply_decisions(
        client,
        run_id,
        csv_path,
        decisions,
    )
    _validate_remote_state(client, run_id, decisions)
    return ReviewApprovalResult(
        run_key=run_key,
        run_id=run_id,
        applied=True,
        group_count=len(decisions),
        assertion_count=assertion_count,
        decisions=dict(decision_counts),
        display_modes=dict(mode_counts),
        run_status=run_status,
    )
