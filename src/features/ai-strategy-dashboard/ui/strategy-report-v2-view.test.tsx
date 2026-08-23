import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StrategyReportV2 } from '../domain';
import { StrategyReportV2View } from './strategy-report-v2-view';

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock('@/lib/i18n', () => ({ useLanguage: () => ({ t: (value: string) => value }) }));

const REPORT: StrategyReportV2 = {
  strategicOverview: {
    currentPosition: { profile: 'Profile', keyStrength: 'Strength', biggestChallenge: 'Challenge' },
    strategicGoal: { primaryObjective: 'Objective', positioning: 'Positioning' },
    topPriorities: ['Priority one'],
    expectedOutcome: 'Outcome',
  },
  priorityTable: [
    { key: 'priority-one', title: 'Priority one', currentSituation: 'Current', whyItMatters: 'Why', recommendedActions: ['Act'], expectedImpact: 'Impact', level: 'critical' },
    { key: 'priority-two', title: 'Priority two', currentSituation: 'Current', whyItMatters: 'Why', recommendedActions: ['Act'], expectedImpact: 'Impact', level: 'high' },
  ],
  profileDevelopmentStrategy: {
    academic: { currentStatus: 'Current', gap: 'Gap', strategicFocus: 'Focus', expectedOutcome: 'Outcome' },
    experience: { currentStatus: 'Current', gap: 'Gap', strategicFocus: 'Focus', expectedOutcome: 'Outcome' },
    differentiation: { currentAdvantage: 'Advantage', uniqueness: 'Unique', amplifyHow: 'Amplify', desiredPerception: 'Perception' },
  },
  narrativeStrategy: {
    coreNarrative: { centralStory: 'Story', supportingEvidence: ['Evidence'], admissionsValue: 'Value' },
    themes: [{ key: 'theme-one', title: 'Theme', rationale: 'Rationale', evidence: ['Evidence'] }],
    consistencyCheck: { supports: 'Supports', feelsDisconnected: 'Disconnected', emphasise: 'Emphasise', supportingRole: 'Role' },
  },
  executionRoadmap: {
    phases: [{ phaseKey: 'phase-one', name: 'Phase one', objective: 'Objective', keyActions: ['Action'], deliverables: [{ key: 'deliverable-one', label: 'Deliverable' }], successCriteria: ['Done'], timeline: 'This month' }],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('StrategyReportV2View Planner handoff', () => {
  it('links directly to the canonical Planner without calling the legacy roadmap endpoint', () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ overrides: {} }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyReportV2View applicationId={'application-1'} report={REPORT} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to Planner' }));

    expect(routerPush).toHaveBeenCalledWith('/ai-strategy/application-1/planner');
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/applications/application-1/strategy/roadmap-tasks',
      expect.anything(),
    );
  });
});
