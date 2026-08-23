import { describe, expect, it } from 'vitest';
import { isPlannerStale, plannerSourceFingerprint } from './planner-ops';

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
    expect(isPlannerStale(first, first)).toBe(false);
    expect(isPlannerStale('planner-fnv1a-32:aaaaaaaa', first)).toBe(true);
  });
});
