import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationRequirement } from '@/lib/apply-types';
import {
  compileAssessments,
  compileDecisions,
  compilePlan,
  compilePlanningContext,
  type PlanningContextSources,
  type SourceProvenance,
} from '../domain';

vi.mock('./fetch-planning-context-sources', () => ({ fetchPlanningContextSources: vi.fn() }));

import { fetchPlanningContextSources } from './fetch-planning-context-sources';
import { getApplicationDecisions } from './get-application-decisions';
import { getApplicationPlan } from './get-application-plan';

const mockedFetchPlanningContextSources = vi.mocked(fetchPlanningContextSources);

const provenance: SourceProvenance = {
  id: 'match-1', generatedAt: '2026-08-20T00:00:00.000Z', inputHash: 'hash', promptVersion: 'f5',
  engineVersion: null, modelName: 'test', sourceAnalysisId: null, sourceMatchAnalysisId: null,
};

function requirement(status: ApplicationRequirement['studentStatus']): ApplicationRequirement {
  return {
    id: 'entry', applicationId: 'app-1', requirementType: 'academic', title: 'Entry requirement',
    requirementText: 'Official entry rule', isMandatory: true, studentStatus: status,
    sourceUrl: 'https://example.edu', sourceId: 'official', confidence: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function sources(
  requirementStatus: ApplicationRequirement['studentStatus'] | null,
  aiGaps: string[] = [],
): PlanningContextSources {
  return {
    applicationId: 'app-1', userId: 'user-1',
    programme: { applicationId: 'app-1', courseId: 'course-1', universityId: 1, universityName: 'Example University', courseName: 'Example Course', courseUrl: null, degreeLevel: null, subject: null, country: null, studyMode: null, intake: null, applicationMethod: null, applicationCode: null, applicationStatus: 'preparing' },
    requirements: requirementStatus === null ? [] : [requirement(requirementStatus)],
    stages: [], tasks: [], recommendations: [], deadlineCandidates: [], evidenceInventory: { documents: [] },
    profileEvaluation: null,
    programmeFit: aiGaps.length === 0 ? null : {
      data: {
        classification: 'match', confidence: 80, limitations: [],
        eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
        dimensions: {
          academicCompetitiveness: { status: 'assessed', score: 3, summary: 'Limited academic fit.', strengths: [], gaps: aiGaps, evidence: [] },
          personaAlignment: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
          financialFeasibility: { status: 'not_available', score: null, summary: 'Unavailable.', strengths: [], gaps: [], evidence: [] },
          careerDirection: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
          applicationReadiness: { status: 'assessed', score: 3, summary: 'Adequate.', strengths: [], gaps: [], evidence: [] },
        },
      }, improvementActions: [], provenance,
    },
    strategyRecommendation: null, userConstraints: [], diagnostics: [{ source: 'application_requirements', status: requirementStatus === null ? 'missing' : 'present' }],
  };
}

async function runtimePlan(input: PlanningContextSources) {
  mockedFetchPlanningContextSources.mockResolvedValue(input);
  return getApplicationPlan(undefined as never, 'app-1', 'user-1');
}

afterEach(() => vi.resetAllMocks());

describe('getApplicationPlan', () => {
  it('runs the Core 1 -> Core 2 -> Core 3 runtime chain once and preserves the hierarchy', async () => {
    const plan = await runtimePlan(sources('not_met', ['AI academic signal', 'AI narrative signal']));

    expect(mockedFetchPlanningContextSources).toHaveBeenCalledTimes(1);
    expect(plan).toMatchObject({
      readiness: 'requires_user_input',
      phases: [
        { id: 'phase:resolve_blockers', steps: [{ microSteps: [{ readiness: 'requires_enrichment' }] }] },
        { id: 'phase:confirm_choices', sourceProvenances: ['ai_generated'], steps: [{ microSteps: [{ readiness: 'requires_user_input' }] }] },
      ],
    });
    expect(plan.phases[0]?.sourceDecisionIds).toEqual(['decision:application-eligibility']);
    expect(plan.phases[1]?.sourceDecisionIds).toEqual(['decision:attention-focus']);
  });

  it('keeps unknown requirement information as an information-resolution scaffold', async () => {
    const plan = await runtimePlan(sources('unknown'));
    expect(plan.phases).toContainEqual(expect.objectContaining({ id: 'phase:resolve_information' }));
    expect(plan.phases.find((phase) => phase.id === 'phase:resolve_information')?.steps[0]?.microSteps[0]?.title).toContain('information required');
  });

  it('keeps user-choice gates unresolved at runtime', async () => {
    const plan = await runtimePlan(sources('met', ['AI academic signal', 'AI narrative signal']));
    const choicePhase = plan.phases.find((phase) => phase.id === 'phase:confirm_choices');
    expect(choicePhase?.steps[0]?.microSteps[0]).toMatchObject({ readiness: 'requires_user_input' });
    expect(JSON.stringify(choicePhase)).toContain('no option is selected automatically');
  });

  it('matches direct Core 1 -> Core 2 -> Core 3 compilation for the same source data', async () => {
    const input = sources('not_met', ['AI academic signal', 'AI narrative signal']);
    mockedFetchPlanningContextSources.mockResolvedValue(input);
    const direct = compilePlan(await getApplicationDecisions(undefined as never, 'app-1', 'user-1'));

    mockedFetchPlanningContextSources.mockClear();
    const runtime = await runtimePlan(input);
    expect(runtime).toEqual(direct);
    expect(mockedFetchPlanningContextSources).toHaveBeenCalledTimes(1);
  });

  it('returns a safe partial plan for empty application data', async () => {
    const plan = await runtimePlan(sources(null));
    expect(plan).toMatchObject({ readiness: 'requires_user_input' });
    expect(plan.phases).toContainEqual(expect.objectContaining({ id: 'phase:resolve_information' }));
  });

  it('has the same output as pure compilation and contains no execution state', async () => {
    const input = sources('not_met');
    const expected = compilePlan(compileDecisions(compileAssessments(compilePlanningContext(input))));
    const actual = await runtimePlan(input);
    expect(actual).toEqual(expected);
    for (const forbidden of ['"status"', 'deadline', 'completed', 'calendar', 'reminder', 'content_value']) {
      expect(JSON.stringify(actual)).not.toContain(forbidden);
    }
  });
});
