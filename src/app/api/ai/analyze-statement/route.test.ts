import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  fetchApplicationWorkspaceMock,
  fromMock,
  profileResultMock,
  profileSelectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fetchApplicationWorkspaceMock: vi.fn(),
  fromMock: vi.fn(),
  profileResultMock: vi.fn(),
  profileSelectMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: fetchApplicationWorkspaceMock,
}));

import { POST } from './route';

describe('POST /api/ai/analyze-statement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-key');
    vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-v4-pro');
    vi.stubEnv('OPENAI_API_KEY', '');
    profileResultMock.mockResolvedValue({
      data: { plus_status: false, sop_analyses_used: 0 },
    });
    profileSelectMock.mockImplementation(() => ({
      eq: vi.fn(() => ({ maybeSingle: profileResultMock })),
    }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'student_profiles') {
        return {
          select: profileSelectMock,
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
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

  it('uses DeepSeek directly for non-VinUni statement reviews', async () => {
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
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer deepseek-key' }),
      }),
    );
    const requestBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(requestBody).toMatchObject({
      model: 'deepseek-v4-pro',
      thinking: { type: 'disabled' },
      max_tokens: 1200,
    });
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
    expect(prompt).not.toContain('CV summary');
    expect(prompt).not.toContain('Student background');
    expect(prompt).not.toContain('Private profile summary');
    expect(fromMock).not.toHaveBeenCalledWith('uploaded_documents');
    expect(profileSelectMock).toHaveBeenCalledWith('plus_status, sop_analyses_used');
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
