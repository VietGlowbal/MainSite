import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('critical security hardening contracts', () => {
  it('binds shortlist creation to auth.uid and stored result IDs', () => {
    const rpc = read('sql/supabase-add-selected-courses-rpc.sql');
    const route = read('src/app/api/apply-shortlist/add-courses/route.ts');

    expect(rpc).toContain('p_session_id uuid');
    expect(rpc).toContain('p_result_ids uuid[]');
    expect(rpc).toContain('v_user_id := auth.uid();');
    expect(rpc).not.toContain('p_user_id');
    expect(rpc).not.toContain('p_results');
    expect(route).toContain('p_session_id: sessionId');
    expect(route).toContain('p_result_ids: toCreateValidated.map(result => result.id)');
    expect(route).not.toContain('p_user_id');
    expect(route).not.toContain('p_results');
    expect(route).not.toContain('details: rpcError.message');
  });

  it('keeps mentor PII out of public projections and private buckets owner-scoped', () => {
    const migration = read('sql/supabase-critical-security-hardening-2026-09-08.sql');
    const view = migration.match(/CREATE OR REPLACE VIEW[\s\S]*?FROM public\.achiever_profiles/);
    const privateColumns = [
      'legal_name',
      'date_of_birth',
      'cv_storage_key',
      'acceptance_letter_storage_key',
      'transcript_storage_key',
      'student_card_storage_key',
      'stripe_account_id',
    ];

    expect(view?.[0]).toBeTruthy();
    for (const column of privateColumns) expect(view?.[0]).not.toContain(column);
    expect(migration).toContain('REVOKE SELECT ON public.achiever_profiles FROM PUBLIC, anon, authenticated;');
    expect(migration).toContain('GRANT SELECT ON public.public_mentor_profiles TO anon, authenticated;');
    expect(migration).toContain("SET public = false");
    expect(migration).toContain('Mentor updates own documents');
    expect(migration).toContain('Users update own documents');
    expect(migration).toContain("bucket_id = 'mentor-documents'");
    expect(migration).toContain("bucket_id = 'student-documents'");
    expect(read('src/lib/mentors.ts')).toContain('getOwnMentorProfile');
    expect(read('src/app/dashboard/advisor/page.tsx')).toContain('getOwnMentorProfile');
  });
});
