import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/ai-strategy-dashboard/domain', async () => ({
  deriveCourseMatchAnalysis: (await import('@/features/ai-strategy-dashboard/domain/course-match')).deriveCourseMatchAnalysis,
}));
import { GET } from './route';

describe('course match compatibility reader', () => {
  it('reads a completed V3 record without crashing or converting unavailable scores to zero', async () => {
    const queries: Record<string, { eq: ReturnType<typeof vi.fn> }> = {};
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      from: (table: string) => {
        const row = table === 'course_applications' ? { id: 'app' } : {
          pillars: {}, inputs_present: {}, confidence: 0,
          current_match_score: null, max_possible_match_score: null,
        };
        const query = {
          select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
          maybeSingle: async () => ({ data: row }),
        };
        queries[table] = query;
        return query;
      },
    });
    const response = await GET(new Request('https://example.test/api/applications/app/strategy/course-match'), {
      params: Promise.resolve({ id: 'app' }),
    });
    expect(response.status).toBe(200);
    const { analysis } = await response.json();
    expect(analysis.overallMatchPercent).toBeNull();
    expect(analysis.goalMatchPercent).toBeNull();
    expect(analysis.entryRequirementMatch.score).toBeNull();
    expect(analysis.experienceMatch.score).toBeNull();
    expect(analysis.personalQualitiesMatch.score).toBeNull();
    expect(queries.application_match_analyses!.eq).toHaveBeenCalledWith('user_id', 'user');
    expect(queries.application_match_analyses!.eq).toHaveBeenCalledWith('analysis_status', 'complete');
  });
});
