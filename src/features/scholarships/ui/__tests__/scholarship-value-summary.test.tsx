import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { normalizeScholarshipBenefits } from '../../domain/benefit-normalization';
import { calculateDisplayScholarshipValue, createScholarshipValueViewModel } from '../../domain/value-formatting';
import { ScholarshipValueSummary } from '../scholarship-value-summary';
import { SharedScholarshipValueSummary } from '@/shared/ui/scholarship-value-summary';
import { SCHOLARSHIP_TRANSLATIONS } from '@/lib/i18n-scholarships';

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

  it('does not render an unsafe evidence URL as an anchor', () => {
    const benefits = normalizeScholarshipBenefits({
      coverage: '$5,000',
      sourceUrl: 'javascript:alert(1)',
    });
    const value = calculateDisplayScholarshipValue(benefits);

    render(<ScholarshipValueSummary benefits={benefits} value={value} showEvidence />);

    expect(screen.queryByRole('link', { name: 'Source' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Official scholarship source' })).not.toBeInTheDocument();
  });

  it('localizes shared value labels through the scholarship catalogue', () => {
    const benefits = normalizeScholarshipBenefits({ coverage: '50% tuition' });
    const model = createScholarshipValueViewModel(
      { benefits, value: calculateDisplayScholarshipValue(benefits) },
      'vi-VN',
      (source, vars) => {
        const translated = SCHOLARSHIP_TRANSLATIONS[source] ?? source;
        return vars
          ? translated.replace(/\{(\w+)\}/g, (_, key) => key in vars ? String(vars[key]) : `{${key}}`)
          : translated;
      },
    );

    render(
      <SharedScholarshipValueSummary
        model={model}
        showBreakdown
        t={(source) => SCHOLARSHIP_TRANSLATIONS[source] ?? source}
      />,
    );

    expect(screen.getByRole('region', { name: 'Giá trị học bổng' })).toBeInTheDocument();
    expect(screen.getByText('Phân tích quyền lợi')).toBeInTheDocument();
    expect(screen.getByText('50% học phí')).toBeInTheDocument();
  });
});
