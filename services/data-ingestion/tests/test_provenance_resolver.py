"""Focused regression tests for the provenance resolver."""
from dataclasses import replace

import pytest

from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import (
    FieldAssertion,
    VerificationStatus,
    SourceAuthority,
    SourceRelationship,
)
from glowbal_ingestion.provenance_resolver import (
    ProvenanceState,
    validate_provenance,
    repair_provenance,
    repair_provenance_chain,
    provenance_summary,
)


def _make_source(**overrides):
    defaults = dict(
        url="https://university.edu/fees",
        page_type="tuition",
        title="Tuition",
        text="Tuition is $33,360",
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
        value_json={"amount": 33360, "currency": "USD"},
        null_reason=None,
        source_url="https://university.edu/fees",
        source_type="tuition",
        evidence="Tuition is $33,360",
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


class TestValidateProvenance:
    def test_complete_provenance(self):
        source = _make_source()
        a = _make_assertion()
        state = validate_provenance(a, source)
        assert state.is_complete is True
        assert state.has_raw_document_id is True
        assert state.has_content_hash is True
        assert state.has_acquisition_run_id is True
        assert state.has_source_url is True
        assert state.hash_matches_source is True

    def test_missing_raw_document_id(self):
        source = _make_source()
        a = _make_assertion(raw_document_id=None)
        state = validate_provenance(a, source)
        assert state.is_complete is False
        assert "raw_document_id" in state.missing_fields

    def test_missing_content_hash(self):
        source = _make_source()
        a = _make_assertion(source_content_hash=None)
        state = validate_provenance(a, source)
        assert state.is_complete is False
        assert "source_content_hash" in state.missing_fields

    def test_missing_acquisition_run_id(self):
        source = _make_source()
        a = _make_assertion(acquisition_run_id=None)
        state = validate_provenance(a, source)
        assert state.is_complete is False
        assert "acquisition_run_id" in state.missing_fields

    def test_hash_mismatch(self):
        source = _make_source(content_hash="different_hash")
        a = _make_assertion()
        state = validate_provenance(a, source)
        assert state.hash_matches_source is False
        assert "CONTENT_HASH_MISMATCH" in state.issues

    def test_evidence_not_in_source(self):
        source = _make_source(text="XYZZY completely unrelated content plugh 12345")
        # Use evidence >50 chars to trigger the check
        a = _make_assertion(evidence="A" * 60)
        state = validate_provenance(a, source)
        assert "EVIDENCE_NOT_IN_SOURCE_TEXT" in state.issues

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.provenance_resolver as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"


class TestRepairProvenance:
    def test_repairs_missing_authority(self):
        source = _make_source()
        a = _make_assertion(source_authority=None)
        repaired, changes = repair_provenance(a, source)
        assert repaired.source_authority == SourceAuthority.OFFICIAL
        assert "REPAIRED_SOURCE_AUTHORITY" in changes

    def test_repairs_missing_relationship(self):
        source = _make_source()
        a = _make_assertion(source_relationship=None)
        repaired, changes = repair_provenance(a, source)
        assert repaired.source_relationship == SourceRelationship.DIRECT_OFFICIAL
        assert "REPAIRED_SOURCE_RELATIONSHIP" in changes

    def test_no_repair_when_complete(self):
        source = _make_source()
        a = _make_assertion()
        repaired, changes = repair_provenance(a, source)
        assert repaired == a
        assert changes == []

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.provenance_resolver as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"


class TestRepairProvenanceChain:
    def test_repairs_chain(self):
        source = _make_source()
        a = _make_assertion(source_authority=None, source_relationship=None)
        repaired, changes = repair_provenance_chain(a, source)
        assert repaired.source_authority == SourceAuthority.OFFICIAL
        assert repaired.source_relationship == SourceRelationship.DIRECT_OFFICIAL

    def test_reports_missing_when_no_source(self):
        a = _make_assertion(raw_document_id=None, source_content_hash=None)
        repaired, changes = repair_provenance_chain(a, None)
        assert len(changes) > 0

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.provenance_resolver as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"


class TestProvenanceSummary:
    def test_summary_counts(self):
        source = _make_source()
        a1 = _make_assertion(assertion_id="a1")
        a2 = _make_assertion(assertion_id="a2", source_content_hash=None)
        summary = provenance_summary([a1, a2], {"raw123": source})
        assert summary["total"] == 2
        assert summary["complete"] == 1
        assert summary["incomplete"] == 1
        assert summary["missing_content_hash"] == 1
