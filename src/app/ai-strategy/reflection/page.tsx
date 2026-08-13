import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection } from '@/features/apply/api';
import { ReflectionChrome } from '../reflection-chrome';
import { ApplicationNavFromReturn } from './application-nav-from-return';
import { ReflectionAboutForm } from './reflection-about-form';
import { ConfirmedReflectionView } from './confirmed-reflection-view';

/**
 * Reflection step 1 of 2 — personal and study information.
 *
 * The values come back through `loadCandidateReflection`, so a student who
 * has already filled part of this in during onboarding sees it prefilled
 * rather than being asked twice.
 *
 * Once confirmed (Review & Confirm), this page stops rendering the editable
 * form — a confirmed record is locked, and showing the form here would let a
 * student change fields the PATCH route will now reject anyway. See
 * `ConfirmedReflectionView`.
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

  const { reflection: initial, confirmedAt } = await loadCandidateReflection(supabase, user.id);

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      {confirmedAt ? (
        <ConfirmedReflectionView values={initial} confirmedAt={confirmedAt} returnTo={returnTo} />
      ) : (
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
      )}
    </ReflectionChrome>
  );
}
