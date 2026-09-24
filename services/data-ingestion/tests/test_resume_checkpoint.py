from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import pytest


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.config import InstitutionSeed, SmokeConfig  # noqa: E402
from glowbal_ingestion.cli import _parser  # noqa: E402
from glowbal_ingestion.pipeline import (  # noqa: E402
    CheckpointError,
    SmokePipeline,
    build_run_identity,
)
from glowbal_ingestion.storage import JsonlStore, RunPaths  # noqa: E402


def _config(*institution_ids: str) -> SmokeConfig:
    return SmokeConfig(
        run_name="resume-test",
        institutions=tuple(
            InstitutionSeed(
                institution_id=institution_id,
                name=institution_id,
                country_code="US",
                official_domain="example.edu",
                homepage_url="https://example.edu/",
                terms_status="APPROVED",
            )
            for institution_id in institution_ids
        ),
    )


def _pipeline(config: SmokeConfig, run_dir: Path, *, resume: bool = False) -> SmokePipeline:
    return SmokePipeline(
        config,
        run_dir,
        allow_unreviewed_terms=False,
        discovery_only=True,
        show_progress=False,
        resume=resume,
    )


def _close(pipeline: SmokePipeline) -> None:
    pipeline.state.close()
    pipeline.llm_state.close()


def test_resume_skips_completed_and_continues_interrupted_targets() -> None:
    config = _config("institution-a", "institution-b")
    with tempfile.TemporaryDirectory() as temporary:
        run_dir = Path(temporary) / "run"
        first = _pipeline(config, run_dir)
        try:
            first._set_checkpoint(config.institutions[0], "COMPLETED")
            first._set_checkpoint(
                config.institutions[1], "INTERRUPTED", error="controlled test stop"
            )
        finally:
            _close(first)

        resumed = _pipeline(config, run_dir, resume=True)
        try:
            pending = resumed._prepare_resume_targets()
            assert [seed.institution_id for seed in pending] == ["institution-b"]
            assert resumed._resume_skipped == ["institution-a"]
            assert resumed._resume_continued == ["institution-b"]
            resumed._process_institution = lambda _seed: None
            resumed._checkpointed_institution(config.institutions[1])
            assert resumed.state.get_value(
                "institution:institution-b:checkpoint"
            )["status"] == "COMPLETED"
            assert resumed.metrics.institutions_completed == 2
        finally:
            _close(resumed)


def test_retryable_provider_failure_remains_resumable() -> None:
    config = _config("institution-a")
    with tempfile.TemporaryDirectory() as temporary:
        run_dir = Path(temporary) / "run"
        first = _pipeline(config, run_dir)
        try:
            first._process_institution = lambda _seed: first._emit_error(
                institution_id="institution-a",
                url="https://example.edu/provider.json",
                stage="source_ecosystem_fetch",
                code="RAW_PERSIST_FAILED",
                message="transient durable write failure",
                retryable=True,
            )
            first._checkpointed_institution(config.institutions[0])
            assert first.state.get_value(
                "institution:institution-a:checkpoint"
            )["status"] == "PARTIAL"
            assert first._run_had_failures is True
        finally:
            _close(first)

        resumed = _pipeline(config, run_dir, resume=True)
        try:
            pending = resumed._prepare_resume_targets()
            assert [seed.institution_id for seed in pending] == ["institution-a"]
            assert resumed._resume_skipped == []
            assert resumed._resume_continued == ["institution-a"]
        finally:
            _close(resumed)


def test_resume_rejects_changed_configuration() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        run_dir = Path(temporary) / "run"
        first = _pipeline(_config("institution-a"), run_dir)
        _close(first)
        changed = _config("institution-a", "institution-b")
        with pytest.raises(CheckpointError, match="identity does not match"):
            _pipeline(changed, run_dir, resume=True)


def test_resume_identity_fingerprint_is_deterministic_and_secret_free() -> None:
    config = _config("institution-a")
    first = build_run_identity(
        config,
        "run-1",
        allow_unreviewed_terms=False,
        discovery_only=True,
        discovery_backend="native",
        render_policy="off",
        target_fields=None,
        skip_school_profile=False,
    )
    second = build_run_identity(
        config,
        "run-1",
        allow_unreviewed_terms=False,
        discovery_only=True,
        discovery_backend="native",
        render_policy="off",
        target_fields=None,
        skip_school_profile=False,
    )
    assert first == second
    assert "DEEPSEEK_API_KEY" not in json.dumps(first)


def test_effective_stream_append_is_idempotent_but_audit_stream_remains_append_only() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        paths = RunPaths.create(Path(temporary) / "run")
        store = JsonlStore(paths)
        row = {"assertion_id": "assertion-1", "field_name": "tuition"}
        store.append("effective_field_assertions", row)
        store.append("effective_field_assertions", dict(row))
        assert len(
            paths.jsonl_path("effective_field_assertions")
            .read_text(encoding="utf-8")
            .splitlines()
        ) == 1
        store.append("extraction_events", {"event_id": "same"})
        store.append("extraction_events", {"event_id": "same"})
        assert len(
            paths.jsonl_path("extraction_events")
            .read_text(encoding="utf-8")
            .splitlines()
        ) == 2


def test_studyinfo_final_binding_uses_current_valintaperuste_relationship() -> None:
    config_path = (
        SERVICE_ROOT.parent.parent
        / "docs"
        / "architecture"
        / "data"
        / "external-field-canary-20260914"
        / "final-config.json"
    )
    if not config_path.exists():
        pytest.skip("final canary config has not been derived yet")
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    aalto = next(
        row for row in raw["institutions"] if row["institution_id"] == "aalto-fi-canary"
    )
    identifiers = aalto["provider_programme_identifiers"][
        "b229397b-3e7e-53c6-a7a0-ff3288e177c9"
    ]
    assert identifiers["studyinfo_hakukohde"]["oid"].endswith("91188")
    assert identifiers["studyinfo_valintaperuste"]["id"] == (
        "34db13a9-3733-434c-a323-67c130ae0f1f"
    )
    assert all("70512" not in url for url in aalto["manual_programme_urls"])
    # The live route derives a different runtime programme UUID than the
    # frozen manifest's historical route.  The derived config must expose the
    # same current provider identifiers under both keys so resume/matching can
    # retain the frozen population identity without losing the live binding.
    runtime_id = "c695f7f2-0ce1-5caa-9600-cf5fc759a332"
    assert runtime_id in aalto["provider_programme_identifiers"]
    assert aalto["provider_programme_identifiers"][runtime_id][
        "studyinfo_hakukohde"
    ]["oid"].endswith("91188")


def test_cli_exposes_resume_continuation_path() -> None:
    args = _parser().parse_args(["run", "--resume", "run-20260915"])
    assert args.resume == "run-20260915"
