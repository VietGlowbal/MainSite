import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RadarChart } from './radar-chart';

describe('RadarChart', () => {
  it('renders the polygon plus an accessible legend with exact values', () => {
    const { container } = render(
      <RadarChart
        ariaLabel="Competency and evidence profile"
        data={[
          { key: 'hard', label: 'Hard-skill specificity', value: 60 },
          { key: 'soft', label: 'Soft-skill specificity', value: 40 },
          { key: 'meta', label: 'Meta-skill / self-awareness', value: null },
        ]}
      />,
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Competency and evidence profile' })).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('falls back to the legend only (no polygon) with fewer than 3 axes', () => {
    const { container } = render(
      <RadarChart
        ariaLabel="Two axes only"
        data={[
          { key: 'a', label: 'A', value: 50 },
          { key: 'b', label: 'B', value: 50 },
        ]}
      />,
    );

    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Two axes only' })).toBeInTheDocument();
  });
});
