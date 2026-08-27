import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../../supabase-application-personal-report-generation-jobs.sql', import.meta.url), 'utf8');

describe('Personal Report generation job migration', () => {
  it('provides an owner-isolated queue with an atomic service-role claim RPC', () => {
    expect(sql).toContain('application_personal_report_generation_jobs');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toMatch(/grant execute on function public\.claim_application_personal_report_generation_jobs\(text, integer\) to service_role/i);
    expect(sql).toContain('application_personal_report_generation_jobs_select_own');
    expect(sql).toContain('course_applications.user_id = auth.uid()');
  });
});
