import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../[id]/route';
import { getUserEntitlement } from '@/lib/entitlements/entitlement-service';

/**
 * Test suite for GET /api/course-search-sessions/:id (Tasks 9.1 & 9.2)
 * 
 * Tests the retrieval of course search session details including:
 * - Authentication requirements
 * - Ownership verification (user owns the session)
 * - 404 handling for non-existent or non-owned sessions
 * - Proper data transformation to camelCase
 * - Usage state calculation and inclusion (Task 9.2)
 */

// Mock the Supabase client
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

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
  getUserEntitlement: vi.fn(),
}));

// Get the mocked function for type safety
const mockGetUserEntitlement = vi.mocked(getUserEntitlement);

describe('GET /api/course-search-sessions/:id - Task 9.1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for getUserEntitlement
    mockGetUserEntitlement.mockResolvedValue({
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 1,
      courseAddLimit: 5,
      coursesAdded: 2,
    });
  });

  const createMockContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  const mockSessionData = {
    id: 'session-123',
    user_id: 'user-123',
    university_id: 1,
    query: 'computer science',
    study_level: 'undergraduate',
    student_profile_snapshot: { interests: ['AI'] },
    status: 'complete',
    result_count: 5,
    provider_name: 'tavily',
    search_strategy: 'cached+web',
    error_message: null,
    error_code: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:01:00Z',
    completed_at: '2024-01-01T00:01:00Z',
  };

  const mockResultsData = [
    {
      id: 'result-1',
      session_id: 'session-123',
      university_id: 1,
      course_name: 'BSc Computer Science',
      course_url: 'https://university.edu/cs',
      source_domain: 'university.edu',
      snippet: 'Learn programming and algorithms',
      degree_level: 'Bachelor',
      duration: '3 years',
      tuition_fee_text: '£9,250/year',
      confidence_label: 'Good match',
      source_confidence: 0.85,
      rank: 1,
      selected: false,
      selected_at: null,
      selected_application_id: null,
      source_type: 'web',
      raw_search_result: { searchRank: 1 },
      created_at: '2024-01-01T00:01:00Z',
      updated_at: '2024-01-01T00:01:00Z',
    },
    {
      id: 'result-2',
      session_id: 'session-123',
      university_id: 1,
      course_name: 'MSc Computer Science',
      course_url: 'https://university.edu/msc-cs',
      source_domain: 'university.edu',
      snippet: 'Advanced computing research',
      degree_level: 'Master',
      duration: '1 year',
      tuition_fee_text: '£12,500/year',
      confidence_label: 'Checked recently',
      source_confidence: 0.95,
      rank: 2,
      selected: true,
      selected_at: '2024-01-01T00:02:00Z',
      selected_application_id: 'app-456',
      source_type: 'cached',
      raw_search_result: null,
      created_at: '2024-01-01T00:01:00Z',
      updated_at: '2024-01-01T00:02:00Z',
    },
  ];

  it('should require authentication', async () => {
    // Arrange
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-123');
    const context = createMockContext('session-123');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should verify user owns the session', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Mock session query - user doesn't own the session
    const sessionEq2 = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    });
    const sessionEq1 = vi.fn().mockReturnValue({ eq: sessionEq2 });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    mockFrom.mockReturnValueOnce({ select: sessionSelect });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
    expect(mockFrom).toHaveBeenCalledWith('course_search_sessions');
    expect(sessionEq1).toHaveBeenCalledWith('id', 'session-456');
    expect(sessionEq2).toHaveBeenCalledWith('user_id', mockUserId);
  });

  it('should return 404 when session does not exist', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Mock session not found
    const sessionEq2 = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    });
    const sessionEq1 = vi.fn().mockReturnValue({ eq: sessionEq2 });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    mockFrom.mockReturnValueOnce({ select: sessionSelect });

    const request = new Request('http://localhost:3000/api/course-search-sessions/nonexistent-id');
    const context = createMockContext('nonexistent-id');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return session and results when user owns the session', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Mock session query chain
    const sessionEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockSessionData,
          error: null,
        }),
      }),
    });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    const sessionFrom = vi.fn().mockReturnValue({ select: sessionSelect });

    // Mock results query chain
    const resultsOrder = vi.fn().mockResolvedValue({
      data: mockResultsData,
      error: null,
    });
    const resultsEq = vi.fn().mockReturnValue({ order: resultsOrder });
    const resultsSelect = vi.fn().mockReturnValue({ eq: resultsEq });
    const resultsFrom = vi.fn().mockReturnValue({ select: resultsSelect });

    // Set up from() to return different chains based on table name
    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_sessions') {
        return sessionFrom(table);
      } else if (table === 'course_search_session_results') {
        return resultsFrom(table);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-123');
    const context = createMockContext('session-123');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('session');
    expect(data).toHaveProperty('results');
    
    // Verify session transformation to camelCase
    expect(data.session).toEqual({
      id: mockSessionData.id,
      userId: mockSessionData.user_id,
      universityId: mockSessionData.university_id,
      query: mockSessionData.query,
      studyLevel: mockSessionData.study_level,
      studentProfileSnapshot: mockSessionData.student_profile_snapshot,
      status: mockSessionData.status,
      resultCount: mockSessionData.result_count,
      providerName: mockSessionData.provider_name,
      searchStrategy: mockSessionData.search_strategy,
      errorMessage: mockSessionData.error_message,
      errorCode: mockSessionData.error_code,
      createdAt: mockSessionData.created_at,
      updatedAt: mockSessionData.updated_at,
      completedAt: mockSessionData.completed_at,
    });
    
    // Verify results transformation to camelCase
    expect(data.results).toHaveLength(2);
    expect(data.results[0]).toEqual({
      id: mockResultsData[0].id,
      sessionId: mockResultsData[0].session_id,
      universityId: mockResultsData[0].university_id,
      courseName: mockResultsData[0].course_name,
      courseUrl: mockResultsData[0].course_url,
      sourceDomain: mockResultsData[0].source_domain,
      snippet: mockResultsData[0].snippet,
      degreeLevel: mockResultsData[0].degree_level,
      duration: mockResultsData[0].duration,
      tuitionFeeText: mockResultsData[0].tuition_fee_text,
      confidenceLabel: mockResultsData[0].confidence_label,
      sourceConfidence: mockResultsData[0].source_confidence,
      rank: mockResultsData[0].rank,
      selected: mockResultsData[0].selected,
      selectedAt: mockResultsData[0].selected_at,
      selectedApplicationId: mockResultsData[0].selected_application_id,
      sourceType: mockResultsData[0].source_type,
      rawSearchResult: mockResultsData[0].raw_search_result,
      createdAt: mockResultsData[0].created_at,
      updatedAt: mockResultsData[0].updated_at,
    });
    
    // Verify database calls
    expect(sessionFrom).toHaveBeenCalledWith('course_search_sessions');
    expect(sessionSelect).toHaveBeenCalledWith('*');
    expect(sessionEq1).toHaveBeenCalledWith('id', 'session-123');
    
    expect(resultsFrom).toHaveBeenCalledWith('course_search_session_results');
    expect(resultsSelect).toHaveBeenCalledWith('*');
    expect(resultsEq).toHaveBeenCalledWith('session_id', 'session-123');
    expect(resultsOrder).toHaveBeenCalledWith('rank', { ascending: true });
  });

  it('should return empty results array when no results exist', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Mock session query
    const sessionEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockSessionData,
          error: null,
        }),
      }),
    });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    const sessionFrom = vi.fn().mockReturnValue({ select: sessionSelect });

    // Mock empty results query
    const resultsOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const resultsEq = vi.fn().mockReturnValue({ order: resultsOrder });
    const resultsSelect = vi.fn().mockReturnValue({ eq: resultsEq });
    const resultsFrom = vi.fn().mockReturnValue({ select: resultsSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_sessions') {
        return sessionFrom(table);
      } else if (table === 'course_search_session_results') {
        return resultsFrom(table);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-123');
    const context = createMockContext('session-123');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.session.id).toBe('session-123');
    expect(data.results).toEqual([]);
  });

  it('should handle database errors when fetching results', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    // Mock session query succeeds
    const sessionEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockSessionData,
          error: null,
        }),
      }),
    });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    const sessionFrom = vi.fn().mockReturnValue({ select: sessionSelect });

    // Mock results query fails
    const resultsOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });
    const resultsEq = vi.fn().mockReturnValue({ order: resultsOrder });
    const resultsSelect = vi.fn().mockReturnValue({ eq: resultsEq });
    const resultsFrom = vi.fn().mockReturnValue({ select: resultsSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_sessions') {
        return sessionFrom(table);
      } else if (table === 'course_search_session_results') {
        return resultsFrom(table);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-123');
    const context = createMockContext('session-123');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch session results');
  });

  it('should properly sort results by rank', async () => {
    // Arrange
    const mockUserId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const sessionEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockSessionData,
          error: null,
        }),
      }),
    });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    const sessionFrom = vi.fn().mockReturnValue({ select: sessionSelect });

    const resultsOrder = vi.fn().mockResolvedValue({
      data: mockResultsData,
      error: null,
    });
    const resultsEq = vi.fn().mockReturnValue({ order: resultsOrder });
    const resultsSelect = vi.fn().mockReturnValue({ eq: resultsEq });
    const resultsFrom = vi.fn().mockReturnValue({ select: resultsSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_sessions') {
        return sessionFrom(table);
      } else if (table === 'course_search_session_results') {
        return resultsFrom(table);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-123');
    const context = createMockContext('session-123');

    // Act
    await GET(request, context);

    // Assert - verify order was called with ascending: true
    expect(resultsOrder).toHaveBeenCalledWith('rank', { ascending: true });
  });
});

describe('GET /api/course-search-sessions/:id - Task 9.2: Usage State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  const mockSessionData = {
    id: 'session-456',
    user_id: 'user-456',
    university_id: 2,
    query: 'business management',
    study_level: 'postgraduate',
    student_profile_snapshot: { interests: ['Business'] },
    status: 'complete',
    result_count: 3,
    provider_name: 'tavily',
    search_strategy: 'web',
    error_message: null,
    error_code: null,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:01:00Z',
    completed_at: '2024-02-01T00:01:00Z',
  };

  const mockResultsData = [
    {
      id: 'result-10',
      session_id: 'session-456',
      university_id: 2,
      course_name: 'MBA Business Administration',
      course_url: 'https://business-university.edu/mba',
      source_domain: 'business-university.edu',
      snippet: 'Transform your career with an MBA',
      degree_level: 'Master',
      duration: '2 years',
      tuition_fee_text: '£15,000/year',
      confidence_label: 'Good match',
      source_confidence: 0.88,
      rank: 1,
      selected: false,
      selected_at: null,
      selected_application_id: null,
      source_type: 'web',
      raw_search_result: { searchRank: 1 },
      created_at: '2024-02-01T00:01:00Z',
      updated_at: '2024-02-01T00:01:00Z',
    },
  ];

  const setupMocks = (userId: string, sessionData: typeof mockSessionData, resultsData: typeof mockResultsData) => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    const sessionEq1 = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: sessionData,
          error: null,
        }),
      }),
    });
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq1 });
    const sessionFrom = vi.fn().mockReturnValue({ select: sessionSelect });

    const resultsOrder = vi.fn().mockResolvedValue({
      data: resultsData,
      error: null,
    });
    const resultsEq = vi.fn().mockReturnValue({ order: resultsOrder });
    const resultsSelect = vi.fn().mockReturnValue({ eq: resultsEq });
    const resultsFrom = vi.fn().mockReturnValue({ select: resultsSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'course_search_sessions') {
        return sessionFrom(table);
      } else if (table === 'course_search_session_results') {
        return resultsFrom(table);
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  };

  it('should include usage state in response', async () => {
    // Arrange
    const mockUserId = 'user-456';
    setupMocks(mockUserId, mockSessionData, mockResultsData);

    const mockUsage = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 2,
      courseAddLimit: 5,
      coursesAdded: 3,
    };
    mockGetUserEntitlement.mockResolvedValue(mockUsage);

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('usage');
    expect(data.usage).toEqual(mockUsage);
    expect(mockGetUserEntitlement).toHaveBeenCalledWith(mockUserId);
  });

  it('should return usage state for free plan users', async () => {
    // Arrange
    const mockUserId = 'user-free';
    setupMocks(mockUserId, mockSessionData, mockResultsData);

    const freeUsage = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 1,
      courseAddLimit: 5,
      coursesAdded: 2,
    };
    mockGetUserEntitlement.mockResolvedValue(freeUsage);

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.usage).toEqual(freeUsage);
    expect(data.usage.plan).toBe('free');
    expect(data.usage.courseSearchLimit).toBe(3);
    expect(data.usage.courseAddLimit).toBe(5);
  });

  it('should return usage state for plus plan users with unlimited limits', async () => {
    // Arrange
    const mockUserId = 'user-plus';
    setupMocks(mockUserId, mockSessionData, mockResultsData);

    const plusUsage = {
      plan: 'plus' as const,
      courseSearchLimit: 999999,
      courseSearchesUsed: 25,
      courseAddLimit: 999999,
      coursesAdded: 12,
    };
    mockGetUserEntitlement.mockResolvedValue(plusUsage);

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.usage).toEqual(plusUsage);
    expect(data.usage.plan).toBe('plus');
    expect(data.usage.courseSearchLimit).toBe(999999);
    expect(data.usage.courseAddLimit).toBe(999999);
  });

  it('should include all three response components: session, results, and usage', async () => {
    // Arrange
    const mockUserId = 'user-complete';
    setupMocks(mockUserId, mockSessionData, mockResultsData);

    const mockUsage = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 2,
      courseAddLimit: 5,
      coursesAdded: 1,
    };
    mockGetUserEntitlement.mockResolvedValue(mockUsage);

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert - Verify all three required components exist
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('session');
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('usage');

    // Verify session structure
    expect(data.session).toMatchObject({
      id: 'session-456',
      userId: 'user-456',
      query: 'business management',
      status: 'complete',
    });

    // Verify results structure
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      id: 'result-10',
      courseName: 'MBA Business Administration',
      courseUrl: 'https://business-university.edu/mba',
    });

    // Verify usage structure
    expect(data.usage).toMatchObject({
      plan: 'free',
      courseSearchLimit: 3,
      courseSearchesUsed: 2,
      courseAddLimit: 5,
      coursesAdded: 1,
    });
  });

  it('should include usage state even when results are empty', async () => {
    // Arrange
    const mockUserId = 'user-no-results';
    const sessionWithNoResults = {
      ...mockSessionData,
      result_count: 0,
    };
    setupMocks(mockUserId, sessionWithNoResults, []);

    const mockUsage = {
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 3,
      courseAddLimit: 5,
      coursesAdded: 0,
    };
    mockGetUserEntitlement.mockResolvedValue(mockUsage);

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    const response = await GET(request, context);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.results).toEqual([]);
    expect(data.usage).toEqual(mockUsage);
    expect(data.usage.courseSearchesUsed).toBe(3);
  });

  it('should call getUserEntitlement with the authenticated user ID', async () => {
    // Arrange
    const mockUserId = 'user-entitlement-check';
    setupMocks(mockUserId, mockSessionData, mockResultsData);

    mockGetUserEntitlement.mockResolvedValue({
      plan: 'free' as const,
      courseSearchLimit: 3,
      courseSearchesUsed: 1,
      courseAddLimit: 5,
      coursesAdded: 0,
    });

    const request = new Request('http://localhost:3000/api/course-search-sessions/session-456');
    const context = createMockContext('session-456');

    // Act
    await GET(request, context);

    // Assert
    expect(mockGetUserEntitlement).toHaveBeenCalledTimes(1);
    expect(mockGetUserEntitlement).toHaveBeenCalledWith(mockUserId);
  });
});
