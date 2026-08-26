import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ assessments: vi.fn(), enrich: vi.fn() }));
vi.mock('./get-application-assessments', () => ({ getApplicationAssessments: mocks.assessments }));
vi.mock('./generate-plan-enrichment', () => ({ generatePlanEnrichment: mocks.enrich }));

import { getEnrichedApplicationPlan } from './get-enriched-application-plan';

describe('getEnrichedApplicationPlan', () => {
  it('binds the deterministic planning-context fingerprint into the plan sent to AI', async () => {
    const context = { programme: {}, programmeRequirements: [], identifiedGaps: [], interventionCandidates: [], deadlines: [], userConstraints: [], plannerInputs: [], strategy: null, provenance: { contextHash: 'core1-fnv1a-32:abc12345' } };
    mocks.assessments.mockResolvedValue({ context, assessments: [] });
    mocks.enrich.mockResolvedValue({ plan: null, enriched: false });

    await getEnrichedApplicationPlan({} as never, 'application-1', 'user-1');

    expect(mocks.enrich).toHaveBeenCalledWith(expect.objectContaining({
      scaffold: expect.objectContaining({ id: expect.stringMatching(/:source:planner-fnv1a-32:[0-9a-f]{8}$/) }),
      context,
    }));
  });

  it('sends the selected F8 execution roadmap through the canonical scaffold before enrichment', async () => {
    const context = {
      plannerInputs: [],
      interventionCandidates: [],
      identifiedGaps: [],
      deadlines: [],
      programmeRequirements: [],
      userConstraints: [],
      strategyRoadmap: {
        kind: 'f8' as const,
        data: {
          executionRoadmap: {
            phases: [{
              phaseKey: 'craft_application',
              name: 'Craft application',
              objective: 'Turn the evidence into a clear application.',
              keyActions: ['Draft the statement'],
              deliverables: [{ key: 'statement_draft', label: 'Statement draft' }],
              successCriteria: ['The draft is complete.'],
              timeline: 'Before the deadline',
            }],
          },
        },
        provenance: {
          id: 'strategy-f8-1', generatedAt: '2026-08-23T00:00:00.000Z', inputHash: 'hash', promptVersion: 'strategy-report-f8-v3', engineVersion: null, modelName: 'test', sourceAnalysisId: null, sourceMatchAnalysisId: 'match-1',
        },
      },
      provenance: { contextHash: 'core1-fnv1a-32:f8' },
    };
    mocks.assessments.mockResolvedValue({ context, assessments: [] });
    mocks.enrich.mockResolvedValue({ plan: null, enriched: false });

    await getEnrichedApplicationPlan({} as never, 'application-1', 'user-1');

    expect(mocks.enrich).toHaveBeenCalledWith(expect.objectContaining({
      scaffold: expect.objectContaining({
        phases: expect.arrayContaining([
          expect.objectContaining({
            id: 'phase:strategy-roadmap:craft_application',
            steps: [expect.objectContaining({
              id: 'step:strategy-roadmap:craft_application:deliverables',
              microSteps: [expect.objectContaining({ id: 'micro-step:strategy-roadmap:craft_application:statement_draft' })],
            })],
          }),
        ]),
      }),
    }));
  });
});
