import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lorAiLimiter } from '@/lib/rate-limiter';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  fetchApplicationWorkspace: vi.fn(),
  from: vi.fn(),
  activitySelect: vi.fn(),
  activityEq: vi.fn(),
  activityIn: vi.fn(),
  achievementSelect: vi.fn(),
  achievementEq: vi.fn(),
  achievementIn: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: mocks.fetchApplicationWorkspace,
}));

const strategy = {
  perspective: {
    summary: 'Ms. Nguyen has direct academic and research observation.',
    strongInsights: [
      {
        trait: 'Analytical thinking',
        explanation: 'She supervised the selected research activity.',
        evidenceRefs: [`activity:${ACTIVITY_ID}`],
      },
    ],
    limitedInsights: [
      {
        topic: 'Community leadership',
        explanation: 'No direct observation was selected.',
      },
    ],
  },
  recommendations: [
    {
      trait: 'Analytical problem-solving',
      rationale: 'It is directly supported by the supervised research.',
      evidenceRefs: [`activity:${ACTIVITY_ID}`],
      howToRaise: 'Ask whether she feels comfortable discussing the research process.',
      priority: 'high',
      confidence: 'high',
    },
  ],
  doNotPrioritize: [
    { trait: 'Community leadership', reason: 'The recommender did not directly observe it.' },
  ],
  recommendationBrief: 'Dear Ms. Nguyen, thank you for supporting my application.',
};

function request(body: unknown) {
  return new Request('http://localhost/api/ai/lor-strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  applicationId: APP_ID,
  recommenderType: 'subject_teacher',
  relationshipContext:
    'She taught me Economics for two years and supervised my independent research project.',
  knownDuration: 'one_to_two_years',
  observedEvidence: [{ kind: 'activity', id: ACTIVITY_ID }],
};

describe('POST /api/ai/lor-strategy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lorAiLimiter.resetAll();
    process.env.DEEPSEEK_API_KEY = 'test-key';

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.fetchApplicationWorkspace.mockResolvedValue({
      application: {
        universityName: 'University of Cambridge',
        courseName: 'Economics',
        degreeLevel: 'undergraduate',
        subject: 'Economics',
        aiSummary: 'A rigorous programme focused on economic analysis.',
      },
      course: { entryRequirementsSummary: 'Strong mathematics preparation.' },
      requirements: [{ requirementText: 'One academic reference is required.' }],
      sources: [],
    });

    const activityQuery = {
      select: mocks.activitySelect,
      eq: mocks.activityEq,
      in: mocks.activityIn,
    };
    mocks.activitySelect.mockReturnValue(activityQuery);
    mocks.activityEq.mockReturnValue(activityQuery);
    mocks.activityIn.mockResolvedValue({
      data: [
        {
          id: ACTIVITY_ID,
          category: 'innovation',
          title: 'Independent economics research',
          organisation: 'School',
          level: 'school',
          period: '2025',
          description: 'Surveyed students and analyzed university decision-making.',
        },
      ],
      error: null,
    });

    const achievementQuery = {
      select: mocks.achievementSelect,
      eq: mocks.achievementEq,
      in: mocks.achievementIn,
    };
    mocks.achievementSelect.mockReturnValue(achievementQuery);
    mocks.achievementEq.mockReturnValue(achievementQuery);
    mocks.achievementIn.mockResolvedValue({ data: [], error: null });

    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_activities') return activityQuery;
      if (table === 'student_achievements') return achievementQuery;
      if (table === 'application_lor_strategies') return { upsert: mocks.upsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(strategy) } }] }),
      }),
    );
  });

  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import('./route');

    const response = await POST(request(validBody));

    expect(response.status).toBe(401);
  });

  it('rejects malformed F7.1 input', async () => {
    const { POST } = await import('./route');

    const response = await POST(request({ ...validBody, relationshipContext: 'short' }));

    expect(response.status).toBe(400);
  });

  it('hides inaccessible applications', async () => {
    mocks.fetchApplicationWorkspace.mockResolvedValue(null);
    const { POST } = await import('./route');

    const response = await POST(request(validBody));

    expect(response.status).toBe(404);
  });

  it('rejects selected evidence that cannot be reloaded for the owner', async () => {
    mocks.activityIn.mockResolvedValue({ data: [], error: null });
    const { POST } = await import('./route');

    const response = await POST(request(validBody));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'One or more selected experiences are invalid.' });
  });

  it('uses trusted programme and selected evidence, then persists the strategy', async () => {
    const { POST } = await import('./route');

    const response = await POST(request(validBody));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual(strategy);
    expect(mocks.activityEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.activityIn).toHaveBeenCalledWith('id', [ACTIVITY_ID]);
    const aiRequest = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(aiRequest?.signal).toBeInstanceOf(AbortSignal);
    const aiBody = JSON.parse(String(aiRequest?.body));
    const prompt = aiBody.messages.map((message: { content: string }) => message.content).join('\n');
    expect(prompt).toContain('University of Cambridge');
    expect(prompt).toContain('Independent economics research');
    expect(prompt).toContain(`activity:${ACTIVITY_ID}`);
    expect(prompt).not.toMatch(/cv summary|uploaded_documents|résumé/i);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: APP_ID,
        user_id: 'user-1',
        observed_evidence: validBody.observedEvidence,
        perspective: strategy.perspective,
        recommendations: strategy.recommendations,
        recommendation_brief: strategy.recommendationBrief,
      }),
      { onConflict: 'application_id' },
    );
  });

  it('rate limits repeated LOR strategy generations per user', async () => {
    const { POST } = await import('./route');
    const responses = [];

    for (let index = 0; index < 4; index += 1) {
      responses.push(await POST(request(validBody)));
    }

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 429]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns 504 when strategy generation times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      }),
    );
    const { POST } = await import('./route');

    const response = await POST(request(validBody));

    expect(response.status).toBe(504);
  });

  it('rejects an invalid model response without persisting it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"perspective":{}}' } }] }),
      }),
    );
    const { POST } = await import('./route');

    const response = await POST(request(validBody));

    expect(response.status).toBe(502);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
