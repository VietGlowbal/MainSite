import { PlannerDemoApp } from '@/features/planner-demo/ui';
import { isDemoState } from '@/features/planner-demo/domain';

/**
 * GlowBal Planner demo — spec §20. `?demo=` picks which of the eight
 * checkpoints (new/phase1/matching/paywall/strategy/profile/application/
 * ready) the planner opens on.
 *
 * `forceState` distinguishes "the URL explicitly asked for this checkpoint"
 * from "no param was given, default to new" — the two look identical here
 * (`initialState` is `'new'` either way) but need different behaviour in
 * `usePlannerDemo`: an explicit `?demo=` must always win over whatever a
 * previous visit left in localStorage, or every checkpoint link after the
 * first would render the leftover session instead of itself.
 */
export default async function CambridgeEngineeringPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo: raw } = await searchParams;
  const initialState = isDemoState(raw) ? raw : 'new';
  const forceState = isDemoState(raw);

  return <PlannerDemoApp initialState={initialState} forceState={forceState} />;
}
