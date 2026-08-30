import { describe, expect, it } from 'vitest';
import { recommendationsFromStrategyReportV3 } from './strategy-v3-planner';

describe('Strategy V3 Planner handoff', () => {
  it('creates one stable seed per deliverable and preserves tool routing', () => {
    const report = {
      strategicRoadmap: [
        ...['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({
          phaseKey,
          name: phaseKey,
          goal: 'Goal.',
          successCriteria: ['Done.'],
          deliverables: phaseKey === 'craft_application' ? [{ key: `strategy-deliverable::${phaseKey}::general::application`, label: 'Draft statement', kind: 'application', linkedPriorityKeys: [], tool: 'statement_writer', basisRefs: [] }] : [],
        })),
      ],
    };
    const seeds = recommendationsFromStrategyReportV3('app-1', report as never);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.sourceKey).toBe('strategy-roadmap::craft_application::strategy-deliverable::craft_application::general::application');
    expect(seeds[0]?.actionTarget).toBe('/ai-strategy/app-1/statement');
  });
});
