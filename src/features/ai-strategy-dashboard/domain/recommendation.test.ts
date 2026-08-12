import { describe, expect, it } from 'vitest';
import type { ImprovementAction } from '@/lib/match-insights';
import {
  completionPercent,
  groupByCategory,
  nextPriority,
  reconcileRecommendations,
  reconcileSeeds,
  recommendationFromImprovementAction,
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
