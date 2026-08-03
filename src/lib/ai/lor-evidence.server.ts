import type { LorStrategyInput } from '@/lib/ai/lor';
import { createClient } from '@/lib/supabase/server';

type EvidenceRow = Record<string, unknown> & { id: string };

export async function loadLorEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  selected: LorStrategyInput['observedEvidence'],
) {
  const activityIds = selected.filter(({ kind }) => kind === 'activity').map(({ id }) => id);
  const achievementIds = selected
    .filter(({ kind }) => kind === 'achievement')
    .map(({ id }) => id);

  const [activitiesResult, achievementsResult] = await Promise.all([
    activityIds.length
      ? supabase
          .from('student_activities')
          .select('id, category, title, organisation, level, period, description')
          .eq('user_id', userId)
          .in('id', activityIds)
      : Promise.resolve({ data: [], error: null }),
    achievementIds.length
      ? supabase
          .from('student_achievements')
          .select('id, category, title, competition, organisation, level, year, detail')
          .eq('user_id', userId)
          .in('id', achievementIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (activitiesResult.error || achievementsResult.error) return null;

  const activities = (activitiesResult.data ?? []) as EvidenceRow[];
  const achievements = (achievementsResult.data ?? []) as EvidenceRow[];
  if (activities.length + achievements.length !== selected.length) return null;

  return [
    ...activities.map((row) => ({ reference: `activity:${row.id}`, ...row })),
    ...achievements.map((row) => ({ reference: `achievement:${row.id}`, ...row })),
  ];
}
