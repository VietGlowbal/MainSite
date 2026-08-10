import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

/**
 * GlowBal Planner demo — gated the same way as /demo-throwaway (see its
 * layout.tsx for why the check lives in a server component): unlinked from
 * production navigation, no indexing, and reachable in prod only with
 * ENABLE_DEV_ROUTES=1. No production writes — see the hook in
 * src/features/planner-demo/hooks, which only ever touches localStorage.
 */
export const metadata: Metadata = {
  title: 'GlowBal Planner — demo',
  robots: { index: false, follow: false },
};

export default function PlannerDemoLayout({ children }: { children: React.ReactNode }) {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return <div className="gb-page-full-bleed bg-surface">{children}</div>;
}
