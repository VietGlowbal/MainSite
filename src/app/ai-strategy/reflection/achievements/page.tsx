import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AchievementValues, ActivityValues } from '@/features/apply/domain';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReflectionEvidenceForm } from './reflection-evidence-form';

/**
 * Reflection step 2 of 2 — achievements and activities.
 *
 * Reads back whatever the student saved last time so the form is editable
 * rather than append-only; the API replaces the set wholesale on save, which is
 * only safe because the form always posts the complete list.
 *
 * Both selects tolerate the tables not existing yet: supabase-reflection.sql is
 * a migration this project has a habit of shipping code ahead of, and an
 * unapplied one should cost the student their saved rows, not the page.
 */
export default async function ReflectionAchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { return: returnTo } = await searchParams;

  const [achievementsResult, activitiesResult] = await Promise.all([
    supabase
      .from('student_achievements')
      .select('id, category, title, competition, organisation, level, year, detail, evidence_key')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('student_activities')
      .select('id, category, title, organisation, level, period, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ]);

  const achievements: AchievementValues[] = (achievementsResult.data ?? []).map((row) => ({
    id: row.id as string,
    category: row.category as AchievementValues['category'],
    title: (row.title as string) ?? '',
    ...(row.competition ? { competition: row.competition as string } : {}),
    ...(row.organisation ? { organisation: row.organisation as string } : {}),
    ...(row.level ? { level: row.level as string } : {}),
    ...(row.year != null ? { year: row.year as number } : {}),
    ...(row.detail ? { detail: row.detail as string } : {}),
    ...(row.evidence_key ? { evidenceKey: row.evidence_key as string } : {}),
  }));

  const activities: ActivityValues[] = (activitiesResult.data ?? []).map((row) => ({
    id: row.id as string,
    category: row.category as ActivityValues['category'],
    title: (row.title as string) ?? '',
    ...(row.organisation ? { organisation: row.organisation as string } : {}),
    ...(row.level ? { level: row.level as string } : {}),
    ...(row.period ? { period: row.period as string } : {}),
    ...(row.description ? { description: row.description as string } : {}),
  }));

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <ReflectionEvidenceForm
        initialAchievements={achievements}
        initialActivities={activities}
      />
    </ReflectionChrome>
  );
}
