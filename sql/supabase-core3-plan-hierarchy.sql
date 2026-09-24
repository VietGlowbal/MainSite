-- Core 3 -> Core 4 persistence bridge
--
-- This is deliberately separate from application_recommendations. That legacy
-- flat table is shared by F5 and F7, while this hierarchy is owned only by the
-- deterministic Core 3 planner. Removed planning nodes are archived, never
-- deleted, so Core 4 execution history remains recoverable.

CREATE TABLE IF NOT EXISTS public.application_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  producer TEXT NOT NULL CHECK (producer = 'core3_deterministic'),
  domain_plan_id TEXT NOT NULL,
  readiness TEXT NOT NULL CHECK (readiness IN ('empty', 'requires_user_input', 'requires_enrichment')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active canonical Core 3 plan per application. Previous plans may be
-- retained by explicitly archiving the root rather than overwriting history.
CREATE UNIQUE INDEX IF NOT EXISTS application_plans_one_active_producer
  ON public.application_plans(application_id, producer)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS application_plans_application_active
  ON public.application_plans(application_id, archived_at);

CREATE TABLE IF NOT EXISTS public.application_plan_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.application_plans(id) ON DELETE CASCADE,
  domain_node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  source_decision_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_provenances JSONB NOT NULL DEFAULT '[]'::JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, domain_node_id)
);
CREATE INDEX IF NOT EXISTS application_plan_phases_active_order
  ON public.application_plan_phases(plan_id, archived_at, sort_order);

CREATE TABLE IF NOT EXISTS public.application_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.application_plan_phases(id) ON DELETE CASCADE,
  domain_node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  source_decision_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_provenances JSONB NOT NULL DEFAULT '[]'::JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phase_id, domain_node_id)
);
CREATE INDEX IF NOT EXISTS application_plan_steps_active_order
  ON public.application_plan_steps(phase_id, archived_at, sort_order);

CREATE TABLE IF NOT EXISTS public.application_plan_micro_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.application_plan_steps(id) ON DELETE CASCADE,
  domain_node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  readiness TEXT NOT NULL CHECK (readiness IN ('requires_user_input', 'requires_enrichment')),
  -- Planning-owned definition. It may evolve without overwriting content_value.
  content_schema JSONB,
  source_decision_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_provenances JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Core 4 execution-owned fields. Core 3 reconciliation never writes them.
  status TEXT NOT NULL DEFAULT 'not_started',
  deadline DATE,
  content_value JSONB,
  execution_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(step_id, domain_node_id)
);
CREATE INDEX IF NOT EXISTS application_plan_micro_steps_active_order
  ON public.application_plan_micro_steps(step_id, archived_at, sort_order);
CREATE INDEX IF NOT EXISTS application_plan_micro_steps_execution
  ON public.application_plan_micro_steps(status, deadline)
  WHERE archived_at IS NULL;

ALTER TABLE public.application_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_plan_micro_steps ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOREACH policy_name IN ARRAY ARRAY[
    'Users can view Core 3 plans', 'Users can insert Core 3 plans', 'Users can update Core 3 plans',
    'Users can view Core 3 plan phases', 'Users can insert Core 3 plan phases', 'Users can update Core 3 plan phases',
    'Users can view Core 3 plan steps', 'Users can insert Core 3 plan steps', 'Users can update Core 3 plan steps',
    'Users can view Core 3 plan micro steps', 'Users can insert Core 3 plan micro steps', 'Users can update Core 3 plan micro steps'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = policy_name) THEN
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name,
        CASE
          WHEN policy_name LIKE '%micro steps' THEN 'application_plan_micro_steps'
          WHEN policy_name LIKE '%phases' THEN 'application_plan_phases'
          WHEN policy_name LIKE '%steps' THEN 'application_plan_steps'
          ELSE 'application_plans'
        END);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "Users can view Core 3 plans" ON public.application_plans
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.course_applications applications WHERE applications.id = application_plans.application_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can insert Core 3 plans" ON public.application_plans
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.course_applications applications WHERE applications.id = application_plans.application_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can update Core 3 plans" ON public.application_plans
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.course_applications applications WHERE applications.id = application_plans.application_id AND applications.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_applications applications WHERE applications.id = application_plans.application_id AND applications.user_id = auth.uid()));

CREATE POLICY "Users can view Core 3 plan phases" ON public.application_plan_phases
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.application_plans plans JOIN public.course_applications applications ON applications.id = plans.application_id WHERE plans.id = application_plan_phases.plan_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can insert Core 3 plan phases" ON public.application_plan_phases
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.application_plans plans JOIN public.course_applications applications ON applications.id = plans.application_id WHERE plans.id = application_plan_phases.plan_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can update Core 3 plan phases" ON public.application_plan_phases
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.application_plans plans JOIN public.course_applications applications ON applications.id = plans.application_id WHERE plans.id = application_plan_phases.plan_id AND applications.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.application_plans plans JOIN public.course_applications applications ON applications.id = plans.application_id WHERE plans.id = application_plan_phases.plan_id AND applications.user_id = auth.uid()));

CREATE POLICY "Users can view Core 3 plan steps" ON public.application_plan_steps
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.application_plan_phases phases JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE phases.id = application_plan_steps.phase_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can insert Core 3 plan steps" ON public.application_plan_steps
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.application_plan_phases phases JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE phases.id = application_plan_steps.phase_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can update Core 3 plan steps" ON public.application_plan_steps
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.application_plan_phases phases JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE phases.id = application_plan_steps.phase_id AND applications.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.application_plan_phases phases JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE phases.id = application_plan_steps.phase_id AND applications.user_id = auth.uid()));

CREATE POLICY "Users can view Core 3 plan micro steps" ON public.application_plan_micro_steps
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.application_plan_steps steps JOIN public.application_plan_phases phases ON phases.id = steps.phase_id JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE steps.id = application_plan_micro_steps.step_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can insert Core 3 plan micro steps" ON public.application_plan_micro_steps
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.application_plan_steps steps JOIN public.application_plan_phases phases ON phases.id = steps.phase_id JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE steps.id = application_plan_micro_steps.step_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can update Core 3 plan micro steps" ON public.application_plan_micro_steps
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.application_plan_steps steps JOIN public.application_plan_phases phases ON phases.id = steps.phase_id JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE steps.id = application_plan_micro_steps.step_id AND applications.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.application_plan_steps steps JOIN public.application_plan_phases phases ON phases.id = steps.phase_id JOIN public.application_plans plans ON plans.id = phases.plan_id JOIN public.course_applications applications ON applications.id = plans.application_id WHERE steps.id = application_plan_micro_steps.step_id AND applications.user_id = auth.uid()));
