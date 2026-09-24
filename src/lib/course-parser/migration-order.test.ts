import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

/**
 * The single line in docs/current-status.md that *declares* the deployment
 * order. The assertion below is anchored to it deliberately.
 *
 * It used to run `status.indexOf(...)` over the whole document, which made the
 * test rot on its own: current-status.md is a reverse-chronological log, so any
 * later entry that merely *mentions* a migration (e.g. "applied
 * supabase-job-claim-resilience.sql to production" on 2026-09-15) lands above
 * the declaration and scrambles the indices. That is exactly how this test came
 * to fail on main while the documented order itself was untouched and correct.
 *
 * Anchoring also makes the check stricter, not looser: previously an incidental
 * mention elsewhere in the log could satisfy the ordering by coincidence.
 */
const ORDER_DECLARATION = 'Required migration order (do not reorder):';

/** Waypoints as the declaration lists them, baseline first. */
const REQUIRED_ORDER = [
  'sql/supabase-claim-parse-jobs.sql',
  'sql/supabase-pg-phd-onboarding.sql',
  'sql/supabase-job-claim-resilience.sql',
  'sql/supabase-course-parse-reliability.sql',
  'application deployment',
];

describe('course parser migration ordering', () => {
  it('keeps the documented additive deployment order and worker-only RPC ACL', () => {
    const status = readRepoFile('docs/current-status.md');
    const baseline = readRepoFile('sql/supabase-claim-parse-jobs.sql');
    const resilience = readRepoFile('sql/supabase-job-claim-resilience.sql');
    const reliability = readRepoFile('sql/supabase-course-parse-reliability.sql');

    // Losing the declaration — or growing a second, competing one — is itself
    // the regression this guards, so say which it was rather than failing on a
    // bare index comparison further down.
    const declarations = status.split('\n').filter((line) => line.includes(ORDER_DECLARATION));
    expect(declarations).toHaveLength(1);
    const declaration = declarations[0] ?? '';

    const positions = REQUIRED_ORDER.map((entry) => declaration.indexOf(entry));
    expect(REQUIRED_ORDER.filter((_, index) => positions[index] === -1)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(baseline).toMatch(/BASELINE ONLY[\s\S]*Never rerun it after those files/i);
    expect(resilience).toMatch(/before the accompanying[\s\S]*reliability migration/i);
    expect(reliability).toContain('COALESCE(updated_at, started_at)');
    expect(reliability).toMatch(/REVOKE ALL ON FUNCTION public\.claim_course_parse_jobs/i);
    expect(reliability).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_course_parse_jobs[\s\S]*TO service_role/i);
  });
});
