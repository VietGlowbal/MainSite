import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { normalizeScholarshipBenefits } from '../../domain/benefit-normalization';
import { calculateDisplayScholarshipValue } from '../../domain/value-formatting';
import { ScholarshipValueSummary } from '../scholarship-value-summary';

describe('ScholarshipValueSummary', () => {
  it('renders the same canonical value in compact and detail views', () => {
    const benefits = normalizeScholarshipBenefits({ coverage: '$20,000' });
    const value = calculateDisplayScholarshipValue(benefits);

    const { rerender } = render(<ScholarshipValueSummary benefits={benefits} value={value} compact />);
    expect(screen.getByLabelText('$20,000 total value — Exact')).toBeInTheDocument();

    rerender(<ScholarshipValueSummary benefits={benefits} value={value} showBreakdown showEvidence />);
    expect(screen.getByRole('heading', { name: 'Benefit breakdown' })).toBeInTheDocument();
    expect(screen.getByText('Exact')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Scholarship value' })).toBeInTheDocument();
  });

  it('exposes an accessible unavailable state', () => {
    const benefits = normalizeScholarshipBenefits({ coverage: '$5,000/month' });
    render(<ScholarshipValueSummary benefits={benefits} value={calculateDisplayScholarshipValue(benefits)} />);

    expect(screen.getByLabelText('Total value unavailable')).toBeInTheDocument();
    expect(screen.getByText('Value unavailable')).toBeInTheDocument();
  });
});
