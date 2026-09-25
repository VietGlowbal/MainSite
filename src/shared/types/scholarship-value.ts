/**
 * Renderer-facing scholarship value contract.
 *
 * This contract intentionally contains display data only. It keeps shared UI
 * independent from the scholarships feature while allowing server adapters to
 * supply the canonical, already-valued model.
 */
export type ScholarshipValueKind = 'exact' | 'mixed' | 'estimated' | 'unavailable';

export type ScholarshipValueEvidence = {
  sourceField: string;
  excerpt: string;
  sourceUrl: string | null;
};

export type ScholarshipValueBreakdownItem = {
  type: string;
  label: string;
  amountLabel: string | null;
  totalLabel: string | null;
  periodLabel: string | null;
  durationLabel: string | null;
  status: 'EXACT' | 'MIXED' | 'ESTIMATED' | 'UNAVAILABLE';
  sourceLabel: string | null;
  included: boolean;
  reason: string | null;
  evidence: readonly ScholarshipValueEvidence[];
};

export type ScholarshipValueViewModel = {
  coverageLabel: string | null;
  originalAwardLabel: string | null;
  totalValueLabel: string;
  totalValueKind: ScholarshipValueKind;
  totalValueStatusLabel: string | null;
  durationLabel: string | null;
  components: readonly ScholarshipValueBreakdownItem[];
  evidence: readonly ScholarshipValueEvidence[];
  sourceUrl: string | null;
  warnings: readonly string[];
  hasComparableValue: boolean;
};
