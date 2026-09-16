"""Focused tests for the deterministic Stage 1 coverage pass.

These fixtures exercise only parsing and assertion construction.  They never
open a network connection or mutate the frozen population artifacts.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPLAY_ROOT = (
    Path(__file__).resolve().parents[3]
    / "docs/architecture/data/external-field-stage1-20260915"
)
sys.path.insert(0, str(REPLAY_ROOT))

import acquire_stage1_coverage as coverage  # noqa: E402
import expand_stage1_max_fill as max_fill  # noqa: E402


class Stage1CoverageParserTests(unittest.TestCase):
    def test_onisep_range_preserves_annual_range_and_international_amount(self) -> None:
        value = coverage.parse_onisep_cost(
            "de 11850 euros jusqu'à 23700 euros en 2025 "
            "(de 3950 à 7900 euros par an selon les revenus; "
            "23700 euros pour les étudiants hors Union européenne)"
        )
        self.assertIsNotNone(value)
        assert value is not None
        self.assertEqual(value["currency"], "EUR")
        self.assertEqual(value["fee_period"], "annual")
        self.assertEqual(value["minimum_amount"], 11850)
        self.assertEqual(value["maximum_amount"], 23700)
        self.assertEqual(value["amount"], 23700)
        self.assertEqual(value["audience"], "international")

    def test_english_test_parsers_accept_explicit_scores_only(self) -> None:
        ielts = coverage.parse_ielts(
            "IELTS 6.5 overall with no less than 6.0 in any element"
        )
        self.assertIsNotNone(ielts)
        assert ielts is not None
        self.assertEqual(ielts[0], 6.5)
        self.assertEqual(ielts[1]["minimum_each"], 6.0)  # type: ignore[index]
        toefl = coverage.parse_toefl("TOEFL iBT 100 overall")
        self.assertIsNotNone(toefl)
        assert toefl is not None
        self.assertEqual(toefl[0], 100)
        self.assertTrue(toefl[1])
        self.assertIsNone(coverage.parse_toefl("TOEFL: 5"))
        duolingo = coverage.parse_duolingo("Duolingo English Test 120")
        self.assertIsNotNone(duolingo)
        assert duolingo is not None
        self.assertEqual(duolingo[0], 120)

    def test_uk_tuition_does_not_promote_reduced_placement_fee(self) -> None:
        text = (
            "Fees and costs Course fees UK (full-time) 9,790 GBP "
            "International (full-time) 18,108 GBP. "
            "The professional placement year fee is \ufffd1,958."
        )
        parsed = coverage.parse_uk_tuition(text)
        self.assertIsNotNone(parsed)
        assert parsed is not None
        value, evidence = parsed
        self.assertEqual(value["amount"], 18108)
        self.assertEqual(value["audience"], "international")
        self.assertIn("18,108", evidence)

    def test_date_and_subject_parsers_require_explicit_labels(self) -> None:
        deadline = coverage.parse_uk_deadline(
            "Application deadline Wednesday 13 January 2027 at 18.00"
        )
        self.assertEqual(deadline[0], "2027-01-13")  # type: ignore[index]
        starts = coverage.parse_uk_start_dates("Start date September 2027")
        self.assertEqual(starts[0], ["2027-09-01"])  # type: ignore[index]
        subject = coverage.parse_subject_prerequisite(
            "A-level standard offer A*AA including A* in Mathematics"
        )
        self.assertIsNotNone(subject)
        self.assertIn("Mathematics", subject[0])  # type: ignore[index]
        self.assertIsNone(
            coverage.parse_subject_prerequisite(
                "The curriculum includes ethics and at least one mathematics course."
            )
        )

    def test_explicit_portfolio_reference_and_conditional_experience_only(self) -> None:
        portfolio = coverage.parse_portfolio_requirement(
            "Course requirements Applicants should hold a qualification plus a portfolio demonstrating artistic ability."
        )
        self.assertIsNotNone(portfolio)
        self.assertIn("portfolio", portfolio[0].casefold())  # type: ignore[index]
        reference = coverage.parse_recommendation_requirement(
            "We will also require a reference from somebody who knows you well enough."
        )
        self.assertEqual(reference[0], "Reference")  # type: ignore[index]
        experience = coverage.parse_work_experience_requirement(
            "Relevant work experience may be considered if you do not meet the above criteria."
        )
        self.assertIsNotNone(experience)
        self.assertEqual(experience[0]["requirement_status"], "conditional")  # type: ignore[index]
        self.assertIsNone(coverage.parse_portfolio_requirement("Portfolio module content"))

    def test_duo_target_parameter_is_removed_without_changing_other_filters(self) -> None:
        url = (
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search?"
            "resource_id=abc&filters=%7B%7D&target=programme-1"
        )
        cleaned = coverage.Acquisition.duo_url(url)
        self.assertNotIn("target=", cleaned)
        self.assertIn("resource_id=abc", cleaned)
        self.assertIn("filters=%7B%7D", cleaned)


class Stage1CoverageAssertionTests(unittest.TestCase):
    def test_new_assertion_is_rule_validated_and_has_no_model(self) -> None:
        acquisition = coverage.Acquisition.__new__(coverage.Acquisition)
        acquisition.targets = {
            "programme-1": {
                "programme_id": "programme-1",
                "degree_level": "bachelor",
                "country": "UK",
            }
        }
        acquisition.direct_keys = set()
        acquisition.added = []
        acquisition.skipped = coverage.Counter()
        acquisition.by_provider = coverage.Counter()
        added = acquisition.add_fact(
            programme_id="programme-1",
            field_name="ielts_overall",
            value=6.5,
            source_url="https://example.edu/admissions",
            evidence="IELTS 6.5 overall",
            provider_id="official_university_page",
            source_authority="OFFICIAL",
            source_relationship="DIRECT_OFFICIAL",
            source_type="official_html",
            source_content_hash="a" * 64,
        )
        self.assertTrue(added)
        row = acquisition.added[0]
        self.assertEqual(row["verification_status"], "RULE_VALIDATED")
        self.assertEqual(row["epistemic_state"], "OBSERVED")
        self.assertIsNone(row["model_name"])
        self.assertEqual(row["scope"], "programme")
        self.assertEqual(row["parser_id"], coverage.PARSER_ID)

    def test_existing_direct_slot_is_never_overwritten(self) -> None:
        acquisition = coverage.Acquisition.__new__(coverage.Acquisition)
        acquisition.targets = {"programme-1": {"programme_id": "programme-1"}}
        acquisition.direct_keys = {("programme-1", "tuition")}
        acquisition.added = []
        acquisition.skipped = coverage.Counter()
        acquisition.by_provider = coverage.Counter()
        added = acquisition.add_fact(
            programme_id="programme-1",
            field_name="tuition",
            value={"amount": 1000, "currency": "GBP"},
            source_url="https://example.edu/fees",
            evidence="Annual tuition fee GBP 1,000",
            provider_id="official_university_page",
            source_authority="OFFICIAL",
            source_relationship="DIRECT_OFFICIAL",
            source_type="official_html",
            source_content_hash="b" * 64,
        )
        self.assertFalse(added)
        self.assertEqual(acquisition.added, [])
        self.assertEqual(acquisition.skipped["existing_direct_or_review"], 1)


class Stage1MaxFillEvidenceTests(unittest.TestCase):
    def test_serialized_provider_metadata_is_not_a_document_fact(self) -> None:
        self.assertFalse(
            max_fill.valid_documents_value(
                '{"metadata": {"koulutustyyppi": "yo"}, "kuvaus": "<p>..."}'
            )
        )
        self.assertTrue(max_fill.valid_documents_value(["Transcript", "CV"]))

    def test_navigation_fragment_is_not_funding_evidence(self) -> None:
        page = {
            "url": "https://example.edu/course",
            "text": (
                "<html><body><div class='mega-menu'>How to apply How to apply - Undergraduate "
                "International - Overview International - Scholarships Fees and financial support "
                "Partner Institutions Apply to Example Open Days Contact us</div></body></html>"
            ),
        }
        target = {
            "programme_id": "programme-1",
            "programme_name": "Example programme",
            "institution_id": "institution-1",
            "institution_name": "Example University",
            "degree_level": "bachelor",
        }
        facts = max_fill.parse_page_facts(page=page, targets=[target])
        self.assertFalse(any(fact.field_name == "funding" for fact in facts))

    def test_catalogue_fallback_keeps_target_identity_and_recipient_scope(self) -> None:
        target = {
            "programme_id": "programme-1",
            "programme_name": "Persisted Data Science",
            "institution_id": "institution-1",
            "degree_level": "master",
        }
        facts = max_fill.catalogue_record_facts(
            target_rows={"programme-1": target},
            programme_rows={"programme-1": {"programme_id": "programme-1", "degree_level": "master"}},
        )
        by_field = {fact.field_name: fact for fact in facts}
        self.assertEqual(by_field["programme_identity"].value, "Persisted Data Science")
        self.assertEqual(by_field["credential"].value, "Master's degree")
        self.assertEqual(by_field["credential"].scope, "programme")
        self.assertEqual(by_field["credential"].level, "H0")


if __name__ == "__main__":
    unittest.main()
