import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repairPath = resolve(process.cwd(), 'supabase-canonical-planner-multi-microstep-fix.sql');

describe('canonical Planner multi-microstep repair migration', () => {
  it('keeps the parent step id stable while collecting every inserted micro-step id', () => {
    expect(existsSync(repairPath)).toBe(true);
    const sql = existsSync(repairPath) ? readFileSync(repairPath, 'utf8') : '';

    expect(sql).toContain('v_micro_id uuid');
    expect(sql).toMatch(/returning id into v_micro_id/i);
    expect(sql).toMatch(/v_micro_keys\s*:=\s*array_append\(v_micro_keys,\s*v_micro_id::text\)/i);
    expect(sql).not.toMatch(/returning id into v_step_id[\s\S]{0,120}v_micro_keys/i);
  });
});
