from __future__ import annotations

import unittest
from types import SimpleNamespace

from glowbal_ingestion.config import InstitutionSeed
from glowbal_ingestion.pipeline import (
    COVERAGE_RETRY_FIELD_CATEGORIES,
    SmokePipeline,
)
from scripts.run_phase3f_v3_benchmark import (
    ROSTER_PATH,
    _parse_roster,
    build_execution_config,
)


class FieldDirectedRecoveryTests(unittest.TestCase):
    def test_resolved_fields_have_generic_link_recovery_categories(self) -> None:
        expected = {
            "programme_identity": "programme_detail",
            "credential": "programme_detail",
            "programme_status": "programme_detail",
            "tuition": "tuition",
            "application_deadline": "deadline",
            "english_requirement": "english_requirement",
            "major_admissions_requirement": "programme_admission",
        }
        for field, category in expected.items():
            self.assertIn(field, COVERAGE_RETRY_FIELD_CATEGORIES)
            self.assertIn(category, COVERAGE_RETRY_FIELD_CATEGORIES[field])

    def test_link_recovery_is_field_directed_and_domain_bounded(self) -> None:
        pipeline = object.__new__(SmokePipeline)
        programme = SimpleNamespace(
            official_url="https://example.edu/programmes/data-science",
            degree_level="master",
        )
        seed = InstitutionSeed(
            institution_id="example",
            name="Example University",
            country_code="US",
            official_domain="example.edu",
            homepage_url="https://example.edu",
            allowed_domains=("example.edu",),
        )
        links = [
            (
                "https://example.edu/admissions/deadlines",
                "Application deadlines",
            ),
            (
                "https://third-party.example/deadlines",
                "Application deadlines",
            ),
        ]
        candidates = pipeline._coverage_retry_links(
            [(programme.official_url, links)],
            seed,
            programme,
            missing_fields=("application_deadline",),
            excluded_urls=set(),
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][1], "https://example.edu/admissions/deadlines")
        self.assertEqual(candidates[0][2], ("application_deadline",))

    def test_recovery_smoke_remains_bound_to_selected_roster_targets(self) -> None:
        rows, source_register = _parse_roster(ROSTER_PATH)
        config = build_execution_config(
            rows[:1], source_register, field_directed_recovery=True
        )
        self.assertTrue(config.institutions[0].manual_only)
        self.assertEqual(
            config.institutions[0].manual_programme_urls,
            (rows[0]["url"],),
        )


if __name__ == "__main__":
    unittest.main()
