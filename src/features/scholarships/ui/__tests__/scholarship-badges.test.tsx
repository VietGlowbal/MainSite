import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScholarshipBadges } from '../scholarship-badges';
import type { ScholarshipRecommendationResult } from '../../domain/recommendation';

const recommendation: ScholarshipRecommendationResult = {
  scholarshipId: 1,
  recommended: true,
  recommendationScore: 87,
  rank: 1,
  reasonCodes: ['target-country-match', 'exact-award-value'],
  reasonData: {
    eligibilityStatus: 'ELIGIBLE',
    fitStatus: 'SCORED',
    fitScore: 90,
    fitConfidence: 1,
    comparableValueScore: 1,
    valueScore: 1,
    valueAmount: 20_000,
    valueUpperBound: 20_000,
    valueCurrency: 'USD',
    valueStatus: 'EXACT',
    valueQualityScore: 1,
    evidenceConfidence: 'high',
    evidenceScore: 1,
    contributions: { fit: 0.5, value: 0.3, evidence: 0.2 },
    fitReasonCodes: [],
    missingSignals: [],
  },
  warnings: [],
  policyVersion: 'test-v1',
};

describe('ScholarshipBadges', () => {
  it('renders recommendation, popularity, and human-readable reasons without scores', () => {
    render(
      <ScholarshipBadges
        recommendation={recommendation}
        frequentlyPicked={{ count: 4, threshold: 3, isFrequentlyPicked: true }}
        showReasons
      />,
    );

    expect(screen.getByText('GlowBal Recommend')).toBeInTheDocument();
    expect(screen.getByText('Frequently-picked')).toBeInTheDocument();
    expect(screen.getByText('Target country match')).toBeInTheDocument();
    expect(screen.getByText('Exact award value')).toBeInTheDocument();
    expect(screen.queryByText('87')).not.toBeInTheDocument();
  });

  it('warns when eligibility is unknown without showing a recommendation badge', () => {
    render(<ScholarshipBadges eligibilityStatus="UNKNOWN" />);

    expect(screen.getByText('Eligibility needs verification')).toBeInTheDocument();
    expect(screen.queryByText('GlowBal Recommend')).not.toBeInTheDocument();
  });
});
