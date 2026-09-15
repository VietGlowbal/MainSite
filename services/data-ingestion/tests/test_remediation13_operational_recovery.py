from __future__ import annotations

from io import BytesIO
import threading
import sys
import tempfile
from urllib.error import HTTPError
import unittest
from pathlib import Path
from unittest.mock import patch


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.deepseek import (
    DeepSeekClient,
    DeepSeekError,
    DeepSeekStats,
)
from glowbal_ingestion.config import SmokeConfig
from glowbal_ingestion.storage import StateStore
from glowbal_ingestion.source_recovery import (
    rank_source_candidates,
    source_scope_compatible,
)


class Remediation13SourceRecoveryTests(unittest.TestCase):
    def test_candidate_order_prefers_same_host_and_is_stable(self) -> None:
        candidates = rank_source_candidates(
            [
                "https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml",
                "https://itasia.iii.u-tokyo.ac.jp/",
                "https://www.u-tokyo.ac.jp/en/current-students/tuition.html",
            ],
            target_url="https://itasia.iii.u-tokyo.ac.jp/admissions-soon",
            field_names=("programme_status", "tuition"),
        )
        self.assertEqual(candidates[0].url, "https://itasia.iii.u-tokyo.ac.jp/")
        self.assertEqual(
            [item.url for item in candidates],
            [item.url for item in rank_source_candidates(
                [
                    "https://www.u-tokyo.ac.jp/en/current-students/tuition.html",
                    "https://itasia.iii.u-tokyo.ac.jp/",
                    "https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml",
                ],
                target_url="https://itasia.iii.u-tokyo.ac.jp/admissions-soon",
                field_names=("programme_status", "tuition"),
            )],
        )

    def test_candidate_limit_is_bounded_and_deduplicated(self) -> None:
        candidates = rank_source_candidates(
            [
                "https://example.edu/a",
                "https://example.edu/a/",
                "https://example.edu/b",
                "https://example.edu/c",
            ],
            target_url="https://example.edu/programme",
            max_candidates=2,
        )
        self.assertEqual(len(candidates), 2)
        self.assertEqual(len({item.url for item in candidates}), 2)

    def test_different_same_host_programme_scope_is_not_a_fallback(self) -> None:
        target = "https://www.i.u-tokyo.ac.jp/edu/course/ice/admission_e.shtml"
        wrong_scope = "https://www.i.u-tokyo.ac.jp/edu/course/cs/admission_e.shtml"
        cross_subdomain_wrong_scope = (
            "https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2027_en.pdf"
        )
        central = "https://www.u-tokyo.ac.jp/en/current-students/tuition.html"
        self.assertFalse(source_scope_compatible(wrong_scope, target))
        self.assertFalse(source_scope_compatible(cross_subdomain_wrong_scope, target))
        self.assertTrue(source_scope_compatible(central, target))
        candidates = rank_source_candidates(
            [wrong_scope, central],
            target_url=target,
            field_names=("programme_identity", "tuition"),
        )
        self.assertEqual([item.url for item in candidates], [central])


class Remediation13ExtractionRecoveryTests(unittest.TestCase):
    @staticmethod
    def _client() -> DeepSeekClient:
        client = object.__new__(DeepSeekClient)
        client.stats = DeepSeekStats()
        client._stats_lock = threading.Lock()
        return client

    @staticmethod
    def _valid_status_fact() -> dict[str, object]:
        return {
            "field_name": "programme_status",
            "value": "active",
            "source_url": "https://example.edu/programme",
            "evidence": "The programme is active.",
            "confidence": 0.9,
        }

    def test_malformed_fact_does_not_discard_valid_sibling(self) -> None:
        client = self._client()
        payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [
                self._valid_status_fact(),
                {
                    "field_name": "recommendation_letters",
                    "value": {
                        "requirement_status": "required",
                        "document_type": "invalid-document-type",
                        "required_count": 1,
                        "application_stage": "initial_application",
                        "components": [],
                    },
                    "source_url": "https://example.edu/admissions",
                    "evidence": "Letters are required.",
                    "confidence": 0.8,
                },
            ],
            "warnings": [],
        }
        result = client._validate_payload_with_fact_isolation(
            payload,
            ("programme_status", "recommendation_letters"),
        )
        self.assertEqual(
            [fact["field_name"] for fact in result["facts"]],
            ["programme_status"],
        )
        self.assertEqual(client.stats.partial_fact_recoveries, 1)

    def test_all_malformed_facts_remain_an_extraction_failure(self) -> None:
        client = self._client()
        payload = {
            "schema_version": DeepSeekClient.SCHEMA_VERSION,
            "programme_identity_match": True,
            "facts": [
                {
                    "field_name": "recommendation_letters",
                    "value": {
                        "requirement_status": "required",
                        "document_type": "invalid-document-type",
                        "required_count": 1,
                        "application_stage": "initial_application",
                        "components": [],
                    },
                    "source_url": "https://example.edu/admissions",
                    "evidence": "Letters are required.",
                    "confidence": 0.8,
                }
            ],
            "warnings": [],
        }
        with self.assertRaises(DeepSeekError):
            client._validate_payload_with_fact_isolation(
                payload,
                ("recommendation_letters",),
            )

    def test_provider_stats_include_total_tokens_and_http_classes(self) -> None:
        stats = DeepSeekStats(
            prompt_tokens=11,
            completion_tokens=7,
            http_429_responses=1,
            http_401_responses=2,
            http_402_responses=3,
            http_5xx_responses=4,
        ).to_dict()
        self.assertEqual(stats["total_tokens"], 18)
        self.assertEqual(stats["http_429_responses"], 1)
        self.assertEqual(stats["http_401_responses"], 2)
        self.assertEqual(stats["http_402_responses"], 3)
        self.assertEqual(stats["http_5xx_responses"], 4)

    def test_payment_error_is_not_retried(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        error_body = BytesIO(b'{"error":"payment required"}')
        payment_error = HTTPError(
            "https://provider.example/chat/completions",
            402,
            "payment required",
            {},
            error_body,
        )
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            "os.environ",
            {"EXTRACTION_API_KEY": "test-key", "EXTRACTION_MAX_RETRIES": "4"},
            clear=False,
        ), patch(
            "glowbal_ingestion.deepseek.urlopen",
            side_effect=payment_error,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                with self.assertRaises(DeepSeekError) as raised:
                    client._request_raw(
                        model_name="deepseek-v4-flash",
                        prompt="Return JSON.",
                        thinking=False,
                    )
            finally:
                state.close()
        error_body.close()
        payment_error.close()
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(client.stats.request_attempts, 1)
        self.assertEqual(client.stats.http_402_responses, 1)

    def test_context_failure_is_split_into_bounded_field_requests(self) -> None:
        client = self._client()
        calls: list[tuple[tuple[str, ...], int]] = []

        def fake_extract_group(
            programme: object,
            sources: list[object],
            extraction_group: str,
            field_names: tuple[str, ...],
            **kwargs: object,
        ) -> tuple[str, dict[str, object]]:
            calls.append((field_names, len(sources)))
            return "deepseek-v4-flash", {
                "facts": [],
                "programme_identity_match": True,
                "warnings": [],
            }

        client._extract_group = fake_extract_group  # type: ignore[method-assign]
        result = client._recover_context_limited_group(
            object(),
            [object(), object(), object()],
            "academics_admissions",
            ("programme_status", "tuition", "english_requirement"),
            prefer_pro=False,
            retain_only_requested_fields=True,
        )
        self.assertIsNotNone(result)
        self.assertEqual(calls, [
            (("programme_status", "tuition"), 2),
            (("english_requirement",), 2),
        ])
        self.assertEqual(client.stats.group_isolation_recoveries, 1)

    def test_context_failure_with_one_field_stays_failed(self) -> None:
        client = self._client()
        result = client._recover_context_limited_group(
            object(),
            [object()],
            "academics_admissions",
            ("programme_status",),
            prefer_pro=False,
            retain_only_requested_fields=True,
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
