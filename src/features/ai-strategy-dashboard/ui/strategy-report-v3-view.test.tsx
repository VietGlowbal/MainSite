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

  it('renders grounded V3 fields with the four-point factor scale', async () => {
    const dimension = (status: 'strong' | 'developing' | 'limited' | 'not_established') => ({
      status,
      statement: `${status} evidence`,
      evidenceIds: ['evidence-1'],
      targetSourceRefs: ['source:1'],
    });
    const report = {
      ...REPORT,
      strategicOverview: {
        ...REPORT.strategicOverview,
        currentPosition: {
          ...REPORT.strategicOverview.currentPosition,
          summary: 'Current position summary',
          unclearArea: { statement: 'Unclear area', basis: ['evidence-1'] },
          differentiatedPotential: { statement: 'Differentiated potential', evidenceIds: ['evidence-1'], metricIds: [] },
        },
      },
      profileDevelopmentStrategy: {
        ...REPORT.profileDevelopmentStrategy,
        areas: [
          {
            ...REPORT.profileDevelopmentStrategy.areas[0],
            status: 'build',
            developmentPlan: {
              gap: 'A specific evidence gap',
              possibleRoutes: [
                { title: 'Route one', rationale: 'Route one rationale' },
                { title: 'Route two', rationale: 'Route two rationale' },
              ],
              recommendedRoute: { title: 'Route one', rationale: 'Recommended rationale' },
              evidenceExpected: ['Evidence item one'],
            },
          },
          ...REPORT.profileDevelopmentStrategy.areas.slice(1),
        ],
        activityAnalyses: [{
          activityId: 'activity:1',
          title: 'Activity One',
          dimensions: {
            relevance: dimension('strong'),
            responsibility: dimension('developing'),
            depth: dimension('limited'),
            progression: dimension('not_established'),
            impact: dimension('strong'),
            evidence: dimension('developing'),
            reflection: dimension('limited'),
            futurePotential: dimension('not_established'),
          },
          classification: 'develop',
          diagnosis: 'Activity diagnosis',
          recommendedMove: 'Activity recommendation',
          evidenceIds: ['evidence-1'],
          targetSourceRefs: ['source:1'],
        }],
      },
      narrativeStrategy: {
        ...REPORT.narrativeStrategy,
        coreNarrativeDirection: {
          ...REPORT.narrativeStrategy.coreNarrativeDirection,
          actions: ['Action one'],
          capabilitiesDeveloped: ['Capability one'],
        },
        supportingThemes: [{ key: 'theme:1', title: 'Theme one', significance: 'Theme significance', evidenceIds: ['evidence-1'] }],
        narrativeTension: {
          type: 'action_impact_gap',
          observedGap: 'Observed gap',
          evidenceIds: ['evidence-1'],
          whyItMatters: 'Why it matters',
          possibleDirection: 'Possible direction',
        },
        narrativeOptions: [{
          key: 'narrative:1',
          title: 'Narrative option',
          centralIdea: 'Central idea text',
          whyItEmerges: 'Why it emerges text',
          supportingExperienceIds: ['activity:1', 'activity:2'],
          targetSourceRefs: ['source:1'],
          whatCouldStrengthenIt: 'Strengthening text',
          evaluation: {
            evidenceStrength: 'high',
            personalAuthenticity: 'high',
            programmeRelevance: 'medium',
            differentiation: 'medium',
            developmentPotential: 'high',
          },
          strategicFit: 'high',
        }],
      },
      evidenceIndex: [{ id: 'evidence-1', label: 'Evidence label' }],
      targetSourceIndex: [{ ref: 'source:1', label: 'Target source', title: null, url: null, kind: 'programme' }],
    } as unknown as StrategyReportV3;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ overrides: {} }) })));

    render(<StrategyReportV3View applicationId="application-1" report={report} />);

    await waitFor(() => expect(screen.getByText('Current position summary')).toBeInTheDocument());
    expect(screen.getByText('Current position summary')).toBeInTheDocument();
    expect(screen.getByText('A specific evidence gap')).toBeInTheDocument();
    expect(screen.getByText('Route one')).toBeInTheDocument();
    expect(screen.getByText('Theme significance')).toBeInTheDocument();
    expect(screen.getAllByText('• Evidence label').length).toBeGreaterThan(0);
    expect(screen.getByText('Central idea text')).toBeInTheDocument();
    expect(screen.getByText('Evidence Strength')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
    expect(screen.queryByText('4/5')).not.toBeInTheDocument();
    expect(screen.queryByText('strategy-priority::evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Skill mastery')).not.toBeInTheDocument();
  });
});
