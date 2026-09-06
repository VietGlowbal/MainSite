import { describe, expect, it } from 'vitest';
import { recommendationsFromStrategyReportV3 } from './strategy-v3-planner';

describe('Strategy V3 Planner handoff', () => {
  it('creates one stable seed per deliverable, preserves criteria, and routes every tool', () => {
    const report = {
      strategicRoadmap: [
        ...['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({
          phaseKey,
          name: phaseKey,
          goal: 'Goal.',
          successCriteria: ['Done.', 'Verified.'],
          deliverables: phaseKey === 'craft_application' ? [
            { key: 'canvas-task', label: 'Review profile evidence', kind: 'profile_build', linkedPriorityKeys: [], tool: 'personal_canvas', basisRefs: [] },
            { key: 'cv-task', label: 'Build CV', kind: 'application', linkedPriorityKeys: [], tool: 'cv_builder', basisRefs: [] },
            { key: 'statement-task', label: 'Draft statement', kind: 'application', linkedPriorityKeys: [], tool: 'statement_writer', basisRefs: [] },
          ] : [],
        })),
      ],
    };
    const seeds = recommendationsFromStrategyReportV3('app-1', report as never);
    expect(seeds).toHaveLength(3);
    expect(seeds.map((seed) => seed.sourceKey)).toEqual([
      'strategy-roadmap::craft_application::canvas-task',
      'strategy-roadmap::craft_application::cv-task',
      'strategy-roadmap::craft_application::statement-task',
    ]);
    expect(seeds.map((seed) => seed.actionTarget)).toEqual([
      '/ai-strategy/personal-report?return=%2Fai-strategy%2Fapp-1%2Fstrategy-report',
      '/ai-strategy/app-1/cv/target-profile',
      '/ai-strategy/app-1/statement',
    ]);
    expect(seeds[0]?.contentSchema).toEqual({ type: 'checklist', items: ['Done.', 'Verified.'] });
    expect(seeds[0]?.submitChecklist).toEqual(['Done.', 'Verified.']);
  });

  it('deduplicates repeated deliverable keys across phases', () => {
    const report = {
      strategicRoadmap: [
        { phaseKey: 'strengthen_foundation', name: 'Foundation', goal: 'Goal.', successCriteria: [], deliverables: [{ key: 'same-task', label: 'First label', kind: 'other', linkedPriorityKeys: [], tool: null, basisRefs: [] }] },
        { phaseKey: 'craft_application', name: 'Application', goal: 'Goal.', successCriteria: [], deliverables: [{ key: 'same-task', label: 'Second label', kind: 'other', linkedPriorityKeys: [], tool: null, basisRefs: [] }] },
      ],
    };

    expect(recommendationsFromStrategyReportV3('app-1', report as never)).toMatchObject([{
      sourceKey: 'strategy-roadmap::strengthen_foundation::same-task',
      title: 'First label',
    }]);
  });
});
