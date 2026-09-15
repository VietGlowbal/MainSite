from dataclasses import replace

import pytest

from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import (FieldAssertion, VerificationStatus, EpistemicState,
                                      TemporalState, SourceAuthority, SourceRelationship)
from glowbal_ingestion.semantic_acceptance import (
    SourceBinding,
    reconcile_assertion_metadata,
    reconsider_assertions,
)


def setup_case(**changes):
    evidence = "Graduate tuition is SGD 12000 per term."
    source = ExtractionSource(url="https://university.edu/graduate/fees", page_type="tuition",
        title="Graduate fees", text=evidence, content_hash="hash", raw_document_id="raw",
        acquisition_run_id="run", source_authority=SourceAuthority.OFFICIAL,
        source_relationship=SourceRelationship.DIRECT_OFFICIAL, source_class="official_web")
    a = FieldAssertion(assertion_id="a", entity_type="programme", entity_id="p", field_name="tuition",
        value_json={"credential":"Graduate", "amount":12000, "currency":"SGD", "fee_period":"per term"},
        null_reason=None, source_url=source.url, source_type="central_finance", evidence=evidence,
        evidence_locator=None, scope="institution", audience=None, academic_cycle=None,
        retrieved_at="2026-09-12T00:00:00Z", confidence=0.8,
        verification_status=VerificationStatus.NEEDS_REVIEW, extractor_version="test", model_name="test",
        source_content_hash="hash", raw_document_id="raw", acquisition_run_id="run",
        source_authority=source.source_authority, source_relationship=source.source_relationship)
    return replace(a, **changes), source


def assess(a, source, **kwargs):
    return reconsider_assertions([a], bindings={"raw":SourceBinding(source,"u","university.edu")},
        programmes={"p":{"institution_id":"u","official_url":"https://university.edu/programme/p","programme_name":"Computing"}},
        target_cycle="2026-2027", **kwargs)[0]


def test_explicit_broader_scope_is_accepted_at_institution():
    a,s=setup_case()
    d=assess(a,s)
    assert d.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert (d.assertion.entity_id,d.assertion.entity_type,d.assertion.scope)==("u","institution","institution")
    assert d.assertion.epistemic_state == EpistemicState.OBSERVED
    assert d.assertion.applicability_state == "UNKNOWN"
    assert d.classification == "ACCEPT_BROADER_SCOPE"


@pytest.mark.parametrize("error", ["MISSING_TUITION_ACADEMIC_CYCLE","MISSING_TUITION_AUDIENCE","MISSING_TUITION_FEE_PERIOD"])
def test_optional_unknown_does_not_reject(error):
    a,s=setup_case(validation_errors=[error])
    a=replace(a,value_json={**a.value_json,"fee_period":None})
    d=assess(a,s)
    assert d.classification == "ACCEPT_BROADER_SCOPE"
    assert d.assertion.academic_cycle is None
    assert d.assertion.audience is None
    assert d.assertion.value_json['fee_period'] is None
    assert d.assertion.temporal_state == TemporalState.UNKNOWN


def test_wrong_institution_rejects():
    a,s=setup_case()
    d=reconsider_assertions([a],bindings={"raw":SourceBinding(s,"wrong","university.edu")},
        programmes={"p":{"institution_id":"u"}})[0]
    assert d.classification == "HARD_INVALID"
    assert d.assertion.verification_status == VerificationStatus.REJECTED


def test_wrong_programme_rejects():
    a,s=setup_case(scope="programme")
    assert assess(a,replace(s,linked_programme_id="other")).classification == "HARD_INVALID"


def test_inferred_claim_rejects():
    a,s=setup_case(epistemic_state=EpistemicState.INFERRED)
    assert assess(a,s).classification == "HARD_INVALID"


def test_unsupported_value_rejects():
    a,s=setup_case()
    a=replace(a,value_json={**a.value_json,"amount":90000})
    assert assess(a,s).classification == "HARD_INVALID"


def test_minimum_degree_cannot_be_completed_from_programme_type():
    a,s=setup_case(field_name="minimum_degree",value_json="bachelor's degree",evidence="Students typically come from STEM fields.")
    assert assess(a,replace(s,text=a.evidence)).classification == "HARD_INVALID"


@pytest.mark.parametrize("field",["raw_document_id","source_content_hash","acquisition_run_id"])
def test_provenance_is_mandatory(field):
    a,s=setup_case(**{field:None})
    assert assess(a,s).assertion.verification_status != VerificationStatus.RULE_VALIDATED


def test_observed_assertion_without_raw_binding_cannot_be_accepted():
    a, _ = setup_case()
    decision = reconsider_assertions(
        [a],
        bindings={},
        programmes={"p": {"institution_id": "u"}},
    )[0]
    assert decision.assertion.verification_status != VerificationStatus.RULE_VALIDATED
    assert decision.reasons == ("MISSING_PROVENANCE",)


def test_snapshot_hash_mismatch_rejects():
    a,s=setup_case(source_content_hash="other")
    assert assess(a,s).classification == "HARD_INVALID"


def test_archive_stays_historical():
    a,s=setup_case()
    d=assess(a,replace(s,temporal_state=TemporalState.HISTORICAL))
    assert d.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert d.assertion.temporal_state == TemporalState.HISTORICAL


def test_old_cycle_is_not_current():
    a,s=setup_case(academic_cycle="2022-2023")
    d=assess(a,replace(s,text=s.text+" Academic year 2022-2023."))
    assert d.assertion.temporal_state == TemporalState.HISTORICAL


def test_search_never_factual():
    a,s=setup_case()
    assert assess(a,replace(s,source_class="search_discovery")).classification == "HARD_INVALID"


def test_material_conflict_never_accepted():
    a,s=setup_case()
    assert assess(a,s,material_conflict_ids=frozenset({"a"})).classification == "CONFLICT"


def test_different_numeric_claims_conflict():
    a,s=setup_case()
    b=replace(a,assertion_id="b",value_json={**a.value_json,"amount":13000},evidence="Graduate tuition is SGD 13000 per term.")
    s=replace(s,text=s.text+" "+b.evidence)
    ds=reconsider_assertions([a,b],bindings={"raw":SourceBinding(s,"u","university.edu")},programmes={"p":{"institution_id":"u"}})
    assert all(d.classification=="CONFLICT" for d in ds)


def test_explicit_bare_dollar_keeps_currency_unknown_at_broader_scope():
    a,s=setup_case()
    s=replace(s,text="Graduate tuition is $12000 per term.")
    a=replace(a,evidence=s.text,value_json={**a.value_json,"currency":"USD"})
    d=assess(a,s)
    assert d.classification == "ACCEPT_BROADER_SCOPE"
    assert d.assertion.value_json["currency"] is None
    assert d.assertion.value_json["currency_symbol"] == "$"


def test_explicit_noncanonical_period_is_retained_as_raw_context_not_normalized():
    quote="MBA tuition for the program is USD 100000."
    a,s=setup_case(evidence=quote, value_json={
        "credential":"MBA", "amount":100000, "currency":"USD", "fee_period":"program",
    })
    d=assess(a,replace(s,text=quote))
    assert d.assertion.verification_status==VerificationStatus.RULE_VALIDATED
    assert d.assertion.value_json["fee_period"] is None
    assert d.assertion.value_json["fee_period_raw"] == "program"


def test_unrelated_snapshot_numbers_do_not_support_amount():
    a,s=setup_case()
    s=replace(s,text=s.text+" Another programme costs SGD 90000.")
    a=replace(a,value_json={**a.value_json,"amount":90000})
    assert assess(a,s).classification=="HARD_INVALID"


def test_existing_hard_rejection_is_not_resurrected():
    a,s=setup_case(verification_status=VerificationStatus.REJECTED,validation_errors=["WRONG_ENTITY"])
    assert assess(a,s).assertion == a


def test_optional_funding_labels_can_be_unknown_without_losing_explicit_detail():
    quote = "Teaching assistants receive salaries and tuition remission."
    a,s=setup_case(field_name="scholarships",evidence=quote,value_json={
        "funding_type":"assistantship","award_name":"Invented award name",
        "details":quote,"eligibility":"all students","amount":None,"currency":None,
        "automatic_consideration":True})
    d=assess(a,replace(s,text=quote))
    assert d.classification=="ACCEPT_BROADER_SCOPE"
    assert d.assertion.value_json['award_name'] is None
    assert d.assertion.value_json['eligibility'] is None
    assert d.assertion.value_json['automatic_consideration'] is None
    assert d.assertion.value_json['details']==quote
    assert d.assertion.assertion_id != a.assertion_id
    assert (d.assertion.raw_document_id,d.assertion.source_content_hash,d.assertion.acquisition_run_id)==('raw','hash','run')


def test_funding_projection_does_not_accept_unsupported_core_details():
    a,s=setup_case(field_name='scholarships',value_json={'funding_type':'unknown','details':'All tuition is paid in full.'})
    assert assess(a,s).assertion.verification_status==VerificationStatus.NEEDS_REVIEW


def test_funding_projection_requires_a_financial_fact():
    quote='UAC will automatically generate an application for the Educational Access Scheme.'
    a,s=setup_case(field_name='scholarships',evidence=quote,value_json={'funding_type':'unknown','details':quote})
    assert assess(a,replace(s,text=quote)).reasons==('FIELD_NOT_SUPPORTED',)


def test_completion_gpa_is_not_admission_gpa():
    quote='You must complete the major requirements with a minimum 2.0 GPA.'
    a,s=setup_case(field_name='minimum_gpa',value_json=2.0,evidence=quote)
    assert assess(a,replace(s,text=quote)).reasons==('ADMISSION_VS_COMPLETION_UNRESOLVED',)


def test_unknown_audience_cannot_hide_a_conflict():
    a,s=setup_case()
    b=replace(a,assertion_id='b',audience='international',value_json={**a.value_json,'amount':13000},
              evidence='International Graduate tuition is SGD 13000 per term.')
    s=replace(s,text=s.text+' '+b.evidence)
    ds=reconsider_assertions([a,b],bindings={'raw':SourceBinding(s,'u','university.edu')},programmes={'p':{'institution_id':'u'}})
    assert all(d.classification=='CONFLICT' for d in ds)


def test_future_does_not_become_current():
    a,s=setup_case()
    assert assess(a,replace(s,temporal_state=TemporalState.FUTURE)).assertion.temporal_state==TemporalState.FUTURE


def test_authority_identity_mismatch_is_hard_block():
    a,s=setup_case(source_authority=SourceAuthority.GOVERNMENT)
    assert assess(a,s).classification=='HARD_INVALID'


def test_exact_external_institution_match_can_accept_broader_scope():
    a, s = setup_case(
        source_url="https://data.example.gov/tuition.csv",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
    )
    s = replace(
        s,
        url=a.source_url,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        external_entity_match=True,
    )
    a = replace(
        a,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
    )
    d = assess(a, s)
    assert d.classification == "ACCEPT_BROADER_SCOPE"
    assert d.assertion.verification_status == VerificationStatus.RULE_VALIDATED


def test_source_native_application_closing_date_supports_final_deadline():
    evidence = "Application closing date: 2026-04-15."
    source_url = "https://api.skolverket.se/susa-navet/emil3/educationEvents/event-1"
    a, s = setup_case(
        field_name="final_deadline",
        value_json="2026-04-15",
        evidence=evidence,
        source_url=source_url,
        source_type="deadline",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
    )
    s = replace(
        s,
        url=source_url,
        page_type="deadline",
        text=evidence,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="susa_navet_event",
        dataset_id="susa-navet-education-events",
        external_entity_match=True,
        linked_programme_id="p",
    )
    a = replace(
        a,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        provider_id="susa_navet_event",
        dataset_id="susa-navet-education-events",
    )
    decision = assess(a, s)
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.field_name == "final_deadline"
    assert "DEADLINE_TYPE_NOT_SUPPORTED" not in decision.reasons


def test_explicit_structured_employment_outcome_is_accepted():
    evidence = "95% In highly skilled work"
    source_text = (
        "Occupation types 15 months after the course. "
        "Data for students graduating 2021-23. "
        f"{evidence} 90% Information Technology Professionals"
    )
    assertion, source = setup_case(
        field_name="employment_outcomes",
        value_json={
            "metric": "in_highly_skilled_work",
            "percentage": 95,
            "period": "15 months after the course",
        },
        evidence=evidence,
        source_url="https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/",
        source_type="career_outcome",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        dataset_id="discover-uni-course-details",
        provider_id="discover_uni_hesa",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="career_outcome",
        text=source_text,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="discover_uni_hesa",
        dataset_id="discover-uni-course-details",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.classification == "ACCEPT_EXACT"
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.value_json["percentage"] == 95
    assert decision.assertion.value_json["period"] == "15 months after the course"


def test_external_structured_standardized_test_is_accepted_when_named_and_thresholded():
    evidence = "IELTS (academic)-test: minimum overall score of 6.0"
    assertion, source = setup_case(
        field_name="standardized_tests",
        value_json={"test": "IELTS (academic)", "minimum_overall_score": 6.0},
        evidence=evidence,
        source_url="https://opintopolku.fi/konfo-backend/valintaperuste/criteria-1",
        source_type="programme_admission",
        scope="programme",
        audience="international",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_content_hash="hash",
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="programme_overview",
        text=evidence,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.value_json["test"] == "IELTS (academic)"
    assert decision.assertion.value_json["minimum_overall_score"] == 6.0
    assert decision.classification in {"ACCEPT_EXACT", "ACCEPT_WITH_UNKNOWN_CONTEXT"}


def test_external_structured_standardized_test_rejects_unsupported_threshold():
    evidence = "GMAT Exam requirement: minimum total score is 530."
    assertion, source = setup_case(
        field_name="standardized_tests",
        value_json={"test": "GMAT", "minimum_total_score": 600},
        evidence=evidence,
        source_url="https://opintopolku.fi/konfo-backend/valintaperuste/criteria-2",
        source_type="programme_admission",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="programme_overview",
        text=evidence,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.assertion.verification_status == VerificationStatus.REJECTED
    assert decision.reasons == ("VALUE_NOT_SUPPORTED",)


def test_external_standardized_test_type_alias_is_source_supported():
    evidence = "TOEFL iBT test: minimum overall score of 78"
    assertion, source = setup_case(
        field_name="standardized_tests",
        value_json={
            "test_type": "TOEFL",
            "test_variant": "TOEFL iBT",
            "minimum_overall_score": 78,
        },
        evidence=evidence,
        source_url="https://opintopolku.fi/konfo-backend/valintaperuste/criteria-3",
        source_type="programme_admission",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="programme_overview",
        text=evidence,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="studyinfo_valintaperuste",
        dataset_id="studyinfo-konfo-valintaperuste",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED


def test_structured_employment_percentage_must_be_in_the_asserted_span():
    evidence = "95% In highly skilled work"
    assertion, source = setup_case(
        field_name="employment_outcomes",
        value_json={
            "metric": "in_highly_skilled_work",
            "percentage": 80,
            "period": "15 months after the course",
        },
        evidence=evidence,
        source_url="https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/",
        source_type="career_outcome",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        dataset_id="discover-uni-course-details",
        provider_id="discover_uni_hesa",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="career_outcome",
        text="Occupation types 15 months after the course. " + evidence,
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="discover_uni_hesa",
        dataset_id="discover-uni-course-details",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.classification == "HARD_INVALID"
    assert decision.reasons == ("VALUE_NOT_SUPPORTED",)


def test_discover_uni_outcome_card_is_supported_when_labelled_context_is_present():
    evidence = (
        "80% of the students go on to work and / or study "
        "Data for students graduating 2022-23 Source: Graduate Outcomes survey "
        "Data from 10 students (75% of those who were asked)"
    )
    assertion, source = setup_case(
        field_name="employment_outcomes",
        value_json={
            "outcome": "80% of the students go on to work and / or study",
            "timeframe": "15 months after the course",
            "cohort": "students graduating 2022-23",
            "data_source": "Graduate Outcomes survey",
            "data_from": "10 students (75% of those who were asked)",
        },
        evidence=evidence,
        source_url="https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/",
        source_type="career_outcome",
        scope="programme",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        dataset_id="discover-uni-course-details",
        provider_id="discover_uni_hesa",
    )
    source = replace(
        source,
        url=assertion.source_url,
        page_type="career_outcome",
        text=(
            "Employment 80% go on to work and/or study 15 months after the course. "
            + evidence
        ),
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="discover_uni_hesa",
        dataset_id="discover-uni-course-details",
        external_entity_match=True,
        linked_programme_id="p",
    )
    decision = assess(assertion, source)
    assert decision.classification == "ACCEPT_EXACT"
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED


def test_negated_degree_requirement_is_not_accepted():
    quote="A bachelor's degree is not required."
    a,s=setup_case(field_name='minimum_degree',value_json="bachelor's degree",evidence=quote)
    assert assess(a,replace(s,text=quote)).reasons==('NEGATED_OR_CONDITIONAL_FACT',)


def test_extraction_provider_identity_is_preserved_separately_from_source():
    a,s=setup_case(provider_id='openai_compatible')
    d=assess(a,s)
    assert d.assertion.verification_status==VerificationStatus.RULE_VALIDATED
    assert d.assertion.provider_id=='openai_compatible'


def test_same_source_table_context_recovers_currency_basis_and_cycle():
    quote="Graduate tuition is 100 per year."
    a,s=setup_case(
        evidence=quote,
        value_json={"credential":"Graduate", "amount":100, "currency":None,
                    "fee_period":"academic_year"},
        academic_cycle=None,
    )
    source=replace(s, text="2026-27 Academic Year Direct Costs (USD) " + quote)
    binding={"raw":SourceBinding(source,"u","university.edu")}
    reconciled=reconcile_assertion_metadata([a],bindings=binding)[0]
    assert reconciled.changes == (
        "EVIDENCE_LOCATOR_PROPAGATED",
        "CURRENCY_FROM_SOURCE_CONTEXT", "BASIS_FROM_SOURCE_CONTEXT", "CYCLE_FROM_SOURCE_CONTEXT")
    assert reconciled.assertion.value_json["currency"] == "USD"
    assert reconciled.assertion.value_json["fee_period"] == "per year"
    assert reconciled.assertion.academic_cycle == "2026-2027"
    accepted=reconsider_assertions([reconciled.assertion],bindings=binding,
        programmes={"p":{"institution_id":"u"}})[0]
    assert accepted.assertion.verification_status == VerificationStatus.RULE_VALIDATED


def test_source_native_french_annual_basis_is_supported():
    quote = "Frais de scolarité: licence 3470 EUR par an."
    assertion, source = setup_case(
        evidence=quote,
        value_json={
            "credential": "licence",
            "amount": 3470,
            "currency": "EUR",
            "fee_period": "year",
            "audience": "all",
        },
        scope="institution",
    )
    source = replace(source, text=quote)
    decision = reconsider_assertions(
        [assertion],
        bindings={"raw": SourceBinding(source, "u", "university.edu")},
        programmes={"p": {"institution_id": "u"}},
    )[0]
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.value_json["fee_period"] == "year"


def test_null_cycle_stays_null_without_source_explicit_academic_cycle():
    a, source = setup_case(academic_cycle=None)
    source = replace(
        source,
        text="Most Recent Cohorts; retrieved 2026-09-13T14:35:00Z; release 2026-2009.",
    )
    reconciled = reconcile_assertion_metadata(
        [a],
        bindings={"raw": SourceBinding(source, "u", "university.edu")},
    )[0]
    assert reconciled.assertion.academic_cycle is None
    assert reconciled.assertion.value_json.get("academic_cycle") is None
    assert "CYCLE_FROM_SOURCE_CONTEXT" not in reconciled.changes


def test_same_source_title_supports_tariff_credential_not_repeated_in_row():
    assertion, base_source = setup_case(
        field_name="additional_fees",
        value_json={
            "credential": "Accelerated Daytime MBA",
            "fee_name": "Health Fee",
            "amount": 1048,
            "currency": "USD",
            "fee_period": "academic_year",
        },
        evidence="Health Fee 524 524 1,048",
    )
    source = replace(
        base_source,
        title="Accelerated Daytime MBA: Tuition and costs",
        text="2026-27 Academic Year Direct Costs (USD)\nHealth Fee 524 524 1,048",
    )
    binding = {"raw": SourceBinding(source, "u", "university.edu")}
    reconciled = reconcile_assertion_metadata([assertion], bindings=binding)[0].assertion
    decision = reconsider_assertions(
        [reconciled],
        bindings=binding,
        programmes={"p": {"institution_id": "u", "official_url": source.url}},
    )[0]
    assert decision.assertion.verification_status == VerificationStatus.RULE_VALIDATED
    assert decision.assertion.value_json["fee_period"] == "per year"


def test_reconciliation_never_derives_currency_from_a_bare_dollar_sign():
    quote="Graduate tuition is $100 per year."
    a,s=setup_case(evidence=quote, value_json={
        "credential":"Graduate", "amount":100, "currency":None, "fee_period":"per year"})
    decision=reconcile_assertion_metadata([a],bindings={"raw":SourceBinding(replace(s,text=quote),"u","university.edu")})[0]
    assert decision.changes == ("EVIDENCE_LOCATOR_PROPAGATED",)
    assert decision.assertion.value_json["currency"] is None


def test_reconciliation_requires_the_exact_bound_source():
    a,s=setup_case()
    decision=reconcile_assertion_metadata([a],bindings={"raw":SourceBinding(replace(s,content_hash="other"),"u","university.edu")})[0]
    assert decision.assertion == a
    assert decision.reasons == ("PROVENANCE_MISMATCH",)


def test_explicit_faculty_fact_keeps_the_verified_organisation_scope():
    quote="Engineering IELTS minimum 7.0."
    a,s=setup_case(field_name="ielts_overall", value_json=7.0, evidence=quote,
                   scope="faculty")
    decisions=reconsider_assertions(
        [a], bindings={"raw":SourceBinding(replace(s, text=quote),"u","university.edu", "faculty-engineering")},
        programmes={"p":{"institution_id":"u"}},
    )
    d=decisions[0]
    assert d.classification=="ACCEPT_BROADER_SCOPE"
    assert (d.assertion.entity_type,d.assertion.entity_id,d.assertion.scope)==(
        "organisation_unit","faculty-engineering","faculty")
    assert d.assertion.applicability_state=="UNKNOWN"


def test_decimal_at_sentence_end_is_explicitly_supported():
    a,s=setup_case(field_name="ielts_overall", value_json=7.0,
                   evidence="IELTS minimum 7.0.", scope="institution")
    d=assess(a,replace(s,text=a.evidence))
    assert d.assertion.verification_status==VerificationStatus.RULE_VALIDATED


def test_historical_broader_observation_is_accepted_but_not_current():
    a,s=setup_case(academic_cycle="2022-2023")
    d=assess(a,replace(s,text=s.text+" 2022-2023",temporal_state=TemporalState.HISTORICAL))
    assert d.classification=="ACCEPT_HISTORICAL"
    assert d.assertion.temporal_state==TemporalState.HISTORICAL


def test_unsupported_funding_detail_is_dropped_when_eligibility_is_explicit():
    quote="International students are not eligible for federal loans."
    a,s=setup_case(field_name="scholarships", evidence=quote, value_json={
        "funding_type":"loan", "award_name":None, "eligibility":quote,
        "details":"A different unsupported explanation.", "amount":None,
        "currency":None,
    })
    d=assess(a,replace(s,text=quote))
    assert d.assertion.verification_status==VerificationStatus.RULE_VALIDATED
    assert d.assertion.value_json["details"] is None
    assert d.assertion.value_json["eligibility"]==quote
