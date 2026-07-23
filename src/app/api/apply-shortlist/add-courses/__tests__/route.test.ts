import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { createClient } from '@/lib/supabase/server';
import { buildAddCoursesSupabase, allowedEntitlement, makeRequest } from './test-helpers';

/**
 * Task 13.1 Tests: Route handler, authentication, and input validation
 * Task 13.2 Tests: Session ownership and status verification
 * 
 * Tests:
 * 1. Request body validation (Zod schema) - Task 13.1
 * 2. Authentication check (401 for unauthenticated users) - Task 13.1
 * 3. Route handler scaffold responds correctly - Task 13.1
 * 4. Session verification (ownership and status checks) - Task 13.2
 */

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock URL validator (Task 13.5)
vi.mock('@/lib/course-search/url-validator', () => ({
  batchValidateCourseUrls: vi.fn(async (courses) => ({
    valid: courses, // By default, all courses are valid
    invalid: [],
  })),
}));

// Mock entitlement service (Task 13.6) so the route is allowed to proceed
// through to application creation in happy-path tests.
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  canAddCoursesToApply: vi.fn(async () => allowedEntitlement()),
}));

describe('POST /api/apply-shortlist/add-courses - Task 13.1 & 13.2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation', () => {
    it('should reject invalid JSON', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should reject missing sessionId', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedResultIds: ['550e8400-e29b-41d4-a716-446655440000'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('should reject invalid sessionId (not UUID)', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'not-a-uuid',
          selectedResultIds: ['550e8400-e29b-41d4-a716-446655440000'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('should reject empty selectedResultIds array', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details?.fieldErrors?.selectedResultIds).toBeDefined();
    });

    it('should reject too many selectedResultIds (>10)', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: Array(11).fill('550e8400-e29b-41d4-a716-446655440000'),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details?.fieldErrors?.selectedResultIds).toBeDefined();
    });

    it('should reject invalid result ID (not UUID)', async () => {
      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: ['not-a-uuid'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('should accept valid request body', async () => {
      const mockSupabase = buildAddCoursesSupabase({
        user: { id: 'user-123' },
        session: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: 'user-123',
          status: 'complete',
          university_id: 'uni-123',
        },
        results: [
          {
            id: '650e8400-e29b-41d4-a716-446655440001',
            course_name: 'Course One',
            course_url: 'https://university.edu/one',
            source_domain: 'university.edu',
          },
          {
            id: '750e8400-e29b-41d4-a716-446655440002',
            course_name: 'Course Two',
            course_url: 'https://university.edu/two',
            source_domain: 'university.edu',
          },
        ],
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: [
            '650e8400-e29b-41d4-a716-446655440001',
            '750e8400-e29b-41d4-a716-446655440002',
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.applicationsCreated).toHaveLength(2);
      expect(data.skippedDuplicates).toHaveLength(0);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: ['650e8400-e29b-41d4-a716-446655440001'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when auth.getUser() returns error', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token' },
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: ['650e8400-e29b-41d4-a716-446655440001'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should allow authenticated users to proceed', async () => {
      const mockSupabase = buildAddCoursesSupabase({
        user: { id: 'user-456' },
        session: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: 'user-456',
          status: 'complete',
          university_id: 'uni-123',
        },
        results: [
          {
            id: '650e8400-e29b-41d4-a716-446655440001',
            course_name: 'Course One',
            course_url: 'https://university.edu/one',
            source_domain: 'university.edu',
          },
        ],
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: ['650e8400-e29b-41d4-a716-446655440001'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.applicationsCreated).toHaveLength(1);
    });
  });

  describe('Route handler response structure', () => {
    it('should return the final response structure', async () => {
      const mockSupabase = buildAddCoursesSupabase({
        user: { id: 'user-789' },
        session: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: 'user-789',
          status: 'complete',
          university_id: 'uni-123',
        },
        results: [
          {
            id: '650e8400-e29b-41d4-a716-446655440001',
            course_name: 'Course One',
            course_url: 'https://university.edu/one',
            source_domain: 'university.edu',
          },
          {
            id: '750e8400-e29b-41d4-a716-446655440002',
            course_name: 'Course Two',
            course_url: 'https://university.edu/two',
            source_domain: 'university.edu',
          },
          {
            id: '850e8400-e29b-41d4-a716-446655440003',
            course_name: 'Course Three',
            course_url: 'https://university.edu/three',
            source_domain: 'university.edu',
          },
        ],
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedResultIds: [
            '650e8400-e29b-41d4-a716-446655440001',
            '750e8400-e29b-41d4-a716-446655440002',
            '850e8400-e29b-41d4-a716-446655440003',
          ],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('applicationsCreated');
      expect(data).toHaveProperty('skippedDuplicates');
      expect(data).toHaveProperty('failedValidation');
      expect(data).toHaveProperty('usage');
      expect(data.applicationsCreated).toHaveLength(3);
    });
  });

  // Task 13.2: Session ownership and status verification
  describe('Session verification (Task 13.2)', () => {
    const validRequestBody = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedResultIds: ['650e8400-e29b-41d4-a716-446655440001'],
    };

    it('should return 404 when session does not exist', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'No rows returned' },
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('should return 403 when session is not owned by user', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  user_id: 'different-user-456',
                  status: 'complete',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You don't have permission to access this session");
    });

    it('should return 400 when session status is "processing"', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  user_id: 'user-123',
                  status: 'processing',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This search session is still processing. Please wait for it to complete.');
    });

    it('should return 400 when session status is "failed"', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  user_id: 'user-123',
                  status: 'failed',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This search session failed. Please try searching again.');
    });

    it('should proceed when session status is "complete" and owned by user', async () => {
      const mockSupabase = buildAddCoursesSupabase({
        user: { id: 'user-123' },
        session: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: 'user-123',
          status: 'complete',
          university_id: 'uni-123',
        },
        results: [
          {
            id: '650e8400-e29b-41d4-a716-446655440001',
            course_name: 'Course One',
            course_url: 'https://university.edu/one',
            source_domain: 'university.edu',
          },
        ],
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.applicationsCreated).toHaveLength(1);
    });

    it('should verify database query parameters are correct', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: 'user-123',
          status: 'complete',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      await POST(request);

      expect(mockFrom).toHaveBeenCalledWith('course_search_sessions');
      expect(mockSelect).toHaveBeenCalledWith('id, user_id, status, university_id');
      expect(mockEq).toHaveBeenCalledWith('id', '550e8400-e29b-41d4-a716-446655440000');
      expect(mockSingle).toHaveBeenCalled();
    });
  });

  // Task 13.3: Fetch selected session results
  describe('Fetch selected session results (Task 13.3)', () => {
    const validRequestBody = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedResultIds: [
        '650e8400-e29b-41d4-a716-446655440001',
        '750e8400-e29b-41d4-a716-446655440002',
      ],
    };

    const mockSessionData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-123',
      status: 'complete',
    };

    const mockResultsData = [
      {
        id: '650e8400-e29b-41d4-a716-446655440001',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        university_id: 'uni-1',
        course_name: 'Computer Science MSc',
        course_url: 'https://example.com/course1',
        source_domain: 'example.com',
        snippet: 'Course snippet 1',
        degree_level: 'masters',
        duration: '1 year',
        tuition_fee_text: '£10,000',
        confidence_label: 'high',
        source_confidence: 0.9,
        rank: 1,
        source_type: 'web',
      },
      {
        id: '750e8400-e29b-41d4-a716-446655440002',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        university_id: 'uni-1',
        course_name: 'Data Science MSc',
        course_url: 'https://example.com/course2',
        source_domain: 'example.com',
        snippet: 'Course snippet 2',
        degree_level: 'masters',
        duration: '2 years',
        tuition_fee_text: '£12,000',
        confidence_label: 'medium',
        source_confidence: 0.7,
        rank: 2,
        source_type: 'web',
      },
    ];

    it('should fetch all selected results successfully', async () => {
      const mockSupabase = buildAddCoursesSupabase({
        user: { id: 'user-123' },
        session: { ...mockSessionData, university_id: 'uni-123' },
        results: mockResultsData,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.applicationsCreated).toHaveLength(2);
    });

    it('should return 404 when some selected results are not found', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        data: [mockResultsData[0]], // Only one result found
        error: null,
      });
      const mockResultsEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockResultsSelect = vi.fn().mockReturnValue({ eq: mockResultsEq });

      const mockSessionSingle = vi.fn().mockResolvedValue({
        data: mockSessionData,
        error: null,
      });
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle });
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'course_search_sessions') {
          return { select: mockSessionSelect };
        } else if (table === 'course_search_session_results') {
          return { select: mockResultsSelect };
        }
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('One or more selected courses not found');
      expect(data.details.requestedCount).toBe(2);
      expect(data.details.foundCount).toBe(1);
      expect(data.details.missingIds).toContain('750e8400-e29b-41d4-a716-446655440002');
    });

    it('should return 404 when no selected results are found', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockResultsEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockResultsSelect = vi.fn().mockReturnValue({ eq: mockResultsEq });

      const mockSessionSingle = vi.fn().mockResolvedValue({
        data: mockSessionData,
        error: null,
      });
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle });
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'course_search_sessions') {
          return { select: mockSessionSelect };
        } else if (table === 'course_search_session_results') {
          return { select: mockResultsSelect };
        }
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('One or more selected courses not found');
      expect(data.details.requestedCount).toBe(2);
      expect(data.details.foundCount).toBe(0);
      expect(data.details.missingIds.length).toBe(2);
    });

    it('should return 500 when database query fails', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const mockResultsEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockResultsSelect = vi.fn().mockReturnValue({ eq: mockResultsEq });

      const mockSessionSingle = vi.fn().mockResolvedValue({
        data: mockSessionData,
        error: null,
      });
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle });
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'course_search_sessions') {
          return { select: mockSessionSelect };
        } else if (table === 'course_search_session_results') {
          return { select: mockResultsSelect };
        }
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch session results');
    });

    it('should verify query filters results by both session_id and result IDs', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        data: mockResultsData,
        error: null,
      });
      const mockResultsEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockResultsSelect = vi.fn().mockReturnValue({ eq: mockResultsEq });

      const mockSessionSingle = vi.fn().mockResolvedValue({
        data: mockSessionData,
        error: null,
      });
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle });
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'course_search_sessions') {
          return { select: mockSessionSelect };
        } else if (table === 'course_search_session_results') {
          return { select: mockResultsSelect };
        }
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = makeRequest('http://localhost/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody),
      });

      await POST(request);

      // Verify session_id filter
      expect(mockResultsEq).toHaveBeenCalledWith('session_id', validRequestBody.sessionId);
      
      // Verify ID filter using IN clause
      expect(mockIn).toHaveBeenCalledWith('id', validRequestBody.selectedResultIds);
    });
  });
});
