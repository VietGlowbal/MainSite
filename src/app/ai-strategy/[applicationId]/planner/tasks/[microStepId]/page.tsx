import { notFound, redirect } from 'next/navigation';
import { CanonicalPlannerAccessError, getCanonicalApplicationPlanner } from '@/features/ai-strategy-dashboard/api';
import { CanonicalMicroStepDetail } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/** Canonical task detail. Archived, foreign, and legacy IDs resolve to 404. */
export default async function PlannerMicroStepPage({ params }: { params: Promise<{ applicationId: string; microStepId: string }> }) {
  const { applicationId, microStepId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  let planner;
  try {
    planner = await getCanonicalApplicationPlanner(supabase, applicationId, user.id);
  } catch (error) {
    if (error instanceof CanonicalPlannerAccessError) notFound();
    throw error;
  }
  if (!planner.plan || !planner.phases.some((phase) => phase.steps.some((step) => step.microSteps.some((task) => task.id === microStepId)))) notFound();
  return <CanonicalMicroStepDetail applicationId={applicationId} planner={planner} microStepId={microStepId} />;
}
