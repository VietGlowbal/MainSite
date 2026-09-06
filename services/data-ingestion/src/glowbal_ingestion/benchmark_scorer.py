"""Deterministic scorer for the frozen Phase 3F benchmark.

The scorer consumes a frozen truth JSONL and a separately produced, normalized
benchmark-output JSON document.  It never crawls, fetches, extracts, writes
truth, or invokes the v3 pipeline.  The normalized output contract is an
adapter boundary: pipeline execution must finish before this module is run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping

from .product_safety import BLOCKERS, ProductLifecycleState

SCORER_CONTRACT_VERSION = "phase-3f-scorer-contract/v1"
OUTPUT_SCHEMA_VERSION = "phase3f-v3-benchmark-output/v1"
RESULT_SCHEMA_VERSION = "phase3f-benchmark-score/v1"

REVIEWED_CONFIRMED = "REVIEWED_CONFIRMED"
REVIEWED_AMBIGUOUS = "REVIEWED_AMBIGUOUS"
UNREVIEWED = "UNREVIEWED"

FOUND = "FOUND"
NEEDS_REVIEW = "NEEDS_REVIEW"
NOT_REQUIRED = "NOT_REQUIRED"
NOT_PUBLISHED = "NOT_PUBLISHED"

RUNTIME_STATES = frozenset(
    {
        "NOT_EVALUATED",
        FOUND,
        NOT_PUBLISHED,
        NOT_REQUIRED,
        "SOURCE_NOT_FOUND",
        "ACCESS_BLOCKED",
        "FETCH_FAILED",
        "PARSE_FAILED",
        "EXTRACTION_FAILED",
        "STALE_ONLY",
        "CONFLICTING_SOURCES",
        NEEDS_REVIEW,
    }
)

CRITICAL_FIELDS = (
    "programme_identity",
    "credential",
    "programme_status",
    "tuition",
    "application_deadline",
    "english_requirement",
    "major_admissions_requirement",
)
HIGH_VOLATILITY_FIELDS = frozenset(
    {"programme_status", "tuition", "application_deadline"}
)
RESOLVED_OUTPUT_STATES = frozenset({FOUND, NOT_REQUIRED, NOT_PUBLISHED})
CONFLICT_STATES = frozenset(
    {
        "DETECTED",
        "NEEDS_REVIEW",
        "REQUIRES_REVIEW",
        "UNRESOLVABLE",
    }
)
SAFE_AUTHORITIES = frozenset(
    {"OFFICIAL", "GOVERNMENT", "OFFICIAL_PARTNER"}
)
SAFE_DEADLINE_TYPES = frozenset(
    {"application", "application_deadline", "priority", "final"}
)
SAFE_TUITION_TYPES = frozenset(
    {
        "tuition",
        "programme_tuition",
        "annual_tuition",
        "semester_tuition",
        "per_credit_tuition",
    }
)
TRUTH_STATES = frozenset({FOUND, NEEDS_REVIEW, NOT_REQUIRED, NOT_PUBLISHED, None})
TRUTH_FIELDS = frozenset(CRITICAL_FIELDS)
RETIRED_STATUSES = frozenset({"DISCONTINUED", "HISTORICAL", "RETIRED"})
RAW_PERSISTENCE_FAILURES = frozenset({"RAW_PERSIST_FAILED"})
DETERMINISTIC_ENTAILMENT_PASS = "DETERMINISTIC_PASS"

ERROR_TAXONOMY = (
    "DISCOVERY",
    "SOURCE_SELECTION",
    "FETCH",
    "PARSING",
    "EXTRACTION",
    "APPLICABILITY",
    "TEMPORAL",
    "CONFLICT",
    "RECOVERY",
    "IDENTITY",
    "QUALITY_POLICY",
    "PROMOTION",
    "GROUND_TRUTH_AMBIGUOUS",
)


class BenchmarkScorerError(ValueError):
    """Raised when the frozen scorer input contract cannot be trusted."""


class TruthChecksumMismatch(BenchmarkScorerError):
    """Raised when truth bytes do not match the freeze manifest."""


def sha256_file(path: Path) -> str:
    """Return the SHA-256 digest of exact file bytes."""

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _as_string(value: Any) -> str:
    return str(getattr(value, "value", value))


def _normalise_text(value: str) -> str:
    """Conservatively normalize text without fuzzy matching or translation."""

    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(value.split())


def _normalise_json(value: Any) -> Any:
    if isinstance(value, str):
        return _normalise_text(value)
    if isinstance(value, Mapping):
        return {
            str(key): _normalise_json(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, list):
        return [_normalise_json(item) for item in value]
    if isinstance(value, tuple):
        return [_normalise_json(item) for item in value]
    return value


def _values_equal(expected: Any, actual: Any) -> bool:
    """Compare values exactly after conservative Unicode/whitespace cleanup."""

    if isinstance(expected, (Mapping, list, tuple)) or isinstance(
        actual, (Mapping, list, tuple)
    ):
        return _normalise_json(expected) == _normalise_json(actual)
    if isinstance(expected, str) and isinstance(actual, str):
        return _normalise_text(expected) == _normalise_text(actual)
    return expected == actual


def _manifest_hash(manifest: Mapping[str, Any], name: str) -> str | None:
    direct = manifest.get(f"{name}_sha256")
    if isinstance(direct, str) and direct:
        return direct
    checksums = manifest.get("checksums")
    if isinstance(checksums, Mapping):
        candidate = checksums.get(name)
        if isinstance(candidate, str) and candidate:
            return candidate
    return None


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BenchmarkScorerError(f"Cannot load freeze manifest: {path}") from exc
    if not isinstance(payload, dict):
        raise BenchmarkScorerError("Freeze manifest must be a JSON object.")
    return payload


def load_contract(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BenchmarkScorerError(f"Cannot load scorer contract: {path}") from exc
    if not isinstance(payload, dict):
        raise BenchmarkScorerError("Machine-readable scorer contract must be an object.")
    if payload.get("version") != SCORER_CONTRACT_VERSION:
        raise BenchmarkScorerError(
            f"Unsupported scorer contract version: {payload.get('version')!r}."
        )
    if payload.get("output_schema_version") != OUTPUT_SCHEMA_VERSION:
        raise BenchmarkScorerError(
            "Scorer contract does not identify the supported output schema."
        )
    return payload


def _validate_truth_records(records: list[dict[str, Any]]) -> None:
    """Validate the reviewed truth shape without changing any record."""

    seen: set[str] = set()
    for item in records:
        case_id = item.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            raise BenchmarkScorerError("Truth record has no case_id.")
        if case_id in seen:
            raise BenchmarkScorerError(f"Duplicate truth case ID: {case_id}.")
        seen.add(case_id)
        field = item.get("field")
        if field not in TRUTH_FIELDS:
            raise BenchmarkScorerError(
                f"Truth case {case_id} has unsupported critical field: {field!r}."
            )
        review_status = item.get("review_status")
        if review_status not in {REVIEWED_CONFIRMED, REVIEWED_AMBIGUOUS}:
            raise BenchmarkScorerError(
                f"Truth case {case_id} has non-terminal review status: {review_status!r}."
            )
        expected_state = item.get("expected_state")
        if expected_state not in TRUTH_STATES:
            raise BenchmarkScorerError(
                f"Truth case {case_id} has unsupported expected state: {expected_state!r}."
            )
        if expected_state == FOUND:
            if item.get("expected_value") is None or item.get("expected_value") == "":
                raise BenchmarkScorerError(
                    f"FOUND truth case {case_id} must have an expected value."
                )
        if review_status == REVIEWED_CONFIRMED:
            if expected_state is None:
                raise BenchmarkScorerError(
                    f"Confirmed truth case {case_id} has no expected state."
                )
            if expected_state == NEEDS_REVIEW and item.get("expected_value") is not None:
                raise BenchmarkScorerError(
                    f"Confirmed NEEDS_REVIEW truth must have null value: {case_id}"
                )


def _resolve_artifact_path(manifest_path: Path, reference: object) -> Path:
    if not isinstance(reference, str) or not reference:
        raise BenchmarkScorerError("Freeze manifest is missing an artifact path.")
    candidate = Path(reference)
    if candidate.is_absolute():
        return candidate
    repo_root = manifest_path.resolve().parents[2]
    return repo_root / candidate


def verify_manifest_artifacts(
    *,
    manifest_path: Path,
    manifest: Mapping[str, Any],
    contract: Mapping[str, Any],
    truth_path: Path,
    contract_path: Path,
) -> None:
    """Verify every frozen input digest before scoring; mismatch fails closed."""

    expected_truth_hash = _manifest_hash(manifest, "truth")
    if not expected_truth_hash:
        raise BenchmarkScorerError("Freeze manifest has no truth SHA-256.")
    if sha256_file(truth_path) != expected_truth_hash:
        raise TruthChecksumMismatch(
            f"Frozen truth checksum mismatch: expected {expected_truth_hash}, "
            f"got {sha256_file(truth_path)}."
        )
    expected_machine_hash = _manifest_hash(manifest, "scorer_contract_machine")
    if not expected_machine_hash or sha256_file(contract_path) != expected_machine_hash:
        raise BenchmarkScorerError("Machine-readable scorer contract checksum mismatch.")

    artifact_specs = (
        ("roster", "roster_file"),
        ("scorer_contract", "scorer_contract_file"),
        ("scorer_contract_machine", "scorer_contract_machine_file"),
    )
    for checksum_name, path_name in artifact_specs:
        expected_hash = _manifest_hash(manifest, checksum_name)
        artifact_path = _resolve_artifact_path(manifest_path, manifest.get(path_name))
        if not expected_hash:
            raise BenchmarkScorerError(
                f"Freeze manifest has no {checksum_name} SHA-256."
            )
        if not artifact_path.exists() or sha256_file(artifact_path) != expected_hash:
            raise BenchmarkScorerError(
                f"Frozen {checksum_name} checksum mismatch: {artifact_path}"
            )

    if contract.get("truth_sha256") != expected_truth_hash:
        raise BenchmarkScorerError("Contract truth checksum does not match manifest.")
    if contract.get("truth_version") not in {None, manifest.get("truth_version")}:
        raise BenchmarkScorerError("Contract truth version does not match manifest.")


def load_truth(
    path: Path,
    *,
    manifest: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Load and validate truth; checksum failure is fail-closed."""

    if manifest is not None:
        expected_hash = _manifest_hash(manifest, "truth")
        if not expected_hash:
            raise BenchmarkScorerError("Freeze manifest has no truth SHA-256.")
        actual_hash = sha256_file(path)
        if actual_hash != expected_hash:
            raise TruthChecksumMismatch(
                f"Frozen truth checksum mismatch: expected {expected_hash}, got {actual_hash}."
            )

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise BenchmarkScorerError(f"Cannot read truth JSONL: {path}") from exc

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise BenchmarkScorerError(
                f"Truth JSONL parse failure at line {line_number}."
            ) from exc
        if not isinstance(item, dict):
            raise BenchmarkScorerError(f"Truth line {line_number} is not an object.")
        case_id = item.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            raise BenchmarkScorerError(f"Truth line {line_number} has no case_id.")
        if case_id in seen:
            raise BenchmarkScorerError(f"Duplicate truth case ID: {case_id}.")
        seen.add(case_id)
        records.append(item)

    if manifest is not None:
        expected_total = manifest.get("total_records")
        if isinstance(expected_total, int) and len(records) != expected_total:
            raise BenchmarkScorerError(
                f"Truth record count mismatch: expected {expected_total}, got {len(records)}."
            )
        expected_statuses = {
            REVIEWED_CONFIRMED: manifest.get("reviewed_confirmed"),
            REVIEWED_AMBIGUOUS: manifest.get("reviewed_ambiguous"),
            UNREVIEWED: manifest.get("unreviewed"),
        }
        actual_statuses = Counter(str(item.get("review_status")) for item in records)
        for status, expected in expected_statuses.items():
            if isinstance(expected, int) and actual_statuses[status] != expected:
                raise BenchmarkScorerError(
                    f"Truth status count mismatch for {status}: expected {expected}, "
                    f"got {actual_statuses[status]}."
                )

        expected_ambiguous = set(manifest.get("ambiguous_case_ids") or [])
        actual_ambiguous = {
            str(item["case_id"])
            for item in records
            if item.get("review_status") == REVIEWED_AMBIGUOUS
        }
        if expected_ambiguous != actual_ambiguous:
            raise BenchmarkScorerError(
                "Ambiguous case IDs do not match the freeze manifest."
            )

    _validate_truth_records(records)
    if manifest is not None:
        expected_scoreable = manifest.get("scoreable_records")
        actual_scoreable = sum(
            item.get("review_status") == REVIEWED_CONFIRMED for item in records
        )
        if isinstance(expected_scoreable, int) and actual_scoreable != expected_scoreable:
            raise BenchmarkScorerError(
                f"Truth scoreable count mismatch: expected {expected_scoreable}, "
                f"got {actual_scoreable}."
            )
    return records


def load_output(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BenchmarkScorerError(f"Cannot load benchmark output: {path}") from exc
    if not isinstance(payload, dict):
        raise BenchmarkScorerError("Benchmark output must be a JSON object.")
    if payload.get("schema_version") != OUTPUT_SCHEMA_VERSION:
        raise BenchmarkScorerError(
            f"Unsupported benchmark output schema: {payload.get('schema_version')!r}."
        )
    records = payload.get("records")
    if not isinstance(records, list):
        raise BenchmarkScorerError("Benchmark output records must be a list.")
    seen: set[str] = set()
    for index, item in enumerate(records):
        if not isinstance(item, dict):
            raise BenchmarkScorerError(f"Output record {index} is not an object.")
        case_id = item.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            raise BenchmarkScorerError(f"Output record {index} has no case_id.")
        if case_id in seen:
            raise BenchmarkScorerError(f"Duplicate output case ID: {case_id}.")
        seen.add(case_id)
        state = item.get("state")
        if state not in RUNTIME_STATES:
            raise BenchmarkScorerError(
                f"Output record {case_id} has unknown runtime state: {state!r}."
            )
        if item.get("field") is not None and not isinstance(item.get("field"), str):
            raise BenchmarkScorerError(f"Output record {case_id} has an invalid field.")
        for key in ("target_cycle", "audience"):
            if item.get(key) is not None and not isinstance(item.get(key), (str, list, dict)):
                raise BenchmarkScorerError(
                    f"Output record {case_id} has an invalid {key} value."
                )
    discovery = payload.get("discovery")
    if discovery is not None:
        if not isinstance(discovery, dict):
            raise BenchmarkScorerError("Output discovery must be an object.")
        for key in ("programme_keys", "required_source_keys"):
            values = discovery.get(key)
            if values is not None and (
                not isinstance(values, list)
                or any(not isinstance(value, str) for value in values)
            ):
                raise BenchmarkScorerError(
                    f"Output discovery.{key} must be a list of strings."
                )
    return payload


def _programme_key(case_id: str) -> str | None:
    match = re.match(r"GT-V2-(\d{2})-", case_id)
    if not match:
        return None
    return f"roster-v2-row-{int(match.group(1))}"


def _identity_mismatch(truth: Mapping[str, Any], output: Mapping[str, Any]) -> bool:
    identity = output.get("identity")
    candidates: list[Mapping[str, Any]] = []
    if isinstance(identity, Mapping):
        candidates.append(identity)
        if identity.get("resolved") is False or identity.get("unresolved") is True:
            return True
        resolution_state = str(
            identity.get("resolution_state") or identity.get("decision") or ""
        ).casefold()
        if resolution_state in {"unresolved", "ambiguous", "needs_review"}:
            return True
    candidates.append(output)
    for candidate in candidates:
        for key in ("institution", "programme"):
            actual = candidate.get(key)
            expected = truth.get(key)
            if actual is not None and expected is not None and not _values_equal(expected, actual):
                return True
    return False


def _identity_merge_violation(output: Mapping[str, Any]) -> bool:
    identity = output.get("identity")
    if not isinstance(identity, Mapping):
        identity = output
    if identity.get("fuzzy_only") is True or identity.get("auto_merge_fuzzy_only") is True:
        return True
    basis = str(identity.get("merge_basis") or identity.get("merge_mode") or "").casefold()
    return basis in {"fuzzy", "fuzzy_only", "fuzzy-only"}


def _metadata_error(truth: Mapping[str, Any], output: Mapping[str, Any]) -> str | None:
    field = str(truth.get("field") or "")
    if output.get("field") is not None and output.get("field") != field:
        return "APPLICABILITY"
    target_cycle = output.get("target_cycle")
    if target_cycle is not None and str(target_cycle) != str(truth.get("academic_cycle")):
        return "TEMPORAL"
    audience = output.get("audience")
    if audience is not None and truth.get("audience") is not None:
        if not _values_equal(truth["audience"], audience):
            return "APPLICABILITY"
    if field == "application_deadline":
        deadline_type = output.get("deadline_type")
        if deadline_type is not None and str(deadline_type).casefold() not in SAFE_DEADLINE_TYPES:
            return "APPLICABILITY"
    if field == "tuition":
        fee_type = output.get("fee_type")
        if fee_type is not None and str(fee_type).casefold() not in SAFE_TUITION_TYPES:
            return "APPLICABILITY"
    return None


def _output_has_value(output: Mapping[str, Any]) -> bool:
    for key in ("normalized_value", "value"):
        value = output.get(key)
        if value is not None and value != "":
            return True
    return False


def _comparison_values(
    truth: Mapping[str, Any], output: Mapping[str, Any]
) -> tuple[Any, Any]:
    """Prefer the truth schema's semantic normalization when the adapter emits it."""

    expected_normalized = truth.get("normalized_value")
    actual_normalized = output.get("normalized_value")
    if (
        isinstance(expected_normalized, str)
        and expected_normalized.strip()
        and isinstance(actual_normalized, str)
        and actual_normalized.strip()
    ):
        return expected_normalized, actual_normalized
    return truth.get("expected_value"), output.get("value")


def compare_value(truth: Mapping[str, Any], output: Mapping[str, Any]) -> tuple[bool, str | None]:
    """Return exact field-aware value comparison and a primary error class."""

    metadata_error = _metadata_error(truth, output)
    if metadata_error:
        return False, metadata_error
    if _identity_mismatch(truth, output):
        return False, "IDENTITY"

    field = str(truth.get("field") or "")
    expected, actual = _comparison_values(truth, output)
    if actual is None or actual == "":
        return False, "QUALITY_POLICY"
    if field == "programme_identity" and not _values_equal(expected, actual):
        return False, "IDENTITY"
    if field == "credential" and not _values_equal(expected, actual):
        return False, "IDENTITY"
    if not _values_equal(expected, actual):
        if field == "application_deadline":
            return False, "TEMPORAL"
        if field in {"tuition", "english_requirement", "major_admissions_requirement"}:
            return False, "APPLICABILITY"
        return False, "QUALITY_POLICY"
    return True, None


def _runtime_error_class(state: str | None) -> str:
    return {
        "NOT_EVALUATED": "DISCOVERY",
        "SOURCE_NOT_FOUND": "SOURCE_SELECTION",
        "ACCESS_BLOCKED": "FETCH",
        "FETCH_FAILED": "FETCH",
        "PARSE_FAILED": "PARSING",
        "EXTRACTION_FAILED": "EXTRACTION",
        "STALE_ONLY": "TEMPORAL",
        "CONFLICTING_SOURCES": "CONFLICT",
        NEEDS_REVIEW: "QUALITY_POLICY",
    }.get(str(state), "QUALITY_POLICY")


def product_safe_violations(
    truth: Mapping[str, Any] | None,
    output: Mapping[str, Any],
) -> list[str]:
    """Check the canonical product-safety blockers for a PRODUCT_SAFE record."""

    if output.get("product_state") != ProductLifecycleState.PRODUCT_SAFE.value:
        return []

    violations: list[str] = []
    state = str(output.get("state") or "")
    quality = output.get("quality")
    quality = quality if isinstance(quality, Mapping) else {}
    provenance = output.get("provenance")
    provenance = provenance if isinstance(provenance, Mapping) else {}

    def add(blocker: str) -> None:
        if blocker in BLOCKERS and blocker not in violations:
            violations.append(blocker)

    reported_blockers = quality.get("blockers") or output.get("blockers") or []
    if isinstance(reported_blockers, (list, tuple, set, frozenset)):
        for blocker in reported_blockers:
            add(str(getattr(blocker, "value", blocker)))

    identity = output.get("identity")
    if not isinstance(identity, Mapping):
        add("IDENTITY_UNRESOLVED")
    elif identity.get("resolved") is not True and str(
        identity.get("resolution_state") or identity.get("decision") or ""
    ).upper() not in {"RESOLVED", "CREATED"}:
        add("IDENTITY_UNRESOLVED")
    if truth is not None and _identity_mismatch(truth, output):
        add("IDENTITY_UNRESOLVED")

    if state not in RESOLVED_OUTPUT_STATES:
        if state == "STALE_ONLY":
            add("STALE_CRITICAL_FIELD")
        elif state == "CONFLICTING_SOURCES":
            add("UNRESOLVED_CONFLICT")
        else:
            add("MISSING_CRITICAL_FIELD")
    if not provenance.get("durable") or not provenance.get("raw_document_id") or not provenance.get("assertion_id"):
        add("RAW_LINEAGE_MISSING")
    if provenance.get("supports_claim") is not True:
        add("RAW_LINEAGE_MISSING")
    entailment = provenance.get("evidence_entailment")
    if entailment is not None and entailment != DETERMINISTIC_ENTAILMENT_PASS:
        add("REVIEW_REQUIRED")
    authority = str(provenance.get("source_authority") or "")
    if authority not in SAFE_AUTHORITIES:
        add("INSUFFICIENT_AUTHORITY")
    if quality.get("inferred") is True or str(quality.get("epistemic_state") or "").upper() == "INFERRED":
        add("INFERRED_HIGH_VOLATILITY_CRITICAL")
    if quality.get("verification_required") is True or str(quality.get("verification") or "") in {
        "UNVERIFIED",
        "NEEDS_REVIEW",
    }:
        add("REVIEW_REQUIRED")
    if str(quality.get("conflict_state") or "") in CONFLICT_STATES:
        add("UNRESOLVED_CONFLICT")
    if state == "STALE_ONLY" or (
        truth is not None
        and truth.get("field") in HIGH_VOLATILITY_FIELDS
        and quality.get("temporal_state") not in {None, "CURRENT"}
    ):
        add("STALE_CRITICAL_FIELD")
    if str(quality.get("applicability_state") or "") in {"UNKNOWN", "NOT_APPLICABLE"}:
        add("REVIEW_REQUIRED")
    raw_persistence = quality.get("raw_persistence")
    raw_persistence_code = quality.get("raw_persistence_code") or quality.get(
        "raw_persistence_status"
    )
    if isinstance(raw_persistence, Mapping):
        raw_persistence_code = raw_persistence.get("code") or raw_persistence.get(
            "status"
        )
    raw_persistence_code = raw_persistence_code or output.get("raw_persistence_code")
    if str(raw_persistence_code or "").upper() in RAW_PERSISTENCE_FAILURES:
        # RAW_PERSIST_FAILED is an acquisition-layer code, not a Product Safety
        # blocker. Map it to the canonical missing-lineage blocker rather than
        # creating a second benchmark-only product-safety vocabulary.
        add("RAW_LINEAGE_MISSING")
    entity_status = str(
        quality.get("entity_status") or output.get("entity_status") or ""
    ).upper()
    if quality.get("retired") is True or quality.get("retired_entity") is True or entity_status in RETIRED_STATUSES:
        add("RETIRED_ENTITY")
    if truth is not None and truth.get("review_status") != REVIEWED_CONFIRMED:
        add("REVIEW_REQUIRED")
    if truth is not None and truth.get("review_status") == REVIEWED_CONFIRMED and truth.get("expected_state") == NEEDS_REVIEW:
        add("REVIEW_REQUIRED")
    return violations


def _metric(numerator: int, denominator: int, *, status: str = "AVAILABLE") -> dict[str, Any]:
    return {
        "numerator": numerator,
        "denominator": denominator,
        "value": (numerator / denominator) if denominator else None,
        "status": status if denominator else "NOT_AVAILABLE",
    }


def _discovery_metric(
    discovery: Mapping[str, Any] | None,
    key: str,
) -> dict[str, Any]:
    expected = {f"roster-v2-row-{index}" for index in range(1, 37)}
    if discovery is None or not isinstance(discovery.get(key), list):
        return {"numerator": None, "denominator": 36, "value": None, "status": "NOT_AVAILABLE"}
    actual = {str(item) for item in discovery[key]}
    return _metric(len(expected & actual), len(expected))


def score_records(
    truth: Iterable[Mapping[str, Any]],
    output: Mapping[str, Any],
) -> dict[str, Any]:
    truth_records = [dict(item) for item in truth]
    _validate_truth_records(truth_records)
    raw_output_records = output.get("records", [])
    if not isinstance(raw_output_records, list):
        raise BenchmarkScorerError("Benchmark output records must be a list.")
    output_seen: set[str] = set()
    for item in raw_output_records:
        if not isinstance(item, Mapping):
            raise BenchmarkScorerError("Benchmark output contains a non-object record.")
        case_id = item.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            raise BenchmarkScorerError("Benchmark output record has no case_id.")
        if case_id in output_seen:
            raise BenchmarkScorerError(f"Duplicate output case ID: {case_id}.")
        output_seen.add(case_id)
        if item.get("state") not in RUNTIME_STATES:
            raise BenchmarkScorerError(
                f"Output record {case_id} has unknown runtime state: {item.get('state')!r}."
            )
    truth_by_id = {str(item["case_id"]): item for item in truth_records}
    output_records = {
        str(item["case_id"]): item
        for item in raw_output_records
        if isinstance(item, Mapping)
    }

    ambiguous_ids = {
        str(item["case_id"])
        for item in truth_records
        if item.get("review_status") == REVIEWED_AMBIGUOUS
    }
    scoreable = [
        item
        for item in truth_records
        if item.get("review_status") == REVIEWED_CONFIRMED
    ]

    case_results: list[dict[str, Any]] = []
    errors: Counter[str] = Counter()
    accepted_total = 0
    accepted_correct = 0
    resolved_truth_total = 0
    resolved_truth_correct = 0
    safe_unresolved_total = 0
    safe_unresolved_passes = 0
    coverage_loss = 0
    truth_failures = 0
    product_safe_total = 0
    product_safe_entailment_passes = 0
    false_current = 0
    identity_merge_violations = 0
    unresolved_conflict_promoted = 0
    source_not_found_promoted = 0
    stale_only_promoted = 0
    inferred_promoted = 0
    product_safe_without_lineage = 0

    for truth_item in truth_records:
        case_id = str(truth_item["case_id"])
        output_item = output_records.get(case_id)
        is_ambiguous = case_id in ambiguous_ids
        case_errors: list[str] = []
        product_violations = (
            product_safe_violations(truth_item, output_item)
            if output_item is not None
            else []
        )
        if output_item is not None and output_item.get("product_state") == ProductLifecycleState.PRODUCT_SAFE.value:
            if not is_ambiguous:
                product_safe_total += 1
                if not product_violations:
                    product_safe_entailment_passes += 1
            for violation in product_violations:
                if violation == "RAW_LINEAGE_MISSING":
                    product_safe_without_lineage += 1

        if not is_ambiguous and _identity_merge_violation(output_item or {}):
            identity_merge_violations += 1
            case_errors.append("IDENTITY")

        if is_ambiguous:
            case_outcome = "EXCLUDED_AMBIGUOUS"
            case_errors.append("GROUND_TRUTH_AMBIGUOUS")
        elif output_item is None:
            case_outcome = "MISSING_OUTPUT"
            case_errors.append("DISCOVERY")
            coverage_loss += 1
        else:
            expected_state = truth_item.get("expected_state")
            output_state = output_item.get("state")
            has_value = _output_has_value(output_item)
            if expected_state == FOUND:
                resolved_truth_total += 1
                if output_state == FOUND:
                    accepted_total += 1
                    matched, value_error = compare_value(truth_item, output_item)
                    if matched:
                        accepted_correct += 1
                        resolved_truth_correct += 1
                        case_outcome = "PASS"
                    else:
                        truth_failures += 1
                        case_outcome = "FAIL"
                        case_errors.append(value_error or "QUALITY_POLICY")
                else:
                    coverage_loss += 1
                    case_outcome = "COVERAGE_LOSS"
                    case_errors.append(_runtime_error_class(output_state))
            elif expected_state == NEEDS_REVIEW:
                safe_unresolved_total += 1
                if output_state == NEEDS_REVIEW and not has_value and not product_violations:
                    safe_unresolved_passes += 1
                    case_outcome = "SAFE_UNRESOLVED_PASS"
                elif output_state in {"FETCH_FAILED", "PARSE_FAILED", "EXTRACTION_FAILED", "ACCESS_BLOCKED", "SOURCE_NOT_FOUND", "NOT_EVALUATED", "STALE_ONLY", "CONFLICTING_SOURCES"} and not has_value:
                    coverage_loss += 1
                    case_outcome = "COVERAGE_LOSS"
                    case_errors.append(_runtime_error_class(output_state))
                else:
                    truth_failures += 1
                    case_outcome = "UNSAFE_UNRESOLVED_VALUE"
                    case_errors.append("PROMOTION" if product_violations else "QUALITY_POLICY")
            elif expected_state in {NOT_REQUIRED, NOT_PUBLISHED}:
                resolved_truth_total += 1
                if output_state == expected_state and not has_value:
                    accepted_total += 1
                    accepted_correct += 1
                    resolved_truth_correct += 1
                    case_outcome = "PASS"
                elif output_state in RESOLVED_OUTPUT_STATES:
                    accepted_total += 1
                    truth_failures += 1
                    case_outcome = "FAIL"
                    case_errors.append("QUALITY_POLICY")
                else:
                    coverage_loss += 1
                    case_outcome = "COVERAGE_LOSS"
                    case_errors.append(_runtime_error_class(output_state))
            else:
                truth_failures += 1
                case_outcome = "UNSUPPORTED_TRUTH_STATE"
                case_errors.append("QUALITY_POLICY")

        if (
            not is_ambiguous
            and truth_item.get("review_status") == REVIEWED_CONFIRMED
            and truth_item.get("expected_state") == NEEDS_REVIEW
            and output_item is not None
            and _output_has_value(output_item)
            and output_item.get("state") != NEEDS_REVIEW
        ):
            false_current += 1
            if "PROMOTION" not in case_errors:
                case_errors.append("PROMOTION")

        if not is_ambiguous and output_item is not None:
            output_state = output_item.get("state")
            promoted = _output_has_value(output_item) or output_item.get("product_state") == ProductLifecycleState.PRODUCT_SAFE.value
            if promoted and output_state == "SOURCE_NOT_FOUND":
                source_not_found_promoted += 1
                case_errors.append("SOURCE_SELECTION")
            if promoted and output_state == "STALE_ONLY":
                stale_only_promoted += 1
                case_errors.append("TEMPORAL")
            if promoted and output_state == "CONFLICTING_SOURCES":
                unresolved_conflict_promoted += 1
                case_errors.append("CONFLICT")

        for violation in product_violations:
            if violation == "UNRESOLVED_CONFLICT":
                if not is_ambiguous and not (
                    output_item is not None
                    and output_item.get("state") == "CONFLICTING_SOURCES"
                    and (_output_has_value(output_item) or output_item.get("product_state") == ProductLifecycleState.PRODUCT_SAFE.value)
                ):
                    unresolved_conflict_promoted += 1
                case_errors.append("CONFLICT")
            elif violation == "STALE_CRITICAL_FIELD":
                if not is_ambiguous and not (
                    output_item is not None
                    and output_item.get("state") == "STALE_ONLY"
                    and (_output_has_value(output_item) or output_item.get("product_state") == ProductLifecycleState.PRODUCT_SAFE.value)
                ):
                    stale_only_promoted += 1
                case_errors.append("TEMPORAL")
            elif violation == "INFERRED_HIGH_VOLATILITY_CRITICAL":
                inferred_promoted += 1
                case_errors.append("PROMOTION")
            elif violation == "MISSING_CRITICAL_FIELD" and output_item and output_item.get("state") == "SOURCE_NOT_FOUND":
                if not is_ambiguous and not (
                    _output_has_value(output_item)
                    or output_item.get("product_state") == ProductLifecycleState.PRODUCT_SAFE.value
                ):
                    source_not_found_promoted += 1
                case_errors.append("SOURCE_SELECTION")
            elif violation == "RAW_LINEAGE_MISSING":
                case_errors.append("PROMOTION")
            elif violation == "REVIEW_REQUIRED":
                case_errors.append("QUALITY_POLICY")

        for error_class in dict.fromkeys(case_errors):
            if error_class in ERROR_TAXONOMY:
                errors[error_class] += 1
        case_results.append(
            {
                "case_id": case_id,
                "field": truth_item.get("field"),
                "truth_status": truth_item.get("review_status"),
                "truth_state": truth_item.get("expected_state"),
                "output_state": output_item.get("state") if output_item else None,
                "outcome": case_outcome,
                "error_classes": list(dict.fromkeys(case_errors)),
                "product_safe_violations": product_violations,
                "primary_scoreable": not is_ambiguous,
            }
        )

    discovery = output.get("discovery")
    discovery = discovery if isinstance(discovery, Mapping) else None
    required_source_metric = _discovery_metric(discovery, "required_source_keys")
    programme_discovery_metric = _discovery_metric(discovery, "programme_keys")
    expected_by_institution: dict[str, set[str]] = {}
    for item in truth_records:
        if item.get("field") != "programme_identity":
            continue
        key = _programme_key(str(item["case_id"]))
        institution = str(item.get("institution") or "")
        if key and institution:
            expected_by_institution.setdefault(institution, set()).add(key)
    institution_recall: dict[str, dict[str, Any]] = {}
    violating_institutions: list[str] = []
    if discovery is not None and isinstance(discovery.get("programme_keys"), list):
        discovered = {str(item) for item in discovery["programme_keys"]}
        for institution, expected_keys in sorted(expected_by_institution.items()):
            metric = _metric(len(expected_keys & discovered), len(expected_keys))
            institution_recall[institution] = metric
            if metric["value"] is not None and metric["value"] < 0.80:
                violating_institutions.append(institution)
    institution_floor = {
        "status": "AVAILABLE" if institution_recall else "NOT_AVAILABLE",
        "min_value": min(
            (item["value"] for item in institution_recall.values() if item["value"] is not None),
            default=None,
        ),
        "threshold": 0.80,
        "violating_institutions": violating_institutions,
    }
    metrics = {
        "programme_discovery_recall": programme_discovery_metric,
        "programme_discovery_recall_by_institution": institution_recall,
        "programme_discovery_institution_floor": institution_floor,
        "required_source_discovery_recall": required_source_metric,
        "critical_field_precision": _metric(accepted_correct, accepted_total),
        "critical_field_recall_resolved_coverage": _metric(
            resolved_truth_correct, resolved_truth_total
        ),
        "safe_unresolved_correctness": _metric(
            safe_unresolved_passes, safe_unresolved_total
        ),
        "product_safe_evidence_entailment": _metric(
            product_safe_entailment_passes, product_safe_total
        ),
        "false_current_critical_count": false_current,
        "identity_merge_violations": identity_merge_violations,
        "critical_unresolved_conflict_promoted_count": unresolved_conflict_promoted,
        "critical_source_not_found_promoted_count": source_not_found_promoted,
        "critical_stale_only_promoted_count": stale_only_promoted,
        "prohibited_high_volatility_inferred_critical_promoted_count": inferred_promoted,
        "product_safe_without_durable_provenance_count": product_safe_without_lineage,
        "truth_comparison_failures": truth_failures,
        "coverage_loss_count": coverage_loss,
    }
    return {
        "schema_version": RESULT_SCHEMA_VERSION,
        "truth_version": output.get("truth_version"),
        "run_id": output.get("run_id"),
        "counts": {
            "truth_records": len(truth_records),
            "primary_scoreable_records": len(scoreable),
            "ambiguous_records": len(ambiguous_ids),
            "output_records": len(output_records),
            "truth_state_counts": dict(
                Counter(str(item.get("expected_state")) for item in scoreable)
            ),
        },
        "metrics": metrics,
        "error_counts": dict(errors),
        "cases": case_results,
    }


def score(
    *,
    truth_path: Path,
    manifest_path: Path,
    contract_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    """Verify immutable inputs, then score a normalized output document."""

    manifest = load_manifest(manifest_path)
    contract = load_contract(contract_path)
    verify_manifest_artifacts(
        manifest_path=manifest_path,
        manifest=manifest,
        contract=contract,
        truth_path=truth_path,
        contract_path=contract_path,
    )
    truth = load_truth(truth_path, manifest=manifest)
    output = load_output(output_path)
    expected_truth_version = manifest.get("truth_version")
    if output.get("truth_version") != expected_truth_version:
        raise BenchmarkScorerError("Benchmark output references a different truth version.")
    return score_records(truth, output)


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--truth", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--contract", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--result", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        result = score(
            truth_path=args.truth,
            manifest_path=args.manifest,
            contract_path=args.contract,
            output_path=args.output,
        )
    except BenchmarkScorerError as exc:
        print(f"benchmark scorer refused input: {exc}", file=sys.stderr)
        return 2
    args.result.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "PASS", "result": str(args.result)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
