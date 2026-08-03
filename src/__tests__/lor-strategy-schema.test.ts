import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('LOR strategy Supabase migration', () => {
  it('creates an owner-scoped, Data API-accessible strategy table', () => {
    const migrationPath = resolve(process.cwd(), 'supabase-lor-strategy.sql');
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create table if not exists public.application_lor_strategies');
    expect(sql).toMatch(/application_id\s+uuid\s+not null\s+unique/);
    expect(sql).toContain('references public.course_applications(id) on delete cascade');
    expect(sql).toContain('user_id');
    expect(sql).toContain('references auth.users(id) on delete cascade');
    expect(sql).toContain('observed_evidence jsonb');
    expect(sql).toContain('perspective jsonb');
    expect(sql).toContain('recommendations jsonb');
    expect(sql).toContain('recommendation_brief text');

    expect(sql).toContain('alter table public.application_lor_strategies enable row level security');
    expect(sql).toMatch(/for select\s+to authenticated/);
    expect(sql).toMatch(/for insert\s+to authenticated/);
    expect(sql).toMatch(/for update\s+to authenticated/);
    expect(sql).toMatch(/for delete\s+to authenticated/);
    expect(sql).toContain('(select auth.uid()) = user_id');
    expect(sql).toMatch(/for update[\s\S]*?using\s*\([\s\S]*?with check\s*\(/);
    expect(sql).toContain('course_applications.user_id = (select auth.uid())');

    expect(sql).toContain(
      'grant select, insert, update, delete on public.application_lor_strategies to authenticated',
    );
    expect(sql).toContain(
      'grant select, insert, update, delete on public.application_lor_strategies to service_role',
    );
    expect(sql).toContain('idx_application_lor_strategies_user');
  });

  it('atomically consumes a free review without accepting a caller-supplied user id', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase-lor-strategy.sql'), 'utf8').toLowerCase();

    expect(sql).toContain(
      'create or replace function public.consume_statement_review(review_limit integer)',
    );
    expect(sql).toContain('security invoker');
    expect(sql).toContain('where user_id = (select auth.uid())');
    expect(sql).toContain('sop_analyses_used = coalesce(sop_analyses_used, 0) + 1');
    expect(sql).toContain('coalesce(sop_analyses_used, 0) < review_limit');
    expect(sql).toContain('grant execute on function public.consume_statement_review(integer) to authenticated');
  });
});
