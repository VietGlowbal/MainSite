from __future__ import annotations

import unittest

from glowbal_ingestion.conflicts import assertions_overlap


def tuition_assertion(
    value: dict[str, object],
    *,
    assertion_id: str,
) -> dict[str, object]:
    return {
        "assertion_id": assertion_id,
        "entity_type": "programme",
        "entity_id": "programme-1",
        "field_name": "tuition",
        "value_json": value,
        "scope": "institution",
        "audience": "all",
        "academic_cycle": "2026-2027",
    }


class Remediation12SafeUnresolvedTests(unittest.TestCase):
    def test_different_billing_basis_is_not_same_fact_conflict(self) -> None:
        per_semester = tuition_assertion(
            {
                "credential": "Master of Engineering",
                "amount": 35_680,
                "currency": "USD",
                "fee_period": "per semester",
            },
            assertion_id="semester",
        )
        total_program = tuition_assertion(
            {
                "credential": "Master of Engineering",
                "amount": 107_040,
                "currency": "USD",
                "fee_period": "total program",
            },
            assertion_id="total",
        )

        self.assertFalse(assertions_overlap(per_semester, total_program))

    def test_different_fee_categories_are_not_same_fact_conflict(self) -> None:
        engineering = tuition_assertion(
            {
                "credential": "Engineering programmes",
                "amount": 630,
                "currency": "EUR",
                "fee_period": "year",
            },
            assertion_id="engineering",
        )
        masters = tuition_assertion(
            {
                "credential": "Master's degree programmes",
                "amount": 255,
                "currency": "EUR",
                "fee_period": "year",
            },
            assertion_id="masters",
        )

        self.assertFalse(assertions_overlap(engineering, masters))

    def test_same_fee_dimension_remains_a_conflict(self) -> None:
        first = tuition_assertion(
            {
                "credential": "Master of Engineering",
                "amount": 35_680,
                "currency": "USD",
                "fee_period": "per semester",
            },
            assertion_id="first",
        )
        second = tuition_assertion(
            {
                "credential": "Master of Engineering",
                "amount": 40_000,
                "currency": "USD",
                "fee_period": "per semester",
            },
            assertion_id="second",
        )

        self.assertTrue(assertions_overlap(first, second))


if __name__ == "__main__":
    unittest.main()
