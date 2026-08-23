import { describe, expect, it } from 'vitest';
import { isPlannerStale, plannerLifecycle, plannerSourceFingerprint } from './planner-ops';

const context = (overrides: Record<string, unknown> = {}) => ({
  programme: { applicationId: 'app', courseId: 'course', universityId: 1, universityName: 'Uni', courseName: 'Course', degreeLevel: 'BSc', subject: 'CS', country: 'UK', studyMode: 'full-time', intake: '2027', applicationMethod: 'UCAS', applicationCode: null, applicationStatus: 'draft' },
  programmeRequirements: [{ id: 'req-1', requirementType: 'academic', title: 'Grade', requirementText: 'A', isMandatory: true, studentStatus: 'unknown', confidence: 1, sourceUrl: null }],
  identifiedGaps: [], interventionCandidates: [], deadlines: [], userConstraints: [], plannerInputs: [], strategy: null,
  ...overrides,
} as never);

describe('Planner Ops source freshness', () => {
  it('is stable for equivalent input ordering', () => {
    const first = plannerSourceFingerprint(context({ userConstraints: [{ kind: 'budget', value: '1000' }, { kind: 'study_mode', value: 'online' }] }));
    const second = plannerSourceFingerprint(context({ userConstraints: [{ kind: 'study_mode', value: 'online' }, { kind: 'budget', value: '1000' }] }));
    expect(first).toBe(second);
  });

  it('changes for a requirement but not execution-only fields', () => {
    const first = plannerSourceFingerprint(context());
    expect(plannerSourceFingerprint(context({ programmeRequirements: [{ id: 'req-1', requirementType: 'academic', title: 'Grade', requirementText: 'A*', isMandatory: true, studentStatus: 'unknown', confidence: 1, sourceUrl: null }] }))).not.toBe(first);
    expect(plannerSourceFingerprint(context({ executionStatus: 'completed', executionDeadline: '2030-01-01' }))).toBe(first);
    expect(isPlannerStale(first, first)).toBe(false);
    expect(isPlannerStale('planner-fnv1a-32:aaaaaaaa', first)).toBe(true);
  });

  it('changes when a planning-relevant F7 strategy changes', () => {
    expect(plannerSourceFingerprint(context({ strategy: { direction: 'research' } }))).not.toBe(plannerSourceFingerprint(context({ strategy: { direction: 'industry' } })));
  });

  it('maps read-model states without conflating empty and complete', () => {
    const plan = { id: 'plan', applicationId: 'app', producer: 'core3_deterministic', domainPlanId: 'plan:source:planner-fnv1a-32:aaaaaaaa', readiness: 'requires_enrichment' as const };
    const base = { plan, phases: [], lifecycle: 'active' as const, diagnostics: [] };
    expect(plannerLifecycle({ readModel: null, stale: false })).toBe('initializing');
    expect(plannerLifecycle({ readModel: base, stale: false })).toBe('ready');
    expect(plannerLifecycle({ readModel: { ...base, lifecycle: 'waiting_for_input' }, stale: false })).toBe('waiting_for_input');
    expect(plannerLifecycle({ readModel: { ...base, lifecycle: 'complete' }, stale: false })).toBe('complete');
    expect(plannerLifecycle({ readModel: base, stale: true })).toBe('stale');
    expect(plannerLifecycle({ readModel: base, stale: true, refreshing: true })).toBe('refreshing');
    expect(plannerLifecycle({ readModel: base, stale: false, failed: true })).toBe('failed');
  });
});
