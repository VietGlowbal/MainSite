"""Focused regression tests for the entity/scope resolver."""
from dataclasses import replace

import pytest

from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import (
    FieldAssertion,
    VerificationStatus,
    SourceAuthority,
    SourceRelationship,
)
from glowbal_ingestion.entity_scope_resolver import (
    ResolvedScope,
    resolve_entity_scope,
    bind_scope_to_assertion,
)


def _make_source(**overrides):
    defaults = dict(
        url="https://university.edu/programme/computing",
        page_type="programme_overview",
        title="MS in Computing",
        text="Programme information",
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
        source_url="https://university.edu/programme/computing",
        source_type="tuition",
        evidence="Tuition is $33,360 per year",
        evidence_locator=None,
        scope="programme",
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


PROGRAMMES = {
    "p1": {
        "institution_id": "u1",
        "official_url": "https://university.edu/programme/computing",
        "programme_name": "MS in Computing",
    },
}


class TestResolveEntityScope:
    def test_programme_scope_verified_by_url(self):
        source = _make_source()
        a = _make_assertion(scope="programme")
        result = resolve_entity_scope(a, source, PROGRAMMES)
        assert result.scope == "programme"
        assert result.is_verified is True

    def test_institution_scope_fallback(self):
        source = _make_source(url="https://university.edu/fees/tuition")
        a = _make_assertion(scope="institution", entity_type="institution")
        result = resolve_entity_scope(a, source, PROGRAMMES)
        assert result.scope == "institution"

    def test_faculty_scope_requires_verified_binding(self):
        source = _make_source(page_type="faculty")
        a = _make_assertion(scope="faculty")
        result = resolve_entity_scope(a, source, PROGRAMMES)
        # Without verified org unit, scope should not be faculty
        assert result.scope != "faculty" or not result.is_verified

    def test_institution_fallback_when_no_specific_signals(self):
        source = _make_source(url="https://university.edu/page", title="Some Page")
        a = _make_assertion(scope="subject")
        result = resolve_entity_scope(a, source, PROGRAMMES)
        # Falls back to institution scope when source has a host
        assert result.scope == "institution"

    def test_no_programme_inference_from_membership(self):
        """Faculty scope should NOT be inferred from programme membership."""
        source = _make_source(page_type="programme_overview")
        a = _make_assertion(scope="faculty")
        result = resolve_entity_scope(a, source, PROGRAMMES)
        # Should NOT return faculty just because programme belongs to a faculty
        assert result.scope != "faculty" or not result.is_verified

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.entity_scope_resolver as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"


class TestBindScopeToAssertion:
    def test_binds_verified_programme(self):
        source = _make_source()
        a = _make_assertion(scope="programme")
        result, changes, scope = bind_scope_to_assertion(a, source, PROGRAMMES)
        assert result.scope == "programme"
        assert result.entity_id == "p1"
        assert scope.is_verified is True

    def test_binds_institution_scope(self):
        source = _make_source(url="https://university.edu/fees")
        a = _make_assertion(scope="institution", entity_type="institution")
        result, changes, scope = bind_scope_to_assertion(a, source, PROGRAMMES)
        assert result.scope == "institution"

    def test_binds_institution_when_scope_unknown(self):
        source = _make_source(url="https://university.edu/page")
        a = _make_assertion(scope="unknown", entity_type="institution")
        result, changes, scope = bind_scope_to_assertion(a, source, PROGRAMMES)
        # Falls back to institution scope when source has a host
        assert result.scope == "institution"

    def test_no_institution_specific_rules(self):
        """Verify no institution names are hardcoded."""
        import glowbal_ingestion.entity_scope_resolver as mod
        import inspect
        source = inspect.getsource(mod)
        for name in ["MIT", "Duke", "Stanford", "Harvard", "Columbia", "NYU"]:
            assert name.lower() not in source.lower(), f"Found hardcoded institution: {name}"
