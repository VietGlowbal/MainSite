import { describe, expect, it } from 'vitest';
import { generateRoadmapTasks } from '../generate-roadmap-tasks';

type Op = 'select' | 'insert' | 'update';

/**
 * Same minimal fake Supabase client as `generate-recommendations.test.ts` —
 * every method on the query builder returns itself so any chain shape
 * resolves, and the builder is thenable so `await supabase.from(...)....`
 * works whether or not the real code calls a terminal method.
 */
function buildSupabase(options: {
  latestStrategy?: { roadmap: { why: string; prioritize: string[]; avoid: string[] } } | null;
  strategyRows?: Array<Record<string, unknown>> | null;
  reportV2QueryError?: boolean;
  existingRows?: Array<{ id: string; pillar: string | null; title: string; status: string; source_key?: string | null }>;
  failOn?: { table: string; op: Op };
}) {
  const calls: Array<{ table: string; op: Op; value?: unknown }> = [];

  function makeBuilder(table: string) {
    let op: Op = 'select';
    let value: unknown;
    let selectedColumns = '';

    const resolve = () => {
      const failed = options.failOn && options.failOn.table === table && options.failOn.op === op;
      if (failed) return { data: null, error: { message: 'boom' } };

      if (table === 'application_strategy_recommendations') {
        if (options.reportV2QueryError && selectedColumns.includes('report_v2')) {
          return { data: null, error: { code: 'PGRST204', message: 'missing report_v2' } };
        }
        return { data: options.strategyRows ?? options.latestStrategy ?? null, error: null };
      }
      if (table === 'application_recommendations') {
        if (op === 'select') return { data: options.existingRows ?? [], error: null };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    const builder: Record<string, unknown> = {
      select: (columns: string) => {
        selectedColumns = columns;
        return builder;
      },
      eq: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (v: unknown) => {
        op = 'insert';
        value = v;
        calls.push({ table, op, value });
        return builder;
      },
      update: (v: unknown) => {
        op = 'update';
        value = v;
        calls.push({ table, op, value });
        return builder;
      },
      maybeSingle: async () => resolve(),
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };
    return builder;
  }

  return {
    from: (table: string) => makeBuilder(table),
    calls,
  };
}

function deliverable(phaseKey: string, key: string, label: string) {
  return {
    key: `strategy-deliverable::${phaseKey}::${key}::other`,
    label,
    kind: 'other',
    linkedPriorityKeys: [],
    tool: null,
    basisRefs: [],
  };
}

function v3Report(deliverables: Record<string, Array<Record<string, unknown>>>) {
  const phaseKeys = [
    'strengthen_foundation',
    'build_competitive_advantages',
    'craft_application',
    'finalise_optimise',
  ];
  return {
    contractVersion: 'strategy-report-v3',
    generatedAt: '2026-09-06T00:00:00Z',
    strategicOverview: {
      currentPosition: {
        summary: 'Current profile.',
        profileStrength: { statement: 'Strength.', evidenceIds: [], metricIds: [] },
        keyChallenge: { statement: 'Challenge.', gapIds: [], requirementIds: [] },
        unclearArea: null,
        differentiatedPotential: null,
      },
      strategicOpportunity: { statement: 'Opportunity.', priorityKeys: [] },
      strategicGoal: { directionOfImprovement: 'Improve.', communicationGoal: 'Communicate.' },
      topPriorities: [],
      expectedOutcome: 'A clearer application.',
    },
    profileDevelopmentStrategy: {
      areas: ['academic', 'experience', 'differentiation', 'evidence'].map((category) => ({
        key: category,
        category,
        label: category,
        status: 'maintain',
        diagnosis: 'Stable.',
        whyItMatters: 'It matters.',
        suggestedDirection: 'Maintain it.',
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
        insight: 'No pattern established.',
        evidenceIds: [],
      },
      supportingThemes: [],
      narrativeTension: null,
      narrativeOptions: [],
    },
    strategicRoadmap: phaseKeys.map((phaseKey) => ({
      phaseKey,
      name: phaseKey,
      goal: 'Continue the application strategy.',
      keyActions: [],
      deliverables: deliverables[phaseKey] ?? [],
      successCriteria: [],
      estimatedTimeline: 'As needed.',
      linkedPriorityKeys: [],
    })),
    evidenceIndex: [],
    targetSourceIndex: [],
    metadata: {
      strategyEngineVersion: 'strategy-v3.1.2',
      reportContractVersion: 'strategy-report-v3',
      profileDiagnosisPromptVersion: 'profile-diagnosis-v3',
      activityAnalysisPromptVersion: 'activity-analysis-v3',
      synthesisPromptVersion: 'strategy-synthesis-v3',
      priorityFormulaVersion: 'priority-v2',
      personalReportVersionId: 'report-1',
      personalReportInputHash: null,
      sourceAnalysisVersionId: 'analysis-1',
      confirmedSnapshotId: null,
      matchingReportId: 'match-1',
      matchingInputHash: null,
      matchingContractVersion: 'matching-report-v3',
      matchingEngineVersion: 'matching-v3',
      targetProfileVersionId: null,
      selectedScholarshipVersionId: null,
      applicationDeadlineEvaluatedAt: '2026-09-06T00:00:00Z',
      model: 'test-model',
      aiCallCount: 0,
    },
  };
}

const INITIAL_V3_REPORT = v3Report({
  strengthen_foundation: [
    deliverable('strengthen_foundation', 'task-a', 'Task A'),
    deliverable('strengthen_foundation', 'task-b', 'Task B'),
  ],
  build_competitive_advantages: [deliverable('build_competitive_advantages', 'task-c', 'Task C')],
});

const V3_STRATEGY_ROW = {
  id: 'strategy-v3-e2e',
  application_id: 'app-1',
  created_at: '2026-09-06T00:00:00Z',
  report_v2: INITIAL_V3_REPORT,
};

describe('generateRoadmapTasks', () => {
  it('reads a V3 report_v2 row and creates one legacy Planner task per deliverable', async () => {
    const supabase = buildSupabase({
      strategyRows: [
        V3_STRATEGY_ROW,
        { roadmap: { why: 'Legacy fallback', prioritize: ['Do not use this'], avoid: [] } },
      ],
      existingRows: [],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 3, updated: 0, archived: 0 });
    const rows = supabase.calls.find((call) => call.op === 'insert')!.value as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.title)).toEqual(['Task A', 'Task B', 'Task C']);
    expect(rows.every((row) => row.category === 'strategy-roadmap')).toBe(true);
    expect(rows.every((row) => row.content_schema === null && Array.isArray(row.submit_checklist) && row.submit_checklist.length === 0)).toBe(true);
    expect(new Set(rows.map((row) => row.source_key)).size).toBe(3);
  });

  it('regenerates V3 tasks by source key, archiving removals and preserving row state fields', async () => {
    const revisedReport = v3Report({
      strengthen_foundation: [deliverable('strengthen_foundation', 'task-a', 'Updated Task A')],
      build_competitive_advantages: [deliverable('build_competitive_advantages', 'task-c', 'Task C')],
    });
    const supabase = buildSupabase({
      strategyRows: [{ ...V3_STRATEGY_ROW, report_v2: revisedReport }],
      existingRows: [
        {
          id: 'rec-a',
          pillar: null,
          title: 'Task A',
          status: 'in_progress',
          source_key: 'strategy-roadmap::strengthen_foundation::strategy-deliverable::strengthen_foundation::task-a::other',
        },
        {
          id: 'rec-b',
          pillar: null,
          title: 'Task B',
          status: 'completed',
          source_key: 'strategy-roadmap::strengthen_foundation::strategy-deliverable::strengthen_foundation::task-b::other',
        },
      ],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 1, updated: 1, archived: 1 });
    const updateCalls = supabase.calls.filter((call) => call.op === 'update');
    expect(updateCalls[0]?.value).toMatchObject({ title: 'Updated Task A' });
    expect(updateCalls[0]?.value).not.toHaveProperty('status');
    expect(updateCalls[0]?.value).not.toHaveProperty('deadline');
    expect(updateCalls[1]?.value).toEqual({ archived_at: expect.any(String) });
    const insertCall = supabase.calls.find((call) => call.op === 'insert');
    expect(insertCall?.value).toEqual([expect.objectContaining({ title: 'Task C' })]);
  });

  it('errors with no_strategy_recommendation when F7 has not generated yet', async () => {
    const supabase = buildSupabase({ latestStrategy: null, reportV2QueryError: true });
    const result = await generateRoadmapTasks(supabase as never, 'app-1');
    expect(result).toEqual({
      ok: false,
      error: 'no_strategy_recommendation',
      inserted: 0,
      updated: 0,
      archived: 0,
    });
  });

  it('inserts prioritize and avoid items as next_action rows under the strategy-roadmap category', async () => {
    const supabase = buildSupabase({
      latestStrategy: {
        roadmap: {
          why: 'Concentrates your story around one identity.',
          prioritize: ['Lead a research project'],
          avoid: ['Spreading across unrelated clubs'],
        },
      },
      reportV2QueryError: true,
      existingRows: [],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 2, updated: 0, archived: 0 });
    const insertCall = supabase.calls.find((c) => c.op === 'insert');
    const rows = insertCall!.value as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      expect.objectContaining({
        recommendation_type: 'next_action',
        category: 'strategy-roadmap',
        pillar: null,
        title: 'Lead a research project',
        priority: 'high',
      }),
      expect.objectContaining({
        recommendation_type: 'next_action',
        category: 'strategy-roadmap',
        title: 'Avoid: Spreading across unrelated clubs',
        priority: 'low',
      }),
    ]);
  });

  it('reports read_failed without touching the database further when the existing-rows read errors', async () => {
    const supabase = buildSupabase({
      latestStrategy: { roadmap: { why: '', prioritize: [], avoid: [] } },
      reportV2QueryError: true,
      failOn: { table: 'application_recommendations', op: 'select' },
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('read_failed');
    expect(supabase.calls).toHaveLength(0);
  });

  it('archives a roadmap task no longer represented after the report regenerates', async () => {
    const supabase = buildSupabase({
      latestStrategy: { roadmap: { why: '', prioritize: [], avoid: [] } },
      reportV2QueryError: true,
      existingRows: [
        { id: 'rec-1', pillar: null, title: 'Old priority item', status: 'not_started' },
      ],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 0, updated: 0, archived: 1 });
    const archiveCall = supabase.calls.find((c) => c.op === 'update');
    expect(archiveCall?.value).toMatchObject({ archived_at: expect.any(String) });
  });
});
