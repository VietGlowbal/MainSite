import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/navigation-session', () => ({
  notifyNavigationOnboardingCompleted: vi.fn(),
}));

vi.mock('@/components/site-navigation', () => ({
  SiteNavigation: () => null,
}));

vi.mock('@/lib/i18n', () => ({
  useT: () => (label: string) => label,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => {},
}));

import { OnboardingWizard } from '@/app/onboarding/onboarding-wizard';

const DRAFT_KEY = 'glowbal-onboarding-draft';

function writeDraft({
  standardized,
  support,
}: {
  standardized: string[];
  support: string;
}) {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      answers: {
        study_level: 'undergraduate',
        subjects: 'Technology',
        countries: 'Open to ideas',
        budget: 'Under $15k',
        campus: 'Flexible',
        academic: {
          curriculum: ['Vietnamese National Curriculum'],
          scales: { 'Vietnamese National Curriculum': '10-point scale' },
          grades: { 'Vietnamese National Curriculum': '8.5' },
        },
        tests: {
          english: ['None yet'],
          englishScores: {},
          standardized,
          standardizedScores: {},
        },
        support,
      },
    }),
  );
}

describe('OnboardingWizard completion gates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('requires an explicit standardized-test answer, including None yet', async () => {
    writeDraft({ standardized: [], support: 'Scholarships and funding' });
    render(<OnboardingWizard isSignedIn />);

    const testsStep = await screen.findByRole('button', { name: /Question 7/ });
    await waitFor(() => expect(testsStep).toBeEnabled());
    fireEvent.click(testsStep);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('does not complete until the final support question has an answer', async () => {
    writeDraft({ standardized: ['None yet'], support: '' });
    render(<OnboardingWizard isSignedIn />);

    const supportStep = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(supportStep).toBeEnabled());
    fireEvent.click(supportStep);

    expect(screen.getByRole('button', { name: 'Save & see matches' })).toBeDisabled();
  });
});
