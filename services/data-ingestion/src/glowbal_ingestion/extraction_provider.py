"""Provider-neutral LLM extraction contracts and provider selection."""

from __future__ import annotations

import enum
import hashlib
import json
import os
from dataclasses import dataclass, field, replace
from typing import TYPE_CHECKING, Any, Callable, Protocol, runtime_checkable

from .models import SourceAuthority, SourceRelationship, TemporalState

if TYPE_CHECKING:
    from .config import SmokeConfig
    from .storage import StateStore


class ExtractionProviderErrorCode(str, enum.Enum):
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    RATE_LIMITED = "RATE_LIMITED"
    INVALID_PROVIDER_RESPONSE = "INVALID_PROVIDER_RESPONSE"
    CONTEXT_LIMIT = "CONTEXT_LIMIT"
    TRANSIENT_PROVIDER_ERROR = "TRANSIENT_PROVIDER_ERROR"
    PERMANENT_PROVIDER_ERROR = "PERMANENT_PROVIDER_ERROR"


class ExtractionProviderError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: ExtractionProviderErrorCode = (
            ExtractionProviderErrorCode.PERMANENT_PROVIDER_ERROR
        ),
        retryable: bool = False,
        retry_after_seconds: float | None = None,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds
        self.http_status = http_status


@dataclass(frozen=True)
class ExtractionSource:
    url: str
    page_type: str
    title: str | None
    text: str
    content_hash: str
    raw_document_id: str | None = None
    parser_id: str | None = None
    parser_version: str | None = None
    source_authority: SourceAuthority | None = None
    source_relationship: SourceRelationship | None = None
    temporal_state: TemporalState = TemporalState.UNKNOWN


@dataclass(frozen=True)
class ExtractionRequest:
    entity_id: str
    field_names: tuple[str, ...]
    sources: tuple[ExtractionSource, ...]
    prompt_version: str
    schema_version: str
    operation: str = "programme"
    context: dict[str, Any] = field(default_factory=dict)
    capabilities: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ExtractionResult:
    facts: tuple[dict[str, Any], ...]
    provider_id: str
    model_id: str
    request_fingerprint: str
    prompt_version: str
    schema_version: str
    usage: dict[str, int] = field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    identity_match: bool | None = None
    group_diagnostics: tuple[dict[str, Any], ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)


def extraction_request_fingerprint(
    *,
    entity_id: str | None = None,
    source_content_hashes: tuple[str, ...],
    field_names: tuple[str, ...],
    prompt_version: str,
    schema_version: str,
    provider_id: str,
    model_id: str,
    capabilities: dict[str, Any] | None = None,
) -> str:
    """Cache key material only; no ephemeral request/run identifiers."""
    payload = {
        "entity_id": entity_id,
        "source_content_hashes": list(source_content_hashes),
        "field_names": list(field_names),
        "prompt_version": prompt_version,
        "schema_version": schema_version,
        "provider_id": provider_id,
        "model_id": model_id,
        "capabilities": capabilities or {},
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


@runtime_checkable
class ExtractionProvider(Protocol):
    """Pipeline-facing provider surface; provider options stay in adapters."""

    provider_id: str

    @property
    def configured(self) -> bool: ...

    def extract(self, request: ExtractionRequest) -> ExtractionResult: ...


class UnavailableExtractionProvider:
    provider_id = "unconfigured"

    @property
    def configured(self) -> bool:
        return False

    @staticmethod
    def _raise() -> None:
        raise ExtractionProviderError(
            "No extraction provider is configured.",
            code=ExtractionProviderErrorCode.PROVIDER_UNAVAILABLE,
            retryable=False,
        )

    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        self._raise()


class OpenAICompatibleExtractionProvider:
    """Provider-neutral adapter for an OpenAI-compatible extraction client.

    The wrapped client owns prompt/schema details; the pipeline consumes only
    the generic request/result contract.  The legacy name remains an alias for
    callers and test doubles during the migration.
    """

    def __init__(self, legacy_client: Any) -> None:
        self.legacy_client = legacy_client
        self.provider_id = str(
            getattr(
                legacy_client,
                "extraction_provider_id",
                getattr(legacy_client, "provider_id", "openai_compatible"),
            )
        )

    @property
    def configured(self) -> bool:
        return bool(getattr(self.legacy_client, "configured", True))

    @property
    def stats(self) -> Any:
        return getattr(self.legacy_client, "stats", None)

    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        sources = list(request.sources)
        prefer_pro = bool(request.capabilities.get("prefer_pro", False))
        operation = request.operation
        try:
            if operation == "school_profile":
                model_id, payload = self.legacy_client.extract_school_profile(
                    institution_id=str(request.context["institution_id"]),
                    institution_name=str(request.context["institution_name"]),
                    sources=sources,
                    prefer_pro=prefer_pro,
                )
            else:
                programme = request.context["programme"]
                if operation == "fields":
                    model_id, payload = self.legacy_client.extract_fields(
                        programme,
                        sources,
                        field_names=request.field_names,
                        prefer_pro=prefer_pro,
                    )
                elif operation == "admission_package":
                    model_id, payload = (
                        self.legacy_client.extract_admission_package(
                            programme,
                            sources,
                            missing_fields=request.field_names,
                            prefer_pro=prefer_pro,
                        )
                    )
                elif operation == "programme":
                    model_id, payload = self.legacy_client.extract(
                        programme, sources, prefer_pro=prefer_pro
                    )
                else:
                    raise ExtractionProviderError(
                        f"Unsupported extraction operation: {operation}",
                        code=ExtractionProviderErrorCode.PERMANENT_PROVIDER_ERROR,
                    )
        except ExtractionProviderError:
            raise
        except Exception as exc:
            raise ExtractionProviderError(
                "Extraction provider failed.",
                code=ExtractionProviderErrorCode.TRANSIENT_PROVIDER_ERROR,
                retryable=True,
            ) from exc
        if not isinstance(payload, dict):
            raise ExtractionProviderError(
                "Extraction provider returned an invalid payload.",
                code=ExtractionProviderErrorCode.INVALID_PROVIDER_RESPONSE,
            )
        fingerprint = extraction_request_fingerprint(
            entity_id=request.entity_id,
            source_content_hashes=tuple(
                source.content_hash for source in request.sources
            ),
            field_names=request.field_names,
            prompt_version=request.prompt_version,
            schema_version=request.schema_version,
            provider_id=self.provider_id,
            model_id=str(model_id),
            capabilities={
                **request.capabilities,
                "operation": operation,
            },
        )
        facts = payload.get("facts") or []
        return ExtractionResult(
            facts=tuple(
                dict(fact) for fact in facts if isinstance(fact, dict)
            ),
            provider_id=self.provider_id,
            model_id=str(model_id),
            request_fingerprint=fingerprint,
            prompt_version=request.prompt_version,
            schema_version=request.schema_version,
            usage={},
            warnings=tuple(
                str(item) for item in (payload.get("warnings") or [])
            ),
            identity_match=(
                bool(payload["programme_identity_match"])
                if "programme_identity_match" in payload
                else None
            ),
            group_diagnostics=tuple(
                dict(item)
                for item in (payload.get("group_diagnostics") or [])
                if isinstance(item, dict)
            ),
            # Adapter-only compatibility detail. Core pipeline uses explicit
            # generic result fields above, never provider payload layout.
            metadata={},
        )


# Backward-compatible name for existing tests/callers.  New production code
# uses the provider-neutral class name above.
LegacyTupleExtractionProvider = OpenAICompatibleExtractionProvider


def create_extraction_provider(
    config: "SmokeConfig",
    state: "StateStore",
    progress: Callable[[str], None] | None = None,
) -> ExtractionProvider:
    """Choose an adapter without requiring credentials for deterministic work."""
    requested_provider = os.environ.get("EXTRACTION_PROVIDER", "").strip().lower()
    configured = requested_provider
    if configured in {"openai_compatible", "openai-compatible"}:
        configured = "deepseek"
    if not configured and (
        os.environ.get("DEEPSEEK_API_KEY", "").strip()
        or os.environ.get("EXTRACTION_API_KEY", "").strip()
        or os.environ.get("OPENAI_COMPATIBLE_API_KEY", "").strip()
    ):
        configured = "deepseek"
    if not configured:
        return UnavailableExtractionProvider()
    if configured == "deepseek":
        # The import is deliberately local: core orchestration has no direct
        # dependency on any provider implementation.
        from .deepseek import DeepSeekClient

        model = os.environ.get("EXTRACTION_MODEL", "").strip()
        if not model:
            model = (
                os.environ.get("DEEPSEEK_MODEL", "").strip()
                if requested_provider == "deepseek"
                else os.environ.get("OPENAI_COMPATIBLE_MODEL", "").strip()
            )
        if model:
            config = replace(
                config,
                deepseek_flash_model=model,
                deepseek_pro_model=model,
            )
        return OpenAICompatibleExtractionProvider(
            DeepSeekClient(config, state, progress)
        )
    return UnavailableExtractionProvider()
