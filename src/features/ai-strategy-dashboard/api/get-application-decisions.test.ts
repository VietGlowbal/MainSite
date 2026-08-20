import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssessmentResult } from '../domain';
import { compileDecisions, compilePlanningContext } from '../domain';
import type { PlanningContextSources } from '../domain';

vi.mock('./get-application-assessments', () => ({ getApplicationAssessments: vi.fn() }));

import { getApplicationDecisions } from './get-application-decisions';
import { getApplicationAssessments } from './get-application-assessments';

const mockedGetApplicationAssessments = vi.mocked(getApplicationAssessments);

function assessment(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: 'requirement:entry', kind: 'requirement', subject: 'Entry requirement', currentState: 'met',
    status: 'meets', severity: 'info', title: 'Requirement met', summary: 'Mandatory requirement is recorded as met.',
    evidence: [], source: { kind: 'requirement', sourceId: 'entry', provenance: 'database_factual' },
    decisionBasis: 'hard_constraint', confidence: 1, mode: 'deterministic',
    ...overrides,
  };
}

function sources(): PlanningContextSources {
  return {
    applicationId: 'app-1', userId: 'user-1',
    programme: { applicationId: 'app-1', courseId: null, universityId: null, universityName: 'Example University', courseName: 'Example Course', courseUrl: null, degreeLevel: null, subject: null, country: null, studyMode: null, intake: null, applicationMethod: null, applicationCode: null, applicationStatus: 'preparing' },
    requirements: [], stages: [], tasks: [], recommendations: [], deadlineCandidates: [], evidenceInventory: { documents: [] },
    profileEvaluation: null, programmeFit: null, strategyRecommendation: null, userConstraints: [], diagnostics: [],
  };
}

function core1Result(assessments: AssessmentResult[]) {
  return { context: compilePlanningContext(sources()), assessments };
}

async function runtimeDecisions(assessments: AssessmentResult[]) {
  mockedGetApplicationAssessments.mockResolvedValue(core1Result(assessments));
  return getApplicationDecisions(undefined as never, 'app-1', 'user-1');
}

afterEach(() => vi.resetAllMocks());

describe('getApplicationDecisions', () => {
  it('composes Core 1 assessments into an available decision without refetching sources', async () => {
    const decisions = await runtimeDecisions([assessment()]);
    expect(mockedGetApplicationAssessments).toHaveBeenCalledTimes(1);
    expect(decisions.find((item) => item.id === 'decision:application-eligibility')).toMatchObject({ status: 'available' });
  });

  it('preserves a confirmed hard blocker at runtime', async () => {
    const decisions = await runtimeDecisions([assessment({ currentState: 'not_met', status: 'gap' })]);
    expect(decisions.find((item) => item.id === 'decision:application-eligibility')).toMatchObject({
      status: 'blocked', blockingAssessmentIds: ['requirement:entry'],
    });
  });

  it('preserves unknown critical information at runtime', async () => {
    const decisions = await runtimeDecisions([assessment({ currentState: 'unknown', status: 'unknown', decisionBasis: 'information_gap' })]);
    expect(decisions.find((item) => item.id === 'decision:application-eligibility')).toMatchObject({ status: 'needs_information' });
  });

  it('keeps F5 AI signals soft and preserves their provenance in decision reasons', async () => {
    const aiSignal = assessment({
      id: 'identified-gap:f5-academic', kind: 'identified_gap', subject: 'Academic competitiveness', currentState: 'gap identified',
      status: 'needs_attention', decisionBasis: 'soft_signal',
      source: { kind: 'identified_gap', sourceId: 'match-1', provenance: 'ai_generated' },
    });
    const decisions = await runtimeDecisions([assessment(), aiSignal]);
    expect(decisions.find((item) => item.id === 'decision:application-eligibility')?.status).toBe('available');
    expect(decisions.find((item) => item.id === 'decision:attention-focus')?.options[0]?.reasons[0]).toMatchObject({ provenance: 'ai_generated' });
  });

  it('matches direct deterministic compilation for the same Core 1 assessments', async () => {
    const assessments = [
      assessment(),
      assessment({ id: 'identified-gap:f5-academic', kind: 'identified_gap', status: 'needs_attention', decisionBasis: 'soft_signal', source: { kind: 'identified_gap', sourceId: 'match-1', provenance: 'ai_generated' } }),
    ];
    expect(await runtimeDecisions(assessments)).toEqual(compileDecisions(assessments));
  });

  it('handles empty or partial Core 1 assessment output without swallowing errors', async () => {
    const decisions = await runtimeDecisions([]);
    expect(decisions).toEqual(compileDecisions([]));
    expect(decisions).toContainEqual(expect.objectContaining({ id: 'decision:application-eligibility', status: 'needs_information' }));
  });
});
