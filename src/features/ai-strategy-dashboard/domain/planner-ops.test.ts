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

  it('changes for profile, evidence, missing-input, F5, F7, answer, and attention changes', () => {
    const base = { ...(context({
      applicantState: { evidence: { strength: 'low' } },
      existingEvidence: { verified: [{ id: 'e-1' }], attributable: [], stated: [] },
      evidenceNeedsProof: [],
      missingEvidence: [],
      missingInputSignals: [],
      provenance: { sourceDiagnostics: [], personalReport: null, programmeFit: null, strategy: null },
      interventionCandidates: [{ source: 'f5_improvement', sourceAnalysisId: 'f5-1', action: { id: 'a-1', title: 'Improve evidence' } }],
      plannerInputs: [{ semanticKey: 'attention-focus', value: 'evidence', microStepId: 'micro-1', provenance: 'user_provided' }],
      strategy: { direction: 'research', priorities: ['evidence', 'essay'] },
    })) as Record<string, unknown> };
    const first = plannerSourceFingerprint(base as never);
    for (const changed of [
      { applicantState: { evidence: { strength: 'high' } } },
      { existingEvidence: { verified: [{ id: 'e-2' }], attributable: [], stated: [] } },
      { missingEvidence: [{ description: 'Transcript', reason: 'required', source: 'programme_requirement' }] },
      { missingInputSignals: [{ description: 'growth', frameworkContext: 'f4' }] },
      { interventionCandidates: [{ source: 'f5_improvement', sourceAnalysisId: 'f5-1', action: { id: 'a-1', title: 'Improve writing' } }] },
      { interventionCandidates: [{ source: 'f7_priority', sourceAnalysisId: 'f7-1', label: 'Portfolio', rationale: 'Differentiate' }] },
      { plannerInputs: [{ semanticKey: 'attention-focus', value: 'portfolio', microStepId: 'micro-1', provenance: 'user_provided' }] },
      { provenance: { sourceDiagnostics: [], staleness: { personalReport: 'stale', programmeFit: 'current', strategy: 'current' }, personalReport: null, programmeFit: null, strategy: null } },
    ]) {
      expect(plannerSourceFingerprint({ ...base, ...changed } as never)).not.toBe(first);
    }
  });

  it('preserves semantic order but normalizes unordered collections', () => {
    const ordered = context({ strategy: { priorities: ['one', 'two'] } });
    const swapped = context({ strategy: { priorities: ['two', 'one'] } });
    expect(plannerSourceFingerprint(ordered)).not.toBe(plannerSourceFingerprint(swapped));
    const unorderedFirst = context({ userConstraints: [{ kind: 'budget', value: '1000' }, { kind: 'study_mode', value: 'online' }] });
    const unorderedSecond = context({ userConstraints: [{ kind: 'study_mode', value: 'online' }, { kind: 'budget', value: '1000' }] });
    expect(plannerSourceFingerprint(unorderedFirst)).toBe(plannerSourceFingerprint(unorderedSecond));
    expect(plannerSourceFingerprint(context({ executionStatus: 'completed', executionDeadline: '2030-01-01', feedback: 5, view: 'board', collapsed: true }))).toBe(plannerSourceFingerprint(context()));
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
