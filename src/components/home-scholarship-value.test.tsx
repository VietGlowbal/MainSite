import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomeScholarshipPreview } from '@/features/marketing/ui/home-scholarship-preview';
import { normalizeScholarshipBenefits } from '@/features/scholarships/domain/benefit-normalization';
import { createScholarshipValueViewModel } from '@/features/scholarships/domain/value-formatting';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

describe('Home scholarship canonical value integration', () => {
  it.each(['en', 'vi'] as const)('keeps the canonical value in the new %s consultation card', (locale: Locale) => {
    const benefits = normalizeScholarshipBenefits({ coverage: '100% tuition', funding_type: ['full-ride'] });
    const model = createScholarshipValueViewModel(
      { benefits }, locale === 'vi' ? 'vi-VN' : 'en-US',
      (source, vars) => getLocaleText(locale, source, vars),
    );
    const consult = vi.fn();
    render(<HomeScholarshipPreview
      entries={[{
        id: 1, title: 'Verified scholarship', organization: 'University', href: '/scholarships',
        value: '100% Full-ride', coverage: 'Legacy amount must not replace canonical value',
        valueModel: model, kind: 'university', eligibility: 'Academic requirement',
      }]}
      total={1} locale={locale} onRequestConsultation={consult}
    />);
    expect(screen.getByText(model.coverageLabel!)).toBeVisible();
    expect(screen.getByText(model.totalValueLabel)).toBeVisible();
    expect(screen.queryByText('100% Full-ride')).toBeNull();
    expect(screen.queryByText('Legacy amount must not replace canonical value')).toBeNull();
    expect(screen.getByText('Academic requirement')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Verified scholarship/ }));
    expect(consult).toHaveBeenCalledOnce();
  });
});
