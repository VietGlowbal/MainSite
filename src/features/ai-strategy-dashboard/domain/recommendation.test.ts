import { describe, expect, it } from 'vitest';
import type { ImprovementAction } from '@/lib/match-insights';
import {
  completionPercent,
  groupByCategory,
  nextPriority,
  parseContentBlock,
  parseContentBlockValue,
  reconcileRecommendations,
  reconcileSeeds,
  recommendationFromImprovementAction,
  recommendationFromRow,
  recommendationPatchSchema,
  recommendationsFromRoadmap,
  sortByPriority,
  type ExistingRecommendation,
  type Recommendation,
} from './recommendation';

function action(overrides: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 'academic-1',
    pillar: 'academic',
    label: 'Improve Mathematics grade',
    detail: 'Required for entry.',
    estimatedUplift: 15,
    actionType: 'none',
    contentBlock: null,
    submitChecklist: [],
    tips: [],
    suggestedQuestions: [],
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingRecommendation> = {}): ExistingRecommendation {
  return {
    id: 'rec-1',
    pillar: 'academic',
    title: 'Improve Mathematics grade',
    status: 'not_started',
    ...overrides,
  };
}

describe('recommendationFromImprovementAction', () => {
  it('buckets priority from the uplift the model itself estimated', () => {
    expect(recommendationFromImprovementAction('app-1', action({ estimatedUplift: 25 }), 'analysis-1').priority).toBe(
      'high',
    );
    expect(recommendationFromImprovementAction('app-1', action({ estimatedUplift: 12 }), 'analysis-1').priority).toBe(
      'medium',
    );
    expect(recommendationFromImprovementAction('app-1', action({ estimatedUplift: 5 }), 'analysis-1').priority).toBe(
      'low',
    );
  });

  it('flags evidence as required only for an upload_document action', () => {
    expect(
      recommendationFromImprovementAction('app-1', action({ actionType: 'upload_document' }), 'a').evidenceRequired,
    ).toBe(true);
    expect(
      recommendationFromImprovementAction('app-1', action({ actionType: 'external_url' }), 'a').evidenceRequired,
    ).toBe(false);
  });

  it('stamps the analysis that produced it', () => {
    expect(recommendationFromImprovementAction('app-1', action(), 'analysis-42').sourceAnalysisId).toBe(
      'analysis-42',
    );
  });
});

describe('reconcileRecommendations', () => {
  it('inserts an action with no existing match', () => {
    const plan = reconcileRecommendations('app-1', [], [action()], 'analysis-1');
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toArchiveIds).toHaveLength(0);
  });

  it('updates a matched, not-yet-completed recommendation in place rather than duplicating it', () => {
    const plan = reconcileRecommendations(
      'app-1',
      [existing({ status: 'in_progress' })],
      [action({ estimatedUplift: 30, detail: 'Updated reasoning.' })],
      'analysis-2',
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toEqual([
      {
        id: 'rec-1',
        fields: expect.objectContaining({
          priority: 'high',
          reason: 'Updated reasoning.',
          sourceAnalysisId: 'analysis-2',
        }),
      },
    ]);
    expect(plan.toArchiveIds).toHaveLength(0);
  });

  it('leaves a completed recommendation completely untouched when still represented', () => {
    const plan = reconcileRecommendations(
      'app-1',
      [existing({ status: 'completed' })],
      [action({ estimatedUplift: 30 })],
      'analysis-2',
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toArchiveIds).toHaveLength(0);
  });

  it('archives a recommendation no longer represented in the new analysis, regardless of status', () => {
    const notStarted = reconcileRecommendations(
      'app-1',
      [existing({ id: 'rec-a', status: 'not_started' })],
      [],
      'analysis-2',
    );
    expect(notStarted.toArchiveIds).toEqual(['rec-a']);

    const completed = reconcileRecommendations(
      'app-1',
      [existing({ id: 'rec-b', status: 'completed' })],
      [],
      'analysis-2',
    );
    expect(completed.toArchiveIds).toEqual(['rec-b']);
  });

  it('matches by pillar and title together, not title alone', () => {
    // Same title, different pillar — a genuinely different recommendation,
    // not the same one restated, so both must survive independently.
    const plan = reconcileRecommendations(
      'app-1',
      [existing({ id: 'rec-1', pillar: 'academic', title: 'Get more experience' })],
      [action({ pillar: 'activities', label: 'Get more experience' })],
      'analysis-2',
    );
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toArchiveIds).toEqual(['rec-1']);
  });

  it('does not archive a completed recommendation the new analysis still returns', () => {
    // Regression guard for "prevent completed recommendations from being
    // silently recreated": a completed row that IS still matched must never
    // appear in toArchiveIds even though it's also excluded from toUpdate.
    const plan = reconcileRecommendations(
      'app-1',
      [existing({ status: 'completed' })],
      [action()],
      'analysis-2',
    );
    expect(plan.toArchiveIds).not.toContain('rec-1');
  });

  it('handles a mixed batch: insert, update, preserve and archive together', () => {
    const plan = reconcileRecommendations(
      'app-1',
      [
        existing({ id: 'still-open', pillar: 'academic', title: 'A', status: 'not_started' }),
        existing({ id: 'done', pillar: 'academic', title: 'B', status: 'completed' }),
        existing({ id: 'stale', pillar: 'academic', title: 'C', status: 'not_started' }),
      ],
      [
        action({ pillar: 'academic', label: 'A' }),
        action({ pillar: 'academic', label: 'B' }),
        action({ pillar: 'essays', label: 'D' }),
      ],
      'analysis-3',
    );
    expect(plan.toUpdate.map((u) => u.id)).toEqual(['still-open']);
    expect(plan.toInsert.map((s) => s.title)).toEqual(['D']);
    expect(plan.toArchiveIds).toEqual(['stale']);
  });
});

describe('recommendationsFromRoadmap', () => {
  const roadmap = {
    why: 'Concentrates your story around one identity instead of three.',
    prioritize: ['Lead a research project', 'Publish a portfolio piece'],
    avoid: ['Spreading across unrelated clubs'],
  };

  it('turns prioritize items into high-priority, avoid items into low-priority reminders', () => {
    const seeds = recommendationsFromRoadmap('app-1', roadmap);

    expect(seeds).toHaveLength(3);
    expect(seeds.every((s) => s.category === 'strategy-roadmap' && s.pillar === null)).toBe(true);
    expect(seeds[0]).toMatchObject({ title: 'Lead a research project', priority: 'high', reason: roadmap.why });
    expect(seeds[1]).toMatchObject({ title: 'Publish a portfolio piece', priority: 'high' });
    expect(seeds[2]).toMatchObject({ title: 'Avoid: Spreading across unrelated clubs', priority: 'low' });
  });

  it('reconciles against its own category only, leaving other rows alone', () => {
    const seeds = recommendationsFromRoadmap('app-1', roadmap);
    const plan = reconcileSeeds(
      [existing({ id: 'stale-roadmap', pillar: null, title: 'Old priority item', status: 'not_started' })],
      seeds,
    );

    expect(plan.toInsert).toHaveLength(3);
    expect(plan.toArchiveIds).toEqual(['stale-roadmap']);
  });

  it('is idempotent: reconciling the same roadmap twice updates in place instead of duplicating', () => {
    const seeds = recommendationsFromRoadmap('app-1', roadmap);
    const alreadyStored: ExistingRecommendation[] = seeds.map((s, i) => ({
      id: `existing-${i}`,
      pillar: s.pillar,
      title: s.title,
      status: 'not_started',
    }));

    const plan = reconcileSeeds(alreadyStored, seeds);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toArchiveIds).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(3);
  });
});

describe('recommendationFromRow', () => {
  function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'rec-1',
      application_id: 'app-1',
      title: 'Improve Mathematics grade',
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('parses a well-formed structured_table content_schema/content_value', () => {
    const rec = recommendationFromRow(
      row({
        content_schema: {
          type: 'structured_table',
          columns: [{ key: 'name', label: 'Name', type: 'text' }],
        },
        content_value: { type: 'structured_table', rows: [{ name: 'Physics Olympiad' }] },
      }),
    );
    expect(rec.contentSchema).toEqual({
      type: 'structured_table',
      columns: [{ key: 'name', label: 'Name', type: 'text' }],
    });
    expect(rec.contentValue).toEqual({
      type: 'structured_table',
      rows: [{ name: 'Physics Olympiad' }],
    });
  });

  // Regression guard: reported live 12/08 as "each of the planner tasks...
  // don't load up" — a content_schema whose `type` matched but whose
  // columns/items were missing or empty used to pass straight through as a
  // real ContentBlock, and the detail page crashed calling `.map()` on the
  // missing array. Every one of these must degrade to `null`, never throw.
  it('degrades a structured_table content_schema with no columns to null, not a crash', () => {
    const rec = recommendationFromRow(row({ content_schema: { type: 'structured_table' } }));
    expect(rec.contentSchema).toBeNull();
  });

  it('degrades a structured_table content_schema with an empty columns array to null', () => {
    const rec = recommendationFromRow(
      row({ content_schema: { type: 'structured_table', columns: [] } }),
    );
    expect(rec.contentSchema).toBeNull();
  });

  it('degrades a checklist content_schema with no items to null', () => {
    const rec = recommendationFromRow(row({ content_schema: { type: 'checklist' } }));
    expect(rec.contentSchema).toBeNull();
  });

  it('degrades a long_text content_schema with no prompt to null', () => {
    const rec = recommendationFromRow(row({ content_schema: { type: 'long_text' } }));
    expect(rec.contentSchema).toBeNull();
  });

  it('degrades an unrecognised content_schema type to null', () => {
    const rec = recommendationFromRow(row({ content_schema: { type: 'freeform', text: 'hi' } }));
    expect(rec.contentSchema).toBeNull();
  });

  it('degrades a malformed content_value the same way, independently of content_schema', () => {
    const rec = recommendationFromRow(
      row({
        content_schema: {
          type: 'checklist',
          items: ['Request official transcripts'],
        },
        content_value: { type: 'checklist' }, // missing checkedItems
      }),
    );
    expect(rec.contentSchema).toEqual({
      type: 'checklist',
      items: ['Request official transcripts'],
    });
    expect(rec.contentValue).toBeNull();
  });

  it('treats a null content_schema as no content block, not an error', () => {
    const rec = recommendationFromRow(row({ content_schema: null, content_value: null }));
    expect(rec.contentSchema).toBeNull();
    expect(rec.contentValue).toBeNull();
  });
});

describe('sortByPriority / groupByCategory / completionPercent / nextPriority', () => {
  function rec(overrides: Partial<Recommendation> = {}): Recommendation {
    return {
      id: 'r1',
      applicationId: 'app-1',
      category: 'academics',
      pillar: 'academic',
      title: 'Do the thing',
      reason: null,
      priority: 'medium',
      status: 'not_started',
      estimatedImpact: null,
      estimatedEffort: null,
      deadline: null,
      evidenceRequired: false,
      relatedRequirement: null,
      actionLabel: null,
      actionType: null,
      actionTarget: null,
      contentSchema: null,
      contentValue: null,
      submitChecklist: [],
      tips: [],
      suggestedQuestions: [],
      confidence: 0.7,
      isDismissed: false,
      sourceAnalysisId: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('sorts urgent/high before medium/low', () => {
    const sorted = sortByPriority([
      rec({ id: 'low', priority: 'low' }),
      rec({ id: 'urgent', priority: 'urgent' }),
      rec({ id: 'medium', priority: 'medium' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['urgent', 'medium', 'low']);
  });

  it('groups by category and sorts each group by priority', () => {
    const groups = groupByCategory([
      rec({ id: 'a', category: 'academics', priority: 'low' }),
      rec({ id: 'b', category: 'academics', priority: 'urgent' }),
      rec({ id: 'c', category: 'personal', priority: 'medium' }),
    ]);
    expect([...groups.get('academics')!.map((r) => r.id)]).toEqual(['b', 'a']);
    expect(groups.get('personal')).toHaveLength(1);
  });

  it('computes completion percent from completed vs total', () => {
    expect(
      completionPercent([rec({ status: 'completed' }), rec({ status: 'not_started' })]),
    ).toBe(50);
    expect(completionPercent([])).toBe(0);
  });

  it('finds the highest-priority not-yet-completed recommendation', () => {
    const next = nextPriority([
      rec({ id: 'done', status: 'completed', priority: 'urgent' }),
      rec({ id: 'open-low', status: 'not_started', priority: 'low' }),
      rec({ id: 'open-high', status: 'in_progress', priority: 'high' }),
    ]);
    expect(next?.id).toBe('open-high');
  });
});

describe('recommendationPatchSchema', () => {
  it('rejects an empty patch', () => {
    expect(recommendationPatchSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a status-only patch, unchanged from before contentValue existed', () => {
    expect(recommendationPatchSchema.safeParse({ status: 'completed' }).success).toBe(true);
  });

  it('accepts each contentValue shape matching its own type', () => {
    expect(
      recommendationPatchSchema.safeParse({
        contentValue: { type: 'structured_table', rows: [{ subject: 'Maths', grade: 'A' }] },
      }).success,
    ).toBe(true);
    expect(
      recommendationPatchSchema.safeParse({
        contentValue: { type: 'long_text', text: 'I want to study here because...' },
      }).success,
    ).toBe(true);
    expect(
      recommendationPatchSchema.safeParse({
        contentValue: { type: 'checklist', checkedItems: ['Email the registrar'] },
      }).success,
    ).toBe(true);
  });

  it('accepts a null contentValue, for clearing a saved answer', () => {
    expect(recommendationPatchSchema.safeParse({ contentValue: null }).success).toBe(true);
  });

  it('rejects a contentValue whose fields do not match its own declared type', () => {
    // A "long_text" value has no "rows" — this is a checklist's shape wearing the wrong tag.
    expect(
      recommendationPatchSchema.safeParse({
        contentValue: { type: 'long_text', rows: [{ subject: 'Maths' }] },
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised contentValue type', () => {
    expect(
      recommendationPatchSchema.safeParse({ contentValue: { type: 'freeform', text: 'x' } }).success,
    ).toBe(false);
  });
});
import {
  recommendationsFromStrategyReportV2,
  type StrategyReportV2,
} from './recommendation';

const REPORT: StrategyReportV2 = {
  strategicOverview: {
    currentPosition: { profile: 'p', keyStrength: 's', biggestChallenge: 'c' },
    strategicGoal: { primaryObjective: 'o', positioning: 'pos' },
    topPriorities: ['a'],
    expectedOutcome: 'e',
  },
  priorityTable: [
    { key: 'k1', title: 't1', currentSituation: 'cs', whyItMatters: 'w', recommendedActions: ['r'], expectedImpact: 'i', level: 'critical' },
  ],
  profileDevelopmentStrategy: {
    academic: { currentStatus: 'a', gap: 'b', strategicFocus: 'c', expectedOutcome: 'd' },
    experience: { currentStatus: 'a', gap: 'b', strategicFocus: 'c', expectedOutcome: 'd' },
    differentiation: { currentAdvantage: 'a', uniqueness: 'b', amplifyHow: 'c', desiredPerception: 'd' },
  },
  narrativeStrategy: {
    coreNarrative: { centralStory: 's', supportingEvidence: [], admissionsValue: 'v' },
    themes: [{ key: 'th1', title: 'T', rationale: 'r', evidence: [] }],
    consistencyCheck: { supports: 'a', feelsDisconnected: 'b', emphasise: 'c', supportingRole: 'd' },
  },
  executionRoadmap: {
    phases: [
      {
        phaseKey: 'strengthen_foundation',
        name: 'Strengthen Foundation',
        objective: 'Close gaps.',
        keyActions: ['Book IELTS'],
        deliverables: [
          { key: 'ielts_booking', label: 'IELTS booking confirmed' },
          { key: 'cv_upload', label: 'Upload CV', tool: 'cv_builder' },
        ],
        successCriteria: ['Test booked'],
        timeline: 'Month 1',
      },
    ],
  },
};

describe('recommendationsFromStrategyReportV2', () => {
  it('creates one seed per deliverable with a deterministic source key', () => {
    const seeds = recommendationsFromStrategyReportV2('app-1', REPORT);
    expect(seeds.map((s) => s.sourceKey)).toEqual([
      'strategy-roadmap::strengthen_foundation::ielts_booking',
      'strategy-roadmap::strengthen_foundation::cv_upload',
    ]);
  });

  it('maps known tools to canonical routes', () => {
    const seeds = recommendationsFromStrategyReportV2('app-1', REPORT);
    expect(seeds[1]?.actionTarget).toBe('/apply/app-1/cv');
    expect(seeds[0]?.actionTarget).toBeNull();
  });
});

describe('reconcileSeeds with source keys', () => {
  it('updates in place when the title is reworded but the source key survives', () => {
    const existingRow = existing({ id: 'row-1', sourceKey: 'strategy-roadmap::strengthen_foundation::cv_upload' });
    const seed = recommendationsFromStrategyReportV2('app-1', REPORT)[1]!;
    const plan = reconcileSeeds([existingRow], [seed]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]?.id).toBe('row-1');
  });

  it('preserves a completed task untouched even when prose changes', () => {
    const existingRow = existing({
      id: 'row-2',
      status: 'completed',
      sourceKey: 'strategy-roadmap::strengthen_foundation::ielts_booking',
    });
    const seed = recommendationsFromStrategyReportV2('app-1', REPORT)[0]!;
    const plan = reconcileSeeds([existingRow], [seed]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it('still matches legacy rows on (pillar, title) when no source key exists', () => {
    // Roadmap seeds carry pillar: null, so a legacy row it produced must too.
    const legacyRow = existing({ id: 'legacy-1', pillar: null }); // no sourceKey
    const seeds = recommendationsFromRoadmap('app-1', {
      why: 'why',
      prioritize: ['Improve Mathematics grade'],
      avoid: [],
    });
    const plan = reconcileSeeds([legacyRow], seeds);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]?.id).toBe('legacy-1');
  });

  it('is idempotent � running the same batch twice inserts nothing new the second time', () => {
    const seeds = recommendationsFromStrategyReportV2('app-1', REPORT);
    const first = reconcileSeeds([], seeds);
    const rowsAfterFirst = first.toInsert.map((seed, index) =>
      existing({
        id: `new-${index}`,
        sourceKey: seed.sourceKey ?? null,
        pillar: seed.pillar,
        title: seed.title,
      }),
    );
    const second = reconcileSeeds(rowsAfterFirst, seeds);
    expect(second.toInsert).toHaveLength(0);
    expect(second.toArchiveIds).toHaveLength(0);
  });
});

// CHARACTERIZATION + GATE MATRIX (Part 5.1 / 6.1 / 6.2): persisted
// `content_schema` / `content_value` are student-facing JSONB written by an AI
// pipeline. The parsers are the safety boundary — anything malformed, of an
// unknown type, or carrying an unknown future VERSION degrades to `null`
// (no block rendered, task still usable) and must never throw into the page.
// The matrix below is the fixture gate the Part 6 plan asks for: 4 real types ×
// {fully valid, optional-field omission, malformed}, plus explicit-version,
// unknown-type and non-object fixtures — one row per behaviour, no duplicates.
describe('parseContentBlock / parseContentBlockValue degrade safely', () => {
  function expectParsed(parsed: unknown, expected: unknown) {
    if (expected === null) expect(parsed).toBeNull();
    else expect(parsed).toEqual(expected);
  }

  const singleSelect = {
    type: 'single_select',
    prompt: 'Pick your target tier',
    options: [
      { value: 'reach', label: 'Reach' },
      { value: 'safe', label: 'Safe' },
    ],
    semanticKey: 'tier-choice',
  };

  const blockCases: { name: string; input: unknown; expected: unknown }[] = [
    // ── Fully valid: round-trips unchanged. ──
    {
      name: 'parses a fully valid structured_table',
      input: { type: 'structured_table', columns: [{ key: 'name', label: 'Name', type: 'text' }] },
      expected: { type: 'structured_table', columns: [{ key: 'name', label: 'Name', type: 'text' }] },
    },
    {
      name: 'parses a fully valid long_text',
      input: { type: 'long_text', prompt: 'Reflect', minWords: 10 },
      expected: { type: 'long_text', prompt: 'Reflect', minWords: 10 },
    },
    {
      name: 'parses a fully valid checklist',
      input: { type: 'checklist', items: ['Request official transcripts'] },
      expected: { type: 'checklist', items: ['Request official transcripts'] },
    },
    {
      name: 'parses a fully valid single_select',
      input: singleSelect,
      expected: singleSelect,
    },
    // ── Valid but OPTIONAL field omitted: nothing back-filled, nothing rejected. ──
    {
      name: 'parses a long_text without its optional minWords',
      input: { type: 'long_text', prompt: 'Reflect' },
      expected: { type: 'long_text', prompt: 'Reflect' },
    },
    {
      name: 'parses a structured_table whose select column omits its optional options',
      input: { type: 'structured_table', columns: [{ key: 'tier', label: 'Tier', type: 'select' }] },
      expected: { type: 'structured_table', columns: [{ key: 'tier', label: 'Tier', type: 'select' }] },
    },
    // ── Malformed: missing fields, empty arrays, wrong primitive types → null. ──
    {
      name: 'returns null for a structured_table with no columns',
      input: { type: 'structured_table' },
      expected: null,
    },
    {
      name: 'returns null for a structured_table with empty columns',
      input: { type: 'structured_table', columns: [] },
      expected: null,
    },
    {
      name: 'returns null for a structured_table whose columns is not an array',
      input: { type: 'structured_table', columns: 'name' },
      expected: null,
    },
    {
      name: 'returns null for a column with wrong primitive types',
      input: { type: 'structured_table', columns: [{ key: 1, label: 'Name', type: 'text' }] },
      expected: null,
    },
    {
      name: 'returns null for a column with an unknown column type',
      input: { type: 'structured_table', columns: [{ key: 'a', label: 'A', type: 'richtext' }] },
      expected: null,
    },
    {
      name: 'returns null for a long_text with no prompt',
      input: { type: 'long_text' },
      expected: null,
    },
    {
      name: 'returns null for a long_text with an empty prompt',
      input: { type: 'long_text', prompt: '' },
      expected: null,
    },
    {
      name: 'returns null for a long_text with a non-string prompt',
      input: { type: 'long_text', prompt: 42 },
      expected: null,
    },
    {
      name: 'returns null for a long_text with a non-number minWords',
      input: { type: 'long_text', prompt: 'x', minWords: 'many' },
      expected: null,
    },
    {
      name: 'returns null for a checklist with no items',
      input: { type: 'checklist' },
      expected: null,
    },
    {
      name: 'returns null for a checklist with empty items',
      input: { type: 'checklist', items: [] },
      expected: null,
    },
    {
      name: 'returns null for a checklist whose items is not an array',
      input: { type: 'checklist', items: 'step one' },
      expected: null,
    },
    {
      name: 'returns null for a checklist containing an empty item string',
      input: { type: 'checklist', items: [''] },
      expected: null,
    },
    {
      name: 'returns null for a single_select with empty options',
      input: { ...singleSelect, options: [] },
      expected: null,
    },
    {
      name: 'returns null for a single_select with a missing semanticKey',
      input: { type: 'single_select', prompt: 'Pick', options: singleSelect.options },
      expected: null,
    },
    {
      name: 'returns null for a single_select with an invalid semanticKey format',
      input: { ...singleSelect, semanticKey: 'Not A Key' },
      expected: null,
    },
    {
      name: 'returns null for a single_select option with an empty value',
      input: { ...singleSelect, options: [{ value: '', label: 'Reach' }] },
      expected: null,
    },
    // ── Unknown / future TYPES degrade exactly like malformed payloads. ──
    {
      name: 'returns null for an unknown editable_priority_grid type',
      input: { type: 'editable_priority_grid', rows: [] },
      expected: null,
    },
    {
      name: 'returns null for an unknown phase_timeline type',
      input: { type: 'phase_timeline', phases: [] },
      expected: null,
    },
    // ── Non-object garbage. ──
    { name: 'returns null for a bare string', input: 'long_text', expected: null },
    { name: 'returns null for a number', input: 42, expected: null },
    { name: 'returns null for null', input: null, expected: null },
    { name: 'returns null for an array', input: [], expected: null },
  ];

  it.each(blockCases)('$name', ({ input, expected }) => {
    expectParsed(parseContentBlock(input), expected);
  });

  // Version gate (§6.2): absent `v` IS legacy v1 (covered above); an EXPLICIT
  // `v: 1` is identical; ANY other value fails safeParse on every variant so
  // `parseContentBlock` returns null and the UI falls back.
  it('accepts every variant stamped explicitly with the current version v: 1', () => {
    const blocksWithV1 = [
      { type: 'structured_table', columns: [{ key: 'name', label: 'Name', type: 'text' }], v: 1 },
      { type: 'long_text', prompt: 'Reflect', v: 1 },
      { type: 'checklist', items: ['Request official transcripts'], v: 1 },
      { ...singleSelect, v: 1 },
    ];
    for (const block of blocksWithV1) {
      expect(parseContentBlock(block)).toEqual(block);
    }
  });

  it('rejects every variant carrying an unknown future version (v: 2)', () => {
    const blocksWithV2 = [
      { type: 'structured_table', columns: [{ key: 'name', label: 'Name', type: 'text' }], v: 2 },
      { type: 'long_text', prompt: 'Reflect', v: 2 },
      { type: 'checklist', items: ['Request official transcripts'], v: 2 },
      { ...singleSelect, v: 2 },
    ];
    for (const block of blocksWithV2) {
      expect(parseContentBlock(block)).toBeNull();
    }
  });

  it('rejects a known type with a non-numeric version', () => {
    expect(parseContentBlock({ type: 'long_text', prompt: 'x', v: '1' })).toBeNull();
  });

  // ── Same discipline for the student-authored value column. ──
  const valueCases: { name: string; input: unknown; expected: unknown }[] = [
    {
      name: 'parses a valid structured_table answer',
      input: { type: 'structured_table', rows: [{ name: 'Physics Olympiad' }] },
      expected: { type: 'structured_table', rows: [{ name: 'Physics Olympiad' }] },
    },
    {
      name: 'parses a valid long_text answer',
      input: { type: 'long_text', text: 'My motivation…' },
      expected: { type: 'long_text', text: 'My motivation…' },
    },
    {
      name: 'parses a valid checklist answer',
      input: { type: 'checklist', checkedItems: ['Email the registrar'] },
      expected: { type: 'checklist', checkedItems: ['Email the registrar'] },
    },
    {
      name: 'parses a valid single_select answer',
      input: { type: 'single_select', value: 'reach' },
      expected: { type: 'single_select', value: 'reach' },
    },
    {
      name: 'returns null for a long_text answer with no text',
      input: { type: 'long_text' },
      expected: null,
    },
    {
      name: 'returns null for a long_text answer with a non-string text',
      input: { type: 'long_text', text: 42 },
      expected: null,
    },
    {
      name: 'returns null for a checklist answer with no checkedItems',
      input: { type: 'checklist' },
      expected: null,
    },
    {
      name: 'returns null for a structured_table answer with non-array rows',
      input: { type: 'structured_table', rows: 'rows' },
      expected: null,
    },
    {
      name: 'returns null for a single_select answer with an empty value',
      input: { type: 'single_select', value: '' },
      expected: null,
    },
    {
      name: 'returns null for an unknown answer type',
      input: { type: 'time_machine' },
      expected: null,
    },
    { name: 'returns null for a bare string', input: 'long_text', expected: null },
    { name: 'returns null for a number', input: 42, expected: null },
    { name: 'returns null for undefined', input: undefined, expected: null },
  ];

  it.each(valueCases)('$name', ({ input, expected }) => {
    expectParsed(parseContentBlockValue(input), expected);
  });

  it('leaves student values unversioned by design: unknown keys are dropped, not rejected', () => {
    // §6.2 versions only the AI-authored `content_schema`; `contentValueSchema`
    // is deliberately untouched. A stray/future key on a saved answer must
    // neither block reading the student's work nor be echoed back into writes.
    expect(parseContentBlockValue({ type: 'long_text', text: 'x', v: 2 })).toEqual({
      type: 'long_text',
      text: 'x',
    });
  });
});
