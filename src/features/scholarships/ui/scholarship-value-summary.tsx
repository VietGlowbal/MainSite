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
  const model = providedModel ?? createScholarshipValueViewModel({ value, benefits, raw }, locale);
  return (
    <SharedScholarshipValueSummary
      model={model}
      compact={compact}
      showBreakdown={showBreakdown}
      showEvidence={showEvidence}
      className={className}
      fallbackAwardLabel={fallbackAwardLabel}
    />
  );
}

export type { BenefitComponent, NormalizedScholarshipBenefits, ScholarshipBenefitNormalizationInput, ScholarshipValueResult };
