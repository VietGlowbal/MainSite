-- Forward-only repair for databases where
-- supabase-planner-production-hardening.sql was already applied with the
-- micro-step id assigned to v_step_id. Apply after that hardening migration.
-- This reinstalls its complete locking, compatibility, archive, and RPC grant
-- behaviour while preserving the parent step id throughout each micro-step loop.

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
  v_micro_id uuid;
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
          RETURNING id INTO v_micro_id;
        v_micro_keys := array_append(v_micro_keys, v_micro_id::text);
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
