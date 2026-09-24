from dataclasses import replace

from glowbal_ingestion.evidence_resolution import (
    _explicit_cycle,
    binding_for_assertion,
    resolve_entity_scope,
    resolve_evidence_alignment,
    resolve_provenance,
)
from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import (
    EpistemicState,
    FieldAssertion,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
    VerificationStatus,
)
from glowbal_ingestion.semantic_acceptance import (
    SourceBinding,
    reconcile_assertion_metadata,
    reconsider_assertions,
)


def _source(text: str, **changes) -> ExtractionSource:
    source = ExtractionSource(
        url="https://example.edu/fees",
        page_type="tuition",
        title="Graduate fees",
        text=text,
        content_hash="hash",
        raw_document_id="raw",
        acquisition_run_id="run",
        source_authority=SourceAuthority.OFFICIAL,
        source_relationship=SourceRelationship.DIRECT_OFFICIAL,
        source_class="official_web",
    )
    return replace(source, **changes)


def _assertion(source: ExtractionSource, **changes) -> FieldAssertion:
    assertion = FieldAssertion(
        assertion_id="a",
        entity_type="programme",
        entity_id="programme-1",
        field_name="tuition",
        value_json={
            "credential": "Graduate",
            "amount": 10000,
            "currency": "USD",
            "fee_period": "per year",
        },
        null_reason=None,
        source_url=source.url,
        source_type="official_finance",
        evidence=source.text,
        evidence_locator=None,
        scope="institution",
        audience=None,
        academic_cycle=None,
        retrieved_at="2026-09-12T00:00:00Z",
        confidence=0.8,
        verification_status=VerificationStatus.NEEDS_REVIEW,
        extractor_version="test",
        model_name="test",
        source_content_hash=source.content_hash,
        raw_document_id=source.raw_document_id,
        acquisition_run_id=source.acquisition_run_id,
        source_authority=source.source_authority,
        source_relationship=source.source_relationship,
        epistemic_state=EpistemicState.OBSERVED,
        temporal_state=TemporalState.UNKNOWN,
    )
    return replace(assertion, **changes)


def test_explicit_cycle_accepts_source_native_short_range():
    assert _explicit_cycle("2026-27") == "2026-2027"


def test_explicit_cycle_normalizes_source_native_full_range():
    assert _explicit_cycle("2026-2027") == "2026-2027"


def test_explicit_cycle_rejects_reversed_range():
    assert _explicit_cycle("Academic year 2026-2009") is None


def test_explicit_cycle_does_not_infer_from_unrelated_years():
    assert _explicit_cycle("Founded in 2026; programme code 2027.") is None


def test_explicit_cycle_does_not_infer_from_retrieval_timestamp():
    assert _explicit_cycle("Retrieved at 2026-09-13T14:35:00Z") is None


def test_explicit_cycle_does_not_infer_from_scorecard_cohort_label():
    assert _explicit_cycle("Most Recent Cohorts") is None


def test_alignment_tolerates_replacement_punctuation_and_keeps_exact_offsets():
    source = _source("2026-2027 Tuition USD 10,000 per year.")
    assertion = _assertion(
        source,
        evidence="2026�2027 Tuition USD 10,000 per year.",
    )
    aligned = resolve_evidence_alignment(assertion, source)
    assert aligned.status == "ALIGNED"
    assert aligned.matched_evidence == source.text
    assert source.text[aligned.start_offset : aligned.end_offset] == source.text
    assert aligned.locator == "char:0-38"


def test_repeated_exact_quote_is_not_assumed_to_be_one_table_row():
    source = _source("Item A USD 10,000\nItem A USD 10,000")
    assertion = _assertion(source, evidence="Item A USD 10,000")
    aligned = resolve_evidence_alignment(assertion, source)
    assert aligned.status == "UNRESOLVED"
    assert aligned.reasons == ("EVIDENCE_NOT_IN_SNAPSHOT",)


def test_multiple_money_values_without_column_context_remain_unresolved():
    source = _source("Item A USD 10,000 USD 12,000")
    assertion = _assertion(source, evidence=source.text, value_json={
        "credential": "Graduate", "amount": 10000,
        "currency": "USD", "fee_period": "per year",
    })
    aligned = resolve_evidence_alignment(assertion, source)
    assert aligned.status == "UNRESOLVED"
    assert "COLUMN_ALIGNMENT_UNRESOLVED" in aligned.reasons


def test_multiple_money_values_with_header_are_row_aligned():
    text = "Item | Annual fee | Other fee\nItem A | USD 10,000 | USD 12,000"
    source = _source(text)
    assertion = _assertion(source, evidence="Item A | USD 10,000 | USD 12,000")
    aligned = resolve_evidence_alignment(assertion, source)
    assert aligned.status == "ALIGNED"
    assert aligned.row_aligned is True
    assert aligned.table_header is not None


def test_structured_context_preserves_parser_row_and_scope_metadata():
    text = "Graduate | Annual fee | Other fee\nComputing | USD 10,000 | USD 2,000"
    source = _source(text)
    assertion = _assertion(
        source,
        evidence="Computing | USD 10,000 | USD 2,000",
        value_json={
            "credential": "Graduate",
            "amount": 10000,
            "currency": "USD",
            "fee_period": "per year",
        },
    )
    aligned = resolve_evidence_alignment(
        assertion,
        source,
        structured_context={
            "row_label": "Computing",
            "column_label": "Annual fee",
            "table_header": "Graduate | Annual fee | Other fee",
            "section_title": "Graduate tuition",
            "document_title": "Computing fee schedule",
            "cycle": "2026-2027",
            "scope_hint": "programme",
            "source_entity": "programme-1",
            "selected_value": 10000,
            "row_aligned": True,
        },
    )
    assert aligned.status == "ALIGNED"
    assert aligned.row_label == "Computing"
    assert aligned.column_label == "Annual fee"
    assert aligned.table_header == "Graduate | Annual fee | Other fee"
    assert aligned.section_title == "Graduate tuition"
    assert aligned.document_title == "Computing fee schedule"
    assert aligned.cycle == "2026-2027"
    assert aligned.scope_hint == "programme"
    assert aligned.source_entity == "programme-1"


def test_programme_scope_uses_verified_descendant_url():
    source = _source(
        "Graduate tuition is USD 10,000 per year.",
        url="https://example.edu/programmes/computing/fees",
    )
    assertion = _assertion(source, scope="programme")
    resolved = resolve_entity_scope(
        assertion,
        source,
        target_institution_id="institution-1",
        target_programme={
            "programme_id": "programme-1",
            "official_url": "https://example.edu/programmes/computing",
            "programme_name": "Computing",
        },
    )
    assert resolved.bound is True
    assert (resolved.scope, resolved.entity_id) == ("programme", "programme-1")


def test_faculty_scope_requires_source_proven_unit_identity():
    source = _source("Engineering faculty IELTS minimum 7.0", title="Engineering Faculty")
    assertion = _assertion(source, field_name="ielts_overall", value_json=7.0, scope="faculty")
    resolved = resolve_entity_scope(
        assertion,
        source,
        target_institution_id="institution-1",
        organisation_units=[{
            "organisation_unit_id": "engineering",
            "institution_id": "institution-1",
            "unit_name": "Engineering Faculty",
        }],
    )
    assert resolved.bound is True
    assert (resolved.scope, resolved.organisation_unit_id) == ("faculty", "engineering")


def test_unverified_faculty_never_uses_programme_membership_as_unit_binding():
    source = _source("Faculty IELTS minimum 7.0")
    assertion = _assertion(source, field_name="ielts_overall", value_json=7.0, scope="faculty")
    unresolved = resolve_entity_scope(
        assertion, source, target_institution_id="institution-1",
    )
    assert unresolved.bound is False


def test_unresolved_programme_scope_can_be_widened_to_verified_institution_scope():
    source = _source("Graduate tuition is USD 10,000 per year.")
    assertion = _assertion(source, scope="programme")
    fallback = resolve_entity_scope(
        assertion, source, target_institution_id="institution-1",
        fallback_to_institution=True,
    )
    assert (fallback.scope, fallback.entity_id) == ("institution", "institution-1")


def test_provenance_repairs_only_missing_fields_from_exact_source():
    source = _source("Graduate tuition is USD 10,000 per year.")
    assertion = _assertion(
        source,
        raw_document_id=None,
        source_content_hash=None,
        acquisition_run_id=None,
        source_authority=None,
        source_relationship=None,
    )
    resolved = resolve_provenance(assertion, source)
    assert resolved.status == "REPAIRED"
    assert resolved.assertion.raw_document_id == "raw"
    assert resolved.assertion.source_content_hash == "hash"
    assert resolved.assertion.acquisition_run_id == "run"
    assert resolved.assertion.source_authority == SourceAuthority.OFFICIAL
    assert resolved.assertion.source_relationship == SourceRelationship.DIRECT_OFFICIAL


def test_provenance_does_not_repair_a_different_url_or_hash():
    source = _source("Graduate tuition is USD 10,000 per year.")
    wrong_url = resolve_provenance(
        _assertion(source, source_url="https://other.edu/fees"), source,
    )
    assert wrong_url.status == "MISMATCH"
    wrong_hash = resolve_provenance(
        _assertion(source, source_content_hash="other"), source,
    )
    assert wrong_hash.status == "MISMATCH"


def test_unique_url_binding_repairs_lost_raw_document_identity():
    source = _source("Graduate tuition is USD 10,000 per year.")
    assertion = _assertion(source, raw_document_id=None)
    binding = binding_for_assertion(
        assertion,
        {"raw": SourceBinding(source, "institution-1", "example.edu")},
    )
    assert binding is not None
    assert binding.source.raw_document_id == "raw"


def test_repaired_provenance_and_scope_flow_into_acceptance():
    source = _source("Graduate tuition is USD 10,000 per year.")
    assertion = _assertion(
        source,
        raw_document_id=None,
        source_content_hash=None,
        acquisition_run_id=None,
        source_authority=None,
        source_relationship=None,
    )
    binding = {"raw": SourceBinding(source, "institution-1", "example.edu")}
    reconciled = reconcile_assertion_metadata([assertion], bindings=binding)[0].assertion
    decision = reconsider_assertions(
        [reconciled],
        bindings=binding,
        programmes={"programme-1": {
            "programme_id": "programme-1",
            "institution_id": "institution-1",
            "official_url": "https://example.edu/programme-1",
            "programme_name": "Computing",
        }},
    )[0]
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.epistemic_state == EpistemicState.OBSERVED
    assert decision.assertion.entity_id == "institution-1"
    assert decision.assertion.entity_type == "institution"


def test_unmatched_evidence_remains_review_only():
    source = _source("Graduate tuition is USD 10,000 per year.")
    assertion = _assertion(source, evidence="Graduate tuition is USD 99,000 per year.")
    decision = reconsider_assertions(
        [assertion],
        bindings={"raw": SourceBinding(source, "institution-1", "example.edu")},
        programmes={"programme-1": {"institution_id": "institution-1"}},
    )[0]
    assert decision.assertion.verification_status == VerificationStatus.NEEDS_REVIEW
    assert decision.reasons == ("EVIDENCE_NOT_IN_SNAPSHOT",)
