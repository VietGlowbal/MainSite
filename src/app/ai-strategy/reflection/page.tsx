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
/** The columns every deployment has. */
const BASE_COLUMNS =
  'nationality, current_qualification, study_level, target_subjects, preferred_countries, budget_range, funding_source, tuition_budget_usd, grades_summary, goals';

/**
 * The ones added by `supabase-reflection-questions.sql` and
 * `supabase-reflection-subject-motivations.sql`.
 *
 * ⚠️ SELECTING A COLUMN THAT DOES NOT EXIST FAILS THE WHOLE QUERY, not just
 * that column — so on a deployment where the migrations have not run yet, this
 * page would render the form with NOTHING prefilled and a student would be
 * asked their nationality and GPA again. The PATCH route already retries
 * without these columns for exactly this reason (see its `migrationMissing`
 * note); the read has to do the same or the write's care is wasted.
 */
const NEW_COLUMNS = 'study_motivation, subject_motivations, target_intake';

async function loadProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ReflectionProfileRow | null> {
  const full = await supabase
    .from('student_profiles')
    .select(`${BASE_COLUMNS}, ${NEW_COLUMNS}`)
    .eq('user_id', userId)
    .maybeSingle();

  if (!full.error) return (full.data ?? null) as ReflectionProfileRow | null;

  console.warn(
    '[reflection] could not read the newer profile columns — run supabase-reflection-questions.sql and supabase-reflection-subject-motivations.sql. Loading the rest.',
    full.error.message,
  );

  const base = await supabase
    .from('student_profiles')
    .select(BASE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  return (base.data ?? null) as ReflectionProfileRow | null;
}

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

  const data = await loadProfile(supabase, user.id);

  const initial = reflectionFromProfile(data);

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
          tuitionBudget: initial.tuitionBudget,
          careerGoal: initial.careerGoal,
          studyMotivation: initial.studyMotivation,
          subjectMotivations: initial.subjectMotivations,
          primaryMotivationSubject: initial.primaryMotivationSubject,
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
