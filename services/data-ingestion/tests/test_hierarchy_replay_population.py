"""Recipient admission must never act as a hierarchy donor admission gate."""
from __future__ import annotations

import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

REPLAY_ROOT = Path(__file__).resolve().parents[3] / "docs/architecture/data/external-field-stage1-20260915"
sys.path.insert(0, str(REPLAY_ROOT))
import rebuild_verified_population as replay
from test_hierarchical_inference import TARGET, assertion
from glowbal_ingestion.models import ApplicabilityState, SourceRelationship

reports = replay.hierarchy_reports


class HierarchyReplayPopulationTests(unittest.TestCase):
    def remap(self, assertions, *, target=None, donor=None, units=(), relations=()):
        target = dict(target or TARGET)
        target.update(programme_name="Verified programme", official_url="https://example.edu/p")
        donor = dict(donor or {**target, "programme_id": "synthetic-seed", "programme_name": "Synthetic seed"})
        institutions = [
            {"institution_id": key, "country_code": "US", "canonical_name": key}
            for key in ("institution-a", "institution-off-target")
        ]
        raw = {
            "programmes": [target, donor],
            "programme_contexts": [target, donor],
            "institutions": institutions,
            "assertions": assertions,
            "review_direct": {},
            "organisation_units": list(units),
            "programme_organisation_units": list(relations),
        }
        context = {
            "final_rows": [target],
            "old_id_to_new": {"old-donor": "remapped-donor", "old-target": target["programme_id"]},
        }
        with patch.object(replay, "read_jsonl", return_value=[]):
            return replay.remap_hierarchy_data(raw, context)

    def decide(self, data):
        decisions, _ = reports.run_decisions(data, optimized=True)
        self.assertEqual({pid for pid, _ in decisions}, {TARGET["programme_id"]})
        return decisions[(TARGET["programme_id"], "tuition")]

    def institution_assertion(self, **kwargs):
        return assertion("institution-fact", "institution-a", entity_type="institution", scope="institution", **kwargs)

    def test_institution_donors_survive_without_programme_wrappers(self):
        same = self.institution_assertion()
        off = replace(same, assertion_id="off-target", entity_id="institution-off-target")
        data = self.remap([same, off])
        self.assertEqual({a.assertion_id for a in data["assertions"]}, {"institution-fact", "off-target"})
        self.assertEqual(len(data["institution_contexts"]), 2)
        decision = self.decide(data)
        self.assertEqual(decision.level.short_code, "H2")
        self.assertEqual(decision.record.donor_assertion_ids, (same.assertion_id,))

    def test_synthetic_recipient_excluded_from_decisions_export_and_denominator(self):
        data = self.remap([assertion("synthetic-fact", "synthetic-seed")])
        decisions, _ = reports.run_decisions(data, optimized=True)
        self.assertEqual(len(decisions), len(reports.FIELDS))
        self.assertEqual({pid for pid, _ in decisions}, {TARGET["programme_id"]})
        with tempfile.TemporaryDirectory() as directory:
            outputs = reports.matrix_and_outputs(data, decisions, Path(directory))
        self.assertEqual(len(outputs["completeness_rows"]), 1)
        self.assertTrue(all(row["total_targets"] == 1 for row in outputs["summary_rows"]))
        lead = replay.make_lead_export(outputs, {"verified_rows": data["programmes"]}, data)
        self.assertEqual([row["programme_id"] for row in lead], [TARGET["programme_id"]])
        self.assertIn("synthetic-fact", {a.assertion_id for a in data["assertions"]})

    def test_off_target_sibling_donor_and_context_are_remapped_and_retained(self):
        data = self.remap(
            [assertion("sibling-fact", "old-donor")],
            donor={**TARGET, "programme_id": "old-donor"},
        )
        decision = self.decide(data)
        self.assertEqual(decision.level.short_code, "H3")
        self.assertEqual(decision.record.donor_entity_ids, ("remapped-donor",))
        self.assertEqual(decision.candidates[0].donor_context.institution_id, "institution-a")

    def test_org_unit_evidence_and_remapped_relationship_reach_h1(self):
        data = self.remap(
            [assertion("parent-fact", "department-a", entity_type="organisation_unit", scope="department", relationship=SourceRelationship.DEPARTMENT)],
            target={**TARGET, "organisation_unit_id": None},
            units=[{"organisation_unit_id": "department-a", "institution_id": "institution-a"}],
            relations=[{"programme_id": "old-target", "organisation_unit_id": "department-a"}],
        )
        self.assertEqual(self.decide(data).level.short_code, "H1")

    def test_incompatible_institution_donors_remain_rejected(self):
        original = self.institution_assertion()
        cases = [
            (replace(original, audience="domestic"), "AUDIENCE_MISMATCH"),
            (replace(original, value_json={"amount": 100, "currency": "EUR", "basis": "annual"}), "CURRENCY_MISMATCH"),
            (replace(original, value_json={"amount": 100, "currency": "USD", "basis": "semester"}), "UNIT_BASIS_MISMATCH"),
            (replace(original, applicability_state=ApplicabilityState.NOT_APPLICABLE), "NOT_APPLICABLE"),
            (replace(original, academic_cycle="2030-2031"), "CYCLE_MISMATCH"),
        ]
        for donor, reason in cases:
            with self.subTest(reason=reason):
                decision = self.decide(self.remap([donor]))
                self.assertIsNone(decision.record)
                self.assertIn(reason, {row["reason"] for row in decision.rejected})

    def test_different_institution_never_becomes_h2(self):
        donor = replace(self.institution_assertion(), entity_id="institution-off-target")
        decision = self.decide(self.remap([donor]))
        self.assertIsNone(decision.record)
        self.assertFalse(any(row.get("level") == "H2_INSTITUTION" for row in decision.rejected))

    def test_h2_finance_scope_and_recipient_remain_separate(self):
        for field in ("tuition", "additional_fees"):
            with self.subTest(field=field):
                donor = replace(self.institution_assertion(), field_name=field)
                data = self.remap([donor])
                decisions, _ = reports.run_decisions(data, optimized=True)
                record = decisions[(TARGET["programme_id"], field)].record
                self.assertEqual(record.entity_id, TARGET["programme_id"])
                self.assertEqual(record.output_scope, "institution")
                self.assertEqual(record.output_scope_entity_id, "institution-a")
                self.assertEqual(record.as_assertion().scope, "institution")
                with tempfile.TemporaryDirectory() as directory:
                    outputs = reports.matrix_and_outputs(data, decisions, Path(directory))
                lead = replay.make_lead_export(outputs, {"verified_rows": data["programmes"]}, data)
                self.assertEqual(lead[0][field + "_scope"], "institution")

    def test_prepare_data_loads_persisted_org_unit_contexts(self):
        unit = {"organisation_unit_id": "department-a", "institution_id": "institution-a"}
        relation = {"programme_id": "target-programme", "organisation_unit_id": "department-a"}
        files = {"organisation_units.jsonl": [unit], "programme_organisation_units.jsonl": [relation]}
        with patch.object(reports, "read_jsonl", side_effect=lambda path: files.get(path.name, [])):
            data = reports.prepare_data()
        self.assertEqual(data["organisation_units"], [unit])
        self.assertEqual(data["programme_organisation_units"], [relation])

    def test_structured_application_window_becomes_deterministic_deadline(self):
        row = {
            "programme_id": TARGET["programme_id"],
            "field_name": "application_windows",
            "value": "alkaa=2026-12-07T09:00; paattyy=2027-01-05T15:00",
            "verification_status": "RULE_VALIDATED",
            "source_url": "https://studyinfo.example/implementation/1",
            "raw_document_id": "studyinfo-document",
            "source_content_hash": "hash",
            "provider_id": "studyinfo_toteutus",
        }
        derived = reports.deterministic_deadline_assertions([row], [])
        self.assertEqual(len(derived), 1)
        self.assertEqual(derived[0].field_name, "final_deadline")
        self.assertEqual(derived[0].value_json, "2027-01-05")
        self.assertEqual(derived[0].source_type, "deadline")
        self.assertEqual(derived[0].scope, "programme")
        self.assertIsNone(derived[0].model_name)

    def test_prepare_data_appends_persisted_structured_deadline(self):
        row = {
            "programme_id": TARGET["programme_id"],
            "field_name": "application_windows",
            "value": "alkaa=2026-12-07T09:00; paattyy=2027-01-05T15:00",
            "verification_status": "RULE_VALIDATED",
            "source_url": "https://studyinfo.example/implementation/1",
            "raw_document_id": "studyinfo-document",
            "source_content_hash": "hash",
            "provider_id": "studyinfo_toteutus",
        }
        with patch.object(
            reports,
            "read_jsonl",
            side_effect=lambda path: [row] if path.name == "external_programme_metadata.jsonl" else [],
        ):
            data = reports.prepare_data()
        derived = [item for item in data["assertions"] if item.source_type == "deadline"]
        self.assertEqual(len(derived), 1)
        self.assertEqual(data["deterministic_metadata_count"], 1)
        self.assertEqual(derived[0].value_json, "2027-01-05")

    def test_existing_deadline_wins_and_conflicting_windows_are_skipped(self):
        existing = replace(
            assertion("existing-deadline", TARGET["programme_id"]),
            field_name="final_deadline",
        )
        row = {
            "programme_id": TARGET["programme_id"],
            "field_name": "application_policy",
            "value": "closeDate=2027-01-05",
            "verification_status": "RULE_VALIDATED",
            "source_url": "https://studyinfo.example/policy/1",
            "raw_document_id": "policy-document",
        }
        self.assertEqual(reports.deterministic_deadline_assertions([row], [existing]), [])

        conflicting = [
            {
                **row,
                "field_name": "application_windows",
                "programme_id": "other-programme",
                "raw_document_id": "a",
                "value": "paattyy=2027-01-05T15:00",
            },
            {
                **row,
                "field_name": "application_windows",
                "programme_id": "other-programme",
                "raw_document_id": "b",
                "value": "paattyy=2027-01-06T15:00",
            },
        ]
        self.assertEqual(reports.deterministic_deadline_assertions(conflicting, []), [])


if __name__ == "__main__":
    unittest.main()
