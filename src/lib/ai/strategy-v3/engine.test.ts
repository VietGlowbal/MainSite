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

function synthesis(deliverables: unknown[] = []) {
  return {
    strategicOverview: {
      currentPosition: { summary: 'Current.', profileStrength: { statement: 'Strength.', evidenceIds: [], metricIds: [] }, keyChallenge: { statement: 'Challenge.', gapIds: [], requirementIds: [] }, unclearArea: null, differentiatedPotential: null },
      strategicOpportunity: { statement: 'Opportunity.', priorityKeys: [] },
      strategicGoal: { directionOfImprovement: 'Improve.', communicationGoal: 'Communicate.' },
      expectedOutcome: 'Outcome.',
    },
    narrativeStrategy: { coreNarrativeDirection: { originTrigger: null, recurringMotivation: null, actions: [], capabilitiesDeveloped: [], emergingDirection: null, insight: 'No pattern.', evidenceIds: ['evidence-1'] }, supportingThemes: [], narrativeTension: null, narrativeOptions: [] },
    strategicRoadmap: ['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey, index) => ({ phaseKey, name: phaseKey, goal: 'Goal.', keyActions: [], deliverables: index === 0 ? deliverables : [], successCriteria: [], estimatedTimeline: 'As needed.', linkedPriorityKeys: [] })),
  };
}

function activityAnalysis(activityId: string) {
  const dimensions = Object.fromEntries(
    ['relevance', 'responsibility', 'depth', 'progression', 'impact', 'evidence', 'reflection', 'futurePotential']
      .map((key) => [key, { status: ['responsibility', 'progression', 'futurePotential'].includes(key) ? 'not_established' : 'limited', statement: 'Not established beyond the supplied activity record.', evidenceIds: [], targetSourceRefs: [] }]),
  );
  return {
    activityId,
    title: 'Activity',
    dimensions,
    classification: 'maintain',
    diagnosis: 'The activity is recorded but has limited strategy evidence.',
    recommendedMove: 'Keep the activity concise and evidence-led.',
    evidenceIds: [],
    targetSourceRefs: [],
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

  it('sends each activity batch as the only canonical activity scope', async () => {
    const activities = Array.from({ length: 7 }, (_, index) => ({
      activityId: `activity:${index + 1}`,
      title: `Activity ${index + 1}`,
      category: null,
      organisation: null,
      level: null,
      period: null,
      description: `Description ${index + 1}`,
      reflection: null,
      evidenceIds: [],
    }));
    const areas = ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never));
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas }))
      .mockResolvedValueOnce(JSON.stringify({ analyses: activities.slice(0, 6).map(({ activityId }) => activityAnalysis(activityId)) }))
      .mockResolvedValueOnce(JSON.stringify({ analyses: [activityAnalysis(activities[6].activityId)] }))
      .mockResolvedValueOnce(JSON.stringify(synthesis()));

    const report = await generateStrategyReportV3({
      context: context({ activities }),
      apiKey: 'key',
      model: 'gpt-4o',
      now: new Date('2026-08-30T00:00:00Z'),
    });

    const batchInputs = mocks.openAiJsonCompletion.mock.calls
      .map(([request]) => ({
        ...JSON.parse(request.messages[1].content) as {
          activities?: unknown[];
          context?: { activities?: unknown[]; applicant?: unknown; lineage?: unknown; personalReport?: unknown; sourceAnalysis?: unknown };
          requiredActivityIds?: string[];
        },
        maxTokens: request.maxTokens,
      }))
      .filter((input) => input.requiredActivityIds);
    expect(batchInputs).toHaveLength(2);
    for (const input of batchInputs) {
      expect(input.requiredActivityIds).toEqual(input.activities?.map((activity) => (activity as { activityId: string }).activityId));
      expect(input.context?.activities?.map((activity) => (activity as { activityId: string }).activityId)).toEqual(input.requiredActivityIds);
      expect(input.context?.applicant).toEqual({ directionSignals: {} });
      expect(input.context).not.toHaveProperty('lineage');
      expect(input.context).not.toHaveProperty('personalReport');
      expect(input.context).not.toHaveProperty('sourceAnalysis');
      expect(input.maxTokens).toBe(6_000);
    }
    expect(report.profileDevelopmentStrategy.activityAnalyses).toHaveLength(7);
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

  it('consolidates profile candidates that share a canonical metric', () => {
    const ranked = selectTopPriorities(
      context(),
      [
        { ...area('academic', 'develop'), metricIds: ['metric-1'] },
        { ...area('experience', 'consolidate'), metricIds: ['metric-1'] },
        area('differentiation'),
        area('evidence'),
      ],
      [],
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.basisRefs).toContain('metric-1');
  });

  it('uses semantic deliverable identity instead of array position and enforces duration feasibility', async () => {
    const deliverables = [
      { key: 'research-evidence', label: 'Collect research evidence', kind: 'evidence', linkedPriorityKeys: [], tool: null, basisRefs: [], estimatedDurationDays: 5 },
      { key: 'test-booking', label: 'Book language test', kind: 'requirement', linkedPriorityKeys: [], tool: null, basisRefs: [], estimatedDurationDays: 4 },
    ];
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never)) }))
      .mockResolvedValueOnce(JSON.stringify(synthesis(deliverables)));
    const first = await generateStrategyReportV3({ context: context(), apiKey: 'key', model: 'gpt-4o', now: new Date('2026-08-30T00:00:00Z') });
    const firstKeys = first.strategicRoadmap[0]!.deliverables.map((deliverable) => deliverable.key);

    mocks.openAiJsonCompletion.mockReset();
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never)) }))
      .mockResolvedValueOnce(JSON.stringify(synthesis([...deliverables].reverse())));
    const reordered = await generateStrategyReportV3({ context: context(), apiKey: 'key', model: 'gpt-4o', now: new Date('2026-08-30T00:00:00Z') });
    expect(reordered.strategicRoadmap[0]!.deliverables.map((deliverable) => deliverable.key).sort()).toEqual([...firstKeys].sort());
    expect(reordered.strategicRoadmap[0]!.deliverables.find((deliverable) => deliverable.label === 'Collect research evidence')?.estimatedDurationDays).toBe(5);

    mocks.openAiJsonCompletion.mockReset();
    mocks.openAiJsonCompletion
      .mockResolvedValueOnce(JSON.stringify({ areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => area(category as never)) }))
      .mockResolvedValueOnce(JSON.stringify(synthesis([{ ...deliverables[0], estimatedDurationDays: 15 }])));
    await expect(generateStrategyReportV3({
      context: context({ application: { status: 'draft', deadline: '2026-09-09', daysUntilDeadline: 10, intake: null } }),
      apiKey: 'key',
      model: 'gpt-4o',
      now: new Date('2026-08-30T00:00:00Z'),
    })).rejects.toMatchObject({ code: 'deadline_infeasible' });
  });
});
