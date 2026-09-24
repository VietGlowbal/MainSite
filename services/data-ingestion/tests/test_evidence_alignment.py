"""Focused regression tests for the evidence alignment resolver."""
from dataclasses import replace

import pytest

from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import (
    FieldAssertion,
    VerificationStatus,
    EpistemicState,
    SourceAuthority,
    SourceRelationship,
)
from glowbal_ingestion.evidence_alignment import (
    AlignedEvidence,
    align_evidence,
    reconcile_multiple_amounts,
    resolve_table_row_alignment,
)


def _make_source(**overrides):
    defaults = dict(
        url="https://university.edu/fees",
        page_type="tuition",
        title="Tuition and Fees",
        text="Tuition\nFull tuition, per term $33,360\nLight-load tuition, per unit $1,030\nMinimum $6,180",
        content_hash="hash123",
        raw_document_id="raw123",
        acquisition_run_id="run123",
        source_authority=SourceAuthority.OFFICIAL,
        source_relationship=SourceRelationship.DIRECT_OFFICIAL,
        source_class="official_web",
    )
    defaults.update(overrides)
    return ExtractionSource(**defaults)


def _make_assertion(**overrides):
    defaults = dict(
        assertion_id="a1",
        entity_type="programme",
        entity_id="p1",
        field_name="tuition",
        value_json={"credential": "Graduate", "amount": 33360, "currency": None, "fee_period": "per term"},
        null_reason=None,
        source_url="https://university.edu/fees",
        source_type="tuition",
        evidence="Full tuition, per term $33,360",
        evidence_locator=None,
        scope="institution",
        audience=None,
        academic_cycle=None,
        retrieved_at="2026-09-12T00:00:00Z",
        confidence=0.8,
        verification_status=VerificationStatus.NEEDS_REVIEW,
        extractor_version="test",
        source_content_hash="hash123",
        raw_document_id="raw123",
        acquisition_run_id="run123",
        source_authority=SourceAuthority.OFFICIAL,
        source_relationship=SourceRelationship.DIRECT_OFFICIAL,
        model_name="test",
    )
    defaults.update(overrides)
    return FieldAssertion(**defaults)


class TestAlignEvidence:
    def test_basic_alignment(self):
        source = _make_source()
        a = _make_assertion()
        result = align_evidence(a, source)
        assert isinstance(result, AlignedEvidence)
        assert result.field_name == "tuition"
        assert result.raw_evidence == "Full tuition, per term $33,360"
        assert result.document_title == "Tuition and Fees"

    def test_table_detection(self):
        source = _make_source()
        a = _make_assertion()
        result = align_evidence(a, source)
        assert result.is_table_context is True

    def test_section_title_detection(self):
        source = _make_source(text="Tuition\nFull tuition, per term $33,360")
        a = _make_assertion()
        result = align_evidence(a, source)
        # Should detect "Tuition" as section heading
        assert result.section_title is not None

    def test_cycle_detection(self):
        source = _make_source(text="2026-2027 Tuition\nFull tuition, per term $33,360")
        a = _make_assertion(evidence="Full tuition, per term $33,360")
        result = align_evidence(a, source)
        assert result.cycle == "2026-2027"

    def test_empty_evidence(self):
        source = _make_source()
        a = _make_assertion(evidence=None)
        result = align_evidence(a, source)
        assert "EMPTY_EVIDENCE" in result.alignment_issues

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.evidence_alignment as mod
        import inspect, re
        source = inspect.getsource(mod)
        # Should not contain any specific university names as standalone tokens
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert not re.search(rf"\b{re.escape(name)}\b", source), f"Found hardcoded institution: {name}"


class TestReconcileMultipleAmounts:
    def test_single_amount_no_change(self):
        source = _make_source(text="Tuition: $33,360 per term")
        a = _make_assertion(evidence="Tuition: $33,360 per term")
        result, changes = reconcile_multiple_amounts(a, source)
        assert "MULTIPLE_AMOUNT_ROW_ALIGNMENT" not in changes

    def test_table_with_multiple_amounts(self):
        source = _make_source()
        a = _make_assertion(
            evidence="Full tuition, per term $33,360",
            validation_errors=["MULTIPLE_AMOUNT_ROW_ALIGNMENT"],
        )
        result, changes = reconcile_multiple_amounts(a, source)
        # Should attempt alignment
        assert isinstance(result, FieldAssertion)

    def test_non_table_no_change(self):
        source = _make_source(text="Tuition is $33,360 per term.")
        a = _make_assertion(evidence="Tuition is $33,360 per term.")
        result, changes = reconcile_multiple_amounts(a, source)
        assert changes == []

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.evidence_alignment as mod
        import inspect, re
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert not re.search(rf"\b{re.escape(name)}\b", source), f"Found hardcoded institution: {name}"


class TestResolveTableRowAlignment:
    def test_non_table_returns_unchanged(self):
        source = _make_source(text="Tuition is $33,360 per term.")
        a = _make_assertion(evidence="Tuition is $33,360 per term.")
        result = resolve_table_row_alignment(a, source)
        assert result == a

    def test_table_returns_unchanged_when_cannot_align(self):
        source = _make_source()
        a = _make_assertion()
        result = resolve_table_row_alignment(a, source)
        # Cannot align, returns unchanged
        assert result == a
