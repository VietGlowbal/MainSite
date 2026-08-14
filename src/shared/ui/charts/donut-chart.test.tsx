import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DonutChart } from './donut-chart';

describe('DonutChart', () => {
  it('renders a legend item per non-zero segment plus the raw counts', () => {
    render(
      <DonutChart
        ariaLabel="Evidence verification"
        segments={[
          { key: 'verified', label: 'Verified', value: 3 },
          { key: 'attributable', label: 'Attributable', value: 2 },
          { key: 'stated', label: 'Stated', value: 0 },
        ]}
      />,
    );

    expect(screen.getByText('Verified: 3')).toBeInTheDocument();
    expect(screen.getByText('Attributable: 2')).toBeInTheDocument();
    // A zero-count category still gets a legend row (an honest zero, not hidden) —
    // just no visible arc, which the "no evidence" test below covers separately.
    expect(screen.getByText('Stated: 0')).toBeInTheDocument();
  });

  it('shows a plain "no evidence" caption instead of a misleading circle when every segment is zero', () => {
    render(
      <DonutChart
        ariaLabel="Evidence verification"
        segments={[
          { key: 'verified', label: 'Verified', value: 0 },
          { key: 'attributable', label: 'Attributable', value: 0 },
        ]}
      />,
    );

    expect(screen.getByText('No evidence recorded yet.')).toBeInTheDocument();
  });

  it('renders an optional center label', () => {
    render(
      <DonutChart
        ariaLabel="Evidence verification"
        centerLabel="5 items"
        segments={[{ key: 'verified', label: 'Verified', value: 5 }]}
      />,
    );

    expect(screen.getByText('5 items')).toBeInTheDocument();
  });
});
