import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: {
    personalSummaryComplete: false,
    achievementsComplete: false,
    personalReflectionComplete: false,
    candidateConfirmed: false,
    aiAnalysisComplete: false,
    introSeen: false,
    strategyComplete: false,
  },
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'student-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { course_name: 'Computer Science', university_name: 'Example University' },
            }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock('@/features/ai-strategy-dashboard/api', () => ({
  fetchOnboardingState: async () => mocks.state,
}));
vi.mock('@/features/ai-strategy-dashboard/ui', () => ({
  StrategyHome: () => null,
}));

import StrategyHomePage from './page';

/** `StrategyHomePage` isn't rendered through React here — it's called directly,
 * so the result is the raw `<StrategyHome ... />` element; read `startHref`
 * straight off its props rather than needing React to actually mount it. */
function startHrefOf(element: unknown): string {
  return (element as { props: { startHref: string } }).props.startHref;
}

/**
 * A student who already confirmed candidate information on an EARLIER
 * application (`candidateConfirmed` is a global flag — see `onboarding.ts`)
 * used to have this page's CTA hardcoded to `'personal-summary'` regardless,
 * which routes into the confirmed, read-only reflection view — a screen with
 * no forward navigation. That made a second application's onboarding an
 * unrecoverable dead end. The CTA must instead follow `nextOnboardingStep`.
 */
describe('StrategyHomePage', () => {
  it('sends a not-yet-confirmed student through reflections first, same as before', async () => {
    mocks.state = {
      personalSummaryComplete: false,
      achievementsComplete: false,
      personalReflectionComplete: false,
      candidateConfirmed: false,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    };

    const result = await StrategyHomePage({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(startHrefOf(result)).toContain('/ai-strategy/reflection?return=');
  });

  it('sends an already-confirmed student (from an earlier application) straight to analysis, not back into the dead-end confirmed view', async () => {
    mocks.state = {
      personalSummaryComplete: true,
      achievementsComplete: true,
      personalReflectionComplete: true,
      candidateConfirmed: true,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    };

    const result = await StrategyHomePage({ params: Promise.resolve({ applicationId: 'app-2' }) });

    expect(startHrefOf(result)).toBe('/ai-strategy/app-2/strategy/analysis');
  });

  it('sends a student who finished achievements but not Personal Reflection to the Personal Reflection step', async () => {
    mocks.state = {
      personalSummaryComplete: true,
      achievementsComplete: true,
      personalReflectionComplete: false,
      candidateConfirmed: false,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    };

    const result = await StrategyHomePage({ params: Promise.resolve({ applicationId: 'app-4' }) });

    expect(startHrefOf(result)).toContain('/ai-strategy/reflection/personal?return=');
  });

  it('sends a student who finished reflections but has not confirmed yet to Review & Confirm', async () => {
    mocks.state = {
      personalSummaryComplete: true,
      achievementsComplete: true,
      personalReflectionComplete: true,
      candidateConfirmed: false,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    };

    const result = await StrategyHomePage({ params: Promise.resolve({ applicationId: 'app-3' }) });

    expect(startHrefOf(result)).toContain('/ai-strategy/reflection/confirm?return=');
  });
});
