import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { candidateReadiness, reflectionFromProfile } from '@/features/apply/domain';
import { ReviewConfirmView } from './review-confirm-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * `readOnly` is what `applicationSubNav`'s "Reflections" entry links to once
 * an application has confirmed and generated its reports — see the file-level
 * comment on `reflection/confirm/page.tsx`. These tests guard the two things
 * reported broken live 2026-08-14: the page must actually render (not bounce
 * away) once confirmed, and its Continue button must go to a real,
 * state-aware destination rather than nothing at all.
 */
describe('ReviewConfirmView read-only mode', () => {
  const reflection = reflectionFromProfile(null);
  const readiness = candidateReadiness(reflection);

  it('shows a confirmed banner and Continue link, and hides the confirm panel', () => {
    render(
      <ReviewConfirmView
        reflection={reflection}
        documents={[]}
        readiness={readiness}
        readOnly
        confirmedAt="2026-08-13T00:00:00.000Z"
        continueHref="/ai-strategy/app-2/strategy/analysis/portrait"
      />,
    );

    expect(screen.getByText('Confirmed profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/ai-strategy/app-2/strategy/analysis/portrait',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm & Generate Reports' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('renders no Continue link when continueHref is absent', () => {
    render(
      <ReviewConfirmView
        reflection={reflection}
        documents={[]}
        readiness={readiness}
        readOnly
        confirmedAt="2026-08-13T00:00:00.000Z"
      />,
    );

    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('still shows the editable confirm panel when not read-only', () => {
    render(<ReviewConfirmView reflection={reflection} documents={[]} readiness={readiness} />);

    expect(screen.queryByText('Confirmed profile')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm & Generate Reports' }),
    ).toBeInTheDocument();
  });

  it('renders blocking issues with actionable Fix this links and preserved return context', () => {
    const unreadyReadiness = {
      blockingIssues: [
        {
          key: 'majors' as const,
          message: 'Please choose at least one subject of interest.',
        },
        {
          key: 'countries' as const,
          message: 'Please choose at least one destination.',
        },
      ],
      achievementsNeedingReview: 2,
      activitiesNeedingReview: 1,
      ready: false,
    };

    render(
      <ReviewConfirmView
        reflection={reflection}
        documents={[]}
        readiness={unreadyReadiness}
        returnTo="/apply/app-test"
      />,
    );

    expect(
      screen.getByText('A few things need your attention before you can confirm'),
    ).toBeInTheDocument();

    const fixLinks = screen.getAllByRole('link', { name: 'Fix this' });
    expect(fixLinks[0]).toHaveAttribute(
      'href',
      `/ai-strategy/reflection?return=${encodeURIComponent('/apply/app-test')}`,
    );
    expect(fixLinks[1]).toHaveAttribute(
      'href',
      `/ai-strategy/reflection?return=${encodeURIComponent('/apply/app-test')}`,
    );

    const reviewLinks = screen.getAllByRole('link', { name: 'Review' });
    expect(reviewLinks[0]).toHaveAttribute(
      'href',
      `/ai-strategy/reflection/achievements?return=${encodeURIComponent('/apply/app-test')}&review=1`,
    );
  });
});
