import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidateContext } from '@/features/apply/domain';
import { buildProfileEvaluationInput } from './personal-report-v2';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function chatResponse(content: unknown) {
  return new Response(
    JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const baseContext: CandidateContext = {
  profile: { goals: 'Build hospital scheduling software.', study_motivation: 'I like solving logistics puzzles.' },
  achievements: [
    {
      id: 'careerbridge',
      title: 'CareerBridge',
      detail: 'Founded a 12-person team and reached 350 students with scholarship information.',
      evidence_key: 'olivia/careerbridge.pdf',
      organisation: 'CareerBridge',
      level: 'National',
    },
  ],
  activities: [
    {
      id: 'data',
      title: 'Student information data project',
      description: 'Surveyed 500 students to find gaps in scholarship awareness.',
    },
  ],
  englishTests: [],
  standardizedTests: [],
  documents: [],
  evidence: [],
};

describe('buildProfileEvaluationInput', () => {
  it('assembles reflectionRecords, competencyClaims, evidenceItems and narrativeActivities from one model pass each', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const userMessage = body.messages[1].content as string;
      if (userMessage.includes('CMCAITF')) {
        return Promise.resolve(
          chatResponse({
            items: [
              {
                activityId: 'achievement:careerbridge',
                context: 'At school, seeing peers miss scholarship deadlines.',
                motivation: 'Wanted to close an information gap.',
                challenge: null,
                action: 'Founded a 12-person team to run the programme.',
                impact: 'Reached 350 students.',
                transformation: null,
                future: null,
              },
              {
                activityId: 'activity:data',
                context: null,
                motivation: null,
                challenge: null,
                action: 'Surveyed 500 students.',
                impact: null,
                transformation: null,
                future: null,
              },
            ],
          }),
        );
      }
      if (userMessage.includes('competenc')) {
        return Promise.resolve(
          chatResponse({
            claims: [
              {
                id: 'c1',
                type: 'soft',
                label: 'Initiative',
                situation: 'Founded a 12-person team to close a scholarship information gap.',
                evidenceIds: ['achievement:careerbridge'],
              },
            ],
          }),
        );
      }
      return Promise.resolve(
        chatResponse({
          items: [
            { activityId: 'achievement:careerbridge', role: 'founder', domainTheme: 'education access' },
            { activityId: 'activity:data', role: 'researcher', domainTheme: 'education access' },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await buildProfileEvaluationInput({
      context: baseContext,
      subjectId: 'user-1',
      generatedAt: '2026-08-13T00:00:00.000Z',
      apiKey: 'test-key',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.narrativeActivities).toHaveLength(2);
    const careerbridge = result.narrativeActivities.find((a) => a.id === 'achievement:careerbridge');
    expect(careerbridge?.role).toBe('founder');
    expect(careerbridge?.domainTheme).toBe('education access');
    expect(careerbridge?.behaviour).toBe('Founded a 12-person team to run the programme.');
    expect(careerbridge?.outcome).toBe('Reached 350 students.');

    const evidenceItem = result.evidenceItems.find((item) => item.id === 'achievement:careerbridge');
    expect(evidenceItem?.hasDocument).toBe(true);
    expect(evidenceItem?.quantifiedOutcome).toBe('Reached 350 students.');

    expect(result.competencyClaims).toHaveLength(1);
    expect(result.intendedDirection).toBe('Build hospital scheduling software.');
    expect(result.writtenFields).toHaveLength(2);
  });

  it('makes no model calls and returns empty extraction results when there is no free text anywhere', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const emptyContext: CandidateContext = {
      profile: {},
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    };

    const result = await buildProfileEvaluationInput({
      context: emptyContext,
      subjectId: 'user-2',
      generatedAt: '2026-08-13T00:00:00.000Z',
      apiKey: 'test-key',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.narrativeActivities).toEqual([]);
    expect(result.evidenceItems).toEqual([]);
    expect(result.competencyClaims).toEqual([]);
    expect(result.intendedDirection).toBeNull();
  });
});
