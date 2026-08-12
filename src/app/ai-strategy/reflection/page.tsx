import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reflectionFromProfile, type ReflectionProfileRow } from '@/features/apply/domain';
import { ReflectionChrome } from '../reflection-chrome';
import { ApplicationNavFromReturn } from './application-nav-from-return';
import { ReflectionAboutForm } from './reflection-about-form';

/**
 * Reflection step 1 of 2 — personal and study information.
 *
 * The values come back through `reflectionFromProfile`, so a student who has
 * already filled part of this in during onboarding sees it prefilled rather
 * than being asked twice.
 */
export default async function ReflectionAboutPage({
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

  const { data } = await supabase
    .from('student_profiles')
    .select(
      'nationality, current_qualification, study_level, target_subjects, preferred_countries, budget_range, funding_source, tuition_budget_usd, grades_summary, goals, study_motivation, target_intake',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  const initial = reflectionFromProfile((data ?? null) as ReflectionProfileRow | null);

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
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
          careerGoal: initial.careerGoal,
          studyMotivation: initial.studyMotivation,
          intake: initial.intake,
          customSubject: initial.customSubject,
          countryPreferenceFlexible: initial.countryPreferenceFlexible,
          otherEducation: initial.otherEducation,
          // Score provenance, so a returning student lands back in the mode
          // they used rather than staring at an empty converter beside a GPA
          // they never typed.
          gpaMethod: initial.gpaMethod,
          gpaSource: initial.gpaSource,
          ieltsMethod: initial.ieltsMethod,
          englishTest: initial.englishTest,
          englishTestScore: initial.englishTestScore,
          englishNotTaken: initial.englishNotTaken,
        }}
      />
    </ReflectionChrome>
  );
}
