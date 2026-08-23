-- Planner Ops layer. Apply AFTER:
--   1) supabase-core3-plan-hierarchy.sql
--   2) supabase-canonical-planner-production.sql
-- This migration adds operational metadata only; it does not alter Core 1-4
-- facts, execution fields, or legacy recommendation rows.

CREATE TABLE IF NOT EXISTS public.application_planner_ops (
  application_id UUID PRIMARY KEY REFERENCES public.course_applications(id) ON DELETE CASCADE,
  lifecycle TEXT NOT NULL DEFAULT 'initializing' CHECK (lifecycle IN ('initializing','ready','waiting_for_input','stale','refreshing','complete','failed')),
  source_fingerprint TEXT,
  plan_fingerprint TEXT,
  stale_since TIMESTAMPTZ,
  generation_status TEXT NOT NULL DEFAULT 'idle' CHECK (generation_status IN ('idle','running','success','failed')),
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('source_unavailable','not_enough_data','ai_enrichment_failed','validation_failed','persistence_failed','migration_unavailable','concurrency_conflict','unknown')),
  ai_status TEXT CHECK (ai_status IS NULL OR ai_status IN ('success','fallback','failed','not_required')),
  ai_provider TEXT,
  ai_model TEXT,
  ai_prompt_version TEXT,
  ai_enrichment_version TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.application_planner_generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.application_plans(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('initial_create','semantic_input','source_change','manual_refresh','retry')),
  source_fingerprint TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  ai_status TEXT CHECK (ai_status IS NULL OR ai_status IN ('success','fallback','failed','not_required')),
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  enrichment_version TEXT,
  failure_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS planner_ops_one_running_run
  ON public.application_planner_generation_runs(application_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS planner_ops_runs_application_created
  ON public.application_planner_generation_runs(application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.application_planner_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.application_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('plan','micro_step')),
  target_id UUID,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  reason TEXT CHECK (reason IS NULL OR reason IN ('not_relevant','already_done','too_generic','incorrect','too_easy','too_hard','not_actionable','other')),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_feedback_target_shape CHECK ((target_type = 'plan' AND target_id IS NULL) OR (target_type = 'micro_step' AND target_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS planner_feedback_one_per_target
  ON public.application_planner_feedback(user_id, application_id, plan_id, target_type, COALESCE(target_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.application_planner_ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_planner_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_planner_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Planner Ops" ON public.application_planner_ops;
CREATE POLICY "Users can view own Planner Ops" ON public.application_planner_ops FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.course_applications a WHERE a.id = application_planner_ops.application_id AND a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can view own Planner runs" ON public.application_planner_generation_runs;
CREATE POLICY "Users can view own Planner runs" ON public.application_planner_generation_runs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.course_applications a WHERE a.id = application_planner_generation_runs.application_id AND a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can view own Planner feedback" ON public.application_planner_feedback;
CREATE POLICY "Users can view own Planner feedback" ON public.application_planner_feedback FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can submit own Planner feedback" ON public.application_planner_feedback;
CREATE POLICY "Users can submit own Planner feedback" ON public.application_planner_feedback FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.course_applications a WHERE a.id = application_planner_feedback.application_id AND a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update own Planner feedback" ON public.application_planner_feedback;
CREATE POLICY "Users can update own Planner feedback" ON public.application_planner_feedback FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.application_planner_ops FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.application_planner_generation_runs FROM anon, authenticated;
-- Feedback writes go through the authenticated route's ownership/target checks;
-- direct table writes are intentionally closed so target plan IDs cannot be forged.
REVOKE INSERT, UPDATE, DELETE ON public.application_planner_feedback FROM anon, authenticated;
