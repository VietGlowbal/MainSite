import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('course parser migration ordering', () => {
  it('keeps the documented additive deployment order and worker-only RPC ACL', () => {
    const status = readRepoFile('docs/current-status.md');
    const baseline = readRepoFile('sql/supabase-claim-parse-jobs.sql');
    const resilience = readRepoFile('sql/supabase-job-claim-resilience.sql');
    const reliability = readRepoFile('sql/supabase-course-parse-reliability.sql');

    const order = [
      'sql/supabase-pg-phd-onboarding.sql',
      'sql/supabase-job-claim-resilience.sql',
      'sql/supabase-course-parse-reliability.sql',
      'application deployment',
    ].map((entry) => status.indexOf(entry));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));

    expect(baseline).toMatch(/BASELINE ONLY[\s\S]*Never rerun it after those files/i);
    expect(resilience).toMatch(/before the accompanying[\s\S]*reliability migration/i);
    expect(reliability).toContain('COALESCE(updated_at, started_at)');
    expect(reliability).toMatch(/REVOKE ALL ON FUNCTION public\.claim_course_parse_jobs/i);
    expect(reliability).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_course_parse_jobs[\s\S]*TO service_role/i);
  });
});
