'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ConsultationPackage } from '../domain/consultation';

/**
 * The one piece of state two Home sections share: which package a Pricing CTA
 * picked, so the consultation form further down can pre-select it and pulse the
 * card (handoff §8 → §9).
 *
 * A context rather than a URL hash (`#contact?pkg=yearly`): the form is on the
 * same page, a hash change would push a history entry the visitor has to Back
 * through, and there is nothing worth sharing in a link. The provider wraps
 * `<main>` in the route; everything between the two sections stays a server
 * component, because a client provider passes its server-rendered children
 * straight through.
 */

/**
 * Scroll to the consultation form. `scrollIntoView` honours the section's
 * `scroll-mt`, so the heading clears the sticky nav, and unlike setting
 * `location.hash` it leaves no history entry. Instant under reduced motion — a
 * full-page glide is exactly what that setting asks not to happen.
 */
export function scrollToConsultation(): void {
  const target = document.getElementById('contact');
  if (target === null) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

export type PackageSelection = {
  readonly pkg: ConsultationPackage;
  /** Bumped on every pick, so choosing the same plan twice still re-flashes. */
  readonly nonce: number;
};

type HomeConsultationValue = {
  readonly selection: PackageSelection | null;
  readonly choosePackage: (pkg: ConsultationPackage) => void;
};

/** Outside a provider a Pricing CTA still scrolls — it just cannot pre-select. */
const FALLBACK: HomeConsultationValue = { selection: null, choosePackage: () => scrollToConsultation() };

const HomeConsultationContext = createContext<HomeConsultationValue | null>(null);

export function HomeConsultationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<PackageSelection | null>(null);

  const choosePackage = useCallback((pkg: ConsultationPackage) => {
    setSelection((current) => ({ pkg, nonce: (current?.nonce ?? 0) + 1 }));
    scrollToConsultation();
  }, []);

  const value = useMemo(() => ({ selection, choosePackage }), [selection, choosePackage]);
  return <HomeConsultationContext.Provider value={value}>{children}</HomeConsultationContext.Provider>;
}

export function useHomeConsultation(): HomeConsultationValue {
  return useContext(HomeConsultationContext) ?? FALLBACK;
}
