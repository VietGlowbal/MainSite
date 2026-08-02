import { notFound, redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../reflection-chrome';

/**
 * Shell for every `/ai-strategy/[applicationId]/*` page (the AI Strategy
 * Dashboard feature — see .kiro/specs/ai-strategy-dashboard/).
 *
 * Resolves the session and the ownership check exactly once, the same
 * decision Feature 2's design.md documents for the sibling CV/Statement
 * workspace: `/ai-strategy` ships its own chrome (nav-reveal.tsx suppresses
 * the app shell for this subtree), so every page under here needs it, and an
 * `applicationId` that is not this student's own must 404 rather than reveal
 * that it exists.
 *
 * Each page still re-reads its own slice of `course_applications` — this
 * layout does not thread data down via context, matching the same precedent.
 */
export default async function StrategyApplicationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy`)}`);

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, course_name')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  return (
    <ReflectionChrome user={user}>
      {/*
       * The context bar sits above every strategy page rather than inside each
       * one. These screens are reached through a redirect chain and then rarely
       * again — the reports especially — so the one thing they all needed was a
       * permanent statement of where you are and what else belongs to this
       * application. Mounting it here is also what stops six pages each
       * growing their own slightly different version.
       */}
      <div className="mb-gb-3xl">
        <ApplicationNav applicationId={applicationId} courseName={application.course_name} />
      </div>
      {children}
    </ReflectionChrome>
  );
}
