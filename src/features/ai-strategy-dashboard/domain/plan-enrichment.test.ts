import { describe, expect, it } from 'vitest';
import { mergePlanEnrichment, validatePlanEnrichment } from './plan-enrichment';
import type { PlanResult } from './plan';

const scaffold: PlanResult = { id: 'plan:one', readiness: 'requires_enrichment', phases: [{ id: 'phase:resolve_blockers', title: 'Resolve blockers', objective: 'Resolve.', order: 1, sourceDecisionIds: ['decision:blocker'], sourceProvenances: ['database_factual'], steps: [{ id: 'step:old', title: 'Old', objective: 'Old', order: 1, sourceDecisionIds: ['decision:blocker'], sourceProvenances: ['database_factual'], microSteps: [{ id: 'micro:old', title: 'Old', order: 1, readiness: 'requires_enrichment', sourceDecisionIds: ['decision:blocker'], sourceProvenances: ['database_factual'] }] }] }] };
const decisions = [{ id: 'decision:blocker', status: 'blocked', subject: 'English', title: 'Gap', summary: 'Gap', options: [], supportingAssessmentIds: [], blockingAssessmentIds: [], mode: 'deterministic' }] as never[];
const valid = { version: 'core3-plan-enrichment-v1', phases: [{ sourceDecisionId: 'decision:blocker', steps: [{ clientKey: 'english-diagnostic', title: 'Compare your score', objective: 'Identify the gap.', microSteps: [{ clientKey: 'collect-score', title: 'Record your current score' }] }] }] };

describe('plan enrichment validation and merge', () => {
  it('accepts safe structured output and gives AI nodes stable IDs/provenance', () => {
    const result = validatePlanEnrichment({ scaffold, enrichment: valid, decisions, assessments: [], allowedDecisionIds: ['decision:blocker'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const plan = mergePlanEnrichment(scaffold, result.enrichment, { kind: 'ai_planning', provider: 'openai', model: 'test', promptVersion: 'v1', enrichmentVersion: 'v1', generatedAt: '2026-01-01T00:00:00Z', sourceDecisionIds: ['decision:blocker'] });
    expect(plan.phases[0]?.steps[0]?.id).toBe('ai:decision-blocker:step:english-diagnostic');
    expect(plan.phases[0]?.steps[0]?.microSteps[0]?.id).toBe('ai:decision-blocker:micro:english-diagnostic:collect-score');
    expect(plan.phases[0]?.steps[0]?.sourceProvenances).toContainEqual(expect.objectContaining({ kind: 'ai_planning' }));
  });

  it.each([
    [{ ...valid, phases: [{ ...valid.phases[0], sourceDecisionId: 'decision:unknown' }] }],
    [{ ...valid, phases: [{ ...valid.phases[0], steps: [{ ...valid.phases[0]!.steps[0], microSteps: [{ clientKey: 'x', title: 'Do work', deadline: '2030-01-01' }] }] }] }],
    [{ ...valid, phases: [{ ...valid.phases[0], steps: [{ ...valid.phases[0]!.steps[0], microSteps: [{ clientKey: 'x', title: 'Do work', status: 'completed' }] }] }] }],
  ])('rejects forbidden or out-of-scope model output', (enrichment) => {
    expect(validatePlanEnrichment({ scaffold, enrichment, decisions, assessments: [], allowedDecisionIds: ['decision:blocker'] }).ok).toBe(false);
  });
});
