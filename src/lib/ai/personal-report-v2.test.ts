import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidateContext } from '@/features/apply/domain';
import {
  applyPersonalReportSupplements,
  buildProfileEvaluationInput,
} from './personal-report-v2';
import {
  REFLECTION_ANSWER_DIMENSIONS,
} from './reflection-analysis';

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
      year: 2025,
      competition: 'National Social Innovation Challenge',
      reflection: { action: 'Founded a 12-person team.' },
      reflection_card: { keyTakeaway: 'I turn access gaps into practical systems.' },
      review_status: 'reviewed',
      source_type: 'uploaded_document',
      sources: [{ type: 'certificate', verified: true }],
    },
  ],
  activities: [
    {
      id: 'data',
      title: 'Student information data project',
      description: 'Surveyed 500 students to find gaps in scholarship awareness.',
      organisation: 'School Research Lab',
      level: 'School',
      period: '2024–2025',
      reflection: { context: 'Students lacked clear scholarship information.' },
      reflection_card: { story: 'I used data to make the gap visible.' },
      review_status: 'reviewed',
      source_type: 'student_entry',
      sources: [{ type: 'school_record' }],
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
            {
              activityId: 'achievement:careerbridge',
              role: 'founder',
              domainTheme: 'education access',
              trigger: 'The source never says this trigger.',
              problem: 'The source never says this problem.',
              ownership: 'Founded a 12-person team.',
              method: 'The source never says this method.',
            },
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
    expect(careerbridge?.narrativeEvidence).toMatchObject({
      trigger: null,
      problem: null,
      ownership: 'Founded a 12-person team.',
      method: null,
    });
    expect(careerbridge).toMatchObject({
      organisation: 'CareerBridge',
      level: 'National',
      year: 2025,
      competition: 'National Social Innovation Challenge',
      reflection: { action: 'Founded a 12-person team.' },
      reflectionCard: { keyTakeaway: 'I turn access gaps into practical systems.' },
      reviewStatus: 'reviewed',
      sourceType: 'uploaded_document',
      sources: [{ type: 'certificate', verified: true }],
    });

    const evidenceItem = result.evidenceItems.find((item) => item.id === 'achievement:careerbridge');
    expect(evidenceItem?.hasDocument).toBe(true);
    expect(evidenceItem?.quantifiedOutcome).toBe('Reached 350 students.');
    expect(evidenceItem).toMatchObject({
      organisation: 'CareerBridge',
      level: 'National',
      year: 2025,
      competition: 'National Social Innovation Challenge',
      evidenceKey: 'olivia/careerbridge.pdf',
      reviewStatus: 'reviewed',
      sourceType: 'uploaded_document',
    });

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

  it('passes Q4 into competency extraction as self-reported evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const userMessage = body.messages[1].content as string;
        const reflectionRequest = (() => {
          try {
            return JSON.parse(userMessage) as { answers?: Array<{ key: string }> };
          } catch {
            return {} as { answers?: Array<{ key: string }> };
          }
        })();
        if (reflectionRequest.answers) {
          return Promise.resolve(chatResponse({
            signals: reflectionRequest.answers.map(({ key }) => ({ key, summary: `normalized ${key}` })),
          }));
        }
        if (userMessage.includes('competenc')) {
          return Promise.resolve(
            chatResponse({
              claims: [
                {
                  id: 'q4-capability',
                  type: 'soft',
                  label: 'Ownership',
                  situation: 'I owned the entire rollout of our school tutoring platform.',
                  evidenceIds: ['profile:reflection_q4'],
                },
              ],
            }),
          );
        }
        return Promise.resolve(chatResponse({ items: [] }));
      }),
    );

    const result = await buildProfileEvaluationInput({
      context: {
        ...baseContext,
        profile: {
          ...baseContext.profile,
          personal_reflection_answers: {
            q4: 'I owned the entire rollout of our school tutoring platform.',
          },
        },
      },
      subjectId: 'user-q4',
      generatedAt: '2026-08-26T00:00:00.000Z',
      apiKey: 'test-key',
    });

    expect(result.competencyClaims).toEqual([
      expect.objectContaining({
        label: 'Ownership',
        evidenceRefs: [expect.objectContaining({ id: 'profile:reflection_q4', kind: 'profile_reflection' })],
      }),
    ]);
  });
});

describe('applyPersonalReportSupplements', () => {
  it('returns the context unchanged when there is no study_motivation or evidence supplement', () => {
    const result = applyPersonalReportSupplements(baseContext, {});
    expect(result).toBe(baseContext);
  });

  it('overlays a study_motivation answer onto a copy of the profile, without mutating the original', () => {
    const result = applyPersonalReportSupplements(baseContext, {
      study_motivation: 'I want to help hospitals reduce scheduling errors.',
    });

    expect(result.profile.study_motivation).toBe('I want to help hospitals reduce scheduling errors.');
    expect(baseContext.profile.study_motivation).toBe('I like solving logistics puzzles.');
    expect(result).not.toBe(baseContext);
    expect(result.achievements).toBe(baseContext.achievements);
  });

  it('appends quick Canvas evidence as a report-only self-reported activity', () => {
    const answer =
      'I organised a peer mentoring programme and matched 18 students with volunteer mentors.';
    const result = applyPersonalReportSupplements(baseContext, {
      'evidence:test-entry': JSON.stringify({ answer }),
    });

    expect(result).not.toBe(baseContext);
    expect(result.activities).toHaveLength(baseContext.activities.length + 1);
    expect(result.activities.at(-1)).toMatchObject({
      id: 'personal-report-evidence:test-entry',
      title: answer,
      description: answer,
      source_type: 'personal_report_supplement',
    });
    expect(baseContext.activities).toHaveLength(1);
  });

  it('ignores malformed evidence supplements and keys the report does not read', () => {
    const result = applyPersonalReportSupplements(baseContext, {
      unrelated_field: 'ignored',
      'evidence:broken': '{not-json',
    });
    expect(result).toBe(baseContext);
  });
});

/**
 * Regression coverage for the seven Personal Reflection answers (plan Task 6):
 * `buildProfileEvaluationInput` used to ignore
 * `profile.personal_reflection_answers` entirely, so Q1–Q7 never influenced
 * Identity/Direction analysis or the input hash.
 */
describe('seven personal reflection answers feed Identity/Direction signals', () => {
  const ANSWERS = {
    q1: 'I am drawn to building practical tools for my community.',
    q2: 'Growing as a patient organiser taught me to value reliability.',
    q3: 'I care about unequal access to education technology.',
    q4: 'I owned the entire rollout of our school tutoring platform.',
    q5: 'I want a computer science degree focused on human-computer interaction.',
    q6: 'In ten years I want to lead product teams in edtech.',
    q7: 'I prefer a campus with tight-knit residential colleges.',
  };

  function contextWith(answers: Record<string, string>): CandidateContext {
    return {
      ...baseContext,
      profile: { ...baseContext.profile, personal_reflection_answers: answers },
    };
  }

  async function buildWith(answers: Record<string, string>) {
    // Extraction calls get valid-but-empty responses — this suite targets
    // deterministic signal wiring, not the model.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const userMessage = body.messages[1].content as string;
        const reflectionRequest = (() => {
          try {
            return JSON.parse(userMessage) as { answers?: Array<{ key: string }> };
          } catch {
            return {} as { answers?: Array<{ key: string }> };
          }
        })();
        if (reflectionRequest.answers) {
          return Promise.resolve(chatResponse({
            signals: reflectionRequest.answers.map(({ key }) => ({ key, summary: `normalized ${key}` })),
          }));
        }
        if (userMessage.includes('competenc')) {
          return Promise.resolve(chatResponse({ claims: [] }));
        }
        if (userMessage.includes('role and domainTheme') || userMessage.includes('CMCAITF')) {
          return Promise.resolve(chatResponse({ items: [] }));
        }
        return Promise.resolve(chatResponse({ items: [] }));
      }),
    );
    return buildProfileEvaluationInput({
      context: contextWith(answers),
      subjectId: 'user-1',
      generatedAt: '2026-08-26T00:00:00.000Z',
      apiKey: 'test-key',
    });
  }

  it.each(Object.keys(ANSWERS) as Array<keyof typeof ANSWERS>)(
    'changing %s changes its mapped signal dimension and the input hash',
    async (key) => {
      const baseline = await buildWith(ANSWERS);
      const changedAnswers = { ...ANSWERS, [key]: `${ANSWERS[key]} (revised answer)` };
      const changed = await buildWith(changedAnswers);

      const dimension = REFLECTION_ANSWER_DIMENSIONS[key];
      const baseSignal = baseline.reflectionAnswerSignals?.find((signal) => signal.key === key);
      const changedSignal = changed.reflectionAnswerSignals?.find((signal) => signal.key === key);

      expect(dimension).toBeTruthy();
      expect(baseSignal?.value).toBe(ANSWERS[key]);
      expect(changedSignal?.value).toBe(`${ANSWERS[key]} (revised answer)`);

      expect(JSON.stringify(baseline)).not.toEqual(JSON.stringify(changed));
    },
  );

  it('drops empty answers entirely from the built signals', () => {
    // Covered exhaustively in reflection-analysis.test.ts; here just prove
    // the pipeline tolerates a context with no answers at all.
    return buildWith({}).then((result) => {
      expect(result.reflectionAnswerSignals).toEqual([]);
    });
  });

  it('routes Q4 to capability evidence and Q7 to environment/direction, without promoting Q4–Q7 into motivation', async () => {
    const result = await buildWith(ANSWERS);

    expect(result.capabilitySignals).toEqual([
      expect.objectContaining({ key: 'q4', dimension: 'capability_ownership', status: 'isolated' }),
    ]);
    expect(result.directionSignals).toMatchObject({
      academicDirection: 'normalized q5',
      careerDirection: 'normalized q6',
      preferredEnvironment: 'normalized q7',
    });
    const motivationIds = (result.profileMotivations ?? []).map((item) => item.id);
    expect(motivationIds).toEqual(expect.arrayContaining(['profile:reflection_q1', 'profile:reflection_q2', 'profile:reflection_q3']));
    expect(motivationIds).not.toEqual(expect.arrayContaining([
      'profile:reflection_q4',
      'profile:reflection_q5',
      'profile:reflection_q6',
      'profile:reflection_q7',
    ]));
  });

  it('marks a reflection signal repeated only when activity text independently corroborates it', async () => {
    const result = await buildWith({ ...ANSWERS, q3: 'I care about scholarship awareness and student access.' });
    expect(result.reflectionAnswerSignals?.find((signal) => signal.key === 'q3')?.status).toBe('repeated');
  });
});
