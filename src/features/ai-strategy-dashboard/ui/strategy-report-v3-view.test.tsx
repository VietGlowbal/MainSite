import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StrategyReportV3 } from '@/lib/ai/strategy-v3/domain';
import { StrategyReportV3View } from './strategy-report-v3-view';

vi.mock('@/lib/i18n', () => ({ useLanguage: () => ({ t: (value: string) => value }) }));

const REPORT = {
  strategicOverview: {
    currentPosition: {
      profileStrength: { statement: 'Strength' },
      keyChallenge: { statement: 'Challenge' },
    },
    strategicOpportunity: { statement: 'Opportunity' },
    strategicGoal: { directionOfImprovement: 'Improve', communicationGoal: 'Communicate' },
    expectedOutcome: 'Outcome',
    topPriorities: [{
      key: 'strategy-priority::evidence',
      rank: 1,
      title: 'Priority',
      why: 'Why',
      suggestedDirection: 'Direction',
      interventionKind: 'add_evidence',
      factors: { impact: 3, relevance: 4, evidenceGap: 3, feasibility: 3, urgency: 2, rawPriority: 216 },
      basisRefs: [],
      evidenceIds: [],
      gapIds: [],
      requirementIds: [],
      targetSourceRefs: [],
    }],
  },
  profileDevelopmentStrategy: {
    areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => ({
      key: category,
      category,
      label: category,
      status: 'develop',
      diagnosis: 'Diagnosis',
      whyItMatters: 'Why it matters',
      suggestedDirection: 'Direction',
      evidenceIds: [],
      metricIds: [],
      requirementIds: [],
      targetSourceRefs: [],
    })),
    activityAnalyses: [],
  },
  narrativeStrategy: {
    coreNarrativeDirection: {
      originTrigger: null,
      recurringMotivation: null,
      actions: [],
      capabilitiesDeveloped: [],
      emergingDirection: null,
      insight: 'Not established',
      evidenceIds: [],
    },
    supportingThemes: [],
    narrativeTension: null,
    narrativeOptions: [],
  },
  strategicRoadmap: ['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({
    phaseKey,
    name: phaseKey,
    goal: 'Goal',
    keyActions: [],
    deliverables: [],
    successCriteria: [],
    estimatedTimeline: 'Now',
    linkedPriorityKeys: [],
  })),
} as unknown as StrategyReportV3;

afterEach(() => vi.unstubAllGlobals());

describe('StrategyReportV3View overrides', () => {
  it('rolls back a failed optimistic save and shows an explicit error', async () => {
    const fetchMock = vi.fn((_: string, init?: RequestInit) => init?.method === 'PUT'
      ? Promise.resolve({ ok: false })
      : Promise.resolve({ ok: true, json: async () => ({ overrides: {} }) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyReportV3View applicationId="application-1" report={REPORT} />);
    const input = screen.getByRole('textbox', { name: 'Priority' });
    fireEvent.change(input, { target: { value: 'Edited priority' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save this edit. Please try again.'));
    await waitFor(() => expect(input).toHaveValue('Priority'));
    expect(screen.queryByText('216')).not.toBeInTheDocument();
  });
});
