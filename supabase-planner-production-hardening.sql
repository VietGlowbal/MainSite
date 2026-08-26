-- Canonical Planner production hardening.
-- Apply AFTER:
--   1) supabase-core3-plan-hierarchy.sql
--   2) supabase-canonical-planner-production.sql
--   3) supabase-planner-ops.sql
-- This is forward-only: it adds leases, safe content reconciliation, and
-- indexes/functions without rewriting legacy recommendation data.

ALTER TABLE public.application_planner_generation_runs
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

UPDATE public.application_planner_generation_runs
SET claimed_at = COALESCE(claimed_at, started_at),
    lease_expires_at = COALESCE(lease_expires_at, started_at + INTERVAL '5 minutes')
WHERE status = 'running';

CREATE INDEX IF NOT EXISTS planner_ops_runs_application_status_lease
  ON public.application_planner_generation_runs(application_id, status, lease_expires_at);
CREATE INDEX IF NOT EXISTS planner_ops_updated
  ON public.application_planner_ops(updated_at DESC);
CREATE INDEX IF NOT EXISTS planner_feedback_application_plan
  ON public.application_planner_feedback(application_id, plan_id, target_type);

-- A generated target key lets the server use a true upsert for both plan and
-- micro-step feedback. The original expression index remains valid as a
-- backwards-compatible uniqueness guard.
ALTER TABLE public.application_planner_feedback
  ADD COLUMN IF NOT EXISTS target_key UUID GENERATED ALWAYS AS (
    COALESCE(target_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS planner_feedback_one_per_target_v2
  ON public.application_planner_feedback(user_id, application_id, plan_id, target_type, target_key);

CREATE OR REPLACE FUNCTION public.claim_canonical_planner_generation(
  p_application_id UUID,
  p_trigger TEXT,
  p_source_fingerprint TEXT DEFAULT NULL,
  p_lease_seconds INTEGER DEFAULT 300
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_run UUID;
  v_lease_expires_at TIMESTAMPTZ;
  v_lease_seconds INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 30), 3600);
BEGIN
  -- The application row is the cross-instance mutex. This serialises the
  -- check/reclaim/insert sequence without relying on a process-local lock.
  PERFORM 1 FROM public.course_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id, lease_expires_at INTO v_existing, v_lease_expires_at
  FROM public.application_planner_generation_runs
  WHERE application_id = p_application_id AND status = 'running'
  FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    IF v_lease_expires_at > NOW() THEN RETURN NULL; END IF;
    UPDATE public.application_planner_generation_runs
    SET status = 'failed', failure_code = 'concurrency_conflict', completed_at = NOW(), lease_expires_at = NULL
    WHERE id = v_existing;
  END IF;

  INSERT INTO public.application_planner_generation_runs(
    application_id, trigger, source_fingerprint, status, claimed_at, lease_expires_at
  ) VALUES (
    p_application_id, p_trigger, p_source_fingerprint, 'running', NOW(), NOW() + make_interval(secs => v_lease_seconds)
  ) RETURNING id INTO v_run;
  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_canonical_planner_generation(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_canonical_planner_generation(uuid, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.planner_content_value_compatible(
  p_schema JSONB,
  p_value JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(CASE
    WHEN p_schema IS NULL OR p_schema = 'null'::jsonb THEN p_value IS NULL OR p_value = 'null'::jsonb
    WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN FALSE
    WHEN jsonb_typeof(p_schema) <> 'object' OR jsonb_typeof(p_value) <> 'object' THEN FALSE
    WHEN p_schema->>'type' <> p_value->>'type' THEN FALSE
    WHEN p_schema->>'type' = 'long_text' THEN jsonb_typeof(p_value->'text') = 'string'
    WHEN p_schema->>'type' = 'single_select' THEN
      jsonb_typeof(p_value->'value') = 'string'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_schema->'options', '[]'::jsonb)) option
        WHERE option->>'value' = p_value->>'value'
      )
    WHEN p_schema->>'type' = 'checklist' THEN
      jsonb_typeof(p_value->'checkedItems') = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(p_value->'checkedItems', '[]'::jsonb)) checked(item)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_schema->'items', '[]'::jsonb)) item(value)
          WHERE item.value = checked.item
        )
      )
    WHEN p_schema->>'type' = 'structured_table' THEN
      jsonb_typeof(p_value->'rows') = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p_value->'rows', '[]'::jsonb)) row_value
        WHERE jsonb_typeof(row_value) <> 'object'
          OR EXISTS (
            SELECT 1 FROM jsonb_object_keys(row_value) row_key(key)
            WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(p_schema->'columns', '[]'::jsonb)) column_value
              WHERE column_value->>'key' = row_key.key
            )
          )
      )
    ELSE FALSE
  END, FALSE);
$$;

CREATE OR REPLACE FUNCTION public.planner_content_value_complete(
  p_schema JSONB,
  p_value JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.planner_content_value_compatible(p_schema, p_value), FALSE)
    AND COALESCE(CASE p_schema->>'type'
      WHEN 'long_text' THEN
        (SELECT COUNT(*) FROM regexp_split_to_table(trim(COALESCE(p_value->>'text', '')), '\s+') word WHERE word <> '')
          >= COALESCE((p_schema->>'minWords')::INTEGER, 1)
      WHEN 'single_select' THEN TRUE
      WHEN 'checklist' THEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_schema->'items', '[]'::jsonb)) item(value)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_value->'checkedItems', '[]'::jsonb)) checked(value)
          WHERE checked.value = item.value
        )
      )
      WHEN 'structured_table' THEN jsonb_array_length(COALESCE(p_value->'rows', '[]'::jsonb)) > 0
      ELSE FALSE
    END, FALSE);
$$;

REVOKE ALL ON FUNCTION public.planner_content_value_compatible(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planner_content_value_complete(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_content_value_compatible(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.planner_content_value_complete(jsonb, jsonb) TO service_role;

-- Reinstall reconciliation after the compatibility helpers exist. The
-- application row lock also makes concurrent ensure calls converge before the
-- active-plan unique index is consulted.
CREATE OR REPLACE FUNCTION public.reconcile_canonical_application_plan(
  p_application_id uuid,
  p_plan jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_phase_id uuid;
  v_step_id uuid;
  v_phase jsonb;
  v_step jsonb;
  v_micro jsonb;
  v_now timestamptz := now();
  v_phase_keys text[] := ARRAY[]::text[];
  v_step_keys text[] := ARRAY[]::text[];
  v_micro_keys text[] := ARRAY[]::text[];
  v_inserted integer := 0;
  v_updated integer := 0;
  v_archived integer := 0;
BEGIN
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'Invalid planner payload';
  END IF;
  PERFORM 1 FROM public.course_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  SELECT id INTO v_plan_id FROM application_plans
    WHERE application_id = p_application_id AND producer = 'core3_deterministic' AND archived_at IS NULL
    FOR UPDATE;
  IF v_plan_id IS NULL THEN
    INSERT INTO application_plans(application_id, producer, domain_plan_id, readiness)
      VALUES (p_application_id, 'core3_deterministic', p_plan->>'domainPlanId', p_plan->>'readiness')
      RETURNING id INTO v_plan_id;
    v_inserted := v_inserted + 1;
  ELSE
    UPDATE application_plans SET domain_plan_id = p_plan->>'domainPlanId', readiness = p_plan->>'readiness', updated_at = v_now WHERE id = v_plan_id;
    v_updated := v_updated + 1;
  END IF;

  FOR v_phase IN SELECT value FROM jsonb_array_elements(COALESCE(p_plan->'phases', '[]'::jsonb)) LOOP
    INSERT INTO application_plan_phases(plan_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at)
      VALUES (v_plan_id, v_phase->>'domainNodeId', v_phase->>'title', v_phase->>'objective', (v_phase->>'order')::integer,
        COALESCE(v_phase->'sourceDecisionIds', '[]'::jsonb), COALESCE(v_phase->'sourceProvenances', '[]'::jsonb), NULL)
      ON CONFLICT (plan_id, domain_node_id) DO UPDATE SET title = EXCLUDED.title, objective = EXCLUDED.objective,
        sort_order = EXCLUDED.sort_order, source_decision_ids = EXCLUDED.source_decision_ids,
        source_provenances = EXCLUDED.source_provenances, archived_at = NULL, updated_at = v_now
      RETURNING id INTO v_phase_id;
    v_phase_keys := array_append(v_phase_keys, v_phase_id::text);

    FOR v_step IN SELECT value FROM jsonb_array_elements(COALESCE(v_phase->'steps', '[]'::jsonb)) LOOP
      INSERT INTO application_plan_steps(phase_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at)
        VALUES (v_phase_id, v_step->>'domainNodeId', v_step->>'title', v_step->>'objective', (v_step->>'order')::integer,
          COALESCE(v_step->'sourceDecisionIds', '[]'::jsonb), COALESCE(v_step->'sourceProvenances', '[]'::jsonb), NULL)
        ON CONFLICT (phase_id, domain_node_id) DO UPDATE SET title = EXCLUDED.title, objective = EXCLUDED.objective,
          sort_order = EXCLUDED.sort_order, source_decision_ids = EXCLUDED.source_decision_ids,
          source_provenances = EXCLUDED.source_provenances, archived_at = NULL, updated_at = v_now
        RETURNING id INTO v_step_id;
      v_step_keys := array_append(v_step_keys, v_step_id::text);

      FOR v_micro IN SELECT value FROM jsonb_array_elements(COALESCE(v_step->'microSteps', '[]'::jsonb)) LOOP
        INSERT INTO application_plan_micro_steps(step_id, domain_node_id, title, sort_order, readiness, content_schema, source_decision_ids, source_provenances, archived_at)
          VALUES (v_step_id, v_micro->>'domainNodeId', v_micro->>'title', (v_micro->>'order')::integer,
            v_micro->>'readiness', NULLIF(v_micro->'contentSchema', 'null'::jsonb),
            COALESCE(v_micro->'sourceDecisionIds', '[]'::jsonb), COALESCE(v_micro->'sourceProvenances', '[]'::jsonb), NULL)
          ON CONFLICT (step_id, domain_node_id) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order,
            readiness = EXCLUDED.readiness,
            status = CASE
              WHEN application_plan_micro_steps.content_schema IS DISTINCT FROM EXCLUDED.content_schema
                AND NOT public.planner_content_value_compatible(EXCLUDED.content_schema, application_plan_micro_steps.content_value)
                THEN 'not_started'
              WHEN application_plan_micro_steps.content_schema IS DISTINCT FROM EXCLUDED.content_schema
                AND application_plan_micro_steps.status = 'completed'
                AND NOT public.planner_content_value_complete(EXCLUDED.content_schema, application_plan_micro_steps.content_value)
                THEN 'in_progress'
              ELSE application_plan_micro_steps.status
            END,
            content_value = CASE
              WHEN application_plan_micro_steps.content_schema IS DISTINCT FROM EXCLUDED.content_schema
                AND NOT public.planner_content_value_compatible(EXCLUDED.content_schema, application_plan_micro_steps.content_value)
                THEN NULL
              ELSE application_plan_micro_steps.content_value
            END,
            content_schema = EXCLUDED.content_schema,
            source_decision_ids = EXCLUDED.source_decision_ids, source_provenances = EXCLUDED.source_provenances,
            archived_at = NULL, updated_at = v_now
          RETURNING id INTO v_step_id;
        v_micro_keys := array_append(v_micro_keys, v_step_id::text);
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE application_plan_micro_steps SET archived_at = v_now, updated_at = v_now
    WHERE step_id IN (SELECT id FROM application_plan_steps WHERE phase_id IN (SELECT id FROM application_plan_phases WHERE plan_id = v_plan_id))
      AND archived_at IS NULL AND NOT (id::text = ANY(v_micro_keys));
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  UPDATE application_plan_steps SET archived_at = v_now, updated_at = v_now
    WHERE phase_id IN (SELECT id FROM application_plan_phases WHERE plan_id = v_plan_id)
      AND archived_at IS NULL AND NOT (id::text = ANY(v_step_keys));
  UPDATE application_plan_phases SET archived_at = v_now, updated_at = v_now
    WHERE plan_id = v_plan_id AND archived_at IS NULL AND NOT (id::text = ANY(v_phase_keys));

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'restored', 0, 'archived', v_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_canonical_application_plan(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_canonical_application_plan(uuid, jsonb) TO service_role;
