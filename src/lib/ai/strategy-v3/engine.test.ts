import { describe, expect, it, vi } from 'vitest';
import type { StrategyInputContext } from './context';
import {
  calculateStrategyPriorityFactors,
  generateStrategyReportV3,
  selectTopPriorities,
  type StrategyInterventionCandidate,
} from './engine';

const mocks = vi.hoisted(() => ({ openAiJsonCompletion: vi.fn() }));
vi.mock('@/lib/ai/openai-client', () => ({ openAiJsonCompletion: mocks.openAiJsonCompletion }));

function context(overrides: Partial<StrategyInputContext> = {}): StrategyInputContext {
  return {
    lineage: {
      applicationId: 'app-1', personalReportVersionId: 'pr-1', personalReportInputHash: 'pr-hash',
      sourceAnalysisVersionId: 'analysis-1', confirmedSnapshotId: 'snap-1', matchingReportId: 'match-1',
      matchingInputHash: 'match-hash', matchingContractVersion: 'matching-report-v3', matchingEngineVersion: 'matching-v3',
      targetProfileVersionId: 'tp-1', selectedScholarshipVersionId: null,
    },
    applicant: { personalReport: {}, sourceAnalysis: null, directionSignals: {} },
    activities: [],
    matching: { hardRequirements: [], gaps: [] } as unknown as StrategyInputContext['matching'],
    target: { university: {}, programme: {}, requirements: [], opportunities: [], scholarship: null, sources: [] },
    application: { status: 'draft', deadline: '2027-01-01', daysUntilDeadline: 120, intake: '2027' },
    evidenceIndex: [{ id: 'evidence-1', label: 'Snapshot evidence', statement: 'Verified.', kind: 'applicant', status: 'verified', sourceRefs: [], direct: true }],
    targetSourceIndex: [],
    ...overrides,
  };
}

function area(category: 'academic' | 'experience' | 'differentiation' | 'evidence', status: 'maintain' | 'develop' | 'consolidate' | 'build' = 'maintain') {
  return { key: category, category, label: category, status, diagnosis: 'Diagnosis.', whyItMatters: 'Why.', suggestedDirection: 'Direction.', evidenceIds: [] as string[], metricIds: [] as string[], requirementIds: [] as string[], targetSourceRefs: [] as string[] };
}

function synthesis() {
  return {
    strategicOverview: {
      currentPosition: { summary: 'Current.', profileStrength: { statement: 'Strength.', evidenceIds: [], metricIds: [] }, keyChallenge: { statement: 'Challenge.', gapIds: [], requirementIds: [] }, unclearArea: null, differentiatedPotential: null },
      strategicOpportunity: { statement: 'Opportunity.', priorityKeys: [] },
      strategicGoal: { directionOfImprovement: 'Improve.', communicationGoal: 'Communicate.' },
      expectedOutcome: 'Outcome.',
    },
    narrativeStrategy: { coreNarrativeDirection: { originTrigger: null, recurringMotivation: null, actions: [], capabilitiesDeveloped: [], emergingDirection: null, insight: 'No pattern.', evidenceIds: ['evidence-1'] }, supportingThemes: [], narrativeTension: null, narrativeOptions: [] },
    strategicRoadmap: ['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({ phaseKey, name: phaseKey, goal: 'Goal.', keyActions: [], deliverables: [], successCriteria: [], estimatedTimeline: 'As needed.', linkedPriorityKeys: [] })),
  };
}

describe('Strategy V3 engine', () => {
  it('makes exactly one profile and one synthesis call when there are no activities', async () => {
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never)) }))
      .mockResolvedValueOnce(JSON.stringify(synthesis()));
    const report = await generateStrategyReportV3({ context: context(), apiKey: 'key', model: 'gpt-4o', now: new Date('2026-08-30T00:00:00Z') });
    expect(mocks.openAiJsonCompletion).toHaveBeenCalledTimes(2);
    expect(report.metadata.aiCallCount).toBe(2);
    expect(report.strategicRoadmap.map((phase) => phase.phaseKey)).toEqual(['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise']);
  });

  it('accepts target-profile requirement IDs in profile provenance', async () => {
    const requirementId = 'adm:academic_entry_requirement';
    const areas = ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never));
    areas[0] = { ...areas[0], requirementIds: [requirementId] };
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas }))
      .mockResolvedValueOnce(JSON.stringify(synthesis()));

    const report = await generateStrategyReportV3({
      context: context({
        target: { university: {}, programme: {}, requirements: [{ id: requirementId }], opportunities: [], scholarship: null, sources: [] },
      }),
      apiKey: 'key',
      model: 'gpt-4o',
      now: new Date('2026-08-30T00:00:00Z'),
    });

    expect(report.profileDevelopmentStrategy.areas.find((item) => item.category === 'academic')?.requirementIds).toEqual([requirementId]);
  });

  it('ranks hard requirements and caps the deterministic result at three', () => {
    const hardRequirement = { id: 'req-1', kind: 'language' as const, label: 'English test', status: 'unknown' as const, applicantValue: null, requiredValue: 'IELTS 6.5', explanation: 'Required.', evidenceIds: [], targetSourceRefs: [] };
    const ranked = selectTopPriorities(context({ matching: { hardRequirements: [hardRequirement], gaps: [] } as unknown as StrategyInputContext['matching'] }), [area('academic', 'develop'), area('experience', 'consolidate'), area('differentiation', 'build'), area('evidence', 'develop')], []);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]?.requirementIds).toEqual(['req-1']);
    expect(ranked.every((priority, index) => priority.rank === index + 1)).toBe(true);
    expect(ranked.every((priority) => priority.factors.rawPriority === Object.values(priority.factors).slice(0, 5).reduce((total, factor) => total * factor, 1))).toBe(true);
  });

  it('caps a new missing dimension when the deadline is close', () => {
    const candidate: StrategyInterventionCandidate = { candidateId: 'profile:academic', title: 'Academic', why: 'Why.', suggestedDirection: 'Build.', kind: 'build_missing_dimension', evidenceIds: [], gapIds: [], requirementIds: [], targetSourceRefs: ['source-1'] };
    expect(calculateStrategyPriorityFactors(candidate, context({ application: { status: 'draft', deadline: '2026-09-05', daysUntilDeadline: 6, intake: null } })).feasibility).toBe(1);
  });
});
