import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerIdentity } from '@/server/auth/server-identity';
import { getStrategyOverview } from '@/features/application-strategy/api';
import { StrategyOverviewView } from '@/features/application-strategy/ui';
import { getUniversityQueries } from '@/features/universities/api';
import { trackApplicationEvent } from '@/lib/analytics/track';

export const metadata: Metadata = {
  title: 'Application Strategy | GlowBal',
  description: 'Prepare your CV and personal statement for this application.',
};

/**
 * /ai-strategy/[applicationId] — the Application Strategy overview.
 *
 * The layout above has already established the session and ownership, so this
 * reads its own slice and renders. It re-reads the application rather than
 * receiving it because a Next.js layout cannot pass data to a page, and putting
 * it in context would make the whole subtree client-side.
 *
 * All the derivation — statuses, which card is next, where each card goes — is
 * done by `getStrategyOverview`, which has the raw versions and section counts in
 * hand. This page picks nothing.
 */
export default async function ApplicationStrategyPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, university_id, university_name, course_name, degree_level, deadline, status')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  const logoUrl = await fetchLogo(application.university_id as number | null);

  const data = await getStrategyOverview(supabase, {
    userId: user.id,
    applicationId,
    application,
    universityLogoUrl: logoUrl,
  });

  // Never throws; an analytics failure must not fail the page render.
  await trackApplicationEvent({
    supabase,
    applicationId,
    userId: user.id,
    eventType: 'strategy_opened',
    metadata: { cvStatus: data.cv.status, statementStatus: data.statement.status },
  });

  return <StrategyOverviewView data={data} />;
}

/**
 * The university crest, when there is one.
 *
 * Same rule as the applications list: `course_applications` carries only a
 * nullable `university_id`, and rows imported straight from a course URL have
 * none. `Avatar` renders initials when it misses rather than a broken image box.
 */
async function fetchLogo(universityId: number | null): Promise<string | null> {
  if (universityId == null) return null;
  const [uni] = await getUniversityQueries().getByIds([universityId]);
  return uni?.logo_url ?? null;
}
