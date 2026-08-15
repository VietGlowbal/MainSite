import { describe, expect, it, vi } from 'vitest';
import {
  cvStrategySnapshotFromRow,
  loadLatestCvStrategySnapshot,
  type CvStrategyDatabase,
} from './cv-builder-strategy';

function directionOption(name: string) {
  return {
    name,
    identityFit: 9.7,
    evidenceStrength: 9.2,
    consistency: 9,
    differentiation: 9.4,
    futureAlignment: 10,
    scalability: 9.1,
    overall: 9.6,
  };
}

function strategyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    application_id: 'app-1',
    user_id: 'user-1',
    source_analysis_id: 'analysis-1',
    source_match_analysis_id: 'match-1',
    pdf_storage_path: null,
    created_at: '2026-08-08T00:00:00Z',
    direction_options: [
      directionOption('Business Analytics for Education'),
      directionOption('Education Entrepreneurship'),
    ],
    chosen_direction: 'Business Analytics for Education',
    chosen_direction_why: 'This is the strongest intersection of the evidence.',
    narrative: 'A coherent narrative grounded in the applicant record.',
    positioning_before: 'Student interested in many adjacent fields.',
    positioning_after: 'A focused applicant who combines research and product thinking.',
    positioning_rationale: 'The focused positioning is easier to evidence.',
    portfolio_evaluations: [
      {
        name: 'Education NGO Data Project',
        source: 'ai_proposed',
        strategicContribution: 'Strengthens the chosen direction.',
        recommendation: 'highly_recommended',
      },
      {
        name: 'Research portfolio',
        source: 'existing_activity',
        strategicContribution: 'Provides evidence of analytical depth.',
        recommendation: 'recommended',
      },
    ],
    differentiation_insight: 'Many applicants have generic projects.',
    differentiation_proposal: 'Build a public education analytics platform.',
    roadmap: {
      chosenStrategy: 'Become an education analytics applicant.',
      why: 'It connects identity, evidence, and intended study.',
      prioritize: ['Research', 'Product development'],
      avoid: ['Unrelated activities'],
      expectedPositioning: 'An applicant who combines analytics and research.',
      longTermNarrative: 'From identifying information gaps to building systems.',
    },
    ...overrides,
  };
}

describe('cvStrategySnapshotFromRow', () => {
  it('maps F7 data with immutable framework provenance and inherited source ids', () => {
    const snapshot = cvStrategySnapshotFromRow(strategyRow());

    expect(snapshot).toMatchObject({
      version: 1,
      recommendationId: 'rec-1',
      applicationId: 'app-1',
      sourceAnalysisId: 'analysis-1',
      sourceMatchAnalysisId: 'match-1',
      frameworks: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
      positioning: {
        before: 'Student interested in many adjacent fields.',
        after: 'A focused applicant who combines research and product thinking.',
      },
      differentiation: {
        insight: 'Many applicants have generic projects.',
        proposal: 'Build a public education analytics platform.',
      },
    });
    expect(snapshot).not.toHaveProperty('frameworkSources');
  });

  it('returns null for malformed snapshots', () => {
    expect(cvStrategySnapshotFromRow(strategyRow({ direction_options: 'bad' }))).toBeNull();
    expect(cvStrategySnapshotFromRow(strategyRow({ chosen_direction: 'not evaluated' }))).toBeNull();
    expect(cvStrategySnapshotFromRow(strategyRow({ id: null }))).toBeNull();
  });
});

describe('loadLatestCvStrategySnapshot', () => {
  it('filters by application and owner, then picks the newest valid matching row', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        strategyRow({ id: 'rec-newest-invalid', direction_options: 'bad' }),
        strategyRow({ id: 'rec-newest-other-app', application_id: 'app-other' }),
        strategyRow({ id: 'rec-older-valid', created_at: '2026-08-07T00:00:00Z' }),
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const ownerEq = vi.fn().mockReturnValue({ order });
    const applicationEq = vi.fn().mockReturnValue({ eq: ownerEq });
    const select = vi.fn().mockReturnValue({ eq: applicationEq });
    const from = vi.fn().mockReturnValue({ select });
    const snapshot = await loadLatestCvStrategySnapshot(
      { from } as unknown as CvStrategyDatabase,
      'app-1',
      'user-1',
    );

    expect(from).toHaveBeenCalledWith('application_strategy_recommendations');
    expect(select).toHaveBeenCalledWith('*');
    expect(applicationEq).toHaveBeenCalledWith('application_id', 'app-1');
    expect(ownerEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(20);
    expect(snapshot?.recommendationId).toBe('rec-older-valid');
  });
});
