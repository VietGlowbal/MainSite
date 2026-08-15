import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmedAchievementsView } from './confirmed-achievements-view';

/**
 * Same escape-hatch guard as `confirmed-reflection-view.test.tsx` — this view
 * also has no other forward navigation, so a missing `continueHref` used to
 * strand a student opening a second application.
 */
describe('ConfirmedAchievementsView', () => {
  it('renders a Continue link to continueHref when provided', () => {
    render(
      <ConfirmedAchievementsView
        achievements={[]}
        activities={[]}
        documents={[]}
        confirmedAt="2026-08-13T00:00:00.000Z"
        continueHref="/ai-strategy/app-2/strategy/analysis"
      />,
    );

    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/ai-strategy/app-2/strategy/analysis',
    );
  });

  it('renders no Continue link when continueHref is absent', () => {
    render(
      <ConfirmedAchievementsView
        achievements={[]}
        activities={[]}
        documents={[]}
        confirmedAt="2026-08-13T00:00:00.000Z"
      />,
    );

    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  });
});
