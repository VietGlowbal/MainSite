import { describe, expect, it } from 'vitest';
import { stateFromSnapshotRow } from '@/lib/ai/applicant-state/context-builder';
import { buildStrategyInputContext } from './context';

describe('Strategy V3 canonical context', () => {
  it('reconstructs activities from the confirmed snapshot and excludes narrativeDetails', () => {
    const state = stateFromSnapshotRow({
      id: 'snap-1', user_id: 'user-1', application_id: 'app-1',
      payload: {
        reflection: {
          achievements: [{ id: 'achievement-1', title: 'Award', detail: 'Won it.' }],
          activities: [{ id: 'activity-1', title: 'Club', description: 'Ran sessions.' }],
          goals: 'Study data science',
        },
      },
    });
    const context = buildStrategyInputContext({
      applicationId: 'app-1',
      application: { course_id: 'course-1', course_name: 'Data Science', university_name: 'University', deadline: '2027-01-01', status: 'draft' },
      personalReport: { narrativeDetails: { unsupported: 'do not use' }, coreIdentity: {}, drivingForce: {}, signaturePattern: {}, emergingThemes: {}, personalPositioning: {}, proofOfMe: {}, overallEvidenceConfidence: 'high', generatedAt: '2026-08-30' } as never,
      matching: { contractVersion: 'matching-report-v3', metadata: { matchingEngineVersion: 'matching-v3', selectedScholarshipVersionId: null }, evidenceIndex: [], targetSourceIndex: [], hardRequirements: [], gaps: [] } as never,
      snapshotState: state,
      sourceAnalysis: null,
      targetProfile: null,
      now: new Date('2026-08-30T00:00:00Z'),
    });
    expect(context.activities.map((activity) => activity.activityId)).toEqual(['achievement:achievement-1', 'activity:activity-1']);
    expect(context.applicant.personalReport).not.toHaveProperty('narrativeDetails');
    expect(context.evidenceIndex.map((item) => item.id)).toEqual(expect.arrayContaining(['achievement:achievement-1', 'activity:activity-1', 'profile:goals']));
    expect(context.application.daysUntilDeadline).toBe(124);
  });

  it('adds Personal Report provenance to the Strategy evidence allowlist', () => {
    const state = stateFromSnapshotRow({
      id: 'snap-1', user_id: 'user-1', application_id: 'app-1',
      payload: { reflection: { studyMotivation: 'I enjoy solving practical problems.' } },
    });
    const context = buildStrategyInputContext({
      applicationId: 'app-1',
      application: { deadline: '2027-01-01' },
      personalReport: {
        coreIdentity: {
          evidenceRefs: [{ id: 'profile:reflection_q1', kind: 'profile_reflection', label: 'Interests' }],
        },
        drivingForce: {
          evidenceRefs: [{ id: 'profile:study_motivation', kind: 'profile', label: 'Study motivation' }],
        },
      } as never,
      matching: { evidenceIndex: [], targetSourceIndex: [], hardRequirements: [], gaps: [], metadata: {} } as never,
      snapshotState: state,
      sourceAnalysis: null,
      targetProfile: null,
    });

    expect(context.evidenceIndex.map((item) => item.id)).toEqual(
      expect.arrayContaining(['profile:study_motivation', 'profile:reflection_q1']),
    );
  });

  it('keeps canonical Evidence Bank claims available when Matching evidence is incomplete', () => {
    const state = stateFromSnapshotRow({
      id: 'snap-1', user_id: 'user-1', application_id: 'app-1',
      payload: { reflection: { activities: [{ id: 'activity-1', title: 'Club', description: 'Ran sessions.' }] } },
    });
    const context = buildStrategyInputContext({
      applicationId: 'app-1',
      application: {},
      personalReport: {} as never,
      matching: { evidenceIndex: [], targetSourceIndex: [], hardRequirements: [], gaps: [], metadata: {} } as never,
      snapshotState: state,
      sourceAnalysis: {
        evidenceBank: { claims: [{ id: 'academic:english_test:ielts-1', statement: 'IELTS 7.0' }] },
      } as never,
      targetProfile: null,
    });

    expect(context.evidenceIndex.map((item) => item.id)).toEqual(
      expect.arrayContaining(['experience:activity-1', 'academic:english_test:ielts-1']),
    );
  });

  it('preserves verification status instead of promoting snapshot reflections to verified evidence', () => {
    const state = stateFromSnapshotRow({
      id: 'snap-1', user_id: 'user-1', application_id: 'app-1',
      payload: {
        reflection: {
          achievements: [{ id: 'achievement-1', title: 'Award', detail: 'Won it.', evidenceKey: 'award.pdf' }],
          activities: [{ id: 'activity-1', title: 'Club', description: 'Ran sessions.' }],
        },
        documents: [{ id: 'doc-1', fileName: 'award.pdf' }],
      },
    });
    const context = buildStrategyInputContext({
      applicationId: 'app-1',
      application: {},
      personalReport: {} as never,
      matching: { evidenceIndex: [], targetSourceIndex: [], hardRequirements: [], gaps: [], metadata: {} } as never,
      snapshotState: state,
      sourceAnalysis: null,
      targetProfile: null,
    });

    expect(context.evidenceIndex.find((item) => item.id === 'achievement:achievement-1')).toMatchObject({ status: 'verified', direct: true });
    expect(context.evidenceIndex.find((item) => item.id === 'activity:activity-1')).toMatchObject({ status: 'unverified', direct: false });
    expect(context.evidenceIndex.find((item) => item.id === 'document:doc-1')).toMatchObject({ status: 'verified', direct: true });
  });
});
