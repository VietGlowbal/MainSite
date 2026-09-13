import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { AchievementsForm } from '../achievements-form';

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { return: returnParam } = await searchParams;
  const [{ data: profile }, { returnTo, applicationLabel }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('skills')
      .eq('user_id', user.id)
      .maybeSingle(),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  return (
    <ProfileSectionShell
      title="Achievements & skills"
      description="Keep evidence in one canonical place, then maintain skills on your profile."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <div className="flex flex-col gap-gb-3xl">
        <section className="rounded-gb-lg border border-line bg-surface p-gb-xl">
          <h2 className="text-gb-lg font-semibold text-fg">Achievements and activities</h2>
          <p className="mt-gb-sm text-gb-sm text-fg-tertiary">
            Awards, activities, work evidence and reflections are managed together so applications and reports use the same facts.
          </p>
          <Link
            href={`/ai-strategy/reflection/achievements?return=${encodeURIComponent(returnTo ?? '/profile/achievements')}`}
            className="mt-gb-lg inline-flex text-gb-sm font-semibold text-fg-brand hover:underline"
          >
            Manage achievements and activities
          </Link>
        </section>
        <AchievementsForm
          userId={user.id}
          initialSkills={profile?.skills ?? []}
          returnTo={returnTo}
          updatedLabel="Skills"
        />
      </div>
    </ProfileSectionShell>
  );
}
