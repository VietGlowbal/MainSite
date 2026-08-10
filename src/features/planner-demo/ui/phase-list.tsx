import type { Phase } from '../domain';
import { PhaseAccordion } from './phase-accordion';

export function PhaseList({
  phases,
  expandedPhaseId,
  onExpandedChange,
  onOpenTask,
  onUnlock,
}: {
  phases: readonly Phase[];
  expandedPhaseId: string | null;
  onExpandedChange: (phaseId: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onUnlock: () => void;
}) {
  const phase1Complete = phases[0]?.status === 'complete';

  return (
    <div className="flex flex-col gap-gb-lg px-gb-xl lg:px-0">
      {phases.map((phase) => (
        <PhaseAccordion
          key={phase.id}
          phase={phase}
          expanded={phase.id === expandedPhaseId}
          onToggle={() => onExpandedChange(phase.id === expandedPhaseId ? null : phase.id)}
          paywallReady={phase.id === 'phase-2' && phase1Complete}
          onOpenTask={onOpenTask}
          onUnlock={onUnlock}
        />
      ))}
    </div>
  );
}
