import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reflectionFromProfile } from '@/features/apply/domain';
import { ConfirmedReflectionView } from './confirmed-reflection-view';

/**
 * Landing on this read-only view has no other forward navigation at all —
 * see the file-level comment on `ConfirmedReflectionView` for why a missing
 * `continueHref` used to strand a student opening a second application.
 * These tests only guard that the escape hatch renders/doesn't render
 * correctly; the reporting fields themselves are unit-tested by
 * `reflection.test.ts`.
 */
describe('ConfirmedReflectionView', () => {
  const values = reflectionFromProfile(null);

  it('renders a Continue link to continueHref when provided', () => {
    render(
      <ConfirmedReflectionView
        values={values}
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
    render(<ConfirmedReflectionView values={values} confirmedAt="2026-08-13T00:00:00.000Z" />);

    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  });
});
