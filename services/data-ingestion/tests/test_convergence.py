from __future__ import annotations

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.convergence import (  # noqa: E402
    ProgrammeAcquisitionAdapter,
    assert_converged_canonical_write,
)
from glowbal_ingestion.models import (  # noqa: E402
    EpistemicState,
    FieldAssertion,
    TemporalState,
    VerificationStatus,
)


def make_assertion(value: object = {"amount": 20000}) -> FieldAssertion:
    return FieldAssertion(
        assertion_id="assertion-1",
        entity_type="programme",
        entity_id="programme-1",
        field_name="tuition",
        value_json=value,
        null_reason=None,
        source_url="https://example.edu/ms-cs",
        source_type="programme_finance",
        evidence="Tuition is 20,000 USD.",
        evidence_locator="https://example.edu/ms-cs#fees",
        scope="programme",
        audience="international",
        academic_cycle="2026",
        retrieved_at="2026-08-29T00:00:00+00:00",
        confidence=0.9,
        verification_status=VerificationStatus.RULE_VALIDATED,
        extractor_version="test/v1",
        model_name=None,
        epistemic_state=EpistemicState.OBSERVED,
        temporal_state=TemporalState.CURRENT,
        source_content_hash="hash-1",
        raw_document_id="raw-1",
    )


def test_python_adapter_emits_common_envelope_with_lineage() -> None:
    envelope = ProgrammeAcquisitionAdapter.from_field_assertions(
        [make_assertion()],
        source_url="https://example.edu/ms-cs",
        raw_document_id="raw-1",
        raw_retained=True,
    )

    data = envelope.to_dict()
    assert data["contract_version"] == "ingestion-convergence/v1"
    assert data["source"]["adapter"] == "python_acquisition"
    assert data["raw_evidence"]["retained"] is True
    assert data["assertions"][0]["field"] == "tuition"
    assert data["assertions"][0]["trusted_for_canonical_promotion"] is False
    assert data["assertions"][0]["raw_evidence"]["raw_document_id"] == "raw-1"


def test_python_adapter_marks_missing_raw_lineage_explicitly() -> None:
    data = ProgrammeAcquisitionAdapter.from_field_assertions(
        [make_assertion()], raw_retained=False
    ).to_dict()

    assert data["provenance_limitations"] == ["RAW_EVIDENCE_NOT_RETAINED"]
    assert data["raw_evidence"]["kind"] == "none"


def test_normal_canonical_write_requires_quality_and_v3_promotion() -> None:
    try:
        assert_converged_canonical_write(
            source_path="csv-import",
            quality_passed=False,
            promotion_v3=True,
        )
    except RuntimeError as exc:
        assert "DIRECT_CANONICAL_WRITE_BLOCKED" in str(exc)
    else:
        raise AssertionError("quality failure must block canonical write")


def test_privileged_repair_is_explicitly_separate() -> None:
    assert_converged_canonical_write(
        source_path="curator-repair",
        quality_passed=False,
        promotion_v3=False,
        privileged=True,
    ) is None


def test_empty_python_adapter_input_is_rejected() -> None:
    try:
        ProgrammeAcquisitionAdapter.from_field_assertions([])
    except ValueError as exc:
        assert "at least one assertion" in str(exc)
    else:
        raise AssertionError("empty convergence input must not create a valid envelope")
