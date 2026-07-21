import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the Supabase client
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

// Mock the entitlement service
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  canCreateCourseSearchSession: vi.fn(),
  getUserEntitlement: vi.fn(),
}));

// Mock the admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock course search modules
vi.mock('@/lib/course-search/cached-search', () => ({
  searchCachedCourses: vi.fn(),
  storeCachedResults: vi.fn(),
}));

// Mock search provider
vi.mock('@/lib/search-providers', () => ({
  getSearchProvider: vi.fn(),
}));

describe('POST /api/course-search-sessions - Task 8.3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock chain setup
    mockEq.mockReturnValue({ error: null });
    mockSingle.mockReturnValue({ data: { id: 'session-123' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ 
      insert: mockInsert,
      update: mockUpdate,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  const createMockRequest = (body: any): Request => {
    return new Request('http://localhost:3000/api/course-search-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const setupSearchMocks = async () => {
    const { searchCachedCourses, storeCachedResults } = await import('@/lib/course-search/cached-search');
    const { getUserEntitlement } = await import('@/lib/entitlements/entitlement-service');
    
    vi.mocked(searchCachedCourses).mockResolvedValue({
      results: [],
      sufficientResults: true,
      usedCache: true,
    });
    vi.mocked(storeCachedResults).mockResolvedValue(true);
    
    // Mock getUserEntitlement for updated usage state
    vi.mocked(getUserEntitlement).mockResolvedValue({
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 1,
      courseAddLimit: 5,
      coursesAdded: 0,
    });
  };

  it('should create a session record with status=processing after entitlement check passes', async () => {
    // Arrange
    const mockUserId = 'user-123';
    const requestBody = {
      universityId: 1,
      query: 'computer science',
      studyLevel: 'undergraduate',
      studentProfile: { interests: ['AI', 'Web Dev'] },
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 0,
        courseAddLimit: 5,
        coursesAdded: 0,
      },
    });

    await setupSearchMocks();

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(mockFrom).toHaveBeenCalledWith('course_search_sessions');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      university_id: 1,
      query: 'computer science',
      study_level: 'undergraduate',
      student_profile_snapshot: { interests: ['AI', 'Web Dev'] },
      status: 'processing',
    });
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockSingle).toHaveBeenCalled();
    expect(data.sessionId).toBe('session-123');
    expect(response.status).toBe(201);
  });

  it('should trim the query before storing', async () => {
    // Arrange
    const mockUserId = 'user-456';
    const requestBody = {
      universityId: 2,
      query: '  machine learning  ',
      studyLevel: 'postgraduate',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'plus',
        courseSearchLimit: 999999,
        courseSearchesUsed: 5,
        courseAddLimit: 999999,
        coursesAdded: 2,
      },
    });

    await setupSearchMocks();

    const request = createMockRequest(requestBody);

    // Act
    await POST(request);

    // Assert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'machine learning', // Trimmed
      })
    );
  });

  it('should store null for optional fields when not provided', async () => {
    // Arrange
    const mockUserId = 'user-789';
    const requestBody = {
      universityId: 3,
      query: 'business',
      // studyLevel and studentProfile omitted
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 1,
        courseAddLimit: 5,
        coursesAdded: 0,
      },
    });

    await setupSearchMocks();

    const request = createMockRequest(requestBody);

    // Act
    await POST(request);

    // Assert
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      university_id: 3,
      query: 'business',
      study_level: null,
      student_profile_snapshot: null,
      status: 'processing',
    });
  });

  it('should return 500 if session creation fails', async () => {
    // Arrange
    const mockUserId = 'user-error';
    const requestBody = {
      universityId: 1,
      query: 'physics',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 0,
        courseAddLimit: 5,
        coursesAdded: 0,
      },
    });

    // Simulate database error
    mockSingle.mockReturnValue({
      data: null,
      error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' },
    });

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create search session');
    expect(data.message).toBe('Unable to start your search. Please try again.');
  });

  it('should not create session if entitlement check fails', async () => {
    // Arrange
    const mockUserId = 'user-quota-exceeded';
    const requestBody = {
      universityId: 1,
      query: 'engineering',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: false,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 3,
        courseAddLimit: 5,
        coursesAdded: 0,
      },
      upgradeRequired: true,
      reason: "You've used all 3 course searches this month. Upgrade to GlowBal Plus for unlimited searches.",
    });

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(data.allowed).toBe(false);
    expect(data.upgradeRequired).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled(); // Session should NOT be created
  });

  it('should store the session ID and use it in the response', async () => {
    // Arrange
    const mockUserId = 'user-999';
    const mockSessionId = 'generated-session-uuid';
    const requestBody = {
      universityId: 5,
      query: 'medicine',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'plus',
        courseSearchLimit: 999999,
        courseSearchesUsed: 10,
        courseAddLimit: 999999,
        coursesAdded: 5,
      },
    });

    mockSingle.mockReturnValue({
      data: { id: mockSessionId },
      error: null,
    });

    await setupSearchMocks();

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(data.sessionId).toBe(mockSessionId);
  });
});

describe('POST /api/course-search-sessions - Task 8.7: Response with usage state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock chain setup
    mockEq.mockReturnValue({ error: null });
    mockSingle.mockReturnValue({ data: { id: 'session-123' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ 
      insert: mockInsert,
      update: mockUpdate,
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
  });

  const createMockRequest = (body: any): Request => {
    return new Request('http://localhost:3000/api/course-search-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  it('should return full usage state structure with all required fields', async () => {
    // Arrange
    const mockUserId = 'user-usage-test';
    const requestBody = {
      universityId: 1,
      query: 'computer science',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession, getUserEntitlement } = await import('@/lib/entitlements/entitlement-service');
    const mockUsageDataBefore = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 1,
      courseAddLimit: 5,
      coursesAdded: 2,
    };

    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: mockUsageDataBefore,
    });

    // Mock getUserEntitlement to return updated usage after session completes
    // Task 8.7: Usage state should reflect the just-completed session
    const mockUsageDataAfter = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 2, // Incremented from 1 to 2 after session completion
      courseAddLimit: 5,
      coursesAdded: 2,
    };
    vi.mocked(getUserEntitlement).mockResolvedValue(mockUsageDataAfter);

    // Mock cached search to return sufficient results
    const { searchCachedCourses, storeCachedResults } = await import('@/lib/course-search/cached-search');
    vi.mocked(searchCachedCourses).mockResolvedValue({
      results: [
        {
          universityId: 1,
          courseName: 'BSc Computer Science',
          courseUrl: 'https://example.edu/courses/cs',
          sourceDomain: 'example.edu',
          snippet: 'A comprehensive CS program',
          degreeLevel: 'undergraduate',
          duration: '3 years',
          tuitionFeeText: '£9,250/year',
          confidenceLabel: 'Checked recently' as const,
          id: 'cached-result-1',
          sourceType: 'cached' as const,
          lastExtractedAt: '2026-01-01T00:00:00.000Z',
          sourceConfidence: 0.95,
          rank: 1,
        },
      ],
      sufficientResults: true,
      usedCache: true,
    });
    vi.mocked(storeCachedResults).mockResolvedValue(true);

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert - Task 8.7 requirement: Full usage state structure
    expect(response.status).toBe(201);
    expect(data).toHaveProperty('sessionId');
    expect(data).toHaveProperty('status', 'complete');
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('usage');
    
    // Verify all required usage fields with updated values after session completion
    expect(data.usage).toEqual({
      courseSearchesUsed: 2, // Should reflect the completed session
      courseSearchLimit: 3,
      coursesAdded: 2,
      courseAddLimit: 5,
      plan: 'free',
    });

    // Verify getUserEntitlement was called to fetch updated usage
    expect(getUserEntitlement).toHaveBeenCalledWith(mockUserId);
  });

  it('should return usage state for Plus plan users', async () => {
    // Arrange
    const mockUserId = 'user-plus';
    const requestBody = {
      universityId: 2,
      query: 'engineering',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession, getUserEntitlement } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'plus',
        courseSearchLimit: 999999,
        courseSearchesUsed: 50,
        courseAddLimit: 999999,
        coursesAdded: 15,
      },
    });

    // Mock getUserEntitlement to return updated usage after completion
    vi.mocked(getUserEntitlement).mockResolvedValue({
      plan: 'plus',
      courseSearchLimit: 999999,
      courseSearchesUsed: 51, // Incremented after session completion
      courseAddLimit: 999999,
      coursesAdded: 15,
    });

    // Mock cached search with sufficient results
    const { searchCachedCourses, storeCachedResults } = await import('@/lib/course-search/cached-search');
    vi.mocked(searchCachedCourses).mockResolvedValue({
      results: [
        {
          universityId: 2,
          courseName: 'BEng Engineering',
          courseUrl: 'https://example.edu/engineering',
          sourceDomain: 'example.edu',
          snippet: 'Engineering program',
          degreeLevel: 'undergraduate',
          duration: '4 years',
          tuitionFeeText: '£9,250/year',
          confidenceLabel: 'Checked recently' as const,
          id: 'cached-result-1',
          sourceType: 'cached' as const,
          lastExtractedAt: '2026-01-01T00:00:00.000Z',
          sourceConfidence: 0.9,
          rank: 1,
        },
      ],
      sufficientResults: true,
      usedCache: true,
    });
    vi.mocked(storeCachedResults).mockResolvedValue(true);

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert - Should return updated usage after session completion
    expect(data.usage.plan).toBe('plus');
    expect(data.usage.courseSearchLimit).toBe(999999);
    expect(data.usage.courseSearchesUsed).toBe(51);
    expect(data.usage.courseAddLimit).toBe(999999);
    expect(data.usage.coursesAdded).toBe(15);
  });

  it('should handle zero results scenario (result_count = 0)', async () => {
    // Arrange - Task 8.7: Zero-results scenario
    const mockUserId = 'user-zero-results';
    const mockSessionId = 'zero-results-session';
    const requestBody = {
      universityId: 3,
      query: 'obscure course that does not exist',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession, getUserEntitlement } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 0,
        courseAddLimit: 5,
        coursesAdded: 0,
      },
    });

    // Mock getUserEntitlement to return updated usage after session completion
    vi.mocked(getUserEntitlement).mockResolvedValue({
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 1, // Incremented even for zero-result sessions
      courseAddLimit: 5,
      coursesAdded: 0,
    });

    // Mock session creation chain
    const mockSessionSingle = vi.fn().mockReturnValue({ data: { id: mockSessionId }, error: null });
    const mockSessionSelect = vi.fn().mockReturnValue({ single: mockSessionSingle });
    const mockSessionInsert = vi.fn().mockReturnValue({ select: mockSessionSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_session_results') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'universities') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 3, name: 'Example University' },
                error: null,
              }),
            }),
          }),
        };
      }
      // course_search_sessions: insert (creation) + update (completion)
      return {
        insert: mockSessionInsert,
        update: mockUpdate,
      };
    });

    // Mock cached search returning no results
    const { searchCachedCourses, storeCachedResults } = await import('@/lib/course-search/cached-search');
    vi.mocked(searchCachedCourses).mockResolvedValue({
      results: [],
      sufficientResults: false,
      usedCache: true,
    });
    vi.mocked(storeCachedResults).mockResolvedValue(true);

    // Mock web search also returning no results
    const { getSearchProvider } = await import('@/lib/search-providers');
    vi.mocked(getSearchProvider).mockReturnValue({
      search: vi.fn().mockResolvedValue([]),
    } as any);

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert - Zero results should still return valid response structure
    expect(response.status).toBe(201);
    expect(data.status).toBe('complete');
    expect(data.results).toEqual([]); // Empty results array
    expect(data.results.length).toBe(0);
    
    // Usage state should still be included for UI display with updated count
    expect(data.usage).toBeDefined();
    expect(data.usage.courseSearchesUsed).toBe(1); // Should be incremented
    expect(data.usage.courseSearchLimit).toBe(3);
    
    // Frontend can check: if (data.results.length === 0) { show zero-state UI }
    // Note: The task details specify frontend should show:
    // "We couldn't find reliable course options from the official university site"
    // + offer "Open official course directory" and "Paste course URL manually"
  });

  it('should include usage state even when session completes with partial results', async () => {
    // Arrange
    const mockUserId = 'user-partial';
    const requestBody = {
      universityId: 4,
      query: 'data science',
    };

    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const { canCreateCourseSearchSession, getUserEntitlement } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(canCreateCourseSearchSession).mockResolvedValue({
      allowed: true,
      usage: {
        plan: 'free',
        courseSearchLimit: 3,
        courseSearchesUsed: 2,
        courseAddLimit: 5,
        coursesAdded: 3,
      },
    });

    // Mock getUserEntitlement to return updated usage after completion
    vi.mocked(getUserEntitlement).mockResolvedValue({
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 3, // Incremented from 2 to 3
      courseAddLimit: 5,
      coursesAdded: 3,
    });

    // Mock cached search with 1 result (sufficient for this test)
    const { searchCachedCourses, storeCachedResults } = await import('@/lib/course-search/cached-search');
    vi.mocked(searchCachedCourses).mockResolvedValue({
      results: [
        {
          universityId: 4,
          courseName: 'MSc Data Science',
          courseUrl: 'https://uni4.edu/data-science',
          sourceDomain: 'uni4.edu',
          snippet: 'Advanced data science program',
          degreeLevel: 'postgraduate',
          duration: '1 year',
          tuitionFeeText: '£12,000',
          confidenceLabel: 'Good match' as const,
          id: 'cached-result-1',
          sourceType: 'cached' as const,
          lastExtractedAt: '2026-01-01T00:00:00.000Z',
          sourceConfidence: 0.8,
          rank: 1,
        },
      ],
      sufficientResults: true,
      usedCache: true,
    });
    vi.mocked(storeCachedResults).mockResolvedValue(true);

    // Re-fetch of stored results returns the one stored row (with its DB id)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_session_results') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'row-1',
                    university_id: 4,
                    course_name: 'MSc Data Science',
                    course_url: 'https://uni4.edu/data-science',
                    source_domain: 'uni4.edu',
                    snippet: 'Advanced data science program',
                    degree_level: 'postgraduate',
                    duration: '1 year',
                    tuition_fee_text: '£12,000',
                    confidence_label: 'Good match',
                    source_confidence: 0.8,
                    rank: 1,
                    source_type: 'cached',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        insert: mockInsert,
        update: mockUpdate,
      };
    });

    const request = createMockRequest(requestBody);

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert - Should return updated usage reflecting the completed session
    expect(data.status).toBe('complete');
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.usage).toEqual({
      courseSearchesUsed: 3, // Should be incremented
      courseSearchLimit: 3,
      coursesAdded: 3,
      courseAddLimit: 5,
      plan: 'free',
    });
  });
});
