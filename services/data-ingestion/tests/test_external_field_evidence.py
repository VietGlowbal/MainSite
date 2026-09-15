from __future__ import annotations

from types import SimpleNamespace

from glowbal_ingestion.external_field_evidence import (
    materialize_external_field_evidence,
)
from glowbal_ingestion.acquisition import AcquisitionIntent, EntityRef
from glowbal_ingestion.external_sources import _provider_candidate
from glowbal_ingestion.extraction_provider import ExtractionSource
from glowbal_ingestion.models import ParsedDocument, SourceAuthority, SourceRelationship
from glowbal_ingestion.validation import fact_to_assertion


def _source() -> ExtractionSource:
    return ExtractionSource(
        url="https://example.gov/scorecard.zip",
        page_type="unknown",
        title="scorecard",
        text="unbounded raw source text",
        content_hash="hash-1",
        raw_document_id="raw-1",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="scorecard",
        dataset_id="dataset-1",
        acquisition_run_id="run-1",
        source_resolution="institution",
    )


def test_structured_materializer_selects_only_configured_identifier_and_keeps_lineage() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="zip-document",
        parser_version="v1",
        text="raw rows",
        structured_payload={"members": [{
            "member_name": "rows.csv",
            "structured": [
                {"UNITID": "1", "INSTNM": "Other", "TUITIONFEE_IN": "999"},
                {"UNITID": "2", "INSTNM": "Target", "TUITIONFEE_IN": "12345"},
            ],
        }]},
    )
    seed = SimpleNamespace(provider_identifiers={"scorecard": {"UNITID": "2"}})
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "institution",
            "identity_fields": ["UNITID"],
            "field_mappings": [{
                "field": "tuition", "column": "TUITIONFEE_IN",
                "label": "Annual tuition and fees", "currency": "USD", "basis": "annual",
            }],
        }},
        seed=seed,
    )
    assert decision.entity_match is True
    assert decision.matching_signals == ("UNITID=2",)
    assert "12345" in source.text
    assert "999" not in source.text
    assert source.raw_document_id == "raw-1"
    assert source.content_hash == "hash-1"
    assert source.provider_id == "scorecard"
    assert source.external_entity_match is True


def test_structured_materializer_keeps_snapshot_context_distinct_from_academic_cycle() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="zip-document",
        parser_version="v1",
        text="raw rows",
        structured_payload={"members": [{
            "member_name": "Most-Recent-Cohorts-Institution.csv",
            "structured": [{"UNITID": "2", "TUITIONFEE_IN": "12345"}],
        }]},
    )
    source, _ = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(**{**_source().__dict__, "retrieved_at": "2026-09-13T00:00:00+00:00"}),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "institution",
            "identity_fields": ["UNITID"],
            "source_temporal_context": "Most-Recent-Cohorts-Institution.csv has no academic-cycle field.",
            "field_mappings": [{"field": "tuition", "column": "TUITIONFEE_IN"}],
        }},
        seed=SimpleNamespace(provider_identifiers={"scorecard": {"UNITID": "2"}}),
    )
    assert source.academic_cycle is None
    assert source.source_temporal_context == "Most-Recent-Cohorts-Institution.csv has no academic-cycle field."
    assert "Raw snapshot retrieved at: 2026-09-13T00:00:00+00:00" in source.text


def test_structured_materializer_does_not_claim_match_for_unmapped_row() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1", parser_id="zip", parser_version="v1", text="raw",
        structured_payload={"members": [{"structured": [{"UNITID": "1", "TUITIONFEE_IN": "999"}]}]},
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {"kind": "structured_rows", "identity_fields": ["UNITID"]}},
        seed=SimpleNamespace(provider_identifiers={"scorecard": {"UNITID": "2"}}),
    )
    assert decision.entity_match is False
    assert decision.reason == "no_matching_structured_record"
    assert source.text == "raw"


def test_structured_materializer_accepts_direct_csv_or_json_row_lists() -> None:
    """Direct machine-readable resources need no synthetic ZIP envelope."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="csv-structured",
        parser_version="2",
        text="UNITID,tuition\n2,12345",
        structured_payload=[
            {"UNITID": "1", "tuition": "999"},
            {"UNITID": "2", "tuition": "12345"},
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "institution",
            "identity_fields": ["UNITID"],
            "field_mappings": [{"field": "tuition", "column": "tuition"}],
        }},
        seed=SimpleNamespace(provider_identifiers={"scorecard": {"UNITID": "2"}}),
    )
    assert decision.entity_match is True
    assert decision.record_count == 1
    assert "12345" in source.text
    assert "999" not in source.text


def test_structured_materializer_uses_declared_record_title_for_programme_identity() -> None:
    """Titleless JSON records can still carry source-native programme identity."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text="selection criteria",
        structured_payload=[
            {
                "id": "criteria-1",
                "nimi": {"en": "Master of Sustainable Aviation Business"},
                "metadata": {"hakukelpoisuus": {"en": "At least two years of work experience."}},
            }
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(**{
            **_source().__dict__,
            "provider_id": "studyinfo_valintaperuste",
            "linked_programme_id": "programme-1",
        }),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "title": "Studyinfo selection criteria",
            "title_column": "nimi.en",
            "identity_fields": ["id"],
            "field_mappings": [{
                "field": "work_experience",
                "column": "metadata.hakukelpoisuus.en",
            }],
        }},
        seed=SimpleNamespace(
            provider_programme_identifiers={
                "programme-1": {
                    "studyinfo_valintaperuste": {"id": "criteria-1"},
                },
            },
        ),
    )
    assert decision.entity_match is True
    assert source.title == "Studyinfo selection criteria: Master of Sustainable Aviation Business"
    assert "two years of work experience" in source.text


def test_structured_materializer_places_mapping_guidance_after_literal_values() -> None:
    """Source-excerpt fallback must see data before non-evidence guidance."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text="selection criteria",
        structured_payload=[
            {
                "id": "criteria-1",
                "nimi": {"en": "Information Technology 2026"},
                "metadata": {
                    "lisatiedot": {
                        "en": (
                            "Applicants subject to tuition fees can apply for "
                            "tuition waivers and scholarships during the university "
                            "application process by completing the relevant section "
                            "on the application form."
                        )
                    }
                },
            }
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(**{
            **_source().__dict__,
            "provider_id": "studyinfo_valintaperuste",
            "linked_programme_id": "programme-1",
        }),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "title": "Studyinfo selection criteria",
            "title_column": "nimi.en",
            "identity_fields": ["id"],
            "schema_context": (
                "Emit scholarships only when an explicit policy is present."
            ),
            "field_mappings": [{
                "field": "scholarships",
                "column": "metadata.lisatiedot.en",
                "label": "Scholarship policy",
            }],
        }},
        seed=SimpleNamespace(
            provider_programme_identifiers={
                "programme-1": {
                    "studyinfo_valintaperuste": {"id": "criteria-1"},
                },
            },
        ),
    )
    assert decision.entity_match is True
    assert source.text.index("Scholarship policy:") < source.text.index(
        "Source mapping context:"
    )


def test_structured_materializer_keeps_bounded_metadata_when_no_truthy_field_is_rendered() -> None:
    """A false optional flag must not expose the unbounded raw JSON fallback."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text='{"UNITID":"2","hakuAuki":false,"unrelated":"raw"}',
        structured_payload=[
            {
                "UNITID": "2",
                "hakuAuki": False,
                "hakutiedot": "Application window: 2026-08-31 to 2026-09-10",
            }
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "identity_fields": ["UNITID"],
            "field_mappings": [
                {"field": "programme_status", "column": "hakuAuki"},
            ],
            "metadata_mappings": [
                {"field": "application_windows", "column": "hakutiedot"},
            ],
        }},
        seed=SimpleNamespace(provider_identifiers={"scorecard": {"UNITID": "2"}}),
    )
    assert decision.entity_match is True
    assert decision.reason == "structured_record_materialized"
    assert "Application window: 2026-08-31 to 2026-09-10" in source.text
    assert "unrelated" not in source.text
    assert source.external_metadata[0]["field_name"] == "application_windows"


def test_structured_materializer_accepts_common_json_record_wrappers() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text="records",
        structured_payload={"records": [{"UAI": "0755283K", "label": "Master Informatique"}]},
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "identity_fields": ["UAI"],
            "field_mappings": [{"field": "programme_identity", "column": "label"}],
        }},
        seed=SimpleNamespace(provider_identifiers={"scorecard": {"UAI": "0755283K"}}),
    )
    assert decision.entity_match is True
    assert "Master Informatique" in source.text


def test_structured_materializer_accepts_nested_official_api_record_path() -> None:
    """Provider-native envelopes can expose records below a declared path."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text="ckan result",
        structured_payload={
            "success": True,
            "result": {
                "records": [
                    {
                        "ONDERWIJSBESTUURID": "107B605",
                        "OPLEIDINGSEENHEIDCODE": "1001O8897",
                        "NAAM_LANG": "Data Science and Artificial Intelligence Technology",
                    },
                ],
            },
        },
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(**{**_source().__dict__, "linked_programme_id": "programme-1"}),
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "record_path": "result.records",
            "identity_fields": ["ONDERWIJSBESTUURID", "OPLEIDINGSEENHEIDCODE"],
            "field_mappings": [{
                "field": "programme_identity",
                "column": "NAAM_LANG",
            }],
        }},
        seed=SimpleNamespace(
            provider_identifiers={"scorecard": {"ONDERWIJSBESTUURID": "107B605"}},
            provider_programme_identifiers={
                "programme-1": {
                    "scorecard": {"OPLEIDINGSEENHEIDCODE": "1001O8897"},
                },
            },
        ),
    )
    assert decision.entity_match is True
    assert decision.record_count == 1
    assert "Data Science and Artificial Intelligence Technology" in source.text


def test_structured_materializer_reads_nested_json_paths_and_array_identity() -> None:
    """Nested official API envelopes keep exact IDs and literal leaf values."""
    parsed = ParsedDocument(
        raw_document_id="raw-susa",
        parser_id="json-structured",
        parser_version="1",
        text="susa event",
        structured_payload={
            "id": "e.uoh.kth.cbiot.32101.20262",
            "status": "ACTIVE",
            "content": {
                "identifier": "e.uoh.kth.cbiot.32101.20262",
                "providers": ["p.uoh.kth"],
                "application": {"last": "2026-04-15"},
                "extensions": [{
                    "tuitionFee": {"first": 70500, "total": 783000, "value": True},
                    "applicationDetails": {
                        "visibleToInternationalApplicants": False,
                    },
                }],
                "languageOfInstructions": ["swe"],
            },
        },
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(
            **{
                **_source().__dict__,
                "url": "https://api.skolverket.se/susa-navet/emil3/educationEvents/e.uoh.kth.cbiot.32101.20262",
                "provider_id": "susa_navet_event",
                "dataset_id": "susa-navet-education-events",
            }
        ),
        candidate_metadata={
            "field_evidence": {
                "kind": "structured_rows",
                "scope": "programme",
                "identity_fields": ["id", "content.providers"],
                "field_mappings": [
                    {"field": "programme_status", "column": "status", "label": "Susa programme status"},
                    {"field": "final_deadline", "column": "content.application.last", "label": "Final application deadline"},
                    {"field": "tuition", "column": "content.extensions.0.tuitionFee.total", "label": "Total tuition fee", "currency": "SEK", "basis": "programme"},
                ],
                "metadata_mappings": [
                    {"field": "language", "column": "content.languageOfInstructions", "label": "Language of instruction"},
                ],
            }
        },
        seed=SimpleNamespace(
            provider_identifiers={
                "susa_navet_event": {
                    "id": "e.uoh.kth.cbiot.32101.20262",
                    "content.providers": "p.uoh.kth",
                }
            },
            provider_programme_identifiers={},
        ),
    )
    assert decision.entity_match is True
    assert decision.matching_signals == (
        "id=e.uoh.kth.cbiot.32101.20262",
        "content.providers=p.uoh.kth",
    )
    assert "Final application deadline: 2026-04-15" in source.text
    assert "Total tuition fee: 783000" in source.text
    assert "Language of instruction: swe [source column content.languageOfInstructions]" in source.text


def test_programme_identifier_is_used_for_programme_resolution_sources() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="csv-structured",
        parser_version="2",
        text="rows",
        structured_payload=[
            {"UAI": "0755283K", "AF": "AF.86527", "label": "Licence Informatique"},
            {"UAI": "0755283K", "AF": "AF.84654", "label": "Master Informatique"},
        ],
    )
    source = ExtractionSource(**{
        **_source().__dict__,
        "provider_id": "onisep_higher_ed",
        "linked_programme_id": "programme-master",
    })
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=source,
        candidate_metadata={"field_evidence": {
            "kind": "structured_rows",
            "scope": "programme",
            "identity_fields": ["UAI", "AF"],
            "field_mappings": [{"field": "programme_identity", "column": "label"}],
        }},
        seed=SimpleNamespace(
            provider_identifiers={"onisep_higher_ed": {"UAI": "0755283K"}},
            provider_programme_identifiers={
                "programme-master": {
                    "onisep_higher_ed": {"AF": "AF.84654"},
                },
            },
        ),
    )
    assert decision.entity_match is True
    assert decision.record_count == 1
    assert "Master Informatique" in source.text
    assert "Licence Informatique" not in source.text


def test_text_window_requires_exact_configured_source_identifier() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1", parser_id="pdf", parser_version="v1",
        text="Course Name: Master of Data Science CRICOS Course Code: 0101866 Tuition Fee: $AU 126,000",
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "text_window",
            "identity_patterns": ["CRICOS Course Code: {CRICOS_CODE}"],
            "context_before": 80,
            "context_after": 80,
        }},
        seed=SimpleNamespace(
            name="UNSW Sydney",
            provider_identifiers={},
            provider_programme_identifiers={"programme-1": {"scorecard": {"CRICOS_CODE": "0101866"}}},
        ),
    )
    assert decision.entity_match is True
    assert "126,000" in source.text
    assert source.external_entity_match is True


def test_text_window_materialises_explicit_course_metadata_with_provenance() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="html-visible-text",
        parser_version="1",
        text=(
            "BSc Computing The University of Nottingham 1 Location : The University of Nottingham "
            "Save course Course details Study mode Full time Length 4 year course "
            "Distance learning Not Available"
        ),
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(
            **{
                **_source().__dict__,
                "url": "https://discoveruni.gov.uk/course-details/1/G407/Full-time/",
                "provider_id": "discover_uni_hesa",
                "dataset_id": "discover-uni-course-details",
            }
        ),
        candidate_metadata={
            "field_evidence": {
                "kind": "text_window",
                "scope": "programme",
                "identity_patterns": ["The University of Nottingham"],
                "metadata_mappings": [
                    {
                        "field": "delivery_mode",
                        "label": "Study mode",
                        "pattern": r"\bStudy mode\s+(?P<value>Full time|Part time)\b",
                    },
                    {
                        "field": "duration",
                        "label": "Course length",
                        "pattern": r"\bLength\s+(?P<value>\d+\s+year\s+course)\b",
                    },
                    {
                        "field": "campus",
                        "label": "Course location",
                        "pattern": r"\bLocation\s*:\s*(?P<value>.+?)(?=\s+Save course\b)",
                    },
                ],
            }
        },
        seed=SimpleNamespace(
            name="The University of Nottingham",
            provider_identifiers={},
            provider_programme_identifiers={},
        ),
    )
    assert decision.entity_match is True
    assert {item["field_name"]: item["value"] for item in source.external_metadata} == {
        "delivery_mode": "Full time",
        "duration": "4 year course",
        "campus": "The University of Nottingham",
    }
    assert all(item["source_content_hash"] == "hash-1" for item in source.external_metadata)
    assert "Course length: 4 year course [source metadata]" in source.text


def test_structured_materialiser_keeps_rio_metadata_columns_separate_from_facts() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="json-structured",
        parser_version="1",
        text="rio",
        structured_payload=[
            {
                "ONDERWIJSBESTUURID": "107B605",
                "OPLEIDINGSEENHEIDCODE": "1001O8897",
                "NAAM_LANG": "Data Science",
                "GRAAD": "MASTER",
                "VOERTAAL": "NLD",
                "VORM": "VOLTIJD",
                "BEGINDATUM": "2024-09-01T00:00:00",
            }
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(
            **{
                **_source().__dict__,
                "provider_id": "duo_rio_ho",
                "dataset_id": "duo-rio-ho-opleidingsoverzicht",
                "linked_programme_id": "programme-1",
            }
        ),
        candidate_metadata={
            "field_evidence": {
                "kind": "structured_rows",
                "scope": "programme",
                "identity_fields": ["ONDERWIJSBESTUURID", "OPLEIDINGSEENHEIDCODE"],
                "field_mappings": [
                    {"field": "programme_identity", "column": "NAAM_LANG"},
                    {"field": "credential", "column": "GRAAD"},
                ],
                "metadata_mappings": [
                    {"field": "language", "column": "VOERTAAL", "label": "RIO programme language"},
                    {"field": "delivery_mode", "column": "VORM", "label": "RIO delivery mode"},
                    {"field": "programme_start_date", "column": "BEGINDATUM", "label": "RIO programme start date"},
                ],
            }
        },
        seed=SimpleNamespace(
            provider_identifiers={"duo_rio_ho": {"ONDERWIJSBESTUURID": "107B605"}},
            provider_programme_identifiers={
                "programme-1": {
                    "duo_rio_ho": {"OPLEIDINGSEENHEIDCODE": "1001O8897"}
                }
            },
        ),
    )
    assert decision.entity_match is True
    assert {item["field_name"]: item["value"] for item in source.external_metadata} == {
        "language": "NLD",
        "delivery_mode": "VOLTIJD",
        "programme_start_date": "2024-09-01T00:00:00",
    }
    assert "RIO programme language: NLD [source column VOERTAAL]" in source.text


def test_onisep_materialiser_preserves_explicit_duration_mode_location_and_cost() -> None:
    """Onisep catalogue columns remain literal, programme-scoped evidence.

    The Idéo export publishes these values on the matched AF/UAI row.  The
    bridge must preserve them with the source-native labels; it must not turn
    an empty cost column into a tuition claim or derive a cycle from duration.
    """
    parsed = ParsedDocument(
        raw_document_id="raw-onisep",
        parser_id="csv-structured",
        parser_version="1",
        text="Onisep Idéo row",
        structured_payload=[
            {
                "ENS code UAI": "0561687E",
                "Action de Formation (AF) identifiant Onisep": "AF.5992",
                "Formation (FOR) libellé": "licence mention information-communication",
                "FOR type": "licence",
                "FOR nature du certificat": "Diplôme national ou diplôme d'état",
                "AF durée cycle standard": "3 ans",
                "AF modalités scolarité": "temps plein, cours en présentiel",
                "ENS commune": "Arradon",
                "AF coût scolarité": "de 10410 euros jusqu'à 19800 euros en 2026 (de 3470 à 6600 euros par an, selon les revenus)",
            }
        ],
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=ExtractionSource(
            **{
                **_source().__dict__,
                "url": "https://api.opendata.onisep.fr/downloads/ideo.csv",
                "provider_id": "onisep_higher_ed",
                "dataset_id": "ideo-actions-formation-initiale-univers-enseignement-superieur",
                "linked_programme_id": "uco-licence-info-comm",
            }
        ),
        candidate_metadata={
            "field_evidence": {
                "kind": "structured_rows",
                "scope": "programme",
                "identity_fields": [
                    "ENS code UAI",
                    "Action de Formation (AF) identifiant Onisep",
                ],
                "field_mappings": [
                    {"field": "programme_identity", "column": "Formation (FOR) libellé"},
                    {"field": "credential", "column": "FOR type"},
                    {
                        "field": "tuition",
                        "column": "AF coût scolarité",
                        "label": "Schooling cost",
                        "currency": "EUR",
                        "credential_column": "FOR type",
                        "credential_label": "fee credential category",
                        "render_pattern": r"(?P<value>de\s+\d+\s+\S+\s+\d+\s+euros\s+par\s+an)",
                    },
                ],
                "schema_context": "For schooling cost, use the literal FOR type value as the fee credential category.",
                "metadata_mappings": [
                    {"field": "duration", "column": "AF durée cycle standard"},
                    {"field": "delivery_mode", "column": "AF modalités scolarité"},
                    {"field": "campus", "column": "ENS commune"},
                ],
            }
        },
        seed=SimpleNamespace(
            provider_identifiers={"onisep_higher_ed": {"ENS code UAI": "0561687E"}},
            provider_programme_identifiers={
                "uco-licence-info-comm": {
                    "onisep_higher_ed": {
                        "Action de Formation (AF) identifiant Onisep": "AF.5992"
                    }
                }
            },
        ),
    )
    assert decision.entity_match is True
    assert decision.record_count == 1
    assert {item["field_name"]: item["value"] for item in source.external_metadata} == {
        "duration": "3 ans",
        "delivery_mode": "temps plein, cours en présentiel",
        "campus": "Arradon",
    }
    assert "de 10410 euros jusqu'à 19800 euros en 2026" not in source.text
    assert "fee credential category=licence [source column FOR type]" in source.text
    assert "Schooling cost (fee credential category=licence [source column FOR type]):" in source.text
    assert "Schooling cost (fee credential category=licence [source column FOR type]): de 3470 à 6600 euros par an [source column AF coût scolarité]" in source.text
    assert "Source mapping context: For schooling cost" in source.text
    assert "AF coût scolarité" in source.text
    assert all(item["scope"] == "programme" for item in source.external_metadata)


def test_external_tuition_quote_is_reanchored_to_complete_materialized_line() -> None:
    source = ExtractionSource(
        url="https://api.opendata.onisep.fr/downloads/ideo.csv",
        page_type="unknown",
        title="Onisep",
        text=(
            "Schooling cost (fee credential category=licence [source column FOR type]): "
            "3470 euros par an [source column AF coût scolarité]"
        ),
        content_hash="hash-1",
        raw_document_id="raw-1",
        source_authority=SourceAuthority.GOVERNMENT,
        source_relationship=SourceRelationship.GOVERNMENT,
        source_class="government_dataset",
        provider_id="onisep_higher_ed",
        dataset_id="ideo",
        acquisition_run_id="run-1",
        external_entity_match=True,
    )
    assertion = fact_to_assertion(
        entity_id="programme-1",
        fact={
            "field_name": "tuition",
            "value": {
                "credential": "licence",
                "amount": 3470,
                "currency": "EUR",
                "fee_period": "year",
            },
            "source_url": source.url,
            "source_type": "tuition",
            "evidence": source.text[:90] + "...",
            "scope": "programme",
            "audience": None,
            "academic_cycle": None,
            "confidence": 0.9,
        },
        source_map={source.url: source},
        model_name="test",
        extractor_version="test",
    )
    assert assertion.evidence == source.text
    assert assertion.validation_errors == []


def test_text_window_does_not_format_missing_identifier_as_a_match() -> None:
    parsed = ParsedDocument(raw_document_id="raw-1", parser_id="pdf", parser_version="v1", text="CRICOS Course Code: 0101866")
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {"kind": "text_window", "identity_patterns": ["CRICOS Course Code: {CRICOS_CODE}"]}},
        seed=SimpleNamespace(name="UNSW Sydney", provider_identifiers={}, provider_programme_identifiers={}),
    )
    assert decision.entity_match is False
    assert decision.reason == "missing_identity_pattern"
    assert source.external_entity_match is False


def test_text_window_uses_linked_programme_identifiers_only() -> None:
    """A multi-target seed must not let another course overwrite this route."""
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="html-visible-text",
        parser_version="v1",
        text="Discover Uni course Computer Science at University of Manchester",
    )
    source = ExtractionSource(
        **{
            **_source().__dict__,
            "provider_id": "discover_uni_hesa",
            "linked_programme_id": "programme-alpha",
        }
    )
    seed = SimpleNamespace(
        name="The University of Manchester",
        provider_identifiers={},
        provider_programme_identifiers={
            "programme-alpha": {
                "discover_uni_hesa": {"course_name": "Computer Science"}
            },
            "programme-beta": {
                "discover_uni_hesa": {"course_name": "Data Science"}
            },
        },
    )
    _, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=source,
        candidate_metadata={
            "field_evidence": {
                "kind": "text_window",
                "identity_patterns": ["Discover Uni course {course_name}"],
            }
        },
        seed=seed,
    )
    assert decision.entity_match is True


def test_text_window_can_label_literal_flattened_table_values() -> None:
    parsed = ParsedDocument(
        raw_document_id="raw-1",
        parser_id="html-visible-text",
        parser_version="v1",
        text="2026-27 ETH Zurich 730 2190 74 50 or 150 [1] Other University 1 2 3",
    )
    source, decision = materialize_external_field_evidence(
        parsed=parsed,
        source=_source(),
        candidate_metadata={"field_evidence": {
            "kind": "text_window",
            "scope": "institution",
            "identity_patterns": ["{SWISSUNIVERSITIES_NAME}"],
            "row_value_mappings": [{
                "field": "tuition",
                "label": "Domestic tuition",
                "value_index": 0,
                "credential": "Domestic tuition",
                "currency": "CHF",
                "basis": "per semester",
                "audience": "domestic",
            }],
        }},
        seed=SimpleNamespace(
            name="ETH Zurich",
            provider_identifiers={"scorecard": {"SWISSUNIVERSITIES_NAME": "ETH Zurich"}},
            provider_programme_identifiers={},
        ),
    )
    assert decision.entity_match is True
    assert "Domestic tuition: 730" in source.text
    assert "currency=CHF" in source.text
    assert "basis=per semester" in source.text


def test_generic_provider_candidate_keeps_declarative_field_materializer() -> None:
    seed = SimpleNamespace(
        name="Example University",
        provider_identifiers={},
        provider_programme_identifiers={},
    )
    context = SimpleNamespace(seed=seed, configuration={})
    intent = AcquisitionIntent.create(
        entity=EntityRef("UNIVERSITY", "example"),
        field_groups=("tuition",),
        reason="test",
    )
    candidate = _provider_candidate(
        {
            "provider_id": "example_registry",
            "source_class": "official_registry",
            "authority": "GOVERNMENT",
            "relationship": "GOVERNMENT",
            "resource_url": "https://registry.example/record",
            "field_groups": ["tuition"],
            "field_evidence": {"kind": "text_window", "scope": "programme"},
        },
        context=context,
        intent=intent,
        adapter_id="official_registry",
    )
    assert candidate is not None
    assert candidate.adapter_metadata["field_evidence"] == {
        "kind": "text_window", "scope": "programme"
    }


def test_explicit_provider_cycle_null_does_not_inherit_intent_cycle() -> None:
    seed = SimpleNamespace(
        name="Example University",
        provider_identifiers={},
        provider_programme_identifiers={},
    )
    context = SimpleNamespace(seed=seed, configuration={})
    intent = AcquisitionIntent.create(
        entity=EntityRef("UNIVERSITY", "example"),
        field_groups=("programme_taxonomy",),
        reason="test",
        target_cycle="2026-27",
    )
    candidate = _provider_candidate(
        {
            "provider_id": "source_without_cycle",
            "source_class": "government_dataset",
            "authority": "GOVERNMENT",
            "relationship": "GOVERNMENT",
            "resource_url": "https://example.gov/export.csv",
            "field_groups": ["programme_taxonomy"],
            "academic_cycle": None,
        },
        context=context,
        intent=intent,
        adapter_id="government_dataset",
    )
    assert candidate is not None
    assert candidate.academic_cycle is None


def test_legacy_provider_mapping_without_temporal_key_keeps_intent_cycle() -> None:
    seed = SimpleNamespace(
        name="Example University",
        provider_identifiers={},
        provider_programme_identifiers={},
    )
    context = SimpleNamespace(seed=seed, configuration={})
    intent = AcquisitionIntent.create(
        entity=EntityRef("UNIVERSITY", "example"),
        field_groups=("tuition",),
        reason="test",
        target_cycle="2026-27",
    )
    candidate = _provider_candidate(
        {
            "provider_id": "legacy_source",
            "source_class": "government_dataset",
            "authority": "GOVERNMENT",
            "relationship": "GOVERNMENT",
            "resource_url": "https://example.gov/export.csv",
            "field_groups": ["tuition"],
        },
        context=context,
        intent=intent,
        adapter_id="government_dataset",
    )
    assert candidate is not None
    assert candidate.academic_cycle == "2026-27"
