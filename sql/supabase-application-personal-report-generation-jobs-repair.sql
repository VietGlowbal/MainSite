-- Durable queue follow-up migration.
-- Run after supabase-application-personal-report-generation-jobs.sql.

ALTER TABLE public.application_personal_report_generation_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_application_personal_report_generation_jobs_idempotency
  ON public.application_personal_report_generation_jobs(application_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
