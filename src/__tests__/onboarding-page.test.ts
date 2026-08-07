import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'student-1',
            email: 'student@example.com',
            user_metadata: {},
          },
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.profile }) }),
      }),
    }),
  }),
}));
vi.mock('@/app/onboarding/onboarding-wizard', () => ({ OnboardingWizard: () => null }));

import OnboardingPage from '@/app/onboarding/page';

describe('OnboardingPage', () => {
  it('redirects a completed student to User Profile instead of repeating the test', async () => {
    mocks.profile = {
      onboarding_completed: true,
      study_level: 'undergraduate',
      preferred_countries: ['Canada'],
    };

    await expect(OnboardingPage()).rejects.toThrow('redirect:/profile');
    expect(mocks.redirect).toHaveBeenCalledWith('/profile');
  });

  it('renders the questionnaire for an incomplete student', async () => {
    mocks.redirect.mockClear();
    mocks.profile = {
      onboarding_completed: false,
      study_level: 'undergraduate',
      preferred_countries: [],
    };

    const result = await OnboardingPage();

    expect(result).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
