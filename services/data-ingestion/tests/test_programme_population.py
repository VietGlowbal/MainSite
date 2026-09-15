from __future__ import annotations

import sys
import unittest
from dataclasses import replace
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.discovery import ProgrammeCandidate
from glowbal_ingestion.config import SourceEcosystemConfig
from glowbal_ingestion.models import (
    ProgrammePopulationClassification,
    ProgrammeRecord,
    stable_id,
)
from glowbal_ingestion.normalization import (
    candidate_to_programme,
    programme_metadata_entry_for_url,
)
from glowbal_ingestion.validation import (
    classify_programme_population,
    programme_is_production_programme,
)


def _programme(name: str = "Computer Science") -> ProgrammeRecord:
    return ProgrammeRecord(
        programme_id="programme-1",
        institution_id="institution-1",
        programme_name=name,
        official_url="https://example.edu/programmes/computer-science",
        degree_level="master",
        credential=None,
        normalized_field="computer science",
        organisation_unit_id=None,
        language=None,
        campus=None,
        delivery_mode=None,
        duration=None,
        programme_status=None,
        catalogue_source="user_supplied",
        retrieved_at="2026-09-16T00:00:00+00:00",
    )


class ProgrammePopulationTests(unittest.TestCase):
    def test_production_population_flag_is_explicitly_opt_in(self) -> None:
        self.assertFalse(SourceEcosystemConfig.from_dict({}).production_programmes_only)
        self.assertTrue(
            SourceEcosystemConfig.from_dict(
                {"production_programmes_only": True}
            ).production_programmes_only
        )
        self.assertTrue(
            SourceEcosystemConfig.from_dict(
                {"source_ecosystem": {"production_programmes_only": True}}
            ).production_programmes_only
        )

    def test_datastore_search_cannot_be_canonical_programme_identity(self) -> None:
        programme = candidate_to_programme(
            "duo-institution",
            ProgrammeCandidate(
                "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
                "?filters=%7B%22OPLEIDINGSEENHEIDCODE%22%3A%221001O1%22%7D"
                "&limit=1&resource_id=resource",
                None,
                "user_supplied",
                95,
            ),
        )
        self.assertNotEqual(programme.programme_name.casefold(), "datastore search")

    def test_metadata_lookup_tolerates_query_parameter_order(self) -> None:
        configured = (
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
            "?resource_id=resource&limit=1&filters=%7B%22CODE%22%3A%221001O1%22%7D"
        )
        discovered = (
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
            "?filters=%7B%22CODE%22%3A%221001O1%22%7D&limit=1&resource_id=resource"
        )
        key, metadata = programme_metadata_entry_for_url(
            {configured: {"programme_name": "Real RIO programme"}},
            discovered,
        )
        self.assertEqual(key, configured)
        self.assertEqual(metadata["programme_name"], "Real RIO programme")

    def test_real_duo_programme_title_is_used_instead_of_endpoint_label(self) -> None:
        candidate = ProgrammeCandidate(
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
            "?filters=%7B%22OPLEIDINGSEENHEIDCODE%22%3A%221001O1%22%7D"
            "&limit=1&resource_id=resource",
            None,
            "user_supplied",
            95,
        )
        key, metadata = programme_metadata_entry_for_url(
            {
                "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
                "?resource_id=resource&limit=1&filters=%7B%22OPLEIDINGSEENHEIDCODE%22%3A%221001O1%22%7D": {
                    "programme_name": "Geographical Information Sciences"
                }
            },
            candidate.url,
        )
        self.assertIsNotNone(key)
        programme = candidate_to_programme(
            "duo-institution",
            replace(candidate, name_hint=metadata["programme_name"]),
        )
        self.assertEqual(programme.programme_name, "Geographical Information Sciences")
        self.assertNotEqual(programme.programme_name.casefold(), "datastore search")

    def test_duo_binding_keeps_configuration_id_when_query_order_changes(self) -> None:
        configured = (
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
            "?resource_id=resource&limit=1&filters=%7B%22CODE%22%3A%221001O1%22%7D"
        )
        discovered = (
            "https://onderwijsdata.duo.nl/api/3/action/datastore_search"
            "?filters=%7B%22CODE%22%3A%221001O1%22%7D&limit=1&resource_id=resource"
        )
        key, _ = programme_metadata_entry_for_url(
            {configured: {"programme_name": "Real RIO programme"}}, discovered
        )
        canonical_id = stable_id("programme", "duo-institution", discovered)
        configured_id = stable_id("programme", "duo-institution", key or configured)
        self.assertNotEqual(canonical_id, configured_id)
        self.assertEqual(configured_id, stable_id("programme", "duo-institution", configured))

    def test_verified_programme_requires_identity_and_strong_binding(self) -> None:
        identifiers = {"duo_rio_ho": {"OPLEIDINGSEENHEIDCODE": "1001O1"}}
        self.assertTrue(
            programme_is_production_programme(
                _programme(),
                provider_programme_identifiers=identifiers,
                verified_programme_identity=True,
                deterministic_binding=True,
            )
        )

    def test_sparse_verified_programme_is_not_rejected_for_missing_fields(self) -> None:
        classification = classify_programme_population(
            _programme(),
            provider_programme_identifiers={
                "susa_navet_info": {"SUSA_INFO_ID": "i.example"}
            },
            verified_programme_identity=True,
            deterministic_binding=True,
        )
        self.assertEqual(
            classification,
            ProgrammePopulationClassification.VERIFIED_PROGRAMME,
        )

    def test_institution_only_evidence_is_synthetic_not_a_programme(self) -> None:
        classification = classify_programme_population(
            _programme("University Computer Science"),
            provider_programme_identifiers={},
            verified_programme_identity=True,
            institution_only_source=True,
        )
        self.assertEqual(
            classification,
            ProgrammePopulationClassification.SYNTHETIC_SEED,
        )
        self.assertFalse(
            programme_is_production_programme(
                _programme("University Computer Science"),
                provider_programme_identifiers={},
                institution_only_source=True,
            )
        )

    def test_unresolved_target_is_tracked_but_not_admitted(self) -> None:
        classification = classify_programme_population(
            _programme("Possible Programme"),
            provider_programme_identifiers={},
        )
        self.assertEqual(
            classification,
            ProgrammePopulationClassification.UNRESOLVED_CANDIDATE,
        )

    def test_invalid_transport_label_wins_over_other_metadata(self) -> None:
        classification = classify_programme_population(
            _programme("Datastore Search"),
            provider_programme_identifiers={
                "duo_rio_ho": {"OPLEIDINGSEENHEIDCODE": "1001O1"}
            },
            verified_programme_identity=True,
            deterministic_binding=True,
        )
        self.assertEqual(
            classification,
            ProgrammePopulationClassification.INVALID_PROVIDER_MAPPING,
        )


if __name__ == "__main__":
    unittest.main()
