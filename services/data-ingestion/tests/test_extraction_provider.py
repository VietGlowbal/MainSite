from __future__ import annotations

import json
import os
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError
from unittest.mock import patch

from glowbal_ingestion.config import SmokeConfig
from glowbal_ingestion.deepseek import DeepSeekClient, DeepSeekError
from glowbal_ingestion.extraction_provider import (
    ExtractionProviderError,
    ExtractionProviderErrorCode,
    ExtractionRequest,
    ExtractionSource,
    LegacyTupleExtractionProvider,
    UnavailableExtractionProvider,
    create_extraction_provider,
    extraction_request_fingerprint,
)
from glowbal_ingestion.storage import StateStore


class ExtractionProviderContractTests(unittest.TestCase):
    def test_fingerprint_changes_for_material_extraction_semantics(self) -> None:
        source = ExtractionSource(
            url="https://example.edu/program",
            page_type="programme_overview",
            title=None,
            text="Programme text",
            content_hash="a" * 64,
        )
        base = extraction_request_fingerprint(
            entity_id="programme-1",
            source_content_hashes=(source.content_hash,),
            field_names=("tuition",),
            prompt_version="prompt/v1",
            schema_version="schema/v1",
            provider_id="deepseek",
            model_id="model-a",
        )
        changed_fields = extraction_request_fingerprint(
            entity_id="programme-1",
            source_content_hashes=(source.content_hash,),
            field_names=("tuition", "toefl"),
            prompt_version="prompt/v1",
            schema_version="schema/v1",
            provider_id="deepseek",
            model_id="model-a",
        )
        changed_model = extraction_request_fingerprint(
            entity_id="programme-1",
            source_content_hashes=(source.content_hash,),
            field_names=("tuition",),
            prompt_version="prompt/v1",
            schema_version="schema/v1",
            provider_id="deepseek",
            model_id="model-b",
        )
        self.assertNotEqual(base, changed_fields)
        self.assertNotEqual(base, changed_model)

    def test_no_provider_is_valid_for_deterministic_only_execution(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "DEEPSEEK_API_KEY": "",
                "EXTRACTION_PROVIDER": "",
                "EXTRACTION_API_KEY": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
            },
            clear=False,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                provider = create_extraction_provider(config, state)
            finally:
                state.close()
        self.assertIsInstance(provider, UnavailableExtractionProvider)
        self.assertFalse(provider.configured)
        with self.assertRaises(ExtractionProviderError) as raised:
            provider.extract(
                ExtractionRequest(
                    entity_id="programme-1",
                    field_names=("tuition",),
                    sources=(),
                    prompt_version="prompt/v1",
                    schema_version="schema/v1",
                )
            )
        self.assertEqual(
            raised.exception.code,
            ExtractionProviderErrorCode.PROVIDER_UNAVAILABLE,
        )

    def test_legacy_deepseek_environment_selects_adapter(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {"DEEPSEEK_API_KEY": "legacy-key", "EXTRACTION_PROVIDER": ""},
            clear=False,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                provider = create_extraction_provider(config, state)
            finally:
                state.close()
        self.assertIsInstance(provider, LegacyTupleExtractionProvider)
        self.assertTrue(provider.configured)
        self.assertEqual(provider.provider_id, "openai_compatible")
        self.assertIsInstance(provider.legacy_client, DeepSeekClient)

    def test_generic_deepseek_configuration_is_supported(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "DEEPSEEK_API_KEY": "",
                "EXTRACTION_PROVIDER": "deepseek",
                "EXTRACTION_API_KEY": "generic-key",
                "EXTRACTION_MODEL": "generic-model",
                "EXTRACTION_ENDPOINT": "https://provider.example/v1/",
            },
            clear=False,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                provider = create_extraction_provider(config, state)
            finally:
                state.close()
        self.assertIsInstance(provider, LegacyTupleExtractionProvider)
        self.assertEqual(provider.legacy_client.api_key, "generic-key")
        self.assertEqual(
            provider.legacy_client.base_url, "https://provider.example/v1"
        )
        self.assertEqual(
            provider.legacy_client.config.deepseek_flash_model, "generic-model"
        )

    def test_explicit_deepseek_provider_wins_over_stale_compatible_values(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "EXTRACTION_PROVIDER": "deepseek",
                "DEEPSEEK_API_KEY": "official-test-key",
                "DEEPSEEK_BASE_URL": "https://api.deepseek.com",
                "DEEPSEEK_MODEL": "deepseek-v4-flash",
                "OPENAI_COMPATIBLE_API_KEY": "stale-compatible-key",
                "OPENAI_COMPATIBLE_BASE_URL": "https://api.b.ai/v1",
                "OPENAI_COMPATIBLE_MODEL": "stale-model",
            },
            clear=True,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                provider = create_extraction_provider(config, state)
            finally:
                state.close()
        self.assertEqual(provider.legacy_client.api_key, "official-test-key")
        self.assertEqual(provider.legacy_client.base_url, "https://api.deepseek.com")
        self.assertEqual(
            provider.legacy_client.config.deepseek_flash_model,
            "deepseek-v4-flash",
        )

    def test_openai_compatible_alias_configuration_is_supported(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "EXTRACTION_PROVIDER": "openai_compatible",
                "OPENAI_COMPATIBLE_API_KEY": "generic-key",
                "OPENAI_COMPATIBLE_BASE_URL": "https://provider.example/v1/",
                "OPENAI_COMPATIBLE_MODEL": "deepseek-chat",
            },
            clear=False,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                provider = create_extraction_provider(config, state)
            finally:
                state.close()
        self.assertIsInstance(provider, LegacyTupleExtractionProvider)
        self.assertTrue(provider.configured)
        self.assertEqual(provider.provider_id, "openai_compatible")
        self.assertEqual(provider.legacy_client.api_key, "generic-key")
        self.assertEqual(
            provider.legacy_client.base_url, "https://provider.example/v1"
        )
        self.assertEqual(
            provider.legacy_client.config.deepseek_flash_model, "deepseek-chat"
        )

    def test_reasoning_none_uses_openai_compatible_request_shape(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return json.dumps(
                    {
                        "choices": [
                            {
                                "message": {
                                    "content": '{"facts": [], "warnings": []}'
                                }
                            }
                        ],
                        "usage": {},
                    }
                ).encode("utf-8")

        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "EXTRACTION_API_KEY": "generic-key",
                "EXTRACTION_REASONING_EFFORT": "none",
            },
            clear=False,
        ), patch("glowbal_ingestion.deepseek.urlopen", return_value=Response()) as request:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                DeepSeekClient(config, state)._request_raw(
                    model_name="deepseek-chat",
                    prompt="Return JSON.",
                    thinking=True,
                )
            finally:
                state.close()

        body = json.loads(request.call_args.args[0].data)
        self.assertEqual(body["thinking"], {"type": "disabled"})
        self.assertNotIn("reasoning_effort", body)

    def test_provider_runtime_options_are_configurable_without_secret_repr(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "OPENAI_COMPATIBLE_API_KEY": "secret-that-must-not-leak",
                "OPENAI_COMPATIBLE_BASE_URL": "https://provider.example/v1",
                "EXTRACTION_TIMEOUT_SECONDS": "17",
                "EXTRACTION_MAX_RETRIES": "4",
                "EXTRACTION_TEMPERATURE": "0",
                "EXTRACTION_MAX_OUTPUT_TOKENS": "2048",
                "OPENAI_COMPATIBLE_MAX_CONCURRENCY": "2",
                "OPENAI_COMPATIBLE_BACKOFF_BASE": "0.5",
                "OPENAI_COMPATIBLE_BACKOFF_MAX": "4",
                "OPENAI_COMPATIBLE_BACKOFF_JITTER": "0.1",
            },
            clear=False,
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
            finally:
                state.close()
        self.assertEqual(client.base_url, "https://provider.example/v1")
        self.assertEqual(client.timeout_seconds, 17)
        self.assertEqual(client.max_retries, 4)
        self.assertEqual(client.temperature, 0)
        self.assertEqual(client.max_output_tokens, 2048)
        self.assertEqual(client.max_concurrency, 2)
        self.assertEqual(client.backoff_base_seconds, 0.5)
        self.assertEqual(client.backoff_max_seconds, 4)
        self.assertEqual(client.backoff_jitter_seconds, 0.1)
        self.assertNotIn("secret-that-must-not-leak", repr(client))

    def test_successful_openai_compatible_response_is_parsed(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return json.dumps(
                    {
                        "choices": [
                            {
                                "finish_reason": "stop",
                                "message": {"content": '{"ok": true}'},
                            }
                        ],
                        "usage": {"prompt_tokens": 3, "completion_tokens": 2},
                    }
                ).encode("utf-8")

        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {"OPENAI_COMPATIBLE_API_KEY": "generic-key"},
            clear=False,
        ), patch("glowbal_ingestion.deepseek.urlopen", return_value=Response()):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                payload = client._request_raw(
                    model_name="deepseek/deepseek-v4-flash",
                    prompt="Return JSON.",
                    thinking=False,
                )
            finally:
                state.close()
        self.assertEqual(payload, {"ok": True})
        self.assertEqual(client.stats.calls, 1)
        self.assertEqual(client.stats.prompt_tokens, 3)
        self.assertEqual(client.stats.completion_tokens, 2)

    def test_empty_response_is_rejected(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return b'{"choices":[{"message":{"content":""}}]}'

        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {"OPENAI_COMPATIBLE_API_KEY": "generic-key"},
            clear=False,
        ), patch("glowbal_ingestion.deepseek.urlopen", return_value=Response()):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                with self.assertRaisesRegex(DeepSeekError, "empty content"):
                    DeepSeekClient(config, state)._request_raw(
                        model_name="deepseek/deepseek-v4-flash",
                        prompt="Return JSON.",
                        thinking=False,
                    )
            finally:
                state.close()

    def test_malformed_json_response_is_rejected(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return b'{"choices":[{"message":{"content":"not-json"}}]}'

        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {"OPENAI_COMPATIBLE_API_KEY": "generic-key"},
            clear=False,
        ), patch("glowbal_ingestion.deepseek.urlopen", return_value=Response()):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                with self.assertRaisesRegex(DeepSeekError, "invalid response"):
                    DeepSeekClient(config, state)._request_raw(
                        model_name="deepseek/deepseek-v4-flash",
                        prompt="Return JSON.",
                        thinking=False,
                    )
            finally:
                state.close()

    def test_timeout_is_handled_as_retryable_provider_failure(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {"OPENAI_COMPATIBLE_API_KEY": "generic-key"},
            clear=False,
        ), patch(
            "glowbal_ingestion.deepseek.urlopen",
            side_effect=TimeoutError("timed out"),
        ):
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                with self.assertRaises(DeepSeekError) as raised:
                    DeepSeekClient(config, state)._request_raw(
                        model_name="deepseek/deepseek-v4-flash",
                        prompt="Return JSON.",
                        thinking=False,
                    )
            finally:
                state.close()
        self.assertEqual(
            raised.exception.code,
            ExtractionProviderErrorCode.PROVIDER_UNAVAILABLE,
        )
        self.assertTrue(raised.exception.retryable)

    def test_rate_limit_and_server_failure_are_retryable(self) -> None:
        config = SmokeConfig(run_name="test", institutions=())
        for status in (429, 503):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as temporary, patch.dict(
                os.environ,
                {"OPENAI_COMPATIBLE_API_KEY": "generic-key"},
                clear=False,
            ), patch(
                "glowbal_ingestion.deepseek.urlopen",
                side_effect=HTTPError(
                    "https://provider.example/v1/chat/completions",
                    status,
                    "failure",
                    {},
                    BytesIO(b"{}"),
                ),
            ):
                state = StateStore(Path(temporary) / "state.sqlite")
                try:
                    with self.assertRaises(DeepSeekError) as raised:
                        DeepSeekClient(config, state)._request_raw(
                            model_name="deepseek/deepseek-v4-flash",
                            prompt="Return JSON.",
                            thinking=False,
                        )
                finally:
                    state.close()
            self.assertTrue(raised.exception.retryable)

    def test_rate_limit_retry_respects_retry_after_and_records_recovery(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return json.dumps(
                    {
                        "choices": [
                            {
                                "message": {
                                    "content": json.dumps(
                                        {
                                            "schema_version": DeepSeekClient.SCHEMA_VERSION,
                                            "programme_identity_match": True,
                                            "facts": [],
                                            "warnings": [],
                                        }
                                    )
                                }
                            }
                        ]
                    }
                ).encode("utf-8")

        programme = SimpleNamespace(
            programme_id="programme-1",
            programme_name="Data Science",
            degree_level="master",
            official_url="https://example.edu/programme",
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title="Data Science",
            text="Data Science programme.",
            content_hash="a" * 64,
        )
        rate_limit = HTTPError(
            source.url,
            429,
            "busy",
            {"Retry-After": "0.1"},
            BytesIO(b"{}"),
        )
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "OPENAI_COMPATIBLE_API_KEY": "generic-key",
                "EXTRACTION_MAX_RETRIES": "1",
                "OPENAI_COMPATIBLE_BACKOFF_JITTER": "0",
            },
            clear=False,
        ), patch(
            "glowbal_ingestion.deepseek.urlopen",
            side_effect=[rate_limit, Response()],
        ), patch("glowbal_ingestion.deepseek.time.sleep") as sleep:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                _, payload = client._extract_group(
                    programme,
                    [source],
                    "identity_offering",
                    ("programme_status",),
                )
            finally:
                state.close()
        self.assertEqual(payload["facts"], [])
        self.assertEqual(client.stats.logical_requests, 1)
        self.assertEqual(client.stats.request_attempts, 2)
        self.assertEqual(client.stats.rate_limit_responses, 1)
        self.assertEqual(client.stats.retry_after_present, 1)
        self.assertEqual(client.stats.retry_attempts, 1)
        self.assertEqual(client.stats.rate_limit_retries, 1)
        self.assertEqual(client.stats.rate_limit_recoveries, 1)
        self.assertEqual(client.stats.terminal_rate_limit_failures, 0)
        sleep.assert_called_once_with(0.1)

    def test_repeated_rate_limits_stop_at_retry_budget(self) -> None:
        def rate_limit() -> HTTPError:
            return HTTPError(
                "https://provider.example/v1/chat/completions",
                429,
                "busy",
                {},
                BytesIO(b"{}"),
            )

        programme = SimpleNamespace(
            programme_id="programme-1",
            programme_name="Data Science",
            degree_level="master",
            official_url="https://example.edu/programme",
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title="Data Science",
            text="Data Science programme.",
            content_hash="a" * 64,
        )
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "OPENAI_COMPATIBLE_API_KEY": "generic-key",
                "EXTRACTION_MAX_RETRIES": "2",
                "OPENAI_COMPATIBLE_BACKOFF_BASE": "0.01",
                "OPENAI_COMPATIBLE_BACKOFF_JITTER": "0",
            },
            clear=False,
        ), patch(
            "glowbal_ingestion.deepseek.urlopen",
            side_effect=[rate_limit(), rate_limit(), rate_limit()],
        ), patch("glowbal_ingestion.deepseek.time.sleep") as sleep:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                with self.assertRaises(DeepSeekError):
                    client._extract_group(
                        programme,
                        [source],
                        "identity_offering",
                        ("programme_status",),
                    )
            finally:
                state.close()
        self.assertEqual(client.stats.logical_requests, 1)
        self.assertEqual(client.stats.request_attempts, 3)
        self.assertEqual(client.stats.rate_limit_responses, 3)
        self.assertEqual(client.stats.retry_attempts, 2)
        self.assertEqual(client.stats.terminal_rate_limit_failures, 1)
        self.assertEqual(sleep.call_count, 2)

    def test_non_retryable_quota_error_is_not_retried(self) -> None:
        quota_error = HTTPError(
            "https://provider.example/v1/chat/completions",
            400,
            "quota",
            {},
            BytesIO(b'{"error":{"code":"insufficient_user_quota"}}'),
        )
        programme = SimpleNamespace(
            programme_id="programme-1",
            programme_name="Data Science",
            degree_level="master",
            official_url="https://example.edu/programme",
        )
        source = ExtractionSource(
            url=programme.official_url,
            page_type="programme_overview",
            title="Data Science",
            text="Data Science programme.",
            content_hash="a" * 64,
        )
        config = SmokeConfig(run_name="test", institutions=())
        with tempfile.TemporaryDirectory() as temporary, patch.dict(
            os.environ,
            {
                "OPENAI_COMPATIBLE_API_KEY": "generic-key",
                "EXTRACTION_MAX_RETRIES": "4",
            },
            clear=False,
        ), patch(
            "glowbal_ingestion.deepseek.urlopen",
            side_effect=quota_error,
        ), patch("glowbal_ingestion.deepseek.time.sleep") as sleep:
            state = StateStore(Path(temporary) / "state.sqlite")
            try:
                client = DeepSeekClient(config, state)
                with self.assertRaises(DeepSeekError) as raised:
                    client._extract_group(
                        programme,
                        [source],
                        "identity_offering",
                        ("programme_status",),
                    )
            finally:
                state.close()
        self.assertEqual(
            raised.exception.code,
            ExtractionProviderErrorCode.PERMANENT_PROVIDER_ERROR,
        )
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(client.stats.logical_requests, 1)
        self.assertEqual(client.stats.request_attempts, 1)
        self.assertEqual(client.stats.retry_attempts, 0)
        sleep.assert_not_called()

    def test_legacy_error_remains_provider_neutral(self) -> None:
        error = DeepSeekError(
            "busy",
            code=ExtractionProviderErrorCode.RATE_LIMITED,
            retryable=True,
        )
        self.assertIsInstance(error, ExtractionProviderError)
        self.assertEqual(error.code, ExtractionProviderErrorCode.RATE_LIMITED)
        self.assertTrue(error.retryable)

    def test_legacy_adapter_exposes_only_generic_request_result_to_core(self) -> None:
        class LegacyClient:
            provider_id = "deepseek"
            configured = True

            def extract_fields(self, programme, sources, *, field_names, prefer_pro):
                self.received = (programme, sources, field_names, prefer_pro)
                return (
                    "deepseek-chat",
                    {
                        "programme_identity_match": True,
                        "facts": [
                            {
                                "field_name": "tuition",
                                "source_url": sources[0].url,
                                "evidence": "Tuition is 100.",
                                "value": {"amount": 100},
                            }
                        ],
                        "group_diagnostics": [{"status": "completed"}],
                    },
                )

        legacy = LegacyClient()
        provider = LegacyTupleExtractionProvider(legacy)
        source = ExtractionSource(
            url="https://example.edu/program",
            page_type="programme_overview",
            title=None,
            text="Tuition is 100.",
            content_hash="b" * 64,
            raw_document_id="00000000-0000-0000-0000-000000000001",
        )
        result = provider.extract(
            ExtractionRequest(
                entity_id="programme-1",
                field_names=("tuition",),
                sources=(source,),
                prompt_version="prompt/v1",
                schema_version="schema/v1",
                operation="fields",
                context={"programme": object()},
            )
        )
        self.assertEqual(result.provider_id, "deepseek")
        self.assertEqual(result.model_id, "deepseek-chat")
        self.assertTrue(result.identity_match)
        self.assertEqual(result.facts[0]["field_name"], "tuition")
        self.assertEqual(result.group_diagnostics[0]["status"], "completed")

    def test_core_modules_do_not_import_deepseek(self) -> None:
        source_root = Path(__file__).resolve().parents[1] / "src" / "glowbal_ingestion"
        for name in ("pipeline.py", "deterministic.py", "validation.py"):
            self.assertNotIn(
                "from .deepseek",
                (source_root / name).read_text(encoding="utf-8"),
                name,
            )
