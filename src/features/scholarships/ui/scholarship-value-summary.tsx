'use client';

import type { BenefitComponent, NormalizedScholarshipBenefits, ScholarshipBenefitNormalizationInput } from '../domain/benefit-types';
import type { ScholarshipValueResult } from '../domain/valuation';
import {
  createScholarshipValueViewModel,
  type ScholarshipValueFormattingInput,
  type ScholarshipValueViewModel,
} from '../domain/value-formatting';
import {
  SharedScholarshipValueSummary,
  type SharedScholarshipValueSummaryProps,
} from '@/shared/ui/scholarship-value-summary';
import { useLanguage } from '@/lib/i18n';

export type ScholarshipValueSummaryProps = ScholarshipValueFormattingInput & Omit<SharedScholarshipValueSummaryProps, 'model'> & {
  model?: ScholarshipValueViewModel | undefined;
  locale?: string;
};

export function ScholarshipValueSummary({
  model: providedModel,
  value,
  benefits,
  raw,
  compact = false,
  showBreakdown = false,
  showEvidence = false,
  locale = 'en-US',
  className = '',
  fallbackAwardLabel = null,
}: ScholarshipValueSummaryProps) {
  const { lang, t } = useLanguage();
  const numberLocale = locale === 'en-US' && lang === 'vi' ? 'vi-VN' : locale;
  const model = providedModel ?? createScholarshipValueViewModel({ value, benefits, raw }, numberLocale, t);
  return (
    <SharedScholarshipValueSummary
      model={model}
      compact={compact}
      showBreakdown={showBreakdown}
      showEvidence={showEvidence}
      className={className}
      fallbackAwardLabel={fallbackAwardLabel}
      t={t}
    />
  );
}

export type { BenefitComponent, NormalizedScholarshipBenefits, ScholarshipBenefitNormalizationInput, ScholarshipValueResult };
