import { PlannerDemoApp } from '@/features/planner-demo/ui';
import { isDemoState } from '@/features/planner-demo/domain';

/**
 * GlowBal Planner demo — spec §4/§12. `?state=` picks which of the four
 * snapshots (new / progress / paywall / paid) the planner opens on; anything
 * else (or a returning visitor with saved localStorage progress) falls back
 * to `new` here and is corrected client-side by usePlannerDemo.
 */
export default async function CambridgeEngineeringPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state: raw } = await searchParams;
  const initialState = isDemoState(raw) ? raw : 'new';

  return <PlannerDemoApp initialState={initialState} />;
}
