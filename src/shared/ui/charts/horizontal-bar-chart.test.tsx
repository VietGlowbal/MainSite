import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HorizontalBarChart } from './horizontal-bar-chart';

describe('HorizontalBarChart', () => {
  it('renders one row per datum under a shared accessible name', () => {
    render(
      <HorizontalBarChart
        ariaLabel="Narrative identity signals"
        data={[
          { key: 'patternConsistency', label: 'Pattern consistency', value: 80 },
          { key: 'growthArc', label: 'Growth arc', value: null },
        ]}
      />,
    );

    expect(screen.getByRole('list', { name: 'Narrative identity signals' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
