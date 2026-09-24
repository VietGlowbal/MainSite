from __future__ import annotations

import unittest

from glowbal_ingestion.extraction_provider import (
    ExtractionRequest,
    ExtractionResult,
    ExtractionSource,
    UnavailableExtractionProvider,
)
from glowbal_ingestion.hierarchical_inference import (
    HierarchicalInferenceEngine,
    HierarchyLevel,
)
from glowbal_ingestion.models import (
    EpistemicState,
    SourceAuthority,
    SourceRelationship,
    TemporalState,
)
from glowbal_ingestion.semantic_tuition import (
    TUITION_PROMPT_VERSION,
    TUITION_SCHEMA_VERSION,
    SemanticTuitionExtractor,
    TuitionExtractionStatus,
)


PROGRAMME = {
    "programme_id": "programme-target",
    "institution_id": "institution-a",
    "programme_name": "Data Science",
    "degree_level": "master",
    "official_url": "https://uni.example/programmes/data-science",
}


class StubProvider:
    provider_id = "stub-llm"
    configured = True

    def __init__(self, facts: tuple[dict[str, object], ...]) -> None:
        self.facts = facts
        self.requests: list[ExtractionRequest] = []

    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        self.requests.append(request)
        return ExtractionResult(
            facts=self.facts,
            provider_id=self.provider_id,
            model_id="stub-model",
            request_fingerprint="request-fingerprint",
            prompt_version=TUITION_PROMPT_VERSION,
            schema_version=TUITION_SCHEMA_VERSION,
            identity_match=True,
        )


def source_for(
    programme: dict[str, str] = PROGRAMME,
    *,
    text: str | None = None,
    source_url: str | None = None,
    source_class: str = "official_web",
    temporal_state: TemporalState = TemporalState.CURRENT,
) -> ExtractionSource:
    url = source_url or programme["official_url"]
    return ExtractionSource(
        url=url,
        page_type="tuition",
        title=f"{programme['programme_name']} tuition",
        text=text
        or (
            "MSc Data Science tuition for 2026-2027 is USD 20,000 "
            "per year for international students."
        ),
        content_hash="a" * 64,
        raw_document_id="raw-document-1",
        parser_id="html",
        parser_version="1",
        source_authority=SourceAuthority.OFFICIAL,
        source_relationship=SourceRelationship.FINANCE_OFFICE,
        temporal_state=temporal_state,
        source_class=source_class,
        adapter_id="official-web",
        provider_id="university-a",
        dataset_id="tuition-2026",
        academic_cycle="2026-2027",
        acquisition_run_id="run-semantic-1",
    )


def fact_for(
    source: ExtractionSource,
    *,
    evidence: str | None = None,
    scope: str = "programme",
    audience: str = "international",
    value: dict[str, object] | None = None,
    **extra: object,
) -> dict[str, object]:
    return {
        "field_name": "tuition",
        "value": value
        or {
            "credential": "MSc",
            "amount": 20000,
            "currency": "usd",
            "fee_period": "per_year",
            "audience": audience,
            "academic_cycle": "2026-2027",
        },
        "source_url": source.url,
        "source_type": "tuition",
        "evidence": evidence
        or (
            "MSc Data Science tuition for 2026-2027 is USD 20,000 per year "
            "for international students"
        ),
        "scope": scope,
        "audience": audience,
        "academic_cycle": "2026-2027",
        "confidence": 0.95,
        **extra,
    }


class SemanticTuitionExtractionTests(unittest.TestCase):
    def extract(
        self,
        facts: tuple[dict[str, object], ...],
        *,
        programme: dict[str, str] = PROGRAMME,
        sources: tuple[ExtractionSource, ...] | None = None,
        **kwargs: object,
    ):
        source_list = sources or (source_for(programme),)
        return SemanticTuitionExtractor(StubProvider(facts)).extract(
            entity_id=programme["programme_id"],
            programme=programme,
            sources=source_list,
            **kwargs,
        )

    def test_explicit_tuition_is_native_observed_and_request_is_tuition_only(self) -> None:
        source = source_for()
        provider = StubProvider((fact_for(source),))
        outcome = SemanticTuitionExtractor(provider).extract(
            entity_id=PROGRAMME["programme_id"],
            programme=PROGRAMME,
            sources=(source,),
            target_cycle="2026-2027",
            target_audience="international",
        )

        self.assertEqual(outcome.status, TuitionExtractionStatus.SUCCESS)
        self.assertEqual(outcome.valid_assertion_count, 1)
        assertion = outcome.assertions[0]
        self.assertEqual(assertion.epistemic_state, EpistemicState.OBSERVED)
        self.assertEqual(assertion.field_name, "tuition")
        self.assertEqual(assertion.value_json["currency"], "USD")
        self.assertEqual(assertion.source_content_hash, source.content_hash)
        self.assertEqual(assertion.raw_document_id, source.raw_document_id)
        self.assertEqual(assertion.provider_id, source.provider_id)
        self.assertEqual(assertion.dataset_id, source.dataset_id)
        self.assertEqual(assertion.acquisition_run_id, source.acquisition_run_id)
        self.assertEqual(assertion.source_authority, SourceAuthority.OFFICIAL)
        self.assertEqual(
            assertion.source_relationship,
            SourceRelationship.FINANCE_OFFICE,
        )
        self.assertEqual(provider.requests[0].field_names, ("tuition",))
        self.assertTrue(provider.requests[0].capabilities["strict_schema"])
        self.assertIn(source.text, provider.requests[0].sources[0].text)

    def test_ambiguous_or_estimated_evidence_abstains(self) -> None:
        source = source_for(
            text=(
                "The estimated MSc Data Science tuition for 2026-2027 is "
                "USD 20,000 per year for international students."
            )
        )
        outcome = self.extract(
            (fact_for(source, evidence="estimated MSc Data Science tuition for 2026-2027 is USD 20,000 per year"),),
            sources=(source,),
        )
        self.assertEqual(outcome.status, TuitionExtractionStatus.ABSTAINED)
        self.assertEqual(outcome.valid_assertion_count, 0)
        self.assertIn("UNSUPPORTED_INFERENCE_OR_ESTIMATE", outcome.abstentions[0]["reasons"])

    def test_source_estimate_qualifier_abstains_when_model_evidence_omits_it(self) -> None:
        source = source_for(
            text=(
                "Approximately, MSc Data Science tuition for 2026-2027 is USD 20,000 "
                "per year for international students."
            )
        )
        # The model evidence starts after the source's estimate qualifier.  The
        # extractor must still inspect the source text before emitting OBSERVED.
        result = self.extract((fact_for(source),), sources=(source,))
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertEqual(result.valid_assertion_count, 0)
        self.assertIn(
            "UNSUPPORTED_INFERENCE_OR_ESTIMATE",
            result.abstentions[0]["reasons"],
        )

    def test_missing_required_dimensions_abstain(self) -> None:
        source = source_for()
        value = dict(fact_for(source)["value"])
        value.pop("academic_cycle")
        outcome = self.extract((fact_for(source, value=value),))
        self.assertEqual(outcome.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("TUITION_DIMENSIONS_MISSING:academic_cycle", outcome.abstentions[0]["reasons"])

    def test_cycle_and_audience_mismatch_abstain(self) -> None:
        source = source_for(
            text=(
                "MSc Data Science tuition for 2025-2026 is USD 20,000 "
                "per year for international students."
            )
        )
        cycle_mismatch = fact_for(
            source,
            evidence=(
                "MSc Data Science tuition for 2025-2026 is USD 20,000 "
                "per year for international students"
            ),
        )
        cycle_mismatch["academic_cycle"] = "2025-2026"
        cycle_mismatch["value"] = {
            **dict(cycle_mismatch["value"]),
            "academic_cycle": "2025-2026",
        }
        result = self.extract(
            (cycle_mismatch,),
            sources=(source,),
            target_cycle="2026-2027",
        )
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("TARGET_CYCLE_MISMATCH", result.abstentions[0]["reasons"])

        audience_mismatch = fact_for(
            source,
            evidence=(
                "MSc Data Science tuition for 2025-2026 is USD 20,000 "
                "per year for international students."
            ),
        )
        audience_mismatch["audience"] = "domestic"
        result = self.extract(
            (audience_mismatch,),
            sources=(source,),
            target_audience="international",
        )
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("TARGET_AUDIENCE_MISMATCH", result.abstentions[0]["reasons"])

    def test_non_programme_scope_requires_explicit_applicability(self) -> None:
        source = source_for()
        fact = fact_for(source, scope="institution")
        result = self.extract((fact,))
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("PROGRAMME_APPLICABILITY_NOT_PROVEN", result.abstentions[0]["reasons"])

        applicability = source_for(
            source_url="https://uni.example/programmes/data-science",
            text=(
                "The MSc Data Science programme is covered by the institution "
                "graduate tuition schedule."
            ),
        )
        tuition = source_for(
            source_url="https://uni.example/finance/tuition",
            text=(
                "MSc Data Science tuition for 2026-2027 is USD 20,000 "
                "per year for international students."
            ),
        )
        fact = fact_for(
            tuition,
            scope="institution",
            applicability_source_url=applicability.url,
            applicability_evidence=(
                "The MSc Data Science programme is covered by the institution "
                "graduate tuition schedule."
            ),
        )
        result = self.extract((fact,), sources=(tuition, applicability))
        self.assertEqual(result.status, TuitionExtractionStatus.SUCCESS)
        self.assertEqual(result.assertions[0].applicability_source_url, applicability.url)
        self.assertEqual(result.assertions[0].entity_type, "institution")
        self.assertEqual(result.assertions[0].entity_id, PROGRAMME["institution_id"])

        faculty_fact = fact_for(
            tuition,
            scope="faculty",
            organisation_unit_id="faculty-a",
            applicability_source_url=applicability.url,
            applicability_evidence=(
                "The MSc Data Science programme is covered by the institution "
                "graduate tuition schedule."
            ),
        )
        result = self.extract(
            (faculty_fact,),
            sources=(tuition, applicability),
        )
        self.assertEqual(result.status, TuitionExtractionStatus.SUCCESS)
        self.assertEqual(result.assertions[0].entity_type, "organisation_unit")
        self.assertEqual(result.assertions[0].entity_id, "faculty-a")

    def test_complete_source_lineage_is_required_for_emitted_assertions(self) -> None:
        source = source_for()
        incomplete = ExtractionSource(
            **{
                **source.__dict__,
                "raw_document_id": None,
                "acquisition_run_id": None,
            }
        )
        outcome = self.extract((fact_for(incomplete),), sources=(incomplete,))
        self.assertEqual(outcome.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("ACQUISITION_RUN_ID_MISSING", outcome.abstentions[0]["reasons"])

    def test_search_and_archive_sources_cannot_become_current_observed_tuition(self) -> None:
        search = source_for(source_class="search_discovery")
        result = self.extract((fact_for(search),), sources=(search,))
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("SEARCH_DISCOVERY_IS_NOT_FACTUAL_EVIDENCE", result.abstentions[0]["reasons"])

        archive = source_for(source_class="archive", temporal_state=TemporalState.CURRENT)
        result = self.extract((fact_for(archive),), sources=(archive,))
        self.assertEqual(result.status, TuitionExtractionStatus.ABSTAINED)
        self.assertIn("ARCHIVE_MUST_BE_HISTORICAL", result.abstentions[0]["reasons"])

    def test_invalid_schema_response_rejects_entire_response(self) -> None:
        source = source_for()
        invalid = {**fact_for(source), "unexpected_model_key": "no"}
        result = self.extract((invalid,))
        self.assertEqual(result.status, TuitionExtractionStatus.SCHEMA_INVALID)
        self.assertEqual(result.valid_assertion_count, 0)
        self.assertIn("UNKNOWN_FACT_KEYS:unexpected_model_key", result.schema_failures[0]["reasons"])

    def test_provider_unavailable_is_explicit_and_makes_no_assertion(self) -> None:
        source = source_for()
        result = SemanticTuitionExtractor(UnavailableExtractionProvider()).extract(
            entity_id=PROGRAMME["programme_id"],
            programme=PROGRAMME,
            sources=(source,),
        )
        self.assertEqual(result.status, TuitionExtractionStatus.PROVIDER_UNAVAILABLE)
        self.assertEqual(result.assertions, ())

    def test_hierarchy_accepts_native_observed_assertions_as_donors(self) -> None:
        sibling = {
            **PROGRAMME,
            "programme_id": "programme-sibling",
            "programme_name": "Computer Data Science",
            "official_url": "https://uni.example/programmes/computer-data-science",
        }
        sibling_source = source_for(sibling)
        provider = StubProvider((fact_for(sibling_source),))
        extracted = SemanticTuitionExtractor(provider).extract(
            entity_id=sibling["programme_id"],
            programme=sibling,
            sources=(sibling_source,),
        )
        self.assertEqual(extracted.status, TuitionExtractionStatus.SUCCESS)
        self.assertEqual(extracted.assertions[0].epistemic_state, EpistemicState.OBSERVED)

        target = {**PROGRAMME, "programme_name": "Data Analytics"}
        result = HierarchicalInferenceEngine().explain(
            field="tuition",
            target_cycle="2026-2027",
            entity_id=target["programme_id"],
            target=target,
            assertions=extracted.assertions,
            programmes=[target, sibling],
            organisation_units=[],
            recovery_exhausted=True,
        )
        self.assertFalse(result.abstained)
        self.assertEqual(result.level, HierarchyLevel.SIBLING_PROGRAMME)
        self.assertEqual(result.record.donor_entity_ids, (sibling["programme_id"],))


if __name__ == "__main__":
    unittest.main()
