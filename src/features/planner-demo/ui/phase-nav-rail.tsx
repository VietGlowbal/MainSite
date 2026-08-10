'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import type { Phase } from '../domain';

/**
 * Desktop-only phase navigation (`lg:` and up — spec pivot: "add a real
 * desktop shell"). Clicking a phase both expands it (same `expandedPhaseId`
 * state the mobile accordions use — there is one source of truth for which
 * phase is open, not a separate desktop copy) and scrolls it into view, so
 * the rail and the roadmap below never disagree about what's open.
 */
export function PhaseNavRail({
  phases,
  expandedPhaseId,
  onSelect,
}: {
  phases: readonly Phase[];
  expandedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
}) {
  function handleSelect(phaseId: string) {
    onSelect(phaseId);
    document.getElementById(phaseId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav aria-label="Phases" className="sticky top-gb-7xl flex flex-col gap-gb-xs">
      {phases.map((phase) => {
        const active = phase.id === expandedPhaseId;
        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => handleSelect(phase.id)}
            aria-current={active ? 'true' : undefined}
            className={`flex items-center gap-gb-md rounded-gb-lg px-gb-lg py-gb-md text-left text-gb-sm transition-colors ${
              active ? 'bg-brand-subtle font-semibold text-fg-brand' : 'text-fg-tertiary hover:bg-surface-hover'
            }`}
          >
            {phase.status === 'complete' ? (
              <span className="flex size-[18px] shrink-0 items-center justify-center text-on-tier-safe">
                <KitIcon art={ICONS.checkCircle} frame={18} />
              </span>
            ) : phase.status === 'locked' ? (
              <span className="w-[18px] shrink-0 text-center text-gb-xs">🔒</span>
            ) : (
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-gb-full text-[10px] font-semibold ${
                  active ? 'bg-brand text-on-brand' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                {phase.number}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{phase.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
