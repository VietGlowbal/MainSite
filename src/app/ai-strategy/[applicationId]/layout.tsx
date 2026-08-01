import { notFound, redirect } from 'next/navigation';
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
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  return <ReflectionChrome user={user}>{children}</ReflectionChrome>;
}
