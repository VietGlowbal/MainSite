-- Disposable PostgreSQL/Supabase Planner assertions. Bootstrap and migrations
-- are applied by the wrapper before this file.
\set app_id 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set user_id 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set foreign_id 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set removed_payload '{"domainPlanId":"plan:test","readiness":"requires_enrichment","phases":[]}'
\set plan_payload '{"domainPlanId":"plan:test","readiness":"requires_enrichment","phases":[{"domainNodeId":"phase:test","title":"Phase","objective":"Objective","order":1,"sourceDecisionIds":[],"sourceProvenances":[],"steps":[{"domainNodeId":"step:test","title":"Step","objective":"Objective","order":1,"sourceDecisionIds":[],"sourceProvenances":[],"microSteps":[{"domainNodeId":"micro:test","title":"Answer","guidance":"Write the requested answer with official supporting detail.","order":1,"readiness":"requires_user_input","contentSchema":{"type":"long_text","prompt":"Explain"},"sourceDecisionIds":[],"sourceProvenances":[]},{"domainNodeId":"micro:second","title":"Second answer","guidance":"Provide the second answer independently.","order":2,"readiness":"requires_user_input","contentSchema":{"type":"long_text","prompt":"Explain"},"sourceDecisionIds":[],"sourceProvenances":[]},{"domainNodeId":"micro:third","title":"Third answer","guidance":"Provide the third answer independently.","order":3,"readiness":"requires_user_input","contentSchema":{"type":"long_text","prompt":"Explain"},"sourceDecisionIds":[],"sourceProvenances":[]}]}]}]}'

SELECT set_config('planner.test.app_id', :'app_id', false);
SELECT set_config('planner.test.foreign_id', :'foreign_id', false);
SELECT set_config('planner.test.plan_payload', :'plan_payload', false);
SET ROLE service_role;
SELECT public.reconcile_canonical_application_plan(:'app_id'::uuid, :'plan_payload'::jsonb);
DO $$ DECLARE v_step_id UUID; v_micro_ids TEXT[]; BEGIN
  SELECT id INTO v_step_id FROM public.application_plan_steps WHERE domain_node_id = 'step:test' AND archived_at IS NULL;
  SELECT array_agg(id::text ORDER BY domain_node_id) INTO v_micro_ids
  FROM public.application_plan_micro_steps
  WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NULL;
  IF v_step_id IS NULL OR COALESCE(cardinality(v_micro_ids), 0) <> 3
    OR EXISTS (
      SELECT 1 FROM public.application_plan_micro_steps
      WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third')
        AND step_id IS DISTINCT FROM v_step_id
    ) THEN
    RAISE EXCEPTION 'multi-micro-step reconciliation used an incorrect parent step';
  END IF;
  IF (SELECT guidance FROM public.application_plan_micro_steps WHERE domain_node_id = 'micro:test')
      <> 'Write the requested answer with official supporting detail.' THEN
    RAISE EXCEPTION 'micro-step guidance was not persisted';
  END IF;
  PERFORM set_config('planner.test.step_id', v_step_id::text, false);
  PERFORM set_config('planner.test.micro_ids', array_to_string(v_micro_ids, ','), false);
END $$;
SELECT public.reconcile_canonical_application_plan(:'app_id'::uuid, :'plan_payload'::jsonb);
DO $$ DECLARE v_micro_ids TEXT[]; BEGIN
  IF (SELECT count(*) FROM public.application_plans WHERE application_id = current_setting('planner.test.app_id')::uuid AND archived_at IS NULL) <> 1 THEN RAISE EXCEPTION 'duplicate active plan'; END IF;
  IF (SELECT count(*) FROM public.application_plan_micro_steps WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NULL) <> 3 THEN RAISE EXCEPTION 'duplicate active micro-steps'; END IF;
  IF (SELECT count(DISTINCT step_id) FROM public.application_plan_micro_steps WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NULL) <> 1
    OR EXISTS (
      SELECT 1 FROM public.application_plan_micro_steps
      WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third')
        AND archived_at IS NULL
        AND step_id <> current_setting('planner.test.step_id')::uuid
    ) THEN
    RAISE EXCEPTION 'micro-steps no longer reference the canonical parent step';
  END IF;
  SELECT array_agg(id::text ORDER BY domain_node_id) INTO v_micro_ids
  FROM public.application_plan_micro_steps
  WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NULL;
  IF v_micro_ids IS DISTINCT FROM string_to_array(current_setting('planner.test.micro_ids'), ',') THEN RAISE EXCEPTION 'reconciliation changed stable micro-step ids'; END IF;
END $$;

-- Feedback uses the generated target key and a real database upsert, so two
-- first writes for the same user/target converge to one response.
INSERT INTO public.application_planner_feedback(application_id, plan_id, user_id, target_type, target_id, rating, reason)
SELECT :'app_id'::uuid, id, :'user_id'::uuid, 'plan', NULL, 2, 'too_generic'
FROM public.application_plans WHERE application_id = :'app_id'::uuid AND archived_at IS NULL
ON CONFLICT (user_id, application_id, plan_id, target_type, target_key) DO NOTHING;
INSERT INTO public.application_planner_feedback(application_id, plan_id, user_id, target_type, target_id, rating, reason)
SELECT :'app_id'::uuid, id, :'user_id'::uuid, 'plan', NULL, 4, NULL
FROM public.application_plans WHERE application_id = :'app_id'::uuid AND archived_at IS NULL
ON CONFLICT (user_id, application_id, plan_id, target_type, target_key)
DO UPDATE SET rating = EXCLUDED.rating, reason = EXCLUDED.reason, updated_at = NOW();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.application_planner_feedback WHERE application_id = current_setting('planner.test.app_id')::uuid AND target_type = 'plan') <> 1 THEN RAISE EXCEPTION 'feedback upsert duplicated'; END IF;
  IF (SELECT rating FROM public.application_planner_feedback WHERE application_id = current_setting('planner.test.app_id')::uuid AND target_type = 'plan') <> 4 THEN RAISE EXCEPTION 'feedback upsert did not update'; END IF;
END $$;
INSERT INTO public.application_planner_ops(application_id, lifecycle, generation_status, ai_status)
VALUES (:'app_id'::uuid, 'ready', 'success', 'not_required')
ON CONFLICT (application_id) DO UPDATE SET lifecycle = EXCLUDED.lifecycle, generation_status = EXCLUDED.generation_status, ai_status = EXCLUDED.ai_status, updated_at = NOW();
DO $$ BEGIN
  IF (SELECT lifecycle FROM public.application_planner_ops WHERE application_id = current_setting('planner.test.app_id')::uuid) <> 'ready' THEN RAISE EXCEPTION 'service role Ops write failed'; END IF;
END $$;

-- Planning-only changes preserve Core 4 execution state.
UPDATE public.application_plan_micro_steps
SET status = 'completed', deadline = '2026-10-01', content_value = '{"type":"long_text","text":"student answer"}'::jsonb, execution_evidence = '[{"id":"evidence-1"}]'::jsonb
WHERE domain_node_id = 'micro:test';
SELECT public.reconcile_canonical_application_plan(:'app_id'::uuid, replace(replace(:'plan_payload', '"title":"Answer"', '"title":"Answer revised"'), '"guidance":"Write the requested answer with official supporting detail."', '"guidance":"Revise the answer using the official evidence you collected."')::jsonb);
DO $$ DECLARE v_status TEXT; v_deadline DATE; v_value JSONB; v_evidence JSONB; v_guidance TEXT; BEGIN
  SELECT status, deadline, content_value, execution_evidence, guidance INTO v_status, v_deadline, v_value, v_evidence, v_guidance FROM public.application_plan_micro_steps WHERE domain_node_id = 'micro:test';
  IF v_status <> 'completed' OR v_deadline <> '2026-10-01'::date OR v_value->>'text' <> 'student answer' OR jsonb_array_length(v_evidence) <> 1 THEN RAISE EXCEPTION 'execution state was overwritten'; END IF;
  IF v_guidance <> 'Revise the answer using the official evidence you collected.' THEN RAISE EXCEPTION 'reconciliation did not update micro-step guidance'; END IF;
END $$;

-- Incompatible schema changes cannot retain a completed value.
UPDATE public.application_plan_micro_steps SET status = 'completed', content_value = '{"type":"long_text","text":"old"}'::jsonb WHERE domain_node_id = 'micro:test';
SELECT public.reconcile_canonical_application_plan(:'app_id'::uuid, replace(:'plan_payload', 'long_text', 'single_select')::jsonb);
DO $$ DECLARE v_status TEXT; v_value JSONB; BEGIN
  SELECT status, content_value INTO v_status, v_value FROM public.application_plan_micro_steps WHERE domain_node_id = 'micro:test';
  IF v_status = 'completed' OR v_value IS NOT NULL THEN RAISE EXCEPTION 'incompatible value retained'; END IF;
END $$;

SELECT public.reconcile_canonical_application_plan(:'app_id'::uuid, :'removed_payload'::jsonb);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.application_plan_micro_steps
    WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NULL
  ) THEN RAISE EXCEPTION 'removed micro-step was not archived'; END IF;
  IF (SELECT count(*) FROM public.application_plan_micro_steps WHERE domain_node_id IN ('micro:test', 'micro:second', 'micro:third') AND archived_at IS NOT NULL) <> 3 THEN RAISE EXCEPTION 'removed micro-step archive count was incorrect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.application_plan_steps WHERE domain_node_id = 'step:test' AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'removed step was not archived'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.application_plan_phases WHERE domain_node_id = 'phase:test' AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'removed phase was not archived'; END IF;
END $$;

-- A failing reconciliation rolls back the whole function statement.
DO $$ DECLARE v_before TEXT; v_after TEXT; v_failed BOOLEAN := false; BEGIN
  SELECT title INTO v_before FROM public.application_plan_phases WHERE domain_node_id = 'phase:test';
  BEGIN PERFORM public.reconcile_canonical_application_plan(current_setting('planner.test.app_id')::uuid, replace(current_setting('planner.test.plan_payload'), '"order":1', '"order":0')::jsonb); EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  SELECT title INTO v_after FROM public.application_plan_phases WHERE domain_node_id = 'phase:test';
  IF NOT v_failed OR v_before <> v_after THEN RAISE EXCEPTION 'RPC rollback failed'; END IF;
END $$;

-- Authenticated owners cannot mutate hierarchy fields or execute the RPC.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'user_id', false);
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN UPDATE public.application_plan_phases SET title = 'forged' WHERE domain_node_id = 'phase:test'; v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner mutated planning field'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN INSERT INTO public.application_plan_steps(phase_id, domain_node_id, title, objective, sort_order) SELECT id, 'forged', 'forged', 'forged', 1 FROM public.application_plan_phases WHERE domain_node_id = 'phase:test'; v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner inserted planning node'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN UPDATE public.application_plan_steps SET sort_order = 9 WHERE domain_node_id = 'step:test'; v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner mutated step order'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN UPDATE public.application_plan_micro_steps SET content_schema = '{}'::jsonb WHERE domain_node_id = 'micro:test'; v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner mutated content schema'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN UPDATE public.application_planner_ops SET lifecycle = 'ready' WHERE application_id = current_setting('planner.test.app_id')::uuid; v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner forged Planner Ops'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN INSERT INTO public.application_planner_generation_runs(application_id, trigger, status) VALUES (current_setting('planner.test.app_id')::uuid, 'manual_refresh', 'running'); v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'owner forged generation run'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN PERFORM public.reconcile_canonical_application_plan(current_setting('planner.test.app_id')::uuid, '{}'::jsonb); v_ok := true; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'authenticated executed RPC'; END IF;
END $$;
SET ROLE service_role;

-- Foreign users cannot read the hierarchy through RLS.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'foreign_id', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.application_plans WHERE application_id = current_setting('planner.test.app_id')::uuid) <> 0 THEN RAISE EXCEPTION 'foreign hierarchy read'; END IF;
END $$;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.application_planner_feedback WHERE application_id = current_setting('planner.test.app_id')::uuid) <> 0 THEN RAISE EXCEPTION 'foreign feedback read'; END IF;
END $$;
DO $$ DECLARE v_ok BOOLEAN := false; BEGIN
  BEGIN INSERT INTO public.application_planner_feedback(application_id, plan_id, user_id, target_type, target_id, rating)
    SELECT current_setting('planner.test.app_id')::uuid, id, current_setting('planner.test.foreign_id')::uuid, 'plan', NULL, 1 FROM public.application_plans WHERE application_id = current_setting('planner.test.app_id')::uuid AND archived_at IS NULL;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_ok THEN RAISE EXCEPTION 'foreign feedback write'; END IF;
END $$;
SET ROLE service_role;

-- Lease concurrency and expiry recovery.
DO $$ DECLARE v_one UUID; v_two UUID; v_three UUID; BEGIN
  v_one := public.claim_canonical_planner_generation(current_setting('planner.test.app_id')::uuid, 'manual_refresh', NULL, 60);
  v_two := public.claim_canonical_planner_generation(current_setting('planner.test.app_id')::uuid, 'manual_refresh', NULL, 60);
  IF v_one IS NULL OR v_two IS NOT NULL THEN RAISE EXCEPTION 'lease was not exclusive'; END IF;
  UPDATE public.application_planner_generation_runs SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE id = v_one;
  v_three := public.claim_canonical_planner_generation(current_setting('planner.test.app_id')::uuid, 'retry', NULL, 60);
  IF v_three IS NULL OR v_three = v_one THEN RAISE EXCEPTION 'expired lease was not reclaimed'; END IF;
END $$;
RESET ROLE;
SELECT 'planner integration assertions passed' AS result;
