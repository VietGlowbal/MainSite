import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aiJourneySteps } from '@/features/apply/domain';
import { Stepper } from '@/shared/ui';
import { StrategyChrome } from '../strategy-chrome';

/**
 * The shell every page under /ai-strategy/[applicationId] sits inside.
 *
 * WHY THE OWNERSHIP CHECK IS HERE. Six pages need the same three things: a
 * session, an application the caller owns, and the chrome. Doing it in the layout
 * means a new sub-page cannot forget it — the failure mode of per-page checks
 * being that the seventh page ships without one and nobody notices, because it
 * renders perfectly for the developer who owns the row they tested with.
 *
 * The pages still re-read their own slice. A layout in Next.js does not pass data
 * to children, and threading it through context would make every page a client
 * component. Two cheap indexed reads is the better trade.
 *
 * WHY THE GLOBAL STEPPER IS HERE TOO. It is the same on all six pages, and the
 * per-document indicators have to read as subordinate to it. Rendering it once,
 * above the page content, is what makes that ordering structural rather than a
 * thing each page remembers to do.
 */
export default async function ApplicationStrategyLayout({
  params,
  children,
}: {
  params: Promise<{ applicationId: string }>;
  children: React.ReactNode;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  /*
   * A non-uuid segment would make Postgres raise 22P02 rather than return no
   * rows, which surfaces as a 500 instead of the 404 it should be. Checked
   * before the query for the same reason requireApplicationOwner does.
   */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    notFound();
  }

  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  // notFound(), not a permission error: confirming the row exists tells the
  // caller something about another student's data.
  if (!application) notFound();

  return (
    <StrategyChrome user={user} containerWidth="wide">
      <div className="flex flex-col gap-gb-4xl">
        <Stepper
          /* Unlocked: the student is standing in this step, so drawing it as a
             paywall would contradict the page they are looking at. */
          steps={aiJourneySteps({ unlock: ['strategy'] })}
          currentIndex={3}
          label="Your Glowbal application journey"
        />
        {children}
      </div>
    </StrategyChrome>
  );
}
