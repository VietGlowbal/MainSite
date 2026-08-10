import type { Phase } from '../domain';
import { PhaseAccordion } from './phase-accordion';

export function PhaseList({
  phases,
  onOpenTask,
  onUnlock,
}: {
  phases: readonly Phase[];
  onOpenTask: (taskId: string) => void;
  onUnlock: () => void;
}) {
  const phase1Complete = phases[0]?.status === 'complete';

  return (
    <div className="flex flex-col gap-gb-lg px-gb-xl">
      {phases.map((phase) => (
        <PhaseAccordion
          key={phase.id}
          phase={phase}
          defaultExpanded={phase.id === 'phase-1'}
          paywallReady={phase.id === 'phase-2' && phase1Complete}
          onOpenTask={onOpenTask}
          onUnlock={onUnlock}
        />
      ))}
    </div>
  );
}
