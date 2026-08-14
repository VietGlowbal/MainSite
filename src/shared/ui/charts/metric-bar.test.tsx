import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricBar } from './metric-bar';

describe('MetricBar', () => {
  it('renders a percentage bar sized to the value', () => {
    render(<MetricBar label="Hard-skill specificity" value={72} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hard-skill specificity: 72%' })).toBeInTheDocument();
  });

  it('renders N/A and no fill for a null value, rather than a fabricated zero', () => {
    const { container } = render(<MetricBar label="Growth arc" value={null} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Growth arc: not available yet' })).toBeInTheDocument();
    expect(container.querySelector('.bg-brand')).not.toBeInTheDocument();
  });

  it('clamps out-of-range values into 0-100', () => {
    render(<MetricBar label="Overshoot" value={140} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows an optional caption', () => {
    render(<MetricBar label="Traceability" value={50} caption="Averaged across 3 evidence items." />);
    expect(screen.getByText('Averaged across 3 evidence items.')).toBeInTheDocument();
  });
});
