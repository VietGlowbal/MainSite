'use client';

import { useState } from 'react';
import { DesignCosmos }   from '@/components/landing/design-cosmos';
import { DesignBloom }    from '@/components/landing/design-bloom';
import { DesignElectric } from '@/components/landing/design-electric';
import { DesignAurora }   from '@/components/landing/design-aurora';
import { DesignJourney }  from '@/components/landing/design-journey';
import type { WaitlistAction } from '@/lib/types';

export type { WaitlistAction };

type Design = { id: string; label: string; accent: string; bg: string };

const designs: Design[] = [
  { id: 'cosmos',   label: '🌌 Cosmos',   accent: 'rgba(56,189,248,0.85)',  bg: '#050c1a' },
  { id: 'bloom',    label: '🌸 Bloom',    accent: 'rgba(255,77,140,0.85)',  bg: '#fffcf9' },
  { id: 'electric', label: '⚡ Electric', accent: 'rgba(255,0,102,0.85)',   bg: '#060606' },
  { id: 'aurora',   label: '🌈 Aurora',   accent: 'rgba(0,240,160,0.85)',   bg: '#0b0820' },
  { id: 'journey',  label: '🧭 Journey',  accent: 'rgba(186,230,253,0.85)', bg: '#0d1117' },
];

export function LandingShowcase({ action }: { action: WaitlistAction }) {
  const [active, setActive] = useState('cosmos');
  const current = designs.find((d) => d.id === active) ?? designs[0];

  return (
    <>
      {/* Design switcher — sticky bar */}
      <div
        className="sticky top-[57px] z-40 flex items-center justify-center gap-1 px-4 py-2.5 backdrop-blur-xl"
        style={{ background: 'rgba(10,10,20,0.72)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="mr-2 hidden text-[.65rem] font-bold uppercase tracking-[.2em] text-white/35 sm:block">
          Design
        </span>
        {designs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => { setActive(d.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
            style={
              active === d.id
                ? { background: d.accent, color: '#000', boxShadow: `0 0 16px ${d.accent}` }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Active design — key forces full remount on switch so GSAP re-runs */}
      <div key={active}>
        {active === 'cosmos'   && <DesignCosmos   action={action} />}
        {active === 'bloom'    && <DesignBloom     action={action} />}
        {active === 'electric' && <DesignElectric  action={action} />}
        {active === 'aurora'   && <DesignAurora    action={action} />}
        {active === 'journey'  && <DesignJourney   action={action} />}
      </div>
    </>
  );
}
