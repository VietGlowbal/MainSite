'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';

/** One set of controls, with a measured slot left behind when it is pinned. */
export function SavedActionDock({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const slotRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    const dock = dockRef.current;
    if (!slot || !dock || typeof IntersectionObserver === 'undefined') return;

    // Native keyboard scrolling considers the whole viewport and cannot see
    // this overlay. Reveal a focused row control if the pinned surface covers
    // it. Scope the listener to this section so portals/navigation are untouched.
    const scope = slot.parentElement;
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || dock.contains(target) || dock.dataset.pinned !== 'true') return;
      const control = target.getBoundingClientRect();
      const surface = dock.getBoundingClientRect();
      if (control.bottom > surface.top && control.top < surface.bottom &&
        control.right > surface.left && control.left < surface.right) {
        // Explicit instant also overrides the site's smooth-scroll CSS.
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    };
    scope?.addEventListener('focusin', revealFocus);

    // The natural position keeps its height as controls wrap or selection changes.
    // Measuring the dock rather than the slot also works while it is fixed.
    const measure = () => {
      slot.style.setProperty('--saved-dock-width', `${slot.getBoundingClientRect().width}px`);
      // Reserve the same bottom inset as the fixed surface. At full slot
      // intersection, the natural and pinned surfaces then occupy the same
      // position instead of jumping down by the safe-area/token inset.
      const inset = Number.parseFloat(getComputedStyle(slot).paddingBottom) || 0;
      slot.style.height = `${dock.offsetHeight + inset}px`;
    };
    measure();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(dock);
    resize?.observe(slot);
    const intersection = new IntersectionObserver(([entry]) => {
      if (entry) setPinned(!entry.isIntersecting || entry.intersectionRatio < 1);
    }, { threshold: [0, 1] });
    intersection.observe(slot);
    return () => {
      intersection.disconnect();
      resize?.disconnect();
      scope?.removeEventListener('focusin', revealFocus);
      slot.style.height = '';
      slot.style.removeProperty('--saved-dock-width');
    };
  }, []);

  return (
    <div ref={slotRef} data-saved-action-slot className="pb-[max(var(--spacing-gb-xl),env(safe-area-inset-bottom))]">
      <div
        ref={dockRef}
        role="region"
        aria-label={t('Saved university actions')}
        data-pinned={pinned}
        className={`flex flex-wrap items-center justify-between gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-xl transition-shadow duration-200 motion-reduce:transition-none sm:p-gb-3xl ${
          pinned
            ? 'fixed inset-x-gb-xl bottom-[max(var(--spacing-gb-xl),env(safe-area-inset-bottom))] z-40 mx-auto w-[var(--saved-dock-width)] max-w-gb-desktop shadow-gb-lg'
            : 'relative'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
