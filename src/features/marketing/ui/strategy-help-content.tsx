'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n';
import { ICONS, KitIcon } from '@/shared/ui';
import { flattenGuide, STRATEGY_GUIDE, stepIndexForPath } from '../domain/strategy-guide';
import { GuidePanel } from './strategy-guide';

export function StrategyHelpContent({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(() => stepIndexForPath(pathname));
  const flat = useMemo(() => flattenGuide(STRATEGY_GUIDE), []);
  return (
  <div className="flex h-[min(88vh,46rem)] flex-col">
      <div className="flex shrink-0 items-start justify-between gap-gb-lg px-gb-3xl pt-gb-3xl">
        <div className="flex flex-col">
          <p className="text-gb-sm font-semibold text-fg">{t('How GlowBal works')}</p>
          <p className="text-gb-xs text-fg-muted">
            Step {activeIndex + 1} of {flat.length}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-full text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.close} frame={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 p-gb-3xl">
        {/* `-mx-gb-3xl` cancels this block's own padding for the one
            element that wants the dialog's full width: the rule under the
            area cards. See `bleedClassName` on GuidePanel. */}
        <GuidePanel
          flat={flat}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          bleedClassName="-mx-gb-3xl"
        />
      </div>
    </div>
  );
}
