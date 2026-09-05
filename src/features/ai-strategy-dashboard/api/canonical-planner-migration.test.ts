import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const legacyRepairPath = resolve(root, 'sql/supabase-canonical-planner-multi-microstep-fix.sql');
const hardeningPath = resolve(root, 'sql/supabase-planner-production-hardening.sql');
const terminalRepairPath = resolve(root, 'sql/supabase-planner-production-hardening-multi-microstep-fix.sql');
const guidanceMigrationPath = resolve(root, 'sql/supabase-planner-micro-step-guidance.sql');
const integrationWrapperPath = resolve(root, 'scripts/planner-integration-check.ps1');

function readRequiredSql(path: string) {
  expect(existsSync(path)).toBe(true);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function expectMicroLoopToPreserveStepId(sql: string) {
  expect(sql).toContain('v_micro_id uuid');
  const microLoop = sql.match(/FOR\s+v_micro\s+IN[\s\S]*?END LOOP;/i)?.[0] ?? '';

  expect(microLoop).toMatch(/returning id into v_micro_id/i);
  expect(microLoop).toMatch(/v_micro_keys\s*:=\s*array_append\(v_micro_keys,\s*v_micro_id::text\)/i);
  expect(microLoop).not.toMatch(/returning id into v_step_id/i);
  expect(microLoop).not.toMatch(/v_micro_keys\s*:=\s*array_append\(v_micro_keys,\s*v_step_id::text\)/i);
}

describe('canonical Planner multi-microstep reconciliation migrations', () => {
  it('keeps the legacy repair correct', () => {
    expectMicroLoopToPreserveStepId(readRequiredSql(legacyRepairPath));
  });

  it('keeps the hardened reconciler and its forward-only repairs correct', () => {
    const hardeningSql = readRequiredSql(hardeningPath);
    const terminalRepairSql = readRequiredSql(terminalRepairPath);
    const guidanceMigrationSql = readRequiredSql(guidanceMigrationPath);

    expectMicroLoopToPreserveStepId(hardeningSql);
    expectMicroLoopToPreserveStepId(terminalRepairSql);
    expectMicroLoopToPreserveStepId(guidanceMigrationSql);
    expect(terminalRepairSql).toMatch(/PERFORM 1 FROM public\.course_applications[\s\S]*?FOR UPDATE/i);
    expect(terminalRepairSql).toContain('public.planner_content_value_compatible');
    expect(terminalRepairSql).toContain('GRANT EXECUTE ON FUNCTION public.reconcile_canonical_application_plan(uuid, jsonb) TO service_role');
    expect(guidanceMigrationSql).toContain('ADD COLUMN IF NOT EXISTS guidance TEXT');
    expect(guidanceMigrationSql).toMatch(/INSERT INTO application_plan_micro_steps\(step_id, domain_node_id, title, guidance/i);
    expect(guidanceMigrationSql).toMatch(/guidance = EXCLUDED\.guidance/i);
    expect(guidanceMigrationSql).toMatch(/PERFORM 1 FROM public\.course_applications[\s\S]*?FOR UPDATE/i);
    expect(guidanceMigrationSql).toContain('public.planner_content_value_compatible');
    expect(guidanceMigrationSql).toContain('GRANT EXECUTE ON FUNCTION public.reconcile_canonical_application_plan(uuid, jsonb) TO service_role');
  });

  it('applies the corrected terminal reconciler after hardening in the PostgreSQL integration chain', () => {
    expect(existsSync(integrationWrapperPath)).toBe(true);
    const wrapper = existsSync(integrationWrapperPath) ? readFileSync(integrationWrapperPath, 'utf8') : '';

    expect(wrapper.indexOf('supabase-planner-production-hardening.sql')).toBeGreaterThan(-1);
    expect(wrapper.indexOf('supabase-planner-production-hardening-multi-microstep-fix.sql'))
      .toBeGreaterThan(wrapper.indexOf('supabase-planner-production-hardening.sql'));
    expect(wrapper.indexOf('supabase-planner-micro-step-guidance.sql'))
      .toBeGreaterThan(wrapper.indexOf('supabase-planner-production-hardening-multi-microstep-fix.sql'));
  });
});
