import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reflectionFromProfile, type ReflectionProfileRow } from '@/features/apply/domain';
import { ReflectionChrome } from '../reflection-chrome';
import { ReflectionAboutForm } from './reflection-about-form';

/**
 * Reflection step 1 of 2 — personal and study information.
 *
 * The values come back through `reflectionFromProfile`, so a student who has
 * already filled part of this in during onboarding sees it prefilled rather
 * than being asked twice.
 */
export default async function ReflectionAboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { data } = await supabase
    .from('student_profiles')
    .select(
      'nationality, current_qualification, study_level, target_subjects, preferred_countries, budget_range, funding_source, tuition_budget_usd, grades_summary',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  const initial = reflectionFromProfile((data ?? null) as ReflectionProfileRow | null);

  return (
    <ReflectionChrome user={user}>
      <ReflectionAboutForm
        initial={{
          highestEducation: initial.highestEducation,
          nationality: initial.nationality,
          gpa: initial.gpa,
          ielts: initial.ielts,
          majors: initial.majors,
          countries: initial.countries,
          intendedLevel: initial.intendedLevel,
          fundingSource: initial.fundingSource,
          budgetRange: initial.budgetRange,
          tuitionBudgetUsd: initial.tuitionBudgetUsd,
        }}
      />
    </ReflectionChrome>
  );
}
