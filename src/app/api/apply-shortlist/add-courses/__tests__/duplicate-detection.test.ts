import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

/**
 * Tests for Task 13.4: Duplicate Detection
 * 
 * Tests the duplicate detection logic that separates selected results into:
 * - applicationsCreated: New courses not in user's shortlist (created via RPC)
 * - skippedDuplicates: Courses already in user's shortlist
 */

import { buildAddCoursesSupabase, makeRequest } from './test-helpers';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock URL validator (Task 13.5) - all courses valid by default
vi.mock('@/lib/course-search/url-validator', () => ({
  batchValidateCourseUrls: vi.fn(async (courses) => ({
    valid: courses,
    invalid: [],
  })),
}));

// Mock entitlement service so the route proceeds to application creation.
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  canAddCoursesToApply: vi.fn(async () => ({
    allowed: true,
    usage: {
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 0,
      courseAddLimit: 5,
      coursesAdded: 0,
    },
  })),
}));

import { createClient } from '@/lib/supabase/server';

describe('POST /api/apply-shortlist/add-courses - Task 13.4 Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: any): Request => {
    return makeRequest('http://localhost:3000/api/apply-shortlist/add-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
  };

  // Zod requires UUIDs for sessionId and result IDs.
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';
  const R1 = '650e8400-e29b-41d4-a716-446655440001';
  const R2 = '750e8400-e29b-41d4-a716-446655440002';
  const R3 = '850e8400-e29b-41d4-a716-446655440003';

  const mockSession = {
    id: SESSION_ID,
    user_id: mockUser.id,
    status: 'complete',
    university_id: 'uni-123',
  };

  const mockSelectedResults = [
    {
      id: R1,
      session_id: SESSION_ID,
      course_name: 'Computer Science BSc',
      course_url: 'https://university.edu/cs-bsc',
      university_id: 1,
      source_domain: 'university.edu',
    },
    {
      id: R2,
      session_id: SESSION_ID,
      course_name: 'Data Science MSc',
      course_url: 'https://university.edu/ds-msc',
      university_id: 1,
      source_domain: 'university.edu',
    },
    {
      id: R3,
      session_id: SESSION_ID,
      course_name: 'AI Engineering MSc',
      course_url: 'https://university.edu/ai-msc',
      university_id: 1,
      source_domain: 'university.edu',
    },
  ];

  it('should detect no duplicates when user has no existing applications', async () => {
    const mockSupabase = buildAddCoursesSupabase({
      user: mockUser,
      session: mockSession,
      results: mockSelectedResults,
      existingApps: [],
    });
    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await POST(createMockRequest({
      sessionId: SESSION_ID,
      selectedResultIds: [R1, R2, R3],
    }) as any);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.applicationsCreated).toHaveLength(3);
    expect(responseData.skippedDuplicates).toHaveLength(0);
  });

  it('should detect duplicates when user has existing applications with same course_url', async () => {
    const existingApplications = [
      { id: 'app-1', course_name: 'Computer Science BSc', course_url: 'https://university.edu/cs-bsc' },
      { id: 'app-2', course_name: 'Data Science MSc', course_url: 'https://university.edu/ds-msc' },
    ];

    const mockSupabase = buildAddCoursesSupabase({
      user: mockUser,
      session: mockSession,
      results: mockSelectedResults,
      existingApps: existingApplications,
    });
    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await POST(createMockRequest({
      sessionId: SESSION_ID,
      selectedResultIds: [R1, R2, R3],
    }) as any);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    // Only AI Engineering MSc is new
    expect(responseData.applicationsCreated).toHaveLength(1);
    expect(responseData.skippedDuplicates).toHaveLength(2);

    // Verify skipped duplicates structure
    expect(responseData.skippedDuplicates[0]).toHaveProperty('courseName');
    expect(responseData.skippedDuplicates[0]).toHaveProperty('courseUrl');
    expect(responseData.skippedDuplicates[0]).toHaveProperty('existingApplicationId');
  });

  it('should detect all duplicates when all selected courses exist in shortlist', async () => {
    const existingApplications = [
      { id: 'app-1', course_name: 'Computer Science BSc', course_url: 'https://university.edu/cs-bsc' },
      { id: 'app-2', course_name: 'Data Science MSc', course_url: 'https://university.edu/ds-msc' },
      { id: 'app-3', course_name: 'AI Engineering MSc', course_url: 'https://university.edu/ai-msc' },
    ];

    const mockSupabase = buildAddCoursesSupabase({
      user: mockUser,
      session: mockSession,
      results: mockSelectedResults,
      existingApps: existingApplications,
    });
    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await POST(createMockRequest({
      sessionId: SESSION_ID,
      selectedResultIds: [R1, R2, R3],
    }) as any);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.applicationsCreated).toHaveLength(0); // No new courses
    expect(responseData.skippedDuplicates).toHaveLength(3); // All duplicates
  });

  it('should return 500 if duplicate check query fails', async () => {
    const mockSupabase = buildAddCoursesSupabase({
      user: mockUser,
      session: mockSession,
      results: mockSelectedResults.slice(0, 2),
      existingAppsError: { message: 'Database connection failed' },
    });
    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await POST(createMockRequest({
      sessionId: SESSION_ID,
      selectedResultIds: [R1, R2],
    }) as any);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Failed to check for existing applications');
  });

  it('should handle empty existing applications array correctly', async () => {
    const mockSupabase = buildAddCoursesSupabase({
      user: mockUser,
      session: mockSession,
      results: [mockSelectedResults[0]],
      existingApps: [],
    });
    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await POST(createMockRequest({
      sessionId: SESSION_ID,
      selectedResultIds: [R1],
    }) as any);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.applicationsCreated).toHaveLength(1);
    expect(responseData.skippedDuplicates).toHaveLength(0);
  });
});
