"""
Programme Ingestion Worker
==========================

Polls the `programme_ingestion_jobs` Supabase table and processes each claimed
job by running the ingestion pipeline on the supplied programme URL.

Design:
- Runs as a standalone process: ``python -m glowbal_ingestion process-jobs``
- Claims jobs atomically via the ``claim_programme_ingestion_jobs`` RPC
- One institution per job, one programme URL
- Rechecks crawl cache before crawling to avoid races
- Deterministic extraction first, DeepSeek only for missing fields
- Bounded: max sources, redirects, tokens, run time, retries
- Updates job + application state after each outcome
- Non-retryable security/policy failures are not retried
"""

from __future__ import annotations

import logging
import multiprocessing
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlencode, urlsplit
from urllib.request import Request

from .config import CrawlLimits, InstitutionSeed, SmokeConfig, load_dotenv_if_present
from .pipeline import SmokePipeline
from .supabase_import import (
    SupabaseImportError,
    SupabaseRestClient,
    import_supabase_run,
)
from .supabase_seeds import _api_headers, _seed_from_row
from .url_safety import UnsafeUrlError, canonicalize_url, hostname_matches, validate_url


log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Error codes (machine-readable, never expose internals to users)
# ---------------------------------------------------------------------------
ERR_INVALID_URL = "INVALID_URL"
ERR_UNAPPROVED_DOMAIN = "UNAPPROVED_DOMAIN"
ERR_UNIVERSITY_NOT_FOUND = "UNIVERSITY_NOT_FOUND"
ERR_BLOCKED_BY_POLICY = "BLOCKED_BY_POLICY"
ERR_FETCH_FAILED = "FETCH_FAILED"
ERR_PARSE_FAILED = "PARSE_FAILED"
ERR_DEEPSEEK_FAILED = "DEEPSEEK_FAILED"
ERR_IMPORT_FAILED = "IMPORT_FAILED"
ERR_RESULT_NOT_FOUND = "RESULT_NOT_FOUND"
ERR_TIMEOUT = "TIMEOUT"
ERR_INTERNAL = "INTERNAL_ERROR"

# Non-retryable codes — policy/security failures must not be retried
NON_RETRYABLE_ERRORS = frozenset(
    {
        ERR_INVALID_URL,
        ERR_UNAPPROVED_DOMAIN,
        ERR_UNIVERSITY_NOT_FOUND,
        ERR_BLOCKED_BY_POLICY,
    }
)

MAX_RESPONSE_BYTES = 2 * 1024 * 1024


# ---------------------------------------------------------------------------
# Supabase REST helpers (minimal, stdlib-only)
# ---------------------------------------------------------------------------

class WorkerSupabaseClient(SupabaseRestClient):
    """Thin wrapper that adds job-specific RPC and update helpers."""

    def claim_jobs(self, worker_id: str, batch_size: int = 1) -> list[dict]:
        """Call claim_programme_ingestion_jobs RPC."""
        endpoint = f"{self.base_url}/rest/v1/rpc/claim_programme_ingestion_jobs"
        payload = {"p_worker_id": worker_id, "p_batch_size": batch_size}
        return self._rpc_post(endpoint, payload)

    def update_job(self, job_id: str, fields: dict[str, Any]) -> None:
        """PATCH a single programme_ingestion_jobs row."""
        endpoint = (
            f"{self.base_url}/rest/v1/programme_ingestion_jobs"
            f"?id=eq.{job_id}"
        )
        self._patch(endpoint, fields)

    def update_application(self, application_id: str, fields: dict[str, Any]) -> None:
        """PATCH a single course_applications row."""
        endpoint = (
            f"{self.base_url}/rest/v1/course_applications"
            f"?id=eq.{application_id}"
        )
        self._patch(endpoint, fields)

    def get_university(self, university_id: int) -> dict | None:
        """Fetch a single university row that is approved for crawling."""
        params = urlencode(
            [
                (
                    "select",
                    "id,name,primary_domain,domain_candidates,country_code,"
                    "official_url,domain_review_status,crawl_seed_enabled",
                ),
                ("id", f"eq.{university_id}"),
                ("domain_review_status", "eq.approved"),
                ("crawl_seed_enabled", "eq.true"),
                ("primary_domain", "not.is.null"),
                ("limit", "1"),
            ]
        )
        endpoint = f"{self.base_url}/rest/v1/universities?{params}"
        rows = self._get(endpoint)
        return rows[0] if rows else None

    def lookup_cache(self, canonical_url: str, submitted_url: str) -> dict | None:
        """Search crawl_programmes for an existing completed-run match."""
        candidates: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for url in dict.fromkeys([canonical_url, submitted_url]):
            params = urlencode(
                [
                    (
                        "select",
                        "programme_id,programme_name,degree_level,delivery_mode,"
                        "official_url,verification_status,run_id",
                    ),
                    ("official_url", f"eq.{url}"),
                    ("verification_status", "neq.REJECTED"),
                    ("limit", "20"),
                ]
            )
            endpoint = f"{self.base_url}/rest/v1/crawl_programmes?{params}"
            rows = self._get(endpoint)
            for row in rows:
                key = (str(row.get("run_id")), str(row.get("programme_id")))
                if key in seen:
                    continue
                seen.add(key)
                run = self._get_run(row["run_id"])
                if run and run.get("status") in ("completed", "approved"):
                    candidates.append({**row, "crawl_run": run})
        if not candidates:
            return None

        run_rank = {"approved": 2, "completed": 1}
        verification_rank = {
            "HUMAN_VERIFIED": 3,
            "RULE_VALIDATED": 2,
            "AI_EXTRACTED": 1,
            "FETCHED": 0,
            "DISCOVERED": 0,
            "NEEDS_REVIEW": -1,
        }
        candidates.sort(
            key=lambda row: (
                run_rank.get(str(row["crawl_run"].get("status")), 0),
                str(
                    row["crawl_run"].get("finished_at")
                    or row["crawl_run"].get("imported_at")
                    or ""
                ),
                verification_rank.get(
                    str(row.get("verification_status")), -1
                ),
            ),
            reverse=True,
        )
        return candidates[0]

    def _get_run(self, run_id: str) -> dict | None:
        params = urlencode(
            [("select", "id,status,finished_at,imported_at"), ("id", f"eq.{run_id}"), ("limit", "1")]
        )
        endpoint = f"{self.base_url}/rest/v1/crawl_runs?{params}"
        rows = self._get(endpoint)
        return rows[0] if rows else None

    def _get(self, endpoint: str) -> list[dict]:
        req = Request(endpoint, headers=_api_headers(self.api_key))
        with self.opener(req, timeout=20) as resp:
            data = resp.read(MAX_RESPONSE_BYTES)
        import json
        return json.loads(data.decode("utf-8"))

    def _patch(self, endpoint: str, payload: dict) -> None:
        import json
        body = json.dumps(payload).encode()
        req = Request(
            endpoint,
            data=body,
            headers={
                **_api_headers(self.api_key),
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="PATCH",
        )
        with self.opener(req, timeout=20):
            pass

    def _rpc_post(self, endpoint: str, payload: dict) -> list[dict]:
        import json
        body = json.dumps(payload).encode()
        req = Request(
            endpoint,
            data=body,
            headers={
                **_api_headers(self.api_key),
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with self.opener(req, timeout=20) as resp:
            data = resp.read(MAX_RESPONSE_BYTES)
        return json.loads(data.decode("utf-8")) or []


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

@dataclass
class JobOutcome:
    status: str  # 'complete' | 'needs_review' | 'retry' | 'failed'
    error_code: str | None = None
    error_message: str | None = None
    result_run_id: str | None = None
    result_programme_id: str | None = None
    cache_hit: bool = False
    application_fields: dict[str, Any] = field(default_factory=dict)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _worker_credentials(environ: Mapping[str, str]) -> tuple[str, str]:
    """Require write-capable credentials for queue and crawl-table updates."""
    base_url = (
        environ.get("SUPABASE_URL")
        or environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip().rstrip("/")
    api_key = (environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    parsed = urlsplit(base_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(
            "Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL to an HTTPS URL."
        )
    if not api_key:
        raise ValueError(
            "Set SUPABASE_SERVICE_ROLE_KEY; the ingestion worker requires "
            "write access."
        )
    return base_url, api_key


def _pipeline_child(
    config: SmokeConfig,
    run_output_dir: Path,
    allow_unreviewed_terms: bool,
    result_queue: Any,
) -> None:
    """Run one bounded pipeline in a child process."""
    try:
        pipeline = SmokePipeline(
            config,
            run_output_dir,
            allow_unreviewed_terms=allow_unreviewed_terms,
            discovery_only=False,
            show_progress=False,
            discovery_backend="native",
            render_policy="off",
            skip_school_profile=True,
        )
        pipeline.run()
        result_queue.put(None)
    except BaseException as exc:  # noqa: BLE001
        result_queue.put((type(exc).__name__, str(exc)[:500]))


def _run_pipeline_with_timeout(
    config: SmokeConfig,
    run_output_dir: Path,
    *,
    allow_unreviewed_terms: bool,
    timeout_seconds: float,
) -> None:
    """Run the pipeline with a real, terminating wall-clock timeout."""
    context = multiprocessing.get_context("spawn")
    result_queue = context.Queue(maxsize=1)
    process = context.Process(
        target=_pipeline_child,
        args=(
            config,
            run_output_dir,
            allow_unreviewed_terms,
            result_queue,
        ),
        daemon=False,
    )
    process.start()
    process.join(timeout=max(1.0, timeout_seconds))
    if process.is_alive():
        process.terminate()
        process.join(timeout=10)
        raise TimeoutError("Pipeline run timed out.")
    child_error = result_queue.get() if not result_queue.empty() else None
    result_queue.close()
    if child_error:
        error_name, message = child_error
        raise RuntimeError(f"{error_name}: {message}")
    if process.exitcode != 0:
        raise RuntimeError(
            f"Pipeline child process exited with code {process.exitcode}."
        )


def _build_seed_from_university(row: dict) -> InstitutionSeed | None:
    """Convert a universities table row into an InstitutionSeed."""
    return _seed_from_row(
        {
            "id": row.get("id"),
            "name": row.get("name"),
            "country_code": row.get("country_code", "US"),
            "primary_domain": row.get("primary_domain"),
            "official_url": row.get("official_url"),
            "domain_candidates": row.get("domain_candidates") or [],
        }
    )


def process_one_job(
    job: dict,
    *,
    client: WorkerSupabaseClient,
    output_root: Path,
    env: Mapping[str, str],
    worker_id: str,
    run_timeout_seconds: float = 600.0,
    allow_unreviewed_terms: bool = False,
) -> JobOutcome:
    """
    Process a single claimed programme ingestion job end-to-end.

    Steps:
      1. Validate the submitted URL using url_safety (SSRF, domain, DNS)
      2. Resolve institution seed from university_id
      3. Recheck crawl cache (race condition guard)
      4. Run pipeline (manual-only, one programme URL)
      5. Import delta run into Supabase staging
      6. Resolve output programme_id
      7. Return outcome
    """
    job_id = job["id"]
    application_id = job["application_id"]
    submitted_url = job["submitted_url"]
    canonical_url = job.get("canonical_url") or submitted_url
    university_id = job.get("university_id")

    # ---- Stage: policy_check ------------------------------------------
    _update_stage(client, job_id, application_id, "policy_check", 10)

    # 1. Validate URL using Python url_safety
    try:
        canonical_url = canonicalize_url(submitted_url)
    except UnsafeUrlError as exc:
        return JobOutcome(
            status="failed",
            error_code=ERR_INVALID_URL,
            error_message=str(exc),
        )
    if urlsplit(canonical_url).scheme != "https":
        return JobOutcome(
            status="failed",
            error_code=ERR_INVALID_URL,
            error_message="Programme URL must use HTTPS.",
        )

    # 2. Resolve institution seed
    _update_stage(client, job_id, application_id, "policy_check", 15)
    seed: InstitutionSeed | None = None

    if university_id:
        uni_row = client.get_university(int(university_id))
        if not uni_row:
            return JobOutcome(
                status="failed",
                error_code=ERR_UNIVERSITY_NOT_FOUND,
                error_message=f"University {university_id} not found or not approved.",
            )
        seed = _build_seed_from_university(uni_row)
        if not seed:
            return JobOutcome(
                status="failed",
                error_code=ERR_UNAPPROVED_DOMAIN,
                error_message=f"University {university_id} has no approved primary_domain.",
            )

        # Validate URL domain against approved institution domains
        allowed = (seed.official_domain,) + seed.allowed_domains
        try:
            validate_url(submitted_url, allowed_domains=allowed)
        except UnsafeUrlError as exc:
            return JobOutcome(
                status="failed",
                error_code=ERR_UNAPPROVED_DOMAIN,
                error_message=str(exc),
            )

    # 3. Cache recheck (race guard)
    _update_stage(client, job_id, application_id, "cache_lookup", 20)
    existing = client.lookup_cache(canonical_url, submitted_url)
    if existing:
        run_id = existing["crawl_run"]["id"]
        programme_id = existing["programme_id"]
        return JobOutcome(
            status="complete",
            result_run_id=run_id,
            result_programme_id=programme_id,
            cache_hit=True,
            application_fields=_programme_application_fields(existing),
        )

    if seed is None:
        # Can't crawl without an approved institution seed
        return JobOutcome(
            status="needs_review",
            error_code=ERR_UNIVERSITY_NOT_FOUND,
            error_message="No approved institution seed found. Cannot crawl without a known university.",
        )

    # 4. Run pipeline (manual-only, one programme URL)
    _update_stage(client, job_id, application_id, "fetching", 30)

    run_key = f"job-{job_id[:8]}-{_now_iso().replace(':', '').replace('-', '')[:15]}"
    run_output_dir = output_root / run_key
    run_output_dir.mkdir(parents=True, exist_ok=True)

    # Build a minimal SmokeConfig for one institution + one URL
    config = SmokeConfig(
        run_name=run_key,
        institutions=(
            _with_manual_url(seed, canonical_url),
        ),
        limits=CrawlLimits(
            max_deep_programmes_per_institution=1,
            max_deep_sources_per_programme=8,
            max_llm_retries=2,
        ),
    )

    try:
        _update_stage(client, job_id, application_id, "extracting_deterministic", 40)
        _run_pipeline_with_timeout(
            config,
            run_output_dir,
            allow_unreviewed_terms=allow_unreviewed_terms,
            timeout_seconds=run_timeout_seconds,
        )
    except TimeoutError:
        return JobOutcome(
            status="retry",
            error_code=ERR_TIMEOUT,
            error_message="Pipeline run timed out.",
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("Pipeline run failed for job %s", job_id)
        safe_msg = type(exc).__name__  # Do not expose raw traceback to user
        return JobOutcome(
            status="retry",
            error_code=ERR_PARSE_FAILED,
            error_message=safe_msg,
        )

    # 5. Import delta run into Supabase staging
    _update_stage(client, job_id, application_id, "persisting", 80)
    try:
        write_env = dict(env)
        # The shared seed loader permits a read-only crawl seed key, but this
        # code path writes crawl staging tables and must use service role.
        write_env.pop("SUPABASE_CRAWL_SEED_KEY", None)
        result = import_supabase_run(
            run_output_dir,
            apply=True,
            environ=write_env,
        )
    except SupabaseImportError as exc:
        log.error("Import failed for job %s: %s", job_id, exc)
        return JobOutcome(
            status="retry",
            error_code=ERR_IMPORT_FAILED,
            error_message=type(exc).__name__,
        )

    if not result.applied or not result.run_id:
        return JobOutcome(
            status="retry",
            error_code=ERR_IMPORT_FAILED,
            error_message="Import returned without a run_id.",
        )

    # 6. Resolve output programme_id from crawl_programmes
    _update_stage(client, job_id, application_id, "validating", 90)
    programme = _resolve_programme(client, result.run_id, submitted_url, canonical_url)
    if not programme:
        return JobOutcome(
            status="needs_review",
            error_code=ERR_RESULT_NOT_FOUND,
            error_message="Run imported but no programme matched the submitted URL.",
            result_run_id=result.run_id,
        )

    return JobOutcome(
        status="complete",
        result_run_id=result.run_id,
        result_programme_id=programme["programme_id"],
        cache_hit=False,
        application_fields=_programme_application_fields(programme),
    )


def _programme_application_fields(programme: Mapping[str, Any]) -> dict[str, Any]:
    """Select low-risk identity fields suitable for the application card."""
    mapping = {
        "programme_name": "course_name",
        "degree_level": "degree_level",
        "delivery_mode": "study_mode",
    }
    return {
        target: programme[source]
        for source, target in mapping.items()
        if programme.get(source)
    }


def _resolve_programme(
    client: WorkerSupabaseClient,
    run_id: str,
    submitted_url: str,
    canonical_url: str,
) -> dict | None:
    """Find the crawl_programmes row for the submitted URL in the new run."""
    for url in dict.fromkeys([canonical_url, submitted_url]):
        params = urlencode(
            [
                (
                    "select",
                    "programme_id,programme_name,degree_level,delivery_mode",
                ),
                ("run_id", f"eq.{run_id}"),
                ("official_url", f"eq.{url}"),
                ("verification_status", "neq.REJECTED"),
                ("limit", "1"),
            ]
        )
        endpoint = f"{client.base_url}/rest/v1/crawl_programmes?{params}"
        rows = client._get(endpoint)
        if rows:
            return rows[0]
    # The official page may redirect to a different canonical URL. This run is
    # bounded to one manual programme, so accept a single deep-selected result.
    params = urlencode(
        [
            (
                "select",
                "programme_id,programme_name,degree_level,delivery_mode",
            ),
            ("run_id", f"eq.{run_id}"),
            ("is_deep_selected", "eq.true"),
            ("verification_status", "neq.REJECTED"),
            ("limit", "2"),
        ]
    )
    endpoint = f"{client.base_url}/rest/v1/crawl_programmes?{params}"
    rows = client._get(endpoint)
    if len(rows) == 1:
        return rows[0]
    return None


def _update_stage(
    client: WorkerSupabaseClient,
    job_id: str,
    application_id: str,
    stage: str,
    progress: int,
) -> None:
    now = _now_iso()
    try:
        client.update_job(
            job_id,
            {"stage": stage, "progress_percentage": progress, "updated_at": now},
        )
        client.update_application(
            application_id,
            {"progress_percentage": progress, "updated_at": now},
        )
    except Exception:  # noqa: BLE001
        log.debug("Stage update failed (non-critical): %s / %s", stage, job_id)


def _with_manual_url(seed: InstitutionSeed, url: str) -> InstitutionSeed:
    """Return a copy of seed with the submitted URL added to manual_programme_urls."""
    from dataclasses import replace as dc_replace
    existing = list(seed.manual_programme_urls)
    if url not in existing:
        existing.append(url)
    return dc_replace(
        seed,
        manual_programme_urls=tuple(existing),
        manual_only=True,
    )


def _apply_outcome(
    client: WorkerSupabaseClient,
    job: dict,
    outcome: JobOutcome,
    *,
    max_attempts: int,
) -> None:
    """Persist the outcome to programme_ingestion_jobs and course_applications."""
    now = _now_iso()
    job_id = job["id"]
    application_id = job["application_id"]
    attempts = job.get("attempts", 1)

    job_fields: dict[str, Any] = {
        "status": outcome.status,
        "stage": outcome.status,
        "error_code": outcome.error_code,
        "error_message": outcome.error_message,
        "cache_hit": outcome.cache_hit,
        "result_run_id": outcome.result_run_id,
        "result_programme_id": outcome.result_programme_id,
        "locked_at": None,
        "locked_by": None,
        "updated_at": now,
    }

    app_fields: dict[str, Any] = {"updated_at": now}

    if outcome.status == "complete":
        job_fields.update({"progress_percentage": 100, "completed_at": now})
        app_fields.update(
            {
                "parse_status": "complete",
                "progress_percentage": 100,
                "import_status": "complete",
            }
        )
        if outcome.result_run_id:
            app_fields["crawl_run_id"] = outcome.result_run_id
        if outcome.result_programme_id:
            app_fields["crawl_programme_id"] = outcome.result_programme_id
        app_fields["ingestion_job_id"] = job_id
        app_fields.update(outcome.application_fields)

    elif outcome.status == "needs_review":
        job_fields.update({"progress_percentage": 100, "completed_at": now})
        app_fields.update({"parse_status": "needs_review", "progress_percentage": 100})

    elif outcome.status == "retry":
        if attempts >= max_attempts:
            job_fields.update(
                {
                    "status": "failed",
                    "stage": "failed",
                    "progress_percentage": 100,
                    "completed_at": now,
                }
            )
            app_fields.update(
                {"parse_status": "failed", "progress_percentage": 100}
            )
        else:
            # Exponential backoff: attempts^2 * 5 min
            delay_seconds = (attempts ** 2) * 5 * 60
            next_attempt = datetime.fromtimestamp(
                time.time() + delay_seconds, tz=timezone.utc
            ).isoformat()
            job_fields.update(
                {
                    "status": "retry",
                    "stage": None,
                    "next_attempt_at": next_attempt,
                    "progress_percentage": 0,
                }
            )
            app_fields.update(
                {"parse_status": "pending", "progress_percentage": 0}
            )

    else:  # failed
        job_fields.update({"progress_percentage": 100, "completed_at": now})
        app_fields.update({"parse_status": "failed", "progress_percentage": 100})

    try:
        client.update_application(application_id, app_fields)
    except Exception:  # noqa: BLE001
        log.exception("Failed to update application %s", application_id)
        # Leave the job in processing. Its lease will expire and the next
        # worker can recheck cache and repair the application link.
        return

    try:
        client.update_job(job_id, job_fields)
    except Exception:  # noqa: BLE001
        log.exception("Failed to update job %s after outcome %s", job_id, outcome.status)


# ---------------------------------------------------------------------------
# Main worker loop (called from CLI)
# ---------------------------------------------------------------------------

def run_worker(
    *,
    worker_id: str | None = None,
    batch_size: int = 1,
    poll_interval_seconds: float = 10.0,
    max_iterations: int | None = None,
    output_root: Path,
    env_file: Path | None = None,
    run_timeout_seconds: float = 600.0,
    allow_unreviewed_terms: bool = False,
) -> None:
    """
    Main worker loop. Polls for jobs and processes them one at a time.

    Parameters
    ----------
    worker_id:
        Stable identifier for this worker instance (defaults to a UUID).
    batch_size:
        Number of jobs to claim per poll cycle. Keep at 1 for simplicity.
    poll_interval_seconds:
        Seconds to wait between polls when the queue is empty.
    max_iterations:
        Stop after this many polls (useful for testing; None = run forever).
    output_root:
        Directory where temporary run output is written (gitignored).
    env_file:
        Path to .env file with Supabase and DeepSeek credentials.
    run_timeout_seconds:
        Hard timeout per job pipeline run.
    """
    if batch_size < 1 or batch_size > 10:
        raise ValueError("batch_size must be between 1 and 10.")
    if poll_interval_seconds < 0:
        raise ValueError("poll_interval_seconds cannot be negative.")
    if max_iterations is not None and max_iterations < 1:
        raise ValueError("max_iterations must be at least 1.")
    if run_timeout_seconds < 1:
        raise ValueError("run_timeout_seconds must be at least 1.")

    if env_file and env_file.exists():
        load_dotenv_if_present(env_file, override=True)

    env: Mapping[str, str] = os.environ
    base_url, api_key = _worker_credentials(env)
    client = WorkerSupabaseClient(base_url, api_key)

    wid = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
    log.info("Programme ingestion worker started: %s", wid)

    output_root.mkdir(parents=True, exist_ok=True)
    iterations = 0

    while True:
        if max_iterations is not None and iterations >= max_iterations:
            log.info("Reached max_iterations=%d, stopping.", max_iterations)
            break

        iterations += 1

        try:
            jobs = client.claim_jobs(wid, batch_size)
        except Exception:  # noqa: BLE001
            log.exception("Failed to claim jobs, retrying in %ss", poll_interval_seconds)
            time.sleep(poll_interval_seconds)
            continue

        if not jobs:
            if max_iterations is not None and iterations >= max_iterations:
                log.info("No jobs available; one-shot worker is complete.")
                break
            log.debug("No jobs available, sleeping %ss", poll_interval_seconds)
            time.sleep(poll_interval_seconds)
            continue

        for job in jobs:
            job_id = job.get("id", "?")
            log.info("Processing job %s url=%s", job_id, job.get("submitted_url", "?"))

            try:
                outcome = process_one_job(
                    job,
                    client=client,
                    output_root=output_root,
                    env=env,
                    worker_id=wid,
                    run_timeout_seconds=run_timeout_seconds,
                    allow_unreviewed_terms=allow_unreviewed_terms,
                )
            except Exception:  # noqa: BLE001
                log.exception("Unhandled error in job %s", job_id)
                outcome = JobOutcome(
                    status="retry",
                    error_code=ERR_INTERNAL,
                    error_message="Unhandled internal error.",
                )

            _apply_outcome(
                client,
                job,
                outcome,
                max_attempts=job.get("max_attempts", 3),
            )
            log.info(
                "Job %s → %s (cache_hit=%s, run=%s, programme=%s)",
                job_id,
                outcome.status,
                outcome.cache_hit,
                outcome.result_run_id,
                outcome.result_programme_id,
            )
