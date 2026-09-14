import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from './route';

describe('POST /api/scholarships/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    });

    const response = await POST(new Request('http://localhost/api/scholarships/search', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('queries structured student_achievements and student_activities and does not select achievements from student_profiles', async () => {
    const tableSelects: Record<string, string> = {};

    const createQuery = (table: string, result: unknown) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      Object.assign(builder, {
        select: vi.fn((cols: string) => {
          tableSelects[table] = cols;
          return builder;
        }),
        eq: chain,
        not: chain,
        in: chain,
        order: chain,
        maybeSingle: async () => ({ data: result, error: null }),
        then: (resolve: (val: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve),
      });
      return builder;
    };

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'course_applications') {
          return createQuery(table, [
            {
              id: 'app-1',
              course_name: 'BSc Computing',
              university_name: 'Imperial College',
              degree_level: 'BSc',
              subject: 'Computing',
              country: 'UK',
              intake: '2026',
            },
          ]);
        }
        if (table === 'student_profiles') {
          return createQuery(table, {
            nationality: 'Vietnamese',
            country_of_residence: 'Vietnam',
            gpa: '3.9',
            degree_level: 'Undergraduate',
            subject_area: 'Computer Science',
            financial_need: 'Partial',
          });
        }
        if (table === 'student_achievements') {
          return createQuery(table, [
            { title: 'National Informatics Olympiad', year: '2025', category: 'award', level: 'National' },
          ]);
        }
        if (table === 'student_activities') {
          return createQuery(table, [
            { title: 'Coding Club President', period: '2024-2025', category: 'leadership', level: 'School' },
          ]);
        }
        return createQuery(table, null);
      }),
    });

    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                scholarships: [
                  {
                    name: 'Presidential Scholarship',
                    provider: 'Imperial',
                    amount: '£10,000',
                    currency: 'GBP',
                    coverage: 'Tuition',
                    eligibility: 'High GPA',
                    matchReason: 'Strong Olympiad background',
                    matchScore: 90,
                    difficulty: 'medium',
                    courseApplicationId: 'app-1',
                    isUniversitySpecific: true,
                    type: 'merit',
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const response = await POST(new Request('http://localhost/api/scholarships/search', { method: 'POST' }));
    expect(response.status).toBe(200);

    // Verify student_profiles was queried WITHOUT achievements
    expect(tableSelects['student_profiles']).toBeDefined();
    expect(tableSelects['student_profiles']).not.toContain('achievements');

    // Verify structured tables were queried
    expect(tableSelects['student_achievements']).toBe('title, category, level, year');
    expect(tableSelects['student_activities']).toBe('title, category, level, period');

    // Verify prompt sent to OpenAI contains structured evidence
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('National Informatics Olympiad 2025'),
      }),
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('Coding Club President 2024-2025'),
      }),
    );
  });
});
