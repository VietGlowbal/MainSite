import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lorAiLimiter } from '@/lib/rate-limiter';

const {
  createClientMock,
  fetchApplicationWorkspaceMock,
  fromMock,
  profileResultMock,
  profileSelectMock,
  strategyResultMock,
  activityResultMock,
  rpcMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fetchApplicationWorkspaceMock: vi.fn(),
  fromMock: vi.fn(),
  profileResultMock: vi.fn(),
  profileSelectMock: vi.fn(),
  strategyResultMock: vi.fn(),
  activityResultMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: fetchApplicationWorkspaceMock,
}));

import { POST } from './route';

const activityId = '22222222-2222-4222-8222-222222222222';
const lorModelReview = {
  summary: 'A credible letter with specific evidence and a clear recommender voice.',
  dimensions: [
    { id: 'recommender_context', score: 4, rationale: 'The relationship is clear.' },
    { id: 'specific_evidence', score: 9, rationale: 'Examples are concrete.' },
    { id: 'quality_depth', score: 9, rationale: 'Qualities are interpreted.' },
    { id: 'recommender_voice', score: 9, rationale: 'The perspective is personal.' },
    { id: 'evidence_credibility', score: 9, rationale: 'Claims fit the relationship.' },
    { id: 'applicant_differentiation', score: 9, rationale: 'Peer context is present.' },
    { id: 'growth_potential', score: 9, rationale: 'Growth is visible.' },
    { id: 'complementarity', score: 8, rationale: 'The letter adds new insight.' },
    { id: 'recommendation_strength', score: 5, rationale: 'The endorsement is explicit.' },
  ],
  whatWorksWell: [
    {
      title: 'Clear recommender relationship',
      explanation: 'Two years of direct observation are established.',
      evidenceQuote: 'A concrete recommendation grounded in classroom evidence.',
    },
  ],
  improvements: [
    {
      title: 'Add comparative context',
      explanation: 'The applicant is not compared with peers.',
      suggestion: 'If accurate, explain how the applicant stands out among peers.',
    },
  ],
  profileCoverage: [
    {
      trait: 'Analytical thinking',
      status: 'strongly_supported',
      explanation: 'Supported by the research example.',
    },
  ],
  suggestions: [
    {
      id: 'sug-1',
      type: 'missing',
      category: 'Applicant Differentiation',
      originalText: 'A concrete recommendation grounded in classroom evidence.',
      replacement: '[Add an accurate comparison with peers, if supported.]',
      explanation: 'Comparative context makes the endorsement more informative.',
    },
  ],
};

describe('POST /api/ai/analyze-statement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lorAiLimiter.resetAll();
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4o');
    profileResultMock.mockResolvedValue({
      data: { plus_status: false, sop_analyses_used: 0 },
    });
    profileSelectMock.mockImplementation(() => ({
      eq: vi.fn(() => ({ maybeSingle: profileResultMock })),
    }));
    strategyResultMock.mockResolvedValue({ data: null, error: null });
    activityResultMock.mockResolvedValue({ data: [], error: null });
    rpcMock.mockResolvedValue({ data: true, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'student_profiles') {
        return {
          select: profileSelectMock,
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }
      if (table === 'application_lor_strategies') {
        const strategyQuery: Record<string, ReturnType<typeof vi.fn>> = {};
        strategyQuery.select = vi.fn(() => strategyQuery);
        strategyQuery.eq = vi.fn(() => strategyQuery);
        strategyQuery.maybeSingle = strategyResultMock;
        return strategyQuery;
      }
      if (table === 'student_activities') {
        const activityQuery: Record<string, ReturnType<typeof vi.fn>> = {};
        activityQuery.select = vi.fn(() => activityQuery);
        activityQuery.eq = vi.fn(() => activityQuery);
        activityQuery.in = vi.fn(() => activityResultMock());
        return activityQuery;
      }
      if (table === 'student_achievements') {
        const achievementQuery: Record<string, ReturnType<typeof vi.fn>> = {};
        achievementQuery.select = vi.fn(() => achievementQuery);
        achievementQuery.eq = vi.fn(() => achievementQuery);
        achievementQuery.in = vi.fn(async () => ({ data: [], error: null }));
        return achievementQuery;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null })),
                })),
              })),
            })),
          })),
        })),
      };
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
      },
      from: fromMock,
      rpc: rpcMock,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    score: 80,
                    summary: 'Tốt',
                    suggestions: [],
                    checklist: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
  });

  it('returns 400 for malformed request JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('uses OpenAI directly for non-VinUni statement reviews', async () => {
    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'A sufficiently long personal statement for another university.',
          targetUniversity: 'University of Cambridge',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer openai-key' }),
        signal: expect.any(AbortSignal),
      }),
    );
    const requestBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(requestBody).toMatchObject({
      model: 'gpt-4o',
      max_tokens: 1200,
    });
  });

  it('returns 504 when the upstream AI request times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A sufficiently long personal statement for review.' }),
      }),
    );

    expect(response.status).toBe(504);
  });

  it('grounds LOR feedback in the owned application context without CV/profile content', async () => {
    profileResultMock.mockResolvedValue({
      data: {
        plus_status: true,
        sop_analyses_used: 0,
        profile_summary: 'Private profile summary must not reach the LOR prompt.',
        bio: 'Private biography must not reach the LOR prompt.',
      },
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: {
        universityName: 'University of Cambridge',
        courseName: 'Computer Science',
        degreeLevel: 'Undergraduate',
        subject: 'Computer Science',
        aiSummary: 'A research-focused programme.',
      },
      course: {
        entryRequirementsSummary: 'Strong mathematics preparation is required.',
      },
      requirements: [
        { requirementText: 'Two academic references are required.', isMandatory: true },
      ],
      sources: [
        {
          title: 'Official Computer Science admissions page',
          url: 'https://cam.ac.uk/computer-science',
          description: 'Official programme information',
          isOfficial: true,
        },
      ],
    });
    strategyResultMock.mockResolvedValue({
      data: {
        recommender_type: 'subject_teacher',
        relationship_context: 'She taught me Economics for two years.',
        known_duration: 'one_to_two_years',
        observed_evidence: [{ kind: 'activity', id: activityId }],
        perspective: {
          summary: 'The recommender can credibly discuss analytical thinking.',
          strongInsights: [],
          limitedInsights: [],
        },
        recommendations: [
          {
            trait: 'Analytical thinking',
            rationale: 'Directly observed in research.',
            evidenceRefs: [`activity:${activityId}`],
            howToRaise: 'Ask whether she is comfortable discussing the research.',
            priority: 'high',
            confidence: 'high',
          },
        ],
        do_not_prioritize: [],
        recommendation_brief: 'Please highlight analytical thinking if accurate.',
      },
      error: null,
    });
    activityResultMock.mockResolvedValue({
      data: [
        {
          id: activityId,
          title: 'Independent economics research',
          category: 'innovation',
          organisation: 'School',
          level: 'school',
          period: '2025',
          description: 'Analyzed student decision-making.',
        },
      ],
      error: null,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(lorModelReview) } }],
        }),
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchApplicationWorkspaceMock).toHaveBeenCalledWith('app-1', 'user-1');
    const requestBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    const prompt = JSON.stringify(requestBody.messages);
    expect(prompt).toContain('University of Cambridge');
    expect(prompt).toContain('Computer Science');
    expect(prompt).toContain('Strong mathematics preparation is required.');
    expect(prompt).toContain('Two academic references are required.');
    expect(prompt).toContain('recommender');
    expect(prompt).toContain('She taught me Economics for two years.');
    expect(prompt).toContain('Analytical thinking');
    expect(prompt).toContain('Independent economics research');
    expect(prompt).not.toContain('CV summary');
    expect(prompt).not.toContain('Student background');
    expect(prompt).not.toContain('Private profile summary');
    expect(fromMock).not.toHaveBeenCalledWith('uploaded_documents');
    expect(profileSelectMock).toHaveBeenCalledWith('plus_status, sop_analyses_used');
    expect(requestBody.max_tokens).toBe(3500);
    expect(await response.json()).toMatchObject({
      rawScore: 71,
      score: 84,
      recommendation: 'Strong and credible',
      dimensions: expect.arrayContaining([
        expect.objectContaining({ id: 'recommender_context', maxScore: 5 }),
      ]),
      whatWorksWell: lorModelReview.whatWorksWell,
      improvements: lorModelReview.improvements,
      profileCoverage: lorModelReview.profileCoverage,
    });
  });

  it('rate limits repeated LOR quality reviews per user', async () => {
    profileResultMock.mockResolvedValue({
      data: { plus_status: true, sop_analyses_used: 0 },
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(lorModelReview) } }],
        }),
      ),
    );
    const request = () =>
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      });
    const responses = [];

    for (let index = 0; index < 4; index += 1) responses.push(await POST(request()));

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 429]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not return a free LOR review when the atomic quota consume is denied', async () => {
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    rpcMock.mockResolvedValue({ data: false, error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(lorModelReview) } }],
        }),
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith(
      'consume_statement_review',
      expect.objectContaining({ review_limit: expect.any(Number) }),
    );
    expect(response.status).toBe(402);
  });

  it('bypasses LOR review quota without consuming usage in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { POST: developmentPost } = await import('./route');
    profileResultMock.mockResolvedValue({
      data: { plus_status: false, sop_analyses_used: 3 },
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(lorModelReview) } }],
        }),
      ),
    );

    const response = await developmentPost(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('does not call AI when the LOR usage profile is unavailable', async () => {
    profileResultMock.mockResolvedValue({ data: null });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reviews without strategy context and states that limitation in the prompt', async () => {
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(lorModelReview) } }],
        }),
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(200);
    const requestBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(JSON.stringify(requestBody.messages)).toContain(
      'No saved recommender strategy is available',
    );
  });

  it('does not review an LOR for an application the user cannot access', async () => {
    fetchApplicationWorkspaceMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'another-users-app',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it.each([
    ['shorter than 80 characters', 'A'.repeat(79)],
    ['longer than 15,000 characters', 'A'.repeat(15_001)],
  ])('rejects an LOR %s', async (_case, text) => {
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text,
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('returns 502 when the LOR analysis is not valid JSON', async () => {
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: 'not valid json' } }] }),
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(502);
  });

  it('returns 502 when the LOR analysis does not match the feedback schema', async () => {
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: { universityName: 'Cambridge', courseName: 'Computer Science' },
      requirements: [],
      sources: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify({ score: 72, summary: 'Incomplete' }) } }],
        }),
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/ai/analyze-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'app-1',
          docType: 'recommendation_letter',
          text: 'A concrete recommendation grounded in classroom evidence. '.repeat(2),
        }),
      }),
    );

    expect(response.status).toBe(502);
  });
});
