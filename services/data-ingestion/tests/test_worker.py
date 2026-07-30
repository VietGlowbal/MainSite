"""
Tests for the programme ingestion worker.

Covers:
- Cache recheck avoids duplicate crawl (race guard)
- Job-to-institution resolution
- URL safety and approved-domain validation
- Bounded run (one institution, one programme URL)
- Non-retryable policy errors
- Outcome mapping (complete / needs_review / retry / failed)
"""

from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from glowbal_ingestion.supabase_import import SupabaseImportResult
from glowbal_ingestion.url_safety import ValidatedUrl
from glowbal_ingestion.worker import (
    ERR_INVALID_URL,
    ERR_UNAPPROVED_DOMAIN,
    ERR_UNIVERSITY_NOT_FOUND,
    NON_RETRYABLE_ERRORS,
    JobOutcome,
    WorkerSupabaseClient,
    _apply_outcome,
    _build_seed_from_university,
    _worker_credentials,
    _with_manual_url,
    process_one_job,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_UNI_ROW = {
    "id": 1,
    "name": "State University",
    "primary_domain": "stateuniversity.edu",
    "domain_candidates": [],
    "country_code": "US",
    "official_url": "https://stateuniversity.edu/",
    "domain_review_status": "approved",
    "crawl_seed_enabled": True,
}

VALID_JOB = {
    "id": "aaaaaaaa-0000-0000-0000-000000000001",
    "application_id": "bbbbbbbb-0000-0000-0000-000000000002",
    "user_id": "cccccccc-0000-0000-0000-000000000003",
    "submitted_url": "https://stateuniversity.edu/programmes/ms-cs",
    "canonical_url": "https://stateuniversity.edu/programmes/ms-cs",
    "university_id": 1,
    "institution_id": "supabase-1",
    "attempts": 1,
    "max_attempts": 3,
}

CACHE_HIT_PROGRAMME = {
    "programme_id": "dddddddd-0000-0000-0000-000000000004",
    "programme_name": "MS Computer Science",
    "degree_level": "master",
    "delivery_mode": "full-time",
    "official_url": "https://stateuniversity.edu/programmes/ms-cs",
    "verification_status": "RULE_VALIDATED",
    "run_id": "eeeeeeee-0000-0000-0000-000000000005",
    "crawl_run": {
        "id": "eeeeeeee-0000-0000-0000-000000000005",
        "status": "completed",
        "finished_at": "2026-07-01T00:00:00Z",
    },
}


def _mock_client(
    *,
    university_row=VALID_UNI_ROW,
    cache_result=None,
    claim_jobs=None,
):
    client = MagicMock(spec=WorkerSupabaseClient)
    client.get_university.return_value = university_row
    client.lookup_cache.return_value = cache_result
    client.claim_jobs.return_value = claim_jobs or []
    client.update_job.return_value = None
    client.update_application.return_value = None
    return client


# ---------------------------------------------------------------------------
# Tests: build_seed_from_university
# ---------------------------------------------------------------------------


class TestBuildSeedFromUniversity(unittest.TestCase):
    def test_valid_row_builds_seed(self):
        seed = _build_seed_from_university(VALID_UNI_ROW)
        self.assertIsNotNone(seed)
        self.assertEqual(seed.official_domain, "stateuniversity.edu")
        self.assertEqual(seed.country_code, "US")

    def test_missing_primary_domain_returns_none(self):
        row = {**VALID_UNI_ROW, "primary_domain": None}
        seed = _build_seed_from_university(row)
        self.assertIsNone(seed)


# ---------------------------------------------------------------------------
# Tests: URL safety validation
# ---------------------------------------------------------------------------


class TestUrlSafetyInWorker(unittest.TestCase):
    def test_private_ip_rejected(self):
        """Private IPs resolve to UNAPPROVED_DOMAIN (domain check runs before DNS)."""
        job = {
            **VALID_JOB,
            "submitted_url": "https://192.168.1.1/programme",
            "canonical_url": "https://192.168.1.1/programme",
        }
        client = _mock_client()
        outcome = process_one_job(
            job,
            client=client,
            output_root=Path("/tmp/test-worker"),
            env={},
            worker_id="test-worker",
        )
        self.assertEqual(outcome.status, "failed")
        # Private IP is rejected — either as invalid URL or unapproved domain
        self.assertIn(outcome.error_code, NON_RETRYABLE_ERRORS)

    def test_unapproved_domain_rejected(self):
        job = {
            **VALID_JOB,
            "submitted_url": "https://evil.com/programme",
            "canonical_url": "https://evil.com/programme",
        }
        client = _mock_client()
        outcome = process_one_job(
            job,
            client=client,
            output_root=Path("/tmp/test-worker"),
            env={},
            worker_id="test-worker",
        )
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.error_code, ERR_UNAPPROVED_DOMAIN)
        self.assertIn(outcome.error_code, NON_RETRYABLE_ERRORS)

    def test_unknown_university_returns_non_retryable_failure(self):
        job = {**VALID_JOB, "university_id": 9999}
        client = _mock_client(university_row=None)
        outcome = process_one_job(
            job,
            client=client,
            output_root=Path("/tmp/test-worker"),
            env={},
            worker_id="test-worker",
        )
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.error_code, ERR_UNIVERSITY_NOT_FOUND)
        self.assertIn(outcome.error_code, NON_RETRYABLE_ERRORS)


# ---------------------------------------------------------------------------
# Tests: cache recheck
# ---------------------------------------------------------------------------


class TestCacheRecheck(unittest.TestCase):
    def test_cache_hit_returns_without_crawl(self):
        """Cache hit at recheck should return complete without running pipeline."""
        # Use a URL that matches the university's approved domain so it passes
        # domain validation. Patch validate_url to skip real DNS lookup.
        job = {
            **VALID_JOB,
            "submitted_url": "https://stateuniversity.edu/programmes/ms-cs",
            "canonical_url": "https://stateuniversity.edu/programmes/ms-cs",
        }
        client = _mock_client(cache_result=CACHE_HIT_PROGRAMME)
        from glowbal_ingestion.url_safety import ValidatedUrl
        mock_validated = ValidatedUrl(
            original_url=job["submitted_url"],
            canonical_url=job["canonical_url"],
            hostname="stateuniversity.edu",
            resolved_ips=("1.2.3.4",),
        )
        with patch("glowbal_ingestion.worker.validate_url", return_value=mock_validated):
            outcome = process_one_job(
                job,
                client=client,
                output_root=Path("/tmp/test-worker"),
                env={},
                worker_id="test-worker",
            )
        self.assertEqual(outcome.status, "complete")
        self.assertTrue(outcome.cache_hit)
        self.assertEqual(outcome.result_programme_id, CACHE_HIT_PROGRAMME["programme_id"])
        self.assertEqual(outcome.result_run_id, CACHE_HIT_PROGRAMME["run_id"])


    def test_cache_miss_proceeds_to_pipeline(self):
        """Cache miss should attempt to run the pipeline (will fail without real env)."""
        client = _mock_client(cache_result=None)
        # Pipeline will raise without real config — expect retry outcome
        validated = ValidatedUrl(
            original_url=VALID_JOB["submitted_url"],
            canonical_url=VALID_JOB["canonical_url"],
            hostname="stateuniversity.edu",
            resolved_ips=("1.2.3.4",),
        )
        imported = SupabaseImportResult(
            run_key="job-run",
            run_id="run-1",
            applied=True,
            counts={},
        )
        programme = {
            "programme_id": "prog-1",
            "programme_name": "MS Computer Science",
            "degree_level": "master",
            "delivery_mode": "full-time",
        }
        with TemporaryDirectory() as temp_dir, patch(
            "glowbal_ingestion.worker.validate_url",
            return_value=validated,
        ), patch(
            "glowbal_ingestion.worker._run_pipeline_with_timeout"
        ) as run_pipeline, patch(
            "glowbal_ingestion.worker.import_supabase_run",
            return_value=imported,
        ) as importer, patch(
            "glowbal_ingestion.worker._resolve_programme",
            return_value=programme,
        ):
            outcome = process_one_job(
                VALID_JOB,
                client=client,
                output_root=Path(temp_dir),
                env={"SUPABASE_SERVICE_ROLE_KEY": "secret"},
                worker_id="test-worker",
                allow_unreviewed_terms=True,
            )
        self.assertEqual(outcome.status, "complete")
        self.assertFalse(outcome.cache_hit)
        self.assertEqual(
            outcome.application_fields["course_name"],
            "MS Computer Science",
        )
        config = run_pipeline.call_args.args[0]
        self.assertTrue(config.run_name.startswith("job-"))
        self.assertIsInstance(config.institutions, tuple)
        self.assertEqual(
            config.limits.max_deep_programmes_per_institution,
            1,
        )
        self.assertTrue(
            run_pipeline.call_args.kwargs["allow_unreviewed_terms"]
        )
        self.assertTrue(importer.call_args.kwargs["apply"])


# ---------------------------------------------------------------------------
# Tests: _with_manual_url
# ---------------------------------------------------------------------------


class TestWithManualUrl(unittest.TestCase):
    def test_adds_url_to_seed(self):
        seed = _build_seed_from_university(VALID_UNI_ROW)
        self.assertIsNotNone(seed)
        url = "https://stateuniversity.edu/programmes/ms-cs"
        updated = _with_manual_url(seed, url)
        self.assertIn(url, updated.manual_programme_urls)
        self.assertTrue(updated.manual_only)

    def test_no_duplicate_url(self):
        seed = _build_seed_from_university(VALID_UNI_ROW)
        url = "https://stateuniversity.edu/programmes/ms-cs"
        s1 = _with_manual_url(seed, url)
        s2 = _with_manual_url(s1, url)  # same URL again
        self.assertEqual(s2.manual_programme_urls.count(url), 1)


# ---------------------------------------------------------------------------
# Tests: _apply_outcome
# ---------------------------------------------------------------------------


class TestApplyOutcome(unittest.TestCase):
    def _make_client(self):
        client = MagicMock(spec=WorkerSupabaseClient)
        client.update_job.return_value = None
        client.update_application.return_value = None
        return client

    def test_complete_outcome_sets_100_percent(self):
        client = self._make_client()
        outcome = JobOutcome(
            status="complete",
            result_run_id="run-1",
            result_programme_id="prog-1",
            cache_hit=True,
        )
        _apply_outcome(client, VALID_JOB, outcome, max_attempts=3)
        job_call_kwargs = client.update_job.call_args[0][1]
        self.assertEqual(job_call_kwargs["status"], "complete")
        self.assertEqual(job_call_kwargs["progress_percentage"], 100)

    def test_retry_outcome_sets_next_attempt(self):
        client = self._make_client()
        outcome = JobOutcome(
            status="retry",
            error_code="FETCH_FAILED",
            error_message="timeout",
        )
        _apply_outcome(client, VALID_JOB, outcome, max_attempts=3)
        job_call_kwargs = client.update_job.call_args[0][1]
        self.assertEqual(job_call_kwargs["status"], "retry")
        self.assertIn("next_attempt_at", job_call_kwargs)

    def test_retry_at_max_attempts_becomes_failed(self):
        client = self._make_client()
        job = {**VALID_JOB, "attempts": 3, "max_attempts": 3}
        outcome = JobOutcome(
            status="retry",
            error_code="FETCH_FAILED",
            error_message="timeout",
        )
        _apply_outcome(client, job, outcome, max_attempts=3)
        job_fields = client.update_job.call_args[0][1]
        app_fields = client.update_application.call_args[0][1]
        self.assertEqual(job_fields["status"], "failed")
        self.assertEqual(app_fields["parse_status"], "failed")

    def test_complete_applies_identity_fields(self):
        client = self._make_client()
        outcome = JobOutcome(
            status="complete",
            result_run_id="run-1",
            result_programme_id="prog-1",
            application_fields={
                "course_name": "MS Computer Science",
                "degree_level": "master",
            },
        )
        _apply_outcome(client, VALID_JOB, outcome, max_attempts=3)
        app_fields = client.update_application.call_args[0][1]
        self.assertEqual(
            app_fields["course_name"],
            "MS Computer Science",
        )
        self.assertEqual(app_fields["degree_level"], "master")

    def test_failed_outcome_sets_completed_at(self):
        client = self._make_client()
        outcome = JobOutcome(
            status="failed",
            error_code=ERR_INVALID_URL,
            error_message="bad URL",
        )
        _apply_outcome(client, VALID_JOB, outcome, max_attempts=3)
        job_call_kwargs = client.update_job.call_args[0][1]
        self.assertEqual(job_call_kwargs["status"], "failed")
        self.assertIn("completed_at", job_call_kwargs)


# ---------------------------------------------------------------------------
# Tests: non-retryable error codes
# ---------------------------------------------------------------------------


class TestNonRetryableErrors(unittest.TestCase):
    def test_non_retryable_set_is_correct(self):
        expected = {
            ERR_INVALID_URL,
            ERR_UNAPPROVED_DOMAIN,
            ERR_UNIVERSITY_NOT_FOUND,
            "BLOCKED_BY_POLICY",
        }
        self.assertEqual(NON_RETRYABLE_ERRORS, expected)


class TestWorkerCredentials(unittest.TestCase):
    def test_service_role_is_required_for_writes(self):
        with self.assertRaisesRegex(ValueError, "SERVICE_ROLE"):
            _worker_credentials(
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_CRAWL_SEED_KEY": "read-only-key",
                }
            )

    def test_service_role_credentials_are_accepted(self):
        self.assertEqual(
            _worker_credentials(
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SERVICE_ROLE_KEY": "service-role",
                }
            ),
            ("https://example.supabase.co", "service-role"),
        )


if __name__ == "__main__":
    unittest.main()
