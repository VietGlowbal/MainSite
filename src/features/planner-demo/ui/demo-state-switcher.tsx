'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import { DEMO_STATES, type DemoState } from '../domain';

const LABEL: Record<DemoState, string> = {
  new: 'New',
  phase1: 'Phase 1',
  matching: 'Matching',
  paywall: 'Paywall',
  strategy: 'Strategy',
  profile: 'Profile',
  application: 'Application',
  ready: 'Ready',
};

/**
 * The floating dev control (spec §20) — lets a presenter jump between the
 * eight demo checkpoints (?demo=new|phase1|matching|paywall|strategy|
 * profile|application|ready) without re-clicking through the flow live.
 * Demo-only; not part of the product surface.
 */
export function DemoStateSwitcher({
  demoState,
  onSetState,
  onReset,
}: {
  demoState: DemoState;
  onSetState: (state: DemoState) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-gb-xl right-gb-xl z-[60] flex flex-col items-end gap-gb-md">
      {open ? (
        <div className="grid grid-cols-2 gap-gb-md rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-lg">
          <p className="col-span-2 px-gb-sm text-gb-xs font-semibold text-fg-muted">Demo state</p>
          {DEMO_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => onSetState(state)}
              className={`rounded-gb-md px-gb-lg py-gb-sm text-left text-gb-sm font-medium transition-colors ${
                state === demoState
                  ? 'bg-brand text-on-brand'
                  : 'text-fg-secondary hover:bg-surface-hover'
              }`}
            >
              {LABEL[state]}
            </button>
          ))}
          <Button variant="secondary-destructive" size="sm" onClick={onReset} className="col-span-2">
            Reset demo
          </Button>
        </div>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle demo controls"
        className="shadow-gb-lg"
      >
        ⚙️ Demo
      </Button>
    </div>
  );
}
