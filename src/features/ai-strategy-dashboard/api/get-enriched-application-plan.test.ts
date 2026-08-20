import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ assessments: vi.fn(), enrich: vi.fn() }));
vi.mock('./get-application-assessments', () => ({ getApplicationAssessments: mocks.assessments }));
vi.mock('./generate-plan-enrichment', () => ({ generatePlanEnrichment: mocks.enrich }));

import { getEnrichedApplicationPlan } from './get-enriched-application-plan';

describe('getEnrichedApplicationPlan', () => {
  it('binds the deterministic planning-context fingerprint into the plan sent to AI', async () => {
    const context = { plannerInputs: [], provenance: { contextHash: 'core1-fnv1a-32:abc12345' } };
    mocks.assessments.mockResolvedValue({ context, assessments: [] });
    mocks.enrich.mockResolvedValue({ plan: null, enriched: false });

    await getEnrichedApplicationPlan({} as never, 'application-1', 'user-1');

    expect(mocks.enrich).toHaveBeenCalledWith(expect.objectContaining({
      scaffold: expect.objectContaining({ id: expect.stringContaining(':source:core1-fnv1a-32:abc12345') }),
      context,
    }));
  });
});
