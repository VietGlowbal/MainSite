/**
 * Integration tests for Task 13.5: URL Validation
 *
 * Tests the URL validation logic in the add-courses endpoint. The completed
 * route validates URLs, drops invalid ones into `failedValidation`, and creates
 * applications for the valid ones via the atomic RPC.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock URL validator
vi.mock('@/lib/course-search/url-validator', () => ({
  batchValidateCourseUrls: vi.fn(),
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
import { batchValidateCourseUrls } from '@/lib/course-search/url-validator';
import { buildAddCoursesSupabase } from './test-helpers';

describe('POST /api/apply-shortlist/add-courses - Task 13.5: URL Validation', () => {
  const mockUserId = 'user-123';
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const mockResultId1 = '660e8400-e29b-41d4-a716-446655440000';
  const mockResultId2 = '770e8400-e29b-41d4-a716-446655440000';
  const mockResultId3 = '880e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate URLs and separate valid/invalid courses', async () => {
    const results = [
      {
        id: mockResultId1,
        course_name: 'Computer Science BSc',
        course_url: 'https://www.ox.ac.uk/courses/cs',
        session_id: mockSessionId,
      },
      {
        id: mockResultId2,
        course_name: 'Math Course PDF',
        course_url: 'https://www.ox.ac.uk/files/math.pdf',
        session_id: mockSessionId,
      },
      {
        id: mockResultId3,
        course_name: 'Wrong Domain Course',
        course_url: 'https://www.stanford.edu/courses/bio',
        session_id: mockSessionId,
      },
    ];

    const mockSupabase = buildAddCoursesSupabase({
      user: { id: mockUserId },
      session: {
        id: mockSessionId,
        user_id: mockUserId,
        status: 'complete',
        university_id: 'uni-123',
      },
      results,
      university: { primary_domain: 'ox.ac.uk' },
    });

    (createClient as any).mockResolvedValue(mockSupabase);

    // Validator: 1 valid, 2 invalid
    (batchValidateCourseUrls as any).mockResolvedValue({
      valid: [results[0]],
      invalid: [
        {
          course: results[1],
          reason: 'URL appears to be a pdf page, not a course page',
        },
        {
          course: results[2],
          reason: "Domain 'www.stanford.edu' does not match expected university domain 'ox.ac.uk'",
        },
      ],
    });

    const request = new Request('http://localhost:3000/api/apply-shortlist/add-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: mockSessionId,
        selectedResultIds: [mockResultId1, mockResultId2, mockResultId3],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Only the 1 valid course becomes an application
    expect(data.applicationsCreated).toHaveLength(1);
    // The 2 invalid courses are reported as failed validation
    expect(data.failedValidation).toHaveLength(2);
    expect(data.failedValidation[0]).toEqual({
      courseName: 'Math Course PDF',
      courseUrl: 'https://www.ox.ac.uk/files/math.pdf',
      reason: 'URL appears to be a pdf page, not a course page',
    });
    expect(data.failedValidation[1]).toEqual({
      courseName: 'Wrong Domain Course',
      courseUrl: 'https://www.stanford.edu/courses/bio',
      reason: "Domain 'www.stanford.edu' does not match expected university domain 'ox.ac.uk'",
    });

    // Verify batchValidateCourseUrls was called with the university domain
    expect(batchValidateCourseUrls).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ course_url: 'https://www.ox.ac.uk/courses/cs' }),
        expect.objectContaining({ course_url: 'https://www.ox.ac.uk/files/math.pdf' }),
        expect.objectContaining({ course_url: 'https://www.stanford.edu/courses/bio' }),
      ]),
      'ox.ac.uk'
    );
  });

  it('should handle validation when university has no primary_domain', async () => {
    const results = [
      {
        id: mockResultId1,
        course_name: 'Computer Science',
        course_url: 'https://www.someuniversity.edu/courses/cs',
        session_id: mockSessionId,
      },
    ];

    const mockSupabase = buildAddCoursesSupabase({
      user: { id: mockUserId },
      session: {
        id: mockSessionId,
        user_id: mockUserId,
        status: 'complete',
        university_id: 'uni-123',
      },
      results,
      university: { primary_domain: null },
    });

    (createClient as any).mockResolvedValue(mockSupabase);

    (batchValidateCourseUrls as any).mockResolvedValue({
      valid: results,
      invalid: [],
    });

    const request = new Request('http://localhost:3000/api/apply-shortlist/add-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: mockSessionId,
        selectedResultIds: [mockResultId1],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.applicationsCreated).toHaveLength(1);
    expect(data.failedValidation).toHaveLength(0);

    // Verify validator was called with null domain
    expect(batchValidateCourseUrls).toHaveBeenCalledWith(expect.any(Array), null);
  });

  it('should skip domain lookup when session has no university_id', async () => {
    const results = [
      {
        id: mockResultId1,
        course_name: 'Computer Science',
        course_url: 'https://www.someuniversity.edu/courses/cs',
        session_id: mockSessionId,
      },
    ];

    const mockSupabase = buildAddCoursesSupabase({
      user: { id: mockUserId },
      session: {
        id: mockSessionId,
        user_id: mockUserId,
        status: 'complete',
        university_id: null, // No university ID
      },
      results,
    });

    (createClient as any).mockResolvedValue(mockSupabase);

    (batchValidateCourseUrls as any).mockResolvedValue({
      valid: results,
      invalid: [],
    });

    const request = new Request('http://localhost:3000/api/apply-shortlist/add-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: mockSessionId,
        selectedResultIds: [mockResultId1],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.applicationsCreated).toHaveLength(1);

    // Verify validator was called with null domain (no university domain lookup)
    expect(batchValidateCourseUrls).toHaveBeenCalledWith(expect.any(Array), null);
  });
});
