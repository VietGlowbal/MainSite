import { describe, expect, it } from 'vitest';
import type { PlanResult } from './plan';
import { CORE3_PLAN_PRODUCER, reconcilePlan, type ExistingPersistedPlan } from './plan-persistence';
import type { StrategyReportV2 } from './recommendation';
import { mergeStrategyRoadmapPlan } from './strategy-roadmap-plan';

const BASE_PLAN: PlanResult = {
  id: 'plan:deterministic:test',
  readiness: 'empty',
  phases: [],
};

const F8_REPORT = {
  executionRoadmap: {
    phases: [{
      phaseKey: 'strengthen_foundation',
      name: 'Strengthen foundation',
      objective: 'Build the evidence required for the application.',
      keyActions: ['Book the English test', 'Collect official evidence'],
      deliverables: [{ key: 'ielts_booking', label: 'IELTS booking confirmation' }],
      successCriteria: ['The test is booked with a confirmed date.'],
      timeline: 'Before submitting the application',
    }],
  },
} as StrategyReportV2;

function f8Context(overrides: Record<string, unknown> = {}) {
  return {
    strategyRoadmap: {
      kind: 'f8' as const,
      data: F8_REPORT,
      provenance: {
        id: 'strategy-f8-1',
        generatedAt: '2026-08-23T00:00:00.000Z',
        inputHash: 'strategy-hash',
        promptVersion: 'strategy-report-f8-v3',
        engineVersion: null,
        modelName: 'test',
        sourceAnalysisId: null,
        sourceMatchAnalysisId: 'match-current',
      },
    },
    deadlines: [{
      date: '2026-10-01',
      kind: 'application' as const,
      source: 'course_application' as const,
      authority: 'official' as const,
      confidence: 1,
      sourceReference: 'https://example.edu/deadline',
      precedence: 'primary' as const,
    }],
    programmeRequirements: [{
      id: 'requirement-language',
      applicationId: 'app-1',
      requirementType: 'english' as const,
      title: 'English language requirement',
      requirementText: 'English language requirement',
      isMandatory: true,
      studentStatus: 'needs_review' as const,
      confidence: 1,
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
    }],
    userConstraints: [{ kind: 'study_mode' as const, value: 'part_time' }],
    plannerInputs: [{
      semanticKey: 'planner.availability',
      value: 'evenings',
      microStepId: 'availability-answer',
      provenance: 'user_provided' as const,
    }],
    ...overrides,
  };
}

describe('mergeStrategyRoadmapPlan', () => {
  it('maps F8 deliverables to deterministic canonical nodes and carries only factual planning context', () => {
    const plan = mergeStrategyRoadmapPlan(BASE_PLAN, f8Context());
    const phase = plan.phases[0];
    const step = phase?.steps[0];
    const microStep = step?.microSteps[0];

    expect(plan.readiness).toBe('requires_enrichment');
    expect(phase).toMatchObject({ id: 'phase:strategy-roadmap:strengthen_foundation' });
    expect(step).toMatchObject({ id: 'step:strategy-roadmap:strengthen_foundation:deliverables' });
    expect(microStep).toMatchObject({
      id: 'micro-step:strategy-roadmap:strengthen_foundation:ielts_booking',
      title: 'IELTS booking confirmation',
      contentSchema: { type: 'checklist', items: ['The test is booked with a confirmed date.'] },
    });
    expect(step?.objective).toContain('Application deadline: 2026-10-01');
    expect(step?.objective).toContain('Requirement: requirement-language (English language requirement)');
    expect(step?.objective).toContain('Recorded preference study_mode: part_time');
    expect(step?.objective).toContain('Recorded availability planner.availability: evenings');
    expect(microStep).not.toHaveProperty('deadline');
  });

  it('does not invent availability when no explicit availability input exists', () => {
    const plan = mergeStrategyRoadmapPlan(BASE_PLAN, f8Context({
      plannerInputs: [{
        semanticKey: 'planner.attention_focus',
        value: 'option:attention:language',
        microStepId: 'attention-answer',
        provenance: 'user_provided' as const,
      }],
    }));

    expect(plan.phases[0]?.steps[0]?.objective).not.toContain('Recorded availability');
  });

  it('keeps the F7 roadmap as the fallback when an F8 report is absent', () => {
    const plan = mergeStrategyRoadmapPlan(BASE_PLAN, f8Context({
      strategyRoadmap: {
        kind: 'f7' as const,
        data: {
          roadmap: {
            why: 'Strengthen evidence before drafting.',
            prioritize: ['Secure an official language test result'],
          },
        },
        provenance: {
          id: 'strategy-f7-1',
          generatedAt: '2026-08-23T00:00:00.000Z',
          inputHash: null,
          promptVersion: 'strategy-recommendation-f8-v2',
          engineVersion: null,
          modelName: 'test',
          sourceAnalysisId: null,
          sourceMatchAnalysisId: 'match-current',
        },
      },
    }));

    expect(plan.phases[0]).toMatchObject({ id: 'phase:strategy-roadmap:legacy' });
    expect(plan.phases[0]?.steps[0]?.microSteps[0]?.title).toBe('Secure an official language test result');
  });

  it('reconciles a regenerated F8 deliverable by stable ID without writing student execution fields', () => {
    const firstPlan = mergeStrategyRoadmapPlan(BASE_PLAN, f8Context());
    const phase = firstPlan.phases[0]!;
    const step = phase.steps[0]!;
    const microStep = step.microSteps[0]!;
    const existing: ExistingPersistedPlan = {
      plan: { id: 'db-plan', applicationId: 'app-1', producer: CORE3_PLAN_PRODUCER, domainPlanId: firstPlan.id, readiness: firstPlan.readiness, archivedAt: null },
      phases: [{ id: 'db-phase', planId: 'db-plan', domainNodeId: phase.id, title: phase.title, objective: phase.objective, order: phase.order, sourceDecisionIds: [], sourceProvenances: phase.sourceProvenances, archivedAt: null }],
      steps: [{ id: 'db-step', planId: 'db-plan', phaseId: 'db-phase', domainNodeId: step.id, title: step.title, objective: step.objective, order: step.order, sourceDecisionIds: [], sourceProvenances: step.sourceProvenances, archivedAt: null }],
      microSteps: [{ id: 'db-micro', planId: 'db-plan', stepId: 'db-step', domainNodeId: microStep.id, title: microStep.title, order: microStep.order, readiness: microStep.readiness, contentSchema: microStep.contentSchema ?? null, sourceDecisionIds: [], sourceProvenances: microStep.sourceProvenances, status: 'in_progress', deadline: '2026-09-15', contentValue: null, executionEvidence: [{ id: 'student-evidence' }], archivedAt: null }],
    };
    const revisedReport = structuredClone(F8_REPORT);
    revisedReport.executionRoadmap.phases[0]!.deliverables[0]!.label = 'Confirmed IELTS booking';
    const revisedPlan = mergeStrategyRoadmapPlan(BASE_PLAN, f8Context({
      strategyRoadmap: { ...f8Context().strategyRoadmap, data: revisedReport },
    }));

    const operations = reconcilePlan('app-1', revisedPlan, existing).operations;
    const update = operations.find((operation) => operation.kind === 'update_micro_step');

    expect(update).toMatchObject({ id: 'db-micro', fields: { domainNodeId: microStep.id, title: 'Confirmed IELTS booking' } });
    expect(update?.fields).not.toHaveProperty('status');
    expect(update?.fields).not.toHaveProperty('deadline');
    expect(update?.fields).not.toHaveProperty('contentValue');
    expect(update?.fields).not.toHaveProperty('executionEvidence');
  });
});
