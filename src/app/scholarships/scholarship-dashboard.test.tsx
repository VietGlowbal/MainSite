import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  useLanguage: () => ({ t: (value: string) => value }),
}));
vi.mock('@/shared/ui', () => ({
  GlowbalIcon: () => null,
}));
vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => undefined,
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

import { ScholarshipDashboard } from './scholarship-dashboard';

const application = {
  id: 'application-1',
  university_name: 'Test University',
  course_name: 'Test Course',
  degree_level: 'Master',
  subject: 'Computer Science',
  country: 'Canada',
  country_flag: '🇨🇦',
  intake: 'September 2027',
  deadline: null,
  status: 'draft',
};

function aiScholarship(name: string, amount: string) {
  return {
    name,
    provider: 'Test Provider',
    amount,
    currency: 'USD',
    coverage: 'Tuition',
    eligibility: 'Eligible students',
    deadline: '1 Jan 2027',
    applicationUrl: undefined,
    matchReason: 'Current match characterization',
    matchScore: 50,
    difficulty: 'easy' as const,
    courseApplicationId: application.id,
    isUniversitySpecific: false,
    type: 'merit',
  };
}

describe('current AI scholarship Amount sort behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the response order because the current Amount comparator returns zero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scholarships: [
          aiScholarship('Lower nominal award', '$1,000'),
          aiScholarship('Higher nominal award', '$99,000'),
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<ScholarshipDashboard applications={[application]} existingScholarships={[]} />);

    await user.click(screen.getByRole('button', { name: 'Find scholarships' }));
    await screen.findByRole('heading', { name: 'Lower nominal award' });

    await user.selectOptions(screen.getByRole('combobox'), 'amount');

    // Current bug characterization: selecting Amount does not compare amounts.
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Lower nominal award',
      'Higher nominal award',
    ]);
  });
});
