import { redirect } from 'next/navigation';
import { AnalysisWorkspace } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — Stage 3, AI Analysis
 * (requirements.md Requirements 5-7).
 *
 * Ownership already enforced by the layout above this route; this page's own
 * check exists only to read `user.id` for the client workspace's fetches.
 */
export default async function StrategyAnalysisPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <AnalysisWorkspace
      applicationId={applicationId}
      improveHref={`/ai-strategy/${applicationId}/strategy/intro`}
    />
  );
}
