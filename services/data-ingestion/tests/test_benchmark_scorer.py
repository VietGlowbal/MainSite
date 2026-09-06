"""Unit and golden-fixture tests for the frozen Phase 3F scorer."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from glowbal_ingestion.benchmark_scorer import (
    TruthChecksumMismatch,
    load_truth,
    score,
    score_records,
)

ROOT = Path(__file__).resolve().parents[3]
TRUTH_PATH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl"
MANIFEST_PATH = ROOT / "docs/benchmarks/2026-09-01-phase-3f-ground-truth-freeze-v2.json"
FIXTURE_DIR = ROOT / "services/data-ingestion/tests/fixtures/benchmark-scorer"


class BenchmarkScorerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cls.truth = [
            json.loads(line)
            for line in TRUTH_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def _perfect_output(self) -> dict:
        records = []
        for item in self.truth:
            if item["review_status"] != "REVIEWED_CONFIRMED":
                continue
            state = item["expected_state"]
            record = {
                "case_id": item["case_id"],
                "field": item["field"],
                "state": state,
                # NOT_REQUIRED/NOT_PUBLISHED truth rows may retain explanatory
                # text in expected_value, but their runtime state is a
                # non-value assertion and must emit null.
                "value": item["expected_value"] if state == "FOUND" else None,
                "normalized_value": item["normalized_value"] if state == "FOUND" else None,
                "audience": item["audience"],
                "target_cycle": item["academic_cycle"],
                "identity": {
                    "resolved": True,
                    "institution": item["institution"],
                    "programme": item["programme"],
                },
                "provenance": {
                    "durable": True,
                    "raw_document_id": "fixture-raw-document",
                    "assertion_id": "fixture-assertion",
                    "source_url": item.get("source_url"),
                    "source_authority": "OFFICIAL",
                    "supports_claim": True,
                    "evidence_entailment": "DETERMINISTIC_PASS",
                },
                "quality": {
                    "inferred": False,
                    "verification_required": False,
                    "verification": "HUMAN_VERIFIED",
                    "conflict_state": "NONE",
                    "temporal_state": "CURRENT",
                    "applicability_state": "APPLICABLE",
                },
            }
            if state == "FOUND":
                record["product_state"] = "PRODUCT_SAFE"
            else:
                record["product_state"] = "REVIEWABLE"
            records.append(record)
        return {
            "schema_version": "phase3f-v3-benchmark-output/v1",
            "run_id": "phase3f-v2-run-synthetic-perfect",
            "truth_version": self.manifest["truth_version"],
            "discovery": {
                "programme_keys": [f"roster-v2-row-{i}" for i in range(1, 37)],
                "required_source_keys": [
                    f"roster-v2-row-{i}-primary" for i in range(1, 37)
                ],
            },
            "records": records,
        }

    def _with_fixture(self, name: str) -> dict:
        output = self._perfect_output()
        by_id = {item["case_id"]: item for item in output["records"]}
        fixture = json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))
        for item in fixture["records"]:
            by_id[item["case_id"]] = item
        output["records"] = list(by_id.values())
        return output

    def test_perfect_truth_derived_self_test(self) -> None:
        result = score_records(self.truth, self._perfect_output())
        self.assertEqual(result["metrics"]["truth_comparison_failures"], 0)
        self.assertEqual(result["metrics"]["coverage_loss_count"], 0)
        self.assertEqual(result["metrics"]["critical_field_precision"]["value"], 1.0)
        self.assertEqual(result["metrics"]["identity_merge_violations"], 0)
        self.assertEqual(result["metrics"]["false_current_critical_count"], 0)
        self.assertEqual(result["metrics"]["product_safe_evidence_entailment"]["value"], 1.0)
        self.assertEqual(result["metrics"]["programme_discovery_institution_floor"]["min_value"], 1.0)
        self.assertEqual(result["metrics"]["programme_discovery_institution_floor"]["violating_institutions"], [])

    def test_safe_abstention_is_coverage_loss_not_false_fact(self) -> None:
        result = score_records(self.truth, self._with_fixture("safe-abstention.json"))
        self.assertEqual(result["metrics"]["truth_comparison_failures"], 0)
        self.assertEqual(result["metrics"]["coverage_loss_count"], 1)
        self.assertEqual(result["metrics"]["critical_field_precision"]["value"], 1.0)

    def test_confirmed_needs_review_concrete_value_is_false_current(self) -> None:
        output = self._perfect_output()
        case = next(
            item for item in output["records"]
            if item["case_id"] == "GT-V2-01-programme_status"
        )
        case.update({"state": "FOUND", "value": "ACTIVE", "product_state": "REVIEWABLE"})
        result = score_records(self.truth, output)
        self.assertEqual(result["metrics"]["false_current_critical_count"], 1)
        self.assertIn("PROMOTION", next(
            item for item in result["cases"]
            if item["case_id"] == "GT-V2-01-programme_status"
        )["error_classes"])

    def test_wrong_value_fails_precision(self) -> None:
        result = score_records(self.truth, self._with_fixture("wrong-value.json"))
        self.assertEqual(result["metrics"]["truth_comparison_failures"], 1)
        self.assertEqual(result["metrics"]["critical_field_precision"]["value"], 121 / 122)

    def test_identity_and_normalization_mismatches_fail(self) -> None:
        result = score_records(self.truth, self._with_fixture("identity-mismatch.json"))
        case = next(item for item in result["cases"] if item["case_id"] == "GT-V2-01-programme_identity")
        self.assertIn("IDENTITY", case["error_classes"])
        self.assertEqual(result["metrics"]["truth_comparison_failures"], 1)

    def test_credential_normalization_does_not_translate_or_alias_awards(self) -> None:
        result = score_records(self.truth, self._with_fixture("credential-mismatch.json"))
        case = next(
            item for item in result["cases"]
            if item["case_id"] == "GT-V2-01-credential"
        )
        self.assertEqual(case["outcome"], "FAIL")
        self.assertIn("IDENTITY", case["error_classes"])

    def test_deadline_cycle_and_tuition_fee_scope_fail(self) -> None:
        result = score_records(self.truth, self._with_fixture("temporal-and-fee-mismatch.json"))
        deadline = next(item for item in result["cases"] if item["case_id"] == "GT-V2-27-application_deadline")
        tuition = next(item for item in result["cases"] if item["case_id"] == "GT-V2-01-tuition")
        self.assertIn("TEMPORAL", deadline["error_classes"])
        self.assertIn("APPLICABILITY", tuition["error_classes"])

    def test_product_safety_negative_controls(self) -> None:
        for fixture_name, metric_name in (
            ("unsafe-promotion.json", "false_current_critical_count"),
            ("stale-promotion.json", "critical_stale_only_promoted_count"),
            ("conflict-promotion.json", "critical_unresolved_conflict_promoted_count"),
            ("source-not-found-promotion.json", "critical_source_not_found_promoted_count"),
        ):
            with self.subTest(fixture=fixture_name):
                result = score_records(self.truth, self._with_fixture(fixture_name))
                self.assertGreaterEqual(result["metrics"][metric_name], 1)

    def test_missing_product_safe_lineage_is_rejected(self) -> None:
        result = score_records(self.truth, self._with_fixture("missing-provenance.json"))
        self.assertGreaterEqual(
            result["metrics"]["product_safe_without_durable_provenance_count"], 1
        )
        self.assertLess(result["metrics"]["product_safe_evidence_entailment"]["value"], 1.0)

    def test_raw_persistence_failure_maps_to_canonical_lineage_blocker(self) -> None:
        result = score_records(self.truth, self._with_fixture("raw-persist-failure.json"))
        self.assertGreaterEqual(
            result["metrics"]["product_safe_without_durable_provenance_count"], 1
        )
        case = next(
            item for item in result["cases"]
            if item["case_id"] == "GT-V2-01-programme_identity"
        )
        self.assertIn("RAW_LINEAGE_MISSING", case["product_safe_violations"])

    def test_ambiguous_case_is_excluded_from_primary_denominator(self) -> None:
        output = self._perfect_output()
        output["records"].append(
            {
                "case_id": "GT-V2-05-tuition",
                "state": "FOUND",
                "value": "intentionally wrong ambiguous value",
            }
        )
        result = score_records(self.truth, output)
        self.assertEqual(result["counts"]["primary_scoreable_records"], 246)
        case = next(item for item in result["cases"] if item["case_id"] == "GT-V2-05-tuition")
        self.assertEqual(case["outcome"], "EXCLUDED_AMBIGUOUS")
        self.assertEqual(result["metrics"]["truth_comparison_failures"], 0)

    def test_truth_checksum_mismatch_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / "truth.jsonl"
            shutil.copyfile(TRUTH_PATH, altered)
            with altered.open("ab") as handle:
                handle.write(b"\n")
            with self.assertRaises(TruthChecksumMismatch):
                load_truth(altered, manifest=self.manifest)

    def test_end_to_end_score_verifies_manifest_and_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "synthetic-output.json"
            output.write_text(
                json.dumps(self._perfect_output(), ensure_ascii=False),
                encoding="utf-8",
            )
            result = score(
                truth_path=TRUTH_PATH,
                manifest_path=MANIFEST_PATH,
                contract_path=ROOT / "docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json",
                output_path=output,
            )
            self.assertEqual(result["metrics"]["truth_comparison_failures"], 0)


if __name__ == "__main__":
    unittest.main()
