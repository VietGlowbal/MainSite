import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Stepper } from '@/shared/ui';
import { aiJourneySteps } from '@/features/apply/domain';
import { StrategyChrome } from '../ai-strategy/strategy-chrome';
import { DemoNav } from './demo-nav';

/**
 * THROWAWAY DEMO — the shell. Delete with the folder.
 *
 * The gate stays in this server component for the reason spelled out in
 * /dev/reflection: a `'use client'` route reads ENABLE_DEV_ROUTES from the
 * browser bundle, where a non-`NEXT_PUBLIC_` variable is undefined, and the page
 * would 404 regardless of the flag. Gating the layout covers every child route,
 * so no demo page has to remember to do it.
 *
 * `user={null}` throughout — the whole point is that this runs without a session.
 * StrategyChrome degrades to the signed-out nav, which is fine for a walkthrough.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    <StrategyChrome user={null} containerWidth="wide">
      <div className="flex flex-col gap-gb-4xl">
        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense fallback={<div className="h-gb-9xl" />}>
          <DemoNav />
        </Suspense>

        <Stepper
          steps={aiJourneySteps({ unlock: ['strategy'] })}
          currentIndex={3}
          label="AI strategy journey"
        />

        {children}
      </div>
    </StrategyChrome>
  );
}
