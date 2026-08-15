import { describe, expect, it } from 'vitest';
import { loadCandidateReflection } from './candidate-snapshot-repository';

/**
 * Focused on the reflection/Reflection-Card columns added by
 * `supabase-application-experience-flow.sql` — the new, riskiest part of
 * this reader. The existing tolerant-select behaviour for the columns added
 * by earlier migrations was already exercised indirectly through the pages
 * that call this function; these tests isolate the new tier.
 */

const ACHIEVEMENT_ROW = {
  id: 'ach-1',
  category: 'competition',
  title: 'National Mathematics Olympiad',
  competition: null,
  organisation: null,
  level: null,
  year: 2025,
  detail: null,
  evidence_key: null,
  review_status: null,
  source_type: null,
  sources: null,
  reflection: { context: 'Entered a national competition.', updatedAt: '2026-08-01T00:00:00Z' },
  reflection_card: {
    story: 'Trained for months to qualify.',
    contributions: ['Solved the qualifying round independently'],
    evidence: [],
    demonstratedSkills: [{ skill: 'Persistence' }],
  },
  reflection_card_status: 'confirmed',
  reflection_updated_at: '2026-08-01T00:00:00Z',
  reflection_card_generated_at: '2026-08-01T00:00:00Z',
};

function buildSupabase(options: { reflectionColumnsMissing?: boolean } = {}) {
  function evidenceBuilder(rows: Array<Record<string, unknown>>) {
    let selected = '';
    const builder: Record<string, unknown> = {
      select: (columns: string) => {
        selected = columns;
        return builder;
      },
      eq: () => builder,
      order: async () => {
        if (options.reflectionColumnsMissing && selected.includes('reflection')) {
          return { data: null, error: { code: '42703', message: 'column "reflection" does not exist' } };
        }
        // A real Postgres select only returns the requested columns — strip
        // reflection fields from the fixture when the mock is standing in
        // for the fallback (narrower) select, so the test proves the reader
        // actually re-queried without them rather than merely ignoring an
        // error.
        const REFLECTION_KEYS = [
          'reflection',
          'reflection_card',
          'reflection_card_status',
          'reflection_updated_at',
          'reflection_card_generated_at',
        ];
        const projected = selected.includes('reflection')
          ? rows
          : rows.map((row) =>
              Object.fromEntries(
                Object.entries(row).filter(([key]) => !REFLECTION_KEYS.includes(key)),
              ),
            );
        return { data: projected, error: null };
      },
    };
    return builder;
  }

  return {
    from: (table: string) => {
      if (table === 'student_profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {}, error: null }) }) }),
        };
      }
      if (table === 'student_achievements') return evidenceBuilder([ACHIEVEMENT_ROW]);
      if (table === 'student_activities') return evidenceBuilder([]);
      if (table === 'uploaded_documents') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  };
}

describe('loadCandidateReflection — reflection/Reflection Card columns', () => {
  it('reads an achievement’s reflection and confirmed Reflection Card', async () => {
    const record = await loadCandidateReflection(buildSupabase() as never, 'user-1');
    const achievement = record.reflection.achievements[0];
    expect(achievement?.reflection?.context).toBe('Entered a national competition.');
    expect(achievement?.reflectionCard?.story).toBe('Trained for months to qualify.');
    expect(achievement?.reflectionCard?.status).toBe('confirmed');
  });

  it('falls back to achievements without reflection when the migration has not run, rather than losing the achievement entirely', async () => {
    const record = await loadCandidateReflection(
      buildSupabase({ reflectionColumnsMissing: true }) as never,
      'user-1',
    );
    const achievement = record.reflection.achievements[0];
    expect(achievement?.title).toBe('National Mathematics Olympiad');
    expect(achievement?.reflection).toBeUndefined();
    expect(achievement?.reflectionCard).toBeUndefined();
  });
});
