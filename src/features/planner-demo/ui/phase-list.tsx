import type { Phase } from '../domain';
import { PhaseAccordion } from './phase-accordion';

export function PhaseList({
  phases,
  expandedPhaseId,
  onExpandedChange,
  selectedTaskId,
  onSelectTask,
  onUnlock,
}: {
  phases: readonly Phase[];
  expandedPhaseId: string | null;
  onExpandedChange: (phaseId: string | null) => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onUnlock: () => void;
}) {
  const phase1Complete = phases[0]?.status === 'complete';

  return (
    <div className="flex flex-col gap-gb-lg">
      {phases.map((phase) => (
        <PhaseAccordion
          key={phase.id}
          phase={phase}
          expanded={phase.id === expandedPhaseId}
          onToggle={() => onExpandedChange(phase.id === expandedPhaseId ? null : phase.id)}
          paywallReady={phase.id === 'phase-2' && phase1Complete}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onUnlock={onUnlock}
        />
      ))}
    </div>
  );
}
