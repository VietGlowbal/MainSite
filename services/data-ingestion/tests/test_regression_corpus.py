"""Focused regression tests for the regression corpus classifier."""
import pytest

from glowbal_ingestion.models import (
    FieldAssertion,
    VerificationStatus,
    SourceAuthority,
    SourceRelationship,
)
from glowbal_ingestion.regression_corpus import (
    ALIGNMENT_FIXABLE,
    SCOPE_BINDING_FIXABLE,
    PROVENANCE_FIXABLE,
    MULTIPLE_FIXES_REQUIRED,
    REAL_INSUFFICIENT_EVIDENCE,
    HARD_INVALID,
    classify_case,
    classify_corpus,
    corpus_summary,
)


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


class TestClassifyCase:
    def test_alignment_fixable(self):
        a = _make_assertion(validation_errors=["MULTIPLE_AMOUNT_ROW_ALIGNMENT"])
        result = classify_case(a)
        assert result.category == ALIGNMENT_FIXABLE
        assert result.is_fixable is True
        assert result.resolver == "evidence_alignment"

    def test_scope_binding_fixable(self):
        a = _make_assertion(validation_errors=["ORGANISATION_UNIT_UNVERIFIED"])
        result = classify_case(a)
        assert result.category == SCOPE_BINDING_FIXABLE
        assert result.is_fixable is True
        assert result.resolver == "entity_scope"

    def test_provenance_fixable(self):
        a = _make_assertion(validation_errors=["MISSING_PROVENANCE"])
        result = classify_case(a)
        assert result.category == PROVENANCE_FIXABLE
        assert result.is_fixable is True
        assert result.resolver == "provenance"

    def test_multiple_fixes(self):
        a = _make_assertion(validation_errors=[
            "MULTIPLE_AMOUNT_ROW_ALIGNMENT",
            "ORGANISATION_UNIT_UNVERIFIED",
        ])
        result = classify_case(a)
        assert result.category == MULTIPLE_FIXES_REQUIRED
        assert result.is_fixable is True
        assert result.resolver == "multiple"

    def test_hard_invalid(self):
        a = _make_assertion(validation_errors=["WRONG_INSTITUTION"])
        result = classify_case(a)
        assert result.category == HARD_INVALID
        assert result.is_fixable is False

    def test_insufficient_evidence_currency(self):
        a = _make_assertion(validation_errors=["CURRENCY_NOT_ESTABLISHED"])
        result = classify_case(a)
        assert result.category == REAL_INSUFFICIENT_EVIDENCE
        assert result.is_fixable is False

    def test_insufficient_evidence_basis(self):
        a = _make_assertion(validation_errors=["BASIS_NOT_SUPPORTED"])
        result = classify_case(a)
        assert result.category == REAL_INSUFFICIENT_EVIDENCE
        assert result.is_fixable is False

    def test_insufficient_evidence_qualified(self):
        a = _make_assertion(validation_errors=["QUALIFIED_AMOUNT_REQUIRES_REVIEW"])
        result = classify_case(a)
        assert result.category == REAL_INSUFFICIENT_EVIDENCE
        assert result.is_fixable is False

    def test_no_validation_errors(self):
        a = _make_assertion(validation_errors=[])
        result = classify_case(a)
        # Should default to insufficient evidence
        assert result.category == REAL_INSUFFICIENT_EVIDENCE

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.regression_corpus as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"


class TestClassifyCorpus:
    def test_classifies_all_review_cases(self):
        a1 = _make_assertion(assertion_id="a1", validation_errors=["MULTIPLE_AMOUNT_ROW_ALIGNMENT"])
        a2 = _make_assertion(assertion_id="a2", validation_errors=["MISSING_PROVENANCE"])
        a3 = _make_assertion(assertion_id="a3", validation_errors=["WRONG_INSTITUTION"])
        a4 = _make_assertion(assertion_id="a4", validation_errors=["CURRENCY_NOT_ESTABLISHED"])
        a5 = _make_assertion(assertion_id="a5", verification_status=VerificationStatus.RULE_VALIDATED)

        result = classify_corpus([a1, a2, a3, a4, a5])
        assert len(result[ALIGNMENT_FIXABLE]) == 1
        assert len(result[PROVENANCE_FIXABLE]) == 1
        assert len(result[HARD_INVALID]) == 1
        assert len(result[REAL_INSUFFICIENT_EVIDENCE]) == 1
        # a5 is not NEEDS_REVIEW, so not classified
        assert sum(len(v) for v in result.values()) == 4

    def test_summary(self):
        a1 = _make_assertion(assertion_id="a1", validation_errors=["MULTIPLE_AMOUNT_ROW_ALIGNMENT"])
        a2 = _make_assertion(assertion_id="a2", validation_errors=["MISSING_PROVENANCE"])
        classifications = classify_corpus([a1, a2])
        summary = corpus_summary(classifications)
        assert summary["total_review_cases"] == 2
        assert summary["total_fixable"] == 2
        assert summary["by_resolver"]["evidence_alignment"] == 1
        assert summary["by_resolver"]["provenance"] == 1

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.regression_corpus as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"
